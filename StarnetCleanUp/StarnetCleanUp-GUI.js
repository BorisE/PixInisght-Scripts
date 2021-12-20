 #ifndef StarnetCleanUp_GUI_js
    #define StarnetCleanUp_GUI_js
 #endif

// Global switches
 #ifndef DEBUG
    #define DEBUG true
 #endif

// Includes
 #ifndef StarnetCleanUp_Global_js
    #include "StarnetCleanUp-global.js"         // Ver, Title and other info
 #endif
 #ifndef StarnetCleanUp_settings_js
    #include "StarnetCleanUp-settings.js"       // Settings
   var Config = new ConfigData();               // Variable for global access to script data
 #endif
 #ifndef StarnetCleanUp_config_default_js
   #include "StarnetCleanUp-config-default.js"  // Load default config values
 #endif
 #ifndef StarnetCleanUp_ProcessEngine_js
    #include "StarnetCleanUp-Engine.js"         // Engine
 #endif

// JS components
 #include <pjsr/StdButton.jsh>
 #include <pjsr/StdIcon.jsh>
 #include <pjsr/FrameStyle.jsh>
 #include <pjsr/Sizer.jsh>
 #include <pjsr/TextAlign.jsh>
 #include <pjsr/SectionBar.jsh>

function StarnetCleanUpDialog() {

    this.__base__ = Dialog;
    this.__base__();

    var labelWidth1 = this.font.width("Create Starnet Merged :aaaa");
    var editWidth1 = labelWidth1*3;
    var ttStr = ""; //temp str var

    debug("Edit block width=" + editWidth1);

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



    this.addTextBox = function (baseParams) {
       var self = this;
       self[baseParams.name+ "_Edit"] = new Edit(this);
       with (self[baseParams.name+ "_Edit"])     {
          text = "";
          minWidth = editWidth1;
          toolTip = baseParams.tooltip;
          onEditCompleted = function()
          {
              Config[baseParams.config] = text;
              debug("Config ["+baseParams.config+"] = " + Config[baseParams.config]);
              if (baseParams.name == "Original") {
                  if (self["Starnet_Edit"].text == "")         self["Starnet_Edit"].text        = text + "_Starnet_cleaned";
                  if (self["Stars_Edit"].text == "")           self["Stars_Edit"].text          = text + "_Stars";
                  if (self["Stars_cleaned_Edit"].text == "")   self["Stars_cleaned_Edit"].text  = text + "_Stars_cleaned";
                  self["Starnet_Edit"].onEditCompleted();
                  self["Stars_Edit"].onEditCompleted();
                  self["Stars_cleaned_Edit"].onEditCompleted();
              }

          };
       }
       self[baseParams.name+ "_Label"] = new Label(this);
       with (self[baseParams.name+ "_Label"]) {
          text = baseParams.label;
          textAlignment = TextAlign_Right | TextAlign_VertCenter;
          minWidth = labelWidth1;
       }
       self[baseParams.name+ "_Sizer"] = new HorizontalSizer;
       with (self[baseParams.name+ "_Sizer"]) {
          spacing = 4;
          add(self[baseParams.name+ "_Label"]);
          add(self[baseParams.name+ "_Edit"]);
          addStretch();
       }
   }

   this.autoFillNames = function () {
      debug("autoFillNames");
      console.writeln("!!!!");
      if (Config.Starnet_Cleaned == "") this.Starnet_Edit.text = Config.Original_Image + "_Starnet_cleaned";
      if (Config.Stars == "")           this.Stars_Edit.text = Config.Original_Image + "_Stars";
      if (Config.Stars_Cleaned == "")           this.Stars_cleaned_Edit.text = Config.Original_Image + "_Stars_cleaned";
   }


    //
    // 0. Input files
    //

   var editbox1 = { name : "Original", label: "Original image: ", config: "Original_Image", tooltip: "<p>Specify the original image file.</p>" };
   var editbox2 = { name : "Starnet", label: "Starnet cleaned image: ", config: "Starnet_Cleaned", tooltip: "<p>Specify the starless image file.</p>" };
   this.addTextBox(editbox1);
   this.addTextBox(editbox2);

   var self = this;
    this.inputImages_GroupBox = new GroupBox(this);
    with (this.inputImages_GroupBox) {
        title = "Input files";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(self[editbox1.name+ "_Sizer"]);
        sizer.add(self[editbox2.name+ "_Sizer"]);

    }

    //
    // 0. Input files
    //

   var editbox3 = { name : "Stars", label: "Stars only image: ", config: "Stars", tooltip: "<p>Specify the original image file.</p>" };
   var editbox4 = { name : "Stars_cleaned", label: "Stars cleaned image: ", config: "Stars_Cleaned", tooltip: "<p>Specify the starless image file.</p>" };
   this.addTextBox(editbox3);
   this.addTextBox(editbox4);

   var self = this;
   this.starsImages_GroupBox = new GroupBox(this);
   with (this.starsImages_GroupBox) {
        title = "Stars only iamges";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(self[editbox3.name+ "_Sizer"]);
        sizer.add(self[editbox4.name+ "_Sizer"]);

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

    this.createStars_Button = new PushButton(this);
    with (this.createStars_Button) {
       text = "Create Stars Only";
       toolTip =
           "Create Stars_Only image (= Original - Starnet_Cleaned";
       onClick = function () {
          Config.WorkingMode = WORKINGMODE.makeStarsOnly;
          this.dialog.ok();
       }
    }
    this.createStarnetMerged_Button = new PushButton(this);
    with (this.createStarnetMerged_Button) {
       text = "Create Starnet Merged";
       toolTip =
           "Create Starnet_Merged image (= Starnet_cleaned + Stars_difference [=Stars_Only - Stars_Only_Cleaned])";
       onClick = function () {
          Config.WorkingMode = WORKINGMODE.makeStarnetMerged;
          this.dialog.ok();
       }
    }
    this.createCombined_Button = new PushButton(this);
    with (this.createCombined_Button) {
       text = "Create Combined Image";
       toolTip =
           "Create Combined image (= Starnet_combined + Stars_cleaned])";
       onClick = function () {
          Config.WorkingMode = WORKINGMODE.makeCombined;
          this.dialog.ok();
       }
    }


    this.cancel_Button = new PushButton(this);
    with (this.cancel_Button) {
       text = "Cancel";
       toolTip =
           "Close the " + TITLE + " script.";
       onClick = function () {
         this.dialog.cancel();
       }
    }

    //Dialog control buttons sizer
    this.buttons_Sizer = new HorizontalSizer;
    with (this.buttons_Sizer) {
        spacing = 6;
        add(this.newInstance_Button);
        addStretch();

        add(this.createStars_Button);
        add(this.createStarnetMerged_Button);
        add(this.createCombined_Button);
        add(this.cancel_Button);
    }

    //main dialog sizers
    this.sizer = new VerticalSizer;
    with (this.sizer) {
        margin = 6;
        spacing = 6;
        add(this.helpLabel);
        addSpacing(4);
        add(this.inputImages_GroupBox);
        add(this.starsImages_GroupBox);

        addSpacing(10);
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
    StarnetCleanUpDialog.prototype = new Dialog;
    var dialog = new StarnetCleanUpDialog();

    // Show our dialog box, quit if cancelled.
    for (; ; ) {
        if (dialog.execute()) {
             console.show();
             processEvents();
             console.noteln("Working mode: " + Config.WorkingMode);
             switch (Config.WorkingMode)
             {
                case WORKINGMODE.makeStarsOnly:
                   if (Config.Original_Image == "" || Config.Starnet_Cleaned == "") {
                     var msgStr = "<p>There are not all images were specified.</p>" +
                      "<p>Do you wish to set it?</p>";
                     var msg = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
                     if (msg.execute() == StdButton_Yes)
                        continue;
                     else
                        break;
                   }
                   Engine.Original_Id = Config.Original_Image;
                   Engine.Starnet_Cleaned_Id = Config.Starnet_Cleaned;
                   console.writeln("Original: " + Engine.Original_Id);
                   console.writeln("Starnet_Cleaned: " + Engine.Starnet_Cleaned_Id);
                   Engine.getImageReferences();
                   Engine.makeStarsImage();
                   break;
                case WORKINGMODE.makeStarnetMerged:
                   if (Config.Starnet_Cleaned == "" || Config.Stars == "" || Config.Stars_Cleaned == "") {
                     var msgStr = "<p>There are not all images were specified.</p>" +
                      "<p>Do you wish to set it?</p>";
                     var msg = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
                     if (msg.execute() == StdButton_Yes)
                        continue;
                     else
                        break;
                   }
                   Engine.Original_Id = Config.Original_Image;
                   Engine.Starnet_Cleaned_Id = Config.Starnet_Cleaned;
                   Engine.Stars_Id = Config.Stars;
                   Engine.Stars_Cleaned_Id = Config.Stars_Cleaned;
                   console.writeln("Original: " + Engine.Original_Id);
                   console.writeln("Starnet_Cleaned: " + Engine.Starnet_Cleaned_Id);
                   console.writeln("Stars: " + Engine.Stars_Id);
                   console.writeln("Stars_Cleaned: " + Engine.Stars_Cleaned_Id);
                   Engine.getImageReferences();
                   Engine.makeStarsDifferenceImage();
                   Engine.makeStarnetMergedImage();
                   break;
                case WORKINGMODE.makeCombined:
                   if (Config.Starnet_Cleaned == "" || Config.Stars == "" || Config.Stars_Cleaned == "") {
                     var msgStr = "<p>There are not all images were specified.</p>" +
                      "<p>Do you wish to set it?</p>";
                     var msg = new MessageBox(msgStr, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No);
                     if (msg.execute() == StdButton_Yes)
                        continue;
                     else
                        break;
                   }
                   Engine.Original_Id = Config.Original_Image;
                   Engine.Starnet_Cleaned_Id = Config.Starnet_Cleaned;
                   console.writeln("Original: " + Engine.Original_Id);
                   console.writeln("Starnet_Cleaned: " + Engine.Starnet_Cleaned_Id);
                   Engine.getImageReferences();
                   //Engine.makeCombinedStarnetImage();
                   break;
             }
             break;
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

#ifndef StarnetCleanUp_Main
    mainGUI();
#endif
