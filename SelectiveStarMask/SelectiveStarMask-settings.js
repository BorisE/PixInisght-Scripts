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

    function setLongParameter(key, value) {
        const chunkSize = 60000;
        let chunks = 0;

        if (value == null || value.length === 0) {
            Parameters.set(key + "_chunks", 0);
            return;
        }

        for (let i = 0; i < value.length; i += chunkSize) {
            Parameters.set(key + "_" + chunks, value.substr(i, chunkSize));
            ++chunks;
        }
        Parameters.set(key + "_chunks", chunks);
    }

    function getLongParameter(key) {
        if (!Parameters.has(key + "_chunks"))
            return "";

        const chunks = Parameters.getInteger(key + "_chunks");
        if (chunks <= 0)
            return "";

        let value = "";
        for (let i = 0; i < chunks; ++i) {
            const chunkKey = key + "_" + i;
            if (Parameters.has(chunkKey))
                value += Parameters.getString(chunkKey);
        }
        return value;
    }

    function serializeStarData(stars) {
        if (!stars || stars.length === 0)
            return "[]";

        let payload = new Array(stars.length);
        for (let i = 0; i < stars.length; ++i) {
            let s = stars[i];
            payload[i] = {
                idx: s.idx,
                pos: s.pos ? { x: s.pos.x, y: s.pos.y } : null,
                flux: s.flux,
                bkg: s.bkg,
                rect: s.rect ? { x0: s.rect.x0, y0: s.rect.y0, x1: s.rect.x1, y1: s.rect.y1 } : null,
                size: s.size,
                nmax: s.nmax,
                sizeRadius: s.sizeRadius,
                w: s.w,
                h: s.h,
                diag: s.diag,
                sizeGroup: s.sizeGroup,
                fluxGroup: s.fluxGroup,
                fluxLog: s.fluxLog,
                PSF_StarIndex: s.PSF_StarIndex,
                PSF_Status: s.PSF_Status,
                PSF_b: s.PSF_b,
                PSF_a: s.PSF_a,
                PSF_cx: s.PSF_cx,
                PSF_cy: s.PSF_cy,
                PSF_sx: s.PSF_sx,
                PSF_sy: s.PSF_sy,
                PSF_theta: s.PSF_theta,
                PSF_residual: s.PSF_residual,
                PSF_flux: s.PSF_flux,
                PSF_rect: s.PSF_rect ? { x0: s.PSF_rect.x0, y0: s.PSF_rect.y0, x1: s.PSF_rect.x1, y1: s.PSF_rect.y1 } : null,
                PSF_diag: s.PSF_diag,
                FWHMx: s.FWHMx,
                FWHMy: s.FWHMy,
                drawEllipse_W: s.drawEllipse_W,
                drawEllipse_H: s.drawEllipse_H,
                drawEllipse_type: s.drawEllipse_type
            };
        }
        return JSON.stringify(payload);
    }

    function deserializeStarData(serializedStars) {
        if (!serializedStars)
            return [];

        let parsed = JSON.parse(serializedStars);
        if (!parsed || !parsed.length)
            return [];

        let stars = new Array(parsed.length);
        for (let i = 0; i < parsed.length; ++i) {
            let item = parsed[i];
            let star = {};
            for (let key in item)
                star[key] = item[key];
            if (item.pos)
                star.pos = new Point(item.pos.x, item.pos.y);
            if (item.rect)
                star.rect = new Rect(item.rect.x0, item.rect.y0, item.rect.x1, item.rect.y1);
            if (item.PSF_rect)
                star.PSF_rect = new Rect(item.PSF_rect.x0, item.PSF_rect.y0, item.PSF_rect.x1, item.PSF_rect.y1);
            stars[i] = star;
        }
        return stars;
    }

    function exportEngineState() {
        if (typeof Engine === "undefined" || !Engine || !Engine.Stars || Engine.Stars.length === 0) {
            Parameters.set("hasStarsData", false);
            setLongParameter("StarsDataJson", "");
            return;
        }

        Parameters.set("hasStarsData", true);
        setLongParameter("StarsDataJson", serializeStarData(Engine.Stars));
    }

    function importEngineState() {
        if (typeof Engine === "undefined" || !Engine)
            return;

        Engine.hasImportedStarsData = false;

        if (!Parameters.has("hasStarsData") || !Parameters.getBoolean("hasStarsData"))
            return;

        let stars = [];
        try {
            stars = deserializeStarData(getLongParameter("StarsDataJson"));
        } catch (e) {
            console.warningln("Unable to restore stars data from instance: " + e);
            stars = [];
        }

        if (!stars || stars.length === 0)
            return;

        Engine.Stars = stars;
        Engine.FilteredStars = undefined;
        Engine.filterApplied = false;
        Engine.cntFittedStars = 0;
        Engine.calculateStarStats(Engine.Stars);
        Engine.hasImportedStarsData = true;
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
        exportEngineState();

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
        importEngineState();

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
