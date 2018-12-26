#!/bin/bash

rm -rf www

ionic cordova platform rm ios
ionic cordova platform rm android
ionic cordova platform rm browser

ionic cordova plugin rm cordova-plugin-splashscreen
ionic cordova plugin rm cordova-plugin-statusbar
ionic cordova plugin rm cordova-plugin-whitelist
ionic cordova plugin rm cordova-plugin-geolocation
ionic cordova plugin rm cordova-plugin-inappbrowser

ionic cordova platform add ios
ionic cordova platform add android@7.1.4
ionic cordova platform add browser

ionic cordova plugin add cordova-plugin-splashscreen
ionic cordova plugin add cordova-plugin-statusbar
ionic cordova plugin add cordova-plugin-whitelist
ionic cordova plugin add cordova-plugin-geolocation --variable GEOLOCATION_USAGE_DESCRIPTION="To locate you"
ionic cordova plugin add cordova-plugin-inappbrowser

ionic cordova prepare ios
ionic cordova prepare android
ionic cordova prepare browser

ionic cordova resources ios
ionic cordova resources android

ionic build --prod  --minifyjs   --minifycss  --optimizejs
