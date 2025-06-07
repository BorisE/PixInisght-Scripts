/*
 *  SelectiveStarMask - A PixInsight Script to create StarMasks based on their sizes
 *  Copyright (C) 2024  Boris Emchenko http://astromania.info
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

#feature-id Utilities2 > SelectiveStarMask
#feature-info A script for generating precise star masks filtered by size and brightness \
    using StarDetector and PSF fitting. <br/>\
    <br/>\
    Copyright &copy; 2024-2025 Boris Emchenko (astromania.info)

//File id
#define __SELECTIVESTARMASK_MAIN__

// Run Debug mode
#define __DEBUGF__ false  /*or false*/

// Need to be in front of other declarations
#ifndef __SELECTIVESTARMASK_VERSION_JSH__
	#include "SelectiveStarMask-version.jsh"	// Version
    #include "SelectiveStarMask-lib.js"
#endif
// Need to be a second
#ifndef __STARMASKSIZE_SETTINGS__
	#include "SelectiveStarMask-settings.js" // Settings object
#endif
// Variable for global access to script data
let Config = new ConfigData();

#ifndef __SELECTIVESTARMASK_GUI__
	#include "SelectiveStarMask-GUI.js" // GUI
#endif
#ifndef __SELECTIVESTARMASK_ENGINE__
	#include "SelectiveStarMask-engine.js" // Engine
#endif

let Engine;


//main
function main() {
    if (!__DEBUGF__)
        console.hide();

    if (__DEBUGF__)
        console.clear();

    console.noteln(__SCRIPT_NAME__, ". Version: ", __SCRIPT_VERSION__, " Date: ", __SCRIPT_DATE__);

    if (__DEBUGF__)
    console.noteln("PixInsight Version: ", coreId, " build ", coreVersionBuild);
    //console.noteln("PixInsight Version: ", coreId, " build ", coreVersionBuild, " (", coreVersionMajor, ".", coreVersionMinor, ".", coreVersionRelease, ")");

    var refView = ImageWindow.activeWindow.currentView;

    console.writeln ("Working on image: <b>" + (refView.fullId == "" ? "no image" : refView.fullId) + "</b>");
    if (refView.window.filePath) console.writeln ("ImagePath: " + refView.window.filePath + "");

    Config.loadSettings();

    Engine = new SelectiveStarMask_engine();
    Engine.debug = __DEBUGF__;

    if (Parameters.isGlobalTarget || Parameters.isViewTarget) {
        if (__DEBUGF__)
            console.noteln("Running from saved script instance");
        Config.importParameters();

        // Run without GUI
        if (Parameters.isViewTarget) {
            console.noteln("Executed on target view, created StarMask based on saved parameters without GUI");
            main_cli(refView);
            return true;
        }
    } else {
        if (__DEBUGF__)
            console.writeln("Started as a new script");
    }

    // For future use
    if (!Parameters.isViewTarget) {
        if (__DEBUGF__)
            console.noteln("Global context");
    }

    main_gui(refView);

    return true;
}


function main_cli(refView)
{
    console.abortEnabled = true;

    let T = new ElapsedTime;


    // (1) Detect stars in the image (calls StarsDetector object)
    var AllStars = Engine.getStars( refView );
    // (2) Make PSF fitting for all detected stars (calls DynamicPSF process)
    Engine.fitStarPSF();
    // (3) Now can calculate star statistics
    Engine.calculateStarStats();
    Engine.printStars();
    Engine.printGroupStat();

    // (4) Filter stars based on saved parameters
    let FilteredStars = undefined;
    if ( (Config.FilterSize_min != roundDown(Engine.Stat.r_min,2) || Config.FilterSize_max != roundUp(Engine.Stat.r_max,2)) && ( Config.FilterSize_min != 0 || Config.FilterSize_max != MAX_INT))
        FilteredStars = Engine.filterStarsBySize(Config.FilterSize_min, Config.FilterSize_max);
    if ((Config.FilterFlux_min != roundDown(Engine.Stat.flux_min,2) || Config.FilterFlux_max != roundUp(Engine.Stat.flux_max,2)) && ( Config.FilterFlux_min != 0 || Config.FilterFlux_max != MAX_INT))
        FilteredStars = Engine.filterStarsByFlux(Config.FilterFlux_min, Config.FilterFlux_max, FilteredStars);

    // (5) Create StarMask
    Config.MaskName = Engine.GetMaskName();
    let StarMaskId = Engine.createMaskAngle(Engine.FilteredStars, Config.softenMask, Config.maskGrowth, Config.contourMask, Config.MaskName);

    // (6) Create residuals
    //Engine.makeResidual(mask);
    //Engine.markStars(AllStars);


    if (!__DEBUGF__)
        Engine.closeTempImages();

    console.writeln( "Runtime: " + T.text );
    return true;
}


function main_gui(refView)
{
    // Our dialog inherits all properties and methods from the core Dialog object.
    SelectiveStarMask_Dialog.prototype = new Dialog;
    var dialog = new SelectiveStarMask_Dialog(refView);

    // Show our dialog box, quit if cancelled.
    for (; ; ) {
        if (dialog.execute()) {
            if (refView.fullId == "") {
                console.criticalln("There is no active image to work on");
                return false;
            } else {
                if (__DEBUGF__)
                    console.noteln("Ok pressed and dialog was closed");
                console.show();
                processEvents();
                return main_cli(refView);
            }
        } else {
            /*
            if (__DEBUGF__)
                console.warningln("Cancel was pressed");
            var msgStr = "<p>All infromation would be lost.</p>" +
                "<p>Are you sure?</p>";
            var msgBox = new MessageBox(msgStr, __SCRIPT_NAME__, StdIcon_Error, StdButton_Yes, StdButton_No);
            if (msgBox.execute() == StdButton_Yes)
                break;
            else
                continue;
            */
            break; // instead of asking loop
        }
        break;
    }
    return true;
}


// --  Run main function

main();

