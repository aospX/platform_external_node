exports.browserTimerFired = false;
var assert = require('assert');
var count = 0;
var nodeTimerFired = false;
setInterval(function() {
    console.log("** Node Timer fired");
    if (count++ == 5) {
       nodeTimerFired = true;
    }
}, 5);

setTimeout(function() {
    console.log("** Test Timer fired");
    assert.ok(nodeTimerFired);
    if (process.browser) {
        assert.ok(exports.browserTimerFired);
    }
    process.exit();
}, 100);
