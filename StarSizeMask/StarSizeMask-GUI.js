#ifndef __STARSIZEMASK_GUI__
    #define __STARSIZEMASK_GUI__
#endif

#ifndef __DEBUGF__
	#define __DEBUGF__ true  /*or false*/
#endif

// Need to be in front of other declarations
#ifndef __STARSIZEMASK_VERSION_JSH__
	#include "StarSizeMask-version.jsh"	// Version
#endif
// Need to be a second
#ifndef __STARMASKSIZE_SETTINGS__
	#include "StarSizeMask-settings.js" // Settings object
    var Config = new ConfigData(); //variable for global access to script data
    //Need to be in front of other declarations
    console.noteln('Creating again Config');
#endif


#ifndef __STARSIZEMASK_ENGINE__
	#include "StarSizeMask-engine.js" // Engine
#endif


// JS components
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/FontFamily.jsh>


/*
 * dialog
 */
#define MIN_DIALOG_WIDTH 1000 
 
function StarSizeMask_Dialog(refView) {
    this.__base__ = Dialog;
    this.__base__();

    var reportHeaderNames = ["X", "Y", "flux", "bckgrnd", "w", "h", "Sz", "R", "nmx", "SzG", "FlG",
        "psf_F", "psf_B", "psf_A", "FHWHx FHWHy", "Angle", "Pw", "Ph"];
    
    
    var reportHeaderLengths = [100, 100, 150, 150, 100, 100, 100, 100, 100, 100, 100,
        100, 100, 100, 300, 200, 100, 100
    ];


    var labelWidth1 = this.font.width("Output format hints :" + 'T');
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
        text = "<p><b>" + __SCRIPT_NAME + " v" + __SCRIPT_VERSION + "</b><br/>" +
            __INFO_STRING__ +
            ".</p><p>" +
            __COPYRIGHT_STRING__ +
            "</p>"
        setScaledMinWidth(MIN_DIALOG_WIDTH); //min width
    }

    this.imageInfoLabel = new Label(this);
    with (this.imageInfoLabel) {
        frameStyle = FrameStyle_Box;
        margin = 4;
        wordWrapping = true;
        useRichText = true;
        text = "<p>Image: <b>" + refView.fullId + "</b><br/>" +
            "</p>"
        //setScaledMinWidth(MIN_DIALOG_WIDTH); //min width
    }

	// -- result report Table --
	this.reportControl = new TreeBox( this );
	with ( this.reportControl ) {
		toolTip = "<p>Output of computed characteristics for your CCD. Press Report button to generate it it.</p>";
        alternateRowColor = true;
		font = new Font( FontFamily_Monospace, 8 );

		for ( var i = 0; i < reportHeaderNames.length; ++i ) {
			setColumnWidth( i, reportHeaderLengths[i] );
            console.write(i + ": " + reportHeaderLengths[i] + ", ");
			setHeaderText( i, reportHeaderNames[i] );
		}
		headerVisible = true;

		setScaledMinSize( 680, 270 );
    }


    // == DIALOG total build ==

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

	// Evaluate statistics button
    this.evaluate_Button = new PushButton( this );
	this.evaluate_Button.text = "(1) Evaluate";
	this.evaluate_Button.toolTip = "Evaluate stars statistics";
    this.evaluate_Button.onClick = function () {
        console.writeln("Processing image...");
        // (1) Detect stars in the image (calls StarsDetector object)
        let AllStars = Engine.getStars(refView);
        // (2) Make PSF fitting for all detected stars (calls DynamicPSF process)
        Engine.fitStarPSF();
        // now we can calc statistics
        Engine.calculateStarStats();
        
        this.parent.displayStarsStat(Engine.Stars);
    }

	// Filter stars button
    this.filter_Button = new PushButton( this );
	this.filter_Button.text = "(2) Filter";
	this.filter_Button.toolTip = "Filter stars by flux";
    this.filter_Button.onClick = function () {
        console.writeln("Filtering stars...");
        // now we can calc statistics
        Engine.filterStarsByFlux(Config.minFlux, Config.maxFlux);
    }

	// Create Mask button
    this.mask_Button = new PushButton( this );
	this.mask_Button.text = "(3) Mask";
	this.mask_Button.toolTip = "Create mask";
    this.mask_Button.onClick = function () {
        console.writeln("Filtering stars...");
        // now we can calc statistics
        Engine.createMaskAngle(undefined, Config.softenMask, Config.maskGrowth, Config.contourMask, Config.MaskName);
    }

	// Outuput Detected stars + Mask residiul button
    this.showDetected_Button = new PushButton( this );
	this.showDetected_Button.text = "Show Detected";
	this.showDetected_Button.toolTip = "Output detected stars and stars residial";
    this.showDetected_Button.onClick = function () {
        console.writeln("Filtering stars...");
        // now we can calc statistics
        Engine.markStars();
        Engine.makeResidual(Config.residualMaskName);
    }

	// Process all button
    this.ok_Button = new PushButton( this );
	this.ok_Button.text = "Create";
	this.ok_Button.toolTip = "Process everuthing (detected, calc stat and output mask)";
    this.ok_Button.onClick = function () {
        this.dialog.ok();
    }

    // CLOSE button
    this.cancel_Button = new PushButton( this );
	this.cancel_Button.text = "Close";
	this.cancel_Button.toolTip = "Close the " + __SCRIPT_NAME + " script.";
    this.cancel_Button.onClick = function () {
        this.dialog.cancel();
    }

    //Dialog control buttons sizer
    this.buttons_Sizer = new HorizontalSizer;
    with (this.buttons_Sizer) {
        spacing = 6;
        add(this.newInstance_Button);
        addStretch();

        add(this.evaluate_Button);
        add(this.filter_Button);
        add(this.mask_Button);
        add(this.showDetected_Button);
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
        add(this.imageInfoLabel);
        addSpacing(4);
        
        
        add(this.reportControl);

        //add(this.clearConsoleCheckBox_Sizer);
        addSpacing(10);
        //add(this.outputControls_GroupBox);
        //this.imgSetAccess_GroupBox.hide();
        add(this.buttons_Sizer);
    }

    this.windowTitle = __SCRIPT_NAME + " Script";
    this.adjustToContents();


 	this.displayStarsStat = function( StarsArray = undefined, topRecords = 0) 
    {
 		console.writeln("<i>displayStarStat: output stars data to TreeBox. StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + "</i>");
        this.reportControl.clear();

        // Rows
        if ( topRecords == 0 )
            topRecords = StarsArray.length;

 		for ( var i = 0; i < topRecords; ++i ) {

 			var treeNode = new TreeBoxNode();
 			let s = StarsArray[i];
            
            //s.pos.x, s.pos.y, s.flux, s.bkg, s.w, s.h, s.size, s.sizeRadius, s.nmax, s.sizeGroup, s.fluxGroup

            let col = 0;
            for (var prop in s) {
                if (Object.prototype.hasOwnProperty.call(s, prop)) {
                    col++;
                    // do stuff
                    var text = s[prop].toString();
                    treeNode.setText( col, text );

                    // right align numbers, left align text:
                    if ( text.match( /^[-0-9\. ]+/ ) ) {
                        treeNode.setAlignment( col, Align_Right );
                    }
                    else {
                        treeNode.setAlignment( col, Align_Left );
                    }
                }
 			}
 			this.reportControl.add( treeNode );
 		}
 	}


}

//main
function mainGUI() {
    if (!__DEBUGF__)
        console.hide();

    if (__DEBUGF__)
        console.clear();

    console.noteln(__SCRIPT_NAME, " script started. Version: ", __SCRIPT_VERSION, " Date: ", __SCRIPT_DATE);
    console.noteln("PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
        ", ", coreVersionMinor, ", ", coreVersionRelease);

   var refView = ImageWindow.activeWindow.currentView;

   console.writeln ("Working on image: <b>" + refView.fullId + "</b>");
   if (refView.window.filePath) console.writeln ("ImagePath: " + refView.window.filePath + "");


    Config.loadSettings();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        if (__DEBUGF__)
            console.writeln("Script instance");
        this.importParameters();

    } else {
        if (__DEBUGF__)
            console.writeln("Just new script");
    }

    //just for future features(?!)
    if (Parameters.isViewTarget) {
        if (__DEBUGF__)
            console.writeln("Executed on target view");
    } else {
        if (__DEBUGF__)
            console.writeln("Direct or global context");
    }



    // Our dialog inherits all properties and methods from the core Dialog object.
    StarSizeMask_Dialog.prototype = new Dialog;
    var dialog = new StarSizeMask_Dialog(refView);

    // Show our dialog box, quit if cancelled.
    for (; ; ) {
        if (dialog.execute()) {
            if (Config.InputPath == "") {
                var msgStr = "<p>There are no input dir specified.</p>" +
                    "<p>Do you wish to continue?</p>";
                var msg = new MessageBox(msgStr, __SCRIPT_NAME, StdIcon_Error, StdButton_Yes, StdButton_No);
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
            var msgBox = new MessageBox(msgStr, __SCRIPT_NAME, StdIcon_Error, StdButton_Yes, StdButton_No);
            break; //for debug
            if (msgBox.execute() == StdButton_Yes)
                break;
            else
                continue;
        }

        break;

    }

    //Config.saveSettings();
}

#ifndef __STARSIZEMASK_MAIN__
	var refView = ImageWindow.activeWindow.currentView;
	console.writeln ("Working on image: <b>" + refView.fullId + "</b>");
	if (refView.window.filePath) console.writeln ("ImagePath: " + refView.window.filePath + "");

    //Engine
	var Engine = new StarSizeMask_engine();


	mainGUI();
#endif
