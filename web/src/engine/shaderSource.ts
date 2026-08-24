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

uniform float uCurveY0;
uniform float uCurveY1;
uniform float uCurveY2;
uniform float uCurveY3;
uniform float uCurveY4;

uniform float uPerspV;
uniform float uPerspH;
uniform float uPerspRot;

uniform float uSharpen;
uniform float uDefinition;

uniform float uVigStrength;
uniform float uVigRadius;
uniform float uVigSoft;

uniform float uGrainAmount;
uniform float uGrainSize;

uniform float uHalStrength;
uniform float uHalRadius;
uniform vec3 uHalColor;
uniform vec2 uHalCenter;

uniform float uBokehStrength;
uniform float uBokehRadius;

uniform int uLinMask;
uniform float uLinStart;
uniform float uLinEnd;
uniform int uCircMask;
uniform float uCircRadius;
uniform float uMaskExposure;
uniform float uMaskSat;

uniform int uDxEnabled;
uniform float uDxOpacity;
uniform vec2 uDxOffset;
uniform int uDxBlend;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

float applyCurve(float x) {
  float t = clamp(x, 0.0, 1.0) * 4.0;
  float i = floor(t);
  float f = t - i;
  float y0 = i < 0.5 ? uCurveY0 : (i < 1.5 ? uCurveY1 : (i < 2.5 ? uCurveY2 : (i < 3.5 ? uCurveY3 : uCurveY4)));
  float y1 = i < 0.5 ? uCurveY1 : (i < 1.5 ? uCurveY2 : (i < 2.5 ? uCurveY3 : uCurveY4));
  if (i >= 3.5) return uCurveY4;
  return mix(y0, y1, f);
}

vec2 perspectiveUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float ang = uPerspRot * 0.015;
  float ca = cos(ang);
  float sa = sin(ang);
  p = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
  p.x += uPerspH * 0.004 * p.y * p.y;
  p.y += uPerspV * 0.004 * p.x * p.x;
  return p * 0.5 + 0.5;
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

void main() {
  vec2 uv = perspectiveUv(vUv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.04, 0.035, 0.03, 1.0);
    return;
  }

  vec4 tex = texture2D(uImage, uv);
  vec3 rgb = tex.rgb;

  // Soft bokeh-ish blur away from center
  if (uBokehStrength > 0.001) {
    float dist = distance(uv, vec2(0.5));
    float blurAmt = smoothstep(uBokehRadius * 0.4, uBokehRadius + 0.2, dist) * (uBokehStrength / 100.0);
    if (blurAmt > 0.01) {
      vec2 px = blurAmt * 3.0 / uResolution;
      vec3 acc = rgb;
      acc += texture2D(uImage, uv + vec2(px.x, 0.0)).rgb;
      acc += texture2D(uImage, uv - vec2(px.x, 0.0)).rgb;
      acc += texture2D(uImage, uv + vec2(0.0, px.y)).rgb;
      acc += texture2D(uImage, uv - vec2(0.0, px.y)).rgb;
      rgb = mix(rgb, acc / 5.0, clamp(blurAmt, 0.0, 1.0));
    }
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

  if (uBw == 1) {
    float g = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = vec3(g);
  }

  rgb.r = applyCurve(rgb.r);
  rgb.g = applyCurve(rgb.g);
  rgb.b = applyCurve(rgb.b);

  // Definition / local contrast
  if (abs(uDefinition) > 0.1) {
    vec2 px = 1.0 / uResolution;
    vec3 blur = (
      texture2D(uImage, uv + vec2(px.x, 0.0)).rgb +
      texture2D(uImage, uv - vec2(px.x, 0.0)).rgb +
      texture2D(uImage, uv + vec2(0.0, px.y)).rgb +
      texture2D(uImage, uv - vec2(0.0, px.y)).rgb
    ) * 0.25;
    rgb = mix(rgb, rgb + (rgb - blur), uDefinition / 100.0);
  }

  // Sharpen
  if (uSharpen > 0.1) {
    vec2 px = 1.0 / uResolution;
    vec3 near = (
      texture2D(uImage, uv + vec2(px.x, 0.0)).rgb +
      texture2D(uImage, uv - vec2(px.x, 0.0)).rgb +
      texture2D(uImage, uv + vec2(0.0, px.y)).rgb +
      texture2D(uImage, uv - vec2(0.0, px.y)).rgb
    ) * 0.25;
    rgb += (rgb - near) * (uSharpen / 50.0);
  }

  // Selective mask
  float mask = 1.0;
  if (uLinMask == 1) {
    float a = min(uLinStart, uLinEnd);
    float b = max(uLinStart, uLinEnd);
    mask *= smoothstep(a - 0.05, a + 0.05, uv.y) * (1.0 - smoothstep(b - 0.05, b + 0.05, uv.y));
  }
  if (uCircMask == 1) {
    mask *= 1.0 - smoothstep(uCircRadius * 0.7, uCircRadius, distance(uv, vec2(0.5)));
  }
  if (uLinMask == 1 || uCircMask == 1) {
    vec3 masked = rgb * pow(2.0, uMaskExposure / 50.0);
    vec3 mHsv = rgb2hsv(clamp(masked, 0.0, 1.0));
    mHsv.y = clamp(mHsv.y * (1.0 + uMaskSat / 100.0), 0.0, 1.0);
    masked = hsv2rgb(mHsv);
    rgb = mix(rgb, masked, mask);
  }

  // Positional halation (around plus center, not full frame)
  if (uHalStrength > 0.1) {
    float d = distance(uv, uHalCenter);
    float falloff = 1.0 - smoothstep(0.0, max(uHalRadius, 0.001), d);
    float srcLuma = dot(texture2D(uImage, uv).rgb, vec3(0.299, 0.587, 0.114));
    float emit = smoothstep(0.55, 0.95, srcLuma) * falloff;
    // Sample near center highlights for bleed
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float ang = float(i) * 1.047;
      vec2 off = vec2(cos(ang), sin(ang)) * uHalRadius * 0.35 * falloff;
      float gL = dot(texture2D(uImage, clamp(uHalCenter + off, 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
      glow += uHalColor * smoothstep(0.5, 1.0, gL);
    }
    glow /= 6.0;
    float amt = (uHalStrength / 100.0) * emit;
    rgb = mix(rgb, clamp(rgb + glow * 0.85, 0.0, 1.0), amt);
    // Dark pixels near the pin receive warm bleed
    float receive = (1.0 - smoothstep(0.0, 0.55, luma)) * falloff * (uHalStrength / 100.0);
    rgb += uHalColor * glow * receive * 0.35;
  }

  // Vignette
  if (uVigStrength > 0.1) {
    float v = distance(uv, vec2(0.5));
    float vig = smoothstep(uVigRadius, uVigRadius - uVigSoft - 0.001, v);
    rgb *= mix(1.0, vig, uVigStrength / 100.0);
  }

  // Grain
  if (uGrainAmount > 0.1) {
    float n = hash(floor(uv * uResolution / max(uGrainSize, 1.0)));
    rgb += (n - 0.5) * (uGrainAmount / 100.0) * 0.35;
  }

  // Double exposure
  if (uDxEnabled == 1 && uHasBlend == 1) {
    vec2 bUv = clamp(uv + uDxOffset, 0.0, 1.0);
    vec4 blend = texture2D(uBlend, bUv);
    vec3 mixed = blendDx(rgb, blend.rgb, uDxBlend);
    rgb = mix(rgb, clamp(mixed, 0.0, 1.0), uDxOpacity * blend.a);
  }

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;
