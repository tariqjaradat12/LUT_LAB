# LUT LAB

LUT LAB is a React Native Android/iOS app for media grading, LUT editing, exporting, and sharing free presets through an in-app Community Gallery.

## What Is Included

- Home media picker and preview
- Studio controls for light, color, curves, HSL, geometry, detail, effects, overlays, and LUTs
- Share Current LUT flow that publishes the active grade to the Community Gallery
- Local persistence for app settings, imported LUTs, liked posts, shared community posts, and editor session recovery
- Android native modules for media picking, LUT sharing, camera support, and export

## Requirements

- Node.js 22.11 or newer
- npm
- Android Studio with the Android SDK
- JDK 17 or newer
- A connected Android device or emulator for Android builds

## Setup

Install dependencies:

```sh
npm install
```

Start Metro for development:

```sh
npm start
```

Run on Android:

```sh
npm run android
```

## Install A Phone Build That Works Unplugged

For a phone build that keeps working after the USB cable is removed, install a release build:

```sh
cd android
./gradlew installRelease
```

Release signing uses `android/keystore.properties` and a local keystore file. These are intentionally ignored by Git and should stay private.

## GitHub Notes

The repository should commit source files, configuration, assets, and lockfiles. It should not commit generated folders, local installers, APK/AAB outputs, local Android properties, signing files, or `node_modules`.

Before publishing, check what will be committed:

```sh
git status
```
