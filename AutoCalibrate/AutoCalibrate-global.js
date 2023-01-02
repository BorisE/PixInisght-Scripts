 #ifndef AutoCalibrate_Global_js
    #define AutoCalibrate_Global_js
	console.writeln("AutoCalibrate_Global_js");
 #endif

 #define TITLE "AutoCalibrate"
 #define VERSION "6.1b"
 #define COMPILE_DATE "2023/01/02"

 #define INFO_STRING "A script to perform all calibration routines in fully automatic manner"
 #define COPYRIGHT_STRING "Copyright &copy; 2016 Oleg Milantiev, 2019 - 2023 Boris Emchenko<br/>"

 #define SETTINGS_KEY_BASE "AutoCalibrate/"

/*
Copyright (C) 2016  Oleg Milantiev (oleg@milantiev.com http://oleg.milantiev.com)
Developed 2019-2022 by Boris Emchenko http://astromania.info
 */

/*
Version History

TODO:
- добавить в диалог параметр для Absolute Path
- проверить, что дебайрезиация тоже работает


v 6.1b [2023/01/02]
- Camera presets configuration was moved from CameraHeaders.js to Config
- bug fixing

v 6.1 [2023/01/02]
- Subframe selector auto measurement saving result into icon/text file
- some optimization

v 6.0  beta3 [2022/12/11]
- progress dialog
- some optimization

v 6.0  beta2 [2022/12/11]
- camera custom parameters preset module again rewritten
- some folder struture optimization

v 6.0  beta1 [2022/12/07]
- new calibration masters folder structure
- structurized code for masters searching 
- camera custom parameters preset module addded (to test)

v 5.5 [2022/08/31]
- files can be fit or fits extension

v 5.4 [2022/05/28]
- skip files contians (--- and +--)
- LN updated to 1.8.9-1 PI

v 5.3 [2021/11/28]
- progess calculations

v 5.2 [2021/11/27]
- Overscan cutting was reworked (actually, algorithm was totally wrong in 5.1)
- CC different binnig bug 

v 5.1 [2021/11/16]
- Cut QHY overscan if present

v 5.0 [2021/11/13] (former 4.4)
- Adopted to QHY camera
- Code optimization
- more verbose output

v 4.3b [2020/12/22]
- Minor bugfixes

v 4.3 [2020/07/16]
- Camera name in CC process icon (if specified in configuration UseCameraInCosmeticsIcons)

v 4.2 [2020/05/13]
- ABE to second pass
- исправление по обработке разных ситуаций, возникающих в конвейере при отключении опци (с косметикой - без, с ABE - без, ...)

v 4.1b [2020/05/05]
- local distorsion during registration gives some abnormal results and was switched off

v 4.1 [2020/04/26]
- имя камеры может быть включено в путь калибровочных кадров
- словарь CAMERA_DICTIONARY для замены имен камеры на френдли имена

v 4.04 [2019/11/02]
- Форматирование кода
- Апгрейд CMD версии до текущей архитектуры

v 4.03 [2019/10/26]
- Апдейт StarAlignment (1.8.7)

v 4.02 [2019/10/21]
- Cosmetic Correction стал опциональным

v 4.01 [2019/10/20]
- Переход на новый Config

v 4.0 [2019/10/13]
- GUI: basic parameters can be directly specified
- GUI: saving instance, saving in Settings DB
- Engine: try also to find Calibration Masters without specified BIN
- Engine: debug for notice output slighltly changed

v 4.0alpha4 [2019/10/10]
- Improving GUI

v 4.0alpha2 [2019/10/05]
- Running from GUI

v 3.2/4.0alpha1 [2019/10/03]
- GUI adding in test mode

v 3.1 [2019/09/15]
- новый режим: перемещение в отдельную папку объекта наиболее "продвинутые" (самой высокой степени обработки) файлы

v 3.0 [2019/09/14]
- разделение на Engine
- оптимизация производительности (не читает файлы в ненужных случаях)
- в последующих процессах проверять имена файлов для случая, если ABE был включен/отключен
- bug fix: была все таки проблема с названиями фильтров Ha, Oiii и т.д. 3 раз исправлено :)

v 2.1 [2019/09/06](ABE еще тестируется)
- обязательно использовать BINNING в именах калибровочных файлов
- в конфигурации задается формат сохраняемого фалйа (f32, i16, etc)
- ABE processing всех файлов (после дебайеризации)
- перечень каталогов исключения в виде массива
- bug fix название фильтров в мастерфлетах тоже приводится к единому по словарю

v 2.0 beta5 [2019/08/08](все еще тестируется)
- bug fix: название фильтра при чтении из библиотеки не переводилось в UPPERCASE, что для Ha, Oiii и т.д. не находило флеты
- при сканировании не заходит в подкаталоги, заданные в конфигурации как "output" (все типы, включая сам output)


v 2.0 beta4 [2019/05/07](все еще тестируется)
- bug fix: при калибровке и выравнивании проверять, существует ли файл на выходе (так как иногда выравнивание не проходит и соотв. файл не создается)
- bug fix: не проверял при нормализации, нет ли уже готового файла (всегда пересоздавал заново(

v 2.0 beta3 [2019/05/05](все еще тестируется)
- bug fixes

v 2.0 beta2 [2019/05/01] (почти работает!)
- Переделана логика работа с подкаталогами (5 режимов работы, прямо задаваемых или авто)
- Опция не обрабатывать повторно (если соотв. файл на выходе уже существующует)
- Вывод данных (новый принцип debug)
- Файл документации

v2.0 beta1 [2019/04/19]
- Добавлен второй режим работы - пересканирование имеющегося набора файла и запуск недостаяющих процессов
- Переструктурированы файлы
- Добавлен этап "отфильтровка лучших" (не работает - bug PI?)

v1.0  16/04/2019     Boris Emchenko
Пора давать релизный номер версии :)
+ исключения каталогов из поиска


v0.5  11/04/2019    Boris Emchenko:
Wording, оптимизация кода

v0.4  04/04/2019    Boris Emchenko:
Конфигурация скрипта вынесена в отдельный раздел
Автоматический подбор биасов и дарков по температуре, дарков по экспозиции, флетов по фильтру и дате
Выравнивание в случае наличия референса
Нормализация в случае наличия референса


v0.3  12/04/2017    Уход от получения данных о снимке в имени файла на данные
из заголовка фита

v0.2  10/19/2016    bugFix
Фильтры в upperCase, минуты в lowerCase
binX добавил в шаблон cosmetic_ivan_bin2_200

v0.1  10/18/2016    Продумал структуру входа, калибровки и выхода.
Сделал поиск файлов, игнорирование уже калиброванных.
Калибровка.
Косметика.
Создание структуры папок.
Выравнивание, если есть ref.fit
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


////////////////////////////////////////////////////////////////////////////////
var BaseCalibratedOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CalibratedOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CosmetizedOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var ABEOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var RegisteredOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var NormalizedOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var ApprovedOutputPath = ""; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции

var CosmeticsIconTemperature = 0; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CosmeticsIconExposure = 0; // инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции

var busy = false; // Осталась от Олега
var needRefresh = true; // Осталась от Олега

var cfgDefObjectName = "Obj"; // имя объекта, в случае если FITS не содержит имя объекта

var requestToCopy = []; //массив для хранения файлов, которые нужно будет скопировать как финальные (если такой режим установлен)

////////////////////////////////////////////////////////////////////////////////
var PATHMODE = {
    UNSET: -1,
    AUTO: 0,
    PUT_IN_ROOT_SUBFOLDER: 1,
    PUT_IN_OBJECT_SUBFOLDER: 2,
    ABSOLUTE: 3,
    RELATIVE: 4,
    RELATIVE_WITH_OBJECT_FOLDER: 5,
    PUT_FINALS_IN_OBJECT_SUBFOLDER: 6
}; // Типы расположения файлов, см. documentation.txt


var FITS = {
    UNKNOWN: -1,
    ORIGINAL: 0,
    CALIBRATED: 1,
    COSMETIZED: 2,
    ABED: 3,
    REGISTERED: 4,
    NORMALIZED: 5,
    APPROVED: 6
}; // Типы файлов
var FILEARRAY = []; // базовый массив хранения файлов, куда вносятся результаты сканирования
/*      FILEARRAY.push({
fits: signaturename,
fullname:   (type == FITS.ORIGINAL     ? fullname : null),
calibrated: (type == FITS.CALIBRATED   ? fullname : null),
cosmetized: (type == FITS.COSMETIZED   ? fullname : null),
registered: (type == FITS.REGISTERED   ? fullname : null),
normalized: (type == FITS.NORMALIZED   ? fullname : null),
approved:   (type == FITS.APPROVED     ? fullname : null),
});
 */

/**
 * Вернуть название поле для объекта FILEARRAY по типу
 *
 * @param type FITS тип файла
 * @return string
 */
function getFILEARRPropertyName(type) {
    var st = "";
    switch (type) {
    case FITS.ORIGINAL:
        st = "fullname";
        break;
    case FITS.CALIBRATED:
        st = "calibrated";
        break;
    case FITS.COSMETIZED:
        st = "cosmetized";
        break;
    case FITS.ABED:
        st = "abed";
        break;
    case FITS.REGISTERED:
        st = "registered";
        break;
    case FITS.NORMALIZED:
        st = "normalized";
        break;
    case FITS.APPROVED:
        st = "approved";
        break;
    }
    return st;
}

/**
 * Получение предыщего в цепочке
 *
 * @param property string
 * @return string
 */
function getFILEARRPrecedingName(property) {
    if (property == getFILEARRPropertyName(FITS.ORIGINAL))
        return getFILEARRPropertyName(FITS.ORIGINAL)
    else if (property == getFILEARRPropertyName(FITS.CALIBRATED))
        return getFILEARRPropertyName(FITS.ORIGINAL)
    else if (property == getFILEARRPropertyName(FITS.COSMETIZED))
        return getFILEARRPropertyName(FITS.CALIBRATED)
    else if (property == getFILEARRPropertyName(FITS.ABED))
        return getFILEARRPropertyName(FITS.COSMETIZED)
    else if (property == getFILEARRPropertyName(FITS.REGISTERED))
        return getFILEARRPropertyName(FITS.ABED)
    else if (property == getFILEARRPropertyName(FITS.NORMALIZED))
        return getFILEARRPropertyName(FITS.REGISTERED)
    else if (property == getFILEARRPropertyName(FITS.APPROVED))
        return getFILEARRPropertyName(FITS.NORMALIZED)
    else
        return getFILEARRPropertyName(FITS.ORIGINAL);

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

/**
 * Переименование фита и копирование в папку объекта
 *
 * @param fileName string Имя файла_c_cc.fit
 * @return object
 */
function renameCopyFit(fileName) {
    console.writeln('rename and copy fit: ' + fileName);

    var file = getFileHeaderData(fileName);
    if (!file)
        return false;

    file.dst = file.instrument.replace('/', '_') + '-' +
        file.date + '-' + file.time + '-' +
        file.object + '-' + file.filter + '-bin' + file.bin + '-' +
        file.duration + 's';
    console.writeln('.. to: ' + file.dst);

    if (Config.NeedCalibration) {
        // удаляю _с файл
        File.remove(fileName.replace(/_c_cc\.fit$/, '_c.fit'));
    }

    // создаю папки Config.OutputPath / object / filter / сс и / src
    if (!File.directoryExists(Config.OutputPath + '/' + file.object + '/' + file.filter + '/cc'))
        File.createDirectory(Config.OutputPath + '/' + file.object + '/' + file.filter + '/cc', true);
    if (!File.directoryExists(Config.OutputPath + '/' + file.object + '/' + file.filter + '/src'))
        File.createDirectory(Config.OutputPath + '/' + file.object + '/' + file.filter + '/src', true);

    // добавляю префикс файлу src и cc
    // переношу исходник в Config.OutputPath / filter / src
    // переношу _cc в Config.OutputPath / filter / cc

    console.writeln('move: ' + fileName + ' to: ' + Config.OutputPath + '/' + file.object + '/' + file.filter + '/cc/' + file.dst + '_c_cc.fit');
    File.move(
        fileName,
        Config.OutputPath + '/' + file.object + '/' + file.filter + '/cc/' + file.dst + '_c_cc.fit');

    if (Config.NeedCalibration) {
        console.writeln('move: ' + fileName.replace(/_c_cc\.fit$/, '.fit') + ' to: ' + Config.OutputPath + '/' + file.object + '/' + file.filter + '/src/' + file.dst + '.fit');
        File.move(
            fileName.replace(/_c_cc\.fit$/, '.fit'),
            Config.OutputPath + '/' + file.object + '/' + file.filter + '/src/' + file.dst + '.fit');
    }

    return file;
}

// from script / fitsKeywords.js
function copyFile(sourceFilePath, targetFilePath) {
    var f = new File;

    f.openForReading(sourceFilePath);
    var buffer = f.read(DataType_ByteArray, f.size);
    f.close();

    f.createForWriting(targetFilePath);
    f.write(buffer);
    //f.flush(); // optional; remove if immediate writing is not required
    f.close();
}

/*
 * Returns a readable textual representation of a file size in bytes with
 * automatic units conversion.
 */
function fileSizeAsString(bytes, precision) {
    const kb = 1024;
    const mb = 1024 * kb;
    const gb = 1024 * mb;
    const tb = 1024 * gb;
    if (bytes >= tb)
        return format("%.*g TiB", precision, bytes / tb);
    if (bytes >= gb)
        return format("%.*g GiB", precision, bytes / gb);
    if (bytes >= mb)
        return format("%.*g MiB", precision, bytes / mb);
    if (bytes >= kb)
        return format("%.*g KiB", precision, bytes / kb);
    return format("%lld B", bytes);
};

/**
 * Поиск расширения файла
 */
function fileExtension(file) {
    //console.writeln('ext file='+ file);
    var ext = file.match(/\.([^.]+)$/);

    return ext && ext.length ? ext[1] : false
}

/**
 * Проверка, содержит ли имя директории dirName любую из строк из массива SkipDirsContains
 */
function FileDirNameContains(dirName, SkipDirsContains) {
    var bF = false;
    SkipDirsContains.forEach(
        function (element) {
        //console.writeln(element);
        if (dirName.indexOf(element) > -1)
            bF = true;
    });
    return bF;
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


function writeTextFile(FullFileName, txtContent)
{
	let sFileName  = FullFileName;
	
	try {
		sFileName = makeFilenameUnique(sFileName, false);
		let txtFile = new File();
		txtFile.createForWriting( sFileName );
		txtFile.outTextLn(txtContent);
		txtFile.close();

	} catch (fileExeption){
		console.criticalln("** ERROR writing file file " + sFileName);
		console.criticalln(fileExeption);
	}

}

/**
 * If the file already exists, and overwrite is false, Appends '_N'
 * Otherwise, it returns the original filename
 * @param {String} filename
 * @param {Boolean} overwrite
 * @returns {String}
 */
function makeFilenameUnique(filename, overwrite){
    if (File.exists(filename) && !overwrite){
        for ( let u = 1; ; ++u ){
            let tryFilePath = File.appendToName(filename, '_' + u.toString());
            if (!File.exists(tryFilePath)){
                return tryFilePath;
            }
        }
    }
    return filename;
}


function progressBar (current, total)
{
   var max = 20;
   var done = Math.round(current/total * max);
   console.note("[" + "X".repeat(done));
   console.note(".".repeat( max - done ) + "]");
   console.note(" " + parseFloat(current/total*100).toFixed(1) + "%");
}