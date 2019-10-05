#ifndef AutoCalibrate_GUI_js
#define AutoCalibrate_GUI_js
#endif

// Includes
#ifndef AutoCalibrate_Global_js
#include "AutoCalibrate-global.js"          // Ver, Title and other info
#endif
#ifndef AutoCalibrate_settings_js
#include "AutoCalibrate-settings.js"      // Settings
#endif
#ifndef AutoCalibrate_Include_GUI_js
#include "AutoCalibrate-GUI-include.js"   // GUI functions
#endif
#ifndef AutoCalibate_Engine_js
#include "AutoCalibrate-engine.js"        // Engine
#endif

// JS components
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>


// Global switches
#ifndef DEBUG
#define DEBUG true
#endif


/*
 * dialog
 */
function AutocalibrationDialog()
{
   this.__base__ = Dialog;
   this.__base__();


   var labelWidth1 = this.font.width( "Output format hints:" + 'T' );
   var ttStr=""; //temp str var


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
      setScaledMinWidth( 600 ); //min width
   }

   //

   // Input dir section

   //

   this.inputDir_Edit = new Edit( this );
   this.inputDir_Edit.readOnly = true;
   this.inputDir_Edit.text = Config.InputPath;
   this.inputDir_Edit.minWidth = labelWidth1;
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
      gdd.initialPath = Config.InputPath;
      gdd.caption = "Select Output Directory";

      if ( gdd.execute() )
      {
         Config.InputPath = gdd.directory;
         this.dialog.inputDir_Edit.text = Config.InputPath;
      }
   };

   this.inputDir_GroupBoxSelect_Button = new GroupBox( this );
   this.inputDir_GroupBoxSelect_Button.title = "Input Directory";
   this.inputDir_GroupBoxSelect_Button.sizer = new HorizontalSizer;
   this.inputDir_GroupBoxSelect_Button.sizer.margin = 6;
   this.inputDir_GroupBoxSelect_Button.sizer.spacing = 4;
   this.inputDir_GroupBoxSelect_Button.sizer.add( this.inputDir_Edit , 100 );
   this.inputDir_GroupBoxSelect_Button.sizer.add( this.inputDirSelect_Button );


   //

   // Options section

   //

   var bpsToolTip = "<p>Autocalibrate output mode.</p>" +
      "<p>It is the way <i>AutoCalibrate</i> interpret where to output final files.</p>" +
      "<p><b>AUTO</b> reserved for future</p>" +
      "<p><b>PUT_IN_ROOT_SUBFOLDER</b>После обработки все файлы, которые найдутся в подпапках внутри структуры каталогов, будут размещены в единой стандартной структуре откалиброванных файлов. Удобно когда в папке объекта лежат папки сессий (M63/2018-10-02, M63/2018-10-12, ...)</p>" +
      "<p><b>PUT_IN_OBJECT_SUBFOLDER</b> Удобно использовать после съемки, пока все файлы за ночь в том числе по разным объектам находятся в одной папке. Скрипт сам сгруппирует на выходе по объектам. Как вариант использования данного режима: калибровка файлов в каталоге прямо во время съемки, только нужно выключить cfgSearchInSubDirs = false </p>" +
      "<p><b>PUT_FINALS_IN_OBJECT_SUBFOLDER</b> То же, что и предыдущий, но оставляет только самые финальные файлы (самой высокой степени обработки). Промежуточные сохраняются отдельно. Скрипт сам сгруппирует на выходе по объектам (удобно для поиска астероидов или любой обработки, требующей быстрого результата)</p>" +
	  "<p><b>ABSOLUTE</b> Вывод в заданную папку.</p>" +
      "<p><b>RELATIVE</b> Режим создания калиброванных файлов в каждой папке (актуально при вложенности папок).</p>" +
      "<p><b>RELATIVE_WITH_OBJECT_FOLDER</b> Тоже, что и предыдущий, только будут создаваться каталоги для каждого объекта.</p>" +
      "По умолчанию включено PUT_IN_ROOT_SUBFOLDER.</p>";

   this.pathMode_Label = new Label( this );
   this.pathMode_Label.text = "Mode:";
   this.pathMode_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.pathMode_Label.minWidth = labelWidth1;
   this.pathMode_Label.toolTip = bpsToolTip;

   this.pathMode_ComboBox = new ComboBox( this );
   this.pathMode_ComboBox.addItem( "AUTO (not implemented)" );
   this.pathMode_ComboBox.addItem( "PUT_IN_ROOT_SUBFOLDER" );
   this.pathMode_ComboBox.addItem( "PUT_IN_OBJECT_SUBFOLDER" );
   this.pathMode_ComboBox.addItem( "ABSOLUTE" );
   this.pathMode_ComboBox.addItem( "RELATIVE" );
   this.pathMode_ComboBox.addItem( "RELATIVE_WITH_OBJECT_FOLDER" );
   this.pathMode_ComboBox.addItem( "PUT_FINALS_IN_OBJECT_SUBFOLDER" );
   this.pathMode_ComboBox.currentItem= Config.PathMode; //Default choice
   this.pathMode_ComboBox.toolTip = bpsToolTip;
   this.pathMode_ComboBox.onItemSelected = function( index )
   {
      switch ( index )
      {
      case 0:
         Config.PathMode = PATHMODE.AUTO;
         break;
      case 1:
         Config.PathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER;
         break;
      case 2:
         Config.PathMode = PATHMODE.PUT_IN_OBJECT_SUBFOLDER;
         break;
      case 3:
         Config.PathMode = PATHMODE.ABSOLUTE;
         break;
      case 4:
         Config.PathMode = PATHMODE.RELATIVE;
         break;
      case 5:
         Config.PathMode = PATHMODE.RELATIVE_WITH_OBJECT_FOLDER;
         break;
      case 6:
         Config.PathMode = PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER;
         break;
      default: // ?
         Config.PathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER;
         break;
      }
   };

   this.pathMode_Sizer = new HorizontalSizer;
   this.pathMode_Sizer.spacing = 4;
   this.pathMode_Sizer.add( this.pathMode_Label );
   this.pathMode_Sizer.add( this.pathMode_ComboBox );
   this.pathMode_Sizer.addStretch();


   //


   this.searchSubdirs_CheckBox = new CheckBox( this );
   this.searchSubdirs_CheckBox.text = "Search in subdirs";
   this.searchSubdirs_CheckBox.checked = Config.SearchInSubDirs;
   this.searchSubdirs_CheckBox.toolTip =
      "<p>Search in subdirs.</p>" +
      "<p>Set this to obtain desired mode.</p>";
   this.searchSubdirs_CheckBox.onClick = function( checked )
   {
      Config.SearchInSubDirs = checked;
   };

   this.searchSubdirs_Sizer = new HorizontalSizer;
   this.searchSubdirs_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.searchSubdirs_Sizer.add( this.searchSubdirs_CheckBox );
   this.searchSubdirs_Sizer.addStretch();

   //

   // Process section

   //

   this.ProcessCalibrate_CheckBox = new CheckBox( this );
   with (this.ProcessCalibrate_CheckBox)
   {
      text = "Calibrate";
      checked = Config.NeedCalibration;
      toolTip =
      "<p>Process basic calibration + cosmetic correction.</p>" +
      "<p>Automatically search for best MasterCalibration frames in library. Good idea to set it true.</p>";
      onClick = function( checked )
      {
         Config.NeedCalibration = checked;
      };
   }

   this.ProcessCalibrate_Sizer = new HorizontalSizer;
   with (this.ProcessCalibrate_Sizer)
   {
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessCalibrate_CheckBox );
      addStretch();
   }

   //

   this.ProcessABE_CheckBox = new CheckBox( this );
   with (this.ProcessABE_CheckBox)
   {
      text = "ABE";
      checked = Config.NeedABE;
      toolTip =
      "<p>Apply Automatic Background Extractor for every frame.</p>" +
      "<p>Usually should be kept off. Use LocalNormalization to control background</p>";
      onClick = function( checked )
      {
         Config.NeedABE = checked;
      };
   }

   this.ProcessABE_Sizer = new HorizontalSizer;
   with (this.ProcessABE_Sizer)
   {
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessABE_CheckBox );
      addStretch();
   }

   //

   this.ProcessRegister_CheckBox = new CheckBox( this );
   with (this.ProcessRegister_CheckBox)
   {
      text = "Register";
      checked = Config.NeedRegister;
      toolTip =
      "<p>Automatically Register every frame.</p>" +
      "<p>It uses reference library for every object</p>";
      onClick = function( checked )
      {
         Config.NeedRegister = checked;
      };
   }

   this.ProcessRegister_Sizer = new HorizontalSizer;
   with (this.ProcessRegister_Sizer)
   {
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessRegister_CheckBox );
      addStretch();
   }

   //

   this.ProcessNormalization_CheckBox = new CheckBox( this );
   with (this.ProcessNormalization_CheckBox)
   {
      text = "LocalNormalization";
      checked = Config.NeedNormalization;
      toolTip =
      "<p>Automatically apply LocalNormalization to every frame.</p>" +
      "<p>It uses reference library for every object, filter and exposure</p>";
      onClick = function( checked )
      {
         Config.NeedNormalization = checked;
      };
   }

   this.ProcessNormalization_Sizer = new HorizontalSizer;
   with (this.ProcessNormalization_Sizer)
   {
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessNormalization_CheckBox );
      addStretch();
   }

   //

   this.ProcessGroupBox = new GroupBox( this );
   with (this.ProcessGroupBox)
   {
      //title = "Processing";
      sizer = new VerticalSizer;
      sizer.margin = 6;
      sizer.spacing = 4;
      sizer.add( this.ProcessCalibrate_Sizer );
      sizer.add( this.ProcessABE_Sizer );
      sizer.add( this.ProcessRegister_Sizer );
      sizer.add( this.ProcessNormalization_Sizer );

   }


   this.ProcessSection = new SectionBar;
   this.ProcessSection.setTitle( "Processing" );
   this.ProcessSection.setSection( this.ProcessGroupBox );














   //


   this.OptionsGroupBox = new GroupBox( this );
   this.OptionsGroupBox.title = "Options";
   this.OptionsGroupBox.sizer = new VerticalSizer;
   this.OptionsGroupBox.sizer.margin = 6;
   this.OptionsGroupBox.sizer.spacing = 4;
   this.OptionsGroupBox.sizer.add( this.pathMode_Sizer );
   this.OptionsGroupBox.sizer.add( this.searchSubdirs_Sizer );


   //


      //
   var fmtHintToolTip = "<p>Format hints allow you to override global file format settings for " +
      "image files used by specific processes. In BatchFormatConversion, input hints change " +
      "the way input images of some particular file formats are read.</p>" +
      "<p>For example, you can use the \"raw\" input hint to force the DSLR_RAW format to load a pure " +
      "raw image without applying any deBayering, interpolation, white balance or black point " +
      "correction. Most standard file format modules support hints; each format supports a " +
      "number of input and/or output hints that you can use for different purposes with tools and " +
      "scripts that give you access to format hints.</p>";


   //

   var outExtToolTip = "<p>Specify a file extension to identify the output file format.</p>" +
      "<p>Be sure the selected output format is able to write images, or the batch conversion " +
      "process will fail upon attempting to write the first output image.</p>" +
      "<p>Also be sure that the output format can generate images with the specified output " +
      "sample format (see below), if you change the default setting.</p>";

   this.outputExt_Label = new Label( this );
   this.outputExt_Label.text = "Output extension:";
   this.outputExt_Label.minWidth = labelWidth1;
   this.outputExt_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.outputExt_Label.toolTip = outExtToolTip;

   this.outputExt_Edit = new Edit( this );
   this.outputExt_Edit.text = engine.outputExtension;
   this.outputExt_Edit.setFixedWidth( this.font.width( "MMMMMM" ) );
   this.outputExt_Edit.toolTip = outExtToolTip;
   this.outputExt_Edit.onEditCompleted = function()
   {
      // Image extensions are always lowercase in PI/PCL.
      var ext = this.text.trim().toLowerCase();

      // Use the default extension if empty.
      // Ensure that ext begins with a dot character.
      if ( ext.length == 0 || ext == '.' )
         ext = DEFAULT_OUTPUT_EXTENSION;
      else if ( !ext.startsWith( '.' ) )
         ext = '.' + ext;

      this.text = engine.outputExtension = ext;
   };

   this.options_Sizer = new HorizontalSizer;
   this.options_Sizer.spacing = 4;
   this.options_Sizer.add( this.outputExt_Label );
   this.options_Sizer.add( this.outputExt_Edit );
   this.options_Sizer.addStretch();

   //

   var bpsToolTip = "<p>Sample format for output images.</p>" +
      "<p>Note that these settings are just a <i>hint</i>. The script will convert all " +
      "input images to the specified sample format, if necessary, but it can be ignored " +
      "by the output format if it is unable to write images with the specified bit depth " +
      "and sample type.</p>";

   this.sampleFormat_Label = new Label( this );
   this.sampleFormat_Label.text = "Sample format:";
   this.sampleFormat_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.sampleFormat_Label.minWidth = labelWidth1;
   this.sampleFormat_Label.toolTip = bpsToolTip;

   this.sampleFormat_ComboBox = new ComboBox( this );
   this.sampleFormat_ComboBox.addItem( "Same as input images" );
   this.sampleFormat_ComboBox.addItem( "8-bit unsigned integer" );
   this.sampleFormat_ComboBox.addItem( "16-bit unsigned integer" );
   this.sampleFormat_ComboBox.addItem( "32-bit unsigned integer" );
   this.sampleFormat_ComboBox.addItem( "32-bit IEEE 754 floating point" );
   this.sampleFormat_ComboBox.addItem( "64-bit IEEE 754 floating point" );
   this.sampleFormat_ComboBox.toolTip = bpsToolTip;
   this.sampleFormat_ComboBox.onItemSelected = function( index )
   {
      switch ( index )
      {
      case 0:
         engine.bitsPerSample = 0; // same as input
         break;
      case 1:
         engine.bitsPerSample = 8;
         engine.floatSample = false;
         break;
      case 2:
         engine.bitsPerSample = 16;
         engine.floatSample = false;
         break;
      case 3:
         engine.bitsPerSample = 32;
         engine.floatSample = false;
         break;
      case 4:
         engine.bitsPerSample = 32;
         engine.floatSample = true;
         break;
      case 5:
         engine.bitsPerSample = 64;
         engine.floatSample = true;
         break;
      default: // ?
         break;
      }
   };

   this.sampleFormat_Sizer = new HorizontalSizer;
   this.sampleFormat_Sizer.spacing = 4;
   this.sampleFormat_Sizer.add( this.sampleFormat_Label );
   this.sampleFormat_Sizer.add( this.sampleFormat_ComboBox );
   this.sampleFormat_Sizer.addStretch();

   //

   this.outputHints_Label = new Label( this );
   this.outputHints_Label.text = "Output format hints:";
   this.outputHints_Label.minWidth = labelWidth1;
   this.outputHints_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
   this.outputHints_Label.toolTip = fmtHintToolTip;

   this.outputHints_Edit = new Edit( this );
   this.outputHints_Edit.text = engine.outputHints;
   this.outputHints_Edit.toolTip = fmtHintToolTip;
   this.outputHints_Edit.onEditCompleted = function()
   {
       // Format hints are case-sensitive.
       var hint = this.text.trim();
       this.text = engine.outputHints = hint;
   };

   this.outputHints_Sizer = new HorizontalSizer;
   this.outputHints_Sizer.spacing = 4;
   this.outputHints_Sizer.add( this.outputHints_Label );
   this.outputHints_Sizer.add( this.outputHints_Edit, 100 );

   //

   this.overwriteExisting_CheckBox = new CheckBox( this );
   this.overwriteExisting_CheckBox.text = "Overwrite existing files";
   this.overwriteExisting_CheckBox.checked = engine.overwriteExisting;
   this.overwriteExisting_CheckBox.toolTip =
      "<p>Allow overwriting of existing image files.</p>" +
      "<p><b>* Warning *</b> This option may lead to irreversible data loss - enable it at your own risk.</p>";
   this.overwriteExisting_CheckBox.onClick = function( checked )
   {
      engine.overwriteExisting = checked;
   };

   this.overwriteExisting_Sizer = new HorizontalSizer;
   this.overwriteExisting_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.overwriteExisting_Sizer.add( this.overwriteExisting_CheckBox );
   this.overwriteExisting_Sizer.addStretch();

   //

   this.outputOptions_GroupBox = new GroupBox( this );
   //this.outputOptions_GroupBox.title = "Basic Options";
   this.outputOptions_GroupBox.sizer = new VerticalSizer;
   this.outputOptions_GroupBox.sizer.margin = 6;
   this.outputOptions_GroupBox.sizer.spacing = 4;
   this.outputOptions_GroupBox.sizer.add( this.options_Sizer );
   this.outputOptions_GroupBox.sizer.add( this.sampleFormat_Sizer );
   this.outputOptions_GroupBox.sizer.add( this.outputHints_Sizer );
   this.outputOptions_GroupBox.sizer.add( this.overwriteExisting_Sizer );


   this.TestSection = new SectionBar;
   this.TestSection.setTitle( "Misc Options" );
   this.TestSection.setSection( this.outputOptions_GroupBox );


   //

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
      add(this.OptionsGroupBox );

      add(this.ProcessSection );
      add(this.ProcessGroupBox );

      add(this.TestSection );
      add(this.outputOptions_GroupBox );


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
         if(Config.InputPath == "")
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
