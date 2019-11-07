/*
   PreviewAggregator.js v0.2.2

   Joins previews into a new image.

   Copyright (C) 2009 David Serrano.

   This program is free software: you can redistribute it and/or modify it
   under the terms of the GNU General Public License as published by the
   Free Software Foundation, version 3 of the License.

   This program is distributed in the hope that it will be useful, but WITHOUT
   ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
   FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
   more details.

   You should have received a copy of the GNU General Public License along with
   this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
   Changelog:
   0.2.2: Codefix: Changed pa_engine.parent_images() to return parent_images.length.
          Creation of a preview on the aggregated image is now optional.
   0.2.1: Bugfix: working without a mask was broken.
   0.2:   If all selected previews belong to same imagen, take into account
          the mask that the image may have, as per Oriol suggestion.
   0.1:   Initial version.
*/

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/UndoFlag.jsh>

#feature-id Utilities2 > PreviewAggregator

#feature-info  When using previews to fine-tune the parameters of a process, \
   it's often desired to pay attention to more than one preview at the same \
   time, so the adjustments done to the parameters in order to improve the \
   result in one area of the image don't degrade other areas. This script \
   creates an image containing other images' previews, so processes can be \
   applied to it and the user can see the results in all original previews \
   at once.<br/>\
   <br/>\
   Copyright &copy; 2009 David Serrano

#feature-icon PreviewAggregator.xpm

#define TITLE  "PreviewAggregator"
#define VERSION "0.2.2"

function pa_engine() {
   this.imgIDs = new Array;
   this.views = new Array;
   this.mask_views = new Array;
   this.anchors = new Array;
   this.createPreview = false;
   this.new_image_width  = 0;
   this.new_image_height = 0;

   // Populates the views array.
   this.load = function() {
      var N = this.imgIDs.length;
      this.views.length = 0;
      for (var i = 0; i < N; i++) {
         this.views.push (new View (this.imgIDs[i]));
      }
   };

   // calculates new image dimensions
   this.imagesize = function () {
      var x = Math.ceil (Math.sqrt (this.views.length));
      var y = Math.ceil (this.views.length / x);

      var max_w = 0;
      var max_h = 0;
      for (var i = 0; i < this.views.length; i++) {
         var w = this.views[i].image.width;
         var h = this.views[i].image.height;
         if (w > max_w) { max_w = w; }
         if (h > max_h) { max_h = h; }
      }

      this.new_image_width  = x * max_w;
      this.new_image_height = y * max_h;
      //console.writeln ("x (",x,") y (",y,") max_w (",max_w,") max_h (",max_h,") width (",this.new_image_width,") height (",this.new_image_height,")");

      // now build array of anchors using x, y, max_w and max_h
      var anchor_x = -1;
      var anchor_y = 0;
      for (var i = 0; i < this.views.length; i++) {
         anchor_x++;
         if (anchor_x >= x) {   // technically '==' works, but let's cover us from any unexpected event
            anchor_x = 0;
            anchor_y++;
         }
         //console.writeln ("about to push point at x (",anchor_x*max_w,") y (",anchor_y*max_h,") for view (",i,")");
         this.anchors.push (new Point (anchor_x * max_w, anchor_y * max_h));
      }
   }

   this.parent_images = function() {
      var parent_images = [];
      for (var i = 0; i < this.imgIDs.length; i++) {
         var end_idx = this.imgIDs[i].indexOf ("->");
         var img_id = this.imgIDs[i].substr (0, end_idx);
         parent_images[img_id] = 1;
      }

      return parent_images.length;
   }

   this.create_image = function() {
      var do_mask = 0;
      var orig_mask_win;
      if (this.views[0].window.mask.mainView.fullId) { console.writeln ("mask true (",this.views[0].window.mask.mainView.fullId,")"); }
      if (
         1 == this.parent_images() &&
         this.views[0].window.mask.mainView.fullId
      ) {
         do_mask = 1;
         orig_mask_win = this.views[0].window.mask;
      }

      this.imagesize();
      var window = new ImageWindow (
         this.new_image_width,
         this.new_image_height,
         this.views[0].image.numberOfChannels,
         this.views[0].image.bitsPerSample,
         this.views[0].image.sampleType != SampleType_Integer,
         this.views[0].image.colorSpace != ColorSpace_Gray,
         "Aggregated"
      );

      var mask_window;
      var mask_view;
      if (do_mask) {
         //console.writeln ("should work with a mask");
         // replicate previews in the mask
         for (var i = 0; i < this.views.length; i++) {
            var r = this.views[i].window.previewRect (this.views[i]);
            //console.writeln ("going to replicate preview (",i,") x (",r.x0,") y (",r.y0,") w (",r.width,") h (",r.height,")");
            this.mask_views[i] = orig_mask_win.createPreview (r, this.views[i].id);
         }

         // create another identical image for the mask
         new_mask_win = new ImageWindow (
            this.new_image_width,
            this.new_image_height,
            this.views[0].image.numberOfChannels,
            this.views[0].image.bitsPerSample,
            this.views[0].image.sampleType != SampleType_Integer,
            this.views[0].image.colorSpace != ColorSpace_Gray,
            "Aggregated_mask"
         );

         mask_view = new_mask_win.mainView;
         mask_view.beginProcess (UndoFlag_NoSwapFile);
      }

      var view = window.mainView;
      view.stf = this.views[0].window.mainView.stf;
      view.beginProcess (UndoFlag_NoSwapFile);
         view.image.fill (0);
         if (do_mask) { mask_view.image.fill (0); }

         // paste previews in their proper place
         for (var i = 0; i < this.views.length; i++) {
            //console.writeln ("applying image (",i,")");
            view.image.selectedPoint = this.anchors[i];
            view.image.apply (this.views[i].image);

            if (do_mask) {
               mask_view.image.selectedPoint = this.anchors[i];
               mask_view.image.apply (this.mask_views[i].image);
            }
         }
      view.endProcess();
      if (do_mask) {
         mask_view.endProcess();

         // delete created previews
         for (var i = 0; i < this.mask_views.length; i++) {
            orig_mask_win.deletePreview (this.mask_views[i]);
         }

         // assign mask
         window.mask = new_mask_win;
      }

      // usually users will create a preview on the new image. Anticipate it
      if ( this.createPreview )
         window.currentView =
               window.createPreview (0, 0, this.new_image_width, this.new_image_height);

      window.show();
      window.zoomToOptimalFit();

      if (do_mask) {
         new_mask_win.show();
         new_mask_win.zoomToOptimalFit();
      }
   }
}
var engine = new pa_engine();

function pa_dialog() {
   this.__base__ = Dialog;
   this.__base__();

   // ----- HELP LABEL

   this.helpLabel = new Label (this);
   this.helpLabel.frameStyle = FrameStyle_Box;
   this.helpLabel.margin = 4;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<b>" + TITLE + " v"+VERSION+"</b> &mdash; A script to create " +
      "a new image based on the contents of other images' previews. " +
      "Select the previews to be aggregated and click 'Ok'.";

   // ----- LIST OF TARGETS

   this.target_List = new TreeBox (this);
   this.target_List.alternateRowColor = true;
   this.target_List.setScaledMinSize (400, 200);
   this.target_List.font = new Font ("monospace", 10); // best to show tabulated data
   this.target_List.numberOfColumns = 2;
   this.target_List.headerVisible = true;
   this.target_List.headerSorting = true;
   this.target_List.setHeaderText (0, "Views");
   this.target_List.setHeaderText (1, "Dimensions");
   this.target_List.setHeaderAlignment (0, Align_Left);
   this.target_List.setHeaderAlignment (1, Align_Left);

   var active_id = ImageWindow.activeWindow.mainView.fullId;
   // Node creation helper
   this.addViewNode = function (parent, view) {
      var node = new TreeBoxNode (parent);
      node.checkable = true;
      var id = view.fullId;
      // automatically select all previews in the active window
      var arrow = id.indexOf ("->");
      var parent_id = id.substring (0, arrow);
      if (active_id == parent_id) {
         node.checked = true;
      } else {
         node.checked = false;
      }

      node.setText (0, id);

      var image = view.image;
      var metadata = format ("%5d x %5d x %d", image.width, image.height, image.numberOfChannels);
      node.setText (1, metadata);

      return node;
   }

   // build the view tree structure
   var windows = ImageWindow.windows;
   for (var i = 0; i < windows.length; ++i) {
      var previews = windows[i].previews;
      for (var j = 0; j < previews.length; ++j) {
         this.addViewNode (this.target_List, previews[j]);
      }
   }
   this.target_List.sort();

   // Ensure that all columns are initially visible
   this.target_List.adjustColumnWidthToContents (0);
   this.target_List.adjustColumnWidthToContents (1);

   this.target_GroupBox = new GroupBox (this);
   this.target_GroupBox.title = "Previews to aggregate";
   this.target_GroupBox.sizer = new VerticalSizer;
   this.target_GroupBox.sizer.margin = 4;
   this.target_GroupBox.sizer.spacing = 4;
   this.target_GroupBox.sizer.add (this.target_List, 100);

   // ----- BUTTONS

   this.ok_Button = new PushButton (this);
   this.ok_Button.text = "OK";
   // transfer the names of the selected images to the engine
   this.ok_Button.onClick = function() {
      for (n = 0; n < this.dialog.target_List.numberOfChildren; n++)
         if (this.dialog.target_List.child (n).checked)
            engine.imgIDs.push (this.dialog.target_List.child (n).text (0));
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton (this);
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.onClick = function() {
      this.dialog.cancel();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add (this.ok_Button);
   this.buttons_Sizer.add (this.cancel_Button);

   this.createPreview_CheckBox = new CheckBox( this );
   this.createPreview_CheckBox.text = "Create preview";
   this.createPreview_CheckBox.toolTip =
      "<p>Enable this option to create a full preview on the aggregated image.</p>"
   this.createPreview_CheckBox.onClick = function( checked ) {
      engine.createPreview = checked;
   };

   // ----- PACK EVERYTHING

   this.sizer = new VerticalSizer;
   this.sizer.margin = 6;
   this.sizer.spacing = 6;
   this.sizer.add (this.helpLabel);
   this.sizer.addSpacing (4);
   this.sizer.add (this.target_GroupBox, 100);
   this.sizer.add (this.createPreview_CheckBox );
   this.sizer.add (this.buttons_Sizer);

   this.windowTitle = TITLE + " Script v" + VERSION;
   this.adjustToContents();
}
pa_dialog.prototype = new Dialog;

function main() {

   console.hide();

   var dialog = new pa_dialog();

   for (;;) {
      if (!dialog.execute())
         break;

      if ( engine.imgIDs.length > 0 )
      {
         engine.load();
         engine.create_image();

         // Quit after successful execution.
         break;
      }
      else
      {
         var msg = new MessageBox(
               "<p>No preview was selected. Do you want to continue?</p>",
               TITLE, StdIcon_Warning, StdButton_Yes, StdButton_No );
         if ( msg.execute() != StdButton_Yes )
            break;
      }
   }
}

main();
