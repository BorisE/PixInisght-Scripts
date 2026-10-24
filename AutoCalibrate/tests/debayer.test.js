// Run with node AutoCalibrate/tests/debayer.test.js. PixInsight process APIs are mocked;
// these tests verify orchestration and metadata, not VNG's numerical output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../AutoCalibrate-engine.js'), 'utf8');
function setup({split = false, pattern = 'RGGB', metadata = false, color = false} = {}) {
    const disk = new Map(), opened = [], debayers = [], references = [];
    let result;
    function keyword(name, value, comment) {
        this.name = name; this.value = value; this.comment = comment;
        this.strippedValue = String(value).replace(/^'|'$/g, '');
        this.trim = function () {};
    }
    function window(channels = 1) {
        const props = {};
        const w = {bitsPerSample: 32, isFloatSample: true, keywords: [], closed: false,
            forceClose() {this.closed = true;}, close() {this.closed = true;}, purge() {},
            saveAs(file) {disk.set(file, this); return true;}};
        w.mainView = {window: w, get properties() {return Object.keys(props);},
            hasProperty(k) {return k in props;}, propertyValue(k) {return props[k];},
            setPropertyValue(k,v) {props[k] = v;}, deleteProperty(k) {delete props[k];},
            beginProcess() {}, endProcess() {},
            image: {width: 20, height: 20, isColor: channels === 3, selectedChannel: 0,
                assign(image) {this.channelCopied = image.selectedChannel;}}};
        opened.push(w); return w;
    }
    function input() {
        const w = window(color ? 3 : 1);
        const values = {TELESCOP: 'Scope', INSTRUME: 'Camera', 'DATE-OBS': '2026-01-01T00:00:00',
            EXPTIME: '60', 'CCD-TEMP': '-10', FILTER: metadata ? 'L' : pattern,
            OBJECT: 'M31', XBINNING: '1', XPIXSZ: '4', FOCALLEN: '800'};
        w.keywords = Object.entries(values).map(([k,v]) => new keyword(k,v));
        if (metadata) w.mainView.setPropertyValue('CFA:SourcePattern', pattern);
        w.mainView.setPropertyValue('Observation:Time:Start', '2026-01-01');
        return w;
    }
    function ImageWindow(width,height,channels) {return window(channels);}
    ImageWindow.openWindows = [];
    ImageWindow.open = file => {
        if (!disk.has(file)) {const w = input(); ImageWindow.openWindows.push(w); return [w];}
        const old = disk.get(file), w = window(old.mainView.image.isColor ? 3 : 1);
        w.keywords = old.keywords;
        for (const k of old.mainView.properties) w.mainView.setPropertyValue(k, old.mainView.propertyValue(k));
        ImageWindow.openWindows.push(w); return [w];
    };
    function Debayer() {debayers.push(this);}
    Object.assign(Debayer.prototype, {Auto: 0, RGGB: 1, BGGR: 2, GBRG: 3, GRBG: 4, VNG: 2,
        executeOn() {result = window(3); this.outputImage = 'rgb'; return !this.fail;}});
    const File = {extractName: f => path.posix.basename(f).replace(/\.[^.]+$/, ''),
        extractDrive: () => '', extractDirectory: path.posix.dirname,
        exists: f => disk.has(f), directoryExists: () => true};
    const quiet = new Proxy({}, {get: (_,k) => k === 'abortRequested' ? false : () => {}});
    const context = {ImageWindow, Debayer, View: {viewById: () => result.mainView}, FITSKeyword: keyword,
        File, Config: {NeedDebayer: true, SplitChannels: split, PathMode: 0, DebayerdFolderName: 'debayered',
            SkipExistingFiles: true, OverwriteAllFiles: true, NeedApproving: true},
        PATHMODE: {ABSOLUTE: 0, PUT_IN_ROOT_SUBFOLDER: 1, PUT_IN_OBJECT_SUBFOLDER: 2,
            RELATIVE: 3, RELATIVE_WITH_OBJECT_FOLDER: 4, PUT_FINALS_IN_OBJECT_SUBFOLDER: 5},
        ElapsedTime: function(){}, ProcessCameraHeaders: function(){},
        console: quiet, Console: quiet, debug(){}, dbgNormal: 1, dbgNotice: 2,
        UndoFlag_NoSwapFile: 0, FILEARRAY: [], requestToCopy: [],
        FITS: {ORIGINAL: 0, CALIBRATED: 1, COSMETIZED: 2, ABED: 3, REGISTERED: 4, NORMALIZED: 5},
        getFILEARRPropertyName: n => ['fullname','calibrated','cosmetized','abed','registered','normalized'][n],
        getCorrectExtension: f => path.extname(f).slice(1),
        headers: Object.fromEntries(['OBSERVER','TELESCOP','INSTRUME','DATE-OBS','EXPTIME','CCD-TEMP','FILTER',
            'OBJECT','XBINNING','XPIXSZ','FOCALLEN'].map(k => [k,null])),
        FILTERS_DICTIONARY: {}, CAMERA_DICTIONARY: {}, TELESCOP_DICTIONARY: {},
        coreVersionMajor: 1, coreVersionMinor: 8, coreVersionRelease: 9,
        ProcessInstance: {fromIcon: () => null},
        AutomaticBackgroundExtractor: function () {this.executeOn = () => true;},
        getRegistrationReferenceFile: () => '/ref/registration.fit',
        StarAlignment: function () {this.executeGlobal = function () {
            const file = this.targets[0][2];
            disk.set(this.outputDirectory + '/' + File.extractName(file) + this.outputPostfix + this.outputExtension, disk.get(file));
            return true;
        };},
        getNormalizationReferenceFile(object, filter) {references.push(filter); return '/ref/' + filter;},
        LocalNormalization: function () {this.executeGlobal = function () {
            for (const row of this.targetItems) disk.set(this.outputDirectory + '/' + File.extractName(row[1]) + this.outputPostfix + this.outputExtension, input());
            return true;
        };}
    };
    vm.createContext(context);
    vm.runInContext('String.toUpperCase = function(s) { return String(s).toUpperCase(); };', context);
    vm.runInContext(source.slice(source.indexOf('function AutoCalibrateEngine()')), context);
    const engine = new context.AutoCalibrateEngine(); engine.BaseCalibratedOutputPath = '/out';
    return {context, engine, disk, opened, debayers, references};
}
for (const pattern of ['RGGB','BGGR','GBRG','GRBG']) {
    const t = setup({pattern});
    assert.deepEqual(Array.from(t.engine.debayerSplitFit('/in/light_c_cc.fit')), ['/out/debayered/light_d_RGB_c_cc.xisf']);
    assert.equal(t.debayers[0].debayerMethod, t.context.Debayer.prototype.VNG);
    assert.equal(t.debayers[0].bayerPattern, t.context.Debayer.prototype[pattern]);
    assert.ok(t.opened.every(w => w.closed));
}
{
    const t = setup({split: true, metadata: true});
    const outputs = t.engine.debayerSplitFit('/in/light_c.xisf');
    assert.equal(outputs.length, 3);
    outputs.forEach((file,i) => {
        const w = t.disk.get(file);
        assert.equal(w.keywords.find(k => k.name === 'FILTER').strippedValue, ['R','G','B'][i]);
        assert.equal(w.mainView.image.channelCopied, i);
        assert.equal(w.bitsPerSample, 32);
        assert.ok(!w.mainView.hasProperty('CFA:SourcePattern'));
        assert.ok(w.mainView.hasProperty('Observation:Time:Start'));
    });
    assert.equal(t.debayers[0].bayerPattern, t.context.Debayer.prototype.Auto);
    t.engine.debayerSplitFit('/in/light_c.xisf');
    assert.equal(t.debayers.length, 1, 'reuse complete output sets');
    t.disk.delete(outputs[1]);
    t.engine.debayerSplitFit('/in/light_c.xisf');
    assert.ok(t.disk.has(outputs[1]), 'recover a missing channel');
    assert.ok(t.opened.every(w => w.closed));
}
for (const options of [{pattern: 'L'}, {color: true}]) {
    const t = setup(options);
    assert.deepEqual(Array.from(t.engine.debayerSplitFit('/in/mono.fit')), ['/in/mono.fit']);
    assert.equal(t.debayers.length, 0);
}
{
    const t = setup(); t.context.Config.NeedDebayer = false;
    assert.deepEqual(Array.from(t.engine.debayerSplitFit('/in/mono.fit')), ['/in/mono.fit']);
    assert.equal(t.engine.debayerSplitFit(false), false);
    assert.equal(t.opened.length, 0);
}
{
    const t = setup(); t.context.Debayer.prototype.executeOn = () => false;
    assert.equal(t.engine.debayerSplitFit('/in/light_c.fit'), false);
    assert.ok(t.opened.every(w => w.closed), 'close images on process failure');
}
{
    const t = setup({split: true});
    const outputs = t.engine.debayerSplitFit('/in/light_c.fit');
    const registered = outputs.map(f => f.replace('_c.xisf', '_c_r.xisf'));
    outputs.forEach((f,i) => t.disk.set(registered[i], t.disk.get(f)));
    Object.assign(t.context.Config, {NeedNormalization: true, NormilizedFolderName: 'normalized'});
    const normalized = t.engine.localNormalization(registered);
    assert.deepEqual(t.references, ['R','G','B']);
    assert.equal(normalized.length, 3, 'return normalized images to SubframeSelector');
    assert.ok(normalized.every(f => f.endsWith('_r_n.xisf') && t.disk.has(f)));
    t.engine.addFileForApproving(normalized);
    assert.equal(t.engine.approveFileList.length, 3);
}
for (const split of [false, true]) {
    const t = setup({split});
    Object.assign(t.context.Config, {NeedABE: true, NeedRegister: true, NeedNormalization: true,
        ABEFolderName: 'abe', RegisteredFolderName: 'registered', NormilizedFolderName: 'normalized'});
    assert.equal(t.engine.processAfterCosmetic('/in/light_c_cc.fit'), true);
    assert.equal(t.engine.approveFileList.length, split ? 3 : 1);
    assert.ok(t.engine.approveFileList.every(f => /_c_cc_b_r_n\.xisf$/.test(f)));
    assert.deepEqual(t.references, split ? ['R','G','B'] : ['RGB']);
    t.engine.ScanArray();
    assert.equal(t.debayers.length, 1, 'second pass must not reprocess converted records');
}
{
    const t = setup({split: true});
    Object.assign(t.context.Config, {OutputPath: '/out'});
    t.context.FILEARRAY.push({fits: 'light', cosmetized: '/out/cosmetized/light_c_cc.fit'});
    assert.equal(t.engine.scanDebayerArray(), true);
    assert.equal(t.engine.approveFileList.length, 3, 'resume cosmetic input through Debayer');
    assert.equal(t.debayers.length, 1);
}
{
    const t = setup();
    Object.assign(t.context.Config, {OutputPath: '/out'});
    t.context.FILEARRAY.push({fits: 'light_d_RGB', calibrated: '/out/debayered/light_d_RGB_c.xisf'});
    t.engine.cosmeticFit = () => {throw new Error('Do not cosmetically correct converted input');};
    t.engine.scanDebayerArray();
    assert.equal(t.debayers.length, 0);
    assert.equal(t.engine.approveFileList.length, 1);
}
// Settings must survive both application preferences and process-instance round trips.
{
    const values = new Map();
    const c = {DEBUG: false, SETTINGS_KEY_BASE: 'test/', DataType_Boolean: 1, DataType_String: 2,
        DataType_Int16: 3, Settings: {read: k => values.get(k), write: (k,t,v) => values.set(k,v)},
        Parameters: {set: (k,v) => values.set(k,v), has: k => values.has(k),
            getBoolean: k => values.get(k), getString: k => values.get(k), getInteger: k => values.get(k)},
        console: {writeln() {}}};
    vm.createContext(c);
    const code = fs.readFileSync(path.join(__dirname, '../AutoCalibrate-settings.js'), 'utf8');
    vm.runInContext(code.slice(code.indexOf('function ConfigData()')), c);
    const config = new c.ConfigData(); config.NeedDebayer = true; config.SplitChannels = true;
    config.saveSettings();
    const restored = new c.ConfigData(); restored.loadSettings();
    assert.equal(restored.NeedDebayer, true); assert.equal(restored.SplitChannels, true);
    config.exportParameters();
    const instance = new c.ConfigData(); instance.importParameters();
    assert.equal(instance.NeedDebayer, true); assert.equal(instance.SplitChannels, true);
}
console.log('Debayer orchestration tests passed');
