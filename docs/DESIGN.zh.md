# Pictor 界面设计 v1（从 dsh 方案干净起步）

状态：v1（2026-09-01）。本稿取代仓库根目录旧稿 `DESIGN.dsh-plugin.zh.md`（草案 v2，2026-08-25，任务列表形态），旧稿已删除，代码按本稿重构。

对应代码位：

- `01.tools/pictor`（本仓库，POMASA 版声明式 MAS 与插件本体）
- `03.systems/pomasa-studio`（形态参考：dsh 插件工作台、数据流向、UI 选型，其 `docs/UI.md` 与 `docs/DESIGN.md` 是本稿的平台经验来源）
- `03.systems/pictorial`（对照来源：项目概念与三张步骤页的布局）

## 0. 结论

Pictor 的界面是 pomasa-studio 式工作台，不是 pictorial 式 web 应用，也不是旧稿的任务列表：

1. 安装后首次使用在机器上生成 `~/.pictor` 工作区（宿主首启动 ensureIndex 建 index.json，见 2.1），并在第一次驱动会话时注册为 dsh 工作区「Pictor」（客户端经 workspaces 服务创建，见 2.2/4.4），项目会话在侧栏归组展示。
2. 唯一入口是 dsh 左下角 footer 按钮「Pictor」，开关 `shell.overlay` 有界面板。左栏列项目，右栏显示当前项目的步骤详情。
3. pictorial 的「项目」概念直接沿用：一个项目就是「一份文档转成一组信息图」。项目步骤固定三步：提取、方案、渲染。每个步骤的呈现布局借 pictorial 的三张页（structures、proposals、results），按 dsh 的文件事实状态适配。
4. 一个项目背后是一个连贯的 dsh 会话（客户端经 dsh workspace 流程创建于「Pictor」工作区、继承 profile 默认模型，见 4.4）。GUI 只发结构化指令与自由对话，界面状态只由文件事实驱动。由此每个步骤都掌握该项目会话的全局上下文，能力上超过 pictorial 的无状态流水线。
5. 两个模型拆清配置面：推理模型用 dsh 当前 profile 的默认模型，extract 与 advise 随之，无需在 Pictor 里配置；画图模型在 Pictor 工作台的「设置」里配置（provider 类型、接口地址、模型名、密钥引用），存 `~/.pictor/pictor-config.json`，密钥走 dsh 凭据子系统。
6. 复杂度低于 pomasa-studio：步骤固定不加描述符，无运行单元轴，无多模式运行控制，无每阶段产物浏览器。三个阶段条、三步内容、一个设置。
7. 输入摄取是界面便利，处理委托会话：新建界面提供上传文件（md/txt/docx/pdf/图片）或富文本粘贴（从 Word/网页粘入保留格式，落盘为消毒后的 HTML）两种输入；宿主只把内容放进项目目录并启动会话，两种来源都由会话用 dsh 工具统一规整成 document.md，读取与格式转换全部交给会话（特稿第 3 条经验管处理侧，不管输入侧）。不设标题字段，项目名暂取文档首行、信息条随时可改。

## 1. 形态决策

### 1.1 工作台 shell：学 pomasa-studio，弃旧稿的会话标签页

pomasa-studio 已经趟平了界面形态：`shell.overlay` 有界面板，footer 左下角真按钮开关，面板任意界面状态可达，会话树始终在面板左侧可见可点，不遮挡不占屏（细节与踩坑见 pomasa-studio `docs/UI.md`「最终界面形态」与「DSH 平台要点」）。

旧稿选的是 `conversation.view` 会话标签页。pomasa-studio 已论证标签页无增益（面板已覆盖任意状态，会话树在面板左侧始终可见）并移除。Pictor 直接采用面板方案，不再重复权衡。footer 按钮文案为「Pictor」，行为同 pomasa 的 POMASA Studio 按钮（收起时浮起式实心底加前置小图标，打开时强调色实心白字，`aria-expanded` 同步）。

### 1.2 项目即会话：连贯会话掌握全局信息

旧稿把任务与会话解耦，任务在 `runs.json` 列表，执行会话在后台，用户不需要理解会话概念。这个解耦牺牲了「步骤之间共享上下文」的能力。

本稿反过来：一个项目就是一个 dsh 会话，会话在项目生命周期内常驻（host 端 `Map<projectId, agent>` 持有），跨三步不重建。用户中途关闭工作台，会话继续在后台；回到项目，步骤内容从文件事实直接恢复，续上同一会话继续对话。这带来 pictorial 给不了的行为：

- 提取步骤可以回看原文、讨论整体叙事，会话记得所有讨论，再决定提取哪些结构。
- 方案步骤可以对话微调（把 3 号方案的风格改成更克制的传统感），会话知道已选方案与全部上下文，直接重出方案。
- 渲染之后可以对话要求修改再渲染，不用整条链路重跑。

连贯性的唯一代价是异常恢复与重启：dsh 重启后会话对象消失，文件是真相，界面对话可照常，用户下一次操作时惰性重建会话。orchestrator 蓝图必须写明「基于已有产物续做」的规矩（见 4.4 与风险 6.1）。

### 1.3 步骤固定：比 pomasa 更简单的阶段条

pomasa 的阶段来自 MAS 描述符 `pomasa.json`，因 MAS 而异。Pictor 的三步对每个项目都确定，阶段条硬编码，不需要描述符机制：

1. 提取（extract）：文档 → 候选信息结构列表。
2. 方案（advise）：结构 → 可视化方案列表（布局、风格、复杂度、传达意图）。
3. 渲染（render）：方案 → PNG。

两步人工门控照旧：结构确认后进入方案，方案确认且点渲染后出图。阶段条可点回到任何已有产物的步骤重做，会话上下文保留。

### 1.4 两个模型：推理跟随 dsh，画图在 Pictor 配置

复杂度高的地方只有这一处，拆清楚：

- 推理模型：extract 与 advise 由项目会话内的 agent（extractor、advisor 子智能体）完成，走 dsh 的 LLM seam。会话经 workspace 流程创建、继承 profile 默认模型。用户想换推理模型，去 dsh 的设置里改，不在 Pictor 里配。v1 不支持在 Pictor 内单独指定推理模型（可记为后续扩展）。
- 画图模型：dsh 本身没有生图概念，这是 Pictor 独有的配置面。配置项为 provider 类型（seedream、gemini、openai-compatible、mock）、接口地址、模型名、密钥引用。数据落 `~/.pictor/pictor-config.json`，密钥值由凭据 seam 保存，配置只回显「已配置/未配置」。mock 提供无密钥的本地体验路径（verify 与 e2e 用它）。

### 1.5 摄取是界面便利，处理委托会话

分清楚两层，别把「便捷输入」和「文档转换」混为一谈。

摄取不能省：用户需要方便的入口把内容送进项目。新建界面提供两种输入，二选一：

- 上传文件：选本地文件（md、txt、docx、pdf，甚至图片），原样送进项目目录的 10.input/（原始文件另存，与 document.md 区分），会话用 dsh 的 read_document 等工具读懂并规整出 document.md。图片由会话用视觉能力读取，来源同样成立。
- 富文本粘贴：一个可编辑富文本框，从 Word 或网页粘来的文字保留原本的格式（标题、加粗、列表、链接、引用），保存时把消毒后的内容以 HTML 形式落盘为 10.input/source.html，作为原始输入。不写 HTML 转 md 的转换代码：消毒后的 HTML 就是原始输入，和上传文件一样，统一由会话规整成 document.md。保留格式是为了让会话读到文档结构，格式保真由原样保存保证，不再经一层有损转换，日后重编辑原始粘贴内容时 HTML 也能直接装回富文本框。

处理完全委托：宿主不写 docx/pdf 的读取转换，也不写 HTML 转 md 的转换（特稿第 3 条经验照旧）。上传的文件与粘贴的 HTML 都原样落盘，读与规整交给会话；质量难题由会话与讨论面板兜底（风险 6.3）。

富文本的实现要点：可编辑框用浏览器原生 contenteditable，粘贴时拦截剪贴板，把 text/html 消毒后插入（script、style、iframe 一律剥离，属性只留 href 与必要的列表语义）；保存时直接序列化消毒后的 innerHTML 为 HTML 落盘，客户端不写转换器。消毒在粘贴与落盘两处都做，防止把外部不可信 HTML 再渲染回工作台；因为存的是 HTML，工作台内再展示这段源时也必须走消毒后的副本，不直接 innerHTML 注入外部内容。

项目名暂时取文档首行（md 文档第一行通常就是标题，暂做法，用户对品质不满意，先做其它功能，此项列为待改进）：粘贴模式取粘贴内容的首个非空行，超过约 30 字截断加省略号；上传模式对 md/txt 客户端可直接取首行，docx/pdf 暂时退回文件名，待会话规整后首行通常即标题。名字只是展示标签，不参与身份（项目 id 是 uuid，目录名是 id，都不随名字变），任何时刻可在项目信息条改名，改名只动 index.json 一项，不碰会话与目录。同名项目允许并列，靠改名区分。不调 LLM 起名，也不为此引入任何第三方库（调研结论见 research/title-generation-libs.md）：提取式摘要与关键词库全是英文分词体系，中文不可用；生成式要么模型太重要么环境受限。远期两处勾子：会话在首轮读完文档后可提出更好名字，作为信息条里的一键采纳建议，dsh 的会话标题 LLM 提供方机制（first-prompt 节奏、路由继承零配置、用户改名钉住、refresh 解钉）可直接复用，调研见 research/dsh-session-title-subsystem.md；Chrome Summarizer API 的 headline 类型在中文支持落地后是零依赖最优解。

文件传输：文件经 RPC 以 data URL（base64）传给宿主写盘；超大文件（长 PDF、大图）若超过 RPC 负载上限，降级走 webServer 临时上传端点（见风险 6.10）。

## 2. 数据与工作区

### 2.1 `~/.pictor` 布局

默认数据根为 `~/.pictor`（可用 settings 覆盖：`PICTOR_HOME` 环境变量或宿主 config.dataDir，如摆到 `~/Pictor` 便于在 Finder 直接看 PNG）。由宿主首启动时 `ensureIndex` 初始化（index.json 空表），不建预置模板目录（无静态资产需预置）。

```
~/.pictor/
├── index.json            # 项目索引（id、title、createdAt、updatedAt），可推导的缓存
├── pictor-config.json    # 生图模型配置（明文，密钥只存引用）
└── <project-id>/         # 项目目录，自包含，删除即删目录、备份即拷目录
    ├── agents/           # 蓝图快照（10.orchestrator/11.extractor/12.advisor/00.renderer）
    ├── references/       # domain 参考快照（base-prompt、layouts、styles、diagram-types、visual-principles）
    ├── 10.input/         # document.md（会话规整的文档）；上传的原始文件与粘贴的 source.html 同目录另存
    ├── 11.extraction/    # structures.json
    ├── 12.advice/        # proposals.json
    └── output/           # <proposalId>.png + <proposalId>-prompt.md
```

`index.json` 是索引缓存，逻辑上可推导（扫描项目目录加 title）。用户产物（输入、结构、方案、PNG、prompt、state）全部在该目录内，可整目录 git/rsync 备份，与 MAS 文件数据总线哲学一致。

### 2.2 workspace 注册

「Pictor」工作区由**客户端**创建（照 pomasa `ensurePomasaWorkspaceClient`）：经 `ctx.workspaces` 服务 `create({ path: dataRoot })` 建工作区并 `rename` 标题为「Pictor」，会话经 `connectWorkspace` 创建后天然归入该工作区（not in Ungrouped）。宿主侧不做 registry 注册；只在客户端 `project.attach` 回填 sessionId 后凭它做运行判定与日志。

### 2.3 阶段判定（文件事实，唯一权威）

绝不读 orchestrator 会话文本参与状态推导；会话记录统一在 dsh 侧栏查看，界面不呈现。

| 文件事实 | 阶段 |
|---|---|
| 目录已建但 `10.input/document.md` 不存在 | 准备中（会话获取文档中，UI 显示运行态） |
| 有 `document.md`，无 `structures.json` | 提取中（extracting） |
| 有 `structures.json`，无 `proposals.json` | 结构确认门（gated:structure） |
| 有 `proposals.json` | 方案确认门（gated:advice） |
| `output/` 有任意 PNG | 已出图（partially done） |

「运行中」的判定用 dsh agent 注册表为权威（`ctx.get('agents').get(sessionId)?.status === 'running'`，同 pomasa）：文件停在中间态而会话已死，判为失败并可手动重发指令。

## 3. 界面设计

### 3.1 整体

工作台分栏：左栏项目导航，右栏详情。渲染面为 `shell.overlay` 有界面板，具体装配沿用 pomasa-studio 定稿形态（全帧 click-through 底、左部透空保持 dsh 侧栏可用、右侧为工作台交互区），视觉细节不再重复设计，见 pomasa-studio `docs/UI.md`。工作台内：

- 左栏 `.pt-nav`：项目列表 + 顶部「新建项目」。
- 右栏 `.pt-main`：信息条 + 阶段条 + 当前步骤内容区 + 讨论面板（可折叠）+ 设置入口。

### 3.2 左栏：项目列表（对照 pictorial dashboard）

pictorial 的 dashboard 页「Your Projects」是项目入口页，本稿把它变成左栏常驻列表，去掉多余层级。每项展示：

- 文件名（标题），截断。
- 阶段徽记（提取中、待选结构、方案推荐中、待选方案、已出图、失败），用语义色状态点与短语。
- 首张缩略图（有 PNG 时），无则几何占位图标。
- 相对时间（上次更新）。

「新建项目」按钮永远在左栏导航头，全屏只有这一处创建入口（零项目时右栏是纯引导 hero，指向左栏按钮，同 pomasa 规则）。新建表单只有输入，没有标题字段：上传区选本地文件（md、txt、docx、pdf、图片），显示所选文件名并支持换选；或切换到富文本粘贴区，从 Word 或网页粘入内容，格式保持，落盘为消毒 HTML（实现见 1.5）。项目名由输入自动产生（见 1.5），任何时刻可在信息条改名。提交即建目录、启动会话，会话拿到文件路径或粘贴的 HTML 后自行规整与读取；宿主不做文档格式转换。删除在项目详情内，二次确认，连带删项目目录并终止会话。

### 3.3 右栏：项目详情

顶部信息条：项目名（自动生成，铅笔图标可改名）、创建时间、当前阶段、原始文档名。下方阶段条（硬编码三步）：每格显示状态灯（等待、运行中、完成、失败、跳过），格子上的该步产物数量（结构数、方案数、图数）。点击某格选中该步骤，内容区切换（同 pictorial 的 `getTargetPage` 逻辑：进入项目默认落在最靠后的有产物步骤）。

### 3.4 步骤一：提取（借 pictorial structures 页）

内容区 = 候选结构卡片列表，数据源 `11.extraction/structures.json`。每张卡片（对照 pictorial structures 页的卡片布局）：

- 结构类型徽标（层次、时间线、网络、对比、辩论、流程等 diagram-types 枚举）。
- 标题、概要。
- 扩展后可看该结构的来源依据与提取理由（extractor 产物里记录的段落引用与 rationale，这是会话版带来的可回查信息）。
- 勾选/取消，可编辑。

侧边（或展开区）可回看输入文档。底部「确认已选结构，进入方案」按钮：注入结构化指令（`project.prompt`，消息形如「用户确认结构 1、3，进入方案阶段」），客户端驱动同一会话调 advisor。确认后阶段推到 gated:advice，阶段条随之推进。

结构确认页同时提供对话旁路入口（讨论面板），可先讨论再确认。

### 3.5 步骤二：方案（借 pictorial proposals 页）

内容区 = 方案卡片列表，数据源 `12.advice/proposals.json`。每张卡片（对照 pictorial proposals 页的卡片布局）：

- 布局名与风格名（references 里的 layout/style 标题化展示）。
- 复杂度与传达意图一行。
- 勾选多个备渲染；卡片可展开预览将用于渲染的完整 prompt（base-prompt + 布局规范 + 风格规范 + 内容 + 传达意图，即 `proposals.json` 到 prompt 的组装预览，透明可查）。

定制项：宽高比在每张方案卡上单独设置（缺省 16:9，同 pictorial 交互），经 `project.render` 的 `aspectRatios` 参数按方案下发到渲染请求；风格微调留待讨论面板里让会话来做（不动 MAS）。确认后进入步骤三。

### 3.6 步骤三：渲染（借 pictorial results 页）

内容区 = 出图结果网格，数据源 `output/*.png`。对已勾选的方案逐张渲染，每张独立成败：

- 未渲染：等待；渲染中：骨架屏加状态；完成：PNG 预览；失败：错误提示与重试。
- 每张图附「查看 prompt」入口（`<proposalId>-prompt.md`）与下载。

生图模型未配置时，渲染按钮禁用并给一行引导：「去设置配置生图模型」。渲染由 host 确定性直驱（见 4.3），不占用智能体会话。

### 3.7 讨论面板：MAS 全局信息优势的落地处

项目详情底部可折叠的讨论面板，向该项目会话注入自由文本（`project.prompt` 后客户端驱动同一会话）。这是 GUI 表达不了的事的承载：补充参考、要求搜索背景、换思路重跑、微调某个方案。因为会话连贯，讨论内容天然成为后续步骤的上下文。缺省收起。界面不呈现会话记录：会话文本与 AI 思考、工具调用一概在 dsh 侧栏对应会话里看（与 pomasa 一致，不重复做日志面板）。

### 3.8 设置：两个模型的配置面

工作台内「设置」视图（左栏底部或右栏齿轮进入）：

- 生图模型：provider 类型（seedream / gemini / openai-compatible / mock）、接口地址（openai-compatible 必需）、模型名、密钥（写入凭据 seam，界面只显示「已配置」）。配好后可点「测试连接」（调一次 mock 或真实端点出最小图）。
- 推理模型：一行说明「推理使用 dsh 当前默认模型，改动请到 dsh 设置」，不做输入。
- 数据目录：只读展示当前 `~/.pictor` 路径。

### 3.9 视觉规则

沿用 pomasa-studio `docs/UI.md` 的既定规则，不改再发明：不引第三方 UI 库（运行时槽位不允许 import，组件自写，`React.createElement` 加 `styles.insert(css)`），颜色全部用 `--dsw-alias-*` 主题变量遵循明暗主题，Geist 比例、shadcn 结构。基础字号 16px、页标题 28px、区块标题 20px、卡片标题 16px，行高 1.6 起、卡片内边距 20px 起、区块间距 28px 起、内容最大宽度约 1024px 居中，圆角 12 到 16px，单一强调色，动效克制，空态为几何图形加一句引导。CSS 以模板字面量注入，内部禁反引号，给工作台根加 border-box 子树重置（两条踩坑规则直接沿用）。

自写组件清单（就此一次）：PageHeader、Card、Button、Badge、StatusDot、StageStrip、StructureCard、ProposalCard、ImageCard、EmptyState、Field、Collapsible、SettingsView、可见的 Markdown 内嵌渲染器（React 元素输出，杜绝 innerHTML）。

## 4. 交互与执行

### 4.1 RPC 端点表（`shell.overlay` 面板经 `ctx.connection.rpc`，端点前缀 `/pictor`）

读：

| 端点 | 输入 | 输出 |
|---|---|---|
| `config.get` | 无 | 生图模型配置（密钥只回显 hasKey）+ 数据根路径 |
| `project.list` | 无 | `index.json` 加各项目实时阶段、缩略图引用、相对时间 |
| `project.get` | projectId | 记录、文件树（json 产物直接读）、当前阶段 |
| `project.event.pulse` | projectId | 该会话是否运行中（agent 注册表） |
| `project.log` | projectId | 项目会话完整记录（消息、工具调用、思考过程），翻页 |

写：

| 端点 | 输入 | 效果 |
|---|---|---|
| `config.set` | provider/endpoint/model/keyRef | 写 `pictor-config.json`，密钥经凭据 seam |
| `config.test` | 无 | 用当前配置出一张最小测试图 |
| `project.create` | title, source | source 为上传文件（data URL）或粘贴的消毒 HTML；宿主写内容到 10.input/（文件原样另存、粘贴写成 source.html）、建 agents/references 自包含副本、写 index；**不建会话**，返回 { id, title, prompt }（prompt 为初始指令，供客户端驱动） |
| `project.attach` | projectId, sessionId | 客户端在 workspace 流程创建会话后回填 sessionId，宿主据此做运行判定 |
| `project.prompt` | projectId, message | 返回要驱动的完整 prompt：关联会话存活时即本次消息（同一会话续跑）；否则先附续做指令再拼本次消息 |
| `project.rename` | projectId, title | 只改 index.json 的 title，不碰项目目录与执行会话 |
| `project.prompt` | projectId, message | 返回要驱动的完整 prompt：会话存活即本次消息（同会话续跑）；否则附续做指令再拼消息 |
| `project.render` | projectId, proposalIds, aspectRatios | 读 `proposals.json`，拼 prompt 落盘 `<id>-prompt.md`，调生图 provider 出 `<id>.png`，逐 proposal 独立成败；宽高比按方案取 `aspectRatios[id]`，缺省 16:9 |
| `project.image` | projectId, filename | PNG 回读 data URL（防路径穿越） |
| `project.delete` | projectId | 终止会话、删目录、更新 index |

### 4.2 双通道纪律（写入 orchestrator 蓝图）

orchestrator 蓝图内已有双通道输入纪律（结构化指令与自由对话两条通道），本稿保留并强调：收到结构化指令按参数执行、完成即回报、绝不跳过用户门控；收到自由对话先评估是否影响当前阶段再行动；所有读写限定在项目目录内。GUI 动作一律带 id 与参数，不做模糊指令。

### 4.3 render 确定性直驱

渲染是确定性动作，由 GUI 按钮经 `project.render` 走 host 侧实现（拼 prompt + 直调生图 API），不占用智能体会话。`agents/00.renderer.md` 保留为契约引用（多角色提示词体系里 renderer 的职责声明），供未来「让会话自己决定渲染」的场景。推理质量（extract/advise）与渲染质量（生图模型）在配置面上彻底分开，对应 1.4 的两个模型。

### 4.4 会话生命周期（客户驱动，经 dsh workspace 流程）

- 会话**由客户端创建与驱动**（照 pomasa 的 `driveSession` 模式），宿主不建会话：客户端经 `workspaces` 服务确保「Pictor」工作区（`create({path: dataRoot})` + `connectWorkspace` 复用或新建会话，会话天然归入该工作区、继承 profile 默认模型），再经 `sessions.binding(id).prompt(blocks, 'queue')` 驱动。
- 宿主只做两件事：脚手架与出 prompt。`project.create` 返回初始指令；每次用户动作经 `project.prompt` 取「完整 prompt」——关联会话存活时就是本次消息（同一会话续跑），否则先附续做指令再拼本次消息。
- 客户端驱动经 `project.prompt` 后优先续用已记录的同一会话（`sessions.binding(sessionId).prompt`），使后面阶段能读到前面阶段在会话里的全文/结构上下文；会话对象失效（如 dsh 重启）才经 workspace 流程新建并 `project.attach` 回填。宿主凭 sessionId 经 `agents` 注册表判运行（pulse）。不再依赖 `agentLoop`，也不做会话日志面板（看会话直接去 dsh 侧栏）。
- dsh 重启后会话对象消失：界面从文件事实恢复，下一次用户动作时 prompt 附续做指令、客户端再建会话驱动。orchestrator 蓝图显式支持「基于已有产物续做」：读到 `structures.json` 或 `proposals.json` 存在时，说明当前状态并等待指令，绝不重跑已有阶段。
- 多项目彼此独立会话，天然并行，v1 不做队列。

## 5. 与旧稿及现状的差异与改造清单

| 项 | 旧稿/现状 | 本稿 |
|---|---|---|
| 界面入口 | `conversation.view` 标签页「Pictorial」 | footer 按钮「Pictor」开 `shell.overlay` 有界面板 |
| 组织单位 | 任务（runs.json 列表）+ 会话解耦 | 项目（index.json），一项目一会话 |
| 数据根 | `$DSH_HOME/pictor/` | `~/.pictor`（模板初始化 + 注册工作区） |
| 项目目录 | `runs/<id>/` | `<project-id>/` 自包含（含 agents/references 快照） |
| 阶段 | prepared→gated:structure→gated:advice→done | 同根，补齐 executing 中间态与 agent 注册表运行判定 |
| 界面模块 | src/client/index.js（任务列表+详情） | 重构为左栏导航+右栏步骤工作台 |
| 生图配置 | pictor-config.json 已有，UI 为配置弹窗 | 工作台「设置」视图，provider 四选 |
| 双模型 | 推理模型沿用 dsh 默认（已核查 desktop profile llm-pi-ai 可用） | 同，文档明示 |

改造清单（实施阶段按此推进）：

1. 删除旧稿 `DESIGN.dsh-plugin.zh.md`（已完成）。
2. `~/.pictor` 初始化：宿主 ensureIndex 建 index.json（已完成，不建模板目录）。
3. `src/host/index.ts` 重构：数据根改 `~/.pictor`，runs.json/任务模型改 index.json/项目模型；**不建会话**，project.create/attach/prompt 出 prompt 与回填 sessionId（见 4.4/4.1）；新增输入接收（文件写盘、粘贴 HTML 写盘）；render 直驱保留；不写任何文档格式转换逻辑（规整交给会话）。
4. `src/client/index.js` 重构：见 3.1 到 3.9。
5. `scripts/transport-smoke.sh` 与 `verify.mjs` 更新断言（项目模型端点、文件事实阶段、config 双模型）。
6. `README.md` 更新安装与使用流（Pictor 工作台，不再提「Pictorial 标签页」）。
7. orchestrator 蓝图补两段：文档获取与规范化职责（读来源、必要时转换、写 10.input/document.md，拿不准就问）；「已存在产物时续做、不重跑」规矩（见 4.4）。

## 6. 风险与待决

| # | 风险 | 处置 |
|---|---|---|
| 6.1 | 会话重启后的连贯性：dsh 重启后会话对象消失，对话上下文丢失 | 文件是真相，界面照常；下次操作惰性重建会话；orchestrator 蓝图写清续做规矩。这是「项目即会话」模型的关键风险，实施时原型验证 |
| 6.2 | 生图模型文字准确性：生图模型对信息图文字不可控（pictorial 已验证） | v1 AI 直出沿用；「内容契约 + 模板渲染」作为可选后端记入远期，不做进 v1 |
| 6.3 | 会话读取上传文件（docx/pdf/图片）的质量与判断不完全可控 | 用 dsh 的 read_document 等文档工具，遇质量问题用讨论面板干预重做；宿主不写转换器 |
| 6.4 | 生图 provider 差异：混元 prompt 上限、Gemini 为主力 | 沿用 image-providers.ts 抽象，v1 不做自动降级 |
| 6.5 | 长会话上下文膨胀 | extract/advisor 经 subagent 实例化，蓝图写明省上下文纪律；必要时讨论面板分卷 |
| 6.6 | 密钥与接入信息落点 | 有凭据 seam 用 seam（配置只存引用）；profile 未装凭据服务（如 desktop 组合无 credentials bundle）时降级明文存 pictor-config.json 并如实提示，界面显 hasKey 与 keyStorage |
| 6.7 | 与 DSH 版本耦合 | 只依赖 stable 面（connection/agentLoop/workspaceRegistry/shell.overlay/client 槽位），verify 冒烟兜底 |
| 6.8 | 首次使用引导 | 新建第一个项目后未配置生图模型时，步骤三给一行引导去设置；设置里 mock 可零密钥体验 |
| 6.9 | 双语言 | 已实现 pomasa 式语言开关（左栏底部 中文/English，localStorage 记忆，默认中文）；界面文案双语，产物内容保持原语言 |
| 6.10 | 富文本粘贴内容的保真与安全，以及超大文件传输 | 粘贴与落盘两处消毒白名单，原样存 HTML 不再过转换，格式保真由会话规整时保证；超大文件超过 RPC 负载上限时降级 webServer 临时上传端点 |

## 7. 验证

- off-line：`verify.mjs` 冒烟（结构、契约、file-fact 阶段机、config 双模型、project 生命周期、render 流水线、发布边界）。
- transport：`scripts/transport-smoke.sh` 直测 `/pictor` RPC（项目 CRUD、submit 注入、render 直驱、image 回读）。
- e2e：Playwright 用 fixture 合成文档 + mock provider，走「新建项目（上传 fixture md）→ 结构页出现 → 勾选确认 → 方案页出现 → 勾选渲染 → 出图」全链路，验证各步骤布局与门控；粘贴路径另测（富文本粘贴落盘 source.html 并规整出 document.md 断言）；重启场景验证「文件事实恢复 + 惰性重建会话」。
- live 冒烟：`verify:live`（真实 LLM，分钟级）需在带 LLM 密钥的进程环境/profile 下显式运行；自动化环境无 `MAKU_BAILIAN_API_KEY` 时会话可建但模型不产出，属环境门槛而非缺陷。