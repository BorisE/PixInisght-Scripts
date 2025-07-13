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

// ---------------------------------------------------------------------------
// Global overlap parameters
// ---------------------------------------------------------------------------
var OVERLAP_MIN  = 0.05;  // Lowest overlap value
var OVERLAP_MAX  = 0.60;  // Highest overlap value
var OVERLAP_STEP = 0.05;  // Increment between overlap values
var CLOSE_INTERMEDIATE = true; // Close temporary SXT images

function exportParameters()
{
   Parameters.clear();
   Parameters.set( "overlap_min", OVERLAP_MIN );
   Parameters.set( "overlap_max", OVERLAP_MAX );
   Parameters.set( "overlap_step", OVERLAP_STEP );
   Parameters.set( "close_intermediate", CLOSE_INTERMEDIATE );
}

function importParameters()
{
   if ( Parameters.has( "overlap_min" ) )
      OVERLAP_MIN = Parameters.getReal( "overlap_min" );
   if ( Parameters.has( "overlap_max" ) )
      OVERLAP_MAX = Parameters.getReal( "overlap_max" );
   if ( Parameters.has( "overlap_step" ) )
      OVERLAP_STEP = Parameters.getReal( "overlap_step" );
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

   var labelWidth1 = this.font.width( "Maximum overlap:" ) + 20;

   this.minEdit = new NumericEdit( this );
   with ( this.minEdit )
   {
      label.text = "Start overlap:";
      label.minWidth = labelWidth1;
      setRange( 0.0, 1.0 );
      setPrecision( 2 );
      setValue( OVERLAP_MIN );
      toolTip = "Lowest overlap value";
      onValueUpdated = function( value ){ OVERLAP_MIN = value; };
   }

   this.maxEdit = new NumericEdit( this );
   with ( this.maxEdit )
   {
      label.text = "End overlap:";
      label.minWidth = labelWidth1;
      setRange( 0.0, 1.0 );
      setPrecision( 2 );
      setValue( OVERLAP_MAX );
      toolTip = "Highest overlap value";
      onValueUpdated = function( value ){ OVERLAP_MAX = value; };
   }

   this.stepEdit = new NumericEdit( this );
   with ( this.stepEdit )
   {
      label.text = "Step:";
      label.minWidth = labelWidth1;
      setRange( 0.01, 1.0 );
      setPrecision( 2 );
      setValue( OVERLAP_STEP );
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
   for ( var o = OVERLAP_MIN; o <= OVERLAP_MAX + 1e-5; o += OVERLAP_STEP )
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
      var w = clones[j].window;
      if ( CLOSE_INTERMEDIATE )
         w.close();
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
