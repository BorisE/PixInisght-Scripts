#feature-id BackgroundModelization > DBE Sample Tool
#feature-info Prepare sample points for DynamicBackgroundExtraction.<br/>\
   Author: Boris Emchenko

#define TITLE "DBE Sample Tool"
#define VERSION "0.1.6"
#define COMPILE_DATE "2026/11/16"
#define INFO_STRING "Prepare sample points for DynamicBackgroundExtraction."
#define COPYRIGHT_STRING "Copyright &copy; 2026 Boris Emchenko"

/*
Version History

v 0.1.6 [2026/11/16]
- Move script settings and parameter persistence into a separate file.

v 0.1.5 [2026/11/16]
- Add script instances, console reporting and persistent dialog settings.

v 0.1.4 [2026/11/16]
- Remove the experimental sample rejection mode.

v 0.1.3 [2026/11/16]
- Add a regular grid mode with star and bright structure rejection.

v 0.1.2 [2026/11/16]
- Add a selector for existing DBE process icons.

v 0.1.1 [2026/11/16]
- Open DBE with the generated grid when the process icon must be created.

v 0.1.0 [2026/11/15]
- Initial PJSR scaffold with entry point, engine settings and dialog.
*/

#include "DBESampleTool-settings.js"
#include "DBESampleTool-engine.js"
#include "DBESampleTool-UI.js"

/**
 * Restore the last dialog settings, then apply any parameters from a script icon.
 * A script icon dropped on a view selects that image in the dialog.
 * Persist the final selection when the dialog closes, even if no DBE icon was saved.
 */
function main()
{
   console.noteln( TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE );

   var settings = new DBESampleToolSettings;
   settings.loadSettings();
   if ( Parameters.isGlobalTarget || Parameters.isViewTarget )
      settings.importParameters();
   if ( Parameters.isViewTarget )
      settings.targetViewId = Parameters.targetView.window.mainView.id;

   var dialog = new DBESampleToolDialog( settings );
   var accepted = dialog.execute();
   dialog.storeSelection();
   settings.saveSettings();
   // Open the native DBE interface after the modal script dialog has closed.
   if ( accepted && dialog.finish )
      dialog.finish();
}

main();
