package com.myandroidapp.video

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.viewmanagers.LogVideoPlayerManagerInterface
import com.facebook.react.viewmanagers.LogVideoPlayerManagerDelegate

class LogVideoPlayerManager : SimpleViewManager<LogVideoPlayerView>(), LogVideoPlayerManagerInterface<LogVideoPlayerView> {
    private val mDelegate = LogVideoPlayerManagerDelegate<LogVideoPlayerView, LogVideoPlayerManager>(this)

    override fun getDelegate(): ViewManagerDelegate<LogVideoPlayerView> = mDelegate

    override fun getName(): String {
        return "LogVideoPlayer"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): LogVideoPlayerView {
        android.util.Log.w("LogVideoPlayerManager", "createViewInstance called!")
        val view = LogVideoPlayerView(reactContext)
        LogVideoPlayerView.setActiveView(view)
        return view
    }

    override fun onDropViewInstance(view: LogVideoPlayerView) {
        super.onDropViewInstance(view)
        view.onRelease()
    }

    @ReactProp(name = "videoUrl")
    override fun setVideoUrl(view: LogVideoPlayerView, url: String?) {
        view.setVideoUrl(url)
    }

    @ReactProp(name = "logFormat")
    override fun setLogFormat(view: LogVideoPlayerView, format: String?) {
        view.setLogFormat(format)
    }

    @ReactProp(name = "exposure")
    override fun setExposure(view: LogVideoPlayerView, exposure: Float) {
        view.setExposure(exposure)
    }

    @ReactProp(name = "contrast")
    override fun setContrast(view: LogVideoPlayerView, contrast: Float) {
        view.setContrast(contrast)
    }

    @ReactProp(name = "saturation")
    override fun setSaturation(view: LogVideoPlayerView, saturation: Float) {
        view.setSaturation(saturation)
    }

    @ReactProp(name = "gamma")
    override fun setGamma(view: LogVideoPlayerView, gamma: Float) {
        view.setGamma(gamma)
    }

    @ReactProp(name = "curvesLut")
    override fun setCurvesLut(view: LogVideoPlayerView, curvesLut: ReadableArray?) {
        view.setCurvesLut(curvesLut)
    }

    @ReactProp(name = "colorWheels")
    override fun setColorWheels(view: LogVideoPlayerView, colorWheels: ReadableArray?) {
        view.setColorWheels(colorWheels)
    }

    @ReactProp(name = "temperature")
    override fun setTemperature(view: LogVideoPlayerView, temperature: Float) {
        view.setTemperature(temperature)
    }

    @ReactProp(name = "tint")
    override fun setTint(view: LogVideoPlayerView, tint: Float) {
        view.setTint(tint)
    }

    @ReactProp(name = "highlights")
    override fun setHighlights(view: LogVideoPlayerView, highlights: Float) {
        view.setHighlights(highlights)
    }

    @ReactProp(name = "shadows")
    override fun setShadows(view: LogVideoPlayerView, shadows: Float) {
        view.setShadows(shadows)
    }

    @ReactProp(name = "toneContrast")
    override fun setToneContrast(view: LogVideoPlayerView, toneContrast: Float) {
        view.setToneContrast(toneContrast)
    }

    @ReactProp(name = "vibrance")
    override fun setVibrance(view: LogVideoPlayerView, vibrance: Float) {
        view.setVibrance(vibrance)
    }

    @ReactProp(name = "hueRotation")
    override fun setHueRotation(view: LogVideoPlayerView, hueRotation: Float) {
        view.setHueRotation(hueRotation)
    }

    @ReactProp(name = "vignetteParams")
    override fun setVignetteParams(view: LogVideoPlayerView, vignetteParams: ReadableArray?) {
        view.setVignetteParams(vignetteParams)
    }

    @ReactProp(name = "doubleExposureEnabled")
    override fun setDoubleExposureEnabled(view: LogVideoPlayerView, value: Boolean) {
        view.setDoubleExposureEnabled(value)
    }

    @ReactProp(name = "doubleExposureOpacity")
    override fun setDoubleExposureOpacity(view: LogVideoPlayerView, value: Float) {
        view.setDoubleExposureOpacity(value)
    }

    @ReactProp(name = "doubleExposureOffsetX")
    override fun setDoubleExposureOffsetX(view: LogVideoPlayerView, value: Float) {
        view.setDoubleExposureOffsetX(value)
    }

    @ReactProp(name = "doubleExposureOffsetY")
    override fun setDoubleExposureOffsetY(view: LogVideoPlayerView, value: Float) {
        view.setDoubleExposureOffsetY(value)
    }

    @ReactProp(name = "doubleExposureBlend")
    override fun setDoubleExposureBlend(view: LogVideoPlayerView, value: Int) {
        view.setDoubleExposureBlend(value)
    }

    @ReactProp(name = "doubleExposureUri")
    override fun setDoubleExposureUri(view: LogVideoPlayerView, value: String?) {
        view.setDoubleExposureUri(value)
    }

    @ReactProp(name = "dehaze")
    override fun setDehaze(view: LogVideoPlayerView, value: Float) {
        view.setDehaze(value)
    }

    @ReactProp(name = "hdrStrength")
    override fun setHdrStrength(view: LogVideoPlayerView, value: Float) {
        view.setHdrStrength(value)
    }

    @ReactProp(name = "sharpen")
    override fun setSharpen(view: LogVideoPlayerView, value: Float) {
        view.setSharpen(value)
    }

    @ReactProp(name = "definition")
    override fun setDefinition(view: LogVideoPlayerView, value: Float) {
        view.setDefinition(value)
    }

    @ReactProp(name = "softness")
    override fun setSoftness(view: LogVideoPlayerView, value: Float) {
        view.setSoftness(value)
    }

    @ReactProp(name = "grainAmount")
    override fun setGrainAmount(view: LogVideoPlayerView, value: Float) {
        view.setGrainAmount(value)
    }

    @ReactProp(name = "grainSize")
    override fun setGrainSize(view: LogVideoPlayerView, value: Float) {
        view.setGrainSize(value)
    }

    @ReactProp(name = "grainRoughness")
    override fun setGrainRoughness(view: LogVideoPlayerView, value: Float) {
        view.setGrainRoughness(value)
    }

    @ReactProp(name = "halationStrength")
    override fun setHalationStrength(view: LogVideoPlayerView, value: Float) {
        view.setHalationStrength(value)
    }

    @ReactProp(name = "halationRadius")
    override fun setHalationRadius(view: LogVideoPlayerView, value: Float) {
        view.setHalationRadius(value)
    }

    @ReactProp(name = "halationColor")
    override fun setHalationColor(view: LogVideoPlayerView, value: String?) {
        view.setHalationColor(value)
    }

    @ReactProp(name = "halationCenterX")
    override fun setHalationCenterX(view: LogVideoPlayerView, value: Float) {
        view.setHalationCenterX(value)
    }

    @ReactProp(name = "halationCenterY")
    override fun setHalationCenterY(view: LogVideoPlayerView, value: Float) {
        view.setHalationCenterY(value)
    }

    @ReactProp(name = "perspectiveVertical")
    override fun setPerspectiveVertical(view: LogVideoPlayerView, value: Float) {
        view.setPerspectiveVertical(value)
    }

    @ReactProp(name = "perspectiveHorizontal")
    override fun setPerspectiveHorizontal(view: LogVideoPlayerView, value: Float) {
        view.setPerspectiveHorizontal(value)
    }

    @ReactProp(name = "perspectiveAspect")
    override fun setPerspectiveAspect(view: LogVideoPlayerView, value: Float) {
        view.setPerspectiveAspect(value)
    }

    @ReactProp(name = "perspectiveRotate")
    override fun setPerspectiveRotate(view: LogVideoPlayerView, value: Float) {
        view.setPerspectiveRotate(value)
    }

    @ReactProp(name = "controlPoints")
    override fun setControlPoints(view: LogVideoPlayerView, value: ReadableArray?) {
        view.setControlPoints(value)
    }

    @ReactProp(name = "masks")
    override fun setMasks(view: LogVideoPlayerView, value: ReadableArray?) {
        view.setMasks(value)
    }

    @ReactProp(name = "brushStroke")
    override fun setBrushStroke(view: LogVideoPlayerView, value: ReadableArray?) {
        view.setBrushStroke(value)
    }

    @ReactProp(name = "showMaskOverlay")
    override fun setShowMaskOverlay(view: LogVideoPlayerView, value: Boolean) {
        view.setShowMaskOverlay(value)
    }

    @ReactProp(name = "activeMaskIndex")
    override fun setActiveMaskIndex(view: LogVideoPlayerView, value: Int) {
        view.setActiveMaskIndex(value)
    }

    @ReactProp(name = "lutData")
    override fun setLutData(view: LogVideoPlayerView, value: ReadableArray?) {
        view.setLutData(value)
    }

    @ReactProp(name = "lutSize")
    override fun setLutSize(view: LogVideoPlayerView, value: Float) {
        view.setLutSize(value)
    }

    @ReactProp(name = "lutIntensity")
    override fun setLutIntensity(view: LogVideoPlayerView, value: Float) {
        view.setLutIntensity(value)
    }

    @ReactProp(name = "lutColorOffset")
    override fun setLutColorOffset(view: LogVideoPlayerView, value: Float) {
        view.setLutColorOffset(value)
    }

    @ReactProp(name = "lutToneOffset")
    override fun setLutToneOffset(view: LogVideoPlayerView, value: Float) {
        view.setLutToneOffset(value)
    }

    @ReactProp(name = "bokehStrength")
    override fun setBokehStrength(view: LogVideoPlayerView, value: Float) {
        view.setBokehStrength(value)
    }

    @ReactProp(name = "bokehRadius")
    override fun setBokehRadius(view: LogVideoPlayerView, value: Float) {
        view.setBokehRadius(value)
    }

    @ReactProp(name = "bokehShape")
    override fun setBokehShape(view: LogVideoPlayerView, value: String?) {
        view.setBokehShape(value)
    }

    @ReactProp(name = "bokehCenterX")
    override fun setBokehCenterX(view: LogVideoPlayerView, value: Float) {
        view.setBokehCenterX(value)
    }

    @ReactProp(name = "bokehCenterY")
    override fun setBokehCenterY(view: LogVideoPlayerView, value: Float) {
        view.setBokehCenterY(value)
    }



    @ReactProp(name = "longExposureAmount")
    override fun setLongExposureAmount(view: LogVideoPlayerView, value: Float) {
        view.setLongExposureAmount(value)
    }

    @ReactProp(name = "longExposureDirection")
    override fun setLongExposureDirection(view: LogVideoPlayerView, value: Float) {
        view.setLongExposureDirection(value)
    }

    @ReactProp(name = "longExposureThreshold")
    override fun setLongExposureThreshold(view: LogVideoPlayerView, value: Float) {
        view.setLongExposureThreshold(value)
    }

    @ReactProp(name = "longExposureCenterX")
    override fun setLongExposureCenterX(view: LogVideoPlayerView, value: Float) {
        view.setLongExposureCenterX(value)
    }

    @ReactProp(name = "longExposureCenterY")
    override fun setLongExposureCenterY(view: LogVideoPlayerView, value: Float) {
        view.setLongExposureCenterY(value)
    }

    @ReactProp(name = "brightness")
    override fun setBrightness(view: LogVideoPlayerView, value: Float) {
        view.setBrightness(value)
    }

    @ReactProp(name = "hslAdjustments")
    override fun setHslAdjustments(view: LogVideoPlayerView, value: ReadableArray?) {
        view.setHslAdjustments(value)
    }

    @ReactProp(name = "paused")
    override fun setPaused(view: LogVideoPlayerView, value: Boolean) {
        view.setPaused(value)
    }

    @ReactProp(name = "denoiseLuminance")
    override fun setDenoiseLuminance(view: LogVideoPlayerView, value: Float) {
        view.setDenoiseLuminance(value)
    }

    @ReactProp(name = "denoiseColor")
    override fun setDenoiseColor(view: LogVideoPlayerView, value: Float) {
        view.setDenoiseColor(value)
    }

    @ReactProp(name = "cropX")
    override fun setCropX(view: LogVideoPlayerView, value: Float) {
        view.setCropX(value)
    }

    @ReactProp(name = "cropY")
    override fun setCropY(view: LogVideoPlayerView, value: Float) {
        view.setCropY(value)
    }

    @ReactProp(name = "cropWidth")
    override fun setCropWidth(view: LogVideoPlayerView, value: Float) {
        view.setCropWidth(value)
    }

    @ReactProp(name = "cropHeight")
    override fun setCropHeight(view: LogVideoPlayerView, value: Float) {
        view.setCropHeight(value)
    }

    @ReactProp(name = "zoomScale")
    override fun setZoomScale(view: LogVideoPlayerView, value: Float) {
        view.setZoomScale(value)
    }

    @ReactProp(name = "zoomX")
    override fun setZoomX(view: LogVideoPlayerView, value: Float) {
        view.setZoomX(value)
    }

    @ReactProp(name = "zoomY")
    override fun setZoomY(view: LogVideoPlayerView, value: Float) {
        view.setZoomY(value)
    }
}
