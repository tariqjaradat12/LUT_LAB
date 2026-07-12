package com.myandroidapp.video

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.SurfaceTexture
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.media.MediaMuxer
import android.media.MediaScannerConnection
import android.net.Uri
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.Matrix
import android.os.Environment
import android.util.Log
import android.view.Surface
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

class VideoTranscoder(private val context: Context) {
    private val TAG = "VideoTranscoder"

    private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE
    
    private var programId = -1
    private var handles: TranscodeProgramHandles? = null

    private var watermarkProgramId = -1
    private var wmPositionHandle = -1
    private var wmTextureCoordHandle = -1
    private var wmTextureHandle = -1

    private var curvesTextureId = -1
    private var doubleExposureTextureId = -1
    private var brushMaskTextureId = -1
    private var lutTextureId = -1

    // Rendering quad geometry
    private val triangleVerticesData = floatArrayOf(
        // X, Y, Z, U, V
        -1.0f, -1.0f, 0f, 0f, 0f,
         1.0f, -1.0f, 0f, 1f, 0f,
        -1.0f,  1.0f, 0f, 0f, 1f,
         1.0f,  1.0f, 0f, 1f, 1f
    )
    private val verticesBuffer: FloatBuffer

    init {
        verticesBuffer = ByteBuffer.allocateDirect(triangleVerticesData.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
            .put(triangleVerticesData)
        verticesBuffer.position(0)
    }

    fun transcode(sourcePath: String, params: GradingParams, watermarkEnabled: Boolean, watermarkDeviceName: String, watermarkBorderColor: String, isFreeUser: Boolean): String {
        Log.d(TAG, "Starting transcode for: $sourcePath")
        var watermarkTextureId = -1

        // 1. Retrieve video metadata
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, Uri.parse(sourcePath))
        } catch (e: Exception) {
            retriever.setDataSource(sourcePath)
        }
        val widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
        val heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
        val rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
        retriever.release()

        val width = widthStr?.toIntOrNull() ?: 1920
        val height = heightStr?.toIntOrNull() ?: 1080
        val rotation = rotationStr?.toIntOrNull() ?: 0

        Log.d(TAG, "Source video metadata: ${width}x${height}, Rotation=$rotation")

        val cropW = params.cropWidth
        val cropH = params.cropHeight
        val croppedW = (width * cropW).toInt().coerceAtLeast(64)
        val croppedH = (height * cropH).toInt().coerceAtLeast(64)

        var finalExportWidth = croppedW
        var finalExportHeight = croppedH

        var borderLeft = 0
        var borderTop = 0
        var borderRight = 0
        var borderBottom = 0

        if (watermarkBorderColor == "white" || watermarkBorderColor == "black") {
            val borderSize = (croppedW.coerceAtLeast(croppedH) * 0.05f).toInt().coerceAtLeast(16)
            borderLeft = borderSize
            borderTop = borderSize
            borderRight = borderSize
            borderBottom = if (watermarkEnabled) (croppedH * 0.15f).toInt().coerceAtLeast(borderSize * 2) else borderSize

            finalExportWidth = croppedW + borderLeft + borderRight
            finalExportHeight = croppedH + borderTop + borderBottom
        }

        // Align to multiples of 4 for video encoder
        finalExportWidth = (finalExportWidth / 4) * 4
        finalExportHeight = (finalExportHeight / 4) * 4

        val drawX = borderLeft
        val drawY = borderBottom
        val drawW = finalExportWidth - borderLeft - borderRight
        val drawH = finalExportHeight - borderTop - borderBottom

        // 2. Setup video extractor
        val videoExtractor = MediaExtractor()
        try {
            videoExtractor.setDataSource(context, Uri.parse(sourcePath), null)
        } catch (e: Exception) {
            videoExtractor.setDataSource(sourcePath)
        }
        
        val videoTrackIndex = selectVideoTrack(videoExtractor)
        if (videoTrackIndex < 0) {
            videoExtractor.release()
            throw RuntimeException("No video track found in source file")
        }
        videoExtractor.selectTrack(videoTrackIndex)
        val sourceFormat = videoExtractor.getTrackFormat(videoTrackIndex)

        // 3. Setup video encoder
        val mime = MediaFormat.MIMETYPE_VIDEO_AVC
        // Gallery apps are much less tolerant than MediaCodec.  Keep the output
        // constrained to the baseline AVC feature set (8-bit 4:2:0, no B-frames)
        // instead of leaving profile/rate-control entirely up to the device codec.
        // This is deliberately a portable delivery encode, not an editing master.
        val sourceFrameRate = sourceFormat.getInteger(MediaFormat.KEY_FRAME_RATE, 30)
            .coerceIn(24, 60)
        val encoderFormat = MediaFormat.createVideoFormat(mime, finalExportWidth, finalExportHeight).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, 18_000_000) // High-quality, gallery-friendly bitrate
            setInteger(MediaFormat.KEY_FRAME_RATE, sourceFrameRate)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
            setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR)
            setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline)
            setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.AVCLevel41)
        }

        val encoder = MediaCodec.createEncoderByType(mime)
        encoder.configure(encoderFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val encoderInputSurface = encoder.createInputSurface()
        encoder.start()

        // 4. Setup offscreen EGL context and window surface
        setupEgl(encoderInputSurface)

        // Compile color grading shaders in our background context
        setupShaders()
        uploadTextures(params)

        setupWatermarkShader()
        if (watermarkEnabled || isFreeUser) {
            try {
                val watermarkBitmap = android.graphics.Bitmap.createBitmap(finalExportWidth, finalExportHeight, android.graphics.Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(watermarkBitmap)
                watermarkBitmap.eraseColor(android.graphics.Color.TRANSPARENT)
                
                if (watermarkEnabled) {
                    val paint = android.graphics.Paint().apply {
                        color = if (watermarkBorderColor == "white") android.graphics.Color.BLACK else android.graphics.Color.WHITE
                        textSize = if (watermarkBorderColor == "white" || watermarkBorderColor == "black") {
                            (borderBottom * 0.25f).coerceAtLeast(20f)
                        } else {
                            (finalExportHeight * 0.022f).coerceAtLeast(24f)
                        }
                        isAntiAlias = true
                        style = android.graphics.Paint.Style.FILL
                        if (watermarkBorderColor == "none") {
                            setShadowLayer(4f, 2f, 2f, android.graphics.Color.BLACK)
                        } else {
                            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
                        }
                    }
                    
                    val text1 = "SHOT ON ${watermarkDeviceName}"
                    val expText = String.format("%.2f EV", params.exposure)
                    val contText = String.format("%d%%", Math.round(params.contrast * 100))
                    val tempText = String.format("%dK", Math.round(params.temperature))
                    val text2 = "EXP: $expText | CONT: $contText | TEMP: $tempText"
                    
                    if (watermarkBorderColor == "white" || watermarkBorderColor == "black") {
                        paint.textAlign = android.graphics.Paint.Align.CENTER
                        val x = finalExportWidth / 2f
                        val yCenter = (finalExportHeight - borderBottom) + (borderBottom * 0.45f)
                        val y1 = yCenter - (paint.textSize * 0.2f)
                        
                        canvas.drawText(text1.uppercase(), x, y1, paint)
                        paint.apply {
                            textSize = textSize * 0.75f
                            color = if (watermarkBorderColor == "white") android.graphics.Color.DKGRAY else android.graphics.Color.LTGRAY
                            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.NORMAL)
                        }
                        val y2 = yCenter + paint.textSize * 1.0f
                        canvas.drawText(text2, x, y2, paint)
                    } else {
                        val margin = (finalExportHeight * 0.04f).coerceAtLeast(30f)
                        val x = margin
                        val y2 = finalExportHeight - margin
                        val y1 = y2 - paint.textSize - 10f
                        
                        canvas.drawText(text1.uppercase(), x, y1, paint)
                        paint.textSize = paint.textSize * 0.75f
                        paint.color = android.graphics.Color.LTGRAY
                        canvas.drawText(text2, x, y2, paint)
                    }
                }
                
                if (isFreeUser) {
                    val sizeRef = Math.min(finalExportWidth, finalExportHeight)
                    val textSizeVal = (sizeRef * 0.035f).coerceAtLeast(22f).coerceAtMost(60f)
                    
                    val freeWatermarkPaint = android.graphics.Paint().apply {
                        color = android.graphics.Color.WHITE
                        textSize = textSizeVal
                        isAntiAlias = true
                        style = android.graphics.Paint.Style.FILL
                        typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
                        alpha = 180
                        setShadowLayer(4f, 2f, 2f, android.graphics.Color.argb(120, 0, 0, 0))
                    }
                    
                    val text = "LUT LAB"
                    val textWidth = freeWatermarkPaint.measureText(text)
                    val marginX = sizeRef * 0.04f
                    val marginY = sizeRef * 0.04f
                    
                    // Adjust for border width/height so watermark is always inside the actual picture area
                    val hasBorder = (watermarkBorderColor == "white" || watermarkBorderColor == "black")
                    val rBorder = if (hasBorder) (croppedW.coerceAtLeast(croppedH) * 0.05f).toInt().coerceAtLeast(16) else 0
                    val bBorder = if (hasBorder) {
                        if (watermarkEnabled) (croppedH * 0.15f).toInt().coerceAtLeast(rBorder * 2) else rBorder
                    } else 0
                    
                    val picEndX = finalExportWidth - rBorder
                    val picEndY = finalExportHeight - bBorder
                    
                    val textX = picEndX - textWidth - marginX
                    val textY = picEndY - marginY - freeWatermarkPaint.fontMetrics.descent
                    
                    canvas.drawText(text, textX, textY, freeWatermarkPaint)
                }
                
                val tex = IntArray(1)
                GLES20.glGenTextures(1, tex, 0)
                watermarkTextureId = tex[0]
                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, watermarkTextureId)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
                android.opengl.GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, watermarkBitmap, 0)
                
                watermarkBitmap.recycle()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create watermark texture: " + e.message)
            }
        }

        // 5. Setup video decoder with external output Surface
        val decoder = MediaCodec.createDecoderByType(sourceFormat.getString(MediaFormat.KEY_MIME)!!)
        
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        val decTexId = textures[0]
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, decTexId)
        GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_NEAREST.toFloat())
        GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR.toFloat())

        val frameSyncObject = Object()
        var frameAvailable = false

        val decSurfaceTexture = SurfaceTexture(decTexId).apply {
            setOnFrameAvailableListener {
                synchronized(frameSyncObject) {
                    frameAvailable = true
                    frameSyncObject.notifyAll()
                }
            }
        }
        val decSurface = Surface(decSurfaceTexture)
        decoder.configure(sourceFormat, decSurface, null, 0)
        decoder.start()

        // 6. Setup output file and muxer
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }
        val outputFile = File(downloadsDir, "Picture_Video_" + System.currentTimeMillis() + ".mp4")
        val muxer = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        muxer.setOrientationHint(rotation)

        // Find if there is an audio track in source
        var audioTrackIndex = -1
        for (i in 0 until videoExtractor.trackCount) {
            val f = videoExtractor.getTrackFormat(i)
            val m = f.getString(MediaFormat.KEY_MIME) ?: ""
            if (m.startsWith("audio/")) {
                audioTrackIndex = i
                break
            }
        }
        var audioFormat: MediaFormat? = null
        if (audioTrackIndex >= 0) {
            val candidateFormat = videoExtractor.getTrackFormat(audioTrackIndex)
            val candidateMime = candidateFormat.getString(MediaFormat.KEY_MIME)
            // Do not put an arbitrary source audio stream (for example Opus) in
            // an MP4.  Native gallery apps commonly flag that whole file as bad.
            if (candidateMime == MediaFormat.MIMETYPE_AUDIO_AAC) {
                audioFormat = candidateFormat
            } else {
                Log.w(TAG, "Skipping unsupported MP4 audio track: $candidateMime")
                audioTrackIndex = -1
            }
        }

        // 7. Transcode loop
        val bufferInfo = MediaCodec.BufferInfo()
        val stMatrix = FloatArray(16)
        var isExtractorEOS = false
        var isDecoderEOS = false
        var isEncoderEOS = false
        var muxerTrackIndex = -1
        var muxerAudioTrackIndex = -1
        var isMuxerStarted = false

        try {
            while (!isEncoderEOS) {
                // Feed Extractor to Decoder
                if (!isExtractorEOS) {
                    val inIdx = decoder.dequeueInputBuffer(10000)
                    if (inIdx >= 0) {
                        val buf = decoder.getInputBuffer(inIdx)!!
                        val sampleSize = videoExtractor.readSampleData(buf, 0)
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(inIdx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            isExtractorEOS = true
                        } else {
                            val sampleTime = videoExtractor.sampleTime
                            decoder.queueInputBuffer(inIdx, 0, sampleSize, sampleTime, 0)
                            videoExtractor.advance()
                        }
                    }
                }

                // Drain Decoder & Render frame to Encoder surface
                if (!isDecoderEOS) {
                    val outIdx = decoder.dequeueOutputBuffer(bufferInfo, 10000)
                    if (outIdx >= 0) {
                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            encoder.signalEndOfInputStream()
                            isDecoderEOS = true
                        }
                        
                        val doRender = bufferInfo.size > 0
                        decoder.releaseOutputBuffer(outIdx, doRender)
                        
                        if (doRender) {
                            // Wait for frame to update in texture
                            synchronized(frameSyncObject) {
                                while (!frameAvailable) {
                                    frameSyncObject.wait(250) // wait for up to 250ms
                                }
                                frameAvailable = false
                            }
                            
                            decSurfaceTexture.updateTexImage()
                            decSurfaceTexture.getTransformMatrix(stMatrix)
                            
                            // Bind EGL and render graded frame
                            EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)
                            
                            val clearColorVal = if (watermarkBorderColor == "white") 1f else 0f
                            GLES20.glClearColor(clearColorVal, clearColorVal, clearColorVal, 1f)
                            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
                            
                            GLES20.glViewport(drawX, drawY, drawW, drawH)
                            drawFrame(decTexId, stMatrix, params, drawW, drawH)
                            
                            if (watermarkTextureId != -1) {
                                GLES20.glViewport(0, 0, finalExportWidth, finalExportHeight)
                                GLES20.glUseProgram(watermarkProgramId)
                                GLES20.glEnable(GLES20.GL_BLEND)
                                GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
                                
                                verticesBuffer.position(0)
                                GLES20.glVertexAttribPointer(wmPositionHandle, 3, GLES20.GL_FLOAT, false, 20, verticesBuffer)
                                GLES20.glEnableVertexAttribArray(wmPositionHandle)
                                
                                verticesBuffer.position(3)
                                GLES20.glVertexAttribPointer(wmTextureCoordHandle, 2, GLES20.GL_FLOAT, false, 20, verticesBuffer)
                                GLES20.glEnableVertexAttribArray(wmTextureCoordHandle)
                                
                                GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
                                GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, watermarkTextureId)
                                GLES20.glUniform1i(wmTextureHandle, 0)
                                
                                GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
                                GLES20.glDisable(GLES20.GL_BLEND)
                            }
                            
                            EGLExt.eglPresentationTimeANDROID(eglDisplay, eglSurface, bufferInfo.presentationTimeUs * 1000L)
                            EGL14.eglSwapBuffers(eglDisplay, eglSurface)
                        }
                    }
                }

                // Drain Encoder output to Muxer
                val encOutIdx = encoder.dequeueOutputBuffer(bufferInfo, 10000)
                if (encOutIdx >= 0) {
                    val encodedData = encoder.getOutputBuffer(encOutIdx)!!
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                        bufferInfo.size = 0
                    }
                    if (bufferInfo.size > 0) {
                        if (isMuxerStarted) {
                            encodedData.position(bufferInfo.offset)
                            encodedData.limit(bufferInfo.offset + bufferInfo.size)
                            muxer.writeSampleData(muxerTrackIndex, encodedData, bufferInfo)
                        }
                    }
                    encoder.releaseOutputBuffer(encOutIdx, false)
                    if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                        isEncoderEOS = true
                    }
                } else if (encOutIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (isMuxerStarted) {
                        throw RuntimeException("Encoder format changed twice")
                    }
                    val newFormat = encoder.outputFormat
                    muxerTrackIndex = muxer.addTrack(newFormat)
                    
                    if (audioFormat != null) {
                        muxerAudioTrackIndex = muxer.addTrack(audioFormat)
                    }
                    
                    muxer.start()
                    isMuxerStarted = true
                }
            }

            // 8. Copy audio track if available
            if (audioTrackIndex >= 0 && muxerAudioTrackIndex >= 0) {
                Log.d(TAG, "Verbatim copying audio track...")
                val audioExtractor = MediaExtractor()
                try {
                    audioExtractor.setDataSource(context, Uri.parse(sourcePath), null)
                } catch (e: Exception) {
                    audioExtractor.setDataSource(sourcePath)
                }
                audioExtractor.selectTrack(audioTrackIndex)
                
                val audioBuf = ByteBuffer.allocateDirect(1024 * 1024)
                val audioInfo = MediaCodec.BufferInfo()
                while (true) {
                    audioInfo.offset = 0
                    val sampleSize = audioExtractor.readSampleData(audioBuf, 0)
                    if (sampleSize < 0) {
                        break
                    }
                    audioInfo.size = sampleSize
                    audioInfo.presentationTimeUs = audioExtractor.sampleTime
                    audioInfo.flags = audioExtractor.sampleFlags
                    muxer.writeSampleData(muxerAudioTrackIndex, audioBuf, audioInfo)
                    audioExtractor.advance()
                }
                audioExtractor.release()
            }
        } finally {
            // 9. Release everything
            decoder.stop()
            decoder.release()
            
            encoder.stop()
            encoder.release()
            
            videoExtractor.release()
            
            decSurface.release()
            decSurfaceTexture.release()
            GLES20.glDeleteTextures(1, textures, 0)
            
            releaseTextures()
            if (programId != -1) {
                GLES20.glDeleteProgram(programId)
                programId = -1
            }
            if (watermarkTextureId != -1) {
                GLES20.glDeleteTextures(1, intArrayOf(watermarkTextureId), 0)
                watermarkTextureId = -1
            }
            if (watermarkProgramId != -1) {
                GLES20.glDeleteProgram(watermarkProgramId)
                watermarkProgramId = -1
            }
            
            releaseEgl()
            
            if (isMuxerStarted) {
                muxer.stop()
            }
            muxer.release()
        }

        Log.d(TAG, "Transcoding successfully completed! Saved to: ${outputFile.absolutePath}")
        
        // Register the file so it appears in the public gallery and Downloads
        MediaScannerConnection.scanFile(context, arrayOf(outputFile.absolutePath), arrayOf("video/mp4"), null)

        return outputFile.absolutePath
    }

    private fun selectVideoTrack(extractor: MediaExtractor): Int {
        for (i in 0 until extractor.trackCount) {
            val format = extractor.getTrackFormat(i)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.startsWith("video/")) {
                return i
            }
        }
        return -1
    }

    private fun setupEgl(encoderSurface: Surface) {
        eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        if (eglDisplay == EGL14.EGL_NO_DISPLAY) {
            throw RuntimeException("eglGetDisplay failed")
        }
        val version = IntArray(2)
        if (!EGL14.eglInitialize(eglDisplay, version, 0, version, 1)) {
            throw RuntimeException("eglInitialize failed")
        }

        val attribList = intArrayOf(
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            0x3142, 1, // EGL_RECORDABLE_ANDROID
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val numConfigs = IntArray(1)
        EGL14.eglChooseConfig(eglDisplay, attribList, 0, configs, 0, configs.size, numConfigs, 0)
        val eglConfig = configs[0] ?: throw RuntimeException("eglChooseConfig failed")

        val contextAttribs = intArrayOf(
            EGL14.EGL_CONTEXT_CLIENT_VERSION, 2,
            EGL14.EGL_NONE
        )
        eglContext = EGL14.eglCreateContext(eglDisplay, eglConfig, EGL14.EGL_NO_CONTEXT, contextAttribs, 0)
        if (eglContext == EGL14.EGL_NO_CONTEXT) {
            throw RuntimeException("eglCreateContext failed")
        }

        val surfaceAttribs = intArrayOf(EGL14.EGL_NONE)
        eglSurface = EGL14.eglCreateWindowSurface(eglDisplay, eglConfig, encoderSurface, surfaceAttribs, 0)
        if (eglSurface == EGL14.EGL_NO_SURFACE) {
            throw RuntimeException("eglCreateWindowSurface failed")
        }

        if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) {
            throw RuntimeException("eglMakeCurrent failed")
        }
    }

    private fun releaseEgl() {
        if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
            EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
            if (eglSurface != EGL14.EGL_NO_SURFACE) {
                EGL14.eglDestroySurface(eglDisplay, eglSurface)
                eglSurface = EGL14.EGL_NO_SURFACE
            }
            if (eglContext != EGL14.EGL_NO_CONTEXT) {
                EGL14.eglDestroyContext(eglDisplay, eglContext)
                eglContext = EGL14.EGL_NO_CONTEXT
            }
            EGL14.eglReleaseThread()
            EGL14.eglTerminate(eglDisplay)
            eglDisplay = EGL14.EGL_NO_DISPLAY
        }
    }

    private fun compileShader(type: Int, shaderCode: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, shaderCode)
        GLES20.glCompileShader(shader)
        val compiled = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
        if (compiled[0] == 0) {
            val info = GLES20.glGetShaderInfoLog(shader)
            GLES20.glDeleteShader(shader)
            throw RuntimeException("Shader compilation failed: $info")
        }
        return shader
    }

    private fun setupShaders() {
        val vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, ColorGradingShader.VIDEO_VERTEX_SHADER)
        val fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, ColorGradingShader.getFragmentShader(false))
        
        programId = GLES20.glCreateProgram()
        GLES20.glAttachShader(programId, vertexShader)
        GLES20.glAttachShader(programId, fragmentShader)
        GLES20.glLinkProgram(programId)
        
        val linkStatus = IntArray(1)
        GLES20.glGetProgramiv(programId, GLES20.GL_LINK_STATUS, linkStatus, 0)
        if (linkStatus[0] == 0) {
            val log = GLES20.glGetProgramInfoLog(programId)
            throw RuntimeException("Program linking failed: $log")
        }
        
        handles = TranscodeProgramHandles(programId)
        GLES20.glUseProgram(programId)
        handles?.let { h ->
            GLES20.glUniform1i(h.sTextureHandle, 0)
            GLES20.glUniform1i(h.curvesTextureHandle, 1)
            GLES20.glUniform1i(h.doubleExposureTextureHandle, 2)
            GLES20.glUniform1i(h.sBrushMaskTextureHandle, 3)
            GLES20.glUniform1i(h.sLutTextureHandle, 4)
        }
    }

    private fun setupWatermarkShader() {
        val vs = """
            attribute vec4 aPosition;
            attribute vec2 aTextureCoord;
            varying vec2 vTextureCoord;
            void main() {
                gl_Position = aPosition;
                vTextureCoord = aTextureCoord;
            }
        """.trimIndent()

        val fs = """
            precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D sTexture;
            void main() {
                gl_FragColor = texture2D(sTexture, vTextureCoord);
            }
        """.trimIndent()

        val vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, vs)
        val fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, fs)
        
        watermarkProgramId = GLES20.glCreateProgram()
        GLES20.glAttachShader(watermarkProgramId, vertexShader)
        GLES20.glAttachShader(watermarkProgramId, fragmentShader)
        GLES20.glLinkProgram(watermarkProgramId)
        
        val linkStatus = IntArray(1)
        GLES20.glGetProgramiv(watermarkProgramId, GLES20.GL_LINK_STATUS, linkStatus, 0)
        if (linkStatus[0] == 0) {
            val log = GLES20.glGetProgramInfoLog(watermarkProgramId)
            throw RuntimeException("Watermark program linking failed: ${'$'}log")
        }
        
        wmPositionHandle = GLES20.glGetAttribLocation(watermarkProgramId, "aPosition")
        wmTextureCoordHandle = GLES20.glGetAttribLocation(watermarkProgramId, "aTextureCoord")
        wmTextureHandle = GLES20.glGetUniformLocation(watermarkProgramId, "sTexture")
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

    private fun uploadTextures(params: GradingParams) {
        // 1. Curves LUT Texture
        val curvesLutData = params.curvesLutData
        val curvesBuffer = ByteBuffer.allocateDirect(1024).order(ByteOrder.nativeOrder())
        if (curvesLutData != null && curvesLutData.size >= 1024) {
            for (i in 0 until 1024) {
                val b = (Math.max(0f, Math.min(1f, curvesLutData[i])) * 255f).toInt().toByte()
                curvesBuffer.put(b)
            }
        } else {
            for (i in 0 until 256) {
                val b = i.toByte()
                curvesBuffer.put(b)
                curvesBuffer.put(b)
                curvesBuffer.put(b)
                curvesBuffer.put(b)
            }
        }
        curvesBuffer.position(0)

        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        curvesTextureId = textures[0]
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, 256, 1, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, curvesBuffer)

        // 2. Double Exposure Texture
        val deUri = params.doubleExposureUri
        if (params.doubleExposureEnabled && !deUri.isNullOrEmpty()) {
            try {
                val inputStream = openInputStream(deUri)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream?.close()
                if (bitmap != null) {
                    val doubleExTextures = IntArray(1)
                    GLES20.glGenTextures(1, doubleExTextures, 0)
                    doubleExposureTextureId = doubleExTextures[0]
                    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, doubleExposureTextureId)
                    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
                    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
                    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
                    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
                    android.opengl.GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
                    bitmap.recycle()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load double exposure Bitmap in transcoder", e)
            }
        }

        // 3. Brush Mask Texture
        val brushBmp = params.brushMaskBitmap
        if (brushBmp != null) {
            val brushTextures = IntArray(1)
            GLES20.glGenTextures(1, brushTextures, 0)
            brushMaskTextureId = brushTextures[0]
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, brushMaskTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
            android.opengl.GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, brushBmp, 0)
        }

        // 4. Custom 3D LUT Texture
        val lut = params.lutData
        if (lut != null) {
            val lutTextures = IntArray(1)
            GLES20.glGenTextures(1, lutTextures, 0)
            lutTextureId = lutTextures[0]
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
            
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
        }
    }

    private fun releaseTextures() {
        val textures = IntArray(4)
        var idx = 0
        if (curvesTextureId != -1) textures[idx++] = curvesTextureId
        if (doubleExposureTextureId != -1) textures[idx++] = doubleExposureTextureId
        if (brushMaskTextureId != -1) textures[idx++] = brushMaskTextureId
        if (lutTextureId != -1) textures[idx++] = lutTextureId
        if (idx > 0) {
            GLES20.glDeleteTextures(idx, textures, 0)
        }
        curvesTextureId = -1
        doubleExposureTextureId = -1
        brushMaskTextureId = -1
        lutTextureId = -1
    }

    private fun drawFrame(
        decTexId: Int,
        stMatrix: FloatArray,
        params: GradingParams,
        width: Int,
        height: Int
    ) {
        val h = handles ?: return
        
        GLES20.glUseProgram(programId)

        // Bind active textures
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, decTexId)
        GLES20.glUniform1i(h.sTextureHandle, 0)

        GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
        if (curvesTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, curvesTextureId)
        }
        GLES20.glUniform1i(h.curvesTextureHandle, 1)

        GLES20.glActiveTexture(GLES20.GL_TEXTURE2)
        if (doubleExposureTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, doubleExposureTextureId)
        }
        GLES20.glUniform1i(h.doubleExposureTextureHandle, 2)

        GLES20.glActiveTexture(GLES20.GL_TEXTURE3)
        if (brushMaskTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, brushMaskTextureId)
        }
        GLES20.glUniform1i(h.sBrushMaskTextureHandle, 3)

        GLES20.glActiveTexture(GLES20.GL_TEXTURE4)
        if (lutTextureId != -1) {
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, lutTextureId)
        }
        GLES20.glUniform1i(h.sLutTextureHandle, 4)

        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)

        // Geometry attributes
        verticesBuffer.position(0)
        GLES20.glVertexAttribPointer(h.positionHandle, 3, GLES20.GL_FLOAT, false, 20, verticesBuffer)
        GLES20.glEnableVertexAttribArray(h.positionHandle)

        verticesBuffer.position(3)
        GLES20.glVertexAttribPointer(h.textureCoordHandle, 2, GLES20.GL_FLOAT, false, 20, verticesBuffer)
        GLES20.glEnableVertexAttribArray(h.textureCoordHandle)

        // Matrices
        val mvpMatrix = FloatArray(16)
        Matrix.setIdentityM(mvpMatrix, 0)
        GLES20.glUniformMatrix4fv(h.mvpMatrixHandle, 1, false, mvpMatrix, 0)
        GLES20.glUniformMatrix4fv(h.stMatrixHandle, 1, false, stMatrix, 0)

        // Uniform settings
        GLES20.glUniform1f(h.exposureHandle, params.exposure)
        GLES20.glUniform1f(h.contrastHandle, params.contrast)
        GLES20.glUniform1f(h.saturationHandle, params.saturation)
        GLES20.glUniform1f(h.gammaHandle, params.gamma)
        GLES20.glUniform1i(h.logFormatHandle, params.logFormat)
        GLES20.glUniform1f(h.brightnessHandle, params.brightness)

        GLES20.glUniform1f(h.temperatureHandle, params.temperature)
        GLES20.glUniform1f(h.tintHandle, params.tint)
        GLES20.glUniform1f(h.highlightsHandle, params.highlights)
        GLES20.glUniform1f(h.shadowsHandle, params.shadows)
        GLES20.glUniform1f(h.toneContrastHandle, params.toneContrast)
        GLES20.glUniform1f(h.vibranceHandle, params.vibrance)
        GLES20.glUniform1f(h.hueRotationHandle, params.hueRotation)

        // HSL Mix array
        GLES20.glUniform1fv(h.hslAdjustmentsHandle, 24, params.hslAdjustments, 0)

        // Color wheels offsets
        val colorData = params.colorWheelsData
        var hRad = (colorData[0] * Math.PI / 180.0).toFloat()
        var sat = colorData[1]
        GLES20.glUniform3f(h.shadowsColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
        GLES20.glUniform1f(h.shadowsLiftHandle, colorData[2] * 0.2f)

        hRad = (colorData[3] * Math.PI / 180.0).toFloat()
        sat = colorData[4]
        GLES20.glUniform3f(h.midtonesColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
        GLES20.glUniform1f(h.midtonesLiftHandle, colorData[5] * 0.2f)

        hRad = (colorData[6] * Math.PI / 180.0).toFloat()
        sat = colorData[7]
        GLES20.glUniform3f(h.highlightsColorHandle, Math.cos(hRad.toDouble()).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 2.0*Math.PI/3.0).toFloat() * sat * 0.15f, Math.cos(hRad.toDouble() + 4.0*Math.PI/3.0).toFloat() * sat * 0.15f)
        GLES20.glUniform1f(h.highlightsLiftHandle, colorData[8] * 0.2f)

        // Vignette params
        GLES20.glUniform1f(h.vignetteStrengthHandle, params.vignetteStrength)
        GLES20.glUniform1f(h.vignetteRadiusHandle, params.vignetteRadius)
        GLES20.glUniform1f(h.vignetteSoftnessHandle, params.vignetteSoftness)
        GLES20.glUniform2f(h.vignetteCenterHandle, params.vignetteCenterX, params.vignetteCenterY)

        // Double exposure params
        GLES20.glUniform1i(h.doubleExposureEnabledHandle, if (params.doubleExposureEnabled && doubleExposureTextureId != -1) 1 else 0)
        GLES20.glUniform1f(h.doubleExposureOpacityHandle, params.doubleExposureOpacity)
        GLES20.glUniform2f(h.doubleExposureOffsetHandle, params.doubleExposureOffsetX, params.doubleExposureOffsetY)
        GLES20.glUniform1i(h.doubleExposureBlendHandle, params.doubleExposureBlend)

        // Details and FX Overhauls
        GLES20.glUniform1f(h.dehazeHandle, params.dehaze)
        GLES20.glUniform1f(h.hdrStrengthHandle, params.hdrStrength)
        GLES20.glUniform1f(h.sharpenHandle, params.sharpen)
        GLES20.glUniform1f(h.definitionHandle, params.definition)
        GLES20.glUniform1f(h.softnessHandle, params.softness)

        GLES20.glUniform1f(h.grainAmountHandle, params.grainAmount)
        GLES20.glUniform1f(h.grainSizeHandle, params.grainSize)
        GLES20.glUniform1f(h.grainRoughnessHandle, params.grainRoughness)
        val grainSeed = (System.nanoTime() % 1000000).toFloat() / 1000f
        GLES20.glUniform1f(h.grainSeedHandle, grainSeed)

        GLES20.glUniform1f(h.halationStrengthHandle, params.halationStrength)
        GLES20.glUniform1f(h.halationRadiusHandle, params.halationRadius)
        val hColor = parseColorToRgb(params.halationColor)
        GLES20.glUniform3f(h.halationColorHandle, hColor[0], hColor[1], hColor[2])
        GLES20.glUniform2f(h.halationCenterHandle, params.halationCenterX, params.halationCenterY)

        GLES20.glUniform1f(h.perspectiveVerticalHandle, params.perspectiveVertical)
        GLES20.glUniform1f(h.perspectiveHorizontalHandle, params.perspectiveHorizontal)
        GLES20.glUniform1f(h.perspectiveAspectHandle, params.perspectiveAspect)
        GLES20.glUniform1f(h.perspectiveRotateHandle, params.perspectiveRotate)

        // Control points
        val cpData = params.controlPointsData
        var activeCps = 0
        for (i in 0 until 10) {
            if (cpData[i * 11 + 2] > 0.001f) activeCps++
        }
        GLES20.glUniform1fv(h.controlPointsHandle, 110, cpData, 0)
        GLES20.glUniform1i(h.numControlPointsHandle, activeCps)

        // Regional Masks
        val mData = params.masksData
        var activeMasks = 0
        for (i in 0 until 5) {
            if (mData[i * 13 + 1] > 0.001f) activeMasks++
        }
        GLES20.glUniform1fv(h.masksHandle, 65, mData, 0)
        GLES20.glUniform1i(h.numMasksHandle, activeMasks)
        GLES20.glUniform1i(h.showMaskOverlayHandle, 0) // No mask red overlay during export!

        GLES20.glUniform1f(h.lutIntensityHandle, params.lutIntensity)
        GLES20.glUniform1f(h.lutSizeHandle, params.lutSize)
        GLES20.glUniform1f(h.lutColorOffsetHandle, params.lutColorOffset)
        GLES20.glUniform1f(h.lutToneOffsetHandle, params.lutToneOffset)

        // Bokeh and Smear Trail
        GLES20.glUniform1f(h.bokehStrengthHandle, params.bokehStrength)
        GLES20.glUniform1f(h.bokehRadiusHandle, params.bokehRadius)
        GLES20.glUniform1i(h.bokehShapeHandle, params.bokehShape)
        GLES20.glUniform2f(h.bokehCenterHandle, params.bokehCenterX, params.bokehCenterY)

        GLES20.glUniform1f(h.longExposureAmountHandle, params.longExposureAmount)
        GLES20.glUniform1f(h.longExposureDirectionHandle, params.longExposureDirection)
        GLES20.glUniform1f(h.longExposureThresholdHandle, params.longExposureThreshold)
        GLES20.glUniform2f(h.longExposureCenterHandle, params.longExposureCenterX, params.longExposureCenterY)

        GLES20.glUniform1f(h.denoiseLuminanceHandle, params.denoiseLuminance)
        GLES20.glUniform1f(h.denoiseColorHandle, params.denoiseColor)

        GLES20.glUniform1f(h.cropXHandle, params.cropX)
        GLES20.glUniform1f(h.cropYHandle, params.cropY)
        GLES20.glUniform1f(h.cropWidthHandle, params.cropWidth)
        GLES20.glUniform1f(h.cropHeightHandle, params.cropHeight)
        GLES20.glUniform1f(h.zoomScaleHandle, params.zoomScale)
        GLES20.glUniform1f(h.zoomXHandle, params.zoomX)
        GLES20.glUniform1f(h.zoomYHandle, params.zoomY)

        val texelW = if (width > 0) 1.0f / width.toFloat() else 1.0f / 1080.0f
        val texelH = if (height > 0) 1.0f / height.toFloat() else 1.0f / 1920.0f
        GLES20.glUniform2f(h.texelSizeHandle, texelW, texelH)

        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
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
            // Fallback
        }
        return floatArrayOf(1f, 0.2f, 0.1f)
    }
}

private class TranscodeProgramHandles(programId: Int) {
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

    val denoiseLuminanceHandle = GLES20.glGetUniformLocation(programId, "uDenoiseLuminance")
    val denoiseColorHandle = GLES20.glGetUniformLocation(programId, "uDenoiseColor")

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
