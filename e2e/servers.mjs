// L4a e2e: seed a deterministic fixture ~/.pictor, boot the real dsh web host
// on a hermetic temp DSH_HOME with the plugin mounted from this checkout, and
// keep serving until Playwright kills us. Never touches the real ~/.dsh, so a
// running DSH Desktop is unaffected. No LLM needed: every UI state derives
// from file facts.
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'


// 0.2.x 的兼容门会参考 registry 上"已发布"的插件元数据；本地 checkout 往往
// 已放宽 peers 但新版本尚未发布（如 dock@0.1.4 vs 本地 0.1.5）。add 被拒时
// 对该精确版本授 allow-version 再重试 —— 本地代码即真相，发布后走不进此分支。
function addPluginWithCompatRetry(env, spec, published) {
  const base = ['plugin', '--profile', 'web']
  const opts = { env, stdio: 'ignore' }
  const allowAll = () => {
    for (const p of published) {
      try { execFileSync('dsh', [...base, 'allow-version', p, '--dsh-version', process.env.DSH_VERSION, '--accept-risk'], opts) } catch { /* 忽略 */ }
    }
  }
  try {
    execFileSync('dsh', [...base, 'add', spec], opts)
    return
  } catch { /* 落入豁免重试 */ }
  for (let round = 0; round < 3; round += 1) {
    allowAll()
    try {
      execFileSync('dsh', [...base, 'add', spec], opts)
      return
    } catch { /* 再来一轮 */ }
  }
  // 最后一次把错误暴露出来
  execFileSync('dsh', [...base, 'add', spec], { env, stdio: 'inherit' })
}const PORT = Number(process.env.PIC_E2E_PORT || 43123)
const HOME = mkdtempSync(join(tmpdir(), 'pictor-e2e-'))
const DSH_HOME = mkdtempSync(join(tmpdir(), 'pictor-e2e-dsh-'))
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const PNGB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function seedFixture() {
  const id = '2026-09-01-001'
  const root = join(HOME, id)
  for (const sub of ['10.input', '11.extraction', '12.advice', 'output']) {
    mkdirSync(join(root, sub), { recursive: true })
  }
  writeFileSync(join(root, '10.input', 'document.md'), '# 数字主权评估报告\n\n正文内容。')
  writeFileSync(join(root, '10.input', 'meta.json'), JSON.stringify({ document_title: '数字主权评估报告', document_summary: '按维度拆解的评估框架。' }, null, 2))
  writeFileSync(join(root, '11.extraction', 'structures.json'), JSON.stringify({
    structures: [
      { id: 's1', title: '数字主权指数结构', type: 'hierarchy', summary: '按维度拆解的评估框架' },
      { id: 's2', title: '关键技术环节', type: 'timeline', summary: '从芯片到算力的关键链路' },
    ],
  }, null, 2))
  writeFileSync(join(root, '12.advice', 'proposals.json'), JSON.stringify({
    suggested_style: 'corporate-memphis',
    proposals: [
      { id: 'p1', source_text: 'x', communicative_intent: '展示评估维度', suggested_layout: 'dashboard', estimated_complexity: 'medium' },
      { id: 'p2', source_text: 'y', communicative_intent: '呈现时间推进', suggested_layout: 'timeline', estimated_complexity: 'low' },
    ],
  }, null, 2))
  writeFileSync(join(root, 'output', 'p1.png'), Buffer.from(PNGB64, 'base64'))
  writeFileSync(join(root, 'p1-prompt.md'), 'image prompt for p1\n')
  writeFileSync(join(HOME, 'index.json'), JSON.stringify({
    projects: [
      { id, title: '数字主权评估报告', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
  }, null, 2))
}

seedFixture()
// Hermetic plugin mount: fresh profile in a temp DSH_HOME, plugin from this
// checkout — no dependency on a profile state left behind by other scripts.
execFileSync('dsh', ['--profile', 'web', '--help'], { env: { ...process.env, DSH_HOME }, stdio: 'ignore' })
// 坞先装（bundles 先于 pictor 加载，register 发生在 pictor apply 之前，pictor 才入坞）
addPluginWithCompatRetry({ ...process.env, DSH_HOME }, join(ROOT, '..', 'dsh-app-dock'), ['dsh-app-dock@0.1.4','dsh-app-dock@0.1.3','dsh-app-dock@0.1.2'])
addPluginWithCompatRetry({ ...process.env, DSH_HOME }, ROOT, ['dsh-pictor@0.2.3','dsh-pictor@0.2.2','dsh-pictor@0.2.1'])
console.log('fixture home:', HOME)

// 0.2.x 起 web host 强制 token 鉴权（cookie 由首次带 token 访问下发）。
// 这里捕获 dsh stdout 里的带 token URL 写盘，供 e2e/auth.ts 读取。
const URL_FILE = join(ROOT, 'e2e', '.dsh-e2e-url')
let dshOut = ''
const dsh = spawn('dsh', ['--profile', 'web', '--no-open', '--port', String(PORT)], {
  env: { ...process.env, PICTOR_HOME: HOME, DSH_HOME },
  stdio: ['ignore', 'pipe', 'inherit'],
})
dsh.stdout.on('data', (chunk) => {
  dshOut += chunk
  process.stdout.write(chunk)
  const m = dshOut.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/)
  if (m) { try { writeFileSync(URL_FILE, m[0]) } catch { /* 忽略 */ } }
})

const log = (m) => console.log('[e2e server] ' + m)
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(2000) })
      if (res.status < 500) { log('web host ready (status ' + res.status + ')'); return }
    } catch { /* 未就绪，继续等 */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  log('FAIL: web host did not come up')
  dsh.kill()
  process.exit(1)
}
ready()

dsh.on('exit', (code) => {
  log('dsh exited ' + code)
  process.exit(code || 0)
})
process.on('SIGTERM', () => dsh.kill())
process.on('SIGINT', () => dsh.kill())
process.on('exit', () => {
  try { rmSync(DSH_HOME, { recursive: true, force: true }) } catch { /* 忽略 */ }
  try { rmSync(URL_FILE, { force: true }) } catch { /* 忽略 */ }
})

// 保持进程存活直到被 Playwright 终止；输出路径便于调试。
process.stdin.resume()
export { HOME }