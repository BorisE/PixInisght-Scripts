#ifndef OverscanStatistics_ProcessEngine_js
#define OverscanStatistics_ProcessEngine_js
#endif
// Global switches
 #ifndef DEBUG
    #define DEBUG true
 #endif

// Includes
 #ifndef OverscanStatistics_Global_js
    #include "OverscanStatistics-global.js" // Ver, Title and other info
 #endif
 #ifndef OverscanStatistics_settings_js
    #include "OverscanStatistics-settings.js" // Settings
   var Config = new ConfigData(); // Variable for global access to script data
 #endif
 #ifndef OverscanStatistics_config_default_js
   #include "OverscanStatistics-config-default.js" // Load default config values
 #endif

 #include "OverscanStatistics-QHYHeaders.js" // include QHY object lib

this.ProcessEngine = function () {

   this.inputImageWindow = null; //current opened image file (ImageWindow object)

   this.res = [];
   this.statData = [];

   this.DirCount=0;
   this.textFile = null;

   this.QHYHeadersSubEngine = new ProcessQHYHeaders();

    /**
    *  Method to read an image from a file in to this.inputImageWindow (ImageWindow object).
    *
    *  @param   filePath   string   path to image file
    *  @return             bool     true if success
    */
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

      debug("OverscanUtils.readImage: "+ filePath, dbgNotice);
      return ( !this.inputImageWindow.isNull );
   };


    /**
    *  Method to close current image
    *
    *  @param   curWindow      ImageWindow    ImageWindow object
    *  @return  void
    */
   this.closeImage = function(curWindow)
   {
      try
      {
         if ( curWindow == null )
         {
            curWindow = this.inputImageWindow[0];
         }
         if ( curWindow != null )
         {
            curWindow.forceClose();
            this.inputImageWindow  = null;
         }
      }
      catch ( error )
      {
         console.warningln( "WARNING: Unable to close image : " + this.inputImageWindow.filePath + " (" + error.message + ")." );
         if (dbgCurrentPopupMessages) (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
      }
      debug("OverscanUtils.closeImage", dbgNotice);

   };

    /**
    *  Method to save current image
    *
    *  @param   curWindow      ImageWindow    ImageWindow object
    *  @return  void
    */
   this.saveImage = function( curWindow, newFileName )
   {
      try
      {
         if ( curWindow != null )
         {
             curWindow.save(false, true);
         }
      }
      catch ( error )
      {
         console.warningln( "WARNING: Unable to save image : " + this.inputImageWindow.filePath + " (" + error.message + ")." );
         if (dbgCurrentPopupMessages) (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
      }
      debug("OverscanUtils.saveImage", dbgNotice);

   };

   /**
    *  Method to save current image window with new name.
    *
    * @param   curWindow      ImageWindow    ImageWindow object
    * @return  void
    */
   this.saveAsImage = function( curWindow, newFileName )
   {
      try
      {
         if ( curWindow != null )
         {
             curWindow.saveAs(newFileName, false, false, true, false);
         }
      }
      catch ( error )
      {
         console.warningln( "WARNING: Unable to save as image : " + newFileName + " (" + error.message + ")." );
         if (dbgCurrentPopupMessages) (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
      }
      debug("OverscanUtils.saveAsImage: " + newFileName, dbgNotice);

   };

   /**
    *  Get file lastModified date
    *
    * @param   curWindow      ImageWindow    ImageWindow object
    * @return  Date
    */
   this.getImageDate = function( curWindow )
   {
      try
      {
         if ( curWindow != null )
         {
             var FI = new FileInfo (curWindow.filePath);
             var FD = FI.lastModified;
             //debug(FD);
             var DateSt = FD.getFullYear()+"-"+(FD.getMonth()+1)+"-"+FD.getDate() + " " + FD.getHours()+":"+FD.getMinutes()+":"+FD.getSeconds();
             //debug(DateSt);
         }
         else
         {
            throw new Error('curWindow in null');
         }
      }
      catch ( error )
      {
         console.warningln( "WARNING: Unable to get image date: " + (curWindow == null ? "null" : curWindow.filePath) + " (" + error.message + ")." );
         if (dbgCurrentPopupMessages) (new MessageBox(error.message)).execute();
      }
      debug("OverscanUtils.getImageDate", dbgNotice);
      return DateSt;
   };

   /**
    *  Run external program to restore lastModified date
    *
    * @param   fileName    string    full file name (with path)
    * @param   date        string    date string "YYYY-MM-dd HH:ii:ss"
    * @return  result      int       external result
    */
   this.restoreDate = function (fileName, date)
   {
      try
      {
         var res = ExternalProcess.execute("cscript.exe", [Config.restoreDateJSScript, fileName, date]);
         if (res==0) {
            debug("FileDate for [" + fileName +"] restored to [" + date + "]");
         }
         else{
            Console.criticalln("FileDate for [" + fileName +"] can't be restored. Error " + res);
         }
      }
      catch ( error )
      {
         console.criticalln( "CRITICAL: Unable to run js restore script for " + fileName  + " [" + date+ "]" + " (" + error.message + ").");
         if (dbgCurrentPopupMessages) (new MessageBox(error.message)).execute();
      }
      debug("OverscanUtils.restoreDate", dbgNotice);
      return res;
   }


   // Полезные FITS поля
   var headers = {
       'XBINNING': null,
       'OBSERVER': null,
       'TELESCOP': null,
       'INSTRUME': null,
       'DATE-OBS': null,
       'EXPTIME': null,
       'CCD-TEMP': null,
       'XPIXSZ': null,
       'FOCALLEN': null,
       'FILTER': null,
       'OBJECT': null,
       'OBJCTRA': null,
       'OBJCTDEC': null,

       'READOUTM': null,
       'GAIN': null,
       'OFFSET': null,
       'QOVERSCN': null,
       'QPRESET': null,
       'USBLIMIT': null
   };


   /**
    *  Get FITS headers
    *
    * @param   curWindow    ImageWindow     ImageWindow object
    * @return               void
    */
   this.getImageHeaders = function (curImageWindow)
   {
       if (headers.XBINNING != null) return;

       var keywords = curImageWindow.keywords;
       for (var k in keywords) {
            if (typeof headers[keywords[k].name] != 'undefined') {
				   keywords[k].trim();
               headers[keywords[k].name] = keywords[k].strippedValue;
               debug('header ' + keywords[k].name + '=' + keywords[k].strippedValue, dbgNotice);
            }
       }
   }


   /**
    *  Get FITS headers and return binnig for a curImageWindow
    *
    * @param   curWindow    ImageWindow     ImageWindow object
    * @return               int             binning value
    */
   this.getImageBinning = function (curImageWindow)
   {
        this.getImageHeaders(curImageWindow);
        return parseInt(headers.XBINNING);
   }

   /**
    *  return Normalization level for a curImageWindow
    *
    * @param   curWindow    ImageWindow     ImageWindow object
    * @return               int             Normalization bias value
    */
   this.getImageNormalizationLevel = function (curImageWindow)
   {
      this.getImageHeaders(curImageWindow);

      var BinIDX = 'bin'+ parseInt(headers.XBINNING);
      debug("Bin Idx: " + BinIDX, dbgNotice);
      debug("temp: " + headers['CCD-TEMP'], dbgNotice);
      //var Temp = parseInt(headers.XBINNING);
      var PresetIDX = 'P'+ parseInt(headers['QPRESET']);
      debug("Preset Index: " + PresetIDX, dbgNotice);

      var TempArr = Object.keys(Config.NormalizationTable[PresetIDX][BinIDX]);
      var TempArr_diff = new Array(TempArr.length);
      for (var i = 0; i < TempArr.length; i++) {
         TempArr_diff[i] = Math.abs(TempArr[i] - headers['CCD-TEMP']);
         debug("Look in "  + TempArr[i] + ", diff=" + TempArr_diff[i], dbgNotice);
      }
      var min_TempArr_diff = 100000;
      var min_TempArr_diff_idx  = -1;
      for (var i = 0; i < TempArr_diff.length; i++) {
         if (TempArr_diff[i] < min_TempArr_diff) {
            min_TempArr_diff = TempArr_diff[i];
            min_TempArr_diff_idx = i;
         }
      }
      if (min_TempArr_diff_idx >=0)
         debug("Nearest bias temp value is " + TempArr[min_TempArr_diff_idx]);

      var NormLevel = Config.NormalizationTable[PresetIDX][BinIDX][TempArr[min_TempArr_diff_idx]]
      debug("Normlevel: " + NormLevel);
      return NormLevel;
   }



   this.OptBlackRect_bin1 =   new Rect (   0,    0,   22, 6388); //using x0,y0 - x1,y1 system, NOT x0,y0, W, H
   this.BlackRect_bin1 =      new Rect (  22,    0,   24, 6388);
   this.OverscanRect_bin1 =   new Rect (   0, 6389, 9600, 6422);
   this.MainRect_bin1 =       new Rect (  24,    0, 9600, 6388);

   this.OptBlackRect_bin2 =   new Rect (   0,    0,   11, 3194);
   this.BlackRect_bin2 =      new Rect (  11,    0,   12, 3194);
   this.OverscanRect_bin2 =   new Rect (   0, 3195, 4800, 3211);
   this.MainRect_bin2 =       new Rect ( 12,     0, 4800, 3194);


    /**
    *  Create Overscan Previews
    *
    * @param   targetWindow    ImageWindow      ImageWindow object
    * @param   binning         int              binning for targetWindow
    * @return                  void
    */
   this.createOverscanPreviews = function (targetWindow, binning = 1)
   {

      if (binning == 1)
      {
         if (!this.checkPreviewExist("OptBlack", targetWindow))  targetWindow.createPreview( this.OptBlackRect_bin1, "OptBlack");
         if (!this.checkPreviewExist("Black", targetWindow))     targetWindow.createPreview( this.BlackRect_bin1,    "Black");
         if (!this.checkPreviewExist("Overscan", targetWindow))  targetWindow.createPreview( this.OverscanRect_bin1, "Overscan");
         if (!this.checkPreviewExist("Main", targetWindow))      targetWindow.createPreview( this.MainRect_bin1,     "Main");
      }
      else if (binning == 2)
      {
         if (!this.checkPreviewExist("OptBlack", targetWindow))  targetWindow.createPreview( this.OptBlackRect_bin2, "OptBlack");
         if (!this.checkPreviewExist("Black", targetWindow))     targetWindow.createPreview( this.BlackRect_bin2,    "Black");
         if (!this.checkPreviewExist("Overscan", targetWindow))  targetWindow.createPreview( this.OverscanRect_bin2, "Overscan");
         if (!this.checkPreviewExist("Main", targetWindow))      targetWindow.createPreview( this.MainRect_bin2,     "Main");
      }
   }


    /**
    *  check if preview exists
    *
    * @param   previewId   string           preview name
    * @param   windowId    ImageWindow      ImageWindow object
    * @return              boolean          true if exists, false if not
    */
   this.checkPreviewExist = function (previewId, windowId)
   {
      var bFnd = false;
      for (var key in windowId.previews) {
         if (windowId.previews[key].id.startsWith(previewId))
            bFnd = true;
      }
      return bFnd;
   }

  /**
   * Get statistics for all areas and put in statData array
   * * @param   targetWindow  ImageWindow    ImageWindow object
   * * @param   binning       int            binning value for current image
   */
   this.getStatistics = function (targetWindow, binning = 1)
   {
      /*
      this.res[0] : full file name
      this.res[1] : Main part median
      this.res[2] : OptBlack part median
      this.res[3] : Overscan part median
      this.res[4] : Black part median
      this.res[5] : difference Overscan - OptBlack
      this.res[6] : normalize adjustment
      */

      //this.statData[0] = targetWindow.mainView.id;
      this.statData[0] = targetWindow.filePath;
      if (binning == 1)
      {
         this.statData[1] = targetWindow.mainView.image.median(this.MainRect_bin1);
         this.statData[2] = targetWindow.mainView.image.median(this.OptBlackRect_bin1);
         this.statData[3] = targetWindow.mainView.image.median(this.OverscanRect_bin1);
         this.statData[4] = targetWindow.mainView.image.median(this.BlackRect_bin1);
      }
      else if (binning == 2)
      {
         this.statData[1] = targetWindow.mainView.image.median(this.MainRect_bin2);
         this.statData[2] = targetWindow.mainView.image.median(this.OptBlackRect_bin2);
         this.statData[3] = targetWindow.mainView.image.median(this.OverscanRect_bin2);
         this.statData[4] = targetWindow.mainView.image.median(this.BlackRect_bin2);
      }
      this.statData[5] = (String)(this.statData[3] - this.statData[2]);
      this.statData[6] = 0;
   }


  /**
   * Output current statistics to console (in int16 format)
   */
   this.displayStatistics = function ()
   {
      console.noteln(this.statData[0] + ":");
      console.note("Main: ");
      console.write((this.statData[1] * 65535).toFixed(1));
      console.note("| OptBlack: ");
      console.write((this.statData[2] * 65535).toFixed(1));
      console.note("| Overscan: ");
      console.write((this.statData[3] * 65535).toFixed(1));
      console.note("| Black: ");
      console.write((this.statData[4] * 65535).toFixed(1));
      console.note("| Overscan - OptBlack: ");
      console.write((this.statData[5] * 65535).toFixed(1));
      console.noteln();
      console.write((this.statData[6] * 65535).toFixed(1));
      console.noteln();

   }

   /**
    * Process curWindow for getting Statistics
    *
    * @param   curWindow      ImageWindow ImageWindow object
    * @param   makePreviews   bool        create Previews
    * @param   leavePreviews  bool        don't delete previews
    * @return  void
    */
   this.processWindowStat= function (curWindow, makePreviews = true, leavePreviews = true)
   {
      var ovscan_ret = this.QHYHeadersSubEngine.calcOverscanPresent (curWindow);
      if (ovscan_ret != 1)
	  {
		 console.warningln("Seems image doesn't have overscan area, exiting");
		 return;
	  }

	  var curbin = this.getImageBinning(curWindow);
      console.noteln("Binning " + curbin);

      if (makePreviews)
         this.createOverscanPreviews (curWindow, curbin);

      this.getStatistics(curWindow, curbin);
      this.displayStatistics();

      if (makePreviews && !leavePreviews)
         curWindow.deletePreviews();
   }


   /**
   * Process directory for getting Statistics
   *
   * @param searchPath string
   * @return void
   */
   this.processDirectoryStat = function (searchPath)
   {
      this.DirCount++;
      var FileCount = 0;
      console.noteln("<end><cbr><br>",
         "************************************************************");
      Console.noteln('* ' + this.DirCount + '. [processDirectoryStat] Searching dir: ' + searchPath + ' for fits');
      console.noteln("************************************************************");


      // Open outputfile
      MainThread = false;
      if (this.textFile == null)
      {
         // First thread, create file
         MainThread = true;
         try
         {
            this.textFile = new File;
            this.textFile.createForWriting( searchPath + '/' + Config.OutputCSVFile);

            // output header
            this.textFile.outText("Filename\tMain\tOptBlack\tOverscan\tBlack\tDiff" + String.fromCharCode( 13, 10 ));
         }
         catch ( error )
         {
            // Unable to create file.
            console.warningln( "WARNING: Unable to create file: " + outputFile + " Outputting to console only. (" + error.message + ")." );
            this.textFile = null;
         }
      }

      // Begin search
      var objFileFind = new FileFind;

      if (objFileFind.begin(searchPath + "/*")) {
         do {
            // if not upper dir links
            if (objFileFind.name != "." && objFileFind.name != "..") {

               // if this is Directory and recursion is enabled
               if (objFileFind.isDirectory && Config.SearchInSubDirs) {
                    // Run recursion search
                    busy = false; // на будущее для асихнронного блока
                    this.processDirectoryStat(searchPath + '/' + objFileFind.name);
                    busy = true;
               }
               // if File
               else {
                  debug('File found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  debug('Extension: ' + fileExtension(objFileFind.name), dbgNotice);
                  // if this is FIT
                  if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits')) {

                     // Open image
                     this.readImage(searchPath + '/' + objFileFind.name);

                     //Process data
                     this.processWindowStat(this.inputImageWindow[0], false);

                     //Write data to csv file
                     this.textFile.outText( this.statData[0] + "\t");
                     this.textFile.outText( this.statData[1] + "\t");
                     this.textFile.outText( this.statData[2] + "\t");
                     this.textFile.outText( this.statData[3] + "\t");
                     this.textFile.outText( this.statData[4] + "\t");
                     this.textFile.outText( this.statData[5] );
                     this.textFile.outText( String.fromCharCode( 13, 10 ));

                     //Close image
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
      if ( MainThread && this.textFile != null )
      {
         this.textFile.close();
         this.textFile = null;
      }
   }


   /**
    * Process curWindow for normalizing its bias level
    * Нормализация по уровню OptBlack
    *
    * @param   curWindow      ImageWindow    ImageWindow object
    * @param   makePreviews   bool           create Previews
    * @param   leavePreviews  bool           don't delete previews
    * @return  				  bool 			 true if ok, false otherwise
    */
   this.normalizeWindow = function (curWindow, makePreviews = true, leavePreviews = true)
   {
      var ovscan_ret = this.QHYHeadersSubEngine.calcOverscanPresent (curWindow);
      if (ovscan_ret != 1)
	  {
		 console.warningln("Seems image doesn't have overscan area, exiting");
		 return false;
	  }

	  var curbin = this.getImageBinning(curWindow);
      var normLevel = this.getImageNormalizationLevel(curWindow);
      console.noteln("Binning " + curbin);

      if (makePreviews)
         this.createOverscanPreviews (curWindow, curbin);

      this.getStatistics(curWindow, curbin);
      this.displayStatistics();

            var P = new PixelMath;
      P.expression = curWindow.mainView.id + " + " + normLevel + "/65535 - " + this.statData[2].toString();
      console.noteln("Expression: " + P.expression + " [NormLevel="+normLevel+", CurrentLevel=" + this.statData[2]*65535 + "]");
      P.useSingleExpression = true;
      P.clearImageCacheAndExit = false;
      P.cacheGeneratedImages = false;
      P.generateOutput = true;
      P.singleThreaded = false;
      P.optimization = true;
      P.rescale = false;
      P.truncate = true;
      P.createNewImage = false;

      var status = P.executeOn(curWindow.mainView);

      if (makePreviews && !leavePreviews)
         curWindow.deletePreviews();

	  return true;
   }


   /**
   * Process directory for  normalizing its bias level
   *
   * @param searchPath string
   * @return void
   */
   this.processNormalizeDir = function (searchPath)
   {
      this.DirCount++;
      var FileCount = 0;
      console.noteln("<end><cbr><br>",
         "************************************************************");
      Console.noteln('* ' + this.DirCount + '. [processNormalizeDir] Searching dir: ' + searchPath + ' for fits');
      console.noteln("************************************************************");



      // Begin search
      var objFileFind = new FileFind;

      if (objFileFind.begin(searchPath + "/*")) {
         do {
            // if not upper dir links
            if (objFileFind.name != "." && objFileFind.name != "..") {

               // if this is Directory and recursion is enabled
               if (objFileFind.isDirectory && Config.SearchInSubDirs) {
                    // Run recursion search
                    busy = false; // на будущее для асихнронного блока
                    this.processNormalizeDir(searchPath + '/' + objFileFind.name);
                    busy = true;
               }
               // if File
               else {
                  debug('File found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  debug('Extension: ' + fileExtension(objFileFind.name), dbgNotice);
                  // if this is FIT
                  if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits')) {

                     // Open image
                     this.readImage(searchPath + '/' + objFileFind.name);

                     //Process data
                     if (!this.normalizeWindow(this.inputImageWindow[0], false))
						 return;

                     //Save as
                     var ext = this.inputImageWindow[0].filePath.match(/^(.*)(\.)([^.]+)$/);
                     var newFileName = ext[1] + "_ovr" + ext[2] + ext[3];
                     debug("Save As :" + newFileName, dbgNotice);
                     this.saveAsImage(this.inputImageWindow[0], newFileName);

                     //Close image
                     this.closeImage();

                  }
                  else {
                     debug('Skipping any actions on file found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  }
               }
            }
         } while (objFileFind.next());
      }

   }


   /**
   * Process directory for  adding QHY camera data into FITS header
   *
   * @param searchPath string
   * @return void
   */
   this.processQHYDataDir = function (searchPath)
   {
      this.DirCount++;
      var FileCount = 0;
      console.noteln("<end><cbr><br>", "************************************************************");
      Console.noteln('* ' + this.DirCount + '. [processQHYDataDir] Searching dir: ' + searchPath + ' for fits');
      console.noteln("************************************************************");



      // Begin search
      var objFileFind = new FileFind;

      if (objFileFind.begin(searchPath + "/*")) {
         do {
            // if not upper dir links
            if (objFileFind.name != "." && objFileFind.name != "..") {

               // if this is Directory and recursion is enabled
               if (objFileFind.isDirectory && Config.SearchInSubDirs) {
                    // Run recursion search
                    busy = false; // на будущее для асихнронного блока
                    this.processQHYDataDir(searchPath + '/' + objFileFind.name);
                    busy = true;
               }
               // if File
               else {
                  debug('****************************************', dbgNotice);
                  debug('File found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  debug('****************************************', dbgNotice);
                  // if this is FIT
                  if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits')) {

                     // Open image
                     this.readImage(searchPath + '/' + objFileFind.name);


                     //Process data
                     if (this.QHYHeadersSubEngine.addQHYDataWindow(this.inputImageWindow[0]))
                     {
                        // Get original date
                        var origImagePath = this.inputImageWindow[0].filePath;
                        var origDate = this.getImageDate(this.inputImageWindow[0]);

                        //Save
                        this.saveImage(this.inputImageWindow[0]);

                        //Close image
                        this.closeImage(this.inputImageWindow[0]);

                        //Restore filedate to original
                        this.restoreDate(origImagePath,origDate);
                     }
                  }
                  else {
                     debug('Skipping any actions on file found: ' + searchPath + '/' + objFileFind.name, dbgNotice);
                  }
               }
            }
         } while (objFileFind.next());
      }

   }


   /**
   * Wrapper for getting Statistics for Active Window
   *
   * @return void
   */
   this.processCurrentWindowStat = function ()
   {
      var curWindow = ImageWindow.activeWindow;
      if ( curWindow.isNull )
			throw new Error( "No active image" );
      Console.abortEnabled = true;
      console.noteln("Filename,\tMain,\tOptBlack,\tOverscan,\tBlack,\tDiff" + String.fromCharCode( 13, 10 ));
      this.processWindowStat(curWindow, true, true);
   }

   /**
   * Wrapper for Normalizing bias level of Active Window
   *
   * @return void
   */
   this.processCurrentWindowNorm = function ()
   {
        var curWindow = ImageWindow.activeWindow;
        if ( curWindow.isNull )
            throw new Error( "No active image" );
        Console.abortEnabled = true;
        this.normalizeWindow(curWindow, true, true);
   }


   /**
   * Wrapper for adding QHY data into FITS header of Active Window
   *
   * @return void
   */
   this.processQHYDataWindow = function ()
   {
        var curWindow = ImageWindow.activeWindow;
        if ( curWindow.isNull )
            throw new Error( "No active image" );
        Console.abortEnabled = true;
        this.QHYHeadersSubEngine.addQHYDataWindow(curWindow)
   }



} //end of class



#ifndef OverscanStatistics_Main
   function mainTestEngine()
   {
      var Engine = new ProcessEngine();
      var curWindow = ImageWindow.activeWindow;
      //Engine.QHYHeadersSubEngine.addQHYDataWindow(curWindow);
      //var FD = Engine.getImageDate(curWindow);
      /*debug(FD.toISOString());
      debug(FD.toJSON());
      debug(FD.toLocaleString());
      debug(FD.toUTCString());
      debug(FD.toString());
      debug(FD.toLocaleDateString());*/
      //Engine.restoreDate("d:/BiasTest_bin1_noos.fit", FD);
      Engine.processQHYDataDir("d:/DSlrRemote/QHY600/qhyutils test/test" );
   }

    mainTestEngine();
#endif
