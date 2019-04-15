/*

@todo переделать в окошки красивые, сохраняя настройки меж сессиями так:
https://pixinsight.com/forum/index.php?topic=298.0


@TODO описание
суть скрипта в том, что у тебя есть лайты в пяти фильтрах. Причём дарки разной длины и ещё у тебя бины разные. Всё это надо откалибровать, откосметить и (этого нет в batch*), нужно выравнять по опорному каждый объект, разложив в C:\ASTRO\{объект}\{фильтр}
бонус ещё лично для меня, что астрографов может быть N
и всё это делается так:
- файлы залил в папку c:\ASTRO\auto (задаётся в скрипте всё, само собой)
- запустил скрипт.
до этого чуть подготовки:
- калибровку разложить в C:\ASTRO\Calibrate по правилам;
- создать процессы косметики, как для Batch*. Собственно, оттуда я и спёр эту фичу.
если объект ещё не ровняли, то первый фит будет опорным. Но это можно перебить, если самому создать папку C:\ASTRO\NGC1010 и туда кинуть ref.fit
если с цветной камеры, то скрипт сам дебаерит, раскладывает на каналы и ровняет каналы отдельно
схема дебаера любая. Задаётся "именем фильтра". Имя фильтра в бесколёсные камеры прописываю мелким питон-скриптом (питон под винду).
////@TODO



Есть у меня скрипт под пикс для автокалибровки / косметики / выравнивания / раскладывания по папкам куч фитов с разных астрографов / камер.

Сегодня переделал его, теперь имя файла не важно, читает все данные с заголовка фита.

Берём только что отснятый фит или их пачку, кладём его в папку IN, запускаем скрипт и в папке OUT получаем структуру:
- объект
-- фильтр
--- cc: калиброванные с косметикой
--- src: исходники

В корень папки-объекта первый обработанный фит попадает как файл ref.fit, является опорным для выравнивания (можно опорный файл самому залить, по нему будут ровняться все последующие).
Выравненные фиты по фильтрам раскладываются в объект/фильтр/фит_c_cc_r.fit

Файлы переименовываются по шаблону:
{имя_владельца}-{имя астрографа}-{дата}-{время}-{объект}-{фильтр}-{бин}-{выдержка}.fit
к примеру: Vitar_MakF10-2017_04-11-19_28-IC2574-L-bin1-600s_c_cc_r

Для корректной работы во время съёмки (в максиме, например), нужно задать заголовки:

OBSERVER
TELESCOP
Если заголовки не заданы, написал мелкую прогу на питоне под windows, правит заголовки:

Recursive change fits header OBSERVER and TELESCOP

Usage:
observer.telescope.py -o <observer> -t <telescope>

Ещё для работы нужны мастердарки / биасы / фиты в папке CALIBRATE. Структура аналогичная: {имя астрографа}/{имя телескопа}/bias.fit
Или dark-900.fit (дарк, 900 секунд).
flat-L.fit (флет в L-фильтре).

На столе пикса должны быть иконки процессов калибровки с именами по шаблону:
cosmetic_{имя-владельца}_{имя-астрографа}_bin{бин}_{выдержка}.
Например, cosmetic_Vitar_MakF10_bin1_1800.

Сам рабочий стол пикса сохраняется правой кнопкой и автозагружается добавлением в файл C:\Program Files\PixInsight\etc\startup\startup.scp строчки:

.open C:/ASTRO/mo.xpsm

Пока что не делал поиск оптимального дарка по выдержке из присутствующих рядом и библиотеку дарков разной температуры. Ещё дату флета тоже можно автоматизировать. То есть с такой-то даты актуальным становится флет в папке {дата}, например.

Комментарии в начале файла от старой версии. Потом исправлю.

Сам скрипт тут: http://download.milantiev.com/astro/pixiInsight.scripts/







@todo старый текст
Скрипт автокалибровки фитов, поступающих с нескольких астрографов

Мониторит указанную папку (и вложенные) на предмет новых ещё не откалиброванных фитов
Найденный фит калибрует согласно схеме найденного пути и шаблона имени файла.
Потом косметика.
Потом раскладка по объектам.
Потом попытка выравнивания, если в объекте есть ref.fit
Файл дополняется названием астрографа и датой съёмки, например: ivan-2016-10-18-IC1796-001-ha-bin1-15m.fit

Схема входных папок:
C:\ASTRO\_z - базовый путь до входного дерева
C:\ASTRO\_z\ivan - папка названия астрографа. Для неё есть пакет калибровки в C:\ASTRO\Calibrate\ivan
C:\ASTRO\_z\ivan\2016-10-18 - папка даты. Её максим создаёт. Удобно для ручного разбора

Схема входных файлов в папке даты на примере IC1796-001-ha-bin1-15m.fit:
IC1796 - имя объекта. Не содержит -\d{3,4}-
001 - номер фита, как пишет Autosave максима. Содержит -\d{3,4}-
ha - название фильтра
bin1 - bin 1 или 2, а то и 4
15m - длительность (текст). Например, 5m, 15m, 200, 800

Схема папок калибровки
C:\ASTRO\Calibrate - базовый путь до дерева калибровки
C:\ASTRO\Calibrate\ivan - папка названия астрографа

Схема файлов калибровки
bias.fit - BIAS
dark-5m.fit - DARK длительностью 5m
flat.fit - универсальный Flat, если нет колеса или всё калибруется одним (для упрощения)
flat-HA.fit - Flat для фильтра HA (все фильтры в upperCase)

Схема исходящих папок
C:\ASTRO - базовый путь до исходящего дерева
C:\ASTRO\IC1796 - путь до фитов объекта
C:\ASTRO\IC1796\HA - папка файлов фильтра HA
C:\ASTRO\IC1796\HA\src - исходные фиты
C:\ASTRO\IC1796\HA\cc - откалиброванные и откосметированные фиты
C:\ASTRO\IC1796\HA\r - выравненные фиты, если есть файл C:\ASTRO\IC1796\ref.fit


Калибровка на основе папки калибровки
Косметика на основе иконок по маске cosmetic_newton_5m


@todo
- учёт температуры и подбор лучшей калибровки
- группировка кучи по фильтру, запуск единой калибровки и косметики по группе
- подбор более подходящего флета
- разбор по fit-заголовкам, а не имени файла, но переименование файлов по шаблону

@based
- https://pixinsight.com/forum/index.php?topic=7775.0
- batchPreprocessing

   Copyright (C) 2016  Oleg Milantiev (oleg@milantiev.com http://oleg.milantiev.com)
*/

/*
                     Version History

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

#feature-id    Batch Processing > BatchCalibration

#feature-info  An automated calibration, cosmetic and registration<br/>\
   <br/> \
   @todo \
   <br/> \
   Copyright &copy; 2016 Oleg Milantiev


#define VERSION "0.1"

#define DEFAULT_EXTENSION     ".fit"

#include <pjsr/DataType.jsh>
#include <pjsr/UndoFlag.jsh>


var inputPath = 'C:/ASTRO/_z.auto'; // без финального "/" (@todo убрать. если есть)
var outputPath = 'C:/ASTRO'; // без финального "/" (@todo убрать. если есть)
var calibratePath = 'C:/ASTRO/Calibrate'; // без финального "/" (@todo убрать. если есть)


var needCalibrate = true;
//var needCalibrate = false;

//var needRegister  = true;
var needRegister  = false;


var busy = false;
var needRefresh = true;


console.writeln('start');

// allow stop
console.abortEnabled = true;


/*
var fileWatcher = new FileWatcher( [inputPath] );
fileWatcher.onDirectoryChanged = function( )
{
   console.writeln('changed');
   needRefresh = true;
};


var updateTimer = new Timer;
updateTimer.interval = 0.5;  // timing interval in seconds
updateTimer.periodic = true; // periodic or single shot timer
updateTimer.onTimeout = function()
{
   if ( needRefresh ) {
      refreshDirectory();
   }
};
updateTimer.start();
*/

refreshDirectory(inputPath);

//sleep(10);


function refreshDirectory(path)
{
   console.writeln('refresh='+ path);

   if ( !busy )
   {

      busy = true;
      needRefresh = false;


      var find = new FileFind;

      if ( find.begin( path + "/*" ) )
         do
         {

            if ( find.name != "." && find.name != "..")
            {
               if ( find.isDirectory ) {
                  console.writeln('found dir: '+ path +'/'+ find.name);

                  busy = false; // на будущее для асихнронного блока
                  refreshDirectory( path +'/'+ find.name );
                  busy = true;

               } else {
                  console.writeln('found file: '+ path +'/'+ find.name);
                  if (fileExtension(find.name).toLowerCase() == 'fit' && isNeedCalibrate(path +'/'+ find.name)) {
                     console.writeln('start process file: '+ path +'/'+ find.name);

                     registerFits(
                        debayerSplitFit(
                           renameCopyFit(
                              cosmeticFit(
                                 calibrateFit(path +'/'+ find.name)
                              )
                           )
                        )
                     )
                  }
               }
            }
         }
         while ( find.next() );


      busy = false;
   }
};


/**
 * Поиск расширения файла
 */
function fileExtension(file)
{
   //console.writeln('ext file='+ file);
   var ext = file.match(/\.([^.]+)$/);

   return ext && ext.length ? ext[1] : false
}


/**
 * Регистрация (выравнивание) фитов (1-3 в зависимости от был ли чб или цвет)
 *
 * @param
 * @return
 * @todo пачку фитов в одном процессе регистрировать
 */
function registerFits(files)
{
   if (!needRegister) {
      return true;
   }

   console.writeln('register fit(s)');
//return true;
   var start = 0;

   if (!File.exists(outputPath +'/'+ files[0].object +'/ref.fit')) {
      copyFile(
         outputPath +'/'+ files[0].object +'/'+ files[0].filter +'/cc/'+ files[0].dst +'_c_cc.fit',
         outputPath +'/'+ files[0].object +'/ref.fit'
      );

      copyFile(
         outputPath +'/'+ files[0].object +'/'+ files[0].filter +'/cc/'+ files[0].dst +'_c_cc.fit',
         outputPath +'/'+ files[0].object +'/'+ files[0].filter +'/'+ files[0].dst +'_c_cc_r.fit'
      );

      start = 1;
   }

   if (start == files.length) {
      return true;
   }

   for (var i = start; i < files.length; i++) {

      var P = new StarAlignment;

      P.structureLayers = 5;
      P.noiseLayers = 0;
      P.hotPixelFilterRadius = 1;
      P.noiseReductionFilterRadius = 0;
      P.sensitivity = 0.100;
      P.peakResponse = 0.80;
      P.maxStarDistortion = 0.500;
      P.upperLimit = 1.000;
      P.invert = false;
      P.distortionModel = "";
      P.undistortedReference = false;
      P.distortionCorrection = true;
      P.distortionMaxIterations = 100;
      P.distortionTolerance = 0.001;
      P.matcherTolerance = 0.0500;
      P.ransacTolerance = 2.00;
      P.ransacMaxIterations = 2000;
      P.ransacMaximizeInliers = 1.00;
      P.ransacMaximizeOverlapping = 1.00;
      P.ransacMaximizeRegularity = 1.00;
      P.ransacMinimizeError = 1.00;
      P.maxStars = 0;
      P.useTriangles = false;
      P.polygonSides = 5;
      P.descriptorsPerStar = 20;
      P.restrictToPreviews = true;
      P.intersection = StarAlignment.prototype.MosaicOnly;
      P.useBrightnessRelations = false;
      P.useScaleDifferences = false;
      P.scaleTolerance = 0.100;
      P.referenceImage = outputPath +'/'+ files[i].object +'/ref.fit';
      P.referenceIsFile = true;
      P.targets = [ // enabled, isFile, image
         [true, true, outputPath +'/'+ files[i].object +'/'+ files[i].filter +'/cc/'+ files[i].dst +'_c_cc.fit']
      ];
      P.inputHints = "";
      P.outputHints = "";
      P.mode = StarAlignment.prototype.RegisterMatch;
      P.writeKeywords = true;
      P.generateMasks = false;
      P.generateDrizzleData = false;
      P.frameAdaptation = false;
      P.noGUIMessages = true;
      P.useSurfaceSplines = false;
      P.splineSmoothness = 0.00;
      P.pixelInterpolation = StarAlignment.prototype.Auto;
      P.clampingThreshold = 0.30;
      P.outputDirectory = outputPath +'/'+ files[i].object +'/'+ files[i].filter;
      P.outputExtension = ".fit";
      P.outputPrefix = "";
      P.outputPostfix = "_r";
      P.maskPostfix = "_m";
      P.outputSampleFormat = StarAlignment.prototype.i16;
      P.overwriteExistingFiles = false;
      P.onError = StarAlignment.prototype.Continue;
      /*
       * Read-only properties
       *
      P.outputData = [ // outputImage, outputMask, pairMatches, inliers, overlapping, regularity, quality, rmsError, rmsErrorDev, peakErrorX, peakErrorY, H11, H12, H13, H21, H22, H23, H31, H32, H33, frameAdaptationBiasRK, frameAdaptationBiasG, frameAdaptationBiasB, frameAdaptationSlopeRK, frameAdaptationSlopeG, frameAdaptationSlopeB, frameAdaptationAvgDevRK, frameAdaptationAvgDevG, frameAdaptationAvgDevB, referenceStarX, referenceStarY, targetStarX, targetStarY
      ];
       */

      var status = P.executeGlobal();
   }
}


/**
 * Переименование фита и копирование в папку объекта
 *
 * @param fileName string Имя файла_c_cc.fit
 * @return object
 */
function renameCopyFit(fileName)
{
   console.writeln('rename and copy fit: '+ fileName);

   var file = parseFile(fileName);
   if (!file)
      return false;

   file.dst = file.instrument.replace('/', '_') +'-'+
      file.date +'-'+ file.time +'-'+
      file.object +'-'+ file.filter +'-bin'+ file.bin +'-'+
      file.duration +'s';
   console.writeln('.. to: '+ file.dst);

   if (needCalibrate) {
      // удаляю _с файл
      File.remove(fileName.replace(/_c_cc\.fit$/, '_c.fit'));
   }

   // создаю папки outputPath / object / filter / сс и / src
   if (!File.directoryExists(outputPath +'/'+ file.object +'/'+ file.filter + '/cc'))
      File.createDirectory(outputPath +'/'+ file.object +'/'+ file.filter + '/cc', true);
   if (!File.directoryExists(outputPath +'/'+ file.object +'/'+ file.filter + '/src'))
      File.createDirectory(outputPath +'/'+ file.object +'/'+ file.filter + '/src', true);

   // добавляю префикс файлу src и cc
   // переношу исходник в outputPath / filter / src
   // переношу _cc в outputPath / filter / cc

   console.writeln('move: '+ fileName +' to: '+outputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit');
   File.move(
      fileName,
      outputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit'
   );

   if (needCalibrate) {
      console.writeln('move: '+ fileName.replace(/_c_cc\.fit$/, '.fit') +' to: '+outputPath +'/'+ file.object +'/'+ file.filter +'/src/'+ file.dst +'.fit');
      File.move(
         fileName.replace(/_c_cc\.fit$/, '.fit'),
         outputPath +'/'+ file.object +'/'+ file.filter +'/src/'+ file.dst +'.fit'
      );
   }

   return file;
}


function debayerSplitFit(file)
{
   //return file; // @todo

   if (!file.cfa) {
      return [file];
   }

   console.writeln('start to debayer fit: '+ file.dst);

   var P = new Debayer;

   switch (file.filter) {
      case 'RGGB':
         P.bayerPattern = Debayer.prototype.RGGB;
         break;

      case 'BGGR':
         P.bayerPattern = Debayer.prototype.BGGR;
         break;

      case 'GBRG':
         P.bayerPattern = Debayer.prototype.GBRG;
         break;

      case 'GRBG':
         P.bayerPattern = Debayer.prototype.GRBG;
         break;

      default:
         return false;
   }

   P.debayerMethod = Debayer.prototype.VNG;
   P.evaluateNoise = false;
   P.noiseEvaluationAlgorithm = Debayer.prototype.NoiseEvaluation_MRS;
   P.showImages = true;

   var inputImageWindow = ImageWindow.open(
      outputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit'
   );
   var sourceView = inputImageWindow[0].mainView;

   var status = P.executeOn( sourceView );

   inputImageWindow[0].close();

   var resultView = View.viewById( P.outputImage );

   // / debayer



   // splitRGB

   if (!File.directoryExists(outputPath +'/'+ file.object +'/R/cc'))
      File.createDirectory(outputPath +'/'+ file.object +'/R/cc', true);
   if (!File.directoryExists(outputPath +'/'+ file.object +'/G/cc'))
      File.createDirectory(outputPath +'/'+ file.object +'/G/cc', true);
   if (!File.directoryExists(outputPath +'/'+ file.object +'/B/cc'))
      File.createDirectory(outputPath +'/'+ file.object +'/B/cc', true);

   var imgW = resultView.image.width;
   var imgH = resultView.image.height;

   var red   = new ImageWindow(imgW, imgH, 1, 16, false, false, "");
   var green = new ImageWindow(imgW, imgH, 1, 16, false, false, "");
   var blue  = new ImageWindow(imgW, imgH, 1, 16, false, false, "");

   resultView.image.selectedChannel = 0;
   red.mainView.beginProcess(UndoFlag_NoSwapFile);
   red.mainView.image.assign(resultView.image);
   red.mainView.endProcess();
   red.saveAs(
      outputPath +'/'+ file.object +'/R/cc/debayer_'+ file.dst +'_R_c_cc.fit'
      , false, false, false, false);

   resultView.image.selectedChannel = 1;
   green.mainView.beginProcess(UndoFlag_NoSwapFile);
   green.mainView.image.assign(resultView.image);
   green.mainView.endProcess();
   green.saveAs(
      outputPath +'/'+ file.object +'/G/cc/debayer_'+ file.dst +'_G_c_cc.fit'
      , false, false, false, false);

   resultView.image.selectedChannel = 2;
   blue.mainView.beginProcess(UndoFlag_NoSwapFile);
   blue.mainView.image.assign(resultView.image);
   blue.mainView.endProcess();
   blue.saveAs(
      outputPath +'/'+ file.object +'/B/cc/debayer_'+ file.dst +'_B_c_cc.fit'
      , false, false, false, false);

//   resultView.window.saveAs(
//      outputPath +'/'+ file.object +'/'+ file.filter +'/cc/deb_'+ file.dst +'_c_cc.fit'
//      , false, false, false, false );

   resultView.window.forceClose();

   return [
      {
         object: file.object,
         filter: 'R',
         dst: 'debayer_'+ file.dst +'_R',
      },
      {
         object: file.object,
         filter: 'G',
         dst: 'debayer_'+ file.dst +'_G',
      },
      {
         object: file.object,
         filter: 'B',
         dst: 'debayer_'+ file.dst +'_B',
      }
   ];
}


/**
 * Косметика фита
 *
 * @param fileName string Имя файла_c.fit
 * @return string имя файла_c_cc.fit
 */
function cosmeticFit(fileName)
{
   console.writeln('cosmetic fit: '+ fileName);

   //C:/ASTRO/_z/newton/2016-10-13/53P-Van-Biesbroeck-001-L-bin1-1m_c.fit
   var file = parseFile(fileName);
   if (!file)
      return false;

   if (!needCalibrate) {
      return fileName;
   }

   var CC = ProcessInstance.fromIcon( 'cosmetic_'+ file.instrument.replace('/', '_') +'_bin'+ file.bin +'_'+ file.duration );
   if ( CC == null )
      throw new Error( "No such process icon: " + 'cosmetic_'+ file.instrument.replace('/', '_') +'_bin'+ file.bin +'_'+ file.duration );
   if ( !(CC instanceof CosmeticCorrection) )
      throw new Error( "The specified icon does not transport an instance " +
                        "of CosmeticCorrection: " + 'cosmetic_'+ file.instrument.replace('/', '_') +'_bin'+ file.bin +'_'+ file.duration );

   CC.targetFrames = [ // enabled, path
      [true, fileName]
   ];
   CC.outputDir       = "";
   CC.outputExtension = ".fit";
   CC.prefix          = "";
   CC.postfix         = "_cc";
   CC.overwrite       = true;
   //CC.cfa             = false;

   CC.executeGlobal();

   return fileName.replace(/_c\.fit$/, '_c_cc.fit');
}



/**
 * Получение данных из заголовка фита
 *
 * @param file string
 * @return object
 */
function parseFile(fileName)
{
   var headers = {
      'XBINNING': null,
      'OBSERVER': null,
      'TELESCOP': null,
      'DATE-OBS': null,
      'EXPTIME':  null,
      'CCD-TEMP': null,
      'FILTER':   null,
      'OBJECT':   null,
      'OBJCTRA':  null,
      'OBJCTDEC': null
      };

   //C:/ASTRO/_z/newton/2016-10-13/53P-Van-Biesbroeck-001-L-bin1-1m.fit
   console.writeln("debug: "+ fileName)

   var image = ImageWindow.open(fileName)[0];
   var keywords = image.keywords;
   for (var k in keywords) {
      keywords[k].trim();

      if (typeof headers[ keywords[k].name ] != 'undefined') {
         headers[ keywords[k].name ] = keywords[k].strippedValue;
         console.writeln('header '+ keywords[k].name +'='+ keywords[k].strippedValue);
      }
   }

   if (!headers.OBSERVER || !headers.TELESCOP) {
      console.writeln('cant find Observer or Telescope');
      return false;
   }

   if (!headers['DATE-OBS'] || !headers.EXPTIME) {
      console.writeln('cant find Date or Exposure time');
      return false;
   }

   if (!headers.FILTER || !headers.OBJECT || !headers.XBINNING) {
      console.writeln('cant find Filter, Object or Binning');
      return false;
   }

   var filters = {
      'LUMINANCE': 'L',
      'LIGHT': 'L',
      'LUM': 'L',
      'H-ALPHA': 'HA',
      'O-III': 'O3',
      'S-II': 'S2',
      'SII': 'S2',
      'BLUE': 'B',
      'GREEN': 'G',
      'RED': 'R'
      };


   headers.FILTER = String.toUpperCase(headers.FILTER);
   console.writeln('FIL='+ headers.FILTER +'=');

   if (typeof filters[ headers.FILTER ] != 'undefined') {
      headers.FILTER = filters[ headers.FILTER ];
   }

   image.close();


   var filter = String.toUpperCase(headers.FILTER);

   // @todo date midnight / midday
   // @todo utc
   return {
      instrument: headers.OBSERVER +'/'+ headers.TELESCOP,              // Vitar/MakF10
      date:       headers['DATE-OBS'].substr(0, "2017-01-01".length ),  // 2016-10-13
      time:       headers['DATE-OBS'].substr("2017-01-01T".length, "00:00".length).replace(':', '_'),  // 23_15
      name:       fileName.split('/').reverse()[0],                     // pix-001.fit
      object:     headers.OBJECT,                                       // M106
      filter:     filter,                                               // L
      cfa:        !! (
         (filter == 'RGGB') ||
         (filter == 'BGGR') ||
         (filter == 'GBRG') ||
         (filter == 'GRBG')
      ),
      bin:        parseInt(headers.XBINNING),                           // 1
      duration:   parseInt(headers.EXPTIME)                             // 1800
   };
}


/**
 * Калибровка фита
 *
 * @param fileName string имя файла.fit
 * @return string имя файла_c.fit
 */
function calibrateFit(fileName)
{
   console.writeln('calibrate fit: '+ fileName);

   //C:/ASTRO/_z/newton/2016-10-13/53P-Van-Biesbroeck-001-L-bin1-1m.fit
   var file = parseFile(fileName);
   if (!file)
      return false;

   /*
   console.writeln(file.instrument);
   console.writeln(file.date);
   console.writeln(file.object);
   console.writeln(file.number);
   console.writeln(file.filter);
   console.writeln(file.bin);
   console.writeln(file.duration);
   return false;
   */

   if (!needCalibrate) {
      return fileName;
   }

   var P = new ImageCalibration;
   P.targetFrames = [ // enabled, path
      [true, fileName]
   ];
   P.inputHints = "";
   P.outputHints = "";
   P.pedestal = 0;
   P.pedestalMode = ImageCalibration.prototype.Keyword;
   P.pedestalKeyword = "";
   P.overscanEnabled = false;
   P.overscanImageX0 = 0;
   P.overscanImageY0 = 0;
   P.overscanImageX1 = 0;
   P.overscanImageY1 = 0;
   P.overscanRegions = [ // enabled, sourceX0, sourceY0, sourceX1, sourceY1, targetX0, targetY0, targetX1, targetY1
      [false, 0, 0, 0, 0, 0, 0, 0, 0],
      [false, 0, 0, 0, 0, 0, 0, 0, 0],
      [false, 0, 0, 0, 0, 0, 0, 0, 0],
      [false, 0, 0, 0, 0, 0, 0, 0, 0]
   ];

   // @todo check if exists
   P.masterBiasEnabled = true;
   P.masterBiasPath = calibratePath +'/'+ file.instrument +'/bin'+ file.bin +'/bias.fit';

   // @todo поиск ближайшего дарка, if exists
   // DRY cosmetic
   P.masterDarkEnabled = true;
   P.masterDarkPath = calibratePath +'/'+ file.instrument +'/bin'+ file.bin +'/dark-'+ file.duration +'.fit';

   // @todo общий фит, если нет фильтра. if exists
   P.masterFlatEnabled = true;
   P.masterFlatPath = calibratePath +'/'+ file.instrument +'/bin'+ file.bin +'/flat-'+ file.filter +'.fit';
   P.calibrateBias = false;


   P.calibrateDark = true;
   P.calibrateFlat = false;
   P.optimizeDarks = true;
   P.darkOptimizationThreshold = 0.00000;
   P.darkOptimizationLow = 3.0000;
   P.darkOptimizationWindow = 1024;

   P.darkCFADetectionMode = (file.cfa)
      ? ImageCalibration.prototype.ForceCFA
      : ImageCalibration.prototype.IgnoreCFA;

   P.evaluateNoise = false;
   P.noiseEvaluationAlgorithm = ImageCalibration.prototype.NoiseEvaluation_MRS;
   P.outputDirectory = "";
   P.outputExtension = ".fit";
   P.outputPrefix = "";
   P.outputPostfix = "_c";
   P.outputSampleFormat = ImageCalibration.prototype.i16;
   P.outputPedestal = 500;
   P.overwriteExistingFiles = false;
   P.onError = ImageCalibration.prototype.Continue;
   P.noGUIMessages = true;

   var status = P.executeGlobal();

   return fileName.replace(/\.fit$/i, '_c.fit');
}


/**
 * Этот фит нужно калибровать? Нет ли уже готового такого?
 *
 * @param file string Имя пути/файла
 * @return bool
 */
function isNeedCalibrate(file)
{
/*
   console.writeln(File.extractDrive(file));
   console.writeln(File.extractDirectory(file));
   console.writeln(File.extractName(file));
   console.writeln(File.extractSuffix(file));
   console.writeln(File.extractExtension(file));

*/
   //console.writeln(File.extractSuffix(file));return false;

   if (file.match(/_c.fit$/) || file.match(/_c_cc.fit$/) || file.match(/_cc_r.fit$/)) {
      if (!needCalibrate) {
         return true;
      }

      return false;
   }

   console.writeln('isNeedCalibrate check is file '+ File.extractDrive(file) + File.extractDirectory(file) +'/'+ File.extractName(file) +'_c.fit' + ' exists' );

   return !File.exists(
      File.extractDrive(file) + File.extractDirectory(file) +'/'+ File.extractName(file) +'_c.fit'
   );
}




/*
 * Returns a readable textual representation of a file size in bytes with
 * automatic units conversion.
 */
function fileSizeAsString( bytes, precision )
{
   const kb = 1024;
   const mb = 1024 * kb;
   const gb = 1024 * mb;
   const tb = 1024 * gb;
   if ( bytes >= tb )
      return format( "%.*g TiB", precision, bytes/tb );
   if ( bytes >= gb )
      return format( "%.*g GiB", precision, bytes/gb );
   if ( bytes >= mb )
      return format( "%.*g MiB", precision, bytes/mb );
   if ( bytes >= kb )
      return format( "%.*g KiB", precision, bytes/kb );
   return format( "%lld B", bytes );
};


// from script / fitsKeywords.js
function copyFile( sourceFilePath, targetFilePath )
{
   var f = new File;

   f.openForReading( sourceFilePath );
   var buffer = f.read( DataType_ByteArray, f.size );
   f.close();

   f.createForWriting( targetFilePath );
   f.write( buffer );
   //f.flush(); // optional; remove if immediate writing is not required
   f.close();
}

