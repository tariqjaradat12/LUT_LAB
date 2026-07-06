/**
 * ControlPointEngine — Computes Nik Software U-Point style adjustments.
 * Calculates selective weights based on spatial distance and perceptual color similarity.
 */
import { Point2D } from './EditingEngine';

export interface ControlPoint {
  id: string;
  x: number;
  y: number;
  radius: number;      // 0.05 – 1.0 spatial radius
  brightness: number;  // -100 → +100
  contrast: number;    // -100 → +100
  structure: number;   // -100 → +100
  targetColor: [number, number, number]; // [r, g, b] in [0, 1]
  enabled: boolean;
}

export class ControlPointEngine {
  /**
   * Calculates the adjustment influence weight (0.0 to 1.0) for a given pixel.
   * Weight depends on spatial distance from the control point and similarity
   * of the pixel color to the target color sampled at the control point center.
   */
  public static calculateWeight(
    px: number,
    py: number,
    r: number,
    g: number,
    b: number,
    cp: ControlPoint
  ): number {
    if (!cp.enabled) return 0;

    // 1. Spatial distance falloff (Euclidean distance)
    const dx = px - cp.x;
    const dy = py - cp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist >= cp.radius) return 0;
    
    // Smooth spatial falloff
    const spatialWeight = 1.0 - (dist / cp.radius);

    // 2. Color similarity weight
    // Perceptual RGB weight difference (more sensitive to green, less to blue)
    const tr = cp.targetColor[0];
    const tg = cp.targetColor[1];
    const tb = cp.targetColor[2];
    
    const dr = r - tr;
    const dg = g - tg;
    const db = b - tb;
    
    // Euclidean distance in RGB color space
    const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
    
    // Convert color distance to similarity weight.
    // We want a steep exponential falloff so dissimilar colors drop off quickly.
    const colorWeight = Math.exp(-colorDist * 4.0);

    // Final combined weight
    return spatialWeight * colorWeight;
  }

  /**
   * Applies the control point adjustments to a pixel color.
   */
  public static applyAdjustment(
    r: number,
    g: number,
    b: number,
    weight: number,
    cp: ControlPoint
  ): [number, number, number] {
    if (weight <= 0) return [r, g, b];

    let R = r, G = g, B = b;

    // 1. Selective Brightness (exposure boost/cut)
    if (cp.brightness !== 0) {
      const shift = (cp.brightness / 100.0) * 0.4 * weight;
      R += shift;
      G += shift;
      B += shift;
    }

    // 2. Selective Contrast (pivot around 0.5)
    if (cp.contrast !== 0) {
      const cont = 1.0 + (cp.contrast / 100.0) * 0.5 * weight;
      R = (R - 0.5) * cont + 0.5;
      G = (G - 0.5) * cont + 0.5;
      B = (B - 0.5) * cont + 0.5;
    }

    // 3. Selective Structure (represented as dynamic local contrast boost/clarity)
    if (cp.structure !== 0) {
      // Structure boosts detail (mid-tone local contrast)
      const struct = 1.0 + (cp.structure / 100.0) * 0.4 * weight;
      const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      
      // Pivot around luma midpoint to enhance local texture
      R = luma + (R - luma) * struct;
      G = luma + (G - luma) * struct;
      B = luma + (B - luma) * struct;
    }

    return [
      Math.min(1.0, Math.max(0.0, R)),
      Math.min(1.0, Math.max(0.0, G)),
      Math.min(1.0, Math.max(0.0, B)),
    ];
  }
}
