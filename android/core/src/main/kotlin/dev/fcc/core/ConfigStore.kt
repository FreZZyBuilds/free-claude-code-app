package dev.fcc.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.MessageDigest

@Serializable
data class CustomProviderDef(
    val providerId: String,
    val displayName: String,
    val baseUrl: String,
    val apiKeys: List<String> = emptyList(),
    val apiFormat: String = "openai_chat",
    val reasoningFormat: String = "provider_default",
    val reasoningHistoryFormat: String = "disabled",
    val modelIds: List<String> = emptyList(),
)

@Serializable
data class StoredConfig(
    /** Plain settings by Admin field key (MODEL, MODEL_OPUS, REASONING_POLICY, …). */
    val values: Map<String, String> = emptyMap(),
    /** Ordered API keys per credential field (NVIDIA_NIM_API_KEY → [k1, k2]). */
    val keys: Map<String, List<String>> = emptyMap(),
    val customProviders: List<CustomProviderDef> = emptyList(),
    /** Last discovered model ids per provider id. */
    val modelCache: Map<String, List<String>> = emptyMap(),
)

val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
}

/** Thread-safe JSON file persistence in the app's private storage. */
class ConfigStore(private val file: File) {
    @Volatile
    var current: StoredConfig = load()
        private set

    private fun load(): StoredConfig = try {
        if (file.isFile) json.decodeFromString(file.readText()) else StoredConfig()
    } catch (_: Exception) {
        StoredConfig()
    }

    @Synchronized
    fun update(transform: (StoredConfig) -> StoredConfig): StoredConfig {
        val next = transform(current)
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(json.encodeToString(next))
        if (!tmp.renameTo(file)) {
            file.delete()
            tmp.renameTo(file)
        }
        current = next
        return next
    }

    val path: String get() = file.absolutePath
}

/** Revision tokens let the editor detect concurrent edits without ever exposing key values. */
fun keyRevision(keys: List<String>): String {
    val digest = MessageDigest.getInstance("SHA-256")
    keys.forEach { digest.update(it.toByteArray()); digest.update(0) }
    return digest.digest().joinToString("") { "%02x".format(it) }
}
