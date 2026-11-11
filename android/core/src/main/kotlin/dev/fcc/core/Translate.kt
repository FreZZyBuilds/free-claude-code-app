package dev.fcc.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.util.UUID

/*
  Anthropic Messages  <->  OpenAI Chat Completions.
  Request side: system, text, images, tool_use / tool_result, tools, tool_choice, sampling params.
  Response side: text, reasoning (reasoning_content, reasoning, or <think> tags), tool calls,
  stop reasons and usage, both streamed and non-streamed.
*/

internal fun JsonElement?.str(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
internal fun JsonObject.obj(key: String): JsonObject? = this[key] as? JsonObject
internal fun JsonObject.arr(key: String): JsonArray? = this[key] as? JsonArray

object Translate {

    fun systemText(system: JsonElement?): String? = when (system) {
        null, JsonNull -> null
        is JsonPrimitive -> system.contentOrNull
        is JsonArray -> system.mapNotNull { (it as? JsonObject)?.get("text").str() }.joinToString("\n\n")
        else -> null
    }?.takeIf { it.isNotBlank() }

    private fun toolResultText(content: JsonElement?): String = when (content) {
        null, JsonNull -> ""
        is JsonPrimitive -> content.content
        is JsonArray -> content.joinToString("\n") { block ->
            val b = block as? JsonObject
            when (b?.get("type").str()) {
                "text" -> b?.get("text").str() ?: ""
                "image" -> "[image]"
                else -> b?.toString() ?: ""
            }
        }
        else -> content.toString()
    }

    private fun imageUrl(block: JsonObject): String? {
        val source = block.obj("source") ?: return null
        return when (source["type"].str()) {
            "base64" -> "data:${source["media_type"].str() ?: "image/png"};base64,${source["data"].str()}"
            "url" -> source["url"].str()
            else -> null
        }
    }

    /** Convert an Anthropic /v1/messages body into an OpenAI chat.completions body. */
    fun toOpenAi(req: JsonObject, model: String, reasoningEffort: String?): JsonObject {
        val messages = buildJsonArray {
            systemText(req["system"])?.let { s -> addJsonObject { put("role", "system"); put("content", s) } }
            for (m in req.arr("messages") ?: JsonArray(emptyList())) {
                val msg = m as? JsonObject ?: continue
                val role = msg["role"].str() ?: "user"
                val content = msg["content"]
                if (content is JsonPrimitive) {
                    addJsonObject { put("role", role); put("content", content.content) }
                    continue
                }
                val blocks = (content as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
                if (role == "assistant") {
                    val text = blocks.filter { it["type"].str() == "text" }.joinToString("") { it["text"].str() ?: "" }
                    val calls = blocks.filter { it["type"].str() == "tool_use" }
                    addJsonObject {
                        put("role", "assistant")
                        if (text.isNotEmpty() || calls.isEmpty()) put("content", text) else put("content", JsonNull)
                        if (calls.isNotEmpty()) putJsonArray("tool_calls") {
                            calls.forEach { c ->
                                addJsonObject {
                                    put("id", c["id"].str() ?: "call_${UUID.randomUUID()}")
                                    put("type", "function")
                                    putJsonObject("function") {
                                        put("name", c["name"].str() ?: "tool")
                                        put("arguments", (c["input"] ?: JsonObject(emptyMap())).toString())
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Tool results must directly follow the assistant tool_calls message.
                    blocks.filter { it["type"].str() == "tool_result" }.forEach { r ->
                        addJsonObject {
                            put("role", "tool")
                            put("tool_call_id", r["tool_use_id"].str() ?: "")
                            val text = toolResultText(r["content"])
                            val isError = (r["is_error"] as? JsonPrimitive)?.contentOrNull == "true"
                            put("content", if (isError) "Error: $text" else text)
                        }
                    }
                    val parts = blocks.filter { it["type"].str() == "text" || it["type"].str() == "image" }
                    if (parts.isNotEmpty()) addJsonObject {
                        put("role", "user")
                        if (parts.all { it["type"].str() == "text" }) {
                            put("content", parts.joinToString("\n") { it["text"].str() ?: "" })
                        } else putJsonArray("content") {
                            parts.forEach { p ->
                                if (p["type"].str() == "text") addJsonObject { put("type", "text"); put("text", p["text"].str() ?: "") }
                                else imageUrl(p)?.let { url ->
                                    addJsonObject { put("type", "image_url"); putJsonObject("image_url") { put("url", url) } }
                                }
                            }
                        }
                    }
                }
            }
        }

        return buildJsonObject {
            put("model", model)
            put("messages", messages)
            req["max_tokens"]?.let { put("max_tokens", it) }
            req["temperature"]?.let { put("temperature", it) }
            req["top_p"]?.let { put("top_p", it) }
            req.arr("stop_sequences")?.takeIf { it.isNotEmpty() }?.let { put("stop", it) }
            val stream = (req["stream"] as? JsonPrimitive)?.contentOrNull == "true"
            put("stream", stream)
            if (stream) putJsonObject("stream_options") { put("include_usage", true) }
            reasoningEffort?.let { put("reasoning_effort", it) }

            val tools = req.arr("tools")?.mapNotNull { it as? JsonObject }?.filter { it["input_schema"] != null }
            if (!tools.isNullOrEmpty()) {
                putJsonArray("tools") {
                    tools.forEach { t ->
                        addJsonObject {
                            put("type", "function")
                            putJsonObject("function") {
                                put("name", t["name"].str() ?: "tool")
                                t["description"].str()?.let { put("description", it) }
                                put("parameters", t["input_schema"]!!)
                            }
                        }
                    }
                }
                req.obj("tool_choice")?.let { tc ->
                    when (tc["type"].str()) {
                        "auto" -> put("tool_choice", "auto")
                        "any" -> put("tool_choice", "required")
                        "none" -> put("tool_choice", "none")
                        "tool" -> putJsonObject("tool_choice") {
                            put("type", "function")
                            putJsonObject("function") { put("name", tc["name"].str() ?: "") }
                        }
                    }
                }
            }
        }
    }

    fun stopReason(finish: String?): String = when (finish) {
        "length" -> "max_tokens"
        "tool_calls", "function_call" -> "tool_use"
        "content_filter" -> "refusal"
        else -> "end_turn"
    }

    /** Non-streaming OpenAI response → Anthropic message. */
    fun fromOpenAi(resp: JsonObject, requestedModel: String): JsonObject {
        val choice = resp.arr("choices")?.firstOrNull() as? JsonObject
        val message = choice?.obj("message")
        val usage = resp.obj("usage")
        val splitter = ThinkSplitter()
        val content = buildJsonArray {
            val reasoning = message?.get("reasoning_content").str() ?: message?.get("reasoning").str()
            val (thinkFromTags, text) = splitter.feedAll(message?.get("content").str() ?: "")
            val thinking = listOfNotNull(reasoning, thinkFromTags.takeIf { it.isNotEmpty() }).joinToString("\n")
            if (thinking.isNotBlank()) addJsonObject { put("type", "thinking"); put("thinking", thinking); put("signature", "") }
            if (text.isNotEmpty()) addJsonObject { put("type", "text"); put("text", text) }
            message?.arr("tool_calls")?.forEach { c ->
                val call = c as? JsonObject ?: return@forEach
                val fn = call.obj("function")
                addJsonObject {
                    put("type", "tool_use")
                    put("id", call["id"].str() ?: "toolu_${UUID.randomUUID()}")
                    put("name", fn?.get("name").str() ?: "tool")
                    put("input", parseArgs(fn?.get("arguments").str()))
                }
            }
        }
        return buildJsonObject {
            put("id", "msg_${UUID.randomUUID()}")
            put("type", "message")
            put("role", "assistant")
            put("model", requestedModel)
            put("content", content)
            put("stop_reason", stopReason(choice?.get("finish_reason").str()))
            put("stop_sequence", JsonNull)
            putJsonObject("usage") {
                put("input_tokens", usage?.get("prompt_tokens")?.jsonPrimitive?.intOrNull ?: 0)
                put("output_tokens", usage?.get("completion_tokens")?.jsonPrimitive?.intOrNull ?: 0)
            }
        }
    }

    fun parseArgs(args: String?): JsonElement {
        if (args.isNullOrBlank()) return JsonObject(emptyMap())
        return try {
            json.parseToJsonElement(args).takeIf { it is JsonObject } ?: JsonObject(mapOf("value" to JsonPrimitive(args)))
        } catch (_: Exception) {
            JsonObject(mapOf("raw" to JsonPrimitive(args)))
        }
    }

    /** Rough token estimate (~4 chars/token) for /v1/messages/count_tokens. */
    fun estimateTokens(req: JsonObject): Int {
        val chars = (req["system"]?.toString()?.length ?: 0) +
            (req["messages"]?.toString()?.length ?: 0) +
            (req["tools"]?.toString()?.length ?: 0)
        return maxOf(1, chars / 4)
    }
}

/** Splits `<think>…</think>` spans out of streamed text, tolerating tags cut across chunks. */
class ThinkSplitter {
    private var inThink = false
    private var pending = ""

    /** Returns (thinking, text) produced by this chunk. */
    fun feed(chunk: String): Pair<String, String> {
        val think = StringBuilder()
        val text = StringBuilder()
        var s = pending + chunk
        pending = ""
        while (s.isNotEmpty()) {
            val tag = if (inThink) "</think>" else "<think>"
            val i = s.indexOf(tag)
            if (i >= 0) {
                (if (inThink) think else text).append(s, 0, i)
                s = s.substring(i + tag.length)
                inThink = !inThink
                continue
            }
            // Keep a possible partial tag at the end for the next chunk.
            val keep = (1 until tag.length).lastOrNull { s.endsWith(tag.substring(0, it)) } ?: 0
            (if (inThink) think else text).append(s, 0, s.length - keep)
            pending = s.substring(s.length - keep)
            s = ""
        }
        return think.toString() to text.toString()
    }

    fun flush(): Pair<String, String> {
        val rest = pending
        pending = ""
        return if (inThink) rest to "" else "" to rest
    }

    fun feedAll(s: String): Pair<String, String> {
        val (a, b) = feed(s)
        val (c, d) = flush()
        return (a + c) to (b + d)
    }
}

/**
 * Turns OpenAI streaming chunks into Anthropic SSE events. Feed each parsed `data:` object,
 * then call [finish]. Every call returns complete `event:`/`data:` frames ready to write.
 */
class StreamTranslator(private val model: String, private val inputTokens: Int) {
    private val out = StringBuilder()
    private var started = false
    private var blockIndex = -1
    private var blockType: String? = null
    private val toolBlocks = mutableMapOf<Int, Int>()
    private var activeTool: Int? = null
    private var stop: String? = null
    private var outputTokens = 0
    private var promptTokens: Int? = null
    private val think = ThinkSplitter()
    var sawContent = false
        private set

    private fun emit(event: String, data: JsonObject) {
        out.append("event: ").append(event).append('\n').append("data: ").append(data.toString()).append("\n\n")
    }

    private fun take(): String = out.toString().also { out.setLength(0) }

    fun start(): String {
        if (!started) {
            started = true
            emit("message_start", buildJsonObject {
                put("type", "message_start")
                putJsonObject("message") {
                    put("id", "msg_${UUID.randomUUID()}")
                    put("type", "message")
                    put("role", "assistant")
                    put("model", model)
                    put("content", JsonArray(emptyList()))
                    put("stop_reason", JsonNull)
                    put("stop_sequence", JsonNull)
                    putJsonObject("usage") { put("input_tokens", inputTokens); put("output_tokens", 1) }
                }
            })
        }
        return take()
    }

    private fun closeBlock() {
        if (blockType != null) {
            emit("content_block_stop", buildJsonObject { put("type", "content_block_stop"); put("index", blockIndex) })
            blockType = null
            activeTool = null
        }
    }

    private fun openBlock(type: String, block: JsonObject) {
        closeBlock()
        blockIndex++
        blockType = type
        emit("content_block_start", buildJsonObject { put("type", "content_block_start"); put("index", blockIndex); put("content_block", block) })
    }

    private fun thinking(text: String) {
        if (text.isEmpty()) return
        sawContent = true
        if (blockType != "thinking") openBlock("thinking", buildJsonObject { put("type", "thinking"); put("thinking", ""); put("signature", "") })
        emit("content_block_delta", buildJsonObject {
            put("type", "content_block_delta"); put("index", blockIndex)
            putJsonObject("delta") { put("type", "thinking_delta"); put("thinking", text) }
        })
    }

    private fun text(text: String) {
        if (text.isEmpty()) return
        sawContent = true
        if (blockType != "text") openBlock("text", buildJsonObject { put("type", "text"); put("text", "") })
        emit("content_block_delta", buildJsonObject {
            put("type", "content_block_delta"); put("index", blockIndex)
            putJsonObject("delta") { put("type", "text_delta"); put("text", text) }
        })
    }

    fun feed(chunk: JsonObject): String {
        start()
        chunk.obj("usage")?.let { u ->
            u["completion_tokens"]?.jsonPrimitive?.intOrNull?.let { outputTokens = it }
            u["prompt_tokens"]?.jsonPrimitive?.intOrNull?.let { promptTokens = it }
        }
        val choice = chunk.arr("choices")?.firstOrNull() as? JsonObject ?: return take()
        val delta = choice.obj("delta")
        if (delta != null) {
            (delta["reasoning_content"].str() ?: delta["reasoning"].str())?.let { thinking(it) }
            delta["content"].str()?.let { c ->
                val (t, x) = think.feed(c)
                thinking(t)
                text(x)
            }
            delta.arr("tool_calls")?.forEach { tc ->
                val call = tc as? JsonObject ?: return@forEach
                val idx = call["index"]?.jsonPrimitive?.intOrNull ?: 0
                val fn = call.obj("function")
                if (idx !in toolBlocks) {
                    sawContent = true
                    openBlock("tool_use", buildJsonObject {
                        put("type", "tool_use")
                        put("id", call["id"].str() ?: "toolu_${UUID.randomUUID()}")
                        put("name", fn?.get("name").str() ?: "tool")
                        put("input", JsonObject(emptyMap()))
                    })
                    toolBlocks[idx] = blockIndex
                    activeTool = idx
                }
                val args = fn?.get("arguments").str()
                if (!args.isNullOrEmpty() && activeTool == idx) {
                    emit("content_block_delta", buildJsonObject {
                        put("type", "content_block_delta"); put("index", toolBlocks[idx]!!)
                        putJsonObject("delta") { put("type", "input_json_delta"); put("partial_json", args) }
                    })
                }
            }
        }
        choice["finish_reason"].str()?.let { stop = Translate.stopReason(it) }
        return take()
    }

    fun finish(): String {
        start()
        val (t, x) = think.flush()
        thinking(t)
        text(x)
        closeBlock()
        emit("message_delta", buildJsonObject {
            put("type", "message_delta")
            putJsonObject("delta") { put("stop_reason", stop ?: "end_turn"); put("stop_sequence", JsonNull) }
            putJsonObject("usage") {
                put("output_tokens", outputTokens)
                promptTokens?.let { put("input_tokens", it) }
            }
        })
        emit("message_stop", buildJsonObject { put("type", "message_stop") })
        return take()
    }

    companion object {
        fun errorEvent(message: String, type: String = "api_error"): String {
            val data = buildJsonObject {
                put("type", "error")
                putJsonObject("error") { put("type", type); put("message", message) }
            }
            return "event: error\ndata: $data\n\n"
        }
    }
}

fun anthropicError(message: String, type: String = "api_error"): JsonObject = buildJsonObject {
    put("type", "error")
    putJsonObject("error") { put("type", type); put("message", message) }
}

@Suppress("unused")
private fun JsonArray.strings(): List<String> = mapNotNull { it.str() }

internal fun jsonStrings(values: List<String>): JsonArray = buildJsonArray { values.forEach { add(it) } }

internal fun JsonElement.asObject(): JsonObject? = this as? JsonObject
internal fun JsonElement.asArray(): JsonArray? = runCatching { jsonArray }.getOrNull()
internal fun JsonElement.objOrNull(): JsonObject? = runCatching { jsonObject }.getOrNull()
