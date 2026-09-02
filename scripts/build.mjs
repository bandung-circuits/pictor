// 构建脚本：产出 lib/index.js（host，esbuild 转译 TS）+ lib/client.js（client，load/factory 包装）。
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

await build({
  entryPoints: ['src/host/index.ts', 'src/host/image-providers.ts', 'src/host/render.ts'],
  outdir: 'lib',
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
})

const body = readFileSync('src/client/index.js', 'utf8')
const wrapped = `// dsh-pictor — Client half (browser)。由 scripts/build.mjs 生成，请修改 src/client/index.js。
window.__ModuleLoader__.load({
  id: "dsh-pictor",
  factory: (require) => {
${body}
    return { inject, apply }
  }
})
`
writeFileSync('lib/client.js', wrapped)
console.log('已生成 lib/index.js 与 lib/client.js')