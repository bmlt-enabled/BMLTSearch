BMLT Meeting Search

example commands to build a git clone of this app (on a mac)

Download the master.zip file...

https://github.com/paulnagle/BMLTSearch/archive/master.zip

Unzip the zip file and cd into the directory that is created

Install Ionic Framework (For more details see https://ionicframework.com/)
```
$ npm install -g ionic@latest
```
Install package.json dependencies
```
$ npm install
```
Install Cordova/PhoneGap plugins (Cordova Plugins package.json branch dependencies)
```
$ ionic state restore
```
Test your app on multiple screen sizes and platform types by starting a local development server
```
$ ionic serve
```
or
```
$ ionic serve --lab
```
Build iOS
```
$ ionic cordova platform rm ios

$ ionic cordova platform add ios

$ ionic cordova build ios --prod
```
Build Android
```
$ ionic cordova platform rm android

$ ionic cordova platform add android

$ ionic cordova build android --prod
```
Build Android (Production)
```
$ ionic state restore

$ ionic platforms add android

$ ionic build android --release --prod
```

To sign the app for apppstore submission
```
$ cd platforms/android/build/outputs/apk/

$ keytool -genkey -v -keystore my-release-key.keystore -alias alias_name -keyalg RSA -keysize 2048 -validity 10000

$ jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore my-release-key.keystore android-release-unsigned.apk alias_name

$ /Users/paulnagle/Development/sdk/build-tools/21.1.2/zipalign -v 4 android-release-unsigned.apk NAIreland.apk
```
You can then submit the app to the appstore.
