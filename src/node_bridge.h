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

#ifndef NODE_BRIDGE_H
#define NODE_BRIDGE_H

#ifdef __cplusplus

#include <vector>
#include <string>

namespace node {

// <NODE_EVENT>_<FEATURE>_<DESCRIPTION_OF_API>
typedef enum {
  NODE_EVENT_UNKNOWN,

  // To be called from LIBEV thread
  NODE_EVENT_LIBEV_INVOKE_PENDING,
  NODE_EVENT_LIBEV_DONE,

  // To be called from main thread
  NODE_EVENT_FP_REGISTER_PRIVILEGED_FEATURES,
  NODE_EVENT_FP_REQUEST_PERMISSION
} NodeEventType;
   
// Feature permission events
typedef struct {
  std::vector<std::string>* features;
} RegisterPrivilegedFeaturesEvent;

typedef struct {
  std::vector<std::string>* features;
  void (*callback)(void *, bool);
  void * context;
} RequestPermissionEvent;


typedef struct {
  NodeEventType type;
  union {
    RegisterPrivilegedFeaturesEvent RegisterPrivilegedFeaturesEvent_;
    RequestPermissionEvent RequestPermissionEvent_;
  } u;
} NodeEvent;

// node event handler (set by webkit)
typedef void (*NodeEventHandlerType) (void* instance, NodeEvent*);

///////////////////////////////////WEBKIT events to node//////////////////////////////
typedef enum {
  WEBKIT_EVENT_UNKNOWN,

  // Called by webkit when browser goes out of focus
  WEBKIT_EVENT_PAUSE,

  // called by webkit when browser comes back to focus
  WEBKIT_EVENT_RESUME,

} WebKitEventType;

typedef struct {
  WebKitEventType type;
  union {
  } u;
} WebKitEvent;

///////////////////////////////// Internal events //////////////////////////
typedef enum {
  INTERNAL_EVENT_UNKNOWN,

  /* INTERNAL_EVENT_RELEASE
   * when the node instance is being destroyed, the module needs
   * to do the cleanup like stopping all watchers, destroying all native objects
   * it created and detaching them from the JS objects and releasing any references.
   * The JS objects get collected on the next GC
   */
  INTERNAL_EVENT_RELEASE
} InternalEventType;

typedef struct {
  InternalEventType type;
} InternalEvent;

//////////////////////////////////Event Types /////////////////////////////
typedef enum {
  EVENT_TYPE_WEBKIT,
  EVENT_TYPE_INTERNAL
} EventType;

/////////////////////////////////////Module ids///////////////////////
typedef enum {
  MODULE_UNKNOWN,
  MODULE_FS,
  MODULE_CAMERA
} ModuleId;


};

#endif
#endif
