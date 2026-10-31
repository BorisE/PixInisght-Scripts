 #ifndef AutoCalibrate_GUI_ProgressDialog_js
    #define AutoCalibrate_GUI_ProgressDialog_js
	console.writeln("AutoCalibrate_GUI_ProgressDialog_js");
 #endif

// Includes
 #ifndef AutoCalibrate_Global_js
    #include "AutoCalibrate-global.js" // Ver, Title and other info
 #endif
#ifndef AutoCalibrate_settings_js
    console.warningln('Creating Config due to main routine malfunction');
    #ifndef DEBUG
		#define DEBUG true
	#endif
	#include "AutoCalibrate-settings.js" // Settings
    var Config = new ConfigData(); //variable for global access to script data
    //Need to be in front of other declarations
    #include "AutoCalibrate-config-default.js" // Config part.
 #endif
 #ifndef AutoCalibrate_Include_GUI_js
    #include "AutoCalibrate-GUI-include.js" // GUI functions
 #endif
 #ifndef AutoCalibate_Engine_js
    #include "AutoCalibrate-engine.js" // Engine
 #endif

// JS components
 #include <pjsr/StdButton.jsh>
 #include <pjsr/StdIcon.jsh>
 #include <pjsr/FrameStyle.jsh>
 #include <pjsr/Sizer.jsh>
 #include <pjsr/TextAlign.jsh>
 #include <pjsr/SectionBar.jsh>

/* Shared live/finished frame report window. ES5-compatible PJSR controls. */
function AutocalibrationProgressDialog() {
    this.__base__ = Dialog;
    this.__base__();
    var self = this;
    this.abortRequested = false;
    this.completed = false;
    this.runReport = null;
    this.total = 0;
    this.done = 0;
    this.current = 0;
    this.unit = "source frames";
    this.phase = "Scanning input folders";
    this.started = new Date();
    this.operationStarted = this.started;
    this.operation = "Waiting";
    function label(text) {
        var control = new Label(self);
        control.useRichText = false;
        control.wordWrapping = true;
        control.text = text;
        return control;
    }
    function tree(parent, headers) {
        var control = new TreeBox(parent);
        control.numberOfColumns = headers.length;
        control.headerVisible = true;
        control.rootDecoration = false;
        control.alternateRowColor = true;
        control.multipleSelection = false;
        for (var i = 0; i < headers.length; ++i) control.setHeaderText(i, headers[i]);
        control.setScaledMinHeight(60);
        return control;
    }
    function row(tree, cells, path, detail) {
        var node = new TreeBoxNode(tree);
        for (var i = 0; i < cells.length; ++i) {
            node.setText(i, String(cells[i]));
            node.setToolTip(i, detail || String(cells[i]));
        }
        node.filePath = path || "";
        node.detail = detail || cells.join("\n");
        return node;
    }
    function sizeColumns(tree, widths) {
        for (var i = 0; i < widths.length; ++i) tree.setColumnWidth(i, self.logicalPixelsToPhysical(widths[i]));
    }
    this.heading = label(TITLE + " v" + VERSION);
    this.pathLabel = label(Config.InputPath || "");
    this.phaseLabel = label(this.phase);
    this.CurrentFileName_Edit = new Edit(this);
    this.CurrentFileName_Edit.readOnly = true;
    this.CurrentFileStage_Edit = new Edit(this);
    this.CurrentFileStage_Edit.readOnly = true;
    this.CurrentFileStage_Edit.text = "Waiting";
    this.progressLabel = label("Scanning input folders...");
    this.progressBar = new Control(this);
    this.progressBar.setScaledFixedHeight(10);
    this.progressBar.onPaint = function () {
        var g = new Graphics(this);
        g.fillRect(0, 0, this.width, this.height, new Brush(0xffd0d0d0));
        var fraction = self.total > 0 ? Math.min(1, self.done / self.total) : 0;
        if (fraction > 0) g.fillRect(0, 0, Math.round(this.width * fraction), this.height, new Brush(0xff4389cc));
        g.end();
    };
    this.timingLabel = label("");
    this.summaryLabel = label("Preparing frame inventory...");
    this.stagesTree = tree(this, ["Stage", "New files", "Existing used", "Error events"]);
    sizeColumns(this.stagesTree, [310, 110, 120, 110]);
    this.integrationLabel = label("Integration results");
    this.integrationLabel.hide();
    this.mastersTree = tree(this, ["Object", "Channel", "Saved / input", "Exposure (s)", "Result"]);
    sizeColumns(this.mastersTree, [160, 70, 110, 110, 290]);
    this.mastersTree.hide();
    this.problemsLabel = label("No errors or warnings reported.");
    this.problemsText = new TextBox(this);
    this.problemsText.readOnly = true;
    this.problemsText.setScaledMinHeight(140);
    this.problemsText.text = "No errors or warnings reported.";
    this.details = new TextBox(this);
    this.details.readOnly = true;
    this.details.setScaledFixedHeight(100);
    this.details.hide();
    this.hideDetails_Button = new PushButton(this);
    this.hideDetails_Button.text = "Hide details";
    this.hideDetails_Button.hide();
    this.hideDetails_Button.onClick = function () {
        self.details.hide();
        self.hideDetails_Button.hide();
        self.adjustToContents();
    };
    this.reportPathLabel = label("");
    this.openMaster_Button = new PushButton(this);
    this.openMaster_Button.text = "Open selected image";
    this.openMaster_Button.enabled = false;
    this.openMaster_Button.onClick = function () {
        if (!self.selectedPath || !self.completed) return;
        try {
            var windows = ImageWindow.open(self.selectedPath);
            for (var i = 0; i < windows.length; ++i) windows[i].show();
        } catch (error) { new MessageBox(String(error), TITLE, StdIcon_Error, StdButton_Ok).execute(); }
    };
    function select(node) {
        self.selectedPath = node ? node.filePath : "";
        self.openMaster_Button.enabled = self.completed && !!self.selectedPath;
        if (node) {
            self.details.text = node.detail;
            self.details.show();
            self.hideDetails_Button.show();
            self.adjustToContents();
        }
    }
    this.mastersTree.onCurrentNodeUpdated = function (node) { select(node); };
    this.files_Button = new PushButton(this);
    this.files_Button.text = "Output files...";
    this.files_Button.enabled = false;
    this.files_Button.onClick = function () {
        if (!self.runReport) return;
        var dialog = new Dialog;
        dialog.windowTitle = TITLE + " - Output files";
        var list = tree(dialog, ["Status", "Last stage", "Origin", "File"]);
        list.setScaledMinHeight(300);
        sizeColumns(list, [100, 200, 90, 390]);
        var detail = new TextBox(dialog);
        detail.readOnly = true;
        detail.setScaledFixedHeight(110);
        detail.text = "Select a file to see its full path. RGB channels are separate output files.";
        var open = new PushButton(dialog);
        open.text = "Open selected image";
        open.enabled = false;
        var selected = "";
        list.onCurrentNodeUpdated = function (node) {
            selected = node ? node.filePath : "";
            open.enabled = self.completed && !!selected;
            if (node) detail.text = node.detail;
        };
        open.onClick = function () {
            if (!selected || !self.completed) return;
            try {
                var windows = ImageWindow.open(selected);
                for (var i = 0; i < windows.length; ++i) windows[i].show();
            } catch (error) { new MessageBox(String(error), TITLE, StdIcon_Error, StdButton_Ok).execute(); }
        };
        var files = self.runReport.results();
        for (var i = 0; i < files.length; ++i) {
            var f = files[i];
            row(list, [f.status, self.runReport.name(f.stage), f.kind, File.extractNameAndExtension(f.path)],
                f.available ? f.path : "", f.status + " | " + self.runReport.name(f.stage) + " | " + f.kind + "\n" + f.path);
        }
        var close = new PushButton(dialog);
        close.text = "Close";
        close.onClick = function () { dialog.ok(); };
        var buttons = new HorizontalSizer;
        buttons.add(open); buttons.addStretch(); buttons.add(close);
        dialog.sizer = new VerticalSizer;
        dialog.sizer.margin = 8; dialog.sizer.spacing = 6;
        dialog.sizer.add(list, 100); dialog.sizer.add(detail); dialog.sizer.add(buttons);
        dialog.setScaledMinWidth(820);
        dialog.adjustToContents();
        dialog.execute();
    };
    this.saveReport_Button = new PushButton(this);
    this.saveReport_Button.text = "Save report...";
    this.saveReport_Button.enabled = false;
    this.saveReport_Button.onClick = function () {
        var chooser = new SaveFileDialog;
        chooser.caption = "Save AutoCalibrate summary";
        chooser.filters = [["Text files", "*.txt"]];
        chooser.initialPath = self.runReport.reportPath || self.runReport.inputPath + "/AutoCalibrate-summary.txt";
        if (chooser.execute()) try {
            self.runReport.save(chooser.fileName);
            self.reportPathLabel.text = "Report: " + self.runReport.reportPath;
        } catch (error) { new MessageBox(String(error), TITLE, StdIcon_Error, StdButton_Ok).execute(); }
    };
    this.cancel_Button = new PushButton(this);
    this.cancel_Button.text = "Stop";
    this.cancel_Button.onClick = function () {
        if (self.completed) { self.ok(); return; }
        self.abortRequested = true;
        self.cancel_Button.enabled = false;
        self.cancel_Button.text = "Stopping...";
        self.phaseLabel.text = "Stopping after the current operation...";
    };
    this.onClose = function () {
        if (self.completed) return true;
        self.cancel_Button.onClick();
        return false;
    };
    var buttons = new HorizontalSizer;
    buttons.spacing = 6;
    buttons.add(this.files_Button);
    buttons.add(this.openMaster_Button);
    buttons.add(this.saveReport_Button);
    buttons.addStretch();
    buttons.add(this.cancel_Button);
    this.sizer = new VerticalSizer;
    this.sizer.margin = 8;
    this.sizer.spacing = 6;
    this.sizer.add(this.heading);
    this.sizer.add(this.pathLabel);
    this.sizer.add(this.phaseLabel);
    this.sizer.add(this.CurrentFileName_Edit);
    this.sizer.add(this.CurrentFileStage_Edit);
    this.sizer.add(this.progressLabel);
    this.sizer.add(this.progressBar);
    this.sizer.add(this.timingLabel);
    this.sizer.add(this.summaryLabel);
    this.sizer.add(this.stagesTree);
    this.sizer.add(this.integrationLabel);
    this.sizer.add(this.mastersTree);
    this.sizer.add(this.problemsLabel);
    this.sizer.add(this.problemsText, 100);
    this.sizer.add(this.details);
    this.sizer.add(this.hideDetails_Button);
    this.sizer.add(this.reportPathLabel);
    this.sizer.add(buttons);
    this.windowTitle = TITLE + " - Processing frames";
    this.setScaledMinWidth(820);
    this.attachReport = function (report) {
        this.runReport = report;
        this.started = report.started;
        this.integrationLabel.visible = report.integrationEnabled;
        this.mastersTree.visible = report.integrationEnabled;
        this.openMaster_Button.visible = report.integrationEnabled;
        this.openMaster_Button.text = "Open selected master";
        this.refreshReport();
        this.timer.start();
    };
    this.refreshReport = function () {
        if (!this.runReport) return;
        var refreshTime = new Date().getTime();
        if (!this.completed && this.lastRefresh && refreshTime - this.lastRefresh < 400) return;
        this.lastRefresh = refreshTime;
        var report = this.runReport;
        this.summaryLabel.text = report.overview();
        this.stagesTree.clear();
        var stats = report.statistics();
        for (var i = 0; i < stats.length; ++i)
            row(this.stagesTree, [stats[i].name, stats[i].created, stats[i].existing, stats[i].errors]);
        this.stagesTree.setScaledFixedHeight(30 + Math.max(1, stats.length) * 25);
        var problems = report.problemRows();
        var messages = [];
        for (var i = 0; i < problems.length; ++i) {
            var p = problems[i];
            messages.push(report.name(p.stage) + " | " + p.count + " event(s)\n" + p.details.replace(/\s+$/, ""));
        }
        this.problemsLabel.text = problems.length ? "Problems: " + problems.length + " | Events: " + report.issues.length : "Problems";
        var problemText = messages.length ? messages.join("\n\n") : "No errors or warnings reported.";
        // Preserve selection and scroll position when no new events have arrived.
        if (this.problemsText.text != problemText) this.problemsText.text = problemText;
        this.files_Button.enabled = this.completed && report.results().length > 0;
        if (report.integrationEnabled) {
            this.mastersTree.setScaledFixedHeight(30 + Math.min(4, Math.max(1, report.groups.length)) * 25);
            this.mastersTree.clear();
            for (var i = 0; i < report.groups.length; ++i) {
                var g = report.groups[i];
                row(this.mastersTree, [g.object, g.channel, g.savedFrames + " / " + g.frames,
                    g.exposureKnown ? g.exposure.toFixed(3) : "Unknown", g.status], g.master, g.outputs.join("\n"));
            }
        }
        this.updateTiming();
    };
    this.setPhase = function (phase, unit) {
        this.phase = phase;
        this.unit = unit;
        this.done = this.current = this.total = 0;
        this.phaseLabel.text = phase;
        if (this.runReport) this.runReport.phase = phase;
        this.updateProgress();
    };
    this.initBar = function (workPath, total) {
        this.pathLabel.text = workPath;
        this.total = total;
        this.updateProgress();
    };
    this.updateProgress = function () {
        this.progressLabel.text = this.done + " / " + this.total + " " + this.unit + " finished" +
            (this.current > this.done ? " | Current: " + this.current : "");
        this.progressBar.update();
    };
    this.updateBar_NewFile = function (current, file) {
        this.current = current;
        this.CurrentFileName_Edit.text = file;
        this.updateProgress();
        this.refreshReport();
    };
    this.completeItem = function (done) { this.done = done; this.updateProgress(); this.refreshReport(); };
    this.updateBar_NewProcess = function (operation) {
        if (this.operation != operation) this.operationStarted = new Date();
        this.operation = operation;
        this.CurrentFileStage_Edit.text = operation;
        this.updateTiming();
    };
    this.updateBar_Error = function () { this.lastRefresh = 0; this.refreshReport(); this.adjustToContents(); };
    this.updateTiming = function () {
        var now = this.completed ? this.runReport.finished : new Date();
        this.timingLabel.text = "Elapsed: " + Math.round((now.getTime() - this.started.getTime()) / 1000) + " s" +
            (this.completed ? " | Started: " + this.started.toLocaleString() : " | Current operation: " + Math.round((now.getTime() - this.operationStarted.getTime()) / 1000) + " s");
    };
    this.timer = new Timer;
    this.timer.interval = 1;
    this.timer.periodic = true;
    this.timer.onTimeout = function () { self.updateTiming(); };
    this.finishRun = function (report) {
        this.timer.stop();
        this.runReport = report;
        this.completed = true;
        this.windowTitle = TITLE + " - Run summary";
        this.phaseLabel.text = report.status;
        this.CurrentFileName_Edit.hide();
        this.CurrentFileStage_Edit.hide();
        this.progressLabel.hide();
        this.progressBar.hide();
        this.refreshReport();
        this.reportPathLabel.text = "Report: " + (report.reportPath || "Not saved; use Save report...");
        this.saveReport_Button.enabled = true;
        this.cancel_Button.enabled = true;
        this.cancel_Button.text = "Close";
        this.details.hide();
        this.hideDetails_Button.hide();
        this.adjustToContents();
    };
    this.adjustToContents();
}
AutocalibrationProgressDialog.prototype = new Dialog;
