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
#include <pjsr/SectionBar.jsh>


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


   var labelWidth1 = this.font.width( "Output format hints :" + 'T' );
   var ttStr=""; //temp str var


   //
   
   // 1. Info Label
   
   //
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

   // 2. Input dir section

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

   // 3. Options section

   //

   // 3.1. Combobox PATH Mode
   
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


   // 3.2. CheckBox

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


   this.OptionsGroupBox = new GroupBox( this );
   this.OptionsGroupBox.title = "Options";
   this.OptionsGroupBox.sizer = new VerticalSizer;
   this.OptionsGroupBox.sizer.margin = 6;
   this.OptionsGroupBox.sizer.spacing = 4;
   this.OptionsGroupBox.sizer.add( this.pathMode_Sizer );
   this.OptionsGroupBox.sizer.add( this.searchSubdirs_Sizer );


   //

   // 4. Process section

   //

   // 4.1 Calibrate
   
   this.ProcessCalibrate_CheckBox = new CheckBox( this );
   with (this.ProcessCalibrate_CheckBox)
   {
      text = "Calibrate";
      checked = Config.NeedCalibration;
		minWidth = labelWidth1;
      toolTip =
      "<p>Process basic calibration + cosmetic correction.</p>" +
      "<p>Automatically search for best MasterCalibration frames in library. Good idea to set it true.</p>";
      onClick = function( checked )
      {
         Config.NeedCalibration = checked;
      };
   }
   var bpsToolTip = 
			"<p>Specify directory where Calibration Masters are located.</p>" +
			"<p>Format: </p>" +
			"<p><b>... / [Vitar /] SW250 [ / bin1] / Darks -20 / 	bias-TEMP_25deg_n117.xisf</b></p>" +
 			"<p>				dark-TEMP_20deg-EXPTIME_1200_n55.xisf</p>" +
 			"<p>				dark-TEMP_20deg-EXPTIME_600.fit</p>" +
 			"<p>				dark-TEMP_20deg-EXPTIME_60.xisf</p>" +
			"<p><b>... / [Vitar /] SW250 [ / bin1] / flats20180803 / flat-FILTER_B-BINNING_1_20180803.xisf</b></p>" +
 			"<p><br>Важные замечания:</p>" +
	"<p>1) В иерархии две папки необязательны: имя обсерватории и бининг. Этим управляют параметры Config.UseObserverName и Config.UseBiningFolder соответственно. </p>" +
	"<p>2) Папки и файлы подбираются на основании их имен папок/файлов, определяемых шаблонами ниже в конфигурации. Содержимое файлов не проверяется! Расширение файлов не проверяется (может быть любым!)</p>" +
	"<p>3) Если будет найдено несколько папок/файлов подходящих под шаблон, будет использован первый найденый. Нужно следить, чтобы папки/файлы были уникальными в части ключевых эелментов, определяемых шаблонами</p>" +
			"";

   this.mastersDir_Edit = new Edit( this );
   with (this.mastersDir_Edit)
   {
		readOnly = true;
		text = Config.CalibratationMastersPath;
		minWidth = labelWidth1;
		toolTip = bpsToolTip;
   }
   
   this.mastersDirSelect_Button = new ToolButton( this );
   with (this.mastersDirSelect_Button)
   {
		icon = this.scaledResource( ":/browser/select-file.png" );
		setScaledFixedSize( 20, 20 );
		toolTip = bpsToolTip;
		onClick = function()
		   {
			  var gdd = new GetDirectoryDialog;
			  gdd.initialPath = Config.CalibratationMastersPath;
			  gdd.caption = "Select directory with Calibration Masters library";

			  if ( gdd.execute() )
			  {
				 Config.CalibratationMastersPath = gdd.directory;
				 this.dialog.mastersDir_Edit.text = Config.CalibratationMastersPath;
			  }
		   };
   }
   
   this.ProcessCalibrate_Sizer = new HorizontalSizer;
   with (this.ProcessCalibrate_Sizer)
   {
	  spacing = 4;
	//margin = 6;
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessCalibrate_CheckBox );
      add( this.mastersDir_Edit, 100 );
      add( this.mastersDirSelect_Button );
      //addStretch();
   }

   // 4.2. ABE

   this.ProcessABE_CheckBox = new CheckBox( this );
   with (this.ProcessABE_CheckBox)
   {
      text = "ABE";
      checked = Config.NeedABE;
	  minWidth = labelWidth1;
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

   // 4.3. Register

   this.ProcessRegister_CheckBox = new CheckBox( this );
   with (this.ProcessRegister_CheckBox)
   {
      text = "Register";
      checked = Config.NeedRegister;
	  minWidth = labelWidth1;
      toolTip =
      "<p>Automatically Register every frame.</p>" +
      "<p>It uses reference library for every object</p>";
      onClick = function( checked )
      {
         Config.NeedRegister = checked;
      };
   }

   var bpsToolTip = 
			"<p>Определяет папку, содержащую набор референсов по выравниюванию разных объектов.</p>" +
			"<p>Файлы референсов должны начинаться с имени объекта за которым следует символ нижнего подчеркивания (e.g. M39_20190916_G_120s_1x1_-25degC_0.0degN_000014638.FIT).</p>" +
			"<p>Важно: BIN в настоящий момент (v4.0) не учитывается!</p>" +
			"";

   this.regReferenceDir_Edit = new Edit( this );
   with (this.regReferenceDir_Edit)
   {
		readOnly = true;
		text = Config.RegistrationReferencesPath;
		minWidth = labelWidth1;
		toolTip = bpsToolTip;
   }
   
   this.regReferenceDirSelect_Button = new ToolButton( this );
   with (this.regReferenceDirSelect_Button)
   {
		icon = this.scaledResource( ":/browser/select-file.png" );
		setScaledFixedSize( 20, 20 );
		toolTip = bpsToolTip;
		onClick = function()
		   {
			  var gdd = new GetDirectoryDialog;
			  gdd.initialPath = Config.RegistrationReferencesPath;
			  gdd.caption = "Select directory with Registration Reference Library";

			  if ( gdd.execute() )
			  {
				 Config.RegistrationReferencesPath = gdd.directory;
				 this.dialog.regReferenceDir_Edit.text = Config.RegistrationReferencesPath;
			  }
		   };
   }

   this.ProcessRegister_Sizer = new HorizontalSizer;
   with (this.ProcessRegister_Sizer)
   {
	  spacing = 4;
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessRegister_CheckBox );
      add( this.regReferenceDir_Edit, 100 );
      add( this.regReferenceDirSelect_Button );
      //addStretch();
   }

   // 4.4. Normalization

   this.ProcessNormalization_CheckBox = new CheckBox( this );
   with (this.ProcessNormalization_CheckBox)
   {
      text = "LocalNormalization";
      checked = Config.NeedNormalization;
	  minWidth = labelWidth1;
      toolTip =
		"<p>Automatically apply LocalNormalization to every frame.</p>" +
		"<p>It uses reference library for every object, filter and exposure</p>";
      onClick = function( checked )
      {
         Config.NeedNormalization = checked;
      };
   }

   var bpsToolTip = 
			"<p>Определяет папку, содержащую набор референсов для выравниювания фона объектов.</p>" +
			"<p>Файлы референсов должны начинаться с имени объекта за которым следует символ нижнего подчеркивания, любые символы, потом после символа подчекривания имя фильтра и экспозиция (e.g. M39_20190916_G_120s_1x1_-25degC_0.0degN_000014638.FIT).</p>" +
			"<p>Важно: BIN в настоящий момент (v4.0) не учитывается!</p>" +
			"";

   this.normReferenceDir_Edit = new Edit( this );
   with (this.normReferenceDir_Edit)
   {
		readOnly = true;
		text = Config.NormalizationReferencesPath;
		minWidth = labelWidth1;
		toolTip = bpsToolTip;
   }
   
   this.regReferenceDirSelect_Button = new ToolButton( this );
   with (this.regReferenceDirSelect_Button)
   {
		icon = this.scaledResource( ":/browser/select-file.png" );
		setScaledFixedSize( 20, 20 );
		toolTip = bpsToolTip;
		onClick = function()
		   {
			  var gdd = new GetDirectoryDialog;
			  gdd.initialPath = Config.NormalizationReferencesPath;
			  gdd.caption = "Select directory with Normalization Reference Library";

			  if ( gdd.execute() )
			  {
				 Config.NormalizationReferencesPath = gdd.directory;
				 this.dialog.normReferenceDir_Edit.text = Config.NormalizationReferencesPath;
			  }
		   };
   }

   this.ProcessNormalization_Sizer = new HorizontalSizer;
   with (this.ProcessNormalization_Sizer)
   {
	  spacing = 4;
      addUnscaledSpacing(  this.logicalPixelsToPhysical( 4 ) );
      add( this.ProcessNormalization_CheckBox );
      add( this.normReferenceDir_Edit, 100 );
      add( this.regReferenceDirSelect_Button );
      //addStretch();
   }


	// 4.4.1. Local Normalization Scale
	
   var bpsToolTip = 
			"<p>Определяет масштаб фона.</p>" +
			"<p>Стоит попробовать 256, 512 и иногда 1024</p>" +
			"";
	this.normScale_SpinBox = new SpinBox( this );
	with (this.normScale_SpinBox)
	{
		setFixedWidth( this.font.width( "MMMM" ) );
		toolTip = bpsToolTip;
		maxValue = 65535;
		stepSize = 32;
		minValue = 32;
		value = Config.NormalizationScale;
		onValueUpdated = function( value )
		{
			Config.NormalizationScale = value;
		}
	}

   this.normScale_Label = new Label(this);
   with(this.normScale_Label)
   {
      margin = 4;
      text = "Scale";
	textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

	this.normScale_Sizer = new HorizontalSizer;
	with (this.normScale_Sizer)
	{
		spacing = 4;
		addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 8 ) );
		//add( this.normScale_Edit );
		add( this.normScale_SpinBox );
		add( this.normScale_Label );
		addStretch();
	}

	//
	
   this.normNoScaleFlag_CheckBox = new CheckBox( this );
   with (this.normNoScaleFlag_CheckBox)
   {
		text = "No scale component";
		checked = Config.NormalizationNoScaleFlag;
		toolTip =
			"<p>Use only offset component of the local normalization function and limit normalization to correction of additive gradients only.</p>";
		onClick = function( checked )
		{
			Config.NormalizationNoScaleFlag = checked;
		};
   }

   this.normNoScaleFlag_Sizer = new HorizontalSizer;
   with (this.normNoScaleFlag_Sizer)
   {
		spacing = 4;
		addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 8 ) );
		add( this.normNoScaleFlag_CheckBox );
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
      sizer.add( this.normScale_Sizer );
      sizer.add( this.normNoScaleFlag_Sizer );

   }


   this.ProcessSection = new SectionBar;
   this.ProcessSection.setTitle( "Processing" );
   this.ProcessSection.setSection( this.ProcessGroupBox );







   //

   //Instance button
   this.newInstance_Button = new ToolButton(this);
   this.newInstance_Button.icon = new Bitmap( ":/process-interface/new-instance.png" );
   this.newInstance_Button.toolTip = "New Instance";
   this.newInstance_Button.onMousePress = function()
   {
      this.hasFocus = true;
      Config.exportParameters();
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
function mainGUI()
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

#ifndef Autocalibrate_Main
mainGUI();
#endif

