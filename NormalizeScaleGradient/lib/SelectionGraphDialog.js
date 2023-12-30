/* global UndoFlag_NoSwapFile, Dialog, StdButton_No, StdIcon_Question, StdButton_Cancel, StdButton_Yes, PhotometryControls, nsgTgtResults, compareResultObsDate, File, TextAlign_Right, TextAlign_VertCenter, compareResultWeight, FrameStyle_Sunken, DEFAULT_MIN_WEIGHT, DEFAULT_MIN_SCALE */

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
 * @param {NsgData} data
 * @returns {ImageRejectionData}
 */
function ImageRejectionData (data){
    function ExternalRef (filename, exposure){
        this.filename = filename;
        this.weight = 1.0;
        this.scale = 1.0;
        this.exposure = exposure;
    }
    this.displayNweight = false;
    let self = this;
    let allHaveExposure = true;
    let externalRef;
    const results = [];
    for (let tf of data.targetFiles){
        if (nsgTgtResults.has(tf)){
            // Exclude extra results that no longer correspond to a target image.
            results.push(nsgTgtResults.get(tf));
        }
    }
    results.sort(compareResultObsDate);
    
    for (let result of results){
        if (!result.headerEntries || !result.headerEntries.EXPOSURE){
            allHaveExposure = false;
            break;
        }
    }
    
    let maxWeight = 0;
    let maxScale = 0;
    let maxWeightDivTime = 0;
    let maxScaleDivTime = 0;
    let refFilename = data.cache.getRefFilename();
    if (refFilename && !nsgTgtResults.has(refFilename)){
        // Scale against a ref that was not included in the target list
        let headerEntries = getHeaderEntries(refFilename);
        if (!headerEntries || !headerEntries.EXPOSURE){
            allHaveExposure = false;
        }
        let t = allHaveExposure ? headerEntries.EXPOSURE : 1.0;
        externalRef = new ExternalRef(refFilename, t);
        maxWeightDivTime = 1.0 / t;
        maxWeight = 1.0;
        maxScaleDivTime = 1.0 / t;
        maxScale = 1.0;
    }
    
    for (let result of results){
        let t = allHaveExposure ? result.headerEntries.EXPOSURE : 1.0;
        maxWeightDivTime = Math.max(maxWeightDivTime, result.weight / t);
        maxWeight = Math.max(maxWeight, result.weight);
        let avgScale = avgTransmission(result.scaleFactors);
        maxScaleDivTime = Math.max(maxScaleDivTime, avgScale / t);
        maxScale = Math.max(maxScale, avgScale);
    }
    
    this.length = results.length;
    this.isExposureCompensated = allHaveExposure;
    
    /** Relative weight, divided by time if all images have exposure data.
     * @param {Result} result
     * @returns {Number}
     */
    function relativeWeight(result){
        if (allHaveExposure){
            return (result.weight / result.headerEntries.EXPOSURE) / maxWeightDivTime;
        }
        return result.weight / maxWeight;
    }
    
    /** Relative scale, divided by time if all images have exposure data.
     * @param {Result} result
     * @returns {Number}
     */
    function relativeScale(result){
        if (allHaveExposure){
            return (avgTransmission(result.scaleFactors) / result.headerEntries.EXPOSURE) / maxScaleDivTime;
        }
        return avgTransmission(result.scaleFactors) / maxScale;
    }
    
    /**
     * Sorts the results according to the supplied comparison function
     * @param {Compare function} sortFunction
     */
    this.setSortOrder = function (sortFunction){
        results.sort(sortFunction);
    };
    
    /**
     * @param {Number} index Index of -1 indicates external reference image.
     * @returns {String} Filename (full path)
     */
    this.getImageName = function (index) {
        if (index === -1){
            return externalRef ? externalRef.filename : "";
        }
        return results[index].inputFile;
    };
    
    /**
     * @param {Number} index Index within results array.
     * @returns {Number} Exposure compensated weight divided by maximum weight.
     */
    this.getRelativeWeight = function (index){
        return relativeWeight(results[index]);
    };
    
    /**
     * @param {Number} index
     * @returns {Number} Returned value is proportional to NWEIGHT
     */
    this.getWeight = function (index){
        let result = results[index];
        if (allHaveExposure){
            let refExposure;
            if (externalRef){
                refExposure = externalRef.exposure;
            } else {
                let refResult = nsgTgtResults.get(data.cache.getRefFilename());
                refExposure = refResult.headerEntries.EXPOSURE;
            }
            return (result.weight / refExposure) / maxWeightDivTime;
        }
        return result.weight / maxWeight;
    };
    
    /**
     * @param {Number} index Index within results array.
     * @returns {Number} Exposure compensated scale factor divided by maximum scale factor.
     */
    this.getRelativeScale = function (index){
        return relativeScale(results[index]);
    };
    
    /**
     * @param {Number} index Must be within range zero to N results - 1
     * @returns {Boolean} True if this is the reference image
     */
    this.isReference = function (index){
        return results[index].isRef;
    };
    
    /**
     * Returns the external reference weight, divided by its exposure, relative to the maximum weight.
     * @returns {Number|undefined}
     */
    this.getExternalRefWeight = function(){
        if (externalRef){
            if (allHaveExposure){
                return (externalRef.weight / externalRef.exposure) / maxWeightDivTime;
            }
            return externalRef.weight / maxWeight;
        }
        return undefined;
    };
    
    /**
     * Returns the external reference scale, divided by its exposure, relative to the maximum scale.
     * @returns {Number|undefined}
     */
    this.getExternalRefScale = function(){
        if (externalRef){
            if (allHaveExposure){
                return (externalRef.scale / externalRef.exposure) / maxScaleDivTime;
            }
            return externalRef.scale / maxScale;
        }
        return undefined;
    };
    
    /**
     * @param {Result} result
     * @param {NsgData} data
     * @returns {Boolean} True if this image is less than or equal to minimum weight or minimum scale.
     */
    this.isRejected = function (result, data){
        return relativeWeight(result) <= data.minimumWeight || relativeScale(result) <= data.minimumScale;
    };
    
    /**
     * @param {NsgData} data
     * @param {String} subFolderName
     * @returns {Set} rejected input filenames
     */
    this.moveRejectedTargets = function (data, subFolderName){
        let rejectedFiles = new Set();
        for (let result of results){
            if (self.isRejected(result, data) && !result.isRef){
                console.writeln("\nMoving ", File.extractName(result.inputFile), ":");
                moveFile(result.inputFile, subFolderName, "Input image->");
                rejectedFiles.add(result.inputFile);
                if (data.addDrizzleFiles){
                    let drizzleFile = File.changeExtension( result.inputFile, ".xdrz" );
                    if (File.exists(drizzleFile)){
                        moveFile(drizzleFile, subFolderName, "Drizzle    ->");
                    }
                }
                if (data.createXnml){
                    moveFile(result.LNFile, subFolderName, "L.Norm file->");
                }
                if (data.writeNormalized){
                    moveFile(result.normalizedFile, subFolderName, "Normalized ->");
                }
            }
        }
        console.noteln("Moved ", rejectedFiles.size, " images to ./", subFolderName);
        return rejectedFiles;
    };
}

/**
 * Display graph of Transmission or Weight against observation date.
 * @param {NsgData} data Values from user interface
 * @param {NsgDialog} nsgDialog
 */
function displaySelectionGraph(data, nsgDialog){
    let graphBitmapLum;
    let graphData;
    const weightCutLineColor = 0xFFFF0000;
    const scaleCutLineColor = 0xFF2255FF;
    
    {   // Constructor
        graphData = new ImageRejectionData(data);
        
        let maxWidth = data.smallScreen ? 1000 : 1800;
        let graphHeight = data.smallScreen ? data.graphHeight - 300 : data.graphHeight;
        let graphWidth = Math.round(data.graphWidth * (data.targetFiles.length + 2) / 20);
        graphWidth = Math.min(Math.max(300, graphWidth), maxWidth);
        let height = nsgDialog.logicalPixelsToPhysical(graphHeight);
        let width = nsgDialog.logicalPixelsToPhysical(graphWidth);
        
        // Display graph in script dialog
        let graphDialog = new SelectionGraphDialog(width, height, data, graphData, nsgDialog, createZoomedGraph);
        graphDialog.execute();

        // Help the garbage collector
        graphDialog = null;
        if (graphBitmapLum){
            graphBitmapLum.clear();
            graphBitmapLum = null;
        }
        graphData = undefined;
    }
    
    /**
     * Callback function for GraphDialog to create a graph.
     * GraphDialog uses Graph.getGraphBitmap() and the function pointer Graph.screenToWorld
     * @param {Number} factor
     * @param {Number} width
     * @param {Number} height
     * @param {Boolean} displayWeights display weights or scale
     * @param {Number} cutWeightFraction Weight graph: Draw horizontal 'cut off' line at this Y value.
     * @param {Number} cutScaleFraction Scale graph: Draw horizontal 'cut off' line at this Y value.
     * @returns {Graph, Number[]}
     */
    function createZoomedGraph(factor, width, height, displayWeights, cutWeightFraction, cutScaleFraction){
        let yAnnotation = displayWeights ? "Weight / Maximum weight" : "Transmission / Maximum transmission";
        let graph = createGraph("nth image", yAnnotation, width, height, 
            graphData, factor, displayWeights, cutWeightFraction, cutScaleFraction);
        return graph;
    }
    
    /**
     * Draw graph lines and points for a single color
     * @param {Graph} graph
     * @param {Number} lineColor e.g. 0xAARRGGBB
     * @param {GraphData} graphData
     * @param {Boolean} displayWeights
     * @param {Number} pointColor e.g. 0xAARRGGBB
     * @param {Number} cutWeightFraction Weight graph: Draw horizontal 'cut off' line at this Y value.
     * @param {Number} cutScaleFraction Scale graph: Draw horizontal 'cut off' line at this Y value.
     * @returns {undefined}
     */
    function drawLineAndPoints(graph, lineColor, graphData, displayWeights, pointColor, 
            cutWeightFraction, cutScaleFraction){
        let x0;
        let y0;
        for (let i=0; i<graphData.length; i++){
            let x = i + 1;
            let y;
            if (displayWeights){
                y = graphData.getRelativeWeight(i);
            } else {
                y = graphData.getRelativeScale(i);
            }
            if (i>0){
                graph.drawSimpleLine(x0, y0, x, y, lineColor, 1.5, true);
            }
            x0 = x;
            y0 = y;
        }
        for (let i=0; i<graphData.length; i++){
            let x = i + 1;
            let yw = graphData.getRelativeWeight(i);
            let ys = graphData.getRelativeScale(i);
            let y = displayWeights ? yw : ys;
            if (graphData.displayNweight && displayWeights){
                let rawWeight = graphData.getWeight(i);
                if (rawWeight !== y){
                    graph.drawPlus(x, rawWeight, lineColor);
                }
            }
            if (yw > cutWeightFraction && ys > cutScaleFraction){
                if (graphData.isReference(i)){
                    graph.drawCross(x, y, 0xFF00FF00);
                } else {
                    graph.drawPlus(x, y, pointColor);
                }
            } else {
                let crossColor;
                if (displayWeights){
                    crossColor = (yw <= cutWeightFraction) ? weightCutLineColor : scaleCutLineColor;
                } else {
                    crossColor = (ys <= cutScaleFraction) ? scaleCutLineColor : weightCutLineColor;
                }
                graph.drawCross(x, y, crossColor);
            }
        }
        if (displayWeights){
            let y = graphData.getExternalRefWeight();
            if (y !== undefined){
                graph.drawCross(0, y, 0xFF00FF00);
            }
        } else {
            let y = graphData.getExternalRefScale();
            if (y !== undefined){
                graph.drawCross(0, y, 0xFF00FF00);
            }
        }
        let lineX0 = 0;
        let lineX1 = graphData.length;
        if (displayWeights){
            let y = cutWeightFraction;
            graph.drawSimpleLine(lineX0, y, lineX1, y, weightCutLineColor, 0, false);
        } else {
            let y = cutScaleFraction;
            graph.drawSimpleLine(lineX0, y, lineX1, y, scaleCutLineColor, 0, false);
        }
    };
    
    /**
     * @param {Number} zoomFactor floating point zoom factor (for example, 0.5, 1, 2.0)
     * @returns {GraphDimensions}
     */
    function calcGraphDimensions(zoomFactor){
        // Assume most likely case of zoom = 1.0
        let minY = 0;
        let maxY = 1.0001;
        if (zoomFactor < 1){
            maxY = 1 / zoomFactor;      // Zoom of 0.5 gives range from 0.0 to 2.0
        } else if (zoomFactor > 1){
            minY = 1 - 1 / zoomFactor;  // Zoom of 4 give range from 0.75 to 1.0001
        }
        return new GraphDimensions(0, minY, data.targetFiles.length, maxY, true);       
    }
    
    /**
     * @param {String} xAxisLabel
     * @param {String} yAxisLabel
     * @param {Number} width 
     * @param {Number} height
     * @param {GraphData} graphData
     * @param {Number} zoomFactor
     * @param {Boolean} displayWeights display weights or scale
     * @param {Number} cutWeightFraction Weight graph: Draw horizontal 'cut off' line at this Y value.
     * @param {Number} cutScaleFraction Scale graph: Draw horizontal 'cut off' line at this Y value.
     * @returns {Graph}
     */
    function createGraph(xAxisLabel, yAxisLabel, width, height, graphData, zoomFactor, displayWeights,
            cutWeightFraction, cutScaleFraction){

        if (!graphBitmapLum || graphBitmapLum.width !== width || graphBitmapLum.height !== height){
            if (graphBitmapLum){
                graphBitmapLum.clear();
            }
            graphBitmapLum = new Bitmap(width, height);
        }

        // Create the graph axis and annotation. Zoom is created by calcGraphDimensions()
        let graphWithAxis = new Graph(calcGraphDimensions(zoomFactor), xAxisLabel, yAxisLabel, graphBitmapLum, 1, 1);

        // Now add the data to the graph...
        drawLineAndPoints(graphWithAxis, 0xFF777777, graphData, displayWeights, 0xFFFFFFFF, 
                cutWeightFraction, cutScaleFraction);
        return graphWithAxis;
    }
}

/**
 * Create a dialog that displays a graph.
 * The Graph object is created and updated by the supplied object: createZoomedGraph.
 * The Graph object returned from these functions must include the methods:
 * Bitmap Graph.getGraphBitmap()
 * String Graph.screenToWorld(Number x, Number y)
 * The GraphDialog is initialised with the Graph returned from createZoomedGraph, 
 * with a zoom factor of 1
 * @param {Number} width Dialog window width
 * @param {Number} height Dialog window height
 * @param {NsgData} data Values from user interface
 * @param {ImageRejectionData} imageRejectionData
 * @param {NsgDialog} nsgDialog
 * @param {Graph function({Number} zoom, {Number} w, {Number} h, {Number} channel, {Boolean} smallPoints, {Boolean} reCalc)} createZoomedGraph
 * Callback function used
 * to create a zoomed graph
 * @returns {SelectionGraphDialog}
 */
function SelectionGraphDialog(width, height, data, imageRejectionData, nsgDialog, createZoomedGraph)
{
    this.__base__ = Dialog;
    this.__base__();
    
    const results = [];
    for (let tf of data.targetFiles){
        if (nsgTgtResults.has(tf)){
            // Exclude extra results that no longer correspond to a target image.
            results.push(nsgTgtResults.get(tf));
        }
    }
    
    let self = this;
    let zoom_ = 1;
    let displayWeights = false;
    let createZoomedGraph_ = createZoomedGraph;
    let graph_ = createZoomedGraph_(zoom_, width, height, displayWeights, data.minimumWeight, data.minimumScale);
    
    /**
     * Sets window title to "title 1:1 Scale ( r, g, b ) ( x, y)".
     * The coordinate is omitted if x and y are not supplied.
     * @param {Number} x Bitmap x coordinate (optional)
     * @param {Number} y Bitmap y coordinate (optional)
     */
    function updateTitle(x, y){
        let title = displayWeights ? "Weight " : "Transmission ";
        let str;
        if (imageRejectionData.isExposureCompensated){
            str = title + "(Exposure compensated) " + getZoomString();
        } else {
            str = title + getZoomString();
        }
        if (x !== undefined){
            let resultIdx = Math.round(graph_.screenToWorldX(x)) - 1;
            if (resultIdx >= -1 && resultIdx < imageRejectionData.length){
                let inputFile = File.extractName(imageRejectionData.getImageName(resultIdx));
                str += "  " + inputFile;
            }
        }
        self.windowTitle = str;
    }
    
    // Draw bitmap into this component
    let bitmapControl = new Control(this);
    
    bitmapControl.onPaint = function (){
        let g;
        try {
            g = new Graphics(this);
            g.clipRect = new Rect(0, 0, this.width, this.height);
            g.drawBitmap(0, 0, graph_.getGraphBitmap());
        } catch (e) {
            logError(e);
        } finally {
            g.end();
        }
    };
    
    bitmapControl.onMousePress = function ( x, y, button, buttonState, modifiers ){
        // Display graph coordinates in title bar
        updateTitle(x, y);
    };
    
    bitmapControl.onMouseMove = function ( x, y, buttonState, modifiers ){
        // When dragging mouse, display graph coordinates in title bar
        updateTitle(x, y);
    };
    
    bitmapControl.onMouseWheel = function ( x, y, delta, buttonState, modifiers ){
        if (delta < 0){
            updateZoom( zoom_ + 1);
        } else {
            updateZoom( zoom_ - 1);
        }
    };
    
    bitmapControl.onResize = function (wNew, hNew, wOld, hOld) {
        update(wNew, hNew);
    };
    
    /**
     * @param {Number} zoom
     */
    function updateZoom (zoom) {
        if (zoom < 101 && zoom > -10){
            zoom_ = zoom;
            update(bitmapControl.width, bitmapControl.height);
            updateTitle();
        }
    }
    
    /**
     * @param {Number} width Graph bitmap width (
     * @param {Number} height Graph bitmap height
     */
    function update(width, height){
        try {
            graph_ = createZoomedGraph_(getZoomFactor(), width, height, displayWeights, data.minimumWeight, data.minimumScale);
            updateTitle();
            bitmapControl.repaint();    // display the zoomed graph bitmap
        } catch (e) {
            logError(e);
        }
    }
    
    /**
     * If zoom_ is positive, return zoom_ (1 to 100)
     * If zoom_ is zero or negative, then:
     * 0 -> 1/2
     * -1 -> 1/3
     * -2 -> 1/4
     * -98 -> 1/100
     * @returns {Number} Zoom factor
     */
    function getZoomFactor(){
        return zoom_ > 0 ? zoom_ : 1 / (2 - zoom_);
    }
    
    /**
     * @returns {String} Zoom string (e.g. " 1:2")
     */
    function getZoomString(){
        let zoomFactor = getZoomFactor();
        if (zoomFactor < 1){
            return " 1:" + Math.round(1/zoomFactor);
        } else {
            return " " + zoomFactor + ":1";
        }
    }
    
    bitmapControl.toolTip = 
            "Mouse wheel: Zoom" +
            "\nLeft click: Display filename in title bar";
    
    bitmapControl.setMinHeight(142);
    
    // ========================================
    // User controls
    // ========================================
    let controlsHeight = 0;
    let minHeight = bitmapControl.minHeight;
    
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            if (bar.isExpanded()){
                bitmapControl.setMinHeight(bitmapControl.height + bar.section.height + 2);
            } else {
                bitmapControl.setMinHeight(bitmapControl.height - bar.section.height - 2);
            }
            this.adjustToContents();
        }  else {
            bitmapControl.setMinHeight(minHeight);
            let maxDialogHeight = self.logicalPixelsToPhysical(1150);
            if (self.height > maxDialogHeight)
                self.resize(self.width, maxDialogHeight);
        }
    };
    
    // ===========================
    // Zoom controls and OK button
    // ===========================
    let zoomIn_Button = new ToolButton(this);
    zoomIn_Button.icon = this.scaledResource(":/icons/zoom-in.png");
    zoomIn_Button.setScaledFixedSize(24, 24);
    zoomIn_Button.toolTip = "Zoom In";
    zoomIn_Button.onMousePress = function (){
        updateZoom( zoom_ + 1);
    };

    let zoomOut_Button = new ToolButton(this);
    zoomOut_Button.icon = this.scaledResource(":/icons/zoom-out.png");
    zoomOut_Button.setScaledFixedSize(24, 24);
    zoomOut_Button.toolTip = "Zoom Out";
    zoomOut_Button.onMousePress = function (){
        updateZoom( zoom_ - 1);
    };

    let zoom11_Button = new ToolButton(this);
    zoom11_Button.icon = this.scaledResource(":/icons/zoom-1-1.png");
    zoom11_Button.setScaledFixedSize(24, 24);
    zoom11_Button.toolTip = "Zoom 1:1";
    zoom11_Button.onMousePress = function (){
        updateZoom( 1 );
    };
    
    let update_Button = new PushButton();
    update_Button.text = "Refresh";
    update_Button.toolTip = "<p>Forces the display to refresh.</p>" +
            "<p>(The display usually refreshes automatically)</p>";
    update_Button.defaultButton = true;
    update_Button.onClick = function(){
        update(bitmapControl.width, bitmapControl.height);
    };
    
    let ok_Button = new PushButton(this);
    ok_Button.text = "OK";
    ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
    ok_Button.onClick = function(){
        let et = calcExposureTime(data);
        console.noteln("Unrejected images:      ", et.n + " / " + et.nTotal);
        console.noteln("Total exposure time:    ", calcTimeText(et.timeSec, et.timeSecTotal));
        console.noteln("Weighted exposure time: ", calcTimeText(et.weightedSec, et.weightedSecTotal));
        self.ok();
    };

    let zoomButton_Sizer = new HorizontalSizer(this);
    zoomButton_Sizer.margin = 0;
    zoomButton_Sizer.spacing = 4;
    zoomButton_Sizer.add(zoomIn_Button);
    zoomButton_Sizer.add(zoomOut_Button);
    zoomButton_Sizer.add(zoom11_Button);
    zoomButton_Sizer.addSpacing(10);
    zoomButton_Sizer.add(update_Button);
//    zoomButton_Sizer.add(liveUpdate_control);
    zoomButton_Sizer.addStretch();
    zoomButton_Sizer.add(ok_Button);
    zoomButton_Sizer.addSpacing(10);
    controlsHeight += ok_Button.height;
    
    // ===========================
    // Color toggles
    // ===========================
    let weightRadioButton = new RadioButton(this);
    weightRadioButton.text = "Weight";
    weightRadioButton.toolTip = "<p>Display the weight graph.</p>" +
            "<p>The displayed weight is adjusted for exposure time. " +
            "These exposure scaled weights represent the sky conditions. " +
            "We want to reject images that were badly affected by light pollution or clouds, " +
            "but we don't want to reject images just because they had a shorter exposure.</p>" +
            "<p>There are several reasons we reject based on sky conditions. Light pollution usually " +
            "includes gradients, which may become difficult to remove. " +
            "High levels of light pollution also tend to reveal flat field errors.</p>" +
            "<p>If the only problem with an image is its lower SNR, then " +
            "it will still improve the final integrated image SNR. " +
            "This works because NSG uses a very accurate 'SNR squared' weight algorithm.</p>";
    weightRadioButton.checked = displayWeights;
    weightRadioButton.onClick = function (checked) {
        displayWeights = checked;
        enableControls();
        update(bitmapControl.width, bitmapControl.height);
//        displayNweightCheckbox.enabled = checked;
    };
    
    let scaleRadioButton = new RadioButton(this);
    scaleRadioButton.text = "Transmission";
    scaleRadioButton.toolTip = "<p>Display the transmission graph.</p>" + 
            "<p>A drop in atmospheric transmission indicates clouds. " +
            "A sudden large drop in transmission indicates passing clouds; " +
            "these images should be rejected.</p>";
    scaleRadioButton.checked = !displayWeights;
    scaleRadioButton.onClick = function (checked) {
        displayWeights = !checked;
        enableControls();
        update(bitmapControl.width, bitmapControl.height);
//        displayNweightCheckbox.enabled = !checked;
    };
    
    let sortOrder_Label = new Label( this );
    sortOrder_Label.text = "Sort order:";
    sortOrder_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let sortOrderComboBox = new ComboBox( this );
    sortOrderComboBox.addItem("DATE-OBS");
    sortOrderComboBox.addItem("Altitude");
    sortOrderComboBox.toolTip = "<p>Horizontal axis: Image sort order.</p>" +
            "<p>Use <b>DATE-OBS</b> to show how conditions changed over time.</p>" +
            "<p>Use <b>Weight</b> to match the console summary sort order.</p>" +
            "<p>If sky transparency is stable, sorting by <b>Altitude</b> " +
            "will show how transmission changed with increasing airmass. " +
            "Note that if the object is at a high altitude, the airmass will be almost constant.</p>";
    sortOrderComboBox.onItemSelected = function ( itemIndex ){
        try {
            let sortOrder = (itemIndex === 1) ? compareResultAirmass : compareResultObsDate;
            imageRejectionData.setSortOrder(sortOrder);
            finalUpdateFunction();
        } catch (exception){
            logError(exception);
        }
    };
    
//    let displayNweightCheckbox = new CheckBox(this);
//    displayNweightCheckbox.text = "Display NWEIGHT";
//    displayNweightCheckbox.toolTip = "<p>Display NWEIGHT points on the graph. " +
//        "These points represent the contribution each image will make to the stacked image.</p>" +
//        "<p>The NWEIGHT values may be scaled differently to the values displayed in the console. " +
//        "This is allowed because weights are relative; it's their ratio that's important.</p>" +
//        "<p>If all images have the same exposure, the NWEIGHT points will coincide with the " +
//        "exposure scaled points, and will be hidden beneath them.</p>" +
//        "<p>Note that the exposure scaled weights represent the sky conditions. " +
//        "We want to reject images that were badly affected by light pollution or clouds, " +
//        "and not reject images just because they had a shorter exposure.</p>" +
//        "<p>It may be necessary to zoom out to see all the NWEIGHT points.</p>";
//    displayNweightCheckbox.checked = imageRejectionData.displayNweight;
//    displayNweightCheckbox.enabled = displayWeights;
//    displayNweightCheckbox.onClick = function (checked) {
//        imageRejectionData.displayNweight = checked;
//        finalUpdateFunction();
//    };
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     */
    function finalUpdateFunction(){
        update(bitmapControl.width, bitmapControl.height);
    }

    // ===================================================
    // SectionBar: Image rejection
    // ===================================================
    const MINIMUM_WEIGHT_STRLEN = this.font.width("Minimum transmission:");
    let selectionControls = new NsgRejectionControls();
    function updateMinimumWeight(value){
        data.minimumWeight = value;
        nsgDialog.minimumWeight_Control.setValue(value);
        self.setExposureTime(data);
        update(bitmapControl.width, bitmapControl.height);
    }
    let minimumWeight_Control = selectionControls.createMinimumWeightControl(this, data, MINIMUM_WEIGHT_STRLEN);
    minimumWeight_Control.onValueUpdated = function (value) {
        updateMinimumWeight(value);
    };
    addFinalUpdateListener(minimumWeight_Control, finalUpdateFunction);
    
    let minimumWeight_Reset = new ToolButton(this);
    minimumWeight_Reset.icon = this.scaledResource(":/icons/reload.png");
    minimumWeight_Reset.toolTip = "<p>Reset minimum weight to default.</p>";
    minimumWeight_Reset.onClick = function(){
        updateMinimumWeight(DEFAULT_MIN_WEIGHT);
        minimumWeight_Control.setValue(data.minimumWeight);
    };
    
    let weightSizer = new HorizontalSizer(this);
    weightSizer.spacing = 5;
    weightSizer.add(minimumWeight_Control, 100);
    weightSizer.add(minimumWeight_Reset, 0);
    weightSizer.addStretch(0);
    
    function updateMinimumScale(value){
        data.minimumScale = value;
        nsgDialog.minimumScale_Control.setValue(value);
        self.setExposureTime(data);
        update(bitmapControl.width, bitmapControl.height);
    }
    
    let minimumScale_Control = selectionControls.createMinimumScaleControl(this, data, MINIMUM_WEIGHT_STRLEN);
    minimumScale_Control.onValueUpdated = function (value) {
        updateMinimumScale(value);
    };
    addFinalUpdateListener(minimumScale_Control, finalUpdateFunction);
        
    let minimumScale_Reset = new ToolButton(this);
    minimumScale_Reset.icon = this.scaledResource(":/icons/reload.png");
    minimumScale_Reset.toolTip = "<p>Reset minimum transmission to default.</p>";
    minimumScale_Reset.onClick = function(){
        updateMinimumScale(DEFAULT_MIN_SCALE);
        minimumScale_Control.setValue(data.minimumScale);
    };
    
    let scaleSizer = new HorizontalSizer(this);
    scaleSizer.spacing = 5;
    scaleSizer.add(minimumScale_Control, 100);
    scaleSizer.add(minimumScale_Reset, 0);
    scaleSizer.addStretch(0);

    function enableControls(){
        minimumScale_Control.enabled = !displayWeights;
        minimumWeight_Control.enabled = displayWeights;
    }
    enableControls();
//    controlsHeight += minimumWeight_Control.height;

    let nImages_Label = new Label( this );
    nImages_Label.text = "Images:";
    nImages_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let nImagesTextBox = new Label( this );
    nImagesTextBox.frameStyle = FrameStyle_Sunken;
//    nImagesTextBox.textAlignment = TextAlign_VertCenter;
    nImagesTextBox.enabled = false;
    nImagesTextBox.toolTip = "<p>Number of unrejected image / Total number of images.</p>" +
            "<p>The reference image is excluded if it isn't in the target images list.</p>";
    
    let time_Label = new Label( this );
    time_Label.text = "Time:";
    time_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let timeTextBox = new Label( this );
    timeTextBox.frameStyle = FrameStyle_Sunken;
//    timeTextBox.textAlignment = TextAlign_VertCenter;
    timeTextBox.enabled = false;
    timeTextBox.toolTip = "Total exposure time for all unrejected images.\n" + 
            "Total exposure time for all images.";
    
    let weightedTime_Label = new Label( this );
    weightedTime_Label.text = "Weighted:";
    weightedTime_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let weightedTimeTextBox = new Label( this );
    weightedTimeTextBox.frameStyle = FrameStyle_Sunken;
//    weightedTimeTextBox.textAlignment = TextAlign_VertCenter;
    weightedTimeTextBox.enabled = false;
    weightedTimeTextBox.toolTip = "Total weighted exposure time for all unrejected images.\n" + 
            "Total weighted exposure time for all images.\n\n" +
            "The exposure times of each image is multiplied by that image's relative weight.\n" +
            "The relative weight is the image's weight divided by the maximum weight.";
    
    /**
     * Get the number of unrejected image / total number, exposure / total exposure, weighted exposure / total weighted
     * @param {NsgData} data
     * @returns {n:, nTotal:, timeSec:, timeSecTotal:, weightedSec:, weightedSecTotal:}
     */
    function calcExposureTime (data){
        let maxWeight = 1;      // maxWeight can never be less than 1.0 (might be 'external' ref image)
        let n = 0;
        let nTotal = results.length;  // does not include 'external' ref image
        let timeSec = 0;
        let timeSecTotal = 0;
        let weightedSec = 0;
        let weightedSecTotal = 0;
        for (let result of results){
            let t = result.headerEntries.EXPOSURE;
            if (t){
                timeSecTotal += t;
                weightedSecTotal += t * result.weight;
            }
            maxWeight = Math.max(maxWeight, result.weight);
            if (!imageRejectionData.isRejected(result, data)){
                if (t){
                    timeSec += t;
                    weightedSec += t * result.weight;
                }
                n++;
            }
        }
        return {n: n, nTotal: nTotal, 
            timeSec: timeSec, timeSecTotal: timeSecTotal, 
            weightedSec: weightedSec/maxWeight, weightedSecTotal: weightedSecTotal/maxWeight};
    }
    /**
     * @param {Number} seconds
     * @returns {String} Example: "2h 53m"
     */
    function calcTime(seconds){
        let hours = Math.floor(seconds / 3600);
        let minutes = Math.round((seconds - hours * 3600) / 60);
        return "" + hours + "h " + minutes + "m";
    }
    /**
     * @param {Number} seconds
     * @param {Number} totalSeconds
     * @returns {String} Example: "2h 53m / 3h 5m"
     */
    function calcTimeText(seconds, totalSeconds){
        return calcTime(seconds) + " / " + calcTime(totalSeconds);
    }
    
    /**
     * Update exposure text boxes to account for rejected images.
     * @param {NsgData} data
     */
    this.setExposureTime = function (data){
        let et = calcExposureTime(data);
        nImagesTextBox.text = "" + et.n + " / " + et.nTotal;
        timeTextBox.text = calcTimeText(et.timeSec, et.timeSecTotal);
        weightedTimeTextBox.text = calcTimeText(et.weightedSec, et.weightedSecTotal);
    };
    this.setExposureTime(data);
    
    let exposureGroupBox = new GroupBox(this);
    exposureGroupBox.title = "Total exposure time";
    exposureGroupBox.sizer = new HorizontalSizer;
    exposureGroupBox.sizer.margin = 2;
    exposureGroupBox.sizer.spacing = 2;
    exposureGroupBox.sizer.add(nImages_Label);
    exposureGroupBox.sizer.add(nImagesTextBox);
    exposureGroupBox.sizer.addSpacing(8);
    exposureGroupBox.sizer.add(time_Label);
    exposureGroupBox.sizer.add(timeTextBox);
    exposureGroupBox.sizer.addSpacing(8);
    exposureGroupBox.sizer.add(weightedTime_Label);
    exposureGroupBox.sizer.add(weightedTimeTextBox);
    exposureGroupBox.sizer.addStretch();
    
    let selectionSection = new Control(this);
    selectionSection.sizer = new VerticalSizer;
    selectionSection.sizer.spacing = 2;
    selectionSection.sizer.add(scaleSizer);
    selectionSection.sizer.add(weightSizer);
    selectionSection.sizer.add(exposureGroupBox);
    selectionSection.sizer.addSpacing(5);
    let selectionBar = new SectionBar(this, "Image rejection");
    selectionBar.setSection(selectionSection);
    selectionBar.onToggleSection = this.onToggleSection;
    selectionBar.toolTip = "<p>Discard images with weights below the specified value.</p>";
    controlsHeight += selectionBar.height + selectionSection.sizer.spacing + 5;
    
    let color_Sizer = new HorizontalSizer(this);
    color_Sizer.margin = 0;
    color_Sizer.spacing = 10;
    color_Sizer.addSpacing(4);
    color_Sizer.add(scaleRadioButton);
    color_Sizer.add(weightRadioButton);
    color_Sizer.addSpacing(20);
    color_Sizer.add(sortOrder_Label);
    color_Sizer.add(sortOrderComboBox);
    color_Sizer.addStretch();
//    color_Sizer.add(displayNweightCheckbox);
//    color_Sizer.addSpacing(4);
    
    controlsHeight += weightRadioButton.height;
    
    //-------------
    // Global sizer
    //-------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(bitmapControl, 100);
    this.sizer.add(color_Sizer);
    this.sizer.add(selectionBar);
    this.sizer.add(selectionSection);
    this.sizer.add(zoomButton_Sizer);
    
    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 5;
    
    this.userResizable = true;
    let preferredWidth = width + this.sizer.margin * 2;
    let preferredHeight = height + controlsHeight - 22;
    this.resize(preferredWidth, preferredHeight);
    this.setScaledMinSize(480, 300);
    updateTitle();
}

/**
 * Sort in ascending airmass order (or NSG input filename, full path)
 * @param {Result} a
 * @param {Result} b
 * @returns {Number}
 */
function compareResultAirmass(a, b){
    if (a.headerEntries.AIRMASS && b.headerEntries.AIRMASS){
        return a.headerEntries.AIRMASS - b.headerEntries.AIRMASS;
    }
    if (a.headerEntries.ALTITUDE && b.headerEntries.ALTITUDE){
        return b.headerEntries.ALTITUDE - a.headerEntries.ALTITUDE;
    }
    if (a.inputFile < b.inputFile){
        return -1;
    }
    if (a.inputFile > b.inputFile){
        return 1;
    }
    return 0;
}

SelectionGraphDialog.prototype = new Dialog;