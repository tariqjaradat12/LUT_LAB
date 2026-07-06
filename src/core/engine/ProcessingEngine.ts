/**
 * Shared Core Logic: Computational Processing Engine.
 * This is a pure TypeScript engine decoupled from any platform UI.
 */

export interface ProcessingResult {
  dataPointsProcessed: number;
  mean: number;
  variance: number;
  stdDeviation: number;
  processingTimeMs: number;
}

export class ProcessingEngine {
  /**
   * Performs heavy statistical computations on an array of numbers.
   * This logic is shared directly across iOS and Android without duplication.
   */
  public static processData(data: number[]): ProcessingResult {
    const startTime = Date.now();
    
    if (data.length === 0) {
      return {
        dataPointsProcessed: 0,
        mean: 0,
        variance: 0,
        stdDeviation: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Calculate Mean
    const sum = data.reduce((acc, val) => acc + val, 0);
    const mean = sum / data.length;

    // Calculate Variance
    const sumOfSquares = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    const variance = sumOfSquares / data.length;

    // Calculate Standard Deviation
    const stdDeviation = Math.sqrt(variance);

    // Calculate processing overhead
    const processingTimeMs = Date.now() - startTime;

    return {
      dataPointsProcessed: data.length,
      mean: Math.round(mean * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      stdDeviation: Math.round(stdDeviation * 100) / 100,
      processingTimeMs,
    };
  }

  /**
   * Demonstrates a processing pipeline step.
   */
  public static transformFrames(frameCount: number, width: number, height: number): string {
    return `Prepared metadata for rendering pipeline: ${frameCount} frames at ${width}x${height} resolution.`;
  }
}
