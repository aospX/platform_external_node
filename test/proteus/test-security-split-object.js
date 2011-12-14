var assert = require('assert');
var APIObject = require('./test-security-split-object-module.js').APIObject;

var apiObject = new APIObject();
assert.ok(apiObject.api(), 105);

// change apiObject, but it will not since its frozen
apiObject.api = function() {
  return 1000;
}

// check that you cannot change functions on API object
assert.ok(apiObject.api(), 105);

//check that you cannot add new properties on API object
apiObject.hack = 100;
assert.notEqual(apiObject.hack, 100);
