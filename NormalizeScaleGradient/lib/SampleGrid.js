/* global UndoFlag_NoSwapFile, File, MAX_SMOOTHNESS, MAX_BLACK_PIXEL_FRAC */

// Version 1.0 (c) John Murphy 20th-Feb-2020
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
 * 
 * @param {Number} targetMedian
 * @param {Number} referenceMedian
 * @param {Rect} rect Bounding box of sample
 * @returns {SamplePair}
 */
function SamplePair(targetMedian, referenceMedian, rect) {
    this.targetMedian = targetMedian;
    this.referenceMedian = referenceMedian;
    this.rect = rect;
    this.weight = 1;
    /**
     * @returns {Number} targetMedian - referenceMedian
     */
    this.getDifference = function(){
        return this.targetMedian - this.referenceMedian;
    };
}

/**
 * @param {SamplePair[]} samplePairs
 * @param {Number} scale
 * @returns {SamplePair[]} Cloned samplePairs array with scaled target median
 */
function applyScaleToSamplePairs(samplePairs, scale){
    let correctedSamplePairs = [];
    for (let samplePair of samplePairs){
        let tgtMedian = samplePair.targetMedian * scale;
        let refMedian = samplePair.referenceMedian;
        let rect = samplePair.rect; // Shallow copy. Don't modify this...
        correctedSamplePairs.push(new SamplePair(tgtMedian, refMedian, rect));
    }
    return correctedSamplePairs;
}

/**
 * 
 * @param {Rect} binArea
 * @param {Number[]} targetMedians median for each channel
 * @param {Number[]} referenceMedians median for each channel
 */
function BinRect(binArea, targetMedians, referenceMedians){
    this.rect = binArea;
    this.tgtMedian = targetMedians;
    this.refMedian = referenceMedians; 
}

// ============ Algorithms ============

/**
 * Offset to the top left of the first sample in the grid.
 * Reference image must be specified before calling this method.
 * @param {NsgData} data
 * @returns {Point}
 */
function getSampleGridOffset(data){
    let refImage = data.cache.getRefImage();
    let marginX = Math.round((refImage.width % data.sampleSize)/2);
    let marginY = Math.round((refImage.height % data.sampleSize)/2);
    return new Point(marginX, marginY);
}
/**
 * Used to create the SamplePair array.
 * SamplePair[] are used to model the background level and gradient
 * Samples are discarded if they include black pixels or stars
 * @param {NsgData} data
 * @returns {SampleGrid} 
 */
function SampleGrid(data){
    // Private class variables
    let refImage_ = data.cache.getRefImage();
    let targetFilename_;

    //Sample size
    const binSize_ = data.sampleSize;
    // Coordinate of top left bin
    let offset = getSampleGridOffset(data);
    let x0_ = offset.x;
    let y0_ = offset.y;
    // Coordinate of the first bin that is beyond the selected area
    let x1_ = refImage_.width;
    let y1_ = refImage_.height;
    // binRect maps for all colors
    let binRect2dArray_ = null;
    let binCount_;
    
    const nChannels_ = refImage_.isColor ? 3 : 1;
    
    addSampleBins(refImage_);
    
    /**
     * Add all bins within the image.
     * Reject bins with one or more zero pixels.
     * @param {Image} referenceImage
     * @returns {undefined}
     */
    function addSampleBins(referenceImage){
        // Add method replaceTargetSampleBins(targetImage)
        const binArea = binSize_ * binSize_;
        let buffer = referenceImage.bitsPerSample === 64 ? new Float64Array(binArea) : new Float32Array(binArea);
        let binCount = 0;
        let nColumns = getNumberOfColumns();
        let nRows = getNumberOfRows();
        binRect2dArray_ = new Array(nColumns);
        for (let xKey = 0; xKey < nColumns; xKey++){
            binRect2dArray_[xKey] = [];
            for (let yKey = 0; yKey < nRows; yKey++){
                let added = addBinRect(referenceImage, xKey, yKey, buffer);
                if (added){
                    binCount++;
                }
            }
        }
        binCount_ = binCount;
    };
    
    /**
     * @returns {Number} The number of bins added to the sample grid. Ignores rejection circles.
     */
    this.getBinCount = function(){
        return binCount_;
    };
    
    /**
     * Creates SamplePair array from the sample grid.
     * The SamplePair array is 'raw'; no scale factor has been applied to the target sample.
     * @param {Star[]} stars
     * @param {NsgData} data
     * @returns {SamplePair[][]} Returns SamplePair[] for each color. 
     */
    function createRawSamplePairs(stars, data){
        let binRect2dClone = getValidBinRect2d(stars, data);
        let colorSamplePairs = [];
        for (let channel=0; channel<nChannels_; channel++){
            let samplePairArray = [];
            const nColumns = binRect2dClone.length;
            for (let x=0; x<nColumns; x++){
                const nRows = binRect2dClone[x].length;
                for (let y=0; y<nRows; y++){
                    if (binRect2dClone[x][y] !== undefined){
                        let binRect = binRect2dClone[x][y];
                        let rect = binRect.rect;
                        let refMedian = binRect.refMedian[channel];
                        let tgtMedian = binRect.tgtMedian[channel];
                        samplePairArray.push(new SamplePair(tgtMedian, refMedian, rect));
                    }
                }
            }
            colorSamplePairs.push(samplePairArray);
        }
        return colorSamplePairs;
    }
    
    /**
     * 
     * @param {Star[]} stars
     * @param {NsgData} data
     * @param {LinearFitData[]} scaleFactors
     * @returns {SamplePair[][]} SamplePair arrays, one for each color
     */
    this.createColorScaledSamplePairs = function(stars, data, scaleFactors){
        let colorArray = [];
        let colorRawSamplePairs  = createRawSamplePairs(stars, data);
        for (let c=0; c<colorRawSamplePairs.length; c++){
            let rawSamplePairs = colorRawSamplePairs[c];
            let samplePairs = applyScaleToSamplePairs(rawSamplePairs, scaleFactors[c].m);
            colorArray.push(samplePairs);
        }
        return colorArray;
    };
    
    /**
     * @param {Star[]} stars Must be sorted by flux before calling this function
     * @param {NsgData} data
     * @returns {Rect[]} Array of sample grid rectangles 
     */
    this.getBinRectArray = function(stars, data){
        let binRect2dClone = getValidBinRect2d(stars, data);
        let nColumns = binRect2dClone.length;
        let rects = [];
        for (let x=0; x<nColumns; x++){
            let column = binRect2dClone[x];
            let nRows = column.length;
            for (let y=0; y<nRows; y++){
                if (column[y] !== undefined){
                    rects.push(column[y].rect);
                }
            }
        }
        return rects;
    };
    
    // Private methods
    
    /**
     * @param {Star[]} stars Must be sorted by flux before calling this function
     * @param {NsgData} data
     * @returns {BinRect[][]} Clone of binRect2dArray_ after sample rejection
     */
    function getValidBinRect2d(stars, data){
        let binRect2dClone = [];
        
        // clone binRect2dArray_[][]
        let nColumns = binRect2dArray_.length;
        for (let xKey = 0; xKey < nColumns; xKey++){
            binRect2dClone[xKey] = binRect2dArray_[xKey].slice();
            
            // Remove binRects without target median
            let nRows = binRect2dClone[xKey].length;
            for (let yKey = 0; yKey < nRows; yKey++){
                if (binRect2dClone[xKey][yKey] && !binRect2dClone[xKey][yKey].tgtMedian){
                    binRect2dClone[xKey][yKey] = undefined;
                }
            }
        }
        
        // Remove binRects within star rejection circles
        removeBinRectWithStars(binRect2dClone, stars, data);
        
        // Remove binRects within manual rejection circles
        manualRejectionCircles(binRect2dClone, data);
        
        return binRect2dClone;
    }
    
    /**
     * Remove all bin entries that are fully or partially covered by a star
     * @param {BinRect[][]} binRect2dClone 
     * @param {Star[]} stars Must be sorted by flux before calling this function
     * @param {NsgData} data 
     */
    function removeBinRectWithStars(binRect2dClone, stars, data){
        let growthRate = data.sampleStarGrowthRate;
        let firstNstars;
        if (data.limitSampleStarsPercent < 100){
            firstNstars = Math.floor(stars.length * data.limitSampleStarsPercent / 100);
        } else {
            firstNstars = stars.length;
        }
        for (let i=0; i<firstNstars; i++){
            let star = stars[i];
            let starRadius = calcSampleStarRejectionRadius(star, data, growthRate);
            removeBinsInCircle(binRect2dClone, star.pos, starRadius);
        }
    };
    
    /**
     * Remove all bin entries within the manually defined rejection circles
     * @param {BinRect[][]} binRect2dClone
     * @param {NsgData} data 
     */
    function manualRejectionCircles(binRect2dClone, data){
        for (let circle of data.manualRejectionCircles){
            let p = new Point(circle.x, circle.y);
            let r = circle.radius;
            removeBinsInCircle(binRect2dClone, p, r);
        }
    };
    
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @param {Number} yKey Nth bin in y direction (starting at zero)
     * @returns {Point} The (x,y) coordinate of the bin's center
     */
    function getBinCenter(xKey, yKey){
        return new Point(getX(xKey) + binSize_/2, getY(yKey) + binSize_/2);
    }
    /**
     * @returns {Number}
     */
    function getNumberOfColumns(){
        return Math.floor((x1_ - x0_) / binSize_);
    }
    /**
     * 
     * @returns {Number}
     */
    function getNumberOfRows(){
        return Math.floor((y1_ - y0_) / binSize_);
    }
    /**
     * @param {Number} x Any X-Coordinate within a bin, including left edge
     * @returns {Number} Nth sample in x direction (starting at zero)
     */
    function getXKey(x){
        return Math.floor((x - x0_) / binSize_);
    }
    /**
     * @param {Number} y Any Y-Coordinate within a bin, including top edge
     * @returns {Number} Nth sample in y direction (starting at zero)
     */
    function getYKey(y){
        return Math.floor((y - y0_) / binSize_);
    }
    /**
     * @param {Number} xKey Nth bin in x direction (starting at zero)
     * @returns {Number} X-Coordinate of bin's left edge
     */
    function getX(xKey){
        return x0_ + xKey * binSize_;
    }
    /**
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @returns {Number} Y-Coordinate of bin's top edge
     */
    function getY(yKey){
        return y0_ + yKey * binSize_;
    }
    
    /**
     * If the specified bin does not contain too many pixels that are zero (in any channel),
     * add an entry to our binRect map.
     * Note that Image.minimum(rect, c, c) and Image.maximum(rect, c, c) are too inefficient to use here.
     * @param {Image} refImage
     * @param {Number} xKey Nth sample in x direction (starting at zero)
     * @param {Number} yKey Nth sample in y direction (starting at zero)
     * @param {Float64Array | Float32Array} buffer Buffer. Ensure that buffer.length >= binSize_ x binSize_
     * @return {Boolean} True if a bin was added
     */
    function addBinRect(refImage, xKey, yKey, buffer){
        refImage.rangeClippingEnabled = true;   // Image.median() will then ignore zero pixels 
        const maxBlackPixels = binSize_ * binSize_ * MAX_BLACK_PIXEL_FRAC; // Allow 1% black pixels (dark over correction)
        let rect = new Rect(binSize_, binSize_);
        rect.moveTo(getX(xKey), getY(yKey));
        if (rect.x1 > refImage.width || rect.y1 > refImage.height){
            throw new Error("addBinRect logic: bin " + rect + " extends beyond image " + refImage.width + " x " + refImage.height);
        }
        const rectArea = rect.area;
        if (rectArea > buffer.length){
            throw new Error("addBinRect logic: buffer is too small. " + buffer.length + " < " + binSize_ + "x" + binSize_);
        }
        let refMedians = [];
        for (let c=0; c < nChannels_; c++){
            let blackPixels = 0;
            refImage.getSamples(buffer, rect, c);
            for (let i = 0; i < rectArea; i++) {
                if (buffer[i] === 0){
                    blackPixels++;
                    if (blackPixels >= maxBlackPixels){
                        return false;
                    }
                }
            }
            // Store median values for this channel
            refMedians[c] = refImage.median(rect, c, c);
        }
        // There are no black pixels in any colour channel, in either the reference or target image
        binRect2dArray_[xKey][yKey] = new BinRect(rect, undefined, refMedians);
        return true;
    }
    
    /**
     * 
     * @param {String} tgtFilename
     */
    this.setTarget = function (tgtFilename){
        if (!tgtFilename){
            targetFilename_ = undefined;
            return;
        }
        if (tgtFilename !== targetFilename_){
            console.writeln("\n<b><u>Set sample grid target</u></b>");
            console.writeln("Setting sample grid (Tgt = ", File.extractName(tgtFilename), ")");
            targetFilename_ = tgtFilename;
            data.cache.setTgtFilename(targetFilename_);
            let tgtImage = data.cache.getTgtImage();
            tgtImage.rangeClippingEnabled  = true;
            const maxBlackPixels = binSize_ * binSize_ * MAX_BLACK_PIXEL_FRAC; // Allow 1% black pixels
            const rectArea = binSize_ * binSize_;
            let tgtSamples = tgtImage.bitsPerSample === 64 ? new Float64Array(rectArea) : new Float32Array(rectArea);
            const nColumns = binRect2dArray_.length;              
            for (let xKey = 0; xKey < nColumns; xKey++){
                const nRows = binRect2dArray_[xKey].length;
                for (let yKey = 0; yKey < nRows; yKey++){
                    if (binRect2dArray_[xKey][yKey]){
                        const rect = binRect2dArray_[xKey][yKey].rect;
                        if (rect.x1 > tgtImage.width || rect.y1 > tgtImage.height || rectArea !== rect.area){ // TODO remove ASSERT
                            throw new Error("addBinRect logic: bin " + rect + " extends beyond image " + tgtImage.width + " x " + tgtImage.height);
                        }
                        let validTgtBin = true;
                        let tgtMedians = [];
                        for (let c=0; c < nChannels_; c++){
                            let blackPixels = 0;
                            tgtImage.getSamples(tgtSamples, rect, c);
                            for (let i = 0; i < rectArea; i++) {
                                if (tgtSamples[i] === 0){
                                    blackPixels++;
                                    if (blackPixels >= maxBlackPixels){
                                        validTgtBin = false;
                                        break;
                                    }
                                }
                            }
                            if (validTgtBin){
                                tgtMedians[c] = tgtImage.median(rect, c, c);
                            } else {
                                break;
                            }
                        }
                        binRect2dArray_[xKey][yKey].tgtMedian = validTgtBin ? tgtMedians : undefined;
                    }
                }
            }               
        }
    };
    
    /**
     * Reject bin entries from the map if:
     * DISTANCE > (starRadius + binSize/2)
     * where DISTANCE = (center of star) to (center of bin)
     * @param {BinRect[][]} binRect2dClone 
     * @param {Point} p
     * @param {Number} starRadius
     */
    function removeBinsInCircle(binRect2dClone, p, starRadius) {
        let starToCenter = starRadius + binSize_/2;
        let starXKey = getXKey(p.x);
        let starYKey = getYKey(p.y);
        let minXKey = Math.max(getXKey(p.x - starRadius), 0);
        let maxXKey = Math.min(getXKey(p.x + starRadius), getNumberOfColumns() - 1);
        let minYKey = Math.max(getYKey(p.y - starRadius), 0);
        let maxYKey = Math.min(getYKey(p.y + starRadius), getNumberOfRows() - 1);
        for (let xKey = minXKey; xKey <= maxXKey; xKey++) {
            let column = binRect2dClone[xKey];
            let nRows = column.length;
            let yKeyLimit = Math.min(maxYKey + 1, nRows);
            for (let yKey = minYKey; yKey < yKeyLimit; yKey++) {
                if (column[yKey] !== undefined){
                    if (xKey === starXKey || yKey === starYKey) {
                        column[yKey] = undefined;
                    } else {
                        let binCenter = getBinCenter(xKey, yKey);
                        if (p.distanceTo(binCenter) < starToCenter) {
                            column[yKey] = undefined;
                        }
                    }
                }
            }
        }
    }

}

/** For smoothness === MAX_SMOOTHNESS, return nSamples to prevent binning.
 * For smoothness from -4 to 0, return data.maxSamples (2000)
 * For 0 to 4, ramp down the number of samples from 2000 to 500
 * @param {NsgData} data
 * @param {Number} nSamples The number of unbinned samples.
 * @param {Number|undefined} gradientSmoothness SurfaceSpline smoothness, or if undefined, no smoothing.
 * @returns {Number} Bin the samples until their number is less than this maximum
 */
function calcMaxSamples(data, nSamples, gradientSmoothness){
    if (gradientSmoothness === undefined){
        return data.maxSamples;
    }
    if (nSamples && gradientSmoothness === MAX_SMOOTHNESS){
        return nSamples;
    }
    let min = 0;
    let max = 4;
    let minSamples = 500;
    if (gradientSmoothness <= min){
        return data.maxSamples;
    } else if (gradientSmoothness >= max){
        return minSamples;
    }
    let fraction = (gradientSmoothness - min) / (max - min);
    return minSamples + Math.round((data.maxSamples - minSamples) * (1 - fraction));
}

/**
 * 
 * @param {NsgData} data
 * @param {SamplePair[][]} colorSamplePairs SamplePair arrays, one for each color
 * @param {Number|undefined} gradientSmoothness If undefined, no smoothing
 * @returns {SamplePair[][]}
 */
function createColorBinnedSamplePairs(data, colorSamplePairs, gradientSmoothness){
    let image = data.cache.getRefImage();
    let imageRect = new Rect(image.width, image.height);
    let nChannels = data.cache.isColor() ? 3 : 1;
    let maxSamples = calcMaxSamples(data, colorSamplePairs[0].length, gradientSmoothness);
    let binnedColorSamplePairs = [];
    for (let c=0; c<nChannels; c++){
        binnedColorSamplePairs[c] = createBinnedSampleGrid(imageRect, colorSamplePairs[c], maxSamples);
    }
    return binnedColorSamplePairs;
}

/**
 * For performance, if there are more than sampleMaxLimit samples, the samples are binned
 * into super samples.
 * @param {Rect} imageRect
 * @param {SamplePair[]} samplePairs
 * @param {Number} sampleMaxLimit
 * @returns {SamplePair[]}
 */
function createBinnedSampleGrid(imageRect, samplePairs, sampleMaxLimit){ 
    // Private functions

    /**
     * Determine x and y binning factor that will reduce the number of samples to
     * less than maxLength, assuming no samples were rejected (e.g. due to stars).
     * @param {SamplePair[]} samplePairArray
     * @param {Number} maxLength Maximum number of samples after binning
     * @returns {Point} Stores the x and y binning factors
     */
    function calcBinningFactor(samplePairArray, maxLength){
        // what reduction factor is required? 2, 4, 9, 16, 25?
        let factor = samplePairArray.length / maxLength;
        if (factor > 2){
            let binning = Math.ceil(Math.sqrt(factor));
            return new Point(binning, binning);
        }
        return new Point(2, 1);
    }

    /**
     * Create a single SamplePair from the supplied array of SamplePair.
     * The input SamplePair[] must all be the same shape and size and have weight=1
     * @param {SamplePair[]} insideBin SamplePairs that are inside the bin area
     * @param {Number} sampleWidth Width of a single input SamplePair
     * @param {Number} sampleHeight Height of a single input SamplePair
     * @param {Number} binWidth Width of fully populated bin in pixels
     * @param {Number} binHeight height of fully populated bin in pixels
     * @returns {SamplePair} Binned SamplePair with center based on center of mass
     */
    function createBinnedSamplePair(insideBin, sampleWidth, sampleHeight, binWidth, binHeight){
        // Weight is the number of input SamplePair that are in the binned area.
        // Not always the geometrically expected number due to SamplePair rejection (e.g. stars)
        const weight = insideBin.length;

        // binnedSamplePair center: calculated from center of mass
        // CoM = (m1.x1 + m2.x2 + m3.x3 + ...) / (m1 + m2 + m3 + ...)
        // But in our case all input samples have weight = 1
        // So CoM = (x1 + x2 + x3 + ...) / nSamples
        let xCm = 0;
        let yCm = 0;
        let targetMedian = 0;
        let referenceMedian = 0;
        for (let sp of insideBin){
            xCm += sp.rect.center.x;
            yCm += sp.rect.center.y;
            targetMedian += sp.targetMedian;
            referenceMedian += sp.referenceMedian;
        }
        let center = new Point(Math.round(xCm/weight), Math.round(yCm/weight));

        // Use the average value for target and reference median
        targetMedian /= weight;
        referenceMedian /= weight;


        // Area is (weight) * (area of a single input SamplePair)
        // Create a square binnedSamplePair based on this area and the calculated center
        let area = weight * sampleWidth * sampleHeight;
        let width;
        let height;
        if (area === binWidth * binHeight){
            // fully populated bin
            width = binWidth;
            height = binHeight;
        } else {
            width = Math.sqrt(area);
            height = width;
        }
        let halfWidth = Math.round(width / 2);
        let halfHeight = Math.round(height / 2);
        let x0 = center.x - halfWidth;
        let x1 = x0 + width;
        let y0 = center.y - halfHeight;
        let y1 = y0 + height;
        let rect = new Rect(x0, y0, x1, y1);
        let binnedSamplePair = new SamplePair(targetMedian, referenceMedian, rect);
        binnedSamplePair.weight = weight;
        return binnedSamplePair;
    }

    /**
     * Create a binned SamplePair array of larger samples to reduce the number of
     * samples to less then sampleMaxLimit. It assumes no samples were rejected by stars,
     * so the binned SamplePair array may exceed sampleMaxLimit due to star rejection.
     * @param {Rect} sampleRect
     * @param {SamplePair[]} samplePairArray Must all be the same shape and size and have weight=1
     * @param {Number} sampleMaxLimit Try to reduce the number of samples to below this number 
     * @returns {SamplePair[]} Binned SamplePair with center based on center of mass
     */
    function createBinnedSamplePairArray(sampleRect, samplePairArray, sampleMaxLimit){
        let factor = calcBinningFactor(samplePairArray, sampleMaxLimit);

        // width and height of single input sample
        let sampleWidth = samplePairArray[0].rect.width;
        let sampleHeight = samplePairArray[0].rect.height;

        let binWidth = sampleWidth * factor.x;
        let binHeight = sampleHeight * factor.y;

        // Create an empty 3 dimensional array
        // The x,y dimensions specify the new binned sample positions
        // Each (x,y) location stores all the input samples within this binned area
        let xLen = Math.floor(sampleRect.width / binWidth) + 1;
        let yLen = Math.floor(sampleRect.height / binHeight) + 1;
        let binnedSampleArrayXY = new Array(xLen);
        for (let x=0; x<xLen; x++){
            binnedSampleArrayXY[x] = new Array(yLen);
            for (let y=0; y<yLen; y++){
                binnedSampleArrayXY[x][y] = [];
            }
        }

        // Populate the (x,y) locations with the input samples that fall into each (x,y) bin
        for (let samplePair of samplePairArray){
            let x = Math.floor((samplePair.rect.center.x - sampleRect.x0) / binWidth);
            let y = Math.floor((samplePair.rect.center.y - sampleRect.y0) / binHeight);
            binnedSampleArrayXY[x][y].push(samplePair);
        }

        // For each (x,y) location that stores one or more input samples,
        // create a binned sample and add it to the binnedSampleArray
        let binnedSampleArray = [];
        for (let x=0; x<xLen; x++){
            for (let y=0; y<yLen; y++){
                if (binnedSampleArrayXY[x][y].length > 0){
                    binnedSampleArray.push(createBinnedSamplePair(binnedSampleArrayXY[x][y],
                            sampleWidth, sampleHeight, binWidth, binHeight));
                }
            }
        }
        return binnedSampleArray;
    }
    
    {
        const minRows = 5;
        if (samplePairs.length > sampleMaxLimit){
            let binnedSampleArray = createBinnedSamplePairArray(imageRect, samplePairs, sampleMaxLimit);
            if (binnedSampleArray.length > sampleMaxLimit){
                // This can happen because many samples in grid were rejected due to stars
                sampleMaxLimit *= sampleMaxLimit / binnedSampleArray.length;
                binnedSampleArray = createBinnedSamplePairArray(imageRect, samplePairs, sampleMaxLimit);
            }
            return binnedSampleArray;
        }
    }
    return samplePairs;
}
