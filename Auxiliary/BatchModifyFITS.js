var StartDir = "e:/DSlrRemote/_labs/ngc6946_denis/Source";
var OutDir = "e:/DSlrRemote/_labs/ngc6946_denis/Output";

var CosmeticIcon = "DenisCosmtic_after_overscan_correction";
var BinIcon = "Bin2";


console.abortEnabled = true; // allow stop
console.show();

Console.noteln("***************************************");
Console.noteln("* DENIS SCRIPT FOR NGC6946");
Console.noteln("***************************************");
Console.writeln("* Source dir: " + StartDir);
Console.writeln("* Output dir: " + OutDir);
Console.writeln();

searchDir(StartDir);

/*************************************************************
* Recursively scan files
*
*************************************************************/
function searchDir (searchPath) {
   var objFileFind = new FileFind;
   if (objFileFind.begin(searchPath + "/*") && !this.abortRequested) {
      do {
         if (objFileFind.name != "." && objFileFind.name != "..") {
            if (objFileFind.isDirectory) {
               // run recursion
               searchDir (searchPath + '/' + objFileFind.name)
            } else if (fileExtension(objFileFind.name) !== false && (fileExtension(objFileFind.name).toLowerCase() == 'fit' || fileExtension(objFileFind.name).toLowerCase() == 'fits'|| fileExtension(objFileFind.name).toLowerCase() == 'xisf')) {
               Console.noteln("Processing file: " + objFileFind.name);
               Console.noteln();
               binFile(ccFile(searchPath + '/' + objFileFind.name));
            }
         }
      } while (objFileFind.next());
   }
}

/*************************************************************
* Process file
*
*************************************************************/
function ccFile(fileName)
{
   if (fileName == false) {
      return false;
   }
   Console.noteln("Running CosmeticCorrection for file: " + fileName);
   Console.noteln();

   var CC = ProcessInstance.fromIcon(CosmeticIcon);
   CC.targetFrames = [// enabled, path
                [true, fileName]
            ];
   CC.outputDir = OutDir;
   CC.outputExtension = ".fit";
   CC.postfix = "_cc";

   //Запустить
   var status = CC.executeGlobal();

   // create new file name
   var sFileName = File.extractName(fileName) + '.' + fileExtension(fileName)
   var sNewFileName_fit = sFileName.replace(/_c\.fit(s){0,1}$/, '_c_cc.fit');
   var sNewFileName_xisf = sFileName.replace(/_c\.xisf$/, '_c_cc.fit');
   var newFileName_fit = OutDir + '/' + sNewFileName_fit;
   var newFileName_xisf = OutDir + '/' + sNewFileName_xisf;

   if (File.exists(newFileName_fit)) {
      Console.writeln("Return file name: " + newFileName_fit);
      return newFileName_fit;
   } else if (File.exists(newFileName_xisf)) {
      Console.writeln("Return file name: " + newFileName_xisf);
      return newFileName_xisf;
   } else {
      Console.writeln("Return file name: " + fileName);
      return fileName;
   }
}

/*************************************************************
* Cosmetic file
*
*************************************************************/
function binFile(fileName)
{
   if (fileName == false) {
      return false;
   }
   Console.noteln("Running bin2x2 for file: " + fileName);
   Console.noteln();

   //Open file
   ImageWindow.open(fileName);
   var w = ImageWindow.openWindows[ImageWindow.openWindows.length - 1];

   if (!w || w.isNull) {
      Console.criticalln("binFile: Error opening image file: " + fileName);
      return false;
   }

   var P = ProcessInstance.fromIcon(BinIcon);
   //Запустить
   P.executeOn(w.mainView);

   // create new file name
   var sFileName = File.extractName(fileName) + '.' + fileExtension(fileName)
   var sNewFileName = sFileName .replace(/_c_cc\.fit(s){0,1}$/, '_c_cc_bin2.fit');
   var newFileName = OutDir + '/' + sNewFileName;

   // save and close
   w.saveAs(newFileName, false, false, true, false); //overwrite
   w.purge();
   w.forceClose(); //w.close();

   if (File.exists(newFileName)) {
      return newFileName;
   } else {
      return fileName;
   }
}



/**
 * Поиск расширения файла
 */
function fileExtension(file) {
    //console.writeln('ext file='+ file);
    var ext = file.match(/\.([^.]+)$/);

    return ext && ext.length ? ext[1] : false
}


