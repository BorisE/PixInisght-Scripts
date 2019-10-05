#ifndef AutoCalibrate_settings_js
#define AutoCalibrate_settings_js
#include <pjsr/DataType.jsh>
#endif


function ConfigData()
{
	//ConfigFields
	this.InputPath = ""; //cfgInputPath
	this.PathMode = 1; //cfgPathMode
	this.SearchInSubDirs = true;	//cfgSearchInSubDirs
	
	this.NeedCalibration = true;
	this.NeedABE	= false; //cfgNeedABE
	this.NeedRegister = true; //cfgNeedRegister
	this.NeedNormalization = true; //cfgNeedNormalization

	//Helper functions
	function load( key, type )
	{
		return Settings.read( SETTINGS_KEY_BASE + key, type );
	}
	function loadIndexed( key, index, type )
	{
		return load( key + '_' + index.toString(), type );
	}
	function save( key, type, value )
	{
		Settings.write( SETTINGS_KEY_BASE + key, type, value );
	}
	function saveIndexed( key, index, type, value )
	{
		save( key + '_' + index.toString(), type, value );
	}


	/*
	 * Load / Save from Settings Storage
	 */
	this.loadSettings = function()
	{
		var o;
		if ( (o = load( "InputPath",                 DataType_String )) != null )
			this.InputPath = o;
		if ( (o = load( "PathMode",                  DataType_Int16 )) != null )
			this.PathMode = o;
		if ( (o = load( "SearchInSubDirs",           DataType_Boolean )) != null )
			this.SearchInSubDirs = o;

		if ( (o = load( "NeedCalibration",           	DataType_Boolean )) != null )
			this.NeedCalibration = o;
		if ( (o = load( "NeedABE",           			DataType_Boolean )) != null )
			this.NeedABE = o;
		if ( (o = load( "NeedRegister",           		DataType_Boolean )) != null )
			this.NeedRegister = o;
		if ( (o = load( "NeedNormalization",           	DataType_Boolean )) != null )
			this.NeedNormalization = o;
	}
	
	this.saveSettings = function()
	{
		save( "InputPath",               			DataType_String,  this.InputPath );
		save( "PathMode",               			DataType_Int16,   this.PathMode );
		save( "SearchInSubDirs",           			DataType_Boolean, this.SearchInSubDirs );

		save( "NeedCalibration",           			DataType_Boolean, this.NeedCalibration );
		save( "NeedABE",           					DataType_Boolean, this.NeedABE );
		save( "NeedRegister",           			DataType_Boolean, this.NeedRegister );
		save( "NeedNormalization",           		DataType_Boolean, this.NeedNormalization );

		if( DEBUG ) {
			console.writeln( "<b>Settings saved:</b>" );

			console.writeln( "InputPath: 		" + this.InputPath );
			console.writeln( "PathMode:  		" + this.PathMode );
			console.writeln( "SearchInSubDirs:  " + this.SearchInSubDirs );

			console.writeln( "NeedCalibration:  " 	+ this.NeedCalibration );
			console.writeln( "NeedABE:  " 			+ this.NeedABE );
			console.writeln( "NeedRegister:  " 		+ this.NeedRegister );
			console.writeln( "NeedNormalization:  " + this.NeedNormalization );

			console.writeln( "\n" );
		};
	}


	/*
	 * Import / Export script parameters (global or target View run)
	 */
	this.exportParameters = function()
	{
		Parameters.set("InputPath", 		this.InputPath);
		Parameters.set("PathMode",  		this.PathMode);
		Parameters.set("SearchInSubDirs",  	this.SearchInSubDirs);

		Parameters.set("NeedCalibration",  	this.NeedCalibration);
		Parameters.set("NeedABE",  			this.NeedABE);
		Parameters.set("NeedRegister",  	this.NeedRegister);
		Parameters.set("NeedNormalization", this.NeedNormalization);

		if( DEBUG ) {
			console.writeln( "<b>Parameters to save:</b>" );

			console.writeln( "InputPath: 		" + this.InputPath );
			console.writeln( "PathMode:  		" + this.PathMode );
			console.writeln( "SearchInSubDirs:  " + this.SearchInSubDirs );

			console.writeln( "NeedCalibration:  " 	+ this.NeedCalibration );
			console.writeln( "NeedABE:  " 			+ this.NeedABE );
			console.writeln( "NeedRegister:  " 		+ this.NeedRegister );
			console.writeln( "NeedNormalization:  " + this.NeedNormalization );

			console.writeln( "\n" );
		};
	}

	this.importParameters = function()
	{

		if(Parameters.has("InputPath"))
			this.InputPath = Parameters.getString("InputPath");
		if(Parameters.has("PathMode"))
			this.PathMode = Parameters.getInteger("PathMode");
		if(Parameters.has("SearchInSubDirs"))
			this.SearchInSubDirs = Parameters.getBoolean("SearchInSubDirs");

		if(Parameters.has("NeedCalibration"))
			this.NeedCalibration = Parameters.getBoolean("NeedCalibration");
		if(Parameters.has("NeedABE"))
			this.NeedABE = Parameters.getBoolean("NeedABE");
		if(Parameters.has("NeedRegister"))
			this.NeedRegister = Parameters.getBoolean("NeedRegister");
		if(Parameters.has("NeedNormalization"))
			this.NeedNormalization = Parameters.getBoolean("NeedNormalization");


		if( DEBUG ) {
			console.writeln( "<b>Loaded Parameters:</b>" );
			console.writeln( "InputPath: 		" + this.InputPath );
			console.writeln( "PathMode:  		" + this.PathMode );
			console.writeln( "SearchInSubDirs:  " + this.SearchInSubDirs );

			console.writeln( "NeedCalibration:  " 	+ this.NeedCalibration );
			console.writeln( "NeedABE:  " 			+ this.NeedABE );
			console.writeln( "NeedRegister:  " 		+ this.NeedRegister );
			console.writeln( "NeedNormalization:  " + this.NeedNormalization );

			console.writeln( "\n" );
		};
	}
}