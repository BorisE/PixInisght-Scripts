/*
 *  StarSizeMask - A PixInsight Script to create StarMasks based on their sizes
 *  Copyright (C) 2024-2025  Boris Emchenko http://astromania.info
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
#ifndef __STARSIZEMASK_ENGINE__
	#define __STARSIZEMASK_ENGINE__

	#define __PJSR_USE_STAR_DETECTOR_V2
	#define __PJSR_STAR_OBJECT_DEFINED  1
	#define __PJSR_NO_STAR_DETECTOR_TEST_ROUTINES

#endif /* __STARSIZEMASK_ENGINE__ */

#include <pjsr/StarDetector.jsh>

#include <pjsr/UndoFlag.jsh>
#include <pjsr/BitmapFormat.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/ImageOp.jsh>
#include <pjsr/MorphOp.jsh>

#include "../lib/STFAutoStretch.js"

#define MAX_INT 1000000

#ifndef __DEBUGF__
	#define __DEBUGF__ true  /*or false*/
#endif

#define csvSeparator ","

#define ADDPEDESTAL_MEDIAN_THRESHOLD 0.00100
#define ADDPEDESTAL_MIN_THRESHOLD 0.00010
#define TEMP_PEDESTAL 0.002


/*
 * Star data object
 */
function Star( pos, flux, bkg, rect, size, nmax )
{
   // Centroid position in pixels, image coordinates. This property is an
   // object with x and y Number properties.
   this.pos = pos;
   // Total flux, normalized intensity units.
   this.flux = flux;
   // Mean local background, normalized intensity units.
   this.bkg = bkg;
   // Detection region, image coordinates.
   this.rect = rect;
   // Area of detected star structure in square pixels.
   this.size = size;
   // Number of local maxima in the detection structure. A value greater than
   // one denotes a double/multiple star or a crowded source. A value of zero
   // signals that detection of local maxima has been disabled, either globally
   // or for this particular structure.
   this.nmax = nmax;
   
   // Extended properties
   // Radius from size
   this.sizeRadius = Math.sqrt(this.size/Math.PI); 
   // Width
   this.w = this.rect.x1 - this.rect.x0; 
   // Height
   this.h = this.rect.y1 - this.rect.y0; 

   let AdjFact = Math.min ( ( this.flux > 1 ? this.flux : 1) * 1.5, 3);
   this.rectEx = new Rect (this.pos.x - this.w * AdjFact * 0.5, this.pos.y - this.h * AdjFact * 0.5, this.pos.x + this.w * AdjFact * 0.5, this.pos.y + this.h * AdjFact * 0.5);

   // Size grouping 
   // calculated latter on the whole array
   this.sizeGroup = undefined;
   // Flux grouping 
   // calculated latter on the whole array
   this.fluxGroup = undefined;
   // Flux log
   // calculated latter on the whole array
   this.fluxLog = undefined;
   
   // DynamicPSF parameters
   this.PSF_StarIndex = undefined;
   this.PSF_Status = undefined;
   this.PSF_b  = undefined;
   this.PSF_a  = undefined;
   this.PSF_cx  = undefined;
   this.PSF_cy  = undefined;
   this.PSF_sx  = undefined;
   this.PSF_sy  = undefined;
   this.PSF_theta = undefined;
   this.PSF_residual = undefined;
   this.PSF_flux = undefined;
   
   this.PSF_rect = undefined;    // new Rect( starsTable[idx][DYNAMICPSF_Stars_x0], starsTable[idx][DYNAMICPSF_Stars_y0], starsTable[idx][DYNAMICPSF_Stars_x1], starsTable[idx][DYNAMICPSF_Stars_y1] );
   this.PSF_diag = undefined;    // Math.sqrt( (PSF_rect.x1 - .PSF_rect.x0)*(PSF_rect.x1 - PSF_rect.x0) + (PSF_rect.y1 - PSF_rect.y0)*(PSF_rect.y1 - PSF_rect.y0));
   
   this.FWHMx = undefined;
   this.FWHMy = undefined;
}

/*
 * Star detection engine
 *
   -- process image --
   
   *getStars (sourceView)*
      Detect stars; you need it to run before any further manipulation
 
   *fitStarPSF (StarsArray = undefined)*
      Fit stars profiles using DynamicPSF process
        
   *calculateStarStats (StarsArray = undefined)*
      Calculate stars statistics. Needed to use grouping and some other methods. Generally recommended to run after GetStars
      Auto runs CalculateStarStats_SizeGrouping and CalculateStarStats_FluxGroupingLog


       private _calculateStarStats_SizeGrouping  (StarsArray = undefined, numIntervals = undefined)
          Calculate star grouping based on StarSize
          Optionaly you can specify number of intervals to split the set or use auto splitting
       
       private __calculateStarStats_FluxGrouping (StarsArray = undefined, numIntervals = undefined)
          Calculate stars grouping based on StarFlux. 
          Obsolete, recommended to use CalculateStarStats_FluxGroupingLog instead

       private _calculateStarStats_FluxGroupingLog (StarsArray = undefined, numIntervals = undefined)
          Calculate stars grouping based on Log10 of StarFlux


   -- filter out stars --

   *filterStarsBySize (minRadius = 0, maxRadius = 65535, StarsArray = undefined)*
      Filter out some stars based on their radius

   *filterStarsByFlux (minFlux = 0, maxFlux = MAX_INT, StarsArray = undefined)*
      Filter out some stars based on their flux


   -- output stat --
   
   *printStars (StarsArray = undefined)*
      output to console stars array
      
   printGroupStat (StarsArray = undefined)   
      output to console GroupStats for StarSize and  StarFlux

   saveStars (fileName, StarsArray = undefined)
      output Stars array to file


   -- create masks --
   
   createMask (StarsArray=undefined, softenMask = true, maskGrowth = true,  contourMask = false, maskName = "stars")
      /create StarMask from image array/
      softenMask - 
      maskGrowth - use to increase stars ellipses
      contourMask - use to make contour mask (donut)
      maskName - image id for StarMask

   markStars (StarsArray=undefined, imageName = "DetectedStars")      
      /create Image with detected stars marked/
      
   makeResidual ( starMaskId, StarsArray = undefined, imageName = "StarsResidual" )
      /Create Image with removed detected stars + mask on/
      starMaskId  - starmask image id created through this.createAngleMask() method
      StarsArray   - stars array, used only to insert keywords
      imageName   - new image id
      
 *
 */
function StarSizeMask_engine()
{
   /* pos   - Centroid position in pixels, image coordinates. This property is an object with x and y Number properties.
    * flux  - Total flux, normalized intensity units.
    * bkg   - Mean local background, normalized intensity units.
    * rect  - Detection region, image coordinates.
    * size  - Area of detected star structure in square pixels.
    * nmax  - Number of local maxima in the detection structure. A value greater than
             one denotes a double/multiple star or a crowded source. A value of zero
             signals that detection of local maxima has been disabled, either globally
             or for this particular structure.
    */
    this.debug = __DEBUGF__;


    this.Stars = undefined,

    this.sourceView = undefined;
    this.sourceImage = undefined;

    // Temp image used to detect and fit stars
    this.workingView = undefined;
    this.workingImage = undefined;


    this.__base__ = Object;
    this.__base__();

    this.StarDetectorObj = new StarDetector;

    // StarDetector settings
    this.StarDetectorObj.hotPixelFilterRadius = 1;
    this.StarDetectorObj.applyHotPixelFilterToDetectionImage = false;
    this.StarDetectorObj.noiseReductionFilterRadius = 0;
    this.StarDetectorObj.structureLayers = 5;
    //this.StarDetectorObj.sensitivity = parameters.starDetectionSensitivity;
    //this.StarDetectorObj.upperLimit = parameters.upperLimit;

    this.SizeGrouping = {
      minIntervalWidth: 1.0,          // minimum interval width for Size Grouping, in pixels
      maxIntervalsNumber: 5,           // maximum number of result intervals fro Size Grouping
      numIntervals: undefined,         // Calculated number of intervals
      IntervalWidth: undefined         // Calculated interval width
    };

    this.FluxGrouping = {
      minIntervalWidth: 1.0,          // minimum interval width for Size Grouping, in pixels
      maxIntervalsNumber: 5,           // maximum number of result intervals fro Size Grouping
      numIntervals: undefined,         // Calculated number of intervals
      IntervalWidth: undefined         // Calculated interval width
    };

    this.Stat = {
      flux_min: MAX_INT,
      flux_max: 0,
      bg_min: 1,
      bg_max: 0,
      w_min: MAX_INT,
      w_max:   0,
      h_min: MAX_INT,
      h_max: 0,
      size_max: 0,
      size_min: MAX_INT,
      r_max: 0,
      r_min: MAX_INT,
      nmax_max: 0,
      nmax_min: MAX_INT,
    };

    this.curFilter = {
      type : "",
      min : 0,
      max : MAX_INT,
    }

    this.cntFittedStars = 0;


/*
 * Proccess source image and get all stars from it
 */
    this.getStars = function ( sourceView )
	{
        debug("<br>Running [" + "GetStars(sourceView = '" + sourceView.fullId +  "')]");

        this.sourceView = sourceView;
        this.sourceImage = sourceView.image;

        this.workingView = this.sourceView;
        this.workingImage = this.sourceImage;

        this.addPedestal(); // add pedestal to image if needed

        this.lastProgressPc = 0;
        console.show();

        function progressCallback ( count, total )
        {
            if ( count == 0 )
            {
            console.write( "<end><cbr>Detecting stars:   0%" );
            this.lastProgressPc = 0;
            processEvents();
            }
            else if (count == total || count % 500 == 0)
            {
                let pc = Math.round( 100*count/total );
                if ( pc > this.lastProgressPc )
                {
                   console.write( format( "<end>\b\b\b\b%3d%%", pc ) );
                   this.lastProgressPc = pc;
                   processEvents();
                }
            }
            return true;
        }

        this.StarDetectorObj.progressCallback = progressCallback;

        let T = new ElapsedTime;
        this.Stars = this.StarDetectorObj.stars( this.workingImage ); // run StarDetector
        console.writeln( format( "<end><cbr><br>* StarDetector: %d stars found ", this.Stars.length ) );
        console.writeln( T.text );

        return this.Stars;
    }
   
/*
 * Fit stars profiles using DynamicPSF process
 */
   this.fitStarPSF = function (StarsArray = undefined)
   {      
      debug("<br>Running [" + "fitStarPSF(StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + ")]");
      
      if (!StarsArray)
         StarsArray = this.Stars;
      
      if (!StarsArray)
         return false;
      
      if (!this.Stat.w_max || !this.Stat.h_max)
         this.calculateStarStats( StarsArray );

      var dynamicPSF = new DynamicPSF;

      dynamicPSF.autoPSF = true;
      /*
      dynamicPSF.circularPSF = false;
      dynamicPSF.gaussianPSF = parameters.modelFunctionIndex == 0;
      dynamicPSF.moffatPSF = false;
      dynamicPSF.moffat10PSF = parameters.modelFunctionIndex == 1;
      dynamicPSF.moffat8PSF = parameters.modelFunctionIndex == 2;
      dynamicPSF.moffat6PSF = parameters.modelFunctionIndex == 3;
      dynamicPSF.moffat4PSF = parameters.modelFunctionIndex == 4;
      dynamicPSF.moffat25PSF = parameters.modelFunctionIndex == 5;
      dynamicPSF.moffat15PSF = parameters.modelFunctionIndex == 6;
      dynamicPSF.lorentzianPSF = parameters.modelFunctionIndex == 7;
      */
      dynamicPSF.circularPSF  = true;
      dynamicPSF.gaussianPSF  = true;  //parameters.modelFunctionIndex == 0;
      dynamicPSF.moffatPSF    = true;
      dynamicPSF.moffat10PSF  = true;  //parameters.modelFunctionIndex == 1;
      dynamicPSF.moffat8PSF   = true;  //parameters.modelFunctionIndex == 2;
      dynamicPSF.moffat6PSF   = true;  //parameters.modelFunctionIndex == 3;
      dynamicPSF.moffat4PSF   = true;  //parameters.modelFunctionIndex == 4;
      dynamicPSF.moffat25PSF  = true;  //parameters.modelFunctionIndex == 5;
      dynamicPSF.moffat15PSF  = true;  //parameters.modelFunctionIndex == 6;
      dynamicPSF.lorentzianPSF = true; //parameters.modelFunctionIndex == 7;
      dynamicPSF.regenerate   = true;
      
      dynamicPSF.searchRadius = Math.max( this.Stat.w_max, this.Stat.h_max );
      dynamicPSF.searchRadius = dynamicPSF.searchRadius >= 20 ? 120 : dynamicPSF.searchRadius;
      dynamicPSF.searchRadius = 120;
      

      var views = new Array;
      views.push(new Array(this.workingView.fullId));
      dynamicPSF.views = views;


      var stars = new Array;
      for (var i = 0; i < StarsArray.length; i++) {
         let s = StarsArray[i];
         stars.push(new Array(
            0, 0, DynamicPSF.prototype.Star_DetectedOk,
            s.pos.x - s.sizeRadius,
            s.pos.y - s.sizeRadius,
            s.pos.x + s.sizeRadius,
            s.pos.y + s.sizeRadius,
            s.pos.x,
            s.pos.y
         ));
      }
      dynamicPSF.stars = stars;
      
      if (__DEBUGF__)
      {
         dynamicPSF.setDescription("Test");
         let sProcIcon = "PSFSave1";
         var icons = ProcessInstance.iconsByProcessId("DynamicPSF");
         let bPFnd=false;
         for (let i = 0; i < icons.length; i++) 
            if (icons[i] == sProcIcon)
               bPFnd=true;
            
         if (bPFnd)
            dynamicPSF.writeIcon(sProcIcon);
         else
            console.warningln("Process icon [" + sProcIcon + "] not found");
      }
      
      
      var fitted = new Array(stars.length);
      for (var i = 0; i != fitted.length; ++i) {
         fitted[i] = false;
      }
      
      dynamicPSF.executeGlobal();
      
      if (__DEBUGF__)
      {
         dynamicPSF.setDescription("Test");
         let sProcIcon = "PSFSave2";
         var icons = ProcessInstance.iconsByProcessId("DynamicPSF");
         let bPFnd=false;
         for (let i = 0; i < icons.length; i++) 
            if (icons[i] == sProcIcon)
               bPFnd=true;
            
         if (bPFnd)
            dynamicPSF.writeIcon(sProcIcon);
         else
            console.warningln("Process icon [" + sProcIcon + "] not found");
      }
      
      // starIndex, function, circular, status, B, A, cx, cy, sx, sy, theta, beta, mad, celestial, alpha, delta, flux, meanSignal
      #define DYNAMICPSF_PSF_StarIndex 0
      #define DYNAMICPSF_PSF_FuncType 1
      #define DYNAMICPSF_PSF_CircularFlag 2
      #define DYNAMICPSF_PSF_Status 3
      #define DYNAMICPSF_PSF_b 4
      #define DYNAMICPSF_PSF_a 5
      #define DYNAMICPSF_PSF_cx 6
      #define DYNAMICPSF_PSF_cy 7
      #define DYNAMICPSF_PSF_sx 8
      #define DYNAMICPSF_PSF_sy 9
      #define DYNAMICPSF_PSF_theta 10
      #define DYNAMICPSF_PSF_beta 11
      #define DYNAMICPSF_PSF_residual 12
      #define DYNAMICPSF_PSF_flux 16
      
      #define DYNAMICPSF_Stars_x0 3
      #define DYNAMICPSF_Stars_y0 4
      #define DYNAMICPSF_Stars_x1 5
      #define DYNAMICPSF_Stars_y1 6

      var starProfiles = new Array;
      var psfTable = dynamicPSF.psf;
      var starsTable = dynamicPSF.stars;
      this.cntFittedStars = 0;
      for (var i = 0; i != psfTable.length; ++i) {
         let psfRow = psfTable[i];
         let idx = psfRow[DYNAMICPSF_PSF_StarIndex];
         if (
            psfRow[DYNAMICPSF_PSF_Status] == DynamicPSF.prototype.PSF_FittedOk &&
            psfRow[DYNAMICPSF_PSF_residual] < 0.1 &&
            !fitted[idx]
         ) {
            StarsArray[idx].PSF_b = psfRow[DYNAMICPSF_PSF_b];
            StarsArray[idx].PSF_a = psfRow[DYNAMICPSF_PSF_a];
            StarsArray[idx].PSF_cx = psfRow[DYNAMICPSF_PSF_cx];
            StarsArray[idx].PSF_cy = psfRow[DYNAMICPSF_PSF_cy];
            StarsArray[idx].PSF_sx = psfRow[DYNAMICPSF_PSF_sx];
            StarsArray[idx].PSF_sy = psfRow[DYNAMICPSF_PSF_sy];
            StarsArray[idx].PSF_theta = psfRow[DYNAMICPSF_PSF_theta];
            StarsArray[idx].PSF_residual = psfRow[DYNAMICPSF_PSF_residual];
            StarsArray[idx].PSF_flux = psfRow[DYNAMICPSF_PSF_flux];
            
            StarsArray[idx].PSF_rect = new Rect( starsTable[idx][DYNAMICPSF_Stars_x0], starsTable[idx][DYNAMICPSF_Stars_y0], starsTable[idx][DYNAMICPSF_Stars_x1], starsTable[idx][DYNAMICPSF_Stars_y1] );
            StarsArray[idx].PSF_diag = Math.sqrt( (StarsArray[idx].PSF_rect.x1 - StarsArray[idx].PSF_rect.x0)*(StarsArray[idx].PSF_rect.x1 - StarsArray[idx].PSF_rect.x0) + (StarsArray[idx].PSF_rect.y1 - StarsArray[idx].PSF_rect.y0)*(StarsArray[idx].PSF_rect.y1 - StarsArray[idx].PSF_rect.y0));
            
            StarsArray[idx].FWHMx = FWHM(psfRow[DYNAMICPSF_PSF_FuncType], psfRow[DYNAMICPSF_PSF_sx], psfRow[DYNAMICPSF_PSF_beta], (dynamicPSF.variableShapePSF === true));
            StarsArray[idx].FWHMy = FWHM(psfRow[DYNAMICPSF_PSF_FuncType], psfRow[DYNAMICPSF_PSF_sy], psfRow[DYNAMICPSF_PSF_beta], (dynamicPSF.variableShapePSF === true));
            
            //debug(idx + ": " + psfRow[DYNAMICPSF_PSF_FuncType] + " CF:" + psfRow[DYNAMICPSF_PSF_CircularFlag] + " b:" + StarsArray[idx].PSF_b + " a:" + StarsArray[idx].PSF_a + " " + StarsArray[idx].PSF_theta);

            fitted[idx] = true;
            this.cntFittedStars++;
         }
      }

      var nonfitted = 0;
      let idx = 0;
      fitted.forEach( 
         function (fittedf) 
         {
            if (!fittedf) {
               debug(format("Star [%d] with flux=%4.3f couldn't be fitted", idx, StarsArray[idx].flux));
               nonfitted++;
            }
            idx++;
         }
      )

      console.writeln(psfTable.length + " PSF fittings were gathered and added to stat");
      console.writeln(nonfitted + " stas couldn't be fitted");
      
      return starProfiles;
   }


/*
 * Add pedestal if needed - when image bg level is close to zero (as in case of Starnet stars)
 */
   this.addPedestal = function ()
   {
      debug("<br>Running [" + "addPedestal()]");
      
      var median = this.sourceView.computeOrFetchProperty( "Median" );
      var min = this.sourceView.computeOrFetchProperty( "Minimum" );
      debug("Image median = " + median.at(0));
      debug("Image min = " + min.at(0));
      
      if ( min.at(0) < ADDPEDESTAL_MIN_THRESHOLD && median.at(0) < ADDPEDESTAL_MEDIAN_THRESHOLD  ) {
         console.warningln("Image median = " + format( "%5.5f", median.at(0) ) + " is less then MEDIAN_THRESHOLD = " + ADDPEDESTAL_MEDIAN_THRESHOLD +  " AND Image min = " + + format( "%5.5f", min.at(0) ) + " is less then MIN_THRESHOLD " + ADDPEDESTAL_MIN_THRESHOLD + ""  );
         console.writeln("Creating temp image and adding pedestal to it");
         
         // Copy image
         let w = new ImageWindow( this.sourceView.image.width, this.sourceView.image.height,
                         this.sourceView.image.numberOfChannels,      // numberOfChannels
                         this.sourceView.image.bitsPerSample,      // bitsPerSample
                         this.sourceView.image.isReal,  // floatSample
                         this.sourceView.image.isColor,  // color
                         "TempImage" );
         w.mainView.beginProcess( UndoFlag_NoSwapFile );
         w.mainView.image.assign( this.sourceView.image );
         w.mainView.endProcess();

         debug ("Temp image created (" + w.mainView.fullId + ")");

         this.workingView = w.mainView;
         this.workingImage = this.workingView.image;
         
         if (debug) {
            w.show();
            w.zoomToFit();
         }

         var P = new PixelMath;
         P.expression = "$T + " + TEMP_PEDESTAL;
         P.useSingleExpression = true;
         P.createNewImage = false;
         P.rescale = false;
         P.truncate = true;
         P.truncateLower = 0;
         P.truncateUpper = 1;
         P.generateOutput = true;
         P.optimization = true;

         P.executeOn(this.workingView);

         debug ("Pedestal [" + TEMP_PEDESTAL + "] to temp image [" +  w.mainView.id + "] was added");
         
         return this.workingView;
      }
      
      return true;
   }

   /*
    * Close temp images if they were created
    */
   this.closeTempImages = function ()
   {
      debug("<br>Running [" + "closeTempImages()]");
      
      if (this.sourceView != this.workingView)
      {
         this.workingView.window.hide();
         this.workingView.setPropertyValue("dispose", true);
         this.workingView.window.forceClose();
         debug("TempImage closed");
      }      
      
      return true;
   }



/*
 * Calculate Stars statistics
 */
   this.calculateStarStats = function (StarsArray = undefined)
   {
      debug("<br>Running [" + "calculateStarStats( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )]");
      
      if (!StarsArray)
         StarsArray = this.Stars;
      
      if (!StarsArray)
         return false;


      this.Stat.flux_min = MAX_INT;
      this.Stat.flux_max = 0;
      this.Stat.bg_min = 1;
      this.Stat.bg_max = 0;
      this.Stat.w_min = MAX_INT;
      this.Stat.w_max= 0;
      this.Stat.h_min = MAX_INT;
      this.Stat.h_max = 0;
      this.Stat.size_max = 0;
      this.Stat.size_min = MAX_INT;
      this.Stat.r_max = 0;
      this.Stat.r_min = MAX_INT;

      for( let i=0; i < StarsArray.length; i++)
      {
         var s = StarsArray[i];
         if ( s.flux < this.Stat.flux_min ) 
            this.Stat.flux_min = s.flux;
         if ( s.flux > this.Stat.flux_max )
            this.Stat.flux_max = s.flux;

         if ( s.bkg < this.Stat.bg_min )
            this.Stat.bg_min = s.bkg;
         if ( s.bkg > this.Stat.bg_max )
            this.Stat.bg_max = s.bkg;

         if ( s.w < this.Stat.w_min )
            this.Stat.w_min = s.w;
         if ( s.w > this.Stat.w_max )
            this.Stat.w_max = s.w;

         if ( s.h < this.Stat.h_min )
            this.Stat.h_min = s.h;
         if ( s.h > this.Stat.h_max )
            this.Stat.h_max = s.h;

         if ( s.size < this.Stat.size_min )
            this.Stat.size_min = s.size;
         if ( s.size > this.Stat.size_max )
            this.Stat.size_max = s.size;

         if ( s.sizeRadius < this.Stat.r_min )
            this.Stat.r_min = s.sizeRadius;
         if ( s.sizeRadius > this.Stat.r_max )
            this.Stat.r_max = s.sizeRadius;

         if ( s.nmax < this.Stat.nmax_min )
            this.Stat.nmax_min = s.nmax;
         if ( s.nmax > this.Stat.nmax_max )
            this.Stat.nmax_max = s.nmax;

      }
   
      // run calculate Size grouping
      this._calculateStarStats_SizeGrouping(StarsArray);
      // run calculate Flux grouping
      this._calculateStarStats_FluxGroupingLog(StarsArray);
      
      return true;
   }

   /*
    * Calculate Stars statistics  - grouping by StarSize
    */
   this._calculateStarStats_SizeGrouping = function (StarsArray = undefined, numIntervals = undefined)
   {
      //debug("Running [" + "CalculateStarStats_SizeGrouping" + "]");
      debug("<br>Running [" + "calculateStarStats_SizeGrouping( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + ", numIntervals = " + numIntervals + " )]");
      
      if ( !StarsArray )
         StarsArray = this.Stars;

      if ( !StarsArray )
         return false;

      if (!this.Stat.r_min || !this.Stat.r_max)
         this.calculateStarStats( StarsArray );

      var sizeWidth = this.Stat.r_max - this.Stat.r_min;
      
      // if not given calculate intervals 
      if (!numIntervals)
      {
         var numSizeIntervals1 =   sizeWidth / this.SizeGrouping.minIntervalWidth ;
         var numSizeIntervals0 =  Math.round( numSizeIntervals1 );
         this.SizeGrouping.numIntervals = Math.min ( numSizeIntervals0, this.SizeGrouping.maxIntervalsNumber);
      } 
      else 
      {
         this.SizeGrouping.numIntervals = numIntervals;
      }
      
      this.SizeGrouping.IntervalWidth = Math.round(sizeWidth / this.SizeGrouping.numIntervals * 10.0) / 10.0; // rounding to 0.1
      
      debug("SizeGrouping: sizeWidth=" + sizeWidth + ", numSizeIntervals1,0=(" + numSizeIntervals1 + ", " + numSizeIntervals0 + ")");
      debug("<b>SizeIntervalWidth=" + this.SizeGrouping.IntervalWidth + ", numSizeIntervals=" + this.SizeGrouping.numIntervals + "</b>");
      
      var StarsSizeGoupCnt_arr = [];
      for( let i=0; i < StarsArray.length; i++)
      {
         var s = StarsArray[i];
         var GroupInterval = Math.trunc( (s.sizeRadius - this.Stat.r_min) / this.SizeGrouping.IntervalWidth );
         StarsArray[i].sizeGroup = (GroupInterval < this.SizeGrouping.numIntervals ? GroupInterval : this.SizeGrouping.numIntervals-1) ;
         if (! StarsSizeGoupCnt_arr[StarsArray[i].sizeGroup])
            StarsSizeGoupCnt_arr[StarsArray[i].sizeGroup] = 1;
         else
            StarsSizeGoupCnt_arr[StarsArray[i].sizeGroup]++;
      }
      
      this.StarsSizeGoupCnt = StarsSizeGoupCnt_arr;
      
      return StarsSizeGoupCnt_arr;
   }

   /*
    * Calculate Stars statistics  - grouping by StarSize
    * obsolete
    */
   this.__calculateStarStats_FluxGrouping = function (StarsArray = undefined, numIntervals = undefined)
   {
      debug("Running [" + "CalculateStarStats_FluxGrouping" + "]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      if (!this.Stat.flux_min || !this.Stat.flux_max)
         this.calculateStarStats( StarsArray );

      var fluxWidth = this.Stat.flux_max - this.Stat.flux_min;
      
      // if not given calculate intervals 
      if (!numIntervals)
      {
         var numFluxIntervals1 =   fluxWidth / this.FluxGrouping.minIntervalWidth ;
         var numFluxIntervals0 =  Math.round( numFluxIntervals1 );
         this.FluxGrouping.numIntervals = Math.min ( numFluxIntervals0, this.FluxGrouping.maxIntervalsNumber);
      } 
      else 
      {
         this.FluxGrouping.numIntervals = numIntervals;
      }
      
      this.FluxGrouping.IntervalWidth = Math.round(fluxWidth / this.FluxGrouping.numIntervals * 10.0) / 10.0; // rounding to 0.1
      
      debug("FluxGrouping: fluxWidth=" + fluxWidth + ", numFluxIntervals0=(" + numFluxIntervals1 + ", " + numFluxIntervals0 + ")");
      debug("<b>FluxIntervalWidth=" + this.FluxGrouping.IntervalWidth + ", numFluxIntervals=" + this.FluxGrouping.numIntervals + "</b>");
      
      let StarsFluxGoupCnt_arr = [];
      for( let i=0; i < StarsArray.length; i++)
      {
         let s = StarsArray[i];
         let GroupInterval = Math.trunc( (s.flux - this.Stat.flux_min) / this.FluxGrouping.IntervalWidth );
         StarsArray[i].fluxGroup = (GroupInterval < this.FluxGrouping.numIntervals ? GroupInterval : this.FluxGrouping.numIntervals-1) ;
         if (! StarsFluxGoupCnt_arr[StarsArray[i].fluxGroup])
            StarsFluxGoupCnt_arr[StarsArray[i].fluxGroup] = 1;
         else
            StarsFluxGoupCnt_arr[StarsArray[i].fluxGroup]++;
      }
      
      this.StarsFluxGoupCnt = StarsFluxGoupCnt_arr;
      
      return StarsFluxGoupCnt_arr;
   }

   /*
    * Calculate Stars statistics  - grouping by Log10 of StarFlux
    */
   this._calculateStarStats_FluxGroupingLog = function (StarsArray = undefined, numIntervals = undefined)
   {
      debug("<br>Running [" + "calculateStarStats_FluxGroupingLog( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + ", numIntervals = " + numIntervals + " )]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      if (!this.Stat.flux_min || !this.Stat.flux_max)
         this.calculateStarStats( StarsArray );

      var fluxWidth = Math.log10( this.Stat.flux_max / this.Stat.flux_min );
      
      // if not given calculate intervals 
      if (!numIntervals)
      {
         var numFluxIntervals0 =  Math.round( fluxWidth / this.FluxGrouping.minIntervalWidth );
         this.FluxGrouping.numIntervals = Math.min ( numFluxIntervals0, this.FluxGrouping.maxIntervalsNumber);
      } 
      else 
      {
         this.FluxGrouping.numIntervals = numIntervals;
      }
      
      this.FluxGrouping.IntervalWidth = Math.round( fluxWidth / this.FluxGrouping.numIntervals * 10.0) / 10.0; // rounding to 0.1
      
      debug("FluxGrouping settings: minIntervalWidth = " + this.FluxGrouping.minIntervalWidth + ", maxIntervalsNumber = " + this.FluxGrouping.maxIntervalsNumber);
      debug("FluxGrouping: fluxLogWidth=" + fluxWidth + ", numFluxIntervals0="+ numFluxIntervals0 + "");
      debug("<b>FluxLogIntervalWidth=" + this.FluxGrouping.IntervalWidth + ", numFluxIntervals=" + this.FluxGrouping.numIntervals + "</b>");
      
      let StarsFluxGoupCnt_arr = [];
      for( let i=0; i < StarsArray.length; i++)
      {
         let s = StarsArray[i];
         let GroupInterval = Math.trunc( Math.log10(s.flux / this.Stat.flux_min) / this.FluxGrouping.IntervalWidth );
         StarsArray[i].fluxLog = Math.log10( s.flux / this.Stat.flux_min ) ;
         StarsArray[i].fluxGroup = (GroupInterval < this.FluxGrouping.numIntervals ? GroupInterval : this.FluxGrouping.numIntervals-1) ;
         if (! StarsFluxGoupCnt_arr[StarsArray[i].fluxGroup])
            StarsFluxGoupCnt_arr[StarsArray[i].fluxGroup] = 1;
         else
            StarsFluxGoupCnt_arr[StarsArray[i].fluxGroup]++;
      }
      
      this.StarsFluxGoupCnt = StarsFluxGoupCnt_arr;
      
      return StarsFluxGoupCnt_arr;
   }


   /*
    * Filter out some Stars based on their radius
    */
   this.filterStarsBySize = function (minRadius = 0, maxRadius = MAX_INT, StarsArray = undefined)
   {
      debug("Running [" + "filterStarsBySize" + "]");
      
      console.writeln(format("Filtering StarSizes to [%d, %d)", minRadius, maxRadius));
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      this.curFilter.type = "Size";
      this.curFilter.min = minRadius;
      this.curFilter.max = maxRadius;

      this.cntFittedStars = 0;
      
      var FilteredStars=[];
      for ( let i=0; i < StarsArray.length; i++ )
      {
         let s = StarsArray[i];
         if ( s.sizeRadius >= minRadius && s.sizeRadius < maxRadius  ) 
         {
            FilteredStars.push( s ); 
            if ( s.PSF_flux ) {
               this.cntFittedStars++;
            }
         }
      }

      return FilteredStars;
   }

   /*
    * Filter out some stars based on their flux
   */
   this.filterStarsByFlux = function (minFlux = 0, maxFlux = MAX_INT, StarsArray = undefined)
   {
      debug("<br>Running [" + "filterStarsByFlux( minFlux = " + minFlux + ", maxFlux = " + maxFlux + " , StarsArray = "  + (StarsArray?StarsArray.length:StarsArray) + " )" + "]");
      
      console.writeln(format("<b>Filtering StarFluxes to [%5.3f, %5.3f)</b>", minFlux, maxFlux));
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
      
      this.curFilter.type = "Flux";
      this.curFilter.min = minFlux;
      this.curFilter.max = maxFlux;

      this.cntFittedStars = 0;

      var FilteredStars=[];
      for ( let i=0; i < StarsArray.length; i++ )
      {
         let s = StarsArray[i];
         if ( s.flux >= minFlux && s.flux < maxFlux  ) 
         {
            FilteredStars.push( s ); 
            if ( s.PSF_flux ) {
               this.cntFittedStars++;
            }
         }
      }

      return FilteredStars;
   }


   /*
    * Print Stars array to console
   */
   this.printStars = function (StarsArray = undefined, topRecords = 0)
   {
      debug("<br>Running [" + "printStars( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + ", topRecords = " + topRecords + " )]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      // Run calculate stats in case of wasn't done earlier
      if (!this.Stat.bg_min || !this.Stat.bg_max)
         this.calculateStarStats(StarsArray);

      // Header
      console.noteln( "-".repeat(100) );
      console.noteln( format(
         "(%6s, %6s): %6s / %7s [%2s, %2s]: %3s %3s  | %3s |%3s|%3s" + 
         "|%6s / %7s | %7s | %7s |%4s|[%2s, %2s]",
         "x", "y", "flux", "bckgrnd", "w", "h", "Sz", "R", "nmx", "SzG", "FlG",
         "psf_F", "psf_B", "psf_A", "FHWHx FHWHy", "Angle", "Pw", "Ph"
      ));
      console.noteln( "-".repeat(100) );
      
      // Rows
      if ( topRecords == 0 )
         topRecords = StarsArray.length;
      
      for (let i=0; i < topRecords; i++)
      {
         let s = StarsArray[i];
         console.write( format(
            "(%6.1f, %6.1f): %6.3f / %7.5f [%2d, %2d]: %3d %4.1f | (%1d) | %1d | %1d |",
            s.pos.x, s.pos.y, s.flux, s.bkg, s.w, s.h, s.size, s.sizeRadius, s.nmax, s.sizeGroup, s.fluxGroup
            ));
         if (s.PSF_flux && s.PSF_b && s.PSF_a)
         {
            console.write( format(
               "%6.2f / %7.5f | %7.5f | %3.2f x %3.2f | %3.0f|[%2d, %2d]", 
               s.PSF_flux, s.PSF_b, s.PSF_a, s.FWHMx, s.FWHMy, s.PSF_theta, (s.PSF_rect.x1 - s.PSF_rect.x0), (s.PSF_rect.x1 - s.PSF_rect.x0)
               ));
         }
         console.writeln();
      }

      // Total
      console.noteln( "=".repeat(100) );
      console.noteln( format("Stars %5d %4s: %6.3f / %7.5f [%2d, %2d]: %3d %4.1f | (%1d) |   |   |", StarsArray.length, "min", this.Stat.flux_min, this.Stat.bg_min, this.Stat.w_min, this.Stat.h_min, this.Stat.size_min, this.Stat.r_min, this.Stat.nmax_min));
      console.noteln( format(         "%16s: %6.3f / %7.5f [%2d, %2d]: %3d %4.1f | (%1d) |   |   |", "max", this.Stat.flux_max, this.Stat.bg_max, this.Stat.w_max, this.Stat.h_max, this.Stat.size_max, this.Stat.r_max, this.Stat.nmax_max));
      console.noteln( "=".repeat(100) );

      // Legend
      console.writeln("Legend: nmax=0, nmax=");
      
      return true;
   }
   
   /*
    * Print GroupStats Stars array to console
    */
   this.printGroupStat = function (StarsArray = undefined)   
   {
      debug("<br>Running [" + "printGroupStat( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )]");


      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      // Run calculate stats in case of wasn't done earlier
      if (!this.StarsSizeGoupCnt || !this.StarsFluxGoupCnt)
         this.CalculateStarStats(StarsArray);

      // Print Size Grouping
      var lo=0, hi=0;
      console.noteln("<cbr><br>StarSize grouping " + "[" + this.StarsSizeGoupCnt.length + "]:");
      for( let i=0; i< this.StarsSizeGoupCnt.length; i++)
      {
         lo = this.Stat.r_min + i * this.SizeGrouping.IntervalWidth;
         if (i == this.StarsSizeGoupCnt.length-1)
            hi = this.Stat.r_max;
         else
            hi = lo + this.SizeGrouping.IntervalWidth;
            
         console.writeln( format("(%d) [%4.1f, %4.1f]: %4d", i, lo, hi, (this.StarsSizeGoupCnt[i] ? this.StarsSizeGoupCnt[i] : 0) ) );
      }

      // Print Flux Grouping
      var lo=hi=0;
      console.noteln("<cbr><br>Flux grouping " + "[" + this.StarsFluxGoupCnt.length + "]:");
      for( let i=0; i< this.StarsFluxGoupCnt.length; i++)
      {
         lo = Math.pow( 10, this.FluxGrouping.IntervalWidth * i) *  this.Stat.flux_min ;
         if (i == this.StarsFluxGoupCnt.length-1)
            hi = this.Stat.flux_max ;
         else
            hi = Math.pow( 10, this.FluxGrouping.IntervalWidth * (i+1)) *  this.Stat.flux_min ;;
            
         console.writeln( format("(%d) [%5.2f, %5.2f]: %4d", i, lo, hi, (this.StarsFluxGoupCnt[i] ? this.StarsFluxGoupCnt[i] : 0) ) );
      }
      
      return true;
   }
   
   /*
    * Output Stars array to file
   */
   this.saveStars = function (fileName = "StarSizeMask.csv", StarsArray = undefined)
   {
      debug("<br>Running [" + "saveStars(fileName = '" + fileName + "', StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      // Run calculate stats in case of wasn't done earlier
      if (!this.StarsSizeGoupCnt || !this.StarsFluxGoupCnt)
         this.CalculateStarStats(StarsArray);
      
      console.writeln("Writing to file <b>" + fileName + "</b>...");

      try
      {
         var f = File.createFileForWriting( fileName );
         
         var header = [ "i", "x", "y", "flux", "bckgrnd", "w", "h", "size", "Rsize", "nmax", "SizeGroup", "FluxGroup" ];
         header.push( "RA", "Dec" );
         header.push( "psf_F", "psf_B", "psf_A", "Angle", "FHWHx", "FHWHy", "psfRect_w", "psfRect_h", "res" );
         
         f.outTextLn( header.join ( csvSeparator + " " ) );

         for ( let i = 0; i < StarsArray.length; ++i )
         {
            let s = StarsArray[i];
            let data = [ i, s.pos.x, s.pos.y, s.flux, s.bkg, s.w, s.h, s.size, s.sizeRadius, s.nmax, s.sizeGroup, s.fluxGroup ];

            // if astrometric solution is present save it also
            let q = undefined;
            if (this.sourceView.window.astrometricSolutionSummary().length > 0)
               q = this.sourceView.window.imageToCelestial( s.pos.x, s.pos.y );
            if (q)
               data.push (q.x, q.y);
            else
               data.push ("", "");

            if (s.PSF_rect)
               data.push( s.PSF_flux, s.PSF_b, s.PSF_a, s.PSF_theta, s.FWHMx, s.FWHMy, s.PSF_rect.x1 - s.PSF_rect.x0, s.PSF_rect.y1 - s.PSF_rect.y0, s.PSF_residual );
            
            f.outTextLn( data.join( csvSeparator + " " ) ) ;
         }
         f.close();
         console.writeln("Done");
      }
      catch (ex)
      {
         console.criticalln( "Writing to file [" + fileName + "] failed: " + ex.message );
         //new MessageBox( "Reading header failed: " + ex.message + "\r\n" + fileName ).execute();
      }      
      
      return true;
   }

    
  /*****************************************************************************************************************************************
   * Create StarMask from image array
   *
   * Parameters:
   *    - StarsArray: array of (filtered if needed) stars
   *    - softenMask = true: convolve mask after Creating
   *    - maskGrowth = true: increase mask over detected and fitted PSF
   *    - contourMask = false: fills the center of the star with black
   *    - maskName = "stars": mask name
   *    
   * Returns:
   *    w.mainView.fullId - mask image id
   *****************************************************************************************************************************************/
   this.createMaskAngle = function (StarsArray=undefined, softenMask = true, maskGrowth = true,  contourMask = false, maskName = "stars")
   {
      debug("<br>Running [" + "createMaskAngle( StarsArray=" + (StarsArray?StarsArray.length:StarsArray) + ", softenMask = " + softenMask + ", maskGrowth = " + maskGrowth + ",  contourMask = " + contourMask + ", maskName = '" + maskName + "' )" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      let bmp = new Bitmap( this.sourceImage.width, this.sourceImage.height );
      bmp.fill( 0x0 );

      let G = new VectorGraphics( bmp );
      G.antialiasing = true;
      G.pen = new Pen( 0xffffffff );

      var AdjF = 5;

      for ( let i = 0; i < StarsArray.length; i++ )
      {
         let s = StarsArray[i];

         // PSF fitting
         if (s.PSF_rect)
         {
            if (maskGrowth) {
               //AdjF = ( (s.fluxGroup ? s.fluxGroup : 0) + 1) * 2 + 2;
               let diagonal = s.PSF_diag;
               AdjF = diagonal / Math.max( s.FWHMx, s.FWHMy );
               //debug("AdjF="+AdjF+", diagonal="+diagonal+", Math.max(s.FWHMx, s.FWHMy)="+Math.max(s.FWHMx, s.FWHMy));
            }
            G.translateTransformation( s.PSF_cx, s.PSF_cy );
            G.rotateTransformation( s.PSF_theta * Math.PI / 180 );            
            G.fillEllipse( - s.FWHMx  * AdjF / 2.0, - s.FWHMy * AdjF / 2.0,  s.FWHMx  * AdjF/ 2.0, s.FWHMy  * AdjF / 2.0, new Brush(0xFFFFFFFF) );
            //G.fillEllipse( - s.FWHMx  , - s.FWHMy ,  s.FWHMx  , s.FWHMy  , new Brush(0xFFFFFFFF) );
            //let w = s.PSF_rect.x1 - s.PSF_rect.x0;
            //let h = s.PSF_rect.y1 - s.PSF_rect.y0;
            //G.drawRect( - w/2, -h/2, w/2, h/2);
            G.resetTransformation();            
         }
         else
         {
            // NO PSF fitting for largest stars
            if ( s.fluxGroup == this.FluxGrouping.numIntervals-1 )
            {
               this.prevPSFfitted(i)
               var prev = this.prevPSFfitted(i);
               var next = this.nextPSFfitted(i);
               debug("idx = " + i + ", prev = " + prev.PSF_flux + ", next = " + next.PSF_flux);
               let diagonal = next.PSF_diag;
               let k = diagonal / next.flux;
               let newDiag = s.flux * k;
               StarsArray[i].PSF_diag = newDiag;
               debug("s.flux = " + s.flux + ", next.psfRect_w = " + next.psfRect_w + ", s.PSF_diag = " + s.PSF_diag);
               // G.fillEllipse( - s.FWHMx  * AdjF / 2.0, - s.FWHMy * AdjF / 2.0,  s.FWHMx  * AdjF/ 2.0, s.FWHMy  * AdjF / 2.0, new Brush(0xFFFFFFFF) );
               
               let w = newDiag / Math.sqrt( 2 );
               G.fillEllipse( s.pos.x - w/2, s.pos.y - w/2, s.pos.x + w/2, s.pos.y + w/2, new Brush( __DEBUGF__?0xFFAAAAAA:0xFFFFFFFF ) );
            }
            
            //debug("No PSF Rect for " + i);
            G.fillEllipse( s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1, new Brush( __DEBUGF__?0xFFAAAAAA:0xFFFFFFFF ) );
         }

         if (contourMask) 
            G.fillEllipse( s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1, new Brush(0xFF111111) );
         
         //G.strokeRect( s.pos.x-0.5, s.pos.y-0.5, s.pos.x+0.5, s.pos.y+0.5 );
      }
      G.end();

      let w = new ImageWindow( bmp.width, bmp.height,
            1,      // numberOfChannels
            8,      // bitsPerSample
            false,  // floatSample
            false,  // color
            maskName );
      w.mainView.beginProcess( UndoFlag_NoSwapFile );
      w.mainView.image.blend( bmp );
      w.mainView.endProcess();
      w.show();
      w.zoomToFit();

      this.addFITSData( w, StarsArray );

      if (softenMask)
      {
         var P = new Convolution;
         P.mode = Convolution.prototype.Parametric;
         P.sigma = 4.00;
         P.shape = 2.00;
         P.aspectRatio = 1.00;
         P.rotationAngle = 0.00;
         
         P.executeOn(w.mainView);
      }

      console.writeln("StarMask [" + w.mainView.id + "] based on " + StarsArray.length + " stars was created" + (contourMask?" [contour mode]":""));

      return w.mainView.fullId;
   }


   /******************************************************************************************************************************************
    * Create Image with detected stars marked
    *
    *
    ******************************************************************************************************************************************/
   this.markStars = function( StarsArray = undefined, imageName = "DetectedStars" )
   {
      debug("<br>Running [" + "markStars( StarsArray=" + (StarsArray?StarsArray.length:StarsArray) + ", imageName = '" + imageName + "' )" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      let bmp = new Bitmap( this.sourceImage.width, this.sourceImage.height );
      bmp.fill( 0x0 );

      let G = new VectorGraphics( bmp );
      G.antialiasing = true;
      //G.pen = new Pen( 0xffffffff );
      G.pen = new Pen(0xffff00ff, 1); //   g.pen= new Pen(0xff32CD32, 2);

      var PensArr = [new Pen(0xff001177, 1), new Pen(0xff009900, 1), new Pen(0xff990099, 1), new Pen(0xffffff00, 1), new Pen(0xffff0000, 1)];

      //G.pen = new Pen( 0xff000000 );

      for ( let i = 0, n = StarsArray.length ; i < n; ++i )
      {
         let s = StarsArray[i];
         G.strokeEllipse( s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1, PensArr[s.fluxGroup] );
         //G.strokeRect( s.pos.x-0.5, s.pos.y-0.5, s.pos.x+0.5, s.pos.y+0.5 );
         if (s.PSF_rect)
            G.strokeRect( s.PSF_rect.x0, s.PSF_rect.y0, s.PSF_rect.x1, s.PSF_rect.y1, PensArr[s.fluxGroup]);
      }
      G.end();

      let w = new ImageWindow( this.sourceImage.width, this.sourceImage.height,
                               3,      // numberOfChannels
                               this.sourceImage.bitsPerSample,      // bitsPerSample
                               this.sourceImage.isReal,  // floatSample
                               true,  // color
                               imageName );
      w.mainView.beginProcess( UndoFlag_NoSwapFile );
      w.mainView.image.assign( this.sourceImage );
      w.mainView.image.colorSpace = ColorSpace_RGB,
      w.mainView.image.blend( bmp );
      w.mainView.endProcess();

      this.addFITSData( w, StarsArray );

      w.mainView.stf = this.sourceView.stf;
      
      w.show();
      w.zoomToFit();

      console.writeln("StarMap [" + imageName + "] based on " + StarsArray.length + " stars was created");

      return w.mainView.fullId;
   }



   /******************************************************************************************************************************************
    * Create Image with removed detected stars + mask on
    *
    *    starMaskId  - starmask image id created through this.createAngleMask() method
    *    StarsArray   - stars array, used only to insert keywords
    *    imageName   - new image id
    ******************************************************************************************************************************************/
   this.makeResidual = function( starMaskId, StarsArray = undefined, imageName = "StarsResidual" )
   {
      debug("<br>Running [" + "makeResidual( starMaskId = " + starMaskId + ", StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + ", imageName = '" + imageName + "' )" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      var images = ImageWindow.windows;
      var starMask = undefined;
      for ( var i = 0; i < images.length; i++ )
      {
         if ( images[i].mainView.fullId == starMaskId ) 
            starMask = images[i];
      }
      
      if (!starMask) 
      {
         console.criticalln("Can't find starmask ['" + starMaskId + "']");
         return false;
      }


      var median = this.sourceView.computeOrFetchProperty( "Median" );
      debug("Image median = " + median.at(0));
      
      // Copy image
      let w = new ImageWindow( this.sourceView.image.width, this.sourceView.image.height,
                      this.sourceView.image.numberOfChannels,      // numberOfChannels
                      this.sourceView.image.bitsPerSample,      // bitsPerSample
                      this.sourceView.image.isReal,  // floatSample
                      this.sourceView.image.isColor,  // color
                      imageName );
      w.mainView.beginProcess( UndoFlag_NoSwapFile );
      w.mainView.image.assign( this.sourceView.image );
      w.mainView.endProcess();
      
      this.addFITSData( w, StarsArray );

      // Put created mask on
      w.maskVisible = false;
      w.maskInverted = false;
      w.mask = starMask;

      // Fill with median
      var P = new PixelMath;
      P.expression = median.at(0).toString();
      P.useSingleExpression = true;
      P.createNewImage = false;
      P.rescale = false;
      P.truncate = true;
      P.truncateLower = 0;
      P.truncateUpper = 1;
      P.generateOutput = true;
      P.optimization = true;
      P.executeOn(w.mainView);

      // Prepare image to view
      w.maskInverted = true;
      w.maskVisible = true;

      w.mainView.stf = this.sourceView.stf;

      w.show();
      w.zoomToFit();

      console.writeln("Residual image was created");
      
      return this.workingView;
   }



   /*
    * Add data into image header (FITS or other format)
   */
   this.addFITSData = function (imageWindow, StarsArray = undefined, additionalKeywords = undefined)
   {
      debug("<br>Running [" + "addFITSData( imageWindow = '" + imageWindow.mainView.id + "', StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + ", additionalKeywords = " + (additionalKeywords?additionalKeywords.length:additionalKeywords) + " )" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
 
      // Run calculate stats in case of wasn't done earlier
      if (!this.StarsSizeGoupCnt || !this.StarsFluxGoupCnt)
         this.CalculateStarStats(StarsArray);
 
      // add keywords
      imageWindow.mainView.beginProcess( UndoFlag_Keywords );
      let keywords =imageWindow.keywords;

      keywords.push( new FITSKeyword( "STARSDET", format( "%d", StarsArray.length ), "Number of stars beeing detected" ) );
      keywords.push( new FITSKeyword( "STARSPSF", format( "%d", this.cntFittedStars ), "Number of stars beeing fitted" ) );
      //keywords.push( new FITSKeyword( "STARSPSF", format( "%d", this.cntFittedStars ), "Number of stars beeing fitted" ) );

      keywords.push( new FITSKeyword( "FILTTYPE", format( "%s", this.curFilter.type ), "Applied filters (last one)" ) );
      if (this.curFilter.type != "")
      {  
         keywords.push( new FITSKeyword( "FILTMIN",  format( "%.3f", this.curFilter.min ),  "Filter minimum value" ) );
         keywords.push( new FITSKeyword( "FILTMAX",  format( "%.3f", this.curFilter.max ),  "Filter maximum value" ) );
      } 
      else

      // Print Size Grouping
      var lo=0, hi=0;
      for( let i=0; i< this.StarsSizeGoupCnt.length; i++)
      {
         lo = this.Stat.r_min + i * this.SizeGrouping.IntervalWidth;
         if (i == this.StarsSizeGoupCnt.length-1)
            hi = this.Stat.r_max;
         else
            hi = lo + this.SizeGrouping.IntervalWidth;
            
         //console.writeln( format("(%d) [%3.1f, %3.1f]: %3d", i, lo, hi, (this.StarsSizeGoupCnt[i] ? this.StarsSizeGoupCnt[i] : 0) ) );
         keywords.push( new FITSKeyword( "SG_" + i + "_INT", format( "[%3.1f, %3.1f]", lo, hi) , "Number of stars in group " ) );
         keywords.push( new FITSKeyword( "SG_" + i + "_CNT", format( "%d", this.StarsSizeGoupCnt[i] ? this.StarsSizeGoupCnt[i] : 0 ), format("(%d) [%3.1f, %3.1f]", i, lo, hi) ) );
      }

      // Print Flux Grouping
      var lo=0, hi=0;
      for( let i=0; i< this.StarsFluxGoupCnt.length; i++)
      {
         lo = Math.pow( 10, this.FluxGrouping.IntervalWidth * i) *  this.Stat.flux_min ;
         if (i == this.StarsFluxGoupCnt.length-1)
            hi = this.Stat.flux_max ;
         else
            hi = Math.pow( 10, this.FluxGrouping.IntervalWidth * (i+1)) *  this.Stat.flux_min ;;
            
         //console.writeln( format("(%d) [%3.2f, %3.2f]: %3d", i, lo, hi, (this.StarsFluxGoupCnt[i] ? this.StarsFluxGoupCnt[i] : 0) ) );
         keywords.push( new FITSKeyword( "FG_" + i + "_INT", format( "[%3.3f, %3.3f]", lo, hi) , "Interval size" ) );
         keywords.push( new FITSKeyword( "FG_" + i + "_CNT", format( "%d", this.StarsFluxGoupCnt[i] ? this.StarsFluxGoupCnt[i] : 0 ), format("[%3.3f, %3.3f] %3d", lo, hi, this.StarsFluxGoupCnt[i] ? this.StarsFluxGoupCnt[i] : 0) ) );
      }

      // add additional keywords if specified
      if (additionalKeywords)
      {
         for( let i=0; i< additionalKeywords.length; i++)
         {
            keywords.push( additionalKeywords[i] );
         }
      }
      
      imageWindow.keywords = keywords;
      imageWindow.mainView.endProcess();    

      return true;
   }
   
   this.prevPSFfitted = function( idx, StarsArray = undefined )
   {
      debug("<br>Running [" + "prevPSFfitted( idx = '" + idx + "', StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )" + "]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
      
      var fndidx = -1;
      for( let i=idx; i>=0; i--)
      {
         if (StarsArray[i].PSF_rect)
         {
            fndidx = i;
            break;
         }
      }
      
      if ( fndidx >= 0 )
         return StarsArray[fndidx];
      else
         return false;
   }
   
   this.nextPSFfitted = function( idx, StarsArray = undefined )
   {
      debug("<br>Running [" + "nextPSFfitted( idx = '" + idx + "', StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )" + "]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
      
      var fndidx = -1;
      for( let i=idx; i<StarsArray.length; i++)
      {
         if (StarsArray[i].PSF_rect)
         {
            fndidx = i;
            break;
         }
      }
      
      if ( fndidx >= 0 )
         return StarsArray[fndidx];
      else
         return false;
   } 
   
   /*
    * Expremimental, not finished
    */
   this.getGaia = function(StarsArray = undefined)
   {
      debug("<br>Running [" + "getGaia( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

		cat = new Gaia();
		cat.command = "search";
		cat.dataRelease = Gaia.prototype.DataRelease_3;
		cat.centerRA = 308.087500000;
		cat.centerDec = 59.863611111;
		cat.radius = 0.166694;
		cat.magnitudeLow = -1.500;
		cat.magnitudeHigh = 17.000;		// Some other config to the process
		
		cat.generateTextOutput = true;
		cat.generateBinaryOutput = false;
		cat.textFormat = Gaia.prototype.TextFormat_TabularCompound;
		cat.textHeaders = Gaia.prototype.TextHeaders_SearchParametersAndTableColumns;
		
		cat.executeGlobal();
		
		/*
		Форматированный вывод:
			   α               δ             ϖ         μα*        μδ       G     G_BP   G_RP   Flags
		--------------- --------------- ---------- ---------- ---------- ------ ------ ------ --------
		  h  m  s          °  ′  ″           mas       mas/yr     mas/yr   mag    mag    mag
		=============== =============== ========== ========== ========== ====== ====== ====== ========
		20 31 02.041684 +59 52 33.68059     8.3361   +25.4153   +10.8035  8.495  8.705  8.038 000800f0
		
		В скрипте:
		307.75850701675705,59.87602238665325,8.336106300354004,25.415267944335938,10.803519248962402,8.494999885559082,8.704999923706055,8.038000106811523,524528,,
		*/
		let cat_stars = cat.sources;
		
		console.writeln("Count=" + cat_stars.length);
		
		 for ( let i = 0; i < StarsArray.length; ++i )
		 {
			let StarFnd = false;
			let s = StarsArray[i];

			// if astrometric solution is present save it also
			let q = undefined;
			if (this.sourceView.window.astrometricSolutionSummary().length > 0)
			   q = this.sourceView.window.imageToCelestial( s.pos.x, s.pos.y );
			if (q){
				console.writeln("Searching for star: " + q.x + " " + q.y);
				let a_rnd = parseFloat(q.x.toFixed(3));
				let d_rnd = parseFloat(q.y.toFixed(3));
				console.writeln( a_rnd + " " + d_rnd );

				for ( let j = 0; j < cat_stars.length; ++j )
				{
					 let cat_a_rnd = parseFloat(cat_stars[j][0].toFixed(3));
					 let cat_d_rnd = parseFloat(cat_stars[j][1].toFixed(3));
				 
					 if (a_rnd == cat_a_rnd && d_rnd == cat_d_rnd)
					 {
						console.writeln( cat_stars[j][0].toFixed(5) + " " + cat_stars[j][1].toFixed(5) + ", magG = " + cat_stars[j][5].toFixed(3) + ", magR = " + cat_stars[j][6].toFixed(3) + ", magB = " + cat_stars[j][7].toFixed(3) );
						StarFnd = true;
						break;
					 }
				}
				
				if ( !StarFnd )
				{
					console.writeln( "Not found, lets try truncation" );
					let a_trn = Math.trunc(q.x * 1000)/1000;
					let d_trn = Math.trunc(q.y * 1000)/1000;
					console.writeln( a_trn + " " + d_trn );

					for ( let j = 0; j < cat_stars.length; ++j )
					{

						 let cat_a_trn = Math.trunc(cat_stars[j][0] * 1000)/1000;
						 let cat_d_trn = Math.trunc(cat_stars[j][1] * 1000)/1000;
						 
						 if (a_trn == cat_a_trn && d_trn == cat_d_trn)
						 {
							console.writeln( cat_stars[j][0].toFixed(5) + " " + cat_stars[j][1].toFixed(5) + ", magG = " + cat_stars[j][5].toFixed(3) + ", magR = " + cat_stars[j][6].toFixed(3) + ", magB = " + cat_stars[j][7].toFixed(3) );
							StarFnd = true;
							break;
						 }
					}
				}

				if ( !StarFnd )
				{
					console.writeln( "Not found, lets try 2 digits" );
					let a_rnd2 = parseFloat(q.x.toFixed(2));
					let d_rnd2 = parseFloat(q.y.toFixed(2));
					console.writeln( a_rnd2 + " " + d_rnd2 );

					for ( let j = 0; j < cat_stars.length; ++j )
					{
						 let cat_a_rnd2 = parseFloat(cat_stars[j][0].toFixed(2));
						 let cat_d_rnd2 = parseFloat(cat_stars[j][1].toFixed(2));
					 
						 if (a_rnd2 == cat_a_rnd2 && d_rnd2 == cat_d_rnd2)
						 {
							console.writeln( cat_stars[j][0].toFixed(5) + " " + cat_stars[j][1].toFixed(5) + ", magG = " + cat_stars[j][5].toFixed(3) + ", magR = " + cat_stars[j][6].toFixed(3) + ", magB = " + cat_stars[j][7].toFixed(3) );
							StarFnd = true;
							break;
						 }
					}
				}


				if ( !StarFnd )
				{
					console.warningln( "Star was not found" );
				}


				
			}

		 }

		
   }

   
};


function debug(st)
{
   if (__DEBUGF__)
      console.writeln("<i>" + st + "</i>");
}

/* 
 * FHWH algorithm taken from StarUtils - A PixInsight Script that allow star fixing and easy mask creation
 * Copyright (C) 2020  Giuseppe Fabio Nicotra <artix2 at gmail dot com>
 */
function FWHM(func, sigma, beta, varshape) {
   if (beta === undefined || beta === null) beta = 2;
   if (varshape === true)
      return 2 * sigma * Math.pow(beta*0.6931471805599453, 1/beta);
   switch (func) {
       case DynamicPSF.prototype.Function_Gaussian:
         return 2.3548200450309493 * sigma;
       case DynamicPSF.prototype.Function_Moffat:
         return 2 * sigma * Math.sqrt(Math.pow2(1/beta) - 1);
       case DynamicPSF.prototype.Function_Moffat10:
         return 0.5358113941912513 * sigma;
       case DynamicPSF.prototype.Function_Moffat8:
         return 0.6016900619596693 * sigma;
       case DynamicPSF.prototype.Function_Moffat6:
         return 0.6998915581984769 * sigma;
       case DynamicPSF.prototype.Function_Moffat4:
          return 0.8699588840921645 * sigma;
       case DynamicPSF.prototype.Function_Moffat25:
          return 1.1305006161394060 * sigma;
       case DynamicPSF.prototype.Function_Moffat15:
          return 1.5328418730817597 * sigma;
       case DynamicPSF.prototype.Function_Lorentzian:
          return 2 * sigma;
       default: return 0; // ?!
   }
}
