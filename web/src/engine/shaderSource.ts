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
uniform vec2 uSourceResolution;

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
uniform int uColorGrade; // 1 = apply hue/sat/vib/hsl path

uniform sampler2D uCurveAtlas;
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
uniform vec2 uVigCenter;

uniform float uGrainAmount;
uniform float uGrainSize;
uniform float uGrainRough;

uniform float uBokehStrength;
uniform float uBokehAperture;
uniform vec2 uBokehCenter;

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
uniform float uDxScale;
uniform int uDxBlend;

uniform sampler2D uLut;
uniform int uHasLut;
uniform float uLutSize;
uniform float uLutIntensity;
uniform float uLutColorOffset;
uniform float uLutToneOffset;
uniform int uLogToRec709;

uniform sampler2D uGradeTex;
uniform int uPass; // 0 = color grade to FBO, 1 = detail + film finish
uniform int uSampleGrade; // 1 = neighbor samples read graded FBO (pass 2)

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

float sampleCurve(float row, float x) {
  // Atlas rows: 0=white/master, 1=R, 2=G, 3=B. Size 256×4.
  // Sample texel centers so LINEAR filtering matches the baked LUT.
  float u = (clamp(x, 0.0, 1.0) * 255.0 + 0.5) / 256.0;
  float v = (row + 0.5) / 4.0;
  return texture2D(uCurveAtlas, vec2(u, v)).r;
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

vec3 sampleNeighbor(vec2 uv) {
  if (uSampleGrade == 1) {
    return texture2D(uGradeTex, clamp(uv, 0.0, 1.0)).rgb;
  }
  return sampleImg(uv);
}

vec3 gaussianSoft(vec2 uv, float radiusPx) {
  vec2 px = radiusPx / uSourceResolution;
  vec3 acc = vec3(0.0);
  float wSum = 0.0;
  for (int x = -4; x <= 4; x++) {
    for (int y = -4; y <= 4; y++) {
      float w = exp(-float(x * x + y * y) / 12.0);
      acc += sampleNeighbor(uv + vec2(float(x), float(y)) * px) * w;
      wSum += w;
    }
  }
  return acc / wSum;
}

// Dreamy soft focus: blur the graded image with a visible, capped strength curve.
vec3 applySoftness(vec2 uv, vec3 rgb) {
  if (uSoftness <= 0.01) return rgb;

  float t = uSoftness / 100.0;
  float amount = t * (2.0 - t);
  float minRes = min(uSourceResolution.x, uSourceResolution.y);
  float radiusPx = mix(4.0, minRes * 0.04, amount);

  vec3 blurred = gaussianSoft(uv, radiusPx);
  vec3 finer = gaussianSoft(uv, radiusPx * 0.5);
  vec3 blur = mix(blurred, finer, 0.35);

  rgb = mix(rgb, blur, amount * 0.88);

  if (amount > 0.2) {
    float pixL = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    float grain = (softNoise(uv * uSourceResolution * 0.5) - 0.5) * amount * 0.028;
    rgb += vec3(grain) * mix(0.4, 1.0, pixL);
  }

  return clamp(rgb, 0.0, 1.0);
}

vec3 edgeAwareDenoise(vec2 uv, vec3 center, float strength, int colorOnly) {
  if (strength <= 0.001) return center;
  vec2 px = 1.2 / uSourceResolution;
  vec3 acc = center;
  float wSum = 1.0;
  float cLuma = dot(center, vec3(0.2126, 0.7152, 0.0722));
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.785398;
    vec2 off = vec2(cos(ang), sin(ang)) * px * (1.0 + float(i) * 0.15);
    vec3 n = sampleNeighbor(uv + off);
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

float linearToRec709(float L) {
  L = max(L, 0.0);
  if (L < 0.018) return 4.5 * L;
  return 1.099 * pow(L, 0.45) - 0.099;
}

// S-Log3-shaped decode, then scale so 18% gray (code 420/1023) lands at 0.18 scene-linear.
// Without that scale, midtones decode near ~0.87 and the image looks blown out.
float genericLogToLinear(float x) {
  x = clamp(x, 0.0, 1.0);
  float y;
  if (x >= 171.2102946929 / 1023.0) {
    y = (pow(10.0, (x * 1023.0 - 420.0) / 261.5) - 0.037584) * 0.9;
  } else {
    y = (x * 1023.0 - 95.0) * 0.01125000 / (171.2102946929 - 95.0);
  }
  const float midLin = (1.0 - 0.037584) * 0.9;
  return y * (0.18 / midLin);
}

float softHighlight(float x) {
  // Preserve midtones; only compress above ~middle grey headroom.
  float knee = 0.5;
  if (x <= knee) return x;
  float t = x - knee;
  return knee + t / (1.0 + t * 1.1);
}

// Generic log → Rec.709: good enough for flat/log clips without cooking exposure.
vec3 logToRec709(vec3 logRgb) {
  vec3 lin = vec3(
    genericLogToLinear(logRgb.r),
    genericLogToLinear(logRgb.g),
    genericLogToLinear(logRgb.b)
  );
  // Phone / “generic” log often sits a touch hotter than true S-Log3 mid placement.
  lin *= 0.85;
  lin = vec3(softHighlight(lin.r), softHighlight(lin.g), softHighlight(lin.b));
  vec3 rec = vec3(
    linearToRec709(lin.r),
    linearToRec709(lin.g),
    linearToRec709(lin.b)
  );
  // Flat log looks desaturated after contrast returns — mild restore.
  float y = dot(rec, vec3(0.2126, 0.7152, 0.0722));
  rec = mix(vec3(y), rec, 1.1);
  return clamp(rec, 0.0, 1.0);
}

vec3 colorGrade(vec2 uv) {
  vec3 rgb = sampleImg(uv);

  if (uLogToRec709 == 1) {
    rgb = logToRec709(rgb);
  }

  if (uHasLut == 1) {
    rgb = applyLutGrade(rgb);
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

  if (uColorGrade == 1) {
    vec3 hsv = rgb2hsv(clamp(rgb, 0.0, 1.0));
    hsv.x = fract(hsv.x + uHue / 360.0);
    float satMul = 1.0 + uSaturation / 100.0;
    float vib = uVibrance / 100.0;
    hsv.y = clamp(hsv.y * satMul + vib * (1.0 - hsv.y) * hsv.y, 0.0, 1.0);
    rgb = hsv2rgb(hsv);
    rgb = applyHslBands(rgb);
  }

  if (uBw == 1) {
    float g = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = vec3(g);
  }

  if (uCurvesEnabled == 1) {
    vec3 c = clamp(rgb, 0.0, 1.0);
    c = vec3(sampleCurve(0.0, c.r), sampleCurve(0.0, c.g), sampleCurve(0.0, c.b));
    c = vec3(sampleCurve(1.0, c.r), sampleCurve(2.0, c.g), sampleCurve(3.0, c.b));
    rgb = clamp(c, 0.0, 1.0);
  }

  return clamp(rgb, 0.0, 1.0);
}

vec3 applyDetailEffects(vec2 uv, vec3 rgb) {
  if (abs(uDefinition) > 0.1) {
    vec2 px = 1.0 / uSourceResolution;
    vec3 blur = (
      sampleNeighbor(uv + vec2(px.x, 0.0)) +
      sampleNeighbor(uv - vec2(px.x, 0.0)) +
      sampleNeighbor(uv + vec2(0.0, px.y)) +
      sampleNeighbor(uv - vec2(0.0, px.y))
    ) * 0.25;
    rgb = mix(rgb, rgb + (rgb - blur), uDefinition / 100.0);
  }

  if (uSharpen > 0.1) {
    vec2 px = 1.0 / uSourceResolution;
    vec3 near = (
      sampleNeighbor(uv + vec2(px.x, 0.0)) +
      sampleNeighbor(uv - vec2(px.x, 0.0)) +
      sampleNeighbor(uv + vec2(0.0, px.y)) +
      sampleNeighbor(uv - vec2(0.0, px.y))
    ) * 0.25;
    rgb += (rgb - near) * (uSharpen / 50.0);
  }

  if (uSoftness > 0.01) {
    rgb = applySoftness(uv, rgb);
  }

  if (uDenoiseL > 0.5) {
    rgb = edgeAwareDenoise(uv, rgb, uDenoiseL / 100.0, 0);
  }
  if (uDenoiseC > 0.5) {
    rgb = edgeAwareDenoise(uv, rgb, uDenoiseC / 100.0, 1);
  }

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

  return clamp(rgb, 0.0, 1.0);
}

vec3 applyFilmEffects(vec2 uv, vec3 rgb) {
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

  if (uVigStrength > 0.1) {
    float v = distance(uv, uVigCenter);
    float vig = smoothstep(uVigRadius, uVigRadius - uVigSoft - 0.001, v);
    rgb *= mix(1.0, vig, uVigStrength / 100.0);
  }

  if (uGrainAmount > 0.1) {
    float scale = max(uGrainSize, 0.5) * 0.55;
    vec2 gp = uv * uSourceResolution * 0.35 / scale;
    float n = softNoise(gp);
    n = mix(n, softNoise(gp * 2.1 + 7.3), 0.35);
    n = mix(n, hash(floor(gp * 0.5)), uGrainRough * 0.25);
    float gLuma = dot(rgb, vec3(0.299, 0.587, 0.114));
    float response = mix(0.55, 1.0, gLuma) * mix(1.0, 0.65, abs(gLuma - 0.5) * 2.0);
    float grain = (n - 0.5) * (uGrainAmount / 100.0) * 0.18 * response;
    rgb += vec3(grain) + vec3(grain * 0.04, -grain * 0.02, grain * 0.03) * uGrainRough;
  }

  if (uDxEnabled == 1 && uHasBlend == 1) {
    float scale = max(uDxScale, 0.15);
    vec2 bUv = (uv - 0.5 - uDxOffset) / scale + 0.5;
    bUv = clamp(bUv, 0.0, 1.0);
    vec4 blend = texture2D(uBlend, bUv);
    vec3 mixed = blendDx(rgb, blend.rgb, uDxBlend);
    rgb = mix(rgb, clamp(mixed, 0.0, 1.0), uDxOpacity * blend.a);
  }

  return clamp(rgb, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;

  if (uPass == 0) {
    gl_FragColor = vec4(colorGrade(uv), 1.0);
    return;
  }

  vec3 rgb = uSampleGrade == 1
    ? texture2D(uGradeTex, clamp(uv, 0.0, 1.0)).rgb
    : colorGrade(uv);
  rgb = applyDetailEffects(uv, rgb);
  rgb = applyFilmEffects(uv, rgb);
  gl_FragColor = vec4(rgb, 1.0);
}
`;
