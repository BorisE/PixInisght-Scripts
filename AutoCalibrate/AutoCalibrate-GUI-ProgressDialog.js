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
    var labelWidth_Dark = this.font.width("dark-BIN_1-TEMP_25deg-EXPTIME_1200_n31.xisf");
    var labelWidth_Bias = this.font.width("bias-TEMP_25deg-BIN_1_n117.xisf");
	var labelWidth_FileInfo = this.font.width("Bias");
    var ttStr = ""; //temp str var

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
		   "Working dir: " + "";
		   setScaledMinWidth(600); //min width
	}


	//
	// 2. Current file and stage
	//
	// line 1
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

	this.Line1_sizer = new HorizontalSizer(this);
	with (this.Line1_sizer) {
	   spacing = 4;
	   add(this.CurrentFileName_Edit, 100);
	   add(this.CurrentFileStage_Edit);
	}
	/*
	// line 2
	this.CurrentDarksPath_Edit = new Edit(this);
	with (this.CurrentDarksPath_Edit) {
	 readOnly = true;
	 text = "SW250/Atik383/darks/-25";
	 toolTip =
	   "SW250/Atik383/darks/-25";
	}
	this.CurrentMasterBiasFile_Edit = new Edit(this);
	with (this.CurrentMasterBiasFile_Edit) {
	 readOnly = true;
	 text = "bias-TEMP_25deg-BIN_1_n117.xisf";
	 minWidth = labelWidth_FileInfo;
	 maxWidth = labelWidth_FileInfo;
	 //width = 4;
	 toolTip =
	   "bias-TEMP_25deg-BIN_1_n117.xisf";
	}
	this.CurrentMasterDarkFile_Edit = new Edit(this);
	with (this.CurrentMasterDarkFile_Edit) {
	 readOnly = true;
	 text = "dark-BIN_1-TEMP_25deg-EXPTIME_1200_n31.xisf";
	 minWidth = labelWidth_FileInfo;
	 maxWidth = labelWidth_FileInfo;
	 //width = 4;
	 toolTip =
	   "dark-BIN_1-TEMP_25deg-EXPTIME_1200_n31.xisf";
	}

	this.Line2_sizer = new HorizontalSizer(this);
	with (this.Line2_sizer) {
	   spacing = 4;
	   add(this.CurrentDarksPath_Edit, 100);
	   add(this.CurrentMasterBiasFile_Edit);
	   add(this.CurrentMasterDarkFile_Edit);
	}

	// line 3
	this.CurrentFlatsPath_Edit = new Edit(this);
	with (this.CurrentFlatsPath_Edit) {
	 readOnly = true;
	 text = "SW250/Atik383/flats/masterflats 20171209-16" ;
	 toolTip =
	   "SW250/Atik383/flats/masterflats 20171209-16";
	}
	this.CurrentMasterFlatFile_Edit = new Edit(this);
	with (this.CurrentMasterFlatFile_Edit) {
	 readOnly = true;
	 text = "flat-FILTER_B-BINNING_1.xisf";
	 minWidth = labelWidth_FileInfo;
	 maxWidth = labelWidth_FileInfo;
	 //width = 4;
	 toolTip =
	   "flat-FILTER_B-BINNING_1.xisf";
	}
	this.CurrentCosmeticCorrection_Edit = new Edit(this);
	with (this.CurrentCosmeticCorrection_Edit) {
	 readOnly = true;
	 text = "Cosmetic_SW250_Atik383";
	 minWidth = labelWidth_FileInfo;
	 maxWidth = labelWidth_FileInfo;
	 //width = 4;
	 toolTip =
	   "Cosmetic_SW250_Atik383";
	}

	this.Line3_sizer = new HorizontalSizer(this);
	with (this.Line3_sizer) {
	   spacing = 4;
	   add(this.CurrentFlatsPath_Edit, 100);
	   add(this.CurrentMasterFlatFile_Edit);
	   add(this.CurrentCosmeticCorrection_Edit);
	}
			*/
	this.currentStatus_GroupBox = new GroupBox(this);
	with (this.currentStatus_GroupBox) {
	   title = "Current file processing";

	   sizer = new VerticalSizer;
	   sizer.margin = 6;
	   sizer.spacing = 4;
	   sizer.add(this.Line1_sizer);
	   //sizer.add(this.Line2_sizer);
	   //sizer.add(this.Line3_sizer);
	   
	}

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
	 text = "";
	 minWidth = labelWidth_Count;
	 maxWidth = labelWidth_Count;
	 toolTip =
	   "<p>Total files to process.</p>" +
	   "</p>";
	}
	this.progressSlider = new Slider(this);
	with (this.progressSlider) {
		minValue = 0;
		maxValue = 0;
		value = 0;
	}

	this.Progress_Sizer = new HorizontalSizer;
	with (this.Progress_Sizer) {
	 spacing = 4;
	 add(this.CurrentFileCount_Edit);
	 add(this.TotalFiles_Edit);
	 add(this.progressSlider, 100);
	 //addStretch();
	}

	// Error messages

	this.ErrorMessage_Text = new TextBox(this);
	with (this.ErrorMessage_Text) {
		readOnly = true;
		minHeight = 300;
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
	//console.writeln("this.availableScreenRect.width = " + this.availableScreenRect.width + ", self.sizer.width=" + self.sizer.width);
	//this.position = new Point (this.availableScreenRect.width / 2, this.availableScreenRect.height / 2);


   this.initBar  = function (WorkPath, totalCnt)
   {
		with (this.helpLabel) {
		   text = "<p><b>" + TITLE + " v" + VERSION + "</b><br/>" +
			   INFO_STRING +
			   ".</p><p>" +
			   COPYRIGHT_STRING +
			   "</p>" +
			   "Working dir: [<b>" + WorkPath + "</b>]";
		}
		this.TotalFiles_Edit.text = totalCnt.toString();
		this.progressSlider.maxValue = totalCnt;
   }
  

   this.updateBar_NewFile = function (curI, curFile)
   {
      this.CurrentFileCount_Edit.text = curI.toString();
      this.CurrentFileName_Edit.text = curFile;
      this.CurrentFileName_Edit.text = curFile;	
      this.progressSlider.value = curI;
   }

   this.updateBar_NewProcess = function (processStage)
   {
      this.CurrentFileStage_Edit.text = processStage;
   }

   this.updateBar_Error = function (errorMessage, curFile)
   {
      this.ErrorMessage_Text.text += curFile + ": " + errorMessage + "\n";
   }

}

AutocalibrationProgressDialog.prototype = new Dialog;

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
