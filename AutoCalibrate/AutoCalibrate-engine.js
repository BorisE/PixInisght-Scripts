/*
Copyright (C) 2016  Oleg Milantiev (oleg@milantiev.com http://oleg.milantiev.com)
Developed 2019 by Boris Emchenko
 */
 #ifndef AutoCalibate_Engine_js
    #define AutoCalibate_Engine_js
	console.writeln("AutoCalibate_Engine_js");
 #endif


// Includes
 #ifndef AutoCalibrate_Global_js
    #include "AutoCalibrate-global.js" // Ver, Title and other info
 #endif

 #ifndef AutoCalibrate_settings_js
    #include "AutoCalibrate-settings.js" // Settings
    var Config = new ConfigData(); //variable for global access to script data
    //Need to be in front of other declarations
    console.noteln('Creating again Config');
    #include "AutoCalibrate-config-default.js" // Config part.
 #endif


 #ifndef AutoCalibrate_camera_headers_js
	#include "AutoCalibrate-CameraHeaders.js"
 #endif
 
#include "AutoCalibrate-MastersSearch.js"

 #include <pjsr/DataType.jsh>
 #include <pjsr/UndoFlag.jsh>

// ======== # processing class ===============================================
/// @class AutoCalibrateEngine perform AutoCalibration processing
///
function AutoCalibrateEngine() {

    this.T = new ElapsedTime;

    this.DirCount = 0;
    this.FileTotalCount = 0;

    this.DirsToProcessNum=0;
    this.FilesToProcessNum=0;

    this.ProcessesCompleted = 0;
    this.FilesProcessed = 0;
    this.CalibratedCount = 0;
    this.CosmetizedCount = 0;
    this.RegisteredCount = 0;
    this.NormalizedCount = 0;
    this.ApprovedCount = 0;
    this.ABECount = 0;

	this.approveFileList = [];

    this.BaseCalibratedOutputPath = ""; //base path
    this.NeedToCopyToFinalDirFlag = false;

    this.CameraHeaders = new ProcessCameraHeaders();
	
	this.progressDialog = null;
	this.abortRequested = false;
    
	// =========================================================
    // 	Начало исполнения
    // =========================================================
    this.Process = function (progressDialog) {
        //var T = new ElapsedTime;
		
		this.progressDialog = progressDialog;

        console.abortEnabled = true; // allow stop
        console.show();

        //Dispay current config
        console.noteln("<end><cbr><br>",
            "************************************************************");
        console.noteln("* Configuration ");
        console.noteln("************************************************************");
        console.noteln('  Search path: ' + Config.InputPath);
        console.noteln('  Path Mode:   ' + Config.PathMode);

        //if (!cfgUseRelativeOutputPath) console.writeln('  Output path: ' + Config.OutputPath);
        console.noteln('  Calibrate Images: ' + Config.NeedCalibration);
        if (Config.NeedCalibration)
            console.noteln('  Masters library path: ' + Config.CalibratationMastersPath);
        console.noteln('  Register Images: ' + Config.NeedRegister);
        if (Config.NeedRegister)
            console.noteln('  Registration Reference path: ' + Config.RegistrationReferencesPath);
        console.noteln('  Normalize Images: ' + Config.NeedNormalization);
        if (Config.NeedNormalization)
            console.noteln('  Normalization Reference path: ' + Config.NormalizationReferencesPath);
        console.writeln();

        // Starting processing
        console.noteln('Starting script...');
        console.noteln();

        // Calc work
		this.calcWork(Config.InputPath);
        console.noteln("Need to process:");
        console.noteln("   directories: " + this.DirsToProcessNum);
        console.noteln("   files: " + this.FilesToProcessNum);

		//Show progress bar
		if (this.progressDialog) {
			this.progressDialog.initBar(Config.InputPath,this.FilesToProcessNum);
			this.progressDialog.show();
		}

        /* **************************************************************************************************************
        *
        *       1й проход. Сканирование директорий на предмет оригинальных FITS
        *
        * **************************************************************************************************************
        * Производит поиск исходных (необработанных) FITS файлов и их обработка по цепочке калибровки.
        * Также является 1ым проходом перед поиском недостающих файлов в цепочке калибровки (если включено)
        * **************************************************************************************************************/
        this.searchDirectory(Config.InputPath);
		
		if (this.abortRequested) return false;

        /* **************************************************************************************************************
        * Run SubframeSelector measurements (if needed)
        **************************************************************************************************************/
		this.runSubframeSelector();


        if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER)
            this.MoveMostAdvanced();

        //Finish 1st pass
        console.noteln("<end><cbr><br>",
            "************************************************************");
        console.noteln('Finished 1st pass ("original fits scan"). Processed ' + this.ProcessesCompleted + ' (of ' + this.FileTotalCount + ') file(s) in ' + this.T.text + ' sec');
        console.noteln("************************************************************");
        console.noteln("Calibrated: " + this.CalibratedCount);
        console.noteln("Cosmetized: " + this.CosmetizedCount);
        console.noteln("ABE: " + this.ABECount);
        console.noteln("Registered: " + this.RegisteredCount);
        console.noteln("Normalized: " + this.NormalizedCount);
        console.noteln("************************************************************");
        console.noteln("<end><cbr><br>");

        /* **************************************************************************************************************
         *
         *       2й проход. Определение недостающих файлов в цепочке калибровки и их изготовление
         *
         * **************************************************************************************************************
         * Производит сканирования массива, полученного в первом проходе с определением недостающих этапов калибровки для каждого файла
         * В случае отсутствия запускает нужный этап калибровки
         * **************************************************************************************************************/
        if (Config.UseSecnodPass) {
            this.DirCount = 0;
            this.FileTotalCount = 0;
            this.ProcessesCompleted = 0;

            this.ScanArray();

            //Finish working
            console.noteln("<end><cbr><br>",
                "************************************************************");
            console.noteln('Finished 2nd pass ("missing stages scan"). Processed ' + this.ProcessesCompleted + ' (of ' + this.FileTotalCount + ') file(s). in ' + this.T.text + ' sec');
            console.noteln('Whole timerun ' + this.T.text + ' sec');
            console.noteln("************************************************************");

        }
        //sleep(10);
		return true;
    }

    /* **************************************************************************************************************
     *
     * Подсчет количества файлов для обрабтки (не учитывает те, которые уже обработаны)
     *
    /* **************************************************************************************************************
     *
     * @param file string
     * @return void
     */
    this.calcWork = function (searchPath) {
        this.DirsToProcessNum++;
        var objFileFind = new FileFind;

        // Begin search
        if (objFileFind.begin(searchPath + "/*")) {
            do {
                // if not upper dir links
                if (objFileFind.name != "." && objFileFind.name != "..") {
                  // if this is Directory and recursion is enabled
                  if (objFileFind.isDirectory) {
                     if (Config.SearchInSubDirs &&
                              objFileFind.name.substring(0, Config.SkipDirsBeginWith.length) != Config.SkipDirsBeginWith &&
                              Config.SkipDirs.indexOf(objFileFind.name) === -1 &&
                              FileDirNameContains(objFileFind.name, Config.SkipDirsContains) !== true) {
                                //console.writeln('found dir: '+ searchPath +'/'+ objFileFind.name);

                          // Run recursion search
                          this.calcWork(searchPath + '/' + objFileFind.name);
                     }

                  }
                  // if File
                  else {
                     // if this is FIT
                     if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits') && FileDirNameContains(objFileFind.name, Config.SkipFilesContains) !== true) {
                        this.FilesToProcessNum++;
                     }
                  }
                }
            } while (objFileFind.next());
        };
    };

    /* **************************************************************************************************************
     * Базовая функция для 1го прохода
     *
     * @param file string
     * @return object
     */
    this.searchDirectory = function (searchPath) {
        this.DirCount++;
        var FileCount = 0;
        console.noteln("<end><cbr><br>",
            "************************************************************");
        Console.noteln('* ' + this.DirCount + ' of ' + this.DirsToProcessNum +'. Searching dir: ' + searchPath + ' for fits');
        console.noteln("************************************************************");

        if (!busy) {

            busy = true;
            needRefresh = false;
            var objFileFind = new FileFind;

            // Begin search
            if (objFileFind.begin(searchPath + "/*")) {
                do {
					// if not upper dir links
                    if (objFileFind.name != "." && objFileFind.name != "..") {

                        // if this is Directory and recursion is enabled
                        if (objFileFind.isDirectory) {
                            if (Config.SearchInSubDirs &&
                                objFileFind.name.substring(0, Config.SkipDirsBeginWith.length) != Config.SkipDirsBeginWith &&
                                Config.SkipDirs.indexOf(objFileFind.name) === -1 &&
                                FileDirNameContains(objFileFind.name, Config.SkipDirsContains) !== true) {
                                //console.writeln('found dir: '+ searchPath +'/'+ objFileFind.name);

                                // Run recursion search
                                busy = false; // на будущее для асихнронного блока
                                this.searchDirectory(searchPath + '/' + objFileFind.name);
                                busy = true;
                            }

                        }
                        // if File
                        else {
							debug('File found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                            debug('Extension: ' + fileExtension(objFileFind.name), dbgNotice);
                            // if this is FIT
							if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits') && FileDirNameContains(objFileFind.name, Config.SkipFilesContains) !== true) {

                                // Set output folders (depends on config)
                                if (Config.PathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
                                    this.BaseCalibratedOutputPath = Config.InputPath + "/" + Config.OutputPath;
                                } else if (Config.PathMode == PATHMODE.ABSOLUTE) {
                                    this.BaseCalibratedOutputPath = Config.OutputPath;
                                } else if (Config.PathMode == PATHMODE.RELATIVE || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER) {
                                    this.BaseCalibratedOutputPath = searchPath;
                                } else {
                                    this.BaseCalibratedOutputPath = Config.OutputPath;
                                }
                                debug("BaseCalibratedOutputPath: " + this.BaseCalibratedOutputPath, dbgNotice);

                                // Check if file still NOT CALIBRATED and Populate Array
                                if (checkFileNeedCalibratation_and_PopulateArray(searchPath + '/' + objFileFind.name)) {
                                    FileCount++;
                                    this.FileTotalCount++;
									if (this.progressDialog) { this.progressDialog.updateBar_NewFile(this.FileTotalCount, objFileFind.name); }

                                    console.noteln("<end><cbr><br>",
                                        "************************************************************");
                                    Console.noteln('* [' + this.FileTotalCount + ' of ' + this.FilesToProcessNum + ' (' + parseFloat(this.FileTotalCount/this.FilesToProcessNum*100).toFixed(1) +'%)] Start file processings: ' + searchPath + '/' + objFileFind.name);
                                    progressBar(this.FileTotalCount,this.FilesToProcessNum);
                                    Console.noteln("  ETA: " + parseFloat(this.T.value/this.FileTotalCount*(this.FilesToProcessNum - this.FileTotalCount) / 60).toFixed(1) + " min, Elapsed: " + this.T.text +" sec");
                                    Console.noteln("************************************************************");

                                    this.NeedToCopyToFinalDirFlag = true;

									if (console.abortRequested || this.progressDialog.abortRequested || this.abortRequested){
										console.criticalln("Abort requsted, breaking ...");
										this.abortRequested = true;
										return false;
									}
									else 
									{
										console.warningln("this.progressDialog.abortRequested: " + this.progressDialog.abortRequested + ", this.abortRequested: "+this.abortRequested);
									}

                                    //Process by full pipeline
                                    this.addFileForApproving(
                                        this.localNormalization(
                                            this.registerFits(
                                                this.ABEprocess(
                                                    debayerSplitFit(
                                                        this.cosmeticFit(
                                                            this.calibrateFITSFile(searchPath + '/' + objFileFind.name)))))));
															
                                }
                                else
                                {
                                    debug('Skipping any actions on file found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                                }
                            }
                        }
                    }
                } while (objFileFind.next());
            }

            busy = false;
        }
		return true;
    };


    /* **************************************************************************************************************
     *
     * Базовая функция для 2го прохода
     *
    /* **************************************************************************************************************
     *
     * @param file string
     * @return object
     */
    this.ScanArray = function () {

        console.noteln("<end><cbr><br>",
            "************************************************************");
        Console.noteln('* Starting second pass');
        console.noteln("************************************************************");

        // Print array
        console.writeln("Need to proccess (total count = " + FILEARRAY.length + ")");
        for (var i = 0; i < FILEARRAY.length; i++) {

            for (var property in FILEARRAY[i]) {
                if (property == "fits")
                    console.note("<b>", FILEARRAY[i].fits, "</b> | ");
                else
                    console.write("<b>", property, "</b>: ", FILEARRAY[i][property], " | ");
            }
            console.writeln();
        }


        // @TODO ABE:
        // ok   getFILEARRPrecedingName()
        // ok   getFILEARRPropertyName()
        // ok   константы FITS.ORIGINAL
        // ok   AddFileToArray
        // ok   как формируется FILEARRAY
        // ok   checkFileNeedCalibratation_and_PopulateArray
        // модифицифировать цикл ниже

        // Переопределяем режимы размещения папок
        // Размещать файлы по объектам
        // А ниже назначаем this.BaseCalibratedOutputPath уровень ниже найденного
        // cfgCreateObjectFolder = false; //отключаем режим

        //Проверим массив на наличие пропущенных звеньев и попробуем создать это звено
        for (var i = 0; i < FILEARRAY.length; i++) {

            for (var property in FILEARRAY[i]) {
                if (property == "fits") {
                    console.noteln(" ************************************************************ ");
                    console.note("Fits from array <b>", FILEARRAY[i].fits, "</b> is ");
                } else {
                    if (FILEARRAY[i][property] == null) {
                        // Возьмем предыдущий по конвейеру файл
                        var preceding = getFILEARRPrecedingName(property);
                        var filename = FILEARRAY[i][preceding];
                        if (filename == null)
                            continue;

                        console.noteln("missing <b>" + property + "</b>. Let's try to create it from <b>" + preceding + "</b>...");
                        console.noteln(" ************************************************************ ");

                        // Установим директорию для вывода недостающего файла
                        var fn = "";
                        if ((fn = filename.match(/(.+)\/(.+)\/(.+).fit(s){0,1}$/i)) != null) {
                            debug("pathtodir: " + fn[1], dbgNotice);
                            debug("filedir: " + fn[2], dbgNotice);
                            debug("file: " + fn[3], dbgNotice);
                            this.BaseCalibratedOutputPath = fn[1];
                        } else {

                            this.BaseCalibratedOutputPath = File.extractDrive(FILEARRAY[i][getFILEARRPropertyName(FITS.ORIGINAL)])
                                 + File.extractDirectory(FILEARRAY[i][getFILEARRPropertyName(FITS.ORIGINAL)]);
                        }

                        debug(this.BaseCalibratedOutputPath, dbgNormal);

                        // if missing CALIBRATED
                        if (property == getFILEARRPropertyName(FITS.CALIBRATED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;

                            // Process
                            var res = this.calibrateFITSFile(FILEARRAY[i][preceding]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits, dbgNotice);
                        }
                        // if missing COSMETIZED
                        if (property == getFILEARRPropertyName(FITS.COSMETIZED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.cosmeticFit(FILEARRAY[i][preceding]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        // if missing ABED
                        if (property == getFILEARRPropertyName(FITS.ABED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.ABEprocess([FILEARRAY[i][preceding]]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        // if missing REGISTERED
                        if (property == getFILEARRPropertyName(FITS.REGISTERED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.registerFits([FILEARRAY[i][preceding]]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        // if missing NORMALIZED
                        if (property == getFILEARRPropertyName(FITS.NORMALIZED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.localNormalization([FILEARRAY[i][preceding]]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);

                        }
                        // if missing APPROVED
                        // ... and there is NormalizedFile
                        if (property == getFILEARRPropertyName(FITS.APPROVED) && FILEARRAY[i][getFILEARRPropertyName(FITS.NORMALIZED)] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = approvingFiles([FILEARRAY[i][getFILEARRPropertyName(FITS.NORMALIZED)]]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        // ... and there is no NormalizedFile, using Registered
                        else if (property == getFILEARRPropertyName(FITS.APPROVED) && FILEARRAY[i][getFILEARRPropertyName(FITS.REGISTERED)] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = approvingFiles([FILEARRAY[i][getFILEARRPropertyName(FITS.REGISTERED)]]);
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);

                        }
                    }

                }
            }
            console.writeln();
        }

        // Print array in the end
        console.writeln("What we have after processing " + FILEARRAY.length + " records:");
        for (var i = 0; i < FILEARRAY.length; i++) {

            for (var property in FILEARRAY[i]) {
                if (property == "fits")
                    console.noteln("<b>", FILEARRAY[i].fits, "</b> | ");
                else
                    console.write("<b>", property, "</b>: ", FILEARRAY[i][property], " | ");
            }
            console.writeln();
        }
    }

    /************************************************************************************************************
     * Перемешение наиболее "верхних" в конвейре файлов из папок
     */
    this.MoveMostAdvanced = function (searchPath) {
        print_array(requestToCopy);

        requestToCopy.forEach(function (element) {

            if (typeof element == 'string') {
                objelement[0] = element;
            } else {
                objelement = element;
            }

            for (var i = 0; i < objelement.length; i++) {
                var fileName = objelement[i].toString();

                //Get ObjFolderName
                var fileData = getFileHeaderData(fileName); // Get FITS HEADER data to know object name
                fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);

                if (Config.PathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
                    this.BaseCalibratedOutputPath = Config.InputPath + "/" + Config.OutputPath;
                } else if (Config.PathMode == PATHMODE.ABSOLUTE) {
                    FinalsOutputPath = this.BaseCalibratedOutputPath + "/" + Config.FinalsDirName;
                } else if (Config.PathMode == PATHMODE.RELATIVE || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER) {
                    this.BaseCalibratedOutputPath = searchPath;
                } else {
                    this.BaseCalibratedOutputPath = Config.OutputPath;
                }

                FinalsOutputPath = this.BaseCalibratedOutputPath + "/" + Config.FinalsDirName + "/" + fileData.object;
                var DestinationFileName = FinalsOutputPath + '/' + File.extractNameAndExtension(fileName);

                console.writeln("Copying result file " + fileName + " to " + DestinationFileName);

                if (!File.directoryExists(FinalsOutputPath))
                    File.createDirectory(FinalsOutputPath, true);

                if (!File.exists(DestinationFileName))
                    File.copyFile(
                        DestinationFileName,
                        fileName);
            }
        })

    }

    /**
     * Добавить файл в массив (используется во время 2го прохода)
     *
     * @param type          string   тип файла (FITS.ORIGINAL,FITS.CALIBRATED, .... )
     * @param fullname      string   полное имя файла (с путем)
     * @param signaturename string   имя оригинального fits файла, соответветствующее рассматриваемому (без расширения)
     * @param pathtofile    string   путь к файлу
     * @return object
     */
    function AddFileToArray(type, fullname, signaturename, pathtofile) {
        // search - is there is such file line?
        var fnd = false,
        fndpos = -1;
        for (var i = 0; i < FILEARRAY.length; i++) {
            if (FILEARRAY[i].fits == signaturename) {
                debug("FOUND!", dbgNotice);
                fnd = true;
                fndpos = i;
            }
        }
        //if found - add info to line
        if (fnd) {
            FILEARRAY[fndpos][getFILEARRPropertyName(type)] = fullname;
        } else {
            //no line, add data
            FILEARRAY.push({
                fits: signaturename,
                fullname:       (type == FITS.ORIGINAL ? fullname : null),
                calibrated:     (type == FITS.CALIBRATED ? fullname : null),
                cosmetized:     (type == FITS.COSMETIZED ? fullname : null),
                abed:           (type == FITS.ABED ? fullname : null),
                registered:     (type == FITS.REGISTERED ? fullname : null),
                normalized:     (type == FITS.NORMALIZED ? fullname : null),
                approved:       (type == FITS.APPROVED ? fullname : null),
            });
        }
    }

    /**
     * Этот фит нужно калибровать? Нет ли уже готового такого?
     * + Добавить  массив для второго прохода
     *
     * @param file string Имя пути/файла
     * @return bool
     */
    function checkFileNeedCalibratation_and_PopulateArray(file) {

        //debug(typeof(file) + " " + file.length, dbgNormal);
        // Если на входе Boolean, то значит ранее в цепочек произошла ошибка, выходим=
        if (typeof(file) == "boolean") {
            debug("Input is boolean, i.e. it was due to previous proccesing incomplitness. Exiting", dbgNormal);
            return false;
        }
        //Если на входе массив, то берем первый файл
        else if (typeof(file) == "object" && file.length > 0) {
            debug("array of files, using first", dbgNormal);
            file = file[0];
        }

        //fn=file.match(/(.+)\/(.+)_c_cc.fit(s){0,1}$/);
        //debug("file :" + file);
        //debug("test: " + (file.match(/_c_cc.fit(s){0,1}$/) != null));

        // Проверим, на входе файл на какой стадии? (оригинальный, калиброванный, косметизированный, .... )
        var fn = "";
        if ((fn = file.match(/(.+)\/(.+)_c.fit(s){0,1}$/i)) != null) {
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);
            debug("file is calibrated of " + fn[2], dbgNotice);

            AddFileToArray(FITS.CALIBRATED, file, fn[2], fn[1]); //type, full name, signature, path
            return false;
        } else if ((fn = file.match(/(.+)\/(.+)_c_cc.fit(s){0,1}$/i)) != null) {
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);
            debug("file is cosmetized of " + fn[2], dbgNotice);

            AddFileToArray(FITS.COSMETIZED, file, fn[2], fn[1]); //type, full name, signature, path
            return false;
        } else if ((fn = file.match(/(.+)\/(.+)_c_cc_b.fit(s){0,1}$/i)) != null) {
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);
            debug("file is abed of " + fn[2], dbgNotice);

            AddFileToArray(FITS.ABED, file, fn[2], fn[1]); //type, full name, signature, path
            return false;
        } else if ((fn = file.match(/(.+)\/(.+)_c_cc_b_r.fit(s){0,1}$/i)) != null || (fn = file.match(/(.+)\/(.+)_c_cc_r.fit(s){0,1}$/i)) != null) {
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);
            debug("file is registered of " + fn[2], dbgNotice);

            AddFileToArray(FITS.REGISTERED, file, fn[2], fn[1]); //type, full name, signature, path

            return false;
        } else if ((fn = file.match(/(.+)\/(.+)_c_cc_b_r_n.fit(s){0,1}$/i)) != null || (fn = file.match(/(.+)\/(.+)_c_cc_r_n.fit(s){0,1}$/i)) != null) {
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);
            debug("file is normalized of " + fn[2], dbgNotice);

            AddFileToArray(FITS.NORMALIZED, file, fn[2], fn[1]); //type, full name, signature, path

            return false;
        } else if ((fn = file.match(/(.+)\/(.+)_c_cc_b_r_n_a.fit(s){0,1}$/i)) != null || (fn = file.match(/(.+)\/(.+)_c_cc_r_n_a.fit(s){0,1}$/i)) != null || (fn = file.match(/(.+)\/(.+)_c_cc_r_a.fit(s){0,1}$/i)) != null) {
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);
            debug("file is approved of " + fn[2], dbgNotice);

            AddFileToArray(FITS.APPROVED, file, fn[2], fn[1]); //type, full name, signature, path

            return false;
        } else {
            fn = file.match(/(.+)\/(.+).fit(s){0,1}$/i);
            debug("path: " + fn[1], dbgNotice);
            debug("matched: " + fn[2], dbgNotice);

            AddFileToArray(FITS.ORIGINAL, file, fn[2], fn[1]); //type, full name, signature, path

            return true;
        }

        /*
        // Проверим, а нет ли уже такого откалиброванного файла?
        var CalibratedFileName = CalibratedOutputPath +'/'+ File.extractName(file) +'_c.fit';
        var fileExistsFlag = File.exists( CalibratedFileName );
        Console.warningln('File '+ CalibratedFileName + ' already exists, skipping calibration' );

        return !fileExistsFlag;
         */

        return true;
    }

    /************************************************************************************************************
     * Калибровка фита
     *
     * @param fileName string  полное имя файла.fit включая путь
     * @return string          полное имя файла_c.fit включая путь
     */
    this.calibrateFITSFile = function (fileName) {
        if (fileName == false) {
            debug("Skipping Calibration", dbgNormal);
            return false;
        }

        if (!Config.NeedCalibration) {
            debug("Calibration is off", dbgNormal);
            return fileName;
        }

        // Start calibration
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| [" + this.FileTotalCount + "] Begin calibration of ", fileName);
        console.noteln("-------------------------------------------------------------");
		
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("calibrateFITSFile"); }

        //Set calibrated output path
        CalibratedOutputPath = this.BaseCalibratedOutputPath;
		var fileData = null;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            fileData = getFileHeaderData(fileName); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            CalibratedOutputPath = CalibratedOutputPath + "/" + fileData.object;
        }
        CalibratedOutputPath = CalibratedOutputPath + "/" + Config.CalibratedFolderName;

        // make new file name
        var FileName = File.extractName(fileName) + '.' + fileExtension(fileName)
        var newFileName = FileName.replace(/\.fit(s){0,1}$/i, '_c.fit')
        newFileName = CalibratedOutputPath + '/' + newFileName

        //Проверить - сущетсвует ли файл и стоит ли перезаписывать его
        if (Config.SkipExistingFiles && File.exists(newFileName)) {
            Console.warningln('File ' + newFileName + ' already exists, skipping calibration');
        } else {

            if (!fileData)
                fileData = getFileHeaderData(fileName); // Get FITS HEADER data if not got earlier
            if (!fileData) {
                console.criticalln("Can't get File Header for Calibration for " + fileName + "!");
                return false;
            }

            // Get Masters files names
            var mastersFiles = matchMasterCalibrationFiles(Config.CalibratationMastersPath + "/" + fileData.instrument + (Config.UseCameraName ? "/" + fileData.camera : "")
                        , fileData);

            if (!mastersFiles) {
                Console.warningln("*** Skipping calibration because master calibration file(s) was not found ***");
                return fileName;
            }

            // Check if folder for calibrated files exists and create it
            if (!File.directoryExists(CalibratedOutputPath))
                File.createDirectory(CalibratedOutputPath, true);

            var P = new ImageCalibration;
            P.targetFrames = [// enabled, path
                [true, fileName]
            ];
            P.inputHints = "";
            P.outputHints = "";
            P.pedestal = 0;
            P.pedestalMode = ImageCalibration.prototype.Keyword;
            P.pedestalKeyword = "";

            //test for Overscan and cut it if present
            if (this.CameraHeaders.calcOverscanPresent(fileData)) {
				P.overscanEnabled = true;
				P.overscanImageX0 = this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x0; //24
				P.overscanImageY0 = this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y0; //0
				P.overscanImageX1 = this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x1; //9600
				P.overscanImageY1 = this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y1; //6388
				debug("Bin1: x0=" + this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x0 + ", y0=" + this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y0 + ", x1=" + this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x1 + ", y1=" +this.CameraHeaders.CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y1, dbgNotice)
            } else {
               P.overscanEnabled = false;
               P.overscanImageX0 = 0;
               P.overscanImageY0 = 0;
               P.overscanImageX1 = 0;
               P.overscanImageY1 = 0;
            }

            P.overscanRegions = [// enabled, sourceX0, sourceY0, sourceX1, sourceY1, targetX0, targetY0, targetX1, targetY1
                [false, 0, 0, 0, 0, 0, 0, 0, 0],
                [false, 0, 0, 0, 0, 0, 0, 0, 0],
                [false, 0, 0, 0, 0, 0, 0, 0, 0],
                [false, 0, 0, 0, 0, 0, 0, 0, 0]
            ];

            P.masterBiasEnabled = true;
            P.masterBiasPath = mastersFiles.masterbias;

            P.masterDarkEnabled = true;
            P.masterDarkPath = mastersFiles.masterdark;

            P.masterFlatEnabled = true;
            P.masterFlatPath = mastersFiles.masterflat;

            P.calibrateBias = false;
            P.calibrateDark = true; // понять бы - нужно или нет?!
            P.calibrateFlat = false; // понять бы - нужно или нет?!

            P.optimizeDarks = true;
            P.darkOptimizationThreshold = 0.00000;
            P.darkOptimizationLow = 3.0000;
            P.darkOptimizationWindow = 1024;

            P.darkCFADetectionMode = (fileData.cfa)
             ? ImageCalibration.prototype.ForceCFA
             : ImageCalibration.prototype.IgnoreCFA;
            P.enableCFA = fileData.cfa;

            P.outputDirectory = CalibratedOutputPath;
            P.outputExtension = ".fit";
            P.outputPrefix = "";
            P.outputPostfix = "_c";
            P.outputSampleFormat = Config.OutputFormatIC;
            P.outputPedestal = 0; // Нужно поискать

            P.overwriteExistingFiles = Config.OverwriteAllFiles;
            P.onError = ImageCalibration.prototype.Continue;
            P.noGUIMessages = true;
            P.useFileThreads = true;
            P.fileThreadOverload = 1.00;
            P.maxFileReadThreads = 0;
            P.maxFileWriteThreads = 0;

            // Signal evaluation (from 1.8.8-10)
            P.evaluateNoise = true;
            P.noiseEvaluationAlgorithm = ImageCalibration.prototype.NoiseEvaluation_MRS;
            P.evaluateSignal = true;
            P.structureLayers = 5;
            P.noiseLayers = 1;
            P.hotPixelFilterRadius = 1;
            P.noiseReductionFilterRadius = 0;
            P.minStructureSize = 0;
            P.psfType = ImageCalibration.prototype.PSFType_Moffat4;
            P.psfRejectionLimit = 5.00;
            P.maxStars = 2000;

            //P.writeIcon ("Calibr"); //save currrent process into icon for debug

            var status = P.executeGlobal();

            console.noteln("<end><cbr><br>",
                "-------------------------------------------------------------");

            if (status)
            {
                this.CalibratedCount++;
                this.ProcessesCompleted++;

                console.noteln(" [" + this.FileTotalCount + "] End of calibration");
                console.noteln("-------------------------------------------------------------");
            }
            else
            {
                console.criticalln(" [" + this.FileTotalCount + "] End of calibration with error");
                console.noteln("-------------------------------------------------------------");
				//if (this.progressDialog) { this.progressDialog.updateBar_NewError(fileName, "ImageCalibration.executeGlobal()", "Status error"); }
                return false;
            }

        }

        if (File.exists(newFileName)) {
            // Добавим в массив файлов информацию о создании калибровочного файла, что второй раз не делал
            var fn = "";
            if ((fn = newFileName.match(/(.+)\/(.+)_c.fit(s){0,1}$/i)) != null) {
                debug("path: " + fn[1], dbgNotice);
                debug("matched: " + fn[2], dbgNotice);
                debug("file is calibrated of " + fn[2], dbgNotice);

                AddFileToArray(FITS.CALIBRATED, newFileName, fn[2], fn[1]); //type, full name, signature, path
            } else {
                debug("PATTERN NOT FOUND");
            }
            return newFileName;
        } else {
            return false;
        }

    }

    /************************************************************************************************************
     * Косметика фита
     *
     * @param fileName string  Полное Имя файла_c.fit включая путь
     * @return string          Полное имя файла_c_cc.fit включая путь
     */
    this.cosmeticFit = function (fileName) {
        if (fileName == false || !fileName.match(/_c.fit(s){0,1}$/)) {
            debug("Skipping Cosmetic Correction", dbgNormal);
            return fileName;
        }
        if (!Config.NeedCosmeticCorrection) {
            debug("Cosmetic correction is off (with calibration)", dbgNormal);
            return fileName;
        }

        // Start cosmetic correction
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| [" + this.FileTotalCount + "] Begin cosmetic correction of ", fileName);
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("cosmeticFit"); }

        //Set cosmetized output path
        CosmetizedOutputPath = this.BaseCalibratedOutputPath;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            var fileData = getFileHeaderData(fileName); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            CosmetizedOutputPath = CosmetizedOutputPath + "/" + fileData.object;
        }
        CosmetizedOutputPath = CosmetizedOutputPath + "/" + Config.CosmetizedFolderName;

        // return new file name
        var FileName = File.extractName(fileName) + '.' + fileExtension(fileName)
        var newFileName = FileName.replace(/_c\.fit(s){0,1}$/, '_c_cc.fit');
        newFileName = CosmetizedOutputPath + '/' + newFileName;

        //Проверить - существует ли файл и стоит ли перезаписывать его
        if (Config.SkipExistingFiles && File.exists(newFileName)) {
            Console.warningln('File ' + newFileName + ' already exists, skipping cosmetic correction');
        } else {
            if (!fileData)
                var fileData = getFileHeaderData(fileName); // Get FITS HEADER data if not got earlier
            if (!fileData) {
                console.criticalln("Can't get File Header for Cosmetic Correction for " + fileName + "!");
                return false;
            }

            // Get CosmeticCorrection Process Icon
            var ProcessIconName = Config.CosmetizedProcessName + '_' + fileData.instrument.replace('/', '_') + (Config.UseCameraInCosmeticsIcons ? '_' + fileData.camera : '') + ((this.CameraHeaders.checkCameraUsingBIN(fileData) || Config.UseBiningFolder) ? '_bin' + fileData.bin : '') + (Config.UseExposureInCosmeticsIcons ? '_' + fileData.duration : '');
            debug("Using ProcessIcon name: ", ProcessIconName, dbgNormal);

            // Check if folder for cosmetics files exists
            if (!File.directoryExists(CosmetizedOutputPath))
                File.createDirectory(CosmetizedOutputPath, true);

            var CC = ProcessInstance.fromIcon(ProcessIconName);
            if (CC == null) {
                console.criticalln();
                console.criticalln("Cosmetic correction process icon: <b>" + ProcessIconName + "</b> not found");
                console.criticalln("Skipping cosmetic correction");
                console.criticalln();
                return fileName;
            }
            if (!(CC instanceof CosmeticCorrection)) {
                console.criticalln();
                console.criticalln("The specified icon does not an instance of CosmeticCorrection: <b>" + ProcessIconName + "</b>");
                console.criticalln("Skipping cosmetic correction");
                console.criticalln();
                return fileName;
            }

			debug("<br>Using CC process icon: " + ProcessIconName, dbgNormal);

            CC.targetFrames = [// enabled, path
                [true, fileName]
            ];
            CC.outputDir = CosmetizedOutputPath;
            CC.outputExtension = ".fit";
            CC.prefix = "";
            CC.postfix = "_cc";
            CC.overwrite = Config.OverwriteAllFiles;
            //CC.cfa             = false;

            var status = CC.executeGlobal();
            this.ProcessesCompleted++;
            this.CosmetizedCount++;

            console.noteln("<end><cbr><br>",
                "-------------------------------------------------------------");
            console.noteln(" [" + this.FileTotalCount + "] End of cosmetic correction ");
            console.noteln("-------------------------------------------------------------");
        }

        if (File.exists(newFileName)) {
            // Добавим в массив файлов информацию о создании косметического файла, что второй раз не делал
            var fn = "";
            if ((fn = newFileName.match(/(.+)\/(.+)_c_cc.fit(s){0,1}$/i)) != null) {
                //debug("path: " + fn[1], dbgNotice);
                //debug("matched: " + fn[2], dbgNotice);
                //ebug("file is cosmetized of " + fn[2], dbgNotice);

                AddFileToArray(FITS.COSMETIZED, newFileName, fn[2], fn[1]); //type, full name, signature, path
            } else {
                debug("PATTERN NOT FOUND");
            }
            return newFileName;
        } else {
            return fileName;
        }

    }

    /************************************************************************************************************
     * Выравнивание фона через ABE у фитов на входе (1-3 в зависимости от был ли чб или цвет)
     *
     * @param files   string | array of strings полное имя файла.fit включая путь (или массив файлов)
     * @return string | array of strings        полное имя файла_c_сс_b.fit включая путь
     *
     */
    this.ABEprocess = function (files) {
        if (files == false) {
            debug("Skipping ABE processing", dbgNormal);
            return false;
        }

        if (!Config.NeedABE) {
            debug("ABE processing is off", dbgNormal);
            return files;
        }

        // Прервый всегда будет "файлом", даже если их много
        var file = files[0];

        // Start ABE
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| [" + this.FileTotalCount + "] Begin processing ABE of ", (files.length != 1 ? files.length + " files" : file));
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("ABEprocess"); }

        // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
        debug("Need to ABE " + files.length + " file(s)", dbgNotice);

        // Set folder path
        ABEOutputPath = this.BaseCalibratedOutputPath;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            var fileData = getFileHeaderData(file); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            ABEOutputPath = ABEOutputPath + "/" + fileData.object;
        }
        ABEOutputPath = ABEOutputPath + "/" + Config.ABEFolderName;

        // Start ABE for all files
        var newFiles = []; //empty array
        for (var i = 0; i < files.length; i++) {

            // return new file name
            var FileName = File.extractName(files[i]) + '.' + fileExtension(files[i])
                var newFileName = FileName.replace(/_c_cc\.fit(s){0,1}$/, '_c_cc_b.fit');
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c\.fit(s){0,1}$/, '_c_b.fit'); //if СС was not run before
            newFiles[i] = ABEOutputPath + '/' + newFileName;

            //Проверить - существует ли файл и стоит ли перезаписывать его
            if (Config.SkipExistingFiles && File.exists(newFiles[i])) {
                Console.warningln('File ' + newFileName + ' already exists, skipping ABE');
            } else {

                // Check if folder exists
                if (!File.directoryExists(ABEOutputPath))
                    File.createDirectory(ABEOutputPath, true);

                if (files.length > 1)
                    Console.noteln("Processing ABE " + files[i]);

                //Open file
                ImageWindow.open(files[i]);
                var w = ImageWindow.openWindows[ImageWindow.openWindows.length - 1];

                if (!w || w.isNull) {
                    Console.criticalln("Error opening image file: " + files[i]);
                    return false;
                }

                var ABEproc;

                var ProcessIconName = Config.ABEProcessName;
                debug("Using ProcessIcon name: ", ProcessIconName, dbgNormal);

                //Try to use saved process
                ABEproc = ProcessInstance.fromIcon(ProcessIconName);

                if (ABEproc == null || !(ABEproc instanceof AutomaticBackgroundExtractor)) {
                    debug("The specified icon does not exists or instance of AutomaticBackgroundExtractor: " + ProcessIconName, dbgNormal);

                    //Using default
                    ABEproc = new AutomaticBackgroundExtractor;
                    with (ABEproc) {
                        tolerance = 1.000;
                        deviation = 0.800;
                        unbalance = 1.800;
                        minBoxFraction = 0.050;
                        maxBackground = 1.0000;
                        minBackground = 0.0000;
                        useBrightnessLimits = false;
                        polyDegree = 5;
                        boxSize = 5;
                        boxSeparation = 5;
                        modelImageSampleFormat = AutomaticBackgroundExtractor.prototype.f32;
                        abeDownsample = 2.00;
                        writeSampleBoxes = false;
                        justTrySamples = false;
                        targetCorrection = AutomaticBackgroundExtractor.prototype.Subtract;
                        normalize = true;
                        discardModel = true;
                        replaceTarget = true;
                        correctedImageId = "";
                        correctedImageSampleFormat = AutomaticBackgroundExtractor.prototype.SameAsTarget;
                        verboseCoefficients = false;
                        compareModel = false;
                        compareFactor = 10.00;
                    }
                } else {
                    with (ABEproc) {
                        writeSampleBoxes = false;
                        justTrySamples = false;
                        replaceTarget = true;
                        correctedImageSampleFormat = AutomaticBackgroundExtractor.prototype.SameAsTarget;
                    }
                }

                //Запустить
                with (ABEproc) {
                    executeOn(w.mainView);
                    //
                    // save
                    //
                    w.saveAs(newFiles[i], false, false, true, !Config.OverwriteAllFiles);
                }
                w.purge();
                w.forceClose(); //w.close();

                this.ProcessesCompleted++;
                this.ABECount++;

                console.noteln("<end><cbr><br>",
                    "-------------------------------------------------------------");
                console.noteln(" [" + this.FileTotalCount + "] End of ABE ");
                console.noteln("-------------------------------------------------------------");

            }

            if (File.exists(newFiles[i])) {
                // Добавим в массив файлов информацию о создании регистрируемого файла, чтобы второй раз не делать
                var fn = "";
                if ((fn = newFiles[i].match(/(.+)\/(.+)_c_cc_b.fit(s){0,1}$/i)) != null || (fn = newFiles[i].match(/(.+)\/(.+)_c_b.fit(s){0,1}$/i)) != null) {
                    debug("path: " + fn[1], dbgNotice);
                    debug("matched: " + fn[2], dbgNotice);
                    debug("file is abed of " + fn[2], dbgNotice);

                    AddFileToArray(FITS.ABED, newFiles[i], fn[2], fn[1]); //type, full name, signature, path
                } else {
                    debug("PATTERN NOT FOUND");
                }
            } else {
                return false;
            }
        }

        return newFiles;
    }

    /************************************************************************************************************
     * Регистрация (выравнивание) фитов (1-3 в зависимости от был ли чб или цвет)
     *
     * @param files   string | array of strings полное имя файла.fit включая путь (или массив файлов)
     * @return string | array of strings        полное имя файла_c_сс_r.fit включая путь
     *
     */
    this.registerFits = function (files) {
        if (files == false) {
            debug("Skipping Registration", dbgNormal);
            return false;
        }

        if (!Config.NeedRegister) {
            debug("Registration is off", dbgNormal);

            if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER && this.NeedToCopyToFinalDirFlag) {
                requestToCopy.push(files);
                this.NeedToCopyToFinalDirFlag = false;
            }

            return files;
        }

        // Прервый всегда будет "файлом", даже если их много
        var file = files[0];

        // Start registation
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| [" + this.FileTotalCount + "] Begin registration of ", (files.length != 1 ? files.length + " files" : file));
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("registerFits"); }

        // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
        debug("Need to register " + files.length + " file(s)", dbgNotice);

        // Set registration folder
        RegisteredOutputPath = this.BaseCalibratedOutputPath;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            var fileData = getFileHeaderData(file); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            RegisteredOutputPath = RegisteredOutputPath + "/" + fileData.object;
        }
        RegisteredOutputPath = RegisteredOutputPath + "/" + Config.RegisteredFolderName;

        // Start registration for all files
        var newFiles = []; //empty array
        for (var i = 0; i < files.length; i++) {

            // return new file name
            var FileName = File.extractName(files[i]) + '.' + fileExtension(files[i]);
            var newFileName = FileName.replace(/_c_cc\.fit(s){0,1}$/, '_c_cc_r.fit');
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c_cc_b\.fit(s){0,1}$/, '_c_cc_b_r.fit'); //if ABE was run before
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c\.fit(s){0,1}$/, '_c_r.fit'); //if no CC and no ABE was run before
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c_b\.fit(s){0,1}$/, '_c_b_r.fit'); //if no CC and ABE was run before
            newFiles[i] = RegisteredOutputPath + '/' + newFileName;

            //Проверить - существует ли файл и стоит ли перезаписывать его
            if (Config.SkipExistingFiles && File.exists(newFiles[i])) {
                Console.warningln('File ' + newFileName + ' already exists, skipping Registration');
            } else {
                // Search for reference file
                if (!fileData)
                    var fileData = getFileHeaderData(files[i]); // Get FITS HEADER data if not got earlier
                if (!fileData) {
                    console.criticalln("Can't get File Header for Registration for " + files[i] + "!");
                    return false;
                }

                // Get reference for Registration
                var referenceFile = getRegistrationReferenceFile(fileData.object);
                if (!referenceFile) {
                    Console.warningln("Reference file was not found for object " + fileData.object + ". Skipping Registration");

                    if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER && this.NeedToCopyToFinalDirFlag) {
                        requestToCopy.push(files); //mark as final, because no further processing would be
                        this.NeedToCopyToFinalDirFlag = false;
                    }
                    //return files; // мне кажется, тут лучше вернуть false. Проверим
                    return false;
                }

                // Check if folder exists
                if (!File.directoryExists(RegisteredOutputPath))
                    File.createDirectory(RegisteredOutputPath, true);

                if (files.length > 1)
                    Console.noteln("Registering " + files[i]);

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
                P.noGUIMessages = true;
                P.inputHints = "";
                P.outputHints = "";
                P.mode = StarAlignment.prototype.RegisterMatch;
                P.writeKeywords = true;
                P.generateMasks = false;
                P.generateDrizzleData = false;
                P.frameAdaptation = false;

                P.outputPrefix = "";
                P.outputPostfix = "_r";
                P.maskPostfix = "_m";

                P.useFileThreads = true; //новое?
                P.fileThreadOverload = 1.20; //новое?
                P.maxFileReadThreads = 1; //новое?
                P.maxFileWriteThreads = 1; //новое?

                P.pixelInterpolation = StarAlignment.prototype.Auto;
                P.clampingThreshold = 0.30;

                P.useSurfaceSplines = true;
                P.splineSmoothness = 0.050;

                P.referenceImage = referenceFile;
                P.referenceIsFile = true;
                P.targets = [// enabled, isFile, image
                    [true, true, files[i]]
                ];

                P.outputDirectory = RegisteredOutputPath;
                P.outputExtension = ".fit";
                P.outputSampleFormat = StarAlignment.prototype.SameAsTarget;
                P.onError = StarAlignment.prototype.Continue;
                P.overwriteExistingFiles = Config.OverwriteAllFiles;

                if (coreVersionMajor > 1 || coreVersionMinor > 8 || coreVersionRelease >= 7) {
                    P.distortionModel = "";
                    P.undistortedReference = false;
                    P.distortionCorrection = true;
                    P.distortionMaxIterations = 100;
                    P.distortionTolerance = 0.001;

                    P.distortionAmplitude = 2;
                    P.localDistortion = false;
                    P.localDistortionScale = 256;
                    P.localDistortionTolerance = 0.050;
                    P.localDistortionRejection = 2.50;
                    P.localDistortionRejectionWindow = 64;
                    P.localDistortionRegularization = 0.010;
                    P.extrapolateLocalDistortion = true;

                    P.matcherTolerance = 0.0500;
                    P.ransacTolerance = 2.00;
                    P.ransacMaxIterations = 2000;
                    P.ransacMaximizeInliers = 1.00;
                    P.ransacMaximizeOverlapping = 1.00;
                    P.ransacMaximizeRegularity = 1.00;
                    P.ransacMinimizeError = 1.00;
                    P.maxStars = 0;
                    P.fitPSF = StarAlignment.prototype.FitPSF_Always;
                    P.psfTolerance = 0.50;
                    P.useTriangles = false;
                    P.polygonSides = 5;

                    P.descriptorsPerStar = 20;

                    P.restrictToPreviews = true;
                    P.intersection = StarAlignment.prototype.MosaicOnly;
                    P.useBrightnessRelations = false;
                    P.useScaleDifferences = false;
                    P.scaleTolerance = 0.100;

                    P.generateDistortionMaps = false;
                    P.randomizeMosaic = true;
                    P.distortionMapPostfix = "_dm";
                } else {
                    P.distortionModel = "";
                    P.undistortedReference = false;
                    P.distortionCorrection = true;
                    P.distortionMaxIterations = 100; // I use 20
                    P.distortionTolerance = 0.001; // i use 0.005

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

                }
                var status = P.executeGlobal();

                this.ProcessesCompleted++;
                this.RegisteredCount++;

                console.noteln("<end><cbr><br>",
                    "-------------------------------------------------------------");
                console.noteln(" [" + this.FileTotalCount + "] End of registration ");
                console.noteln("-------------------------------------------------------------");

            }

            if (File.exists(newFiles[i])) {
                // Добавим в массив файлов информацию о создании регистрируемого файла, что второй раз не делать
                var fn = "";
                if ((fn = newFiles[i].match(/(.+)\/(.+)_c_cc_r.fit(s){0,1}$/i)) != null
                        || (fn = newFiles[i].match(/(.+)\/(.+)_c_cc_b_r.fit(s){0,1}$/i)) != null
                        || (fn = newFiles[i].match(/(.+)\/(.+)_c_r.fit(s){0,1}$/i)) != null
                        || (fn = newFiles[i].match(/(.+)\/(.+)_c_b_r.fit(s){0,1}$/i)) != null
                   ) {
                    debug("path: " + fn[1], dbgNotice);
                    debug("matched: " + fn[2], dbgNotice);
                    debug("file is registered of " + fn[2], dbgNotice);

                    AddFileToArray(FITS.REGISTERED, newFiles[i], fn[2], fn[1]); //type, full name, signature, path
                } else {
                    debug("PATTERN NOT FOUND");
                }
            } else {
                return false;
            }

        }

        return newFiles;
    }

    /************************************************************************************************************
     * Нормализация фитов (1-3 в зависимости от был ли чб или цвет)
     *
     * @param
     * @return
     * @todo пачку фитов в одном процессе регистрировать
     */
    this.localNormalization = function (files) {
        if (files == false) {
            debug("Skipping Normalization", dbgNormal);
            return false;
        }

        if (!Config.NeedNormalization) {
            debug("Normalization is off", dbgNormal);
            if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER && this.NeedToCopyToFinalDirFlag) {
                requestToCopy.push(files);
                this.NeedToCopyToFinalDirFlag = false;
            }
            return files;
        }

        // Прервый всегда будет "файлом", даже если их много
        var file = files[0];

        // Start normalization
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| [" + this.FileTotalCount + "] Begin normalization of ", (files.length != 1 ? files.length + " files" : file));
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("localNormalization"); }

        // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
        debug("Need to normilize " + files.length + " file(s)", dbgNotice);

        // Set normalization folder
        NormalizedOutputPath = this.BaseCalibratedOutputPath;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            var fileData = getFileHeaderData(file); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            NormalizedOutputPath = NormalizedOutputPath + "/" + fileData.object;
        }
        NormalizedOutputPath = NormalizedOutputPath + "/" + Config.NormilizedFolderName;

        // Start normalization for all files
        var newFiles = []; //empty array
        for (var i = 0; i < files.length; i++) {

            // return new file name
            var FileName = File.extractName(files[i]) + '.' + fileExtension(files[i])
                var newFileName = FileName.replace(/_c_cc_r\.fit(s){0,1}$/, '_c_cc_r_n.fit');
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c_cc_b_r\.fit(s){0,1}$/, '_c_cc_b_r_n.fit'); //if ABE was run before
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c_r\.fit(s){0,1}$/, '_c_r_n.fit'); //if no CC no ABE was run before
            if (FileName === newFileName)
                var newFileName = FileName.replace(/_c_b_r\.fit(s){0,1}$/, '_c_b_r_n.fit'); //if no CC  was run before

            newFiles[i] = NormalizedOutputPath + '/' + newFileName;

            //Проверить - существует ли файл и стоит ли перезаписывать его
            if (Config.SkipExistingFiles && File.exists(newFiles[i])) {
                Console.warningln('File ' + newFileName + ' already exists, skipping normalization');
            } else {
                // Search for reference file
                if (!fileData)
                    var fileData = getFileHeaderData(files[i]); // Get FITS HEADER data if not got earlier
                if (!fileData) {
                    console.criticalln("Can't get File Header for Normalization for " + fileName + "!");
                    return false;
                }

                // Get reference for Normalization
                var referenceFile = getNormalizationReferenceFile(fileData.object, fileData.filter, fileData.exposure);
                if (!referenceFile) {
                    Console.warningln("Reference file was not found for object <b>" + fileData.object + "</b>, filter <b>" + fileData.filter + "</b> and exposure <b>" + fileData.exposure + "s</b>. Skipping LocalNormalization");
                    if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER && this.NeedToCopyToFinalDirFlag) {
                        requestToCopy.push(files);
                        this.NeedToCopyToFinalDirFlag = false; //this is final
                    }

                    return files;
                }

                // Check if folder exists
                if (!File.directoryExists(NormalizedOutputPath))
                    File.createDirectory(NormalizedOutputPath, true);

                if (files.length > 1)
                    Console.noteln("Normalization of " + files[i]);

				var P = new LocalNormalization;
				P.globalLocationNormalization = false;
				P.truncate = true;
				P.backgroundSamplingDelta = 32;
				P.rejection = true;
				P.referenceRejection = false;
				P.lowClippingLevel = 0.000045;
				P.highClippingLevel = 0.85;
				P.referenceRejectionThreshold = 3.00;
				P.targetRejectionThreshold = 3.20;
				P.hotPixelFilterRadius = 2;
				P.noiseReductionFilterRadius = 0;
				P.modelScalingFactor = 8.00;
				P.scaleEvaluationMethod = LocalNormalization.prototype.ScaleEvaluationMethod_PSFSignal;
				P.localScaleCorrections = true;
				P.psfStructureLayers = 5;
				P.saturationThreshold = 0.75;
				P.saturationRelative = true;
				P.rejectionLimit = 0.30;
				P.psfNoiseLayers = 1;
				P.psfHotPixelFilterRadius = 1;
				P.psfNoiseReductionFilterRadius = 0;
				P.psfMinStructureSize = 0;
				P.psfMinSNR = 40.00;
				P.psfAllowClusteredSources = true;
				P.psfType = LocalNormalization.prototype.PSFType_Auto;
				P.psfGrowth = 1.00;
				P.psfMaxStars = 24576;
				P.inputHints = "";
				P.outputHints = "";
				P.generateNormalizationData = false;
				P.generateInvalidData = false;
				P.showBackgroundModels = false;
				P.showLocalScaleModels = false;
				P.showRejectionMaps = false;
				P.showStructureMaps = false;
				P.plotNormalizationFunctions = LocalNormalization.prototype.PlotNormalizationFunctions_DontPlot;
				P.noGUIMessages = true;
				P.autoMemoryLimit = 0.85;
				P.overwriteExistingFiles = Config.OverwriteAllFiles;
				P.onError = LocalNormalization.prototype.OnError_Continue;
				P.useFileThreads = true;
				P.fileThreadOverload = 1.20;
				P.maxFileReadThreads = 0;
				P.maxFileWriteThreads = 0;
				P.graphSize = 1024;
				P.graphTextSize = 12;
				P.graphTitleSize = 18;
				P.graphTransparent = false;
				P.graphOutputDirectory = "";

				//Some overrides
				P.scale = Config.NormalizationScale;
				P.noScale = Config.NormalizationNoScaleFlag;
				P.referencePathOrViewId = referenceFile;
				P.targetItems = [// enabled, image
					[true, files[i]]
				];
				P.referenceIsView = false;
				P.generateNormalizedImages = LocalNormalization.prototype.GenerateNormalizedImages_GlobalExecutionOnly;
				P.outputDirectory = NormalizedOutputPath;
				P.outputExtension = ".fit";
				P.outputPrefix = "";
				P.outputPostfix = "_n";


                var status = P.executeGlobal();
                this.ProcessesCompleted++;
                this.NormalizedCount++;

                console.noteln("<end><cbr><br>",
                    "-------------------------------------------------------------");
                console.noteln(" [" + this.FileTotalCount + "] End of normalization ");
                console.noteln("-------------------------------------------------------------");
            }

            // Добавим в массив файлов информацию о создании нормализуемого файла, что второй раз не делал
            var fn = "";
            if ((fn = newFiles[i].match(/(.+)\/(.+)_c_cc_r_n.fit(s){0,1}$/i)) != null) {
                debug("path: " + fn[1], dbgNotice);
                debug("matched: " + fn[2], dbgNotice);
                debug("file is normalized of " + fn[2], dbgNotice);

                AddFileToArray(FITS.NORMALIZED, newFiles[i], fn[2], fn[1]); //type, full name, signature, path
            } else {
                debug("PATTERN NOT FOUND");
            }
        }

        if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER && this.NeedToCopyToFinalDirFlag) {
            requestToCopy.push(newFiles);
            this.NeedToCopyToFinalDirFlag = false; //Normalization is final
        }

        return false;
    }

    /************************************************************************************************************
     * Сохранить файл в список для последующей обработки SubframeSelector
     *
     * @param
     * @return
     */

	this.addFileForApproving = function (files)
	{
		if (files == false) {
            debug("Skipping approving", dbgNormal);
            return false;
        }

        if (!Config.NeedApproving) {
            debug("Approving is off", dbgNormal);
            return true;
        }

        // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
        debug("Need to approve " + files.length + " file(s)", dbgNotice);

        var file = files[0];


        // Start registration for all files
        for (var i = 0; i < files.length; i++) {
			this.approveFileList.push(files[i]);
			debug("Added to approve list <b>" + files[i] + "</b>", dbgNormal);
		}
		return true;
	}


    /************************************************************************************************************
     * Запуск SubframeSelector с сохранением результатов в processIcon
     *
     * @param
     * @return
     */
    this.runSubframeSelector = function () 
	{

        if (!Config.NeedApproving) {
            debug("Approving is off", dbgNormal);
            return true;
        }

        // Start approving
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| Begin approving of all files (total " + this.approveFileList.length + ")");
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("approvingFiles"); }

		// Assuming that all files are homogeous (i.e. have the same characteristics - same Object, same Scale, etc)
		// So we will calculate all data based on first in the list file header
		// @todo check that assumption is right
		file = this.approveFileList[1];
		var fileData = getFileHeaderData(file); // Get FITS HEADER data to know object name

        // Create normalization folder
        ApprovedOutputPath = this.BaseCalibratedOutputPath;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            var fileData = getFileHeaderData(file); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            ApprovedOutputPath = ApprovedOutputPath + "/" + fileData.object;
        }
        ApprovedOutputPath = ApprovedOutputPath + "/" + Config.ApprovedFolderName;

		// Check if folder exists
		if (!File.directoryExists(ApprovedOutputPath))
			File.createDirectory(ApprovedOutputPath, true);


		// Create filelist
		let filelist = [];
        for (var i = 0; i < this.approveFileList.length; i++) {
			/* P.subframes = [ // subframeEnabled, subframePath, localNormalizationDataPath, drizzlePath
				[true, "D:/DSlrRemote/+M104/Calibrated/cosmetized/M104_20180317_B_600s_1x1_-30degC_0.0degN_000006524_c_cc.fit", "", ""],
				[true, "D:/DSlrRemote/+M104/Calibrated/cosmetized/M104_20180317_B_600s_1x1_-30degC_0.0degN_000006524_c_cc.fit", "", ""]
			] */
			let fileArr = [true, this.approveFileList[i], "", ""];
			debug(fileArr, dbgNotice);

            filelist.push(fileArr);
		}

		// Create Process for measuring
        var P = new SubframeSelector;

        P.routine = SubframeSelector.prototype.MeasureSubframes;
		P.subframes = filelist;
		P.outputDirectory = ApprovedOutputPath;
		P.subframeScale = fileData.scale;
		P.cameraGain = fileData.EGain;
		P.fileCache = true;
		P.nonInteractive = true;
		P.weightingExpression = Config.SF_WeightingExpression;
		P.approvalExpression = Config.SF_ApprovedExpression; 
		P.cameraResolution = SubframeSelector.prototype.Bits16;
		P.scaleUnit = SubframeSelector.prototype.ArcSeconds;
		P.dataUnit = SubframeSelector.prototype.Electron;
		P.siteLocalMidnight = 24;
		P.structureLayers = 5;
		P.noiseLayers = 0;
		P.hotPixelFilterRadius = 1;
		P.applyHotPixelFilter = false;
		P.noiseReductionFilterRadius = 0;
		P.trimmingFactor = 0.10;
		P.minStructureSize = 0;
		P.sensitivity = 0.50; //new value?
		P.peakResponse = 0.50; //new value?
		P.brightThreshold = 3.00;
		P.maxDistortion = 0.60; //new value?
		P.allowClusteredSources = false;
		P.maxPSFFits = 8000;
		P.upperLimit = 1.0000;
		P.backgroundExpansion = 3;
		P.xyStretch = 1.5000;
		P.psfFit = SubframeSelector.prototype.Gaussian;
		P.psfFitCircular = false;
		P.pedestal = 0;
		P.roiX0 = 0;
		P.roiY0 = 0;
		P.roiX1 = 0;
		P.roiY1 = 0;
		P.inputHints = "";
		P.outputHints = "";
		P.outputExtension = ".fit";
		P.outputPrefix = "";
		P.outputPostfix = "_a";
		P.outputKeyword = "SSWEIGHT";
		P.pedestalMode = SubframeSelector.prototype.Pedestal_Keyword;
		P.pedestalKeyword = "";
		P.overwriteExistingFiles = true;
		P.onError = SubframeSelector.prototype.Continue;
		P.sortProperty = SubframeSelector.prototype.FWHM;
		P.graphProperty = SubframeSelector.prototype.FWHM
		P.auxGraphProperty = SubframeSelector.prototype.Eccentricity;;
		P.useFileThreads = true;
		P.fileThreadOverload = 1.00;
		P.maxFileReadThreads = 0;
		P.maxFileWriteThreads = 0;

		//debug(P.toSource(), dbgNotice);
		var status = P.executeGlobal();
		debug("SF execute status: " + status, dbgNotice);

		// Get Icon Name based on received file
		let iconName = "";
        if (file.match(/(.+)\/(.+)_c.fit(s){0,1}$/i) != null || file.match(/(.+)\/(.+)_c_cc.fit(s){0,1}$/i) != null) {
			iconName = Config.SF_IconName_beforeRegistration;
		} else if ( file.match(/(.+)\/(.+)_c_cc_b_r.fit(s){0,1}$/i) != null || file.match(/(.+)\/(.+)_c_cc_r.fit(s){0,1}$/i) != null) {
			iconName = Config.SF_IconName_afterRegistration;
        }

		// Save result in text file (just in case not to loose measurement results)
		writeTextFile (ApprovedOutputPath + "/SubframeSelectorMeasurement.src", P.toSource());
		
		// Save result in icon 
		P.writeIcon(iconName);

		return status;
    }

    /************************************************************************************************************
     * Debayer files
     *
     * WARNING Не тестировал работоспособность; не менял под конфигуратор, процедура осталась в оригинале
     *
     */
    function debayerSplitFit(file) {
        //return file; // @todo

        if (!file.cfa) {
            Console.writeln("File is not CFA, skipping debayering");
            return [file];
        } else {
            //ЗАГЛУШКА!!!
            Console.criticalln("File is CFA, but debayering wasn't tested, sorry!");
            return [file];
        }

        console.writeln('start to debayer fit: ' + file.dst);

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
                Config.OutputPath + '/' + file.object + '/' + file.filter + '/cc/' + file.dst + '_c_cc.fit');
        var sourceView = inputImageWindow[0].mainView;

        var status = P.executeOn(sourceView);

        inputImageWindow[0].close();

        var resultView = View.viewById(P.outputImage);

        // / debayer


        // splitRGB

        if (!File.directoryExists(Config.OutputPath + '/' + file.object + '/R/cc'))
            File.createDirectory(Config.OutputPath + '/' + file.object + '/R/cc', true);
        if (!File.directoryExists(Config.OutputPath + '/' + file.object + '/G/cc'))
            File.createDirectory(Config.OutputPath + '/' + file.object + '/G/cc', true);
        if (!File.directoryExists(Config.OutputPath + '/' + file.object + '/B/cc'))
            File.createDirectory(Config.OutputPath + '/' + file.object + '/B/cc', true);

        var imgW = resultView.image.width;
        var imgH = resultView.image.height;

        var red = new ImageWindow(imgW, imgH, 1, 16, false, false, "");
        var green = new ImageWindow(imgW, imgH, 1, 16, false, false, "");
        var blue = new ImageWindow(imgW, imgH, 1, 16, false, false, "");

        resultView.image.selectedChannel = 0;
        red.mainView.beginProcess(UndoFlag_NoSwapFile);
        red.mainView.image.assign(resultView.image);
        red.mainView.endProcess();
        red.saveAs(
            Config.OutputPath + '/' + file.object + '/R/cc/debayer_' + file.dst + '_R_c_cc.fit', false, false, false, false);

        resultView.image.selectedChannel = 1;
        green.mainView.beginProcess(UndoFlag_NoSwapFile);
        green.mainView.image.assign(resultView.image);
        green.mainView.endProcess();
        green.saveAs(
            Config.OutputPath + '/' + file.object + '/G/cc/debayer_' + file.dst + '_G_c_cc.fit', false, false, false, false);

        resultView.image.selectedChannel = 2;
        blue.mainView.beginProcess(UndoFlag_NoSwapFile);
        blue.mainView.image.assign(resultView.image);
        blue.mainView.endProcess();
        blue.saveAs(
            Config.OutputPath + '/' + file.object + '/B/cc/debayer_' + file.dst + '_B_c_cc.fit', false, false, false, false);

        //   resultView.window.saveAs(
        //      Config.OutputPath +'/'+ file.object +'/'+ file.filter +'/cc/deb_'+ file.dst +'_c_cc.fit'
        //      , false, false, false, false );

        resultView.window.forceClose();

        return [{
                object: file.object,
                filter: 'R',
                dst: 'debayer_' + file.dst + '_R',
            }, {
                object: file.object,
                filter: 'G',
                dst: 'debayer_' + file.dst + '_G',
            }, {
                object: file.object,
                filter: 'B',
                dst: 'debayer_' + file.dst + '_B',
            }
        ];
    }

    /************************************************************************************************************
     * Получение данных из заголовка фита
     *
     * @param file string
     * @return object
     */
    function getFileHeaderData(fileName) {

        //C:/ASTRO/_z/newton/2016-10-13/53P-Van-Biesbroeck-001-L-bin1-1m.fit
        console.writeln();
        console.note("Getting HeaderData for file: ");
        console.writeln("" + fileName);
        console.writeln();

        try
        {
             var image = ImageWindow.open(fileName)[0];
        }
        catch ( error )
        {
          this.inputImageWindow = null;
          console.criticalln( "WARNING: Unable to open image file: " + filePath + " (" + error.message + ")." );
          return false;
        }

        var keywords = image.keywords;
        for (var k in keywords) {

            if (typeof headers[keywords[k].name] != 'undefined') {
				keywords[k].trim();
                headers[keywords[k].name] = keywords[k].strippedValue;
                debug('header ' + keywords[k].name + '=' + keywords[k].strippedValue, dbgNotice);
            }
        }

        if (!headers.OBSERVER) {
            if (Config.UseObserverName) {
				console.criticalln('Can`t find Observer');
				return false;
			} else {
				console.warningln('Can`t find Observer');
			}
        }

        if (!headers.TELESCOP) {
            console.criticalln('Can`t find Telescope');
            return false;
        }

        if (!headers['DATE-OBS'] || !headers.EXPTIME) {
            console.criticalln('Can`t find Date or Exposure time');
            return false;
        }

        if (!headers['CCD-TEMP']) {
            console.criticalln('Can`t find CCD TEMP');
            return false;
        }

        if (!headers.FILTER || !headers.OBJECT || !headers.XBINNING) {
            console.criticalln('cant find Filter, Object or Binning');
            return false;
        }


        // Возьмем фильтр, заменим его по справочнику и затем переведем в UPCASE
        headers.FILTER = String.toUpperCase(headers.FILTER);
        if (typeof FILTERS_DICTIONARY[headers.FILTER] != 'undefined') {
            headers.FILTER = FILTERS_DICTIONARY[headers.FILTER];
        }
        var filter = String.toUpperCase(headers.FILTER);
        //debug('Filter name after normalization: '+ headers.FILTER +'',2);

        // Возьмем камеру, заменим его по справочнику
        var camera = headers.INSTRUME;
        if (typeof CAMERA_DICTIONARY[headers.INSTRUME] != 'undefined') {
            camera = CAMERA_DICTIONARY[headers.INSTRUME];
        }

        // Возьмем телескоп, заменим его по справочнику
        var telescope = headers.TELESCOP;
        if (typeof TELESCOP_DICTIONARY[headers.TELESCOP] != 'undefined') {
            telescope = TELESCOP_DICTIONARY[headers.TELESCOP];
        }

		// Сохраним геометрию
		var Width = image.mainView.image.width;
		var Height = image.mainView.image.height;


        image.close();

        // @todo date midnight / midday
        // @todo utc
        return {
            filename: fileName, // original file name
			instrument: (Config.UseObserverName ? headers.OBSERVER + '/' : '') + telescope, // was Vitar/MakF10 or (for me) just SW250
            camera: camera , // ArtemisHSC
            date: headers['DATE-OBS'].substr(0, "2017-01-01".length), // 2016-10-13
            time: headers['DATE-OBS'].substr("2017-01-01T".length, "00:00".length).replace(':', '_'), // 23_15
            name: fileName.split('/').reverse()[0], // pix-001.fit
            object: headers.OBJECT, // M106
            filter: filter, // L
            cfa: !!(
                (filter == 'RGGB') ||
                (filter == 'BGGR') ||
                (filter == 'GBRG') ||
                (filter == 'GRBG')),
            temp:           parseInt(headers['CCD-TEMP']), // 28 вместо 28.28131291
            bin:            parseInt(headers.XBINNING), // 1
            scale:          parseFloat(headers['XPIXSZ']) / parseFloat(headers['FOCALLEN']) * 206.265, //
			width :			Width,
			height:			Height,
            qhy:            (headers.GAIN && headers.READOUTM && headers.OFFSET), // true or false
            ReadOutMode:    headers.READOUTM,
            Gain:           headers.GAIN,
            EGain:          ( headers.EGAIN ? parseFloat(headers.EGAIN).toFixed(3) : 1.000 ),
            Offset:         headers.OFFSET,
            Overscan:       headers.QOVERSCN,
            Preset:         headers.QPRESET,
            USBLimit:       headers.USBLIMIT,
            duration:       parseInt(headers.EXPTIME), // 1800
            exposure:       parseInt(headers.EXPTIME) // dublicate for convinience
        };
    }

} //end of class
