// Global switches
 #ifndef DEBUG
    #define DEBUG true
 #endif

 #ifndef OverscanStatistics_GUI_js
    #define OverscanStatistics_GUI_js
 #endif

// Includes
 #ifndef OverscanStatistics_Global_js
    #include "OverscanStatistics-global.js" // Ver, Title and other info
 #endif
 #ifndef OverscanStatistics_settings_js
    #include "OverscanStatistics-settings.js" // Settings
   var Config = new ConfigData(); // Variable for global access to script data
 #endif
 #ifndef OverscanStatistics_config_default_js
   #include "OverscanStatistics-config-default.js" // Load default config values
 #endif
  #ifndef OverscanStatistics_Include_GUI_js
    #include "OverscanStatistics-GUI-include.js" // GUI functions
 #endif

// JS components
 #include <pjsr/StdButton.jsh>
 #include <pjsr/StdIcon.jsh>
 #include <pjsr/FrameStyle.jsh>
 #include <pjsr/Sizer.jsh>
 #include <pjsr/TextAlign.jsh>
 #include <pjsr/SectionBar.jsh>


/* Working modes:
*    0 - unindentified
*    1 - get overscan statistics for a given path (and put it to the file)
*    2 - get overscan statistics for an active image window and make previews (bin 1)
*    3 - get overscan statistics for an active image window and make previews (bin 2)
*/
_WorkingMode = 0;


/*
 * dialog
 */
function OverscanStatisticsDialog() {

    this.__base__ = Dialog;
    this.__base__();

    var labelWidth1 = this.font.width("Output format hints :" + 'T');
    var ttStr = ""; //temp str var

    Console.noteln(Config.InputPath);

    //

    //Info Label

    //
    this.helpLabel = new Label(this);
    with (this.helpLabel) {
        frameStyle = FrameStyle_Box;
        margin = 4;
        wordWrapping = true;
        useRichText = true;
        text = "<p><b>" + TITLE + " v" + VERSION + "</b><br/>" +
            INFO_STRING +
            ".</p><p>" +
            COPYRIGHT_STRING +
            "</p>"
            setScaledMinWidth(600); //min width
    }


    //
    // 0. Working DIR
    //

    this.inputDir_Edit = new Edit(this);
    this.inputDir_Edit.readOnly = true;
    this.inputDir_Edit.text = Config.InputPath;
    this.inputDir_Edit.minWidth = labelWidth1;
    this.inputDir_Edit.toolTip =
        "<p>Specify which input directory is used for processes files.</p>" +
        "</p>";

    this.inputDirSelect_Button = new ToolButton(this);
    this.inputDirSelect_Button.icon = this.scaledResource(":/browser/select-file.png");
    this.inputDirSelect_Button.setScaledFixedSize(20, 20);
    this.inputDirSelect_Button.toolTip = "<p>Select the input directory.</p>";
    this.inputDirSelect_Button.onClick = function () {
        var gdd = new GetDirectoryDialog;
        gdd.initialPath = Config.InputPath;
        gdd.caption = "Select input directory";

        if (gdd.execute()) {
            Config.InputPath = gdd.directory;
            this.dialog.inputDir_Edit.text = Config.InputPath;
        }
    };

    this.GetDir_Sizer = new HorizontalSizer;
    with (this.GetDir_Sizer) {
        margin = 6;
        spacing = 4;
        add(this.inputDir_Edit, 100);
        add(this.inputDirSelect_Button);
    }

    this.searchSubdirs_CheckBox = new CheckBox(this);
    this.searchSubdirs_CheckBox.text = "Search in subdirs";
    this.searchSubdirs_CheckBox.checked = Config.SearchInSubDirs;
    this.searchSubdirs_CheckBox.toolTip =
        "<p>Search in subdirs.</p>";
    this.searchSubdirs_CheckBox.onClick = function (checked) {
        Config.SearchInSubDirs = checked;
    };

    this.GetDirOptions_Sizer = new HorizontalSizer;
    with (this.GetDirOptions_Sizer) {
        margin = 6;
        spacing = 4;
        add(this.searchSubdirs_CheckBox);
    }

    this.inputDir_GroupBox = new GroupBox(this);
    with (this.inputDir_GroupBox) {
        title = "Input folder";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.GetDir_Sizer);
        sizer.add(this.GetDirOptions_Sizer);

    }

    //
    // 1. Calculate Statistics
    //

    ttStr = "<p>Get overscan stat for files in a given path.</p>";
    this.runDirStat_Button = new pushButton(this, "Get statistics fo files", "", ttStr);
    this.runDirStat_Button.onClick = function () {
        _WorkingMode = 1;
        this.dialog.ok();
    }

    ttStr = "<p>Get overscan stat for current window.</p>";
    this.runWindStat_Button = new pushButton(this, "Statistics for current window", "", ttStr);
    this.runWindStat_Button.onClick = function () {
        _WorkingMode = 2;
        this.dialog.ok();
    }
    this.RunStat_Sizer = new HorizontalSizer;
    with (this.RunStat_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.runDirStat_Button, 80);
        add(this.runWindStat_Button, 80);
        addStretch();
    }

    //

    this.processStat_GroupBox = new GroupBox(this);
    with (this.processStat_GroupBox) {
        title = "Overscan statistics";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.RunStat_Sizer);
    }



    //
    // 2. Normalize Process
    //
    ttStr = "<p>Normalize bias level for files in a given path.</p>";
    this.runDirNorm_Button = new pushButton(this, "Normalize files", "", ttStr);
    this.runDirNorm_Button.onClick = function () {
        _WorkingMode = 3;
        this.dialog.ok();
    }

    ttStr = "<p>Normalize bias level for current window.</p>";
    this.runWindNorm_Button = new pushButton(this, "Normalize current window", "", ttStr);
    this.runWindNorm_Button.onClick = function () {
        _WorkingMode = 4;
        this.dialog.ok();
    }

    this.RunDirNormalize_Sizer = new HorizontalSizer;
    with (this.RunDirNormalize_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.runDirNorm_Button, 80);
        add(this.runWindNorm_Button, 80);
        addStretch();
    }

    this.normalize_GroupBox = new GroupBox(this);
    with (this.normalize_GroupBox) {
        title = "Normalize by optblack value";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.RunDirNormalize_Sizer);
    }


    //
    // 3. Modify Header Process
    //
    this.gain_Label = new Label(this);
    with (this.gain_Label) {
        margin = 4;
        text = "Gain";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }
    this.gain_SpinBox = new SpinBox(this);
    with (this.gain_SpinBox) {
        setFixedWidth(this.font.width("MMMM"));
        toolTip = "P3: Mode 1, Gain 0, Offset 10<br>P4: Mode 1, Gain 56, Offset 10<br>";
        maxValue = 255;
        stepSize = 1;
        minValue = 0;
        value = Config.AddData_Gain;
        onValueUpdated = function (value) {
            Config.AddData_Gain = value;
        }
    }

    this.offset_Label = new Label(this);
    with (this.offset_Label) {
        margin = 4;
        text = "Offset";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }
    this.offset_SpinBox = new SpinBox(this);
    with (this.offset_SpinBox) {
        setFixedWidth(this.font.width("MMMM"));
        toolTip = "";
        maxValue = 255;
        stepSize = 1;
        minValue = 0;
        value = Config.AddData_Offset;
        onValueUpdated = function (value) {
            Config.AddData_Offset = value;
        }
    }

    this.readmode_Label = new Label(this);
    with (this.readmode_Label) {
        margin = 4;
        text = "ReadMode";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }
    this.readmode_SpinBox = new SpinBox(this);
    with (this.readmode_SpinBox) {
        setFixedWidth(this.font.width("MMMM"));
        toolTip = "";
        maxValue = 4;
        stepSize = 1;
        minValue = 0;
        value = Config.AddData_ReadMode;
        onValueUpdated = function (value) {
            Config.AddData_ReadMode = value;
        }
    }

    this.usblimit_Label = new Label(this);
    with (this.usblimit_Label) {
        margin = 4;
        text = "USB limit";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }
    this.usblimit_SpinBox = new SpinBox(this);
    with (this.usblimit_SpinBox) {
        setFixedWidth(this.font.width("MMMM"));
        toolTip = "";
        maxValue = 255;
        stepSize = 1;
        minValue = 0;
        value = Config.AddData_USBLimit;
        onValueUpdated = function (value) {
            Config.AddData_USBLimit = value;
        }
    }

    this.parametersAddData_Sizer = new HorizontalSizer;
    with (this.parametersAddData_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.gain_Label);
        add(this.gain_SpinBox);
        add(this.offset_Label);
        add(this.offset_SpinBox);
        add(this.readmode_Label);
        add(this.readmode_SpinBox);
        add(this.usblimit_Label);
        add(this.usblimit_SpinBox);

        addStretch();
    }


    this.forceModify_CheckBox = new CheckBox(this);
    this.forceModify_CheckBox.text = "Force add data";
    this.forceModify_CheckBox.checked = Config.ForceHeaderModification;
    this.forceModify_CheckBox.toolTip =
        "<p>Force add data even if it is already in.</p>";
    this.forceModify_CheckBox.onClick = function (checked) {
        Config.ForceHeaderModification = checked;
    };
    this.otherOptionsAddData_Sizer = new HorizontalSizer;
    with (this.otherOptionsAddData_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.forceModify_CheckBox, 80);
        addStretch();
    }


    ttStr = "<p>Add data for files in a given path.</p>";
    this.runDirAddData_Button = new pushButton(this, "Add data to files", "", ttStr);
    this.runDirAddData_Button.onClick = function () {
        _WorkingMode = 5;
        //this.saveAddParameters();
        this.dialog.ok();
    }

    ttStr = "<p>Add datat for current window.</p>";
    this.runWindAddData_Button = new pushButton(this, "Add data to current window", "", ttStr);
    this.runWindAddData_Button.onClick = function () {
        _WorkingMode = 6;
        //this.saveAddParameters;
        this.dialog.ok();
    }

    this.RunAddData_Sizer = new HorizontalSizer;
    with (this.RunAddData_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.runDirAddData_Button, 80);
        add(this.runWindAddData_Button, 80);
        addStretch();
    }

    this.addData_GroupBox = new GroupBox(this);
    with (this.addData_GroupBox) {
        title = "Add camera data to FITS header";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;

        sizer.add(this.parametersAddData_Sizer);
        sizer.add(this.otherOptionsAddData_Sizer);
        sizer.add(this.RunAddData_Sizer);
    }


    //Instance button
    this.newInstance_Button = new ToolButton(this);
    this.newInstance_Button.icon = new Bitmap(":/process-interface/new-instance.png");
    this.newInstance_Button.toolTip = "New Instance";
    this.newInstance_Button.onMousePress = function () {
        this.hasFocus = true;
        Config.exportParameters();
        this.pushed = false;
        this.dialog.newInstance();
    };

    ttStr = "Close the " + TITLE + " script.";
    this.cancel_Button = new pushButton(this, btnText[1], "", ttStr);
    this.cancel_Button.onClick = function () {
        this.dialog.cancel();
    }

    //Dialog control buttons sizer
    this.buttons_Sizer = new HorizontalSizer;
    with (this.buttons_Sizer) {
        spacing = 6;
        add(this.newInstance_Button);
        addStretch();

        add(this.cancel_Button);
    }

    //main dialog sizers
    this.sizer = new VerticalSizer;
    with (this.sizer) {
        margin = 6;
        spacing = 6;
        add(this.helpLabel);
        addSpacing(4);
        add(this.inputDir_GroupBox);
        add(this.processStat_GroupBox);
        add(this.normalize_GroupBox);
        add(this.addData_GroupBox);

        //add(this.clearConsoleCheckBox_Sizer);
        addSpacing(10);
        //add(this.outputControls_GroupBox);
        //this.imgSetAccess_GroupBox.hide();
        add(this.buttons_Sizer);
    }

    this.windowTitle = TITLE + " Script";
    this.adjustToContents();
} // end of GUI function

//main
function mainGUI() {
    if (!DEBUG)
        console.hide();

    if (DEBUG)
        console.clear();

    console.noteln(TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE);
    console.noteln("PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
        ", ", coreVersionMinor, ", ", coreVersionRelease);

    Config.loadSettings();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        if (DEBUG)
            console.writeln("Script instance");
        this.importParameters();

    } else {
        if (DEBUG)
            console.writeln("Just new script");
    }

    //just for future features(?!)
    if (Parameters.isViewTarget) {
        if (DEBUG)
            console.writeln("Executed on target view");
    } else {
        if (DEBUG)
            console.writeln("Direct or global context");
    }

    var Engine = new ProcessEngine();

    // Our dialog inherits all properties and methods from the core Dialog object.
    OverscanStatisticsDialog.prototype = new Dialog;
    var dialog = new OverscanStatisticsDialog();

    // Show our dialog box, quit if cancelled.
    for (; ; ) {
        if (dialog.execute()) {
            if (Config.InputPath == "") {
                var msgStr = "<p>There are no input dir specified.</p>" +
                    "<p>Do you wish to continue?</p>";
                var msg = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
                if (msg.execute() == StdButton_Yes)
                    continue;
                else
                    break;
            } else {
                console.show();
                processEvents();
                console.noteln("Working mode: " + _WorkingMode);
                switch (_WorkingMode)
                {
                   case 1:
                      Engine.processDirectory(Config.InputPath);
                      break;
                   case 2:
                      Engine.processCurrentWindow();
                      break;
                   case 3:
                      break;
                }
                break;
            }
        } else {
            var msgStr = "<p>All infromation would be lost.</p>" +
                "<p>Are you sure?</p>";
            var msgBox = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
            break; //for debug
            if (msgBox.execute() == StdButton_Yes)
                break;
            else
                continue;
        }

        break;

    }

    Config.saveSettings();
}

#ifndef OverscanStatistics_Main
    mainGUI();
#endif
