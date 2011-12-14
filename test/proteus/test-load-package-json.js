var assert = require('assert');
var putil = require('./proteus-util.js');

// test loading modules that have package.json through require
putil.createFile('mymodule/package.json', '{\"main\":\"src/mainmodule.js\"}');
putil.createFile('mymodule/lib/module2.js', 'exports.module2 = 112');
putil.createFile('mymodule/src/module3.js', 'exports.module3 = 115');
putil.createFile('mymodule/src/mainmodule.js', "exports.mainmodule = 111; exports.module2 = require('../lib/module2').module2; exports.module3 = require('./module3.js').module3;");

var module = require('mymodule');
assert.ok(module.mainmodule == 111);
assert.ok(module.module2 == 112);
assert.ok(module.module3 == 115);
