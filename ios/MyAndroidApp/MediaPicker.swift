import Foundation
import UIKit
import React
import MobileCoreServices

@objc(MediaPicker)
class MediaPicker: NSObject, UIDocumentPickerDelegate, UINavigationControllerDelegate {
  private var pickerResolve: RCTPromiseResolveBlock?
  private var pickerReject: RCTPromiseRejectBlock?
  
  @objc
  func pickMedia(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.pickerResolve = resolve
      self.pickerReject = reject
      
      // Open document picker supporting both images and movies
      let picker = UIDocumentPickerViewController(documentTypes: [kUTTypeImage as String, kUTTypeMovie as String], in: .import)
      picker.delegate = self
      picker.allowsMultipleSelection = false
      
      if let rootVC = RCTPresentedViewController() {
        rootVC.present(picker, animated: true, completion: nil)
      } else {
        reject("VC_ERROR", "Cannot find root view controller to present picker", nil)
      }
    }
  }
  
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else {
      pickerReject?("NO_MEDIA", "No media selected", nil)
      return
    }
    
    pickerResolve?(url.absoluteString)
  }
  
  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    pickerReject?("PICKER_CANCELED", "Selection canceled", nil)
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
