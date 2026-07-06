package com.myandroidapp.video

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*

class MediaPickerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    private var pickerPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "MediaPicker"
    }

    @ReactMethod
    fun pickMedia(promise: Promise) {
        val activity = getCurrentActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity doesn't exist")
            return
        }

        pickerPromise = promise

        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            activity.startActivityForResult(Intent.createChooser(intent, "Select Photo or Video"), REQUEST_CODE)
        } catch (e: Exception) {
            pickerPromise?.reject("TRIGGER_ERROR", e.message, e)
            pickerPromise = null
        }
    }

    @ReactMethod
    fun pickCubeFile(promise: Promise) {
        val activity = getCurrentActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity doesn't exist")
            return
        }

        pickerPromise = promise

        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            activity.startActivityForResult(Intent.createChooser(intent, "Select 3D LUT Cube File"), REQUEST_CODE_CUBE)
        } catch (e: Exception) {
            pickerPromise?.reject("TRIGGER_ERROR", e.message, e)
            pickerPromise = null
        }
    }

    private fun readUriText(uri: Uri): String? {
        val context = reactApplicationContext
        return try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                inputStream.bufferedReader().use { reader ->
                    reader.readText()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun getUriDisplayName(uri: Uri): String {
        var name = "Imported LUT"
        val cursor = reactApplicationContext.contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1) {
                    name = it.getString(nameIndex)
                }
            }
        }
        return name
    }

    private fun copyUriToCache(uri: Uri): String? {
        val context = reactApplicationContext
        val mimeType = context.contentResolver.getType(uri)
        val extension = when {
            mimeType != null && mimeType.startsWith("video/") -> "mp4"
            mimeType != null && mimeType.startsWith("image/png") -> "png"
            mimeType != null && mimeType.startsWith("image/webp") -> "webp"
            mimeType != null && mimeType.startsWith("image/gif") -> "gif"
            else -> "jpg"
        }
        val filename = "imported_media_${System.currentTimeMillis()}.$extension"
        val cacheFile = java.io.File(context.cacheDir, filename)
        
        try {
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                java.io.FileOutputStream(cacheFile).use { outputStream ->
                    val buffer = ByteArray(4 * 1024)
                    var read: Int
                    while (inputStream.read(buffer).also { read = it } != -1) {
                        outputStream.write(buffer, 0, read)
                    }
                    outputStream.flush()
                }
            }
            return "file://" + cacheFile.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE && requestCode != REQUEST_CODE_CUBE) return

        val promise = pickerPromise
        if (promise == null) return

        if (resultCode == Activity.RESULT_OK) {
            val uri: Uri? = data?.data
            if (uri != null) {
                if (requestCode == REQUEST_CODE_CUBE) {
                    val text = readUriText(uri)
                    val name = getUriDisplayName(uri)
                    if (text != null) {
                        val map = Arguments.createMap().apply {
                            putString("content", text)
                            putString("name", name)
                        }
                        promise.resolve(map)
                    } else {
                        promise.reject("READ_ERROR", "Failed to read selected cube file")
                    }
                } else {
                    val cachedPath = copyUriToCache(uri)
                    if (cachedPath != null) {
                        promise.resolve(cachedPath)
                    } else {
                        promise.reject("COPY_ERROR", "Failed to cache selected media")
                    }
                }
            } else {
                promise.reject("NO_DATA", "No media selected")
            }
        } else {
            promise.reject("PICKER_CANCELED", "Selection canceled")
        }
        pickerPromise = null
    }

    override fun onNewIntent(intent: Intent) {
        // No-op
    }

    companion object {
        private const val REQUEST_CODE = 4122
        private const val REQUEST_CODE_CUBE = 4123
    }
}
