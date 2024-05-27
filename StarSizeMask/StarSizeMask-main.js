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

#feature-id Utilities2 > StarSizeMask
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

   //SSMObj.saveStars("d:/M63stars.csv");
   //SSMObj.createMask(undefined, false, false, "StarMask_ord");
   //  *this.createMaskAngle = function (StarsArray=undefined, softenMask = true, maskGrowth = true,  contourMask = false, maskName = "stars")

   let mask = SSMObj.createMaskAngle(undefined, true, true, false, "StarMask_ang");
   //SSMObj.markStars();
   //SSMObj.makeResidual(mask);



   var Stars3 = SSMObj.filterStarsByFlux(10, 1000);
   SSMObj.printStars(Stars3);
   //SSMObj.printGroupStat(Stars3);
   //SSMObj.markStars(Stars3);
   //let mask = SSMObj.createMaskAngle(Stars3, true, false, false, "StarMask_small");
   //SSMObj.makeResidual(mask, Stars3);


   //SSMObj.closeTempImages();

   console.writeln( "Runtime: " + T.text );

}

function main_test() {
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
   SSMObj.fitStarPSF();
   SSMObj.calculateStarStats();
   SSMObj.printStars(AllStars, 10);
   SSMObj.printGroupStat();

   for ( let i = 0; i < AllStars.length; i++ )
   {
      let s = AllStars[i];

      if (!s.PSF_rect)
      {
            if ( s.fluxGroup == SSMObj.FluxGrouping.numIntervals-1 )
            {
               var prev = SSMObj.prevPSFfitted(i);
               var next = SSMObj.nextPSFfitted(i);
               debug("idx = " + i + ", prev = " + prev.PSF_flux + ", next = " + next.PSF_flux);
               let diagonal = next.PSF_diag;
               let k = diagonal / next.flux;
               let w = s.flux * k;
               debug("s.flux = " + s.flux + ", next.psfRect_w = " + next.psfRect_w + ", s_w = " + w);
            }

      }
   }



/*
   var Stars3 = SSMObj.filterStarsByFlux(5.1, 1000);
   SSMObj.printStars(Stars3);
   //SSMObj.printGroupStat(Stars3);
   SSMObj.markStars(Stars3);
   let mask = SSMObj.createMaskAngle(Stars3, true, false, false, "StarMask_small");
   SSMObj.makeResidual(mask, Stars3);
*/

   SSMObj.closeTempImages();

   console.writeln( "Runtime: " + T.text );
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
