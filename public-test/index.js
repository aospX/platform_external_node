exports.runTest = function(request) {
  try {
    console.log("runTest: " + request);
    test.start(request);
    require(request);
    test.check();
  } catch (e) {
    console.log("runTest: " + request + " threw exception");
    console.error("\n" + e.stack);
    test.fail();
  }
}

exports.require = require;
exports.process = process;
exports.test = test;
