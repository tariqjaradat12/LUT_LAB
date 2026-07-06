import Foundation
import AVFoundation
import UIKit

@objc(VideoExporter)
class VideoExporter: NSObject {
  private var assetWriter: AVAssetWriter?
  private var assetWriterInput: AVAssetWriterInput?
  private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var width: Int = 0
  private var height: Int = 0
  private var fps: Int = 0
  private var frameIndex: Int64 = 0
  private var outputPath: URL?
  
  @objc
  func startExport(_ filename: String, width: Double, height: Double, fps: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let w = Int(width)
    let h = Int(height)
    let f = Int(fps)
    self.width = w
    self.height = h
    self.fps = f
    self.frameIndex = 0
    
    let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    let outputURL = cacheDirectory.appendingPathComponent(filename)
    self.outputPath = outputURL
    
    // Remove existing file if any
    try? FileManager.default.removeItem(at: outputURL)
    
    do {
      let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
      
      // ProRes 4444 configuration for absolute lossless, high-fidelity export
      let videoSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.ap4h, // Apple ProRes 4444 (Lossless/Master quality)
        AVVideoWidthKey: w,
        AVVideoHeightKey: h
      ]
      
      let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
      input.expectsMediaDataInRealTime = false
      
      let attributes: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
        kCVPixelBufferWidthKey as String: w,
        kCVPixelBufferHeightKey as String: h
      ]
      
      let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: input,
        sourcePixelBufferAttributes: attributes
      )
      
      if writer.canAdd(input) {
        writer.add(input)
      } else {
        reject("INIT_ERROR", "Cannot add asset writer input", nil)
        return
      }
      
      writer.startWriting()
      writer.startSession(atSourceTime: .zero)
      
      self.assetWriter = writer
      self.assetWriterInput = input
      self.pixelBufferAdaptor = adaptor
      
      resolve(outputURL.path)
    } catch {
      reject("INIT_ERROR", "Failed to start asset writer: \(error.localizedDescription)", error)
    }
  }
  
  @objc
  func appendFrame(_ colorHex: String, durationMs: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let input = assetWriterInput, let adaptor = pixelBufferAdaptor else {
      reject("APPEND_ERROR", "Exporter not initialized", nil)
      return
    }
    
    let color = uiColor(from: colorHex)
    
    // Wait until input is ready for more media data
    var tries = 0
    while !input.isReadyForMoreMediaData {
      usleep(10000) // Sleep 10ms
      tries += 1
      if tries > 100 {
        reject("APPEND_ERROR", "Writer input timeout", nil)
        return
      }
    }
    
    // Generate a CVPixelBuffer and draw the solid color onto it
    if let pixelBuffer = createPixelBuffer(color: color) {
      let presentationTime = CMTime(value: frameIndex, timescale: Int32(fps))
      if adaptor.append(pixelBuffer, withPresentationTime: presentationTime) {
        frameIndex += 1
        resolve(nil)
      } else {
        reject("APPEND_ERROR", "Failed to append pixel buffer", nil)
      }
    } else {
      reject("APPEND_ERROR", "Failed to create pixel buffer", nil)
    }
  }
  
  @objc
  func finalizeExport(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let writer = assetWriter, let input = assetWriterInput else {
      reject("FINALIZE_ERROR", "Exporter not initialized", nil)
      return
    }
    
    input.markAsFinished()
    writer.finishWriting {
      if writer.status == .completed {
        resolve(self.outputPath?.path ?? "")
      } else {
        reject("FINALIZE_ERROR", "Writer finished with error: \(writer.error?.localizedDescription ?? "unknown")", writer.error)
      }
    }
  }
  
  // Helper to create pixel buffer filled with color
  private func createPixelBuffer(color: UIColor) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer? = nil
    let attrs = [
      kCVPixelBufferCGImageCompatibilityKey: kCFBooleanTrue,
      kCVPixelBufferCGBitmapContextCompatibilityKey: kCFBooleanTrue
    ] as CFDictionary
    
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32ARGB,
      attrs,
      &pixelBuffer
    )
    
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
      return nil
    }
    
    CVPixelBufferLockBaseAddress(buffer, CVPixelBufferLockFlags(rawValue: 0))
    let pixelData = CVPixelBufferGetBaseAddress(buffer)
    
    let rgbColorSpace = CGColorSpaceCreateDeviceRGB()
    let context = CGContext(
      data: pixelData,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: rgbColorSpace,
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    )
    
    if let context = context {
      context.setFillColor(color.cgColor)
      context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    }
    
    CVPixelBufferUnlockBaseAddress(buffer, CVPixelBufferLockFlags(rawValue: 0))
    return buffer
  }
  
  // Helper to convert hex to UIColor
  private func uiColor(from hex: String) -> UIColor {
    var cString: String = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    
    if cString.hasPrefix("#") {
      cString.remove(at: cString.startIndex)
    }
    
    if cString.count != 6 {
      return UIColor.gray
    }
    
    var rgbValue: UInt64 = 0
    Scanner(string: cString).scanHexInt64(&rgbValue)
    
    return UIColor(
      red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
      green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
      blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
      alpha: CGFloat(1.0)
    )
  }
}
