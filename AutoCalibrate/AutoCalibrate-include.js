//////////////////////////////////////////////////////
/* 
					Глобальные переменные
*/
//////////////////////////////////////////////////////
  
																	
// for FITS HEADER parsing
   var headers = {
      'XBINNING': null,
      'OBSERVER': null,
      'TELESCOP': null,
	  'INSTRUME': null,
      'DATE-OBS': null,
      'EXPTIME':  null,
      'CCD-TEMP': null,
      'XPIXSZ':   null,
      'FOCALLEN':   null,
      'FILTER':   null,
      'OBJECT':   null,
      'OBJCTRA':  null,
      'OBJCTDEC': null
      };
	 
// DEBUG	 
var dbgNormal = 1; 	//  минимальное количество сообщений
var dbgNotice = 2;	// максимальное количество сообщений 


////////////////////////////////////////////////////////////////////////////////
var BaseCalibratedOutputPath = ""; 	// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CalibratedOutputPath = ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CosmetizedOutputPath = ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var RegisteredOutputPath= ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var NormalizedOutputPath= ""; 		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var ApprovedOutputPath="";			// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции

var CosmeticsIconTemperature = 0; 	// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции
var CosmeticsIconExposure  = 0;		// инициализация как глобальной переменной. Дальше ей будет присваиваться значение внутри функции

var busy = false;					// Осталась от Олега
var needRefresh = true;				// Осталась от Олега


////////////////////////////////////////////////////////////////////////////////
var FITS = { UNKNOWN : -1, ORIGINAL : 0, CALIBRATED : 1, COSMETIZED : 2, REGISTERED : 3, NORMALIZED : 4, APPROVED: 5 };
var FILEARRAY = [];
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
function getFILEARRPropertyName(type)
{
   var st="";
   switch (type)
   {
      case FITS.ORIGINAL:
         st="fullname";
         break;
      case FITS.CALIBRATED:
         st="calibrated";
         break;
      case FITS.COSMETIZED:
         st="cosmetized";
         break;
      case FITS.REGISTERED:
         st="registered";
         break;
      case FITS.NORMALIZED:
         st="normalized";
         break;
      case FITS.APPROVED:
         st="approved";
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
function getFILEARRPrecedingName(property)
{
   if (property == getFILEARRPropertyName (FITS.ORIGINAL))
      return getFILEARRPropertyName (FITS.ORIGINAL)
   else if (property == getFILEARRPropertyName (FITS.CALIBRATED))
      return getFILEARRPropertyName (FITS.ORIGINAL)
   else if (property == getFILEARRPropertyName (FITS.COSMETIZED))
      return getFILEARRPropertyName (FITS.CALIBRATED)
   else if (property == getFILEARRPropertyName (FITS.REGISTERED))
      return getFILEARRPropertyName (FITS.COSMETIZED)
   else if (property == getFILEARRPropertyName (FITS.NORMALIZED))
      return getFILEARRPropertyName (FITS.REGISTERED)
   else if (property == getFILEARRPropertyName (FITS.APPROVED))
      return getFILEARRPropertyName (FITS.NORMALIZED)
   else 
      return getFILEARRPropertyName (FITS.ORIGINAL);
     
}

/*
////////////////////////////////////////////////////////////////////////////////
//			Осталось от Олега. Сейчас не используется
////////////////////////////////////////////////////////////////////////////////
*/
/*
 *
 *
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

*/
/**
 * Переименование фита и копирование в папку объекта
 *
 * @param fileName string Имя файла_c_cc.fit
 * @return object
 */
function renameCopyFit(fileName)
{
   console.writeln('rename and copy fit: '+ fileName);

   var file = getFileHeaderData(fileName);
   if (!file)
      return false;

   file.dst = file.instrument.replace('/', '_') +'-'+
      file.date +'-'+ file.time +'-'+
      file.object +'-'+ file.filter +'-bin'+ file.bin +'-'+
      file.duration +'s';
   console.writeln('.. to: '+ file.dst);

   if (cfgNeedCalibration) {
      // удаляю _с файл
      File.remove(fileName.replace(/_c_cc\.fit$/, '_c.fit'));
   }

   // создаю папки cfgOutputPath / object / filter / сс и / src
   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/cc'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/cc', true);
   if (!File.directoryExists(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/src'))
      File.createDirectory(cfgOutputPath +'/'+ file.object +'/'+ file.filter + '/src', true);

   // добавляю префикс файлу src и cc
   // переношу исходник в cfgOutputPath / filter / src
   // переношу _cc в cfgOutputPath / filter / cc

   console.writeln('move: '+ fileName +' to: '+cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit');
   File.move(
      fileName,
      cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/cc/'+ file.dst +'_c_cc.fit'
   );

   if (cfgNeedCalibration) {
      console.writeln('move: '+ fileName.replace(/_c_cc\.fit$/, '.fit') +' to: '+cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/src/'+ file.dst +'.fit');
      File.move(
         fileName.replace(/_c_cc\.fit$/, '.fit'),
         cfgOutputPath +'/'+ file.object +'/'+ file.filter +'/src/'+ file.dst +'.fit'
      );
   }

   return file;
}


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

