#ifndef __SELECTIVESTARMASK_GUI__
    #define __SELECTIVESTARMASK_GUI__
#endif

#ifndef __DEBUGF__
	#define __DEBUGF__ true  /*or false*/
#endif

// Need to be in front of other declarations
#ifndef __SELECTIVESTARMASK_VERSION_JSH__
	#include "SelectiveStarMask-version.jsh"	// Version
    #include "SelectiveStarMask-lib.js" // Functions lib
#endif
// Need to be a second
#ifndef __SELECTIVESTARMASK_SETTINGS__
	#include "SelectiveStarMask-settings.js" // Settings object
    var Config = new ConfigData(); //variable for global access to script data
    //Need to be in front of other declarations
    console.noteln('Creating again Config');
#endif


#ifndef __SELECTIVESTARMASK_ENGINE__
	#include "SelectiveStarMask-engine.js" // Engine
#endif


// JS components
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/FontFamily.jsh>
#include <pjsr/Color.jsh>

/*
 * dialog
 */
#define MIN_DIALOG_WIDTH 1000

function SelectiveStarMask_Dialog(refView) {
    this.__base__ = Dialog;
    this.__base__();

    //s.pos.x, s.pos.y, s.flux, s.bkg, s.w, s.h, s.size, s.sizeRadius, s.nmax, s.sizeGroup, s.fluxGroup
    //s.PSF_flux, s.PSF_b, s.PSF_a, s.FWHMx, s.FWHMy, s.PSF_theta, (s.PSF_rect.x1 - s.PSF_rect.x0), (s.PSF_rect.x1 - s.PSF_rect.x0)

    this.StarMaskId = undefined; // save created mask image id

    this.starsFluxGroupsColumnKeys = [
        {
            header:    "Group Id",
            width:     100,
        },
        {
            header:    "Flux Min",
            width:     200,
        },
        {
            header:    "Flux Max",
            width:     200,
        },
        {
            header:    "Number of stars",
            width:     200,
        }
    ];

    this.starsSizeGroupsColumnKeys = [
        {
            header:    "Group Id",
            width:     100,
        },
        {
            header:    "Size Min",
            width:     200,
        },
        {
            header:    "Size Max",
            width:     200,
        },
        {
            header:    "Number of stars",
            width:     200,
        }
    ];




    this.starsListColumnKeys = [
        // — Geometric / detection properties —
        {
            header:    "X",
            width:     60,
            precision: 0,
            extractor: s => s.pos != null ? s.pos.x : NaN
        },
        {
            header:    "Y",
            width:     60,
            precision: 0,
            extractor: s => s.pos != null ? s.pos.y : NaN
        },
        {
            header:    "Flux",
            width:     105,
            precision: 3,
            extractor: s => s.flux
        },
        {
            header:    "Bkg",
            width:     100,
            precision: 5,
            extractor: s => s.bkg
        },
        {
            header:    "W",
            width:     40,
            precision: 0,
            extractor: s => s.w
        },
        {
            header:    "H",
            width:     40,
            precision: 0,
            extractor: s => s.h
        },
        {
            header:    "Size",
            width:     60,
            precision: 0,
            extractor: s => s.size
        },
        {
            header:    "SizeRad",
            width:     80,
            precision: 2,
			color:     Color.BLUE,
            extractor: s => s.sizeRadius
        },
        {
            header:    "NMax",
            width:     60,
            precision: 0,
            extractor: s => (s.nmax != null ? "(" + s.nmax + ")" : "")
        },


        // — DynamicPSF parameters —
        {
            header:    "PSF_flux",
            width:     105,
            precision: 3,
            extractor: s => s.PSF_flux
        },
        {
            header:    "PSF_A",
            width:     70,
            precision: 3,
            extractor: s => s.PSF_a
        },


        // — Grouping / logs (may be undefined until you assign them) —

        {
            header:    "SizeGrp",
            width:     85,
            precision: 0,
            color:     Color.RED,
            extractor: s => (s.sizeGroup != null ? s.sizeGroup : "")
        },
        {
            header:    "FluxGrp",
            width:     85,
            precision: 0,
            color:     Color.RED,
            extractor: s => (s.fluxGroup != null ? s.fluxGroup : "")
        },
        {
            header:    "FluxLog",
            width:     80,
            precision: 2,
            color:     Color.BLUE,
            extractor: s => (s.fluxLog != null ? s.fluxLog : NaN)
        },

        // — Final FWHM values —
        {
            header:    "FWHMx",
            width:     90,
            precision: 2,
            extractor: s => s.FWHMx
        },
        {
            header:    "FWHMy",
            width:     90,
            precision: 2,
            extractor: s => s.FWHMy
        },

        {
            header:    "PSF_theta",
            width:     100,
            precision: 2,
            extractor: s => s.PSF_theta
        },
        {
            header:    "Pw",
            width:     70,
            precision: 0,
            extractor: s => (s.PSF_rect != null ? s.PSF_rect.x1 - s.PSF_rect.x0 : NaN)
        },
        {
            header:    "Pg",
            width:     70,
            precision: 0,
            extractor: s => (s.PSF_rect != null ? s.PSF_rect.y1 - s.PSF_rect.y0 : NaN)
        }

    ];

    var labelWidth1 = this.font.width("Minimum star flux: " + '100.103');
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
        backgroundColor = Color.rgbaColor(150,200,255,0xff);
        text = "<p><b>" + __SCRIPT_NAME__ + " v" + __SCRIPT_VERSION__ + "</b><br/>" +
            __INFO_STRING__ +
            ".</p>"
            + "<p>" +
            __COPYRIGHT_STRING__ +
            "</p>"
        setScaledMinWidth(MIN_DIALOG_WIDTH); //min width //45*this.font.width( 'M' );
    }


	// -- Image Information --
    this.ImageText_Label = new Label(this);
    with (this.ImageText_Label) {
        margin = 4;
        text = "Image: ";
		setScaledMinWidth(7*this.font.width( 'M' ));
    }
    this.ImageName_Label = new Label(this);
    with (this.ImageName_Label) {
        margin = 4;
        useRichText = true;
        text = "<b>" + ( refView.fullId != "" ? refView.fullId : "unspecified" ) + "</b>";
    }
    this.ImageInfo_Sizer = new HorizontalSizer;
    with (this.ImageInfo_Sizer) {
        spacing = 4;
        add(this.ImageText_Label);
        add(this.ImageName_Label);
        addStretch();
    }

	// -- Stars Information --
    this.StarsText_Label = new Label(this);
    with (this.StarsText_Label) {
        margin = 4;
        text = "Stars: ";
		setScaledMinWidth(7*this.font.width( 'M' ));
    }
    this.StarsDetected_Label = new Label(this);
    with (this.StarsDetected_Label) {
        margin = 4;
        text = "";
    }
    this.StarsInfo_Sizer = new HorizontalSizer;
    with (this.StarsInfo_Sizer) {
        spacing = 4;
        add(this.StarsText_Label);
        add(this.StarsDetected_Label);
        addStretch();
    }

    // Information groupbox
    this.InformationGroupBox = new GroupBox(this);
    with (this.InformationGroupBox) {
        title = "Info";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.ImageInfo_Sizer);
        sizer.add(this.StarsInfo_Sizer);
    }


    // -- Filter ---


	// -- Size filter --
    // Min size filter
    this.minSizeFilter_Label = new Label(this);
    with (this.minSizeFilter_Label) {
        margin = 4;
        text = "Min star size";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
		setScaledMinWidth(7*this.font.width( 'M' ));
    }

    this.minSizeFilter_Edit = new Edit( this );
    with (this.minSizeFilter_Edit) {
        text = (Config.FilterSize_min ? Config.FilterSize_min : 0).toString();
        toolTip = "Minimum star Size to be included in filtered subset";
        onTextUpdated = function () {
            Config.FilterSize_min = parseFloat(this.text);
            Engine.curFilterSize.min = Config.FilterSize_min;
            console.warningln("New min:" + Engine.curFilterSize.min);
        };
    }

    this.minSizeFilter_Sizer = new HorizontalSizer;
    with (this.minSizeFilter_Sizer) {
        spacing = 4;
        add(this.minSizeFilter_Label);
        add(this.minSizeFilter_Edit);
        addStretch();
    }

    // Max size filter
    this.maxSizeFilter_Label = new Label(this);
    with (this.maxSizeFilter_Label) {
        margin = 4;
        text = "Max star size";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
		setScaledMinWidth(7*this.font.width( 'M' ));
    }

    this.maxSizeFilter_Edit = new Edit( this );
    with (this.maxSizeFilter_Edit) {
        text = (Config.FilterSize_max ? Config.FilterSize_max : MAX_INT).toString();
        //minWidth = labelWidth1;
        //minWidth = 5*this.font.width( 'M' );
        toolTip = "Maximum star Size to be included in filtered subset";
        onTextUpdated = function () {
            Config.FilterSize_max = parseFloat(this.text);
            Engine.curFilterSize.max = Config.FilterSize_max;
        };
    }

    this.maxSizeFilter_Sizer = new HorizontalSizer;
    with (this.maxSizeFilter_Sizer) {
        spacing = 4;
        //addUnscaledSpacing( MIN_DIALOG_WIDTH / 4);
		//setScaledMinWidth( MIN_DIALOG_WIDTH / 3 );

        add(this.maxSizeFilter_Label);
        add(this.maxSizeFilter_Edit);
        addStretch();
    }

    // Size filter groupbox
	this.SizeFilterGroupBox = new GroupBox(this);
    with (this.SizeFilterGroupBox) {
        title = "Size (radius) filtering";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.minSizeFilter_Sizer);
        sizer.add(this.maxSizeFilter_Sizer);
    }


	// -- flux filter --
    // Min flux filter
    this.minFluxFilter_Label = new Label(this);
    with (this.minFluxFilter_Label) {
        margin = 4;
        text = "Min star flux";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
		setScaledMinWidth(7*this.font.width( 'M' ));

    }

    this.minFluxFilter_Edit = new Edit( this );
    with (this.minFluxFilter_Edit) {
        text = (Config.FilterFlux_min ? Config.FilterFlux_min : 0).toString();
        //minWidth = labelWidth1;
        toolTip = "Minimum star flux to be included in filtered subset";
        onTextUpdated = function () {
            Config.FilterFlux_min = parseFloat(this.text);
            Engine.curFilterFlux.min = Config.FilterFlux_min;
        };
    }

    this.minFluxFilter_Sizer = new HorizontalSizer;
    with (this.minFluxFilter_Sizer) {
        spacing = 4;
        //addUnscaledSpacing( MIN_DIALOG_WIDTH / 3);

        add(this.minFluxFilter_Label);
        add(this.minFluxFilter_Edit);
        addStretch();
    }

    // Max flux filter
    this.maxFluxFilter_Label = new Label(this);
    with (this.maxFluxFilter_Label) {
        margin = 4;
        text = "Max star flux";
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
		setScaledMinWidth(7*this.font.width( 'M' ));
    }

    this.maxFluxFilter_Edit = new Edit( this );
    with (this.maxFluxFilter_Edit) {
        text = (Config.FilterFlux_max ? Config.FilterFlux_max : MAX_INT).toString();
        //minWidth = labelWidth1;
        toolTip = "Maximum star flux to be included in filtered subset";
        onTextUpdated = function () {
            Config.FilterFlux_max = parseFloat(this.text);
            Engine.curFilterFlux.max = Config.FilterFlux_max;
        };
    }

    this.maxFluxFilter_Sizer = new HorizontalSizer;
    with (this.maxFluxFilter_Sizer) {
        spacing = 4;
        //addUnscaledSpacing(labelWidth1);
        add(this.maxFluxFilter_Label);
        add(this.maxFluxFilter_Edit);
        addStretch();
    }

    // Flux filter groupbox
    this.FluxFilterGroupBox = new GroupBox(this);
    with (this.FluxFilterGroupBox) {
        title = "Flux filtering";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.minFluxFilter_Sizer);
        sizer.add(this.maxFluxFilter_Sizer);
    }


    // -- Mask Parameters --

    // Config.softenMask, Config.maskGrowth, Config.contourMask, Config.MaskName
    this.maskGrowth_CheckBox = new CheckBox(this);
    with (this.maskGrowth_CheckBox){
        text = "Mask growth";
        checked = Config.maskGrowth;
        toolTip = "<p>Increase mask beyound detected star radius</p>";
		setScaledMinWidth(MIN_DIALOG_WIDTH / 6 - 6);
        onClick = function (checked) {
            Config.maskGrowth = checked;
        };
    };
    this.softenMask_CheckBox = new CheckBox(this);
    with (this.softenMask_CheckBox){
        text = "Soften mask";
        checked = Config.softenMask;
        toolTip = "<p>Soften mask after creation using Convolve.</p>";
		setScaledMinWidth(MIN_DIALOG_WIDTH / 6 - 6);
        onClick = function (checked) {
            Config.softenMask = checked;
        };
    };
    this.contourMask_CheckBox = new CheckBox(this);
    with (this.contourMask_CheckBox){
        text = "Countour mask";
        checked = Config.contourMask;
        toolTip = "<p>Create mask as a countour.</p>";
		setScaledMinWidth(MIN_DIALOG_WIDTH / 6 - 6);
        onClick = function (checked) {
            Config.contourMask = checked;
        };
    };
    this.Parameters_Sizer = new HorizontalSizer;
    with (this.Parameters_Sizer) {
        spacing = 4;
        
        add(this.maskGrowth_CheckBox);
        add(this.softenMask_CheckBox);
        add(this.contourMask_CheckBox);
        addStretch();
    }

    // Mask Parameters groupbox
    this.MaskParametersGroupBox = new GroupBox(this);
    with (this.MaskParametersGroupBox) {
        title = "Mask parameters";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.Parameters_Sizer);
    }


    // Sizer for both Size and Flux filters
    this.Filter_Sizer = new HorizontalSizer;
    with (this.Filter_Sizer) {
        spacing = 4;
        //addUnscaledSpacing(labelWidth1);
        add(this.SizeFilterGroupBox);
        add(this.FluxFilterGroupBox);
        add(this.MaskParametersGroupBox);
        
        addStretch();
    }


    // -- StarSize Groups Table --

	this.starsSizeGroupsTreeBox = new TreeBox( this );
	with ( this.starsSizeGroupsTreeBox ) {
		toolTip = "<p>Output of stars grouping by Size.</p>";
        alternateRowColor = true;
		font = new Font( FontFamily_Monospace, 8 );
        headerVisible = true;
        indentSize = 0;

        for ( let i = 0; i < this.starsSizeGroupsColumnKeys.length; ++i ) {
            setHeaderText ( i, this.starsSizeGroupsColumnKeys[i].header );
            //adjustColumnWidthToContents( i );
            setHeaderAlignment( i, TextAlign_Center | TextAlign_VertCenter);
            setColumnWidth( i,  this.starsSizeGroupsColumnKeys[i].width );
        }

		//setScaledMinSize( 400, 270 );
		setScaledMinHeight( 100 );
		setScaledMinWidth( MIN_DIALOG_WIDTH / 2 );
    }


    // -- StarFlux Groups Table --

	this.starsFluxGroupsTreeBox = new TreeBox( this );
	with ( this.starsFluxGroupsTreeBox ) {
		toolTip = "<p>Output of stars grouping.</p>";
        alternateRowColor = true;
		font = new Font( FontFamily_Monospace, 8 );
        headerVisible = true;
        indentSize = 0;

        for ( let i = 0; i < this.starsFluxGroupsColumnKeys.length; ++i ) {
            setHeaderText ( i, this.starsFluxGroupsColumnKeys[i].header );
            //adjustColumnWidthToContents( i );
            setHeaderAlignment( i, TextAlign_Center | TextAlign_VertCenter);
            setColumnWidth( i,  this.starsFluxGroupsColumnKeys[i].width );
        }

		setScaledMinHeight( 100 );
		setScaledMinWidth( MIN_DIALOG_WIDTH / 2  );
    }

	// -- sizer for Groups Table
    this.GroupingReports_Sizer = new HorizontalSizer;
    with (this.GroupingReports_Sizer) {
        spacing = 4;
        add(this.starsSizeGroupsTreeBox);
        add(this.starsFluxGroupsTreeBox);
        addStretch();
    }


    // -- StarsList Table --
    
	this.starsListTreeBox = new TreeBox( this );
	with ( this.starsListTreeBox ) {
		toolTip = "<p>Output of computed Star statistics.</p>";
        alternateRowColor = true;
		font = new Font( FontFamily_Monospace, 8 );
        headerVisible = true;
        indentSize = 0;

        for ( let i = 0; i < this.starsListColumnKeys.length; ++i ) {
            setHeaderText ( i, this.starsListColumnKeys[i].header );
            //adjustColumnWidthToContents( i );
            setHeaderAlignment( i, TextAlign_Center | TextAlign_VertCenter);
            setColumnWidth( i,  this.starsListColumnKeys[i].width ); //this.starsListColumnKeys[i].width
        }

		setScaledMinSize( MIN_DIALOG_WIDTH, 270 );

    }
    this.StarList_Control = new Control( this )
    this.StarList_Control.sizer = new VerticalSizer;
    this.StarList_Control.sizer.margin = 6;
    this.StarList_Control.sizer.add( this.starsListTreeBox );

    this.StarList_Section = new SectionBar( this, "Star list" );
    this.StarList_Section.setSection( this.StarList_Control );
    this.StarList_Section.onToggleSection = function (section, beginToggle)
	{
		if ( !beginToggle )
		{
			section.dialog.setVariableHeight();
			section.dialog.adjustToContents();
			//section.dialog.setFixedHeight();
		}
        else
		{
			section.dialog.setMinHeight();
		};
	};



    // == BUTTONS ==

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
	with(this.evaluate_Button) {
        text = "Detect stars";
        toolTip = "Evaluate stars statistics";
        icon = this.scaledResource(":/process/launch.png");
        setFixedHeight (40);
        if (refView.fullId == "") {
            enabled = false;
            toolTip = "Can't evaluate stars statistics because image wasn't specified";
        }
        onClick = function () {
            if (refView.fullId == "") {
                console.criticalln("No image specified");
                return false;
            }
            console.writeln("(1) Processing image...");
            // (1) Detect stars in the image (calls StarsDetector object)
            parent.StarsDetected_Label.text = "(1) Detecting stars..."
            processEvents();
            let AllStars = Engine.getStars(refView);
            // (2) Make PSF fitting for all detected stars (calls DynamicPSF process)
            parent.StarsDetected_Label.text = "(2) PSF fitting..."
            Engine.fitStarPSF();
            // (3) Now can calculate star statistics
            parent.StarsDetected_Label.text = "(3) Calculating statistics..."
            Engine.calculateStarStats();
            Engine.printStars();
            Engine.printGroupStat();
            if (!__DEBUGF__)
                Engine.closeTempImages();

            this.parent.updateMainData();
            this.parent.displayStarsStat(Engine.Stars);
            this.parent.displaySizeGroupsStat(Engine.StarsSizeGoupCnt, Engine.SizeGrouping, Engine.Stat );
            this.parent.displayFluxGroupsStat(Engine.StarsFluxGoupCnt, Engine.FluxGrouping, Engine.Stat );
            this.parent.filter_Button.enabled = true;
            this.parent.mask_Button.enabled = true;
            this.parent.showDetected_Button.enabled = true;
            return true;
        }
    }

	// Filter stars button
    this.filter_Button = new PushButton( this );
	with (this.filter_Button) {
        text = "Filter";
        toolTip = "Filter stars by flux";
        icon = this.scaledResource( ":/icons/filter.png" );
        //icon = this.scaledResource( ":/icons/filter-delete.png" );
        backgroundColor = this.backgroundColor;
        //iconHeight = 40;
        setFixedHeight (40);
        enabled = false;
        onClick = function () {
            if ( this.backgroundColor == parent.backgroundColor ) {
                console.noteln();
                console.noteln("Appling filters...");
                this.pushed = true;
                this.icon = this.scaledResource( ":/icons/filter-delete.png" );
                this.backgroundColor = 0xffffffff;
                
                // Filter by size (if needed)
                let FilteredStars = undefined;
                if (Config.FilterSize_min != roundDown(Engine.Stat.r_min,2) || Config.FilterSize_max != roundUp(Engine.Stat.r_max,2))
                    FilteredStars = Engine.filterStarsBySize(Config.FilterSize_min, Config.FilterSize_max);
                // Filter by flux (if needed)
                if (Config.FilterFlux_min != roundDown(Engine.Stat.flux_min,2) || Config.FilterFlux_max != roundUp(Engine.Stat.flux_max,2))
                    FilteredStars = Engine.filterStarsByFlux(Config.FilterFlux_min, Config.FilterFlux_max, FilteredStars);
                
                this.parent.updateMainData(FilteredStars);
                
            } else {
                console.criticalln("Remove filter");
                this.pushed = false;
                this.backgroundColor = parent.backgroundColor;
                this.icon = this.scaledResource( ":/icons/filter.png" );
                Engine.filterApplied = false;
                this.parent.updateMainData();
            }
            Config.saveSettings();
        }
        onRelease = function () {
            return false;
        }
    }

	// Create Mask button
    this.mask_Button = new PushButton( this );
	with (this.mask_Button) {
        text = "Create Mask";
        toolTip = "Create mask";
        enabled = false;
        icon = this.scaledResource( ":/toolbar/mask-enabled.png" );
        setFixedHeight (40);
        onClick = function () {
            console.noteln();
            console.noteln("Creating mask...");
            Config.MaskName = Engine.GetMaskName();
            if (Engine.filterApplied) {
                parent.StarMaskId = Engine.createMaskAngle(Engine.FilteredStars, Config.softenMask, Config.maskGrowth, Config.contourMask, Config.MaskName);
            } else {
                parent.StarMaskId = Engine.createMaskAngle(undefined, Config.softenMask, Config.maskGrowth, Config.contourMask, Config.MaskName);
            }
            Config.saveSettings();
        }
    }

	// Outuput Detected stars + Mask residiul button
    this.showDetected_Button = new PushButton( this );
    with (this.showDetected_Button) {
        text = "Show Detected";
        toolTip = "Output detected stars and stars residial";
        setFixedHeight (40);
        enabled = false;
        onClick = function () {
            console.writeln("Show detected stars...");
            // now we can calc statistics
            if (Engine.filterApplied) {
                Engine.markStars(Engine.FilteredStars);
            } else {
                Engine.markStars();
            }
            if (parent.StarMaskId)
                Engine.makeResidual(parent.StarMaskId);
        }
    }

	// Process all button
    this.ok_Button = new PushButton( this );
	with(this.ok_Button) {
        text = "Create";
        toolTip = "Process everything (detected, calc stat and output mask)";
        icon = this.scaledResource( ":/icons/ok.png" );
        setFixedHeight (40);
        onClick = function () {
            Config.saveSettings();
            this.dialog.ok();
        }
    }

    // CLOSE button
    this.cancel_Button = new PushButton( this );
	with(this.cancel_Button) {
        text = "Close";
        toolTip = "Close the " + __SCRIPT_NAME__ + " script.";
        setFixedHeight (40);
        iconHeight = 100;
        icon =  this.scaledResource( ":/icons/close.png" );
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

        add(this.evaluate_Button);
        add(this.filter_Button);
        add(this.mask_Button);
        add(this.showDetected_Button);
        addSpacing(20);
		add(this.ok_Button);
        add(this.cancel_Button);
    }

    // == DIALOG total build ==

    this.sizer = new VerticalSizer;
    with (this.sizer) {
        margin = 8;
        spacing = 6;
        add(this.helpLabel);
        addSpacing(4);
		add(this.InformationGroupBox);
        addSpacing(4);

        add(this.Filter_Sizer);
        addSpacing(4);

        add(this.GroupingReports_Sizer);
        addSpacing(10);

        add(this.StarList_Section);
        add(this.StarList_Control);
		//add(this.starsListTreeBox);

        //add(this.clearConsoleCheckBox_Sizer);
        addSpacing(10);
        //add(this.outputControls_GroupBox);
        //this.imgSetAccess_GroupBox.hide();
        add(this.buttons_Sizer);
    }

    this.windowTitle = __SCRIPT_NAME__ + " Script";
    this.adjustToContents();


	// -- Handlers --

 	this.displayStarsStat = function( StarsArray = undefined, topRecords = 0)
    {
 		debug("<i>displayStarStat: output stars data to TreeBox. StarsArray = " + (StarsArray?StarsArray.length:StarsArray));
        this.starsListTreeBox.clear();

        // Rows
        if ( topRecords == 0 )
            topRecords = StarsArray.length;

 		for ( var i = 0; i < topRecords; ++i ) {

 			var treeNode = new TreeBoxNode();
 			let s = StarsArray[i];

            for ( let col = 0; col < this.starsListColumnKeys.length; ++col ) {
                let { extractor, precision } = this.starsListColumnKeys[col];

                // Convert `rawValue` to string, with formatting for numbers:
                let rawValue = extractor(s);
                let text;
                if (typeof rawValue === "number" && !isNaN(rawValue)) {
                    // Format number with the column's precision
                    text = rawValue.toFixed( precision );
                    treeNode.setAlignment( col, Align_Right );
                } else {
                    text = rawValue != null ? rawValue.toString() : "";
                    treeNode.setAlignment( col, Align_Left );
                }

                if (this.starsListColumnKeys[col].color) {
                    treeNode.setTextColor( col, this.starsListColumnKeys[col].color );
                    //treeNode.setBackgroundColor( 2, Color.GRAY );
                }
                treeNode.setText( col, text );
            }
            this.starsListTreeBox.add( treeNode );
 		}
 	}


 	this.displaySizeGroupsStat = function( StarsSizeGoupArr, SizeGrouping, Stat )
    {
 		debug("displaySizeGroupsStat: output stars size grouping data to TreeBox. StarsArray = " + (StarsSizeGoupArr ? StarsSizeGoupArr.length : StarsSizeGoupArr));
        this.starsSizeGroupsTreeBox.clear();

 		for ( var i = 0; i < StarsSizeGoupArr.length; ++i ) {
 			var treeNode = new TreeBoxNode();
            let hi, lo;

			lo = Stat.r_min + i * SizeGrouping.IntervalWidth;
			if (i == StarsSizeGoupArr.length-1)
				hi = Stat.r_max;
			else
				hi = lo + SizeGrouping.IntervalWidth;

            treeNode.setText( 0, i.toFixed(0) );
            treeNode.setAlignment( 0, Align_Right );
            treeNode.setTextColor( 0, Color.RED );

            treeNode.setText( 1, lo.toFixed( 2 ) );
            treeNode.setAlignment( 1, Align_Right );
            //treeNode.setTextColor( 1, Color.RED );

            treeNode.setText( 2, hi.toFixed( 2 ) );
            treeNode.setAlignment( 2, Align_Right );
            //treeNode.setTextColor( 2, Color.RED );

            treeNode.setText( 3, (StarsSizeGoupArr[i] ? StarsSizeGoupArr[i] : 0).toFixed(0) );
            treeNode.setAlignment( 3, Align_Right );
            treeNode.setTextColor( 3, Color.BLUE );

            this.starsSizeGroupsTreeBox.add( treeNode );
        }
 	}

 	this.displayFluxGroupsStat = function( StarsFluxGoupArr, FluxGrouping, Stat )
    {
 		debug("displayFluxGroupsStat: output stars flux grouping data to TreeBox. StarsArray = " + (StarsFluxGoupArr ? StarsFluxGoupArr.length : StarsFluxGoupArr));
        this.starsFluxGroupsTreeBox.clear();

 		for ( var i = 0; i < StarsFluxGoupArr.length; ++i ) {
 			var treeNode = new TreeBoxNode();
            let hi, lo;

            lo = Math.pow( 10, FluxGrouping.IntervalWidth * i) *  Stat.flux_min ;
            if (i == StarsFluxGoupArr.length-1)
                hi = Stat.flux_max ;
            else
                hi = Math.pow( 10, FluxGrouping.IntervalWidth * (i+1)) *  Stat.flux_min ;;

            treeNode.setText( 0, i.toFixed(0) );
            treeNode.setAlignment( 0, Align_Right );
            treeNode.setTextColor( 0, Color.RED );

            treeNode.setText( 1, lo.toFixed( 3 ) );
            treeNode.setAlignment( 1, Align_Right );
            //treeNode.setTextColor( 1, Color.RED );

            treeNode.setText( 2, hi.toFixed( 3 ) );
            treeNode.setAlignment( 2, Align_Right );
            //treeNode.setTextColor( 2, Color.RED );

            treeNode.setText( 3, (StarsFluxGoupArr[i] ? StarsFluxGoupArr[i] : 0).toFixed(0) );
            treeNode.setAlignment( 3, Align_Right );
            treeNode.setTextColor( 3, Color.BLUE );

            this.starsFluxGroupsTreeBox.add( treeNode );
        }
 	}

	this.updateMainData = function ( FilteredStarsArray = undefined )
	{
        debug("<i>updateMainData: put stats into fields</i>");

        debug("Stars: " + Engine.Stars.length  + ", fitted: " + Engine.cntFittedStars);
        
        if (!FilteredStarsArray) {
            this.StarsDetected_Label.text = Engine.Stars.length.toString() + ", fitted: " + Engine.cntFittedStars.toString();
            
            this.minSizeFilter_Edit.text = roundDown(Engine.Stat.r_min,2).toFixed(2);
            this.maxSizeFilter_Edit.text = roundUp(Engine.Stat.r_max,2).toFixed(2);

            this.minFluxFilter_Edit.text = roundDown(Engine.Stat.flux_min,3).toFixed(3);
            this.maxFluxFilter_Edit.text = roundUp(Engine.Stat.flux_max,3).toFixed(3);
            
            Config.FilterSize_min = roundDown(Engine.Stat.r_min,2);
            Config.FilterSize_max = roundUp(Engine.Stat.r_max,2);

            Config.FilterFlux_min = roundDown(Engine.Stat.flux_min,3);
            Config.FilterFlux_max = roundUp(Engine.Stat.flux_max,3);
            
        } else {
            console.writeln();
            console.writeln("Stars after filters applied: " + Engine.FilteredStars.length.toString());
            this.StarsDetected_Label.text = "filtered " + Engine.FilteredStars.length.toString() + " out of " + Engine.Stars.length.toString();
        }
	}
    

}

//main
function mainGUI() {
    if (!__DEBUGF__)
        console.hide();

    if (__DEBUGF__)
        console.clear();

    console.noteln(__SCRIPT_NAME__, " script started. Version: ", __SCRIPT_VERSION__, " Date: ", __SCRIPT_DATE__);
    console.noteln("PixInsight Version: ", coreId, " build ", coreVersionBuild);
    //console.noteln("PixInsight Version: ", coreId, " build ", coreVersionBuild, " (", coreVersionMajor, ".", coreVersionMinor, ".", coreVersionRelease, ")");

   var refView = ImageWindow.activeWindow.currentView;

   console.writeln ("Working on image: <b>" + (refView.fullId == "" ? "no image" : refView.fullId) + "</b>");
   if (refView.window.filePath) console.writeln ("ImagePath: " + refView.window.filePath + "");

    Config.loadSettings();

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        if (__DEBUGF__)
            console.writeln("Running script instance");
        Config.importParameters();

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
    SelectiveStarMask_Dialog.prototype = new Dialog;
    var dialog = new SelectiveStarMask_Dialog(refView);

    // Show our dialog box, quit if cancelled.
    for (; ; ) {
        if (dialog.execute()) {
            if (refView.fullId == "") {
                var msgStr = "<p>There are no image specified.</p>" +
                    "<p>Do you wish to continue?</p>";
                var msg = new MessageBox(msgStr, __SCRIPT_NAME__, StdIcon_Error, StdButton_Yes, StdButton_No);
                if (msg.execute() == StdButton_Yes)
                    continue;
                else
                    break;
            } else {
                console.show();
                processEvents();
                break;
            }
        } else {
            var msgStr = "<p>All infromation would be lost.</p>" +
                "<p>Are you sure?</p>";
            var msgBox = new MessageBox(msgStr, __SCRIPT_NAME__, StdIcon_Error, StdButton_Yes, StdButton_No);
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

#ifndef __SELECTIVESTARMASK_MAIN__
    //Engine
	var Engine = new SelectiveStarMask_engine();
	mainGUI();
#endif
