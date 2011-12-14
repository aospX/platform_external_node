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

// Hello, and welcome to hacking node.js!
//
// This file is invoked by node::Load in src/node.cc, and responsible for
// bootstrapping the node.js core. Special caution is given to the performance
// of the startup process, so many dependencies are invoked lazily.
// REQ: An object named "process" will be exposed in module scope which carries any global information across modules
(function(process) {
  global = this;

  function startup() {
    process.versions = {};
    process.versions.openssl = "1.0.0e"; //ics
    startup.globalConsole();
    console.verbose("node.js: startup()");

    // proteus: pull in https://github.com/joyent/node/commit/4ef8f06fe62edb74fded0e817266cb6398e69f36
    var EventEmitter = NativeModule.require('events').EventEmitter;
    process.__proto__ = EventEmitter.prototype;
    process.EventEmitter = EventEmitter; // process.EventEmitter is deprecated

    startup.globalVariables();
    startup.globalTimeouts();

    startup.processAssert();
    startup.processNextTick();
    startup.processKillAndExit();
    startup.processSignalHandlers();

    // freeze builtins
    // REQ: All builtin objects in node context will be immutable (Object.freeze(Object) ..)
    Object.freeze(Object);
    Object.freeze(Object);
    Object.freeze(Object.prototype);
    Object.freeze(String);
    Object.freeze(String.prototype);
    Object.freeze(Function);
    Object.freeze(Function.prototype);
    Object.freeze(Array);
    Object.freeze(Array.prototype);
    Object.freeze(Boolean);
    Object.freeze(Boolean.prototype);
    Object.freeze(Math);
    Object.freeze(Date);
    Object.freeze(Date.prototype);
    Object.freeze(RegExp);
    Object.freeze(RegExp.prototype);

    // FIXME: This causes wierd crash on the device
    // Object.freeze(test);

    // we cannot freeze process object, since events module writes to it
    // this._events[type] = [] (this == process)

    var Module = NativeModule.require('module');
    var proteusModLoader = Module._load('proteusModLoader', null);
    var loadModule = function(request, successCB, errorCB) {
      console.info("loadModule: " + request);

      if (typeof errorCB !== 'function') {
        errorCB = function(e) {
          console.error("error in loadModule: " + e);
          //throw e;
        }
      }

      if (typeof request !== 'string' || typeof successCB != 'function') {
        console.error("request: " + request + " successCB: " + successCB);
        return errorCB("Invalid arguments");
      }

      var isValidLoadModulePath = /^\s*[\w-.]+\s*$/.test(request);
      if (!isValidLoadModulePath) {
        return errorCB("Invalid request: " + request);
      }

      // REQ: loadModule(foo) will lookup module named "public-foo" in the downloads directory
      console.verbose("node.js, loadModule. calling Module._load, request = " + request);


      var proteusModLoaderObj = new proteusModLoader();
      proteusModLoaderObj.loadPackage('public-' + request, function(){
	                             try {
					    var module = Module._load('public-' + request, null);
					    successCB(module);
					  } catch (e) {
					    errorCB(e);
					  }
	                             },
				     function(e){
					 errorCB(e);
				     });
    };

    // expose loadModuleSync in the node context for service node case
    global.loadModuleSync = function(path) {
      return Module._load('public-' + path, null);
    }

    // expose async loadModule as well in case modules want to use it
    global.loadModule = loadModule;
    return loadModule;
  }

  startup.globalVariables = function() {
    GLOBAL = global; //sqlite_sync needs this and possibly other node modules
    // expose Buffer on the process object which is not visible to untrusted code
    process.Buffer = NativeModule.require('buffer').Buffer;
  };

  // REQ: modules will use the 'node's' timeout implementation and not rely on browser (e.g. for setTimeout)
  startup.globalTimeouts = function() {
    global.setTimeout = function() {
      var t = NativeModule.require('timers');
      return t.setTimeout.apply(this, arguments);
    };

    global.setInterval = function() {
      var t = NativeModule.require('timers');
      return t.setInterval.apply(this, arguments);
    };

    global.clearTimeout = function() {
      var t = NativeModule.require('timers');
      return t.clearTimeout.apply(this, arguments);
    };

    global.clearInterval = function() {
      var t = NativeModule.require('timers');
      return t.clearInterval.apply(this, arguments);
    };
  };

  startup.globalConsole = function() {
    global.console = NativeModule.require('console');
  };

  startup._lazyConstants = null;

  startup.lazyConstants = function() {
    if (!startup._lazyConstants) {
      startup._lazyConstants = process.binding('constants');
    }
    return startup._lazyConstants;
  };

  var assert;
  startup.processAssert = function() {
    // Note that calls to assert() are pre-processed out by JS2C for the
    // normal build of node. They persist only in the node_g build.
    // Similarly for debug().
    assert = process.assert = function(x, msg) {
      if (!x) throw new Error(msg || 'assertion error');
    };
  };

  startup.processNextTick = function() {
    var nextTickQueue = [];

    process._tickCallback = function() {
      var l = nextTickQueue.length;
      if (l === 0) return;

      try {
        for (var i = 0; i < l; i++) {
          nextTickQueue[i]();
        }
      }
      catch (e) {
        nextTickQueue.splice(0, i + 1);
        if (i + 1 < l) {
          process._needTickCallback();
        }
        throw e; // process.nextTick error, or 'error' event on first tick
      }

      nextTickQueue.splice(0, l);
    };

    process.nextTick = function(callback) {
      nextTickQueue.push(callback);
      process._needTickCallback();
    };
  };

  startup.processKillAndExit = function() {
    process.exit = function(code) {
      process.emit('exit', code || 0);
      process.reallyExit(code || 0);
    };

    // proteus - kill not supported
  };

  startup.processSignalHandlers = function() {
    // Load events module in order to access prototype elements on process like
    // process.addListener.
    var events = NativeModule.require('events');
    var signalWatchers = {};

    // \proteus\ addListener here points to EventEmitter's addListener, since __proto__
    // of process maps to EventEmitters prototype (same as doing process = new EventEmitter())
    // so, this essentially says process is a eventEmitter
    var addListener = process.addListener;
    var removeListener = process.removeListener;

    function isSignal(event) {
      return event.slice(0, 3) === 'SIG' && startup.lazyConstants()[event];
    }

    // Wrap addListener for the special signal types
    process.on = process.addListener = function(type, listener) {
      var ret = addListener.apply(this, arguments);
      if (isSignal(type)) {
        if (!signalWatchers.hasOwnProperty(type)) {
          var b = process.binding('signal_watcher');
          var w = new b.SignalWatcher(startup.lazyConstants()[type]);
          w.callback = function() { process.emit(type); };
          signalWatchers[type] = w;
          w.start();

        } else if (this.listeners(type).length === 1) {
          signalWatchers[type].start();
        }
      }

      return ret;
    };

    process.removeListener = function(type, listener) {
      var ret = removeListener.apply(this, arguments);
      if (isSignal(type)) {
        assert(signalWatchers.hasOwnProperty(type));

        if (this.listeners(type).length === 0) {
          signalWatchers[type].stop();
        }
      }

      return ret;
    };
  };


  // Below you find a minimal module system, which is used to load the node
  // core modules found in lib/*.js. All core modules are compiled into the
  // node binary, so they can be loaded faster.

  var Script = process.binding('evals').NodeScript;
  var runInThisContext = Script.runInThisContext;

  function translateId(id) {
    switch (id) {
      case 'net':
      case 'timers':
      case 'dns':
        return id + '_legacy';

      default:
        return id;
    }
  }

  function NativeModule(id) {
    id = translateId(id);
    this.filename = id + '.js';
    this.id = id;
    this.exports = {};
    this.loaded = false;
  }

  NativeModule._source = process.binding('natives');
  NativeModule._cache = {};

  NativeModule.require = function(id) {
    id = translateId(id);

    if (id == 'native_module') {
      return NativeModule;
    }

    var cached = NativeModule.getCached(id);
    if (cached) {
      return cached.exports;
    }

    if (!NativeModule.exists(id)) {
      throw new Error('No such native module ' + id);
    }

    var nativeModule = new NativeModule(id);

    nativeModule.compile();
    nativeModule.cache();

    // console itself is loaded with require
    if (typeof console == 'undefined') {
      process.log(3, "loaded core js module (" + id + ")");
    } else {
      console.debug("loaded core js module (" + id + ")");
    }

    return nativeModule.exports;
  };

  // expose the type of require exported in the current module, for debugging
  NativeModule.require.type = "NativeModule.require";

  NativeModule.getCached = function(id) {
    id = translateId(id);
    return NativeModule._cache[id];
  }

  NativeModule.exists = function(id) {
    id = translateId(id);
    return (id in NativeModule._source);
  }

  NativeModule.getSource = function(id) {
    id = translateId(id);
    return NativeModule._source[id];
  }

  NativeModule.wrap = function(script) {
    return NativeModule.wrapper[0] + script + NativeModule.wrapper[1];
  };

  NativeModule.wrapper = [
    '(function (process, exports, require, module, __filename, __dirname, Buffer) { ',
    '\n});'
  ];

  NativeModule.prototype.compile = function() {
    var source = NativeModule.getSource(this.id);
    source = NativeModule.wrap(source);

    var fn = runInThisContext(source, this.filename, true);
    // proteus, pass process as a parameter in closure so that trusted modules can access it,
    // but the global/user space dont have access
    fn(process, this.exports, NativeModule.require, this, this.filename, undefined, process.Buffer);

    this.loaded = true;
  };

  NativeModule.prototype.cache = function() {
    NativeModule._cache[this.id] = this;
  };

  return startup();
});
