 #ifndef __STARMASKSIZE_SETTINGS__
    #define __STARMASKSIZE_SETTINGS__
    #include <pjsr/DataType.jsh>
 #endif

#ifndef __DEBUGF__
	#define __DEBUGF__ true  /*or false*/
#endif


/*
 When adding new component to UI, we need to:
 UI prt:
    Create object, Horiz spacer for it, add it to Vert spacer.
 Settings part:
    1) loadSettings() with Config.name (but instead of "Config." use "this.") - (watch for data type!) - and specify default value
    2) saveSettings() with Config.name  (watch for data type!)
    3) importSettings() with Config.name (watch for data type!)
    4) exportSettings() with Config.name 
    5) printParameters() with Config.name 
*/

#define MAX_INT 1000000

function ConfigData() {

    if (__DEBUGF__)
        console.writeln('<br/><br/>Config object created...<br/>');

    //Helper functions
    function load(key, type, default_value) {
        let retV = Settings.read(SETTINGS_KEY_BASE + key, type);
        if  (retV == null) retV = default_value;
        return retV;
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

        if ((o = load("softenMask", DataType_Boolean, true)) != null)
            this.softenMask = o;
        if ((o = load("contourMask", DataType_Boolean, false)) != null)
            this.contourMask = o;
        if ((o = load("maskGrowth", DataType_Boolean, true)) != null)
            this.maskGrowth = o;
        
        if ((o = load("FilterSize_min", DataType_Float, 0)) != null)
            this.FilterSize_min = o;
        if ((o = load("FilterSize_max", DataType_Float, MAX_INT)) != null)
            this.FilterSize_max = o;
        if ((o = load("FilterFlux_min", DataType_Float, 0)) != null)
            this.FilterFlux_min = o;
        if ((o = load("FilterFlux_max", DataType_Float, MAX_INT)) != null)
            this.FilterFlux_max = o;

        
        /*
        if ((o = load("InputPath", DataType_String)) != null)
            this.InputPath = o;
        if ((o = load("SearchInSubDirs", DataType_Boolean)) != null)
            this.SearchInSubDirs = o;
        if ((o = load("OutputFileSize", DataType_Int16)) != null)
            this.OutputFormatIC = o;
        */

        if (__DEBUGF__) {
            console.writeln("\n<b>Loaded parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.saveSettings = function () {
        save("softenMask", DataType_Boolean, this.softenMask);
        save("contourMask", DataType_Boolean, this.contourMask);
        save("maskGrowth", DataType_Boolean, this.maskGrowth);

        save("FilterSize_min", DataType_Float, this.FilterSize_min);
        save("FilterSize_max", DataType_Float, this.FilterSize_max);
        save("FilterFlux_min", DataType_Float, this.FilterFlux_min);
        save("FilterFlux_max", DataType_Float, this.FilterFlux_max);

        /* =
        save("NeedCalibration", DataType_Boolean, this.NeedCalibration);
        save("CalibratationMastersPath", DataType_String, this.CalibratationMastersPath);
        save("NormalizationScale", DataType_Int16, this.NormalizationScale);
        */

        if (__DEBUGF__) {
            console.writeln("\n<b>Settings saved:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    /*
     * Import / Export script parameters (global or target View run)
     */
    this.exportParameters = function () {

        Parameters.set("softenMask", 			this.softenMask);
        Parameters.set("contourMask", 			this.contourMask);
        Parameters.set("maskGrowth", 			this.maskGrowth);
        
        Parameters.set("FilterSize_min",        this.FilterSize_min);
        Parameters.set("FilterSize_max",        this.FilterSize_max);
        Parameters.set("FilterFlux_min",        this.FilterFlux_min);
        Parameters.set("FilterFlux_max",        this.FilterFlux_max);

        /*
        Parameters.set("NeedCalibration", 			this.NeedCalibration);
        Parameters.set("CalibratationMastersPath",      this.CalibratationMastersPath);
        Parameters.set("NormalizationScale",            this.NormalizationScale);
        */
        if (__DEBUGF__) {
            console.writeln("\n<b>Loaded Parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.importParameters = function () {
        if (Parameters.has("softenMask"))
            this.softenMask = Parameters.getBoolean("softenMask");
        if (Parameters.has("contourMask"))
            this.contourMask = Parameters.getBoolean("contourMask");
        if (Parameters.has("maskGrowth"))
            this.maskGrowth = Parameters.getBoolean("maskGrowth");

        if (Parameters.has("FilterSize_min"))
            this.FilterSize_min = Parameters.getReal("FilterSize_min");
        if (Parameters.has("FilterSize_max"))
            this.FilterSize_max = Parameters.getReal("FilterSize_max");
        if (Parameters.has("FilterFlux_min"))
            this.FilterFlux_min = Parameters.getReal("FilterFlux_min");
        if (Parameters.has("FilterFlux_max"))
            this.FilterFlux_max = Parameters.getReal("FilterFlux_max");

        /*
        if (Parameters.has("NeedCalibration"))
            this.NeedCalibration = Parameters.getBoolean("NeedCalibration");

        if (Parameters.has("CalibratationMastersPath"))
            this.CalibratationMastersPath = Parameters.getString("CalibratationMastersPath");

        if (Parameters.has("NormalizationScale"))
            this.NormalizationScale = Parameters.getInteger("NormalizationScale");
        */
        if (__DEBUGF__) {
            console.writeln("<b>Loaded Parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.printParameters = function () {
        
        console.writeln("softenMask:                     " + this.softenMask);
        console.writeln("contourMask:                    " + this.contourMask);
        console.writeln("maskGrowth:                     " + this.maskGrowth);

        console.writeln("FilterSize_min:                 " + this.FilterSize_min);
        console.writeln("FilterSize_max:                 " + this.FilterSize_max);
        console.writeln("FilterFlux_min:                 " + this.FilterFlux_min);
        console.writeln("FilterFlux_max:                 " + this.FilterFlux_max);

        /*
        console.writeln("InputPath:                      " + this.InputPath);
        console.writeln("PathMode:                       " + this.PathMode);
        console.writeln("SearchInSubDirs:                " + this.SearchInSubDirs);

        console.writeln("NeedCalibration:                " + this.NeedCalibration);
        console.writeln("NeedCosmeticCorrection:         " + this.NeedCosmeticCorrection);
        console.writeln("NeedABE:                        " + this.NeedABE);
        console.writeln("NeedRegister:                   " + this.NeedRegister);
        console.writeln("NeedNormalization:              " + this.NeedNormalization);
        console.writeln("NeedApproving:              	 " + this.NeedApproving);

        console.writeln("CalibratationMastersPath:       " + this.CalibratationMastersPath);
        console.writeln("RegistrationReferencesPath:     " + this.RegistrationReferencesPath);
        console.writeln("NormalizationReferencesPath:    " + this.NormalizationReferencesPath);

        console.writeln("NormalizationScale:             " + this.NormalizationScale);
        console.writeln("NormalizationNoScaleFlag:       " + this.NormalizationNoScaleFlag);

        console.writeln("OutputFileSize:                 " + this.OutputFormatIC);
        */
    }

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
