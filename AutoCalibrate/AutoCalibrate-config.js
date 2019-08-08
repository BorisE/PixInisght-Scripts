/*
//////////////////////////////////////////////////////
/*
			Конфигурация
*/
//////////////////////////////////////////////////////

//ПАПКА С ИСХОДНЫМИ ФИТАМИ
var cfgInputPath = 'e:/DSlrRemote/+M100'; // без финального "/" (@todo убрать. если есть)

//КАКОЙ СПОСОБ РАЗМЕЩЕНИЯ ФАЙЛОВ ИСПОЛЬЗОВАТЬ
var cfgPathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER;

//ПАПКА С КАЛИБРОВАННЫМИ ФИТАМИ НА ВЫХОДЕ 
//В случае использования относительного способа адресации (PATHMODE.PUT_IN_SUBFOLDER) или автоматического, который может переключиться в PUT_IN_SUBFOLDER:
if (cfgPathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || cfgPathMode == PATHMODE.AUTO) {
	var cfgOutputPath = 'Calibrated'; // без финального "/" (@todo убрать. если есть)
//В случае использования абсолютного способа адресации (PATHMODE.ABSOLUTE):
}else if (cfgPathMode == PATHMODE.ABSOLUTE) {
	var cfgOutputPath = 'c:/Users/bemchenko/Documents/DSlrRemote/test calibration'; // без финального "/" (@todo убрать. если есть)
//Иначе - можно игнорировать
}else {
	var cfgOutputPath = '';
}



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
var cfgSkipExistingFiles = true; //Перед запуском процесса проверять, существует ли файл и пропускать если да
var cfgOverwriteAllFiles = true; //НИКОГДА НЕ ВКЛЮЧАТЬ!!! иначе PI будет создавать дубли по кругу пока место не закончится




//Искать в подпапках? В комбинации с cfgUseRelativeOutputPath будет просматривать все вложенные папки с калиброванными фитами!
var cfgSearchInSubDirs = true;
//Пропускать каталоги, начинающиеся с ...
var cfgSkipDirsBeginWith = "_";

//Папка с библиотекой мастеров
var cfgCalibratationMastersPath = 'c:/Users/bemchenko/Documents/DSlrRemote/Vedrus'; // без финального "/" (@todo убрать. если есть)
var cfgCalibratationMastersPath = 'e:/DSlrRemote/_Calibration masters library/Vedrus'; // без финального "/" (@todo убрать. если есть)

//Папка с библиотекой референсов для выравнивания по звездам
var cfgRegistrationReferencesPath = 'c:/Users/bemchenko/Documents/DSlrRemote/RegistrationReferences'; // без финального "/" 
var cfgRegistrationReferencesPath = 'e:/DSlrRemote/_RegistrationReferences'; // без финального "/" 

//Папка с библиотекой референсов для выравнивания фона
var cfgNormalizationReferencesPath = 'c:/Users/bemchenko/Documents/DSlrRemote/NormalizationReferences'; // без финального "/" 
var cfgNormalizationReferencesPath = 'e:/DSlrRemote/_NormalizationReferences'; // без финального "/" 



// Настройка схемы, где должны храниться фиты на выходе:
//	true: относительная; фиты на выходе будут в подпапках в той же папке, где и исходные фиты 
//	false: абсолютная; фиты на выходе будут в папке, заданном в cfgOutputPath
var cfgUseRelativeOutputPath = true; //OBSOLETE
// Все обработанные файлы будут помещаться в папку с именем объекта
var cfgCreateObjectFolder = true; //OBSOLETE


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

// Параметры для Local Normalization
var cfgNormalizationScale=256;
var cfgNormalizationNoScaleFlag=true;


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
var cfgDebugLevel = dbgCurrent; 
//////////////////////////////////////////////////////