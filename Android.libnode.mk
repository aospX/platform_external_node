LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)

LOCAL_MODULE_TAGS := optional
LOCAL_MODULE := libnode
LOCAL_MODULE_CLASS := SHARED_LIBRARIES
intermediates := $(call local-intermediates-dir)

JS2C_PY_NODE := $(intermediates)/js2c.py
$(JS2C_PY_NODE): $(intermediates)/%.py : $(LOCAL_PATH)/tools/%.py | $(ACP)
	@mkdir -p $(dir $@)
	@echo "Copying $@"
	$(copy-file-to-target)

JSMIN_PY_NODE := $(intermediates)/jsmin.py
$(JSMIN_PY_NODE): $(intermediates)/%.py : $(LOCAL_PATH)/deps/v8/tools/%.py | $(ACP)
	@mkdir -p $(dir $@)
	@echo "Copying $@"
	$(copy-file-to-target)

# libnode builtin js
LOCAL_JS_FILES := $(LOCAL_PATH)/src/node.js $(LOCAL_PATH)/lib/*.js

# Add Modloader js files as builtins
LOCAL_JS_FILES += \
        $(LOCAL_PATH)/modules/proteus/proteusModLoader/lib/*.js \
        $(LOCAL_PATH)/modules/proteus/proteusPackageExtractor/lib/*.js \
        $(LOCAL_PATH)/modules/proteus/proteusUnzip/lib/*.js

# Add sqlite js as builtin
LOCAL_JS_FILES += \
        external/node-sqlite-sync/sqlite.js

GEN_NODE := $(intermediates)/node_natives.h
$(GEN_NODE): SCRIPT := $(intermediates)/js2c.py
$(GEN_NODE): $(LOCAL_JS_FILES) $(JS2C_PY_NODE) $(JSMIN_PY_NODE)
	@echo "Generating node_natives.h"
	@echo python $(SCRIPT) $(GEN_NODE) $(LOCAL_JS_FILES)
	@python $(SCRIPT) $(GEN_NODE) $(LOCAL_JS_FILES)

LOCAL_GENERATED_SOURCES += $(GEN_NODE)
LOCAL_CPP_EXTENSION := .cc
LOCAL_SRC_FILES := \
  src/node_buffer.cc \
  src/node.cc \
  src/node_child_process.cc \
  src/node_constants.cc \
  src/node_extensions.cc \
  src/node_file.cc \
  src/node_http_parser.cc \
  src/node_io_watcher.cc \
  src/node_javascript.cc \
  src/node_net.cc \
  src/node_os.cc \
  src/node_script.cc \
  src/node_signal_watcher.cc \
  src/node_stat_watcher.cc \
  src/node_stdio.cc \
  src/node_string.cc \
  src/node_timer.cc \
  src/node_permission.cc \
  src/timer_wrap.cc \
  src/tcp_wrap.cc \
  src/node_cares.cc \
  src/cares_wrap.cc \
  src/node_crypto.cc \
  src/platform_linux.cc \
  deps/uv/src/uv-unix.c \
  deps/uv/src/uv-eio.c \
  deps/uv/src/uv-common.c \
  deps/uv/src/eio/eio.c \
  deps/uv/src/ev/ev.c \
  deps/http_parser/http_parser.c

LOCAL_CFLAGS += \
  -Wno-endif-labels \
  -Wno-import \
  -Wno-format \
  -fno-exceptions  \
  -D__POSIX__ \
  -DHAVE_MONOTONIC_CLOCK=1 \
  -DEV_FORK_ENABLE=0 \
  -DEV_EMBED_ENABLE=0 \
  -DEV_MULTIPLICITY=1 \
  -DHAVE_OPENSSL=1 \
  -DEV_CONFIG_H=\"config_linux.h\"

LOCAL_C_INCLUDES += \
   bionic \
   bionic/libc/include \
   bionic/libc/include/sys \
   external/openssl/include \
   $(LOCAL_PATH)/deps/uv/include \
   $(LOCAL_PATH)/deps/uv/src/ev \
   $(LOCAL_PATH)/deps/uv/src/ares \
   $(LOCAL_PATH)/deps/uv/src/ares/config_linux \
   $(LOCAL_PATH)/deps/http_parser \
   $(LOCAL_PATH)/src \
   $(LOCAL_PATH)/generated \
   $(LOCAL_PATH)/prebuilt \
   external/stlport/stlport \
   bionic/libstdc++/include


LOCAL_STATIC_LIBRARIES := libcares
LOCAL_SHARED_LIBRARIES := libcutils libdl libssl libcrypto libstlport

# dynamic linkage to v8
ifeq ($(DYNAMIC_SHARED_LIBV8SO),true)
LOCAL_C_INCLUDES += vendor/qcom/opensource/v8/include
else
LOCAL_C_INCLUDES += external/v8/include
endif
LOCAL_SHARED_LIBRARIES += libv8

LOCAL_PRELINK_MODULE := false

ifeq ($(PLATFORM_VERSION), 4.0.1)
LOCAL_CFLAGS += \
    -DICS
endif

# sqlite sync module
# https://github.com/grumdrig/node-sqlite.git
LOCAL_SRC_FILES += \
  ../../external/node-sqlite-sync/sqlite3_bindings.cc

LOCAL_C_INCLUDES += \
  external/sqlite/dist

LOCAL_SHARED_LIBRARIES += \
  libsqlite

# add unzipfile
LOCAL_SRC_FILES += \
  modules/proteus/proteusUnzip/src/node_unzip.cc

LOCAL_C_INCLUDES += \
  $(LOCAL_PATH)/modules/proteus/proteusUnzip/src/

LOCAL_STATIC_LIBRARIES += \
  libzipfile \
  libunz

include $(BUILD_SHARED_LIBRARY)
