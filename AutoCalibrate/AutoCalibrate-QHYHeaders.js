this.ProcessQHYHeaders = function () {

   this.Gain = "0";
   this.Offset = "10";
   this.ReadOutMode = "1";
   this.USBLimit = "50";

   this.QPreset = "-1";                     //calculated field
   this.OverscanPresent = "undefined";    //calculated field

   this.imageWidthOverscan = { "bin1" : 9600, "bin2": 4800 };
   this.imageWidthNoOverscan = { "bin1" : 9576, "bin2": 4788 };
   
   this.OptBlackRect_bin1 =   new Rect (   0,    0,   22, 6388); //using x0,y0 - x1,y1 system, NOT x0,y0, W, H
   this.BlackRect_bin1 =      new Rect (  22,    0,   24, 6388);
   this.OverscanRect_bin1 =   new Rect (   0, 6389, 9600, 6422);
   this.MainRect_bin1 =       new Rect (  24,    0, 9600, 6388);

   this.OptBlackRect_bin2 =   new Rect (   0,    0,   11, 3194);
   this.BlackRect_bin2 =      new Rect (  11,    0,   12, 3194);
   this.OverscanRect_bin2 =   new Rect (   0, 3195, 4800, 3211);
   this.MainRect_bin2 =       new Rect ( 12,     0, 4800, 3194);

   // Полезные FITS поля
   var QHYHeaders = {
       'READOUTM': null,
       'GAIN': null,
       'OFFSET': null,
       'QOVERSCN': null,
       'QPRESET': null,
       'USBLIMIT': null
   };


    this.checkQHY = function (fileData)  {

        var ret = false;
        if (fileData.camera == "QHY600") ret = true;

        return ret;
    };

    this.getPresetName = function (fileData)  {

        var QPreset="undefined";

        if (fileData.ReadOutMode==1)
        {
            if (fileData.Gain==0 && fileData.Offset == 10 && fileData.USBLimit == 50) QPreset = 3;
            else if (fileData.Gain==56 && fileData.Offset == 10 && fileData.USBLimit == 50) QPreset = 4;
        }
        else if (fileData.ReadOutMode==0)
        {
            if (fileData.Gain==0 && fileData.Offset == 10 && fileData.USBLimit == 50) QPreset = 1;
            else if (fileData.Gain==27 && fileData.Offset == 10 && fileData.USBLimit == 50) QPreset = 2;
        }

        if (QPreset != "undefined")
        {
            QPreset = "P" + QPreset;
        }

        return QPreset;
    };

   /**
    * check if curWindow has overscan area
    * @param   curWidth    int     image.width
    * @return  int				   1 if image with oversan, 0 if withoud, -1 if can't say nothing about it :)
    */
   this.calcOverscanPresent  = function (curWidth)
   {
      //var curWidth = curWindow.mainView.image.width;
	  //debug("IW: "+curWidth);
      //debug("OW: "+this.imageWidthOverscan.bin1);
      if (curWidth ==  this.imageWidthOverscan.bin1 || curWidth ==  this.imageWidthOverscan.bin2 )
         return 1;
      else if (curWidth ==  this.imageWidthNoOverscan.bin1 || curWidth ==  this.imageWidthNoOverscan.bin2 )
         return 0;
      else
         return -1;
   }
   
}
