function createBitmapControl(parent, bitmap) 
{
   //this.bitmap = new Bitmap( ":/appicon/pixinsight-icon.svg" );
   
   this.bitmapControl = new Control( parent );
   this.bitmapControl.setScaledMinSize( 256, 256 );
   this.bitmapControl.onPaint = function()
   {
      let g = new Graphics( parent );
      //g.drawBitmap( 0, 0, this.dialog.bitmap.scaledTo( Math.min( this.width, this.height ) ) );
      g.drawBitmap( 0, 0, bitmap);
      g.end();
   };

	return this.bitmapControl;
}
	