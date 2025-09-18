#define DEBUG_COLOR_USUAL 1
#define DEBUG_COLOR_WARNING 2
#define DEBUG_COLOR_ERROR 3
#define DEBUG_COLOR_NOTE 4

function debug(st, color=DEBUG_COLOR_USUAL)
{
    if (__DEBUGF__) {
        if (color == DEBUG_COLOR_USUAL)
            console.writeln("<i>" + st + "</i>");
        else if (color == DEBUG_COLOR_WARNING)
            console.warningln("<i>" + st + "</i>");
        else if (color == DEBUG_COLOR_ERROR)
            console.criticalln("<i>" + st + "</i>");
        else if (color == DEBUG_COLOR_NOTE)
            console.noteln("<i>" + st + "</i>");
    }
}

function round(num, precision) {
    precision = Math.pow(10, precision)
    return Math.round(num * precision) / precision
}

function roundUp(num, precision) {
    precision = Math.pow(10, precision)
    return Math.ceil(num * precision) / precision
}

function roundDown(num, precision) {
    precision = Math.pow(10, precision)
    return Math.floor(num * precision) / precision
}


function GetWindowBmp(window)
{
   var imageOrg = window.mainView.image;
   var tmpW = null;
   try
   {
      tmpW = new ImageWindow(imageOrg.width, imageOrg.height, imageOrg.numberOfChannels,
         window.bitsPerSample, window.isFloatSample, imageOrg.isColor, "Aux");
      tmpW.mainView.beginProcess(UndoFlag_NoSwapFile);
      tmpW.mainView.image.apply(imageOrg);
     // ApplySTF(tmpW.mainView, window.mainView.stf);
      tmpW.mainView.endProcess();
      var bmp = new Bitmap(imageOrg.width, imageOrg.height);
      bmp.assign(tmpW.mainView.image.render());
      return bmp;
   } finally
   {
      tmpW.forceClose();
   }
}

