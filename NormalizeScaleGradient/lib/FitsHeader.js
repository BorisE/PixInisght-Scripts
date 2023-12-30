/* global File, compareResultObsDate, NSG_FILENAME_HEADERS_MAP */

// Version 1.0 (c) John Murphy 10th-March-2020
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
 * Does a quick read of the FITS or XISF file header to read the keywords & create HeaderEntries.
 * Image properties are not read.
 * @param {String} fitsFilePath Full filename of image.
 * @throws {Error} If file cannot be read.
 * @returns {HeaderEntries}
 * @throws {Error} If file does not exist or file IO error
 */
function getHeaderEntries( fitsFilePath ){
    if (NSG_FILENAME_HEADERS_MAP.has(fitsFilePath)){
        return NSG_FILENAME_HEADERS_MAP.get(fitsFilePath);
    }
    let headerEntries = LoadUsefulFITSKeywords( fitsFilePath );
    NSG_FILENAME_HEADERS_MAP.set(fitsFilePath, headerEntries);
    return headerEntries;
}

/**
 * Creates the HeaderEntries from ImageData. Includes image properties Focal Length, Pixel Size.
 * @param {ImageData} imageData
 * @param {String} fitsFilePath
 * @param {Boolean} updateHdrCache If true, replace an existing cached value.
 * @returns {HeaderEntries}
 * @throws {Error} If file does not exist or file IO error
 */
function getHdrEntries( imageData, fitsFilePath, updateHdrCache ){
    /**
     * @param {FITSKeyword} keyword
     */
    function getValue(keyword){
        return keyword.strippedValue;
    }
    /**
     * @param {HeaderEntries} hdrEntries
     * @param {ImageData} imageData
     */
    function updateFocalLen(hdrEntries, imageData){
        if (!hdrEntries.FOCALLEN && imageData.propertyFocalLength){
            let f = imageData.propertyFocalLength;
            if (f && typeof f === 'number'){
                hdrEntries.FOCALLEN = Math.round(f * 1000);
            }
        }
    }
    /**
     * @param {HeaderEntries} hdrEntries
     * @param {ImageData} imageData
     */
    function updatePixelSize(hdrEntries, imageData){
        if (!hdrEntries.XPIXSZ && imageData.propertyXPixelSize){
            let xPixelSize = imageData.propertyXPixelSize;
            if (xPixelSize && typeof xPixelSize === 'number'){
                hdrEntries.XPIXSZ = xPixelSize;  
            }
        }
    }
    if (NSG_FILENAME_HEADERS_MAP.has(fitsFilePath) && !updateHdrCache){
        // Cached value exists.
        let hdrEntries = NSG_FILENAME_HEADERS_MAP.get(fitsFilePath);
        updateFocalLen(hdrEntries, imageData);
        updatePixelSize(hdrEntries, imageData);
        return hdrEntries;
    }
    // Cached value does not exist, or we want to read it again using FileFormatInstance
    let headerEntries = new HeaderEntries(fitsFilePath);
    let keywords = imageData.keywords;
    for (let keyword of keywords){
        headerEntries.addRawEntry(keyword.name, getValue, keyword);
    }
    // console.noteln("getHdrEntries: ", headerEntries.toString());
    updateFocalLen(headerEntries, imageData);
    updatePixelSize(headerEntries, imageData);
    // console.noteln(" + properties: ", headerEntries.toString());
    NSG_FILENAME_HEADERS_MAP.set(fitsFilePath, headerEntries);
    return headerEntries;
}

/**
 * @param {String} filename
 * @returns {HeaderEntries}
 */
function HeaderEntries(filename){
    this.filename = filename;
    let NOISE = [];
    let NOISEA = [];
    this.XPIXSZ = undefined;
    this.FOCALLEN = undefined;
    let FILTER = undefined;
    this.AIRMASS = undefined;
    this.ALTITUDE = undefined;
    this.EXPOSURE = undefined;
    this.DATE_OBS = undefined;
    let cfaIndex = undefined;
    let self = this;
    
    this.toString = function(){
        let ch = '\t';
        let hdrStr = "";
        if (NOISE[0] !== undefined){
            hdrStr += ch + "NOISE00" + ch + NOISE[0];
        }
        if (NOISE[1] !== undefined){
            hdrStr += ch + "NOISE01" + ch + NOISE[1];
        }
        if (NOISE[2] !== undefined){
            hdrStr += ch + "NOISE02" + ch + NOISE[2];
        }
        if (NOISEA[0] !== undefined){
            hdrStr += ch + "NOISEA00" + ch + NOISEA[0];
        }
        if (NOISEA[1] !== undefined){
            hdrStr += ch + "NOISEA01" + ch + NOISEA[1];
        }
        if (NOISEA[2] !== undefined){
            hdrStr += ch + "NOISEA02" + ch + NOISEA[2];
        }
        if (self.XPIXSZ !== undefined){
            hdrStr += ch + "XPIXSZ" + ch + self.XPIXSZ;
        }
        if (self.FOCALLEN !== undefined){
            hdrStr += ch + "FOCALLEN" + ch + self.FOCALLEN;
        }
        if (FILTER !== undefined){
            hdrStr += ch + "FILTER" + ch + FILTER;
        }
        if (self.AIRMASS !== undefined){
            hdrStr += ch + "AIRMASS" + ch + self.AIRMASS;
        }
        if (self.ALTITUDE !== undefined){
            hdrStr += ch + "ALTITUDE" + ch + self.ALTITUDE;
        }
        if (self.EXPOSURE !== undefined){
            hdrStr += ch + "EXPOSURE" + ch + self.EXPOSURE;
        }
        if (self.DATE_OBS !== undefined){
            hdrStr += ch + "DATE-OBS" + ch + self.DATE_OBS;
        }
        return hdrStr;
    };
    
    /**
     * @param {String} key FITS key (for example "EXPOSURE")
     * @param {Function} getValue A function to extract the value from keywordString
     * @param {String} keywordString
     */
    this.addRawEntry = function (key, getValue, keywordString) {
        if (key.startsWith("CO")) // COMMENT
            return;
        
        const ch0 = key.charAt(0);
        switch (ch0) {
            case 'H':   // History
                return;
            case 'N':   // NOISEXX or NOISEAXX
                setNOISE();
                return;
            case 'F':   // FOCALLEN or FILTER
                if (setFOCALLEN())
                    return;
                setFILTER();
                return;
            case 'E':   // EXPOSURE or EXPTIME or ELAPTIME
                setEXPOSURE();
                return;
            case 'X':   // XPIXSZ
                setXPIXSZ();
                return;
            case 'D':   // DATE-OBS
                setDATE_OBS();
                return;
            default:
                if (setAIRMASS())   // AIRMASS
                    return;
                setALTITUDE();      // ALTITUDE or OBJCTALT or CENTALT
        }
        return;

        function setNOISE(){
            if (!key.startsWith("NOISE"))
                return false;
            if (key === "NOISE00"){
                NOISE[0] = Number(getValue(keywordString));
                return true;
            }
            if (key === "NOISE01"){
                NOISE[1] = Number(getValue(keywordString));
                return true;
            }
            if (key === "NOISE02"){
                NOISE[2] = Number(getValue(keywordString));
                return true;
            }
            if (key === "NOISEA00"){
                NOISEA[0] = getValue(keywordString);
                return true;
            }
            if (key === "NOISEA01"){
                NOISEA[1] = getValue(keywordString);
                return true;
            }
            if (key === "NOISEA02"){
                NOISEA[2] = getValue(keywordString);
                return true;
            }
            return false;
        }

        function setXPIXSZ(){
            if (key === "XPIXSZ"){
                self.XPIXSZ = Number(getValue(keywordString));
                return true;
            }
            return false;
        }
        
        function setFOCALLEN(){
            if (key === "FOCALLEN"){
                self.FOCALLEN = Math.round(Number(getValue(keywordString)));
                return true;
            }
            return false;
        }
        
        function setFILTER(){
            if (key === "FILTER"){
                FILTER = getValue(keywordString);
                return true;
            }
            return false;
        }
        
        function setAIRMASS(){
            if (key === "AIRMASS"){
                self.AIRMASS = Number(getValue(keywordString));
                return true;
            }
            return false;
        }
        
        function setALTITUDE(){
            if (key === "ALTITUDE" || key === "OBJCTALT" || key === "CENTALT"){
                self.ALTITUDE = Number(getValue(keywordString));
                return true;
            }
            return false;
        }
        
        function setEXPOSURE(){
            if (key === "EXPOSURE" || key === "EXPTIME" || key === "ELAPTIME" /*|| key === "TELAPSE"*/){
                self.EXPOSURE = Number(getValue(keywordString));
                return true;
            }
            return false;
        }
        
        function setDATE_OBS(){
            if (key === "DATE-OBS"){
                self.DATE_OBS = getValue(keywordString);
                return true;
            }
            return false;
        }
    };
    
    /**
     * If NOISExx exists:
     * If NOISE01 and NOISE02 don't exist, return 0
     * If NOISE00, NOISE01 and NOISE02 exist, return -1 (RGB)
     * Else return index to NOISExx that does exist (CFA extraction)
     * @returns {Number|undefined} undefined if NOISExx does not exist.
     */
    this.getCfaIndex = function(){
        if (cfaIndex){
            return cfaIndex;
        }
        if (NOISE.length === 0){
            return undefined;
        }
        if (NOISE.length === 1){
            cfaIndex = 0; // CFA -> R or L
        } else if (NOISE.length === 2){
            cfaIndex = 1; // CFA -> G
        } else if (NOISE[0] && NOISE[1] && NOISE[2]){
            cfaIndex = -1; // RGB
        } else {
            cfaIndex = 2;  // CFA -> B
        }
        return cfaIndex;
    };
    
    /**
     * Noise values read from FITS header: NOISEXX, NOISEAXX.
     * Noise contains 'noise array', 'noiseType array', and the 'cfaIndex'.
     * @returns {Noise|undefined}
     */
    this.getNoise = function(){
        let index = self.getCfaIndex();
        if (index === undefined){
            return undefined;
        }
        return new Noise(NOISE, NOISEA, index);
    };
    
    /**
     * Scaled noise. Return L or Red noise, scaled for exposure and airmass.
     * @returns {undefined}
     */
    this.calcAirmassScaledNoise = function(){
        let index = self.getCfaIndex();
        if (index !== undefined){
            if (index === -1){
                index = 0;  // For RGB, use R channel
            }
            if (NOISE[index]){
                let noise = NOISE[index];
                if (self.EXPOSURE){
                    noise /= self.EXPOSURE;
                }
                if (self.AIRMASS){
                    // Areosol optical depth can vary from:
                    // Great night: 0.1 (Western US, use -0.26) to 0.2 (Eastern US, use -0.36)
                    // Hazy nigtht: 0.5
                    noise /= Math.exp(-0.36 * self.AIRMASS); // Assumes areosol optical depth of 0.2
                }
                return {displayNoise:noise, type:NOISEA[index]};
            }
        }
        return undefined;
    };
    
    /**
     * If cfa index is undefined (no NOISExx), -1 (RGB) or 0 (Red or L), return filter name.
     * Else return "CFA-->G" or "CFA-->B"
     * @returns {String} Filter name or ""
     */
    this.getFilter = function(){
        let index = self.getCfaIndex();
        if (index !== undefined && index > 0){
            return index === 1 ? "CFA-->G" : "CFA-->B";
        }
        return FILTER ? FILTER : "";
    };
};

function FitsHeader(){

    /**
     * @param {FITSKeyword[]} keywords
     * @param {String} filename Filename without path. Might get truncated.
     * @param {Boolean} replace If true, replace any existing value. Otherwise allow duplicates.
     */
    this.fitsHeaderRefFilename = function (keywords, filename, replace){
        addKeyword(keywords, "NSGREF", filename, "NSG reference filename", replace);
    };
    
    /**
     * Writes NSGISREF, NSGREFx, NSGTGTx. Used when writing Gradient files.
     * Filename is chopped up into chunks to avoid exceeding FITS header 78 character limit.
     * @param {FITSKeyword[]} keywords
     * @param {String} refFile Full pathname
     * @param {String} tgtFile Full pathname
     */
    this.fitsHeaderRefAndTgt = function (keywords, refFile, tgtFile){
        function fitsHeaderFilename(key, file){
            let regExp = / /g;
            let filename = file.replace(regExp, '¬');
            let chunk = 75;
            for (let i=0; i * chunk < filename.length; i++){
                let startIndex = i * chunk;
                let value = filename.slice(startIndex, startIndex + chunk );
                keywords.push(new FITSKeyword(key + i, value, key + " filename part: " + i));
            }
        }
        let isReference = refFile === tgtFile ? "true" : "false";
        keywords.push(new FITSKeyword("NSGISREF", isReference, "Is reference"));
        fitsHeaderFilename("NSGREF", refFile);
        fitsHeaderFilename("NSGTGT", tgtFile);
    };
    
    /**
     * @param {FITSKeyword[]} keywords
     * @param {Number} image
     */
    this.fitsHeaderDimension = function (keywords, image){
        let w = image.width;
        let h = image.height;
        keywords.push(new FITSKeyword("NSGWIDTH", w.toString(), "NSG.width of reference image"));
        keywords.push(new FITSKeyword("NSGHIGHT", h.toString(), "NSG.height of reference image"));
    };

    /**
     * @param {FITSKeyword[]} keywords
     * @param {NsgData} data
     */
    this.fitsHeaderGradient = function (keywords, data){
        keywords.push(new FITSKeyword("HISTORY", "", 
            "NSG.gradientSmoothness: " + data.gradientSmoothness));
    };
    
    /**
     * @param {FITSKeyword[]} keywords
     * @param {Number} imageMaximum
     * @param {Boolean} replace
     * @returns {Boolean} true if keywords was modified.
     */
    this.fitsHeaderMaxValue = function(keywords, imageMaximum, replace){
        let comment = "Higher value indicates fewer saturated stars";
        return addKeyword(keywords, "NSGHIGH", imageMaximum.toPrecision(5), comment, replace);
    };

    /**
     * Add or replace a keyword. 
     * @param {FITSKeyword[]} keywords
     * @param {String} keyword
     * @param {Number | String} value
     * @param {String} comment
     * @param {Boolean} replace
     * @returns {Boolean} true if keywords was modified.
     */
    function addKeyword(keywords, keyword, value, comment, replace){
        if (replace){
            for (let i=0; i<keywords.length; i++) {
                if (keywords[i].name === keyword){
                    if (keywords[i].value === value && keywords[i].comment === comment){
                        // Already exists. Nothing to do.
                        return false;
                    } else {
                        // Replace entry
                        keywords[i].value = value;
                        keywords[i].comment = comment;
                        return true;
                    }
                }
            }
        }
        // Add entry
        keywords.push(new FITSKeyword(keyword, value, comment));
        return true;
    }

    /**
     * @param {FITSKeyword[]} keywords
     * @param {LinearFitData[]} scaleFactors
     * @param {Boolean} replace If true, replace any existing value. Otherwise allow duplicates.
     * @returns {Boolean} true if FITS header was modified
     */
    this.fitsHeaderScale = function(keywords, scaleFactors, replace){
        let updated = false;
        for (let c = 0; c < scaleFactors.length; c++){
            let inverse = 1 / scaleFactors[c].m;
            let comment = "NSG.scale[" + c + "]";
            let replaced = addKeyword(keywords, "NSGS" + c, inverse.toPrecision(5), comment, replace);
            if (replaced){
                updated = true;
            }
        }
        return updated;
    };
    
    /**
     * @param {FITSKeyword[]} keywords
     * @param {Number[]} signalToNoise
     * @param {Boolean} replace If true, replace any existing value. Otherwise allow duplicates.
     * @returns {Boolean} true if FITS header was modified
     */
    this.fitsHeaderSignalToNoise = function(keywords, signalToNoise, replace){
        let updated = false;
        for (let c = 0; c < signalToNoise.length; c++){
            let comment = "NSG.SNR[" + c + "] Signal to noise ratio";
            let snr = signalToNoise[c];
            snr = snr ? snr : 0;    // snr is undefined if the noise estimate is zero
            let replaced = addKeyword(keywords, "NSGSNR" + c, snr.toPrecision(5), comment, replace);
            if (replaced){
                updated = true;
            }
        }
        return updated;
    };
    
    /**
     * Add noise MRS to a HISTORY comment
     * @param {FITSKeyword[]} keywords
     * @param {Number[]} noiseValues
     * @param {String} type NOISExx, noiseMRS, noiseKSigma
     */
    this.fitsHeaderNoise = function(keywords, noiseValues, type){
        if (noiseValues.length > 1){
            for (let c = 0; c < noiseValues.length; c++){
                if (noiseValues[c]){
                    let comment = "NSG." + type + "[" + c + "]: " + noiseValues[c].toPrecision(5);
                    keywords.push(new FITSKeyword("HISTORY", "", comment));
                }
            }
        } else if (noiseValues.length === 1 && noiseValues[0]){
            let comment = "NSG." + type + ": " + noiseValues[0].toPrecision(5);
            keywords.push(new FITSKeyword("HISTORY", "", comment));
        }
    };
    
    /**
     * Add weight based on noise evaluation to the FITS header
     * @param {FITSKeyword[]} keywords
     * @param {String} keyword
     * @param {Number} averageWeight average weight over all channels
     * @param {String} type NOISExx, noiseMRS, noiseKSigma 
     * @param {Boolean} replace If true, replace any existing value. Otherwise allow duplicates.
     * @returns {Boolean} true if FITS header was modified
     */
    this.fitsHeaderNoiseWeight = function(keywords, keyword, averageWeight, type, replace){
        let value = averageWeight.toPrecision(5);
        let comment = (type && type.length > 0) ? "NSG.weight calculated from " + type : "NSG.weight";
        return addKeyword(keywords, keyword, value, comment, replace);
    };
    
}

/**
 * @param {FITSKeyword[]} keywords
 * @param {String} name Keyword to be deleted
 */
function deleteKeyword(keywords, name){
    for (let i=0; i<keywords.length; i++) {
        if (keywords[i].name === name){
            keywords.splice(i, 1);  // Delete one entry
            break;
        }
    }
}

/**
 * Calculate image scale in degrees per pixel from pixel size and focal length
 * @param {Number} pixelSize
 * @param {Number} focalLength
 * @returns {Number}
 */
function calcDegreesPerPixel(pixelSize, focalLength){
    return ((pixelSize * 1.0e-6) / (focalLength * 1.0e-3)) * (180 / Math.PI);
}

/**
 * @param {FITSKeyword[]} keywords
 * @returns {Boolean} True if one or more header keywords have a name that starts with "NSG"
 */
function nsgHeadersExist(keywords){
    for (let keyword of keywords){
        if (keyword.name.startsWith("NSG")){
            // NSG headers exist from when we had to write the weight to the input files.
            return true;
        }
    }
    return false;
}