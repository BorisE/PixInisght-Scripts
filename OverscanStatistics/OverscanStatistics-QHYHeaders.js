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
         if (typeof QHYHeaders[keywords[k].name] != 'undefined') {
            keywords[k].trim();
            QHYHeaders[keywords[k].name] = keywords[k].strippedValue;
         } else {
            var newline = [keywords[k].name, keywords[k].value, keywords[k].comment];
            keywords_for_process.push(newline);
         }
      }

      // Check QHY fields and add data if empty
      if (QHYHeaders.GAIN == null || Config.ForceHeaderModification) {
         var newline = ["GAIN", this.Gain, "Relative gain value"];
         debug("Added GAIN " + this.Gain);
         modified = true;
      } else {
         var newline = ["GAIN", QHYHeaders.GAIN, "Relative gain value"];
      }
      keywords_for_process.push(newline);

      if (QHYHeaders.OFFSET == null || Config.ForceHeaderModification) {
         var newline = ["OFFSET", this.Offset, "Offset value"];
         debug("Added OFFSET " + this.Offset);
         modified = true;
      } else {
         var newline = ["OFFSET", QHYHeaders.OFFSET, "Offset value"];
      }
      keywords_for_process.push(newline);

      if (QHYHeaders.READOUTM == null || Config.ForceHeaderModification) {
         var newline = ["READOUTM", this.ReadOutMode, "Readout mode number of image"];
         debug("Added READOUTM " + this.ReadOutMode);
         modified = true;
      } else {
         var newline = ["READOUTM", QHYHeaders.READOUTM, "Readout mode number of image"];
      }
      keywords_for_process.push(newline);

      if (QHYHeaders.QPRESET == null || Config.ForceHeaderModification) {
         this.QPreset = this.calcPresetIndex(this.ReadOutMode, this.Gain, this.Offset);
         var newline = ["QPRESET", this.QPreset, "Preset id"];
         debug("Added QPRESET " + this.QPreset);
         modified = true;
      } else {
         var newline = ["QPRESET", this.calcPresetIndex(QHYHeaders.READOUTM, QHYHeaders.GAIN, QHYHeaders.OFFSET), "Preset id"];
      }
      keywords_for_process.push(newline);


      var ovscan_ret = this.calcOverscanPresent (curWindow);
      if (ovscan_ret == 1)
         this.OverscanPresent = "true";
      else if (ovscan_ret == 0)
         this.OverscanPresent = "false";
      var newline = ["QOVERSCN", this.OverscanPresent , "Overscan present or not"];
      if (QHYHeaders.QOVERSCN == null || Config.ForceHeaderModification) {
         debug("Added QOVERSCN " + this.OverscanPresent);
         modified = true;
      }
      keywords_for_process.push(newline);

      if (QHYHeaders.USBLIMIT == null || Config.ForceHeaderModification) {
         var newline = ["USBLIMIT", this.USBLimit, "USB limit"];
         debug("Added USBLIMIT " + this.USBLimit);
         modified = true;
      } else {
         var newline = ["USBLIMIT", QHYHeaders.USBLIMIT, "USB limit"];
      }
      keywords_for_process.push(newline);

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

   this.calcPresetIndex = function (readmode, gain, offset)
   {
      if (readmode=="1")
      {
         if (gain=="0" && offset == "10") this.QPreset = "3";
         else if (gain=="56" && offset == "10") this.QPreset = "4";
      }
      else if (readmode=="0")
      {
         if (gain=="0" && offset == "10") this.QPreset = "1";
         else if (gain=="27" && offset == "10") this.QPreset = "2";
      }

      return this.QPreset;
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
