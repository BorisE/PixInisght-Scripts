#ifndef __SELECTIVESTARMASK_SETTINGS__
#define __SELECTIVESTARMASK_SETTINGS__
#include <pjsr/DataType.jsh>

#endif

#ifndef __DEBUGF__
#define __DEBUGF__ true /*or false*/
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

#ifndef MAX_INT
#define MAX_INT 10000
#endif

function ConfigData() {

    if (__DEBUGF__)
        console.writeln('<br/><br/>Config object created...<br/>');

    this.AdjFact = 0.5;
    this.AdjFactor_countor = 0.5;
    this.specialMaskType = "Normal";
    this.contourMask = false; // kept for backward compatibility with previous versions

    const validMaskTypes = ["Normal", "Star cores", "Contour mask"];

    function sanitizeMaskType(value) {
        if (validMaskTypes.indexOf(value) === -1)
            return "Normal";
        return value;
    }

    //Helper functions
    function load(key, type, default_value, precision = 2) {
        let retV = Settings.read(__SETTINGS_KEY_BASE__ + key, type);
        if (retV == null) retV = default_value;
        // Need to round float to give precision, because it seems that arbitrary numbers can be added to lower decimals (like 3.2100000000012)
        if (type == DataType_Float) retV = round(retV, precision);
        return retV;
    }

    function loadIndexed(key, index, type) {
        return load(key + '_' + index.toString(), type);
    }

    function save(key, type, value) {
        Settings.write(__SETTINGS_KEY_BASE__ + key, type, value);
    }

    function saveIndexed(key, index, type, value) {
        save(key + '_' + index.toString(), type, value);
    }

    /*
     * Load / Save from Settings Storage
     */
    this.loadSettings = function() {
        var o;

        if ((o = load("softenMask", DataType_Boolean, true)) != null)
            this.softenMask = o;
        if ((o = load("contourMask", DataType_Boolean, false)) != null)
            this.contourMask = o;
        if ((o = load("specialMaskType", DataType_String, "Normal")) != null)
            this.specialMaskType = sanitizeMaskType(o);
        if (this.contourMask)
            this.specialMaskType = "Contour mask";
        else
            this.contourMask = this.specialMaskType === "Contour mask";
        if ((o = load("maskGrowth", DataType_Boolean, true)) != null)
            this.maskGrowth = o;

        if ((o = load("FilterSize_min", DataType_Float, 0, 2)) != null)
            this.FilterSize_min = o;
        if ((o = load("FilterSize_max", DataType_Float, MAX_INT, 2)) != null)
            this.FilterSize_max = o;
        if ((o = load("FilterFlux_min", DataType_Float, 0, 3)) != null)
            this.FilterFlux_min = o;
        if ((o = load("FilterFlux_max", DataType_Float, MAX_INT, 3)) != null)
            this.FilterFlux_max = o;

        if ((o = load("AdjFact", DataType_Float, 0.5, 2)) != null)
            this.AdjFact = o;
        if ((o = load("AdjFactor_countor", DataType_Float, 0.5, 2)) != null)
            this.AdjFactor_countor = o;


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

    this.saveSettings = function() {
        save("softenMask", DataType_Boolean, this.softenMask);
        this.contourMask = this.specialMaskType === "Contour mask";
        save("contourMask", DataType_Boolean, this.contourMask);
        save("specialMaskType", DataType_String, this.specialMaskType);
        save("maskGrowth", DataType_Boolean, this.maskGrowth);

        save("FilterSize_min", DataType_Float, this.FilterSize_min);
        save("FilterSize_max", DataType_Float, this.FilterSize_max);
        save("FilterFlux_min", DataType_Float, this.FilterFlux_min);
        save("FilterFlux_max", DataType_Float, this.FilterFlux_max);
        save("AdjFact", DataType_Float, this.AdjFact);
        save("AdjFactor_countor", DataType_Float, this.AdjFactor_countor);

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
    this.exportParameters = function() {

        Parameters.set("softenMask", this.softenMask);
        this.contourMask = this.specialMaskType === "Contour mask";
        Parameters.set("contourMask", this.contourMask);
        Parameters.set("specialMaskType", this.specialMaskType);
        Parameters.set("maskGrowth", this.maskGrowth);

        Parameters.set("FilterSize_min", this.FilterSize_min);
        Parameters.set("FilterSize_max", this.FilterSize_max);
        Parameters.set("FilterFlux_min", this.FilterFlux_min);
        Parameters.set("FilterFlux_max", this.FilterFlux_max);
        Parameters.set("AdjFact", this.AdjFact);
        Parameters.set("AdjFactor_countor", this.AdjFactor_countor);

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

    this.importParameters = function() {
        if (Parameters.has("softenMask"))
            this.softenMask = Parameters.getBoolean("softenMask");
        if (Parameters.has("specialMaskType"))
            this.specialMaskType = sanitizeMaskType(Parameters.getString("specialMaskType"));
        else if (Parameters.has("contourMask"))
            this.specialMaskType = Parameters.getBoolean("contourMask") ? "Contour mask" : this.specialMaskType;
        this.contourMask = this.specialMaskType === "Contour mask";
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
        if (Parameters.has("AdjFact"))
            this.AdjFact = Parameters.getReal("AdjFact");
        if (Parameters.has("AdjFactor_countor"))
            this.AdjFactor_countor = Parameters.getReal("AdjFactor_countor");

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

    this.printParameters = function() {

        console.writeln("softenMask:                     " + this.softenMask);
        console.writeln("contourMask:                    " + this.contourMask);
        console.writeln("specialMaskType:                " + this.specialMaskType);
        console.writeln("maskGrowth:                     " + this.maskGrowth);

        console.writeln("FilterSize_min:                 " + this.FilterSize_min);
        console.writeln("FilterSize_max:                 " + this.FilterSize_max);
        console.writeln("FilterFlux_min:                 " + this.FilterFlux_min);
        console.writeln("FilterFlux_max:                 " + this.FilterFlux_max);
        console.writeln("AdjFact:                        " + this.AdjFact);
        console.writeln("AdjFactor_countor:              " + this.AdjFactor_countor);

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

    this.checkPathValidity = function() {
        return true;
    }

    this.loadDefaultValues = function() {}
}
