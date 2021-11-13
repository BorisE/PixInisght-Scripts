#ifndef OverscanStatistics_config_default_js
#define OverscanStatistics_config_default_js
#endif

//---- for standalone debug ----
//normally these are connected in main module
#ifndef DEBUG
#define DEBUG true
#endif
#ifndef OverscanStatistics_settings_js
#include "OverscanStatistics-settings.js" // Settings object
#endif
#ifndef OverscanStatistics_Global_js
#include "OverscanStatistics-global.js" // Ver, Title and other info
#endif
#ifndef OverscanStatistics_Main
var Config = new ConfigData(); // Variable for global access to script data
#endif


/******************************************************************************************
 *
 *    Конфигурация
 *
 *****************************************************************************************/
#define DEFAULT_EXTENSION ".fit"
Config.InputPath = 'e:/DSlrRemote/+M77'; //ПАПКА С ИСХОДНЫМИ ФИТАМИ
Config.OutputCSVFile = "overscandata.txt";
Config.SearchInSubDirs = true;


// Таблица нормализации
Config.NormalizationTable = {
   "P3": {"bin1": {"-20" : 140, "-25" : 139}, "bin2": {"-20" : 564}},
   "P4": {"bin1": {"-20" : 127, "-25" : 126}, "bin2": {"-20" : 510}}
};
//console.writeln(Config.NormalizationTable['P3']['bin1']['-20']);  // bin, temp
//console.writeln(Config.NormalizationTable.P3.bin1['-20']);  // bin, temp


// Пусть к внешнему скрипту для восстановления даты
var ScriptFullName = #__FILE__ ;
var ScriptPath = ScriptFullName.substring(0, ScriptFullName.lastIndexOf('/')+1); //with end "/"
//console.writeln("#__FILE__: " + fullpath);
//console.writeln("Path: " + path);
Config.restoreDateJSScript = ScriptPath + "changeFileDate.js";

// Модифицировать FITS заголовок даже если данные в нем уже есть (старые данные будут перезаписаны!)
Config.ForceHeaderModification = false;
Config.AddData_Gain = 0;
Config.AddData_Offset = 10;
Config.AddData_ReadMode = 1;
Config.AddData_USBLimit = 50;

// Настройки для отладчика
dbgCurrent = true;
dbgCurrentPopupMessages = false;
var cfgDebugLevel = dbgNotice; //dbgNormal, dbgNotice  dbgCurrent
//////////////////////////////////////////////////////


if (DEBUG)
    console.writeln('<br/><br/>Default cofing loaded...<br/>');
