///////////////////////////////////////////////////////
/*
Конфигурация
 */
//////////////////////////////////////////////////////
Config.InputPath = 'e:/DSlrRemote/B33';                //ПАПКА С ИСХОДНЫМИ ФИТАМИ
Config.SearchInSubDirs = true;                          //Искать в подпапках? В комбинации с cfgUseRelativeOutputPath будет просматривать все вложенные папки с калиброванными фитами!
Config.PathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER;       //КАКОЙ СПОСОБ РАЗМЕЩЕНИЯ ФАЙЛОВ ИСПОЛЬЗОВАТЬ

Config.NeedCalibration = true;                           	// КАЛИБРОВАТЬ?
Config.NeedCosmeticCorrection = true;                   	// КОСМЕТИКА?
Config.NeedABE = false;                                  	// РОВНЯТЬ ФОН ABE?
Config.NeedRegister = true;                             	// ВЫРАВНИВАТЬ ПО ЗВЕЗДАМ?
Config.NeedNormalization = true;                        	// НОРМАЛИЗОВАТЬ ФОН?
Config.NeedApproving = true;                            	// ОТСЕИТЬ ХОРОШУЮ ЧАСТЬ ФИТОВ? Пока не работает (глюк PI?)

// Библиотеки калибровки/референосов
Config.CalibratationMastersPath 	= 'd:/DSlrRemote/_MasterCalibration/Vedrus'; 		// без финального "/" (@todo убрать. если есть) //Папка с библиотекой мастеров
Config.RegistrationReferencesPath 	= 'd:/DSlrRemote/_RegistrationReferences'; 			// без финального "/"  //Папка с библиотекой референсов для выравнивания по звездам
Config.NormalizationReferencesPath 	= 'd:/DSlrRemote/_NormalizationReferences'; 		// без финального "/"  //Папка с библиотекой референсов для выравнивания фона

//Переделывать ли найденные файлы
Config.SkipExistingFiles = true; //Перед запуском процесса проверять, существует ли файл и пропускать если да
Config.OverwriteAllFiles = true; //Настройка для процессов PI. Пока не придумал ситуацию, в которой его нужно было бы отключить

//ИСПОЛЬЗОВАТЬ ВТОРОЙ ПРОХОД
Config.UseSecnodPass = false; //Зачем нужен второй проход.
                             //Первый проход работает от исходников (не калиброванных), передавая файлы по цепочке преобразований.
                             //Если выключен второй проход, то нельзя взять, например, косметические фильтры и заставить их выровняться - система просто пропустит их не найдя "исходный" файл.
                             //В этой ситуации включаем второй проход и система попробует доделать "верхние" этапы начиная от того, в котором находится файл
                             //Т.е. для специфических операций


//Структура:    Config.CalibratationMastersPath / [OBSERVER] / TELESCOP / [CAMERA] / [BIN] /
//Пример: ../Boris/Newton320/QSI/BIN1/
Config.UseObserverName  = false;    // Использовать имя наблюдателя в иерархии папок? // Для меня не нужно, Олегу пригодиться
Config.UseCameraName    = true;    // Использовать название камеры в иерархии папок?

Config.UseBiningFolder  = false;    // Использовать бининг в иерархии папок?

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

var BIAS_DIR_NAME = "darks";
var DARKS_DIR_NAME = "darks";


// Настройки для отладчика
var cfgDebugLevel = dbgNotice; //dbgNormal, dbgNotice  dbgCurrent
//////////////////////////////////////////////////////
if (DEBUG)
    console.writeln('<br/><br/>Custom config loaded...<br/>');
