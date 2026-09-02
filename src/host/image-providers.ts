// dsh-pictor — 生图 provider 抽象（从 pictorial 的 image-providers.ts 移植）。
//
// 差异点（DSH 插件形态）：
// - 无 bash、无子进程、无环境变量：全部由插件配置提供（dataRoot/config.json 或 RPC），
//   网络调用一律走 Node 原生 fetch；
// - 腾讯云 Hunyuan 因依赖 TC3-HMAC 签名 SDK（额外 npm 依赖 + 计算），v1 不移植，
//   需要时用 OpenAICompatibleProvider 接等效端点；
// - 新增 OpenAICompatibleProvider：任何 OpenAI 兼容 /images/generations（b64_json）端点。

export interface ImageResult {
  data: string // base64-encoded image (no data: prefix)
  mimeType: string
}

export interface ImageProvider {
  readonly name: string
  generateImage(prompt: string, aspectRatio?: string): Promise<ImageResult | null>
}

export interface ProviderConfig {
  baseUrl?: string
  apiKey?: string
  model?: string
  /** 用户自填的额外请求参数，深合并进各 provider 的请求体。 */
  extra?: Record<string, unknown>
}

function isPlainObject(v: any): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(target: any, patch: any): any {
  for (const k of Object.keys(patch || {})) {
    if (isPlainObject(patch[k]) && isPlainObject(target[k])) deepMerge(target[k], patch[k])
    else target[k] = patch[k]
  }
  return target
}

// --- Gemini Provider ---

export class GeminiProvider implements ImageProvider {
  readonly name = 'gemini'

  constructor(private cfg: ProviderConfig = {}) {}

  async generateImage(prompt: string): Promise<ImageResult | null> {
    if (!this.cfg.apiKey) throw new Error('生图配置缺少 apiKey')
    const model = this.cfg.model || 'gemini-3-pro-image-preview'
    const baseUrl = this.cfg.baseUrl || 'https://generativelanguage.googleapis.com'
    const url = `${baseUrl}/v1beta/models/${model}:generateContent`

    const body: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: '1K' } },
    }
    deepMerge(body, this.cfg.extra)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.cfg.apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`)

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>
    }
    for (const candidate of json.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data) {
          return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' }
        }
      }
    }
    return null
  }
}

// --- Seedream Provider (Volcengine Ark API，OpenAI 兼容 images/generations) ---

const SEEDREAM_SIZE_MAP: Record<string, string> = {
  '16:9': '2560x1440',
  '4:3': '2304x1728',
  '3:4': '1728x2304',
  '9:16': '1440x2560',
  '1:1': '2K',
}

export class SeedreamProvider implements ImageProvider {
  readonly name = 'seedream'

  constructor(private cfg: ProviderConfig = {}) {}

  async generateImage(prompt: string, aspectRatio = '16:9'): Promise<ImageResult | null> {
    if (!this.cfg.apiKey) throw new Error('生图配置缺少 apiKey')
    const model = this.cfg.model || 'doubao-seedream-4-5-251128'
    const baseUrl = this.cfg.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'
    const size = SEEDREAM_SIZE_MAP[aspectRatio] || '2K'

    const body: any = { model, prompt, size, response_format: 'b64_json', watermark: false }
    deepMerge(body, this.cfg.extra)
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Seedream API error (${res.status}): ${await res.text()}`)

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> }
    const first = json.data?.[0]
    if (!first?.b64_json) return null
    return { data: first.b64_json, mimeType: 'image/png' }
  }
}

// --- OpenAI Compatible Provider（任意 /images/generations b64_json 端点） ---

const OPENAI_SIZE_MAP: Record<string, string> = {
  '16:9': '1792x1024',
  '4:3': '1536x1152',
  '3:4': '1152x1536',
  '9:16': '1024x1792',
  '1:1': '1024x1024',
}

export class OpenAICompatibleProvider implements ImageProvider {
  readonly name = 'openai-compatible'

  constructor(private cfg: ProviderConfig = {}) {}

  async generateImage(prompt: string, aspectRatio = '16:9'): Promise<ImageResult | null> {
    if (!this.cfg.apiKey) throw new Error('生图配置缺少 apiKey')
    if (!this.cfg.baseUrl || !this.cfg.model) throw new Error('openai-compatible 配置需要 baseUrl 与 model')
    const size = OPENAI_SIZE_MAP[aspectRatio] || '1024x1024'

    const url = this.cfg.baseUrl.replace(/\/$/, '') + '/images/generations'
    const body: any = { model: this.cfg.model, prompt, size, response_format: 'b64_json' }
    deepMerge(body, this.cfg.extra)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Image API error (${res.status}): ${await res.text()}`)
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> }
    const first = json.data?.[0]
    if (!first?.b64_json) return null
    return { data: first.b64_json, mimeType: 'image/png' }
  }
}


// --- DashScope (百炼) Provider（Qwen-Image / Wan 系列，原生 multimodal-generation） ---
// 百炼没有 OpenAI 兼容的 /images/generations；图像生成走
// /services/aigc/multimodal-generation/generation。请求体与 OpenAI 兼容不同，
// openai-compatible 无法直连（404）。
const DASHSCOPE_SIZE_MAP: Record<string, string> = {
  '16:9': '1440*810',
  '4:3': '1280*960',
  '3:4': '960*1280',
  '9:16': '810*1440',
  '1:1': '1024*1024',
}

export class DashScopeProvider implements ImageProvider {
  readonly name = 'dashscope'

  constructor(private cfg: ProviderConfig = {}) {}

  async generateImage(prompt: string, aspectRatio = '16:9'): Promise<ImageResult | null> {
    if (!this.cfg.apiKey) throw new Error('生图配置缺少 apiKey')
    const model = this.cfg.model || 'qwen-image-3.0-pro'
    const base = this.cfg.baseUrl || 'https://dashscope.aliyuncs.com/api/v1'
    const size = DASHSCOPE_SIZE_MAP[aspectRatio] || '1024*1024'
    const url = base.replace(/\/$/, '') + '/services/aigc/multimodal-generation/generation'
    // 默认开启 prompt 改写（prompt_extend）与关水印（qwen-image 长 prompt 文字
    // 渲染的关键，实测 2026-08-29）；用户 extra 可覆盖。
    const parameters: any = { size, prompt_extend: true, watermark: false }
    const body: any = {
      model,
      input: { messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }] },
      parameters,
    }
    deepMerge(body, this.cfg.extra)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.cfg.apiKey}`,
        'x-dashscope-async': 'disable', // 同步返回结果，免轮询
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`DashScope API error (${res.status}): ${await res.text()}`)
    const json = (await res.json()) as any
    // 实测响应：output.choices[0].message.content[{ image|b64_image }]
    const choices = json?.output?.choices
    if (!Array.isArray(choices) || !choices.length) return null
    for (const ch of choices) {
      const content = ch?.message?.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        if (!block) continue
        if (block.b64_image) return { data: String(block.b64_image), mimeType: 'image/png' }
        if (block.image) {
          const img = await fetch(String(block.image))
          if (!img.ok) throw new Error('DashScope image download failed')
          const buf = Buffer.from(await img.arrayBuffer())
          return { data: buf.toString('base64'), mimeType: 'image/png' }
        }
      }
    }
    return null
  }
}

// --- Mock Provider（冒烟测试/无 key 体验） ---

const MOCK_1PX_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export class MockProvider implements ImageProvider {
  readonly name = 'mock'
  async generateImage(): Promise<ImageResult> {
    return { data: MOCK_1PX_PNG, mimeType: 'image/png' }
  }
}

// --- Factory ---

export function createImageProvider(name: string, cfg: ProviderConfig): ImageProvider {
  switch (name) {
    case 'gemini':
      return new GeminiProvider(cfg)
    case 'seedream':
      return new SeedreamProvider(cfg)
    case 'openai-compatible':
      return new OpenAICompatibleProvider(cfg)
    case 'dashscope':
      return new DashScopeProvider(cfg)
    case 'mock':
      return new MockProvider()
    default:
      throw new Error(`未知生图 provider: ${name}`)
  }
}