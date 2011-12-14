var assert = require('assert').ok;
function match(path) {
  return /^\s*[\w]+[\w\.\\]*/.test(path);
}

// single file
assert(match('a'));
assert(match('a/'));
assert(match('a.js'));
assert(match('a.b.js'));

// relative to root
assert(match('a/b.js'));
assert(match('a/c/b.js'));

// white spaces
assert(match(' a'));
assert(match(' a.js'));
assert(match('  a.b.js'));

assert(!match('/a'));
assert(!match('/a/b/c'));
assert(!match('../a'));
assert(!match('../a.js'));
assert(!match('./a.js'));
assert(!match('./a/b.js'));
assert(!match('./a/b.js'));
assert(!match('  ./a/b.js'));




