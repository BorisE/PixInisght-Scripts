/*
 *  StarSizeMask - A PixInsight Script to create StarMasks based on their sizes
 *  Copyright (C) 2024  Boris Emchenko http://astromania.info
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

#include "StarSizeMask-version.jsh"
#include "StarSizeMask-engine.js"

#feature-id Utilities > StarSizeMask
#feature-info StarSizeMask - is a PixInsight Script to create StarMasks \
    based on their sizes \
    stars, create masks from them and, finally, to fix them. \
    \
    Copyright &copy; 2024 Boris Emchenko http://astromania.info

function main() {
   console.abortEnabled = true;
   var refView = ImageWindow.activeWindow.currentView;

   console.noteln("<cbr><b>" + __SCRIPT_NAME + "</b> by Boris Emchenko");
   console.noteln("v" + __SCRIPT_VERSION + " from "+ __SCRIPT_DATE + "<br>");

   console.writeln ("Working on image: <b>" + refView.fullId + "</b>");
   if (refView.window.filePath) console.writeln ("ImagePath: " + refView.window.filePath + "");

   let T = new ElapsedTime;

   var SSMObj = new StarSizeMask_engine();
   SSMObj.debug = true;

   //SSMObj.sourceView = refView;
   //SSMObj.addPiedestal();
   //return;

   var AllStars = SSMObj.getStars( refView );
   SSMObj.calculateStarStats();
   SSMObj.fitStarPSF();
   //SSMObj.printStars();
   SSMObj.printGroupStat();

   //SSMObj.saveStars("d:/stars.csv");
   //SSMObj.createMask(undefined, false, false, "StarMask_ord");
   //  *this.createMaskAngle = function (StarsArray=undefined, softenMask = true, maskGrowth = true,  contourMask = false, maskName = "stars")
   /*
   let mask = SSMObj.createMaskAngle(undefined, true, true, false, "StarMask_ang");
   SSMObj.markStars();
   SSMObj.makeResidual(mask);
   */

   var Stars3 = SSMObj.filterStarsByFlux(0, 0.64);
   SSMObj.printStars(Stars3);
   //SSMObj.printGroupStat(Stars3);
   SSMObj.markStars(Stars3);
   let mask = SSMObj.createMaskAngle(Stars3, true, true, false, "StarMask_small");
   SSMObj.makeResidual(mask, Stars3);

   SSMObj.closeTempImages();

   console.writeln( "Runtime: " + T.text );

}

function main_test() {
   console.abortEnabled = true;

   var refImage = ImageWindow.activeWindow.mainView.image;
   console.noteln("ImageWindow.activeWindow.currentView.id = " + ImageWindow.activeWindow.currentView.id);
   console.noteln("ImageWindow.activeWindow.currentView.image.height = " + ImageWindow.activeWindow.currentView.image.height);

   //let q = ImageWindow.activeWindow.currentView.window.imageToCelestial( {x:100.0, y:100.0} );
   let q = refView.window.imageToCelestial( 100.0, 100.0 );
   console.writeln ( q.x, q.y ) ;

   //return false;

   var stars_test = [];
   stars_test.push( {pos: {x : 6000.233434, y : 1000.299}, size: 250,   rect: {x0:10, y0:14, x1:15, y1:20}, flux : 232, bkg : 0.00921, nmax : 1 });
   stars_test.push( {pos: {x : 1000.233434, y :  200.299}, size: 50,    rect: {x0:10, y0:14, x1:25, y1:40}, flux : 2, bkg : 0.009, nmax : 1 });
   stars_test.push( {pos: {x : 10.233434, y :  5200.299}, size: 5,    rect: {x0:10, y0:14, x1:25, y1:40}, flux : 2, bkg : 0.00891, nmax : 1 });

   flux_min = MaxInt;
   flux_max = 0;
   bg_min = 1;
   bg_max = 0;
   w_min = MaxInt;
   w_max= 0;
   h_min = MaxInt;
   h_max = 0;
   size_max = 0;
   size_min = MaxInt;

   console.noteln( format("(%6s, %6s): %5s / %7s | [%3s, %3s]: %4s | (%3s)", "x", "y", "flux", "bckgrnd", "w", "h", "sqr", "nmax"));
   stars_test.forEach(
      function (s)
      {
         console.writeln( format("(%6.1f, %6.1f): %5d / %7.5f | [%3d, %3d]: %4d | (%1d)", s.pos.x, s.pos.y, s.flux, s.bkg, (s.rect.x1-s.rect.x0), (s.rect.y1-s.rect.y0), s.size, s.nmax));
         if ( s.flux < flux_min )
            flux_min = s.flux;
         if ( s.flux > flux_max )
            flux_max = s.flux;

         if ( s.bkg < bg_min )
            bg_min = s.bkg;
         if ( s.bkg > bg_max )
            bg_max = s.bkg;

         if ( (s.rect.x1-s.rect.x0) < w_min )
            w_min = (s.rect.x1-s.rect.x0);
         if ( (s.rect.x1-s.rect.x0) > w_max )
            w_max = (s.rect.x1-s.rect.x0);

         if ( (s.rect.y1-s.rect.y0) < h_min )
            h_min = (s.rect.y1-s.rect.y0);
         if ( (s.rect.y1-s.rect.y0) > h_max )
            h_max = (s.rect.y1-s.rect.y0);

         if ( s.size < size_min )
            size_min = s.size;
         if ( s.size > size_max )
            size_max = s.size;

      }
   );
   console.noteln( format("%5d stars %4s: %5d / %7.5f | [%3d, %3d]: %4d", stars_test.length, "min", flux_min, bg_min, w_min, h_min, size_min));
   console.noteln( format("%16s: %5d / %7.5f | [%3d, %3d]: %4d", "max", flux_max, bg_max, w_max, h_max, size_max));

   //console.writeln( format("(%d, %d): %d px^2 [%.2f, %.2f]", star.pos.x,", ",star.pos.x, "): ", star.size, "px2 [", star.rect.x1-star.rect.x0, ", ", star.rect.y1-star.rect.y0,"] ", star.flux, " ", star.nmax, " ", star.bkg, " ");
   //console.writeln( format("(%7.1f, %7.1f): %5d px^2", 6000.233434, 2000.3234234, 10));
   //console.writeln( format("(%7.1f, %7.1f): %5d px^2", 2.233434, 190.3234234, 2));

}

//main_test();
main();

function GetWindowBmp(window)
{
   var imageOrg = window.mainView.image;
   var tmpW = null;
   try
   {
      tmpW = new ImageWindow(imageOrg.width, imageOrg.height, imageOrg.numberOfChannels,
         window.bitsPerSample, window.isFloatSample, imageOrg.isColor, "Aux");
      tmpW.mainView.beginProcess(UndoFlag_NoSwapFile);
      tmpW.mainView.image.apply(imageOrg);
     // ApplySTF(tmpW.mainView, window.mainView.stf);
      tmpW.mainView.endProcess();
      var bmp = new Bitmap(imageOrg.width, imageOrg.height);
      bmp.assign(tmpW.mainView.image.render());
      return bmp;
   } finally
   {
      tmpW.forceClose();
   }
}
