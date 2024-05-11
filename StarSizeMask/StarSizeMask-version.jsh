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

#ifndef __STARSIZEMASK_VERSION_JSH__
#define __STARSIZEMASK_VERSION_JSH__

#define __SCRIPT_NAME "StarSizeMask"
#define __SCRIPT_VERSION "0.41"
#define __SCRIPT_DATE "20240511"

#endif /* __STARSIZEMASK_VERSION_JSH__ */


/*
 * History

 0.41 [2024 05 11]
   - bugfix: PSF wasnot working on previews
   - bugfix: failed to create a mask if no stat were previously calculated
   - multiple fixes

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