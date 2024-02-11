
/* global NSG_RUN_STATUS_UNKNOWN, CoreApplication, VERSION, TITLE, Parameters, StdIcon_Warning, StdButton_Ok, NSG_MIN_STAR_PAIR_WARN, StdIcon_Error, compareResultWeight, compareResultObsDate */

// Version 1.0 (c) John Murphy 4th-Apr-2021
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
"use strict";
#feature-id NormalizeScaleGradient : Batch Processing > NormalizeScaleGradient

#feature-icon @script_icons_dir/NormalizeScaleGradient.svg

#feature-info Normalizes the scale and gradient to that of the reference image. \
Photometry is used to determine the scale, and a surface spline to model the relative gradient.<br/>\
Copyright &copy; 2019-2022 John Murphy.<br/> \
StarDetector.jsh: Copyright &copy; 2003-2020 Pleiades Astrophoto S.L. All Rights Reserved.<br/>

#define TITLE "NormalizeScaleGradient+"
#define VERSION "3.0.3b"
#define TEST false
#define ABORT 1
#define ASK_USER 2
#define MAX_SMOOTHNESS 4
#define MIN_GRADIENT_INC 5
// Smallest gradient image should be at least 2,194 bytes
#define MIN_IMAGE_SIZE 1000
// Smallest xnml file should be at least 1,299 bytes
#define MIN_XNML_SIZE 500

// Results file
#define NSG_MIN_STAR_PAIR_WARN 3
#define NSG_RUN_STATUS_UNKNOWN "unknown"
#define NSG_RUN_STATUS_NORMAL "normal"
#define NSG_RUN_STATUS_FAILED "failed"
#define NSG_RUN_STATUS_ABORTED "aborted"
#define NSG_RUN_STATUS_EXCEPTION "exception"

// Used in NsgData
#define APERTURE_ADD 1
#define APERTURE_GROWTH 0.25
#define APERTURE_GROWTH_REJECTION 0.25
#define APERTURE_GAP 2
#define APERTURE_BKG_DELTA 10
#define LINEAR_RANGE 0.7
#define DEFAULT_PIXEL_SIZE 6
#define DEFAULT_FOCAL_LENGTH 1000
#define DEFAULT_OUTPUT_DIR "./NSG"
#define DEFAULT_STAR_DETECTION -1.0
#define DEFAULT_STAR_FLUX_TOLERANCE 1.5
#define DEFAULT_STAR_SEARCH_RADIUS 2.0
#define DEFAULT_GRADIENT_SMOOTHNESS -2.0
#define DEFAULT_MIN_WEIGHT 0.25
#define DEFAULT_MIN_SCALE 0.75
#define KEYPREFIX "NormalizeScaleGradient"

// Used in NsgDialog
#define REF_TEXT_COLOR 0xFF55AA55
#define COL_PROCESSED 0
#define COL_FILENAME 1
#define COL_FULL_FILENAME 2
#define COL_NOISE 3
#define COL_ALT 4
#define COL_AIRMASS 5
#define COL_EXPOSURE 6
#define COL_DATEOBS 7
#define COL_FILTER 8

// Used in STF Auto Stetch
// Shadows clipping point in (normalized) MAD units from the median.
#define DEFAULT_AUTOSTRETCH_SCLIP  -2.80
// Target mean background in the [0,1] range.
#define DEFAULT_AUTOSTRETCH_TBGND   0.25
// Apply the same STF to all nominal channels (true), or treat each channel
// separately (false).
#define DEFAULT_AUTOSTRETCH_CLINK   true

// Used in Sample grid dialog
#define MAX_CIRCLE_RADIUS 800
#define MANUAL_RADIUS 20
#define MAX_BLACK_PIXEL_FRAC 0.01

// Used in Starlib
#define __PJSR_NO_STAR_DETECTOR_TEST_ROUTINES 1
#define __PJSR_STAR_OBJECT_DEFINED  1
#define STAR_BKG_DELTA 3
#define MIN_STAR_MATCHES 250

#define COMPARING_MRS_KSIGMA "Comparing MRS with KSigma"

#include <pjsr/UndoFlag.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/ImageOp.jsh>
#include <pjsr/ResizeMode.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/ButtonCodes.jsh>
#include <pjsr/StdDialogCode.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/BRQuadTree.jsh>
#include <pjsr/ReadTextOptions.jsh>
#include "lib/BlinkDialog.js"
#include "lib/Cache.js"
#include "lib/DetectedStarsDialog.js"
#include "lib/DialogControls.js"
#include "lib/FitsHeader.js"
#include "lib/FitsHeaderReader.js"
#include "lib/Graph.js"
#include "lib/Gradient.js"
#include "lib/GradientGraph.js"
#include "lib/GradientGraphDialog.js"
#include "lib/HelpDialog.js"
#include "lib/ImageReader.js"
#include "lib/ImageScaleDialog.js"
#include "lib/LeastSquareFit.js"
#include "lib/NsgData.js"
#include "lib/NsgDialog.js"
#include "lib/PhotometryStarsDialog.js"
#include "lib/PhotometryGraphDialog.js"
#include "lib/PreviewControl.js"
#include "lib/ProgressDialog.js"
#include "lib/Results.js"
#include "lib/SampleGrid.js"
#include "lib/SampleGridDialog.js"
#include "lib/SelectionGraphDialog.js"
#include "lib/StarLib.js"
#include "lib/StarDetector.js"
#include "lib/STFAutoStretch.js"
#include "extraControls/BinnedSampleGridDialog.js"
#include "lib/Nsg.js"

let isPSFScaleSnrAvailable;

let nsgTgtResults;              // Map: filename -> Result
let blinkDataArray;
let blinkRejects;
let runBlinkFlag;
let isApplyMode;
let targetTableEntriesMap;      // Map: filename -> TargetTableEntries
let NSG_FILENAME_HEADERS_MAP;   // Map: filename -> HeaderEntries
let lastException;

let defaultOutputFileFormat;
let defaultExtension;

function main() {
    isPSFScaleSnrAvailable = false;
    lastException = undefined;
    nsgTgtResults = new Map();
    blinkDataArray = [];
    blinkRejects = [];
    runBlinkFlag = false;
    isApplyMode = false;
    targetTableEntriesMap = new Map();      // Map: filename -> TargetTableEntries
    NSG_FILENAME_HEADERS_MAP = new Map();   // Map: filename -> HeaderEntries
	
	defaultExtension = ".fit"
    defaultOutputFileFormat = new FileFormat( defaultExtension, false/*toRead*/, true/*toWrite*/ );    
    
	
	/**
     * If checks are all ok, displays ImageIntegration
     * @param {NsgData} data
     * @param {Boolean} allowIntegrationRun 
     */
    function invokeImageIntegration(data, allowIntegrationRun){
        const ref = data.cache.getRefFilename();
        const targets = data.targetFiles;
        if (data.useImageIntegration && ref && targets && nsgTgtResults.size > 0){
            // Only show II if all target images have been processed.
            let displayII = true;
            for (let t of targets){
                if (!isCachedResultValid(data, t)){
                    displayII = false;
                    break;
                }
            }
            if (displayII){
                let wasConsoleAbortEnabled = console.abortEnabled;
                try {
                    console.abortEnabled = true;
                    runImageIntegration(data, allowIntegrationRun);
                } catch (e){
                    logError(e, "Running ImageIntegration");
                } finally {
                    console.abortEnabled = wasConsoleAbortEnabled;
                }
            }
        }
    }
    
    function calcPixInsightVersion(major, minor, release, revision){
        return major*1000000 + minor*1000 + release + revision / 1000;
    }
    
    let pixInsightVersion = calcPixInsightVersion(
            CoreApplication.versionMajor, CoreApplication.versionMinor, 
            CoreApplication.versionRelease, CoreApplication.versionRevision);
    if (pixInsightVersion < calcPixInsightVersion(1, 8, 9, 1)){
        let msg = "NormalizeScaleGradient requires PixInsight version 1.8.9-1 or later.";
        displayError(msg, true);
        console.show();
        console.criticalln(msg);
        return;
    }
    console.writeln(TITLE, " ", VERSION);
    // Create dialog, start looping
    let nsgDialog;
    let data = new NsgData();

    /**
     * @param {NsgData} data
     * @param {Boolean} runFromProcessIcon If true, not running from NSG's Apply button; nead to read results file.
     */
    function runAsViewTarget(data, runFromProcessIcon){
        try {
            let refFilename = data.cache.getRefFilename();
            if (preRunChecks(data, refFilename, false)){
                let consoleLog = getNsgDataDir(data, refFilename);
                consoleLog += "NSG_Log_" + getDateString() + ".txt";
                console.beginLog(consoleLog);
                console.writeln("\n========================================================");
                console.writeln("Running " + TITLE + " " + VERSION + " (Background process)");
                console.writeln("========================================================");
                if (runFromProcessIcon){
                    try {
                        let nsgRunStatus = readResultsFile(data, data.resultsFileBg);
                        nsgRunStatus.ifFailedShowMessage();
                    } catch (fileExeption){
                        nsgTgtResults = new Map();
                        logError(fileExeption);
                    }
                }
                try {
                    // 'Apply' mode or from process icon. Use 'Continue run'.
                    runNSG(data, refFilename, undefined, false, runFromProcessIcon);
                    invokeImageIntegration(data, true);
                } catch (e){
                    logError(e, null, refFilename);
                } finally {
                    console.endLog();
                    console.noteln("NSG log file:\n" + consoleLog);
                }
            } 
        } catch (e){
            logError(e);
        } finally {
            recoverMemory(data);
            if (lastException){
                throw lastException;
            }
        }
    }
    
    if (Parameters.isViewTarget) {
        // ProcessIcon in ProcessContainer, or drag ProcessIcon onto dummy image, or icon right click menu.
        // Perform the script on the target view (no user interface)
        // Normally we would process the target view. Instead we will use the target list.
        console.show();
        console.writeln("\nNSG always uses the reference and target images specified within NSG. " +
                "So although a ProcessContainer requires at least one open image on the PixInsight desktop, " +
                "NSG will ignore this image.");
        if (!data.isNSGXnmlInstalled){
            let msg = "To run NSG from a ProcessContainer or with a View Target, please purchase NSGXnml. Thank you.";
            new MessageBox(msg, TITLE, StdIcon_Warning, StdButton_Ok).execute();
            return;
        }
        data.loadParameters(true);
        runAsViewTarget(data, true);
        return;
    } else if (Parameters.isGlobalTarget) {
        // Running NSG from a process icon, with user interface.
        data.loadParameters(false);
    } else {
        // Running NSG from the PixInsight SCRIPT menu.
        data.restoreSettings();
    }
    let nsgRunStatus;
    try {
        nsgRunStatus = readResultsFile(data, data.resultsFile);
    } catch (fileExeption){
        nsgRunStatus = new NsgRunStatus();
        nsgTgtResults = new Map();
        logError(fileExeption);
    }
    try {
        nsgDialog = new NsgDialog(data);
        data.setNsgDialog(nsgDialog);        
        data.setPhotometryAutoValues(data.useAutoPhotometry, false);       
        data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, false);       
        if (nsgTgtResults.size){
            // ===========================
            // Results Summary of last run
            // ===========================
            let results = ArrayFromMapValues(nsgTgtResults); 
            if (data.sortByWeight){
                results.sort(compareResultWeight);
            } else {
                results.sort(compareResultObsDate);
            }
            let sortOrder = data.sortByWeight ? "weight" : "date";
            console.writeln("\n<b><u>Summary (previous run, sorted by ", sortOrder, ")</u></b>");
            if (!nsgTgtResults.has(data.cache.getRefFilename())){
                // reference not in target list, or not processed (abort)
                console.noteln("[0], ", data.cache.getRefFilename());
            }
            for (let i=0; i<results.length; i++){
                let text = "[" + (i+1) + "], " + results[i].summary;
                if (results[i].isRef){
                    console.noteln(text, ", Reference");
                } else if (results[i].hasPhotometryWarning(NSG_MIN_STAR_PAIR_WARN)){
                    let warnText = ", Warning: Photometry star matches: " + results[i].nPhotometryStarPairs;
                    console.warningln(text + warnText);
                } else {
                    console.writeln(text);
                }
            }
            nsgRunStatus.ifFailedShowMessage();
        }
    } catch (error){
        logError(error, "While constructing nsgDialog");
        // return to default values
        data.setParameters();
        data.resetSettings();
        nsgDialog = new NsgDialog(data);
        data.setNsgDialog(nsgDialog);
    }
    for (; ; ) {
        if (!nsgDialog.execute() || isApplyMode){
            // Dialog cancelled, or the square 'Apply View Target' toolbutton was activated.
            break;
        }
        console.show();
        gc(true);   // Recover memory used by dialog or blink or last run
        if (runBlinkFlag){
            try {
                runBlink(data, nsgDialog, blinkDataArray);
            } catch (e){
                logError(e);
            } finally {
                runBlinkFlag = false;
                blinkDataArray = [];
                if (console.abortRequested){
                    console.criticalln("NSG Blink aborted by user");
                    return;
                }
                continue;
            }
        }
        
        // Run NSG
        lastException = undefined;
        let refFilename = data.cache.getRefFilename();
        if (!preRunChecks(data, refFilename, true)){
            continue;
        }
        let consoleLog = getNsgDataDir(data, refFilename);
        consoleLog += "NSG_Log_" + getDateString() + ".txt";
        try {
            console.beginLog(consoleLog);
        } catch (e){
            console.endLog();
            console.criticalln("** Error: Failed to create consoleLog:\n", consoleLog, "\n", e.toString());
            new MessageBox(e.toString(), TITLE, StdIcon_Error, StdButton_Ok).execute();
            break;
        }
        try {
            console.writeln("\n====================================");
            console.writeln("Running " + TITLE + " " + VERSION);
            console.writeln("====================================");
            const runAll = (nsgDialog && nsgDialog.runAll);
            runNSG(data, refFilename, nsgDialog, runAll, false);
            nsgDialog.updateTargetTextColor(data);
            if (console.abortRequested){
                break;
            }
        } catch (e){
            new MessageBox(e.toString(), TITLE, StdIcon_Error, StdButton_Ok).execute();
            logError(e);
        } finally {
            if (lastException){
                let errMsg = "<p>NSG Failed. Please report the error to johnastro.info@gmail.com</p>" +
                        "<p>If the error is File I/O or memory related:</p>" +
                        "<ul><li>Restart PixInsight to clear memory and file I/O resources.</li>" +
                        "<li>Start NSG, and use '<b>Continue run</b>'.</li></ul></p>";
                new MessageBox(errMsg, TITLE, StdIcon_Error, StdButton_Ok).execute();
            }
            console.endLog();
            console.noteln("NSG log file:\n" + consoleLog);
        }
    }
    if (isApplyMode){
        // User pressed the blue square Apply (View Target) toolbutton
        nsgDialog = undefined;
        runAsViewTarget(data, false);
        return;
    }
    if (!lastException){
        invokeImageIntegration(data, false);
    }
    data.saveSettings();
    recoverMemory(data);
    if (lastException){
        throw lastException;
    }
    return;
}

/** Attempt to release memory when NSG exits. Invalidates cache.
 * Clears nsgTgtResults, targetTableEntriesMap, NSG_FILENAME_HEADERS_MAP maps.
 * Sets data.targetFiles BlinkDataArray and BlinkRejects to []
 * @param {NsgData} data
 */
function recoverMemory(data){
    if (data && data.cache !== undefined){
        data.cache.invalidate();
    }
    data.targetFiles = [];
    if (nsgTgtResults){
        nsgTgtResults.clear();
    }
    blinkDataArray = [];
    blinkRejects = [];
    if (targetTableEntriesMap){
        targetTableEntriesMap.clear();
    }
    if (NSG_FILENAME_HEADERS_MAP){
        NSG_FILENAME_HEADERS_MAP.clear();
    }
    gc(true);
}

main();
