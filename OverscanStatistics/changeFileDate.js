/*
    changeFileDate.js
    (c) by Boris Emchenko 2021
    http://astromania.info
    
    run this script to chage LastModified file date to specified
    format:
    cscript changeFileDate.js "d://test.fit" "2021-10-01 18:01:02"

*/

var silentMode = false;

var objShell = new ActiveXObject("Shell.Application");
var objFS = new ActiveXObject("Scripting.FileSystemObject");

var args = WScript.Arguments;
logger ("Args: " + args.length);
var filename = args(0);
var target_filedate = args(1);

//target_filedate = "Wed Oct 27 2021 20:30:40 GMT+0300 (RTZ 2 (ceia))";

logger ("File: " + filename);
logger ("FileDate: " + target_filedate);


file = objFS.GetFile(filename);
date = file.DateLastModified;
logger ("The date this file was last modified is: " + date);

objFolder=objShell.NameSpace(file.ParentFolder.Path);
objFolder.ParseName(file.Name).ModifyDate = target_filedate;

file = objFS.GetFile(filename);
date = file.DateLastModified;
logger ("The date this file was last modified is: " + date);


function logger(message)
{
   if (! silentMode) 
		WScript.Echo(message);
	
   //st="CScript.exe "+ logpath +" \""+message+"\""
   //WScript.Echo(st);
   //WshShell.Run (st,7, true);
}