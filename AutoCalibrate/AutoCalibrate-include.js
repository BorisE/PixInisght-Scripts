#ifndef AutoCalibrate_Include_js
#define AutoCalibrate_Include_js
#endif

//////////////////////////////////////////////////////
/* 
					Глобальные переменные
*/
//////////////////////////////////////////////////////
  
																	
// for FITS HEADER parsing
var headers = {
      'XBINNING': null,
      'OBSERVER': null,
      'TELESCOP': null,
	  'INSTRUME': null,
      'DATE-OBS': null,
      'EXPTIME':  null,
      'CCD-TEMP': null,
      'XPIXSZ':   null,
      'FOCALLEN':   null,
      'FILTER':   null,
      'OBJECT':   null,
      'OBJCTRA':  null,
      'OBJCTDEC': null
      };
	 
// DEBUG	 
var dbgNormal = 1; 	//  минимальное количество сообщений
var dbgNotice = 2;	// максимальное количество сообщений 
var dbgCurrent = 0;	// максимальное количество сообщений 


////////////////////////////////////////////////////////////////////////////////
var BaseCalibratedOutputPath = ""; 	// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CalibratedOutputPath = ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CosmetizedOutputPath = ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var RegisteredOutputPath= ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var NormalizedOutputPath= ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var ApprovedOutputPath="";			// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции

var CosmeticsIconTemperature = 0; 	// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CosmeticsIconExposure  = 0;		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции

var busy = false;					// Осталась от Олега
var needRefresh = true;				// Осталась от Олега

var cfgDefObjectName = "Obj";		// имя объекта, в случае если FITS не содержит имя объекта

var requestToCopy = []; 			//массив для хранения файлов, которые нужно будет скопировать как финальные (если такой режим установлен)

////////////////////////////////////////////////////////////////////////////////
var PATHMODE = { UNSET : -1, AUTO : 0, PUT_IN_ROOT_SUBFOLDER : 1, PUT_IN_OBJECT_SUBFOLDER : 2, ABSOLUTE : 3, RELATIVE : 4, RELATIVE_WITH_OBJECT_FOLDER : 5, PUT_FINALS_IN_OBJECT_SUBFOLDER :6 };// Типы расположения файлов, см. documentation.txt


var FITS = { UNKNOWN : -1, ORIGINAL : 0, CALIBRATED : 1, COSMETIZED : 2, REGISTERED : 3, NORMALIZED : 4, APPROVED: 5 }; // Типы файлов
var FILEARRAY = [];	// базовый массив хранения файлов, куда вносятся результаты сканирования
/*      FILEARRAY.push({
            fits: signaturename,
            fullname:   (type == FITS.ORIGINAL     ? fullname : null),
            calibrated: (type == FITS.CALIBRATED   ? fullname : null),
            cosmetized: (type == FITS.COSMETIZED   ? fullname : null),
            registered: (type == FITS.REGISTERED   ? fullname : null),
            normalized: (type == FITS.NORMALIZED   ? fullname : null),
            approved:   (type == FITS.APPROVED     ? fullname : null),
         });
*/



/**
 * Вернуть название поле для объекта FILEARRAY по типу
 *
 * @param type FITS тип файла
 * @return string
 */
function getFILEARRPropertyName(type)
{
   var st="";
   switch (type)
   {
      case FITS.ORIGINAL:
         st="fullname";
         break;
      case FITS.CALIBRATED:
         st="calibrated";
         break;
      case FITS.COSMETIZED:
         st="cosmetized";
         break;
      case FITS.REGISTERED:
         st="registered";
         break;
      case FITS.NORMALIZED:
         st="normalized";
         break;
      case FITS.APPROVED:
         st="approved";
         break;
   }
   return st;
}

/**
 * Получение предыщего в цепочке
 *
 * @param property string
 * @return string
 */
function getFILEARRPrecedingName(property)
{
   if (property == getFILEARRPropertyName (FITS.ORIGINAL))
      return getFILEARRPropertyName (FITS.ORIGINAL)
   else if (property == getFILEARRPropertyName (FITS.CALIBRATED))
      return getFILEARRPropertyName (FITS.ORIGINAL)
   else if (property == getFILEARRPropertyName (FITS.COSMETIZED))
      return getFILEARRPropertyName (FITS.CALIBRATED)
   else if (property == getFILEARRPropertyName (FITS.REGISTERED))
      return getFILEARRPropertyName (FITS.COSMETIZED)
   else if (property == getFILEARRPropertyName (FITS.NORMALIZED))
      return getFILEARRPropertyName (FITS.REGISTERED)
   else if (property == getFILEARRPropertyName (FITS.APPROVED))
      return getFILEARRPropertyName (FITS.NORMALIZED)
   else 
      return getFILEARRPropertyName (FITS.ORIGINAL);
     
}


function debug(st, level = dbgCurrent)
{
   if (cfgDebugEnabled && level <= cfgDebugLevel)
   {
		if (level == dbgNotice) 
		{
			console.write ("<sub>");
			console.write (st);
			console.writeln ("</sub>");
		}
		else
		{
			console.writeln (st);
		}
   }
}


/**
 * Переименование фита и копирование в папку объекта
 *
 * @param fileName string Имя файла_c_cc.fit
 * @return object
 */
function renameCopyFit(fileName)
{
   console.writeln('rename and copy fit: '+ fileName);

   var file = getFileHeaderData(fileName);
   if (!file)
      return false;

   file.dst = file.instrument.replace('/', '_') +'-'+
      file.date +'-'+ file.time +'-'+
      file.object +'-'+ file.filter +'-bin'+ file.bin +'-'+
      file.duration +'s';
   console.writeln('.. to: '+ file.dst);

   if (Config.NeedCalibration) {
      // удаляю _с файл
      File.remove(fileName.replace(/_c_cc\.fit$/, '_c.fit'));
   }

   // создаю папки cfgOutputPath / object / filter / сс и / src
   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/cc'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/cc', true);
   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/src'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/src', true);

   // добавляю префикс файлу src и cc
   // переношу исходник в cfgOutputPath / filter / src
   // переношу _cc в cfgOutputPath / filter / cc

   console.writeln('move: '+ fileName +' to: '+cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit');
   File.move(
      fileName,
      cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit'
   );

   if (Config.NeedCalibration) {
      console.writeln('move: '+ fileName.replace(/_c_cc\.fit$/, '.fit') +' to: '+cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/src/'+ file.dst +'.fit');
      File.move(
         fileName.replace(/_c_cc\.fit$/, '.fit'),
         cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/src/'+ file.dst +'.fit'
      );
   }

   return file;
}


// from script / fitsKeywords.js
function copyFile( sourceFilePath, targetFilePath )
{
   var f = new File;

   f.openForReading( sourceFilePath );
   var buffer = f.read( DataType_ByteArray, f.size );
   f.close();

   f.createForWriting( targetFilePath );
   f.write( buffer );
   //f.flush(); // optional; remove if immediate writing is not required
   f.close();
}



/*
 * Returns a readable textual representation of a file size in bytes with
 * automatic units conversion.
 */
function fileSizeAsString( bytes, precision )
{
   const kb = 1024;
   const mb = 1024 * kb;
   const gb = 1024 * mb;
   const tb = 1024 * gb;
   if ( bytes >= tb )
      return format( "%.*g TiB", precision, bytes/tb );
   if ( bytes >= gb )
      return format( "%.*g GiB", precision, bytes/gb );
   if ( bytes >= mb )
      return format( "%.*g MiB", precision, bytes/mb );
   if ( bytes >= kb )
      return format( "%.*g KiB", precision, bytes/kb );
   return format( "%lld B", bytes );
};


/**
 * Поиск расширения файла
 */
function fileExtension(file)
{
   //console.writeln('ext file='+ file);
   var ext = file.match(/\.([^.]+)$/);

   return ext && ext.length ? ext[1] : false
}

/**
 * Проверка, содержит ли имя директории dirName любую из строк из массива SkipDirsContains 
 */
function DirNameContains(dirName, SkipDirsContains)
{
	var bF=false;
	SkipDirsContains.forEach(
		function(element) {
			//console.writeln(element);
			if (dirName.indexOf(element) > -1)
				bF=true;
		}
	);
	return bF;
}

function print_array(arr, level = dbgCurrent)
{
   if (cfgDebugEnabled && level <= cfgDebugLevel)
   {
      console.writeln ("Printing array contents:");
	  arr.forEach(
		function(element) {
			console.writeln(element);
			}
		)
	}
}
