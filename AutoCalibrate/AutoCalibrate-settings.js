 #ifndef AutoCalibrate_settings_js
    #define AutoCalibrate_settings_js
	console.writeln("AutoCalibrate_settings_js");
    #include <pjsr/DataType.jsh>
 #endif

/*
 When adding new component to UI, we need to:
 UI prt:
    Create object, Horiz spacer for it, add it to Vert spacer.
 Settings part:
    1) loadSettings() with Config.name (but instead of "Config." use "this.") - (watch for data type!)
    2) saveSettings() with Config.name  (watch for data type!)
    3) importSettings() with Config.name (watch for data type!)
    4) exportSettings() with Config.name 
    5) printParameters() with Config.name 



*/


function ConfigData() {
    this.NeedDebayer = false;
    this.SplitChannels = false;
    this.NeedIntegration = false;
    this.NeedDrizzle = false;
    this.DrizzleScale = 2;
    this.DrizzleDropShrink = 90; // percent
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
        if ((o = load("NeedDebayer", DataType_Boolean)) != null)
            this.NeedDebayer = o;
        if ((o = load("SplitChannels", DataType_Boolean)) != null)
            this.SplitChannels = o;
        if ((o = load("NeedABE", DataType_Boolean)) != null)
            this.NeedABE = o;
        if ((o = load("NeedRegister", DataType_Boolean)) != null)
            this.NeedRegister = o;
        if ((o = load("NeedNormalization", DataType_Boolean)) != null)
            this.NeedNormalization = o;
		if ((o = load("NeedApproving", DataType_Boolean)) != null)
            this.NeedApproving = o;
        if ((o = load("NeedIntegration", DataType_Boolean)) != null)
            this.NeedIntegration = o;
        if ((o = load("NeedDrizzle", DataType_Boolean)) != null)
            this.NeedDrizzle = o;
        if ((o = load("DrizzleScale", DataType_Int16)) != null)
            this.DrizzleScale = o;
        if ((o = load("DrizzleDropShrink", DataType_Int16)) != null)
            this.DrizzleDropShrink = o;

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

        if ((o = load("OutputFileSize", DataType_Int16)) != null)
            this.OutputFormatIC = o;

    }

    this.saveSettings = function () {
        save("InputPath", DataType_String, this.InputPath);
        save("PathMode", DataType_Int16, this.PathMode);
        save("SearchInSubDirs", DataType_Boolean, this.SearchInSubDirs);

        save("NeedCalibration", DataType_Boolean, this.NeedCalibration);
        save("NeedCosmeticCorrection", DataType_Boolean, this.NeedCosmeticCorrection);
        save("NeedDebayer", DataType_Boolean, this.NeedDebayer);
        save("SplitChannels", DataType_Boolean, this.SplitChannels);
        save("NeedABE", DataType_Boolean, this.NeedABE);
        save("NeedRegister", DataType_Boolean, this.NeedRegister);
        save("NeedNormalization", DataType_Boolean, this.NeedNormalization);
        save("NeedApproving", DataType_Boolean, this.NeedApproving);
        save("NeedIntegration", DataType_Boolean, this.NeedIntegration);
        save("NeedDrizzle", DataType_Boolean, this.NeedDrizzle);
        save("DrizzleScale", DataType_Int16, this.DrizzleScale);
        save("DrizzleDropShrink", DataType_Int16, this.DrizzleDropShrink);

        save("CalibratationMastersPath", DataType_String, this.CalibratationMastersPath);
        save("RegistrationReferencesPath", DataType_String, this.RegistrationReferencesPath);
        save("NormalizationReferencesPath", DataType_String, this.NormalizationReferencesPath);

        save("NormalizationScale", DataType_Int16, this.NormalizationScale);
        save("NormalizationNoScaleFlag", DataType_Boolean, this.NormalizationNoScaleFlag);
        save("NormalizationNoScaleFlag", DataType_Boolean, this.NormalizationNoScaleFlag);

        save("OutputFileSize", DataType_Int16, this.OutputFormatIC);

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

        Parameters.set("NeedCalibration", 			this.NeedCalibration);
        Parameters.set("NeedCosmeticCorrection", 	this.NeedCosmeticCorrection);
        Parameters.set("NeedDebayer", this.NeedDebayer);
        Parameters.set("SplitChannels", this.SplitChannels);
        Parameters.set("NeedABE", 					this.NeedABE);
        Parameters.set("NeedRegister", 				this.NeedRegister);
        Parameters.set("NeedNormalization", 		this.NeedNormalization);
        Parameters.set("NeedApproving", 			this.NeedApproving);
        Parameters.set("NeedIntegration", this.NeedIntegration);
        Parameters.set("NeedDrizzle", this.NeedDrizzle);
        Parameters.set("DrizzleScale", this.DrizzleScale);
        Parameters.set("DrizzleDropShrink", this.DrizzleDropShrink);

        Parameters.set("CalibratationMastersPath",      this.CalibratationMastersPath);
        Parameters.set("RegistrationReferencesPath",    this.RegistrationReferencesPath);
        Parameters.set("NormalizationReferencesPath",   this.NormalizationReferencesPath);

        Parameters.set("NormalizationScale",            this.NormalizationScale);
        Parameters.set("NormalizationNoScaleFlag",      this.NormalizationNoScaleFlag);

        Parameters.set("OutputFileSize",                this.OutputFormatIC);

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
        if (Parameters.has("NeedDebayer"))
            this.NeedDebayer = Parameters.getBoolean("NeedDebayer");
        if (Parameters.has("SplitChannels"))
            this.SplitChannels = Parameters.getBoolean("SplitChannels");
        if (Parameters.has("NeedABE"))
            this.NeedABE = Parameters.getBoolean("NeedABE");
        if (Parameters.has("NeedRegister"))
            this.NeedRegister = Parameters.getBoolean("NeedRegister");
        if (Parameters.has("NeedNormalization"))
            this.NeedNormalization = Parameters.getBoolean("NeedNormalization");
        if (Parameters.has("NeedApproving"))
            this.NeedApproving = Parameters.getBoolean("NeedApproving");
        if (Parameters.has("NeedIntegration"))
            this.NeedIntegration = Parameters.getBoolean("NeedIntegration");
        if (Parameters.has("NeedDrizzle"))
            this.NeedDrizzle = Parameters.getBoolean("NeedDrizzle");
        if (Parameters.has("DrizzleScale"))
            this.DrizzleScale = Parameters.getInteger("DrizzleScale");
        if (Parameters.has("DrizzleDropShrink"))
            this.DrizzleDropShrink = Parameters.getInteger("DrizzleDropShrink");

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

        if (Parameters.has("OutputFileSize"))
            this.OutputFormatIC = Parameters.getInteger("OutputFileSize");

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
        console.writeln("NeedDebayer: " + this.NeedDebayer);
        console.writeln("SplitChannels: " + this.SplitChannels);
        console.writeln("NeedABE:                        " + this.NeedABE);
        console.writeln("NeedRegister:                   " + this.NeedRegister);
        console.writeln("NeedNormalization:              " + this.NeedNormalization);
        console.writeln("NeedApproving:              	 " + this.NeedApproving);
        console.writeln("NeedIntegration:                " + this.NeedIntegration);
        console.writeln("NeedDrizzle:                    " + this.NeedDrizzle);
        console.writeln("DrizzleScale:                   " + this.DrizzleScale);
        console.writeln("DrizzleDropShrink:              " + this.DrizzleDropShrink);

        console.writeln("CalibratationMastersPath:       " + this.CalibratationMastersPath);
        console.writeln("RegistrationReferencesPath:     " + this.RegistrationReferencesPath);
        console.writeln("NormalizationReferencesPath:    " + this.NormalizationReferencesPath);

        console.writeln("NormalizationScale:             " + this.NormalizationScale);
        console.writeln("NormalizationNoScaleFlag:       " + this.NormalizationNoScaleFlag);

        console.writeln("OutputFileSize:                 " + this.OutputFormatIC);
        
    }

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
