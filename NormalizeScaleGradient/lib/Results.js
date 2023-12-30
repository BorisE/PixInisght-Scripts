/* global File, NSG_RUN_STATUS_UNKNOWN, NSG_RUN_STATUS_FAILED, NSG_RUN_STATUS_EXCEPTION, compareResultObsDate */

// Version 1.0 (c) John Murphy 10th-March-2023
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
//"use strict";

/**
 * @param {String} resultString
 * @param {String} inputFilename 
 * @param {Boolean} failed 
 * @param {String} normalizedFilename
 * @param {Number} averageWeight
 * @param {LinearFitData[]} scaleFactors
 * @param {Number[]} snr
 * @param {Number|undefined} nPhotStars Number of photometry star matches; Undefined for ref
 * @param {HeaderEntries} headerEntries
 * @param {String} xnmlFile 
 * @param {String} LNFile specifies full filename that will be used to create the .xnml file 
 * @param {Boolean} isRef 
 * @returns {Result}
 */
function Result(resultString, inputFilename, failed, normalizedFilename,
        averageWeight, scaleFactors, snr, nPhotStars, 
        headerEntries, xnmlFile, LNFile, isRef){
    this.summary = resultString;
    this.normalizedFile = normalizedFilename;
    this.weight = averageWeight;
    this.scaleFactors = scaleFactors;
    this.snr = snr;
    this.headerEntries = headerEntries;
    this.inputFile = inputFilename;
    this.xnmlFile = xnmlFile;
    this.LNFile = LNFile;
    this.failed = failed;
    this.isRef = isRef;
    this.nPhotometryStarPairs = nPhotStars;
    this.createTime = Date.now();
    
    /**
     * @param {Number} nPairLimit
     * @returns {Boolean} true if number of photometry stars is less than nPairLimit
     */
    this.hasPhotometryWarning = function(nPairLimit){
        if (this.isRef || this.nPhotometryStarPairs === undefined ){
            return false;
        }
        return this.nPhotometryStarPairs < nPairLimit;
    };
}
Result.prototype.toString = function resultToString(){
    let ch = '\t';
    let scaleFactorStr;
    if (this.scaleFactors){
        scaleFactorStr = "scaleFactors:" + ch;
        for (let i=0; i<this.scaleFactors.length; i++){
            if (i){
                scaleFactorStr += ',';
            }
            scaleFactorStr += this.scaleFactors[i].m + ',' + this.scaleFactors[i].b;
        }
        scaleFactorStr += ch;
    } else {
        scaleFactorStr = "";
    }
    let nStarStr = "";
    if (this.nPhotometryStarPairs !== undefined && !isRef){
        nStarStr = "nPhotometryStars:" + ch + this.nPhotometryStarPairs + ch;
    }
    let createTime = this.createTime ? "createTime:" + ch + this.createTime + ch : "";
    let summary = this.summary ? "summary:" + ch + this.summary + ch : "";
    let weight = this.weight ? "weight:" + ch + this.weight + ch : "";
    let snr = this.snr ? "snr:" + ch + this.snr + ch : "";
    let failed = this.failed === undefined ? true : this.failed;
    let isRef = this.isRef !== undefined ? "isRef:" + ch + this.isRef + ch : "";
    let normalizedFileEntry = createFileEntry("normalizedFile:", ch, this.normalizedFile);
    let inputFileEntry = createFileEntry("inputFile:", ch, this.inputFile);
    let xnmlFileEntry = createFileEntry("xnmlFile:", ch, this.xnmlFile);
    let LNFileEntry = createFileEntry("LNFile:", ch, this.LNFile);
    let headerEntries = this.headerEntries ? ch + this.headerEntries.toString() : "";
    return  createTime + summary + weight + scaleFactorStr + snr + 
            "failed:" + ch + failed + ch +
            isRef + nStarStr + inputFileEntry + normalizedFileEntry + xnmlFileEntry + LNFileEntry +
            headerEntries;
};

/**
 * If the file exists and ch is '\t', return "key\tmodifyDate|filename\t". Otherwise returns "".
 * @param {String} key
 * @param {Char} ch
 * @param {String | undefined} filename
 * @returns {String}
 */
function createFileEntry (key, ch, filename){
    if (filename && File.exists(filename)){
        let modifyDate = new FileInfo(filename).lastModified.getTime();
        return key + ch + modifyDate + "|" + filename + ch;
    }
    return "";
}

/**
 * 
 * @returns {String} Date as string in format: YYYY.MM.DD_HHhMMmSSs
 */
function getDateString(){
    /**
     * @param {Number} n
     * @returns {String} number as two digit string.
     */
    function twoDigits(n){
        let prefix = n < 10 ? "0" : "";
        return prefix + n;
    }
    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth() + 1;    // January is zero
    let day = date.getDate();
    let h = date.getHours();
    let m = date.getMinutes();
    let s = date.getSeconds();
    return "" + year + "." + twoDigits(month) + "." + twoDigits(day) + "_" + 
            twoDigits(h) + "h" + twoDigits(m) + "m" + twoDigits(s) + "s";
}

/**
 * Reference filename is written to first line during construction.
 * Filename is stored in data.resultsFile
 * Use ResultFileWriter.addResult(Result) to add reference result and each target result.
 * @param {NsgData} data
 * @param {Boolean} runFromProcessIcon If true, running from a process icon.
 * @throws {Error} File I/O exception
 */
function ResultFileWriter(data, runFromProcessIcon){
    let resultsFilename;
    /**
     * Creates a new result file, and writes the reference filename on the first line.
     * @param {NsgData} data
     * @throws {Error} File I/O exception
     */
    function createResultsFile(data){
        let refFilename = data.cache.getRefFilename();
        if (!refFilename){
            throw new Error("ResultFileWriter: No reference file.");
        }
        let resultsFile = new File();
        if (runFromProcessIcon && data.resultsFileBg){
            // Running in background from a process icon. (data.resultsFileBg is only saved to process icons)
            // Write to result file specified in process icon: NSG_ResultsViewTarget_YYYY.MM.DD_HHhMMmSSs.nsg
            resultsFilename = data.resultsFileBg;
        } else {
            // Create a new, unique NSG_Results_YYYY.MM.DD_HHhMMmSSs.nsg file
            resultsFilename = getNsgDataDir(data, refFilename);
            resultsFilename += "NSG_Results_" + getDateString() + ".nsg";
        }
        resultsFile.createForWriting( resultsFilename );
        let ch = '\t';
        let ref = createFileEntry("refFilename", ch, refFilename);
        let version = "version:" + ch + 1;
        let time = "createTime:" + ch + Date.now();
        resultsFile.outTextLn(ref + version + ch + time);
        resultsFile.close();
        data.resultsFile = resultsFilename;
        data.resultsFileBg = undefined;     // Ensure this only gets written to process icons
        console.writeln("\nCreating results file: ", data.resultsFile, "\n");
    }
    
    /**
     * Append a Result line to the NsgResults.nsg file
     * @param {Result} result
     * @throws {Error} File I/O error
     */
    this.addResult = function(result){
        let resultsFile = new File();
        resultsFile.openForReadWrite( resultsFilename );
        resultsFile.seekEnd();
        resultsFile.outTextLn(result.toString());
        resultsFile.close();
    };
    
    /**
     * @param {String} status NSG_RUN_STATUS_NORMAL, NSG_RUN_STATUS_EXCEPTION, 
     * NSG_RUN_STATUS_FAILED or NSG_RUN_STATUS_ABORTED
     */
    this.setRunStatus = function(status){
        let resultsFile = new File();
        resultsFile.openForReadWrite( resultsFilename );
        resultsFile.seekEnd();
        resultsFile.outTextLn("finished:\t" + status);
        resultsFile.close();
    };
    
    createResultsFile(data);
}

/**
 * Read Results from specified resultsFile.
 * Results are only used if there is an entry for all target images, the 
 * files have not been modified, and the reference image has not been changed.
 * @param {NsgData} data
 * @param {String} resultsFile
 * @returns {NsgRunStatus} 
 * @throws {Error} File I/O error
 */
function readResultsFile(data, resultsFile){
    function getValue(str) {
        return str;
    }
    /**
     * @param {String} filename
     * @param {Number} modifyDate
     * @returns {readResultsFile.NsgFile}
     */
    function NsgFile(filename, modifyDate){
        let fileIsModified = true;
        let fileExists = File.exists(filename);
        if (fileExists){
            fileIsModified = new FileInfo(filename).lastModified.getTime() !== modifyDate;
        }
        this.filename = filename;
        this.modifyDate = modifyDate;
        /**
         * @returns {Boolean} True if file exists
         */
        this.exists = function(){return fileExists;};
        /**
         * @returns {Boolean} True if the file is modified
         */
        this.isModified = function(){return fileIsModified;};
        /**
         * @returns {String} File modify date as a string
         */
        this.getStringDate = function(){
            let date = new Date();
            date.setTime(modifyDate);
            return date.toString();
        };
    }
    
    /**
     * Reads filename and modify date.
     * @param {Map} map
     * @param {String} key
     * @returns {ReadFileEntry}
     */
    function ReadFileEntry(map, key){
        let self = this;
        let nsgFile = undefined;
        let entry = map.get(key);
        if (entry){
            let divIdx = entry.indexOf('|');
            if (divIdx > 0){
                let modifyDate = Number(entry.substring(0, divIdx));
                let filename = entry.substring(divIdx + 1);
                nsgFile = new NsgFile(filename, modifyDate);
            }
        }
        /**
         * @returns {Boolean} True if the record existed and could be parsed.
         */
        this.recordExisted = function(){
            return nsgFile !== undefined;
        };
        /**
         * If invalid, the error message is written to this.errMsg
         * @param {String} errMsgPrefix If invalid, start the error message with this string.
         * @param {Number} nth If provided, prefix error message with [nth]
         * @returns {Boolean} True if this is a valid entry.
         */
        this.isValid = function(errMsgPrefix, nth){
            let prefix = "[" + nth + "] " + errMsgPrefix;
            if (!nsgFile){
                self.errMsg = prefix + " record did not exist.";
                return false;
            }
            if (!nsgFile.exists()){
                self.errMsg = prefix + " has been moved or deleted:" +
                    "\n  " + nsgFile.filename;
                return false;
            } 
            if (nsgFile.isModified()){
                self.errMsg = prefix + " date not equal to " + nsgFile.getStringDate() +
                    "\n  " + nsgFile.filename;
                return false;
            }
            return true;
        };
        /**
         * @returns {undefined|String}
         */
        this.filename = function(){
            return nsgFile.filename;
        };
    }
    
    let targetSet = new Set();
    for (let filename of data.targetFiles){
        targetSet.add(filename);
    }
    
    nsgTgtResults = new Map();
    let nsgRunStatus = new NsgRunStatus();
    if (resultsFile && File.exists(resultsFile)){
        console.writeln("\nReading Results file:\n", resultsFile);
        try {
            let version = 0;
            let tgtResults = [];
            let lines = File.readLines( resultsFile );
            const lastLine = lines.length - 1;
            for (let n=0; n<=lastLine; n++){
                // Each line corresponds to one input file. It contains many \t separated Key Value pairs.
                let ch = '\t';
                let fields = lines[n].split(ch);    // Each field contains either a Key or a Value.
                let map = new Map();
                for (let i=0; i<fields.length - 1; i+=2){
                    if (fields[i]) 
                        map.set(fields[i], fields[i+1]);    // Key Value pair
                }
                if (n === 0){
                    // First line specifies the input reference image.
                    // key = refFilename, value = modifyTime|filename
                    // If input ref file no longer exists, has been modified 
                    // or does not match the current NSG ref, do not use the results file.
                    let refNsgFile = new ReadFileEntry(map, "refFilename");
                    if (!refNsgFile.isValid("Reference", n)){
                        console.warningln(refNsgFile.errMsg);
                        return nsgRunStatus;
                    }
                    if (refNsgFile.filename() !== data.cache.getRefFilename()){
                        console.warningln("Reference " + refNsgFile.filename() + 
                                "\ndoes not match current reference.");
                        return nsgRunStatus;
                    }
                    // read result file version
                    if (map.has("version:")) version = Number(map.get("version:"));
                    // Move onto the next line. These contain the processed results.
                    continue;
                }
                if (n === lastLine && version > 0){
                    if (map.has("finished:")){
                        nsgRunStatus.setStatus(map.get("finished:"));
                        break;  // All done!
                    } else {
                        // The last line is a normal Result line.
                        // NSG must have failed before writing the "finished:" line.
                        nsgRunStatus.setStatus(NSG_RUN_STATUS_FAILED);
                    }
                }
                let result = new Result();
                if (map.has("failed:")){
                    if ( map.get("failed:") === "false"){
                        result.failed = false;
                    } else {
                        continue;   // Don't use failed entries. Skip to the next line.
                    }
                }
                // If a file does not exist, or has been modified, these are set to undefined.
                let inputNsgFile = new ReadFileEntry(map, "inputFile:");
                if (!inputNsgFile.recordExisted() || !targetSet.has(inputNsgFile.filename())){
                    continue;
                }
                if (!inputNsgFile.isValid("Input file", n)){
                    console.writeln(inputNsgFile.errMsg);
                    continue;
                }
                result.inputFile = inputNsgFile.filename();
                
                // If a file does not exist, or has been modified, these are left undefined.
                let normalizedNsgFile = new ReadFileEntry(map, "normalizedFile:");
                if (normalizedNsgFile.recordExisted()){
                    if (normalizedNsgFile.isValid("Normalized image", n)){
                        result.normalizedFile = normalizedNsgFile.filename();
                    } else {
                        console.writeln(normalizedNsgFile.errMsg);
                    }
                }
                let lnNsgFile = new ReadFileEntry(map, "LNFile:");
                if (lnNsgFile.recordExisted()){
                    if (lnNsgFile.isValid("xnml", n)){
                        result.LNFile = lnNsgFile.filename();
                    } else {
                        console.writeln(lnNsgFile.errMsg);
                    }
                }
                if (!result.normalizedFile && !result.LNFile){
                    continue;   // We don't want result to be displayed in weight graph
                }
                // Only needed for clean up, so no warning messages
                let xnmlFile = new ReadFileEntry(map, "xnmlFile:");
                if (xnmlFile.recordExisted() && File.exists(xnmlFile.filename()) ){
                    result.xnmlFile = xnmlFile.filename();
                }
                
                let hdr = new HeaderEntries(result.inputFile);
                if (map.has("NOISE00")) hdr.addRawEntry("NOISE00", getValue, map.get("NOISE00"));
                if (map.has("NOISE01")) hdr.addRawEntry("NOISE01", getValue, map.get("NOISE01"));
                if (map.has("NOISE02")) hdr.addRawEntry("NOISE02", getValue, map.get("NOISE02"));
                if (map.has("NOISEA00")) hdr.addRawEntry("NOISEA00", getValue, map.get("NOISEA00"));
                if (map.has("NOISEA01")) hdr.addRawEntry("NOISEA01", getValue, map.get("NOISEA01"));
                if (map.has("NOISEA02")) hdr.addRawEntry("NOISEA02", getValue, map.get("NOISEA02"));
                if (map.has("XPIXSZ")) hdr.addRawEntry("XPIXSZ", getValue, map.get("XPIXSZ"));
                if (map.has("FOCALLEN")) hdr.addRawEntry("FOCALLEN", getValue, map.get("FOCALLEN"));
                if (map.has("FILTER")) hdr.addRawEntry("FILTER", getValue, map.get("FILTER"));
                if (map.has("AIRMASS")) hdr.addRawEntry("AIRMASS", getValue, map.get("AIRMASS"));
                if (map.has("ALTITUDE")) hdr.addRawEntry("ALTITUDE", getValue, map.get("ALTITUDE"));
                if (map.has("EXPOSURE")) hdr.addRawEntry("EXPOSURE", getValue, map.get("EXPOSURE"));
                if (map.has("DATE-OBS")) hdr.addRawEntry("DATE-OBS", getValue, map.get("DATE-OBS"));
                result.headerEntries = hdr;
                
                if (map.has("summary:")) result.summary = map.get("summary:");
                if (map.has("weight:")) result.weight = Number(map.get("weight:"));
                if (map.has("snr:")) result.snr = Number(map.get("snr:"));
                if (map.has("isRef:")) result.isRef = "true" === map.get("isRef:");
                if (map.has("nPhotometryStars:")) result.nPhotometryStarPairs = Number(map.get("nPhotometryStars:"));
                result.createTime = map.has("createTime:") ? Number(map.get("createTime:")) : n;
                
                let scaleFactors = map.get("scaleFactors:");
                if (scaleFactors){
                    result.scaleFactors = [];
                    let sValues = scaleFactors.split(',');
                    for (let i=0; i<sValues.length - 1; i+=2){
                        result.scaleFactors.push(new LinearFitData(Number(sValues[i]), Number(sValues[i+1])));
                    }
                }
                tgtResults.push(result);
            }
            nsgRunStatus.ifFailedRemoveLastResult(tgtResults);
            tgtResults.sort(compareResultObsDate);
            for (let result of tgtResults){
                nsgTgtResults.set(result.inputFile, result);
            }
        } catch (fileExeption){
            console.criticalln("** Error reading NSG Results file " + resultsFile);
            nsgTgtResults = new Map();
            throw fileExeption;
        }
    }
    return nsgRunStatus;
}

function NsgRunStatus(){
    let status = NSG_RUN_STATUS_UNKNOWN;
    let warning = null;
    
    /**
     * @param {String} statusStr NSG_RUN_STATUS_UNKNOWN, NSG_RUN_STATUS_NORMAL, NSG_RUN_STATUS_FAILED, NSG_RUN_STATUS_ABORTED
     */
    this.setStatus = function(statusStr){
        status = statusStr;
    };
    
    /**
     * If status is NSG_RUN_STATUS_EXCEPTION or NSG_RUN_STATUS_FAILED, remove the last result
     * @param {Result[]} tgtResults
     */
    this.ifFailedRemoveLastResult = function(tgtResults){
        if (status === NSG_RUN_STATUS_EXCEPTION || status === NSG_RUN_STATUS_FAILED){
            warning = "\n<b><u>The last run failed.</u></b>\n" +
                    "All failed images have been marked as unprocessed.";
            if (tgtResults.length){
                let lastGoodResult = tgtResults[tgtResults.length - 1];
                if (lastGoodResult && lastGoodResult.inputFile){
                    warning += "\nThe last good image:\n[" + 
                        File.extractName(lastGoodResult.inputFile) +
                        "]\nhas also been marked as unprocessed, " +
                        "even though it completed without error (just to be extra safe).";
                }
                tgtResults.length -= 1;
            }
        }
    };
    
    /**
     * Display warning in console if 'exception' or 'failed' or no last line in Results file.
     * If there were one or more good results, display which good result was removed.
     */
    this.ifFailedShowMessage = function(){
        if (warning){
            console.warningln(warning);
            console.writeln("Use <b><u>Continue run</u></b> to complete the previous run.");
        }
    };
}

/**
 * Checks result is compatible with current write .xnml files and write normalized .xisf settings.
 * Checks that a nsgTgtResult exists for this filename.
 * @param {NsgData} data
 * @param {String} filename
 * @returns {Boolean} True if this cached result is valid (ignores gradient files)
 */
function isCachedResultValid(data, filename){
    function areSettingsOk(result){
        if (data.createXnml && !result.LNFile || data.writeNormalized && !result.normalizedFile){
            return false;
        }
        return true;
    }
    let result = nsgTgtResults.get(filename);
    return result && areSettingsOk(result);
}
