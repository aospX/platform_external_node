var fs = require('fs');
var assert = require('assert');
var wfd = fs.openSync('_', 'w');
var written = fs.writeSync(wfd, 'hello world');
assert.ok(written == 11);
fs.close(wfd);

var fd = fs.openSync('_', 'r');
var reads = 0;
var cancels = 0;

// 5 reads without cancelling
function test1() {
  for (var i = 1; i <= 5; i++) {
    console.log('read request' + i);
    fs.read(fd, written, 0, 'utf-8', function(err, str, bytesRead) {
        console.log("read callback - test1");
        // we use timeout to call next test since the last watcher
        // is not yet removed from the list and we will go in a bad state
        if (++reads == 5) setTimeout(test2, 0);
        });
  }
}

// 4 read requests, and immediately cancel all of them
function test2() {
  for (var i = 1; i <= 4; i++) {
    fs.read(fd, written, 0, 'utf-8', function(err, str, bytesRead) {
        console.log("read callback - test2");
        ++reads;
        });
  }
  // This calls exit handler..
  test.deleteNode();
}

test1();

process.on('fsWatcherCancelled', function() {
    console.log('fsWatcherCancelled event');
    cancels++;
});

process.on('exit', function() {
  fs.release(); // release the module, including cancelling any watchers..
  assert.equal(reads, 5);
  assert.equal(cancels, 4);
});


