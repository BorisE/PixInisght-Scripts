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
        const chunkSize = 8000;
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
            return "";

        function encodeValue(v) {
            return v == null || v === undefined ? "" : v.toString();
        }

        let rows = new Array(stars.length + 1);
        rows[0] = "SSMSTARV1";
        for (let i = 0; i < stars.length; ++i) {
            let s = stars[i];
            rows[i + 1] = [
                encodeValue(s.idx),
                encodeValue(s.pos ? s.pos.x : undefined),
                encodeValue(s.pos ? s.pos.y : undefined),
                encodeValue(s.flux),
                encodeValue(s.bkg),
                encodeValue(s.rect ? s.rect.x0 : undefined),
                encodeValue(s.rect ? s.rect.y0 : undefined),
                encodeValue(s.rect ? s.rect.x1 : undefined),
                encodeValue(s.rect ? s.rect.y1 : undefined),
                encodeValue(s.size),
                encodeValue(s.nmax),
                encodeValue(s.sizeRadius),
                encodeValue(s.w),
                encodeValue(s.h),
                encodeValue(s.diag),
                encodeValue(s.sizeGroup),
                encodeValue(s.fluxGroup),
                encodeValue(s.fluxLog),
                encodeValue(s.PSF_StarIndex),
                encodeValue(s.PSF_Status),
                encodeValue(s.PSF_b),
                encodeValue(s.PSF_a),
                encodeValue(s.PSF_cx),
                encodeValue(s.PSF_cy),
                encodeValue(s.PSF_sx),
                encodeValue(s.PSF_sy),
                encodeValue(s.PSF_theta),
                encodeValue(s.PSF_residual),
                encodeValue(s.PSF_flux),
                encodeValue(s.PSF_rect ? s.PSF_rect.x0 : undefined),
                encodeValue(s.PSF_rect ? s.PSF_rect.y0 : undefined),
                encodeValue(s.PSF_rect ? s.PSF_rect.x1 : undefined),
                encodeValue(s.PSF_rect ? s.PSF_rect.y1 : undefined),
                encodeValue(s.PSF_diag),
                encodeValue(s.FWHMx),
                encodeValue(s.FWHMy),
                encodeValue(s.drawEllipse_W),
                encodeValue(s.drawEllipse_H),
                encodeValue(s.drawEllipse_type)
            ].join("|");
        }
        return rows.join("~");
    }

    function deserializeStarData(serializedStars) {
        if (!serializedStars)
            return [];

        function parseNumber(v) {
            if (v == null || v === "")
                return undefined;
            let n = Number(v);
            return isNaN(n) ? undefined : n;
        }

        let rows = serializedStars.split("~");
        if (rows.length === 0 || rows[0] !== "SSMSTARV1")
            throw new Error("Unsupported or corrupted stars data format");

        let stars = [];
        for (let i = 1; i < rows.length; ++i) {
            if (!rows[i])
                continue;
            let f = rows[i].split("|");
            if (f.length < 39)
                continue;

            let rectX0 = parseNumber(f[5]);
            let rectY0 = parseNumber(f[6]);
            let rectX1 = parseNumber(f[7]);
            let rectY1 = parseNumber(f[8]);

            let psfRectX0 = parseNumber(f[29]);
            let psfRectY0 = parseNumber(f[30]);
            let psfRectX1 = parseNumber(f[31]);
            let psfRectY1 = parseNumber(f[32]);

            stars.push({
                idx: parseNumber(f[0]),
                pos: parseNumber(f[1]) !== undefined && parseNumber(f[2]) !== undefined ? new Point(parseNumber(f[1]), parseNumber(f[2])) : undefined,
                flux: parseNumber(f[3]),
                bkg: parseNumber(f[4]),
                rect: rectX0 !== undefined && rectY0 !== undefined && rectX1 !== undefined && rectY1 !== undefined ? new Rect(rectX0, rectY0, rectX1, rectY1) : undefined,
                size: parseNumber(f[9]),
                nmax: parseNumber(f[10]),
                sizeRadius: parseNumber(f[11]),
                w: parseNumber(f[12]),
                h: parseNumber(f[13]),
                diag: parseNumber(f[14]),
                sizeGroup: parseNumber(f[15]),
                fluxGroup: parseNumber(f[16]),
                fluxLog: parseNumber(f[17]),
                PSF_StarIndex: parseNumber(f[18]),
                PSF_Status: parseNumber(f[19]),
                PSF_b: parseNumber(f[20]),
                PSF_a: parseNumber(f[21]),
                PSF_cx: parseNumber(f[22]),
                PSF_cy: parseNumber(f[23]),
                PSF_sx: parseNumber(f[24]),
                PSF_sy: parseNumber(f[25]),
                PSF_theta: parseNumber(f[26]),
                PSF_residual: parseNumber(f[27]),
                PSF_flux: parseNumber(f[28]),
                PSF_rect: psfRectX0 !== undefined && psfRectY0 !== undefined && psfRectX1 !== undefined && psfRectY1 !== undefined ? new Rect(psfRectX0, psfRectY0, psfRectX1, psfRectY1) : undefined,
                PSF_diag: parseNumber(f[33]),
                FWHMx: parseNumber(f[34]),
                FWHMy: parseNumber(f[35]),
                drawEllipse_W: parseNumber(f[36]),
                drawEllipse_H: parseNumber(f[37]),
                drawEllipse_type: parseNumber(f[38])
            });
        }
        return stars;
    }

    function exportEngineState() {
        if (typeof Engine === "undefined" || !Engine || !Engine.Stars || Engine.Stars.length === 0) {
            Parameters.set("hasStarsData", false);
            Parameters.set("sourceViewId", "");
            setLongParameter("StarsDataJson", "");
            return;
        }

        Parameters.set("hasStarsData", true);
        Parameters.set("sourceViewId", Engine.sourceView ? Engine.sourceView.fullId : "");
        setLongParameter("StarsDataJson", serializeStarData(Engine.Stars));
    }

    function findViewById(viewId) {
        if (!viewId || viewId.length === 0)
            return null;

        if (typeof View !== "undefined" && View.viewById) {
            let v = View.viewById(viewId);
            if (v && !v.isNull)
                return v;
        }

        if (typeof ImageWindow !== "undefined" && ImageWindow.windows) {
            let windows = ImageWindow.windows;
            for (let i = 0; i < windows.length; ++i) {
                let w = windows[i];
                if (!w || w.isNull || !w.mainView)
                    continue;
                if (w.mainView.fullId === viewId || w.mainView.id === viewId)
                    return w.mainView;
            }
        }

        return null;
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

        let sourceViewId = Parameters.has("sourceViewId") ? Parameters.getString("sourceViewId") : "";
        let sourceView = findViewById(sourceViewId);
        if (!sourceView && typeof ImageWindow !== "undefined" && ImageWindow.activeWindow && !ImageWindow.activeWindow.isNull)
            sourceView = ImageWindow.activeWindow.currentView;

        Engine.Stars = stars;
        Engine.FilteredStars = undefined;
        Engine.filterApplied = false;
        Engine.cntFittedStars = 0;
        Engine.sourceViewId = sourceViewId;
        Engine.sourceView = sourceView;
        Engine.sourceImage = sourceView ? sourceView.image : undefined;
        Engine.workingView = Engine.sourceView;
        Engine.workingImage = Engine.sourceImage;
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
