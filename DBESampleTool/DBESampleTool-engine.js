function DBESampleToolEngine()
{
   this.samplesPerRow = 12;
   this.sampleRadius = 10;
}

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

DBESampleToolEngine.prototype.saveProcessIcon = function( view, iconId )
{
   var image = view.image;
   var points = this.generateRegularGrid( image );
   if ( points.length === 0 )
      throw new Error( "The sample radius is too large for the target image." );

   var channels = image.isColor ? 3 : 1;
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
         values[2 * channel] = image.median( rect, channel, channel );
         values[2 * channel + 1] = 1;
      }

      data.push( [point.x / image.width, point.y / image.height].concat( values ) );
      // No symmetry, six axial positions if enabled, and editable samples.
      samples.push( [point.x, point.y, radius, 0, 6, 0].concat( values ) );
   }

   var process = new DynamicBackgroundExtraction;
   process.numberOfChannels = channels;
   process.imageWidth = image.width;
   process.imageHeight = image.height;
   process.defaultSampleRadius = this.sampleRadius;
   process.samplesPerRow = this.samplesPerRow;
   process.data = data;
   process.samples = samples;

   iconId = iconId || view.id + "_DBE";
   // writeIcon() replaces an existing icon. Return the instance for first-time creation.
   if ( ProcessInstance.iconsByProcessId( "DynamicBackgroundExtraction" ).indexOf( iconId ) < 0 )
      return process;

   if ( !process.writeIcon( iconId ) )
      throw new Error( "PixInsight could not update the DBE process icon." );

   return null;
};
