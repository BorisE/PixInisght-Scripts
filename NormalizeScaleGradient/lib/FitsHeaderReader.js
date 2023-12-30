/* global File, DataType_ByteArray */

// This file is based on FITSKeywords.js which has the following copyright notice:
// ****************************************************************************
// PixInsight JavaScript Runtime API - PJSR Version 1.0
// ****************************************************************************
// FITSKeywords.js - Released 2020/04/17
// ****************************************************************************
//
// This file is part of FITSKeywords Script version 1.0.3
//
// Copyright (C) 2020 Dave Watson.
// Copyright (C) 2009 - 2020 Original author unknown.
// Written by Unknown
// Modified by Dave Watson
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. Neither the names "PixInsight" and "Pleiades Astrophoto", nor the names
//    of their contributors, may be used to endorse or promote products derived
//    from this software without specific prior written permission. For written
//    permission, please contact info@pixinsight.com.
//
// 4. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product:
//
//    "This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (http://pixinsight.com/)."
//
//    Alternatively, if that is where third-party acknowledgments normally
//    appear, this acknowledgment must be reproduced in the product itself.
//
// THIS SOFTWARE IS PROVIDED BY PLEIADES ASTROPHOTO AND ITS CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PLEIADES ASTROPHOTO OR ITS
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, BUSINESS
// INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS OF USE,
// DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ----------------------------------------------------------------------------

/**
 * 
 * @param {String} fitsFilePath
 * @returns {HeaderEntries}
 * @throws {Error} If file does not exist or file IO error
 */
function LoadUsefulFITSKeywords( fitsFilePath ) {
    /**
     * Get FITS key from an '.xisf' file header
     * @param {String} str
     * @returns {String} FITS key (for example "EXPOSURE")
     */
    function getKey(str){
        let s = str.indexOf('name="');
        let e = str.indexOf('"', (s + 6));
        let value = str.substring((s + 6), e);
        return value;
    }
    /**
     * Get FITS value from an '.xisf' file header
     * @param {String} str
     * @returns {String} FITS value. If the value is enclosed by "'", these are removed.
     */
    function getValue(str) {
        let s = str.indexOf('value="');
        let e = str.indexOf('"', (s + 7));
        let value = str.substring((s + 7), e);
        if (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'"){
            value = (value.substring(1, value.length - 1)).trim();
        }
        return value;
    }
    /**
     * Get FITS value from an '.fit' file header
     * @param {String} value
     * @returns {String} FITS value. If the value is enclosed by "'", these are removed.
     */
    function getFitsValue(value){
        value = value.trim();
        if (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'"){
            value = (value.substring(1, value.length - 1)).trim();
        }
        return value;
    }
    
    if (!fitsFilePath || !File.exists(fitsFilePath)){
        throw new Error( "File does not exist: " + fitsFilePath );
    }
    let headerEntries = new HeaderEntries(fitsFilePath);
    let fileExtension = getFileExtension(fitsFilePath);

    if(fileExtension === "xisf") {
        // Extract the <xisf> element from file
        let f = new File;
        f.openForReading( fitsFilePath );

        let rawData;
        let uint8Array;
        let stringData = "";
        let nBytes = 2048;
        for ( ;; ) {	 // Load data from file in blocks
            rawData = f.read( DataType_ByteArray, nBytes );
            if (f.isEOF){
                f.close();
                throw new Error( "Unexpected end of file: " + fitsFilePath );
            }
            
            // Replace binary data with '*'.
            uint8Array = rawData.toUint8Array();
            for (let i=0; i<uint8Array.length; i++){
                if (uint8Array[i] < 32 || uint8Array[i] > 126){
                    uint8Array[i] = 42;
                }
            }
            stringData += (new ByteArray(uint8Array)).toString();
            if(stringData.indexOf("</xisf>") !== -1) {
                break;
            }
        }
        f.close();

        // Extract FITSKeywords from <xisf> element
        let s = 0;
        let e = 0;
        for ( ;; ) {
            s = stringData.indexOf("<FITSKeyword", s);
            if(s < 0) {break;}
            s++;	// Index past this element start
            e = stringData.indexOf("/>", s);
            let keywordString = stringData.substring(s, e);
            let key = getKey(keywordString);
            headerEntries.addRawEntry(key, getValue, keywordString);
        }
        
    } else if (fileExtension === "fit" || fileExtension === "fits" || fileExtension === "fts" || fileExtension === "fz"){
        let f = new File;
        f.openForReading( fitsFilePath );
        let checkFirstEntry = true;
        for ( ;; ) {
            let rawData = f.read( DataType_ByteArray, 80 );

            // Parse name part
            let name = rawData.toString( 0, 8 );
            if ( name.toUpperCase() === "END     " ) // end of HDU keyword list?
                break;
            if (f.isEOF){
                f.close();
                throw new Error( "Unexpected end of file reading FITS keywords, file: " + f.path );
            }

            // Parse value / comment parts , handle HIERARCH
            let value = "";
//            let comment = "";
//            let hasValue = false;

            // value separator (an equal sign at byte 8) present?
            if ( rawData.at( 8 ) === 61 )
            {
                // This is a valued keyword
//                hasValue = true;
                // find comment separator slash
                let cmtPos = searchCommentSeparator( rawData );
                if ( cmtPos < 0 ) // no comment separator?
                    cmtPos = 80;
                // value substring
                value = rawData.toString( 9, cmtPos - 9 );
//                if ( cmtPos < 80 ) // comment substring
//                    comment = rawData.toString( cmtPos + 1, 80 - cmtPos - 1 );
            }
            else if ( name === 'HIERARCH' )
            {
                let viPos = searchHierarchValueIndicator( rawData );
                if ( viPos > 0 )
                {
//                    hasValue = true;
                    name = rawData.toString( 9, viPos - 10 );
                    // find comment separator slash
                    let cmtPos = searchCommentSeparator( rawData );
                    if ( cmtPos < 0 ) // no comment separator?
                        cmtPos = 80;
                    // value substring
                    value = rawData.toString( viPos + 1, cmtPos - viPos - 1 );
//                    if ( cmtPos < 80 ) // comment substring
//                        comment = rawData.toString( cmtPos + 1, 80 - cmtPos - 1 );
                }
            }

            // If no value in this keyword
//            if ( !hasValue )
//                comment = rawData.toString( 8, 80 - 8 ).trim();

            // Perform a naive sanity check: a valid FITS file must begin with a SIMPLE=T keyword.
            if (checkFirstEntry){
                checkFirstEntry = false;
                if ( name !== "SIMPLE  " && value.trim() !== 'T' ){
                    f.close();
                    throw new Error( "File does not seem to be a valid FITS file (SIMPLE T not found): " + f.path );
                }
            }

            headerEntries.addRawEntry(name.trim(), getFitsValue, value);
        }
        f.close();	
    }
    return headerEntries;

    function getFileExtension(filename) {
        let extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
        return extension.toLowerCase();
    }

    function searchCommentSeparator( b ) {
        let inString = false;
        for ( let i = 10; i < 80; ++i )
            switch ( b.at( i ) )
            {
                case 39: // single quote
                    inString ^= true;
                    break;
                case 47: // slash
                    if ( !inString )
                        return i;
                    break;
            }
        return -1;
    }

    // In HIERARCH the = sign is after the real keyword name
    // Example: HIERARCH LongKeyword = 47.5 / Keyword has > 8 characters, and mixed case
    function searchHierarchValueIndicator( b ) {
        for ( let i = 9; i < 80; ++i )
            switch ( b.at( i ) )
            {
            case 39: // single quote, = cannot be later
                return -1;
            case 47: // slash, cannot be later
                return -1;
            case 61: // =, may be value indicator after all
                return i;
            }
        return -1;
    }

    return -1;
}
