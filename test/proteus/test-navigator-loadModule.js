var assert = require('assert');
assert.ok(process);


// check we do not expose loadModule, or have navigator object
assert.ok(typeof navigator === 'undefined');
assert.ok(typeof loadModule === 'undefined');
//assert.ok(test.loadModule);

//var loadModule = test.loadModule;

// check that we cannot use navigator.loadModule to load a core module
//assert.throws(function(){ loadModule('fs'); });

// check that we can use require to load a core module (but only from a proteus installed module,
// which the this test module is)
var fs = require('fs');
assert.ok(fs);

var path = require('path');
assert.ok(path);

function createDirIfRequired(module, userequire) {
  var relative = false;
  if (module.charAt(0) == '.') {
    relative = true;
  }

  // fs.write writes wrt to the executable, we want wrt to the current module
  var basedir;
  if (relative) {
    // require is guaranteed to have parent since it can only be called from a module
    // and not user code
    if (userequire) {
      basedir = path.dirname(__filename); //FIXME: process.__filename is not reliable
    } else { // for loadModule parent is not there so use relative path from proteuspath
      basedir = process.proteusPath;
    }
  } else {
    basedir = process.proteusPath;
  }
 
  var filename = path.resolve(basedir, module);
  var moduledir = path.dirname(filename);
  console.log("*********** ensuring directory " + moduledir);
  try {
      fs.unlinkSync(moduledir);
  } catch (e) {console.log(e);}
 
  try {
    fs.mkdirSync(moduledir, 0777);
  } catch (e) { console.log(e); }
 
  console.log("basedir: " + basedir + " moduledir: " + moduledir + " filename: " + filename);
  return filename;
}

// loading relative path
function verifyLoad(module, userequire) {
  console.log("***** module: " + module + " userrequire: " + userequire);
  var filename = createDirIfRequired(module, userequire);
  var random = Math.floor(Math.random() * 1000);
  fs.writeFileSync(filename, "exports.val = " + random + ";");
  var mod;
  if (userequire) {
    mod = require(module);
  } else {
    mod = loadModule(module);
  }
  assert.ok(mod);
  console.log("mod.val " + mod.val + " random: " + random);
  assert.ok(mod.val == random);
  fs.unlinkSync(filename);
}

//verifyLoad('test/simple/a.js', false);

// ------------------------------checking require ------------------------
// assume the current module is atleast two levels deep from the proteus Module path
verifyLoad('./mod1.js', true);
verifyLoad('./a/mod2.js', true);
verifyLoad('mod3.js', true);
verifyLoad('a/mod4.js', true);
verifyLoad('a/b/mod5.js', true);
verifyLoad('../mod6.js', true);
verifyLoad('../a/mod7.js', true);
verifyLoad('../a/b/mod8.js', true);

// relative load outside the module path
assert.throws(function(){ verifyLoad('../../../mod.js', true); });

// load outside the module paths should fail, assume /tmp is writable
assert.throws(function(){ verifyLoad('/tmp/mod.js', true);});

// create a core module and check that we can access it from the current proteus module
verifyLoad(process.corePath + '/core.js', true);

// Test that we can lookup parent directories using require
var filea = createDirIfRequired('a/a.js', true);
fs.writeFileSync(filea, 'exports.a = 101;');
var fileb = createDirIfRequired('a/b/b.js', true);
fs.writeFileSync(fileb, "var a = require('../a.js'); exports.b = a.a;");
var modb = require('a/b/b.js');
assert.ok(modb && modb.b == 101);

/* loadModule is not available to modules now
// ------------------------------checking loadModule------------------------
// we use different name (mod2) since otherwise we will get cached results
assert.throws(function() {verifyLoad('./mod11.js', false);}); // use loadModule
assert.throws(function() {verifyLoad('./a/mod11.js', false);}); // use loadModule
verifyLoad('mod13.js', false);
verifyLoad('a/mod14.js', false);
verifyLoad('a/b/mod15.js', false);
assert.throws(function() {verifyLoad('../mod16.js', false);});

// Test that we cannot lookup parent directories using loadModule
var filea = createDirIfRequired('c/c.js', false);
fs.writeFileSync(filea, 'exports.c = 101;');
var fileb = createDirIfRequired('c/d/d.js', false);
fs.writeFileSync(fileb, "var c = loadModule('../c.js'); exports.d = c;");
assert.throws(function() {var modb = loadModule('c/d/d.js');});
*/

//To be enhanced
