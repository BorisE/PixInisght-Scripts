/* global Parameters, View, APERTURE_GROWTH, APERTURE_ADD, APERTURE_GAP, APERTURE_BKG_DELTA, APERTURE_GROWTH_REJECTION, APERTURE_GROWTH_TARGET, LINEAR_RANGE, File, DataType_Boolean, Settings, KEYPREFIX, DataType_Float, DataType_String, DataType_Int32, DataType_UCString, DEFAULT_PIXEL_SIZE, DEFAULT_FOCAL_LENGTH, NSGXnml, ReadTextOptions_TrimLines, ReadTextOptions_RemoveEmptyLines, StdIcon_Error, StdButton_Ok, TITLE, FileInfo, DEFAULT_MIN_WEIGHT, DEFAULT_MIN_SCALE, DEFAULT_GRADIENT_SMOOTHNESS, DEFAULT_STAR_DETECTION, DEFAULT_STAR_FLUX_TOLERANCE, DEFAULT_STAR_SEARCH_RADIUS, DEFAULT_OUTPUT_DIR, StdIcon_Warning, StdButton_Yes, StdButton_No, targetTableEntriesMap */

// Version 1.0 (c) John Murphy 5th-Apr-2021
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

/**
 * If not in targetTableEntriesMap, read the FITS header and store in HeaderEntries map,
 * then create new TargetTableEntries and store in the map.
 * @param {String} fitsFilePath Full filename of image.
 * @throws {Error} If file cannot be read.
 * @returns {TargetTableEntries}
 */
function getTargetTableEntries( fitsFilePath ){
    if (targetTableEntriesMap.has(fitsFilePath)){
        return targetTableEntriesMap.get(fitsFilePath);
    }
    let headerEntries = getHeaderEntries( fitsFilePath );
    let noiseData = headerEntries.calcAirmassScaledNoise();
    let displayNoise = undefined;
    let noiseType = undefined;
    if (noiseData && noiseData.displayNoise){
        noiseType = noiseData.type ? noiseData.type : "";
        displayNoise = noiseData.displayNoise;
    }
    let tableEntries = new TargetTableEntries(fitsFilePath, undefined, displayNoise, noiseType,
            headerEntries.ALTITUDE, headerEntries.AIRMASS, headerEntries.EXPOSURE,
            headerEntries.DATE_OBS, headerEntries.getFilter());
    // Modify date initialized here, so it is always valid
    targetTableEntriesMap.set(fitsFilePath, tableEntries);
    return tableEntries;
}

/**
 * Decodes the TargetTableEntries string, 
 * creates a new TargetTableEntries and adds it to the map (if it is valid).
 * It is valid if the file exists and its modify date matches the decoded value.
 * @param {String} str String to decode
 * @returns {String} filename (full path)
 */
function setTargetTableEntries( str ){
    let tableEntries = targetTableEntriesDecode(str);
    let filename = tableEntries.getFilename();
    if (tableEntries.isValid()){
        targetTableEntriesMap.set(filename, tableEntries);
    }
    return filename;
}

/**
 * Constructor.
 * Specify undefined for fileModifyDate if the FitsHeader has just been read for the first time.
 * Use a negative value for fileModifyDate to force isValid to false which will force the FitsHeader to be read.
 * @param {String} filename
 * @param {Number|undefined} fileModifyDate
 * @param {Number|undefined} displayNoise
 * @param {String|undefined} noiseType
 * @param {Number|undefined} alt
 * @param {Number|undefined} airmass
 * @param {Number|undefined} exposure
 * @param {String|undefined} dateObs
 * @param {String|undefined} filter
 * @returns {TargetTableEntries}
 */
function TargetTableEntries(filename, fileModifyDate, displayNoise, noiseType, 
        alt, airmass, exposure, dateObs, filter){

    let isValid = false;
    let modifyDate = 0; // Zero if file did not exist, otherwise set to actual file modify date.
    if (filename && File.exists(filename)){
        modifyDate = new FileInfo(filename).lastModified.getTime();
        if (fileModifyDate){
            // The data was read from Settings or ProcessIcon. Check if file was modified since.
            isValid = modifyDate === fileModifyDate;
        } else {
            isValid = true;
        }
    }

    this.isValid = function(){return isValid;};
    this.getFileModifyDate = function(){return modifyDate;};
    this.getFilename = function(){return filename;};
    this.getDisplayNoise = function(){return displayNoise;};
    this.getNoiseType = function(){return noiseType;};
    this.getAlt = function(){return alt;};
    this.getAirmass = function(){return airmass;};
    this.getExposure = function(){return exposure;};
    this.getDateObs = function(){return dateObs;};
    this.getFilter = function(){return filter ? filter : "";};

    /**
     * Encode a TargetTableEntries as a string using '¬' as the separator.
     * @returns {String} Encoded string.
     */
    this.encode = function() {
        let str = filename + '¬' + modifyDate + '¬';
        if (displayNoise) str += displayNoise;
        str += '¬';
        if (noiseType) str += noiseType;
        str += '¬';
        if (alt) str += alt;
        str += '¬';
        if (airmass) str += airmass;
        str += '¬';
        if (exposure) str += exposure;
        str += '¬';
        if (dateObs) str += dateObs;
        str += '¬';
        if (filter) str += filter;
        str += '¬';
        return str;
    };
}

/**
 * Decode a TargetTableEntries string. If only a single value, the filename will be set but 
 * the modify date will be set to -1 to force the FITS header to be read later on.
 * @param {String} str (¬ separator character).
 * @returns {TargetTableEntries}
 */
function targetTableEntriesDecode (str) {
    function getField(field){
        return field ? field : undefined;
    }
    function getNumber(field){
        return field ? Number(field) : undefined;
    }
    let fields = str.split('¬');
    if (fields.length === 1){
        // When the history is saved to a file, '¬' is converted to '\uFFFD' (black rhombus with a white question mark))
        fields = str.split('\uFFFD');
    }
    let filename = fields[0];
    if (fields.length > 1){
        let fileModifyDate = getNumber(fields[1]);
        let displayNoise = getNumber(fields[2]);
        let noiseType = getField(fields[3]);
        let alt = getNumber(fields[4]);
        let airmass = getNumber(fields[5]);
        let exposure = getNumber(fields[6]);
        let dateObs = getField(fields[7]);
        let filter = getField(fields[8]);

        return new TargetTableEntries(filename, fileModifyDate, displayNoise, noiseType, 
            alt, airmass, exposure, dateObs, filter);
    }
    return new TargetTableEntries(filename, -1); // Cached hdr values don't exist
}

function NsgData(){
    /**
     * Creates a '¬' separated string filename¬modifyDate
     * @param {String} filename
     * @returns {String} filename¬modifyDate
     */
    function encodeResultFilename(filename){
        let modifyDate = 0; // Zero if file did not exist, otherwise set to actual file modify date.
        if (filename && File.exists(filename)){
            modifyDate = new FileInfo(filename).lastModified.getTime();
        }
        return filename + '¬' + modifyDate;
    }
    /**
     * @param {String} encodedString filename¬modifyDate
     * @param {Boolean} isResultsFileBg If true, dont check if file exists or its modify date. 
     * @returns {String | undefined} filename
     */
    function decodeResultFilename(encodedString, isResultsFileBg){
        if (encodedString){
            let fields = encodedString.split('¬');
            let filename = fields[0];
            if (filename && fields.length > 1){
                if (isResultsFileBg){
                    // This case is for the resultsFileBg file.
                    // Initially data.resultsFileBg stores a dated filename, but no file. Modify date of zero.
                    // The data.resultsFileBg setting is only written to saved process icons.
                    // When NSG is run in BG (isTargetView), resultsFileBg filename is used to create Results file.
                    // When run in FG from process icon, if resultsFileBg file exists it's used as the results file.
                    return filename;
                } else if (File.exists(filename)) {
                    // This case is for the resultsFile
                    return filename;
//                    Don't check modify date; Modify date is written before result entries...
//                    let fileModifyDate = fields[1] ? Number(fields[1]) : undefined;
//                    if (new FileInfo(filename).lastModified.getTime() === fileModifyDate){
//                        return filename;
//                    }
                }
            }
        }
        return undefined;
    }
    
    let nsgDialog;
    let self = this;
    
    /**
     * If not running in ViewTarget mode, supply the dialog so that it can be
     * updated when the data changes. 
     * @param {NsgDialog} dialog
     */
    this.setNsgDialog = function(dialog){
        nsgDialog = dialog;
    };
    
    /**
     * If auto photometry, calc and set aperture gap
     */
    function setApertureGapAutoValue(){
        if (self.useAutoPhotometry && self.cache.getRefFilename()){
            let gap = calcDefaultApertureGap(self);
            let apertureGapControls = new NsgPhotometryControls();
            let upperBound = apertureGapControls.apertureGap.range.max;
            self.apertureGap = Math.min(gap, upperBound);
            if (nsgDialog){
                nsgDialog.apertureGap_Control.setValue(self.apertureGap);
            }
        } 
    }
    
    /**
     * If auto photometry, calc and set aperture bg delta
     */
    function setApertureBgDeltaAutoValue(){
        if (self.useAutoPhotometry && self.cache.getRefFilename()){
            let bgDelta = calcDefaultApertureBgDelta(self);
            let apertureBgDeltaControls = new NsgPhotometryControls();
            let upperBound = apertureBgDeltaControls.apertureBgDelta.range.max;
            self.apertureBgDelta = Math.min(bgDelta, upperBound);
            if (nsgDialog){
                nsgDialog.apertureBgDelta_Control.setValue(self.apertureBgDelta);
            }
        } 
    }
    
    /**
     * If auto photometry, calc and set max linear value
     */
    function setLinearRangeAutoValue(){
        if (self.useAutoPhotometry && self.cache.getRefFilename()){
            self.linearRangeRef = self.cache.getLinearRangeRef();
            if (nsgDialog){
                nsgDialog.linearRangeRef_Control.setValue(self.linearRangeRef);
            }
        } 
    }
    
    /**
     * If auto photometry, set aperture add to APERTURE_ADD
     */
    function setApertureAddAutoValue(){
        if (self.useAutoPhotometry){
            self.apertureAdd = APERTURE_ADD;
            if (nsgDialog){
                nsgDialog.apertureAdd_Control.setValue(self.apertureAdd);
            }
        } 
    }
    
    /**
     * If auto photometry, calc and set aperture growth rate
     */
    function setApertureGrowthRateAutoValue(){
        if (self.useAutoPhotometry && self.cache.getRefFilename()){
            let maxStarFlux = self.cache.getMaxStarFlux(self.logStarDetection);
            let limit = Math.round(calcDefaultGrowthLimit(self));
            limit = Math.max(limit, 2);
            self.apertureGrowthRate = calcStarGrowthRate(maxStarFlux, APERTURE_GROWTH, limit);
            if (nsgDialog){
                nsgDialog.apertureGrowthRate_Control.setValue(self.apertureGrowthRate);
            }
        } 
    }
    
    /**
     * If auto photometry, set outliers to 2% of matched stars, but don't exceed outlier control's range.
     */
    function setOutlierRemovalAutoValue(){
        if (self.useAutoPhotometry){
            self.outlierRemovalPercent = 2;
            if (nsgDialog){
                nsgDialog.outlierRemoval_Control.setValue(self.outlierRemovalPercent);
            }
        }
    }
    
    /**
     * @param {Boolean} checked Set to true if 'Auto' photometry values is selected
     * @param {Boolean} updateAll Force stars to be detected if they are not already cached.
     */
    this.setPhotometryAutoValues = function (checked, updateAll){
        this.useAutoPhotometry = checked;
        if (nsgDialog){
            nsgDialog.autoPhotometryCheckBox.checked = checked;
            nsgDialog.apertureAdd_Control.enabled = !checked;
            nsgDialog.apertureGrowthRate_Control.enabled = !checked;
            nsgDialog.apertureGap_Control.enabled = !checked;
            nsgDialog.apertureBgDelta_Control.enabled = !checked;
            nsgDialog.outlierRemoval_Control.enabled = !checked;
            nsgDialog.linearRangeRef_Control.enabled = !checked;
        }
        if (checked){
            setApertureAddAutoValue();
            setApertureGapAutoValue();
            setApertureBgDeltaAutoValue();
            setOutlierRemovalAutoValue();
            if (updateAll || this.cache.hasCachedRefStars(this.logStarDetection)){
                setApertureGrowthRateAutoValue();
                setLinearRangeAutoValue();
            }
        }
    };
    
    /**
     * @param {Boolean} checked If true disable controls and set them to calculated / default values
     * @param {Boolean} updateAll Force stars to be detected if they are not already cached.
     */
    this.setSampleGenerationAutoValues = function (checked, updateAll){
        this.useAutoSampleGeneration = checked;
        if (nsgDialog){
            nsgDialog.autoSampleGenerationCheckBox.checked = this.useAutoSampleGeneration;
            nsgDialog.sampleStarGrowthRate_Control.enabled = !checked;
            nsgDialog.limitSampleStarsPercent_Control.enabled = !checked;
            nsgDialog.sampleSize_Control.enabled = !checked;
        }
        if (checked){
            if (updateAll || this.cache.hasCachedRefStars(this.logStarDetection)){
                setSampleSizeAutoValue();
                setLimitSampleStarsPercentAutoValue();
                setSampleStarGrowthRateAutoValue();
            }
        }
    };
    
    /**
     * If auto sample generation, set sample size based on image scale
     */
    function setSampleSizeAutoValue(){
        if (self.useAutoSampleGeneration && self.cache.getRefFilename()){
            let sampleControls = new NsgSampleControls();
            let lowerBound = sampleControls.sampleSize.range.min;
            let upperBound = sampleControls.sampleSize.range.max;
            let pixelAngle = calcDegreesPerPixel(self.pixelSize, self.focalLength);
            // Make sure we sample at least 100 x 100 microns on the sensor
            let minSampleSize = Math.round(100 / self.pixelSize);
            minSampleSize = Math.max(minSampleSize, lowerBound);
            // 0.005 deg = 18 arcsec (18 >> than than 4 arcsecond seeing)
            minSampleSize = Math.max(minSampleSize, Math.round(0.0075 / pixelAngle));
            // Try to have 2000 samples
            let image = self.cache.getRefImage();
            let w = image.width;
            let h = image.height;
            let size = Math.floor(Math.sqrt(w * h / 2000));
            size = Math.max(minSampleSize, size);
            size = Math.min(size, upperBound);
            self.sampleSize = size;
            if (nsgDialog){
                nsgDialog.sampleSize_Control.setValue(self.sampleSize);
            }
        } 
    }
    
    /**
     * If auto sample generation, limit 'grid rejection stars' to 10% of sample bins
     */
    function setLimitSampleStarsPercentAutoValue(){
        if (self.useAutoSampleGeneration && self.cache.getRefFilename()){
            let starCount = self.cache.getRefStars(self.logStarDetection).length;
            let binCount = self.cache.getSampleGridBinCount(self);
            let nStars = binCount / 10;
            self.limitSampleStarsPercent = Math.min(100, Math.round(10000 * nStars / starCount) / 100);
            if (nsgDialog){
                nsgDialog.limitSampleStarsPercent_Control.setValue(self.limitSampleStarsPercent);
            }
        }
    }
    
    /**
     * If auto sample generation, calculate star rejection circle growth rate.
     * This needs the ref stars to be detected (or cached) to determing max star flux.
     */
    function setSampleStarGrowthRateAutoValue(){
        if (self.useAutoSampleGeneration && self.cache.getRefFilename()){
            let maxStarFlux = self.cache.getMaxStarFlux(self.logStarDetection);
            let limit = Math.round(calcDefaultTargetGrowthLimit(self));
            limit = Math.max(limit, 2);
            self.sampleStarGrowthRate = calcStarGrowthRate(maxStarFlux, APERTURE_GROWTH_REJECTION, limit);
            if (nsgDialog){
                nsgDialog.sampleStarGrowthRate_Control.setValue(self.sampleStarGrowthRate);
            }
        }
    }
    
    /**
     * Used for process history and to populate the contents of a process icon.
     */
    this.saveParameters = function () {
        Parameters.clear();

        let referenceFile = this.cache.getRefFilename();
        if (referenceFile){
            Parameters.set("referenceFile", referenceFile);
        }
        
        if (this.targetFiles.length){
            for (let i=0; i < this.targetFiles.length; i++){
                let tableEntries = getTargetTableEntries(this.targetFiles[i]);
                Parameters.set("file" + i, tableEntries.encode());
            }
        }
        if (nsgDialog){
            let selectedTarget = nsgDialog.getSelectedTargetFilename(false);
            if (selectedTarget){
                Parameters.set("selectedTarget", selectedTarget);
            }
        }
        Parameters.set("pixelSize", this.pixelSize);
        Parameters.set("focalLength", this.focalLength);
        Parameters.set("limitingNumberToBlink", this.limitingNumberToBlink);
        Parameters.set("limitBlinkNumber", this.limitBlinkNumber);
        if (this.outputDir)
            Parameters.set("outputDir", this.outputDir);
        if (this.resultsFile)
            Parameters.set("resultsFile", encodeResultFilename(this.resultsFile));
        if (this.resultsFileBg)
            Parameters.set("resultsFileBg", encodeResultFilename(this.resultsFileBg));
        Parameters.set("outputPostFix", this.outputPostFix);
        Parameters.set("useFullPath", this.useFullPath);
        Parameters.set("overwrite", this.overwrite);
        Parameters.set("deleteTmpFiles", this.deleteTmpFiles);
        Parameters.set("displayGradient", this.displayGradient);
        if (this.isNSGXnmlInstalled){
            Parameters.set("createXnml", this.createXnml);
            Parameters.set("writeNormalized", this.writeNormalized);
            Parameters.set("addDrizzleFiles", this.addDrizzleFiles);
            Parameters.set("csvFile", this.csvFile);
            Parameters.set("weightPrefix", this.weightPrefix);
        }
        Parameters.set("noiseWeightKeyword", this.noiseWeightKeyword);
        Parameters.set("onErrorIndex", this.onErrorIndex);

        // Star Detection
        Parameters.set("logStarDetection", this.logStarDetection);
        
        // Photometric Star Search
        Parameters.set("starFluxTolerance", this.starFluxTolerance);
        Parameters.set("starSearchRadius", this.starSearchRadius);
        
        // Photometric Scale
        Parameters.set("apertureGrowthRate", this.apertureGrowthRate);
        Parameters.set("apertureAdd", this.apertureAdd);
        Parameters.set("apertureGap", this.apertureGap);
        Parameters.set("apertureBgDelta", this.apertureBgDelta);
        if (this.isNSGXnmlInstalled){
            Parameters.set("usePhotometryROI", this.usePhotometryROI);
            Parameters.set("photometryROIx", this.photometryROIx);
            Parameters.set("photometryROIy", this.photometryROIy);
            Parameters.set("photometryROIw", this.photometryROIw);
            Parameters.set("photometryROIh", this.photometryROIh);
        }
        Parameters.set("linearRangeRef", this.linearRangeRef);
        Parameters.set("outlierRemovalPercent", this.outlierRemovalPercent);
        Parameters.set("useAutoPhotometry", this.useAutoPhotometry);
        
        // Gradient Sample Generation
        Parameters.set("sampleStarGrowthRate", this.sampleStarGrowthRate);
        Parameters.set("limitSampleStarsPercent", this.limitSampleStarsPercent);
        Parameters.set("sampleSize", this.sampleSize);
        Parameters.set("maxSamples", this.maxSamples);
        Parameters.set("useAutoSampleGeneration", this.useAutoSampleGeneration);
        for (let i=0; i<this.manualRejectionCircles.length; i++){
            let mrc = this.manualRejectionCircles[i];
            Parameters.set("manualRejectionCircle" + i + "_x", mrc.x);
            Parameters.set("manualRejectionCircle" + i + "_y", mrc.y);
            Parameters.set("manualRejectionCircle" + i + "_radius", mrc.radius);
        }
        
        // Gradient Correction
        Parameters.set("gradientSmoothness", this.gradientSmoothness);
        Parameters.set("gradientLineX", this.gradientLineX);
        Parameters.set("gradientLineY", this.gradientLineY);
        Parameters.set("isGradientLineHorizontal", this.isGradientLineHorizontal);
        
        // Image rejection
        if (this.isNSGXnmlInstalled){
            Parameters.set("useImageRejection", this.useImageRejection); 
            Parameters.set("minimumWeight", this.minimumWeight);
            Parameters.set("minimumScale", this.minimumScale);
        }
        
        // ImageIntegration
        Parameters.set("useImageIntegration", this.useImageIntegration);
        Parameters.set("autoRejectAlgorithm", this.autoRejectAlgorithm);
        if (this.isNSGXnmlInstalled){
            Parameters.set("sortByWeight", this.sortByWeight);
        }
        Parameters.set("imageIntegrationTemplateId", this.imageIntegrationTemplateId);
        Parameters.set("drizzleIntegrationTemplateId", this.drizzleIntegrationTemplateId);
        
        Parameters.set("smallScreen", this.smallScreen);
        Parameters.set("runImageIntegration", this.runImageIntegration);
        Parameters.set("runDrizzleIntegration", this.runDrizzleIntegration);
        Parameters.set("graphWidth", this.graphWidth);
        Parameters.set("graphHeight", this.graphHeight);
        Parameters.set("extraControls", NSG_EXTRA_CONTROLS);
    };

    /**
     * Reload our script's data from a process icon
     * @param {Boolean} isViewTarget If true, running in background. Create or overwrite resultsFileBg file.
     */
    this.loadParameters = function (isViewTarget) {
        if (Parameters.has("referenceFile")) {
            let filename = Parameters.getString("referenceFile");
            if (File.exists(filename)){
                this.cache.setRefFilename(filename);
            } else {
                console.warningln("** WARNING: Reference file does not exist: '", filename, "'");
            }
        }
        let nthFile = 0;
        this.targetFiles = [];
        while (Parameters.has("file" + nthFile)){
            let str = Parameters.getString("file" + nthFile);
            if (str){
                let filename = setTargetTableEntries( str );
                if (filename && File.exists(filename)){
                    this.targetFiles.push(filename);
                } else {
                    console.warningln("** WARNING: Target file does not exist: '", filename, "'");
                }
            }
            nthFile++;
        }
        if (!this.targetFiles.length){
            // backward compatability
            if (Parameters.has("targetFiles")) {
                let files = (Parameters.getString("targetFiles")).split(',');
                this.targetFiles = [];
                for (let filename of files){
                    if (File.exists(filename)){
                        this.targetFiles.push(filename);
                    } else {
                        console.warningln("** WARNING: Target file does not exist: '", filename, "'");
                    }
                }
            }
        }
        if (Parameters.has("selectedTarget")){
            this.savedSelectedTarget = Parameters.getString("selectedTarget");
        }
        if (Parameters.has("limitingNumberToBlink")) {
            this.limitingNumberToBlink = (Parameters.getBoolean("limitingNumberToBlink"));
        }
        if (Parameters.has("limitBlinkNumber")) {
            this.limitBlinkNumber = (Parameters.getInteger("limitBlinkNumber"));
        }
        if (Parameters.has("pixelSize")) {
            this.pixelSize = (Parameters.getReal("pixelSize"));
        }
        if (Parameters.has("focalLength")) {
            this.focalLength = (Parameters.getInteger("focalLength"));
        }
        if (Parameters.has("outputDir")) {
            let dir = Parameters.getString("outputDir");
            if (dir && (File.directoryExists(dir) || dir.startsWith("."))){
                this.outputDir = dir;
            } else {
                console.warningln("** WARNING: Output directory does not exist: '", dir, "'");
            }
        }
        if (Parameters.has("resultsFile")) {
            let file = decodeResultFilename(Parameters.getString("resultsFile"), false);
            if (file && File.exists(file)){
                this.resultsFile = file;
            }
        }
        
        if (Parameters.has("resultsFileBg")) {
            // Ignore the modify date if reading from process icon.
            // It may have been modified by NSG running as a background process.
            let file = decodeResultFilename(Parameters.getString("resultsFileBg"), true);
            if (isViewTarget){
                // Running from processIcon in BG (for example, ProcessContainer)
                // resultsFileBg will be created or overwriten. Write Results to this filename.
                // (Results are not read - previous results are ignored when running in BG)
                this.resultsFileBg = file;
            } else if (file && File.exists(file)){
                // Running from processIcon in FG (resultsFileBg is only saved to process icons).
                // If the resultsFileBg file exists, read results from it instead of data.resultsFile
                this.resultsFile = file;
            }
        }
        
        if (Parameters.has("outputPostFix")) {
            this.outputPostFix = (Parameters.getString("outputPostFix"));
        }
        if (Parameters.has("useFullPath")) {
            this.useFullPath = (Parameters.getBoolean("useFullPath"));
        }
        if (Parameters.has("overwrite")) {
            this.overwrite = (Parameters.getBoolean("overwrite"));
        }
        if (Parameters.has("deleteTmpFiles")) {
            this.deleteTmpFiles = (Parameters.getBoolean("deleteTmpFiles"));
        }
        if (Parameters.has("displayGradient")) {
            this.displayGradient = (Parameters.getBoolean("displayGradient"));
        }
        if (this.isNSGXnmlInstalled){
            if (Parameters.has("createXnml")) {
                this.createXnml = Parameters.getBoolean("createXnml");
            }
            if (Parameters.has("writeNormalized")) {
                this.writeNormalized = Parameters.getBoolean("writeNormalized");
            }
            if (Parameters.has("addDrizzleFiles")) {
                this.addDrizzleFiles = Parameters.getBoolean("addDrizzleFiles");
            }
            if (Parameters.has("csvFile")) {
                this.csvFile = (Parameters.getBoolean("csvFile"));
            }
            if (Parameters.has("weightPrefix")) {
                this.weightPrefix = (Parameters.getBoolean("weightPrefix"));
            }
        }
        if (Parameters.has("noiseWeightKeyword")) {
            this.noiseWeightKeyword = (Parameters.getString("noiseWeightKeyword"));
        }
        if (Parameters.has("onErrorIndex")) {
            this.onErrorIndex = (Parameters.getInteger("onErrorIndex"));
        }

        // Star Detection
        if (Parameters.has("logStarDetection"))
            this.logStarDetection = Parameters.getReal("logStarDetection");
        
        // Photometric Star Search
        if (Parameters.has("starFluxTolerance"))
            this.starFluxTolerance = Parameters.getReal("starFluxTolerance");
        if (Parameters.has("starSearchRadius"))
            this.starSearchRadius = Parameters.getReal("starSearchRadius");
        
        // Photometric Scale
        if (Parameters.has("apertureGrowthRate"))
            this.apertureGrowthRate = Parameters.getReal("apertureGrowthRate");
        if (Parameters.has("apertureAdd"))
            this.apertureAdd = Parameters.getInteger("apertureAdd");
        if (Parameters.has("apertureGap"))
            this.apertureGap = Parameters.getInteger("apertureGap");
        if (Parameters.has("apertureBgDelta"))
            this.apertureBgDelta = Parameters.getInteger("apertureBgDelta");
        
        if (this.isNSGXnmlInstalled){
            if (Parameters.has("usePhotometryROI"))
                this.usePhotometryROI = Parameters.getBoolean("usePhotometryROI");
            if (Parameters.has("photometryROIx"))
                this.photometryROIx = Parameters.getInteger("photometryROIx");
            if (Parameters.has("photometryROIy"))
                this.photometryROIy = Parameters.getInteger("photometryROIy");
            if (Parameters.has("photometryROIw"))
                this.photometryROIw = Parameters.getInteger("photometryROIw");
            if (Parameters.has("photometryROIh"))
                this.photometryROIh = Parameters.getInteger("photometryROIh");
        }
        
        if (Parameters.has("linearRangeRef"))
            this.linearRangeRef = Parameters.getReal("linearRangeRef");
        if (Parameters.has("outlierRemovalPercent"))
            this.outlierRemovalPercent = Parameters.getReal("outlierRemovalPercent");
        if (Parameters.has("useAutoPhotometry"))
            this.useAutoPhotometry = Parameters.getBoolean("useAutoPhotometry");
        
        // Gradient Sample Generation
        if (Parameters.has("sampleStarGrowthRate"))
            this.sampleStarGrowthRate = Parameters.getReal("sampleStarGrowthRate");
        if (Parameters.has("limitSampleStarsPercent"))
            this.limitSampleStarsPercent = Parameters.getReal("limitSampleStarsPercent");
        if (Parameters.has("sampleSize"))
            this.sampleSize = Parameters.getInteger("sampleSize");
        if (Parameters.has("maxSamples"))
            this.maxSamples = Parameters.getInteger("maxSamples");
        if (Parameters.has("useAutoSampleGeneration"))
            this.useAutoSampleGeneration = Parameters.getBoolean("useAutoSampleGeneration");
        for (let i=0; ; i++){
            if (Parameters.has("manualRejectionCircle" + i + "_x") &&
                    Parameters.has("manualRejectionCircle" + i + "_y") &&
                    Parameters.has("manualRejectionCircle" + i + "_radius")){
                
                let x = Parameters.getReal("manualRejectionCircle" + i + "_x");
                let y = Parameters.getReal("manualRejectionCircle" + i + "_y");
                let r = Parameters.getInteger("manualRejectionCircle" + i + "_radius");
                this.manualRejectionCircles.push(new ManualRejectionCircle(x, y, r));
            } else {
                break;
            }
        }
        
        // Gradient Correction
        if (Parameters.has("gradientSmoothness"))
            this.gradientSmoothness = Parameters.getReal("gradientSmoothness");
        if (Parameters.has("gradientLineX"))
            this.gradientLineX = Parameters.getInteger("gradientLineX");
        if (Parameters.has("gradientLineY"))
            this.gradientLineY = Parameters.getInteger("gradientLineY");
        if (Parameters.has("isGradientLineHorizontal"))
            this.isGradientLineHorizontal = Parameters.getBoolean("isGradientLineHorizontal");
                
        // Image rejection
        if (this.isNSGXnmlInstalled){
            if (Parameters.has("minimumWeight"))
                this.minimumWeight = Parameters.getReal("minimumWeight");
            if (Parameters.has("minimumScale"))
                this.minimumScale = Parameters.getReal("minimumScale");
            if (Parameters.has("useImageRejection"))
                this.useImageRejection = Parameters.getBoolean("useImageRejection"); 
        }
        
        // ImageIntegration
        if (Parameters.has("autoRejectAlgorithm")) {
            this.autoRejectAlgorithm = (Parameters.getBoolean("autoRejectAlgorithm"));
        }
        if (Parameters.has("sortByWeight") && this.isNSGXnmlInstalled) {
            this.sortByWeight = (Parameters.getBoolean("sortByWeight"));
        }
        if (Parameters.has("imageIntegrationTemplateId"))
            this.imageIntegrationTemplateId = Parameters.getString("imageIntegrationTemplateId");
        if (Parameters.has("drizzleIntegrationTemplateId"))
            this.drizzleIntegrationTemplateId = Parameters.getString("drizzleIntegrationTemplateId");
        if (Parameters.has("smallScreen"))
            this.smallScreen = Parameters.getBoolean("smallScreen");
        if (Parameters.has("runImageIntegration"))
            this.runImageIntegration = Parameters.getBoolean("runImageIntegration");
        if (Parameters.has("runDrizzleIntegration"))
            this.runDrizzleIntegration = Parameters.getBoolean("runDrizzleIntegration");
        
        if (Parameters.has("useImageIntegration"))
            this.useImageIntegration = Parameters.getBoolean("useImageIntegration");
        if (Parameters.has("graphWidth"))
            this.graphWidth = Parameters.getInteger("graphWidth");
        if (Parameters.has("graphHeight"))
            this.graphHeight = Parameters.getInteger("graphHeight");
        
        if (Parameters.has("extraControls")){
            NSG_EXTRA_CONTROLS = Parameters.getBoolean("extraControls");
        }

    };

    function getNSGXnmlLicense(){
        let email;
        let key;
        isPSFScaleSnrAvailable = false;
        let filename = File.homeDirectory + "/.NSGXnmlLicense";
        if (File.exists(filename)){
            let isInstalled = typeof NSGXnml === "function";
            if (isInstalled) {
                try {
                    let lines = File.readLines(filename,
                            ReadTextOptions_TrimLines | ReadTextOptions_RemoveEmptyLines);
                    email = lines[0];
                    key = lines[1];
                    let NSGXnmlVersion;
                    try {
                        let P = new NSGXnml;
                        NSGXnmlVersion = P.version;
                        if (NSGXnmlVersion !== undefined){
                            console.writeln("NSGXnml version: 1.0.", NSGXnmlVersion);
                            isPSFScaleSnrAvailable = (P.usePSFScaleSNR === true);
                        } else {
                            console.criticalln("** ERROR: NSGXnml version is less than 1.0.4 Please update it.");
                            console.writeln("https://www.normalizescalegradient.net");
                        }
                    } catch (noParameter){}
                    let minVersion = 4;
                    if (!NSGXnmlVersion || NSGXnmlVersion < minVersion){
                        new MessageBox("Error: NormalizeScaleGradient requies NSGXnml 1.0." + minVersion + " or later.",
                                TITLE, StdIcon_Error, StdButton_Ok).execute();
                        return {isInstalled: false, email: email, key: key};
                    }
                    try {
                        let P = new NSGXnml;
                        P.licenseEmail = email;
                        P.licenseKey = key;
                        P.executeGlobal();
                        console.noteln("NSGXnml licensed to ", email);
                        console.noteln("Thanks for purchasing this software.");
                        return {isInstalled: true, email: email, key: key};
                    } catch (error){
                        // Invalid license
                        console.criticalln(error);
                    }
                } catch (Exception){
                    console.criticalln("** ERROR: Failed to read NSGXnml license file:");
                    console.writeln(Exception);
                    console.writeln("To recreate the license file:");
                    console.writeln("PROCESS -> ImageCalibration -> NSGXnml");
                }
            } else {
                let msg = "NSG license detected, but cannot find a valid version of NSGXnml. \n\n" +
                        "PixInsight 1.8.9-1 requires NSGXnml version 1.0.4 \n" + 
                        "PixInsight 1.8.9-2 or later requires NSGXnml 1.0.5 or later \n\n" + 
                        "Windows or Linux: Use update repository \nhttps://nsg.astropills.it  \n\n" +
                        "MacOS: Download from \nhttps://www.normalizescalegradient.net";
                console.warningln("\n" + msg);
                new MessageBox(msg, TITLE, StdIcon_Error, StdButton_Ok).execute();
            }
        }
        return {isInstalled: false, email: email, key: key};
    }

    /**
     * Initialise the scripts data
     */
    this.setParameters = function () {
        this.NSGXnmlLicense = getNSGXnmlLicense();
        this.isNSGXnmlInstalled = this.NSGXnmlLicense.isInstalled;
        this.pixelSize = DEFAULT_PIXEL_SIZE;
        this.focalLength = DEFAULT_FOCAL_LENGTH;
        this.targetFiles = [];
        this.savedSelectedTarget = "";
        
        // Blink
        this.limitingNumberToBlink = true;
        this.limitBlinkNumber = 10;
        
        // Output
        this.outputDir = DEFAULT_OUTPUT_DIR;
        this.outputPostFix = "_nsg";
        this.useFullPath = false;
        this.overwrite = false;
        this.deleteTmpFiles = true;
        this.weightPrefix = this.isNSGXnmlInstalled;
        this.csvFile = this.isNSGXnmlInstalled;
        this.noiseWeightKeyword = "NWEIGHT";
        this.onErrorIndex = 0;
        this.createXnml = this.isNSGXnmlInstalled;
        this.writeNormalized = !this.isNSGXnmlInstalled;
        this.addDrizzleFiles = false;
        this.resultsFile = undefined;
        this.resultsFileBg = undefined;
        
        // Star Detection
        this.logStarDetection = DEFAULT_STAR_DETECTION;
        
        // Photometric Star Search
        this.starFluxTolerance = DEFAULT_STAR_FLUX_TOLERANCE;
        this.starSearchRadius = DEFAULT_STAR_SEARCH_RADIUS;
        
        // Photometric Scale
        this.apertureGrowthRate = APERTURE_GROWTH;
        this.apertureAdd = APERTURE_ADD;
        this.apertureGap = APERTURE_GAP;
        this.apertureBgDelta = APERTURE_BKG_DELTA;
        this.usePhotometryROI = false;
        this.photometryROIx = 0;
        this.photometryROIy = 0;
        this.photometryROIw = 100;
        this.photometryROIh = 100;
        this.outlierRemovalPercent = 2.0;
        this.useAutoPhotometry = true;
        
        // Gradient Sample Generation
        this.sampleStarGrowthRate = APERTURE_GROWTH_REJECTION;
        this.limitSampleStarsPercent = 35;
        this.sampleSize = 20;
        this.maxSamples = 2000;
        this.useAutoSampleGeneration = true;
        this.manualRejectionCircles = [];
        
        // Gradient Correction
        this.gradientSmoothness = DEFAULT_GRADIENT_SMOOTHNESS;
        this.gradientLineX = 0;
        this.gradientLineY = 0;
        this.isGradientLineHorizontal = true;
        
        // ImageRejection
        this.useImageRejection = this.isNSGXnmlInstalled;
        this.minimumWeight = this.isNSGXnmlInstalled ? DEFAULT_MIN_WEIGHT : 0;
        this.minimumScale = this.isNSGXnmlInstalled ? DEFAULT_MIN_SCALE : 0;
        
        // ImageIntegration
        this.useImageIntegration = true;
        this.autoRejectAlgorithm = true;
        this.sortByWeight = this.isNSGXnmlInstalled;
        this.imageIntegrationTemplateId = "";
        this.drizzleIntegrationTemplateId = "";
        
        this.graphWidth = 1200; // gradient and photometry graph width
        this.graphHeight = 800; // gradient and photometry graph height
        
        this.displayGradient = false;
        this.smallScreen = false;
        this.runImageIntegration = true;
        this.runDrizzleIntegration = true;
        
        if (this.cache !== undefined){
            this.cache.invalidate();
            gc(true);
        }
        this.cache = new Cache();
        this.linearRangeRef = LINEAR_RANGE;
        
        this.viewFlag = 0;
    };
    
    /**
     * Save settings. Used when NSG is run from PixInsight Script menu.
     */
    this.saveSettings = function(){
        self.resetSettings();
        let referenceFile = this.cache.getRefFilename();
        if (referenceFile){
            Settings.write( KEYPREFIX+"/referenceFile", DataType_UCString, referenceFile);
        }
        if (this.targetFiles.length){
            for (let i=0; i < this.targetFiles.length; i++){
                let tableEntries = getTargetTableEntries(this.targetFiles[i]);
                Settings.write( KEYPREFIX+"/targetFile" + i, DataType_UCString, tableEntries.encode());
            }
        }
        if (nsgDialog){
            let selectedTarget = nsgDialog.getSelectedTargetFilename(false);
            if (selectedTarget){
                Settings.write( KEYPREFIX+"/selectedTarget", DataType_UCString, selectedTarget);
            }
        }
        
        Settings.write( KEYPREFIX+"/pixelSize", DataType_Float, this.pixelSize );
        Settings.write( KEYPREFIX+"/focalLength", DataType_Int32, this.focalLength );
        Settings.write( KEYPREFIX+"/limitingNumberToBlink", DataType_Boolean, this.limitingNumberToBlink );
        Settings.write( KEYPREFIX+"/limitBlinkNumber", DataType_Int32, this.limitBlinkNumber );
        
        // Output files
        if (this.outputDir)
            Settings.write( KEYPREFIX+"/outputDir", DataType_UCString, this.outputDir);
        if (this.resultsFile)
            Settings.write( KEYPREFIX+"/resultsFile", DataType_UCString, encodeResultFilename(this.resultsFile));
        Settings.write( KEYPREFIX+"/outputPostFix", DataType_String, this.outputPostFix );
        Settings.write( KEYPREFIX+"/useFullPath", DataType_Boolean, this.useFullPath );
        Settings.write( KEYPREFIX+"/overwrite", DataType_Boolean, this.overwrite );
        Settings.write( KEYPREFIX+"/deleteTmpFiles", DataType_Boolean, this.deleteTmpFiles );
        Settings.write( KEYPREFIX+"/displayGradient", DataType_Boolean, this.displayGradient );
        if (this.isNSGXnmlInstalled){
            Settings.write( KEYPREFIX+"/createXnml", DataType_Boolean, this.createXnml);
            Settings.write( KEYPREFIX+"/writeNormalized", DataType_Boolean, this.writeNormalized);
            Settings.write( KEYPREFIX+"/addDrizzleFiles", DataType_Boolean, this.addDrizzleFiles);
            Settings.write( KEYPREFIX+"/csvFile", DataType_Boolean, this.csvFile );
        }
        Settings.write( KEYPREFIX+"/noiseWeightKeyword", DataType_String, this.noiseWeightKeyword );
        if (this.isNSGXnmlInstalled){
            Settings.write( KEYPREFIX+"/weightPrefix", DataType_Boolean, this.weightPrefix );
        }
        Settings.write( KEYPREFIX+"/onErrorIndex", DataType_Int32, this.onErrorIndex );

        // Star Detection
        Settings.write( KEYPREFIX+"/logStarDetection", DataType_Float, this.logStarDetection );

        // Photometric Star Search
        Settings.write( KEYPREFIX+"/starFluxTolerance", DataType_Float, this.starFluxTolerance );
        Settings.write( KEYPREFIX+"/starSearchRadius", DataType_Float, this.starSearchRadius );

        // Photometric Scale
        Settings.write( KEYPREFIX+"/apertureGrowthRate", DataType_Float, this.apertureGrowthRate );
        Settings.write( KEYPREFIX+"/apertureAdd", DataType_Int32, this.apertureAdd );
        Settings.write( KEYPREFIX+"/apertureGap", DataType_Int32, this.apertureGap );
        Settings.write( KEYPREFIX+"/apertureBgDelta", DataType_Int32, this.apertureBgDelta );
        if (this.isNSGXnmlInstalled){
            Settings.write( KEYPREFIX+"/usePhotometryROI", DataType_Boolean, this.usePhotometryROI );
            Settings.write( KEYPREFIX+"/photometryROIx", DataType_Int32, this.photometryROIx );
            Settings.write( KEYPREFIX+"/photometryROIy", DataType_Int32, this.photometryROIy );
            Settings.write( KEYPREFIX+"/photometryROIw", DataType_Int32, this.photometryROIw );
            Settings.write( KEYPREFIX+"/photometryROIh", DataType_Int32, this.photometryROIh );
        }
        Settings.write( KEYPREFIX+"/linearRangeRef", DataType_Float, this.linearRangeRef );
        Settings.write( KEYPREFIX+"/outlierRemovalPercent", DataType_Float, this.outlierRemovalPercent );
        Settings.write( KEYPREFIX+"/useAutoPhotometry", DataType_Boolean, this.useAutoPhotometry );

        // Gradient Sample Generation
        Settings.write( KEYPREFIX+"/sampleStarGrowthRate", DataType_Float, this.sampleStarGrowthRate );
        Settings.write( KEYPREFIX+"/limitSampleStarsPercent", DataType_Float, this.limitSampleStarsPercent );
        Settings.write( KEYPREFIX+"/sampleSize", DataType_Int32, this.sampleSize );
        Settings.write( KEYPREFIX+"/extraControls", DataType_Boolean, NSG_EXTRA_CONTROLS );
        if (NSG_EXTRA_CONTROLS){
            Settings.write( KEYPREFIX+"/maxSamples", DataType_Int32, this.maxSamples );
        }
        Settings.write( KEYPREFIX+"/useAutoSampleGeneration", DataType_Boolean, this.useAutoSampleGeneration );
        for (let i=0; i<this.manualRejectionCircles.length; i++){
            let mrc = this.manualRejectionCircles[i];
            Settings.write( KEYPREFIX+"/manualRejectionCircle" + i + "_x", DataType_Float, mrc.x);
            Settings.write( KEYPREFIX+"/manualRejectionCircle" + i + "_y", DataType_Float, mrc.y);
            Settings.write( KEYPREFIX+"/manualRejectionCircle" + i + "_radius", DataType_Int32, mrc.radius);
        }

        // Gradient correction
        Settings.write( KEYPREFIX+"/gradientSmoothness", DataType_Float, this.gradientSmoothness );
        Settings.write( KEYPREFIX+"/gradientLineX", DataType_Int32, this.gradientLineX );
        Settings.write( KEYPREFIX+"/gradientLineY", DataType_Int32, this.gradientLineY );
        Settings.write( KEYPREFIX+"/isGradientLineHorizontal", DataType_Boolean, this.isGradientLineHorizontal );
        
        // Image rejection
        if (this.isNSGXnmlInstalled){
            Settings.write( KEYPREFIX+"/useImageRejection", DataType_Boolean, this.useImageRejection );
            Settings.write( KEYPREFIX+"/minimumWeight", DataType_Float, this.minimumWeight );
            Settings.write( KEYPREFIX+"/minimumScale", DataType_Float, this.minimumScale );
        }
        
        // ImageIntegration
        Settings.write( KEYPREFIX+"/useImageIntegration", DataType_Boolean, this.useImageIntegration );
        Settings.write( KEYPREFIX+"/autoRejectAlgorithm", DataType_Boolean, this.autoRejectAlgorithm );
        if (this.isNSGXnmlInstalled){
            Settings.write( KEYPREFIX+"/sortByWeight", DataType_Boolean, this.sortByWeight );
        }
        Settings.write( KEYPREFIX+"/imageIntegrationTemplateId", DataType_UCString, this.imageIntegrationTemplateId );
        Settings.write( KEYPREFIX+"/drizzleIntegrationTemplateId", DataType_UCString, this.drizzleIntegrationTemplateId );

        Settings.write( KEYPREFIX+"/smallScreen", DataType_Boolean, this.smallScreen );
        Settings.write( KEYPREFIX+"/runImageIntegration", DataType_Boolean, this.runImageIntegration );
        Settings.write( KEYPREFIX+"/runDrizzleIntegration", DataType_Boolean, this.runDrizzleIntegration );
    };
    
    this.restoreSettings = function(){
        
        let keyValue = Settings.read( KEYPREFIX+"/referenceFile", DataType_UCString );
        if ( Settings.lastReadOK ){
            if (keyValue && File.exists(keyValue)){
                this.cache.setRefFilename(keyValue);
            }
        }
    
        let nthFile = 0;
        this.targetFiles = [];
        do {
            keyValue = Settings.read( KEYPREFIX+"/targetFile" + nthFile, DataType_UCString );
            if ( Settings.lastReadOK ){
                if (keyValue){
                    let filename = setTargetTableEntries( keyValue );
                    if (filename && File.exists(filename)){
                        this.targetFiles.push(filename);
                    } else {
                        console.warningln("** WARNING: Target file does not exist: '", filename, "'");
                    }
                }
            }
            nthFile++;
        } while (Settings.lastReadOK);
        
        keyValue = Settings.read( KEYPREFIX+"/selectedTarget", DataType_UCString );
        if ( Settings.lastReadOK ){
            if (keyValue && File.exists(keyValue)){
                this.savedSelectedTarget = keyValue;
            }
        }
        
        keyValue = Settings.read( KEYPREFIX+"/pixelSize", DataType_Float );
        if ( Settings.lastReadOK )
            this.pixelSize = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/focalLength", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.focalLength = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/limitingNumberToBlink", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.limitingNumberToBlink = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/limitBlinkNumber", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.limitBlinkNumber = keyValue;
        
        // Output files
        keyValue = Settings.read( KEYPREFIX+"/outputDir", DataType_UCString );
        if ( Settings.lastReadOK ){
            if (keyValue && (File.directoryExists(keyValue) || keyValue.startsWith("."))){
                this.outputDir = keyValue;
            }
        }
        keyValue = Settings.read( KEYPREFIX+"/resultsFile", DataType_UCString );
        if ( Settings.lastReadOK ){
            // Always check modify date if starting NSG from the menu.
            keyValue = decodeResultFilename(keyValue, false);
            if (keyValue && File.exists(keyValue)){
                this.resultsFile = keyValue;
            }
        }
        keyValue = Settings.read( KEYPREFIX+"/outputPostFix", DataType_String );
        if ( Settings.lastReadOK )
            this.outputPostFix = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/useFullPath", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.useFullPath = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/overwrite", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.overwrite = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/deleteTmpFiles", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.deleteTmpFiles = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/displayGradient", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.displayGradient = keyValue;
        if (this.isNSGXnmlInstalled){
            keyValue = Settings.read( KEYPREFIX+"/createXnml", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.createXnml = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/writeNormalized", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.writeNormalized = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/addDrizzleFiles", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.addDrizzleFiles = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/csvFile", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.csvFile = keyValue;
        }
        keyValue = Settings.read( KEYPREFIX+"/noiseWeightKeyword", DataType_String );
        if ( Settings.lastReadOK )
            this.noiseWeightKeyword = keyValue;
        if (this.isNSGXnmlInstalled){
            keyValue = Settings.read( KEYPREFIX+"/weightPrefix", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.weightPrefix = keyValue;
        }
        keyValue = Settings.read( KEYPREFIX+"/onErrorIndex", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.onErrorIndex = keyValue;
        
        // Star Detection
        keyValue = Settings.read( KEYPREFIX+"/logStarDetection", DataType_Float );
        if ( Settings.lastReadOK )
            this.logStarDetection = keyValue;
        
        // Photometric Star Search
        keyValue = Settings.read( KEYPREFIX+"/starFluxTolerance", DataType_Float );
        if ( Settings.lastReadOK )
            this.starFluxTolerance = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/starSearchRadius", DataType_Float );
        if ( Settings.lastReadOK )
            this.starSearchRadius = keyValue;
        
        // Photometric Scale
        keyValue = Settings.read( KEYPREFIX+"/apertureGrowthRate", DataType_Float );
        if ( Settings.lastReadOK )
            this.apertureGrowthRate = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/apertureAdd", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.apertureAdd = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/apertureGap", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.apertureGap = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/apertureBgDelta", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.apertureBgDelta = keyValue;
        if (this.isNSGXnmlInstalled){
            keyValue = Settings.read( KEYPREFIX+"/usePhotometryROI", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.usePhotometryROI = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/photometryROIx", DataType_Int32 );
            if ( Settings.lastReadOK )
                this.photometryROIx = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/photometryROIy", DataType_Int32 );
            if ( Settings.lastReadOK )
                this.photometryROIy = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/photometryROIw", DataType_Int32 );
            if ( Settings.lastReadOK )
                this.photometryROIw = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/photometryROIh", DataType_Int32 );
            if ( Settings.lastReadOK )
                this.photometryROIh = keyValue;
        }
        
        keyValue = Settings.read( KEYPREFIX+"/linearRangeRef", DataType_Float );
        if ( Settings.lastReadOK )
            this.linearRangeRef = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/outlierRemovalPercent", DataType_Float );
        if ( Settings.lastReadOK )
            this.outlierRemovalPercent = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/useAutoPhotometry", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.useAutoPhotometry = keyValue;
        
        // Gradient Sample Generation
        keyValue = Settings.read( KEYPREFIX+"/sampleStarGrowthRate", DataType_Float );
        if ( Settings.lastReadOK )
            this.sampleStarGrowthRate = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/sampleStarGrowthRateTarget", DataType_Float );
        if ( Settings.lastReadOK )
            this.sampleStarGrowthRateTarget = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/limitSampleStarsPercent", DataType_Float );
        if ( Settings.lastReadOK )
            this.limitSampleStarsPercent = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/sampleSize", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.sampleSize = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/extraControls", DataType_Boolean );
        if ( Settings.lastReadOK )
            NSG_EXTRA_CONTROLS = keyValue;
        if (NSG_EXTRA_CONTROLS){
            keyValue = Settings.read( KEYPREFIX+"/maxSamples", DataType_Int32 );
            if ( Settings.lastReadOK )
                this.maxSamples = keyValue;
        }
        keyValue = Settings.read( KEYPREFIX+"/useAutoSampleGeneration", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.useAutoSampleGeneration = keyValue;
        for (let i=0; ; i++){
            let x, y, radius;
            keyValue = Settings.read( KEYPREFIX+"/manualRejectionCircle" + i + "_x", DataType_Float );
            if ( Settings.lastReadOK )
                x = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/manualRejectionCircle" + i + "_y", DataType_Float );
            if ( Settings.lastReadOK )
                y = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/manualRejectionCircle" + i + "_Radius", DataType_Int32 );
            if ( Settings.lastReadOK )
                radius = keyValue;

            if (x && y && radius){
                this.manualRejectionCircles.push(new ManualRejectionCircle(x, y, radius));
            } else {
                break;
            }
        }
        
        // Gradient correction
        keyValue = Settings.read( KEYPREFIX+"/gradientSmoothness", DataType_Float );
        if ( Settings.lastReadOK )
            this.gradientSmoothness = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/gradientLineX", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.gradientLineX = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/gradientLineY", DataType_Int32 );
        if ( Settings.lastReadOK )
            this.gradientLineY = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/isGradientLineHorizontal", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.isGradientLineHorizontal = keyValue;
        
        // Image rejection
        if (this.isNSGXnmlInstalled){
            keyValue = Settings.read( KEYPREFIX+"/useImageRejection", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.useImageRejection = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/minimumWeight", DataType_Float );
            if ( Settings.lastReadOK )
                this.minimumWeight = keyValue;
            keyValue = Settings.read( KEYPREFIX+"/minimumScale", DataType_Float );
            if ( Settings.lastReadOK )
                this.minimumScale = keyValue;
        }
        
        
        // ImageIntegration
        keyValue = Settings.read( KEYPREFIX+"/useImageIntegration", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.useImageIntegration = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/autoRejectAlgorithm", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.autoRejectAlgorithm = keyValue;
        if (this.isNSGXnmlInstalled){
            keyValue = Settings.read( KEYPREFIX+"/sortByWeight", DataType_Boolean );
            if ( Settings.lastReadOK )
                this.sortByWeight = keyValue;
        }
        keyValue = Settings.read( KEYPREFIX+"/imageIntegrationTemplateId", DataType_UCString );
        if ( Settings.lastReadOK )
            this.imageIntegrationTemplateId = keyValue;
        keyValue = Settings.read( KEYPREFIX+"/drizzleIntegrationTemplateId", DataType_UCString );
        if ( Settings.lastReadOK )
            this.drizzleIntegrationTemplateId = keyValue;
        
        keyValue = Settings.read( KEYPREFIX+"/smallScreen", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.smallScreen = keyValue;

        keyValue = Settings.read( KEYPREFIX+"/runImageIntegration", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.runImageIntegration = keyValue;
        
        keyValue = Settings.read( KEYPREFIX+"/runDrizzleIntegration", DataType_Boolean );
        if ( Settings.lastReadOK )
            this.runDrizzleIntegration = keyValue;
    };
    
    /**
     * Clear the KEYPREFIX settings. The next time NSG starts, it uses its default settings.
     */
    this.resetSettings = function(){
        Settings.remove( KEYPREFIX );
    };
    
    this.setParameters();
}

/**
 * @returns {NsgDialogSizes}
 */
function NsgDialogSizes(){
    const keyPrefix = KEYPREFIX + "Dialog";
    
    this.reset = function(){
        Settings.remove( keyPrefix );
    };
    
    /**
     * @param {String} key Dialog key (For example "DetectedStars")
     * @param {Number} width The dialog width to store
     * @param {Number} height The dialog height to store
     */
    this.store = function(key, width, height){
        Settings.write( keyPrefix + "/" + key + "Width", DataType_Int32, width );
        Settings.write( keyPrefix + "/" + key + "Height", DataType_Int32, height );
    };
    
    /**
     * @param {NsgData} data Must define {smallScreen: true|false}
     * @param {String} key key Dialog key (For example "DetectedStars")
     * @returns {Rect} The stored width and height. Defaults to 1000 x 730 or 1800 x 1040
     */
    this.get = function(data, key){
        // Small screen of height 768 pixels, HDMI screen of 1920 x 1080
        // Need to leave room for window decorations. 34 pixels on Windows.
        let size = data.smallScreen ? new Rect(1000, 730) : new Rect(1800, 1040);
        
        let keyValue = Settings.read( keyPrefix + "/" + key + "Width", DataType_Int32 );
        if ( Settings.lastReadOK )
            size.width = keyValue;

        keyValue = Settings.read( keyPrefix + "/" + key + "Height", DataType_Int32 );
        if ( Settings.lastReadOK )
            size.height = keyValue;
        
        return size;
    };
}
