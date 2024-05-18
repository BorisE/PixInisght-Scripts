/*
 *  StarSizeMask - A PixInsight Script to create StarMasks based on their sizes
 *  Copyright (C) 2024  Boris Emchenko http://astromania.info
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

#define MaxInt 1000000

#define debugf true  /*or false*/

#define csvSeparator ","

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
   
   this.PSF_rect = undefined;
   
   this.FWHMx = undefined;
   this.FWHMy = undefined;
}


/*
 * Star detection engine
 *
   getStars (sourceView)            
      Detect stars; you need it to run before any further manipulation
 
   fitStarPSF (StarsArray = undefined) 
      Fit stars profiles using DynamicPSF process
        
   calculateStarStats (StarsArray = undefined)        
      Calculate stars statistics. Needed to use grouping and some other methods. Generally recommended to run after GetStars
      Auto runs CalculateStarStats_SizeGrouping and CalculateStarStats_FluxGroupingLog


   calculateStarStats_SizeGrouping  (StarsArray = undefined, numIntervals = undefined)
      Calculate star grouping based on StarSize
      Optionaly you can specify number of intervals to split the set or use auto splitting
   
   calculateStarStats_FluxGrouping (StarsArray = undefined, numIntervals = undefined)
      Calculate stars grouping based on StarFlux. 
      Obsolete, recommended to use CalculateStarStats_FluxGroupingLog instead

   calculateStarStats_FluxGroupingLog (StarsArray = undefined, numIntervals = undefined)
      Calculate stars grouping based on Log10 of StarFlux

   filterStarsBySize (minRadius = 0, maxRadius = 65535, StarsArray = undefined)
      Filter out some stars based on their radius

   printStars (StarsArray = undefined)
      output to console stars array
      
   printGroupStat (StarsArray = undefined)   
      output to console GroupStats for StarSize and  StarFlux

   saveStars (fileName, StarsArray = undefined)
      output Stars array to file


   createMask (StarsArray=undefined, maskGrowth = true, contourMask = true, maskName = "stars")
      create StarMask from image array
      maskGrowth - use to increase stars ellipses
      contourMask - use to make contour mask (donut)
      maskName - image id for StarMask

   markStars (StarsArray=undefined, imageName = "DetectedStars")      
      create Image with detected stars marked
      
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
   this.debug = debugf;
    
    
   this.Stars = undefined,

   this.sourceView = undefined;;
   this.sourceImage = undefined;

   this.__base__ = Object;
   this.__base__();

   this.SD = new StarDetector;

   // StarDetector settings
   this.SD.hotPixelFilterRadius = 1;
   this.SD.applyHotPixelFilterToDetectionImage = false;
   this.SD.noiseReductionFilterRadius = 0;
   this.SD.structureLayers = 5;
   //this.SD.sensitivity = parameters.starDetectionSensitivity;
   //this.SD.upperLimit = parameters.upperLimit;

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
      flux_min: MaxInt,
      flux_max: 0,
      bg_min: 1,
      bg_max: 0,
      w_min: MaxInt,
      w_max:   0,
      h_min: MaxInt,
      h_max: 0,
      size_max: 0,
      size_min: MaxInt,
      r_max: 0,
      r_min: MaxInt,
      nmax_max: 0,
      nmax_min: MaxInt,
   };


   /*
    * Proccess source image and get all stars from it
   */
   this.getStars = function ( sourceView )
	{
      debug("<br>Running [" + "GetStars(sourceView = '" + sourceView.fullId +  "')]");

      this.sourceView = sourceView;
      this.sourceImage = sourceView.image;

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

	   this.SD.progressCallback = progressCallback;

	   let T = new ElapsedTime;
	   this.Stars = this.SD.stars( this.sourceImage );
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
      dynamicPSF.circularPSF  = false;
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

      var views = new Array;
      views.push(new Array(this.sourceView.fullId));
      dynamicPSF.views = views;


      var radius = Math.round(0.75 * dynamicPSF.searchRadius);
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
      
      if (debugf)
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
      
      if (debugf)
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
            
            StarsArray[idx].FWHMx = FWHM(psfRow[DYNAMICPSF_PSF_FuncType], psfRow[DYNAMICPSF_PSF_sx], psfRow[DYNAMICPSF_PSF_beta], (dynamicPSF.variableShapePSF === true));
            StarsArray[idx].FWHMy = FWHM(psfRow[DYNAMICPSF_PSF_FuncType], psfRow[DYNAMICPSF_PSF_sy], psfRow[DYNAMICPSF_PSF_beta], (dynamicPSF.variableShapePSF === true));
            
            //debug(idx + ": " + psfRow[DYNAMICPSF_PSF_FuncType] + " CF:" + psfRow[DYNAMICPSF_PSF_CircularFlag] + " b:" + StarsArray[idx].PSF_b + " a:" + StarsArray[idx].PSF_a + " " + StarsArray[idx].PSF_theta);

            fitted[idx] = true;
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
    * Calculate Stars statistics
   */
   this.calculateStarStats = function (StarsArray = undefined)
   {
      debug("<br>Running [" + "calculateStarStats( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )]");
      
      if (!StarsArray)
         StarsArray = this.Stars;
      
      if (!StarsArray)
         return false;


      this.Stat.flux_min = MaxInt;
      this.Stat.flux_max = 0;
      this.Stat.bg_min = 1;
      this.Stat.bg_max = 0;
      this.Stat.w_min = MaxInt;
      this.Stat.w_max= 0;
      this.Stat.h_min = MaxInt;
      this.Stat.h_max = 0;
      this.Stat.size_max = 0;
      this.Stat.size_min = MaxInt;
      this.Stat.r_max = 0;
      this.Stat.r_min = MaxInt;

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
      this.calculateStarStats_SizeGrouping(StarsArray);
      // run calculate Flux grouping
      this.calculateStarStats_FluxGroupingLog(StarsArray);
      
      return true;
   }

   /*
    * Calculate Stars statistics  - grouping by StarSize
   */
   this.calculateStarStats_SizeGrouping = function (StarsArray = undefined, numIntervals = undefined)
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
      for( i=0; i < StarsArray.length; i++)
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
   */
   this.calculateStarStats_FluxGrouping = function (StarsArray = undefined, numIntervals = undefined)
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
      for( i=0; i < StarsArray.length; i++)
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
   this.calculateStarStats_FluxGroupingLog = function (StarsArray = undefined, numIntervals = undefined)
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
      for( i=0; i < StarsArray.length; i++)
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
   this.filterStarsBySize = function (minRadius = 0, maxRadius = MaxInt, StarsArray = undefined)
   {
      debug("Running [" + "filterStarsBySize" + "]");
      
      console.writeln(format("Filtering StarSizes to [%d, %d)", minRadius, maxRadius));
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
      
      var FilteredStars=[];
      StarsArray.forEach(
         function (s)
         {
            if ( s.sizeRadius >= minRadius && s.sizeRadius < maxRadius  )
              FilteredStars.push(s); 
         }
      )

      return FilteredStars;
   }

   /*
    * Filter out some stars based on their flux
   */
   this.filterStarsByFlux = function (minFlux = 0, maxFlux = MaxInt, StarsArray = undefined)
   {
      debug("<br>Running [" + "filterStarsByFlux( minFlux = " + minFlux + ", maxFlux = " + maxFlux + " , StarsArray = "  + (StarsArray?StarsArray.length:StarsArray) + " )" + "]");
      
      console.writeln(format("<b>Filtering StarFluxes to [%5.3f, %5.3f)</b>", minFlux, maxFlux));
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
      
      var FilteredStars=[];
      StarsArray.forEach(
         function (s)
         {
            if ( s.flux >= minFlux && s.flux < maxFlux  )
              FilteredStars.push(s); 
         }
      )

      return FilteredStars;
   }


   /*
    * Print Stars array to console
   */
   this.printStars = function (StarsArray = undefined)
   {
      debug("<br>Running [" + "printStars( StarsArray = " + (StarsArray?StarsArray.length:StarsArray) + " )]");

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
         "(%6s, %6s): %6s / %7s [%2s, %2s]: %2s %3s  | %3s |%3s|%3s" + 
         "|%6s / %7s | %7s | %7s |%4s",
         "x", "y", "flux", "bckgrnd", "w", "h", "Sz", "R", "nmx", "SzG", "FlG",
         "psf_F", "psf_B", "psf_A", "FHWHx FHWHy", "Angle"
      ));
      console.noteln( "-".repeat(100) );
      
      // Rows
      StarsArray.forEach(
         function (s)
         {
            console.write( format(
               "(%6.1f, %6.1f): %6.3f / %7.5f [%2d, %2d]: %2d %4.1f | (%1d) | %1d | %1d |",
               s.pos.x, s.pos.y, s.flux, s.bkg, s.w, s.h, s.size, s.sizeRadius, s.nmax, s.sizeGroup, s.fluxGroup
               ));
            if (s.PSF_flux && s.PSF_b && s.PSF_a)
            {
               console.write( format(
                  "%6.2f / %7.5f | %7.5f | %3.2f x %3.2f | %3.0f", 
                  s.PSF_flux, s.PSF_b, s.PSF_a, s.FWHMx, s.FWHMy, s.PSF_theta
                  ));
            }
            console.writeln();
         }
      )

      // Total
      console.noteln( "=".repeat(100) );
      console.noteln( format("Stars %5d %4s: %6.3f / %7.5f [%2d, %2d]: %2d %4.1f | (%1d) |   |   |", StarsArray.length, "min", this.Stat.flux_min, this.Stat.bg_min, this.Stat.w_min, this.Stat.h_min, this.Stat.size_min, this.Stat.r_min, this.Stat.nmax_min));
      console.noteln( format(         "%16s: %6.3f / %7.5f [%2d, %2d]: %2d %4.1f | (%1d) |   |   |", "max", this.Stat.flux_max, this.Stat.bg_max, this.Stat.w_max, this.Stat.h_max, this.Stat.size_max, this.Stat.r_max, this.Stat.nmax_max));
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
      for(i=0; i< this.StarsSizeGoupCnt.length; i++)
      {
         lo = this.Stat.r_min + i * this.SizeGrouping.IntervalWidth;
         if (i == this.StarsSizeGoupCnt.length-1)
            hi = this.Stat.r_max;
         else
            hi = lo + this.SizeGrouping.IntervalWidth;
            
         console.writeln( format("(%d) [%3.1f, %3.1f]: %3d", i, lo, hi, (this.StarsSizeGoupCnt[i] ? this.StarsSizeGoupCnt[i] : 0) ) );
      }

      // Print Flux Grouping
      var lo=hi=0;
      console.noteln("<cbr><br>Flux grouping " + "[" + this.StarsFluxGoupCnt.length + "]:");
      for(i=0; i< this.StarsFluxGoupCnt.length; i++)
      {
         lo = Math.pow( 10, this.FluxGrouping.IntervalWidth * i) *  this.Stat.flux_min ;
         if (i == this.StarsFluxGoupCnt.length-1)
            hi = this.Stat.flux_max ;
         else
            hi = Math.pow( 10, this.FluxGrouping.IntervalWidth * (i+1)) *  this.Stat.flux_min ;;
            
         console.writeln( format("(%d) [%3.2f, %3.2f]: %3d", i, lo, hi, (this.StarsFluxGoupCnt[i] ? this.StarsFluxGoupCnt[i] : 0) ) );
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

   /*
    * Create StarMask from image array
   */
   this.createMask = function (StarsArray=undefined, maskGrowth = true, contourMask = true, maskName = "stars")
   {
      debug("<br>Running [" + "createMask" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      let bmp = new Bitmap( this.sourceImage.width, this.sourceImage.height );
      bmp.fill( 0x0 );
      //bmp.fill( 0xffffffff );

      let G = new VectorGraphics( bmp );
      G.antialiasing = true;
      G.pen = new Pen( 0xffffffff );
      //G.pen = new Pen( 0xff000000 );

      for ( let i = 0, n = StarsArray.length ; i < n; ++i )
      {
         let s = StarsArray[i];
         let AdjFact = 1;
         if (maskGrowth)
            AdjFact = ( (s.fluxGroup?s.fluxGroup:0) + 1) * 1.5;
         let rectEx = new Rect (s.pos.x - s.w * AdjFact * 0.5, s.pos.y - s.h * AdjFact * 0.5, s.pos.x + s.w * AdjFact * 0.5, s.pos.y + s.h * AdjFact * 0.5);
         //G.fillEllipse( s.rectEx.x0, s.rectEx.y0, s.rectEx.x1, s.rectEx.y1, new Brush(0xFFFFFFFF) );
         G.fillEllipse( rectEx.x0, rectEx.y0, rectEx.x1, rectEx.y1, new Brush(0xFFFFFFFF) );

         /*
         if (s.PSF_rect)
            G.fillEllipse( s.PSF_rect.x0, s.PSF_rect.y0, s.PSF_rect.x1, s.PSF_rect.y1, new Brush(0xFFAAAAAA) );
         else
             debug("No PSF Rect for " + i);

         if (contourMask) 
            G.fillEllipse( s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1, new Brush(0xFF111111) );
         */
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
      
      console.writeln("StarMask [" + maskName + "] based on " + StarsArray.length + " stars was created" + (contourMask?" [contour mode]":""));

      return true;
   }
   
  /*
   * Create StarMask from image array
   */
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

         if (maskGrowth)
            AdjF = ( (s.fluxGroup ? s.fluxGroup : 0) + 1) * 2 + 2;

         if (s.PSF_rect)
         {
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
            debug("No PSF Rect for " + i);
            G.fillEllipse( s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1, new Brush( debugf?0xFFAAAAAA:0xFFFFFFFF ) );
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

      if (softenMask)
      {
         var P = new Convolution;
         P.mode = Convolution.prototype.Parametric;
         P.sigma = 2.00;
         P.shape = 2.00;
         P.aspectRatio = 1.00;
         P.rotationAngle = 0.00;
         
         P.executeOn(w.mainView);
      }

      
      console.writeln("StarMask [" + w.mainView.id + "] based on " + StarsArray.length + " stars was created" + (contourMask?" [contour mode]":""));

      return true;
   }



   /*
    * Create Image with detected stars marked
   */
   this.markStars = function (StarsArray=undefined, imageName = "DetectedStars")
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

      w.show();
      w.zoomToFit();

      console.writeln("StarMap [" + imageName + "] based on " + StarsArray.length + " stars was created");

      return true;
   }

};


function debug(st)
{
   if (debugf)
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