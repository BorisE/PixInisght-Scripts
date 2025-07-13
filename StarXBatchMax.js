/*
   StarXBatchMax.js - Apply StarXTerminator with multiple overlap values
   and merge results using maximum pixel value.

   This script clones the active view and runs StarXTerminator on each
   clone with overlap values in a configurable range.  The resulting
   images are then combined with a PixelMath expression taking the
   maximum value for every pixel.
*/

#feature-id    Utilities2 > StarXBatchMax
#feature-info  Apply StarXTerminator with multiple overlap parameters and
#feature-info  compose the maximum of the results.

#include <pjsr/UndoFlag.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/FrameStyle.jsh>

// ---------------------------------------------------------------------------
// Global overlap parameters
// ---------------------------------------------------------------------------
#define __SCRIPT_NAME__ "StarXBatchMax"
#define __SCRIPT_VERSION__ "1.0"
#define __SCRIPT_DATE__ "20250713"

#define __INFO_STRING__ "A PixInsight script for generating starless image created with different overlap values"
#define __COPYRIGHT_STRING__ "Copyright &copy; 2025 by Boris Emchenko (astromania.info)"

// Restrictions
#define OVERLAP_VALUE_MIN     0.05  // Lowest possible overlap value
#define OVERLAP_VALUE_MAX     0.65  // Highest possible overlap value
// Defaults
#define OVERLAP_MIN_DEFAULT   0.20  // Lowest overlap value
#define OVERLAP_MAX_DEFAULT   0.60  // Highest overlap value
#define OVERLAP_STEP_DEFAULT  0.10  // Increment between overlap values


// Current values
var OVERLAP_MIN  = OVERLAP_MIN_DEFAULT;   // Lowest overlap value
var OVERLAP_MAX  = OVERLAP_MAX_DEFAULT;   // Highest overlap value
var OVERLAP_STEP = OVERLAP_STEP_DEFAULT;  // Increment between overlap values
var CLOSE_INTERMEDIATE = true; // Close temporary SXT images


function exportParameters()
{
   Parameters.clear();
   Parameters.set( "OVERLAP_MIN", OVERLAP_MIN );
   Parameters.set( "OVERLAP_MAX", OVERLAP_MAX );
   Parameters.set( "OVERLAP_STEP", OVERLAP_STEP );
   Parameters.set( "close_intermediate", CLOSE_INTERMEDIATE );
}

function importParameters()
{
   if ( Parameters.has( "OVERLAP_MIN" ) )
      OVERLAP_MIN = Parameters.getReal( "OVERLAP_MIN" );
   if ( Parameters.has( "OVERLAP_MAX" ) )
      OVERLAP_MAX = Parameters.getReal( "OVERLAP_MAX" );
   if ( Parameters.has( "OVERLAP_STEP" ) )
      OVERLAP_STEP = Parameters.getReal( "OVERLAP_STEP" );
   if ( Parameters.has( "close_intermediate" ) )
      CLOSE_INTERMEDIATE = Parameters.getBoolean( "close_intermediate" );
}

// ---------------------------------------------------------------------------
// GUI Dialog for parameter selection
// ---------------------------------------------------------------------------
function OverlapDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var labelWidth1 = this.font.width( "Maximum overlap:" ) + 120;

    this.helpLabel = new Label(this);
    with (this.helpLabel) {
        frameStyle = FrameStyle_Box;
        margin = 4;
        wordWrapping = true;
        useRichText = true;
        backgroundColor = Color.rgbaColor(150,200,255,0xff);
        text = "<p><b>" + __SCRIPT_NAME__ + " v" + __SCRIPT_VERSION__ + "</b><br/>" +
            __INFO_STRING__ +
            ".</p>"
            + "<p>" +
            __COPYRIGHT_STRING__ +
            "</p>"
        setScaledMinWidth(labelWidth1); //min width //45*this.font.width( 'M' );
    }

   this.minEdit = new NumericEdit( this );
   with ( this.minEdit )
   {
      label.text = "Start overlap:";
      label.minWidth = labelWidth1;
      setRange( OVERLAP_VALUE_MIN, OVERLAP_VALUE_MAX );
      setPrecision( 2 );
      setValue( OVERLAP_MIN );
      toolTip = "Lowest overlap value, should be lower then highest and could be in the range [" + OVERLAP_VALUE_MIN + "," + OVERLAP_VALUE_MAX + "].<br>For StarXTerminator default value is 0.2, if 'Large overlap option' selected - then 0.5";
      onValueUpdated = function( value ){ OVERLAP_MIN = value; };
   }

   this.maxEdit = new NumericEdit( this );
   with ( this.maxEdit )
   {
      label.text = "End overlap:";
      label.minWidth = labelWidth1;
      setRange( OVERLAP_VALUE_MIN, OVERLAP_VALUE_MAX );
      setPrecision( 2 );
      setValue( OVERLAP_MAX );
      toolTip = "Highest overlap value, should be higher then lowest and could be in the range [" + OVERLAP_VALUE_MIN + "," + OVERLAP_VALUE_MAX + "].<br>For StarXTerminator default value is 0.2, if 'Large overlap option' selected - then 0.5";
      onValueUpdated = function( value ){ OVERLAP_MAX = value; };
   }

   this.stepEdit = new NumericEdit( this );
   with ( this.stepEdit )
   {
      label.text = "Step:";
      label.minWidth = labelWidth1;
      setRange( 0.01, 1.0 );
      setPrecision( 2 );
      setValue( OVERLAP_STEP_DEFAULT );
      toolTip = "Increment between overlap values";
      onValueUpdated = function( value ){ OVERLAP_STEP = value; };
   }

   this.closeCheckBox = new CheckBox( this );
   with ( this.closeCheckBox )
   {
      text = "Close intermediate SXT images";
      checked = CLOSE_INTERMEDIATE;
      toolTip = "Close temporary StarXTerminator images after processing";
      onCheck = function( checked ){ CLOSE_INTERMEDIATE = checked; };
   }

   this.newInstance_Button = new ToolButton( this );
   this.newInstance_Button.icon = new Bitmap( ":/process-interface/new-instance.png" );
   this.newInstance_Button.toolTip = "New Instance";
   this.newInstance_Button.onMousePress = function()
   {
      this.hasFocus = true;
      exportParameters();
      this.pushed = false;
      this.dialog.newInstance();
   };

   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/images/icons/ok.png" );
   this.ok_Button.onClick = function(){ this.dialog.ok(); };

   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/images/icons/cancel.png" );
   this.cancel_Button.onClick = function(){ this.dialog.cancel(); };

   this.buttonsSizer = new HorizontalSizer;
   this.buttonsSizer.spacing = 6;
   this.buttonsSizer.add( this.newInstance_Button );
   this.buttonsSizer.addStretch();
   this.buttonsSizer.add( this.ok_Button );
   this.buttonsSizer.add( this.cancel_Button );

   this.paramsBox = new GroupBox( this );
   with ( this.paramsBox )
   {
      title = "Overlap Parameters";
      sizer = new VerticalSizer;
      sizer.margin = 6;
      sizer.spacing = 4;
      sizer.add( this.minEdit );
      sizer.add( this.maxEdit );
      sizer.add( this.stepEdit );
      sizer.add( this.closeCheckBox );
   }

   this.sizer = new VerticalSizer;
   this.sizer.margin = 6;
   this.sizer.spacing = 6;
   this.sizer.add( this.helpLabel );
   this.sizer.add( this.paramsBox );
   this.sizer.add( this.buttonsSizer );

   this.windowTitle = "StarXBatchMax";
   this.adjustToContents();
   this.setFixedSize();
}

OverlapDialog.prototype = new Dialog;

function cloneView( view, newId )
{
   var win = new ImageWindow( view.image.width, view.image.height,
                              view.image.numberOfChannels,
                              view.image.bitsPerSample, view.image.isReal,
                              view.image.isColor, newId );
   win.mainView.beginProcess( UndoFlag_NoSwapFile );
   win.mainView.image.assign( view.image );
   win.mainView.endProcess();
   win.mainView.id = newId;
   return win.mainView;
}

function run()
{
   var window = ImageWindow.activeWindow;
   if ( window.isNull )
      throw new Error( "No active image" );

   var baseView = window.currentView;
   var overlapValues = [];
   for ( var o = Math.min(OVERLAP_MIN,OVERLAP_MAX); o <= Math.max(OVERLAP_MIN,OVERLAP_MAX) + 1e-5; o += OVERLAP_STEP )
      overlapValues.push( Math.round( o*100 )/100 );

   var ids = [];
   var clones = [];

   for ( var i = 0; i < overlapValues.length; ++i )
   {
      var ov = overlapValues[i];
      var suffix = ( ov*100 < 10 ? "0" : "" ) + Math.round( ov*100 );
      var id = "SXT_" + suffix;
      var clone = cloneView( baseView, id );
      clones.push( clone );

      var P = new StarXTerminator;
      P.ai_file = "StarXTerminator.11.pb";
      P.stars = false;
      P.unscreen = false;
      P.overlap = ov;
      P.executeOn( clone );

      ids.push( id );
   }

   var expression = "max(" + ids.join( "," ) + ")";

   var PM = new PixelMath;
   PM.expression = expression;
   PM.useSingleExpression = true;
   PM.generateOutput = true;
   PM.singleThreaded = false;
   PM.optimization = true;
   PM.use64BitWorkingImage = false;
   PM.rescale = false;
   PM.rescaleLower = 0;
   PM.rescaleUpper = 1;
   PM.truncate = true;
   PM.truncateLower = 0;
   PM.truncateUpper = 1;
   PM.createNewImage = true;
   PM.showNewImage = true;
   PM.newImageId = baseView.id + "_SXTmax";
   PM.newImageWidth = 0;
   PM.newImageHeight = 0;
   PM.newImageAlpha = false;
   PM.newImageColorSpace = PixelMath.prototype.SameAsTarget;
   PM.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
   PM.executeOn( baseView );

   for ( var j = 0; j < clones.length; ++j )
   {
      var w = clones[j];
      if ( CLOSE_INTERMEDIATE )
      {
         w.window.hide();
         w.setPropertyValue("dispose", true);
         w.window.forceClose();
      }
      else
      {
         w.show();
         w.zoomToFit();
      }
   }
}

function main()
{
   if ( Parameters.isGlobalTarget || Parameters.isViewTarget )
   {
      importParameters();
      run();
   }
   else
   {
      var dialog = new OverlapDialog();
      if ( dialog.execute() )
         run();
   }
}

main();
