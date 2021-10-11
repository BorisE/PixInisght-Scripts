#feature-id Batch Processing > OverscanStatistics


/* ver 0.1 [2021/10/10]
 * - working release, but everything is manual
 *
 * Use ProcessObj.processDirectory(path) to generate output csv file
 *
 * Use ProcessObj.processFile(WindowId) to process opened file (make previews and output stat to console)
 *
*/
#include <pjsr/Color.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/NumericControl.jsh>


// Global switches
 #ifndef DEBUG
 #define DEBUG true
 #endif
dbgCurrent = true;
cfgDebugLevel = 2;

// DEBUG
var dbgNormal = 1; //  минимальное количество сообщений
var dbgNotice = 2; // максимальное количество сообщений
var dbgCurrent = 0; // максимальное количество сообщений

var UseBinning = 2;

/* ********************************************************************
 *
 * declaration of the Engine object
 *
 * ******************************************************************** */
var textFile;

this.ProcessEngine = function () {

   this.inputImageWindow = null;

   this.res = [];
   this.res2 = [];

   /// Method to read an image from a file in to this.inputImageWindow .
   ///
   /// @param {string} filePath path to image file.
   this.readImage = function( filePath )
   {
      // Check that filePath exists.
      if ( !File.exists( filePath ) )
      {
         this.inputImageWindow = null;
         console.warningln("WARNING: Image file not found: " + filePath );
      }
      else
      {
         // Open the image file.
         try
         {
            this.inputImageWindow = ImageWindow.open( filePath );
         }
         catch ( error )
         {
            this.inputImageWindow = null;
            console.warningln( "WARNING: Unable to open image file: " + filePath + " (" + error.message + ")." );
         }
      }
      debug("BatchStatisticsDialog.readImage: "+ filePath);
      return ( !this.inputImageWindow.isNull );
   };



   /// Method to close current image window.
   ///
   this.closeImage = function()
   {
      try
      {
         if ( this.inputImageWindow != null )
         {
            this.inputImageWindow[0].close();
            this.inputImageWindow  = null;
         }
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
      }
      debug("BatchStatisticsDialog.closeImage");

   };

   this.OptBlackRect_bin1 =   new Rect (   0,    0,   22, 6389);
   this.BlackRect_bin1 =      new Rect (  22,    0,   24, 6389);
   this.OverscanRect_bin1 =   new Rect (   0, 6389, 9600, 6422);
   this.MainRect_bin1 =       new Rect (  24,    0, 9600, 6389);

   this.OptBlackRect_bin2 =   new Rect (   0,    0,   11, 3195);
   this.BlackRect_bin2 =      new Rect (  11,    0,   12, 3195);
   this.OverscanRect_bin2 =   new Rect (   0, 3195, 4800, 6422);
   this.MainRect_bin2 =       new Rect ( 12,    0, 4800, 3195);



   this.createOverscanPreviews = function (targetWindow, binning = 1)
   {
      if (binning == 1)
      {
         targetWindow.createPreview( this.OptBlackRect_bin1, "OptBlack");
         targetWindow.createPreview( this.BlackRect_bin1,    "Black");
         targetWindow.createPreview( this.OverscanRect_bin1, "Overscan");
         targetWindow.createPreview( this.MainRect_bin1,     "Main");
      }
      else if (binning == 2)
      {
         targetWindow.createPreview( this.OptBlackRect_bin2, "OptBlack");
         targetWindow.createPreview( this.BlackRect_bin2,    "Black");
         targetWindow.createPreview( this.OverscanRect_bin2, "Overscan");
         targetWindow.createPreview( this.MainRect_bin2,     "Main");
      }
   }


   this.getStatistics = function (targetWindow, binning = 1)
   {
      /*
      this.res[0] = targetWindow.mainView.id;
      this.res[1] = targetWindow.previews[3].image.median();
      this.res[2] = targetWindow.previews[0].image.median();
      this.res[3] = targetWindow.previews[2].image.median();
      this.res[4] = targetWindow.previews[1].image.median();
      */

      this.res2[0] = targetWindow.mainView.id;
      if (binning == 1)
      {
         this.res2[1] = targetWindow.mainView.image.median(this.MainRect_bin1);
         this.res2[2] = targetWindow.mainView.image.median(this.OptBlackRect_bin1);
         this.res2[3] = targetWindow.mainView.image.median(this.OverscanRect_bin1);
         this.res2[4] = targetWindow.mainView.image.median(this.BlackRect_bin1);
      }
      else if (binning == 2)
      {
         this.res2[1] = targetWindow.mainView.image.median(this.MainRect_bin2);
         this.res2[2] = targetWindow.mainView.image.median(this.OptBlackRect_bin2);
         this.res2[3] = targetWindow.mainView.image.median(this.OverscanRect_bin2);
         this.res2[4] = targetWindow.mainView.image.median(this.BlackRect_bin2);
      }
      this.res2[5] = (String)(this.res2[3] - this.res2[2]);
   }

   this.displayStatistics = function ()
   {
      console.write(this.res2[0]);
      console.note("|");
      console.write(this.res2[1]);
      console.note("|");
      console.write(this.res2[2]);
      console.note("|");
      console.write(this.res2[3]);
      console.note("|");
      console.write(this.res2[4]);
      console.note("|");
      console.write(this.res2[5]);
      console.noteln();

   }

   this.processFile=function (curWindow, binnig = 1, makePreviews = true, leavePreviews = true)
   {
      if (makePreviews)
         this.createOverscanPreviews (curWindow, binnig);

      this.getStatistics(curWindow, binnig);
      this.displayStatistics();

      if (makePreviews && !leavePreviews)
         curWindow.deletePreviews();
   }

   this.DirCount=0;

   /**
   * Базовая функция для 1го прохода
   *
   * @param file string
   * @return object
   */
   this.processDirectory = function (searchPath, binnig)
   {
      this.DirCount++;
      var FileCount = 0;
      console.noteln("<end><cbr><br>",
         "************************************************************");
      Console.noteln('* ' + this.DirCount + '. Searching dir: ' + searchPath + ' for fits');
      console.noteln("************************************************************");


      // Open outputfile
      try
      {
         textFile = new File;
         textFile.createForWriting( searchPath + '/overscandata.txt');
      }
      catch ( error )
      {
         // Unable to create file.
         console.warningln( "WARNING: Unable to create file: " + outputFile + " Outputting to console only. (" + error.message + ")." );
         textFile = null;
      }

      // output header
      textFile.outText("Filename,\tMain,\tOptBlack,\tOverscan,\tBlack,\tDiff" + String.fromCharCode( 13, 10 ));

      // Begin search
      var objFileFind = new FileFind;

      if (objFileFind.begin(searchPath + "/*")) {
         do {
            // if not upper dir links
            if (objFileFind.name != "." && objFileFind.name != "..") {

               // if this is Directory and recursion is enabled
               if (objFileFind.isDirectory && this.SearchInSubDirs) {
                    // Run recursion search
                    busy = false; // на будущее для асихнронного блока
                    this.searchDirectory(searchPath + '/' + objFileFind.name);
                    busy = true;
               }
               // if File
               else {
                  debug('File found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  debug('Extension: ' + fileExtension(objFileFind.name), dbgNotice);
                  // if this is FIT
                  if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits')) {

                     this.readImage(searchPath + '/' + objFileFind.name);

                     this.processFile(this.inputImageWindow[0], binnig, false);

                     textFile.outText( this.res2[0] + ",\t");
                     textFile.outText( this.res2[1] + ",\t");
                     textFile.outText( this.res2[2] + ",\t");
                     textFile.outText( this.res2[3] + ",\t");
                     textFile.outText( this.res2[4] + ",\t");
                     textFile.outText( this.res2[5] );
                     textFile.outText( String.fromCharCode( 13, 10 ));

                     this.closeImage();

                  }
                  else {
                     debug('Skipping any actions on file found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  }
               }
            }
         } while (objFileFind.next());
      }

      // Close statistics output file.
      if ( textFile != null )
      {
         textFile.close();
         textFile = null;
      }
   }

} //end of class



	function main()
	{
		var curWindow = ImageWindow.activeWindow;
		if ( curWindow.isNull )
			throw new Error( "No active image" );
		Console.abortEnabled = true;
		//Console.show();


      var ProcessObj = new ProcessEngine();

      console.noteln("Filename|Main|OptBlack|Overscan|Black|");

      //ProcessObj.processDirectory("e:/DSlrRemote/_labs/qhy600 overscan/Bias -20 Bin1 P3", 1);
      //ProcessObj.processDirectory("e:/DSlrRemote/_labs/qhy600 overscan/Darks -20 Bin1 300s P3", 1);
      //ProcessObj.processDirectory("e:/DSlrRemote/_labs/qhy600 overscan/Bias -25 Bin1 P3", 1);
      //ProcessObj.processDirectory("e:/DSlrRemote/-NGC7217/2021-10-09", 1);

      ProcessObj.processDirectory("e:/DSlrRemote/_labs/qhy600 overscan/Bias -20 Bin2 P3", 2);

      //ProcessObj.processFile(curWindow, 1);

   }


main();


function debug(st, level = dbgCurrent) {
    if (DEBUG && level <= cfgDebugLevel) {
        if (level == dbgNotice) {
            console.write("<sub>");
            console.write(st);
            console.writeln("</sub>");
        } else {
            console.writeln(st);
        }
    }
}

/**
* Поиск расширения файла
*/
function fileExtension(file) {
    //console.writeln('ext file='+ file);
    var ext = file.match(/\.([^.]+)$/);

    return ext && ext.length ? ext[1] : false
}
