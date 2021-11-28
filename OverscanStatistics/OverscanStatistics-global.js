 #ifndef OverscanStatistics_Global_js
    #define OverscanStatistics_Global_js
 #endif

 #define TITLE "QHY600 Utilities"
 #define VERSION "3.4"
 #define COMPILE_DATE "2021/11/26"

 #define INFO_STRING "A script for QHY600 overscan and other support tools"
 #define COPYRIGHT_STRING "Copyright &copy; 2021 by Boris Emchenko<br/>"

 #define SETTINGS_KEY_BASE "OverscanStatistics/"

/*
Copyright (C) 2021 by Boris Emchenko http://astromania.info
 */

/*
Version History

/*
 * ver 3.4 [2021/11/26]
 * - workaround for BLKLEVEL (equivalent of OFFSET from SharpCap)
 *
 * ver 3.3 [2021/11/18]
 * - can select which of QHY parameters to add
 * - save settings and export/import of desktop shortcut
 *
 * ver 3.2 [2021/11/16]
 * - checking if image has overscan area before GetStatistics and Normalize
 * - small optimizations and bugfixes
 *
 * ver 3.1 [2021/11/13]
 * - GUI: force modification and subdir checkbox
 * - small bugfixes
 *
 * ver 3.0 [2021/11/13]
 * - add QHY camera parameters into FITS header
 * - dialog redesign
 * - saving options
 *
 * ver 2.0 [2021/11/08]
 * - normalize fits by using optblack value reference
 *
 * ver 1.1 [2021/10/30]
 * - auto binning level detection
 * - process subdirectories
 * - bug Settings not saved corrected
 *
 * ver 1.01 [2021/10/17]
 * - bin2 button
 * - rectagles positions corrections
 *
 * ver 1.00 [2021/10/17]
 * - GUI
 * - code structuring
 * - many more improvements
 *
 * ver 0.1 [2021/10/10]
 * - working release, but everything is manual
 *
 * Use ProcessObj.processDirectory(path) to generate output csv file
 *
 * Use ProcessObj.processFile(WindowId) to process opened file (make previews and output stat to console)
 *
*/
//////////////////////////////////////////////////////
/*
Глобальные переменные
 */
//////////////////////////////////////////////////////
// DEBUG
var dbgNormal = 1; //  минимальное количество сообщений
var dbgNotice = 2; // максимальное количество сообщений
var dbgCurrent = 0; // максимальное количество сообщений

var WORKINGMODE = {
    UNSET: -1,
    processDirectoryStat: 1,
    processCurrentWindowStat: 2,
    processNormalizeDir: 3,
    processCurrentWindowNorm: 4,
    processQHYDataDir: 5,
    processQHYDataWindow: 6,
}; // Типы расположения файлов, см. documentation.txt

// Global vars
var textFile;



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

/**
* Поиск расширения файла
*/
function fileExtension(file) {
    //console.writeln('ext file='+ file);
    var ext = file.match(/\.([^.]+)$/);

    return ext && ext.length ? ext[1] : false
}


function print_array(arr, level = dbgCurrent) {
    if (DEBUG && level <= cfgDebugLevel) {
        console.writeln("Printing array contents:");
        arr.forEach(
            function (element) {
            console.writeln(element);
        })
    }
}
