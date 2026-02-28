#ifndef AutoCalibrate_camera_headers_js
	#include "AutoCalibrate-CameraHeaders.js"
#endif

var CameraHeaders = new ProcessCameraHeaders();

/*********************************************************
 * Найти подходящие мастера для текущего кадра
 * OBSERVATORY 
 * 	|- TELESCOPE 
 *		|- CAMERA 
 *			|- BIN-MODE 
 *				|- TYPE (dakrs/flats) 
 *					|- TEMP (no for flats) 
 *						|- DATE 
 *							|- files
 *
 * I. Поиск дарков/биасов
 * 1. Сканирует все папки удовлетворяющие [darks_dir_pattern]
 * 2. Среди них выбирает папку с ближайшей температурой калибровочных
 * 3. Сканирует все файлы внутри папки на предмет поиска биасов [bias_file_pattern или bias_wobin_file_pattern] и дарков [darks_file_pattern или darks_wobin_file_pattern]
 * 4. Среди них выбирает папку с ближайшей экспозицией дарка
 *
 * II. Поиск флетов
 * 1. Сканирует все папки удовлетворяющие [flats_dir_pattern]
 * 2. Среди них выбирает папку с ближайшей датой перед съемкой лайта
 * 3. Сканирует все флеты внутри папки на предмет какие фильтры внутри есть
 * 4. Среди них выбирает флет с нужным фильтром
 *
 * @param pathMasterLib string  путь к библиотеке мастеров
 * @param fileData object  данные по текущему файлу, полученные из его заголовка в функции getFileHeaderData
 * @return object имена калибровачных мастер файлов для текущего файла
 */
function matchMasterCalibrationFiles (pathMasterLib, fileData) {
	console.writeln();
	console.note("Matching Master Calibration Files for ");
	console.note("<b>" + fileData.filename + "</b>");
	console.noteln();
	console.writeln();

	//Check for Observatory/Telescope/Camera 
	if (!File.directoryExists(pathMasterLib)) {
		console.criticalln("Master calibration base path [" + pathMasterLib + "] couldn't be found");
		return false;
	}
	debug("Search path: " + pathMasterLib, dbgNotice);
			

	//0. Check for bin-mode
	var binmodest = ((this.CameraHeaders.checkCameraUsingBIN(fileData) || Config.UseBiningFolder) ? "bin" + fileData.bin : "" );
	binmodest += (binmodest ? " " : "") + (this.CameraHeaders.cameraHasPresetMode(fileData) ? this.CameraHeaders.getPresetName(fileData): "")
	debug("BIN_MODE_DIR: " + binmodest, dbgNotice);
	var calibrationSearchBasePath = pathMasterLib + (binmodest == "" ? "" : "/") + binmodest;
	if (!File.directoryExists( calibrationSearchBasePath)) {
		console.criticalln("Master calibration bin/mode specific path [" + calibrationSearchBasePath + "] couldn't be found");
		return false;
	}
	pathMasterLib = calibrationSearchBasePath;


	// == BIAS
	debug("==============<br>BIAS<br>==============", dbgNotice);
	var biasCalibrationSearchBasePath = calibrationSearchBasePath + "/" + BIAS_DIR_NAME;
	debug("Searching BIAS in path: " + biasCalibrationSearchBasePath, dbgNotice);
	if (!File.directoryExists( biasCalibrationSearchBasePath)) {
		console.criticalln("Master BIAS serach path [" + biasCalibrationSearchBasePath + "] couldn't be found");
		return false;
	}
	pathMasterLib = biasCalibrationSearchBasePath;
	// bias - temp search
	var templib_dirname_nearest = SearchSuitabeFileByTemperature (pathMasterLib, fileData.temp)
	if (!templib_dirname_nearest) {
		console.criticalln("Master calibration suitable temperature dir for BIAS couldn't be found");
		return false;
	}
	pathMasterLib = pathMasterLib + "/" + templib_dirname_nearest
	// bias - date search
	var datelib_dirname_nearest = SearchSuitabeFileByDate (pathMasterLib, fileData.date, false)
	if (!datelib_dirname_nearest) {
		console.criticalln("Master calibration suitable datepack dir for BIAS couldn't be found");
		return false;
	}
	pathMasterLib = pathMasterLib + "/" + datelib_dirname_nearest;
	// bias - file search
	var bias_file_name = SearchForBIAS (pathMasterLib, fileData);
	var bias_full_file_name = pathMasterLib + "/" + bias_file_name;
	
	
	// == DARKS
	debug("==============<br>DARK<br>==============", dbgNotice);
	var darksCalibrationSearchBasePath = calibrationSearchBasePath + "/" + DARKS_DIR_NAME;
	debug("Searching DARKS in path: " + darksCalibrationSearchBasePath, dbgNotice);
	if (!File.directoryExists( darksCalibrationSearchBasePath)) {
		console.criticalln("Master DARKS serach path [" + darksCalibrationSearchBasePath + "] couldn't be found");
		return false;
	}
	pathMasterLib = darksCalibrationSearchBasePath;
	// darks - temp search
	var templib_dirname_nearest = SearchSuitabeFileByTemperature (pathMasterLib, fileData.temp)
	if (!templib_dirname_nearest) {
		console.criticalln("Master calibration suitable temperature dir for DARKS couldn't be found");
		return false;
	}
	pathMasterLib = pathMasterLib + "/" + templib_dirname_nearest
	// darks - date search
	var datelib_dirname_nearest = SearchSuitabeFileByDate (pathMasterLib, fileData.date, false)
	if (!datelib_dirname_nearest) {
		console.criticalln("Master calibration suitable datepack dir for DARKS couldn't be found");
		return false;
	}
	pathMasterLib = pathMasterLib + "/" + datelib_dirname_nearest;
	// darks - file search
	var dark_file_name = SearchForDARK (pathMasterLib, fileData);
	var dark_full_file_name = pathMasterLib + "/" + dark_file_name;


	// == FLATS
	debug("==============<br>FLATS<br>==============", dbgNotice);
	var flatsCalibrationSearchBasePath = calibrationSearchBasePath + "/" + FLATS_DIR_NAME;
	debug("Searching FLATS in path: " + flatsCalibrationSearchBasePath, dbgNotice);
	if (!File.directoryExists( flatsCalibrationSearchBasePath)) {
		console.criticalln("Master FLATS serach path [" + flatsCalibrationSearchBasePath + "] couldn't be found");
		return false;
	}
	pathMasterLib = flatsCalibrationSearchBasePath;
	// flats - date search
	datelib_dirname_nearest = SearchSuitabeFileByDate (pathMasterLib, fileData.date, true)
	if (!datelib_dirname_nearest) {
		console.criticalln("Master calibration suitable datepack dir for FLATS couldn't be found");
		return false;
	}
	pathMasterLib = pathMasterLib + "/" + datelib_dirname_nearest;
	// flats - file search
	var flat_file_name = SearchForFLAT (pathMasterLib, fileData);
	var flat_full_file_name = pathMasterLib + "/" + flat_file_name;



	// Check if all needed masters found
	if (bias_file_name == "") {
		Console.criticalln("Matching bias wasn't found! Check dark library for availability for FITS CCD-TEMP values");
		return false;
	}

	if (dark_file_name == "") {
		Console.criticalln("Matching dark wasn't found! Check dark library for availability for FITS CCD-TEMP and exposure values");
		return false;
	}

	if (flat_file_name == "") {
		Console.criticalln("Matching flat wasn't found! Check flat packs availability for FITS date and filter values");
		return false;
	}


	Console.writeln();
	Console.writeln("Materbias filename: <b>" + bias_full_file_name + "</b>");
	Console.writeln("Masterdark filename: <b>" + dark_full_file_name + "</b>");
	Console.writeln("Masterflat filename: <b>" + flat_full_file_name + "</b>");
	Console.writeln();

	return {
		masterbias: bias_full_file_name,
		masterdark: dark_full_file_name,
		masterflat: flat_full_file_name,
	};
}

/*********************************************************
 * Поиск ближайшего калибровочного по температуре
 *
 * @param pathMasterLib string 	путь, где искать
 * @param targetTemp 	float 	целевая температура, ближайшую к которой необходимо найти
 **********************************************************
 */
function SearchSuitabeFileByTemperature (pathMasterLib, targetTemp) {

	var objFileFind = new FileFind;
	debug("* SearchSuitabeFileByTemperature *", dbgNotice);
	
	// 1. Begin search for temp libraries
	var templib = [],			//available temperatures
	templib_dirname = []; 		//corresponding dirs
	
	debug("Scaning library for available temperature folders in <b>" + pathMasterLib + "</b>...", dbgNotice);
	
	if (objFileFind.begin(pathMasterLib + "/*")) {
		do {
			// if not upper dir links
			if (objFileFind.name != "." && objFileFind.name != "..") {
				// if this is Directory
				if (objFileFind.isDirectory) {
					//debug('found folder: ' + objFileFind.name + "", dbgNotice);

					//Test if this is folder with darks
					var matches = objFileFind.name.match(DIR_TEMPERATURE_PATTERN);
					if (matches) {
						templib[templib.length] = matches[0];
						templib_dirname[templib_dirname.length] = objFileFind.name;
						debug("	Found folder for temp " + templib[templib.length - 1] + " deg", dbgNotice);
					}
				}
			}
		} while (objFileFind.next());
	}

	// 2. Match nearest temp to FITS CCD-TEMP
	debug("Matching nearest lib temperature for a given image temperature [<b>" + targetTemp + "deg</b>] in library through " + templib.length + " found values", dbgNotice);
	var mindiff = 100000,
	nearest_temp = 100,
	templib_dirname_nearest = "";
	for (var i = 0; i < templib.length; i++) {
		debug(templib[i], dbgNotice);
		if ((mindiff > Math.abs(templib[i] - targetTemp))) {
			nearest_temp = templib[i];
			templib_dirname_nearest = templib_dirname[i];
			mindiff = Math.abs(templib[i] - targetTemp);

		}
	}
	debug("Nearest temperature found for a given image (" + targetTemp + "deg) is <b>" + nearest_temp + "deg</font></b> (difference = " + mindiff + ", matching folder = <b>" + templib_dirname_nearest + "</b>)", dbgNotice);
	CosmeticsIconTemperature = nearest_temp;
	if (nearest_temp == 100) {
		Console.criticalln("Matching temperature wasn't found! Check dark library folder names and availability for given CCD-TEMP: " + targetTemp + "deg");
		return false;
	}
	
	return templib_dirname_nearest;
}

/*********************************************************
 * Поиск ближайшего калибровочного по дате библиотеки
 *
 * @param pathMasterLib string 	путь, где искать
 * @param targetTemp 	float 	целевая температура, ближайшую к которой необходимо найти
 **********************************************************
 */
function SearchSuitabeFileByDate (pathMasterLib, targetDate, strictlyAfter=true) {

	var objFileFind = new FileFind;
	debug("* SearchSuitabeFileByDate *", dbgNotice);

	// 1. Begin search for flats based on folder date
	debug("Scaning for available date packs in " + pathMasterLib + " ...", dbgNotice);
	var datepacklist_date = [],			// available dates
	datepacklist_dirname = []; 	// available dates corresponding folders
	var dirCount = 0;
	if (objFileFind.begin(pathMasterLib + "/*")) {
		do {
			// if not upper dir links
			if (objFileFind.name != "." && objFileFind.name != "..") {
				// if this is Directory
				if (objFileFind.isDirectory) {
					debug('found folder: ' + objFileFind.name, dbgNotice);
					dirCount++;

					//Test if this is folder with flats
					var matches = objFileFind.name.match(DIR_DATE_PATTERN);
					if (matches) {
						var datest=""; 
						//debug("matches.length = " + matches.length, dbgNotice);
						//debug("matches[0] = " + matches[0], dbgNotice);
						//debug("matches[0].length = " + matches[0].length, dbgNotice);
						if (matches[0].length < 8) {
						// need to concatanate if dir in form of 2022-10-09
							for (var i = 0; i < matches.length; i++) {
								datest=datest + matches[i];
							}
						}
						else 
						{
							datest=matches[0];
						}
						datepacklist_date[datepacklist_date.length] = datest;
						datepacklist_dirname[datepacklist_dirname.length] = objFileFind.name;
						debug("Found dir with date <b>" + datepacklist_date[datepacklist_date.length - 1]+"</b>", dbgNotice);
					}
				}
			}
		} while (objFileFind.next());
	}
	
	// 2.1. if there are no folders, asume - there is no needed to have it 
	if (dirCount==0) 
		return "/";

	// 2.2. Match folder that is earlier than FITS
	var filedateint = parseInt(targetDate.substr(0, 4) + targetDate.substr(5, 2) + targetDate.substr(8, 2));
   debug("Matching sutable masters date for for FITS's date (<b>" + targetDate + "</b>) in library through " + datepacklist_date.length + " values" + (strictlyAfter? ". Stricly after the masters date" : ""), dbgNotice);
	var mindiff = 30000000; //huge initial value
	var datepacklist_date_nearest = 0, datepacklist_dirname_nearest = "";
	for (i = 0; i < datepacklist_date.length; i++) 
   {
		debug(datepacklist_date[i], dbgNotice);
      if ( !strictlyAfter || (strictlyAfter && datepacklist_date[i] <= filedateint)) {
         if (mindiff > Math.abs(datepacklist_date[i] - filedateint)) {
            datepacklist_date_nearest = datepacklist_date[i];
            datepacklist_dirname_nearest = datepacklist_dirname[i];
            mindiff = Math.abs(datepacklist_date[i] - filedateint);
         }
      }
	}
	debug("Suitable date pack for target date [<b>" + targetDate + "</b>] is <b>[" + datepacklist_date_nearest + "]</b> (differenceInt = " + mindiff + ", folder = " + datepacklist_dirname_nearest + (strictlyAfter? ", stricly after the masters date" : "") + ")",dbgNotice);
	if (datepacklist_date_nearest == 0) {
		Console.criticalln("Matching datepack wasn't found! Check library folder names and availability for given date: " + targetDate + "");
		return false;
	}
	
	return datepacklist_dirname_nearest;
}
/*********************************************************
 * Поиск bias
 *
 * @param pathMasterLib 	string 	путь, где искать
 * @param fileData			object 	данные из FITS файла
 **********************************************************
 */
function SearchForBIAS (pathMasterLib, fileData) {

	var objFileFind = new FileFind;
	debug("* SearchForBIAS *", dbgNotice);
	
	debug("Scaning for available bias in </b>" + pathMasterLib + "</b>", dbgNotice);
	var bias_file_name = "";
	if (objFileFind.begin(pathMasterLib + "/*")) {
		do {
			// if not directory and not upper dir links (ambigious?)
			if (!objFileFind.isDirectory && objFileFind.name != "." && objFileFind.name != "..") {
				debug('found file: ' + objFileFind.name, dbgNotice);

				//var regExp = this.CameraHeaders.calcOverscanPresent(fileData) ? BIAS_FILE_PATTERN_WO_OVERSCAN : BIAS_FILE_PATTERN_ANY; 
							//new conception: if overscan in light is present, delete overscan and use calibration masters without overscan!
							//problem: masters wo overscan should have _c suffix. But then I need to rename all masters even for cameras that can't have overscan.
							//solution (old): if light has oversan area, then for this period search for masters with _c suffix. In any other case, use wo _c and asume that this is master wo overscan
							//solution new: use _o suffix for overscan and no suffix for overscan free master. And... we don't need any fork here
				var regExp = BIAS_FILE_PATTERN_ANY; 
				
				var matches = objFileFind.name.match( regExp ); 
				if (matches) {
					debug("Found bin: " + matches[BIAS_FILE_PATTERN_BINNING_POS], dbgNotice);
					//Use only target bin
					if (matches[BIAS_FILE_PATTERN_BINNING_POS] == fileData.bin) {
						bias_file_name = objFileFind.name;
						debug("Bias file for targeted bin (" + matches[BIAS_FILE_PATTERN_BINNING_POS] + ") and overscan (" + fileData.Overscan + ") found: " + bias_file_name, dbgNotice);
					} else {
						debug("Skipping bias file because of bin" + matches[BIAS_FILE_PATTERN_BINNING_POS] + " instead of targeted bin" + fileData.bin, dbgNotice);
					}
				} else {
					debug("Bias search ["+regExp+"] was unsuccesfull", dbgNotice);
				}
			}
		} while (objFileFind.next());
	}

	
	if (bias_file_name.length == 0) {
		Console.criticalln("Matching bias wasn't found in <b>" + pathMasterLib + "</b>");
		return false;
	}
	debug("Suitable bias was found <b>" + bias_file_name + "</b>", dbgNormal);
	return bias_file_name;

}


/*********************************************************
 * Поиск dark
 *
 * @param pathMasterLib string 	путь, где искать
 * @param fileData 		object 	fits header data
 **********************************************************
 */
function SearchForDARK (pathMasterLib, fileData) {

	var objFileFind = new FileFind;
	debug("* SearchForDARK *", dbgNotice);

	// 3. Begin search for nearest exposure for the dark. Test for overscan presence
	debug("Scaning for available darks of different exposure length in " + pathMasterLib  + " ...", dbgNotice);
	var dark_file_name="";
	var darkexplib = [], darkexplib_filename = []; //empty array
	if (objFileFind.begin(pathMasterLib + "/*")) {
		do {
			// if not directory and not upper dir links (ambigious?)
			if (!objFileFind.isDirectory && objFileFind.name != "." && objFileFind.name != "..") {
				debug('found file: ' + objFileFind.name, dbgNotice);

				var regExp = this.CameraHeaders.calcOverscanPresent(fileData) ? DARKS_FILE_PATTERN_W_OVERSCAN : DARKS_FILE_PATTERN_WO_OVERSCAN; 
							//very new conception: if overscan in light is present, delete overscan and use calibration masters without overscan!
							//problem 1: if you use dark wo overscan you need to calibrate it, but then PIX thinks, that he ought to delete overscan from dark too and ... critical error, because there is no overscan in dark
							//solution: use dark with overscan!
							//problem 2: masters wo overscan should have _c suffix. But then I need to rename all masters even for cameras that can't have overscan.
							//solution old: if light has oversan area, then for this period search for masters with _c suffix. In any other case, use wo _c and asume that this is master wo overscan
							//solution new: use masters with _o suffix for overscan and in any other case asume that there is no overscan

				var matches = objFileFind.name.match(regExp);
				if (matches) {
					debug("Found bin: " + matches[DARKS_FILE_PATTERN_BINNING_POS], dbgNotice);
					//Use only target bin
					if (matches[DARKS_FILE_PATTERN_BINNING_POS] == fileData.bin) {
						darkexplib[darkexplib.length] = matches[DARKS_FILE_PATTERN_EXPOSURE_POS];
						darkexplib_filename[darkexplib_filename.length] = objFileFind.name;
						debug("Dark file for targeted bin (" + matches[DARKS_FILE_PATTERN_BINNING_POS] + "), overscan (" + fileData.Overscan + ") and exposure (" + darkexplib[darkexplib.length - 1] + "s) found: " + objFileFind.name, dbgNotice);
					} else {
						debug("Skipping dark file because of bin" + matches[DARKS_FILE_PATTERN_BINNING_POS] + " or overscan (" + fileData.Overscan + ") instead of targeted bin" + fileData.bin, dbgNotice);
					}
				} else {
					debug("Dark search [" + regExp + "] was unsuccesfull", dbgNotice);
					/*var matches = objFileFind.name.match(darks_wobin_file_pattern);
					if (matches) {
						debug("Found dark wo bin, considering bin = 1", dbgNotice);
						//Use only target bin
						if (1 == fileData.bin) {
							darkexplib[darkexplib.length] = matches[darks_wobin_file_pattern_exposure];
							darkexplib_filename[darkexplib_filename.length] = objFileFind.name;
							debug("Dark file found for exposure " + darkexplib[darkexplib.length - 1] + "s", dbgNormal);
						} else {
							debug("Skipping dark file because of assumed by default bin 1 doesn't equal to targeted bin" + fileData.bin, dbgNotice);
						}
					}*/
				}
			}
		} while (objFileFind.next());
	}
	
	// 4. Match nearest exposure to FITS
	debug("Matching nearest exposure for FITS " + fileData.duration + "sec in library through " + darkexplib.length + " values", dbgNotice);
	var mindiff = 100000,
	nearest_exposure = 0,
	darkexplib_filename_nearest = "";
	for (i = 0; i < darkexplib.length; i++) {
		debug(darkexplib[i], dbgNotice);
		if (((darkexplib[i] + Config.DarkExposureLenghtTolerance) >= fileData.duration) && (mindiff > Math.abs(darkexplib[i] - fileData.duration))) {
			nearest_exposure = darkexplib[i];
			darkexplib_filename_nearest = darkexplib_filename[i];
			mindiff = Math.abs(darkexplib[i] - fileData.duration);

		}
	}
	debug("Nearest dark exposure for FITS's eposure " + fileData.duration + "s is " + nearest_exposure + "s (difference = " + mindiff + ", file = " + darkexplib_filename_nearest + ")",dbgNotice);
	
	if (nearest_exposure == 0) {
		Console.criticalln("Matching dark frame exposure wasn't found! Check folder with temperature for masterdark availability for exposure: " + fileData.duration + "s");
		return false;

	}
	CosmeticsIconExposure = nearest_exposure;

	debug("Suitable dark was found <b>" + darkexplib_filename_nearest + "</b>", dbgNormal);
	return darkexplib_filename_nearest;

}

/*********************************************************
 * Поиск flat
 *
 * @param pathMasterLib string 	путь, где искать
 * @param fileData 		object 	fits header data
 **********************************************************
 */
function SearchForFLAT (pathMasterLib, fileData) {

	var objFileFind = new FileFind;
	debug("* SearchForFLAT *", dbgNotice);

	// 3. Begin search for matching filter
	debug("Scaning for avaliable filters in flats pack " + pathMasterLib  + " ...", dbgNotice);
	var flat_file_name = "";
	var flatsfileslib = [],
	flatsfileslib_filename = []; //empty array
	if (objFileFind.begin(pathMasterLib + "/*")) {
		do {
			// if this is not Directory and if not upper dir links
			if (!objFileFind.isDirectory && objFileFind.name != "." && objFileFind.name != "..") {
				debug('found file: ' + objFileFind.name, dbgNotice);

				//Test if this is flat
				//var regExp = this.CameraHeaders.calcOverscanPresent(fileData) ? FLATS_FILE_PATTERN_WO_OVERSCAN : FLATS_FILE_PATTERN_ANY; 
							//new conception: if overscan in light is present, delete overscan and use calibration masters without overscan!
							//problem: masters wo overscan should have _c suffix. But then I need to rename all masters even for cameras that can't have overscan.
							//solution (old): if light has oversan area, then for this period search for masters with _c suffix. In any other case, use wo _c and asume that this is master wo overscan
							//solution new: use _o suffix for overscan and no suffix for overscan free master. And... we don't need any fork here
				var regExp = FLATS_FILE_PATTERN_ANY; 
				
				var matches = objFileFind.name.match( regExp ); // new conception: use overscan removed version even for light with overscan
				if (matches) {
					debug("Found bin: " + matches[FLATS_FILE_PATTERN_BINNING_POS], dbgNotice);
					//Use only target bin
					if (matches[FLATS_FILE_PATTERN_BINNING_POS] == fileData.bin) {
						flatsfileslib[flatsfileslib.length] = String.toUpperCase(matches[FLATS_FILE_PATTERN_FILTER_POS]); //upcase filter name
						flatsfileslib_filename[flatsfileslib_filename.length] = objFileFind.name;
						debug("Added filter: " + flatsfileslib[flatsfileslib.length - 1], dbgNotice);
					} else {
						debug("Skipping flat file because of bin" + matches[FLATS_FILE_PATTERN_BINNING_POS] + " instead of targeted bin" + fileData.bin, dbgNotice);
					}
				} else {
					debug("Flat search [" + regExp + "] was unsuccesfull", dbgNotice);
				}
			}
		} while (objFileFind.next());
	}

	// 4. Match filter to FITS
	debug("Matching filter for FITS's filter " + fileData.filter + " in library through " + flatsfileslib.length + " values", dbgNotice);
	var filtername = "",
	filterfilename = "";
	for (i = 0; i < flatsfileslib.length; i++) {
		debug("Test filter from lib:" + flatsfileslib[i] + "->" + FILTERS_DICTIONARY[flatsfileslib[i]], dbgNotice);
		if (fileData.filter == FILTERS_DICTIONARY[flatsfileslib[i]]) {
			filtername = FILTERS_DICTIONARY[flatsfileslib[i]];
			filterfilename = flatsfileslib_filename[i];
		}
	}
	debug("Matching filter is " + filtername + " (file = " + filterfilename + ")",dbgNotice);
	flat_file_name = filterfilename;
	if (flat_file_name == "") {
		Console.criticalln("Matching flat frames for FITS filter wasn't found! Check masterflats availability for given filter: " + fileData.filter + "");
		return false;
	}

	debug("Suitable flat was found <b>" + flat_file_name + "</b>", dbgNormal);
	return flat_file_name;

}

/*********************************************************
 * Поиск соответствующего рефенса для выравнивания
 *
 * @param fileName string Имя файла.fit
 **********************************************************
 */
function getRegistrationReferenceFile(objectname) {

	console.writeln();
	console.noteln("Searching for matching Registration Reference file for object <b>", objectname, "</b>");
	console.writeln();

	//1. Search lib dir for folders
	var objFileFind = new FileFind;
	var templib = [],
	templib_dirname = []; //empty array

	// Begin search for temp libraries
	debug("Scaning refernce library for available references in " + Config.RegistrationReferencesPath + " ...", dbgNormal);
	var referenceFile = "";
	if (objFileFind.begin(Config.RegistrationReferencesPath + "/*")) {
		do {
			// if not upper dir links
			if (objFileFind.name != "." && objFileFind.name != "..") {
				// if this is Directory
				if (!objFileFind.isDirectory) {
					debug('found file: ' + objFileFind.name, dbgNotice);

					//Test if this is reference file
					var registerreference_file_pattern = new RegExp('^' + objectname + '_.*', 'i'); // +? non-greedy modifier;
					var matches = objFileFind.name.match(registerreference_file_pattern);
					if (matches) {
						referenceFile = objFileFind.name;
						console.note("Reference file for <b>" + objectname + "</b> found: ");
						console.writeln(referenceFile);
					}
				}
			}
		} while (objFileFind.next());
	}

	return (referenceFile == "" ? false : Config.RegistrationReferencesPath + "/" + referenceFile);
}

/*********************************************************
 * Поиск соответствующего рефенса для выравнивания
 *
 * @param fileName string Имя файла.fit
 **********************************************************
 */

function getNormalizationReferenceFile(objectname, filtername, exposure) {

	console.writeln();
	console.noteln("Searching for matching Normalization Reference file for object <b>", objectname, "</b>, filter <b>" + filtername + "</b>" + (Config.StrictNormalization? " and exposure <b>" + exposure + "s</b>" : ""));
	//console.writeln();

	//1. Search lib dir for folders
	var objFileFind = new FileFind;
	var templib = [],
	templib_dirname = []; //empty array

	// Begin search for temp libraries
	debug("Scaning refernce library for available references in " + Config.NormalizationReferencesPath + " ...", dbgNotice);
	var referenceFile = "";
	if (objFileFind.begin(Config.NormalizationReferencesPath + "/*")) {
		do {
			// if not upper dir links
			if (objFileFind.name != "." && objFileFind.name != "..") {
				// if this is Directory
				if (!objFileFind.isDirectory) {
					debug('found file: ' + objFileFind.name, dbgNotice);

					// Normalization Reference
					if (Config.StrictNormalization)  {
						var normalizationreference_file_pattern = new RegExp('^' + objectname + '_.*_' + filtername + '_' + exposure + 's.*', 'i'); // +? non-greedy modifier;
					} else {
						var normalizationreference_file_pattern = new RegExp('^' + objectname + '_.*_' + filtername + '.*', 'i'); // +? non-greedy modifier;
					}
					//Console.writeln(normalizationreference_file_pattern);
					var matches = objFileFind.name.match(normalizationreference_file_pattern);
					if (matches) {
						referenceFile = objFileFind.name;
						console.write("Reference file is: ");
						console.writeln("<b>" + referenceFile + "</b>");
					}
				}
			}
		} while (objFileFind.next());
	}

	return (referenceFile == "" ? false : Config.NormalizationReferencesPath + "/" + referenceFile);
}
