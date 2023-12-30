/* global UndoFlag_NoSwapFile, Dialog, StdButton_No, StdIcon_Question, StdButton_Cancel, StdButton_Yes */

// Version 1.0 (c) John Murphy 16th-Feb-2020
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
 * @param {Number} xMin Minimum x value to plot
 * @param {Number} yMin Minimum y value to plot
 * @param {Number} xMax Maximum x value to plot
 * @param {Number} yMax Maximum y value to plot
 * @param {Boolean} hasAxis Supply false to produce a graph with no axis and no margins
 * @returns {GraphDimensions}
 */
function GraphDimensions(xMin, yMin, xMax, yMax, hasAxis){
    let g = new Graphics(new Bitmap(1, 1));
    let font = g.font;
    g.end();
    let maxNumberLength = font.width("88.88e+88");
    let minDistBetweenTicks = maxNumberLength * 1.3;
    let fontHeight = font.ascent + font.descent;
    let tickLength = 4;
    let topMargin = hasAxis ? font.ascent + 2 : 0;
    let bottomMargin = hasAxis ? fontHeight * 2 + tickLength + 10 : 0;
    let leftMargin = hasAxis ? maxNumberLength + fontHeight + tickLength + 5 : 0;
    let rightMargin = hasAxis ? maxNumberLength / 2 : 0;
    
    // Protect against zero range
    if (xMin === xMax){
        xMin = 0;
        if (xMax === 0){
            xMax = 1;
        }
    }
    if (yMin === yMax){
        yMin = 0;
        if (yMax === 0){
            yMax = 1;
        }
    }
    
    /**
     * @returns {GraphDimensions} Clone of class, but with no axis
     */
    this.noAxisFactory = function(){
        return new GraphDimensions(xMin, yMin, xMax, yMax, false);
    };
    
    /**
     * @returns {Boolean} True for a graph with axis and margins
     */
    this.getHasAxis = function (){ return hasAxis; };
    
    /**
     * @returns {Graphics.font} Use this font to annotate the graph axis
     */
    this.getFont = function (){ return font; };
    
    /**
     * @returns {Number} Distance required between ticks to stop numbers overlapping
     */
    this.getMinDistBetweenTicks = function (){ return minDistBetweenTicks; };
    
    /**
     * @returns {Number} length of axis grid line tick mark
     */
    this.getTickLength = function (){ return tickLength; };
    
    /**
     * @returns {Number} Top margin size (enough room for font ascent)
     */
    this.getTopMargin = function (){ return topMargin; };
    
    /**
     * @returns {Number} Bottom margin size.
     */
    this.getBottomMargin = function (){ return bottomMargin; };
    
    /**
     * @returns {Number} Left margin size.
     */
    this.getLeftMargin = function (){ return leftMargin; };
    
    /**
     * @returns {Number} Right margin size
     */
    this.getRightMargin = function (){ return rightMargin; };
    
    /**
     * @returns {Number} Minimum x value to plot
     */
    this.getXMin = function (){ return xMin; };
    
    /**
     * @param {Number | undefined} yZoom zoom factor (only used if zoomFromTop)
     * @param {Boolean} zoomFromTop If true center zoom from graph top.
     * @returns {Number} Minimum y value to plot
     */
    this.getYMin = function (yZoom, zoomFromTop){
        if (zoomFromTop){
            return yMax - (yMax - yMin) / yZoom;
        }
        return yMin; 
    };
    
    /**
     * The maximum number to plot depends on the zoom factor.
     * This is used by the photometry graph to zoom in.
     * The gradient graph handles the zoom range itself and always supplies a
     * zoom of one to all methods in this class.
     * @param {Number} xZoom Zoom factor (e.g. 0.5, 1, 2)
     * @returns {Number} maximum x value to plot
     */
    this.getXMax = function (xZoom){
        return xMin + (xMax - xMin) / xZoom; 
    };
    /**
     * The maximum number to plot depends on the zoom factor.
     * This is used by the photometry graph to zoom in.
     * The gradient graph handles the zoom range itself and always supplies a
     * zoom of one to all methods in this class.
     * @param {Number} yZoom Zoom factor (e.g. 0.5, 1, 2)
     * @param {Boolean} zoomFromTop If true center zoom from graph top.
     * @returns {Number} maximum y value to plot
     */
    this.getYMax = function (yZoom, zoomFromTop){
        if (zoomFromTop){
            return yMax;
        }
        return yMin + (yMax - yMin) / yZoom;
    };
    
    /**
     * @param {Number} graphWidth Graph bitmap width in pixels
     * @returns {Number} Length of the X Axis in pixels
     */
    this.getXAxisLength = function (graphWidth){
        return graphWidth - leftMargin - rightMargin;
    };
    
    /**
     * @param {Number} graphHeight Graph bitmap height in pixels
     * @returns {Number} Length of the Y Axis in pixels
     */
    this.getYAxisLength = function (graphHeight){
        return graphHeight - topMargin - bottomMargin;
    };
    
    /**
     * @returns {Number} x origin bitmap pixel coordinate 
     */
    this.getXOrigin = function(){
        return leftMargin;
    };
    
    /**
     * @param {Number} graphHeight Graph bitmap height in pixels
     * @returns {Number} y origin bitmap pixel coordinate 
     */
    this.getYOrigin = function(graphHeight){
        return graphHeight - bottomMargin - 1; 
    };
    
    /**
     * @param {Number} graphHeight Graph bitmap height in pixels
     * @param {Number} yZoom Vertical zoom factor (always one for gradient graph)
     * @returns {Number} pixels per unit
     */
    this.getYScale = function(graphHeight, yZoom){
        return calculateScale(this.getYAxisLength(graphHeight), this.getYMax(yZoom) - yMin);
    };
    
    /**
     * @param {Number} graphWidth Graph bitmap width in pixels
     * @param {Number} xZoom horizontal zoom factor (always one for gradient graph)
     * @returns {Number} pixels per unit
     */
    this.getXScale = function(graphWidth, xZoom){
        return calculateScale(this.getXAxisLength(graphWidth), this.getXMax(xZoom) - xMin);
    };
    
    /**
     * 
     * @param {Number} graphHeight Graph bitmap height in pixels
     * @param {Number} xZoom Horizontal zoom (always one for gradient graph)
     * @param {Number} yZoom Vertical zoom factor (always one for gradient graph)
     * @returns {Number} The width the bitmap needs to be to produce an aspect ration of 1:1
     */
    this.getSameScaleWidth = function (graphHeight, xZoom, yZoom){
        let xAxisLength = calculateAxisLength(this.getYScale(graphHeight, yZoom), this.getXMax(xZoom) - xMin);
        return xAxisLength + leftMargin + rightMargin;
    };
    
    /**
     * Calculate axis scale.
     * The axis is two pixels longer than the maximum point to be plotted. This
     * gives room for a '+' to be drawn.
     * @param {Number} axisLength Axis length in pixels
     * @param {Number} range Axis range (max - min)
     * @returns {Number} pixels per unit
     */
    function calculateScale(axisLength, range){
        return (axisLength - 2) / range;
    }
    
    /**
     * Calculate axis length.
     * The axis is two pixels longer than the maximum point to be plotted. This
     * gives room for a '+' to be drawn.
     * @param {Number} scale
     * @param {Number} range Axis range (max - min)
     * @returns {Number} Length of axis in pixels
     */
    function calculateAxisLength(scale, range){
        return Math.ceil(scale * range + 2);
    }
}

/**
 * Construct the Graph object with the X and Y data range.
 * Calling function must ensure that (xMax - xMin) > 0 and (yMax - yMin) > 0
 * @param {GraphDimensions} graphDimensions
 * @param {String} xLabel Text to display beneath the X-axis
 * @param {String} yLabel Text to rotate and display on the Y-axis
 * @param {Bitmap} bitmap Draw graph into this bitmap
 * @param {Number} xZoom Zoom factor (e.g. 0.25, 0.5, 1, 2)
 * @param {Number} yZoom Zoom factor (e.g. 0.25, 0.5, 1, 2)
 * @@param {Boolean} zoomFromTop If true, center zoom from top of graph instead of origin
 * @returns {Graph}
 */
function Graph(graphDimensions, xLabel, yLabel, bitmap, xZoom, yZoom, zoomFromTop) {
    this.axisColor = 0xFF888888;
    
    // module data
    let xMin_ = graphDimensions.getXMin();
    let yMin_ = graphDimensions.getYMin(yZoom, zoomFromTop);
    let xMax_ = graphDimensions.getXMax(xZoom);
    let yMax_ = graphDimensions.getYMax(yZoom, zoomFromTop);
    
    let imageWidth = bitmap.width;
    let imageHeight = bitmap.height;
    let xOrigin_ = graphDimensions.getXOrigin();
    let yOrigin_ = graphDimensions.getYOrigin(imageHeight);
    
    let xAxisLength_ = graphDimensions.getXAxisLength(imageWidth);
    let yAxisLength_ = graphDimensions.getYAxisLength(imageHeight);
    
    let xScale_ = graphDimensions.getXScale(imageWidth, xZoom);
    let yScale_ = graphDimensions.getYScale(imageHeight, yZoom);
    // End of module data
    
    // Create the graph with fully drawn X-axis and Y-axis.
    // At this stage the graph contains no data.
    let bitmap_ = bitmap;
    
    if (graphDimensions.getHasAxis()){
        bitmap_.fill(0xFF000000);    // AARRGGBB
        let graphics;
        try {
            graphics = new Graphics(bitmap_);
            graphics.textAntialiasing = true;
            graphics.clipRect = new Rect(0, 0, imageWidth, imageHeight);
            let tickLength = graphDimensions.getTickLength();
            let minDistBetweenTicks = graphDimensions.getMinDistBetweenTicks();
            drawXAxis(graphics, tickLength, minDistBetweenTicks, xLabel, this.axisColor);
            drawYAxis(graphics, tickLength, minDistBetweenTicks, this.axisColor);
        } catch (e) {
            logError(e);
        } finally {
            graphics.end();  
        }
        drawYAxisLabel(graphDimensions.getFont(), yLabel, this.axisColor);
    } else {
        bitmap_.fill(0x00000000);    // AARRGGBB
    }

    /**
     * Use this function to determine the bitmap size before calling graphAreaOnlyFactory.
     * It is safe to reuse bitmaps - Graph fills the bitmap with zeros before use.
     * @returns {Number width, Number height} Size of the graph without axis or margins
     */
    this.getGraphAreaOnlySize = function(){
        return {
            width: xAxisLength_,
            height: yAxisLength_
        };
    };
    
    /**
     * @param {Bitmap} bitmap 
     * @returns {Graph} Create a graph based on this object but with no axis
     */
    this.graphAreaOnlyFactory = function(bitmap){
        let gD = graphDimensions.noAxisFactory();
        return new Graph(gD, " ", " ", bitmap, xZoom, yZoom);
    };
    
    /**
     * Perform a bitwise OR on this graph and the input graph.
     * The input graph should have been created without axis (Graph.createGraphAreaOnly).
     * This graph can be a full graph or a graph without axis.
     * This method is typically used to merge three graphs that each supply only one color
     * @param {Graph} graphAreaOnly A graph created without axis
     * @returns {undefined}
     */
    this.mergeWithGraphAreaOnly = function (graphAreaOnly){
        let p = new Point(xOrigin_, graphDimensions.getTopMargin());
        bitmap_.or(p, graphAreaOnly.getGraphBitmap());
    };
    
    /**
     * Converts screen (x,y) into graph coordinates.
     * @param {Number} x Screen x coordinate
     * @param {Number} y Screen y coordinate
     * @returns {String} Output string in format "( x, y )"
     */
    this.screenToWorld = function( x, y ){
        let wx = (x - xOrigin_) / xScale_ + xMin_;
        let wy = (yOrigin_ - y) / yScale_ + yMin_;
        let xText = wx < 1000 ? wx.toPrecision(3) : wx.toPrecision(4);
        let yText = wy < 1000 ? wy.toPrecision(3) : wy.toPrecision(4);
        return "( " + xText + ", " + yText + " )";
    };
    
    /**
     * @param {Number} x Screen x coordinate
     * @returns {Number} Converted value, to full precision.
     */
    this.screenToWorldX = function( x ){
        return (x - xOrigin_) / xScale_ + xMin_;
    };
    
    /**
     * @param {Number} y Screen y coordinate
     * @returns {Number} Converted value, to full precision.
     */
    this.screenToWorldY = function( y ){
        return (yOrigin_ - y) / yScale_ + yMin_;
    };
    
    /**
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     * @param {Number} color
     * @param {Number} lineWidth 
     * @param {Boolean} antiAlias 
     */
    this.drawSimpleLine = function(x0, y0, x1, y1, color, lineWidth, antiAlias){
        let g;
        try {
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(xOrigin_, yOrigin_ - yAxisLength_, xOrigin_ + xAxisLength_, yOrigin_);
            g.transparentBackground = true;
            g.antialiasing = antiAlias;
            g.pen = new Pen(color, lineWidth);
            g.drawLine(xToScreenX(x0), yToScreenY(y0), xToScreenX(x1), yToScreenY(y1));
        } catch (e) {
            logError(e);
        } finally {
            g.end();
        }
    };
    
    /** Draw a line that traverses the whole data area
     * @param {Number} m gradient
     * @param {Number} b Y-Axis intercept
     * @param {type} color Line color (0xAARRGGBB)
     */
    this.drawLine = function(m, b, color){
        this.drawLineSegment(m, b, color, false, xMin_, xMax_);
    };
    
    /**
     * Draw a line segment which starts from x0 and ends at x1
     * @param {Number} m Line gradient
     * @param {Number} b Y-axis intercept
     * @param {Number} color Hex color value
     * @param {Boolean} antiAlias If true draw an antialiased line
     * @param {Number} x0 Specifies line's left limit
     * @param {Number} x1 Specifies line's right limit
     */
    this.drawLineSegment = function(m, b, color, antiAlias, x0, x1){
        let g;
        try {
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(xOrigin_, yOrigin_ - yAxisLength_, xOrigin_ + xAxisLength_, yOrigin_);
            g.transparentBackground = true;
            g.antialiasing = antiAlias;
            g.pen = new Pen(color);
            let y0 = eqnOfLineCalcY(x0, m, b);
            let y1 = eqnOfLineCalcY(x1, m, b);
            g.drawLine(xToScreenX(x0), yToScreenY(y0), xToScreenX(x1), yToScreenY(y1));
        } catch (e) {
            logError(e);
        } finally {
            g.end();
        }
    };
    
    /**
     * Draw straight lines between the points in the supplied array
     * @param {Number[]} curvePoints Index is graph pixel x-coordinate, value is difference(y-coordinate)
     * @param {Number} color Hex color value
     * @param {Boolean} antiAlias If true draw an antialiased line
     */
    this.drawCurve = function(curvePoints, color, antiAlias){
        let g;
        try {
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(xOrigin_, yOrigin_ - yAxisLength_, xOrigin_ + xAxisLength_, yOrigin_);
            g.transparentBackground = true;
            g.antialiasing = antiAlias;
            g.pen = new Pen(color);
            for (let x=1; x < curvePoints.length; x++){
                let x0 = x - 1;
                let x1 = x;
                let y0 = curvePoints[x0];
                let y1 = curvePoints[x1];
                g.drawLine(xOrigin_ + x0, yToScreenY(y0), xOrigin_ + x1, yToScreenY(y1));
            }
        } catch (e) {
            logError(e);
        } finally {
            g.end();
        }
    };
    
    /**
     * Draw a point on the graph.
     * @param {Number} xWorld
     * @param {Number} yWorld
     * @param {Number} color
     */
    this.drawPoint = function(xWorld, yWorld, color){
        let x = xToScreenX(xWorld);
        let y = yToScreenY(yWorld);
        if (x >= xOrigin_ && y >= 0 && x < bitmap_.width && y <= yOrigin_){
            bitmap_.setPixel(x, y, color);
        }
    };
    
    /**
     * Draw a '+' on the graph
     * @param {Number} xWorld
     * @param {Number} yWorld
     * @param {Number} color
     */
    this.drawPlus = function(xWorld, yWorld, color){
        let g;
        try {
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(xOrigin_, yOrigin_ - yAxisLength_, xOrigin_ + xAxisLength_, yOrigin_);
            g.transparentBackground = true;
            g.pen = new Pen(color);
            let x = xToScreenX(xWorld);
            let y = yToScreenY(yWorld);
            g.drawLine(x-1, y, x+1, y);
            g.drawLine(x, y-1, x, y+1);
        } catch (e) {
            logError(e);
        } finally {
            g.end();
        }
    };
    
    /**
     * Draw a 'x' on the graph
     * @param {Number} xWorld
     * @param {Number} yWorld
     * @param {Number} color
     */
    this.drawCross = function(xWorld, yWorld, color){
        let g;
        try {
            let minX = Math.max(0, xOrigin_ - 6);
            g = new Graphics(bitmap_);
            g.clipRect = new Rect(minX, 0, bitmap_.width, yOrigin_);
            g.transparentBackground = true;
            g.pen = new Pen(color, 2);
            let x = xToScreenX(xWorld);
            let y = yToScreenY(yWorld);
            g.drawLine(x-4, y-4, x+4, y+4);
            g.drawLine(x-4, y+4, x+4, y-4);
        } catch (e) {
            logError(e);
        } finally {
            g.end();
        }
    };
    
    /**
     * @returns {Bitmap} The bitmap the graph has been drawn on
     */
    this.getGraphBitmap = function(){
        return bitmap_;
    };
    
    /**
     * @param {Number} x X data value
     * @returns {Number} Screen X-Coordinate
     */
    function xToScreenX(x){
        return Math.round(xOrigin_ + (x - xMin_) * xScale_);
    }
    
    /**
     * @param {Number} y Y data value
     * @returns {Number} Screen Y-Coordinate
     */
    function yToScreenY(y){
        return Math.round(yOrigin_ - (y - yMin_) * yScale_);
    }
    
    /**
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @param {String} axisLabel
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawXAxis(g, tickLength, minDistBetweenTicks, axisLabel, axisColor){
        const y1 = yOrigin_;
        const xTickInterval = calculateTickIncrement(xMax_ - xMin_, xAxisLength_ / minDistBetweenTicks);
        const firstTickX = calculateFirstTick(xMin_, xTickInterval);
        
        const yAxisEnd = yOrigin_ - yAxisLength_;
        g.pen = new Pen(0xFF222222);
        for (let x = firstTickX; x <= xMax_; x += xTickInterval){
            let x1 = xToScreenX(x);
            if (x1 > xOrigin_){
                g.drawLine(x1, y1 - 1, x1, yAxisEnd);
            }
        }
        
        g.pen = new Pen(axisColor);
        g.drawLine(xOrigin_, yOrigin_, xOrigin_ + xAxisLength_, yOrigin_);
        let fontHeight = g.font.ascent + g.font.descent;
        for (let x = firstTickX; x <= xMax_; x += xTickInterval){
            let x1 = xToScreenX(x);
            g.drawLine(x1, y1, x1, y1 + tickLength);
            if (xTickInterval < 1){
                let n = Math.abs(x) > 1e-15 ? x : 0;
                let text = n.toExponential(2);
                let width = g.font.width(text);
                g.drawText(x1 - width/2, y1 + tickLength + fontHeight + 2, text);
            } else {
                let text = "" + x;
                let width = g.font.width(text);
                g.drawText(x1 - width/2, y1 + tickLength + fontHeight + 2, text);
            }
        }

        // Draw X-axis label
        let x = (xOrigin_ + xAxisLength_)/2 - g.font.width(axisLabel)/2;
        let y = y1 + tickLength + fontHeight * 2 + 4;
        g.drawText(x, y, axisLabel);
    }
    
    /**
     * @param {Graphics} g
     * @param {Number} tickLength
     * @param {Number} minDistBetweenTicks
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawYAxis(g, tickLength, minDistBetweenTicks, axisColor){
        const x1 = xOrigin_;
        const yTickInterval = calculateTickIncrement(yMax_ - yMin_, yAxisLength_ / minDistBetweenTicks);
        const firstTickY = calculateFirstTick(yMin_, yTickInterval);
        
        const xAxisEnd = xOrigin_ + xAxisLength_;
        g.pen = new Pen(0xFF222222);
        for (let y = firstTickY; y <= yMax_; y += yTickInterval){
            let y1 = yToScreenY(y);
            if (y1 < yOrigin_){
                g.drawLine(x1 + 1, y1, xAxisEnd, y1);
            }
        }
        
        g.pen = new Pen(axisColor);
        g.drawLine(xOrigin_, yOrigin_, xOrigin_, yOrigin_ - yAxisLength_);
        for (let y = firstTickY; y <= yMax_; y += yTickInterval){
            let y1 = yToScreenY(y);
            g.drawLine(x1, y1, x1 - tickLength, y1);
            if (yTickInterval < 1){
                let n = Math.abs(y) > 1e-15 ? y : 0;
                let text = n.toExponential(2);
                let width = g.font.width(text);
                g.drawText(x1 - (tickLength + width + 3), y1 + g.font.ascent/2 - 1, text);
            } else {
                let text = "" + y;
                let width = g.font.width(text);
                g.drawText(x1 - (tickLength + width + 3), y1 + g.font.ascent/2 - 1, text);
            }
        }
    }
    
    /**
     * @param {Font} font
     * @param {String} text
     * @param {Number} axisColor
     * @returns {undefined}
     */
    function drawYAxisLabel(font, text, axisColor){
        // draw into a small bitmap
        // rotate the bitmap by 90 degrees
        // copy bitmap into graph right hand margin
        let w = Math.min(yOrigin_, font.width(text));
        let h = font.ascent + font.descent;
        let textBitmap = new Bitmap(w, h);
        textBitmap.fill(0xFF000000);    // AARRGGBB
        let graphics;
        try {
            graphics = new Graphics(textBitmap);
            graphics.clipRect = new Rect(0, 0, w, h);
            graphics.transparentBackground = true;
            graphics.textAntialiasing = true;
            graphics.pen = new Pen(axisColor);
            graphics.drawText(0, h - font.descent, text);
        } catch (e) {
            logError(e);
        } finally {
            graphics.end();
        }
        
        try {
            let rotatedBitmap = textBitmap.rotated(-Math.PI/2);
            let y = Math.max(0, yOrigin_/2 - w/2);
            bitmap_.copy(new Point(0, y), rotatedBitmap);
        } catch (e){
            logError(e, "While rotating graph label bitmap");
        }
    }
    
    /**
     * @param {Number} range xMax_ - xMin_
     * @param {Number} nTargetSteps Maximum number of ticks on axis
     * @returns {Number} tick increment
     */
    function calculateTickIncrement(range, nTargetSteps) {
        // calculate the exact floating point step size
        let floatStep = range / nTargetSteps;

        // get the magnitude of the step size (e.g. 999 -> 100, 100 -> 100)
        let nDigits = Math.floor(Math.log10(floatStep)); // e.g. 999 -> 2, 100 -> 2
        let roundDownStep = Math.pow(10, nDigits); // e.g. 2 -> 100

        // calculate how much bigger the floating point step was
        let correctionFactor = Math.round(floatStep / roundDownStep);

        // Adjust our roundDownStep to be closer to the roundDownStep
        if (correctionFactor > 5)
            correctionFactor = 10;
        else if (correctionFactor > 2)
            correctionFactor = 5;
        else if (correctionFactor > 1)
            correctionFactor = 2;

        return correctionFactor * roundDownStep;
    }

    /**
     * @param {type} minValue xMin
     * @param {type} tickIncrement
     * @returns {Number}
     */
    function calculateFirstTick(minValue, tickIncrement){
        return tickIncrement * Math.ceil(minValue / tickIncrement);
    }
}
