#!/bin/bash
set -x

# ics browser seems to not reload if opening the same page, so we need to create different html
for i in $*
do
#file=`expr $i : '.*/\([a-zA-Z_\.\-]*$\)'`.html
file=proteus.html
echo "
<script>
function onLoad() {
  navigator.loadModule('test', function(module) {
      module.runTest('$i');
      });
}
</script>
<body onload='onLoad()'>
</body>
" |tee proteus.html

adb push proteus.html /data/$file
adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/$file
sleep 4

done

echo "** Killing browser"
pid=$(adb shell ps |grep browser |awk '{print $2}')
adb shell kill -9 $pid

# launch and kill again to get around the issue of ics caching the previous state of browser
# it doesnt cache the second crash :)
#adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity
#sleep 1
#pid=$(adb shell ps |grep browser |awk '{print $2}')
#adb shell kill -9 $pid
