// Version 1.0 (c) John Murphy 20th-Oct-2019
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
 * y = mx + b
 * @param {Number} m
 * @param {Number} b
 * @returns {LinearFitData}
 */
function LinearFitData(m, b) {
    this.m = m;
    this.b = b;
}

/**
 * @param {LinearFitData[]} linearFitDataArray
 * @returns {Number[]}
 */
function linearFitDataArrayToScaleArray(linearFitDataArray){
    let scale = [];
    for (let c = 0; c < linearFitDataArray.length; c++){
        scale.push(linearFitDataArray[c].m);
    }
    return scale;
}

/**
 * This object calculates Least Square Fit
 * y = mx + b
 * m = (N * Sum(xy) - Sum(x) * Sum(y)) /
 *     (N * Sum(x^2) - (Sum(x))^2)
 * b = (Sum(y) - m * Sum(x)) / N
 */
function LeastSquareFitAlgorithm() {
    // y = reference, x = target
    let sumX_ = 0.0;
    let sumY_ = 0.0;
    let sumSquaredX_ = 0.0;
    let sumXY_ = 0.0;
    let n_ = 0;

    /**
     * @param {Number} x
     * @param {Number} y
     */
    this.addValue = function (x, y) {
        sumX_ += x;
        sumY_ += y;
        sumSquaredX_ += x * x;
        sumXY_ += x * y;
        n_++;
    };

    /**
     * Calculate line from data points
     * @return {LinearFitData} Fitted line (y = mx + b)
     */
    this.getLinearFit = function () {
        if (n_ > 1) {
            let m = ((n_ * sumXY_) - (sumX_ * sumY_)) /
                    ((n_ * sumSquaredX_) - (sumX_ * sumX_));

            let b = (sumY_ - (m * sumX_)) / n_;
            return new LinearFitData(m, b);
        } else if (n_ === 1){
            console.warningln("** WARNING: Least Squares Fit only has one point. Assuming origin as second point.");
            return new LinearFitData(sumY_ / sumX_, 0);
        } else {
            console.warningln("** WARNING: Least Squares Fit has no points to fit. " +
                    "Defaulting to gradient = 1, y intercept = 0");
            return new LinearFitData(1, 0);
        }
    };
    
    /**
     * Calculates the best fit line that goes through the origin.
     * This is particularly helpful for photometry graphs with only a few points
     * These lines should always go through the origin.
     * @returns {LinearFitData}
     */
    this.getOriginFit = function () {
        if (n_ > 0) {
            let m = sumXY_ / sumSquaredX_;
            return new LinearFitData(m, 0);
        } else {
            console.warningln("** WARNING: Least Squares Fit has no points to fit. " +
                    "Defaulting to gradient = 1, y intercept = 0");
            return new LinearFitData(1, 0);
        }
    };
}

///**
// * Estimate scale from the mean and median of non zero samples.
// * This works well provided the images don't contain different and strong gradients.
// * @param {Image} refImage
// * @param {Image} tgtImage
// * @param {Number} channel
// * @returns {LinearFitData}
// */
//function estimateScaleFactors(refImage, tgtImage, channel){
//    let x1 = refImage.width;
//    let y1 = refImage.height;
//    let centralArea = new Rect(0, 0, x1, y1);
//    refImage.rangeClippingEnabled = true;
//    tgtImage.rangeClippingEnabled = true;
//    let refMedian = refImage.median(centralArea, channel, channel);
//    let refMean = refImage.mean(centralArea, channel, channel);
//    let tgtMedian = tgtImage.median(centralArea, channel, channel);
//    let tgtMean = tgtImage.mean(centralArea, channel, channel);
//    let refDif = refMean - refMedian;
//    let tgtDif = tgtMean - tgtMedian;
//    let m = (refDif > 0) && (tgtDif > 0) ? refDif / tgtDif : 1;
//    let b = eqnOfLineCalcYIntercept(tgtMedian, refMedian, m);
//    return new LinearFitData(m, b);
//}

/**
 * y = mx + b
 * @param {Number} x coordinate
 * @param {Number} m gradient
 * @param {Number} b y-axis intercept
 * @returns {Number} y coordinate
 */
function eqnOfLineCalcY(x, m, b) {
    return m * x + b;
}
/**
 * m = (y1 - y0) / (x1 - x0)
 * @param {Number} x0 point0 x-coordinate
 * @param {Number} y0 point0 y-coordinate
 * @param {Number} x1 point1 x-coordinate
 * @param {Number} y1 point1 y-coordinate
 * @returns {Number} Gradient
 */
function eqnOfLineCalcGradient(x0, y0, x1, y1) {
    return (y1 - y0) / (x1 - x0);
}   
/**
 * y = mx + b
 * Hence
 * b = y - mx
 * @param {Number} x0 x-coordinate
 * @param {Number} y0 y-coordinate
 * @param {Number} m Gradient
 * @returns {Number} Y Intercept (b)
 */
function eqnOfLineCalcYIntercept(x0, y0, m) {
    return y0 - m * x0;
}
