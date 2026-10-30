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
    this.Workflow = null; // Legacy configs derive the workflow from NeedDebayer.
    this.OSCSplitStage = "before-registration";
    this.NeedDebayer = true; // OSC preference; MONO and CFA Drizzle ignore this stage.
    this.SplitChannels = false;
    this.RegistrationRetryMode2 = true;
    this.NormalizationUsePSF = true;
    this.NormalizationGenerateData = false;
    this.NeedIntegration = false;
    this.IntegrationMethod = "image-integration";
    this.DrizzleScale = 2.0;
    this.DrizzleDropShrink = 0.9;
    this.IntegrationWeightMode = "psf-signal";
    this.IntegrationSigmaLow = 4.0;
    this.IntegrationSigmaHigh = 3.0;
    //temp
    this.outputExtension = "fits";
    this.outputHints = "";
    this.overwriteExisting = true;

    if (DEBUG)
        console.writeln('<br/><br/>Config object created...<br/>');

    /**
     * Validate the three workflow identifiers without changing stage preferences.
     * Preserves OSC preferences while MONO is selected. Takes no arguments.
     * @return {undefined} Updates only this configuration object.
     */
    this.normalizeWorkflow = function () {
        if (this.Workflow == null) this.Workflow = this.NeedDebayer ? "OSC" : "MONO";
        if (this.Workflow != "OSC" && this.Workflow != "OSC_CFA_DRIZZLE") this.Workflow = "MONO";
        if (this.OSCSplitStage != "after-registration") this.OSCSplitStage = "before-registration";
    };

    /**
     * Validate Integration method, Drizzle parameters, weighting choices and sigma thresholds.
     * Takes no arguments; replaces invalid thresholds with the UI defaults.
     * @return {undefined} Updates this configuration object only.
     */
    this.normalizeIntegrationSettings = function () {
        if (this.IntegrationMethod != "drizzle-integration") this.IntegrationMethod = "image-integration";
        if ([1, 2, 3].indexOf(this.DrizzleScale) < 0) this.DrizzleScale = 2;
        if (typeof this.DrizzleDropShrink != "number" || !isFinite(this.DrizzleDropShrink) ||
            this.DrizzleDropShrink < 0.1 || this.DrizzleDropShrink > 1) this.DrizzleDropShrink = 0.9;
        if (["psf-signal", "noise-evaluation", "fits-keyword"].indexOf(this.IntegrationWeightMode) < 0)
            this.IntegrationWeightMode = "psf-signal";
        if (typeof this.IntegrationSigmaLow != "number" || !isFinite(this.IntegrationSigmaLow) ||
            this.IntegrationSigmaLow < 0 || this.IntegrationSigmaLow > 10) this.IntegrationSigmaLow = 4.0;
        if (typeof this.IntegrationSigmaHigh != "number" || !isFinite(this.IntegrationSigmaHigh) ||
            this.IntegrationSigmaHigh < 0 || this.IntegrationSigmaHigh > 10) this.IntegrationSigmaHigh = 3.0;
    };

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
        // Migrate instances/preferences saved before the Workflow selector.
        var workflow = load("Workflow", DataType_String);
        if (workflow != null) this.Workflow = workflow;
        else if (load("NeedDebayer", DataType_Boolean) != null) this.Workflow = this.NeedDebayer ? "OSC" : "MONO";
        // Earlier UI revisions stored a preference plus a derived stage flag.
        // Version 2 stores only NeedDebayer; ignore the stale legacy key thereafter.
        if (load("WorkflowSettingsVersion", DataType_Int16) != 2) {
            var legacyDebayer = load("OSCDebayer", DataType_Boolean);
            if (legacyDebayer != null) this.NeedDebayer = legacyDebayer;
            else if (this.Workflow == "MONO") this.NeedDebayer = true;
        }
        if ((o = load("OSCSplitStage", DataType_String)) != null) this.OSCSplitStage = o;
        this.normalizeWorkflow();
        if ((o = load("NeedABE", DataType_Boolean)) != null)
            this.NeedABE = o;
        if ((o = load("NeedRegister", DataType_Boolean)) != null)
            this.NeedRegister = o;
        if ((o = load("RegistrationRetryMode2", DataType_Boolean)) != null)
            this.RegistrationRetryMode2 = o;
        if ((o = load("NeedNormalization", DataType_Boolean)) != null)
            this.NeedNormalization = o;
		if ((o = load("NeedApproving", DataType_Boolean)) != null)
            this.NeedApproving = o;

        if ((o = load("CalibratationMastersPath", DataType_String)) != null)
            this.CalibratationMastersPath = o;
        if ((o = load("RegistrationReferencesPath", DataType_String)) != null)
            this.RegistrationReferencesPath = o;
        if ((o = load("NormalizationReferencesPath", DataType_String)) != null)
            this.NormalizationReferencesPath = o;

        if ((o = load("NormalizationGenerateData", DataType_Boolean)) != null)
            this.NormalizationGenerateData = o;
        if ((o = load("NormalizationUsePSF", DataType_Boolean)) != null)
            this.NormalizationUsePSF = o;
        if ((o = load("NormalizationScale", DataType_Int16)) != null)
            this.NormalizationScale = o;
        if ((o = load("NormalizationNoScaleFlag", DataType_Boolean)) != null)
            this.NormalizationNoScaleFlag = o;

        if ((o = load("NeedIntegration", DataType_Boolean)) != null)
            this.NeedIntegration = o;
        if ((o = load("IntegrationMethod", DataType_String)) != null)
            this.IntegrationMethod = o;
        if ((o = load("DrizzleScale", DataType_Double)) != null)
            this.DrizzleScale = o;
        if ((o = load("DrizzleDropShrink", DataType_Double)) != null)
            this.DrizzleDropShrink = o;
        if ((o = load("IntegrationWeightMode", DataType_String)) != null)
            this.IntegrationWeightMode = o;
        if ((o = load("IntegrationSigmaLow", DataType_Double)) != null)
            this.IntegrationSigmaLow = o;

        if ((o = load("IntegrationSigmaHigh", DataType_Double)) != null)
            this.IntegrationSigmaHigh = o;

        this.normalizeIntegrationSettings();

        if ((o = load("OutputFileSize", DataType_Int16)) != null)
            this.OutputFormatIC = o;

    }

    /**
     * Persist the last workflow and its OSC choices as soon as the user changes them.
     * @return {undefined} Writes only workflow-related application Settings.
     * Takes no arguments; validates workflow identifiers before writing.
     */
    this.saveWorkflowSettings = function () {
        this.normalizeWorkflow();
        save("Workflow", DataType_String, this.Workflow);
        save("WorkflowSettingsVersion", DataType_Int16, 2);
        save("OSCSplitStage", DataType_String, this.OSCSplitStage);
        save("SplitChannels", DataType_Boolean, this.SplitChannels);
        save("NeedDebayer", DataType_Boolean, this.NeedDebayer);
    };

    this.saveSettings = function () {
        this.saveWorkflowSettings();
        save("InputPath", DataType_String, this.InputPath);
        save("PathMode", DataType_Int16, this.PathMode);
        save("SearchInSubDirs", DataType_Boolean, this.SearchInSubDirs);

        save("NeedCalibration", DataType_Boolean, this.NeedCalibration);
        save("NeedCosmeticCorrection", DataType_Boolean, this.NeedCosmeticCorrection);
        save("NeedABE", DataType_Boolean, this.NeedABE);
        save("NeedRegister", DataType_Boolean, this.NeedRegister);
        save("RegistrationRetryMode2", DataType_Boolean, this.RegistrationRetryMode2);
        save("NeedNormalization", DataType_Boolean, this.NeedNormalization);
        save("NeedApproving", DataType_Boolean, this.NeedApproving);

        save("CalibratationMastersPath", DataType_String, this.CalibratationMastersPath);
        save("RegistrationReferencesPath", DataType_String, this.RegistrationReferencesPath);
        save("NormalizationReferencesPath", DataType_String, this.NormalizationReferencesPath);

        save("NormalizationGenerateData", DataType_Boolean, this.NormalizationGenerateData);
        save("NormalizationUsePSF", DataType_Boolean, this.NormalizationUsePSF);
        save("NormalizationScale", DataType_Int16, this.NormalizationScale);
        save("NormalizationNoScaleFlag", DataType_Boolean, this.NormalizationNoScaleFlag);

        this.normalizeIntegrationSettings();
        save("NeedIntegration", DataType_Boolean, this.NeedIntegration);

        save("IntegrationMethod", DataType_String, this.IntegrationMethod);
        save("DrizzleScale", DataType_Double, this.DrizzleScale);
        save("DrizzleDropShrink", DataType_Double, this.DrizzleDropShrink);
        save("IntegrationWeightMode", DataType_String, this.IntegrationWeightMode);
        save("IntegrationSigmaLow", DataType_Double, this.IntegrationSigmaLow);
        save("IntegrationSigmaHigh", DataType_Double, this.IntegrationSigmaHigh);
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
        this.normalizeWorkflow();
        Parameters.set("Workflow", this.Workflow);
        Parameters.set("WorkflowSettingsVersion", 2);
        Parameters.set("OSCSplitStage", this.OSCSplitStage);
        Parameters.set("InputPath", this.InputPath);
        Parameters.set("PathMode", this.PathMode);
        Parameters.set("SearchInSubDirs", this.SearchInSubDirs);

        Parameters.set("NeedCalibration", 			this.NeedCalibration);
        Parameters.set("NeedCosmeticCorrection", 	this.NeedCosmeticCorrection);
        Parameters.set("NeedDebayer", this.NeedDebayer);
        Parameters.set("SplitChannels", this.SplitChannels);
        Parameters.set("NeedABE", 					this.NeedABE);
        Parameters.set("NeedRegister", 				this.NeedRegister);
        Parameters.set("RegistrationRetryMode2", this.RegistrationRetryMode2);
        Parameters.set("NeedNormalization", 		this.NeedNormalization);
        Parameters.set("NeedApproving", 			this.NeedApproving);

        Parameters.set("CalibratationMastersPath",      this.CalibratationMastersPath);
        Parameters.set("RegistrationReferencesPath",    this.RegistrationReferencesPath);
        Parameters.set("NormalizationReferencesPath",   this.NormalizationReferencesPath);

        Parameters.set("NormalizationGenerateData", this.NormalizationGenerateData);
        Parameters.set("NormalizationUsePSF", this.NormalizationUsePSF);
        Parameters.set("NormalizationScale",            this.NormalizationScale);
        Parameters.set("NormalizationNoScaleFlag",      this.NormalizationNoScaleFlag);

        this.normalizeIntegrationSettings();
        Parameters.set("NeedIntegration", this.NeedIntegration);

        Parameters.set("IntegrationMethod", this.IntegrationMethod);
        Parameters.set("DrizzleScale", this.DrizzleScale);
        Parameters.set("DrizzleDropShrink", this.DrizzleDropShrink);
        Parameters.set("IntegrationWeightMode", this.IntegrationWeightMode);
        Parameters.set("IntegrationSigmaLow", this.IntegrationSigmaLow);
        Parameters.set("IntegrationSigmaHigh", this.IntegrationSigmaHigh);
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
        this.Workflow = Parameters.has("Workflow") ? Parameters.getString("Workflow") : (this.NeedDebayer ? "OSC" : "MONO");
        if (!Parameters.has("WorkflowSettingsVersion") || Parameters.getInteger("WorkflowSettingsVersion") != 2) {
            if (Parameters.has("OSCDebayer")) this.NeedDebayer = Parameters.getBoolean("OSCDebayer");
            else if (this.Workflow == "MONO") this.NeedDebayer = true;
        }
        if (Parameters.has("OSCSplitStage")) this.OSCSplitStage = Parameters.getString("OSCSplitStage");
        else this.OSCSplitStage = "before-registration";
        this.normalizeWorkflow();
        if (Parameters.has("NeedABE"))
            this.NeedABE = Parameters.getBoolean("NeedABE");
        if (Parameters.has("NeedRegister"))
            this.NeedRegister = Parameters.getBoolean("NeedRegister");
        if (Parameters.has("RegistrationRetryMode2"))
            this.RegistrationRetryMode2 = Parameters.getBoolean("RegistrationRetryMode2");
        if (Parameters.has("NeedNormalization"))
            this.NeedNormalization = Parameters.getBoolean("NeedNormalization");
        if (Parameters.has("NeedApproving"))
            this.NeedApproving = Parameters.getBoolean("NeedApproving");

        if (Parameters.has("CalibratationMastersPath"))
            this.CalibratationMastersPath = Parameters.getString("CalibratationMastersPath");
        if (Parameters.has("RegistrationReferencesPath"))
            this.RegistrationReferencesPath = Parameters.getString("RegistrationReferencesPath");
        if (Parameters.has("NormalizationReferencesPath"))
            this.NormalizationReferencesPath = Parameters.getString("NormalizationReferencesPath");

        if (Parameters.has("NormalizationGenerateData"))
            this.NormalizationGenerateData = Parameters.getBoolean("NormalizationGenerateData");
        if (Parameters.has("NormalizationUsePSF"))
            this.NormalizationUsePSF = Parameters.getBoolean("NormalizationUsePSF");
        if (Parameters.has("NormalizationScale"))
            this.NormalizationScale = Parameters.getInteger("NormalizationScale");
        if (Parameters.has("NormalizationNoScaleFlag"))
            this.NormalizationNoScaleFlag = Parameters.getBoolean("NormalizationNoScaleFlag");

        if (Parameters.has("NeedIntegration"))
            this.NeedIntegration = Parameters.getBoolean("NeedIntegration");
        if (Parameters.has("IntegrationMethod"))
            this.IntegrationMethod = Parameters.getString("IntegrationMethod");
        if (Parameters.has("DrizzleScale"))
            this.DrizzleScale = Parameters.getReal("DrizzleScale");
        if (Parameters.has("DrizzleDropShrink"))
            this.DrizzleDropShrink = Parameters.getReal("DrizzleDropShrink");
        if (Parameters.has("IntegrationWeightMode"))
            this.IntegrationWeightMode = Parameters.getString("IntegrationWeightMode");
        if (Parameters.has("IntegrationSigmaLow"))
            this.IntegrationSigmaLow = Parameters.getReal("IntegrationSigmaLow");

        if (Parameters.has("IntegrationSigmaHigh"))
            this.IntegrationSigmaHigh = Parameters.getReal("IntegrationSigmaHigh");

        this.normalizeIntegrationSettings();

        if (Parameters.has("OutputFileSize"))
            this.OutputFormatIC = Parameters.getInteger("OutputFileSize");

        if (DEBUG) {
            console.writeln("<b>Loaded Parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.printParameters = function () {
        console.writeln("Workflow: " + this.Workflow);
        console.writeln("OSC split stage: " + this.OSCSplitStage);
        console.writeln("InputPath:                      " + this.InputPath);
        console.writeln("PathMode:                       " + this.PathMode);
        console.writeln("SearchInSubDirs:                " + this.SearchInSubDirs);

        console.writeln("NeedCalibration:                " + this.NeedCalibration);
        console.writeln("NeedCosmeticCorrection:         " + this.NeedCosmeticCorrection);
        console.writeln("NeedDebayer: " + this.NeedDebayer);
        console.writeln("SplitChannels: " + this.SplitChannels);
        console.writeln("NeedABE:                        " + this.NeedABE);
        console.writeln("NeedRegister:                   " + this.NeedRegister);
        console.writeln("RegistrationRetryMode2:          " + this.RegistrationRetryMode2);
        console.writeln("NeedNormalization:              " + this.NeedNormalization);
        console.writeln("NeedApproving:              	 " + this.NeedApproving);

        console.writeln("CalibratationMastersPath:       " + this.CalibratationMastersPath);
        console.writeln("RegistrationReferencesPath:     " + this.RegistrationReferencesPath);
        console.writeln("NormalizationReferencesPath:    " + this.NormalizationReferencesPath);

        console.writeln("NormalizationGenerateData: " + this.NormalizationGenerateData);
        console.writeln("NormalizationUsePSF:            " + this.NormalizationUsePSF);
        console.writeln("NormalizationScale:             " + this.NormalizationScale);
        console.writeln("NormalizationNoScaleFlag:       " + this.NormalizationNoScaleFlag);

        console.writeln("NeedIntegration: " + this.NeedIntegration);

        console.writeln("IntegrationMethod: " + this.IntegrationMethod);
        console.writeln("DrizzleScale: " + this.DrizzleScale);
        console.writeln("DrizzleDropShrink: " + this.DrizzleDropShrink);
        console.writeln("IntegrationWeightMode: " + this.IntegrationWeightMode);
        console.writeln("IntegrationSigmaLow: " + this.IntegrationSigmaLow);
        console.writeln("IntegrationSigmaHigh: " + this.IntegrationSigmaHigh);
        console.writeln("OutputFileSize:                 " + this.OutputFormatIC);
        
    }

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
