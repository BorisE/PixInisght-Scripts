// ----------------------------------------------------------------------------
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ----------------------------------------------------------------------------
// ColorMask.js - Released 2017-07-07T12:11:59Z
// ----------------------------------------------------------------------------
//
// This file is part of ColorMask Script version 1.0
//
// Copyright (C) 2015-2017 Rick Stevenson. All rights reserved.
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. Neither the names "PixInsight" and "Pleiades Astrophoto", nor the names
//    of their contributors, may be used to endorse or promote products derived
//    from this software without specific prior written permission. For written
//    permission, please contact info@pixinsight.com.
//
// 4. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product:
//
//    "This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (http://pixinsight.com/)."
//
//    Alternatively, if that is where third-party acknowledgments normally
//    appear, this acknowledgment must be reproduced in the product itself.
//
// THIS SOFTWARE IS PROVIDED BY PLEIADES ASTROPHOTO AND ITS CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PLEIADES ASTROPHOTO OR ITS
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, BUSINESS
// INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS OF USE,
// DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ----------------------------------------------------------------------------

/*
 * ColorMask v1.4
 *
 * Build a mask to select a color range in an image.
 *
 * Copyright (C) 2015-2017 Rick Stevenson (rsj.stevenson@gmail.com). All rights reserved.
 *
 * 1.4 [2023/02/11] new setting: hue range step (can select 30-60-90-120)
					color buttons
 * 1.3 [2023/02/10] hue changed to hue from HSV color space
					hue interval changed to 60 deg (instead of 120)
					buttons rearranged
					minor design changes
 * 1.2 [2020/06/14] luminance & chrominance filter
 * 1.1 [2020/06/12] saving settings
 */

#feature-id    Utilities2 > ColorMask

#feature-info  A script that creates a mask selecting a specified color range

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/Color.jsh>

#define VERSION   "1.4"
#define TITLE     "ColorMask"

#define DEBUG     true
#define SETTINGS_KEY_BASE "ColorMask/"

// Predefined hue ranges.
#define MIN_RED         330
#define MAX_RED         30

#define MIN_YELLOW      30
#define MAX_YELLOW      90

#define MIN_GREEN       90
#define MAX_GREEN       150

#define MIN_CYAN        150
#define MAX_CYAN        210

#define MIN_BLUE        210
#define MAX_BLUE        270

#define MIN_MAGENTA     270
#define MAX_MAGENTA     330

// Default step 60 deg (i.e. red is in 330..30 range)
// But for wide step it is 90 deg (i.e. red is in 315..45 range), so we should adjust default by 15 deg
// But for low step it is 30 deg (i.e. red is in 345..15 range), so we should adjust default by -15 deg
#define HUE_STEP_WIDE_ADJ 	15
#define HUE_STEP_LOW_ADJ 	-15
#define HUE_STEP_ULTRAWIDE_ADJ 	30


#define DEFAULT_STRENGTH   1.0

// Mask types
#define MASK_CHROMINANCE   0
#define MASK_LIGHTNESS     1
#define MASK_LINEAR        2

// Mask name suffix
#define CM_SUFF         "_cm"

/*
 * Create color mask for specified image.
 * name is used to generate a unique name for the result.
 */
function ColorMask(image, name) {
   if (DEBUG) {
      console.writeln("ColorMask: ", name);
      console.writeln("Minpoint: ", format("%6.3f", data.minHue));
      console.writeln("Maxpoint: ", format("%6.3f", data.maxHue));
      console.writeln("Lum filter min: ", format("%6.3f", data.minLum));
      console.writeln("Lum filter max: ", format("%6.3f", data.maxLum));
      console.writeln("Chrom filter min: ", format("%6.3f", data.minChrom));
      console.writeln("Chrom filter max: ", format("%6.3f", data.maxChrom));
      console.writeln("Mask type: ", format("%d", data.maskType));
      console.writeln("Mask strength: ", format("%4.3f", data.maskStrength));
      console.writeln("Mask suffix: ", data.maskSuff);
      console.writeln("Default Hue Range: ", data.defaultHueRange);
	  
   }

   // Pick an unused name for the mask
   var MaskName = null;
   if (ImageWindow.windowById(name + CM_SUFF + data.maskSuff).isNull)
      MaskName = name + CM_SUFF + data.maskSuff;
   else {
      for (var n = 1 ; n <= 99 ; n++) {
         if (ImageWindow.windowById(name + CM_SUFF + data.maskSuff + n).isNull) {
            MaskName = name + CM_SUFF + data.maskSuff + n;
            break;
         }
      }
   }
   if (MaskName == null) {
         (new MessageBox("Couldn't find a unique mask name. Bailing out.",
               TITLE, StdIcon_Error, StdButton_Ok)).execute();
         return;
   }

   // Build an ugly PixelMath expression to build the mask
   var PM = new PixelMath;

   var min = data.minHue/360;
   var max = data.maxHue/360;
   var mtfBal = 1 - data.maskStrength;

   var mid;
   var ldist;
   var rdist;
   var maskMod;

   switch (data.maskType) {
      case MASK_CHROMINANCE:
         maskMod = "*CIEc($T)";
         break;
      case MASK_LIGHTNESS:
         maskMod = "*CIEL($T)";
         break;
      case MASK_LINEAR:
         maskMod = "";
         break;
   }

   //Luminance filter
   var lumFilter = "*iif(CIEL($T)>=" + data.minLum + " && CIEL($T)<= " + data.maxLum + " ,1 ,0)";
   //Chrominance filter
   var chromFilter = "*iif(CIEc($T)>=" + data.minChrom + " && CIEc($T)<= " + data.maxChrom + " ,1 ,0)";
   

   if (min < max) {
      // Range: 0..min..mid..max..1
      if (DEBUG)
         console.writeln("Range: 0..min..mid..max..1");
      mid = (min + max)/2;
      ldist = mid-min;
      rdist = max-mid;
      PM.expression = "iif(H($T)<"  + min + ",0," +
                      "iif(H($T)<=" + mid + ",~mtf((H($T)-" + min + ")/" + ldist + "," + mtfBal + ")" + maskMod + "," +
                      "iif(H($T)<=" + max + ",~mtf((" + max + "-H($T))/" + rdist + "," + mtfBal + ")" + maskMod + ",0)))";
   } else {
         mid = (min + max+1)/2;
         if (mid < 1) {
            // Range: 0..max..min..mid..1
            if (DEBUG)
				console.writeln("Range: 0..max..min..mid..1");
            ldist = mid - min;
            rdist = max + 1 - mid;
            PM.expression = "iif(H($T)<=" + max + ",~mtf((" + max + "-H($T))/" + rdist + "," + mtfBal + ")" + maskMod + "," +
                            "iif(H($T)<"  + min + ",0," +
                            "iif(H($T)<=" + mid + ",~mtf((H($T)-" + min + ")/" + ldist + "," + mtfBal + ")" + maskMod + "," +
                                "~mtf((1+" + max + "-H($T))/" + rdist + "," + mtfBal + ")" + maskMod + ")))";
         } else {
            mid = mid - 1;
            // Range: 0..mid..max..min..1
            if (DEBUG)
               console.writeln("Range: 0..mid..max..min..1");
            ldist = mid + 1 - min;
            rdist = max - mid;
            PM.expression = "iif(H($T)<=" + mid + ",~mtf((H($T)+1-" + min + ")/" + ldist + "," + mtfBal + ")" + maskMod + "," +
                            "iif(H($T)<=" + max + ",~mtf((" + max + "-H($T))/" + rdist + "," + mtfBal + ")" + maskMod + "," +
                            "iif(H($T)<"  + min + ",0,~mtf((" + "H($T)-" + min + ")/" + ldist + "," + mtfBal + ")" + maskMod + ")))";
         }
   }

   PM.expression += lumFilter;
   PM.expression += chromFilter;
      
   PM.expression1 = "";
   PM.expression2 = "";
   PM.expression3 = "";
   PM.useSingleExpression = true;
   PM.symbols = "StartHue=" + data.minHue + ", EndHue=" + data.maxHue;
   PM.generateOutput = true;
   PM.singleThreaded = false;
   PM.use64BitWorkingImage = false;
   PM.rescale = true;
   PM.rescaleLower = 0;
   PM.rescaleUpper = 1;
   PM.truncate = true;
   PM.truncateLower = 0;
   PM.truncateUpper = 1;
   PM.createNewImage = true;
   PM.showNewImage = true;
   PM.newImageId = MaskName;
   PM.newImageWidth = image.width;
   PM.newImageHeight = image.height;
   PM.newImageAlpha = false;
   PM.newImageColorSpace = PixelMath.prototype.Gray;
   PM.newImageSampleFormat = PixelMath.prototype.f32;
   PM.executeOn(data.targetView, false /*swapFile */);

   if (data.blurLayers > 0) {
      // Apply a blur to mask using MLT
      var MLT = new MultiscaleLinearTransform;

      var layers = new Array(data.blurLayers + 1);
      for (var n = 0 ; n < data.blurLayers ; n++)
         layers[n] = [false, true, 0.000, false, 3.000, 1.00, 1];
      layers[n] = [true, true, 0.000, false, 3.000, 1.00, 1];
      MLT.layers = layers;

      MLT.transform = MultiscaleLinearTransform.prototype.StarletTransform;
      MLT.scaleDelta = 0;
      MLT.scalingFunctionData = [
         0.25,0.5,0.25,
         0.5,1,0.5,
         0.25,0.5,0.25
      ];
      MLT.scalingFunctionRowFilter = [
       0.5,
       1,
       0.5
      ];
      MLT.scalingFunctionColFilter = [
       0.5,
       1,
       0.5
      ];
      MLT.scalingFunctionNoiseSigma = [
         0.8003,0.2729,0.1198,
         0.0578,0.0287,0.0143,
         0.0072,0.0036,0.0019,
         0.001
      ];
      MLT.scalingFunctionName = "Linear Interpolation (3)";
      MLT.linearMask = false;
      MLT.linearMaskAmpFactor = 100;
      MLT.linearMaskSmoothness = 1.00;
      MLT.linearMaskInverted = true;
      MLT.linearMaskPreview = false;
      MLT.largeScaleFunction = MultiscaleLinearTransform.prototype.NoFunction;
      MLT.curveBreakPoint = 0.75;
      MLT.noiseThresholding = false;
      MLT.noiseThresholdingAmount = 1.00;
      MLT.noiseThreshold = 3.00;
      MLT.softThresholding = true;
      MLT.useMultiresolutionSupport = false;
      MLT.deringing = false;
      MLT.deringingDark = 0.1000;
      MLT.deringingBright = 0.0000;
      MLT.outputDeringingMaps = false;
      MLT.lowRange = 0.0000;
      MLT.highRange = 0.0000;
      MLT.previewMode = MultiscaleLinearTransform.prototype.Disabled;
      MLT.previewLayer = 0;
      MLT.toLuminance = true;
      MLT.toChrominance = true;
      MLT.linear = false;

      MLT.executeOn(ImageWindow.windowById(MaskName).mainView, false /*swapFile */);
   }
}

/*
 * The ColorMaskData object defines functional parameters for the
 * ColorMask routine.
 */
function ColorMaskData() {
   // Get access to the active image window
   var window = ImageWindow.activeWindow;

   if (!window.isNull)
      this.targetView = window.currentView;
   this.minHue = 0.0;
   this.minHue_control = null;
   this.maxHue = 0.0;
   this.maxHue_control = null;
   this.minLum = 0.0;
   this.minLum_control = null;
   this.maxLum = 0.0;
   this.maxLum_control = null;
   this.minChrom = 0.0;
   this.minChrom_control = null;
   this.maxChrom = 0.0;
   this.maxChrom_control = null;
   this.maskType = MASK_CHROMINANCE;
   this.maskStrength = DEFAULT_STRENGTH;
   this.maskStrength_control = null;
   this.blurLayers = 0;
   this.maskSuff = "";
   this.defaultHueRange = 1;
}

// Global parameters.
var data = new ColorMaskData;

/*
 * Save parameters in process icon.
 */
function exportParameters() {
   Parameters.set("minHue", data.minHue);
   Parameters.set("maxHue", data.maxHue);
   Parameters.set("minLum", data.minLum);
   Parameters.set("maxLum", data.maxLum);
   Parameters.set("minChrom", data.minChrom);
   Parameters.set("maxChrom", data.maxChrom);
   Parameters.set("maskType", data.maskType);
   Parameters.set("maskStrength", data.maskStrength);
   Parameters.set("blurLayers", data.blurLayers);
   Parameters.set("blurLayers", data.defaultHueRange);
}

/*
 * Restore saved parameters.
 */
function importParameters() {
   if(Parameters.has("minHue"))
      data.minHue = Parameters.getReal("minHue");
   if(Parameters.has("maxHue"))
      data.maxHue = Parameters.getReal("maxHue");
   if(Parameters.has("minLum"))
      data.minLum = Parameters.getReal("minLum");
   if(Parameters.has("maxLum"))
      data.maxLum = Parameters.getReal("maxLum");
   if(Parameters.has("minChrom"))
      data.minChrom = Parameters.getReal("minChrom");
   if(Parameters.has("maxChrom"))
      data.maxChrom = Parameters.getReal("maxChrom");
   if (Parameters.has("maskType"))
      data.maskType = Parameters.getInteger("maskType");
   if(Parameters.has("maskStrength"))
      data.maskStrength = Parameters.getReal("maskStrength");
   if(Parameters.has("blurLayers"))
      data.blurLayers = Parameters.getInteger("blurLayers");
   if(Parameters.has("defaultHueRange"))
      data.defaultHueRange = Parameters.getInteger("defaultHueRange");
}


//Helper functions
function load(key, type) {
	return Settings.read(SETTINGS_KEY_BASE + key, type);
}
function loadIndexed(key, index, type) {
	return load(key + '_' + index.toString(), type);
}
function save(key, type, value) {
	Settings.write(SETTINGS_KEY_BASE + key, type, value);
}
function saveIndexed(key, index, type, value) {
	save(key + '_' + index.toString(), type, value);
}

/*
 * Load / Save from Settings Storage
 */
function loadSettings () {
	var o;
	if ((o = load("minHue", DataType_Float)) != null)
		data.minHue = o;
	if ((o = load("maxHue", DataType_Float)) != null)
		data.maxHue = o;
	if ((o = load("minLum", DataType_Float)) != null)
		data.minLum = o;
	if ((o = load("maxLum", DataType_Float)) != null)
		data.maxLum = o;
	if ((o = load("minChrom", DataType_Float)) != null)
		data.minChrom = o;
	if ((o = load("maxChrom", DataType_Float)) != null)
		data.maxChrom = o;
	if ((o = load("maskType", DataType_Int16)) != null)
		data.maskType = o;
	if ((o = load("maskStrength", DataType_Float)) != null)
		data.maskStrength = o;
	if ((o = load("blurLayers", DataType_Int16)) != null)
		data.blurLayers = o;
	if ((o = load("defaultHueRange", DataType_Int16)) != null)
		data.defaultHueRange = o;

}

function saveSettings () {
	save("minHue", DataType_Float, data.minHue);
	save("maxHue", DataType_Float, data.maxHue);
	save("minLum", DataType_Float, data.minLum);
	save("maxLum", DataType_Float, data.maxLum);
	save("minChrom", DataType_Float, data.minChrom);
	save("maxChrom", DataType_Float, data.maxChrom);
	save("maskType", DataType_Int16, data.maskType);
	save("maskStrength", DataType_Float, data.maskStrength);
	save("blurLayers", DataType_Int16, data.blurLayers);
	save("defaultHueRange", DataType_Int16, data.defaultHueRange);

	if (DEBUG) {
		console.writeln("\n<b>Settings saved:</b>");
		this.printParameters();
		console.writeln("\n");
	};
}

function printParameters () {
	console.writeln("minHue:		" + data.minHue);
	console.writeln("maxHue:		" + data.maxHue);
	console.writeln("minLum:		" + data.minLum);
	console.writeln("maxLum:		" + data.maxLum);
	console.writeln("minChrom:		" + data.minChrom);
	console.writeln("maxChrom:		" + data.maxChrom);
	console.writeln("maskType:		" + data.maskType);
	console.writeln("maskStrength:	" + data.maskStrength);
	console.writeln("blurLayers:	" + data.blurLayers);
	console.writeln("defaultHueRange:" + data.defaultHueRange);
	
}

/*
 * Set up a canned color range.
 */
function SetCannedRange(min, max, suff, hueStep) {
   data.minHue = min - (hueStep == 0 ? HUE_STEP_ULTRAWIDE_ADJ: (hueStep == 1 ? HUE_STEP_WIDE_ADJ : (hueStep == 3 ?  HUE_STEP_LOW_ADJ : 0 ) ) );
   data.minHue_control.setValue(data.minHue);
   data.maxHue = max + (hueStep == 0 ? HUE_STEP_ULTRAWIDE_ADJ: (hueStep == 1 ? HUE_STEP_WIDE_ADJ : (hueStep == 3 ?  HUE_STEP_LOW_ADJ : 0 ) ) );
   data.maxHue_control.setValue(data.maxHue);
   data.maskSuff = suff;
}

/*
 * ColorMaskDialog is the GUI that collects the user parameters.
 */
function ColorMaskDialog() {
   this.__base__ = Dialog;
   this.__base__();

   var labelMinWidth = Math.round(this.font.width("Start hue:") + 2.0 * this.font.width('M'));
   var sliderMaxValue = 360;
   var sliderMinWidth = 256;

   this.helpLabel = new Label(this);
   this.helpLabel.frameStyle = FrameStyle_Box;
   this.helpLabel.margin = 4;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<b>" + TITLE + " v" + VERSION + "</b> &mdash; This script builds a mask " +
                         "selecting a range of colors from a target image.</p>" +
                         "<p>The mask type can be <b>Chrominance</b> (more saturated colors are selected more strongly), " +
                         "<b>Lightness</b> (brighter areas are selected more strongly) or <b>Linear</b> " +
                         "(selection is only based on distance from the center of the color range)." +
                         "<p>The <b>Mask Strength</b> slider controls how strongly hues away from the midpoint of the " +
                         "selected range are included in the mask." +
                         "<p><b>Mask Blur</b> provides the option to blur the mask by removing the specified " +
                         "number of small scale wavelet layers with MultiscaleLinearTransform." +
                         "<p>Copyright &copy; 2015-2017 Rick Stevenson. All rights reserved.<br>" +
                         "Some enhancement made by Boris Emchenko 2020-2023.</p>" +
						 "<p><br><a href=https://miro.medium.com/v2/resize:fit:4800/format:webp/1*rHwnCLd1NhMeBEDY-93gAA.png>Color wheel link (right-click and copy to browser)</a>" +
						 "</p>";

						 
   this.targetImage_Sizer = new HorizontalSizer;
   this.targetImage_Sizer.spacing = 4;

   this.targetImage_Label = new Label(this);
   this.targetImage_Label.text = "Target image: ";
   this.targetImage_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.targetImage_ViewList = new ViewList(this);
   this.targetImage_ViewList.minWidth = 360;
   this.targetImage_ViewList.getAll(); // include main views as well as previews
   this.targetImage_ViewList.currentView = data.targetView;
   this.targetImage_ViewList.toolTip = this.targetImage_Label.toolTip = "Select the image that will be used to generate the mask.";

   this.targetImage_ViewList.onViewSelected = function(view) {
      data.targetView = view;
   };

   this.targetImage_Sizer.add(this.targetImage_Label);
   this.targetImage_Sizer.add(this.targetImage_ViewList, 100);

   this.hueParams_Sizer = new VerticalSizer;

   this.hueParams_Sizer.margin = 6;
   this.hueParams_Sizer.spacing = 4;

   this.minHue = new NumericControl(this);
   data.minHue_control = this.minHue;

   this.minHue.label.text = "Start Hue:";
   this.minHue.label.minWidth = labelMinWidth;
   this.minHue.slider.setRange(0, sliderMaxValue);
   this.minHue.slider.minWidth = sliderMinWidth;
   this.minHue.setRange(0.0, 360.0);
   this.minHue.setPrecision(4);
   this.minHue.setValue(data.minHue);
   this.minHue.onValueUpdated = function(value) { data.minHue = value; data.maskSuff = ""; }
   this.minHue.toolTip =
      "<p>Start of the color range specified as a Hue value between 0 and 360 degrees.</p>";

   this.hueParams_Sizer.add(this.minHue);

   this.maxHue = new NumericControl(this);
   data.maxHue_control = this.maxHue;

   this.maxHue.label.text = "End Hue:";
   this.maxHue.label.minWidth = labelMinWidth;
   this.maxHue.slider.setRange(0, sliderMaxValue);
   this.maxHue.slider.minWidth = sliderMinWidth;
   this.maxHue.setRange(0.0, 360.0);
   this.maxHue.setPrecision(4);
   this.maxHue.setValue(data.maxHue);
   this.maxHue.onValueUpdated = function(value) { data.maxHue = value; data.maskSuff = ""; }
   this.maxHue.toolTip =
      "<p>End of the color range specified as a Hue value between 0 and 360 degrees.</p>";

   this.hueParams_Sizer.add(this.maxHue);

   this.red_Button = new PushButton(this);
   //this.red_Button.buttonColor = 0xFFFF0000;
   //this.red_Button.buttonTextColor = 0xFFFFA500;
   //this.red_Button.canvasColor = 0xFFFFB6C1;
   this.red_Button.backgroundColor = 0xFFFF0000; 	// bg color
   //this.red_Button.textColor = 0xFFFFFF00; 			//text color
   this.red_Button.text = "Red [0]";
   this.red_Button.onClick = function() {
      SetCannedRange(MIN_RED, MAX_RED, "R", data.defaultHueRange);
   };
   this.red_Button.toolTip =
      "<p>Set parameters to select red hues.</p>";

   this.green_Button = new PushButton(this);
   this.green_Button.text = "Green [120]";
   this.green_Button.backgroundColor = 0xFF00FF00; 	// bg color
   this.green_Button.onClick = function() {
      SetCannedRange(MIN_GREEN, MAX_GREEN, "G", data.defaultHueRange);
   };
   this.green_Button.toolTip =
      "<p>Set parameters to select green hues.</p>";

   this.blue_Button = new PushButton(this);
   this.blue_Button.text = "Blue [240]";
   this.blue_Button.backgroundColor = 0xFF0000FF; 	// bg color
   this.blue_Button.onClick = function() {
      SetCannedRange(MIN_BLUE, MAX_BLUE, "B", data.defaultHueRange);
   };
   this.blue_Button.toolTip =
      "<p>Set parameters to select blue hues.</p>";

   this.cyan_Button = new PushButton(this);
   this.cyan_Button.text = "Cyan [180]";
   this.cyan_Button.backgroundColor = 0xFF00FFFF; 	// bg color
   this.cyan_Button.onClick = function() {
      SetCannedRange(MIN_CYAN, MAX_CYAN, "C", data.defaultHueRange);
   };
   this.cyan_Button.toolTip =
      "<p>Set parameters to select cyan hues.</p>";

   this.magenta_Button = new PushButton(this);
   this.magenta_Button.text = "Magenta [270]";
   this.magenta_Button.backgroundColor = 0xFFFF00FF; 	// bg color
   this.magenta_Button.onClick = function() {
      SetCannedRange(MIN_MAGENTA, MAX_MAGENTA, "M", data.defaultHueRange);
   };
   this.magenta_Button.toolTip =
      "<p>Set parameters to select magenta hues.</p>";

   this.yellow_Button = new PushButton(this);
   this.yellow_Button.text = "Yellow [60]";
   this.yellow_Button.backgroundColor = 0xFFFFFF00; 	// bg color
   
   this.yellow_Button.onClick = function() {
      SetCannedRange(MIN_YELLOW, MAX_YELLOW, "Y", data.defaultHueRange);
   };
   this.yellow_Button.toolTip =
      "<p>Set parameters to select yellow hues.</p>";


   this.RGB_ButtonPane = new HorizontalSizer;
   this.RGB_ButtonPane.spacing = 6;
   this.RGB_ButtonPane.add(this.red_Button);
   this.RGB_ButtonPane.add(this.yellow_Button);
   this.RGB_ButtonPane.add(this.green_Button);
   this.hueParams_Sizer.add(this.RGB_ButtonPane);

   this.CMY_ButtonPane = new HorizontalSizer;
   this.CMY_ButtonPane.spacing = 6;
   this.CMY_ButtonPane.add(this.cyan_Button);
   this.CMY_ButtonPane.add(this.blue_Button);
   this.CMY_ButtonPane.add(this.magenta_Button);
   this.hueParams_Sizer.add(this.CMY_ButtonPane);


   this.hueStep_Label = new Label(this);
   this.hueStep_Label.text = "Hue presets range step";
   this.hueStep_Label.minWidth = labelMinWidth;

   this.hueStep_ComboBox = new ComboBox( this );
   this.hueStep_ComboBox.editEnabled = true;
   this.hueStep_ComboBox.addItem( "UltraWide - 120deg" );
   this.hueStep_ComboBox.addItem( "Wide - 90deg" );
   this.hueStep_ComboBox.addItem( "*Default - 60deg*" );
   this.hueStep_ComboBox.addItem( "Low - 30deg" );
   this.hueStep_ComboBox.currentItem = data.defaultHueRange;
   this.hueStep_ComboBox.onItemSelected = function()
   {
      data.defaultHueRange = this.dialog.hueStep_ComboBox.currentItem;
   };


   this.AdditionalParameters_ButtonPane = new HorizontalSizer;
   this.AdditionalParameters_ButtonPane.spacing = 6;
   
   this.AdditionalParameters_ButtonPane.add(this.hueStep_Label);
   this.AdditionalParameters_ButtonPane.add(this.hueStep_ComboBox);
   this.hueParams_Sizer.add(this.AdditionalParameters_ButtonPane);



   this.lumParams_Sizer = new VerticalSizer;

   this.lumParams_Sizer.margin = 6;
   this.lumParams_Sizer.spacing = 4;

   this.minLum = new NumericControl(this);
   data.minLum_control = this.minLum;

   this.minLum.label.text = "Min Luminance value:";
   this.minLum.label.minWidth = labelMinWidth;
   this.minLum.slider.setRange(0, 1000);
   this.minLum.slider.minWidth = sliderMinWidth;
   this.minLum.setRange(0.0, 1.0);
   this.minLum.setPrecision(4);
   this.minLum.setValue(data.minLum);
   this.minLum.onValueUpdated = function(value) { data.minLum = value; data.maskSuff = ""; }
   this.minLum.toolTip =
      "<p>Min luminance value to include in mask.</p>";

   this.lumParams_Sizer.add(this.minLum);

   this.maxLum = new NumericControl(this);
   data.maxLum_control = this.maxLum;

   this.maxLum.label.text = "Max Luminance value:";
   this.maxLum.label.minWidth = labelMinWidth;
   this.maxLum.slider.setRange(0, 1000);
   this.maxLum.slider.minWidth = sliderMinWidth;
   this.maxLum.setRange(0.0, 1.0);
   this.maxLum.setPrecision(4);
   this.maxLum.setValue(data.maxLum);
   this.maxLum.onValueUpdated = function(value) { data.maxLum = value; data.maskSuff = ""; }
   this.maxLum.toolTip =
      "<p>Max luminance value to include in mask.</p>";

   this.lumParams_Sizer.add(this.maxLum);


   

   this.chromParams_Sizer = new VerticalSizer;

   this.chromParams_Sizer.margin = 6;
   this.chromParams_Sizer.spacing = 4;

   this.minChrom = new NumericControl(this);
   data.minChrom_control = this.minChrom;

   this.minChrom.label.text = "Min Chrominance value:";
   this.minChrom.label.minWidth = labelMinWidth;
   this.minChrom.slider.setRange(0, 1000);
   this.minChrom.slider.minWidth = sliderMinWidth;
   this.minChrom.setRange(0.0, 1.0);
   this.minChrom.setPrecision(4);
   this.minChrom.setValue(data.minChrom);
   this.minChrom.onValueUpdated = function(value) { data.minChrom = value; data.maskSuff = ""; }
   this.minChrom.toolTip =
      "<p>Min chrominance value to include in mask.</p>";

   this.chromParams_Sizer.add(this.minChrom);

   this.maxChrom = new NumericControl(this);
   data.maxChrom_control = this.maxChrom;

   this.maxChrom.label.text = "Max Chrominance value:";
   this.maxChrom.label.minWidth = labelMinWidth;
   this.maxChrom.slider.setRange(0, 1000);
   this.maxChrom.slider.minWidth = sliderMinWidth;
   this.maxChrom.setRange(0.0, 1.0);
   this.maxChrom.setPrecision(4);
   this.maxChrom.setValue(data.maxChrom);
   this.maxChrom.onValueUpdated = function(value) { data.maxChrom = value; data.maskSuff = ""; }
   this.maxChrom.toolTip =
      "<p>Max chrominance value to include in mask.</p>";

   this.chromParams_Sizer.add(this.maxChrom);

   
   
   
   this.maskParams_Sizer = new VerticalSizer;

   this.maskParams_Sizer.margin = 6;
   this.maskParams_Sizer.spacing = 4;

   this.chrominanceMask_RadioButton = new RadioButton(this);
   data.chrominanceMask_RadioButton_control = this.chrominanceMask_RadioButton;
   this.chrominanceMask_RadioButton.text = "Chrominance Mask";
   this.chrominanceMask_RadioButton.checked = data.maskType == MASK_CHROMINANCE;
   this.chrominanceMask_RadioButton.toolTip = "<p>Create a chrominance mask.</p>";
   this.chrominanceMask_RadioButton.onCheck = function(checked) {
      if (checked) data.maskType = MASK_CHROMINANCE;
   };

   this.lightnessMask_RadioButton = new RadioButton(this);
   data.lightnessMask_RadioButton_control = this.lightnessMask_RadioButton;
   this.lightnessMask_RadioButton.text = "Lightness Mask";
   this.lightnessMask_RadioButton.checked = data.maskType == MASK_LIGHTNESS;
   this.lightnessMask_RadioButton.toolTip = "<p>Create a lightness mask.</p>";
   this.lightnessMask_RadioButton.onCheck = function(checked) {
      if (checked) data.maskType = MASK_LIGHTNESS;
   };

   this.linearMask_RadioButton = new RadioButton(this);
   data.linearMask_RadioButton_control = this.linearMask_RadioButton;
   this.linearMask_RadioButton.text = "Linear Mask";
   this.linearMask_RadioButton.checked = data.maskType == MASK_LINEAR;
   this.linearMask_RadioButton.toolTip = "<p>Create a linear mask.</p>";
   this.linearMask_RadioButton.onCheck = function(checked) {
      if (checked) data.maskType = MASK_LINEAR;
   };

   this.maskStrength = new NumericControl(this);
   data.maskStrength_control = this.maskStrength;

   this.maskStrength.label.text = "Mask Strength:";
   this.maskStrength.label.minWidth = labelMinWidth;
   this.maskStrength.slider.setRange(0, sliderMaxValue);
   this.maskStrength.slider.minWidth = sliderMinWidth;
   this.maskStrength.setRange(0.0, 1.0);
   this.maskStrength.setPrecision(4);
   this.maskStrength.setValue(data.maskStrength);
   this.maskStrength.onValueUpdated = function(value) { data.maskStrength = value; }
   this.maskStrength.toolTip =
      "<p>Mask strength controls how strongly hues away from the midpoint of the " +
                         "selected range are included in the mask</p>";

   this.maskParams_Sizer.add(this.chrominanceMask_RadioButton);
   this.maskParams_Sizer.add(this.lightnessMask_RadioButton);
   this.maskParams_Sizer.add(this.linearMask_RadioButton);
   this.maskParams_Sizer.add(this.maskStrength);

   this.maskPostprocess_Sizer = new VerticalSizer;
   this.maskPostprocess_Sizer.margin = 6;
   this.maskPostprocess_Sizer.spacing = 4;

   this.blurLayers_Sizer = new HorizontalSizer;
   this.blurLayers_Sizer.spacing = 4;

   this.blurLayers_Label = new Label(this);
   this.blurLayers_Label.minWidth = labelMinWidth;
   this.blurLayers_Label.text = "Mask blur: layers to remove ";

   this.blurLayers_SpinBox = new SpinBox(this);
   this.blurLayers_SpinBox.minValue = 0;
   this.blurLayers_SpinBox.maxValue = 8;
   this.blurLayers_SpinBox.value = data.blurLayers;
   this.blurLayers_SpinBox.toolTip = this.blurLayers_Label.toolTip =
      "<b>Number of wavelet layers that will be removed to blur the mask.</b>";
   this.blurLayers_SpinBox.onValueUpdated = function(value) {
      data.blurLayers = value;
   };

   this.blurLayers_Sizer.add(this.blurLayers_Label);
   this.blurLayers_Sizer.add(this.blurLayers_SpinBox);
   this.blurLayers_Sizer.addStretch();
   this.maskPostprocess_Sizer.add(this.blurLayers_Sizer);

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;

   this.newInstance_Button = new ToolButton(this);
   this.newInstance_Button.icon = new Bitmap( ":/process-interface/new-instance.png" );
   this.newInstance_Button.toolTip = "New Instance";
   this.newInstance_Button.onMousePress = function()
   {
      this.hasFocus = true;
      exportParameters();
      this.pushed = false;
      this.dialog.newInstance();
   };

   this.ok_Button = new PushButton(this);
   this.ok_Button.text = " OK ";
#ifneq __PI_PLATFORM__ MACOSX
    this.ok_Button.icon = new Bitmap( ":/icons/ok.png" );
#endif

   this.ok_Button.onClick = function() {
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton(this);
   this.cancel_Button.text = " Cancel ";
#ifneq __PI_PLATFORM__ MACOSX
    this.cancel_Button.icon = new Bitmap( ":/icons/cancel.png" );
#endif

   this.cancel_Button.onClick = function() {
      this.dialog.cancel();
   };

   /* this.buttons_Sizer.add(this.newInstance_Button); */
   this.buttons_Sizer.add(this.newInstance_Button);
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add(this.ok_Button);
   this.buttons_Sizer.add(this.cancel_Button);

   this.sizer = new VerticalSizer;
   this.sizer.margin = 6;
   this.sizer.spacing = 6;
   this.sizer.add(this.helpLabel);
   this.sizer.addSpacing(4);
   this.sizer.add(this.targetImage_Sizer);
   this.sizer.add(this.hueParams_Sizer);
   this.sizer.add(this.lumParams_Sizer);
   this.sizer.add(this.chromParams_Sizer);
   this.sizer.add(this.maskParams_Sizer);
   this.sizer.add(this.maskPostprocess_Sizer);
   this.sizer.add(this.buttons_Sizer);

   this.windowTitle = TITLE + " Script";
   this.adjustToContents();
   this.setFixedSize();
}

// Our dialog inherits all properties and methods from the core Dialog object.
ColorMaskDialog.prototype = new Dialog;

/*
 * Script entry point.
 */
function main()
{
   if (!DEBUG)
      console.hide();

   if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
      if (DEBUG)
         console.writeln("Script instance");
      importParameters();
   }
   else
   {
	  loadSettings();
   }

   if (Parameters.isViewTarget) {
      if (DEBUG)
         console.writeln("Executed on target view");
   } else {
      if (DEBUG)
         console.writeln("Direct or global context");
   }

   if (!data.targetView) {
      (new MessageBox("There is no active image window!",
         TITLE, StdIcon_Error, StdButton_Ok)).execute();
      return;
   }

   var dialog = new ColorMaskDialog();
   for (;;) {
      if (!dialog.execute())
         break;

      // A view must be selected.
      if (data.targetView.isNull) {
         (new MessageBox("You must select a view to apply this script.",
               TITLE, StdIcon_Error, StdButton_Ok)).execute();
         continue;
      }

      // Only works on a colour image, duh!
      if (data.targetView.image.numberOfChannels != 3) {
         (new MessageBox("You must supply an RGB color image.",
               TITLE, StdIcon_Error, StdButton_Ok)).execute();
         continue;
      }

      console.abortEnabled = true;
      console.show();

      var t0 = new Date;

      data.targetView.beginProcess(UndoFlag_NoSwapFile);
      ColorMask(data.targetView.image, data.targetView.id);
      data.targetView.endProcess();

      var t1 = new Date;
      console.writeln(format("<end><cbr>ColorMask: %.2f s", (t1.getTime() - t0.getTime())/1000));
	  
	  saveSettings();

      // Quit after successful execution.
      break;
   }
}

main();

// ----------------------------------------------------------------------------
// EOF ColorMask.js - Released 2017-07-07T12:11:59Z
