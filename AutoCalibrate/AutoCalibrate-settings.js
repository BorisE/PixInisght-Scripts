#ifndef AutoCalibrate_settings_js
#define AutoCalibrate_settings_js
#include <pjsr/DataType.jsh>
#endif


function ConfigData()
{
	//ConfigFields
	this.inputDir = "";

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
		if ( (o = load( "InputDir",                 DataType_String )) != null )
			this.inputDir = o;
	}
	this.saveSettings = function()
	{
		save( "InputDir",               			DataType_String, this.inputDir );
	}


	/*
	 * Import / Export script parameters (global or target View run)
	 */
	this.exportParameters = function()
	{
		Parameters.set("InputDir", this.inputDir);

		if( DEBUG ) {
			console.writeln( "<b>Parameters to save:</b>" );

			console.writeln( "InputDir: " + this.inputDir );

			console.writeln( "\n" );
		};
	}

	this.importParameters = function()
	{

		if(Parameters.has("InputDir"))
			this.inputDir = Parameters.getString("InputDir");

		if( DEBUG ) {
			console.writeln( "<b>Loaded Parameters:</b>" );
			console.writeln( "InputDir: " + this.inputDir );

			console.writeln( "\n" );
		};
	}
}