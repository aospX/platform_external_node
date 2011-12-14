var map = {};
var assert = require('assert');

APIObject = function() {
  var iobj = new InternalObject();
  map[this] = iobj;
  Object.freeze(this);
}

APIObject.prototype.api = function () {
  assert.ok(map[this]); // ensure this object is in the map
  return map[this].api();
}

Object.freeze(APIObject.prototype); // freeze APIObject prototype

InternalObject = function() {
  this.internal = 105; // internal values..
}

InternalObject.prototype.api = function() {
  return this.internal;
}

exports.APIObject = APIObject;
