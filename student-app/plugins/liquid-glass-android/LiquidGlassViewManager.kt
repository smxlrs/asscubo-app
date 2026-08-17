package com.studentunion.app

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class LiquidGlassViewManager : SimpleViewManager<LiquidGlassView>() {
    override fun getName(): String {
        return "LiquidGlassView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): LiquidGlassView {
        return LiquidGlassView(reactContext)
    }

    @ReactProp(name = "borderRadius")
    override fun setBorderRadius(view: LiquidGlassView, borderRadius: Float) {
        view.borderRadius = borderRadius
        view.invalidate()
    }

    @ReactProp(name = "isDark")
    fun setIsDark(view: LiquidGlassView, isDark: Boolean) {
        view.isDark = isDark
        view.invalidate()
    }

    @ReactProp(name = "blurStep", defaultFloat = 0f)
    fun setBlurStep(view: LiquidGlassView, blurStep: Float) {
        view.blurStep = blurStep
        view.invalidate()
    }

    @ReactProp(name = "chromaticBoost")
    fun setChromaticBoost(view: LiquidGlassView, chromaticBoost: Boolean) {
        view.chromaticBoost = chromaticBoost
        view.invalidate()
    }

    @ReactProp(name = "refractionEnabled")
    fun setRefractionEnabled(view: LiquidGlassView, refractionEnabled: Boolean) {
        view.refractionEnabled = refractionEnabled
        view.invalidate()
    }

    @ReactProp(name = "edgeReflection")
    fun setEdgeReflection(view: LiquidGlassView, edgeReflection: Boolean) {
        view.edgeReflection = edgeReflection
        view.invalidate()
    }

    @ReactProp(name = "excludeNestedGlass")
    fun setExcludeNestedGlass(view: LiquidGlassView, excludeNestedGlass: Boolean) {
        view.excludeNestedGlass = excludeNestedGlass
        view.invalidate()
    }
}
