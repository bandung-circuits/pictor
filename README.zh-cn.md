# Pictor — 文档转信息图工作台

[ [English](./README.md) | 中文 ]

Pictor 把一份文档变成一组信息图。它是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的插件，已发布到 npm 包 [`dsh-pictor`](https://www.npmjs.com/package/dsh-pictor)，源码仓库在 [github.com/bandung-circuits/pictor](https://github.com/bandung-circuits/pictor)。每新建一个项目，宿主创建一个连贯的会话作为项目会话，整个「提取 → 方案 → 渲染」流程都在这个会话里推进，GUI 只做两件事：查看信息、规整输入。设计文档见 [docs/DESIGN.zh.md](docs/DESIGN.zh.md)。

![Pictor 初始工作台](docs/screenshot-empty.png)

## 安装

已发布到 npm，安装即一行命令：

```bash
dsh plugin --profile <profile> add dsh-pictor
```

把 `<profile>` 换成目标 profile 名（如 `desktop`、`web`），然后启动该 profile，dsh 左下角会出现「Pictor」按钮。首次使用自动生成 `~/.pictor` 工作区（注册为 dsh 工作区，侧栏归组见「Pictor」）。开发安装（改动源码实时联调）见 [docs/DESIGN.zh.md](docs/DESIGN.zh.md)。

非技术用户可安装 [DSH Desktop](https://dshdesktop.com/en/)（社区维护项目，非 DeepSeek 官方产品，把 DeepSeek Harness 运行封装成可直接打开的桌面应用），然后让 dsh 里的 AI 帮装，发这一句即可：

> 帮我把 Pictor 插件装上，从 npm 包 dsh-pictor 装到当前 profile，需要的话重启，装好告诉我左下角有没有 Pictor 入口。

## 使用

1. 打开工作台，点「新建项目」：上传文件（md/txt/docx/pdf/图片）或粘贴内容（从 Word/网页粘贴，格式保留，落盘为消毒 HTML）。
2. 会话读取并规整来源（docx/pdf/图片/HTML → document.md 由会话用 dsh 工具完成），提取候选结构。
3. 勾选结构，确认，会话进入方案设计；勾选方案，设画面比例，点「渲染所选方案」。
4. 结果网格里预览、下载；随时可展开讨论面板对会话说话，或点步骤条回到已有产物的步骤重做。

![Pictor 项目工作中](docs/screenshot-workbench.png)

## 形态

- 安装后首次使用自动生成 `~/.pictor` 工作区（注册为 dsh 工作区，侧栏归组见「Pictor」）。
- 唯一入口是 dsh 左下角 footer 按钮「Pictor」，打开 shell.overlay 工作台：左栏列项目，右栏显示当前项目。
- 项目步骤固定三步：提取结构 → 方案设计 → 渲染出图。每步由你做决定后，会话在同一会话里接着执行（agent-loop 的 resume 语义），不重跑已有阶段。
- 项目名取文档首行，信息条内随时可改名，只动 index.json。
- 状态只由文件事实驱动；运行中判定以 dsh agent 注册表为权威；把你对 orchestration 的关心都留给会话。

## 两个模型

- 推理模型：extract 与 advise 用 dsh 当前默认模型，无需在 Pictor 配置。
- 画图模型：在工作台「设置」里配置（seedream / gemini / openai-compatible / mock）。密钥经 dsh 凭据子系统保存，配置只留引用。

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

## 文档

- 设计与决策：[docs/DESIGN.zh.md](docs/DESIGN.zh.md)
- 验证清单：[docs/verification-checklist.zh.md](docs/verification-checklist.zh.md)

## 许可证

MIT，见 [LICENSE](LICENSE)。第三方内容声明见 [NOTICE.md](NOTICE.md)。