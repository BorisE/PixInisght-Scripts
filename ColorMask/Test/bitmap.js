#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/Color.jsh>



#include "BitmapControl.js"


function MyDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   let thisFilePath = #__FILE__;
   let thisDirectory = File.extractDrive( thisFilePath ) + File.extractDirectory( thisFilePath );
   console.writeln( thisDirectory );

   //this.bitmap = new Bitmap( ":/appicon/pixinsight-icon.svg" );
   this.bitmap = new Bitmap( thisDirectory+ "/hue-wheel.png" );


   this.bitmapControl = new Control( this );
   this.bitmapControl.setScaledMinSize( 256, 256 );
   this.bitmapControl.onPaint = function()
   {
      let g = new Graphics( this );
      //g.drawBitmap( 0, 0, this.dialog.bitmap.scaledTo( Math.min( this.width, this.height ) ) );
      g.drawBitmap( 0, 0, this.dialog.bitmap.scaled( Math.min( this.width, this.height )/ Math.max( this.dialog.bitmap.width, this.dialog.bitmap.height )  ) );
      g.end();
   };

   this.sizer = new HorizontalSizer( this );
   this.sizer.margin = 8;
   this.sizer.add( this.bitmapControl, 100 );

   this.adjustToContents();
}



MyDialog.prototype = new Dialog;

function main()
{
   (new MyDialog).execute();
}

main();

