import { BLEND_MODE_INDEX, HUE_BANDS, type EditParams } from './types';
import { FRAG, VERT } from './shaderSource';
import { hexToRgb } from '../lib/imageIO';

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(err || 'Shader compile failed');
  }
  return s;
}

function curveYs(points: { y: number }[]) {
  return new Float32Array([
    points[0]?.y ?? 0,
    points[1]?.y ?? 0.25,
    points[2]?.y ?? 0.5,
    points[3]?.y ?? 0.75,
    points[4]?.y ?? 1,
  ]);
}

export class GradeRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buf: WebGLBuffer;
  private tex: WebGLTexture | null = null;
  private blendTex: WebGLTexture | null = null;
  private hasBlend = false;
  private params: EditParams | null = null;
  private imageSize = { w: 1, h: 1 };
  private locs: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL is not available in this browser.');
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'Program link failed');
    }
    this.program = prog;
    gl.useProgram(prog);

    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const names = [
      'uImage', 'uBlend', 'uHasBlend', 'uResolution',
      'uExposure', 'uBrightness', 'uContrast', 'uHighlights', 'uShadows',
      'uSaturation', 'uVibrance', 'uTemperature', 'uTint', 'uHue', 'uBw',
      'uCurveW', 'uCurveR', 'uCurveG', 'uCurveB',
      'uHslH', 'uHslS', 'uHslL',
      'uSharpen', 'uDefinition', 'uSoftness', 'uDenoiseL', 'uDenoiseC',
      'uVigStrength', 'uVigRadius', 'uVigSoft',
      'uGrainAmount', 'uGrainSize', 'uGrainRough',
      'uHalStrength', 'uHalRadius', 'uHalColor', 'uHalCenter',
      'uBokehStrength', 'uBokehAperture', 'uBokehCenter',
      'uLongAmt', 'uLongDir', 'uLongCenter',
      'uLinMask', 'uLinStart', 'uLinEnd', 'uLinFeather', 'uCircMask', 'uCircCenter', 'uCircRadius',
      'uMaskExposure', 'uMaskSat',
      'uDxEnabled', 'uDxOpacity', 'uDxOffset', 'uDxBlend',
    ];
    for (const n of names) this.locs[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(this.locs.uImage, 0);
    gl.uniform1i(this.locs.uBlend, 1);
  }

  private upload(target: WebGLTexture, bitmap: ImageBitmap) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  }

  setImage(bitmap: ImageBitmap) {
    if (!this.tex) this.tex = this.gl.createTexture();
    this.upload(this.tex!, bitmap);
    this.imageSize = { w: bitmap.width, h: bitmap.height };
    this.resize();
    this.render();
  }

  setBlendImage(bitmap: ImageBitmap | null) {
    if (!bitmap) {
      this.hasBlend = false;
      this.render();
      return;
    }
    if (!this.blendTex) this.blendTex = this.gl.createTexture();
    this.upload(this.blendTex!, bitmap);
    this.hasBlend = true;
    this.render();
  }

  setParams(p: EditParams) {
    this.params = p;
    this.render();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private applyUniforms(p: EditParams) {
    const gl = this.gl;
    const L = this.locs;
    gl.uniform1i(L.uHasBlend, this.hasBlend ? 1 : 0);
    gl.uniform2f(L.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(L.uExposure, p.exposure);
    gl.uniform1f(L.uBrightness, p.brightness);
    gl.uniform1f(L.uContrast, p.contrast);
    gl.uniform1f(L.uHighlights, p.highlights);
    gl.uniform1f(L.uShadows, p.shadows);
    gl.uniform1f(L.uSaturation, p.saturation);
    gl.uniform1f(L.uVibrance, p.vibrance);
    gl.uniform1f(L.uTemperature, p.temperature);
    gl.uniform1f(L.uTint, p.tint);
    gl.uniform1f(L.uHue, p.hue);
    gl.uniform1i(L.uBw, p.bwEnabled ? 1 : 0);
    gl.uniform1fv(L.uCurveW, curveYs(p.curves.rgb));
    gl.uniform1fv(L.uCurveR, curveYs(p.curves.r));
    gl.uniform1fv(L.uCurveG, curveYs(p.curves.g));
    gl.uniform1fv(L.uCurveB, curveYs(p.curves.b));
    const hArr = new Float32Array(8);
    const sArr = new Float32Array(8);
    const lArr = new Float32Array(8);
    HUE_BANDS.forEach((band, i) => {
      hArr[i] = p.hsl[band].hue;
      sArr[i] = p.hsl[band].saturation;
      lArr[i] = p.hsl[band].luminance;
    });
    gl.uniform1fv(L.uHslH, hArr);
    gl.uniform1fv(L.uHslS, sArr);
    gl.uniform1fv(L.uHslL, lArr);
    gl.uniform1f(L.uSharpen, p.sharpen);
    gl.uniform1f(L.uDefinition, p.definition);
    gl.uniform1f(L.uSoftness, p.softness);
    gl.uniform1f(L.uDenoiseL, p.denoiseLuminance);
    gl.uniform1f(L.uDenoiseC, p.denoiseColor);
    gl.uniform1f(L.uVigStrength, p.vignetteStrength);
    gl.uniform1f(L.uVigRadius, p.vignetteRadius);
    gl.uniform1f(L.uVigSoft, p.vignetteSoftness);
    gl.uniform1f(L.uGrainAmount, p.grainAmount);
    gl.uniform1f(L.uGrainSize, p.grainSize);
    gl.uniform1f(L.uGrainRough, p.grainRoughness);
    gl.uniform1f(L.uHalStrength, p.halationStrength);
    gl.uniform1f(L.uHalRadius, p.halationRadius);
    const [hr, hg, hb] = hexToRgb(p.halationColor);
    gl.uniform3f(L.uHalColor, hr, hg, hb);
    gl.uniform2f(L.uHalCenter, p.halationCenter.x, p.halationCenter.y);
    gl.uniform1f(L.uBokehStrength, p.bokehStrength);
    gl.uniform1f(L.uBokehAperture, p.bokehAperture);
    gl.uniform2f(L.uBokehCenter, p.bokehCenter.x, p.bokehCenter.y);
    gl.uniform1f(L.uLongAmt, p.longExposureAmount);
    gl.uniform1f(L.uLongDir, p.longExposureDirection);
    gl.uniform2f(L.uLongCenter, p.longExposureCenter.x, p.longExposureCenter.y);
    gl.uniform1i(L.uLinMask, p.linearMaskEnabled ? 1 : 0);
    gl.uniform2f(L.uLinStart, p.linearMaskStart.x, p.linearMaskStart.y);
    gl.uniform2f(L.uLinEnd, p.linearMaskEnd.x, p.linearMaskEnd.y);
    gl.uniform1f(L.uLinFeather, p.linearMaskFeather);
    gl.uniform1i(L.uCircMask, p.circularMaskEnabled ? 1 : 0);
    gl.uniform2f(L.uCircCenter, p.circularMaskCenter.x, p.circularMaskCenter.y);
    gl.uniform1f(L.uCircRadius, p.circularMaskRadius);
    gl.uniform1f(L.uMaskExposure, p.maskExposure);
    gl.uniform1f(L.uMaskSat, p.maskSaturation);
    gl.uniform1i(L.uDxEnabled, p.doubleExposureEnabled ? 1 : 0);
    gl.uniform1f(L.uDxOpacity, p.doubleExposureOpacity);
    gl.uniform2f(L.uDxOffset, p.doubleExposureOffset.x, p.doubleExposureOffset.y);
    gl.uniform1i(L.uDxBlend, BLEND_MODE_INDEX[p.doubleExposureBlend]);
  }

  render() {
    const gl = this.gl;
    if (!this.tex || !this.params) return;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    this.applyUniforms(this.params);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.hasBlend && this.blendTex ? this.blendTex : this.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  exportToCanvas(maxEdge = 4096): HTMLCanvasElement {
    if (!this.tex || !this.params) throw new Error('Nothing to export yet.');
    const scale = Math.min(1, maxEdge / Math.max(this.imageSize.w, this.imageSize.h));
    const w = Math.max(1, Math.round(this.imageSize.w * scale));
    const h = Math.max(1, Math.round(this.imageSize.h * scale));
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this.render();
    const ctx = off.getContext('2d')!;
    ctx.drawImage(this.canvas, 0, 0, w, h);
    this.canvas.width = prevW;
    this.canvas.height = prevH;
    this.render();
    return off;
  }

  dispose() {
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.blendTex) gl.deleteTexture(this.blendTex);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.program);
  }
}
