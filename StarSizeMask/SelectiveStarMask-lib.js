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
