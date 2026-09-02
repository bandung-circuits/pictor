# 调研：给定一篇文章得出一个简短标题（JS 库盘点）

状态：2026-09-01，为 Pictor 项目自动命名决策补的一轮调研。问题：上传/粘贴一个文档后，项目名（纯展示标签）除了取文件名、取首行之外，有没有现成 JS 库能给出更好的短标题。

## 结论

没有专门做「文章 → 标题」的成熟 JS 库。最近的方案分三类，各有硬限制；对 Pictor 这层「展示标签」而言，维持「文件名/首行 + 随时改名 + 远期 LLM 建议」的既定决策不变。两个远期勾子值得记录：Chrome 内置 Summarizer API 的 headline 类型（当中文支持落地后是零依赖最优解）、DSH 生态的会话标题插件先例。

## 三类可用方案与核验事实

### 生成式（抽象标题，真正产出 headline 形态）

| 方案 | 形态 | 核验事实 | 限制 |
|---|---|---|---|
| Chrome Summarizer API | 浏览器内置 Gemini Nano，无库 | developer.chrome.com/docs/ai/summarizer-api（已抓全文）：type 支持 headline，定义为「用一句话包含输入要点、按文章标题格式」；short 12 词 / medium 17 词 / long 22 词；Chrome 138 stable 起可用；工作台可直接 feature-detect `'Summarizer' in self` | 语言只支持 en/ja/es/de/fr，「中文支持开发中」；模型下载重（22GB 空闲磁盘、16GB 内存或 4GB 显存）；依赖运行环境是 Chromium 且用户开启 |
| transformers.js（@huggingface/transformers） | 本地跑摘要/标题生成模型 | BlanchardJulien 等教程（搜索结果，未深抓） | 模型数十至数百 MB；为项目名上这个量级不划算；与我方「运行时槽位不允许 import」需构建期 inline，模型仍需外部下载 |
| LLM 直出 | 我们的 dsh 本来有推理模型 | `@deepseek-ai/dsh-session-title-first-prompt-llm`（npm registry 核验，2026-08-12 发布）：DSH 生态已有「用首条消息经 LLM 起会话标题」的插件先例 | 用户已判麻烦：为一个展示标签多一次模型调用、多一个中间态。先例值得记录，远期做「LLM 建议名字」时可能直接复用它的机制 |

### 提取式摘要（无模型，取最高分句当标题）

| 库 | 形态 | 核验事实 | 限制 |
|---|---|---|---|
| text-summarization（transitive-bullshit） | npm 包，提取式多指标摘要 | GitHub README 全文已抓：输出最高分句子列表，「利用 HTML 结构作为重要性信号」；曾驱动 Automagical（2018 年被收购） | 英文体系；体积与依赖大；Node 专属依赖（natural、fs），浏览器半没法直接 inline；维护已停滞 |
| node-summarizer | npm 包，零依赖 | npm registry 核验：ISC，零 deps，仓库 SwapnikKatkoori/Text-Summarizer | 极简英文频次式，质量低；同样英文体系 |
| fast-ai-text-summary | npm 包，频次式提取 | npm registry 核验：MIT，仓库 AkshayPanchivala/fast-ai-text-summary | 同上，英文 stopwords 体系 |

### 关键词提取（无模型，取关键词作标题候选）

| 库 | 形态 | 核验事实 | 限制 |
|---|---|---|---|
| keyword-extractor | npm 包，零依赖 | npm registry 核验：0.3.0，2013 年创建，去除英文 stopword 后抽关键词 | 英文体系；中文没有分词就是整篇堆词，不可用 |
| nodejieba（中文分词） | 中文分词，可提取 TF-IDF 关键词 | 名声事实：社区常见方案 | 原生模块（C++ 构建），违反本工作区 lean、无外部依赖原则；为一个展示标签加这个层面不值 |

## 对 Pictor 的结论

1. 既定决策不变：上传取文件名去扩展名，粘贴取首个非空行截断；名字随时可改；不为此引入任何库。
2. 一个不用库的增强可以考虑：粘贴模式内容里若带了 H1 级标题元素（从网页粘贴时常见），优先取该 H1；否则取首行。实现成本为零，不引入依赖。
3. 远期勾子记录在案：a) Chrome Summarizer API 的 headline 类型，中文支持落地且确认工作台宿主环境为 Chromium 时，feature-detect 后零依赖启用；b) DSH 生态的会话标题 LLM 插件先例，届时「LLM 建议项目名」可复用其机制。

## 核验来源

- developer.chrome.com/docs/ai/summarizer-api（全文已抓）
- registry.npmjs.org/@deepseek-ai/dsh-session-title-first-prompt-llm（元数据已核）
- github.com/transitive-bullshit/text-summarization（README 已抓全文）
- registry.npmjs.org/keyword-extractor、node-summarizer、fast-ai-text-summary（元数据已核）