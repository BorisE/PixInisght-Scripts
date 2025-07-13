/*
   StarXBatchMax.js - Apply StarXTerminator with multiple overlap values
   and merge results using maximum pixel value.

   This script clones the active view and runs StarXTerminator on each
   clone with overlap values ranging from 0.05 to 0.60.  The resulting
   images are then combined with a PixelMath expression taking the
   maximum value for every pixel.
*/

#feature-id    Utilities2 > StarXBatchMax
#feature-info  Apply StarXTerminator with multiple overlap parameters and
#feature-info  compose the maximum of the results.

#include <pjsr/UndoFlag.jsh>

function cloneView( view, newId )
{
   var win = new ImageWindow( view.image.width, view.image.height,
                              view.image.numberOfChannels,
                              view.image.bitsPerSample, view.image.isReal,
                              view.image.isColor, newId );
   win.mainView.beginProcess( UndoFlag_NoSwapFile );
   win.mainView.image.assign( view.image );
   win.mainView.endProcess();
   win.mainView.id = newId;
   return win.mainView;
}

function run()
{
   var window = ImageWindow.activeWindow;
   if ( window.isNull )
      throw new Error( "No active image" );

   var baseView = window.currentView;
   var overlapValues = [];
   for ( var o = 0.05; o <= 0.60 + 1e-5; o += 0.05 )
      overlapValues.push( Math.round( o*100 )/100 );

   var ids = [];

   for ( var i = 0; i < overlapValues.length; ++i )
   {
      var ov = overlapValues[i];
      var suffix = ( ov*100 < 10 ? "0" : "" ) + Math.round( ov*100 );
      var id = "SXT_" + suffix;
      var clone = cloneView( baseView, id );

      var P = new StarXTerminator;
      P.ai_file = "StarXTerminator.11.pb";
      P.stars = false;
      P.unscreen = false;
      P.overlap = ov;
      P.executeOn( clone );

      ids.push( id );
   }

   var expression = "max(" + ids.join( "," ) + ")";

   var PM = new PixelMath;
   PM.expression = expression;
   PM.useSingleExpression = true;
   PM.generateOutput = true;
   PM.singleThreaded = false;
   PM.optimization = true;
   PM.use64BitWorkingImage = false;
   PM.rescale = false;
   PM.rescaleLower = 0;
   PM.rescaleUpper = 1;
   PM.truncate = true;
   PM.truncateLower = 0;
   PM.truncateUpper = 1;
   PM.createNewImage = true;
   PM.showNewImage = true;
   PM.newImageId = baseView.id + "_SXTmax";
   PM.newImageWidth = 0;
   PM.newImageHeight = 0;
   PM.newImageAlpha = false;
   PM.newImageColorSpace = PixelMath.prototype.SameAsTarget;
   PM.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
   PM.executeOn( baseView );
}

run();
