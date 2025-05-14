#feature-id Batch Processing > BatchFitsToXISF
#feature-info Recursively convert all .FITS files in a folder (and subfolders) to XISF<br/>\
   <br/> \
   Copyright &copy; 2025 Boris Emchenko<br/>

#define TITLE "Batch FITS -> XISF Converter"
#define VERSION "1.0"


#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/SectionBar.jsh>


/*
 * Recursively scan 'path' for .fit/.fits files and convert each one.
 */
function scanAndConvert( path )
{
   var ff = new FileFind;
   if ( !ff.begin( path + "/*" ) )
      return;

   do
   {
      // Skip "." and ".."
      if ( ff.name == "." || ff.name == ".." )
         continue;

      var fullPath = path + "/" + ff.name;

      if ( ff.isDirectory )
      {
         console.noteln("[" + ff.name + "]");
         // Recurse into subdirectory
         scanAndConvert( fullPath );
      }
      else
      {
         // Check for .fit or .fits extension
         var ext = File.extractExtension( ff.name ).toLowerCase();
         if ( ext == ".fit" || ext == ".fits" )
         {
            //try
            {
               console.note("Processsing: ");
               console.writeln(fullPath);

               // Open the FITS file (no window, no stretch)
               var windows = ImageWindow.open( fullPath );
               if ( windows.length == 0 )
                  throw new Error( "Failed to open image." );
               var win = windows[0];

               // Build output path: same folder, same base name, .xisf
               var outDir = File.extractDrive( fullPath ) + File.extractDirectory( fullPath );
               if ( !outDir.endsWith( "/" ) )
                  outDir += "/";
               var outPath = outDir + File.extractName( fullPath ) + ".xisf";

               console.writeln( "<end><cbr>Saving: " + outPath );
               // Save as XISF (no preview, no compression)
               win.saveAs( outPath, false, false );

               win.close();
            }
            /*
            catch ( e )
            {
               // On error, ask whether to continue
               Console.criticalln(
                   "<p><b>Error:</b> " + e.message + "</p>" +
                   "<p><b>File:</b> " + fullPath + "</p>"
                  );
            }
            */
         }
      }
   }
   while ( ff.next() );
   //ff.close();
}

/*
 * Entry point: ask for a folder, then launch the scan/convert.
 */
function main()
{
   console.note(TITLE);
   console.noteln(". v " + VERSION);
   console.noteln("(C) by Boris Emchenko 2025");
   
   var StartPath = "e:/DSlrRemote/_Calibration masters library/Vedrus/Newton320/QHY600";

   var gdd = new GetDirectoryDialog;
   gdd.initialPath = StartPath
   gdd.caption = "Select Directory to Process";

   if (gdd.execute()) {
      StartPath = gdd.directory;
   }
   
   console.writeln( "<end><cbr>Starting batch conversion in: " + StartPath );
   scanAndConvert( StartPath );
   console.writeln( "<end><cbr><b>Batch conversion complete.</b>" );
}

main();
