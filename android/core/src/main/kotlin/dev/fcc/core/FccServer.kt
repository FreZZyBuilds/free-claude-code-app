package dev.fcc.core

import io.ktor.client.request.header
import io.ktor.client.request.preparePost
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.cio.CIO
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.embeddedServer
import io.ktor.server.request.header
import io.ktor.server.request.receiveText
import io.ktor.server.response.header
import io.ktor.server.response.respondBytes
import io.ktor.server.response.respondBytesWriter
import io.ktor.server.response.respondText
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import io.ktor.utils.io.readUTF8Line
import io.ktor.utils.io.writeStringUtf8
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import java.io.File
import java.io.InputStream
import java.net.URI
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/** Where the Studio UI files come from (Android assets or a directory on disk). */
fun interface AssetSource {
    fun open(path: String): InputStream?

    companion object {
        fun directory(dir: File) = AssetSource { path ->
            val f = File(dir, path).canonicalFile
            if (f.path.startsWith(dir.canonicalPath) && f.isFile) f.inputStream() else null
        }
    }
}

data class RequestLogEntry(
    val at: Long,
    val requested: String,
    val routed: String?,
    val status: Int,
    val millis: Long,
    val error: String? = null,
)

/**
 * The embedded FCC server. Binds to loopback only: coding agents on the same device
 * (for example Claude Code in Termux) reach it at http://127.0.0.1:<port>.
 */
class FccServer(
    configFile: File,
    private val assets: AssetSource?,
    val port: Int = 8082,
    private val version: String = "mobile",
) {
    private val store = ConfigStore(configFile)
    val router = Engine(store)
    private val instanceId = UUID.randomUUID().toString().replace("-", "")
    private val admin = AdminApi(store, router) { AdminApi.ServerInfo(instanceId, HOST, port, version) }
    private var server: EmbeddedServer<*, *>? = null

    val log = CopyOnWriteArrayList<RequestLogEntry>()
    var onLog: ((RequestLogEntry) -> Unit)? = null

    val running get() = server != null

    fun start() {
        if (server != null) return
        server = embeddedServer(CIO, port = port, host = HOST) { module() }.also { it.start(wait = false) }
    }

    fun stop() {
        server?.stop(300, 1500)
        server = null
    }

    private fun record(e: RequestLogEntry) {
        log.add(0, e)
        while (log.size > 200) log.removeAt(log.size - 1)
        onLog?.invoke(e)
    }

    // ---- security ------------------------------------------------------------------------

    private fun isLoopback(host: String?): Boolean {
        val h = host?.trim()?.removePrefix("[")?.removeSuffix("]")?.lowercase() ?: return false
        return h == "localhost" || h == "::1" || h == "0:0:0:0:0:0:0:1" || h.startsWith("127.")
    }

    private fun ApplicationCall.adminAllowed(): Boolean {
        val host = request.header(HttpHeaders.Host)?.let { runCatching { URI("http://$it").host }.getOrNull() }
        val origin = request.header(HttpHeaders.Origin)
        val originOk = origin == null || origin == "null" || runCatching { URI(origin).host }.getOrNull().let(::isLoopback)
        return isLoopback(host) && originOk
    }

    private fun ApplicationCall.apiAuthorized(): Boolean {
        if (router.value("PROXY_AUTH_ENABLED") != "true") return true
        val token = router.value("ANTHROPIC_AUTH_TOKEN") ?: return false
        val bearer = request.header(HttpHeaders.Authorization)?.removePrefix("Bearer ")?.trim()
        val key = request.header("x-api-key")?.trim()
        return bearer == token || key == token
    }

    private suspend fun ApplicationCall.json(body: JsonObject, status: HttpStatusCode = HttpStatusCode.OK) {
        response.header(HttpHeaders.CacheControl, "no-store")
        respondText(body.toString(), ContentType.Application.Json, status)
    }

    private suspend fun ApplicationCall.detail(status: HttpStatusCode, message: String) =
        json(buildJsonObject { put("detail", message) }, status)

    // ---- routes --------------------------------------------------------------------------

    private fun Application.module() {
        routing {
            get("/health") { call.json(buildJsonObject { put("status", "healthy") }) }

            get("/admin/api/status") { call.admin { json(admin.status()) } }
            get("/admin/api/config") { call.admin { json(admin.config()) } }
            post("/admin/api/config/apply") {
                call.admin {
                    val body = runCatching { json.parseToJsonElement(receiveText()) as JsonObject }.getOrNull()
                        ?: return@admin detail(HttpStatusCode.UnprocessableEntity, "Body must be a JSON object.")
                    try {
                        json(admin.apply(body))
                    } catch (e: AdminApi.ConflictException) {
                        detail(HttpStatusCode.Conflict, e.message ?: "Conflict")
                    }
                }
            }
            get("/admin/api/models") { call.admin { json(admin.models()) } }
            post("/admin/api/models/refresh") { call.admin { json(admin.models(router.refreshAll())) } }
            post("/admin/api/providers/{id}/test") { call.admin { json(admin.test(parameters["id"]!!)) } }
            get("/admin/api/providers/{id}/local-status") {
                call.admin {
                    admin.localStatus(parameters["id"]!!)?.let { json(it) } ?: detail(HttpStatusCode.NotFound, "Local provider not found")
                }
            }
            get("/admin/api/providers/{id}/auth") { call.admin { detail(HttpStatusCode.NotFound, "Account sign-in is available in the desktop app.") } }
            delete("/admin/api/providers/{id}/auth") { call.admin { detail(HttpStatusCode.NotFound, "Account sign-in is available in the desktop app.") } }
            get("/admin/api/integrations/{id}") {
                call.admin { detail(HttpStatusCode.NotFound, "Desktop integrations are not available on Android.") }
            }

            post("/v1/messages") { call.messages() }
            post("/v1/messages/count_tokens") {
                if (!call.apiAuthorized()) return@post call.json(anthropicError("Invalid API token.", "authentication_error"), HttpStatusCode.Unauthorized)
                val req = runCatching { json.parseToJsonElement(call.receiveText()) as JsonObject }.getOrNull() ?: JsonObject(emptyMap())
                call.json(buildJsonObject { put("input_tokens", Translate.estimateTokens(req)) })
            }
            get("/v1/models") {
                call.json(buildJsonObject {
                    put("data", kotlinx.serialization.json.buildJsonArray {
                        listOf("claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2").forEach { id ->
                            add(buildJsonObject { put("type", "model"); put("id", id); put("display_name", id) })
                        }
                    })
                    put("has_more", false)
                })
            }

            get("/{path...}") { call.static() }
            get("/") { call.static() }
        }
    }

    private suspend fun ApplicationCall.admin(block: suspend ApplicationCall.() -> Unit) {
        if (!adminAllowed()) return detail(HttpStatusCode.Forbidden, "Admin UI is local-only")
        block()
    }

    private val types = mapOf(
        "html" to "text/html; charset=utf-8", "js" to "text/javascript; charset=utf-8", "css" to "text/css; charset=utf-8",
        "svg" to "image/svg+xml", "png" to "image/png", "ico" to "image/x-icon", "json" to "application/json",
        "webmanifest" to "application/manifest+json", "woff2" to "font/woff2", "woff" to "font/woff", "txt" to "text/plain",
    )

    private suspend fun ApplicationCall.static() {
        val raw = request.local.uri.substringBefore('?').trimStart('/')
        val src = assets
        if (src == null) return respondText("FCC mobile server is running.", ContentType.Text.Plain)
        val path = raw.ifEmpty { "index.html" }
        var served = path
        val stream = src.open(path) ?: run {
            // SPA routes (no file extension) fall back to index.html.
            served = "index.html"
            src.open("index.html").takeIf { !path.substringAfterLast('/').contains('.') }
        } ?: return respondText("Not found", status = HttpStatusCode.NotFound)
        val bytes = stream.use { it.readBytes() }
        val type = types[served.substringAfterLast('.', "")] ?: "application/octet-stream"
        response.header(HttpHeaders.CacheControl, if (served.startsWith("assets/")) "public, max-age=31536000, immutable" else "no-cache")
        response.header("X-Content-Type-Options", "nosniff")
        respondBytes(bytes, ContentType.parse(type))
    }

    // ---- /v1/messages --------------------------------------------------------------------

    private suspend fun ApplicationCall.messages() {
        val started = System.currentTimeMillis()
        if (!apiAuthorized()) return json(anthropicError("Invalid API token.", "authentication_error"), HttpStatusCode.Unauthorized)
        val req = runCatching { json.parseToJsonElement(receiveText()) as JsonObject }.getOrNull()
            ?: return json(anthropicError("Request body must be JSON.", "invalid_request_error"), HttpStatusCode.BadRequest)
        val requested = req["model"].str() ?: "claude-sonnet"
        val stream = (req["stream"] as? JsonPrimitive)?.contentOrNull == "true"
        val candidates = router.candidates(requested)
        if (candidates.isEmpty()) {
            val msg = "No provider is configured for '${router.route(requested).first}'. Open FCC Studio and add a key."
            record(RequestLogEntry(started, requested, null, 400, 0, msg))
            return json(anthropicError(msg, "invalid_request_error"), HttpStatusCode.BadRequest)
        }

        var lastError = "All providers failed."
        var lastStatus = HttpStatusCode.BadGateway
        for (t in candidates) {
            if (t.key == null && ProviderCatalog[t.providerId]?.local != true && !t.providerId.startsWith("custom_")) {
                lastError = "${t.displayName} has no API key. Add one in FCC Studio."
                lastStatus = HttpStatusCode.Unauthorized
                continue
            }
            val outcome = try {
                if (t.format == ApiFormat.ANTHROPIC_MESSAGES) passthrough(t, req, stream) else openAi(t, req, requested, stream)
            } catch (e: Exception) {
                Outcome.Failed(HttpStatusCode.BadGateway, "Could not reach ${t.displayName}: ${e.message ?: e::class.simpleName}")
            }
            when (outcome) {
                is Outcome.Done -> {
                    record(RequestLogEntry(started, requested, "${t.providerId}/${t.model}", 200, System.currentTimeMillis() - started))
                    return
                }
                is Outcome.Failed -> {
                    lastError = outcome.message
                    lastStatus = outcome.status
                    if (outcome.status == HttpStatusCode.TooManyRequests) router.coolDown(t)
                }
            }
        }
        record(RequestLogEntry(started, requested, null, lastStatus.value, System.currentTimeMillis() - started, lastError))
        val type = when (lastStatus.value) {
            401, 403 -> "authentication_error"
            429 -> "rate_limit_error"
            400 -> "invalid_request_error"
            else -> "api_error"
        }
        json(anthropicError(lastError, type), lastStatus)
    }

    private sealed interface Outcome {
        data object Done : Outcome
        data class Failed(val status: HttpStatusCode, val message: String) : Outcome
    }

    private fun upstreamMessage(name: String, status: Int, body: String): String {
        val parsed = runCatching { json.parseToJsonElement(body) as JsonObject }.getOrNull()
        val m = parsed?.obj("error")?.get("message").str() ?: parsed?.get("error").str() ?: parsed?.get("message").str() ?: parsed?.get("detail").str()
        return "$name returned HTTP $status" + (m?.let { ": $it" } ?: "")
    }

    private suspend fun ApplicationCall.openAi(t: Target, req: JsonObject, requested: String, stream: Boolean): Outcome {
        var effort = router.reasoningEffort(t.reasoning, req)
        repeat(2) {
            val body = Translate.toOpenAi(req, t.model, effort)
            val outcome = router.http(t.baseUrl).preparePost("${t.baseUrl}/chat/completions") {
                router.headers(t.format, t.key).forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }.execute { resp ->
                val code = resp.status.value
                if (code !in 200..299) {
                    val text = resp.bodyAsText()
                    return@execute Outcome.Failed(HttpStatusCode.fromValue(code), upstreamMessage(t.displayName, code, text))
                }
                if (!stream) {
                    val parsed = json.parseToJsonElement(resp.bodyAsText()) as JsonObject
                    json(Translate.fromOpenAi(parsed, requested))
                    return@execute Outcome.Done
                }
                val tr = StreamTranslator(requested, Translate.estimateTokens(req))
                val channel = resp.bodyAsChannel()
                response.header(HttpHeaders.CacheControl, "no-cache")
                respondBytesWriter(ContentType.Text.EventStream) {
                    writeStringUtf8(tr.start()); flush()
                    while (true) {
                        val line = channel.readUTF8Line() ?: break
                        if (!line.startsWith("data:")) continue
                        val data = line.removePrefix("data:").trim()
                        if (data == "[DONE]") break
                        val chunk = runCatching { json.parseToJsonElement(data) as JsonObject }.getOrNull() ?: continue
                        chunk.obj("error")?.let { err ->
                            writeStringUtf8(StreamTranslator.errorEvent(err["message"].str() ?: "Provider error")); flush()
                            return@respondBytesWriter
                        }
                        val frames = tr.feed(chunk)
                        if (frames.isNotEmpty()) { writeStringUtf8(frames); flush() }
                    }
                    writeStringUtf8(tr.finish()); flush()
                }
                Outcome.Done
            }
            // Some models reject reasoning_effort; retry once without it.
            if (outcome is Outcome.Failed && outcome.status == HttpStatusCode.BadRequest && effort != null &&
                outcome.message.contains("reasoning", ignoreCase = true)) {
                effort = null
            } else return outcome
        }
        return Outcome.Failed(HttpStatusCode.BadRequest, "${t.displayName} rejected the request.")
    }

    private suspend fun ApplicationCall.passthrough(t: Target, req: JsonObject, stream: Boolean): Outcome {
        val body = JsonObject(req + ("model" to JsonPrimitive(t.model)))
        return router.http(t.baseUrl).preparePost("${t.baseUrl}/messages") {
            router.headers(t.format, t.key).forEach { (k, v) -> header(k, v) }
            request.header("anthropic-beta")?.let { header("anthropic-beta", it) }
            contentType(ContentType.Application.Json)
            setBody(body.toString())
        }.execute { resp ->
            val code = resp.status.value
            if (code !in 200..299) return@execute Outcome.Failed(HttpStatusCode.fromValue(code), upstreamMessage(t.displayName, code, resp.bodyAsText()))
            if (!stream) {
                respondText(resp.bodyAsText(), ContentType.Application.Json)
            } else {
                val channel = resp.bodyAsChannel()
                respondBytesWriter(ContentType.Text.EventStream) {
                    while (true) {
                        val line = channel.readUTF8Line() ?: break
                        writeStringUtf8(line + "\n"); flush()
                    }
                }
            }
            Outcome.Done
        }
    }

    companion object {
        const val HOST = "127.0.0.1"
    }
}
