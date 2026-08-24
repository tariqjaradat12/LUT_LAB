export const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uBlend;
uniform int uHasBlend;
uniform vec2 uResolution;

uniform float uExposure;
uniform float uBrightness;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform float uSaturation;
uniform float uVibrance;
uniform float uTemperature;
uniform float uTint;
uniform float uHue;
uniform int uBw;

uniform float uCurveW[5];
uniform float uCurveR[5];
uniform float uCurveG[5];
uniform float uCurveB[5];
uniform int uCurvesEnabled;

uniform float uHslH[8];
uniform float uHslS[8];
uniform float uHslL[8];

uniform float uSharpen;
uniform float uDefinition;
uniform float uSoftness;
uniform float uDenoiseL;
uniform float uDenoiseC;

uniform float uVigStrength;
uniform float uVigRadius;
uniform float uVigSoft;

uniform float uGrainAmount;
uniform float uGrainSize;
uniform float uGrainRough;

uniform float uHalStrength;
uniform float uHalRadius;
uniform vec3 uHalColor;
uniform vec2 uHalCenter;

uniform float uBokehStrength;
uniform float uBokehAperture;
uniform vec2 uBokehCenter;

uniform float uLongAmt;
uniform float uLongDir;
uniform vec2 uLongCenter;

uniform int uLinMask;
uniform vec2 uLinStart;
uniform vec2 uLinEnd;
uniform float uLinFeather;
uniform int uCircMask;
uniform vec2 uCircCenter;
uniform float uCircRadius;
uniform float uMaskExposure;
uniform float uMaskSat;

uniform int uDxEnabled;
uniform float uDxOpacity;
uniform vec2 uDxOffset;
uniform int uDxBlend;

uniform sampler2D uLut;
uniform int uHasLut;
uniform float uLutSize;
uniform float uLutIntensity;
uniform float uLutColorOffset;
uniform float uLutToneOffset;

vec3 sampleLut(vec3 c) {
  float N = uLutSize;
  float invNN = 1.0 / (N * N);
  float invN = 1.0 / N;
  float r = c.r * (N - 1.0);
  float g = c.g * (N - 1.0);
  float b = c.b * (N - 1.0);
  float r0 = floor(r);
  float r1 = min(r0 + 1.0, N - 1.0);
  float g0 = floor(g);
  float g1 = min(g0 + 1.0, N - 1.0);
  float b0 = floor(b);
  float b1 = min(b0 + 1.0, N - 1.0);
  float dr = r - r0;
  float dg = g - g0;
  float db = b - b0;
  vec3 c000 = texture2D(uLut, vec2((g0 * N + r0 + 0.5) * invNN, (b0 + 0.5) * invN)).rgb;
  vec3 c100 = texture2D(uLut, vec2((g0 * N + r1 + 0.5) * invNN, (b0 + 0.5) * invN)).rgb;
  vec3 c010 = texture2D(uLut, vec2((g1 * N + r0 + 0.5) * invNN, (b0 + 0.5) * invN)).rgb;
  vec3 c110 = texture2D(uLut, vec2((g1 * N + r1 + 0.5) * invNN, (b0 + 0.5) * invN)).rgb;
  vec3 c001 = texture2D(uLut, vec2((g0 * N + r0 + 0.5) * invNN, (b1 + 0.5) * invN)).rgb;
  vec3 c101 = texture2D(uLut, vec2((g0 * N + r1 + 0.5) * invNN, (b1 + 0.5) * invN)).rgb;
  vec3 c011 = texture2D(uLut, vec2((g1 * N + r0 + 0.5) * invNN, (b1 + 0.5) * invN)).rgb;
  vec3 c111 = texture2D(uLut, vec2((g1 * N + r1 + 0.5) * invNN, (b1 + 0.5) * invN)).rgb;
  vec3 c00 = mix(c000, c100, dr);
  vec3 c01 = mix(c001, c101, dr);
  vec3 c10 = mix(c010, c110, dr);
  vec3 c11 = mix(c011, c111, dr);
  vec3 c0 = mix(c00, c10, dg);
  vec3 c1 = mix(c01, c11, dg);
  return mix(c0, c1, db);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float softNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec3 rgb2hsv(vec3 c) {
  float cMax = max(c.r, max(c.g, c.b));
  float cMin = min(c.r, min(c.g, c.b));
  float d = cMax - cMin;
  float h = 0.0;
  if (d > 1e-5) {
    if (cMax == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (cMax == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  float s = cMax <= 1e-5 ? 0.0 : d / cMax;
  return vec3(h, s, cMax);
}

vec3 hsv2rgb(vec3 c) {
  float h = c.x * 6.0;
  float s = c.y;
  float v = c.z;
  float i = floor(h);
  float f = h - i;
  float p = v * (1.0 - s);
  float q = v * (1.0 - s * f);
  float t = v * (1.0 - s * (1.0 - f));
  if (i == 0.0) return vec3(v, t, p);
  if (i == 1.0) return vec3(q, v, p);
  if (i == 2.0) return vec3(p, v, t);
  if (i == 3.0) return vec3(p, q, v);
  if (i == 4.0) return vec3(t, p, v);
  return vec3(v, p, q);
}

vec3 applyLutGrade(vec3 src) {
  vec3 target = sampleLut(clamp(src, 0.0, 1.0));
  vec3 hsv = rgb2hsv(clamp(target, 0.0, 1.0));
  if (abs(uLutToneOffset) > 0.01) {
    hsv.z = clamp(hsv.z * pow(2.0, (uLutToneOffset / 100.0) * 0.85), 0.0, 1.0);
  }
  if (abs(uLutColorOffset) > 0.01) {
    hsv.x = fract(hsv.x + (uLutColorOffset / 100.0) * 0.14);
  }
  target = hsv2rgb(hsv);
  float t = uLutIntensity / 100.0;
  return mix(src, clamp(target, 0.0, 1.0), t);
}

float evalCurve(float x, float y0, float y1, float y2, float y3, float y4) {
  float t = clamp(x, 0.0, 1.0) * 4.0;
  float i = floor(t);
  float f = t - i;
  float a = i < 0.5 ? y0 : (i < 1.5 ? y1 : (i < 2.5 ? y2 : (i < 3.5 ? y3 : y4)));
  float b = i < 0.5 ? y1 : (i < 1.5 ? y2 : (i < 2.5 ? y3 : y4));
  if (i >= 3.5) return y4;
  f = f * f * (3.0 - 2.0 * f);
  return mix(a, b, f);
}

float bandWeight(float h, float center) {
  float d = abs(h - center);
  d = min(d, 1.0 - d);
  return exp(-d * d * 80.0);
}

vec3 applyHslBands(vec3 rgb) {
  vec3 hsv = rgb2hsv(clamp(rgb, 0.0, 1.0));
  float centers[8];
  centers[0] = 0.0; centers[1] = 0.08; centers[2] = 0.16; centers[3] = 0.33;
  centers[4] = 0.5; centers[5] = 0.66; centers[6] = 0.78; centers[7] = 0.91;
  float wSum = 0.0;
  float dH = 0.0;
  float dS = 0.0;
  float dL = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = bandWeight(hsv.x, centers[i]);
    wSum += w;
    dH += w * uHslH[i];
    dS += w * uHslS[i];
    dL += w * uHslL[i];
  }
  if (wSum > 1e-4) {
    dH /= wSum; dS /= wSum; dL /= wSum;
    hsv.x = fract(hsv.x + dH / 360.0);
    hsv.y = clamp(hsv.y * (1.0 + dS / 100.0), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + dL / 100.0), 0.0, 1.5);
  }
  return hsv2rgb(hsv);
}

vec3 sampleImg(vec2 uv) {
  return texture2D(uImage, clamp(uv, 0.0, 1.0)).rgb;
}

vec3 gaussianSoft(vec2 uv, float radiusPx) {
  vec2 px = radiusPx / uResolution;
  vec3 acc = vec3(0.0);
  float wSum = 0.0;
  for (int x = -4; x <= 4; x++) {
    for (int y = -4; y <= 4; y++) {
      float w = exp(-float(x * x + y * y) / 12.0);
      acc += sampleImg(uv + vec2(float(x), float(y)) * px) * w;
      wSum += w;
    }
  }
  return acc / wSum;
}

vec3 edgeAwareDenoise(vec2 uv, vec3 center, float strength, int colorOnly) {
  if (strength <= 0.001) return center;
  vec2 px = 1.2 / uResolution;
  vec3 acc = center;
  float wSum = 1.0;
  float cLuma = dot(center, vec3(0.2126, 0.7152, 0.0722));
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.785398;
    vec2 off = vec2(cos(ang), sin(ang)) * px * (1.0 + float(i) * 0.15);
    vec3 n = sampleImg(uv + off);
    float nLuma = dot(n, vec3(0.2126, 0.7152, 0.0722));
    float diff = colorOnly == 1
      ? length((n - center) - vec3(nLuma - cLuma))
      : abs(nLuma - cLuma);
    float w = exp(-diff * diff * 120.0) * strength;
    acc += n * w;
    wSum += w;
  }
  return acc / wSum;
}

vec3 blendDx(vec3 base, vec3 over, int mode) {
  if (mode == 0) return base + over;
  if (mode == 1) return (base + over) * 0.5;
  if (mode == 2) return max(base, over);
  if (mode == 3) return min(base, over);
  if (mode == 4) return base * over;
  if (mode == 5) {
    return vec3(
      base.r < 0.5 ? 2.0 * base.r * over.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - over.r),
      base.g < 0.5 ? 2.0 * base.g * over.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - over.g),
      base.b < 0.5 ? 2.0 * base.b * over.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - over.b)
    );
  }
  if (mode == 6) return 1.0 - (1.0 - base) * (1.0 - over);
  return max(base, over);
}

float linearMaskWeight(vec2 uv) {
  vec2 ab = uLinEnd - uLinStart;
  float len2 = dot(ab, ab);
  if (len2 < 1e-6) return 0.0;
  float t = clamp(dot(uv - uLinStart, ab) / len2, 0.0, 1.0);
  vec2 closest = uLinStart + ab * t;
  float perp = distance(uv, closest);
  float band = max(uLinFeather, 0.01);
  float along = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
  float cross = 1.0 - smoothstep(band * 0.35, band + 0.02, perp);
  return along * cross;
}

void main() {
  vec2 uv = vUv;
  vec3 rgb = sampleImg(uv);

  if (uHasLut == 1) {
    rgb = applyLutGrade(rgb);
  }

  // Anamorphic streaks
  if (uLongAmt > 0.5) {
    float ang = uLongDir * 0.0174533;
    vec2 dir = vec2(cos(ang), sin(ang));
    float dist = distance(uv, uLongCenter);
    float w = smoothstep(0.0, 0.55, dist) * (uLongAmt / 100.0);
    vec3 acc = rgb;
    float total = 1.0;
    for (int i = 1; i <= 8; i++) {
      float t = float(i) / 8.0;
      vec2 off = dir * t * 0.08 * w;
      acc += sampleImg(uv + off) + sampleImg(uv - off);
      total += 2.0;
    }
    rgb = mix(rgb, acc / total, clamp(w, 0.0, 1.0));
  }

  rgb *= pow(2.0, uExposure);
  rgb += vec3(uBrightness / 100.0);
  rgb = (rgb - 0.5) * (1.0 + uContrast / 100.0) + 0.5;

  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float hi = smoothstep(0.45, 0.95, luma);
  float sh = 1.0 - smoothstep(0.05, 0.55, luma);
  rgb += hi * (uHighlights / 100.0) * 0.35;
  rgb += sh * (uShadows / 100.0) * 0.35;

  rgb.r += uTemperature / 200.0;
  rgb.b -= uTemperature / 200.0;
  rgb.g += uTint / 250.0;

  vec3 hsv = rgb2hsv(clamp(rgb, 0.0, 1.0));
  hsv.x = fract(hsv.x + uHue / 360.0);
  float satMul = 1.0 + uSaturation / 100.0;
  float vib = uVibrance / 100.0;
  hsv.y = clamp(hsv.y * satMul + vib * (1.0 - hsv.y) * hsv.y, 0.0, 1.0);
  rgb = hsv2rgb(hsv);

  rgb = applyHslBands(rgb);

  if (uBw == 1) {
    float g = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = vec3(g);
  }

  if (uCurvesEnabled == 1) {
    float wr = evalCurve(rgb.r, uCurveW[0], uCurveW[1], uCurveW[2], uCurveW[3], uCurveW[4]);
    float wg = evalCurve(rgb.g, uCurveW[0], uCurveW[1], uCurveW[2], uCurveW[3], uCurveW[4]);
    float wb = evalCurve(rgb.b, uCurveW[0], uCurveW[1], uCurveW[2], uCurveW[3], uCurveW[4]);
    rgb = vec3(wr, wg, wb);
    rgb.r = evalCurve(rgb.r, uCurveR[0], uCurveR[1], uCurveR[2], uCurveR[3], uCurveR[4]);
    rgb.g = evalCurve(rgb.g, uCurveG[0], uCurveG[1], uCurveG[2], uCurveG[3], uCurveG[4]);
    rgb.b = evalCurve(rgb.b, uCurveB[0], uCurveB[1], uCurveB[2], uCurveB[3], uCurveB[4]);
  }

  if (abs(uDefinition) > 0.1) {
    vec2 px = 1.0 / uResolution;
    vec3 blur = (
      sampleImg(uv + vec2(px.x, 0.0)) +
      sampleImg(uv - vec2(px.x, 0.0)) +
      sampleImg(uv + vec2(0.0, px.y)) +
      sampleImg(uv - vec2(0.0, px.y))
    ) * 0.25;
    rgb = mix(rgb, rgb + (rgb - blur), uDefinition / 100.0);
  }

  if (uSharpen > 0.1) {
    vec2 px = 1.0 / uResolution;
    vec3 near = (
      sampleImg(uv + vec2(px.x, 0.0)) +
      sampleImg(uv - vec2(px.x, 0.0)) +
      sampleImg(uv + vec2(0.0, px.y)) +
      sampleImg(uv - vec2(0.0, px.y))
    ) * 0.25;
    rgb += (rgb - near) * (uSharpen / 50.0);
  }

  // Softness — smooth gaussian on graded result
  if (uSoftness > 0.5) {
    float radius = uSoftness * 0.35;
    vec3 soft = gaussianSoft(uv, radius);
    rgb = mix(rgb, soft, clamp(uSoftness / 100.0, 0.0, 0.95));
  }

  // Edge-aware denoise (not plain blur)
  if (uDenoiseL > 0.5) {
    rgb = edgeAwareDenoise(uv, rgb, uDenoiseL / 100.0, 0);
  }
  if (uDenoiseC > 0.5) {
    rgb = edgeAwareDenoise(uv, rgb, uDenoiseC / 100.0, 1);
  }

  float mask = 0.0;
  if (uLinMask == 1) {
    mask = max(mask, linearMaskWeight(uv));
  }
  if (uCircMask == 1) {
    float d = distance(uv, uCircCenter);
    mask = max(mask, 1.0 - smoothstep(uCircRadius * 0.65, uCircRadius, d));
  }
  if (mask > 0.001) {
    vec3 masked = rgb * pow(2.0, uMaskExposure / 50.0);
    vec3 mHsv = rgb2hsv(clamp(masked, 0.0, 1.0));
    mHsv.y = clamp(mHsv.y * (1.0 + uMaskSat / 100.0), 0.0, 1.0);
    masked = hsv2rgb(mHsv);
    rgb = mix(rgb, masked, mask);
  }

  // Bokeh — blur away from focus pin; wider aperture (lower f) = smaller sharp zone
  if (uBokehStrength > 0.001) {
    float focusR = 0.018 + (uBokehAperture - 1.4) * 0.014;
    float dist = distance(uv, uBokehCenter);
    float blurAmt = smoothstep(focusR * 0.55, focusR + 0.12, dist) * (uBokehStrength / 100.0);
    if (blurAmt > 0.005) {
      float radius = blurAmt * 6.0;
      vec3 blurred = gaussianSoft(uv, radius);
      rgb = mix(rgb, blurred, clamp(blurAmt, 0.0, 1.0));
    }
  }

  if (uHalStrength > 0.1) {
    float d = distance(uv, uHalCenter);
    float falloff = 1.0 - smoothstep(0.0, max(uHalRadius, 0.001), d);
    float srcLuma = dot(sampleImg(uv), vec3(0.299, 0.587, 0.114));
    float emit = smoothstep(0.55, 0.95, srcLuma) * falloff;
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float ang = float(i) * 1.047;
      vec2 off = vec2(cos(ang), sin(ang)) * uHalRadius * 0.35 * falloff;
      float gL = dot(sampleImg(uHalCenter + off), vec3(0.299, 0.587, 0.114));
      glow += uHalColor * smoothstep(0.5, 1.0, gL);
    }
    glow /= 6.0;
    float amt = (uHalStrength / 100.0) * emit;
    rgb = mix(rgb, clamp(rgb + glow * 0.85, 0.0, 1.0), amt);
    float receive = (1.0 - smoothstep(0.0, 0.55, luma)) * falloff * (uHalStrength / 100.0);
    rgb += uHalColor * glow * receive * 0.35;
  }

  if (uVigStrength > 0.1) {
    float v = distance(uv, vec2(0.5));
    float vig = smoothstep(uVigRadius, uVigRadius - uVigSoft - 0.001, v);
    rgb *= mix(1.0, vig, uVigStrength / 100.0);
  }

  if (uGrainAmount > 0.1) {
    float scale = max(uGrainSize, 0.5) * 0.55;
    vec2 gp = uv * uResolution * 0.35 / scale;
    float n = softNoise(gp);
    n = mix(n, softNoise(gp * 2.1 + 7.3), 0.35);
    n = mix(n, hash(floor(gp * 0.5)), uGrainRough * 0.25);
    float gLuma = dot(rgb, vec3(0.299, 0.587, 0.114));
    float response = mix(0.55, 1.0, gLuma) * mix(1.0, 0.65, abs(gLuma - 0.5) * 2.0);
    float grain = (n - 0.5) * (uGrainAmount / 100.0) * 0.18 * response;
    rgb += vec3(grain) + vec3(grain * 0.04, -grain * 0.02, grain * 0.03) * uGrainRough;
  }

  if (uDxEnabled == 1 && uHasBlend == 1) {
    vec2 bUv = clamp(uv + uDxOffset, 0.0, 1.0);
    vec4 blend = texture2D(uBlend, bUv);
    vec3 mixed = blendDx(rgb, blend.rgb, uDxBlend);
    rgb = mix(rgb, clamp(mixed, 0.0, 1.0), uDxOpacity * blend.a);
  }

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;
