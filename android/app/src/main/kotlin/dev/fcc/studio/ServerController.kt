package dev.fcc.studio

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import dev.fcc.core.AssetSource
import dev.fcc.core.FccServer
import dev.fcc.core.RequestLogEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

sealed interface ServerState {
    data object Stopped : ServerState
    data object Starting : ServerState
    data class Running(val port: Int) : ServerState
    data class Failed(val message: String) : ServerState
}

/** Single owner of the embedded server; the foreground service drives start/stop. */
class ServerController(private val context: Context) {
    private var server: FccServer? = null

    private val _state = MutableStateFlow<ServerState>(ServerState.Stopped)
    val state: StateFlow<ServerState> = _state.asStateFlow()

    private val _log = MutableStateFlow<List<RequestLogEntry>>(emptyList())
    val log: StateFlow<List<RequestLogEntry>> = _log.asStateFlow()

    private val prefs = context.getSharedPreferences("server", Context.MODE_PRIVATE)
    var port: Int
        get() = prefs.getInt("port", 8082)
        set(value) = prefs.edit { putInt("port", value) }

    /** Ask the foreground service to start; it calls [startNow] once it is in the foreground. */
    fun requestStart() {
        if (_state.value is ServerState.Running || _state.value is ServerState.Starting) return
        _state.value = ServerState.Starting
        ContextCompat.startForegroundService(context, Intent(context, ServerService::class.java).setAction(ServerService.ACTION_START))
    }

    fun requestStop() {
        context.startService(Intent(context, ServerService::class.java).setAction(ServerService.ACTION_STOP))
    }

    @Synchronized
    internal fun startNow(): Boolean {
        if (server?.running == true) return true
        return try {
            val assets = AssetSource { path ->
                runCatching { context.assets.open("studio/$path") }.getOrNull()
            }
            val s = FccServer(File(context.filesDir, "fcc/config.json"), assets, port, version = BuildInfo.version(context))
            s.onLog = { _log.value = s.log.toList() }
            s.start()
            server = s
            _log.value = s.log.toList()
            _state.value = ServerState.Running(port)
            true
        } catch (e: Exception) {
            val reason = generateSequence<Throwable>(e) { it.cause }.last()
            _state.value = ServerState.Failed(
                if (reason is java.net.BindException) "Port $port ist belegt. Wähle einen anderen Port."
                else reason.message ?: reason::class.java.simpleName,
            )
            false
        }
    }

    @Synchronized
    internal fun stopNow() {
        server?.stop()
        server = null
        if (_state.value !is ServerState.Failed) _state.value = ServerState.Stopped
    }

    fun clearError() {
        if (_state.value is ServerState.Failed) _state.value = ServerState.Stopped
    }
}

object BuildInfo {
    fun version(context: Context): String = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "android"
    }.getOrDefault("android")
}
