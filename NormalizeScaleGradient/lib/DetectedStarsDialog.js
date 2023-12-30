/* global Dialog, MouseButton_Left, EXTRA_CONTROLS, DEFAULT_STAR_DETECTION */

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
 * @returns {DetectedStarsDialog}
 */
function DetectedStarsDialog(title, data, nsgDialog)
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
        return data.cache.getTgtStars(data, data.logStarDetection, true);
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
        drawDetectedStars(viewport, translateX, translateY, scale, x0, y0, x1, y1);
    };
    previewControl.ok_Button.onClick = function(){
        self.ok();
    };
    previewControl.update_Button.onClick = function(){
        finalUpdateFunction();
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
        previewControl.updateBitmap(bitmap);
        previewControl.forceRedraw();
        self.enabled = true;
        processEvents();
    };
    
    /**
     * When a slider is dragged, only fast draw operations are performed.
     * When the drag has finished (or after the user has finished editing in the textbox)
     * this method is called to perform all calculations.
     */
    function finalUpdateFunction(){
        self.enabled = false;
        processEvents();
        stars = getStars(selectedBitmap);
        previewControl.forceRedraw();
        self.enabled = true;
        processEvents();
    }
    
    // ===================================================
    // SectionBar: Star aperture size
    // ===================================================
    let starDetectionControls = new NsgStarDetectionControls();
    let strLen = this.font.width("Star detection:");
    
    let refDetection_Control = starDetectionControls.createRefLogStarDetect_Control(this.dialog, data, strLen);
    refDetection_Control.onValueUpdated = function (value) {
        data.logStarDetection = value;
        nsgDialog.refLogStarDetection_Control.setValue(value);
    };
    addFinalUpdateListener(refDetection_Control, finalUpdateFunction);
    controlsHeight += refDetection_Control.height;
    
    let detectedStars_Reset = new ToolButton(this);
    detectedStars_Reset.icon = this.scaledResource(":/icons/reload.png");
    detectedStars_Reset.toolTip = "<p>Reset star detection to default.</p>";
    detectedStars_Reset.onClick = function(){
        data.logStarDetection = DEFAULT_STAR_DETECTION;
        refDetection_Control.setValue(data.logStarDetection);
        nsgDialog.refLogStarDetection_Control.setValue(data.logStarDetection);
        finalUpdateFunction();
    };
    
    let logDetectionSection = new Control(this);
    logDetectionSection.sizer = new HorizontalSizer;
    logDetectionSection.sizer.spacing = 5;
    logDetectionSection.sizer.add(refDetection_Control, 100);
    logDetectionSection.sizer.add(detectedStars_Reset, 0);
    logDetectionSection.sizer.addStretch();
    let logDetectionBar = new SectionBar(this, "Star Detection");
    logDetectionBar.setSection(logDetectionSection);
    logDetectionBar.onToggleSection = this.onToggleSection;
    logDetectionBar.toolTip = "Specifies the star detection sensitivity";
    controlsHeight += logDetectionBar.height + logDetectionSection.sizer.spacing * 3;

    let optionsSizer = new HorizontalSizer(this);
    optionsSizer.margin = 0;
    optionsSizer.spacing = 10;
    optionsSizer.addSpacing(4);
    optionsSizer.add(refCheckBox);
    optionsSizer.addStretch();
    
    controlsHeight += refCheckBox.height;
    
    // Global sizer
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 2;
    this.sizer.spacing = 2;
    this.sizer.add(previewControl);
    this.sizer.add(optionsSizer);
    this.sizer.add(logDetectionBar);
    this.sizer.add(logDetectionSection);
    this.sizer.add(previewControl.getButtonSizer());
    
    controlsHeight += this.sizer.margin * 2 + this.sizer.spacing * 4;

    let rect = new NsgDialogSizes().get(data, "DetectedStars");
    this.resize(rect.width, rect.height);
    setTitle();
    previewControl.updateZoom(-100, null);
}

DetectedStarsDialog.prototype = new Dialog;
