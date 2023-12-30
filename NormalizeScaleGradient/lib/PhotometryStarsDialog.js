/* global Dialog, MouseButton_Left, PhotometryControls, EXTRA_CONTROLS, NSG_EXTRA_CONTROLS, TextAlign_Right, TextAlign_VertCenter, StdCursor_Add, FrameStyle_Sunken, StdIcon_Warning, StdButton_Ok */

// Version 1.0 (c) John Murphy 30th-July-2020
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
 * Display the detected stars in a Dialog that contains a scrolled window.
 * The user can choose to display stars from the reference image or the target image.
 * @param {String} title Window title
 * @param {NsgData} data Values from user interface
 * @param {NsgDialog} nsgDialog
 * @returns {PhotometryStarsDialog}
 */
function PhotometryStarsDialog(title, data, nsgDialog)
{
    this.__base__ = Dialog;
    this.__base__();
    
    const REF = 10;
    const TGT = 20;
    let self = this;
    
    let zoomText = "1:1";
    let coordText;
    setCoordText(null);
    let selectedBitmap = REF;
    let bitmap = getBitmap(selectedBitmap);
    let stars = getStars(selectedBitmap);
    let nChannels = data.cache.isColor() ? 3 : 1;
    let colorStarPairs = getColorStarPairs(nChannels, data);
    let starPairs = getStarPairs(0);
    let drawOrigPhotRects = false;
    let draggingROI = false;
    let dragStart;
    let dragEnd;
    
    /**
     * Return bitmap of the reference or target image
     * @param {Number} refOrTgt Set to REF or TGT
     * @returns {Bitmap}
     */
    function getBitmap(refOrTgt){
        return refOrTgt === REF ? data.cache.getRefImageBitmap() : data.cache.getTgtImageBitmap();
    }
    
    /**
     * Display the stars detected in the reference (refOrTgt = REF) or target image.
     * @param {NUMBER} refOrTgt Set to REF or TGT
     * @returns {Star[]}
     */
    function getStars(refOrTgt){
        if (refOrTgt === REF){
            return data.cache.getRefStars(data.logStarDetection);
        } 
        return data.cache.getTgtStars(data, data.logStarDetection);
    }
    
    /**
     * @param {Number} channel
     * @returns {StarPair[]}
     */
    function getStarPairs(channel){
        starPairs = [];
        if (data.cache.isColor()){
            if (channel < 3){
                // return stars from channel 0, 1 or 2
                starPairs = colorStarPairs[channel];
            } else {
                // return stars in all channels
            starPairs = colorStarPairs[0].concat(colorStarPairs[1], colorStarPairs[2]);
            }
        } else {
            starPairs = colorStarPairs[0];
        }
        return starPairs;
    }
    
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
            if (draggingROI && dragStart && dragEnd){
                let w = Math.round(Math.abs(dragEnd.x - dragStart.x));
                let h = Math.round(Math.abs(dragEnd.y - dragStart.y));
                coordText = "width " + w + ", height " + h;
            } else {
                coordText = format("(%8.2f,%8.2f )", point.x, point.y);
            }
        }
    }
    
    /**
     * Draw on top of the background bitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000, 1.0);
            graphics.antialiasing = true;
            for (let i = 0; i < stars.length; ++i){
                let star = stars[i];
                let radius = star.getStarRadius();
                graphics.strokeCircle(star.pos.x, star.pos.y, radius);
            }
        } catch (e){
            logError(e);
        } finally {
            graphics.end();
        }
    }
    
    /**
     * Draw on top of the background bitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            // Draw inner star flux square and outer background sky flux square
            for (let i = 0; i < starPairs.length; ++i){
                let starPair = starPairs[i];
                let pmStar = selectedBitmap === REF ? starPair.refPmStar : starPair.tgtPmStar;
                let rect;
                if (drawOrigPhotRects){
                    rect = new Rect(pmStar.getStar().getBoundingBox());
                } else {
                    rect = pmStar.getStarAperture();
                }
                graphics.strokeRect(rect);
                let bgInnerRect = pmStar.getStarBgAperture1();
                graphics.strokeRect(bgInnerRect);
                let bgOuterRect = pmStar.getStarBgAperture2();
                graphics.strokeRect(bgOuterRect);
            }
        } catch(e) {
            logError(e);
        } finally {
            graphics.end();
        }
    }
    
    function drawROI(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xff00ff00);
            if (draggingROI){
                if (dragStart && dragEnd){
                    let rectROI = new Rect(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y);
                    graphics.strokeRect(rectROI);
                }
            } else {
                let rectROI = new Rect(data.photometryROIx, data.photometryROIy, 
                    data.photometryROIx + data.photometryROIw, data.photometryROIy + data.photometryROIh);
                graphics.strokeRect(rectROI);
            }
        } catch(e) {
            logError(e);
        } finally {
            graphics.end();
        }
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let nStars_Label = new Label( this );
    nStars_Label.text = "Photometry stars:";
    nStars_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let nStars_Control = new Label( this );
    nStars_Control.frameStyle = FrameStyle_Sunken;
    nStars_Control.textAlignment = TextAlign_VertCenter;
    nStars_Control.toolTip = "Number of photometry stars that will be used";
    nStars_Control.text = "" + starPairs.length;
    
    function customControls(horizontalSizer){
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(nStars_Label);
        horizontalSizer.add(nStars_Control);
        horizontalSizer.addSpacing(20);
    }
    
    let previewControl = new PreviewControl(this, bitmap, 0, 0, null, customControls, false);
    previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    previewControl.updateCoord = function (point){
        setCoordText(point);
        setTitle();
    };
    previewControl.addCtrlDragListener(ctrlDragListener, StdCursor_Add);
    previewControl.onCustomPaintScope = this;
    previewControl.onCustomPaint = function (viewport, translateX, translateY, scale, x0, y0, x1, y1){
        if (photometricCheckBox.checked){
            drawPhotometryStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
        } else {
            drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
        }
        if (data.usePhotometryROI){
            drawROI(viewport, translateX, translateY, scale, x0, y0, x1, y1);
        }
    };
    previewControl.update_Button.text = "Update stars";
    previewControl.update_Button.toolTip = "Update stars for the current Region of Interest.";
    previewControl.update_Button.onClick = function(){
        finalUpdateFunction();
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };

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
    
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "Display either reference background and stars, or " +
            "target background and stars.";
    refCheckBox.checked = selectedBitmap === REF;
    refCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        stars = getStars(selectedBitmap);
        starPairs = getStarPairs(0);
        previewControl.updateBitmap(bitmap);
        update();
        self.enabled = true;
        processEvents();
    };
    
    let photometricCheckBox = new CheckBox(this);
    photometricCheckBox.text = "Photometry";
    photometricCheckBox.toolTip = "<p>Display either the detected stars (circles) " +
            "or the stars used for photometry (square aperture rings).</p>";
    photometricCheckBox.checked = true;
    photometricCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        enableControls(data.useAutoPhotometry, checked);
        starPairs = getStarPairs(0);
        previewControl.updateBitmap(bitmap);
        update();
        self.enabled = true;
        processEvents();
    };
    
    let oldPhotometricCheckBox;
    if (NSG_EXTRA_CONTROLS){
        oldPhotometricCheckBox = new CheckBox(this);
        oldPhotometricCheckBox.text = "Unmodified";
        oldPhotometricCheckBox.toolTip = "<p>Use photometry rectangles from StarDetector.</p>";
        oldPhotometricCheckBox.checked = drawOrigPhotRects;
        oldPhotometricCheckBox.onClick = function (checked) {
            self.enabled = false;
            processEvents();
            drawOrigPhotRects = checked;
            starPairs = getStarPairs(0);
            previewControl.updateBitmap(bitmap);
            update();
            self.enabled = true;
            processEvents();
        };
    }
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     */
    function finalUpdateFunction(){
        self.enabled = false;
        processEvents();
        updatePhotometry();
        self.enabled = true;
        processEvents();
    }
    
    // ===================================================
    // SectionBar: Star aperture size
    // ===================================================
    let photometryControls = new NsgPhotometryControls();
    const BACKGROUND_DELTA_STRLEN = this.font.width("Background delta:");
    
    let apertureGrowthRate_Control = photometryControls.createApertureGrowthRateControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    apertureGrowthRate_Control.onValueUpdated = function (value) {
        data.apertureGrowthRate = value;
        nsgDialog.apertureGrowthRate_Control.setValue(value);
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureGrowthRate_Control, finalUpdateFunction);
    //controlsHeight += apertureGrowthRate_Control.height;
    
    let apertureAdd_Control = photometryControls.createApertureAddControl(this, data, BACKGROUND_DELTA_STRLEN);
    apertureAdd_Control.onValueUpdated = function (value) {
        data.apertureAdd = value;
        nsgDialog.apertureAdd_Control.setValue(value);
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureAdd_Control, finalUpdateFunction);
    //controlsHeight += apertureAdd_Control.height;
    
    let apertureGap_Control = photometryControls.createApertureGapControl(this, data, BACKGROUND_DELTA_STRLEN);
    apertureGap_Control.onValueUpdated = function (value) {
        data.apertureGap = value;
        nsgDialog.apertureGap_Control.setValue(value);
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureGap_Control, finalUpdateFunction);
    //controlsHeight += apertureGap_Control.height;
    
    let apertureBgDelta_Control = photometryControls.createApertureBgDeltaControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    apertureBgDelta_Control.onValueUpdated = function (value) {
        data.apertureBgDelta = value;
        nsgDialog.apertureBgDelta_Control.setValue(value);
        update();
        processEvents();
    };
    addFinalUpdateListener(apertureBgDelta_Control, finalUpdateFunction);
    //controlsHeight += apertureBgDelta_Control.height;
    
    let apertureSection = new Control(this);
    apertureSection.sizer = new VerticalSizer;
    apertureSection.sizer.spacing = 2;
    apertureSection.sizer.add(apertureAdd_Control);
    apertureSection.sizer.add(apertureGrowthRate_Control);
    apertureSection.sizer.add(apertureGap_Control);
    apertureSection.sizer.add(apertureBgDelta_Control);
    let apertureBar = new SectionBar(this, "Star Aperture Size");
    apertureBar.setSection(apertureSection);
    apertureBar.onToggleSection = this.onToggleSection;
    apertureBar.toolTip = "Specifies the photometry star aperture";
    controlsHeight += apertureBar.height + 5; // + apertureSection.sizer.spacing * 3;
    
    // ===================================================
    // SectionBar: Outliers
    // ===================================================
    
    let outlierRemoval_Control = photometryControls.createOutlierRemovalControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    outlierRemoval_Control.onValueUpdated = function (value) {
        data.outlierRemovalPercent = value;
        nsgDialog.outlierRemoval_Control.setValue(value);
    };
    addFinalUpdateListener(outlierRemoval_Control, finalUpdateFunction);
//    controlsHeight += outlierRemoval_Control.height;
    
    let filterSection = new Control(this);
    filterSection.sizer = new VerticalSizer;
    filterSection.sizer.spacing = 2;
    filterSection.sizer.add(outlierRemoval_Control);
    filterSection.sizer.addSpacing(5);
    let filterBar = new SectionBar(this, "Outliers");
    filterBar.setSection(filterSection);
    filterBar.onToggleSection = this.onToggleSection;
    filterBar.toolTip = "Specifies which stars are used for photometry";
    controlsHeight += filterBar.height + 5; // + filterSection.sizer.spacing * 2 + 5;
    
    // ===================================================
    // SectionBar: Photometry Region of interest
    // ===================================================
    let labelRoiX = new Label(this);
    labelRoiX.text = "x:";
    labelRoiX.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let regionOfInterestX_Control = new SpinBox(this);
    regionOfInterestX_Control.toolTip = "Top left x coordinate";
    regionOfInterestX_Control.setRange(0, 99999);
    regionOfInterestX_Control.stepSize = 20;
    regionOfInterestX_Control.onValueUpdated = function (value){
        data.photometryROIx = value;
        nsgDialog.updatePhotometryRoi(data);
        update();
    };
    regionOfInterestX_Control.value = data.photometryROIx;
    controlsHeight += regionOfInterestX_Control.height;
    
    let labelRoiY = new Label(this);
    labelRoiY.text = "y:";
    labelRoiY.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let regionOfInterestY_Control = new SpinBox(this);
    regionOfInterestY_Control.toolTip = "Top left y coordinate";
    regionOfInterestY_Control.setRange(0, 99999);
    regionOfInterestY_Control.stepSize = 20;
    regionOfInterestY_Control.onValueUpdated = function (value){
        data.photometryROIy = value;
        nsgDialog.updatePhotometryRoi(data);
        update();
    };
    regionOfInterestY_Control.value = data.photometryROIy;
    
    let labelRoiW = new Label(this);
    labelRoiW.text = "Width:";
    labelRoiW.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let regionOfInterestW_Control = new SpinBox(this);
    regionOfInterestW_Control.toolTip = "Width";
    regionOfInterestW_Control.setRange(2, 99999);
    regionOfInterestW_Control.stepSize = 20;
    regionOfInterestW_Control.onValueUpdated = function (value){
        data.photometryROIw = value;
        nsgDialog.updatePhotometryRoi(data);
        update();
    };
    regionOfInterestW_Control.value = data.photometryROIw;
    
    let labelRoiH = new Label(this);
    labelRoiH.text = "Height:";
    labelRoiH.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let regionOfInterestH_Control = new SpinBox(this);
    regionOfInterestH_Control.toolTip = "Height";
    regionOfInterestH_Control.setRange(2, 99999);
    regionOfInterestH_Control.stepSize = 20;
    regionOfInterestH_Control.onValueUpdated = function (value){
        data.photometryROIh = value;
        nsgDialog.updatePhotometryRoi(data);
        update();
    };
    regionOfInterestH_Control.value = data.photometryROIh;
    
    let roiToolTip =
            "<p>If the galaxy / nebula does not cover the whole image, " +
            "the photometry stars can be restricted to the object and its neighboring region.</p>" +
            "This will improve the correction accuracy if one or more images are partially affected by clouds. " +
            "It also reduces execution time. Don't worry, the whole image still gets corrected.</p>";
    if (!data.isNSGXnmlInstalled){
        roiToolTip += "<p>Purchase NSGXnml to enable this option.</p>";
    }
    let roiSection = new Control(this);
    roiSection.sizer = new HorizontalSizer;
    roiSection.sizer.spacing = 2;
    roiSection.sizer.add(labelRoiX);
    roiSection.sizer.add(regionOfInterestX_Control);
    roiSection.sizer.addSpacing(20);
    roiSection.sizer.add(labelRoiY);
    roiSection.sizer.add(regionOfInterestY_Control);
    roiSection.sizer.addSpacing(20);
    roiSection.sizer.add(labelRoiW);
    roiSection.sizer.add(regionOfInterestW_Control);
    roiSection.sizer.addSpacing(20);
    roiSection.sizer.add(labelRoiH);
    roiSection.sizer.add(regionOfInterestH_Control);
    roiSection.sizer.addStretch();
    let roiBar = new SectionBar(this, "Photometry Region of Interest (Ctrl + drag left mouse button)");
    roiBar.enableCheckBox();
    roiBar.checkBox.onCheck = function (checked) {
        data.usePhotometryROI = checked;
        nsgDialog.updatePhotometryRoi(data);
        if (checked){
            update();
        } else {
            finalUpdateFunction();
        }
    };
    roiBar.checkBox.checked = data.usePhotometryROI;
    roiBar.setSection(roiSection);
    roiBar.onToggleSection = this.onToggleSection;
    roiBar.toolTip = roiToolTip;
    controlsHeight += roiBar.height + 5;
    roiBar.checkBox.enabled = data.isNSGXnmlInstalled;
    
    /**
     * Create Region of Interest rectangle
     * @param {Point} point
     * @param {type} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    function ctrlDragListener(point, button, buttonState, modifiers){
        if (!data.isNSGXnmlInstalled){
            if (button === MouseButton_Left && buttonState === 1){
                new MessageBox(
                    "Install the <b>NSGXnml</b> C++ process to enable Region of Interest\n" +
                    "https://www.normalizescalegradient.net/",
                    "NormalizeScaleGradient", StdIcon_Warning, StdButton_Ok).execute();
            }
            return;
        }
        if (!data.usePhotometryROI) {
            data.usePhotometryROI = true;
            roiBar.checkBox.checked = data.usePhotometryROI;
            nsgDialog.updatePhotometryRoi(data);
        }
        if (button === MouseButton_Left && buttonState === 1){
            dragStart = point;
            dragEnd = undefined;
            draggingROI = true;
            update();
        } else if (!button && buttonState === 1){
            dragEnd = point;
            // draw draggingROI rectangle
            update();
        } else if (button === MouseButton_Left && buttonState === 0){
            dragEnd = point;
            draggingROI = false;
            let image = data.cache.getRefImage();
            let intRect = new Rect(dragStart.x, dragStart.y, dragEnd.x, dragEnd.y);
            intRect.round();
            intRect.order();
            let x0 = Math.max(0, intRect.x0);
            let y0 = Math.max(0, intRect.y0);
            let x1 = Math.min(image.width, intRect.x1);
            let y1 = Math.min(image.height, intRect.y1);
            let w = x1 - x0;
            let h = y1 - y0;
            if (w > 2 && h > 2){
                data.photometryROIx = x0;
                data.photometryROIy = y0;
                data.photometryROIw = w;
                data.photometryROIh = h;
                nsgDialog.updatePhotometryRoi(data);
                regionOfInterestX_Control.value = data.photometryROIx;
                regionOfInterestY_Control.value = data.photometryROIy;
                regionOfInterestW_Control.value = data.photometryROIw;
                regionOfInterestH_Control.value = data.photometryROIh;
                finalUpdateFunction();
            } else {
                update();
            }
        }
    }
    
    // ===================================================
    // SectionBar: Linear Range
    // ===================================================
    let linearRangeRef_Control = photometryControls.createLinearRangeRefControl(
            this, data, BACKGROUND_DELTA_STRLEN);
    linearRangeRef_Control.toolTip += "<p>Select the Photometry checkbox to enable this control</p>";
    linearRangeRef_Control.onValueUpdated = function (value) {
        data.linearRangeRef = value;
        nsgDialog.linearRangeRef_Control.setValue(value);
//        if (liveUpdate_control.checked){
//            update(bitmapControl.width, bitmapControl.height, true);
//        }
    };
    addFinalUpdateListener(linearRangeRef_Control, finalUpdateFunction);
//    controlsHeight += linearRangeRef_Control.height;
    
    let linearRangeSection = new Control(this);
    linearRangeSection.sizer = new VerticalSizer;
    linearRangeSection.sizer.spacing = 2;
    linearRangeSection.sizer.add(linearRangeRef_Control);
    linearRangeSection.sizer.addSpacing(5);
    let linearRangeBar = new SectionBar(this, "Linear Range");
    linearRangeBar.setSection(linearRangeSection);
    linearRangeBar.onToggleSection = this.onToggleSection;
    linearRangeBar.toolTip = "Only stars within the camera's linear range should be used for photometry";
    controlsHeight += linearRangeBar.height + 5; // + linearRangeSection.sizer.spacing + 5;

    /**
     * Draw the stars on top of the background bitmap within the scrolled window.
     */
    function update(){
        previewControl.forceRedraw();
    }
    
    function updatePhotometry(){
        // Get the stars that will be displayed (ref or tgt)
        stars = getStars(selectedBitmap);
        // Get the photometry stars that will be displayed
        colorStarPairs = getColorStarPairs(nChannels, data);
        starPairs = getStarPairs(0);
        nStars_Control.text = "" + starPairs.length;
        update();
    }
    
    let autoCheckBox = new CheckBox(this);
    autoCheckBox.text = "Auto";
    autoCheckBox.toolTip = "<p>Sets the controls to calculated values</p>";
    autoCheckBox.onClick = function (checked) {
        data.setPhotometryAutoValues(checked, true);
        if (checked){
            self.enabled = false;
            processEvents();
            apertureAdd_Control.setValue(data.apertureAdd);
            apertureGrowthRate_Control.setValue(data.apertureGrowthRate);
            apertureGap_Control.setValue(data.apertureGap);
            apertureBgDelta_Control.setValue(data.apertureBgDelta);
            outlierRemoval_Control.setValue(data.outlierRemovalPercent);
            linearRangeRef_Control.setValue(data.linearRangeRef);
            processEvents();
            finalUpdateFunction();
            self.enabled = true;
            processEvents();
        }
        enableControls(checked, photometricCheckBox.checked);
    };
    autoCheckBox.checked = data.useAutoPhotometry;
    
    function enableControls(auto, isPhotometricMode){
        apertureAdd_Control.enabled = !auto && isPhotometricMode;
        apertureGrowthRate_Control.enabled = !auto && isPhotometricMode;
        apertureGap_Control.enabled = !auto && isPhotometricMode;
        apertureBgDelta_Control.enabled = !auto && isPhotometricMode;
        outlierRemoval_Control.enabled = !auto && isPhotometricMode;
        linearRangeRef_Control.enabled = !auto && isPhotometricMode;
    }
    
    enableControls(data.useAutoPhotometry, true);
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(autoCheckBox);
    optionsSizer.add(photometricCheckBox);
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();
    if (NSG_EXTRA_CONTROLS)
        optionsSizer.add(oldPhotometricCheckBox);
    
    controlsHeight += refCheckBox.height;
    
    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(roiBar);
    this.sizer.add(roiSection);
    this.sizer.add(apertureBar);
    this.sizer.add(apertureSection);
    this.sizer.add(filterBar);
    this.sizer.add(filterSection);
    this.sizer.add(linearRangeBar);
    this.sizer.add(linearRangeSection);
    this.sizer.add(previewControl.getButtonSizer());
    
    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 4;
    apertureSection.hide();
    filterSection.hide();
    linearRangeSection.hide();

    let rect = new NsgDialogSizes().get(data, "PhotometryStars");
    this.resize(rect.width, rect.height);
    setTitle();
    previewControl.updateZoom(-100, null);
}

PhotometryStarsDialog.prototype = new Dialog;
