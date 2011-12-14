set -x
adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity

# create directories
PPATH=/data/data/com.android.browser/.proteus
DPATH=/data/data/com.android.browser/.proteus/downloads
adb shell mkdir $PPATH
adb shell mkdir $DPATH

# change permissions to the app
APPID=`adb shell ps |grep browser |awk '{print $1}'`
if [ "$APPID" != "" ]; then
adb shell chown $APPID $PPATH
adb shell chown $APPID $DPATH
fi

adb shell mkdir $DPATH/public-test
adb push public-test $DPATH/public-test

adb shell mkdir $DPATH/test
adb shell mkdir $DPATH/test/simple
adb push test/simple $DPATH/test/simple
adb push test/common.js $DPATH/test

adb shell mkdir $DPATH/test/fixtures
adb push test/fixtures $DPATH/test/fixtures

adb shell mkdir $DPATH/test/tmp
adb shell chown $APPID $DPATH/test/tmp

# push proteus tests..
adb shell mkdir $DPATH/test/proteus
adb push test/proteus $DPATH/test/proteus

adb shell mkdir $DPATH/public-test
adb push public-test $DPATH/public-test

adb push modules/proteus/proteusModLoader/test/proteusModLoaderTest.js $DPATH
adb push modules/proteus/proteusModLoader/test/proteusModLoaderTest.html /data/

adb shell mkdir $DPATH/public-test
adb push public-test $DPATH/public-test

# zip
UNZIPPATH=$DPATH/proteusUnzip/test
adb shell mkdir $DPATH/proteusUnzip
adb shell mkdir $DPATH/proteusUnzip/test
adb push modules/proteus/proteusUnzip/test $UNZIPPATH
adb push modules/proteus/proteusUnzip/test/unzip.html /data/

# permissions
adb push test/proteus/permissions/FeatureWebapp.html /data/
adb push test/proteus/permissions/Navigator.html /data/

# To run modloader test
# adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/proteusModLoaderTest.html

# To run unzip test
# adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/unzip.html

# run permissions
# adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/FeatureWebapp.html
# adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/Navigator.html


