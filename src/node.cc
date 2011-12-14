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

#include <node.h>
#include <v8-debug.h>

#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/types.h>
#include <dlfcn.h>
#include <stdarg.h>
#include <sys/syscall.h>
#include <sys/time.h>

#include <node_buffer.h>
#include <node_io_watcher.h>
#include <node_timer.h>
#include <node_constants.h>
#include <node_javascript.h>
#include <node_string.h>
#include <node_script.h>

#ifdef ANDROID
#include <sys/system_properties.h>
#endif

namespace node {

using namespace v8;
using namespace std;

class NodeStatic {
  public:
    static NodeStatic* instance() {
      NODE_ASSERT(s_instance);
      return s_instance;
    }

    static void create(bool isBrowser, std::string moduleRootPath) {
      NODE_ASSERT(!s_instance);
      s_instance = new NodeStatic(isBrowser, moduleRootPath);
    }

  private:
    NodeStatic(bool isBrowser, std::string moduleRootPath);
    static NodeStatic* s_instance;

    // idle watcher for triggering another eio_poll
    uv_idle_t s_eio_poller;

    // async watcher to signal libev for pending eio work
    uv_async_t s_eio_want_poll_notifier;

    // async watcher to indicate done from eio callback to libev
    uv_async_t s_eio_done_poll_notifier;

    // libev thread handle
    pthread_t s_thread;

    // synchronizing libev thread and main thread
    // libev thread on start locks mutex and signals main thread callback and waits on a condition
    // main thread takes the lock and signals the condition, liev thread resumes
    pthread_mutex_t s_mutex;
    pthread_cond_t s_cond;

    // global list of all active v8 contexts
    std::vector<v8::Persistent<v8::Context>* > s_contexts;

    // global list of all active nodes
    std::vector<Node*> s_nodes;

    bool s_lockState;
    int s_updateCheck; // notStarted = 0 ,  inProgress = 1 , Completed = 2 .
    std::vector< v8::Persistent<v8::Function> > s_lockList;

    bool s_testDone;
    bool s_isBrowser;
    bool s_isAndroid;

    // cached node instance to service requests without a client (e.g. page)
    // only supports synchronous requests..
    Node* s_serviceNode;
    Node* ServiceNode();

    // set by the embedder, root of the module installation
    std::string s_appPath;
    std::string s_moduleDownloadPath;
    std::string s_moduleDownloadSuffix;

    // watchers common to all the node instances
    uv_counters_t s_watchers_active;

    // create stuff common to all node instances (e.g. eio watchers)
    void Initialize();

    // This starts a separate thread for the libev event loop,
    // overrides ev_invoke_pending and indicates back to the embedder
    // to process events which invokes actual ev_invoke_pending
    // There's only event loop created per process
    void RunEventLoop();

    // This is the function which we override ev_invoke_pending
    // gets called on the libev thread whenever there is pending work
    // we signal callback and wait on the condition till the main thread
    // is done processing
    static void EvThreadPendingCallback(struct ev_loop *loop);

    // libev thread entry point
    // The ev_run should run forever if keepRunning is set (as in browser)
    // In test mode, it returns if there are no pending work (e.g. no watchers), and
    // sends out a NODE_EVENT_DONE to the embedder
    static void* EvThreadRun(void *data);
    bool InvokePending();

    // idle watcher callback that triggers eio_poll
    static void DoPoll(uv_idle_t* watcher, int status);

    // async watcher callback that will invoke eio_poll
    static void WantPollNotifier(uv_async_t* watcher, int status);

    // done watcher callback, invoke eio_poll and stop the idle watcher if there is no pending work
    static void DonePollNotifier(uv_async_t* watcher, int revents);

    // called in context of eio thread to indicate need for polling
    static void EIOWantPoll(void);

    // called in context of eio thread to indicate done requests and no need for poll
    static void EIODonePoll(void);

    // js binding invoked to handle "process.binding('module')" call
    static v8::Handle<v8::Value> Binding(const v8::Arguments& args);
    static v8::Handle<v8::Value> HasBinding(const v8::Arguments& args);
    static Handle<Value> DLOpen(const Arguments& args);
    static v8::Handle<v8::Value> Compile(const v8::Arguments& args);

    // creates exports object (the object returned when you do a require('..')
    static v8::Handle<v8::Value> CreateExportsObject(const v8::Arguments& args);

    // Handle ticks
    static void PrepareTick(uv_prepare_t* handle, int status);
    static void CheckTick(uv_check_t* handle, int status);
    static void Spin(uv_idle_t* handle, int status);
    static v8::Handle<v8::Value> NeedTickCallback(const v8::Arguments& args);

    // Registers a Permission Feature for use in the Permissions API
    static v8::Handle<v8::Value> RegisterPermissionFeatures(const v8::Arguments& args);
    static v8::Handle<v8::Value> RequestPermission(const v8::Arguments& args);

    // Used to lock when loadmodule or checkUpdate is called
    static v8::Handle<v8::Value> AcquireLock(const v8::Arguments& args) ;

    // Used to unlock when loadmodule or checkUpdate has finished
    static v8::Handle<v8::Value> ReleaseLock(const v8::Arguments& args) ;

    // Check if checkUpdate has finished
    static v8::Handle<v8::Value> GetModuleUpdates(const v8::Arguments& args);

    // Set the flag after checkUpdate has finished
    static v8::Handle<v8::Value> SetModuleUpdates(const v8::Arguments& args) ;

    static v8::Handle<v8::Value> TestDeleteNode(const v8::Arguments& args);
    static v8::Handle<v8::Value> ReallyExit(const v8::Arguments& args);

    // GetAddress of a js object
    // usage in module: console.log("obj address = " + test.getAddress(obj));
    static v8::Handle<v8::Value> TestGetAddress(const v8::Arguments& args);

    // Print details of object (including properties etc)
    // usage in module: test.printJSObject(obj)
    static v8::Handle<v8::Value> TestPrintJSObject(const v8::Arguments& args);

    static v8::Handle<v8::Value> TestStart(const v8::Arguments& args);
    // check the test status, if we have not added any watchers, report the test is done
    static v8::Handle<v8::Value> TestCheck(const v8::Arguments& args);
    static v8::Handle<v8::Value> TestFail(const v8::Arguments& args);
    static v8::Handle<v8::Value> TestBreak(const v8::Arguments& args);
    static Handle<Value> TestRunScript(const Arguments& args);

    static void HandleSIGSEGV(int signal);
    v8::Handle<v8::Object> TestGetCurrentProcess();

    // print stack from js code e.g. test.stack();
    static v8::Handle<v8::Value> TestStack(const v8::Arguments& args);
    android_LogPriority StringToLog(const char* log);

    // initiliaze logging
    void ReadDebugLevel();

    // Logger, similar to console.log
    static v8::Handle<v8::Value> ProcessLog(const v8::Arguments& args);

    // ref/unref the event loop
    // by default, we keep event loop alive with a ref, in test mode however
    // we need to exit to report test results, so the test should do a unref
    // should be used only in test js code
    static v8::Handle<v8::Value> TestRef(const v8::Arguments& args);
    static v8::Handle<v8::Value> TestUnref(const v8::Arguments& args);

    // dump watcher stats from javascript
    // JS API - test.watcherStats();
    static v8::Handle<v8::Value> TestWatcherStats(const v8::Arguments& args);

    // retreive the node instance from the process/test object internal field
    static Node* GetNodeFromProcess(v8::Handle<v8::Object> process);
    static Node* GetNodeFromTest(v8::Handle<v8::Object> test);

    // Used to print stack trace during an exception
    void ReportException(v8::TryCatch &try_catch, bool show_line);

    void ReportTestStatus();
    void DumpWatcherStats(uv_counters_t *uvc);

  public:
    static void FatalException(v8::TryCatch &try_catch);
    void io_inc();
    void io_dec();
    void idle_inc();
    void idle_dec();
    friend class Node;
};

#define si() NodeStatic::instance()
NodeStatic* NodeStatic::s_instance = 0;

Node* NodeStatic::GetNodeFromProcess(Handle<Object> process) {
  Node *n = static_cast<Node*>(process->GetPointerFromInternalField(0));
  NODE_ASSERT(n);
  return n;
}

Node* NodeStatic::GetNodeFromTest(Handle<Object> test) {
  Node *n = static_cast<Node*>(test->GetPointerFromInternalField(0));
  NODE_ASSERT(n);
  return n;
}

void Node::io_inc() {
  m_watchers_active.io_init++;
  si()->io_inc();
}

void Node::io_dec() {
  m_watchers_active.io_init--;
  si()->io_dec();
}

void Node::idle_inc() {
  m_watchers_active.idle_init++;
  si()->idle_inc();
}

void Node::idle_dec() {
  m_watchers_active.idle_init--;
  si()->idle_dec();
}

void NodeStatic::io_inc() {
  s_watchers_active.io_init++;
}

void NodeStatic::io_dec() {
  s_watchers_active.io_init--;
}

void NodeStatic::idle_inc() {
  s_watchers_active.idle_init++;
}

void NodeStatic::idle_dec() {
  s_watchers_active.idle_init--;
}

void Node::Tick(void) {
  NODE_LOGM("%s", __PRETTY_FUNCTION__);

  // Avoid entering a V8 scope.
  if (!m_need_tick_cb) return;

  // proteus: FIXME
  // set the context..since FatalException would need it
  Context::Scope cscope(m_context);

  m_need_tick_cb = false;
  if (uv_is_active((uv_handle_t*) &m_tick_spinner)) {
    NODE_LOGV("this(%p), m_tick_spinner (%p) stopped", this, &m_tick_spinner);
    uv_idle_stop(&m_tick_spinner);
    uv_unref();
    idle_dec();
  }

  v8::Persistent<v8::String> tick_callback_sym;
  if (tick_callback_sym.IsEmpty()) {
    tick_callback_sym =
      Persistent<String>::New(String::NewSymbol("_tickCallback"));
  }

  HandleScope scope;
  Local<Value> cb_v = m_process->Get(tick_callback_sym);
  if (!cb_v->IsFunction()) return;
  Local<Function> cb = Local<Function>::Cast(cb_v);

  TryCatch try_catch;
  cb->Call(m_process, 0, NULL);
  if (try_catch.HasCaught()) {
    si()->FatalException(try_catch);
  }
}

void NodeStatic::Spin(uv_idle_t* handle, int status) {
  NODE_ASSERT(status == 0);
  NODE_ASSERT(handle->data);
  Node *n = static_cast<Node*>(handle->data);
  NODE_ASSERT((uv_idle_t*) handle == &n->m_tick_spinner);
  n->Tick();
}

Handle<Value> NodeStatic::NeedTickCallback(const Arguments& args) {
  NODE_LOGF();
  HandleScope scope;

  Node *n = GetNodeFromProcess(args.Holder());
  n->m_need_tick_cb = true;
  // TODO: this tick_spinner shouldn't be necessary. An ev_prepare should be
  // sufficent, the problem is only in the case of the very last "tick" -
  // there is nothing left to do in the event loop and libev will exit. The
  // ev_prepare callback isn't called before exiting. Thus we start this
  // tick_spinner to keep the event loop alive long enough to handle it.
  if (!uv_is_active((uv_handle_t*) &n->m_tick_spinner)) {
    NODE_LOGV("this(%p), m_tick_spinner (%p) started", n, &n->m_tick_spinner);
    uv_idle_start(&n->m_tick_spinner, Spin);
    uv_ref();
    n->idle_inc();
  }
  return Undefined();
}

void NodeStatic::PrepareTick(uv_prepare_t* handle, int status) {
  NODE_LOGM("%s", __PRETTY_FUNCTION__);

  Node *n = static_cast<Node*>(handle->data);
  NODE_ASSERT(handle == &n->m_prepare_tick_watcher);
  NODE_ASSERT(status == 0);
  n->Tick();
}

void NodeStatic::CheckTick(uv_check_t* handle, int status) {
  NODE_LOGM("%s", __PRETTY_FUNCTION__);

  Node *n = static_cast<Node*>(handle->data);
  NODE_ASSERT(handle == &n->m_check_tick_watcher);
  NODE_ASSERT(status == 0);
  n->Tick();
}

void NodeStatic::DoPoll(uv_idle_t* watcher, int status) {
  NODE_LOGF();
  NODE_ASSERT(watcher == &si()->s_eio_poller);

  if (eio_poll() != -1 && uv_is_active((uv_handle_t*)&si()->s_eio_poller)) {
    NODE_LOGV("s_eio_poller(%p) stopped", &si()->s_eio_poller);
    uv_idle_stop(&si()->s_eio_poller);
    uv_unref();
    si()->idle_dec();
  }
}

// Called from the main thread.
void NodeStatic::WantPollNotifier(uv_async_t* watcher, int status) {
  NODE_LOGF();
  NODE_ASSERT(watcher == &si()->s_eio_want_poll_notifier);

  NODE_LOGV("WantPollNotifier/eio_poll()");
  if (eio_poll() == -1 && !uv_is_active((uv_handle_t*) &si()->s_eio_poller)) {
    NODE_LOGV("s_eio_poller(%p) started", &si()->s_eio_poller);
    uv_idle_start(&si()->s_eio_poller, DoPoll);
    uv_ref();
    si()->idle_inc();
  }
}

void NodeStatic::DonePollNotifier(uv_async_t* watcher, int revents) {
  NODE_LOGF();
  NODE_ASSERT(watcher == &si()->s_eio_done_poll_notifier);

  NODE_LOGV("DonePollNotifier/eio_poll()");
  if (eio_poll() != -1 && uv_is_active((uv_handle_t*) &si()->s_eio_poller)) {
    NODE_LOGV("s_eio_poller(%p) stopped", &si()->s_eio_poller);
    uv_idle_stop(&si()->s_eio_poller);
    uv_unref();
    si()->idle_dec();
  }
}

// EIOWantPoll() is called from the EIO thread pool each time an EIO
// request (that is, one of the node.fs.* functions) has completed.
void NodeStatic::EIOWantPoll(void) {
  // Signal the main thread that eio_poll need to be processed.
  NODE_LOGV("EIOWantPoll (eio->main)");
  uv_async_send(&si()->s_eio_want_poll_notifier);
}

void NodeStatic::EIODonePoll(void) {
  NODE_LOGV("EIODonePoll (eio->main)");
  // Signal the main thread that we should stop calling eio_poll().
  // from the idle watcher.
  uv_async_send(&si()->s_eio_done_poll_notifier);
}

static inline const char *errno_string(int errorno) {
#define ERRNO_CASE(e)  case e: return #e;
  switch (errorno) {
  ERRNO_CASE(EACCES);
  ERRNO_CASE(EADDRINUSE);
  ERRNO_CASE(EADDRNOTAVAIL);
  ERRNO_CASE(EAFNOSUPPORT);
  ERRNO_CASE(EAGAIN);
# if EAGAIN != EWOULDBLOCK
  ERRNO_CASE(EWOULDBLOCK);
# endif
  ERRNO_CASE(EALREADY);
  ERRNO_CASE(EBADF);
  ERRNO_CASE(EBADMSG);
  ERRNO_CASE(EBUSY);
  ERRNO_CASE(ECANCELED);
  ERRNO_CASE(ECHILD);
  ERRNO_CASE(ECONNABORTED);
  ERRNO_CASE(ECONNREFUSED);
  ERRNO_CASE(ECONNRESET);
  ERRNO_CASE(EDEADLK);
  ERRNO_CASE(EDESTADDRREQ);
  ERRNO_CASE(EDOM);
  ERRNO_CASE(EDQUOT);
  ERRNO_CASE(EEXIST);
  ERRNO_CASE(EFAULT);
  ERRNO_CASE(EFBIG);
  ERRNO_CASE(EHOSTUNREACH);
  ERRNO_CASE(EIDRM);
  ERRNO_CASE(EILSEQ);
  ERRNO_CASE(EINPROGRESS);
  ERRNO_CASE(EINTR);
  ERRNO_CASE(EINVAL);
  ERRNO_CASE(EIO);
  ERRNO_CASE(EISCONN);
  ERRNO_CASE(EISDIR);
  ERRNO_CASE(ELOOP);
  ERRNO_CASE(EMFILE);
  ERRNO_CASE(EMLINK);
  ERRNO_CASE(EMSGSIZE);
  ERRNO_CASE(EMULTIHOP);
  ERRNO_CASE(ENAMETOOLONG);
  ERRNO_CASE(ENETDOWN);
  ERRNO_CASE(ENETRESET);
  ERRNO_CASE(ENETUNREACH);
  ERRNO_CASE(ENFILE);
  ERRNO_CASE(ENOBUFS);
  ERRNO_CASE(ENODATA);
  ERRNO_CASE(ENODEV);
  ERRNO_CASE(ENOENT);
  ERRNO_CASE(ENOEXEC);
  ERRNO_CASE(ENOLINK);
  ERRNO_CASE(ENOLCK);
  ERRNO_CASE(ENOMEM);
  ERRNO_CASE(ENOMSG);
  ERRNO_CASE(ENOPROTOOPT);
  ERRNO_CASE(ENOSPC);
  ERRNO_CASE(ENOSR);
  ERRNO_CASE(ENOSTR);
  ERRNO_CASE(ENOSYS);
  ERRNO_CASE(ENOTCONN);
  ERRNO_CASE(ENOTDIR);
  ERRNO_CASE(ENOTEMPTY);
  ERRNO_CASE(ENOTSOCK);
  ERRNO_CASE(ENOTSUP);
  ERRNO_CASE(ENOTTY);
  ERRNO_CASE(ENXIO);
  ERRNO_CASE(EOVERFLOW);
  ERRNO_CASE(EPERM);
  ERRNO_CASE(EPIPE);
  ERRNO_CASE(EPROTO);
  ERRNO_CASE(EPROTONOSUPPORT);
  ERRNO_CASE(EPROTOTYPE);
  ERRNO_CASE(ERANGE);
  ERRNO_CASE(EROFS);
  ERRNO_CASE(ESPIPE);
  ERRNO_CASE(ESRCH);
  ERRNO_CASE(ESTALE);
  ERRNO_CASE(ETIME);
  ERRNO_CASE(ETIMEDOUT);
  ERRNO_CASE(ETXTBSY);
  ERRNO_CASE(EXDEV);
  default: return "";
  }
}

Local<Value> ErrnoException( int errorno, const char *syscall,
    const char *msg, const char *path) {
  static Persistent<String> errno_symbol;
  static Persistent<String> syscall_symbol;
  static Persistent<String> errpath_symbol;
  static Persistent<String> code_symbol;

  if (errno_symbol.IsEmpty()) {
    syscall_symbol = NODE_PSYMBOL("syscall");
    errno_symbol = NODE_PSYMBOL("errno");
    errpath_symbol = NODE_PSYMBOL("path");
    code_symbol = NODE_PSYMBOL("code");
  }

  Local<Value> e;
  Local<String> estring = String::NewSymbol(errno_string(errorno));
  if (!msg[0]) {
    msg = strerror(errorno);
  }
  Local<String> message = String::NewSymbol(msg);
  Local<String> cons1 = String::Concat(estring, String::NewSymbol(", "));
  Local<String> cons2 = String::Concat(cons1, message);
  if (path) {
    Local<String> cons3 = String::Concat(cons2, String::NewSymbol(" '"));
    Local<String> cons4 = String::Concat(cons3, String::New(path));
    Local<String> cons5 = String::Concat(cons4, String::NewSymbol("'"));
    e = Exception::Error(cons5);
  } else {
    e = Exception::Error(cons2);
  }

  Local<Object> obj = e->ToObject();
  obj->Set(errno_symbol, Integer::New(errorno));
  obj->Set(code_symbol, estring);
  if (path) obj->Set(errpath_symbol, String::New(path));
  if (syscall) obj->Set(syscall_symbol, String::NewSymbol(syscall));
  return e;
}

Handle<Value> Node::FromConstructorTemplate(Persistent<FunctionTemplate>& t,
                                      const Arguments& args) {
  HandleScope scope;
  const int argc = args.Length();
  Local<Value>* argv = new Local<Value>[argc];
  for (int i = 0; i < argc; ++i) {
    argv[i] = args[i];
  }
  Local<Object> instance = t->GetFunction()->NewInstance(argc, argv);
  delete[] argv;
  return scope.Close(instance);
}

// MakeCallback may only be made directly off the event loop.
// That is there can be no JavaScript stack frames underneath it.
// (Is there any way to NODE_ASSERT that?)
//
// Maybe make this a method of a node::Handle super class
//
void Node::MakeCallback(Handle<Object> object,
                  const char* method,
                  int argc,
                  Handle<Value> argv[]) {
  HandleScope scope;
  Local<Value> callback_v = object->Get(String::New(method));
  NODE_ASSERT(callback_v->IsFunction());
  Local<Function> callback = Local<Function>::Cast(callback_v);
  // TODO Hook for long stack traces to be made here.
  TryCatch try_catch;
  callback->Call(object, argc, argv);
  if (try_catch.HasCaught()) {
    si()->FatalException(try_catch);
  }
}

void SetErrno(uv_err_code code) {
  uv_err_t err;
  err.code = code;
  Context::GetCurrent()->Global()->Set(String::NewSymbol("errno"),
      String::NewSymbol(uv_err_name(err)));
}


enum encoding Node::ParseEncoding(Handle<Value> encoding_v, enum encoding _default) {
  HandleScope scope;

  if (!encoding_v->IsString()) return _default;

  String::Utf8Value encoding(encoding_v->ToString());
  if (strcasecmp(*encoding, "utf8") == 0) {
    return UTF8;
  } else if (strcasecmp(*encoding, "utf-8") == 0) {
    return UTF8;
  } else if (strcasecmp(*encoding, "ascii") == 0) {
    return ASCII;
  } else if (strcasecmp(*encoding, "base64") == 0) {
    return BASE64;
  } else if (strcasecmp(*encoding, "ucs2") == 0) {
    return UCS2;
  } else if (strcasecmp(*encoding, "ucs-2") == 0) {
    return UCS2;
  } else if (strcasecmp(*encoding, "binary") == 0) {
    return BINARY;
  } else if (strcasecmp(*encoding, "hex") == 0) {
    return HEX;
  } else if (strcasecmp(*encoding, "raw") == 0) {
    fprintf(stderr, "'raw' (array of integers) has been removed. "
                    "Use 'binary'.\n");
    return BINARY;
  } else if (strcasecmp(*encoding, "raws") == 0) {
    fprintf(stderr, "'raws' encoding has been renamed to 'binary'. "
                    "Please update your code.\n");
    return BINARY;
  } else {
    return _default;
  }
}

Local<Value> Node::Encode(const void *buf, size_t len, enum encoding encoding) {
  HandleScope scope;

  if (!len) return scope.Close(String::Empty());

  if (encoding == BINARY) {
    const unsigned char *cbuf = static_cast<const unsigned char*>(buf);
    uint16_t * twobytebuf = new uint16_t[len];
    for (size_t i = 0; i < len; i++) {
      // XXX is the following line platform independent?
      twobytebuf[i] = cbuf[i];
    }
    Local<String> chunk = String::New(twobytebuf, len);
    delete [] twobytebuf; // TODO use ExternalTwoByteString?
    return scope.Close(chunk);
  }

  // utf8 or ascii encoding
  Local<String> chunk = String::New((const char*)buf, len);
  return scope.Close(chunk);
}

// Returns -1 if the handle was not valid for decoding
ssize_t Node::DecodeBytes(Handle<Value> val, enum encoding encoding) {
  HandleScope scope;

  if (val->IsArray()) {
    fprintf(stderr, "'raw' encoding (array of integers) has been removed. "
                    "Use 'binary'.\n");
    NODE_ASSERT(0);
    return -1;
  }

  Local<String> str = val->ToString();

  if (encoding == UTF8) return str->Utf8Length();
  else if (encoding == UCS2) return str->Length() * 2;
  else if (encoding == HEX) return str->Length() / 2;

  return str->Length();
}

#ifndef MIN
# define MIN(a, b) ((a) < (b) ? (a) : (b))
#endif

// Returns number of bytes written.
ssize_t Node::DecodeWrite(char *buf, size_t buflen, Handle<Value> val, enum encoding encoding) {
  HandleScope scope;

  // XXX
  // A lot of improvement can be made here. See:
  // http://code.google.com/p/v8/issues/detail?id=270
  // http://groups.google.com/group/v8-dev/browse_thread/thread/dba28a81d9215291/ece2b50a3b4022c
  // http://groups.google.com/group/v8-users/browse_thread/thread/1f83b0ba1f0a611

  if (val->IsArray()) {
    fprintf(stderr, "'raw' encoding (array of integers) has been removed. "
                    "Use 'binary'.\n");
    NODE_ASSERT(0);
    return -1;
  }

  Local<String> str = val->ToString();
  if (encoding == UTF8) {
    str->WriteUtf8(buf, buflen, NULL, String::HINT_MANY_WRITES_EXPECTED);
    return buflen;
  }
  if (encoding == ASCII) {
    str->WriteAscii(buf, 0, buflen, String::HINT_MANY_WRITES_EXPECTED);
    return buflen;
  }

  // THIS IS AWFUL!!! FIXME
  NODE_ASSERT(encoding == BINARY);
  uint16_t * twobytebuf = new uint16_t[buflen];
  str->Write(twobytebuf, 0, buflen, String::HINT_MANY_WRITES_EXPECTED);
  for (size_t i = 0; i < buflen; i++) {
    unsigned char *b = reinterpret_cast<unsigned char*>(&twobytebuf[i]);
    buf[i] = b[0];
  }
  delete [] twobytebuf;
  return buflen;
}

void Node::DisplayExceptionLine (TryCatch &try_catch) {
  HandleScope scope;
  Handle<Message> message = try_catch.Message();
  if (!message.IsEmpty()) {
    // Print (filename):(line number): (message).
    String::Utf8Value filename(message->GetScriptResourceName());
    const char* filename_string = *filename;
    int linenum = message->GetLineNumber();
    NODE_LOGE("%s:%i", filename_string, linenum);

    // Print line of source code.
    String::Utf8Value sourceline(message->GetSourceLine());
    const char* sourceline_string = *sourceline;
    NODE_LOGE("%s", sourceline_string);

    // Print wavy underline (GetUnderline is deprecated).
    //int start = message->GetStartColumn();
    //for (int i = offset; i < start; i++) {
      //NODE_LOGE(stderr, " ");
    //}
    //int end = message->GetEndColumn();
    //for (int i = start; i < end; i++) {
      //NODE_LOGE(stderr, "^");
    //}
  }
}

void NodeStatic::ReportException(TryCatch &try_catch, bool show_line) {
  HandleScope scope;
  Handle<Message> message = try_catch.Message();

  if (show_line) {
    Node::DisplayExceptionLine(try_catch);
  }

  String::Utf8Value trace(try_catch.StackTrace());
  // range errors have a trace member set to undefined
  if (trace.length() > 0 && !try_catch.StackTrace()->IsUndefined()) {
     NODE_LOGE("\n%s\n", *trace);
  } else {
    // this really only happens for RangeErrors, since they're the only
    // kind that won't have all this info in the trace, or when non-Error
    // objects are thrown manually.
    Local<Value> er = try_catch.Exception();
    bool isErrorObject = !er.IsEmpty() && er->IsObject() &&
      !(er->ToObject()->Get(String::New("message"))->IsUndefined()) &&
      !(er->ToObject()->Get(String::New("name"))->IsUndefined());

    if (isErrorObject) {
      String::Utf8Value name(er->ToObject()->Get(String::New("name")));
      NODE_LOGE("%s", *name);
    }
    String::Utf8Value msg(!isErrorObject ? er->ToString()
        : er->ToObject()->Get(String::New("message"))->ToString());
    NODE_LOGE("%s\n", *msg);
  }
}

// Executes a str within the current v8 context.
Local<Value> Node::ExecuteString(Handle<String> source, Handle<Value> filename) {
  HandleScope scope;

  TryCatch try_catch;
  Local<Script> script = Script::Compile(source, filename);
  if (script.IsEmpty()) {
    si()->ReportException(try_catch, true);
    return Local<Value>();
  }

  Local<Value> result = script->Run();
  if (result.IsEmpty()) {
    si()->ReportException(try_catch, true);
    return Local<Value>();
  }

  return scope.Close(result);
}

// Caller needs to have a scope to get the return result
Local<Value> Node::RunScriptInServiceNode(Handle<String> source) {
  Node *n = si()->ServiceNode();
  Context::Scope cscope(n->m_context);
  return ExecuteString(source, String::New("<js stub>"));
}

typedef void (*extInit)(Handle<Object> exports);

// DLOpen is node.dlopen(). Used to load 'module.node' dynamically shared
// objects.
Handle<Value> NodeStatic::DLOpen(const Arguments& args) {
  HandleScope scope;

  if (args.Length() < 2) return Undefined();

  String::Utf8Value filename(args[0]->ToString()); // Cast
  Local<Object> target = args[1]->ToObject(); // Cast

  // Actually call dlopen().
  // FIXME: This is a blocking function and should be called asynchronously!
  // This function should be moved to file.cc and use libeio to make this
  // system call.
  void *handle = dlopen(*filename, RTLD_LAZY);

  // Handle errors.
  if (handle == NULL) {
    Local<Value> exception = Exception::Error(String::New(dlerror()));
    return ThrowException(exception);
  }

  String::Utf8Value symbol(args[0]->ToString());
  char *symstr = NULL;
  {
    char *sym = *symbol;
    char *p = strrchr(sym, '/');
    if (p != NULL) {
      sym = p+1;
    }

    p = strrchr(sym, '.');
    if (p != NULL) {
      *p = '\0';
    }

    size_t slen = strlen(sym);
    symstr = static_cast<char*>(calloc(1, slen + sizeof("_module") + 1));
    memcpy(symstr, sym, slen);
    memcpy(symstr+slen, "_module", sizeof("_module") + 1);
  }

  // Get the init() function from the dynamically shared object.
  Node::node_module_struct *mod = static_cast<Node::node_module_struct *>(dlsym(handle, symstr));
  free(symstr);
  // Error out if not found.
  if (mod == NULL) {
    /* Start Compatibility hack: Remove once everyone is using NODE_MODULE macro */
    Node::node_module_struct compat_mod;
    mod = &compat_mod;
    mod->version = NODE_MODULE_VERSION;

    void *init_handle = dlsym(handle, "init");
    if (init_handle == NULL) {
      dlclose(handle);
      Local<Value> exception =
        Exception::Error(String::New("No module symbol found in module."));
      return ThrowException(exception);
    }
    mod->register_func = (extInit)(init_handle);
    /* End Compatibility hack */
  }

  if (mod->version != NODE_MODULE_VERSION) {
    Local<Value> exception =
      Exception::Error(String::New("Module version mismatch, refusing to load."));
    return ThrowException(exception);
  }

  // Execute the C++ module
  mod->register_func(target);

  // Tell coverity that 'handle' should not be freed when we return.
  // coverity[leaked_storage]
  return Undefined();
}

// TODO remove me before 0.4
Handle<Value> NodeStatic::Compile(const Arguments& args) {
  HandleScope scope;

  if (args.Length() < 2) {
    return ThrowException(Exception::TypeError(
          String::New("needs two arguments.")));
  }

  static bool shown_error_message = false;
  if (!shown_error_message) {
    shown_error_message = true;
    fprintf(stderr, "(node) process.compile should not be used. "
                    "Use require('vm').runInThisContext instead.\n");
  }

  Local<String> source = args[0]->ToString();
  Local<String> filename = args[1]->ToString();

  TryCatch try_catch;
  Local<Script> script = Script::Compile(source, filename);
  if (try_catch.HasCaught()) {
    // Hack because I can't get a proper stacktrace on SyntaxError
    si()->ReportException(try_catch, true);
    NODE_ASSERT(0);
    return Undefined();
  }

  Local<Value> result = script->Run();
  if (try_catch.HasCaught()) {
    si()->ReportException(try_catch, false);
    NODE_ASSERT(0);
    return Undefined();
  }

  return scope.Close(result);
}

void Node::SetTestState(TestState state) {
  // check that we dont report results twice for the same test..
  if (m_testState == DONE) {
    NODE_ASSERT(state != DONE);
  }

  if (m_testState == REPORTED && state != STARTED) {
    // FIXME: this should not be required..
    NODE_LOGV("%s, moving from REPORTED state to other than STARTED state, ignoring", __FUNCTION__);
    return;
  }

  m_testState = state;

  // if atleast one node is done processing, mark it so that
  // we indicate it in InvokePending
  if (m_testState == DONE) {
    si()->s_testDone = true;
  }
}

void NodeStatic::FatalException(TryCatch &try_catch) {
  static int uncaught_exception_counter = 0;

  HandleScope scope;
  // FIXME: check why the context is not available in some callbacks
  // test-http-buffer-sanity.js in browser
  Local<Context> context;
  if (Context::InContext()) {
    context = Context::GetCurrent();
  } else {
    NODE_LOGW("%s, does not have a context", __FUNCTION__);
    context = try_catch.Exception().As<Object>()->CreationContext();
  }

  // Check if uncaught_exception_counter indicates a recursion
  Context::Scope context_scope(context);
  Handle<Object> process = si()->TestGetCurrentProcess();
  if (uncaught_exception_counter > 0 || process.IsEmpty()) {
    NODE_ASSERT(0);
    si()->ReportException(try_catch, true);
    si()->s_nodes[0]->SetTestStatus(FAILED);
    return;
  }

  Node *n = GetNodeFromProcess(process);
  if (n->m_testState == DONE) {
    return;
  }
  n->SetTestState(DONE);

  static Persistent<String> listeners_symbol;
  static Persistent<String> uncaught_exception_symbol;
  static Persistent<String> emit_symbol;
  if (listeners_symbol.IsEmpty()) {
    listeners_symbol = NODE_PSYMBOL("listeners");
    uncaught_exception_symbol = NODE_PSYMBOL("uncaughtException");
    emit_symbol = NODE_PSYMBOL("emit");
  }

  Local<Value> listeners_v = process->Get(listeners_symbol);
  NODE_ASSERT(listeners_v->IsFunction());
  Local<Function> listeners = Local<Function>::Cast(listeners_v);
  Local<String> uncaught_exception_symbol_l = Local<String>::New(uncaught_exception_symbol);
  Local<Value> argv[1] = { uncaught_exception_symbol_l  };
  Local<Value> ret = listeners->Call(process, 1, argv);
  //NODE_ASSERT(!ret.IsEmpty() && ret->IsArray());

  if (!ret.IsEmpty() && ret->IsArray() ) {
    // Report and exit if process has no "uncaughtException" listener
    Local<Array> listener_array = Local<Array>::Cast(ret);
    if (listener_array->Length() == 0) {
      si()->ReportException(try_catch, true);
      n->SetTestStatus(FAILED);
      return;
    }
  } else {
    si()->ReportException(try_catch, true);
    n->SetTestStatus(FAILED);
    return;
  }

  // Otherwise fire the process "uncaughtException" event
  Local<Value> emit_v = process->Get(emit_symbol);
  NODE_ASSERT(emit_v->IsFunction());
  Local<Function> emit = Local<Function>::Cast(emit_v);
  Local<Value> error = try_catch.Exception();
  Local<Value> event_argv[2] = { uncaught_exception_symbol_l, error };
  uncaught_exception_counter++;
  emit->Call(process, 2, event_argv);
  // Decrement so we know if the next exception is a recursion or not
  uncaught_exception_counter--;

  // proteus: its important we dont exit here
  // FIXME: check test/simple/test-next-tick-errors.js
}

void Node::FatalException(TryCatch &try_catch) {
  si()->FatalException(try_catch);
}

Handle<Value> NodeStatic::CreateExportsObject(const Arguments& args) {
  HandleScope scope;

  Local<Object> exports;
  Local<FunctionTemplate> exports_template = FunctionTemplate::New();
  exports_template->InstanceTemplate()->SetInternalFieldCount(2);
  exports = exports_template->GetFunction()->NewInstance();

  // proteus: slot 1 to be filled by the module with the native module object
  exports->SetPointerInInternalField(0, GetNodeFromProcess(args.Holder()));
  return scope.Close(exports);
}

void Node::CancelActivity() {
  for (vector<NodeModule* >::iterator it = m_modules.begin();
      it != m_modules.end(); it++) {
    NODE_LOGV("%s, send release event to module %p", __FUNCTION__, *it);
    InternalEvent e;
    e.type = INTERNAL_EVENT_RELEASE;
    (*it)->HandleInternalEvent(&e);
  }
}

Handle<Value> NodeStatic::TestDeleteNode(const Arguments& args) {
  Node *n = GetNodeFromProcess(args.Holder());
  delete n;
  return Undefined();
}

Handle<Value> NodeStatic::AcquireLock(const Arguments& args) {
  NODE_ASSERT(args.Length() > 0 && args[0]->IsFunction());
  Node *n = GetNodeFromProcess(args.Holder());
  Persistent<Function> acquireLockJSCallback = Persistent<Function>::New(Local<Function>::Cast(args[0]));

  si()->s_lockList.push_back(acquireLockJSCallback);

  if ((si()->s_lockState != true) && (si()->s_lockList.size() > 0)){
    si()->s_lockState = true;
    Persistent<Function> lockJSCallback = si()->s_lockList[0];
    lockJSCallback->Call(n->m_context->Global(), 0, 0);
  }

  return Undefined();
}


Handle<Value> NodeStatic::ReleaseLock(const Arguments& args) {
  NODE_ASSERT(args.Length() == 0);
  if (si()->s_lockState != false){ //TODO: Need to validate if the same person who lock is unlocking.???
    si()->s_lockState = false;
    if(!si()->s_lockList.empty()){

      si()->s_lockList.erase(si()->s_lockList.begin()); // remove the first entry
      // check if we have more item in vector
      if (si()->s_lockList.size() > 0 ) {
	si()->s_lockState = true;
	Node *n = GetNodeFromProcess(args.Holder());
	Persistent<Function> lockJSCallback = si()->s_lockList[0];
	lockJSCallback->Call(n->m_context->Global(), 0, 0);
      }
    }
  }
  else{
    return ThrowException(Exception::Error(
      String::New("Called without calling Acquire")));
  }
  return Undefined();
}

Handle<Value> NodeStatic::GetModuleUpdates(const Arguments& args) {
  NODE_ASSERT(args.Length() == 0);
  if (si()->s_updateCheck == -1){
    si()->s_updateCheck = 1;
  }
  return Integer::New(si()->s_updateCheck);
}

Handle<Value> NodeStatic::SetModuleUpdates(const Arguments& args) {

  NODE_LOGI("Node::SetModuleUpdates: ");
  if (args.Length() < 1 && !args[0]->IsInt32())  {
    NODE_LOGI("invalid param");
    return ThrowException(Exception::Error(
      String::New("SetModuleUpdates requires 1 argument")));
  }
  else
  {
    si()->s_updateCheck = args[0]->Int32Value();
    return Undefined();
  }
}


Handle<Value> NodeStatic::RegisterPermissionFeatures(const Arguments& args) {
  NODE_LOGD("Node::RegisterPermissionFeatures");
  vector<string> featureList;
  v8::Local<v8::Array> nodeEventFeaturesList = v8::Local<v8::Array>::Cast(args[0]);

  for(unsigned int i = 0; i < nodeEventFeaturesList->Length(); i++) {
    String::AsciiValue featureName(nodeEventFeaturesList->Get(i)->ToString());
    featureList.push_back(string(*featureName));
  }

  // Get the current node instance
  Node *n = GetNodeFromProcess(args.Holder());
  NODE_ASSERT(n);
  NODE_ASSERT(n->client());

  // Enter browser context
  Context::Scope cscope(n->m_browserContext);
  NodeEvent e;
  e.type = NODE_EVENT_FP_REGISTER_PRIVILEGED_FEATURES;
  e.u.RegisterPrivilegedFeaturesEvent_.features = &featureList;
  n->client()->HandleNodeEvent(&e);
  return Boolean::New(true);
}

Handle<Value> NodeStatic::RequestPermission(const Arguments& args) {
  NODE_LOGF();

  // Get the current node instance
  Node *n = GetNodeFromProcess(args.Holder());
  NODE_ASSERT(n);

  // Get to window.navigator.navigatorPermissions
  Context::Scope cscope(n->m_browserContext);
  Handle<Object> browserGlobal = n->m_browserContext->Global();
  NODE_ASSERT(!browserGlobal.IsEmpty());

  Handle<Value> navigator = browserGlobal->Get(String::NewSymbol("navigator"));
  NODE_ASSERT(navigator->IsObject());

  Handle<Value> navigatorPermissionsV = navigator->ToObject()->Get(String::NewSymbol("navigatorPermissions"));
  NODE_ASSERT(navigatorPermissionsV->IsObject());
  Handle<Object> navigatorPermissions = navigatorPermissionsV->ToObject();

  // navigatorPermissions.requestPermission
  Handle<Value> requestPermissionV = navigatorPermissions->Get(String::NewSymbol("requestPermission"));
  NODE_ASSERT(requestPermissionV->IsFunction());

  Handle<Function> requestPermission = Handle<Function>::Cast(requestPermissionV);
  Local<Value> args_[] = { args[0], args[1] };

  return requestPermission->Call(navigatorPermissions, 2, args_);
}

Handle<Value> NodeStatic::HasBinding(const Arguments& args) {
  HandleScope scope;

  Local<String> module = args[0]->ToString();
  String::Utf8Value module_v(module);

  Node::node_module_struct* modp;
  Node *n = GetNodeFromProcess(args.Holder());
  bool hasBinding = false;
  if (n->m_bindingCache->Has(module)) {
    hasBinding = true;
  } else if ((modp = Node::get_builtin_module(*module_v)) != NULL) {
    hasBinding = true;
  }
  NODE_LOGV("%s, module: %s, hasBinding: %d", __FUNCTION__, *module_v, hasBinding);
  return scope.Close(v8::Boolean::New(hasBinding));
}

Handle<Value> NodeStatic::Binding(const Arguments& args) {
  HandleScope scope;

  Local<String> module = args[0]->ToString();
  String::Utf8Value module_v(module);
  Node::node_module_struct* modp;
  NODE_LOGD("%s, loading module (%s)", __FUNCTION__, *module_v);

  Node *n = GetNodeFromProcess(args.Holder());
  if (n->m_bindingCache.IsEmpty()) {
    n->m_bindingCache = Persistent<Object>::New(Object::New());
  }

  Local<Object> exports;
  if (n->m_bindingCache->Has(module)) {
    NODE_LOGD("%s, loading module (%s) from cache", __FUNCTION__, *module_v);
    exports = n->m_bindingCache->Get(module)->ToObject();
  } else if ((modp = Node::get_builtin_module(*module_v)) != NULL) {
    // proteus: we create a v8 object that can hold internal fields
    // slot 0 - node reference that this module exists in
    // slot 1 - native module object that implements 'NodeModule' and filled by the module
    Local<FunctionTemplate> exports_template = FunctionTemplate::New();
    exports_template->InstanceTemplate()->SetInternalFieldCount(2);
    exports = exports_template->GetFunction()->NewInstance();
    exports->SetPointerInInternalField(0, GetNodeFromProcess(args.Holder()));
    modp->register_func(exports);
    n->m_bindingCache->Set(module, exports);
    NODE_LOGD("loaded core native module (%s) in node (%p)", *module_v, n);
  } else if (!strcmp(*module_v, "constants")) {
    exports = Object::New();
    DefineConstants(exports);
    n->m_bindingCache->Set(module, exports);
  } else if (!strcmp(*module_v, "io_watcher")) {
    NODE_LOGD("loaded core native module (io_watcher) in node (%p)", n);
    exports = Object::New();
    IOWatcher::Initialize(exports);
    n->m_bindingCache->Set(module, exports);
  } else if (!strcmp(*module_v, "timer")) {
    exports = Object::New();
    Timer::Initialize(exports);
    n->m_bindingCache->Set(module, exports);
    NODE_LOGD("loaded core module (timer) in node (%p)", n);
  } else if (!strcmp(*module_v, "natives")) {
    NODE_LOGD("loaded core (natives) module loaded in node (%p)", n);
    exports = Object::New();
    DefineJavaScript(exports, n);
    n->m_bindingCache->Set(module, exports);
  } else {
    NODE_LOGW("%s, No such module: %s", __FUNCTION__, *module_v);
    return ThrowException(Exception::Error(String::New("No such module")));
  }
  return scope.Close(exports);
}

Handle<Value> NodeStatic::ProcessLog(const Arguments& args) {
  HandleScope scope;

  // log(level, message);
  NODE_ASSERT(args[0]->IsNumber());
  NODE_ASSERT(args[1]->IsString());
  String::Utf8Value message(args[1]);
  __android_log_print_wrap(args[0]->ToNumber()->Value(), "node-js", *message);
  return Undefined();
}

void Node::TestStart(const char *moduleName) {
  m_moduleName = moduleName;

  const char *target = si()->s_isAndroid ? (si()->s_isBrowser ? "BROWSER" : "  SHELL") : "DESKTOP";
  NODE_LOGE("|%s| Test %9s: %s", target, "STARTED", moduleName);
  SetTestState(STARTED);
  SetTestStatus(PASSED); // reset test state
  m_stopWatch.start();

  // Clear any listeners on the process object (EventEmitter.prototype.removeAllListeners)
  // Fix for, test 1 throws exception, test 2 will also fire its event handler
  // FIXME: This may impact non-test mode which relies on events fired on previous loadModules
  Local<Value> removeAllListeners_v = m_process->Get(String::NewSymbol("removeAllListeners"));
  NODE_ASSERT(removeAllListeners_v->IsFunction());
  Local<Function> removeAllListeners = Local<Function>::Cast(removeAllListeners_v);
  Local<Value> argv[] = { };
  removeAllListeners->Call(m_process, 0, argv);
}

Handle<Value> NodeStatic::TestStart(const Arguments& args) {
  NODE_LOGF();

  HandleScope scope;
  NODE_ASSERT(args[0]->IsString());
  String::Utf8Value moduleName(args[0]);
  Node *n = GetNodeFromTest(args.Holder());
  n->TestStart(*moduleName);
 return Undefined();
}

void Node::TestDone() {
  // set state..
  SetTestState(DONE);

  // report result
  ReportTestResult();

  // let the client know..
  NODE_ASSERT(m_client);
  m_client->OnTestDone();
}

Handle<Value> NodeStatic::TestCheck(const Arguments& args) {
  NODE_LOGF();

  HandleScope scope;
  int activecnt = ev_activecnt(ev_default_loop());
  if (activecnt == 0) {
    NODE_LOGI("%s, no watchers added in loadModule, sending done event", __FUNCTION__);
    Node *n = GetNodeFromTest(args.Holder());
    n->TestDone();
  } else {
    NODE_LOGV("%s, watchers active after loadModule complete", __FUNCTION__, activecnt);
  }
  return Undefined();
}

Handle<Value> NodeStatic::TestFail(const Arguments& args) {
  NODE_LOGF();
  Node *n = GetNodeFromTest(args.Holder());
  n->SetTestStatus(FAILED);
  n->TestDone();
  return Undefined();
}

Handle<Value> NodeStatic::TestPrintJSObject(const Arguments& args) {
#ifdef V8_DEBUG
  args[0].As<Object>()->Print();
#else
  NODE_LOGE("printJSObject disabled");
#endif
  return Undefined();
}

Handle<Value> NodeStatic::TestGetAddress(const Arguments& args) {
#ifdef V8_DEBUG
  char s[20] = "";
  snprintf(s, sizeof(s), "%p", args[0].As<Object>()->Address());
  return String::New(s);
#else
  return String::New("<unknown>");
#endif
}

// test-net-remote-address-port.js
v8::Handle<v8::Value> NodeStatic::ReallyExit(const v8::Arguments& args) {
  NODE_LOGF();
  HandleScope scope;
  Node *n = GetNodeFromProcess(args.Holder());
  n->SetTestState(DONE);
  return Undefined();
}

Handle<Value> NodeStatic::TestBreak(const Arguments& args) {
  NODE_LOGF();
  HandleScope scope;
  NODE_LOGI("---------<break js stack> -----------");
  Message::PrintCurrentStackTrace(stdout);
  NODE_LOGI("-------------------------------------");
  raise(SIGTRAP);
  return Undefined();
}

Handle<Value> NodeStatic::TestRunScript(const Arguments& args) {
  NODE_LOGF();
  HandleScope scope;
  if (!args[0]->IsString()) {
    return ThrowException(Exception::Error(String::New("Invalid args")));
  }

  return Node::RunScriptInServiceNode(args[0]->ToString());
}

void Node::SetupProcessObject() {
  NODE_LOGF();

  HandleScope scope;
  NODE_ASSERT(Context::InContext());

  Local<FunctionTemplate> process_template = FunctionTemplate::New();
  process_template->InstanceTemplate()->SetInternalFieldCount(1);
  m_process = Persistent<Object>::New(process_template->GetFunction()->NewInstance());
  m_process->SetPointerInInternalField(0, this);

  Local<FunctionTemplate> test_template = FunctionTemplate::New();
  test_template->InstanceTemplate()->SetInternalFieldCount(1);
  m_test = Persistent<Object>::New(process_template->GetFunction()->NewInstance());
  m_test->SetPointerInInternalField(0, this);

  // define various internal methods
  NODE_SET_METHOD(m_process, "compile", NodeStatic::Compile);
  NODE_SET_METHOD(m_process, "_needTickCallback", NodeStatic::NeedTickCallback);
  NODE_SET_METHOD(m_process, "reallyExit", NodeStatic::ReallyExit);
  NODE_SET_METHOD(m_process, "dlopen", NodeStatic::DLOpen);
  NODE_SET_METHOD(m_process, "binding", NodeStatic::Binding);
  NODE_SET_METHOD(m_process, "hasBinding", NodeStatic::HasBinding);
  NODE_SET_METHOD(m_process, "log", NodeStatic::ProcessLog);

  // proteus: used to create a new js object that can hold internal fields
  NODE_SET_METHOD(m_process, "createExportsObject", NodeStatic::CreateExportsObject);

  // proteus: used to register a feature for Permissions API use
  NODE_SET_METHOD(m_process, "registerPermissionFeatures", NodeStatic::RegisterPermissionFeatures);
  NODE_SET_METHOD(m_process, "requestPermission", NodeStatic::RequestPermission);

  // proteus: used to lock when loadmodule or checkUpdate is called
  NODE_SET_METHOD(m_process, "acquireLock", NodeStatic::AcquireLock);

  // proteus: used to unlock when loadmodule or checkUpdate is done
  NODE_SET_METHOD(m_process, "releaseLock", NodeStatic::ReleaseLock);
  NODE_SET_METHOD(m_process, "getModuleUpdates", NodeStatic::GetModuleUpdates);
  NODE_SET_METHOD(m_process, "setModuleUpdates", NodeStatic::SetModuleUpdates);

  // module root
  NODE_ASSERT(!si()->s_appPath.empty());
  NODE_ASSERT(!si()->s_moduleDownloadPath.empty());
  m_process->Set(String::NewSymbol("appPath"), String::New(si()->s_appPath.c_str()));
  m_process->Set(String::NewSymbol("downloadPath"), String::New(si()->s_moduleDownloadPath.c_str()));
  m_process->Set(String::NewSymbol("url"), String::New(m_client->url().c_str()));
  m_process->Set(String::NewSymbol("window"), m_browserContext->Global());

  // set the browser pages global object (window) as process.window
  m_process->Set(String::NewSymbol("window"), m_browserContext->Global());

  // create test object
  NODE_SET_METHOD(m_test, "stack", NodeStatic::TestStack);
  NODE_SET_METHOD(m_test, "ref", NodeStatic::TestRef);
  NODE_SET_METHOD(m_test, "unref", NodeStatic::TestUnref);
  NODE_SET_METHOD(m_test, "watcherStats", NodeStatic::TestWatcherStats);
  NODE_SET_METHOD(m_test, "printJSObject", NodeStatic::TestPrintJSObject);
  NODE_SET_METHOD(m_test, "getAddress", NodeStatic::TestGetAddress);
  NODE_SET_METHOD(m_test, "start", NodeStatic::TestStart);
  NODE_SET_METHOD(m_test, "check", NodeStatic::TestCheck);
  NODE_SET_METHOD(m_test, "fail", NodeStatic::TestFail);
  NODE_SET_METHOD(m_test, "break", NodeStatic::TestBreak);
  NODE_SET_METHOD(m_test, "runScript", NodeStatic::TestRunScript);

  // proteus: destroys the current node, useful for simulating destroying a page and testing
  // activity cancellation in different modules (e.g. fs should stop all watchers)
  NODE_SET_METHOD(m_test, "deleteNode", NodeStatic::TestDeleteNode);

  Local<Object> global = Context::GetCurrent()->Global();
  global->Set(String::New("test"), m_test);
}

void Node::Load() {
  NODE_LOGF();

  // Compile, execute the src/node.js file. (Which was included as static C
  // string in node_natives.h. 'natve_node' is the string containing that
  // source code.)
  // The node.js file returns a function 'f'
  TryCatch try_catch;
  Local<Value> f_value = ExecuteString(MainSource(), IMMUTABLE_STRING("node.js"));
  if (try_catch.HasCaught())  {
    si()->ReportException(try_catch, true);
    NODE_LOGE("Test **FAILED: %s", si()->s_nodes[0]->m_moduleName.c_str());
    return;
  }

  NODE_ASSERT(f_value->IsFunction());
  Local<Function> f = Local<Function>::Cast(f_value);

  // Now we call 'f' with the 'process' variable that we've built up with
  // all our bindings. Inside node.js we'll take care of assigning things to
  // their places.

  // We start the process this way in order to be more modular. Developers
  // who do not like how 'src/node.js' setups the module system but do like
  // Node's I/O bindings may want to replace 'f' with their own function.

  // Add a reference to the global object
  Local<Object> global = m_context->Global();
  NODE_ASSERT(global->IsObject());
  Local<Value> args[1] = { Local<Value>::New(m_process) };

  Local<Value> loadModuleV = f->Call(global, 1, args);
  if (try_catch.HasCaught())  {
    NODE_LOGE("%s: Critical Error, try_catch.HasCaught() == true", __FUNCTION__);
    si()->ReportException(try_catch, true);
    return;
  }

  // proteus: This should be after the try catch, otherwise we wouldnt catch any compilation errors
  NODE_ASSERT(loadModuleV->IsFunction());
  m_loadModule = Persistent<Function>::New(Local<Function>::Cast(loadModuleV));

  Local<Value> loadModuleSyncV = global->Get(String::NewSymbol("loadModuleSync"));
  m_loadModuleSync = Persistent<Function>::New(Local<Function>::Cast(loadModuleSyncV));
}

v8::Handle<v8::Function> Node::GetLoadModule() {
  NODE_ASSERT(!m_loadModule.IsEmpty());
  NODE_ASSERT(m_loadModule->IsFunction());

  // error case
  if (m_loadModule.IsEmpty() || !m_loadModule->IsFunction()) {
    return Handle<Function>();
  }
  return m_loadModule;
}

v8::Handle<v8::Function> Node::GetLoadModuleSync() {
  NODE_ASSERT(!m_loadModuleSync.IsEmpty());
  NODE_ASSERT(m_loadModuleSync->IsFunction());
  return m_loadModuleSync;
}

// we expose this api so that we can catch errors reported by
// loadModule in browser
Handle<Value> Node::LoadModule(const Arguments& args) {
  NODE_LOGF();
  NODE_ASSERT(!m_loadModule.IsEmpty());
  NODE_ASSERT(m_loadModule->IsFunction());

  // enter the node context
  HandleScope scope;
  Context::Scope cscope(m_context);

  TryCatch try_catch;
  Handle<Object> holder = args.Holder()->ToObject();
  Local<Value> args_[] = { args[0], args[1], args[2] };
  Local<Value> ret = m_loadModule->Call(holder, 3, args_);
  if (try_catch.HasCaught()) {
    si()->FatalException(try_catch);
    return Undefined();
  }
  return scope.Close(ret);
}

Handle<Value> Node::LoadModuleSync(const Arguments& args) {
  NODE_LOGF();
  NODE_ASSERT(!m_loadModuleSync.IsEmpty());
  NODE_ASSERT(m_loadModuleSync->IsFunction());

  // enter the node context
  HandleScope scope;
  Context::Scope cscope(m_context);

  TryCatch try_catch;
  Handle<Object> holder = args.Holder()->ToObject();
  Local<Value> args_[] = { args[0] };
  Local<Value> ret = m_loadModuleSync->Call(holder, 1, args_);
  if (try_catch.HasCaught()) {
    si()->FatalException(try_catch);
    return Undefined();
  }
  return scope.Close(ret);
}

static int RegisterSignalHandler(int signal, void (*handler)(int)) {
  struct sigaction sa;

  memset(&sa, 0, sizeof(sa));
  sa.sa_handler = handler;
  sigfillset(&sa.sa_mask);
  return sigaction(signal, &sa, NULL);
}

// Bootup node
void NodeStatic::Initialize() {
  NODE_LOGF();

  // FIXME: is this ok in browser context
  // required for test test/simple/test-http-expect-continue.js
  RegisterSignalHandler(SIGPIPE, SIG_IGN);
  RegisterSignalHandler(SIGTRAP, SIG_IGN);
  ReadDebugLevel();
  uv_init();

  // FIXME: do we need to initialize v8 in the case of browser,
  // should be harmless anyways
  V8::Initialize();

  // Setup the EIO thread pool. It requires 3, yes 3, watchers.
  uv_idle_init(&s_eio_poller);
  uv_idle_start(&s_eio_poller, DoPoll);
  NODE_LOGV("s_eio_poller(%p) started", &s_eio_poller);
  idle_inc(); // since uv_idle_init doesnt have a uv_unref

  uv_async_init(&s_eio_want_poll_notifier, WantPollNotifier);
  uv_unref();

  uv_async_init(&s_eio_done_poll_notifier, DonePollNotifier);
  uv_unref();

  eio_init(EIOWantPoll, EIODonePoll);

  // Don't handle more than 10 reqs on each eio_poll(). This is to avoid
  // race conditions. See test/simple/test-eio-race.js
  eio_set_max_poll_reqs(10);
  memset(&s_watchers_active, 0, sizeof(s_watchers_active));

  // start the event loop
  RunEventLoop();
}


void Node::Init() {
  uv_prepare_init(&m_prepare_tick_watcher);
  m_prepare_tick_watcher.data = this;
  uv_prepare_start(&m_prepare_tick_watcher, NodeStatic::PrepareTick);
  uv_unref();

  uv_check_init(&m_check_tick_watcher);
  m_check_tick_watcher.data = this;
  uv_check_start(&m_check_tick_watcher, NodeStatic::CheckTick);
  uv_unref();

  uv_idle_init(&m_tick_spinner);
  m_tick_spinner.data = this;
  uv_unref();

  SetupProcessObject();

#ifdef V8_DEBUG
  NODE_LOGD("%s, node(%p), global(%p), process(%p), context(%p) browserContext(%p)",
      __FUNCTION__, this, m_context->Global()->Address(), m_process->Address(),
      m_context->Address(), m_browserContext->Address());
#endif
}

void Node::EmitEvent(const char* event) {
  // caller may not have a handle scope
  // ./node test/simple/test-fs-read.js test/simple/test-fs-write.js
  HandleScope scope;
  NODE_LOGV("%s, event(%s)", __FUNCTION__, event);
  Local<Value> emit_v = m_process->Get(String::New("emit"));
  NODE_ASSERT(emit_v->IsFunction());
  Local<Function> emit = Local<Function>::Cast(emit_v);
  Local<Value> args[] = { String::New(event) };
  TryCatch try_catch;
  emit->Call(m_process, 1, args);
  if (try_catch.HasCaught()) {
    si()->ReportException(try_catch, true);
    SetTestStatus(FAILED);
  }
}

void Node::Initialize(bool isBrowser, std::string moduleRootPath) {
  static bool initialized = false;
  NODE_ASSERT(!initialized);
  if (!initialized) {
    NodeStatic::create(isBrowser, moduleRootPath);
  }
  initialized = true;
}

// node statics..
Node::Node(NodeClient *client)
  : m_testStatus(PASSED)
  , m_testState(INIT)
  , m_moduleName("(unknown)")
  , m_client(client)
{
  NODE_ASSERT(si());

  // This is required before we do the first initialize, since the thread needs it to send
  // back events and it uses s_nodes[0] - check the issue in debugger
  // run test/simple/test-fs-read.js test/simple/test-fs-write.js
  // do not add the service node to the list..
  if (client) {
    si()->s_nodes.push_back(this);
  }

  NODE_LOGI("** %s, this(%p) client(%p)", __PRETTY_FUNCTION__, this, client);

  // hold a reference to the browser context..
  m_browserContext = Persistent<Context>::New(Context::GetCurrent());

  // REQ: node modules run in a separate v8 context called the node context
  m_context = Context::New();
  si()->s_contexts.push_back(&m_context);
  m_context->SetSecurityToken(m_browserContext->GetSecurityToken());

  // enter the node context
  Context::Scope cscope(m_context);

  // initialize watchers
  memset(&m_watchers_active, 0, sizeof(m_watchers_active));

  Init();
  NODE_LOGD("%s, node::Init() complete", __FUNCTION__);

  Load();
  NODE_LOGD("%s, node::Load() complete", __FUNCTION__);

  // reset the stopwatch
  m_stopWatch.start();
}

Node::~Node(){
  NODE_LOGF();

  // This could be called by NodeProxy, switch to node context..
  Context::Scope cscope(m_context);

  // send event on process object, this can be used by the modules/module objects
  // to clean up (e.g. camera object could disconnect, file module could clean up watchers etc)
  EmitEvent("exit");

  // tests cant be run in service node
  if (m_client) {
    TestDone();
  }

  // remove us from the global list of nodes..
  for (vector<Persistent<Context>* >::iterator it = si()->s_contexts.begin();
      it != si()->s_contexts.end(); it++) {
    if (*it == &m_context) {
      si()->s_contexts.erase(it);
      break;
    }
  }

  // dispose all the handles, no need to clear since we dont use them after this
  m_context.Dispose();
  m_browserContext.Dispose();
  m_process.Dispose();
  m_bindingCache.Dispose();
  m_test.Dispose();

  NODE_LOGD("%s, %d modules released from the current node (%p)",__FUNCTION__, m_modules.size(), this);
  for (vector<NodeModule* >::iterator it = m_modules.begin();
      it != m_modules.end(); it++) {
    NODE_LOGV("%s, releasing module (%d:%p)", __FUNCTION__, (*it)->Module(), *it);
    InternalEvent e;
    e.type = INTERNAL_EVENT_RELEASE;
    (*it)->HandleInternalEvent(&e);
  }

  // stop all watchers for this node instance
  NODE_LOGV("%s, stopping watcher (%p)",__FUNCTION__, &m_prepare_tick_watcher.prepare_watcher);
  uv_prepare_stop(&m_prepare_tick_watcher);

  NODE_LOGV("%s, stopping watcher (%p)",__FUNCTION__, &m_check_tick_watcher.check_watcher);
  uv_check_stop(&m_check_tick_watcher);

  //remove this from vector
  bool found = false;
  for (vector<Node* >::iterator it = si()->s_nodes.begin();
      it != si()->s_nodes.end(); it++) {
    if (*it == this) {
      si()->s_nodes.erase(it);
      found = true;
      break;
    }
  }
  NODE_ASSERT(found);

  // let the client know we are gone
  if (m_client)
    m_client->OnDelete();

  NODE_LOGI("node (%p) deleted", this);
}

// REQ: Modules interested in webkit broadcast events can register to the node instance
void Node::RegisterNodeModule(NodeModule *e) {
  NODE_LOGV("%s, registering module (%d:%p)", __FUNCTION__, e->Module(), e);
  m_modules.push_back(e);
}

void Node::HandleGenericWebKitEvent(WebKitEvent* e) {
  NODE_LOGF();
  NODE_NI();
}

void Node::HandleWebKitEvent(WebKitEvent* e) {
  NODE_LOGF();
  vector<NodeModule*>::iterator it;
  for (it = m_modules.begin(); it != m_modules.end(); it++) {
    NODE_LOGV("%s, sending event to module (%d:%p)", __FUNCTION__, (*it)->Module(), *it);
    (*it)->HandleWebKitEvent(e);
  }
}

////////////////////////////////// Implementation of libev thread ///////////////////////////////
void NodeStatic::RunEventLoop() {
  NODE_LOGF();

  static bool called = false;
  NODE_ASSERT(!called);
  called = true;

  // set the ev_invoke_pending method and start the ev_run in separate thread
  NODE_LOGD("%s,** invoking ev loop thread", __FUNCTION__);
  ev_set_invoke_pending_cb(ev_default_loop(), EvThreadPendingCallback);
  pthread_create(&s_thread, 0, EvThreadRun, 0);
}

bool NodeStatic::InvokePending() {
  s_testDone = false;

  pthread_mutex_lock(&s_mutex);

  NODE_LOGM("ev_invoke_pending()");
  ev_invoke_pending(ev_default_loop());
  pthread_cond_signal(&s_cond);

  NODE_LOGM("%s, pthread_cond_signal from main thread", __FUNCTION__);
  pthread_mutex_unlock(&s_mutex);

  return s_testDone;
}

bool Node::InvokePending() {
  return si()->InvokePending();
}

// REQ: There's one libev thread to handle requests from all the node instances in the browser process
void* NodeStatic::EvThreadRun(void *unused) {
  NODE_LOGF();

  // we keep this lock as long as we are processing events in libev thread
  // we release it only when we wait on a condition when the main thread needs
  // to process events through ev_invoke_pending
  pthread_mutex_lock(&si()->s_mutex);

  while (true) {
    // FIXME: review the current value (10ms)
    // REQ: when there are no active watchers, the libev thread should sleep
    //   >: and poll back every 10ms for new requests
    if (!ev_activecnt(ev_default_loop())) {
      NODE_LOGM("%s, no active watchers sleeping..", __FUNCTION__);
      ev_sleep(.01);
      continue;
    }

    // call to libev loop
    NODE_LOGI("libev thread/loop started");
    ev_run(ev_default_loop(), 0);
    NODE_LOGI("libev thread/loop ended");

    // send done event to the embedder, used in test mode..
    if (si()->s_nodes.size() > 0) {
      NodeEvent ev;
      ev.type = NODE_EVENT_LIBEV_DONE;
      si()->s_nodes[0]->client()->HandleNodeEvent(&ev);
    } else {
      NODE_LOGW("%s, events pending with ev thread with no active node instance", __FUNCTION__);
    }
  }

  // Ev thread should never exit in the current design where we do not restart
  NODE_ASSERT(0);
  pthread_mutex_unlock(&si()->s_mutex);
  return 0;
}

void NodeStatic::EvThreadPendingCallback(struct ev_loop *loop){
  if (si()->s_nodes.size() == 0) {
    return;
  }

  NODE_LOGM("%s", __FUNCTION__);
  NODE_ASSERT(loop == ev_default_loop()); // we have only one loop, default loop
  while (ev_pending_count(loop)){
    NODE_LOGM("%s, handling pending callbacks", __FUNCTION__);
    NodeEvent ev;
    ev.type = NODE_EVENT_LIBEV_INVOKE_PENDING;
    si()->s_nodes[0]->client()->HandleNodeEvent(&ev);
    NODE_LOGM("%s, pthread_cond_wait from ev thread", __FUNCTION__);
    pthread_cond_wait(&si()->s_cond, &si()->s_mutex);
  }
}

/////////////////////////////////////////////Test functions///////////////////////////////
void NodeStatic::HandleSIGSEGV(int signal) {
  NODE_LOGE("Test **CRASHED: %s", si()->s_nodes[0]->m_moduleName.c_str());
  exit(0);
}

void NodeStatic::DumpWatcherStats(uv_counters_t *uvc){
  NODE_LOGD("watchers: %2lld", uvc->handle_init);
  NODE_LOGD("prepare : %2lld", uvc->prepare_init);
  NODE_LOGD("check   : %2lld", uvc->check_init);
  NODE_LOGD("idle    : %2lld", uvc->idle_init);
  NODE_LOGD("async   : %2lld", uvc->async_init);
  NODE_LOGD("timer   : %2lld", uvc->timer_init);
  NODE_LOGD("req     : %2lld", uvc->req_init);
  NODE_LOGD("tcp     : %2lld", uvc->tcp_init);
  NODE_LOGD("io      : %2lld", uvc->io_init);
}

// should match TestStatus
const char* TestString[] = {"**FAILED","PASSED", "**CRASHED"};
void Node::ReportTestResult() {
  if (m_testState == REPORTED) {
    NODE_LOGW("%s, Test already reported returning", __FUNCTION__);
    return;
  }

  // if the test has not failed, emit exit so that process.exit
  // gets executed and it can NODE_ASSERT output, so the test can still
  // fail after this call
  if (m_testStatus != FAILED) {
    EmitEvent("exit");
  }

  const char *target = si()->s_isAndroid ? (si()->s_isBrowser ? "BROWSER" : "  SHELL") : "DESKTOP";
  NODE_LOGE("|%s| Test %9s: %s (%d)", target,
      TestString[m_testStatus], m_moduleName.c_str(), m_stopWatch.stop());
  NODE_LOGI("active watchers: %d", ev_activecnt(ev_default_loop()));
  SetTestState(REPORTED);
}

void NodeStatic::ReportTestStatus() {
  NODE_LOGV("%s, s_nodes(%d)", __FUNCTION__, s_nodes.size());
  vector<Node* >::iterator it = s_nodes.begin();
  for (;it != s_nodes.end(); it++) {
    if ((*it)->m_testState == DONE) {
      Context::Scope cscope((*it)->m_context);
      (*it)->ReportTestResult();
    }
  }
}

void Node::CheckTestStatus(bool allNodesDone) {
  if (allNodesDone) {
    vector<Node* >::iterator it = si()->s_nodes.begin();
    for (;it != si()->s_nodes.end(); it++) {
      if ((*it)->m_testState == STARTED) {
        (*it)->m_testState = DONE;
      }
    }
  }
  si()->ReportTestStatus();
  si()->s_testDone = false;
}

Handle<Value> NodeStatic::TestRef(const Arguments& args) {
  NODE_LOGF();
  ev_ref(ev_default_loop());
  return Undefined();
}

Handle<Value> NodeStatic::TestUnref(const Arguments& args) {
  NODE_LOGF();
  ev_unref(ev_default_loop());
  return Undefined();
}

Handle<Value> NodeStatic::TestStack(const Arguments& args) {
  NODE_LOGF();
  NODE_LOGI("---------<js stack>-----------");
  Message::PrintCurrentStackTrace(stdout);
  NODE_LOGI("------------------------------");
  return Undefined();
}

Handle<Value> NodeStatic::TestWatcherStats(const Arguments& args) {
  NODE_LOGD("%s, all watchers (active/inactive)", __FUNCTION__);
  si()->DumpWatcherStats(uv_counters());
  NODE_LOGD("%s, all active watchers ", __FUNCTION__);
  si()->DumpWatcherStats(&si()->s_watchers_active);
  return Undefined();
}

Handle<Object> NodeStatic::TestGetCurrentProcess() {
  // use parent handle scope
  NODE_ASSERT(Context::InContext());
  Local<Value> process_v =
    Context::GetCurrent()->Global()->Get(String::NewSymbol("process"));

  // FIXME: we need to find a way to get the process from the TryCatch
  // for now we use the first process object from the static node list
  if (process_v->IsUndefined()) {
    if (s_nodes.size() == 0 || s_nodes[0]->m_process.IsEmpty()) {
      return Local<Object>();
    }
    return s_nodes[0]->m_process;
  }
  return Local<Object>::Cast(process_v);
}

//FIXME: by default we log up to info, to be revisited
const char *LOG_STRING[] = {
  "UNKNOWN", "_DEFAULT", "VERBOSE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "SILENT"
};

static android_LogPriority s_debugLevel = ANDROID_LOG_WARN;
android_LogPriority NodeStatic::StringToLog(const char* log) {
  for (unsigned int i = 0; i < sizeof(LOG_STRING)/sizeof(*LOG_STRING); i++) {
    if (log[0] == LOG_STRING[i][0]){
      return (android_LogPriority)i;
    }
  }

  // return the current level if no match
  return s_debugLevel;
}

void NodeStatic::ReadDebugLevel() {
  // if we override sigsegv in browser we will not get the
  // crash traces reported by the android fraework
  // FIXME: find a way to get both
  if (!s_isBrowser) {
    NODE_LOGV("registering HandleSIGSEGV");
    RegisterSignalHandler(SIGSEGV, HandleSIGSEGV);
  }

#ifdef ANDROID
  char log[10];
  if (__system_property_get("NODE_DEBUG" , log)) {
    s_debugLevel = StringToLog(log);
  }
#else
  const char *log;
  if (log = getenv("NODE_DEBUG")) {
    s_debugLevel = StringToLog(log);
  }
#endif
  NODE_LOGE("%s, setting node debug level (%s:%d)",__FUNCTION__,
      LOG_STRING[s_debugLevel], s_debugLevel);
}

// REQ: node will follow android logging mechanism and will be controllable at build/runtime
#define LOG_BUF_SIZE 1024
extern "C" void __android_log_print_wrap(android_LogPriority prio, const char *tag, const char *fmt, ...) {
  va_list ap;
  static char buf[LOG_BUF_SIZE];
  va_start(ap, fmt);
  vsnprintf(buf, LOG_BUF_SIZE, fmt, ap);
  va_end(ap);

  if (s_debugLevel <= prio) {
#ifdef ANDROID
    __android_log_print(prio, tag, buf);
#else
    printf("%c/%s: %s\n", LOG_STRING[prio][0], tag, buf);
    fflush(stdout);
#endif
  }
}

double StopWatch::currentTime() {
  struct timeval now;
  struct timezone zone;
  gettimeofday(&now, &zone);
  return static_cast<double>(now.tv_sec) + (double)(now.tv_usec / 1000000.0);
}

void StopWatch::start() {
  m_startTime = currentTime();
}

int StopWatch::stop() {
  double now = currentTime();
  return (now - m_startTime) * 1000;
}

extern "C" {
int gettid() {
#ifdef ANDROID
    return syscall(__NR_gettid);
#else
    return syscall(SYS_gettid);
#endif
}
}

// cache the service node, it doesnt have a client
Node* NodeStatic::ServiceNode() {
  if (!s_serviceNode) {
    s_serviceNode = new Node(0);
  }
  return s_serviceNode;
}

NodeStatic::NodeStatic(bool isBrowser, std::string appPath)
  : s_isBrowser(isBrowser)
  , s_isAndroid(false)
  , s_serviceNode(0)
{
  s_instance = this;

  // initialize mutex/cond
  pthread_mutex_init(&s_mutex, 0);
  pthread_cond_init(&s_cond, 0);

  // REQ: node modules will be downloaded to/loaded from <app_path>/.proteus/downloads directory
#ifdef ANDROID
  s_isAndroid = true;
  s_moduleDownloadSuffix = ".proteus/downloads";
#endif

  s_appPath = appPath;
  s_moduleDownloadPath = s_appPath + '/' + s_moduleDownloadSuffix;
  NODE_LOGI("** %s, appPath(%s) downloadPath(%s) isBrowser(%d)",
      __PRETTY_FUNCTION__, s_appPath.c_str(), s_moduleDownloadPath.c_str(), isBrowser);

  s_lockState = false;
  s_updateCheck = false;

  Initialize();
}

}  // namespace node
