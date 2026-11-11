package dev.fcc.core

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TranslateTest {
    private fun obj(s: String) = json.parseToJsonElement(s) as JsonObject

    @Test
    fun `tool results follow the assistant tool call and system is hoisted`() {
        val req = obj("""{"system":[{"type":"text","text":"sys"}],"max_tokens":10,"messages":[
            {"role":"user","content":"go"},
            {"role":"assistant","content":[{"type":"text","text":"ok"},{"type":"tool_use","id":"t1","name":"Read","input":{"p":1}}]},
            {"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"data","is_error":true},{"type":"text","text":"next"}]}],
            "tools":[{"name":"Read","input_schema":{"type":"object"}},{"type":"web_search_20250305","name":"web_search"}],
            "tool_choice":{"type":"any"}}""")
        val out = Translate.toOpenAi(req, "m", null)
        val msgs = out["messages"]!!.jsonArray.map { it.jsonObject }
        assertEquals(listOf("system", "user", "assistant", "tool", "user"), msgs.map { it["role"]!!.jsonPrimitive.content })
        assertEquals("Error: data", msgs[3]["content"]!!.jsonPrimitive.content)
        assertEquals("t1", msgs[2]["tool_calls"]!!.jsonArray[0].jsonObject["id"]!!.jsonPrimitive.content)
        assertEquals(1, out["tools"]!!.jsonArray.size, "server tools without input_schema are dropped")
        assertEquals("required", out["tool_choice"]!!.jsonPrimitive.content)
    }

    @Test
    fun `images become data urls`() {
        val req = obj("""{"messages":[{"role":"user","content":[{"type":"text","text":"see"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"AAA"}}]}]}""")
        val part = Translate.toOpenAi(req, "m", null)["messages"]!!.jsonArray[0].jsonObject["content"]!!.jsonArray[1].jsonObject
        assertEquals("data:image/png;base64,AAA", part["image_url"]!!.jsonObject["url"]!!.jsonPrimitive.content)
    }

    @Test
    fun `think tags split across chunks`() {
        val s = ThinkSplitter()
        val parts = listOf("<thi", "nk>abc</th", "ink>xyz").map { s.feed(it) } + s.flush()
        assertEquals("abc", parts.joinToString("") { it.first })
        assertEquals("xyz", parts.joinToString("") { it.second })
    }

    @Test
    fun `stream translator emits a complete tool_use message`() {
        val t = StreamTranslator("claude", 5)
        val frames = buildString {
            append(t.start())
            append(t.feed(obj("""{"choices":[{"delta":{"content":"Hi"}}]}""")))
            append(t.feed(obj("""{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c","function":{"name":"Bash","arguments":"{\"a\""}}]}}]}""")))
            append(t.feed(obj("""{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":1}"}}]},"finish_reason":"tool_calls"}]}""")))
            append(t.finish())
        }
        val events = Regex("event: (\\w+)").findAll(frames).map { it.groupValues[1] }.toList()
        assertEquals(
            listOf("message_start", "content_block_start", "content_block_delta", "content_block_stop",
                "content_block_start", "content_block_delta", "content_block_delta", "content_block_stop", "message_delta", "message_stop"),
            events,
        )
        assertTrue(frames.contains("\"stop_reason\":\"tool_use\""))
    }

    @Test
    fun `tier routing and direct refs`() {
        val dir = kotlin.io.path.createTempDirectory().toFile()
        val store = ConfigStore(File(dir, "c.json"))
        store.update { it.copy(values = mapOf("MODEL" to "groq/a", "MODEL_OPUS" to "open_router/b", "REASONING_OPUS" to "high")) }
        val e = Engine(store)
        assertEquals("open_router/b" to "high", e.route("claude-opus-5-5"))
        assertEquals("groq/a" to "client", e.route("claude-sonnet-5-5"))
        assertEquals("nvidia_nim/x/y" to "client", e.route("nvidia_nim/x/y"))
        assertEquals("high", e.reasoningEffort("max", JsonObject(emptyMap())))
    }
}
