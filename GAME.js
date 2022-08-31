/*
GAME.js: Interactive graphical Editor
================================================================================

GAME ist ein grafisch interaktiver Editor für die Erstellung von elliptischen
und frei geformten Flächen zur Maskierung von Galaxien. Die Maske kann
beliebig viele Ellipsen verwalten. Sie wird aus dem aktiven Bild gewonnen.
Jede Ellipse wird durch 5 Ankerpunkte bestimmt. Der zentrale Punkt dient zur
Verschiebung und mit den peripheren Punkte kann die Kontur gedreht und gestreckt
werden.
Frei formbare Flächen werden über mehr als 2 Punkte gebildet. Die Fläche ist
über den Schwerpunkt in der Gesamtheit verschiebbar.

GAME is an interactive graphical Editor for the creation of elliptical and
multipoint areas used for masking galaxies. The mask can handle various
ellipsoids. The active window serves as the graphics base. An ellipsoid is
defined by 5 anker points.
The central point makes the move, while the peripheral points help rotate and
scale the object.
Multipoint areas are made of more then 2 points. A calculated centroid allows
movements of the whole area.

================================================================================

 Input

 1. Active window

 Copyright Hartmut V. Bornemann, 2017

 mailTo:hvb356@hotmail.de

 Method

 This script can draw an unlimted number of elliptical shapes on any
 view. The shapes are finally filled with a linear gradient from 1 in
 the center and 0 at the periperal line to guaratee a smooth trend.

 The calculation inside is simple a distance calculation from the
 center pixel to each pixel inside the ellipsoid. Normalizing this
 distance r gets the inverted intensity of that pixel.
 Intensities <= 0 are black and ignored in the drawing.

 In detail, the calculation is based on a point angle (pa)
 transformation and can be studied in function ellipsoidImage.

 Acknowledgements

 Ken Meyfroodt wrote the code to smoothen the binary mask
 Adam Block for his PixelMath expression shown in the PixInsight forum and
 his concept of selective rejection
 Andres del Pozo for his PreviewControl.js
 Members of the PixInsight-Austria user group for ongoing active support

*/

#feature-id    Utilities2 > GAME

#include <pjsr/StdButton.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/Slider.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/Color.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/ButtonCodes.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/PenStyle.jsh>
#include <pjsr/ColorComboBox.jsh>
#include <pjsr/FontFamily.jsh>
#include <pjsr/Compression.jsh>

#define ID 'GAME'
#define TITLE "GAME - Interactive Galaxy Mask Editor - "
#define VERSION "1.7.3"

#define markerSize 16

#define tempViewProperty "GAME_tempView"
#define GAMEMASK "GAMEMASK"
#define ISGAMEMASK "ISGAMEMASK"
#define GAMEMASKTIME "GAMEMASKTIME"

#define DEFAULT_AUTOSTRETCH_SCLIP  -2.80
#define DEFAULT_AUTOSTRETCH_TBGND   0.25
#define DEFAULT_AUTOSTRETCH_CLINK   false

#define smooth_value 1


function maskData(view, callback)
{
   this.width  = view.image.width;
   this.height = view.image.height;
   this.bounds = new Rect(0, 0, view.image.width, view.image.height);
   /*
   *     ellipsoid objects management
   *
   */
   this.ellipsoids = [];      // collection of ellipsoids
   this.deleted    = null;    // deleted ellipsoid
   this.index      = -1;      // index of object in use
   this.caller     = callback;
   var settings;

   this.objectType = 0;       // 0 = ellipses, 1 = multipoint
   var lastSelected = [-1, -1];

   this.setSettings = function (settingsObj)
   {
      settings = settingsObj;
      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         this.ellipsoids[i].setSettings (settings);
      }
      for (var i = 0; i < this.multiPoints.length; i++)
      {
         this.multiPoints[i].setSettings (settings);
      }
   }

   this.clear = function()
   {
      this.index = -1;
      this.ellipsoids = [];
   }

   this.addEllipsoid = function(x, y, a, b, pa) // create new ellipsoid and return the object
   {
      this.deselectAll();
      //
      // update index before new object added
      //
      this.objectType = 0;
      this.index = this.ellipsoids.length;
      this.ellipsoids.push(new ellipsoid(x, y, a, b, pa, this.caller));
      var e = this.ellipsoids[this.index];
      e.setSettings ( settings );
      this.caller.onFiguresChange();
      return e;
   }

   this.deleteEllipsoid = function()
   {
      //
      // delete the seleted object
      //
      if (this.index > -1)
      {
         this.deleted = this.ellipsoids[this.index];
         var tmp = [];
         for (var i = 0; i < this.ellipsoids.length; i++)
         {
            if (i != this.index) tmp.push( this.ellipsoids[i]);
         }
         this.clear();
         if (tmp.length == 0)
         {
            this.caller.onEllipsoidChange(null);
         }
         else
         {
            for (var i = 0; i < tmp.length; i++)
            {
               var e = tmp[i];
               this.addEllipsoid(e.x, e.y, e.a, e.b, e.pa);
            }
         }
      }
      this.caller.onFiguresChange();
   }

   this.getEllipsoid = function()
   {
      if (this.index > -1)
      {
         return this.ellipsoids[this.index];
      }
      else
      {
         return null;
      }
   }

   this.findEllipsoid = function(x, y)
   {
      //
      // check top object at first
      //
      if (this.index > -1)
      {
         var e = this.ellipsoids[this.index];
         if (e.findSelect(x, y))
         {
            this.deselectAll();
            e.selected = true;
            return e;
         }
      }
      //
      // search all
      //
      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         var e = this.ellipsoids[i];
         this.index = i;            // preset for the callback
         if (e.findSelect(x, y))
         {
            this.deselectAll();
            for (var i = 0; i < this.ellipsoids.length; i++)
            {
               this.ellipsoids[i].selected = this.ellipsoids[i] == e;
               if (this.ellipsoids[i].selected) this.index = i;
            }
            return e;
         }
      }
      return null;
   }

   this.setEllipsoid = function(index)
   {
      return this.ellipsoids[this.index];
   }

   this.setEllipsoids = function(ellipsoids)
   {
      this.clear();
      for (var i= 0; i < ellipsoids.length; i++)
      {
         var e = ellipsoids[i];
         this.addEllipsoid(e.x, e.y, e.a, e.b, e.pa);
      }
   }

   this.getEllipsoidsObject = function()
   {
      var ellipsoids = [];
      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         with (this.ellipsoids[i])
         {
            ellipsoids.push({x:x, y:y, a:a, b:b, pa:pa});
         }
      }
      return JSON.stringify(ellipsoids);
   }

   this.setEllipsoidsObject = function(jsonString)
   {
      if (jsonString != null)
      {
         this.ellipsoids = [];
         var ellipsoids = JSON.parse(jsonString);
         for (var i = 0; i < ellipsoids.length; i++)
         {
            with (ellipsoids[i])
            {
               this.addEllipsoid(x, y, a, b, pa);
            }
         }
      }
   }
   /*
   *     multipoint objects management
   *
   */
   this.multiPoints = [];      // collection of multiPointFigure

   this.currentCurve = null;

   this.curveIndex = -1;

   //this.transparency = 0;

   this.addMP = function ()
   {
      this.objectType = 1;
      this.deselectAll();
      this.currentCurve = new multiPointFigure(this.bounds, this.caller);
      this.currentCurve.setSettings(settings);
      this.multiPoints.push(this.currentCurve);
      this.curveIndex = this.multiPoints.length - 1;
      this.caller.onFiguresChange();
   }

   this.deleteMP = function ()
   {
      // remove currectCurve from list
      var list = [];
      for (var i = 0; i < this.multiPoints.length; i++)
      {
         if (this.currentCurve != this.multiPoints[i]) list.push(this.multiPoints[i]);
      }
      this.multiPoints = list;

      if (this.multiPoints.length > 0)
      {
         for (var i = 0; i < this.multiPoints.length; i++)
            this.multiPoints[i].selected = false;
         this.currentCurve = this.multiPoints[this.multiPoints.length -1];
         this.currentCurve.selected = true;
      }
      else
      {
         this.currentCurve = null;
      }
      this.caller.onFiguresChange();
   }

   this.addMultipointFigure = function (centroid, points, bezier, gradientCenter)
   {
      for (var i = 0; i < this.multiPoints.length; i++)
         this.multiPoints[i].selected = false;
      this.currentCurve = new multiPointFigure(this.bounds, this.caller);

      this.currentCurve.setSettings(settings);

      for (var i = 0; i < points.length; i++)
         this.currentCurve.setPoint(pointOf(points[i]));
      this.multiPoints.push(this.currentCurve);
      // finally, when all points set
      if (gradientCenter != null)
      {
         this.currentCurve.SetGradientCenter(new Point(gradientCenter[0], gradientCenter[1]));
      }
      this.caller.onFiguresChange();
   }

   this.setObjectType = function (objectType)
   {
      lastSelected = [-1, -1];
      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         if (this.ellipsoids[i].selected) lastSelected[0] = i;
      }
      for (var i = 0; i < this.multiPoints.length; i++)
      {
         if (this.multiPoints[i].selected) lastSelected[1] = i;
      }

      this.objectType = objectType;       // 0 = ellipses, 1 = multipoint
      this.deselectAll();

      // re-select last active

      if (this.objectType == 0 & lastSelected[0] > -1)
      {
         if (lastSelected[0] > -1) this.ellipsoids[lastSelected[0]].selected = true;
      }
      else if (this.objectType == 1 & lastSelected[1] > -1)
      {
         this.multiPoints[lastSelected[1]].selected = true;
         this.curveIndex = lastSelected[1];
      }
   }

   this.numObjects = function ()
   {
     // return this.ellipsoids.length + this.multiPoints.length;
      var count = this.ellipsoids.length;
      for (var i = 0; i < this.multiPoints.length; i++)
      {
         if (this.multiPoints[i].points.length > 2) count += 1;
      }
      return count > 0;
   }

   this.deselectAll = function()
   {
      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         this.ellipsoids[i].selected = false;
      }
      for (var i = 0; i < this.multiPoints.length; i++)
      {
         this.multiPoints[i].selected = false;
      }
      this.curveIndex = -1;
   }

   this.getMaskView = function ()
   {
      //
      // create a bitmap, draw all shapes and apply the image to a view
      //
      Console.writeln("Create ellipsoids:  " + this.ellipsoids.length);
      Console.writeln("Create multipoints: " + this.multiPoints.length);
      var bmp = new Bitmap (this.width, this.height);

      // blend into an image

      //var img = new Image(this.width, this.height);
      //img.blend (bmp);

      var g = new Graphics (bmp);

      g.fillRect (this.bounds, new Brush(0xff000000));

      // paint all multipoint figures white

      for (var i = 0; i < this.multiPoints.length; i++)
      {
         Console.writeln("fill multipoints: " + i);
         this.multiPoints[i].fill(g);
      }

      g.end();

      // blend into an image

      var img = new Image(this.width, this.height);
      img.blend (bmp);

      // paint gradient multipoint

      for (var i = 0; i < this.multiPoints.length; i++)
      {
         this.multiPoints[i].fillGradient(img);
      }

      // paint gradient ellipsoids

      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         drawGradientEllipsoid( img, this.ellipsoids[i]);
      }

      // create a view

      var mask = maskView(view, view.id);
      mask.beginProcess(UndoFlag_NoSwapFile);
      mask.image.assign( img );
      mask.endProcess();
      //
      return mask;
   }

   function drawGradientEllipsoid(img, e)
   {
      // pls. see:
      // https://math.stackexchange.com/questions/91132/how-to-get-the-limits-of-rotated-ellipse
      //
      var c  = Math.cos(e.pa);
      var s  = Math.sin(e.pa);
      var c2 = c * c;
      var s2 = s * s;
      var a2 = e.a * e.a;
      var b2 = e.b * e.b;
      var mx = Math.sqrt(a2 * c2 + b2 * s2);
      var my = Math.sqrt(a2 * s2 + b2 * c2);
      //
      // R is the box around the ellipsoid, expanded by 2 pixel
      //
      var R  = new Rect(Math.floor(e.x - mx - 1),
                        Math.floor(e.y - my - 1),
                        Math.ceil(e.x + mx + 1),
                        Math.ceil(e.y + my + 1));
      //
      // intersect rectangle of ellipsoid with image frame
      //
      R = R.intersection( new Rect(0, 0, img.width, img.height));
      //
      //
      //
      for (var y = R.y0; y < R.y1 ; y++)
      {
         for (var x = R.x0; x < R.x1 ; x++)
         {
            var K = Math.sqrt(Math.pow(((x - e.x) * c + (y - e.y) * s) / e.a, 2) +
                              Math.pow(((x - e.x) * s - (y - e.y) * c) / e.b, 2));
            if (K < 1) img.setSample( 1 - K, x , y );
         }
      }
   }

   this.objectsToString = function ()
   {
      // put all objects into a string collection and return the stringified array

      var figures = new Object();
      figures.ellipsoids = [];
      figures.multipoint = [];

      for (var i = 0; i < this.ellipsoids.length; i++)
      {
         figures.ellipsoids.push(this.ellipsoids[i].getStringObject());
      }
      for (var i = 0; i < this.multiPoints.length; i++)
      {
         figures.multipoint.push(this.multiPoints[i].getStringObject());
      }
      return JSON.stringify (figures);
   }
}

/* ****************************************************************************
 *
 *    Dialog
 *
 * ****************************************************************************
 */
function showDialog(cview, Id)
{
   //
   // Add all properties and methods of the core Dialog object to this object.
   //
   this.__base__ = Dialog;
   this.__base__();
   this.userResizable = true;
   var dialog = this;
   this.view = cview;
   this.viewSTF = null;
   this.id   = Id;
   this.progress = -1;
   this.imageBmp = GetWindowBmp(this.view);

   var primaryScreen       = primaryScreenDimensions();
   var maximized           = false;
   var normalDialogWin     = null;

   var data  = new maskData(this.view, dialog);
   var red    = 0xffFF0000;
   var green  = 0xff00FF00;
   var yellow = 0xffFF0F0F;
   var colorCenter;
   var colorContour;
   var ankerPointColor;
   var dragging = false;

   var settings = null;

   var defS = defaultSettings();

   var strSettings = Settings.read(ID, DataType_String );

   // Console.writeln('Settings JSON: ' + strSettings);

   if (strSettings != null) settings = JSON.parse(strSettings);

   if (settings == null) settings = defaultSettings();

   for (var i = 0; i < Object.keys(defS).length; i++)
   {
      // all keys in settings
      if (Object.keys(settings).indexOf(Object.keys(defS)[i] ) > -1) continue;
      settings = defaultSettings();
      Console.writeln('\nDefault settings loaded\n');
      break;
   }

   if (Object.keys(settings).indexOf('version') == -1)
   {
      Console.writeln('new version');
      settings = defaultSettings();
   }

   data.setSettings(settings);

   this.maximizeButton = new ToolButton(this);
   with (this.maximizeButton)
   {
      visible = primaryScreen.width > 0 && primaryScreen.height > 0;
      icon = ':/icons/window.png';

      onClick = function(checked)
      {
         maximized = !maximized;

         if (!maximized)
         {
            // restore
            dialog.move(normalDialogWin.x0, normalDialogWin.y0);
            dialog.resize(normalDialogWin.width, normalDialogWin.height);
            dialog.maximizeButton.icon = ':/icons/window.png';
         }
         else
         {
            // maximize
            normalDialogWin = dialog.boundsRect;
            normalDialogWin.moveTo(dialog.position);
            dialog.move(primaryScreen.x0, primaryScreen.y0);
            dialog.resize(primaryScreen.width, primaryScreen.height);
            dialog.maximizeButton.icon = ':/icons/windows.png';
         }
      }
   }

   this.previewControl = new PreviewControl(this);
   this.previewControl.SetImage(this.imageBmp, data);
   this.previewControl.buttons_Box.sizer.addSpacing(16);
   this.previewControl.buttons_Box.sizer.add(this.maximizeButton);

   this.previewControl.onCustomMouseDown = function (x, y, button, buttonState, modifiers)
   {
      if (data.objectType == 0)
      {
         var e = data.findEllipsoid(x, y);
         if (e == null){
            return;              // cursor far away from any point
         }
         //
         // data to controls
         //
         if (e.sp == 0)
         {
            // move center
            dragging = true;
         }
         else
         {
            // move a or b - point
            dragging = true;
         }
      }
      else if (data.objectType == 1)
      {
         if (data.currentCurve == null) return;
         if (data.currentCurve.selected && modifiers == KeyModifier_Control) return;
         if (data.currentCurve.selectedPoint())
         {
            if (button == MouseButton_Right)
            {
               data.currentCurve.removeSelectedPoint();
            }
         }
         else if (button == MouseButton_Left)
         {

            for (var i = 0; i < data.multiPoints.length; i++)
            {
               if (data.multiPoints[i].selectPoint(new Point(x, y)))
               {
                  if (data.multiPoints[i].centroidSelected())
                  {
                     data.deselectAll();
                     data.currentCurve = data.multiPoints[i];
                     data.currentCurve.selected = true;
                     data.curveIndex = i;
                     dialog.lblIndexMP.text = "Curve# " + (data.curveIndex + 1);
                     dialog.previewControl.repaint();
                     return;
                  }
               }
            }

            if (data.currentCurve == null) return;

            if (data.currentCurve.selectPoint(new Point(x, y)))
            {
               dialog.previewControl.repaint();
               return;
            }
            data.currentCurve.add(new Point(x, y));
         }
         else if (button == MouseButton_Right)
         {
            if (data.currentCurve.selected)
            {
               //
               // lock gradientCenter, set position to centroid
               //
               data.currentCurve.lockGradientCenter(new Point(x, y));
               dialog.previewControl.repaint();
               return;
            }
         }

         dialog.lblPointInfo.visible = false;
         dialog.previewControl.repaint();
         dialog.addMP.enabled = true;
      }
   }
   this.previewControl.onCustomMouseMove = function (x, y, buttonState, modifiers)
   {
      if (data.objectType == 0)
      {
         if ( dragging )
         {
            var e = data.getEllipsoid();
            e.movePoint(new Point(x, y));
            this.parent.repaint();    // update ellipsoid object
         }
      }
      else if (data.objectType == 1)
      {

         if (data.currentCurve != null)
         {

            if (buttonState == MouseButton_Left)
            {
               if (data.currentCurve.selected && modifiers == KeyModifier_Control)
               {
                  if (!data.currentCurve.gcLocked)
                     data.currentCurve.moveGradientCenterTo(new Point(x, y));
                  dialog.previewControl.repaint();
                  return;
               }
               if (data.currentCurve.selected && modifiers == 0)
               {
                  data.currentCurve.moveTo(new Point(x, y));
                  dialog.previewControl.repaint();
               }
            }

         }


         if (buttonState == MouseButton_Unknown)
         {
            for (var i = 0; i < data.multiPoints.length; i++)
            {
               if (!data.currentCurve == null)
               {
                  if (data.currentCurve.selected && modifiers == KeyModifier_Control)
                  {
                     //
                     // check mouse over gradientCenter
                     //
                     data.multiPoints[i].selectGradientCenter(new Point(x, y));
                     return;
                  }
               }

               if (data.multiPoints[i].selectPoint(new Point(x, y)))
               {
                  if (data.multiPoints[i].centroidSelected())
                  {
                     break;
                  }
                  if (data.multiPoints[i].gradientSelected())
                  {
                     break;
                  }
                  else
                  {
                     // point from a curve found
                     data.currentCurve = data.multiPoints[i];
                     data.curveIndex = i;
                     dialog.lblIndexMP.text = "Curve# " + (data.curveIndex + 1);
                     break;
                  }
               }
            }
         }
      }
   }

   this.previewControl.onCustomMouseUp = function (x, y, button, buttonState, modifiers)
   {
      if (data.objectType == 0)
      {
         dragging = false;
         this.parent.repaint();
      }
      else if (data.objectType == 1)
      {
         if (data.currentCurve == null) return;

         if (button == MouseButton_Left)
         {
            if (data.currentCurve.selected && modifiers == KeyModifier_Control)
            {
               //
               // lock gradientCenter, if position close to centroid
               //
               data.currentCurve.unlockGradientCenter(new Point(x, y));
               return;
            }
            data.currentCurve.selectPoint(null);
            dialog.previewControl.repaint();
         }
      }
   }

   this.previewControl.onCustomPaint = function (g, x0, y0, x1, y1)
   {
      //
      // draw ellipsoids
      //
      for (var i =0; i < data.ellipsoids.length; i++)
      {
         data.ellipsoids[i].draw (g);
      }
      //
      // draw multipoint curves
      //
      for (var i = 0; i < data.multiPoints.length; i++)
      {
         data.multiPoints[i].draw(g);
      }
   };

   this.previewControl.onCustomSTF = function (apply)
   {
      var horizontalScrollPosition = dialog.previewControl.scrollbox.horizontalScrollPosition;
      var verticalScrollPosition = dialog.previewControl.scrollbox.verticalScrollPosition;
      if (apply)
      {
         if (dialog.viewSTF == null)
         {
            dialog.viewSTF = copyView( dialog.view, "_copy");
            ApplyAutoSTF( dialog.viewSTF,
               DEFAULT_AUTOSTRETCH_SCLIP,
               DEFAULT_AUTOSTRETCH_TBGND,
               DEFAULT_AUTOSTRETCH_CLINK );

            ApplyHistogram (dialog.viewSTF);
            dialog.viewSTF.setPropertyValue( "dispose", true )
         }

         var imageBmp = GetWindowBmp(dialog.viewSTF);
         var zoom = dialog.previewControl.zoom;
         dialog.previewControl.SetImage(imageBmp, data);
         dialog.previewControl.UpdateZoom( zoom);
         dialog.previewControl.scrollbox.horizontalScrollPosition = horizontalScrollPosition;
         dialog.previewControl.scrollbox.verticalScrollPosition = verticalScrollPosition;
      }
      else
      {
         dialog.view = dialog.refList.currentView;
         var imageBmp = GetWindowBmp(dialog.view);
         var zoom = dialog.previewControl.zoom;
         dialog.previewControl.SetImage(imageBmp, data);
         dialog.previewControl.UpdateZoom( zoom);
         dialog.previewControl.scrollbox.horizontalScrollPosition = horizontalScrollPosition;
         dialog.previewControl.scrollbox.verticalScrollPosition = verticalScrollPosition;
      }
   }


   // this canvas for graphs and image display

   this.canvas = new Frame(this);
   with (this.canvas)
   {
      sizer = new VerticalSizer;
      with ( sizer )
      {
         add( this.previewControl );
      }
   }

   // ------------------------------------------------------------------------
   // GUI
   // ------------------------------------------------------------------------

   // my ©

   this.lblCopyright = new Label(this)
   with (this.lblCopyright)
   {
      text = "© 2017, Hartmut V. Bornemann";
   }
   //
   // reference mask
   //
   this.lblMask = new Label(this)
   with (this.lblMask)
   {
      useRichText = true;
      text = "<b>Import old mask</b>";
      toolTip = "Select an old mask and import all figures, saved with this script before";

      visible = false;
   }
   //
   // this button loads the recent created mask
   //
   this.btnRecent = new PushButton( this );
   with (this.btnRecent)
   {
      defaultButton = false;
      text = "load recently created figures";
      var old_ellipsoids = readEllipsoids(dialog.view);   // version 1.4
      var storedFigures = dialog.view.propertyValue('figures');// version 1.5
      enabled = old_ellipsoids.length > 0 || storedFigures != null;
      icon = this.scaledResource(":/icons/document-open.png");

      visible = false;

      onClick = function()
      {
         // new procedure
         //
         var n = data.numObjects();
         loadMaskFromView( dialog.view, data, dialog, settings );
         if (n == data.numObjects()) message("This view has no ellipsoids stored", "");
         dialog.btnRecent.defaultButton = false;
         dialog.delMP.enabled = data.multiPoints.length > 0;
         dialog.previewControl.repaint();
         dialog.tabControl.currentPageIndex = data.objectType;
      }
   }
   //
   //
   //
   this.btnOptions = new ToolButton( this );
   with (this.btnOptions)
   {
      icon =  this.scaledResource(':/toolbar/view-process-explorer.png');
      text = 'Options';
      toolTip = 'Edit drawing options';

      onClick = function ( checked )
      {
         var dlgOptions = new showOptions(JSON.stringify(settings));
         dlgOptions.execute();
         var strSettings = Settings.read(ID, DataType_String );
         settings = JSON.parse(strSettings);
         data.setSettings(settings);
         dialog.previewControl.repaint();
      }
   }
   this.optionsButtonFrame = new Frame(this);
   with (this.optionsButtonFrame)
   {
      sizer = new HorizontalSizer();
      sizer.margin = 4;
      sizer.add(this.btnOptions);
      sizer.addStretch();
   }
   //
   //
   //
   this.refList = new ViewList( this );
   with (this.refList)
   {
      //
      // fill the list
      //
      getMainViews();
      currentView  = dialog.view;
      //
      // remove non-mask views
      //
      var allViews = getAllMainViews();
      var masks = getOldMasks();
      this.btnRecent.enabled = this.btnRecent.enabled || masks.length > 0;

      if (masks.length > 1)
      {
         for (var i = 0; i < allViews.length; i++)
         {
            var v = allViews[i];
            var isMask = false;
            for (var j = 0; j < masks.length; j++)
            {
               if (v.id == masks[j].id)
               {
                  isMask = true;
                  break;
               }
            }
            if (!isMask) remove(v);
         }

      }
      else
      {
         //
         // check also GAMEMASK property value
         //
         var eStr = dialog.view.propertyValue(GAMEMASK);
         this.btnRecent.enabled = this.btnRecent.enabled || eStr != null;
      }

      onViewSelected = function( view )
      {
         // select another view
         if (view.isNull)
         {
            return;
         }
         else
         {
            dialog.viewSTF    = null;
            dialog.view       = view;
            dialog.imageBmp   = GetWindowBmp(dialog.view);
            data              = new maskData(dialog.view, dialog);
            data.setSettings(settings);
            dialog.previewControl.SetImage(dialog.imageBmp, data);
            if (settings.importAllways)
               loadMaskFromView( dialog.view, data, dialog, settings );
            dialog.previewControl.repaint();
            dialog.del.enabled = data.ellipsoids.length > 0;
            dialog.delMP.enabled = data.multiPoints.length > 0;
            dialog.tabControl.currentPageIndex  = 0;
            var old_ellipsoids = readEllipsoids(dialog.view);         // version 1.4
            var storedFigures = dialog.view.propertyValue('figures'); // version 1.5
            dialog.btnRecent.enabled = old_ellipsoids.length > 0 || storedFigures != null;
         }
      }
   }
   //
   // add / delete ellipsoids
   //
   this.lblAddDeletions = new Label(this)
   with (this.lblAddDeletions)
   {
      useRichText = true;
      text = "<b>Add and delete ellipsoids</>";
   }
   //
   // add button
   //
   this.add = new PushButton( this );
   with (this.add)
   {
      defaultButton = false;
      text = "add";
      icon = this.scaledResource( ":/icons/add.png");
      onClick = function()
      {
         dialog.add.defaultButton = false;
         //
         // place new object in center of viewport
         //
         var p = dialog.previewControl.center();
         var e = data.addEllipsoid(p.x, p.y, 200, 100, 0);
         dialog.previewControl.repaint();
      }
   }

   // ellipsoid parameter controls

   this.x = new NumericEdit(this);
   with (this.x)
   {
      label.text = "x:";
      setPrecision( 0 );
      setRange( 0, 99999 );
      setValue( 0 );
      toolTip = "<p>X-origin of the ellipsoid.</p>";
      onValueUpdated = function( value )
      {
         var e = data.getEllipsoid();
         if (e == null) return;
         e.setX( value );
         dialog.previewControl.repaint();
      }
   }

   this.y = new NumericEdit(this);
   with (this.y)
   {
      label.text = "y:";
      setPrecision( 0 );
      setRange( 0, 99999 );
      setValue( 0 );
      toolTip = "<p>Y-origin of the ellipsoid.</p>";
      onValueUpdated = function( value )
      {
         var e = data.getEllipsoid();
         if (e == null) return;
         e.setY( value );
         dialog.previewControl.repaint();
      }
   }

   this.a = new NumericEdit(this);
   with (this.a)
   {
      label.text = "a:";
      setPrecision( 0 );
      setRange( 0, 99999 );
      setValue( 0 );
      toolTip = "<p>Length of the 1st radius of the ellipsoid.</p>";
      onValueUpdated = function( value )
      {
         var e = data.getEllipsoid();
         if (e == null) return;
         e.setA( value );
         dialog.previewControl.repaint();
      }
   }

   this.b = new NumericEdit(this);
   with (this.b)
   {
      label.text = "b:";
      setPrecision( 0 );
      setRange( 0, 99999 );
      setValue( 0 );
      toolTip = "<p>Length of the 2nd radius of the ellipsoid.</p>";
      onValueUpdated = function( value )
      {
         var e = data.getEllipsoid();
         if (e == null) return;
         e.setB( value );
         dialog.previewControl.repaint();
      }
   }

   this.pa = new NumericEdit(this);
   with (this.pa)
   {
      label.text = "pa:";
      setPrecision( 2 );
      setRange( -180, 180 );
      setValue( 0 );
      toolTip = "<p>The point transformtion angle of the ellipsoid in degrees." +
                  " Use the mouse wheel here for rotation</p>";
      onValueUpdated = function( value )
      {
         var e = data.getEllipsoid();
         if (e == null) return;
         e.setPa( value );
      }

      onMouseWheel = function( x, y, delta, buttonState, modifiers )
      {
         var incr = 1;
         var e = data.getEllipsoid();
         if (e == null) return;
         var angle = e.getPa();
         if (delta > 0)
         {
            angle -= incr;
         }
         else if (delta < 0)
         {
            angle += incr;
         }
         angle = angle % 180;
         e.setPa( angle );
         dialog.previewControl.repaint();
      }
   }

   this.lblIndex = new Label(this)
   with (this.lblIndex)
   {
      text = "Ellipsoid#";
      toolTip = "<p>Index of the current ellipsoid.</p>";
   }

   this.del = new PushButton( this );
   with (this.del)
   {
      defaultButton = false;
      text = "delete";
      enabled = false;
      icon = this.scaledResource( ":/icons/delete.png");
      onClick = function()
      {
         data.deleteEllipsoid();
         dialog.previewControl.repaint();
         dialog.del.defaultButton = false;
      }
   }

   this.ellipsPage = new Frame ( this );
   with( this.ellipsPage )
   {
      sizer = new VerticalSizer();
      with (sizer)
      {
         margin = 4;
         add( this.lblAddDeletions );
         addSpacing(4);
         add( this.add );
         addSpacing(4);
         add( this.x );
         addSpacing(4);
         add( this.y );
         addSpacing(4);
         add( this.a );
         addSpacing(4);
         add( this.b );
         addSpacing(4);
         add( this.pa );
         //addSpacing(4);
         addStretch();
         add( this.lblIndex );
         addSpacing(4);
         add( this.del );
      }
   }

   //
   // add / delete multipoint curves
   //
   this.lblAddDeletMP = new Label(this)
   with (this.lblAddDeletMP)
   {
      useRichText = true;
      text = "<b>Add and delete multi point</>";
   }
   //
   // add button
   //
   this.addMP = new PushButton( this );
   with (this.addMP)
   {
      defaultButton = false;
      text = "add";
      icon = this.scaledResource( ":/icons/add.png");
      onClick = function()
      {
         dialog.addMP.defaultButton = false;
         //
         // place new object in center of viewport
         //
         data.addMP();
         dialog.lblPointInfo.visible = true;
         dialog.addMP.enabled = false;
         dialog.lblIndexMP.text = "Curve# " + (data.curveIndex + 1);
         dialog.delMP.enabled = data.multiPoints.length > 0;
         dialog.previewControl.repaint();
      }
   }

   this.helpCurved = new TextBox(this);
   with (this.helpCurved)
   {
      frameStyle = FrameStyle_Box;
      readOnly   = true;
      setScaledMinHeight(160);

      text = '<b>Curve editing</b><br>' +
             ' - append: click 3 points<br>' +
             ' - insert: click near contour<br>' +
             ' - remove: right click point<br>' +
             ' - move gradient center:<br>' +
             'hold down ctrl and start<br>' +
             'moving from gravity center<br>' +
             'to the desired position.';
   }

   this.lblPointInfo = new Label(this)
   with (this.lblPointInfo)
   {
      backgroundColor = 0xff00ffff;
      foregroundColor = 0xff000000;
      useRichText = true;
      text = "<b>Click 1st point of line</>";
      visible = false;
   }

   this.lblIndexMP = new Label(this)
   with (this.lblIndexMP)
   {
      text = "Curve#";
      toolTip = "<p>Index of the current multipoint curve.</p>";
   }

   this.delMP = new PushButton( this );
   with (this.delMP)
   {
      defaultButton = false;
      text = "delete";
      enabled = false;
      icon = this.scaledResource( ":/icons/delete.png");
      onClick = function()
      {
         data.deleteMP();
         dialog.delMP.enabled = data.multiPoints.length > 0;
         if (!dialog.delMP.enabled)
         dialog.lblIndexMP.text = "Curve#";
         dialog.previewControl.repaint();
         dialog.delMP.defaultButton = false;
      }
   }


   this.multiPointPage = new Frame( this );
   with ( this.multiPointPage )
   {
      sizer = new VerticalSizer();
      with (sizer)
      {
         margin = 4;
         add(this.lblAddDeletMP);
         addSpacing(4);
         add(this.addMP);
         addSpacing(4);
         add(this.helpCurved);
         addSpacing(8);
         add(this.lblPointInfo);
         addStretch();
         add(this.lblIndexMP);
         addSpacing(4);
         add(this.delMP);
      }
   }

   this.tabControl = new TabBox(this);
   with (this.tabControl)
   {
      addPage(this.ellipsPage, 'Ellipses' );
      addPage(this.multiPointPage, 'Multi point' );
      currentPageIndex = 0;

      onPageSelected = function ( pageIndex )
      {
         data.setObjectType(pageIndex);
         dialog.previewControl.repaint();
         if (pageIndex == 1) dialog.delMP.enabled = data.multiPoints.length > 0;
      }
   }
   //
   // mask exportations
   //
   this.lblExportations = new Label(this)
   with (this.lblExportations)
   {
      useRichText = true;
      text = "<b>Export Masks:</b>";
   }

   this.cbGradientMask = new CheckBox( this );
   with (this.cbGradientMask)
   {
      checked = true;
      text = "Gradient Mask";
   }
   //
   // mask with light protection (optional)
   //
   this.cbLightMask = new CheckBox( this );
   with (this.cbLightMask)
   {
      text = "Luminance Mask";
   }
   //
   // mask without gradient (optional)
   //
   this.cbPlainMask = new CheckBox( this );
   with (this.cbPlainMask)
   {
      text = "Binary Mask";
   }
   //
   // mask with Edge gradient (optional)
   //
   this.cbGradientEdgeMask = new CheckBox( this );
   with (this.cbGradientEdgeMask)
   {
      text = "Gradient Edge Mask";
   }

   //
   // mask ...$T * $M rescaled (optional)
   //
   this.cbBrightnessMask = new CheckBox( this );
   with (this.cbBrightnessMask)
   {
      text = "Brightness Mask";
   }
   //
   // mask ...$T * $M rescaled (optional)
   //
   this.cbStarMask = new CheckBox( this );
   with (this.cbStarMask)
   {
      text = "Star Mask";
   }

   this.btnSelectiveRejection = new PushButton(this);
   with (this.btnSelectiveRejection)
   {
      enabled = false;
      text ="Write shapes to Files/Views";
      toolTip = 'Paint the binary mask(s) into files and / or views.\n' +
            'A new appendix \'_sr\' is added to filenames.';

      onClick = function()
      {
         var srd = new showSelectiveRejection(data);
         srd.execute();
      }
   }

   this.lblCreate = new Label(this)
   with (this.lblCreate)
   {
      useRichText = true;
      text = "<b>Create and exit</b>";
   }

   this.okButton = new PushButton( this );
   with (this.okButton)
   {
      defaultButton = false;
      text = "OK";
      icon = this.scaledResource( ":/icons/ok.png" );
      onClick = function()
      {
         //
         // save ellipsiods in mainView
         //
         if (dialog.cbGradientMask.checked |
            dialog.cbLightMask.checked |
            dialog.cbPlainMask.checked |
            dialog.cbBrightnessMask.checked |
            dialog.cbStarMask.checked |
            dialog.cbGradientEdgeMask.checked)
            {
               /*if (!*/createMask(data,
                  dialog.view,
                  dialog.id,
                  settings,
                  dialog.cbGradientMask.checked,
                  dialog.cbLightMask.checked,
                  dialog.cbPlainMask.checked,
                  dialog.cbBrightnessMask.checked,
                  dialog.cbStarMask.checked,
                  dialog.cbGradientEdgeMask.checked)/*) return;*/
            }

         dialog.done(0);
      }
   }

   this.progressBar = new Frame(this)
   with (this.progressBar)
   {
      setFixedHeight(15);

      onPaint   = function( x0, y0, x1, y1 )
      {
         var R = new Rect( x0, y0, x1, y1 );

         var g      = new Graphics();
         g.begin(this);
         if (dialog.progress < 0)
         {
            var clear = new Brush( 0xFF2020CF );
            g.fillRect(R, clear );
         }
         else
         {
            var clear = new Brush( Color.WHITE );
            g.fillRect( R, clear );
            var w = dialog.progress * R.width * 0.01;
            var r = new Rect(0, 0, w, height);
            g.fillRect(r, new Brush( Color.GREEN ));
            g.pen = new Pen(0xff000000);
            g.drawTextRect(R, '*** please wait ***', TextAlign_Center);
         }
         g.drawRect(R);
         g.end();
      }

      onResize = function(wNew, hNew, wOld, hOld)
      {
         this.repaint();
      }
   }

   this.topLeft = new Frame(this);
   with (this.topLeft)
   {
      sizer = new VerticalSizer();
      with (sizer)
      {
         margin = 4;
         add( this.refList );
         /*addSpacing(16);
         add( this.lblMask );
         addSpacing(4);
         add( this.btnRecent );*/
         addSpacing(4);
         add(this.optionsButtonFrame);
      }
   }

   this.midLeft1 = new Frame(this);
   with (this.midLeft1)
   {
      sizer = new VerticalSizer();
      with (sizer)
      {
         margin = 4;
         add(this.tabControl);
      }
   }

   this.midLeft2 = new Frame(this);
   with (this.midLeft2)
   {
      sizer = new VerticalSizer();
      with (sizer)
      {
         margin = 4;
         add( this.lblExportations );
         addSpacing(4);
         add( this.cbLightMask );
         addSpacing(4);
         add( this.cbGradientMask );
         addSpacing(4);
         add( this.cbGradientEdgeMask );
         addSpacing(4);
         add( this.cbPlainMask );
         addSpacing(4);
         add( this.cbBrightnessMask );
         addSpacing(4);
         add( this.cbStarMask );
      }
   }

   this.botLeft = new Frame(this);
   with (this.botLeft)
   {

      setVariableSize();

      sizer = new VerticalSizer();

      with (sizer)
      {
         margin = 4;
         add( this.btnSelectiveRejection );
         addSpacing(8);
         add( this.lblCreate );
         addSpacing(4);
         add( this.okButton );
         addSpacing(4);//addStretch();
         add( this.progressBar );
         addSpacing(4);
         add( this.lblCopyright );
         addStretch();
      }

      adjustToContents();
   }

   this.navi = new Frame(this);
   with (this.navi)
   {
      backgroundColor = 0xFFF0F0F0 ;
      setScaledMaxWidth(220);
      sizer = new VerticalSizer();
      with (sizer)
      {
         margin = 4;
         add(this.topLeft);
         add(this.midLeft1);
         add(this.midLeft2);
         addStretch();
 //        add( this.progressBar );
         add(this.botLeft);
      }
   }


   this.sizer = new HorizontalSizer;
   with (this.sizer)
   {
      spacing = 4;
      add( this.navi );
      add( this.canvas );
   }

   with (this)
   {
      setScaledMinSize(1000, 750);

      onResize = function(wNew, hNew, wOld, hOld )
      {
         dialog.navi.repaint();
      }

      onKeyPress = function(k, m)
      {
         // Ctrl+C <= k == 67 & m == 2
         if (k == 67 & m == 2)
         {
            done(1);
         }
         else if (k == 27)
         {
            if (data.ellipsoids.length > 0 || data.multiPoint.length > 0)
            {
               if (ask("Figure(s) created, save before exit?","Warning" , StdButton_Yes))
               {
                  createMask(data,
                                dialog.view,
                                dialog.id,
                                settings,
                                dialog.cbGradientMask.checked,
                                dialog.cbLightMask.checked,
                                dialog.cbPlainMask.checked,
                                dialog.cbBrightnessMask.checked,
                                dialog.cbStarMask.checked,
                                dialog.cbGradientEdgeMask.checked);
               }
            }
            done(1);
         }
      }
   }

   this.onEllipsoidChange = function(e)
   {
      //
      // update GUI
      //
      if (e == null)
      {
         dialog.x.setValue(0);
         dialog.y.setValue(0);
         dialog.a.setValue(0);
         dialog.b.setValue(0);
         dialog.pa.setValue(0);
         dialog.previewControl.update();
         dialog.lblIndex.text = "Ellipsoid";
         dialog.del.enabled = false;
      }
      else
      {
         dialog.x.setValue(e.x);
         dialog.y.setValue(e.y);
         dialog.a.setValue(e.a);
         dialog.b.setValue(e.b);
         dialog.pa.setValue(e.pa * Math.DEG);
         dialog.previewControl.update();
         dialog.lblIndex.text = "Ellipsoid# " + (data.index + 1);
         dialog.del.enabled = data.index > -1;
      }
   }

   this.onFiguresChange = function()
   {
    dialog.btnSelectiveRejection.enabled = data.numObjects() > 0;
   }

   // window

   this.windowTitle = TITLE + " " + VERSION;

   Console.writeln(this.windowTitle);

   this.adjustToContents();

   if (settings.importAllways)
      loadMaskFromView( this.view, data, this, settings );

   data.setObjectType( 0 );
}



function createMask(data, view, id, settings, gradientMask, lightMask, plainMask, brightMask, starMask, gradientedgeMask)
{
   //
   // create mask(s) with id from main view
   //
   var createdMasks = [];
   var strObjects = data.objectsToString();
   var zoom = view.window.zoomFactor;
   var maskCount = 0;
   if (gradientMask) maskCount += 1;
   if (gradientedgeMask) maskCount += 1;
   if (lightMask) maskCount += 1;
   if (plainMask) maskCount += 1;
   if (brightMask) maskCount += 1;
   if (starMask) maskCount += 1;
   var dialog = data.caller;
   dialog.progress =  0;
   dialog.progressBar.repaint();

   if (data.numObjects() == 0)
      return !ask("No mask produced or no mask style selected. Continue editing?",
                  "", StdButton_Yes);
   else
   {
      maskCount -= 1;

      var mask = data.getMaskView ();
      Console.writeln('Mask view id = ' + mask.id);

      createdMasks.push(view.id);
      //
      // create lum mask by mask - CIE XYZ (Y)
      //
      if (lightMask)
      {
         var starMaskName = getNewName(id, "_lum");
         var sMask = copyView(mask, starMaskName);
         if (sMask != null)
         {
            var temp = getNewName(id, "cieY");
            var cieY = extractCIEY( view, temp);
            if (cieY != null)
            {
               subView(sMask, cieY);
               createdMasks.push(sMask.id);
               cieY.window.forceClose();
               nextProgress(dialog, maskCount);
            }
         }
      }
      //
      // Binary Mask + Covolution (to blur the edge)
      //
      var pMaskName2 = getNewName(id, "_bin_gradientedge");
      if (gradientedgeMask)
      {
         var pMask2 = copyView(mask, pMaskName2);
         if (pMask2 != null)
         {
            setPixelZeroes(pMask2);
            pMask2 = GradientEdge(pMask2,pMaskName2);
            createdMasks.push(pMask2.id);
            nextProgress(dialog, maskCount);
         }
      }
      //
      //
      //
      var pMaskName = getNewName(id, "_bin");
      if (plainMask)
      {
         var pMask = copyView(mask, pMaskName);
         if (pMask != null)
         {
            setPixelZeroes(pMask);
            createdMasks.push(pMask.id);
            nextProgress(dialog, maskCount);
         }
      }
      //
      // brightMask
      //
      if (brightMask)
      {
         var nn = getNewName(id, "_nn");
         var bid = getNewName(id, "_bm");
         var viewCopy = copyViewNewName(view);
         var mMask    = multMaskedMask(viewCopy, mask, nn);
         viewCopy.window.forceClose();
         var multMask = extractLuminance(mMask, bid);
         nullOp(multMask);
         createdMasks.push(multMask.id);
         mMask.window.forceClose();
         nextProgress(dialog, maskCount);
      }
      //
      //
      //
      if (starMask)
      {
         //
         // merge a starmask with mask || plainmask ???
         //
         var tempName = getNewName(id, "_temp");
         var tempMask = copyView(view, tempName);
         Advanced_process_star_mask(tempMask);
         var sid = getNewName(id, "_sm");
         var smMask;
         if (view.image.isColor)
            smMask = extractLuminance(tempMask, sid);
         else
            smMask = copyView(view, sid);
         multInverted(smMask, mask);
         createdMasks.push(smMask.id);
         tempMask.window.forceClose();
         nextProgress(dialog, maskCount);
      }
      //
      // show masks
      //
      if (gradientMask)
      {
         createdMasks.push(mask.id);
      }
      else
      {
         mask.window.forceClose();
      }

      Console.writeln();
      for (var i = 0; i < createdMasks.length; i++)
         Console.writeln('\tcollected mask ' + createdMasks[i]);

      for (var i = 0; i < createdMasks.length; i++)
         {
            var v = View.viewById( createdMasks[i] );
            Console.writeln('\nfinish mask ' + v.id);
            saveProperties(v, strObjects, settings);
            v.window.zoomFactor = zoom;
            v.window.fitWindow();
            v.window.show();
         }
      //
      // final comment
      //
      Console.writeln("DONE, if you see the mask :-)");
      delay(1000);
      return true;
   }
}

function nextProgress(dialog, maxCount)
{
   dialog.progress += 100 / maxCount;
   dialog.progressBar.repaint();
   delay(100);
   processEvents();
}

// *****************************************************************************
// *****************************************************************************
// *****************************************************************************
// *****************************************************************************

function ellipsoid(x, y, a, b, pa, caller)
{
   this.x     =  x;     // origin x
   this.y     =  y;     // origin y
   this.a     =  a;     // 1st axis radius
   this.b     =  b;     // 2nd axis radius
   this.pa    =  pa;    // position angle in radians

   this.sp    = -1;     // index of selected point or axis {0 = center, 1 = a, 2 = b}
   this.sina  =  0;
   this.cosa  =  0;
   this.sinb  =  0;
   this.cosb  =  0;

   this.p11    = new Point(this.a, 0);    // axis 1
   this.p12    = new Point(-this.a, 0);
   this.p21    = new Point(0, this.b);    // axis 2
   this.p22    = new Point(0, -this.b);

   this.selected = true;

   var settings = null;

   this.caller = caller;

   this.timeStamp = Date.now();

   update(this);

   this.setSettings = function(settingsObj)
   {
      settings = settingsObj;
   }
   //
   // object methods
   //
   this.getStringObject = function()
   {
      return {figure:'ellipse', data:{x:this.x, y:this.y, a:this.a, b:this.b, pa:this.pa}}
   }

   this.getPoint = function( index )
   {
      // index = 0, center
      // index = 1, p1 (axis1)
      // index = 2, p2 (axis1)
      // index = 3, p1 (axis2)
      // index = 4, p2 (axis2)
      switch (index)
      {
         case 0:
            return new Point(this.x, this.y);
         case 1:
            return new Point(this.x + this.p11.x, this.y + this.p11.y);
         case 2:
            return new Point(this.x + this.p12.x, this.y + this.p12.y);
         case 3:
            return new Point(this.x + this.p21.x, this.y + this.p21.y);
         case 4:
            return new Point(this.x + this.p22.x, this.y + this.p22.y);
      }
      return new Point();
   }

   this.getPoints = function ()
   {
      return [new Point(this.x, this.y),
              new Point(this.x + this.p11.x, this.y + this.p11.y),
              new Point(this.x + this.p12.x, this.y + this.p12.y),
              new Point(this.x + this.p21.x, this.y + this.p21.y),
              new Point(this.x + this.p22.x, this.y + this.p22.y)];
   }


   this.movePoint = function(p)
   {
      if (this.sp < 0) return;
      if (this.sp == 0)
      {
         //
         // move center
         //
         this.x = p.x;
         this.y = p.y;
         callBack(this);
         return;
      }

      var u = p.x - this.x;
      var v = p.y - this.y;

      if (this.sp == 1)
      {
         //
         // move axis 1 point, calc pa
         //
         this.pa = positionAngle(u, v, 0, 0);
         this.a  = Math.sqrt(u * u + v * v);
      }
      else if (this.sp == 2)
      {
         //
         // move axis 2 point, calc pa
         //
         var a = positionAngle(u, v, 0, 0);
         this.pa = a - Math.PI2;
         this.b  = Math.sqrt(u * u + v * v);
      }
      update(this);
   }

   function update(obj)
   {
      obj.sina = Math.sin(obj.pa);
      obj.cosa = Math.cos(obj.pa);
      obj.sinb = Math.sin(obj.pa + Math.PI2);
      obj.cosb = Math.cos(obj.pa + Math.PI2);
      obj.p11  = new Point(obj.a * obj.cosa, obj.a * obj.sina);
      obj.p12  = new Point(-obj.p11.x, -obj.p11.y);
      obj.p21  = new Point(obj.b * obj.cosb, obj.b * obj.sinb);
      obj.p22  = new Point(-obj.p21.x, -obj.p21.y);
      callBack(obj);
   }

   function positionAngle(x1, y1, x2, y2)
   {
      return Math.atan2(y1 - y2, x1 - x2);
   }

   this.findSelect = function(x, y)
   {
      //
      // check next point to x, y (input screen absolut coordinates)
      // and set point or axis
      //
      this.sp = -1;
      if (this.pointDist(x, y, this.x, this.y))
      {
         //
         // center is absolute point
         //
         this.sp = 0;
         this.selected = true;
         callBack(this);
         return true;
      }

      var u = x - this.x;
      var v = y - this.y;

      if (this.pointDist(u, v, this.p11.x, this.p11.y))
         this.sp = 1;   // axis 1
      else if (this.pointDist(u, v, this.p12.x, this.p12.y))
         this.sp = 1;   // axis 1
      else if (this.pointDist(u, v, this.p21.x, this.p21.y))
         this.sp = 2;   // axis 1
      else if (this.pointDist(u, v, this.p22.x, this.p22.y))
         this.sp = 2;   // axis 1
      if (this.sp > -1)
      {
         this.selected = true;
         callBack(this);
         return true;
      }
      else
         return false;
   }

   this.pointDist = function (x1, y1, x2, y2)
   {
      // is p near x, y ?
      var dx2 = Math.pow(x1 - x2, 2);
      var dy2 = Math.pow(y1 - y2, 2);
      var d   = Math.sqrt(dx2 + dy2);
      return d <= markerSize + markerSize;
   }

   this.getRect = function()
   {
      return new Rect(-this.a, -this.b, this.a, this.b);
   }


   this.setX = function (x)
   {
      this.x = x;
      update(this);
   }

   this.setY = function (y)
   {
      this.y = y;
      update(this);
   }

   this.setA = function (a)
   {
      this.a = a;
      this.polygon = [];
      update(this);
   }

   this.setB = function (b)
   {
      this.b = b;
      this.polygon = [];
      update(this);
   }

   this.setPa = function (angleDegrees)
   {
      this.pa = angleDegrees * Math.RAD;
      this.polygon = [];
      update(this);
   }

   this.getPa = function ()
   {
      return this.pa * Math.DEG;
   }

   function callBack(e)
   {
     if (e.caller != null) e.caller.onEllipsoidChange(e);
   }

   this.draw = function (g)
   {
      if (settings == null) return;
      var radius = settings.apDiameter / 2;
      var lineColor;
      var lineStyle = PenStyle_Solid;
      if (!settings.afLineStyle) lineStyle = PenStyle_Dash;
      var centerColor;
      if (this.selected)
      {
         lineColor   = settings.afLineColor;
         centerColor = settings.cpColor;
      }
      else
      {
         lineColor   = Transparent(settings.afLineColor, 0.5);
         centerColor = Transparent(settings.cpColor, 0.5);
      }
      g.pen = new Pen( lineColor, 0, lineStyle );

      var m = g.transformationMatrix;

      var points = this.getPoints();
      var rot = this.pa;
      if (rot > 0) rot -= Math.PI;

      g.translateTransformation(points[0]);
      g.rotateTransformation(-rot);
      g.drawEllipse(this.getRect());
      g.resetTransformation();
      g.transformationMatrix = m;
      g.drawLine(points[1], points[2]);
      g.drawLine(points[3], points[4]);

      for (var i = 1; i < points.length; i++)
      {
         if (settings.apFilled)
            g.fillCircle(points[i], radius, new Brush(g.pen.color));
         else
            g.drawCircle(points[i], radius);
      }
      //
      // center point
      //
      radius = settings.cpDiameter / 2;
      g.pen = new Pen( centerColor );

      if (settings.cpStyle)
      {
         if (settings.cpFilled)
            g.fillRect(this.x - radius, this.y - radius, this.x + radius, this.y + radius, new Brush(g.pen.color));
         else
            g.drawRect(this.x - radius, this.y - radius, this.x + radius, this.y + radius);
      }
      else
      {
         if (settings.cpFilled)
            g.fillCircle(new Point(this.x, this.y), radius, new Brush(g.pen.color));
         else
            g.drawCircle(new Point(this.x, this.y), radius);
      }
   }

   this.fill = function (graphics)
   {
      var rot = this.pa;
      if (rot > 0) rot -= Math.PI;
      graphics.translateTransformation(points[0]);
      graphics.rotateTransformation(-rot);
      graphics.drawEllipse(this.getRect());
      graphics.resetTransformation();
   }
}

function toView(p, offset)
{
   return new Point(p.x - offset.x, p.y - offset.y);
}

function toImage(p, offset)
{
   return new Point(p.x + offset.x, p.y + offset.y);
}

// *****************************************************************************
// *****************************************************************************
// *****************************************************************************
// *****************************************************************************

function multiPointFigure(imageBounds, caller)
{
   var ffBounds  = null;
   var bounds    = imageBounds;
   var pIndex    = -3;                 // -3 = no point selected,
                                       // -2 = gradientCenter
                                       // -1 = centroid
                                       // 0..n is index to any point of figure
   var undoIndex = -1;
   var undoPoint = null;
   var gcLocked  = true;            // gradient center locked to centroid
   var unlockDisabled = false;

   this.polygon = [];
   this.points  = [];
   this.gradientCenter = null;      //

   this.selected  = true;            // this object selected for modifications

   var settings = null;

   this.setSettings = function(settingsObj)
   {
      settings = settingsObj;
   }
   //
   // object methods
   //
   this.getStringObject = function()
   {
      var pointsArray = [];
      for (var i = 0; i < this.points.length; i++) pointsArray.push(this.points[i].toArray());
      var gc;
      if (this.gradientCenter == null)
         gc = [this.centroid.x, this.centroid.y];
      else
         gc = [this.gradientCenter.x, this.gradientCenter.y];

      return {figure:'multipoint', data:{centroid: this.centroid.toArray(),
              points:pointsArray, bezier:settings.bezier, gradientCenter:gc}}
   }

   this.SetGradientCenter = function (point)
   {
      this.gradientCenter = point;
      gcLocked = distanceSq(this.centroid, this.gradientCenter) <= r2;
   }

   this.add = function (point)
   {
      if (pIndex == -1)             // mouse over centroid
      {
         this.selected = true;      // set selection true
         return;
      }

      if (pIndex == -2)             // mouse over gradient center
      {
         this.selected = true;      // set selection true
         return;
      }

      if (this.points.length == 0)
      {
         this.points.push(point);
      }
      else
      {
         //
         // check, if point is in between 2 other points
         //
         var minDist = Number.MAX_VALUE;
         var minPointIndex = -1;          // index to points array
         var minPointValue = null;        // a point from the interpolated curve

         for (var i = 0; i < this.points.length; i++)
         {
            var j = i + 1;
            if (j == this.points.length) j = 0;
            if (j == i) break;

            // line i -> j

            if (this.points.length > 2 && settings.bezier)
            {
               //
               // check point along the curve
               //
               var ip = pointsToCurve(this.points, i, smooth_value);

               for (var k = 0; k < ip.length; k++)
               {
                  var dist = point.distanceTo(ip[k]);
                  if (dist < minDist)
                  {
                     minDist = dist;
                     minPointIndex = i;
                     minPointValue = ip[k];
                  }
               }
               if (minDist < 12) break;
            }
            else
            {
               if (isPointNear(point, this.points[i], this.points[j], 12))
               {
                  minPointIndex = i;
                  minPointValue = point;
                  break;
               }
               else
               {
               }
            }
         }
         if (minPointIndex < 0)
         {
            minPointIndex = this.points.length;
            minPointValue = point;
         }
         this.points = addPointAtIndex(minPointValue, this.points, minPointIndex);
      }

      ffBounds = setBounds(this.points, bounds);

      if (this.points.length > 2)
      {
         // create curve
         if (settings.bezier)
            this.polygon = bezierInterpolate(this.points, smooth_value);
         else
            this.polygon = [];
      }

      this.centroid = findCentroid(this.points);

      if (gcLocked) this.gradientCenter = new Point(this.centroid);

      caller.onFiguresChange();
   }

   this.setPoint = function (point)
   {
      this.points.push(point);
      pIndex  = this.points.length - 1;

      ffBounds = setBounds(this.points, bounds);

      if (this.points.length > 2)
      {
         // create curve
         if (settings.bezier)
            this.polygon = bezierInterpolate(this.points, smooth_value);
         else
            this.polygon = [];
      }

      this.centroid = findCentroid(this.points);

      if (gcLocked) this.gradientCenter = new Point(this.centroid);
   }

   this.remove = function (point)
   {
      if (!this.selected) return;
      var list = [];
      for (var i = 0; i < this.points.length; i++)
         if (!this.points[i].isEqualTo(point)) list.push(this.points[i]);
      this.points = list;
      if (settings.bezier)
         this.polygon = bezierInterpolate(this.points, smooth_value);
      else
         this.polygon = [];

      this.centroid = findCentroid(this.points);

      if (gcLocked) this.gradientCenter = new Point(this.centroid);

      caller.onFiguresChange();
   }

   this.removeSelectedPoint = function (point)
   {
      if (!this.selected) return;
      if (pIndex > -1) //current > -1)
      {
         undoIndex = pIndex;
         undoPoint = this.points[pIndex]
         this.remove(undoPoint);//this.points[pIndex]);
      }
   }

   this.selectPoint = function (point)
   {
      unlockDisabled = false;
      var r2 = Math.pow(settings.apDiameter, 2);

      if (point == null)
      {
         pIndex  = -3;
         return false;
      }

      if (this.selected)
      {
         for (var i = 0; i < this.points.length; i++)
         {
            if (distanceSq(this.points[i], point) <= r2)
            {
               pIndex  = i;
               return true;
            }
         }
      }

      if (this.centroid != null && distanceSq(this.centroid, point) <= r2)
      {
         pIndex  = -1;  // centroid
         return true;
      }

      if (this.gradientCenter != null && distanceSq(this.gradientCenter, point) <= r2)
      {
         pIndex  = -2;  // gradientCenter
         return true;
      }

      pIndex  = -3;  // no point selected
      return false;
   }


   this.selectGradientCenter = function (point)
   {
      if (unlockDisabled) return false;
      if (point == null)
      {
         return false;
      }

      var r2 = Math.pow(settings.apDiameter, 2);

      if (this.gradientCenter != null && distanceSq(this.gradientCenter, point) <= r2)
      {
         this.unlockGradientCenter(this.centroid);
         return true;
      }
      return false;
   }


   this.selectedPoint = function ()
   {
      return pIndex > -1;
   }

   this.centroidSelected = function ()
   {
      return pIndex == -1;
   }

   this.gradientSelected = function ()
   {
      return pIndex == -2;
   }

   this.moveTo = function (p)
   {
      if (!this.selected || pIndex < -1) return;
      if (pIndex < 0)
      {
         var dx = p.x - this.centroid.x;
         var dy = p.y - this.centroid.y;
         for (var i = 0; i < this.points.length; i++) this.points[i].moveBy(dx, dy);
         this.centroid = p;
         this.gradientCenter.moveBy(dx, dy);

         if (gcLocked) this.gradientCenter = new Point(this.centroid);
      }
      else
      {
         var dx = p.x - this.points[pIndex].x;
         var dy = p.y - this.points[pIndex].y;
         this.points[pIndex].moveBy(dx, dy);
         this.centroid = findCentroid(this.points);

         if (gcLocked) this.gradientCenter = new Point(this.centroid);
      }
      if (settings.bezier)
         this.polygon = bezierInterpolate(this.points, smooth_value);
      else
         this.polygon = [];
      ffBounds = setBounds(this.points, bounds);
   }

   this.moveGradientCenterTo = function (p)
   {
      var r2 = Math.pow(settings.apDiameter, 2);

      if (distanceSq(p, this.centroid) <= r2)
      {
         gcLocked = true;
         this.gradientCenter = this.centroid;
         return;
      }
      this.gradientCenter = p;
   }

   this.clear = function ()
   {
      if (!this.selected) return;
      this.points  = [];
      this.polygon = [];
      this.centroid = null;
      ffBounds = bounds;
      pIndex  = -3;
   }

   this.lockGradientCenter = function (point)
   {
      gcLocked = true;
      unlockDisabled = true;
      var r2 = Math.pow(settings.apDiameter, 2);

      if (this.centroid == null)
      {
         this.gradientCenter = null;
      }
      else if (distanceSq(this.centroid, point) <= r2 ||
               distanceSq(this.gradientCenter, point) <= r2)
      {
         this.gradientCenter = new Point(this.centroid);
      }
   }

   this.unlockGradientCenter = function (point)
   {
      gcLocked = false;
      //unlockDisabled = false;
   }

   function addPointAtIndex(point, points, index)
   {
      // append or insert after index
      var j = index + 1;
      if (j == points.length) j = 0;
      if (index == points.length)
      {
         var list = [];
         for (var k = 0; k < points.length; k++) list.push(points[k]);
         list.push(point);
         pIndex  = list.length - 1;
         return list;
      }
      else if (j == 0)
      {
         var list = [];
         list.push(point);
         for (var k = 0; k < points.length; k++) list.push(points[k]);
         return list;
      }
      else
      {
         var list = [];
         for (var k = 0; k < (index + 1); k++) list.push(points[k]);
         list.push(point);
         pIndex  = list.length - 1;
         for (var k = j; k < points.length; k++) list.push(points[k]);
         return list;
      }
   }

   this.draw = function (graphics)
   {
      with (graphics)
      {
         var radius = settings.apDiameter / 2;
         var lineColor;
         var lineStyle = PenStyle_Solid;
         if (!settings.afLineStyle) lineStyle = PenStyle_Dash;
         var centerColor;
         var gradientCenterColor;
         if (this.selected)
         {
            lineColor   = settings.afLineColor;
            centerColor = settings.cpColor;
            gradientCenterColor = settings.gpColor;
         }
         else
         {
            lineColor   = Transparent(settings.afLineColor, 0.5);
            centerColor = Transparent(settings.cpColor, 0.5);
            gradientCenterColor = Transparent(settings.gpColor, 0.5);
         }
         //
         // Bezier curve
         //
         //if (this.selected)
         //{
            //
            // polygon
            //
            if (settings.bezier && this.polygon.length > 2)
            {
               var color = Transparent(0xffffffff, settings.transparency);
               fillPolygon(this.polygon, 0, new Brush(color));
            }
            //
            // + anker points
            //
            if (this.points.length > 0)
            {
               pen = new Pen( lineColor, 0, lineStyle );
               if (settings.bezier)
               {
                  drawPolygon(this.polygon);
                  pen = new Pen(0xe0ffffff, 0);
                  drawPolygon(this.points);
               }
               else
                  drawPolygon(this.points);

               pen = new Pen(lineColor, 1);           // intermediate points
               for (var i = 0; i < this.points.length; i++)
               {
                  var p = this.points[i];
                  var x = p.x;
                  var y = p.y;

                  if (settings.apFilled)
                     fillCircle(x, y, radius, new Brush(pen.color));
                  else
                     drawCircle(x, y, radius);
               }
            }
            //
            // centroid
            //
            if (this.centroid != null)
            {
               //
               //  gradient center point (initially below center point)
               //
               var gx = this.gradientCenter.x;
               var gy = this.gradientCenter.y;

               pen = new Pen( gradientCenterColor );
               radius = settings.gpDiameter / 2;

               if (settings.gpStyle)
               {
                  //
                  // triangle
                  //
                  var tri = [];
                  tri.push(new Point(gx, gy - radius));
                  tri.push(new Point(gx - radius, gy + radius));
                  tri.push(new Point(gx + radius, gy + radius));

                  if (settings.gpFilled)
                     fillPolygon(tri, 0, new Brush(pen.color));
                  else
                     drawPolygon(tri, radius);
               }
               else
               {
                  //
                  // circle
                  //
                  if (settings.gpFilled)
                     fillCircle(this.gradientCenter, radius, new Brush(pen.color));
                  else
                     drawCircle(this.gradientCenter, radius);
                  var z = settings.apDiameter * 0.75;
                  drawLine(gx - z, gy, gx + z, gy);
                  drawLine(gx, gy - z, gx, gy + z);
               }
               //
               // draw centroid
               //
               radius = settings.cpDiameter / 2;
               gx = this.centroid.x;
               gy = this.centroid.y;

               pen = new Pen( centerColor );

               if (settings.cpStyle)
               {
                  if (settings.cpFilled)
                     fillRect(gx - radius, gy - radius, gx + radius, gy + radius, new Brush(pen.color));
                  else
                     drawRect(gx - radius, gy - radius, gx + radius, gy + radius);
               }
               else
               {
                  if (settings.cpFilled)
                     fillCircle(this.centroid, radius, new Brush(pen.color));
                  else
                     drawCircle(this.centroid, radius);
               }
            }
 /*        }
         else     // not selected
         {
            pen = new Pen(lineColor);
            if (settings.bezier)
            {
               if (this.polygon.length > 2) drawPolygon(this.polygon);
            }
            else
            {
               if (this.points.length > 1) drawPolygon(this.points);
            }
            //
            //  gradient center point
            //
            var gx = this.gradientCenter.x;
            var gy = this.gradientCenter.y;

            pen = new Pen( centerColor );

            if (settings.gpStyle)
            {
               //
               // triangle
               //
               var tri = [];
               tri.push(new Point(gx, gy - radius));
               tri.push(new Point(gx - radius, gy + radius));
               tri.push(new Point(gx + radius, gy + radius));

               if (settings.gpFilled)
                  fillPolygon(tri, 0, new Brush(pen.color));
               else
                  drawPolygon(tri, radius);
            }
            else
            {
               //
               // circle
               //
               if (settings.gpFilled)
                  fillCircle(gx - radius, gy - radius, gx + radius, gy + radius, new Brush(pen.color));
               else
                  drawRect(gx - radius, gy - radius, gx + radius, gy + radius);
               var z = settings.apDiameter * 0.75;
               drawLine(gx - z, gy, gx + z, gy);
               drawLine(gx, gy - z, gx, gy + z);
            }
            //
            // centroid
            //
            if (this.centroid != null)
            {
               radius = settings.cpDiameter / 2;
               var cx = this.centroid.x;
               var cy = this.centroid.y;

               pen = new Pen(settings.gpColor, 2);

               if (settings.apFilled)
                  fillCircle(cx, cy, radius, new Brush(pen.color));
               else
                  drawCircle(cx, cy, radius);

               drawLine(cx - 2 * radius, cy,
                        cx + 2 * radius, cy);
               drawLine(cx, cy - 2 * radius,
                        cx, cy + 2 * radius);
            }
         }
*/
         if (this.gradientCenter != null)
         {
            //
            // finally circle around gravitation center
            //
            var r = 0;
            for (var i = 0; i < this.points.length; i++)
            {
               var d = this.gradientCenter.distanceTo(this.points[i]);
               r = Math.max(r, d);
            }
            pen = new Pen(0xa0f0f0f0);
            drawCircle(this.gradientCenter, r);
         }
      }
   }

   this.fill = function (graphics)
   {
      if (settings.bezier)
      {
         if (this.polygon.length > 2)
         {
            graphics.fillPolygon(this.polygon, 0, new Brush(0xffffffff));
         }
      }
      else
      {
         if (this.points.length > 1) graphics.fillPolygon(this.points, 0, new Brush(0xffffffff));
      }
   }

   this.fillGradient = function (img)
   {
      img.selectedChannel = 0;
      var cp = this.gradientCenter;
      var w  = img.width;
      //var fpa = new Float32Array(img.numberOfPixels );
      var vec = new Float32Array(img.numberOfPixels ); // test replacement for new Vector(fpa);
      img.getSamples(vec);

      var sImg = new Image(img.width, img.height);

      var sBmp = new Bitmap (img.width, img.height);

      var g = new Graphics (sBmp);

      this.fill (g);

      g.end();

      sImg.blend (sBmp);

      // var zpa = new Float32Array(sImg.numberOfPixels);
      var zVec = []; // new Vector(zpa);
      sImg.getSamples(zVec);

      var radius = settings.apDiameter / 2;
      var maxDist = Math.sqrt(Math.pow(ffBounds.width - 2 * radius, 2) +
                              Math.pow(ffBounds.height - 2 * radius, 2)) / 2;
      var grad = 1 / maxDist;

      for (var y = 0; y < sImg.height; y ++)
      {
         for (var x = 0; x < sImg.width; x ++)
         {
            var n    = y * w + x;
            var z    = zVec [n];    //.at(n);
            if (z > 0)
            {
               var dist = cp.distanceTo(x, y);
               var pixv = 1 - (dist * grad);
               if (pixv < 0) pixv = 0;
               if (pixv > 1) pixv = 1;
               //vec.at(n, pixv);
               vec[n] = pixv;       // replaced the statement before
            }
         }
      }

      img.setSamples(vec);
   }

   // internal functions

   function setBounds(points, bounds)
   {
      if (points.length == 0)
         return bounds;
      else
      {
         var xMin = Number.MAX_VALUE;
         var yMin = Number.MAX_VALUE;
         var xMax = Number.MIN_VALUE;
         var yMax = Number.MIN_VALUE;
         for (var i = 0; i < points.length; i++)
         {
            var p = points[i];
            if (p.x < xMin) xMin = p.x;
            if (p.x > xMax) xMax = p.x;
            if (p.y < yMin) yMin = p.y;
            if (p.y > yMax) yMax = p.y;
         }
         var radius = settings.apDiameter / 2;
         return new Rect(xMin - radius, yMin - radius,
                             xMax + radius, yMax + radius);
      }
   }

   function setPoints(points)
   {
      this.points = [];
      for (var i = 0; i < points.lenght; i++) this.points.push(points[i]);
   }

   function bezierInterpolate(points, smooth)
   {
      var polygon = [];
      if (points.length < 3) return polygon;
      for (var i = 0; i < points.length; i++)
      {
         var ip = pointsToCurve(points, i, smooth);
         for (var n = 0; n < ip.length; n++) polygon.push(ip[n]);
      }
      return polygon;
   }

   function pointsToCurve(points, i, smooth)
   {
      var j = i + 1;
      if (j == points.length) j = 0;

      var u = i - 1;
      var v = j + 1;

      if (u < 0) u = points.length - 1;
      if (v == points.length) v = 0;

      // get anker points between points i & j

      var cp = controlPoints(points[u], points[i], points[j], points[v], smooth);
      var steps = Math.floor(distance(points[i], points[j])) * 2;

      var ip = curvePoints( points[i], cp[0], cp[1], points[j], steps);
      return ip;     // back interpolated points
   }

   function isPointNear(p, a, b, threshold)
   {
      var d = getDistance(p, a, b);
      if (d <= threshold)
      {
         var c = distanceSq(a, b);
         if (distanceSq(p, a) <= c && distanceSq(p, b) <= c) return true;
      }
      return false;
   }

   function getDistance(a, r1, r2)
   {
      if(r1.x==r2.x&&r1.y==r2.y){
        	return Number.NaN;	//oder Distance von r1 bzw r2 zu a
        }

		var m1= (r2.y -r1.y)/(r2.x -r1.x);
      var b1 = r1.y-(m1*r1.x);

      if(m1==0.0){
         return Math.abs(b1-a.y);
      }

      if(m1 == Number.NaN){
         return Math.abs(r1.x-a.x);
      }

      var m2=-1.0/m1;
      var b2 = a.y-(m2*a.x);

      var xs=(b2-b1)/(m1-m2);
      var ys=m1*xs+b1;

      var c1=a.x-xs;
      var c2=a.y-ys;

      var dist = Math.sqrt(c1*c1+c2*c2);
      return dist;
   }

   function getSquaredDistance( a, r1, r2)
   {
     // Normalisierte Richtung r1 --> r2 ausrechnen
     var dx = r2.x - r1.x;
     var dy = r2.y - r1.y;
     var len = Math.sqrt(dx*dx+dy*dy);
     dx /= len;
     dy /= len;

     var dax = a.x - r1.x;
     var day = a.y - r1.y;

     var dot = dax * dx + day * dy;
     var px = r1.x + dx * dot;
     var py = r1.y + dy * dot;

     var ddx = a.x-px;
     var ddy = a.y-py;
     var squaredDistance = ddx * ddx + ddy * ddy;
     return squaredDistance;
   }

   function distance(a, b)
   {
      return Math.sqrt(distanceSq(a, b));
   }

   function distanceSq(a, b)
   {
      return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
   }

   // ========================================================================
   //   BezierCurve functions
   // ========================================================================

   function controlPoints(p0, p1, p2, p3, smooth)
   {
      // calculate the control points between p1 (x1,y1) and p2 (x2,y2).
      // Then x0,y0 - the previous vertex,
      //      x3,y3 - the next one.

      var x0 = p0.x;
      var y0 = p0.y;

      var x1 = p1.x;
      var y1 = p1.y;

      var x2 = p2.x;
      var y2 = p2.y;

      var x3 = p3.x;
      var y3 = p3.y;

      var xc1 = (x0 + x1) / 2.0;
      var yc1 = (y0 + y1) / 2.0;
      var xc2 = (x1 + x2) / 2.0;
      var yc2 = (y1 + y2) / 2.0;
      var xc3 = (x2 + x3) / 2.0;
      var yc3 = (y2 + y3) / 2.0;

      var len1 = Math.sqrt((x1-x0) * (x1-x0) + (y1-y0) * (y1-y0));
      var len2 = Math.sqrt((x2-x1) * (x2-x1) + (y2-y1) * (y2-y1));
      var len3 = Math.sqrt((x3-x2) * (x3-x2) + (y3-y2) * (y3-y2));

      var k1 = len1 / (len1 + len2);
      var k2 = len2 / (len2 + len3);

      var xm1 = xc1 + (xc2 - xc1) * k1;
      var ym1 = yc1 + (yc2 - yc1) * k1;

      var xm2 = xc2 + (xc3 - xc2) * k2;
      var ym2 = yc2 + (yc3 - yc2) * k2;

      var ctrl1_x = xm1 + (xc2 - xm1) * smooth + x1 - xm1;
      var ctrl1_y = ym1 + (yc2 - ym1) * smooth + y1 - ym1;

      var ctrl2_x = xm2 + (xc2 - xm2) * smooth + x2 - xm2;
      var ctrl2_y = ym2 + (yc2 - ym2) * smooth + y2 - ym2;

      return [new Point(ctrl1_x, ctrl1_y), new Point(ctrl2_x, ctrl2_y)];
   }

   function curvePoints(a1,   //Anchor1
                        c1,   //Control1
                        c2,   //Control2
                        a2,   //Anchor2
                        num_steps)
   {
      var x1  = a1.x;
      var y1  = a1.y;
      var x2  = c1.x;
      var y2  = c1.y;
      var x3  = c2.x;
      var y3  = c2.y;
      var x4  = a2.x;
      var y4  = a2.y;
      var dx1 = x2 - x1;
      var dy1 = y2 - y1;
      var dx2 = x3 - x2;
      var dy2 = y3 - y2;
      var dx3 = x4 - x3;
      var dy3 = y4 - y3;

      var subdiv_step  = 1.0 / (num_steps + 1);
      var subdiv_step2 = subdiv_step*subdiv_step;
      var subdiv_step3 = subdiv_step*subdiv_step*subdiv_step;

      var pre1 = 3.0 * subdiv_step;
      var pre2 = 3.0 * subdiv_step2;
      var pre4 = 6.0 * subdiv_step2;
      var pre5 = 6.0 * subdiv_step3;

      var tmp1x = x1 - x2 * 2.0 + x3;
      var tmp1y = y1 - y2 * 2.0 + y3;

      var tmp2x = (x2 - x3)*3.0 - x1 + x4;
      var tmp2y = (y2 - y3)*3.0 - y1 + y4;

      var fx = x1;
      var fy = y1;

      var dfx = (x2 - x1)*pre1 + tmp1x*pre2 + tmp2x*subdiv_step3;
      var dfy = (y2 - y1)*pre1 + tmp1y*pre2 + tmp2y*subdiv_step3;

      var ddfx = tmp1x*pre4 + tmp2x*pre5;
      var ddfy = tmp1y*pre4 + tmp2y*pre5;

      var dddfx = tmp2x*pre5;
      var dddfy = tmp2y*pre5;

      var step = num_steps

      var p = [];
      while (step--)
      {
        fx   += dfx;
        fy   += dfy;
        dfx  += ddfx;
        dfy  += ddfy;
        ddfx += dddfx;
        ddfy += dddfy;
        p.push(new Point(fx, fy));
      }
      p.push(new Point(x4, y4));
      return p;
   }

   function findCentroid(points)
   {
      if (points.length == 0) return new Point();
      var x = 0;
      var y = 0;
      for (var i = 0; i < points.length; i++)
      {
         x += points[i].x;
         y += points[i].y;
      }
      return new Point(x / points.length, y / points.length);
   }


   function getPixelCoordinates(p0, p1)
   {
      /*
      input:   start point p0
               end point   p1

      return:  array of points
      */
      var x0 = Math.floor(p0.x);
      var y0 = Math.floor(p0.y);
      var x1 = Math.floor(p1.x);
      var y1 = Math.floor(p1.y);

      var points = [];
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
         for (var y = y0; y < y1 ; y++) points.push(new Point(x0, y));
         return points;
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
         for (var x = x0; x < x1; x++) points.push(new Point(x, y0));
         return points;
      }
      else
      {
         // **************************************
         // Bresenham's line algorithm implemented
         //
         // **************************************
         var dx  = Math.abs(x1-x0);
         var dy  = Math.abs(y1-y0);
         var sx  = (x0 < x1) ? 1 : -1;
         var sy  = (y0 < y1) ? 1 : -1;
         var err = dx - dy;
         var x   = x0;
         var y   = y0;

         while(true)
         {
            points.push(new Point(x, y));
            if ((x == x1) && (y == y1)) break; // ready
            var e2 = 2 * err;
            if (e2 > -dy){ err -= dy; x  += sx; }
            if (e2 <  dx){ err += dx; y  += sy; }
         }
         return points;
      }
   }

}


// Helper functions

function getNewName(name, suffix)
{
   var newName = name + suffix;
   let n = 1;
   while (!ImageWindow.windowById(newName).isNull)
   {
      ++n;
      newName = name + suffix + n;
   }
   return newName;
}



function mergeMask(targetMask, tmp)
{
   //
   // make targetMask = max(targetMask , tmp)
   //
   var P = new PixelMath;
   P.expression = "X = x();Y = y();max(pixel($T, X, Y), pixel("
                  + tmp.id + ", X, Y));";
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "X,Y";
   P.generateOutput = true;
   P.singleThreaded = false;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   P.showNewImage = true;
   P.newImageId = "";
   P.newImageWidth = 256;
   P.newImageHeight = 256;
   P.newImageAlpha = false;
   P.newImageColorSpace = PixelMath.prototype.Gray;
   P.newImageSampleFormat = PixelMath.prototype.f32;
   if (!P.executeOn(targetMask))
   {
      message("Mask creation failed in function mergeMask", "Error");
      return false;
   }
      return true;
}

function ellipsoidView(view, e)
{
   //
   // return a mask with one ellipsoid on
   //
   var img = ellipsoidImage(view, e);
   var mask = maskView(view, view.id);
   mask.beginProcess(UndoFlag_NoSwapFile);
   mask.image.assign( img );
   mask.endProcess();
   return mask;
}

function ellipsoidImage(view, e)
{
   // pls. see:
   // https://math.stackexchange.com/questions/91132/how-to-get-the-limits-of-rotated-ellipse
   //
   var c  = Math.cos(e.pa);
   var s  = Math.sin(e.pa);
   var c2 = c * c;
   var s2 = s * s;
   var a2 = e.a * e.a;
   var b2 = e.b * e.b;
   var mx = Math.sqrt(a2 * c2 + b2 * s2);
   var my = Math.sqrt(a2 * s2 + b2 * c2);
   //
   // R is the box around the ellipsoid, expanded by 2 pixel
   //
   var R  = new Rect(Math.floor(e.x - mx - 1),
                     Math.floor(e.y - my - 1),
                     Math.ceil(e.x + mx + 1),
                     Math.ceil(e.y + my + 1));
   //
   // intersect rectangle of ellipsoid with image frame
   //
   R = R.intersection( new Rect(0, 0, view.image.width, view.image.height));
   //
   // create the image and set pixel intensities
   //
   var img = new Image(view.image.width, view.image.height);
   img.fill (0);
   //
   //
   //
   for (var y = R.y0; y < R.y1 ; y++)
   {
      for (var x = R.x0; x < R.x1 ; x++)
      {
         var K = Math.sqrt(Math.pow(((x - e.x) * c + (y - e.y) * s) / e.a, 2) +
                           Math.pow(((x - e.x) * s - (y - e.y) * c) / e.b, 2));
         if (K < 1) img.setSample( 1 - K, x , y );
      }
   }
   return img;
}


function copyView( view, newName)
{

   var win = new ImageWindow(view.image.width, view.image.height,
                             view.image.numberOfChannels,
                             view.image.bitsPerSample, view.image.isReal,
                             view.image.isColor,
                             newName);
   win.zoomToFit();
   win.hide();
   win.mainView.beginProcess(UndoFlag_NoSwapFile);
   win.mainView.image.apply(view.image);
   win.mainView.endProcess();
   return win.mainView;
}


function copyViewNewName(view)
{
   var win = new ImageWindow(view.image.width, view.image.height,
                             view.image.numberOfChannels,
                             view.image.bitsPerSample, view.image.isReal,
                             view.image.isColor);
   win.zoomToFit();
   win.hide();
   win.mainView.beginProcess(UndoFlag_NoSwapFile);
   win.mainView.image.apply(view.image);
   win.mainView.endProcess()
   return win.mainView;
}


function loadMaskFromView( view, data, ctrl )
{
   //
   // try reading from fits keys
   //
   var storedFigures = jsonFromHeader (view.window);
   //if (storedFigures != null) Console.writeln('FITS properties: ' + storedFigures);
   //
   // if null, try reading from view properties
   //
   if (storedFigures == null)
   {
      storedFigures = view.propertyValue('figures');
      //if (storedFigures != null) Console.writeln('View properties: ' + storedFigures);
   }

   if (storedFigures != null)
   {
      var figures = JSON.parse(storedFigures);
      try
      {
         for (var j = 0; j < figures.ellipsoids.length; j++)
         {
            var d = figures.ellipsoids[j].data;
            data.addEllipsoid(d.x, d.y, d.a, d.b, d.pa);
         }
         for (var j = 0; j < figures.multipoint.length; j++)
         {
            var d = figures.multipoint[j].data;
            try {
               data.addMultipointFigure(d.centroid, d.points, d.bezier, d.gradientCenter);
            }
            catch (ex)
            {}
         }
         if (data.ellipsoids.length)
            data.setObjectType(0);
         else
            data.setObjectType(1);
      }
      finally {};
      return;
   }

   var old_ellipsoids = readEllipsoids(view);
   if (old_ellipsoids.length > 0)
   {
      if (data.ellipsoids.length > 0 || data.multiPoints.length > 0)
      {
         if (!ask("Erase figure(s) on active view?", "Confirm", StdButton_Yes))
            return;
      }
      data.setEllipsoids(old_ellipsoids);
   }
/*   else
   {
      message("This view has no ellipsoids stored", "");
   }*/
}

function GradientEdge(view, name)
{
   var P = new Convolution;
   P.mode = Convolution.prototype.Parametric;
   P.sigma = 10.00;
   P.shape = 2.00;
   P.aspectRatio = 1.00;
   P.rotationAngle = 0.00;
   P.filterSource = "SeparableFilter {\n" +
   "   name { Gaussian (11) }\n" +
   "   row-vector {  0.010000  0.052481  0.190546  0.478630  0.831764  1.000000  0.831764  0.478630  0.190546  0.052481  0.010000 }\n" +
   "   col-vector {  0.010000  0.052481  0.190546  0.478630  0.831764  1.000000  0.831764  0.478630  0.190546  0.052481  0.010000 }\n" +
   "}\n";
   P.rescaleHighPass = false;
   P.viewId = view.id;
   if (P.executeOn(view))
   {
      return View.viewById(name);
   }
   else
   {
      message("Gradient Edge", "Error");
      return null;
   }
}

function maskView( view , id)
{
   var maskName = getNewName(id, "_gm")
   var win = new ImageWindow( view.image.width, view.image.height, 1, 32, true, false, maskName);
   win.hide();
   return win.mainView;
}


function extractCIEY(view, name)
{
   if (view.image.isColor)
   {
      var img = new Image(view.image.width, view.image.height);
      view.image.getLuminance(img);
      var win = new ImageWindow(img.width, img.height,
                                img.numberOfChannels,
                                img.bitsPerSample, img.isReal,
                                img.isColor, name);
      win.hide();
      win.mainView.beginProcess(UndoFlag_NoSwapFile);
      win.mainView.image.apply(img);
      win.mainView.endProcess();
      return win.mainView;
   }
   else
   {
      return copyView(view, name);
   }
}

function subView(view, minuent)
{
   var P = new PixelMath;
   P.expression = "$T - " + minuent.id;
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "";
   P.generateOutput = true;
   P.singleThreaded = false;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   P.showNewImage = false;
   if (P.executeOn(view))
      return view;
   {
      message("Subtract views", "Error");
      return null;
   }
}

function setPixelZeroes(view)
{
   var P = new PixelMath;
   P.expression = "iif($T > 0, 1, 0)";
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "";
   P.generateOutput = true;
   P.singleThreaded = false;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   if (P.executeOn(view))
      return view;
   {
      message("setPixelZeroes ", "Error");
      return null;
   }
}

function multMaskedMask(view, mask, id)
{
   view.window.setMask( mask.window)
   view.window.maskEnabled = true;
   var P = new PixelMath;
   P.expression = "$T * " + mask.id;
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "";
   P.generateOutput = true;
   P.singleThreaded = false;
   P.use64BitWorkingImage = false;
   P.rescale = true;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = true;
   P.showNewImage = false;
   P.newImageId = id;
   P.newImageWidth = 0;
   P.newImageHeight = 0;
   P.newImageAlpha = false;
   P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
   P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
   if (P.executeOn(view))
      view.window.removeMask()
      return View.viewById(id)
   {
      message("multMaskedMask ", "Error");
      return null;
   }
}

function multInverted(view1, view2)
{
   var P = new PixelMath;
   P.expression = "~$T * " + view2.id;
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "";
   P.generateOutput = true;
   P.singleThreaded = false;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   P.showNewImage = true;
   P.newImageId = "";
   P.newImageWidth = 0;
   P.newImageHeight = 0;
   P.newImageAlpha = false;
   P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
   P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
   if (P.executeOn(view1))
      return view1;
   {
      message("multInverted ", "Error");
      return null;
   }
}

function extractLuminance(view, id)
{
   if (view.image.isColor)
   {
      var img = new Image(view.image.width, view.image.height);
      view.image.getLightness(img);
      var win = new ImageWindow(img.width, img.height,
                                img.numberOfChannels,
                                img.bitsPerSample, img.isReal,
                                img.isColor);
      win.hide();
      win.mainView.beginProcess(UndoFlag_NoSwapFile);
      win.mainView.image.apply(img);
      win.mainView.endProcess();
      win.mainView.id = id;
      return win.mainView;
   }
   else
   {
      return copyView(view, id);
   }
}

function nullOp(view)
{
   var P = new PixelMath;
   P.expression = "$T";
   P.expression1 = "";
   P.expression2 = "";
   P.expression3 = "";
   P.useSingleExpression = true;
   P.symbols = "";
   P.generateOutput = true;
   P.singleThreaded = false;
   P.use64BitWorkingImage = false;
   P.rescale = false;
   P.rescaleLower = 0;
   P.rescaleUpper = 1;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   P.createNewImage = false;
   P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
   P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
   P.executeOn(view);
}

function isGAMEMask(view)
{
   var b = false;
   try
   {
      b = view.propertyValue(ISGAMEMASK) == ISGAMEMASK;
   }
   catch (ex)
   {
   }
   // Console.writeln("isGAMEMask "+ b);
   return b;
}

function dateOfMask(view)
{
   var d = null;
   try
   {
      d = view.propertyValue(GAMEMASKTIME);
   }
   catch (ex)
   {
   }
   Console.writeln("dateOfMask "+ b);
   return d;
}

function saveProperties(view, strObjects, settings)
{
   if (view == null) return;

   if (settings.persistData)
   {
      Console.writeln('Add drawing figures to fits in ' + view.id);
      Console.flush();
      jsonToHeader(strObjects, view.window);
      //Console.writeln('Drawing figures added to fits in ' + view.id);
   }
   else
      view.setPropertyValue('figures', strObjects);
}

// ...for compatibility
function readEllipsoids(view)
{
   var ellipsoids = [];
   var i = 0;
   for (;;)
   {
      var x = readProperty(view, i, "x");
      var y = readProperty(view, i, "y");
      var a = readProperty(view, i, "a");
      var b = readProperty(view, i, "b");
      var pa = readProperty(view, i, "pa");
      if ( x != null && y != null &&
           a != null && b != null &&
           pa != null)
      {
         var e = new ellipsoid(x, y, a, b, pa, null);
         ellipsoids.push( e );
      }
      else
         break;
      i += 1;
   }
   return ellipsoids;
}

function readProperty(view, i, objPropName)
{
   return view.propertyValue( "Ellipsoid_" + i + "_" + objPropName )
}

function getNewView(oldList, newList)
{
   for (var i = 0; i < newList.length; i++)
   {
      for (var j = 0; j< oldList.length; j++)
      {
         if (oldList[j].id == newList[i].id)
            continue;
         else
         {
            return newList[i];
         }
      }
   }
   // no new view
   return null;
}

function getAllMainViews()
{
   var mainViews = [];
   var images = ImageWindow.windows;
   for ( var i = 0; i < images.length; i++ )
   {
      if (images[i].mainView.isMainView) mainViews.push(images[i].mainView);
   }
   return mainViews;
}

function getOldMasks()
{
   var oldViews = [];
   var views = getAllMainViews();
   for ( var i = 0; i < views.length; i++)
   {
      if (isGAMEMask(views[i])) oldViews.push(views[i]);
   }
   return oldViews;
}

function message(txt, caption)
{
   var bx = new MessageBox(txt, caption);
   bx.execute();
}

function ask(txt, caption, defaultButton)
{
   var bx = new MessageBox(txt, caption,
         StdIcon_Question,
         StdButton_No,
         StdButton_Yes);
   bx.defaultButton = defaultButton;

   return bx.execute() == StdButton_Yes;
}


function delay(ms)
{
   var d  = new Date();
   var te = d.getTime();
   te += ms;
   var tn = 0;
   for (;;)
   {
      d  = new Date();
      tn = d.getTime();
      if (tn >= te) break;
   }
}


var data;


function PreviewControl(parent)
{
   this.__base__ = Frame;
   this.__base__(parent);
	//Console.writeln("TYPE  "+  (this.visibleRect.toString()) );

   this.SetImage = function(image, metadata)
   {
      this.image = image;
      this.metadata = metadata;
      this.scaledImage = null;
      this.SetZoomOutLimit();
      this.UpdateZoom(-100);
   }

   this.UpdateZoom = function (newZoom, refPoint)
   {
      newZoom = Math.max(this.zoomOutLimit, Math.min(2, newZoom));
      if (newZoom == this.zoom && this.scaledImage)
         return;

      if(refPoint==null)
         refPoint=new Point(this.scrollbox.viewport.width/2, this.scrollbox.viewport.height/2);
      var imgx=null;
      if(this.scrollbox.maxHorizontalScrollPosition>0)
         imgx=(refPoint.x+this.scrollbox.horizontalScrollPosition)/this.scale;
      var imgy=null;
      if(this.scrollbox.maxVerticalScrollPosition>0)
         imgy=(refPoint.y+this.scrollbox.verticalScrollPosition)/this.scale;

      this.zoom = newZoom;
      this.scaledImage = null;
      this.refPoint = refPoint;
      gc(true);
      if (this.zoom > 0)
      {
         this.scale = this.zoom;
         this.zoomVal_Label.text = format("%d:1", this.zoom);
      }
      else
      {
         this.scale = 1 / (-this.zoom + 2);
         this.zoomVal_Label.text = format("1:%d", -this.zoom + 2);
      }
      if (this.image)
         this.scaledImage = this.image.scaled(this.scale);
      else
         this.scaledImage = {width:this.metadata.width * this.scale, height:this.metadata.height * this.scale};
      this.scrollbox.maxHorizontalScrollPosition = Math.max(0, this.scaledImage.width - this.scrollbox.viewport.width);
      this.scrollbox.maxVerticalScrollPosition = Math.max(0, this.scaledImage.height - this.scrollbox.viewport.height);

      if(this.scrollbox.maxHorizontalScrollPosition>0 && imgx!=null)
         this.scrollbox.horizontalScrollPosition = (imgx*this.scale)-refPoint.x;
      if(this.scrollbox.maxVerticalScrollPosition>0 && imgy!=null)
         this.scrollbox.verticalScrollPosition = (imgy*this.scale)-refPoint.y;

      this.scrollbox.viewport.update();
   }

   this.zoomIn_Button = new ToolButton( this );
   this.zoomIn_Button.icon = this.scaledResource( ":/icons/zoom-in.png" );
   this.zoomIn_Button.setScaledFixedSize( 20, 20 );
   this.zoomIn_Button.toolTip = "Zoom in";
   this.zoomIn_Button.onMousePress = function()
   {
      this.parent.parent.UpdateZoom(this.parent.parent.zoom+1);
   };

   this.zoomOut_Button = new ToolButton( this );
   this.zoomOut_Button.icon = this.scaledResource( ":/icons/zoom-out.png" );
   this.zoomOut_Button.setScaledFixedSize( 20, 20 );
   this.zoomOut_Button.toolTip = "Zoom in";
   this.zoomOut_Button.onMousePress = function()
   {
      this.parent.parent.UpdateZoom(this.parent.parent.zoom-1);
   };


   this.zoom11_Button = new ToolButton( this );
   this.zoom11_Button.icon = this.scaledResource( ":/icons/zoom-1-1.png" );
   this.zoom11_Button.setScaledFixedSize( 20, 20 );
   this.zoom11_Button.toolTip = "Zoom 1:1";
   this.zoom11_Button.onMousePress = function()
   {
      this.parent.parent.UpdateZoom(1);
   };

   this.stf_CheckBox = new CheckBox( this );
   with ( this.stf_CheckBox )
   {
      foregroundColor = 0xffffffff;
      text = 'AutoSTF';
      toolTip = 'ScreenTransferFunction';
      onCheck = function( checked )
      {
         var preview = this.parent.parent.onCustomSTF.call(this, checked);
      }
   }

/*
   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.add( this.zoomIn_Button );
   this.buttons_Sizer.add( this.zoomOut_Button );
   this.buttons_Sizer.add( this.zoom11_Button );
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.stf_Button );
*/

   this.buttons_Box   = new Frame(this);
   with (this.buttons_Box)
   {
      backgroundColor = 0xff0078d7;
      sizer = new HorizontalSizer;
      sizer.margin = 4;
      sizer.spacing = 4;
      sizer.add( this.zoomIn_Button );
      sizer.add( this.zoomOut_Button );
      sizer.add( this.zoom11_Button );
      sizer.addStretch();
      sizer.add( this.stf_CheckBox );
   }


   this.setScaledMinSize(300,200);
   this.zoom = 1;
   this.scale = 1;
   this.zoomOutLimit = -5;
   this.scrollbox = new ScrollBox(this);
   this.scrollbox.autoScroll = true;
   this.scrollbox.tracking = true;
   this.scrollbox.cursor = new Cursor(StdCursor_Arrow);

   this.scroll_Sizer = new HorizontalSizer;
   this.scroll_Sizer .add( this.scrollbox );

   this.SetZoomOutLimit = function()
   {
      var scaleX = Math.ceil(this.metadata.width/this.scrollbox.viewport.width);
      var scaleY = Math.ceil(this.metadata.height/this.scrollbox.viewport.height);
      var scale = Math.max(scaleX,scaleY);
      this.zoomOutLimit = -scale+2;
   }

   this.scrollbox.onHorizontalScrollPosUpdated = function (newPos)
   {
      this.viewport.update();
   }
   this.scrollbox.onVerticalScrollPosUpdated = function (newPos)
   {
      this.viewport.update();
   }

   this.forceRedraw = function()
   {
      this.scrollbox.viewport.update();
   };

   this.scrollbox.viewport.onMouseWheel = function (x, y, delta, buttonState, modifiers)
   {
      var preview = this.parent.parent;
      preview.UpdateZoom(preview.zoom + (delta > 0 ? -1 : 1), new Point(x,y));
   }

   this.scrollbox.viewport.onMousePress = function ( x, y, button, buttonState, modifiers )
   {
      var preview = this.parent.parent;
      var p =  preview.transform(x, y, preview);
      if(preview.onCustomMouseDown)
      {
         preview.onCustomMouseDown.call(this, p.x, p.y, button, buttonState, modifiers )
      }
   }

   this.scrollbox.viewport.onMouseMove = function ( x, y, buttonState, modifiers )
   {
      var preview = this.parent.parent;
      var p =  preview.transform(x, y, preview);
      preview.Xval_Label.text = p.x.toString();
      preview.Yval_Label.text = p.y.toString();

      if(preview.onCustomMouseMove)
      {
         preview.onCustomMouseMove.call(this, p.x, p.y, buttonState, modifiers )
      }
   }

   this.scrollbox.viewport.onMouseRelease = function (x, y, button, buttonState, modifiers)
   {
      var preview = this.parent.parent;

      var p =  preview.transform(x, y, preview);
      if(preview.onCustomMouseUp)
      {
         preview.onCustomMouseUp.call(this, p.x, p.y, button, buttonState, modifiers )
      }
   }

   this.scrollbox.viewport.onResize = function (wNew, hNew, wOld, hOld)
   {
      var preview = this.parent.parent;
      if(preview.metadata && preview.scaledImage)
      {
         this.parent.maxHorizontalScrollPosition = Math.max(0, preview.scaledImage.width - wNew);
         this.parent.maxVerticalScrollPosition = Math.max(0, preview.scaledImage.height - hNew);
         preview.SetZoomOutLimit();
         preview.UpdateZoom(preview.zoom);
      }
      this.update();
   }

   this.scrollbox.viewport.onPaint = function (x0, y0, x1, y1)
   {
      var preview = this.parent.parent;
      var graphics = new VectorGraphics(this);

      graphics.fillRect(x0,y0, x1, y1, new Brush(0xff202020));
      var offsetX = this.parent.maxHorizontalScrollPosition>0 ? -this.parent.horizontalScrollPosition : (this.width-preview.scaledImage.width)/2;
      var offsetY = this.parent.maxVerticalScrollPosition>0 ? -this.parent.verticalScrollPosition: (this.height-preview.scaledImage.height)/2;
      graphics.translateTransformation(offsetX, offsetY);
      if(preview.image)
         graphics.drawBitmap(0, 0, preview.scaledImage);
      else
         graphics.fillRect(0, 0, preview.scaledImage.width, preview.scaledImage.height, new Brush(0xff000000));

      graphics.pen = new Pen(0xffffffff,0);
      graphics.drawRect(-1, -1, preview.scaledImage.width + 1, preview.scaledImage.height + 1);

      if(preview.onCustomPaint)
      {
         graphics.antialiasing = true;
         graphics.scaleTransformation(preview.scale,preview.scale);
         preview.onCustomPaint.call(this, graphics, x0, y0, x1, y1);
      }
      graphics.end();
   }

   this.transform = function(x, y, preview)
   {
      var scrollbox = preview.scrollbox;
      var ox = 0;
      var oy = 0;
      ox = scrollbox.maxHorizontalScrollPosition>0 ? -scrollbox.horizontalScrollPosition : (scrollbox.viewport.width-preview.scaledImage.width)/2;
      oy = scrollbox.maxVerticalScrollPosition>0 ? -scrollbox.verticalScrollPosition: (scrollbox.viewport.height-preview.scaledImage.height)/2;
      var coordPx = new Point((x - ox) / preview.scale, (y - oy) / preview.scale);
      return new Point(coordPx.x, coordPx.y);
   }

   this.center = function()
   {
      var preview = this;
      var scrollbox = preview.scrollbox;
      var x = scrollbox.viewport.width / 2;
      var y = scrollbox.viewport.height / 2;
      var p =  this.transform(x, y, preview);
      return p;
   }

   this.zoomLabel_Label =new Label(this);
   this.zoomLabel_Label.text = "Zoom:";
   this.zoomVal_Label =new Label(this);
   this.zoomVal_Label.text = "1:1";

   this.Xlabel_Label = new Label(this);
   this.Xlabel_Label .text = "X:";
   this.Xval_Label = new Label(this);
   this.Xval_Label.text = "---";
   this.Ylabel_Label = new Label(this);
   this.Ylabel_Label.text = "Y:";
   this.Yval_Label = new Label(this);
   this.Yval_Label.text = "---";

   this.coords_Frame = new Frame(this);
   this.coords_Frame.backgroundColor = 0xffffffff;
   this.coords_Frame.sizer = new HorizontalSizer;
   this.coords_Frame.sizer.margin = 2;
   this.coords_Frame.sizer.spacing = 4;
   this.coords_Frame.sizer.add(this.zoomLabel_Label);
   this.coords_Frame.sizer.add(this.zoomVal_Label);
   this.coords_Frame.sizer.addSpacing(6);
   this.coords_Frame.sizer.add(this.Xlabel_Label);
   this.coords_Frame.sizer.add(this.Xval_Label);
   this.coords_Frame.sizer.addSpacing(6);
   this.coords_Frame.sizer.add(this.Ylabel_Label);
   this.coords_Frame.sizer.add(this.Yval_Label);

   this.coords_Frame.sizer.addStretch();

   this.sizer = new VerticalSizer;
   this.sizer.add( this.buttons_Box);
   this.sizer.add( this.scroll_Sizer );
   this.sizer.add( this.coords_Frame );
}


// ========================================================================
//
// Options dialog
//
// ========================================================================

function showOptions(strSettings)
{
   //
   //
   //
   this.__base__ = Dialog;
   this.__base__();
   var dialog = this;

   this.windowTitle = 'Drawing options';

   var settings = JSON.parse(strSettings);

   var currentKey;
   var currentType;

   function colorIcon(color)
   {
      var bmp = new Bitmap(18, 18);
      var g = new Graphics(bmp);
      g.fillRect(0, 0, bmp.width - 1,bmp.height - 1, new Brush (color));
      g.drawRect(0, 0, bmp.width - 1,bmp.height - 1);
      g.end();
      return bmp;
   }

   function NewNode(optionName, settings, key, type)
   {
      // type: int, float, bool, color
      //
      var node = new TreeBoxNode();
      node.setText(0, optionName);

      if (settings == null)
      {
         var boldFont = new Font(dialog.font.family, dialog.font.pointSize * 1.25 );
         boldFont.bold = true;
         node.setFont(0, boldFont );
         node.selectable = false;
         node.setText(1, '');
         node.setText(2, '*');
      }
      else
      {
         var v = settings [key];

         if (type == 'int')
         {
            node.setText(1, v.toString());
         }
         else if (type == 'bool')
         {
            if (v)
               node.setText(1, 'yes');
            else
               node.setText(1, 'no');
         }
         else if (type == 'color')
         {
            node.setIcon(1, colorIcon(v));
         }
         else if (type == 'float')
         {
            node.setText(1, v.toString());
         }

         node.setText(2, key);
         node.setText(3, type);
      }

      return node;
   }

   this.colorBox = new ColorComboBox( this );
   with (this.colorBox)
   {
      setVariableSize();
      visible = false;

      onColorSelected = function ( rgba )
      {
         visible = false;
         settings[currentKey] = currentColor();
         dialog.tbx.selectedNodes[0].setIcon(1, colorIcon(currentColor()));
      }
   }

   this.editBox = new Edit(this);
   with (this.editBox)
   {
      setVariableSize();
      visible = false;

      onEditCompleted = function ()
      {
         visible = false;
         if (currentType == 'float')
            settings[currentKey] = text.toNumber();
         else
            settings[currentKey] = text.toInt();
         dialog.tbx.selectedNodes[0].setText( 1, text );
      }
   }

   this.checkButton = new ToolButton(this);
   with (this.checkButton)
   {
      checkable = true;
      setVariableSize();
      visible = false;
      onCheck = function( checked )
      {
         visible = false;
         settings[currentKey] = checked;
         if (checked)
            dialog.tbx.selectedNodes[0].setText(1, 'yes');
         else
            dialog.tbx.selectedNodes[0].setText(1, 'no');
      }
      onLeave = function () {visible = false;}
   }


   this.tbx = new TreeBox(this);
   with (this.tbx)
   {
      headerVisible     = true;
      rootDecoration    = false;
      uniformRowHeight  = true;
      multipleSelection = false;
      nodeExpansion     = true;
      headerVisible     = false;
      font = new Font(FontFamily_SansSerif, 10);

      setHeaderText( 0, 'Option' );
      setHeaderText( 1, 'Value' );

      viewSettings();

      hideColumn(2);
      hideColumn(3);

      adjustColumnWidthToContents(0);
      adjustColumnWidthToContents(1);

      setMinHeight((numberOfChildren + 1) * nodeRect(child(0)).height);

      this.editBox.parent  = this.tbx;
      this.colorBox.parent = this.tbx;
      this.checkButton.parent = this.tbx;

      onNodeClicked = function ( item, columnIndex )
      {
         dialog.editBox.visible = false;
         dialog.colorBox.visible = false;
         dialog.checkButton.visible = false;
         currentKey = item.text(2);
         currentType = item.text(3);

         if (currentKey == '*') return;

         if (columnIndex == 1)
         {
            var r = dialog.tbx.nodeRect(item);

            if (currentType == 'int')
            {
               dialog.editBox.position = new Point(columnWidth(0) + 3, r.y0 + 2);
               dialog.editBox.height = r.height;
               dialog.editBox.width  = r.width - columnWidth(0);
               dialog.editBox.visible = true;
               dialog.editBox.text  = settings[currentKey].toString();
            }
            if (currentType == 'float')
            {
               dialog.editBox.position = new Point(columnWidth(0) + 3, r.y0 + 2);
               dialog.editBox.height = r.height;
               dialog.editBox.width  = r.width - columnWidth(0);
               dialog.editBox.visible = true;
               dialog.editBox.text  = settings[currentKey].toString();
            }
            else if (currentType == 'bool')
            {
               dialog.checkButton.position = new Point(columnWidth(0) + 3, r.y0 + 2);
               dialog.checkButton.height = r.height;
               dialog.checkButton.width  = r.width - columnWidth(0);
               dialog.checkButton.visible = true;
               dialog.checkButton.checked = settings[currentKey];
               if (dialog.checkButton.checked)
                  dialog.checkButton.text = 'yes';
               else
                  dialog.checkButton.text = 'no';
            }
            else if (currentType == 'color')
            {
               dialog.colorBox.position = new Point(columnWidth(0) + 3, r.y0 + 2);
               dialog.colorBox.height = r.height;
               dialog.colorBox.width  = r.width - columnWidth(0);
               dialog.colorBox.visible = true;
               dialog.colorBox.setCurrentColor(settings[currentKey]);
            }
         }
      }

      onNodeDoubleClicked = function ( item, columnIndex )
      {

         currentKey = item.text(2);
         currentType = item.text(3);

         if (columnIndex == 0)
         {
            if (currentType == 'bool')
            {
               settings[currentKey] = !settings[currentKey];
               if (settings[currentKey])
                  item.setText(1, 'yes');
               else
                  item.setText(1, 'no');
            }
         }
      }
   }

   function viewSettings()
   {
      with (dialog.tbx)
      {
         clear();

         add(NewNode('General', null, null));
         add(NewNode('Start with recent figures', settings, 'importAllways', 'bool'));
         add(NewNode('Save drawings to keys', settings, 'persistData', 'bool'));

         add(NewNode('Figure borderline', null, null));
         add(NewNode('Style yes=solid, no=dashed', settings, 'afLineStyle', 'bool'));
         add(NewNode('Line color', settings, 'afLineColor', 'color'));

         add(NewNode('Centerpoints', null, null));
         add(NewNode('Size', settings, 'cpDiameter', 'int'));
         add(NewNode('Style yes=rectangle, no=circle',   settings, 'cpStyle', 'bool'));
         add(NewNode('Filled',   settings, 'cpFilled', 'bool'));
         add(NewNode('Color',    settings, 'cpColor', 'color'));

         add(NewNode('Ankerpoints', null, null));
         add(NewNode('Size', settings, 'apDiameter', 'int'));
         add(NewNode('Filled',   settings, 'apFilled', 'bool'));
         add(NewNode('Color',    settings, 'apColor', 'color'));

         add(NewNode('Multipoint', null, null));
         add(NewNode('Bezier',            settings, 'bezier', 'bool'));
         add(NewNode('Show points',       settings, 'viewAp', 'bool'));
         add(NewNode('Area transparency', settings, 'transparency', 'float'));

         add(NewNode('Gradient center', null, null));
         add(NewNode('Size', settings, 'gpDiameter', 'int'));
         add(NewNode('Style yes=triangle, no=circle', settings, 'gpStyle', 'bool'));
         add(NewNode('Filled',      settings, 'gpFilled', 'bool'));
         add(NewNode('Color',       settings, 'gpColor', 'color'));

      }
   }

   this.defaultButton = new ToolButton(this);
   with (this.defaultButton)
   {
      icon = this.scaledResource( ":/icons/table-download.png" );
      text = 'Default';
      onClick = function ( checked )
      {
         settings = defaultSettings();
         viewSettings();
      }
   }

   this.okButton = new PushButton(this);
   with (this.okButton)
   {
      icon = this.scaledResource( ":/icons/ok.png" );
      enabled = true;
      text = 'OK';

      onClick = function ()
      {
         Settings.write(ID, DataType_String, JSON.stringify(settings));
         dialog.done(0);
      }
   }

   this.cancelButton = new PushButton(this);
   with (this.cancelButton)
   {
      icon = this.scaledResource( ":/icons/cancel.png" );
      text = 'Cancel';

      onClick = function ()
      {
         dialog.done(1);
      }
   }

   this.frameButtons = new Frame(this);
   with (this.frameButtons)
   {
      sizer = new HorizontalSizer();
      sizer.margin = 4;
      sizer.add(this.defaultButton);
      sizer.addSpacing (20);
      sizer.add(this.cancelButton);
      sizer.addSpacing (20);
      sizer.add(this.okButton);
      sizer.addStretch();
   }

   this.sizer = new VerticalSizer();
   with (this.sizer)
   {
      margin = 4;
      add(this.tbx);
      addSpacing (12);
      add(this.frameButtons);
   }

   this.adjustToContents();
   this.userResizable = true;
}

// ========================================================================
//
// SelectiveRejection dialog
//
// ========================================================================

function showSelectiveRejection(data)
{
   this.__base__ = Dialog;
   this.__base__();
   var dialog = this;

   this.windowTitle = 'Write shapes to Files/Views';
   //
   // arrange controls to form the GUI
   //
   // begin files section
   //
   this.filesBox = new TreeBox(this);
   with (this.filesBox)
   {
      //
      // create a treebox with 2 columns
      // column 0 contains filenames
      // column 1 contains the full path
      //
      alternateRowColor = true;
      numberOfColumns = 2;
      rootDecoration = false;
      setMinWidth(400);
      multipleSelection = true;
      setHeaderText(0, "FileNames");
      setHeaderText(1, "FileNames");
      hideColumn(1);
   }

   this.btnAddFiles = new PushButton(this);
   with (this.btnAddFiles)
   {
      text = "Add Files";

      onClick  = function()
      {
         var ofd = new OpenFileDialog();
         ofd.multipleSelections = true;
         //ofd.filters = [ [ "FITS Files", ".fit", ".fits", ".fts" ],
         //                [ "XISF Files", "*.xisf"]];
         ofd.filters = [[ "Image Files", ".xisf", ".fit", ".fits", ".fts"]];

         if (ofd.execute())
         {
            for (var i = 0; i < ofd.fileNames.length; i++)
            {
               var filename =  ofd.fileNames[i];
               //
               // find filename in fileBox
               //
               if (exists(filename, dialog.filesBox)) continue;
               var node = new TreeBoxNode(dialog.filesBox);
               node.setText(0, File.extractNameAndExtension(filename));
               node.setText(1, filename);
            }
         }

         dialog.btnApply.enabled = (dialog.filesBox.numberOfChildren +
                                    dialog.viewsBox.numberOfChildren) > 0;
      }
   }

   this.btnRemoveFiles = new PushButton(this);
   with (this.btnRemoveFiles)
   {
      text = "Remove Files ";

      onClick  = function()
      {
         var a = dialog.filesBox.selectedNodes;
         a.reverse();
         for (var i = 0; i < a.length; i++)
         {
            var fullname = a[i].text(1);
            var j =  indexOfTreeElement(fullname, dialog.filesBox, 1);
            dialog.filesBox.remove(j);
         }

         dialog.btnApply.enabled = (dialog.filesBox.numberOfChildren +
                                    dialog.viewsBox.numberOfChildren) > 0;
      }
   }


   this.btnClearFiles = new PushButton(this);
   with (this.btnClearFiles)
   {
      text = "Clear";

      onClick  = function()
      {
         dialog.filesBox.clear();

         dialog.btnApply.enabled = (dialog.filesBox.numberOfChildren +
                                    dialog.viewsBox.numberOfChildren) > 0;
      }
   }

   this.checkFullPath = new CheckBox(this);
   with (this.checkFullPath)
   {
      text = "Full Path";

      onCheck = function(checked)
      {
         if (checked)
         {
            dialog.filesBox.showColumn(0, false);
            dialog.filesBox.showColumn(1, true);
         }
         else
         {
            dialog.filesBox.showColumn(0, true);
            dialog.filesBox.showColumn(1, false);
         }
      }
   }

   var pnlFiles = new VerticalSizer();
   with (pnlFiles)
   {
      margin = 4;
      add (this.filesBox);

   }

   var pnlFilesButtons = new VerticalSizer();
   with (pnlFilesButtons)
   {
      margin = 4;
      add (this.btnAddFiles);
      addSpacing(8);
      add (this.btnRemoveFiles);
      addSpacing(8);
      add (this.btnClearFiles);
      addStretch();
      add(this.checkFullPath);
   }

   this.filesGbx  = new GroupBox(this);
	with (this.filesGbx)
	{
		title = "Files";

      sizer = new HorizontalSizer();
      sizer.add(pnlFiles);
      sizer.add(pnlFilesButtons);
   }
   //
   // end files section
   //
   // begin views section
   //
   this.viewsBox = new TreeBox(this);
   with (this.viewsBox)
   {
      //
      // create a treebox with 2 columns
      // column 0 contains filenames
      //
      alternateRowColor = true;
      numberOfColumns = 1;
      rootDecoration = false;
      setMinWidth(400);
      multipleSelection = true;
      setHeaderText(0, "Views");
   }

   this.btnAddViews = new PushButton(this);
   with (this.btnAddViews)
   {
      text = "Add Views";

      onClick  = function()
      {

         var dlgViewSelect = new showSelectMainviews();

         var result = dlgViewSelect.execute();

         if (result == 0)
         {
            var a = dlgViewSelect.Views;
            for (var i = 0; i < a.length; i++)
            {
               var node = new TreeBoxNode(dialog.viewsBox);
               node.setText(0, a[i]);
            }
         }

         dialog.btnApply.enabled = (dialog.filesBox.numberOfChildren +
                                    dialog.viewsBox.numberOfChildren) > 0;
      }
   }

   this.btnRemoveViews = new PushButton(this);
   with (this.btnRemoveViews)
   {
      text = "Remove Views";

      onClick  = function()
      {
         var a = dialog.viewsBox.selectedNodes;
         a.reverse();
         for (var i = 0; i < a.length; i++)
         {
            var fullname = a[i].text(0);
            var j =  indexOfTreeElement(fullname, dialog.viewsBox, 0);
            dialog.viewsBox.remove(j);
         }

         dialog.btnApply.enabled = (dialog.filesBox.numberOfChildren +
                                    dialog.viewsBox.numberOfChildren) > 0;
      }
   }


   this.btnClearViews = new PushButton(this);
   with (this.btnClearViews)
   {
      text = "Clear";

      onClick  = function()
      {
         dialog.viewsBox.clear();

         dialog.btnApply.enabled = (dialog.filesBox.numberOfChildren +
                                    dialog.viewsBox.numberOfChildren) > 0;
      }
   }

   var pnlViews = new VerticalSizer();
   with (pnlViews)
   {
      margin = 4;
      add (this.viewsBox);

   }

   var pnlViewsButtons = new VerticalSizer();
   with (pnlViewsButtons)
   {
      margin = 4;
      add (this.btnAddViews);
      addSpacing(8);
      add (this.btnRemoveViews);
      addSpacing(8);
      add (this.btnClearViews);
      addStretch();
   }

   this.viewsGbx  = new GroupBox(this);
	with (this.viewsGbx)
	{
		title = "Views";

      sizer = new HorizontalSizer();
      sizer.add(pnlViews);
      sizer.add(pnlViewsButtons);
   }
   //
   // end views section
   //
   this.cancelButton = new PushButton( this );
   with (this.cancelButton)
   {
      text = "Cancel";
      icon = this.scaledResource( ":/icons/cancel.png" );
      onClick = function() {dialog.done(0);}
   }

   this.btnApply = new PushButton( this );
   with (this.btnApply)
   {
      enabled = false;
      text = "OK";
      icon = this.scaledResource( ":/icons/execute.png" );
      onClick = function()
      {
         dialog.btnApply.enabled = false;
         //
         // create the binary mask to be applied to files and views
         //
         var protocol = [];
         protocol.push('Write shapes to Files/Views');
         protocol.push('===========================');

         var mask = data.getMaskView ();
         setPixelZeroes(mask);

         var filenames = [];
         for (var i = 0; i < dialog.filesBox.numberOfChildren ; i++)
         {
            var child = dialog.filesBox.child(i);
            filenames.push(child.text(1));   // fullname in 2nd column
         }
         protocol = protocol.concat(applyToFiles(filenames, mask));
         //
         var viewIds = [];
         for (var i = 0; i < dialog.viewsBox.numberOfChildren ; i++)
         {
            var child = dialog.viewsBox.child(i);
            viewIds.push(child.text(0));   // view in 1st column
         }
         protocol = protocol.concat(applyToViews(viewIds, mask));
         //
         // ready
         //
         dialog.okButton.enabled = true;
         protocol.push('Updates completed');

         Console.writeln();
         for (var i = 0; i < protocol.length; i++)
            Console.writeln('\t' + protocol[i]);
         Console.flush();
      }
   }

   this.okButton = new PushButton( this );
   with (this.okButton)
   {
      enabled = false;
      text = "OK";
      icon = this.scaledResource( ":/icons/ok.png" );
      onClick = function()
      {
         dialog.done(0);
      }
   }

   var buttonsSizer = new HorizontalSizer();
   buttonsSizer.margin = 4;
   buttonsSizer.add(this.cancelButton);
   buttonsSizer.addStretch();
   buttonsSizer.add(this.btnApply);
   buttonsSizer.addStretch();
   buttonsSizer.add(this.okButton);


   this.sizer = new VerticalSizer();
   this.sizer.margin = 4;
   this.sizer.add(this.filesGbx);
   this.sizer.margin = 4;
   this.sizer.add(this.viewsGbx);
   this.sizer.add(buttonsSizer);

   this.adjustToContents();
   this.userResizable = true;
}

function applyToFiles(filenames, mask)
{
   //
   // open file, paint the mask and save as name+_sr.extension
   //
   var protocol = [];

   for (var i = 0; i < filenames.length;i++)
   {
      var filename = filenames[i];
      protocol.push('Read  ' + filename);

      var outfilename = filename;
      var ext = File.extractExtension( outfilename ).toLowerCase();
      outfilename = outfilename.replace(ext, '_sr' + ext);

      try
      {
         var window = ImageWindow.open(filename)[0];

         if(!window.isWindow)
         {
            protocol.push('Read image failed');
            protocol.push('File not modified: ' + filename);
            continue;
         }

         window.hide();

         var msg = multiplyInvertedMask(window.mainView, mask);

         if (msg != "")
         {
            protocol.push(msg);
            protocol.push('File not modified: ' + filename);
         }
         else
         {
            window.saveAs(outfilename, false, false, false, false );
            protocol.push(window.keywords.length + ' keywords added\n\tfrom: ' + filename +
            '\n\tto  : ' + outfilename);
            protocol.push(' ');
         }

         if (window != null) window.forceClose();
      }
      catch (ex)
      {
         protocol.push(ex);
      }

      protocol.push(' ');
   }

   return protocol;
}

function applyToViews(viewIds, mask)
{
   //
   // paint the mask on selected view(s)
   //
   var protocol = [];

   for (var i = 0; i < viewIds.length;i++)
   {
      var view = View.viewById(viewIds[i]);
      var msg = multiplyInvertedMask(view, mask);

      if (msg != "")
      {
         protocol.push(msg);
         protocol.push('View not modified: ' + view.id);
      }
      else
      {
         protocol.push('View  ' + view.id);
      }
   }

   return protocol;
}


function multiplyInvertedMask(view, mask)
{
   if (view.image.width == mask.image.width &
       view.image.height == mask.image.height)
   {
      var P = new PixelMath;
      P.expression = "$T * ~" + mask.id;
      P.expression1 = "";
      P.expression2 = "";
      P.expression3 = "";
      P.useSingleExpression = true;
      P.symbols = "";
      P.generateOutput = true;
      P.singleThreaded = false;
      P.use64BitWorkingImage = false;
      P.rescale = false;
      P.rescaleLower = 0;
      P.rescaleUpper = 1;
      P.truncate = true;
      P.truncateLower = 0;
      P.truncateUpper = 1;
      P.createNewImage = false;
      if (P.executeOn(view))
         return "";
      {
         return "multiplyInvertedMask - PixelMath error";
      }
   }
   else
   {
      return "Invalid image geometry - target size is different to mask size";
   }
}

function indexOfTreeElement(text, treebox, columnIndex)
{
   for (var i = 0; i < treebox.numberOfChildren ; i++)
   {
       if (treebox.child(i).text(columnIndex) == text) return i;
   }
   return -1;
}

function exists(fullname, treebox)
{
   return indexOfTreeElement(fullname, treebox, 1) > -1;
}
//
// end views section
//

//
// begin section showSelectMainviews
//
function showSelectMainviews()
{
   this.__base__ = Dialog;
   this.__base__();
   var dialog = this;

   this.windowTitle = 'Apply selective rejection to views and files';

   this.Views = [];

   this.viewsBox = new TreeBox(this);
   with (this.viewsBox)
   {
      //
      // create a treebox with 2 columns
      // column 0 contains filenames
      //
      alternateRowColor = true;
      numberOfColumns = 1;
      rootDecoration = false;
      setMinWidth(400);
      multipleSelection = true;
      setHeaderText(0, "Views");

      var a = getAllMainViews();

      for (var i = 0; i < a.length; i++)
      {
         var node = new TreeBoxNode(dialog.viewsBox);
         node.setText(0, a[i].fullId );
      }
   }

   this.cancelButton = new PushButton( this );
   with (this.cancelButton)
   {
      text = "Cancel";
      icon = this.scaledResource( ":/icons/cancel.png" );
      onClick = function() {dialog.done(1);}
   }

   this.okButton = new PushButton( this );
   with (this.okButton)
   {
      text = "OK";
      icon = this.scaledResource( ":/icons/ok.png" );
      onClick = function()
      {
         for (var i = 0; i < dialog.viewsBox.selectedNodes.length; i++)
         {
            dialog.Views.push(dialog.viewsBox.selectedNodes[i].text(0));
         }
         dialog.done(0);
      }
   }

   var buttonsSizer = new HorizontalSizer();
   buttonsSizer.margin = 4;
   buttonsSizer.add(this.cancelButton);
   buttonsSizer.addStretch();
   buttonsSizer.add(this.okButton);

   this.sizer = new VerticalSizer();
   this.sizer.margin = 4;
   this.sizer.add(this.viewsBox);
   this.sizer.add(buttonsSizer);

   this.adjustToContents();
   this.userResizable = false;
}
//
// end section showSelectMainviews
//
function GetWindowBmp(view)
{
   var image = view.image;
   image.firstSelectedChannel = 0;
   image.lastSelectedChannel  = image.numberOfChannels - 1;
   return image.render();
}

function pointOf(a)
{
   return new Point(a[0], a[1]);
}

function primaryScreenDimensions()
{
   //
   // get MainWindow\Geometry width & height
   //
   var roamingDir = File.homeDirectory + '/AppData/Roaming/Pleiades';
   var ini = roamingDir + '/PixInsight.ini';
   var x = 0;
   var y = 0;
   var w = 0;
   var h = 0;

   if (File.exists(ini))
   {
      var iniStrings = File.readLines(ini);
      for (var i = 0; i < iniStrings.length; i++)
      {
         var s = iniStrings[i];
         var j = s.indexOf('=');
         if (s.startsWith('MainWindow\\Geometry\\Top') && y == 0)
            y = s.substr(j + 1).toInt();
         if (s.startsWith('MainWindow\\Geometry\\Left') && x == 0)
            x = s.substr(j + 1).toInt();
         if (s.startsWith('MainWindow\\Geometry\\PrimaryScreenWidth') && w == 0)
            w = s.substr(j + 1).toInt();
         if (s.startsWith('MainWindow\\Geometry\\PrimaryScreenHeight') && h == 0)
            h = s.substr(j + 1).toInt();
         if (x > 0 && y > 0 &&  w > 0 && h > 0) break;
      }
      return new Rect(x, y, x + w, y + h);
   }
   else
   {
      var window = new ImageWindow(10000, 10000);
      window.zoomFactor = 1;
      window.fitWindow();
      var r = window.geometry;
      r.moveTo(24, 24);
      window.close();
      return r;
   }
}

/*
 * STF Auto Stretch routine
 */
function ApplyAutoSTF( view, shadowsClipping, targetBackground, rgbLinked )
{
   var stf = new ScreenTransferFunction;

   var n = view.image.isColor ? 3 : 1;

   var median = view.computeOrFetchProperty( "Median" );

   var mad = view.computeOrFetchProperty( "MAD" );
   mad.mul( 1.4826 ); // coherent with a normal distribution

   if ( rgbLinked )
   {
      /*
       * Try to find how many channels look as channels of an inverted image.
       * We know a channel has been inverted because the main histogram peak is
       * located over the right-hand half of the histogram. Seems simplistic
       * but this is consistent with astronomical images.
       */
      var invertedChannels = 0;
      for ( var c = 0; c < n; ++c )
         if ( median.at( c ) > 0.5 )
            ++invertedChannels;

      if ( invertedChannels < n )
      {
         /*
          * Noninverted image
          */
         var c0 = 0, m = 0;
         for ( var c = 0; c < n; ++c )
         {
            if ( 1 + mad.at( c ) != 1 )
               c0 += median.at( c ) + shadowsClipping * mad.at( c );
            m  += median.at( c );
         }
         c0 = Math.range( c0/n, 0.0, 1.0 );
         m = Math.mtf( targetBackground, m/n - c0 );

         stf.STF = [ // c0, c1, m, r0, r1
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [c0, 1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
      else
      {
         /*
          * Inverted image
          */
         var c1 = 0, m = 0;
         for ( var c = 0; c < n; ++c )
         {
            m  += median.at( c );
            if ( 1 + mad.at( c ) != 1 )
               c1 += median.at( c ) - shadowsClipping * mad.at( c );
            else
               c1 += 1;
         }
         c1 = Math.range( c1/n, 0.0, 1.0 );
         m = Math.mtf( c1 - m/n, targetBackground );

         stf.STF = [ // c0, c1, m, r0, r1
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, c1, m, 0, 1],
                     [0, 1, 0.5, 0, 1] ];
      }
   }
   else
   {
      /*
       * Unlinked RGB channnels: Compute automatic stretch functions for
       * individual RGB channels separately.
       */
      var A = [ // c0, c1, m, r0, r1
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1],
               [0, 1, 0.5, 0, 1] ];

      for ( var c = 0; c < n; ++c )
      {
         if ( median.at( c ) < 0.5 )
         {
            /*
             * Noninverted channel
             */
            var c0 = (1 + mad.at( c ) != 1) ? Math.range( median.at( c ) + shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 0.0;
            var m  = Math.mtf( targetBackground, median.at( c ) - c0 );
            A[c] = [c0, 1, m, 0, 1];
         }
         else
         {
            /*
             * Inverted channel
             */
            var c1 = (1 + mad.at( c ) != 1) ? Math.range( median.at( c ) - shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 1.0;
            var m  = Math.mtf( c1 - median.at( c ), targetBackground );
            A[c] = [0, c1, m, 0, 1];
         }
      }

      stf.STF = A;
   }

   stf.executeOn( view );
}

function ApplyHistogram(view)
{
   var stf = view.stf;

   var H = [[  0, 0.0, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0],
            [  0, 0.5, 1.0, 0, 1.0]];

   if (view.image.isColor)
   {
      for (var c = 0; c < 3; c++)
      {
         H[c][0] = stf[c][1];
         H[c][1] = stf[c][0];
      }
   }
   else
   {
      H[3][0] = stf[0][1];
      H[3][1] = stf[0][0];
   }

   var STF = new ScreenTransferFunction;

   view.stf =  [ // c0, c1, m, r0, r1
   [0.00000, 1.00000, 0.50000, 0.00000, 1.00000],
   [0.00000, 1.00000, 0.50000, 0.00000, 1.00000],
   [0.00000, 1.00000, 0.50000, 0.00000, 1.00000],
   [0.00000, 1.00000, 0.50000, 0.00000, 1.00000]
   ];

   STF.executeOn(view)

   var HT = new HistogramTransformation;
   HT.H = H;
   HT.executeOn(view)
}

function Advanced_process_star_mask(view)
{
   var P = new MultiscaleLinearTransform;
   P.layers = [ // enabled, biasEnabled, bias, noiseReductionEnabled, noiseReductionThreshold, noiseReductionAmount, noiseReductionIterations
      [false, true, 0.000, false, 3.000, 1.00, 1],
      [true, true, 0.000, false, 3.000, 1.00, 1],
      [true, true, 0.000, false, 40.000, 1.00, 1],
      [true, true, 0.500, true, 40.000, 1.00, 1],
      [false, true, 0.000, false, 3.000, 1.00, 1]
   ];
   P.transform = MultiscaleLinearTransform.prototype.StarletTransform;
   P.scaleDelta = 0;
   P.scalingFunctionData = [
      0.25,0.5,0.25,
      0.5,1,0.5,
      0.25,0.5,0.25
   ];
   P.scalingFunctionRowFilter = [
      0.5,
      1,
      0.5
   ];
   P.scalingFunctionColFilter = [
      0.5,
      1,
      0.5
   ];
   P.scalingFunctionNoiseSigma = [
      0.8003,0.2729,0.1198,
      0.0578,0.0287,0.0143,
      0.0072,0.0036,0.0019,
      0.001
   ];
   P.scalingFunctionName = "Linear Interpolation (3)";
   P.linearMask = false;
   P.linearMaskAmpFactor = 100;
   P.linearMaskSmoothness = 1.00;
   P.linearMaskInverted = true;
   P.linearMaskPreview = false;
   P.largeScaleFunction = MultiscaleLinearTransform.prototype.NoFunction;
   P.curveBreakPoint = 0.75;
   P.noiseThresholding = true;
   P.noiseThresholdingAmount = 1.00;
   P.noiseThreshold = 10.00;
   P.softThresholding = true;
   P.useMultiresolutionSupport = false;
   P.deringing = false;
   P.deringingDark = 0.1000;
   P.deringingBright = 0.0000;
   P.outputDeringingMaps = false;
   P.lowRange = 0.0000;
   P.highRange = 0.0000;
   P.previewMode = MultiscaleLinearTransform.prototype.Disabled;
   P.previewLayer = 0;
   P.toLuminance = true;
   P.toChrominance = true;
   P.linear = false;
   P.executeOn(view);


   P = new CurvesTransformation;
   P.R = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.Rt = CurvesTransformation.prototype.AkimaSubsplines;
   P.G = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.Gt = CurvesTransformation.prototype.AkimaSubsplines;
   P.B = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.Bt = CurvesTransformation.prototype.AkimaSubsplines;
   P.K = [ // x, y
      [0.00000, 0.00000],
      [0.32957, 0.25195],
      [0.55079, 0.72987],
      [1.00000, 1.00000]
   ];
   P.Kt = CurvesTransformation.prototype.AkimaSubsplines;
   P.A = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.At = CurvesTransformation.prototype.AkimaSubsplines;
   P.L = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.Lt = CurvesTransformation.prototype.AkimaSubsplines;
   P.a = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.at = CurvesTransformation.prototype.AkimaSubsplines;
   P.b = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.bt = CurvesTransformation.prototype.AkimaSubsplines;
   P.c = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.ct = CurvesTransformation.prototype.AkimaSubsplines;
   P.H = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.Ht = CurvesTransformation.prototype.AkimaSubsplines;
   P.S = [ // x, y
      [0.00000, 0.00000],
      [1.00000, 1.00000]
   ];
   P.St = CurvesTransformation.prototype.AkimaSubsplines;
   P.executeOn(view);

   P = new MorphologicalTransformation;
   P.operator = MorphologicalTransformation.prototype.Dilation;
   P.interlacingDistance = 1;
   P.lowThreshold = 0.000000;
   P.highThreshold = 0.000000;
   P.numberOfIterations = 1;
   P.amount = 1.00;
   P.selectionPoint = 0.50;
   P.structureName = "";
   P.structureSize = 7;
   P.structureWayTable = [ // mask
      [[
         0x00,0x00,0x01,0x01,0x01,0x00,0x00,
         0x00,0x01,0x01,0x01,0x01,0x01,0x00,
         0x01,0x01,0x01,0x01,0x01,0x01,0x01,
         0x01,0x01,0x01,0x01,0x01,0x01,0x01,
         0x01,0x01,0x01,0x01,0x01,0x01,0x01,
         0x00,0x01,0x01,0x01,0x01,0x01,0x00,
         0x00,0x00,0x01,0x01,0x01,0x00,0x00
      ]]
   ];
   P.executeOn(view);


   P = new Convolution;
   P.mode = Convolution.prototype.Parametric;
   P.sigma = 2.00;
   P.shape = 2.00;
   P.aspectRatio = 1.00;
   P.rotationAngle = 0.00;
   P.filterSource = "";
   P.rescaleHighPass = false;
   P.viewId = "";
   P.executeOn(view);
}


function defaultSettings()
{
   var defs =
   {
      // General
      importAllways: true,
      persistData:   true,          // if true, save figures as fits keys

      // Ankerpoints
      apDiameter:    15,
      apFilled:      true,
      apColor:       0xff00ffff,

      // Centerpoints
      cpDiameter:    20,
      cpStyle:       true,          // circle = true, rect otherwise
      cpFilled:      true,
      cpColor:       0xffff0000,

      // Active figure line
      afLineStyle:   true,          // PenStyle_Solid | PenStyle_Dash
      afLineColor:   0xff00ffff,

      // Multipoint
      bezier:        true,
      viewAp:        true,
      transparency:  0.15,

      // Gradient center point
      gpDiameter:    25,
      gpStyle:       true,          // tringle = true
      gpFilled:      true,
      gpColor:       0xff00ff00,

      // version check
      version:       VERSION
   }
   return defs;
}

// *****************************************************************************
// *****************************************************************************
// *****************************************************************************
// *****************************************************************************

function compressToSubs(string)
{
   //
   // compress a string to subs
   //
   var subs = [];
   var m = string.length + 132;
   var b = new ByteArray(string);

   var compression =  new Compression(Compression_ZLib) ;

   while (b.length < m)
   {
      var iBuf = b.toInt8Array();
      subs = compression.compress(iBuf);
      if (subs.length == 0)
         b.add(' ');    // add blanks, until iBuf is accepted to zlib compression
      else
         break;
   }
   return subs;

}

function uncompressSubs(subs)
{
   //
   // uncompress from subs
   //
   var compression  = new Compression(Compression_ZLib);
   var uByteArray = compression.uncompress (subs);
   var uncompressed = uByteArray.utf8ToString();
   return uncompressed.trim();   // remove blanks
}

function subsToByteArray(subs)
{

   var stream = new ByteArray();

   for (var i = 0; i < subs.length; i++)
   {
      var sub = subs[i];
      //   struct Subblock
      //   {
      //      ByteArray compressedData;
      //      size_type uncompressedSize = 0;
      //      uint64    checksum         = 0;
      //   };
      var compressedData   = sub[0];   // object
      var uncompressedSize = sub[1];   // number
      var checksum1        = sub[2];   // number
      var checksum2        = sub[3];   // number
      var compressedLen    = compressedData.length;
      var hdr = new Int32Array(4);
      hdr[0] = checksum1;
      hdr[1] = checksum2;
      hdr[2] = uncompressedSize;
      hdr[3] = compressedLen;
      stream.add(new ByteArray(hdr));
      stream.add(compressedData);
   }
   return stream;
}

function byteArrayToSubs(stream)
{
   var subs = [];

   var i = 0;
   while (i < stream.length)
   {
      var hdr = stream.toUint32Array(i, 16);
      var checksum1        = hdr[0];
      var checksum2        = hdr[1];
      var uncompressedSize = hdr[2];
      var compressedLen    = hdr[3];
      i += 16;
      var compressedData   = new ByteArray(stream, i, compressedLen);
      var sub = [compressedData, uncompressedSize, checksum1, checksum2];
      subs.push(sub);
      i += compressedLen;
   }
   return subs;
}

// *****************************************************************************

function jsonFromHeader (window)
{
   //
   // collect GAME-keys
   //
   var base64 = '';
   for (var i = 0; i < window.keywords.length; i++)
   {
      var key = window.keywords[i];
      if (key.name.startsWith('GAME'))
      {
         base64 += key.strippedValue;
      }
   }
   //
   if (base64.length == 0) return null;
   //
   //
   //
   var stream2 = ByteArray.fromBase64(base64);
   //
   var subs2 = byteArrayToSubs(stream2);

   var stringOutput = uncompressSubs(subs2);

   return stringOutput;
}

// *****************************************************************************

function jsonToHeader(strJSON, window)
{

   function pad(s)
   {
      while (s.length < 4) s = '0' + s;
      return s;
   }
   function isNumeric(num) {return !isNaN(num)}
   //
   // get keys from imagewindow
   //
   var keys = [];
   for (var i = 0; i < window.keywords.length; i++)
   {
      var key = window.keywords[i];
      if (!key.name.startsWith('GAME')) keys.push(key);
   }
   //
   if (strJSON.length > 0)
   {
      //
      // compress strJSON
      //
      var subs1   = compressToSubs(strJSON)
      //
      var stream1 = subsToByteArray(subs1);
      //
      var base64  = stream1.toBase64();
      //
      // split to 64 chars length
      //
      var j = 0;
      var n = 1;
      //
      // add 1 key per 64 byte segment
      //
      while (j < base64.length)
      {
         var l = Math.min(64, base64.length - j);
         keys.push(new FITSKeyword('GAME' + pad(n.toString()), base64.substr(j, l)));
         j += l;
         n += 1;
      }
   }
   //
   // write to window
   //
   window.mainView.beginProcess(UndoFlag_NoSwapFile);
   window.keywords = keys;
   window.mainView.endProcess();
}
// *****************************************************************************
// *****************************************************************************
// *****************************************************************************
// *****************************************************************************


function Transparent(color, transparency)
{
   var r = Color.redF(color);
   var g = Color.greenF(color);
   var b = Color.blueF(color);
   var a = Color.alphaF(color);
   a *= transparency;
   var c = Color.rgbaColorF(r, g, b, a);
   return c;
}

PreviewControl.prototype = new Frame;

showDialog.prototype = new Dialog;

showOptions.prototype = new Dialog;

showSelectiveRejection.prototype = new Dialog;

showSelectMainviews.prototype = new Dialog;


//////////////////////////////////////////////////////////////////////////////
//
// Main script entry point
//
//////////////////////////////////////////////////////////////////////////////
function main()
{
   //
   //
   // Get access to the current active image window.
   //
   var window = ImageWindow.activeWindow;
   if ( window.isNull )
   {
      message( "No active image", "Error" );
   }
   else if (window.currentView.isPreview)
   {
      message("This script can not work on prewiews", "Error");
   }
   else
   {
      Console.hide();
		Console.show();
      var view = window.currentView;

      var dialog = new showDialog(view, window.currentView.id);

      dialog.execute();

      var views = getAllMainViews();
      for (var i = 0; i < views.length; i++)
      {
         if (views[i].propertyValue("dispose" ))
         {
            views[i].window.forceClose();
         }
      }
   }
}

main();
