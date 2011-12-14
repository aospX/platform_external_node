//FIXME
//var proteusUnzip = require('../lib/proteusUnzip.js');
var proteusUnzip = require('proteusUnzip');
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var testNumber = 0;
var curTest ;
var curTestIndex = 0;

var TEST_PATH='/data/data/com.android.browser/.proteus/downloads/';
var UNZIP_LOC='/data/data/com.android.browser/.proteus/downloads/unzip-test/';

//-------------------------------------------Tests Loop up---------------------------------------------------------------------------------

function testInfo (func, shortName, type, level, description ,expectedResult) {

    this.shortName =  shortName;
    this.testType = type,
    this.autoLevel = level,
    this.func = func ,
    this.description = description ;
    this.result = "Not Run";
    this.expectedResult = expectedResult;

    function setResult(res)
    {
      this.result = res;
    }

}

var testList = [
		new testInfo(testValidZipFile, 'Test_Valid_ZipFile', 'L1', 'AUTO',"This is to test passing a valid zip file to unzip","The zip file should be successfully decompressed and the result should be true"),
		new testInfo(testValidZipBuffer, 'Test_Valid_Zip_Buffer','L1','AUTO', "This is to test passing a valid zip buffer to unzip","The zip buffer should be successfully decompressed and the result should be true"),
		new testInfo(testCorruptedZipFile, 'Test_Corrupted_Zip_File','L1','AUTO', "This is to test passing a corrupted zip file to unzip","The zip file should be not be decompressed and the result should be false"),
		new testInfo(testCorruptedZipBuffer, 'Test_Corrupted_Zip_Buffer','L1', 'AUTO',"This is to test passing a corrupted zip buffer to unzip","The zip buffer should  not be decompressed and the result should be false"),
		new testInfo(testInvalidZipFilePath, 'Test_Invalid_Zip_File_Path','L1', 'AUTO',"This is to test passing a Invalid Zip file Path to unzip","The zip file should  not be decompressed and the result should be false "),
		new testInfo(testInvalidDestinationWithBuffer, 'Test_Invalid_Destiantion_with_buffer','L1', 'AUTO',"This is to test passing Invalid Destiantion to unzip","The zip buffer should  not be decompressed and the result should be false"),
		new testInfo(testInvalidDestinationWithFile, 'Test_Invalid_Destiantion_with_File','L1','AUTO', "This is to test passing Invalid Destiantion to unzip","The zip file should  not be decompressed and the result should be false"),
		new testInfo(testExistingContentsWithFile, 'Test_Existing_Contents_with_File','L1', 'AUTO',"This is to test passing File which is already  unziped in location","The zip file should  decompressed after deleting existing contents and the result should be true"),
		new testInfo(testExistingContentsWithBuffer, 'Test_Existing_Contents_with_Buffer','L1','AUTO', "This is to test passing buffer which is already  unziped in location","The zip buffer should  decompressed after deleting existing contents and the result should be true")
	       ];

//-------------------------------------------Tests Loop up---------------------------------------------------------------------------------


//-------------------------------------------getResults--------------------------------------------------------------------------------

function getResults(testList){
  var result = '<table border="1">' ;
  result += '<tr> <th>Name</th> <th>Test Level</th>  <th>Automation Level</th> <th>Description</th><th>Expected Result</th><th>Result</th></tr> ';

  for (i in testList){
      result+= '<tr> <td>' +  testList[i].shortName + '</td> <td>' + testList[i].testType + '</td> <td>' + testList[i].autoLevel + '</td> <td>' + testList[i].description + '</td> <td>' +  testList[i].expectedResult + '</td> <td>'  +  testList[i].result  + '</td> </tr>' ;


      console.log("Result  : " + JSON.stringify(testList[i]));
    }

  result += '</table>';

  // write result to a HTML file
  writeTestResult(result);
  return result;
}

function writeTestResult(result){
  var html = '<html> <body> <p1> Unzip Module Test Results </p1>' + result +'</body></html>';
  var filePath = process.downloadPath + "/Unzip_Module_Test_Results.html";

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
var rmdirRSync = fs.rmdirRSync;

//-------------------------------------------Tests Util--------------------------------------------------------------------------------


//-------------------------------------------Tests Util--------------------------------------------------------------------------------

//-------------------------------------------Tests Executer--------------------------------------------------------------------------------



exports.unzipTests = function (callback){
  run();

 if (!path.existsSync(UNZIP_LOC)){
    fs.mkdirSync(UNZIP_LOC, 0777)
 }

function run (){
  console.log("Running Tests "+ curTestIndex +"/" +testList.length);
  curTest = testList[curTestIndex++];
  if(!curTest){
    console.log('All Tests have been completed');
    rmdirRSync(UNZIP_LOC);
    var result = getResults(testList);
    callback(result);
  }
  else{
    curTest.func(run);
  }
 }

}
//-------------------------------------------Tests Executer--------------------------------------------------------------------------------


//-------------------------------------------Tests --------------------------------------------------------------------------------


function testCorruptedZipBuffer(callback){

  console.log('testCorruptedZipBuffer start');

  fs.readFile(TEST_PATH + 'proteusUnzip/test/invalid.zip', function (err, data) {
  if (err){
    console.log('Error reading Zip File') ;
    console.log('testCorruptedZipBuffer test : ' + 'FAIL');
    curTest.result = "FAIL";

    // cleanup
    rmdirRSync(UNZIP_LOC);
    callback();
    return;
  }
  if (data){

    var buffer = new Buffer(data , 'base64');
    var result = proteusUnzip.decompressZipBuffer(buffer,UNZIP_LOC);
  console.log("decompressZip result" + result) ;

  console.log('testCorruptedZipBuffer end');
    }
    if (result == false)
    {
      console.log('testCorruptedZipBuffer test result : ' + 'PASS');
      curTest.result = "PASS";
    }
    else{
      console.log('testCorruptedZipBuffer test result : ' + 'FAIL');
      curTest.result = "FAIL";
    }
  // cleanup
  rmdirRSync(UNZIP_LOC);

  callback();

});


}//End of testCorruptedZipBuffer



function testValidZipBuffer(callback){

  console.log('testValidZipBuffer start');

  fs.readFile(TEST_PATH + 'proteusUnzip/test/valid.zip', function (err, data) {
  if (err){
    console.log('Error reading Zip File') ;
    curTest.result = "FAIL";

  // cleanup
  rmdirRSync(UNZIP_LOC);
    callback();
    return;
  }
  if (data){
    var buffer = new Buffer(data , 'base64');
    var result = proteusUnzip.decompressZipBuffer(buffer,UNZIP_LOC);
    console.log("decompressZip result" + result) ;

  console.log('testValidZipBuffer end');

  if (result){
     // check if one file from zip is created.
    if (path.existsSync(UNZIP_LOC+'1/2/3/3')){
        console.log('testValidZipBuffer test result : ' + 'PASS');
      curTest.result = "PASS";
    }
  }
  else{
    console.log('testValidZipBuffer test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }


  // cleanup
  rmdirRSync(UNZIP_LOC);
  callback();
  }
});


}//End of testValidZipBuffer


function testExistingContentsWithFile(callback){

  console.log('testExistingContentsWithFile start');

  var result = proteusUnzip.decompressZipFile(TEST_PATH + 'proteusUnzip/test/valid.zip',UNZIP_LOC);
  console.log("decompressZip result" + result) ;


  if (result)
  {
    var result = proteusUnzip.decompressZipFile(TEST_PATH + 'proteusUnzip/test/valid.zip','/data/data/com.android.browser/test');
    console.log('testExistingContentsWithFile end');

    if (result)
    {
      // check if one file from zip is created.
      if (path.existsSync(UNZIP_LOC+'1/2/3/3')){
	console.log('testExistingContentsWithFile test result : ' + 'PASS');
	curTest.result = "PASS";
      }
    }
  }
  else{
    console.log('testExistingContentsWithFile test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }

  // cleanup
  rmdirRSync(UNZIP_LOC);

  callback();

}//End of testExistingContentsWithFile


function testExistingContentsWithBuffer(callback){

  console.log('testExistingContentsWithBuffer start');

  fs.readFile(TEST_PATH + 'proteusUnzip/test/valid.zip', function (err, data) {
  if (err){
    console.log('Error reading Zip File') ;
    curTest.result = "FAIL";

  // cleanup
  rmdirRSync(UNZIP_LOC);
    callback();
    return;
  }
  if (data){
    var buffer = new Buffer(data , 'base64');
    var result = proteusUnzip.decompressZipBuffer(buffer, UNZIP_LOC);
  console.log("decompressZip result" + result) ;


  if (result){

     // call it the second time
     var result = proteusUnzip.decompressZipBuffer(data, UNZIP_LOC);

     console.log('testExistingContentsWithBuffer end');

      if (result){

	console.log('in  result');

	// check if one file from zip is created.
	if (path.existsSync(UNZIP_LOC+'1/2/3/3')){

	  curTest.result = "PASS";
	  console.log('testExistingContentsWithBuffer test result : ' + 'PASS');
	}
      }

    }
  else{
    console.log('testExistingContentsWithBuffer test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }


  // cleanup
  rmdirRSync(UNZIP_LOC);
  callback();
  }
});


}//End of testExistingContentsWithBuffer



function testCorruptedZipFile(callback){

  console.log('testCorruptedZipFile start');

  var result = proteusUnzip.decompressZipFile(TEST_PATH + 'proteusUnzip/test/invalid.zip',UNZIP_LOC);
  console.log("decompressZip result" + result) ;

  console.log('testCorruptedZipFile end');

  if (result == false)
  {
      curTest.result = "PASS";
        console.log('testCorruptedZipFile test result : ' + 'PASS');
  }
  else{
    curTest.result = "FAIL";
      console.log('testCorruptedZipFile test result : ' + 'FAIL');
  }

  // cleanup
  rmdirRSync(UNZIP_LOC);

  callback();

}//End of testCorruptedZipFile


function testValidZipFile(callback){

  console.log('testValidZipFile start');

  var result = proteusUnzip.decompressZipFile(TEST_PATH + 'proteusUnzip/test/valid.zip',UNZIP_LOC);
  console.log("decompressZip result" + result) ;

  console.log('testValidZipFile end');

  if (result)
  {
    // check if one file from zip is created.
    if (path.existsSync(UNZIP_LOC+'1/2/3/3')){
        console.log('testValidZipFile test result : ' + 'PASS');
      curTest.result = "PASS";
    }
  }
  else{
    console.log('testValidZipFile test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }

  // cleanup
  rmdirRSync(UNZIP_LOC)

  callback();

}//End of testValidZipFile


function testInvalidZipFilePath(callback){
  console.log('testInvalidZipFilePath start');

  var result = proteusUnzip.decompressZipFile(TEST_PATH + 'proteusUnzip/test/notknowninvalid.zip','/data/data/com.android.browser/test');

  if (result == false)
  {
      curTest.result = "PASS";
      console.log('testInvalidZipFilePath test result: ' + 'PASS');

  }
  else{
    console.log('testInvalidZipFilePath test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }

  // cleanup
  rmdirRSync(UNZIP_LOC);

  callback();


}//End of testInvalidZipFilePath

function testInvalidDestinationWithBuffer(callback){
 console.log('testInvalidDestinationWithBuffer start');

  fs.readFile(TEST_PATH + 'proteusUnzip/test/valid.zip', function (err, data) {
  if (err){
    console.log('Error reading Zip File') ;
    curTest.result = "FAIL";

  // cleanup
  rmdirRSync(UNZIP_LOC);
    callback();
    return;
  }
  if (data){
     var buffer = new Buffer(data , 'base64');
    var result = proteusUnzip.decompressZipBuffer(buffer,'/data/data/');
  console.log("decompressZip result" + result) ;

  console.log('testInvalidDestinationWithBuffer end');

  if (result == false){
        console.log('testInvalidDestinationWithBuffer test result : ' + 'PASS');
      curTest.result = "PASS";
  }
  else{
    console.log('testInvalidDestinationWithBuffer test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }

  callback();
  }
});

}//End of testInvalidDestinationWithBuffer


function testInvalidDestinationWithFile(callback){

  console.log('testInvalidDestinationWithFile start');

  var result = proteusUnzip.decompressZipFile(TEST_PATH + 'proteusUnzip/test/valid.zip','/data/data/');
  console.log("decompressZip result" + result) ;

  console.log('testInvalidDestinationWithFile end');

  if (result == false)
  {
        console.log('testInvalidDestinationWithFile test result : ' + 'PASS');
      curTest.result = "PASS";

  }
  else{
    console.log('testInvalidDestinationWithFile test result : ' + 'FAIL');
    curTest.result = "FAIL";
  }


  callback();

}//End of testValidZipFile
//
