package com.studentunion.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import android.view.Choreographer
import android.view.View
import android.view.ViewGroup

class LiquidGlassView(context: Context) : View(context) {
    private var mBitmap: Bitmap? = null
    private var mPrivateCanvas: Canvas? = null
    private var mIsDrawingBackdrop = false
    private val mPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    var borderRadius: Float = 0f
        set(value) {
            field = value
            applyRenderEffect()
            invalidate()
        }

    var isDark: Boolean = false
        set(value) {
            field = value
            applyRenderEffect()
            invalidate()
        }

    var blurStep: Float = 0f
        set(value) {
            field = value
            applyRenderEffect()
            invalidate()
        }

    private val mFrameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            invalidate()
            if (isAttachedToWindow) {
                Choreographer.getInstance().postFrameCallback(this)
            }
        }
    }

    companion object {
        private const val AGSL_SRC = """
            uniform shader content;
            uniform vec2 size;
            uniform float radius;
            uniform float band;
            uniform float refraction;
            uniform float rim;
            uniform float isDark;

            float sdRoundRect(vec2 p, vec2 hs, float r) {
                vec2 q = abs(p) - hs + r;
                return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
            }

            half4 main(vec2 coord) {
                vec2 c = size * 0.5;
                vec2 p = coord - c;
                vec2 hs = c;
                float d = sdRoundRect(p, hs, radius);

                float e = 1.0;
                float dx = sdRoundRect(p + vec2(e, 0.0), hs, radius) - sdRoundRect(p - vec2(e, 0.0), hs, radius);
                float dy = sdRoundRect(p + vec2(0.0, e), hs, radius) - sdRoundRect(p - vec2(0.0, e), hs, radius);
                vec2 n = normalize(vec2(dx, dy) + vec2(1e-5));

                float t = clamp(1.0 + d / band, 0.0, 1.0);
                float bend = t * t * t * t;

                vec2 sampleAt = coord - n * bend * refraction;
                half4 col = content.eval(sampleAt);

                vec2 L = normalize(vec2(-0.55, -0.83));
                float spec = clamp(dot(n, L), 0.0, 1.0);

                float rimGain = mix(0.58, 0.45, isDark);
                col.rgb = mix(col.rgb, vec3(1.0), rimGain * spec * bend);

                return col;
            }
        """
    }

    private fun applyRenderEffect() {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        val density = resources.displayMetrics.density
        val dpValue = when {
            blurStep <= 0f -> 0.05f
            blurStep >= 6f -> 6f
            else -> blurStep
        }
        val blurPx = (dpValue * density).coerceAtLeast(0.1f)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                val shader = RuntimeShader(AGSL_SRC)
                val r = if (borderRadius > 0f) borderRadius * density else h * 0.5f

                shader.setFloatUniform("size", w, h)
                shader.setFloatUniform("radius", r)
                shader.setFloatUniform("band", 15.0f * density)
                shader.setFloatUniform("refraction", 14.0f * density)
                shader.setFloatUniform("rim", 0.45f)
                shader.setFloatUniform("isDark", if (isDark) 1.0f else 0.0f)

                val blurEffect = RenderEffect.createBlurEffect(blurPx, blurPx, Shader.TileMode.CLAMP)
                val shaderEffect = RenderEffect.createRuntimeShaderEffect(shader, "content")
                val chainEffect = RenderEffect.createChainEffect(shaderEffect, blurEffect)
                setRenderEffect(chainEffect)
            } catch (e: Exception) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    setRenderEffect(RenderEffect.createBlurEffect(blurPx, blurPx, Shader.TileMode.CLAMP))
                }
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setRenderEffect(RenderEffect.createBlurEffect(blurPx, blurPx, Shader.TileMode.CLAMP))
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Choreographer.getInstance().postFrameCallback(mFrameCallback)
        applyRenderEffect()
    }

    override fun onDetachedFromWindow() {
        Choreographer.getInstance().removeFrameCallback(mFrameCallback)
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        applyRenderEffect()
    }

    override fun draw(canvas: Canvas) {
        if (mIsDrawingBackdrop) {
            return
        }

        val parentGroup = parent as? ViewGroup ?: run {
            super.draw(canvas)
            return
        }

        val w = width
        val h = height
        if (w <= 0 || h <= 0) {
            super.draw(canvas)
            return
        }

        var bitmap = mBitmap
        if (bitmap == null || bitmap.width != w || bitmap.height != h) {
            bitmap?.recycle()
            bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            mBitmap = bitmap
            mPrivateCanvas = Canvas(bitmap)
        }

        val privateCanvas = mPrivateCanvas ?: run {
            super.draw(canvas)
            return
        }
        bitmap.eraseColor(Color.TRANSPARENT)

        val ancestors = ArrayList<ViewGroup>()
        var p: ViewGroup? = parentGroup
        while (p != null) {
            ancestors.add(p)
            if (p.id == android.R.id.content || p.javaClass.simpleName == "ReactRootView") {
                break
            }
            p = p.parent as? ViewGroup
        }

        mIsDrawingBackdrop = true
        privateCanvas.save()

        val myLocation = IntArray(2)
        getLocationInWindow(myLocation)

        for (i in ancestors.size - 1 downTo 0) {
            val ancestor = ancestors[i]
            val childOnBranch: View = if (i > 0) ancestors[i - 1] else this
            val indexInAncestor = ancestor.indexOfChild(childOnBranch)

            for (j in 0 until indexInAncestor) {
                val sibling = ancestor.getChildAt(j)
                if (sibling.visibility == VISIBLE && sibling != childOnBranch) {
                    val siblingLocation = IntArray(2)
                    sibling.getLocationInWindow(siblingLocation)
                    val dx = siblingLocation[0] - myLocation[0]
                    val dy = siblingLocation[1] - myLocation[1]

                    try {
                        privateCanvas.save()
                        privateCanvas.translate(dx.toFloat(), dy.toFloat())
                        sibling.draw(privateCanvas)
                        privateCanvas.restore()
                    } catch (e: Exception) {
                        try {
                            privateCanvas.restore()
                        } catch (_: Exception) {
                            // Canvas state may already be restored by the failed draw.
                        }
                    }
                }
            }
        }

        privateCanvas.restore()
        mIsDrawingBackdrop = false

        canvas.drawBitmap(bitmap, 0f, 0f, mPaint)
        super.draw(canvas)
    }
}
