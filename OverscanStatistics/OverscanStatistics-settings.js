 #ifndef OverscanStatistics_settings_js
    #define OverscanStatistics_settings_js
    #include <pjsr/DataType.jsh>
 #endif

function ConfigData() {
    //temp
    this.outputExtension = "fits";
    this.outputHints = "";
    this.overwriteExisting = true;

    if (DEBUG)
        console.writeln('<br/><br/>Config object created...<br/>');

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
    }

    this.saveSettings = function () {
        save("InputPath", DataType_String, this.InputPath);

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
        Parameters.set("InputPath", this.InputPath);

        if (DEBUG) {
            console.writeln("\n<b>Loaded Parameters:</b>");

            this.printParameters();

            console.writeln("\n");
        };
    }

    this.importParameters = function () {

        if (Parameters.has("InputPath"))
            this.InputPath = Parameters.getString("InputPath");

        if (DEBUG) {
            console.writeln("<b>Loaded Parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.printParameters = function () {
        console.writeln("InputPath:                      " + this.InputPath);
    }

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
