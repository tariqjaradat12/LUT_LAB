import { NativeModules } from 'react-native';

const { VideoExporter } = NativeModules;

export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  totalDurationMs: number;
}

export class VideoRenderingEngine {
  /**
   * Orchestrates high-fidelity lossless video export via platform-native modules.
   * On iOS, it uses AVAssetWriter with ProRes 4444 (lossless).
   * On Android, it uses MediaCodec and MediaMuxer configured for lossless CQ encoding.
   */
  public static async renderAndExport(
    filename: string,
    width: number,
    height: number,
    fps: number,
    frames: { color: string; durationMs: number }[]
  ): Promise<string> {
    if (!VideoExporter) {
      // Graceful fallback for web/testing environment where NativeModules isn't fully linked
      console.warn("Native VideoExporter module not found, using simulation fallback.");
      return `SimulatedExportPath/${filename}`;
    }

    try {
      console.log(`[VideoRenderingEngine] Initializing export: ${filename} (${width}x${height} @ ${fps}fps)`);
      
      // Start the native render engine session
      await VideoExporter.startExport(filename, width, height, fps);

      // Append frames to the native video track sequentially
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`[VideoRenderingEngine] Rendering frame ${i + 1}/${frames.length}: color=${frame.color}`);
        await VideoExporter.appendFrame(frame.color, frame.durationMs);
      }

      // Finalize and get the output video file path
      const resultPath = await VideoExporter.finalizeExport();
      console.log(`[VideoRenderingEngine] Video successfully exported to: ${resultPath}`);
      return resultPath;
    } catch (error) {
      console.error("[VideoRenderingEngine] Error exporting video:", error);
      throw error;
    }
  }
}
