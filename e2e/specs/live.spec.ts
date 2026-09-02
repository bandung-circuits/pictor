// L4b live 冒烟：真实 LLM 全流程（分钟级，显式调用）。
//   npm run verify:live
// 新建一个粘贴项目，等会话（workspace 流程，真实模型）提取出结构卡。
// 与 L4a 的区别：L4a 用 fixture 数据确定性展示，本文件不 mock、真金白银跑。
import { test, expect } from '@playwright/test'

test.setTimeout(300_000)

test('live：新建项目 → 会话真实提取出候选结构', async ({ page }) => {
  await page.goto('/')
  // 冷环境模态兜底
  for (const label of ['Continue', 'Configure later', '试试', '跳过']) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {})
  }
  await page.waitForTimeout(500)

  await page.locator('.pt-footer-action').click()
  await page.getByRole('button', { name: '新建项目' }).click()
  await page.getByRole('button', { name: '粘贴内容' }).click()
  await page.locator('.pt-rich').fill(
    '数字主权指数是一套按国家维度评估数据治理、基础设施与算法自主权的框架。' +
    '它涵盖数据本地化、算力国产化、平台监管与跨境数据流动四个关键环节，' +
    '为全球南方的技术政策比较提供一个可量化的分析工具。',
  )
  await page.getByRole('button', { name: '创建项目' }).click()

  // 阶段条出现，默认停在提取步骤（等待结构）
  await expect(page.locator('.pt-stage', { hasText: /提取结构/ })).toBeVisible({ timeout: 60_000 })
  // 等待真实的提取会话把候选结构落盘并回显（分钟级）
  await expect(page.locator('.pt-option-title').first()).toBeVisible({ timeout: 240_000 })
  const count = await page.locator('.pt-option-title').count()
  expect(count).toBeGreaterThan(0)
})