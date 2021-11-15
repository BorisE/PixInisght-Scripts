this.ProcessQHYHeaders = function () {

   this.Gain = "0";
   this.Offset = "10";
   this.ReadOutMode = "1";
   this.USBLimit = "50";

   this.QPreset = "-1";                     //calculated field
   this.OverscanPresent = "undefined";    //calculated field

   this.imageWidthOverscan = { "bin1" : 9600, "bin2": 4800 };
   this.imageWidthNoOverscan = { "bin1" : 9576, "bin2": 4788 };

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

}
