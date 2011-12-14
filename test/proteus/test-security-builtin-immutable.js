var assert = require('assert');

function checkImmutable(obj) {
  var properties = Object.getOwnPropertyNames(obj);
  console.log('properties on object \'' + obj + "\' = " + properties);

  var copy = {};
  for (var key in properties) {
    prop = properties[key];
    copy[prop] = obj[prop];
  }

  // screw up the object
  for (var key in properties) {
    prop = properties[key];
    obj[prop] = null;
  }

  // add a dummy property
  try {
    obj['myprop'] = 110;
  } catch (e) { console.log("Exception in adding myprop: " + e); }

  // check if its unchanged
  for (var key in properties) {
    prop = properties[key];
    if (obj[prop] != copy[prop]) {
      console.log("********* Property changed " + prop + "on object " + obj);
    }
    assert.ok(obj[prop] == copy[prop]);
  }

  assert.notEqual(obj['myprop'] == 110);
}

checkImmutable(Object);
checkImmutable(Object.prototype);
checkImmutable(String);
checkImmutable(String.prototype);
checkImmutable(Function);
checkImmutable(Function.prototype);
checkImmutable(Array);
checkImmutable(Array.prototype);
checkImmutable(Boolean);
checkImmutable(Boolean.prototype);
checkImmutable(Math);
checkImmutable(Date);
checkImmutable(Date.prototype);
//checkImmutable(RegExp);
checkImmutable(RegExp.prototype);


