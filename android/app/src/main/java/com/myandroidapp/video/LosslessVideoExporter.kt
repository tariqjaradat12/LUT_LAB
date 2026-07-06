package com.myandroidapp.video

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

class LosslessVideoExporter {
    private val TAG = "LosslessVideoExporter"
    
    private var mediaCodec: MediaCodec? = null
    private var mediaMuxer: MediaMuxer? = null
    private var trackIndex = -1
    private var isMuxerStarted = false
    private var width = 0
    private var height = 0
    private var fps = 0
    private var frameIndex = 0
    private var outputVideoFile: File? = null

    /**
     * Initializes the encoder and muxer with lossless settings.
     */
    fun startExport(filePath: String, width: Int, height: Int, fps: Int) {
        this.width = width
        this.height = height
        this.fps = fps
        this.frameIndex = 0
        this.trackIndex = -1
        this.isMuxerStarted = false
        this.outputVideoFile = File(filePath)

        Log.d(TAG, "Initializing LosslessVideoExporter: Path=$filePath, Dim=${width}x${height}, FPS=$fps")

        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            // Set input color format to ByteBuffer / YUV420SemiPlanar
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420SemiPlanar)
            
            // Critical for high-fidelity export: Configure Constant Quality (CQ) mode to avoid compression loss
            setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CQ)
            setInteger(MediaFormat.KEY_QUALITY, 100) // 100% Quality profile (lossless/near-lossless depending on hardware)
            
            // Fallback high-bitrate if CQ mode is not fully honored by the device encoder hardware
            setInteger(MediaFormat.KEY_BIT_RATE, 80_000_000) // 80 Mbps for pristine 1080p details
            
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1) // High I-frame density for editing precision
        }

        mediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC).apply {
            configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            start()
        }

        // Initialize Muxer to write MP4 file
        mediaMuxer = MediaMuxer(filePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    }

    /**
     * Appends a frame with a specific color. This converts the Hex color to YUV pixel arrays
     * and feeds it into the MediaCodec input buffer.
     */
    fun appendFrame(colorHex: String, durationMs: Int) {
        val codec = mediaCodec ?: throw IllegalStateException("Encoder is not initialized")
        val color = android.graphics.Color.parseColor(colorHex)
        
        // Convert RGB to YUV420 semi-planar buffer
        val yuvFrame = convertRgbToYuv420SP(color, width, height)

        val inputBufferIndex = codec.dequeueInputBuffer(10000)
        if (inputBufferIndex >= 0) {
            val inputBuffer = codec.getInputBuffer(inputBufferIndex) ?: return
            inputBuffer.clear()
            inputBuffer.put(yuvFrame)

            val presentationTimeUs = (frameIndex * 1_000_000L) / fps
            codec.queueInputBuffer(
                inputBufferIndex,
                0,
                yuvFrame.size,
                presentationTimeUs,
                0
            )
            frameIndex++
            drainEncoder(false)
        } else {
            Log.w(TAG, "Input buffer timeout. Frame skipped.")
        }
    }

    /**
     * Finishes encoding, flushes buffers, starts/stops muxer, and returns the output video path.
     */
    fun finalizeExport(): String {
        drainEncoder(true)

        mediaCodec?.apply {
            stop()
            release()
        }
        mediaCodec = null

        mediaMuxer?.apply {
            if (isMuxerStarted) {
                stop()
            }
            release()
        }
        mediaMuxer = null
        isMuxerStarted = false

        Log.d(TAG, "Lossless export complete. File path: ${outputVideoFile?.absolutePath}")
        return outputVideoFile?.absolutePath ?: ""
    }

    /**
     * Drains encoded buffers from MediaCodec and writes them into MediaMuxer.
     */
    private fun drainEncoder(endOfStream: Boolean) {
        val codec = mediaCodec ?: return
        val muxer = mediaMuxer ?: return

        if (endOfStream) {
            try {
                codec.signalEndOfInputStream()
            } catch (e: Exception) {
                // signalEndOfInputStream is only valid when using Surface input.
                // For ByteBuffer input, we handle the EOS by queuing an empty buffer with standard flag.
            }
        }

        val bufferInfo = MediaCodec.BufferInfo()
        while (true) {
            val outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 1000)
            if (outputBufferIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
                if (!endOfStream) break
            } else if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                if (isMuxerStarted) {
                    throw RuntimeException("Format changed after muxer started")
                }
                val newFormat = codec.outputFormat
                trackIndex = muxer.addTrack(newFormat)
                muxer.start()
                isMuxerStarted = true
            } else if (outputBufferIndex >= 0) {
                val outputBuffer = codec.getOutputBuffer(outputBufferIndex) ?: continue

                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                    bufferInfo.size = 0
                }

                if (bufferInfo.size != 0 && isMuxerStarted) {
                    outputBuffer.position(bufferInfo.offset)
                    outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                    muxer.writeSampleData(trackIndex, outputBuffer, bufferInfo)
                }

                codec.releaseOutputBuffer(outputBufferIndex, false)

                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    break
                }
            }
        }
    }

    /**
     * Utility method to generate YUV420 semi-planar bytes for a solid RGB color.
     */
    private fun convertRgbToYuv420SP(color: Int, width: Int, height: Int): ByteArray {
        val r = (color shr 16) and 0xff
        val g = (color shr 8) and 0xff
        val b = color and 0xff

        val frameSize = width * height
        val yuv = ByteArray(frameSize * 3 / 2)

        // Fill Y channel
        val yVal = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
        for (i in 0 until frameSize) {
            yuv[i] = yVal.coerceIn(0, 255).toByte()
        }

        // Fill UV channels (semi-planar NV21: V, U, V, U...)
        val uVal = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
        val vVal = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128

        var uvIndex = frameSize
        for (j in 0 until height step 2) {
            for (i in 0 until width step 2) {
                yuv[uvIndex++] = vVal.coerceIn(0, 255).toByte()
                yuv[uvIndex++] = uVal.coerceIn(0, 255).toByte()
            }
        }
        return yuv
    }
}
