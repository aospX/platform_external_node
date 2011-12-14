var fs = require('fs');
var assert = require('assert');

var path = 'b/c/d/e';
var root = process.downloadPath;
console.log("root = " + root + " path = " + path);

fs.mkdirsSync(root, path, 0755);
fs.statSync(root + '/' + path);

fs.rmdirsSync(root, path);
assert.throws(function() { fs.statSync(root + '/' + path) });
