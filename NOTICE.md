# NOTICE — 第三方内容声明

本仓库包含以下源自第三方的内容，请在分发或再使用时留意相应许可：

## references/paper/

- `2601.23265v1.md`：arXiv 预印本 2601.23265v1 的正文提取（仅文本，不含 PDF），
  作为研究背景资料随源码仓库分发。
- `paperbanana-prompts.md`：同一 arXiv 预印本附录 G、H 中提示词原文的忠实提取与中文翻译。

两者均**不随发布包分发**（package.json 的 files 仅含 `references/domain`），
只存在于源码仓库。再分发请以 arXiv 原文及其作者声明的许可为准。

## 免责声明

除上述文件外，本仓库其余内容（agents/ 蓝图、references/domain/ 模板与规范、
src/、fixtures/ 示例文档）均为作者原创。样式与布局模板的早期版本
曾参考 PaperBanana（arXiv:2601.23265v1）的设计思路，但经重写已不包含其原文。