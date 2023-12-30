/* global Dialog, FrameStyle_Sunken */

// Version 1.0 (c) John Murphy 31st-Dec-2020
//
// ======== #license ===============================================================
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// =================================================================================
//"use strict";

function HelpDialog( ){
    this.__base__ = Dialog;
    this.__base__();

    let titleLabel = new Label();
    titleLabel.frameStyle = FrameStyle_Sunken;
    titleLabel.margin = 4;
    titleLabel.wordWrapping = false;
    titleLabel.useRichText = true;
    titleLabel.text = 
        "<p><b>NSGXnml</b> is a C++ process that creates '.xnml' Local Normalization data files.<br />" +
        "These are small files that contain all the scale and gradient correction data.</p>" +
        "<p>After <b>NSGXnml</b> is installed, NSG's <i>'Normalization data'</i> checkbox is enabled.<br />" +
        "When checked, NSG will automatically run <b>NSGXnml</b> in the background to create '.xnml' files.<br />" +
        "NSG then adds these '.xnml' files to ImageIntegration.</p>" +
        "<p><b>ImageIntegration</b> uses '.xnml' data to apply the NSG scale and gradient corrections.<br />" +
        "Internally, ImageIntegration is not limited by the 0.0 to 1.0 range, so no truncation occurs.<br />" +
        "This prevents losing information within star cores, or for very bright or very dark pixels.<br />" +
        "Some of the improvements include:" +
        "<ul><li>No truncation of bright or dark areas.</li>" +
        "<li>Significantly reduced file I/O which improves performance.</li>" +
        "<li>Individual weights are applied to each R, G, B channel instead of using an average weight.</li>" +
        "</ul></p>" +
        "<p><b>DrizzleIntegration</b> also uses '.xnml' files to apply the NSG scale and gradient corrections.<br />" +
        "These files should be added to both ImageIntegration and DrizzleIntegration.<br />" +
        "<i>Without these files, the corrections applied by NSG will be ignored by DrizzleIntegration.</i></p>" +
        "<p>Thanks for your support, John Murphy.</p>";

    let ok_Button = new PushButton(this);
    ok_Button.defaultButton = true;
    ok_Button.text = "OK";
    ok_Button.icon = this.scaledResource(":/icons/ok.png");
    ok_Button.onClick = function () {
        this.dialog.ok();
    };

    let buttons_Sizer = new HorizontalSizer;
    buttons_Sizer.spacing = 6;
    buttons_Sizer.addStretch();
    buttons_Sizer.add(ok_Button);

    let webpage = new TextBox( this );
    webpage.text = 
            "<i>(Copy &amp; paste web address into your web browser)</i>\n\n" +
            "<b>Tutorials:</b>\n" +
            "https://www.youtube.com/@NormalizeScaleGradient" +
            "\n\n<b>Website:</b>\n" + 
            "https://www.normalizescalegradient.net/" +
            "\n\n<b>Email:</b>\n" +
            "johnastro.info@gmail.com" +
            "\n\n<b>Buy me a 'coffee':</b>\n" +
            "https://ko-fi.com/jmurphy\n";
    webpage.minHeight = 300;

    // Global sizer
    this.sizer = new VerticalSizer();
    this.sizer.margin = 10;
    this.sizer.spacing = 10;
    
    this.sizer.add(titleLabel);
    this.sizer.add(webpage);
    this.sizer.add(buttons_Sizer);

    this.windowTitle = "NSGXnml C++ Process";
    this.adjustToContents();
}

HelpDialog.prototype = new Dialog;
