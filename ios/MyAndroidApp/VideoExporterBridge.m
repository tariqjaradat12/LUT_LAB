#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

// Bridge for VideoExporter native module
@interface RCT_EXTERN_MODULE(VideoExporter, NSObject)

RCT_EXTERN_METHOD(startExport:(NSString *)filename
                  width:(double)width
                  height:(double)height
                  fps:(double)fps
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(appendFrame:(NSString *)colorHex
                  durationMs:(double)durationMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(finalizeExport:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

// Bridge for CustomPanel native view manager
@interface RCT_EXTERN_MODULE(CustomPanelManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(statusText, NSString)

@end

// Bridge for LogVideoPlayer native view manager
@interface RCT_EXTERN_MODULE(LogVideoPlayerManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(videoUrl, NSString)
RCT_EXPORT_VIEW_PROPERTY(logFormat, NSString)
RCT_EXPORT_VIEW_PROPERTY(exposure, float)
RCT_EXPORT_VIEW_PROPERTY(contrast, float)
RCT_EXPORT_VIEW_PROPERTY(saturation, float)
RCT_EXPORT_VIEW_PROPERTY(gamma, float)

@end

// Bridge for LutShare native module
@interface RCT_EXTERN_MODULE(LutShare, NSObject)

RCT_EXTERN_METHOD(shareLut:(NSString *)filename
                  content:(NSString *)content
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

// Bridge for MediaPicker native module
@interface RCT_EXTERN_MODULE(MediaPicker, NSObject)

RCT_EXTERN_METHOD(pickMedia:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
