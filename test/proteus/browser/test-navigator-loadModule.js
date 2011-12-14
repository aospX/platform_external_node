// if running in browser ensure that loadModule is available on the navigator object
// and process is not exposed
navigator.loadModule('test', function(test) {
    var require = test.require;
    var assert = require('assert');
    assert.ok(typeof process === 'undefined');
    assert.throws( function() {
      navigator.loadModule('fs'); //this should throw an error
      });
    assert.ok(typeof Buffer === 'undefined');

    var process = test.process;
    var path = require('path');
    var fs = require('fs');
    var console = require('console');

    function createDirIfRequired(module) {
    var relative = false;
    if (module.charAt(0) == '.') {
    relative = true;
    }

    var basedir = process.downloadPath;
    var filename = path.resolve(basedir, module);
    var moduledir = path.dirname(filename);
    console.log("*********** ensuring directory " + moduledir);
    try {
      fs.mkdirSync(moduledir, 0777);
    } catch (e) {console.log(e);}

    console.log("basedir: " + basedir + " moduledir: " + moduledir + " filename: " + filename);
    return filename;
    }

    // loading relative path
    function verifyLoad(module) {
      console.log("***** module: " + module);
      var filename = createDirIfRequired('public-' + module);
      var random = Math.floor(Math.random() * 1000);
      try {fs.unlinkSync(filename)} catch (e) {}
      fs.writeFileSync(filename, "exports.val = " + random + ";");
      navigator.loadModule(module, function(mod) {
          assert.ok(mod);
          console.log("mod.val " + mod.val + " random: " + random);
          assert.ok(mod.val == random);
          fs.unlinkSync(filename);
          });
    }

    verifyLoad('loadModule.js', false);
});


//To be enhanced
