// put something in the global object
var language = 'indian';
navigator.loadModule('test', function(testmod) {
    try {
    testmod.test.start('test-window-access-in-module.js');
    var require = testmod.require;
    var fs = require('fs');
    var console = require('console');
    var assert = require('assert');
    var file = testmod.process.downloadPath + '/testmodule.js';
    fs.writeFileSync(file, "exports.language = process.window.language;");
    console.log("language read from the module: " + require('testmodule').language);
    assert.ok( require('testmodule').language == language);
    fs.unlinkSync(file);
    } catch (e) {
       console.log(e.stack);
       testmod.test.fail();
    }
    });
