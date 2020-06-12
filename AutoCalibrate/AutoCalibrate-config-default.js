 #ifndef AutoCalibrate_config_default_js
 #define AutoCalibrate_config_default_js
 #endif

 #define DEFAULT_EXTENSION ".fit"

///////////////////////////////////////////////////////
/*
Конфигурация
 */
//////////////////////////////////////////////////////
Config.InputPath = 'e:/DSlrRemote/+M77'; //ПАПКА С ИСХОДНЫМИ ФИТАМИ
Config.SearchInSubDirs = true; //Искать в подпапках? В комбинации с cfgUseRelativeOutputPath будет просматривать все вложенные папки с калиброванными фитами!
Config.PathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER; //КАКОЙ СПОСОБ РАЗМЕЩЕНИЯ ФАЙЛОВ ИСПОЛЬЗОВАТЬ

Config.NeedCalibration = true; // КАЛИБРОВАТЬ?
Config.NeedCosmeticCorrection = true; // КОСМЕТИКА?
Config.NeedABE = false; // РОВНЯТЬ ФОН ABE?
Config.NeedRegister = true; // ВЫРАВНИВАТЬ ПО ЗВЕЗДАМ?
Config.NeedNormalization = true; // НОРМАЛИЗОВАТЬ ФОН?
Config.NeedApproving = true; // ОТСЕИТЬ ХОРОШУЮ ЧАСТЬ ФИТОВ? Пока не работает (глюк PI?)

// Библиотеки калибровки/референосов
Config.CalibratationMastersPath = 'e:/DSlrRemote/_Calibration masters library/Vedrus'; // без финального "/" (@todo убрать. если есть) //Папка с библиотекой мастеров
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


Config.CalibratedFolderName = 'calibrated'; // без финального "/"  //Подпапка с калиброванными фитами
Config.CosmetizedFolderName = 'cosmetized'; // без финального "/"  //Подпапка с фитами после косметики
Config.CosmetizedProcessName = 'Cosmetic'; //Префикс названия процесса косметики
Config.DebayerdFolderName = "debayered"; // без финального "/" //Подпапка с фитами после дебайеризации

Config.ABEFolderName = "dABE"; // без финального "/" //Подпапка с результатом ABE
Config.ABEProcessName = "ABE"; //Название процесса ABE

Config.RegisteredFolderName = "registered"; // без финального "/" 	//Подпапка с фитами после выравнивания
Config.NormilizedFolderName = "rnormilized"; // без финального "/" 	//Подпапка с фитами после нормализации

//Подпапка с отобранными фитами
Config.ApprovedFolderName = "approved"; // без финального "/"

//Для режима PUT_FINALS_IN_OBJECT_SUBFOLDER
Config.FinalsDirName = "Results";

//Пропускать каталоги, начинающиеся с ...
Config.SkipDirsBeginWith = "_";
// Пропустить каталоги, если имя каталога полностью совпадает
Config.SkipDirs = [Config.CalibratedFolderName, Config.CosmetizedFolderName, Config.DebayerdFolderName, Config.ABEFolderName, Config.RegisteredFolderName, Config.NormilizedFolderName, Config.ApprovedFolderName, Config.OutputPath, Config.FinalsDirName]; //стандартные каталоги
Config.SkipDirs.push('asteroids', 'bad', 'Bad'); //User (чувствительно к регистру)
// Пропустить каталоги, если имя каталога содержит одну из строк
Config.SkipDirsContains = ['.data', '.pxiproject'];


//Структура:    Config.CalibratationMastersPath / [OBSERVER] / TELESCOP / [CAMERA] / [BIN] / 
//Пример: ../Boris/Newton320/QSI/BIN1/
Config.UseObserverName  = false;    // Использовать имя наблюдателя в иерархии папок? // Для меня не нужно, Олегу пригодиться
Config.UseCameraName    = true;    // Использовать название камеры в иерархии папок?
Config.UseBiningFolder  = false;    // Использовать бининг в иерархии папок?

// Использовать разные косметики для разной длительности?
Config.UseExposureInCosmeticsIcons = false; // Для меня не нужно, может Олегу и перфекционистам пригодится

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

//////////////////////////////////////////////////////
/*
Продвинутые настройки
 */
//////////////////////////////////////////////////////

//Filters dictionary
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
    'H-ALPHA': 'Ha', //HA
    'O-III': 'Oiii', //O3
    'S-II': 'Sii', //S2
    'BLUE': 'B',
    'GREEN': 'G',
    'RED': 'R'
};

var CAMERA_DICTIONARY = {
    'ArtemisHSC': 'Atik383',
    'QSI 683ws S/N 00602566 HW 10.00.00 FW 06.03.01 PI 7.6.2971.17': 'QSI683ws',
    'Moravian Instruments, G4-16000' : 'MI G4-16000'
};


// Паттерны для поиска нужных мастер калибровочных файлов

// Папка с дарками/биасами
var darks_dir_pattern = new RegExp('darks(\\s|_)*(-\\d+).*', 'i'); // [...darks..-20...] - слово darks в любом регистре и далее через пробел/_/без пробела температура обязательно со знаком минус
// Примеры: Darks -20 | darks-20 | masterDarks_-20lib from 2018 12 01

// Имя BIAS файла
var bias_file_pattern = new RegExp('bias.*((bin|binning)(\\s|_)*(\\d)){1}.*', 'i'); // [...bias...bin  #..] - слово bias в любом регистре + bin или binning и цифра через пробел
// Примеры: bias-bin2_TEMP_25deg_n117, BIASBINNING_2, bias-20bin1_n118_from20180910,

var bias_wobin_file_pattern = new RegExp('bias.*', 'i'); // [...bias...] - слово bias в любом регистре без указания бин

// Имя DARK файла
var darks_file_pattern = new RegExp('dark.*((bin|binning)(\\s|_)*(\\d)){1}.*(EXPTIME|EXP)(\\s|_)*(\\d+).*', 'i'); // [...dark...EXPTIME_1200...BIN] - слово DARK, EXPTIME|EXP_число и BIN_число должны быть обязательно. Число через пробел, _, без пробела
// Примеры: dark-TEMP_30deg-EXPTIME_1200-BINNING_2 | masterdark_from20181218 exp120sec bin 2
var darks_wobin_file_pattern = new RegExp('dark.*(EXPTIME|EXP)(\\s|_)*(\\d+).*', 'i'); // [...dark...EXPTIME_1200...] - слово DARK, EXPTIME|EXP_число ,bin не обязателен

// Папка с FLATами
//var flats_dir_pattern = new RegExp('^masterflats.*_(\\d\\d\\d\\d)(\\d\\d)(\\d\\d)','i'); // masterflats300_20180901
var flats_dir_pattern = new RegExp('masterflats[_ -]*(\\d+)', 'i'); // [...masterflats..20180901...] - слово masterflats далее пробел/нижнее подчеркивание тире в любом колчиестве, далее дата числами в формате YYYYMMDD
// Примеры: masterflats_20180901 | masterflats 20190102 from 2019 | lib_masterflats_20180901_from20180905-20181010

// Имя флет файла
var flats_file_pattern = new RegExp('flat.*FILTER_(.+?)-.*((bin|binning)(\\s|_)*(\\d)){1}.*', 'i'); // +? non-greedy modifier;
// [flat...filter_Sii-...] - начинается со слова flat и дальше должно быть FILTER_названиефильтра-
// а потом еще должно встретиться BIN|BINNING число (можно без пробела или через _
// Примеры: flat-FILTER_B-BINNING_1.xisf, flat-FILTER_B-BIN1_20190201, masterflatimakesomedayFILETER_R-___bin_2


// Настройки для отладчика
var cfgDebugLevel = dbgNotice; //dbgNormal, dbgNotice  dbgCurrent
//////////////////////////////////////////////////////


if (DEBUG)
    console.writeln('<br/><br/>Default cofing loaded...<br/>');
