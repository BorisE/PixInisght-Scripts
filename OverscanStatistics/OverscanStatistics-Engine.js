this.ProcessEngine = function () {

   this.inputImageWindow = null; //current opened image file (ImageWindow object)

   this.res = [];
   this.res2 = [];

   this.DirCount=0;
   this.textFile = null;

   /// Method to read an image from a file in to this.inputImageWindow (ImageWindow object).
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
            this.inputImageWindow[0].forceClose();
            this.inputImageWindow  = null;
         }
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
      }
      debug("BatchStatisticsDialog.closeImage");

   };

   /**
    *  Method to save current image window with new name.
    *
    * @param   curWindow      ImageWindow    ImageWindow object
    * @return  void
    */
   this.saveNormalizedImage = function( curWindow )
   {
      try
      {
         if ( curWindow != null )
         {
             var ext = curWindow.filePath.match(/^(.*)(\.)([^.]+)$/);
             var newFileName = ext[1] + "_ovr" + ext[2] + ext[3];
             debug("Save As :" + newFileName, dbgNotice);
             curWindow.saveAs(newFileName, false, false, true, false);
         }
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
      }
      debug("BatchStatisticsDialog.closeImage");

   };


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


   this.getImageBinning = function (curImageWindow)
   {
        var keywords = curImageWindow.keywords;
        for (var k in keywords) {
            if (typeof headers[keywords[k].name] != 'undefined') {
				keywords[k].trim();
                headers[keywords[k].name] = keywords[k].strippedValue;
                debug('header ' + keywords[k].name + '=' + keywords[k].strippedValue, dbgNotice);
            }
        }

        return parseInt(headers.XBINNING);

   }

   this.getImageNormalizationLevel = function (curImageWindow)
   {
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
    * Create previews for a given bin
    *
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
   * Check if previews already exists
   *
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
   * Get statistics for all areas
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

      //this.res2[0] = targetWindow.mainView.id;
      this.res2[0] = targetWindow.filePath;
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
      this.res2[6] = 0;
   }


  /**
   * Display statistics
   *
   */
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
      console.write(this.res2[6]);
      console.noteln();

   }

   /**
    * Функция для обработки открытого файла
    *
    * @param   curWindow      ImageWindow ImageWindow object
    * @param   makePreviews   bool        create Previews
    * @param   leavePreviews  bool        don't delete previews
    * @return  void
    */
   this.processWindowStat= function (curWindow, makePreviews = true, leavePreviews = true)
   {
      curbin = this.getImageBinning(curWindow);
      console.noteln("Binning " + curbin);

      if (makePreviews)
         this.createOverscanPreviews (curWindow, curbin);

      this.getStatistics(curWindow, curbin);
      this.displayStatistics();

      if (makePreviews && !leavePreviews)
         curWindow.deletePreviews();
   }


   /**
   * Функция для обработки каталога
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
      Console.noteln('* ' + this.DirCount + '. Searching dir: ' + searchPath + ' for fits');
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
                     this.textFile.outText( this.res2[0] + "\t");
                     this.textFile.outText( this.res2[1] + "\t");
                     this.textFile.outText( this.res2[2] + "\t");
                     this.textFile.outText( this.res2[3] + "\t");
                     this.textFile.outText( this.res2[4] + "\t");
                     this.textFile.outText( this.res2[5] );
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
    * Функция для обработки открытого файла
    *
    * @param   curWindow      ImageWindow    ImageWindow object
    * @param   makePreviews   bool           create Previews
    * @param   leavePreviews  bool           don't delete previews
    * @return  void
    */
   this.normalizeWindow = function (curWindow, makePreviews = true, leavePreviews = true)
   {
      var curbin = this.getImageBinning(curWindow);
      var normLevel = this.getImageNormalizationLevel(curWindow);
      console.noteln("Binning " + curbin);

      if (makePreviews)
         this.createOverscanPreviews (curWindow, curbin);

      this.getStatistics(curWindow, curbin);
      this.displayStatistics();

            var P = new PixelMath;
      P.expression = curWindow.mainView.id + " + " + normLevel + "/65535 - " + this.res2[2].toString();
      console.noteln("Expression: " + P.expression + " [NormLevel="+normLevel+", CurrentLevel=" + this.res2[2]*65535 + "]");
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
   }




/**
   * Функция для обработки каталога
   * Нормализация по уровню OptBlack
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
      Console.noteln('* ' + this.DirCount + '. Searching dir: ' + searchPath + ' for fits');
      console.noteln("************************************************************");


      // Open outputfile
      MainThread = false;

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
                     this.normalizeWindow(this.inputImageWindow[0], false);

                     this.saveNormalizedImage(this.inputImageWindow[0]);

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

   this.processCurrentWindowStat = function ()
   {
      var curWindow = ImageWindow.activeWindow;
		if ( curWindow.isNull )
			throw new Error( "No active image" );
		Console.abortEnabled = true;
      console.noteln("Filename,\tMain,\tOptBlack,\tOverscan,\tBlack,\tDiff" + String.fromCharCode( 13, 10 ));
      this.processWindowStat(curWindow, true, true);
   }

   this.processCurrentWindowNorm = function ()
   {
      var curWindow = ImageWindow.activeWindow;
		if ( curWindow.isNull )
			throw new Error( "No active image" );
		Console.abortEnabled = true;
      console.noteln("Filename,\tMain,\tOptBlack,\tOverscan,\tBlack,\tDiff" + String.fromCharCode( 13, 10 ));
      this.normalizeWindow(curWindow, true, true);
   }

} //end of class



#ifndef OverscanStatistics_Main
   function mainTestEngine()
   {
      var Engine = new ProcessEngine();
      Engine.processCurrentWindowStat();
   }

    mainTestEngine();
#endif
