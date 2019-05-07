/*
   Copyright (C) 2016  Oleg Milantiev (oleg@milantiev.com http://oleg.milantiev.com)
   Developed 2019 by Boris Emchenko
*/

/*
Version History

   v 2.0 beta3 [2019/05/05](все еще тестируется)
      - bug fixes

   v 2.0 beta2 [2019/05/01] (почти работает!)
      - Переделана логика работа с подкаталогами (5 режимов работы, прямо задаваемых или авто)
      - Опция не обрабатывать повторно (если соотв. файл на выходе уже существующует)
      - Вывод данных (новый принцип debug)
      - Файл документации

   v2.0 beta1 [2019/04/19]
      - Добавлен второй режим работы - пересканирование имеющегося набора файла и запуск недостаяющих процессов
      - Переструктурированы файлы
      - Добавлен этап "отфильтровка лучших" (не работает - bug PI?)

   v1.0  16/04/2019     Boris Emchenko
                        Пора давать релизный номер версии :)
                        + исключения каталогов из поиска


   v0.5  11/04/2019    Boris Emchenko:
                       Wording, оптимизация кода

   v0.4  04/04/2019    Boris Emchenko:
                       Конфигурация скрипта вынесена в отдельный раздел
                       Автоматический подбор биасов и дарков по температуре, дарков по экспозиции, флетов по фильтру и дате
                       Выравнивание в случае наличия референса
                       Нормализация в случае наличия референса


   v0.3  12/04/2017    Уход от получения данных о снимке в имени файла на данные
                       из заголовка фита

   v0.2  10/19/2016    bugFix
                       Фильтры в upperCase, минуты в lowerCase
                       binX добавил в шаблон cosmetic_ivan_bin2_200

   v0.1  10/18/2016    Продумал структуру входа, калибровки и выхода.
                       Сделал поиск файлов, игнорирование уже калиброванных.
                       Калибровка.
                       Косметика.
                       Создание структуры папок.
                       Выравнивание, если есть ref.fit
*/
#feature-id Batch Processing > AutoCalibration
//#feature-id Batch Processing > BatchStatistics

#feature-info  An automated calibration, cosmetic and registration<br/>\
   <br/> \
   @todo \
   <br/> \
   Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko

#feature-icon  BatchChannelExtraction.xpm

#define TITLE "AutoCalibration"
#define VERSION "2.0b3"
#define COMPILE_DATE "2019/05/05"

#define DEFAULT_EXTENSION     ".fit"

#include <pjsr/DataType.jsh>
#include <pjsr/UndoFlag.jsh>
#include "AutoCalibrate-include.js"    // Constants, glbal vars
#include "AutoCalibrate-config.js"     // Config part.

//////////////////////////////////////////////////////
/*
 *
 * Началао исполнения
 *
 *
*/
//////////////////////////////////////////////////////
var T = new ElapsedTime;

console.abortEnabled = true; // allow stop
console.show();

//Dispay current config
console.noteln( "<end><cbr><br>",
                "************************************************************" );
console.noteln( "* Configuration ");
console.noteln( "************************************************************" );
console.noteln('  Search path: ' + cfgInputPath);
console.noteln('  Path Mode: ' + cfgPathMode);

console.noteln('  Output to relative path: ' + cfgUseRelativeOutputPath);
console.noteln('  Create Object Folder: ' + cfgCreateObjectFolder);
if (!cfgUseRelativeOutputPath) console.writeln('  Output path: ' + cfgOutputPath);
console.noteln('  Calibrate Images: ' + cfgNeedCalibration);
if (cfgNeedCalibration) console.writeln('  Masters library path: ' + cfgCalibratationMastersPath);
console.noteln('  Register Images: ' + cfgNeedRegister);
if (cfgNeedRegister) console.writeln('  Registration Reference path: ' + cfgRegistrationReferencesPath);
console.noteln('  Normalize Images: ' + cfgNeedNormalization);
if (cfgNeedNormalization) console.writeln('  Normalization Reference path: ' + cfgNormalizationReferencesPath);
console.writeln();

// Starting processing
console.noteln('Starting script...');
console.noteln();

/*
// for debug
var fileName = 'c:/Users/bemchenko/Documents/DSlrRemote/test calibration/M46_20180316_L_120s_1x1_-30degC_0.0degN_000006503.FIT';
var fileData= getFileHeaderData(fileName) ;

mastersFiles = matchMasterCalibrationFiles (cfgCalibratationMastersPath + (cgfUseBiningFolder? "/bin" + fileData.bin : "")  + "/" + fileData.instrument, fileData);
registerFits(['c:/Users/bemchenko/Documents/DSlrRemote/test calibration/M63_20190407_B_600s_1x1_-30degC_0.0degN_000011919.FIT']);

//var fileData = getFileHeaderData(filenametest);
//var normref = getNormalizationReferenceFile(fileData.object, fileData.filter));
console.noteln( localNormalization([filenametest]) );

var filenametest='e:/DSlrRemote/M109/calibrated/registered/M109_20180424_Ha_600s_1x1_-25degC_0.0degN_000007687_c_cc_r.fit';
FilterOutFITS(filenametest);
var filenametest='e:/DSlrRemote/-LeoTrio1/calibrated/cosmetized/LeoTrio1_20190118_L_600s_1x1_-30degC_0.0degN_000011908_c_cc.fit';
FilterOutFITS(filenametest);

debug(checkFileNeedCalibratation_and_PopulateArray("e:/DSlrRemote/-LeoTrio1/calibrated/cosmetized/LeoTrio1_20190118_L_600s_1x1_-30degC_0.0degN_000011908_c_cc.fit"));

// Debug
BaseCalibratedOutputPath = 'c:/Users/bemchenko/Documents/DSlrRemote/test calibration';
approvingFiles (['c:/Users/bemchenko/Documents/DSlrRemote/test calibration/M63_20190407_B_600s_1x1_-30degC_0.0degN_000011919.FIT']);

exit;
*/


/* **************************************************************************************************************
 *
 *       1й проход. Сканирование директорий на предмет оригинальных FITS
 *
 * **************************************************************************************************************
 * Производит поиск исходных (необработанных) FITS файлов и их обработка по цепочке калибровки.
 * Также является 1ым проходом перед поиском недостающих файлов в цепочке калибровки (если включено)
 * **************************************************************************************************************/

var DirCount=0; var FileTotalCount=0;
var ProcessesCompleted=0; FilesProcessed=0;
var CalibratedCount = 0; var CosmetizedCount=0; var RegisteredCount = 0; var NormalizedCount = 0; var ApprovedCount = 0;

searchDirectory(  cfgInputPath   );

//Finish 1st pass
console.noteln( "<end><cbr><br>",
                "************************************************************" );
console.noteln('Finished 1st pass ("original fits scan"). Processed ' + ProcessesCompleted + ' (of ' + FileTotalCount + ') file(s) in '+  T.text + ' sec');
console.noteln( "************************************************************" );
console.noteln( "Calibrated: " + CalibratedCount );
console.noteln( "Cosmetized: " + CosmetizedCount );
console.noteln( "Registered: " + RegisteredCount );
console.noteln( "Normalized: " + NormalizedCount );
console.noteln( "************************************************************" );
console.noteln( "<end><cbr><br>");


/* **************************************************************************************************************
 *
 *       2й проход. Определение недостающих файлов в цепочке калибровки и их изготовление
 *
 * **************************************************************************************************************
 * Производит сканирования массива, полученного в первом проходе с определением недостающих этапов калибровки для каждого файла
 * В случае отсутствия запускает нужный этап калибровки
 * **************************************************************************************************************/
if (cfgUseSecnodPass)
{
   var DirCount=0; var FileTotalCount=0;
   ScanArray();

   //Finish working
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   console.noteln('Finished 2nd pass ("missing stages scan"). Processed ' + ProcessesCompleted + ' (of '  + FileTotalCount + ') file(s). in '+  T.text + ' sec');
   console.noteln('Whole timerun '+  T.text + ' sec');
   console.noteln( "************************************************************" );

}
//sleep(10);
/* **************************************************************************************************************
 *
 *       Конец основной части
 *
 * **************************************************************************************************************/



/**
 * Базовая функция для 1го прохода
 *
 * @param file string
 * @return object
 */
function searchDirectory(searchPath)
{
   DirCount++;
   var FileCount=0;
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   Console.noteln( '* '+ DirCount + '. Searching dir: '+ searchPath + ' for fits');
   console.noteln( "************************************************************" );

   if ( !busy )
   {

      busy = true;
      needRefresh = false;
      var objFileFind = new FileFind;

      // Begin search
      if ( objFileFind.begin( searchPath + "/*" ) )
      {
         do
         {
			   // if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory and recursion is enabled
               if ( objFileFind.isDirectory ) {
                  if (cfgSearchInSubDirs && objFileFind.name.substring(0,cfgSkipDirsBeginWith.length) != cfgSkipDirsBeginWith)
                  {
                     //console.writeln('found dir: '+ searchPath +'/'+ objFileFind.name);

                     // Run recursion search
                     busy = false; // на будущее для асихнронного блока
                     searchDirectory( searchPath +'/'+ objFileFind.name );
                     busy = true;
                  }

               }
               // if File
               else
               {
                  debug ('File found: '+ searchPath +'/'+ objFileFind.name, dbgNotice);
                  // if this is FIT
                  if ( fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits' )
                  {

                     // Set output folders (depends on config)
                     if (cfgPathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || cfgPathMode == PUT_IN_OBJECT_SUBFOLDER)
                     {
                        BaseCalibratedOutputPath = cfgInputPath + "/" + cfgOutputPath;
                     }
                     else if (cfgPathMode == PATHMODE.ABSOLUTE)
                     {
                        BaseCalibratedOutputPath = cfgOutputPath ;
                     }
                     else if (cfgPathMode == PATHMODE.RELATIVE || cfgPathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
                     {
                        BaseCalibratedOutputPath = searchPath ;
                     }
                     else
                     {
                        BaseCalibratedOutputPath = cfgOutputPath ;
                     }


                     // Check if file still NOT CALIBRATED and Populate Array
                     if ( checkFileNeedCalibratation_and_PopulateArray( searchPath +'/'+ objFileFind.name ) )
                     {
                        FileCount++; FileTotalCount++;

                        console.noteln( "<end><cbr><br>",
                                        "************************************************************" );
                        Console.noteln( '* ['  + FileTotalCount + '] (Dir ' + DirCount + '|File ' + FileCount + ') Start file processings: '+ searchPath +'/'+ objFileFind.name);
                        console.noteln( "************************************************************" );


                        //Process by full pipeline
                        approvingFiles (
                           localNormalization (
                              registerFits(
                                 debayerSplitFit(
                                    cosmeticFit(
                                       calibrateFITSFile( searchPath +'/'+ objFileFind.name )
                                    )
                                 )
                              )
                           )
                        )

                     }
                  }
               }
            }
         }
         while ( objFileFind.next() );
	  }

      busy = false;
   }
};


/**
 * Базовая функция для 2го прохода
 *
 * @param file string
 * @return object
 */
function ScanArray()
{
   // Print array
   console.writeln ("Need to proccess (total count = " + FILEARRAY.length +")");
   for (var i = 0; i < FILEARRAY.length; i++) {

      for (var property in FILEARRAY[i])
      {
         if (property == "fits")
            console.note("<b>", FILEARRAY[i].fits, "</b> | ");
         else
            console.write(property, ": ", FILEARRAY[i][property], " | ");
      }
      console.writeln();
   }

   // Переопределяем режимы размещения папок
   // Размещать файлы по объектам
   // А ниже назначаем BaseCalibratedOutputPath уровень ниже найденного
   // cfgCreateObjectFolder = false; //отключаем режим

   //Проверим массив на наличие пропущенных звеньев и попробуем создать это звено
   for (var i = 0; i < FILEARRAY.length; i++)
   {

      for (var property in FILEARRAY[i])
      {
         if (property == "fits")
         {
            console.noteln(" ************************************************************ ");
            console.note("Fits from array <b>", FILEARRAY[i].fits, "</b> is ");
         }
         else
         {
            if (FILEARRAY[i][property] == null)
            {
               // Возьмем предыдущий по конвейеру файл
               var preceding = getFILEARRPrecedingName (property);
               var filename = FILEARRAY[i][preceding];
               if (filename == null)
                  continue;

               console.noteln("missing <b>" + property + "</b>. Let's try to create it from <b>" + preceding + "</b>...");
               console.noteln(" ************************************************************ ");

               // Установим директорию для вывода недостающего файла
               var fn = "";
               if ( (fn=filename.match(/(.+)\/(.+)\/(.+).fit$/i)) != null )
               {
                  debug("pathtodir: " +fn[1], dbgNotice);
                  debug("filedir: " +fn[2], dbgNotice);
                  debug("file: " +fn[3], dbgNotice);
                  BaseCalibratedOutputPath = fn[1];
               }
               else
               {

                  BaseCalibratedOutputPath = File.extractDrive( FILEARRAY[i][getFILEARRPropertyName (FITS.ORIGINAL)] )
                           + File.extractDirectory( FILEARRAY[i][getFILEARRPropertyName(FITS.ORIGINAL)] );
               }

               debug (BaseCalibratedOutputPath, dbgNormal);


               // if missing CALIBRATED
               if (property == getFILEARRPropertyName (FITS.CALIBRATED) && FILEARRAY[i][preceding] != null)
               {
                  FileTotalCount++;

                  // Process
                  var res = calibrateFITSFile(FILEARRAY[i][preceding]);
                  // Check and modify array
                  if ( checkFileNeedCalibratation_and_PopulateArray( res ) )
                     debug ("Produced and added [" + property + "] for " + FILEARRAY[i].fits, dbgNotice);
               }
               // if missing COSMETIZED
               if (property == getFILEARRPropertyName (FITS.COSMETIZED) && FILEARRAY[i][preceding] != null)
               {
                  FileTotalCount++;
                  // Process
                  var res = cosmeticFit(FILEARRAY[i][preceding]);
                  // Check and modify array
                  if ( checkFileNeedCalibratation_and_PopulateArray( res ) )
                     debug ("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
               }
               // if missing REGISTERED
               if (property == getFILEARRPropertyName (FITS.REGISTERED) && FILEARRAY[i][preceding] != null)
               {
                  FileTotalCount++;
                  // Process
                  var res = registerFits([FILEARRAY[i][preceding]]);
                  // Check and modify array
                  if ( checkFileNeedCalibratation_and_PopulateArray( res ) )
                     debug ("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
               }
               // if missing NORMALIZED
               if (property == getFILEARRPropertyName (FITS.NORMALIZED) && FILEARRAY[i][preceding] != null)
               {
                  FileTotalCount++;
                  // Process
                  var res = localNormalization([FILEARRAY[i][preceding]]);
                  // Check and modify array
                  if ( checkFileNeedCalibratation_and_PopulateArray( res ) )
                     debug ("Produced and added [" + property + "] for " + FILEARRAY[i].fits);

               }
               // if missing APPROVED
               // ... and there is NormalizedFile
               if (property == getFILEARRPropertyName (FITS.APPROVED) && FILEARRAY[i][getFILEARRPropertyName (FITS.NORMALIZED)] != null)
               {
                  FileTotalCount++;
                  // Process
                  var res = approvingFiles([FILEARRAY[i][getFILEARRPropertyName (FITS.NORMALIZED)]]);
                  // Check and modify array
                  if ( checkFileNeedCalibratation_and_PopulateArray( res ) )
                     debug ("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
               }
               // ... and there is no NormalizedFile, using Registered
               else if (property == getFILEARRPropertyName (FITS.APPROVED) && FILEARRAY[i][getFILEARRPropertyName (FITS.REGISTERED)] != null)
               {
                  FileTotalCount++;
                  // Process
                  var res = approvingFiles([FILEARRAY[i][getFILEARRPropertyName (FITS.REGISTERED)]]);
                  // Check and modify array
                  if ( checkFileNeedCalibratation_and_PopulateArray( res ) )
                     debug ("Produced and added [" + property + "] for " + FILEARRAY[i].fits);

               }
            }

         }
      }
      console.writeln();
   }

   // Print array in the end
   console.writeln ("What we have after processing " + FILEARRAY.length + " records:");
   for (var i = 0; i < FILEARRAY.length; i++) {

      for (var property in FILEARRAY[i])
      {
         if (property == "fits")
            console.noteln("<b>", FILEARRAY[i].fits, "</b> | ");
         else
            console.writeln(property, ": ", FILEARRAY[i][property], " | ");
      }
      console.writeln();
   }
}



/**
 * Добавить файл в массив (используется во время 2го прохода)
 *
 * @param type          string   тип файла (FITS.ORIGINAL,FITS.CALIBRATED, .... )
 * @param fullname      string   полное имя файла (с путем)
 * @param signaturename string   имя оригинального fits файла, соответветствующее рассматриваемому (без расширения)
 * @param pathtofile    string   путь к файлу
 * @return object
 */
function AddFileToArray (type, fullname, signaturename, pathtofile)
{
   // search - is there is such file line?
   var fnd=false,fndpos = -1;
   for(var i=0; i < FILEARRAY.length; i++)
   {
      if ( FILEARRAY[i].fits == signaturename)
      {
         debug("FOUND!");
         fnd=true;
         fndpos=i;
      }
   }
   //if found - add info to line
   if (fnd)
   {
      FILEARRAY[fndpos][getFILEARRPropertyName(type)] = fullname;
   }
   else
   {
      //no line, add data
      FILEARRAY.push({
            fits: signaturename,
            fullname:   (type == FITS.ORIGINAL     ? fullname : null),
            calibrated: (type == FITS.CALIBRATED   ? fullname : null),
            cosmetized: (type == FITS.COSMETIZED   ? fullname : null),
            registered: (type == FITS.REGISTERED   ? fullname : null),
            normalized: (type == FITS.NORMALIZED   ? fullname : null),
            approved:   (type == FITS.APPROVED     ? fullname : null),
         });
   }
}

/**
 * Этот фит нужно калибровать? Нет ли уже готового такого?
 * + Добавить  массив для второго прохода
 *
 * @param file string Имя пути/файла
 * @return bool
 */
function checkFileNeedCalibratation_and_PopulateArray(file)
{

   //debug(typeof(file) + " " + file.length, dbgNormal);
   // Если на входе Boolean, то значит ранее в цепочек произошла ошибка, выходим=
   if (typeof(file) == "boolean")
   {
      debug ("Input is boolean, i.e. it was due to previous proccesing incomplitness. Exiting", dbgNormal);
      return false;
   }
   //Если на входе массив, то берем первый файл
   else if (typeof(file) == "object" && file.length >0)
   {
      debug ("array of files, using first", dbgNormal);
      file = file[0];
   }


   //fn=file.match(/(.+)\/(.+)_c_cc.fit$/);
   //debug("file :" + file);
   //debug("test: " + (file.match(/_c_cc.fit$/) != null));

   // Проверим, на входе файл на какой стадии? (оригинальный, калиброванный, косметизированный, .... )
   var fn="";
   if ((fn=file.match(/(.+)\/(.+)_c.fit$/i)) != null)
   {
      debug("path: " +fn[1], dbgNotice);
      debug("matched: " +fn[2], dbgNotice);
      debug("file is calibrated of " +fn[2], dbgNotice);

      AddFileToArray(FITS.CALIBRATED, file,fn[2],fn[1]); //type, full name, signature, path
      return false;
   }
   else if ((fn=file.match(/(.+)\/(.+)_c_cc.fit$/i)) != null)
   {
      debug("path: " +fn[1], dbgNotice);
      debug("matched: " +fn[2], dbgNotice);
      debug("file is cosmetized of " +fn[2], dbgNotice);

      AddFileToArray(FITS.COSMETIZED, file,fn[2],fn[1]); //type, full name, signature, path
      return false;
   }
   else if ((fn=file.match(/(.+)\/(.+)_c_cc_r.fit$/i)) != null)
   {
      debug("path: " +fn[1], dbgNotice);
      debug("matched: " +fn[2], dbgNotice);
      debug("file is registered of " +fn[2], dbgNotice);

      AddFileToArray(FITS.REGISTERED, file,fn[2],fn[1]); //type, full name, signature, path

      return false;
   }
   else if ((fn=file.match(/(.+)\/(.+)_c_cc_r_n.fit$/i)) != null)
   {
      debug("path: " +fn[1], dbgNotice);
      debug("matched: " +fn[2], dbgNotice);
      debug("file is normalized of " +fn[2], dbgNotice);

      AddFileToArray(FITS.NORMALIZED, file,fn[2],fn[1]); //type, full name, signature, path

      return false;
   }
   else if ((fn=file.match(/(.+)\/(.+)_c_cc_r_n_a.fit$/i)) != null)
   {
      debug("path: " +fn[1], dbgNotice);
      debug("matched: " +fn[2], dbgNotice);
      debug("file is approved of " +fn[2], dbgNotice);

      AddFileToArray(FITS.APPROVED, file,fn[2],fn[1]); //type, full name, signature, path

      return false;
   }
   else
   {
      fn=file.match(/(.+)\/(.+).fit$/i);
      debug("path: " +fn[1], dbgNotice);
      debug("matched: " +fn[2], dbgNotice);

      AddFileToArray(FITS.ORIGINAL, file,fn[2],fn[1]); //type, full name, signature, path

      return true;
   }


   /*
   // Проверим, а нет ли уже такого откалиброванного файла?
   var CalibratedFileName = CalibratedOutputPath +'/'+ File.extractName(file) +'_c.fit';
   var fileExistsFlag = File.exists( CalibratedFileName );
   Console.warningln('File '+ CalibratedFileName + ' already exists, skipping calibration' );

   return !fileExistsFlag;
   */

  return true;
}


/**
 * Найти подходящие мастера для текущего кадра
 *
 * @param pathMasterLib string  путь к библиотеке мастеров
 * @param fileData object  данные по текущему файлу, полученные из его заголовка в функции getFileHeaderData
 * @return object имена калибровачных мастер файлов для текущего файла
 */
function matchMasterCalibrationFiles(pathMasterLib, fileData)
{
   console.writeln();
   console.noteln("Searching for matching Master Calibration Files");
   console.writeln();

	var objFileFind = new FileFind;

	// Begin search for temp libraries
   var templib=[], templib_dirname = []; //empty array
   debug("Scaning library for available temperature packs in " + pathMasterLib + " ...", dbgNormal);
	if ( objFileFind.begin( pathMasterLib + "/*" ) )
	{
         do
         {
			// if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory
               if ( objFileFind.isDirectory )
               {
                  debug('found folder: ' + objFileFind.name, dbgNotice);

                  //Test if this is folder with darks
                  var matches = objFileFind.name.match(darks_dir_pattern);
                  if ( matches )
                  {
                     templib[templib.length]=matches[1];
                     templib_dirname[templib_dirname.length] = objFileFind.name;
                     debug("Found bias/dark folder for temp " + templib[templib.length-1] + " deg",dbgNormal);
                  }
               }
            }
         }
         while ( objFileFind.next() );
   }

   // Match nearest temp to FITS CCD-TEMP
   debug ("Matching nearest temp for FITS CCD-TEMP: " +fileData.temp + " in library through "+templib.length+" values", dbgNotice);
   var mindiff=100000, nearest_temp=100, templib_dirname_nearest="";
   for (var i = 0; i < templib.length; i++)
   {
      debug(templib[i], dbgNotice);
      if ((mindiff > Math.abs(templib[i]-fileData.temp)))
      {
         nearest_temp = templib[i];
         templib_dirname_nearest = templib_dirname[i];
         mindiff = Math.abs(templib[i]-fileData.temp);

      }
   }
   Console.writeln("Nearest temp for FITS temp " + fileData.temp + " is " + nearest_temp + " (difference = " + mindiff + ", matching folder = " +templib_dirname_nearest + ")");
   CosmeticsIconTemperature  = nearest_temp;
   if (nearest_temp==100)
   {
      Console.criticalln ("Matching temperature wasn't found! Check dark library folder names and availability for given CCD-TEMP: " + fileData.temp + "deg");
      return false;

   }

	// Begin search for nearest exposure for the dark
   debug ("Scaning for available darks of different exposure length in " + pathMasterLib + "/" + templib_dirname_nearest + " ..." , dbgNormal);
   var bias_file_name="", dark_file_name;
   var darkexplib=[], darkexplib_filename=[]; //empty array
	if ( objFileFind.begin( pathMasterLib + "/" + templib_dirname_nearest + "/*" ) )
	{
         do
         {
			// if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory
               if ( !objFileFind.isDirectory )
               {
                  debug('found file: ' + objFileFind.name, dbgNotice);

                  //Test if this is bias
                  var matches = objFileFind.name.match(bias_file_pattern);
                  if ( matches )
                  {
                     bias_file_name=objFileFind.name;
                     debug("Bias file found: " + bias_file_name, dbgNormal);
                  }

                  //Test if this is dark
                  var matches = objFileFind.name.match(darks_file_pattern);
                  if ( matches )
                  {
                     darkexplib[darkexplib.length]=matches[1];
                     darkexplib_filename[darkexplib_filename.length] = objFileFind.name;
                     debug("Dark file found for exposure " + darkexplib[darkexplib.length-1] + "s" , dbgNormal);
                  }
               }
            }
         }
         while ( objFileFind.next() );
   }

   // Match nearest exposure to FITS
   debug ("Matching nearest exposure for FITS " +fileData.duration + "s in library through "+darkexplib.length+" values", dbgNotice);
   var mindiff=100000, nearest_exposure=0, darkexplib_filename_nearest="";
   for (i = 0; i < darkexplib.length; i++)
   {
      debug(darkexplib[i], dbgNotice);
      if ( ( (darkexplib[i] + cfgDarkExposureLenghtTolerance) >= fileData.duration) && (mindiff > Math.abs(darkexplib[i]-fileData.duration)))
      {
         nearest_exposure = darkexplib[i];
         darkexplib_filename_nearest = darkexplib_filename[i];
         mindiff = Math.abs(darkexplib[i]-fileData.duration);

      }
   }
   Console.writeln("Nearest dark exposure for FITS's eposure " + fileData.duration + "s is " + nearest_exposure + "s (difference = " + mindiff + ", file = " +darkexplib_filename_nearest + ")");
   dark_file_name = darkexplib_filename_nearest;
   CosmeticsIconExposure  = nearest_exposure;
   if (nearest_exposure==0)
   {
      Console.criticalln ("Matching dark frame exposure wasn't found! Check folder with temperature for masterdark availability for exposure: " + fileData.duration + "s");
      return false;

   }


	// Begin search for flats based on folder date
   debug ("Scaning for available flats packs in " + pathMasterLib + " ...", dbgNormal);
   var flatslib_date=[], flatslib_date_dirname = []; //empty array
	if ( objFileFind.begin( pathMasterLib + "/*" ) )
	{
         do
         {
			// if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory
               if ( objFileFind.isDirectory )
               {
                  debug('found folder: ' + objFileFind.name, dbgNotice);

                  //Test if this is folder with flats
                  var matches = objFileFind.name.match(flats_dir_pattern);
                  if ( matches )
                  {
                     //flatslib_date[flatslib_date.length]=matches[1]+"-"+matches[2]+ "-" + matches[3];
                     flatslib_date[flatslib_date.length]=matches[1];
                     flatslib_date_dirname[flatslib_date_dirname.length] = objFileFind.name;
                     debug("Found flats pack for date " + flatslib_date[flatslib_date.length-1], dbgNormal);
                  }
               }
            }
         }
         while ( objFileFind.next() );
   }

   // Match folder that is earlier than FITS
   var filedateint=parseInt(fileData.date.substr(0,4) + fileData.date.substr(5,2) + fileData.date.substr(8,2));
   //debug("[" + filedateint +"]");
   debug ("Matching flat pack date for for FITS's date " +fileData.date + " in library through "+flatslib_date.length+" values", dbgNormal);
   var mindiff=100000, flatsdate_nearest=0, flatsdate_dirname_nearest="";
   for (i = 0; i < flatslib_date.length; i++)
   {
      debug(flatslib_date[i], dbgNotice);
      if ( (flatslib_date[i] <= filedateint) && (mindiff > Math.abs(flatslib_date[i]-filedateint)) )
      {
         flatsdate_nearest = flatslib_date[i];
         flatsdate_dirname_nearest = flatslib_date_dirname[i];
         mindiff = Math.abs(flatslib_date[i]-filedateint);

      }
   }
   Console.writeln("Suitable flat pack date is " + flatsdate_nearest + " (differenceInt = " + mindiff + ", folder = " +flatsdate_dirname_nearest + ")");
   if (flatsdate_nearest==0)
   {
      Console.criticalln ("Matching flats frames date wasn't found! Check flats library folder names and availability for given date: " + fileData.date + "");
      return false;
   }

	// Begin search for matching filter
   debug ("Scaning for avaliable filters in " + pathMasterLib + "/" + flatsdate_dirname_nearest + " ...", dbgNormal);
   var flat_file_name="";
   var flatsfileslib=[], flatsfileslib_filename=[];//empty array
	if ( objFileFind.begin( pathMasterLib + "/" + flatsdate_dirname_nearest + "/*" ) )
	{
         do
         {
			// if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory
               if ( !objFileFind.isDirectory )
               {
                  debug('found file: ' + objFileFind.name, dbgNotice);

                  //Test if this is flat
                  var matches = objFileFind.name.match(flats_file_pattern);
                  if ( matches )
                  {
                     flatsfileslib[flatsfileslib.length]=matches[1];
                     flatsfileslib_filename[flatsfileslib_filename.length] = objFileFind.name;
                     debug(flatsfileslib[flatsfileslib.length-1], dbgNotice);
                  }
               }
            }
         }
         while ( objFileFind.next() );
   }

   // Match filter to FITS
   debug ("Matching filter for FITS's filter " +fileData.filter + " in library through "+flatsfileslib.length+" values", dbgNormal);
   var filtername="", filterfilename="";
   for (i = 0; i < flatsfileslib.length; i++)
   {
      debug(flatsfileslib[i], dbgNotice);
      if ( fileData.filter == flatsfileslib[i] )
      {
         filtername = flatsfileslib[i];
         filterfilename = flatsfileslib_filename[i];
      }
   }
   Console.writeln("Matching filter is " + filtername + " (file = " +filterfilename + ")");
   flat_file_name = filterfilename;
   if (flatsdate_nearest==0)
   {
      Console.criticalln ("Matching flat frames for FITS filter wasn't found! Check masterflats availability for given filter: " + fileData.filter+ "");
      return false;
   }


   // Check if all needed masters found
   if (bias_file_name =="")
   {
      Console.criticalln ("Matching bias wasn't found! Check dark library for availability for FITS CCD-TEMP values");
      return false;
   }

   if (dark_file_name =="")
   {
      Console.criticalln ("Matching dark wasn't found! Check dark library for availability for FITS CCD-TEMP and exposure values");
      return false;
   }

   if (flat_file_name =="")
   {
      Console.criticalln ("Matching flat wasn't found! Check flat packs availability for FITS date and filter values");
      return false;
   }

   var full_bias_file_name = pathMasterLib + "/" + templib_dirname_nearest + "/" + bias_file_name;
   var full_dark_file_name = pathMasterLib + "/" + templib_dirname_nearest + "/" + dark_file_name;
   var full_flat_file_name = pathMasterLib + "/" + flatsdate_dirname_nearest + "/" + flat_file_name;

   Console.noteln("Materbias filename: <b>" + full_bias_file_name + "</b>");
   Console.noteln("Masterdark filename: <b>" + full_dark_file_name + "</b>");
   Console.noteln("Masterflat filename: <b>" + full_flat_file_name + "</b>");

   return {
      masterbias:    full_bias_file_name,
      masterdark:    full_dark_file_name,
      masterflat:    full_flat_file_name,
   };
}


/************************************************************************************************************
 * Калибровка фита
 *
 * @param fileName string  полное имя файла.fit включая путь
 * @return string          полное имя файла_c.fit включая путь
 */
function calibrateFITSFile(fileName)
{
	if (fileName==false) {
      debug("Skipping Calibration", dbgNormal);
      return false;
	}

   if (!cfgNeedCalibration) {
      debug("Calibration is off", dbgNormal);
      return fileName;
	}

   // Start calibration
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   console.noteln( "* [" + FileTotalCount + "] Begin calibration of ", fileName );
   console.noteln( "************************************************************" );

   //Set calibrated output path
   CalibratedOutputPath = BaseCalibratedOutputPath;
   if (cfgPathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || cfgPathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
   {
      CalibratedOutputPath = CalibratedOutputPath + "/" + fileData.object;
   }
   CalibratedOutputPath =  CalibratedOutputPath + "/" + cfgCalibratedFolderName;

   // make new file name
   var FileName = File.extractName(fileName) + '.' + fileExtension(fileName)
   var newFileName = FileName.replace(/\.fit$/i, '_c.fit')
   newFileName  = CalibratedOutputPath + '/' + newFileName

   //Проверить - сущетсвует ли файл и стоит ли перезаписывать его
   if ( cfgSkipExistingFiles && File.exists( newFileName ) )
   {
      Console.warningln('File '+ newFileName + ' already exists, skipping calibration' );
   }
   else
   {
      // Get FITS HEADER data
      var fileData = getFileHeaderData(fileName);
      if (!fileData)
         return false;

      // Get Masters files names
      mastersFiles = matchMasterCalibrationFiles (cfgCalibratationMastersPath + (cgfUseBiningFolder? "/bin" + fileData.bin : "")+ "/" + fileData.instrument, fileData);
      if (! mastersFiles)
      {
         Console.warningln("*** Skipping calibration because master calibration file(s) was not found ***");
         return fileName;
      }

      // Check if folder for calibrated files exists
      if ( !File.directoryExists(CalibratedOutputPath) )
         File.createDirectory(CalibratedOutputPath, true);


      var P = new ImageCalibration;
      P.targetFrames = [ // enabled, path
         [true, fileName]
      ];
      P.inputHints = "";
      P.outputHints = "";
      P.pedestal = 0;
      P.pedestalMode = ImageCalibration.prototype.Keyword;
      P.pedestalKeyword = "";
      P.overscanEnabled = false;
      P.overscanImageX0 = 0;
      P.overscanImageY0 = 0;
      P.overscanImageX1 = 0;
      P.overscanImageY1 = 0;
      P.overscanRegions = [ // enabled, sourceX0, sourceY0, sourceX1, sourceY1, targetX0, targetY0, targetX1, targetY1
         [false, 0, 0, 0, 0, 0, 0, 0, 0],
         [false, 0, 0, 0, 0, 0, 0, 0, 0],
         [false, 0, 0, 0, 0, 0, 0, 0, 0],
         [false, 0, 0, 0, 0, 0, 0, 0, 0]
      ];

      P.masterBiasEnabled = true;
      P.masterBiasPath = mastersFiles.masterbias;

      P.masterDarkEnabled = true;
      P.masterDarkPath = mastersFiles.masterdark;

      P.masterFlatEnabled = true;
      P.masterFlatPath = mastersFiles.masterflat;

      P.calibrateBias = false;
      P.calibrateDark = true;    // понять бы - нужно или нет?!
      P.calibrateFlat = false;   // понять бы - нужно или нет?!

      P.optimizeDarks = true;
      P.darkOptimizationThreshold = 0.00000;
      P.darkOptimizationLow = 3.0000;
      P.darkOptimizationWindow = 1024;

      P.darkCFADetectionMode = (fileData.cfa)
         ? ImageCalibration.prototype.ForceCFA
         : ImageCalibration.prototype.IgnoreCFA;

      P.evaluateNoise = true;
      P.noiseEvaluationAlgorithm = ImageCalibration.prototype.NoiseEvaluation_MRS;

      P.outputDirectory = CalibratedOutputPath;
      P.outputExtension = ".fit";
      P.outputPrefix = "";
      P.outputPostfix = "_c";
      P.outputSampleFormat =  ImageCalibration.prototype.f32;
      P.outputPedestal = 0; // Нужно поискать

      P.overwriteExistingFiles = cfgOverwriteAllFiles;
      P.onError = ImageCalibration.prototype.Continue;
      P.noGUIMessages = true;

      var status = P.executeGlobal();
      CalibratedCount++;
      ProcessesCompleted++;

      console.noteln( "<end><cbr><br>",
                      "************************************************************" );
      console.noteln( "* [" + FileTotalCount + "] End of calibration" );
      console.noteln( "************************************************************" );

   }

   // Добавим в массив файлов информацию о создании калибровочного файла, что второй раз не делал
   var fn="";
   if ((fn=newFileName.match(/(.+)\/(.+)_c.fit$/i)) != null)
   {
      debug("path: " +fn[1]);
      debug("matched: " +fn[2]);
      debug("file is calibrated of " +fn[2]);

      AddFileToArray(FITS.CALIBRATED, newFileName,fn[2],fn[1]); //type, full name, signature, path
   }
   else
   {
      debug ("NOT FOUND PATTERN");
   }

   return newFileName;
}


/************************************************************************************************************
 * Косметика фита
 *
 * @param fileName string  Полное Имя файла_c.fit включая путь
 * @return string          Полное имя файла_c_cc.fit включая путь
 */
function cosmeticFit(fileName)
{
	if (fileName==false || !fileName.match(/_c.fit$/)) {
      debug("Skipping Cosmetic Correction", dbgNormal);
      return fileName;
	}
   if (!cfgNeedCalibration) {
      return fileName;
      debug("Cosmetic correction is off (with calibration)", dbgNormal);
   }

   // Start cosmetic correction
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   console.noteln( "* [" + FileTotalCount + "] Begin cosmetic correction of ", fileName );
   console.noteln( "************************************************************" );


   //Set cosmetized output path
   CosmetizedOutputPath = BaseCalibratedOutputPath;
   if (cfgPathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || cfgPathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
   {
      CosmetizedOutputPath = CosmetizedOutputPath + "/" + fileData.object;
   }
   CosmetizedOutputPath =  CosmetizedOutputPath + "/" + cfgCosmetizedFolderName;

   // return new file name
   var FileName = File.extractName(fileName) + '.' + fileExtension(fileName)
   var newFileName = FileName.replace(/_c\.fit$/, '_c_cc.fit');
   newFileName = CosmetizedOutputPath + '/' + newFileName;


   //Проверить - сущетсвует ли файл и стоит ли перезаписывать его
   if ( cfgSkipExistingFiles && File.exists( newFileName ) )
   {
      Console.warningln('File '+ newFileName + ' already exists, skipping cosmetic correction' );
   }
   else
   {
      var fileData = getFileHeaderData(fileName);
      if (!fileData) {
         console.criticalln("File for Cosmetic Correction " + fileName + " not found!");
         return false;
      }


      // Get CosmeticCorrection Process Icon
      var ProcessIconName = cfgCosmetizedProcessName+ '_'+ fileData.instrument.replace('/', '_') + (cgfUseBiningFolder ? '_bin'+ file.bin : '') + (cgfUseExposureInCosmeticsIcons? '_'+ fileData.duration : '');
      debug ("Using ProcessIcon name: ",ProcessIconName, dbgNormal);

      // Check if folder for cosmetics files exists
      if ( !File.directoryExists(CosmetizedOutputPath) )
         File.createDirectory(CosmetizedOutputPath, true);


      var CC = ProcessInstance.fromIcon( ProcessIconName );
      if ( CC == null )
         throw new Error( "No such process icon: " + ProcessIconName);
      if ( !(CC instanceof CosmeticCorrection) )
         throw new Error( "The specified icon does not an instance of CosmeticCorrection: " + ProcessIconName);

      CC.targetFrames = [ // enabled, path
         [true, fileName]
      ];
      CC.outputDir       = CosmetizedOutputPath;
      CC.outputExtension = ".fit";
      CC.prefix          = "";
      CC.postfix         = "_cc";
      CC.overwrite       = cfgOverwriteAllFiles;
      //CC.cfa             = false;

      CC.executeGlobal();
      ProcessesCompleted++;
      CosmetizedCount++;

      console.noteln( "<end><cbr><br>",
                      "************************************************************" );
      console.noteln( "* [" + FileTotalCount + "] End of cosmetic correction " );
      console.noteln( "************************************************************" );
   }


   // Добавим в массив файлов информацию о создании косметического файла, что второй раз не делал
   var fn="";
   if ((fn=newFileName.match(/(.+)\/(.+)_c_cc.fit$/i)) != null)
   {
      debug("path: " +fn[1]);
      debug("matched: " +fn[2]);
      debug("file is calibrated of " +fn[2]);

      AddFileToArray(FITS.COSMETIZED, newFileName,fn[2],fn[1]); //type, full name, signature, path
   }else{
      debug ("PATTERN NOT FOUND");
   }



   return newFileName;
}



/*********************************************************
 * Поиск соответствующего рефенса для выравнивания
 *
 * @param fileName string Имя файла.fit
 **********************************************************
 */
function getRegistrationReferenceFile (objectname)
{

   console.writeln();
   console.noteln("Searching for matching Registration Reference file for object <b>", objectname, "</b>");
   console.writeln();

   //1. Search lib dir for folders
	var objFileFind = new FileFind;
   var templib=[], templib_dirname = []; //empty array

	// Begin search for temp libraries
   debug("Scaning refernce library for available references in " + cfgRegistrationReferencesPath + " ...", dbgNormal);
   var referenceFile="";
	if ( objFileFind.begin( cfgRegistrationReferencesPath + "/*" ) )
	{
         do
         {
			// if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory
               if ( !objFileFind.isDirectory )
               {
                  debug('found file: ' + objFileFind.name, dbgNotice);

                  //Test if this is bias
                  var registerreference_file_pattern = new RegExp('^' + objectname + '[- _].*','i'); 	// +? non-greedy modifier;
                  var matches = objFileFind.name.match(registerreference_file_pattern);
                  if ( matches )
                  {
                     referenceFile = objFileFind.name;
                     console.note("Reference file for <b>" + objectname + "</b> found: ");
                     console.writeln(referenceFile);
                  }
               }
            }
         }
         while ( objFileFind.next() );
   }

   return  ( referenceFile == "" ? false : cfgRegistrationReferencesPath + "/" + referenceFile );
}


/************************************************************************************************************
 * Регистрация (выравнивание) фитов (1-3 в зависимости от был ли чб или цвет)
 *
 * @param files   string | array of strings полное имя файла.fit включая путь (или массив файлов)
 * @return string | array of strings        полное имя файла_c_сс_r.fit включая путь
 *
 */
function registerFits(files)
{
	if (files==false) {
      debug("Skipping Registration", dbgNormal);
      return false;
	}

   if (!cfgNeedRegister) {
      debug ("Registration is off", dbgNormal);
      return files;
   }

   // Прервый всегда будет "файлом", даже если их много
   file = files[0];

   // Start registation
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   console.noteln( "* [" + FileTotalCount + "] Begin registration of ", (files.length != 1 ? files.length + " files" : file) );
   console.noteln( "************************************************************" );

   // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
   debug ("Need to register " + files.length + " file(s)", dbgNotice);

   // Create registration folder
   RegisteredOutputPath = BaseCalibratedOutputPath;
   if (cfgPathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || cfgPathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
   {
      RegisteredOutputPath = RegisteredOutputPath + "/" + fileData.object;
   }
   RegisteredOutputPath =  RegisteredOutputPath + "/" + cfgRegisteredFolderName;

   // Check if folder exists
   if ( !File.directoryExists(RegisteredOutputPath) )
      File.createDirectory(RegisteredOutputPath, true);

   // Search for reference file
   var fileData = getFileHeaderData (file);
   if (!fileData)
      return false;

   // Get reference for Registration
   var referenceFile = getRegistrationReferenceFile( fileData.object );
   if (!referenceFile)
   {
      Console.warningln("Reference file was not found for object " + fileData.object + ". Skipping Registration");
      return files;
   }

   // Start registration for all files
   var newFiles=[]; //empty array
   for (var i = 0; i < files.length; i++)
   {

      // return new file name
      var FileName = File.extractName(files[i]) + '.' + fileExtension(files[i])
      var newFileName = FileName.replace(/_c_cc\.fit$/, '_c_cc_r.fit');
      newFiles[i] = RegisteredOutputPath + '/' + newFileName;

      //Проверить - существует ли файл и стоит ли перезаписывать его
      if ( cfgSkipExistingFiles && File.exists( newFiles[i] ) )
      {
         Console.warningln('File '+ newFileName + ' already exists, skipping Registration' );
      }
      else
      {

         if (files.length > 1)
            Console.noteln ("Registering " + files[i]);

         var P = new StarAlignment;

         P.structureLayers = 5;
         P.noiseLayers = 0;
         P.hotPixelFilterRadius = 1;
         P.noiseReductionFilterRadius = 0;
         P.sensitivity = 0.100;
         P.peakResponse = 0.80;
         P.maxStarDistortion = 0.500;
         P.upperLimit = 1.000;
         P.invert = false;

         P.distortionModel = "";
         P.undistortedReference = false;
         P.distortionCorrection = true;
         P.distortionMaxIterations = 100; // I use 20
         P.distortionTolerance = 0.001;   // i use 0.005

         P.matcherTolerance = 0.0500;
         P.ransacTolerance = 2.00;
         P.ransacMaxIterations = 2000;
         P.ransacMaximizeInliers = 1.00;
         P.ransacMaximizeOverlapping = 1.00;
         P.ransacMaximizeRegularity = 1.00;
         P.ransacMinimizeError = 1.00;
         P.maxStars = 0;
         P.useTriangles = false;
         P.polygonSides = 5;
         P.descriptorsPerStar = 20;
         P.restrictToPreviews = true;
         P.intersection = StarAlignment.prototype.MosaicOnly;
         P.useBrightnessRelations = false;
         P.useScaleDifferences = false;
         P.scaleTolerance = 0.100;
         P.referenceImage = referenceFile;
         P.referenceIsFile = true;
         P.targets = [ // enabled, isFile, image
            [true, true, files[i]]
         ];
         P.inputHints = "";
         P.outputHints = "";
         P.mode = StarAlignment.prototype.RegisterMatch;
         P.writeKeywords = true;
         P.generateMasks = false;
         P.generateDrizzleData = false;
         P.frameAdaptation = false;
         P.noGUIMessages = true;
         P.useSurfaceSplines = false;
         P.splineSmoothness = 0.00; //i use 0.25, но не уверен, что это на что-то влияет :)
         P.pixelInterpolation = StarAlignment.prototype.Auto;
         P.clampingThreshold = 0.30;

         P.outputDirectory = RegisteredOutputPath;
         P.outputExtension = ".fit";
         P.outputPrefix = "";
         P.outputPostfix = "_r";
         P.maskPostfix = "_m";
         P.outputSampleFormat = StarAlignment.prototype.i16; //StarAlignment.prototype.SameAsTarget
         P.overwriteExistingFiles = cfgOverwriteAllFiles;
         P.onError = StarAlignment.prototype.Continue;
         P.useFileThreads = true;      //новое?
         P.fileThreadOverload = 1.20;  //новое?
         P.maxFileReadThreads = 1;     //новое?
         P.maxFileWriteThreads = 1;    //новое?

         /*
          * Read-only properties
          *
         P.outputData = [ // outputImage, outputMask, pairMatches, inliers, overlapping, regularity, quality, rmsError, rmsErrorDev, peakErrorX, peakErrorY, H11, H12, H13, H21, H22, H23, H31, H32, H33, frameAdaptationBiasRK, frameAdaptationBiasG, frameAdaptationBiasB, frameAdaptationSlopeRK, frameAdaptationSlopeG, frameAdaptationSlopeB, frameAdaptationAvgDevRK, frameAdaptationAvgDevG, frameAdaptationAvgDevB, referenceStarX, referenceStarY, targetStarX, targetStarY
         ];
          */

         var status = P.executeGlobal();

         ProcessesCompleted++;
         RegisteredCount++;

         console.noteln( "<end><cbr><br>",
                         "************************************************************" );
         console.noteln( "* [" + FileTotalCount + "] End of registration " );
         console.noteln( "************************************************************" );

      }


      // Добавим в массив файлов информацию о создании регистрируемого файла, что второй раз не делал
      var fn="";
      if ((fn=newFiles[i].match(/(.+)\/(.+)_c_cc_r.fit$/i)) != null)
      {
         debug("path: " +fn[1]);
         debug("matched: " +fn[2]);
         debug("file is registered of " +fn[2]);

         AddFileToArray(FITS.REGISTERED, newFiles[i],fn[2],fn[1]); //type, full name, signature, path
      }else{
         debug ("PATTERN NOT FOUND");
      }

   }

   return newFiles;
}


/*********************************************************
 * Поиск соответствующего рефенса для выравнивания
 *
 * @param fileName string Имя файла.fit
 **********************************************************
 */

function getNormalizationReferenceFile (objectname, filtername, exposure)
{

   console.writeln();
   console.noteln("Searching for matching Normalization Reference file for object <b>", objectname, "</b>, filter <b>" + filtername + "</b> and exposure <b>" + exposure + "s</b>");
   console.writeln();

   //1. Search lib dir for folders
	var objFileFind = new FileFind;
   var templib=[], templib_dirname = []; //empty array

	// Begin search for temp libraries
   debug("Scaning refernce library for available references in " + cfgNormalizationReferencesPath + " ...", dbgNormal);
   var referenceFile="";
	if ( objFileFind.begin( cfgNormalizationReferencesPath + "/*" ) )
	{
         do
         {
			// if not upper dir links
            if ( objFileFind.name != "." && objFileFind.name != "..")
            {
               // if this is Directory
               if ( !objFileFind.isDirectory )
               {
                  debug('found file: ' + objFileFind.name, dbgNotice);

                  //Test if this is bias
                  var normalizationreference_file_pattern = new RegExp('^' + objectname + '[- _].*_' + filtername + '_' + exposure + 's_','i'); 	// +? non-greedy modifier;
                  //Console.writeln(normalizationreference_file_pattern);
                  var matches = objFileFind.name.match(normalizationreference_file_pattern);
                  if ( matches )
                  {
                     referenceFile = objFileFind.name;
                     console.note("Reference file for <b>" + objectname + "</b>filter, <b>" + filtername + "</b>, exposure <b>" + exposure + "s</b>");
                     console.writeln(referenceFile);
                  }
               }
            }
         }
         while ( objFileFind.next() );
   }

   return  ( referenceFile == "" ? false : cfgNormalizationReferencesPath + "/" + referenceFile );
}


/**
 * Нормализация фитов (1-3 в зависимости от был ли чб или цвет)
 *
 * @param
 * @return
 * @todo пачку фитов в одном процессе регистрировать
 */
function localNormalization(files)
{
	if (files==false) {
      debug("Skipping Normalization", dbgNormal);
      return false;
	}

   if (!cfgNeedNormalization) {
      debug ("Normalization is off", dbgNormal);
      return true;
   }

   // Прервый всегда будет "файлом", даже если их много
   var file = files[0];

   // Start normalization
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   console.noteln( "* [" + FileTotalCount + "] Begin normalization of ", (files.length != 1 ? files.length + " files" : file) );
   console.noteln( "************************************************************" );

   // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
   debug ("Need to normilize " + files.length + " file(s)", dbgNotice);


   // Search for reference file
   var fileData = getFileHeaderData (file);
   if (!fileData)
      return false;

   // Get reference for Normalization
   var referenceFile = getNormalizationReferenceFile( fileData.object, fileData.filter, fileData.exposure );
   if (!referenceFile)
   {
      Console.warningln("Reference file was not found for object <b>" + fileData.object + "</b>, filter <b>" + fileData.filter + "</b> and exposure <b>" + fileData.exposure + "s</b>. Skipping LocalNormalization");
      return files;
   }

   // Create normalization folder
   NormalizedOutputPath = BaseCalibratedOutputPath;
   if (cfgPathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || cfgPathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
   {
      NormalizedOutputPath = NormalizedOutputPath + "/" + fileData.object;
   }
   NormalizedOutputPath =  NormalizedOutputPath + "/" + cfgNormilizedFolderName;

   // Check if folder exists
   if ( !File.directoryExists(NormalizedOutputPath) )
      File.createDirectory(NormalizedOutputPath, true);


   // Start registration for all files
   var newFiles=[]; //empty array
   for (var i = 0; i < files.length; i++) {

      if (files.length > 1)
         Console.noteln ("Normalization of " + files[i]);

      var P = new LocalNormalization;
      P.scale = 256;
      P.noScale = true;
      P.rejection = true;
      P.backgroundRejectionLimit = 0.050;
      P.referenceRejectionThreshold = 0.500;
      P.targetRejectionThreshold = 0.500;
      P.hotPixelFilterRadius = 2;
      P.noiseReductionFilterRadius = 0;
      P.referencePathOrViewId = referenceFile;
      P.referenceIsView = false;
      P.targetItems = [ // enabled, image
         [true, files[i]]
      ];
      P.inputHints = "";
      P.outputHints = "";
      P.generateNormalizedImages = LocalNormalization.prototype.GenerateNormalizedImages_Always;
      P.generateNormalizationData = false;
      P.showBackgroundModels = false;
      P.showRejectionMaps = false;
      P.plotNormalizationFunctions = LocalNormalization.prototype.PlotNormalizationFunctions_Palette3D;
      P.noGUIMessages = false;
      P.outputDirectory = NormalizedOutputPath;
      P.outputExtension = ".fit";
      P.outputPrefix = "";
      P.outputPostfix = "_n";
      P.overwriteExistingFiles = cfgOverwriteAllFiles;
      P.onError = LocalNormalization.prototype.OnError_Continue;
      P.useFileThreads = true;
      P.fileThreadOverload = 1.20;
      P.maxFileReadThreads = 1;
      P.maxFileWriteThreads = 1;
      P.graphSize = 800;
      P.graphTextSize = 12;
      P.graphTitleSize = 18;
      P.graphTransparent = false;
      P.graphOutputDirectory = "";

      var status = P.executeGlobal();
      ProcessesCompleted++;
      NormalizedCount++;

      console.noteln( "<end><cbr><br>",
                      "************************************************************" );
      console.noteln( "* [" + FileTotalCount + "] End of normalization " );
      console.noteln( "************************************************************" );

      // return new file name
      var FileName = File.extractName(files[i]) + '.' + fileExtension(files[i])
      var newFileName = FileName.replace(/_c_cc_r\.fit$/, '_c_cc_r_n.fit');
      newFiles[i] = RegisteredOutputPath + '/' + newFileName;

      // Добавим в массив файлов информацию о создании нормализуемого файла, что второй раз не делал
      var fn="";
      if ((fn=newFiles[i].match(/(.+)\/(.+)_c_cc_r_n.fit$/i)) != null)
      {
         debug("path: " +fn[1]);
         debug("matched: " +fn[2]);
         debug("file is normalized of " +fn[2]);

         AddFileToArray(FITS.NORMALIZED, newFiles[i],fn[2],fn[1]); //type, full name, signature, path
      }else{
         debug ("PATTERN NOT FOUND");
      }


   }
   return false;
}


/**
 * Выбор лучших фитов и их копирование в отдельную папку (1-3 в зависимости от был ли чб или цвет)
 *
 * @param
 * @return
 */
function approvingFiles (files)
{

	if (files==false) {
      debug("Skipping approving", dbgNormal);
      return false;
	}
   else
   {
      debug("Aprroving isn't working. Skipping approving", dbgNormal);
      return false;
   }

   if (!cfgNeedApproving) {
      debug ("Approving is off", dbgNormal);
      return true;
   }

   // Прервый всегда будет "файлом", даже если их много
   var file = files[0];

   // Get some header data
   var fileData = getFileHeaderData (file);
   if (!fileData)
      return false;


   // Start approving
   console.noteln( "<end><cbr><br>",
                   "************************************************************" );
   console.noteln( "* Begin approving of ", (files.length != 1 ? files.length + " files" : file) );
   console.noteln( "************************************************************" );

   // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
   debug ("Need to measure " + files.length + " file(s)", dbgNotice);

   // Create normalization folder
   ApprovedOutputPath = BaseCalibratedOutputPath;
   if (cfgPathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || cfgPathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
   {
      ApprovedOutputPath = ApprovedOutputPath + "/" + fileData.object;
   }
   ApprovedOutputPath = ApprovedOutputPath + "/" + cfgApprovedFolderName;

   // Check if folder exists
   if ( !File.directoryExists(ApprovedOutputPath) )
      File.createDirectory(ApprovedOutputPath, true);

   // Start approving for all files
   var newFiles=[]; //empty array
   for (var i = 0; i < files.length; i++) {

      if (files.length > 1)
         Console.noteln ("Measuring of " + files[i]);

      debug ("Image scale: "+fileData.scale, dbgNotice);

      var P = new SubframeSelector;

      P.routine = SubframeSelector.prototype.MeasureSubframes;
      P.subframes = [ // subframeEnabled, subframePath
               [true, files[i]]
      ];

      P.weightingExpression = "";
      P.fileCache = false;
      P.subframeScale = fileData.scale;
      P.cameraGain = 1.0000;
      P.cameraResolution = SubframeSelector.prototype.Bits16;
      P.siteLocalMidnight = 24;
      P.scaleUnit = SubframeSelector.prototype.ArcSeconds;
      P.dataUnit = SubframeSelector.prototype.Electron;
      P.structureLayers = 5;
      P.noiseLayers = 0;
      P.hotPixelFilterRadius = 1;
      P.applyHotPixelFilter = false;
      P.noiseReductionFilterRadius = 0;
      P.sensitivity = 0.1000;
      P.peakResponse = 0.8000;
      P.maxDistortion = 0.5000;
      P.upperLimit = 1.0000;
      P.backgroundExpansion = 3;
      P.xyStretch = 1.5000;
      P.psfFit = SubframeSelector.prototype.Gaussian;
      P.psfFitCircular = false;
      P.pedestal = 0;
      P.roiX0 = 0;
      P.roiY0 = 0;
      P.roiX1 = 0;
      P.roiY1 = 0;
      P.inputHints = "";
      P.outputHints = "";
      P.outputExtension = ".fit";
      P.outputPrefix = "";
      P.outputPostfix = "_a";
      P.outputKeyword = "SSWEIGHT";
      P.overwriteExistingFiles = true;
      P.onError = SubframeSelector.prototype.Continue;
      P.sortProperty = SubframeSelector.prototype.FWHM;
      P.graphProperty = SubframeSelector.prototype.FWHM;

      var status = P.executeGlobal();
      debug("Status: " + status, dbgNotice);


      // Output filtered files
      var P2 = new SubframeSelector;

      debug ("Need to approve " + files.length + " file(s)", dbgNotice);
      debug ("Approved expression: "+cfgApprovedExpression, dbgNotice);
      P2.approvalExpression = cfgApprovedExpression; // change this

      P2.routine = SubframeSelector.prototype.OutputSubframes;
      P2.subframes = [ // subframeEnabled, subframePath
               [true, files[i]]
      ];
      P2.measurements= P.measurements;
      P2.onError = SubframeSelector.prototype.Continue;

      P2.outputExtension = ".fit";
      P2.outputPrefix = "";
      P2.outputPostfix = "_a";
      P2.outputKeyword = "SSWEIGHT";
      P2.outputDirectory = ApprovedOutputPath;
      P.weightingExpression = "";


      P2.fileCache = false;
      P2.subframeScale = fileData.scale;
      P2.cameraGain = 1.0000;
      P2.cameraResolution = SubframeSelector.prototype.Bits16;
      P2.siteLocalMidnight = 24;
      P2.scaleUnit = SubframeSelector.prototype.ArcSeconds;
      P2.dataUnit = SubframeSelector.prototype.Electron;

      var status2 = P2.executeGlobal();
      debug("Status: ", status2, dbgNotice);

      P2.writeIcon("test");


      // return new file name
      var FileName = File.extractName(files[i]) + '.' + fileExtension(files[i])
      var newFileName = FileName.replace(/_c_cc_r_n\.fit$/, '_c_cc_r_n_a.fit');
      var newFileName = FileName.replace(/_c_cc_r\.fit$/, '_c_cc_r_a.fit');
      newFiles[i] = ApprovedOutputPath + '/' + newFileName;
   }

   return newFiles;

}



/*
 * Debayer files
 *
 * WARNING Не тестировал работоспособность; не менял под конфигуратор, процедура осталась в оригинале
 *
 */
function debayerSplitFit(file)
{
   //return file; // @todo

   if (!file.cfa) {
      Console.writeln ("File is not CFA, skipping debayering");
      return [file];
   }
   else
   {
      //ЗАГЛУШКА!!!
      Console.criticalln ("File is CFA, but debayering wasn't tested, sorry!");
      return [file];
   }

   console.writeln('start to debayer fit: '+ file.dst);

   var P = new Debayer;

   switch (file.filter) {
      case 'RGGB':
         P.bayerPattern = Debayer.prototype.RGGB;
         break;

      case 'BGGR':
         P.bayerPattern = Debayer.prototype.BGGR;
         break;

      case 'GBRG':
         P.bayerPattern = Debayer.prototype.GBRG;
         break;

      case 'GRBG':
         P.bayerPattern = Debayer.prototype.GRBG;
         break;

      default:
         return false;
   }

   P.debayerMethod = Debayer.prototype.VNG;
   P.evaluateNoise = false;
   P.noiseEvaluationAlgorithm = Debayer.prototype.NoiseEvaluation_MRS;
   P.showImages = true;

   var inputImageWindow = ImageWindow.open(
      cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit'
   );
   var sourceView = inputImageWindow[0].mainView;

   var status = P.executeOn( sourceView );

   inputImageWindow[0].close();

   var resultView = View.viewById( P.outputImage );

   // / debayer



   // splitRGB

   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/R/cc'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/R/cc', true);
   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/G/cc'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/G/cc', true);
   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/B/cc'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/B/cc', true);

   var imgW = resultView.image.width;
   var imgH = resultView.image.height;

   var red   = new ImageWindow(imgW, imgH, 1, 16, false, false, "");
   var green = new ImageWindow(imgW, imgH, 1, 16, false, false, "");
   var blue  = new ImageWindow(imgW, imgH, 1, 16, false, false, "");

   resultView.image.selectedChannel = 0;
   red.mainView.beginProcess(UndoFlag_NoSwapFile);
   red.mainView.image.assign(resultView.image);
   red.mainView.endProcess();
   red.saveAs(
      cfgOutputPath +'/'+ file.object +'/R/cc/debayer_'+ file.dst +'_R_c_cc.fit'
      , false, false, false, false);

   resultView.image.selectedChannel = 1;
   green.mainView.beginProcess(UndoFlag_NoSwapFile);
   green.mainView.image.assign(resultView.image);
   green.mainView.endProcess();
   green.saveAs(
      cfgOutputPath +'/'+ file.object +'/G/cc/debayer_'+ file.dst +'_G_c_cc.fit'
      , false, false, false, false);

   resultView.image.selectedChannel = 2;
   blue.mainView.beginProcess(UndoFlag_NoSwapFile);
   blue.mainView.image.assign(resultView.image);
   blue.mainView.endProcess();
   blue.saveAs(
      cfgOutputPath +'/'+ file.object +'/B/cc/debayer_'+ file.dst +'_B_c_cc.fit'
      , false, false, false, false);

//   resultView.window.saveAs(
//      cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/cc/deb_'+ file.dst +'_c_cc.fit'
//      , false, false, false, false );

   resultView.window.forceClose();

   return [
      {
         object: file.object,
         filter: 'R',
         dst: 'debayer_'+ file.dst +'_R',
      },
      {
         object: file.object,
         filter: 'G',
         dst: 'debayer_'+ file.dst +'_G',
      },
      {
         object: file.object,
         filter: 'B',
         dst: 'debayer_'+ file.dst +'_B',
      }
   ];
}


/**
 * Получение данных из заголовка фита
 *
 * @param file string
 * @return object
 */
function getFileHeaderData(fileName)
{


   //C:/ASTRO/_z/newton/2016-10-13/53P-Van-Biesbroeck-001-L-bin1-1m.fit
   console.writeln();
   console.note("Getting HeaderData for file: ");
   console.writeln(""+ fileName);
   console.writeln();

   var image = ImageWindow.open(fileName)[0];
   var keywords = image.keywords;
   for (var k in keywords) {
      keywords[k].trim();

      if (typeof headers[ keywords[k].name ] != 'undefined') {
         headers[ keywords[k].name ] = keywords[k].strippedValue;
         debug('header '+ keywords[k].name +'='+ keywords[k].strippedValue, dbgNotice);
      }
   }

   if (!headers.OBSERVER || !headers.TELESCOP) {
      console.criticalln('Can`t find Observer or Telescope');
      return false;
   }

   if (!headers['DATE-OBS'] || !headers.EXPTIME) {
      console.criticalln('Can`t find Date or Exposure time');
      return false;
   }

   if (!headers['CCD-TEMP'] ) {
      console.criticalln('Can`t find CCD TEMP');
      return false;
   }

   if (!headers.FILTER || !headers.OBJECT || !headers.XBINNING) {
      console.criticalln('cant find Filter, Object or Binning');
      return false;
   }

   // Возьмем фильтр, заменим его по справочнику и затем переведем в UPCASE
   headers.FILTER = String.toUpperCase(headers.FILTER);
   if (typeof filters[ headers.FILTER ] != 'undefined') {
      headers.FILTER = filters[ headers.FILTER ];
   }
   var filter = String.toUpperCase(headers.FILTER);
   //debug('Filter name after normalization: '+ headers.FILTER +'',2);

   image.close();


   // @todo date midnight / midday
   // @todo utc
   return {
      instrument: (cgfUseObserverName ? headers.OBSERVER +'/':'') + headers.TELESCOP,              // was Vitar/MakF10 or (for me) just SW250
      camera:     headers.INSTRUME,                                   // ArtemisHSC
      date:       headers['DATE-OBS'].substr(0, "2017-01-01".length ),  // 2016-10-13
      time:       headers['DATE-OBS'].substr("2017-01-01T".length, "00:00".length).replace(':', '_'),  // 23_15
      name:       fileName.split('/').reverse()[0],                     // pix-001.fit
      object:     headers.OBJECT,                                       // M106
      filter:     filter,                                               // L
      cfa:        !! (
         (filter == 'RGGB') ||
         (filter == 'BGGR') ||
         (filter == 'GBRG') ||
         (filter == 'GRBG')
      ),
      temp:       parseInt(headers['CCD-TEMP']),                        // 28 весто 28.28131291
      bin:        parseInt(headers.XBINNING),                           // 1
      scale:      parseFloat(headers['XPIXSZ']) / parseFloat(headers['FOCALLEN']) * 206.0 , //
      duration:   parseInt(headers.EXPTIME),                            // 1800
      exposure:   parseInt(headers.EXPTIME)                             // dublicate for convinience
   };
}




/**
 * Поиск расширения файла
 */
function fileExtension(file)
{
   //console.writeln('ext file='+ file);
   var ext = file.match(/\.([^.]+)$/);

   return ext && ext.length ? ext[1] : false
}


