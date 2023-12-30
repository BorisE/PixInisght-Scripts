/* global Dialog, DataType_Float, Settings, DataType_Int32, FrameStyle_Sunken, DEFAULT_PIXEL_SIZE, DEFAULT_FOCAL_LENGTH, TextAlign_VertCenter, File */

// Version 1.0 (c) John Murphy 31st-Jul-2022
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
//"use strict";

/**
 * @param {String} refFilename Full filename including path
 * @param {Number} nImages
 * @param {String} title Dialog title
 * @param {NsgStatus} nsgStatus
 * @returns {ProgressDialog}
 */
function ProgressDialog( refFilename, nImages, title, nsgStatus ){
    this.__base__ = Dialog;
    this.__base__();

    let self = this;
    let startTime = new Date().getTime();

    let refTextLabel = new Label();
    refTextLabel.frameStyle = FrameStyle_Sunken;
    refTextLabel.text = File.extractName(refFilename);
    let refStarsLabel = new Label();
    refStarsLabel.margin = 2;
    refStarsLabel.textAlignment = TextAlign_VertCenter;
    refStarsLabel.text = "Stars:";
    let refStarsTextLabel = new Label();
    refStarsTextLabel.margin = 2;
    refStarsTextLabel.textAlignment = TextAlign_VertCenter;
    refStarsTextLabel.frameStyle = FrameStyle_Sunken;
    refStarsTextLabel.text = "---";
    let nPhotStars = new Label();
    nPhotStars.margin = 2;
    nPhotStars.textAlignment = TextAlign_VertCenter;
    nPhotStars.text = "Photometry star pairs:";
    let nPhotStarsTextLabel = new Label();
    nPhotStarsTextLabel.margin = 2;
    nPhotStarsTextLabel.textAlignment = TextAlign_VertCenter;
    nPhotStarsTextLabel.frameStyle = FrameStyle_Sunken;
    nPhotStarsTextLabel.text = "---";
    let refStarsSizer = new HorizontalSizer();
    refStarsSizer.spacing = 2;
    refStarsSizer.add(refStarsLabel);
    refStarsSizer.add(refStarsTextLabel);
    refStarsSizer.addSpacing(10);
    refStarsSizer.add(nPhotStars);
    refStarsSizer.add(nPhotStarsTextLabel);
    refStarsSizer.addStretch();

    let refGroupBox = new GroupBox(this);
    refGroupBox.title = "Reference image";
    refGroupBox.sizer = new VerticalSizer();
    refGroupBox.sizer.margin = 4;
    refGroupBox.sizer.spacing = 4;
    refGroupBox.sizer.add(refTextLabel);
    refGroupBox.sizer.add(refStarsSizer);
    let minWidth = 550;
    refGroupBox.minWidth = this.logicalPixelsToPhysical(minWidth);
    
    let tgtTextLabel = new Label();
    tgtTextLabel.frameStyle = FrameStyle_Sunken;
    tgtTextLabel.text = "Processing first target image...";
    
    let tgtStarsLabel = new Label();
    tgtStarsLabel.margin = 2;
    tgtStarsLabel.textAlignment = TextAlign_VertCenter;
    tgtStarsLabel.text = "Stars:";
    let tgtStarsTextLabel = new Label();
    tgtStarsTextLabel.margin = 2;
    tgtStarsTextLabel.textAlignment = TextAlign_VertCenter;
    tgtStarsTextLabel.frameStyle = FrameStyle_Sunken;
    tgtStarsTextLabel.text = " ";
    
    let scaleLabel = new Label();
    scaleLabel.margin = 2;
    scaleLabel.textAlignment = TextAlign_VertCenter;
    scaleLabel.text = "Transmission:";
    let scaleTextLabel = new Label();
    scaleTextLabel.margin = 2;
    scaleTextLabel.textAlignment = TextAlign_VertCenter;
    scaleTextLabel.frameStyle = FrameStyle_Sunken;
    scaleTextLabel.text = " ";
    
    let snrLabel = new Label();
    snrLabel.margin = 2;
    snrLabel.textAlignment = TextAlign_VertCenter;
    snrLabel.text = "SNR:";
    let snrTextLabel = new Label();
    snrTextLabel.margin = 2;
    snrTextLabel.textAlignment = TextAlign_VertCenter;
    snrTextLabel.frameStyle = FrameStyle_Sunken;
    snrTextLabel.text = " ";
    
    let weightLabel = new Label();
    weightLabel.margin = 2;
    weightLabel.textAlignment = TextAlign_VertCenter;
    weightLabel.text = "Weight:";
    let weightTextLabel = new Label();
    weightTextLabel.margin = 2;
    weightTextLabel.textAlignment = TextAlign_VertCenter;
    weightTextLabel.frameStyle = FrameStyle_Sunken;
    weightTextLabel.text = " ";
    
    let timeLabel = new Label();
    timeLabel.margin = 2;
    timeLabel.textAlignment = TextAlign_VertCenter;
    timeLabel.text = "Time:";
    let timeTextLabel = new Label();
    timeTextLabel.margin = 2;
    timeTextLabel.textAlignment = TextAlign_VertCenter;
    timeTextLabel.frameStyle = FrameStyle_Sunken;
    timeTextLabel.text = " ";
    
    let tgtStarsSizer = new HorizontalSizer();
    tgtStarsSizer.spacing = 2;
    tgtStarsSizer.add(tgtStarsLabel);
    tgtStarsSizer.add(tgtStarsTextLabel);
    tgtStarsSizer.addSpacing(10);
    tgtStarsSizer.add(scaleLabel);
    tgtStarsSizer.add(scaleTextLabel);
    tgtStarsSizer.addSpacing(10);
    tgtStarsSizer.add(snrLabel);
    tgtStarsSizer.add(snrTextLabel);
    tgtStarsSizer.addSpacing(10);
    tgtStarsSizer.add(weightLabel);
    tgtStarsSizer.add(weightTextLabel);
    tgtStarsSizer.addSpacing(20);
    tgtStarsSizer.addStretch();
    tgtStarsSizer.add(timeLabel);
    tgtStarsSizer.add(timeTextLabel);
    
    let tgtGroupBox = new GroupBox(this);
    tgtGroupBox.title = "Target image";
    tgtGroupBox.sizer = new VerticalSizer();
    tgtGroupBox.sizer.margin = 4;
    tgtGroupBox.sizer.spacing = 4;
    tgtGroupBox.sizer.add(tgtTextLabel);
    tgtGroupBox.sizer.add(tgtStarsSizer);
    
    let progressTextLabel = new Label();
    progressTextLabel.margin = 2;
    progressTextLabel.frameStyle = FrameStyle_Sunken;
    progressTextLabel.textAlignment = TextAlign_VertCenter;
    progressTextLabel.text = "0 / " + nImages;
    
    let timeRemainLabel = new Label();
    timeRemainLabel.margin = 2;
    timeRemainLabel.textAlignment = TextAlign_VertCenter;
    timeRemainLabel.text = "Time remaining:";
    let timeRemainTextLabel = new Label();
    timeRemainTextLabel.margin = 2;
    timeRemainTextLabel.frameStyle = FrameStyle_Sunken;
    timeRemainTextLabel.textAlignment = TextAlign_VertCenter;
    timeRemainTextLabel.text = " ";
    
    let progressSlider = new Slider();
    progressSlider.enabled = false;
    progressSlider.minValue = 0;
    progressSlider.maxValue = nImages;
    progressSlider.value = 0;
    
    let progressGroupBox = new GroupBox(this);
    progressGroupBox.title = "Progress";
    progressGroupBox.sizer = new HorizontalSizer();
    progressGroupBox.sizer.margin = 4;
    progressGroupBox.sizer.spacing = 2;
    progressGroupBox.sizer.add(progressTextLabel);
    progressGroupBox.sizer.addSpacing(10);
    progressGroupBox.sizer.add(progressSlider, 100);
    progressGroupBox.sizer.addSpacing(10);
    progressGroupBox.sizer.add(timeRemainLabel);
    progressGroupBox.sizer.add(timeRemainTextLabel);
    
    let elapsedTimeLabel = new Label();
    elapsedTimeLabel.margin = 2;
    elapsedTimeLabel.textAlignment = TextAlign_VertCenter;
    elapsedTimeLabel.text = "Elapsed time:";
    let elapsedTimeTextLabel = new Label();
    elapsedTimeTextLabel.margin = 2;
    elapsedTimeTextLabel.textAlignment = TextAlign_VertCenter;
    elapsedTimeTextLabel.frameStyle = FrameStyle_Sunken;
    elapsedTimeTextLabel.text = " ";
    let statusLabel = new Label();
    statusLabel.margin = 2;
    statusLabel.textAlignment = TextAlign_VertCenter;
    statusLabel.frameStyle = FrameStyle_Sunken;
    statusLabel.text = " ";
    
    let abortButton = new PushButton(this);
    abortButton.defaultButton = true;
    abortButton.text = "Abort";
    abortButton.icon = this.scaledResource(":/icons/cancel.png");
    abortButton.onClick = function () {
        nsgStatus.setAborted();
        this.dialog.ok();
    };
    let buttons_Sizer = new HorizontalSizer;
    buttons_Sizer.add(elapsedTimeLabel);
    buttons_Sizer.add(elapsedTimeTextLabel);
    buttons_Sizer.addSpacing(5);
    buttons_Sizer.add(statusLabel, 100);
    buttons_Sizer.addSpacing(10);
    buttons_Sizer.add(abortButton);
    
    // Global sizer
    this.sizer = new VerticalSizer();
    this.sizer.margin = 10;
    this.sizer.spacing = 10;
    
    this.sizer.add(refGroupBox);
    this.sizer.add(tgtGroupBox);
    this.sizer.add(progressGroupBox);
    this.sizer.add(buttons_Sizer);

    this.windowTitle = title;
    this.adjustToContents();
    
    /**
     * Display the number of detected reference stars. Update reference name.
     * @param {NsgData} data
     * @throws {Error} File I/O errors
     */
    this.updateRefStars = function(data){
        refTextLabel.text = File.extractName(data.cache.getRefFilename());
        let refStars = data.cache.getRefStars(data.logStarDetection);
        refStarsTextLabel.text = "" + refStars.length;
    };
    
    /**
     * Display elapsed time
     * @param {String} status 
     */
    this.updateElapsedTime = function(status){
        elapsedTimeTextLabel.text = getElapsedTime(startTime);
        statusLabel.text = status ? status : " ";
        processEvents();
    };
    
    /**
     * @param {NsgData} data
     * @param {Number} nNormalized
     * @param {Result} result
     * @param {String} elapsedTime
     * @param {String | undefined} timeRemaining
     */
    this.updateTarget = function(data, nNormalized, result, elapsedTime, timeRemaining){
        tgtTextLabel.text = File.extractName(result.inputFile);
        let tgtStars = data.cache.getTgtStars(data, data.logStarDetection, false);
        tgtStarsTextLabel.text = "" + tgtStars.length;
        weightTextLabel.text = "" + (result.weight).toFixed(3);
        timeTextLabel.text = elapsedTime;
        progressTextLabel.text = "" + nNormalized + " / " + nImages;
        if (timeRemaining !== undefined){
            timeRemainTextLabel.text = timeRemaining;
        }
        if (result.isRef){
            nPhotStarsTextLabel.text = "Ref";
        } else if (result.nPhotometryStarPairs === undefined){
            nPhotStarsTextLabel.text = "---";
        } else {
            nPhotStarsTextLabel.text = "" + result.nPhotometryStarPairs;
        }
        progressSlider.value = nNormalized;
        
        let scaleStr = "";
        for (let c=0; c < result.scaleFactors.length; c++){
            if (c){
                scaleStr += ", ";
            }
            let scale = result.scaleFactors[c].m;
            if (scale){
                scaleStr += (1/scale).toFixed(3);
            }
        }
        scaleTextLabel.text = scaleStr;
        
        let snrStr = "";
        for (let c=0; c < result.snr.length; c++){
            if (c){
                snrStr += ", ";
            }
            let snr = result.snr[c];
            if (snr){
                snrStr += snr.toFixed(3);
            }
        }
        snrTextLabel.text = snrStr;
        
        self.updateElapsedTime();
    };
}

ProgressDialog.prototype = new Dialog;
