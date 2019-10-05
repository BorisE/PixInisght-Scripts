#define Autocalibrate_Main


// Includes
#ifndef AutoCalibrate_Global_js
#include "AutoCalibrate-global.js"        // Ver, Title and other info
#endif
#ifndef AutoCalibrate_settings_js
#include "AutoCalibrate-settings.js"      // Settings
#endif
var Config = new ConfigData();            //variable for global access to script data
                                          //Need to be in front of other declarations

#ifndef AutoCalibrate_GUI_js
#include "AutoCalibrate-GUI.js"           // GUI
#endif
#ifndef AutoCalibate_Engine_js
#include "AutoCalibrate-engine.js"        // Engine
#endif



// Global switches
#ifndef DEBUG
#define DEBUG true
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
      console.clear();

   console.noteln( TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE );
   console.noteln( "PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
                   ", ", coreVersionMinor, ", ", coreVersionRelease );

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


   // Our dialog inherits all properties and methods from the core Dialog object.
   AutocalibrationDialog.prototype = new Dialog;
   var dialog = new AutocalibrationDialog();

   // Show our dialog box, quit if cancelled.
   for ( ;; )
   {
      if (dialog.execute())
      {
         if(Config.inputDir == "")
         {
            var msgStr = "<p>There are no input dir specified.</p>" +
                           "<p>Do you wish to continue?</p>";
            var msg = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
            if(msg.execute() == StdButton_Yes)
               continue;
            else
               break;
         }
         else
         {
            console.show();
            processEvents();
            Engine.Process();
            break;
         }
      }
      else
      {
            var msgStr = "<p>All infromation would be lost.</p>" +
                           "<p>Are you sure?</p>";
            var msgBox = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
            break; //for debug
            if(msgBox.execute() == StdButton_Yes)
               break;
            else
               continue;
      }

      break;

   }

   Config.saveSettings();
}


main();


