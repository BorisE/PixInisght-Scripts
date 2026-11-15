#include <pjsr/DataType.jsh>

#define SETTINGS_KEY_BASE "DBESampleTool/"

function DBESampleToolSettings()
{
   this.samplesPerRow = 12;
   this.sampleRadius = 10;
   this.targetViewId = "";
   this.processIconId = "";
}

// The Settings store retains the last dialog values across PixInsight sessions.
DBESampleToolSettings.prototype.loadSettings = function()
{
   this.samplesPerRow = Settings.read( SETTINGS_KEY_BASE + "samplesPerRow", DataType_Int32 ) || this.samplesPerRow;
   this.sampleRadius = Settings.read( SETTINGS_KEY_BASE + "sampleRadius", DataType_Int32 ) || this.sampleRadius;
   this.targetViewId = Settings.read( SETTINGS_KEY_BASE + "targetViewId", DataType_String ) || "";
   this.processIconId = Settings.read( SETTINGS_KEY_BASE + "processIconId", DataType_String ) || "";
};

DBESampleToolSettings.prototype.saveSettings = function()
{
   Settings.write( SETTINGS_KEY_BASE + "samplesPerRow", DataType_Int32, this.samplesPerRow );
   Settings.write( SETTINGS_KEY_BASE + "sampleRadius", DataType_Int32, this.sampleRadius );
   Settings.write( SETTINGS_KEY_BASE + "targetViewId", DataType_String, this.targetViewId );
   Settings.write( SETTINGS_KEY_BASE + "processIconId", DataType_String, this.processIconId );
};

// An instance overrides the stored defaults only for keys present in that icon.
DBESampleToolSettings.prototype.importParameters = function()
{
   if ( Parameters.has( "samplesPerRow" ) )
      this.samplesPerRow = Parameters.getInteger( "samplesPerRow" );
   if ( Parameters.has( "sampleRadius" ) )
      this.sampleRadius = Parameters.getInteger( "sampleRadius" );
   if ( Parameters.has( "targetViewId" ) )
      this.targetViewId = Parameters.getString( "targetViewId" );
   if ( Parameters.has( "processIconId" ) )
      this.processIconId = Parameters.getString( "processIconId" );
};

// Dialog.newInstance() captures this parameter snapshot in the script icon.
DBESampleToolSettings.prototype.exportParameters = function()
{
   Parameters.clear();
   Parameters.set( "samplesPerRow", this.samplesPerRow );
   Parameters.set( "sampleRadius", this.sampleRadius );
   Parameters.set( "targetViewId", this.targetViewId );
   Parameters.set( "processIconId", this.processIconId );
};
