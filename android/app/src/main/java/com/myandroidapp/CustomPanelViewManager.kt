package com.myandroidapp

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class CustomPanelViewManager : SimpleViewManager<LinearLayout>() {
    override fun getName(): String {
        return "CustomPanel"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): LinearLayout {
        val container = LinearLayout(reactContext).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            
            // Set up a modern premium gradient background (dark theme UI tweak)
            val gradient = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#0F2027"), Color.parseColor("#203A43"), Color.parseColor("#2C5364"))
            )
            gradient.cornerRadius = 32f
            background = gradient
        }

        val titleView = TextView(reactContext).apply {
            text = "Native Android View Panel"
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }

        val subtextView = TextView(reactContext).apply {
            text = "Engine State: Initialized"
            setTextColor(Color.parseColor("#00E676")) // Vibrant premium green
            textSize = 14f
            id = android.R.id.text1
            gravity = Gravity.CENTER
        }

        container.addView(titleView)
        container.addView(subtextView)
        return container
    }

    @ReactProp(name = "statusText")
    fun setStatusText(view: LinearLayout, statusText: String?) {
        val subtextView = view.findViewById<TextView>(android.R.id.text1)
        subtextView?.text = statusText ?: "Engine State: Idle"
    }
}
