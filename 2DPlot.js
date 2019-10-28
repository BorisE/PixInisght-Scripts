/*

2DPlot.js: Pixel Intensity Plot.
================================================================================


Grafische Darstellung des Intensitätsverlaufs in einem PixInsight-Image.
Zu den Standardeinstellungen vertikal, horizontal und diagonal, kann der
Verlauf beliebig eingestellt werden. Über die Taste ‘Image View’ wird der
Verlauf mit Hilfe eines Lineals im Bild angezeigt. Ein runder Kreis markiert
den gewählten Ausgangspunkt. Mit Ctrl-C bzw. Strg-C kann die Grafik als
File gespeichert werden.


2DPlot draws the intensity of pixel values along a straight line.
This imaginary line is made of x and y values which run normally in vertical
or horizontal directions through a pixelmatrix of a selected image.
Other standard line directions go diagonal up or down and can be chosen
by checking the radio buttons in the left navigation window. The button
at the top flips between the curve graphics and a preview of the selected image.
In the preview window, one can use a ruler styled 'cutting tool' for a more
specific analysis. This ruler can start per mouse click at any location of
the image and rotate by turning the wheel. A red line shown in the middle of
the ruler marks the line of intersection. Variations in data scaling help to
compare channels in a color image or even different images. The 'Variable Range'
checkbox should be deselected for this case. Press the left mouse button down
at any place in the graphics to show pixel coordinates and intensity.
Other options shown are self-explanatory. For documentation purposes or
further analysis of selected data, right click the mouse button. This will
pop up a menu with two options Save Graphics and Save Intensities.
Save Graphics saves the current graphics as shown while Save Intensities
writes a CSV-file containing the index, x- and y-coordinates and the intensity.
Alternatively save the graphics by pressing Ctrl-C.
================================================================================


 ****************************************************************************
 * 2DPlot
 *
 * Plot pixel values between two endpoints
 *
 * Input:    all views
 *
 * Copyright (C) 2013, Hartmut V. Bornemann
 *
 * Version history
 *         3.58   2014-04-06 NEW: a context menu has been added to the
 *                           graphics panel. This menu offers 2 items
 *                           "Save Graphics" and "Save Intensities"
 *                           bug: pressing return after numeric input flipped
 *                           graphics/image
 *         3.57   2014-04-06 help window
 *         3.56   2014-04-06 lousy bug
 *         3.55   2014-03-23 explicit range settings
 *         3.54   2014-03-21 corrected scale after frame resize
 *         3.53   2014-02-17 image drawing changes with different sizes
 *         3.52   2014-02-17 bug in scale drawing
 *         3.51   2014-02-14 bug in log. drawing values <= 0
 *         3.50   2014-02-10 re-designed
 *         3.30   2013-07-23 bug in pixel function scan()
 *         3.29   2013-07-21 view with estimated background
 *         3.28   2013-07-21 image statistics per channel
 *         3.27   2013-07-18 image rectangle imageR resized to full size
 *                           imageR  = new Rect(0, 0, image.width, image.height);
 *         3.26   2013-07-17 corrections in graphics scaling
 *                           added information cursor: this cursor displays
 *                           x, y and intensity values
 *                           under the left button-down mouse
 *         3.25   2013-07-16 detect mouse wheel over graphics
 *         3.24   2013-07-15 update numeric boxes with mouse wheel
 *         3.23   2013-07-02 show green line in all directions
 *         3.22   2013-06-30 continue with same color channel for new view.
 *                           coding optimizations
 *         3.21   2013-06-29 keep scan coordinates for same size images
 *         3.20   2013-06-29
 *         3.10   2013-06-28
 ****************************************************************************
 */
#feature-id    Render > 2DPlot++

#include <pjsr/Color.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/NumericControl.jsh>

#define TITLE "2DPlot"
#define VERSION "3.58"
#define StdCursor_Arrow 1
#define StdCursor_Cross 13
#define StdCursor_Crossmark 8
#define StdCursor_ArrowQuestion 17
#define StdCursor_Wait 16
#define FontFamily_TypeWriter 4
#define FontFamily_Courier FontFamily_TypeWriter

// Shadows clipping point measured in sigma units from the main histogram peak.
#define SHADOWS_CLIP -1.25

// Target background in the [0,1] range.
#define TARGET_BKG    0.25

#define MouseButton_Left 0x01
#define MouseButton_Right 0x02

#feature-info Plot the pixel values between two endpoints.<br>\
   <br>\Written by Hartmut V. Bornemann.<br>\
   <br>\
   References: None<br>\
   <br>\

/* */


function helpdlg()
{
   this.__base__ = Dialog;
   this.__base__();

   this.minHeight = 600;
   this.minWidth  = 600;

   this.OK_Button = new PushButton (this);
   with (this.OK_Button)
   {
      text = "OK";
      maxWidth = 150;

      onClick = function()
      {
         this.parent.ok();
      }
   }

   this.helpText = new TextBox( this );
   with ( this.helpText )
   {
      frameStyle = FrameStyle_Box;
      margin = 4;
      readOnly = true;
      wordWrapping = true;
      useRichText = true;
	  minWidth= 300;
	  minHeight = 200;

      text = "<b>" + TITLE + " V" + VERSION + " Pixel Intensity Plot.</b>" +
      "<p><b>" + TITLE + "</b> draws the intensity of pixel values along a straight line." +
      " This imaginary line is made of x and y values which run normally in vertical or" +
      " horizontal directions through a pixelmatrix of a selected image." +
      " Other standard line directions go diagonal up or down and can be chosen by checking" +
      " the radio buttons in the left navigation window. </p>" +
      "<p>The button at the top flips between the curve graphics and a preview of the selected image." +
      " In the preview window, one can use a ruler styled 'cutting tool' for a more specific" +
      " analysis." +
      " This ruler can start per mouse click at any location of the image and rotate by turning the wheel." +
      " A red line shown in the middle of the ruler marks the line of intersection." +
      " <p>Variations in data scaling help to compare channels in a color image or even" +
      " different images. The 'Variable Range' checkbox should be deselected for this case." +
      "</p>" +
      "<p>Press the left mouse button down at any place in the graphics to show pixel coordinates and " +
      "intensity.</p>" +
      "<p>Other options shown are self-explanatory.</p>" +
      "<p>For documentation purposes or further analysis of selected data, right click the mouse button. " +
      "This will pop up a menu with two options <b>Save Graphics</b> and <b>Save Intensities</b>. " +
      "Save Graphics saves the current graphics as shown while Save Intensities writes a CSV-file " +
      "containing the index, x- and y-coordinates and the intensity.</p>" +
      "<p>Alternatively save the graphics by pressing Ctrl-C.</p>" +
      "<p>Copyright Ã‚Â© Hartmut Bornemann, 2014," +
      " mailto:hvb356@yahoo.com</p>";
   }

   this.buttonSizer = new HorizontalSizer;
   with ( this.buttonSizer )
   {
      spacing = 4;
      add (this.OK_Button);
   }

   this.sizer = new VerticalSizer;
   with ( this.sizer )
   {
      margin = 6;
      spacing = 6;
      add( this.helpText );
      add( this.buttonSizer );
   }

   this.helpText.home();
}
helpdlg.prototype = new Dialog;

function plotdlg()
{
   this.__base__ = Dialog;
   this.__base__();


/* ********************************************************************
 * declaration of the pixel object
 * ********************************************************************
*/

   function pixelObject(Intensity, X, Y)
   {
      this.Intensity = Intensity;
      this.x = X;
      this.y = Y;
   }

/* ********************************************************************
 * mode enumeration
 * ********************************************************************
*/
   var  viewing =    // controls the viewing mode
   {
      LineGraph : 0,
      ImageView : 1
   };

/* ********************************************************************
 * declaration of constants
 * ********************************************************************
*/

   var dialog_instance = this;
   var black  = new Pen( 0xFF000000, 1);   // black
   var bgpen  = new Pen( 0xB00A0AE0, 3);   // thick pen
   var red    = new Pen( 0xFFFF0000 );     // red
   var green  = new Pen( 0xFF008400 );     // dark green
   var blue   = new Pen( 0xFF0000FF );     // blue
   var gray   = new Pen( 0xFF808080 );     // gray
   var lgray  = new Pen( 0xFFC0C0C0 );     // light gray
   var lime   = new Pen( 0xFF32CD32 );     // limegreen
   var violet = new Pen( 0xFFEE82EE );     // violet
   var white  = new Pen( 0xFFFFFFFF );     // white
   var ngpen  = new Pen( 0xFF000000, 2);   // black main gridlines
   var igpen  = new Pen( 0xFF000000, 1);   // black inside gridlines
   var colorP = [red, green, blue];        // R, G and B pens collected
   var devB   = new Brush( 0x8FF080A0 );   // average  dev. rect brush
   var devS   = new Brush( 0x8F80F080 );   // standard dev. rect brush
   var whiteB = new Brush( 0xFFFFFFFF );   // white brush
   var blackB = new Brush( 0xFF000000 );   // black brush
   var grayB  = new Brush( 0xFFE0E0E0 );   // gray brush
   var toolB  = new Brush( 0x80F0F0F0 );   // transparent tool brush
   var toolM  = new Brush( 0x80FF0000 );   // transparent tool center brush

/* ********************************************************************
 * declaration of globals
 * ********************************************************************
*/

   var fracDecimals = 5;
   var decimals;
   var minDialogWidth = 1000;
   var minDialogHeight = 800;
   
   var vertStep=44;
   var horizMargin = 11;
   
   var image;
   var imageR;
   var pixdat;
   var imgbuf;
   var mean       = 0;
   var median     = 0;
   var stdDev     = 0;
   var avgDev     = 0;
   var imgbgm     = 0;        // image background mean
   var gradient   = 0;
   var maxval;
   var minval;
   var normrange;             // array {minintensity 0..1, maxintensity 0..1}
   var normalized = false;    // true, if data was nomalized
   var channel = 0;           // the channel index == 0 for monochrome
                              // and 0, 1, 2 for RGB
   var viewmode  = viewing.LineGraph;

   var M;                     // pixel vector contains pixelObject(Intensity, X, Y)
   var gridValues;            // array of values from minval to maxval
   var map = null;            // color bitmap
   var map_scale;             // view size / image size
   var map_border;            // rectangle around map
   var min_line_dist = 28;    // minimum distance of lines in a grid
   var x0;
   var x1;
   var y0;
   var y1;
   var angle  = 0.0;          // angle of the cutting tool
   var pScale = 1.0;          //
   var linear = true;
   var lastR = new Rect(0, 0, 1, 1); // dimension of last image shown
   var infoBox;
   var infoFont = new Font(FontFamily_Courier, 5);
   var infoLabelrect = infoFont.boundingRect("i:XXXXXXXX");
   var menuBox;
   var mouseX = 0;
   var mouseY = 0;
   var rotCenter;
   var ctlY =  8;             // the navigation controls begin here
   var CExt = "PNG files,.png"; // ext. used w. saving graphics to clipboard

   normrange    = new Array();
   normrange[0] = 0;
   normrange[1] = 1;

/* ********************************************************************
 * dialog sizing and key listener
 * ********************************************************************
*/
   with (this)
   {
      minWidth = minDialogWidth;
      minHeight = minDialogHeight;

      onResize = function(wNew, hNew, wOld, hOld )
      {
         map = null;
         navi.height   = clientRect.height;
         canvas.resize(clientRect.width - navi.width, clientRect.height);
         plotframe.resize(canvas.width - scalew.width - 8, canvas.height-16);
         scalew.height = canvas.height;
         navi.repaint();
      }

      onKeyPress = function(k, m)
      {
         // Ctrl+C <= k == 67 & m == 2
         if (k == 67 & m == 2)
         {
            SaveGraphics(canvas, CExt);
         }
      }
   }

/* ********************************************************************
 * dialog layout
 *
 * the main window is splitted into two parts:
    *
    *  the small 'navigation' panel at the left and
    *  a larger 'canvas' to the right
    *
    *  navigation contains all control elements
    *
    *  canvas arranges frames depending on the current viewmode
    *
    *  viewmode = LineGraph displays
    *                'scalew' to display numerics
    *  and           'plotframe' which produces the data graph
    *
    *  a plotframe mousedown event pops up a small infoBox
    *  the infoBox displays intensity and pixel coordinates
    *
    *  viewmode = ImageView displays a picturebox to render the
    *  selected image and provides a tool, which displays the
    *  pixel selection line
    *  this tool is re-positioned by mouseclick and mouse wheel
    *  rotation
 * ********************************************************************
*/

   var navi = new Frame(this);
   with (navi)
   {
      backgroundColor = 0xFFF0F0F0 ;
      width = 550;
      position = new Point(0, 0);
      navi.style = FrameStyle_Raised;
   }

   // this canvas for graphs and image display

   var canvas = new Frame(this);
   with (canvas)
   {
      backgroundColor = 0xFFFFFFFF;
      position = new Point(navi.width, 0);

      onResize = function()
      {
         if (viewmode  == viewing.ImageView)
         {
            SetupPictureBox();
            picturebox.repaint();
         }
      }
   }

   var scalew = new Frame(canvas); // the panel left of the drawing
   with (scalew)
   {
      position = new Point(0, 0);
      width    = 80;
      visible = true;
      // Paint
      onPaint = function()
      {
         var h = plotframe.height;
         var linscale = h / (maxval - minval);
         var logscale = h / (Math.log(maxval) - Math.log(minval));
         var g        = new Graphics();
         g.begin(scalew);
         g.clipRect = new Rect (0, 0, width, height);
         g.pen = black;
         DrawScale(g);
         g.end();
      }
   }

   var plotframe = new Frame(canvas);
   with (plotframe)
   {
      position = new Point(scalew.width, 8);
      visible = true;

      onMouseMove = function( x, y, state, modifiers )
      {
         if (infoBox.visible)
         {
            mouseX = x;
            mouseY = y;
            infoBox.repaint();
         }
         else if (state == MouseButton_Left)
         {
            mouseX = x;
            mouseY = y;
            infoBox.show();
         }
      }

      onMousePress = function(x, y, state, modifiers)
      {
         if (state == MouseButton_Left)
         {
            cursor = new Cursor(StdCursor_Cross);
            mouseX = x;
            mouseY = y;
            infoBox.show();
         }
         else if (state == MouseButton_Right)
         {
            menuBox.position = new Point(x - 2, y - 2);
            menuBox.show();
         }
      }

      onMouseRelease = function( x, y, button, buttonState, modifiers )
      {
         infoBox.hide();
         cursor = new Cursor(StdCursor_Arrow);
      }

      onMouseWheel = function( x, y, delta, buttonState, modifiers )
      {
         if (rbH.checked)
         {
            with (YNum)
            {
               setValue( Math.range(value + 1 * Math.sign(delta),0, upperBound));
               x0 = 0;
               x1 = image.width - 1;
               y0 = value;
               y1 = y0;
               getData(x0, y0, x1, y1, normalized);
               plotframe.repaint();
            }
         }
         else if (rbV.checked)
         {
            with (XNum)
            {
               setValue( Math.range(value + 1 * Math.sign(delta),0, upperBound));
               x0 = value;
               x1 = x0;
               y0 = 0;
               y1 = image.height - 1;
               getData(x0, y0, x1, y1, normalized);
               plotframe.repaint();
            }
         }
      }

      onPaint = function()
      {
         var g      = new Graphics();
         g.begin(plotframe);
         g.clipRect = new Rect (0, 0, width, height);
         g.pen      = black;
         DrawGraph(g);
         g.end();
      }

      onResize = function(wNew, hNew, wOld, hOld)
      {
         repaint();
      }
   }

   var picturebox = new Frame(canvas);
   with (picturebox)
   {
      visible = false;

      onPaint = function()
      {
         if (image == null) return;
         var g      = new Graphics();
         g.begin(picturebox);
         g.clipRect = new Rect(0, 0, width, height);
         DrawImage(g);
         g.end();
      }

      onMousePress = function(x, y, state, modifiers)
      {
         var frame = new Rect(0, 0, image.width, image.height);
         var xx = x / map_scale;
         var yy = y / map_scale;
         var line = lineInFrame(xx, yy, -angle, frame);
         x0 = line[0].x;
         y0 = line[0].y;
         x1 = line[1].x;
         y1 = line[1].y;
         rotCenter = new Point(xx, yy);
         getData(x0, y0, x1, y1, normalized);
         repaint();
      }

      onMouseWheel = function( x, y, delta, buttonState, modifiers )
      {
         angle -= Math.sign(delta);
         if (angle > 180)
         {
            angle = 180;
            return
         }
         else if (angle < 0)
         {
            angle = 0;
            return;
         }
         ncRot.setValue(angle);
         rotate();
      }

      onResize = function(wNew, hNew, wOld, hOld)
      {
         repaint();
      }

      onShow = function()
      {
         if (true) return;
         var maxFrame = new Rect(8, 8, canvas.width - 8, canvas.height - 8);
         var A = image.height / image.width;
         var w = Math.min(maxFrame.width, image.width);
         var h = Math.min(maxFrame.height, image.height);
         if ((h / w) > A)
            h = w * A;
         else
            w = h / A;
         var x = (canvas.width - w) / 2;
         var y = (canvas.height - h) / 2;
         if (position.x != x || position.y != y) position = new Point(x, y);
         if (width != w || height != h) resize(w, h);
      }
   }

   infoBox = new Frame(canvas);
   with (infoBox)
   {
      backgroundColor = 0xFF000000;
      font   = infoFont;
      height = infoLabelrect.height * 4 + 8;
      width  = infoLabelrect.width + 4;
      hide();

      // Paint
      onPaint = function()
      {
         if (M == null) return;
         // set position of this control
         cursor = new Cursor(StdCursor_Cross);
         var infoX;
         var infoY;

         if (mouseX < plotframe.width - infoBox.width)
         {
            infoX = mouseX + infoBox.width + 16;
         }
         else
         {
            infoX = mouseX - 16;
         }

         if (mouseY < plotframe.height - infoBox.height)
         {
            infoY = mouseY + 8;
         }
         else
         {
            infoY = mouseY - infoBox.height +8 ;
         }

         position = new Point(infoX, infoY);
         // calculate index to M with mouseX
         var mIndex = Math.floor((mouseX) / plotframe.width * (M.length-1));
         if (mIndex < 0 || mIndex > M.length - 1)
         {
            infoBox.hide();
            return;
         }
         else
         {
            // write info
            var e = M[mIndex];  // type pixelObject
            var g = new Graphics();
            g.begin(infoBox);
            g.pen = white;
            var l = infoLabelrect.height;
            g.drawText(2, l + 0, "x:" + format("%8d", e.x) );
            l += infoLabelrect.height;
            g.drawText(2, l + 2, "y:" + format("%8d", e.y));
            l += infoLabelrect.height;
            if (pScale == 1)
            {
               g.drawText(2, l + 2, "I:" + e.Intensity.toFixed(6));
               if (cbBgView.checked)
               {
                  l += infoLabelrect.height;
                  g.drawText(2, l + 2, "G:" + gradient.toFixed(6));
               }
            }
            else
            {
               g.drawText(2, l + 2, "I:" + format("%8d", e.Intensity * pScale));
               if (cbBgView.checked)
               {
                  l += infoLabelrect.height;
                  g.drawText(2, l + 2, "G:" +  format("%8d", gradient * pScale));
               }
            }
            g.pen = lgray;
            g.drawRect(0, 0, width, height);
            g.end();
         }
      }
   }


   menuBox = new Frame(canvas);
   with (menuBox)
   {
      backgroundColor = grayB.color;
      width  = 170;
      height = 50;
      hide();
      onLeave = function()
      {
         hide();
      }
      onMousePress = function(x, y, button, buttonState, modifiers )
      {
         menuBox.hide();
         var menuIndex = Math.floor(y / 25);
         switch (menuIndex)
         {
            case 0:
                SaveGraphics(canvas, CExt);
            break;
            case 1:
                SaveData(M);
            break;
         }
      }
      // Paint
      onPaint = function()
      {
         var g = new Graphics();
         g.begin(menuBox);
         //g.fillRect(g.clipRect, grayB);
         g.drawText(2, 16, "Save Graphics");
         g.drawLine(0, 25, menuBox.width, 25);
         g.drawText(2, 42, "Save Intensities as *.csv");
         g.end();
      }
   }

   // controls inside the navigation frame

   // my ©

   var lblCopyright = new Label(navi)
   with (lblCopyright)
   {
      position  = new Point(12, 12);
      text      = "©";
      cursor    = new Cursor(StdCursor_ArrowQuestion);
      onMousePress = function(x, y, button, buttonState, modifiers )
      {
         /*var msg = new MessageBox(
            "Ã‚Â© Hartmut Volker Bornemann, 2013, 2014\r" +
            "hvb356@yahoo.com\r" +
            "(save graphics with Ctrl-C)",
            "2DPlot Script, V" + VERSION );
         msg.execute();
         */
        var dlg = new helpdlg();
        dlg.execute();
      }
   }

/* ---------------------------------------------
   Graphics / Map flip
   ---------------------------------------------
*/
   var btnFlip = new PushButton(navi)
   with (btnFlip)
   {
      ctlY += 2;
      position  = new Point((navi.width - width - horizMargin) , ctlY);
      visible   = true;
      enabled   = true;
      text      = "Image View";
      onClick = function()
      {
         if (viewmode  == viewing.LineGraph)
         {
            //
            // flip from line graphics to image
            //
            plotframe.visible = false;
            scalew.visible = false;
            btnFlip.text = "Line Graph";
            viewmode  = viewing.ImageView;
            SetupPictureBox();
            canvas.backgroundColor = 0xFF000000;
         }
         else
         {
            //
            // flip from image to line graphics
            //
            picturebox.visible = false;
            scalew.visible = true;
            canvas.cursor = new Cursor(StdCursor_Arrow);
            btnFlip.text = "Image View";
            viewmode  = viewing.LineGraph;
            plotframe.visible = true;
            plotframe.repaint();
            canvas.backgroundColor = 0xFFFFFFFF;
         }
      }
   }

   var vwList = new ViewList( this );
   with (vwList)
   {
      ctlY += vertStep;
      position = new Point(8,ctlY);
      width = navi.width - horizMargin*2;
      getAll();
      currentView = ImageWindow.activeWindow.currentView;

      onViewSelected = function( view )
      {
         // select another view
         if (view.isNull)
         {
            EnableControls(false);
            return;
         }
         EnableControls(true);
         getImage(view);
         map = null;
         ShowStats();
         if (viewmode  == viewing.ImageView)
            picturebox.repaint();
         else
            plotframe.repaint();
      }
   }

   ctlY += vertStep;

/* ---------------------------------------------
   Vertical scan line controls
   ---------------------------------------------
*/
   var rbV = new RadioButton(navi);
   with (rbV)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "Vertical";
      checked = true;
      onCheck = function(checked)
      {
         if (checked)
         {
            x0 = XNum.value;
            x1 = x0;
            y0 = 0;
            y1 = image.height - 1;
            getData(x0, y0, x1, y1, normalized);
            angle = 90;
            ncRot.setValue(angle);
            if (viewmode  == viewing.ImageView)
               SetToolCenter(centerPoint(x0, y0, x1, y1));
            else
               plotframe.repaint();
         }
      }
   }

   var XNum = new NumericEdit(navi);
   with (XNum)
   {
      ctlY += vertStep;
      position = new Point(horizMargin, ctlY);
      label.text = "  X :";
      label.width = 60;
      setPrecision( 0 );
      onValueUpdated = function( value )
      {
         x0 = value;
         x1 = x0;
         y0 = 0;
         y1 = image.height - 1;
         rbV.checked = true;
         getData(x0, y0, x1, y1, normalized);
         angle = 90;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(x0, rotCenter.y));
         else
            plotframe.repaint();
      }

      onMouseWheel = function( x, y, delta, buttonState, modifiers )
      {
         setValue( Math.range(value + 1 * Math.sign(delta),0, upperBound));
         x0 = value;
         x1 = x0;
         y0 = 0;
         y1 = image.height - 1;
         rbV.checked = true;
         getData(x0, y0, x1, y1, normalized);
         angle = 90;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(x0, rotCenter.y));
         else
            plotframe.repaint();      }
   }

   var btnVCenter = new PushButton(navi)
   with (btnVCenter)
   {
      position  = new Point((navi.width - width - horizMargin) , ctlY);
      visible   = true;
      enabled   = true;
      text      = "center";
      onClick = function()
      {
         angle  = 0.0;
         x0     = Math.floor(image.width/2);
         x1     = x0;
         y0     = 0;
         y1     = image.height - 1;
         rbV.checked = true;
         XNum.setValue(x0);
         sldX.value = x0;
         getData(x0, y0, x1, y1, normalized);
         angle = 90;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(x0, y1 / 2));
         else
            plotframe.repaint();      }
   }

   var sldX = new Slider(navi);
   with (sldX)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      value = XNum.value;
      width = navi.width - horizMargin*2;
      onValueUpdated = function(value)
      {
         // vertical cut at x
         x0 = value;
         x1 = x0;
         y0 = 0;
         y1 = image.height - 1;
         getData(x0, y0, x1, y1, normalized);
         XNum.setValue(value);
         rbV.checked = true;
         angle = 90;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(x0, rotCenter.y));
         else
            plotframe.repaint();      }
   }

/* ---------------------------------------------
   Horizontal scan line controls
   ---------------------------------------------
*/
   var rbH  = new RadioButton(navi);
   with (rbH)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "Horizontal";
      onCheck = function(checked)
      {
         if (checked)
         {
            x0 = 0;
            x1 = image.width - 1;
            y0 = YNum.value;
            y1 = y0;
            getData(x0, y0, x1, y1, normalized);
            angle = 0;
            ncRot.setValue(angle);
            if (viewmode  == viewing.ImageView)
               SetToolCenter(centerPoint(x0, y0, x1, y1));
            else
               plotframe.repaint();         }
      }
   }

   var YNum = new NumericEdit(navi);
   with (YNum)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      label.text = "  Y :";
      label.width = 60;
      setPrecision( 0 );
      onValueUpdated = function( value )
      {
         x0 = 0;
         x1 = image.width - 1;
         y0 = value;
         y1 = y0;
         rbH.checked = true;
         getData(x0, y0, x1, y1, normalized);
         angle = 0;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(rotCenter.x, y0));
         else
            plotframe.repaint();
      }

      onMouseWheel = function( x, y, delta, buttonState, modifiers )
      {
         setValue( Math.range(value + 1 * Math.sign(delta),0, upperBound));
         x0 = 0;
         x1 = image.width - 1;
         y0 = value;
         y1 = y0;
         rbH.checked = true;
         getData(x0, y0, x1, y1, normalized);
         angle = 0;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(rotCenter.x, y0));
         else
            plotframe.repaint();
      }
   }

   var btnHCenter = new PushButton(navi)
   with (btnHCenter)
   {
      position  = new Point((navi.width - width - horizMargin) , ctlY);
      visible   = true;
      enabled   = true;
      text      = "center";
      onClick = function()
      {
         angle  = 0.0;
         x0     = 0;
         x1     = image.width - 1;
         y0     = Math.floor(image.height/2);
         y1     = y0;
         rbH.checked = true;
         YNum.setValue(y0);
         sldY.value = y0;
         getData(x0, y0, x1, y1, normalized);
         angle = 0;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(rotCenter.x, y0));
         else
            plotframe.repaint();
      }
   }

   var sldY = new Slider(navi);
   with (sldY)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      minValue = 0;
      width = navi.width - horizMargin*2;
      onValueUpdated = function(value)
      {
         // horizontal cut at y
         x0 = 0;
         x1 = image.width - 1;
         y0 = value;
         y1 = y0;
         getData(x0, y0, x1, y1, normalized);
         YNum.setValue(value);
         rbH.checked = true;
         angle = 0;
         ncRot.setValue(angle);
         if (viewmode  == viewing.ImageView)
            SetToolCenter(new Point(rotCenter.x, y0));
         else
            plotframe.repaint();
      }
   }

/* ---------------------------------------------
   Set diagonal from left/top to right/bottom
   ---------------------------------------------
*/
   var rbDd = new RadioButton(navi);
   with (rbDd)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "Diagonal down";
      onCheck = function(checked)
      {
         if (checked)
         {
            x0 = 0;
            x1 = image.width - 1;
            y0 = 0;
            y1 = image.height - 1;
            getData(x0, y0, x1, y1, normalized);
            plotframe.repaint();
            angle = 180 - Math.atan2(image.height, image.width) * Math.DEG;
            ncRot.setValue(angle);
            if (viewmode  == viewing.ImageView)
               SetToolCenter(centerPoint(x0, y0, x1, y1));
            else
               plotframe.repaint();
         }
      }
   }

/* ---------------------------------------------
   Set diagonal from left/bottom to right/top
   ---------------------------------------------
*/
   var rbDu = new RadioButton(navi);
   with (rbDu)
   {
      ctlY += vertStep;
      position = new Point(horizMargin, ctlY);
      text = "Diagonal up";
      onCheck = function(checked)
      {
         if (checked)
         {
            x0 = 0;
            x1 = image.width - 1;
            y0 = image.height - 1;
            y1 = 0;
            getData(x0, y0, x1, y1, normalized);
            plotframe.repaint()
            angle = Math.atan2(image.height, image.width) * Math.DEG;
            ncRot.setValue(angle);
            if (viewmode  == viewing.ImageView)
               SetToolCenter(centerPoint(x0, y0, x1, y1));
            else
               plotframe.repaint();
         }
      }
   }

/* ---------------------------------------------
   Set free rotation
   ---------------------------------------------
*/
   var rbRot = new RadioButton(navi);
   with (rbRot)
   {
      ctlY += vertStep;
      position = new Point(horizMargin ,ctlY);
      text = "Rotate";
      onCheck = function(checked)
      {
         ncRot.enabled = checked;
      }
   }

   var ncRot = new NumericEdit(navi);
   with (ncRot)
   {
      enabled  = false;
      resize(80, height);
      position = new Point(navi.width - width - horizMargin*2,ctlY);
      setPrecision(0);
      setRange(0, 180);
      setValue(0);
      onKeyPress = function()
      {
         btnFlip.defaultButton = false;
      }
      onValueUpdated = function(number)
      {
         angle = number;
         if (enabled)
         {
            rotate();
         }
      }

      onMouseWheel = function( x, y, delta, buttonState, modifiers )
      {
         angle -= Math.sign(delta);
         if (angle > 180)
         {
            angle = 180;
            return
         }
         else if (angle < 0)
         {
            angle = 0;
            return;
         }
         setValue(angle);
         rotate();
      }
   }

/* ---------------------------------------------
   Linear / Logarithmic chooser
   ---------------------------------------------
*/
   var cbLog = new CheckBox(navi);
   with (cbLog)
   {
      ctlY += vertStep;
      position = new Point(horizMargin, ctlY);
      text = "Log scale";
      onCheck = function(checked)
      {
         linear = !checked;
         decimals = ((pScale == 1) ? -fracDecimals: Math.floor(Math.log10(pScale)) + 1);
         normRangeToDataRange();
         scalew.repaint();
         plotframe.repaint();
         cbVarRange.enabled = !checked;
      }
   }

   var cmbDecimals = new ComboBox(navi);
   with (cmbDecimals)
   {
      resize(90, height);
      position = new Point(ncRot.position.x - 2, ctlY);
      for (var i = 0; i < 6; i++) addItem((i+1).toString());
      currentItem = fracDecimals - 1;
      toolTip = "Set number of fractional digits 1 - 6";

      onItemSelected = function(index)
      {
         fracDecimals = index + 1;
         decimals = ((pScale == 1) ? -fracDecimals: Math.floor(Math.log10(pScale)) + 1);
         if (viewmode  == viewing.LineGraph)
         {
            scalew.repaint();
            plotframe.repaint();
         }
      }
   }

/* ---------------------------------------------
   Normalize data, divide image by mean
   ---------------------------------------------
*/
   var cbNorm = new CheckBox(navi);
   with (cbNorm)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "Image / Mean";
      onCheck = function(checked)
      {
         normalized = checked;
         cbBgView.enabled = !normalized;
         cbAvgDev.enabled = !normalized;
         cbStdDev.enabled = !normalized;
         if (normalized)
         {
            cbMean.enabled   = false;
            cbMean.checked   = true;
            cbLog.checked    = false;
            }
         else
         {
            cbMean.enabled   = true;
            cbMean.checked   = false;
            cbAvgDev.enabled = true;
            }
         getData(x0, y0, x1, y1, normalized);
         plotframe.repaint();
      }
   }

/* ---------------------------------------------
   Color channel selection
   load 3 lines with a box as color indicator
   and a PushButton
   ---------------------------------------------
*/
   var colorButton = new Array(3);
   var colorFrames = new Array(3);
   ctlY +=32;
   for (var i = 0; i < 3; i++)
   {
      ctlY += 32;
      colorButton [i] = new PushButton(navi);
      colorButton [i].text = ["R", "G", "B"][i];
      colorButton [i].enabled = false;
      colorButton [i].position = new Point(42,ctlY);
      colorButton [i].onClick = function(checked)
      {
         map = null;
         channel = "RGB".indexOf(this.text);
         SelectChannel(channel);
         getData(x0, y0, x1, y1, normalized);
         ShowStats();
         ShowColorControls();
         if (viewmode  == viewing.LineGraph)
         {
            plotframe.repaint();
            scalew.repaint();
         }
         else
         {
            picturebox.repaint();
         }
      }
      colorFrames [i] = new Frame(navi);
      colorFrames [i].visible = false;
      colorFrames [i].width   = colorButton [i].height - 2;
      colorFrames [i].height  = colorButton [i].height - 2;
      colorFrames [i].backgroundColor = 0xFF000000 | (0x00FF0000 >>> ( 8 * i ));
      colorFrames [i].position = new Point(12, ctlY);
      }

/* ---------------------------------------------
   Display options selection
   ---------------------------------------------
*/
   var lblOpts = new Label(navi);
   with (lblOpts)
   {
      ctlY += vertStep*2;
      position = new Point(horizMargin,ctlY);
      text = "Drawing Options";
   }

   var pixScale = new ComboBox(navi);
   with (pixScale)
   {
      ctlY += vertStep-10;
      position = new Point(horizMargin,ctlY);
      width = navi.width - horizMargin*2;
      addItem("Normalized [0,1]");
      addItem("8-bit [0,255]");
      addItem("10-bit [0,1023]");
      addItem("12-bit [0,4095]");
      addItem("14-bit [0,16383]");
      addItem("16-bit [0,65535]");
      decimals = -fracDecimals;

      onItemSelected = function(index)
      {
        switch(index)
        {
            case 0:
               pScale = 1.0;
            break;
            case 1:
               pScale = 255.0;
            break;
            case 2:
               pScale = 1023.0;
            break;
            case 3:
               pScale = 4095.0;
            break;
            case 4:
               pScale = 16383.0;
            break;
            case 5:
               pScale = 65535.0;
            break;
         }
         decimals = ((pScale == 1) ? -fracDecimals: Math.floor(Math.log10(pScale)) + 1);
         getData(x0, y0, x1, y1, normalized);
         ShowStats();
         scalew.repaint();
         plotframe.repaint();

         numBoxMin.setRange(0, pScale);
         numBoxMin.setValue(0);

         numBoxMax.setRange(0, pScale);
         numBoxMax.setValue(pScale);

         normRangeToDataRange();
         scalew.repaint();
         plotframe.repaint();
      }
   }

   //ctlY += vertStep/2;

   var cbVarRange = new CheckBox(navi);
   with (cbVarRange)
   {
      ctlY += vertStep;
      position = new Point(horizMargin, ctlY);
      text = "Variable Range";
      checked = true;
      onCheck = function(checked)
      {
         numBoxMin.enabled = !checked;
         numBoxMax.enabled = !checked;
         if (!checked)
         {
            normrange[0] = numBoxMin.value / pScale;
            normrange[1] = numBoxMax.value / pScale;
         }
         else
         {
            DataToNormRange();
         }
         normRangeToDataRange();
         scalew.repaint();
         plotframe.repaint();
      }
   }

   var lblMinVal = new Label(navi);
   with (lblMinVal)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "Min. Value";
   }

   var numBoxMin = new NumericEdit(navi);
   with (numBoxMin)
   {
      enabled  = false;
      height   = 25;
      width    = 200;
      position = new Point((navi.width -  width - horizMargin),ctlY);
      setPrecision(5);
      setRange(0, 1);
      setValue(0);
      onKeyPress = function()
      {
         btnFlip.defaultButton = false;
      }
      onValueUpdated = function(number)
      {
         normrange[0] = number / pScale;
         normRangeToDataRange();
         scalew.repaint();
         plotframe.repaint();
      }
   }

   var lblMaxVal = new Label(navi);
   with (lblMaxVal)
   {
      ctlY += vertStep;
      position = new Point(12,ctlY);
      text = "Max. Value";
   }

   var numBoxMax = new NumericEdit(navi);
   with (numBoxMax)
   {
      enabled  = false;
      height   = 25;
      width    = 200;
      position = new Point((navi.width -  width - horizMargin),ctlY);
      setPrecision(5);
      setRange(0, 1);
      setValue(1);
      onKeyPress = function()
      {
         btnFlip.defaultButton = false;
      }
      onValueUpdated = function(number)
      {
         normrange[1] = number / pScale;
         normRangeToDataRange();
         scalew.repaint();
         plotframe.repaint();
      }
   }

   var cbMean = new CheckBox(navi);
   with (cbMean)
   {
      ctlY += vertStep;
      position = new Point(horizMargin, ctlY);
      text = "Mean";
      onCheck = function(checked)
      {
         plotframe.repaint();
      }
   }
   var textBoxMean = new Frame(navi);
   with (textBoxMean)
   {
      backgroundColor = whiteB.color;
      height   = 25;
      width    = 200;
      //position = new Point(100,ctlY);
      position = new Point((navi.width - width - horizMargin),ctlY);
      onPaint  = function()
      {
         var g = new Graphics();
         g.begin(this); //
         g.drawTextRect(visibleRect, fmtV(mean), TextAlign_Right);
         g.end();
      }
   }

   var cbAvgDev = new CheckBox(navi);
   with (cbAvgDev)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "AvgDev";
      onCheck = function(checked)
      {
         plotframe.repaint();
      }
   }

   var textBoxAvgDev = new Frame(navi);
   with (textBoxAvgDev)
   {
      backgroundColor = devB.color;
      height   = 25;
      width    = 200;
      position = new Point((navi.width - width - horizMargin),ctlY);
  
      onPaint  = function()
      {
         var g = new Graphics();
         g.begin(this);
         g.drawTextRect(visibleRect, fmtV(avgDev), TextAlign_Right);
         g.end();
      }
   }

   var cbStdDev = new CheckBox(navi);
   with (cbStdDev)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "StdDev";
      onCheck = function(checked)
      {
         plotframe.repaint();
      }
   }

   var textBoxStdDev = new Frame(navi);
   with (textBoxStdDev)
   {
      backgroundColor = devS.color;
      height   = 25;
      width    = 200;
      position = new Point((navi.width - width - horizMargin),ctlY);

      onPaint  = function()
      {
         var g = new Graphics();
         g.begin(this);
         g.drawTextRect(visibleRect, fmtV(stdDev), TextAlign_Right);
         g.end();
      }
   }

   var cbBgView = new CheckBox(navi);
   with (cbBgView)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "BackGnd";
      onCheck = function(checked)
      {
         plotframe.repaint();
      }
   }

   var textBoxBgView = new Frame(navi);
   with (textBoxBgView)
   {
      backgroundColor = bgpen.color;
      textColor = white.color;
      height   = 25;
      width    = 200;
      position = new Point((navi.width -  width - horizMargin),ctlY);
      onPaint  = function()
      {
         var g = new Graphics();
         g.begin(this);
         g.drawTextRect(visibleRect, fmtV(imgbgm), TextAlign_Right);
         g.end();
      }
   }

   var btnClose = new PushButton(navi);
   with (btnClose)
   {
      ctlY += vertStep;
      position = new Point(horizMargin,ctlY);
      text = "Close";
      onClick = function()
      {
         dialog_instance.ok();
         }
      }

   minDialogWidth = 1500;
   minDialogHeight =  ctlY + 32+150;
   this.resize(minDialogWidth, minDialogHeight);


/* ********************************************************************
 * Image data routines
 * ********************************************************************
*/

   function getImage(view)
   {
      // split image(s) from selected view and fill globals
      dialog_instance.cursor = new Cursor(StdCursor_Wait);

      image   = view.image;
      imageR  = new Rect(0, 0, image.width, image.height);
      pixdat  = new Array(image.numberOfChannels);
      imgbuf  = new Array(image.numberOfChannels);
      /*
         Copy data into pixdat[c]
         Extract image channels as imgbuf[c] from selected view
         Apply the STF for the display to each image
      */
      for (var c = 0; c < image.numberOfChannels; c++)
      {
         SelectChannel(c);
         pixdat[c] =  new Array(image.width * image.height);
         image.getPixels (pixdat[c]);
         // make greyscale image from channel
         imgbuf[c] = new Image(image.width, image.height);
         imgbuf[c].assign(image, imageR, c, c);
         AutoSTFImage(imgbuf[c], median, avgDev, SHADOWS_CLIP, TARGET_BKG);
         }
      image.resetSelections();

      if (lastR.width == imageR.width & lastR.height == imageR.height)
      {
         // new image with same size, keep coordinates
      }
      else
      {
         // setup vertical cut
         x0      = image.width/2;
         x1      = x0;
         y0      = 0;
         y1      = image.height-1;
         rotCenter = centerPoint(x0, y0, x1, y1);
         angle = 90;
         ncRot.setValue(angle);
         lastR   = imageR;
         // update max values in num controls and sliders
         with (dialog_instance)
         {
            XNum.setRange(0, image.width-1);
            XNum.setValue(Math.floor(x0));
            YNum.setRange(0, image.height-1);
            YNum.setValue(Math.floor(image.height / 2));
            sldX.maxValue = image.width-1;
            sldY.maxValue = image.height-1;
            sldX.value    = XNum.value;
            sldY.value    = YNum.value;
            // start with new view, channel 0, vertical center line
            rbV.checked = true;
         }
      }
      if(image.isGrayscale) channel = 0;
      SelectChannel(channel);
      getData(x0, y0, x1, y1, normalized);
      ShowColorControls();
      map     = null;
      dialog_instance.windowTitle =
         "Plot Intensity Profile of " + view.id;
      dialog_instance.cursor = new Cursor(StdCursor_Arrow);
      if (viewmode  == viewing.LineGraph)
      {
         plotframe.repaint();
         scalew.repaint();
      }
      else
      {
         SetupPictureBox();
         picturebox.repaint();
      }
   }

   function SelectChannel(c)
   {
      image.selectedChannel = c;
      mean    = image.mean();
      median  = image.median();
      avgDev  = image.avgDev();
      stdDev  = image.stdDev();
      imgbgm  = 3 * median - 2 * mean;
   }

/* ********************************************************************
 *    extract pixel data from p0(x0, y0) to p1(x1, y1)
 * ********************************************************************
*/

   function getData(x0, y0, x1, y1, normalized)
   {
      M = scan(x0, y0, x1, y1, image.width, image.height, pixdat[channel]);

      if (M == null)
      {
         Console.writeln("Error fetching data from "+ x0 +" " + y0 +" " + x1 +" " + y1);
         return;
      }

      if (normalized)
      {
         for (var i = 0; i< M.length; i++)
         {
            M[i].Intensity /= mean;
         }
      }

      // get min/max values from selected pixels

      if (!cbVarRange.checked) return;

      DataToNormRange();
      normRangeToDataRange();
   }

   function DataToNormRange()
   {
      //
      // retrieve min and max from intensities
      //
      var maxint = -1e10;
      var minint =  -maxint;
      for (var i = 0; i< M.length; i++)
      {
         var a = M[i].Intensity;
         if (a > maxint) {maxint = a;}
         if (a < minint) {minint = a;}
      }

      minint = Math.min(minint, imgbgm);

      normrange[0] = minint
      normrange[1] = maxint;
   }

   function normRangeToDataRange()
   {
      // get values to draw y-gridlines
      var u = normrange[0] * pScale;              // min. value scaled
      var v = normrange[1] * pScale;              // max. value scaled
      var r = (normrange[1] - normrange[0]) * pScale;   // range scaled
      var digits = Math.log10(r);
      digits     = Math.floor(digits);
      var linc = Math.pow10(digits);
      gridValues = [];
      minval = u;
      var z = Math.max(0,Math.floor(u / linc)* Math.pow10(digits));
      gridValues.push(u);
      while (z < v)
      {
         gridValues.push(z);
         z += linc;
         z = Math.roundTo(z, 6);
      }
      gridValues.push(v);
      maxval = v;
   }

   function scan(x0, y0, x1, y1, width, height, imagedata)
   {
      /*
      input:   start point (x0, y0)
               end point   (x1, y1)
               image object
               imagedata data of selected channel

      return:  pixelObject() data as array
      */
      x0 = Math.floor(x0);
      y0 = Math.floor(y0);
      x1 = Math.floor(x1);
      y1 = Math.floor(y1);

      var Values;
      var tmp;
      // *************************************
      // check vertical scan
      // *************************************
      if (x0 == x1)
      {
         if (y1 < y0)
         {
            tmp = y1;
            y1  = y0;
            y0  = tmp;
            }
         Values = Array(y1 - y0 + 1);
         var index = y0 * width + x0;
         for (var y = 0; y < Values.length ; y++)
         {
            Values[y] = new pixelObject(imagedata [index], x0, y);
            index += width;
            }
         return Values;
         }
      // *************************************
      // check horizontal scan
      // *************************************
      if (y0 == y1)
      {
         if (x1 < x0)
         {
            tmp = x1;
            x1  = x0;
            x0  = tmp;
            }
         Values = Array(x1 - x0 + 1);
         for (var x = 0; x < Values.length; x++)
         {
            var index = y0 * width + x + x0;
            Values[x] =  new pixelObject(imagedata [index], x, y0);
         }
         return Values;
      }
      // **************************************
      // Bresenham's line algorithm implemented
      //
      // **************************************
      var dx = Math.abs(x1-x0);
      var dy = Math.abs(y1-y0);
      var sx = (x0 < x1) ? 1 : -1;
      var sy = (y0 < y1) ? 1 : -1;
      var err = dx - dy;
      if (dx > dy)
         Values = Array( Math.abs(x1 - x0) + 1);
      else
         Values = Array( Math.abs(y1 - y0) + 1);
      var j = 0;

      while(true)
      {
         var index = y0 * width + x0;
         Values[j] =  new pixelObject(imagedata [index], x0, y0);
         j +=1;
         if ((x0 == x1) && (y0 == y1)) break; // ready
         var e2 = 2 * err;
         if (e2 >-dy){ err -= dy; x0  += sx; }
         if (e2 < dx){ err += dx; y0  += sy; }
      }

      return Values;
   }

/* ********************************************************************
 * Graphics routines
 * ********************************************************************
*/

   function DrawGraph(g)
   {
      if (M == null) return;

      // draw a frame around the drawing area

      g.drawRect(g.clipRect);

      if (!normalized) DrawStatisticValues(g, linear);

      // draw gridlines

      DrawGrid(g, linear);

      // draw data

      DrawData(g, linear);
   }

   function DrawScale(g)
   {
      if (M == null) return;
      /*
         plot gridlines between
         maxval (normalized, if option set)
         minval (normalized, if option set)
      */
      var w = g.clipRect.width;
      var h = plotframe.height;
      var offset = plotframe.position.y;
      var fixed = ((pScale == 1) ? Math.abs(decimals) : 0);  // set formatting length
      var bold  = new Font(canvas.font);
      bold.bold = true;
      bold.pointSize = 5;
      var norm  = new Font(canvas.font);
      norm.pointSize = 6;
      if (linear)
      {
         //
         // linear display
         //
         var lastY  = 1e99;
         var yArray = transformLin(gridValues, h,  minval, maxval);
         for (var i = 0; i < yArray.length; i++)
         {
            var y = yArray[i] + offset;
            if (Math.abs(y - lastY) < min_line_dist) continue;
            lastY = y;
            var v = gridValues[i];
            g.pen = ngpen;
            g.drawLine(w-6, y, w, y);
            var txtR = new Rect(0, y - 10, w - 8, y + 10);
            g.brush = blackB;
            g.font = bold;
            g.drawTextRect(txtR, v.toFixed(fixed), TextAlign_Right);
            if (i > 0)
            {
               g.pen = igpen;
               for each (v in InsideValues(gridValues[i-1],
                                           gridValues[i],
                                           yArray[i-1],
                                           yArray[i],
                                           min_line_dist))
               {
                  y = transformLin(v, h,  minval, maxval) + offset;
                  if (y <= h)
                  {
                     g.drawLine(w-4, y, w, y);
                     g.brush = grayB
                     txtR = new Rect(0, y - 10, w - 8, y + 10);
                     g.font  = norm;
                     g.drawTextRect(txtR, v.toFixed(fixed), TextAlign_Right);
                  }
               }
            }
         }
      }
      else
      {
         //
         // logarithmic display
         //
         for (var i = 0; i < Math.abs(decimals + Math.sign(decimals)); i++)
         {
            var v = Math.pow10(i);
            y = transformLog(v, h, decimals) * Math.sign(decimals) + offset;
            var txtR = new Rect(0, y - 10, w-8, y + 10);
            g.drawLine(w-6, y, w, y);
            g.brush = blackB;
            g.font = bold;
            g.drawTextRect(txtR,
               (Math.pow10(i * Math.sign(decimals))).toFixed(fixed),
               TextAlign_Right);
         }
      }
   }

   function DrawGrid(g, linear)
   {
      var w = g.clipRect.width;
      var h = g.clipRect.height;
      g.antialiasing = false;
      if (linear)
      {
         //
         // linear display
         //
         var yArray = transformLin(gridValues, h,  minval, maxval);
         for (var i = 0; i < yArray.length; i++)
         {
            var y = yArray[i];
            g.pen = ngpen;
            g.drawLine(0, y, w, y);
            if (i > 0)
            {
               g.pen = igpen;
               for each (v in InsideValues(gridValues[i-1],
                                           gridValues[i],
                                           yArray[i-1],
                                           yArray[i],
                                           min_line_dist))
               {
                  y = transformLin(v, h,  minval, maxval);
                  g.drawLine(0, y, w, y);
               }
            }
         }
      }
      else
      {
         //
         // logarithmic display
         //
         for (var i = 0; i < Math.abs(decimals + Math.sign(decimals)); i++)
         {
            var v = Math.pow10(i  * Math.sign(decimals));
            y = transformLog(v, h, decimals);
            g.pen = ngpen;
            g.drawLine( 0, y, w, y);
            var dV = v / 10;
            var u  = dV;
            while (u < v)
            {
               y = transformLog(u, h, decimals);
               g.pen = igpen;
               g.drawLine( 0, y, w, y);
               u += dV;
            }
         }
      }
   }

   function DrawData (g, linear)
   {
      //
      //
      //
      var w = g.clipRect.width;
      var h = g.clipRect.height;
      var offset = plotframe.position.y;

      if (image.isColor)
         g.pen = colorP[channel];
      else
         g.pen = black;

      g.antialiasing = true;
      //
      // transform values to points
      //
      var fx = g.clipRect.width / (M.length - 1);
      var points = new Array(M.length);
      var v;
      if (linear)
         v = transformLin(multPixelsScalar(M, pScale), h,  minval, maxval);
      else
         v = transformLog(multPixelsScalar(M, pScale), h, decimals);
      for (var i = 0; i < v.length; i++)
      {
         points[i] = new Point(i * fx , v[i]);
      }
      //
      // output points
      //
      g.drawPolyline(points);
   }

   function DrawStatisticValues(g, linear)
   {
      //
      // draw standard deviation and mean
      //
      var w = g.clipRect.width;
      var h = g.clipRect.height;

      if (linear)
      {
         //
         // linear display
         //
         var v = mean * pScale;
         var y = transformLin(v, h,  minval, maxval);
         if (cbStdDev.checked)
         {
            var a = (mean + stdDev) * pScale;
            var b = (mean - stdDev) * pScale;
            var c = transformLin(a, h,  minval, maxval);
            var d = transformLin(b, h,  minval, maxval);
            var devR = new Rect(0 , c, w, d);
            g.fillRect(devR, devS);
         }
         if (cbAvgDev.checked)
         {
            var a = (mean + avgDev) * pScale;
            var b = (mean - avgDev) * pScale;
            var y = transformLin(v, h,  minval, maxval);
            var c = transformLin(a, h,  minval, maxval);
            var d = transformLin(b, h,  minval, maxval);
            var devR = new Rect(0 , c, w, d);
            g.fillRect(devR, devB);
         }
         if (cbMean.checked)
         {
            // draw Mean
            g.pen = red;
            g.drawLine( 0, y, w, y);
         }
      }
      else
      {
         //
         // logarithmic display
         //
         if (cbStdDev.checked)
         {
            var c = transformLog((mean + stdDev) * pScale, h, decimals);
            var d = transformLog((mean - stdDev) * pScale, h, decimals);
            var devR = new Rect(0 , c, w, d);
            g.fillRect(devR, devS);
         }
         if (cbAvgDev.checked)
         {
            var c = transformLog((mean + avgDev) * pScale, h, decimals);
            var d = transformLog((mean - avgDev) * pScale, h, decimals);
            var devR = new Rect(0 , c, w, d);
            g.fillRect(devR, devB);
         }
         if (cbMean.checked)
         {
            // draw Mean
            g.pen = red;
            var y = transformLog(mean * pScale, h, decimals);
            g.drawLine( 0, y, w, y);
         }
      }
      //
      // draw background curve
      //
      if (cbBgView.checked)
      {
         var coeff = LinearRegression (M, imgbgm);
         //   y = b + c * x
         if (coeff != null)
         {
            var b  = coeff[0];
            var c  = coeff[1];
            var x0 = 0;
            var x1 = M.length - 1;
            var yL = (b + c * x0);
            var yR = (b + c * x1);
            gradient = yR - yL;
            g.pen  = bgpen;     // broad transparent pen
            g.antialiasing = true;
            if (linear)
            {
               var p0 = new Point(0, transformLin(yL * pScale, h,  minval, maxval));
               var p1 = new Point(w, transformLin(yR * pScale, h,  minval, maxval));
               g.drawLine(p0, p1);
            }
            else
            {
               var p0 = new Point( 0, transformLog(yL * pScale, h, decimals));
               var p1 = new Point( w, transformLog(yR * pScale, h, decimals));
               g.drawLine(p0, p1);
            }
            g.pen = blue;
            var p0 = new Point(0, transformLin(imgbgm * pScale, h,  minval, maxval));
            var p1 = new Point(w, transformLin(imgbgm * pScale, h,  minval, maxval));
            g.drawLine(p0, p1);
         }
      }
   }

   // this shows one channel of your beautiful deep sky image

   function DrawImage(g)
   {
      if (map == null)
      {
         var mapImage = new Image(imgbuf[channel]);
         map_scale = g.clipRect.width / image.width;
         mapImage.resample(map_scale);
         map =  mapImage.render();
         mapImage = null;
      }
      g.drawBitmapRect(new Point(0, 0), map, g.clipRect);
      //
      // draw cut tool
      //
      var x = rotCenter.x;
      var y = rotCenter.y;
      var frame = new Rect(0, 0, image.width, image.height);
      var line = lineInFrame(x, y, -angle, frame);
      if (line == null)
         return;
      else
      {
         // center line
         var p0 = line[0];
         var p1 = line[1];
         // equidistant lines which build the polygon
         var d = 5 / map_scale;
         var lx1 = (x + 0.5) + d * Math.cos((-angle - 90) * Math.RAD);
         var ly1 = (y + 0.5) + d * Math.sin((-angle - 90) * Math.RAD);
         var lx2 = (x + 0.5) + d * Math.cos((-angle + 90) * Math.RAD);
         var ly2 = (y + 0.5) + d * Math.sin((-angle + 90) * Math.RAD);
         frame = new Rect(-frame.width / 2,  -frame.height / 2,
                           frame.width * 1.5, frame.height * 1.5);
         var line1 = lineInFrame(lx1, ly1, -angle, frame);
         var line2 = lineInFrame(lx2, ly2, -angle, frame);
         var poly  = [line1[0], line1[1], line2[1], line2[0]];
         g.antialiasing = true;
         g.scaleTransformation(map_scale, map_scale);
         g.fillPolygon(poly, 0, toolB);
         g.pen = red;
         g.drawCircle(rotCenter, 20 / map_scale);
         g.drawLine(p0, p1);
      }
   }

/* ********************************************************************
 * miscellaneous routines
 * ********************************************************************
*/

   function SetToolCenter(cp)
   {
      rotCenter.x = cp.x;
      rotCenter.y = cp.y;
      if (viewmode  == viewing.ImageView)
      {
         picturebox.repaint();
      }
   }

   function EnableControls(bool)
   {
      btnFlip.enabled   = bool;
      btnHCenter        = bool;
      btnVCenter        = bool;
      cbLog.enabled     = bool;
      cbMean.enabled    = bool;
      cbAvgDev.enabled  = bool;
      cbStdDev.enabled  = bool;
      for (var i = 0; i < 3; i++) colorButton [i].enabled = bool;
      sldX.enabled      = bool;
      sldY.enabled      = bool;
      XNum.enabled      = bool;
      YNum.enabled      = bool;
      rbH.enabled       = bool;
      rbV.enabled       = bool;
      rbDd.enabled      = bool;
      rbDu.enabled      = bool;
      }

   function ShowColorControls()
   {
      if (image.isColor)
      {
         for (var i = 0; i < 3; i++)
         {
            colorButton [i].enabled = true;
            colorFrames [i].visible = (i == channel);
         }
      }
      else
      {
         for (var i = 0; i < 3; i++)
         {
            colorButton [i].enabled = false;
            colorFrames [i].visible = false;
         }
      }
   }

   function ShowStats()
   {
      textBoxMean.repaint();
      textBoxAvgDev.repaint();
      textBoxStdDev.repaint();
      textBoxBgView.repaint();
   }

   function fmtV(v)
   {
      if (pScale == 1)
         return (v * pScale).toFixed(8)
      else
         return (v * pScale).toFixed(2)
   }

   function rotate()
   {
      // center point
      var x = rotCenter.x;
      var y = rotCenter.y;
      var frame = new Rect(0, 0, image.width, image.height);
      var line = lineInFrame(x, y, -angle, frame);
      if (line == null)
         return;
      else
      {
         x0 = line[0].x;
         y0 = line[0].y;
         x1 = line[1].x;
         y1 = line[1].y;
         getData(x0, y0, x1, y1, normalized);
         if (viewmode  == viewing.ImageView)
            picturebox.repaint();
         else
            plotframe.repaint();
      }
   }

   function SetupPictureBox()
   {
      //
      // re-position and re-size the picture box control
      //
      var maxFrame = new Rect(8, 8, canvas.width - 8, canvas.height - 8);
      var imgar  = image.width / image.height;
      var pbxar  = maxFrame.width / maxFrame.height;
      // make clip rectangle
      var w;
      var h;
      if (imgar >= pbxar)
      {
         w = Math.min(maxFrame.width, image.width);
         h = w / imgar;
      }
      else
      {
         h = Math.min(maxFrame.height, image.height);
         w = h * imgar;
      }
      picturebox.position = new Point(maxFrame.x0 + (maxFrame.width - w) / 2,
                                     (maxFrame.y0 + (maxFrame.height - h) / 2));
      picturebox.resize(w, h);
      picturebox.visible = true;
      map_scale = w / image.width;
   }

   // start with currentView, channel 0, vertical center line

   getImage(ImageWindow.activeWindow.currentView);
}

/* ********************************************************************
 *
 * external functions to plotdlg
 *
 **********************************************************************
*/

function SaveGraphics(ctl, CExt)
{
   var bm = ctl.render();
   var fileD = new SaveFileDialog();
   fileD.caption = "Save Drawing";
   fileD.overwritePrompt = true;
   fileD.loadImageFilters();
   fileD.selectedFileExtension = CExt;
   if (fileD.execute())
   {
      bm.save(fileD.fileName);
      CExt = fileD.selectedFileExtension;
   }
}

function SaveData(M)
{
   //
   // write csv with all selected intensities
   // format
   // index;x;y;i <CrLf>
   //
   var fileD = new SaveFileDialog();
   fileD.caption = "Save Intensities as csv";
   fileD.overwritePrompt = true;
   fileD.filters = [["CSV Files", ".csv", ".txt"]];
   fileD.selectedFileExtension = ".csv";
   if (fileD.execute())
   {
      try
      {
         var f = new File();
         f.createForWriting(fileD.fileName);
         var line = "Index;X;Y;Intensity";
         f.outText(line);
         f.outText('\r\n');
         for (var i = 0; i< M.length; i++)
         {
            var line = i + ";"+ M[i].x + ";" + M[i].y + ";" + M[i].Intensity;
            f.outText(line);
            f.outText('\r\n');
         }
         f.close();
      }
      catch (err)
      {
         new MessageBox(err.message, "Error writing CSV-File",
            StdIcon_Error, StdButton_Ok).execute();
      }
   }
}

function RGB(red, green, blue)
{
   var rgb = blue | (green << 8) | (red << 16);
   rgb = 0xFF000000 | rgb;
   return rgb;
}

function lineInFrame(cpx, cpy, angle, frame)
{
   //
   // get a line from center point and angle cutting a frame
   //
   if (!frame.includes(new Point(cpx, cpy)))
   {
      return null;
   }
   var d = frame.width * frame.height;
   var last_x = cpx + d * Math.cos(angle * Math.RAD);
   var last_y = cpy + d * Math.sin(angle * Math.RAD);
   var p1 = LineFrameInsersect(
      cpx,
      cpy,
      cpx + d * Math.cos(angle * Math.RAD),
      cpy + d * Math.sin(angle * Math.RAD),
      frame);
   var p2 = LineFrameInsersect(
      cpx,
      cpy,
      cpx + d * Math.cos((angle+180) * Math.RAD),
      cpy + d * Math.sin((angle+180) * Math.RAD),
      frame);
   return [p1, p2];
}

/* ********************************************************************
 * Math & geometry routines
 * ********************************************************************
*/

function isArray(object)
{
    if (object.constructor === Array) return true;
    else return false;
}

function transformLin(v, h, minval, maxval)
{
   if (isArray(v))
   {
      var a = new Array(v.length);
      for (var i = 0; i < a.length; i++)
         a[i] = h * (1 - (v[i] - minval) / (maxval - minval));
      return a;
   }
   else
      return h * (1 - (v - minval) / (maxval - minval));
}

function transformLog(v, h, decimals)
{
   if (isArray(v))
   {
      var a = new Array(v.length);
      for (var i = 0; i < a.length; i++)
      {
         var q = v[i];
         if (q > 0)
         {
            if (decimals > 0)
               a[i] = h * (1 + ((Math.log10(q)) / (-decimals)));
            else
               a[i] = h * (Math.log10(q) / decimals);
         }
         else
         {
            if (decimals > 0)
               a[i] = 0;
            else
               a[i] = h;
         }
      }
      return a;
   }
   else
   {
      if (v > 0)
      {
         if (decimals > 0)
            return h * (1 + ((Math.log10(v)) / (-decimals)));
         else
            return h * (Math.log10(v) / decimals);
      }
      else
      {
         if (decimals > 0)
            return 0;
         else
            return h;
      }
   }
}

function multPixelsScalar(v, scalar)
{
   var a = new Array(v.length);
   for (var i = 0; i < v.length; i++) a[i] = v[i].Intensity * scalar;
   return a;
}

function InsideValues(v0, v1, y0, y1, min_line_dist)
{
   var a = [];
   var q = [10, 5, 4, 3, 2];
   for (var j = 0 ; j < q.length; j++)
   {
      var d = q[j];
      var deltaY = Math.abs(y1 - y0) / d ;  // step
      if (deltaY >= min_line_dist)
      {
         var deltaV = (v1 - v0) / d;
         for (var i = 0; i < d -1; i++)
         {
            var v = v0 + (i+1) * deltaV;
            a.push(Math.roundTo(v, 8));
         }
         return a;
      }
   }
   return a;
}

function LineFrameInsersect(x, y, last_x, last_y, frame)
{
   /* calculate the frame intersection (ix and iy) of line and frame
    and return the cutting point

    the line starts with x and y inside the frame
    end ends with last_x and last_y outside

   */
   var bx1 = frame.x0;
   var bx2 = frame.x1-1;
   var by1 = frame.y0;
   var by2 = frame.y1-1;
   var ix;
   var iy;
   if (!frame.includes(new Point(x, y))) return new Point(-1, -1);

   if (last_x < bx1 && x >= bx1)          // does it cross left edge?
   {
      iy = last_y + (y - last_y) * (bx1 - last_x) / (x - last_x);
      if (iy >= by1 && iy <= by2)        // is intersection point on left edge?
      {
         ix = bx1;
         return new Point(ix, iy);
      }
   }
   else if (last_x > bx2 && x <= bx2)      // does it cross right edge?
   {
      iy = last_y + (y - last_y) * (bx2 - last_x) / (x - last_x);
      if (iy >= by1 && iy <= by2)        // is intersection point on right edge?
      {
         ix = bx2;
         return new Point(ix, iy);
      }
   }

   if (last_y < by1 && y >= by1)          // does it cross top edge?
   {
      ix = last_x + (x - last_x) * (by1 - last_y) / (y - last_y)
      if (ix >= bx1 && ix <= bx2)        // is intersection point on top edge?
      {
         iy = by1;
         return new Point(ix, iy);
      }
   }
   else if (last_y > by2 && y <= by2)      // does it cross bottom edge?
   {
      ix = last_x + (x - last_x) * (by2 - last_y) / (y - last_y)
      if (ix >= bx1 && ix <= bx2)        // is intersection point on bottom edge?
      {
         iy = by2;
         return new Point(ix, iy);
      }
   }
   return new Point(-1, -1);
}

function centerPoint(x0, y0, x1, y1)
{
   return new Point((x0 + x1) / 2, (y0 + y1) / 2);
}

/*
 * Find a midtones balance value that transforms v1 into v0 through a midtones
 * transfer function (MTF), within the specified tolerance eps.
 */

function findMidtonesBalance( v0, v1, eps )
{
   if ( v1 <= 0 )
      return 0;

   if ( v1 >= 1 )
      return 1;

   v0 = Math.range( v0, 0.0, 1.0 );

   if ( eps )
      eps = Math.max( 1.0e-15, eps );
   else
      eps = 5.0e-05;

   var m0, m1;
   if ( v1 < v0 )
   {
      m0 = 0;
      m1 = 0.5;
   }
   else
   {
      m0 = 0.5;
      m1 = 1;
   }

   for ( ;; )
   {
      var m = (m0 + m1)/2;
      var v = Math.mtf( m, v1 );

      if ( Math.abs( v - v0 ) < eps )
         return m;

      if ( v < v0 )
         m1 = m;
      else
         m0 = m;
   }
}


function LinearRegression (pixels, imgbgmean)
{
   /*
      computes linear regression coefficients (b and c)
      from an array of pixelObjects
      extract all intensities below 1.5 x image backgroung mean
      return b and c to compute
      y = b + c * x
   */
   var n    = 0;
   var xBar = 0.0;
   var yBar = 0.0;

   // count valid intensities

   var maxI = imgbgmean * 1.5;
   var minI = imgbgmean * 0.5;
    // count valid intensities
   for (var i = 0; i < pixels.length; i++)
   {
      if ((pixels[i].Intensity > minI) && (pixels[i].Intensity < maxI))
         {n +=1;}
   }

   if (n < 2)
      return null;

   var xValues = new Array(n);
   var yValues = new Array(n);

   var j = 0;
   for (var i = 0; i < pixels.length; i++)
   {
      if ((pixels[i].Intensity > minI) & (pixels[i].Intensity < maxI))
      {
         xValues[j] = i;
         yValues[j] = pixels[i].Intensity;
         j += 1;
      }
   }

   for (var i = 0; i < n; i++)
   {
      xBar += xValues[i];
      yBar += yValues[i];
   }

   xBar /= n;
   yBar /= n;

   var B1Numerator = 0.0;
   var B1Denominator = 0.0;

   for (var i = 0; i < n; i++)
   {
      B1Numerator += ((xValues[i] - xBar) * (yValues[i] - yBar))
      B1Denominator += Math.pow(xValues[i] - xBar, 2);
      }

   if (B1Denominator < 0.0000000000000001)
      return null;

   // results
   var c = B1Numerator / B1Denominator;
   var b = yBar - (c * xBar);

   return [b, c];
}

/* ****************************************************************************
 * PixInsight HistogramTransformation process
 * ****************************************************************************
*/
function AutoSTFImage(image, median, avgDev, shadowsClipping, targetBackground)
{
   var c0 = 0;
   var c1 = 0;
   var m  = 0;

   var h = new HistogramTransformation();
   if (  image.median() < 0.5 )
   {
      // Noninverted image
      c0  = median + shadowsClipping*avgDev;
      c0  = Math.range( c0, 0.0, 1.0 );
      m   = findMidtonesBalance( targetBackground, median - c0 );
      h.H = [ // c0, c1, m, r0, r1
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
            [ c0       , m         , 1.00000000, 0.00000000, 1.00000000],
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000]
            ];
   }
   else
   {
      // Inverted image
      c1  = median - shadowsClipping*avgDev;
      c1  = Math.range( c1, 0.0, 1.0 );
      m   = 1 - findMidtonesBalance( targetBackground, c1 - median );
      h.H = [ // c0, c1, m, r0, r1
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000],
            [0.00000000, m         , c1        , 0.00000000, 1.00000000],
            [0.00000000, 0.50000000, 1.00000000, 0.00000000, 1.00000000]
            ];
      }
   h.executeOn(image);
   h = null;
   }

//

plotdlg.prototype = new Dialog;

function main()
{
   var window = ImageWindow.activeWindow;
   if ( window.isNull )
      throw new Error( "No active image" );
   Console.abortEnabled = true;
   //Console.show();
   var dialog = new plotdlg();
   dialog.execute();
 }

main();

// ****************************************************************************
// EOF 2DPlot.js - Released 2013/06/13 12:00:00 UTC

