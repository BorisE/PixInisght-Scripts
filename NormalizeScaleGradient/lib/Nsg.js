/* global nsgTgtResults, File, MIN_GRADIENT_INC, COMPARING_MRS_KSIGMA, defaultOutputFileFormat, MIN_IMAGE_SIZE, ColorSpace_RGB, isPSFScaleSnrAvailable, ImageWindow, UndoFlag_NoSwapFile, StdIcon_Error, StdButton_Ok, TITLE, ABORT, ASK_USER, StdButton_Abort, StdButton_Ignore, MIN_XNML_SIZE, NSG_MIN_STAR_PAIR_WARN, NSG_RUN_STATUS_EXCEPTION, NSG_RUN_STATUS_NORMAL, NSG_RUN_STATUS_FAILED, NSG_RUN_STATUS_ABORTED, ImageIntegration, ProcessInstance */

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
//"use strict";

/**
 * Because this JavaScript version does not have Array.from(map.values())
 * @param {Map} map
 * @returns {Array} array of map values (shallow copy)
 */
function ArrayFromMapValues(map){
    const result = [];
    for (let value of map.values()){
        result.push(value);
    }
    return result;
}
  
/**
 * @param {Error|undefined} error
 * @param {String|undefined} message 
 * @param {String|undefined} filename
 * @returns {String} error message: "** Error: [message]\n[[filename]] "
 */  
function logError(error, message, filename){
    let msg = "** Error";
    if (message) msg += ": " + message;
    if (error) msg += ": " + error.toString();
    if (filename) msg += "\nWhile processing:[" + filename + "]";
    console.criticalln(msg);
    if (error){
        console.criticalln("\nStack trace:\n", error.stack);
        lastException = error;
    }
    return msg;
}

/**
 * Clears nsgTgtResults. Disables image rejection buttons.
 * @param {NsgDialog} nsgDialog
 * @param {NsgData} data 
 */
function clearNsgResults(nsgDialog, data){
    nsgTgtResults.clear();
    data.resultsFile = undefined;
    if (nsgDialog){
        nsgDialog.enableImageRejection(false);
    }
}
/**
 * 
 * @param {Image} tgtImage Target image to be corrected (modified)
 * @param {image: image, smallImage: smallImage, resample: LN_SCALE, pedestal: pedestal} gradientImages
 * @param {LinearFitData[]} scaleFactors
 * @param {Float32Array} tgtSamples Empty buffer
 * @param {Float32Array} gradSamples Empty buffer
 * @param {Rect} tgtRect Area of target image
 * @param {Number} c Channel to correct
 */
function correctTargetImage(tgtImage, gradientImages, scaleFactors, tgtSamples, gradSamples, tgtRect, c){
    tgtImage.getSamples(tgtSamples, tgtRect, c);
    gradientImages[c].image.getSamples(gradSamples, tgtRect, 0);
    const pedestal = gradientImages[c].pedestal;
    const scaleFactor = scaleFactors[c].m;
    const tgtSamplesLen = tgtSamples.length;
    for (let i=0; i<tgtSamplesLen; i++){
        if (tgtSamples[i]){ // don't modify black pixels
            tgtSamples[i] = tgtSamples[i] * scaleFactor - (gradSamples[i] - pedestal);
        }
    }
    tgtImage.setSamples(tgtSamples, tgtRect, c);
}

/**
 * @param {Noise} NOISExx Noise estimates read from NOISExx FITS header(s). Array of noise estimates, array of noise types, and CFA index (-1 for RGB)
 * @param {Number[]} noiseMRS Array of two numbers; first entry contains average noise for all channels.
 * @param {Number[]} noiseKSigma Array of two numbers; first entry contains average noise for all channels.
 */
function RefNoise(NOISExx, noiseMRS, noiseKSigma){
    this.NOISExx = NOISExx;      // Array of noise estimates, array of noise types, and CFA index (-1 for RGB)
    this.MRS = noiseMRS;         // First array item contains noise estimate average for all channels
    this.KSigma = noiseKSigma;   // First array item contains noise estimate average for all channels
}

/**
 * Normalize tgtFile to the cached reference image
 * @param {NsgData} data
 * @param {String} tgtFile Full target filename, including path
 * @param {Image} refImage 
 * @param {RefNoise} refNoise Ref Noise estimates read from NOISExx FITS header(s) and Image.noiseMRS() and Image.noiseKSigma()
 * @param {String} refFilter 
 * @param {NsgCsvFile} csvFile
 * @param {NsgStatus} nsgStatus
 * @param {TypedArray} tgtSamples temporary buffer for target image.
 * @param {TypedArray} gradSamples temporary buffer, same size as tgtSamples array.
 * @param {ProgressDialog|undefined} progressDialog 
 * @return {{summary: resultString, file: normalizedFilename, Number: weight, Number[] scaleFactors, HeaderEntries: headerEntries, Boolean: failed} | undefined} 
 * @throws {Error} File I/O error
 */
function normalizeScaleGradient(data, tgtFile, refImage, refNoise, refFilter, csvFile, nsgStatus, tgtSamples, gradSamples, progressDialog){
    let resultString = File.extractName(tgtFile);
    let refFile = data.cache.getRefFilename();
    let refNoiseRaw = refNoise.NOISExx;         // {Noise} Array of noise estimates, array of noise types, and CFA index (-1 for RGB)
    let nChannels = refImage.isColor ? 3 : 1;
    let normalizedFilename;
    data.cache.setTgtFilename(tgtFile);
    if (progressDialog) progressDialog.updateElapsedTime("Reading target image");
    let tgtImage = data.cache.getTgtImage();
    let tgtImageData = data.cache.getTgtImageData();
    let keywords = tgtImageData.keywords;
    let tgtHeaderEntries = getHdrEntries(tgtImageData, tgtFile, true);
    let exposure = tgtHeaderEntries.EXPOSURE;
    resultString += ", " + (exposure ? exposure : 0) + "s" ;
    let noiseValues = [];
    let signalToNoise = [];
    let weights = [];
    let gradientImages = [];
    let averageWeight;
    let scaleFactors;
    let xnmlFile;
    let LNFile;
    let isRef = tgtFile === refFile;
//    gc(true);   // Because we just read the target image
    if (tgtSamples.length !== gradSamples.length || tgtSamples.length !== (refImage.width * refImage.height)){
        throw new Error("NSG logic error: Temporary buffer lengths are invalid: " + tgtSamples.length + ", " + gradSamples.length);
    }
    
    let targetError = targetErrorChecks(data, refImage, tgtImage, tgtFile);
    if (targetError){
        return nsgStatus.setError(null, targetError);
    }
    let tgtFilter = tgtHeaderEntries.getFilter();
    if (tgtFilter !== refFilter){
        let warning = "** WARNING: Filter mismatch: " + File.extractName(tgtFile) + 
                ": Reference '" + refFilter + "' Target '" + tgtFilter + "'";
        console.warningln(warning);
        nsgStatus.warnings.push(warning);
    }
    if (refNoiseRaw){
        let tgtNoiseRaw = tgtHeaderEntries.getNoise();
        if (!tgtNoiseRaw){
            // Ref image has NOISExx, but target image does not.
            let warning = "** WARNING: No 'NOISExx' in FITS header: " + File.extractName(tgtFile);
            console.warningln(warning);
            nsgStatus.warnings.push(warning);
        }
    }
    
    if (progressDialog) progressDialog.updateElapsedTime("Detecting stars");
    
    let nPhotStars;    // Photometry star matches
    if (!isRef){
        // target file is not the reference file so it needs normalizing
        // Scale factors
        let colorStarPairs = getColorStarPairs(nChannels, data);
        scaleFactors = getScaleFactors(colorStarPairs, data);
        gc(true);   // After detecting stars.
        if (nsgStatus.isAborted()) return nsgStatus.setAborted();
        
        nPhotStars = 0;
        for (let colorStarPair of colorStarPairs){
            // Use the color channel with the maximum number of photometry star matches.
            nPhotStars = Math.max(nPhotStars, colorStarPair.length);
        }
        
        // === Sample pairs ===
        let sampleGrid = data.cache.getSampleGrid(data, tgtFile);
        let stars = data.cache.getRefStars(data.logStarDetection);
        let colorSamplePairs = sampleGrid.createColorScaledSamplePairs(stars, data, scaleFactors);
        if (nsgStatus.isAborted()) return nsgStatus.setAborted();

        for (let c=0; c<colorSamplePairs.length; c++){
            if (colorSamplePairs[c].length < 3) {
                let errMsg = "Too few samples to create a Surface Spline: " + colorSamplePairs[c].length;
                return nsgStatus.setError(null, errMsg);
            }
        }

        let startSSTime = new Date().getTime();
        let surfaceSplines = [];
        console.writeln("\n<b><u>Calculating surface spline</u></b>");
        let binnedColorSamplePairs = createColorBinnedSamplePairs(data, colorSamplePairs, data.gradientSmoothness);
        for (let c = 0; c < nChannels; c++) {
            if (progressDialog) progressDialog.updateElapsedTime("Creating surface spline");
            let samplePairs = binnedColorSamplePairs[c];
            surfaceSplines[c] = calcSurfaceSpline(samplePairs, data.gradientSmoothness);
            console.writeln("Created surface spline [", c, "] smoothness ", data.gradientSmoothness.toPrecision(2));
            if (nsgStatus.isAborted()) return nsgStatus.setAborted();
        }
        console.noteln("Surface spline [", binnedColorSamplePairs[0].length, " samples] ", getElapsedTime(startSSTime));

        console.writeln("\n<b><u>Normalizing</u></b>");
        let tgtRect = new Rect(tgtImage.width, tgtImage.height);
        let tgtNoiseRaw = tgtHeaderEntries.getNoise();
        let useRawNoise = refNoiseRaw && tgtNoiseRaw && refNoiseRaw.index === tgtNoiseRaw.index;
        // We obviously need the full sized image if we are creating either the normalized NSG file or the gradient file.
        // If we are not creating the .xnml file, we will obviously be creating the normalized NSG file.
        // If we can't use the NOISExx from the unregistered files, then we will need to calculate the noise.
        // We get a more accurate result by using the scale and gradient corrected images, so this case
        // also needs the full sized image.
        let createLargeImage = !data.createXnml || data.writeNormalized || !useRawNoise;
        let postfixRGB = nChannels > 1 ? ['[R]','[G]','[B]'] : [''];
        for (let c=0; c<nChannels; c++){
            if (progressDialog) progressDialog.updateElapsedTime("Calculating gradient " + postfixRGB[c]);
            gradientImages[c] = createGradientImage(tgtRect, false, surfaceSplines[c], MIN_GRADIENT_INC, createLargeImage);
            if (console.abortRequested || !gradientImages[c]){
                return undefined;
            }
            if (!gradientImages[c].smallImage){
                return nsgStatus.setError(null, "Failed to create gradient image.");
            }
            if (!data.createXnml || data.writeNormalized || !useRawNoise){
                // Apply scale factor and then subtract gradient provided the tgtImage is non zero
                correctTargetImage(tgtImage, gradientImages, scaleFactors, tgtSamples, gradSamples, tgtRect, c);
            }
        }
        let weightResults;
        if (useRawNoise){
            weightResults = calcWeight(scaleFactors, refNoiseRaw, tgtNoiseRaw);
            if (!weightResults){
                return nsgStatus.setError(null, "Incompatible NOISExx data. For example, comparing CFA->G with CFA->B.");
            }
        } else {
            weightResults = calcNoiseAndWeight(tgtImage, refNoise.MRS, refNoise.KSigma, nChannels);
        }
        noiseValues = weightResults.noiseValues;
        signalToNoise = weightResults.signalToNoise;
        weights = weightResults.weights;
        averageWeight = weightResults.averageWeight;
        let weightType = weightResults.weightType;
        let weightStr = data.noiseWeightKeyword + ": " + weightResults.averageWeight.toFixed(3);
        resultString += ", " + weightStr;  
        
        resultString += ", SNR: ";
        for (let c=0; c < signalToNoise.length; c++){
            if (c){
                resultString += ", ";
            }
            let snr = signalToNoise[c];
            if (snr){
                resultString += snr.toFixed(4);
            }
        }
        
        if (!data.createXnml || data.writeNormalized){
            let imageMaximum = tgtImage.maximum();
            if (!data.createXnml){
                let imageMinimum = tgtImage.minimum();
                let truncation;
                if (imageMinimum < -0.005 && imageMaximum > 1.005){
                    truncation = ", Truncating (" + imageMinimum.toPrecision(2) + ", " + imageMaximum.toPrecision(3) + ") to (0, 1)";
                } else if (imageMinimum < -0.005){
                    truncation = ", Truncating " + imageMinimum.toPrecision(2) + " to 0";
                } else if (imageMaximum > 1.005){
                    truncation = ", Truncating " + imageMaximum.toPrecision(3) + " to 1";
                }
                if (truncation){
                    resultString += truncation;
                }
            }
            let replaceHdr = nsgHeadersExist(keywords);
            let fitsHeader = new FitsHeader();
            fitsHeader.fitsHeaderRefFilename(keywords, File.extractName(refFile), replaceHdr);
            fitsHeader.fitsHeaderGradient(keywords, data);
            fitsHeader.fitsHeaderNoise(keywords, noiseValues, weightType);
            fitsHeader.fitsHeaderMaxValue(keywords, imageMaximum, replaceHdr);
            fitsHeader.fitsHeaderScale(keywords, scaleFactors, replaceHdr);
            fitsHeader.fitsHeaderSignalToNoise(keywords, signalToNoise, replaceHdr);
            fitsHeader.fitsHeaderNoiseWeight(keywords, data.noiseWeightKeyword, averageWeight, weightType, replaceHdr);
            tgtImageData.keywords = keywords;
            normalizedFilename = saveNormalizedFile(tgtImage, tgtImageData, data, averageWeight);
            if (!File.exists(normalizedFilename)){
                return nsgStatus.setError(null, "Failed to save normalized image:\n" + normalizedFilename);
            }
        }
        
        if (data.createXnml || data.displayGradient){
            xnmlFile = saveGradientFile(refFile, tgtFile, gradientImages, gradSamples, data, 
                    scaleFactors, weights, averageWeight);
            if (data.createXnml){
                LNFile = createXnmlFilename(data, averageWeight);
            }
        }
        if (data.csvFile){
            csvFile.addTgt(tgtFile, averageWeight, scaleFactors, refNoiseRaw, signalToNoise, tgtHeaderEntries, LNFile);
        }
        if (weightResults.weightType === COMPARING_MRS_KSIGMA){
            resultString += " WARNING: Comparing MRS with KSigma noise estimates is less accurate. Try increasing exposure time.";
        }
    } else {
        // Tgt was ref file
        let imageMaximum = tgtImage.maximum();
        averageWeight = 1.0;
        let weightStr = data.noiseWeightKeyword + ": 1.0";
        let scale = {m:1.0, b:0};
        let pedestals;
        let weights;
        if (data.cache.isColor()){
            scaleFactors = [scale, scale, scale];
            signalToNoise = [1, 1, 1];
            weights = [1, 1, 1];
            pedestals = [0, 0, 0];
        } else {
            scaleFactors = [scale];
            signalToNoise = [1];
            weights = [1];
            pedestals = [0];
        }
        resultString += ", " + weightStr + ", SNR: 1.0";
        if (!data.createXnml || data.writeNormalized){
            let replaceHdr = nsgHeadersExist(keywords);
            keywords.push(new FITSKeyword("HISTORY", "", "NSG.reference"));
            let fitsHeader = new FitsHeader();
            fitsHeader.fitsHeaderGradient(keywords, data);
            fitsHeader.fitsHeaderMaxValue(keywords, imageMaximum, replaceHdr);
            fitsHeader.fitsHeaderScale(keywords, scaleFactors, replaceHdr);
            fitsHeader.fitsHeaderSignalToNoise(keywords, signalToNoise, replaceHdr);
            if (refNoiseRaw){
                let refNoiseValues = [];
                for (let i=0; i<refNoiseRaw.noise.length; i++){
                    if (refNoiseRaw.noise[i]){
                        refNoiseValues.push(refNoiseRaw.noise[i]);
                    }
                }
                fitsHeader.fitsHeaderNoise(keywords, refNoiseValues, "NOISExx");
            }
            let tmpArray = [];
            tmpArray[0] = refNoise.MRS[0];
            fitsHeader.fitsHeaderNoise(keywords, tmpArray, "noiseMRS");
            tmpArray[0] = refNoise.KSigma[0];
            fitsHeader.fitsHeaderNoise(keywords, tmpArray, "noiseKSigma");
            fitsHeader.fitsHeaderNoiseWeight(keywords, data.noiseWeightKeyword, averageWeight, "", replaceHdr);
            tgtImageData.keywords = keywords;
            normalizedFilename = saveNormalizedFile(tgtImage, tgtImageData, data, averageWeight);
            if (!File.exists(normalizedFilename)){
                return nsgStatus.setError(null, "Failed to save normalized image:\n" + normalizedFilename);
            }
        } else {
            // don't need to add the normalized filename to ImageIntegration
        }
        
        if (data.createXnml || data.displayGradient){
            let refRect = new Rect(tgtImage.width, tgtImage.height);
            for (let c=0; c<nChannels; c++){
                gradientImages[c] = createGradientImage(refRect, true, undefined, MIN_GRADIENT_INC, false);
                if (!gradientImages[c] || !gradientImages[c].smallImage){
                    return nsgStatus.setError(null, "Failed to create gradient image.");
                }
                gradientImages.push(gradientImages[c]);
            }
            xnmlFile = saveGradientFile(refFile, tgtFile, gradientImages, gradSamples, data,
                    scaleFactors, weights, averageWeight);
            if (!File.exists(xnmlFile)){
                return nsgStatus.setError(null, "Failed to save ref gradient file:\n" + xnmlFile);
            }
            if (data.createXnml){
                LNFile = createXnmlFilename(data, averageWeight);
            }
        }
        if (data.csvFile){
            csvFile.addRef(refFile, averageWeight, scaleFactors, refNoiseRaw, signalToNoise, tgtHeaderEntries, LNFile);
        }
    }
    for (let c = 0; c < nChannels; c++){
        if (gradientImages[c]){
            if (gradientImages[c].image){
                gradientImages[c].image.free();
            }
            if (gradientImages[c].smallImage){
                gradientImages[c].smallImage.free();
            }
        }
    }
    return new Result(resultString, tgtFile, false, normalizedFilename, 
            averageWeight, scaleFactors, signalToNoise, nPhotStars, 
            tgtHeaderEntries, xnmlFile, LNFile, isRef);
}

/** Average transmission
 * @param {LinearFitData[]} scaleFactors
 * @returns {Number} Average transmission (1/scaleFactor[c].m)
 */
function avgTransmission(scaleFactors){
    if (scaleFactors.length === 1){
        return 1/scaleFactors[0].m;
    }
    return (1/scaleFactors[0].m + 1/scaleFactors[1].m + 1/scaleFactors[2].m)/3;
}

/**
 * Get weights and calculate SNR, Weights and Average weight.
 * @param {LinearFitData} scaleFactors
 * @param {Noise} refNoiseRaw
 * @param {Noise} tgtNoiseRaw
 * @returns {noiseValues:, signalToNoise:, weights:, averageWeight:, weightType} undefined if ref and tgt noise value is missing
 */
function calcWeight(scaleFactors, refNoiseRaw, tgtNoiseRaw){
    let nChannels = scaleFactors.length;
    let nWeights = 0;
    let signalToNoise = [];
    let noiseValues = [];
    let weights = [];
    let averageWeight = 0;
    let weightType = "NOISExx";
    for (let c=0; c<nChannels; c++){
        let index = refNoiseRaw.index !== -1 ? refNoiseRaw.index : c;
        if (refNoiseRaw.type[index] !== tgtNoiseRaw.type[index]){
            weightType = COMPARING_MRS_KSIGMA;
        }
        signalToNoise[c] = refNoiseRaw.getSignalToNoise(refNoiseRaw, tgtNoiseRaw, index, scaleFactors[c].m);
        weights[c] = refNoiseRaw.getWeight(signalToNoise[c]);
        if (weights[c]){
            noiseValues[c] = tgtNoiseRaw.noise[index];
            nWeights++;
            averageWeight += weights[c];
//          if (refNoiseRaw.index === -1 && c ===1){
//              // Green channel is from two pixels, so double its contribution
//          }
        }
    }
    if (nWeights === 0){
        return undefined;
    }
    averageWeight /= nWeights;
    return {noiseValues: noiseValues, signalToNoise: signalToNoise, weights: weights, averageWeight: averageWeight,
        weightType: weightType};
}

/**
 * Calculate weights when NOISExx is not available
 * @param {Image} tgtImage Normalized target image
 * @param {Number[]} refNoiseMRS    Noise value stored at [0], value at [1] provides information about the estimate.
 * @param {Number[]} refNoiseKSigma Noise value stored at [0], value at [1] provides information about the estimate.
 * @param {Number} nChannels
 * @returns {noiseValues:, signalToNoise:, weights:, averageWeight:, weightType:}
 */
function calcNoiseAndWeight(tgtImage, refNoiseMRS, refNoiseKSigma, nChannels){
    let signalToNoise = [];
    let noiseValues = [];
    let weights = [];
    let weightType;
    
    // Using corrected target image, so no need to apply a scale factor
    let useNoiseKSigma = true;
    if (refNoiseMRS[0] > 0 && refNoiseMRS[1] > 0.01){
        let tgtNoiseMRS = tgtImage.noiseMRS();
        if (tgtNoiseMRS[0] > 0 && tgtNoiseMRS[1] > 0.01){
            useNoiseKSigma = false;
            noiseValues[0] = tgtNoiseMRS[0];
            signalToNoise[0] = refNoiseMRS[0] / tgtNoiseMRS[0];
            weightType = "noiseMRS";
        }
    }
    if (useNoiseKSigma){
        let tgtNoiseKSigma = tgtImage.noiseKSigma();
        noiseValues[0] = tgtNoiseKSigma[0];
        if (tgtNoiseKSigma[0]){
            signalToNoise[0] = refNoiseKSigma[0] / tgtNoiseKSigma[0];
        } else {
            signalToNoise[0] = 0;
        }
        weightType = "noiseKSigma";
    }
    let averageWeight = Math.pow( signalToNoise[0], 2 );
    for (let c=0; c<nChannels; c++){
        weights[c] = averageWeight;
    }
    return {noiseValues: noiseValues, signalToNoise: signalToNoise, weights: weights, averageWeight: averageWeight, 
        weightType: weightType};
}

/**
 * Constructor. Stores all the CSV lines, and writes them to a file.
 * @param {NsgData} data
 * @param {String} outputDir
 * @returns {NsgCsvFile}
 */
function NsgCsvFile(data, outputDir){
    /**
     * Represents a single CSV line.
     * @param {String} inputFile
     * @param {Number} weight
     * @param {LinearFitData[]} scaleFactors
     * @param {Noise} refNoise
     * @param {Number[]} signalToNoise
     * @param {HeaderEntries} headerEntries
     * @param {String} LNFile
     * @returns {NsgCsvFile.CsvData}
     */
    function CsvData (inputFile, weight, scaleFactors, refNoise, signalToNoise, headerEntries, LNFile){
        this.scaleFactors = [];
        this.noiseArray = [];
        this.noiseRelativeArray = [];
        this.snrArray = [];
        this.inputFile = inputFile;
        this.weight = weight;
        this.headerEntries = headerEntries;
        this.LNFile = LNFile;
        for (let c=0; c<scaleFactors.length; c++){
            this.scaleFactors[c] = 1/scaleFactors[c].m;
            let rawNoise = headerEntries.getNoise();
            if (rawNoise){
                let index = rawNoise.index !== -1 ? rawNoise.index : c;
                if (rawNoise.noise[index]){
                    this.noiseArray[c] = rawNoise.noise[index];
                    if (refNoise && refNoise.noise[index] && refNoise.type[index] === rawNoise.type[index]){
                        this.noiseRelativeArray[c] = rawNoise.noise[index] / refNoise.noise[index];
                    }
                }
            }
            this.snrArray[c] = signalToNoise[c];
        }
        let self = this;
        
        /**
         * CsvData values must be set before calling this method.
         * @param {Number} nthLine 
         * @returns {String} A CSV line
         */
        this.createLine = function (nthLine){
            let filter = self.headerEntries.getFilter();
            let altitude = self.headerEntries.ALTITUDE ? self.headerEntries.ALTITUDE : "";
            let airmass = self.headerEntries.AIRMASS ? self.headerEntries.AIRMASS : "";
            let exposure = self.headerEntries.EXPOSURE ? self.headerEntries.EXPOSURE : "";
            let dateObs = self.headerEntries.DATE_OBS ? self.headerEntries.DATE_OBS : "";
            let regExp = /,/g;
            let encodedInputFile = self.inputFile.replace(regExp, ' ');
            let encodedLnFile = self.LNFile ? self.LNFile.replace(regExp, ' ') : "";
            let line = encodedInputFile + "," + (nthLine + 1) + "," + self.weight + ",";
            for (let c=0; c<self.scaleFactors.length; c++){
                line += self.snrArray[c] ? self.snrArray[c] : "";
                line += ",";
                line += self.scaleFactors[c] + ",";
                line += self.noiseRelativeArray[c] ? self.noiseRelativeArray[c] : "";
                line += ",";
                line += self.noiseArray[c] ? self.noiseArray[c] : "";
                line += ",";
            }
            line += altitude + "," + airmass + "," + exposure + "," + filter + "," + dateObs + "," + encodedLnFile;
            return line;
        };
    }
//    let csvDataRef;
    let csvDataArray = [];
    
    /** Add reference (currenlty the same as addTgt)
     * @param {String} inputFile
     * @param {Number} weight
     * @param {LinearFitData[]} scaleFactors
     * @param {Noise} refNoise
     * @param {Number[]} signalToNoise
     * @param {HeaderEntries} headerEntries
     * @param {String} LNFile
     */
    this.addRef = function(inputFile, weight, scaleFactors, refNoise, signalToNoise, headerEntries, LNFile){
        // csvDataRef = new CsvData(inputFile, weight, scaleFactors, refNoise, signalToNoise, headerEntries);
        csvDataArray.push(new CsvData(inputFile, weight, scaleFactors, refNoise, signalToNoise, headerEntries, LNFile));
    };
    
    /** Add a target to the csvDataArray
     * @param {String} inputFile
     * @param {Number} weight
     * @param {LinearFitData[]} scaleFactors
     * @param {Noise} refNoise
     * @param {Number[]} signalToNoise
     * @param {HeaderEntries} headerEntries
     * @param {String} LNFile
     */
    this.addTgt = function(inputFile, weight, scaleFactors, refNoise, signalToNoise, headerEntries, LNFile){
        csvDataArray.push(new CsvData(inputFile, weight, scaleFactors, refNoise, signalToNoise, headerEntries, LNFile));
    };
    
    /**
     * @param {Boolean} sortByWeight
     */
    this.writeCsv = function(sortByWeight) {
        if (!csvDataArray.length){
            return;
        }
        let csvFilename;
        try {
            let isColor = csvDataArray[0].scaleFactors.length > 1;
            let csvFile = new File();
            csvFilename = outputDir;
            if ( !csvFilename.endsWith( '/' ) ){
                csvFilename += '/';
            }
            csvFilename += "NSG_CSV_" + getDateString() + ".txt";
            csvFile.createForWriting( csvFilename );

            let hdr = "File, #, NWEIGHT, ";
            if (isColor){
                hdr += "SNR(R), Scale(R), Noise(R)/Ref, Noise(R), SNR(G), Scale(G), Noise(G)/Ref, Noise(G), SNR(B), Scale(B), Noise(B)/Ref, Noise(B), ";
            } else {
                hdr += "SNR, Scale, Noise/Ref, Noise,";
            }
            hdr += "Altitude, Airmass, Exposure, Filter, DATE-OBS, xnml file";
            csvFile.outTextLn(hdr);

//            if (csvDataRef){
//                csvFile.outTextLn(csvDataRef.createLine());
//            }
            
            if (sortByWeight){
                csvDataArray.sort(compareResultWeight);
            } else {
                csvDataArray.sort(compareResultObsDate);
            }
            
            let refFilename = data.cache.getRefFilename();
            if (refFilename && !nsgTgtResults.has(refFilename)){
                // Reference image was not included in target list
                let regExp = /,/g;
                csvFile.outTextLn(refFilename.replace(regExp, ' ') + ",0,Reference not in target list");
            }
            for (let i=0; i < csvDataArray.length; i++) {
                let csvData = csvDataArray[i];
                csvFile.outTextLn(csvData.createLine(i));
            }
            csvFile.close();
        } catch (fileExeption){
            logError(fileExeption);
            console.criticalln("** ERROR writing NSG CSV file " + csvFilename);
            console.criticalln(fileExeption);
        }
    };
}

/**
 * @param {NsgData} data
 * @param {String} templateFilename If data.outputDir is unspecified, get path from templateFilename
 * @returns {undefined|String} output directory
 */
function getOutputDir(data, templateFilename){
    let outputDir;
    if (!data.outputDir || !data.outputDir.trim().length){
        // data.outputDir is undefined or empty
        if (templateFilename && templateFilename.trim().length) {
            outputDir = File.extractDrive( templateFilename ) + File.extractDirectory( templateFilename );
        } // else outputDir is left undefined
    } else if (data.outputDir.startsWith(".")){
        try {
            outputDir = File.extractDrive( templateFilename ) + File.extractDirectory( templateFilename );
            if ( !outputDir.endsWith( '/' ) ){
                outputDir += '/';
            }
            if (data.outputDir.startsWith("./") || data.outputDir.startsWith(".\\")){
                outputDir += data.outputDir.substring(2);
            } else {
                outputDir += data.outputDir.substring(1);
            }
            if (!File.directoryExists( outputDir )){
                File.createDirectory(outputDir);
            }
        } catch (error){
            logError(error);
        }
    } else {
        outputDir = data.outputDir;
    }
    if (!outputDir || !File.directoryExists( outputDir )){
        console.criticalln("** ERROR: Invalid output directory: '", outputDir, "'");
        return undefined;
    }
    if ( !outputDir.endsWith( '/' ) ){
        outputDir += '/';
    }
    return outputDir;
}

/**
 * Returns the "NsgData" sub directory for CSV, Results and log files. If it doesn't exist, it is created.
 * @param {NsgData} data
 * @param {String} templateFilename If data.outputDir is unspecified, get path from templateFilename
 * @returns {String} "NsgData" sub directory
 */
function getNsgDataDir(data, templateFilename){
    let outputDir = getOutputDir(data, templateFilename);
    outputDir += "NsgData";
    if (!File.directoryExists( outputDir )){
        File.createDirectory(outputDir);
    }
    outputDir += "/";
    return outputDir;
}

/**
 * Formats weight into w101, or w075, or w007
 * @param {Number} averageWeight
 * @returns {String}
 */
function createWeightString(averageWeight){
    let weightStr;
    let prefixPercent = Math.round(averageWeight * 100);
    if (prefixPercent < 10){
        weightStr = "w00" + prefixPercent;
    } else if (prefixPercent < 100){
        weightStr = "w0" + prefixPercent;
    } else {
        weightStr = "w" + prefixPercent;
    }
    return weightStr;
}

/**
 * Specify the full filename of the '.xnml' file that NSGXnml will create
 * @param {NsgData} data
 * @param {Number} averageWeight
 * @returns {String|undefined} Local Normalization '.xnml' full filename
 */
function createXnmlFilename(data, averageWeight){
    let tgtFilename = data.cache.getTgtFilename();
    let outputDir = getOutputDir(data, tgtFilename);
    if ( !outputDir ){
        return undefined;
    }
    let postfix = data.weightPrefix ? "_" + createWeightString(averageWeight) : "";
    let xnmlFilename = outputDir + File.extractName(tgtFilename) + data.outputPostFix + postfix + ".xnml";
    return makeFilenameUnique(xnmlFilename, data.overwrite);
}

/**
 * @param {NsgData} data
 * @param {Number} averageWeight
 * @returns {String|undefined} full filename for normalized file (not unique)
 */
function createNormalizedFilename(data, averageWeight){
    let tgtFilename = data.cache.getTgtFilename();
    let outputDir = getOutputDir(data, tgtFilename);
    if ( !outputDir ){
        return undefined;
    }
    let prefix = data.weightPrefix ? createWeightString(averageWeight) + "_" : "";
    return outputDir + prefix + File.extractName(tgtFilename) + data.outputPostFix + defaultExtension;
}

/**
 * If the file already exists, and overwrite is false, Appends '_N'
 * Otherwise, it returns the original filename
 * @param {String} filename
 * @param {Boolean} overwrite
 * @returns {String}
 */
function makeFilenameUnique(filename, overwrite){
    if (File.exists(filename) && !overwrite){
        for ( let u = 1; ; ++u ){
            let tryFilePath = File.appendToName(filename, '_' + u.toString());
            if (!File.exists(tryFilePath)){
                return tryFilePath;
            }
        }
    }
    return filename;
}

/**
* @param {String} inputFilename
* @param {String} subFolderName sub folder name without path (for example, "NSG_Reject")
* @returns {String} subFolder full filename
*/
function createSubFolder(inputFilename, subFolderName){
    let dir = File.extractDrive( inputFilename ) + File.extractDirectory( inputFilename );
    if ( !dir.endsWith( '/' ) ){
       dir += '/';
    }
    dir += subFolderName;
    if (!File.directoryExists(dir)){
       File.createDirectory( dir );
    }
    return dir;
}

/**
 * Create a subfolder if it does not already exist, and move a file to it
 * @param {String} inputFilename
 * @param {String} subFolderName sub folder name without path (for example, "NSG_Reject")
 * @param {String} text Prefix console output
 */
function moveFile(inputFilename, subFolderName, text){
    let dir = createSubFolder(inputFilename, subFolderName);
    let name = File.extractName(inputFilename);
    let outputFile = dir + "/" + name + File.extractSuffix(inputFilename);
    outputFile = makeFilenameUnique(outputFile, false);
    console.writeln(text, outputFile);
    File.move(inputFilename, outputFile);
}

/**
 * @param {Image} image
 * @param {ImageData} imageData 
 * @param {NsgData} data
 * @param {Number} averageWeight
 * @returns {String|undefined} full filename
 * @throws {Error}
 */
function saveNormalizedFile(image, imageData, data, averageWeight){
    let outputFile = createNormalizedFilename(data, averageWeight);
    if ( !outputFile ){
        return undefined;
    }
    outputFile = makeFilenameUnique(outputFile, data.overwrite);
    image.truncate(); // remove any negative values
    saveImage(outputFile, "no-warnings verbosity 0", image, imageData);
    return outputFile;
}

/**
 * @param {String} outputFile
 * @param {String} outputHints "no-warnings verbosity 0" or "compression-codec zlib no-warnings verbosity 0"
 * @param {Image} image
 * @param {ImageReader.ImageData} imageData
 * @throws {Error} 
 */
function saveImage(outputFile, outputHints, image, imageData){
    let fileFormatInst = new FileFormatInstance( defaultOutputFileFormat );
    if ( fileFormatInst.isNull )
        throw new Error( "Unable to instantiate file format: " + defaultOutputFileFormat.name );

    if ( !fileFormatInst.create( outputFile, outputHints ) )
        throw new Error( "Error creating output file: " + outputFile );

    let imageDescription = 
        imageData.imageDescription ? new ImageDescription(imageData.imageDescription) : new ImageDescription();
    imageDescription.bitsPerSample = image.bitsPerSample;
    imageDescription.ieeefpSampleFormat = image.isReal;
    if ( !fileFormatInst.setOptions( imageDescription ) )
        throw new Error( "Unable to set output file options: " + outputFile );

    if ( imageData.iccProfile !== undefined )
        fileFormatInst.iccProfile = imageData.iccProfile;
    if ( imageData.keywords !== undefined )
        fileFormatInst.keywords = imageData.keywords;
    if ( imageData.metadata !== undefined )
        fileFormatInst.metadata = imageData.metadata;
//    if ( imageData.thumbnail !== undefined )
//        fileFormatInst.thumbnail = imageData.thumbnail;

    if ( imageData.imageProperties !== undefined ){
        for (let p of imageData.imageProperties){
//            console.noteln("writing property ", p.id, ", ", p.value);
            fileFormatInst.writeImageProperty(p.id, p.value, p.type);
        }
    }

    if ( !fileFormatInst.writeImage( image ) )
        throw new Error( "Error writing output file: " + outputFile );

    fileFormatInst.close();
    checkSavedFile(outputFile, MIN_IMAGE_SIZE);
}

/**
 * @param {String} outputFile Check if this file exists, and is bigger than minSize
 * @param {Number} minSize minimum allowed filesize
 * @throws {Error} If file does not exist or is too small
 */
function checkSavedFile(outputFile, minSize){
    let fileInfo = new FileInfo(outputFile);
    if (!fileInfo.exists){
        throw new Error("File I/O: Failed to save image: " + outputFile);
    }
    if (fileInfo.size < minSize){
        throw new Error("File I/O: Saved image is too small [" + fileInfo.size + " bytes]: " + outputFile);
    }
}

/**
 * @param {NsgData} data
 * @param {String} file display free disk space for this file's directory
 */
function displayDiskSpace(data, file){
    let dir = getOutputDir(data, file);
    let space = File.getAvailableSpace(File.extractDrive(dir) + File.extractDirectory(dir));
    space /= 1000000000;    // GB (not GiB)
    space = space.toFixed(3);
    console.writeln("Free disk space: ", space, " GB");
};

/**
 * Returned filename will start with prependText + colorLabel + "_"
 * If the filename is not unique and overwrite has not been specified, _N postfix is added.
 * The extension will be changed to .xisf
 * @param {String} filename
 * @param {String} prependText
 * @param {Boolean} overwrite
 * @returns {String} The new filename
 */
function prependFilename(filename, prependText, overwrite){
    let outputFile = File.prependToName( filename, prependText + "_" );
    outputFile = File.changeExtension( outputFile, ".xisf" );
    return makeFilenameUnique(outputFile, overwrite);
}

/**
 * Saves image as a .xisf file, with FITS headers for ref image and gradient smoothing.
 * Filename will start with prefix + "_"
 * If the filename is not unique and overwrite has not been specified, _N postfix is added.
 * The extension will be changed to .xisf
 * @param {String} refFile 
 * @param {String} tgtFile 
 * @param {Image[]} gradientImages
 * @param {TypedArray} sampleBuffer Temporary buffer for reading and writing samples.
 * @param {NsgData} data
 * @param {LinearFitData[]} scaleFactors
 * @param {Number[]} weights Weight for current channel
 * @param {Number} averageWeight
 * @returns {String} The filename of the saved file
 * @throws {Error} Failed to write file errors
 */
function saveGradientFile(refFile, tgtFile, gradientImages, sampleBuffer, data, scaleFactors, weights, averageWeight){
    let gradientImage;
    let isColor = data.cache.isColor();
    let nChannels = isColor ? 3 : 1;
    let gradientPedestals = [];
    if (isColor){
        // Create new color image
        let w = gradientImages[0].smallImage.width;
        let h = gradientImages[0].smallImage.height;
        let rect = new Rect(w, h);
        if (sampleBuffer.length < rect.area) 
            throw new Error("NSG logic error, samplesBuffer is too small: " + sampleBuffer.length + ", w x h: " + w + " x " + h);

        gradientImage = new Image(w, h, 3, ColorSpace_RGB );
        for (let c=0; c<nChannels; c++){
            // Copy each grey image into each channel
            let srcImage = gradientImages[c].smallImage;
            srcImage.getSamples(sampleBuffer, rect, 0);
            gradientImage.setSamples(sampleBuffer, rect, c);
            gradientPedestals[c] = gradientImages[c].pedestal;
        } 
    }
    else {
        // Reuse existing grey smallImage
        gradientImage = gradientImages[0].smallImage;
        gradientPedestals[0] = gradientImages[0].pedestal;
    }
    let gradientResample = gradientImages[0].resample;
    let outputFile = createNormalizedFilename(data, averageWeight);
    if ( !outputFile ){
        return undefined;
    }
    outputFile = prependFilename(outputFile, "gradient", data.overwrite);
    
    /**
     * @param {NsgData} data
     * @param {String} refFile
     * @param {String} tgtFile
     * @param {LinearFitData[]} scaleFactors
     * @param {Number[]} weights
     * @param {Number} averageWeight
     * @param {type} gradientResample
     * @param {Number[]} gradientPedestals
     * @returns {FITSKeyword[]}
     */
    function createKeyWords(data, refFile, tgtFile, scaleFactors, weights, averageWeight, gradientResample, gradientPedestals){
        let isColor = data.cache.isColor();
        let weightKeyword = data.noiseWeightKeyword;
        let keywords = [];
        let fitsHdr = new FitsHeader();
        fitsHdr.fitsHeaderGradient(keywords, data);
        fitsHdr.fitsHeaderRefAndTgt(keywords, refFile, tgtFile);
        fitsHdr.fitsHeaderDimension(keywords, data.cache.getRefImage());
        keywords.push(new FITSKeyword("NSGPSTFX", data.outputPostFix, "NSG.postfix"));
        let weightStr = data.weightPrefix ? "_" + createWeightString(averageWeight) : "";
        keywords.push(new FITSKeyword("NSGWSTR", weightStr, "NSG.weight string"));
        keywords.push(new FITSKeyword("NSGRESIZ", gradientResample.toString(), "NSG.resize"));
        keywords.push(new FITSKeyword("NSGWKEY", weightKeyword, "NSG.weight keyword"));
        if (isColor && weightKeyword.length === 8){
            weightKeyword = weightKeyword.slice(0, 7); // The eight character will become 0, 1 or 2
        }
        for (let c=0; c<nChannels; c++){
            keywords.push(new FITSKeyword("NSGPLUS" + c, gradientPedestals[c].toPrecision(9), "NSG.pedestal"));
            let inverse = 1 / scaleFactors[c].m;
            keywords.push(new FITSKeyword("NSGS" + c, inverse.toPrecision(5), "NSG.scale"));
            let wKey = isColor ? weightKeyword + c : weightKeyword;
            let weight = weights[c] ? weights[c] : 0;
            keywords.push(new FITSKeyword(wKey, weight.toPrecision(5), "NSG.weight"));
        }
        return keywords;
    }
    let keywords = createKeyWords(data, refFile, tgtFile, scaleFactors, weights, averageWeight, gradientResample, gradientPedestals);

    let outputHints = "no-warnings verbosity 0";
    saveImage(outputFile, outputHints, gradientImage, {keywords:keywords});
    
    if (isColor){
        gradientImage.free();
    }
    return outputFile;
}

/**
 * @param {Number} duration
 * @returns {String}
 */
function msToTime(duration) {
    let milliseconds = duration % 1000,
    seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor(duration / (1000 * 60 * 60));
    if (hours > 0){
        return hours + " hours, " + minutes + " minutes";
    }
    if (minutes > 0){
        return minutes + " minutes " + seconds + " seconds";
    }
    if (seconds > 9){
        return seconds + " s";
    }
    if (seconds > 0){
        return seconds + "." + (Math.round(milliseconds/10)) + " s";
    }
    return milliseconds + " ms";
}

/**
 * @param {Number} startTime
 * @returns {String}
 */
function getElapsedTime(startTime) {
    return msToTime(new Date().getTime() - startTime);  
}

/**
 * Noise read from FITS headers NOISEXX, NOISEAXX
 * @param {Number[]} noise Noise estimate for each channel. RGB have 3 entries, CFA only one but may be at index 0, 1 or 2
 * @param {String[]} type Noise estimate type for each channel. RGB 3 entries, CFA only one at 0, 1 or 2
 * @param {Number} index Index to the defined noise entry, or -1 if RGB. Take care!
 */
function Noise(noise, type, index){
    this.noise = noise;
    this.type = type;
    this.index = index;
    
    /**
     * @param {Noise} refNoise
     * @param {Noise} tgtNoise
     * @param {Number} index This index must NOT be -1. Noise.index needs interpreting.
     * @param {Number} scaleFactor
     * @returns {undefined|Number}
     */
    this.getSignalToNoise = function(refNoise, tgtNoise, index, scaleFactor){
        if (index < 0) throw new Error("NSG logic error");
        if (refNoise && tgtNoise && refNoise.noise[index] && tgtNoise.noise[index]){
            return refNoise.noise[index] / (tgtNoise.noise[index] * scaleFactor);
        } 
        return undefined;
    };
    /**
     * @param {Number} signalToNoise
     * @returns {undefined|Number}
     */
    this.getWeight = function(signalToNoise){
        if (signalToNoise){
            return Math.pow( signalToNoise, 2 );
        } 
        return undefined;
    };
}

/**
 * Sort in ascending filename order (NSG input filename, full path)
 * @param {Result} a
 * @param {Result} b
 * @returns {Number}
 */
function compareResultObsDate(a, b){
    if (a.headerEntries.DATE_OBS && b.headerEntries.DATE_OBS){
        if (a.headerEntries.DATE_OBS < b.headerEntries.DATE_OBS){
            return -1;
        }
        if (a.headerEntries.DATE_OBS > b.headerEntries.DATE_OBS){
            return 1;
        }
        // If DATE-OBS are equal, fall back on the full filename
    }
    if (a.inputFile < b.inputFile){
        return -1;
    }
    if (a.inputFile > b.inputFile){
        return 1;
    }
    return 0;
}

/**
 * Sort in descending weight order
 * @param {Result} a
 * @param {Result} b
 * @returns {Number}
 */
function compareResultWeight(a, b){
    return b.weight - a.weight;
}

/**
 * Add NWEIGHT to the input image. This is necessary when using xnml files because 
 * ImageIntegration reads the original input images, not the corrected nsg images.
 * @param {NsgData} data
 * @param {Result} result
 * @param {NsgStatus} nsgStatus
 * @return {Boolean} True if file was found
 */
function addWeightToInputFile(data, result, nsgStatus){
    let inputFile = result.inputFile;
    if (File.exists(inputFile)){
        if (isPSFScaleSnrAvailable){
            // No need to modify the input file; NWEIGHT will not be used.
            return true;
        } 
        console.warningln("** Warning: update NSGXnml to 1.04 or later. ",
                "Using inefficient compatibility code which massively increases file I/O.");
        let imageWindows = ImageWindow.open(inputFile, "tmp", "no-warnings verbosity 0");
        let imageWindow = imageWindows[0];
        let keywords = imageWindow.keywords;
        let fitsHeader = new FitsHeader();
        let scaleUpdated = fitsHeader.fitsHeaderScale(keywords, result.scaleFactors, true);
        let snrUpdated = fitsHeader.fitsHeaderSignalToNoise(keywords, result.snr, true);
        let noiseUpdated = fitsHeader.fitsHeaderNoiseWeight(keywords, data.noiseWeightKeyword, result.weight, "", true);
        if (noiseUpdated || scaleUpdated || snrUpdated){
            fitsHeader.fitsHeaderRefFilename(keywords, File.extractName(data.cache.getRefFilename()), true);
            // NWEIGHT or NSGSx was modified or added
            imageWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
            imageWindow.keywords = keywords;
            imageWindow.mainView.endProcess();
            try {
                // Save a copy of the reference file
                let backupName = File.appendToName(inputFile, "_backup");
                if (!File.exists(backupName))
                    File.move(inputFile, backupName);
                imageWindow.saveAs(inputFile, false/*queryOptions*/, false/*allowMessages*/,
                        false/*strict*/, false/*verifyOverwrite*/, "no-warnings verbosity 0");
                console.noteln("Added ", data.noiseWeightKeyword, " FITS header to:" );
                console.noteln(inputFile);
                File.remove(backupName);
            } catch (fileException){
                nsgStatus.setError(fileException, "Failed to add weight to input file");
                imageWindow.forceClose();
                result.failed = true;
                result.summary = "Failed to add weight to input file [" + inputFile + "]";
                return false;
            }
        }
        imageWindow.purge();
        imageWindow.forceClose();
        return true;
    }
    nsgStatus.setError(null, "Input file does not exist!");
    result.failed = true;
    result.summary = "Input file does not exist! [" + result.LNFile + "]";
    return false;
}

/**
 * @param {String} message
 * @param {Boolean} showErrorDialog
 */
function displayError(message, showErrorDialog){
    if (showErrorDialog){
        (new MessageBox(message, TITLE, StdIcon_Error, StdButton_Ok)).execute();
    } else {
        console.criticalln(message);
    }
}

/**
 * @param {NsgData} data
 * @param {String} refFilename 
 * @param {Boolean} showErrorDialog
 * @returns {Boolean} False if one or more checks failed
 */
function preRunChecks(data, refFilename, showErrorDialog){
    // User must select a reference view and one or more targets
    if (!data.cache.getRefFilename()){
        displayError("A reference image must be specified.", showErrorDialog);
        return false;
    }
    if (!data.targetFiles.length) {
        displayError("At least one target image must be specified.", showErrorDialog);
        return false;
    }
    if (data.overwrite && data.writeNormalized && 
            !(data.weightPrefix || (data.outputPostFix && data.outputPostFix.trim().length))){
        displayError("** ERROR: <b>'Overwrite existing files'</b> has been specified without a <b>'Postfix'</b>.", showErrorDialog);
        return false;
    }
    if (!getOutputDir( data, refFilename)){
        displayError("Please specify a valid output directory.", showErrorDialog);
        return false;
    }
    return true;
}

/**
 * call data.cache.setTgtFilename() before using this method.
 * @param {NsgData} data
 * @param {Image} refImage
 * @param {Image} tgtImage
 * @param {String} targetFile 
 * @returns {String | null} Error message or null for no errors.
 */
function targetErrorChecks(data, refImage, tgtImage, targetFile){
    if (!tgtImage){
        return "Failed to load image.";
    }
    if (tgtImage.isColor !== refImage.isColor) {
        return "Color depth must match the reference image.";
    }
    if (tgtImage.width !== refImage.width || tgtImage.height !== refImage.height) {
        return "Unexpected image dimensions: " + tgtImage.width + " x " + tgtImage.height;
    }
    let outputDir = getOutputDir(data, targetFile);
    if (!outputDir){
        return "Invalid output directory: '" + outputDir + "'";
    }
    return null;
}

/**
 * @param {NsgData} data
 * @returns {NsgStatus}
 */
function NsgStatus(data){
    let aborted = false;
    let errors = false;
    let newError = false;
    let self = this;
    let targetFile;
    this.errorMessages = [];
    this.warnings = [];
    /**
     * @param {String} target image filename
     */
    this.setTargetFilename = function(target){
        targetFile = target;
        newError = false;
    };
    /**
     * @returns {Boolean} True if aborted
     */
    this.isAborted = function(){
        return aborted;
    };
    /**
     * @returns {Boolean} True if this or other targets had errors.
     */
    this.hasErrors = function(){
        return errors;
    };
    /**
     * @returns {Boolean} True if the run was aborted, or the current target had an error.
     */
    this.hasTargetFailed = function(){
        return newError || aborted;
    };
    /**
     * @returns {Result} Result with failed status, comment "Aborted..."
     */
    this.setAborted = function(){
        aborted = true;
        return new Result("Aborted...", targetFile, true);
    };
    /**
     * @param {Error|undefined} exception
     * @param {String|undefined} message
     * @returns {Result} A Result that contains the error message
     */
    this.setError = function(exception, message){
        gc(true);   // In case error was due to memory exhaustion
        errors = true;
        newError = true;
        let userMessage = logError(exception, message, targetFile);
        if (data.onErrorIndex === ABORT){
            aborted = true;
        } else if (data.onErrorIndex === ASK_USER){
            let dialog = new MessageBox(userMessage, TITLE, StdIcon_Error, StdButton_Abort, StdButton_Ignore);
            let buttonCode = dialog.execute();
            if (buttonCode === StdButton_Abort){
                aborted = true;
            }
        }
        self.errorMessages.push(userMessage);
        return new Result(userMessage, targetFile, true);
    };
}

/**
 * @param {NsgData} data
 * @param {String} refFilename
 * @param {NsgDialog} nsgDialog
 * @param {Boolean} runAll
 * @param {Boolean} runFromProcessIcon 
 */
function runNSG(data, refFilename, nsgDialog, runAll, runFromProcessIcon){
    let startTime = new Date().getTime();
    let nFiles = data.targetFiles.length;
    let nsgStatus = new NsgStatus(data);
    let progressDialog = new ProgressDialog(refFilename, nFiles, "NormalizeScaleGradient Progress", nsgStatus);
    progressDialog.show();
    processEvents();
    processEvents();
    try {
        console.noteln("Ref: '", refFilename, "'");
        progressDialog.updateElapsedTime("Reading reference");
        displayDiskSpace(data, refFilename);
        let nNormalized = 0;
        let displayRemainTime = false;
        let refImage = data.cache.getRefImage();
        let refImageData = data.cache.getRefImageData();
        let refHeaderEntries = getHdrEntries(refImageData, refFilename, true);
        let refFilter = refHeaderEntries.getFilter();
        let refNoiseRaw = refHeaderEntries.getNoise();
        let refNoiseMRS = refImage.noiseMRS();
        let refNoiseKSigma = refImage.noiseKSigma();
        let refNoise = new RefNoise(refNoiseRaw, refNoiseMRS, refNoiseKSigma);
        progressDialog.updateElapsedTime("Detecting stars");
        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
        progressDialog.updateElapsedTime("Sample generation");
        data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);
        progressDialog.updateRefStars(data);
        let bufferSize = refImage.width * refImage.height;
        let tgtSamples;
        let gradSamples;
        if (refImage.bitsPerSample === 64){
            tgtSamples = new Float64Array(bufferSize);
            gradSamples = new Float64Array(bufferSize);
        } else {
            tgtSamples = new Float32Array(bufferSize);
            gradSamples = new Float32Array(bufferSize);
        }
        // -------------------------
        // Process each target image
        // -------------------------
        if (runAll){
            clearNsgResults(nsgDialog, data);
        }
        let csvFile;
        if (data.csvFile){ 
            csvFile = new NsgCsvFile(data, getNsgDataDir(data, refFilename));
        }
        // If running from process icon then mode is 'Continue run', but the results are only read from
        // data.resultsFileBg results file, which will be empty during the first run.
        // data.resultsFileBg results file will get updated with new results during the first and subsequent runs.
        // If not running from process icon, user pressed 'Apply' toolbutton, 'Continue run' or 'Run all'
        let resultFileWriter = new ResultFileWriter(data, runFromProcessIcon);
        data.saveSettings();
        let tmpFiles = [];
        // ==========================
        // Process each target image
        // ==========================
        for (let i=0; i<nFiles; i++){
            processEvents();
            // Check for new errors and warnings
            let tgtTime = new Date().getTime();
            let targetFile = data.targetFiles[i];
            nsgStatus.setTargetFilename(targetFile);
            if (!runAll){   // Continue run
                if (isCachedResultValid(data, targetFile)){
                    console.noteln("[" + (i + 1) + "] " + File.extractName(targetFile) + " has already been processed.");
                    // target has already been processed in a previous run
                    let r = nsgTgtResults.get(targetFile);
                    resultFileWriter.addResult(r);
                    nNormalized++;
                    continue;
                }    
            }

            // ===========================
            // Normalize the target image!
            // ===========================
            let result;
            if (nsgStatus.isAborted()) result = nsgStatus.setAborted();
            if (!nsgStatus.hasTargetFailed()){
                try {
                    result = normalizeScaleGradient(data, targetFile, refImage,
                            refNoise, refFilter, csvFile, nsgStatus, tgtSamples, gradSamples, progressDialog);
                    if (!result){
                        result = nsgStatus.setAborted();
                        break;
                    }
                } catch (error){
                    result = nsgStatus.setError(error, "Normalization failed");
                }
            }
            if (!result) result = nsgStatus.setError(null, "Failed to create result!");
            gc(true);
            if (!nsgStatus.hasTargetFailed() && data.createXnml){
                try {
                    if (!data.NSGXnmlLicense.key || !data.NSGXnmlLicense.email){
                        result = nsgStatus.setError(null, "Invalid NSGXnml license");
                        break;
                    } else {
                        let P = new NSGXnml;
                        P.targetItems = [[result.xnmlFile, result.LNFile]];
                        P.licenseEmail = data.NSGXnmlLicense.email;
                        P.licenseKey = data.NSGXnmlLicense.key;
                        P.executeGlobal();
                        checkSavedFile(result.LNFile, MIN_XNML_SIZE);
                        if (!data.displayGradient){ // delete the tmp gradient file
                            tmpFiles.push(result.xnmlFile);
                        }
                        if (!nsgStatus.hasTargetFailed() && !isPSFScaleSnrAvailable){
                            addWeightToInputFile(data, result, nsgStatus);  // compatability for old NSGXnml
                        }
                    }
                } catch (e){ // Error thrown from NSGXnml
                    result = nsgStatus.setError(e, "NSGXnml failed");
                }
            }
            if (nsgStatus.isAborted()){
                data.cache.invalidateTgt();
                gc(true);
                break;
            }
            // Report on progress
            resultFileWriter.addResult(result);

            if (!nsgStatus.hasTargetFailed() && !result.failed){
                nNormalized++;
                let timeRemaining;
                let elapsedTime = getElapsedTime(tgtTime);
                nsgTgtResults.set(result.inputFile, result);
                if (targetFile !== data.cache.getRefFilename()){
                    console.noteln("Normalized '", File.extractName(targetFile), 
                            "' [", i + 1, "/", nFiles, "] ", elapsedTime);
                    let nRemain = nFiles - (i + 1);
                    if (displayRemainTime && nRemain){
                        let ms = new Date().getTime() - tgtTime;
                        timeRemaining = msToTime(nRemain * ms);
                    } else {
                        console.writeln();
                    }
                    displayRemainTime = true;   // Accurate from second target
                } else {
                    console.noteln("Processed reference '", File.extractName(targetFile), 
                            "' [", i + 1, "/", nFiles, "] ", elapsedTime, "\n");
                }
                progressDialog.updateTarget(data, nNormalized, result, elapsedTime, timeRemaining);
                processEvents();
            } else {
                console.criticalln("** ERROR: Failed to normalize '", File.extractName(targetFile), 
                        "' [", i + 1, "/", nFiles, "] ", "\n");
            }
            // Target image has changed (scaled / gradient) so cached data must be cleared
            data.cache.invalidateTgt();
            gc(true);
            if (lastException){
                break;
            }
        }
    
        // Have now processed all target images
        if (!nsgStatus.hasErrors() && data.csvFile){
            csvFile.writeCsv(data.sortByWeight);
        }

        if (nsgDialog){
            nsgDialog.enableImageRejection(nsgTgtResults.size > 0);
        }
        let results = ArrayFromMapValues(nsgTgtResults);
        if (data.sortByWeight){
            results.sort(compareResultWeight);
        } else {
            results.sort(compareResultObsDate);
        }
        console.noteln("Normalized [", nNormalized, "/", nFiles, "] total time ", getElapsedTime(startTime));
        let sortOrder = data.sortByWeight ? "weight" : "date";
        console.writeln("\n<b><u>Summary (sorted by ", sortOrder, ")</u></b>");
        if (refNoiseRaw){
            console.write("Using noise estimates from FITS header:");
            if (refNoiseRaw.index === -1){
                for (let c=0; c<refNoiseRaw.noise.length; c++){
                    console.write(" NOISE0", c);
                }
            } else {
                let noiseStr = "NOISE0" + refNoiseRaw.index;
                console.write(" ", noiseStr);
                if (refImage.isColor){
                    console.warningln("\n** WARNING: Only found " + noiseStr + " in FITS header. " +
                        "Noise estimated from '" + noiseStr + "'. " +
                        "Noise estimates Noise00, Noise01 and Noise02 can be generated by WBPP or Debayer.");
                }
            }
            console.writeln();
        } else {
            // No NOISExx headers
            console.warningln("** WARNING: can't find noise estimate 'NOISExx' in FITS header. " +
                    "Noise estimated from registered images (less accurate). " +
                    "Noise estimates can be generated by WBPP, ImageCalibration or Debayer.");
        }
        if (!nsgTgtResults.has(data.cache.getRefFilename())){
            // reference not in target list, or not processed (abort)
            console.noteln("[0], ", data.cache.getRefFilename());
        }
        // =============================
        // Write the NSG console summary
        // =============================
        let nth = 1;
        for (let i=0; i<results.length; i++){
            let text = "[" + (nth++) + "], " + results[i].summary;
            if (results[i].isRef){
                console.noteln(text, ", Reference");
            } else if (results[i].hasPhotometryWarning(NSG_MIN_STAR_PAIR_WARN)){
                let warnText = ", Warning: Photometry star matches: " + results[i].nPhotometryStarPairs;
                console.warningln(text + warnText);
            } else {
                console.writeln(text);
            }
        }
        for (let i=0; i<nsgStatus.warnings.length; i++){
            console.warningln(nsgStatus.warnings[i]);
        }
        for (let i=0; i<nsgStatus.errorMessages.length; i++){
            console.criticalln("[",nth++,"] ", nsgStatus.errorMessages[i]);
        }
        if (data.deleteTmpFiles){
            for (let tmpFile of tmpFiles){
                if (File.exists(tmpFile)){
                    File.remove(tmpFile);
                }
            }
        }
        if (nNormalized){
            console.noteln("\nNow view the transmission and weight graphs.");
            let msg = "Then set the minimum transmission and weight";
            msg += data.isNSGXnmlInstalled ? "." : " (requires NSGXnml purchase).";
            console.noteln(msg);
        }
        if (lastException){
            resultFileWriter.setRunStatus(NSG_RUN_STATUS_EXCEPTION);
        } else if (nsgStatus.isAborted()){
            console.criticalln("Aborted ...");
            resultFileWriter.setRunStatus(NSG_RUN_STATUS_ABORTED);
        } else if (!nsgStatus.hasErrors()){
            resultFileWriter.setRunStatus(NSG_RUN_STATUS_NORMAL);
        } else {
            resultFileWriter.setRunStatus(NSG_RUN_STATUS_FAILED);
        }
    } finally {
        progressDialog.hide();
    }
}

/**
 * @param {NsgData} data
 * @param {Boolean} allowIntegrationRun 
 */
function runImageIntegration(data, allowIntegrationRun){
    /**
     * @returns {Boolean}
     */
    function checkXnmlSetting(){
        const tgtResults = nsgTgtResults.values();
        for (let result of tgtResults){
            if (data.createXnml){
                if (!result.LNFile){
                    return false;
                }
            } else {
                if (!result.normalizedFile){
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Used to add images to ImageIntegration
     * @param {ImageRejectionData} imageRejectionData 
     * @param {{enabled, path, drizzlePath, localNormalizationDataPath}[]} images
     * @param {Result} result
     * @param {Boolean} isDrizzleIntegration True if we are adding an image to DrizzleIntegration
     * @return {Boolean} True if the added image will be enabled
     */
    function addImage(imageRejectionData, images, result, isDrizzleIntegration){
        function consoleWarning(msg, filename){
            let file = filename ? ": [" + filename + "]" : "";
            console.warningln(msg + file);
        }
        let enabled;
        if (data.useImageRejection){
            enabled = !imageRejectionData.isRejected(result, data);
        } else {
            enabled = true;
        }
        let filename;
        let xnmlFile;
        let drizzleFile = "";
        if (data.createXnml){
            filename = result.inputFile;
            xnmlFile = result.LNFile;
            if (!xnmlFile || !File.exists(xnmlFile)){
                consoleWarning("** WARNING: Missing Local Normalization '.xnml' file", xnmlFile);
                return false;
            }
            if (data.addDrizzleFiles){
                drizzleFile = File.changeExtension( result.inputFile, ".xdrz" );
                if (!drizzleFile || !File.exists(drizzleFile)){
                    consoleWarning("** WARNING: Missing drizzle '.xdrz' file", drizzleFile);
                    drizzleFile = "";
                }
            }
        } else {
            filename = result.normalizedFile;
            if (!filename || !File.exists(filename)){
                consoleWarning("** WARNING: Missing normalized image", filename);
                return false;
            }
            xnmlFile = "";
        }
        if (isDrizzleIntegration){
            // enabled, drizzlePath, localNormalizationDataPath
            images.push([enabled, drizzleFile, xnmlFile]);
        } else {
            // enabled, path, drizzlePath, localNormalizationDataPath
            images.push([enabled, filename, drizzleFile, xnmlFile]);
        }
        return enabled;
    }
    if (!checkXnmlSetting()){
        return;
    }
    let generateDrizzleData = false;
    let imageIntegrationNormalization;
    let imageIntegrationRejectionNormalization;
    if (data.createXnml){
        imageIntegrationNormalization = ImageIntegration.prototype.LocalNormalization;
        imageIntegrationRejectionNormalization = ImageIntegration.prototype.LocalRejectionNormalization;
        if (data.addDrizzleFiles){
            generateDrizzleData = true;
        }
    } else {
        imageIntegrationNormalization = ImageIntegration.prototype.NoNormalization;
        imageIntegrationRejectionNormalization = ImageIntegration.prototype.NoRejectionNormalization;
    }
    let tgtResults = [];
    for (let tf of data.targetFiles){
        if (nsgTgtResults.has(tf)){
            tgtResults.push(nsgTgtResults.get(tf));
        }
    }
    if (data.sortByWeight){
        tgtResults.sort(compareResultWeight);
    } else {
        tgtResults.sort(compareResultObsDate);
    }
    let imageRejectionData = new ImageRejectionData(data);
    let images = [];
    let drizzleImages = [];
    let nImages = 0;
    for (let i=0; i<tgtResults.length; i++){
        let enabled = addImage(imageRejectionData, images, tgtResults[i], false);
        if (enabled) nImages++;
        if (data.addDrizzleFiles){
            addImage(imageRejectionData, drizzleImages, tgtResults[i], true);
        }
    }
    if (!nImages){
        return;
    }
    
    let PD;
    if (data.addDrizzleFiles){
        let useTemplate = data.drizzleIntegrationTemplateId !== "";
        if (useTemplate){
            PD = ProcessInstance.fromIcon(data.drizzleIntegrationTemplateId);
            if (!PD || PD.processId() !== "DrizzleIntegration") {
                useTemplate = false;
            }
        }
        if (!useTemplate) {
            PD = new DrizzleIntegration;
        }
        PD.inputData = drizzleImages;
        PD.enableLocalNormalization = true;
        PD.launchInterface();
    }
    
    let P;
    let useTemplate = data.imageIntegrationTemplateId !== "";
    if (useTemplate){
        P = ProcessInstance.fromIcon(data.imageIntegrationTemplateId);
        if (!P || P.processId() !== "ImageIntegration") {
            useTemplate = false;
        }
    }
    if (!useTemplate) {
        P = new ImageIntegration;
    }
    if (!useTemplate || data.autoRejectAlgorithm || P.rejection === ImageIntegration.prototype.NoRejection){
        // User has not specified an ImageIntegration process icon (or not set rejection).
        // Set rejection algorithm based on the number of images.
        if ( images.length === 2 ){
            P.rejection = ImageIntegration.prototype.NoRejection;
            // ImageIntegration requires at least 3 images. Add images twice.
            images.push(images[0]);
            images.push(images[1]);
        }
        else if ( nImages < 8 ){
            P.rejection = ImageIntegration.prototype.PercentileClip;
            P.pcClipLow = 0.2;
            P.pcClipHigh = 0.1;
        } else if ( nImages <= 10 ){
            P.rejection =  ImageIntegration.prototype.SigmaClip;
            P.sigmaLow = 3.5;
            P.sigmaHigh = 2.5;
        } else if ( nImages < 20 ){
            P.rejection =  ImageIntegration.prototype.WinsorizedSigmaClip;
            P.sigmaLow = 3.5;
            P.sigmaHigh = 2.2;
            P.winsorizationCutoff = 3.5;
        } else {
            P.rejection = ImageIntegration.prototype.Rejection_ESD;
//                    P.esdOutliersFraction = 3.2 / nImages;
//                    P.esdAlpha = 0.05;
//                    P.esdLowRelaxation = 1.50;
        }
    }
    P.images = images;
    P.combination = ImageIntegration.prototype.Average;
    if (isPSFScaleSnrAvailable && data.createXnml){
        P.weightMode = ImageIntegration.prototype.PSFScaleSNR;
    } else {
        P.weightMode = ImageIntegration.prototype.KeywordWeight;
    }
    P.weightKeyword = data.noiseWeightKeyword;
    P.minWeight = 0;
    P.normalization = imageIntegrationNormalization;
    P.rejectionNormalization = imageIntegrationRejectionNormalization;
    P.generateDrizzleData = generateDrizzleData;
    P.launchInterface();
    if (allowIntegrationRun && data.runImageIntegration){
        console.writeln("======= Running ImageIntegration =======");
        P.executeGlobal();
        renameWindow(data, "integration_n", nImages, P.integrationImageId);
        renameWindow(data, "rejection_low_n", nImages, P.lowRejectionMapImageId);
        renameWindow(data, "rejection_high_n", nImages, P.highRejectionMapImageId);
        console.writeln("======= ImageIntegration has finished =======");
        if (data.addDrizzleFiles){
            if (data.runDrizzleIntegration){
                console.writeln("======= Running DrizzleIntegration =======");
                PD.executeGlobal();
                renameWindow(data, "drizzle_n", nImages, PD.integrationImageId);
                renameWindow(data, "drizzle_weights_n", nImages, PD.weightImageId);
                console.writeln("======= DrizzleIntegration has finished =======");
            } else {
                console.writeln("\n======================================");
                console.writeln("You now need to run DrizzleIntegration");
                console.writeln("======================================");
                console.show();
            }
        }
    } else if (data.addDrizzleFiles){
        console.writeln("\n=================================================");
        console.writeln("Run ImageIntegration. Then run DrizzleIntegration");
        console.writeln("=================================================");
        console.show();
    }
    /**
     * Renames ImageWindow (specified by originalId) to:
     * [prefix]#_NSGref_[refname]
     * Where [refname] is NSG reference filename, but with all non alpha numeric characters replaced with '_'
     * @param {NsgData} data
     * @param {String} prefix
     * @param {Number} nImages Number of images (#)
     * @param {String} originalId
     */
    function renameWindow(data, prefix, nImages, originalId){
        let refFile = data.cache.getRefFilename();
        if (!originalId || !refFile){
            return;
        }
        let refName = File.extractName(refFile);
        const regex = /[^a-zA-Z0-9]/g;
        let refNameId = refName.replace(regex, "_");
        let imageWindow = ImageWindow.windowById( originalId );
        if (imageWindow){
            imageWindow.mainView.id = prefix + nImages + "_NSGref_" + refNameId;
        }
    }
}
