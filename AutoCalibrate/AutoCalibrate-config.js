/*
******************************************************************************************************
*   Documentation
******************************************************************************************************

******************************************************************************************************
* 	1. MASTER FILES LIB
******************************************************************************************************
СХЕМА 1:

calibratePath +'/'+ file.instrument +'/bin'+ file.bin +'/bias.fit';
calibratePath +'/'+ file.instrument +'/bin'+ file.bin +'/dark-'+ file.duration +'.fit';
calibratePath +'/'+ file.instrument +'/bin'+ file.bin +'/flat-'+ file.filter +'.fit';

 ... / Vitar / MakF10 / bin1 / 	dark-300.fit
 ... / Vitar / MakF10 / bin2 / 	bias.fit
 ... / Vitar / MakF10 / bin2 / 	flat-L.fit

 

СХЕМА 2:

 ... / [Vitar /] SW250 [ / bin1] / Darks -20 / 	bias-TEMP_25deg_n117.xisf
							dark-TEMP_20deg-EXPTIME_1200_n55.xisf
							dark-TEMP_20deg-EXPTIME_600.fit
							dark-TEMP_20deg-EXPTIME_60.xisf
							
 ... / [Vitar /] SW250 [ / bin1] / flats20180803 / flat-FILTER_B-BINNING_1_20180803.xisf

Важные замечания:
	1) В иерархии две папки необязательны: имя обсерватории и бининг. Этим управляют параметры cgfUseObserverName и cgfUseBiningFolder соответственно. 
	2) Папки и файлы подбираются на основании их имен папок/файлов, определяемых шаблонами ниже в конфигурации. Содержимое файлов не проверяется! Расширение файлов не проверяется (может быть любым!)
	3) Если будет найдено несколько папок/файлов подходящих под шаблон, будет использован первый найденый. Нужно следить, чтобы папки/файлы были уникальными в части ключевых эелментов, определяемых шаблонами
 

 
******************************************************************************************************
* 	2. OUTPUT OF CALIBRATED FILES 
******************************************************************************************************
Возможны 3 схемы.
Опредедяется параметром cfgUseRelativeOutputPath и cfgCreateObjectFolder

Схема 1. Относительная

В случае ее файлы на выходехранятся так:

 path to file 	/ input FITS file
				/ calibrated 	/ calibrated FITS file
				/ cosmetics 	/ cosmetics corrected FITS file
				/ debayered 	/ debayered file (if СFA)
				/ registered 	/ registered files

Схема 2. Относительная с группировкой по объекту
			Разновидность схемы 1, когда включен параметр cfgCreateObjectFolder	= true
			
 path to file 	/ input FITS file
				/ objectname 	/ calibrated 	/ calibrated FITS file
								/ cosmetics 	/ cosmetics corrected FITS file
								/ debayered 	/ debayered file (if СFA)
								/ registered 	/ registered files
				
Схема 3. Абсолютная, старая (НЕ ФАКТ, ЧТО РАБОТАЕТ!!!)

	calibrated FITS file -	будет храниться в той же папке, где и исходный
	cosmetics corrected FITS file - будет хранитсья в папке cfgOutputPath/calibrated
	debayerd corrected FITS file - будет хранитсья в папке cfgOutputPath/debayered 

******************************************************************************************************
* 	3. COSMETIC CORRECTION ICONS 
******************************************************************************************************
Для каждого инструмента (и, если задано в конфигурации, обсерватории), бининга (если не отключено в конфигурации) и имеющейся длительности дарокв, нужно создать набор процессов Cosmetic Correction

Они должны назывтаь в следующем формате: 
	'cosmetic_наблюдатель_телескоп_bin1_длинаэкспозиции' (Сosmetic_Vitar_SW250_bin1_600)

если отключено cgfUseObserverName и cgfUseBiningFolder:
	'cosmetic_телескоп_длинаэкспозиции' (Сosmetic_SW250_600)

если отключено cgfUseExposureInCosmeticsIcons то вообще будет:
	'Сosmetic_телескоп_' (Сosmetic_SW250)
Использую именно такую конфигурацию

******************************************************************************************************
* 	4. INPUT PATH
******************************************************************************************************
Или только в указанном каталоге
Или если установлен параметр cfgSearchInSubDirs, то и в подкаталогах. Кроме тех, что начинаются со знака подчеркивания!
*/

//////////////////////////////////////////////////////
/*
			Конфигурацию задавать здесь
*/
//////////////////////////////////////////////////////

// КАЛИБРОВАТЬ?
var cfgNeedCalibration = true;
//var cfgNeedCalibrate = false;

// ВЫРАВНИВАТЬ ПО ЗВЕЗДАМ?
var cfgNeedRegister  = true;

// НОРМАЛИЗОВАТЬ ФОН?
var cfgNeedNormalization  = true;

// ОТСЕИТЬ ХОРОШУЮ ЧАСТЬ ФИТОВ?
var cfgNeedApproving = true;

//ИСПОЛЬЗОВАТЬ ВТОРОЙ ПРОХОД
var cfgUseSecnodPass = true;

//Переделывать ли найденные файлы
var cfgOverwriteAllFiles = true;




//Пути к файлам
//Папка с исходными фитами
var cfgInputPath = 'c:/Users/bemchenko/Documents/DSlrRemote/test calibration'; // без финального "/" (@todo убрать. если есть)
//Искать в подпапках? В комбинации с cfgUseRelativeOutputPath будет просматривать все вложенные папки с калиброванными фитами!
var cfgSearchInSubDirs = true;
//Пропускать каталоги, начинающиеся с ...
var cfgSkipDirsBeginWith = "_";

//Папка с библиотекой мастеров
var cfgCalibratationMastersPath = 'c:/Users/bemchenko/Documents/DSlrRemote/Vedrus'; // без финального "/" (@todo убрать. если есть)

//Папка с библиотекой референсов для выравнивания по звездам
var cfgRegistrationReferencesPath = 'c:/Users/bemchenko/Documents/DSlrRemote/RegistrationReferences'; // без финального "/" 

//Папка с библиотекой референсов для выравнивания фона
var cfgNormalizationReferencesPath = 'c:/Users/bemchenko/Documents/DSlrRemote/NormalizationReferences'; // без финального "/" 



// Настройка схемы, где должны храниться фиты на выходе:
//	true: относительная; фиты на выходе будут в подпапках в той же папке, где и исходные фиты 
//	false: абсолютная; фиты на выходе будут в папке, заданном в cfgOutputPath
var cfgUseRelativeOutputPath = true;
// Все обработанные файлы будут помещаться в папку с именем объекта
var cfgCreateObjectFolder = true;

//Папка с калиброванными фитами на выходе (в случае использования абсолютного способа адресации)
var cfgOutputPath = 'c:/Users/bemchenko/Documents/DSlrRemote/test calibration'; // без финального "/" (@todo убрать. если есть)

//Подпапка с калиброванными фитами 
var cfgCalibratedFolderName = 'calibrated'; 	// без финального "/" 
//Подпапка с фитами после косметики
var cfgCosmetizedFolderName = 'cosmetized'; 	// без финального "/" 
//Префикс названия процесса косметики
var cfgCosmetizedProcessName = 'Cosmetic';
//Подпапка с фитами после выравнивания
var cfgRegisteredFolderName="registered";		// без финального "/" 
//Подпапка с фитами после нормализации
var cfgNormilizedFolderName="rnormilized";		// без финального "/" 
//Подпапка с отобранными фитами 
var cfgApprovedFolderName="approved";			// без финального "/" 

// Использовать имя наблюдателя в иерархии папок?
// Для меня не нужно, Олегу пригодиться
var cgfUseObserverName = false;
// Использовать бининг в иерархии папок?
var cgfUseBiningFolder = false; // Для меня не нужно, Олегу и другим пригодиться
// Использовать разные косметики для разной длительности?
var cgfUseExposureInCosmeticsIcons = false;	// Для меня не нужно, может Олегу и перфекционистам пригодится

var cfgDarkExposureLenghtTolerance = 30; // В секундах; MasterDark  всегда подбирается самый ближайший их тех, которые длиннее экспозиции кадра. 
										 // Данный параметр разрешае ему быть на 30 сек короче! если задать 0, то будут рассматриваться только те дарки, которые длинее

// Выражение для фильтрации кадров
var cfgApprovedExpression = 'FWHM > 4.5';
	  

//////////////////////////////////////////////////////
/* 
					Продвинутые настройки
*/
//////////////////////////////////////////////////////

//Filters dictionary
	var filters = {
      'LUMINANCE': 'L',
      'LIGHT': 'L',
      'LUM': 'L',
      'H-ALPHA': 'Ha', 	//HA
      'O-III': 'Oiii', 	//O3
      'S-II': 'Sii', 	//S2
      'SII': 'Sii',		//S2
      'BLUE': 'B',
      'GREEN': 'G',
      'RED': 'R'
      };

// Паттерны для поиска нужных мастер калибровочных файлов

// Папка с дарками/биасами
var darks_dir_pattern = new RegExp('darks\\s*(-\\d+).*','i'); 		// [...darks..-20...] - слово darks в любом регистре и далее через пробел/без пробела температура
																	// Примеры: Darks -20 | darks-20 | masterDarks-20lib from 2018 12 01 
															
// Имя BIAS файла
var bias_file_pattern = new RegExp('bias','i'); 					// [...bias...] - слово bias в любом регистре
																	// Примеры: bias-TEMP_25deg_n117, BIAS, bias-20bin1_n118_from20180910, 
// Имя DARK файла																
var darks_file_pattern = new RegExp('dark.*EXPTIME_(\\d+)','i'); 	// [...dark...EXPTIME_1200...] - слово dark и EXPTIME_число должны быть обязательно
																	// Примеры: dark-TEMP_30deg-EXPTIME_1200 | masterdark_from20181218 exptime_120sec

// Папка с FLATами
//var flats_dir_pattern = new RegExp('^masterflats.*_(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)','i'); // masterflats300_20180901
var flats_dir_pattern = new RegExp('masterflats[_ -]*(\\d+)','i'); // [...masterflats..20180901...] - слово masterflats далее пробел/нижнее подчеркивание тире в любом колчиестве, далее дата числами в формате YYYYMMDD 
																	// Примеры: masterflats_20180901 | masterflats 20190102 from 2019 | lib_masterflats_20180901_from20180905-20181010

// Имя флет файла
var flats_file_pattern = new RegExp('flat.*FILTER_(.+?)-','i'); 	// +? non-greedy modifier; 
																	// [flat...filter_Sii-...] - начинается со слова flat и дальше должно быть FILTER_названиефильтра-
																	// Примеры: flat-FILTER_B-BINNING_1.xisf, flat-FILTER_B-BINNING_1_20190201, masterflatimakesomedayFILETER_R-
// Настройки для отладчика
																	
var cfgDebugEnabled = true;
var cfgDebugLevel = dbgNormal; 
//////////////////////////////////////////////////////