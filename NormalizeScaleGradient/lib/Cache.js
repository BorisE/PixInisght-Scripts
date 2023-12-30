/* global ImageWindow, UndoFlag_NoSwapFile, LINEAR_RANGE, STAR_BKG_DELTA, File, ImageOp_Mul, ImageOp_Sub */

// Version 1.0 (c) John Murphy 7th-Apr-2021
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

function Cache(){
//  this.setTgtErrorTest = function(testErrors){
//    tgtImageCache.getImageReader().invalidate();
//    tgtImageCache.getImageReader().testErrors = testErrors;
//    console.noteln("ErrorTest: ", tgtImageCache.getImageReader().testErrors);
//};
    /**
     * ImageCache stores filename, image data, detected stars, image bitmap
     * @param {Boolean} isRefCache 
     * @returns {Cache.ImageCache}
     */
    function ImageCache(isRefCache){
        let filename;
        let imageReader;
        let starDetectionMask;
        /** Star detection sensitivity */
        let logStarSensitivity;
        let detectedStars;
        let bitmap;
        let histogramTransform;
        /** Rect: Region of interest to apply to target star detection. */
        let ROI;
        let self = this;

        /**
         * @param {String} fullPath
         * @return {Boolean} True if image exists
         */
        this.setFilename = function(fullPath){
            if (!fullPath){
                self.invalidate();
                gc(true);
                return false;
            }
            if (!File.exists(fullPath)){
                console.criticalln("** ERROR: File does not exist: '", fullPath, "'");   
                self.invalidate();
                gc(true);
                return false;
            }
            if (fullPath === filename){
                return true;
            }
            self.invalidate();
            gc(true);
            filename = fullPath;
            return true;
        };

        /**
         * Invalidate ImageReader, StarDetectionMask, detected stars and bitmap.
         */
        this.invalidate = function(){
            filename = undefined;
            if (imageReader){
                imageReader.invalidate();
                imageReader = undefined;
            }
            if (starDetectionMask){
                starDetectionMask.free();
                starDetectionMask = undefined;
            }
            logStarSensitivity = undefined;
            if (detectedStars){
                detectedStars.clear();
                detectedStars = undefined;
            }
            if (bitmap){
                bitmap.clear();
                bitmap = undefined;
            }
            ROI = undefined;
        };

        /**
         * @returns {fullPath}
         */
        this.getFilename = function(){
            return filename;
        };

        /**
         * @returns {ImageReader|undefined} undefined if filename has not been set
         */
        this.getImageReader = function(){
            if (!filename){
                return undefined;
            }
            if (!imageReader){
                imageReader = new ImageReader(filename);
            }
            return imageReader;
        };

        /**
         * @returns {Bitmap}
         * @throws {Error} File I/O error
         */
        this.getImageBitmap = function(){
            if (!bitmap){
                let img = self.getImageReader().readHeadersAndImage();
                // Width, height, n channels, bitsPerSample, float, color, title
                let nChannels = img.isColor ? 3 : 1;
                let w = new ImageWindow(1, 1, nChannels, 16, false, img.isColor, "createBitmap");
                let view = w.mainView;
                view.beginProcess(UndoFlag_NoSwapFile);
                view.image.assign(img);
                view.image.rangeClippingEnabled = true;
                view.endProcess();

                // Apply a Histogram Transformation based on the reference view's STF
                // before converting this temporary view into a bitmap
                let stf = STFAutoStretch(view, undefined, undefined, false);
                var HT = new HistogramTransformation;
                if (img.isColor){
                    HT.H = 
                        [[stf[0][0], stf[0][2], stf[0][1], 0, 1],
                        [stf[1][0], stf[1][2], stf[1][1], 0, 1],
                        [stf[2][0], stf[2][2], stf[2][1], 0, 1],
                        [0, 0.5, 1, 0, 1],
                        [0, 0.5, 1, 0, 1]];
                } else {
                    HT.H = 
                        [[0, 0.5, 1, 0, 1],
                        [0, 0.5, 1, 0, 1],
                        [0, 0.5, 1, 0, 1],
                        [stf[0][0], stf[0][2], stf[0][1], 0, 1],
                        [0, 0.5, 1, 0, 1]];
                }
                HT.executeOn(view, false); // no swap file
                histogramTransform = HT;

                bitmap = view.image.render();
                // w.purge();
                w.forceClose();
            }
            return bitmap;
        };
        
        /**
         * @returns {HistogramTransformation}
         */
        this.getHistogramTransform = function(){
            if (!bitmap)
                self.getImageBitmap();
            return histogramTransform;
        };

        /**
         * @param {Number} logSensitivity
         * @param {Rect|undefined} newROI Detect stars within a limited area. Use undefined for ref.
         * @returns {DetectedStars}
         * @throws {Error} File I/O error when reading image
         */
        function getDetectedStars (logSensitivity, newROI){
            function needToDetectStars(logSensitivity, newROI){
                if (!detectedStars || logStarSensitivity !== logSensitivity){
                    // Either we haven't detected the stars yet, or the sensitivity has changed.
                    return true;
                }
                if (isRefCache || (!newROI && !ROI)){
                    // Either ref image (which does not use ROI) or ROI is not being used.
                    return false;
                }
                if (!newROI || !ROI || 
                        newROI.x0 !== ROI.x0 || newROI.y0 !== ROI.y0 || 
                        newROI.x1 !== ROI.x1 || newROI.y1 !== ROI.y1){
                    return true;
                }
                return false;
            }
            
            if (needToDetectStars(logSensitivity, newROI)){
                logStarSensitivity = logSensitivity;
                ROI = isRefCache ? undefined : newROI;
                let imageReader = self.getImageReader();
                let img = imageReader.readHeadersAndImage();
                let progressLabel = imageReader.getImageName();
                detectedStars = new DetectedStars(img, progressLabel, logStarSensitivity, ROI);
            }
            return detectedStars;
        };

        /**
         * @param {Number} logSensitivity
         * @param {Rect|undefined} rectROI Detect stars within a limited area. Use undefined for ref.
         * @returns {Star[]} Detected stars
         * @throws {Error} File I/O error
         */
        this.getStars = function(logSensitivity, rectROI){
            if (isRefCache){
                getDetectedStars(logSensitivity);
            } else {
                getDetectedStars(logSensitivity, rectROI);
            }
            return detectedStars.getStars();
        };
        
        /**
         * @param {Number} logSensitivity
         * @returns {Boolean} True if the stars have already been detected
         */
        this.hasCachedStars = function(logSensitivity){
            return (logStarSensitivity === logSensitivity) && (detectedStars !== undefined);
        };
        
        /**
         * @param {Number} logSensitivity
         * @returns {Number} Maximum star flux in image
         * @throws {Error} File I/O error
         */
        this.getMaxStarFlux = function(logSensitivity){
            if (!isRefCache) console.criticalln("** ERROR: Logic error: getMaxStarFlux");
            if (!detectedStars){
                getDetectedStars(logSensitivity).getStars();
            }
            return detectedStars.getMaxStarFlux();
        };
        
        /**
         * @returns {Number} LINEAR_RANGE * max pixel value in image to 3 decimal places
         * @throws {Error} File I/O error while reading image
         */
        this.getLinearRange = function(){
            if (filename){
                let image = self.getImageReader().readHeadersAndImage();
                return Math.round(1000 * image.maximum() * LINEAR_RANGE) / 1000;
            }
            return LINEAR_RANGE;
        };
    }
    
    // -------------------
    // REF Image Cache
    // -------------------
    let refImageCache = new ImageCache(true);
    
    /**
     * @param {String} fullPath
     * @return {Boolean} True if image exists
     */
    this.setRefFilename = function(fullPath){
        return refImageCache.setFilename(fullPath);
    };
    
    /**
     * @returns {String} fullPath
     */
    this.getRefFilename = function(){
        return refImageCache.getFilename();
    };
    
    /**
     * @returns {String} File name (without path or extention)
     */
    this.getRefName = function(){
        return File.extractName(refImageCache.getFilename());
    };
    
    /**
     * @param {Number} logSensitivity
     * @returns {Boolean} True if ref stars have already been detected
     */
    this.hasCachedRefStars = function(logSensitivity){
        return refImageCache.hasCachedStars(logSensitivity);
    };
    
    /**
     * @returns {Image|undefined} undefined if filename is not set
     * @throws {Error} File I/O error while reading image
     */
    this.getRefImage = function(){
        let imageReader = refImageCache.getImageReader();
        if (imageReader){
            return imageReader.readHeadersAndImage();
        }
        return undefined;
    };
    
    /**
     * @returns {ImageReader.ImageData|undefined} undefined if filename is not set
     * @throws {Error} 
     */
    this.getRefImageData = function(){
        let imageReader = refImageCache.getImageReader();
        if (imageReader){
            return imageReader.readImageData();
        }
        return undefined;
    };
    
    /**
     * @returns {Bitmap}
     * @throws {Error} File I/O error
     */
    this.getRefImageBitmap = function(){
        return refImageCache.getImageBitmap();
    };
    
    /**
     * @returns {HistogramTransformation}
     */
    this.getRefHistogramTransform = function(){
        return refImageCache.getHistogramTransform();
    };
    
    /**
     * @param {Number} logSensitivity
     * @returns {Star[]} Detected stars
     * @throws {Error} File I/O error
     */
    this.getRefStars = function(logSensitivity){
        return refImageCache.getStars(logSensitivity);
    };
    
    /**
     * @returns {Number} Calculated max safe linear value in ref image
     * @throws {Error} File I/O error
     */
    this.getLinearRangeRef = function(){
        return refImageCache.getLinearRange();
    };
    
    /**
     * @param {Number} logSensitivity
     * @returns {Number|undefined} flux of the brightest star.
     * @throws {Error} File I/O error
     */
    this.getMaxStarFlux = function (logSensitivity){
        return refImageCache.getMaxStarFlux(logSensitivity);
    };
    
    // -------------------
    // TGT Image Cache
    // -------------------
    let tgtImageCache = new ImageCache(false);
    
    /**
     * @param {String} fullPath
     * @return {Boolean} True if image exists and could be read
     */
    this.setTgtFilename = function(fullPath){
        return tgtImageCache.setFilename(fullPath);
    };
    
    /**
     * @returns {String} fullPath
     */
    this.getTgtFilename = function(){
        return tgtImageCache.getFilename();
    };
    
    /**
     * @returns {String} File name (without path or extention)
     */
    this.getTgtName = function(){
        return File.extractName(tgtImageCache.getFilename());
    };
    
    /**
     * @returns {Image|undefined}
     * @throws {Error} File I/O error
     */
    this.getTgtImage = function(){
        let imageReader = tgtImageCache.getImageReader();
        if (imageReader){
            return imageReader.readHeadersAndImage();
        }
        return undefined;
    };
    
    /**
     * @returns {ImageReader.ImageData|undefined}
     * @throws {Error} File I/O error
     */
    this.getTgtImageData = function(){
        let imageReader = tgtImageCache.getImageReader();
        if (imageReader){
            return imageReader.readImageData();
        }
        return undefined;
    };
    
    /**
     * @returns {Bitmap}
     * @throws {Error} File I/O error
     */
    this.getTgtImageBitmap = function(){
        return tgtImageCache.getImageBitmap();
    };
    
    /**
     * @param {NsgData} data
     * @param {Number} logSensitivity
     * @param {Boolean} allStars
     * @returns {Star[]} Detected stars
     * @throws {Error} File I/O error
     */
    this.getTgtStars = function(data, logSensitivity, allStars){
        let rectROI;
        if (data.usePhotometryROI && !allStars){
            rectROI = new Rect(data.photometryROIx, data.photometryROIy, 
                    data.photometryROIx + data.photometryROIw, data.photometryROIy + data.photometryROIh);
        }
        return tgtImageCache.getStars(logSensitivity, rectROI);
    };
    
    // --------------------
    // Photometry Cache
    // --------------------
    function PhotometryCache(){
        let refStarQuadTree_;
        let starMatchArray_;

        let refFilename_;
        let tgtFilename_;
        let logStarDetection_;
        let starSearchRadius_;
        let linearRange_;
        let fluxTolerance_;
        
        /**
         * @param {NsgData} data
         * @returns {BRQuadTree}
         * @throws {Error} File I/O error
         */
        function getRefStarQuadTree(data){
            if (data.cache.getRefFilename() !== refFilename_ ||
                    data.logStarDetection !== logStarDetection_ ||
                    data.starSearchRadius !== starSearchRadius_ || 
                    data.linearRangeRef !== linearRange_){
                if (refStarQuadTree_){
                    refStarQuadTree_.clear();
                    refStarQuadTree_ = undefined;
                }
            }
            if (!refStarQuadTree_){
                refFilename_ = data.cache.getRefFilename();
                logStarDetection_ = data.logStarDetection;
                starSearchRadius_ = data.starSearchRadius;
                linearRange_ = data.linearRangeRef;
                
                let image = data.cache.getRefImage();
                let imageRect = new Rect(image.width, image.height);
                let refStars = data.cache.getRefStars(logStarDetection_);
                refStarQuadTree_ = createQuadTree(refStars, starSearchRadius_, linearRange_, imageRect);
            }
            return refStarQuadTree_;
        };
        
        /**
         * @param {NsgData} data
         * @param {Rect} rect
         * @returns {Number}
         * @throws {Error} File I/O error
         */
        this.countStarsInRect = function (data, rect){
            let quadTree = getRefStarQuadTree(data);
            let indexs = quadTree.search(rect);
            return indexs.length;
        };
        
        /**
         * @param {NsgData} data
         * @returns {StarMatch[]} StarMatch array, or undefined if ref or tgt not set
         * @throws {Error} File I/O error
         */
        this.createStarMatchArray = function (data){
            if (data.cache.getRefFilename() === undefined || data.cache.getTgtFilename() === undefined){
                return undefined;
            }
            if (data.cache.getRefFilename() !== refFilename_ ||
                    data.cache.getTgtFilename() !== tgtFilename_ ||
                    data.logStarDetection !== logStarDetection_ ||
                    data.starSearchRadius !== starSearchRadius_ || 
                    data.linearRangeRef !== linearRange_ ||
                    data.starFluxTolerance !== fluxTolerance_){
                starMatchArray_ = undefined;
            }
            if (!starMatchArray_){
                tgtFilename_ = data.cache.getTgtFilename();
                let refQuadTree = getRefStarQuadTree(data);
                let tgtStars = data.cache.getTgtStars(data, logStarDetection_);
                starMatchArray_ = calcStarMatchArray(refQuadTree, tgtStars, starSearchRadius_, fluxTolerance_, linearRange_);
            }
            return starMatchArray_; 
        };
        
        /**
         * 
         * Call this method after the target image has been modified (e.g. scale and/or gradient subtraction)
         */
        this.clearTargetData = function(){
            starMatchArray_ = undefined;
            tgtFilename_ = undefined;
        };
        
        /**
         * Clears refStarQuadTree memory, and resets all module variables to undefined
         */
        this.invalidate = function(){
            if (refStarQuadTree_){
                refStarQuadTree_.clear();
                refStarQuadTree_ = undefined;
            }
            starMatchArray_ = undefined;
            refFilename_ = undefined;
            tgtFilename_ = undefined;
            logStarDetection_ = undefined;
            starSearchRadius_ = undefined;
            linearRange_ = undefined;
            fluxTolerance_ = undefined;
        };
    }
    
    let photometryCache = new PhotometryCache();
    
    /**
     * @param {NsgData} data
     * @returns {StarMatch[]}
     * @throws {Error} File I/O error
     */
    this.getStarMatchArray = function(data){
        return photometryCache.createStarMatchArray(data);
    };
    
    // ---------------------
    // SampleGrid cache
    // ---------------------
    function SampleGridCache(){
        let refFilename_;
        let sampleSize_;
        let sampleGrid_;
        
        /**
         * The previously cached value is replaced if the refFile or sample size has changed
         * @param {NsgData} data
         * @returns {SampleGrid}
         */
        this.getSampleGrid = function (data){
            if (data.sampleSize !== sampleSize_ ||
                    data.cache.getRefFilename() !== refFilename_){
                sampleGrid_ = undefined;
            }
            if (!sampleGrid_){
                console.writeln("\n<b><u>Creating sample grid</u></b>");
                refFilename_ = data.cache.getRefFilename();
                sampleSize_ = data.sampleSize;
                console.writeln("Setting sample grid (Ref = ", refFilename_, ")");
                sampleGrid_ = new SampleGrid(data);
            }
            return sampleGrid_;
        };
        
        this.clearTargetData = function(){
            if (sampleGrid_){
                sampleGrid_.setTarget(undefined);
            }
        };
        
        /**
         * Reset all module variables to undefined
         */
        this.invalidate = function(){
            refFilename_ = undefined;
            sampleSize_ = undefined;
            sampleGrid_ = undefined;
        };
    }
    let sampleGridCache = new SampleGridCache();
    
    /**
     * 
     * @param {NsgData} data
     * @param {String} targetFilename Full file pathname
     * @returns {SampleGrid}
     */
    this.getSampleGrid = function(data, targetFilename){
        if (data.cache.setTgtFilename(targetFilename)){
            let sampleGrid = sampleGridCache.getSampleGrid(data);
            sampleGrid.setTarget(targetFilename);
            return sampleGrid;
        }
        return undefined;
    };
    
    /**
     * Return the number of bins in the sample grid. Returns undefined if there is no reference.
     * @param {NsgData} data
     * @returns {Number | undefined}
     */
    this.getSampleGridBinCount = function(data){
        let sampleGrid = sampleGridCache.getSampleGrid(data);
        return sampleGrid ? sampleGrid.getBinCount() : undefined;
    };
    
    /**
     * @returns {Boolean} True if ref image is color
     * @throws {Error} File I/O errors while reading image
     */
    this.isColor = function(){
        if (refImageCache.getFilename()){
            return refImageCache.getImageReader().readHeadersAndImage().isColor;
        }
        return undefined;
    };
    
    /**
     * Call invalidate on all four caches.
     * refImageCache, tgtImageCache, photometryCache, sampleGridCache
     */
    this.invalidate = function(){
        refImageCache.invalidate();
        tgtImageCache.invalidate();
        photometryCache.invalidate();
        sampleGridCache.invalidate();
    };
    
    /**
     * Call invalidate on all four caches.
     * refImageCache, tgtImageCache, photometryCache, sampleGridCache
     */
    this.invalidateTgt = function(){
        tgtImageCache.invalidate();
        photometryCache.clearTargetData();
        sampleGridCache.clearTargetData();
    };
}

/**
 * 
 * @param {Image|undefined} img
 * @returns {BitmapData}
 */
function BitmapData(img){
    let image;
    let nChannels;
    let histogramTransform;
    let bitmap;
    let bitmapUpdateNeeded = true;
    /**
     * Sets image and sets bitmap to undefined to force it to be recalculated.
     * @param {Image} img
     */
    this.setImage = function(img){
        image = img;
        image.rangeClippingEnabled = true;
        bitmapUpdateNeeded = true;
        nChannels = image.isColor ? 3 : 1;
    };
    if (img){
        this.setImage(img);
    }
    
    /**
     * @returns {Image|undefined} Shallow copy of the image.
     */
    this.getImage = function(){
        return image;
    };
    
    /**
     * @param {Point} point
     * @returns {String} Image sample value L or R, G, B
     */
    this.getImageSample = function(point){
        let text = image.isColor ? "  RGB: " : "  L: ";
        if (image && point.x >= 0 && point.x < image.width
                && point.y >= 0 && point.y < image.height){
            let nChannels = image.isColor ? 3 : 1;
            for (let c=0; c<nChannels; c++){
                if (c){
                    text += ", ";
                }
                text += Math.round(image.sample( point, c ) * 65536);
            }
            text += " [16 bit]";
        }
        return text;
    };
    
    /*
     * Used to get reference image median
     * @returns {Number[]} image median for each color channel.
     */
    this.calcImageMedian = function(){
        let bg = [];
        for (let c = 0; c < nChannels; c++){
            bg.push(image.median(new Rect(image.width, image.height), c, c));
        }
        return bg;
    };
    
    /**
     * Apply a scale and offset to the stored image.
     * @param {Number[]} refBackground Target background level for each channel
     * @param {Number[]} tgtScale Original target scale factor relative to reference.
     * @param {Number[]|undefined} refScale Normalize the scale factor to these scale factors
     * @returns {Number[]} Median background (before offset is removed)
     */
    this.normalizeScaleOffset = function(refBackground, tgtScale, refScale){
        let area = new Rect(image.width, image.height);
        let median = [];
        for (let c = 0; c < nChannels; c++){
            let scale = refScale ? tgtScale[c] / refScale[c] : tgtScale[c];
            image.apply(scale, ImageOp_Mul, area, c, c);
            median[c] = image.median(area, c, c);
            image.apply(median[c] - refBackground[c], ImageOp_Sub, area, c, c);
        }
        image.truncate();
        bitmapUpdateNeeded = true;
        return median;
    };
    
    /**
     * To release resouces, call w.purge; w.close;
     * @returns {ImageWindow} Create a window with a copy of the image
     */
    function getImageWindow(){
        // Width, height, n channels, bitsPerSample, float, color, title
        let w = new ImageWindow(1, 1, nChannels, 16, false, image.isColor, "createBitmap");
        let view = w.mainView;
        view.beginProcess(UndoFlag_NoSwapFile);
        view.image.assign(image);
        view.image.rangeClippingEnabled = true;
        view.endProcess();
        return w;
    }
    
    /**
     * Used to create and set the histogram for the stored image.
     * The returned histogram can be used to apply exactly the same stretch to other images.
     * @param {Number} blackPointFromMedian Shadows clipping point in (normalized) MAD units from the median.
     * @param {Number} targetMeanBackground Target mean background in the [0,1] range.
     * @return {HistogramTransform} Histogram transform
     */
    this.calcHistogramTransform = function(blackPointFromMedian, targetMeanBackground){
        let w = getImageWindow();   // TODO if we keep ref view, median value is cached by PixInsight
        let stf = STFAutoStretch(w.mainView, blackPointFromMedian, targetMeanBackground, false);   // default is usually -2.8, 0.25
        histogramTransform = new HistogramTransformation;
        if (image.isColor){
            histogramTransform.H = 
                [[stf[0][0], stf[0][2], stf[0][1], 0, 1],
                [stf[1][0], stf[1][2], stf[1][1], 0, 1],
                [stf[2][0], stf[2][2], stf[2][1], 0, 1],
                [0, 0.5, 1, 0, 1],
                [0, 0.5, 1, 0, 1]];
        } else {
            histogramTransform.H = 
                [[0, 0.5, 1, 0, 1],
                [0, 0.5, 1, 0, 1],
                [0, 0.5, 1, 0, 1],
                [stf[0][0], stf[0][2], stf[0][1], 0, 1],
                [0, 0.5, 1, 0, 1]];
        }
        //w.purge();
        w.forceClose();
        bitmapUpdateNeeded = true;
        return histogramTransform;
    };
    
    /**
     * @returns {HistogramTransformation}
     */
    this.getHistogramTransform = function(){
        return histogramTransform;
    };
    
    /**
     * Sets HistogramTransform (but does not apply it). Clears cached bitmap.
     * @param {HistogramTransform} HT
     */
    this.setHistogramTransform = function(HT){
        bitmapUpdateNeeded = true;
        histogramTransform = HT;
    };
    
    /**
     * Creates a temporary view with a copy of the image.
     * Applies the HistogramTransform to the image.
     * Creates a bitmap from the stretched image.
     * Caches the bitmap.
     * @param {Boolean} useSTF 
     * @returns {Bitmap} Cached bitmap
     */
    this.getBitmap = function(useSTF){
        if (bitmap && !bitmapUpdateNeeded){
            return bitmap;
        }
        let w = getImageWindow();
        let view = w.mainView;
        if (useSTF){
            histogramTransform.executeOn(view, false); // no swap file
        }
        bitmap = view.image.render();
        bitmapUpdateNeeded = false;
        //w.purge();
        w.forceClose();
        w = undefined;
        view = undefined;
        gc(true);
        return bitmap;
    };
    
    /**
     * Free the stored bitmap. The image should be freeded by the calling method.
     */
    this.free = function(){
        if (bitmap){
            bitmap.clear();
            bitmap = undefined;
        }
    };
}