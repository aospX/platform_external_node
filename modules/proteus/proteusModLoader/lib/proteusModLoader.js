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

var https = require("https"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    sys = require("sys"),
    packageExtractor = require("proteusPackageExtractor")
    ;

module.exports = proteusModManager;

// Constants -

var PROTEUS_PATH = process.downloadPath + '/' ;
var TEMP_PATH = process.downloadPath + '/temp/';
var UPDATE_FILE = process.downloadPath + '/lastUpdate.log' ;
var RETRY_TIME = 2000 ; // retry time for pkg check if blocked by getVersion
var SERVER_URL = "https://10.42.61.254" ;
var DEVICE_INFO = "/ICS/ProteusVersion/0.0.1/" ;

// var DEVICE_INFO = "?AV=4.0&PV=1.0.0" ;

var UPDATE_PERIOD = 60000; //  1 minutes in milliseconds for testing
var CONN_TIMEOUT = 10000;
//

function proteusModManager(){

function getDownloadServer(){
  return SERVER_URL;
}


function getDeviceInfo(){
  return DEVICE_INFO;
}

var rmdirRSync = fs.rmdirRSync;

function getDownloadedModules(){
  try{
    var files = fs.readdirSync(PROTEUS_PATH);
    var modulesOnFS = new Array();
    for (var i in files){
      var filePath = PROTEUS_PATH + files[i] ;
      var file = fs.statSync(filePath);
      if (file.isDirectory() == true){
	// check the pacakge.json to query the module name or use folder name???

	modulesOnFS.push(files[i]);
      }
    }
    console.info("getDownloadedModules : Modules  :" + modulesOnFS);
    return modulesOnFS;
  }
  catch(err){
    console.error("getDownloadedModules : Error :" + err);
  }
}


function getModuleVersion(module){
  try{
    // try the public
    var publicModuleConfigPath = PROTEUS_PATH + module +'/package.json';
    if (path.existsSync(publicModuleConfigPath)){
      var bufferJSON = JSON.parse(fs.readFileSync(publicModuleConfigPath));
      console.info("getModuleVersion : public module :" + module + " version :" + bufferJSON.version);
      return bufferJSON.version;
    }
  }
  catch(err){
    console.error("getModuleVersion : Error :" + err);
  }
}

proteusModManager.prototype.loadPackage = function(pkgName, successCb, failureCb){

  if (typeof failureCb !== 'function') {
    failureCb = function(err) {
      console.error("error in loadPackage: " + err);
      //throw err;
    }
  }

  if (typeof pkgName !== 'string' || typeof successCb != 'function') {
    console.error("pkgName: " + pkgName + " successCb: " + successCb);
    return failureCb("Invalid arguments");
  }

  console.info("loadPackage  : " + pkgName );

  // Download updates only the first call to load Pkg.
  if (process.getModuleUpdates() == 0 ){
     // Check and download updates (getVersions)
    downloadUpdates();

    console.info("loadPackage  : " + pkgName + " delayed due to getVersion" );

    // block the load pkg until getVersion returns
    setTimeout(function(){
      proteusModManager.prototype.loadPackage(pkgName, successCb, failureCb)
    }, RETRY_TIME);

  } // else check if we have completed checking the version
  else if(process.getModuleUpdates() == 2) {
    // check is pkg and its dependencies are available else download it
    getPackage(pkgName, function(result){

    if (result){
      console.info("loadPackage  :"+ pkgName +" Return Success to client" );
      successCb();
    }
    else{
      console.info("loadPackage  :"+ pkgName +" Return Failure to client" );
      failureCb("Failed to download  :" + pkgName);
    }
    });
  }else{
    // block the load pkg until getVersion returns

    console.info("loadPackage  : " + pkgName + "delayed due to getVersion" );
    setTimeout(function(){
      proteusModManager.prototype.loadPackage(pkgName, successCb, failureCb)
    }, RETRY_TIME);
  }
}

function getPackage(pkg, callback){

  console.info(" In getPackage :" + pkg);

  var pkgsDownloadedList = new Array(); // list of pkgs that were downloaded
  var pkgsList = new Array(); // list of pkgs to process

  function isPkgAvailable(pkgName){
      var pkgConfigPath = PROTEUS_PATH + pkgName +'/package.json';
      if (path.existsSync(pkgConfigPath)){
	console.info(pkgName + " is Available Locally");
	return true;
      }
      else{
	console.info(pkgName + " is Not Available Locally");
	return false;
      }
  }

  // get all the Dependencies for the given package
  function getDependencies(pkgName){
    var pkgConfigPath = PROTEUS_PATH + pkgName + '/package.json';
    var jsonBuffer = JSON.parse(fs.readFileSync(pkgConfigPath));
    var pkgDependencies = new Array();
    if (jsonBuffer.dependencies){
      console.info(pkgName + " dependencies :"+ JSON.stringify(jsonBuffer.dependencies));
      for (var key in jsonBuffer.dependencies){
	   pkgDependencies.push(key);
       }
    }
    return pkgDependencies;
  }

  function downloadHandler(callback){
    console.info("downloadHandler : " + pkgsList) ;

    if (pkgsList.length > 0){
          // download the pkg
	  process.acquireLock(function(){
	    // check once more if the item was downloaded due to another instance while this was waiting
	    if (isPkgAvailable(pkgsList[0])){
	      console.info(pkgsList[0] + " is Available due to another instance") ;
	      // add more
	      var newDependencies = getDependencies(pkgsList[0]);
	      process.releaseLock();
	      callback(true);
	    }
	    else{
	      download(pkgsList[0], function (path, statusCode) {
		console.info(pkgsList[0] + " Download Success : Path :" + path + " statuscode :"+statusCode) ;
		//pkgsLocalAvailableList[pkgsList[0]] = true;
		// add more
		var newDependencies = getDependencies(pkgsList[0]);

		// pop the first element add it to the list of pkgs downloaded
		pkgsDownloadedList.push(pkgsList.shift());
		pkgsList = pkgsList.concat(newDependencies);
		callback(true);
		process.releaseLock();
	      }, function (result, statusCode) {
		console.error(pkgsList[0] + " Download Failed : "+ result + statusCode) ;
		process.releaseLock();
		callback(false);
	      });
	    }
	  });
    }
  }


  function checkPkgs(result){

    if (result){
      if (pkgsList.length > 0){
	if (isPkgAvailable(pkgsList[0])){
	  var dependencies = getDependencies(pkgsList[0]);

	  // skip the current pkg
	  pkgsList.shift();

	  if (dependencies.length > 0)
	    pkgsList = pkgsList.concat(dependencies);


	  checkPkgs(true);
	}
	else{
	  console.info(" In checkPkgs : start download " + pkgsList[0] );
	  downloadHandler(checkPkgs);
	}
      }
      else{
	console.info("get Package :" + pkg + " Success" );
	callback(true);
      }
    }
    else{
      console.info("get Package :" + pkg + " Failed" );
      console.info("detele downloaded pkgs : " +  pkgsDownloadedList);
      // do cleanup of downloaded pkgs
      for (var n = 0; n < pkgsDownloadedList.length; ++n) {
	rmdirRSync(PROTEUS_PATH + pkgsDownloadedList[n]);
      }
      callback(false);
    }
  }


  pkgsList.push(pkg);

  checkPkgs(true);
}

function download(moduleName, successCB, failureCB){


  if (typeof failureCB !== 'function') {
    failureCB = function(err) {
      console.error("error in download: " + err);
      //throw err;
    }
  }
 
  if (typeof moduleName !== 'string' || typeof successCB != 'function') {
    console.error("moduleName: " + moduleName + " successCb: " + successCB);
    return failureCB("Invalid arguments");
  }

  // check if there is a '/' in the end

  if (! path.existsSync(TEMP_PATH)){
    fs.mkdirSync(TEMP_PATH, 0777)
  }

  downloadNow();

  function downloadNow(){
  var requestUrl = getDownloadServer() + '/getModule' + getDeviceInfo() + moduleName +  ".crx";

  //var requestUrl = getDownloadServer() + '/getModule' +  getDeviceInfo() + '&Module='+ moduleName ; // www.qualcomm-xyz.com/getModule?AV=4.0&PV=1.0.0&Module=xyz

  downloadModule(requestUrl, 0,  successCB, failureCB);
  }



function installPackage(filePath, successCb, failureCb ){

  console.info("ProteusModLoader::installPackage ::  crx file  " + filePath);

  var installPath;
  installPath =  PROTEUS_PATH + moduleName ;

  packageExtractor.packageExtractor.extract(filePath, moduleName, function(package){
      successCb(installPath);
    }, function(error){
      failureCb(error);
    });
}




//downloads a module from given server
function downloadModule(requestUrl, numRedirect,  successCB, failureCB) {

  try{

  var contentLength = 0;
  var bytesDownloaded = 0;
  var tempFileName =  url.parse(requestUrl).pathname.split("/").pop();
  var downloadPath = TEMP_PATH + tempFileName;

	if (path.existsSync(downloadPath))
		fs.unlink(downloadPath);

  console.info("Download Module :: requestUrl : ",requestUrl);
  console.info("ProteusModLoader::downloadModule Module: " + moduleName +" to Directory : "+downloadPath);

  var options = {
    host: url.parse(requestUrl).host,
    port: 8000,
    path: url.parse(requestUrl).pathname,
    method: 'GET'
  };


  var request = https.request(options, function(response) {
  try{
  request.connection.setTimeout(CONN_TIMEOUT);

    switch(response.statusCode) {
      case 200:
	contentLength = response.headers['content-length'];
	break;
      case 302:
	redirectedRemote = response.headers.location;
	downloadModule(redirectedRemote, numRedirect+1,  successCB, failureCB );
	return;
	break;
      case 404:
	console.error("Module "+ moduleName +" Not Found");
	failureCB("Module Not Found ", response.statusCode);
	//request.abort();
	break;
      default:
          //request.abort();
	  failureCB("Error " , response.statusCode);
          return;
      }


       var downloadModFile = 0;
       response.on('data', function(data) {
	if ((data.length > 0) && (response.statusCode == 200))
	{
	  // Open only if the file is not opened already
	  if (!downloadModFile)
	  {
	    downloadModFile = fs.createWriteStream(downloadPath, {'flags': 'a'});
	  }

	  downloadModFile.write(data);
	  bytesDownloaded+=data.length;
	  percent = parseInt( (bytesDownloaded/contentLength)*100 );
	  console.info( "Module " + moduleName + " Progress: "+ percent );


	  downloadModFile.addListener('close', function() {
	    console.info("closing file bytesWritten : " + bytesDownloaded + " contentLength : " + contentLength);
	    if (downloadModFile.bytesWritten != contentLength){
	      console.info(" Missed writing to file bytesDownloaded: " + downloadModFile.bytesWritten + "contentLength" + contentLength);
	      failureCB("Incomplete Download", 0);
	    }
	    else{
		installPackage(downloadPath, function(installPath){
                                                 console.info("Installed module :" + moduleName );
		                                successCB(installPath, response.statusCode);
		                             },
			                     function(ex){
		                                console.error("Got error: " + ex);
					        failureCB(ex, 0);
					     });
	  }
	});

	}
      });

      response.on('end', function() {
	if (response.statusCode == 200)
	{
	  downloadModFile.end();
	}

      });

      response.on('close', function(err) {
	   // delete file if its already present
	    if (path.existsSync(downloadPath))
	       fs.unlinkSync(downloadPath)
	failureCB(err,response.statusCode);
      });


  }catch(ex){
       // delete file if its already present
       if (path.existsSync(downloadPath)){
	 try{
	 fs.unlinkSync(downloadPath)
	 }
	 catch(ex){
	   console.error("Got error: " + ex.message);
	 }
	 failureCB(ex, 0);
       }
  }
  });
  request.end();

  request.on('error', function(e) {
	   // delete file if its already present
	    if (path.existsSync(downloadPath))
	       fs.unlinkSync(downloadPath)
	failureCB(e.message, 0);
	console.error("Got error: " + e.message);
  });

  }
  catch(ex){
       // delete file if its already present
       if (path.existsSync(downloadPath)){
	 try{
	 fs.unlinkSync(downloadPath)
	 }
	 catch(ex){
	   console.error("Got error: " + ex.message);
	 }
	 failureCB(ex, 0);
       }
  }
}

}


function getUpdatePeriod(){
  return UPDATE_PERIOD;
}

function getLatestVersions(modules, callback){

  var requestUrl = getDownloadServer() + "/getVersions" + getDeviceInfo()  + modules.join('/') ;
  //var requestUrl = getDownloadServer() + '/getVersions' +  getDeviceInfo() + '&Modules='+ modules.join(',') ;

  console.info("GetVersion : requestUrl : " + requestUrl) ;

  try{
  getVersions(requestUrl,
	     function (modules, statusCode) {
	       console.info("GetVersion Success : modules" + modules + " statuscode :"+statusCode) ;
	       callback(true, modules);
	     },
	     function (result, statusCode) {
	       console.info("GetVersion Failed : "+ result + statusCode) ;
	       callback(false);
	     });
  }
  catch(ex){
    console.error("GetVersion Failed : " + ex ) ;
    callback(false);
  }
}


function getVersions(requestUrl, successCb, failureCb){
  try{

    var contentLength = 0;
    var bytesDownloaded = 0;

    var options = {
      host: url.parse(requestUrl).host,
      port: 8000,
      path: url.parse(requestUrl).pathname,
      method: 'GET'
    };

    console.info("Get version :: requestUrl : split " + sys.inspect(options));

    var request = https.request(options, function(response) {

      try{
      var versionResponse = '';

      request.connection.setTimeout(CONN_TIMEOUT);

      switch(response.statusCode) {
	case 200:
	  contentLength = response.headers['content-length'];
	  break;
	case 302:
	  redirectedRemote = response.headers.location;
	  geVersions(redirectedRemote, successCb, failureCb );
	  return;
	  break;
	case 404:
	  console.error("unable to get latest versions");
	  failureCB("unable to get latest version", response.statusCode);
	  request.abort();
	  break;
	default:
          request.abort();
	  failureCB("Error " , response.statusCode);
          return;
      }

      response.on('data', function(data) {
	if ((data.length > 0) && (response.statusCode == 200)){
	  versionResponse += data;
	}
      });

      response.on('end', function() {
	if (response.statusCode == 200){
	  successCb(versionResponse, response.statusCode);
	}

      });

      response.on('close', function(err) {
	console.info("Got error: " + err.message);
	failureCb(err,response.statusCode);
      });
      }
      catch(ex){
	console.error("Got error: " + ex.message);
	failureCb(ex, 0);
      }
  });
  request.end();

  request.on('error', function(e) {
	console.info("Got error: " + e.message);
	failureCb(e.message, 0);
  });

  }
  catch(ex){
    console.error("Got error: " + ex.message);
    failureCb(ex, 0);
  }
}


function readUpdateStatus(){
  try{
    var filePath = UPDATE_FILE ;
    if (path.existsSync(filePath)){
      var time = fs.readFileSync(filePath, 'utf8');
      if(!time) {
	console.error("Error Reading Update Time " +err);
	return 0;
      }
      else {
	console.info("Module Update file was read : Last Update Time ! :" + time);
	return time;
      }
    }
    else{
      console.error("Module Update file not Found ");
    }
  }
  catch(ex){
    console.error("Error Reading Update Time " + ex);
    if (path.existsSync(filePath)){
      // delete the log file file.
      fs.unlinkSync(filePath);
    }
    return 0;
  }
}


function writeUpdateStatus(time){
  try{
    var filePath = UPDATE_FILE ;

    if (path.existsSync(filePath)){
      // delete the log file file.
      fs.unlinkSync(filePath);
    }

    var err = fs.writeFileSync(filePath, time.toString());
    if(err) {
      console.error("Error Writing Update Time " +err);
    }
    else {
      console.info("New Time update to update log  : " + time);
    }
  }
  catch(ex){
    console.error("Error Writing Update Time " + ex);
    if (path.existsSync(filePath)){
       // delete the log file file.
       fs.unlinkSync(filePath);
    }
  }
}

function compareVersions (currentVersionStr, serverVersionStr) {
   if (typeof currentVersionStr == 'string' && typeof serverVersionStr == 'string')
   {
       function versionStrToObj(versionStr){
              var splitArray = versionStr.split('.');
              var major = parseInt(splitArray [0]) || 0;
              var minor = parseInt(splitArray [1]) || 0;
              var patch = parseInt(splitArray [2]) || 0;
              var versionObj = {
                   major : major ,
                   minor : minor ,
                   patch : patch
              }
              return versionObj;
       }

       var currentVersion = versionStrToObj(currentVersionStr);
       var serverVersion = versionStrToObj(serverVersionStr);
       if (currentVersion.major < serverVersion.major ) {
           return true; // newer version
       } else if (currentVersion.minor < serverVersion.minor || currentVersion.patch < serverVersion.patch) {
	 return true; // newer version
       } else {
	 return false; // same version
      }
   }
   else{
     throw("Invalid Versions to compare");
   }
}

function checkUpdates(){
  try{
    console.info("In checkUpdates ");
    var now = Date.now();
    var lastCheck = readUpdateStatus();
    if (!lastCheck || (parseInt(now.toString()) > (parseInt(lastCheck) + getUpdatePeriod()))) {
     console.info("Updates check required now: " + now + " lastCheck : " + lastCheck + " updatePeriod :" + getUpdatePeriod() );
      var mods = getDownloadedModules();
      if (mods.length > 0){
	try{
	  getLatestVersions(mods, function(result , versions) {
	    if(result){
	      console.info("Module List :" + mods);
	      console.info("Server Vesion List :" + sys.inspect(versions));
	      var jsonObj = JSON.parse(versions);
	      var moduleVersions = jsonObj.versionList;
	      for (var n = 0; n < mods.length; ++n) {
		if (moduleVersions[n] != null){
		  var localVersion = getModuleVersion(mods[n]);
		  console.info("Module : " + mods[n] + " Local Version : " + localVersion +" Server Version : " + moduleVersions[n]);
		  // compare server and local version
		  if (compareVersions(localVersion, moduleVersions[n])) {
		    // remove the module
		    rmdirRSync(PROTEUS_PATH + mods[n]);
		  }
		}
	      }
	      // update the timestamp for versioncheck
	      writeUpdateStatus(now);
	    }
	    // do we block
	    // set that the modules have been updated.
	    process.setModuleUpdates(2);
	    // clear the lock so that loadmodule can continue
	    process.releaseLock();
	  });
	}
	catch(ex){
	  console.error("In checkUpdates : Error " + ex);

	  // set that the modules have been updated.
	  process.setModuleUpdates(2);
	  // clear the lock so that loadmodule can continue
	  process.releaseLock();
	  return;
	}
      } // if modules present
      else{
	console.info("In checkUpdates : No modules on device");
	// set that the modules have been updated.
	process.setModuleUpdates(2);
	process.releaseLock();
      }
   }// if updates checked
   else{
     console.info("Updates check not required : " + now + " lastCheck : " + lastCheck + " updatePeriod :" + getUpdatePeriod() );
     // set that the modules have been updated.
     process.setModuleUpdates(2);
     process.releaseLock();
   }
  } //try
  catch(ex){
    console.error("In checkUpdates : Error " + ex);
    // set that the modules have been updated.
    process.setModuleUpdates(2);
    process.releaseLock();
  }
}

function downloadUpdates(){
  process.setModuleUpdates(1); //set the flag to inprogress state
  process.acquireLock(checkUpdates);

}

}
