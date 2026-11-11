// Generated from the upstream Free Claude Code provider catalog (server/src/free_claude_code/config/provider_catalog.py).
// Providers that need OAuth or cloud-specific signing (ChatGPT, Copilot, Azure, Vertex, Cloudflare) are desktop-only.
package dev.fcc.core

enum class ApiFormat { OPENAI_CHAT, ANTHROPIC_MESSAGES }

data class ProviderDef(
    val id: String,
    val displayName: String,
    val websiteUrl: String,
    val logo: String,
    val baseUrl: String,
    val keyField: String?,
    val urlField: String? = null,
    val local: Boolean = false,
    val format: ApiFormat = ApiFormat.OPENAI_CHAT,
)

object ProviderCatalog {
    val all: List<ProviderDef> = listOf(
        ProviderDef("nvidia_nim", "NVIDIA NIM", "https://build.nvidia.com/", "nvidia-color.svg", "https://integrate.api.nvidia.com/v1", "NVIDIA_NIM_API_KEY"),
        ProviderDef("open_router", "OpenRouter", "https://openrouter.ai/", "openrouter.svg", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
        ProviderDef("groq", "Groq", "https://groq.com/", "groq.svg", "https://api.groq.com/openai/v1", "GROQ_API_KEY"),
        ProviderDef("cline_pass", "ClinePass", "https://cline.bot/", "cline.svg", "https://api.cline.bot/api/v1", "CLINE_API_KEY"),
        ProviderDef("openai_api", "OpenAI API", "https://platform.openai.com/", "openai.svg", "https://api.openai.com/v1", "OPENAI_API_KEY"),
        ProviderDef("anthropic", "Anthropic", "https://www.anthropic.com/", "anthropic.svg", "https://api.anthropic.com/v1", "ANTHROPIC_API_KEY", format = ApiFormat.ANTHROPIC_MESSAGES),
        ProviderDef("xai", "xAI (Grok)", "https://x.ai/", "xai.svg", "https://api.x.ai/v1", "XAI_API_KEY"),
        ProviderDef("alibaba_cloud", "Alibaba Cloud", "https://www.alibabacloud.com/en/product/modelstudio", "alibabacloud-color.svg", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "ALIBABA_CLOUD_API_KEY"),
        ProviderDef("qwencloud", "QwenCloud Token Plan", "https://qwencloud.com/", "qwen-color.svg", "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1", "QWENCLOUD_API_KEY"),
        ProviderDef("qwencloud_coding", "QwenCloud Coding Plan", "https://qwencloud.com/", "qwen-color.svg", "https://coding-intl.dashscope.aliyuncs.com/v1", "QWENCLOUD_CODING_API_KEY"),
        ProviderDef("together", "Together AI", "https://www.together.ai/", "together-color.svg", "https://api.together.ai/v1", "TOGETHER_API_KEY"),
        ProviderDef("deepinfra", "DeepInfra", "https://deepinfra.com/", "deepinfra-color.svg", "https://api.deepinfra.com/v1/openai", "DEEPINFRA_API_KEY"),
        ProviderDef("siliconflow", "SiliconFlow", "https://siliconflow.com/", "siliconcloud-color.svg", "https://api.siliconflow.com/v1", "SILICONFLOW_API_KEY"),
        ProviderDef("nebius", "Nebius Token Factory", "https://tokenfactory.nebius.com/", "nebius.svg", "https://api.tokenfactory.nebius.com/v1", "NEBIUS_API_KEY"),
        ProviderDef("chutes", "Chutes", "https://chutes.ai/", "chutes.png", "https://llm.chutes.ai/v1", "CHUTES_API_KEY"),
        ProviderDef("featherless", "Featherless AI", "https://featherless.ai/", "featherless-color.svg", "https://api.featherless.ai/v1", "FEATHERLESS_API_KEY"),
        ProviderDef("agnes", "Agnes AI", "https://agnes-ai.com/", "agnesai.svg", "https://apihub.agnes-ai.com/v1", "AGNES_API_KEY"),
        ProviderDef("zenmux", "ZenMux", "https://zenmux.ai/", "zenmux.svg", "https://zenmux.ai/api/v1", "ZENMUX_API_KEY"),
        ProviderDef("wandb", "W&B Inference", "https://wandb.ai/site/inference/", "wandb.png", "https://api.inference.wandb.ai/v1", "WANDB_API_KEY"),
        ProviderDef("gemini", "Gemini", "https://ai.google.dev/", "gemini-color.svg", "https://generativelanguage.googleapis.com/v1beta/openai", "GEMINI_API_KEY"),
        ProviderDef("deepseek", "DeepSeek", "https://www.deepseek.com/", "deepseek-color.svg", "https://api.deepseek.com", "DEEPSEEK_API_KEY"),
        ProviderDef("mistral", "Mistral", "https://mistral.ai/", "mistral-color.svg", "https://api.mistral.ai/v1", "MISTRAL_API_KEY"),
        ProviderDef("mistral_codestral", "Mistral Codestral", "https://mistral.ai/", "mistral-color.svg", "https://codestral.mistral.ai/v1", "CODESTRAL_API_KEY"),
        ProviderDef("opencode_zen", "OpenCode Zen", "https://opencode.ai/zen", "opencode.svg", "https://opencode.ai/zen/v1", "OPENCODE_API_KEY"),
        ProviderDef("opencode_go", "OpenCode Go", "https://opencode.ai/go", "opencode.svg", "https://opencode.ai/zen/go/v1", "OPENCODE_API_KEY"),
        ProviderDef("vercel", "Vercel AI Gateway", "https://vercel.com/ai-gateway", "vercel.svg", "https://ai-gateway.vercel.sh/v1", "AI_GATEWAY_API_KEY"),
        ProviderDef("bedrock", "Amazon Bedrock", "https://aws.amazon.com/bedrock/", "bedrock-color.svg", "https://bedrock-mantle.us-east-1.api.aws/v1", "AWS_BEARER_TOKEN_BEDROCK"),
        ProviderDef("huggingface", "Hugging Face", "https://huggingface.co/", "huggingface-color.svg", "https://router.huggingface.co/v1", "HUGGINGFACE_API_KEY"),
        ProviderDef("cohere", "Cohere", "https://cohere.com/", "cohere-color.svg", "https://api.cohere.ai/compatibility/v1", "COHERE_API_KEY"),
        ProviderDef("wafer", "Wafer", "https://www.wafer.ai/", "wafer.png", "https://pass.wafer.ai/v1", "WAFER_API_KEY"),
        ProviderDef("kimi", "Kimi", "https://www.kimi.com/", "kimi-color.svg", "https://api.moonshot.ai/v1", "KIMI_API_KEY"),
        ProviderDef("kimi_code", "Kimi Code", "https://www.kimi.com/code", "kimi-color.svg", "https://api.kimi.com/coding/v1", "KIMI_CODE_API_KEY"),
        ProviderDef("kilo", "Kilo.ai", "https://kilo.ai/", "kilocode.svg", "https://api.kilo.ai/api/gateway", "KILO_API_KEY"),
        ProviderDef("minimax", "MiniMax", "https://www.minimax.io/", "minimax-color.svg", "https://api.minimax.io/v1", "MINIMAX_API_KEY"),
        ProviderDef("cerebras", "Cerebras", "https://www.cerebras.ai/", "cerebras-color.svg", "https://api.cerebras.ai/v1", "CEREBRAS_API_KEY"),
        ProviderDef("sambanova", "SambaNova", "https://sambanova.ai/", "sambanova-color.svg", "https://api.sambanova.ai/v1", "SAMBANOVA_API_KEY"),
        ProviderDef("fireworks", "Fireworks", "https://fireworks.ai/", "fireworks-color.svg", "https://api.fireworks.ai/inference/v1", "FIREWORKS_API_KEY"),
        ProviderDef("novita", "Novita AI", "https://novita.ai/", "novita-color.svg", "https://api.novita.ai/openai/v1", "NOVITA_API_KEY"),
        ProviderDef("zai", "Z.ai Coding Plan", "https://z.ai/", "zai.svg", "https://api.z.ai/api/coding/paas/v4", "ZAI_API_KEY"),
        ProviderDef("zai_api", "Z.ai API", "https://z.ai/", "zai.svg", "https://api.z.ai/api/paas/v4", "ZAI_API_KEY"),
        ProviderDef("tokenrouter", "TokenRouter", "https://www.tokenrouter.com/", "tokenrouter.png", "https://api.tokenrouter.com/v1", "TOKENROUTER_API_KEY"),
        ProviderDef("nararoute", "NaraRoute", "https://router.bynara.id/", "nararoute.png", "https://router.bynara.id/v1", "NARAROUTE_API_KEY"),
        ProviderDef("poolside", "Poolside AI", "https://poolside.ai/", "poolside-color.svg", "https://inference.poolside.ai/v1", "POOLSIDE_API_KEY"),
        ProviderDef("llm7", "LLM7.io", "https://llm7.io/", "llm7.png", "https://api.llm7.io/v1", "LLM7_API_KEY"),
        ProviderDef("scaleway", "Scaleway", "https://www.scaleway.com/", "scaleway.svg", "https://api.scaleway.ai/v1", "SCW_SECRET_KEY"),
        ProviderDef("lightning", "Lightning AI", "https://lightning.ai/", "lightning.png", "https://lightning.ai/api/v1", "LIGHTNING_API_KEY"),
        ProviderDef("experiential", "Experiential Labs", "https://www.experientiallabs.ai/", "experiential.svg", "https://api.experientiallabs.ai/v1", "EXPLABS_API_KEY"),
        ProviderDef("cheaperinference", "Cheaper Inference", "https://cheaperinference.com/", "cheaperinference.svg", "https://api.cheaperinference.com/v1", "CHEAPER_INFERENCE_API_KEY"),
        ProviderDef("orcarouter", "OrcaRouter", "https://www.orcarouter.ai/", "orcarouter.png", "https://api.orcarouter.ai/v1", "ORCAROUTER_API_KEY"),
        ProviderDef("atlascloud", "Atlas Cloud", "https://www.atlascloud.ai/", "atlascloud.svg", "https://api.atlascloud.ai/v1", "ATLASCLOUD_API_KEY"),
        ProviderDef("xkiro", "xKiro", "https://xkiro.com/", "xkiro.png", "https://api.xkiro.com/v1", "XKIRO_API_KEY"),
        ProviderDef("opper", "Opper", "https://opper.ai/", "opper.svg", "https://api.opper.ai/v3/compat", "OPPER_API_KEY"),
        ProviderDef("ollama_cloud", "Ollama Cloud", "https://ollama.com/", "ollama.svg", "https://ollama.com/v1", "OLLAMA_API_KEY"),
        ProviderDef("lmstudio", "LM Studio", "https://lmstudio.ai/", "lmstudio.svg", "http://127.0.0.1:1234/v1", null, urlField = "LM_STUDIO_BASE_URL", local = true),
        ProviderDef("llamacpp", "LLaMA.cpp", "https://github.com/ggml-org/llama.cpp", "llamacpp.svg", "http://127.0.0.1:8080/v1", null, urlField = "LLAMACPP_BASE_URL", local = true),
        ProviderDef("ollama", "Ollama", "https://ollama.com/", "ollama.svg", "http://127.0.0.1:11434/v1", null, urlField = "OLLAMA_BASE_URL", local = true),
    )

    private val byId = all.associateBy { it.id }

    operator fun get(id: String): ProviderDef? = byId[id]

    /** Distinct credential fields (some providers share one, e.g. OpenCode Zen/Go). */
    val keyFields: List<String> = all.mapNotNull { it.keyField }.distinct()
}
