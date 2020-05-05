/*
   AberrationSpotter.js v0.3

   Groups the corners of an image into a new one

   Copyright (C) 2007-2017 David Serrano

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
   0.3:  2017/07/08 - Unhardcode the number of channels. Tested with 1 and 3.
   0.2:  2009/07/14 - Changed AS_settings variable to the_AS_settings to avoid
         redefinition warning. Several cosmetic fixes to the dialog.
   0.1:  Initial version.
*/

#define VERSION "0.3b"
#define SURNAME "_corners"
#define SET_PREFIX "aberration_spotter"

#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/UndoFlag.jsh>

#feature-id Image Analysis > AberrationSpotter++

#feature-info A simple script that creates an image containing the corners \
   and, optionally, the center of another image. Useful to highlight the \
   aberrations of the optical elements used.<br><br/>\
   <br/>\
   Copyright &copy; 2007-2017 David Serrano

#feature-icon aberration-spotter.xpm

function AS_user_data() {
    this.hsize = 150;         // pixels
    this.vsize = 150;         // pixels
    this.show_center = true;
    this.sep = 50;            // percent
    this.bgcolor = 0.25;      // normalized value
    this.delete_settings = false;
}
var user_data = new AS_user_data;

function AS_engine() {
    var rect = new Rect;   // for creating previews...
    var points;            // ...we'll move rect to these points
    var dest_points;       // points in the destination image
    var win;               // original window
    var sep;               // user_data.sep translated into pixels
    // randomized ids, to avoid clashing with (maybe) existing ones
    var preview_ids = new Array (
        "UL_so8fh", "UR_so8fh",
        "LL_so8fh", "LR_so8fh",
        "C_so8fh"
    );

    this.set_win = function (w) {
        if (w.isNull) {
            throw Error ("Invalid/No image window.");
        }

        this.win = w;
    }

    this._calc_sep = function() {
        if (user_data.show_center) {
            this.sep = Math.floor (
                Math.min (user_data.hsize, user_data.vsize) * user_data.sep / 100
            );
            if (this.sep < 1) this.sep = 1;
        } else {
            this.sep = 1;
        }
    }

    // creates points in both the original and destination images
    this._create_points = function() {
        var img = this.win.mainView.image;
        if (!user_data.show_center) {
            preview_ids.pop();     // remove "C" from its elements
        }

        this.nchannels = img.numberOfChannels;
        this.has_colour = 1 != this.nchannels;

        // source points
        this.points = new Array;
        this.points[preview_ids[0]] = new Point (0, 0);
        this.points[preview_ids[1]] = new Point (img.width - user_data.hsize - 1, 0);
        this.points[preview_ids[2]] = new Point (0, img.height - user_data.vsize - 1);
        this.points[preview_ids[3]] = new Point (
            img.width  - user_data.hsize - 1,
            img.height - user_data.vsize - 1
        );
        if (user_data.show_center) {
            this.points[preview_ids[4]] = new Point (
                Math.floor (img.bounds.center.x - user_data.hsize / 2),
                Math.floor (img.bounds.center.y - user_data.vsize / 2)
            );
        }

        // destination points
        this.dest_points = new Array;
        this.dest_points[preview_ids[0]] = new Point (0, 0);
        this.dest_points[preview_ids[1]] = new Point (user_data.hsize + this.sep, 0);
        this.dest_points[preview_ids[2]] = new Point (0, user_data.vsize + this.sep);
        this.dest_points[preview_ids[3]] = new Point (
            user_data.hsize + this.sep,
            user_data.vsize + this.sep
        );
        if (user_data.show_center) {
            this.dest_points[preview_ids[4]] = new Point (Math.floor (
                // dest image isn't created yet, so we have to guess its center
                // we'll use the same operation to create the image later
                (2 * user_data.hsize + this.sep) / 2 - (user_data.hsize / 2)
            ), Math.floor (
                (2 * user_data.vsize + this.sep) / 2 - (user_data.vsize / 2)
            ));
        }
    }

    this._create_previews = function() {
        // why "rect" instead of "this.rect"????
        rect.width  = user_data.hsize;
        rect.height = user_data.vsize;

        for (var i in preview_ids) {
            var str = preview_ids[i];
            rect.moveTo (this.points[str]);
            this.win.createPreview (rect, str);
        }
    }

    this._join_previews = function() {
        var v = this.win.mainView;
        // create destination image
        var dest = new ImageWindow (
            2 * user_data.hsize + this.sep,
            2 * user_data.vsize + this.sep,
            this.nchannels, v.image.bitsPerSample,
            v.image.sampleType == SampleType_Real,
            this.has_colour, v.id + SURNAME
        );
        with (dest.mainView) {
            beginProcess (UndoFlag_NoSwapFile);
            with (image) {
                fill (user_data.bgcolor);

                // copy previews into the destination image. Not the central one
                for (var i = 0; i < 4; i++) {
                    selectedPoint = this.dest_points[preview_ids[i]];
                    apply (this.win.previewById (preview_ids[i]).image);
                }
                resetSelections();

                // fill the center and put the central image over it
                if (user_data.show_center) {
                    var p = this.dest_points[preview_ids[4]];

                    // but only draw the "border" if separation is less than 100%
                    if (user_data.sep < 100) {
                        selectedRect = new Rect (
                            p.x - 1,
                            p.y - 1,
                            p.x + user_data.hsize + 1,
                            p.y + user_data.vsize + 1
                        );
                        fill (user_data.bgcolor);
                    }

                    selectedPoint = p;
                    apply (this.win.previewById (preview_ids[4]).image);
                }
            }
            endProcess();
        }
        dest.show();
    }

    this._destroy_all = function() {
        this.points = null;
        this.dest_points = null;
        for (var i = 0; i < preview_ids.length; i++) {
            this.win.deletePreview (this.win.previewById (preview_ids[i]));
        }
        rect = null;
        gc();
    }

    this.work = function() {
        this._calc_sep();
        this._create_points();
        this._create_previews();
        this._join_previews();
        this._destroy_all();
    }
}
var engine = new AS_engine;

function AS_dialog() {
    this.__base__ = Dialog;
    this.__base__();

    var labelWidth1 = this.font.width( "Separation between portions (%):" );

    // help label
    this.helpLabel = new Label (this);
    with (this.helpLabel) {
        frameStyle = FrameStyle_Box;
        margin = this.logicalPixelsToPhysical( 4 );
        wordWrapping = true;
        useRichText = true;
        text = "<p><b>AberrationSpotter v"+VERSION+"</b> &mdash; A " +
            "script to take the corners of an existing image and putting " +
            "them in another image. Optionally takes the center too. You " +
            "can choose the background brightness and the separation of " +
            "the corners (only if showing the center).</p>" +
            "<p>Copyright &copy; 2007-2017 David Serrano</p>";
    }

    // horizontal size
    this.hsize_NC = new NumericControl (this);
    with (this.hsize_NC) {
        label.text = "Horizontal size:";
        label.minWidth = labelWidth1;
        setRange (2, 1500);
        slider.setRange (0, 498);
        slider.scaledMinWidth = 300;
        setPrecision (0);
        setValue (user_data.hsize);
        toolTip = "<p>Horizontal size of each image portion.</p>"
        onValueUpdated = function (value) { user_data.hsize = value; }
    }

    // vertical size
    this.vsize_NC = new NumericControl (this);
    with (this.vsize_NC) {
        label.text = "Vertical size:";
        label.minWidth = labelWidth1;
        setRange (2, 1500);
        slider.setRange (0, 498);
        slider.scaledMinWidth = 300;
        setPrecision (0);
        setValue (user_data.vsize);
        toolTip = "<p>Vertical size of each image portion.</p>"
        onValueUpdated = function (value) { user_data.vsize = value; }
    }

    // separation
    this.sep_NC = new NumericControl (this);
    with (this.sep_NC) {
        label.text = "Separation between portions (%):";
        label.minWidth = labelWidth1;
        setRange (0, 100);
        slider.setRange (0, 101);
        slider.scaledMinWidth = 300;
        setPrecision (0);
        setValue (user_data.sep);
        toolTip = "<p>Portions of the image will be separated this amount. It " +
            "represents a percentage over the size of each portion. Ignored " +
            "if we're not showing the center.</p>";
        enabled = user_data.show_center;
        onValueUpdated = function (value) { user_data.sep = value; }
    }

    // background color
    this.bc_NC = new NumericControl (this);
    with (this.bc_NC) {
        label.text = "Background brightness:";
        label.minWidth = labelWidth1;
        setRange (0, 1);
        slider.setRange (0, 101);
        slider.scaledMinWidth = 300;
        setPrecision (2);
        setValue (user_data.bgcolor);
        toolTip = "<p>Brightness of background. 0 is black and 1 is white.</p>";
        onValueUpdated = function (value) { user_data.bgcolor = value; }
    }

    // show center checkbox
    this.sc_CB = new CheckBox (this);
    with (this.sc_CB) {
        text = "Show center";
        checked = user_data.show_center;
        toolTip = "<p>Check to show the center portion of the image. The " +
            "separation is ignored if the center isn't to be shown.</p>";
        onCheck = function (checked) { user_data.show_center = checked;
                                       this.parent.sep_NC.enabled = checked; }
    }

    this.sc_HS = new HorizontalSizer;
    with ( this.sc_HS ) {
        addSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
        add( this.sc_CB );
        addStretch();
    }

    // delete settings checkbox
    this.ds_CB = new CheckBox (this);
    with (this.ds_CB) {
        text = "Delete settings and exit";
        checked = user_data.delete_settings;
        onCheck = function (checked) { user_data.delete_settings = checked; }
        toolTip = "<p>Check to remove the stored settings and exit the program.</p>";
    }

    this.ds_HS = new HorizontalSizer;
    with ( this.ds_HS ) {
        addSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
        add( this.ds_CB );
        addStretch();
    }

    // buttons
    this.ok_Button = new PushButton (this);
    this.ok_Button.text = "OK";
    this.ok_Button.onClick = function() { this.dialog.ok(); };

    this.cancel_Button = new PushButton (this);
    this.cancel_Button.text = "Cancel";
    this.cancel_Button.onClick = function() { this.dialog.cancel(); };

    this.buttons_Sizer = new HorizontalSizer;
    this.buttons_Sizer.spacing = 6;
    this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add (this.ok_Button);
    this.buttons_Sizer.add (this.cancel_Button);

    // pack everything
    this.sizer = new VerticalSizer;
    with (this.sizer) {
        margin = 6;
        spacing = 6;
        add (this.helpLabel);
        addSpacing (4);
        add (this.hsize_NC);
        add (this.vsize_NC);
        add (this.sep_NC);
        add (this.bc_NC);
        add (this.sc_HS);
        add (this.ds_HS);
        add (this.buttons_Sizer);
    }

    this.windowTitle = "AberrationSpotter v" + VERSION;
    this.adjustToContents();
    this.setFixedSize();
}
AS_dialog.prototype = new Dialog;

function AS_settings() {
    var conf = new Array (
        // important: use the same name as the user_data variables
        new Array ("hsize", DataType_UInt16),
        new Array ("vsize", DataType_UInt16),
        new Array ("show_center", DataType_Boolean),
        new Array ("sep", DataType_UInt16),
        new Array ("bgcolor", DataType_Float)
    );

    this.load = function() {
        var temp;

        for (var i in conf) {
            var str  = conf[i][0];
            var type = conf[i][1];

            temp = Settings.read (SET_PREFIX + "/" + str, type);
            if (Settings.lastReadOK) {
                user_data[str] = temp;
            } else {
                console.writeln (format (
                    "Couldn't read setting '%s/%s'", SET_PREFIX, str
                ));
            }
        }
    }

    this.save = function() {
        for (var i in conf) {
            var str  = conf[i][0];
            var type = conf[i][1];

            Settings.write (SET_PREFIX + "/" + str, type, user_data[str]);
        }
    }

    this.del = function() {
        Settings.remove (SET_PREFIX);
    }
}
var the_AS_settings = new AS_settings;

function main() {
    engine.set_win (ImageWindow.activeWindow);

    the_AS_settings.load();

    var dialog = new AS_dialog;   // has to be done after settings are loaded
    if (!dialog.execute()) {
        return;
    }

    if (user_data.delete_settings) {
        the_AS_settings.del();
        return;
    } else {
        the_AS_settings.save();
    }

    engine.work();
}

main();
