package dev.fcc.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.net.URI
import java.util.UUID

/**
 * The subset of FCC's Admin API that FCC Studio uses, implemented for the embedded server.
 * Shapes match the desktop server so the same Studio UI runs unchanged.
 */
class AdminApi(private val store: ConfigStore, private val engine: Engine, private val info: () -> ServerInfo) {

    data class ServerInfo(val instanceId: String, val host: String, val port: Int, val version: String)

    class ConflictException(message: String) : Exception(message)

    private val efforts = listOf("off" to "Off", "client" to "From client", "low" to "Low", "medium" to "Medium", "high" to "High", "xhigh" to "X-High", "max" to "Max")
    private val tierNames = mapOf("FABLE" to "Fable", "OPUS" to "Opus", "SONNET" to "Sonnet", "HAIKU" to "Haiku")

    private val sections = buildJsonArray {
        fun s(id: String, label: String, desc: String) = addJsonObject {
            put("id", id); put("label", label); put("description", desc); put("advanced", false)
        }
        s("providers", "Providers", "Provider keys and local endpoints.")
        s("models", "Model Routing", "Choose a model and effort together. Tier overrides can inherit the defaults.")
        s("runtime", "Runtime", "API authentication for clients that connect to this phone's server.")
    }

    private fun field(
        key: String, label: String, section: String, type: String, value: JsonElement,
        configured: Boolean, description: String = "", secret: Boolean = false, nullable: Boolean = true,
        options: List<Pair<String, String>> = emptyList(), advanced: Boolean = false,
    ) = buildJsonObject {
        put("key", key); put("label", label); put("section", section); put("type", type); put("value", value)
        put("configured", configured); put("source", if (configured) "managed" else "default"); put("locked", false)
        put("nullable", nullable); put("secret", secret); put("advanced", advanced); put("restart_required", false)
        put("session_sensitive", false); put("description", description)
        putJsonArray("options") { options.forEach { (v, l) -> addJsonObject { put("value", v); put("label", l) } } }
    }

    private fun keyListValue(keys: List<String>) = buildJsonObject {
        put("revision", keyRevision(keys))
        putJsonArray("entries") { keys.indices.forEach { i -> addJsonObject { put("reference", i) } } }
    }

    private fun str(v: String?): JsonElement = v?.let { JsonPrimitive(it) } ?: JsonNull

    fun fields(): JsonArray {
        val c = store.current
        return buildJsonArray {
            val keyOwners = ProviderCatalog.all.filter { it.keyField != null }.groupBy { it.keyField!! }
            for ((key, owners) in keyOwners) {
                val keys = c.keys[key].orEmpty()
                add(field(key, "${owners.joinToString(" / ") { it.displayName }} API Keys", "providers", "api_key_list",
                    keyListValue(keys), keys.isNotEmpty(), "Keys are tried in order; a rate-limited key hands over to the next.", secret = true))
            }
            ProviderCatalog.all.filter { it.urlField != null }.forEach { p ->
                val v = c.values[p.urlField!!]
                add(field(p.urlField, "${p.displayName} Base URL", "providers", "text", str(v ?: p.baseUrl), true,
                    "OpenAI-compatible endpoint, for example a server running in Termux."))
            }
            add(field("MODEL", "Default Model", "models", "model", str(engine.defaultModel()), true,
                "Provider/model used when no tier-specific override applies.", nullable = false))
            tierNames.forEach { (k, name) ->
                add(field("MODEL_$k", "$name Override", "models", "optional_model", str(c.values["MODEL_$k"]), c.values["MODEL_$k"] != null,
                    "Select None to use the Default Model for $name requests."))
            }
            add(field("MODEL_FALLBACKS", "Fallback Models", "models", "model_list", str(c.values["MODEL_FALLBACKS"]), c.values["MODEL_FALLBACKS"] != null,
                "Tried in order when the selected provider/model fails before output starts.",
                options = listOf("inherit" to "Inherit") + efforts))
            add(field("REASONING_POLICY", "Default Effort", "models", "select", str(c.values["REASONING_POLICY"] ?: "client"), true,
                "From client preserves the effort your coding agent asks for.", nullable = false, options = efforts))
            tierNames.forEach { (k, name) ->
                add(field("REASONING_$k", "$name Effort", "models", "select", str(c.values["REASONING_$k"] ?: "inherit"), true,
                    nullable = false, options = listOf("inherit" to "Inherit") + efforts))
            }
            add(field("PROXY_AUTH_ENABLED", "Require API Authentication", "runtime", "boolean", str(c.values["PROXY_AUTH_ENABLED"] ?: "false"), true,
                "Require the token below on /v1 requests (x-api-key or Bearer).", nullable = false))
            val token = c.values["ANTHROPIC_AUTH_TOKEN"]
            add(field("ANTHROPIC_AUTH_TOKEN", "API Token", "runtime", "secret", JsonNull, token != null,
                "Clients send this as ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY.", secret = true))
        }
    }

    private val fieldTypes: Map<String, String> by lazy {
        fields().associate { (it as JsonObject)["key"].str()!! to it["type"].str()!! }
    }

    fun providerStatus(): JsonArray {
        val c = store.current
        return buildJsonArray {
            ProviderCatalog.all.forEach { p ->
                val configured = if (p.local) true else !c.keys[p.keyField].isNullOrEmpty()
                addJsonObject {
                    put("provider_id", p.id); put("display_name", p.displayName); put("website_url", p.websiteUrl)
                    put("logo_filename", p.logo); put("kind", if (p.local) "local" else "remote")
                    put("status", if (configured) "configured" else "missing_key")
                    put("label", if (configured) "Configured" else "Missing key")
                    val cfg = listOfNotNull(p.keyField ?: p.urlField)
                    put("configuration_keys", jsonStrings(cfg))
                    put("missing_configuration_keys", jsonStrings(if (configured) emptyList() else cfg))
                    put("settings_keys", jsonStrings(cfg))
                }
            }
        }
    }

    fun customProviders(): JsonArray = buildJsonArray {
        store.current.customProviders.forEach { cp ->
            addJsonObject {
                put("provider_id", cp.providerId); put("display_name", cp.displayName); put("base_url", cp.baseUrl)
                put("api_keys", keyListValue(cp.apiKeys)); put("api_format", cp.apiFormat)
                put("reasoning_format", cp.reasoningFormat); put("reasoning_history_format", cp.reasoningHistoryFormat)
                put("model_ids", jsonStrings(cp.modelIds))
            }
        }
    }

    fun config(): JsonObject = buildJsonObject {
        put("sections", sections)
        put("fields", fields())
        putJsonObject("paths") { put("managed", store.path) }
        put("provider_status", providerStatus())
        put("custom_providers", customProviders())
        put("custom_providers_locked", false)
        putJsonObject("custom_reasoning_formats") {
            put("openai_chat", jsonStrings(listOf("provider_default")))
            put("anthropic_messages", jsonStrings(listOf("provider_default")))
        }
    }

    fun status(): JsonObject {
        val i = info()
        val model = engine.defaultModel()
        return buildJsonObject {
            put("status", "running"); put("instance_id", i.instanceId); put("edition", "mobile"); put("version", i.version)
            putJsonObject("startup") {
                put("generation_id", 1); put("catalog_revision", 0); put("catalog", "ready"); put("catalog_file", "ready")
                putJsonObject("providers") { engine.configuredProviderIds().forEach { put(it, "ready") } }
                putJsonObject("provider_errors") {}
            }
            put("host", i.host); put("port", i.port); put("model", model); put("provider", model.substringBefore('/'))
            put("pending_fields", JsonArray(emptyList())); put("provider_status", providerStatus())
            putJsonObject("cached_models") {}
        }
    }

    fun models(failed: List<String> = emptyList()): JsonObject {
        val (models, labels) = engine.catalog()
        return buildJsonObject {
            put("models", jsonStrings(models))
            putJsonObject("model_labels") { labels.forEach { (k, v) -> put(k, v) } }
            put("failed_providers", jsonStrings(failed))
        }
    }

    // ---- apply ---------------------------------------------------------------------------

    private fun applyKeyMutation(current: List<String>, mutation: JsonObject): List<String> {
        val revision = mutation["revision"].str()
        if (revision != null && revision != keyRevision(current) && current.isNotEmpty()) {
            throw ConflictException("These keys changed since the page loaded. Reload and try again.")
        }
        val out = mutableListOf<String>()
        (mutation.arr("entries") ?: JsonArray(emptyList())).forEach { e ->
            val o = e as? JsonObject ?: return@forEach
            val value = o["value"].str()?.trim()
            val retain = o["retain"]?.jsonPrimitive?.intOrNull
            when {
                !value.isNullOrEmpty() -> out += value
                retain != null -> current.getOrNull(retain)?.let { out += it }
                    ?: throw IllegalArgumentException("A saved key no longer exists. Reload and try again.")
                else -> throw IllegalArgumentException("Enter a key or remove the empty row.")
            }
        }
        if (out.toSet().size != out.size) throw IllegalArgumentException("The same key is listed twice.")
        return out
    }

    private fun result(applied: Boolean, errors: List<String> = emptyList(), customId: String? = null) = buildJsonObject {
        put("custom_provider_id", str(customId)); put("applied", applied); put("valid", applied)
        put("errors", jsonStrings(errors)); put("path", store.path)
        put("pending_fields", JsonArray(emptyList()))
        putJsonObject("restart") { put("required", false); put("automatic", false); put("admin_url", JsonNull); put("fields", JsonArray(emptyList())) }
        put("credential_checks", JsonArray(emptyList()))
    }

    fun apply(body: JsonObject): JsonObject = try {
        body.obj("custom_provider")?.let { return applyCustom(it) }
        val values = body.obj("values") ?: JsonObject(emptyMap())
        store.update { cfg ->
            var next = cfg
            for ((key, v) in values) {
                val type = fieldTypes[key] ?: continue
                when {
                    type == "api_key_list" -> {
                        val mutation = v as? JsonObject ?: continue
                        val keys = applyKeyMutation(next.keys[key].orEmpty(), mutation)
                        next = next.copy(keys = if (keys.isEmpty()) next.keys - key else next.keys + (key to keys))
                    }
                    v is JsonNull -> next = next.copy(values = next.values - key)
                    type == "secret" && v.str() == "********" -> Unit
                    else -> {
                        val s = (v as? JsonPrimitive)?.contentOrNull ?: v.toString()
                        if (key == "MODEL_FALLBACKS") runCatching { json.decodeFromString<List<Fallback>>(s) }
                            .getOrElse { throw IllegalArgumentException("Fallback list is not valid.") }
                        if ((type == "model" || type == "optional_model") && !s.contains('/'))
                            throw IllegalArgumentException("$key must be a provider/model reference.")
                        next = next.copy(values = next.values + (key to s))
                    }
                }
            }
            next
        }
        result(true)
    } catch (e: IllegalArgumentException) {
        result(false, listOf(e.message ?: "Invalid value."))
    }

    private fun applyCustom(m: JsonObject): JsonObject {
        val action = m["action"].str()
        val values = m.obj("values") ?: JsonObject(emptyMap())
        var id = m["provider_id"].str()
        try {
            store.update { cfg ->
                val list = cfg.customProviders.toMutableList()
                when (action) {
                    "delete" -> {
                        val refs = (listOf("MODEL") + TIER_KEYS.map { it.second }).filter { cfg.values[it]?.startsWith("$id/") == true } +
                            (if (engine.fallbacks().any { it.model.startsWith("$id/") }) listOf("MODEL_FALLBACKS") else emptyList())
                        if (refs.isNotEmpty()) throw IllegalArgumentException("Change these routing settings before removing the provider: ${refs.joinToString()}")
                        list.removeAll { it.providerId == id }
                    }
                    "create", "update" -> {
                        val existing = list.firstOrNull { it.providerId == id }
                        if (action == "update" && existing == null) throw IllegalArgumentException("This custom provider no longer exists.")
                        if (action == "create") id = "custom_" + UUID.randomUUID().toString().replace("-", "")
                        val name = (values["display_name"].str() ?: existing?.displayName ?: "").trim()
                        val base = (values["base_url"].str() ?: existing?.baseUrl ?: "").trim().trimEnd('/')
                        if (name.isEmpty()) throw IllegalArgumentException("display_name: Name is required")
                        val uri = runCatching { URI(base) }.getOrNull()
                        if (uri == null || uri.scheme !in setOf("http", "https") || uri.host.isNullOrEmpty() || uri.userInfo != null || uri.query != null)
                            throw IllegalArgumentException("base_url: Base URL must be an HTTP or HTTPS API address")
                        if (list.any { it.providerId != id && it.displayName.equals(name, ignoreCase = true) })
                            throw IllegalArgumentException("A custom provider with this name already exists")
                        val format = values["api_format"].str() ?: existing?.apiFormat ?: "openai_chat"
                        if (format !in setOf("openai_chat", "anthropic_messages"))
                            throw IllegalArgumentException("api_format: $format is not supported on Android")
                        val keys = (values["api_keys"] as? JsonObject)?.let { applyKeyMutation(existing?.apiKeys.orEmpty(), it) } ?: existing?.apiKeys.orEmpty()
                        val models = values.arr("model_ids")?.mapNotNull { it.str()?.trim()?.takeIf(String::isNotEmpty) } ?: existing?.modelIds.orEmpty()
                        val def = CustomProviderDef(id!!, name, base, keys, format,
                            values["reasoning_format"].str() ?: existing?.reasoningFormat ?: "provider_default",
                            values["reasoning_history_format"].str() ?: existing?.reasoningHistoryFormat ?: "disabled", models)
                        val i = list.indexOfFirst { it.providerId == id }
                        if (i >= 0) list[i] = def else list += def
                    }
                    else -> throw IllegalArgumentException("Unknown action.")
                }
                cfg.copy(customProviders = list, modelCache = if (action == "delete") cfg.modelCache - id!! else cfg.modelCache)
            }
        } catch (e: IllegalArgumentException) {
            return result(false, listOf(e.message ?: "Invalid provider."), id)
        }
        return result(true, customId = id)
    }

    suspend fun test(providerId: String): JsonObject {
        val r = engine.listModels(providerId)
        return buildJsonObject {
            put("provider_id", providerId); put("ok", r.ok)
            r.message?.let { put("message", it) }
            put("models", jsonStrings(r.models))
        }
    }

    suspend fun localStatus(providerId: String): JsonObject? {
        val p = ProviderCatalog[providerId]?.takeIf { it.local } ?: return null
        val base = (store.current.values[p.urlField!!] ?: p.baseUrl).trimEnd('/')
        val started = System.nanoTime()
        val r = engine.listModels(providerId)
        return buildJsonObject {
            put("provider_id", providerId); put("status", if (r.ok) "reachable" else "offline")
            put("label", if (r.ok) "Reachable" else "Offline"); put("base_url", base); put("probe_path", "/models")
            put("latency_ms", (System.nanoTime() - started) / 1_000_000.0)
            put("error_type", if (r.ok) JsonNull else JsonPrimitive("connection_error"))
            r.message?.let { put("message", it) }
        }
    }
}
