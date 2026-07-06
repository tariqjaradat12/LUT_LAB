package com.myandroidapp.video

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.myandroidapp.CustomPanelViewManager

class VideoExporterPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            VideoExporterModule(reactContext),
            LutShareModule(reactContext),
            MediaPickerModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            CustomPanelViewManager(),
            LogVideoPlayerManager(),
            CameraPreviewManager()
        )
    }
}
