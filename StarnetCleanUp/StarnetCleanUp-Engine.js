#ifndef StarnetCleanUp_ProcessEngine_js
#define StarnetCleanUp_ProcessEngine_js
#endif
// Global switches
 #ifndef DEBUG
    #define DEBUG true
 #endif

// Includes
 #ifndef StarnetCleanUp_Global_js
    #include "StarnetCleanUp-global.js" // Ver, Title and other info
 #endif
 #ifndef StarnetCleanUp_settings_js
    #include "StarnetCleanUp-settings.js" // Settings
   var Config = new ConfigData(); // Variable for global access to script data
 #endif
 #ifndef StarnetCleanUp_config_default_js
   #include "StarnetCleanUp-config-default.js" // Load default config values
 #endif

var PEDESTAL_INIT = 0.1;
var PEDESTAL_TOLERANCE_POW = 3;
var PEDESTAL_TOLERANCE = Math.pow10(-PEDESTAL_TOLERANCE_POW);
var PEDESTAL_MAX_ITERATIONS = 5;


/*
Схема

1. Очистить Starnet (Starnet_cleaned)
2. Stars = Original - Starnet_cleaned
3. Очистить Stars (Stars_cleaned)
4. Stars_diff  = Stars - Stars_cleaned
5. Starnet_merged  = Starnet_cleaned + Stars_diff

На выходе:
   Starnet_merged
   Stars_cleaned
*/

this.ProcessEngine = function () {

   this.Original_Id = ""
   this.Starnet_Id = "";
   this.Starnet_Cleaned_Id = "";
   this.Stars_Id = "";  // можно получит через makeStarsImage()
   this.Stars_Cleaned_Id = "";// можно получить через makeStarnetMergedImage(), финальный файл
   this.Stars_Diff_Id = ""; // можно получить makeStarsDifferenceImage(), промежуточный файл
   this.Starnet_Merged_Id = "";    // Финальный объект

   this.Original_ImageWindow = null;
   this.Starnet_ImageWindow = null;
   this.Starnet_Cleaned_ImageWindow = null;
   this.Stars_ImageWindow = null;
   this.Stars_Cleaned_ImageWindow = null;
   this.Stars_Diff_ImageWindow = null;
   this.Starnet_Merged_ImageWindow = null;

   // Получить объекты View на основании их id
   this.getImageReferences = function () {

      if (this.Original_Id == "") this.Original_ImageWindow = null
      else this.Original_ImageWindow = ImageWindow.windowById(this.Original_Id).mainView;  //type View

      if (this.Starnet_Id == "") this.Starnet_ImageWindow = null
      else this.Starnet_ImageWindow = ImageWindow.windowById(this.Starnet_Id).mainView;  //type View

      if (this.Starnet_Cleaned_Id == "") this.Starnet_Cleaned_ImageWindow = null
      else this.Starnet_Cleaned_ImageWindow = ImageWindow.windowById(this.Starnet_Cleaned_Id).mainView;  //type View

      if (this.Stars_Id == "") this.Stars_ImageWindow = null
      else this.Stars_ImageWindow = ImageWindow.windowById(this.Stars_Id).mainView;  //type View

      if (this.Stars_Cleaned_Id == "") this.Stars_Cleaned_ImageWindow = null
      else this.Stars_Cleaned_ImageWindow = ImageWindow.windowById(this.Stars_Cleaned_Id).mainView;    //type View

      if (this.Stars_Diff_Id == "") this.Stars_Diff_ImageWindow = null
      else this.Stars_Diff_ImageWindow = ImageWindow.windowById(this.Stars_Diff_Id).mainView;    //type View

   }

   // make stars image
   this.makeStarsImage = function () {


      debug(this.Original_Id);
      debug(this.Starnet_Cleaned_Id);

      var Pedestal = PEDESTAL_INIT;
      var pedestal_not_good = true;
      var iter = 0;


      while( ++iter < PEDESTAL_MAX_ITERATIONS && pedestal_not_good )
      {
         this.Stars_Cleaned_Id = ResolveDuplicateNames(this.Original_Id + "_Stars");

         debug(this.Stars_Cleaned_Id);

         var P = new PixelMath;
         P.expression = this.Original_Id + " - " + this.Starnet_Cleaned_Id + " + " + Pedestal;
         P.useSingleExpression = true;
         P.optimization = true;
         P.rescale = false;
         P.truncate = true;
         P.truncateLower = 0;
         P.truncateUpper = 1;
         P.createNewImage = true;
         P.showNewImage = true;
         P.newImageId = this.Stars_Cleaned_Id;
         P.newImageWidth = 0;
         P.newImageHeight = 0;
         P.newImageAlpha = false;
         P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
         P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
         P.executeOn(this.Original_ImageWindow, false /*swapFile */);

         this.Stars_Cleaned_ImageWindow = ImageWindow.windowById(this.Stars_Cleaned_Id).mainView;

         var minV = this.Stars_Cleaned_ImageWindow.image.minimum();
         console.note("Iteration: " + iter + "\tPedestal: " + Pedestal + "\t");
         console.noteln("Minimum: " + minV);

         if (minV == 0) Pedestal = Pedestal + 0.1;
         if (minV == 1) Pedestal = Pedestal - 0.1;
         if (minV > PEDESTAL_TOLERANCE ) {
            console.write("new pedestal: " + (Pedestal - minV) + "\t");
            Pedestal = Math.max(Math.roundTo(Pedestal - minV, PEDESTAL_TOLERANCE_POW), PEDESTAL_TOLERANCE);
            console.writeln("" + Pedestal);
            this.Stars_Cleaned_ImageWindow.window.forceClose();
         }
         else
         {
            pedestal_not_good = false;
         }
      }
   }


   // make star difference image
   // this is intermediate result
   this.makeStarsDifferenceImage = function () {

      var Pedestal = PEDESTAL_INIT;
      var pedestal_not_good = true;
      var iter = 0;

      while( ++iter < PEDESTAL_MAX_ITERATIONS && pedestal_not_good )
      {
         this.Stars_Diff_Id = ResolveDuplicateNames(this.Original_Id + "_Stars_diff");

         var P = new PixelMath;
         P.expression = this.Stars_Id + " - " + this.Stars_Cleaned_Id + " + " + Pedestal;
         P.useSingleExpression = true;
         P.optimization = true;
         P.rescale = false;
         P.truncate = true;
         P.truncateLower = 0;
         P.truncateUpper = 1;
         P.createNewImage = true;
         P.showNewImage = true;
         P.newImageId = this.Stars_Diff_Id;
         P.newImageWidth = 0;
         P.newImageHeight = 0;
         P.newImageAlpha = false;
         P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
         P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
         P.executeOn(this.Original_ImageWindow, false /*swapFile */);

         this.Stars_Diff_ImageWindow = ImageWindow.windowById(this.Stars_Diff_Id).mainView;

         var minV = this.Stars_Diff_ImageWindow.image.minimum();
         console.note("Iteration: " + iter + "\tPedestal: " + Pedestal + "\t");
         console.noteln("Minimum: " + minV);

         if (minV == 0) Pedestal = Pedestal + 0.1;
         if (minV == 1) Pedestal = Pedestal - 0.1;
         if (minV > PEDESTAL_TOLERANCE ) {
            console.write("new pedestal: " + (Pedestal - minV) + " ->");
            Pedestal = Math.max(Math.roundTo(Pedestal - minV, PEDESTAL_TOLERANCE_POW), PEDESTAL_TOLERANCE);
            console.writeln(" " + Pedestal);
            this.Stars_Diff_ImageWindow.window.forceClose();
         }
         else
         {
            pedestal_not_good = false;
         }
      }
   }


   // make combined starnet image
   this.makeStarnetMergedImage = function () {

      var Pedestal = PEDESTAL_INIT;
      var pedestal_not_good = true;
      var iter = 0;

      while( ++iter < PEDESTAL_MAX_ITERATIONS && pedestal_not_good )
      {
         this.Starnet_Merged_Id = ResolveDuplicateNames(this.Original_Id + "_Starnet_merged");

         var P = new PixelMath;
         P.expression = this.Starnet_Cleaned_Id + " + " + this.Stars_Diff_Id + " + " + Pedestal;
         P.useSingleExpression = true;
         P.optimization = true;
         P.rescale = false;
         P.truncate = true;
         P.truncateLower = 0;
         P.truncateUpper = 1;
         P.createNewImage = true;
         P.showNewImage = true;
         P.newImageId = this.Starnet_Merged_Id;
         P.newImageWidth = 0;
         P.newImageHeight = 0;
         P.newImageAlpha = false;
         P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
         P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
         P.executeOn(this.Original_ImageWindow, false /*swapFile */);

         this.Starnet_Merged_ImageWindow = ImageWindow.windowById(this.Starnet_Merged_Id).mainView;

         var minV = this.Starnet_Merged_ImageWindow.image.minimum();
         console.note("Iteration: " + iter + "\tPedestal: " + Pedestal + "\t");
         console.noteln("Minimum: " + minV);

         if (minV == 0) Pedestal = Pedestal + 0.1;
         if (minV == 1) Pedestal = Pedestal - 0.1;
         if (minV > PEDESTAL_TOLERANCE ) {
            console.write("new pedestal: " + (Pedestal - minV) + " ->");
            Pedestal = Math.roundTo(Pedestal - minV, PEDESTAL_TOLERANCE_POW);
            console.writeln(" " + Pedestal);
            this.Starnet_Merged_ImageWindow.window.forceClose();
         }
         else
         {
            pedestal_not_good = false;
         }
      }


   }



}


function ResolveDuplicateNames(name)
{
   if (name.length == 0) name = "SCL" + Number(Math.round(1 + 998*Math.random())).toString();
   if ((name[0] >= "0") && (name[0] <= "9")) name = "_" + name;
   if (ImageWindow.windowById(name).isNull) return name;
   let suffix = 1;
   while ((suffix < 99) && (!(ImageWindow.windowById(name + suffix).isNull)))
   {  // if there are 99 windows with matching names then throw!!!
      ++suffix;
   }
   if (suffix >= 100) throw("Unable to generate unique image names");
   console.writeln("An image named '", name, "' is already open. Using new name '", name + suffix, "'.");
   name += suffix;
   return name;
}


//main
function mainTest() {
    if (!DEBUG)
        console.hide();

    if (DEBUG)
        console.clear();

    console.noteln(TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE);
    console.noteln("PixInsight Version: ", coreId, ", ", coreVersionBuild, ", ", coreVersionMajor,
        ", ", coreVersionMinor, ", ", coreVersionRelease);

    var Engine = new ProcessEngine();

    console.noteln("PEDESTAL_TOLERANCE=" + PEDESTAL_TOLERANCE);

    //Engine.makeStarsDifferenceImage();
    Engine.makeStarnetMergedImage();

}

//mainTest();
