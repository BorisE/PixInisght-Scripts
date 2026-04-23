/*

*/

#feature-id    Utilities2 > RepalceWithPreview
#feature-info  Replace part of the image by it'part.
#feature-info  Shoul specify target image id, patch image id and x0,y0 coordinates of the patch

#include <pjsr/UndoFlag.jsh>

// --- user settings ---
var targetId = "RGB";   // ImageWindow id of the big image
var patchId  = "RGB_Preview011"; // ImageWindow id of the small image
var x0 = 157;                // top-left X in target
var y0 = 100;                // top-left Y in target
// ---------------------

var W = ImageWindow.windowById( targetId );
var P = ImageWindow.windowById( patchId );
if ( W.isNull || P.isNull )
   throw new Error( "Can't find one of the image windows (check window IDs)." );

var view = W.mainView;
var big = view.image;
var patch = P.mainView.image;

var w = Math.min( patch.width,  big.width  - x0 );
var h = Math.min( patch.height, big.height - y0 );
if ( w <= 0 || h <= 0 )
   throw new Error( "Patch is outside target bounds (check x0/y0)." );

view.beginProcess( UndoFlag_All );

var n = Math.min( big.numberOfChannels, patch.numberOfChannels );
for ( var c = 0; c < n; ++c )
   for ( var y = 0; y < h; ++y )
      for ( var x = 0; x < w; ++x )
         big.setSample( patch.sample( x, y, c ), x0 + x, y0 + y, c );

view.endProcess();
