#
# Copyright (c) 2011, Code Aurora Forum. All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are
# met:
#     * Redistributions of source code must retain the above copyright
#       notice, this list of conditions and the following disclaimer.
#     * Redistributions in binary form must reproduce the above
#       copyright notice, this list of conditions and the following
#       disclaimer in the documentation and/or other materials provided
#       with the distribution.
#     * Neither the name of Code Aurora Forum, Inc. nor the names of its
#       contributors may be used to endorse or promote products derived
#       from this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED "AS IS" AND ANY EXPRESS OR IMPLIED
# WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT
# ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS
# BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
# BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
# WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
# OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
# IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#

#!/bin/bash

TARGET="browser"
TESTDIR="test/simple"
FILTER=""

help() {
  echo "Usage: "
  echo "run_tests.sh -t|--target=<desktop/shell/browser:default=browser>"
  echo "             -d|--dir=<testdir>                                 "
  echo "             -f|--filter=<optional filer>                       "
  echo "             -s|--silent (output silent or verbose)             "
  echo "e.g. run http tests from test/simple on desktop shell           "
  echo "run_tests.sh -t=desktop -d=test/simple -f=http                  "
  exit
}

for i in $*
do
   case $i in
        -t=*|--target=*)
                TARGET=`echo $i | sed 's/[-a-zA-Z0-9]*=//'`
                ;;
        -d=*|--dir=*)
                TESTDIR=`echo $i | sed 's/[-a-zA-Z0-9]*=//'`
                ;;
        -f=*|--filter=*)
                FILTER=`echo $i | sed 's/[-a-zA-Z0-9]*=//'`
                ;;
        -s|--silent)
                SILENT='true'
                ;;
        -h|--help)
                help
                ;;
         *)
                echo "Invalid option: " $i
                help
                ;;
   esac
done

echo "**  TARGET: " $TARGET
echo "** TESTDIR: " $TESTDIR
echo "**  FILTER: " $FILTER

# at is for the trace during exception
if [ "$SILENT" == "true" ]; then
   GREPSTR="\"TESTRUN|PASSED|FAILED|CRASHED\"";
else
   GREPSTR="\"TESTSTR|TESTRUN|STARTED|PASSED|FAILED|CRASHED|Error|    at \"";
fi

if [ "$TARGET" == "desktop" ]; then
   gnome-terminal --geometry=200 -x bash -c "NODE_DEBUG=E ./proteus/tools/node_test.py $TARGET $TESTDIR $FILTER| egrep $GREPSTR; exec bash"
else
   gnome-terminal -x bash -c  "./proteus/tools/node_test.py $TARGET $TESTDIR $FILTER; exec bash"
   gnome-terminal --geometry=200 -x bash -c "adb logcat -c; adb logcat | egrep $GREPSTR; exec bash"
fi
