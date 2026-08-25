import { BLEND_MODE_INDEX, HUE_BANDS, type CurveChannels, type CurvePoint, type EditParams } from './types';
import { FRAG, VERT } from './shaderSource';
import { hexToRgb } from '../lib/imageIO';
import { lutDataToTextureBytes } from './lutEngine';

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

const IDENTITY_Y = [0, 0.25, 0.5, 0.75, 1];

function channelIsIdentity(points: CurvePoint[]) {
  return points.length >= 5 && points.every((p, i) => Math.abs(p.y - IDENTITY_Y[i]) < 0.002);
}

function curvesAreIdentity(curves: CurveChannels) {
  return (
    channelIsIdentity(curves.rgb) &&
    channelIsIdentity(curves.r) &&
    channelIsIdentity(curves.g) &&
    channelIsIdentity(curves.b)
  );
}

function colorGradeActive(p: EditParams) {
  if (Math.abs(p.saturation) > 0.01 || Math.abs(p.vibrance) > 0.01 || Math.abs(p.hue) > 0.01) {
    return true;
  }
  for (const band of HUE_BANDS) {
    const b = p.hsl[band];
    if (Math.abs(b.hue) > 0.01 || Math.abs(b.saturation) > 0.01 || Math.abs(b.luminance) > 0.01) {
      return true;
    }
  }
  return false;
}

export class GradeRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buf: WebGLBuffer;
  private tex: WebGLTexture | null = null;
  private blendTex: WebGLTexture | null = null;
  private lutTex: WebGLTexture | null = null;
  private hasBlend = false;
  private hasLut = false;
  private lutSize = 33;
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
      'uSaturation', 'uVibrance', 'uTemperature', 'uTint', 'uHue', 'uBw', 'uColorGrade',
      'uCurveW', 'uCurveR', 'uCurveG', 'uCurveB', 'uCurvesEnabled',
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
      'uLut', 'uHasLut', 'uLutSize', 'uLutIntensity', 'uLutColorOffset', 'uLutToneOffset',
    ];
    for (const n of names) this.locs[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(this.locs.uImage, 0);
    gl.uniform1i(this.locs.uBlend, 1);
    gl.uniform1i(this.locs.uLut, 2);
    gl.clearColor(0, 0, 0, 1);
  }

  /** Fit canvas to stage while preserving photo aspect ratio. */
  fitToStage(stageW: number, stageH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const imgAspect = this.imageSize.w / Math.max(1, this.imageSize.h);
    let cssW = stageW;
    let cssH = stageH;
    if (stageW > 0 && stageH > 0) {
      const stageAspect = stageW / stageH;
      if (stageAspect > imgAspect) {
        cssH = stageH;
        cssW = cssH * imgAspect;
      } else {
        cssW = stageW;
        cssH = cssW / imgAspect;
      }
    }
    this.canvas.style.width = `${Math.floor(cssW)}px`;
    this.canvas.style.height = `${Math.floor(cssH)}px`;
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private stageElement(): HTMLElement | null {
    return this.canvas.closest('.stage') as HTMLElement | null;
  }

  private upload(target: WebGLTexture, bitmap: ImageBitmap) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
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
    const stage = this.stageElement();
    if (stage) this.fitToStage(stage.clientWidth, stage.clientHeight);
    this.render();
  }

  setVideoFrame(video: HTMLVideoElement) {
    if (!this.tex) this.tex = this.gl.createTexture();
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    this.imageSize = { w: video.videoWidth || this.imageSize.w, h: video.videoHeight || this.imageSize.h };
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

  setLut(data: Float32Array | null, size = 33) {
    const gl = this.gl;
    if (!data || data.length < size * size * size * 3) {
      this.hasLut = false;
      this.render();
      return;
    }
    if (!this.lutTex) this.lutTex = gl.createTexture();
    this.lutSize = size;
    const bytes = lutDataToTextureBytes(data);
    const w = size * size;
    const h = size;
    const prevAlign = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, prevAlign);
    this.hasLut = true;
    this.render();
  }

  setParams(p: EditParams) {
    this.params = p;
    this.render();
  }

  resize() {
    const stage = this.stageElement();
    if (stage) this.fitToStage(stage.clientWidth, stage.clientHeight);
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
    gl.uniform1i(L.uColorGrade, colorGradeActive(p) ? 1 : 0);
    gl.uniform1fv(L.uCurveW, curveYs(p.curves.rgb));
    gl.uniform1fv(L.uCurveR, curveYs(p.curves.r));
    gl.uniform1fv(L.uCurveG, curveYs(p.curves.g));
    gl.uniform1fv(L.uCurveB, curveYs(p.curves.b));
    gl.uniform1i(L.uCurvesEnabled, curvesAreIdentity(p.curves) ? 0 : 1);
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
    gl.uniform1i(L.uHasLut, this.hasLut ? 1 : 0);
    gl.uniform1f(L.uLutSize, this.lutSize);
    gl.uniform1f(L.uLutIntensity, p.lutIntensity);
    gl.uniform1f(L.uLutColorOffset, p.lutColorOffset);
    gl.uniform1f(L.uLutToneOffset, p.lutToneOffset);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  render() {
    this.draw(true);
  }

  /** Draw current grade. When fitToStage is false, keep the current canvas buffer size (export). */
  draw(fitToStage: boolean) {
    const gl = this.gl;
    if (!this.tex || !this.params) return;
    if (fitToStage) this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(this.gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    this.applyUniforms(this.params);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.hasBlend && this.blendTex ? this.blendTex : this.tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.hasLut && this.lutTex ? this.lutTex : this.tex);
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
    const prevStyleW = this.canvas.style.width;
    const prevStyleH = this.canvas.style.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this.draw(false);
    const ctx = off.getContext('2d', { colorSpace: 'srgb' })!;
    ctx.drawImage(this.canvas, 0, 0, w, h);
    this.canvas.width = prevW;
    this.canvas.height = prevH;
    this.canvas.style.width = prevStyleW;
    this.canvas.style.height = prevStyleH;
    this.draw(true);
    return off;
  }

  dispose() {
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.blendTex) gl.deleteTexture(this.blendTex);
    if (this.lutTex) gl.deleteTexture(this.lutTex);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.program);
  }
}
