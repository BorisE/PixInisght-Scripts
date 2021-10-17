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
 #ifndef OverscanStatistics_Engine_js
    #include "OverscanStatistics-engine.js" // Engine
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
*    2 - get overscan statistics for an active image window and make previews
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

    // 1. Info Label

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
    // 2. Proccess Directory Statistics
    //
    this.inputDir_Edit = new Edit(this);
    this.inputDir_Edit.readOnly = true;
    this.inputDir_Edit.text = Config.InputPath;
    this.inputDir_Edit.minWidth = labelWidth1;
    this.inputDir_Edit.toolTip =
        "<p>Specify which input directory is used for gathering overscan stat.</p>" +
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

    ttStr = "<p>Get overscan stat for files in a given path.</p>";
    this.runDirStat_Button = new pushButton(this, "Get statistics", "", ttStr);
    this.runDirStat_Button.onClick = function () {
        _WorkingMode = 1;
        this.dialog.ok();
    }

    this.RunDirStat_Sizer = new HorizontalSizer;
    with (this.RunDirStat_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.runDirStat_Button, 40);
        addStretch();
    }


    //

    this.processDir_GroupBox = new GroupBox(this);
    with (this.processDir_GroupBox) {
        title = "Processing path";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.GetDir_Sizer);
        sizer.add(this.RunDirStat_Sizer);
    }





    //
    // 2. Proccess current window
    //

    ttStr = "<p>Get overscan stat for current window.</p>";
    this.runWindStat_Button = new pushButton(this, "Get statistics", "", ttStr);
    this.runWindStat_Button.onClick = function () {
        _WorkingMode = 2;
        this.dialog.ok();
    }

    this.RunWindowsStat_Sizer = new HorizontalSizer;
    with (this.RunWindowsStat_Sizer) {
        margin = 6;
        spacing = 4;
        //addUnscaledSpacing(this.logicalPixelsToPhysical(4));
        add(this.runWindStat_Button, 40);
        addStretch();
    }
    this.processWindow_GroupBox = new GroupBox(this);
    with (this.processWindow_GroupBox) {
        title = "Processing current window";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.RunWindowsStat_Sizer);
    }


    //

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

    // Dialog control buttons
    ttStr = "Run the AutoCalibration routines";
    this.ok_Button = new pushButton(this, btnText[4], "", ttStr);
    this.ok_Button.onClick = function () {
        _WorkingMode = 2;
        this.dialog.ok();
    }

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

        add(this.ok_Button);
        add(this.cancel_Button);
    }

    //main dialog sizers
    this.sizer = new VerticalSizer;
    with (this.sizer) {
        margin = 6;
        spacing = 6;
        add(this.helpLabel);
        addSpacing(4);
        add(this.processDir_GroupBox);
        add(this.processWindow_GroupBox);

        //add(this.clearConsoleCheckBox_Sizer);
        addSpacing(10);
        //add(this.outputControls_GroupBox);
        //this.imgSetAccess_GroupBox.hide();
        add(this.buttons_Sizer);
    }

    this.windowTitle = TITLE + " Script";
    this.adjustToContents();

}

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
