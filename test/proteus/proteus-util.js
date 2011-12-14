var assert = require('assert');
var fs = require('fs');
var path = require('path');

function createDirIfRequired(file) {
  var moduledir = path.dirname(file);
  console.log("proteus-util, createDirIfRequired, creating dir: " + moduledir);

  try {
    fs.ensureDirSync(moduledir, 0755);
  } catch (e) { console.log(e); }
}

exports.createFile = function(file, content) {
  if (file.charAt(0) != '/') {
    file = process.downloadPath + '/' + file;
  }
  createDirIfRequired(file);
  fs.writeFileSync(file, content);
}

exports.rands = function(size) {
  if (size == undefined) size = 3;

  // Math.random returns between 0 and 1, so the first two chars would be 0. we ignore those
  return Math.random().toString(36).substring(2, size + 2);
}
