package com.myandroidapp.video

import android.content.Context
import android.graphics.SurfaceTexture
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.camera2.*
import android.hardware.camera2.params.MeteringRectangle
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.ImageReader
import android.media.MediaRecorder
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.opengl.Matrix
import android.opengl.EGL14
import android.opengl.EGLExt
import android.os.Handler
import android.os.HandlerThread
import android.os.Environment
import android.util.Log
import android.view.Surface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.concurrent.Executor
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class CameraPreviewView(context: Context) : GLSurfaceView(context), GLSurfaceView.Renderer, SurfaceTexture.OnFrameAvailableListener {
    private val TAG = "CameraPreviewView"

    // Camera State
    private var cameraManager: CameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var previewRequestBuilder: CaptureRequest.Builder? = null
    
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null

    // View State
    private var activeCameraId: String = "0"
    private var surfaceTexture: SurfaceTexture? = null
    private var previewSurface: Surface? = null
    private var cameraTextureId = -1
    private var programId = -1
    
    // Media Recorder & EGL for Video Recording
    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var currentVideoPath: String = ""
    private var videoPromise: Promise? = null
    private var recorderWidth = 1920
    private var recorderHeight = 1080
    
    private var eglDisplay: android.opengl.EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: android.opengl.EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglConfig: android.opengl.EGLConfig? = null
    private var eglEncoderSurface: android.opengl.EGLSurface = EGL14.EGL_NO_SURFACE
    private val eglDisplaySurface: android.opengl.EGLSurface
        get() = EGL14.eglGetCurrentSurface(EGL14.EGL_DRAW)

    // Image Reader for high-res photo capture
    private var imageReader: ImageReader? = null
    private var photoPromise: Promise? = null

    // Control parameters (manual controls)
    private var isoValue = -1 // -1 = auto
    private var shutterSpeedMs = -1L // -1 = auto (represented in microseconds: e.g. 8000 for 1/125s)
    private var whiteBalanceMode = "auto" // auto, daylight, cloudy, incandescent, fluorescent
    private var meteringMode = "matrix" // matrix, center, spot
    private var focusMode = "auto" // auto, manual
    private var focusDistance = 0f // diopters: 0.0 (infinity) to 10.0f
    private var flashMode = "off" // off, on, torch

    private var highMpMode = false
    private var unprocessed = false

    // Adjustments & LUT variables (mirroring LogVideoPlayerView)
    private var logFormat = 0
    private var exposure = 0f
    private var contrast = 1f
    private var saturation = 1f
    private var gamma = 1f
    private var brightness = 0f
    
    private var curvesLutData: FloatArray? = null
    private var curvesLutChanged = false
    private var curvesTextureId = -1
    private var curvesTextureHandle = -1

    private var colorWheelsData = FloatArray(9) { 0f }
    private var temperature = 0f
    private var tint = 0f
    private var highlights = 0f
    private var shadows = 0f
    private var toneContrast = 0f
    private var vibrance = 0f
    private var hueRotation = 0f
    private var hslAdjustments = FloatArray(24) { 0f }

    private var vignetteStrength = 0f
    private var vignetteRadius = 0.7f
    private var vignetteSoftness = 0.5f
    private var vignetteCenterX = 0.5f
    private var vignetteCenterY = 0.5f

    private var dehaze = 0f
    private var hdrStrength = 0f
    private var sharpen = 0f
    private var definition = 0f
    private var softness = 0f
    private var grainAmount = 0f
    private var grainSize = 2f
    private var grainRoughness = 0.5f
    
    private var denoiseLuminance = 0f
    private var denoiseColor = 0f

    private var lutData: FloatArray? = null
    private var lutSize = 0f
    private var lutIntensity = 100f
    private var lutTextureId = -1
    private var lutChanged = false

    private val mvpMatrix = FloatArray(16)
    private val stMatrix = FloatArray(16)
    
    private val triangleVerticesData = floatArrayOf(
        -1.0f, -1.0f, 0f, 0f, 0f,
         1.0f, -1.0f, 0f, 1f, 0f,
        -1.0f,  1.0f, 0f, 0f, 1f,
         1.0f,  1.0f, 0f, 1f, 1f
    )
    private val verticesBuffer: FloatBuffer

    init {
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

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        Log.i(TAG, "onSurfaceCreated")
        eglDisplay = EGL14.eglGetCurrentDisplay()
        eglContext = EGL14.eglGetCurrentContext()
        eglConfig = getAndroidEglConfig(eglDisplay)

        // Generate OES texture for preview
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        cameraTextureId = textures[0]
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)

        // Create the SurfaceTexture and Surface on the GL thread so they bind to the correct EGL context
        synchronized(this) {
            surfaceTexture?.release()
            surfaceTexture = SurfaceTexture(cameraTextureId).apply {
                setOnFrameAvailableListener(this@CameraPreviewView)
            }
            surfaceTexture!!.setDefaultBufferSize(1920, 1080)
            previewSurface?.release()
            previewSurface = Surface(surfaceTexture)
        }

        compileShaders()
        startCameraThread()
        openActiveCamera()
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        Log.i(TAG, "onSurfaceChanged: ${width}x${height}")
        GLES20.glViewport(0, 0, width, height)
    }

    override fun onDrawFrame(gl: GL10?) {
        var localSurfaceTexture: SurfaceTexture? = null
        synchronized(this) {
            localSurfaceTexture = surfaceTexture
        }
        if (localSurfaceTexture == null) return

        // Clear any pending GL errors to prevent false 0x502 alerts on updateTexImage
        var glError = GLES20.glGetError()
        while (glError != GLES20.GL_NO_ERROR) {
            Log.w(TAG, "Clearing pending GL error before updateTexImage: 0x${Integer.toHexString(glError)}")
            glError = GLES20.glGetError()
        }

        try {
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
            localSurfaceTexture!!.updateTexImage()
            localSurfaceTexture!!.getTransformMatrix(stMatrix)
        } catch (e: Exception) {
            Log.e(TAG, "Error updating texture image: ${e.message}")
            return
        }

        // 1. Draw to display surface (preview screen)
        drawGLFrame(isImage = false, targetTextureId = cameraTextureId, width = width, height = height)

        // 2. Draw to video encoder surface if recording
        if (isRecording && eglEncoderSurface != EGL14.EGL_NO_SURFACE) {
            EGL14.eglMakeCurrent(eglDisplay, eglEncoderSurface, eglEncoderSurface, eglContext)
            GLES20.glViewport(0, 0, recorderWidth, recorderHeight)
            drawGLFrame(isImage = false, targetTextureId = cameraTextureId, width = recorderWidth, height = recorderHeight)
            EGLExt.eglPresentationTimeANDROID(eglDisplay, eglEncoderSurface, localSurfaceTexture!!.timestamp)
            EGL14.eglSwapBuffers(eglDisplay, eglEncoderSurface)
            // Restore context back to display surface
            EGL14.eglMakeCurrent(eglDisplay, eglDisplaySurface, eglDisplaySurface, eglContext)
            GLES20.glViewport(0, 0, width, height)
        }
    }

    override fun onFrameAvailable(surfaceTexture: SurfaceTexture?) {
        requestRender()
    }

    private fun drawGLFrame(isImage: Boolean, targetTextureId: Int, width: Int, height: Int) {
        GLES20.glClearColor(0.0f, 0.0f, 0.0f, 1.0f)
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

        if (programId == -1) return
        GLES20.glUseProgram(programId)

        // Set vertices
        val positionHandle = GLES20.glGetAttribLocation(programId, "aPosition")
        GLES20.glEnableVertexAttribArray(positionHandle)
        verticesBuffer.position(0)
        GLES20.glVertexAttribPointer(positionHandle, 3, GLES20.GL_FLOAT, false, 20, verticesBuffer)

        val textureCoordHandle = GLES20.glGetAttribLocation(programId, "aTextureCoord")
        GLES20.glEnableVertexAttribArray(textureCoordHandle)
        verticesBuffer.position(3)
        GLES20.glVertexAttribPointer(textureCoordHandle, 2, GLES20.GL_FLOAT, false, 20, verticesBuffer)

        // Setup matrices
        val mvpMatrixHandle = GLES20.glGetUniformLocation(programId, "uMVPMatrix")
        GLES20.glUniformMatrix4fv(mvpMatrixHandle, 1, false, mvpMatrix, 0)

        val stMatrixHandle = GLES20.glGetUniformLocation(programId, "uSTMatrix")
        GLES20.glUniformMatrix4fv(stMatrixHandle, 1, false, stMatrix, 0)

        // Bind source OES preview or 2D image texture
        val sTextureHandle = GLES20.glGetUniformLocation(programId, "sTexture")
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        if (isImage) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, targetTextureId)
        } else {
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, targetTextureId)
        }
        GLES20.glUniform1i(sTextureHandle, 0)

        // Bind 3D LUT texture
        bindLutTexture()

        // Bind Curves LUT texture
        bindCurvesTexture()

        // Update adjustments uniforms
        setShaderUniforms()

        // Draw quad
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

        GLES20.glDisableVertexAttribArray(positionHandle)
        GLES20.glDisableVertexAttribArray(textureCoordHandle)
    }

    private fun compileShaders() {
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, ColorGradingShader.VIDEO_VERTEX_SHADER)
        val fragmentShader = loadShader(GLES20.GL_FRAGMENT_SHADER, ColorGradingShader.getFragmentShader(isImage = false))
        
        programId = GLES20.glCreateProgram()
        GLES20.glAttachShader(programId, vertexShader)
        GLES20.glAttachShader(programId, fragmentShader)
        GLES20.glLinkProgram(programId)

        val linkStatus = IntArray(1)
        GLES20.glGetProgramiv(programId, GLES20.GL_LINK_STATUS, linkStatus, 0)
        if (linkStatus[0] != GLES20.GL_TRUE) {
            Log.e(TAG, "Shader linking failed: " + GLES20.glGetProgramInfoLog(programId))
        } else {
            GLES20.glUseProgram(programId)
            GLES20.glUniform1i(GLES20.glGetUniformLocation(programId, "sDoubleExposureTexture"), 3)
            GLES20.glUniform1i(GLES20.glGetUniformLocation(programId, "sBrushMaskTexture"), 4)
        }
    }

    private fun loadShader(type: Int, shaderCode: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, shaderCode)
        GLES20.glCompileShader(shader)
        val compiled = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
        if (compiled[0] == 0) {
            Log.e(TAG, "Shader compilation failed ($type): " + GLES20.glGetShaderInfoLog(shader))
        }
        return shader
    }

    private fun bindLutTexture() {
        val activeLutData = synchronized(this) {
            if (lutChanged) {
                lutChanged = false
                lutData
            } else null
        }

        if (activeLutData != null) {
            if (lutTextureId != -1) {
                GLES20.glDeleteTextures(1, intArrayOf(lutTextureId), 0)
            }
            val tex = IntArray(1)
            GLES20.glGenTextures(1, tex, 0)
            lutTextureId = tex[0]
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)

            val packedBuffer = ByteBuffer.allocateDirect(1089 * 33 * 4).order(ByteOrder.nativeOrder())
            if (activeLutData.size >= 33 * 33 * 33 * 3) {
                for (g in 0 until 33) {
                    for (b in 0 until 33) {
                        for (r in 0 until 33) {
                            val srcIdx = (b * 1089 + g * 33 + r) * 3
                            if (srcIdx + 2 < activeLutData.size) {
                                val rawR = activeLutData[srcIdx]
                                val rawG = activeLutData[srcIdx + 1]
                                val rawB = activeLutData[srcIdx + 2]
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

            GLES20.glTexImage2D(
                GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA,
                1089, 33, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, packedBuffer
            )
        }

        val sLutTextureHandle = GLES20.glGetUniformLocation(programId, "sLutTexture")
        val uLutSizeHandle = GLES20.glGetUniformLocation(programId, "uLutSize")
        val uLutIntensityHandle = GLES20.glGetUniformLocation(programId, "uLutIntensity")

        if (lutTextureId != -1) {
            GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
            GLES20.glUniform1i(sLutTextureHandle, 1)
            GLES20.glUniform1f(uLutSizeHandle, lutSize)
            GLES20.glUniform1f(uLutIntensityHandle, lutIntensity)
        } else {
            GLES20.glUniform1f(uLutSizeHandle, 0f)
        }
    }

    private fun bindCurvesTexture() {
        val activeCurves = synchronized(this) {
            if (curvesLutChanged) {
                curvesLutChanged = false
                curvesLutData
            } else null
        }

        if (activeCurves != null) {
            if (curvesTextureId != -1) {
                GLES20.glDeleteTextures(1, intArrayOf(curvesTextureId), 0)
            }
            val tex = IntArray(1)
            GLES20.glGenTextures(1, tex, 0)
            curvesTextureId = tex[0]
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)

            val buffer = ByteBuffer.allocateDirect(1024)
            buffer.order(ByteOrder.nativeOrder())
            for (i in 0 until 1024) {
                val b = (Math.max(0f, Math.min(1f, activeCurves[i])) * 255f).toInt().toByte()
                buffer.put(b)
            }
            buffer.position(0)

            GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, 256, 1, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, buffer)
        } else if (curvesTextureId == -1) {
            // Initialize default identity curves LUT texture
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

        val curvesHandle = GLES20.glGetUniformLocation(programId, "uCurvesTexture")
        if (curvesTextureId != -1) {
            GLES20.glActiveTexture(GLES20.GL_TEXTURE2)
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
            GLES20.glUniform1i(curvesHandle, 2)
        }
    }

    private fun setShaderUniforms() {
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uExposure"), exposure)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uContrast"), contrast)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uSaturation"), saturation)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uGamma"), gamma)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uBrightness"), brightness)
        GLES20.glUniform1i(GLES20.glGetUniformLocation(programId, "uLogFormat"), logFormat)

        // Advanced color grading
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uTemperature"), temperature)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uTint"), tint)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uHighlights"), highlights)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uShadows"), shadows)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uToneContrast"), toneContrast)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uVibrance"), vibrance)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uHueRotation"), hueRotation)
        GLES20.glUniform3f(GLES20.glGetUniformLocation(programId, "uShadowsColor"), colorWheelsData[0], colorWheelsData[1], colorWheelsData[2])
        GLES20.glUniform3f(GLES20.glGetUniformLocation(programId, "uMidtonesColor"), colorWheelsData[3], colorWheelsData[4], colorWheelsData[5])
        GLES20.glUniform3f(GLES20.glGetUniformLocation(programId, "uHighlightsColor"), colorWheelsData[6], colorWheelsData[7], colorWheelsData[8])

        val hslHandle = GLES20.glGetUniformLocation(programId, "uHslAdjustments")
        GLES20.glUniform1fv(hslHandle, 24, hslAdjustments, 0)

        // Vignette
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uVignetteStrength"), vignetteStrength)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uVignetteRadius"), vignetteRadius)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uVignetteSoftness"), vignetteSoftness)
        GLES20.glUniform2f(GLES20.glGetUniformLocation(programId, "uVignetteCenter"), vignetteCenterX, vignetteCenterY)

        // Overhaul tools
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uDehaze"), dehaze)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uHdrStrength"), hdrStrength)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uSharpen"), sharpen)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uDefinition"), definition)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uSoftness"), softness)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uDenoiseLuminance"), denoiseLuminance)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uDenoiseColor"), denoiseColor)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uGrainAmount"), grainAmount)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uGrainSize"), grainSize)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uGrainRoughness"), grainRoughness)

        // Turn off unneeded filters in camera screen to keep high preview framerate
        GLES20.glUniform1i(GLES20.glGetUniformLocation(programId, "uNumMasks"), 0)
        GLES20.glUniform1i(GLES20.glGetUniformLocation(programId, "uNumControlPoints"), 0)
        GLES20.glUniform1i(GLES20.glGetUniformLocation(programId, "uDoubleExposureEnabled"), 0)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uBokehStrength"), 0f)
        GLES20.glUniform1f(GLES20.glGetUniformLocation(programId, "uLongExposureAmount"), 0f)
        GLES20.glUniform2f(GLES20.glGetUniformLocation(programId, "uTexelSize"), 1f / width, 1f / height)
    }

    private fun startCameraThread() {
        cameraThread = HandlerThread("CameraBackground").apply { start() }
        cameraHandler = Handler(cameraThread!!.looper)
    }

    private fun stopCameraThread() {
        cameraThread?.quitSafely()
        try {
            cameraThread?.join()
            cameraThread = null
            cameraHandler = null
        } catch (e: InterruptedException) {
            e.printStackTrace()
        }
    }

    private fun openActiveCamera() {
        val currentHandler = cameraHandler ?: return
        currentHandler.post {
            try {
                // Parse composite Camera ID: e.g. "0:2" means logical ID 0 and physical ID 2
                val parts = activeCameraId.split(":")
                val logicalId = parts[0]
                
                // Expose focal length values back to JS UI
                emitCameraInfoEvent(activeCameraId)

                // Close active camera if already open
                closeCamera()

                cameraManager.openCamera(logicalId, object : CameraDevice.StateCallback() {
                    override fun onOpened(camera: CameraDevice) {
                        Log.i(TAG, "Camera device onOpened")
                        cameraDevice = camera
                        startCaptureSession()
                    }

                    override fun onDisconnected(camera: CameraDevice) {
                        Log.w(TAG, "Camera device onDisconnected")
                        closeCamera()
                    }

                    override fun onError(camera: CameraDevice, error: Int) {
                        Log.e(TAG, "Camera device error: $error")
                        closeCamera()
                    }
                }, currentHandler)
            } catch (e: SecurityException) {
                Log.e(TAG, "Permissions error opening camera: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to open camera: ${e.message}")
            }
        }
    }

    private fun startCaptureSession() {
        val device = cameraDevice ?: return
        val currentHandler = cameraHandler ?: return

        try {
            // Setup preview surface (reuse the one created in onSurfaceCreated)
            synchronized(this) {
                if (surfaceTexture == null) {
                    surfaceTexture = SurfaceTexture(cameraTextureId).apply {
                        setOnFrameAvailableListener(this@CameraPreviewView)
                    }
                    surfaceTexture!!.setDefaultBufferSize(1920, 1080)
                    previewSurface = Surface(surfaceTexture)
                }
            }

            var captureWidth = 4000
            var captureHeight = 3000
            
            try {
                val parts = activeCameraId.split(":")
                val logicalId = parts[0]
                val chars = cameraManager.getCameraCharacteristics(logicalId)
                
                var jpegSizes: Array<android.util.Size>? = null
                if (highMpMode && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    val maxResMap = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP_MAXIMUM_RESOLUTION)
                    jpegSizes = maxResMap?.getOutputSizes(android.graphics.ImageFormat.JPEG)
                }
                
                if (jpegSizes == null || jpegSizes.isEmpty()) {
                    val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                    jpegSizes = map?.getOutputSizes(android.graphics.ImageFormat.JPEG)
                }
                
                if (jpegSizes != null && jpegSizes.isNotEmpty()) {
                    val sortedSizes = jpegSizes.sortedByDescending { it.width * it.height }
                    if (highMpMode) {
                        captureWidth = sortedSizes.first().width
                        captureHeight = sortedSizes.first().height
                        Log.d(TAG, "Selected High Megapixel capture resolution: ${captureWidth}x${captureHeight}")
                    } else {
                        val targetPixels = 12_000_000
                        val normalSize = sortedSizes.minByOrNull { Math.abs(it.width.toLong() * it.height - targetPixels) }
                        if (normalSize != null) {
                            captureWidth = normalSize.width
                            captureHeight = normalSize.height
                        } else {
                            captureWidth = sortedSizes.last().width
                            captureHeight = sortedSizes.last().height
                        }
                        Log.d(TAG, "Selected Normal capture resolution: ${captureWidth}x${captureHeight}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to query camera output sizes, using default size 4000x3000: ${e.message}")
            }

            // Setup high-res image reader for capturing pictures
            imageReader = ImageReader.newInstance(captureWidth, captureHeight, android.graphics.ImageFormat.JPEG, 2)
            imageReader!!.setOnImageAvailableListener(object : ImageReader.OnImageAvailableListener {
                override fun onImageAvailable(reader: ImageReader?) {
                    val img = reader?.acquireNextImage() ?: return
                    val buffer = img.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    img.close()

                    // Apply filters in background GL thread and save
                    applyFiltersAndSavePhoto(bytes)
                }
            }, currentHandler)

            // Setup preview request builder
            previewRequestBuilder = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
            
            val outputs = mutableListOf<OutputConfiguration>()
            val parts = activeCameraId.split(":")
            
            if (parts.size > 1 && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                // Route output through physical camera ID
                val physicalId = parts[1]
                val previewConfig = OutputConfiguration(previewSurface!!).apply {
                    setPhysicalCameraId(physicalId)
                }
                val photoConfig = OutputConfiguration(imageReader!!.surface).apply {
                    setPhysicalCameraId(physicalId)
                }
                outputs.add(previewConfig)
                outputs.add(photoConfig)
                
                previewRequestBuilder!!.addTarget(previewSurface!!)
            } else {
                outputs.add(OutputConfiguration(previewSurface!!))
                outputs.add(OutputConfiguration(imageReader!!.surface))
                previewRequestBuilder!!.addTarget(previewSurface!!)
            }

            // Create Capture Session using SessionConfiguration (API 28+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                val executor = Executor { command -> currentHandler.post(command) }
                val sessionConfig = SessionConfiguration(
                    SessionConfiguration.SESSION_REGULAR,
                    outputs,
                    executor,
                    object : CameraCaptureSession.StateCallback() {
                        override fun onConfigured(session: CameraCaptureSession) {
                            captureSession = session
                            applyCameraControls()
                            startRepeatingRequest()
                        }

                        override fun onConfigureFailed(session: CameraCaptureSession) {
                            Log.e(TAG, "Session configuration failed")
                            val parts = activeCameraId.split(":")
                            if (parts.size > 1) {
                                Log.w(TAG, "Retrying with logical camera ID fallback: ${parts[0]}")
                                cameraHandler?.post {
                                    activeCameraId = parts[0]
                                    closeCamera()
                                    openActiveCamera()
                                }
                            }
                        }
                    }
                )
                device.createCaptureSession(sessionConfig)
            } else {
                @Suppress("DEPRECATION")
                val surfaces = listOf(previewSurface!!, imageReader!!.surface)
                device.createCaptureSession(surfaces, object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        captureSession = session
                        applyCameraControls()
                        startRepeatingRequest()
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        Log.e(TAG, "Legacy Session configuration failed")
                        val parts = activeCameraId.split(":")
                        if (parts.size > 1) {
                            Log.w(TAG, "Retrying legacy with logical camera ID fallback: ${parts[0]}")
                            cameraHandler?.post {
                                activeCameraId = parts[0]
                                closeCamera()
                                openActiveCamera()
                            }
                        }
                    }
                }, currentHandler)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start capture session: ${e.message}")
        }
    }

    private fun startRepeatingRequest() {
        val session = captureSession ?: return
        val builder = previewRequestBuilder ?: return
        val currentHandler = cameraHandler ?: return

        try {
            session.setRepeatingRequest(builder.build(), null, currentHandler)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start repeating preview request: ${e.message}")
        }
    }

    private fun closeCamera() {
        try {
            captureSession?.stopRepeating()
            captureSession?.close()
            captureSession = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping capture session: ${e.message}")
        }
        cameraDevice?.close()
        cameraDevice = null
        
        imageReader?.close()
        imageReader = null
    }

    private fun applyCameraControls() {
        val builder = previewRequestBuilder ?: return

        try {
            applyProcessingControls(builder)

            // Set SENSOR_PIXEL_MODE for high MP mode
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val pixelMode = if (highMpMode) {
                    CameraMetadata.SENSOR_PIXEL_MODE_MAXIMUM_RESOLUTION
                } else {
                    CameraMetadata.SENSOR_PIXEL_MODE_DEFAULT
                }
                builder.set(CaptureRequest.SENSOR_PIXEL_MODE, pixelMode)
            }

            // 1. Manual ISO & Exposure Shutter Speed
            if (isoValue > 0 && shutterSpeedMs > 0) {
                builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
                builder.set(CaptureRequest.SENSOR_SENSITIVITY, isoValue)
                // Convert microseconds to nanoseconds
                builder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, shutterSpeedMs * 1000L)
            } else {
                builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
            }

            // 2. White Balance
            when (whiteBalanceMode.lowercase()) {
                "daylight" -> {
                    builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_DAYLIGHT)
                }
                "cloudy" -> {
                    builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_CLOUDY_DAYLIGHT)
                }
                "incandescent" -> {
                    builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_INCANDESCENT)
                }
                "fluorescent" -> {
                    builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_FLUORESCENT)
                }
                else -> {
                    builder.set(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_AUTO)
                }
            }

            // 3. Metering Modes (via AE regions)
            when (meteringMode.lowercase()) {
                "spot" -> {
                    val rect = MeteringRectangle(900, 1400, 200, 200, MeteringRectangle.METERING_WEIGHT_MAX)
                    builder.set(CaptureRequest.CONTROL_AE_REGIONS, arrayOf(rect))
                }
                "center" -> {
                    val rect = MeteringRectangle(600, 1100, 800, 800, MeteringRectangle.METERING_WEIGHT_MAX)
                    builder.set(CaptureRequest.CONTROL_AE_REGIONS, arrayOf(rect))
                }
                else -> { // matrix
                    builder.set(CaptureRequest.CONTROL_AE_REGIONS, null)
                }
            }

            // 4. Focus Modes & Manual Focus
            if (focusMode.lowercase() == "manual") {
                builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)
                builder.set(CaptureRequest.LENS_FOCUS_DISTANCE, focusDistance)
            } else {
                builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
            }

            // 5. Flash mode
            when (flashMode.lowercase()) {
                "torch" -> {
                    builder.set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_TORCH)
                }
                "on" -> {
                    builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON_ALWAYS_FLASH)
                }
                else -> {
                    builder.set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_OFF)
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error applying camera controls parameters: ${e.message}")
        }
    }

    fun release() {
        closeCamera()
        stopCameraThread()
        mediaRecorder?.release()
        mediaRecorder = null
        
        synchronized(this) {
            surfaceTexture?.release()
            surfaceTexture = null
            previewSurface?.release()
            previewSurface = null
        }

        if (cameraTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(cameraTextureId), 0)
        }
        if (lutTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(lutTextureId), 0)
        }
        if (curvesTextureId != -1) {
            GLES20.glDeleteTextures(1, intArrayOf(curvesTextureId), 0)
        }
    }

    // Setters called from Manager
    fun setActiveCameraId(id: String) {
        if (id != this.activeCameraId) {
            this.activeCameraId = id
            openActiveCamera()
        }
    }

    fun setIso(value: Int) {
        this.isoValue = value
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    fun setShutterSpeed(value: Int) {
        this.shutterSpeedMs = value.toLong()
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    fun setWhiteBalanceMode(value: String) {
        this.whiteBalanceMode = value
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    fun setMeteringMode(value: String) {
        this.meteringMode = value
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    fun setFocusMode(value: String) {
        this.focusMode = value
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    fun setFocusDistance(value: Float) {
        this.focusDistance = value
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    fun setFlashMode(value: String) {
        this.flashMode = value
        cameraHandler?.post {
            applyCameraControls()
            startRepeatingRequest()
        }
    }

    // Filters and Grading setters (identical layout mapping to Player view)
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
            else -> 0
        }
        requestRender()
    }

    fun setExposure(value: Float) { this.exposure = value; requestRender() }
    fun setContrast(value: Float) { this.contrast = value; requestRender() }
    fun setSaturation(value: Float) { this.saturation = value; requestRender() }
    fun setGamma(value: Float) { this.gamma = value; requestRender() }
    fun setBrightness(value: Float) { this.brightness = value; requestRender() }

    fun setTemperature(value: Float) { this.temperature = value; requestRender() }
    fun setTint(value: Float) { this.tint = value; requestRender() }
    fun setHighlights(value: Float) { this.highlights = value; requestRender() }
    fun setShadows(value: Float) { this.shadows = value; requestRender() }
    fun setToneContrast(value: Float) { this.toneContrast = value; requestRender() }
    fun setVibrance(value: Float) { this.vibrance = value; requestRender() }
    fun setHueRotation(value: Float) { this.hueRotation = value; requestRender() }

    fun setColorWheels(array: ReadableArray?) {
        if (array == null || array.size() < 9) return
        synchronized(this) {
            for (i in 0 until 9) {
                colorWheelsData[i] = array.getDouble(i).toFloat()
            }
        }
        requestRender()
    }

    fun setHslAdjustments(array: ReadableArray?) {
        if (array == null || array.size() < 24) return
        synchronized(this) {
            for (i in 0 until 24) {
                hslAdjustments[i] = array.getDouble(i).toFloat()
            }
        }
        requestRender()
    }

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

    fun setLutSize(value: Float) { this.lutSize = value; requestRender() }
    fun setLutIntensity(value: Float) { this.lutIntensity = value; requestRender() }

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

    fun setDehaze(value: Float) { this.dehaze = value; requestRender() }
    fun setHdrStrength(value: Float) { this.hdrStrength = value; requestRender() }
    fun setSharpen(value: Float) { this.sharpen = value; requestRender() }
    fun setDefinition(value: Float) { this.definition = value; requestRender() }
    fun setSoftness(value: Float) { this.softness = value; requestRender() }
    fun setDenoiseLuminance(value: Float) { this.denoiseLuminance = value; requestRender() }
    fun setDenoiseColor(value: Float) { this.denoiseColor = value; requestRender() }
    fun setGrainAmount(value: Float) { this.grainAmount = value; requestRender() }
    fun setGrainSize(value: Float) { this.grainSize = value; requestRender() }
    fun setGrainRoughness(value: Float) { this.grainRoughness = value; requestRender() }

    // Take Picture command handler
    fun capturePhoto(promise: Promise) {
        val session = captureSession
        if (session == null) {
            promise.reject("PHOTO_ERROR", "Camera session is not active")
            return
        }

        val builder = previewRequestBuilder ?: return
        val currentHandler = cameraHandler ?: return
        
        this.photoPromise = promise

        try {
            // Trigger still capture request targeting the ImageReader surface
            val captureBuilder = cameraDevice!!.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
            captureBuilder.addTarget(imageReader!!.surface)

            applyProcessingControls(captureBuilder)

            // Set SENSOR_PIXEL_MODE for high MP mode
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val pixelMode = if (highMpMode) {
                    CameraMetadata.SENSOR_PIXEL_MODE_MAXIMUM_RESOLUTION
                } else {
                    CameraMetadata.SENSOR_PIXEL_MODE_DEFAULT
                }
                captureBuilder.set(CaptureRequest.SENSOR_PIXEL_MODE, pixelMode)
            }

            // Keep same exposure/manual focus parameters for still capture
            captureBuilder.set(CaptureRequest.CONTROL_AE_MODE, builder.get(CaptureRequest.CONTROL_AE_MODE))
            captureBuilder.set(CaptureRequest.SENSOR_SENSITIVITY, builder.get(CaptureRequest.SENSOR_SENSITIVITY))
            captureBuilder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, builder.get(CaptureRequest.SENSOR_EXPOSURE_TIME))
            captureBuilder.set(CaptureRequest.CONTROL_AWB_MODE, builder.get(CaptureRequest.CONTROL_AWB_MODE))
            captureBuilder.set(CaptureRequest.CONTROL_AF_MODE, builder.get(CaptureRequest.CONTROL_AF_MODE))
            captureBuilder.set(CaptureRequest.LENS_FOCUS_DISTANCE, builder.get(CaptureRequest.LENS_FOCUS_DISTANCE))
            captureBuilder.set(CaptureRequest.FLASH_MODE, builder.get(CaptureRequest.FLASH_MODE))

            // Stop preview repeating temporarily to avoid frame stutter
            session.stopRepeating()
            session.capture(captureBuilder.build(), object : CameraCaptureSession.CaptureCallback() {
                override fun onCaptureCompleted(session: CameraCaptureSession, request: CaptureRequest, result: TotalCaptureResult) {
                    startRepeatingRequest()
                }
            }, currentHandler)

        } catch (e: Exception) {
            Log.e(TAG, "Capture photo call failed: ${e.message}")
            promise.reject("PHOTO_ERROR", "Capture failed: ${e.message}", e)
        }
    }

    private fun applyFiltersAndSavePhoto(rawJpegBytes: ByteArray) {
        val promise = photoPromise ?: return
        photoPromise = null

        queueEvent {
            try {
                // Decode original captured JPEG
                val bitmap = BitmapFactory.decodeByteArray(rawJpegBytes, 0, rawJpegBytes.size)
                if (bitmap == null) {
                    promise.reject("PHOTO_ERROR", "Failed to decode captured camera JPEG bytes")
                    return@queueEvent
                }

                val bWidth = bitmap.width
                val bHeight = bitmap.height

                // Setup offscreen FBO and Texture to render offline with custom filters
                val fb = IntArray(1)
                val tex = IntArray(1)
                val destTex = IntArray(1)

                GLES20.glGenFramebuffers(1, fb, 0)
                GLES20.glGenTextures(1, tex, 0)
                GLES20.glGenTextures(1, destTex, 0)

                // Upload original image texture
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex[0])
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
                GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
                bitmap.recycle()

                // Setup destination texture
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, destTex[0])
                GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, bWidth, bHeight, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)

                // Setup FBO
                GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fb[0])
                GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, destTex[0], 0)

                val fboStatus = GLES20.glCheckFramebufferStatus(GLES20.GL_FRAMEBUFFER)
                if (fboStatus != GLES20.GL_FRAMEBUFFER_COMPLETE) {
                    GLES20.glDeleteFramebuffers(1, fb, 0)
                    GLES20.glDeleteTextures(1, tex, 0)
                    GLES20.glDeleteTextures(1, destTex, 0)
                    promise.reject("PHOTO_ERROR", "Framebuffer incomplete: $fboStatus")
                    return@queueEvent
                }

                // 2. Render image with 2D texture shader configuration
                GLES20.glViewport(0, 0, bWidth, bHeight)
                
                // Set matrix properties identity
                val localMvp = FloatArray(16)
                val localSt = FloatArray(16)
                Matrix.setIdentityM(localMvp, 0)
                Matrix.setIdentityM(localSt, 0)
                // Correct orientation
                Matrix.scaleM(localMvp, 0, 1f, -1f, 1f)

                // We reuse the program compiled, but we need standard sampler2D shader
                // In our current project setup, compileShaders links with OES samplerExternalOES.
                // We should compile a separate 2D shader program specifically for static photo baking.
                val imageVertex = loadShader(GLES20.GL_VERTEX_SHADER, ColorGradingShader.IMAGE_VERTEX_SHADER)
                val imageFragment = loadShader(GLES20.GL_FRAGMENT_SHADER, ColorGradingShader.getFragmentShader(isImage = true))
                val imageProgram = GLES20.glCreateProgram()
                GLES20.glAttachShader(imageProgram, imageVertex)
                GLES20.glAttachShader(imageProgram, imageFragment)
                GLES20.glLinkProgram(imageProgram)

                GLES20.glUseProgram(imageProgram)

                // Bind attributes
                val posH = GLES20.glGetAttribLocation(imageProgram, "aPosition")
                GLES20.glEnableVertexAttribArray(posH)
                verticesBuffer.position(0)
                GLES20.glVertexAttribPointer(posH, 3, GLES20.GL_FLOAT, false, 20, verticesBuffer)

                val coordH = GLES20.glGetAttribLocation(imageProgram, "aTextureCoord")
                GLES20.glEnableVertexAttribArray(coordH)
                verticesBuffer.position(3)
                GLES20.glVertexAttribPointer(coordH, 2, GLES20.GL_FLOAT, false, 20, verticesBuffer)

                GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(imageProgram, "uMVPMatrix"), 1, false, localMvp, 0)
                GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(imageProgram, "uSTMatrix"), 1, false, localSt, 0)

                // Bind texture0 (original image)
                GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex[0])
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "sTexture"), 0)
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "sDoubleExposureTexture"), 3)
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "sBrushMaskTexture"), 4)

                // Bind 3D LUT
                if (lutTextureId != -1) {
                    GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
                    GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "sLutTexture"), 1)
                    GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uLutSize"), lutSize)
                    GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uLutIntensity"), lutIntensity)
                }

                // Bind curves lookup
                if (curvesTextureId != -1) {
                    GLES20.glActiveTexture(GLES20.GL_TEXTURE2)
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
                    GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "uCurvesTexture"), 2)
                }

                // Uniforms binding
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uExposure"), exposure)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uContrast"), contrast)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uSaturation"), saturation)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uGamma"), gamma)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uBrightness"), brightness)
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "uLogFormat"), logFormat)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uTemperature"), temperature)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uTint"), tint)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uHighlights"), highlights)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uShadows"), shadows)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uToneContrast"), toneContrast)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uVibrance"), vibrance)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uHueRotation"), hueRotation)
                GLES20.glUniform3f(GLES20.glGetUniformLocation(imageProgram, "uShadowsColor"), colorWheelsData[0], colorWheelsData[1], colorWheelsData[2])
                GLES20.glUniform3f(GLES20.glGetUniformLocation(imageProgram, "uMidtonesColor"), colorWheelsData[3], colorWheelsData[4], colorWheelsData[5])
                GLES20.glUniform3f(GLES20.glGetUniformLocation(imageProgram, "uHighlightsColor"), colorWheelsData[6], colorWheelsData[7], colorWheelsData[8])
                GLES20.glUniform1fv(GLES20.glGetUniformLocation(imageProgram, "uHslAdjustments"), 24, hslAdjustments, 0)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uVignetteStrength"), vignetteStrength)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uVignetteRadius"), vignetteRadius)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uVignetteSoftness"), vignetteSoftness)
                GLES20.glUniform2f(GLES20.glGetUniformLocation(imageProgram, "uVignetteCenter"), vignetteCenterX, vignetteCenterY)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uDehaze"), dehaze)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uHdrStrength"), hdrStrength)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uSharpen"), sharpen)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uDefinition"), definition)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uSoftness"), softness)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uDenoiseLuminance"), denoiseLuminance)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uDenoiseColor"), denoiseColor)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uGrainAmount"), grainAmount)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uGrainSize"), grainSize)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uGrainRoughness"), grainRoughness)
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "uNumMasks"), 0)
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "uNumControlPoints"), 0)
                GLES20.glUniform1i(GLES20.glGetUniformLocation(imageProgram, "uDoubleExposureEnabled"), 0)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uBokehStrength"), 0f)
                GLES20.glUniform1f(GLES20.glGetUniformLocation(imageProgram, "uLongExposureAmount"), 0f)
                GLES20.glUniform2f(GLES20.glGetUniformLocation(imageProgram, "uTexelSize"), 1f / bWidth, 1f / bHeight)

                // Draw frame
                GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

                // Read pixels back
                val readBuf = ByteBuffer.allocateDirect(bWidth * bHeight * 4).order(ByteOrder.nativeOrder())
                GLES20.glReadPixels(0, 0, bWidth, bHeight, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, readBuf)

                // Recycle resources
                GLES20.glDisableVertexAttribArray(posH)
                GLES20.glDisableVertexAttribArray(coordH)
                GLES20.glDeleteProgram(imageProgram)
                GLES20.glDeleteFramebuffers(1, fb, 0)
                GLES20.glDeleteTextures(1, tex, 0)
                GLES20.glDeleteTextures(1, destTex, 0)
                GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)

                // Restore camera preview viewport
                GLES20.glViewport(0, 0, width, height)

                // Save pixel buffer to file
                val outBitmap = Bitmap.createBitmap(bWidth, bHeight, Bitmap.Config.ARGB_8888)
                readBuf.position(0)
                outBitmap.copyPixelsFromBuffer(readBuf)
                
                // Flip bitmap vertically because GL readpixels is bottom-to-top
                val matrix = android.graphics.Matrix().apply { preScale(1f, -1f) }
                val flippedBitmap = Bitmap.createBitmap(outBitmap, 0, 0, bWidth, bHeight, matrix, true)
                outBitmap.recycle()

                // Add professional watermark display details bar at the bottom if requested
                // Format: L U T   L A B  |  24mm  |  ISO 100  |  1/125s  |  @You
                val finalBitmap = drawArtisticWatermark(flippedBitmap)

                // Save to downloads directory
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val filename = "LUT_LAB_IMG_${System.currentTimeMillis()}.jpg"
                val photoFile = File(downloadsDir, filename)

                FileOutputStream(photoFile).use { fos ->
                    finalBitmap.compress(Bitmap.CompressFormat.JPEG, 97, fos)
                }
                finalBitmap.recycle()

                Log.d(TAG, "Filtered Photo successfully saved: ${photoFile.absolutePath}")
                promise.resolve(photoFile.absolutePath)

            } catch (e: Exception) {
                Log.e(TAG, "Offline filter application failed: ${e.message}")
                promise.reject("PHOTO_ERROR", "Failed to save photo: ${e.message}", e)
            }
        }
    }

    private fun drawArtisticWatermark(src: Bitmap): Bitmap {
        try {
            val w = src.width
            val h = src.height
            val bannerHeight = (h * 0.05).toInt() // 5% height banner
            val combined = Bitmap.createBitmap(w, h + bannerHeight, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(combined)
            
            // Draw original picture
            canvas.drawBitmap(src, 0f, 0f, null)
            src.recycle()

            // Draw dark background banner
            val paint = android.graphics.Paint().apply {
                color = android.graphics.Color.parseColor("#09090B") // Slate obsidian tone
                style = android.graphics.Paint.Style.FILL
            }
            canvas.drawRect(0f, h.toFloat(), w.toFloat(), (h + bannerHeight).toFloat(), paint)

            // Draw text details
            val textPaint = android.graphics.Paint().apply {
                color = android.graphics.Color.WHITE
                textSize = bannerHeight * 0.35f
                isAntiAlias = true
                textAlign = android.graphics.Paint.Align.LEFT
                typeface = android.graphics.Typeface.create("serif", android.graphics.Typeface.NORMAL)
            }

            // Estimate lens details
            val mm = getArtisticFocalLengthText()
            val isoText = if (isoValue > 0) "ISO $isoValue" else "ISO AUTO"
            val ssText = if (shutterSpeedMs > 0) "1/${(1_000_000L / shutterSpeedMs)}s" else "AUTO SHUTTER"
            
            val infoString = "LUT LAB  |  $mm  |  $isoText  |  $ssText"
            
            // Draw info left
            val xPos = w * 0.05f
            val yPos = h + bannerHeight * 0.62f
            canvas.drawText(infoString, xPos, yPos, textPaint)

            // Draw right logo watermark
            textPaint.textAlign = android.graphics.Paint.Align.RIGHT
            val logoString = "SHOT WITH LUT LAB ART"
            canvas.drawText(logoString, w * 0.95f, yPos, textPaint)

            return combined
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply watermark banner: ${e.message}")
            return src
        }
    }

    private fun getArtisticFocalLengthText(): String {
        return try {
            val parts = activeCameraId.split(":")
            val logicalId = parts[0]
            val chars = cameraManager.getCameraCharacteristics(logicalId)
            val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
            val sensorSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
            
            var eq = 24
            if (focalLengths != null && focalLengths.isNotEmpty() && sensorSize != null) {
                val f = focalLengths[0]
                val diag = Math.sqrt((sensorSize.width * sensorSize.width + sensorSize.height * sensorSize.height).toDouble())
                if (diag > 0.0) {
                    eq = (f * 43.27 / diag).toInt()
                }
            }
            "${eq}mm"
        } catch (e: Exception) {
            "24mm"
        }
    }

    // Toggle video recording
    fun setRecordingActive(active: Boolean, promise: Promise) {
        val currentHandler = cameraHandler ?: return
        currentHandler.post {
            if (active) {
                startRecordingSession(promise)
            } else {
                stopRecordingSession(promise)
            }
        }
    }

    private fun startRecordingSession(promise: Promise) {
        if (isRecording) {
            promise.reject("RECORD_ERROR", "Recording is already active")
            return
        }

        try {
            // Setup target output file
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val filename = "LUT_LAB_VID_${System.currentTimeMillis()}.mp4"
            val file = File(downloadsDir, filename)
            currentVideoPath = file.absolutePath

            // Configure MediaRecorder
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setOutputFile(currentVideoPath)
                setVideoSize(recorderWidth, recorderHeight)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setVideoEncodingBitRate(18_000_000) // 18 Mbps high quality
                setVideoFrameRate(30)
                prepare()
            }

            // Create EGL window surface targeting MediaRecorder surface
            val recorderSurface = mediaRecorder!!.surface
            val surfaceAttribs = intArrayOf(EGL14.EGL_NONE)
            
            // Re-bind GL context to get Display and Config
            eglEncoderSurface = EGL14.eglCreateWindowSurface(eglDisplay, eglConfig, recorderSurface, surfaceAttribs, 0)
            if (eglEncoderSurface == EGL14.EGL_NO_SURFACE) {
                promise.reject("RECORD_ERROR", "Failed to create EGL encoder window surface")
                return
            }

            // Begin recording
            mediaRecorder!!.start()
            this.videoPromise = promise
            this.isRecording = true
            Log.d(TAG, "Video recording started. Target: $currentVideoPath")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start MediaRecorder: ${e.message}")
            promise.reject("RECORD_ERROR", "Failed to start recorder: ${e.message}", e)
        }
    }

    private fun stopRecordingSession(promise: Promise) {
        if (!isRecording) {
            promise.reject("RECORD_ERROR", "No active recording found")
            return
        }

        try {
            isRecording = false
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null

            // Delete EGL surface
            if (eglEncoderSurface != EGL14.EGL_NO_SURFACE) {
                EGL14.eglDestroySurface(eglDisplay, eglEncoderSurface)
                eglEncoderSurface = EGL14.EGL_NO_SURFACE
            }

            Log.d(TAG, "Video recording stopped. Saved: $currentVideoPath")
            promise.resolve(currentVideoPath)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop recording: ${e.message}")
            // Sometimes stop fails if recording is too short, return path anyway or reject
            promise.resolve(currentVideoPath)
        }
    }

    private fun getAndroidEglConfig(display: android.opengl.EGLDisplay): android.opengl.EGLConfig? {
        val attribList = intArrayOf(
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGLExt.EGL_RECORDABLE_ANDROID, 1,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<android.opengl.EGLConfig>(1)
        val numConfigs = IntArray(1)
        EGL14.eglChooseConfig(display, attribList, 0, configs, 0, configs.size, numConfigs, 0)
        return configs[0]
    }

    private fun emitCameraInfoEvent(camId: String) {
        try {
            val reactContext = context as? com.facebook.react.bridge.ReactContext ?: return
            val eventData = Arguments.createMap().apply {
                putString("cameraId", camId)
                putString("focalLengthText", getArtisticFocalLengthText())
            }
            reactContext
                .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onCameraInfo", eventData)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit camera info: ${e.message}")
        }
    }

    private fun applyProcessingControls(builder: CaptureRequest.Builder) {
        val mode = if (unprocessed) CaptureRequest.NOISE_REDUCTION_MODE_OFF else CaptureRequest.NOISE_REDUCTION_MODE_FAST
        val edge = if (unprocessed) CaptureRequest.EDGE_MODE_OFF else CaptureRequest.EDGE_MODE_FAST
        val hotpixel = if (unprocessed) CaptureRequest.HOT_PIXEL_MODE_OFF else CaptureRequest.HOT_PIXEL_MODE_FAST
        
        try { builder.set(CaptureRequest.NOISE_REDUCTION_MODE, mode) } catch (e: Exception) {}
        try { builder.set(CaptureRequest.EDGE_MODE, edge) } catch (e: Exception) {}
        try { builder.set(CaptureRequest.HOT_PIXEL_MODE, hotpixel) } catch (e: Exception) {}
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            val aberration = if (unprocessed) CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE_OFF else CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE_FAST
            val shading = if (unprocessed) CaptureRequest.SHADING_MODE_OFF else CaptureRequest.SHADING_MODE_FAST
            try { builder.set(CaptureRequest.COLOR_CORRECTION_ABERRATION_MODE, aberration) } catch (e: Exception) {}
            try { builder.set(CaptureRequest.SHADING_MODE, shading) } catch (e: Exception) {}
        }
        
        try {
            val tonemap = if (unprocessed) CaptureRequest.TONEMAP_MODE_CONTRAST_CURVE else CaptureRequest.TONEMAP_MODE_FAST
            builder.set(CaptureRequest.TONEMAP_MODE, tonemap)
        } catch (e: Exception) {}

        try {
            builder.set(CaptureRequest.CONTROL_EFFECT_MODE, CaptureRequest.CONTROL_EFFECT_MODE_OFF)
        } catch (e: Exception) {}

        try {
            builder.set(CaptureRequest.CONTROL_SCENE_MODE, CaptureRequest.CONTROL_SCENE_MODE_DISABLED)
        } catch (e: Exception) {}
    }

    fun setHighMpMode(enabled: Boolean) {
        if (enabled != this.highMpMode) {
            this.highMpMode = enabled
            cameraHandler?.post {
                closeCamera()
                openActiveCamera()
            }
        }
    }

    fun setUnprocessed(value: Boolean) {
        if (value != this.unprocessed) {
            this.unprocessed = value
            cameraHandler?.post {
                applyCameraControls()
                startRepeatingRequest()
            }
        }
    }
}
