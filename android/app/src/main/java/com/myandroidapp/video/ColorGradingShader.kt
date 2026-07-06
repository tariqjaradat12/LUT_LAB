package com.myandroidapp.video

object ColorGradingShader {
    val IMAGE_VERTEX_SHADER = """
        uniform mat4 uMVPMatrix;
        attribute vec4 aPosition;
        attribute vec4 aTextureCoord;
        varying vec2 vTextureCoord;
        void main() {
            gl_Position = uMVPMatrix * aPosition;
            vTextureCoord = vec2(aTextureCoord.x, 1.0 - aTextureCoord.y);
        }
    """.trimIndent()

    val VIDEO_VERTEX_SHADER = """
        uniform mat4 uMVPMatrix;
        uniform mat4 uSTMatrix;
        attribute vec4 aPosition;
        attribute vec4 aTextureCoord;
        varying vec2 vTextureCoord;
        void main() {
            gl_Position = uMVPMatrix * aPosition;
            vTextureCoord = (uSTMatrix * aTextureCoord).xy;
        }
    """.trimIndent()

    fun getFragmentShader(isImage: Boolean): String {
        val extensionHeader = if (!isImage) "#extension GL_OES_EGL_image_external : require" else ""
        val samplerType = if (isImage) "sampler2D" else "samplerExternalOES"
        val sampleCall = "texColor = texture2D(sTexture, warpedCoord);"
        val isImageConst = if (isImage) "const int IS_IMAGE = 1;" else "const int IS_IMAGE = 0;"

        return """
            $extensionHeader
            precision mediump float;
            varying vec2 vTextureCoord;
            
            uniform $samplerType sTexture;
            $isImageConst

            // Core adjustments
            uniform float uExposure;
            uniform float uContrast;
            uniform float uSaturation;
            uniform float uGamma;
            uniform int uLogFormat;
            uniform float uBrightness;
            uniform float uHslAdjustments[24];

            // Advanced adjustments
            uniform sampler2D uCurvesTexture;
            uniform vec3 uShadowsColor;
            uniform vec3 uMidtonesColor;
            uniform vec3 uHighlightsColor;
            uniform float uShadowsLift;
            uniform float uMidtonesLift;
            uniform float uHighlightsLift;

            uniform float uTemperature;
            uniform float uTint;
            uniform float uHighlights;
            uniform float uShadows;
            uniform float uToneContrast;
            uniform float uVibrance;
            uniform float uHueRotation;

            // Vignette
            uniform float uVignetteStrength;
            uniform float uVignetteRadius;
            uniform float uVignetteSoftness;
            uniform vec2 uVignetteCenter;

            // Double exposure
            uniform int uDoubleExposureEnabled;
            uniform float uDoubleExposureOpacity;
            uniform vec2 uDoubleExposureOffset;
            uniform int uDoubleExposureBlend;
            uniform sampler2D sDoubleExposureTexture;

            // New overhauls adjustments
            uniform float uDehaze;
            uniform float uHdrStrength;
            uniform float uSharpen;
            uniform float uDefinition;
            uniform float uSoftness;
            uniform float uDenoiseLuminance;
            uniform float uDenoiseColor;
            uniform float uGrainAmount;
            uniform float uGrainSize;
            uniform float uGrainRoughness;
            uniform float uHalationStrength;
            uniform float uHalationRadius;
            uniform vec3 uHalationColor;
            uniform vec2 uHalationCenter;

            // Perspective tilt and warp
            uniform float uPerspectiveVertical;
            uniform float uPerspectiveHorizontal;
            uniform float uPerspectiveAspect;
            uniform float uPerspectiveRotate;

            // Bokeh uniforms
            uniform float uBokehStrength;
            uniform float uBokehRadius;
            uniform int uBokehShape; // 0=circle, 1=hexagon, 2=anamorphic
            uniform vec2 uBokehCenter;



            // Smear Trail uniforms
            uniform float uLongExposureAmount;
            uniform float uLongExposureDirection;
            uniform float uLongExposureThreshold;
            uniform vec2 uLongExposureCenter;

            // Structured data arrays
            uniform float uControlPoints[110];
            uniform int uNumControlPoints;
            uniform float uMasks[65];
            uniform int uNumMasks;
            uniform int uShowMaskOverlay;
            uniform int uActiveMaskIndex;

            // 3D LUT profiling
            uniform sampler2D sLutTexture;
            uniform float uLutIntensity;
            uniform float uLutSize;
            uniform float uLutColorOffset;
            uniform float uLutToneOffset;
            
            // Layout dimension helpers
            uniform vec2 uTexelSize;
            uniform sampler2D sBrushMaskTexture;
            uniform float uGrainSeed;

            // Crop & Zoom parameters
            uniform float uCropX;
            uniform float uCropY;
            uniform float uCropWidth;
            uniform float uCropHeight;
            uniform float uZoomScale;
            uniform float uZoomX;
            uniform float uZoomY;

            // Helper to convert individual channel from S-Log3 to Linear
            float slog3ToLinear(float val) {
                if (val >= 0.089686) {
                    return pow((val - 0.015636) / 1.022377, 1.0 / 0.2615);
                } else {
                    return (val - 0.092784) / 0.007291;
                }
            }

            // Helper to convert individual channel from Canon-Log to Linear
            float clogToLinear(float val) {
                float exponent = val / 1.0;
                return (pow(10.0, exponent) - 0.073059) / 0.529136;
            }

            // Helper to convert individual channel from DJI D-Log to Linear
            float dlogToLinear(float val) {
                float exponent = val / 1.4;
                return (pow(10.0, exponent) - 0.0075) / 0.58;
            }

            // Helper to convert individual channel from ARRI LogC3 to Linear
            float arrilogc3ToLinear(float val) {
                if (val >= 0.149658) {
                    return (pow(10.0, (val - 0.385537) / 0.2471896) * 0.076612) - 0.0093707;
                } else {
                    return (val - 0.092784) / 5.3707;
                }
            }

            // Helper to convert individual channel from ARRI LogC4 to Linear
            float arrilogc4ToLinear(float val) {
                float t = (val - 0.492615) / 0.263009;
                return (pow(10.0, t) - 0.018275) / 0.981725;
            }

            // Helper to convert individual channel from RED Log3G10 to Linear
            float redlog3g10ToLinear(float val) {
                return (pow(10.0, (val - 0.151703) / 0.224476) - 1.0) / 150.1977;
            }

            // Helper to convert individual channel from Fujifilm F-Log to Linear
            float flogToLinear(float val) {
                return pow(10.0, (val - 0.382) / 0.245) * 0.0766 - 0.0094;
            }

            // Helper to convert individual channel from Fujifilm F-Log2 to Linear
            float flog2ToLinear(float val) {
                return pow(10.0, (val - 0.382) / 0.240) * 0.0766 - 0.0093;
            }

            // Helper to convert individual channel from Panasonic V-Log to Linear
            float vlogToLinear(float val) {
                if (val >= 0.181) {
                    return pow(10.0, (val - 0.30) / 0.34) - 0.0075;
                } else {
                    return (val - 0.125) / 5.6;
                }
            }

            vec3 logToLinear(vec3 color) {
                vec3 rgb = color;
                if (uLogFormat == 1) {
                    rgb.r = slog3ToLinear(rgb.r);
                    rgb.g = slog3ToLinear(rgb.g);
                    rgb.b = slog3ToLinear(rgb.b);
                } else if (uLogFormat == 2) {
                    rgb.r = clogToLinear(rgb.r);
                    rgb.g = clogToLinear(rgb.g);
                    rgb.b = clogToLinear(rgb.b);
                } else if (uLogFormat == 3) {
                    rgb.r = dlogToLinear(rgb.r);
                    rgb.g = dlogToLinear(rgb.g);
                    rgb.b = dlogToLinear(rgb.b);
                } else if (uLogFormat == 4) {
                    rgb.r = arrilogc3ToLinear(rgb.r);
                    rgb.g = arrilogc3ToLinear(rgb.g);
                    rgb.b = arrilogc3ToLinear(rgb.b);
                } else if (uLogFormat == 5) {
                    rgb.r = arrilogc4ToLinear(rgb.r);
                    rgb.g = arrilogc4ToLinear(rgb.g);
                    rgb.b = arrilogc4ToLinear(rgb.b);
                } else if (uLogFormat == 6) {
                    rgb.r = redlog3g10ToLinear(rgb.r);
                    rgb.g = redlog3g10ToLinear(rgb.g);
                    rgb.b = redlog3g10ToLinear(rgb.b);
                } else if (uLogFormat == 7) {
                    rgb.r = flogToLinear(rgb.r);
                    rgb.g = flogToLinear(rgb.g);
                    rgb.b = flogToLinear(rgb.b);
                } else if (uLogFormat == 8) {
                    rgb.r = flog2ToLinear(rgb.r);
                    rgb.g = flog2ToLinear(rgb.g);
                    rgb.b = flog2ToLinear(rgb.b);
                } else if (uLogFormat == 9) {
                    rgb.r = vlogToLinear(rgb.r);
                    rgb.g = vlogToLinear(rgb.g);
                    rgb.b = vlogToLinear(rgb.b);
                }
                return rgb;
            }

            vec3 fastLogToLinear(vec3 c) {
                if (uLogFormat > 0) {
                    return pow(clamp(c, 0.0, 1.0), vec3(2.6));
                }
                return c;
            }

            vec3 rgbToHsl(vec3 c) {
                float maxVal = max(c.r, max(c.g, c.b));
                float minVal = min(c.r, min(c.g, c.b));
                float h = 0.0;
                float s = 0.0;
                float l = (maxVal + minVal) / 2.0;
                if (maxVal != minVal) {
                    float d = maxVal - minVal;
                    s = l > 0.5 ? d / (2.0 - maxVal - minVal) : d / (maxVal + minVal);
                    if (maxVal == c.r) {
                        h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
                    } else if (maxVal == c.g) {
                        h = (c.b - c.r) / d + 2.0;
                    } else {
                        h = (c.r - c.g) / d + 4.0;
                    }
                    h /= 6.0;
                }
                return vec3(h, s, l);
            }

            float hue2rgb(float p, float q, float t) {
                float tt = t;
                if (tt < 0.0) tt += 1.0;
                if (tt > 1.0) tt -= 1.0;
                if (tt < 1.0 / 6.0) return p + (q - p) * 6.0 * tt;
                if (tt < 1.0 / 2.0) return q;
                if (tt < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - tt) * 6.0;
                return p;
            }

            vec3 hslToRgb(vec3 hsl) {
                float h = hsl.x;
                float s = hsl.y;
                float l = hsl.z;
                if (s == 0.0) return vec3(l);
                float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
                float p = 2.0 * l - q;
                return vec3(
                    hue2rgb(p, q, h + 1.0 / 3.0),
                    hue2rgb(p, q, h),
                    hue2rgb(p, q, h - 1.0 / 3.0)
                );
            }

            float getBandWeight(float h, float center, float width) {
                float d = abs(h - center);
                if (d > 0.5) d = 1.0 - d;
                if (d >= width) return 0.0;
                return 0.5 + 0.5 * cos(d * 3.14159265 / width);
            }

            vec3 applyHslAdjustments(vec3 color, float hslAdj[24]) {
                vec3 hsl = rgbToHsl(color);
                
                float w0 = getBandWeight(hsl.x, 0.0, 60.0 / 360.0);       // Red
                float w1 = getBandWeight(hsl.x, 30.0 / 360.0, 45.0 / 360.0);  // Orange
                float w2 = getBandWeight(hsl.x, 60.0 / 360.0, 60.0 / 360.0);  // Yellow
                float w3 = getBandWeight(hsl.x, 120.0 / 360.0, 90.0 / 360.0); // Green
                float w4 = getBandWeight(hsl.x, 180.0 / 360.0, 80.0 / 360.0); // Aqua
                float w5 = getBandWeight(hsl.x, 240.0 / 360.0, 80.0 / 360.0); // Blue
                float w6 = getBandWeight(hsl.x, 290.0 / 360.0, 70.0 / 360.0); // Purple
                float w7 = getBandWeight(hsl.x, 330.0 / 360.0, 60.0 / 360.0); // Magenta

                float wSum = w0 + w1 + w2 + w3 + w4 + w5 + w6 + w7;
                if (wSum > 0.0) {
                    w0 /= wSum; w1 /= wSum; w2 /= wSum; w3 /= wSum;
                    w4 /= wSum; w5 /= wSum; w6 /= wSum; w7 /= wSum;
                } else {
                    w0 = 1.0;
                }

                float adjHue = w0 * hslAdj[0] + w1 * hslAdj[3] + w2 * hslAdj[6] + w3 * hslAdj[9] +
                               w4 * hslAdj[12] + w5 * hslAdj[15] + w6 * hslAdj[18] + w7 * hslAdj[21];
                float adjSat = w0 * hslAdj[1] + w1 * hslAdj[4] + w2 * hslAdj[7] + w3 * hslAdj[10] +
                               w4 * hslAdj[13] + w5 * hslAdj[16] + w6 * hslAdj[19] + w7 * hslAdj[22];
                float adjLum = w0 * hslAdj[2] + w1 * hslAdj[5] + w2 * hslAdj[8] + w3 * hslAdj[11] +
                               w4 * hslAdj[14] + w5 * hslAdj[17] + w6 * hslAdj[20] + w7 * hslAdj[23];

                float newH = fract(hsl.x + adjHue / 360.0);
                float newS = clamp(hsl.y + adjSat / 100.0, 0.0, 1.0);
                float newL = clamp(hsl.z + adjLum / 100.0, 0.0, 1.0);
                
                return hslToRgb(vec3(newH, newS, newL));
            }

            // Coordinates warp mapping with true 3D homogeneous coordinates division
            vec2 getPerspectiveWarpCoord(vec2 coord) {
                vec2 c = coord - vec2(0.5);
                float w = 1.0;
                
                if (uPerspectiveVertical != 0.0) {
                    float vFactor = (uPerspectiveVertical / 100.0) * 0.45;
                    w -= c.y * vFactor;
                }
                
                if (uPerspectiveHorizontal != 0.0) {
                    float hFactor = (uPerspectiveHorizontal / 100.0) * 0.45;
                    w -= c.x * hFactor;
                }
                
                c = c / w;
                
                if (uPerspectiveAspect != 0.0) {
                    float aFactor = 1.0 + (uPerspectiveAspect / 100.0) * 0.35;
                    c.y = c.y * aFactor;
                }
                
                if (uPerspectiveRotate != 0.0) {
                    float angle = (uPerspectiveRotate / 100.0) * (3.14159265 / 12.0);
                    float cosA = cos(angle);
                    float sinA = sin(angle);
                    vec2 r;
                    r.x = c.x * cosA - c.y * sinA;
                    r.y = c.x * sinA + c.y * cosA;
                    c = r;
                }
                
                return c + vec2(0.5);
            }

            vec2 getMappedCoord(vec2 coord) {
                vec2 c = coord;
                if (uZoomScale > 1.001) {
                    c = vec2(uZoomX, uZoomY) + (c - vec2(0.5)) / uZoomScale;
                }
                c = vec2(uCropX, uCropY) + c * vec2(uCropWidth, uCropHeight);
                return c;
            }

            // Standard sampler with out of bounds viewport check
            vec4 sampleTexture(vec2 coord) {
                vec2 mapped = getMappedCoord(coord);
                if (mapped.x < 0.0 || mapped.x > 1.0 || mapped.y < 0.0 || mapped.y > 1.0) {
                    return vec4(0.05, 0.05, 0.05, 1.0); // Sleek Lightroom background gray
                }
                return texture2D(sTexture, mapped);
            }

            // Detail convolution filters scaled for high density displays
            vec4 convolve(vec2 coord) {
                if (uSharpen == 0.0 && uSoftness == 0.0 && uDefinition == 0.0) {
                    return sampleTexture(coord);
                }

                vec2 offset = uTexelSize * 4.5;

                vec4 center = sampleTexture(coord);
                vec4 n = sampleTexture(coord + vec2(0.0, offset.y));
                vec4 s = sampleTexture(coord - vec2(0.0, offset.y));
                vec4 e = sampleTexture(coord + vec2(offset.x, 0.0));
                vec4 w = sampleTexture(coord - vec2(offset.x, 0.0));

                vec4 ne = sampleTexture(coord + vec2(offset.x, offset.y));
                vec4 nw = sampleTexture(coord + vec2(-offset.x, offset.y));
                vec4 se = sampleTexture(coord + vec2(offset.x, -offset.y));
                vec4 sw = sampleTexture(coord + vec2(-offset.x, -offset.y));

                vec4 result = center;

                if (uSharpen > 0.0) {
                    vec4 sharp = center * 5.0 - (n + s + e + w);
                    result = mix(result, sharp, uSharpen / 100.0 * 1.0);
                }

                if (uSoftness > 0.0) {
                    float sOffsetFactor = 1.0 + (uSoftness / 100.0) * 18.0;
                    vec2 sOffset = uTexelSize * sOffsetFactor;
                    vec4 blur = (
                        center * 4.0 +
                        sampleTexture(coord + vec2(0.0, sOffset.y)) * 2.0 +
                        sampleTexture(coord - vec2(0.0, sOffset.y)) * 2.0 +
                        sampleTexture(coord + vec2(sOffset.x, 0.0)) * 2.0 +
                        sampleTexture(coord - vec2(sOffset.x, 0.0)) * 2.0 +
                        sampleTexture(coord + vec2(sOffset.x, sOffset.y)) +
                        sampleTexture(coord + vec2(-sOffset.x, sOffset.y)) +
                        sampleTexture(coord + vec2(sOffset.x, -sOffset.y)) +
                        sampleTexture(coord + vec2(-sOffset.x, -sOffset.y))
                    ) / 16.0;
                    result = mix(result, blur, uSoftness / 100.0 * 0.90);
                }

                if (uDefinition > 0.0) {
                    vec4 blur = (center * 4.0 + (n + s + e + w) * 2.0 + (ne + nw + se + sw)) / 16.0;
                    vec4 diff = center - blur;
                    vec4 def = center + diff * 4.0;
                    result = mix(result, def, uDefinition / 100.0 * 0.85);
                }

                return clamp(result, 0.0, 1.0);
            }

            // High-quality non-periodic hash (zero trig, no short-period tiling)
            highp float hash(highp vec2 p) {
                highp float x = dot(p, vec2(127.1, 311.7));
                return fract(x * fract(x * 0.0123));
            }

            // Bilinear-smooth value noise for organic grain
            highp float smoothNoise(highp vec2 p) {
                highp vec2 i = floor(p);
                highp vec2 f = fract(p);
                highp vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                    u.y
                );
            }

            // Manual 3D LUT Lookup trilinear equation
            vec3 apply3dLut(vec3 color) {
                if (uLutSize <= 0.0) return color;
                
                vec3 c = clamp(color, 0.0, 1.0);
                float size = 33.0;
                float sizeMinusOne = 32.0;
                
                float blueVal = c.b * sizeMinusOne;
                float sliceLow = floor(blueVal);
                float sliceHigh = ceil(blueVal);
                float sliceFract = blueVal - sliceLow;
                
                float xLow = sliceLow * size + c.r * sizeMinusOne + 0.5;
                float yLow = c.g * sizeMinusOne + 0.5;
                vec2 uvLow = vec2(xLow / 1089.0, yLow / 33.0);
                
                float xHigh = sliceHigh * size + c.r * sizeMinusOne + 0.5;
                float yHigh = c.g * sizeMinusOne + 0.5;
                vec2 uvHigh = vec2(xHigh / 1089.0, yHigh / 33.0);
                
                vec3 lutColorLow = texture2D(sLutTexture, uvLow).rgb;
                vec3 lutColorHigh = texture2D(sLutTexture, uvHigh).rgb;
                vec3 lutColor = mix(lutColorLow, lutColorHigh, sliceFract);
                
                if (uLutToneOffset != 0.0) {
                    lutColor = clamp(lutColor * pow(2.0, uLutToneOffset / 100.0 * 1.5), 0.0, 1.0);
                }
                if (uLutColorOffset != 0.0) {
                    float shift = uLutColorOffset / 100.0 * 0.25;
                    lutColor.r = clamp(lutColor.r + shift, 0.0, 1.0);
                    lutColor.g = clamp(lutColor.g - shift * 0.5, 0.0, 1.0);
                    lutColor.b = clamp(lutColor.b - shift, 0.0, 1.0);
                }
                
                return mix(color, lutColor, uLutIntensity / 100.0);
            }

            vec3 applyDenoise(vec2 coord, vec3 centerRgb) {
                if (uDenoiseLuminance <= 0.0 && uDenoiseColor <= 0.0) {
                    return centerRgb;
                }

                float lumaCenter = dot(centerRgb, vec3(0.2126, 0.7152, 0.0722));
                
                float denoiseLumaFactor = uDenoiseLuminance / 100.0;
                float denoiseColorFactor = uDenoiseColor / 100.0;

                // Separate search offsets: narrow for high-frequency luma, wide for low-frequency chroma
                vec2 offsetLuma = uTexelSize * (1.0 + denoiseLumaFactor * 5.0);
                vec2 offsetChroma = uTexelSize * (2.0 + denoiseColorFactor * 16.0);

                float sumLuma = 0.0;
                float sumW_Luma = 0.0;
                
                vec3 sumColor = vec3(0.0);
                float sumW_Chroma = 0.0;

                // Bilateral weights setup: wider range limits to allow true noise averaging
                float sigmaRange = 0.05 + 0.75 * denoiseLumaFactor;
                float sigmaSpatial = 1.0 + denoiseLumaFactor * 2.0;
                float sigmaChroma = 1.0 + denoiseColorFactor * 2.0;

                // 3x3 loop
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        float fdx = float(dx);
                        float fdy = float(dy);
                        float distSq = fdx * fdx + fdy * fdy;
                        
                        // Luminance bilateral filter (immediate neighbors)
                        if (uDenoiseLuminance > 0.0) {
                            vec2 sampleCoordL = coord + vec2(fdx, fdy) * offsetLuma;
                            vec3 sampleRgbL = sampleTexture(sampleCoordL).rgb;
                            float lumaSample = dot(sampleRgbL, vec3(0.2126, 0.7152, 0.0722));
                            
                            float wSpatial = exp(-distSq / (2.0 * sigmaSpatial * sigmaSpatial));
                            float diffY = lumaSample - lumaCenter;
                            float wRange = exp(-(diffY * diffY) / (2.0 * sigmaRange * sigmaRange));
                            float wLuma = wSpatial * wRange;
                            
                            sumLuma += lumaSample * wLuma;
                            sumW_Luma += wLuma;
                        }
                        
                        // Chrominance blur (wider neighborhood)
                        if (uDenoiseColor > 0.0) {
                            vec2 sampleCoordC = coord + vec2(fdx, fdy) * offsetChroma;
                            vec3 sampleRgbC = sampleTexture(sampleCoordC).rgb;
                            
                            float wChroma = exp(-distSq / (2.0 * sigmaChroma * sigmaChroma));
                            
                            sumColor += sampleRgbC * wChroma;
                            sumW_Chroma += wChroma;
                        }
                    }
                }

                // Calculate filtered target components
                float targetLuma = lumaCenter;
                if (uDenoiseLuminance > 0.0 && sumW_Luma > 0.0) {
                    float finalLuma = sumLuma / sumW_Luma;
                    targetLuma = mix(lumaCenter, finalLuma, denoiseLumaFactor);
                }
                
                vec3 targetColor = centerRgb;
                if (uDenoiseColor > 0.0 && sumW_Chroma > 0.0) {
                    vec3 avgColor = sumColor / sumW_Chroma;
                    float avgLuma = dot(avgColor, vec3(0.2126, 0.7152, 0.0722));
                    if (avgLuma > 0.001) {
                        vec3 finalColor = avgColor * (lumaCenter / avgLuma);
                        targetColor = mix(centerRgb, finalColor, denoiseColorFactor);
                    }
                }

                // Combine denoised color and denoised luma
                vec3 denoisedResult = targetColor;
                float currentLuma = dot(targetColor, vec3(0.2126, 0.7152, 0.0722));
                if (currentLuma > 0.001) {
                    denoisedResult = targetColor * (targetLuma / currentLuma);
                }

                return clamp(denoisedResult, 0.0, 1.0);
            }

            void main() {
                vec2 warpedCoord = getPerspectiveWarpCoord(vTextureCoord);
                vec4 texColor = convolve(warpedCoord);
                vec3 denoisedLog = applyDenoise(warpedCoord, texColor.rgb);
                vec3 rgb = logToLinear(denoisedLog);
                
                // --- Aperture Bokeh highlights simulation (Done in Linear space) ---
                if (uBokehStrength > 0.0) {
                    float dist = distance(warpedCoord, uBokehCenter);
                    // Focus zone inner radius. Pixels OUTSIDE this get blurred.
                    float focusInner = uBokehRadius * 0.5;
                    float focusOuter = uBokehRadius;

                    // Blur weight: 0 inside focus, ramps to 1 beyond outer edge
                    float blurWeight = clamp((dist - focusInner) / max(focusOuter - focusInner, 0.001), 0.0, 1.0);
                    blurWeight = smoothstep(0.0, 1.0, blurWeight) * (uBokehStrength / 100.0);

                    if (blurWeight > 0.005) {
                        vec3 bokehAccum = vec3(0.0);
                        float totalWeight = 0.0;
                        vec2 bkOffset = uTexelSize * blurWeight * 80.0;

                        for (int rRing = 1; rRing <= 3; rRing++) {
                            float ringRadius = float(rRing) / 3.0;
                            for (int s = 0; s < 8; s++) {
                                // Add randomized jitter using uGrainSeed
                                float rnd = hash(warpedCoord * 73.1 + vec2(float(s), float(rRing)) * 13.9 + vec2(uGrainSeed));
                                float angle = float(s) * (2.0 * 3.14159265 / 8.0) + rnd * 6.28;
                                vec2 offset = vec2(cos(angle), sin(angle));

                                if (uBokehShape == 1) { // Hexagon
                                    float hexAngle = floor(angle * 6.0 / (2.0 * 3.14159265)) * (2.0 * 3.14159265 / 6.0);
                                    offset = vec2(cos(hexAngle), sin(hexAngle));
                                } else if (uBokehShape == 2) { // Anamorphic
                                    offset.x *= 2.5;
                                    offset.y *= 0.4;
                                }

                                vec3 sCol = sampleTexture(warpedCoord + offset * bkOffset * ringRadius).rgb;
                                vec3 linearSample = fastLogToLinear(sCol);
                                float lumaBk = dot(linearSample, vec3(0.2126, 0.7152, 0.0722));
                                // Boost bright highlights to create classic bokeh glow
                                float highlightBoost = smoothstep(0.55, 0.85, lumaBk) * 3.0 * (uBokehStrength / 100.0);
                                vec3 boostColor = linearSample * (1.0 + highlightBoost);

                                bokehAccum += boostColor;
                                totalWeight += 1.0;
                            }
                        }

                        vec3 bokehColor = bokehAccum / max(totalWeight, 0.01);
                        rgb = mix(rgb, bokehColor, blurWeight);
                    }
                }

                // --- Long Exposure Simulation (iPhone-style light trails in Linear space) ---
                if (uLongExposureAmount > 0.0) {
                    float leStrength = uLongExposureAmount / 100.0;
                    float dirFactor = uLongExposureDirection / 100.0;
                    vec3 trailAccum = vec3(0.0);
                    float trailWeightTotal = 0.0;

                    if (abs(dirFactor) < 0.01) {
                        // RADIAL mode: light sources bleed outward (iPhone night/star trails)
                        vec2 toCenter = uLongExposureCenter - warpedCoord;
                        float cDist = length(toCenter);
                        if (cDist > 0.005) {
                            vec2 trailDir = toCenter / cDist;
                            float trailLen = leStrength * 0.3;
                            for (int t = 1; t <= 12; t++) {
                                float frac = float(t) / 12.0;
                                float fade = 1.0 - frac * 0.75;
                                vec2 sPos = clamp(warpedCoord + trailDir * trailLen * frac, vec2(0.001), vec2(0.999));
                                vec3 sCol = sampleTexture(sPos).rgb;
                                vec3 linearSample = fastLogToLinear(sCol);
                                if (dot(linearSample, vec3(0.2126, 0.7152, 0.0722)) > uLongExposureThreshold) {
                                    trailAccum += linearSample * fade;
                                    trailWeightTotal += fade;
                                }
                            }
                        }
                    } else {
                        // DIRECTIONAL mode: angle-based continuous light streaks
                        float angle = dirFactor * 3.14159265;
                        vec2 dirVec = vec2(cos(angle), sin(angle));
                        vec2 stepVec = dirVec * uTexelSize * leStrength * 8.0;
                        for (int t = 1; t <= 12; t++) {
                            float fade = 1.0 - float(t) / 13.0;
                            vec2 sPos = clamp(warpedCoord - stepVec * float(t), vec2(0.001), vec2(0.999));
                            vec3 sCol = sampleTexture(sPos).rgb;
                            vec3 linearSample = fastLogToLinear(sCol);
                            if (dot(linearSample, vec3(0.2126, 0.7152, 0.0722)) > uLongExposureThreshold) {
                                trailAccum += linearSample * fade;
                                trailWeightTotal += fade;
                            }
                        }
                    }

                    if (trailWeightTotal > 0.001) {
                        vec3 avgTrail = trailAccum / trailWeightTotal;
                        rgb = mix(rgb, max(rgb, avgTrail), leStrength);
                    }
                }

                // 1. Convert Flat Log Space to Linear Space (Already done at main entry!)

                // 2. Lightroom Selective Masking
                for (int i = 0; i < 5; i++) {
                    if (i >= uNumMasks) break;
                    int idx = i * 13;
                    float mType = uMasks[idx];
                    float mEnabled = uMasks[idx + 1];
                    float mInverted = uMasks[idx + 2];
                    float mX1 = uMasks[idx + 3];
                    float mY1 = uMasks[idx + 4];
                    float mX2 = uMasks[idx + 5];
                    float mY2 = uMasks[idx + 6];
                    float mFeather = uMasks[idx + 7];
                    float mExposure = uMasks[idx + 8];
                    float mContrast = uMasks[idx + 9];
                    float mSaturation = uMasks[idx + 10];
                    float mTemperature = uMasks[idx + 11];
                    float mIntensity = uMasks[idx + 12];

                    if (mEnabled > 0.5) {
                        float weight = 0.0;
                        if (mType < 0.5) { // Linear Gradient
                            vec2 v = vec2(mX2 - mX1, mY2 - mY1);
                            float len = length(v);
                            if (len > 0.001) {
                                vec2 n = v / len;
                                vec2 p = warpedCoord - vec2(mX1, mY1);
                                float d = dot(p, n);
                                float t = d / len;
                                float startFade = 0.5 - mFeather * 0.5;
                                float endFade = 0.5 + mFeather * 0.5;
                                weight = 1.0 - clamp((t - startFade) / max(mFeather, 0.001), 0.0, 1.0);
                                weight = smoothstep(0.0, 1.0, weight);
                            }
                        } else if (mType < 1.5) { // Radial Gradient
                            float dist = distance(warpedCoord, vec2(mX1, mY1));
                            weight = 1.0 - clamp((dist - mX2) / max(mY2 - mX2, 0.001), 0.0, 1.0);
                            weight = smoothstep(0.0, 1.0, weight);
                        } else { // Brush Mask
                            weight = texture2D(sBrushMaskTexture, getMappedCoord(warpedCoord)).a;
                        }

                        if (mInverted > 0.5) {
                            weight = 1.0 - weight;
                        }

                        weight = weight * mIntensity;

                        if (weight > 0.001) {
                            vec3 adjRgb = rgb;
                            
                            // Exposure
                            adjRgb *= pow(2.0, mExposure);
                            
                            // Contrast
                            adjRgb = (adjRgb - vec3(0.5)) * (1.0 + mContrast / 100.0) + vec3(0.5);
                            
                            // Saturation
                            float mLuma = 0.2126 * adjRgb.r + 0.7152 * adjRgb.g + 0.0722 * adjRgb.b;
                            adjRgb = mix(vec3(mLuma), adjRgb, 1.0 + mSaturation / 100.0);
                            
                            // Temperature
                            float mTempShift = (mTemperature / 100.0) * 0.15;
                            adjRgb.r += mTempShift;
                            adjRgb.b -= mTempShift;

                            // Apply adjustments
                            rgb = mix(rgb, adjRgb, weight);

                            // Optional active mask visualization overlay
                            if (uShowMaskOverlay == 1 && i == uActiveMaskIndex) {
                                vec3 overlayColor = vec3(0.96, 0.25, 0.37);
                                rgb = mix(rgb, overlayColor, weight * 0.45);
                            }
                        }
                    }
                }

                // 3. Regional Control Points (Nik U-Point)
                for (int i = 0; i < 10; i++) {
                    if (i >= uNumControlPoints) break;
                    int idx = i * 11;
                    float cpX = uControlPoints[idx];
                    float cpY = uControlPoints[idx + 1];
                    float cpRadius = uControlPoints[idx + 2];
                    float cpBrightness = uControlPoints[idx + 3];
                    float cpContrast = uControlPoints[idx + 4];
                    float cpStructure = uControlPoints[idx + 5];
                    float cpSaturation = uControlPoints[idx + 6];
                    float cpTemperature = uControlPoints[idx + 7];

                    float dist = distance(warpedCoord, vec2(cpX, cpY));
                    if (dist < cpRadius) {
                        float spatialWeight = 1.0 - (dist / cpRadius);
                        spatialWeight = smoothstep(0.0, 1.0, spatialWeight);

                        // Read pre-sampled target color from uniform
                        vec3 targetColor = vec3(uControlPoints[idx + 8], uControlPoints[idx + 9], uControlPoints[idx + 10]);

                        // Color similarity selectivity weight
                        float colorDist = distance(rgb, targetColor);
                        float similarityWeight = clamp(1.0 - colorDist / 0.5, 0.0, 1.0);
                        similarityWeight = smoothstep(0.0, 1.0, similarityWeight);

                        float combinedWeight = spatialWeight * similarityWeight;

                        if (combinedWeight > 0.001) {
                            vec3 adjRgb = rgb;
                            
                            // Brightness
                            adjRgb *= pow(2.0, cpBrightness / 100.0);
                            
                            // Contrast
                            adjRgb = (adjRgb - vec3(0.5)) * (1.0 + cpContrast / 100.0) + vec3(0.5);
                            
                            // Saturation
                            float cpL = 0.2126 * adjRgb.r + 0.7152 * adjRgb.g + 0.0722 * adjRgb.b;
                            adjRgb = mix(vec3(cpL), adjRgb, 1.0 + cpSaturation / 100.0);
                            
                            // Temperature
                            float cpTempShift = (cpTemperature / 100.0) * 0.15;
                            adjRgb.r += cpTempShift;
                            adjRgb.b -= cpTempShift;

                            // Structure (local high-pass sharpening)
                            if (cpStructure != 0.0) {
                                vec2 offset = uTexelSize * 2.5;
                                vec4 cNeigh = sampleTexture(warpedCoord);
                                vec4 nNeigh = sampleTexture(warpedCoord + vec2(0.0, offset.y));
                                vec4 sNeigh = sampleTexture(warpedCoord - vec2(0.0, offset.y));
                                vec4 eNeigh = sampleTexture(warpedCoord + vec2(offset.x, 0.0));
                                vec4 wNeigh = sampleTexture(warpedCoord - vec2(offset.x, 0.0));
                                vec4 sharpColor = cNeigh * 5.0 - (nNeigh + sNeigh + eNeigh + wNeigh);
                                adjRgb = mix(adjRgb, clamp(sharpColor.rgb, 0.0, 1.0), cpStructure / 100.0 * 0.45);
                            }

                            rgb = mix(rgb, adjRgb, combinedWeight);
                        }
                    }
                }

                // 4. Exposure (stops scale)
                float expFactor = pow(2.0, uExposure);
                rgb *= expFactor;

                // Brightness lift
                rgb += vec3(uBrightness / 100.0);

                // 5. Contrast (pivot around 0.5)
                rgb = (rgb - 0.5) * uContrast + 0.5;

                // 6. Highlights & Shadows (luma weighted)
                float luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
                float hlWeight = pow(clamp(luma, 0.0, 1.0), 2.0);
                float shWeight = pow(1.0 - clamp(luma, 0.0, 1.0), 2.0);
                float hlShift = (uHighlights / 100.0) * 0.5;
                float shShift = (uShadows / 100.0) * 0.5;
                rgb += hlShift * hlWeight + shShift * shWeight;

                // 7. Tone Contrast (midpoint S-curve)
                // Positive: boosts contrast (darks darker, lights lighter)
                // Negative: reduces contrast (darks lighter, lights darker)
                if (uToneContrast != 0.0) {
                    float tc = uToneContrast / 100.0;
                    // Apply S-curve: positive tc increases contrast, negative reduces it
                    // For each channel: pixels below 0.5 move toward 0 (or 0.5), above 0.5 move toward 1 (or 0.5)
                    float strength = abs(tc) * 0.5;
                    float sign = tc > 0.0 ? 1.0 : -1.0;
                    
                    if (rgb.r < 0.5) {
                        rgb.r = rgb.r - sign * strength * pow(1.0 - 2.0 * rgb.r, 2.0);
                    } else {
                        rgb.r = rgb.r + sign * strength * pow(2.0 * rgb.r - 1.0, 2.0);
                    }
                    
                    if (rgb.g < 0.5) {
                        rgb.g = rgb.g - sign * strength * pow(1.0 - 2.0 * rgb.g, 2.0);
                    } else {
                        rgb.g = rgb.g + sign * strength * pow(2.0 * rgb.g - 1.0, 2.0);
                    }
                    
                    if (rgb.b < 0.5) {
                        rgb.b = rgb.b - sign * strength * pow(1.0 - 2.0 * rgb.b, 2.0);
                    } else {
                        rgb.b = rgb.b + sign * strength * pow(2.0 * rgb.b - 1.0, 2.0);
                    }
                }

                // 8. Color Temperature & Tint
                float tempShift = (uTemperature / 100.0) * 0.15;
                float tintShift = (uTint / 100.0) * 0.1;
                rgb.r += tempShift;
                rgb.g -= tintShift;
                rgb.b -= tempShift;

                // 9. Saturation
                float satLuma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
                rgb = satLuma + (rgb - satLuma) * uSaturation;

                // 10. Vibrance (smart saturation - boosts muted colors more than already-saturated ones)
                if (uVibrance != 0.0) {
                    vec3 vibHsl = rgbToHsl(clamp(rgb, 0.0, 1.0));
                    float strength = clamp(uVibrance / 100.0, -1.0, 1.0);
                    float mutedMask = pow(1.0 - vibHsl.y, 1.35);
                    float hueDist = min(abs(vibHsl.x - 0.08), 1.0 - abs(vibHsl.x - 0.08));
                    float skinGuard = smoothstep(0.03, 0.16, hueDist);
                    if (strength > 0.0) {
                        float boost = strength * mutedMask * mix(0.45, 1.0, skinGuard);
                        vibHsl.y = clamp(vibHsl.y + boost * (1.0 - vibHsl.y), 0.0, 1.0);
                    } else {
                        vibHsl.y = clamp(vibHsl.y * (1.0 + strength * (0.35 + 0.65 * mutedMask)), 0.0, 1.0);
                    }
                    rgb = hslToRgb(vibHsl);
                }

                // 10b. Hue Rotation (global)
                if (uHueRotation != 0.0) {
                    // Convert RGB -> HSL, shift hue, convert back
                    float maxH = max(rgb.r, max(rgb.g, rgb.b));
                    float minH = min(rgb.r, min(rgb.g, rgb.b));
                    float delta = maxH - minH;
                    float hh = 0.0;
                    float ss = 0.0;
                    float ll = (maxH + minH) * 0.5;
                    if (delta > 0.0001) {
                        ss = delta / (1.0 - abs(2.0 * ll - 1.0));
                        if (maxH == rgb.r) {
                            hh = mod((rgb.g - rgb.b) / delta, 6.0) / 6.0;
                        } else if (maxH == rgb.g) {
                            hh = ((rgb.b - rgb.r) / delta + 2.0) / 6.0;
                        } else {
                            hh = ((rgb.r - rgb.g) / delta + 4.0) / 6.0;
                        }
                        hh = fract(hh + uHueRotation / 360.0);
                        // HSL -> RGB
                        float cc = (1.0 - abs(2.0 * ll - 1.0)) * ss;
                        float xv = cc * (1.0 - abs(mod(hh * 6.0, 2.0) - 1.0));
                        float mm = ll - cc * 0.5;
                        float ri = 0.0, gi = 0.0, bi = 0.0;
                        float hSec = hh * 6.0;
                        if (hSec < 1.0)      { ri = cc; gi = xv; bi = 0.0; }
                        else if (hSec < 2.0) { ri = xv; gi = cc; bi = 0.0; }
                        else if (hSec < 3.0) { ri = 0.0; gi = cc; bi = xv; }
                        else if (hSec < 4.0) { ri = 0.0; gi = xv; bi = cc; }
                        else if (hSec < 5.0) { ri = xv; gi = 0.0; bi = cc; }
                        else                 { ri = cc; gi = 0.0; bi = xv; }
                        rgb = clamp(vec3(ri + mm, gi + mm, bi + mm), 0.0, 1.0);
                    }
                }

                // 11. Curves Lookup (RGBA: R=Master, G=R, B=G, A=B curves)
                float cr = clamp(rgb.r, 0.0, 1.0);
                float cg = clamp(rgb.g, 0.0, 1.0);
                float cb = clamp(rgb.b, 0.0, 1.0);

                float mr = texture2D(uCurvesTexture, vec2(cr, 0.5)).r;
                float mg = texture2D(uCurvesTexture, vec2(cg, 0.5)).r;
                float mb = texture2D(uCurvesTexture, vec2(cb, 0.5)).r;

                rgb.r = texture2D(uCurvesTexture, vec2(mr, 0.5)).g;
                rgb.g = texture2D(uCurvesTexture, vec2(mg, 0.5)).b;
                rgb.b = texture2D(uCurvesTexture, vec2(mb, 0.5)).a;

                // HSL Adjustments
                rgb = applyHslAdjustments(rgb, uHslAdjustments);

                // 12. Color Wheels (3-way)
                float lumaGrad = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
                float shadowWGrad = pow(clamp(1.0 - lumaGrad, 0.0, 1.0), 2.0);
                float highlightWGrad = pow(clamp(lumaGrad, 0.0, 1.0), 2.0);
                float midWGrad = clamp(1.0 - abs(lumaGrad - 0.5) * 2.0, 0.0, 1.0);

                rgb += uShadowsColor * shadowWGrad + vec3(uShadowsLift * shadowWGrad);
                rgb += uMidtonesColor * midWGrad + vec3(uMidtonesLift * midWGrad);
                rgb += uHighlightsColor * highlightWGrad + vec3(uHighlightsLift * highlightWGrad);
                rgb = clamp(rgb, 0.0, 1.0);

                // 13. Custom 3D LUT Profiles Lookup
                rgb = apply3dLut(rgb);

                // 14. Dehaze
                if (uDehaze != 0.0) {
                    float dehFactor = uDehaze / 100.0;
                    vec3 dehAdjusted = (rgb - vec3(0.05)) / 0.9;
                    rgb = clamp(mix(rgb, dehAdjusted, dehFactor), 0.0, 1.0);
                }

                // 15. Premium HDR Boost with Shadow Lift and Highlight Recovery S-Curve
                if (uHdrStrength > 0.0) {
                    float hdrFactor = uHdrStrength / 100.0;
                    float l = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
                    
                    float shadowW = pow(1.0 - l, 2.0);
                    vec3 shadowBoost = rgb + vec3(0.35 * hdrFactor * shadowW);
                    
                    float highlightW = pow(l, 2.0);
                    vec3 highlightCompress = rgb / (vec3(1.0) + vec3(0.5 * hdrFactor * highlightW));
                    
                    vec3 hdrColor = mix(shadowBoost, highlightCompress, l);
                    float tc = 0.3 * hdrFactor;
                    vec3 detailed = (hdrColor - vec3(0.5)) * (1.0 + tc) + vec3(0.5);
                    hdrColor = clamp(detailed, 0.0, 1.0);
                    
                    rgb = mix(rgb, hdrColor, hdrFactor);
                }

                // 16. Vignette
                if (uVignetteStrength != 0.0) {
                    float dist = distance(warpedCoord, uVignetteCenter);
                    float ratio = dist / uVignetteRadius;
                    float soft = clamp((1.0 - ratio) / max(uVignetteSoftness, 0.01), 0.0, 1.0);
                    float t = mix(1.0, soft, clamp(abs(uVignetteStrength) / 100.0, 0.0, 1.0));
                    if (uVignetteStrength < 0.0) {
                        rgb *= t;
                    } else {
                        rgb = mix(rgb, vec3(1.0), (1.0 - t));
                    }
                }

                // 17. Double Exposure Blending
                if (uDoubleExposureEnabled == 1) {
                    vec2 blendCoord = warpedCoord + uDoubleExposureOffset;
                    if (blendCoord.x >= 0.0 && blendCoord.x <= 1.0 && blendCoord.y >= 0.0 && blendCoord.y <= 1.0) {
                        vec4 blendColor = texture2D(sDoubleExposureTexture, blendCoord);
                        vec3 blendedColor = rgb;
                        if (uDoubleExposureBlend == 0) { // Screen
                            blendedColor = 1.0 - (1.0 - rgb) * (1.0 - blendColor.rgb);
                        } else if (uDoubleExposureBlend == 1) { // Multiply
                            blendedColor = rgb * blendColor.rgb;
                        } else if (uDoubleExposureBlend == 2) { // Overlay
                            blendedColor.r = rgb.r < 0.5 ? 2.0 * rgb.r * blendColor.r : 1.0 - 2.0 * (1.0 - rgb.r) * (1.0 - blendColor.r);
                            blendedColor.g = rgb.g < 0.5 ? 2.0 * rgb.g * blendColor.g : 1.0 - 2.0 * (1.0 - rgb.g) * (1.0 - blendColor.g);
                            blendedColor.b = rgb.b < 0.5 ? 2.0 * rgb.b * blendColor.b : 1.0 - 2.0 * (1.0 - rgb.b) * (1.0 - blendColor.b);
                        } else if (uDoubleExposureBlend == 3) { // Lighten
                            blendedColor = max(rgb, blendColor.rgb);
                        }
                        rgb = mix(rgb, blendedColor, uDoubleExposureOpacity * blendColor.a);
                    }
                }

                // 18. Cinematic Film Halation
                // Bright areas emit a warm glow into darker surroundings (Vivo/film camera style).
                if (uHalationStrength > 0.0) {
                    float strength = uHalationStrength / 100.0;
                    vec2 spread = uTexelSize * uHalationRadius * 120.0;

                    vec3 haloGlow = vec3(0.0);
                    for (int hs = 0; hs < 8; hs++) {
                        float ang = float(hs) * 0.7854;
                        vec2 sOff = vec2(cos(ang), sin(ang)) * spread;
                        vec3 sCol = sampleTexture(warpedCoord + sOff).rgb;
                        float sLuma = dot(sCol, vec3(0.2126, 0.7152, 0.0722));
                        // Lower threshold (0.2) catches highlights even in log-encoded footage
                        float emission = smoothstep(0.2, 0.75, sLuma);
                        haloGlow += sCol * emission;
                    }
                    haloGlow /= 8.0;

                    // Tint and amplify the glow
                    haloGlow *= uHalationColor * 5.0;

                    // Dark pixels near highlights receive more glow
                    float myLuma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
                    float receiveW = 1.0 - smoothstep(0.0, 0.9, myLuma);

                    rgb = clamp(rgb + haloGlow * strength * receiveW, 0.0, 1.0);
                }

                // 19. Aperture Bokeh highlights simulation
                // Bokeh and Smear Trail logic has been moved to run on raw texture coordinates before color grading.

                // 22. Film Grain — Lightroom-style smooth organic grain
                if (uGrainAmount > 0.0) {
                    vec2 photoCoord = getMappedCoord(warpedCoord);
                    // Only apply grain inside the actual photo boundary (not on the background/letterbox)
                    if (photoCoord.x >= 0.0 && photoCoord.x <= 1.0 && photoCoord.y >= 0.0 && photoCoord.y <= 1.0) {
                        // Scale: smaller uGrainSize → finer grain
                        float gScale = 500.0 / max(uGrainSize, 0.5);
                        vec2 gc = photoCoord * gScale + vec2(uGrainSeed, -uGrainSeed * 1.618);

                        // Pre-rotated coordinates using golden ratio angles (about 35.4 and 70.7 degrees)
                        // This completely destroys the horizontal/vertical grid lines of value noise.
                        vec2 gcRot = vec2(gc.x * 0.81507 - gc.y * 0.57936, gc.x * 0.57936 + gc.y * 0.81507);
                        vec2 gcRot2 = vec2(gc.x * 0.33075 - gc.y * 0.94372, gc.x * 0.94372 + gc.y * 0.33075);

                        // Three-octave smooth noise with rotations to destroy grid/square patterns
                        float n1 = smoothNoise(gc);
                        float n2 = smoothNoise(gcRot * 2.07 + vec2(17.3, 41.9));
                        float n3 = smoothNoise(gcRot2 * 4.15 + vec2(-7.3, 29.1));
                        
                        float n = n1 * 0.50 + n2 * 0.32 + n3 * 0.18;
                        n = n * 2.0 - 1.0; // centre at 0, range [-1, 1]

                        // Roughness controls grain 'pop': high roughness = harsher, high-contrast grain
                        float rough = max(uGrainRoughness, 0.01);
                        n = sign(n) * pow(abs(n), 1.0 / (rough * 1.8 + 0.4));

                        // Lightroom-style midtone/shadow-weighted distribution
                        // Grain is zero in pure black/white, peak in midtones, and drops in highlights
                        float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
                        float grainWeight = sqrt(luma) * (1.0 - luma) * 2.0;

                        float grainStr = (uGrainAmount / 100.0) * grainWeight * 0.25;
                        // Pegtop Soft Light Blend Mode composite to preserve exposure and contrast
                        rgb = clamp(rgb + vec3(n) * grainStr * rgb * (1.0 - rgb) * 4.0, 0.0, 1.0);
                    }
                }

                gl_FragColor = vec4(rgb, 1.0);
            }
        """.trimIndent()
    }
}
