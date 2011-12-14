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

#include <zipfile/zipfile.h>
#include <private.h>
#include <node.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <node_buffer.h>
#include <sys/stat.h>

using namespace v8;
using namespace node;


class UnzipUtil: ObjectWrap {
  private :
    void* buf; // zip file buffer
    zipfile_t zip; // zip object

  public:

    static Persistent<FunctionTemplate> s_ct;

    static void InitUnzip(Handle<Object> target){

      HandleScope scope;
      Local<FunctionTemplate> t = FunctionTemplate::New(New);

      s_ct = Persistent<FunctionTemplate>::New(t);
      s_ct->InstanceTemplate()->SetInternalFieldCount(1);
      s_ct->SetClassName(String::NewSymbol("createUnzip"));

      NODE_SET_PROTOTYPE_METHOD(s_ct, "setZipFilePath", InitZipFilePath);
      NODE_SET_PROTOTYPE_METHOD(s_ct, "setZipBuffer", InitZipBuffer);
      NODE_SET_PROTOTYPE_METHOD(s_ct, "listFiles", ListFiles);
      NODE_SET_PROTOTYPE_METHOD(s_ct, "getRawFile", DecompressFile);


      target->Set(String::NewSymbol("createUnzip"),s_ct->GetFunction());
    }

    static Handle<Value>  ListFiles(const Arguments& args)
    {
      HandleScope scope;
      bool accessPermission = false;


      if (args.Length() > 0)
	return v8::ThrowException(v8::String::New("Bad parameters"));

      UnzipUtil* unzipUtil = ObjectWrap::Unwrap<UnzipUtil>(args.This());

      if (!unzipUtil->zip)
	return v8::ThrowException(v8::String::New("Did not initialise zip Object"));


      Zipfile * zipPriv = (Zipfile*)unzipUtil->zip;
      Local<Array> files = Array::New(zipPriv->entryCount);


      Zipentry * entryPriv = zipPriv->entries;
      for (int i=0; i<zipPriv->entryCount; i++) {
	 files->Set(v8::Number::New(i), v8::String::New((char *)entryPriv->fileName, entryPriv->fileNameLength));
        entryPriv = entryPriv->next;
      }
      return scope.Close(files);
    }


    static Handle<Value>  DecompressFile(const Arguments& args)
    {
      HandleScope scope;
      bool accessPermission = false;

      if (args.Length() == 0)
	return v8::ThrowException(v8::String::New("Bad parameters"));

      if (args.Length() > 1 || *args[1] == NULL)
	return v8::ThrowException(v8::String::New("Bad parameters"));


      if (*args[0] == NULL)
	return v8::ThrowException(v8::String::New("Bad parameters"));


      UnzipUtil* unzipUtil = ObjectWrap::Unwrap<UnzipUtil>(args.This());

      if (!unzipUtil->zip)
	return v8::ThrowException(v8::String::New("Did not initialise zip Object"));

      zipentry_t entry;
      size_t unsize,size;
      void* scratch;

      String::Utf8Value srcFilePath(args[0]->ToString());

      entry = lookup_zipentry(unzipUtil->zip, *srcFilePath);

      if (entry == NULL) {
	 NODE_LOGI("%s, zip file does not contain file : %s\n", __FUNCTION__, *srcFilePath);
	return v8::ThrowException(v8::String::New("zip file does not contain file"));
      }
      unsize = get_zipentry_size(entry);
      size = unsize * 1.001;
      scratch = malloc(size);

      NODE_LOGI("%s, scratch=%p\n", __FUNCTION__, scratch);

      int err;
      err = decompress_zipentry(entry, scratch, size);
      if (err != 0) {
	NODE_LOGI("%s, error decompressing file\n", __FUNCTION__);
	return v8::ThrowException(v8::String::New("error decompressing file"));
      }

      node::Buffer *return_buffer = node::Buffer::New( (char*)scratch, size );

      free(scratch);

      return scope.Close( return_buffer->handle_ );

    }

    static Handle<Value> New(const Arguments& args)
    {
      HandleScope scope;
      UnzipUtil* unzipUtil = new UnzipUtil();
      unzipUtil->Wrap(args.This());
      return args.This();
    }


    static Handle<Value>  InitZipBuffer(const Arguments& args)
    {

      HandleScope scope;

      if (args.Length() == 0)
	return v8::ThrowException(v8::String::New("Bad parameters"));

      if ((args.Length() > 1) && (*args[1] == NULL))
	return v8::ThrowException(v8::String::New("Bad parameters"));

      if (*args[0] == NULL)
	return v8::ThrowException(v8::String::New("Bad parameters"));

      UnzipUtil* unzipUtil = ObjectWrap::Unwrap<UnzipUtil>(args.This());

      Local<Object> buffer_obj = args[0]->ToObject();
      char *buffer_data = Buffer::Data(buffer_obj);
      size_t buffer_length = Buffer::Length(buffer_obj);

      bool result = unzipUtil->InitializeByBuffer(buffer_data, buffer_length);

      if(!result)
	return v8::ThrowException(v8::String::New("Incorrect Buffer"));

      return scope.Close(Boolean::New(true));
    }


    static Handle<Value>  InitZipFilePath(const Arguments& args)
    {

      HandleScope scope;
       if (args.Length() == 0)
	return v8::ThrowException(v8::String::New("Bad parameters"));

      if ((args.Length() > 1) && (*args[1] == NULL))
	return v8::ThrowException(v8::String::New("Bad parameters"));

      if (*args[0] == NULL)
	return v8::ThrowException(v8::String::New("Bad parameters"));

      UnzipUtil* unzipUtil = ObjectWrap::Unwrap<UnzipUtil>(args.This());

      String::AsciiValue zipFilePath(args[0]->ToString());

      bool result = unzipUtil->InitializeByFile(*zipFilePath);

      NODE_LOGI("%s, in func new unzip file : %s\n", __FUNCTION__, *zipFilePath);

      if(!result)
	return v8::ThrowException(v8::String::New("Incorrect File"));

      return scope.Close(Boolean::New(true));
    }

    bool InitializeByBuffer (char* buffer, size_t bufferLength )
    {
      buf = malloc(bufferLength);
      memcpy(buf, buffer, bufferLength);

      zip = init_zipfile(buf, bufferLength);
      if (zip == NULL) {
	NODE_LOGI("%s, inti_zipfile failed \n", __FUNCTION__);
	return false;
      }

      return true;
    }

    bool InitializeByFile (char* filePath)
    {
      FILE* f;
      size_t size, unsize;
      NODE_LOGI("%s, unzip file : %s\n", __FUNCTION__, filePath);
      f = fopen(filePath, "r");
      if (f == NULL) {
        NODE_LOGI("%s, couldn't open file : %s\n", __FUNCTION__, filePath);
        return false;
      }
      fseek(f, 0, SEEK_END);
      size = ftell(f);
      rewind(f);

      buf = malloc(size);
      fread(buf, 1, size, f);

      zip = init_zipfile(buf, size);
      if (zip == NULL) {
	NODE_LOGI("%s, inti_zipfile failed \n", __FUNCTION__);
	return false;
      }
      fclose(f);
      return true;
    }

    UnzipUtil()
    {
       buf = 0;
    }

    ~UnzipUtil()
    {
      free(buf);
    }

};


Persistent<FunctionTemplate> UnzipUtil::s_ct;

// FIXME(proteus) need to fix the naming issue for static/dynamic modules
extern "C" void unzip_init (Handle<Object> target) {
  HandleScope scope;
  UnzipUtil::InitUnzip(target);
}

NODE_MODULE(node_unzip, unzip_init);
