/* global File, ColorSpace_Gray, SampleType_Real */

// Version 1.0 (c) John Murphy 1st-Jan-2023
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

/**
 * Reads Image and Image data (lazy evaluation).
 * Use Invalidate() to free data.
 * @param {String} fullFilename
 * @returns {ImageReader}
 */
function ImageReader(fullFilename){
    let filePath = fullFilename;
    let imageName = filePath ? File.extractName(filePath) : undefined;
    let imageData;
    let image;
//    let self = this;
//    this.testErrors = false;
    
    /**
     * @param {ImageDescription[]} descriptions
     * @param {FileFormatInstance} fileFormatInst
     * @returns {ImageReader.ImageData}
     */
    function ImageData(descriptions, fileFormatInst){
        this.imageDescription = descriptions[0];
        this.iccProfile = fileFormatInst.format.canStoreICCProfiles ? fileFormatInst.iccProfile : undefined;
        this.keywords = fileFormatInst.format.canStoreKeywords ? fileFormatInst.keywords : [];
        this.metadata = fileFormatInst.format.canStoreMetadata ? fileFormatInst.metadata : undefined;
        this.thumbnail = fileFormatInst.format.canStoreThumbnails ? fileFormatInst.thumbnail : undefined;
        this.imageProperties = undefined;
        
        // Properties extracted for NSG (not needed to write image file)
        this.propertyExposureTime = undefined;
        this.propertyFocalLength = undefined;
        this.propertyXPixelSize = undefined;
        this.propertyCFASourceChannel = undefined;
        
        // Useful Image properties:
        // Instrument:Sensor:XPixelSize
        // Instrument:Sensor:YPixelSize
        // Instrument:Camera:ISOSpeed
        // Instrument:Camera:Name [example Canon EOS 5D Mark II]
        // Instrument:ExposureTime
        // Instrument:Telescope:Aperture
        // Instrument:Telescope:FocalLength [example 0.1000000014901161 for 100mm lens]
        // Observation:Time:Start [example Fri Jul 17 2015 02:00:35 GMT+0100 (GMT Summer Time)]
        // Observer:Name
        // PCL:CFASourceChannel [example 0 is red, 1 is green, 2 is blue]
        // PCL:CFASourcePattern [example GBRG]
        //
        if ( fileFormatInst.format.canStoreImageProperties && fileFormatInst.format.supportsViewProperties ){
            this.imageProperties = [];
            let properties = fileFormatInst.imageProperties;
            for ( let p of properties ){
                // Read the property value for each property.
                // readImageProperty() only works from JS if the property exists...
                // We are iterating through the properties that exist, so it's safe here.
                let value = fileFormatInst.readImageProperty( p[0]/*id*/ );
                if ( value !== null ){
                    // Save image properties to use when we save the imgae file
                    this.imageProperties.push( { id:p[0], type:p[1], value:value } );
//                    console.noteln("Property[",i,"] id:", p[0], ", type:", p[1], ", value:", value);
                    
                    // Save some properties that may be useful to NSG (can't do this later; see above)
                    if (p[0] === "Instrument:Sensor:XPixelSize")
                        this.propertyXPixelSize = value;
                    else if (p[0] === "Instrument:Telescope:FocalLength")
                        this.propertyFocalLength = value;
                    else if (p[0] === "Instrument:ExposureTime")
                        this.propertyExposureTime = value;
                    else if (p[0] === "PCL:CFASourceChannel")
                        this.propertyCFASourceChannel = value;
                }
            }
        }
    }
    
    /**
     * @returns {ImageReader.ImageData}
     * @throws {Error} File I/O errors
     */
    this.readImageData = function(){
        if (!imageData){
            readImageHeaders(true);
//            console.noteln(self.toString());
        }
        return imageData;
    };
    
    /**
     * @returns {Image}
     * @throws {Error}
     */
    this.readHeadersAndImage = function(){
        if (!image){
            let fileFormatInstance = readImageHeaders(false);
            image = readImage(fileFormatInstance);
//            console.noteln(self.toString());
        }
        return image;
    };
    
    /**
     * Read ImageDescription, ICCProfile, Keywords, Metadata, ImageProperites, thumbnail
     * @param {Boolean} closeFile
     * @returns {FileFormatInstance}
     * @throws Error
     */
    function readImageHeaders(closeFile){
        let suffix = File.extractExtension( filePath ).toLowerCase();
//        if (self.testErrors) suffix += "z";
        let fileFormat = new FileFormat( suffix, true/*toRead*/, false/*toWrite*/ );
        if ( fileFormat.isNull )
            throw new Error( "No installed file format can read \'" + suffix + "\' files." );

        let fileFormatInst = new FileFormatInstance( fileFormat );
        if ( fileFormatInst.isNull )
            throw new Error( "Unable to instantiate file format: " + fileFormat.name );

        let descriptions = fileFormatInst.open( filePath, "no-warnings verbosity 0"/*input hints*/ );
        if ( !descriptions || descriptions.length < 1 ){ // length is the number of images stored within the file
            throw new Error( "readImageHeaders(): FileFormatInstance failed" );
        }

        imageData = new ImageData(descriptions, fileFormatInst);
        
        if (closeFile){
            fileFormatInst.close();
        }
        return fileFormatInst;
    }
    
    /**
     * @param {FileFormatInstance} fileFormatInst
     * @returns {Image}
     * @throws {Error} 
     */
    function readImage(fileFormatInst){
        console.writeln('Reading image "', imageName, '"');
        let image = new Image( 1, 1, 1, ColorSpace_Gray, 32 /*bitsPerSample*/, SampleType_Real );
        if ( !fileFormatInst.readImage( image ) )
            throw new Error( "Unable to read file: " + filePath );
        fileFormatInst.close();
        image.rangeClippingEnabled  = true;
        return image;
    }
    
    /**
     * Free the image and thumbnail (if not undefined), then set them to undefined.
     */
    this.invalidate = function(){
        if (image){
            image.free();
            image = undefined;
        }
        if (imageData && imageData.thumbnail){
            imageData.thumbnail.free();
            imageData = undefined;
        }
    };
    
    /**
     * @returns {String} file name and path
     */
    this.getFilePath = function(){
        return filePath;
    };
    
    /**
     * @returns {String} The file name only, without path or postfix.
     */
    this.getImageName = function(){
        return imageName;
    };
    
    this.toString = function(){
        let data = imageData;
        let str = "[ImageReader]:\n";
        for (let i=0; i<data.keywords.length; i++){
            str += "keyword[" + i + "] " + data.keywords[i].name + ", " + data.keywords[i].value + '\n';
        }
        str += "Description:\n";
        str += "-- bitsPerSample:" + data.imageDescription.bitsPerSample + '\n';
        str += "-- cfaType:" + data.imageDescription.cfaType + '\n';
        str += "-- exposure:" + data.imageDescription.exposure + '\n';
        str += "-- focalLength:" + data.imageDescription.focalLength + '\n';
        str += "-- width & height: (" + data.imageDescription.width + ", " + data.imageDescription.height + ")\n";
        str += "-- isoSpeed:" + data.imageDescription.isoSpeed + '\n';
        str += "-- numberOfChannels:" + data.imageDescription.numberOfChannels + '\n';
        str += "Properties:" + '\n';
        str += "-- Instrument:ExposureTime:" + data.propertyExposureTime + '\n';
        str += "-- Instrument:Telescope:FocalLength:" + data.propertyFocalLength + '\n';
        str += "-- Instrument:Sensor:XPixelSize:" + data.propertyXPixelSize + '\n';
        str += "-- PCL:CFASourceChannel:" + data.propertyCFASourceChannel + '\n';
        str += "iccProfile length: " + data.iccProfile.length + '\n';
        str += "metadata:" + data.metadata + '\n';
        str += "thumbnail:" + data.thumbnail + '\n';
        return str;
    };
}
