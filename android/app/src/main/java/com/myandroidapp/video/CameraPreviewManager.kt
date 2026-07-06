package com.myandroidapp.video

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.bridge.ReadableArray
import java.util.HashMap

class CameraPreviewManager : SimpleViewManager<CameraPreviewView>() {

    override fun getName(): String {
        return "CameraPreview"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): CameraPreviewView {
        android.util.Log.d("CameraPreviewManager", "createViewInstance")
        val view = CameraPreviewView(reactContext)
        Companion.activeView = view
        return view
    }

    override fun onDropViewInstance(view: CameraPreviewView) {
        super.onDropViewInstance(view)
        view.release()
        if (Companion.activeView == view) {
            Companion.activeView = null
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
        val map = HashMap<String, Any>()
        val registration = HashMap<String, String>()
        registration["registrationName"] = "onCameraInfo"
        map["onCameraInfo"] = registration
        return map
    }

    @ReactProp(name = "activeCameraId")
    fun setActiveCameraId(view: CameraPreviewView, id: String) {
        view.setActiveCameraId(id)
    }

    @ReactProp(name = "iso")
    fun setIso(view: CameraPreviewView, value: Int) {
        view.setIso(value)
    }

    @ReactProp(name = "shutterSpeed")
    fun setShutterSpeed(view: CameraPreviewView, value: Int) {
        view.setShutterSpeed(value)
    }

    @ReactProp(name = "whiteBalanceMode")
    fun setWhiteBalanceMode(view: CameraPreviewView, value: String) {
        view.setWhiteBalanceMode(value)
    }

    @ReactProp(name = "meteringMode")
    fun setMeteringMode(view: CameraPreviewView, value: String) {
        view.setMeteringMode(value)
    }

    @ReactProp(name = "focusMode")
    fun setFocusMode(view: CameraPreviewView, value: String) {
        view.setFocusMode(value)
    }

    @ReactProp(name = "focusDistance")
    fun setFocusDistance(view: CameraPreviewView, value: Float) {
        view.setFocusDistance(value)
    }

    @ReactProp(name = "flashMode")
    fun setFlashMode(view: CameraPreviewView, value: String) {
        view.setFlashMode(value)
    }

    // Filters and Grading setters (identical to LogVideoPlayerManager)
    @ReactProp(name = "logFormat")
    fun setLogFormat(view: CameraPreviewView, format: String?) {
        view.setLogFormat(format)
    }

    @ReactProp(name = "exposure")
    fun setExposure(view: CameraPreviewView, exposure: Float) {
        view.setExposure(exposure)
    }

    @ReactProp(name = "contrast")
    fun setContrast(view: CameraPreviewView, contrast: Float) {
        view.setContrast(contrast)
    }

    @ReactProp(name = "saturation")
    fun setSaturation(view: CameraPreviewView, saturation: Float) {
        view.setSaturation(saturation)
    }

    @ReactProp(name = "gamma")
    fun setGamma(view: CameraPreviewView, gamma: Float) {
        view.setGamma(gamma)
    }

    @ReactProp(name = "brightness")
    fun setBrightness(view: CameraPreviewView, value: Float) {
        view.setBrightness(value)
    }

    @ReactProp(name = "temperature")
    fun setTemperature(view: CameraPreviewView, temperature: Float) {
        view.setTemperature(temperature)
    }

    @ReactProp(name = "tint")
    fun setTint(view: CameraPreviewView, tint: Float) {
        view.setTint(tint)
    }

    @ReactProp(name = "highlights")
    fun setHighlights(view: CameraPreviewView, highlights: Float) {
        view.setHighlights(highlights)
    }

    @ReactProp(name = "shadows")
    fun setShadows(view: CameraPreviewView, shadows: Float) {
        view.setShadows(shadows)
    }

    @ReactProp(name = "toneContrast")
    fun setToneContrast(view: CameraPreviewView, toneContrast: Float) {
        view.setToneContrast(toneContrast)
    }

    @ReactProp(name = "vibrance")
    fun setVibrance(view: CameraPreviewView, vibrance: Float) {
        view.setVibrance(vibrance)
    }

    @ReactProp(name = "hueRotation")
    fun setHueRotation(view: CameraPreviewView, hueRotation: Float) {
        view.setHueRotation(hueRotation)
    }

    @ReactProp(name = "colorWheels")
    fun setColorWheels(view: CameraPreviewView, colorWheels: ReadableArray?) {
        view.setColorWheels(colorWheels)
    }

    @ReactProp(name = "hslAdjustments")
    fun setHslAdjustments(view: CameraPreviewView, hslAdjustments: ReadableArray?) {
        view.setHslAdjustments(hslAdjustments)
    }

    @ReactProp(name = "curvesLut")
    fun setCurvesLut(view: CameraPreviewView, curvesLut: ReadableArray?) {
        view.setCurvesLut(curvesLut)
    }

    @ReactProp(name = "lutData")
    fun setLutData(view: CameraPreviewView, lutData: ReadableArray?) {
        view.setLutData(lutData)
    }

    @ReactProp(name = "lutSize")
    fun setLutSize(view: CameraPreviewView, lutSize: Float) {
        view.setLutSize(lutSize)
    }

    @ReactProp(name = "lutIntensity")
    fun setLutIntensity(view: CameraPreviewView, lutIntensity: Float) {
        view.setLutIntensity(lutIntensity)
    }

    @ReactProp(name = "vignetteParams")
    fun setVignetteParams(view: CameraPreviewView, vignetteParams: ReadableArray?) {
        view.setVignetteParams(vignetteParams)
    }

    @ReactProp(name = "dehaze")
    fun setDehaze(view: CameraPreviewView, value: Float) {
        view.setDehaze(value)
    }

    @ReactProp(name = "hdrStrength")
    fun setHdrStrength(view: CameraPreviewView, value: Float) {
        view.setHdrStrength(value)
    }

    @ReactProp(name = "sharpen")
    fun setSharpen(view: CameraPreviewView, value: Float) {
        view.setSharpen(value)
    }

    @ReactProp(name = "definition")
    fun setDefinition(view: CameraPreviewView, value: Float) {
        view.setDefinition(value)
    }

    @ReactProp(name = "softness")
    fun setSoftness(view: CameraPreviewView, value: Float) {
        view.setSoftness(value)
    }

    @ReactProp(name = "denoiseLuminance")
    fun setDenoiseLuminance(view: CameraPreviewView, value: Float) {
        view.setDenoiseLuminance(value)
    }

    @ReactProp(name = "denoiseColor")
    fun setDenoiseColor(view: CameraPreviewView, value: Float) {
        view.setDenoiseColor(value)
    }

    @ReactProp(name = "grainAmount")
    fun setGrainAmount(view: CameraPreviewView, value: Float) {
        view.setGrainAmount(value)
    }

    @ReactProp(name = "grainSize")
    fun setGrainSize(view: CameraPreviewView, value: Float) {
        view.setGrainSize(value)
    }

    @ReactProp(name = "grainRoughness")
    fun setGrainRoughness(view: CameraPreviewView, value: Float) {
        view.setGrainRoughness(value)
    }

    @ReactProp(name = "highMpMode")
    fun setHighMpMode(view: CameraPreviewView, value: Boolean) {
        view.setHighMpMode(value)
    }

    @ReactProp(name = "unprocessed")
    fun setUnprocessed(view: CameraPreviewView, value: Boolean) {
        view.setUnprocessed(value)
    }

    companion object {
        var activeView: CameraPreviewView? = null
    }
}
