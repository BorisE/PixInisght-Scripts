#feature-id Batch Processing > OverscanStatistics

#feature-info  QHY600 overscan support tools<br/>\
   <br/> \
   @todo \
   <br/> \
   Copyright &copy; 2021 Boris Emchenko

#feature-icon OverscanStatistics.xpm


//File id
 #define OverscanStatistics_Main

// Global switches
 #ifndef DEBUG
 #define DEBUG true
 #endif


// Includes
 #ifndef OverscanStatistics_Global_js
 #include "OverscanStatistics-global.js" // Ver, Title and other info
 #endif
 #ifndef OverscanStatistics_settings_js
 #include "OverscanStatistics-settings.js" // Settings object
 #endif
 var Config = new ConfigData(); // Variable for global access to script data
// Need to be in front of other declarations

 #ifndef OverscanStatistics_config_default_js
 #include "OverscanStatistics-config-default.js" // Load default config values
 #endif

 #ifndef OverscanStatistics_GUI_js
 #include "OverscanStatistics-GUI.js" // GUI
 #endif
 #ifndef OverscanStatistics_Engine_js
 #include "OverscanStatistics-engine.js" // Engine
 #endif



function main()
{
    if (!DEBUG)
        console.hide();

    //if (DEBUG) console.clear();

    console.noteln(TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE);
    console.noteln("PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
        ", ", coreVersionMinor, ", ", coreVersionRelease);

    //Load Current Settings
    Config.loadSettings();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        if (DEBUG)
            console.writeln("Script instance");
        Config.importParameters();

    } else {
        if (DEBUG)
            console.writeln("<i>Just new script</i>");
    }

    //just for future features(?!)
    if (Parameters.isViewTarget) {
        if (DEBUG)
            console.writeln("<i>Executed on target view</i>");
    } else {
        if (DEBUG)
            console.writeln("<i>Direct or global context</i>");
    }

    // Main Processing Engine
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
                      Engine.processCurrentWindow_bin2();
                      break;
                }
                break;
            }
        } else {
            var msgStr = "<p>You are to exit script.</p>" +
                "<p>Do you want to <b>save settings</b> before exit (or even <b>cancel exit</b>)?</p>";
            var msgBox = new MessageBox(msgStr, TITLE, StdIcon_Warning, StdButton_Yes, StdButton_No, StdButton_Cancel);
            //break; //for debug
            var answer = msgBox.execute();
            if (answer == StdButton_Yes) {
                Config.saveSettings();
                break;
            } else if (answer == StdButton_Cancel) {
                continue;
            } else {
                break;
                //continue;
            }
        }

        break;

    }
    if (DEBUG)
        console.writeln("Script finished");

}

main();

