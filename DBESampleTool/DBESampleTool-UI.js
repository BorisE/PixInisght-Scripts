#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>

function DBESampleToolDialog( settings )
{
   this.__base__ = Dialog;
   this.__base__();

   var helpLabel = new Label( this );
   helpLabel.frameStyle = FrameStyle_Box;
   helpLabel.margin = 4;
   helpLabel.wordWrapping = true;
   helpLabel.useRichText = true;
   helpLabel.text = "<p><b>" + TITLE + " v" + VERSION + "</b><br/>" +
      INFO_STRING + "</p><p>" + COPYRIGHT_STRING + "</p>";
   helpLabel.setScaledMinWidth( 360 );

   var labelWidth = this.font.width( "Min. bright area (%)  " );

   var targetLabel = new Label( this );
   targetLabel.text = "Target image";
   targetLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   targetLabel.setFixedWidth( labelWidth );

   var targetList = new ViewList( this );
   targetList.getMainViews();
   // A stored view identifier may no longer refer to an open image.
   var savedView = settings.targetViewId ? View.viewById( settings.targetViewId ) : null;
   if ( savedView && savedView.isMainView )
      targetList.currentView = savedView;
   else
   {
      var activeWindow = ImageWindow.activeWindow;
      if ( !activeWindow.isNull )
         targetList.currentView = activeWindow.mainView;
   }

   var targetSizer = new HorizontalSizer;
   targetSizer.spacing = 6;
   targetSizer.add( targetLabel );
   targetSizer.add( targetList, 100 );

   var iconLabel = new Label( this );
   iconLabel.text = "DBE icon";
   iconLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   iconLabel.setFixedWidth( labelWidth );

   var manualIconId = "<manual>";
   var iconIds = ["", manualIconId].concat(
      ProcessInstance.iconsByProcessId( "DynamicBackgroundExtraction" ).sort() );

   var iconList = new ComboBox( this );
   iconList.toolTip = "Choose an icon to update, use automatic naming, or always open DBE for manual editing.";
   iconList.addItem( "Automatic (image ID + _DBE)" );
   iconList.addItem( "Always open DBE (manual)" );
   for ( var i = 2; i < iconIds.length; ++i )
      iconList.addItem( iconIds[i] );
   // A saved icon that is no longer available falls back to Automatic.
   iconList.currentItem = Math.max( 0, iconIds.indexOf( settings.processIconId ) );

   var iconSizer = new HorizontalSizer;
   iconSizer.spacing = 6;
   iconSizer.add( iconLabel );
   iconSizer.add( iconList, 100 );

   var sampleGroup = new GroupBox( this );
   sampleGroup.title = "Sample Generation";

   var modeLabel = new Label( sampleGroup );
   modeLabel.text = "Grid mode";
   modeLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   modeLabel.setFixedWidth( labelWidth );

   var modeList = new ComboBox( sampleGroup );
   modeList.addItem( "Regular grid" );
   modeList.addItem( "Regular grid with structure rejection" );
   modeList.currentItem = settings.rejectExtendedStructure ? 1 : 0;
   modeList.toolTip = "Skip sample boxes containing extended bright structure.";

   var modeSizer = new HorizontalSizer;
   modeSizer.spacing = 6;
   modeSizer.add( modeLabel );
   modeSizer.add( modeList, 100 );

   var samplesLabel = new Label( sampleGroup );
   samplesLabel.text = "Samples per row";
   samplesLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   samplesLabel.setFixedWidth( labelWidth );

   var samplesSpinBox = new SpinBox( sampleGroup );
   samplesSpinBox.minValue = 2;
   samplesSpinBox.maxValue = 50;
   samplesSpinBox.value = settings.samplesPerRow;
   samplesSpinBox.onValueUpdated = function( value )
   {
      settings.samplesPerRow = value;
   };

   var samplesSizer = new HorizontalSizer;
   samplesSizer.spacing = 6;
   samplesSizer.add( samplesLabel );
   samplesSizer.add( samplesSpinBox );
   samplesSizer.addStretch();

   var radiusLabel = new Label( sampleGroup );
   radiusLabel.text = "Sample radius (px)";
   radiusLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   radiusLabel.setFixedWidth( labelWidth );

   var radiusSpinBox = new SpinBox( sampleGroup );
   radiusSpinBox.minValue = 1;
   radiusSpinBox.maxValue = 100;
   radiusSpinBox.value = settings.sampleRadius;
   radiusSpinBox.onValueUpdated = function( value )
   {
      settings.sampleRadius = value;
   };

   var radiusSizer = new HorizontalSizer;
   radiusSizer.spacing = 6;
   radiusSizer.add( radiusLabel );
   radiusSizer.add( radiusSpinBox );
   radiusSizer.addStretch();

   var sigmaControl = new NumericControl( sampleGroup );
   sigmaControl.label.text = "Threshold (sigma)";
   sigmaControl.label.setFixedWidth( labelWidth );
   sigmaControl.setReal( true );
   sigmaControl.setPrecision( 1 );
   sigmaControl.setRange( 1, 10 );
   sigmaControl.slider.setRange( 10, 100 );
   sigmaControl.setValue( settings.rejectionSigma );
   sigmaControl.toolTip = "How far above the estimated background a block must be. Lower values reject fainter structures.";
   sigmaControl.onValueUpdated = function( value )
   {
      settings.rejectionSigma = value;
   };

   var areaControl = new NumericControl( sampleGroup );
   areaControl.label.text = "Min. bright area (%)";
   areaControl.label.setFixedWidth( labelWidth );
   areaControl.setReal( false );
   areaControl.setRange( 10, 100 );
   areaControl.slider.setRange( 10, 100 );
   areaControl.setValue( settings.rejectionArea );
   areaControl.toolTip = "Minimum connected bright area, rounded up to whole blocks. At least three blocks must qualify.";
   areaControl.onValueUpdated = function( value )
   {
      settings.rejectionArea = value;
   };

   sigmaControl.enabled = areaControl.enabled = settings.rejectExtendedStructure;
   modeList.onItemSelected = function( item )
   {
      settings.rejectExtendedStructure = item === 1;
      sigmaControl.enabled = areaControl.enabled = settings.rejectExtendedStructure;
   };

   sampleGroup.sizer = new VerticalSizer;
   sampleGroup.sizer.margin = 6;
   sampleGroup.sizer.spacing = 4;
   sampleGroup.sizer.add( modeSizer );
   sampleGroup.sizer.add( samplesSizer );
   sampleGroup.sizer.add( radiusSizer );
   sampleGroup.sizer.add( sigmaControl );
   sampleGroup.sizer.add( areaControl );

   // Capture the selectors for both the script instance and the last-used settings.
   // An empty icon identifier represents Automatic naming.
   this.storeSelection = function()
   {
      var view = targetList.currentView;
      settings.targetViewId = view.isNull ? "" : view.id;
      settings.processIconId = iconIds[iconList.currentItem];
   };

   var newInstanceButton = new ToolButton( this );
   newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   newInstanceButton.setScaledFixedSize( 24, 24 );
   newInstanceButton.toolTip = "Drag to the workspace to save a DBE Sample Tool instance.";
   newInstanceButton.onMousePress = function()
   {
      this.hasFocus = true;
      this.dialog.storeSelection();
      // PixInsight reads the exported parameters when the triangle is dragged.
      settings.exportParameters();
      this.pushed = false;
      this.dialog.newInstance();
   };

   this.finish = null;

   // Import into native DBE after this modal dialog closes and the main view is active.
   this.queueDBEInterface = function( view, process, iconId )
   {
      this.finish = function()
      {
         try
         {
            view.window.bringToFront();
            view.window.currentView = view;
            if ( !process.launchInterface() )
               throw new Error( "PixInsight could not open the DBE interface." );
         }
         catch ( error )
         {
            console.criticalln( error.message );
            (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Ok )).execute();
            return;
         }
         if ( iconId )
            (new MessageBox(
               "Drag the blue New Instance triangle from DBE to an empty area of the workspace. " +
               "Set the new icon identifier to " + iconId + ".",
               TITLE, StdIcon_Information, StdButton_Ok )).execute();
      };
   };

   var saveButton = new PushButton( this );
   function updateSaveButton( item )
   {
      saveButton.text = iconIds[item] === manualIconId ? "Open DBE" : "Save DBE Icon";
   }
   iconList.onItemSelected = updateSaveButton;
   updateSaveButton( iconList.currentItem );
   saveButton.toolTip = "Calculate samples and send them to the selected DBE destination.";
   saveButton.enabled = !targetList.currentView.isNull;
   saveButton.onClick = function()
   {
      var view = targetList.currentView;
      this.dialog.storeSelection();
      var openManually = settings.processIconId === manualIconId;
      var iconId = openManually ? "" : settings.processIconId || view.id + "_DBE";
      // Show the process console when the user starts generating DBE samples.
      console.show();
      try
      {
         var rejection = settings.rejectExtendedStructure ?
            { sigma: settings.rejectionSigma, area: settings.rejectionArea } : null;
         var engine = new DBESampleToolEngine( settings.samplesPerRow, settings.sampleRadius, rejection );
         var process = engine.saveProcessIcon( view, iconId, openManually );
         if ( process )
            this.dialog.queueDBEInterface( view, process, iconId );
      }
      catch ( error )
      {
         console.criticalln( error.message );
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return;
      }
      this.dialog.ok();
   };

   targetList.onViewSelected = function( view )
   {
      saveButton.enabled = !view.isNull;
   };

   var closeButton = new PushButton( this );
   closeButton.text = "Close";
   closeButton.icon = this.scaledResource( ":/icons/cancel.png" );
   closeButton.toolTip = "Close the " + TITLE + " script.";
   closeButton.onClick = function()
   {
      this.dialog.cancel();
   };

   var buttonSizer = new HorizontalSizer;
   buttonSizer.add( newInstanceButton );
   buttonSizer.addStretch();
   buttonSizer.spacing = 6;
   buttonSizer.add( saveButton );
   buttonSizer.add( closeButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 6;
   this.sizer.spacing = 6;
   this.sizer.add( helpLabel );
   this.sizer.addSpacing( 4 );
   this.sizer.add( targetSizer );
   this.sizer.add( iconSizer );
   this.sizer.add( sampleGroup );
   this.sizer.addSpacing( 10 );
   this.sizer.add( buttonSizer );

   this.windowTitle = TITLE + " Script";
   this.adjustToContents();
}

DBESampleToolDialog.prototype = new Dialog;
