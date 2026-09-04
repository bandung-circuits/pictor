// Read-only probe against the LIVE DSH Desktop (127.0.0.1:43127).
// Route-intercepts the plugin client bundles and serves patched copies whose
// apply() records WHO THE PLUGIN CTX REALLY HAS (workspaces/sessions/
// uiWorkspace), then reports it. No data mutation — nothing is clicked,
// nothing is created.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'http://127.0.0.1:43127'
const PICTOR_BUNDLE = fs.readFileSync('/Users/gigix/Projects/03.systems/pictor/lib/client.js', 'utf8')
const POMASA_BUNDLE = fs.readFileSync('/Users/gigix/Projects/03.systems/pomasa-studio/lib/client.js', 'utf8')

const probeTemplate = (varName) => `
    try {
      const ws = ctx.get && ctx.get('workspaces');
      const ses = ctx.get && ctx.get('sessions');
      const ui = ctx.get && ctx.get('uiWorkspace');
      window['__${varName}_probe'] = {
        ws: !!ws, ses: !!ses, ui: !!ui,
        wsMethods: ws ? Object.keys(ws) : null,
        sesMethods: ses ? Object.keys(ses) : null,
        uiMethods: ui ? Object.keys(ui) : null,
        connectWs: !!(ws && typeof ws.connectWorkspace === 'function'),
        connectUi: !!(ui && typeof ui.connectWorkspace === 'function'),
        bind: !!(ses && typeof ses.binding === 'function'),
      };
      window['__${varName}_error'] = null;
    } catch (e) { window['__${varName}_error'] = String(e); }
`

function patchPomasa(bundle) {
  // pomasa: concat bundle, marker is the exports.apply assignment.
  const marker = '    exports.apply = apply;'
  if (!bundle.includes(marker)) return null
  const wrap =
    '    const __origApply = apply;\n' +
    '    apply = (ctx) => {' + probeTemplate('pomasa') + 'return __origApply(ctx); };\n' +
    marker
  return bundle.replace(marker, wrap)
}
function patchPictor(bundle) {
  // pictor: esbuild output, marker is the function definition.
  const marker = 'function apply(ctx) {'
  if (!bundle.includes(marker)) return null
  return bundle.replace(marker, (m) => m + probeTemplate('pictor'))
}
const pictorPatched = patchPictor(PICTOR_BUNDLE)
const pomasaPatched = patchPomasa(POMASA_BUNDLE)
console.log('patched:', !!pictorPatched, !!pomasaPatched)

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => { const t = m.text(); if (/pictor|pomasa|session services/i.test(t)) console.log('[console]', t.slice(0, 220)) })

page.on('request', (r) => { const u = r.url(); if (/plugin|pictor|pomasa|\.js/.test(u)) console.log('[req]', u.slice(0,160)) })
await page.route('**/plugins/dsh-pictor/client.js*', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: pictorPatched || '' }))
await page.route('**/plugins/pomasa-studio/client.js*', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: pomasaPatched || '' }))

await page.goto(BASE + '/')
await page.waitForTimeout(8000)

const out = await page.evaluate(() => ({
  pictor: (window.__pictor_probe) || { notBooted: true, error: window.__pictor_error },
  pomasa: (window.__pomasa_probe) || { notBooted: true, error: window.__pomasa_error },
}))
console.log('PROBE RESULT:')
console.log(JSON.stringify(out, null, 1))
await browser.close()