package dev.fcc.core

import io.ktor.client.HttpClient
import io.ktor.client.engine.ProxyBuilder
import io.ktor.client.engine.cio.CIO
import io.ktor.client.engine.http
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import java.util.concurrent.ConcurrentHashMap

/** One concrete upstream to try: provider + model + key. */
data class Target(
    val providerId: String,
    val displayName: String,
    val baseUrl: String,
    val format: ApiFormat,
    val model: String,
    val key: String?,
    val keyNumber: Int,
    val reasoning: String,
)

@Serializable
data class Fallback(val model: String, val reasoning: String = "inherit", val api_key_number: Int = 1)

val TIER_KEYS = listOf("fable" to "MODEL_FABLE", "opus" to "MODEL_OPUS", "sonnet" to "MODEL_SONNET", "haiku" to "MODEL_HAIKU")
const val DEFAULT_MODEL = "nvidia_nim/nvidia/nemotron-3-ultra-550b-a55b"

class Engine(private val store: ConfigStore) {

    private fun client(proxied: Boolean) = HttpClient(CIO) {
        install(HttpTimeout) {
            connectTimeoutMillis = 15_000
            requestTimeoutMillis = 30 * 60_000L
            socketTimeoutMillis = 5 * 60_000L
        }
        expectSuccess = false
        engine {
            // Honour a system HTTP proxy (Android Wi-Fi proxy settings, corporate networks).
            val host = System.getProperty("https.proxyHost") ?: System.getProperty("http.proxyHost")
            val port = (System.getProperty("https.proxyPort") ?: System.getProperty("http.proxyPort"))?.toIntOrNull()
            if (proxied && !host.isNullOrBlank() && port != null) proxy = ProxyBuilder.http("http://$host:$port")
        }
    }

    private val direct = client(proxied = false)
    private val viaProxy = client(proxied = true)

    /** Local and private-network endpoints (Ollama, llama.cpp, LAN boxes) never go through a proxy. */
    fun http(url: String): HttpClient {
        val host = runCatching { java.net.URI(url).host }.getOrNull()?.lowercase() ?: return viaProxy
        val private = host == "localhost" || host.startsWith("127.") || host == "::1" || host.startsWith("10.") ||
            host.startsWith("192.168.") || Regex("^172\\.(1[6-9]|2\\d|3[01])\\.").containsMatchIn(host) || host.endsWith(".local")
        return if (private) direct else viaProxy
    }

    /** Providers that answered 429 recently, by "provider#keyNumber" → retry-after epoch ms. */
    private val cooling = ConcurrentHashMap<String, Long>()

    val config get() = store.current

    fun value(key: String): String? = config.values[key]?.takeIf { it.isNotBlank() }

    fun defaultModel(): String = value("MODEL") ?: DEFAULT_MODEL

    data class ResolvedProvider(val id: String, val name: String, val baseUrl: String, val format: ApiFormat, val keys: List<String>, val local: Boolean)

    fun provider(id: String): ResolvedProvider? {
        ProviderCatalog[id]?.let { p ->
            val base = p.urlField?.let { value(it) } ?: p.baseUrl
            val keys = p.keyField?.let { config.keys[it] }.orEmpty()
            return ResolvedProvider(p.id, p.displayName, base.trimEnd('/'), p.format, keys, p.local)
        }
        config.customProviders.firstOrNull { it.providerId == id }?.let { c ->
            val fmt = if (c.apiFormat == "anthropic_messages") ApiFormat.ANTHROPIC_MESSAGES else ApiFormat.OPENAI_CHAT
            return ResolvedProvider(c.providerId, c.displayName, c.baseUrl.trimEnd('/'), fmt, c.apiKeys, false)
        }
        return null
    }

    /** Which route a requested model name maps to: a tier, or a direct provider/model ref. */
    fun route(requested: String): Pair<String, String> {
        val lower = requested.lowercase()
        if (requested.contains('/') && provider(requested.substringBefore('/')) != null) {
            return requested to (value("REASONING_POLICY") ?: "client")
        }
        for ((tier, key) in TIER_KEYS) {
            if (lower.contains(tier)) {
                val model = value(key) ?: defaultModel()
                val effort = value("REASONING_${tier.uppercase()}")?.takeIf { it != "inherit" } ?: value("REASONING_POLICY") ?: "client"
                return model to effort
            }
        }
        return defaultModel() to (value("REASONING_POLICY") ?: "client")
    }

    fun fallbacks(): List<Fallback> = value("MODEL_FALLBACKS")?.let {
        runCatching { json.decodeFromString<List<Fallback>>(it) }.getOrNull()
    }.orEmpty()

    /** Ordered candidates: primary (all keys, starting with ones not cooling down), then fallbacks. */
    fun candidates(requested: String): List<Target> {
        val (primary, effort) = route(requested)
        val out = mutableListOf<Target>()
        fun add(ref: String, reasoning: String, onlyKey: Int?) {
            val pid = ref.substringBefore('/', "")
            val p = provider(pid) ?: return
            val model = ref.substringAfter('/')
            val keys: List<String?> = p.keys.ifEmpty { listOf(null) }
            val numbered = keys.mapIndexed { i, k -> (i + 1) to k }
                .filter { onlyKey == null || it.first == onlyKey }
                .sortedBy { (n, _) -> if ((cooling["$pid#$n"] ?: 0) > System.currentTimeMillis()) 1 else 0 }
            numbered.forEach { (n, k) -> out += Target(p.id, p.name, p.baseUrl, p.format, model, k, n, reasoning) }
        }
        add(primary, effort, null)
        fallbacks().forEach { f ->
            add(f.model, if (f.reasoning == "inherit") effort else f.reasoning, f.api_key_number)
        }
        return out.distinctBy { "${it.providerId}/${it.model}#${it.keyNumber}" }
    }

    fun coolDown(t: Target, seconds: Long = 30) {
        cooling["${t.providerId}#${t.keyNumber}"] = System.currentTimeMillis() + seconds * 1000
    }

    /** OpenAI reasoning_effort for a policy, given what the client asked for. */
    fun reasoningEffort(policy: String, req: JsonObject): String? = when (policy) {
        "off" -> null
        "low", "medium", "high" -> policy
        "xhigh", "max" -> "high"
        else -> {
            val thinking = req.obj("thinking")
            if (thinking?.get("type").str() == "enabled") {
                val budget = thinking?.get("budget_tokens")?.toString()?.toIntOrNull() ?: 4096
                when {
                    budget < 4096 -> "low"
                    budget < 16384 -> "medium"
                    else -> "high"
                }
            } else null
        }
    }

    fun headers(p: ApiFormat, key: String?): Map<String, String> = buildMap {
        if (p == ApiFormat.ANTHROPIC_MESSAGES) {
            key?.let { put("x-api-key", it) }
            put("anthropic-version", "2023-06-01")
        } else {
            key?.let { put("Authorization", "Bearer $it") }
        }
    }

    // ---- model discovery ----------------------------------------------------------------

    data class ListResult(val ok: Boolean, val models: List<String>, val message: String?)

    suspend fun listModels(providerId: String): ListResult {
        val p = provider(providerId) ?: return ListResult(false, emptyList(), "Unknown provider.")
        val custom = config.customProviders.firstOrNull { it.providerId == providerId }
        if (custom != null && custom.modelIds.isNotEmpty()) return ListResult(true, custom.modelIds, null)
        if (!p.local && p.keys.isEmpty() && custom == null) return ListResult(false, emptyList(), "Add an API key first.")
        return try {
            val resp = http(p.baseUrl).get("${p.baseUrl}/models") {
                headers(p.format, p.keys.firstOrNull()).forEach { (k, v) -> header(k, v) }
            }
            val body = resp.bodyAsText()
            if (resp.status.value !in 200..299) {
                val msg = runCatching { json.parseToJsonElement(body).objOrNull()?.let { o -> o.obj("error")?.get("message").str() ?: o["message"].str() } }.getOrNull()
                return ListResult(false, emptyList(), msg ?: "HTTP ${resp.status.value} from ${p.name}.")
            }
            val data = json.parseToJsonElement(body).objOrNull()?.arr("data") ?: json.parseToJsonElement(body).asArray()
            val ids = data?.mapNotNull { (it as? JsonObject)?.get("id").str() }?.sorted().orEmpty()
            store.update { it.copy(modelCache = it.modelCache + (providerId to ids)) }
            ListResult(true, ids, null)
        } catch (e: Exception) {
            ListResult(false, emptyList(), "Could not reach ${p.name}: ${e.message ?: e::class.simpleName}")
        }
    }

    fun configuredProviderIds(): List<String> =
        ProviderCatalog.all.filter { p -> (p.keyField?.let { !config.keys[it].isNullOrEmpty() } ?: false) }.map { it.id } +
            config.customProviders.map { it.providerId }

    suspend fun refreshAll(): List<String> = coroutineScope {
        configuredProviderIds().map { id -> async { id to listModels(id).ok } }.awaitAll().filterNot { it.second }.map { it.first }
    }

    /** Catalog: cached discovered models plus every model referenced by routing. */
    fun catalog(): Pair<List<String>, Map<String, String>> {
        val refs = linkedSetOf<String>()
        val labels = mutableMapOf<String, String>()
        for ((pid, models) in config.modelCache) {
            val p = provider(pid) ?: continue
            models.forEach { m ->
                refs += "$pid/$m"
                labels["$pid/$m"] = if (pid.startsWith("custom_")) "${p.name}/$m" else "$pid/$m"
            }
        }
        (listOf(defaultModel()) + TIER_KEYS.mapNotNull { value(it.second) } + fallbacks().map { it.model }).forEach {
            refs += it
            labels.putIfAbsent(it, it)
        }
        return refs.sorted() to labels
    }
}
