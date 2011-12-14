# To run modloader test
adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/proteusModLoaderTest.html

# To run unzip test
adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/unzip.html

# run permissions
adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/FeatureWebapp.html
adb shell am start -a android.intent.action.VIEW -n com.android.browser/.BrowserActivity -d file:///data/Navigator.html

