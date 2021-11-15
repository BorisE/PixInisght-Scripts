/*
Copyright (C) 2016  Oleg Milantiev (oleg@milantiev.com http://oleg.milantiev.com)
Developed 2019 by Boris Emchenko
 */

/*
Точка входя для запуска AutoCalibrate без графического интерфейса, сразу на запуск процесса с заданными в конфиге (или прямо здесь) параметрами
 */

#feature-id Batch Processing > AutoCalibrationCMD
#feature-info  An automated calibration, cosmetic and registration<br/>\
   <br/> \
   @todo \
   <br/> \
   Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko

#feature-icon BatchChannelExtraction.xpm

// Global switches
 #ifndef DEBUG
    #define DEBUG true
 #endif

// Includes
 #ifndef AutoCalibrate_Global_js
    #include "AutoCalibrate-global.js" // Ver, Title and other info
 #endif
 #ifndef AutoCalibrate_settings_js
    #include "AutoCalibrate-settings.js" // Settings object
 #endif
var Config = new ConfigData(); // Variable for global access to script data
// Need to be in front of other declarations

 #ifndef AutoCalibrate_config_default_js
    #include "AutoCalibrate-config-default.js" // Load default config values
 #endif

 #ifndef AutoCalibate_Engine_js
    #include "AutoCalibrate-engine.js" // Engine
 #endif


//////////////////////////////////////////
// ПЕРЕОПРЕДЕЛЕНИЕ ДЕФОЛТНОЙ КОНФИГУРАЦИИ
//////////////////////////////////////////

Config.InputPath = 'd:/DSlrRemote/Comet67P'; // без финального "/" (@todo убрать. если есть)
Config.OutputFormatIC = ImageCalibration.prototype.i16; //reduce size

Config.PathMode = PATHMODE.PUT_IN_ROOT_SUBFOLDER;
Config.UseSecnodPass = false;
Config.NeedABE = false;

//////////////////////////////////////////
if (!DEBUG)
    console.hide();

//if (DEBUG) console.clear();

console.noteln(TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE);
console.noteln("PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
    ", ", coreVersionMinor, ", ", coreVersionRelease);

var Engine = new AutoCalibrateEngine();
Engine.Process();

if (DEBUG)
    console.writeln("Script finished");
//////////////////////////////////////////
