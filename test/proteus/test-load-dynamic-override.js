var assert = require('assert');
var fs = require('fs');

// delete the file
var file = process.downloadPath + '/http';
try { fs.unlinkSync(file); } catch (e){}

// check if are able to load http builtin module
var http = require('http');
assert.ok(http.value == undefined);

// check if we can override it
fs.writeFileSync(file, "exports.value = 101");
var http = require('http');
console.log("http.value = " + http.value);
assert.ok(http.value == 101);

// clear the module cache
test.clearDynamicModuleCache();

// delete the dynamic module and load again, it should
// load the builtin module
try { fs.unlinkSync(file); } catch (e){}
var http = require('http');
assert.ok(http.value == undefined);
