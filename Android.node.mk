LOCAL_PATH:= $(call my-dir)
include $(CLEAR_VARS)

LOCAL_MODULE_TAGS := optional
LOCAL_SRC_FILES:= proteus/main.cc
LOCAL_MODULE := node

LOCAL_CPP_EXTENSION := .cc

LOCAL_SHARED_LIBRARIES := libcutils liblog libnode libstlport

ifeq ($(DYNAMIC_SHARED_LIBV8SO),true)
LOCAL_C_INCLUDES += vendor/qcom/opensource/v8/include
else
LOCAL_C_INCLUDES += external/v8/include
endif

LOCAL_SHARED_LIBRARIES += libv8

LOCAL_C_INCLUDES += \
   bionic \
   bionic/libc/include \
   bionic/libc/include/sys \
   bionic/libstdc++/include \
   external/stlport/stlport \
   $(LOCAL_PATH)/deps/uv/include \
   $(LOCAL_PATH)/deps/uv/src/ev \
   $(LOCAL_PATH)/src

LOCAL_CFLAGS += \
  -DPROTEUS

include $(BUILD_EXECUTABLE)
