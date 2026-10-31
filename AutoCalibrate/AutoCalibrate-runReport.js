#ifndef AutoCalibrate_RunReport_js
#define AutoCalibrate_RunReport_js

/* Shared live/final run report: frame accounting, issues, integration and persistence.
 * No GUI dependencies; compatible with PJSR/ECMAScript 5.
 */
function AutoCalibrateRunReport(inputPath) {
    this.started = new Date();
    this.finished = null;
    this.inputPath = inputPath;
    this.status = "Running";
    this.groups = [];
    this.issues = [];
    this.stages = [];
    this.sourcesVisited = 0;
    this.reportPath = "";

    this.files = {};
    this.phase = "Scanning";
    this.lastStage = "fullname";
    this.integrationEnabled = false;
    this.splitAfter = false;
    this.key = function (p) { return "$" + String(p).replace(/\\/g, "/").toLowerCase(); };
    this.name = function (stage) {
        return ({fullname: "Input", calibrated: "Calibration", cosmetized: "Cosmetic correction",
            debayered: "Debayer", splitBefore: "Split channels (before registration)", abed: "ABE",
            registered: "Registration", split: "Split channels (after registration)", normalized: "Local normalization"})[stage] || stage || "Run";
    };
    this.configure = function (config, debayer, split, after) {
        this.integrationEnabled = !!config.NeedIntegration;
        this.splitAfter = after;
        var selected = [["calibrated", config.NeedCalibration], ["cosmetized", config.NeedCosmeticCorrection],
            ["debayered", debayer], ["splitBefore", split && !after], ["abed", config.NeedABE],
            ["registered", config.NeedRegister], ["split", split && after], ["normalized", config.NeedNormalization]];
        this.selectedStages = [];
        for (var i = 0; i < selected.length; ++i) if (selected[i][1]) {
            this.selectedStages.push(selected[i][0]);
            this.lastStage = selected[i][0];
        }
    };
    this.enabled = function (stage) { return this.selectedStages.indexOf(stage) >= 0; };
    this.input = function (path) {
        var key = this.key(path);
        if (!this.files[key]) this.files[key] = {path: String(path), stage: "fullname", kind: "input", parents: {}, children: {}, confirmed: true};
        return this.files[key];
    };
    this.expect = function (stage, input, output) {
        var parent = this.input(input), key = this.key(output), parentKey = this.key(input), node = this.files[key];
        if (!node) node = this.files[key] = {path: output, stage: stage, kind: "pending", parents: {}, children: {}, confirmed: false};
        if (parentKey != key) { node.parents[parentKey] = true; parent.children[key] = true; }
        return node;
    };
    this.output = function (stage, input, output, kind) {
        var node = this.expect(stage, input, output);
        node.stage = stage;
        node.confirmed = true;
        if (node.kind != "created") node.kind = kind;
        for (var i = 0; i < this.issues.length; ++i)
            if (this.key(this.issues[i].target) == this.key(input) && this.issues[i].stage == stage)
                this.issues[i].recovered = true;
    };
    this.issue = function (target, message, severity, stage) {
        this.issues.push({target: String(target), message: String(message), severity: severity || "Error",
            stage: stage || "", phase: this.phase, time: new Date(), recovered: false});
    };
    // Only records accepted by the second-pass workflow filters are counted as used.
    this.useRecord = function (record, normalizationValid) {
        var previous = record.fullname ? [record.fullname] : [];
        if (record.fullname) this.input(record.fullname);
        for (var i = 0; i < this.selectedStages.length; ++i) {
            var stage = this.selectedStages[i], value = record[stage];
            if (!value) continue;
            var values = Array.isArray(value) ? value : [value], present = [];
            for (var j = 0; j < values.length; ++j) {
                var file = values[j];
                if (!File.exists(file) || (stage == "normalized" && !normalizationValid(file))) continue;
                var parent = previous.length == values.length ? previous[j] : (previous[0] || file);
                this.output(stage, parent, file, "existing");
                present.push(file);
            }
            if (present.length) previous = present;
        }
    };
    this.blocked = function (key, visited) {
        if (visited[key]) return false;
        visited[key] = true;
        var node = this.files[key];
        if (!node) return false;
        for (var i = 0; i < this.issues.length; ++i) {
            var e = this.issues[i];
            if (e.stage && e.severity == "Error" && !e.recovered && this.key(e.target) == key) return true;
        }
        for (var p in node.parents) if (node.parents.hasOwnProperty(p) && this.blocked(p, visited)) return true;
        return false;
    };
    this.results = function () {
        var rows = [];
        for (var key in this.files) if (this.files.hasOwnProperty(key)) {
            var node = this.files[key], hasChildren = false;
            for (var child in node.children) if (node.children.hasOwnProperty(child)) { hasChildren = true; break; }
            if (hasChildren) continue;
            var exists = node.confirmed && File.exists(node.path);
            var ready = exists && node.stage == this.lastStage && !this.blocked(key, {});
            rows.push({path: node.path, stage: node.stage, kind: node.kind, ready: ready,
                available: exists, status: ready ? "Ready" : (exists ? "Partial" : "Not produced")});
        }
        rows.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
        return rows;
    };
    this.statistics = function () {
        var rows = [];
        for (var i = 0; i < this.selectedStages.length; ++i) {
            var stage = this.selectedStages[i], row = {name: this.name(stage), created: 0, existing: 0, errors: 0};
            for (var key in this.files) if (this.files.hasOwnProperty(key)) {
                var f = this.files[key];
                if (f.stage == stage && f.confirmed) {
                    if (f.kind == "created") ++row.created;
                    else if (f.kind == "existing") ++row.existing;
                }
            }
            for (var j = 0; j < this.issues.length; ++j)
                if (this.issues[j].stage == stage && this.issues[j].severity == "Error") ++row.errors;
            rows.push(row);
        }
        return rows;
    };
    this.overview = function () {
        var rows = this.results(), ready = 0, created = 0, existing = 0;
        for (var i = 0; i < rows.length; ++i) if (rows[i].ready) {
            ++ready;
            if (rows[i].kind == "created") ++created;
            else if (rows[i].kind == "existing") ++existing;
        }
        return ready + " ready output file(s) (" + created + " new, " + existing + " existing); " +
            (rows.length - ready) + " incomplete. Target: " + this.name(this.lastStage);
    };
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
    this.complete = function (engine, succeeded, cancelled) {
        this.finished = new Date();
        this.sourcesVisited = engine.summarySourcesVisited;
        this.stages = [
            ["Calibration", engine.CalibratedCount], ["Cosmetic correction", engine.CosmetizedCount],
            ["Debayer", engine.DebayerCount], ["Split channel files", engine.SplitChannelCount],
            ["ABE", engine.ABECount], ["Registration", engine.RegisteredCount],
            ["Local normalization", engine.NormalizedCount], ["Binning", engine.BinnedCount],
            ["Integration masters", engine.IntegratedCount]
        ];
        if (!succeeded && !cancelled && !this.issues.length)
            this.issue("Run", "Processing did not complete successfully; see console for diagnostics.");
        this.status = cancelled ? "Stopped by user" :
            (!succeeded || this.issues.length ? "Completed with issues" : "Completed successfully");
        for (var i = 0; i < this.groups.length; ++i)
            if (this.groups[i].status == "Pending")
                this.groups[i].status = cancelled ? "Not completed (stopped)" : "Not completed";
        var rows = this.results();
        for (var i = 0; i < rows.length; ++i) if (!rows[i].ready && !cancelled) this.status = "Completed with issues";
    };
    this.toText = function () {
        var lines = ["AutoCalibrate - run summary", this.status, this.overview(),
            "Started: " + this.started.toString(), "Finished: " + (this.finished ? this.finished.toString() : "Running"),
            "Elapsed: " + Math.round(((this.finished || new Date()).getTime() - this.started.getTime()) / 1000) + " s",
            "Input: " + this.inputPath, "Report: " + (this.reportPath || "Not saved"),
            "Source frames visited (first pass): " + this.sourcesVisited, "",
            "Stage\tNew output files\tExisting outputs used\tError events"];
        var stats = this.statistics();
        for (var i = 0; i < stats.length; ++i) lines.push([stats[i].name, stats[i].created, stats[i].existing, stats[i].errors].join("\t"));
        lines.push("", "Output frames (RGB channels count as separate files)", "Status\tLast stage\tOrigin\tPath");
        var results = this.results();
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
    this.save = function (path) {
        var previousPath = this.reportPath;
        var destination = makeFilenameUnique(path, false);
        var file = new File;
        try {
            file.createForWriting(destination);
            this.reportPath = destination;
            file.outTextLn(this.toText());
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
