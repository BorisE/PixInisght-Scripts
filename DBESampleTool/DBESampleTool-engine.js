function DBESampleToolEngine( samplesPerRow, sampleRadius, rejection )
{
   this.samplesPerRow = samplesPerRow;
   this.sampleRadius = sampleRadius;
   this.rejection = rejection;
}

// Center one sample per cell and cap the density so complete sample boxes fit.
DBESampleToolEngine.prototype.generateRegularGrid = function( image )
{
   var width = image.width;
   var height = image.height;
   var radius = this.sampleRadius;
   var diameter = 2 * radius + 1;
   var columns = Math.min( this.samplesPerRow, Math.floor( width / diameter ) );
   var maxRows = Math.floor( height / diameter );

   if ( columns === 0 || maxRows === 0 )
      return [];

   var rows = Math.min( maxRows, Math.max( 1, Math.round( columns * height / width ) ) );
   var cellWidth = width / columns;
   var cellHeight = height / rows;
   var points = [];

   for ( var row = 0; row < rows; ++row )
   {
      var y = Math.floor( (row + 0.5) * cellHeight );
      for ( var column = 0; column < columns; ++column )
      {
         var x = Math.floor( (column + 0.5) * cellWidth );
         points.push( { x: x, y: y, radius: radius } );
      }
   }

   return points;
};

/**
 * Prepare a native DBE instance for the measured sample tables.
 */
DBESampleToolEngine.prototype.createProcess = function( image )
{
   var process = new DynamicBackgroundExtraction;
   process.numberOfChannels = image.isColor ? 3 : 1;
   process.imageWidth = image.width;
   process.imageHeight = image.height;
   process.defaultSampleRadius = this.sampleRadius;
   process.samplesPerRow = this.samplesPerRow;
   return process;
};

// Estimate the local level after clipping bright peaks within this rectangle.
function dbeClippedMedian( image, rect, channel, pixels )
{
   var median = image.median( rect, channel, channel );
   var sigma = 1.4826 * image.MAD( median, rect, channel, channel );
   var limit = median + Math.max( 4 * sigma, 1e-7 );
   var count = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
   image.getSamples( pixels, rect, channel );

   var retained = [];
   for ( var i = 0; i < count; ++i )
      if ( pixels[i] <= limit )
         retained.push( pixels[i] );
   return retained.length === count ? median : Math.median( retained );
}

// Use median slopes so a few bright patches have little influence on the plane.
function dbeBackgroundSlopes( points, columns, channel )
{
   var horizontal = [];
   var vertical = [];
   for ( var i = 0; i < points.length; ++i )
   {
      var point = points[i];
      if ( i % columns !== 0 )
      {
         var left = points[i - 1];
         horizontal.push( (point.level[channel] - left.level[channel]) / (point.x - left.x) );
      }
      if ( i >= columns )
      {
         var above = points[i - columns];
         vertical.push( (point.level[channel] - above.level[channel]) / (point.y - above.y) );
      }
   }
   return {
      x: horizontal.length ? Math.median( horizontal ) : 0,
      y: vertical.length ? Math.median( vertical ) : 0
   };
}

// Require one connected group of bright blocks, joined through shared edges.
function dbeHasExtendedSignal( bright, size, minimum )
{
   for ( var i = 0; i < bright.length; ++i )
      if ( bright[i] )
      {
         var group = [i];
         bright[i] = false;
         for ( var j = 0; j < group.length; ++j )
         {
            var index = group[j];
            var x = index % size;
            var neighbors = [x > 0 ? index - 1 : -1, x + 1 < size ? index + 1 : -1,
               index - size, index + size];
            for ( var k = 0; k < neighbors.length; ++k )
            {
               var next = neighbors[k];
               if ( bright[next] )
               {
                  bright[next] = false;
                  group.push( next );
               }
            }
            if ( group.length >= minimum )
               return true;
         }
      }
   return false;
}

DBESampleToolEngine.prototype.filterExtendedStructure = function( image, points, channels, pixels )
{
   var diameter = 2 * this.sampleRadius + 1;
   // Use 4 x 4 for large boxes and larger blocks relative to smaller boxes.
   var size = Math.max( 2, Math.min( 4, Math.floor( diameter / 7 ) ) );
   var blockCount = size * size;
   var minimum = Math.max( 3, Math.ceil( blockCount * this.rejection.area / 100 ) );
   console.writeln( "Rejection: ", this.rejection.sigma, " sigma, ", this.rejection.area,
      "% bright area (", minimum, " of ", blockCount, " connected blocks required)." );
   var columns = 1;
   while ( columns < points.length && points[columns].y === points[0].y )
      ++columns;

   var rect = new Rect( 0 );
   for ( var i = 0; i < points.length; ++i )
   {
      var point = points[i];
      point.blocks = [];
      point.level = [];
      for ( var row = 0; row < size; ++row )
         for ( var col = 0; col < size; ++col )
         {
            rect.x0 = point.x - point.radius + Math.floor( col * diameter / size );
            rect.y0 = point.y - point.radius + Math.floor( row * diameter / size );
            rect.x1 = point.x - point.radius + Math.floor( (col + 1) * diameter / size );
            rect.y1 = point.y - point.radius + Math.floor( (row + 1) * diameter / size );
            var block = { x: (rect.x0 + rect.x1 - 1) / 2, y: (rect.y0 + rect.y1 - 1) / 2, level: [] };
            for ( var c = 0; c < channels; ++c )
               block.level[c] = dbeClippedMedian( image, rect, c, pixels );
            point.blocks.push( block );
         }
      for ( var c = 0; c < channels; ++c )
         point.level[c] = Math.median( point.blocks.map( function( block ) { return block.level[c]; } ) );
   }

   for ( var c = 0; c < channels; ++c )
   {
      var slope = dbeBackgroundSlopes( points, columns, c );
      var residuals = [];
      for ( var i = 0; i < points.length; ++i )
         for ( var j = 0; j < points[i].blocks.length; ++j )
         {
            var block = points[i].blocks[j];
            block.residual = block.level[c] - slope.x * block.x - slope.y * block.y;
            residuals.push( block.residual );
         }

      var center = Math.median( residuals );
      var mad = Math.median( residuals.map( function( value ) { return Math.abs( value - center ); } ) );
      var threshold = center + Math.max( this.rejection.sigma * 1.4826 * mad, 1e-7 );
      for ( var i = 0; i < points.length; ++i )
         if ( !points[i].rejected )
            points[i].rejected = dbeHasExtendedSignal( points[i].blocks.map( function( block )
            {
               return block.residual > threshold;
            } ), size, minimum );
   }

   return points.filter( function( point ) { return !point.rejected; } );
};

/**
 * Measure the grid on the current image and populate a native DBE instance.
 * Return the prepared instance for manual editing or first-time icon creation.
 * Return null after updating an existing process icon.
 */
DBESampleToolEngine.prototype.saveProcessIcon = function( view, iconId, openManually )
{
   iconId = iconId || view.id + "_DBE";
   var image = view.image;
   console.noteln( "Target: ", view.id, " (", image.width, " x ", image.height, ")" );
   console.writeln( "Regular grid: ", this.samplesPerRow, " requested samples per row, radius ", this.sampleRadius, " px." );
   var points = this.generateRegularGrid( image );
   if ( points.length === 0 )
      throw new Error( "The sample radius is too large for the target image." );

   var channels = image.isColor ? 3 : 1;
   var pixels = null;
   if ( this.rejection )
   {
      var diameter = 2 * this.sampleRadius + 1;
      pixels = new Float64Array( diameter * diameter );
      var originalCount = points.length;
      points = this.filterExtendedStructure( image, points, channels, pixels );
      console.writeln( "Extended structure rejection: ", originalCount - points.length, " of ", originalCount, " samples skipped." );
      if ( points.length < 3 )
         throw new Error( "Fewer than three background samples remain after structure rejection." );
   }


   var data = [];
   var samples = [];
   var rect = new Rect( 0 );

   for ( var i = 0; i < points.length; ++i )
   {
      var point = points[i];
      var radius = point.radius;
      rect.x0 = point.x - radius;
      rect.y0 = point.y - radius;
      rect.x1 = point.x + radius + 1;
      rect.y1 = point.y + radius + 1;

      var values = [0, 0, 0, 0, 0, 0];
      for ( var channel = 0; channel < channels; ++channel )
      {
         values[2 * channel] = pixels ? dbeClippedMedian( image, rect, channel, pixels ) :
            image.median( rect, channel, channel );
         values[2 * channel + 1] = 1;
      }

      // DBE fits the model from normalized coordinates in data. The interface
      // displays the editable pixel coordinates and radius from samples.
      data.push( [point.x / image.width, point.y / image.height].concat( values ) );
      // No symmetry, six axial positions if enabled, and editable samples.
      samples.push( [point.x, point.y, radius, 0, 6, 0].concat( values ) );
   }

   var process = this.createProcess( image );
   process.data = data;
   process.samples = samples;

   console.writeln( "Generated ", points.length, " samples." );
   // Manual output hands the populated instance back to the dialog without writing an icon.
   if ( openManually )
   {
      console.noteln( "Opening DBE for manual editing and saving." );
      return process;
   }

   // writeIcon() replaces an existing icon. Return the instance for first-time creation.
   if ( ProcessInstance.iconsByProcessId( "DynamicBackgroundExtraction" ).indexOf( iconId ) < 0 )
   {
      console.writeln( "Opening DBE to create process icon: ", iconId );
      return process;
   }

   if ( !process.writeIcon( iconId ) )
      throw new Error( "PixInsight could not update the DBE process icon." );

   console.noteln( "Updated DBE process icon: ", iconId );
   return null;
};
