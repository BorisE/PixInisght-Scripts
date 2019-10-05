#ifndef AutoCalibrate_GUI_js
#define AutoCalibrate_GUI_js
#endif


#feature-id Batch Processing > AutoCalibration

#feature-info  An automated calibration, cosmetic and registration<br/>\
   <br/> \
   @todo \
   <br/> \
   Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko

#feature-icon  AutoCalibration.xpm

#define TITLE "AutoCalibration"
#define VERSION "3.2"
#define COMPILE_DATE "2019/09/15"

#define INFO_STRING "A script to perform all calibration routines in fully automatic manner."
#define COPYRIGHT_STRING "Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko<br/>"


#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>

// Includes
#ifndef AutoCalibrate_Include_GUI_js
#include "AutoCalibrate-GUI-include.js"    // GUI functions
#endif

#ifndef AutoCalibate_Engine_js
#include "AutoCalibrate-engine.js"    // Constants, glbal vars
#endif

//Vars
#ifndef DEBUG
#define DEBUG     true
#endif

var Engine = new AutoCalibrateEngine();


function GlobalData()
{
   this.inputDir = "";
}
var data = new GlobalData();  //variable for global access to script data

this.exportParameters = function()
{
   Parameters.set("dir", data.inputDir);

	if( DEBUG ) {
		console.writeln( "<b>Parameters to save:</b>" );
		console.writeln( "InputDir: " + data.inputDir );

		console.writeln( "\n" );
	};
}
/*
 * Restore saved parameters.
 */
this.importParameters = function()
{

   if(Parameters.has("dir"))
      data.inputDir = Parameters.getString("dir");

   if( DEBUG ) {
		console.writeln( "<b>Loaded Parameters:</b>" );
		console.writeln( "InputDir: " + data.inputDir );

		console.writeln( "\n" );
	};


}


/*
 * dialog
 */
function AutocalibrationDialog()
{
   this.__base__ = Dialog;
   this.__base__();


   // Info Label
   this.helpLabel = new Label(this);
   with(this.helpLabel)
   {
      frameStyle = FrameStyle_Box;
      margin = 4;
      wordWrapping = true;
      useRichText = true;
      text = "<p><b>" + TITLE + " v" + VERSION + "</b><br/>" +
            INFO_STRING +
            ".</p><p>" +
            COPYRIGHT_STRING +
            "</p>"

   }


   // Input dir
   this.inputDir_Edit = new Edit( this );
   this.inputDir_Edit.readOnly = true;
   this.inputDir_Edit.text = data.inputDir;
   this.inputDir_Edit.toolTip =
      "<p>Specify which input directory is used for Autocalibrate.</p>" +
      "</p>";


   this.inputDirSelect_Button = new ToolButton( this );
   this.inputDirSelect_Button.icon = this.scaledResource( ":/browser/select-file.png" );
   this.inputDirSelect_Button.setScaledFixedSize( 20, 20 );
   this.inputDirSelect_Button.toolTip = "<p>Select the input directory.</p>";
   this.inputDirSelect_Button.onClick = function()
   {
      var gdd = new GetDirectoryDialog;
      gdd.initialPath = data.inputDir;
      gdd.caption = "Select Output Directory";

      if ( gdd.execute() )
      {
         data.inputDir = gdd.directory;
         this.dialog.inputDir_Edit.text = data.inputDir;
      }
   };

   this.inputDir_GroupBoxSelect_Button = new GroupBox( this );
   this.inputDir_GroupBoxSelect_Button.title = "Input Directory";
   this.inputDir_GroupBoxSelect_Button.sizer = new HorizontalSizer;
   this.inputDir_GroupBoxSelect_Button.sizer.margin = 6;
   this.inputDir_GroupBoxSelect_Button.sizer.spacing = 4;
   this.inputDir_GroupBoxSelect_Button.sizer.add( this.inputDir_Edit, 100 );
   this.inputDir_GroupBoxSelect_Button.sizer.add( this.inputDirSelect_Button );


   //Instance button
   this.newInstance_Button = new ToolButton(this);
   this.newInstance_Button.icon = new Bitmap( ":/process-interface/new-instance.png" );
   this.newInstance_Button.toolTip = "New Instance";
   this.newInstance_Button.onMousePress = function()
   {
      this.hasFocus = true;
      exportParameters();
      this.pushed = false;
      this.dialog.newInstance();
   };


   // Dialog control buttons
   ttStr = "Run the AutoCalibration routines";
   this.ok_Button = new pushButton(this, btnText[4], "", ttStr);
   this.ok_Button.onClick = function()
   {
      this.dialog.ok();
   }

   ttStr = "Close the " + TITLE +" script.";
   this.cancel_Button = new pushButton(this, btnText[1], "", ttStr);
   this.cancel_Button.onClick = function()
   {
      this.dialog.cancel();
   }


   //Dialog control buttons sizer
   this.buttons_Sizer = new HorizontalSizer;
   with(this.buttons_Sizer)
   {
      spacing = 6;
      add( this.newInstance_Button );
      addStretch();

      add( this.ok_Button );
      add( this.cancel_Button );
   }



   //main dialog sizers
   this.sizer = new VerticalSizer;
   with(this.sizer)
   {
      margin = 6;
      spacing = 6;
      add( this.helpLabel );
      addSpacing( 4 );
      add(this.inputDir_GroupBoxSelect_Button);
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
function main()
{
   if (!DEBUG)
      console.hide();

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
         if(data.inputDir == "")
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

}


main();
