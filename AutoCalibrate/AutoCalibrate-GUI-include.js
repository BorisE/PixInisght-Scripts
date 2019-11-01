 #ifndef AutoCalibrate_GUI_include_js
    #define AutoCalibrate_GUI_include_js
 #endif
// Подумать, этот файл вообще нужен, так как используется только для кнопок


//////////// Reusable Code %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

//string arrays
var btnText = new Array(
        "Add Files", // 0
        "Cancel", // 1
        "Clear", // 2
        "Delete Selected", // 3
        "Execute", // 4
        "Invert Selection", // 5
        "OK", // 6
        "Remove Selected", // 7
        "Select", // 8
        "Select All", // 9
        "Enter", //10
        "Add Img Set", //11
        "Move Up", //12
        "Move Down", //13
        "Calibrate", //14
        "DeBayer", //15
        "Register", //16
        "Crop", //17
        "Integrate", //18
        "Set Parameters", //19
        "Edit", //20
        "Edit Value", //21
        "Toggle", //22
        "Toggle Up", //23
        "Toggle Down", //24
        "Selection", //25
        "Selection Up", //26
        "Selection Down", //27
        "Set True", //28
        "Set False", //29
        "Accept", //30
        "Verify Paths"); //

var btnIcon = new Array(
        ":/icons/arrow-up.png", // 0
        ":/icons/arrow-down.png", // 1
        ":/icons/arrow-left.png", // 2
        ":/icons/arrow-right.png", // 3
        ":/browser/select.png", // 4
        ":/process-interface/expand.png", // 5
        ":/process-interface/expand_vert.png", // 6
        ":/process-interface/contract.png", // 7
        ":/process-interface/contract_vert.png", // 8
        ":/bullets/bullet-blue.png", // 9
        ":/bullets/bullet-green.png", //10
        ":/bullets/bullet-grey.png", //11
        ":/bullets/bullet-red.png", //12
        ":/bullets/bullet-yellow.png", //13
        ":/auto-hide/close.png", //14
        ":/");

//push button object constructor
function pushButton(parent, bText, bIcon, bToolTip) {
    this.button = new PushButton(parent);
    if (bText != '')
        this.button.text = bText;
    if (bIcon != '')
        this.button.icon = this.button.scaledResource(bIcon);
    if (bToolTip != '')
        this.button.toolTip = bToolTip;

    return this.button;
}
