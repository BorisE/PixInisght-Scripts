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
   this.BlackRect_bin1 =      new Rect (  22,    0,   24, 6388);
   this.OverscanRect_bin1 =   new Rect (   0, 6389, 9600, 6422);
   this.MainRect_bin1 =       new Rect (  24,    0, 9600, 6388);

   this.OptBlackRect_bin2 =   new Rect (   0,    0,   11, 3195);
   this.BlackRect_bin2 =      new Rect (  11,    0,   12, 3194);
   this.OverscanRect_bin2 =   new Rect (   0, 3195, 4800, 6422);
   this.MainRect_bin2 =       new Rect ( 12,     0, 4788, 3194);


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
   *
   */
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

   }

   /**
    * Функция для обработки открытого файла
    *
    * @param   curWindow      string   WindowId for ImageWindow object
    * @param   binnig         integer  binning value
    * @param   makePreviews   bool     create Previews
    * @param   leavePreviews  bool     don't delete previews
    * @return  void
    */
   this.processWindow= function (curWindow, binnig = 1, makePreviews = true, leavePreviews = true)
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
   * Функция для обработки каталога
   *
   * @param searchPath string
   * @param binnig     integer
   * @return void
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
         textFile.createForWriting( searchPath + '/' + Config.OutputCSVFile);
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

                     this.processWindow(this.inputImageWindow[0], binnig, false);

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

   this.processCurrentWindow = function ()
   {
      var curWindow = ImageWindow.activeWindow;
		if ( curWindow.isNull )
			throw new Error( "No active image" );
		Console.abortEnabled = true;
      console.noteln("Filename,\tMain,\tOptBlack,\tOverscan,\tBlack,\tDiff" + String.fromCharCode( 13, 10 ));
      this.processWindow(curWindow, 1, true, true);
   }

   this.processCurrentWindow_bin2 = function ()
   {
      var curWindow = ImageWindow.activeWindow;
		if ( curWindow.isNull )
			throw new Error( "No active image" );
		Console.abortEnabled = true;
      console.noteln("Filename,\tMain,\tOptBlack,\tOverscan,\tBlack,\tDiff" + String.fromCharCode( 13, 10 ));
      this.processWindow(curWindow, 2, true, true);

   }

} //end of class



#ifndef OverscanStatistics_Main
   function mainTestEngine()
   {
      var Engine = new ProcessEngine();
      Engine.processCurrentWindow();
   }

    mainTestEngine();
#endif
