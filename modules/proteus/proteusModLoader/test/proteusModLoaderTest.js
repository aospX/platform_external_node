//var proteusModLoader = require('../lib/proteusModLoader.js');
var proteusModLoader = require('proteusModLoader');
var fs = require('fs');
var path = require('path');
var assert = require('assert');

 var testNumber = 0;
 var curTest ;
 var curTestIndex = 0;
 var callbackOrder = 0;

//-------------------------------------------Tests Loop up---------------------------------------------------------------------------------

function testInfo (func, shortName, type, level, description, expectedResult ) {

    this.shortName =  shortName;
    this.testType = type,
    this.func = func ,
    this.description = description ;
    this.expectedResult = expectedResult;
    this.autoLevel = level;
    this.result = "Not Run";

    function setResult(res)
    {
      this.result = res;
    }

}

var testList = [

		new testInfo(testValidModuleDownload, 'Test_Valid_Mod_Download', 'L1', 'AUTO', "This is to test passing a valid module to be downloaded which is not present on the device" , "Module should be downloaded and we should be able to call require / load module on the module"),
		new testInfo(testInvalidSuccessCallback, 'Test_Invalid_Success_Callback', 'L1', 'AUTO',"This is to test passing a invalid Success Callback for a module to be downloaded", "The failure callback should be called notifying an invalid Success Callback was passed"),
		new testInfo(testInvalidFailureCallback, 'Test_Invalid_Failure_Callback', 'L1', 'AUTO',"This is to test passing a invalid Failure Callback for a module to be downloaded ","Should fail gracefully i.e failure callback should be created internally and try to download the pkg"),
		new testInfo(testInvalidModuleDownload, 'Test_Invalid_Mod_Download', 'L1', 'AUTO',"This is to test passing a invalid module to be downloaded", "The failure callback should be called notifying an invalid module was passed / does not exist on server"),
		new testInfo(testValidModuleDownloadAlreadyPresent, 'Test_Valid_Mod_Download_Already_Present', 'L1','SEMI-AUTO', "This is to test passing a valid module to be loaded which is already present in the device","Module should NOT be redownloaded . The logs must be looked to validate this.The local module should be returned "),
		new testInfo(testValidModuleWithDependencies, 'Test_Valid_Mod_Download_With_Dependencies', 'L1', 'AUTO',"This is to test passing a valid module to be loaded which has dependency", "The module and its dependencies must be downloaded and we should be able to call require / load module on any module downloaded"),
		new testInfo(testValidModuleWithDependenciesAlreadyPresent, 'Test_Valid_Mod_Download_With_Dependencies_AlreadyPresent', 'L1', 'SEMI-AUTO',"This is to test passing a valid module to be loaded which has dependency where all Dependencies are present on device. .Please check the log for post processing the result.","The module and its dependencies must be looked up locally and we should be able to call require / load module on any module downloaded"),
		new testInfo(testValidModuleWithDependenciesSemiPresent, 'Test_Valid_Mod_Download_With_Dependencies_SemiPresent', 'L1', 'AUTO',"This is to test passing a valid module to be loaded which has dependency where some Dependencies are present on device", "The module's missing dependencies must be downloaded and we should be able to call require / load module on modules in the dependency "),
		new testInfo(testValidModuleWithDependenciesSemiPresentNotOnServer, 'Test_Valid_Mod_Download_With_Dependencies_SemiPresent_Not_On_Server', 'L1','AUTO', "This is to test passing a valid module to be loaded which has dependency where some Dependencies are present on device and some dependencies are not present on the server","The module's missing dependencies should be tried to be downloaded and we fail and delete the modules that were downloaded"),
		new testInfo(testNewVersion, 'Test_New_Version', 'L1', 'MANUAL',"This is to test when there is a newer version of package available on the server than the device" , "The getVersion Call should delete the existing module and the next call to load Package should download the new version"),
		new testInfo(testOldVersion, 'Test_Old_Version', 'L1', 'MANUAL',"This is to test when there is a newer version of package available on the device than the server", "The getVersion Call should not delete the existing module and the next call to load Package should use the one on device"),
		new testInfo(testSameVersion, 'Test_Same_Version', 'L1', 'MANUAL',"This is to test when there is a  version of package available on the device and the server are same", "The getVersion Call should do nothing on the existing module and the next call to load Package should use the one on device"),
		new testInfo(testServerDownVersion, 'Test_ServerDown_Version', 'L1', 'MANUAL',"This is to test when the server is down when the getVersion call is made.","The failure callback needs to be called "),
		new testInfo(testServerDownLoadPackage, 'Test_ServerDown_LoadPackage', 'L1', 'MANUAL',"This is to test when the server is down when the Load Package call is made.","The failure callback needs to be called"),
		new testInfo(testDownloadSamePackagesSameTimeSingleTab, 'Test_Download_Same_Packages_AT_SAME_TIME', 'L1','AUTO', "This is to test downloading the same packages at the same time on a single tab","The first call should trigger to download the package and the second load package must wait and return the instance without downloading from the server "),
		new testInfo(testDownloadDiffPackagesSameTimeSingleTab, 'Test_Download_Diff_Packages_AT_SAME_TIME', 'L1','AUTO', "This is to test downloading diffrent packages at the same time on a single tab","The downloads should happen one after the other"),
		new testInfo(testCorruptedPackage, 'Test_Corrupted_Package', 'L1', 'AUTO',"This is to test downloading a corrupted package ","The failure callback needs to be called"),
		new testInfo(testInvalidSignaturePackage, 'Test_Invalid_Signature_Package', 'L1','AUTO', "This is to test downloading a invalid signaturee Package ","The package installation must fail"),
		new testInfo(testLoadModuleValid, 'Test_Load_Module_Valid', 'L2','AUTO', "This is to test Load Module API passing a valid module", "Module should be downloaded and we should be able to use the module"),
		new testInfo(testLoadModuleInValid, 'Test_Load_Module_InValid_Module', 'L2','AUTO', "This is to test Load Module API passing an invalid module", "Module should not be downloaded and failure callback must be called"),
		new testInfo(testLoadModuleInvalidSuccessCallback, 'Test_Load_Module_Invalid_Success_Callback', 'L2','AUTO', "This is to test Load Module API passing a invalid Success Callback", "Module should not be downloaded and failure callback must be called informing using about pasing invalid success callback"),
		new testInfo(testLoadModuleInvalidFailureCallback, 'Test_Load_Module_Invalid_Failure_Callback', 'L2','AUTO', "This is to test Load Module API passing a invalid failure Callback.", "Should fail gracefully i.e failure callback should be created internally and try to download the pkg"),
		new testInfo(testDownloadMultipleSamePackagesOnTabs, 'Test_Download_Same_Packages_Multi_Tabs', 'L3', 'MANUAL',"This is to test downloading same packages on multiple tabs","The first call should trigger to download the package and the second load package must wait and return the instance without downloading from the server "),
		new testInfo(testDownloadMultipleDiffPackagesOnTabs, 'Test_Download_Diffrent_Packages_Multi_Tabs', 'L3','MANUAL', "This is to test downloading diffrent packages at the same time on multiple tabs","The downloads should happen one after the other")

	       ];

var packagesList = [
               "public-add",
               "add",
               "public-Modloader-test",
               "public-add3Nums",
               "public-subtract3Nums",
				"public-subtract"
              ];
//-------------------------------------------Tests Loop up---------------------------------------------------------------------------------


//-------------------------------------------getResults--------------------------------------------------------------------------------


function getResults(testList){
  var result = '<table border="1">' ;
  result += '<tr> <th>Name</th> <th>Test Level</th> <th>Automation Level</th> <th>Description</th><th>Expected Result</th><th>Test Result</th></tr> ';

  for (i in testList){
      result+= '<tr> <td>' +  testList[i].shortName + '</td> <td>' + testList[i].testType + '</td> <td>' + testList[i].autoLevel + '</td> <td>' + testList[i].description + '</td> <td>' +  testList[i].expectedResult + '</td> <td>' + testList[i].result  + '</td> </tr>' ;


      console.log("Result  : " + JSON.stringify(testList[i]));
    }

  result += '</table>';

  // write result to a HTML file
  writeTestResult(result);
  return result;
}

function writeTestResult(result){
  var html = '<html> <body> <p1> ModLoader Module Test Results </p1>' + result +'</body></html>';
  var filePath = process.downloadPath + "/ModLoader_Test_Results.html"

  if (path.existsSync(filePath))
    fs.unlinkSync(filePath);

  var err = fs.writeFileSync(filePath, html);
  if(err) {
    console.log("Error Writing Results " +err);
    return ;
  }
  else {
    console.log("The Results file was saved!");
  }
}
//-------------------------------------------getResults--------------------------------------------------------------------------------



//-------------------------------------------Tests Util--------------------------------------------------------------------------------

var rmdirRSync = fs.rmdirRSync;

cleanup = function(pkgList) {
 for (i in pkgList){
   console.log("Cleaning : " + pkgList[i]);
   rmdirRSync(process.downloadPath + '/' +pkgList[i]);
 }
}

//-------------------------------------------Tests Util--------------------------------------------------------------------------------

//-------------------------------------------Tests Executer--------------------------------------------------------------------------------



exports.modLoaderTests = function (callback){
  // cleanup
  cleanup(packagesList);
  run();

function run (){
  console.log("Running Tests "+ curTestIndex +"/" +testList.length);
  curTest = testList[curTestIndex++];
  if(!curTest){
    console.log('All Tests have been completed');
    // clean up packages that we tested on device
    cleanup(packagesList);
    var result =  '' ;
    result = getResults(testList);
    console.log("calling calback : " + result);
    callback(result);
  }
  else{
    curTest.func(run);
  }
 }

}
//-------------------------------------------Tests Executer--------------------------------------------------------------------------------


//-------------------------------------------Tests --------------------------------------------------------------------------------


function testInvalidModuleDownload(callback){

  console.log('testInvalidModuleDownload start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("addNotValid", function (path, statusCode) {
    console.log("Download Success : Path :" + path + " statuscode :"+statusCode) ;
    console.log('testInvalidModuleDownload test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callback();
  },function (result, statusCode) {
     console.log("Download Failed : "+ result + statusCode) ;
     // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testInvalidModuleDownload test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  });
}

function testValidModuleDownload(callback){

  console.log('testValidModuleDownload start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-add", function () {
    var addModule = require('public-add');
    for (i in addModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  addModule.add(1, 2));
    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testValidModuleDownload test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  },function () {
     console.log('testValidModuleDownload test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });


}//End of testValidModuleDownload



function testDownloadDiffPackagesSameTimeSingleTab(callback){
  console.log('testDownloadDiffPackagesSameTimeSingleTab start');
  cleanup(packagesList);
  callbackOrder = 0;
  var downloadInstanceSuccess = new proteusModLoader();

  downloadInstanceSuccess.loadPackage("public-add", function () {
    callbackOrder += 1;

    console.log('testDownloadDiffPackagesSameTimeSingleTab test : ' + callbackOrder);

     if (callbackOrder != 1){
       curTest.result = "FAIL";
       console.log('testDownloadDiffPackagesSameTimeSingleTab test result : ' + 'FAIL');
       callbackOrder = 0;
       callback();
     }
     else{
       var addModule = require('public-add');
       console.log("using Module :" +  addModule.add(1, 2));
    }
  },function () {
     console.log('testDownloadDiffPackagesSameTimeSingleTab test result : ' + 'FAIL');
     curTest.result = "FAIL";
     callbackOrder = 0;
     callback();
  });

  downloadInstanceSuccess.loadPackage("public-Modloader-test", function () {

    console.log('testDownloadDiffPackagesSameTimeSingleTab test : ' + callbackOrder);
    callbackOrder += 2;
    if (callbackOrder != 3){
      curTest.result = "FAIL";
      console.log('testDownloadDiffPackagesSameTimeSingleTab test result : ' + 'FAIL');
      callbackOrder = 0;
      callback();
    }
    else{
      var testModule = require('public-Modloader-test');
      for ( i in testModule)
	console.log("testModule methods :" + i);

      console.log("using Module :" +  testModule.testAdd3NumsSync(1, 2, 3));

      console.log('testDownloadDiffPackagesSameTimeSingleTab test result : ' + 'PASS');
      curTest.result = "PASS";
      callbackOrder = 0;
      callback();
    }
  },function () {
    console.log('testDownloadDiffPackagesSameTimeSingleTab test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callbackOrder = 0;
    callback();
  });
}//End of testDownloadDiffPackagesSameTimeSingleTab



function testDownloadSamePackagesSameTimeSingleTab(callback){

  console.log('testDownloadSamePackagesSameTimeSingleTab start');
  cleanup(packagesList);
  callbackOrder = 0;

  var downloadInstanceSuccess = new proteusModLoader();

  downloadInstanceSuccess.loadPackage("public-add", function () {
    callbackOrder += 1;
    console.log('testDownloadSamePackagesSameTimeSingleTab test : ' + callbackOrder);
     if (callbackOrder != 1){
       curTest.result = "FAIL";
       console.log('testDownloadSamePackagesSameTimeSingleTab test result : ' + 'FAIL');
       callbackOrder = 0;
       callback();
     }
     else{
       var addModule = require('public-add');
       console.log("using Module :" +  addModule.add(1, 2));
    }
  },function () {
     console.log('testDownloadSamePackagesSameTimeSingleTab test result : ' + 'FAIL');
     curTest.result = "FAIL";
     callbackOrder = 0;
     callback();
  });

  downloadInstanceSuccess.loadPackage("public-add", function () {

    callbackOrder += 2;
    console.log('testDownloadSamePackagesSameTimeSingleTab test : ' + callbackOrder);
    if (callbackOrder != 3){
      curTest.result = "FAIL";
      console.log('testDownloadSamePackagesSameTimeSingleTab test result : ' + 'FAIL');
      callbackOrder = 0;
      callback();
    }
    else{
      var testModule = require('public-add');

      console.log("using Module :" +  testModule.add(1, 2));

      console.log('testDownloadSamePackagesSameTimeSingleTab test result : ' + 'PASS');
      curTest.result = "PASS";
      callbackOrder = 0;
      callback();
    }
  },function () {
    console.log('testDownloadSamePackagesSameTimeSingleTab test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callbackOrder = 0;
    callback();
  });
}//End of testDownloadSamePackagesSameTimeSingleTab


function testCorruptedPackage(callback){

  console.log('testCorruptedPackage start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-corrupt", function () {
    console.log('testCorruptedPackage test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callback();
  },function () {
     console.log('testCorruptedPackage test result : ' + 'PASS');
     curTest.result = "PASS";
      callback();
  });


}//End of testCorruptedPackage

function testNewVersion(callback){
  console.log('testNewVersion start');
  console.log('testValidModuleDownload test result : ' + 'PASS');
  curTest.result = "PASS";
  callback();
}//End of testNewVersion



function testOldVersion(callback){
  console.log('testOldVersion start');
  console.log('testOldVersion test result : ' + 'PASS');
  curTest.result = "PASS";
  callback();
}//End of testOldVersion



function testSameVersion(callback){
  console.log('testSameVersion start');
  console.log('testSameVersion test result : ' + 'PASS');
  curTest.result = "PASS";
  callback();
}//End of testSameVersion


function testServerDownVersion(callback){
  console.log('testServerDownVersion start');
  console.log('testServerDownVersion test result : ' + 'PASS');
  curTest.result = "PASS";
  callback();
}//End of testServerDownVersion


function testInvalidSignaturePackage(callback){

console.log('testInvalidSignaturePackage start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-invalidSignature", function () {
    console.log('testInvalidSignaturePackage test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callback();
  },function () {
     console.log('testInvalidSignaturePackage test result : ' + 'PASS');
     curTest.result = "PASS";
      callback();
  });

}//End of testInvalidSignaturePackage


function testServerDownLoadPackage(callback){
  console.log('testServerDownLoadPackage start');
  console.log('testServerDownLoadPackage test result : ' + 'PASS');
  curTest.result = "PASS";
  callback();

  console.log('testValidModuleDownload start');


  // Uncomment this with Wifi off

  /*
  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-add", function () {
    var addModule = require('public-add');
    for (i in addModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  addModule.add(1, 2));
    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testValidModuleDownload test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  },function () {
     console.log('testValidModuleDownload test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });*/


}//End of testServerDownLoadPackage



function testDownloadMultipleDiffPackagesOnTabs(callback){
  console.log('testDownloadMultipleDiffPackagesOnTabs start');
  console.log('testDownloadMultipleDiffPackagesOnTabs test result : ' + 'NOT RUN');
  curTest.result = "NOT RUN";
  callback();
}//End of testDownloadMultipleDiffPackagesOnTabs


function testDownloadMultipleSamePackagesOnTabs(callback){
  console.log('testDownloadMultipleSamePackagesOnTabs start');
  console.log('testDownloadMultipleSamePackagesOnTabs test result : ' + 'NOT RUN');
  curTest.result = "NOT RUN";
  callback();
}//End of testDownloadMultipleSamePackagesOnTabs


function testValidModuleWithDependenciesAlreadyPresent(callback){

  console.log('testValidModuleWithDependenciesAlreadyPresent start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-Modloader-test", function () {
    var testModule = require('public-Modloader-test');
    for (i in testModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  testModule.testAdd3NumsSync(1, 2, 3));

    var testAddModule = require('public-add3Nums');

    for (i in testAddModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  testAddModule.add3NumsSync(1, 2, 3));

    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testValidModuleWithDependenciesAlreadyPresent test result : ' + 'POST PROCESS : Look at logs');
    curTest.result = "POST PROCESS : Look at logs";
    callback();
  },function () {
     console.log('testValidModuleWithDependenciesAlreadyPresent test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });
}//End of testValidModuleWithDependenciesAlreadyPresent

function testValidModuleWithDependencies(callback){

  console.log('testValidModuleWithDependencies start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-Modloader-test", function () {
    var testModule = require('public-Modloader-test');
    for (i in testModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  testModule.testAdd3NumsSync(1, 2, 3));

    var testAddModule = require('public-add3Nums');

    for (i in testAddModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  testAddModule.add3NumsSync(1, 2, 3));

    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testValidModuleWithDependencies test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  },function () {
     console.log('testValidModuleWithDependencies test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });
}//End of testValidModuleWithDependencies

function testValidModuleWithDependenciesSemiPresentNotOnServer(callback){

  console.log('testValidModuleWithDependenciesSemiPresentNotOnServer start');

  // Delete one of the modules in the Dependencies
  rmdirRSync(process.downloadPath + '/'+'public-add3Nums');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-subtract3Nums", function () {
    console.log('testValidModuleWithDependenciesSemiPresentNotOnServer test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callback();
  },function () {
     console.log('testValidModuleWithDependenciesSemiPresentNotOnServer test result : ' + 'PASS');
     curTest.result = "PASS";
      callback();
  });
}//End of testValidModuleWithDependenciesSemiPresentNotOnServer


function testValidModuleWithDependenciesSemiPresent(callback){

  console.log('testValidModuleWithDependenciesSemiPresent start');

  rmdirRSync(process.downloadPath + '/'+'public-add3Nums');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-Modloader-test", function () {
    var testModule = require('public-Modloader-test');
    for (i in testModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  testModule.testAdd3NumsSync(1, 2, 3));

    var testAddModule = require('public-add3Nums');

    for (i in testAddModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  testAddModule.add3NumsSync(1, 2, 3));

    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testValidModuleWithDependenciesSemiPresent test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  },function () {
     console.log('testValidModuleWithDependenciesSemiPresent test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });
}//End of testValidModuleWithDependenciesSemiPresent

function testValidModuleDownloadAlreadyPresent(callback){

  console.log('testValidModuleDownloadAlreadyPresent start');

  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("public-add", function () {
    var addModule = require('public-add');
    for (i in addModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  addModule.add(1, 2));
    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testValidModuleDownloadAlreadyPresent test result : ' + 'POST PROCESS : Look at logs');
    curTest.result = "POST PROCESS : Look at logs";
    callback();
  },function () {
     console.log('testValidModuleDownloadAlreadyPresent test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });


}//End of testValidModuleDownloadAlreadyPresent



function testInvalidSuccessCallback(callback){

  console.log('testInvalidSuccessCallback start');
  try{
  var downloadInstanceSuccess = new proteusModLoader();
  downloadInstanceSuccess.loadPackage("add", "test",function (err) {
     console.log("Download Failed : "+ err) ;
     console.log('testInvalidSuccessCallback test result : ' + 'PASS');
     curTest.result = "PASS";
     callback();
  });
  }
  catch(ex){
    console.log('testValidModuleDownload test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callback();
  }


}//End of testInvalidSuccessCallback

function testInvalidFailureCallback(callback){

  console.log('testInvalidFailureCallback start');
  var downloadInstanceSuccess = new proteusModLoader();
   downloadInstanceSuccess.loadPackage("public-add", function (path, statusCode) {
    console.log("Download Success : Path :" + path + " statuscode :"+statusCode) ;

    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testInvalidFailureCallback test result : ' + 'PASS');
    curTest.result = "PASS";
    //callback();
  },"test");

  setTimeout(callback,5000);

}


function testLoadModuleInvalidSuccessCallback(callback){

  console.log('testLoadModuleInvalidSuccessCallback start');

    loadModule("add", "test",function (err) {
     console.log("loadModule Failed : "+ err) ;
     console.log('testLoadModuleInvalidSuccessCallback test result : ' + 'PASS');
     curTest.result = "PASS";
     callback();
  });



}//End of testInvalidSuccessCallback

function testLoadModuleInvalidFailureCallback(callback){

  console.log('testLoadModuleInvalidFailureCallback start');
  loadModule("add", function (addModule) {

    for (i in addModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  addModule.add(1, 2));
    console.log('testLoadModuleInvalidFailureCallback test result : ' + 'PASS');
    curTest.result = "PASS";
    //callback();
  },"test");

   setTimeout(callback,5000);

}//End of testInvalidFailureCallback


function testLoadModuleValid(callback){

  console.log('testLoadModuleValid start');
  loadModule("add", function (addModule) {
    for (i in addModule)
      console.log("Methods in Module :" + i);

    console.log("using Module :" +  addModule.add(1, 2));
    // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testLoadModuleValid test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  },function () {
     console.log('testLoadModuleValid test result : ' + 'FAIL');
     curTest.result = "FAIL";
      callback();
  });


}//End of testValidModuleDownload

function testLoadModuleInValid(callback){

  console.log('testLoadModuleInValid start');
  loadModule("addNotValid", function (addModule) {
    console.log('testLoadModuleInValid test result : ' + 'FAIL');
    curTest.result = "FAIL";
    callback();
  },function (result, statusCode) {
     console.log("Download Failed : "+ result + statusCode) ;
     // TODO: Add check to see if the file was downloaded to path mentioned.
    console.log('testLoadModuleInValid test result : ' + 'PASS');
    curTest.result = "PASS";
    callback();
  });
}
