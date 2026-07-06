import Foundation
import UIKit
import React

@objc(LutShare)
class LutShare: NSObject {
  
  @objc
  func shareLut(_ filename: String, content: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Sharing UI elements must always execute on the main thread
    DispatchQueue.main.async {
      guard let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
        reject("DIR_ERROR", "Cannot access caches directory", nil)
        return
      }
      
      let fileURL = cacheDirectory.appendingPathComponent(filename)
      
      do {
        try content.write(to: fileURL, atomically: true, encoding: .utf8)
        
        let activityVC = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        
        // Setup popover presentation controller for iPads to prevent visual presentation crashes
        if let rootVC = RCTPresentedViewController() {
          if let popover = activityVC.popoverPresentationController {
            popover.sourceView = rootVC.view
            popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
          }
          
          rootVC.present(activityVC, animated: true, completion: {
            resolve(fileURL.path)
          })
        } else {
          reject("VC_ERROR", "Cannot find root view controller to present share sheet", nil)
        }
      } catch {
        reject("WRITE_ERROR", "Failed to write LUT file: \(error.localizedDescription)", error)
      }
    }
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
