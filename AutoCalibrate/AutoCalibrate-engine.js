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
    this.IntegratedCount = 0;
    this.ABECount = 0;
	this.BinnedCount = 0;

	this.approveFileList = [];
    this.integrationFallbackFiles = []; // Registered inputs retained after LN failure; Integration only.
	this.NSG_FileList= [];

    this.BaseCalibratedOutputPath = ""; //base path
    this.NeedToCopyToFinalDirFlag = false;

    this.CameraHeaders = new ProcessCameraHeaders();
    var fileHeaderCache = {}; // Successful header reads, scoped to this processing run.

	this.progressDialog = null;
	this.abortRequested = false;

	// =========================================================
    // 	Начало исполнения
    // =========================================================
    /**
     * Check cancellation requested by PixInsight, the progress dialog or the engine.
     * Once detected, cancellation remains latched for the current engine instance.
     * Takes no arguments. Does not log an error or add a failed-file status.
     * @return {Boolean} True when processing must stop.
     */
    this.isCancelled = function () {
        if (console.abortRequested || this.abortRequested ||
            (this.progressDialog && this.progressDialog.abortRequested))
            this.abortRequested = true;
        return this.abortRequested;
    };

    /**
     * Report a concise failed/skipped-processing status for a file or object/channel group.
     * Detailed diagnostics are logged by the caller. Cancellation produces no error status.
     * @param {String} target Input file path or object/channel group label.
     * @param {String} message Short status including the processing stage.
     * @return {undefined} Updates the progress dialog when present; does not alter stage results.
     */
    this.reportFailure = function (target, message) {
        if (this.isCancelled()) return;
        if (this.progressDialog) this.progressDialog.updateBar_Error(message, target);
    };

    this.Process = function (progressDialog) {
        if (Config.Workflow == "OSC_CFA_DRIZZLE") {
            console.criticalln("OSC CFA Drizzle workflow is not implemented yet. Select MONO or OSC.");
            return false;
        }
        //var T = new ElapsedTime;

		this.progressDialog = progressDialog;
        if (this.isCancelled()) return false;
        fileHeaderCache = {};
        this.approveFileList = []; // Shared final-frame queue for SFS and Integration.
        this.integrationFallbackFiles = [];
        this.IntegratedCount = 0;
        if (Config.SkipDirs.indexOf("Integrated") < 0) Config.SkipDirs.push("Integrated");

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
        console.noteln("  Integrate Images: " + Config.NeedIntegration);
        console.writeln();

        // Starting processing
        console.noteln('Starting script...');
        console.noteln();

        // Calc work
        this.calcWork(Config.InputPath);
        if (this.isCancelled()) return false;
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

		if (this.isCancelled()) return false;

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
        console.noteln("Binned: " + this.BinnedCount);
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
        // Final consumers include files completed during the second pass.
        if (this.isCancelled()) return false;
        this.runSubframeSelector();
        if (this.isCancelled()) return false;
        var integrationSucceeded = this.runIntegration();
        if (this.isCancelled()) return false;
        if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER)
            this.MoveMostAdvanced();
        //sleep(10);
		return integrationSucceeded;
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
        if (this.isCancelled()) return;
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
                     if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits' || fileExtension(objFileFind.name).toLowerCase() == 'xisf') && FileDirNameContains(objFileFind.name, Config.SkipFilesContains) !== true) {
                        this.FilesToProcessNum++;
                     }
                  }
                }
            } while (!this.isCancelled() && objFileFind.next());
        };
    };

    /* **************************************************************************************************************
     * Базовая функция для 1го прохода
     *
     * @param file string
     * @return object
     */
    this.searchDirectory = function (searchPath) {
        if (this.isCancelled()) return false;
        this.DirCount++;
        var FileCount = 0;
        console.noteln("<end><cbr><br>",
            "************************************************************");
        console.noteln('* ' + this.DirCount + ' of ' + this.DirsToProcessNum +'. Searching dir: ' + searchPath + ' for fits/xisf');
        console.noteln("************************************************************");

        if (!busy && !this.isCancelled()) {

            busy = true;
            needRefresh = false;
            var objFileFind = new FileFind;

            // Begin search
            if (objFileFind.begin(searchPath + "/*") && !this.isCancelled()) {
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
							if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits' || fileExtension(objFileFind.name).toLowerCase() == 'xisf') && FileDirNameContains(objFileFind.name, Config.SkipFilesContains) !== true) {

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
                                    console.noteln('* [' + this.FileTotalCount + ' of ' + this.FilesToProcessNum + ' (' + parseFloat(this.FileTotalCount/this.FilesToProcessNum*100).toFixed(1) +'%)] Start file processings: ' + searchPath + '/' + objFileFind.name);
                                    progressBar(this.FileTotalCount,this.FilesToProcessNum);
                                    console.noteln("  ETA: " + parseFloat(this.T.value/this.FileTotalCount*(this.FilesToProcessNum - this.FileTotalCount) / 60).toFixed(1) + " min, Elapsed: " + this.T.text +" sec");
                                    console.noteln("************************************************************");

                                    this.NeedToCopyToFinalDirFlag = true;

									if (this.isCancelled()) return false;

                                    // Process by the selected workflow using the existing nested pipeline.
                                    this.addFileForApproving(
                                        this.localNormalization(
                                            this.splitChannels(
                                                this.registerFits(
                                                    this.ABEprocess(
                                                        this.splitChannels(
                                                            this.debayerFit(
                                                                this.cosmeticFit(
                                                                    this.calibrateFITSFile(searchPath + '/' + objFileFind.name))), false))), true)));


                                }
                                else
                                {
                                    debug('Skipping any actions on file found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                                }
                            }
                        }
                    }
                } while (objFileFind.next() && !this.isCancelled());
            }

            busy = false;
        }
		return true;
    };


    /**
     * Resume missing stages in FILEARRAY using the existing processing order.
     * DEBAYERED, PRESPLIT and SPLIT store output paths. Source records link
     * their products; each product resumes after the stage that created it.
     * Updates stage records, output paths and the SubframeSelector queue.
     * @return {undefined} Stops early on abort and sets abortRequested.
     */
    this.ScanArray = function () {
        if (this.isCancelled()) return;

        console.noteln("<end><cbr><br>",
            "************************************************************");
        console.noteln('* Starting second pass');
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
            if (this.isCancelled()) {
                return;
            }

            // Ignore saved products belonging to another split order/workflow.
            var signature = FILEARRAY[i].fits;
            if (/_s_[RGB]$/i.test(signature) && !splitAfterRegistration()) continue;
            if (/_(?:p|d)_[RGB]$/i.test(signature) && (!isSplitEnabled() || splitAfterRegistration())) continue;
            if (Config.Workflow == "MONO" && /_d_RGB$/i.test(signature)) continue;
            var stageFailed = false;
            for (var property in FILEARRAY[i]) {
                if (property == "fits") {
                    console.noteln(" ************************************************************ ");
                    console.note("Fits from array <b>", FILEARRAY[i].fits, "</b> is ");
                } else {
                    var record = FILEARRAY[i];
                    if (/_s_[RGB]$/i.test(record.fits) && property != "normalized") continue;
                    var preSplitChannel = /_(?:p|d)_[RGB]$/i.test(record.fits);
                    if (preSplitChannel && (property == "fullname" || property == "calibrated" ||
                        property == "cosmetized" || property == "debayered" || property == "splitBefore")) continue;
                    var converted = /_d_RGB$/i.test(record.fits);
                    if (converted && (property == "fullname" || property == "calibrated" ||
                        property == "cosmetized" || property == "debayered")) continue;
                    if ((property == "calibrated" && !Config.NeedCalibration) ||
                        (property == "cosmetized" && !Config.NeedCosmeticCorrection) ||
                        (property == "debayered" && !isDebayerEnabled()) ||
                        (property == "splitBefore" && (!isSplitEnabled() || splitAfterRegistration())) ||
                        (property == "abed" && !Config.NeedABE) ||
                        (property == "registered" && !Config.NeedRegister) ||
                        (property == "split" && !splitAfterRegistration()) ||
                        (property == "normalized" && !Config.NeedNormalization)) continue;
                    if (isDebayerEnabled() && record.debayered && imageSignature(record.debayered[0]) != record.fits &&
                        (property == "splitBefore" || property == "abed" || property == "registered" || property == "split" || property == "normalized")) continue;
                    if (isSplitEnabled() && !splitAfterRegistration() && record.splitBefore && imageSignature(record.splitBefore[0]) != record.fits &&
                        (property == "abed" || property == "registered" || property == "split" || property == "normalized")) continue;
                    if (splitAfterRegistration() && property == "normalized" &&
                        record.split && imageSignature(record.split[0]) != record.fits) continue;
                    if (property == "normalized" && Config.NeedNormalization && Config.NormalizationGenerateData && FILEARRAY[i].normalized) {
                        var normalizationFiles = getNormalizationFiles(FILEARRAY[i].normalized);
                        if (!File.exists(normalizationFiles.data)) {
                            var normalizationBase = File.extractDrive(FILEARRAY[i].normalized) + File.extractDirectory(FILEARRAY[i].normalized);
                            normalizationBase = normalizationBase.substring(0, normalizationBase.lastIndexOf("/"));
                            if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER)
                                normalizationBase = normalizationBase.substring(0, normalizationBase.lastIndexOf("/"));
                            this.BaseCalibratedOutputPath = normalizationBase;
                            if (!normalizationFiles.image) {
                                console.criticalln("LocalNormalization: registered source is missing for " + FILEARRAY[i].normalized);
                                this.reportFailure(FILEARRAY[i].normalized, "LocalNormalization: registered source is missing for XNML generation");
                                if (Config.NeedIntegration && File.exists(FILEARRAY[i].normalized)) {
                                    console.warningln("Integration: XNML generation failed; using the existing normalized image with global normalization.");
                                    this.addFileForApproving([FILEARRAY[i].normalized]);
                                }
                                stageFailed = true;
                                break;
                            }
                            if (!this.localNormalization([normalizationFiles.image])) {
                                stageFailed = true;
                                break;
                            }
                        }
                    }
                    if (FILEARRAY[i][property] == null) {
                        // Возьмем предыдущий по конвейеру файл
                        var preceding = getFILEARRPrecedingName(property);
                        var inputs = FILEARRAY[i][preceding];
                        if (!inputs && (property == "debayered" || property == "splitBefore" || property == "abed" || property == "registered"))
                            inputs = (converted ? record.debayered : null) || record.cosmetized || record.calibrated || record.fullname;
                        var filename = Array.isArray(inputs) ? inputs[0] : inputs;
                        if (filename == null) {
                            if (property == "splitBefore") { stageFailed = true; break; }
                            continue;
                        }

                        console.noteln("missing <b>" + property + "</b>. Let's try to create it from <b>" + preceding + "</b>...");
                        console.noteln(" ************************************************************ ");

                        if (Config.PathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER)
                            this.BaseCalibratedOutputPath = Config.InputPath + "/" + Config.OutputPath;
                        else if (Config.PathMode == PATHMODE.ABSOLUTE)
                            this.BaseCalibratedOutputPath = Config.OutputPath;
                        else {
                            var directory = File.extractDrive(filename) + File.extractDirectory(filename);
                            if (filename != record.fullname) {
                                directory = directory.substring(0, directory.lastIndexOf("/"));
                                if (Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER)
                                    directory = directory.substring(0, directory.lastIndexOf("/"));
                            }
                            this.BaseCalibratedOutputPath = directory;
                        }
                        debug(this.BaseCalibratedOutputPath, dbgNormal);

                        // if missing CALIBRATED
                        if (property == getFILEARRPropertyName(FITS.CALIBRATED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;

                            // Process
                            var res = this.calibrateFITSFile(FILEARRAY[i][preceding]);
                            if (res === false) { stageFailed = true; break; }
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits, dbgNotice);
                        }
                        // if missing COSMETIZED
                        if (property == getFILEARRPropertyName(FITS.COSMETIZED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.cosmeticFit(FILEARRAY[i][preceding]);
                            if (res === false) { stageFailed = true; break; }
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        // Debayer records source and channel outputs in FILEARRAY.
                        if (property == "debayered") {
                            this.FileTotalCount++;
                            if (this.debayerFit(filename) === false) { stageFailed = true; break; }
                        }
                        if (property == "splitBefore") {
                            if (this.splitChannels(Array.isArray(inputs) ? inputs : [inputs], false) === false) { stageFailed = true; break; }
                        }
                        // if missing ABED
                        if (property == getFILEARRPropertyName(FITS.ABED) && inputs != null && Config.NeedABE) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.ABEprocess(Array.isArray(inputs) ? inputs : [inputs]);
                            if (res === false) { stageFailed = true; break; }
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        // if missing REGISTERED
                        if (property == getFILEARRPropertyName(FITS.REGISTERED) && inputs != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.registerFits(Array.isArray(inputs) ? inputs : [inputs]);
                            if (res === false) { stageFailed = true; break; }
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);
                        }
                        if (property == "split") {
                            if (this.splitChannels(Array.isArray(inputs) ? inputs : [inputs], true) === false) { stageFailed = true; break; }
                        }
                        // if missing NORMALIZED
                        if (property == getFILEARRPropertyName(FITS.NORMALIZED) && FILEARRAY[i][preceding] != null) {
                            this.FileTotalCount++;
                            // Process
                            var res = this.localNormalization(Array.isArray(inputs) ? inputs : [inputs]);
                            if (res === false) { stageFailed = true; break; }
                            // Check and modify array
                            if (checkFileNeedCalibratation_and_PopulateArray(res))
                                debug("Produced and added [" + property + "] for " + FILEARRAY[i].fits);

                        }
                    }

                }
            }
            var completed = FILEARRAY[i];
            if (!stageFailed && (!isDebayerEnabled() || !completed.debayered || imageSignature(completed.debayered[0]) == completed.fits) &&
                (!isSplitEnabled() || splitAfterRegistration() || !completed.splitBefore || imageSignature(completed.splitBefore[0]) == completed.fits) &&
                (!splitAfterRegistration() || !completed.split || imageSignature(completed.split[0]) == completed.fits)) {
                var latest = completed[getFILEARRPrecedingName("approved")];
                if (latest) this.addFileForApproving(Array.isArray(latest) ? latest : [latest]);
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
        if (this.isCancelled()) return false;
        var engine = this;
        print_array(requestToCopy);

        requestToCopy.forEach(function (element) {

            if (typeof element == 'string') {
                objelement[0] = element;
            } else {
                objelement = element;
            }

            for (var i = 0; i < objelement.length; i++) {
                if (engine.isCancelled()) return;
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
     * @param fullname      String|Array   путь файла; для DEBAYERED — массив путей результатов
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
                debayered:      (type == FITS.DEBAYERED ? fullname : null),
                splitBefore:    (type == FITS.PRESPLIT ? fullname : null),
                abed:           (type == FITS.ABED ? fullname : null),
                registered:     (type == FITS.REGISTERED ? fullname : null),
                split:          (type == FITS.SPLIT ? fullname : null),
                normalized:     (type == FITS.NORMALIZED ? fullname : null),
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
        if (Array.isArray(file)) {
            for (var i = 0; i < file.length; ++i)
                checkFileNeedCalibratation_and_PopulateArray(file[i]);
            return false;
        }
        if (!file) return false;
        var stage = file.match(/(.+)\/(.+?)_c(_cc)?(_b)?(_r)?(_n)?(_a)?\.(fit|fits|xisf)$/i);
        if (stage) {
            var type = stage[7] ? FITS.APPROVED : stage[6] ? FITS.NORMALIZED :
                stage[5] ? FITS.REGISTERED : stage[4] ? FITS.ABED :
                stage[3] ? FITS.COSMETIZED : FITS.CALIBRATED;
            if (/_s_[RGB]$/i.test(stage[2]) && type != FITS.NORMALIZED && type != FITS.APPROVED)
                AddFileToArray(FITS.SPLIT, [file], stage[2], stage[1]);
            else if (/_(?:p|d)_[RGB]$/i.test(stage[2]) &&
                (type == FITS.CALIBRATED || type == FITS.COSMETIZED))
                AddFileToArray(FITS.PRESPLIT, [file], stage[2], stage[1]);
            else if (/_d_RGB$/i.test(stage[2]) &&
                (type == FITS.CALIBRATED || type == FITS.COSMETIZED))
                AddFileToArray(FITS.DEBAYERED, [file], stage[2], stage[1]);
            else
                AddFileToArray(type, file, stage[2], stage[1]);
            return false;
        }
        var original = file.match(/(.+)\/(.+)\.(fit|fits|xisf)$/i);
        if (!original) return false;
        AddFileToArray(FITS.ORIGINAL, file, original[2], original[1]);
        return true;
    }

    /************************************************************************************************************
     * Калибровка фита с доступными мастерами bias, dark и flat.
     * Отсутствующие типы отключаются; если нет ни одного мастера, возвращается исходный файл.
     *
     * @param fileName string  полное имя файла.fit включая путь
     * @return string          полное имя файла_c.fit включая путь
     */
    this.calibrateFITSFile = function (fileName) {
        if (this.isCancelled()) return false;
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

        // Extract the file name without the extension
        var FileNameOnly = File.extractName(fileName);
        var correctExtension = getCorrectExtension(fileName);
        var newFileName = CalibratedOutputPath + '/' + FileNameOnly + '_c.xisf';        // current Pix version, after Huan have started ignoring .ouputExtension option
        var newFileName_old = CalibratedOutputPath + '/' + FileNameOnly + '_c.fit';     // for compatability, before Huan decided to ignore .ouputExtension option

        //Проверить - сущетсвует ли файл и стоит ли перезаписывать его
        if (Config.SkipExistingFiles && (File.exists(newFileName) || File.exists(newFileName_old))) {
            console.warningln('File ' + (File.exists(newFileName)? newFileName : newFileName_old) + ' already exists, skipping calibration');
        } else {

            if (!fileData)
                fileData = getFileHeaderData(fileName); // Get FITS HEADER data if not got earlier
            if (!fileData) {
                console.criticalln("Can't get File Header for Calibration for " + fileName + "!");
				this.reportFailure(fileName, "Can't get File Header");
                return false;
            }

            // Get Masters files names
            var mastersFiles = matchMasterCalibrationFiles(
                    Config.CalibratationMastersPath + (Config.UseObserverName && fileData.observer ? "/" + fileData.observer : "") + "/" + fileData.instrument + (Config.UseCameraName ? "/" + fileData.camera : "")
                        , fileData);

            if (!mastersFiles) {
                console.warningln("*** Skipping calibration because no matching calibration masters were found ***");
				this.reportFailure(fileName, "master calibration file(s) was not found");
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
				P.overscanImageX0 = CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x0; //24
				P.overscanImageY0 = CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y0; //0
				P.overscanImageX1 = CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x1; //9600
				P.overscanImageY1 = CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y1; //6388
				debug("Bin1: x0=" + CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x0 + ", y0=" + CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y0 + ", x1=" + CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].x1 + ", y1=" +CAMERA_OVERSCAN_MAIN_RECTANGLE[fileData.camera]["bin"+fileData.bin].y1, dbgNotice)
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

            P.masterBiasEnabled = !!mastersFiles.masterbias;
            P.masterBiasPath = mastersFiles.masterbias || "";

            P.masterDarkEnabled = !!mastersFiles.masterdark;
            P.masterDarkPath = mastersFiles.masterdark || "";

            P.masterFlatEnabled = !!mastersFiles.masterflat;
            P.masterFlatPath = mastersFiles.masterflat || "";

            P.calibrateBias = false;
            // With no bias master, subtract the dark including its bias offset.
            P.calibrateDark = P.masterDarkEnabled && P.masterBiasEnabled;
            P.calibrateFlat = false; // Master flats are already calibrated.

            // Scaling a dark containing a bias offset would also scale that offset.
            P.optimizeDarks = P.masterDarkEnabled && P.masterBiasEnabled;
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

            var status;
            try {
                status = P.executeGlobal();
            } catch (error) {
                if (this.isCancelled()) return false;
                throw error;
            }
            if (this.isCancelled()) return false;

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
				this.reportFailure(fileName, "ImageCalibration.executeGlobal() failed");

                return false;
            }

        }

        if (File.exists(newFileName)) {
            // Добавим в массив файлов информацию о создании калибровочного файла, что второй раз не делал
            var fn = "";
            if ((fn = newFileName.match(/(.+)\/(.+)_c\.(fit|fits|xisf)$/i)) != null) {
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
        if (this.isCancelled()) return false;

        if (fileName == false || !fileName.match(/(.+)\/(.+)_c\.(fit|fits|xisf)$/i)) {
            debug("Skipping Cosmetic Correction for input file: " + fileName, dbgNormal);
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
        var FileNameOnly = File.extractName(fileName);
        var newFileNameOnly = FileNameOnly.replace(/_c$/, '_c_cc');
        var newFileName = CosmetizedOutputPath + '/' + newFileNameOnly + '.xisf'         // current Pix version, after Huan have started ignoring .ouputExtension option
        var newFileName_old = CosmetizedOutputPath + '/' + newFileNameOnly + '.fit';     // for compatability, before Huan decided to ignore .ouputExtension option

        //debug("Config.SkipExistingFiles: " + + Config.SkipExistingFiles + ", newFileName: " + newFileName + ", newFileName_old: " + newFileName_old );

        //Проверить - существует ли файл и стоит ли перезаписывать его
        if (Config.SkipExistingFiles && (File.exists(newFileName) || File.exists(newFileName_old))) {
            console.warningln('File ' + (File.exists(newFileName)? newFileName : newFileName_old) + ' already exists, skipping cosmetic correction');
        } else {
            if (!fileData)
                var fileData = getFileHeaderData(fileName); // Get FITS HEADER data if not got earlier
            if (!fileData) {
                console.criticalln("Can't get File Header for Cosmetic Correction for " + fileName + "!");
				this.reportFailure(fileName, "Can't get File Header for Cosmetic Correction");

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
				this.reportFailure(fileName, "Cosmetic correction process icon: <b>" + ProcessIconName + "</b> not found");

                return fileName;
            }
            if (!(CC instanceof CosmeticCorrection)) {
                console.criticalln();
                console.criticalln("The specified icon does not an instance of CosmeticCorrection: <b>" + ProcessIconName + "</b>");
                console.criticalln("Skipping cosmetic correction");
                console.criticalln();
				this.reportFailure(fileName, "The specified icon does not an instance of CosmeticCorrection: <b>" + ProcessIconName + "</b>");
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

            var status;
            try {
                status = CC.executeGlobal();
            } catch (error) {
                if (this.isCancelled()) return false;
                throw error;
            }
            if (this.isCancelled()) return false;
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
            if ((fn = newFileName.match(/(.+)\/(.+)_c_cc\.(fit|fits|xisf)$/i)) != null) {

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
        if (this.isCancelled()) return false;
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
            if (this.isCancelled()) return false;
            // return new file name
            var FileNameOnly = File.extractName(files[i]);
            var newFileNameOnly = FileNameOnly.replace(/_c_cc$/, '_c_cc_b');
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c$/, '_c_b'); //if СС was not run before
            if (FileNameOnly === newFileNameOnly) newFileNameOnly = FileNameOnly + '_c_b';
            newFiles[i] = ABEOutputPath + '/' + newFileNameOnly + '.' + getCorrectExtension(files[i]);

            //Проверить - существует ли файл и стоит ли перезаписывать его
            if (Config.SkipExistingFiles && File.exists(newFiles[i])) {
                console.warningln('File ' + newFileNameOnly + ' already exists, skipping ABE');
            } else {

                // Check if folder exists
                if (!File.directoryExists(ABEOutputPath))
                    File.createDirectory(ABEOutputPath, true);

                if (files.length > 1)
                    console.noteln("Processing ABE " + files[i]);

                //Open file
                ImageWindow.open(files[i]);
                var w = ImageWindow.openWindows[ImageWindow.openWindows.length - 1];

                if (!w || w.isNull) {
                    console.criticalln("Error opening image file: " + files[i]);
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
                    var abeSucceeded;
                    try {
                        abeSucceeded = executeOn(w.mainView);
                    } catch (error) {
                        w.forceClose();
                        if (this.isCancelled()) return false;
                        throw error;
                    }
                    if (this.isCancelled() || !abeSucceeded) {
                        w.forceClose();
                        return false;
                    }
                    //
                    // save
                    //
                    if (!w.saveAs(newFiles[i], false, false, true, !Config.OverwriteAllFiles)) {
                        w.forceClose();
                        return false;
                    }
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
                checkFileNeedCalibratation_and_PopulateArray(newFiles[i]);
            } else {
                return false;
            }
        }

        return newFiles;
    }

    /************************************************************************************************************
     * Register each input with mode 1, optionally retrying unsuccessful frames once with mode 2.
     * Mode 1: sensitivity 0.50 and distortion correction; mode 2: 0.75 without it.
     * Confirms executeGlobal, outputData and the expected file before recording success.
     * Stops on abort; logs the successful mode and reports an error after all enabled attempts fail.
     *
     * @param {Array|Boolean} files Input paths or a failed previous stage.
     * @param {String} restoreDrizzleTarget Optional existing registered path to regenerate with XDRZ.
     * @return {Array|Boolean} Confirmed/reused registered paths, or false.
     *
     */
    this.registerFits = function (files, restoreDrizzleTarget) {
        if (this.isCancelled()) return false;
        if (files == false) {
            debug("Skipping Registration", dbgNormal);
            return false;
        }

        if (!Config.NeedRegister && !restoreDrizzleTarget) {
            debug("Registration is off", dbgNormal);
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
            if (this.isCancelled()) return false;
            // return new file name
            var FileNameOnly = File.extractName(files[i]);
            var newFileNameOnly = FileNameOnly.replace(/_c_cc$/, '_c_cc_r');
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_cc_b$/, '_c_cc_b_r'); //if ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c$/, '_c_r'); //if no CC and no ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_b$/, '_c_b_r'); //if no CC and ABE was run before
            if (FileNameOnly === newFileNameOnly) newFileNameOnly = FileNameOnly + '_c_r';
            newFiles[i] = RegisteredOutputPath + '/' + newFileNameOnly + '.' + getCorrectExtension(files[i]);



            //Проверить - существует ли файл и стоит ли перезаписывать его
            if (restoreDrizzleTarget) {
                newFiles[i] = restoreDrizzleTarget;
                newFileNameOnly = File.extractName(restoreDrizzleTarget);
                RegisteredOutputPath = File.extractDrive(restoreDrizzleTarget) + File.extractDirectory(restoreDrizzleTarget);
            }
            if (!restoreDrizzleTarget && Config.SkipExistingFiles && File.exists(newFiles[i])) {
                console.warningln('File ' + newFileNameOnly + '.' + getCorrectExtension(files[i]) + ' already exists, skipping Registration');
            } else {
                // Search for reference file
                var fileData = getFileHeaderData(files[i]); // Read each channel FILTER independently.
                if (!fileData) {
                    console.criticalln("Can't get File Header for Registration for " + files[i] + "!");
                    return false;
                }

                // Get reference for Registration
                var referenceFile = getRegistrationReferenceFile(fileData.object);
                if (!referenceFile) {
                    console.warningln("Reference file was not found for object " + fileData.object + ". Skipping Registration");


                    //return files; // мне кажется, тут лучше вернуть false. Проверим
                    return false;
                }

                // Check if folder exists
                if (!File.directoryExists(RegisteredOutputPath))
                    File.createDirectory(RegisteredOutputPath, true);

                if (files.length > 1)
                    console.noteln("Registering " + files[i]);

                var existedBeforeRegistration = File.exists(newFiles[i]);
                if (existedBeforeRegistration && !Config.OverwriteAllFiles && !restoreDrizzleTarget) {
                    console.criticalln("Registration output exists and overwrite is disabled: " + newFiles[i]);
                    return false;
                }
                var registered = false;
                var maxRegistrationAttempts = Config.RegistrationRetryMode2 ? 2 : 1;
                for (var attempt = 1; attempt <= maxRegistrationAttempts; ++attempt) {
                    if (this.isCancelled()) return false;
                    console.noteln("StarAlignment mode " + attempt + ": " + files[i]);
                    if (this.progressDialog) this.progressDialog.updateBar_NewProcess("StarAlignment (mode " + attempt + ")");
                    // A fresh instance prevents outputData from an earlier failed attempt being reused.
                    var P = new StarAlignment;
                    P.structureLayers = 5;
                    P.noiseLayers = 0;
                    P.hotPixelFilterRadius = 1;
                    P.noiseReductionFilterRadius = 0;
                    P.minStructureSize = 0;
                    P.sensitivity = attempt == 1 ? 0.50 : 0.75;
                    P.peakResponse = 0.50;
                    P.brightThreshold = 3.00;
                    P.maxStarDistortion = 0.60;
                    P.allowClusteredSources = false;
                    P.localMaximaDetectionLimit = 0.75;
                    P.upperLimit = 1.000;
                    P.invert = false;
                    P.distortionModel = "";
                    P.undistortedReference = false;
                    P.rigidTransformations = false;
                    P.distortionCorrection = attempt == 1;
                    P.distortionMaxIterations = 20;
                    P.distortionMatcherExpansion = 1.00;
                    P.rbfType = StarAlignment.prototype.DDMThinPlateSpline;
                    P.maxSplinePoints = 4000;
                    P.splineOrder = 2;
                    P.splineSmoothness = 0.005;
                    P.splineOutlierDetectionRadius = 160;
                    P.splineOutlierDetectionMinThreshold = 4.0;
                    P.splineOutlierDetectionSigma = 5.0;
                    P.matcherTolerance = 0.0500;
                    P.ransacTolerance = 1.9000;
                    P.ransacMaxIterations = 2000;
                    P.ransacMaximizeInliers = 1.00;
                    P.ransacMaximizeOverlapping = 1.00;
                    P.ransacMaximizeRegularity = 1.00;
                    P.ransacMinimizeError = 1.00;
                    P.maxStars = 0;
                    P.fitPSF = StarAlignment.prototype.FitPSF_DistortionOnly;
                    P.psfTolerance = 0.50;
                    P.useTriangles = false;
                    P.polygonSides = 5;
                    P.descriptorsPerStar = 20;
                    P.restrictToPreviews = true;
                    P.intersection = StarAlignment.prototype.MosaicOnly;
                    P.useBrightnessRelations = false;
                    P.useScaleDifferences = false;
                    P.scaleTolerance = 0.100;
                    P.referenceImage = referenceFile;
                    P.referenceIsFile = true;
                    P.targets = [[true, true, files[i]]];
                    P.inputHints = "";
                    P.outputHints = "";
                    P.mode = StarAlignment.prototype.RegisterMatch;
                    P.writeKeywords = true;
                    P.generateMasks = false;
                    P.generateDrizzleData = isDrizzleEnabled();
                    P.generateDistortionMaps = false;
                    P.generateHistoryProperties = true;
                    P.inheritAstrometricSolution = false;
                    P.frameAdaptation = false;
                    P.randomizeMosaic = false;
                    P.pixelInterpolation = StarAlignment.prototype.Auto;
                    P.clampingThreshold = 0.30;
                    P.outputDirectory = RegisteredOutputPath;
                    P.outputExtension = "." + getCorrectExtension(files[i]);
                    P.outputPrefix = "";
                    P.outputPostfix = newFileNameOnly.substring(FileNameOnly.length);
                    P.maskPostfix = "_m";
                    P.distortionMapPostfix = "_dm";
                    P.outputSampleFormat = StarAlignment.prototype.SameAsTarget;
                    P.overwriteExistingFiles = !!restoreDrizzleTarget || Config.OverwriteAllFiles;
                    P.onError = StarAlignment.prototype.Continue;
                    P.useFileThreads = true;
                    P.fileThreadOverload = 1.00;
                    P.maxFileReadThreads = 0;
                    P.maxFileWriteThreads = 0;
                    P.memoryLoadControl = true;
                    P.memoryLoadLimit = 0.85;

                    var status = false;
                    try {
                        status = P.executeGlobal();
                    } catch (error) {
                        if (this.isCancelled()) return false;
                        console.warningln("StarAlignment mode " + attempt + " failed: " + error.message);
                    }
                    if (this.isCancelled()) return false;
                    var output = P.outputData;
                    var reportedFile = output && output.length == 1 && output[0][0] ? String(output[0][0]) : "";
                    registered = status && reportedFile.replace(/\\/g, "/").toLowerCase() == newFiles[i].replace(/\\/g, "/").toLowerCase() && File.exists(newFiles[i]);
                    if (registered) {
                        console.noteln("StarAlignment succeeded in mode " + attempt + ": " + files[i]);
                        break;
                    }
                    // Remove only a new, unconfirmed output produced by this attempt.
                    // Pre-existing files remain subject to the user's overwrite setting.
                    if (!existedBeforeRegistration && File.exists(newFiles[i])) {
                        try {
                            File.remove(newFiles[i]);
                        } catch (cleanupError) {
                            console.criticalln("Unable to remove failed registration output: " + newFiles[i] + ": " + cleanupError.message);
                            return false;
                        }
                    }
                    if (this.isCancelled()) return false;
                    if (attempt < maxRegistrationAttempts)
                        console.warningln("StarAlignment mode 1 produced no confirmed result; retrying in mode 2: " + files[i]);
                }
                this.ProcessesCompleted++;
                if (!registered) {
                    var registrationError = maxRegistrationAttempts == 2 ? "StarAlignment failed in both modes" : "StarAlignment failed in mode 1";
                    console.criticalln(registrationError + ": " + files[i]);
                    this.reportFailure(files[i], registrationError);
                    return false;
                }
                this.RegisteredCount++;
                console.noteln("<end><cbr><br>",
                    "-------------------------------------------------------------");
                console.noteln(" [" + this.FileTotalCount + "] End of registration ");
                console.noteln("-------------------------------------------------------------");


            }

            if (File.exists(newFiles[i])) {
                // Добавим в массив файлов информацию о создании регистрируемого файла, что второй раз не делать
                checkFileNeedCalibratation_and_PopulateArray(newFiles[i]);
            } else {
                return false;
            }

        }

        return newFiles;
    }

    /**
     * Locate the registered source and canonical XNML path for a registered/normalized frame.
     * Normalized outputs retain their source basename plus _n. FILEARRAY supplies the source
     * when available; sibling registered/split folders cover ready files from earlier runs.
     * @param {String} file Registered (_r) or normalized (_r_n) image path.
     * @return {Object} image is the registered source (or empty if absent); data is its XNML path.
     */
    function getNormalizationFiles(file) {
        var directory = (File.extractDrive(file) + File.extractDirectory(file)).replace(/\\/g, "/");
        var parent = directory.substring(0, directory.lastIndexOf("/"));
        var name = File.extractName(file);
        var normalized = /_r_n$/i.test(name);
        var sourceName = normalized ? name.replace(/_n$/i, "") : name;
        var normDirectory = normalized ? directory : parent + "/" + Config.NormilizedFolderName;
        var source = normalized ? "" : file;
        if (normalized) {
            for (var i = 0; i < FILEARRAY.length && !source; ++i) {
                if (FILEARRAY[i].normalized != file) continue;
                var candidates = FILEARRAY[i].split || FILEARRAY[i].registered || [];
                if (!Array.isArray(candidates)) candidates = [candidates];
                for (var j = 0; j < candidates.length; ++j)
                    if (File.extractName(candidates[j]) == sourceName && File.exists(candidates[j])) {
                        source = candidates[j];
                        break;
                    }
            }
            if (!source) {
                var extension = File.extractNameAndExtension(file).substring(name.length);
                var folders = [Config.RegisteredFolderName, Config.SplitFolderName];
                for (var j = 0; j < folders.length; ++j) {
                    var candidate = parent + "/" + folders[j] + "/" + sourceName + extension;
                    if (File.exists(candidate)) { source = candidate; break; }
                }
            }
        }
        return {image: source, data: normDirectory + "/xnml/" + sourceName + ".xnml"};
    }

    /************************************************************************************************************
     * Normalize registered RGB or individual channels and report failures in the progress dialog.
     *
     * @param {Array|Boolean} files Registered paths or a failed upstream stage.
     * @return {Array|Boolean} Confirmed/reused normalized paths, or false on failure/abort.
     * Records only valid completed outputs. On LN failure, retains registered inputs for Integration.
     * Removes newly created unconfirmed files to allow a clean second-pass retry.
     * @todo пачку фитов в одном процессе регистрировать
     */
    this.localNormalization = function (files) {
        if (this.isCancelled()) return false;

        if (!Config.NeedNormalization || files == false) {
            debug("Skipping Normalization", dbgNormal);
            return false;
        }

        // Прервый всегда будет "файлом", даже если их много
        var file = files[0];
        var engine = this, incompleteOutput = null;
        
        /**
         * Report one failed normalization input to the console and progress dialog.
         * @param {String} message Failure reason.
         * @param {String} currentFile Input path shown beside the message.
         * @return {Boolean} False stops the LN branch; registered inputs are retained separately for Integration.
         */
        function normalizationError(message, currentFile) {
            console.criticalln("LocalNormalization: " + message + ": " + currentFile);
            engine.reportFailure(currentFile, "LocalNormalization: " + message);
            if (Config.NeedIntegration && !engine.isCancelled()) {
                for (var i = 0; i < files.length; ++i) {
                    if (/_r$/i.test(File.extractName(files[i])) && File.exists(files[i]) &&
                        engine.integrationFallbackFiles.indexOf(files[i]) < 0)
                        engine.integrationFallbackFiles.push(files[i]);
                }
                console.warningln("Integration: LocalNormalization failed; available registered frames will be integrated with global normalization.");
            }
            return false;
        }

        try {
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
                if (!fileData) return normalizationError("Unable to read image header", file);
                fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
                NormalizedOutputPath = NormalizedOutputPath + "/" + fileData.object;
            }
            NormalizedOutputPath = NormalizedOutputPath + "/" + Config.NormilizedFolderName;

            // Start normalization for all files
            var newFiles = []; //empty array
            for (var i = 0; i < files.length; i++) {
                if (this.isCancelled()) return false;
                file = files[i];

                // return new file name
                var FileNameOnly = File.extractName(files[i]);
                var newFileNameOnly = FileNameOnly.replace(/_c_cc_r$/, '_c_cc_r_n');
                if (FileNameOnly === newFileNameOnly)
                    var newFileNameOnly = FileNameOnly.replace(/_c_cc_b_r$/, '_c_cc_b_r_n'); //if ABE was run before
                if (FileNameOnly === newFileNameOnly)
                    var newFileNameOnly = FileNameOnly.replace(/_c_r$/, '_c_r_n'); //if no CC and no ABE was run before
                if (FileNameOnly === newFileNameOnly)
                    var newFileNameOnly = FileNameOnly.replace(/_c_b_r$/, '_c_b_r_n'); //if no CC and ABE was run before
                if (FileNameOnly === newFileNameOnly) {
                    return normalizationError("Input is not registered (_r suffix missing)", files[i]);
                }
                newFiles[i] = NormalizedOutputPath + '/' + newFileNameOnly + '.' + getCorrectExtension(files[i]);

                var normalizationDataPath = NormalizedOutputPath + "/xnml/" + FileNameOnly + ".xnml";
                var dataOnly = Config.SkipExistingFiles && File.exists(newFiles[i]);
                // Reuse only when all requested LN outputs are present.
                if (dataOnly && (!Config.NormalizationGenerateData || File.exists(normalizationDataPath))) {
                    console.warningln('File ' + newFiles[i] + ' already exists, skipping normalization');
                } else {
                    // Search for reference file
                    var fileData = getFileHeaderData(files[i]); // Read each channel FILTER independently.
                    if (!fileData) {
                        return normalizationError("Unable to read image header", files[i]);
                    }

                    // Get reference for Normalization
                    var normalizationFilter = fileData.isColor ? "RGB" : fileData.filter;
                    var referenceFile = getNormalizationReferenceFile(fileData.object, normalizationFilter, fileData.exposure);
                    if (!referenceFile) {
                        return normalizationError("Reference not found for object " + fileData.object + ", filter " + normalizationFilter +
                            (Config.StrictNormalization ? ", exposure " + fileData.exposure + "s" : ""), files[i]);
                    }

                    // Check if folder exists
                    if (!File.directoryExists(NormalizedOutputPath))
                        File.createDirectory(NormalizedOutputPath, true);

                    if (files.length > 1)
                        console.noteln("Normalization of " + files[i]);

                    var P = new LocalNormalization; // Shared parameters; scale evaluation is selected in the UI.
                    P.globalLocationNormalization = false;
                    P.localScaleCorrections = false;
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
                    P.scaleEvaluationMethod = Config.NormalizationUsePSF
                        ? LocalNormalization.prototype.ScaleEvaluationMethod_PSFSignal
                        : LocalNormalization.prototype.ScaleEvaluationMethod_MultiscaleAnalysis;
                    console.noteln("LocalNormalization scale evaluation: " + (Config.NormalizationUsePSF ? "PSF Signal" : "Multiscale Analysis"));
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
                    P.generateNormalizationData = Config.NormalizationGenerateData;
                    P.generateInvalidData = false;
                    P.generateHistoryProperties = true;
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
                    P.generateNormalizedImages = dataOnly
                        ? LocalNormalization.prototype.GenerateNormalizedImages_ViewExecutionOnly
                        : LocalNormalization.prototype.GenerateNormalizedImages_GlobalExecutionOnly;
                    P.outputDirectory = NormalizedOutputPath;
                    P.outputExtension = "." + getCorrectExtension(files[i]);
                    P.outputPrefix = "";
                    P.outputPostfix = "_n";

                    var outputExistedBefore = File.exists(newFiles[i]);
                    if (outputExistedBefore && !dataOnly && !Config.OverwriteAllFiles)
                        return normalizationError("Output exists and overwrite is disabled: " + newFiles[i], files[i]);
                    if (Config.NormalizationGenerateData && File.exists(normalizationDataPath) && !Config.OverwriteAllFiles)
                        return normalizationError("XNML exists and overwrite is disabled: " + normalizationDataPath, files[i]);
                    incompleteOutput = outputExistedBefore ? null : newFiles[i];
                    var status;
                    
                    // Запуск
                    try {
                        status = P.executeGlobal();
                    } catch (error) {
                        if (this.isCancelled()) return false;
                        throw error;
                    }
                    
                    if (this.isCancelled()) return false;
                    if (!status) return normalizationError("Process execution failed", files[i]);
                    
                    var output = P.outputData;
                    if (!output || output.length != 1)
                        return normalizationError("Process did not report a normalization result", files[i]);
                    if (!output[0][5]) return normalizationError("Process reported an invalid normalization result", files[i]);
                    if (!dataOnly) {
                        var reportedFile = output[0][1] ? String(output[0][1]).replace(/\\/g, "/").toLowerCase() : "";
                        if (reportedFile != newFiles[i].replace(/\\/g, "/").toLowerCase() || !File.exists(newFiles[i]))
                            return normalizationError("Expected normalized image was not created: " + newFiles[i], files[i]);
                    }
                    if (Config.NormalizationGenerateData) {
                        var generatedData = output[0][0] ? String(output[0][0]) : "";
                        if (!generatedData || !File.exists(generatedData))
                            return normalizationError("XNML data was not created", files[i]);
                        var dataDirectory = NormalizedOutputPath + "/xnml";
                        if (!File.directoryExists(dataDirectory)) File.createDirectory(dataDirectory, true);
                        if (generatedData.replace(/\\/g, "/").toLowerCase() != normalizationDataPath.replace(/\\/g, "/").toLowerCase()) {
                            if (File.exists(normalizationDataPath)) File.remove(normalizationDataPath);
                            File.move(generatedData, normalizationDataPath);
                        }
                        console.noteln("LocalNormalization data saved: " + normalizationDataPath);
                    }
                    
                    incompleteOutput = null;
                    this.ProcessesCompleted++;
                    this.NormalizedCount++;

                    console.noteln("<end><cbr><br>",
                        "-------------------------------------------------------------");
                    console.noteln(" [" + this.FileTotalCount + "] End of normalization ");
                    console.noteln("-------------------------------------------------------------");
                }

                // Добавим в массив файлов информацию о создании нормализуемого файла, что второй раз не делал
                checkFileNeedCalibratation_and_PopulateArray(newFiles[i]);
            }

            return newFiles;
        } catch (error) {
            if (this.isCancelled()) return false;
            return normalizationError(error.message || String(error), file);
        } finally {
            // A new unconfirmed output must not be reused as successful on the second pass.
            if (incompleteOutput && File.exists(incompleteOutput)) {
                try {
                    File.remove(incompleteOutput);
                } catch (cleanupError) {
                    console.warningln("Unable to remove incomplete normalization output: " + incompleteOutput + ": " + cleanupError.message);
                }
            }
        }
    }


    /************************************************************************************************************
     * Сохранить файл в список для последующей обработки SubframeSelector
     *
     * @param {Array|Boolean} files Completed pipeline outputs or failure.
     * @return {Boolean} True when outputs are accepted; false on failure/abort.
     * Queues unique final paths for copying and the shared SubframeSelector/Integration consumers.
     */

	this.addFileForApproving = function (files)
	{
        if (this.isCancelled()) return false;
		if (files == false) {
            debug("Skipping approving", dbgNormal);
            return false;
        }

        if (Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            for (var f = 0; f < files.length; ++f) {
                var queued = false;
                for (var q = 0; q < requestToCopy.length; ++q)
                    if (requestToCopy[q].indexOf(files[f]) >= 0) { queued = true; break; }
                if (!queued) requestToCopy.push([files[f]]);
            }
        }
        if (!Config.NeedApproving && !Config.NeedIntegration) {
            debug("SubframeSelector and Integration are off", dbgNormal);
            return true;
        }


        // Includes all final RGB/channel paths, regardless of which consumer is enabled.
        debug("Completed frames: " + files.length + " file(s)", dbgNotice);

        //var file = files[0];

        // Start registration for all files
        for (var i = 0; i < files.length; i++) {
            if (this.isCancelled()) return false;
			if (this.approveFileList.indexOf(files[i]) < 0)
                this.approveFileList.push(files[i]);
			debug("Added to approve list <b>" + files[i] + "</b>", dbgNormal);
		}
		return true;
	}


    /**
     * Integrate the completed files shared with SubframeSelector, grouped by object/filter.
     * Uses registered or normalized inputs, Average with selected weights and additive scaling.
     * Saves a master and both rejection maps per group; continues after a group failure.
     * @return {Boolean} True when every group succeeded; false on errors/abort.
     */
    /** Return whether ordinary (non-CFA) Drizzle is requested for a supported workflow. */
    function isDrizzleEnabled() {
        return Config.IntegrationMethod == "drizzle-integration" && (Config.Workflow == "MONO" ||
            (Config.Workflow == "OSC" && (!Config.SplitChannels || Config.OSCSplitStage == "before-registration")));
    }

    /** Return the XDRZ sidecar path corresponding to a registered image. */
    function drizzlePath(file) {
        return File.extractDrive(file) + File.extractDirectory(file) + "/" + File.extractName(file) + ".xdrz";
    }

    /** Locate the pre-registration input among recorded processing products. Never align an _r image again. */
    function registrationSource(registered) {
        var name = File.extractName(registered).replace(/_r$/i, "");
        for (var i = 0; i < FILEARRAY.length; ++i) {
            for (var key in FILEARRAY[i]) {
                var values = FILEARRAY[i][key];
                if (!Array.isArray(values)) values = [values];
                for (var j = 0; j < values.length; ++j) {
                    var candidate = values[j];
                    if (typeof candidate != "string" || !File.exists(candidate)) continue;
                    var candidateName = File.extractName(candidate);
                    if (!/_r(?:_n)?$/i.test(candidateName) &&
                        (candidateName == name || candidateName + "_c" == name)) return candidate;
                }
            }
        }
        return "";
    }

    /** Execute Drizzle for one prepared group and save a master plus coverage map under a free index.
     * @return {String} Saved master path. Native/save errors propagate to the group's fallback handler.
     */
    this.drizzleIntegration = function (group, targets, useLN) {
        
        var process = new DrizzleIntegration;
        process.inputData = targets.map(function (row) { return [true, row[2], useLN ? row[3] : ""]; });
        process.scale = Config.DrizzleScale;
        process.dropShrink = Config.DrizzleDropShrink;
        process.enableCFA = false;
        process.enableRejection = true;
        process.enableImageWeighting = true;
        process.enableLocalNormalization = useLN;
        var stem = group.outputs[2].replace(/_master(?:_\d+)?\.xisf$/i, "_drizzle");
        var index = 0, paths;
        do {
            var suffix = index ? "_" + index : "";
            paths = [stem + "_master" + suffix + ".xisf", stem + "_weights" + suffix + ".xisf"];
            ++index;
        } while (paths.some(function (file) { return File.exists(file); }));
        try {
            if (this.isCancelled()) return "";
            console.noteln("<end><cbr><br>-------------------------------------------------------------");
            console.noteln("| DrizzleIntegration: " + group.data.object + " / " + group.data.filter);
            console.noteln("-------------------------------------------------------------");
            if (this.progressDialog) this.progressDialog.updateBar_NewProcess("DrizzleIntegration");
            if (!process.executeGlobal()) throw new Error("DrizzleIntegration failed");
            if (this.isCancelled()) return "";
            var ids = [process.integrationImageId, process.weightImageId];
            for (var i = 0; i < ids.length; ++i) {
                var window = ImageWindow.windowById(ids[i]);
                if (!window || window.isNull) throw new Error("Drizzle output is unavailable");
                if (!i) {
                    window.keywords = window.keywords.filter(function (k) { return k.name != "OBJECT" && k.name != "FILTER"; });
                    var keywords = window.keywords;
                    keywords.push(new FITSKeyword("OBJECT", "'" + group.data.object.replace(/'/g, "''") + "'", "Integration object"));
                    keywords.push(new FITSKeyword("FILTER", "'" + group.data.filter.replace(/'/g, "''") + "'", "Integration filter"));
                    window.keywords = keywords;
                }
                if (!window.saveAs(paths[i], false, false, false, false)) throw new Error("Unable to save " + paths[i]);
            }
            console.noteln("Drizzle master saved: " + paths[0]);
            return paths[0];
        } finally {
            var ids = [process.integrationImageId, process.weightImageId];
            for (var i = 0; i < ids.length; ++i) if (ids[i]) {
                var window = ImageWindow.windowById(ids[i]);
                if (window && !window.isNull) window.forceClose();
            }
        }
    };

    this.runIntegration = function () {
        if (this.isCancelled()) return false;
        if (!Config.NeedIntegration) return true;
        var groups = [], seen = {}, outputOwners = {}, mastersToShow = [];
        var fallbackFiles = this.integrationFallbackFiles || [];
        var integrationFiles = this.approveFileList.concat(fallbackFiles);
        var success = true, inputErrors = 0;
        this.IntegratedCount = 0;

        /** Return a safe filename component; collisions are checked before processing groups. */
        function pathComponent(value) {
            var result = value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "_");
            if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(result)) result = "_" + result;
            return result || "_";
        }

        if (this.isCancelled()) return false;
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| Begin grouping files for Integration (total " + integrationFiles.length + ")");
        console.noteln("-------------------------------------------------------------");
        if (!integrationFiles.length) {
            success = false;
            console.criticalln("Integration: " + "No completed frames to integrate" + " [" + Config.InputPath + "]");
            this.reportFailure("Integration", "Integration failed: " + "no completed frames");
            return false;
        }
        // Relative per-file processing modes still collect masters under the input root.
        var base = Config.InputPath.replace(/\\/g, "/").replace(/\/+$/, "");
        if (Config.PathMode == PATHMODE.ABSOLUTE) base = Config.OutputPath;
        else if (Config.PathMode == PATHMODE.PUT_IN_ROOT_SUBFOLDER || Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER ||
                 Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) base += "/" + Config.OutputPath;
        base = base.replace(/\\/g, "/").replace(/\/+$/, "");

        if (this.progressDialog) this.progressDialog.updateBar_NewProcess("Integration: grouping");
        for (var f = 0; f < integrationFiles.length; ++f) {
            if (this.isCancelled()) return false;
            var file = integrationFiles[f];
            var sourcePair = getNormalizationFiles(file);
            if (!File.exists(file) && sourcePair.image && File.exists(sourcePair.image)) {
                console.warningln("Integration: normalized image is missing; using registered source: " + sourcePair.image);
                file = sourcePair.image;
                if (fallbackFiles.indexOf(file) < 0) fallbackFiles.push(file);
            }
            // A successful second-pass LN result replaces the same exposure's fallback input.
            var fileKey = "$" + (sourcePair.image || file).replace(/\\/g, "/").toLowerCase();
            if (seen[fileKey]) continue;
            seen[fileKey] = true;
            try {
                /* Проверки, а есть ли файл */
                if (!File.exists(file)) throw new Error("Input file does not exist");
                if (!/_r(?:_n)?$/i.test(File.extractName(file)))
                    throw new Error("Expected a registered (_r) or normalized (_r_n) frame");

                var data = getFileHeaderData(file, true);

                /* Проверки данных */
                if (!data) throw new Error("Unable to read input metadata");
                if (!data.object) throw new Error("OBJECT is missing");
                if (!data.isColor && (data.cfa || data.cfaFromMetadata))
                    throw new Error("CFA input must be debayered before integration");
                if (data.numberOfChannels != (data.isColor ? 3 : 1))
                    throw new Error("Only monochrome and RGB images without alpha channels are supported");
                if (data.isColor) data.filter = "RGB";
                else if (!data.filter) throw new Error("FILTER is missing for a monochrome frame");


                var key = JSON.stringify([data.object.toUpperCase(), data.filter, data.isColor]);
                var group = null;
                for (var g = 0; g < groups.length; ++g) if (groups[g].key == key) { group = groups[g]; break; }
                if (!group) {
                    group = {key: key, data: data, files: [], invalid: false};
                    group.directory = base + "/Integrated";
                    var stem = group.directory + "/" + pathComponent(data.object) + "_" + pathComponent(data.filter);
                    group.outputs = [stem + "_rejection_low.xisf", stem + "_rejection_high.xisf", stem + "_master.xisf"];
                    var outputKey = "$" + stem.toLowerCase();
                    if (outputOwners[outputKey]) {
                        group.invalid = outputOwners[outputKey].invalid = true;
                        group.failureReason = outputOwners[outputKey].failureReason = "output name collision";
                        success = false;
                        console.criticalln("Integration: " + "Different groups resolve to the same output name" + " [" + stem + "]");
                    } else outputOwners[outputKey] = group;
                    groups.push(group);
                }
                if (data.width != group.data.width || data.height != group.data.height) {
                    group.invalid = true;
                    group.failureReason = "incompatible image dimensions";
                    success = false;
                    console.criticalln("Integration: " + "Incompatible image dimensions in object/filter group" + " [" + file + "]");
                }
                group.files.push(file);
            } catch (error) {
                if (this.isCancelled()) return false;
                ++inputErrors;
                success = false;
                console.criticalln("Integration: " + error.message + " [" + file + "]");
            }
        }
        if (inputErrors) this.reportFailure("Integration", "Integration failed: " + inputErrors + " input frame(s) could not be prepared; see console");

        console.noteln("Grouping complete: " + groups.length + " object/filter group(s), " + inputErrors + " input error(s)");
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| Begin ImageIntegration (total " + groups.length + " groups)");
        console.noteln("-------------------------------------------------------------");
        if (this.progressDialog) this.progressDialog.initBar(Config.InputPath, groups.length);
        for (var g = 0; g < groups.length; ++g) {
            if (this.isCancelled()) return false;
            var group = groups[g], label = group.data.object + " / " + group.data.filter;
            console.noteln("<end><cbr><br>",
                "-------------------------------------------------------------");
            console.noteln("| [" + (g + 1) + "/" + groups.length + "] ImageIntegration: " + label + " (" + group.files.length + " frames)");
            console.noteln("-------------------------------------------------------------");
            var process = null;
            var failureReason = "unable to prepare output files; see console";
            if (this.progressDialog) {
                this.progressDialog.updateBar_NewFile(g + 1, label + " (" + group.files.length + " frames)");
                this.progressDialog.updateBar_NewProcess("Integration");
            }
            if (group.invalid) {
                this.reportFailure(label, "Integration failed: " + group.failureReason);
                continue;
            }
            if (group.files.length < 3) {
                success = false;
                console.criticalln("Integration: " + "At least 3 frames are required; found " + group.files.length + " [" + label + "]");
                this.reportFailure(label, "Integration failed: " + "at least 3 frames required; found " + group.files.length);
                continue;
            }
            try {
                // Reserve one free index for the master and both maps; never reuse/overwrite older sums.
                var originalOutputs = group.outputs.slice(), outputIndex = 0;
                while (group.outputs.some(function (file) { return File.exists(file); })) {
                    if (this.isCancelled()) return false;
                    ++outputIndex;
                    group.outputs = originalOutputs.map(function (file) {
                        return file.replace(/\.xisf$/i, "_" + outputIndex + ".xisf");
                    });
                }
                if (outputIndex) console.noteln("Integration: saving a new output set with index " + outputIndex + " for " + label);
                if (!File.directoryExists(group.directory))
                    File.createDirectory(group.directory, true);


                console.noteln("Integration: " + label + ", " + group.files.length + " frames");

                process = new ImageIntegration;
                var normalizationPairs = [], dataCount = 0;
                for (var i = 0; i < group.files.length; ++i) {
                    var pair = getNormalizationFiles(group.files[i]);
                    normalizationPairs.push(pair);
                    if (File.exists(pair.data) && pair.image && File.exists(pair.image)) ++dataCount;
                }
                var drizzleRequested = isDrizzleEnabled();
                var drizzleCount = normalizationPairs.filter(function (pair) { return pair.image && File.exists(drizzlePath(pair.image)); }).length;
                if (drizzleRequested && drizzleCount == 0) {
                    for (var i = 0; i < normalizationPairs.length; ++i) {
                        if (this.isCancelled()) return false;
                        var registeredInput = normalizationPairs[i].image;
                        var source = registeredInput ? registrationSource(registeredInput) : "";
                        if (!source) {
                            console.warningln("Drizzle: pre-registration source unavailable for " + group.files[i]);
                            continue;
                        }
                        console.noteln("Drizzle: restoring registration data for " + registeredInput);
                        try { this.registerFits([source], registeredInput); }
                        catch (error) { if (this.isCancelled()) return false; console.warningln("Drizzle registration recovery failed: " + error.message); }
                    }
                }
                var useDrizzle = drizzleRequested && normalizationPairs.every(function (pair) {
                    return pair.image && File.exists(pair.image) && File.exists(drizzlePath(pair.image));
                });
                if (drizzleRequested && !useDrizzle)
                    console.warningln("Drizzle: incomplete registration data; saving ordinary integration for " + label);
                var normalizationFailed = group.files.some(function (file) {
                    return fallbackFiles.indexOf(file) >= 0;
                });
                // Complete XNML/source pairs take priority, even when normalized-image generation failed.
                var useXNML = dataCount == group.files.length;
                var useRegistered = !useXNML && (normalizationFailed || normalizationPairs.some(function (pair) { return File.exists(pair.data); }));
                if (useRegistered)
                    console.warningln("Integration: " + label + ": LN/XNML is incomplete; using available registered frames with global normalization (no XNML).");
                var targetImages = [];
                for (var i = 0; i < group.files.length; ++i) {
                    var pair = normalizationPairs[i];
                    var input = (useXNML || useRegistered || useDrizzle) && pair.image && File.exists(pair.image) ? pair.image : group.files[i];
                    targetImages.push([true, input, useDrizzle ? drizzlePath(pair.image) : "", useXNML ? pair.data : ""]);
                }
                process.images = targetImages;
                process.combination = ImageIntegration.prototype.Average;

                // how to weight
                switch (Config.IntegrationWeightMode) {
                    case "noise-evaluation":
                        process.weightMode = ImageIntegration.prototype.SNREstimate;
                        break;
                    case "fits-keyword":
                        process.weightMode = ImageIntegration.prototype.KeywordWeight;
                        process.weightKeyword = Config.IntegrationWeightKeyword.trim();
                        if (!process.weightKeyword) throw new Error("FITS weight keyword is empty");
                        break;
                    default:
                        process.weightMode = ImageIntegration.prototype.PSFSignalWeight;
                        break;
                }
                process.minWeight = 0; // Weighting only; no automatic frame selection.
                console.noteln("Weights: " + (Config.IntegrationWeightMode == "fits-keyword" ? "FITS Keyword (" + process.weightKeyword + ")" :
                    Config.IntegrationWeightMode == "noise-evaluation" ? "Noise evaluation" : "PSF Signal Weight"));
                
                // how to normalize (images and rejection)
                var passedThroughLN = group.files.every(function (file) {
                    return /_r_n$/i.test(File.extractName(file));
                });
                if (useXNML) {
                    process.normalization = ImageIntegration.prototype.LocalNormalization;
                    process.rejectionNormalization = ImageIntegration.prototype.LocalRejectionNormalization;
                } else if (passedThroughLN) {
                    // Separate policy for LN outputs; identical settings for now.
                    process.normalization = ImageIntegration.prototype.AdditiveWithScaling;
                    process.rejectionNormalization = ImageIntegration.prototype.Scale;
                } else {
                    process.normalization = ImageIntegration.prototype.AdditiveWithScaling;
                    process.rejectionNormalization = ImageIntegration.prototype.Scale;
                }
                console.noteln("Normalization: " + (useXNML ? "LocalNormalization (XNML), registered inputs; rejection normalization: Local" : "Additive with scaling; rejection normalization: Scale + zero offset"));
                
                //how to reject
                process.rejection = group.files.length < 6 ? ImageIntegration.prototype.PercentileClip : ImageIntegration.prototype.WinsorizedSigmaClip;
                process.pcClipLow = 0.20;
                process.pcClipHigh = 0.10;
                process.sigmaLow = Config.IntegrationSigmaLow;
                process.sigmaHigh = Config.IntegrationSigmaHigh;
                process.winsorizationCutoff = 5.0;
                process.clipLow = true;         //use rejection from low
                process.clipHigh = true;        //use rejection from high
                process.rangeClipLow = true;    //throw out values = 0
                process.rangeLow = 0;
                process.rangeClipHigh = false;  //throw out values ~ `
                process.rangeHigh = 0.980000;
                process.largeScaleClipLow = false;
                process.largeScaleClipLowProtectedLayers = 2;
                process.largeScaleClipLowGrowth = 2;
                process.largeScaleClipHigh = false;
                process.largeScaleClipHighProtectedLayers = 2;
                process.largeScaleClipHighGrowth = 2;
                
                console.noteln("using rejection: " + (group.files.length < 6 ? "Percentile clipping (0.20 / 0.10)" :
                    "Winsorized Sigma (" + Config.IntegrationSigmaLow + " / " + Config.IntegrationSigmaHigh + ")"));

                process.generateIntegratedImage = true;
                process.generateRejectionMaps = true;
                process.generateDrizzleData = useDrizzle;
                process.generate64BitResult = false;
                process.subtractPedestals = false;
                process.truncateOnOutOfRange = false;
                process.evaluateNoise = false;
                process.closePreviousImages = false;
                process.showImages = false;
                process.noGUIMessages = true;
                process.useFileThreads = true;
                process.fileThreadOverload = 1.0;
                process.autoMemorySize = true;
                process.autoMemoryLimit = 0.75;


                // Run integration with drizzle first
                var integrated = false; failureReason = "ImageIntegration failed; see console";
                try { 
                    integrated = process.executeGlobal(); 
                } catch (error) {
                    if (this.isCancelled() || !useDrizzle) throw error;
                    console.warningln("Drizzle preparation failed: " + error.message);
                }
                if (!integrated && useDrizzle && !this.isCancelled()) {
                    
                    // As a fallback - run integration without drizzle then 
                    // (в случае, если .xdrz файлов не окажется, процесс вывалится с ошибкой, а так соберем хотя бы обычную сумму, без дриззла)
                    console.warningln("Retrying ordinary ImageIntegration without drizzle data for " + label);
                    var failedIds = [process.integrationImageId, process.lowRejectionMapImageId, process.highRejectionMapImageId];
                    for (var k = 0; k < failedIds.length; ++k) if (failedIds[k]) {
                        var failedWindow = ImageWindow.windowById(failedIds[k]);
                        if (failedWindow && !failedWindow.isNull) failedWindow.forceClose();
                    }
                    useDrizzle = false;
                    process.generateDrizzleData = false;
                    process.images = targetImages.map(function (row) { return [row[0], row[1], "", row[3]]; });
                    
                    integrated = process.executeGlobal();
                }
                if (!integrated) throw new Error("ImageIntegration failed");
                if (this.isCancelled()) return false;

                // Check the results
                if (process.numberOfImages != group.files.length) throw new Error("ImageIntegration did not integrate all input frames");
                failureReason = "unable to save integration outputs; see console";
                var ids = [process.lowRejectionMapImageId, process.highRejectionMapImageId, process.integrationImageId];
                for (var o = 0; o < ids.length; ++o) {
                    var output = ImageWindow.windowById(ids[o]);
                    if (!output || output.isNull) throw new Error("ImageIntegration output is unavailable: " + ids[o]);
                    if (o == 2) {
                        var keywords = output.keywords.filter(function (keyword) { return keyword.name != "OBJECT" && keyword.name != "FILTER"; });
                        keywords.push(new FITSKeyword("OBJECT", "'" + group.data.object.replace(/'/g, "''") + "'", "Integration object"));
                        keywords.push(new FITSKeyword("FILTER", "'" + group.data.filter.replace(/'/g, "''") + "'", "Integration filter/channel"));
                        output.keywords = keywords;
                    }
                    if (!output.saveAs(group.outputs[o], false, false, false, false))
                        throw new Error("Unable to save integration output: " + group.outputs[o]);
                }
                if (this.isCancelled()) return false;
                ++this.IntegratedCount;
                console.noteln("Integration master saved: " + group.outputs[2]);
                var displayMaster = group.outputs[2];
                
                // Run drizzle integration
                if (useDrizzle) {
                    try {
                        var drizzleMaster = this.drizzleIntegration(group, targetImages, useXNML);
                        if (drizzleMaster) displayMaster = drizzleMaster;
                    } catch (error) {
                        if (this.isCancelled()) return false;
                        console.warningln("DrizzleIntegration failed; ordinary master saved: " + error.message);
                        this.reportFailure(label, "DrizzleIntegration failed; ordinary master saved");
                    }
                }
                mastersToShow.push(displayMaster);
                
            } catch (error) {
                if (this.isCancelled()) return false;
                success = false;
                console.criticalln("Integration: " + error.message + " [" + label + "]");
                this.reportFailure(label, "Integration failed: " + failureReason);
            } finally {
                // Close only windows reported by this process, including on execution/save failure.
                if (process) {
                    var ids = [process.integrationImageId, process.lowRejectionMapImageId, process.highRejectionMapImageId];
                    for (var o = 0; o < ids.length; ++o) if (ids[o]) {
                        var output = ImageWindow.windowById(ids[o]);
                        if (output && !output.isNull) output.forceClose();
                    }
                }
            }
        }
        
        // Open saved files after all groups so windows reference final paths.
        // Show newly saved masters only; rejection maps remain closed.
        for (var m = 0; m < mastersToShow.length; ++m) {
            if (this.isCancelled()) return false;
            try {
                var masterWindows = ImageWindow.open(mastersToShow[m]);
                masterWindows[0].show();
            } catch (error) {
                console.warningln("Integration: master saved but could not be displayed: " +
                    mastersToShow[m] + ": " + error.message);
            }
        }
        
        console.noteln("Integration complete: " + this.IntegratedCount + " new master(s)");
        return success;
    };

    /************************************************************************************************************
     * Запуск SubframeSelector с сохранением результатов в processIcon
     *
     * @param
     * @return
     */
    this.runSubframeSelector = function ()
	{
        if (this.isCancelled()) return false;

        if (!Config.NeedApproving) {
            debug("Approving is off", dbgNormal);
            return true;
        }

		if (this.approveFileList.length==0) {
			console.warningln();
			console.warningln("Approving: there is no files to measure, exiting ...");
			return false;
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
		var file = this.approveFileList[1];
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
		var status;
		try {
		    status = P.executeGlobal();
		} catch (error) {
		    if (this.isCancelled()) return false;
		    throw error;
		}
		if (this.isCancelled()) return false;
		debug("SF execute status: " + status, dbgNotice);

		// Get Icon Name based on received file
		let iconName = "";
        if (file.match(/(.+)\/(.+)_c\.(fit|fits|xisf)$/i) != null || file.match(/(.+)\/(.+)_c_cc\.(fit|fits|xisf)$/i) != null) {
			iconName = Config.SF_IconName_beforeRegistration;
		} else if ( file.match(/(.+)\/(.+)_c_cc_b_r\.(fit|fits|xisf)$/i) != null || file.match(/(.+)\/(.+)_c_cc_r\.(fit|fits|xisf)$/i) != null) {
			iconName = Config.SF_IconName_afterRegistration;
        }

		// Save result in text file (just in case not to loose measurement results)
		writeTextFile (ApprovedOutputPath + "/SubframeSelectorMeasurement_source.src", P.toSource());
		debug("Subframes statistics saved into <b>" + ApprovedOutputPath+ "/SubframeSelectorMeasurement_source.src</b> file");


		// Save result in icon
		P.writeIcon(iconName);
		console.noteln("Subframes statistics saved into <b>" + iconName+ "</b> icon");

		return status;
    }

    /************************************************************************************************************
     * Сохранить файл в список для последующей обработки SubframeSelector
     *
     * @param
     * @return
     */

	this.addFileForNSG = function (files)
	{
        if (this.isCancelled()) return false;
		if (files == false) {
            debug("Skipping adding to NSG", dbgNormal);
            return false;
        }

        if (!Config.NeedNSG) {
            debug("NSG is off", dbgNormal);
            return true;
        }


        // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
        debug("Need to approve " + files.length + " file(s)", dbgNotice);

        var file = files[0];

        // Start registration for all files
        for (var i = 0; i < files.length; i++) {
            if (this.isCancelled()) return false;
			this.NSG_FileList.push(files[i]);
			debug("Added to NSG list <b>" + files[i] + "</b>", dbgNormal);
		}
		return true;
	}

    /************************************************************************************************************
     * Запуск SubframeSelector с сохранением результатов в processIcon
     *
     * @param
     * @return
     */
    this.runNSG = function (filterName)
	{
        if (this.isCancelled()) return false;

        if (!Config.NeedApproving) {
            debug("NSG is off", dbgNormal);
            return true;
        }


        // Start approving
        console.noteln("<end><cbr><br>",
            "-------------------------------------------------------------");
        console.noteln("| Begin NSG of all files (total " + this.NSG_FileList.length + ")");
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("NSG Files"); }

		// Assuming that all files are homogeous (i.e. have the same characteristics - same Object, same Scale, etc)
		// So we will calculate all data based on first in the list file header
		// @todo check that assumption is right
		file = this.NSG_FileList[1];
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
            ["file0", "E:/DSlrRemote/+M72/Calibrated/registered/R/M72_20200831_Red_300s_1x1_-25degC_0.0degN_000020225+++_c_cc_r.fit¬1689062234000¬0.000011519755741154521¬MRS¬32.1415¬1.8646119489991¬300¬2020-08-31T20:10:10¬Red¬"],
            ["file1", "E:/DSlrRemote/+M72/Calibrated/registered/R/M72_20200831_Red_300s_1x1_-25degC_0.0degN_000020226+++_c_cc_r.fit¬1689062237000.0002¬0.000011646760821512618¬MRS¬31.9331¬1.87407410000989¬300¬2020-08-31T20:16:02¬Red¬"],
            ["file2", "E:/DSlrRemote/+M72/Calibrated/registered/R/M72_20200831_Red_300s_1x1_-25degC_0.0degN_000020227+++_c_cc_r.fit¬1689062240000¬0.000011764867900663195¬MRS¬31.6944¬1.88529425292196¬300¬2020-08-31T20:21:55¬Red¬"],
			] */
			let fileArr = ["file" + i, this.approveFileList[i]];
			debug(fileArr, dbgNotice);
            filelist.push(fileArr);
		}

		// Create Process for measuring
        ProcessIconName = "NGC_" + filterName;
        var P =  ProcessInstance.fromIcon(ProcessIconName);

        P.parameters = [ ["referenceFile", "E:/DSlrRemote/_NormalizationReferences/M72_20200902_Red_300s_1x1_-25degC_0.0degN_000020307_c_cc_r.fit"],
                ["pixelSize", fileData.scale ],
                ["focalLength", fileData.focallen],
                ["selectedTarget", "E:/DSlrRemote/+M72/Calibrated/registered/R/M72_20200901_Red_300s_1x1_-20degC_0.0degN_000020264_c_cc_r.fit"],
                filelist
            ];

		//debug(P.toSource(), dbgNotice);
		var status;
		try {
		    status = P.executeGlobal();
		} catch (error) {
		    if (this.isCancelled()) return false;
		    throw error;
		}
		if (this.isCancelled()) return false;
		debug("NGC execute status: " + status, dbgNotice);

		// Get Icon Name based on received file
		// Save result in text file (just in case not to loose measurement results)
		writeTextFile (ApprovedOutputPath + "/SubframeSelectorMeasurement.src", P.toSource());
		debug("Subframes statistics saved into <b>" + ApprovedOutputPath+ "/SubframeSelectorMeasurement.src</b> file");


		// Save result in icon
		P.writeIcon(ProcessIconName);
		console.noteln("NGC Process saved into <b>" + ProcessIconName+ "</b> icon");

		return status;
    }

    /**
     * Get a FILEARRAY signature, retaining the Debayer RGB/R/G/B marker.
     * @param {String} file Image path with an optional processing suffix.
     * @return {String} Basename without extension or processing suffix.
     */
    function imageSignature(file) {
        return File.extractName(file).replace(/_c(?:_cc)?(?:_b)?(?:_r)?(?:_n)?(?:_a)?$/i, "");
    }

    /**
     * Record a Debayer or channel-split stage in FILEARRAY for source and outputs.
     * The source stage holds all output paths; each channel record holds its own
     * one-element array. Later stages use the channel's independent signature.
     * @param {String} source Input image path.
     * @param {Array} outputs Successfully saved, reused or passed-through paths.
     * @param {Number} stage FITS.DEBAYERED, FITS.PRESPLIT or FITS.SPLIT.
     * @return {Array} The same output paths for the next pipeline stage.
     * Updates FILEARRAY only; does not write image files.
     */
    function recordOSCOutputs(source, outputs, stage) {
        AddFileToArray(stage, outputs, imageSignature(source), File.extractDirectory(source));
        for (var i = 0; i < outputs.length; ++i)
            if (imageSignature(outputs[i]) != imageSignature(source))
                AddFileToArray(stage, [outputs[i]], imageSignature(outputs[i]), File.extractDirectory(outputs[i]));
        return outputs;
    }

    /**
     * Copy acquisition metadata to an RGB or extracted-channel image.
     * @param {ImageWindow} source Source image; remains open and unchanged.
     * @param {ImageWindow} output Destination image; remains open, not saved here.
     * @param {String} filter RGB, R, G or B for the output FILTER.
     * @return {undefined} Copies non-CFA properties/keywords, removes CFA tags.
     */
    function copyOSCMetadata(source, output, filter) {
        var keywords = source.keywords.filter(function (k) {
            return !/^(FILTER|BAYERPAT|XBAYROFF|YBAYROFF|CFA.*)$/i.test(k.name);
        });
        keywords.push(new FITSKeyword("FILTER", "'" + filter + "'", "AutoCalibrate output channel"));
        output.keywords = keywords;
        var properties = source.mainView.properties;
        for (var j = 0; j < properties.length; ++j)
            if (!/^CFA:/.test(properties[j]))
                output.mainView.setPropertyValue(properties[j], source.mainView.propertyValue(properties[j]));
        if (output.mainView.hasProperty("Instrument:Filter:Name"))
            output.mainView.setPropertyValue("Instrument:Filter:Name", filter);
        var outputProperties = output.mainView.properties;
        for (var j = 0; j < outputProperties.length; ++j)
            if (/^CFA:/.test(outputProperties[j]))
                output.mainView.deleteProperty(outputProperties[j]);
    }

    /**
     * Run file-based VNG in global context; pass ready RGB/mono through.
     * @param {String|Boolean} fileName Input path or a failed previous stage.
     * @return {Array|Boolean} RGB/pass-through paths, or false on failure/abort.
     * Debayer loads/saves RGB via targetItems, using metadata Auto or a legacy
     * FILTER Bayer pattern. Moves its generated XISF to the pipeline filename
     * and records DEBAYERED only after successful execution and file checks.
     * Header inspection still uses getFileHeaderData; no processing view is opened.
     * Rejects non-RGB input intended for Split when Debayer cannot convert it.
     */
    this.debayerFit = function (fileName) {
        if (this.isCancelled()) return false;
        if (!fileName) return false;
        if (!isDebayerEnabled() && !isSplitEnabled()) return [fileName];

        var stagingPath = null;
        try {
            var data = getFileHeaderData(fileName);
            if (!data) return false;
            if (!isDebayerEnabled()) {
                if (!data.isColor) {
                    console.criticalln("Split channels requires RGB input" + (data.cfa ? "; enable Debayer for CFA image: " : ": ") + fileName);
                    return false;
                }
                return [fileName];
            }
            if (!data.cfa) {
                if (isSplitEnabled() && !data.isColor) {
                    console.criticalln("Split channels requires RGB input; this image is monochrome and has no CFA pattern: " + fileName);
                    return false;
                }
                return recordOSCOutputs(fileName, [fileName], FITS.DEBAYERED);
            }

            var outputPath = this.BaseCalibratedOutputPath;
            if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER)
                outputPath += "/" + (data.object || cfgDefObjectName);
            outputPath += "/" + Config.DebayerdFolderName;
            var name = File.extractName(fileName);
            var suffix = name.match(/_c(?:_cc)?(?:_b)?(?:_r)?$/);
            var stem = suffix ? name.substring(0, name.length - suffix[0].length) : name;
            var outputFile = outputPath + "/" + stem + "_d_RGB" + (suffix ? suffix[0] : "_c") + ".xisf";
            if (Config.SkipExistingFiles && File.exists(outputFile))
                return recordOSCOutputs(fileName, [outputFile], FITS.DEBAYERED);
            if (File.exists(outputFile) && !Config.OverwriteAllFiles)
                throw new Error("Output exists and overwrite is disabled: " + outputFile);
            if (!File.directoryExists(outputPath)) File.createDirectory(outputPath, true);
            if (this.progressDialog) this.progressDialog.updateBar_NewProcess("Debayer (VNG)");

            // Native Debayer appends its postfix. Stage the result separately, then
            // move it to the existing marker-before-processing-suffix convention.
            stagingPath = outputPath + "/_AutoCalibrateDebayer_" + new Date().getTime();
            var stagingIndex = 0;
            while (File.directoryExists(stagingPath))
                stagingPath = outputPath + "/_AutoCalibrateDebayer_" + new Date().getTime() + "_" + (++stagingIndex);
            File.createDirectory(stagingPath, true);

            var process = new Debayer;
            // Auto honors CFA metadata and offsets; FILTER-only files need an explicit pattern.
            process.cfaPattern = data.cfaFromMetadata ? Debayer.prototype.Auto : Debayer.prototype[data.cfaPattern];
            process.debayerMethod = Debayer.prototype.VNG;
            process.evaluateNoise = false;
            process.evaluateSignal = false;
            process.targetItems = [[true, fileName]];
            process.outputDirectory = stagingPath;
            process.outputExtension = ".xisf";
            process.outputPrefix = "";
            process.outputPostfix = "_d";
            process.outputRGBImages = true;
            process.outputSeparateChannels = false;
            process.overwriteExistingFiles = false;
            var debayerSucceeded = process.executeGlobal();
            if (this.isCancelled()) return false;
            if (!debayerSucceeded) throw new Error("Debayer failed: " + fileName);

            var outputData = process.outputFileData;
            if (!outputData || outputData.length != 1 || !outputData[0][0])
                throw new Error("Debayer did not report an RGB output file: " + fileName);
            var nativeFile = outputData[0][0];
            var normalizedOutput = String(nativeFile).replace(/\\/g, "/").toLowerCase();
            var normalizedStaging = stagingPath.replace(/\\/g, "/").toLowerCase() + "/";
            if (normalizedOutput.indexOf(normalizedStaging) != 0 || !File.exists(nativeFile))
                throw new Error("Debayer reported an unexpected or missing output file: " + nativeFile);
            // Recheck immediately before moving: a prior final file is never taken
            // as evidence that the current process succeeded.
            if (File.exists(outputFile)) {
                if (!Config.OverwriteAllFiles) throw new Error("Output exists and overwrite is disabled: " + outputFile);
                File.remove(outputFile);
            }
            File.move(nativeFile, outputFile);
            if (!File.exists(outputFile)) throw new Error("Unable to place debayered image: " + outputFile);
            try {
                File.removeDirectory(stagingPath);
                stagingPath = null;
            } catch (cleanupError) {
                console.warningln("Unable to remove Debayer staging directory: " + stagingPath + ": " + cleanupError.message);
            }
            ++this.ProcessesCompleted;
            return recordOSCOutputs(fileName, [outputFile], FITS.DEBAYERED);
        } catch (error) {
            if (this.isCancelled()) return false;
            console.criticalln("Debayer: " + error.message);
            if (stagingPath) console.warningln("Debayer staging files retained in: " + stagingPath);
            this.reportFailure(fileName, error.message);
            return false;
        }
    };

    /**
     * Extract R/G/B directly at the selected split position, independently of Debayer.
     * @param {Array|Boolean} files Input paths or a failed previous stage.
     * @param {Boolean} afterRegistration True before LN, false before ABE.
     * @return {Array|Boolean} Saved/reused channel paths, pass-through inputs, or false.
     * Saves XISF in SplitFolderName, preserving precision and acquisition metadata.
     * Records PRESPLIT/SPLIT only for complete output sets; closes owned windows.
     */
    this.splitChannels = function (files, afterRegistration) {
        if (this.isCancelled()) return false;
        if (!files || !isSplitEnabled() || splitAfterRegistration() != afterRegistration) return files;
        var stage = afterRegistration ? FITS.SPLIT : FITS.PRESPLIT;
        var channels = ["R", "G", "B"], outputs = [];
        for (var f = 0; f < files.length; ++f) {
            if (this.isCancelled())
                return false;
            var fileName = files[f], source = null, channel = null;
            try {
                var data = getFileHeaderData(fileName);
                if (!data) return false;
                if (!data.isColor) {
                    console.criticalln("Split channels requires an RGB image" + (data.cfa ? "; enable Debayer for this CFA frame: " : ": ") + fileName);
                    return false;
                }
                var outputPath = this.BaseCalibratedOutputPath;
                if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER)
                    outputPath += "/" + (data.object || cfgDefObjectName);
                outputPath += "/" + (Config.SplitFolderName || "split");
                var name = File.extractName(fileName);
                var suffix = name.match(/_c(?:_cc)?(?:_b)?(?:_r)?$/);
                var stem = suffix ? name.substring(0, name.length - suffix[0].length) : name;
                var channelFiles = [], allExist = true;
                for (var i = 0; i < channels.length; ++i) {
                    channelFiles.push(outputPath + "/" + stem + (afterRegistration ? "_s_" : "_p_") + channels[i] + (suffix ? suffix[0] : "_c") + ".xisf");
                    allExist = allExist && File.exists(channelFiles[i]);
                }
                if (Config.SkipExistingFiles && allExist) {
                    outputs = outputs.concat(recordOSCOutputs(fileName, channelFiles, stage));
                    continue;
                }
                if (!File.directoryExists(outputPath)) File.createDirectory(outputPath, true);
                if (this.progressDialog) this.progressDialog.updateBar_NewProcess("Split RGB channels");

                source = ImageWindow.open(fileName)[0];
                if (!source || source.isNull) throw new Error("Unable to open RGB image: " + fileName);
                for (var i = 0; i < channels.length; ++i) {
                    if (this.isCancelled()) return false;
                    if (Config.SkipExistingFiles && File.exists(channelFiles[i])) continue;
                    if (File.exists(channelFiles[i]) && !Config.OverwriteAllFiles)
                        throw new Error("Output exists and overwrite is disabled: " + channelFiles[i]);
                    channel = new ImageWindow(source.mainView.image.width, source.mainView.image.height,
                        1, source.bitsPerSample, source.isFloatSample, false, "AutoCalibrate_channel");
                    source.mainView.image.selectedChannel = i;
                    channel.mainView.beginProcess(UndoFlag_NoSwapFile);
                    channel.mainView.image.assign(source.mainView.image);
                    channel.mainView.endProcess();
                    copyOSCMetadata(source, channel, channels[i]);
                    if (!channel.saveAs(channelFiles[i], false, false, false, false))
                        throw new Error("Unable to save split channel: " + channelFiles[i]);
                    if (this.isCancelled()) return false;
                    channel.forceClose();
                    channel = null;
                }

                ++this.ProcessesCompleted;
                outputs = outputs.concat(recordOSCOutputs(fileName, channelFiles, stage));
            } catch (error) {
                if (this.isCancelled()) return false;
                console.criticalln("Split channels: " + error.message);
                this.reportFailure(fileName, error.message);
                return false;
            } finally {
                if (channel) channel.forceClose();
                if (source) source.forceClose();
            }
        }
        return outputs;
    };

    /************************************************************************************************************
     * Биннинг файлов
     *
     * @param files   string | array of strings полное имя файла.fit включая путь (или массив файлов)
     * @return string | array of strings        полное имя файла_c_сс_r.fit включая путь
     *
     */
    this.binFits = function (files) {
        if (this.isCancelled()) return false;
        if (files == false) {
            debug("Skipping binning", dbgNormal);
            return false;
        }

        if (!Config.NeedBinning) {
            debug("Software binning is off", dbgNormal);

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
        console.noteln("| [" + this.FileTotalCount + "] Begin binning of ", (files.length != 1 ? files.length + " files" : file));
        console.noteln("-------------------------------------------------------------");
		if (this.progressDialog) { this.progressDialog.updateBar_NewProcess("binningFits"); }

        // Если была дебайеризация, то на входе должное быть 3 файла, а не 1!!!
        debug("Need to bin " + files.length + " file(s)", dbgNotice);

        // Set registration folder
        BinnedOutputPath = this.BaseCalibratedOutputPath;
        if (Config.PathMode == PATHMODE.PUT_IN_OBJECT_SUBFOLDER || Config.PathMode == PATHMODE.RELATIVE_WITH_OBJECT_FOLDER || Config.PathMode == PATHMODE.PUT_FINALS_IN_OBJECT_SUBFOLDER) {
            var fileData = getFileHeaderData(file); // Get FITS HEADER data to know object name
            fileData.object = (fileData.object == "" ? cfgDefObjectName : fileData.object);
            BinnedOutputPath = BinnedOutputPath + "/" + fileData.object;
        }
        BinnedOutputPath = BinnedOutputPath + "/" + Config.BinnedFolderName;

        // Start registration for all files
        var newFiles = []; //empty array
        for (var i = 0; i < files.length; i++) {
            if (this.isCancelled()) return false;

            // return new file name
            var FileNameOnly = File.extractName(files[i]);
            var newFileNameOnly = FileNameOnly.replace(/_c_cc_r$/, '_c_cc_r_x');
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_cc$/, '_c_cc_x'); //if ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_cc_b$/, '_c_cc_b_x'); //if ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_cc_b_r$/, '_c_cc_b_r_x'); //if ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c$/, '_c_x'); //if no CC and no ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_b$/, '_c_b_x'); //if no CC and no ABE was run before
            if (FileNameOnly === newFileNameOnly)
                var newFileNameOnly = FileNameOnly.replace(/_c_b_r$/, '_c_b_r_x'); //if no CC and ABE was run before
            newFiles[i] = BinnedOutputPath + '/' + newFileNameOnly + '.' + getCorrectExtension(files[i]);


            //Проверить - существует ли файл и стоит ли перезаписывать его
            if (Config.SkipExistingFiles && File.exists(newFiles[i])) {
                console.warningln('File ' + newFileName + ' already exists, skipping Binning');
            } else {
                // Check if folder exists
                if (!File.directoryExists(BinnedOutputPath))
                    File.createDirectory(BinnedOutputPath, true);

                if (files.length > 1)
                    console.noteln("Binning " + files[i]);

                //Open file
                ImageWindow.open(files[i]);
                var w = ImageWindow.openWindows[ImageWindow.openWindows.length - 1];

                if (!w || w.isNull) {
                    console.criticalln("Error opening image file: " + files[i]);
                    return false;
                }

                var BINproc;

				var BINproc = new IntegerResample;

				BINproc.zoomFactor = -2;
				BINproc.downsamplingMode = IntegerResample.prototype.Average;
				BINproc.noGUIMessages = true;
				BINproc.metric = false;
				BINproc.forceResolution = false;


                //Запустить
				status = false;
                with (BINproc) {
                    try {
                        status = executeOn(w.mainView);
                    } catch (error) {
                        w.forceClose();
                        if (this.isCancelled()) return false;
                        throw error;
                    }
                    if (this.isCancelled()) { w.forceClose(); return false; }
                    //
                    // save
                    //
                    w.saveAs(newFiles[i], false, false, true, !Config.OverwriteAllFiles);
                }
                w.purge();
                w.forceClose(); //w.close();

                this.ProcessesCompleted++;

				if (status) {
					this.BinnedCount++;

				} else {
					this.reportFailure(fileName, "IntegerResample.executeGlobal() failed");
				}
                console.noteln("<end><cbr><br>",
                    "-------------------------------------------------------------");
                console.noteln(" [" + this.FileTotalCount + "] End of binning ");
                console.noteln("-------------------------------------------------------------");


            }

            if (File.exists(newFiles[i])) {
                // Добавим в массив файлов информацию о создании регистрируемого файла, что второй раз не делать
                var fn = "";
                if (	   (fn = newFiles[i].match(/(.+)\/(.+)_c_(.*)x\.(fit|fits|xisf)$/i)) != null
                   ) {
                    debug("path: " + fn[1], dbgNotice);
                    debug("matched: " + fn[2], dbgNotice);
                    debug("file is binned of " + fn[2], dbgNotice);

                    AddFileToArray(FITS.BINNED, newFiles[i], fn[2], fn[1]); //type, full name, signature, path
                } else {
                    debug("PATTERN NOT FOUND");
                }
            } else {
                return false;
            }

        }

        return newFiles;
    }


    /**
     * Read acquisition metadata and image geometry through the shared header reader.
     * Successful reads are cached for Integration; normal processing still reads the current file.
     * @param {String} fileName Input image path.
     * @param {Boolean} forIntegration Optional: reuse cached data and omit calibration-only requirements.
     * Integration validates its own object/filter/channel requirements at the call site.
     * @return {Object|Boolean} Independent metadata snapshot, or false; owned windows always close.
     */
    function getFileHeaderData(fileName, forIntegration) {
        var cacheKey = "$" + fileName.replace(/\\/g, "/").toLowerCase();
        if (forIntegration && fileHeaderCache[cacheKey]) {
            var cached = {}, entry = fileHeaderCache[cacheKey];
            for (var key in entry) if (entry.hasOwnProperty(key)) cached[key] = entry[key];
            return cached;
        }
        //C:/ASTRO/_z/newton/2016-10-13/53P-Van-Biesbroeck-001-L-bin1-1m.fit
        console.writeln();
        console.note("Getting HeaderData for file: ");
        console.writeln("" + fileName);
        console.writeln();

        var windows = [];
        try {
            windows = ImageWindow.open(fileName);
            if (!windows || windows.length != 1 || !windows[0] || windows[0].isNull)
                throw new Error("Expected one image in the input file");
            var image = windows[0], keywords = image.keywords;
            // Every file is independent: optional or missing headers never inherit earlier values.
            for (var key in headers) if (headers.hasOwnProperty(key)) headers[key] = null;
            for (var k in keywords) {

                if (typeof headers[keywords[k].name] != 'undefined') {
                    keywords[k].trim();
                    headers[keywords[k].name] = keywords[k].strippedValue;
                    debug('header ' + keywords[k].name + '=' + keywords[k].strippedValue, dbgNotice);
                }
            }

            var observer = headers.OBSERVER || "";
            if (headers.OBSERVER) {
                if (typeof OBSERVER_DICTIONARY[headers.OBSERVER] != 'undefined') {
                    observer = OBSERVER_DICTIONARY[headers.OBSERVER];
                }
            }

            if (!forIntegration && !headers.TELESCOP) {
                console.criticalln('Can`t find Telescope');
                return false;
            }

            if (!forIntegration && (!headers['DATE-OBS'] || !headers.EXPTIME)) {
                console.criticalln('Can`t find Date or Exposure time');
                return false;
            }

            if (!forIntegration && !headers['CCD-TEMP']) {
                console.criticalln('Can`t find CCD TEMP');
                return false;
            }

            var pattern = image.mainView.hasProperty("CFA:SourcePattern")
                ? String(image.mainView.propertyValue("CFA:SourcePattern")).toUpperCase() : "";
            for (var k = 0; k < keywords.length; ++k)
                if (keywords[k].name == "BAYERPAT" && !pattern)
                    pattern = keywords[k].strippedValue.toUpperCase();
            var cfaFromMetadata = pattern.length > 0;
            if (!pattern && /^(RGGB|BGGR|GBRG|GRBG)$/.test(String(headers.FILTER).toUpperCase()))
                pattern = String(headers.FILTER).toUpperCase();
            var isColor = image.mainView.image.isColor;
            var isCFA = !isColor && /^(RGGB|BGGR|GBRG|GRBG)$/.test(pattern);
            if (!headers.FILTER && isCFA) headers.FILTER = pattern;


            if (!forIntegration && (!headers.FILTER || !headers.OBJECT || !headers.XBINNING)) {
                console.criticalln('cant find Filter, Object or Binning');
                return false;
            }


            // Возьмем фильтр, заменим его по справочнику и затем переведем в UPCASE
            headers.FILTER = String(headers.FILTER || "").trim().toUpperCase();
            if (typeof FILTERS_DICTIONARY[headers.FILTER] != 'undefined') {
                headers.FILTER = FILTERS_DICTIONARY[headers.FILTER];
            }
            var filter = String(headers.FILTER || "").trim().toUpperCase();
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

            // Integrated cameras such as Seestar may omit INSTRUME.
            if (!headers.INSTRUME)
                camera = telescope;

            // Сохраним геометрию
            var Width = image.mainView.image.width;
            var Height = image.mainView.image.height;


            var numberOfChannels = image.mainView.image.numberOfChannels;
            var dateObs = headers["DATE-OBS"] || "";

            // @todo date midnight / midday
            // @todo utc
            var data = {
                filename: fileName,         // original file name
                observer: observer,         // could be "" (as for Seestar, eg)
                instrument: telescope,      // was Vitar/MakF10 or (for me) just SW250
                camera: camera , // ArtemisHSC
                date: dateObs.substr(0, "2017-01-01".length), // 2016-10-13
                time: dateObs.substr("2017-01-01T".length, "00:00".length).replace(':', '_'), // 23_15
                name: fileName.split('/').reverse()[0], // pix-001.fit
                object: String(headers.OBJECT || "").trim(), // M106
                filter: filter, // L
                isColor: isColor,
                numberOfChannels: numberOfChannels,
                cfa: isCFA,
                cfaPattern: pattern,
                cfaFromMetadata: cfaFromMetadata,
                temp:           parseInt(headers['CCD-TEMP']), // 28 вместо 28.28131291
                bin:            parseInt(headers.XBINNING), // 1
                scale:          parseFloat(headers['XPIXSZ']) / parseFloat(headers['FOCALLEN']) * 206.265, //
                focallen:       parseFloat(headers['FOCALLEN']), // 1368
                width :			Width,
                height:			Height,
                qhy:            (headers.GAIN && headers.READOUTM && headers.OFFSET), // true or false
                ReadOutMode:    headers.READOUTM,
                Gain:           headers.GAIN,
                EGain:          ( headers.EGAIN ? parseFloat(headers.EGAIN) : 1.000 ),
                Offset:         headers.OFFSET,
                Overscan:       headers.QOVERSCN,
                Preset:         headers.QPRESET,
                USBLimit:       headers.USBLIMIT,
                duration:       parseInt(headers.EXPTIME), // 1800
                exposure:       parseInt(headers.EXPTIME) // dublicate for convinience
            };
            var snapshot = {};
            for (var key in data) if (data.hasOwnProperty(key)) snapshot[key] = data[key];
            fileHeaderCache[cacheKey] = snapshot;
            return data;
        } catch (error) {
            console.criticalln("Unable to read image metadata: " + fileName + ": " + error.message);
            return false;
        } finally {
            for (var w = 0; windows && w < windows.length; ++w)
                if (windows[w] && !windows[w].isNull) windows[w].forceClose();
        }
    }

} //end of class
