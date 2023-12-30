/* global Dialog, MouseButton_Left, TextAlign_Left, TextAlign_VertCenter, MAX_CIRCLE_RADIUS, MANUAL_RADIUS, FrameStyle_Sunken, TextAlign_Right */

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
 * Display the SampleGrid in a Dialog that contains a scrolled window and 
 * controls to adjust the SampleGrid parameters.
 * @param {String} title Window title
 * @param {NsgData} data Values from user interface
 * @param {String} tgtFilename 
 * @param {NsgDialog} nsgDialog
 * @returns {SampleGridDialog}
 */
function SampleGridDialog(title, data, tgtFilename, nsgDialog)
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
    let refBitmap = data.cache.getRefImageBitmap();
    let tgtBitmap = data.cache.getTgtImageBitmap();
    let bitmap = getBitmap(selectedBitmap);
    let selectedCircleIdx = -1;
    let allStars = data.cache.getRefStars(data.logStarDetection);
    let binRects = getBinRects();
    
    /**
     * @returns {Rect[]} The sample grid
     */
    function getBinRects(){
        let sampleGrid = data.cache.getSampleGrid(data, tgtFilename);
        return sampleGrid.getBinRectArray(allStars, data);
    }
    
    /**
     * Return bitmap of the reference or target image
     * @param {Number} refOrTgt Set to REF or TGT
     * @returns {Bitmap}
     */
    function getBitmap(refOrTgt){
        return refOrTgt === REF ? refBitmap : tgtBitmap;
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
            coordText = format("(%8.2f,%8.2f )", point.x, point.y);
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
    function drawSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            graphics.antialiasing = false;
            
            // Draw the sample grid
            for (let binRect of binRects){
                graphics.drawRect(binRect);
            }
            let penWidth = scale < 1 ? Math.round(1/scale) : 1;
            drawRejectionCircles(graphics, penWidth, data, allStars, selectedCircleIdx);
            
        } catch (e) {
            logError(e);
        } finally {
            graphics.end();
        }
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, bitmap, 0, 0, null, null, false);
    previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    previewControl.updateCoord = function (point){
        setCoordText(point);
        setTitle();
    };
    previewControl.onCustomPaintScope = this;
    previewControl.onCustomPaint = function (viewport, translateX, translateY, scale, x0, y0, x1, y1){
        drawSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.addCtrlClickListener(ctrlClickListener);
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
    refCheckBox.toolTip = "Display either the reference or target background.";
    refCheckBox.checked = selectedBitmap === REF;
    refCheckBox.onClick = function (checked) {
        selectedBitmap = checked ? REF : TGT;
        bitmap = getBitmap(selectedBitmap);
        previewControl.updateBitmap(bitmap);
        previewControl.forceRedraw();
    };
    
    let sampleStarGrowthRate_Control;
    let sampleControls = new NsgSampleControls;
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     */
    function finalUpdateFunction(){
        self.enabled = false;
        processEvents();
        updateSampleGrid();
        self.enabled = true;
        processEvents();
    }
    
    // ===================================================
    // SectionBar: Sample rejection
    // ===================================================
    let strLen = this.font.width("Star circle growth rate:");
    let limitSampleStarsPercent_Control = 
                sampleControls.createLimitSampleStarsPercentControl(this, data, strLen);
    limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
        nsgDialog.limitSampleStarsPercent_Control.setValue(value);
        previewControl.forceRedraw();
    };
    limitSampleStarsPercent_Control.enabled = !data.useAutoSampleGeneration;
    addFinalUpdateListener(limitSampleStarsPercent_Control, finalUpdateFunction);
    
    controlsHeight += limitSampleStarsPercent_Control.height;
        
    sampleStarGrowthRate_Control =
                sampleControls.createSampleStarGrowthRateControl(this, data, strLen);
    sampleStarGrowthRate_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRate = value;
        nsgDialog.sampleStarGrowthRate_Control.setValue(value);
        previewControl.forceRedraw();
    };
    addFinalUpdateListener(sampleStarGrowthRate_Control, finalUpdateFunction);
    sampleStarGrowthRate_Control.enabled = !data.useAutoSampleGeneration;
    
    controlsHeight += sampleStarGrowthRate_Control.height + 
            limitSampleStarsPercent_Control.height + 
            sampleStarGrowthRate_Control.height;
    
    let rejectSamplesSection = new Control(this);
    rejectSamplesSection.sizer = new VerticalSizer;
    rejectSamplesSection.sizer.spacing = 2;
    rejectSamplesSection.sizer.add(limitSampleStarsPercent_Control);
    rejectSamplesSection.sizer.add(sampleStarGrowthRate_Control);
    let rejectSamplesBar = new SectionBar(this, "Sample Rejection");
    rejectSamplesBar.setSection(rejectSamplesSection);
    rejectSamplesBar.onToggleSection = this.onToggleSection;
    rejectSamplesBar.toolTip = "Reject samples that are too close to bright stars";
    controlsHeight += rejectSamplesBar.height + 2;
    // SectionBar "Sample Rejection" End

    // ===================================================
    // SectionBar: Manual Sample Rejection
    // ===================================================
    let strLenCircle = this.font.width("Circle #:");
    let radius = MANUAL_RADIUS;
    let ctrlClickToolTip = "<p><b>Ctrl click</b> on an undetected star to add a manual rejection circle.</p>";
    let nthCircle_toolTip = "<p>Indicates which circle is currently selected (1 to N).</p>" + ctrlClickToolTip;
    let nthCircle_Label = new Label();
    nthCircle_Label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
    nthCircle_Label.text = "Circle #:";
    nthCircle_Label.toolTip = nthCircle_toolTip;
    nthCircle_Label.minWidth = strLenCircle;
    let nthCircle_Text = new Label();
    nthCircle_Text.frameStyle = FrameStyle_Sunken;
    nthCircle_Text.textAlignment = TextAlign_VertCenter;
    nthCircle_Text.toolTip = nthCircle_toolTip;
    
    let toStart_Button = new ToolButton(this);
    toStart_Button.icon = this.scaledResource(":/arrows/arrow-left-limit.png");
    toStart_Button.toolTip = "<p>Move to the first rejection circle.</p>" + ctrlClickToolTip;
    toStart_Button.onClick = function () {
        setNthCircleEntry(0, true);
    };
    let previous_Button = new ToolButton(this);
    previous_Button.icon = this.scaledResource(":/arrows/arrow-left.png");
    previous_Button.toolTip = "<p>Move to the previous rejection circle.</p>" + ctrlClickToolTip;
    previous_Button.onClick = function () {
        let n = selectedCircleIdx;
        if (n > 0){
            setNthCircleEntry(n - 1, true);
        }
    };
    let next_Button = new ToolButton(this);
    next_Button.icon = this.scaledResource(":/arrows/arrow-right.png");
    next_Button.toolTip = "<p>Move to the next rejection circle.</p>" + ctrlClickToolTip;
    next_Button.onClick = function () {
        let n = selectedCircleIdx;
        setNthCircleEntry(n + 1, true);
    };
    let toEnd_Button = new ToolButton(this);
    toEnd_Button.icon = this.scaledResource(":/arrows/arrow-right-limit.png");
    toEnd_Button.toolTip = "<p>Move to the last rejection circle.</p>" + ctrlClickToolTip;
    toEnd_Button.onClick = function () {
        setNthCircleEntry(data.manualRejectionCircles.length - 1, true);
    };
    let delete_Button = new ToolButton(this);
    delete_Button.icon = this.scaledResource(":/file-explorer/delete.png");
    delete_Button.toolTip = "<p>Delete the currently selected manual rejection circle.</p>";
    delete_Button.enabled = false;
    delete_Button.onClick = function () {
        data.manualRejectionCircles.splice(selectedCircleIdx, 1);
        setNthCircleEntry(data.manualRejectionCircles.length - 1, true); // -1 === no selection
        finalUpdateFunction();
    };
    let finish_Button = new ToolButton(this);
    finish_Button.icon = this.scaledResource(":/icons/ok.png");
    finish_Button.toolTip = "<p>Clears the current selection.</p>";
    finish_Button.onClick = function () {
        setNthCircleEntry(-1, false);
    };
    
    let toolbarSizer = new HorizontalSizer(this);
    toolbarSizer.spacing = 4;
    toolbarSizer.add(nthCircle_Label);
    toolbarSizer.add(nthCircle_Text);
    toolbarSizer.addSpacing(6);
    toolbarSizer.add(toStart_Button);
    toolbarSizer.addSpacing(6);
    toolbarSizer.add(previous_Button);
    toolbarSizer.addSpacing(6);
    toolbarSizer.add(next_Button);
    toolbarSizer.addSpacing(6);
    toolbarSizer.add(toEnd_Button);
    toolbarSizer.addSpacing(14);
    toolbarSizer.add(delete_Button);
    toolbarSizer.addSpacing(6);
    toolbarSizer.add(finish_Button);
    toolbarSizer.addStretch();
    
    let radiusText = "Radius:";
    let radiusTextLen = this.font.width(radiusText);
    let maxWidth = this.logicalPixelsToPhysical(1000);
    
    let radius_Control = new NumericControl(this);
    radius_Control.real = false;
    radius_Control.label.text = radiusText;
    radius_Control.label.minWidth = strLenCircle;
    radius_Control.label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
    radius_Control.maxWidth = Math.max(radiusTextLen + 50, maxWidth);
    radius_Control.toolTip = "<p>Rejection circle radius.</p>" + ctrlClickToolTip;
    radius_Control.setRange(3, MAX_CIRCLE_RADIUS);
    radius_Control.slider.setRange(3, MAX_CIRCLE_RADIUS);
    radius_Control.onValueUpdated = function (value) {
        let idx = selectedCircleIdx;
        if (idx !== -1){
            data.manualRejectionCircles[idx].radius = value;
            previewControl.forceRedraw();
        }
    };
    addFinalUpdateListener(radius_Control, finalUpdateFunction);

    let manualSampleRejectionSection = new Control(this);
    manualSampleRejectionSection.sizer = new VerticalSizer;
    manualSampleRejectionSection.sizer.spacing = 2;
    manualSampleRejectionSection.sizer.add(toolbarSizer);
    manualSampleRejectionSection.sizer.add(radius_Control);
    let manualSampleRejectionBar = new SectionBar(this, "Manual Sample Rejection");
    manualSampleRejectionBar.setSection(manualSampleRejectionSection);
    manualSampleRejectionBar.onToggleSection = this.onToggleSection;
    manualSampleRejectionBar.toolTip = 
        "<p>The star detection can fail to detect very bright saturated stars, " +
        "or stars too close to the image edge. " +
        "This section provides the ability to add manual rejection circles around problem stars.</p>" +
        ctrlClickToolTip;
    controlsHeight += manualSampleRejectionBar.height;
    
    /**
     * Add Manual rejection circle
     * @param {Point} point
     * @param {type} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    function ctrlClickListener(point, button, buttonState, modifiers){
        data.manualRejectionCircles.push(new ManualRejectionCircle(point.x, point.y, radius));
        setNthCircleEntry(data.manualRejectionCircles.length - 1, false);
        finalUpdateFunction();
    }
    
    /**
     * Set "Circle #:" label
     */
    function setSelectedCircleLabel(){
        let nEntries = data.manualRejectionCircles.length;
        nthCircle_Text.text = "" + (selectedCircleIdx + 1) + " / " + nEntries;
    }
    
    /**
     * Select the nth manual rejection circle, and scroll it to the center
     * @param {Number} idx
     * @param {Boolean} scrollToCenter
     */
    function setNthCircleEntry(idx, scrollToCenter){
        let nEntries = data.manualRejectionCircles.length;
        if (idx >= -1 && idx < nEntries){
            if (idx !== -1){
                let entry = data.manualRejectionCircles[idx];
                radius_Control.setValue(entry.radius);
                if (scrollToCenter){
                    let x = entry.x * previewControl.scale;
                    let y = entry.y * previewControl.scale;
                    previewControl.scrollbox.horizontalScrollPosition = Math.max(0, x - previewControl.width / 2);
                    previewControl.scrollbox.verticalScrollPosition = Math.max(0, y - previewControl.height / 2);
                }
            } else {
                radius_Control.setValue(0);
            }
            selectedCircleIdx = idx;
            setSelectedCircleLabel();
            radius_Control.enabled = idx > -1;
            toStart_Button.enabled = idx > 0;
            previous_Button.enabled = idx > 0;
            next_Button.enabled = idx < nEntries - 1;
            toEnd_Button.enabled = idx < nEntries - 1;
            delete_Button.enabled = idx !== -1;
            finish_Button.enabled = idx !== -1;
        }
        previewControl.forceRedraw();
    }
    
    setNthCircleEntry(-1, false);
    
    // SectionBar "Manual Sample Rejection" End

    // ===================================================
    // SectionBar: Samples
    // ===================================================
    let sampleSize_Control = sampleControls.createSampleSizeControl(this, data, 0);
    sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
        nsgDialog.sampleSize_Control.setValue(value);
    };
    addFinalUpdateListener(sampleSize_Control, finalUpdateFunction);
    
    sampleSize_Control.enabled = !data.useAutoSampleGeneration;
//    controlsHeight += sampleSize_Control.height;

    let minSamplesText = data.maxSamples - 500;
    let optSamplesText = data.maxSamples - 100;
    let nSamples_toolTip = "<p>The total number of unrejected samples.</p>" +
            "The optimum number of samples is between " + minSamplesText + " and " + data.maxSamples + 
            ". If there are more than " + data.maxSamples + 
            ", the samples will be binned before being used to create the surface spline. " +
            "It is good practice to leave some headroom " +
            "(for example, less than or equal to " + optSamplesText + " samples) " +
            "because the number of samples will vary between the target images.<p>" +
            "<p>Modify the Sample size to change the number of samples.</p>";
    let nSamples_Label = new Label( this );
    nSamples_Label.toolTip = nSamples_toolTip;
    nSamples_Label.text = "Samples:";
    nSamples_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let nSamplesControl = new Label(this);
    nSamplesControl.frameStyle = FrameStyle_Sunken;
    nSamplesControl.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    nSamplesControl.toolTip = nSamples_toolTip;
    nSamplesControl.setMinWidth(this.font.width("99999"));
    nSamplesControl.text = binRects.length.toString();

    let sampleGenerationSection = new Control(this);
    sampleGenerationSection.sizer = new HorizontalSizer;
    sampleGenerationSection.sizer.spacing = 5;
    sampleGenerationSection.sizer.add(sampleSize_Control, 100);
    sampleGenerationSection.sizer.addSpacing(10);
    sampleGenerationSection.sizer.add(nSamples_Label, 0);
    sampleGenerationSection.sizer.add(nSamplesControl, 0);
    sampleGenerationSection.sizer.addStretch(0);

    let sampleGenerationBar = new SectionBar(this, "Number of samples");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    sampleGenerationBar.toolTip = "Specifies generate samples settings";
    controlsHeight += sampleGenerationBar.height;
    // SectionBar "Sample Rejection" End
    
    /**
     * Create a new SampleGrid from the updated parameters, and draw it 
     * on top of the background bitmap within the scrolled window.
     */
    function updateSampleGrid(){
        binRects = getBinRects();
        previewControl.forceRedraw();
        nSamplesControl.text = binRects.length.toString();
    }
    
    let autoCheckBox = new CheckBox(this);
    autoCheckBox.text = "Auto";
    autoCheckBox.toolTip = "<p>Calculates default values for most of the Sample Generation parameters.</p>" +
            "<p>These are calculated from the headers:" +
            "<ul><li><b>'XPIXSZ'</b> (Pixel size, including binning, in microns)</li>" +
            "<li><b>'FOCALLEN'</b> (Focal length in mm).</li></p>";
    autoCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        data.setSampleGenerationAutoValues(checked, true);
        if (checked){
            sampleStarGrowthRate_Control.setValue(data.sampleStarGrowthRate);
            sampleSize_Control.setValue(data.sampleSize);
            limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);
            processEvents();
            updateSampleGrid();
        }
        self.enabled = true;
        processEvents();
        sampleStarGrowthRate_Control.enabled = !checked;
        sampleSize_Control.enabled = !checked;
        limitSampleStarsPercent_Control.enabled = !checked;
    };
    autoCheckBox.checked = data.useAutoSampleGeneration;
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(autoCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();
    
    controlsHeight += refCheckBox.height;

    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(sampleGenerationBar);
    this.sizer.add(sampleGenerationSection);
    this.sizer.add(rejectSamplesBar);
    this.sizer.add(rejectSamplesSection);
    this.sizer.add(manualSampleRejectionBar);
    this.sizer.add(manualSampleRejectionSection);
    this.sizer.add(previewControl.getButtonSizer());
    
    if (data.useAutoSampleGeneration){
        rejectSamplesSection.hide();
    }

    controlsHeight += this.sizer.spacing * 6 + this.sizer.margin * 2;

    let rect = new NsgDialogSizes().get(data, "SampleGrid");
    this.resize(rect.width, rect.height);
    setTitle();
    previewControl.updateZoom(-100, null);
}

/**
 * 
 * @param {Number} x
 * @param {Number} y
 * @param {Number} radius
 * @returns {ManualRejectionCircle}
 */
function ManualRejectionCircle (x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
}

/**
 * Draw rejection circles around stars
 * @param {Graphics} graphics
 * @param {Number} penWidth 
 * @param {NsgData} data
 * @param {Star[]) allStars
 * @param {Number} selectedCircleIdx Selected manual circle or -1
 */
function drawRejectionCircles(graphics, penWidth, data, allStars, selectedCircleIdx){
// Draw circles around the stars used to reject grid sample squares
    let firstNstars;
    if (data.limitSampleStarsPercent < 100){
        firstNstars = Math.floor(allStars.length * data.limitSampleStarsPercent / 100);
    } else {
        firstNstars = allStars.length;
    }
    let origAntialiasing = graphics.antialiasing;
    graphics.antialiasing = true;
    let red =   0xffff0000;
    let green = 0xff00ff00;
    graphics.pen = new Pen(red, penWidth);
    for (let i = 0; i < firstNstars; ++i){
        let star = allStars[i];
        let radius = calcSampleStarRejectionRadius(star, data, data.sampleStarGrowthRate);
        graphics.strokeCircle(star.pos.x, star.pos.y, radius);
    }
    let selectedWidth = Math.max(2, penWidth * 2);
    for (let i = 0; i < data.manualRejectionCircles.length; i++){
        let circle = data.manualRejectionCircles[i];
        if (i === selectedCircleIdx){
            // Draw circle on top, with thicker line to contrast against unselected.
            graphics.pen = new Pen(green, selectedWidth);
        }
        graphics.strokeCircle(circle.x, circle.y, circle.radius);
        if (i === selectedCircleIdx){
            graphics.pen = new Pen(red, penWidth);
        }
    }
    graphics.antialiasing = origAntialiasing;
}

SampleGridDialog.prototype = new Dialog;
