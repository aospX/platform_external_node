/*
 * Copyright (c) 2011, Code Aurora Forum. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 *       copyright notice, this list of conditions and the following
 *       disclaimer in the documentation and/or other materials provided
 *       with the distribution.
 *     * Neither the name of Code Aurora Forum, Inc. nor the names of its
 *       contributors may be used to endorse or promote products derived
 *       from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

//var unzipWrapBindings = require('./unzip.node');
var unzipWrapBindings = process.binding('unzip');
var fs = require('fs');
var path = require('path');

var rmdirRSync = fs.rmdirRSync;
var mkdirsSync = fs.mkdirsRSync;
var PERM = 0777 ;//Owner read / write, other read only

exports.getFileFromZip = function(srcZipFilePath, file){
  console.info("In getFileFromZip :");
  var buffer;
  try{

    // create the unzip object
    var unzipObj = new unzipWrapBindings.createUnzip();

    // set the src zip file
    unzipObj.setZipFilePath(srcZipFilePath);

    // get the Raw file from the zip file
    buffer = unzipObj.getRawFile(file);

    }
  catch(ex){
    console.error("Error  getFileFromZip:" + ex );
  }
  return buffer;
};

exports.getFileFromZipBuffer = function(srcZipBuffer, file){
  console.info("In getFileFromZipBuffer :");
  var buffer;
  try{

    // create the unzip object
    var unzipObj = new unzipWrapBindings.createUnzip();


    // set the src zip buffer
    unzipObj.setZipBuffer(srcZipBuffer);

    // get the Raw file from the zip file
    buffer = unzipObj.getRawFile(file);
    }
  catch(ex){
    console.error("Error  getFileFromZipBuffer:" + ex );
  }
  return buffer;
};


exports.decompressZipBuffer = function(srcZipBuffer, destFolder){

  if ((srcZipBuffer === undefined) || (srcZipBuffer === null) || !(srcZipBuffer instanceof Buffer )) {
    console.error("Invalid srcZipBuffer   ");
    throw("Invalid srcZipBuffer");
    return;
  }

  console.info("In decompressZipBuffer :");
  try{

    // check if we have a / else append to the end
    if( destFolder.substr(-1) === "/" ) {

    }
    else{
      destFolder += '/';
    }

    // clean up the destFolder folder
    rmdirRSync(destFolder);

    console.info("Destination :" + destFolder);

    // create the unzip object
    var unzipObj = new unzipWrapBindings.createUnzip();

    // set the src zip buffer
    unzipObj.setZipBuffer(srcZipBuffer);

    // get the files present on the zip file
    var files = unzipObj.listFiles();

    console.info("decompressZipBuffer :: Files in Zip :" + files);

    var result = true;

    // get the raw file from the zip file and create it at the destination
    for (i in files){

      // skip folders
      if (files[i].charAt(files[i].length - 1) == '/' )
      {
	console.info("Skiping Folder :" + files[i]);
	continue;
      }

      console.info("Processing File :" + files[i]);

      // get the Raw file from the zip file
      var buffer = unzipObj.getRawFile(files[i]);

      // create destination path
      var destFile = destFolder + files[i];

      var lastpos = destFile.lastIndexOf("/");

      var folders = destFile.substring(0,lastpos);

      console.info("Folders for the file " + folders);

      // use fs after the merge
      mkdirsSync(folders,PERM);

      if (!path.existsSync(folders)){
	console.error("Error creating Folders : " + folders);
	// remove the whole directory created for the module
	rmdirRSync(destFolder);
	return false;
      }

      // write the raw filr to destination

      //if (fs.isDirectory(destFile) == false){
      var err = fs.writeFileSync(destFile, buffer);
      if(err) {
	  console.error("Error Writing to File : " +err);
	  // remove the whole directory created for the module
	  rmdirRSync(destFolder);

	  return false;
      }
      else {
	console.info("The file was saved!");
      }


      console.info("File Created:" + destFile);
      //}
    }
  }
  catch(ex){
    result = false;
    // remove the whole directory created for the module
    rmdirRSync(destFolder);
    console.error("Error  decompressZipBuffer:" + ex );
  }
  return result;
};

exports.decompressZipFile = function(srcZipFilePath, destFolder){
  console.info("In decompressZipFile :");
  try{

    // check if we have a / else append to the end
    if( destFolder.substr(-1) === "/" ) {

    }
    else{
      destFolder += '/';
    }

    // clean up the destFolder folder
    rmdirRSync(destFolder);


    console.info("Destination :" + destFolder);

    // create the unzip object
    var unzipObj = new unzipWrapBindings.createUnzip();

    // set the src zip file
    unzipObj.setZipFilePath(srcZipFilePath);

    // get the files present on the zip file
    var files = unzipObj.listFiles();

    console.info("decompressZipFile :: Files in Zip :" + files);

    var result = true;

    // get the raw file from the zip file and create it at the destination
    for (i in files){


      // skip folders
      if (files[i].charAt(files[i].length - 1) == '/' )
      {
	console.info("Skiping Folder :" + files[i]);
	continue;

      }

      console.info("Processing File :" + files[i]);

      // get the Raw file from the zip file
      var buffer = unzipObj.getRawFile(files[i]);

      // create destination path
      var destFile = destFolder + files[i];

      var lastpos = destFile.lastIndexOf("/");

      var folders = destFile.substring(0,lastpos);

      console.info("Folders for the file" + folders);

      // use fs after the merge
      mkdirsSync(folders,PERM);

      if (!path.existsSync(folders)){
	console.error("Error creating Folders : " + folders);
	// remove the whole directory created for the module
	rmdirRSync(destFolder);
	return false;
      }


      //if (fs.isDirectory(destFile) == false){
      // write the raw filr to destination
      var err = fs.writeFileSync(destFile, buffer);
      if(err) {
	  console.error("Error Writing to File" + err);
	  // remove the whole directory created for the module
	  rmdirRSync(destFolder);

	  return false;
      }
      else {
	console.info("The file was saved!");
      }


      console.info("File Created:" + destFile);
      // }
    }
  }
  catch(ex){
    result = false;
    // remove the whole directory created for the module
    rmdirRSync(destFolder);
    console.error("Error  decompressZipFile: " + ex );
  }
  return result;
};
