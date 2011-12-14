//This tests needs to be run manually
//build dynamic module go to modules/node-extension-examples/ and build.sh..


var assert = require('assert');
var fs = require('fs');

var helloworld_native = require('helloworld');
var hi = new helloworld_native.HelloWorld();
console.log(hi.hello()); // prints "Hello World" to stdout
assert.equal(hi.hello(), "Hello World Dynamic");

//FIXME: we should delete the dir
var dir = process.downloadPath + '/helloworld';
var renamedir = process.downloadPath + '/helloworld_rename';
try { fs.renameSync(dir,renamedir);} catch (e){console.log("Error!!!!" + e)}

// clear the module cache
test.clearDynamicModuleCache();

var helloworld_native = require('helloworld');
var hi = new helloworld_native.HelloWorld();
console.log(hi.hello()); // prints "Hello World" to stdout
assert.equal(hi.hello(), "Hello World Static");

//rename it back
try { fs.renameSync(renamedir, dir);} catch (e){console.log("Error!!!!" + e)}
