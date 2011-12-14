navigator.loadModule('test', function(testmod) {
    testmod.test.start('test-loadmodule-invalid-args.js');
    var assert = testmod.require('assert');
    var process = testmod.process;
    assert.throws(function() {navigator.loadModule('test/simple/testmod-fs-read.js');});
    assert.throws(function() {navigator.loadModule();});
    assert.throws(function() {navigator.loadModule({});});
    assert.throws(function() { navigator.loadModule( {a:b}); });
    var putil = testmod.require('test/proteus/proteus-util.js');
    putil.createFile(process.downloadPath + '/public-x/index.js', 'exports.value = 42');
    assert.throws(function() {navigator.loadModule(x);});
    navigator.loadModule('x', function(xmod) {
      assert.ok(xmod.value == 42);
      var console = testmod.require('console');
      console.log("testmod testmod-loadmodule-invalid-args.js done");
      testmod.test.check();
      });
    }
    );

