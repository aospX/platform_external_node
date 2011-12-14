LOCAL_PATH:= $(call my-dir)
include $(CLEAR_VARS)

LOCAL_MODULE_TAGS := optional
LOCAL_SRC_FILES:= src/node_unzip.cc
LOCAL_MODULE:= unzip.node
LOCAL_CPP_EXTENSION:= .cc

LOCAL_C_INCLUDES += \
   $(LOCAL_PATH)/src \
   bionic \
   bionic/libc/include \
   external/node/src \
   external/node/deps/uv/include \
   external/node/deps/uv/src/ev \
   external/v8/v8_leading/include \
   frameworks/base/include \
   external/node/nodejs \
   external/stlport/stlport \
   bionic/libstdc++/include

LOCAL_STATIC_LIBRARIES := libzipfile libunz

LOCAL_SHARED_LIBRARIES := \
   libstlport \
   libnode \
   libbinder \
   libcutils \
   libutils \
   libui

LOCAL_PRELINK_MODULE := false
LOCAL_CFLAGS += \
   -fPIC \
   -DLOG_TAG=\"unzip-module\"

# 3.2 - HC
# FIXME: there's probably a better solution to check for platform
ifeq ($(PLATFORM_VERSION), 3.2)
LOCAL_CFLAGS += \
    -DHONEYCOMB
endif

include $(BUILD_SHARED_LIBRARY)
