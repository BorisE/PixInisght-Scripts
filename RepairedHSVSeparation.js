/*
   Repaired HSV Separation.js v1.0

   Copyright (C) 2013 Bob Andersson

   This program is free software: you can redistribute it and/or modify it
   under the terms of the GNU General Public License as published by the
   Free Software Foundation, version 3 of the License.

   This program is distributed in the hope that it will be useful, but WITHOUT
   ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
   FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
   more details.

   You should have received a copy of the GNU General Public License along with
   this program.  If not, see <http://www.gnu.org/licenses/>.

   Revision history:

   v 1.0    Initial release
   v 1.0.1  "img.numberOfChannels" added explicitly to a couple of new ImageWindow constructors (thanks Andres.Pozo)
   v 1.0.2  Improved calculation and displayed precision of the maximum clipping/minimum repair levels
   v 1.0.3  Code update to fix "assignment to undeclared variable" warnings under PI v1.8

*/

#feature-id    Utilities2 > Repaired HSV Separation+

#feature-info Create HSV images from an RGB image<br/>\
   <br/>\
   This script takes an RGB image and produces H, Sv and V images which it additionally \
   attempt to repair, drawing in values from areas surrounding those parts of the H and Sv \
   separations where one or more of the RGB pixels is approaching saturation. A less aggressive \
   attempt is also made to smooth non-linear areas of the V separation. \
   \
   The intent is that after stretching (external to this script) the HSV separations can be \
   recombined to produce a stretched image which retains all the original colour. This effect \
   can look extreme so the script also offers an opportunity to output a 'repaired' RGB which \
   can als be stretched separately. This can then be blended with the recombined RGB just \
   mentioned to produce an aesthetically more conventional result. \
   <br/>\
   Copyright (C) 2013 Bob Andersson \
   <br/>\
   Modified by BorisE 2024 (RGB with Unrepaired V)
   

#define VERSION   "1.0.3b"
#define TITLE   "Repaired HSV Separation Script"

#define DEBUG true
#define SETTINGS_KEY "CHSVS"
#define MAXRADIUS 50

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/MaskMode.jsh>

//== Data ====================================================================================================================

var window = ImageWindow.activeWindow;
var pixelcount = window.mainView.image.height * window.mainView.image.width;
var h = new Histogram ();
var histogram = new Array();
var channels = 0 ;
var peakLevel = 65535;
var minLevel = new Array();
var maxLevel = new Array();


// Define a data "structure" and create an instance
function DarkMaskLayersData()
{
   this.targetWindow = window;
   this.targetView = window.mainView;
   this.lastTargetID = window.mainView.id;
   this.h_Name = "";
   this.s_Name = "";
   this.v_Name = "";
   this.outputOrigV = false;
   this.ov_Name = "";
   this.outputRGB = true;
   this.r_Name = "";
   this.BlackClips = 0;
   this.WhiteClips = 0.5;
   this.StarRadius = 16;
}

var data = new DarkMaskLayersData();

//== Data Persistence ========================================================================================================
// Relies heavily on using the same names for the various data items and also the same order
// DataPersistence does not save or load the first two items in "data". Dangerous stuff as
// it relies so heavily on two structures being similar in layout and naming!

function DataPersistence()
{
   var elements = new Array (
      new Array ("lastTargetID",        DataType_String),
      new Array ("h_Name",              DataType_String),
      new Array ("s_Name",              DataType_String),
      new Array ("v_Name",              DataType_String),
      new Array ("outputOrigV",         DataType_Boolean),
      new Array ("ov_Name",             DataType_String),
      new Array ("outputRGB",           DataType_Boolean),
      new Array ("r_Name",              DataType_String),
      new Array ("BlackClips",          DataType_Float),
      new Array ("WhiteClips",          DataType_Float),
      new Array ("StarRadius",          DataType_Float));

//      new Array ("repairV",             DataType_Boolean));

   this.load = function()
   {
      var tmp;
      for (var i in elements)
      {
         var s = elements[i][0];
         var t = elements[i][1];
		 console.noteln("s="+s);
		 if (s) {
			tmp = Settings.read (SETTINGS_KEY + "/" + s, t);
			if (Settings.lastReadOK) data[s] = tmp;
		 }
      }
      if (data.lastTargetID != window.mainView.id)
      {  // Different image so best to use default names and clipping
         data.lastTargetID = window.mainView.id;
         data.h_Name = "";
         data.s_Name = "";
         data.v_Name = "";
         data.ov_Name = "";
         data.r_Name = "";
         data.BlackClips = 0;
      }
   }

   this.save = function()
   {
      for (var i in elements)
      {
        var s = elements[i][0];
        var t = elements[i][1];
		if (s) {
		 Settings.write (SETTINGS_KEY + "/" + s, t, data[s]);
		}
      }
   }

   this.erase = function()
   {
      Settings.remove (SETTINGS_KEY);
   }
}
var dp = new DataPersistence();

//== Class PixelSearch =======================================================================================================

function PixelSearch(starradius)
{
   if ((starradius < 1) || (starradius > MAXRADIUS)) throw("Invalid star size");
   this.radius = starradius;
   this.R = new Matrix(starradius*2 + 1, starradius*2 + 1);

   this._circumference = new Array(starradius);    // value will be the number of points for each radial distance
   this._circles = new Array(starradius);          // will hold an array of coords for each radial distance
   for (var i = 0; i < starradius; ++i)
   {
      this._circumference[i] = 0;
      this._circles[i] = new Array();
   }
   this._counter = 0;
   this._sradius = 0;

   var radialDistanceSquared = 0;
   var r = 0;
   for (var row = -starradius; row <= starradius; row++)
   {
      for (var col = -starradius; col <= starradius; col++)
      {
         radialDistanceSquared = row*row + col*col;
         r = Math.round(Math.sqrt(radialDistanceSquared));
         if (r <= starradius)
         {  // Now set a value which decreases linearly with distance
            // This will be used to weight values extracted from the H and Sv data so that good pixels
            // closest to the blown pixel are more likely to have influence on the repair value
            this.R.at(starradius + row, starradius + col, (r == 0) ? 0.0 : 1/r);
            // Now set a value which decreases with the square of the distance
            // this.R.at(starradius + row, starradius + col, (radialDistanceSquared == 0) ? 0.0 : 1/radialDistanceSquared);
         }
         else
         {
            this.R.at(starradius + row, starradius + col, 0.0);
         }
         if ((this.R.at(starradius + row, starradius + col) > 0) && (--r >= 0))
         {  // We have a pixel that should be included in subsequent searches
            var pt = new Point(row, col);
            this._circles[r].push(pt);
            // Increment the count of points held in the arrays for the radius "r"
            ++this._circumference[r];
         }
      }
   }
};

PixelSearch.prototype.at = function(row, col)
{
   row += this.radius;
   col += this.radius;
   if ((row < 0) || (col < 0) || (row >= this.R.rows) || (col >= this.R.cols)) return 0;
   return this.R.at(row, col);
};

PixelSearch.prototype.circLength = function(radius)
{
   if ((radius < 1) || (radius > this.radius)) return 0;
   return this._circumference[radius - 1];
};

PixelSearch.prototype.startSearch = function(radius)
{
   this._counter = 0;
   this._sradius = radius - 1;
   return this.circLength(radius);
};

PixelSearch.prototype.nextCoords = function(moreToCome)
{  // If moreToCome is an Object (boolean) then nextCoords will set it true if returning the last coordinates
   var more = (this._counter < (this._circumference[this._sradius] - 1));
   moreToCome.valueOf = moreToCome.toSource = moreToCome.toString = function () {return (more)};
   if (this._counter >= this._circumference[this._sradius]) return new Point(0,0);
   return this._circles[this._sradius][this._counter++];
};

//============================================================================================================================

function SeparateAndClean()
{  // I have data.targetView as the source RGB.

   console.show();

   // Helper function
   function ResolveDuplicateNames(name)
   {  // Need to be sure of the names used/returned by ChannelExtraction and Convolution
      if (name.length == 0) name = "CHSVS" + Number(Math.round(1 + 998*Math.random())).toString();
      if ((name[0] >= "0") && (name[0] <= "9")) name = "_" + name;
      if (ImageWindow.windowById(name).isNull) return name;
      let suffix = 1;
      while ((suffix < 99) && (!(ImageWindow.windowById(name + suffix).isNull)))
      {  // if there are 99 windows with matching names then throw!!!
         ++suffix;
      }
      if (suffix >= 100) throw("Unable to generate unique image names");
      console.writeln("An image named '", name, "' is already open. Using new name '", name + suffix, "'.");
      name += suffix;
      return name;
   }

   if (data.h_Name.length == 0) data.h_Name = data.targetView.id + "_H";
   data.h_Name = ResolveDuplicateNames(data.h_Name);
   if (data.s_Name.length == 0) data.s_Name = data.targetView.id + "_Sv";
   data.s_Name = ResolveDuplicateNames(data.s_Name);
   if (data.v_Name.length == 0) data.v_Name = data.targetView.id + "_V";
   data.v_Name = ResolveDuplicateNames(data.v_Name);
   if (data.ov_Name.length == 0) data.ov_Name = data.targetView.id + "_Unrepaired_V";
   data.ov_Name = ResolveDuplicateNames(data.ov_Name);
   if (data.r_Name.length == 0) data.r_Name = data.targetView.id + "_Repaired_RGB";
   data.r_Name = ResolveDuplicateNames(data.r_Name);


   // Before I do a "black clip" I want to copy the input image so that the original is unaltered
   let inputWindowCopyName = ResolveDuplicateNames("Input_Window_Copy");
   let img = data.targetView.image;
   let inputWindowCopy = new ImageWindow (1, 1, img.numberOfChannels, img.bitsPerSample, img.sampleType == SampleType_Real, img.isColor, inputWindowCopyName);
   inputWindowCopy.hide();

   with (inputWindowCopy.mainView)
   {
      img.firstSelectedChannel = 0;
      img.lastSelectedChannel = img.numberOfChannels - 1;
      beginProcess(UndoFlag_NoSwapFile);
      image.assign(img);
      endProcess();
   }

   // Use PixelMath to subtract blacks from rgb "rgb - black"
   let pm = new PixelMath;
   let expr = inputWindowCopy.mainView.id + "-" + data.BlackClips;
   with (pm)
   {
      expression = expr;
      useSingleExpression = true;
      newImageId = inputWindowCopyName;
      rescale = false;
      use64BitWorkingImage = true;
      createNewImage = false;
      executeOn(inputWindowCopy.mainView, false);
   }

   // Use PixelMath to create a monochrome map image "iif(max(rgb[0], rgb[1], rgb[2]) >= whites, 1.0, 0.0)"
   let mapWindowTempName1 = ResolveDuplicateNames("Map_Window_1");
   let mapWindow1 = new ImageWindow (img.width, img.height, 1, img.bitsPerSample, img.sampleType == SampleType_Real, false, mapWindowTempName1);
   mapWindow1.hide();

   expr = "iif(max(" + data.targetView.id + "[0], " + data.targetView.id + "[1], " + data.targetView.id + "[2]) >= " + data.WhiteClips + ", 1.0, 0.0)";
   with (pm)
   {
      expression = expr;
      useSingleExpression = true;
      newImageId = mapWindowTempName1;
      rescale = false;
      use64BitWorkingImage = true;
      createNewImage = false;
      executeOn(mapWindow1.mainView, false);
   }

   // Now create a copy of that map image, convolve it slightly and use PixelMath to set all pixels != 1 in the map
   // and >= 0.2 in the new image to 1.0
   let mapWindowTempName2 = ResolveDuplicateNames("Map_Window_2");
   let mapWindow2 = new ImageWindow (1, 1, 1, img.bitsPerSample, img.sampleType == SampleType_Real, false, mapWindowTempName2);
   mapWindow2.hide();

   with (mapWindow2.mainView)
   {
      beginProcess(UndoFlag_NoSwapFile);
      image.assign(mapWindow1.mainView.image);
      endProcess();
   }
   let convolution = new Convolution;
   with (convolution)
   {
      mode = Parametric;
      sigma = 1.1;
      shape = 2.0;
      aspectRatio = 1.0;
      rotationAngle = 0.0;
      executeOn(mapWindow2.mainView, false);
   }
   expr = "iif((" + mapWindow2.mainView.id + " >= 0.05) && (" + mapWindow1.mainView.id + " < 0.99), 1.0, 0.0)";
   with (pm)
   {
      expression = expr;
      useSingleExpression = true;
      newImageId = mapWindowTempName2;
      rescale = false;
      use64BitWorkingImage = true;
      createNewImage = false;
      executeOn(mapWindow2.mainView, false);
   }
   // mapWindow2 provides a map of those pixels surrounding blown pixels which MAY be used to try and repair the H and Sv data
   // For isolated stars this will work quite well but for groups of blown stars which are touching there will be issues which
   // will not be intirely resolved by the additional use of the "Max Star Size" mask



   // Use ChannelExtraction to create H, Sv and V images from rgb
   let channelExtraction = new ChannelExtraction;
   with ( channelExtraction )
   {
      colorSpace = HSV;
      channels = [[true, data.h_Name], [true, data.s_Name], [true, data.v_Name]];
      sampleFormat = SameAsSource;
      executeOn(inputWindowCopy.mainView, false);
   }  // with channelExtraction
   if (data.outputOrigV || data.outputRGB)      // Changed by BorisE
   {  // Currently holds a copy of the input image so assign it the orginal V image
      with (inputWindowCopy.mainView)
      {  // Assuming here that the change in image parameters isn't a problem
         beginProcess(UndoFlag_NoSwapFile);
         image.assign(ImageWindow.windowById(data.v_Name).mainView.image);
         id = data.ov_Name;
         endProcess();
      }
      inputWindowCopy.zoomToOptimalFit();
      inputWindowCopy.show();
   }
   else
   {
      inputWindowCopy.forceClose();     // Not needed again unless output requested so release some memory
   }


   // Create Matrix representations of H, Sv, Blown and mask
   // Note that elements are accessed by, for example, pixel = H.at(row, col) and set by H.at(row, col, pixel)
   let H = new Matrix(img.height, img.width); // The Matrix constructor is Matrix(int rows, int cols)
   H = ImageWindow.windowById(data.h_Name).mainView.image.toMatrix();   // Assumption is that beginProcess/endProcess not needed in this direction
   let S = new Matrix(img.width, img.height);
   S = ImageWindow.windowById(data.s_Name).mainView.image.toMatrix();
   let B = new Matrix(img.width, img.height);
   B = mapWindow1.mainView.image.toMatrix();
   mapWindow1.forceClose();           // Not needed again unless output requested so release some memory
   let M = new Matrix(img.width, img.height);
   M = mapWindow2.mainView.image.toMatrix();
   mapWindow2.forceClose();  // Not needed again unless output requested so release some memory

   let bMaskInUse = !data.targetWindow.mask.isNull && data.targetWindow.maskEnabled && (data.targetWindow.maskMode == MaskMode_Default);
   let bMaskInverted = false;
   let IM = new Matrix(img.height, img.width);
   if (bMaskInUse)
   {
      bMaskInverted = data.targetWindow.maskInverted;
      IM = data.targetWindow.mask.mainView.image.toMatrix();
   }

   // Generate a Star Size mask
   if (data.StarRadius == 0) return false;   // Should never happen
   let ps = new PixelSearch(data.StarRadius);

   // Scan each pixel in B, if it == 1.0 then use M and R to extract values from H and S
   // to estimate the new value of that pixel postion in H and S and write.
   var startTime = new Date();
   console.writeln();
   console.writeln("Starting clean-up of H and Sv images");
   let totalBlownPixels = B.sum();     // Total number of blown pixels - works because pixels are either 1.0 or 0.0
   console.writeln("Total number of suspect pixels = ", totalBlownPixels);
   let pixelsProcessed = 0;
   // Can use totalBlownPixels to calculate % remaining for console output and also early termination of search of B for blown pixel positions
   let correctedPixels = 0;
   let percentComplete = 0;
   let lastPercentComplete = 0;
   let strPercent = new String("0%  ");
   let strErase = new String();
   strErase = String.fromCharCode(8) + String.fromCharCode(8) + String.fromCharCode(8) + String.fromCharCode(8);
   console.write("Processing suspect pixels: ", strPercent);
   console.flush();
   var bMoreData = false;
   bMoreData = Object(bMoreData);
   var coords, s, w, mv, phv, psv;
   let h = s = w = mv = phv = psv = 0.0;
   var phx, phy;
   var hxs, hys, ss, ws, ssvx, ssvy;   // Cumulative h x and y components, cumulative s and cumulative weighting
   var bDataCollectionStarted, bDataAtThisRadius;
   var successiveGoodData;
   var successiveNoData;
   let successiveGoodDataLimit = Math.round(data.StarRadius/3);
   if (successiveGoodDataLimit < 3) successiveGoodDataLimit = 3;
   var tr, tc;
   for (var row = 0; (row < B.rows) && (pixelsProcessed < totalBlownPixels); row++)
   {
      for (var col = 0; (col < B.cols) && (pixelsProcessed < totalBlownPixels); col++)
      {
         if (B.at(row, col) == 1)
         {
            ++pixelsProcessed;
            hxs = hys = ss = ws = ssvx = ssvy = 0.0;
            bDataCollectionStarted = false;
            bDataAtThisRadius = false;
            successiveGoodData = 0;
            successiveNoData = 0;
            // Use ps to generate new relative coordinates and weighting values
            // for successively increasing radii up to but not exceeding data.StarRadius
            // Convert relative coordinates to absolute coordinates
            // For each coordinate, if it is in bounds, then if the value in M is > 0.05, take the
            // value in each of H and S, multiply by the weighting, add the result to the
            // cumulative H and Sv repair values and add the weighting to the cumulative weighting
            // Note the added complication that Hue is an angle! See below
            // I also need to monitor the spread of sampled values in H and Sv. If the spread is too large (to be
            // determined what "too large" means) then that would signal an uncorrectable pixel.
            // Note that the nature of H and Sv mean that 0.0 is a perfectly valid value.
            // If three successive radii produce no output because values of M are <= 0.05
            // or data.StarRadius reached then repair values should be regarded as final.
            // The repair value for each of H and Sv will be the accumulated value divided by the accumulated weighting
            // If data is good repair H and Sv and set pixel in B to 0

            // Average of a set of angles. This should work because the angles should be bunched reasonably well
            // For angle "a" and weighting "w" compute (x, y) = (w*cos(a*2*pi), w*sin(a*2*pi)) (a runs from 0 to 1)
            // Keep a running total of the sum of the x's, y's and w's (which I'll call xs, ys, ws)
            // At the end calculate the new angle from atan2pi(ys/xs)/2 to get normalised angle running from 0 to 1
            // The quantity sqrt(ys*ys + xs*xs)/ws gives a measure of confidence in the robustness of the "average"
            // Ideally it should be close to 1.0. Small values, say less than 0.8, might be a reason to reject the new value

            for (var radius = 1; (radius <= data.StarRadius) && (successiveGoodData < successiveGoodDataLimit) && (successiveNoData < 3); ++radius)
            {  // The loop terminates if 'successiveGoodDataLimit' consecutive radii yield data or data collection
               // started but then three consecutive radii yielded no data or Star Size is reached
               bDataAtThisRadius = false;
               ps.startSearch(radius);
               do
               {
                  coords = ps.nextCoords(bMoreData);  // coords.x = row offset, coords.y = column offset, bMoreData set false if this is the last pixel
                  tr = coords.x;
                  tc = coords.y;
                  w = ps.at(tr, tc);      // Grab the weighting
                  tr += row;
                  tc += col;
                  if ((tr >= 0) && (tr < M.rows) && (tc >= 0) && (tc < M.cols))
                  {  // We are inside the image!
                     if (M.at(tr, tc) == 1)
                     {  // There is a pixel value to be sampled
                        h = H.at(tr, tc);
                        s = S.at(tr, tc);
                        hxs += Math.cos(h*Math._2PI)*w;
                        hys += Math.sin(h*Math._2PI)*w;
                        ss  += s*w;
                        ws  += w;
                        bDataCollectionStarted = true;
                        bDataAtThisRadius = true;
                     }
                  }
               }  while (bMoreData.valueOf());
               if (bDataAtThisRadius)
               {
                  successiveNoData = 0;
                  ++successiveGoodData;
               }
               else
               {
                  successiveGoodData = 0;
                  if (bDataCollectionStarted) ++successiveNoData;
               }
            }
            // At this point we have collected data if bDataCollectionStarted is true
            // If V correction attempted check out http://en.wikipedia.org/wiki/Lorentzian_function
            if (bDataCollectionStarted)
            {
               h = Math.atan2pi(hys, hxs)/Math._2PI;  // h is the new value of H
               w = Math.sqrt(hys*hys + hxs*hxs)/ws;   // w gives a confidence factor of how good the new h value is
               s = ss/ws;                             // s is the new value of S
               if (w >= 0.1)
               {  // This cutoff for w is arbitrary
                  if (bMaskInUse)
                  {  // Calculate a blend of old and new where less new is used as mask value tends towards 0
                     mv = IM.at(row, col);
                     if (bMaskInverted) mv = 1 - mv;
                     if (mv < 0.0) mv = 0.0;
                     if (mv > 1.0) mv = 1.0;
                     // Hue is an angle so blend unit vectors to calculate the new angle
                     phv = H.at(row, col);
                     phx = Math.cos(phv*Math._2PI);
                     hxs = Math.cos(h*Math._2PI);     // temporary reuse of variable hxs
                     hxs = hxs*mv + (1 - mv)*phx;
                     phy = Math.sin(phv*Math._2PI);
                     hys = Math.sin(h*Math._2PI);     // temporary reuse of variable hys
                     hys = hys*mv + (1 - mv)*phy;
                     h = Math.atan2pi(hys, hxs)/Math._2PI;
                     psv = S.at(row, col);
                     s = s*mv + (1 - mv)*psv
                  }
                  H.at(row, col, h);
                  S.at(row, col, s);
                  B.at(row, col, 0);
                  ++correctedPixels;
               }
            }

            percentComplete = Math.round(100*pixelsProcessed/totalBlownPixels);
            if ((percentComplete != lastPercentComplete) && (Math.mod(percentComplete, 5) == 0))
            {
               lastPercentComplete = percentComplete;
               var nbrPercent = new Number(percentComplete);
               strPercent = nbrPercent.toString();
               strPercent += "%";
               if (strPercent.length < 4) strPercent += " ";
               if (strPercent.length < 4) strPercent += " ";
               console.write(strErase, strPercent);
               console.flush();
            }
         }
      }
   }
   // Use PixelMath to create a new image which holds pixel values of V if pixel brighter than non-linear threshold
   // Use Deconvolution to peak it. Just 3 iterations and choose a radius equal to the Max Repair Radius
   // Use Convolution to soften it. Coose a radius equal to half the Max Repair Radius
   // Blend this new image with the original V separation
   let rpw = ResolveDuplicateNames("Cleaning_V_Image");
   let repairWindow = new ImageWindow (img.width, img.height, 1, img.bitsPerSample, img.sampleType == SampleType_Real, false, rpw);
   repairWindow.hide();
   let vwid =  ImageWindow.windowById(data.v_Name).mainView.id;
   // iif(vwid >= data.WhiteClips, vwid, 0)
   expr = "iif(" + vwid + " >= " + data.WhiteClips + ", " + vwid + ", 0)";
   with (pm)
   {
      expression = expr;
      useSingleExpression = true;
      newImageId = rpw;
      rescale = false;
      use64BitWorkingImage = true;
      createNewImage = false;
      executeOn(repairWindow.mainView, false);
   }
   let decon = new Deconvolution();
   with (decon)
   {
      psfMode = Parametric;
      useRegularization = true;
      psfMode = RichardsonLucy;
      psfGaussianSigma = Math.min(data.StarRadius/12.5, 10);
      psfShape = 2;
      psfGaussianAspectRatio = 1;
      numberOfIterations = 3;
      toLuminance = true;
      executeOn(repairWindow.mainView, false);
   }
   with (convolution)
   {
      mode = Parametric;
      sigma = Math.min(data.StarRadius/20, 10);
      shape = 2.0;
      aspectRatio = 1.0;
      rotationAngle = 0.0;
      executeOn(repairWindow.mainView, false);
   }

   if (bMaskInUse)
   {
      let maskID = data.targetWindow.mask.mainView.id;
      if (bMaskInverted)
      {  // vwid + max(0, repairWindow.mainView.id - data.WhiteClips/4)*(1 - maskID)
         expr = vwid + " + max(0, " + repairWindow.mainView.id + " - " + data.WhiteClips + "/4)*(1 - " + maskID + ")";
      }
      else
      {  // vwid + max(0, repairWindow.mainView.id - data.WhiteClips/4)*maskID
         expr = vwid + " + max(0, " + repairWindow.mainView.id + " - " + data.WhiteClips + "/4)*" + maskID;
      }
   }
   else
   {  // vwid + max(0, repairWindow.mainView.id - data.WhiteClips/4)
      expr = vwid + " + max(0, " + repairWindow.mainView.id + " - " + data.WhiteClips + "/4)";
   }

   with (pm)
   {
      expression = expr;
      useSingleExpression = true;
      newImageId = rpw;
      rescale = true;
      use64BitWorkingImage = true;
      createNewImage = false;
      executeOn(ImageWindow.windowById(data.v_Name).mainView, false);
   }
   repairWindow.forceClose();

   // It is now time to write the new H and S matrices into their respective images
   console.writeln();
   with (ImageWindow.windowById(data.h_Name).mainView)
   {
      beginProcess(UndoFlag_NoSwapFile);
      image.assign(H.toImage());
      endProcess();
   }
   with (ImageWindow.windowById(data.s_Name).mainView)
   {
      beginProcess(UndoFlag_NoSwapFile);
      image.assign(S.toImage());
      endProcess();
   }


   if (data.outputRGB)
   {
      let repairedRGB = new ImageWindow (1, 1, img.numberOfChannels, img.bitsPerSample, img.sampleType == SampleType_Real, img.isColor, data.r_Name);
      repairedRGB.mainView.beginProcess( UndoFlag_NoSwapFile );
      repairedRGB.mainView.image.assign(img);
      repairedRGB.mainView.endProcess();

      let cc = new ChannelCombination();
      with (cc)
      {
         colorSpace = HSV;
         channels = [[true, data.h_Name], [true, data.s_Name], [true, data.ov_Name]];       // Changed by BorisE
         executeOn(repairedRGB.mainView, false);
      }
      repairedRGB.zoomToOptimalFit();
      repairedRGB.show();
      
      // Added by BorisE - Close all intermediate images if Repaired RGB created
      ImageWindow.windowById(data.h_Name).forceClose();
      ImageWindow.windowById(data.s_Name).forceClose();
      ImageWindow.windowById(data.v_Name).forceClose();
      ImageWindow.windowById(data.ov_Name).forceClose();
   } else {
      // Change by BorisE: this images are discarded if outputRGB option selected 
      // Now restore the correct z order
      ImageWindow.windowById(data.h_Name).bringToFront();
      ImageWindow.windowById(data.s_Name).bringToFront();
      ImageWindow.windowById(data.v_Name).bringToFront();
   }


   console.writeln();
   console.writeln("Total number of 'unrepaired' pixels = ", totalBlownPixels - correctedPixels);
   var endTime = new Date();
   console.writeln((endTime.getTime() - startTime.getTime())/1000, " s");

   console.hide();
   return true;
}  // SeparateAndClean

//============================================================================================================================

function HSVSepDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   let emWidth = this.font.width( 'M' );
   let labelWidthMax = this.font.width( "Max Repair Radius: " );
   let editWidthMax = 14*this.font.width( '0' );
   let checkboxWidth = emWidth * 2;
   let minEditWidth = this.logicalPixelsToPhysical( 450 );


   // Helper function
   function trim( s )
   {
      return s.replace( /^\s*|\s*$/g, '' );
   }
   // Helper function
   function FileNameDuplicated(newName, cName1, cName2, cName3, cName4, doMB)
   { // returns true if newName is valid else executes a MessageBox (if doMB is true) and returns false
      if ((newName.length != 0) && ((newName == cName1) || (newName == cName2) || (newName == cName3) || (newName == cName4)))
      { // Error - file name already in use
        if (doMB)
        {
          let emMB = new MessageBox("File name '" + newName + "' already used", "Error", StdIcon_Error, StdButton_Ok);
          emMB.execute();
        }
        return true;
     }
     else
     {
        return false;
     }
   }
   // Helper function
   function formatPixelsString(pixels)
   {
      var str = new String;
      var nbr = new Number(100*pixels/pixelcount);
      str = pixels + ", %" + nbr.toFixed(6);
      return str;
   }


   this.help_Label = new Label( this );
   this.help_Label.frameStyle = FrameStyle_Box;
   this.help_Label.margin = 6;
   this.help_Label.wordWrapping = true;
   this.help_Label.useRichText = true;
   this.help_Label.text = "<p><b>" + TITLE + " v" + VERSION + "</b> &mdash; Converts a color source image into H, Sv and V " +
                          "separations and additionally can attempt to restore blown areas of the H and Sv images." +
                          "<p>Copyright &copy; 2013 Bob Andersson</p>" + 
                          "<p>Modified 2024 by BorisE</p>";

   // Add Target Image label and ViewList
   this.targetImage_Label = new Label( this );
   this.targetImage_Label.minWidth = labelWidthMax; // align with labels inside group boxes below
   this.targetImage_Label.useRichText = true;
   this.targetImage_Label.text = "The target image is: <b>" + data.targetView.id + "</b>";
   this.targetImage_Label.textAlignment = TextAlign_Left|TextAlign_VertCenter;

   // Add Buttons, Output Image Labels, Edit boxes and CheckBoxes.

    // usual control buttons
   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/images/icons/ok.png" );
   this.ok_Button.onClick = function()
   {
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/images/icons/cancel.png" );
   this.cancel_Button.onClick = function()
   {
      this.dialog.cancel();
   };

   this.h_Label = new Label( this );
   this.h_Label.minWidth = this.h_Label.maxWidth = labelWidthMax; // align with labels inside group boxes below
   this.h_Label.text = "Repaired H";
   this.h_Label.textAlignment = TextAlign_Left|TextAlign_VertCenter;
   this.h_Edit = new Edit( this );
   with (this.h_Edit)
   {
      onGetFocus = function()
      {
         if (trim( text ) == "<Auto>") text = "";
      };
      onLoseFocus = function()
      {
         let s = trim( text );
         if (FileNameDuplicated(s, data.s_Name, data.v_Name, data.ov_Name, data.r_Name, true))
         { // Error - file name already in use
           s = data.h_Name; // Could be empty or the previously entered name
         }
         if (s.length == 0) text = "<Auto>";
      };
      onEditCompleted = function()
      {
         onLoseFocus();
         data.h_Name = (text == "<Auto>") ? "" : text;
      };
      text = (data.h_Name.length == 0) ? "<Auto>" : data.h_Name;
      toolTip = "<p>Type the name of the new H separation. '_H' will be appended to the target image name if left at 'Auto'</p>";
   }


   this.s_Label = new Label( this );
   this.s_Label.minWidth = this.s_Label.maxWidth = labelWidthMax; // align with labels inside group boxes below
   this.s_Label.text = "Repaired Sv";
   this.s_Label.textAlignment = TextAlign_Left|TextAlign_VertCenter;
   this.s_Edit = new Edit( this );
   with (this.s_Edit)
   {
      onGetFocus = function()
      {
         if (trim( text ) == "<Auto>") text = "";
      };
      onLoseFocus = function()
      {
         let s = trim( text );
         if (FileNameDuplicated(s, data.h_Name, data.v_Name, data.ov_Name, data.r_Name, true))
         { // Error - file name already in use
           s = data.s_Name; // Could be empty or the previously entered name
         }
         if (s.length == 0) text = "<Auto>";
      };
      onEditCompleted = function()
      {
         onLoseFocus();
         data.s_Name = (text == "<Auto>") ? "" : text;
      };
      text = (data.s_Name.length == 0) ? "<Auto>" : data.s_Name;
      toolTip = "<p>Type the name of the new Sv separation. '_Sv' will be appended to the target image name if left at 'Auto'</p>";
   }


   this.v_Label = new Label( this );
   this.v_Label.minWidth = this.v_Label.maxWidth = labelWidthMax; // align with labels inside group boxes below
   this.v_Label.text = "Repaired V";
   this.v_Label.textAlignment = TextAlign_Left|TextAlign_VertCenter;
   this.v_Edit = new Edit( this );
   with (this.v_Edit)
   {
      onGetFocus = function()
      {
         if (trim( text ) == "<Auto>") text = "";
      };
      onLoseFocus = function()
      {
         let s = trim( text );
         if (FileNameDuplicated(s, data.h_Name, data.s_Name, data.ov_Name, data.r_Name, true))
         { // Error - file name already in use
           s = data.v_Name; // Could be empty or the previously entered name
         }
         if (s.length == 0) text = "<Auto>";
      };
      onEditCompleted = function()
      {
         onLoseFocus();
         data.v_Name = (text == "<Auto>") ? "" : text;
      };
      text = (data.v_Name.length == 0) ? "<Auto>" : data.v_Name;
      toolTip = "<p>Type the name of the new V separation. '_V' will be appended to the target image name if left at 'Auto'</p>";
   }

   this.ov_CheckBox = new CheckBox( this );
   with (this.ov_CheckBox)
   {
      width = checkboxWidth; // checkboxWidth will be used to set control positions
      checked = data.outputOrigV;
      text = ""
      toolTip = "<p>If checked the script will also output an 'unrepaired' V separation.</p>";
      onCheck = function() { data.outputOrigV = checked; };
      onRelease = function() { data.outputOrigV = checked; };
   }
   this.ov_Label = new Label( this );
   this.ov_Label.minWidth = this.ov_Label.maxWidth = labelWidthMax; // align with labels inside group boxes below
   this.ov_Label.text = "V - no repairs";
   this.ov_Label.textAlignment = TextAlign_Left|TextAlign_VertCenter;
   this.ov_Edit = new Edit( this );
   with (this.ov_Edit)
   {
      minWidth = minEditWidth;
      onGetFocus = function()
      {
         if (trim(text) == "<Auto>") text = "";
         data.outputOrigV = true;
         dialog.ov_CheckBox.checked = true;
      };
      onLoseFocus = function()
      {
         let s = trim(text);
         if (FileNameDuplicated(s, data.h_Name, data.s_Name, data.v_Name, data.r_Name, true))
         { // Error - file name already in use
           s = data.ov_Name; // Could be empty or the previously entered name
         }
         if (s.length == 0) text = "<Auto>";
      };
      onEditCompleted = function()
      {
         onLoseFocus();
         data.ov_Name = (text == "<Auto>") ? "" : text;
      };
      text = (data.ov_Name.length == 0) ? "<Auto>" : data.ov_Name;
      toolTip = "<p>Type the name of the new but unrepaired V separation. '_Unrepaired_V' will be appended to the target image name if left at 'Auto'</p>";
   }

   this.r_CheckBox = new CheckBox( this );
   with (this.r_CheckBox)
   {
      width = checkboxWidth; // checkboxWidth will be used to set control positions
      checked = data.outputRGB;
      toolTip = "<p>If checked the script will also output an RGB image reconsitituted from the repaired H, Sv and V separations.</p>";
      onCheck = function() { data.outputRGB  = checked; };
      onRelease = function() { data.outputRGB = checked; };
   }
   this.r_Label = new Label( this );
   this.r_Label.minWidth = this.r_Label.maxWidth = labelWidthMax; // align with labels inside group boxes below
   this.r_Label.text = "Repaired RGB";
   this.r_Label.textAlignment = TextAlign_Left|TextAlign_VertCenter;
   this.r_Edit = new Edit( this );
   with (this.r_Edit)
   {
      onGetFocus = function()
      {
         if (trim( text ) == "<Auto>") text = "";
         data.outputRGB = true;
         dialog.r_CheckBox.checked = true;
      };
      onLoseFocus = function()
      {
         let s = trim( text );
         if (FileNameDuplicated(s, data.h_Name, data.s_Name, data.v_Name, data.ov_Name, true))
         { // Error - file name already in use
           s = data.r_Name; // Could be empty or the previously entered name
         }
         if (s.length == 0) text = "<Auto>";
      };
      onEditCompleted = function()
      {
         onLoseFocus();
         data.r_Name = (text == "<Auto>") ? "" : text;
      };
      text = (data.r_Name.length == 0) ? "<Auto>" : data.r_Name;
      toolTip = "<p>Type the name of the 'repaired' RGB image. '_Repaired_RGB' will be appended to the target image name if left at 'Auto'</p>";
   }


   // Now add the Clip Blacks / Repair Highlights controls
   this.shadowsControl = new NumericControl( this );
   with (this.shadowsControl)
   {
      label.text = "Clip Shadows:";
      label.minWidth = labelWidthMax;
      label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      toolTip = "<p>Set the clipping level for the HSV separation and, optionally, the clipped output color image.</p>";
      setRange( 0, peakLevel/65535 );
      slider.setRange(0, 16777215);
      setPrecision( 10 );
      edit.setFixedWidth( editWidthMax );
      setValue (data.BlackClips);
      onValueUpdated = function( normalizedValue )
      {
         data.BlackClips = normalizedValue;
         var count_red = 0;
         var count_green = 0;
         var count_blue = 0;
         var histogramLevel = Math.round( data.BlackClips*65535 );
         var min = Math.max(0, Math.min(minLevel[0], minLevel[1], minLevel[2]) - 1);
         var max = Math.min(histogramLevel, Math.max(maxLevel[0], maxLevel[1], maxLevel[2]));
         for (var i = min; i < max; i++)
         {
            count_red += histogram[0][i];
            count_green += histogram[1][i];
            count_blue += histogram[2][i];
         }
         dialog.shadows_Readout.text = formatPixelsString(Math.max(count_red, count_green, count_blue));
      }
   }
   this.shadows_Readout = new Label( this );
   this.shadows_Readout.minWidth = this.shadows_Readout.maxWidth = labelWidthMax + editWidthMax;
   this.shadows_Readout.toolTip = "<p>Shows an estimate of the number of clipped dark pixels, both as number and a percentage, as set by the Shadows slider.</p>";
   this.shadows_Readout.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.shadows_Readout.readOnly = true;
   this.shadowsControl.onValueUpdated(data.BlackClips);


   this.highlightsControl = new NumericControl( this );
   with (this.highlightsControl)
   {
      label.text = "Repair level:";
      label.minWidth = labelWidthMax;
      label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      toolTip = "<p>Set the level above which the image data is assumed to be non-linear." +
                     " Pixels where this value is exceeded will be candidates for repair of the hue and saturation separations.</p>";
      setRange( peakLevel/65535, 1 );
      slider.setRange(0, 16777215);
      setPrecision( 10 );
      edit.setFixedWidth( editWidthMax );
      if (data.WhiteClips <= peakLevel/65535) data.WhiteClips = (1 + peakLevel/32767.5)/2;
      setValue (data.WhiteClips);
      onValueUpdated = function( normalizedValue )
      {
         data.WhiteClips = normalizedValue;
         var count_red = 0;
         var count_green = 0;
         var count_blue = 0;
         var histogramLevel = Math.round( data.WhiteClips*65535 );
         var min = Math.max(histogramLevel, Math.min(minLevel[0], minLevel[1], minLevel[2]));
         var max = Math.min(65535, Math.max(maxLevel[0], maxLevel[1], maxLevel[2]) + 1);
         for (var i = min; i < max; i++)
         {
            count_red += histogram[0][i];
            count_green += histogram[1][i];
            count_blue += histogram[2][i];
         }
         dialog.highlights_Readout.text = formatPixelsString(Math.max(count_red, count_green, count_blue));
      }
   }
   this.highlights_Readout = new Label( this );
   this.highlights_Readout.minWidth = this.shadows_Readout.maxWidth = labelWidthMax + editWidthMax;
   this.highlights_Readout.toolTip = "<p>Shows an estimate of the number of clipped light pixels, both as number and a percentage, as set by the Highlights slider</p>";
   this.highlights_Readout.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.highlights_Readout.readOnly = true;
   this.highlightsControl.onValueUpdated(data.WhiteClips);

   this.StarSizeControl = new NumericControl( this );
   with (this.StarSizeControl)
   {
      label.text = "Max Repair Radius:";
      label.minWidth = labelWidthMax;
      label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      toolTip = "<p>Sets the maximum radius (in pixels) over which data to repair 'blown' highlights in the H and Sv separations will be collected." +
                " Smaller values may be used if the script decides it has enough good data or it runs out of data as the search radius expands.</p>";
      setRange( 1, MAXRADIUS );
      slider.setRange(0, 16777215);
      setPrecision( 0 );
      edit.setFixedWidth( editWidthMax );
      setValue (data.StarRadius);
      onValueUpdated = function( normalizedValue )
      {
         data.StarRadius = Math.round(normalizedValue);
      }
   }


   // Reset button --------------------------------------------------------------------------------------
   this.ResetButton = new ToolButton(this);
   this.ResetButton.icon = this.scaledResource( ":/process-interface/reset.png" );
   this.ResetButton.toolTip = "Reset all values to defaults";
   this.ResetButton.onMousePress = function()
   {
      this.hasFocus = true;

      data.lastTargetID = window.mainView.id;

      data.outputOrigV = false;
      this.parent.ov_CheckBox.checked = false;
      this.parent.ov_CheckBox.update();
      data.outputRGB = false;
      this.parent.r_CheckBox.checked = false;
      this.parent.r_CheckBox.update();
      data.h_Name = "";
      this.parent.h_Edit.text = "";
      this.parent.h_Edit.onLoseFocus();
      data.s_Name = "";
      this.parent.s_Edit.text = "";
      this.parent.s_Edit.onLoseFocus();
      data.v_Name = "";
      this.parent.v_Edit.text = "";
      this.parent.v_Edit.onLoseFocus();
      data.ov_Name = "";
      this.parent.ov_Edit.text = "";
      this.parent.ov_Edit.onLoseFocus();
      data.r_Name = "";
      this.parent.r_Edit.text = "";
      this.parent.r_Edit.onLoseFocus();
      data.BlackClips = 0;
      this.parent.shadowsControl.setValue(0);
      this.parent.shadowsControl.onValueUpdated(0);
      data.WhiteClips = 0.5;
      this.parent.highlightsControl.setValue(0.5);
      this.parent.highlightsControl.onValueUpdated(0.5);
      data.StarRadius = 16;
      this.parent.StarSizeControl.setValue(16);
      this.parent.StarSizeControl.onValueUpdated(16);

      dp.erase();

      this.pushed = false;

   }

   // Now create and add Sizers in the required order

   this.targetImage_Sizer = new HorizontalSizer;
   this.targetImage_Sizer.add( this.targetImage_Label );

   this.h_name_Sizer = new HorizontalSizer;
   this.h_name_Sizer.spacing = 4;
   this.h_name_Sizer.addSpacing(checkboxWidth);
   this.h_name_Sizer.add(this.h_Label);
   this.h_name_Sizer.add(this.h_Edit);

   this.s_name_Sizer = new HorizontalSizer;
   this.s_name_Sizer.spacing = 4;
   this.s_name_Sizer.addSpacing(checkboxWidth);
   this.s_name_Sizer.add(this.s_Label);
   this.s_name_Sizer.add(this.s_Edit);

   this.v_name_Sizer = new HorizontalSizer;
   this.v_name_Sizer.spacing = 4;
   this.v_name_Sizer.addSpacing(checkboxWidth);
   this.v_name_Sizer.add(this.v_Label);
   this.v_name_Sizer.add(this.v_Edit);

   this.ov_name_Sizer = new HorizontalSizer;
   this.ov_name_Sizer.spacing = 4;
   this.ov_name_Sizer.add(this.ov_CheckBox);
   this.ov_name_Sizer.add(this.ov_Label);
   this.ov_name_Sizer.add(this.ov_Edit);

   this.r_name_Sizer = new HorizontalSizer;
   this.r_name_Sizer.spacing = 4;
   this.r_name_Sizer.add(this.r_CheckBox);
   this.r_name_Sizer.add(this.r_Label);
   this.r_name_Sizer.add(this.r_Edit);

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 4;
   this.buttons_Sizer.add( this.ResetButton );
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.ok_Button );
   this.buttons_Sizer.add( this.cancel_Button );

   this.oiGroupBox = new GroupBox( this );
   this.oiGroupBox.title = "Output Images / Names";
   this.oiGroupBox.sizer = new VerticalSizer;
   this.oiGroupBox.sizer.margin = 4;
   this.oiGroupBox.sizer.spacing = 4;
   this.oiGroupBox.sizer.add( this.h_name_Sizer );
   this.oiGroupBox.sizer.add( this.s_name_Sizer );
   this.oiGroupBox.sizer.add( this.v_name_Sizer );
   this.oiGroupBox.sizer.add( this.ov_name_Sizer );
   this.oiGroupBox.sizer.add( this.r_name_Sizer );

   this.cbGroupBox = new GroupBox( this );
   this.cbGroupBox.title = "Clip Blacks / Repair Highlights";
   this.cbGroupBox.sizer = new VerticalSizer;
   this.cbGroupBox.sizer.margin = 4;
   this.cbGroupBox.sizer.spacing = 4;
   this.cbGroupBox.sizer.add(this.shadowsControl);
   this.cbGroupBox.sizer.add(this.shadows_Readout, 100, Align_Left);
   this.cbGroupBox.sizer.addSpacing(10);
   this.cbGroupBox.sizer.add(this.highlightsControl);
   this.cbGroupBox.sizer.add(this.highlights_Readout, 100, Align_Left);
   this.cbGroupBox.sizer.addSpacing(10);
   this.cbGroupBox.sizer.add(this.StarSizeControl);

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.add( this.help_Label );
   this.sizer.addSpacing( 10 );
   this.sizer.add( this.targetImage_Sizer );
   this.sizer.addSpacing( 10 );
   this.sizer.add( this.oiGroupBox );

   this.sizer.addSpacing( 10 );
   this.sizer.add( this.cbGroupBox );

   this.sizer.addSpacing( 4 );
   this.sizer.add( this.buttons_Sizer );

   this.windowTitle = TITLE;
   this.adjustToContents();
   this.setMinSize();
   this.userResizable = false;

}

HSVSepDialog.prototype = new Dialog;

//============================================================================================================================

function initialiseHistogram()
{ // var h = new Histogram (); var histogram = new Array(); var minLevel = new Array(); var maxLevel = new Array();
   channels = data.targetView.image.numberOfChannels;
   peakLevel = 0.0;
   for (var c=0; c < channels; c++)
   {
      data.targetView.image.selectedChannel = c;
      h.resolution = 65536;
      h.generate(data.targetView.image);
      histogram[c] = h.toArray();
      minLevel[c] = 0;
      for (var i=0; i < 65536; i++)
      {
         if (histogram[c][i] !=0) { minLevel[c] = i; break; }
      }
      maxLevel[c] = 65535;
      for (var i=65535; i > -1 ; i--)
      {
         if (histogram[c][i] !=0) { maxLevel[c] = i; break; }
      }
      peakLevel += h.peakLevel;
   }
   if (channels > 1) peakLevel /= channels;  // Go for the average value
   if (peakLevel == 0.0) peakLevel = 0.5;    // Belt and braces catch all
}

//============================================================================================================================

function main()
{
   if ( window.isNull || !window.mainView.image.isColor)
   {
      let emMB = new MessageBox("The script needs a color image window to be open and active.", "Error", StdIcon_Error, StdButton_Ok);
      emMB.execute();
      console.writeln( TITLE + " aborted as there is no active color image window." );
   }
   else
   {
      console.hide();
      console.writeln("Working on image: <b>" + window.mainView.id + "</b>");
      dp.load();
      console.writeln("Initialising histogram data");
      initialiseHistogram();
      var dlg = new HSVSepDialog();
      console.writeln("Collecting manual inputs");
      if (dlg.execute() && SeparateAndClean())
      {  // then OK button clicked and SeparateAndClean completed without error
         dp.save();
         console.writeln();
         console.writeln(TITLE + " completed.");
      }
      else
      {
         console.writeln();
         console.writeln(TITLE + " aborted.");
      }
   }
   console.writeln();
}


main();        // Script entry point
