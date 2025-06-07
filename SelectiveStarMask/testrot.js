#include <pjsr/UndoFlag.jsh>

      //let bmp = new Bitmap( 500, 500 );
      let bmp = ImageWindow.activeWindow.currentView.image.render();
      //bmp.fill( 0x0 );

      let G = new VectorGraphics( bmp );
      G.antialiasing = true;
      G.pen = new Pen( 0xffffffff );

      x=225; y = 419; ang=30;
      G.translateTransformation( x, y);
      G.rotateTransformation((180 - ang) * Math.PI / 180);
      G.fillEllipse( -26, -16, 26 , 16, new Brush(0xFFFFFFFF) );
      G.fillEllipse( 30, -1, 32 , 2, new Brush(0xFFFFFFFF) );
      G.resetTransformation();

      x=325; y = 485; ang=60;
      G.translateTransformation( x, y);
      G.rotateTransformation(ang * Math.PI / 180);
      G.fillEllipse( -26, -16, 26 , 16, new Brush(0xFFFFFFFF) );
      G.fillEllipse( 30, -1, 32 , 2, new Brush(0xFFFFFFFF) );
      G.resetTransformation();

      x=412; y = 545; ang=120;
      G.translateTransformation( x, y);
      G.rotateTransformation(ang * Math.PI / 180);
      G.fillEllipse( -26, -16, 26 , 16, new Brush(0xFFFFFFFF) );
      G.fillEllipse( 30, -1, 32 , 2, new Brush(0xFFFFFFFF) );
      G.resetTransformation();

      x=489; y = 595; ang=150;
      G.translateTransformation( x, y);
      G.rotateTransformation(ang * Math.PI / 180);
      G.fillEllipse( 30, -1, 32 , 2, new Brush(0xFFFFFFFF) );
      G.fillEllipse( -26, -16, 26 , 16, new Brush(0xFFFFFFFF) );

      G.resetTransformation();

      G.end();

      let w = new ImageWindow( bmp.width, bmp.height,
            1,      // numberOfChannels
            8,      // bitsPerSample
            false,  // floatSample
            false,  // color
            "test" );
      w.mainView.beginProcess( UndoFlag_NoSwapFile );
      w.mainView.image.blend( bmp );
      w.mainView.endProcess();
      w.show();
      w.zoomToFit();


