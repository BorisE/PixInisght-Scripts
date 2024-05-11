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
#define __PJSR_USE_STAR_DETECTOR_V2
#define __PJSR_STAR_OBJECT_DEFINED  1
#define __PJSR_NO_STAR_DETECTOR_TEST_ROUTINES

#include <pjsr/StarDetector.jsh>

#include <pjsr/UndoFlag.jsh>
#include <pjsr/BitmapFormat.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/ImageOp.jsh>
#include <pjsr/MorphOp.jsh>

#define MaxInt 1000000

#define debugf true

var csvSeparator = ","

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
   
}


/*
 * Star detection engine
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
   };


   /*
    * Proccess source image and get all stars from it
   */
   this.GetStars = function ( sourceView )
	{
      debug("Running [" + "GetStars" + "]");

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
   
   this.fitStarPSF = function (StarsArray = undefined)
   {      debug("Running [" + "fitStarPSF" + "]");
      
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
      dynamicPSF.circularPSF = false;
      dynamicPSF.gaussianPSF = true; //parameters.modelFunctionIndex == 0;
      dynamicPSF.moffatPSF = false;
      dynamicPSF.moffat10PSF = false; //parameters.modelFunctionIndex == 1;
      dynamicPSF.moffat8PSF = false; //parameters.modelFunctionIndex == 2;
      dynamicPSF.moffat6PSF = false; //parameters.modelFunctionIndex == 3;
      dynamicPSF.moffat4PSF = false; //parameters.modelFunctionIndex == 4;
      dynamicPSF.moffat25PSF = false; //parameters.modelFunctionIndex == 5;
      dynamicPSF.moffat15PSF = false; //parameters.modelFunctionIndex == 6;
      dynamicPSF.lorentzianPSF = false; //parameters.modelFunctionIndex == 7;
      dynamicPSF.regenerate = true;

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
      dynamicPSF.writeIcon("PSFSave1");
      
      
      var fitted = new Array(stars.length);
      for (var i = 0; i != fitted.length; ++i) {
         fitted[i] = false;
      }
      dynamicPSF.executeGlobal();
      dynamicPSF.setDescription("Test");
      dynamicPSF.writeIcon("PSFSave2");
      
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
            
            //debug(idx + ": " + psfRow[DYNAMICPSF_PSF_FuncType] + " CF:" + psfRow[DYNAMICPSF_PSF_CircularFlag] + " b:" + StarsArray[idx].PSF_b + " a:" + StarsArray[idx].PSF_a + " " + StarsArray[idx].PSF_theta);

            fitted[idx] = true;
         }
      }
      console.writeln(psfTable.length + " PSF fittings were gathered and added to stat");
      
      return starProfiles;

   }

   /*
    * Calculate Stars statistics
   */
   this.CalculateStarStats = function (StarsArray = undefined)
   {
      debug("Running [" + "CalculateStarStats" + "]");
      
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

      for( i=0; i < StarsArray.length; i++)
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

      }
   
      // run calculate Size grouping
      this.CalculateStarStats_SizeGrouping(StarsArray);
      // run calculate Flux grouping
      this.CalculateStarStats_FluxGroupingLog(StarsArray);
      
      return true;
   }

   /*
    * Calculate Stars statistics  - grouping by StarSize
   */
   this.CalculateStarStats_SizeGrouping = function (StarsArray = undefined, numIntervals = undefined)
   {
      debug("Running [" + "CalculateStarStats_SizeGrouping" + "]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

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
   this.CalculateStarStats_FluxGrouping = function (StarsArray = undefined, numIntervals = undefined)
   {
      debug("Running [" + "CalculateStarStats_FluxGrouping" + "]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

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
    * Calculate Stars statistics  - grouping by StarSize
   */
   this.CalculateStarStats_FluxGroupingLog = function (StarsArray = undefined, numIntervals = undefined)
   {
      debug("Running [" + "CalculateStarStats_FluxGroupingLog" + "]");
      
      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      var fluxWidth = Math.log10( this.Stat.flux_max / this.Stat.flux_min );
      
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
    * Filter out some Stars
   */
   this.filterStarsBySize = function (minRadius = 0, maxRadius = 65535, StarsArray = undefined)
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
    * Filter out some Stars
   */
   this.filterStarsByFlux = function (minFlux = 0, maxFlux = 65535, StarsArray = undefined)
   {
      debug("Running [" + "filterStarsByFlux" + "]");
      
      console.writeln(format("Filtering StarFluxes to [%d, %d)", minFlux, maxFlux));
      
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
      debug("Running [" + "printStars" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;

      // Run calculate stats in case of wasn't done earlier
      if (!this.bg_min || !this.bg_max)
         this.CalculateStarStats(StarsArray);

      // Header
      console.noteln( "-".repeat(70) );
      console.noteln( format(
         "(%6s, %6s): %5s / %7s | [%3s, %3s]: %4s %4s | %4s |SzG|FlG" + 
         "|%6s / %7s | %7s",
         "x", "y", "flux (flLog)", "bckgrnd", "w", "h", "size", "R", "nmax",
         "psf_F", "psf_B", "psf_A"
      ));
      console.noteln( "-".repeat(70) );
      
      // Rows
      StarsArray.forEach(
         function (s)
         {
            console.write( format(
               "(%6.1f, %6.1f): %5.2f (%4.2f) / %7.5f | [%3d, %3d]: %4d %4.1f |  (%1d) | %1d | %1d |",
               s.pos.x, s.pos.y, s.flux, s.fluxLog, s.bkg, s.w, s.h, s.size, s.sizeRadius, s.nmax, s.sizeGroup, s.fluxGroup
               ));
            if (s.PSF_flux && s.PSF_b && s.PSF_a)
            {
               console.write( format(
                  "%6.2f / %7.5f | %7.5f", 
                  s.PSF_flux, s.PSF_b, s.PSF_a
                  ));
            }
            console.writeln();
         }
      )

      // Total
      console.noteln( "=".repeat(70) );
      console.noteln( format("Stars %5d %4s: %5.2f / %7.5f | [%3d, %3d]: %4d %4.1f", StarsArray.length, "min", this.Stat.flux_min, this.Stat.bg_min, this.Stat.w_min, this.Stat.h_min, this.Stat.size_min, this.Stat.r_min));
      console.noteln( format("%16s: %5.2f / %7.5f | [%3d, %3d]: %4d %4.1f", "max", this.Stat.flux_max, this.Stat.bg_max, this.Stat.w_max, this.Stat.h_max, this.Stat.size_max, this.Stat.r_max));
      console.noteln( "=".repeat(70) );

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
         lo = this.Stat.flux_min + i * this.FluxGrouping.IntervalWidth;
         if (i == this.StarsFluxGoupCnt.length-1)
            hi = this.Stat.flux_max;
         else
            hi = lo + this.FluxGrouping.IntervalWidth;
            
         console.writeln( format("(%d) [%3.1f, %3.1f]: %3d", i, lo, hi, (this.StarsFluxGoupCnt[i] ? this.StarsFluxGoupCnt[i] : 0) ) );
      }
      
      return true;
   }
   
   /*
    * Output Stars array to file
   */
   this.saveStars = function (fileName, StarsArray = undefined)
   {
      debug("Running [" + "saveStars" + "]");

      if (!StarsArray)
         StarsArray = this.Stars;

      if (!StarsArray)
         return false;
      
      if (!fileName)
         fileName = "StarSizeMask.csv"
      
      console.writeln("Writing to file <b>" + fileName + "</b>...");
      try
      {
         var f = File.createFileForWriting( fileName );
         f.outTextLn( "i, x, y, flux, bckgrnd, w, h, size, nmax, SizeGroup, ra, dec");

         for ( let i = 0; i < StarsArray.length; ++i )
         {
            s = StarsArray[i];
            f.outText( i+ "," + s.pos.x + "," + s.pos.y + "," + s.flux + "," + s.bkg + "," + (s.rect.x1-s.rect.x0) + "," + (s.rect.y1-s.rect.y0) + "," + s.size + "," + s.nmax + "," + s.sizeGroup);

            let q = this.sourceView.window.imageToCelestial( s.pos.x, s.pos.y );
            if (q)
            {
               //debug("RA|DEC: " + q.x + "," + q.y);   
               f.outTextLn( "," + q.x + "," + q.y ) ;
            }
            else
               f.outTextLn(",-,-");
               
         }
         f.close();
         console.writeln("Done");
      }
      catch (ex)
      {
         console.criticalln("Writing to file [" + fileName + "] failed: " + ex.message );
         new MessageBox("Reading header failed: " + ex.message + "\r\n" + fileName).execute();
      }      
      
      return true;

   }

   /*
    * Create StarMask from image array
   */
   this.createMask = function (StarsArray=undefined, counterMask = true, maskName = "stars")
   {
      debug("Running [" + "createMask" + "]");

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
         let AdjFact = ( (s.fluxGroup?s.fluxGroup:0) + 1) * 1.5;
         let rectEx = new Rect (s.pos.x - s.w * AdjFact * 0.5, s.pos.y - s.h * AdjFact * 0.5, s.pos.x + s.w * AdjFact * 0.5, s.pos.y + s.h * AdjFact * 0.5);
         //G.fillEllipse( s.rectEx.x0, s.rectEx.y0, s.rectEx.x1, s.rectEx.y1, new Brush(0xFFFFFFFF) );
         G.fillEllipse( rectEx.x0, rectEx.y0, rectEx.x1, rectEx.y1, new Brush(0xFFFFFFFF) );
         if (s.PSF_rect)
            G.fillEllipse( s.PSF_rect.x0, s.PSF_rect.y0, s.PSF_rect.x1, s.PSF_rect.y1, new Brush(0xFFAAAAAA) );
         else
             debug("No PSF Rect for " + i);
         if (counterMask) 
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
      
      console.writeln("StarMask [" + maskName + "] based on " + StarsArray.length + " stars was created" + (counterMask?" [countour mode]":""));

      return true;
   }

   /*
    * Create Image with detected stars marked
   */
   this.markStars = function (StarsArray=undefined, imageName = "DetectedStars")
   {
      debug("Running [" + "markStars" + "]");

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

      //G.pen = new Pen( 0xff000000 );

      for ( let i = 0, n = StarsArray.length ; i < n; ++i )
      {
         let s = StarsArray[i];
         G.strokeEllipse( s.rect.x0, s.rect.y0, s.rect.x1, s.rect.y1 );
         G.strokeRect( s.pos.x-0.5, s.pos.y-0.5, s.pos.x+0.5, s.pos.y+0.5 );
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