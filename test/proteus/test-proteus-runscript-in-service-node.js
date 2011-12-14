var assert = require('assert');
var fs = require('fs');

fs.writeFileSync(process.downloadPath + '/public-testmodule.js', "exports.val = 155;");
var result = test.runScript(
    "loadModuleSync('testmodule').val;");
assert.ok(result == 155);
        
var result2 = test.runScript(
    "loadModuleSync('testmodule').val;");
assert.ok(result2 == 155);

fs.writeFileSync(process.downloadPath + '/public-testmodule2.js', "exports.val = 157;");
var result = test.runScript(
    "loadModuleSync('testmodule2').val;");
assert.ok(result == 157);
