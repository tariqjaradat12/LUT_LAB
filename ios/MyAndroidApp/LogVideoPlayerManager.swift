import Foundation
import React

@objc(LogVideoPlayerManager)
class LogVideoPlayerManager: RCTViewManager {
  override func view() -> UIView! {
    return LogVideoPlayerView(frame: .zero, device: nil)
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
