/* global MAX_SMOOTHNESS, TextAlign_Left, TextAlign_VertCenter */

// Version 1.0 (c) John Murphy 31st-Mar-2020
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
 * @param {NsgDialog} dialog
 * @param {type} values
 * @param {Number} strLength
 * @returns {NumericControl}
 */
function nsgCreateNumericControl(dialog, values, strLength){
    let control = new NumericControl(dialog);
    control.real = values.real;
    control.label.text = values.text;
    control.label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
    if (strLength > 0){
        control.label.minWidth = strLength;
    }
    control.toolTip = values.toolTip;
    control.setRange(values.range.min, values.range.max);
    control.slider.setRange(values.slider.range.min, values.slider.range.max);
    control.setPrecision(values.precision);
    let maxWidth = dialog.logicalPixelsToPhysical(values.maxWidth);
    control.maxWidth = Math.max(strLength + 50, maxWidth);
    return control;
}

/**
 * @param {NsgDialog} dialog
 * @param {type} values
 * @returns {NumericEdit}
 */
function nsgCreateNumericEdit(dialog, values){
    let control = new NumericEdit(dialog);
    control.real = values.real;
    control.label.text = values.text;
    control.toolTip = values.toolTip;
    control.setRange(values.range.min, values.range.max);
    control.setPrecision(values.precision);
    return control;
}

/**
 * Add onMouseRelease, onKeyRelease and onLeave listeners to ensure that the 
 * supplied updateFunction is called when the NumericControl edit has finished.
 * @param {NumericControl} control
 * @param {Function({Number} controlValue)} updateFunction
 */
function addFinalUpdateListener(control, updateFunction){
    let updateNeeded = false;
    function finalUpdate(){
        updateNeeded = false;
        updateFunction();
    }
    control.slider.onMouseRelease = function (x, y, button, bState, modifiers) {
        processEvents();
        finalUpdate();
    };
    control.onKeyRelease = function (keyCode, modifiers) {
        updateNeeded = true;
    };
    control.onLeave = function () {
        processEvents();
        if (updateNeeded){
            finalUpdate();
        }
    };
    control.slider.onMouseWheel = function (x, y, delta, buttonState, modifiers){
        updateNeeded = true;
    };
}

function NsgStarDetectionControls(){
    /**
     * @param {NsgDialog} dialog
     * @param {Number} value initialise the control with this value.
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    function createLogStarDetection_Control(dialog, value, strLength){
        let logStarDetection_Control = new NumericControl(dialog);
        logStarDetection_Control.real = true;
        logStarDetection_Control.label.text = "Star detection:";
        if (strLength > 0){
            logStarDetection_Control.label.minWidth = strLength;
            let maxWidth = dialog.logicalPixelsToPhysical(700);
            logStarDetection_Control.maxWidth = Math.max(strLength + 100, maxWidth);
        }
        logStarDetection_Control.toolTip = "<p>Logarithm of the star detection " +
                "sensitivity. Increase this value to detect less stars.</p>";
        logStarDetection_Control.setPrecision(1);
        logStarDetection_Control.setRange(-3, 2);
        logStarDetection_Control.slider.setRange(0, 50);
        logStarDetection_Control.setValue(value);
        return logStarDetection_Control;
    }
    
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createRefLogStarDetect_Control = function(dialog, data, strLength){
        let control = createLogStarDetection_Control(dialog, data.logStarDetection, strLength);
        control.onValueUpdated = function (value) {
            data.logStarDetection = value;
        };
        return control;
    };
}

function NsgPhotometryControls(){
    let self = this;
    
    this.linearRange = {
        real: true,
        text: "Star peak value:",
        slider: {range: {min:0, max:500}},
        range: {min:0.001, max:1.0},
        precision: 3,
        maxWidth: 1000,
        toolTip: "<p>Restricts the stars used for photometry to those " +
            "that have a peak pixel value less than the specified value.</p>" +
            "<p>Use this to reject stars that are outside the " +
            "camera's linear response range.</p>" +
            "<p>The default value is set to 0.7 x the highest value in the reference image. " +
            "If the image does not contain any saturated stars, this may be an " +
            "underestimate.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createLinearRangeRefControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.linearRange, strLength);
        control.setValue(data.linearRangeRef, self.linearRange);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createLinearRangeRefEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.linearRange);
        control.setValue(data.linearRangeRef);
        control.toolTip = self.linearRange.toolTip + 
                "<p>Use the 'Photometry Graph' dialog to edit and view the 'Linear range'.</p>";
        return control;
    };
    
    this.outlierRemoval = {
        real: true,
        text: "Remove %:",
        slider: {range: {min:0, max:200}},
        range: {min:0, max:20},
        precision: 2,
        maxWidth: 1000,
        toolTip: "<p>Percentage of outlier stars to remove.</p>" +
            "<p>Outliers can be due to variable stars, or measurement errors.</p>" +
            "<p>Removing a few outliers can improve accuracy, but don't over do it.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createOutlierRemovalControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.outlierRemoval, strLength);
        control.setValue(data.outlierRemovalPercent);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createOutlierRemovalEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.outlierRemoval);
        control.setValue(data.outlierRemovalPercent);
        control.toolTip = self.outlierRemoval.toolTip + 
                "<p>Use the 'Photometry Graph' dialog to edit and view the outliers.</p>";
        return control;
    };
    
    this.growthRate = {
        real: true,
        text: "Growth rate:",
        slider: {range: {min:0, max:100}},
        range: {min:0, max:1},
        precision: 2,
        maxWidth: 1000,
        toolTip: "<p>Determines the aperture size for bright stars.</p>" +
            "<p>Adjust this control until the brightest stars entirely fit " +
            "within the inner photometry aperture.</p>" +
            "<p>It is not necessary to include diffraction spikes, " +
            "filter halos or scattered light.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureGrowthRateControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.growthRate, strLength);
        control.setValue(data.apertureGrowthRate);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createApertureGrowthRateEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.growthRate);
        control.setValue(data.apertureGrowthRate);
        control.toolTip = self.growthRate.toolTip + 
                "<p>Use the 'Photometry Stars' dialog to edit and view the 'Growth rate'.</p>";
        return control;
    };
    
    this.apertureAdd = {
        real: false,
        text: "Radius add:",
        slider: {range: {min:0, max:10}},
        range: {min:0, max:10},
        precision: 0,
        maxWidth: 500,
        toolTip: "<p>This value is added to the aperture radius for all stars.</p>" +
            "<p>Use this control to set the photometry aperture for <b>faint stars</b> " +
            "(use 'Growth rate' for brighter stars).</p>" +
            "<p>When correctly set, each faint reference and target star should " +
            "be fully contained within the inner photometry aperture.</p>" +
            "<p>Smaller apertures will introduce less noise, but it is vital that " +
            "the whole star is within the aperture.</p>" +
            "<p>The default value of 1 usually works well.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureAddControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.apertureAdd, strLength);
        control.setValue(data.apertureAdd);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createApertureAddEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.apertureAdd);
        control.setValue(data.apertureAdd);
        control.toolTip = self.apertureAdd.toolTip + 
                "<p>Use the 'Photometry Stars' dialog to edit and view the 'Radius add'.</p>";
        return control;
    };
    
    this.apertureGap = {
        real: false,
        text: "Aperture gap:",
        slider: {range: {min:0, max:50}},
        range: {min:0, max:50},
        precision: 0,
        maxWidth: 500,
        toolTip: "<p>Gap between star aperture and background aperture.</p>" +
            "<p>Use this gap to ensure the star's light does not contaminate " +
            "the background measurement.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureGapControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.apertureGap, strLength);
        control.setValue(data.apertureGap);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createApertureGapEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.apertureGap);
        control.setValue(data.apertureGap);
        control.toolTip = self.apertureGap.toolTip + 
            "<p>Use the 'Photometry Stars' dialog to edit and view the 'Aperture gap'.</p>";
        return control;
    };
    
    this.apertureBgDelta = {
        real: false,
        text: "Background delta:",
        slider: {range: {min:1, max:50}},
        range: {min:1, max:50},
        precision: 0,
        maxWidth: 500,
        toolTip: "<p>Background annulus thickness.</p>" +
            "<p>This determines the square ring around the star, used to " +
            "measure the background sky flux.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createApertureBgDeltaControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.apertureBgDelta, strLength);
        control.setValue(data.apertureBgDelta);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createApertureBgDeltaEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.apertureBgDelta);
        control.setValue(data.apertureBgDelta);
        control.toolTip = self.apertureBgDelta.toolTip + 
                "<p>Use the 'Photometry Stars' dialog to edit and view the 'Background delta'.</p>";
        return control;
    };
    
}

//-------------------------------------------------------
// Sample Grid Controls
//-------------------------------------------------------
function NsgSampleControls(){
    let self = this;
    
    this.percentLimits = {
        real: true,
        text: "Number of stars %:",
        slider: {range: {min:0, max:500}},
        range: {min:0, max:100},
        precision: 3,
        maxWidth: 1000,
        toolTip: "<p>Specifies the percentage of the brightest detected stars that will be used to reject samples.</p>" +
            "<p>0% implies that no samples are rejected due to stars.<br />" +
            "100% implies that all detected stars are used to reject samples.</p>" +
            "<p>Samples that contain bright stars are rejected for two reasons: </p>" +
            "<ul><li>Bright pixels are more affected by any errors in the calculated scale.</li>" +
            "<li>Bright stars can have significantly different profiles between " +
            "the reference and target images. These variations are too rapid for " +
            "the surface spline to follow and can reduce the accuracy of the resulting model.</li></ul>" +
            "<p>However, it is more important to include enough samples than to reject faint stars.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createLimitSampleStarsPercentControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.percentLimits, strLength);
        control.setValue(data.limitSampleStarsPercent);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createLimitSampleStarsPercentEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.percentLimits);
        control.setValue(data.limitSampleStarsPercent);
        control.toolTip = self.percentLimits.toolTip + 
                "<p>Use the 'Sample Generation' dialog to edit and view the percentage of stars used.</p>";
        return control;
    };

    this.growthRate = {
        real: true,
        text: "Star circle growth rate:",
        slider: {range: {min:0, max:300}},
        range: {min:0, max:3},
        precision: 2,
        maxWidth: 1000,
        toolTip: "<p>Samples within the circles are rejected. The remaining samples are used to create the " +
            "relative gradient model for the target image.</p>" +
            "<p>The gradient correction needs to ignore local " +
            "gradients. For example, due to scattered light around bright stars. " +
            "Hence the aim is to reject all samples that contain any light from bright stars. " +
            "This includes diffraction spikes, filter halos, and the star's scattered light.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleStarGrowthRateControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.growthRate, strLength);
        control.setValue(data.sampleStarGrowthRate);
        control.toolTip = self.growthRate.toolTip + 
                "<p>Unselect 'Auto' checkbox " +
                "to edit and view the effects of this control.</p>";
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createSampleStarGrowthRateEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.growthRate);
        control.setValue(data.sampleStarGrowthRate);
        control.toolTip = self.growthRate.toolTip + 
                "<p>Use the 'Sample Generation' dialog to edit and view the growth rate.</p>";
        return control;
    };
    
    this.sampleSize = {
        real: false,
        text: "Sample size:",
        slider: {range: {min:2, max:150}},
        range: {min:2, max:150},
        precision: 0,
        maxWidth: 1000,
        toolTip: "<p>Samples are used to create a surface spline that models the relative gradient.</p>" +
            "<p>Their size determines the total number of samples. " +
            "See the <b>'Samples:'</b> numeric field's tooltip for the optimum number of samples.</p>" +
            "<p>The sample size should be at least 2x the size of the largest " +
            "star that doesn't have a rejection circle.</p>" +
            "<p>Samples are rejected if they contain too many black pixels, " +
            "or if they are within a star's rejection radius.</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createSampleSizeControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.sampleSize, strLength);
        control.setValue(data.sampleSize);
        control.toolTip = self.sampleSize.toolTip + 
                "<p>Unselect the 'Auto' checkbox " +
                "to edit and view the effects of this control.</p>";
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createSampleSizeEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.sampleSize);
        control.setValue(data.sampleSize);
        control.toolTip = self.sampleSize.toolTip + 
                "<p>Use the 'Sample Generation' dialog to edit and view the effects of the sample size.</p>";
        return control;
    };
}

//-------------------------------------------------------
// Gradient Controls
//-------------------------------------------------------
function NsgGradientControls(){
    let self = this;
    
    this.gradientSmoothness = {
        real: true,
        text: "Gradient smoothness:",
        slider: {range: {min:0, max:80}},
        range: {min:-4, max:MAX_SMOOTHNESS},
        precision: 1,
        maxWidth: 800,
        toolTip: "<p>A surface spline is created to model the gradient correction that " +
            "will be applied to the target image.</p>" +
            "<p>Apply sufficient smoothing to avoid following the noise.</p>" +
            "<p>This control specifies the logarithm of the smoothness. " +
            "Larger values apply more smoothing.</p>"
    };
    
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createGradientSmoothnessControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.gradientSmoothness, strLength);
        control.setValue(data.gradientSmoothness);
        return control;
    };
    
}

function NsgRejectionControls(){
    let self = this;
    
    this.percentWeight = {
        real: true,
        text: "Minimum weight:",
        slider: {range: {min:0, max:900}},
        range: {min:0, max:0.9},
        precision: 3,
        maxWidth: 1000,
        toolTip: "<p>Minimum weight.</p>" +
            "<p>The displayed weight is adjusted for exposure time to " +
            "ensure that we reject images that were badly affected by light pollution, " +
            "and keep good images that had lower exposure times.</p>" +
            "<p>The recommended setting is between 0.25 and 0.50</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createMinimumWeightControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.percentWeight, strLength);
        control.setValue(data.minimumWeight);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createMinimumWeightEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.percentWeight);
        control.setValue(data.minimumWeight);
        control.toolTip = self.percentWeight.toolTip + 
                "<p>Use the 'Transmission, Weight' Graph dialog to set the minimum criteria.</p>";
        return control;
    };
    
    this.percentScale = {
        real: true,
        text: "Minimum transmission:",
        slider: {range: {min:0, max:950}},
        range: {min:0, max:0.95},
        precision: 3,
        maxWidth: 1000,
        toolTip: "<p>Minimum transmission.</p>" +
            "This is used to reject images that were affected by clouds or low visibility. " +
            "A signal loss of 10% (transmission 0.90) due to humidity or thin cloud is " +
            "unlikely to be a problem, but a loss of 25% (0.75) starts to be significant, " +
            "especially if the cloud is uneven.</p>" +
            "<p>The recommended setting is between 0.75 and 0.90</p>"
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @param {Number} strLength
     * @returns {NumericControl}
     */
    this.createMinimumScaleControl = function(dialog, data, strLength){
        let control = nsgCreateNumericControl(dialog, self.percentScale, strLength);
        control.setValue(data.minimumScale);
        return control;
    };
    /**
     * @param {NsgDialog} dialog
     * @param {NsgData} data
     * @returns {NumericEdit}
     */
    this.createMinimumScaleEdit = function(dialog, data){
        let control = nsgCreateNumericEdit(dialog, self.percentScale);
        control.setValue(data.minimumScale);
        control.toolTip = self.percentScale.toolTip + 
                "<p>Use the 'Transmission, Weight' Graph dialog to set the minimum criteria.</p>";
        return control;
    };
}