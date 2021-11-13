this.ProcessQHYHeaders = function () {

   this.Gain = "0";
   this.Offset = "10";
   this.ReadOutMode = "1";
   this.USBLimit = "50";

   this.QPreset = "-1";                     //calculated field
   this.OverscanPresent = "undefined";    //calculated field

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
    * @param   curWindow    ImageWindow     ImageWindow object
    * @return               bool            true if headers was modified
    */
   this.addQHYDataWindow = function (curWindow)
   {
      var keywords_for_process = Array();
      for (var k in QHYHeaders) {
         QHYHeaders[k] = null;
      }

      var modified = false;

      var keywords = curWindow.keywords;
      for (var k in keywords) {
         var newline = [keywords[k].name, keywords[k].value, keywords[k].comment];
         keywords_for_process.push(newline);
         if (typeof QHYHeaders[keywords[k].name] != 'undefined') {
            keywords[k].trim();
            QHYHeaders[keywords[k].name] = keywords[k].strippedValue;
         }
      }

      // Check QHY fields and add data if empty
      if (QHYHeaders.GAIN == null || Config.ForceHeaderModification) {
         var newline = ["GAIN", this.Gain, "Relative gain value"];
         keywords_for_process.push(newline);
         debug("Added GAIN " + this.Gain);
         modified = true;
      }
      if (QHYHeaders.OFFSET == null || Config.ForceHeaderModification) {
         var newline = ["OFFSET", this.Offset, "Offset value"];
         keywords_for_process.push(newline);
         debug("Added OFFSET " + this.Offset);
         modified = true;
      }
      if (QHYHeaders.READOUTM == null || Config.ForceHeaderModification) {
         var newline = ["READOUTM", this.ReadOutMode, "Readout mode number of image"];
         keywords_for_process.push(newline);
         debug("Added READOUTM " + this.ReadOutMode);
         modified = true;
      }
      if (QHYHeaders.QPRESET == null || Config.ForceHeaderModification) {
         if (this.ReadOutMode=="1")
         {
            if (this.Gain=="0" && this.Offset == "10") this.QPreset = "3";
            else if (this.Gain=="56" && this.Offset == "10") this.QPreset = "4";
         }
         else if (this.ReadOutMode=="0")
         {
            if (this.Gain=="0" && this.Offset == "10") this.QPreset = "1";
            else if (this.Gain=="27" && this.Offset == "10") this.QPreset = "2";
         }
         var newline = ["QPRESET", this.QPreset, "Preset id"];
         keywords_for_process.push(newline);
         debug("Added QPRESET " + this.QPreset);
         modified = true;
      }
      if (QHYHeaders.QOVERSCN == null || Config.ForceHeaderModification) {
         var ovscan_ret = this.calcOverscanPresent (curWindow);
         if (ovscan_ret == 1)
            this.OverscanPresent = "true";
         else if (ovscan_ret == 0)
            this.OverscanPresent = "false";
         var newline = ["QOVERSCN", this.OverscanPresent , "Overscan present or not"];
         keywords_for_process.push(newline);
         debug("Added QOVERSCN " + this.OverscanPresent);
         modified = true;
      }
      if (QHYHeaders.USBLIMIT == null || Config.ForceHeaderModification) {
         var newline = ["USBLIMIT", this.USBLimit, "USB limit"];
         keywords_for_process.push(newline);
         debug("Added USBLIMIT " + this.USBLimit);
         modified = true;
      }

      //debug(keywords_for_process);
      if (modified)
      {
         var P = new FITSHeader;
         P.keywords = keywords_for_process;
         var status = P.executeOn(curWindow.mainView);
      }
      else
      {
         debug("No need to modify headers");
      }

      debug("ProcessQHYHeaders.addQHYDataWindow", dbgNotice);
      return modified;
   }


   this.imageWidthOverscan = { "bin1" : 9600, "bin2": 4800 };
   this.imageWidthNoOverscan = { "bin1" : 9576, "bin2": 4788 };
   /**
    * check if curWindow has overscan area
    * @param   curWindow    ImageWindow     ImageWindow object
    * @return  void
    */
   this.calcOverscanPresent  = function (curWindow)
   {
      var curWidth = curWindow.mainView.image.width;
      //debug("IW: "+curWidth);
      //debug("OW: "+this.imageWidthOverscan.bin1);
      if (curWidth ==  this.imageWidthOverscan.bin1 || curWidth ==  this.imageWidthOverscan.bin2 )
         return 1;
      else if (curWidth ==  this.imageWidthNoOverscan.bin1 || curWidth ==  this.imageWidthNoOverscan.bin2 )
         return 0;
      else
         return -1;
   }


   /**
   * Aux function to load Config values of Camera Parameters into Engine
   *
   * @return void
   */
   this.loadCameraParameters = function ()
   {
      this.Gain = Config.AddData_Gain.toString();
      this.Offset = Config.AddData_Offset.toString();
      this.ReadOutMode = Config.AddData_ReadMode.toString();
      this.USBLimit = Config.AddData_USBLimit.toString();
   }


} //end of class


#ifndef OverscanStatistics_ProcessEngine_js
   function mainTestQHYProcessEngine()
   {
      var Engine = new ProcessQHYHeaders();
      var curWindow = ImageWindow.activeWindow;
      Engine.addQHYDataWindow(curWindow);
   }

    mainTestQHYProcessEngine();
#endif
