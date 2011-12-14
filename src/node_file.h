// Copyright Joyent, Inc. and other Node contributors.
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

#ifndef SRC_FILE_H_
#define SRC_FILE_H_

#include <node.h>
#include <v8.h>

namespace node {

class File {
 public:
  static void Initialize(v8::Handle<v8::Object> target);
};

void InitFs(v8::Handle<v8::Object> target);

// proteus: moved from node.h
// Use different stat structs & calls on windows and posix;
// on windows, _stati64 is utf-8 and big file aware.
# define NODE_STAT        stat
# define NODE_FSTAT       fstat
# define NODE_STAT_STRUCT struct stat
v8::Local<v8::Object> BuildStatsObject(NODE_STAT_STRUCT *s);


}  // namespace node
#endif  // SRC_FILE_H_
