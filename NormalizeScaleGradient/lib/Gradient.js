/* global OVERLAY_REF, OVERLAY_TGT, OVERLAY_RND, OVERLAY_AVG, ImageOp_Sub, UndoFlag_NoSwapFile, ImageOp_Add, MAX_SMOOTHNESS, MIN_GRADIENT_INC, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidthAndHeight */

// Version 1.0 (c) John Murphy 17th-Mar-2020
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
 * Calculates a surface spline representing the difference between reference and target samples.
 * Represents the gradient in a single channel. (use 3 instances  for color images.)
 * @param {SamplePair[]} samplePairs median values from ref and tgt samples
 * @param {Number|undefined} logSmoothing Logarithmic value; larger values smooth more
 * @returns {SurfaceSpline | SurfacePlane}
 */
function calcSurfaceSpline(samplePairs, logSmoothing){
    if (logSmoothing === MAX_SMOOTHNESS){
        let sp = new SurfacePlane(samplePairs);
        return sp;
    }
    
    const length = samplePairs.length;
    let xVector = new Vector(length);
    let yVector = new Vector(length);
    let zVector = new Vector(length);
    let wVector = new Vector(length);
    for (let i=0; i<length; i++){
        let samplePair = samplePairs[i];
        xVector.at(i, samplePair.rect.center.x);
        yVector.at(i, samplePair.rect.center.y);
        zVector.at(i, samplePair.getDifference());
        wVector.at(i, samplePair.weight);
    }
    
//    let std = image.stdDev();
//    let simplifier = new SurfaceSimplifier( std / 175 );
//    let vectors = simplifier.simplify( xVector, yVector, zVector );
//    for (let v=0; v<vectors.length; v++){
//        console.noteln("v[", v, "] length: ", vectors[v].length);
//    }
    
    let ss = new SurfaceSpline();
    if (logSmoothing !== undefined){
        ss.smoothing = Math.pow(10.0, logSmoothing);
    } else {
        ss.smoothing = 0;
    }
    processEvents();
    ss.initialize(xVector, yVector, zVector, wVector);
    if (!ss.isValid){
        throw new function () {
            this.message = 'Invalid SurfaceSpline';
            this.name = 'SurfaceSplineInvalid';
        };
    }
    return ss;
}

/**
 * @param {Rect} tgtRect Dimensions of full sized image
 * @param {Boolean} isRef 
 * @param {SurfaceSpline} surfaceSpline
 * @param {Number} resizeRatio Determines size of the small image (integer value)
 * @param {Boolean} createLargeImage
 * @returns {Image image, Image smallImage, Number resample, Number pedestal} or undefined if aborted
 */
function createGradientImage(tgtRect, isRef, surfaceSpline, resizeRatio, createLargeImage){
    let LN_SCALE = 64;
    /**
     * @param {Number} total Number of image rows to process
     * @returns {normalizeScaleGradient.ProgressCallback}
     */
    function ProgressCallback(total){
        let lastProgressPc;
        
        /**
         * @param {Number} count Nth image row
         * @returns {Boolean}
         */
        this.progress = function(count){
            if (lastProgressPc === undefined){
                lastProgressPc = 0;
                console.write("<end><cbr>Normalizing image: ", "   0%");
                processEvents();
            } 
            let pc = Math.round(100 * count / total);
            if (pc > lastProgressPc && (pc > lastProgressPc + 5 || pc === 100)){
                if (pc < 100){
                    console.write(format("\b\b\b\b%3d%%", pc));
                } else {
                    console.write(format("\b\b\b\b%3d%%", 100));
                }
                lastProgressPc = pc;
                processEvents();
            }
            return console.abortRequested;
        };
    }
    
    let xCoords = [];
    let yCoords = [];
    //    let startTime = new Date().getTime();
    const smallWidth = Math.round(tgtRect.width / resizeRatio);
    const smallHeight = Math.round(tgtRect.height / resizeRatio);
    const xInc = (tgtRect.width) / (smallWidth);
    for (let x = 0; x < smallWidth; x++){
        xCoords.push(x * xInc);
    }
    const yInc = (tgtRect.height) / (smallHeight);
    for (let y = 0; y < smallHeight; y++){
        yCoords.push(y * yInc);
    }
    
    let smallImage = new Image(smallWidth, smallHeight, 1);
    if (isRef){
        smallImage.fill(0);
        return {image: undefined, smallImage: smallImage, resample: LN_SCALE, pedestal: 0};
    }

    let progressCallback = new ProgressCallback(smallHeight - 1);
    let row = new Rect(smallWidth, 1);
    for (let y=0; y<smallHeight; y++){
        row.moveTo(0, y);
        let points = [];
        for (let x=0; x<smallWidth; x++){
            points.push(new Point(xCoords[x], yCoords[y]));
        }
        let vector = surfaceSpline.evaluate(points);
        // TODO remove debug
        if (vector.length !== smallWidth || xCoords.length !== smallWidth || yCoords.length !== smallHeight){
            throw new Error("Create gradient logic error: " + vector.length + ", " + xCoords.length  + ", " + smallWidth);
        }
        smallImage.setSamples(vector, row);
        progressCallback.progress(y);
        if (console.abortRequested){
            return undefined;
        }
    }

    let pedestal;
    let minimum = smallImage.minimum();
    if (minimum < 0){
        pedestal = -minimum;
        // The image must not contain negative values when displayed, or during resample
        smallImage.apply(pedestal, ImageOp_Add);
    } else {
        pedestal = 0;
    }

    let image;
    if (createLargeImage){
        image = new Image(smallImage);
        image.resample(tgtRect.width, tgtRect.height, ResizeMode_AbsolutePixels, AbsoluteResizeMode_ForceWidthAndHeight);
    }
    //    console.noteln("Created gradient image: ", getElapsedTime(startTime));
    return {image: image, smallImage: smallImage, resample: LN_SCALE, pedestal: pedestal};
}

/**
 * Calculates a flat plane representing the difference between reference and target samples.
 * Represents the gradient in a single channel. (use 3 instances  for color images.)
 * @param {SamplePair[]} samplePairs median values from ref and tgt samples
 * @returns {SurfacePlane}
 */
function SurfacePlane(samplePairs){
    let A;
    let B;
    let C;
    
    calcSurfacePlane(samplePairs);
    
    /**
     * z = Ax + By + C
     * @param {SamplePair[]} samplePairs
     */
    function calcSurfacePlane(samplePairs){
        const length = samplePairs.length;
        let xs = [];
        let ys = [];
        let zs = [];
        for (let i=0; i<length; i++){
            let samplePair = samplePairs[i];
            xs.push(samplePair.rect.center.x);
            ys.push(samplePair.rect.center.y);
            zs.push(samplePair.getDifference());
        }
        let abc = calcBestFitPlane(xs, ys, zs);
        A = abc.a;
        B = abc.b;
        C = abc.c;
    }
    
    this.clear = function(){};
    
    /**
     * 
     * @param {Point[]} points
     * @returns {Vector} z points
     */
    this.evaluate = function(points){
        let zArray = new Float32Array( points.length );
        // z = Ax + By + C
        points.forEach((p, index) => zArray[index] = A * p.x + B * p.y + C);
        return new Vector(zArray);
    };
}

/**
 * The equation for a plane is: ax+by+c=z
 * @param {Number[]} xs
 * @param {Number[]} ys
 * @param {Number[]} zs
 * @returns {Number a, Number b, Number c}
 */
function calcBestFitPlane(xs, ys, zs){
//    function createTestData(){
//        let xs = [2, 4, 6, 2, 4, 6, 2, 4, 6];
//        let ys = [1, 1, 1, 3, 3, 3, 5, 5, 5];
//        let zs = [];
//        
//        let TARGET_X_SLOPE = 2;
//        let TARGET_y_SLOPE = 3;
//        let TARGET_OFFSET  = 5;
//        
//        for (let i=0; i<xs.length; i++){
//            zs.push(xs[i]*TARGET_X_SLOPE + ys[i]*TARGET_y_SLOPE + TARGET_OFFSET);
//        }
//        zs[2] += 0.1;
//        zs[3] -= 0.3;
//        zs[7] += 0.2;
//        
//        return {xs: xs, ys:ys, zs:zs}; // solution: 2.033333 x + 3.008333 y + 4.841667 = z
//    };
//    if (!xs && !ys && !zs){
//        let coords = createTestData();
//        xs = coords.xs;
//        ys = coords.ys;
//        zs = coords.zs;
//        // End of test data
//    }
    
    let A = new Matrix(1, zs.length, 3);
    for (let row=0; row<zs.length; row++){
        A.at(row, 0, xs[row]);
        A.at(row, 1, ys[row]);
//        A.at(row, 2, 1);  // already initialized to 1
    }
    let b = new Matrix( zs, zs.length, 1 );
    
    // abc = (A.T * A).I * A.T * b;
    let AT = A.transpose();
    let ATxA = AT.mul(A);
    let ATxA_I = ATxA.inverse();
    let ATxA_IxAT = ATxA_I.mul(AT);
    let abc = ATxA_IxAT.mul(b);
//    errors = b - A * abc

    return {a: abc.at(0,0), b: abc.at(1,0), c: abc.at(2,0)};
}
