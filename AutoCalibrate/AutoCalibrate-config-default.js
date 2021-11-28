 #ifndef AutoCalibrate_config_default_js
 #define AutoCalibrate_config_default_js
 #endif

 #define DEFAULT_EXTENSION ".fit"

///////////////////////////////////////////////////////
/*
Конфигурация
 */
//////////////////////////////////////////////////////
Config.InputPath = 'e:/DSlrRemote/+M77';                //ПАПКА С ИСХОДНЫМИ ФИТАМИ
Config.SearchInSubDirs = true;                          //Искать в подпапках? В комбинации с cfgUseRelativeOutputPath будет просматривать все вложенные папки с калиброванными фитами!
Config.PathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER;       //КАКОЙ СПОСОБ РАЗМЕЩЕНИЯ ФАЙЛОВ ИСПОЛЬЗОВАТЬ

Config.NeedCalibration = true;                           // КАЛИБРОВАТЬ?
Config.NeedCosmeticCorrection = false;                   // КОСМЕТИКА?
Config.NeedABE = false;                                  // РОВНЯТЬ ФОН ABE?
Config.NeedRegister = false;                             // ВЫРАВНИВАТЬ ПО ЗВЕЗДАМ?
Config.NeedNormalization = false;                        // НОРМАЛИЗОВАТЬ ФОН?
Config.NeedApproving = false;                            // ОТСЕИТЬ ХОРОШУЮ ЧАСТЬ ФИТОВ? Пока не работает (глюк PI?)

// Библиотеки калибровки/референосов
Config.CalibratationMastersPath = 'd:/DSlrRemote/Masters Structure/Vedrus'; // без финального "/" (@todo убрать. если есть) //Папка с библиотекой мастеров
Config.RegistrationReferencesPath = 'e:/DSlrRemote/_RegistrationReferences'; // без финального "/"  //Папка с библиотекой референсов для выравнивания по звездам
Config.NormalizationReferencesPath = 'e:/DSlrRemote/_NormalizationReferences'; // без финального "/"  //Папка с библиотекой референсов для выравнивания фона


//ПАПКА С КАЛИБРОВАННЫМИ ФИТАМИ НА ВЫХОДЕ
//В случае использования относительного способа адресации (PATHMODE.PUT_IN_SUBFOLDER) или автоматического, который может переключиться в PUT_IN_SUBFOLDER:
if (Config.PathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || Config.PathMode == PATHMODE.AUTO || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
    Config.OutputPath = 'Calibrated'; // без финального "/" (@todo убрать. если есть)
//В случае использования абсолютного способа адресации (PATHMODE.ABSOLUTE):
} else if (Config.PathMode == PATHMODE.ABSOLUTE) {
    Config.OutputPath = 'e:/DSlrRemote'; // без финального "/" (@todo убрать. если есть)
//Иначе - можно игнорировать
} else {
    Config.OutputPath = '';
}

//Переделывать ли найденные файлы
Config.SkipExistingFiles = true; //Перед запуском процесса проверять, существует ли файл и пропускать если да
Config.OverwriteAllFiles = true; //Настройка для процессов PI. Пока не придумал ситуацию, в которой его нужно было бы отключить

//ИСПОЛЬЗОВАТЬ ВТОРОЙ ПРОХОД
Config.UseSecnodPass = true; //Зачем нужен второй проход.
                             //Первый проход работает от исходников (не калиброванных), передавая файлы по цепочке преобразований.
                             //Если выключен второй проход, то нельзя взять, например, косметические фильтры и заставить их выровняться - система просто пропустит их не найдя "исходный" файл.
                             //В этой ситуации включаем второй проход и система попробует доделать "верхние" этапы начиная от того, в котором находится файл
                             //Т.е. для специфических операций


Config.CalibratedFolderName = 'calibrated';         // без финального "/"  //Подпапка с калиброванными фитами
Config.CosmetizedFolderName = 'cosmetized';         // без финального "/"  //Подпапка с фитами после косметики
Config.CosmetizedProcessName = 'Cosmetic';          // Префикс названия процесса косметики
Config.DebayerdFolderName = "debayered";            // без финального "/" //Подпапка с фитами после дебайеризации
Config.ABEFolderName = "dABE";                      // без финального "/" //Подпапка с результатом ABE
Config.RegisteredFolderName = "registered";         // без финального "/" 	//Подпапка с фитами после выравнивания
Config.NormilizedFolderName = "rnormilized";        // без финального "/" 	//Подпапка с фитами после нормализации

Config.ApprovedFolderName = "approved";             // без финального "/"   //Подпапка с отобранными фитами


//Для режима PUT_FINALS_IN_OBJECT_SUBFOLDER
Config.FinalsDirName = "Results";


//Пропускать каталоги, начинающиеся с ...
Config.SkipDirsBeginWith = "_";
// Пропустить каталоги, если имя каталога полностью совпадает
Config.SkipDirs = [Config.CalibratedFolderName, Config.CosmetizedFolderName, Config.DebayerdFolderName, Config.ABEFolderName, Config.RegisteredFolderName, Config.NormilizedFolderName, Config.ApprovedFolderName, Config.OutputPath, Config.FinalsDirName]; //стандартные каталоги
Config.SkipDirs.push('asteroids', 'bad', 'Bad', 'Aligned'); //User (чувствительно к регистру)
// Пропустить каталоги, если имя каталога содержит одну из строк
Config.SkipDirsContains = ['.data', '.pxiproject', '_old'];


//Структура:    Config.CalibratationMastersPath / [OBSERVER] / TELESCOP / [CAMERA] / [BIN] /
//Пример: ../Boris/Newton320/QSI/BIN1/
Config.UseObserverName  = false;    // Использовать имя наблюдателя в иерархии папок? // Для меня не нужно, Олегу пригодиться
Config.UseCameraName    = true;    // Использовать название камеры в иерархии папок?

Config.UseBiningFolder  = false;    // Использовать бининг в иерархии папок?
                                    // ВАЖНО!!! Для QHY600 будет использоваться вне зависимости от значения данного параметра

// Использовать разные косметики для разной длительности?
Config.UseExposureInCosmeticsIcons = false; // Для меня не нужно, может Олегу и перфекционистам пригодится
Config.UseCameraInCosmeticsIcons = true; // Когда на одном инструменте несколько камер, как у меня с QSI и Atik

Config.DarkExposureLenghtTolerance = 30; // В секундах; MasterDark  всегда подбирается самый ближайший их тех, которые длиннее экспозиции кадра.
// Данный параметр разрешае ему быть на 30 сек короче! если задать 0, то будут рассматриваться только те дарки, которые длинее

// Формат файла
Config.OutputFormatIC = ImageCalibration.prototype.f32; //default
//Config.OutputFormatIC = ImageCalibration.prototype.i16; //reduce size


// Параметры для Local Normalization
Config.NormalizationScale = 256;
Config.NormalizationNoScaleFlag = true;

// Выражение для фильтрации кадров
Config.ApprovedExpression = 'FWHM > 4.5';

// Название процесса ABE
Config.ABEProcessName = "ABE_autocalibration";      

//////////////////////////////////////////////////////
/*
Продвинутые настройки
 */
//////////////////////////////////////////////////////

//Filters dictionary
//Всегда все в UPCASE
var FILTERS_DICTIONARY = {
    'L': 'L',
    'R': 'R',
    'G': 'G',
    'B': 'B',
    'HA': 'HA',
    'SII': 'SII',
    'OIII': 'OIII',
    'LUMINANCE': 'L',
    'LIGHT': 'L',
    'LUM': 'L',
    'H-ALPHA': 'HA', //HA
    'O-III': 'OIII', //O3
    'S-II': 'SII', //S2
	'O3': 'OIII',
	'S2': 'SII',
    'BLUE': 'B',
    'GREEN': 'G',
    'RED': 'R'
};

var CAMERA_DICTIONARY = {
    'ArtemisHSC': 'Atik383',
    'QSI 683ws S/N 00602566 HW 10.00.00 FW 06.03.01 PI 7.6.2971.17': 'QSI683ws',
    'Moravian Instruments, G4-16000' : 'MI G4-16000',
    'QHYCCD-Cameras-Capture'         : 'QHY600'

};


// Паттерны для поиска нужных мастер калибровочных файлов

// Папка с дарками/биасами
var darks_dir_pattern = new RegExp('darks(\\s|_)*(-\\d+).*', 'i'); // [...darks..-20...] - слово darks в любом регистре и далее через пробел/_/без пробела температура обязательно со знаком минус
// Примеры: Darks -20 | darks-20 | masterDarks_-20lib from 2018 12 01

// Имя BIAS файла
 // [...bias...bin  #..] - слово bias в любом регистре + bin или binning и цифра через пробел
// Примеры: bias-bin2_TEMP_25deg_n117, BIASBINNING_2, bias-20bin1_n118_from20180910,
var bias_file_pattern = new RegExp('bias.*((bin|binning)(\\s|_)*(\\d))(?!.*_c).*$', 'i');                 //not containing "_c" - reserved for version wo overscan; or just for usual (not QHY) bias
var bias_file_pattern_wo_overscan = new RegExp('bias.*((bin|binning)(\\s|_)*(\\d)).*_c.*$', 'i');         //bias.*((bin|binning)(\s|_)*(\d)).*_c.*$ - overscan version, valid for QHY only
var bias_file_pattern_binning = 4;


// BIAS для QHY600 с именем пресета
 // [...bias...bin  #..] - слово bias в любом регистре + _P#_ + bin или binning и цифра через пробел
 // Пример: bias_TEMP_20deg_P3_BINNING_1_n238.fit
//var bias_qhy600_file_pattern = new RegExp('bias.*(P(\\d+)).*((bin|binning)(\\s|_)*(\\d)){1}.*', 'i');
//var bias_wobin_file_pattern = new RegExp('bias.*', 'i'); // [...bias...] - слово bias в любом регистре без указания бин

// Имя DARK файла
// [...dark...EXPTIME_1200...BIN] - слово DARK, EXPTIME|EXP_число и BIN_число должны быть обязательно. Число через пробел, _, без пробела
// Примеры: dark-TEMP_30deg-EXPTIME_1200-BINNING_2 | masterdark_from20181218 exp120sec bin 2
var darks_file_pattern = new RegExp('dark.*((bin|binning)(\\s|_)*(\\d)){1}.*(EXPTIME|EXP)(\\s|_)*(\\d+)(?!.*_c).*$', 'i');
var darks_file_pattern_wo_overscan = new RegExp('dark.*((bin|binning)(\\s|_)*(\\d)){1}.*(EXPTIME|EXP)(\\s|_)*(\\d+).*_c.*$', 'i');  //dark.*((bin|binning)(\s|_)*(\d)){1}.*(EXPTIME|EXP)(\s|_)*(\d+)(?!.*_c).*$
var darks_file_pattern_binning  = 4;
var darks_file_pattern_exposure = 7;

// [...dark...EXPTIME_1200...] - слово DARK, EXPTIME|EXP_число ,bin не обязателен
//var darks_wobin_file_pattern = new RegExp('dark.*(EXPTIME|EXP)(\\s|_)*(\\d+).*', 'i');
//var darks_wobin_file_pattern_exposure = 3;

// [...dark...EXPTIME_1200...BIN] - слово DARK, EXPTIME|EXP_число и BIN_число должны быть обязательно. Число через пробел, _, без пробела
// пример: dark-TEMP_20deg-P4-BINNING_2-EXPTIME_300-n54.fit
//var darks_qhy600_file_pattern = new RegExp('dark.*(P(\\d+)).*((bin|binning)(\\s|_)*(\\d)){1}.*(EXPTIME|EXP)(\\s|_)*(\\d+).*', 'i');

// Папка с FLATами
//var flats_dir_pattern = new RegExp('^masterflats.*_(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)','i'); // masterflats300_20180901
var flats_dir_pattern = new RegExp('masterflats[_ -]*(\\d+)', 'i'); // [...masterflats..20180901...] - слово masterflats далее пробел/нижнее подчеркивание тире в любом колчиестве, далее дата числами в формате YYYYMMDD
// Примеры: masterflats_20180901 | masterflats 20190102 from 2019 | lib_masterflats_20180901_from20180905-20181010

// Имя флет файла
// [flat...filter_Sii-...] - начинается со слова flat и дальше должно быть FILTER_названи ефильтра-
// а потом еще должно встретиться BIN|BINNING число (можно без пробела или через _
// ВАЖНО!!! не дожно ничего начинаться на _c
// Примеры: flat-FILTER_B-BINNING_1.xisf, flat-FILTER_B-BIN1_20190201, masterflatimakesomedayFILETER_R-___bin_2

var flats_file_pattern = new RegExp('flat.*FILTER_(.+?)-.*((bin|binning)(\\s|_)*(\\d))(?!.*_c).*$', 'i');           // flat.*FILTER_(.+?)-.*((bin|binning)(\s|_)*(\d)).*$
var flats_file_pattern_wo_overscan = new RegExp('flat.*FILTER_(.+?)-.*((bin|binning)(\\s|_)*(\\d)).*_c.*$', 'i');   // flat.*FILTER_(.+?)-.*((bin|binning)(\s|_)*(\d)).*_c.*$
var flats_file_pattern_filter   = 1;
var flats_file_pattern_binning  = 5;


//var flats_qhy600_file_pattern = new RegExp('flat.*FILTER_(.+?)-.*(P(\\d+)).*((bin|binning)(\\s|_)*(\\d)){1}.*', 'i'); // +? non-greedy modifier;
// [flat...filter_Sii-...] - начинается со слова flat и дальше должно быть FILTER_названиефильтра-
// а потом еще должно встретиться BIN|BINNING число (можно без пробела или через _
// Примеры: flat-FILTER_L-P3-BINNING_1_n11.fit


// for FITS HEADER parsing
var headers = {
    'XBINNING': null,
    'OBSERVER': null,
    'TELESCOP': null,
    'INSTRUME': null,
    'DATE-OBS': null,
    'EXPTIME': null,
    'CCD-TEMP': null,
    'XPIXSZ': null,
    'FOCALLEN': null,
    'FILTER': null,
    'OBJECT': null,
    'OBJCTRA': null,
    'OBJCTDEC': null,
    'READOUTM': null,
    'GAIN': null,
    'OFFSET': null,
    'QOVERSCN': null,
    'USBLIMIT': null,
    'QPRESET': null

};


// Настройки для отладчика
var cfgDebugLevel = dbgNormal; //dbgNormal, dbgNotice  dbgCurrent
//////////////////////////////////////////////////////


if (DEBUG)
    console.writeln('<br/><br/>Default cofing loaded...<br/>');
