 #ifndef AutoCalibrate_settings_js
    #define AutoCalibrate_settings_js
	console.writeln("AutoCalibrate_settings_js");
    #include <pjsr/DataType.jsh>
 #endif

function ConfigData() {
    //temp
    this.outputExtension = "fits";
    this.outputHints = "";
    this.overwriteExisting = true;

    if (DEBUG)
        console.writeln('<br/><br/>Config object created...<br/>');

    //Helper functions
    function load(key, type) {
        return Settings.read(SETTINGS_KEY_BASE + key, type);
    }
    function loadIndexed(key, index, type) {
        return load(key + '_' + index.toString(), type);
    }
    function save(key, type, value) {
        Settings.write(SETTINGS_KEY_BASE + key, type, value);
    }
    function saveIndexed(key, index, type, value) {
        save(key + '_' + index.toString(), type, value);
    }

    /*
     * Load / Save from Settings Storage
     */
    this.loadSettings = function () {
        var o;
        if ((o = load("InputPath", DataType_String)) != null)
            this.InputPath = o;
        if ((o = load("PathMode", DataType_Int16)) != null)
            this.PathMode = o;
        if ((o = load("SearchInSubDirs", DataType_Boolean)) != null)
            this.SearchInSubDirs = o;

        if ((o = load("NeedCalibration", DataType_Boolean)) != null)
            this.NeedCalibration = o;
        if ((o = load("NeedCosmeticCorrection", DataType_Boolean)) != null)
            this.NeedCosmeticCorrection = o;
        if ((o = load("NeedABE", DataType_Boolean)) != null)
            this.NeedABE = o;
        if ((o = load("NeedRegister", DataType_Boolean)) != null)
            this.NeedRegister = o;
        if ((o = load("NeedNormalization", DataType_Boolean)) != null)
            this.NeedNormalization = o;

        if ((o = load("CalibratationMastersPath", DataType_String)) != null)
            this.CalibratationMastersPath = o;
        if ((o = load("RegistrationReferencesPath", DataType_String)) != null)
            this.RegistrationReferencesPath = o;
        if ((o = load("NormalizationReferencesPath", DataType_String)) != null)
            this.NormalizationReferencesPath = o;

        if ((o = load("NormalizationScale", DataType_Int16)) != null)
            this.NormalizationScale = o;
        if ((o = load("NormalizationNoScaleFlag", DataType_Boolean)) != null)
            this.NormalizationNoScaleFlag = o;

    }

    this.saveSettings = function () {
        save("InputPath", DataType_String, this.InputPath);
        save("PathMode", DataType_Int16, this.PathMode);
        save("SearchInSubDirs", DataType_Boolean, this.SearchInSubDirs);

        save("NeedCalibration", DataType_Boolean, this.NeedCalibration);
        save("NeedCosmeticCorrection", DataType_Boolean, this.NeedCosmeticCorrection);
        save("NeedABE", DataType_Boolean, this.NeedABE);
        save("NeedRegister", DataType_Boolean, this.NeedRegister);
        save("NeedNormalization", DataType_Boolean, this.NeedNormalization);

        save("CalibratationMastersPath", DataType_String, this.CalibratationMastersPath);
        save("RegistrationReferencesPath", DataType_String, this.RegistrationReferencesPath);
        save("NormalizationReferencesPath", DataType_String, this.NormalizationReferencesPath);

        save("NormalizationScale", DataType_Int16, this.NormalizationScale);
        save("NormalizationNoScaleFlag", DataType_Boolean, this.NormalizationNoScaleFlag);

        if (DEBUG) {
            console.writeln("\n<b>Settings saved:</b>");

            this.printParameters();

            console.writeln("\n");
        };
    }

    /*
     * Import / Export script parameters (global or target View run)
     */
    this.exportParameters = function () {
        Parameters.set("InputPath", this.InputPath);
        Parameters.set("PathMode", this.PathMode);
        Parameters.set("SearchInSubDirs", this.SearchInSubDirs);

        Parameters.set("NeedCalibration", this.NeedCalibration);
        Parameters.set("NeedCosmeticCorrection", this.NeedCosmeticCorrection);
        Parameters.set("NeedABE", this.NeedABE);
        Parameters.set("NeedRegister", this.NeedRegister);
        Parameters.set("NeedNormalization", this.NeedNormalization);

        Parameters.set("CalibratationMastersPath", this.CalibratationMastersPath);
        Parameters.set("RegistrationReferencesPath", this.RegistrationReferencesPath);
        Parameters.set("NormalizationReferencesPath", this.NormalizationReferencesPath);

        Parameters.set("NormalizationScale", this.NormalizationScale);
        Parameters.set("NormalizationNoScaleFlag", this.NormalizationNoScaleFlag);

        if (DEBUG) {
            console.writeln("\n<b>Loaded Parameters:</b>");

            this.printParameters();

            console.writeln("\n");
        };
    }

    this.importParameters = function () {

        if (Parameters.has("InputPath"))
            this.InputPath = Parameters.getString("InputPath");
        if (Parameters.has("PathMode"))
            this.PathMode = Parameters.getInteger("PathMode");
        if (Parameters.has("SearchInSubDirs"))
            this.SearchInSubDirs = Parameters.getBoolean("SearchInSubDirs");

        if (Parameters.has("NeedCalibration"))
            this.NeedCalibration = Parameters.getBoolean("NeedCalibration");
        if (Parameters.has("NeedCosmeticCorrection"))
            this.NeedCosmeticCorrection = Parameters.getBoolean("NeedCosmeticCorrection");
        if (Parameters.has("NeedABE"))
            this.NeedABE = Parameters.getBoolean("NeedABE");
        if (Parameters.has("NeedRegister"))
            this.NeedRegister = Parameters.getBoolean("NeedRegister");
        if (Parameters.has("NeedNormalization"))
            this.NeedNormalization = Parameters.getBoolean("NeedNormalization");

        if (Parameters.has("CalibratationMastersPath"))
            this.CalibratationMastersPath = Parameters.getString("CalibratationMastersPath");
        if (Parameters.has("RegistrationReferencesPath"))
            this.RegistrationReferencesPath = Parameters.getString("RegistrationReferencesPath");
        if (Parameters.has("NormalizationReferencesPath"))
            this.NormalizationReferencesPath = Parameters.getString("NormalizationReferencesPath");

        if (Parameters.has("NormalizationScale"))
            this.NormalizationScale = Parameters.getInteger("NormalizationScale");
        if (Parameters.has("NormalizationNoScaleFlag"))
            this.NormalizationNoScaleFlag = Parameters.getBoolean("NormalizationNoScaleFlag");

        if (DEBUG) {
            console.writeln("<b>Loaded Parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.printParameters = function () {
        console.writeln("InputPath:                      " + this.InputPath);
        console.writeln("PathMode:                       " + this.PathMode);
        console.writeln("SearchInSubDirs:                " + this.SearchInSubDirs);

        console.writeln("NeedCalibration:                " + this.NeedCalibration);
        console.writeln("NeedCosmeticCorrection:         " + this.NeedCosmeticCorrection);
        console.writeln("NeedABE:                        " + this.NeedABE);
        console.writeln("NeedRegister:                   " + this.NeedRegister);
        console.writeln("NeedNormalization:              " + this.NeedNormalization);

        console.writeln("CalibratationMastersPath:       " + this.CalibratationMastersPath);
        console.writeln("RegistrationReferencesPath:     " + this.RegistrationReferencesPath);
        console.writeln("NormalizationReferencesPath:    " + this.NormalizationReferencesPath);

        console.writeln("NormalizationScale:             " + this.NormalizationScale);
        console.writeln("NormalizationNoScaleFlag:       " + this.NormalizationNoScaleFlag);
    }

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
