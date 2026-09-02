function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function deepMerge(target, patch) {
  for (const k of Object.keys(patch || {})) {
    if (isPlainObject(patch[k]) && isPlainObject(target[k])) deepMerge(target[k], patch[k]);
    else target[k] = patch[k];
  }
  return target;
}
class GeminiProvider {
  constructor(cfg = {}) {
    this.cfg = cfg;
  }
  cfg;
  name = "gemini";
  async generateImage(prompt) {
    if (!this.cfg.apiKey) throw new Error("\u751F\u56FE\u914D\u7F6E\u7F3A\u5C11 apiKey");
    const model = this.cfg.model || "gemini-3-pro-image-preview";
    const baseUrl = this.cfg.baseUrl || "https://generativelanguage.googleapis.com";
    const url = `${baseUrl}/v1beta/models/${model}:generateContent`;
    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { imageSize: "1K" } }
    };
    deepMerge(body, this.cfg.extra);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.cfg.apiKey },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    for (const candidate of json.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data) {
          return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
        }
      }
    }
    return null;
  }
}
const SEEDREAM_SIZE_MAP = {
  "16:9": "2560x1440",
  "4:3": "2304x1728",
  "3:4": "1728x2304",
  "9:16": "1440x2560",
  "1:1": "2K"
};
class SeedreamProvider {
  constructor(cfg = {}) {
    this.cfg = cfg;
  }
  cfg;
  name = "seedream";
  async generateImage(prompt, aspectRatio = "16:9") {
    if (!this.cfg.apiKey) throw new Error("\u751F\u56FE\u914D\u7F6E\u7F3A\u5C11 apiKey");
    const model = this.cfg.model || "doubao-seedream-4-5-251128";
    const baseUrl = this.cfg.baseUrl || "https://ark.cn-beijing.volces.com/api/v3";
    const size = SEEDREAM_SIZE_MAP[aspectRatio] || "2K";
    const body = { model, prompt, size, response_format: "b64_json", watermark: false };
    deepMerge(body, this.cfg.extra);
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Seedream API error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const first = json.data?.[0];
    if (!first?.b64_json) return null;
    return { data: first.b64_json, mimeType: "image/png" };
  }
}
const OPENAI_SIZE_MAP = {
  "16:9": "1792x1024",
  "4:3": "1536x1152",
  "3:4": "1152x1536",
  "9:16": "1024x1792",
  "1:1": "1024x1024"
};
class OpenAICompatibleProvider {
  constructor(cfg = {}) {
    this.cfg = cfg;
  }
  cfg;
  name = "openai-compatible";
  async generateImage(prompt, aspectRatio = "16:9") {
    if (!this.cfg.apiKey) throw new Error("\u751F\u56FE\u914D\u7F6E\u7F3A\u5C11 apiKey");
    if (!this.cfg.baseUrl || !this.cfg.model) throw new Error("openai-compatible \u914D\u7F6E\u9700\u8981 baseUrl \u4E0E model");
    const size = OPENAI_SIZE_MAP[aspectRatio] || "1024x1024";
    const url = this.cfg.baseUrl.replace(/\/$/, "") + "/images/generations";
    const body = { model: this.cfg.model, prompt, size, response_format: "b64_json" };
    deepMerge(body, this.cfg.extra);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Image API error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const first = json.data?.[0];
    if (!first?.b64_json) return null;
    return { data: first.b64_json, mimeType: "image/png" };
  }
}
const DASHSCOPE_SIZE_MAP = {
  "16:9": "1440*810",
  "4:3": "1280*960",
  "3:4": "960*1280",
  "9:16": "810*1440",
  "1:1": "1024*1024"
};
class DashScopeProvider {
  constructor(cfg = {}) {
    this.cfg = cfg;
  }
  cfg;
  name = "dashscope";
  async generateImage(prompt, aspectRatio = "16:9") {
    if (!this.cfg.apiKey) throw new Error("\u751F\u56FE\u914D\u7F6E\u7F3A\u5C11 apiKey");
    const model = this.cfg.model || "qwen-image-3.0-pro";
    const base = this.cfg.baseUrl || "https://dashscope.aliyuncs.com/api/v1";
    const size = DASHSCOPE_SIZE_MAP[aspectRatio] || "1024*1024";
    const url = base.replace(/\/$/, "") + "/services/aigc/multimodal-generation/generation";
    const parameters = { size, prompt_extend: true, watermark: false };
    const body = {
      model,
      input: { messages: [{ role: "user", content: [{ type: "text", text: prompt }] }] },
      parameters
    };
    deepMerge(body, this.cfg.extra);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
        "x-dashscope-async": "disable"
        // 同步返回结果，免轮询
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`DashScope API error (${res.status}): ${await res.text()}`);
    const json = await res.json();
    const choices = json?.output?.choices;
    if (!Array.isArray(choices) || !choices.length) return null;
    for (const ch of choices) {
      const content = ch?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block) continue;
        if (block.b64_image) return { data: String(block.b64_image), mimeType: "image/png" };
        if (block.image) {
          const img = await fetch(String(block.image));
          if (!img.ok) throw new Error("DashScope image download failed");
          const buf = Buffer.from(await img.arrayBuffer());
          return { data: buf.toString("base64"), mimeType: "image/png" };
        }
      }
    }
    return null;
  }
}
const MOCK_1PX_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
class MockProvider {
  name = "mock";
  async generateImage() {
    return { data: MOCK_1PX_PNG, mimeType: "image/png" };
  }
}
function createImageProvider(name, cfg) {
  switch (name) {
    case "gemini":
      return new GeminiProvider(cfg);
    case "seedream":
      return new SeedreamProvider(cfg);
    case "openai-compatible":
      return new OpenAICompatibleProvider(cfg);
    case "dashscope":
      return new DashScopeProvider(cfg);
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`\u672A\u77E5\u751F\u56FE provider: ${name}`);
  }
}
export {
  DashScopeProvider,
  GeminiProvider,
  MockProvider,
  OpenAICompatibleProvider,
  SeedreamProvider,
  createImageProvider
};
