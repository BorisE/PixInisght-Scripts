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

        if ((o = load("AddData_Gain_flag",     DataType_Boolean)) != null)
            this.AddData_Gain_flag = o;
        if ((o = load("AddData_Offset_flag",   DataType_Boolean)) != null)
            this.AddData_Offset_flag = o;
        if ((o = load("AddData_ReadMode_flag", DataType_Boolean)) != null)
            this.AddData_ReadMode_flag = o;
        if ((o = load("AddData_USBLimit_flag", DataType_Boolean)) != null)
            this.AddData_USBLimit_flag = o;
		
        if ((o = load("ForceHeaderModification", DataType_Boolean)) != null)
            this.ForceHeaderModification = o;
        if ((o = load("AddData_Recalculate_flag", DataType_Boolean)) != null)
            this.AddData_Recalculate_flag = o;

		
    }

    this.saveSettings = function () {
        save("InputPath",           		DataType_String,  this.InputPath);
        save("AddData_Gain",        		DataType_Int16,   this.AddData_Gain);
        save("AddData_Offset",      		DataType_Int16,   this.AddData_Offset);
        save("AddData_ReadMode",    		DataType_Int16,   this.AddData_ReadMode);
        save("AddData_USBLimit",    		DataType_Int16,   this.AddData_USBLimit);
        save("AddData_Gain_flag",   		DataType_Boolean, this.AddData_Gain_flag);
        save("AddData_Offset_flag",   		DataType_Boolean, this.AddData_Offset_flag);
        save("AddData_ReadMode_flag",   	DataType_Boolean, this.AddData_ReadMode_flag);
        save("AddData_USBLimit_flag",   	DataType_Boolean, this.AddData_USBLimit_flag);
        save("ForceHeaderModification",   	DataType_Boolean, this.ForceHeaderModification);
        save("AddData_Recalculate_flag",   	DataType_Boolean, this.AddData_Recalculate_flag);

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
        Parameters.set("InputPath", 				this.InputPath);
		Parameters.set("AddData_Gain", 				this.AddData_Gain);
        Parameters.set("AddData_Offset", 			this.AddData_Offset);
        Parameters.set("AddData_ReadMode",			this.AddData_ReadMode);
        Parameters.set("AddData_USBLimit", 			this.AddData_USBLimit);
        Parameters.set("AddData_Gain_flag", 		this.AddData_Gain_flag);
        Parameters.set("AddData_Offset_flag", 		this.AddData_Offset_flag);
        Parameters.set("AddData_ReadMode_flag", 	this.AddData_ReadMode_flag);
        Parameters.set("AddData_USBLimit_flag", 	this.AddData_USBLimit_flag);
        Parameters.set("ForceHeaderModification", 	this.ForceHeaderModification);
        Parameters.set("AddData_Recalculate_flag", 	this.AddData_Recalculate_flag);

        if (DEBUG) {
            console.writeln("\n<b>Loaded Parameters:</b>");
            this.printParameters();
            console.writeln("\n");
        };
    }

    this.importParameters = function () {

        if (Parameters.has("InputPath"))
            this.InputPath = Parameters.getString("InputPath");
        if (Parameters.has("AddData_Gain"))
            this.AddData_Gain = Parameters.getInteger("AddData_Gain");
        if (Parameters.has("AddData_Offset"))
            this.AddData_Offset = Parameters.getInteger("AddData_Offset");
        if (Parameters.has("AddData_ReadMode"))
            this.AddData_ReadMode = Parameters.getInteger("AddData_ReadMode");
        if (Parameters.has("AddData_USBLimit"))
            this.AddData_USBLimit = Parameters.getInteger("AddData_USBLimit");
        if (Parameters.has("AddData_Gain_flag"))
            this.AddData_Gain_flag = Parameters.getBoolean("AddData_Gain_flag");
        if (Parameters.has("AddData_Offset_flag"))
            this.AddData_Offset_flag = Parameters.getBoolean("AddData_Offset_flag");
        if (Parameters.has("AddData_ReadMode_flag"))
            this.AddData_ReadMode_flag = Parameters.getBoolean("AddData_ReadMode_flag");
        if (Parameters.has("AddData_USBLimit_flag"))
            this.AddData_USBLimit_flag = Parameters.getBoolean("AddData_USBLimit_flag");
        if (Parameters.has("ForceHeaderModification"))
            this.ForceHeaderModification = Parameters.getBoolean("ForceHeaderModification");
        if (Parameters.has("AddData_Recalculate_flag"))
            this.AddData_Recalculate_flag = Parameters.getBoolean("AddData_Recalculate_flag");

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
        console.writeln("AddData_Gain_flag:              " + this.AddData_Gain_flag);
        console.writeln("AddData_Offset_flag:            " + this.AddData_Offset_flag);
        console.writeln("AddData_ReadMode_flag:          " + this.AddData_ReadMode_flag);
        console.writeln("AddData_USBLimit_flag:          " + this.AddData_USBLimit_flag);
		console.writeln("ForceHeaderModification:        " + this.ForceHeaderModification);
        console.writeln("AddData_Recalculate_flag:       " + this.AddData_Recalculate_flag);
}

    this.checkPathValidity = function () {
        return true;
    }

    this.loadDefaultValues = function () {}
}
