#ifndef AutoCalibrate_Global_js
#define AutoCalibrate_Global_js
#endif

#feature-id Batch Processing > AutoCalibration

#feature-info  An automated calibration, cosmetic and registration<br/>\
   <br/> \
   @todo \
   <br/> \
   Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko

#feature-icon  AutoCalibration.xpm

#define TITLE "AutoCalibration"
#define VERSION "4.0alpha2"
#define COMPILE_DATE "2019/10/05"

#define INFO_STRING "A script to perform all calibration routines in fully automatic manner."
#define COPYRIGHT_STRING "Copyright &copy; 2016-2019 Oleg Milantiev, Boris Emchenko<br/>"

/*
   Copyright (C) 2016  Oleg Milantiev (oleg@milantiev.com http://oleg.milantiev.com)
   Developed 2019 by Boris Emchenko
*/

/*
Version History

TODO:
    - добавить ABE в мониторинг второго прохода (надо ли это второй проход?!)
   - графическая оболочка и сохранение параметров в PI

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

#define SETTINGS_KEY_BASE  "AutoCalibrate/"
