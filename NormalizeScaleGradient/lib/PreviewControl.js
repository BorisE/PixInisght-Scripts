/* global Dialog, MouseButton_Left, Frame, UndoFlag_NoSwapFile, KeyModifier_Control, MouseButton_Right, StdCursor_Arrow, StdCursor_ClosedHand */

// the PreviewControl method is based on PreviewControl.js from the AnnotationImage script, 
// which has the following copyright notice:
/*
 Preview Control
 
 This file is part of the AnnotateImage script
 
 Copyright (C) 2013-2020, Andres del Pozo
 Contributions (C) 2019-2020, Juan Conejero (PTeam)
 All rights reserved.
 
 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:
 
 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation
 and/or other materials provided with the distribution.
 
 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 POSSIBILITY OF SUCH DAMAGE.
 */
// Modified by John Murphy

/**
 * 
 * @param {UIObject} parent
 * @param {Bitmap} image image The unscaled bitmap to display. It is not modified.
 * @param {Number} maxWidth
 * @param {Number} maxHeight
 * @param {width:, height:} metadata Specifies dimensions of drawing region if image = null
 * @param {Function(HorizontalSizer)} customControls e.g. add 'Live update' and 'Update' controls
 * @param {Boolean} includeCancelButton If true, add a cancel button after the OK button
 * @returns {PreviewControl}
 */
function PreviewControl(parent, image, maxWidth, maxHeight, metadata, customControls, includeCancelButton) {
    this.__base__ = Frame;
    this.__base__(parent);
    
    this.includeUpdateButton = true;
    let self = this;

    /**
     * Set the background image, or the drawing area if the image is null
     * @param {Bitmap} image The unscaled bitmap to display. It is not modified.
     * @param {width:, height:} metadata Specifies dimensions of drawing region if image = null
     */
    this.setImage = function (image, metadata) {
        if (metadata){
            this.metadata = metadata;
        } else {
            this.metadata = {width: image.width, height:image.height};
        }
        // The original bitmap at 1:1 scale
        this.image = image;
        // The zoomed bitmap, calculated from this.image
        this.scaledImage = null;
        // Set the lower zoom limit when the whole image is visible
        this.setZoomOutLimit();
        // This sets the inital zoom to 1:1. Use -100 to set to ZoomOutLimit
        this.updateZoom(1, null);
    };
    
    /**
     * Update the background image. The new image must be the same size as the
     * original image.
     * This also updates the scaled image. The scroll position and zoom level
     * are left unchanged.
     * @param {Bitmap} image
     */
    this.updateBitmap = function (image){
        if (image.width === this.image.width && image.height === this.image.height){
            this.image = image;
            this.scaledImage = this.image.scaled(this.scale);
        } else {
            console.criticalln("** ERROR: PreviewControl error: bitmap size changed");
        }
    };

    /**
     * Update the zoom, constrained to the ZoomOutLimit. Max zoom = 4.
     * If newZoom > 0 and <= 4, scale = newZoom
     * If newZoom <= 0 and >= zoomOutLimit, scale = 1/(-newZoom + 2)
     * e.g. 2 -> 2, 1 -> 1, 0 -> 1/2, -1 -> 1/3
     * @param {Number} newZoom
     * @param {Point} refPoint Center zoom here (if null defaults to center of viewport).
     * refPoint is in local viewport coordinates
     */
    this.updateZoom = function (newZoom, refPoint) {
        try {
            newZoom = Math.max(this.zoomOutLimit, Math.min(this.zoomInLimit, newZoom));
            if (newZoom === this.zoom && this.scaledImage)
                return; // no change

            let refPointImage;
            if (refPoint === null){ // default to center of view port
                refPoint = new Point(this.scrollbox.viewport.width / 2, this.scrollbox.viewport.height / 2);
            }
            if (this.scaledImage === null){ // default to center of image
                refPointImage = new Point(this.metadata.width / 2, this.metadata.height / 2);
            } else {
                // convert refPoint from local to bitmap 1:1 coordinates
                refPointImage = viewPortToBitmapXY(refPoint.x, refPoint.y, 
                    this.scrollbox.viewport.width, this.scrollbox.viewport.height);
            }

            this.zoom = newZoom;
            this.scaledImage = null;

            // Calculate scale from zoom index. 
            // Update zoom text
            let zoomText;
            if (this.zoom > 0) {
                this.scale = this.zoom;
                zoomText = format("%d:1", this.zoom);
            } else {
                this.scale = 1 / (-this.zoom + 2);
                zoomText = format("1:%d", -this.zoom + 2);
            }
            if (this.updateZoomText){
                this.updateZoomText(zoomText);
            }

            if (this.image) {
                // Create zoomed image from the original bitmap
                this.scaledImage = this.image.scaled(this.scale);
            } else {
                // No bitmap image was supplied.
                // scaledImage will only contain the width and height
                this.scaledImage = {
                    width: this.metadata.width * this.scale,
                    height: this.metadata.height * this.scale
                };
            }

            this.scrollbox.maxHorizontalScrollPosition = Math.max(0, this.scaledImage.width - this.scrollbox.viewport.width);
            this.scrollbox.maxVerticalScrollPosition = Math.max(0, this.scaledImage.height - this.scrollbox.viewport.height);

            // Scroll to keep the refPoint in the correct place
            let scrollX = refPointImage.x * this.scale - refPoint.x;
            let scrollY = refPointImage.y * this.scale - refPoint.y;
            this.scrollbox.horizontalScrollPosition = Math.min( Math.max(0, scrollX), this.scrollbox.maxHorizontalScrollPosition );
            this.scrollbox.verticalScrollPosition = Math.min( Math.max(0, scrollY), this.scrollbox.maxVerticalScrollPosition );

            this.scrollbox.viewport.update();
        } catch(e){
            logError(e);
        }
    };
    
    this.zoomIn_Button = new ToolButton(this);
    this.zoomIn_Button.icon = this.scaledResource(":/icons/zoom-in.png");
    this.zoomIn_Button.setScaledFixedSize(24, 24);
    this.zoomIn_Button.toolTip = "Zoom In";
    this.zoomIn_Button.onMousePress = function ()
    {
        self.updateZoom(self.zoom + 1, null);
    };

    this.zoomOut_Button = new ToolButton(this);
    this.zoomOut_Button.icon = this.scaledResource(":/icons/zoom-out.png");
    this.zoomOut_Button.setScaledFixedSize(24, 24);
    this.zoomOut_Button.toolTip = "Zoom Out";
    this.zoomOut_Button.onMousePress = function ()
    {
        self.updateZoom(self.zoom - 1, null);
    };

    this.zoom11_Button = new ToolButton(this);
    this.zoom11_Button.icon = this.scaledResource(":/icons/zoom-1-1.png");
    this.zoom11_Button.setScaledFixedSize(24, 24);
    this.zoom11_Button.toolTip = "Zoom 1:1";
    this.zoom11_Button.onMousePress = function ()
    {
        self.updateZoom(1, null);
    };

    this.zoom = 1;
    this.scale = 1;
    this.zoomInLimit = 2;
    this.zoomOutLimit = -5;
    this.scrollbox = new ScrollBox(this);
    this.scrollbox.autoScroll = true;
    this.scrollbox.tracking = true;
    this.scrollbox.pageHeight = this.scrollbox.viewport.height;
    this.scrollbox.pageWidth = this.scrollbox.viewport.width;
    this.scrollbox.lineHeight = 10;
    this.scrollbox.lineWidth = 10;

    this.scroll_Sizer = new HorizontalSizer;
    this.scroll_Sizer.add(this.scrollbox);
    
    this.scrolling = null;

    /**
     * Prevents zoom out beyond the point where the whole image is visible
     */
    this.setZoomOutLimit = function () {
        let scaleX = Math.ceil(this.metadata.width / this.scrollbox.viewport.width);
        let scaleY = Math.ceil(this.metadata.height / this.scrollbox.viewport.height);
        let scale = Math.max(scaleX, scaleY);
        this.zoomOutLimit = -scale + 2;
    };
    
    this.scrollbox.onHorizontalScrollPosUpdated = function (newPos) {
        this.viewport.update();
    };

    this.scrollbox.onVerticalScrollPosUpdated = function (newPos) {
        this.viewport.update();
    };

    this.forceRedraw = function () {
        this.scrollbox.viewport.update();
    };

    /**
     * Mouse wheel zoom
     * @param {Number} x
     * @param {Number} y
     * @param {Number} delta
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseWheel = function (x, y, delta, buttonState, modifiers) {
        self.updateZoom(self.zoom + ((delta > 0) ? -1 : 1), new Point(x, y));
    };

    /**
     * Add a listener for a mouse double click with modifiers:
     * MouseButton_Left, MouseButton_Right, MouseButton_Middle
     * KeyModifier_Shift, KeyModifier_Control, KeyModifier_Alt, KeyModifier_SpaceBar, KeyModifier_Meta
     * @param {Function(clickX, clickY, buttonState, modifiers)} listener
     */
    this.addDoubleClickListener = function (listener){
        self.doubleClickListener = listener;
    };
    
    /**
     * Removes doubleClickListener
     */
    this.removeDoubleClickListener = function (){
        self.doubleClickListener = undefined;
    };

    /**
     * Add a listener for a mouse click with modifiers:
     * MouseButton_Left, MouseButton_Right, MouseButton_Middle
     * KeyModifier_Shift, KeyModifier_Control, KeyModifier_Alt, KeyModifier_SpaceBar, KeyModifier_Meta
     * @param {Function(point, button, buttonState, modifiers)} listener
     */
    this.addCtrlClickListener = function (listener){
        self.ctrlClickListener = listener;
    };
    
    /**
     * Removes CtrlClickListener
     */
    this.removeCtrlClickListener = function (){
        self.ctrlClickListener = undefined;
    };
    
    /**
     * Add a listener for a mouse drag with modifiers:
     * MouseButton_Left, MouseButton_Right, MouseButton_Middle
     * KeyModifier_Shift, KeyModifier_Control, KeyModifier_Alt, KeyModifier_SpaceBar, KeyModifier_Meta
     * @param {Function(point, button, buttonState, modifiers)} listener
     * @param {Number}  cursor
     */
    this.addCtrlDragListener = function (listener, cursor){
        self.ctrlDragListener = listener;
        self.ctrlDragCursor = cursor;
    };
    
    /**
     * Removes CtrlClickListener
     */
    this.removeCtrlDragListener = function (){
        self.ctrlDragListener = undefined;
    };
    
    /**
     * @param {Number} x
     * @param {Number} y
     * @param {Number} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseDoubleClick = function (x, y, button, buttonState, modifiers) {
        if (self.doubleClickListener !== undefined){
            let coord = viewPortToBitmapXY(x, y, this.width, this.height);
            self.doubleClickListener(coord.x, coord.y, button, buttonState, modifiers); 
        }
    };

    /**
     * If left mouse button press, start pan mode
     * @param {Number} x
     * @param {Number} y
     * @param {Number} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMousePress = function (x, y, button, buttonState, modifiers) {
        if (self.scrolling || self.dragging)
            return;
        
        if (modifiers === KeyModifier_Control && button === MouseButton_Left){
            let coord = viewPortToBitmapXY(x, y, this.width, this.height);
            if (self.ctrlClickListener !== undefined){
                self.ctrlClickListener(coord, button, buttonState, modifiers); 
            }
            if (self.ctrlDragListener !== undefined){
                self.dragging = true;
                self.ctrlDragListener(coord, button, buttonState, modifiers);
                if (self.ctrlDragCursor)
                    this.cursor = new Cursor(self.ctrlDragCursor);
            }
            return;
        }
        
        if (button === MouseButton_Right)
            return;
        
        self.scrolling = {
            orgCursor: new Point(x, y),
            orgScroll: new Point(self.scrollbox.horizontalScrollPosition, self.scrollbox.verticalScrollPosition)
        };
        this.cursor = new Cursor(StdCursor_ClosedHand);
    };

    /**
     * @param {Number} x Local x coordinate within the view port
     * @param {Number} y Local y coordinate within the view port
     * @param {Number} width scrollbox.viewport.width
     * @param {Number} height scrollbox.viewport.height
     * @returns {Point} (x,y) coordinate within the image (at 1:1 scale)
     */
    function viewPortToBitmapXY(x, y, width, height){
        // (ox, oy) is the scaled image origin in viewport coordinates
        let ox = (self.scrollbox.maxHorizontalScrollPosition > 0) ?
                -self.scrollbox.horizontalScrollPosition : (width - self.scaledImage.width) / 2;
        let oy = (self.scrollbox.maxVerticalScrollPosition > 0) ?
                -self.scrollbox.verticalScrollPosition : (height - self.scaledImage.height) / 2;

        // coordPx is the cursor position in this.image bitmap coordinates
        return new Point((x - ox) / self.scale, (y - oy) / self.scale);
    }

    /**
     * Display cursor postion in image coordinates, if in pan mode scroll image.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseMove = function (x, y, buttonState, modifiers) {
        if (self.scrolling) {
            self.scrollbox.horizontalScrollPosition = self.scrolling.orgScroll.x - (x - self.scrolling.orgCursor.x);
            self.scrollbox.verticalScrollPosition = self.scrolling.orgScroll.y - (y - self.scrolling.orgCursor.y);
        } else if (self.dragging){
            let coord = viewPortToBitmapXY(x, y, this.width, this.height);
            self.ctrlDragListener(coord, undefined, buttonState, modifiers);
        }

        if (self.updateCoord){
            let coordPx = viewPortToBitmapXY(x, y, this.width, this.height);
            if (coordPx.x < 0 ||
                    coordPx.x > self.metadata.width ||
                    coordPx.y < 0 ||
                    coordPx.y > self.metadata.height)
            {
                // cursor is not over the image
                self.updateCoord(null);
            } else {
                self.updateCoord(coordPx);
            }
        }
    };

    /**
     * On left mouse button release, if in pan mode update scroll position and exit pan mode
     * @param {Number} x
     * @param {Number} y
     * @param {Number} button
     * @param {Number} buttonState
     * @param {Number} modifiers
     */
    this.scrollbox.viewport.onMouseRelease = function (x, y, button, buttonState, modifiers) {
        if (self.scrolling && button !== MouseButton_Right) {
            self.scrollbox.horizontalScrollPosition = self.scrolling.orgScroll.x - (x - self.scrolling.orgCursor.x);
            self.scrollbox.verticalScrollPosition = self.scrolling.orgScroll.y - (y - self.scrolling.orgCursor.y);
            self.scrolling = null;
            this.cursor = new Cursor(StdCursor_Arrow);
        } 
        if (self.dragging){
            let coord = viewPortToBitmapXY(x, y, this.width, this.height);
            self.ctrlDragListener(coord, button, buttonState, modifiers);
            self.dragging = false;
            this.cursor = new Cursor(StdCursor_Arrow);
        }
    };

    /**
     * @param {Number} wNew New width
     * @param {Number} hNew New height
     * @param {Number} wOld old width
     * @param {Number} hOld old height
     */
    this.scrollbox.viewport.onResize = function (wNew, hNew, wOld, hOld) {
        try {
            if (self.scaledImage) {
                this.parent.maxHorizontalScrollPosition = Math.max(0, self.scaledImage.width - wNew);
                this.parent.maxVerticalScrollPosition = Math.max(0, self.scaledImage.height - hNew);
                this.parent.pageHeight = this.parent.viewport.height;
                this.parent.pageWidth = this.parent.viewport.width;
                self.setZoomOutLimit();
                self.updateZoom(self.zoom, null);
            }
            this.update();
        } catch(e){
            logError(e);
        }
    };

    /**
     * @param {Number} x0 Viewport x0
     * @param {Number} y0 Viewport y0
     * @param {Number} x1 Viewport x1
     * @param {Number} y1 Viewport y1
     */
    this.scrollbox.viewport.onPaint = function (x0, y0, x1, y1) {
        let graphics;
        try {
            graphics = new VectorGraphics(this);
            graphics.clipRect = new Rect(x0, y0, x1, y1);
            graphics.fillRect(x0, y0, x1, y1, new Brush(0xff202020));

            let translateX = (this.parent.maxHorizontalScrollPosition > 0) ?
                    -this.parent.horizontalScrollPosition : (this.width - self.scaledImage.width) / 2;
            let translateY = (this.parent.maxVerticalScrollPosition > 0) ?
                    -this.parent.verticalScrollPosition : (this.height - self.scaledImage.height) / 2;
            graphics.translateTransformation(translateX, translateY);

            if (self.image)
                graphics.drawBitmap(0, 0, self.scaledImage);
            else
                graphics.fillRect(0, 0, self.scaledImage.width, self.scaledImage.height, new Brush(0xff000000));

            if (self.onCustomPaint) {
                // Draw on top of the bitmap if onCustomPaint(...) method has been set
                self.onCustomPaint.call(self.onCustomPaintScope, 
                        this, translateX, translateY, self.scale, x0, y0, x1, y1);
            }
        } catch(e){
            logError(e);
        } finally {
            graphics.end();
        }
    };
    
    this.ok_Button = new PushButton();
    this.ok_Button.text = "OK";
    this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
    
    this.cancel_Button = null;
    if (includeCancelButton){
        this.cancel_Button = new PushButton();
        this.cancel_Button.text = "Cancel";
        this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
    }
    
    this.update_Button = undefined;
    if (this.includeUpdateButton){
        this.update_Button = new PushButton();
        this.update_Button.text = "Refresh";
        this.update_Button.defaultButton = true;
        this.update_Button.toolTip = "<p>Forces the display to refresh.</p>" +
                "<p>(The display usually refreshes automatically)</p>";
    }

    this.getButtonSizer = function(){
        let zoomButton_Sizer = new HorizontalSizer();
        zoomButton_Sizer.margin = 0;
        zoomButton_Sizer.spacing = 4;
        zoomButton_Sizer.add(this.zoomIn_Button);
        zoomButton_Sizer.add(this.zoomOut_Button);
        zoomButton_Sizer.add(this.zoom11_Button);
        if (customControls){
            customControls(zoomButton_Sizer);
        }
        if (this.includeUpdateButton){
            zoomButton_Sizer.addSpacing(10);
            zoomButton_Sizer.add(this.update_Button);
        }
        zoomButton_Sizer.addStretch();
        zoomButton_Sizer.add(this.ok_Button);
        if (includeCancelButton){
            zoomButton_Sizer.add(this.cancel_Button);
        }
        zoomButton_Sizer.addSpacing(10);
        return zoomButton_Sizer;
    };
    this.getButtonSizerHeight = function(){
        return this.zoomIn_Button.height;
    };

    this.sizer = new VerticalSizer();
    this.sizer.add(this.scroll_Sizer);
    
    this.setImage(image, metadata);
    
    if (maxWidth)
        this.width = Math.min(this.logicalPixelsToPhysical(maxWidth), image.width);
    if (maxHeight)
        this.height = Math.min(this.logicalPixelsToPhysical(maxHeight), image.height);
}

PreviewControl.prototype = new Frame;
