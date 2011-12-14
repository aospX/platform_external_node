var putil = require('./proteus-util.js');
var fs = require('fs');
var assert = require('assert');

var file = process.proteusPath + '/hello/world/test.js';
var text = 'proteus is coool';
putil.createFile(file, text);
var readback = fs.readFileSync(file);
assert.ok(readback == text);
