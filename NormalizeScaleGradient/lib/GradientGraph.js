/* global StdButton_Yes, UndoFlag_NoSwapFile, MIN_GRADIENT_INC */

// Version 1.0 (c) John Murphy 8th-Oct-2020
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
 * Calculates maximum and minimum values for the sample points
 * @param {valueAtXY[][]} valueAtXYArrays ValueAtXY[] for each channel
 * @param {Number} minRange The range will be at least this big
 * @param {Number} zoomFactor Zoom in by modifying minDif and maxDif (smaller
 * range produces a more zoomed in view)
 * @param {Number} selectedChannel R=0, G=1, B=2, All=3
 * @returns {SamplePairDifMinMax}
 */
function SamplePairDifMinMax(valueAtXYArrays, minRange, zoomFactor, selectedChannel) {
    this.minDif = Number.POSITIVE_INFINITY;
    this.maxDif = Number.NEGATIVE_INFINITY;
    let values = [];
    for (let c=0; c<valueAtXYArrays.length; c++) {
        if (selectedChannel === 3 || selectedChannel === c){
            let valueAtXYArray = valueAtXYArrays[c];
            for (let valueAtXY of valueAtXYArray) {
                let dif = valueAtXY.value;
                values.push(dif);
                this.minDif = Math.min(this.minDif, dif);
                this.maxDif = Math.max(this.maxDif, dif);
            }
        }
    }
    
    let dataRange = this.maxDif - this.minDif;
    let range = Math.max(dataRange, minRange) / zoomFactor;
    if (range > dataRange){
        // All points fit on the graph. Provide equal space above and below.
        let space = (range - dataRange) / 2;
        this.maxDif += space;
        this.minDif -= space;
    } else if (range < dataRange){
        // The points don't all fit on the graph. Center on median value.
        let median = Math.median(values);
        let max = median + range / 2;
        let min = median - range / 2;
        if (this.maxDif < max){
            let dif = max - this.maxDif;
            max -= dif;
            min -= dif;
        } else if (this.minDif > min){
            let dif = this.minDif - min;
            max += dif;
            min += dif;
        }
        this.maxDif = max;
        this.minDif = min;
    }
}

/**
 * 
 * @param {ValueAtXY[][]} valuesOnPath Sorted by distance along gradient path
 * @param {Number} minRange
 * @returns {Number}
 */
function getNoiseRange(valuesOnPath, minRange){
    let rangeArray = [];
    for (let c=0; c<valuesOnPath.length; c++) {
        let valueAtXYArray = valuesOnPath[c];
        for (let i = 0; i < valueAtXYArray.length - 10; i += 10){
            let max = valueAtXYArray[i].value;
            let min = max;
            for (let j = 1; j<10; j++){
                let value = valueAtXYArray[i+j].value;
                max = Math.max(value, max);
                min = Math.min(value, min);
            }
            rangeArray.push(max - min);
        }
    }
    let range = rangeArray.length > 0 ? Math.max(Math.median(rangeArray), minRange) : minRange;
    return range;
}

/**
 * @param {Point} point 
 * @param {Number} value 
 * @returns {Point:point, Number:value}
 */
function ValueAtXY(point, value){
    return {point: point, value: value};
}

/**
 * Display graph of (difference between images) / (pixel distance across image)
 * @param {SamplePair[][]} colorSamplePairs The SamplePair points, corrected for scale
 * @param {NsgDialog} nsgDialog
 * @param {NsgData} data User settings used to create FITS header
 * @param {LinearFitData[]} scaleFactors
 * @returns {undefined}
 */
function GradientGraph(colorSamplePairs, nsgDialog, data, scaleFactors){
    let minScaleDif_ = 1e-9;
    let binnedColorSamplePairsCache_ = new Map();
    let surfaceSplinesCache_ = new Map();
    let graphBitmapLum;
    let graphBitmapRGB;
    let sampleGridBoundingRect;
    
    function construct(){
        sampleGridBoundingRect = calcSampleGridBoundingRect(colorSamplePairs);
        // Display graph in script dialog
        let isColor = colorSamplePairs.length > 1;
        let graphDialog = new GradientGraphDialog(data, isColor, 
                createZoomedGradientGraph, createCorrectedTgtImage, nsgDialog,
                new Rect(sampleGridBoundingRect));
        graphDialog.execute();
        (new NsgDialogSizes()).store("GradientDialog", graphDialog.width, graphDialog.height);
        
        // Dialog has closed. Clear cache
        graphDialog = null;
        for (let surfaceSpline of surfaceSplinesCache_.values()) {
            surfaceSpline.clear();
        }
        binnedColorSamplePairsCache_.clear();
        surfaceSplinesCache_.clear();
        if (graphBitmapLum){
            graphBitmapLum.clear();
            graphBitmapLum = null;
        }
        if (graphBitmapRGB){
            graphBitmapRGB.clear();
            graphBitmapRGB = null;
        }
    }
    
    /**
     * @param {SamplePair[][]} colorSamplePairs
     * @returns {Rect} Sample grid bounding box
     */
    function calcSampleGridBoundingRect(colorSamplePairs){
        let boundingRect;
        // Initialise the bounding rect to the first sample pair we find.
        const nChannels = colorSamplePairs.length;
        for (let c = 0; c < nChannels; c++) {
            if (colorSamplePairs[c].length > 0){
                boundingRect = new Rect(colorSamplePairs[c][0].rect);
                break;
            }
        }
        // Enlarge the bounding box to fit all sample pairs, in all channels
        for (let c = 0; c < nChannels; c++) {
            let samplePairs = colorSamplePairs[c];
            for (let samplePair of samplePairs){
                if (samplePair.rect.x0 < boundingRect.x0){
                    boundingRect.x0 = samplePair.rect.x0;
                }
                if (samplePair.rect.y0 < boundingRect.y0){
                    boundingRect.y0 = samplePair.rect.y0;
                }
                if (samplePair.rect.x1 > boundingRect.x1){
                    boundingRect.x1 = samplePair.rect.x1;
                }
                if (samplePair.rect.y1 > boundingRect.y1){
                    boundingRect.y1 = samplePair.rect.y1;
                }
            }
        }
        return boundingRect;
    }
    
    /**
     * @param {Number} selectedChannel R=0, G=1, B=2, All=3
     * @param {Number|undefined} smoothness If undefined, apply no smoothing.
     * @returns {SurfaceSpline[]}
     */
    function getSurfaceSplinesArray(selectedChannel, smoothness){
        let firstMsg = true;
        // === Binned sample pairs ===
        let bKey = calcMaxSamples(data, colorSamplePairs[0].length, smoothness);
        let bValue = binnedColorSamplePairsCache_.get(bKey);
        if (bValue === undefined){
            console.writeln("\n<b><u>Binning samples (max samples = " + bKey + ")</u></b> ");
            bValue = createColorBinnedSamplePairs(data, colorSamplePairs, smoothness);
            binnedColorSamplePairsCache_.set(bKey, bValue);
            if (bValue[0].length < colorSamplePairs[0].length){
                console.writeln("Reduced samples from ", colorSamplePairs[0].length, " to ", bValue[0].length);
            } else {
                console.writeln("Using ", colorSamplePairs[0].length, " samples");
            }
        }
        let binnedColorSamplePairs = bValue;
        let nChannels = binnedColorSamplePairs.length;
        
        // === SurfaceSplines ===
        let surfaceSplines = [];
        for (let c = 0; c < nChannels; c++) {
            if (selectedChannel === c || selectedChannel === 3){
                let smoothnessKey = smoothness !== undefined ? smoothness : "none";
                let key = "_" + smoothnessKey + "_" + c + "_";
                let value = surfaceSplinesCache_.get(key);
                if (value === undefined){
                    if (firstMsg){
                        console.writeln("\n<b><u>Calculating surface spline</u></b> ");
                        firstMsg = false;
                    }
                    let samplePairs = binnedColorSamplePairs[c];
                    value = calcSurfaceSpline(samplePairs, smoothness);
                    surfaceSplinesCache_.set(key, value);
                    console.writeln("Created surface spline [", c, "] smoothness ", 
                            smoothnessKey, " from ", samplePairs.length, " samples");
                }
                surfaceSplines[c] = value;
            } else {
                surfaceSplines[c] = null;
            }
        }
        return surfaceSplines;
    }
    
    /**
     * Callback function for GraphDialog to provide a zoomed graph.
     * GraphDialog uses Graph.getGraphBitmap() and the function pointer Graph.screenToWorld
     * @param {Number} zoomFactor
     * @param {Number} width
     * @param {Number} height
     * @param {Number} selectedChannel R=0, G=1, B=2, All=3
     * @param {Boolean} isHorizontal 
     * @param {Number} lineEqualX Specify path of vertical gradient line
     * @param {Number} lineEqualY Specify path of horizontal gradient line
     * @param {Boolean} updateSampleGrid Set to true if manual rejection circles have changed.
     * @returns {Graph}
     */
    function createZoomedGradientGraph(zoomFactor, width, height, selectedChannel, isHorizontal,
            lineEqualX, lineEqualY, updateSampleGrid){
        try {
            if (updateSampleGrid){
                updateColorSamplePairs();
            }
            let pointsSurfaceSplines = getSurfaceSplinesArray(selectedChannel); // No smoothing
            let surfaceSplines = getSurfaceSplinesArray(selectedChannel, data.gradientSmoothness);
            // === Create Graph
            // Using GradientGraph function call parameters
            let graph = createGraph(width, height, isHorizontal, surfaceSplines, pointsSurfaceSplines,
                    sampleGridBoundingRect, data, zoomFactor, selectedChannel, lineEqualX, lineEqualY);
            return graph;
        } catch (error){
            logError(error);
            return undefined;
        }
    }
    
    function updateColorSamplePairs(){
        // === Sample pairs ===
        binnedColorSamplePairsCache_.clear();
        surfaceSplinesCache_.clear();
        let sampleGrid = data.cache.getSampleGrid(data, data.cache.getTgtFilename());
        let stars = data.cache.getRefStars(data.logStarDetection);
        colorSamplePairs = sampleGrid.createColorScaledSamplePairs(stars, data, scaleFactors);
        sampleGridBoundingRect = calcSampleGridBoundingRect(colorSamplePairs);
    }
    
    /**
     * Creates a corrected target image
     * @param {Boolean} updateSampleGrid Set to true if manual rejection circles have changed.
     * @returns {Image}
     */
    function createCorrectedTgtImage(updateSampleGrid){
        if (updateSampleGrid){
            updateColorSamplePairs();
        }
        let tgtImage = data.cache.getTgtImage();
        let tgtRect = new Rect(tgtImage.width, tgtImage.height);
        let surfaceSplines = getSurfaceSplinesArray(3, data.gradientSmoothness);
        let gradientImages = [];
        
        for (let c=0; c<surfaceSplines.length; c++){
            gradientImages[c] = createGradientImage(tgtRect, false, surfaceSplines[c], MIN_GRADIENT_INC, true);
        }
        let tgtSamples = new Float32Array(tgtRect.area);
        let gradSamples = new Float32Array(tgtRect.area);
        let tgtImageCopy = new Image(tgtImage);
        for (let c=0; c<surfaceSplines.length; c++){
            correctTargetImage(tgtImageCopy, gradientImages, scaleFactors, tgtSamples, gradSamples, tgtRect, c);
            tgtImageCopy.truncate(); // Clip data to between 0.0 and 1.0
        }
        return tgtImageCopy;
    }
    
    /**
     * @param {Number} width
     * @param {Number} height
     * @param {Boolean} isHorizontal
     * @param {SurfaceSpline[]} surfaceSplines Difference between reference and target images
     * @param {SurfaceSpline[]} pointsSurfaceSplines Difference between reference and target images, no smoothing
     * @param {Rect} imageRect 
     * @param {NsgData} data User settings used to create FITS header
     * @param {Number} zoomFactor Zoom factor for vertical axis only zooming.
     * @param {Number} selectedChannel R=0, G=1, B=2, All=3
     * @param {Number} lineEqualX Specify path of vertical gradient line
     * @param {Number} lineEqualY Specify path of horizontal gradient line
     * @returns {Graph}
     */
    function createGraph(width, height, isHorizontal, surfaceSplines, pointsSurfaceSplines,
                imageRect, data, zoomFactor, selectedChannel, lineEqualX, lineEqualY){
        let xLabel = isHorizontal ? "X-coordinate" : "Y-coordinate";
        let yLabel = "(" + data.cache.getTgtName() + ") - (" + data.cache.getRefName() + ")";
        let valuesOnPath = getValuesAlongLine(pointsSurfaceSplines, isHorizontal, lineEqualX, lineEqualY);
        // Graph scale
        let minScaleDif = 7 * getNoiseRange(valuesOnPath, minScaleDif_);
        let yCoordinateRange = new SamplePairDifMinMax(valuesOnPath, minScaleDif, zoomFactor, selectedChannel);
        
        return createAndDrawGraph(xLabel, yLabel, yCoordinateRange, width, height,
                isHorizontal, lineEqualX, lineEqualY, 
                surfaceSplines, imageRect, valuesOnPath, selectedChannel);
    }
    
    /**
    * @param {Point} p
    * @param {Number} rejectionRadius
    */
    function RejectionCircle(p, rejectionRadius){
       const minX = p.x - rejectionRadius;
       const maxX = p.x + rejectionRadius;
       const minY = p.y - rejectionRadius;
       const maxY = p.y + rejectionRadius;
       const rSquared = rejectionRadius * rejectionRadius;
       /**
        * @param {Point} point
        * @returns {Boolean} True if the point or circle intersects with the rejection circle 
        */
       this.isInsideCircle = function(point){
           if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY){
               return false;
           }
           let xDif = point.x - p.x;
           let yDif = point.y - p.y;
           return xDif * xDif + yDif * yDif < rSquared;
       };
    }

    /**
    * Get all star and manual rejection circles
    * @param {NsgData} data
    * @returns {RejectionCircle[]}
    */
    function getAllRejectionCircles(data){
       // Star rejection circles
       let stars = data.cache.getRefStars(data.logStarDetection);
       let growthRate = data.sampleStarGrowthRate;
       let firstNstars;
       if (data.limitSampleStarsPercent < 100){
           firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
       } else {
           firstNstars = stars.length;
       }
       let rejectionCircles = [];
       for (let i=0; i<firstNstars; i++){
           let star = stars[i];
           let starRadius = calcSampleStarRejectionRadius(star, data, growthRate);
           rejectionCircles.push(new RejectionCircle(star.pos, starRadius));
       }

       // Manual Rejection Circles
       for (let circle of data.manualRejectionCircles){
           rejectionCircles.push(new RejectionCircle(new Point(circle.x, circle.y), circle.radius));
       }
       return rejectionCircles;
    }
    
    /**
    * For each sample grid position, returns the interpolated difference values along a horizontal or vertical line.
    * @param {SurfaceSpline[]} pointsSurfaceSplines SurfaceSpline with no smoothing applied.
    * @param {Boolean} isHorizontal Horizontal or vertical line
    * @param {Number} lineEqualX Specifies vertical line position
    * @param {Number} lineEqualY Specifies horizontal line position
    * @returns {ValueAtXY[][]} ValueAtXY are sorted by distance along gradient path
    */
    function getValuesAlongLine(pointsSurfaceSplines, isHorizontal, lineEqualX, lineEqualY){
        /**
         * @param {RejectionCircle[]} rejectionCircles
         * @param {Point} point
         * @returns {Boolean}
         */
        function isRejected(rejectionCircles, point){
            for (let rejectionCircle of rejectionCircles){
                if (rejectionCircle.isInsideCircle(point)){
                    return true;
                }
            }
            return false;
        }
        
        let valueAtXYArrays = [];
        try {
            let tgtImage = data.cache.getTgtImage();
            let refImage = data.cache.getRefImage();
            let startX = Math.round(sampleGridBoundingRect.x0 + data.sampleSize/2);
            let startY = Math.round(sampleGridBoundingRect.y0 + data.sampleSize/2);
            let nChannels = pointsSurfaceSplines.length;
            let rejectionCircles = getAllRejectionCircles(data);
            
            // Create array of points that are in ref tgt overlap (both non zero) but not in rejection circles
            // We ignore gaps in the middle of the overlap. These might just be a cold pixel.
            let usefulPoints = [];
            let overlapStarted = false;
            if (isHorizontal){
                for (let x = startX; x < sampleGridBoundingRect.x1; x += data.sampleSize){
                    let point = new Point(x, lineEqualY);
                    if (!overlapStarted){
                        overlapStarted = tgtImage.sample(point) && refImage.sample(point);
                    }
                    if (overlapStarted && !isRejected(rejectionCircles, point)){
                        usefulPoints.push(point);
                    }
                }
            } else {
                for (let y = startY; y < sampleGridBoundingRect.y1; y += data.sampleSize){
                    let point = new Point(lineEqualX, y);
                    if (!overlapStarted){
                        overlapStarted = tgtImage.sample(point) && refImage.sample(point);
                    }
                    if (overlapStarted && !isRejected(rejectionCircles, point)){
                        usefulPoints.push(point);
                    }
                }
            }
            // Remove points from the end that are after the overlap finished.
            let found = false;
            for (let i = usefulPoints.length - 1; i >= 0; i--){
                let p = usefulPoints[i];
                if (tgtImage.sample(p) && refImage.sample(p)){
                    usefulPoints.length = i + 1;
                    found = true;
                    break; // Found the overlap
                }
            }
            if (!found) usefulPoints.length = 0;
            
            for (let c=0; c<nChannels; c++){
                valueAtXYArrays[c] = [];
                if (pointsSurfaceSplines[c]){   // We might only be display one channel on the graph
                    for (let point of usefulPoints){
                        let value = pointsSurfaceSplines[c].evaluate(point);
                        valueAtXYArrays[c].push(new ValueAtXY(point, value));
                    }
                }
            }
        } catch (error){
            logError(error);
        }
        return valueAtXYArrays;
    }
    
    /**
     * Draw gradient line and sample points for a single color channel.
     * @param {Graph} graph
     * @param {Boolean} isHorizontal
     * @param {Number[]} difArray Points to plot. Offset difference between ref and tgt
     * @param {Number} lineColor
     * @param {ValueAtXY[]} valueAtXYArray values along the line
     * @param {Number} pointColor
     * @returns {undefined}
     */
    function drawLineAndPoints(graph, isHorizontal,
            difArray, lineColor, valueAtXYArray, pointColor) {
                
        for (let valueAtXY of valueAtXYArray) {
            // Draw the sample points
            let coord = isHorizontal ? valueAtXY.point.x : valueAtXY.point.y;
            graph.drawPlus(coord, valueAtXY.value, pointColor);
        }
        graph.drawCurve(difArray, lineColor, false);
    }
    
    /**
     * 
     * @param {String} xLabel
     * @param {String} yLabel
     * @param {SamplePairDifMinMax} yCoordinateRange 
     * @param {Number} width 
     * @param {Number} height 
     * @param {Boolean} isHorizontal
     * @param {Number} lineEqualX Specifies the vertical line gradient path
     * @param {Number} lineEqualY Specifies the horizontal line gradient path
     * @param {SurfaceSpline[]} surfaceSplines
     * @param {Rect} imageRect
     * @param {ValueAtXY[][]} valuesOnPath
     * @param {Number} selectedChannel R=0, G=1, B=2, All=3
     * @returns {Graph}
     */
    function createAndDrawGraph(xLabel, yLabel, yCoordinateRange, width, height, 
            isHorizontal, lineEqualX, lineEqualY,
            surfaceSplines, imageRect, valuesOnPath, selectedChannel){
        let maxY = yCoordinateRange.maxDif;
        let minY = yCoordinateRange.minDif;
        let minX;
        let maxX;
        if (isHorizontal){
            minX = imageRect.x0;
            maxX = imageRect.x1;
        } else {
            minX = imageRect.y0;
            maxX = imageRect.y1;
        }
        if (!graphBitmapLum || graphBitmapLum.width !== width || graphBitmapLum.height !== height){
            if (graphBitmapLum){
                graphBitmapLum.clear();
            }
            graphBitmapLum = new Bitmap(width, height);
        }
        let graphDimensions = new GraphDimensions(minX, minY, maxX, maxY, true);
        let graph = new Graph(graphDimensions, xLabel, yLabel, graphBitmapLum, 1, 1);
        
        let ssPath = [];
        let nAxisPixels = graphDimensions.getXAxisLength(width);
        let pixelWidth = 1 / graphDimensions.getXScale(width, 1);
        for (let xp=0; xp<nAxisPixels; xp++){
            // For each pixel along the graph x axis, append the corresponding image point
            let imageCoord = minX + xp * pixelWidth;
            if (isHorizontal){
                ssPath.push(new Point(imageCoord, lineEqualY));
            } else {
                ssPath.push(new Point(lineEqualX, imageCoord));
            }
        }
        
        if (valuesOnPath.length === 1){ // B&W
            let difArray = surfaceSplines[0].evaluate(ssPath).toArray();
            drawLineAndPoints(graph, isHorizontal,
                difArray, 0xFF990000, valuesOnPath[0], 0xFFFFFFFF);
        } else {
            // Color. Need to create 3 graphs for r, g, b and then merge them (binary OR) so that
            // if three samples are on the same pixel we get white and not the last color drawn
            let lineColors = [0xFF990000, 0xFF009900, 0xFF000099]; // r, g, b
            let pointColors = [0xFFFF0000, 0xFF00FF00, 0xFF5555FF]; // r, g, b
            // Provided the saved bitmap is the same size, we can reuse it.
            // The Graph will fill the bitmap with zeros before using it.
            let bitmapSize = graph.getGraphAreaOnlySize();
            if (!graphBitmapRGB || 
                    graphBitmapRGB.width !== bitmapSize.width || 
                    graphBitmapRGB.height !== bitmapSize.height){
                if (graphBitmapRGB){
                    graphBitmapRGB.clear();
                }
                graphBitmapRGB = new Bitmap(bitmapSize.width, bitmapSize.height);
            }
            for (let c = 0; c < valuesOnPath.length; c++){
                if (selectedChannel === 3 || selectedChannel === c){
                    let difArray = surfaceSplines[c].evaluate(ssPath).toArray();
                    let graphAreaOnly = graph.graphAreaOnlyFactory(graphBitmapRGB);
                    drawLineAndPoints(graphAreaOnly, isHorizontal,
                        difArray, lineColors[c], valuesOnPath[c], pointColors[c]);
                    graph.mergeWithGraphAreaOnly(graphAreaOnly);
                }
            }
        }
        return graph;
    }
    
    construct();
}
