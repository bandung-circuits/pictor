# 提示词审阅记录（2026-08-25）

对照 pictorial（03.systems/pictorial/src/lib/prompts/ 现行版）审阅并合并 pictor 的 DSH 版提示词体系。结论写入 agents/ 各蓝图。

## 对比结论

### 11.extractor.md（pictor 旧 113 行 vs pictorial 新版 119 行）

| 维度 | pictor 旧版 | pictorial 新版 | 合并决策 |
|---|---|---|---|
| Stage 2 结构类型表 | 15 行结构表 | 完全一致 | 无差异 |
| Stage 3 潜力评估 | 一致 | 一致 | 无差异 |
| 输出格式 | YAML（extraction.yaml） | **JSON（含 source_excerpt 字符串）** | 采用 JSON 契约：`{OUTPUT_DIR}/structures.json` |
| source_location 字段 | 有 | 无（新版删了） | 保留（对 Advisor 定位与 QUA-03 追溯有价值） |
| 输出路径 | 硬编码 `workspace/{TASK_ID}/11.extraction/` | 隐含 | 参数化：`{DOCUMENT_PATH}` + `{OUTPUT_DIR}`（跨运行时可用，含 DSH run 目录） |

### 12.advisor.md（pictor 旧 151 行 vs pictorial 新版 136 行）

| 维度 | pictor 旧版 | pictorial 新版 | 合并决策 |
|---|---|---|---|
| Language Policy | 仅 source_text / communicative_intent 英文，rationale 可中文，带"未来多语言"注释 | **全部字段英文**，策略段精简 | 采用新版全英文策略 |
| Style 映射表 | 10 行 | 多一行：**左翼期刊/长文内页插图/全球南方研究 → bandung-circuit**；可用列表 21 个 | 采用新版（含 bandung-circuit，与已同步的 style 文件呼应） |
| Stage 1 读取 | 硬编码 extraction.yaml | 泛化"读取提取结果" | 采用泛化 + 参数 `{EXTRACTION_DIR}/structures.json` |
| 输出格式 | YAML（proposals.yaml） | **JSON** | 采用 JSON 契约：`{OUTPUT_DIR}/proposals.json` |
| references 提示行 | 有（styles/layouts 规范路径提示） | 新版丢了 | 保留（对运行时定位模板文件必要） |
| Completion Criteria | 无"合法 JSON"项 | 有 | 采用新版 |
| 其它 | layout 映射表 | 一致（network-graph 等） | 无差异 |

### 10.orchestrator.md（本次重写，非 diff）

1. **双通道输入纪律（新增）**：结构化指令（GUI 按钮，带参数）与自由对话（用户插话）都是运行时输入；绝不跳过用户门控；操作限定参数目录（设计文档 3.9 落地）。
2. **Subagent 调用规范**：保留 BHV-02 全部条款，工具名从"Task 工具"泛化为"运行环境的子代理工具"（Claude Code 的 Task / DSH 的 subagent），跨运行时可移植（COR-02 要求）。
3. **Stage 0 由"建目录"改为"确认输入就绪"**：run 目录、目录结构、蓝图资产、document.md 由宿主（插件）负责，编排器只管确认与执行。
4. **契约名同步**：structures.json / proposals.json。
5. **门控显式化**：Stage 1 后停下等用户选结构、Stage 3 后停下等用户选方案。

### 00.renderer.md（契约名同步，实质重构留待 F）

proposals.yaml 引用全部改为参数化 `{PROPOSALS_PATH}`（proposals.json）；bash 外联（gemini-image.sh / GEMINI_API_KEY）在本阶段保留，F 阶段改为 pictorial_render 工具直调生图 API。

## 同步动作（本轮已完成）

- [x] 11.extractor.md：JSON 契约 + source_location 保留 + 路径参数化
- [x] 12.advisor.md：全英文 + bandung-circuit + JSON 契约 + 参数化 + references 提示保留
- [x] 10.orchestrator.md：双通道纪律 + 子代理工具泛化 + 参数化 + JSON 契约 + 门控显式化
- [x] 00.renderer.md：契约引用改 proposals.json
- [x] host（src/host/index.ts）：initialPrompt 引用 orchestrator 蓝图；stageOf/task.get 契约改 JSON
- [x] client（src/client/index.js）：确认结构消息与 debug 面板字段改 JSON

## 遗留

- F 阶段：renderer 实质重构（去 bash、pictorial_render 工具、output/ 输出）。
- 模板资产复核（2026-08-25 补充）：layouts 26 个、styles 21 个、base-prompt.md 逐文件 diff 与 pictorial 完全一致，无缺失。