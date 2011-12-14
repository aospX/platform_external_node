var assert = require('assert');
var simple = require('./test-simple-module.js');
console.log('js return = ' + simple.jscall);
assert.equal(simple.jscall, 42);

