package com.myandroidapp.video

import android.app.Activity
import android.content.Intent
import android.os.Environment
import android.util.Log
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraCharacteristics
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import androidx.core.content.ContextCompat
import androidx.core.app.ActivityCompat
import android.Manifest
import android.content.pm.PackageManager

class LutShareModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val TAG = "LutShareModule"

    override fun getName(): String {
        return "LutShare"
    }

    @ReactMethod
    fun saveToDownloads(filename: String, content: String, promise: Promise) {
        try {
            // Save to standard public Downloads folder
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) {
                downloadsDir.mkdirs()
            }
            val lutFile = File(downloadsDir, filename)
            
            FileOutputStream(lutFile).use { fos ->
                fos.write(content.toByteArray())
            }
            
            Log.d(TAG, "LUT successfully saved to Downloads: ${lutFile.absolutePath}")
            promise.resolve(lutFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", "Failed to save LUT file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun shareLut(filename: String, content: String, promise: Promise) {
        try {
            // Save to application cache first
            val cacheDir = reactApplicationContext.cacheDir
            val lutFile = File(cacheDir, filename)
            
            FileOutputStream(lutFile).use { fos ->
                fos.write(content.toByteArray())
            }

            // Launch sharing intent. 
            // Note: For external files sharing, standard text share is highly compatible.
            // We share the LUT file path information and text details.
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "Custom 3D LUT File: $filename")
                putExtra(Intent.EXTRA_TEXT, content)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            val chooserIntent = Intent.createChooser(shareIntent, "Export 3D LUT Cube File").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            reactApplicationContext.startActivity(chooserIntent)
            promise.resolve(lutFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", "Failed to share LUT file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun saveState(key: String, value: String, promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("LUT_LAB_PREFS", android.content.Context.MODE_PRIVATE)
            with (sharedPref.edit()) {
                putString(key, value)
                apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_STATE_ERROR", "Failed to save state: ${e.message}", e)
        }
    }

    @ReactMethod
    fun loadState(key: String, promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("LUT_LAB_PREFS", android.content.Context.MODE_PRIVATE)
            val value = sharedPref.getString(key, null)
            promise.resolve(value)
        } catch (e: Exception) {
            promise.reject("LOAD_STATE_ERROR", "Failed to load state: ${e.message}", e)
        }
    }

    @ReactMethod
    fun clearState(key: String, promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("LUT_LAB_PREFS", android.content.Context.MODE_PRIVATE)
            with (sharedPref.edit()) {
                remove(key)
                apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_STATE_ERROR", "Failed to clear state: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getAvailableCameras(promise: Promise) {
        try {
            val cameraManager = reactApplicationContext.getSystemService(android.content.Context.CAMERA_SERVICE) as CameraManager
            val cameraIds = cameraManager.cameraIdList
            val result = Arguments.createArray()

            for (id in cameraIds) {
                try {
                    val chars = cameraManager.getCameraCharacteristics(id)
                    val facing = chars.get(CameraCharacteristics.LENS_FACING)
                    if (facing == CameraCharacteristics.LENS_FACING_BACK) {
                        val physicalIds = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                            chars.physicalCameraIds
                        } else {
                            emptySet<String>()
                        }
                        
                        if (physicalIds.isNotEmpty()) {
                            for (pId in physicalIds) {
                                val pChars = cameraManager.getCameraCharacteristics(pId)
                                val pFocalLengths = pChars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                                val pSensorSize = pChars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
                                
                                var eqFocalLength = 24.0
                                if (pFocalLengths != null && pFocalLengths.isNotEmpty() && pSensorSize != null) {
                                    val f = pFocalLengths[0]
                                    val w = pSensorSize.width
                                    val h = pSensorSize.height
                                    val diagonal = Math.sqrt((w * w + h * h).toDouble())
                                    if (diagonal > 0.0) {
                                        eqFocalLength = (f * 43.27 / diagonal)
                                    }
                                }
                                
                                val cameraMap = Arguments.createMap()
                                cameraMap.putString("id", "$id:$pId")
                                cameraMap.putDouble("focalLength", eqFocalLength)
                                val typeName = when {
                                    eqFocalLength < 20.0 -> "Ultra Wide (${eqFocalLength.toInt()}mm)"
                                    eqFocalLength >= 40.0 -> "Telephoto (${eqFocalLength.toInt()}mm)"
                                    else -> "Main (${eqFocalLength.toInt()}mm)"
                                }
                                cameraMap.putString("name", typeName)
                                result.pushMap(cameraMap)
                            }
                        } else {
                            val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                            val sensorSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
                            
                            var eqFocalLength = 24.0
                            if (focalLengths != null && focalLengths.isNotEmpty() && sensorSize != null) {
                                val f = focalLengths[0]
                                val w = sensorSize.width
                                val h = sensorSize.height
                                val diagonal = Math.sqrt((w * w + h * h).toDouble())
                                if (diagonal > 0.0) {
                                    eqFocalLength = (f * 43.27 / diagonal)
                                }
                            }
                            
                            val cameraMap = Arguments.createMap()
                            cameraMap.putString("id", id)
                            cameraMap.putDouble("focalLength", eqFocalLength)
                            val typeName = when {
                                eqFocalLength < 20.0 -> "Ultra Wide (${eqFocalLength.toInt()}mm)"
                                eqFocalLength >= 40.0 -> "Telephoto (${eqFocalLength.toInt()}mm)"
                                else -> "Main (${eqFocalLength.toInt()}mm)"
                            }
                            cameraMap.putString("name", typeName)
                            result.pushMap(cameraMap)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error reading characteristics for camera $id: ${e.message}")
                }
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CAMERA_LIST_ERROR", "Failed to retrieve cameras: ${e.message}", e)
        }
    }

    @ReactMethod
    fun captureCameraPhoto(promise: Promise) {
        val view = CameraPreviewManager.activeView
        if (view == null) {
            promise.reject("CAMERA_ERROR", "No active CameraPreview instance found")
            return
        }
        view.capturePhoto(promise)
    }

    @ReactMethod
    fun setCameraRecordingActive(active: Boolean, promise: Promise) {
        val view = CameraPreviewManager.activeView
        if (view == null) {
            promise.reject("CAMERA_ERROR", "No active CameraPreview instance found")
            return
        }
        view.setRecordingActive(active, promise)
    }

    @ReactMethod
    fun requestCameraPermissions(promise: Promise) {
        val activity = getCurrentActivity()
        if (activity == null) {
            promise.reject("ACTIVITY_ERROR", "No active activity context found")
            return
        }
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        
        val hasCamera = ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasAudio = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        
        if (hasCamera && hasAudio) {
            promise.resolve(true)
            return
        }
        
        ActivityCompat.requestPermissions(activity, permissions, 101)
        promise.resolve(true)
    }
}
