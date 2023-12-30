/* global UndoFlag_NoSwapFile, Dialog, StdButton_No, StdIcon_Question, StdButton_Cancel, StdButton_Yes, DEFAULT_AUTOSTRETCH_SCLIP, DEFAULT_AUTOSTRETCH_TBGND, DEFAULT_GRADIENT_SMOOTHNESS, MANUAL_RADIUS, TextAlign_VertCenter, FrameStyle_Sunken, MAX_CIRCLE_RADIUS, MouseButton_Left, button, KeyModifier_Control */

// Version 1.0 (c) John Murphy 12th-Aug-2020
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
 * Create a dialog that displays a graph.
 * The Graph object returned from the supplied createZoomedGradientGraph(Number zoomFactor) 
 * function must include the methods:
 * Bitmap Graph.getGraphBitmap()
 * String Graph.screenToWorld(Number x, Number y)
 * The GraphDialog is initialised with the Graph returned from createZoomedGradientGraph, 
 * with a zoom factor of 1
 * @param {NsgData} data
 * @param {Boolean} isColor
 * @param {Graph function({Number} zoomFactor, {Number} width, {Number} height, {Number} channel)} createZoomedGradientGraph
 * @param {Image createCorrectedTgtImage()} createCorrectedTgtImage Create a corrected target image
 * Callback function used to create a zoomed graph
 * @param {NsgDialog} nsgDialog
 * @param {Rect} sampleGridBoundingRect 
 * @returns {GradientGraphDialog}
 */
function GradientGraphDialog(data, isColor, createZoomedGradientGraph, createCorrectedTgtImage, nsgDialog,
        sampleGridBoundingRect)
{
    /** Applies a scale and offset to make the tgt image match the reference image.
     * @param {NsgData} data
     * @param {BitmapData} refBitmapData
     * @param {BitmapData} tgtBitmapData
     */
    function normalizeScaleAndOffset(data, refBitmapData, tgtBitmapData){
        let nChannels = data.cache.isColor() ? 3 : 1;
        let colorStarPairs = getColorStarPairs(nChannels, data);
        let scaleFactors = getScaleFactors(colorStarPairs, data);
        let tgtScale = linearFitDataArrayToScaleArray(scaleFactors);
        let refBg = refBitmapData.calcImageMedian();
        tgtBitmapData.normalizeScaleOffset(refBg, tgtScale);
    }
    this.__base__ = Dialog;
    this.__base__();
    let self = this;
    let stfShadows = DEFAULT_AUTOSTRETCH_SCLIP;
    let stfStretch = DEFAULT_AUTOSTRETCH_TBGND;
    let selectedChannel_ = 3;
    let selectedCircleIdx = -1;
    let updateSampleGrid = false;
    let createZoomedGradientGraph_ = createZoomedGradientGraph;
    let image = data.cache.getRefImage();
    let halfImageWidth = Math.round(image.width / 2);
    let halfImageHeight = Math.round(image.height / 2);
    let graph_ = createZoomedGradientGraph_(1, 700, 700, selectedChannel_,
            data.isGradientLineHorizontal, 
            data.gradientLineX + halfImageWidth, 
            data.gradientLineY + halfImageHeight, updateSampleGrid);
    let displayingGraph = false;
    let displayingRejectionCircles = true;
    let displayingRefImage = false;
    let displayingCorrectedTgt = true;
    let refBitmapData = new BitmapData(data.cache.getRefImage());
    let tgtBitmapData = new BitmapData(new Image(data.cache.getTgtImage()));
    normalizeScaleAndOffset(data, refBitmapData, tgtBitmapData);
    let correctedTgtBitmapData = new BitmapData();
    let updateCorrectedTgtImageNeeded = true;
    let refHT = refBitmapData.calcHistogramTransform(stfShadows, stfStretch);
    tgtBitmapData.setHistogramTransform(refHT);
    correctedTgtBitmapData.setHistogramTransform(refHT);
    let displayedBitmap = refBitmapData.getBitmap(true);
    let savedImageZoom;
    let zoomText = "1:1";
    let allStars = data.cache.getRefStars(data.logStarDetection);
    
    /**
     * @param {String} appendText Append to title after zoom string (for example, cursor (x,y) position)
     */
    function setTitle(appendText){
        if (appendText){
            self.windowTitle = getTitle() + "  " + appendText;
        } else {
            self.windowTitle = getTitle();
        }
    }
    
    /**
     * @param {PreviewControl} previewControl
     * @returns {GradientGraphDialog.SavedImageZoom}
     */
    function SavedImageZoom(previewControl){
        let zoom = previewControl.zoom;
        let scrollX = previewControl.scrollbox.horizontalScrollPosition;
        let scrollY = previewControl.scrollbox.verticalScrollPosition;
        
        /**
         * Return to the zoom level and scroll position that existed at construction.
         */
        this.returnToZoom = function(){
            previewControl.updateZoom(zoom, null);
            previewControl.scrollbox.horizontalScrollPosition = scrollX;
            previewControl.scrollbox.verticalScrollPosition = scrollY;
        };
    }
    
    let previewControl = new PreviewControl(this, displayedBitmap, 0, 0, null, null, false);
    previewControl.updateZoomText = function (text){
        zoomText = text;
        setTitle();
    };
    previewControl.updateCoord = function (point){
        let x = Math.round(point.x);
        let y = Math.round(point.y);
        if (displayingGraph){
            setTitle(graph_.screenToWorld(x, y));
        } else {
            setTitle("(" + x + "," + y + ")");
        }
    };
    previewControl.onCustomPaintScope = this;
    previewControl.onCustomPaint = function (viewport, translateX, translateY, scale, x0, y0, x1, y1){
        drawOnBitmap(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.addDoubleClickListener(doubleClickListener);
    previewControl.addCtrlClickListener(ctrlClickListener);
    previewControl.setMinHeight(200);
    
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
    function drawOnBitmap(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        if (displayingGraph || !displayingRejectionCircles){
            return;
        }
        let g;
        try {
            g = new VectorGraphics(viewport);
            g.clipRect = new Rect(x0, y0, x1, y1);
            g.translateTransformation(translateX, translateY);
            g.scaleTransformation(scale, scale);
            g.pen = new Pen(0xffff0000);
            g.antialiasing = false;
            let x = data.gradientLineX + halfImageWidth;
            let y = data.gradientLineY + halfImageHeight;
            g.pen = data.isGradientLineHorizontal ? new Pen(0xff00ff00, 0.0) : new Pen(0xff008800, 0.0);
            g.drawLine( sampleGridBoundingRect.x0, y, sampleGridBoundingRect.x1 - 1, y );
            g.pen = data.isGradientLineHorizontal ? new Pen(0xff008800, 0.0) : new Pen(0xff00ff00, 0.0);
            g.drawLine( x, sampleGridBoundingRect.y0, x, sampleGridBoundingRect.y1 - 1);
            let penWidth = scale < 1 ? Math.round(1/scale) : 1;
            drawRejectionCircles(g, penWidth, data, allStars, selectedCircleIdx);
        } catch (e) {
            logError(e, "While drawing over gradient graph images");
        } finally {
            g.end();
        }
    }

    function doubleClickListener( clickX, clickY, buttonState, modifiers ){
        if (!displayingGraph){
            let x = Math.round(clickX);
            let y = Math.round(clickY);
            x = Math.min(x, control_X.upperBound);
            x = Math.max(x, control_X.lowerBound);
            y = Math.min(y, control_Y.upperBound);
            y = Math.max(y, control_Y.lowerBound);
            data.gradientLineX = x - halfImageWidth;
            data.gradientLineY = y - halfImageHeight;
            control_X.setValue(x);
            control_Y.setValue(y);
            update();
        }
    };

    
    previewControl.onResize = function (wNew, hNew, wOld, hOld) {
        if (displayingGraph)
            update();
    };
    
    function update(){
        try {
            if (displayingGraph){
                let width = previewControl.scrollbox.viewport.width;
                let height = previewControl.scrollbox.viewport.height;
                graph_ = createZoomedGradientGraph_(1, width, height, selectedChannel_, 
                    data.isGradientLineHorizontal, 
                    data.gradientLineX + halfImageWidth, data.gradientLineY + halfImageHeight, updateSampleGrid);
                    updateSampleGrid = false;
                displayedBitmap = graph_.getGraphBitmap();
            } else if (displayingRefImage){
                displayedBitmap = refBitmapData.getBitmap(true);
            } else if (displayingCorrectedTgt){
                if (updateCorrectedTgtImageNeeded){
                    correctedTgtBitmapData.setImage(createCorrectedTgtImage(updateSampleGrid));
                    updateCorrectedTgtImageNeeded = false;
                    updateSampleGrid = false;
                }
                displayedBitmap = correctedTgtBitmapData.getBitmap(true);
            } else {
                displayedBitmap = tgtBitmapData.getBitmap(true);
            }
            if (previewControl.image.width !== displayedBitmap.width || 
                    previewControl.image.height !== displayedBitmap.height){
                previewControl.setImage(displayedBitmap);
            } else {
                previewControl.updateBitmap(displayedBitmap);
            }
            if (!displayingGraph && savedImageZoom !== undefined){
                // Previously displayed the graph at 1:1. Return to pre-graph zoom level.
                savedImageZoom.returnToZoom();
                savedImageZoom = undefined;
            }
            previewControl.forceRedraw();
        } catch (e) {
            logError(e, "During Graph update");
        }
    }
    
    /**
     * @returns {String} Zoom string (e.g. " 1:2")
     */
    function getTitle(){
        if (displayingGraph){
            return "Gradient Graph ";
        } else if (displayingRefImage){
            return "Reference image " + zoomText;
        } else if (displayingCorrectedTgt){
            return "Target image (corrected for scale and gradient) " + zoomText;
        } else {
            return "Target image " + zoomText;
        }
    }
    
    // ========================================
    // User controls
    // ========================================
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
            this.adjustToContents();
        }  else {
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
    function finalGraphUpdateFunction(){
        self.enabled = false;
        processEvents();
        try {
            update();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    }
    
    function finalSmoothnessUpdateFunction(){
        self.enabled = false;
        processEvents();
        try {
            updateCorrectedTgtImageNeeded = true;
            update();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    }
    
    function finalStfUpdateFunction(){
        self.enabled = false;
        processEvents();
        try {
            let refHT = refBitmapData.calcHistogramTransform(stfShadows, stfStretch);
            tgtBitmapData.setHistogramTransform(refHT);
            correctedTgtBitmapData.setHistogramTransform(refHT);
            update();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    }
    
    function finalRejectionCircleUpdateFunction(){
        self.enabled = false;
        processEvents();
        try {
            updateCorrectedTgtImageNeeded = true;
            updateSampleGrid = true;
            update();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    }
    
    // Gradient controls
    let labelMinLength = this.font.width(" Horizontal gradient line: y =");
    let gradientControls = new NsgGradientControls();
    let smoothnessControl = gradientControls.createGradientSmoothnessControl(this, data, 0);
    smoothnessControl.onValueUpdated = function (value) {
        data.gradientSmoothness = value;
        nsgDialog.gradientSmoothness_Control.setValue(value);
    };
    smoothnessControl.slider.minWidth = 300;
    addFinalUpdateListener(smoothnessControl, finalSmoothnessUpdateFunction);
    
    let gradientSmoothness_Reset = new ToolButton(this);
    gradientSmoothness_Reset.icon = this.scaledResource(":/icons/reload.png");
    gradientSmoothness_Reset.toolTip = "<p>Reset gradient smoothness to default.</p>";
    gradientSmoothness_Reset.onClick = function(){
        data.gradientSmoothness = DEFAULT_GRADIENT_SMOOTHNESS;
        smoothnessControl.setValue(data.gradientSmoothness);
        nsgDialog.gradientSmoothness_Control.setValue(data.gradientSmoothness);
        finalSmoothnessUpdateFunction();
    };

    let directionToggle = new CheckBox(this);
    directionToggle.text = "Vertical";
    directionToggle.toolTip = "<p>If selected, display the gradient along a vertical line.</p>" +
            "<p>If not selected, display the gradient along a horizontal line.</p>";
    directionToggle.checked = !data.isGradientLineHorizontal;
    directionToggle.onClick = function (checked) {
        data.isGradientLineHorizontal = !checked;
        self.enabled = false;
        processEvents();
        update();
        self.enabled = true;
        processEvents();
        control_Y.enabled = data.isGradientLineHorizontal;
        control_X.enabled = !data.isGradientLineHorizontal;
    };
    
    let graphCheckBox = new CheckBox(this);
    graphCheckBox.text = "Graph";
    graphCheckBox.toolTip = "Display the graph instead of the image.";
    graphCheckBox.checked = displayingGraph;
    graphCheckBox.onClick = function (checked) {
        self.enableGraphSection(checked);
        self.enabled = false;
        processEvents();
        try {
            update();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    };
    
    let refCheckBox = new CheckBox(this);
    refCheckBox.text = "Reference";
    refCheckBox.toolTip = "<p>Display either reference or target image.</p>" +
            "<p>If 'Correct target (scale and gradient)' is checked, the " +
            "reference check box can be used to blink between the reference image " +
            "and the corrected target image. Decrease 'Gradient smoothness' until " +
            "a good match is found.</p>";
    refCheckBox.checked = displayingRefImage;
    refCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        try {
            displayingRefImage = checked;
            update();
            setTitle();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    };
    
    let correctedTgtCheckBox = new CheckBox(this);
    correctedTgtCheckBox.text = "Gradient corrected target";
    correctedTgtCheckBox.toolTip = "<p>Apply scale and gradient corrections to the target view.</p>" +
            "<p>Use the 'Reference' checkbox to blink between the reference image and the corrected target.</p>" +
            "<p>Use this checkbox to blink between the uncorrected and corrected target.</p>";
    correctedTgtCheckBox.checked = displayingCorrectedTgt;
    correctedTgtCheckBox.onClick = function (checked) {
        self.enabled = false;
        processEvents();
        try {
            displayingCorrectedTgt = checked;
            refCheckBox.checked = false;
            displayingRefImage = false;
            update();
            setTitle();
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
            processEvents();
        }
    };
    
    let rejectionCircleCheckBox = new CheckBox(this);
    rejectionCircleCheckBox.text = "Rejection circles and graph lines";
    rejectionCircleCheckBox.toolTip = 
            "<p>Display sample rejection circles and the horizontal / vertical graph lines.</p>" +
            "<p>The graph displays the gradient along either the horizontal or vertical line.</p>" +
            "<p>Double click on the image to position the horizontal and vertical lines.</p>";
    rejectionCircleCheckBox.checked = displayingRejectionCircles;
    rejectionCircleCheckBox.onClick = function (checked) {
        displayingRejectionCircles = checked;
        update();
    };
    
    /**
     * Sets the rejectionCircleCheckBox to checked, and sets displayingRejectionCircles to true.
     */
    function setRejectionCirclesOn(){
        if (!displayingRejectionCircles){
            displayingRejectionCircles = true;
            rejectionCircleCheckBox.checked = displayingRejectionCircles;
        }
    }
    
    // ===========================
    // Color toggles
    // ===========================
    let redRadioButton = new RadioButton(this);
    redRadioButton.text = "Red";
    redRadioButton.toolTip = "<p>Display the red channel gradient</p>" + 
            "<p>This is only used to declutter the display. " +
            "The 'Smoothness' setting will be applied to all color channels.</p>";
    redRadioButton.checked = false;
    redRadioButton.onClick = function (checked) {
        selectedChannel_ = 0;
        self.enabled = false;
        processEvents();
        update();
        self.enabled = true;
        processEvents();
    };
    
    let greenRadioButton = new RadioButton(this);
    greenRadioButton.text = "Green";
    greenRadioButton.toolTip = "<p>Display the green channel gradient</p>" + 
            "<p>This is only used to declutter the display. " +
            "The 'Smoothness' setting will be applied to all color channels.</p>";
    greenRadioButton.checked = false;
    greenRadioButton.onClick = function (checked) {
        selectedChannel_ = 1;
        self.enabled = false;
        processEvents();
        update();
        self.enabled = true;
        processEvents();
    };
    
    let blueRadioButton = new RadioButton(this);
    blueRadioButton.text = "Blue";
    blueRadioButton.toolTip = "<p>Display the blue channel gradient</p>" + 
            "<p>This is only used to declutter the display. " +
            "The 'Smoothness' setting will be applied to all color channels.</p>";
    blueRadioButton.checked = false;
    blueRadioButton.onClick = function (checked) {
        selectedChannel_ = 2;
        self.enabled = false;
        processEvents();
        update();
        self.enabled = true;
        processEvents();
    };
    
    let allRadioButton = new RadioButton(this);
    allRadioButton.text = "All";
    allRadioButton.toolTip = "Display the gradient for all channels";
    allRadioButton.checked = true;
    allRadioButton.onClick = function (checked) {
        selectedChannel_ = 3;
        self.enabled = false;
        processEvents();
        update();
        self.enabled = true;
        processEvents();
    };
    
    if (!isColor){
        redRadioButton.enabled = false;
        greenRadioButton.enabled = false;
        blueRadioButton.enabled = false;
    }

    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(refCheckBox);
    optionsSizer.add(correctedTgtCheckBox);
    optionsSizer.add(rejectionCircleCheckBox);
    optionsSizer.addSpacing(20);
    optionsSizer.add(graphCheckBox);
    optionsSizer.add(directionToggle);
    optionsSizer.addStretch();
    
    // =================================
    // SectionBar Gradient line position
    // =================================
    let control_Y = new NumericControl(this);
    control_Y.real = false;
    control_Y.label.text = "Horizontal gradient line: y =";
    control_Y.label.minWidth = labelMinLength;
    control_Y.toolTip = "<p>Display the gradient along the horizontal line at this y coordinate</p>";
    control_Y.setRange(sampleGridBoundingRect.y0, sampleGridBoundingRect.y1);
    control_Y.slider.setRange(sampleGridBoundingRect.y0, sampleGridBoundingRect.y1);
    control_Y.maxWidth = Math.max(this.logicalPixelsToPhysical(1000));
    control_Y.enabled = data.isGradientLineHorizontal;
    control_Y.setValue(data.gradientLineY + halfImageHeight);
    control_Y.onValueUpdated = function (value) {
        data.gradientLineY = value - halfImageHeight;
        update();
    };
    addFinalUpdateListener(control_Y, finalGraphUpdateFunction);
    
    let control_X = new NumericControl(this);
    control_X.real = false;
    control_X.label.text = "Vertical gradient line: x =";
    control_X.label.minWidth = labelMinLength;
    control_X.toolTip = "<p>Display the gradient along the vertical line at this x coordinate</p>";
    control_X.setRange(sampleGridBoundingRect.x0, sampleGridBoundingRect.x1);
    control_X.slider.setRange(sampleGridBoundingRect.x0, sampleGridBoundingRect.x1);
    control_X.maxWidth = Math.max(this.logicalPixelsToPhysical(1000));
    control_X.enabled = !data.isGradientLineHorizontal;
    control_X.setValue(data.gradientLineX + halfImageWidth);
    control_X.onValueUpdated = function (value) {
        data.gradientLineX = value - halfImageWidth;
        update();
    };
    addFinalUpdateListener(control_X, finalGraphUpdateFunction);
    
    this.enableGraphSection = function(checked){
        displayingGraph = checked;
        stfSection.enabled = !checked;
        refCheckBox.enabled = !checked;
        correctedTgtCheckBox.enabled = !checked;
        rejectionCircleCheckBox.enabled = !checked;
        redRadioButton.enabled = checked && isColor;
        greenRadioButton.enabled = checked && isColor;
        blueRadioButton.enabled = checked && isColor;
        allRadioButton.enabled = checked;
        previewControl.zoomIn_Button.enabled = !displayingGraph;
        previewControl.zoomOut_Button.enabled = !displayingGraph;
        if (displayingGraph){
            savedImageZoom = new SavedImageZoom(previewControl);
            previewControl.zoomInLimit = 1;
            previewControl.zoomOutLimit = 1;
        } else {
            previewControl.zoomInLimit = 2;
            previewControl.zoomOutLimit = -100;
        }
        setTitle();   // display zoom factor in title bar
    };
    
    let linePositionSection = new Control(this);
    linePositionSection.sizer = new VerticalSizer;
    linePositionSection.sizer.spacing = 2;
    linePositionSection.sizer.add(control_Y);
    linePositionSection.sizer.add(control_X);
    linePositionSection.sizer.addSpacing(5);
    let linePositionBar = new SectionBar(this, "Gradient Path");
    linePositionBar.setSection(linePositionSection);
    linePositionBar.onToggleSection = this.onToggleSection;
    linePositionBar.toolTip = 
        "<p>Specifies a line across the gradient surface spline. " +
        "The gradient along this line will be displayed in the graph.</p>";
    
    let graphSection = new Control(this);
    graphSection.sizer = new HorizontalSizer;
    graphSection.sizer.spacing = 10;
    graphSection.sizer.add(smoothnessControl);
    graphSection.sizer.add(gradientSmoothness_Reset);
    graphSection.sizer.addStretch(10);
    graphSection.sizer.add(redRadioButton);
    graphSection.sizer.add(greenRadioButton);
    graphSection.sizer.add(blueRadioButton);
    graphSection.sizer.add(allRadioButton);
    graphSection.sizer.addStretch(90);
    
    let graphBar = new SectionBar(this, "Gradient");
    graphBar.setSection(graphSection);
    graphBar.onToggleSection = this.onToggleSection;
    graphBar.toolTip = "<p>Specify the level of smoothing applied to the gradient correction.</p>";
    
    // ===================================================
    // SectionBar: Manual Sample Rejection
    // ===================================================
    let radius = MANUAL_RADIUS;
    let ctrlClickToolTip = "<p><b>Ctrl click</b> on an undetected star to add a manual rejection circle.</p>";
    let nthCircle_toolTip = "<p>Indicates which circle is currently selected (1 to N).</p>" + ctrlClickToolTip;
    let nthCircle_Label = new Label();
    nthCircle_Label.textAlignment = TextAlign_VertCenter;
    nthCircle_Label.text = "Circle #:";
    nthCircle_Label.toolTip = nthCircle_toolTip;
    let nthCircle_Text = new Label();
    nthCircle_Text.frameStyle = FrameStyle_Sunken;
    nthCircle_Text.textAlignment = TextAlign_VertCenter;
    nthCircle_Text.toolTip = nthCircle_toolTip;
    
    function displayManualRejectionCircleTip(){
        if (displayingCorrectedTgt && !displayingRefImage){
            console.noteln("\nTip: While making multiple 'Manual Rejection Circle' edits, " +
                "don't display the corrected target image; display the reference image instead. " +
                "The surface spline recalculation will then be deferred until it is needed.");
        }
    }
    
    let toStart_Button = new ToolButton(this);
    toStart_Button.icon = this.scaledResource(":/arrows/arrow-left-limit.png");
    toStart_Button.toolTip = "<p>Move to the first rejection circle.</p>" + ctrlClickToolTip;
    toStart_Button.onClick = function () {
        setRejectionCirclesOn();
        setNthCircleEntry(0, true);
    };
    let previous_Button = new ToolButton(this);
    previous_Button.icon = this.scaledResource(":/arrows/arrow-left.png");
    previous_Button.toolTip = "<p>Move to the previous rejection circle.</p>" + ctrlClickToolTip;
    previous_Button.onClick = function () {
        setRejectionCirclesOn();
        let n = selectedCircleIdx;
        if (n > 0){
            setNthCircleEntry(n - 1, true);
        }
    };
    let next_Button = new ToolButton(this);
    next_Button.icon = this.scaledResource(":/arrows/arrow-right.png");
    next_Button.toolTip = "<p>Move to the next rejection circle.</p>" + ctrlClickToolTip;
    next_Button.onClick = function () {
        setRejectionCirclesOn();
        let n = selectedCircleIdx;
        setNthCircleEntry(n + 1, true);
    };
    let toEnd_Button = new ToolButton(this);
    toEnd_Button.icon = this.scaledResource(":/arrows/arrow-right-limit.png");
    toEnd_Button.toolTip = "<p>Move to the last rejection circle.</p>" + ctrlClickToolTip;
    toEnd_Button.onClick = function () {
        setRejectionCirclesOn();
        setNthCircleEntry(data.manualRejectionCircles.length - 1, true);
    };
    let delete_Button = new ToolButton(this);
    delete_Button.icon = this.scaledResource(":/file-explorer/delete.png");
    delete_Button.toolTip = "<p>Delete the currently selected manual rejection circle.</p>";
    delete_Button.enabled = false;
    delete_Button.onClick = function () {
        setRejectionCirclesOn();
        displayManualRejectionCircleTip();
        data.manualRejectionCircles.splice(selectedCircleIdx, 1);
        setNthCircleEntry(data.manualRejectionCircles.length - 1, true);
        finalRejectionCircleUpdateFunction();
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
    let radiusTextLen = this.font.width(nthCircle_Label.text);
    let maxWidth = this.logicalPixelsToPhysical(1000);
    
    let radius_Control = new NumericControl(this);
    radius_Control.real = false;
    radius_Control.label.text = radiusText;
    radius_Control.label.minWidth = radiusTextLen;
    radius_Control.maxWidth = Math.max(radiusTextLen + 50, maxWidth);
    radius_Control.toolTip = "<p>Rejection circle radius.</p>" + ctrlClickToolTip;
    let maxRange = Math.min(MAX_CIRCLE_RADIUS, halfImageHeight);
    radius_Control.setRange(3, maxRange);
    radius_Control.slider.setRange(3, maxRange);
    radius_Control.onValueUpdated = function (value) {
        let idx = selectedCircleIdx;
        if (idx !== -1){
            data.manualRejectionCircles[idx].radius = value;
            if (!displayingGraph){  // Draw circles, but don't continuously update graph
                update();
            }
        }
    };
    // This updates the corrected target image or the graph
    addFinalUpdateListener(radius_Control, finalRejectionCircleUpdateFunction);

    let manualSampleRejectionSection = new Control(this);
    manualSampleRejectionSection.sizer = new VerticalSizer;
    manualSampleRejectionSection.sizer.spacing = 4;
    manualSampleRejectionSection.sizer.add(toolbarSizer);
    manualSampleRejectionSection.sizer.add(radius_Control);
    let manualSampleRejectionBar = new SectionBar(this, "Manual Sample Rejection (Ctrl + click to add)");
    manualSampleRejectionBar.setSection(manualSampleRejectionSection);
    manualSampleRejectionBar.onToggleSection = this.onToggleSection;
    manualSampleRejectionBar.toolTip = 
        "<p>The star detection can fail to detect very bright saturated stars, " +
        "or stars too close to the image edge. " +
        "This section provides the ability to add manual rejection circles around problem stars.</p>" +
        ctrlClickToolTip;
//    controlsHeight += manualSampleRejectionBar.height;
    
    /**
     * Add Manual rejection circle
     * @param {Point} point
     * @param {type} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    function ctrlClickListener(point, button, buttonState, modifiers){
        displayManualRejectionCircleTip();
        setRejectionCirclesOn();
        data.manualRejectionCircles.push(new ManualRejectionCircle(point.x, point.y, radius));
        setNthCircleEntry(data.manualRejectionCircles.length - 1);
        finalRejectionCircleUpdateFunction();
    }
    
    /**
     * Set "Circle #:" label
     */
    function setSelectedCircleLabel(){
        let nEntries = data.manualRejectionCircles.length;
        nthCircle_Text.text = "" + (selectedCircleIdx + 1) + " / " + nEntries;
    }
    
    /**
     * Select the nth manual rejection circle
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
        update();
    }
    
    setNthCircleEntry(-1, false);
    
    // SectionBar "Manual Sample Rejection" End
    
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
    addFinalUpdateListener(stfShadows_Control, finalStfUpdateFunction);
    
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
    addFinalUpdateListener(stfStretch_Control, finalStfUpdateFunction);
    
    let stf_Button = new ToolButton(this);
    stf_Button.icon = this.scaledResource(":/icons/burn.png");
    stf_Button.toolTip = "<p>Apply auto STF</p>";
    stf_Button.onClick = function(){
        stfShadows = DEFAULT_AUTOSTRETCH_SCLIP;
        stfStretch = DEFAULT_AUTOSTRETCH_TBGND;
        stfShadows_Control.setValue(stfShadows);
        stfStretch_Control.setValue(stfStretch);
        finalStfUpdateFunction();
    };
    
    let stfSection = new Control(this);
    stfSection.sizer = new HorizontalSizer;
    stfSection.sizer.margin = 2;
    stfSection.sizer.spacing = 8;
    stfSection.sizer.add(stfShadows_Control, 50);
    stfSection.sizer.add(stfStretch_Control, 50);
    stfSection.sizer.add(stf_Button);
    let stfBar = new SectionBar(this, "STF");
    stfBar.setSection(stfSection);
    stfBar.onToggleSection = this.onToggleSection;
    stfBar.toolTip = "<p>Specify the screen transfer function.</p>";
    
    previewControl.update_Button.defaultButton = true;
    previewControl.update_Button.onClick = function(){
        updateCorrectedTgtImageNeeded = true;
        finalStfUpdateFunction();
    };
    previewControl.ok_Button.onClick = function(){
        let image = tgtBitmapData.getImage();
        if (image){
            image.free();  
        }
        image = correctedTgtBitmapData.getImage();
        if (image){
            image.free();
        }
        // refBitmapData used the cached ref image, so don't release it here!
        self.ok();
    };
    
    //-------------
    // Global sizer
    //-------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl, 100);
    this.sizer.add(optionsSizer);
    this.sizer.add(linePositionBar);
    this.sizer.add(linePositionSection);
    this.sizer.add(graphBar);
    this.sizer.add(graphSection);
    this.sizer.add(manualSampleRejectionBar);
    this.sizer.add(manualSampleRejectionSection);
    this.sizer.add(stfBar);
    this.sizer.add(stfSection);
    this.sizer.add(previewControl.getButtonSizer());
    
    linePositionSection.hide();
    stfSection.hide();
    manualSampleRejectionSection.hide();
    
    let rect = new NsgDialogSizes().get(data, "GradientDialog");
    this.resize(rect.width, rect.height);
    
    this.setScaledMinSize(300, 300);
    setTitle();
    this.enableGraphSection(displayingGraph);
    previewControl.updateZoom(-100, null);
}

GradientGraphDialog.prototype = new Dialog;