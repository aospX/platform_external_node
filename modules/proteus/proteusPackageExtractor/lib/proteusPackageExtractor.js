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
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var proteusUnzip = require("proteusUnzip");

var DEFAULT_PUBLIC_KEY_LENGTH = 256;


//Package Class which contains package assets; to be returned via callback
function PackageContents(){
	var _magicNumber;
	var _version;
	var _publicKeyLength;
	var _signatureLength;
	var _publicKey;
	var _signature;
	var _zip;
};

PackageContents.prototype.__defineGetter__("magicNumber", function() {return _magicNumber;});
PackageContents.prototype.__defineSetter__("magicNumber", function(val) {
	if (val != "Cr24") throw new exception("Error: Magic Number Not Valid")
	_magicNumber = val;
});

PackageContents.prototype.__defineGetter__("version", function() {return _version;});
PackageContents.prototype.__defineSetter__("version", function(val) {_version = val;});

PackageContents.prototype.__defineGetter__("publicKeyLength", function() {return _publicKeyLength;});
PackageContents.prototype.__defineSetter__("publicKeyLength", function(val) {_publicKeyLength = val;});

PackageContents.prototype.__defineGetter__("signatureLength", function() {return _signatureLength;});
PackageContents.prototype.__defineSetter__("signatureLength", function(val) {_signatureLength = val;});

PackageContents.prototype.__defineGetter__("publicKey", function() {return _publicKey;});
PackageContents.prototype.__defineSetter__("publicKey", function(val) {_publicKey = val;});

PackageContents.prototype.__defineGetter__("signature", function() {return _signature;});
PackageContents.prototype.__defineSetter__("signature", function(val) {_signature = val;});

PackageContents.prototype.__defineGetter__("zip", function() {return _zip;});
PackageContents.prototype.__defineSetter__("zip", function(val) {_zip = val;});


// PackageExtractor Class which performs the extraction of the package contents
// Calls successCB with the PackageContents object
function PackageExtractor(){};

PackageExtractor.prototype.extract = function(filePath, moduleName, successCB, failureCB){

	var installationPath = process.downloadPath + '/' + moduleName;

	console.log("filePath =" + filePath);
	console.log("installationPath =" + installationPath);
	console.log("moduleName =" + moduleName);

	if (typeof failureCB !== 'function') {
	    failureCB = function(e) {
	      console.error("error in extract: " + e);
	      throw e;
	    }
	}

	if (typeof filePath !== 'string' || typeof successCB != 'function') {
	  console.error("filePath: " + filePath + " successCb: " + successCB);
	  return failureCB("Invalid arguments");
	}


	if(!path.existsSync(filePath))
		 failureCB("Error: File Path Provided Not Valid");


	fs.open(filePath, 'r', function(err, fd) {
		if (err)
		    throw (err.message);

		var stats =	fs.fstatSync(fd);
		var fileSize = stats.size;
		var contents = new Buffer(fileSize);

		console.log("fileSize =" + fileSize);

		fs.read(fd, contents, 0, fileSize, 0, function(err, bytesRead) {
			if (err){
				if (path.existsSync(filePath))
					fs.unlink(filePath);

				failureCB("Error: Error Reading File - " + err);
			}

			if (bytesRead != fileSize){
				if (path.existsSync(filePath))
					fs.unlink(filePath);

				failureCB("Error: Bytes Read Does Not Match File Size");
			}

			var packageContents = new PackageContents();
			var byteStart = 0;
			var byteEnd = 0;
			var iteration = 0;
			var numBytes = 4;

			//Get first 4 bytes - magic number
			byteEnd = numBytes;
			var bufMagicNumber = contents.slice(byteStart, byteEnd);
			packageContents.magicNumber = bufMagicNumber.toString('binary', 0, bufMagicNumber.length);
			iteration++;

			//Get second set of 4 bytes - version
			byteStart = iteration * numBytes;
			byteEnd = byteStart + 4;
			var bufVersion = contents.slice(byteStart,byteEnd);
			packageContents.version = (bufVersion[0]);
			iteration++;

			//Get third set of 4 bytes - public key length
			byteStart = iteration * numBytes;
			byteEnd = byteStart + 4;
			var bufPubKeyLen = contents.slice(byteStart,byteEnd);
			var publicKeyLength = (bufPubKeyLen[0]);
			publicKeyLength += DEFAULT_PUBLIC_KEY_LENGTH;
			packageContents.publicKeyLength = publicKeyLength;
			iteration++;

			//Get fourth set of 4 bytes - Signature length
			byteStart = iteration * numBytes;
			byteEnd = byteStart + 4;
			var bufSigLen = contents.slice(byteStart,byteEnd);
			var signatureLength = (bufSigLen[0]);
			packageContents.signatureLength = signatureLength;
			iteration++;

			//Get public key
			byteStart = iteration * numBytes;
			byteEnd = byteStart + publicKeyLength;
			var bufPubKey = contents.slice(byteStart, byteEnd);
			packageContents.publicKey = bufPubKey.toString('ascii');

			//Get signature
			byteStart = byteEnd;
			byteEnd = byteStart + signatureLength;
			var bufSig = contents.slice(byteStart, byteEnd);
			packageContents.signature = bufSig.toString('binary'); //.toString('base64', 0, bufSig.length);

			//Get zip contents
			byteStart = byteEnd;
			byteEnd = fileSize;		//read to the end of the file
			var bufZip = contents.slice(byteStart, byteEnd);
			packageContents.zip = bufZip; //.toString('base64', 0, bufZip.length);

			//verify signature
			if(verifySig(packageContents)){
				try{
					unZipAndInstall(packageContents, installationPath, moduleName);
				}
				catch(ex){
					if (path.existsSync(filePath))
						fs.unlink(filePath);

					failureCB("Exception Has Occurred " + ex.message);
					return;
				}
			}
			else{
				if (path.existsSync(filePath))
					fs.unlink(filePath);

				failureCB("Exception Has Occurred - Invalid Signature");
				return;
			}

			successCB();
		});
	});
}


var unZipAndInstall = function(package, installPath, moduleName){

	var TEMP_PATH = process.downloadPath + '/temp/';
	var tempPath =  TEMP_PATH + moduleName;

	if (! path.existsSync(tempPath)){
        fs.mkdirSync(tempPath, 0777)
	}

        var buffer = new Buffer(package.zip , 'base64');
        var result = proteusUnzip.decompressZipBuffer(buffer , tempPath);

	console.info("ProteusModLoader::installPackage ::  installPath  " + installPath);

	if (result){
		// delete existing module in correct path and rename
		console.info("ProteusModLoader::installPackage :: delete and move the package");

		if (path.existsSync(installPath))
		  fs.rmdirRSync(installPath);

		fs.renameSync(tempPath , installPath);

		console.info("Done with the Move ");

        // delete the downloaded file & temp folder.
      	fs.rmdirRSync(TEMP_PATH);
      }
      else{
		// delete the downloaded file & temp folder.
		fs.rmdirRSync(TEMP_PATH);
		// delete files/folder install path folder.
		fs.rmdirRSync(installPath);
		throw ("Zip contents are invalid");
      }
}

var verifySig = function(packageContents){
			var verifier = crypto.createVerify("sha1");
			verifier.update(packageContents.zip);
			var retVal = verifier.verify(packageContents.publicKey, packageContents.signature , "binary");
			console.log("<<<<<<<< retVal >>>>>>> = " + retVal);
			return retVal;
}


exports.packageExtractor = new PackageExtractor();



