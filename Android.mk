BASE_PATH := $(call my-dir)
include $(CLEAR_VARS)

ifeq ($(PROTEUS_DEVICE_API), true)
ifeq ($(TARGET_ARCH),arm)
  include $(BASE_PATH)/deps/uv/src/ares/Android.libcares.mk
  include $(BASE_PATH)/Android.libnode.mk
  include $(BASE_PATH)/Android.node.mk
endif
endif
