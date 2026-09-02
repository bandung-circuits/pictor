# Pictor — 文档转信息图工作台

<p align="right"><i>English below.</i></p>

[源码仓库](https://github.com/bandung-circuits/pictor) · [问题与讨论](https://github.com/bandung-circuits/pictor/issues)

Pictor 把一份文档变成一组信息图。它是 DeepSeek Harness（DSH）的插件：每新建一个项目，宿主创建一个连贯的会话作为项目会话，整个「提取 → 方案 → 渲染」流程都在这个会话里推进，GUI 只做两件事：查看信息、规整输入。设计文档见 [docs/DESIGN.zh.md](docs/DESIGN.zh.md)。

## 形态

- 安装后首次使用自动生成 `~/.pictor` 工作区（注册为 dsh 工作区，侧栏归组见「Pictor」）。
- 唯一入口是 dsh 左下角 footer 按钮「Pictor」，打开 shell.overlay 工作台：左栏列项目，右栏显示当前项目。
- 项目步骤固定三步：提取结构 → 方案设计 → 渲染出图。每步由你做决定后，会话在同一会话里接着执行（agent-loop 的 resume 语义），不重跑已有阶段。
- 项目名取文档首行，信息条内随时可改名，只动 index.json。
- 状态只由文件事实驱动；运行中判定以 dsh agent 注册表为权威；把你对 orchestration 的关心都留给会话。

## 两个模型

- 推理模型：extract 与 advise 用 dsh 当前默认模型，无需在 Pictor 配置。
- 画图模型：在工作台「设置」里配置（seedream / gemini / openai-compatible / mock）。密钥经 dsh 凭据子系统保存，配置只留引用。

## 安装

Pictor 以 npm 包 `dsh-pictor` 发布：

```bash
dsh plugin --profile <profile> add dsh-pictor
```

重启 profile 后，footer 左下角出现「Pictor」按钮。开发安装（改动源码实时联调）见 [docs/DESIGN.zh.md](docs/DESIGN.zh.md)。

## 使用

1. 打开工作台，点「新建项目」：上传文件（md/txt/docx/pdf/图片）或粘贴内容（从 Word/网页粘贴，格式保留，落盘为消毒 HTML）。
2. 会话读取并规整来源（docx/pdf/图片/HTML → document.md 由会话用 dsh 工具完成），提取候选结构。
3. 勾选结构，确认，会话进入方案设计；勾选方案，设画面比例，点「渲染所选方案」。
4. 结果网格里预览、下载；随时可展开讨论面板对会话说话，或点步骤条回到已有产物的步骤重做。

## 开发与验证

```bash
npm run build         # esbuild 构建 host + 拼接 client
npm run verify        # L1 单元 + L2 host 集成（mock ctx，15 项）
npm run verify:integration   # L3 transport 冒烟（真实 dsh web）
npm run test:e2e      # L4a 浏览器 e2e（fixture 数据，确定性）
```

测试分层的定义与理由见 [docs/DESIGN.zh.md](docs/DESIGN.zh.md) 第 7 节。

## 目录

```
pictor/
├── agents/                # 声明式蓝图（orchestrator/extractor/advisor/renderer）
├── references/domain/     # base-prompt + layouts/ + styles/ + diagram-types/ + visual-principles
├── src/host/              # 插件宿主：~/.pictor、项目会话、/pictor RPC、生图
├── src/client/            # 工作台 UI（React.createElement + 主题变量）
├── e2e/                   # L4a Playwright
├── verify.mjs             # L1+L2 离线冒烟
└── scripts/               # build + transport-smoke
```

数据目录 `~/.pictor/`：`index.json`（项目索引）、`pictor-config.json`（画图模型配置）、`<项目 id>/`（自包含：agents/references 快照 + 10.input + 11.extraction + 12.advice + output）。

## 许可证

MIT，见 [LICENSE](LICENSE)。

---

## English

Pictor turns a document into a set of infographics. It is a DeepSeek Harness (DSH) plugin published on npm as [`dsh-pictor`](https://www.npmjs.com/package/dsh-pictor); the source lives at [github.com/bandung-circuits/pictor](https://github.com/bandung-circuits/pictor). Each project is one coherent agent session that carries the whole extract → advise → render flow, and the GUI is a thin layer that only shows file-fact state and shapes your input. Design decisions live in [docs/DESIGN.zh.md](docs/DESIGN.zh.md).

- A `~/.pictor` home is provisioned on first use and registered as a DSH workspace; all project sessions group under "Pictor" in the sidebar.
- The only entry point is the bottom-left "Pictor" footer button, which toggles a `shell.overlay` workbench: projects on the left, the selected project on the right.
- Every project has three fixed steps: extract structures → design proposals → render images. After each human decision the **same session resumes** to keep working; existing artifacts are never re-derived (file facts are the source of truth).
- Reasoner: DSH's default model (no Pictor config). Image model: configured in the workbench Settings (seedream / gemini / openai-compatible / mock); the API key goes through DSH's credentials subsystem.
- Tests: L1 unit + L2 host integration (`npm run verify`), L3 real-dsh transport smoke (`npm run verify:integration`), L4a browser e2e against a seeded fixture (`npm run test:e2e`).

MIT licensed.