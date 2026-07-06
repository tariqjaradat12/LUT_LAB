package com.myandroidapp.video

import android.os.Environment
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class VideoExporterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val exporter = LosslessVideoExporter()

    override fun getName(): String {
        return "VideoExporter"
    }

    @ReactMethod
    fun startExport(filename: String, width: Double, height: Double, fps: Double, promise: Promise) {
        try {
            // Write to the app's cache directory or external files directory to avoid permission issues
            val outputDir = reactApplicationContext.cacheDir
            if (!outputDir.exists()) {
                outputDir.mkdirs()
            }
            val outputFile = File(outputDir, filename)
            
            exporter.startExport(
                outputFile.absolutePath,
                width.toInt(),
                height.toInt(),
                fps.toInt()
            )
            promise.resolve(outputFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("EXPORT_INIT_ERROR", "Failed to initialize native exporter: ${e.message}", e)
        }
    }

    @ReactMethod
    fun appendFrame(colorHex: String, durationMs: Double, promise: Promise) {
        try {
            exporter.appendFrame(colorHex, durationMs.toInt())
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("FRAME_APPEND_ERROR", "Failed to append frame: ${e.message}", e)
        }
    }

    @ReactMethod
    fun finalizeExport(promise: Promise) {
        try {
            val outputPath = exporter.finalizeExport()
            promise.resolve(outputPath)
        } catch (e: Exception) {
            promise.reject("EXPORT_FINALIZE_ERROR", "Failed to finalize export: ${e.message}", e)
        }
    }

    @ReactMethod
    fun exportGradedImage(watermarkEnabled: Boolean, watermarkDeviceName: String, watermarkBorderColor: String, isFreeUser: Boolean, promise: Promise) {
        val view = LogVideoPlayerView.getActiveView()
        if (view == null) {
            promise.reject("EXPORT_ERROR", "No active LogVideoPlayerView instance found")
            return
        }
        view.exportGradedImage(watermarkEnabled, watermarkDeviceName, watermarkBorderColor, isFreeUser, promise)
    }

    @ReactMethod
    fun exportGradedVideo(watermarkEnabled: Boolean, watermarkDeviceName: String, watermarkBorderColor: String, isFreeUser: Boolean, promise: Promise) {
        val view = LogVideoPlayerView.getActiveView()
        if (view == null) {
            promise.reject("EXPORT_ERROR", "No active LogVideoPlayerView instance found")
            return
        }
        val videoUrl = view.getVideoUrl()
        if (videoUrl == null) {
            promise.reject("EXPORT_ERROR", "No video loaded in player")
            return
        }
        val params = view.getGradingParams()
        
        Thread {
            try {
                val transcoder = VideoTranscoder(reactApplicationContext)
                val outputPath = transcoder.transcode(videoUrl, params, watermarkEnabled, watermarkDeviceName, watermarkBorderColor, isFreeUser)
                promise.resolve(outputPath)
            } catch (e: Exception) {
                android.util.Log.e("VideoExporterModule", "Failed to transcode video", e)
                promise.reject("EXPORT_ERROR", "Video export failed: ${e.message}", e)
            }
        }.start()
    }
}
