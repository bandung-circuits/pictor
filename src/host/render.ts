// dsh-pictor — render 提示词组装（与 agents/00.renderer.md 的 Step 2 对应，host 侧确定性实现）。
// 读取 run 目录内自拷贝的 reference 资产（QUA-03：任务自包含），替换 base-prompt 占位符。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface RenderInput {
  sourceText: string
  communicativeIntent: string
  suggestedLayout: string
  suggestedStyle: string
  estimatedComplexity?: string
  aspectRatio?: string
  language?: string
}

export interface RenderPromptResult {
  prompt: string
  textLabels: string
}

export function renderPrompt(input: RenderInput, runDir: string): RenderPromptResult {
  const refs = (rel: string) => join(runDir, 'references', 'domain', rel)

  const base = readFileSync(refs('base-prompt.md'), 'utf8')

  let layoutGuidelines = `（未找到 ${input.suggestedLayout} 的 layout 规范文件，仅按名称使用）`
  try {
    layoutGuidelines = readFileSync(refs(`layouts/${input.suggestedLayout}.md`), 'utf8')
  } catch {}

  let styleGuidelines = `（未找到 ${input.suggestedStyle} 的 style 规范文件，仅按名称使用）`
  try {
    styleGuidelines = readFileSync(refs(`styles/${input.suggestedStyle}.md`), 'utf8')
  } catch {}

  const aspect = input.aspectRatio || '16:9'
  const lang = input.language || 'English'

  const textLabels = [
    `Communicative intent: ${input.communicativeIntent}`,
    `Suggested layout: ${input.suggestedLayout}`,
    input.estimatedComplexity ? `Estimated complexity: ${input.estimatedComplexity}` : undefined,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = base
    .replaceAll('{{LAYOUT}}', input.suggestedLayout)
    .replaceAll('{{STYLE}}', input.suggestedStyle)
    .replaceAll('{{ASPECT_RATIO}}', aspect)
    .replaceAll('{{LANGUAGE}}', lang)
    .replaceAll('{{LAYOUT_GUIDELINES}}', layoutGuidelines)
    .replaceAll('{{STYLE_GUIDELINES}}', styleGuidelines)
    .replaceAll('{{CONTENT}}', input.sourceText)
    .replaceAll('{{TEXT_LABELS}}', textLabels)

  return { prompt, textLabels }
}