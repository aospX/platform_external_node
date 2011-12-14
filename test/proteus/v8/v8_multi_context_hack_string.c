// g++ -m32 v8_api.cc -I/local/mnt/workspace/v8_be_32/include -L/local/mnt/workspace/v8_be_32/ -lv8
#include <v8.h>
//#include "checks.h"

using namespace v8;

// A LocalContext holds a reference to a v8::Context.
class LocalContext {
 public:
  LocalContext(v8::ExtensionConfiguration* extensions = 0,
               v8::Handle<v8::ObjectTemplate> global_template =
                   v8::Handle<v8::ObjectTemplate>(),
               v8::Handle<v8::Value> global_object = v8::Handle<v8::Value>())
    : context_(v8::Context::New(extensions, global_template, global_object)) {
    context_->Enter();
  }

  virtual ~LocalContext() {
    context_->Exit();
    context_.Dispose();
  }

  v8::Context* operator->() { return *context_; }
  v8::Context* operator*() { return *context_; }
  bool IsReady() { return !context_.IsEmpty(); }

  v8::Local<v8::Context> local() {
    return v8::Local<v8::Context>::New(context_);
  }

 private:
  v8::Persistent<v8::Context> context_;
};


static inline v8::Local<v8::Value> v8_num(double x) {
  return v8::Number::New(x);
}


static inline v8::Local<v8::String> v8_str(const char* x) {
  return v8::String::New(x);
}


static inline v8::Local<v8::Script> v8_compile(const char* x) {
  return v8::Script::Compile(v8_str(x));
}


// Helper function that compiles and runs the source.
static inline v8::Local<v8::Value> CompileRun(const char* source) {
  return v8::Script::Compile(v8::String::New(source))->Run();
}


// For use within the TestSecurityHandler() test.
static bool g_security_callback_result = true;
static bool NamedSecurityTestCallback(Local<v8::Object> global,
                                      Local<Value> name,
                                      v8::AccessType type,
                                      Local<Value> data) {

  String::AsciiValue value(name);
  printf("Access Check for : %s\n", *value);

  // Always allow read access.
  if (type == v8::ACCESS_GET)
    return true;

  // Sometimes allow other access.
  return g_security_callback_result;
}


static bool IndexedSecurityTestCallback(Local<v8::Object> global,
                                        uint32_t key,
                                        v8::AccessType type,
                                        Local<Value> data) {
  // Always allow read access.
  if (type == v8::ACCESS_GET)
    return true;

  // Sometimes allow other access.
  return g_security_callback_result;
}

v8::Handle<v8::Value> Print(const v8::Arguments& args) {
  bool first = true;
  for (int i = 0; i < args.Length(); i++) {
    v8::HandleScope handle_scope;
    if (first) {
      first = false;
    } else {
      printf(" ");
    }
    v8::String::Utf8Value str(args[i]);
    printf("%s", *str);
  }
  printf("\n");
  fflush(stdout);
  return v8::Undefined();
}


// SecurityHandler can't be run twice
void SecurityHandler() {
  v8::HandleScope scope0;
  v8::Handle<v8::ObjectTemplate> global_template = v8::ObjectTemplate::New();
  global_template->SetAccessCheckCallbacks(NamedSecurityTestCallback,
                                           IndexedSecurityTestCallback);
  global_template->Set(v8::String::New("print"), v8::FunctionTemplate::New(Print));

  // context0
  v8::Persistent<Context> context0 = Context::New(NULL, global_template);
  context0->Enter();

  v8::Handle<v8::Object> global0 = context0->Global();

  CompileRun("var foo = {'hello':'world'}; print(foo.toString());");

  // context1
  v8::HandleScope scope1;
  v8::Persistent<Context> context1 = Context::New(NULL, global_template);
  context1->Enter();

  v8::Handle<v8::Object> global1 = context1->Global();
  global1->Set(v8_str("context0"), global0);

  CompileRun("context0.foo.__proto__.toString = function() {return 'hacked';}");

  context0->Enter();
  CompileRun("print(foo.toString()); var bar = {}; print(bar.toString());");
}

int main() {
  SecurityHandler();
}

