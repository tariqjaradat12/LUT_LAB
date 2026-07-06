package com.myandroidapp.video

import android.content.Context
import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.net.Uri
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.util.Log
import android.view.Surface
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class LogVideoPlayerView(context: Context) : GLSurfaceView(context), GLSurfaceView.Renderer, SurfaceTexture.OnFrameAvailableListener {
    private val TAG = "LogVideoPlayerView"

    private var mediaPlayer: MediaPlayer? = null
    private var surfaceTexture: SurfaceTexture? = null
    private var surface: Surface? = null
    private var textureId = -1
    private var imageTextureId = -1
    private var curvesTextureId = -1
    private var doubleExposureTextureId = -1
    private var programId = -1
    private var videoProgramId = -1
    private var imageProgramId = -1
    private var videoHandles: ProgramHandles? = null
    private var imageHandles: ProgramHandles? = null

    // Core handles
    private var mvpMatrixHandle = -1
    private var stMatrixHandle = -1
    private var positionHandle = -1
    private var textureCoordHandle = -1
    
    // Core grading handles
    private var sTextureHandle = -1
    private var sTexture2DHandle = -1
    private var exposureHandle = -1
    private var contrastHandle = -1
    private var saturationHandle = -1
    private var gammaHandle = -1
    private var logFormatHandle = -1
    private var isImageHandle = -1

    // Advanced handles
    private var curvesTextureHandle = -1
    private var doubleExposureTextureHandle = -1
    private var temperatureHandle = -1
    private var tintHandle = -1
    private var highlightsHandle = -1
    private var shadowsHandle = -1
    private var toneContrastHandle = -1
    private var vibranceHandle = -1

    // Color wheels handles
    private var shadowsColorHandle = -1
    private var midtonesColorHandle = -1
    private var highlightsColorHandle = -1
    private var shadowsLiftHandle = -1
    private var midtonesLiftHandle = -1
    private var highlightsLiftHandle = -1

    // Vignette handles
    private var vignetteStrengthHandle = -1
    private var vignetteRadiusHandle = -1
    private var vignetteSoftnessHandle = -1
    private var vignetteCenterHandle = -1

    // Double exposure handles
    private var doubleExposureEnabledHandle = -1
    private var doubleExposureOpacityHandle = -1
    private var doubleExposureOffsetHandle = -1
    private var doubleExposureBlendHandle = -1

    private var isImage = false

    // Rendering matrices
    private val mvpMatrix = FloatArray(16)
    private val stMatrix = FloatArray(16)

    // Rendering quad geometry
    private val triangleVerticesData = floatArrayOf(
        // X, Y, Z, U, V
        -1.0f, -1.0f, 0f, 0f, 0f,
         1.0f, -1.0f, 0f, 1f, 0f,
        -1.0f,  1.0f, 0f, 0f, 1f,
         1.0f,  1.0f, 0f, 1f, 1f
    )
    private val verticesBuffer: FloatBuffer

    // Current grading properties
    private var videoUrl: String? = null
    private var logFormat = 0 // 0=Rec709, 1=Slog3, 2=Clog, 3=Dlog
    private var exposure = 0f
    private var contrast = 1f
    private var saturation = 1f
    private var gamma = 1f

    // Dimensions for aspect ratio containment
    private var mediaWidth = 0f
    private var mediaHeight = 0f
    private var viewWidth = 0
    private var viewHeight = 0
    private var imageRotationDegrees = 0f

    // Advanced properties values
    private var curvesLutData: FloatArray? = null
    private var curvesLutChanged = false
    private var colorWheelsData = FloatArray(9) { 0f }
    private var temperature = 0f
    private var tint = 0f
    private var highlights = 0f
    private var shadows = 0f
    private var toneContrast = 0f
    private var vibrance = 0f
    private var hueRotation = 0f
    
    private var vignetteStrength = 0f
    private var vignetteRadius = 0.7f
    private var vignetteSoftness = 0.5f
    private var vignetteCenterX = 0.5f
    private var vignetteCenterY = 0.5f

    private var doubleExposureEnabled = false
    private var doubleExposureOpacity = 0.5f
    private var doubleExposureOffsetX = 0f
    private var doubleExposureOffsetY = 0f
    private var doubleExposureBlend = 0
    private var doubleExposureUri: String? = null
    private var doubleExposureUriChanged = false

    // New adjustment fields
    private var dehaze = 0f
    private var hdrStrength = 0f
    private var sharpen = 0f
    private var definition = 0f
    private var softness = 0f
    private var grainAmount = 0f
    private var grainSize = 2f
    private var grainRoughness = 0.5f
    private var halationStrength = 0f
    private var halationRadius = 0.3f
    private var halationColor = "#FF4422"
    private var halationCenterX = 0.5f
    private var halationCenterY = 0.3f
    private var perspectiveVertical = 0f
    private var perspectiveHorizontal = 0f
    private var perspectiveAspect = 0f
    private var perspectiveRotate = 0f

    // Flat data arrays
    private var controlPointsData = FloatArray(110) { 0f }
    private var masksData = FloatArray(65) { 0f }
    
    // Brush masking offscreen drawing
    private var brushMaskBitmap: android.graphics.Bitmap? = null
    private var brushMaskCanvas: android.graphics.Canvas? = null
    private var brushMaskPaint: android.graphics.Paint? = null
    private var brushMaskTextureId = -1
    private var brushMaskChanged = false
    private var lastBrushX = -1f
    private var lastBrushY = -1f
    private var showMaskOverlay = false
    private var activeMaskIndex = -1

    // LUT profiling
    private var lutData: FloatArray? = null
    private var lutSize = 0f
    private var lutIntensity = 100f
    private var lutTextureId = -1
    private var lutChanged = false
    private var lutColorOffset = 0f
    private var lutToneOffset = 0f

    // Bokeh
    private var bokehStrength = 0f
    private var bokehRadius = 0.3f
    private var bokehShape = 0 // 0=circle, 1=hexagon, 2=anamorphic
    private var bokehCenterX = 0.5f
    private var bokehCenterY = 0.5f



    // Long Shutter Smear Trail
    private var longExposureAmount = 0f
    private var longExposureDirection = 0f
    private var longExposureThreshold = 0.4f
    private var longExposureCenterX = 0.5f
    private var longExposureCenterY = 0.5f

    private var brightness = 0f
    private var hslAdjustments = FloatArray(24) { 0f }

    private var isSurfaceCreated = false
    private var isUpdateSurface = false
    private var isPaused = false
    private var denoiseLuminance = 0f
    private var denoiseColor = 0f

    private var cropX = 0f
    private var cropY = 0f
    private var cropWidth = 1f
    private var cropHeight = 1f
    private var zoomScale = 1f
    private var zoomX = 0.5f
    private var zoomY = 0.5f

    init {
        Log.w(TAG, "constructor init called!")
        setZOrderMediaOverlay(true)
        setEGLContextClientVersion(2)
        setRenderer(this)
        renderMode = RENDERMODE_WHEN_DIRTY

        verticesBuffer = ByteBuffer.allocateDirect(triangleVerticesData.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
            .put(triangleVerticesData)
        verticesBuffer.position(0)

        Matrix.setIdentityM(stMatrix, 0)
        Matrix.setIdentityM(mvpMatrix, 0)
    }

    // Properties exposed to JS
    fun setVideoUrl(url: String?) {
        if (url == null || url == videoUrl) return
        this.videoUrl = url
        if (isSurfaceCreated) {
            post { checkAndLoadMedia() }
        }
    }

    fun getVideoUrl(): String? {
        return videoUrl
    }

    private fun openInputStream(urlStr: String): java.io.InputStream? {
        val uri = Uri.parse(urlStr)
        if (uri.scheme == "file") {
            val path = uri.path ?: return null
            return java.io.FileInputStream(java.io.File(path))
        }
        if (urlStr.startsWith("/")) {
            return java.io.FileInputStream(java.io.File(urlStr))
        }
        return context.contentResolver.openInputStream(uri)
    }

    private fun checkAndLoadMedia() {
        val url = videoUrl ?: return
        Log.w(TAG, "checkAndLoadMedia: $url")
        val isImg = try {
            val uri = Uri.parse(url)
            val scheme = uri.scheme?.lowercase()
            if (scheme == "content" || scheme == "file" || scheme == "android.resource") {
                val mime = context.contentResolver.getType(uri)
                if (mime != null) {
                    mime.startsWith("image/")
                } else {
                    val path = uri.path?.lowercase() ?: ""
                    path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png") || path.endsWith(".webp") || path.endsWith(".heic") || path.contains("image") || path.contains("sample_media")
                }
            } else {
                val lower = url.lowercase()
                lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".heic") || lower.contains("image")
            }
        } catch (e: Exception) {
            val lower = url.lowercase()
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp") || lower.endsWith(".heic") || lower.contains("image")
        }

        if (isImg) {
            isImage = true
            mediaPlayer?.release()
            mediaPlayer = null
            queueEvent {
                try {
                    // Force ARGB_8888 config to prevent GLES hardware bitmap decoding errors
                    val options = android.graphics.BitmapFactory.Options().apply {
                        inPreferredConfig = android.graphics.Bitmap.Config.ARGB_8888
                    }
                    val inputStream = openInputStream(url)
                    val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream, null, options)
                    inputStream?.close()
                    if (bitmap != null) {
                        var rotationDegrees = 0f
                        try {
                            val path = Uri.parse(url).path
                            if (path != null) {
                                val exif = android.media.ExifInterface(path)
                                val orientation = exif.getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, android.media.ExifInterface.ORIENTATION_NORMAL)
                                rotationDegrees = when (orientation) {
                                    android.media.ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                                    android.media.ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                                    android.media.ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                                    else -> 0f
                                }
                                Log.w(TAG, "EXIF Orientation: $orientation, degrees: $rotationDegrees")
                            }
                        } catch (exifEx: Exception) {
                            Log.e(TAG, "Failed to read EXIF orientation", exifEx)
                        }

                        synchronized(this) {
                            imageRotationDegrees = rotationDegrees
                            if (rotationDegrees == 90f || rotationDegrees == 270f) {
                                mediaWidth = bitmap.height.toFloat()
                                mediaHeight = bitmap.width.toFloat()
                            } else {
                                mediaWidth = bitmap.width.toFloat()
                                mediaHeight = bitmap.height.toFloat()
                            }
                        }
                        
                        val textures = IntArray(1)
                        GLES20.glGenTextures(1, textures, 0)
                        if (imageTextureId != -1) {
                            GLES20.glDeleteTextures(1, intArrayOf(imageTextureId), 0)
                        }
                        imageTextureId = textures[0]
                        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
                        android.opengl.GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
                        bitmap.recycle()
                        requestRender()
                        Log.w(TAG, "Loaded static image texture: $imageTextureId (${mediaWidth}x${mediaHeight}) with rotation $rotationDegrees")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load bitmap image on GL thread", e)
                }
            }
        } else {
            isImage = false
            synchronized(this) {
                imageRotationDegrees = 0f
            }
            startMediaPlayer()
        }
    }

    fun setLogFormat(formatStr: String?) {
        logFormat = when (formatStr?.lowercase()) {
            "slog3" -> 1
            "clog" -> 2
            "dlog" -> 3
            "arrilogc3" -> 4
            "arrilogc4" -> 5
            "redlog3g10" -> 6
            "flog" -> 7
            "flog2" -> 8
            "vlog" -> 9
            "hlg" -> 10
            else -> 0 // rec709
        }
        requestRender()
    }

    fun setExposure(value: Float) {
        this.exposure = value
        requestRender()
    }

    fun setContrast(value: Float) {
        this.contrast = value
        requestRender()
    }

    fun setSaturation(value: Float) {
        this.saturation = value
        requestRender()
    }

    fun setGamma(value: Float) {
        this.gamma = value
        requestRender()
    }

    // Advanced Grading setters called from Manager
    fun setCurvesLut(array: ReadableArray?) {
        if (array == null || array.size() < 1024) return
        val data = FloatArray(1024)
        for (i in 0 until 1024) {
            data[i] = array.getDouble(i).toFloat()
        }
        synchronized(this) {
            curvesLutData = data
            curvesLutChanged = true
        }
        requestRender()
    }

    fun setColorWheels(array: ReadableArray?) {
        if (array == null || array.size() < 9) return
        val data = FloatArray(9)
        for (i in 0 until 9) {
            data[i] = array.getDouble(i).toFloat()
        }
        synchronized(this) {
            colorWheelsData = data
        }
        requestRender()
    }

    fun setTemperature(value: Float) {
        this.temperature = value
        requestRender()
    }

    fun setTint(value: Float) {
        this.tint = value
        requestRender()
    }

    fun setHighlights(value: Float) {
        this.highlights = value
        requestRender()
    }

    fun setShadows(value: Float) {
        this.shadows = value
        requestRender()
    }

    fun setToneContrast(value: Float) {
        this.toneContrast = value
        requestRender()
    }

    fun setVibrance(value: Float) {
        this.vibrance = value
        requestRender()
    }

    fun setHueRotation(value: Float) {
        this.hueRotation = value
        requestRender()
    }

    fun setVignetteParams(array: ReadableArray?) {
        if (array == null || array.size() < 5) return
        synchronized(this) {
            vignetteStrength = array.getDouble(0).toFloat()
            vignetteRadius = array.getDouble(1).toFloat()
            vignetteSoftness = array.getDouble(2).toFloat()
            vignetteCenterX = array.getDouble(3).toFloat()
            vignetteCenterY = array.getDouble(4).toFloat()
        }
        requestRender()
    }

    fun setDoubleExposureEnabled(value: Boolean) {
        synchronized(this) {
            doubleExposureEnabled = value
        }
        requestRender()
    }

    fun setDoubleExposureOpacity(value: Float) {
        synchronized(this) {
            doubleExposureOpacity = value
        }
        requestRender()
    }

    fun setDoubleExposureOffsetX(value: Float) {
        synchronized(this) {
            doubleExposureOffsetX = value
        }
        requestRender()
    }

    fun setDoubleExposureOffsetY(value: Float) {
        synchronized(this) {
            doubleExposureOffsetY = value
        }
        requestRender()
    }

    fun setDoubleExposureBlend(value: Int) {
        synchronized(this) {
            doubleExposureBlend = value
        }
        requestRender()
    }

    fun setDoubleExposureUri(value: String?) {
        synchronized(this) {
            if (value != doubleExposureUri) {
                doubleExposureUri = value
                doubleExposureUriChanged = true
            }
        }
        requestRender()
    }

    fun setDehaze(value: Float) {
        this.dehaze = value
        requestRender()
    }

    fun setHdrStrength(value: Float) {
        this.hdrStrength = value
        requestRender()
    }

    fun setSharpen(value: Float) {
        this.sharpen = value
        requestRender()
    }

    fun setDefinition(value: Float) {
        this.definition = value
        requestRender()
    }

    fun setSoftness(value: Float) {
        this.softness = value
        requestRender()
    }

    fun setDenoiseLuminance(value: Float) {
        this.denoiseLuminance = value
        requestRender()
    }

    fun setDenoiseColor(value: Float) {
        this.denoiseColor = value
        requestRender()
    }

    fun setCropX(value: Float) {
        synchronized(this) { this.cropX = value }
        requestRender()
    }

    fun setCropY(value: Float) {
        synchronized(this) { this.cropY = value }
        requestRender()
    }

    fun setCropWidth(value: Float) {
        synchronized(this) { this.cropWidth = value }
        requestRender()
    }

    fun setCropHeight(value: Float) {
        synchronized(this) { this.cropHeight = value }
        requestRender()
    }

    fun setZoomScale(value: Float) {
        synchronized(this) { this.zoomScale = value }
        requestRender()
    }

    fun setZoomX(value: Float) {
        synchronized(this) { this.zoomX = value }
        requestRender()
    }

    fun setZoomY(value: Float) {
        synchronized(this) { this.zoomY = value }
        requestRender()
    }

    fun setGrainAmount(value: Float) {
        this.grainAmount = value
        requestRender()
    }

    fun setGrainSize(value: Float) {
        this.grainSize = value
        requestRender()
    }

    fun setGrainRoughness(value: Float) {
        this.grainRoughness = value
        requestRender()
    }

    fun setHalationStrength(value: Float) {
        this.halationStrength = value
        requestRender()
    }

    fun setHalationRadius(value: Float) {
        this.halationRadius = value
        requestRender()
    }

    fun setHalationColor(value: String?) {
        if (value != null) {
            this.halationColor = value
            requestRender()
        }
    }

    fun setHalationCenterX(value: Float) {
        this.halationCenterX = value
        requestRender()
    }

    fun setHalationCenterY(value: Float) {
        this.halationCenterY = value
        requestRender()
    }

    fun setPerspectiveVertical(value: Float) {
        this.perspectiveVertical = value
        requestRender()
    }

    fun setPerspectiveHorizontal(value: Float) {
        this.perspectiveHorizontal = value
        requestRender()
    }

    fun setPerspectiveAspect(value: Float) {
        this.perspectiveAspect = value
        requestRender()
    }

    fun setPerspectiveRotate(value: Float) {
        this.perspectiveRotate = value
        requestRender()
    }

    fun setControlPoints(array: ReadableArray?) {
        if (array == null) return
        val size = array.size()
        val data = FloatArray(110) { 0f }
        for (i in 0 until Math.min(size, 110)) {
            data[i] = array.getDouble(i).toFloat()
        }
        synchronized(this) {
            controlPointsData = data
        }
        requestRender()
    }

    fun setMasks(array: ReadableArray?) {
        if (array == null) return
        val size = array.size()
        val data = FloatArray(65) { 0f }
        for (i in 0 until Math.min(size, 65)) {
            data[i] = array.getDouble(i).toFloat()
        }
        synchronized(this) {
            masksData = data
        }
        requestRender()
    }

    fun setBrushStroke(array: ReadableArray?) {
        if (array == null || array.size() < 4) return
        val x = array.getDouble(0).toFloat()
        val y = array.getDouble(1).toFloat()
        val r = array.getDouble(2).toFloat()
        val isStart = array.getDouble(3).toFloat() > 0.5f
        val clear = if (array.size() >= 5) array.getDouble(4).toFloat() > 0.5f else false
        val isErase = if (array.size() >= 6) array.getDouble(5).toFloat() > 0.5f else false

        synchronized(this) {
            initBrushCanvasIfNeeded()
            if (clear) {
                brushMaskCanvas?.drawColor(android.graphics.Color.TRANSPARENT, android.graphics.PorterDuff.Mode.CLEAR)
                lastBrushX = -1f
                lastBrushY = -1f
            } else {
                val zScale = if (zoomScale > 1.0f) zoomScale else 1.0f
                val zx = zoomX + (x - 0.5f) / zScale
                val zy = zoomY + (y - 0.5f) / zScale
                val ix = Math.max(0f, Math.min(1f, cropX + zx * cropWidth))
                val iy = Math.max(0f, Math.min(1f, cropY + zy * cropHeight))

                val px = ix * 512f
                val py = iy * 512f
                val pr = r * (cropWidth / zScale) * 512f
                brushMaskPaint?.strokeWidth = pr * 2f
                
                if (isErase) {
                    brushMaskPaint?.xfermode = android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR)
                } else {
                    brushMaskPaint?.xfermode = null
                }
                
                // Add a BlurMaskFilter to make the brush stroke edges soft and blend smoothly
                val blurRadius = Math.max(1.0f, pr)
                brushMaskPaint?.maskFilter = android.graphics.BlurMaskFilter(blurRadius, android.graphics.BlurMaskFilter.Blur.NORMAL)
                
                if (isStart || lastBrushX < 0f || lastBrushY < 0f) {
                    brushMaskCanvas?.drawCircle(px, py, pr, brushMaskPaint!!)
                } else {
                    brushMaskCanvas?.drawLine(lastBrushX, lastBrushY, px, py, brushMaskPaint!!)
                    brushMaskCanvas?.drawCircle(px, py, pr, brushMaskPaint!!)
                }
                lastBrushX = px
                lastBrushY = py
            }
            brushMaskChanged = true
        }
        requestRender()
    }

    private fun initBrushCanvasIfNeeded() {
        if (brushMaskBitmap == null) {
            brushMaskBitmap = android.graphics.Bitmap.createBitmap(512, 512, android.graphics.Bitmap.Config.ALPHA_8)
            brushMaskCanvas = android.graphics.Canvas(brushMaskBitmap!!)
            brushMaskPaint = android.graphics.Paint().apply {
                color = android.graphics.Color.WHITE  // alpha=255 → fully opaque strokes on ALPHA_8 bitmap
                style = android.graphics.Paint.Style.FILL_AND_STROKE
                strokeCap = android.graphics.Paint.Cap.ROUND
                strokeJoin = android.graphics.Paint.Join.ROUND
                isAntiAlias = true
            }
        }
    }

    fun setShowMaskOverlay(value: Boolean) {
        this.showMaskOverlay = value
        requestRender()
    }

    fun setActiveMaskIndex(value: Int) {
        synchronized(this) {
            if (this.activeMaskIndex != value) {
                this.activeMaskIndex = value
                // Ensure bitmap/canvas exist before clearing — without this the canvas is
                // null and the CLEAR call is silently skipped, leaving garbage GPU texture data.
                initBrushCanvasIfNeeded()
                brushMaskCanvas?.drawColor(android.graphics.Color.TRANSPARENT, android.graphics.PorterDuff.Mode.CLEAR)
                lastBrushX = -1f
                lastBrushY = -1f
                brushMaskChanged = true
            }
        }
        requestRender()
    }

    fun setLutData(array: ReadableArray?) {
        if (array == null) return
        val size = array.size()
        val data = FloatArray(size)
        for (i in 0 until size) {
            data[i] = array.getDouble(i).toFloat()
        }
        synchronized(this) {
            lutData = data
            lutChanged = true
        }
        requestRender()
    }

    fun setLutSize(value: Float) {
        this.lutSize = value
        requestRender()
    }

    fun setLutIntensity(value: Float) {
        this.lutIntensity = value
        requestRender()
    }

    fun setLutColorOffset(value: Float) {
        this.lutColorOffset = value
        requestRender()
    }

    fun setLutToneOffset(value: Float) {
        this.lutToneOffset = value
        requestRender()
    }

    fun setBokehStrength(value: Float) {
        this.bokehStrength = value
        requestRender()
    }

    fun setBokehRadius(value: Float) {
        this.bokehRadius = value
        requestRender()
    }

    fun setBokehShape(value: String?) {
        this.bokehShape = when (value) {
            "hexagon" -> 1
            "anamorphic" -> 2
            else -> 0
        }
        requestRender()
    }

    fun setBokehCenterX(value: Float) {
        this.bokehCenterX = value
        requestRender()
    }

    fun setBokehCenterY(value: Float) {
        this.bokehCenterY = value
        requestRender()
    }



    fun setLongExposureAmount(value: Float) {
        this.longExposureAmount = value
        requestRender()
    }

    fun setLongExposureDirection(value: Float) {
        this.longExposureDirection = value
        requestRender()
    }

    fun setLongExposureThreshold(value: Float) {
        this.longExposureThreshold = value
        requestRender()
    }

    fun setLongExposureCenterX(value: Float) {
        this.longExposureCenterX = value
        requestRender()
    }

    fun setLongExposureCenterY(value: Float) {
        this.longExposureCenterY = value
        requestRender()
    }

    fun setBrightness(value: Float) {
        synchronized(this) {
            this.brightness = value
        }
        requestRender()
    }

    fun setHslAdjustments(array: ReadableArray?) {
        if (array == null || array.size() < 24) return
        val data = FloatArray(24)
        for (i in 0 until 24) {
            data[i] = array.getDouble(i).toFloat()
        }
        synchronized(this) {
            this.hslAdjustments = data
        }
        requestRender()
    }

    private fun parseColorToRgb(colorStr: String): FloatArray {
        try {
            val hex = colorStr.replace("#", "")
            if (hex.length == 6) {
                val r = hex.substring(0, 2).toInt(16) / 255f
                val g = hex.substring(2, 4).toInt(16) / 255f
                val b = hex.substring(4, 6).toInt(16) / 255f
                return floatArrayOf(r, g, b)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse halation color: $colorStr", e)
        }
        return floatArrayOf(1f, 0.2f, 0.1f)
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        Log.w(TAG, "onSurfaceCreated")
        
        // Reset OpenGL texture resource IDs since EGL context was recreated
        textureId = -1
        imageTextureId = -1
        curvesTextureId = -1
        doubleExposureTextureId = -1
        brushMaskTextureId = -1
        lutTextureId = -1
        
        // Force re-upload of all custom textures in the new GL context
        synchronized(this) {
            if (curvesLutData != null) {
                curvesLutChanged = true
            }
            if (doubleExposureUri != null) {
                doubleExposureUriChanged = true
            }
            if (brushMaskBitmap != null) {
                brushMaskChanged = true
            }
            if (lutData != null) {
                lutChanged = true
            }
        }
        
        setupShaders()
        setupTexture()
        isSurfaceCreated = true
        post { checkAndLoadMedia() }
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        Log.w(TAG, "onSurfaceChanged called: width=$width height=$height")
        GLES20.glViewport(0, 0, width, height)
        synchronized(this) {
            viewWidth = width
            viewHeight = height
        }
    }

    override fun onDrawFrame(gl: GL10?) {
        Log.w(TAG, "onDrawFrame called!")
        synchronized(this) {
            if (isUpdateSurface) {
                surfaceTexture?.updateTexImage()
                surfaceTexture?.getTransformMatrix(stMatrix)
                isUpdateSurface = false
            }
        }

        val handles = if (isImage) imageHandles else videoHandles
        val activeProgramId = if (isImage) imageProgramId else videoProgramId
        if (handles == null || activeProgramId == -1) return

        programId = activeProgramId
        
        // 1. Process runtime GPU updates (upload curves, double exposure, brush, and LUT textures)
        uploadTexturesOnGlThread()
        checkGlError("uploadTexturesOnGlThread")

        GLES20.glClearColor(0.05f, 0.05f, 0.05f, 1.0f) // Sleek Lightroom background gray
        GLES20.glClear(GLES20.GL_DEPTH_BUFFER_BIT or GLES20.GL_COLOR_BUFFER_BIT)
        checkGlError("glClear")

        GLES20.glUseProgram(programId)
        checkGlError("glUseProgram")

        // 2. Setup aspect ratio containment (no stretch) and EXIF rotation
        Matrix.setIdentityM(mvpMatrix, 0)
        var mWidth = 0f
        var mHeight = 0f
        var vWidth = 0
        var vHeight = 0
        var rotationDeg = 0f
        synchronized(this) {
            mWidth = mediaWidth
            mHeight = mediaHeight
            vWidth = viewWidth
            vHeight = viewHeight
            rotationDeg = imageRotationDegrees
        }
        if (mWidth > 0f && mHeight > 0f && vWidth > 0 && vHeight > 0) {
            val viewAspect = vWidth.toFloat() / vHeight.toFloat()
            val mediaAspect = mWidth / mHeight
            var scaleX = 1f
            var scaleY = 1f
            if (mediaAspect > viewAspect) {
                scaleY = viewAspect / mediaAspect
            } else {
                scaleX = mediaAspect / viewAspect
            }
            Matrix.scaleM(mvpMatrix, 0, scaleX, scaleY, 1f)
            if (isImage && rotationDeg != 0f) {
                Matrix.rotateM(mvpMatrix, 0, -rotationDeg, 0f, 0f, 1f)
            }
        }

        // 3. Bind active texture units
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        checkGlError("glActiveTexture0")
        if (isImage) {
            if (imageTextureId != -1) {
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
                checkGlError("glBindTextureImage2D")
            } else if (curvesTextureId != -1) {
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
            }
        } else {
            if (textureId != -1) {
                GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
                checkGlError("glBindTextureOES")
            }
        }
        GLES20.glUniform1i(handles.sTextureHandle, 0)
        checkGlError("glUniform1iSTexture")

        // Always bind the curves texture to Unit 1 and set uCurvesTexture to 1
        GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
        checkGlError("glActiveTexture1")
        if (curvesTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
            checkGlError("glBindTextureCurves")
        } else if (imageTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
        }
        GLES20.glUniform1i(handles.curvesTextureHandle, 1)
        checkGlError("glUniform1iCurves")

        // Always bind the double exposure texture to Unit 2 and set sDoubleExposureTexture to 2
        GLES20.glActiveTexture(GLES20.GL_TEXTURE2)
        checkGlError("glActiveTexture2")
        if (doubleExposureTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, doubleExposureTextureId)
            checkGlError("glBindTextureDoubleExposure")
        } else if (curvesTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
        } else if (imageTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
        }
        GLES20.glUniform1i(handles.doubleExposureTextureHandle, 2)
        checkGlError("glUniform1iDoubleExposure")

        // Always bind the brush mask texture to Unit 3
        GLES20.glActiveTexture(GLES20.GL_TEXTURE3)
        checkGlError("glActiveTexture3")
        if (brushMaskTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, brushMaskTextureId)
            checkGlError("glBindTextureBrushMask")
        } else if (curvesTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
        } else if (imageTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
        }
        GLES20.glUniform1i(handles.sBrushMaskTextureHandle, 3)
        checkGlError("glUniform1iBrushMask")

        // Always bind the custom 3D LUT texture to Unit 4
        GLES20.glActiveTexture(GLES20.GL_TEXTURE4)
        checkGlError("glActiveTexture4")
        if (lutTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
            checkGlError("glBindTextureLut")
        } else if (curvesTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
        } else if (imageTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
        }
        GLES20.glUniform1i(handles.sLutTextureHandle, 4)
        checkGlError("glUniform1iLut")

        // Restore texture unit 0 as the active unit
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)

        // 4. Pass quad geometry coordinates
        verticesBuffer.position(0)
        GLES20.glVertexAttribPointer(handles.positionHandle, 3, GLES20.GL_FLOAT, false, 20, verticesBuffer)
        checkGlError("glVertexAttribPointerPosition")
        GLES20.glEnableVertexAttribArray(handles.positionHandle)
        checkGlError("glEnableVertexAttribArrayPosition")

        verticesBuffer.position(3)
        GLES20.glVertexAttribPointer(handles.textureCoordHandle, 2, GLES20.GL_FLOAT, false, 20, verticesBuffer)
        checkGlError("glVertexAttribPointerTexCoord")
        GLES20.glEnableVertexAttribArray(handles.textureCoordHandle)
        checkGlError("glEnableVertexAttribArrayTexCoord")

        // 5. Pass uniforms
        GLES20.glUniformMatrix4fv(handles.mvpMatrixHandle, 1, false, mvpMatrix, 0)
        GLES20.glUniformMatrix4fv(handles.stMatrixHandle, 1, false, stMatrix, 0)
        checkGlError("glUniformMatrix")
        
        GLES20.glUniform1f(handles.exposureHandle, exposure)
        GLES20.glUniform1f(handles.contrastHandle, contrast)
        GLES20.glUniform1f(handles.saturationHandle, saturation)
        GLES20.glUniform1f(handles.gammaHandle, gamma)
        GLES20.glUniform1i(handles.logFormatHandle, logFormat)
        checkGlError("glUniformCoreGrading")

        // Advanced uniform parameters
        GLES20.glUniform1f(handles.temperatureHandle, temperature)
        GLES20.glUniform1f(handles.tintHandle, tint)
        GLES20.glUniform1f(handles.highlightsHandle, highlights)
        GLES20.glUniform1f(handles.shadowsHandle, shadows)
        GLES20.glUniform1f(handles.toneContrastHandle, toneContrast)
        GLES20.glUniform1f(handles.vibranceHandle, vibrance)
        GLES20.glUniform1f(handles.hueRotationHandle, hueRotation)
        checkGlError("glUniformAdvanced")

        // Calculate and pass 3-way color wheels grading values
        var colorData = FloatArray(9)
        synchronized(this) {
            colorData = colorWheelsData.clone()
        }
        // Shadows Offset Vector
        var hRad = (colorData[0] * Math.PI / 180.0).toFloat()
        var sat = colorData[1]
        GLES20.glUniform3f(handles.shadowsColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
        GLES20.glUniform1f(handles.shadowsLiftHandle, colorData[2] * 0.2f)

        // Midtones Offset Vector
        hRad = (colorData[3] * Math.PI / 180.0).toFloat()
        sat = colorData[4]
        GLES20.glUniform3f(handles.midtonesColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
        GLES20.glUniform1f(handles.midtonesLiftHandle, colorData[5] * 0.2f)

        // Highlights Offset Vector
        hRad = (colorData[6] * Math.PI / 180.0).toFloat()
        sat = colorData[7]
        GLES20.glUniform3f(handles.highlightsColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
        GLES20.glUniform1f(handles.highlightsLiftHandle, colorData[8] * 0.2f)
        checkGlError("glUniformColorWheels")

        // Vignette params
        var vigStrength = 0f
        var vigRadius = 0.7f
        var vigSoftness = 0.5f
        var vigCX = 0.5f
        var vigCY = 0.5f
        synchronized(this) {
            vigStrength = vignetteStrength
            vigRadius = vignetteRadius
            vigSoftness = vignetteSoftness
            vigCX = vignetteCenterX
            vigCY = vignetteCenterY
        }
        GLES20.glUniform1f(handles.vignetteStrengthHandle, vigStrength)
        GLES20.glUniform1f(handles.vignetteRadiusHandle, vigRadius)
        GLES20.glUniform1f(handles.vignetteSoftnessHandle, vigSoftness)
        GLES20.glUniform2f(handles.vignetteCenterHandle, vigCX, vigCY)
        checkGlError("glUniformVignette")

        // Double Exposure params
        var deEnabled = false
        var deOpacity = 0.5f
        var deOX = 0f
        var deOY = 0f
        var deBlend = 0
        synchronized(this) {
            deEnabled = doubleExposureEnabled
            deOpacity = doubleExposureOpacity
            deOX = doubleExposureOffsetX
            deOY = doubleExposureOffsetY
            deBlend = doubleExposureBlend
        }
        GLES20.glUniform1i(handles.doubleExposureEnabledHandle, if (deEnabled && doubleExposureTextureId != -1) 1 else 0)
        GLES20.glUniform1f(handles.doubleExposureOpacityHandle, deOpacity)
        GLES20.glUniform2f(handles.doubleExposureOffsetHandle, deOX, deOY)
        GLES20.glUniform1i(handles.doubleExposureBlendHandle, deBlend)
        checkGlError("glUniformDoubleExposure")

        // New overhauls uniforms
        GLES20.glUniform1f(handles.dehazeHandle, dehaze)
        GLES20.glUniform1f(handles.hdrStrengthHandle, hdrStrength)
        GLES20.glUniform1f(handles.sharpenHandle, sharpen)
        GLES20.glUniform1f(handles.definitionHandle, definition)
        GLES20.glUniform1f(handles.softnessHandle, softness)
        GLES20.glUniform1f(handles.denoiseLuminanceHandle, denoiseLuminance)
        GLES20.glUniform1f(handles.denoiseColorHandle, denoiseColor)
        
        GLES20.glUniform1f(handles.grainAmountHandle, grainAmount)
        GLES20.glUniform1f(handles.grainSizeHandle, grainSize)
        GLES20.glUniform1f(handles.grainRoughnessHandle, grainRoughness)
        val grainSeed = (System.nanoTime() % 1000000).toFloat() / 1000f
        GLES20.glUniform1f(handles.grainSeedHandle, grainSeed)
        
        GLES20.glUniform1f(handles.halationStrengthHandle, halationStrength)
        GLES20.glUniform1f(handles.halationRadiusHandle, halationRadius)
        val hColor = parseColorToRgb(halationColor)
        GLES20.glUniform3f(handles.halationColorHandle, hColor[0], hColor[1], hColor[2])
        GLES20.glUniform2f(handles.halationCenterHandle, halationCenterX, halationCenterY)

        GLES20.glUniform1f(handles.perspectiveVerticalHandle, perspectiveVertical)
        GLES20.glUniform1f(handles.perspectiveHorizontalHandle, perspectiveHorizontal)
        GLES20.glUniform1f(handles.perspectiveAspectHandle, perspectiveAspect)
        GLES20.glUniform1f(handles.perspectiveRotateHandle, perspectiveRotate)

        // Pass control points flat array
        var cpData = FloatArray(110) { 0f }
        synchronized(this) {
            cpData = controlPointsData.clone()
        }
        var activeCps = 0
        for (i in 0 until 10) {
            if (cpData[i * 11 + 2] > 0.001f) {
                activeCps++
            }
        }
        GLES20.glUniform1fv(handles.controlPointsHandle, 110, cpData, 0)
        GLES20.glUniform1i(handles.numControlPointsHandle, activeCps)

        // Pass masks flat array
        var mData = FloatArray(65) { 0f }
        synchronized(this) {
            mData = masksData.clone()
        }
        var activeMasks = 0
        for (i in 0 until 5) {
            if (mData[i * 13 + 1] > 0.001f) {
                activeMasks++
            }
        }
        GLES20.glUniform1fv(handles.masksHandle, 65, mData, 0)
        GLES20.glUniform1i(handles.numMasksHandle, activeMasks)

        GLES20.glUniform1i(handles.showMaskOverlayHandle, if (showMaskOverlay) 1 else 0)
        GLES20.glUniform1i(handles.activeMaskIndexHandle, activeMaskIndex)

        GLES20.glUniform1f(handles.lutIntensityHandle, lutIntensity)
        GLES20.glUniform1f(handles.lutSizeHandle, lutSize)
        GLES20.glUniform1f(handles.lutColorOffsetHandle, lutColorOffset)
        GLES20.glUniform1f(handles.lutToneOffsetHandle, lutToneOffset)

        // Bokeh and Smear Trail uniforms
        var bkStrength = 0f
        var bkRadius = 0.3f
        var bkShape = 0
        var bkCX = 0.5f
        var bkCY = 0.5f

        var leAmount = 0f
        var leDirection = 0f
        var leThreshold = 0.4f
        var leCX = 0.5f
        var leCY = 0.5f
        synchronized(this) {
            bkStrength = bokehStrength
            bkRadius = bokehRadius
            bkShape = bokehShape
            bkCX = bokehCenterX
            bkCY = bokehCenterY

            leAmount = longExposureAmount
            leDirection = longExposureDirection
            leThreshold = longExposureThreshold
            leCX = longExposureCenterX
            leCY = longExposureCenterY
        }
        GLES20.glUniform1f(handles.bokehStrengthHandle, bkStrength)
        GLES20.glUniform1f(handles.bokehRadiusHandle, bkRadius)
        GLES20.glUniform1i(handles.bokehShapeHandle, bkShape)
        GLES20.glUniform2f(handles.bokehCenterHandle, bkCX, bkCY)



        GLES20.glUniform1f(handles.longExposureAmountHandle, leAmount)
        GLES20.glUniform1f(handles.longExposureDirectionHandle, leDirection)
        GLES20.glUniform1f(handles.longExposureThresholdHandle, leThreshold)
        GLES20.glUniform2f(handles.longExposureCenterHandle, leCX, leCY)

        var brightVal = 0f
        var hslData = FloatArray(24)
        synchronized(this) {
            brightVal = brightness
            hslData = hslAdjustments.clone()
        }
        GLES20.glUniform1f(handles.brightnessHandle, brightVal)
        GLES20.glUniform1fv(handles.hslAdjustmentsHandle, 24, hslData, 0)

        var crX = 0f
        var crY = 0f
        var crW = 1f
        var crH = 1f
        var zScale = 1f
        var zX = 0.5f
        var zY = 0.5f
        synchronized(this) {
            crX = cropX
            crY = cropY
            crW = cropWidth
            crH = cropHeight
            zScale = zoomScale
            zX = zoomX
            zY = zoomY
        }
        GLES20.glUniform1f(handles.cropXHandle, crX)
        GLES20.glUniform1f(handles.cropYHandle, crY)
        GLES20.glUniform1f(handles.cropWidthHandle, crW)
        GLES20.glUniform1f(handles.cropHeightHandle, crH)
        GLES20.glUniform1f(handles.zoomScaleHandle, zScale)
        GLES20.glUniform1f(handles.zoomXHandle, zX)
        GLES20.glUniform1f(handles.zoomYHandle, zY)

        val texelW = if (mWidth > 0f) 1.0f / mWidth else 1.0f / 1080.0f
        val texelH = if (mHeight > 0f) 1.0f / mHeight else 1.0f / 1920.0f
        GLES20.glUniform2f(handles.texelSizeHandle, texelW, texelH)
        checkGlError("glUniformNewOverhaulParameters")

        // 6. Draw quad
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        checkGlError("glDrawArrays")
    }

    private fun uploadTexturesOnGlThread() {
        if (curvesTextureId == -1) {
            val buffer = ByteBuffer.allocateDirect(1024)
            buffer.order(ByteOrder.nativeOrder())
            for (i in 0 until 256) {
                val b = i.toByte()
                buffer.put(b) // R (Master)
                buffer.put(b) // G (Red)
                buffer.put(b) // B (Green)
                buffer.put(b) // A (Blue)
            }
            buffer.position(0)

            val textures = IntArray(1)
            GLES20.glGenTextures(1, textures, 0)
            curvesTextureId = textures[0]
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, 256, 1, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, buffer)
            Log.w(TAG, "Initialized default identity curves LUT texture: $curvesTextureId")
        }

        var curvesChanged = false
        var curvesData: FloatArray? = null
        var deUriChanged = false
        var deUriStr: String? = null
        var brushChanged = false
        var lutChangedData = false
        var currentLutData: FloatArray? = null

        synchronized(this) {
            if (curvesLutChanged) {
                curvesLutChanged = false
                curvesChanged = true
                curvesData = curvesLutData?.clone()
            }
            if (doubleExposureUriChanged) {
                doubleExposureUriChanged = false
                deUriChanged = true
                deUriStr = doubleExposureUri
            }
            if (brushMaskChanged) {
                brushMaskChanged = false
                brushChanged = true
            }
            if (lutChanged) {
                lutChanged = false
                lutChangedData = true
                currentLutData = lutData?.clone()
            }
        }

        if (curvesChanged && curvesData != null) {
            val lut = curvesData!!
            val buffer = ByteBuffer.allocateDirect(1024)
            buffer.order(ByteOrder.nativeOrder())
            for (i in 0 until 1024) {
                val b = (Math.max(0f, Math.min(1f, lut[i])) * 255f).toInt().toByte()
                buffer.put(b)
            }
            buffer.position(0)

            if (curvesTextureId == -1) {
                val textures = IntArray(1)
                GLES20.glGenTextures(1, textures, 0)
                curvesTextureId = textures[0]
            }
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, 256, 1, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, buffer)
            Log.w(TAG, "Uploaded curves LUT to texture: $curvesTextureId")
        }

        if (deUriChanged) {
            if (!deUriStr.isNullOrEmpty()) {
                try {
                    val inputStream = openInputStream(deUriStr!!)
                    val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream)
                    inputStream?.close()
                    if (bitmap != null) {
                        if (doubleExposureTextureId == -1) {
                            val textures = IntArray(1)
                            GLES20.glGenTextures(1, textures, 0)
                            doubleExposureTextureId = textures[0]
                        }
                        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, doubleExposureTextureId)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
                        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
                        android.opengl.GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
                        bitmap.recycle()
                        Log.w(TAG, "Uploaded double exposure texture: $doubleExposureTextureId")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to load double exposure Bitmap on GL thread", e)
                }
            } else {
                if (doubleExposureTextureId != -1) {
                    GLES20.glDeleteTextures(1, intArrayOf(doubleExposureTextureId), 0)
                    doubleExposureTextureId = -1
                }
            }
        }

        if (brushChanged) {
            if (brushMaskTextureId == -1) {
                val textures = IntArray(1)
                GLES20.glGenTextures(1, textures, 0)
                brushMaskTextureId = textures[0]
            }
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, brushMaskTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
            
            synchronized(this) {
                // If bitmap is null (timing race before setActiveMaskIndex arrives), create a
                // clean all-zero bitmap here so we never upload uninitialized GPU memory.
                if (brushMaskBitmap == null) {
                    brushMaskBitmap = android.graphics.Bitmap.createBitmap(512, 512, android.graphics.Bitmap.Config.ALPHA_8)
                    brushMaskCanvas = android.graphics.Canvas(brushMaskBitmap!!)
                }
                brushMaskBitmap?.let { bmp ->
                    android.opengl.GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0)
                }
            }
            Log.w(TAG, "Uploaded brush mask texture: $brushMaskTextureId")
        }

        if (lutChangedData && currentLutData != null) {
            if (lutTextureId == -1) {
                val textures = IntArray(1)
                GLES20.glGenTextures(1, textures, 0)
                lutTextureId = textures[0]
            }
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
            
            val lut = currentLutData!!
            val packedBuffer = ByteBuffer.allocateDirect(1089 * 33 * 4).order(ByteOrder.nativeOrder())
            if (lut.size >= 33 * 33 * 33 * 3) {
                for (g in 0 until 33) {
                    for (b in 0 until 33) {
                        for (r in 0 until 33) {
                            val srcIdx = (b * 1089 + g * 33 + r) * 3
                            if (srcIdx + 2 < lut.size) {
                                val rawR = lut[srcIdx]
                                val rawG = lut[srcIdx + 1]
                                val rawB = lut[srcIdx + 2]
                                val outR = (Math.max(0f, Math.min(1f, rawR)) * 255f).toInt().toByte()
                                val outG = (Math.max(0f, Math.min(1f, rawG)) * 255f).toInt().toByte()
                                val outB = (Math.max(0f, Math.min(1f, rawB)) * 255f).toInt().toByte()
                                packedBuffer.put(outR)
                                packedBuffer.put(outG)
                                packedBuffer.put(outB)
                                packedBuffer.put(255.toByte())
                            }
                        }
                    }
                }
            } else {
                // Identity fallback
                for (g in 0 until 33) {
                    for (b in 0 until 33) {
                        for (r in 0 until 33) {
                            val outR = (r / 32f * 255f).toInt().toByte()
                            val outG = (g / 32f * 255f).toInt().toByte()
                            val outB = (b / 32f * 255f).toInt().toByte()
                            packedBuffer.put(outR)
                            packedBuffer.put(outG)
                            packedBuffer.put(outB)
                            packedBuffer.put(255.toByte())
                        }
                    }
                }
            }
            packedBuffer.position(0)
            GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, 1089, 33, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, packedBuffer)
            Log.w(TAG, "Uploaded packed horizontal 2D LUT texture: $lutTextureId")
        }
    }

    override fun onFrameAvailable(surfaceTexture: SurfaceTexture?) {
        synchronized(this) {
            isUpdateSurface = true
        }
        requestRender()
    }

    private fun startMediaPlayer() {
        val url = videoUrl ?: return
        Log.w(TAG, "Starting MediaPlayer: $url")
        try {
            mediaPlayer?.release()
            mediaPlayer = null
            
            val mp = MediaPlayer()
            Thread {
                try {
                    mp.setDataSource(context, Uri.parse(url))
                    post {
                        try {
                            val sf = surface
                            if (sf != null) {
                                mp.setSurface(sf)
                                mp.isLooping = true
                                mp.setOnPreparedListener { preparedMp ->
                                    Log.d(TAG, "MediaPlayer prepared: ${preparedMp.videoWidth}x${preparedMp.videoHeight}")
                                    synchronized(this@LogVideoPlayerView) {
                                        mediaWidth = preparedMp.videoWidth.toFloat()
                                        mediaHeight = preparedMp.videoHeight.toFloat()
                                    }
                                    synchronized(this@LogVideoPlayerView) {
                                        if (!isPaused) {
                                            preparedMp.start()
                                        }
                                    }
                                    requestRender()
                                }
                                mp.setOnVideoSizeChangedListener { _, w, h ->
                                    synchronized(this@LogVideoPlayerView) {
                                        mediaWidth = w.toFloat()
                                        mediaHeight = h.toFloat()
                                    }
                                    requestRender()
                                }
                                mp.setOnErrorListener { _, what, extra ->
                                    Log.e(TAG, "MediaPlayer error: what=$what extra=$extra")
                                    true
                                }
                                mediaPlayer = mp
                                mp.prepareAsync()
                            } else {
                                mp.release()
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to prepare media player on UI thread", e)
                            mp.release()
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to setDataSource in background", e)
                    mp.release()
                }
            }.start()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start media player thread", e)
        }
    }

    private fun setupTexture() {
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]

        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_NEAREST.toFloat())
        GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR.toFloat())

        surfaceTexture = SurfaceTexture(textureId).apply {
            setOnFrameAvailableListener(this@LogVideoPlayerView)
        }
        surface = Surface(surfaceTexture)
    }

    private fun setupShaders() {
        // 1. Compile video shader program
        val videoVertex = compileShader(GLES20.GL_VERTEX_SHADER, ColorGradingShader.VIDEO_VERTEX_SHADER)
        val videoFragment = compileShader(GLES20.GL_FRAGMENT_SHADER, ColorGradingShader.getFragmentShader(false))
        videoProgramId = GLES20.glCreateProgram().apply {
            GLES20.glAttachShader(this, videoVertex)
            GLES20.glAttachShader(this, videoFragment)
            GLES20.glLinkProgram(this)
            val linkStatus = IntArray(1)
            GLES20.glGetProgramiv(this, GLES20.GL_LINK_STATUS, linkStatus, 0)
            if (linkStatus[0] == 0) {
                Log.e(TAG, "Video shader program link failed: " + GLES20.glGetProgramInfoLog(this))
            }
        }
        videoHandles = ProgramHandles(videoProgramId)

        // 2. Compile image shader program
        val imageVertex = compileShader(GLES20.GL_VERTEX_SHADER, ColorGradingShader.IMAGE_VERTEX_SHADER)
        val imageFragment = compileShader(GLES20.GL_FRAGMENT_SHADER, ColorGradingShader.getFragmentShader(true))
        imageProgramId = GLES20.glCreateProgram().apply {
            GLES20.glAttachShader(this, imageVertex)
            GLES20.glAttachShader(this, imageFragment)
            GLES20.glLinkProgram(this)
            val linkStatus = IntArray(1)
            GLES20.glGetProgramiv(this, GLES20.GL_LINK_STATUS, linkStatus, 0)
            if (linkStatus[0] == 0) {
                Log.e(TAG, "Image shader program link failed: " + GLES20.glGetProgramInfoLog(this))
            }
        }
        imageHandles = ProgramHandles(imageProgramId)

        // Initialize sampler texture units to prevent conflict / GL_INVALID_OPERATION
        GLES20.glUseProgram(videoProgramId)
        videoHandles?.let { h ->
            GLES20.glUniform1i(h.sTextureHandle, 0)
            GLES20.glUniform1i(h.curvesTextureHandle, 1)
            GLES20.glUniform1i(h.doubleExposureTextureHandle, 2)
            GLES20.glUniform1i(h.sBrushMaskTextureHandle, 3)
            GLES20.glUniform1i(h.sLutTextureHandle, 4)
        }

        GLES20.glUseProgram(imageProgramId)
        imageHandles?.let { h ->
            GLES20.glUniform1i(h.sTextureHandle, 0)
            GLES20.glUniform1i(h.curvesTextureHandle, 1)
            GLES20.glUniform1i(h.doubleExposureTextureHandle, 2)
            GLES20.glUniform1i(h.sBrushMaskTextureHandle, 3)
            GLES20.glUniform1i(h.sLutTextureHandle, 4)
        }
    }

    private fun compileShader(type: Int, shaderCode: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, shaderCode)
        GLES20.glCompileShader(shader)
        val compiled = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
        if (compiled[0] == 0) {
            Log.e(TAG, "Shader compilation failed: " + GLES20.glGetShaderInfoLog(shader))
            GLES20.glDeleteShader(shader)
            return 0
        }
        return shader
    }

    private fun checkGlError(op: String) {
        val error = GLES20.glGetError()
        if (error != GLES20.GL_NO_ERROR) {
            Log.e(TAG, "$op: glError $error")
        }
    }

    fun setPaused(paused: Boolean) {
        synchronized(this) {
            isPaused = paused
        }
        post {
            if (paused) {
                onPausePlayer()
            } else {
                onResumePlayer()
            }
        }
    }

    fun onPausePlayer() {
        mediaPlayer?.pause()
    }

    fun onResumePlayer() {
        synchronized(this) {
            if (isPaused) return
        }
        mediaPlayer?.start()
    }

    fun onRelease() {
        mediaPlayer?.release()
        mediaPlayer = null
        surface?.release()
        surface = null
        surfaceTexture?.release()
        surfaceTexture = null
        if (imageTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(imageTextureId), 0)
            imageTextureId = -1
        }
        if (curvesTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(curvesTextureId), 0)
            curvesTextureId = -1
        }
        if (doubleExposureTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(doubleExposureTextureId), 0)
            doubleExposureTextureId = -1
        }
        if (brushMaskTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(brushMaskTextureId), 0)
            brushMaskTextureId = -1
        }
        if (lutTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(lutTextureId), 0)
            lutTextureId = -1
        }
        brushMaskBitmap?.recycle()
        brushMaskBitmap = null
        brushMaskCanvas = null
        brushMaskPaint = null

        if (videoProgramId != -1) {
            GLES20.glDeleteProgram(videoProgramId)
            videoProgramId = -1
        }
        if (imageProgramId != -1) {
            GLES20.glDeleteProgram(imageProgramId)
            imageProgramId = -1
        }
    }

    fun exportGradedImage(watermarkEnabled: Boolean, watermarkDeviceName: String, watermarkBorderColor: String, isFreeUser: Boolean, promise: com.facebook.react.bridge.Promise) {
        val url = videoUrl
        if (url == null) {
            promise.reject("EXPORT_ERROR", "No active media loaded")
            return
        }
        
        var mWidth = 0
        var mHeight = 0
        var exp = 0f
        var cont = 0f
        var temp = 0f
        var sat = 0f
        var crX = 0f
        var crY = 0f
        var crW = 1f
        var crH = 1f
        synchronized(this) {
            mWidth = mediaWidth.toInt()
            mHeight = mediaHeight.toInt()
            exp = exposure
            cont = contrast
            temp = temperature
            sat = saturation
            crX = cropX
            crY = cropY
            crW = cropWidth
            crH = cropHeight
        }
        
        if (mWidth <= 0 || mHeight <= 0) {
            promise.reject("EXPORT_ERROR", "Invalid media dimensions")
            return
        }

        val finalWidth = (mWidth * crW).toInt().coerceAtLeast(4)
        val finalHeight = (mHeight * crH).toInt().coerceAtLeast(4)
        
        queueEvent {
            try {
                // 1. Create Framebuffer and Texture
                val fb = IntArray(1)
                val tex = IntArray(1)
                GLES20.glGenFramebuffers(1, fb, 0)
                GLES20.glGenTextures(1, tex, 0)
                
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex[0])
                GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, finalWidth, finalHeight, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                
                GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fb[0])
                GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, tex[0], 0)
                
                val status = GLES20.glCheckFramebufferStatus(GLES20.GL_FRAMEBUFFER)
                if (status != GLES20.GL_FRAMEBUFFER_COMPLETE) {
                    GLES20.glDeleteFramebuffers(1, fb, 0)
                    GLES20.glDeleteTextures(1, tex, 0)
                    promise.reject("EXPORT_ERROR", "Framebuffer incomplete status: $status")
                    return@queueEvent
                }
                
                // 2. Save current viewport and set viewport to full image resolution
                val oldViewport = IntArray(4)
                GLES20.glGetIntegerv(GLES20.GL_VIEWPORT, oldViewport, 0)
                GLES20.glViewport(0, 0, finalWidth, finalHeight)
                
                // 3. Bind shader program
                val handles = if (isImage) imageHandles else videoHandles
                val activeProgramId = if (isImage) imageProgramId else videoProgramId
                if (handles == null || activeProgramId == -1) {
                    promise.reject("EXPORT_ERROR", "Shaders not initialized")
                    return@queueEvent
                }
                
                GLES20.glUseProgram(activeProgramId)
                
                // 4. Draw graded image into the framebuffer
                uploadTexturesOnGlThread()
                
                GLES20.glClearColor(0f, 0f, 0f, 1f)
                GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
                
                val exportMvp = FloatArray(16)
                Matrix.setIdentityM(exportMvp, 0)
                var rotationDeg = 0f
                synchronized(this) {
                    rotationDeg = imageRotationDegrees
                }
                if (isImage && rotationDeg != 0f) {
                    Matrix.rotateM(exportMvp, 0, -rotationDeg, 0f, 0f, 1f)
                }
                
                // Bind texture units
                GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
                if (isImage) {
                    if (imageTextureId != -1) {
                        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTextureId)
                    }
                } else {
                    if (textureId != -1) {
                        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
                    }
                }
                GLES20.glUniform1i(handles.sTextureHandle, 0)
                
                GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
                if (curvesTextureId != -1) {
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
                }
                GLES20.glUniform1i(handles.curvesTextureHandle, 1)
                
                GLES20.glActiveTexture(GLES20.GL_TEXTURE2)
                if (doubleExposureTextureId != -1) {
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, doubleExposureTextureId)
                }
                GLES20.glUniform1i(handles.doubleExposureTextureHandle, 2)
                
                GLES20.glActiveTexture(GLES20.GL_TEXTURE3)
                if (brushMaskTextureId != -1) {
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, brushMaskTextureId)
                }
                GLES20.glUniform1i(handles.sBrushMaskTextureHandle, 3)
                
                GLES20.glActiveTexture(GLES20.GL_TEXTURE4)
                if (lutTextureId != -1) {
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
                }
                GLES20.glUniform1i(handles.sLutTextureHandle, 4)
                
                GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
                
                // Set geometry
                verticesBuffer.position(0)
                GLES20.glVertexAttribPointer(handles.positionHandle, 3, GLES20.GL_FLOAT, false, 20, verticesBuffer)
                GLES20.glEnableVertexAttribArray(handles.positionHandle)
                
                verticesBuffer.position(3)
                GLES20.glVertexAttribPointer(handles.textureCoordHandle, 2, GLES20.GL_FLOAT, false, 20, verticesBuffer)
                GLES20.glEnableVertexAttribArray(handles.textureCoordHandle)
                
                GLES20.glUniformMatrix4fv(handles.mvpMatrixHandle, 1, false, exportMvp, 0)
                GLES20.glUniformMatrix4fv(handles.stMatrixHandle, 1, false, stMatrix, 0)
                
                // Set parameters uniforms
                GLES20.glUniform1f(handles.exposureHandle, exposure)
                GLES20.glUniform1f(handles.contrastHandle, contrast)
                GLES20.glUniform1f(handles.saturationHandle, saturation)
                GLES20.glUniform1f(handles.gammaHandle, gamma)
                GLES20.glUniform1i(handles.logFormatHandle, logFormat)
                
                GLES20.glUniform1f(handles.temperatureHandle, temperature)
                GLES20.glUniform1f(handles.tintHandle, tint)
                GLES20.glUniform1f(handles.highlightsHandle, highlights)
                GLES20.glUniform1f(handles.shadowsHandle, shadows)
                GLES20.glUniform1f(handles.toneContrastHandle, toneContrast)
                GLES20.glUniform1f(handles.vibranceHandle, vibrance)
                GLES20.glUniform1f(handles.hueRotationHandle, hueRotation)
                
                var brightVal = 0f
                var hslData = FloatArray(24)
                synchronized(this) {
                    brightVal = brightness
                    hslData = hslAdjustments.clone()
                }
                GLES20.glUniform1f(handles.brightnessHandle, brightVal)
                GLES20.glUniform1fv(handles.hslAdjustmentsHandle, 24, hslData, 0)
                
                // Color wheels
                var colorData = FloatArray(9)
                synchronized(this) { colorData = colorWheelsData.clone() }
                var hRad = (colorData[0] * Math.PI / 180.0).toFloat()
                var sat = colorData[1]
                GLES20.glUniform3f(handles.shadowsColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
                GLES20.glUniform1f(handles.shadowsLiftHandle, colorData[2] * 0.2f)
                
                hRad = (colorData[3] * Math.PI / 180.0).toFloat()
                sat = colorData[4]
                GLES20.glUniform3f(handles.midtonesColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
                GLES20.glUniform1f(handles.midtonesLiftHandle, colorData[5] * 0.2f)
                
                hRad = (colorData[6] * Math.PI / 180.0).toFloat()
                sat = colorData[7]
                GLES20.glUniform3f(handles.highlightsColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
                GLES20.glUniform1f(handles.highlightsLiftHandle, colorData[8] * 0.2f)
                
                // Vignette
                var vigStrength = 0f
                var vigRadius = 0.7f
                var vigSoftness = 0.5f
                var vigCX = 0.5f
                var vigCY = 0.5f
                synchronized(this) {
                    vigStrength = vignetteStrength
                    vigRadius = vignetteRadius
                    vigSoftness = vignetteSoftness
                    vigCX = vignetteCenterX
                    vigCY = vignetteCenterY
                }
                GLES20.glUniform1f(handles.vignetteStrengthHandle, vigStrength)
                GLES20.glUniform1f(handles.vignetteRadiusHandle, vigRadius)
                GLES20.glUniform1f(handles.vignetteSoftnessHandle, vigSoftness)
                GLES20.glUniform2f(handles.vignetteCenterHandle, vigCX, vigCY)
                
                // Double exposure
                var deEnabled = false
                var deOpacity = 0.5f
                var deOX = 0f
                var deOY = 0f
                var deBlend = 0
                synchronized(this) {
                    deEnabled = doubleExposureEnabled
                    deOpacity = doubleExposureOpacity
                    deOX = doubleExposureOffsetX
                    deOY = doubleExposureOffsetY
                    deBlend = doubleExposureBlend
                }
                GLES20.glUniform1i(handles.doubleExposureEnabledHandle, if (deEnabled && doubleExposureTextureId != -1) 1 else 0)
                GLES20.glUniform1f(handles.doubleExposureOpacityHandle, deOpacity)
                GLES20.glUniform2f(handles.doubleExposureOffsetHandle, deOX, deOY)
                GLES20.glUniform1i(handles.doubleExposureBlendHandle, deBlend)
                
                // Overhauls
                GLES20.glUniform1f(handles.dehazeHandle, dehaze)
                GLES20.glUniform1f(handles.hdrStrengthHandle, hdrStrength)
                GLES20.glUniform1f(handles.sharpenHandle, sharpen)
                GLES20.glUniform1f(handles.definitionHandle, definition)
                GLES20.glUniform1f(handles.softnessHandle, softness)
                GLES20.glUniform1f(handles.denoiseLuminanceHandle, denoiseLuminance)
                GLES20.glUniform1f(handles.denoiseColorHandle, denoiseColor)
                
                GLES20.glUniform1f(handles.grainAmountHandle, grainAmount)
                GLES20.glUniform1f(handles.grainSizeHandle, grainSize)
                GLES20.glUniform1f(handles.grainRoughnessHandle, grainRoughness)
                val grainSeed = (System.nanoTime() % 1000000).toFloat() / 1000f
                GLES20.glUniform1f(handles.grainSeedHandle, grainSeed)
                
                GLES20.glUniform1f(handles.halationStrengthHandle, halationStrength)
                GLES20.glUniform1f(handles.halationRadiusHandle, halationRadius)
                val hColor = parseColorToRgb(halationColor)
                GLES20.glUniform3f(handles.halationColorHandle, hColor[0], hColor[1], hColor[2])
                GLES20.glUniform2f(handles.halationCenterHandle, halationCenterX, halationCenterY)
                
                GLES20.glUniform1f(handles.perspectiveVerticalHandle, perspectiveVertical)
                GLES20.glUniform1f(handles.perspectiveHorizontalHandle, perspectiveHorizontal)
                GLES20.glUniform1f(handles.perspectiveAspectHandle, perspectiveAspect)
                GLES20.glUniform1f(handles.perspectiveRotateHandle, perspectiveRotate)
                
                // Control points
                var cpData = FloatArray(110)
                synchronized(this) { cpData = controlPointsData.clone() }
                var activeCps = 0
                for (i in 0 until 10) {
                    if (cpData[i * 11 + 2] > 0.001f) activeCps++
                }
                GLES20.glUniform1fv(handles.controlPointsHandle, 110, cpData, 0)
                GLES20.glUniform1i(handles.numControlPointsHandle, activeCps)
                
                // Masks
                var mData = FloatArray(65)
                synchronized(this) { mData = masksData.clone() }
                var activeMasks = 0
                for (i in 0 until 5) {
                    if (mData[i * 13 + 1] > 0.001f) activeMasks++
                }
                GLES20.glUniform1fv(handles.masksHandle, 65, mData, 0)
                GLES20.glUniform1i(handles.numMasksHandle, activeMasks)
                GLES20.glUniform1i(handles.showMaskOverlayHandle, if (showMaskOverlay) 1 else 0)
                GLES20.glUniform1i(handles.activeMaskIndexHandle, activeMaskIndex)
                
                GLES20.glUniform1f(handles.lutIntensityHandle, lutIntensity)
                GLES20.glUniform1f(handles.lutSizeHandle, lutSize)
                GLES20.glUniform1f(handles.lutColorOffsetHandle, lutColorOffset)
                GLES20.glUniform1f(handles.lutToneOffsetHandle, lutToneOffset)
                
                // Bokeh and Smear Trail
                var bkStrength = 0f
                var bkRadius = 0.3f
                var bkShape = 0
                var bkCX = 0.5f
                var bkCY = 0.5f

                var leAmount = 0f
                var leDirection = 0f
                var leThreshold = 0.4f
                var leCX = 0.5f
                var leCY = 0.5f
                synchronized(this) {
                    bkStrength = bokehStrength
                    bkRadius = bokehRadius
                    bkShape = bokehShape
                    bkCX = bokehCenterX
                    bkCY = bokehCenterY

                    leAmount = longExposureAmount
                    leDirection = longExposureDirection
                    leThreshold = longExposureThreshold
                    leCX = longExposureCenterX
                    leCY = longExposureCenterY
                }
                GLES20.glUniform1f(handles.bokehStrengthHandle, bkStrength)
                GLES20.glUniform1f(handles.bokehRadiusHandle, bkRadius)
                GLES20.glUniform1i(handles.bokehShapeHandle, bkShape)
                GLES20.glUniform2f(handles.bokehCenterHandle, bkCX, bkCY)
                

                
                GLES20.glUniform1f(handles.longExposureAmountHandle, leAmount)
                GLES20.glUniform1f(handles.longExposureDirectionHandle, leDirection)
                GLES20.glUniform1f(handles.longExposureThresholdHandle, leThreshold)
                GLES20.glUniform2f(handles.longExposureCenterHandle, leCX, leCY)

                var crX = 0f
                var crY = 0f
                var crW = 1f
                var crH = 1f
                var zScale = 1f
                var zX = 0.5f
                var zY = 0.5f
                synchronized(this) {
                    crX = cropX
                    crY = cropY
                    crW = cropWidth
                    crH = cropHeight
                    zScale = zoomScale
                    zX = zoomX
                    zY = zoomY
                }
                GLES20.glUniform1f(handles.cropXHandle, crX)
                GLES20.glUniform1f(handles.cropYHandle, crY)
                GLES20.glUniform1f(handles.cropWidthHandle, crW)
                GLES20.glUniform1f(handles.cropHeightHandle, crH)
                GLES20.glUniform1f(handles.zoomScaleHandle, zScale)
                GLES20.glUniform1f(handles.zoomXHandle, zX)
                GLES20.glUniform1f(handles.zoomYHandle, zY)
                
                val texelW = if (finalWidth > 0) 1.0f / finalWidth.toFloat() else 1.0f / 1080.0f
                val texelH = if (finalHeight > 0) 1.0f / finalHeight.toFloat() else 1.0f / 1920.0f
                GLES20.glUniform2f(handles.texelSizeHandle, texelW, texelH)
                
                GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
                
                // Read pixels from Framebuffer
                val buffer = ByteBuffer.allocateDirect(finalWidth * finalHeight * 4)
                buffer.order(ByteOrder.nativeOrder())
                GLES20.glReadPixels(0, 0, finalWidth, finalHeight, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, buffer)
                
                // Restore viewport and framebuffer
                GLES20.glViewport(oldViewport[0], oldViewport[1], oldViewport[2], oldViewport[3])
                GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
                GLES20.glDeleteFramebuffers(1, fb, 0)
                GLES20.glDeleteTextures(1, tex, 0)
                
                // Flip pixels vertically and write to file
                Thread {
                    try {
                        val pixels = IntArray(finalWidth * finalHeight)
                        buffer.position(0)
                        val ib = buffer.asIntBuffer()
                        
                        // Flip vertically
                        for (y in 0 until finalHeight) {
                            ib.position(y * finalWidth)
                            ib.get(pixels, (finalHeight - y - 1) * finalWidth, finalWidth)
                        }
                        
                        // Convert RGBA to ARGB
                        for (i in 0 until pixels.size) {
                            val pixel = pixels[i]
                            val r = (pixel shr 0) and 0xff
                            val g = (pixel shr 8) and 0xff
                            val b = (pixel shr 16) and 0xff
                            val a = (pixel shr 24) and 0xff
                            pixels[i] = (a shl 24) or (r shl 16) or (g shl 8) or b
                        }
                        
                        var outBitmap = android.graphics.Bitmap.createBitmap(pixels, finalWidth, finalHeight, android.graphics.Bitmap.Config.ARGB_8888)
                        
                        if (watermarkBorderColor == "white" || watermarkBorderColor == "black") {
                            val borderSize = (finalWidth.coerceAtLeast(finalHeight) * 0.05f).toInt().coerceAtLeast(15)
                            val topBorder = borderSize
                            val leftBorder = borderSize
                            val rightBorder = borderSize
                            val bottomBorder = if (watermarkEnabled) (finalHeight * 0.15f).toInt().coerceAtLeast(borderSize * 2) else borderSize

                            val paddedWidth = finalWidth + leftBorder + rightBorder
                            val paddedHeight = finalHeight + topBorder + bottomBorder

                            val paddedBitmap = android.graphics.Bitmap.createBitmap(paddedWidth, paddedHeight, android.graphics.Bitmap.Config.ARGB_8888)
                            val canvas = android.graphics.Canvas(paddedBitmap)

                            val borderPaintColor = if (watermarkBorderColor == "white") android.graphics.Color.WHITE else android.graphics.Color.BLACK
                            canvas.drawColor(borderPaintColor)

                            val srcRect = android.graphics.Rect(0, 0, finalWidth, finalHeight)
                            val dstRect = android.graphics.Rect(leftBorder, topBorder, leftBorder + finalWidth, topBorder + finalHeight)
                            canvas.drawBitmap(outBitmap, srcRect, dstRect, null)
                            outBitmap.recycle()

                            if (watermarkEnabled) {
                                val textPaint = android.graphics.Paint().apply {
                                    color = if (watermarkBorderColor == "white") android.graphics.Color.BLACK else android.graphics.Color.WHITE
                                    textSize = (bottomBorder * 0.25f).coerceAtLeast(20f)
                                    isAntiAlias = true
                                    style = android.graphics.Paint.Style.FILL
                                    typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
                                }

                                val text1 = "SHOT ON $watermarkDeviceName"
                                val expText = String.format("%.2f EV", exp)
                                val contText = String.format("%d%%", Math.round(cont * 100))
                                val tempText = String.format("%dK", Math.round(temp))
                                val text2 = "EXP: $expText | CONT: $contText | TEMP: $tempText"

                                textPaint.textAlign = android.graphics.Paint.Align.CENTER
                                val xPos = paddedWidth / 2f

                                val yCenter = topBorder + finalHeight + (bottomBorder * 0.45f)
                                val y1 = yCenter - (textPaint.textSize * 0.2f)
                                canvas.drawText(text1.uppercase(), xPos, y1, textPaint)

                                textPaint.apply {
                                    textSize = textSize * 0.75f
                                    color = if (watermarkBorderColor == "white") android.graphics.Color.DKGRAY else android.graphics.Color.LTGRAY
                                    typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.NORMAL)
                                }
                                val y2 = yCenter + textPaint.textSize * 1.0f
                                canvas.drawText(text2, xPos, y2, textPaint)
                            }
                            outBitmap = paddedBitmap
                        } else if (watermarkEnabled) {
                            val mutableBitmap = outBitmap.copy(android.graphics.Bitmap.Config.ARGB_8888, true)
                            outBitmap.recycle()
                            val canvas = android.graphics.Canvas(mutableBitmap)
                            
                            val paint = android.graphics.Paint().apply {
                                color = android.graphics.Color.WHITE
                                textSize = (finalHeight * 0.022f).coerceAtLeast(24f)
                                isAntiAlias = true
                                style = android.graphics.Paint.Style.FILL
                                setShadowLayer(4f, 2f, 2f, android.graphics.Color.BLACK)
                            }
                            
                            val text1 = "SHOT ON $watermarkDeviceName"
                            val expText = String.format("%.2f EV", exp)
                            val contText = String.format("%d%%", Math.round(cont * 100))
                            val tempText = String.format("%dK", Math.round(temp))
                            val text2 = "EXP: $expText | CONT: $contText | TEMP: $tempText"
                            
                            val margin = (finalHeight * 0.04f).coerceAtLeast(30f)
                            val x = margin
                            val y2 = finalHeight - margin
                            val y1 = y2 - paint.textSize - 10f
                            
                            canvas.drawText(text1.uppercase(), x, y1, paint)
                            paint.textSize = paint.textSize * 0.75f
                            paint.color = android.graphics.Color.LTGRAY
                            canvas.drawText(text2, x, y2, paint)
                            
                            outBitmap = mutableBitmap
                        }

                        // If free user, draw "LUT LAB" in the bottom-right corner of the picture.
                        if (isFreeUser) {
                            val mutableBitmap = if (outBitmap.isMutable) outBitmap else outBitmap.copy(android.graphics.Bitmap.Config.ARGB_8888, true)
                            if (mutableBitmap != outBitmap) {
                                outBitmap.recycle()
                            }
                            val canvas = android.graphics.Canvas(mutableBitmap)
                            val wSize = mutableBitmap.width
                            val hSize = mutableBitmap.height
                            val sizeRef = Math.min(wSize, hSize)
                            val textSizeVal = (sizeRef * 0.035f).coerceAtLeast(22f).coerceAtMost(60f)
                            
                            val watermarkPaint = android.graphics.Paint().apply {
                                color = android.graphics.Color.WHITE
                                textSize = textSizeVal
                                isAntiAlias = true
                                style = android.graphics.Paint.Style.FILL
                                typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
                                alpha = 180 // Semi-transparent
                                setShadowLayer(4f, 2f, 2f, android.graphics.Color.argb(120, 0, 0, 0))
                            }
                            
                            val text = "LUT LAB"
                            val textWidth = watermarkPaint.measureText(text)
                            val marginX = sizeRef * 0.04f
                            val marginY = sizeRef * 0.04f
                            
                            // Adjust for border width/height so watermark is always inside the actual picture area
                            val hasBorder = (watermarkBorderColor == "white" || watermarkBorderColor == "black")
                            val rBorder = if (hasBorder) (finalWidth.coerceAtLeast(finalHeight) * 0.05f).toInt().coerceAtLeast(15) else 0
                            val bBorder = if (hasBorder) {
                                if (watermarkEnabled) (finalHeight * 0.15f).toInt().coerceAtLeast(rBorder * 2) else rBorder
                            } else 0
                            
                            val picEndX = wSize - rBorder
                            val picEndY = hSize - bBorder
                            
                            val textX = picEndX - textWidth - marginX
                            val textY = picEndY - marginY - watermarkPaint.fontMetrics.descent
                            
                            canvas.drawText(text, textX, textY, watermarkPaint)
                            outBitmap = mutableBitmap
                        }

                        val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                        if (!downloadsDir.exists()) {
                            downloadsDir.mkdirs()
                        }
                        
                        val file = java.io.File(downloadsDir, "Picture_" + System.currentTimeMillis() + ".jpg")
                        val outStream = java.io.FileOutputStream(file)
                        outBitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 100, outStream)
                        outStream.flush()
                        outStream.close()
                        outBitmap.recycle()
                        
                        android.media.MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf("image/jpeg"), null)
                        
                        promise.resolve(file.absolutePath)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to save exported bitmap", e)
                        promise.reject("EXPORT_ERROR", "Failed to save image: " + e.message)
                    }
                }.start()
                
            } catch (e: Exception) {
                Log.e(TAG, "FBO Export pipeline exception", e)
                promise.reject("EXPORT_ERROR", "FBO Export failed: " + e.message)
            }
        }
    }

    fun getGradingParams(): GradingParams {
        synchronized(this) {
            return GradingParams(
                logFormat = this.logFormat,
                exposure = this.exposure,
                contrast = this.contrast,
                saturation = this.saturation,
                gamma = this.gamma,
                temperature = this.temperature,
                tint = this.tint,
                highlights = this.highlights,
                shadows = this.shadows,
                toneContrast = this.toneContrast,
                vibrance = this.vibrance,
                hueRotation = this.hueRotation,
                vignetteStrength = this.vignetteStrength,
                vignetteRadius = this.vignetteRadius,
                vignetteSoftness = this.vignetteSoftness,
                vignetteCenterX = this.vignetteCenterX,
                vignetteCenterY = this.vignetteCenterY,
                doubleExposureEnabled = this.doubleExposureEnabled,
                doubleExposureOpacity = this.doubleExposureOpacity,
                doubleExposureOffsetX = this.doubleExposureOffsetX,
                doubleExposureOffsetY = this.doubleExposureOffsetY,
                doubleExposureBlend = this.doubleExposureBlend,
                doubleExposureUri = this.doubleExposureUri,
                dehaze = this.dehaze,
                hdrStrength = this.hdrStrength,
                sharpen = this.sharpen,
                definition = this.definition,
                softness = this.softness,
                denoiseLuminance = this.denoiseLuminance,
                denoiseColor = this.denoiseColor,
                grainAmount = this.grainAmount,
                grainSize = this.grainSize,
                grainRoughness = this.grainRoughness,
                halationStrength = this.halationStrength,
                halationRadius = this.halationRadius,
                halationColor = this.halationColor,
                halationCenterX = this.halationCenterX,
                halationCenterY = this.halationCenterY,
                perspectiveVertical = this.perspectiveVertical,
                perspectiveHorizontal = this.perspectiveHorizontal,
                perspectiveAspect = this.perspectiveAspect,
                perspectiveRotate = this.perspectiveRotate,
                controlPointsData = this.controlPointsData.clone(),
                masksData = this.masksData.clone(),
                brushMaskBitmap = this.brushMaskBitmap?.let { it.copy(it.config ?: android.graphics.Bitmap.Config.ALPHA_8, true) },
                lutData = this.lutData?.clone(),
                lutSize = this.lutSize,
                lutIntensity = this.lutIntensity,
                lutColorOffset = this.lutColorOffset,
                lutToneOffset = this.lutToneOffset,
                curvesLutData = this.curvesLutData?.clone(),
                bokehStrength = this.bokehStrength,
                bokehRadius = this.bokehRadius,
                bokehShape = this.bokehShape,
                bokehCenterX = this.bokehCenterX,
                bokehCenterY = this.bokehCenterY,
                longExposureAmount = this.longExposureAmount,
                longExposureDirection = this.longExposureDirection,
                longExposureThreshold = this.longExposureThreshold,
                longExposureCenterX = this.longExposureCenterX,
                longExposureCenterY = this.longExposureCenterY,
                brightness = this.brightness,
                hslAdjustments = this.hslAdjustments.clone(),
                colorWheelsData = this.colorWheelsData.clone(),
                cropX = this.cropX,
                cropY = this.cropY,
                cropWidth = this.cropWidth,
                cropHeight = this.cropHeight,
                zoomScale = this.zoomScale,
                zoomX = this.zoomX,
                zoomY = this.zoomY
            )
        }
    }

    companion object {
        private var activeViewRef: java.lang.ref.WeakReference<LogVideoPlayerView>? = null
        fun getActiveView(): LogVideoPlayerView? = activeViewRef?.get()
        fun setActiveView(view: LogVideoPlayerView) {
            activeViewRef = java.lang.ref.WeakReference(view)
        }
    }
}

private class ProgramHandles(programId: Int) {
    val positionHandle = GLES20.glGetAttribLocation(programId, "aPosition")
    val textureCoordHandle = GLES20.glGetAttribLocation(programId, "aTextureCoord")
    val mvpMatrixHandle = GLES20.glGetUniformLocation(programId, "uMVPMatrix")
    val stMatrixHandle = GLES20.glGetUniformLocation(programId, "uSTMatrix")
    
    val sTextureHandle = GLES20.glGetUniformLocation(programId, "sTexture")
    val exposureHandle = GLES20.glGetUniformLocation(programId, "uExposure")
    val contrastHandle = GLES20.glGetUniformLocation(programId, "uContrast")
    val saturationHandle = GLES20.glGetUniformLocation(programId, "uSaturation")
    val gammaHandle = GLES20.glGetUniformLocation(programId, "uGamma")
    val logFormatHandle = GLES20.glGetUniformLocation(programId, "uLogFormat")

    // Advanced handles
    val curvesTextureHandle = GLES20.glGetUniformLocation(programId, "uCurvesTexture")
    val doubleExposureTextureHandle = GLES20.glGetUniformLocation(programId, "sDoubleExposureTexture")
    val temperatureHandle = GLES20.glGetUniformLocation(programId, "uTemperature")
    val tintHandle = GLES20.glGetUniformLocation(programId, "uTint")
    val highlightsHandle = GLES20.glGetUniformLocation(programId, "uHighlights")
    val shadowsHandle = GLES20.glGetUniformLocation(programId, "uShadows")
    val toneContrastHandle = GLES20.glGetUniformLocation(programId, "uToneContrast")
    val vibranceHandle = GLES20.glGetUniformLocation(programId, "uVibrance")
    val hueRotationHandle = GLES20.glGetUniformLocation(programId, "uHueRotation")

    // Color wheels handles
    val shadowsColorHandle = GLES20.glGetUniformLocation(programId, "uShadowsColor")
    val midtonesColorHandle = GLES20.glGetUniformLocation(programId, "uMidtonesColor")
    val highlightsColorHandle = GLES20.glGetUniformLocation(programId, "uHighlightsColor")
    val shadowsLiftHandle = GLES20.glGetUniformLocation(programId, "uShadowsLift")
    val midtonesLiftHandle = GLES20.glGetUniformLocation(programId, "uMidtonesLift")
    val highlightsLiftHandle = GLES20.glGetUniformLocation(programId, "uHighlightsLift")

    // Vignette handles
    val vignetteStrengthHandle = GLES20.glGetUniformLocation(programId, "uVignetteStrength")
    val vignetteRadiusHandle = GLES20.glGetUniformLocation(programId, "uVignetteRadius")
    val vignetteSoftnessHandle = GLES20.glGetUniformLocation(programId, "uVignetteSoftness")
    val vignetteCenterHandle = GLES20.glGetUniformLocation(programId, "uVignetteCenter")

    // Double exposure handles
    val doubleExposureEnabledHandle = GLES20.glGetUniformLocation(programId, "uDoubleExposureEnabled")
    val doubleExposureOpacityHandle = GLES20.glGetUniformLocation(programId, "uDoubleExposureOpacity")
    val doubleExposureOffsetHandle = GLES20.glGetUniformLocation(programId, "uDoubleExposureOffset")
    val doubleExposureBlendHandle = GLES20.glGetUniformLocation(programId, "uDoubleExposureBlend")

    // New handles for overhauls
    val sBrushMaskTextureHandle = GLES20.glGetUniformLocation(programId, "sBrushMaskTexture")
    val sLutTextureHandle = GLES20.glGetUniformLocation(programId, "sLutTexture")
    
    val dehazeHandle = GLES20.glGetUniformLocation(programId, "uDehaze")
    val hdrStrengthHandle = GLES20.glGetUniformLocation(programId, "uHdrStrength")
    val sharpenHandle = GLES20.glGetUniformLocation(programId, "uSharpen")
    val definitionHandle = GLES20.glGetUniformLocation(programId, "uDefinition")
    val softnessHandle = GLES20.glGetUniformLocation(programId, "uSoftness")
    val denoiseLuminanceHandle = GLES20.glGetUniformLocation(programId, "uDenoiseLuminance")
    val denoiseColorHandle = GLES20.glGetUniformLocation(programId, "uDenoiseColor")
    val grainAmountHandle = GLES20.glGetUniformLocation(programId, "uGrainAmount")
    val grainSizeHandle = GLES20.glGetUniformLocation(programId, "uGrainSize")
    val grainRoughnessHandle = GLES20.glGetUniformLocation(programId, "uGrainRoughness")
    val halationStrengthHandle = GLES20.glGetUniformLocation(programId, "uHalationStrength")
    val halationRadiusHandle = GLES20.glGetUniformLocation(programId, "uHalationRadius")
    val halationColorHandle = GLES20.glGetUniformLocation(programId, "uHalationColor")
    val halationCenterHandle = GLES20.glGetUniformLocation(programId, "uHalationCenter")
    
    val perspectiveVerticalHandle = GLES20.glGetUniformLocation(programId, "uPerspectiveVertical")
    val perspectiveHorizontalHandle = GLES20.glGetUniformLocation(programId, "uPerspectiveHorizontal")
    val perspectiveAspectHandle = GLES20.glGetUniformLocation(programId, "uPerspectiveAspect")
    val perspectiveRotateHandle = GLES20.glGetUniformLocation(programId, "uPerspectiveRotate")
    
    val controlPointsHandle = GLES20.glGetUniformLocation(programId, "uControlPoints")
    val numControlPointsHandle = GLES20.glGetUniformLocation(programId, "uNumControlPoints")
    val masksHandle = GLES20.glGetUniformLocation(programId, "uMasks")
    val numMasksHandle = GLES20.glGetUniformLocation(programId, "uNumMasks")
    val showMaskOverlayHandle = GLES20.glGetUniformLocation(programId, "uShowMaskOverlay")
    val activeMaskIndexHandle = GLES20.glGetUniformLocation(programId, "uActiveMaskIndex")
    
    val lutIntensityHandle = GLES20.glGetUniformLocation(programId, "uLutIntensity")
    val lutSizeHandle = GLES20.glGetUniformLocation(programId, "uLutSize")
    val lutColorOffsetHandle = GLES20.glGetUniformLocation(programId, "uLutColorOffset")
    val lutToneOffsetHandle = GLES20.glGetUniformLocation(programId, "uLutToneOffset")
    val texelSizeHandle = GLES20.glGetUniformLocation(programId, "uTexelSize")
    val grainSeedHandle = GLES20.glGetUniformLocation(programId, "uGrainSeed")

    // Bokeh handles
    val bokehStrengthHandle = GLES20.glGetUniformLocation(programId, "uBokehStrength")
    val bokehRadiusHandle = GLES20.glGetUniformLocation(programId, "uBokehRadius")
    val bokehShapeHandle = GLES20.glGetUniformLocation(programId, "uBokehShape")
    val bokehCenterHandle = GLES20.glGetUniformLocation(programId, "uBokehCenter")



    // Smear Trail handles
    val longExposureAmountHandle = GLES20.glGetUniformLocation(programId, "uLongExposureAmount")
    val longExposureDirectionHandle = GLES20.glGetUniformLocation(programId, "uLongExposureDirection")
    val longExposureThresholdHandle = GLES20.glGetUniformLocation(programId, "uLongExposureThreshold")
    val longExposureCenterHandle = GLES20.glGetUniformLocation(programId, "uLongExposureCenter")

    val brightnessHandle = GLES20.glGetUniformLocation(programId, "uBrightness")
    val hslAdjustmentsHandle = GLES20.glGetUniformLocation(programId, "uHslAdjustments")

    val cropXHandle = GLES20.glGetUniformLocation(programId, "uCropX")
    val cropYHandle = GLES20.glGetUniformLocation(programId, "uCropY")
    val cropWidthHandle = GLES20.glGetUniformLocation(programId, "uCropWidth")
    val cropHeightHandle = GLES20.glGetUniformLocation(programId, "uCropHeight")
    val zoomScaleHandle = GLES20.glGetUniformLocation(programId, "uZoomScale")
    val zoomXHandle = GLES20.glGetUniformLocation(programId, "uZoomX")
    val zoomYHandle = GLES20.glGetUniformLocation(programId, "uZoomY")
}

data class GradingParams(
    val logFormat: Int,
    val exposure: Float,
    val contrast: Float,
    val saturation: Float,
    val gamma: Float,
    val denoiseLuminance: Float,
    val denoiseColor: Float,
    val curvesLutData: FloatArray?,
    val temperature: Float,
    val tint: Float,
    val highlights: Float,
    val shadows: Float,
    val toneContrast: Float,
    val vibrance: Float,
    val hueRotation: Float,
    val vignetteStrength: Float,
    val vignetteRadius: Float,
    val vignetteSoftness: Float,
    val vignetteCenterX: Float,
    val vignetteCenterY: Float,
    val doubleExposureEnabled: Boolean,
    val doubleExposureOpacity: Float,
    val doubleExposureOffsetX: Float,
    val doubleExposureOffsetY: Float,
    val doubleExposureBlend: Int,
    val doubleExposureUri: String?,
    val dehaze: Float,
    val hdrStrength: Float,
    val sharpen: Float,
    val definition: Float,
    val softness: Float,
    val grainAmount: Float,
    val grainSize: Float,
    val grainRoughness: Float,
    val halationStrength: Float,
    val halationRadius: Float,
    val halationColor: String,
    val halationCenterX: Float,
    val halationCenterY: Float,
    val perspectiveVertical: Float,
    val perspectiveHorizontal: Float,
    val perspectiveAspect: Float,
    val perspectiveRotate: Float,
    val controlPointsData: FloatArray,
    val masksData: FloatArray,
    val brushMaskBitmap: android.graphics.Bitmap?,
    val lutData: FloatArray?,
    val lutSize: Float,
    val lutIntensity: Float,
    val lutColorOffset: Float,
    val lutToneOffset: Float,
    val bokehStrength: Float,
    val bokehRadius: Float,
    val bokehShape: Int,
    val bokehCenterX: Float,
    val bokehCenterY: Float,
    val longExposureAmount: Float,
    val longExposureDirection: Float,
    val longExposureThreshold: Float,
    val longExposureCenterX: Float,
    val longExposureCenterY: Float,
    val brightness: Float,
    val hslAdjustments: FloatArray,
    val colorWheelsData: FloatArray,
    val cropX: Float,
    val cropY: Float,
    val cropWidth: Float,
    val cropHeight: Float,
    val zoomScale: Float,
    val zoomX: Float,
    val zoomY: Float
)
