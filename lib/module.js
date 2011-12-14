// Copyright Joyent, Inc. and other Node contributors.
// Copyright (c) 2011, Code Aurora Forum. All rights reserved.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var NativeModule = require('native_module');
var Script = process.binding('evals').NodeScript;
var runInThisContext = Script.runInThisContext;
var runInNewContext = Script.runInNewContext;
var assert = require('assert').ok;

function Module(id, parent, trusted) {
  this.id = id;
  // \proteus\ we create exports as a js object that can hold internal fields
  // as opposed to pure js object, this is to maitain the association
  // between the node instance and the module
  this.exports = process.createExportsObject();
  this.parent = parent;

  this.filename = null;
  this.loaded = false;
  this.exited = false;
  this.children = [];

  // proteus, maintain if the module is trusted or not
  // e.g trusted modules have access to require
  this.trusted = trusted;
}
module.exports = Module;

// Set the environ variable NODE_MODULE_CONTEXTS=1 to make node load all
// modules in thier own context.
// proteus: NODE_MODULE_CONTEXTS disabled
Module._cache = {};
Module._pathCache = {};
Module._extensions = {};
Module._paths = [];

Module.wrapper = NativeModule.wrapper;
Module.wrap = NativeModule.wrap;

var path = NativeModule.require('path');

// given a module name, and a list of paths to test, returns the first
// matching file in the following precedence.
//
// require("a.<ext>")
//   -> a.<ext>
//
// require("a")
//   -> a
//   -> a.<ext>
//   -> a/index.<ext>

function statPath(path) {
  var fs = NativeModule.require('fs');
  try {
    return fs.statSync(path);
  } catch (ex) {}
  return false;
}

// check if the directory is a package.json dir
var packageCache = {};

// REQ: if the module name points to a directory, node will look for a package.json file
//   >: in that directory and load the main module specified in it.
function readPackage(requestPath) {
  if (packageCache.hasOwnProperty(requestPath)) {
    return packageCache[requestPath];
  }

  var fs = NativeModule.require('fs');
  try {
    var jsonPath = path.resolve(requestPath, 'package.json');
    var json = fs.readFileSync(jsonPath, 'utf8');
  } catch (e) {
    return false;
  }

  try {
    var pkg = packageCache[requestPath] = JSON.parse(json);
  } catch (e) {
    e.path = jsonPath;
    e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
    throw e;
  }
  return pkg;
}

function tryPackage(requestPath, exts) {
  var pkg = readPackage(requestPath);

  if (!pkg || !pkg.main) return false;

  var filename = path.resolve(requestPath, pkg.main);
  return tryFile(filename) || tryExtensions(filename, exts) ||
    tryExtensions(path.resolve(filename, 'index'), exts);
}

// In order to minimize unnecessary lstat() calls,
// this cache is a list of known-real paths.
// Set to an empty object to reset.
Module._realpathCache = {}

// check if the file exists and is not a directory
function tryFile(requestPath) {
  console.verbose('module.js, TryFile: ' + requestPath);
  var fs = NativeModule.require('fs');
  var stats = statPath(requestPath);
  if (stats && !stats.isDirectory()) {
    return fs.realpathSync(requestPath, Module._realpathCache);
  }
  return false;
}

// given a path check a the file exists with any of the set extensions
function tryExtensions(p, exts) {
  for (var i = 0, EL = exts.length; i < EL; i++) {
    var filename = tryFile(p + exts[i]);

    if (filename) {
      return filename;
    }
  }
  return false;
}

Module._findPath = function(request, paths, parent) {
  var fs = NativeModule.require('fs');
  var exts = Object.keys(Module._extensions);

  if (request.charAt(0) === '/') {
    paths = [''];
  }

  var cacheKey = JSON.stringify({request: request, paths: paths});
  if (Module._pathCache[cacheKey]) {
    return Module._pathCache[cacheKey];
  }

  // proteus: note that even for absolute path (char[0] == '/') this runs once
  var trailingSlash = (request.slice(-1) === '/');
  for (var i = 0, PL = paths.length; i < PL; i++) {
    var basePath = path.resolve(paths[i], request);
    var filename;

    // proteus: allow access only in download dir even for require
    if (basePath.indexOf(process.downloadPath) != 0) {
      throw new Error('Access denied: ' + request);
    }

    if (!trailingSlash) {
      // try to join the request to the path
      filename = tryFile(basePath);

      if (!filename && !trailingSlash) {
        // try it with each of the extensions
        filename = tryExtensions(basePath, exts);
      }
    }

    if (!filename) {
      filename = tryPackage(basePath, exts);
    }

    if (!filename) {
      // try it with each of the extensions at "index"
      filename = tryExtensions(path.resolve(basePath, 'index'), exts);
    }

    if (filename) {
      Module._pathCache[cacheKey] = filename;
      return filename;
    }
  }
  return false;
};

Module._resolveLookupPaths = function(request, parent) {
  var start = request.substring(0, 2);
  if (start !== './' && start !== '..') {
    var paths = [process.downloadPath];
    if (parent) {
      if (!parent.paths) parent.paths = [];
      paths = parent.paths.concat(paths);
    }
    return [request, paths];
  }

  // proteus: This case should never hit since we disallow relative access from loadModule
  if (!parent || !parent.id || !parent.filename) {
    assert(0);
    return [request, [process.downloadPath] ];
  }

  // Is the parent an index module?
  // We can assume the parent has a valid extension,
  // as it already has been accepted as a module.
  var isIndex = /^index\.\w+?$/.test(path.basename(parent.filename));
  var parentIdPath = isIndex ? parent.id : path.dirname(parent.id);
  var id = path.resolve(parentIdPath, request);

  // make sure require('./path') and require('path') get distinct ids, even
  // when called from the toplevel js file
  if (parentIdPath === '.' && id.indexOf('/') === -1) {
    id = './' + id;
  }

  return [id, [path.dirname(parent.filename)]];
};


Module._load = function(request, parent) {
  console.verbose("Module._load: request = " + request);

  // Algorithm:
  // - resolve the request and see if a dynamic module exists
  // - if we are able to resolve the request, check if we have cached it, if so return it
  // - if we have not cached, load the module, cache it and return its reference
  // - if we do not find a dynamic module, check for a builtin module and return it

  // resolve the request (including lookup in downloads dir)
  var filename = Module._resolveFilename(request, parent);

  // dynamic module does not exist, check if we have a builtin module
  if (!filename) {
    if (NativeModule.exists(request)) {
      console.debug("<builtin-js> module: " + request + " loaded");
      return NativeModule.require(request);
    } else if (process.hasBinding(request)) {
      console.debug("<builtin-native> module: " + request + " loaded");
      return process.binding(request);
    }
    else {
      console.error("could not find module " + request);
      throw new Error("could not find module " + request);
    }
  } else {
    // return the cached version if we have one
    var cachedModule = Module._cache[filename];
    if (cachedModule) {
      console.debug("<dynamic> module: " + request + " loaded from cache");
      return cachedModule.exports;
    }

    // REQ: modules loaded will be cached and will be used to satisfy furthur
    //   >: load requests in the current node instance/webpage
    var module = new Module(filename, parent);
    Module._cache[filename] = module;
    try {
      module.load(filename);
      console.debug("<dynamic> module: " + request + " loaded");
    } catch (e) {
      console.error("module " + filename + " loading failed");
      delete Module._cache[filename];
      throw e;
    }
  }

  return module.exports;
};

Module._resolveFilename = function(request, parent) {
  // proteus: resolveLookupPaths resolves the request (which could be a relative path)
  // and returns a list of absolute paths to be searched (including parents paths)
  var resolvedModule = Module._resolveLookupPaths(request, parent);
  var id = resolvedModule[0];
  var paths = resolvedModule[1];
  console.verbose("module.js, request: " + request + ", resolved: " + id
      + ", search path: " + JSON.stringify(paths));

  // resolved path for the request, could be null
  return Module._findPath(request, paths, parent);
};


Module.prototype.load = function(filename) {
  console.verbose('load ' + JSON.stringify(filename) + ' for module ' + JSON.stringify(this.id));

  assert(!this.loaded);
  this.filename = filename;

  // proteus: disable custom paths, parent paths etc
  // this.paths = Module._nodeModulePaths(path.dirname(filename));

  var extension = path.extname(filename) || '.js';
  if (!Module._extensions[extension]) extension = '.js';
  Module._extensions[extension](this, filename);
  this.loaded = true;
};


// Returns exception if any
Module.prototype._compile = function(content, filename) {
  var self = this;
 
  // remove shebang
  content = content.replace(/^\#\!.*/, '');

  function require(path) {
    return Module._load(path, self);
  }

  // expose the type of require being exported in the current module, for debugging
  require.type = "require";

  require.resolve = function(request) {
    return Module._resolveFilename(request, self);
  }
 
  // Enable support to add extra extension types
  require.extensions = Module._extensions;
  require.cache = Module._cache;

  // create wrapper function
  var dirname = path.dirname(filename);
  var wrapper = Module.wrap(content);
  var compiledWrapper = runInThisContext(wrapper, filename, true);
  var args = [process, self.exports, require, self, filename, dirname, process.Buffer];
  return compiledWrapper.apply(self.exports, args);
};

// REQ: modules can be js files (.js extension), or native shared libs (.so or .node) extension
// Native extension for .js
Module._extensions['.js'] = function(module, filename) {
  var content = NativeModule.require('fs').readFileSync(filename, 'utf8');
  module._compile(content, filename);
};

// Native extension for .node
Module._extensions['.node'] = function(module, filename) {
  process.dlopen(filename, module.exports);
};

// Native extension for .node
Module._extensions['.so'] = function(module, filename) {
  process.dlopen(filename, module.exports);
};

// bootstrap repl
Module.requireRepl = function() {
  return Module._load('repl', '.');
};

// backwards compatibility
Module.Module = Module;

// proteus: expose clearDynamicModuleCache for testing multiple loads
if (typeof test == 'object') {
  test.clearDynamicModuleCache = function() {
    console.info("test.clearDynamicModuleCache");
    Module._cache = {};
    Module._pathCache = {};
  }
}
