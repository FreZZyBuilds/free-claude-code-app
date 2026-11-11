package dev.fcc.studio

import android.annotation.SuppressLint
import android.content.Intent
import androidx.core.graphics.toColorInt
import android.os.Bundle
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/** Hosts the FCC Studio web UI served by the embedded server on 127.0.0.1. */
class StudioActivity : ComponentActivity() {
    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val port = intent.getIntExtra(EXTRA_PORT, 8082)
        val origin = "http://127.0.0.1:$port"

        web = WebView(this).apply {
            setBackgroundColor("#0E1524".toColorInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    // Keep the app's own pages inside; open provider sites and docs in the browser.
                    if (url.host == "127.0.0.1" && url.port == port) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    return true
                }

                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    // The WebView renderer crashed or was killed for memory: close this screen, keep the server running.
                    finish()
                    return true
                }
            }
        }
        ViewCompat.setOnApplyWindowInsetsListener(web) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(web)

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(origin + (intent.getStringExtra(EXTRA_PATH) ?: "/"))

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_PORT = "port"
        const val EXTRA_PATH = "path"

        fun intent(ctx: android.content.Context, port: Int, path: String = "/") =
            Intent(ctx, StudioActivity::class.java).putExtra(EXTRA_PORT, port).putExtra(EXTRA_PATH, path)
    }
}
