import Foundation
import MetalKit
import AVFoundation
import React

@objc(LogVideoPlayerView)
class LogVideoPlayerView: MTKView {
  private var player: AVPlayer?
  private var videoOutput: AVPlayerItemVideoOutput?
  private var commandQueue: MTLCommandQueue?
  private var pipelineState: MTLRenderPipelineState?
  private var textureCache: CVMetalTextureCache?
  private var samplerState: MTLSamplerState?
  
  // Vertex buffers
  private var positionBuffer: MTLBuffer?
  private var texCoordBuffer: MTLBuffer?
  
  // Properties mapped to JS
  private var videoUrl: String?
  private var logFormat: Int32 = 0
  private var exposure: Float = 0.0
  private var contrast: Float = 1.0
  private var saturation: Float = 1.0
  private var gamma: Float = 1.0
  
  override init(frame frameRect: CGRect, device: MTLDevice?) {
    let metalDevice = device ?? MTLCreateSystemDefaultDevice()
    super.init(frame: frameRect, device: metalDevice)
    setupMetal()
  }
  
  required init(coder: NSCoder) {
    super.init(coder: coder)
    self.device = MTLCreateSystemDefaultDevice()
    setupMetal()
  }
  
  private func setupMetal() {
    guard let dev = self.device else { return }
    self.framebufferOnly = false
    self.colorPixelFormat = .bgra8Unorm
    
    self.commandQueue = dev.makeCommandQueue()
    
    // Geometry
    let positions: [Float] = [
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0
    ]
    let texCoords: [Float] = [
      0.0, 1.0,
      1.0, 1.0,
      0.0, 0.0,
      1.0, 0.0
    ]
    
    positionBuffer = dev.makeBuffer(bytes: positions, length: positions.count * 4, options: [])
    texCoordBuffer = dev.makeBuffer(bytes: texCoords, length: texCoords.count * 4, options: [])
    
    // Load Metal shading library
    let library = dev.makeDefaultLibrary()
    let vertFunc = library?.makeFunction(name: "colorGradingVertex")
    let fragFunc = library?.makeFunction(name: "colorGradingFragment")
    
    let desc = MTLRenderPipelineDescriptor()
    desc.vertexFunction = vertFunc
    desc.fragmentFunction = fragFunc
    desc.colorAttachments[0].pixelFormat = .bgra8Unorm
    
    pipelineState = try? dev.makeRenderPipelineState(descriptor: desc)
    
    CVMetalTextureCacheCreate(kCFAllocatorDefault, nil, dev, nil, &textureCache)
    
    let samplerDesc = MTLSamplerDescriptor()
    samplerDesc.minFilter = .linear
    samplerDesc.magFilter = .linear
    samplerState = dev.makeSamplerState(descriptor: samplerDesc)
  }
  
  @objc func setVideoUrl(_ url: NSString) {
    let urlStr = url as String
    if urlStr == self.videoUrl { return }
    self.videoUrl = urlStr
    
    guard let videoURL = URL(string: urlStr) else { return }
    
    player?.pause()
    
    let asset = AVAsset(url: videoURL)
    let item = AVPlayerItem(asset: asset)
    
    let attributes: [String: Any] = [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
    ]
    videoOutput = AVPlayerItemVideoOutput(pixelBufferAttributes: attributes)
    if let out = videoOutput {
      item.add(out)
    }
    
    player = AVPlayer(playerItem: item)
    player?.actionAtItemEnd = .none
    
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(playerItemDidReachEnd),
      name: .AVPlayerItemDidPlayToEndTime,
      object: item
    )
    
    player?.play()
  }
  
  @objc func setLogFormat(_ format: NSString) {
    switch format.lowercased {
      case "slog3": self.logFormat = 1
      case "clog": self.logFormat = 2
      case "dlog": self.logFormat = 3
      default: self.logFormat = 0
    }
  }
  
  @objc func setExposure(_ exposure: Float) {
    self.exposure = exposure
  }
  
  @objc func setContrast(_ contrast: Float) {
    self.contrast = contrast
  }
  
  @objc func setSaturation(_ saturation: Float) {
    self.saturation = saturation
  }
  
  @objc func setGamma(_ gamma: Float) {
    self.gamma = gamma
  }
  
  @objc private func playerItemDidReachEnd(notification: Notification) {
    player?.seek(to: .zero)
  }
  
  override func draw(_ rect: CGRect) {
    guard let currentDrawable = currentDrawable,
          let pipeline = pipelineState,
          let queue = commandQueue,
          let out = videoOutput,
          let item = player?.currentItem else {
      return
    }
    
    let time = item.currentTime()
    if !out.hasNewPixelBuffer(forItemTime: time) {
      return
    }
    
    guard let pixelBuffer = out.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: nil) else {
      return
    }
    
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    
    var cvMetalTexture: CVMetalTexture?
    let status = CVMetalTextureCacheCreateTextureFromImage(
      kCFAllocatorDefault,
      textureCache!,
      pixelBuffer,
      nil,
      .bgra8Unorm,
      width,
      height,
      0,
      &cvMetalTexture
    )
    
    guard status == kCVReturnSuccess, let metalTexture = cvMetalTexture else {
      return
    }
    
    let texture = CVMetalTextureGetTexture(metalTexture)
    
    struct GradingParams {
      var exposure: Float
      var contrast: Float
      var saturation: Float
      var gamma: Float
      var logFormat: Int32
    }
    
    var params = GradingParams(
      exposure: exposure,
      contrast: contrast,
      saturation: saturation,
      gamma: gamma,
      logFormat: logFormat
    )
    
    guard let passDesc = currentRenderPassDescriptor else { return }
    let commandBuffer = queue.makeCommandBuffer()
    let encoder = commandBuffer?.makeRenderCommandEncoder(descriptor: passDesc)
    
    encoder?.setRenderPipelineState(pipeline)
    encoder?.setVertexBuffer(positionBuffer, offset: 0, index: 0)
    encoder?.setVertexBuffer(texCoordBuffer, offset: 0, index: 1)
    
    encoder?.setFragmentTexture(texture, index: 0)
    encoder?.setFragmentSamplerState(samplerState, index: 0)
    
    encoder?.setFragmentBytes(&params, length: MemoryLayout<GradingParams>.size, index: 0)
    
    encoder?.drawPrimitives(type: .triangleStrip, vertexStart: 0, vertexCount: 4)
    encoder?.endEncoding()
    
    commandBuffer?.present(currentDrawable)
    commandBuffer?.commit()
  }
  
  deinit {
    player?.pause()
    player = nil
    videoOutput = nil
    NotificationCenter.default.removeObserver(self)
  }
}
