// dsh-pictor — Host half (Node process)。
//
// 职责（docs/DESIGN.zh.md v1 + 2026-09-01 修正）：
// 1. `~/.pictor` 工作区：首次使用初始化（index.json、pictor-config.json）；
// 2. 项目模型：一个项目 = 一份文档转一组信息图，目录自包含；
// 3. 会话由 CLIENT 经 dsh 的 workspaces/sessions 服务创建与驱动（照 pomasa 的
//    driveSession 模式）：宿主只准备目录并返回要驱动的 prompt，不做 agentLoop。
//    这样会话归入「Pictor」工作区、继承 profile 默认模型，能正常启动与续跑；
//    宿主凭 client 报上来的 sessionId 做运行判定（agents 注册表）与日志读取；
// 4. 私有 JSON RPC `/pictor` 端点表。
//
// 哲学：
// - 摄取是界面便利（上传文件/粘贴 HTML 原样落盘），处理委托会话；
// - UI 状态只由文件事实驱动；运行中判定以 dsh agent 注册表为权威；
// - render 是确定性动作（拼 prompt + 直调生图 API），GUI 按钮经 RPC 直驱。
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import {
  mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, renameSync,
  existsSync, statSync, rmSync, appendFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createImageProvider, type ProviderConfig } from './image-providers.js'
import { renderPrompt } from './render.js'

export const name = 'dsh-pictor'
export const inject = ['connection', 'webServer']

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = join(HERE, '..')

const TITLE_MAX = 30
const DEFAULT_KEY_REF = 'PICTOR_IMAGE_API_KEY'

interface ProjectRecord {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /** 最近一次由 CLIENT 报上来的会话 id（workspace 流程创建），用于运行判定与日志。 */
  sessionId?: string
}

function now() {
  return new Date().toISOString()
}

/** 首行取标题：HTML 剥标签取首个非空行；超过 30 字截断加省略号。 */
function firstLine(text: string): string {
  const line = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split('\n')[0] || ''
  const out = line.slice(0, TITLE_MAX)
  return line.length > TITLE_MAX ? out + '…' : out
}

function sanitizeFilename(name: string): string {
  const base = String(name || '').split(/[\\/]/).pop() || ''
  return base.replace(/[^\w.\-一-鿿 ()（）]/g, '_').slice(0, 200) || 'document'
}

/** 宿主侧防御性消毒（粘贴 Input 落盘前再剥一遍）：客户端已消毒，这里只兜底硬标签。 */
function scrubHtml(html: string): string {
  let out = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*/gi, ' data-disabled=')
    .replace(/(\shref\s*=\s*["']?)\s*javascript:[^"' >]*/gi, '$1#')
  return out
}

/** 阶段由文件事实推断：UI 状态独一无二的来源。 */
function stageOf(projectDir: string): string {
  if (!existsSync(join(projectDir, '10.input', 'document.md'))) {
    if (hasSource(projectDir)) return 'running'
    return 'prepared'
  }
  if (readdirSafe(join(projectDir, 'output')).some((f) => f.endsWith('.png'))) return 'done'
  if (existsSync(join(projectDir, '12.advice', 'proposals.json'))) return 'gated:advice'
  if (existsSync(join(projectDir, '11.extraction', 'structures.json'))) return 'gated:structure'
  if (existsSync(join(projectDir, '10.input', 'meta.json'))) {
    // meta 已写但未确认 = 停在信息确认门控；确认标记存在 = 提取进行中
    if (existsSync(join(projectDir, '10.input', 'meta.confirmed'))) return 'running'
    return 'gated:meta'
  }
  if (existsSync(join(projectDir, '10.input', 'document.md'))) return 'running'
  return 'gated:meta'
}

/** 10.input/ 下是否有原始来源（上传文件或 source.html），判断"会话正在获取文档"。 */
function hasSource(dir: string): boolean {
  try {
    return readdirSync(join(dir, '10.input')).some((f) => f !== 'document.md')
  } catch {
    return false
  }
}

function readdirSafe(p: string): string[] {
  try {
    return readdirSync(p)
  } catch {
    return []
  }
}

/**
 * 初始/续做指令（供 CLIENT 经 workspace 会话驱动）：
 * 让 orchestrator 以文件事实为真相续做——已有产物不重跑、缺文档先规整。
 */
function initialPrompt(dir: string): string {
  const doc = '10.input/document.md'
  const ext = '11.extraction'
  const adv = '12.advice'
  const hasDoc = existsSync(join(dir, doc))
  const hasStructures = existsSync(join(dir, ext, 'structures.json'))
  const hasProposals = existsSync(join(dir, adv, 'proposals.json'))
  const hasMeta = existsSync(join(dir, '10.input', 'meta.json'))
  const prompts: string[] = [
    '你是 Pictor 编排器，运行在 DeepSeek Harness 智能运行时中。',
    '工作目录（你所有相对路径的锚点）为项目目录：' + dir + '。该目录位于会话沙箱内，可自由读写。',
    '蓝图与参考资产已挂载于 ' + dir + '/agents/ 与 ' + dir + '/references/。',
    '项目状态以文件事实为准，请先读取再行动：',
  ]
  if (!hasDoc) {
    prompts.push(
      '- 输入文档就位方式：读取 10.input/ 下的原始来源（上传文件或 source.html），必要时用你的文档工具转换，',
      '  规范化为 ' + doc + '。完成后再进入提取阶段。',
    )
  }
  if (hasDoc && !hasMeta) {
    prompts.push('- 文档已就位但尚未有 10.input/meta.json：先提炼文档的英文标题与一句话英文摘要，写入 10.input/meta.json，然后停下等待用户确认文档信息（门控 0），不要开始提取。')
  }
  if (hasMeta && !hasStructures) {
    prompts.push('- 文档信息已确认，尚未有结构产物：开始提取阶段（阅读 agents/10.orchestrator.md 按规定执行）。')
  }
  if (hasStructures && !hasProposals) {
    prompts.push('- 已存在 ' + ext + '/structures.json：这是用户确认过的结构产物，绝不重新提取，向用户汇报候选清单并等待指示。')
  }
  if (hasProposals) {
    prompts.push('- 已存在 ' + adv + '/proposals.json：这是已生成的方案产物，绝不重新生成，等待用户选择方案。')
  }
  prompts.push(
    '',
    '阅读 agents/10.orchestrator.md 并严格按蓝图执行（尤其「推进与门控纪律」）。遵守双通道输入纪律与 subagent 调用规范。',
    '停点纪律：三个门控（信息确认、结构确认、方案确认）需要停下等待用户；其余环节（获取文档、提取结构、生成方案）自动推进，中途不设停点。',
  )
  return prompts.join('\n')
}

export function apply(ctx: any, config: any = {}) {
  const connection = ctx.connection
  const base = config.dataDir || process.env.PICTOR_HOME || join(homedir(), '.pictor')
  const INDEX_JSON = join(base, 'index.json')
  const CONFIG_JSON = join(base, 'pictor-config.json')
  mkdirSync(base, { recursive: true })
  ensureIndex()

  // ---------- 索引与目录 ----------

  function ensureIndex() {
    if (!existsSync(INDEX_JSON)) {
      writeFileSync(INDEX_JSON, JSON.stringify({ projects: [] }, null, 2))
    }
  }

  function readProjects(): ProjectRecord[] {
    try {
      const parsed = JSON.parse(readFileSync(INDEX_JSON, 'utf8'))
      const list = Array.isArray(parsed.projects) ? parsed.projects : []
      return list as ProjectRecord[]
    } catch {
      return []
    }
  }

  function saveProjects(list: ProjectRecord[]) {
    const tmp = INDEX_JSON + '.tmp'
    writeFileSync(tmp, JSON.stringify({ projects: list }, null, 2))
    renameSync(tmp, INDEX_JSON)
  }

  function findProject(id: string): ProjectRecord | undefined {
    return readProjects().find((p) => p.id === id)
  }

  function projectDir(id: string): string {
    return join(base, id)
  }

  function nextProjectId(): string {
    const ymd = now().slice(0, 10).replace(/-/g, '')
    const seq = readProjects().filter((p) => p.id.startsWith(ymd)).length + 1
    return `${ymd}-${String(seq).padStart(3, '0')}`
  }

  function logError(tag: string, e: unknown) {
    try {
      appendFileSync(join(base, 'host-error.log'), `${now()} [${tag}] ${String((e as Error)?.message || e)}\n`)
    } catch {
      /* 日志失败不影响主流程 */
    }
  }

  // ---------- 运行判定与日志（凭 CLIENT 报来的 sessionId） ----------

  async function isAgentAlive(sid: string): Promise<boolean | null> {
    if (!sid) return null
    try {
      const agents = ctx.get?.('agents')
      const registryKnown = agents && typeof agents.get === 'function'
      const a = registryKnown ? agents.get(sid) : null
      if (a && a.status === 'running') return true
      const subs = ctx.get?.('subagents')
      if (subs && typeof subs.listChildren === 'function') {
        try {
          const rows = await subs.listChildren(sid)
          if (Array.isArray(rows) && rows.some((r) => r && r.activity === 'running')) return true
        } catch { /* 目录查询失败不致命 */ }
      }
      return registryKnown ? Boolean(a && a.status === 'running') : null
    } catch {
      return null
    }
  }

  // ---------- 生图配置（pictor-config.json + 凭据 seam） ----------

  interface ImageConfig {
    provider: string
    baseUrl?: string
    model?: string
    aspectRatio?: string
    apiKeyRef?: string
    /** 无凭据服务（profile 未装 credentials bundle）时降级明文存储的密钥。 */
    apiKey?: string
  }

  function credentialsService(): any {
    try {
      return ctx.credentials || ctx.get?.('credentials')
    } catch {
      return null
    }
  }

  function readImageConfig(): ImageConfig {
    try {
      const parsed = JSON.parse(readFileSync(CONFIG_JSON, 'utf8'))
      const image = parsed.image || {}
      return {
        provider: String(image.provider || 'seedream'),
        baseUrl: String(image.baseUrl || ''),
        model: String(image.model || ''),
        aspectRatio: String(image.aspectRatio || '16:9'),
        apiKeyRef: String(image.apiKeyRef || ''),
        apiKey: image.apiKey !== undefined ? String(image.apiKey) : undefined,
        extra: image.extra && typeof image.extra === 'object' ? image.extra : {},
      }
    } catch {
      return { provider: 'seedream', aspectRatio: '16:9', extra: {} }
    }
  }

  function writeImageConfig(cfg: ImageConfig) {
    const current = readImageConfig()
    const merged: any = { ...current, ...cfg }
    if (!cfg.apiKeyRef) merged.apiKeyRef = current.apiKeyRef || ''
    writeFileSync(CONFIG_JSON, JSON.stringify({ image: merged }, null, 2))
  }

  function keyStorage(): 'seam' | 'file' {
    const creds = credentialsService()
    return creds && typeof creds.set === 'function' ? 'seam' : 'file'
  }

  async function hasApiKey(): Promise<boolean> {
    const cfg = readImageConfig()
    if (cfg.apiKey) return true
    if (!cfg.apiKeyRef) return false
    const creds = credentialsService()
    if (!creds || typeof creds.describe !== 'function') return false
    try {
      const info = await creds.describe(cfg.apiKeyRef)
      return Boolean(info && info.configured)
    } catch {
      return false
    }
  }

  async function resolveApiKey(): Promise<string> {
    const cfg = readImageConfig()
    if (cfg.apiKey) return cfg.apiKey
    if (!cfg.apiKeyRef) return ''
    const creds = credentialsService()
    if (!creds || typeof creds.resolve !== 'function') return ''
    try {
      const r = await creds.resolve(cfg.apiKeyRef)
      return r && r.value ? String(r.value) : ''
    } catch {
      return ''
    }
  }

  async function storeApiKey(value: string, ref?: string) {
    const cfg = readImageConfig()
    const keyRef = (ref && ref.trim()) || cfg.apiKeyRef || DEFAULT_KEY_REF
    const creds = credentialsService()
    if (creds && typeof creds.set === 'function') {
      await creds.set(keyRef, value)
      writeImageConfig({ ...cfg, apiKeyRef: keyRef, apiKey: '' })
      return
    }
    // profile 未装凭据服务：降级明文存 config，设置界面如实提示。
    writeImageConfig({ ...cfg, apiKeyRef: keyRef, apiKey: value })
  }

  // ---------- 项目生命周期 ----------

  async function createProject(title: string | undefined, file: { name?: string; dataUrl?: string } | undefined, html: string | undefined): Promise<ProjectRecord> {
    const id = nextProjectId()
    const dir = projectDir(id)
    for (const sub of ['10.input', '11.extraction', '12.advice', 'output']) {
      mkdirSync(join(dir, sub), { recursive: true })
    }
    const agentsSrc = join(PLUGIN_ROOT, 'agents')
    if (existsSync(agentsSrc)) cpSync(agentsSrc, join(dir, 'agents'), { recursive: true })
    const refSrc = join(PLUGIN_ROOT, 'references', 'domain')
    if (existsSync(refSrc)) cpSync(refSrc, join(dir, 'references', 'domain'), { recursive: true })

    let derivedTitle = ''
    if (file && file.dataUrl) {
      const name = sanitizeFilename(file.name || 'document')
      const buf = Buffer.from(String(file.dataUrl).replace(/^data:[^;]*;base64,/, ''), 'base64')
      writeFileSync(join(dir, '10.input', name), buf)
      derivedTitle = name.replace(/\.[^.]+$/, '')
    } else if (html) {
      const scrubbed = scrubHtml(html)
      writeFileSync(join(dir, '10.input', 'source.html'), scrubbed)
      derivedTitle = firstLine(scrubbed)
    } else {
      throw new Error('project.create: 需要文件或粘贴内容')
    }

    const record: ProjectRecord = {
      id,
      title: (title && title.trim()) || derivedTitle || '未命名项目',
      createdAt: now(),
      updatedAt: now(),
    }
    const list = readProjects()
    list.unshift(record)
    saveProjects(list)
    return record
  }

  function touch(id: string) {
    const list = readProjects()
    const p = list.find((x) => x.id === id)
    if (p) {
      p.updatedAt = now()
      saveProjects(list)
    }
  }

  /**
   * 要驱动的完整 prompt：会话存活时就是本次消息（同一会话续跑）；
   * 无存活会话（含 dsh 重启后）先附初始/续做指令再拼本次消息。
   */
  async function composePrompt(record: ProjectRecord, message: string): Promise<string> {
    const live = record.sessionId ? await isAgentAlive(record.sessionId) : null
    if (live === true) return message
    return initialPrompt(projectDir(record.id)) + '\n\n' + message
  }

  // ---------- RPC ----------

  function listFiles(dir: string): string[] {
    const out: string[] = []
    const walk = (p: string, prefix: string) => {
      for (const e of readdirSafe(p)) {
        const full = join(p, e)
        const rel = prefix ? `${prefix}/${e}` : e
        try {
          const st = statSync(full)
          if (st.isDirectory()) walk(full, rel)
          else out.push(rel)
        } catch { out.push(rel) }
      }
    }
    walk(dir, '')
    return out.sort()
  }

  function readJsonSafe(file: string): string {
    try {
      return readFileSync(file, 'utf8')
    } catch {
      return ''
    }
  }

  // ---------- 渲染（异步 + 文件状态） ----------
  const renderJobs = new Map<string, { renderId: string; startedAt: number }>()

  function readRenderHistory(id: string): any[] {
    try {
      const raw = readJsonSafe(join(projectDir(id), '12.advice', 'render-history.json'))
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function writeRenderHistory(id: string, hist: any[]) {
    const f = join(projectDir(id), '12.advice', 'render-history.json')
    const tmp = f + '.tmp'
    writeFileSync(tmp, JSON.stringify(hist, null, 2))
    renameSync(tmp, f)
  }

  function readRenderState(id: string): any {
    try {
      const raw = readJsonSafe(join(projectDir(id), '12.advice', 'render.json'))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function writeRenderState(id: string, state: any) {
    const f = join(projectDir(id), '12.advice', 'render.json')
    const tmp = f + '.tmp'
    writeFileSync(tmp, JSON.stringify(state, null, 2))
    renameSync(tmp, f)
  }

  function updateRenderState(id: string, fn: (st: any) => void) {
    const st = readRenderState(id) || { renderId: '', startedAt: '', proposals: {}, errors: {} }
    fn(st)
    writeRenderState(id, st)
  }

  async function runRenderBatch(id: string, picks: any[], seq: number, opts: {
    ratios: Record<string, string>
    ov: Record<string, { layout?: string; style?: string }>
    proposals: any
    cfg: ImageConfig
    apiKey: string
  }) {
    const dir = projectDir(id)
    const { ratios, ov, proposals, cfg, apiKey } = opts
    const provider = createImageProvider(cfg.provider || 'mock', {
      baseUrl: cfg.baseUrl, apiKey, model: cfg.model, extra: cfg.extra,
    } as ProviderConfig)
    mkdirSync(join(dir, 'output'), { recursive: true })
    for (const prop of picks) {
      const pid = String(prop.id)
      const base = `${pid}-${seq}`
      const ratio = String(ratios[pid] || '16:9')
      const ovP = (ov[pid] && typeof ov[pid] === 'object') ? ov[pid] : {}
      const usedLayout = String(ovP.layout || prop.suggested_layout || 'dashboard')
      const usedStyle = String(ovP.style || prop.suggested_style || proposals.suggested_style || 'corporate-memphis')
      updateRenderState(id, (st) => { st.proposals[pid] = 'running' })
      try {
        const { prompt } = renderPrompt({
          sourceText: String(prop.source_text || ''),
          communicativeIntent: String(prop.communicative_intent || ''),
          suggestedLayout: usedLayout,
          suggestedStyle: usedStyle,
          estimatedComplexity: prop.estimated_complexity ? String(prop.estimated_complexity) : undefined,
          aspectRatio: ratio,
          language: 'English',
        }, dir)
        writeFileSync(join(dir, `${base}-prompt.md`), prompt + '\n')
        const img = await provider.generateImage(prompt, ratio)
        if (!img) throw new Error('provider 未返回图像')
        writeFileSync(join(dir, 'output', `${base}.png`), Buffer.from(img.data, 'base64'))
        updateRenderState(id, (st) => { st.proposals[pid] = 'done' })
      } catch (e: any) {
        const msg = String(e?.message || e)
        updateRenderState(id, (st) => { st.proposals[pid] = 'error'; st.errors[pid] = msg })
      }
    }
    updateRenderState(id, (st) => { st.finishedAt = new Date().toISOString() })
    const hist = readRenderHistory(id)
    if (hist.length) hist[0].finishedAt = new Date().toISOString()
    writeRenderHistory(id, hist)
    renderJobs.delete(id)
  }

  async function handle(endpoint: string, payload: any): Promise<any> {
    switch (endpoint) {
      case 'config.get': {
        const cfg = readImageConfig()
        return {
          dataRoot: base,
          image: {
            provider: cfg.provider,
            baseUrl: cfg.baseUrl || '',
            model: cfg.model || '',
            aspectRatio: cfg.aspectRatio || '16:9',
            apiKeyRef: cfg.apiKeyRef || '',
            hasKey: await hasApiKey(),
            keyStorage: keyStorage(),
            extra: cfg.extra || {},
          },
          styles: listRefs('styles'),
          layouts: listRefs('layouts'),
        }
      }

      case 'config.set': {
        const patch: any = payload?.image || {}
        let extra: Record<string, unknown> | undefined = undefined
        if (patch.extra !== undefined) {
          const raw = typeof patch.extra === 'string' ? patch.extra.trim() : ''
          if (raw === '') extra = {}
          else {
            try { extra = JSON.parse(raw) }
            catch { throw new Error('额外请求参数必须是合法 JSON 对象') }
          }
        }
        writeImageConfig({
          provider: String(patch.provider || readImageConfig().provider),
          baseUrl: String(patch.baseUrl ?? readImageConfig().baseUrl ?? ''),
          model: String(patch.model ?? readImageConfig().model ?? ''),
          aspectRatio: String(patch.aspectRatio ?? readImageConfig().aspectRatio ?? '16:9'),
          apiKeyRef: String(patch.apiKeyRef ?? readImageConfig().apiKeyRef ?? ''),
          ...(extra !== undefined ? { extra } : {}),
        })
        if (patch.apiKey) {
          await storeApiKey(String(patch.apiKey), patch.apiKeyRef)
        }
        const cfg = readImageConfig()
        return {
          image: {
            provider: cfg.provider,
            baseUrl: cfg.baseUrl || '',
            model: cfg.model || '',
            aspectRatio: cfg.aspectRatio || '16:9',
            apiKeyRef: cfg.apiKeyRef || '',
            hasKey: await hasApiKey(),
            keyStorage: keyStorage(),
            extra: cfg.extra || {},
          },
        }
      }

      case 'config.test': {
        const cfg = readImageConfig()
        const provider = createImageProvider(cfg.provider || 'mock', {
          baseUrl: cfg.baseUrl,
          apiKey: await resolveApiKey(),
          model: cfg.model,
          extra: cfg.extra,
        } as ProviderConfig)
        const img = await provider.generateImage('A simple solid-color test card with two words.', cfg.aspectRatio || '16:9')
        if (!img) throw new Error('config.test: provider 未返回图像')
        return { ok: true, bytes: img.data.length, size: `${Math.round(img.data.length / 1024)}KB` }
      }

      case 'project.create': {
        const title = payload?.title ? String(payload.title) : undefined
        const file = payload?.file
        const html = payload?.html !== undefined ? String(payload.html) : undefined
        const record = await createProject(title, file, html)
        // 会话由 CLIENT 创建（workspace 流程），宿主只给要驱动的初始指令。
        return { id: record.id, title: record.title, stage: stageOf(projectDir(record.id)), prompt: initialPrompt(projectDir(record.id)) }
      }

      case 'project.list': {
        const items = readProjects().map((p) => {
          const dir = projectDir(p.id)
          return {
            ...p,
            stage: stageOf(dir),
            running: false,
            renderRunning: renderJobs.has(p.id),
            outputs: readdirSafe(join(dir, 'output')).filter((f) => f.endsWith('.png')),
            structuresCount: existsSync(join(dir, '11.extraction', 'structures.json')) ? countOf(readJsonSafe(join(dir, '11.extraction', 'structures.json')), 'structures') : 0,
            proposalsCount: existsSync(join(dir, '12.advice', 'proposals.json')) ? countOf(readJsonSafe(join(dir, '12.advice', 'proposals.json')), 'proposals') : 0,
          }
        })
        return { projects: items }
      }

      case 'project.get': {
        const id = String(payload?.id || '')
        const record = findProject(id)
        if (!record) throw new Error(`project.get: 未知项目 ${id}`)
        const dir = projectDir(id)
        const running = record.sessionId ? await isAgentAlive(record.sessionId) : null
        const inputFiles = readdirSafe(join(dir, '10.input'))
        return {
          record: { ...record, stage: stageOf(dir) },
          files: listFiles(dir),
          structuresJson: readJsonSafe(join(dir, '11.extraction', 'structures.json')),
          proposalsJson: readJsonSafe(join(dir, '12.advice', 'proposals.json')),
          outputs: readdirSafe(join(dir, 'output')).filter((f) => f.endsWith('.png')),
          running: running === true,
          prompts: readdirSafe(dir).filter((f) => f.endsWith('-prompt.md')),
          document: readJsonSafe(join(dir, '10.input', 'document.md')),
          sourceName: inputFiles.find((f) => f !== 'document.md') || null,
          meta: parseJsonSafe(join(dir, '10.input', 'meta.json')),
          metaConfirmed: existsSync(join(dir, '10.input', 'meta.confirmed')),
          overrides: parseJsonSafe(join(dir, '12.advice', 'overrides.json')) || {},
          renderState: readRenderState(id),
          renderRunning: renderJobs.has(id),
          renderBatches: readRenderHistory(id),
        }
      }

      case 'project.saveOverrides': {
        // 方案页的 per-proposal 覆盖（比例/layout/style）即时持久化到
        // 12.advice/overrides.json，刷新不丢。
        const id = String(payload?.id || '')
        const dir = projectDir(id)
        if (!findProject(id)) throw new Error(`project.saveOverrides: 未知项目 ${id}`)
        const ov = payload?.overrides && typeof payload.overrides === 'object' ? payload.overrides : {}
        const clean: Record<string, object> = {}
        for (const [pid, v] of Object.entries<any>(ov)) {
          if (!v || typeof v !== 'object') continue
          const c: Record<string, string> = {}
          if (v.layout) c.layout = String(v.layout)
          if (v.style) c.style = String(v.style)
          if (v.aspectRatio) c.aspectRatio = String(v.aspectRatio)
          if (Object.keys(c).length) clean[String(pid)] = c
        }
        writeFileSync(join(dir, '12.advice', 'overrides.json'), JSON.stringify(clean, null, 2))
        touch(id)
        return { ok: true, count: Object.keys(clean).length }
      }

      case 'project.patchStructures': {
        // 结构卡行内编辑后落盘：保留完整字段（title/description/key_elements/relationships/
        // source_excerpt 等），只规范 id，不丢其它内容。
        const id = String(payload?.id || '')
        const dir = projectDir(id)
        if (!findProject(id)) throw new Error(`project.patchStructures: 未知项目 ${id}`)
        const list: any[] = Array.isArray(payload?.structures) ? payload.structures : []
        if (!list.length) throw new Error('project.patchStructures: structures 为空')
        const cleaned = list.map((s: any, i: number) => ({
          ...s,
          id: String(s && (s.id || i + 1)),
          title: String(s?.title || s?.description || `结构 ${i + 1}`),
          type: s?.type ? String(s.type) : '',
          description: s?.description ? String(s.description) : '',
        }))
        writeFileSync(join(dir, '11.extraction', 'structures.json'), JSON.stringify({ structures: cleaned }, null, 2))
        touch(id)
        return { ok: true, count: cleaned.length }
      }

      case 'project.saveMeta': {
        // 界面编辑标题/摘要自动写盘（含项目名改写），编排器读到最新值即可。
        const id = String(payload?.id || '')
        const dir = projectDir(id)
        if (!findProject(id)) throw new Error(`project.saveMeta: 未知项目 ${id}`)
        const title = String(payload?.title || '')
        const summary = String(payload?.summary || '')
        writeFileSync(join(dir, '10.input', 'meta.json'), JSON.stringify({ document_title: title, document_summary: summary }, null, 2))
        const t = title.trim()
        if (t) {
          const list = readProjects()
          const p = list.find((x) => x.id === id)
          if (p && p.title !== t) { p.title = t; saveProjects(list) }
        }
        touch(id)
        return { ok: true }
      }

      case 'project.confirmMeta': {
        const id = String(payload?.id || '')
        const dir = projectDir(id)
        if (!findProject(id)) throw new Error(`project.confirmMeta: 未知项目 ${id}`)
        writeFileSync(join(dir, '10.input', 'meta.confirmed'), now())
        touch(id)
        return { ok: true }
      }

      case 'project.rename': {
        const id = String(payload?.id || '')
        const title = String(payload?.title || '').trim()
        if (!title) throw new Error('project.rename: 标题为空')
        const list = readProjects()
        const p = list.find((x) => x.id === id)
        if (!p) throw new Error(`project.rename: 未知项目 ${id}`)
        p.title = title
        saveProjects(list)
        return { ok: true }
      }

      case 'project.attach': {
        // CLIENT 在 workspace 流程创建会话后回填 sessionId，宿主据此做运行判定/日志。
        const id = String(payload?.id || '')
        const sessionId = String(payload?.sessionId || '')
        const list = readProjects()
        const p = list.find((x) => x.id === id)
        if (!p) throw new Error(`project.attach: 未知项目 ${id}`)
        p.sessionId = sessionId || undefined
        saveProjects(list)
        return { ok: true }
      }

      case 'project.prompt': {
        // CLIENT 每次要驱动会话前取完整 prompt（含续做/初始化上下文）。
        const id = String(payload?.id || '')
        const message = String(payload?.message || '')
        if (!message.trim()) throw new Error('project.prompt: 消息为空')
        const record = findProject(id)
        if (!record) throw new Error(`project.prompt: 未知项目 ${id}`)
        const live = record.sessionId ? await isAgentAlive(record.sessionId) : null
        return { ok: true, prompt: await composePrompt(record, message), sessionId: record.sessionId || null, live: live === true }
      }

      case 'project.render': {
        const id = String(payload?.id || '')
        const dir = projectDir(id)
        if (!findProject(id)) throw new Error(`project.render: 未知项目 ${id}`)
        if (renderJobs.has(id)) throw new Error('project.render: 已有渲染进行中，请稍候')
        if (!existsSync(join(dir, '12.advice', 'proposals.json'))) {
          throw new Error('project.render: 尚未生成 proposals.json')
        }
        const proposals = JSON.parse(readFileSync(join(dir, '12.advice', 'proposals.json'), 'utf8'))
        const all: any[] = Array.isArray(proposals.proposals) ? proposals.proposals : []
        const want = Array.isArray(payload?.proposalIds) && (payload.proposalIds as string[]).length
          ? new Set((payload.proposalIds as string[]).map(String))
          : null
        const picks = want ? all.filter((p) => want.has(String(p.id))) : all
        if (!picks.length) throw new Error('project.render: 没有要渲染的方案')
        // 参数快照，后台逐张渲染，状态落盘 render.json；RPC 立即返回 started。
        const ratios: Record<string, string> = payload?.aspectRatios && typeof payload.aspectRatios === 'object' ? payload.aspectRatios : {}
        const ov: Record<string, { layout?: string; style?: string }> =
          payload?.overrides && typeof payload.overrides === 'object' ? payload.overrides : {}
        const cfg = readImageConfig()
        const apiKey = await resolveApiKey()
        const renderId = `${id}-${Date.now()}`
        writeRenderState(id, {
          renderId, startedAt: new Date().toISOString(),
          proposals: Object.fromEntries(picks.map((p) => [String(p.id), 'pending'])),
          errors: {},
        })
        renderJobs.set(id, { renderId, startedAt: Date.now() })
        // 每个渲染批次用递增 seq 生成唯一文件名：同一方案再次渲染不覆盖旧图。
        const hist = readRenderHistory(id)
        const seq = hist.reduce((m, b) => Math.max(m, Number(b.seq) || 0), 0) + 1
        const files = picks.map((p) => `${String(p.id)}-${seq}.png`)
        hist.unshift({
          batchId: renderId, seq, startedAt: new Date().toISOString(),
          proposals: picks.map((p) => String(p.id)), outputs: files,
        })
        writeRenderHistory(id, hist)
        void runRenderBatch(id, picks, seq, { ratios, ov, proposals, cfg, apiKey })
        touch(id)
        return { ok: true, started: true, renderId }
      }


      case 'project.image': {
        const id = String(payload?.id || '')
        let name = String(payload?.name || '')
        if (!name || name.includes('/') || name.includes('..')) {
          throw new Error('project.image: 非法文件名')
        }
        const buf = readFileSync(join(projectDir(id), 'output', name))
        return { dataUrl: `data:image/png;base64,${buf.toString('base64')}` }
      }

      case 'project.pulse': {
        const id = String(payload?.id || '')
        const record = findProject(id)
        if (!record) throw new Error(`project.pulse: 未知项目 ${id}`)
        const running = record.sessionId ? await isAgentAlive(record.sessionId) : null
        return { running: running === true, stage: stageOf(projectDir(id)) }
      }

      case 'project.delete': {
        const id = String(payload?.id || '')
        if (!findProject(id)) throw new Error(`project.delete: 未知项目 ${id}`)
        rmSync(projectDir(id), { recursive: true, force: true })
        saveProjects(readProjects().filter((p) => p.id !== id))
        return { ok: true, id }
      }

      default:
        throw new Error(`dsh-pictor: 未知端点 ${endpoint}`)
    }
  }

  // ---------- 启动 ----------

  if (connection && connection.rpc && connection.rpc.handle) {
    connection.rpc.handle('/pictor', async (endpoint: string, payload: any) => {
      try {
        return { ok: true, value: await handle(endpoint, payload || {}) }
      } catch (e: any) {
        logError(`rpc:${endpoint}`, e)
        return { ok: false, error: { code: 'internal', message: String(e?.message || e), details: {} } }
      }
    }, { authority: 'loopback' })
  }

  // 静态资源：空态占位图与 layout/style 预览图，固定白名单（文件名由目录枚举而来）。
  const wsA = ctx.webServer || ctx.get?.('webServer')
  if (wsA && typeof wsA.register === 'function') {
    const IMG_CACHE = { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' }
    const WEBP_CACHE = { 'content-type': 'image/webp', 'cache-control': 'public, max-age=3600' }
    wsA.register({ kind: 'exact', path: '/pictor/asset/empty-state.png', handler: (_req, res) => {
      res.writeHead(200, IMG_CACHE); res.end(readFileSync(join(PLUGIN_ROOT, 'assets', 'empty-state.png')))
    } })
    // 预览图：按 assets/previews/{styles,layouts} 目录枚举注册，杜绝任意路径。
    for (const kind of ['styles', 'layouts'] as const) {
      for (const name of readdirSafe(join(PLUGIN_ROOT, 'assets', 'previews', kind)).filter((f) => f.endsWith('.webp'))) {
        wsA.register({ kind: 'exact', path: `/pictor/preview/${kind}/${name}`, handler: (_req, res) => {
          res.writeHead(200, WEBP_CACHE); res.end(readFileSync(join(PLUGIN_ROOT, 'assets', 'previews', kind, name)))
        } })
      }
    }
  }

  return { dataRoot: base }
}

/** 统计 structures/proposals 数量（兼容泛型与两层包裹）。 */
function countOf(json: string, key: 'structures' | 'proposals'): number {
  try {
    const data = JSON.parse(json)
    if (key === 'structures') {
      if (Array.isArray(data)) return data.length
      if (data && Array.isArray(data.structures)) return data.structures.length
    } else {
      if (data && Array.isArray(data.proposals)) return data.proposals.length
    }
    return 0
  } catch {
    return 0
  }
}

/** 前端可选的 style/layout 清单（references/domain 下文件名，供方案页下拉）。 */
function listRefs(kind: 'styles' | 'layouts'): string[] {
  const dir = join(PLUGIN_ROOT, 'references', 'domain', kind)
  return readdirSafe(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort()
}

/** 解析 10.input/meta.json：失败返回 null。 */
function parseJsonSafe(file: string): any {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 供 verify.mjs（L1 离线单元）测试的纯函数句柄。 */
export const _test = { firstLine, sanitizeFilename, scrubHtml, countOf, listRefs }