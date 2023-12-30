/* global Dialog, FrameStyle_Sunken, VERSION, TITLE, TextAlign_Right, TextAlign_VertCenter, APERTURE_GROWTH_REJECTION, APERTURE_ADD, APERTURE_GROWTH, DataType_Boolean, StdIcon_Question, StdButton_Ok, StdButton_Cancel, Settings, KEYPREFIX, StdIcon_Error, StdDialogCode_Ok, REF_TEXT_COLOR, Parameters, ProcessInstance, File, DEFAULT_PIXEL_SIZE, DEFAULT_FOCAL_LENGTH, COL_FULL_FILENAME, COL_FILENAME, COL_ALT, COL_EXPOSURE, COL_FILTER, COL_AIRMASS, COL_DATEOBS, COL_NOISE, ImageWindow, isPSFScaleSnrAvailable, nsgTgtResults, getTargetTableEntries, blinkRejects, DEFAULT_MIN_WEIGHT, DEFAULT_MIN_SCALE, DEFAULT_GRADIENT_SMOOTHNESS, DEFAULT_STAR_DETECTION, DEFAULT_STAR_FLUX_TOLERANCE, DEFAULT_STAR_SEARCH_RADIUS, DEFAULT_OUTPUT_DIR, COL_PROCESSED, NSG_MIN_STAR_PAIR_WARN, StdIcon_Warning */

// Version 1.0 (c) John Murphy 5th-Apr-2021
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

let NSG_EXTRA_CONTROLS = false;

function NsgDialog(data){
    this.__base__ = Dialog;
    this.__base__();

    const greenBall = ":/bullets/bullet-ball-glass-green.png";
    const greyBall = ":/bullets/bullet-ball-glass-grey.png";
    const yellowBall = ":/bullets/bullet-ball-glass-yellow.png";
    let self = this;
    
    this.onToggleSection = function(bar, beginToggle){
        if (beginToggle){
            this.dialog.setVariableSize();
        } else {
//            bar.updateSection();
            this.dialog.setFixedSize();
        }
    };
    
    /**
    * Set reference, check FITS Hdr for FOCALLEN & XPIXSZ, updates UI.
    * Updates 'auto' values.
    * @param {NsgData} data
    * @param {String} filename
    */
    this.setReferenceFilename = function(data, filename){
        self.enabled = false;
        processEvents();
        try {
            let origFilename = data.cache.getRefFilename();
            if (data.cache.setRefFilename(filename)){
                // Reference file exists, and the ref filename has been set in the cache
                let hasChanged = origFilename !== data.cache.getRefFilename();
                if (hasChanged){
                    data.cache.setTgtFilename(undefined);
                    clearNsgResults(self, data);
                }
                this.refTextBox.text = data.cache.getRefFilename();
                // Update focal length, pixel size and pixel scale
                data.cache.getRefImage();   // cache the image for later
                let imageData = data.cache.getRefImageData();
                let hdrEntries = getHdrEntries( imageData, filename, true );
                if (!hdrEntries.XPIXSZ || !hdrEntries.FOCALLEN){
                    let imageScaleDialog = new ImageScaleDialog(hdrEntries, KEYPREFIX + "Save", false );
                    imageScaleDialog.execute();
                    hdrEntries.XPIXSZ = imageScaleDialog.getPixelSize();
                    hdrEntries.FOCALLEN = imageScaleDialog.getFocalLength();
                }
                processEvents();
                this.setPixelScaleFields(hdrEntries.XPIXSZ, hdrEntries.FOCALLEN, hdrEntries.getFilter());
                self.updateTargetTextColor(data);
                // Update auto values
                data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);
                console.noteln("Loaded reference image. Ready...");
            } else {
                clearReference(data);
            }
        } catch (error) {
            logError(error, "While setting reference image", filename);
            (new MessageBox("Failed to read reference image '" + filename + "'")).execute();
            clearReference(data);
        }
        self.enabled = true;
        processEvents();
    };

    // =======================================
    // SectionBar: "Quick Start Guide"
    // =======================================
    // Create the Program Description at the top
    let purchaseText;
    let NSGXnmlLicense = data.NSGXnmlLicense;
    if (NSGXnmlLicense.isInstalled && NSGXnmlLicense.email && NSGXnmlLicense.key){
        purchaseText = "<u>Licensed</u> to <b>" + NSGXnmlLicense.email + "</b><br />";
    } else {
        purchaseText = "Install the <b><u>NSGXnml</u></b> C++ process for extra features and compatibility " +
                "with DrizzleIntegration. Click <b><u>here</u></b> for details.<br />";
    }
    let titleLabel = new Label(this);
    titleLabel.frameStyle = FrameStyle_Sunken;
    titleLabel.margin = 4;
    titleLabel.wordWrapping = true;
    titleLabel.useRichText = true;
    titleLabel.text = "<b>Normalizes the target images to the reference. " +
        "Applies a scale factor and removes the relative gradient.</b><br />" +
        "(1) Read help sections: <i>Prerequisites</i>, <i>Quick Start Guide</i>.<br />" +
        "(2) Watch tutorials: <b><u>https://www.youtube.com/@NormalizeScaleGradient</u></b><br />" +
        "(3) Use on registered images before stacking.<br />" +
        purchaseText +
        "Copyright &copy; 2019-2023 John Murphy. <i>Thanks to Adam Block for his advice and ideas.</i>";
    titleLabel.toolTip = "Click to open a dialog. Then copy and paste links into a web browser.";
    titleLabel.onMousePress = function( x, y, button, buttonState, modifiers ){
        (new HelpDialog()).execute();
    };
    let titleSection = new Control(this);
    titleSection.sizer = new VerticalSizer;
    titleSection.sizer.add(titleLabel);
    let title = "Normalize Scale Gradient V" + VERSION;
    if (NSGXnmlLicense.isInstalled){
        title += "   (Licensed to " + NSGXnmlLicense.email + ")";
    }
    let titleBar = new SectionBar(this, title);
    titleBar.setSection(titleSection);
    titleBar.onToggleSection = this.onToggleSection;
    // SectionBar "Quick Start Guide" End
    
    // =======================================
    // SectionBar: "Reference Image"
    // =======================================
    this.refTextBox = new Edit( this );
    this.refTextBox.onEditCompleted = function(){
        // Do not allow the user to edit this field
        let refFilename = data.cache.getRefFilename();
        self.refTextBox.text = refFilename ? refFilename : "";
    };
    
    let refButton = new ToolButton( this );
    refButton.icon = this.scaledResource( ":/browser/select-file.png" );
    refButton.setScaledFixedSize( 20, 20 );
    refButton.toolTip = "<p>Select the reference image file.</p>";
    refButton.onClick = function(){
        let openFileDialog = new OpenFileDialog;
        openFileDialog.multipleSelections = false;
        openFileDialog.caption = "Select reference image";
        openFileDialog.loadImageFilters();
        if ( openFileDialog.execute() ){
            self.setReferenceFilename(data, openFileDialog.fileName);
        }
        openFileDialog = undefined;
        gc(true);
    };
    
    /**
     * @param {Number|undefined} pixelSize
     * @param {Number|undefined} focalLength
     * @param {String} filterName
     */
    this.setPixelScaleFields = function(pixelSize, focalLength, filterName){
        data.pixelSize = pixelSize ? pixelSize : DEFAULT_PIXEL_SIZE;
        data.focalLength = focalLength ? focalLength : DEFAULT_FOCAL_LENGTH;
        pixelSizeControl.text = data.pixelSize ? data.pixelSize.toFixed(2) : "0";
        focalLengthControl.text = data.focalLength.toFixed(0);
        if (filterName !== undefined)
            filterTextBox.text = filterName;
        let pixelScale = calcDegreesPerPixel(data.pixelSize, data.focalLength) * 3600;
        pixelScaleControl.text = pixelScale.toFixed(2);
        processEvents();
    };
    
    let setRef_Button = new PushButton( this );
    setRef_Button.text = "Set reference";
    setRef_Button.toolTip = "<p>Set the reference to the selected target image.</p>";
    setRef_Button.onClick = function(){
        let filename = self.getSelectedTargetFilename(true);
        if (filename){
            self.setReferenceFilename(data, filename);
            let nodes = self.files_TreeBox.selectedNodes;
            nodes[0].selected = false;
        }
        gc(true);
    };
    
    let refFileSizer = new HorizontalSizer(this);
    refFileSizer.spacing = 4;
    refFileSizer.add(this.refTextBox, 100);
    refFileSizer.add(refButton);
    refFileSizer.add(setRef_Button);
    
    let focalLength_Label = new Label( this );
    focalLength_Label.text = "Focal length:";
    focalLength_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let focalLengthControl = new Label(this);
    focalLengthControl.frameStyle = FrameStyle_Sunken;
    focalLengthControl.textAlignment = TextAlign_VertCenter;
    focalLengthControl.toolTip = "Focal length in mm";
    
    let  pixelSize_Label = new Label( this );
    pixelSize_Label.text = "Pixel size:";
    pixelSize_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let pixelSizeControl = new Label(this);
    pixelSizeControl.frameStyle = FrameStyle_Sunken;
    pixelSizeControl.textAlignment = TextAlign_VertCenter;
    pixelSizeControl.toolTip = "Pixel size, including binning, in microns";
    
    let  pixelScale_Label = new Label( this );
    pixelScale_Label.text = "Pixel scale:";
    pixelScale_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let pixelScaleControl = new Label(this);
    pixelScaleControl.frameStyle = FrameStyle_Sunken;
    pixelScaleControl.textAlignment = TextAlign_VertCenter;
    pixelScaleControl.toolTip = "Pixel scale in arcseconds";
    
    let filterTextBox = new Label( this );
    filterTextBox.frameStyle = FrameStyle_Sunken;
    filterTextBox.textAlignment = TextAlign_VertCenter;
    filterTextBox.setFixedWidth(this.font.width("XXXXXXXXXXXXXXXXX"));
    filterTextBox.toolTip = "<p>Reference filter.</p>" +
            "<p>All target images must match the reference filter.</p>";
    
    let imageScaleButton = new PushButton(this);
    imageScaleButton.text = "Image scale";
    imageScaleButton.toolTip =
            "<p>Manually set the focal length and pixel size.</p>";
    imageScaleButton.onClick = function () {
        let hdrEntries = {pixelSize: data.pixelSize, focalLength: data.focalLength};
        let imageScaleDialog = new ImageScaleDialog( hdrEntries, KEYPREFIX + "Save", true);
        if (StdDialogCode_Ok === imageScaleDialog.execute()){
            data.pixelSize = imageScaleDialog.getPixelSize();
            data.focalLength = imageScaleDialog.getFocalLength();
            self.setPixelScaleFields(data.pixelSize, data.focalLength, undefined);
            data.setPhotometryAutoValues(data.useAutoPhotometry, true);
            data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);
        }
        imageScaleDialog = undefined;
        gc(true);
    };
    
    let filterGroupBox = new GroupBox(this);
    filterGroupBox.title = "Filter";
    filterGroupBox.sizer = new HorizontalSizer;
    filterGroupBox.sizer.margin = 2;
    filterGroupBox.sizer.add(filterTextBox);
    
    let imageScaleGroupBox = new GroupBox(this);
    imageScaleGroupBox.title = "Image scale";
    imageScaleGroupBox.sizer = new HorizontalSizer;
    imageScaleGroupBox.sizer.margin = 2;
    imageScaleGroupBox.sizer.spacing = 4;
    imageScaleGroupBox.sizer.add(focalLength_Label);
    imageScaleGroupBox.sizer.add(focalLengthControl);
    imageScaleGroupBox.sizer.addSpacing(10);
    imageScaleGroupBox.sizer.add(pixelSize_Label);
    imageScaleGroupBox.sizer.add(pixelSizeControl);
    imageScaleGroupBox.sizer.addSpacing(10);
    imageScaleGroupBox.sizer.add(pixelScale_Label);
    imageScaleGroupBox.sizer.add(pixelScaleControl);
    imageScaleGroupBox.sizer.addStretch();
    imageScaleGroupBox.sizer.add(imageScaleButton);
    imageScaleGroupBox.sizer.addSpacing(2);
    
    let filterScaleSizer = new HorizontalSizer;
    filterScaleSizer.spacing = 12;
    filterScaleSizer.add(filterGroupBox);
    filterScaleSizer.add(imageScaleGroupBox, 100);
    
    let refSection = new Control(this);
    refSection.sizer = new VerticalSizer;
    refSection.sizer.spacing = 4;
    refSection.sizer.add(refFileSizer);
    refSection.sizer.add(filterScaleSizer);
    let refBar = new SectionBar(this, "Reference Image");
    refBar.setSection(refSection);
    refBar.onToggleSection = this.onToggleSection;
    // SectionBar "Reference file" End
    
    // =======================================
    // SectionBar: "Target Images"
    // =======================================
    this.files_TreeBox = new TreeBox( this );
    this.files_TreeBox.multipleSelection = true;
    this.files_TreeBox.rootDecoration = false;
    this.files_TreeBox.alternateRowColor = true;
    this.files_TreeBox.setScaledMinSize( 825, 250 );
    this.files_TreeBox.headerVisible = true;
    this.files_TreeBox.headerSorting = true;
    this.files_TreeBox.horizontalAutoScroll = true;
    this.files_TreeBox.setHeaderText( COL_FULL_FILENAME, "FullFilename" );
    this.files_TreeBox.hideColumn( COL_FULL_FILENAME, true );
    this.files_TreeBox.setHeaderText( COL_FILENAME, "Filename" );
    this.files_TreeBox.setHeaderText( COL_DATEOBS, "DATE-OBS" );
    this.files_TreeBox.setHeaderText( COL_NOISE, "Noise" );
    this.files_TreeBox.setHeaderText( COL_ALT, "ALT" );
    this.files_TreeBox.setHeaderText( COL_AIRMASS, "Airmass" );
    this.files_TreeBox.setHeaderText( COL_EXPOSURE, "Time" );
    this.files_TreeBox.setHeaderText( COL_FILTER, "Filter" );
    this.files_TreeBox.setHeaderText( COL_PROCESSED, "" );
    this.files_TreeBox.onNodeDoubleClicked = function ( treeBoxNode, columnIndex ){
        let filename = treeBoxNode.text(COL_FULL_FILENAME);
        console.noteln("Opening ", filename);
        let imageWindows = ImageWindow.open(filename, "view", "no-warnings verbosity 0");
        let imageWindow = imageWindows[0];
        let view = imageWindow.mainView;
        let stf = new ScreenTransferFunction;
        stf.STF = STFAutoStretch(view);
        stf.executeOn(view);
        imageWindow.zoomToFit();
        console.hide();
        imageWindow.show();
        imageWindow.bringToFront();
    };
    
    /**
     * Sets icon to green or grey ball, and text to " " or "".
     * @param {TreeBoxNode} node
     * @param {NsgData} data
     * @param {String} filename
     * @returns {Boolean} True if this target has been processed
     */
    this.setNodeProcessedCol = function(node, data, filename){
        let icon;
        let sortText;
        let processed = isCachedResultValid(data, filename);
        if (processed){
            let result = nsgTgtResults.get(filename);
            if (result.hasPhotometryWarning(NSG_MIN_STAR_PAIR_WARN)){
                icon = yellowBall;      // Too few photometry star matches
                sortText = " ";
            } else {
                icon = greenBall;
                sortText = "";
            }
        } else {
            // One or more unprocessed targets.
            icon = greyBall;
            sortText = "  ";     // Using a space here allows the column to be sorted.
        }
        node.setIcon( COL_PROCESSED, self.scaledResource( icon ));
        node.setText( COL_PROCESSED, self.scaledResource( sortText ));
        return processed;
    };
    
    /**
     * Sets reference text color to green. All other rows use black.
     * @param {NsgData} data
     */
    this.updateTargetTextColor = function(data){
        let enableContinueRun = false;
        let refFilename = data.cache.getRefFilename();
        let refFilter = filterTextBox.text;
        let nProcessed = 0;
        for ( let i = 0; i < self.files_TreeBox.numberOfChildren; ++i ){
            let node = self.files_TreeBox.child( i );
            let font = node.font( COL_FILENAME );
            let filename = node.text( COL_FULL_FILENAME );
            let filter = node.text( COL_FILTER );
            let color;
            let isRef = (filename === refFilename);
            if (isRef){
                font.italic = true;
                color = REF_TEXT_COLOR;
            } else if (refFilename && filter !== refFilter){
                font.italic = false;
                color = 0xFFFF0000; 
            } else {
                font.italic = false;
                color = 0xFF000000; 
            }
            let nColumns = self.files_TreeBox.numberOfColumns;
            for (let j = 0; j < nColumns; j++){
                node.setFont( j, font );
                node.setTextColor(j, color); 
            }
            let processed = self.setNodeProcessedCol(node, data, filename);
            if (processed){
                nProcessed++;
            } else {
                enableContinueRun = true;   // One or more unprocessed targets.
            }
        }
        if (0 === nsgTgtResults.size){
            // If all targets are unprocessed, there is nothing to continue. Use 'Run all' instead.
            enableContinueRun = false;
        }
        self.updateTargetImageCount(nProcessed);
        self.enableRunButton(enableContinueRun);
        adjustFilenameColumnWidth();
    };
    
    this.fullPathCheckBox = new CheckBox();
    this.fullPathCheckBox.text = "Full paths";
    this.fullPathCheckBox.toolTip = "<p>Show full path for target images.</p>";
    this.fullPathCheckBox.onClick = function( checked ){
        data.useFullPath = checked;
        data.savedSelectedTarget = self.getSelectedTargetFilename(false);
        updateTargetImagesList();
        setSelectedTarget();
    };
    
    /**
     * Update Processed text field to nProcessed / (target image list length)
     * @param {Number} nProcessed
     */
    this.updateTargetImageCount = function(nProcessed){
        nImagesControl.text = "" + nProcessed + " / " + self.files_TreeBox.numberOfChildren.toString();
    };
    
    let nImages_Label = new Label( this );
    nImages_Label.text = "Processed:";
    nImages_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let nImagesControl = new Label(this);
    nImagesControl.frameStyle = FrameStyle_Sunken;
    nImagesControl.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    nImagesControl.toolTip = "<p>(Number of processed images) / (Total number of target images).</p>" +
            "<p>Use this to check that you have loaded all of your target images.</p>" +
            "<p>If some, but not all, images have been processed, use <b>Continue run</b> to process the rest.</p>";
    nImagesControl.setMinWidth(this.font.width("9999"));
    
    function updateTargetImagesList(){
        self.files_TreeBox.clear();
        let tgtTableEntriesArray = [];
        let nFiles = data.targetFiles.length;
        if (nFiles > 0){
            for ( let i = nFiles - 1; i >= 0; i-- ){
                try {
                    tgtTableEntriesArray.push(getTargetTableEntries(data.targetFiles[i]));
                } catch (exception){
                    logError(exception);
                    console.criticalln("\n** ERROR: Failed to read FITS header from " + data.targetFiles[i] + "\n" + exception);
                    data.targetFiles.splice(i, 1);
                }
            }
        }
        let maxNoise = getMaxDisplayNoise(tgtTableEntriesArray);
        for ( let i = tgtTableEntriesArray.length - 1; i >= 0 ; i-- ){
            addTargetFileNode(tgtTableEntriesArray[i], maxNoise);
        }
        self.updateTargetTextColor(data);
        enableBlink();
    }
    
    /**
     * Read and cache FITS headers
     * @param {String[]} files
     * @param {Number} interval progress feedback increment
     * @returns {String[] files that were read without errors.}
     */
    function cacheFitsHeaders(files, interval){
        let lastProgressPc = 0;
        function progressCallback(count, total){
            if (count === 0){
                console.write("\n<b>Reading ", total, " FITS Headers</b>   0%");
                lastProgressPc = 0;
                processEvents();
            } else{
                let pc = Math.round(100 * count / total);
                if (pc > lastProgressPc && (pc > lastProgressPc + interval || pc === 100)){
                    if (pc < 100){
                        console.write(format("\b\b\b\b%3d%%", pc));
                    } else {
                        console.writeln(format("\b\b\b\b"));
                    }
                    lastProgressPc = pc;
                    processEvents();
                }
            }
            return true;
        }
        let outputFiles = [];
        let nFiles = files.length;
        let errorMessages = [];
        if (nFiles > 0){
            progressCallback(0, nFiles);
            for ( let i = nFiles - 1; i >= 0; i-- ){
                try {
                    getTargetTableEntries(files[i]);
                    outputFiles.push(files[i]);
                } catch (exception){
                    errorMessages.push("\nFailed to read FITS header from " + files[i] + "\n" + exception);
                }
                progressCallback(nFiles - i, nFiles);
            }
        }
        errorMessages.forEach(errorMsg => console.criticalln(errorMsg));
        return outputFiles;
    }
    
    let filesAdd_Button = new PushButton( this );
    filesAdd_Button.text = "Add";
    filesAdd_Button.icon = this.scaledResource( ":/icons/add.png" );
    filesAdd_Button.toolTip = "<p>Add target files.</p>";
    filesAdd_Button.onClick = function(){
        let openFileDialog = new OpenFileDialog;
        openFileDialog.multipleSelections = true;
        openFileDialog.caption = "Select Target Images";
        openFileDialog.loadImageFilters();

        if ( openFileDialog.execute() ){
            try {
                self.enabled = false;
                processEvents();
                let tgtFilenamesSet = new Set();
                for (let filename of data.targetFiles){
                    tgtFilenamesSet.add(filename);
                }
                let inputFiles = [];
                for ( let i = 0; i < openFileDialog.fileNames.length; ++i ){
                    if (!tgtFilenamesSet.has(openFileDialog.fileNames[i]))
                        inputFiles.push(openFileDialog.fileNames[i]);
                }
                if (openFileDialog.fileNames.length !== inputFiles.length){
                    let duplicates = openFileDialog.fileNames.length - inputFiles.length;
                    console.writeln("(", duplicates, " duplicate images were ignored)");
                }
                if (inputFiles.length){
                    inputFiles = cacheFitsHeaders(inputFiles, 1);
                    data.targetFiles = inputFiles.concat(data.targetFiles);
                    data.targetFiles.sort();
                    updateTargetImagesList();
                }
                console.writeln("", inputFiles.length, " images were added to the 'Target Images' table.");
            } catch (e){
                logError(e);
            } finally {
                self.enabled = true;
                processEvents();
            }
        }
        openFileDialog = undefined;
        gc(true);
    };

    let filesClear_Button = new PushButton( this );
    filesClear_Button.text = "Clear";
    filesClear_Button.icon = this.scaledResource( ":/icons/reload.png" );
    filesClear_Button.toolTip = "<p>Remove all target files from the list.</p>";
    filesClear_Button.onClick = function(){
        clearReference(data);
        clearAllTargets(data);
        recoverMemory(data);
    };

    let filesInvert_Button = new PushButton( this );
    filesInvert_Button.text = "Invert selection";
    filesInvert_Button.icon = this.scaledResource( ":/icons/select-invert.png" );
    filesInvert_Button.toolTip = "<p>Invert the current selection of target files.</p>";
    filesInvert_Button.onClick = function(){
        for ( let i = 0; i < self.files_TreeBox.numberOfChildren; ++i ){
            self.files_TreeBox.child( i ).selected = !self.files_TreeBox.child( i ).selected;
        }
        data.cache.setTgtFilename(undefined);
    };

    let filesRemove_Button = new PushButton( this );
    filesRemove_Button.text = "Remove selected";
    filesRemove_Button.icon = this.scaledResource( ":/icons/delete.png" );
    filesRemove_Button.toolTip = "<p>Remove all selected files from the list.</p>";
    filesRemove_Button.onClick = function(){
        try{
            let refFilename = data.cache.getRefFilename();
            for ( let i = self.files_TreeBox.numberOfChildren - 1; i >= 0; --i){
                if ( self.files_TreeBox.child( i ).selected ){
                    let node = self.files_TreeBox.child( i );
                    if (node.text(COL_FULL_FILENAME) === refFilename){
                        clearReference(data);
                    }
                    self.files_TreeBox.remove( i );
                }
            }
            if (self.files_TreeBox.numberOfChildren === 0){
                clearAllTargets(data);
            } else {
                data.cache.setTgtFilename(undefined);
                data.targetFiles.length = 0;
                for ( let i = 0; i < self.files_TreeBox.numberOfChildren; ++i ){
                    data.targetFiles.push(self.files_TreeBox.child( i ).text( COL_FULL_FILENAME ));
                }
                adjustFilenameColumnWidth();
                enableBlink();
                self.updateTargetTextColor(data);   // Disable 'Continue run' if all unprocessed targets removed.
            }
        } catch (e){
            logError(e);
        }
        gc(true);
    };
    
    let resultsAdd_Button = new PushButton( this );
    resultsAdd_Button.text = "Results.nsg";
    resultsAdd_Button.icon = this.scaledResource( greenBall );
    resultsAdd_Button.toolTip = "<p>You usually don't need to set the results file; " +
            "it is automatically saved within the NSG settings.</p>" +
            "<p>However, there is a small risk that if PixInsight crashed during a run, " +
            "this setting may be lost. If so, to enable <b>Continue run</b>, select the results file " +
            "written by the previous run. Example filename:</p>" +
            "<p>.../NSG/NsgData/NSG_Results_2023.02.09_15h30m38s.nsg</p>";
    resultsAdd_Button.onClick = function(){
        let openFileDialog = new OpenFileDialog;
        openFileDialog.caption = "Select a NSG Results file. [Example: .../NSG/NsgData/NSG_Results_2023.02.09_15h30m38s.nsg]";
        openFileDialog.multipleSelections = false;
        if ( openFileDialog.execute() ){
            try {
                self.enabled = false;
                processEvents();
                let resultsFile = openFileDialog.fileNames[0];
                let suffix = File.extractExtension(resultsFile).toLowerCase();
                if (suffix === ".nsg"){
                    readResultsFile(data, resultsFile);
                    self.updateTargetTextColor(data);
                    self.enableImageRejection(nsgTgtResults.size > 0);
                    processEvents();
                } else {
                    new MessageBox("<p>Invalid <b>NSG_Results*[DATE].nsg</b> filename:</p><p>" + 
                        File.extractNameAndExtension(resultsFile) + "</p>", TITLE, StdIcon_Error, StdButton_Ok).execute();
                }
            } catch (e){
                logError(e);
            } finally {
                self.enabled = true;
                processEvents();
            }
        }
        openFileDialog = undefined;
        gc(true);
    };
    
    let targetImagesGroupBox = new GroupBox(this);
    targetImagesGroupBox.title = "Target images";
    targetImagesGroupBox.sizer = new HorizontalSizer();
    targetImagesGroupBox.sizer.margin = 2;
    targetImagesGroupBox.sizer.spacing = 4;
    targetImagesGroupBox.sizer.addSpacing(5);
    targetImagesGroupBox.sizer.add( this.fullPathCheckBox );
    targetImagesGroupBox.sizer.addStretch();
    targetImagesGroupBox.sizer.add( filesAdd_Button );
    targetImagesGroupBox.sizer.addStretch();
    targetImagesGroupBox.sizer.add( filesClear_Button );
    targetImagesGroupBox.sizer.addStretch();
    targetImagesGroupBox.sizer.add( filesInvert_Button );
    targetImagesGroupBox.sizer.add( filesRemove_Button );
    targetImagesGroupBox.sizer.addSpacing(2);
    
    let continueRunGroupBox = new GroupBox(this);
    continueRunGroupBox.title = "Continue run";
    continueRunGroupBox.sizer = new HorizontalSizer();
    continueRunGroupBox.sizer.margin = 2;
    continueRunGroupBox.sizer.spacing = 4;
    continueRunGroupBox.sizer.addSpacing(5);
    continueRunGroupBox.sizer.add( nImages_Label );
    continueRunGroupBox.sizer.add( nImagesControl );
    continueRunGroupBox.sizer.add( resultsAdd_Button );
    continueRunGroupBox.sizer.addSpacing(2);

    let filesButtons_Sizer = new HorizontalSizer;
    filesButtons_Sizer.spacing = 10;
    filesButtons_Sizer.add( targetImagesGroupBox, 100 );
    filesButtons_Sizer.add( continueRunGroupBox, 0 );
    let filesSection = new Control(this);
    filesSection.sizer = new VerticalSizer;
    filesSection.sizer.add( this.files_TreeBox );
    filesSection.sizer.addSpacing(4);
    filesSection.sizer.add( filesButtons_Sizer );
    let filesBar = new SectionBar(this, "Target Images");
    filesBar.setSection(filesSection);
    filesBar.onToggleSection = this.onToggleSection;
    // SectionBar "Target Images" End
    
    //------------------------------------------
    // Blink and set Reference
    //------------------------------------------
    this.limitingNumberToBlink_CheckBox = new CheckBox( this );
    this.limitingNumberToBlink_CheckBox.text = "Limit to best:";
    this.limitingNumberToBlink_CheckBox.toolTip = "<p>Restrict the images to blink " +
            "to the specified number of images that have the lowest noise estimates.</p>" +
            "<p>This option is necessary if you have hundreds of images in order to " +
            "reduce processing time and memory requirements.</p>";
    this.limitingNumberToBlink_CheckBox.onClick = function( checked ){
        data.limitingNumberToBlink = checked;
        self.limitBlinkEdit.enabled = checked;
    };
    this.limitBlinkEdit = new NumericEdit(this);
    this.limitBlinkEdit.real = false;
    this.limitBlinkEdit.label.text = "";
    this.limitBlinkEdit.toolTip = "<p>Limit to the specified number of best images.</p>";
    this.limitBlinkEdit.setRange(2, 99);
    this.limitBlinkEdit.onValueUpdated = function (value){
        data.limitBlinkNumber = value;
    };
    this.limitBlinkEdit.enabled = data.isNSGXnmlInstalled && data.limitingNumberToBlink;
    
    let blink_Button = new PushButton( this );
    blink_Button.text = "Blink and set reference";
    blink_Button.toolTip = "<p>Blink through the <b>Target images</b> to find the best reference image.</p>" +
            "<p>Choose a reference image with a small and simple gradient " +
            "that's not too badly affected by satellite trails.</p>" +
            "<p>The images are sorted by NWEIGHT. To make the comparisons fair and meaningful, the " +
            "target images are corrected for both scale and offset to the reference image. " +
            "The same stretch is then applied to all images. The gradients are <b>not</b> removed.</p>";
    blink_Button.onClick = function(){
        blinkDataArray = [];
        let files = data.targetFiles;
        let nFiles = files.length;
        let allHaveNoiseHdr = true;
        if (nFiles > 1){
            for ( let i = nFiles - 1; i >= 0; i-- ){
                try {
                    let entry = getTargetTableEntries(files[i]);
                    let exposure = entry.getExposure();
                    let displayNoise = entry.getDisplayNoise();
                    let noiseType = entry.getNoiseType();
                    blinkDataArray.push(new BlinkData(files[i], displayNoise, noiseType, exposure, 0));
                    if (!displayNoise){
                        allHaveNoiseHdr = false;
                    }
                } catch (exception){
                    console.criticalln("\n** ERROR: Failed to read FITS header from " + files[i] + "\n" + exception);
                    logError(exception);
                    blinkDataArray = [];
                    return;
                }
            }
            if (data.limitingNumberToBlink){
                if (!allHaveNoiseHdr){
                    new MessageBox("The <b>Limit to best</b> option requires that " +
                            "all images contain the NOISExx FITS header. " +
                            "Deselect this option to use <b>Blink</b> with images that don't have a noise estimate.", 
                            TITLE, StdIcon_Error, StdButton_Ok).execute();
                    return;
                }
                if (data.limitBlinkNumber < blinkDataArray.length){
                    blinkDataArray.sort((a, b) => a.displayNoise - b.displayNoise);
                    blinkDataArray.length = data.limitBlinkNumber;
                }
            }
            // NsgDialog will be hidden, and if runBlinkFlag, Blink will be run.
            // If !runBlinkFlag, NSG is run.
            runBlinkFlag = true;
            self.ok();
        } else {
            new MessageBox("Error: Less than 2 images to blink", TITLE, StdIcon_Error, StdButton_Ok).execute();
        }
    };
    blink_Button.enabled = false;
    
    /**
     * Get the TargetTableEntries for each targetFile.
     * If all entries have a noise value, enable the Blink button.
     */
    function enableBlink(){
        blink_Button.enabled = data.targetFiles.length > 1;
    }
    
    /**
     * @param {NsgData} data 
     * @param {BlinkData[]} rejects
     * @returns {Number} Number of images removed
     */
    function removeImagesFromTargetList(data, rejects){
        let rejectedFilesSet = new Set();
        for (let reject of rejects){
            rejectedFilesSet.add(reject.filename);
        }
        
        let newTargetFiles = [];
        for (let tgtFile of data.targetFiles){
            if (!rejectedFilesSet.has(tgtFile)){
                newTargetFiles.push(tgtFile);
            }
        }
        let count = data.targetFiles.length - newTargetFiles.length;
        if (count > 0){
            self.enabled = false;
            data.targetFiles = newTargetFiles;
            processEvents();
            updateTargetImagesList();
            self.enabled = true;
            processEvents();
        }
        console.noteln("Removed ", count, " images from Target Images list");
        rejectedFilesSet.clear();
        rejectedFilesSet = undefined;
        gc(true);
        return count;
    }
    
    let rejectBlinkRejectsButton = new PushButton(this);
    rejectBlinkRejectsButton.text = "Remove from Target list";
    rejectBlinkRejectsButton.toolTip = "<p>Remove the blink rejects from the <b>Target Images</b> list. " +
            "(The files are not moved or deleted from the file system.)</p>";
    rejectBlinkRejectsButton.onClick = function () {
        removeImagesFromTargetList(data, blinkRejects);
    };
    
    let moveRejectedBlinkButton = new PushButton(this);
    moveRejectedBlinkButton.text = "Move to ./NSG_Reject";
    moveRejectedBlinkButton.toolTip = "<p>Move rejected images to a subfolder <b>NSG_Reject</b></p>" +
            "<p>Drizzle '.xdrz' files are also moved if the <b>Drizzle data</b> option is selected.</p>" +
            "<p>The rejected images are also removed from the <b>Target Images</b> list.";
    moveRejectedBlinkButton.onClick = function () {
        removeImagesFromTargetList(data, blinkRejects);
        self.enabled = false;
        processEvents();
        let subFolderName = "NSG_Reject";
        let count = 0;
        for (let blinkData of blinkRejects){
            if (File.exists(blinkData.filename)){
                console.writeln("\nMoving ", File.extractName(blinkData.filename), ":");
                moveFile(blinkData.filename, subFolderName, "Input image->");
                count++;
                if (data.addDrizzleFiles){
                    let drizzleFile = File.changeExtension( blinkData.filename, ".xdrz" );
                    if (File.exists(drizzleFile)){
                        moveFile(drizzleFile, subFolderName, "Drizzle    ->");
                    }
                }
            }
        }
        console.noteln("Moved ", count, " images to ./", subFolderName);
        blinkRejects = [];
        self.enabled = true;
        processEvents();
        gc(true);
    };
    
    if (!data.isNSGXnmlInstalled){
        let purchaseText = "<p>Purchase NSGXnml to enable this option. " +
            "Click on the <b>NSGXnml</b> link at the top of this dialog for more information.</p>";
        this.limitingNumberToBlink_CheckBox.toolTip += purchaseText;
        blink_Button.toolTip += purchaseText;
        rejectBlinkRejectsButton.toolTip += purchaseText;
        moveRejectedBlinkButton.toolTip += purchaseText;
    }
    
    let blinkSubFolderGroupBox = new GroupBox(this);
    blinkSubFolderGroupBox.title = "Blink rejections";
    blinkSubFolderGroupBox.sizer = new HorizontalSizer();
    blinkSubFolderGroupBox.sizer.margin = 2;
    blinkSubFolderGroupBox.sizer.addSpacing(2);
    blinkSubFolderGroupBox.sizer.add(rejectBlinkRejectsButton);
    blinkSubFolderGroupBox.sizer.addStretch();
    blinkSubFolderGroupBox.sizer.add(moveRejectedBlinkButton);
    blinkSubFolderGroupBox.sizer.addSpacing(2);
    
    let blinkGroupBox = new GroupBox(this);
    blinkGroupBox.title = "Blink";
    blinkGroupBox.sizer = new HorizontalSizer();
    blinkGroupBox.sizer.margin = 2;
    blinkGroupBox.sizer.addSpacing(5);
    blinkGroupBox.sizer.add(this.limitingNumberToBlink_CheckBox);
    blinkGroupBox.sizer.add(this.limitBlinkEdit);
    blinkGroupBox.sizer.addStretch();
    blinkGroupBox.sizer.add(blink_Button);
    blinkGroupBox.sizer.addSpacing(2);
    
    let blinkRejectionBarTitle = data.isNSGXnmlInstalled ? "Image Inspection" : "Image Inspection (Purchase NSGXnml)";
    let blinkRejectionSection = new Control(this);
    blinkRejectionSection.sizer = new HorizontalSizer(this);
    blinkRejectionSection.sizer.margin = 2;
    blinkRejectionSection.sizer.spacing = 10;
    blinkRejectionSection.sizer.add(blinkGroupBox, 50);
    blinkRejectionSection.sizer.add(blinkSubFolderGroupBox, 50);
    blinkRejectionSection.enabled = data.isNSGXnmlInstalled;
    
    let blinkRejectionBar = new SectionBar(this, blinkRejectionBarTitle);
    blinkRejectionBar.setSection(blinkRejectionSection);
    blinkRejectionBar.onToggleSection = this.onToggleSection;
    blinkRejectionBar.toolTip = "<p>Blink and set Reference image.</p>";
    
    // =======================================
    // SectionBar: "Output Images"
    // =======================================
    let labelDirectoryWidth = this.font.width( "Directory:" );
    let outputDir_Label = new Label( this );
    outputDir_Label.text = "Directory:";
    outputDir_Label.minWidth = labelDirectoryWidth;
    outputDir_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
        
    this.outputDirTextBox = new Edit( this );
    this.outputDirTextBox.toolTip = "<p>To save to the relative subdirectory 'dirName', use './dirName'. " +
            "If the folder does not exist, it will be created.</p>" +
            "<p>To use the input file's directory, use './', or leave this field blank.</p>" +
            "<p>To specify a specific directory, use the directory browser.</p>";
    this.outputDirTextBox.onTextUpdated = function(text){
        data.outputDir = text.trim();
    };
    let outputDir_Reset = new ToolButton(this);
    outputDir_Reset.icon = this.scaledResource(":/icons/reload.png");
    outputDir_Reset.toolTip = "<p>Reset to <b>" + DEFAULT_OUTPUT_DIR + "</b><\p>" +
            "<p>The files are then saved to the subdirectory <b>" + 
            DEFAULT_OUTPUT_DIR + "</b> The subdirectory is created if it doesn't exist.</p>";
    outputDir_Reset.onClick = function(){
        data.outputDir = DEFAULT_OUTPUT_DIR;
        self.outputDirTextBox.text = data.outputDir; 
    };
    
    let outputDirButton = new ToolButton( this );
    outputDirButton.icon = this.scaledResource( ":/browser/select-file.png" );
    outputDirButton.setScaledFixedSize( 20, 20 );
    outputDirButton.toolTip = "<p>Select the output directory.</p>";
    outputDirButton.onClick = function(){
        let openFolderDialog = new GetDirectoryDialog();
        openFolderDialog.caption = "Select Output Directory";
        if (data.outputDir && data.outputDir.trim().length && File.directoryExists( data.outputDir)){
            openFolderDialog.initialPath = data.outputDir;
        } else {
            let refFile = data.cache.getRefFilename();
            if (refFile){
                let initialDir = getOutputDir(data, refFile);
                if (initialDir && File.directoryExists(initialDir))
                    openFolderDialog.initialPath = initialDir;
            }
        }
        if ( openFolderDialog.execute() ){
            data.outputDir = openFolderDialog.directory;
            self.outputDirTextBox.text = data.outputDir;
        }
        openFolderDialog = undefined;
        gc(true);
    };
    let outputDirSizer = new HorizontalSizer(this);
    outputDirSizer.spacing = 4;
    outputDirSizer.add(outputDir_Label);
    outputDirSizer.add(this.outputDirTextBox, 100);
    outputDirSizer.add(outputDir_Reset);
    outputDirSizer.add(outputDirButton);
    
    let postfix_Label = new Label( this );
    postfix_Label.text = "Postfix:";
    postfix_Label.minWidth = labelDirectoryWidth;
    postfix_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    this.postFixTextBox = new Edit( this );
    this.postFixTextBox.setFixedWidth(this.font.width("___NSGWEIGHT___"));
    this.postFixTextBox.onTextUpdated = function (value){
        data.outputPostFix = value.trim();
    };
    
    this.overwriteCheckBox = new CheckBox( this );
    this.overwriteCheckBox.text = "Overwrite";
    this.overwriteCheckBox.toolTip =
        "<p>Allow overwriting of existing image files.</p>";
    this.overwriteCheckBox.onClick = function( checked ){
        data.overwrite = checked;
    };
    
    this.displayGradientToggle = new CheckBox(this);
    this.displayGradientToggle.text = "Gradient images";
    this.displayGradientToggle.toolTip = "<p>Save images that show the relative gradient." +
            "<Filenames start with 'gradient'/p>" +
            "<p>If a gradient peak or trough corresponds to a bright star, " +
            "increase the <b>Star circle growth rate</b> (Sample Generation section).</p>" +
            "<p>If a very bright saturated star does not have a rejection circle, " +
            "use Manual Sample Rejection to add one.</p>";
    this.displayGradientToggle.onCheck = function (checked) {
        data.displayGradient = checked;
    };
    this.displayGradientToggle.checked = data.displayGradient;
    
    /**
     * When create .xnml file option is selected, enable drizzle files and Normalized files.
     * When deselected, disable drizzle files and Normalized files and force Normalized files to checked.
     * @param {NsgData} data
     */
    function enableDrizzleToggle(data){
        if (data.createXnml){
            // Creating .xnml files, so can enable drizzle.
            self.writeNormalizedToggle.enabled = true;
            self.addDrizzleFilesToggle.enabled = true;
        } else {
            // Not creating .xnml files, so we must always write normalized files.
            self.writeNormalizedToggle.enabled = false;
            self.addDrizzleFilesToggle.enabled = false;
            self.addDrizzleFilesToggle.checked = false;
            data.addDrizzleFiles = false;
            self.writeNormalizedToggle.checked = true;
            data.writeNormalized = true;
        }
    }
    
    let nsgXnmlToggleTooltip = "<p>Create Local Normalization '.xnml' data files. " +
            "These '.xnml' files contain the scale and gradient correction data. " +
            "ImageIntegration and DrizzleIntegration can use these files to " +
            "apply the NSG scale and gradient correction.</p>";
    
    if (data.isNSGXnmlInstalled){
        nsgXnmlToggleTooltip += "<p>When using '.xnml' data files, there is no need to " + 
                "generate 'Normalized images'.</p>";
        if (isPSFScaleSnrAvailable){
            nsgXnmlToggleTooltip += "<p>ImageIntegration <b>Weights</b> algorithm should be set to " +
                "<b>PSF Scale SNR</b>. This uses the same weight algorithm as NSG, and the " +
                "scale factor is calculated by NSG and sent via the '.xnml' data files.</p>";
        } else {
            nsgXnmlToggleTooltip += "<p>NWEIGHT will be added to the input images FITS Header " +
                "(the input image data is not modified).</p>";
        }
    } else {
        nsgXnmlToggleTooltip += "<p>To enable this option, purchase <b>NSGXnml</b>.</p>" +
            "<p>Click on the <b>NSGXnml</b> link at the top of this dialog for more information.</p>";
    }
    this.nsgXnmlToggle = new CheckBox(this);
    this.nsgXnmlToggle.text = "Normalization data";
    this.nsgXnmlToggle.toolTip = nsgXnmlToggleTooltip;
    this.nsgXnmlToggle.onCheck = function (checked) {
        data.createXnml = checked;
        self.writeNormalizedToggle.checked = !checked;
        data.writeNormalized = !checked;
        enableDrizzleToggle(data);
        enableDrizzle();
        self.updateTargetTextColor(data);
        if (checked && isPSFScaleSnrAvailable){
            self.noiseWeightTextBox.text = "PSF Scale SNR";
            self.noiseWeightTextBox.enabled = false;
        } else {
            self.noiseWeightTextBox.text = data.noiseWeightKeyword;
            self.noiseWeightTextBox.enabled = true;
        }
    };
    this.nsgXnmlToggle.checked = data.createXnml;

    this.writeNormalizedToggle = new CheckBox(this);
    this.writeNormalizedToggle.text = "Normalized images";
    this.writeNormalizedToggle.toolTip = 
            "<p>Save normalized images that have been corrected for scale and gradient " +
            "to match the reference image.</p>" +
            "<p>If <i>Normalization data</i> '.xnml' files are created, there is no need to save these normalized files. " +
            "The '.xnml' files contain all the information required by ImageIntegration " +
            "and DrizzleIntegration to normalize the files.</p>" +
            "<p>However, creating normalized files and blinking through them " +
            "is a useful way to check the normalization.</p>";
    this.writeNormalizedToggle.onCheck = function (checked) {
        data.writeNormalized = checked;
        enableDrizzleToggle(data);
        self.updateTargetTextColor(data);
    };
    this.writeNormalizedToggle.checked = data.writeNormalized;
    this.nsgXnmlToggle.enabled = data.isNSGXnmlInstalled;
    
    let drizzleToolTip = 
            "<p>Add Drizzle .xdrz to ImageIntegration.</p>" +
            "<p>Drizzle files are created during registration by StarAlignment. " +
            "NSG will look for .xdrz files that have the same filename (including the path) " +
            "as the corresponding registered image.</p>" +
            "<p>If one or more .xdrz files are missing, a warning will be written to the console.</p>";
    if (data.isNSGXnmlInstalled){
        drizzleToolTip += "<p>Select 'Normalization data' to enable this option.</p>";
    } else {
        drizzleToolTip += "<p>To enable this option, purchase <b>NSGXnml</b>.</p>" +
            "<p>Click on the <b>NSGXnml</b> link at the top of this dialog for more information.</p>";
    }
    this.addDrizzleFilesToggle = new CheckBox(this);
    this.addDrizzleFilesToggle.text = "Drizzle data";
    this.addDrizzleFilesToggle.toolTip = drizzleToolTip;
    this.addDrizzleFilesToggle.onCheck = function (checked) {
        data.addDrizzleFiles = checked;
        enableDrizzle();
    };
    this.addDrizzleFilesToggle.checked = data.addDrizzleFiles;
    enableDrizzleToggle(data);

    let noiseWeightToolTip = "<p>NWEIGHT is the square of the signal to noise ratio.</p>";
    if (isPSFScaleSnrAvailable){
        noiseWeightToolTip += "<p>When <b>Normalization data</b> is used, " +
            "ImageIntegration <b>Weights</b> algorithm should be set to " +
            "<b>PSF Scale SNR</b>. This uses the same weight algorithm as NSG, and the " +
            "scale factor is calculated by NSG and sent via the '.xnml' data files.</p>" +
            "<p>Otherwize ";
    } else {
        noiseWeightToolTip += "<p>";
    }
    noiseWeightToolTip += "NWEIGHT can be used by ImageIntegration to specify the weight of each image. " +
        "Use this text box to specify the FITS header name. In ImageIntegration, set:<br/>" +
        "<b>Weights:</b> to 'FITS keyword'<br/>" +
        "<b>Weight keyword:</b> to this value.</p>";
    let noiseWeight_Label = new Label( this );
    noiseWeight_Label.text = "Weight:";
    noiseWeight_Label.minWidth = labelDirectoryWidth;
    noiseWeight_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    noiseWeight_Label.toolTip = noiseWeightToolTip;
    this.noiseWeightTextBox = new Edit( this );
    this.noiseWeightTextBox.setFixedWidth(this.font.width("___NSGWEIGHT___"));
    this.noiseWeightTextBox.toolTip = noiseWeightToolTip;        
    this.noiseWeightTextBox.onTextUpdated = function (value){
        let keyword = value.trim();
        // Allow 8 characters if last digit is '0'. Otherwise limit to 7.
        if (keyword.length >= 8){
            let maxLen = keyword[7] === '0' ? 8 : 7;
            keyword = keyword.substring(0, maxLen);
            self.noiseWeightTextBox.text = keyword;
        }
        data.noiseWeightKeyword = keyword.length ? keyword : "NWEIGHT";
    };
    
    let weightPrefixCheckBoxText;
    let weightPrefixCheckBoxToolTip;
    this.weightPrefixCheckBox = new CheckBox( this );
    if (data.isNSGXnmlInstalled){
        weightPrefixCheckBoxText = "Weight postfix";
        weightPrefixCheckBoxToolTip = "<p>Postfix the '.xnml' output files with their weight. " +
        "The weights can be viewed from the ImageIntegration Input Images tooltips.</p>" +
        "<p>Example filename: 'filename_nsg_w098.xnml' for a file with weight 0.98</p>";
    } else {
        weightPrefixCheckBoxText = "Weight prefix";
        weightPrefixCheckBoxToolTip = "<p>Prefix the output files with their weight. " +
        "Files can then be ordered by weight within a file browser.</p>" +
        "<p>Example filename: 'w098_filename_nsg' for a file with weight 0.98</p>" + 
        "<p>To enable this option, purchase <b>NSGXnml</b>.</p>";
    }
    this.weightPrefixCheckBox.text = weightPrefixCheckBoxText;
    this.weightPrefixCheckBox.toolTip = weightPrefixCheckBoxToolTip;
    this.weightPrefixCheckBox.onClick = function( checked ){
        data.weightPrefix = checked;
    };
    this.weightPrefixCheckBox.enabled = data.isNSGXnmlInstalled;
    
    let csvFileToolTip = "<p>Save statistics to a csv file. This records the imaging conditions and image weights.</p>" +
            "<p>Tip: to graph your night's observations, sort the spreadsheet on the 'DATE-OBS' column.</p>" +
            "<p>The CSV file is saved to <b>./NSG/NsgData/NSG_CSV[date].csv</b></p>";
    if (!data.isNSGXnmlInstalled){
        csvFileToolTip += "<p>Purchase NSGXnml to enable this option.</p>";
        data.csvFile = false;
    }
    this.csvFileCheckBox = new CheckBox( this );
    this.csvFileCheckBox.text = "CSV file";
    this.csvFileCheckBox.toolTip = csvFileToolTip;
    this.csvFileCheckBox.onClick = function( checked ){
        data.csvFile = checked;
    };
    this.csvFileCheckBox.enabled = data.isNSGXnmlInstalled;
    
    let onError_Label = new Label( this );
    onError_Label.text = "On error:";
    onError_Label.minWidth = labelDirectoryWidth;
    onError_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    this.onErrorComboBox = new ComboBox( this );
    this.onErrorComboBox.addItem("Continue");
    this.onErrorComboBox.addItem("Abort");
    this.onErrorComboBox.addItem("Ask user");
    this.onErrorComboBox.toolTip = "<p>Note that if a run is aborted, " +
            "the 'Rescale result' option is also aborted.</p>" +
            "<p>The images that have already been normalized will not be rescaled.</p>";
    this.onErrorComboBox.onItemSelected = function ( itemIndex ){
        data.onErrorIndex = itemIndex;
    };
    
    let bestPerformanceButton = new PushButton(this);
    bestPerformanceButton.icon = this.scaledResource(":/icons/reload.png");
    bestPerformanceButton.text = "Recommended settings";
    bestPerformanceButton.toolTip =
            "<p>Updates the settings for best:" +
            "<ul><li>Performance (Less file I/O)</li>" +
            "<li>Accuracy (Improved dynamic range; no image data truncation)</li>" +
            "<li>Individual weights for each color channel.</li></p>";
    bestPerformanceButton.onClick = function () {
        if (data.isNSGXnmlInstalled){
            self.nsgXnmlToggle.checked = true;
            self.nsgXnmlToggle.onCheck(true);
        } else {
            self.displayGradientToggle.checked = false;
            self.displayGradientToggle.onCheck(false);
            let msg = "For the best performance and accuracy, Please purchase NSGXnml:" +
            "<ul><li>Performance (Less file I/O)</li>" +
            "<li>Accuracy (Improved dynamic range; no image data truncation. " +
            "Individual weights for each color channel.)";
            (new MessageBox(msg, TITLE, StdIcon_Warning, StdButton_Ok)).execute();
        }
    };
    
    let postFixSizer = new HorizontalSizer(this);
    postFixSizer.spacing = 4;
    postFixSizer.add(postfix_Label);
    postFixSizer.add(this.postFixTextBox);
    postFixSizer.addSpacing(20);
    postFixSizer.add(this.nsgXnmlToggle);
    postFixSizer.addSpacing(20);
    postFixSizer.add(this.writeNormalizedToggle);
    postFixSizer.addSpacing(20);
    postFixSizer.add(this.displayGradientToggle);
    postFixSizer.addStretch();
    postFixSizer.add(bestPerformanceButton);
    
    let weightSizer = new HorizontalSizer(this);
    weightSizer.spacing = 4;
    weightSizer.add(noiseWeight_Label);
    weightSizer.add(this.noiseWeightTextBox);
    weightSizer.addSpacing(20);
    weightSizer.add(this.addDrizzleFilesToggle);
    weightSizer.addSpacing(20);
    weightSizer.add(this.weightPrefixCheckBox);
    weightSizer.addSpacing(20);
    weightSizer.add(this.overwriteCheckBox);
    weightSizer.addSpacing(20);
    weightSizer.add(this.csvFileCheckBox);
    weightSizer.addStretch();
    weightSizer.add(onError_Label);
    weightSizer.add(this.onErrorComboBox);
    
    let outputDirSection = new Control(this);
    outputDirSection.sizer = new VerticalSizer;
    outputDirSection.sizer.spacing = 4;
    outputDirSection.sizer.add(outputDirSizer);
    outputDirSection.sizer.add(postFixSizer);
    outputDirSection.sizer.add(weightSizer);
    let outputDirBar = new SectionBar(this, "Output Files");
    outputDirBar.setSection(outputDirSection);
    outputDirBar.onToggleSection = this.onToggleSection;
    // SectionBar "Reference file" End

    // =======================================
    // SectionBar: "Star Detection"
    // =======================================
    function finalStarDetectionUpdateFunction(){
        if (data.cache.getRefFilename()){
            self.enabled = false;
            processEvents();
            try {
                data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);
            } finally {
                self.enabled = true;
                processEvents();
            }
        }
    }
    let starDetectionControls = new NsgStarDetectionControls();
    this.refLogStarDetection_Control = starDetectionControls.createRefLogStarDetect_Control(this, data, 0);
    addFinalUpdateListener(this.refLogStarDetection_Control, finalStarDetectionUpdateFunction);
    
    let detectedStarsButton = new PushButton(this);
    detectedStarsButton.text = "Detected stars ";
    detectedStarsButton.toolTip =
            "<p>Displays the detected stars and provides star detection controls.</p>";
    detectedStarsButton.onClick = function () {
        try {
            self.enabled = false;
            processEvents();
            let tgtFile = getSelectedTarget(true);
            if (tgtFile){
                let refFile = getReference();
                if (refFile){
                    if (data.cache.setTgtFilename(tgtFile)){
                        let dialog = new DetectedStarsDialog("Detected Stars", data, self);
                        dialog.execute();
                        (new NsgDialogSizes()).store("DetectedStars", dialog.width, dialog.height);
                        finalStarDetectionUpdateFunction();
                    } else {
                        (new MessageBox("Failed to read '" + tgtFile + "'")).execute();
                    }
                }
            }
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
        }
        gc(true);
    };
    let detectedStars_Reset = new ToolButton(this);
    detectedStars_Reset.icon = this.scaledResource(":/icons/reload.png");
    detectedStars_Reset.toolTip = "<p>Reset star detection to default.</p>";
    detectedStars_Reset.onClick = function(){
        data.logStarDetection = DEFAULT_STAR_DETECTION;
        self.refLogStarDetection_Control.setValue(data.logStarDetection);
        finalStarDetectionUpdateFunction();
    };
    
    let starDetectionSection = new Control(this);
    starDetectionSection.sizer = new HorizontalSizer;
    starDetectionSection.sizer.spacing = 5;
    starDetectionSection.sizer.add(this.refLogStarDetection_Control, 100);
    starDetectionSection.sizer.add(detectedStars_Reset, 0);
    starDetectionSection.sizer.add(detectedStarsButton, 0);
    let starDetectionBar = new SectionBar(this, "Star Detection");
    starDetectionBar.setSection(starDetectionSection);
    starDetectionBar.onToggleSection = this.onToggleSection;
    starDetectionBar.toolTip = "<p>Star detection sensitivity.</p>";
    // SectionBar "Star Detection" End
    
    let photometrySearchSection;
    let photometrySearchBar;

    // =======================================
    // SectionBar: "Photometric Star Search"
    // =======================================
    let labelPSSWidth = Math.max(
            this.font.width("Star flux tolerance:"), 
            this.font.width("Star search radius:"));
    this.starFluxTolerance_Control = new NumericControl(this);
    this.starFluxTolerance_Control.real = true;
    this.starFluxTolerance_Control.label.text = "Star flux tolerance:";
    this.starFluxTolerance_Control.toolTip =
            "<p>Star flux tolerance is used to prevent invalid target to reference " +
            "star matches. Smaller values reject more matches.</p>" +
            "<p>Star matches are rejected if the difference in star flux " +
            "is larger than expected. The algorithm first calculates the average scale difference, " +
            "and then rejects matches if their brightness ratio is greater than " +
            "(expected ratio * tolerance) or smaller than (expected ratio / tolerance)</p>" +
            "<p>1.0 implies the star flux ratio must exactly match the expected ratio.</p>" +
            "<p>2.0 implies that the ratio can be double or half the expected ratio.</p>" +
            "<p>You usually don't need to modify this parameter.</p>";
    this.starFluxTolerance_Control.label.minWidth = labelPSSWidth;
    this.starFluxTolerance_Control.setRange(1.01, 2);
    this.starFluxTolerance_Control.slider.setRange(100, 200);
    this.starFluxTolerance_Control.setPrecision(2);
    this.starFluxTolerance_Control.slider.minWidth = 100;
    this.starFluxTolerance_Control.onValueUpdated = function (value) {
        data.starFluxTolerance = value;
    };
    
    let starFluxTolerance_Reset = new ToolButton(this);
    starFluxTolerance_Reset.icon = this.scaledResource(":/icons/reload.png");
    starFluxTolerance_Reset.toolTip = "<p>Reset star flux tolerance to default.</p>";
    starFluxTolerance_Reset.onClick = function(){
        data.starFluxTolerance = DEFAULT_STAR_FLUX_TOLERANCE;
        self.starFluxTolerance_Control.setValue(data.starFluxTolerance);
    };
    
    let starFluxToleranceSizer = new HorizontalSizer(this);
    starFluxToleranceSizer.spacing = 5;
    starFluxToleranceSizer.add(this.starFluxTolerance_Control, 100);
    starFluxToleranceSizer.add(starFluxTolerance_Reset, 0);

    this.starSearchRadius_Control = new NumericControl(this);
    this.starSearchRadius_Control.real = true;
    this.starSearchRadius_Control.label.text = "Star search radius:";
    this.starSearchRadius_Control.toolTip =
            "<p>Search radius used to match the reference and target stars. " +
            "Larger values find more photometric stars but at the risk of matching " +
            "the wrong star.</p>" +
            "<p>You only need to modify this parameter if your images contain distortions.</p>";

    this.starSearchRadius_Control.label.minWidth = labelPSSWidth;
    this.starSearchRadius_Control.setRange(0.1, 20);
    this.starSearchRadius_Control.slider.setRange(1, 200);
    this.starSearchRadius_Control.setPrecision(1);
    this.starSearchRadius_Control.slider.minWidth = 100;
    this.starSearchRadius_Control.onValueUpdated = function (value) {
        data.starSearchRadius = value;
    };
    
    let starSearchRadius_Reset = new ToolButton(this);
    starSearchRadius_Reset.icon = this.scaledResource(":/icons/reload.png");
    starSearchRadius_Reset.toolTip = "<p>Reset star search radius to default.</p>";
    starSearchRadius_Reset.onClick = function(){
        data.starSearchRadius = DEFAULT_STAR_SEARCH_RADIUS;
        self.starSearchRadius_Control.setValue(data.starSearchRadius);
    };
    
    let starSearchRadiusSizer = new HorizontalSizer(this);
    starSearchRadiusSizer.spacing = 5;
    starSearchRadiusSizer.add(this.starSearchRadius_Control, 100);
    starSearchRadiusSizer.add(starSearchRadius_Reset, 0);

    photometrySearchSection = new Control(this);
    photometrySearchSection.sizer = new VerticalSizer;
    photometrySearchSection.sizer.spacing = 4;
    photometrySearchSection.sizer.add(starFluxToleranceSizer);
    photometrySearchSection.sizer.add(starSearchRadiusSizer);
    photometrySearchBar = new SectionBar(this, "Photometry Star Search");
    photometrySearchBar.setSection(photometrySearchSection);
    photometrySearchBar.onToggleSection = this.onToggleSection;
    photometrySearchBar.toolTip = "<p>Search criteria used to match reference and target stars.</p>" +
            "<p>The default settings usually work well.</p>";
    // SectionBar: "Photometric Star Search" End
    
    // =======================================
    // SectionBar: "Photometry"
    // =======================================
    let photometryControls = new NsgPhotometryControls();
    this.apertureGrowthRate_Control = photometryControls.createApertureGrowthRateEdit(this, data);
    this.apertureGrowthRate_Control.onValueUpdated = function (value){
        data.apertureGrowthRate = value;
    };
    this.apertureAdd_Control = photometryControls.createApertureAddEdit(this, data);
    this.apertureAdd_Control.onValueUpdated = function (value){
        data.apertureAdd = value;
    };
    this.apertureGap_Control = photometryControls.createApertureGapEdit(this, data);
    this.apertureGap_Control.onValueUpdated = function (value){
        data.apertureGap = value;
    };
    this.apertureBgDelta_Control = photometryControls.createApertureBgDeltaEdit(this, data);
    this.apertureBgDelta_Control.onValueUpdated = function (value){
        data.apertureBgDelta = value;
    };
    let photometryStarsButton = new PushButton(this);
    photometryStarsButton.text = "Photometry stars ";
    photometryStarsButton.toolTip =
            "<p>Displays the photometry stars.</p>" + 
            "<p>Provides all the photometry controls.</p>";
    photometryStarsButton.onClick = function () {
        try {
            self.enabled = false;
            processEvents();
            let tgtFile = getSelectedTarget(true);
            if (tgtFile){
                let refFile = getReference();
                if (refFile){
                    if (data.cache.setTgtFilename(tgtFile)){
                        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                        let dialog = new PhotometryStarsDialog("Photometry Stars", data, self);
                        dialog.execute();
                        (new NsgDialogSizes()).store("PhotometryStars", dialog.width, dialog.height);
                    } else {
                        (new MessageBox("Failed to read '" + tgtFile + "'")).execute();
                    }
                }
            }
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
        }
        gc(true);
    };

    let apertureGroupBox = new GroupBox(this);
    apertureGroupBox.title = "Star aperture size";
    apertureGroupBox.sizer = new HorizontalSizer();
    apertureGroupBox.sizer.margin = 2;
    apertureGroupBox.sizer.spacing = 10;
    apertureGroupBox.sizer.add(this.apertureAdd_Control);
    apertureGroupBox.sizer.add(this.apertureGrowthRate_Control);
    apertureGroupBox.sizer.add(this.apertureGap_Control);
    apertureGroupBox.sizer.add(this.apertureBgDelta_Control);
    apertureGroupBox.sizer.addStretch();
    
    this.linearRangeRef_Control = photometryControls.createLinearRangeRefEdit(this, data);
    this.linearRangeRef_Control.onValueUpdated = function (value){
        data.linearRangeRef = value;
    };
    
    this.outlierRemoval_Control = 
            photometryControls.createOutlierRemovalEdit(this, data);
    this.outlierRemoval_Control.onValueUpdated = function (value){
        data.outlierRemovalPercent = value;
    };
 
    let photometryGraphButton = new PushButton(this);
    photometryGraphButton.text = "Photometry graph";
    photometryGraphButton.toolTip =
            "<p>Displays the photometry graph. " +
            "For each star, the flux measured in the reference image is plotted " +
            "against the flux measured in the target image. " +
            "A best fit line is drawn through these points. " +
            "The gradient provides the brightness scale factor.</p>" +
            "<p>Provides all the photometry controls.</p>";
    photometryGraphButton.onClick = function () {
        try {
            self.enabled = false;
            processEvents();
            let tgtFile = getSelectedTarget(true);
            if (tgtFile){
                let refFile = getReference();
                if (refFile){
                    if (data.cache.setTgtFilename(tgtFile)){
                        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                        displayStarGraph(data, self);
                        gc(true);
                    } else {
                        (new MessageBox("Failed to read '" + tgtFile + "'")).execute();
                    }
                }
            }
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
        }
    };
    
    let roiToolTip = "<p>If the galaxy / nebula does not cover the whole image, " +
            "the photometry stars can be restricted to the object and its neighboring region.</p>" +
            "This will improve the correction accuracy if one or more images are partially affected by clouds. " +
            "It also reduces execution time. Both the gradient and average scale corrections " +
            "will still be applied to the whole image.</p>" +
            "<p>Use the 'Photometry Stars' dialog to add a Region of Interest.</p>";
    if (!data.isNSGXnmlInstalled){
        roiToolTip += "<p>Purchase NSGXnml to enable this option.</p>";
    }

    let regionOfInterestX_Control = new NumericEdit(this);
    regionOfInterestX_Control.real = false;
    regionOfInterestX_Control.label.text = "x:";
    regionOfInterestX_Control.toolTip = "<p>Top left x coordinate</p>" + roiToolTip;
    regionOfInterestX_Control.setRange(0, 99999);
    regionOfInterestX_Control.onValueUpdated = function (value){
        data.photometryROIx = value;
    };
    
    let regionOfInterestY_Control = new NumericEdit(this);
    regionOfInterestY_Control.real = false;
    regionOfInterestY_Control.label.text = "y:";
    regionOfInterestY_Control.toolTip = "<p>Top left y coordinate</p>" + roiToolTip;
    regionOfInterestY_Control.setRange(0, 99999);
    regionOfInterestY_Control.onValueUpdated = function (value){
        data.photometryROIy = value;
    };
    
    let regionOfInterestW_Control = new NumericEdit(this);
    regionOfInterestW_Control.real = false;
    regionOfInterestW_Control.label.text = "Width:";
    regionOfInterestW_Control.toolTip = "<p>Width</p>" + roiToolTip;
    regionOfInterestW_Control.setRange(2, 99999);
    regionOfInterestW_Control.onValueUpdated = function (value){
        data.photometryROIw = value;
    };
    
    let regionOfInterestH_Control = new NumericEdit(this);
    regionOfInterestH_Control.real = false;
    regionOfInterestH_Control.label.text = "Height:";
    regionOfInterestH_Control.toolTip = "<p>Height</p>" + roiToolTip;
    regionOfInterestH_Control.setRange(2, 99999);
    regionOfInterestH_Control.onValueUpdated = function (value){
        data.photometryROIh = value;
    };

    let regionOfInterestGroupBox = new GroupBox(this);
    regionOfInterestGroupBox.titleCheckBox = true;
    regionOfInterestGroupBox.title = "Region of interest";
    regionOfInterestGroupBox.toolTip = roiToolTip;
    regionOfInterestGroupBox.sizer = new HorizontalSizer(regionOfInterestGroupBox);
    regionOfInterestGroupBox.sizer.margin = 2;
    regionOfInterestGroupBox.sizer.spacing = 10;
    regionOfInterestGroupBox.sizer.add(regionOfInterestX_Control);
    regionOfInterestGroupBox.sizer.add(regionOfInterestY_Control);
    regionOfInterestGroupBox.sizer.add(regionOfInterestW_Control);
    regionOfInterestGroupBox.sizer.add(regionOfInterestH_Control);
    regionOfInterestGroupBox.sizer.addStretch();
    regionOfInterestGroupBox.onCheck = function( checked ){
        data.usePhotometryROI = checked;
    };
    regionOfInterestGroupBox.enabled = data.isNSGXnmlInstalled;
    
    this.updatePhotometryRoi = function(data){
        regionOfInterestGroupBox.checked = data.usePhotometryROI;
        regionOfInterestX_Control.setValue(data.photometryROIx);
        regionOfInterestY_Control.setValue(data.photometryROIy);
        regionOfInterestW_Control.setValue(data.photometryROIw);
        regionOfInterestH_Control.setValue(data.photometryROIh);
    };

    let outlierGroupBox = new GroupBox(this);
    outlierGroupBox.title = "Outliers";
    outlierGroupBox.sizer = new HorizontalSizer(outlierGroupBox);
    outlierGroupBox.sizer.margin = 2;
    outlierGroupBox.sizer.spacing = 10;
    outlierGroupBox.sizer.add(this.outlierRemoval_Control);
    outlierGroupBox.sizer.addStretch();
    
    let linearGroupBox = new GroupBox(this);
    linearGroupBox.title = "Linear range";
    linearGroupBox.sizer = new HorizontalSizer(linearGroupBox);
    linearGroupBox.sizer.margin = 2;
    linearGroupBox.sizer.spacing = 10;
    linearGroupBox.sizer.add(this.linearRangeRef_Control);
    linearGroupBox.sizer.addStretch();
    
    let starButtonGroupBox = new GroupBox(this);
    starButtonGroupBox.title = "Edit / Display";
    starButtonGroupBox.sizer = new HorizontalSizer(starButtonGroupBox);
    starButtonGroupBox.sizer.margin = 2;
    starButtonGroupBox.sizer.addSpacing(2);
    starButtonGroupBox.sizer.add(photometryStarsButton);
    starButtonGroupBox.sizer.addSpacing(2);
    
    let graphButtonGroupBox = new GroupBox(this);
    graphButtonGroupBox.title = "Edit / Display";
    graphButtonGroupBox.sizer = new HorizontalSizer(starButtonGroupBox);
    graphButtonGroupBox.sizer.margin = 2;
    graphButtonGroupBox.sizer.addSpacing(2);
    graphButtonGroupBox.sizer.add(photometryGraphButton);
    graphButtonGroupBox.sizer.addSpacing(2);
 
    this.autoPhotometryCheckBox = new CheckBox(this);
    this.autoPhotometryCheckBox.text = "Auto";
    this.autoPhotometryCheckBox.toolTip = 
            "<p>Sets all controls to calculated values.</p>";
    this.autoPhotometryCheckBox.onCheck = function (checked){
        if (checked){
            self.enabled = false;
            processEvents();
            data.cache.setTgtFilename(getSelectedTarget(false));
        }
        data.setPhotometryAutoValues(checked, true);
        self.enabled = true;
        processEvents();
    };

    let photometryAutoGroupBox = new GroupBox(this);
    photometryAutoGroupBox.sizer = new HorizontalSizer();
    photometryAutoGroupBox.sizer.margin = 2;
    photometryAutoGroupBox.sizer.addSpacing(10);
    photometryAutoGroupBox.sizer.add(this.autoPhotometryCheckBox);
    photometryAutoGroupBox.sizer.addSpacing(10);
    
    let apertureHorizSizer = new HorizontalSizer();
    apertureHorizSizer.spacing = 12;
    apertureHorizSizer.add(apertureGroupBox, 100);
    apertureHorizSizer.add(photometryAutoGroupBox);
    apertureHorizSizer.add(starButtonGroupBox);
    
    let filterHorizSizer = new HorizontalSizer();
    filterHorizSizer.spacing = 12;
    filterHorizSizer.add(regionOfInterestGroupBox, 90);
    filterHorizSizer.add(outlierGroupBox, 30);
    filterHorizSizer.add(linearGroupBox, 40);
    filterHorizSizer.add(graphButtonGroupBox);

    let photometrySection = new Control(this);
    photometrySection.sizer = new VerticalSizer();
    photometrySection.sizer.spacing = 4;
    photometrySection.sizer.add(apertureHorizSizer);
    photometrySection.sizer.add(filterHorizSizer);
    let photometryBar = new SectionBar(this, "Photometry");
    photometryBar.setSection(photometrySection);
    photometryBar.onToggleSection = this.onToggleSection;
    photometryBar.toolTip = "<p>Specifies photometry parameters. These are used " +
            " to calculate the brightness scale factor.</p>";
    // SectionBar: "Photometric Scale" End

    // =======================================
    // SectionBar: "Sample Generation"
    // =======================================
    const sampleGenerationStrLen = this.font.width("Multiply star radius:");
    let sampleControls = new NsgSampleControls;

    this.limitSampleStarsPercent_Control = sampleControls.createLimitSampleStarsPercentEdit(this, data);       
    this.limitSampleStarsPercent_Control.onValueUpdated = function (value) {
        data.limitSampleStarsPercent = value;
    };
    
    this.sampleStarGrowthRate_Control = sampleControls.createSampleStarGrowthRateEdit(this, data);    
    this.sampleStarGrowthRate_Control.onValueUpdated = function (value){
        data.sampleStarGrowthRate = value;
    };
    
    // Number of manual rejection circles
    this.updateMRC = function(){
        MRC_TextBox.text = "" + data.manualRejectionCircles.length;
    };
    let mrcToolTip = "<p>Number of manually added rejection circles.</p>" +
            "<p>Use the <b>Manual Sample Rejection</b> controls (<b>Sample Generation</b> dialog), " +
            "to add rejection circles.</p>" +
            "<p>These controls are also available in the <b>Gradient dialog</b></p>";
    let MRC_Label = new Label( this );
    MRC_Label.text = "Circles:";
    MRC_Label.toolTip = mrcToolTip;
    MRC_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
    let MRC_TextBox = new Label( this );
    MRC_TextBox.frameStyle = FrameStyle_Sunken;
    MRC_TextBox.textAlignment = TextAlign_VertCenter;
    MRC_TextBox.toolTip = mrcToolTip;
    
    this.autoSampleGenerationCheckBox = new CheckBox(this);
    this.autoSampleGenerationCheckBox.text = "Auto";
    this.autoSampleGenerationCheckBox.toolTip = 
            "<p>Calculates default values for most of the Sample Generation parameters.</p>" +
            "<p>These are calculated from the headers:" +
            "<ul><li><b>'XPIXSZ'</b> (Pixel size, including binning, in microns)</li>" +
            "<li><b>'FOCALLEN'</b> (Focal length in mm).</li></p>";
    this.autoSampleGenerationCheckBox.onCheck = function (checked){
        if (checked){
            self.enabled = false;
            processEvents();
        }
        data.setSampleGenerationAutoValues(checked, true);
        self.enabled = true;
        processEvents();
    };

    let sampleAutoGroupBox = new GroupBox(this);
    sampleAutoGroupBox.sizer = new HorizontalSizer();
    sampleAutoGroupBox.sizer.margin = 2;
    sampleAutoGroupBox.sizer.addSpacing(10);
    sampleAutoGroupBox.sizer.add(this.autoSampleGenerationCheckBox);
    sampleAutoGroupBox.sizer.addSpacing(10);

    let sampleStarRejectRadiusGroupBox = new GroupBox(this);
    sampleStarRejectRadiusGroupBox.title = "Sample rejection";
    sampleStarRejectRadiusGroupBox.toolTip = "<p>This section determines which " +
            "samples are used to create the relative gradient model that will be " +
            "used to correct the target image.</p>" +
            "<p>The aim is to reject samples that cover any light from bright stars. " +
            "This includes diffraction spikes, filter halos " +
            "and the scattered light around bright stars.</p>";
    sampleStarRejectRadiusGroupBox.sizer = new HorizontalSizer();
    sampleStarRejectRadiusGroupBox.sizer.margin = 2;
    sampleStarRejectRadiusGroupBox.sizer.add(this.limitSampleStarsPercent_Control);
    sampleStarRejectRadiusGroupBox.sizer.addSpacing(10);
    sampleStarRejectRadiusGroupBox.sizer.add(this.sampleStarGrowthRate_Control);
    sampleStarRejectRadiusGroupBox.sizer.addSpacing(10);
    sampleStarRejectRadiusGroupBox.sizer.add(MRC_Label);
    sampleStarRejectRadiusGroupBox.sizer.addSpacing(2);
    sampleStarRejectRadiusGroupBox.sizer.add(MRC_TextBox);
    sampleStarRejectRadiusGroupBox.sizer.addSpacing(2);
    sampleStarRejectRadiusGroupBox.sizer.addStretch();
    
    this.sampleSize_Control = sampleControls.createSampleSizeEdit(this, data);
    this.sampleSize_Control.onValueUpdated = function (value) {
        data.sampleSize = value;
    };

    let sampleSizeGroupBox = new GroupBox(this);
    sampleSizeGroupBox.title = "Samples";
    sampleSizeGroupBox.sizer = new HorizontalSizer();
    sampleSizeGroupBox.sizer.margin = 2;
    sampleSizeGroupBox.sizer.spacing = 0;
    sampleSizeGroupBox.sizer.add(this.sampleSize_Control);
    if (NSG_EXTRA_CONTROLS){
        this.maxSamples_Control = new NumericEdit(this);
        this.maxSamples_Control.real = false;
        this.maxSamples_Control.label.text = "";
        this.maxSamples_Control.toolTip =
            "<p>Limits the number of samples used to create the surface spline. " +
            "If the number of samples exceed this limit, they are combined " +
            "(binned) to create super samples.</p>" +
            "<p>A larger number of samples increases the " +
            "theoretical maximum resolution of the surface spline. However, " +
            "small unbinned samples are noisier and require more smoothing. " +
            "The default value is usually a good compromise.</p>" +
            "<p>The time required to initialize the surface spline approximately " +
            "doubles every 1300 samples.</p>";
        this.maxSamples_Control.setRange(1000, 9000);
        this.maxSamples_Control.setValue(data.maxSamples);
        this.maxSamples_Control.enabled = false;

        let displayBinnedSamplesButton = new PushButton(this);
        displayBinnedSamplesButton.text = "Max samples";
        displayBinnedSamplesButton.toolTip =
                "<p>Displays the binned samples used to construct the surface spline " +
                "that models the relative gradient between the reference and target images.</p>" +
                "<p>Samples are binned to improve performance if the number of " +
                "samples exceed the specified limit.</p>" +
                "<p>The area of each binned sample represents the number of samples " +
                "it was created from.</p>" +
                "<p>Each binned sample's center is calculated from " +
                "the center of mass of the samples it was created from.</p>" +
                "<p>To see which of the unbinned samples were rejected due to stars, " +
                "use 'Sample grid'.</p>";
        displayBinnedSamplesButton.onClick = function () {
            let tgtFile = getSelectedTarget(true);
            if (tgtFile){
                let refFile = getReference();
                if (refFile){
                    if (data.cache.setTgtFilename(tgtFile)){
                        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                        data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);

                        // Scale factors
                        let nChannels = data.cache.isColor() ? 3 : 1;
                        let colorStarPairs = getColorStarPairs(nChannels, data);
                        let scaleFactors = getScaleFactors(colorStarPairs, data);

                        // === Sample pairs ===
                        let sampleGrid = data.cache.getSampleGrid(data, tgtFile);
                        let stars = data.cache.getRefStars(data.logStarDetection);
                        let colorSamplePairs = sampleGrid.createColorScaledSamplePairs(stars, data, scaleFactors);
                        let dialog = new BinnedSampleGridDialog("Binned Samples", colorSamplePairs[0], data, self);
                        dialog.execute();
                        (new NsgDialogSizes()).store("BinnedGrid", dialog.width, dialog.height);
                        dialog = null;
                        gc(true);
                    } else {
                        (new MessageBox("Failed to read '" + tgtFile + "'")).execute();
                    }
                }
            }
        };
        sampleSizeGroupBox.sizer.addSpacing(10);
        sampleSizeGroupBox.sizer.add(displayBinnedSamplesButton);
        sampleSizeGroupBox.sizer.add(this.maxSamples_Control);
    }
    sampleSizeGroupBox.sizer.addStretch();

    let displaySamplesButton = new PushButton(this);
    displaySamplesButton.text = "Sample generation";
    displaySamplesButton.toolTip =
            "<p>Displays the generated samples and the stars used to reject samples.</p>" +
            "<p>Provides edit sliders for all 'Sample Generation' section parameters.</p>" +
            "<p>Samples are rejected if they: " +
            "<ul><li>Contain one or more zero pixels in either image.</li>" +
            "<li>Are too close to a star included in the 'Limit stars %' range.</li></ul>" +
            "The surviving samples are drawn as squares. The stars used to " +
            "reject samples are indicated by circles.</p>" +
            "<p>A surface spline is constructed from the generated samples " +
            "to model the relative gradient between the reference and target images.</p>";
    displaySamplesButton.onClick = function () {
        try {
            self.enabled = false;
            processEvents();
            let tgtFile = getSelectedTarget(true);
            if (tgtFile){
                let refFile = getReference();
                if (refFile){
                    if (data.cache.setTgtFilename(tgtFile)){
                        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                        data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);
                        let dialog = new SampleGridDialog("Sample Generation", data, tgtFile, self);
                        dialog.execute();
                        (new NsgDialogSizes()).store("SampleGrid", dialog.width, dialog.height);
                        dialog = null;
                        self.updateMRC();
                        gc(true);
                    } else {
                        (new MessageBox("Failed to read '" + tgtFile + "'")).execute();
                    }
                }
            }
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
        }
    };
    
    let editDisplayGroupBox = new GroupBox(this);
    editDisplayGroupBox.title = "Edit / Display";
    editDisplayGroupBox.sizer = new HorizontalSizer();
    editDisplayGroupBox.sizer.margin = 2;
    editDisplayGroupBox.sizer.addSpacing(2);
    editDisplayGroupBox.sizer.add(displaySamplesButton);
    editDisplayGroupBox.sizer.addSpacing(2);
    
    let generateSamplesHorizSizer = new HorizontalSizer();
    generateSamplesHorizSizer.spacing = 12;
    generateSamplesHorizSizer.add(sampleSizeGroupBox);
    generateSamplesHorizSizer.add(sampleStarRejectRadiusGroupBox);
    generateSamplesHorizSizer.add(sampleAutoGroupBox);
    generateSamplesHorizSizer.add(editDisplayGroupBox);
    
    let sampleGenerationSection = new Control(this);
    sampleGenerationSection.sizer = new VerticalSizer;
    sampleGenerationSection.sizer.spacing = 4;
    sampleGenerationSection.sizer.add(generateSamplesHorizSizer);
    let sampleGenerationBar = new SectionBar(this, "Sample Generation");
    sampleGenerationBar.setSection(sampleGenerationSection);
    sampleGenerationBar.onToggleSection = this.onToggleSection;
    sampleGenerationBar.toolTip = 
            "<p>This section generates samples used to model " +
            "the relative gradient between the reference and target images.</p>" +
            "<p>The image is divided up into a grid of sample squares. " +
            "A sample's value is the median of the pixels it contains.</p>" +
            "<p>Samples are rejected if they contain one or more zero pixels in " +
            "either image or if they are too close to a bright star.</p>";

    // SectionBar: "Gradient Sample Generation" End
    
    // ===============================================================
    // SectionBar: "Gradient Correction" : Group box
    // ===============================================================
    // Gradient controls
    let gradientControls = new NsgGradientControls();
    this.gradientSmoothness_Control = 
            gradientControls.createGradientSmoothnessControl(this, data, 0);
    this.gradientSmoothness_Control.onValueUpdated = function (value) {
        data.gradientSmoothness = value;
    };
    let gradientSmoothness_Reset = new ToolButton(this);
    gradientSmoothness_Reset.icon = this.scaledResource(":/icons/reload.png");
    gradientSmoothness_Reset.toolTip = "<p>Reset gradient smoothness to default.</p>";
    gradientSmoothness_Reset.onClick = function(){
        data.gradientSmoothness = DEFAULT_GRADIENT_SMOOTHNESS;
        self.gradientSmoothness_Control.setValue(data.gradientSmoothness);
    };
    
    let gradientGraphButton = new PushButton(this);
    gradientGraphButton.text = "Gradient dialog";
    gradientGraphButton.toolTip =
        "<p>Edit the 'Smoothness' parameter and view the gradient.</p>" +
        "<p>The vertical axis represents the difference between the two images, " +
        "the horizontal axis the distance across the image.</p>";
    gradientGraphButton.onClick = function () {
        try {
            self.enabled = false;
            processEvents();
            let tgtFile = getSelectedTarget(true);
            if (tgtFile){
                let refFile = getReference();
                if (refFile){
                    if (data.cache.setTgtFilename(tgtFile)){
                        data.setPhotometryAutoValues(data.useAutoPhotometry, true);
                        data.setSampleGenerationAutoValues(data.useAutoSampleGeneration, true);

                        let nChannels = data.cache.isColor() ? 3 : 1;

                        // Scale factors
                        let colorStarPairs = getColorStarPairs(nChannels, data);
                        let scaleFactors = getScaleFactors(colorStarPairs, data);

                        // === Sample pairs ===
                        let sampleGrid = data.cache.getSampleGrid(data, tgtFile);
                        let stars = data.cache.getRefStars(data.logStarDetection);
                        let colorSamplePairs = sampleGrid.createColorScaledSamplePairs(stars, data, scaleFactors);

                        for (let c=0; c<nChannels; c++){
                            if (colorSamplePairs[c].length < 3) {
                                new MessageBox("ERROR: Too few samples to create a Surface Spline.", TITLE, StdIcon_Error, StdButton_Ok).execute();
                                return;
                            }
                        }

                        // === Gradient dialog ===
                        GradientGraph(colorSamplePairs, self, data, scaleFactors);
                        self.updateMRC();
                    } else {
                        (new MessageBox("Failed to read '" + tgtFile + "'")).execute();
                    }
                }
                gc(true);
            }
        } catch (error){
            logError(error);
        } finally {
            self.enabled = true;
        }
        processEvents();
    };
    
    let gradientSection = new Control(this);
    gradientSection.sizer = new HorizontalSizer(this);
    gradientSection.sizer.margin = 2;
    gradientSection.sizer.spacing = 5;
    gradientSection.sizer.add(this.gradientSmoothness_Control, 100);
    gradientSection.sizer.add(gradientSmoothness_Reset);
    gradientSection.sizer.add(gradientGraphButton);
    let gradientBar = new SectionBar(this, "Gradient Correction");
    gradientBar.setSection(gradientSection);
    gradientBar.onToggleSection = this.onToggleSection;
    
    //------------------------------------------
    // Image Rejection
    //------------------------------------------
    let rejectionControls = new NsgRejectionControls();
    this.minimumWeight_Control = rejectionControls.createMinimumWeightEdit(this, data);
    this.minimumWeight_Control.onValueUpdated = function (value) {
        data.minimumWeight = value;
    };
    let minimumWeight_Reset = new ToolButton(this);
    minimumWeight_Reset.icon = this.scaledResource(":/icons/reload.png");
    minimumWeight_Reset.toolTip = "<p>Reset minimum weight to default.</p>";
    minimumWeight_Reset.onClick = function(){
        data.minimumWeight = DEFAULT_MIN_WEIGHT;
        self.minimumWeight_Control.setValue(data.minimumWeight);
    };
    this.minimumScale_Control = rejectionControls.createMinimumScaleEdit(this, data);
    this.minimumScale_Control.onValueUpdated = function (value) {
        data.minimumScale = value;
    };
    let minimumScale_Reset = new ToolButton(this);
    minimumScale_Reset.icon = this.scaledResource(":/icons/reload.png");
    minimumScale_Reset.toolTip = "<p>Reset minimum transmission to default.</p>";
    minimumScale_Reset.onClick = function(){
        data.minimumScale = DEFAULT_MIN_SCALE;
        self.minimumScale_Control.setValue(data.minimumScale);
    };
    
    let rejectionGraphButton = new PushButton(this);
    rejectionGraphButton.text = "Transmission, Weight";
    rejectionGraphButton.onClick = function () {
        if (nsgTgtResults.size > 0){
            try {
                self.enabled = false;
                processEvents();
                displaySelectionGraph(data, self);
            } catch (error){
                logError(error);
            } finally {
                self.enabled = true;
            }
        } else {
            (new MessageBox("No results to display")).execute();
        }
    };
    rejectionGraphButton.toolTip = "<p><b>Transmission graph:</b> " +
        "Plots (Transmission)/(Maximum transmission) for date ordered images.</p>" +
        "<p><b>Weight graph:</b> " +
        "Plots (Weight/time)/(Maximum weight/time). The weights are divided by " +
        "exposure time so that, for example, points plotted for a 5 minute and 10 minute exposure " +
        "taken in identical conditions will be displayed with the same value.</p>" +
        "<ul><li><b>Green X:</b> Reference image.</li>" +
        "<li><b>Blue X:</b> Rejected due to transmission.</li>" +
        "<li><b>Red X:</b> Rejected due to weight.</li></ul>" +
        "<p>If the reference image is not included in the target list, it is displayed as image zero.</p>" +
        "<p>Left click on a point to display the filename in the title bar.</p>";
    
    let moveRejectedImagesButton = new PushButton(this);
    moveRejectedImagesButton.text = "Move to ./NSG_Reject";
    moveRejectedImagesButton.toolTip = "<p>Move rejected images to a subfolder <b>NSG_Reject</b> " +
            "The following images are moved:</p>" +
            "<p><ul><li>Local Normalization '.xnml' files</li>" +
            "<li>Drizzle '.xdrz' files ('Drizzle data' selected)</li>" +
            "<li>Normalized images ('Normalized images' selected)</li></p>" + 
            "<p>The reference image is never moved because other images will depend on it.</p>";
    moveRejectedImagesButton.onClick = function () {
        let imageRejectionData = new ImageRejectionData(data);
        let rejectedImageSet = imageRejectionData.moveRejectedTargets(data, "NSG_Reject");
        for (let deleteResult of rejectedImageSet.values()){
            nsgTgtResults.delete(deleteResult);
        }
        let newTargetFiles = [];
        for (let tgtFile of data.targetFiles){
            if (!rejectedImageSet.has(tgtFile)){
                newTargetFiles.push(tgtFile);
            }
        }
        data.targetFiles = newTargetFiles;
        self.enabled = false;
        processEvents();
        updateTargetImagesList();
        self.enabled = true;
        processEvents();
    };
    
    if (!data.isNSGXnmlInstalled){
        rejectionGraphButton.toolTip += "<p>Purchase NSGXnml to enable this option.</p>";
        moveRejectedImagesButton.toolTip += "<p>Purchase NSGXnml to enable this option.</p>";
    }
    
    let minWeightGroupBox = new GroupBox(this);
    minWeightGroupBox.title = "Light pollution";
    minWeightGroupBox.sizer = new HorizontalSizer();
    minWeightGroupBox.sizer.margin = 2;
    minWeightGroupBox.sizer.spacing = 5;
    minWeightGroupBox.sizer.add(this.minimumWeight_Control);
    minWeightGroupBox.sizer.add(minimumWeight_Reset);
    minWeightGroupBox.sizer.addStretch();
    
    let minSignalGroupBox = new GroupBox(this);
    minSignalGroupBox.title = "Clouds";
    minSignalGroupBox.sizer = new HorizontalSizer();
    minSignalGroupBox.sizer.margin = 2;
    minSignalGroupBox.sizer.spacing = 5;
    minSignalGroupBox.sizer.add(this.minimumScale_Control);
    minSignalGroupBox.sizer.add(minimumScale_Reset);
    minSignalGroupBox.sizer.addStretch();
    
    let subFolderGroupBox = new GroupBox(this);
    subFolderGroupBox.title = "Rejected images";
    subFolderGroupBox.sizer = new HorizontalSizer();
    subFolderGroupBox.sizer.margin = 2;
    subFolderGroupBox.sizer.add(moveRejectedImagesButton);
    subFolderGroupBox.sizer.addStretch();
    
    let graphGroupBox = new GroupBox(this);
    graphGroupBox.title = "Graphs";
    graphGroupBox.sizer = new HorizontalSizer();
    graphGroupBox.sizer.margin = 2;
    graphGroupBox.sizer.addSpacing(5);
    graphGroupBox.sizer.add(rejectionGraphButton);
    graphGroupBox.sizer.addSpacing(2);
    
    let imageRejectionBarTitle = data.isNSGXnmlInstalled ? "Image Rejection (available after Run)" : "Image Rejection (Purchase NSGXnml)";
    this.imageRejectionSection = new Control(this);
    this.imageRejectionSection.sizer = new HorizontalSizer(this);
    this.imageRejectionSection.sizer.margin = 2;
    this.imageRejectionSection.sizer.spacing = 10;
    this.imageRejectionSection.sizer.add(minSignalGroupBox, 60);
    this.imageRejectionSection.sizer.add(minWeightGroupBox, 60);
    this.imageRejectionSection.sizer.add(subFolderGroupBox, 100);
    this.imageRejectionSection.sizer.add(graphGroupBox);
    this.imageRejectionBar = new SectionBar(this, imageRejectionBarTitle);
    this.imageRejectionBar.enableCheckBox();
    this.imageRejectionBar.checkBox.onCheck = function (checked) {
        data.useImageRejection = checked;
        self.enableImageRejection(nsgTgtResults.size > 0);
    };
    this.imageRejectionBar.setSection(this.imageRejectionSection);
    this.imageRejectionBar.onToggleSection = this.onToggleSection;
    this.imageRejectionBar.toolTip = 
            "<p>Reject images due to reduced transmission (clouds) " +
            "or low signal to noise ratio (light pollution).</p>";
    
    /**
     * @param {Boolean} enable If false, disable graph and reject buttons. If true,
     * and this section is enabled, enable graph and reject buttons.
     */
    this.enableImageRejection = function (enable){
        if (enable){
            if (data.useImageRejection){
                rejectionGraphButton.enabled = true;
                moveRejectedImagesButton.enabled = true;
            }
        } else {
            rejectionGraphButton.enabled = false;
            moveRejectedImagesButton.enabled = false;
        }
    };
    
    //------------------------------------------
    // ImageIntegration
    //------------------------------------------
    let autoRunToolTip1 = "<p>If NSG is run without its user interface (Apply mode or ProcessContainer), run ";
    let autoRunToolTip2 = " after NSG completes.</p>" +
        "<p>To run multiple NSG process icons within a ProcessContainer, ensure that at least one image " +
        "is open on the PixInsight desktop. NSG will ignore this image, but " +
        "ProcessContainer requires that it exists.</p>";
    this.runImageIntegrationCheckBox = new CheckBox( this );
    this.runImageIntegrationCheckBox.text = "Run if in ProcessContainer";
    this.runImageIntegrationCheckBox.toolTip = autoRunToolTip1 + "ImageIntegration" + autoRunToolTip2;
    this.runImageIntegrationCheckBox.onCheck = function( checked ){
        data.runImageIntegration = checked;
        if (!data.runImageIntegration){
            data.runDrizzleIntegration = false;
            self.runDrizzleIntegrationCheckBox.checked = false;
        }
        enableDrizzle();
    };
    
    this.sortByWeightCheckBox = new CheckBox( this );
    this.sortByWeightCheckBox.text = "Sort by weight";
    this.sortByWeightCheckBox.toolTip =
        "<p>Determines the ImageIntegration input file order.</p>" +
        "<p>The first file is always the reference file. " +
        "All other files are sorted by either weight or observation date.</p>";
    if (!data.isNSGXnmlInstalled){
        this.sortByWeightCheckBox.toolTip += "<p>Purchase NSGXnml to enable this option.</p>";
    }
    this.sortByWeightCheckBox.onClick = function( checked ){
        data.sortByWeight = checked;
    };
    this.sortByWeightCheckBox.enabled = data.isNSGXnmlInstalled;
    
    let templateIconIdToolTip =
            "<p>If set to <b>&lt;Auto Rejection Algorithm&gt;</b> " +
            "NSG ImageIntegration settings will be initialized with default values. " +
            "The settings needed by NSG are then replaced.</p>" +
            "<p>Otherwise, the NSG ImageIntegration settings will be " +
            "initialized from the specified template (An ImageIntegration process icon). " +
            "Only the settings needed by NSG are replaced.</p>" +
            "<p>ImageIntegration will be launched after NSG exits.</p>";
    let templateIconIdLabel = new Label( this );
    templateIconIdLabel.text = "Template icon:";
    templateIconIdLabel.toolTip = templateIconIdToolTip;
    templateIconIdLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    let noTemplateStr = "<Auto Rejection Algorithm>";
    this.templateIconIdComboBox = new ComboBox( this );
    this.templateIconIdComboBox.toolTip = templateIconIdToolTip;
    this.templateIconIdComboBox.addItem( noTemplateStr );
    let icons = ProcessInstance.iconsByProcessId( "ImageIntegration" );
    for ( let i = 0; i < icons.length; ++i ){
        this.templateIconIdComboBox.addItem( icons[ i ] );
    }
    this.templateIconIdComboBox.onItemSelected = function( item ){
        if ( this.itemText( item ) === noTemplateStr ){
            data.imageIntegrationTemplateId = "";
            self.autoRejectAlgorithm = true;
            self.autoRejectAlgorithmCheckBox.checked = true;
            self.autoRejectAlgorithmCheckBox.enabled = false;
        } else {
            data.imageIntegrationTemplateId = this.itemText( item );
            self.autoRejectAlgorithmCheckBox.enabled = true;
        }
    };
    
    this.autoRejectAlgorithmCheckBox = new CheckBox( this );
    this.autoRejectAlgorithmCheckBox.text = "Auto rejection algorithm";
    this.autoRejectAlgorithmCheckBox.toolTip =
        "<p>When checked, NSG will choose an ImageIntegration rejection algorithm based on the number of images.</p>" +
        "<p>This will override the <b>Template icon</b> settings.</p>";
    this.autoRejectAlgorithmCheckBox.onClick = function( checked ){
        data.autoRejectAlgorithm = checked;
    };
    
    // DrizzleIntegration
    this.runDrizzleIntegrationCheckBox = new CheckBox( this );
    this.runDrizzleIntegrationCheckBox.text = "Run if in ProcessContainer";
    this.runDrizzleIntegrationCheckBox.toolTip = autoRunToolTip1 + "DrizzleIntegration" + autoRunToolTip2;
    this.runDrizzleIntegrationCheckBox.onCheck = function( checked ){
        data.runDrizzleIntegration = checked;
    };
    
    let drizzleTemplateIconIdToolTip =
            "<p>If set to <b>&lt;Default Settings&gt;</b> " +
            "DrizzleIntegration will be initialized with default values.</p>" +
            "<p>Otherwise, the DrizzleIntegration settings will be " +
            "initialized from the specified template (A DrizzleIntegration process icon).</p>" +
            "<p>DrizzleIntegration will be launched after NSG exits.</p>";
    let drizzleTemplateIconIdLabel = new Label( this );
    drizzleTemplateIconIdLabel.text = "Template icon:";
    drizzleTemplateIconIdLabel.toolTip = templateIconIdToolTip;
    drizzleTemplateIconIdLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    let drizzleNoTemplateStr = "<Default Settings>";
    this.drizzleTemplateIconIdComboBox = new ComboBox( this );
    this.drizzleTemplateIconIdComboBox.toolTip = drizzleTemplateIconIdToolTip;
    this.drizzleTemplateIconIdComboBox.addItem( drizzleNoTemplateStr );
    let drizzleIcons = ProcessInstance.iconsByProcessId( "DrizzleIntegration" );
    for ( let i = 0; i < drizzleIcons.length; ++i ){
        this.drizzleTemplateIconIdComboBox.addItem( drizzleIcons[ i ] );
    }
    this.drizzleTemplateIconIdComboBox.onItemSelected = function( item ){
        if ( this.itemText( item ) === drizzleNoTemplateStr ){
            data.drizzleIntegrationTemplateId = "";
        } else {
            data.drizzleIntegrationTemplateId = this.itemText( item );
        }
    };
    
    let drizzleIntegrationGroupBox = new GroupBox(this);
    drizzleIntegrationGroupBox.title = "DrizzleIntegration";
    drizzleIntegrationGroupBox.sizer = new HorizontalSizer();
    drizzleIntegrationGroupBox.sizer.margin = 2;
    drizzleIntegrationGroupBox.sizer.spacing = 4;
    drizzleIntegrationGroupBox.sizer.addSpacing(5);
    drizzleIntegrationGroupBox.sizer.add( this.runDrizzleIntegrationCheckBox );
    drizzleIntegrationGroupBox.sizer.addSpacing(20);
    drizzleIntegrationGroupBox.sizer.add( drizzleTemplateIconIdLabel );
    drizzleIntegrationGroupBox.sizer.add( this.drizzleTemplateIconIdComboBox);
    drizzleIntegrationGroupBox.sizer.addStretch();
    
    let imageIntegrationGroupBox = new GroupBox(this);
    imageIntegrationGroupBox.title = "ImageIntegration";
    imageIntegrationGroupBox.sizer = new HorizontalSizer();
    imageIntegrationGroupBox.sizer.margin = 2;
    imageIntegrationGroupBox.sizer.spacing = 4;
    imageIntegrationGroupBox.sizer.addSpacing(5);
    imageIntegrationGroupBox.sizer.add( this.runImageIntegrationCheckBox );
    imageIntegrationGroupBox.sizer.addSpacing(20);
    imageIntegrationGroupBox.sizer.add( templateIconIdLabel );
    imageIntegrationGroupBox.sizer.add( this.templateIconIdComboBox);
    imageIntegrationGroupBox.sizer.addSpacing(10);
    imageIntegrationGroupBox.sizer.add( this.autoRejectAlgorithmCheckBox );
    imageIntegrationGroupBox.sizer.addStretch();
    imageIntegrationGroupBox.sizer.add( this.sortByWeightCheckBox );
    imageIntegrationGroupBox.sizer.addSpacing(2);
    
    this.imageIntegrationSection = new Control(this);
    this.imageIntegrationSection.sizer = new VerticalSizer(this);
    this.imageIntegrationSection.sizer.margin = 2;
    this.imageIntegrationSection.sizer.spacing = 4;
    this.imageIntegrationSection.sizer.add(imageIntegrationGroupBox);
    this.imageIntegrationSection.sizer.add(drizzleIntegrationGroupBox);
    this.imageIntegrationBar = new SectionBar(this, "Display ImageIntegration/DrizzleIntegration after Exit");
    this.imageIntegrationBar.enableCheckBox();
    this.imageIntegrationBar.checkBox.onCheck = function (checked) {
        data.useImageIntegration = checked;
    };
    this.imageIntegrationBar.setSection(this.imageIntegrationSection);
    this.imageIntegrationBar.onToggleSection = this.onToggleSection;
    this.imageIntegrationBar.toolTip = 
            "<p>If images have been normalized, the ImageIntegration process is displayed on exit.</p>" +
            "<p>ImageIntegration will be initialized with the normalized images " +
            "(or the uncorrected images with their corresponding '.xnml' data files), and with " +
            "the correct settings for normalized images. All other settings must be set by the user.</p>" +
            "<p>ImageIntegration is populated with all the normalized images, " +
            "but if an image's weight is too low, the image entry is disabled. " +
            "This can be used to reject images taken through thin clouds or from a bright sky.</p>";
    
    //------------------------------------------
    // Button bar
    //------------------------------------------
    let newInstance_Button = new ToolButton(this);
    newInstance_Button.icon = this.scaledResource(":/process-interface/new-instance.png");
    newInstance_Button.setScaledFixedSize(24, 24);
    newInstance_Button.toolTip = "Drag & Drop to desktop to create a Process Icon";
    newInstance_Button.onMousePress = function () {
        try {
            this.hasFocus = true;
            if (data.cache.getRefFilename() && data.targetFiles.length > 0){
                // Specify the resultsFileBg. 
                // This is needed if we run as Parameters.isViewTarget (run in background)
                let resultsFilename = getNsgDataDir(data, data.cache.getRefFilename());
                resultsFilename += "NSG_ResultsViewTarget_" + getDateString() + ".nsg";
                data.resultsFileBg = resultsFilename;
            }
            data.saveParameters();
            this.pushed = false;
            self.newInstance();
            data.resultsFileBg = undefined;
        } catch (e){
            logError(e);
        }
    };
    
    let browseDocumentationButton = new PushButton(this);
    browseDocumentationButton.icon = this.scaledResource(":/process-explorer/browse-documentation.png");
    browseDocumentationButton.text = "Help";
    browseDocumentationButton.toolTip =
            "<p>Opens a browser to view the script's documentation.</p>";
    browseDocumentationButton.onClick = function () {
            Dialog.browseScriptDocumentation("NormalizeScaleGradient");
            return;
    };
    
    let resetButton = new PushButton(this);
    resetButton.icon = this.scaledResource(":/icons/reload.png");
    resetButton.text = "Reset";
    resetButton.toolTip =
            "<p>Resets the dialog's parameters.</p>" +
            "<p>Saved settings are also cleared.</p>";
    resetButton.onClick = function () {
        clearNsgResults(self, data);
        recoverMemory(data);
        data.setParameters();
        data.resetSettings();
        setDialogValues();
    };
    
    // If false, only process the targets that are not up to date.
    this.runAll = true;
    
    let continueRun_Button = new PushButton(this);
    continueRun_Button.defaultButton = false;
    continueRun_Button.text = "Continue run";
    continueRun_Button.toolTip = "<p>Continue the last run. Normalize the unprocessed target images " +
            "(The <b>Target Images</b> table displays gray circles for unprocessed images).</p>" +
            "<p>Use this option after an Abort, File I/O error, PixInsight crash, " +
            "or after adding an extra set of images.</p>";
    continueRun_Button.icon = this.scaledResource( ":/icons/power.png" );
    continueRun_Button.onClick = function () {
        self.runAll = false;
        self.ok();
    };
    continueRun_Button.enabled = false;
    
    /**
     * @param {Boolean} enable
     */
    this.enableRunButton = function(enable){
        continueRun_Button.enabled = enable;
    };
    
    let applyInstance_Button = new ToolButton(this);
    applyInstance_Button.icon = this.scaledResource(":/process-interface/apply.png");
    applyInstance_Button.setScaledFixedSize(24, 24);
    applyInstance_Button.toolTip = "<p>Apply. Run NSG and exit on completion.<p>" +
            "<p>In Apply mode, NSG behaves as if it ran from a ProcessContainer; " +
            "ImageIntegration and DrizzleIntegration are run after NSG exits.</p>";
    applyInstance_Button.onMousePress = function () {
        // Run NSG without the dialog, as if it were being run from a ProcessContainer
        if (!data.isNSGXnmlInstalled){
            let msg = "To run NSG in Apply mode, please purchase NSGXnml. Thank you.";
            new MessageBox(msg, TITLE, StdIcon_Warning, StdButton_Ok).execute();
            return;
        }
        isApplyMode = true;
        self.cancel();
    };
    
    let ok_Button = new PushButton(this);
    ok_Button.defaultButton = false;
    ok_Button.text = "Run all";
    ok_Button.toolTip = "<p>Normalize all the target images to the reference.</p>";
    ok_Button.icon = this.scaledResource( ":/icons/power.png" );
    ok_Button.onClick = function () {
        self.runAll = true;
        self.ok();
    };
    
    let cancel_Button = new PushButton(this);
    cancel_Button.text = "Exit";
    cancel_Button.toolTip = "<p>Exit NSG.</p>" +
        "<p>If <b>Image Rejection (available after Run)</b> is selected, " +
        "display ImageIntegration after exiting NSG. " +
        "ImageIntegration will be populated with all the target images that have been processed " +
        "(Processed images are indicated in the Target Images table with a green sphere, " +
        "or a yellow sphere if it completed with warnings).</p>";
    cancel_Button.icon = this.scaledResource( ":/icons/close.png" );
    cancel_Button.onClick = function () {
        self.cancel();
    };

    this.smallScreenToggle = new CheckBox(this);
    this.smallScreenToggle.text = "Small screen";
    this.smallScreenToggle.toolTip = "<p>When selected or deselected, " +
            "reset all dialogs to have a maximum height of either 768 or 1080 pixels.</p>" +
            "<p>If dialogs that display images are resized by the user, " +
            "the new size will be remembered until this checkbox is modified.</p>";
    this.smallScreenToggle.onCheck = function (checked) {
        data.smallScreen = checked;
        (new NsgDialogSizes()).reset();
    };
    this.smallScreenToggle.checked = data.smallScreen;
    
    let buttons_Sizer = new HorizontalSizer(this);
    buttons_Sizer.spacing = 6;
    buttons_Sizer.add(newInstance_Button);
    buttons_Sizer.add(applyInstance_Button);
    buttons_Sizer.addSpacing(10);
    buttons_Sizer.add(browseDocumentationButton);
    buttons_Sizer.add(resetButton);
    buttons_Sizer.addSpacing(10);
    buttons_Sizer.add(this.smallScreenToggle);
//    buttons_Sizer.addSpacing(10);
//    buttons_Sizer.add(this.runImageIntegrationToggle);
    buttons_Sizer.addStretch();
    buttons_Sizer.add(continueRun_Button);
    buttons_Sizer.add(ok_Button);
    buttons_Sizer.add(cancel_Button);
    
    //---------------------------------------------------------------
    // Vertically stack all the SectionBars and OK/Cancel button bar
    //---------------------------------------------------------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(titleBar);
    this.sizer.add(titleSection);
    this.sizer.add(filesBar);
    this.sizer.add(filesSection);
    this.sizer.add(blinkRejectionBar);
    this.sizer.add(blinkRejectionSection);
    this.sizer.add(refBar);
    this.sizer.add(refSection);
    this.sizer.add(outputDirBar);
    this.sizer.add(outputDirSection);
    this.sizer.add(starDetectionBar);
    this.sizer.add(starDetectionSection);
    this.sizer.add(photometrySearchBar);
    this.sizer.add(photometrySearchSection);
    this.sizer.add(photometryBar);
    this.sizer.add(photometrySection);
    this.sizer.add(sampleGenerationBar);
    this.sizer.add(sampleGenerationSection);
    this.sizer.add(gradientBar);
    this.sizer.add(gradientSection);
    this.sizer.add(this.imageRejectionBar);
    this.sizer.add(this.imageRejectionSection);
    this.sizer.add(this.imageIntegrationBar);
    this.sizer.add(this.imageIntegrationSection);
    this.sizer.addSpacing(5);
    this.sizer.add(buttons_Sizer);
    
    starDetectionSection.hide();
    photometrySearchSection.hide();
    if (data.isNSGXnmlInstalled){
        titleSection.hide();
    }
    if (data.useAutoPhotometry && !data.usePhotometryROI)
        photometrySection.hide();
    if (data.useAutoSampleGeneration && data.manualRejectionCircles.length === 0)
        sampleGenerationSection.hide();

    if (!data.imageIntegrationTemplateId)
        this.imageIntegrationSection.hide();

    //-------------------------------------------------------
    // Set all the window data
    //-------------------------------------------------------
    this.windowTitle = TITLE;
    this.adjustToContents();
    this.setFixedSize();
    let originalFilenameColumnWidth = self.files_TreeBox.columnWidth(COL_FILENAME);
    let originalDateColumnWidth = self.files_TreeBox.columnWidth(COL_DATEOBS);
    setDialogValues();
    setSelectedTarget();
    
    /**
     * @param {Boolean} displayWarning Display warning if a single target file is not selected
     * @return {String} selected target filename
     */
    this.getSelectedTargetFilename = function(displayWarning){
        let nodes = self.files_TreeBox.selectedNodes;
        if (nodes.length !== 1){
            if (displayWarning){
                (new MessageBox("Select a single target file", TITLE, StdIcon_Error, StdButton_Ok)).execute();
            }
            return undefined;
        }
        return nodes[0].text(COL_FULL_FILENAME);
    };
    
    /**
     * Read and cache the target image. Check it is compatible with ref image.
     * Return the full target filename
     * @param {Boolean} displayWarning Display warning if a single target file is not selected
     * @return {String} selected target filename
     */
    function getSelectedTarget(displayWarning){
        let targetFile = self.getSelectedTargetFilename(displayWarning);
        if (!targetFile){
            return undefined;
        }
        data.cache.setTgtFilename(targetFile);
        let tgtImage = data.cache.getTgtImage();
        let refImage = data.cache.getRefImage();
        if (refImage && tgtImage){
            if (tgtImage.isColor !== refImage.isColor){
                (new MessageBox("ERROR: Color depth must match the reference image.\n" + targetFile,
                        TITLE, StdIcon_Error, StdButton_Ok)).execute();
                return undefined;
            }
            if (tgtImage.width !== refImage.width || tgtImage.height !== refImage.height) {
                (new MessageBox("ERROR: Image dimensions must match the reference image.\n" + targetFile,
                        TITLE, StdIcon_Error, StdButton_Ok)).execute();
                return undefined;
            }
        }
        return targetFile;
    }
    
    function setSelectedTarget(){
        if (data.savedSelectedTarget){
            for ( let i = 0; i < self.files_TreeBox.numberOfChildren; ++i ){
                let node = self.files_TreeBox.child( i );
                if (node.text(COL_FULL_FILENAME) === data.savedSelectedTarget){
                    node.selected = true;
                }
            }
        }
    }
    
    function getReference(){
        let filename = data.cache.getRefFilename();
        if (filename){
            return filename;
        }
        (new MessageBox("Specify the reference file", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return undefined;
    }
    
    /**
     * Clear cached ref, tgt, Results. Update target text color, ref text box.
     * @param {NsgData} data
     */
    function clearReference(data){
        data.cache.setTgtFilename(undefined);
        data.cache.setRefFilename(undefined);
        clearNsgResults(self, data);
        self.refTextBox.text = "";  
        self.updateTargetTextColor(data);
    }
    
    /**
     * Clear tgt files, cached tgt, update target image count.
     * Reset data that is image dependant, and updates UI.
     * @param {NsgData} data
     */
    function clearAllTargets(data){
        data.cache.setTgtFilename(undefined);
        self.files_TreeBox.clear();
        data.targetFiles.length = 0;
        adjustFilenameColumnWidth();
        self.updateTargetImageCount(0);
        enableBlink();  // This disables blink if less than 2 images
        // Reset UI that is sensitive to image data
        data.usePhotometryROI = false;
        regionOfInterestGroupBox.checked = false;
        data.manualRejectionCircles = [];
        self.updateMRC();
        data.gradientLineX = 0;
        data.gradientLineY = 0;
        data.isGradientLineHorizontal = true;
    }
    
    /**
     * @param {TargetTableEntries[]} tgtTableEntriesArray
     * @returns {Number} maximum noise NOISExx value
     */
    function getMaxDisplayNoise(tgtTableEntriesArray){
        let maxValue = -1;
        for (let entries of tgtTableEntriesArray){
            let noise = entries.getDisplayNoise();
            if (noise){
                maxValue = Math.max(maxValue, noise);
            }
        }
        return maxValue > 0 ? maxValue : 1.0;
    }
    
    /**
     * 
     * @param {TargetTableEntries} hdr
     * @param {Number} maxNoise
     * @throws {Error} If FITS header cannot be read
     */
    function addTargetFileNode(hdr, maxNoise){
        // File read exception was not thrown, so OK to create the node
        let node = new TreeBoxNode( self.files_TreeBox );
        let noise = hdr.getDisplayNoise();
        if (noise){
            let noiseType = hdr.getNoiseType();
            let type = noiseType ? noiseType : "";
            node.setText( COL_NOISE, (noise/maxNoise).toPrecision(3) + " " + type);
        }
        let altitude = hdr.getAlt();
        if (altitude){
            let altString = altitude > 9.9995 ? altitude.toPrecision(4) : '0' + altitude.toPrecision(4);
            node.setText( COL_ALT, altString );
        }
        let airmass = hdr.getAirmass();
        if (airmass){
            node.setText( COL_AIRMASS, airmass.toPrecision(5) );
        }
        let exposure = hdr.getExposure();
        if (exposure){
            node.setText( COL_EXPOSURE, exposure.toPrecision(5) );
        }
        let dateObs = hdr.getDateObs();
        if (dateObs){
            node.setText( COL_DATEOBS, dateObs);
        }
        node.setText( COL_FILTER, hdr.getFilter() );
        
        let filename = hdr.getFilename();
        self.setNodeProcessedCol(node, data, filename);
        node.setToolTip( COL_PROCESSED, "Gray circle: unprocessed target.\n" +
                "Green circle: processed target.\n" +
                "Yellow circle: processed but with warnings.");
        node.setText( COL_FULL_FILENAME, filename);
        let fileOrPath = data.useFullPath ? filename : File.extractName(filename);
        node.setText( COL_FILENAME, fileOrPath );
        node.setToolTip( COL_FILENAME, filename); 
        let noiseTip = "<p>Normalized noise estimate (0.0 to 1.0)</p>" +
                "<p>Set reference to an image with low noise.</p>" +
                "<p>If both MRS and K-Sigma noise estimates are present, " +
                "all noise based weight algorithms will be less accurate because " +
                "MRS and K-Sigma are not compatible. " +
                "Try increasing your exposure time.</p>";
        node.setToolTip( COL_NOISE, noiseTip);
        node.setToolTip( COL_AIRMASS, "Set reference to an image with a low airmass.");
        node.setToolTip( COL_ALT, "Set reference to an image with a high altitude.");
        node.setToolTip( COL_FILTER, "All filters should be of the same type.");
        node.setToolTip( COL_EXPOSURE, "Exposure time in seconds.");
        node.setToolTip( COL_DATEOBS, "Observation date 'yyyy-mm-ddTHH:MM:SS[.sss]'");
    }
    
    /**
     * Adjust the filename column width to fit the filename.
     */
    function adjustFilenameColumnWidth(){
        self.files_TreeBox.setColumnWidth( COL_PROCESSED, 0);   // Set to minimum width
        self.files_TreeBox.adjustColumnWidthToContents( COL_DATEOBS );
        self.files_TreeBox.adjustColumnWidthToContents( COL_NOISE );
        self.files_TreeBox.adjustColumnWidthToContents( COL_ALT );
        self.files_TreeBox.adjustColumnWidthToContents( COL_AIRMASS );
        self.files_TreeBox.adjustColumnWidthToContents( COL_EXPOSURE );
        self.files_TreeBox.adjustColumnWidthToContents( COL_FILTER );
        self.files_TreeBox.setColumnWidth( COL_FULL_FILENAME, 0);
        self.files_TreeBox.adjustColumnWidthToContents( COL_FILENAME );
        let colWidth = self.files_TreeBox.columnWidth(COL_FILENAME);
        if (colWidth > originalFilenameColumnWidth){
            // Add a 20 pixel margin to ensure there really is enough room. 
            self.files_TreeBox.setColumnWidth( COL_FILENAME, colWidth + 20);
        }
        colWidth = self.files_TreeBox.columnWidth(COL_DATEOBS);
        if (colWidth > originalDateColumnWidth){
            // Add a 20 pixel margin to ensure there really is enough room. 
            self.files_TreeBox.setColumnWidth( COL_DATEOBS, colWidth + 20);
        }
    }
    
    /**
     * If data.addDrizzleFiles is true and NsgXnml is installed, then:
     * (1) Drizzle template combobox is enabled.
     * (2) If data.runImageIntegration is true, runDrizzleIntegrationCheckBox is enabled.
     */
    function enableDrizzle(){
        let isDrizzleEnabled = data.addDrizzleFiles && data.isNSGXnmlInstalled;
        self.runDrizzleIntegrationCheckBox.enabled = data.runImageIntegration && isDrizzleEnabled;
        self.drizzleTemplateIconIdComboBox.enabled = isDrizzleEnabled;
    }
    
    function setDialogValues(){
        // Ref filename
        let filterName;
        let refFilename = data.cache.getRefFilename();
        if (refFilename){
            try {
                let refImageData = data.cache.getRefImageData();
                let hdrEntries = getHdrEntries(refImageData, refFilename, true);
                if (hdrEntries.XPIXSZ){
                    data.pixelSize = hdrEntries.XPIXSZ;
                }
                if (hdrEntries.FOCALLEN){
                    data.focalLength = hdrEntries.FOCALLEN;
                }
                filterName = hdrEntries.getFilter();
                self.refTextBox.text = refFilename;
            } catch (exception){
                logError(exception, "Failed to read reference image", refFilename);
                data.cache.setRefFilename(undefined);
                self.refTextBox.text = "";
                filterName = "";
            }
        } else {
            self.refTextBox.text = "";
        }
        self.setPixelScaleFields(data.pixelSize, data.focalLength, filterName);
        
        // Tgt files
        self.fullPathCheckBox.checked = data.useFullPath;
        data.targetFiles = cacheFitsHeaders(data.targetFiles, 5);
        data.targetFiles.sort();
        updateTargetImagesList();
        self.files_TreeBox.sort(COL_NOISE, true);
        
        self.limitingNumberToBlink_CheckBox.checked = data.limitingNumberToBlink;
        self.limitBlinkEdit.enabled = data.isNSGXnmlInstalled && data.limitingNumberToBlink;
        self.limitBlinkEdit.setValue(data.limitBlinkNumber);
        // -----------------
        // Output directory
        // -----------------
        self.outputDirTextBox.text = data.outputDir;

        // PostFix TextBox
        self.postFixTextBox.text = data.outputPostFix;
        if (data.createXnml && isPSFScaleSnrAvailable){
            self.noiseWeightTextBox.text = "PSF Scale SNR";
            self.noiseWeightTextBox.enabled = false;
        } else {
            self.noiseWeightTextBox.text = data.noiseWeightKeyword;
            self.noiseWeightTextBox.enabled = true;
        }
        
        // PreFix weight CheckBox
        self.weightPrefixCheckBox.checked = data.weightPrefix;
        
        self.csvFileCheckBox.checked = data.csvFile;
        
        // Overwrite check box
        self.overwriteCheckBox.checked = data.overwrite;
        self.displayGradientToggle.checked = data.displayGradient;
        self.nsgXnmlToggle.checked = data.createXnml;
        self.writeNormalizedToggle.checked = data.writeNormalized;
        self.addDrizzleFilesToggle.checked = data.addDrizzleFiles;
        
        enableDrizzleToggle(data);
        
        // On error ComboBox
        self.onErrorComboBox.currentItem = data.onErrorIndex;
        
        // -----------------
        // Star detection
        // -----------------
        self.refLogStarDetection_Control.setValue(data.logStarDetection);
        
        // -----------------
        // Star search
        // -----------------
        self.starFluxTolerance_Control.setValue(data.starFluxTolerance);
        self.starSearchRadius_Control.setValue(data.starSearchRadius);
        
        // -----------------
        // Photometry
        // -----------------
        self.autoPhotometryCheckBox.checked = data.useAutoPhotometry;
        self.apertureGrowthRate_Control.setValue(data.apertureGrowthRate);
        self.apertureAdd_Control.setValue(data.apertureAdd);
        self.apertureGap_Control.setValue(data.apertureGap);
        self.apertureBgDelta_Control.setValue(data.apertureBgDelta);
        self.outlierRemoval_Control.setValue(data.outlierRemovalPercent);
        self.linearRangeRef_Control.setValue(data.linearRangeRef);
        self.updatePhotometryRoi(data);
        
        // -----------------
        // Sample Generation
        // -----------------
        self.autoSampleGenerationCheckBox.checked = data.useAutoSampleGeneration;
        self.sampleSize_Control.setValue(data.sampleSize);
        self.limitSampleStarsPercent_Control.setValue(data.limitSampleStarsPercent);
        self.sampleStarGrowthRate_Control.setValue(data.sampleStarGrowthRate);
        self.updateMRC();
        
        // --------------------
        // Gradient correction
        // --------------------
        self.gradientSmoothness_Control.setValue(data.gradientSmoothness);
        
        self.smallScreenToggle.checked = data.smallScreen;
        // --------------------
        // Image rejection
        // --------------------
        self.imageRejectionBar.checkBox.checked = data.useImageRejection;
        self.imageRejectionSection.enabled = data.useImageRejection;
        self.minimumWeight_Control.setValue(data.minimumWeight);
        self.minimumScale_Control.setValue(data.minimumScale);
        self.enableImageRejection(data.isNSGXnmlInstalled && nsgTgtResults.size > 0);
        if (!data.isNSGXnmlInstalled){
            self.imageRejectionBar.enabled = false;
            self.imageRejectionSection.enabled = false;
            let purchaseNSGXnml = "<p>Purchase NSGXnml to enable this option.</p>";
            self.imageRejectionBar.toolTip += purchaseNSGXnml;
            self.minimumScale_Control.toolTip += purchaseNSGXnml;
            self.minimumWeight_Control.toolTip += purchaseNSGXnml;
        }
        
        // --------------------
        // ImageIntegration
        // --------------------
        self.runImageIntegrationCheckBox.checked = data.runImageIntegration;
        self.sortByWeightCheckBox.checked = data.sortByWeight;
        let nthItem = self.templateIconIdComboBox.findItem( data.imageIntegrationTemplateId, 0, true );
        if (nthItem < 0){
            nthItem = 0;
            data.imageIntegrationTemplateId = "";
            self.autoRejectAlgorithm = true;
            self.autoRejectAlgorithmCheckBox.checked = true;
            self.autoRejectAlgorithmCheckBox.enabled = false;
        } else {
            self.autoRejectAlgorithmCheckBox.checked = data.autoRejectAlgorithm;
            self.autoRejectAlgorithmCheckBox.enabled = true;
        }
        self.templateIconIdComboBox.currentItem = nthItem;
        self.runDrizzleIntegrationCheckBox.checked = data.runDrizzleIntegration;
        nthItem = self.drizzleTemplateIconIdComboBox.findItem( data.drizzleIntegrationTemplateId, 0, true );
        if (nthItem < 0){
            nthItem = 0;
            data.drizzleIntegrationTemplateId = "";
        }
        self.drizzleTemplateIconIdComboBox.currentItem = nthItem;
        enableDrizzle();
        
        self.imageIntegrationBar.checkBox.checked = data.useImageIntegration;
        self.imageIntegrationSection.enabled = data.useImageIntegration;
    }
}

NsgDialog.prototype = new Dialog;
