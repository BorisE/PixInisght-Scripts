this.ProcessQHYHeaders = function () {

   // Полезные FITS поля
   var QHYHeaders = {
       'READOUTM': null,
       'GAIN': null,
       'OFFSET': null,
       'QOVERSCN': null,
       'QPRESET': null,
       'USBLIMIT': null
   };
   /**
    * Process curWindow for adding QHY data into FITS Header
    *
    * @return  void
    */
   this.addQHYDataWindow = function (curWindow)
   {
      //this.getImageHeaders(curWindow);

     
      var keywords_for_process = Array();

      var keywords = curWindow.keywords;
      for (var k in keywords) {
         var newline = [keywords[k].name, keywords[k].strippedValue, ""];
         keywords_for_process.push(newline);
         if (typeof QHYHeaders[keywords[k].name] != 'undefined') {
            keywords[k].trim();
            QHYHeaders[keywords[k].name] = keywords[k].strippedValue;
         }
      }

      // Check QHY fields and add data if empty
      if (QHYHeaders.GAIN == null) {
         var newline = ["GAIN", "0", "Relative gain value"];
         keywords_for_process.push(newline);
      }
      if (QHYHeaders.OFFSET == null) {
         var newline = ["OFFSET", "10", "Offset value"];
         keywords_for_process.push(newline);
      }
      if (QHYHeaders.READOUTM == null) {
         var newline = ["READOUTM", "'1'", "Readout mode number of image"];
         keywords_for_process.push(newline);
      }
      if (QHYHeaders.QPRESET == null) {
         var newline = ["QPRESET", "3", "Preset id"];
         keywords_for_process.push(newline);
      }
      if (QHYHeaders.QOVERSCN == null) {
         var newline = ["QOVERSCN", "'true'", "Overscan present"];
         keywords_for_process.push(newline);
      }
      if (QHYHeaders.USBLIMIT == null) {
         var newline = ["USBLIMIT", "50", "USB limit"];
         keywords_for_process.push(newline);
      }

      debug(keywords_for_process);

      var P = new FITSHeader;

      P.keywords = keywords_for_process;

      P.writeIcon("savedFH");
      var status = P.executeOn(curWindow.mainView);

   }
}


#ifndef OverscanStatistics_Main
   function mainTestQHYProcessEngine()
   {
      var Engine = new ProcessQHYHeaders();
      var curWindow = ImageWindow.activeWindow;
      Engine.addQHYDataWindow(curWindow);
   }

    mainTestEngine();
#endif
