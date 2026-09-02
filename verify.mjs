// 离线冒烟验证（L1 单元 + L2 host 集成），不连接真实 DSH。
// 分层：L1 纯函数（标题/消毒/文件名/计数）；L2 用 mock ctx 驱动宿主插件，
// 覆盖 ~/.pictor 项目模型全生命周期：create（文件/粘贴/只出 prompt 不建会话）→
// attach 回填会话 → prompt 续跑语义 → 阶段推进 → 渲染 → 删除，以及凭据 seam。
// 会话创建与驱动是 CLIENT 的职责（workspace 流程），宿主测试不模拟 agentLoop。
// 运行：npm run build && node verify.mjs
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const ERRORS = []
async function check(name, fn) {
  try {
    await fn()
    console.log('  PASS  ' + name)
  } catch (e) {
    ERRORS.push(name)
    console.log('  FAIL  ' + name + ' — ' + (e && e.message ? e.message : String(e)))
  }
}

function tmpdirP() {
  return mkdtempSync(join(tmpdir(), 'pictor-verify-'))
}

// ---------- L1：纯函数 ----------

async function l1() {
  const { _test } = await import('./lib/index.js')
  const { firstLine, sanitizeFilename, scrubHtml, countOf } = _test

  await check('L1 firstLine 剥标签取首行', () => {
    assert.equal(firstLine('<h1>数字主权宣言</h1>'), '数字主权宣言')
    const long = firstLine('<p>' + '很长的'.repeat(30) + '</p>')
    assert.ok(long.endsWith('…'), '超长应截断加省略号，实际 ' + long)
    assert.ok(long.length <= 31)
  })
  await check('L1 sanitizeFilename 剥路径与怪字符', () => {
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd')
    assert.equal(sanitizeFilename('研究报告.docx'), '研究报告.docx')
  })
  await check('L1 scrubHtml 剥脚本与事件属性', () => {
    const inHtml = '<div onclick="x()"><script>alert(1)</script><style>a{}</style>' +
      '<a href="javascript:alert(1)">链接</a>正文</div>'
    const out = scrubHtml(inHtml)
    assert.ok(!out.includes('script'), '应剥掉 script 标签')
    assert.ok(!out.includes('style>'), '应剥掉 style 标签')
    assert.ok(!out.includes('onclick'), '应剥掉 on* 属性')
    assert.ok(!/href="javascript:/i.test(out), '应剥掉 javascript: href')
    assert.ok(out.includes('正文'), '正文保留')
  })
  await check('L1 countOf 兼容两层包裹', () => {
    assert.equal(countOf(JSON.stringify({ structures: [{}, {}] }), 'structures'), 2)
    assert.equal(countOf(JSON.stringify([{ id: 'a' }]), 'structures'), 1)
    assert.equal(countOf(JSON.stringify({ proposals: [{}, {}, {}] }), 'proposals'), 3)
    assert.equal(countOf('not json', 'structures'), 0)
  })
}

// ---------- L2：宿主集成（mock ctx） ----------

function bootFake(dataDir, opts = {}) {
  let handler = null
  const connection = {
    rpc: { handle: (path, fn) => { if (path === '/pictor') handler = fn } },
  }
  const credentials = {
    stored: {},
    async set(ref, value) { this.stored[ref] = value },
    async unset(ref) { delete this.stored[ref] },
    async describe(ref) { return { configured: Boolean(this.stored[ref]) } },
    async resolve(ref) {
      return this.stored[ref] !== undefined ? { value: this.stored[ref], source: 'fake' } : undefined
    },
  }
  // 宿主靠 CLIENT 回填的 sessionId，经 agents 注册表判定运行、sessionPersistence 读日志。
  const running = new Map()
  const agents = { get: (sid) => ({ status: running.get(sid) ? 'running' : 'idle' }) }
  const sessionPersistence = {
    async inspect(sid) {
      return { meta: { id: sid }, events: [{ type: 'message', seq: 1, data: { role: 'user', content: 'hi' } }] }
    },
  }
  const ctx = {
    connection,
    agents,
    sessionPersistence,
    ...(opts.noCredentials ? {} : { credentials }),
    get(name) {
      const svc = { connection, agents, sessionPersistence }
      if (!opts.noCredentials) svc.credentials = credentials
      return svc[name]
    },
  }
  const harness = {
    running,
    _ctx: ctx,
    async call(endpoint, payload) {
      const result = await handler(endpoint, payload || {})
      assert.ok(result && typeof result === 'object', 'RPC 必须返回对象信封')
      assert.equal(result.ok, true, '端点 ' + endpoint + ' 应成功')
      return result.value
    },
    async callErr(endpoint, payload) {
      const result = await handler(endpoint, payload || {})
      assert.ok(result && result.ok === false, '端点 ' + endpoint + ' 应返回错误对象')
      assert.ok(result.error && typeof result.error.message === 'string', '错误必须是 {ok:false,error:{message}}')
      return result.error
    },
  }
  return harness
}

async function l2() {
  const dataDir = tmpdirP()
  const h = bootFake(dataDir)
  {
    const host = await import('./lib/index.js')
    host.apply(h._ctx, { dataDir })
  }

  // --- 创建（文件）：宿主只脚手架+出 prompt，绝不创建会话 ---
  let created = null
  await check('L2 create(文件)：目录/索引/出 prompt、不建会话', async () => {
    created = await h.call('project.create', {
      file: { name: '数字主权评估报告.docx', dataUrl: 'data:application/pdf;base64,SGVsbG8gV29ybGQ=' },
    })
    assert.ok(created.id)
    const dir = join(dataDir, created.id)
    assert.ok(existsSync(join(dir, '10.input', '数字主权评估报告.docx')), '原始文件原样落盘')
    assert.ok(existsSync(join(dir, 'agents', '10.orchestrator.md')), '蓝图自包含副本')
    assert.ok(existsSync(join(dir, 'references', 'domain', 'layouts')), 'references 自包含副本')
    const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'))
    assert.equal(idx.projects.length, 1)
    assert.equal(idx.projects[0].title, '数字主权评估报告', '文件名去扩展名为默认标题')
    assert.ok(created.prompt && created.prompt.includes('agents/10.orchestrator.md'), '返回初始指令供 CLIENT 驱动')
    // 宿主不持有会话：create 后 index.json 不应有 sessionId
    assert.equal(idx.projects[0].sessionId, undefined, '会话由 CLIENT 建，宿主 create 不产生 sessionId')
  })

  // --- 创建（粘贴 HTML） ---
  let pasted = null
  await check('L2 create(粘贴)：scrub、首行标题、source.html', async () => {
    pasted = await h.call('project.create', {
      html: '<h1>数字主权的七个要点</h1><p>第一段</p><script>alert(1)</script>',
    })
    const src = readFileSync(join(dataDir, pasted.id, '10.input', 'source.html'), 'utf8')
    assert.ok(!src.includes('script'), '粘贴内容已消毒')
    assert.ok(pasted.title.startsWith('数字主权的七个要点'), '标题取首行，实际 ' + pasted.title)
  })

  // --- prompt 语义：无存活会话附续做指令；会话存活直传消息（同会话续跑） ---
  await check('L2 prompt：无会话附续做指令、有会话直传消息', async () => {
    const r1 = await h.call('project.prompt', { id: created.id, message: '确认结构 1，进入方案阶段' })
    assert.ok(r1.prompt.includes('agents/10.orchestrator.md'), '无关联会话：先附初始/续做指令')
    assert.ok(r1.prompt.includes('确认结构 1'), '并拼本次消息')
    const p0 = await h.call('project.get', { id: created.id })
    assert.equal(p0.record.sessionId, undefined, '宿主不自行创建会话')
  })

  await check('L2 attach 回填会话 + prompt 会话存活时直传', async () => {
    await h.call('project.attach', { id: created.id, sessionId: 'sess-live' })
    const rec = (await h.call('project.get', { id: created.id })).record
    assert.equal(rec.sessionId, 'sess-live', 'attach 后宿主知道会话 id')
    h.running.set('sess-live', true)
    const r2 = await h.call('project.prompt', { id: created.id, message: '继续' })
    assert.equal(r2.prompt, '继续', '会话存活：直传本次消息，同一会话续跑')
    h.running.set('sess-live', false)
    const r3 = await h.call('project.prompt', { id: created.id, message: '再来' })
    assert.ok(r3.prompt.includes('agents/10.orchestrator.md'), '会话不再存活：重新附续做指令')
    assert.ok(r3.prompt.includes('再来'), '并拼本次消息')
  })

  // --- 阶段机（文件事实） ---
  await check('L2 阶段由文件事实推进', async () => {
    const dir = join(dataDir, pasted.id)
    writeFileSync(join(dir, '10.input', 'document.md'), '# 标题\n正文内容')
    writeFileSync(join(dir, '11.extraction', 'structures.json'), JSON.stringify({
      structures: [{ id: 's1', title: '第一个结构', type: 'hierarchy' }],
    }))
    let got = await h.call('project.get', { id: pasted.id })
    assert.equal(got.record.stage, 'gated:structure', '有 structures.json 即门控')
    writeFileSync(join(dir, '12.advice', 'proposals.json'), JSON.stringify({
      suggested_style: 'corporate-memphis',
      proposals: [{ id: 'p1', source_text: 'x', communicative_intent: 'y', suggested_layout: 'dashboard' }],
    }))
    got = await h.call('project.get', { id: pasted.id })
    assert.equal(got.record.stage, 'gated:advice')
    writeFileSync(join(dir, 'output', 'p1.png'), Buffer.from('iVBORw0KGgo=', 'base64'))
    got = await h.call('project.get', { id: pasted.id })
    assert.equal(got.record.stage, 'done', 'output 有 png 即 done')
    const list = await h.call('project.list')
    const item = list.projects.find((p) => p.id === pasted.id)
    assert.equal(item.structuresCount, 1)
    assert.equal(item.proposalsCount, 1)
  })

  // --- 改名 ---
  await check('L2 rename 只动 index.json', async () => {
    await h.call('project.rename', { id: pasted.id, title: '改名后的项目' })
    const got = await h.call('project.get', { id: pasted.id })
    assert.equal(got.record.title, '改名后的项目')
    assert.ok(existsSync(join(dataDir, pasted.id, '10.input', 'source.html')), '目录与产物不动')
  })

  // --- 凭据 seam + 配置 ---
  await check('L2 config：密钥只存引用，hasKey 来自凭据服务', async () => {
    const before = await h.call('config.get')
    assert.equal(before.image.hasKey, false)
    await h.call('config.set', { image: { provider: 'mock', apiKeyRef: 'PICTOR_IMAGE_API_KEY', apiKey: 'secret-token' } })
    assert.equal(h._ctx.credentials.stored.PICTOR_IMAGE_API_KEY, 'secret-token')
    const after = await h.call('config.get')
    assert.equal(after.image.hasKey, true)
    assert.equal(after.image.provider, 'mock')
    const configJson = JSON.parse(readFileSync(join(dataDir, 'pictor-config.json'), 'utf8'))
    assert.ok(!JSON.stringify(configJson).includes('secret-token'), '配置 json 不含明文密钥')
    const testRes = await h.call('config.test')
    assert.equal(testRes.ok, true)
    // 额外请求参数：字符串解析为对象；非法 JSON 被拒
    const withExtra = await h.call('config.set', {
      image: { provider: 'mock', extra: '{"parameters":{"prompt_extend":true}}' },
    })
    assert.deepEqual(withExtra.image.extra, { parameters: { prompt_extend: true } })
    await h.callErr('config.set', { image: { extra: '{bad' } })
  })

  // --- config：无凭据服务时降级明文 ---
  await check('L2 config 无凭据服务时降级明文存储', async () => {
    const d2 = tmpdirP()
    const h2 = bootFake(d2, { noCredentials: true })
    {
      const host = await import('./lib/index.js')
      host.apply(h2._ctx, { dataDir: d2 })
    }
    const res = await h2.call('config.set', { image: { provider: 'mock', apiKey: 'plain-secret' } })
    assert.equal(res.image.hasKey, true)
    assert.equal(res.image.keyStorage, 'file')
    const cfg = JSON.parse(readFileSync(join(d2, 'pictor-config.json'), 'utf8'))
    assert.equal(cfg.image.apiKey, 'plain-secret')
    assert.equal((await h2.call('config.test')).ok, true)
  })

  // --- 渲染 + 图片回读 + 路径穿越防护 ---
  await check('L2 render(mock)：异步启动、状态落盘、p1.png 生成、image 回读、防穿越', async () => {
    const dir = join(dataDir, pasted.id)
    const res = await h.call('project.render', { id: pasted.id, proposalIds: ['p1'] })
    assert.equal(res.started, true, 'render 应立即返回 started')
    // 后台渲染：轮询 render.json 直到 finishedAt（mock 瞬时）
    let st = null
    for (let i = 0; i < 20; i++) {
      st = (await h.call('project.get', { id: pasted.id })).renderState
      if (st && st.finishedAt) break
      await new Promise((r) => setTimeout(r, 50))
    }
    assert.ok(st && st.finishedAt, 'renderState 应有 finishedAt')
    assert.equal(st.proposals.p1, 'done', 'p1 状态应为 done')
    assert.ok(existsSync(join(dir, 'p1-1-prompt.md')), 'image prompt 落盘（带批次 seq）')
    assert.ok(existsSync(join(dir, 'output', 'p1-1.png')), '输出文件带唯一批次名，覆盖不丢旧图')
    const img = await h.call('project.image', { id: pasted.id, name: 'p1-1.png' })
    assert.ok(img.dataUrl.startsWith('data:image/png;base64,'))
    await check('L2 project.image 拒绝路径穿越', async () => {
      await h.callErr('project.image', { id: pasted.id, name: '../index.json' })
      await h.callErr('project.image', { id: pasted.id, name: '/etc/passwd' })
    })
  })

  // --- pulse（凭 sessionId，经 agents 注册表判运行） ---
  await check('L2 pulse 凭回填的 sessionId', async () => {
    await h.call('project.attach', { id: pasted.id, sessionId: 'sess-2' })
    h.running.set('sess-2', true)
    const pulse = await h.call('project.pulse', { id: pasted.id })
    assert.equal(pulse.running, true)
    h.running.set('sess-2', false)
    const pulse2 = await h.call('project.pulse', { id: pasted.id })
    assert.equal(pulse2.running, false)
  })

  // --- 非法创建与删除 ---
  await check('L2 create 无内容被拒', async () => {
    await h.callErr('project.create', {})
  })
  await check('L2 delete 移除目录与索引', async () => {
    const id = pasted.id
    const target = join(dataDir, id)
    assert.ok(existsSync(target))
    await h.call('project.delete', { id })
    assert.ok(!existsSync(target), '项目目录已删')
    const list = await h.call('project.list')
    assert.ok(!list.projects.some((p) => p.id === id))
  })
}

async function main() {
  console.log('== L1 单元（纯函数） ==')
  await l1()
  console.log('== L2 宿主集成（mock ctx） ==')
  await l2()
  console.log('')
  if (ERRORS.length) {
    console.log('失败 ' + ERRORS.length + ' 项：')
    for (const e of ERRORS) console.log('  - ' + e)
    process.exit(1)
  }
  console.log('verify 全部通过')
}

main().catch((e) => {
  console.error('verify 崩溃：', e)
  process.exit(1)
})