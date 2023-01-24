 #ifndef AutoCalibrate_GUI_ProgressDialog_js
    #define AutoCalibrate_GUI_ProgressDialog_js
	console.writeln("AutoCalibrate_GUI_ProgressDialog_js");
 #endif

// Includes
 #ifndef AutoCalibrate_Global_js
    #include "AutoCalibrate-global.js" // Ver, Title and other info
 #endif
#ifndef AutoCalibrate_settings_js
    console.warningln('Creating Config due to main routine malfunction');
    #ifndef DEBUG
		#define DEBUG true
	#endif
	#include "AutoCalibrate-settings.js" // Settings
    var Config = new ConfigData(); //variable for global access to script data
    //Need to be in front of other declarations
    #include "AutoCalibrate-config-default.js" // Config part.
 #endif
 #ifndef AutoCalibrate_Include_GUI_js
    #include "AutoCalibrate-GUI-include.js" // GUI functions
 #endif
 #ifndef AutoCalibate_Engine_js
    #include "AutoCalibrate-engine.js" // Engine
 #endif

// JS components
 #include <pjsr/StdButton.jsh>
 #include <pjsr/StdIcon.jsh>
 #include <pjsr/FrameStyle.jsh>
 #include <pjsr/Sizer.jsh>
 #include <pjsr/TextAlign.jsh>
 #include <pjsr/SectionBar.jsh>

/*
 * dialog
 */
function AutocalibrationProgressDialog() {
    this.__base__ = Dialog;
    this.__base__();

	this.abortRequested = false;
    let self = this;

    var labelWidth_Count = this.font.width("999000");
    var labelWidth_Stage = this.font.width("Cosmetic Correction");
    var ttStr = ""; //temp str var


   this.initBar  = function (WorkPath, totalCnt)
   {
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
               "</p>" +
			   "Working dir: " + WorkPath;
               setScaledMinWidth(600); //min width
       }


       //
       // 2. Current file and stage
       //
       this.CurrentFileName_Edit = new Edit(this);
       with (this.CurrentFileName_Edit) {
         readOnly = true;
         text = "";
         //minWidth = font.width("999000");
         //maxWidth = font.width("999000");
         //width = 4;
         toolTip =
           "<p>Current processing file name.</p>" +
           "</p>";
       }
       this.CurrentFileStage_Edit = new Edit(this);
       with (this.CurrentFileStage_Edit) {
         readOnly = true;
         text = "";
         minWidth = labelWidth_Stage;
         maxWidth = labelWidth_Stage;
         //width = 4;
         toolTip =
           "<p>Current processing stage.</p>" +
           "</p>";
       }
       this.currentStatus_GroupBox = new GroupBox(this);
       this.currentStatus_GroupBox.title = "Current file processing";
       this.currentStatus_GroupBox.sizer = new HorizontalSizer;
       this.currentStatus_GroupBox.sizer.margin = 6;
       this.currentStatus_GroupBox.sizer.spacing = 4;
       this.currentStatus_GroupBox.sizer.add(this.CurrentFileName_Edit, 100);
       this.currentStatus_GroupBox.sizer.add(this.CurrentFileStage_Edit);


       //
       // 3. ProgressBar
       //
       this.CurrentFileCount_Edit = new Edit(this);
       with (this.CurrentFileCount_Edit) {
         readOnly = true;
         text = "0";
         minWidth = labelWidth_Count;
         maxWidth = labelWidth_Count;
         //width = 4;
         toolTip =
           "<p>Current procrssing file number.</p>" +
           "</p>";
       }
       this.TotalFiles_Edit = new Edit(this);
       with (this.TotalFiles_Edit) {
         readOnly = true;
         text = totalCnt.toString();
         minWidth = labelWidth_Count;
         maxWidth = labelWidth_Count;
         toolTip =
           "<p>Total files to process.</p>" +
           "</p>";
       }

       this.Progress_Sizer = new HorizontalSizer;
       with (this.Progress_Sizer) {
         spacing = 4;
         add(this.CurrentFileCount_Edit);
         add(this.TotalFiles_Edit);
         addStretch();
       }

       this.ErrorMessage_Text = new TextBox(this);
		with (this.ErrorMessage_Text) {
			readOnly = true;
			toolTip =
			"<p>Error messages.</p>" +
			"</p>";
		}
	   
	   this.ErrorMessage_Sizer = new HorizontalSizer;
       with (this.ErrorMessage_Sizer) {
			spacing = 4;
			add(this.ErrorMessage_Text,100);
			//addStretch();
       }

       // Processing group box
       this.Progress_GroupBox = new GroupBox(this);
       with (this.Progress_GroupBox) {
           title = "Total progress";
           sizer = new VerticalSizer;
           sizer.margin = 6;
           sizer.spacing = 4;
           sizer.add(this.Progress_Sizer);
		   sizer.add(this.ErrorMessage_Sizer);
       }


		this.cancel_Button = new PushButton(this);
		with (this.cancel_Button) {
			defaultButton = true;
			text = "Cancel";
			toolTip = "Stop execution";
			icon = this.scaledResource(":/icons/cancel.png");
			onClick = function () {
				self.abortRequested = true;
				console.warningln("Cancel button pressed...");
				this.dialog.ok();
				console.warningln("Dialog closed...");
			};
		};

       //Dialog control buttons sizer
       this.buttons_Sizer = new HorizontalSizer;
       with (this.buttons_Sizer) {
           spacing = 6;
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
           add(this.currentStatus_GroupBox);
           add(this.Progress_GroupBox);
           addSpacing(10);
           add(this.buttons_Sizer);
       }

       this.windowTitle = TITLE + " Script";
       this.adjustToContents();

   }

   this.updateBar_NewFile = function (curI, curFile)
   {
      this.CurrentFileCount_Edit.text = curI.toString();
      this.CurrentFileName_Edit.text = curFile;
   }

   this.updateBar_NewProcess = function (processStage)
   {
      this.CurrentFileStage_Edit.text = processStage;
   }

   this.updateBar_Error = function (errorMessage, curFile)
   {
      this.ErrorMessage_Edit.text = curFile + ": " + errorMessage;
   }


}

//main
function mainTestGUIProgressBar() {
    console.warningln("SCRIPT IN TEST MODE");


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

    // Our dialog inherits all properties and methods from the core Dialog object.
    AutocalibrationProgressDialog.prototype = new Dialog;
    var dialog = new AutocalibrationProgressDialog();
    dialog.initBar("test",101);

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
                Engine.Process();
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

#ifndef Autocalibrate_Main
    mainTestGUIProgressBar();
#endif
