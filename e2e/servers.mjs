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

const PORT = Number(process.env.PIC_E2E_PORT || 43123)
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
execFileSync('dsh', ['plugin', '--profile', 'web', 'add', ROOT], { env: { ...process.env, DSH_HOME }, stdio: 'ignore' })
console.log('fixture home:', HOME)

const dsh = spawn('dsh', ['--profile', 'web', '--no-open', '--port', String(PORT)], {
  env: { ...process.env, PICTOR_HOME: HOME, DSH_HOME },
  stdio: ['ignore', 'inherit', 'inherit'],
})

const log = (m) => console.log('[e2e server] ' + m)
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) { log('web host ready'); return }
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
})

// 保持进程存活直到被 Playwright 终止；输出路径便于调试。
process.stdin.resume()
export { HOME }