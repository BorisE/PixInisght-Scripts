#feature-id Batch Processing > AutoCalibration

#feature-info  An automated calibration, cosmetic and registration<br/>\
   <br/> \
   @todo \
  <br/> \
   Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko

#feature-icon  AutoCalibration.xpm

//File id
#define Autocalibrate_Main

// Global switches
#ifndef DEBUG
#define DEBUG true
#endif

// Includes
#ifndef AutoCalibrate_Global_js
#include "AutoCalibrate-global.js"			// Ver, Title and other info
#endif
#ifndef AutoCalibrate_settings_js
#include "AutoCalibrate-settings.js"		// Settings object
#endif
var Config = new ConfigData();          	// Variable for global access to script data
											// Need to be in front of other declarations

#ifndef AutoCalibrate_config_default_js
#include "AutoCalibrate-config-default.js"     // Load default config values
#endif


#ifndef AutoCalibrate_GUI_js
#include "AutoCalibrate-GUI.js"           // GUI
#endif
#ifndef AutoCalibate_Engine_js
#include "AutoCalibrate-engine.js"        // Engine
#endif




//////////////////////////////////////////
// Конфигурация
//////////////////////////////////////////

//#include "AutoCalibrate-config.js"     // Конкретный config. Можно просто в тексте определить переменные


//Engine
var Engine = new AutoCalibrateEngine();


//main
function main()
{
   if (!DEBUG)
      console.hide();

   if (DEBUG)
      //console.clear();

   console.noteln( TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE );
   console.noteln( "PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
                   ", ", coreVersionMinor, ", ", coreVersionRelease );

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


   // Our dialog inherits all properties and methods from the core Dialog object.
   AutocalibrationDialog.prototype = new Dialog;
   var dialog = new AutocalibrationDialog();

   // Show our dialog box, quit if cancelled.
   for ( ;; )
   {
      if (dialog.execute())
      {
         if(Config.InputPath == "" || !File.directoryExists(Config.InputPath))
         {
            var msgStr = "<p><b>Non existing input path</b> (or not specified).</p>" +
                           "<p>Please correct this</p>";
            var msg = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Ok);
            if(msg.execute() == StdButton_Ok)
               continue;
            else
               break;
         }
         else
         {
            Config.saveSettings();
            console.writeln("Executing...");
            console.show();
            processEvents();

            Console.writeln('InputPath: ' + Config.InputPath);

            Engine.Process();
            break;
         }
      }
      else
      {
            var msgStr = "<p>You are to exit script.</p>" +
                           "<p>Do you want to <b>save settings</b> before exit (or even <b>cancel exit</b>)?</p>";
            var msgBox = new MessageBox(msgStr, TITLE, StdIcon_Warning, StdButton_Yes, StdButton_No, StdButton_Cancel);
            //break; //for debug
            var answer = msgBox.execute();
            if(answer == StdButton_Yes)
            {
               Config.saveSettings();
               break;
            }
            else if(answer == StdButton_Cancel)
            {
               continue;
            }
            else
            {
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


