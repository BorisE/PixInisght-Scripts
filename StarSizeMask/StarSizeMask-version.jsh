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

#ifndef __STARSIZEMASK_VERSION_JSH__
	#define __STARSIZEMASK_VERSION_JSH__

	#define __SCRIPT_NAME "StarSizeMask"
	#define __SCRIPT_VERSION "2.0beta3"
	#define __SCRIPT_DATE "20250603"

	#define __INFO_STRING__ "A script to create StarMask using detected and fitted stars with ability to filter star by sizes"
	#define __COPYRIGHT_STRING__ "Copyright &copy; 2024 - 2025 by Boris Emchenko"

	#define SETTINGS_KEY_BASE "StarSizeMask/"


#endif /* __STARSIZEMASK_VERSION_JSH__ */


/*
ToDo
-- GUI --
   - mask parameters 
   - same script instance
   - run with saved parameters with drag and drop on image
-- Engine --
   - recalculate mask for non fitted stars (espesially Large Ones)
   - function TopN Stars
   - filter by Gaia color
*/


/*
 * History
 *
 
 2.0beta3 [2025 06 03]
   - filters working

 2.0beta2 [2025 06 01]
   - first release

 2.0beta1 [2025 05 31]
   - first almost working GUI (need to be improved)
 
 2.0alpha1 [2025 05 31]
   - adding GUI
 
 1.0 [2024 05 19]
   - first prod release
   - new MaskGrowth algorithm (based on PSF fittings)
   - keywords for filtered arrays corrected
   - code improvements and clean up
 
 0.8 [2024 05 19]
   - make residual image after subracting star mask
   - copying stf from source image to created

 0.7 [2024 05 19]
   - piedestal is auto added if image is starmask with zero bg level
   - keywords with data in added to result images
   
 0.6 [2024 05 18]
   - save stars updated to save also PSF data
   - markStars use different colours for groups
   - multiple bugs

 0.52 [2024 05 14]
   - Log StarFlux correcrted
   - code optimization

 0.51 [2024 05 14]
   - create mask using angle and FWHM from DynamicPSF
   - soften mask option (using convolve)

 0.5 alpha [2024 05 12]
   - method names put to a standard, some restructerting + doc
   - create mask using angle from DynamicPSF (alpha, still not working properly)
  
 0.41a [2024 05 11]
   - StarDetector runtime hugely optimized (callback make running extremly slow)
   - bugfix: PSF wasnot working on previews
   - bugfix: failed to create a mask if no stat were previously calculated
   - other multiple fixes

 0.4 [2024 05 11]
   - DynamicPSF fitting
   - enlarge mask

 0.3 [2024 05 10]
   - flux/logFlux grouping
   - filter by size
   - filter by flux (log)
   - mark stars
   - enlage
 
 0.2 [2024 05 09]
   - size Radius grouping
   - saving to csv file

 0.1 [2024 05 07]
   - inital working release
 */