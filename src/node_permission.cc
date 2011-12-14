/*
 * Copyright (c) 2011, Code Aurora Forum. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 *       copyright notice, this list of conditions and the following
 *       disclaimer in the documentation and/or other materials provided
 *       with the distribution.
 *     * Neither the name of Code Aurora Forum, Inc. nor the names of its
 *       contributors may be used to endorse or promote products derived
 *       from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#include <v8.h>
#include <vector>
#include <string>
#include <node.h>

using namespace v8;
using namespace std;
using namespace node;

typedef struct {
    struct {
        v8::Persistent<v8::Function> jsCallback;
    }data;
    Node *   node;
} requestPermissionCallBackData;


void requestPermissionModuleCallback(void * context, bool permission) {
    HandleScope scope;
    requestPermissionCallBackData * t = (requestPermissionCallBackData *) context;
    Context::Scope cscope(t->node->context());
    long lPermission = (long) permission;
    v8::Local<v8::Integer> perm = v8::Integer::New(lPermission);
    v8::Handle<v8::Value> argv[] = {perm};
    Persistent<Function> jsCB = t->data.jsCallback;
    jsCB->Call(t->node->context()->Global(),1,argv);
}

Handle<Value> requestPermission(const Arguments& args)
{
    HandleScope scope;

    // Arguments should be Array of features & callback
    if (args.Length() != 2) {
        return ThrowException(Exception::TypeError(String::New("requestPermission takes exactly 2 parameters")));
    }

    if (!args[0]->IsArray()) {
        return ThrowException(Exception::TypeError(String::New("1st argument should be an array")));
    }

    if (!args[1]->IsFunction()) {
        return ThrowException(Exception::TypeError(String::New("2nd argument should be a callback")));
    }

    Local<Value> featuresValue = args[0];
    Local<Array> v8Features = Local<Array>::Cast(featuresValue);

    // create the callback
    v8::Local<v8::Value> tValue = args[1];
    Persistent<Function>callback = Persistent<Function>::New(Local<Function>::Cast(tValue));

    vector<string> features;
    for(unsigned int i=0; i< v8Features->Length(); i++) {
        String::AsciiValue featureName(v8Features->Get(i)->ToString());
        features.push_back(string(*featureName));
    }

    // Get the current node instance
    //Node *n = Node::GetNode(args.Holder());
    Node *n = static_cast<Node*>(args.Holder()->GetPointerFromInternalField(0));
    NODE_ASSERT(n);
    NODE_ASSERT(n->client());

    //Context::Scope cscope(n->m_browserContext);
    requestPermissionCallBackData* tmpContext = new requestPermissionCallBackData;
    tmpContext->data.jsCallback = Persistent<Function>::New(Local<Function>::Cast(tValue));
    tmpContext->node = n;

    NodeEvent e;
    e.type = NODE_EVENT_FP_REQUEST_PERMISSION;
    e.u.RequestPermissionEvent_.features = &features;
    e.u.RequestPermissionEvent_.callback = requestPermissionModuleCallback;
    e.u.RequestPermissionEvent_.context = tmpContext;
    n->client()->HandleNodeEvent(&e);
    return v8::Undefined();
}


extern "C" void feature_permission_init(Handle<Object> target)
{
    HandleScope scope;
    // Node *n = static_cast<Node*>(target->GetPointerFromInternalField(0));
	// PrivilegedFeatures *module = new PrivilegedFeatures(n);
	// target->SetPointerInInternalField(1, module);
	// Is this module interested in webkit broadcast event - Noooooooo
    // n->RegisterModuleInterface(module);
    target->Set(String::New("requestPermission"), FunctionTemplate::New(requestPermission)->GetFunction());
}

NODE_MODULE(node_permission, feature_permission_init);
