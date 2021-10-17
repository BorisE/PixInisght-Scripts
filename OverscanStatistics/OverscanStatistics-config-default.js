 #ifndef OverscanStatistics_config_default_js
 #define OverscanStatistics_config_default_js
 #endif

 #define DEFAULT_EXTENSION ".fit"

///////////////////////////////////////////////////////
/*
Конфигурация
 */
//////////////////////////////////////////////////////
Config.InputPath = 'e:/DSlrRemote/+M77'; //ПАПКА С ИСХОДНЫМИ ФИТАМИ
Config.OutputCSVFile = "overscandata.txt";


// Настройки для отладчика
dbgCurrent = true;
var cfgDebugLevel = dbgNotice; //dbgNormal, dbgNotice  dbgCurrent
//////////////////////////////////////////////////////


if (DEBUG)
    console.writeln('<br/><br/>Default cofing loaded...<br/>');
