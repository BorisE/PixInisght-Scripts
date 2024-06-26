#ifndef AutoCalibrate_camera_headers_js
	#define AutoCalibrate_camera_headers_js
	console.writeln("AutoCalibrate_camera_headers_js");
#endif

/*
Как добавить новую камеру

1) Проверить, что все нужные FITS поля загружаются:
- поле есть в массиве headers в  в global config
- в функции getFileHeaderData добавить нужные для формирования полей из FITS headers возвращаются (блок return), 
2) Отредактировать CAMERA_PRESETS ниже добавив нужную камеру, имя пресета и соответсвующие ему поля/значения (все боля должны быть  добавлены, см. шаг 1)
3) Важно: имя камеры берется из headers.INSTRUME, но перед этим заменяется на значение из массива CAMERA_DICTIONARY[] в global config
*/


// ======== # processing camera specific data ===============================================
/// @class ProcessCameraHeaders perform AutoCalibration processing
///
function ProcessCameraHeaders() {

	// Just for information purpose QHY600 data
	/*
	imageWidthOverscan = { "bin1" : 9600, "bin2": 4800 };
	imageWidthNoOverscan = { "bin1" : 9576, "bin2": 4788 };

	OptBlackRect_bin1 =   new Rect (   0,    0,   22, 6388); //using x0,y0 - x1,y1 system, NOT x0,y0, W, H
	BlackRect_bin1 =      new Rect (  22,    0,   24, 6388);
	OverscanRect_bin1 =   new Rect (   0, 6389, 9600, 6422);
	MainRect_bin1 =       new Rect (  24,    0, 9600, 6388);

	OptBlackRect_bin2 =   new Rect (   0,    0,   11, 3194);
	BlackRect_bin2 =      new Rect (  11,    0,   12, 3194);
	OverscanRect_bin2 =   new Rect (   0, 3195, 4800, 3211);
	MainRect_bin2 =       new Rect ( 12,     0, 4800, 3194);

	// Полезные FITS поля
	var QHYHeaders = {
		'READOUTM': null,
		'GAIN': null,
		'OFFSET': null,
		'QOVERSCN': null,
		'QPRESET': null,
		'USBLIMIT': null
	};

	*/



	
	this.checkCameraUsingBIN = function (fileData) {
		var retVal = false;
		if (Config.I_USE_BINNING_FOR_THESE_CAMERAS[fileData.camera])
			retVal = true;
		return retVal;
	}

   /**
    * check if curWindow has overscan area
    * @param	fileData	object	fits data 
    * @return	bool				if presets defined
    * @return  int				   1 if image with oversan, 0 if withoud, -1 if can't say nothing about it :)
    */
   this.calcOverscanPresent  = function (fileData)
   {
      
		var curWidth = fileData.width;
		var retVal = 0;
		if (CAMERA_IMAGEWIDTH_OVERSCAN[fileData.camera]) {
			if ( curWidth == CAMERA_IMAGEWIDTH_OVERSCAN[fileData.camera].bin1 || curWidth == CAMERA_IMAGEWIDTH_OVERSCAN[fileData.camera].bin2 )
				retVal = 1;
			else if ( curWidth == CAMERA_IMAGEWIDTH_NOOVERSCAN[fileData.camera].bin1 || curWidth ==  CAMERA_IMAGEWIDTH_NOOVERSCAN[fileData.camera].bin2 )
				retVal = 0;
		}
		debug("calcOverscanPresent: " + retVal, dbgNotice);
		return retVal;
   }

    /**
    * Check if for this camera exist presets
    * @param	fileData	object	fits data 
    * @return	bool				if presets defined
    */
	this.cameraHasPresetMode = function (fileData)  {
        var ret = false;
		debug("cameraHasPresetMode_Camera: " + fileData.camera, dbgNotice);
		if (CAMERA_PRESETS[fileData.camera]) {
			ret = true;
		}
        return ret;
    };

   /**
    * Get PresetName for a current camera
    * @param	fileData	object	fits data 
    * @return  	string				PresetName from array
    */
	this.getPresetName = function (fileData)  {

		var PresetFound = "";

		if (CAMERA_PRESETS[fileData.camera]) {
			debug( "Camera preset found [" + fileData.camera + "]", dbgNotice);
			
			// cycle all presets for this camera
			for( var PresetName in CAMERA_PRESETS[fileData.camera] ) {
				debug( "	[" + PresetName + ']: ' + CAMERA_PRESETS[fileData.camera][PresetName], dbgNotice);
				if (typeof CAMERA_PRESETS[fileData.camera][PresetName] === 'object')
				{
					
					// cycle all preset conditions to test
					var OurPreset = true;
					for( var PresetCondition in CAMERA_PRESETS[fileData.camera][PresetName] ) {
						
						debug( "		test condition " + PresetCondition + ': ' + CAMERA_PRESETS[fileData.camera][PresetName][PresetCondition] , dbgNotice);
						
						var CurVal = fileData[PresetCondition];
						// if value is float rount to 3 digits
						if (typeof CurVal === 'number' &&  !Number.isNaN(CurVal) &&  !Number.isInteger(CurVal) ) {
							CurVal = CurVal.toFixed(3);
						}
						
						if (CAMERA_PRESETS[fileData.camera][PresetName][PresetCondition] != CurVal) 
						{
							debug( "		" + CAMERA_PRESETS[fileData.camera][PresetName][PresetCondition] + '!=' + CurVal, dbgNotice);
							OurPreset = false;
							break; // preset conditions loop
						}
						
					}
					if (OurPreset) {
						var PresetFound = PresetName;
						break; // presets loop
					}
				}
			}	

			if (PresetFound != "") {
				debug("Preset found. PRESET NAME: " + PresetFound,  dbgNotice);
			} else {
				debug("Suitable preset not found",  dbgNotice);
			}

		} else {
			debug("There is no preesets for this camera [" + fileData.camera + "]",  dbgNotice);
		}
		return PresetFound;
	
	}

   
}
