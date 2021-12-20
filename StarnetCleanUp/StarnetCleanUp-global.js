 #ifndef StarnetCleanUp_Global_js
    #define StarnetCleanUp_Global_js
 #endif

 #define TITLE "Starnet Cleanup"
 #define VERSION "0.2"
 #define COMPILE_DATE "2021/12/19"

 #define INFO_STRING "A script for Starnet cleanup"
 #define COPYRIGHT_STRING "Copyright &copy; 2021 by Boris Emchenko<br/>"

 #define SETTINGS_KEY_BASE "StarnetCleanUp/"

/*
Copyright (C) 2021 by Boris Emchenko http://astromania.info
 */

/*
Version History

/*
 * ver 0.2 [2021/12/19]
 * - gui added, but not connected to engine
 *
 * ver 0.1 [2021/12/16]
 * - only engine
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
    makeStarsOnly: 1,
    makeStarnetMerged: 2,
    makeCombined: 3
}; 



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
