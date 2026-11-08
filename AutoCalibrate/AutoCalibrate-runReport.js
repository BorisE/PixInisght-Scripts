#ifndef AutoCalibrate_RunReport_js
#define AutoCalibrate_RunReport_js

/**
 * Create a run summary with timing, issues and integration groups.
 * File paths and output origins remain in FILEARRAY; results/statistics receive that array explicitly.
 * No separate output-event log or file graph is maintained.
 */
function AutoCalibrateRunReport(inputPath) {
    this.inputPath = inputPath || "";
    this.started = new Date();
    this.finished = null;
    this.status = "Running";
    this.reportPath = "";
    this.phase = "Scanning";
    this.groups = [];
    this.issues = [];
    this.selectedStages = [];
    this.lastStage = "fullname";
    this.stageOrder = ["fullname", "calibrated", "cosmetized", "debayered",
        "splitBefore", "abed", "registered", "split", "normalized"];

    /**
     * Return a normalized dictionary key for a path, treating slash direction consistently while preserving filename case.
     */
    this.key = function (path) {
        return "$" + String(path).replace(/\\/g, "/");
    };
    /**
     * Return the display label for a stage, falling back to the supplied stage or Run.
     */
    this.name = function (stage) {
        return ({fullname: "Input", calibrated: "Calibration", cosmetized: "Cosmetic correction",
            debayered: "Debayer", splitBefore: "Split channels (before registration)", abed: "ABE",
            registered: "Registration", split: "Split channels (after registration)",
            normalized: "Local normalization"})[stage] || stage || "Run";
    };
    /**
     * Select report stages from config and the effective Debayer/split workflow flags.
     * Set the last requested frame stage and integration visibility; do not modify processing configuration.
     */
    this.configure = function (config, debayer, split, after) {
        this.workflow = config.Workflow;
        this.integrationEnabled = !!config.NeedIntegration;
        this.splitEnabled = split;
        this.splitAfter = after;
        var selected = [["calibrated", config.NeedCalibration], ["cosmetized", config.NeedCosmeticCorrection],
            ["debayered", debayer], ["splitBefore", split && !after], ["abed", config.NeedABE],
            ["registered", config.NeedRegister], ["split", split && after], ["normalized", config.NeedNormalization]];
        this.selectedStages = [];
        this.lastStage = "fullname";
        for (var i = 0; i < selected.length; ++i) if (selected[i][1]) {
            this.selectedStages.push(selected[i][0]);
            this.lastStage = selected[i][0];
        }
    };
    /**
     * Return whether stage is selected for the current frame-processing workflow.
     */
    this.enabled = function (stage) { return this.selectedStages.indexOf(stage) >= 0; };
    /**
     * Append a diagnostic for target with message, severity, stage, phase and timestamp.
     * Default severity to Error; preserve each occurrence for later grouping.
     */
    this.issue = function (target, message, severity, stage) {
        this.issues.push({target: target, message: message, severity: severity || "Error",
            stage: stage || "", phase: this.phase, time: new Date(), recovered: false});
    };
    // A file found during scanning is not necessarily used by this run.
    /**
     * Build a temporary stage/path lookup of origins from individual FILEARRAY rows.
     * Prefer created over reused metadata; never persist this lookup or copy file chains.
     * Summary loops use it to avoid rescanning all rows for every output.
     */
    this.originIndex = function (records) {
        var index = {};
        for (var i = 0; i < records.length; ++i) {
            var record = records[i];
            if (!record.report) continue;
            for (var stage in record.report) if (record.report.hasOwnProperty(stage)) {
                var paths = this.paths(record[stage]);
                if (paths.length != 1) continue;
                var key = stage + this.key(paths[0]), kind = record.report[stage].kind;
                if (index[key] != "created") index[key] = kind;
            }
        }
        return index;
    };
    /**
     * Read created/existing origin for path at stage from individual FILEARRAY records.
     * Return available if no usage metadata exists; aggregate RGB lists never supply one origin for all channels.
     */
    this.origin = function (records, stage, path) {
        return this.originIndex(records)[stage + this.key(path)] || "available";
    };
    /**
     * Normalize a stage value to an array of paths.
     * Return an empty array for an absent value; do not copy or mutate an existing array.
     */
    this.paths = function (value) { return !value ? [] : (Array.isArray(value) ? value : [value]); };
    /**
     * Return whether record belongs to the configured channel-splitting workflow.
     * Exclude incompatible before/after-registration channel rows from summary calculations.
     */
    this.accepts = function (record) {
        if (this.workflow == "MONO" && /_d_RGB$/i.test(record.fits)) return false;
        if (/_s_[RGB]$/i.test(record.fits) && (!this.splitEnabled || !this.splitAfter)) return false;
        if (/_(?:p|d)_[RGB]$/i.test(record.fits) && (!this.splitEnabled || this.splitAfter)) return false;
        return true;
    };

    // Derive terminal outputs from the stage columns, without retaining a second
    // model. Shared Debayer/split paths are deduplicated across source/channel rows.
    /**
     * Derive terminal frame results from records without changing FILEARRAY.
     * Deduplicate shared source/channel paths, check existence and required LN sidecars, and return ready/partial/missing rows with origin metadata.
     */
    this.results = function (records) {
        var candidates = {}, superseded = {}, rows = [], origins = this.originIndex(records);
        var last = this.stageOrder.indexOf(this.lastStage);
        for (var i = 0; i < records.length; ++i) {
            var record = records[i];
            if (!this.accepts(record)) continue;
            var previous = [];
            for (var j = 0; j <= last; ++j) {
                var stage = this.stageOrder[j], paths = this.paths(record[stage]);
                if (!paths.length) continue;
                for (var p = 0; p < previous.length; ++p) {
                    var same = false;
                    for (var n = 0; n < paths.length; ++n)
                        if (this.key(previous[p]) == this.key(paths[n])) same = true;
                    if (!same) superseded[this.key(previous[p])] = true;
                }
                for (var n = 0; n < paths.length; ++n) {
                    var key = this.key(paths[n]), prior = candidates[key];
                    if (!prior || j > prior.order)
                        candidates[key] = {path: paths[n], stage: stage, order: j};
                }
                previous = paths;
            }
        }
        for (var key in candidates) if (candidates.hasOwnProperty(key) && !superseded[key]) {
            var candidate = candidates[key], available = File.exists(candidate.path);
            var valid = available && (!this.validOutput || this.validOutput(candidate.stage, candidate.path));
            rows.push({path: candidate.path, stage: candidate.stage,
                kind: (origins[candidate.stage + this.key(candidate.path)] || "available"), available: available,
                ready: valid && candidate.stage == this.lastStage,
                status: !available ? "Missing" : (valid && candidate.stage == this.lastStage ? "Ready" : "Partial")});
        }
        /**
         * Order output rows by path for a stable summary and file-list display.
         */
        rows.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
        return rows;
    };

    /**
     * Count unique present outputs per selected stage from records, separating created, reused and found-only files.
     * Include error-event counts; do not infer usage from discovery or mutate records.
     */
    this.statistics = function (records) {
        var rows = [], origins = this.originIndex(records);
        for (var s = 0; s < this.selectedStages.length; ++s) {
            var stage = this.selectedStages[s], seen = {};
            var row = {name: this.name(stage), created: 0, existing: 0, available: 0, errors: 0};
            for (var i = 0; i < records.length; ++i) {
                if (!this.accepts(records[i])) continue;
                var paths = this.paths(records[i][stage]);
                for (var p = 0; p < paths.length; ++p) {
                    var key = this.key(paths[p]);
                    if (seen[key] || !File.exists(paths[p])) continue;
                    seen[key] = true;
                    ++row[(origins[stage + key] || "available")];
                }
            }
            for (var i = 0; i < this.issues.length; ++i)
                if (this.issues[i].stage == stage && this.issues[i].severity == "Error") ++row.errors;
            rows.push(row);
        }
        return rows;
    };
    /**
     * Return a compact ready/incomplete frame summary from records.
     * Count split channels as individual outputs and name the last requested stage.
     */
    this.overview = function (records) {
        var rows = this.results(records), ready = 0, created = 0, existing = 0, available = 0;
        for (var i = 0; i < rows.length; ++i) if (rows[i].ready) {
            ++ready;
            if (rows[i].kind == "created") ++created;
            else if (rows[i].kind == "existing") ++existing;
            else ++available;
        }
        return ready + " ready output file(s) (" + created + " new, " + existing + " existing used, " + available + " found only); " +
            (rows.length - ready) + " incomplete. Target: " + this.name(this.lastStage);
    };
    /**
     * Group identical target/stage/message issues for display while retaining all event timestamps and recovery information in details.
     * Return display rows without deleting the original issues.
     */
    this.problemRows = function () {
        var rows = [], map = {};
        for (var i = 0; i < this.issues.length; ++i) {
            var e = this.issues[i], key = this.key(e.target) + "|" + e.stage + "|" + e.message, row = map[key];
            if (!row) { row = map[key] = {target: e.target, stage: e.stage, message: e.message, count: 0, details: ""}; rows.push(row); }
            ++row.count;
            row.details += e.time.toLocaleTimeString() + " | " + e.phase + " | " + e.severity +
                (e.recovered ? " (recovered)" : "") + "\n" + e.target + "\n" + e.message + "\n\n";
        }
        return rows;
    };
    /**
     * Mark prior issues for stage and successfully processed inputs as recovered.
     * Retain the events and their diagnostics; accept one input path or an array.
     */
    this.resolve = function (stage, inputs) {
        inputs = this.paths(inputs);
        for (var i = 0; i < this.issues.length; ++i)
            if (this.issues[i].stage == stage && inputs.indexOf(this.issues[i].target) >= 0)
                this.issues[i].recovered = true;
    };
    /**
     * Finalize timing and status using records, succeeded and cancelled.
     * Flag partial outputs and diagnostic events, and close pending integration groups.
     * Does not save files or operate the UI.
     */
    this.complete = function (records, succeeded, cancelled) {
        this.finished = new Date();
        if (!succeeded && !cancelled && !this.issues.length)
            this.issue("Run", "Processing did not complete successfully; see console for diagnostics.");
        this.status = cancelled ? "Stopped by user" :
            (!succeeded || this.issues.length ? "Completed with issues" : "Completed successfully");
        var rows = this.results(records);
        for (var i = 0; i < rows.length; ++i)
            if (!rows[i].ready && !cancelled) this.status = "Completed with issues";
        for (var i = 0; i < this.groups.length; ++i)
            if (this.groups[i].status == "Pending") this.groups[i].status = "Not completed";
    };
    /**
     * Render the run summary, stage counts, output paths, integration groups and diagnostic history as plain text using records.
     * Return text without writing it.
     */
    this.toText = function (records) {
        var lines = ["AutoCalibrate - run summary", this.status, this.overview(records),
            "Started: " + this.started.toString(), "Finished: " + (this.finished ? this.finished.toString() : "Running"),
            "Elapsed: " + Math.round(((this.finished || new Date()).getTime() - this.started.getTime()) / 1000) + " s",
            "Input: " + this.inputPath, "Report: " + (this.reportPath || "Not saved"),
            "",
            "Stage\tNew output files\tExisting outputs used\tFound only\tError events"];
        var stats = this.statistics(records);
        for (var i = 0; i < stats.length; ++i) lines.push([stats[i].name, stats[i].created, stats[i].existing, stats[i].available, stats[i].errors].join("\t"));
        lines.push("", "Output frames (RGB channels count as separate files)", "Status\tLast stage\tOrigin\tPath");
        var results = this.results(records);
        for (var i = 0; i < results.length; ++i) lines.push([results[i].status, this.name(results[i].stage), results[i].kind, results[i].path].join("\t"));
        if (!results.length) lines.push("No frame results recorded.");
        if (this.integrationEnabled) {
            lines.push("", "Integrated groups (exposure per channel; do not add R/G/B exposures)", "Object\tChannel\tSaved / input\tExposure (s)\tResult\tMaster\tOther outputs");
            for (var i = 0; i < this.groups.length; ++i) {
                var g = this.groups[i];
                lines.push([g.object, g.channel, g.savedFrames + " / " + g.frames, g.exposureKnown ? g.exposure.toFixed(3) : "Unknown", g.status, g.master || "", g.outputs.join("; ")].join("\t"));
            }
            if (!this.groups.length) lines.push("No integration groups produced.");
        }
        lines.push("", "Errors and warnings (all events, including recovered failures)");
        var problems = this.problemRows();
        for (var i = 0; i < problems.length; ++i) lines.push(problems[i].details);
        if (!problems.length) lines.push("None reported.");
        return lines.join("\n");
    };

    // Use a unique filename and propagate write failures to the caller.
    /**
     * Save the report for records to a unique destination based on path.
     * Return the saved path; restore reportPath on failure and always close the file.
     * Never overwrite an existing report.
     */
    this.save = function (path, records) {
        var previousPath = this.reportPath;
        var destination = makeFilenameUnique(path, false);
        var file = new File;
        try {
            file.createForWriting(destination);
            this.reportPath = destination;
            file.outTextLn(this.toText(records));
        } catch (error) {
            this.reportPath = previousPath;
            throw error;
        } finally {
            if (file.isOpen) file.close();
        }
        return destination;
    };
}
#endif
