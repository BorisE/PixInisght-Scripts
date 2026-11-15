#feature-id BackgroundModelization > DBE Sample Tool
#feature-info Prepare sample points for DynamicBackgroundExtraction.<br/>\
   Author: Boris Emchenko

#define TITLE "DBE Sample Tool"
#define VERSION "0.1.4"
#define COMPILE_DATE "2026/11/16"
#define INFO_STRING "Prepare sample points for DynamicBackgroundExtraction."
#define COPYRIGHT_STRING "Copyright &copy; 2026 Boris Emchenko"

/*
Version History

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

#include "DBESampleTool-engine.js"
#include "DBESampleTool-UI.js"

function main()
{
   console.noteln( TITLE, " script started. Version: ", VERSION, " Date: ", COMPILE_DATE );

   var engine = new DBESampleToolEngine;
   var dialog = new DBESampleToolDialog( engine );
   if ( dialog.execute() && dialog.finish )
      dialog.finish();
}

main();
