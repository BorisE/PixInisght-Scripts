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
        if ((o = load("InputPath",        DataType_String)) != null)
            this.InputPath = o;
        if ((o = load("AddData_Gain",     DataType_Int16)) != null)
            this.AddData_Gain = o;
        if ((o = load("AddData_Offset",   DataType_Int16)) != null)
            this.AddData_Offset = o;
        if ((o = load("AddData_ReadMode", DataType_Int16)) != null)
            this.AddData_ReadMode = o;
        if ((o = load("AddData_USBLimit", DataType_Int16)) != null)
            this.AddData_USBLimit = o;

    }

    this.saveSettings = function () {
        save("InputPath",           DataType_String,  this.InputPath);
        save("AddData_Gain",        DataType_Int16,   this.AddData_Gain);
        save("AddData_Offset",      DataType_Int16,   this.AddData_Offset);
        save("AddData_ReadMode",    DataType_Int16,   this.AddData_ReadMode);
        save("AddData_USBLimit",    DataType_Int16,   this.AddData_USBLimit);


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
        console.writeln("AddData_Gain:                   " + this.AddData_Gain);
        console.writeln("AddData_Offset:                 " + this.AddData_Offset);
        console.writeln("AddData_ReadMode:               " + this.AddData_ReadMode);
        console.writeln("AddData_USBLimit:               " + this.AddData_USBLimit);
    }

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
