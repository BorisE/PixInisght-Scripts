/* global Dialog, StdCursor_ClosedHand, MouseButton_Left, StdCursor_UpArrow, StdCursor_Checkmark */

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
 * Display the Binned Sample Grid in a Dialog that contains a scrolled window and 
 * controls to adjust the Binned Sample Grid parameters.
 * @param {String} title Window title
 * @param {SamplePair[]} samplePairs Specifies the grid samples
 * @param {NsgData} data Values from user interface
 * @param {NsgDialog} nsgDialog
 * @returns {BinnedSampleGridDialog}
 */
function BinnedSampleGridDialog(title, samplePairs, data, nsgDialog)
{
    this.__base__ = Dialog;
    this.__base__();
    
    let self = this;
    
    let zoomText = "1:1";
    let coordText;
    setCoordText(null);
    let refBitmap = data.cache.getRefImageBitmap();
    let showUnbinnedSamples = false;
    let binnedSamplePairs = getBinnedSamplePairs();
    
    /**
     * Set dialog title, including the current zoom and cursor coordinates
     */
    function setTitle(){
        self.windowTitle = title + " " + zoomText + " " + coordText;
    };
    
    /**
     * Set coordText, the cursor coordinate text. The coordText
     * is relative to the full mosaic image's top left corner.
     * @param {Point} point cursor coordinates relative to the (1:1) refBitmap
     */
    function setCoordText(point){
        if (point === null){
            coordText = "(---,---)";
        } else {
            coordText = format("(%8.2f,%8.2f )", point.x, point.y);
        }
    }
    
    /**
     * Draw on top of the background refBitmap, within the scrolled window
     * @param {Control} viewport
     * @param {Number} translateX
     * @param {Number} translateY
     * @param {Number} scale
     * @param {Number} x0
     * @param {Number} y0
     * @param {Number} x1
     * @param {Number} y1
     */
    function drawBinnedSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1){
        let graphics;
        try {
            graphics = new VectorGraphics(viewport);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.translateTransformation(translateX, translateY);
            graphics.scaleTransformation(scale, scale);
            graphics.pen = new Pen(0xffff0000);
            // Draw the sample grid
            if (showUnbinnedSamples){
                graphics.pen = new Pen(0xff0000ff);
                graphics.antialiasing = false;
                samplePairs.forEach(function (samplePair) {
                    graphics.drawRect(samplePair.rect);
                });
                let stars = data.cache.getRefStars(data.logStarDetection);
                let firstNstars;
                if (data.limitSampleStarsPercent < 100){
                    firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
                } else {
                    firstNstars = stars.length;
                }
                graphics.pen = new Pen(0xffff0000, 1.5);
                graphics.antialiasing = true;
                for (let i = 0; i < firstNstars; ++i){
                    let star = stars[i];
                    let radius = star.getStarRadius();
                    graphics.strokeCircle(star.pos.x, star.pos.y, radius);
                }
            }
            graphics.pen = new Pen(0xffff0000);
            graphics.antialiasing = false;
            binnedSamplePairs.forEach(function (samplePair) {
                graphics.drawRect(samplePair.rect);
            });
        } catch (e) {
            logError(e);
        } finally {
            graphics.end();
        }
    }
    
    let liveUpdate = false;
    
    /**
     * @param {HorizontalSizer} horizontalSizer
     */
    function customControls (horizontalSizer){
        let liveUpdate_control = new CheckBox(self);
        liveUpdate_control.text = "Live update";
        liveUpdate_control.toolTip = "<p>Live update. Deselect if controls are sluggish.</p>";
        liveUpdate_control.onCheck = function (checked){
            liveUpdate = checked;
            if (checked){
                self.enabled = false;
                processEvents();
                updateSampleGrid();
                self.enabled = true;
                processEvents();
            }
        };
        liveUpdate_control.checked = liveUpdate;
        
        horizontalSizer.addSpacing(20);
        horizontalSizer.add(liveUpdate_control);
        horizontalSizer.addSpacing(20);
    }
    
    // =================================
    // Sample Generation Preview frame
    // =================================
    let previewControl = new PreviewControl(this, refBitmap, 0, 0, null, customControls, false);
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
        drawBinnedSampleGrid(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };
    
    // ========================================
    // User controls
    // ========================================
    let unbinnedCheckBox = new CheckBox(this);
    unbinnedCheckBox.text = "Show unbinned samples";
    unbinnedCheckBox.toolTip = "If selected show the unbinned samples in blue.";
    unbinnedCheckBox.checked = showUnbinnedSamples;
    unbinnedCheckBox.onClick = function (checked) {
        showUnbinnedSamples = checked;
        self.enabled = false;
        processEvents();
        previewControl.forceRedraw();
        self.enabled = true;
        processEvents();
    };
    
    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.addSpacing(4);
    optionsSizer.add(unbinnedCheckBox);
    optionsSizer.addStretch();
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     */
    function finalUpdateFunction(){
        if (!liveUpdate){
            self.enabled = false;
            processEvents();
            updateSampleGrid();
            self.enabled = true;
            processEvents();
        }
    }
    
    let maxSamples_Control = createMaxSamplesControl(this, data);
    maxSamples_Control.onValueUpdated = function (value) {
        data.maxSamples = value;
        nsgDialog.maxSamples_Control.setValue(value);
        if (liveUpdate){
            self.enabled = false;
            processEvents();
            updateSampleGrid();
            self.enabled = true;
            processEvents();
        }
    };
    addFinalUpdateListener(maxSamples_Control, finalUpdateFunction);
    
    /**
     * @returns {SamplePair[]}
     */
    function getBinnedSamplePairs(){
        let refImage = data.cache.getRefImage();
        let imageRect = new Rect(refImage.width, refImage.height);
        let binnedPairs = createBinnedSampleGrid(imageRect, samplePairs, data.maxSamples);
        return binnedPairs;
    }
    
    /**
     * Create a new binned sample grid from the updated parameters, and draw it 
     * on top of the background refBitmap within the scrolled window.
     */
    function updateSampleGrid(){
        binnedSamplePairs = getBinnedSamplePairs();
        previewControl.forceRedraw();
    }

    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(maxSamples_Control);
    this.sizer.add(optionsSizer);
    this.sizer.add(previewControl.getButtonSizer());

    // The PreviewControl size is determined by the size of the refBitmap
    // The dialog must also leave enough room for the extra controls we are adding
    let rect = new NsgDialogSizes().get(data, "BinnedGrid");
    this.resize(rect.width, rect.height);
    
    setTitle();
}

function createMaxSamplesControl(dialog, data){
    let maxSamples_Control = new NumericControl(this);
    maxSamples_Control.real = false;
    maxSamples_Control.label.text = "Max samples:";
    maxSamples_Control.toolTip =
            "<p>Limits the number of samples used to create the surface spline. " +
            "If the number of samples exceed this limit, they are combined " +
            "(binned) to create super samples.</p>" +
            "<p>Increase if the overlap area is very large. " +
            "A larger number of samples increases the " +
            "theoretical maximum resolution of the surface spline. However, " +
            "small unbinned samples are noisier and require more smoothing. " +
            "The default value is usually a good compromise.</p>" +
            "<p>The time required to initialize the surface spline approximately " +
            "doubles every 1300 samples.</p>";
    
    maxSamples_Control.setRange(1000, 9000);
    maxSamples_Control.slider.setRange(100, 900);
    maxSamples_Control.slider.minWidth = 200;
    maxSamples_Control.setValue(data.maxSamples);
    return maxSamples_Control;
}

BinnedSampleGridDialog.prototype = new Dialog;
