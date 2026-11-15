#include <pjsr/FrameStyle.jsh>
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

   var labelWidth = this.font.width( "Sample radius (px)  " );

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

   var iconList = new ComboBox( this );
   iconList.toolTip = "Choose an existing DBE icon to update. Automatic uses the target image ID with the _DBE suffix.";
   iconList.addItem( "Automatic (image ID + _DBE)" );

   var iconIds = ProcessInstance.iconsByProcessId( "DynamicBackgroundExtraction" ).sort();
   for ( var i = 0; i < iconIds.length; ++i )
      iconList.addItem( iconIds[i] );
   // A missing icon maps to item 0, the Automatic naming option.
   iconList.currentItem = iconIds.indexOf( settings.processIconId ) + 1;

   var iconSizer = new HorizontalSizer;
   iconSizer.spacing = 6;
   iconSizer.add( iconLabel );
   iconSizer.add( iconList, 100 );

   var sampleGroup = new GroupBox( this );
   sampleGroup.title = "Sample Generation";

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

   sampleGroup.sizer = new VerticalSizer;
   sampleGroup.sizer.margin = 6;
   sampleGroup.sizer.spacing = 4;
   sampleGroup.sizer.add( samplesSizer );
   sampleGroup.sizer.add( radiusSizer );

   // Capture the selectors for both the script instance and the last-used settings.
   // An empty icon identifier represents Automatic naming.
   this.storeSelection = function()
   {
      var view = targetList.currentView;
      settings.targetViewId = view.isNull ? "" : view.id;
      settings.processIconId = iconList.currentItem === 0 ? "" : iconList.itemText( iconList.currentItem );
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

   var saveButton = new PushButton( this );
   saveButton.text = "Save DBE Icon";
   saveButton.toolTip = "Update the DBE icon or open DBE to create one.";
   saveButton.enabled = !targetList.currentView.isNull;
   saveButton.onClick = function()
   {
      var view = targetList.currentView;
      this.dialog.storeSelection();
      var iconId = settings.processIconId || view.id + "_DBE";
      // Show the process console when the user starts saving a DBE icon.
      console.show();
      try
      {
         var engine = new DBESampleToolEngine( settings.samplesPerRow, settings.sampleRadius );
         var process = engine.saveProcessIcon( view, iconId );
         if ( process )
            this.dialog.finish = function()
            {
               try
               {
                  view.window.bringToFront();
                  if ( !process.launchInterface() )
                     throw new Error( "PixInsight could not open the DBE interface." );
               }
               catch ( error )
               {
                  console.criticalln( error.message );
                  (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Ok )).execute();
                  return;
               }
               (new MessageBox(
                  "Drag the blue New Instance triangle from DBE to an empty area of the workspace. " +
                  "Set the new icon identifier to " + iconId + ".",
                  TITLE, StdIcon_Information, StdButton_Ok )).execute();
            };
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
