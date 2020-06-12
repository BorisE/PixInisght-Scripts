#feature-id Batch Processing > BatchDBE
#feature-info  An automated calibration, cosmetic and registration<br/>\
   Copyright &copy; 2020 Boris Emchenko

#feature-icon BatchChannelExtraction.xpm


 #define TITLE "BatchDBE"
 #define VERSION "0.1"
 #define COMPILE_DATE "2020/05/18"

 #define INFO_STRING "A script to perform all calibration routines in fully automatic manner."
 #define COPYRIGHT_STRING "Copyright &copy; 2020 Boris Emchenko<br/>"


// Global switches
 #ifndef DEBUG
    #define DEBUG true
 #endif

// Includes
 #ifndef AutoCalibrate_Global_js
    //#include "AutoCalibrate-global.js" // Ver, Title and other info
 #endif
// Need to be in front of other declarations


 #ifndef AutoCalibate_Engine_js
    //#include "AutoCalibrate-engine.js" // Engine
 #endif


//////////////////////////////////////////
// ПЕРЕОПРЕДЕЛЕНИЕ ДЕФОЛТНОЙ КОНФИГУРАЦИИ
//////////////////////////////////////////
// DEBUG
var dbgNormal = 1; //  минимальное количество сообщений
var dbgNotice = 2; // максимальное количество сообщений
var dbgCurrent = 0; // максимальное количество сообщений
// Настройки для отладчика
var cfgDebugLevel = dbgNotice; //dbgNormal, dbgNotice  dbgCurrent

//////////////////////////////////////////
if (!DEBUG)
    console.hide();

//if (DEBUG) console.clear();

console.noteln(TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE);
console.noteln("PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
    ", ", coreVersionMinor, ", ", coreVersionRelease);


23;
var ProcessIconName = "batchDBE1";

function main()
{
    var w = ImageWindow.activeWindow;

    Process(w, ProcessIconName, cfgRunNumber);

    //////////////////////////////////////////
    if (DEBUG)
        console.writeln("Script finished");

}

main();


/* **************************************************************************************************************
 *
 * Модуль обработки
 *
/* **************************************************************************************************************
 *
 * @param w image window name
 * @param ProcessIconName process name
 * @param IterationsNumber number of iterations
 * @return result boolean
 */
function Process(w, ProcessIconName, IterationsNumber = 1)
{
    debug("Using ProcessIcon name: ", ProcessIconName, dbgNormal);

    //Try to use saved process
    var DBEproc = ProcessInstance.fromIcon(ProcessIconName);

    if (DBEproc == null || !(DBEproc instanceof DynamicBackgroundExtraction)) {
        console.criticalln("The specified icon does not exists or not instance of DynamicBackgroundExtraction: " + ProcessIconName);
        return false;

    } else {
        with (DBEproc) {
           discardModel = false;
           normalize = true;
           replaceTarget = true;
           //data=[];
        }
    }

    for (var i = 0; i < IterationsNumber; i++) {
        //Запустить процесс
        debug("Iteration "+(i+1), dbgNormal);
         //DBEproc.launchInterface();
        DBEproc.executeOn(w.mainView);
    }

    return true;
}

function AutocalibrationDialog() {
    this.__base__ = Dialog;
    this.__base__();

    var labelWidth1 = this.font.width("Output format hints :" + 'T');
    var ttStr = ""; //temp str var


    //

    // 1. Info Label

    //
    this.helpLabel = new Label(this);
    with (this.helpLabel) {
        frameStyle = FrameStyle_Box;
        margin = 4;
        wordWrapping = true;
        useRichText = true;
        text = "<p><b>" + TITLE + " v" + VERSION + "</b><br/>" +
            INFO_STRING +
            ".</p><p>" +
            COPYRIGHT_STRING +
            "</p>"
            setScaledMinWidth(600); //min width
    }

}


function debug(st, level = dbgCurrent) {
    if (DEBUG && level <= cfgDebugLevel) {
        if (level == dbgNotice) {
            console.write("<sub>");
            console.write(st);
            console.writeln("</sub>");
        } else {
            console.writeln(st);
        }
    }
}
