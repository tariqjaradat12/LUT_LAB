#include <metal_stdlib>
using namespace metal;

struct VertexIn {
    float4 position [[attribute(0)]];
    float2 texCoords [[attribute(1)]];
};

struct VertexOut {
    float4 position [[position]];
    float2 texCoords;
};

struct GradingParams {
    float exposure;
    float contrast;
    float saturation;
    float gamma;
    int logFormat; // 0=Rec709, 1=S-Log3, 2=C-Log, 3=D-Log
};

vertex VertexOut colorGradingVertex(uint vid [[vertex_id]],
                                    constant float2* position [[buffer(0)]],
                                    constant float2* texCoords [[buffer(1)]]) {
    VertexOut out;
    out.position = float4(position[vid], 0.0, 1.0);
    out.texCoords = texCoords[vid];
    return out;
}

// S-Log3 conversion logic
float slog3ToLinear(float val) {
    if (val >= 0.089686) {
        return pow((val - 0.015636) / 1.022377, 1.0 / 0.2615);
    } else {
        return (val - 0.092784) / 0.007291;
    }
}

// Canon Log conversion logic
float clogToLinear(float val) {
    return (pow(10.0, val) - 0.073059) / 0.529136;
}

// DJI D-Log conversion logic
float dlogToLinear(float val) {
    return (pow(10.0, val / 1.4) - 0.0075) / 0.58;
}

fragment float4 colorGradingFragment(VertexOut in [[stage_in]],
                                     texture2d<float, access::sample> tex [[texture(0)]],
                                     sampler smp [[sampler(0)]],
                                     constant GradingParams& params [[buffer(0)]]) {
    float4 color = tex.sample(smp, in.texCoords);
    float3 rgb = color.rgb;

    // 1. Convert Flat Log Space to Linear Space
    if (params.logFormat == 1) { // S-Log3
        rgb.r = slog3ToLinear(rgb.r);
        rgb.g = slog3ToLinear(rgb.g);
        rgb.b = slog3ToLinear(rgb.b);
    } else if (params.logFormat == 2) { // C-Log
        rgb.r = clogToLinear(rgb.r);
        rgb.g = clogToLinear(rgb.g);
        rgb.b = clogToLinear(rgb.b);
    } else if (params.logFormat == 3) { // D-Log
        rgb.r = dlogToLinear(rgb.r);
        rgb.g = dlogToLinear(rgb.g);
        rgb.b = dlogToLinear(rgb.b);
    }

    // 2. Exposure adjustment
    rgb = rgb * pow(2.0, params.exposure);

    // 3. Contrast adjustment (pivot around midpoint 0.5)
    rgb = clamp((rgb - 0.5) * params.contrast + 0.5, 0.0, 1.0);

    // 4. Gamma Correction
    rgb = pow(rgb, 1.0 / params.gamma);

    // 5. Saturation control
    float luma = dot(rgb, float3(0.2126, 0.7152, 0.0722));
    rgb = clamp(mix(float3(luma), rgb, params.saturation), 0.0, 1.0);

    return float4(rgb, color.a);
}
