/* global Dialog, MouseButton_Left, EXTRA_CONTROLS, UndoFlag_NoSwapFile, ImageOp_Mul, ImageOp_Sub, TextAlign_Right, TextAlign_VertCenter, FrameStyle_Sunken, File, StdCursor_SquarePlus, blinkRejects, DEFAULT_AUTOSTRETCH_SCLIP, DEFAULT_AUTOSTRETCH_TBGND, StdDialogCode_Ok */

// Version 1.0 (c) John Murphy 6th-June-2020
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
//"use strict";


/**
 * @param {NsgData} data
 * @param {NsgDialog} nsgDialog
 * @param {BlinkData[]} blinkDataArray
 * @returns {Boolean}
 */
function runBlink(data, nsgDialog, blinkDataArray){
    if (data.targetFiles.length < 2) {
        displayError("At least two target files must be specified.", true);
        return false;
    }
    blinkDataArray.sort((a, b) => a.displayNoise - b.displayNoise);
    let allHaveExposure = true;
    // Check for problems before we calculate
    for (let blinkData of blinkDataArray){
        if (!blinkData.exposure){
            // Zero or undefined
            allHaveExposure = false;
        }
    }

    /**
     * @param {String} refFilename full filename including path
     * @param {Number} nItems number of images to blink
     * @param {NsgStatus} nsgStatus 
     * @returns {ProgressDialog}
     */
    function showProgressDialog(refFilename, nItems, nsgStatus){
        let dialog = new ProgressDialog(refFilename, nItems, "Blink: Applying scale and offset", nsgStatus);
        dialog.show();
        processEvents();
        return dialog;
    }

    let refHeaderEntries;
    let allOk = true;
    try {
        let startTime = new Date().getTime();
        let refFilename = data.cache.getRefFilename();
        let progressDialog;
        let nsgStatus = new NsgStatus(data);
        let nItems = blinkDataArray.length;
        if (!refFilename){
            refFilename = blinkDataArray[0].filename;
            progressDialog = showProgressDialog(refFilename, nItems, nsgStatus);
            if (progressDialog) progressDialog.updateElapsedTime("Processing reference image");
            console.writeln("Reading reference image: ", refFilename);
            nsgDialog.setReferenceFilename(data, refFilename);  // This sets dialog.enabled false then true
        } else {
            progressDialog = showProgressDialog(refFilename, nItems, nsgStatus);
            if (progressDialog) progressDialog.updateElapsedTime("Processing reference image");
        }
        console.writeln("Setting up photometry");
        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
        processEvents();
        let nChannels = data.cache.isColor() ? 3 : 1;
        let refImage = data.cache.getRefImage();
        refHeaderEntries = getHdrEntries(data.cache.getRefImageData(), refFilename);
        let refWidth = refImage.width;
        let refHeight = refImage.height;
        let refIsColor = refImage.isColor;
        let refNoiseRaw = refHeaderEntries.getNoise();
        let refNoiseMRS = refImage.noiseMRS();
        let refNoiseKSigma = refImage.noiseKSigma();
        progressDialog.updateRefStars(data);
        try {
            for (let i = 0; i < nItems; i++){
                processEvents();
                let tgtTime = new Date().getTime();
                if (blinkDataArray[i].filename === refFilename){
                    if (nChannels > 1){
                        blinkDataArray[i].scale = [1, 1, 1];
                    } else {
                        blinkDataArray[i].scale = [1];
                    }
                    blinkDataArray[i].setImage(refImage);
                    blinkDataArray[i].weight = allHaveExposure ? 1 / blinkDataArray[i].exposure : 1;
                    continue;
                }

                if (!data.cache.setTgtFilename(blinkDataArray[i].filename)){
                    displayError("Blink error:\nFailed to read " + blinkDataArray[i].filename, true);
                    allOk = false;
                    break;
                }
                if (progressDialog) progressDialog.updateElapsedTime("Reading target image");
                let tgtImage = data.cache.getTgtImage();
                if (tgtImage.width !== refWidth || tgtImage.height !== refHeight){
                    let msg = "All images must have the same dimensions: " + 
                        tgtImage.width + "x" + tgtImage.height + " expected: " + refWidth + "x" + refHeight;
                    msg = logError(null, msg, blinkDataArray[i].filename);
                    displayError(msg, true);
                    allOk = false;
                    break;
                }
                if (tgtImage.isColor !== refIsColor){
                    let msg = logError(null, "Mixture of color and monochrome.", blinkDataArray[i].filename);
                    displayError(msg, true);
                    allOk = false;
                    break;
                }
                if (nsgStatus.isAborted()){
                    allOk = false;
                    break;
                }
                if (progressDialog) progressDialog.updateElapsedTime("Detecting stars");
                // Scale factors
                let colorStarPairs = getColorStarPairs(nChannels, data);
                let scaleFactors = getScaleFactors(colorStarPairs, data);
                blinkDataArray[i].setScale(scaleFactors);
                blinkDataArray[i].setImage(tgtImage);
                let tgtHeaderEntries = getHdrEntries(data.cache.getTgtImageData(), data.cache.getTgtFilename());
                let tgtNoiseRaw = tgtHeaderEntries.getNoise();
                let useRawNoise = refNoiseRaw && tgtNoiseRaw && refNoiseRaw.index === tgtNoiseRaw.index;
                let weightResults;
                if (!useRawNoise){
                    // calcNoiseAndWeight assumes the image has been normalized for scale.
                    // Hence we have to apply the scale factor to the weight.
                    weightResults = calcNoiseAndWeight(tgtImage, refNoiseMRS, refNoiseKSigma, nChannels);
                    let transmission = avgTransmission(scaleFactors);
                    blinkDataArray[i].weight = weightResults.averageWeight * transmission * transmission;
                } else {
                    weightResults = calcWeight(scaleFactors, refNoiseRaw, tgtNoiseRaw);
                    blinkDataArray[i].weight = weightResults ? weightResults.averageWeight : 0; // check for incomplete NOISExx entry
                }
                if (allHaveExposure){
                    blinkDataArray[i].weight /= blinkDataArray[i].exposure;
                }
                if (nsgStatus.isAborted()){
                    allOk = false;
                    break;
                }
                let nRemain = nItems - (i + 1);
                if (nRemain){
                    let ms = new Date().getTime() - tgtTime;
                    let elapsedTime = getElapsedTime(tgtTime);
                    let timeRemaining = msToTime(nRemain * ms);
                    let nPhotStars = 0;
                    for (let colorStarPair of colorStarPairs){
                        // Use the color channel with the maximum number of photometry star matches.
                        nPhotStars = Math.max(nPhotStars, colorStarPair.length);
                    }
                    let blinkResult = new Result("", blinkDataArray[i].filename, false, "", 
                        weightResults.averageWeight, scaleFactors, weightResults.signalToNoise, nPhotStars);
                    progressDialog.updateTarget(data, i+1, blinkResult, elapsedTime, timeRemaining);
                    processEvents();
                }
            }
        } catch (error){
            allOk = false;
            displayError("Blink error:\n" + error, true);
            logError(error, "Blink error:\n");
        }finally {
            progressDialog.hide();
            gc(false);
        }
        if (allOk){
            blinkDataArray.sort((a,b) => b.weight - a.weight);
            console.noteln("Blink [", nItems, "/", nItems, "] Total time: ", msToTime(new Date().getTime() - startTime));
            for (let blinkData of blinkDataArray){
                if (blinkData.weight){
                    let w = blinkData.weight / blinkDataArray[0].weight;
                    console.writeln(blinkData.filename + ", rating: ", w.toFixed(2));
                }
            }
            // Display blink dialog
            let blinkDialog = new BlinkDialog("Blink: Images normalized for scale and offset", data, blinkDataArray);
            let blinkReturn = blinkDialog.execute();
            (new NsgDialogSizes()).store("Blink", blinkDialog.width, blinkDialog.height);
            if (blinkReturn === StdDialogCode_Ok){
                if (blinkDialog.referenceFile !== data.cache.getRefFilename()){
                    console.noteln("Setting reference to: ", File.extractName(blinkDialog.referenceFile) );
                    nsgDialog.setReferenceFilename(data, blinkDialog.referenceFile);
                }
            }
        }
    } catch (error){
        allOk = false;
        displayError("Blink error:\n" + error, true);
        logError(error);
    } finally {
        for (let blinkData of blinkDataArray){
            blinkData.free();
        }
        for (let blinkData of blinkRejects){
            blinkData.free();
        }
        gc(true);
    }
    nsgDialog.enabled = true;
    return allOk;
}

/**
 * @param {String} filename
 * @param {Number} displayNoise
 * @param {String} noiseType
 * @param {Number} exposure
 * @param {Number} weight
 * @returns {BlinkData}
 */
function BlinkData (filename, displayNoise, noiseType, exposure, weight){
    this.filename = filename;
    this.displayNoise = displayNoise;
    this.noiseType = noiseType;
    this.exposure = exposure;
    this.weight = weight;
    this.scale = undefined;     // scaleFactors
    this.backgroundStr = "";
    this.blueSampleGradient = undefined;
    this.redSampleGradient = undefined;
    let bitmapData = new BitmapData();
    let nChannels;
    let self = this;
    /**
     * Set scale[c] to linearFitDataArray[c].m
     * @param {LinearFitData[]} linearFitDataArray
     */
    this.setScale = function(linearFitDataArray){
        self.scale = linearFitDataArrayToScaleArray(linearFitDataArray);
    };
    /**
     * Sets image to a copy of img
     * @param {Image} img
     */
    this.setImage = function(img){
        let image = new Image(img);
        bitmapData.setImage(image);
        nChannels = image.isColor ? 3 : 1;
    };
    
    /**
     * @param {Point} point
     * @returns {String} Image sample value L or R, G, B
     */
    this.getImageSample = function(point){
        return bitmapData.getImageSample(point);
    };
    
    /*
     * Used to get reference image median
     * @returns {Number[]} image median for each color channel.
     */
    this.calcImageMedian = function(){
        return bitmapData.calcImageMedian();
    };
    
    /**
     * Apply a scale and offset to the stored image.
     * @param {Number[]} refBackground Target background level for each channel
     * @param {Number[]} refScale Normalize the scale factor to this image's scale
     */
    this.blinkNormalizeScaleOffset = function(refBackground, refScale){
        let medians = bitmapData.normalizeScaleOffset(refBackground, self.scale, refScale);
        self.backgroundStr = "";
        for (let c=0; c<medians.length; c++){
            let bg = Math.round(medians[c] * 65536);
            self.backgroundStr += c ? ':' + bg : bg;
        }
    };
    
    /**
     * @param {Samples} samples
     */
    this.setBlueSampleGradient = function(samples){
        self.blueSampleGradient = samples.getBlueSampleGradient(bitmapData.getImage());
    };
    
    /**
     * @param {Samples} samples
     */
    this.setRedSampleGradient = function(samples){
        self.redSampleGradient = samples.getRedSampleGradient(bitmapData.getImage());
    };
    
    /**
     * Used to get reference histogram. This will then be applied to all other images.
     * @param {Number} blackPointFromMedian Shadows clipping point in (normalized) MAD units from the median.
     * @param {Number} targetMeanBackground Target mean background in the [0,1] range.
     * @return {HistogramTransform} Histogram transform
     */
    this.calcHistogramTransform = function(blackPointFromMedian, targetMeanBackground){
        return bitmapData.calcHistogramTransform(blackPointFromMedian, targetMeanBackground);
    };
    
    /**
     * Sets HistogramTransform (but does not apply it). Clears cached bitmap.
     * @param {HistogramTransform} HT
     */
    this.setHistogramTransform = function(HT){
        bitmapData.setHistogramTransform(HT);
    };
    
    /**
     * Creates a temporary view with a copy of the image.
     * Applies the HistogramTransform to the image.
     * Creates a bitmap from the stretched image.
     * Caches the bitmap.
     * @param {Boolean} useSTF 
     * @returns {Bitmap} Cached bitmap
     */
    this.getBitmap = function(useSTF){
        return bitmapData.getBitmap(useSTF);
    };
    
    /**
     * Free the stored image and bitmap
     */
    this.free = function(){        
        bitmapData.free();
        let image = bitmapData.getImage();
        if (image){
            image.free();
        }
    };
}

/**
 * Display the detected stars in a Dialog that contains a scrolled window.
 * The user can choose to display stars from the reference image or the target image.
 * @param {String} title Window title
 * @param {NsgData} data Values from user interface
 * @param {BlinkData[]} blinkDataArray Sorted by weight
 * @returns {BlinkDialog}
 */
function BlinkDialog(title, data, blinkDataArray){
    this.__base__ = Dialog;
    this.__base__();
    
    /**
     * Corner samples used to estimate gradient
     * @param {NsgData} data
     * @returns {BlinkDialog.Samples}
     */
    function Samples(data){
        let anyImage = data.cache.getRefImage();
        let w = anyImage.width;
        let h = anyImage.height;
        let rectSize = h / 10;
        let x = rectSize;
        let y = rectSize;
        this.rectRed1 = new Rect(x, y, x + rectSize, y + rectSize);
        x = w - rectSize * 2;
        this.rectBlue2 = new Rect(x, y, x + rectSize, y + rectSize);
        y = h - rectSize * 2;
        this.rectRed2 = new Rect(x, y, x + rectSize, y + rectSize);
        x = rectSize;
        this.rectBlue1 = new Rect(x, y, x + rectSize, y + rectSize);
        let self = this;
        
        /**
         * Gradient estimate between red samples
         * @param {Image} image
         * @returns {String} Difference between sample medians, 16bit format
         */
        this.getRedSampleGradient = function(image){
            let nChannels = image.isColor ? 3 : 1;
            let gradientStr = "";
            for (let c = 0; c<nChannels; c++){
                let dif = Math.round((image.median(self.rectRed2, c, c) - image.median(self.rectRed1, c, c)) * 65636);
                gradientStr += c ? ':' + dif : dif;
            }
            return gradientStr;
        };
        /**
         * Gradient estimate between blue samples
         * @param {Image} image
         * @returns {String} Difference between sample medians, 16bit format
         */
        this.getBlueSampleGradient = function(image){
            let nChannels = image.isColor ? 3 : 1;
            let gradientStr = "";
            for (let c = 0; c<nChannels; c++){
                let dif = Math.round((image.median(self.rectBlue2, c, c) - image.median(self.rectBlue1, c, c)) * 65636);
                gradientStr += c ? ':' + dif : dif;
            }
            return gradientStr;
        };
    }
    
    let useSTF = true;
    let stfShadows = DEFAULT_AUTOSTRETCH_BOOSTED_SCLIP;
    let stfStretch = DEFAULT_AUTOSTRETCH_BOOSTED_TBGND;
    let samples = new Samples(data);
    let self = this;
    let zoomText = "1:1";
    let coordText;
    setCoordText(null);
    let nImages = blinkDataArray.length;
    let refBlinkData = blinkDataArray[0];
    let refMedian = refBlinkData.calcImageMedian();
    let refScale = refBlinkData.scale;
    let refHT = refBlinkData.calcHistogramTransform(stfShadows, stfStretch);
    refBlinkData.backgroundStr = "";
    for (let c=0; c<refMedian.length; c++){
        let bg = Math.round(refMedian[c] * 65536);
        refBlinkData.backgroundStr += c ? ':' + bg : bg;
    }
    for (let i=0; i<nImages; i++){
        let blinkData = blinkDataArray[i];
        if (i){
            blinkData.blinkNormalizeScaleOffset(refMedian, refScale);
            blinkData.setHistogramTransform(refHT);
        }
        blinkData.setBlueSampleGradient(samples);
        blinkData.setRedSampleGradient(samples);
    }
    let imageIndex = 0;
    let bitmap = refBlinkData.getBitmap(useSTF);
    this.referenceFile = refBlinkData.filename;
    blinkRejects = [];

    /**
     * Set dialog title, including the current zoom and cursor coordinates
     */
    function setTitle(){
        self.windowTitle = title + " " + zoomText + " " + coordText;
    };
    
    /**
     * Set coordText, the cursor coordinate text.
     * @param {Point} point cursor coordinates relative to the (1:1) bitmap
     */
    function setCoordText(point){
        if (point === null){
            coordText = "(---,---)";
        } else {
            coordText = format("(%8.2f,%8.2f )", point.x, point.y);
            coordText += blinkDataArray[imageIndex].getImageSample(point);
        }
    }
    
    let activeRect;
    let dragOffset = new Point();
    let isRedSampleGradient;
    
    /**
     * Create Region of Interest rectangle
     * @param {Point} point
     * @param {type} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    function ctrlDragListener(point, button, buttonState, modifiers){
        if (button === MouseButton_Left && buttonState === 1){
            // Is it inside a rectangle?
            if (samples.rectRed1.includes(point)){
                activeRect = samples.rectRed1;
                isRedSampleGradient = true;
            } else if (samples.rectRed2.includes(point)){
                activeRect = samples.rectRed2;
                isRedSampleGradient = true;
            } else if (samples.rectBlue1.includes(point)){
                activeRect = samples.rectBlue1;
                isRedSampleGradient = false;
            } else if (samples.rectBlue2.includes(point)){
                activeRect = samples.rectBlue2;
                isRedSampleGradient = false;
            } else {
                activeRect = undefined;
            }
            if (activeRect){
                dragOffset.x = point.x - activeRect.x0;
                dragOffset.y = point.y - activeRect.y0;
            }
            activeRect.moveTo(point.x - dragOffset.x, point.y - dragOffset.y);
            previewControl.forceRedraw();
        } else if (!button && buttonState === 1){
            if (activeRect){
                activeRect.moveTo(point.x - dragOffset.x, point.y - dragOffset.y);
                previewControl.forceRedraw();
            }
        } else if (button === MouseButton_Left && buttonState === 0){
            if (activeRect){
                let x = Math.round(point.x - dragOffset.x);
                let y = Math.round(point.y - dragOffset.y);
                let image = data.cache.getRefImage();
                x = Math.max(0, x);
                y = Math.max(0, y);
                x = Math.min(x, image.width - activeRect.width);
                y = Math.min(y, image.height - activeRect.height);
                activeRect.moveTo(x, y);
                // Update all gradient estimates
                for (let blinkData of blinkDataArray){
                    if (isRedSampleGradient){
                        blinkData.setRedSampleGradient(samples);
                    } else {
                        blinkData.setBlueSampleGradient(samples);
                    }
                }
                updateText(imageIndex);
                activeRect = undefined;
                previewControl.forceRedraw();
            }
        }
    }
    // =================================
    // Sample Generation Preview frame
    // =================================
    let showGradientSampleBoxes_checkBox = new CheckBox( this );
    showGradientSampleBoxes_checkBox.text = "Show gradient samples";
    showGradientSampleBoxes_checkBox.toolTip = "Draw the gradient sample squares.\nUse Ctrl + Drag to move the samples.";
    showGradientSampleBoxes_checkBox.checked = true;
    showGradientSampleBoxes_checkBox.onClick = function( checked ){
        previewControl.forceRedraw();
    };
    
    function customControls(horizontalSizer){
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(showGradientSampleBoxes_checkBox);
        horizontalSizer.addSpacing(20);
    }
    
    let previewControl = new PreviewControl(this, bitmap, 0, 0, null, customControls, true);
    previewControl.zoomInLimit = 1;
    previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    previewControl.updateCoord = function (point){
        setCoordText(point);
        setTitle();
    };
    previewControl.addCtrlDragListener(ctrlDragListener, StdCursor_SquarePlus);
    previewControl.onCustomPaintScope = this;
    previewControl.onCustomPaint = function (viewport, translateX, translateY, scale, x0, y0, x1, y1){
        if (showGradientSampleBoxes_checkBox.checked){
            let graphics;
            try {
                graphics = new VectorGraphics(viewport);
                graphics.clipRect = new Rect(x0, y0, x1, y1);
                graphics.translateTransformation(translateX, translateY);
                graphics.scaleTransformation(scale, scale);
                let penWidth = scale < 1 ? Math.round(1/scale) : 1;
                let redPen;
                let bluePen;
                if (activeRect){
                    if (isRedSampleGradient){
                        redPen = new Pen(0xffff0000, penWidth * 3);
                        bluePen = new Pen(0xff000080, 1);
                    } else {
                        redPen = new Pen(0xff800000, 1);
                        bluePen = new Pen(0xff0000ff, penWidth * 3);
                    }
                } else {
                    redPen = new Pen(0xffff0000, penWidth);
                    bluePen = new Pen(0xff0000ff, penWidth);
                }
                graphics.pen = redPen;
                graphics.antialiasing = false;
                graphics.drawRect(samples.rectRed1);
                graphics.drawRect(samples.rectRed2);
                graphics.pen = bluePen;
                graphics.drawRect(samples.rectBlue1);
                graphics.drawRect(samples.rectBlue2);
            } catch (e) {
                logError(e);
            } finally {
                graphics.end();
            }
        }
    };
    
    previewControl.ok_Button.text = "Set reference";
    previewControl.ok_Button.toolTip = "<p>Set the reference to the current blink image.</p>";
    previewControl.ok_Button.onClick = function(){
        self.referenceFile = blinkDataArray[imageIndex].filename;
        bitmap = new Bitmap(1, 1);
        bitmap.fill(0);
        previewControl.setImage(bitmap);
        self.ok();
    };
    
    previewControl.cancel_Button.onClick = function(){
        self.referenceFile = undefined;
        bitmap = new Bitmap(1, 1);
        bitmap.fill(0);
        previewControl.setImage(bitmap);
        self.cancel();
    };
    
    previewControl.includeUpdateButton = false;
    previewControl.setMinHeight(200);
    
    // ========================================
    // User controls
    // ========================================
    let controlsHeight = 0;
    let minHeight = previewControl.minHeight;
    let dialogHeightBeforeToggle;
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            dialogHeightBeforeToggle = self.height;
            if (bar.isExpanded()){
                previewControl.setMinHeight(previewControl.height + bar.section.height + 2);
            } else {
                previewControl.setMinHeight(previewControl.height - bar.section.height - 2);
            }
        } else {
            previewControl.setMinHeight(minHeight);
            processEvents();
            if (dialogHeightBeforeToggle) self.height = dialogHeightBeforeToggle;
        }
    };
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     */
    function finalUpdateFunction(){
        self.enabled = false;
        processEvents();
        let HT = blinkDataArray[0].calcHistogramTransform(stfShadows, stfStretch);
        for (let i=0; i<nImages; i++){
            if (i){
                blinkDataArray[i].setHistogramTransform(HT);
            }
        }
        bitmap = blinkDataArray[imageIndex].getBitmap(useSTF);
        previewControl.updateBitmap(bitmap);
        previewControl.forceRedraw();
        self.enabled = true;
        processEvents();
    }
    
    // ===================================================
    // SectionBar: Select Image
    // ===================================================
    /**
     * 
     * @param {Number} index
     */
    function updateText(index){
        let blinkData = blinkDataArray[index];
        nImagesTextBox.text = "" + (index + 1) + "/" + nImages;
        timeTextBox.text = blinkData.exposure ? "" + Math.round(blinkData.exposure) + "s" : "   ";
        weightTextBox.text = "" + (blinkData.weight / refBlinkData.weight).toFixed(2);
        gradientTextBox.text = "" + blinkData.redSampleGradient;
        gradientBlueTextBox.text = "" + blinkData.blueSampleGradient;
        bgTextBox.text = blinkData.backgroundStr;
        let blinkBarTitle = File.extractName(blinkData.filename);
        if (index === bookmarkIndex){
            blinkBarTitle += " [Bookmark]";
        }
        blinkBar.setTitle(blinkBarTitle);
    }
    
    let bookmarkIndex = imageIndex;
    let blinkReturnIndex = imageIndex;
    /**
     * Change the displayed image. Update text fields. Update blink button icon.
     * @param {Number} index
     */
    function changeImage(index){
        self.enabled = false;
        processEvents();
        try {
            bitmap = blinkDataArray[index].getBitmap(useSTF);
            previewControl.updateBitmap(bitmap);
            previewControl.forceRedraw();
            setTitle();
            updateText(index);
            blink_Button.enabled = blinkReturnIndex !== bookmarkIndex;
            if (index === bookmarkIndex){
                if (blinkReturnIndex === bookmarkIndex){
                    blink_Button.icon = self.scaledResource(":/script-editor/bookmark.png");
                    blink_Button.toolTip = "<p>At bookmarked image.</p>" + blinkButtonToolTip;
                } else {
                    blink_Button.icon = self.scaledResource(":/icons/debug-restart.png");
                    blink_Button.toolTip = "<p>Return to the previous image.</p>" + blinkButtonToolTip;
                }
            } else {
                blink_Button.icon = self.scaledResource(":/script-editor/bookmark-previous.png");
                blink_Button.toolTip = "<p>Go to bookmark.</p>" + blinkButtonToolTip;
            }
            setBookmark_Button.enabled = imageIndex !== bookmarkIndex;
        } catch (error){
            logError(error);
        }
        self.enabled = true;
        processEvents();
    }
    
    let previous_Button = new ToolButton(this);
    previous_Button.icon = this.scaledResource(":/arrows/arrow-left.png");
    previous_Button.toolTip = "<p>Display the previous image.</p>";
    previous_Button.onClick = function(){
        imageIndex--;
        if (imageIndex < 0){
            imageIndex = nImages - 1;
        }
        blinkReturnIndex = imageIndex;
        changeImage(imageIndex);
    };
    
    
    let next_Button = new ToolButton(this);
    next_Button.icon = this.scaledResource(":/arrows/arrow-right.png");
    next_Button.toolTip = "<p>Display the next image.</p>";
    next_Button.onClick = function(){
        imageIndex++;
        if (imageIndex >= nImages){
            imageIndex = 0;
        }
        blinkReturnIndex = imageIndex;
        changeImage(imageIndex);
    };
    
    let blinkButtonToolTip = "<p>Blink between the current image and the bookmarked image.</p>";
    let blink_Button = new ToolButton( this );
    blink_Button.icon = self.scaledResource(":/script-editor/bookmark.png");
    blink_Button.toolTip = blinkButtonToolTip;
    blink_Button.enabled = false;
    blink_Button.onClick = function(){
        if (imageIndex !== bookmarkIndex){
            imageIndex = bookmarkIndex;
        } else {
            imageIndex = blinkReturnIndex;
        }
        changeImage(imageIndex);
    };
    
    function setBookmark(index){
        bookmarkIndex = index;
        bookmarkTextBox.text = "" + (bookmarkIndex + 1);
    }
    
    let bookmarkTextBox = new Label( this );
    bookmarkTextBox.frameStyle = FrameStyle_Sunken;
    bookmarkTextBox.textAlignment = TextAlign_VertCenter;
    bookmarkTextBox.toolTip = "<p>The bookmarked image number.</p>" +
            "<p>Use the <b>Set bookmark</b> button to set the bookmarked image. " +
            "As you then navigate through the images, use the bookmark icon button to blink " +
            "between the current image and the bookmarked image.</p>";
    setBookmark(0);
    
    let setBookmark_Button = new PushButton(this);
    setBookmark_Button.text = "Set bookmark";
    setBookmark_Button.toolTip = "<p>Bookmark this image.</p>" +
            "<p>As you then navigate through the images, use the bookmark icon button to blink " +
            "between the current image and the bookmarked image.</p>";
    setBookmark_Button.onClick = function () {
        setBookmark(imageIndex);
        blinkReturnIndex = imageIndex;
        blink_Button.enabled = false;
        setBookmark_Button.enabled = false;
        updateText(imageIndex);
        blink_Button.icon = self.scaledResource(":/script-editor/bookmark.png");
        blink_Button.toolTip = "<p>At bookmarked image.</p>" + blinkButtonToolTip;
    };
    setBookmark_Button.enabled = false;
    
    let delete_Button = new ToolButton(this);
    delete_Button.icon = this.scaledResource(":/file-explorer/delete.png");
    delete_Button.toolTip = "<p>Remove the current image from the Blink list.</p>";
    delete_Button.enabled = blinkDataArray.length > 2;
    delete_Button.onClick = function () {
        if (imageIndex === bookmarkIndex){
            // Deleting bookmarked image. Set bookmark to first image.
            setBookmark(0);
        } else if (imageIndex < bookmarkIndex){
            // Index of bookmarked image has changed. Update bookmark.
            setBookmark(bookmarkIndex - 1);
        }
        let rejected = blinkDataArray[imageIndex];
        blinkDataArray.splice(imageIndex, 1);
        nImages = blinkDataArray.length;
        if (imageIndex >= nImages){
            imageIndex = 0;
        }
        if (blinkReturnIndex >= nImages){
            blinkReturnIndex = 0;
        }
        if (bookmarkIndex >= nImages){
            setBookmark(0);
        }
        blinkReturnIndex = imageIndex;
        changeImage(imageIndex);
        let enable = nImages > 1;
        next_Button.enabled = enable;
        previous_Button.enabled = enable;
        delete_Button.enabled = enable;
        blinkRejects.push(rejected);
    };
    
    let nImagesTextBox = new Label( this );
    nImagesTextBox.frameStyle = FrameStyle_Sunken;
    nImagesTextBox.textAlignment = TextAlign_VertCenter;
    nImagesTextBox.toolTip = "Nth image / Total number of images in the blink list.\n" +
            "The images are sorted by NWEIGHT.";
    nImagesTextBox.text = "1/" + nImages;
    
    let tToolTip = "Exposure time in seconds.";
    let time_Label = new Label( this );
    time_Label.text = "Exposure:";
    time_Label.toolTip = tToolTip;
    time_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let timeTextBox = new Label( this );
    timeTextBox.frameStyle = FrameStyle_Sunken;
    timeTextBox.textAlignment = TextAlign_VertCenter;
    timeTextBox.toolTip = tToolTip;
    timeTextBox.text = refBlinkData.exposure ? "" + Math.round(refBlinkData.exposure) + "s" : "   ";
    
    let wToolTip = "<p>NWEIGHT Image weight (Signal to noise ratio squared), adjusted for exposure time.</p>" +
            "<p>The displayed weight is adjusted for exposure time to " +
            "ensure that we reject images that were badly affected by light pollution, " +
            "and keep good images that had lower exposure times.</p>";
    let weight_Label = new Label( this );
    weight_Label.text = "Weight:";
    weight_Label.toolTip = wToolTip;
    weight_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let weightTextBox = new Label( this );
    weightTextBox.frameStyle = FrameStyle_Sunken;
    weightTextBox.textAlignment = TextAlign_VertCenter;
    weightTextBox.toolTip = wToolTip;
    weightTextBox.text = "1.00";
    
    let toolTipGR = "Gradient between the red sample squares. Format: 'L' or 'R:G:B', 16 bit\n" +
            "Calculates the median of each sample and displays the difference.\n" +
            "Use ctrl+drag to move the red sample squares.\n" +
            "Ideally the sample squares should be moved to areas of background sky.";
    let gradient_Label = new Label( this );
    gradient_Label.text = "Gradient:";
    gradient_Label.textColor = 0xffaa0000;
    gradient_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    gradient_Label.toolTip = toolTipGR;
    let gradientTextBox = new Label( this );
    gradientTextBox.frameStyle = FrameStyle_Sunken;
    gradientTextBox.textAlignment = TextAlign_VertCenter;
    gradientTextBox.toolTip = toolTipGR;
    gradientTextBox.text = "" + refBlinkData.redSampleGradient;
    
    let toolTipGB = "Gradient between the blue sample squares. Format: 'L' or 'R:G:B', 16 bit\n" +
            "Calculates the median of each sample and displays the difference.\n" +
            "Use ctrl+drag to move the blue sample squares.\n" +
            "Ideally the sample squares should be moved to areas of background sky.";
    let gradientBlue_Label = new Label( this );
    gradientBlue_Label.text = "Gradient:";
    gradientBlue_Label.textColor = 0xff0000cc;
    gradientBlue_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    gradientBlue_Label.toolTip = toolTipGB;
    let gradientBlueTextBox = new Label( this );
    gradientBlueTextBox.frameStyle = FrameStyle_Sunken;
    gradientBlueTextBox.textAlignment = TextAlign_VertCenter;
    gradientBlueTextBox.toolTip = toolTipGB;
    gradientBlueTextBox.text = "" + refBlinkData.blueSampleGradient;
    
    let bToolTip = "Original background, corrected for scale.\n" +
            "Format: 'L' or 'R:G:B', 16 bit";
    let bg_Label = new Label( this );
    bg_Label.text = "Background:";
    bg_Label.toolTip = bToolTip;
    bg_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let bgTextBox = new Label( this );
    bgTextBox.frameStyle = FrameStyle_Sunken;
    bgTextBox.textAlignment = TextAlign_VertCenter;
    bgTextBox.toolTip = bToolTip;
    bgTextBox.text = refBlinkData.backgroundStr;
    
    // =================================
    // SectionBar STF
    // =================================
    let stfShadows_Control = new NumericControl(this);
    stfShadows_Control.real = true;
    stfShadows_Control.label.text = "Shadows:";
    stfShadows_Control.toolTip = "<p>Shadows clipping point in (normalized) MAD units from the median. Default -2.8</p>" +
            "<p>Move left to include more dark pixels and decrease contrast.</p>";
    stfShadows_Control.setRange(-10, 0);
    stfShadows_Control.slider.setRange(0, 100);
    stfShadows_Control.setValue(stfShadows);
    stfShadows_Control.setPrecision( 2 );
    stfShadows_Control.onValueUpdated = function (value) {
        if (value > -5){
            stfShadows = value;
        } else {
            stfShadows = value + 1 - Math.pow(10, 0.5 * (-value - 5));
        }
    };
    addFinalUpdateListener(stfShadows_Control, finalUpdateFunction);
    
    let stfStretch_Control = new NumericControl(this);
    stfStretch_Control.real = true;
    stfStretch_Control.label.text = "Stretch:";
    stfStretch_Control.toolTip = "<p>Target mean background in the [0,1] range. Default 0.25</p>" +
            "<p>Move right to increase brightness.</p>";
    stfStretch_Control.setRange(0, 1);
    stfStretch_Control.slider.setRange(0, 100);
    stfStretch_Control.setValue(stfStretch);
    stfStretch_Control.setPrecision( 3 );
    stfStretch_Control.onValueUpdated = function (value) {
        stfStretch = value;
    };
    addFinalUpdateListener(stfStretch_Control, finalUpdateFunction);
    
    let stf_Button = new ToolButton(this);
    stf_Button.icon = this.scaledResource(":/icons/burn.png");
    stf_Button.toolTip = "<p>Calculate auto STF for the first image, then apply the same stretch to all images.</p>";
    stf_Button.onClick = function(){
        stfShadows = DEFAULT_AUTOSTRETCH_SCLIP;
        stfStretch = DEFAULT_AUTOSTRETCH_TBGND;
        stfShadows_Control.setValue(stfShadows);
        stfStretch_Control.setValue(stfStretch);
        finalUpdateFunction();
    };

    
    let stfBoosted_Button = new ToolButton(this);
    stfBoosted_Button.icon = this.scaledResource(":/icons/burn.png");
    stfBoosted_Button.toolTip = "<p>Calculate boosted auto STF for the first image, then apply the same stretch to all images.</p>";
    stfBoosted_Button.onClick = function(){
        stfShadows = DEFAULT_AUTOSTRETCH_BOOSTED_SCLIP;
        stfStretch = DEFAULT_AUTOSTRETCH_BOOSTED_TBGND;
        stfShadows_Control.setValue(stfShadows);
        stfStretch_Control.setValue(stfStretch);
        finalUpdateFunction();
    };
    
    
    let buttonSizer = new HorizontalSizer(this);
    buttonSizer.margin = 2;
    buttonSizer.spacing = 2;
    buttonSizer.add(delete_Button);
    buttonSizer.addSpacing(2);
    buttonSizer.add(nImagesTextBox);
    buttonSizer.addSpacing(2);
    buttonSizer.add(previous_Button);
    buttonSizer.addSpacing(2);
    buttonSizer.add(next_Button);
    buttonSizer.addSpacing(2);
    buttonSizer.add(blink_Button);
    buttonSizer.addSpacing(2);
    buttonSizer.add(setBookmark_Button);
    buttonSizer.add(bookmarkTextBox);
    buttonSizer.addSpacing(8);
    buttonSizer.add(weight_Label);
    buttonSizer.add(weightTextBox);
    buttonSizer.addSpacing(8);
    buttonSizer.add(gradient_Label);
    buttonSizer.add(gradientTextBox);
    buttonSizer.addSpacing(8);
    buttonSizer.add(gradientBlue_Label);
    buttonSizer.add(gradientBlueTextBox);
    buttonSizer.addSpacing(8);
    buttonSizer.add(bg_Label);
    buttonSizer.add(bgTextBox);
    buttonSizer.addSpacing(8);
    buttonSizer.add(time_Label);
    buttonSizer.add(timeTextBox);
    buttonSizer.addStretch();
    controlsHeight += next_Button.height;
    
    let blinkSection = new Control(this);
    blinkSection.sizer = new VerticalSizer;
    blinkSection.sizer.spacing = 2;
    blinkSection.sizer.add(buttonSizer);
    let blinkBar = new SectionBar(this, File.extractName(blinkDataArray[0].filename) + " [Bookmark]");
    blinkBar.setSection(blinkSection);
    blinkBar.onToggleSection = this.onToggleSection;
    blinkBar.toolTip = "Currently displayed image.";
    controlsHeight += blinkBar.height + blinkSection.sizer.spacing * 3;
    
    let stfSection = new Control(this);
    stfSection.sizer = new HorizontalSizer;
    stfSection.sizer.margin = 2;
    stfSection.sizer.spacing = 8;
    stfSection.sizer.add(stfShadows_Control, 50);
    stfSection.sizer.add(stfStretch_Control, 50);
    stfSection.sizer.add(stf_Button);
    stfSection.sizer.add(stfBoosted_Button);
    
    let stfBar = new SectionBar(this, "Apply STF");
    stfBar.enableCheckBox();
    stfBar.checkBox.checked = useSTF;
    stfBar.setSection(stfSection);
    stfBar.onToggleSection = this.onToggleSection;
    stfBar.toolTip = "<p>Calculates the STF for the first image, then applies the same stretch to all images.</p>";
    stfBar.checkBox.onCheck = function (checked) {
        useSTF = checked;
        finalUpdateFunction();
    };
    controlsHeight += stfBar.height + stfSection.sizer.spacing * 3;
    
    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(blinkBar);
    this.sizer.add(blinkSection);
    this.sizer.add(stfBar);
    this.sizer.add(stfSection);
    this.sizer.add(previewControl.getButtonSizer());
    
    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 4;

    // The PreviewControl size is determined by the size of the bitmap
    let rect = new NsgDialogSizes().get(data, "Blink");
    this.resize(rect.width, rect.height);
    setTitle();
    previewControl.updateZoom(-100, null);
}

BlinkDialog.prototype = new Dialog;
