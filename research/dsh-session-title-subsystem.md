# 调研：DSH 会话标题子系统与 first-prompt 提供方插件

状态：2026-09-01。起因是 Pictor 项目自动命名决策，跟进 `@deepseek-ai/dsh-session-title-first-prompt-llm` 一个看起来贴题的插件。全部结论来自本地 DSH 源码（`01.tools/deepseek-harness/packages/session/`）与 npm registry 元数据，未用搜索摘要。

## 插件本身：一层薄提供方

`@deepseek-ai/dsh-session-title-first-prompt-llm`（源码在 harness monorepo 的 `packages/session/session-title-first-prompt-llm/`，npm latest 0.0.1-rc.3，发布时间 2026-08-12，版本尚在 rc，迭代很快）。

它是 `ctx.sessionTitle` 服务的可选 LLM 提供方，注册 `first-prompt` 节奏：

- 只在全新非 fork 会话首次创建的回退环节自动运行一次；用 `ctx.llm` 总结第一条符合条件的用户消息（请求体只是一个含该消息的 JSON 数组），并把结果归因到该消息的确切 seq。
- 自动失败就保留确定性回退，之后只能靠 `ctx.sessionTitle.refresh()` 显式重试。
- 配置：targetWords、targetCjkCharacters、maxInputBytes、maxOutputTokens、timeoutMs、provider、model。provider 与 model 都省略时继承当前已记录主请求的确切路由；同时设置则标题生成走独立路由。注意「配置零开销」的路由继承做法。
- 兄弟插件 `session-title-all-prompts-llm`：总结全部符合条件的用户消息，每条新提示词后启新 revision，新 revision 取代旧工作；解决长会话里首条消息不再有代表性的问题。

## 底座：dsh-session-title 服务（关键部分）

`packages/session/session-title/`，纯日志支撑的会话标题服务。要点：

- 确定性回退内建于服务本身：第一条符合条件的 `user/message` 文本块触发，取开头若干词成标题（fallbackMaxWords、fallbackMaxBytes、maxTitleBytes 三个必填上限，库不设默认值）。也就是说，任何 chat 会话不需要任何插件就自动有标题，插件只是把这条回退升级成 LLM 标题。
- 清洗（`normalize.ts`）：剥 OSC/CSI/ESC 控制序列、零宽与方向控制字符，空白归一为一行；按 UTF-8 字节预算截断且不切断码点。标题面向终端安全。
- `rename(session, title)`：用户显式改名，接受后钉住该会话，后续用户消息不再自动改；显式 `refresh` 是有意的解钉手段。
- `register(provider)`：提供方注册表最多一个，第二次注册直接抛错；要组合多个策略须自写一个自行负责优先级的提供方。
- 自动工作绝不推迟主 agent 响应；标题以独立纯日志事件追加，不开轮次，不占主请求 token。
- fork 会话继承种子标题事件，first-prompt 不会为子会话重跑。

## 对 Pictor 的意义

1. 命名锚点一致：DSH 生态确定性的默认标题就是「第一条用户消息的开头若干词」，和我们「首行截断」的决策同源。first-prompt 插件存在本身也说明首条消息是生态默认锚点。
2. 每条 dsh 会话（包括我们建的每个 Pictor 项目会话）都会由 harness 自动起标题，侧栏展示无忧，不用我们管。
3. 远期「LLM 建议项目名」的架构可照抄：首消息锚点、用户改名后钉住、refresh 显式重跑、字节预算截断清洗、路由继承零配置。真要做时，直接复用这套语义，不必自造轮子。
4. 我们 1.5 里写的远期勾子可指向本文件。注意该领域的谐波：会话标题子系统 2026-07-21 实现，包还在 rc，接口可能会变，远期落地时需重新核对。

## 核验来源

- `01.tools/deepseek-harness/packages/session/session-title-first-prompt-llm/`（README.zh.md、src/index.ts、src/invariant.ts）
- `packages/session/session-title/`（README.zh.md、src/index.ts、src/normalize.ts）
- `packages/session/session-title-all-prompts-llm/README.zh.md`
- registry.npmjs.org/@deepseek-ai/dsh-session-title-first-prompt-llm（元数据已核）