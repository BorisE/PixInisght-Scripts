/*
   PropagatePreviews.js

   Script that allows to copy all selected previews from active image
   to selected target images, preserving or deleting existing previews.

   Written by Enzo De Bernardini (PixInsight user)

   Some parts of the code were based on PreviewAggregator.js v0.2.2, by David Serrano (2009)
*/

/*
   Changelog:
   1.0.0: First release in PixInsight Forum
   1.1.0: GUI, previews selection list, target selection list, preserve previews option
   1.1.0b1: Boris Emchenko edit bases on 1.1.0
*/

/*
TODO
- Size validation (don't allow previews offsite of targets image area)
- Some code cleaning
*/

#feature-id    Utilities > PropagatePreviews++

#feature-info  "<p>Script that allows you to copy selected previews from active image to selected open images.</p>"

#define TITLE  "PropagatePreviews"
#define VERSION "1.1.0"

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>

#define PRESERVE_PREVIEWS true

function pp_engine() {

   this.imgIDs           = new Array;
   this.tarIDs           = new Array;
   this.views            = new Array;
   this.targets          = new Array;
   this.previews_to_copy = new Array;
   this.preservePreview  = PRESERVE_PREVIEWS;

   // Populates the previews/targets array
   this.load = function() {
      // Previews selected
      for (var i = 0; i < this.imgIDs.length; i++) {
         this.views[i] = this.imgIDs[i];
      };
      // Targets selected
      for (var i = 0; i < this.tarIDs.length; i++) {
         this.targets[i] = this.tarIDs[i];
      };
   };
   // --

   this.propagatePreviews = function() {

      var r = 0;
      var k = 0;

      // Active image previews list
      var pwindow = ImageWindow.activeWindow;
      var pwview  = pwindow.mainView;
      var previews = pwindow.previews;
      var previews_to_copy = new Array();

      for ( var j = 0; j < previews.length; ++j ) {
         var pview = pwindow.previews[j];
         var prect = pwindow.previewRect( pview );
         if( this.views.indexOf( pview.id ) != -1 ) {
            this.previews_to_copy[k] = prect;
            k++;
         };
      };
      // --

      // Windows list
      var image_list = ImageWindow.windows;

      for ( var i = 0; i < image_list.length; i++ ) {
         var image_list_view = image_list[i].mainView;
         if( this.targets.indexOf( image_list_view.id ) != -1) {
            // if preservePreview is true, destination images preserve existings previews
            // if preservePreview is false, previews on destination images are deleted before new previews creation
            if( !this.preservePreview ) {
               image_list[i].deletePreviews();
            };
            console.writeln( "<br><b>Image " + image_list_view.id + "</b>" );
         };
         // --
         // Create each new preview
         for( var h = 0; h < this.previews_to_copy.length; h++ ) {
            if( this.targets.indexOf( image_list_view.id ) != -1) {
               image_list[i].createPreview( this.previews_to_copy[h] );
               console.writeln( " Preview Rect " + r + ": " + this.previews_to_copy[h] )
               r++;
            };
         };
         r = 0;
      };
      // --

   };

};

var engine = new pp_engine();

function pp_dialog() {

   this.__base__ = Dialog;
   this.__base__();

   this.helpLabel = new Label (this);
   this.helpLabel.frameStyle = FrameStyle_Box;
   this.helpLabel.margin = 4;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<b>" + TITLE + " v" + VERSION + "</b> &mdash; Script that allows to copy selected previews from active image to selected target images.";

   // List of previews on active image

   this.target_List = new TreeBox (this);
   this.target_List.alternateRowColor = true;
   this.target_List.setScaledMinSize (450, 150);
   this.target_List.font = new Font ("monospace", 10); // best to show tabulated data
   this.target_List.numberOfColumns = 3;
   this.target_List.headerVisible = true;
   this.target_List.headerSorting = true;
   this.target_List.setHeaderText (0, "Previews");
   this.target_List.setHeaderText (1, "Dimensions");
   this.target_List.setHeaderText (2, "Coordinates");
   this.target_List.setHeaderAlignment (0, Align_Left);
   this.target_List.setHeaderAlignment (1, Align_Left);
   this.target_List.setHeaderAlignment (2, Align_Left);

   var active_id = ImageWindow.activeWindow.mainView.fullId;

   // Node creation helper
   this.addViewNodePreviews = function( parent, view, rect ) {

      var node  = new TreeBoxNode( parent );
      var id    = view.id;
      var image = view.image;

      // Rectangle Data
      rect = rect.toString();
      rect = rect.replace("[","");
      rect = rect.replace("]","");
      var rect_array = rect.split(",");
      var rect_data = "x0: " + parseInt( rect_array[0] ) + ", x1: " + parseInt( rect_array[2] ) + ", y0: " + parseInt( rect_array[1] ) + ", y1: " + parseInt( rect_array[3] );
      //

      var metadata = format ("%d x %d", image.width, image.height);

      node.checkable = true;
      node.checked = true;
      node.setText ( 0, id );
      node.setText ( 1, metadata );
      node.setText ( 2, rect_data );

      return node;

   }

   // build the view tree structure

   // Active image previews list
   var pwindow   = ImageWindow.activeWindow;
   var pWindowId = pwindow.mainView.id;
   var previews  = pwindow.previews;

   for ( var j = 0; j < previews.length; ++j ) {
      this.addViewNodePreviews( this.target_List, previews[j], pwindow.previewRect( pwindow.previews[j] ) );
   }

   this.target_List.sort();

   // Ensure that all columns are initially visible
   this.target_List.adjustColumnWidthToContents (0);
   this.target_List.adjustColumnWidthToContents (1);
   this.target_List.adjustColumnWidthToContents (2);

   this.target_GroupBox = new GroupBox (this);
   this.target_GroupBox.title = "Previews to copy from " + pWindowId;
   this.target_GroupBox.sizer = new VerticalSizer;
   this.target_GroupBox.sizer.margin = 4;
   this.target_GroupBox.sizer.spacing = 4;
   this.target_GroupBox.sizer.add (this.target_List, 100);

   // List of images

   this.destination_List = new TreeBox (this);
   this.destination_List.alternateRowColor = true;
   this.destination_List.setScaledMinSize (450, 150);
   this.destination_List.font = new Font ("monospace", 10); // best to show tabulated data
   this.destination_List.numberOfColumns = 2;
   this.destination_List.headerVisible = true;
   this.destination_List.headerSorting = true;
   this.destination_List.setHeaderText (0, "Images");
   this.destination_List.setHeaderText (1, "Dimensions / Channels");
   this.destination_List.setHeaderText (2, "Current Previews");
   this.destination_List.setHeaderAlignment (0, Align_Left);
   this.destination_List.setHeaderAlignment (1, Align_Left);
   this.destination_List.setHeaderAlignment (2, Align_Left);

   // Node creation helper
   this.addViewNodeTargets = function( parent, view ) {

      var node = new TreeBoxNode( parent );
      var previewNumber = view.previews;
      var id = view.mainView.id;
      var image = view.currentView.image;
      var metadata = format ("%d x %d x %d", image.width, image.height, image.numberOfChannels);

      node.checkable = true;
      node.checked = false;
      node.setText (0, id);
      node.setText (1, metadata);
      node.setText (2, previewNumber.length + " preview(s)");

      return node;

   }

   // Image list
   var aWindows = ImageWindow.windows;
   for ( var j = 0; j < aWindows.length; ++j ) {
      // Avoid active image on targets list
      if( aWindows[j].mainView.id != pWindowId &&  aWindows[j].visible) {
         this.addViewNodeTargets( this.destination_List, aWindows[j] );
      };
   }

   this.destination_List.sort();

   // Ensure that all columns are initially visible
   this.destination_List.adjustColumnWidthToContents (0);
   this.destination_List.adjustColumnWidthToContents (1);
   this.destination_List.adjustColumnWidthToContents (2);

   this.destination_GroupBox = new GroupBox (this);
   this.destination_GroupBox.title = "Target images";
   this.destination_GroupBox.sizer = new VerticalSizer;
   this.destination_GroupBox.sizer.margin = 4;
   this.destination_GroupBox.sizer.spacing = 4;
   this.destination_GroupBox.sizer.add (this.destination_List, 100);

   // Buttons

   this.ok_Button = new PushButton (this);
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   // transfer the names of the selected images to the engine
   this.ok_Button.onClick = function() {
      for(n = 0; n < this.dialog.target_List.numberOfChildren; n++) {
         if( this.dialog.target_List.child(n).checked ) {
            engine.imgIDs.push( this.dialog.target_List.child(n).text(0) );
         };
      };
      for(n = 0; n < this.dialog.destination_List.numberOfChildren; n++) {
         if( this.dialog.destination_List.child(n).checked ) {
            engine.tarIDs.push( this.dialog.destination_List.child(n).text(0) );
         };
      };
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton (this);
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
   this.cancel_Button.onClick = function() {
      this.dialog.cancel();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add (this.ok_Button);
   this.buttons_Sizer.add (this.cancel_Button);

   this.preservePreview_CheckBox = new CheckBox( this );
   this.preservePreview_CheckBox.text = "Preverse existing previews";
   this.preservePreview_CheckBox.toolTip = "<p>Enable this option to preserve the existing previews of destination images.</p>";
   this.preservePreview_CheckBox.checked = PRESERVE_PREVIEWS;
   this.preservePreview_CheckBox.onClick = function( checked ) {
      engine.preservePreview = checked;
   };

   this.sizer = new VerticalSizer;
   this.sizer.margin = 6;
   this.sizer.spacing = 6;
   this.sizer.add (this.helpLabel);
   this.sizer.addSpacing (4);
   this.sizer.add (this.target_GroupBox, 100);
   this.sizer.add (this.destination_GroupBox, 100);
   this.sizer.add (this.preservePreview_CheckBox);
   this.sizer.add (this.buttons_Sizer);

   this.windowTitle = TITLE + " Script v" + VERSION;
   this.adjustToContents();
}
pp_dialog.prototype = new Dialog;

function main() {

   console.hide();

   var dialog = new pp_dialog();

   for (;;) {
      if (!dialog.execute())
         break;

      if ( engine.imgIDs.length > 0 && engine.tarIDs.length > 0 ) {
         engine.load();
         engine.propagatePreviews();
         // Quit after successful execution.
         break;
      } else {
         var msg = new MessageBox(
               "<p>No preview and/or target was selected.</p>",
               TITLE, StdIcon_Warning, StdButton_Ok );
         if ( msg.execute() == StdButton_Ok )
            break;
      }
   }
}

main();
