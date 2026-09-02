// L4a spec：fixture 驱动的确定性断言，覆盖工作台全状态空间。
// 依赖：真实 dsh web host（servers.mjs）+ fixture ~/.pictor。
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// dsh 冷环境可能弹两个顶层模态（测试提示、API key）；有就关掉。
async function dismissModals(page: Page) {
  for (const label of ['Continue', 'Configure later', '试试', '跳过']) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
    }
  }
  await page.waitForTimeout(500)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dismissModals(page)
})

test('footer 按钮打开工作台，左栏列出 fixture 项目', async ({ page }) => {
  const footer = page.getByRole('button', { name: 'Pictor' })
  await expect(footer).toBeVisible({ timeout: 20000 })
  await footer.click()
  // 工作台左栏出现项目列表
  await expect(page.getByText('数字主权评估报告')).toBeVisible({ timeout: 15000 })
})

test('进入项目：信息条、阶段条、渲染步骤出图', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.getByText('数字主权评估报告').click()
  // 信息条里的"已出图"徽章（左栏导航里也有同名状态文案，须限定作用域）
  await expect(page.locator('.pt-infobar .pt-badge', { hasText: '已出图' })).toBeVisible({ timeout: 10000 })
  // 阶段条三格
  await expect(page.getByText('提取结构')).toBeVisible()
  await expect(page.getByText('方案设计')).toBeVisible()
  await expect(page.getByText('渲染出图')).toBeVisible()
  // 默认落在渲染步骤：图片可见
  await expect(page.locator('.pt-img-card')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.pt-img-card figcaption')).toBeVisible()
})

test('点回提取/方案步骤可回看产物（文件事实驱动）', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.getByText('数字主权评估报告').click()
  await page.getByRole('button', { name: /提取结构/ }).click()
  await expect(page.getByText('数字主权指数结构')).toBeVisible()
  await expect(page.getByText('关键技术环节')).toBeVisible()
  await page.getByRole('button', { name: /方案设计/ }).click()
  await expect(page.getByText(/展示评估维度/)).toBeVisible()
  await expect(page.getByText(/呈现时间推进/)).toBeVisible()
})

test('设置页展示画图模型配置面', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.getByText('设置画图模型').click()
  await expect(page.getByText('生图 provider')).toBeVisible()
  await expect(page.locator('.pt-input select, select.pt-input').first()).toBeVisible()
  await expect(page.getByText(/推理走 dsh 默认模型/)).toBeVisible()
})

test('改名：信息条内联编辑', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.getByText('数字主权评估报告').click()
  await page.getByRole('button', { name: '改名' }).click()
  const input = page.locator('.pt-rename-input')
  await input.fill('改名后的项目')
  await input.press('Enter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('改名后的项目')
})

test('结构卡行内编辑并落盘', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.locator('.pt-nav-item .name').first().click()
  await page.getByRole('button', { name: /提取结构/ }).click()
  await page.locator('.pt-card button', { hasText: '编辑' }).first().click()
  const input = page.locator('.pt-card input.pt-input').first()
  await input.fill('编辑后的结构名')
  await page.locator('.pt-card button', { hasText: '保存' }).first().click()
  await expect(page.getByText('编辑后的结构名')).toBeVisible({ timeout: 5000 })
})

test('结构详情弹窗', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.locator('.pt-nav-item .name').first().click()
  await page.getByRole('button', { name: /提取结构/ }).click()
  await expect(page.locator('.pt-card button', { hasText: '详情' }).first()).toBeVisible()
  await page.locator('.pt-card button', { hasText: '详情' }).first().click()
  await expect(page.locator('.pt-modal')).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.locator('.pt-modal')).toHaveCount(0)
})

test('结果图点击弹大图', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.locator('.pt-nav-item .name').first().click()
  await expect(page.locator('.pt-img-card img')).toBeVisible({ timeout: 10000 })
  await page.locator('.pt-img-card img').first().click()
  await expect(page.locator('.pt-modal')).toBeVisible()
  await expect(page.locator('.pt-modal-body img')).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.locator('.pt-modal')).toHaveCount(0)
})

test('点外收起面板 + 重开恢复关闭前界面', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.locator('.pt-nav-item .name').first().click()
  await expect(page.locator('.pt-infobar h1').first()).toBeVisible()
  const title1 = await page.locator('.pt-infobar h1').first().textContent()
  // 点 dsh 侧栏区域（面板外）→ 自动收起
  await page.mouse.click(100, 200)
  await expect(page.locator('.pt-shell-panel')).not.toBeVisible()
  // 再点 Pictor → 恢复关闭前的项目详情（不是首页）
  await page.getByRole('button', { name: 'Pictor' }).click()
  await expect(page.locator('.pt-infobar h1').first()).toBeVisible()
  await expect(page.locator('.pt-infobar h1').first()).toHaveText(title1 || '')
})

test('方案布局选择弹窗与重置', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.locator('.pt-nav-item .name').first().click()
  await page.getByRole('button', { name: /方案设计/ }).click()
  const layoutBtn = page.getByRole('button', { name: /布局:/ }).first()
  await expect(layoutBtn).toBeVisible()
  await layoutBtn.click()
  await expect(page.locator('.pt-modal .pt-preview-item').first()).toBeVisible()
  const imgs = await page.locator('.pt-modal img[src*="/pictor/preview/layouts/"]').count()
  expect(imgs).toBeGreaterThan(0)
  expect(await page.locator('.pt-modal .pt-preview-item.sel').count()).toBe(1)
  // 选另一布局 -> 关闭 + 「已改」提示
  await page.locator('.pt-modal .pt-preview-item').nth(1).click()
  await expect(page.locator('.pt-modal')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /·已改/ }).first()).toBeVisible()
  // 打开后「回到 AI 推荐」
  await page.getByRole('button', { name: /布局:/ }).first().click()
  await page.getByRole('button', { name: '回到 AI 推荐' }).click()
  await expect(page.locator('.pt-modal')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /布局:/ }).first()).not.toHaveText(/已改/)
})

test('方案覆盖刷新后保留', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  await page.locator('.pt-nav-item .name').first().click()
  await page.getByRole('button', { name: /方案设计/ }).click()
  const layoutBtn = page.getByRole('button', { name: /布局:/ }).first()
  await layoutBtn.click()
  await page.locator('.pt-modal .pt-preview-item').nth(2).click()
  await expect(page.getByRole('button', { name: /·已改/ }).first()).toBeVisible()
  await page.waitForTimeout(800) // 等防抖落盘
  await page.reload()
  await page.waitForTimeout(4000)
  await page.locator('.pt-footer-action').click()
  await page.locator('.pt-nav-item .name').first().click()
  await page.getByRole('button', { name: /方案设计/ }).click()
  await expect(page.getByRole('button', { name: /·已改/ }).first()).toBeVisible()
  // 复位，避免影响后续用例
  await page.getByRole('button', { name: /布局:/ }).first().click()
  await page.getByRole('button', { name: '回到 AI 推荐' }).click()
})

test('语言切换与每卡宽高比', async ({ page }) => {
  await page.getByRole('button', { name: 'Pictor' }).click()
  // 取左栏第一个项目（改名用例会改掉标题，不按名字定位）
  await page.locator('.pt-nav-item .name').first().click()
  await page.getByRole('button', { name: /方案设计/ }).click()
  // 每张方案卡自带宽高比，缺省 16:9
  const first = page.locator('.pt-card select').first()
  await expect(first).toBeVisible()
  await expect(first).toHaveValue('16:9')
  // 语言切换：English / 中文
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Settings image model' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /方案设计/ })).toHaveCount(0)
  await page.getByRole('button', { name: '中文' }).click()
  await expect(page.getByRole('button', { name: '设置画图模型' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /方案设计/ })).toBeVisible()
})