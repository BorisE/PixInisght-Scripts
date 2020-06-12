#feature-id    Utilities > BackgroundEnhance+

#feature-info A script to enhance faint structures on deep-sky images.<br/>\
   <br/>\
   Copyright (C) 2010 Juan M. G&oacute;mez\
   Some minor enhancements (code structuring)

#include <pjsr/ColorSpace.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/FrameStyle.jsh>


#define TITLE "BackgroundEnhance"
#define VERSION "1.01"
#define COMPILE_DATE "2020/05/13"

#define INFO_STRING "A script to enhance faint structures on deep-sky images"
#define COPYRIGHT_STRING "Copyright &copy; 2010 Juan M. G&oacute;mez, some reworking by Boris Emchenko"
#define HELP_STRING "Добавляет LS компоненту по маске в исходное изображение<br/>Как он работает:<br/>\
1. Строится SS изображение: выкидываются крупномасштабные слои (см. соотв. параметр) + кривыми обрезаются highlights (регулируется SS Amount)<br/>\
2. LS вычисляется по формуле $T*~SS<br/>\
3. Вычисляется Маска: фон кривыми обрезается до 0.25 + немного поднимается яркость оставшейся части (параметр Mask Amount), а затем из маски берется масштаб 7+<br/>\
5. По маске в исходное изображение домешивается LS*amount<br/>\
Чтобы запустить процесс: настройте параметры и нажмите Preview. Нужно использовать уже на растянутом изображении"

function BackgroundEnhanceLayersData()
{
    this.numberOfLayers = 8;
    this.viewLS= true;
    this.viewSS= true;
    this.viewMS= true;
    this.amount=0.50
    this.SSamount=0.90
    this.maskamount=0.60
}

var data = new BackgroundEnhanceLayersData;

function MyDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   this.ok = false;
   this.abort = false;
   this.busy = false;
   this.cursor = new Cursor( StdCursor_Arrow  );


    //var img =ImageWindow.activeWindow.mainView.image;
    var SizeMutiplier=1; //Ширина окна как коэффициент к стандартной ширине новог окна


    var SourceView = ImageWindow.activeWindow.mainView;

    var SSView= new ImageWindow( SourceView.image.width,
                                              SourceView.image.height,
                                              SourceView.image.numberOfChannels,
                                              SourceView.window.bitsPerSample,
                                              SourceView.window.isFloatSample,
                                              SourceView.image.colorSpace != ColorSpace_Gray,
                                              "SSView" );

                SSView.mainView.beginProcess(UndoFlag_NoSwapFile);
                SSView.mainView.image.assign( SourceView.image );
                SSView.mainView.endProcess();


    var LSView= new ImageWindow( SourceView.image.width,
                                              SourceView.image.height,
                                              SourceView.image.numberOfChannels,
                                              SourceView.window.bitsPerSample,
                                              SourceView.window.isFloatSample,
                                              SourceView.image.colorSpace != ColorSpace_Gray,
                                              "LSView" );
                LSView.mainView.beginProcess(UndoFlag_NoSwapFile);
                LSView.mainView.image.assign( SourceView.image );
                LSView.mainView.endProcess();


    var MaskView= new ImageWindow( SourceView.image.width,
                                              SourceView.image.height,
                                              SourceView.image.numberOfChannels,
                                              SourceView.window.bitsPerSample,
                                              SourceView.window.isFloatSample,
                                              SourceView.image.colorSpace != ColorSpace_Gray,
                                              "MaskView" );
                MaskView.mainView.beginProcess(UndoFlag_NoSwapFile);
                MaskView.mainView.image.assign( SourceView.image );
                MaskView.mainView.endProcess();




    var FinalView= new ImageWindow( SourceView.image.width,
                                              SourceView.image.height,
                                              SourceView.image.numberOfChannels,
                                              SourceView.window.bitsPerSample,
                                              SourceView.window.isFloatSample,
                                              SourceView.image.colorSpace != ColorSpace_Gray,
                                              "FinalView" );
                FinalView.mainView.beginProcess(UndoFlag_NoSwapFile);
                FinalView.mainView.image.assign( SourceView.image );
                FinalView.mainView.endProcess();


    var Preview= new ImageWindow( SourceView.image.width,
                                              SourceView.image.height,
                                              SourceView.image.numberOfChannels,
                                              SourceView.window.bitsPerSample,
                                              SourceView.window.isFloatSample,
                                              SourceView.image.colorSpace != ColorSpace_Gray,
                                              "Preview" );
                Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
                Preview.mainView.image.assign( SourceView.image );
                Preview.mainView.endProcess();


    for(var i=0;i<11;++i) {
        Preview.zoomIn();
    }
    Preview.fitWindow();
    Preview.show();
    Preview.zoomToOptimalFit();










    //---------------------------------------------------------------------------------------
    //
    // Main Process Function
    //
    //---------------------------------------------------------------------------------------
    this.LargeScalesEnhance = function()
    {
        //Prepare
        console.show();
        this.cursor = new Cursor( StdCursor_Hourglass );
        this.ScrollControl.cursor= new Cursor( StdCursor_Hourglass );

        Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
        Preview.mainView.image.assign( SourceView.image );
        Preview.mainView.endProcess();

        SSView.mainView.beginProcess(UndoFlag_NoSwapFile);
        SSView.mainView.image.assign( SourceView.image );
        SSView.mainView.endProcess();


        LSView.mainView.beginProcess(UndoFlag_NoSwapFile);
        LSView.mainView.image.assign( SourceView.image );
        LSView.mainView.endProcess();


        MaskView.mainView.beginProcess(UndoFlag_NoSwapFile);
        MaskView.mainView.image.assign( SourceView.image );
        MaskView.mainView.endProcess();


        FinalView.mainView.beginProcess(UndoFlag_NoSwapFile);
        FinalView.mainView.image.assign( SourceView.image );
        FinalView.mainView.endProcess();



        //I. Make SSVIEW 
        
        //I.1. SSVIEW: Remove residual layer
        var auxLayers = new Array(8);
        for(var i=0;i<data.numberOfLayers;++i) {
            auxLayers[i] = [true, true, 0.000, false, 3.000, 0.50, 1];
        }
        for(var i=data.numberOfLayers;i<=8;++i) {
            auxLayers[i] = [false, true, 0.000, false, 3.000, 0.50, 1];
        }
        var wavelets = new ATrousWaveletTransform;
        with ( wavelets )
        {
            layers = auxLayers;
            scaleDelta = 0;
            scalingFunctionData = [
              0.2928932,0.5,0.2928932,
              0.5,1,0.5,
              0.2928932,0.5,0.2928932
            ];
            scalingFunctionKernelSize = 3;
            scalingFunctionNoiseSigma = [
              0.8095,0.2688,0.1176,
              0.0568,0.0283,0.0141,
              0.0071,0.0036,0.0018,
              0.0009
            ];
            scalingFunctionNoiseLayers = 10;
            scalingFunctionName = "3x3 Linear Interpolation";
            largeScaleFunction = NoFunction;
            curveBreakPoint = 0.75;
            noiseThresholding = false;
            noiseThresholdingAmount = 1.00;
            noiseThreshold = 3.00;
            softThresholding = true;
            useMultiresolutionSupport = false;
            deringing = false;
            deringingDark = 0.1000;
            deringingBright = 0.0000;
            outputDeringingMaps = false;
            lowRange = 0.0000;
            highRange = 0.0000;
            previewMode = Disabled;
            previewLayer = 0;
            toLuminance = true;
            toChrominance = true;
            linear = false;
        }


        SSView.mainView.beginProcess(UndoFlag_NoSwapFile);
        wavelets.executeOn(SSView.mainView);
        SSView.mainView.endProcess();

        //I.2. SSVIEW: Boost brightness (clip highlights)

/*
        Point 1:    0.0, 0.0 
        Point 2: зависит от SSamount (стандарт 0.9) - т.е. по сути на 0.1 (чуть дальше) уже обрезаются Highlights

data.SSamount	0,00	0,10	0,20	0,30	0,40	0,50	0,60	0,70	0,80	0,90	1,00
            x	1,00	0,90	0,80	0,70	0,60	0,50	0,40	0,30	0,20	0,10	0,00
            y	0,00	0,10	0,20	0,30	0,40	0,50	0,60	0,70	0,80	0,90	1,00


*/
        var curves = new CurvesTransformation;
        with ( curves )
        {
            R = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Rt = AkimaSubsplines;
            G = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Gt = AkimaSubsplines;
            B = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Bt = AkimaSubsplines;
            K = [ // x, y
              [0.00000, 0.00000],
              [1-data.SSamount, data.SSamount],
              [1.00000, 1.00000]
            ];
            Kt = AkimaSubsplines;
            L = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Lt = AkimaSubsplines;
            a = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            at = AkimaSubsplines;
            b = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            bt = AkimaSubsplines;
            c = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            ct = AkimaSubsplines;
            H = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Ht = AkimaSubsplines;
            S = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            St = AkimaSubsplines;
        }


        SSView.mainView.beginProcess(UndoFlag_NoSwapFile);
        curves.executeOn(SSView.mainView);
        SSView.mainView.endProcess();

        //II. PREPARE LSVIEW
        
        //II.1. LSVIEW: Subtract SSVIEW
        var pm = new PixelMath;
        with ( pm )
        {
            expression = "LSView*~SSView";
            expression1 = "";
            expression2 = "";
            expression3 = "";
            useSingleExpression = true;
            symbols = "";
            use64BitWorkingImage = false;
            rescale = false;
            rescaleLower = 0.0000000000;
            rescaleUpper = 1.0000000000;
            truncate = true;
            truncateLower = 0.0000000000;
            truncateUpper = 1.0000000000;
            createNewImage = false;
            newImageId = "";
            newImageWidth = 0;
            newImageHeight = 0;
            newImageAlpha = false;
            newImageColorSpace = SameAsTarget;
            newImageSampleFormat = SameAsTarget;
        }

        LSView.mainView.beginProcess(UndoFlag_NoSwapFile);
        pm.executeOn(LSView.mainView);
        LSView.mainView.endProcess();

        //II.2. LSVIEW: leave only residiul layer
        var wavelets = new ATrousWaveletTransform;
        with ( wavelets )
        {
            layers = [ // enabled, biasEnabled, bias, noiseReductionEnabled, noiseReductionThreshold, noiseReductionAmount, noiseReductionIterations
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [true, true, 0.000, false, 3.000, 0.50, 1]
            ];
            scaleDelta = 0;
            scalingFunctionData = [
              0.2928932,0.5,0.2928932,
              0.5,1,0.5,
              0.2928932,0.5,0.2928932
            ];
            scalingFunctionKernelSize = 3;
            scalingFunctionNoiseSigma = [
              0.8095,0.2688,0.1176,
              0.0568,0.0283,0.0141,
              0.0071,0.0036,0.0018,
              0.0009
            ];
            scalingFunctionNoiseLayers = 10;
            scalingFunctionName = "3x3 Linear Interpolation";
            largeScaleFunction = NoFunction;
            curveBreakPoint = 0.75;
            noiseThresholding = false;
            noiseThresholdingAmount = 1.00;
            noiseThreshold = 3.00;
            softThresholding = true;
            useMultiresolutionSupport = false;
            deringing = false;
            deringingDark = 0.1000;
            deringingBright = 0.0000;
            outputDeringingMaps = false;
            lowRange = 0.0000;
            highRange = 0.0000;
            previewMode = Disabled;
            previewLayer = 0;
            toLuminance = true;
            toChrominance = true;
            linear = false;
        }

        LSView.mainView.beginProcess(UndoFlag_NoSwapFile);
        wavelets.executeOn(LSView.mainView);
        LSView.mainView.endProcess();


        //III. PREPARE MaskView

        //III.1 MaskView: convert to Greyscale
        if(MaskView.mainView.image.colorSpace != ColorSpace_Gray) {
            var toGray = new ConvertToGrayscale;
            MaskView.mainView.beginProcess(UndoFlag_NoSwapFile);
            toGray.executeOn(MaskView.mainView);
            MaskView.mainView.endProcess();
        }

        //III.2 MaskView: clip background and boost middles a bit
        /*
        Point 1:    0.25000, 0.00000 (устанавливает стартовую точку в ноль сразу за "горбом" бэкграунда, по сути обрезая полностью фон до уровня 0.25)
        Point 2: зависит от maskamount (стандарт 0.6)
    maskamount	0,00	0,10	0,20	0,30	0,40	0,50	0,60	0,70	0,80	0,90	1,00
            x	1,25	1,15	1,05	0,95	0,85	0,75	0,65	0,55	0,45	0,35	0,25
            y	0,00	0,10	0,20	0,30	0,40	0,50	0,60	0,70	0,80	0,90	1,00
        */        
        var curves = new CurvesTransformation;
        with ( curves )
        {
            R = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Rt = AkimaSubsplines;
            G = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Gt = AkimaSubsplines;
            B = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Bt = AkimaSubsplines;
            K = [ // x, y
              [0.00000, 0.00000],
              [0.25000, 0.00000],
              [(1-data.maskamount)+0.25, data.maskamount],
              [1.00000, 1.00000]
            ];
            Kt = AkimaSubsplines;
            L = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Lt = AkimaSubsplines;
            a = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            at = AkimaSubsplines;
            b = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            bt = AkimaSubsplines;
            c = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            ct = AkimaSubsplines;
            H = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            Ht = AkimaSubsplines;
            S = [ // x, y
              [0.00000, 0.00000],
              [1.00000, 1.00000]
            ];
            St = AkimaSubsplines;
        }


        MaskView.mainView.beginProcess(UndoFlag_NoSwapFile);
        curves.executeOn(MaskView.mainView);
        MaskView.mainView.endProcess();

        //III.3 MaskView: get residiual
        var wavelets = new ATrousWaveletTransform;
        with ( wavelets )
        {
            layers = [ // enabled, biasEnabled, bias, noiseReductionEnabled, noiseReductionThreshold, noiseReductionAmount, noiseReductionIterations
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [false, true, 0.000, false, 3.000, 0.50, 1],
              [true, true, 0.000, false, 3.000, 0.50, 1]
            ];
            scaleDelta = 0;
            scalingFunctionData = [
              0.2928932,0.5,0.2928932,
              0.5,1,0.5,
              0.2928932,0.5,0.2928932
            ];
            scalingFunctionKernelSize = 3;
            scalingFunctionNoiseSigma = [
              0.8095,0.2688,0.1176,
              0.0568,0.0283,0.0141,
              0.0071,0.0036,0.0018,
              0.0009
            ];
            scalingFunctionNoiseLayers = 10;
            scalingFunctionName = "3x3 Linear Interpolation";
            largeScaleFunction = NoFunction;
            curveBreakPoint = 0.75;
            noiseThresholding = false;
            noiseThresholdingAmount = 1.00;
            noiseThreshold = 3.00;
            softThresholding = true;
            useMultiresolutionSupport = false;
            deringing = false;
            deringingDark = 0.1000;
            deringingBright = 0.0000;
            outputDeringingMaps = false;
            lowRange = 0.0000;
            highRange = 0.0000;
            previewMode = Disabled;
            previewLayer = 0;
            toLuminance = true;
            toChrominance = true;
            linear = false;
        }

        MaskView.mainView.beginProcess(UndoFlag_NoSwapFile);
        wavelets.executeOn(MaskView.mainView);
        MaskView.mainView.endProcess();


        //IV. Calculations

        //IV.1 Apply MASK to Preview
        Preview.maskVisible = false;
        Preview.maskInverted = true;
        Preview.mask = MaskView;

        //IV.2 Add LSView to Preview with MASK on
        var pm = new PixelMath;
        with ( pm )
        {
            expression = "Preview+LSView*"+data.amount;
            expression1 = "";
            expression2 = "";
            expression3 = "";
            useSingleExpression = true;
            symbols = "";
            use64BitWorkingImage = false;
            rescale = false;
            rescaleLower = 0.0000000000;
            rescaleUpper = 1.0000000000;
            truncate = true;
            truncateLower = 0.0000000000;
            truncateUpper = 1.0000000000;
            createNewImage = false;
            newImageId = "";
            newImageWidth = 0;
            newImageHeight = 0;
            newImageAlpha = false;
            newImageColorSpace = SameAsTarget;
            newImageSampleFormat = SameAsTarget;
        }

        Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
        pm.executeOn(Preview.mainView);
        Preview.mainView.endProcess();

        // Assign Preview to FinalView
        FinalView.mainView.beginProcess(UndoFlag_NoSwapFile);
        FinalView.mainView.image.assign(Preview.mainView.image);
        FinalView.mainView.endProcess();

        this.ScrollControl.repaint();

        this.cursor = new Cursor( StdCursor_Arrow  );
        this.ScrollControl.cursor= new Cursor( StdCursor_CirclePlus );
        console.hide();
    }




     //---------------------------------------------------------------------------------------
    this.showLargeScale = function()
    {
       Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
       Preview.mainView.image.assign(LSView.mainView.image);
       Preview.mainView.endProcess();
       this.ScrollControl.repaint();
    };


    this.showSmallScale = function()
    {
       Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
       Preview.mainView.image.assign(SSView.mainView.image);
       Preview.mainView.endProcess();
       this.ScrollControl.repaint();
    };

    this.showPreview = function()
    {
       Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
       Preview.mainView.image.assign(FinalView.mainView.image);
       Preview.mainView.endProcess();
       this.ScrollControl.repaint();
    };

    this.showOriginal = function()
    {
       Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
       Preview.mainView.image.assign(SourceView.image);
       Preview.mainView.endProcess();
       this.ScrollControl.repaint();
    };

    this.showLSMask = function()
    {
       Preview.mainView.beginProcess(UndoFlag_NoSwapFile);
       Preview.mainView.image.assign(MaskView.mainView.image);
       Preview.mainView.endProcess();
       this.ScrollControl.repaint();
    };


     //---------------------------------------------------------------------------------------
    this.generate = function()
    {
          // If we are already generating data, request job abortion and return.
          if ( this.busy ) return;
          this.busy = true;
          this.abort = false;
          this.LargeScalesEnhance();
          this.busy = false;
    };

    //---------------------------------------------------------------------------------------
    this.onMouseWheel = function(Dx,Dy, MouseWheel)
    {
      if (MouseWheel >0) Preview.zoomOut()
      else Preview.zoomIn()
      this.ScrollControl.repaint();
    }



    this.ScrollControl = new Control( this );
    with ( this.ScrollControl )
    {

        var w = Preview.mainView.image.width;
        var h = Preview.mainView.image.height;
        var Size=Preview.viewportWidth*SizeMutiplier;
        setMinSize( Size, Size*h/w );
        var k=1/w*Size;
        cursor = new Cursor( StdCursor_CirclePlus );



        onPaint = function()
        {
            // extract viewing parts of image dest_(x0 x1 y0 y1)
            var Zoom=Preview.viewportWidth/w;
            var Dx0=Preview.viewportPosition.x/Zoom;
            var Dy0=Preview.viewportPosition.y/Zoom;
            var Dx1=Preview.visibleViewportRect.x1/Zoom;
            var Dy1=Preview.visibleViewportRect.y1/Zoom;
            if (Dx1 > w) Dx1=w;
            if (Dy1 > h) Dy1=h;

            var x0=Dx0*k;
            var y0=Dy0*k;
            var x1=x0+Dx1*k;
            var y1=y0+Dy1*k;



            var G = new Graphics( this );
            G.drawScaledBitmap( this.boundsRect, Preview.mainView.image.render() );
            G.pen = new Pen( 0xFF00FF00 ); //Green
            G.drawRect(x0,y0,x1,y1);
            G.end()
            //gc();
        }

        onMousePress = function(x,y)
        {
            Preview.setViewport( x*w/Size, y*w/Size );
            repaint();
        }

        onMouseMove = function(x,y)
        {
            Preview.setViewport( x*w/Size, y*w/Size );
            repaint();
        }
    }



  //---------------------------------------------------------------------------------------
   // buttons




   this.ZoomToFit_Button = new PushButton( this );
   with ( this.ZoomToFit_Button )
   {
      text = "Zoom To Fit";
      onClick = function()
      {
         Preview.zoomToFit();
         parent.parent.ScrollControl.repaint();

      }
   }


   this.fitWindow_Button = new PushButton( this );
   with ( this.fitWindow_Button )
   {
      text = "Fit View";
      onClick = function()
      {
         Preview.fitWindow();
         parent.parent.ScrollControl.repaint();
      }
   }


   this.zoomToOptimalFit_Button = new PushButton( this );
   with ( this.zoomToOptimalFit_Button )
   {
      text = "ZoomToOptimalFit";
      onClick = function()
      {
         Preview.zoomToOptimalFit();
         parent.parent.ScrollControl.repaint();
      }
   }


   this.preview_Button = new PushButton( this );
   with ( this.preview_Button )
   {
      text = "Calculate preview";
      toolTip = "Начинайте с этого";
      onClick = function()
      {
         parent.parent.generate();
         //parent.ScrollControl.repaint();
      }
   }


   this.showls_Button = new PushButton( this );
   with ( this.showls_Button )
   {
      text = "Large Scales";
      onClick = function()
      {
         parent.parent.showLargeScale();
      }
   }

   this.showss_Button = new PushButton( this );
   with ( this.showss_Button )
   {
      text = "Small Scales";
      onClick = function()
      {
         parent.parent.showSmallScale();
      }
   }


   this.showlsmask_Button = new PushButton( this );
   with ( this.showlsmask_Button )
   {
      text = "Mask";
      onClick = function()
      {
         parent.parent.showLSMask();
      }
   }


   this.showpreview_Button = new PushButton( this );
   with ( this.showpreview_Button )
   {
      text = "Enhanced";
      onClick = function()
      {
         parent.parent.showPreview();
      }
   }

   this.showoriginal_Button = new PushButton( this );
   with ( this.showoriginal_Button )
   {
      text = "Original";
      onClick = function()
      {
         parent.parent.showOriginal();
      }
   }





 // Enhancement parameters
   this.numberOfLayers_Label = new Label( this );
   this.numberOfLayers_Label.scaledMinWidth = 100;
   this.numberOfLayers_Label.text = "Small Scales Layers :";
   this.numberOfLayers_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.numberOfLayers_SpinBox = new SpinBox( this );
   this.numberOfLayers_SpinBox.minValue = 4;
   this.numberOfLayers_SpinBox.maxValue = 8;
   this.numberOfLayers_SpinBox.value = data.numberOfLayers;
   this.numberOfLayers_SpinBox.toolTip = this.numberOfLayers_Label.toolTip =
      "<b>Number of wavelet layers that will be removed to build large scales image.<br>Именно эти слои берутся для построения SSView, который затем умножается с инверсией на исходное изображение</b>";
   this.numberOfLayers_SpinBox.onValueUpdated = function( value )
   {
      data.numberOfLayers = value;
   };


   this.numberOfLayers_Sizer = new HorizontalSizer;
   this.numberOfLayers_Sizer.spacing = 4;
   this.numberOfLayers_Sizer.add( this.numberOfLayers_Label );
   this.numberOfLayers_Sizer.add( this.numberOfLayers_SpinBox );
   this.numberOfLayers_Sizer.addStretch();





   this.SSAmount = new NumericControl (this);
   with ( this.SSAmount ) {
      label.text = "Small Scales Amount:";
      label.scaledMinWidth = 100;
      setRange (0.0, 0.99);
      slider.setRange (0, 1000);
      slider.scaledMinWidth = 250;
      setPrecision (2);
      setValue (data.SSamount);
      toolTip = "<p>Small Scales intensity.<br>На основании этого параметра рассчитывается наклон Curve для SSView, которой обрезаются highlights до определяемого им уровня: на 0.9 обрезается до ~0.1; на 0.5 вообще без обрезки; если меньше 0.5 - то не обрзеается, а просто уменьшается контраст (прогиб кривой)</p>";
      onValueUpdated = function (value) { data.SSamount = value; };
   }




   this.Amount = new NumericControl (this);
   with ( this.Amount ) {
      label.text = "Amount:";
      label.scaledMinWidth = 100;
      setRange (0.0, 0.99);
      slider.setRange (0, 1000);
      slider.scaledMinWidth = 250;
      setPrecision (2);
      setValue (data.amount);
      toolTip = "<p>Background intensity.<br>Коэффициент при построении финального изображения: LSView*Amount по маске добавляется к исходному изображению</p>";
      onValueUpdated = function (value) { data.amount = value; };
   }



   this.MaskAmount = new NumericControl (this);
   with ( this.MaskAmount ) {
      label.text = "Mask Amount:";
      label.scaledMinWidth = 100;
      setRange (0.25, 0.99);
      slider.setRange (0, 1000);
      slider.scaledMinWidth = 250;
      setPrecision (2);
      setValue (data.maskamount);
      toolTip = "<p>Mask intensity.<br>Используется для повышения контраста маски после обрезания фона (обрезается всегда на 0.25). Формируется Сurve от (0.25,0) через (1.25-MaskAmount,MaskAmount). Эта точка для 0.6 будет(0.65,0.6); для 0.5 - (0.75,0.5); для 0.25 - (1;0,25); для 0.8 - (0.45,0.8)</p>";
      onValueUpdated = function (value) { data.maskamount = value; };
   }





    //

    // 1. Info Label

    //
    this.helpLabel = new Label(this);
    with (this.helpLabel) {
        frameStyle = FrameStyle_Box;
        margin = 4;
        wordWrapping = true;
        useRichText = true;
        text = "<p><b>BackgroundEnhance</b> " + " v" + VERSION + ". " +
            COPYRIGHT_STRING + 
            "</p><p>" +
            INFO_STRING +
            "</p><p>" +
            HELP_STRING +
            "</p>"
            setScaledMinWidth(600); //min width
    }



   this.BEParGroupBox = new GroupBox( this );
   with ( this.BEParGroupBox )
   {

      title = "Enhancement Parameters";
      sizer = new VerticalSizer;
      sizer.margin = 6;
      sizer.spacing = 4;
      sizer.add(this.numberOfLayers_Sizer);
      sizer.add(this.SSAmount);
      sizer.add(this.Amount);
      sizer.add(this.MaskAmount);
      sizer.add( this.preview_Button );

   }


   //---------------------------------------------------------------------------------------
   // arange control element

   this.zoombuttonssizer = new HorizontalSizer;
   with ( this.zoombuttonssizer )
   {
      margin = 0;
      spacing = 6;
      add( this.ZoomToFit_Button );
      add( this.fitWindow_Button );
      add( this.zoomToOptimalFit_Button );
   }



   this.PWGroupBox = new GroupBox( this );
   with ( this.PWGroupBox )
   {

      title = "Window Preview Control";
      sizer = new VerticalSizer;
      sizer.margin = 6;
      sizer.spacing = 4;
      sizer.add( this.ScrollControl );
      sizer.add( this.zoombuttonssizer );

  }




   this.SBGroupBox = new GroupBox( this );
   with ( this.SBGroupBox )
   {

      title = "Show images";
      sizer = new HorizontalSizer;
      sizer.margin = 6;
      sizer.spacing = 4;
      sizer.add( this.showls_Button );
      sizer.add( this.showss_Button );
      sizer.add( this.showlsmask_Button );
      sizer.add( this.showpreview_Button );
      sizer.add( this.showoriginal_Button );

   }




   this.extractLS_CheckBox = new CheckBox( this );
   this.extractLS_CheckBox.text = "Large Scales";
   this.extractLS_CheckBox.checked = data.viewLS;
   this.extractLS_CheckBox.toolTip =
      "<p>If this option is selected, the script will create an image window "
      + "with the Large Scales used to perform background enhancement.</p>";
   this.extractLS_CheckBox.onCheck = function( checked )
   {
      data.viewLS = checked;
   };

   this.extractSS_CheckBox = new CheckBox( this );
   this.extractSS_CheckBox.text = "Small Scales";
   this.extractSS_CheckBox.checked = data.viewSS;
   this.extractSS_CheckBox.toolTip =
      "<p>If this option is selected, the script will create an image window "
      + "with the Small Scales used to perform background enhancement.</p>";
   this.extractSS_CheckBox.onCheck = function( checked )
   {
      data.viewSS = checked;
   };

   this.extractMS_CheckBox = new CheckBox( this );
   this.extractMS_CheckBox.text = "Mask";
   this.extractMS_CheckBox.checked = data.viewMS;
   this.extractMS_CheckBox.toolTip =
      "<p>If this option is selected, the script will create an image window "
      + "with the Mask used to perform background enhancement.</p>";
   this.extractMS_CheckBox.onCheck = function( checked )
   {
      data.viewMS = checked;
   };





   this.EIGroupBox = new GroupBox( this );
   with ( this.EIGroupBox )
   {

      title = "Extract Images";
      sizer = new HorizontalSizer;
      sizer.margin = 6;
      sizer.spacing = 4;
      sizer.add(this.extractLS_CheckBox);
      sizer.add(this.extractSS_CheckBox);
      sizer.add(this.extractMS_CheckBox);

   }






    // buttons
    this.ok_Button = new PushButton (this);
    this.ok_Button.text = "OK";
    this.ok_Button.onClick = function() {
        if (data.viewLS){
            LSView.show();
        }else{
            LSView.forceClose();
        }

        if (data.viewSS){
            SSView.show();
        }else{
            SSView.forceClose();
        }

        if (data.viewMS){
            MaskView.show();
        }else{
            MaskView.forceClose();
        }
        FinalView.show();
        Preview.forceClose();
        this.dialog.done(0);
    };

    this.cancel_Button = new PushButton (this);
    this.cancel_Button.text = "Cancel";
    this.cancel_Button.onClick = function() {
        LSView.forceClose();
        SSView.forceClose();
        MaskView.forceClose();
        FinalView.forceClose();
        Preview.forceClose();
        this.dialog.cancel();
    };

    this.buttons_Sizer = new HorizontalSizer;
    this.buttons_Sizer.spacing = 4;
    this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add (this.ok_Button);
    this.buttons_Sizer.add (this.cancel_Button);
    this.buttons_Sizer.addSpacing (8);


   this.sizer = new VerticalSizer;
   with ( this.sizer )
   {
      margin = 6;
      spacing = 6;
      add(this.helpLabel);
      addSpacing(4);
      add( this.PWGroupBox );
      add( this.PWGroupBox );
      add( this.BEParGroupBox );

      add( this.EIGroupBox );
      add( this.SBGroupBox );
      add( this.buttons_Sizer )


   }

   this.windowTitle = "Background Enhance";
   this.adjustToContents();
   this.setFixedSize();
}

MyDialog.prototype = new Dialog;
function main()
{
   console.hide();
   var dialog = new MyDialog;
   if (!dialog.execute()) dialog.cancel();
}

main();
