LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)

LOCAL_MODULE_TAGS := optional
LOCAL_MODULE := libcares
LOCAL_CPP_EXTENSION := .cc
LOCAL_SRC_FILES := \
    ares_cancel.c \
    ares__close_sockets.c \
    ares_data.c \
    ares_destroy.c \
    ares_expand_name.c \
    ares_expand_string.c \
    ares_fds.c \
    ares_free_hostent.c \
    ares_free_string.c \
    ares_gethostbyaddr.c \
    ares_gethostbyname.c \
    ares__get_hostent.c \
    ares_getnameinfo.c \
    ares_getopt.c \
    ares_getsock.c \
    ares_init.c \
    ares_library_init.c \
    ares_llist.c \
    ares_mkquery.c \
    ares_nowarn.c \
    ares_options.c \
    ares_parse_aaaa_reply.c \
    ares_parse_a_reply.c \
    ares_parse_mx_reply.c \
    ares_parse_ns_reply.c \
    ares_parse_ptr_reply.c \
    ares_parse_srv_reply.c \
    ares_parse_txt_reply.c \
    ares_process.c \
    ares_query.c \
    ares__read_line.c \
    ares_search.c \
    ares_send.c \
    ares_strcasecmp.c \
    ares_strdup.c \
    ares_strerror.c \
    ares_timeout.c \
    ares__timeval.c \
    ares_version.c \
    ares_writev.c \
    bitncmp.c \
    inet_net_pton.c \
    inet_ntop.c

LOCAL_CFLAGS += \
  -Wno-endif-labels \
  -Wno-import \
  -Wno-format \
  -fno-exceptions \
  -DHAVE_CONFIG_H

LOCAL_C_INCLUDES += \
   bionic/libc/include \
   bionic/libc/include/sys \
   $(LOCAL_PATH)/../../include \
   $(LOCAL_PATH)/config_linux

LOCAL_STATIC_LIBRARIES :=
LOCAL_SHARED_LIBRARIES := libcutils libdl
LOCAL_PRELINK_MODULE := false

include $(BUILD_STATIC_LIBRARY)
