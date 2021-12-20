#ifndef StarnetCleanUp_config_default_js
#define StarnetCleanUp_config_default_js
#endif

//---- for standalone debug ----
//normally these are connected in main module
#ifndef DEBUG
#define DEBUG true
#endif
#ifndef StarnetCleanUp_settings_js
#include "StarnetCleanUp-settings.js" // Settings object
#endif
#ifndef StarnetCleanUp_Global_js
#include "StarnetCleanUp-global.js" // Ver, Title and other info
#endif
#ifndef StarnetCleanUp_Main
var Config = new ConfigData(); // Variable for global access to script data
#endif


/******************************************************************************************
 *
 *    Конфигурация
 *
 *****************************************************************************************/
#define DEFAULT_EXTENSION ".fit"

Config.Original_Image = "";
Config.Starnet_Image = "";
Config.Starnet_Cleaned = "";
Config.Stars = "";
Config.Stars_Cleaned = "";

Config.WorkingMode = WORKINGMODE.processDirectoryStat;


// Настройки для отладчика
dbgCurrent = true;
var dbgCurrentPopupMessages = false;
var cfgDebugLevel = dbgNotice; //dbgNormal, dbgNotice  dbgCurrent
//////////////////////////////////////////////////////


if (DEBUG)
    console.writeln('<br/><br/>Default cofing loaded...<br/>');
