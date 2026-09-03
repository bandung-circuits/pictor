// dsh-pictor — Client half (browser)。由 scripts/build.mjs 生成，请修改 src/client/index.js。
window.__ModuleLoader__.load({
  id: "dsh-pictor",
  factory: (require) => {
// dsh-pictor — Client half (browser)。
//
// 由 scripts/build.mjs 包装进 window.__ModuleLoader__.load({ id, factory })，
// factory 的参数 require 提供 react；文件末尾 return { inject, apply }。
// 界面（docs/DESIGN.zh.md v1）：
// - 唯一入口：dsh 左下角 footer 按钮「Pictor」开关 shell.overlay 有界面板，
//   形态照 pomasa-studio（有界面板、左部透空保持 dsh 侧栏可用、右侧为工作台）；
// - 工作台分栏：左栏项目导航 + 右栏项目详情（信息条、阶段条、步骤内容、讨论、日志）；
// - 项目 = 一份文档转一组信息图，步骤固定三步：提取、方案、渲染；每步有人工门控；
// - GUI 只做两件事：查看信息（文件事实投影）、规整输入（上传/粘贴/结构化指令）。
//   行为全部经 RPC（/pictor）交给宿主与项目会话。
const React = require('react')
const h = React.createElement

const inject = ['slots', 'connection', 'workspaces', 'sessions']
const RPC = '/pictor'

const STYLE = `
.pt-root { font-size: 16px; line-height: 1.6; color: var(--dsw-alias-label-primary, #1a1a1a); height: 100%; }
.pt-root * { box-sizing: border-box; }
.pt-root button { font: inherit; }
.pt-root input, .pt-root textarea, .pt-root select, .pt-root [contenteditable] { font: inherit; }

/* ---- footer 启动按钮 ---- */
.pt-footer-action { cursor: pointer; padding: 7px 12px; font-size: 14px; font-weight: 600;
  color: var(--dsw-alias-label-primary); display: inline-flex; align-items: center; justify-content: center;
  gap: 7px; transition: background 150ms, color 150ms, border-color 150ms; border-radius: 8px;
  margin: 2px 8px; white-space: nowrap; background: var(--dsw-alias-button-floating-fill);
  border: 1px solid var(--dsw-alias-border-l2); }
.pt-footer-action:hover { background: var(--dsw-alias-button-floating-hover); }
.pt-footer-action .glyph { color: var(--dsw-alias-state-business-primary); font-size: 12px; line-height: 1; opacity: 0.8; }
.pt-footer-action.on { background: var(--dsw-alias-state-business-primary); border-color: transparent;
  color: var(--dsw-alias-brand-primary-invert, #fff); }
.pt-footer-action.on .glyph { color: inherit; opacity: 1; }
.pt-footer-action.on:hover { background: var(--dsw-alias-button-info-hover, var(--dsw-alias-state-business-primary));
  filter: brightness(1.05); }

/* ---- shell overlay：有界面板（点击穿透底 + 左部空位 + 右侧交互区） ---- */
.pt-shell-root { position: absolute; inset: 0; z-index: 20; display: flex; align-items: stretch;
  pointer-events: none; }
.pt-shell-nav { flex: none; }
.pt-shell-panel { flex: 1; min-width: 0; height: 100%; pointer-events: auto; display: flex;
  flex-direction: column; background: var(--dsw-alias-bg-base, #f7f7f5); border-left: 1px solid
  var(--dsw-alias-border-l2, rgba(128,128,128,.18)); }

/* ---- 工作台分栏 ---- */
.pt-workbench { display: flex; flex: 1; min-height: 0; }
.pt-nav { width: 264px; flex: none; border-right: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.16));
  background: var(--dsw-alias-bg-layer-1, #fbfbfa); display: flex; flex-direction: column; overflow-y: auto; }
.pt-nav-head { padding: 18px 16px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pt-nav-titles { flex: 1; min-width: 0; }
.pt-nav-title { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.pt-nav-sub { font-size: 13px; color: var(--dsw-alias-label-caption, #8a8a8a); margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pt-nav-new { border: 0; background: var(--dsw-alias-state-business-primary, #4f7cff); color: #fff;
  border-radius: 10px; padding: 7px 12px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; flex: none; }
.pt-nav-new:hover { filter: brightness(.95); }
.pt-nav-list { flex: 1; overflow-y: auto; padding: 4px 8px 12px; min-height: 0; }
.pt-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 9px 10px; border-radius: 10px; border: 0; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-nav-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.05)); }
.pt-nav-item.active { background: var(--dsw-alias-state-business-primary, #4f7cff); color: #fff; }
.pt-nav-item .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 550; }
.pt-nav-item .thumb { width: 30px; height: 30px; border-radius: 7px; object-fit: cover; flex: none;
  background: var(--dsw-alias-bg-layer-2, #eee); }
.pt-nav-item .thumb-empty { display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-caption, #b5b5b5); background: var(--dsw-alias-bg-layer-0, #f4f4f2); }
.pt-nav-item .meta { font-size: 11.5px; opacity: .75; }
.pt-nav-foot { border-top: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.12)); padding: 10px; }
    .pt-nav-settings { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 8px 10px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2, #d8d8d8);
  background: var(--dsw-alias-bg-layer-2, #fff); cursor: pointer; font-size: 14px; font-weight: 600;
  color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-nav-settings:hover { border-color: var(--dsw-alias-border-l1, #b0b0b0); filter: brightness(.98); }
    .pt-nav-settings .glyph { color: var(--dsw-alias-state-business-primary, #4f7cff); font-size: 16px; }
.pt-nav-settings:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.05)); }
.pt-lang { display: flex; align-items: center; gap: 8px; padding: 8px 10px 0; font-size: 13px;
  color: var(--dsw-alias-label-caption, #888); }
.pt-lang-opts { display: inline-flex; border: 1px solid var(--dsw-alias-border-l2, #d8d8d8);
  border-radius: 999px; overflow: hidden; }
.pt-lang-opt { border: 0; background: transparent; padding: 2px 10px; font-size: 12.5px; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #777); }
.pt-lang-opt.on { background: var(--dsw-alias-state-business-primary, #4f7cff); color: #fff; font-weight: 600; }

/* ---- 主区 ---- */
.pt-main { flex: 1; min-width: 0; overflow-y: auto; padding: 22px 28px 40px; }
.pt-wrap { max-width: 880px; margin: 0 auto; }
.pt-title { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 4px; }
.pt-subtitle { margin: 0 0 24px; font-size: 15px; color: var(--dsw-alias-label-secondary, #666); }
.pt-btn { border: 1px solid var(--dsw-alias-border-l2, #d8d8d8); background: var(--dsw-alias-bg-layer-2, #fff);
  color: var(--dsw-alias-label-primary, #1a1a1a); border-radius: 12px; padding: 9px 18px; font-size: 15px;
  font-weight: 550; cursor: pointer; transition: filter 150ms, background 150ms; white-space: nowrap; }
.pt-btn:hover { filter: brightness(0.96); }
.pt-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pt-btn-primary { background: var(--dsw-alias-accent, #4f7cff); border-color: var(--dsw-alias-accent, #4f7cff); color: #fff; }
.pt-btn-ghost { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary, #666); }
.pt-card { background: var(--dsw-alias-bg-layer-1, #fff); border: 1px solid var(--dsw-alias-border-l2, #e2e2e2);
  border-radius: 16px; padding: 18px 20px; }
.pt-card-row { display: flex; align-items: center; gap: 14px; justify-content: space-between; }
.pt-section { margin-top: 26px; }
.pt-section-title { font-size: 19px; font-weight: 650; margin: 0 0 12px; letter-spacing: -0.01em; }
.pt-meta { font-size: 13px; color: var(--dsw-alias-label-caption, #888); }
.pt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; margin-top: 14px; }
.pt-option { display: flex; gap: 12px; align-items: flex-start; padding: 16px 18px; cursor: pointer; }
.pt-option:hover { border-color: var(--dsw-alias-border-l1, #b8b8b8); }
.pt-check { width: 17px; height: 17px; margin-top: 3px; accent-color: var(--dsw-alias-accent, #4f7cff); flex: none; }
.pt-option-title { font-size: 15.5px; font-weight: 650; margin: 0 0 4px; }
.pt-option-desc { font-size: 14px; color: var(--dsw-alias-label-secondary, #666); margin: 0; line-height: 1.55; }
.pt-tag { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 10px; font-size: 12px;
  font-weight: 600; color: var(--dsw-alias-label-secondary, #666); background: var(--dsw-alias-bg-layer-0, #f4f4f4);
  border: 1px solid var(--dsw-alias-border-l2, #e2e2e2); margin-right: 6px; }
.pt-badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 3px 11px;
  font-size: 12.5px; font-weight: 600; line-height: 1.4; border: 1px solid var(--dsw-alias-border-l2, #ddd); }
.pt-badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .85; }
.pt-badge-running { color: #b45309; }
.pt-badge-gated { color: #2563eb; }
.pt-badge-done { color: #15803d; }
.pt-badge-idle { color: var(--dsw-alias-label-secondary, #777); }
.pt-input { width: 100%; border: 1px solid var(--dsw-alias-border-l2, #d8d8d8); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2, #fff); color: var(--dsw-alias-label-primary, #1a1a1a);
  padding: 10px 14px; font-size: 15px; outline: none; }
.pt-input:focus, .pt-rich:focus { border-color: var(--dsw-alias-accent, #4f7cff); }
.pt-textarea { min-height: 90px; resize: vertical; }
.pt-rich { min-height: 180px; max-height: 320px; overflow-y: auto; padding: 12px 14px; }
.pt-rich:empty::before { content: attr(data-placeholder); color: var(--dsw-alias-label-caption, #999); }
.pt-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }

.pt-credits { text-align: center; font-size: 12.5px; color: var(--dsw-alias-label-caption, #999); margin-top: 12px; }
.pt-credits a { color: var(--dsw-alias-label-secondary, #777); text-decoration: none; }
.pt-credits a:hover { text-decoration: underline; }
.pt-empty { border: 1.5px dashed var(--dsw-alias-border-l2, #d5d5d5); border-radius: 16px; padding: 48px 28px;
  text-align: center; color: var(--dsw-alias-label-secondary, #777); }
.pt-empty-fig { width: 200px; height: 200px; margin: 0 auto 18px; overflow: hidden;
  -webkit-mask-image: radial-gradient(ellipse closest-side, #000 52%, transparent 76%);
  mask-image: radial-gradient(ellipse closest-side, #000 52%, transparent 76%); }
.pt-empty-img { width: 280px; height: 280px; display: block; object-fit: cover;
  transform: translate(-40px, -20px); user-select: none; pointer-events: none; }
.pt-empty-title { font-size: 16px; font-weight: 650; color: var(--dsw-alias-label-primary, #1a1a1a); margin: 0 0 6px; }
.pt-empty-hint { font-size: 14px; margin: 0; }
.pt-file { display: flex; align-items: center; justify-content: center; border: 1.5px dashed
  var(--dsw-alias-border-l1, #b8b8b8); border-radius: 14px; padding: 22px 16px; cursor: pointer; text-align: center;
  transition: border-color 150ms; }
.pt-file:hover { border-color: var(--dsw-alias-accent, #4f7cff); }
.pt-file-name { font-weight: 550; margin: 6px 0 0; }
.pt-error { font-size: 13.5px; color: #b91c1c; background: #fee2e2; border: 1px solid #fecaca; border-radius: 12px;
  padding: 9px 13px; margin: 12px 0 0; }
.pt-warn { font-size: 13.5px; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px;
  padding: 9px 13px; margin: 12px 0 0; }
.pt-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.55;
  white-space: pre-wrap; word-break: break-word; background: var(--dsw-alias-bg-layer-0, #f4f4f4);
  border: 1px solid var(--dsw-alias-border-l2, #e2e2e2); border-radius: 12px; padding: 12px 14px; margin: 10px 0 0; }
.pt-detail { font-size: 13.5px; color: var(--dsw-alias-label-secondary, #777); }
.pt-prompts { margin-top: 10px; }

/* ---- 阶段条 ---- */
.pt-stages { display: flex; gap: 8px; margin: 16px 0 4px; }
.pt-stage { flex: 1; border: 1px solid var(--dsw-alias-border-l2, #d8d8d8); background: var(--dsw-alias-bg-layer-2, #fff);
  border-radius: 12px; padding: 10px 12px; cursor: pointer; font-size: 13.5px; font-weight: 600; text-align: left;
  color: var(--dsw-alias-label-secondary, #666); transition: border-color 150ms; }
.pt-stage:hover { border-color: var(--dsw-alias-border-l1, #aaa); }
.pt-stage.active { border-color: var(--dsw-alias-accent, #4f7cff); color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-stage .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px;
  background: var(--dsw-alias-border-l2, #ccc); }
.pt-stage.gated .dot { background: #2563eb; }
.pt-stage.done .dot { background: #15803d; }
.pt-stage.running .dot { background: #b45309; }
.pt-stage .cnt { float: right; font-size: 11.5px; opacity: .7; font-weight: 500; }

/* ---- 信息条 ---- */
.pt-infobar { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.pt-infobar h1 { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.pt-rename-input { font-size: 20px; font-weight: 700; padding: 4px 10px; border-radius: 10px; }

/* ---- 折叠面板（讨论 / 日志） ---- */
.pt-fold { margin-top: 22px; border-top: 1px solid var(--dsw-alias-border-l2, #e2e2e2); padding-top: 14px; }
.pt-fold-head { display: flex; align-items: center; justify-content: space-between; width: 100%;
  border: 0; background: transparent; cursor: pointer; padding: 0; font-size: 15.5px; font-weight: 650;
  color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-fold-head .chev { opacity: .6; font-size: 12px; }
.pt-fold-body { margin-top: 12px; }

/* ---- 图片网格 ---- */
.pt-img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 14px; }
.pt-batch { }
.pt-batch-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer;
  margin: 18px 0 8px; }
.pt-batch-title { font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-batch-head .chev { opacity: .6; font-size: 12px; }
.pt-batch:first-of-type .pt-batch-head { margin-top: 4px; }
.pt-img-card { margin: 0; padding: 10px; background: var(--dsw-alias-bg-layer-1, #fff);
  border: 1px solid var(--dsw-alias-border-l2, #e2e2e2); border-radius: 14px; position: relative; }
.pt-img { width: 100%; height: auto; border-radius: 9px; display: block; }
.pt-img-card figcaption { margin-top: 8px; display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; color: var(--dsw-alias-label-secondary, #666); }
.pt-dl { color: var(--dsw-alias-accent, #4f7cff); text-decoration: none; font-weight: 600; font-size: 12.5px; }
.pt-img-card figcaption { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.pt-fig-title { font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary, #1a1a1a); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pt-fig-row { display: flex; justify-content: flex-end; }
.pt-tabbar { display: flex; gap: 8px; margin-bottom: 14px; }
.pt-tab { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, #d8d8d8);
  background: transparent; cursor: pointer; font-size: 14px; font-weight: 550; color: var(--dsw-alias-label-secondary, #666); }
.pt-tab.active { background: var(--dsw-alias-bg-layer-2, #fff); color: var(--dsw-alias-label-primary, #1a1a1a);
  border-color: var(--dsw-alias-accent, #4f7cff); }
.pt-field { margin-bottom: 14px; }
.pt-field-label { display: block; font-size: 13.5px; font-weight: 550; color: var(--dsw-alias-label-secondary, #666);
  margin-bottom: 6px; }
.pt-modal-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.38);
  display: flex; align-items: center; justify-content: center; padding: 24px; }
.pt-modal { background: var(--dsw-alias-bg-layer-1, #fff); border: 1px solid var(--dsw-alias-border-l2, #ddd);
  border-radius: 16px; width: min(600px, 100%); max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 18px 50px rgba(0,0,0,.22); }
.pt-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 18px 20px 14px; border-bottom: 1px solid var(--dsw-alias-border-l2, #ececec); }
.pt-modal-body { overflow-y: auto; padding: 14px 20px 20px; }
.pt-modal-wide { width: min(760px, 100%); }
.pt-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px;
  max-height: 56vh; overflow-y: auto; }
.pt-preview-item { border: 1px solid var(--dsw-alias-border-l2, #ddd); border-radius: 10px; overflow: hidden;
  cursor: pointer; transition: border-color 120ms; position: relative; background: var(--dsw-alias-bg-layer-1, #fff); }
.pt-preview-item:hover { border-color: var(--dsw-alias-border-l1, #aaa); }
.pt-preview-item.sel { border-color: var(--dsw-alias-state-business-primary, #4f7cff);
  box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary, #4f7cff); }
.pt-preview-item img { width: 100%; height: 88px; object-fit: cover; display: block;
  background: var(--dsw-alias-bg-layer-0, #f4f4f2); }
.pt-preview-item .nm { font-size: 12px; font-weight: 600; padding: 5px 8px; color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-preview-item .ai-chip { position: absolute; top: 4px; right: 4px; font-size: 10px; font-weight: 700;
  background: var(--dsw-alias-state-business-primary, #4f7cff); color: #fff; border-radius: 999px; padding: 1px 6px; }
.pt-layout-changed { color: #b45309; }

.pt-modal-close { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--dsw-alias-border-l2, #ddd);
  background: transparent; color: var(--dsw-alias-label-secondary, #777); font-size: 16px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: none;
  transition: background 150ms, color 150ms, transform 150ms; }
.pt-modal-close:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.05));
  color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-modal-close:active { transform: scale(.94); }

.pt-detail-h { font-size: 13px; font-weight: 650; margin: 0 0 6px; color: var(--dsw-alias-label-primary, #1a1a1a); }
.pt-list { margin: 0 0 12px; padding-left: 20px; font-size: 14px; line-height: 1.6; color: var(--dsw-alias-label-secondary, #555); }
.pt-quote { margin: 0 0 12px; padding: 10px 14px; border-left: 3px solid var(--dsw-alias-brand-primary, #4f7cff);
  background: var(--dsw-alias-bg-layer-0, #f4f4f2); border-radius: 0 10px 10px 0; font-size: 13.5px; line-height: 1.65;
  color: var(--dsw-alias-label-secondary, #555); }
.pt-log { font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-caption, #777); max-height: 260px;
  overflow-y: auto; background: var(--dsw-alias-bg-layer-0, #f4f4f4); border-radius: 12px; padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
`

// ---------- 国际化（pomasa 同款机制：字典 + store + t() + LangSwitch） ----------
const I18N = {
  zh: {
    open: '打开 Pictor', close: '收起 Pictor',
    tagline: '文档转信息图', newProject: '新建项目', newShort: '新建', noProjects: '暂无项目',
    navSettings: '设置画图模型',
    settingsTitle: '设置', settingsSubtitle: '两个模型：推理走 dsh 默认模型（extract/advise 随之）；这里是画图模型。',
    fieldProvider: '生图 provider', fieldModel: '模型名', fieldAspect: '画面比例', fieldKey: 'API 密钥',
    fieldExtra: '额外请求参数（JSON，可选）', extraHint: '例如：{\"parameters\":{\"prompt_extend\":true}}；会深合并进请求体。',
    keySet: '（已配置）', keyPlaceholderSet: '已配置，留空不变', keyPlaceholder: '经 dsh 凭据子系统保存',
    keyStorageFile: '当前 profile 未装凭据服务，密钥将以明文保存在 ~/.pictor/pictor-config.json。',
    back: '返回', saveTest: '保存并测试', saving: '保存中…', savedTest: '已保存，测试 ',
    fieldBaseUrl: '接口地址', testOk: '通过',
    sPrepared: '未就位', sRunning: '执行中', sStruct: '待选结构', sAdvice: '待选方案', sDone: '已出图',
    stepMeta: '确认信息', sMeta: '待确认信息',
    metaTitle: '文档标题', metaSummary: '文档摘要', projectTitle: '项目标题',
    confirmMeta: '确认信息并开始提取', metaRunning: '正在提炼文档信息…',
    metaRunningHint: '会话正在读取文档并提炼标题与摘要，稍候可在上方确认。',
    waitMeta: '等待信息确认', waitMetaHint: '请先完成「确认信息」步骤。',
    deadHint: '会话当前未在运行：可在讨论面板发一句话让它继续。',stepExtract: '提取结构', stepAdvise: '方案设计', stepRender: '渲染出图',
    newTitle: '新建项目', newSubtitle: '一份文档转成一组信息图。项目名取文档首行，随时可改。',
    tabUpload: '上传文件', tabPaste: '粘贴内容',
    pickFile: '点击选择本地文件', fileHint: '支持 md / txt / docx / pdf / 图片。文件原样进入项目目录，读取与转换交给会话。',
    richHint: '从 Word 或网页粘贴，格式将保留；落盘为消毒后的 HTML，再由会话规整成 Markdown。',
    richPlaceholder: '从 Word 或网页粘贴内容（格式将保留）…',
    createProject: '创建项目', creating: '创建中…',
    rename: '改名', del: '删除', metaTime: '创建于 {c} · 更新于 {u}',
    delConfirm: '删除项目「{t}」？其目录与全部产物将一并移除。',
    confirmStructures: '确认所选，进入方案设计',
    viewPrompt: '查看完整 prompt', hidePrompt: '收起完整 prompt',
    renderSelected: '渲染所选方案', rendering: '渲染中…', renderFailed: '失败', download: '下载',
    batchTitle: '渲染于 {t}', batchN: '{n} 张', batchLegacy: '已渲图',
    emptyProjects: '还没有项目',
    creditsPre: '受 ', creditsPost: ' 开源项目启发，致谢 宝玉。',
    emptyProjectsHint: '把一份文档变成一组信息图：点左上「新建项目」，上传文件或粘贴内容，会话会完成提取、方案与出图。',
    emptyExtract: '正在提取结构…', emptyExtractWait: '等待结构提取',
    emptyExtractHint: '会话正在分析文档并提取结构，自动推进；完成后这里会列出候选结构供你选择。',
    pendingExtract: '结构提取中', pendingExtractHint: '方案在结构提取完成并确认后生成，请先完成提取。',
    waitConfirmStructures: '等待结构确认', waitConfirmStructuresHint: '结构已提取，请回到提取步骤勾选并确认。',
    emptyAdviceRunning: '正在生成方案…',
    emptyAdvice: '等待方案', emptyAdviceHint: '方案生成完成后即可选择并渲染。',
    emptyRender: '尚未出图', emptyRenderHint: '在方案步骤勾选方案并渲染，这里会展示生成的信息图。',
    log: '会话日志', logEmpty: '暂无日志（dsh 会话或已结束）。',
    viewSource: '回看输入文档', hideSource: '收起原文',
    structFallback: '结构', details: '详情', collapse: '收起',
    descriptionLabel: '描述', keyElementsLabel: '关键要素', relationshipsLabel: '关系',
    excerptLabel: '原文摘录', locationLabel: '出处', complexityLabel: '复杂度',
    potentialLabel: '可视化价值', addElement: '+ 添加要素', emptyExtractWaitHint: '结构提取尚未开始。',
    imgKeyHint: '生图模型未配置：请先到「设置：画图模型」配置后再渲染。', sourceLabel: '来源',
    edit: '编辑', save: '保存', cancel: '取消', editStruct: '编辑结构', fieldTitle: '标题', fieldSummary: '概要',
    select: '选择', selectAll: '全选', deselectAll: '取消全选', selectCount: '已选 {s} / {t}',
    layoutLabel: '布局', styleLabel: '风格', metaConfirmedHint: '确认后作为项目名与提取依据，可编辑。',
    chooseLayout: '选择布局', chooseStyle: '选择风格', resetToAi: '回到 AI 推荐',
    layoutChanged: '·已改', aiSuggestion: 'AI 推荐',
    batchStyleLabel: '批量设置风格', batchStyleHint: '为所选方案套用同一风格（未选则全部）',
    close: '关闭',
    discussion: '讨论', discussHint: '对项目会话自由说话：补充参考、要求搜索、调整方向。你的决定会在同一会话里接着执行。',
    discussPlaceholder: '例如：先不要继续，帮我查一下这篇文章提到的背景…',
    send: '发送', langLabel: '语言', loading: '加载中…',
  },
  en: {
    open: 'Open Pictor', close: 'Collapse Pictor',
    tagline: 'Document to infographics', newProject: 'New project', newShort: 'New', noProjects: 'No projects yet',
    navSettings: 'Settings image model',
    settingsTitle: 'Settings', settingsSubtitle: 'Two models: reasoning uses the DSH default model (extract/advise); image model is configured here.',
    fieldProvider: 'Image provider', fieldModel: 'Model name', fieldAspect: 'Aspect ratio', fieldKey: 'API key',
    fieldExtra: 'Extra request params (JSON, optional)', extraHint: 'e.g. {\"parameters\":{\"prompt_extend\":true}}; deep-merged into the request body.',
    keySet: '（set）', keyPlaceholderSet: 'Set — leave blank to keep', keyPlaceholder: 'Stored via the dsh credentials subsystem',
    keyStorageFile: 'This profile has no credentials service; the key will be stored in plain text in ~/.pictor/pictor-config.json.',
    back: 'Back', saveTest: 'Save & test', saving: 'Saving…', savedTest: 'Saved; test ',
    fieldBaseUrl: 'Base URL', testOk: 'ok',
    sPrepared: 'Preparing', sRunning: 'Running', sStruct: 'Pick structures', sAdvice: 'Pick proposals', sDone: 'Rendered',
    stepMeta: 'Confirm info', sMeta: 'Info waiting',
    metaTitle: 'Document title', metaSummary: 'Document summary', projectTitle: 'Project title',
    confirmMeta: 'Confirm and start extraction', metaRunning: 'Extracting document info…',
    metaRunningHint: 'The session is reading the document and deriving a title and summary; confirm them here.',
    waitMeta: 'Awaiting info confirmation', waitMetaHint: 'Finish the Confirm info step first.',
    deadHint: 'The session is not running: send a message in Discussion to continue.',stepExtract: 'Extract', stepAdvise: 'Advise', stepRender: 'Render',
    newTitle: 'New project', newSubtitle: 'One document becomes a set of infographics. The project name comes from the first line; rename anytime.',
    tabUpload: 'Upload', tabPaste: 'Paste',
    pickFile: 'Choose a local file', fileHint: 'md / txt / docx / pdf / images. The file lands as-is in the project; reading & conversion is done by the session.',
    richHint: 'Paste from Word or the web; formatting is kept. Stored as sanitized HTML; the session normalizes it to Markdown.',
    richPlaceholder: 'Paste from Word or the web (formatting preserved)…',
    createProject: 'Create project', creating: 'Creating…',
    rename: 'Rename', del: 'Delete', metaTime: 'Created {c} · Updated {u}',
    delConfirm: 'Delete project «{t}»? Its directory and all outputs will be removed.',
    confirmStructures: 'Confirm selection, continue to advise',
    viewPrompt: 'View full prompt', hidePrompt: 'Hide prompt',
    renderSelected: 'Render selected', rendering: 'Rendering…', renderFailed: 'Failed', download: 'Download',
    batchTitle: 'Rendered at {t}', batchN: '{n} imgs', batchLegacy: 'Rendered',
    emptyProjects: 'No projects yet',
    creditsPre: 'Inspired by the open-source ', creditsPost: '. Thanks, 宝玉.',
    emptyProjectsHint: 'Turn a document into a set of infographics: New project → upload or paste, then the session extracts, advises and renders.',
    emptyExtract: 'Extracting structures…', emptyExtractWait: 'Awaiting extraction',
    emptyExtractHint: 'The session is analyzing the document and extracting structures automatically; candidates will appear here for you to pick.',
    pendingExtract: 'Extracting structures', pendingExtractHint: 'Proposals come after structures are extracted and confirmed — finish the Extract step first.',
    waitConfirmStructures: 'Awaiting structure confirmation', waitConfirmStructuresHint: 'Structures are ready — confirm them in the Extract step.',
    emptyAdviceRunning: 'Generating proposals…',
    emptyAdvice: 'Awaiting proposals', emptyAdviceHint: 'Pick a proposal and render it once ready.',
    emptyRender: 'Nothing rendered yet', emptyRenderHint: 'Pick proposals in the Advise step and render them here.',
    log: 'Session log', logEmpty: 'No log yet (session ended or never ran).',
    viewSource: 'View source', hideSource: 'Hide source',
    structFallback: 'Structure', details: 'Details', collapse: 'Collapse',
    descriptionLabel: 'Description', keyElementsLabel: 'Key elements', relationshipsLabel: 'Relationships',
    excerptLabel: 'Source excerpt', locationLabel: 'Location', complexityLabel: 'Complexity',
    potentialLabel: 'Value', addElement: '+ Add element', emptyExtractWaitHint: 'Extraction has not started.',
    imgKeyHint: 'Image model not configured — configure it in Settings → image model first.', sourceLabel: 'source',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', editStruct: 'Edit structure', fieldTitle: 'Title', fieldSummary: 'Summary',
    select: 'Select', selectAll: 'Select all', deselectAll: 'Deselect all', selectCount: '{s} / {t} selected',
    layoutLabel: 'Layout', styleLabel: 'Style', metaConfirmedHint: 'Confirmed as the project name and extraction basis; editable.',
    chooseLayout: 'Choose layout', chooseStyle: 'Choose style', resetToAi: 'Reset to AI',
    layoutChanged: '· edited', aiSuggestion: 'AI',
    batchStyleLabel: 'Batch style', batchStyleHint: 'Apply one style to all selected proposals (all if none selected)',
    close: 'Close',
    discussion: 'Discussion', discussHint: 'Talk to the project session: add context, ask for research, adjust direction. Your decisions continue it in the same session.',
    discussPlaceholder: 'e.g. Hold on — research the background this article mentions…',
    send: 'Send', langLabel: 'Language', loading: 'Loading…',
  },
}
let savedLang = 'zh'
try { savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('pictor-lang') : null } catch { /* 沙箱可能没有 storage */ }
const langStore = {
  val: savedLang === 'en' ? 'en' : 'zh',
  subs: new Set(),
  emit() { for (const f of this.subs) f() },
  set(v) { this.val = v === 'en' ? 'en' : 'zh'; try { localStorage.setItem('pictor-lang', this.val) } catch { /* ignore */ } this.emit() },
  subscribe(f) { this.subs.add(f); return () => { this.subs.delete(f) } },
}
function useLang() {
  const [v, setV] = React.useState(langStore.val)
  React.useEffect(() => langStore.subscribe(() => setV(langStore.val)), [])
  return v
}
function t(key, vars) {
  let text = (I18N[langStore.val] && I18N[langStore.val][key]) || I18N.zh[key] || key
  if (vars) { for (const k of Object.keys(vars)) text = text.replace('{' + k + '}', String(vars[k])) }
  return text
}
function LangSwitch() {
  const lang = useLang()
  const opt = (code, label) => h('button', {
    className: 'pt-lang-opt' + (lang === code ? ' on' : ''),
    onClick: () => langStore.set(code),
  }, label)
  return h('div', { className: 'pt-lang' },
    h('span', { className: 'pt-lang-label' }, t('langLabel')),
    h('div', { className: 'pt-lang-opts' }, opt('zh', '中文'), opt('en', 'English')))
}

// ---------- 工具 ----------

function rpc(ctx, endpoint, payload) {
  // 服务端 schema 要求 payload 字段必须存在（对象）；缺省补 {}，否则序列化丢键被拒。
  return ctx.connection.rpc.call(RPC, endpoint, payload === undefined ? {} : payload).then((result) => {
    if (result && result.ok === false) {
      const msg = result.error && result.error.message ? result.error.message : String(result.error || 'RPC 调用失败')
      throw new Error(msg)
    }
    return result && result.ok === true ? result.value : result
  })
}

/** 阶段 -> 左中右三步状态（pending/running/gated/done）。 */
function deriveSteps(stage, hasMeta) {
  const s = (state) => ({ state })
  switch (stage) {
    case 'prepared':
      return [s('running'), s('pending'), s('pending'), s('pending')]
    case 'running':
      return hasMeta
        ? [s('done'), s('running'), s('pending'), s('pending')]
        : [s('running'), s('pending'), s('pending'), s('pending')]
    case 'gated:meta':
      return [s('gated'), s('pending'), s('pending'), s('pending')]
    case 'gated:structure':
      return [s('done'), s('gated'), s('pending'), s('pending')]
    case 'gated:advice':
      return [s('done'), s('done'), s('gated'), s('pending')]
    case 'done':
      return [s('done'), s('done'), s('done'), s('done')]
    default:
      return [s('pending'), s('pending'), s('pending'), s('pending')]
  }
}

const STEP_KEYS = ['meta', 'extract', 'advise', 'render']
const STEP_T = { meta: 'stepMeta', extract: 'stepExtract', advise: 'stepAdvise', render: 'stepRender' }

function stageBadge(stage) {
  const map = {
    prepared: [t('sPrepared'), 'pct-badge-idle', 'pt-badge-idle'],
    running: [t('sRunning'), '', 'pt-badge-running'],
    'gated:meta': [t('sMeta'), '', 'pt-badge-gated'],
    'gated:structure': [t('sStruct'), '', 'pt-badge-gated'],
    'gated:advice': [t('sAdvice'), '', 'pt-badge-gated'],
    done: [t('sDone'), '', 'pt-badge-done'],
  }
  const [label, , cls] = map[stage] || [stage, '', 'pt-badge-idle']
  return h('span', { className: 'pt-badge ' + cls }, label)
}

// ---------- 粘贴消毒（客户端）：白名单子集，粘贴与落盘各过一次 ----------

const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI',
  'BLOCKQUOTE', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'CODE', 'PRE'])

function sanitizePaste(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  const walk = (node) => {
    Array.from(node.children || []).forEach((el) => {
      if (!ALLOWED_TAGS.has(el.tagName)) {
        // 黑名单外壳标签（script/style/...）直接丢弃；其余未知标签改为 span。
        el.replaceWith(...Array.from(el.childNodes).map((c) => {
          if (c.nodeType === Node.ELEMENT_NODE) { walk(c); return c }
          return document.createTextNode(c.nodeValue || '')
        }))
      } else {
        Array.from(el.attributes).forEach((attr) => {
          const ok = attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value)
            || attr.name === 'colspan' || attr.name === 'rowspan' || attr.name === 'start'
          if (!ok) el.removeAttribute(attr.name)
        })
        if (el.tagName === 'A' && !/^(https?:|mailto:)/i.test(el.getAttribute('href') || '')) {
          const txt = el.textContent || ''
          el.replaceWith(document.createTextNode(txt))
          return
        }
        walk(el)
      }
    })
  }
  walk(doc.body)
  return doc.body.innerHTML
}

// 会话创建与驱动走 dsh 的 workspace 流程（照 pomasa 的 driveSession）：
// 宿主只出 prompt，客户端经 workspaces.connectWorkspace 建会话（自然归入
// 「Pictor」工作区、继承 profile 默认模型），再经 sessions.prompt 驱动。
async function pictorWorkspace(ctx) {
  const ws = ctx.workspaces || (ctx.get && ctx.get('workspaces'))
  const base = await rpc(ctx, 'config.get').then((c) => (c && c.dataRoot) || '')
  if (!ws || typeof ws.connectWorkspace !== 'function') throw new Error('会话服务不可用（workspaces）')
  const items = () => {
    try {
      const snap = ws.list && typeof ws.list.getSnapshot === 'function' ? ws.list.getSnapshot() : null
      return snap && Array.isArray(snap.items) ? snap.items : []
    } catch { return [] }
  }
  const byPath = (list) => list.find((w) => w && String(w.path || w.cwd || '') === base) || null
  const ensureTitle = async (wid, row) => {
    if ((row && row.title) === 'Pictor' || !base) return
    if (typeof ws.rename === 'function') {
      try { await ws.rename(wid, 'Pictor') } catch { /* 标题纯外观 */ }
    }
  }
  const widOf = (row) => row && (row.workspaceId ?? row.id)

  // 1) 严格按 path 匹配（沙箱根 = 会话 cwd = 工作区 path，必须是 dataRoot）
  const list = items()
  const hit = byPath(list)
  if (hit) {
    const wid = widOf(hit)
    await ensureTitle(wid, hit)
    return wid
  }
  // 2) 自愈：存在标题 Pictor 但 path 不符的脏行（早期探针/旧数据）→ 删掉再建正确的
  const stale = list.find((w) => w && (w.title || '') === 'Pictor') || null
  if (stale && typeof ws.delete === 'function') {
    try { await ws.delete(widOf(stale)) } catch { /* 尽力 */ }
  }
  if (!base) throw new Error('无法创建 Pictor 工作区（dataRoot 未知）')
  const created = await ws.create({ path: base })
  const row = (created && created.workspaceId) ? created : byPath(items()) || null
  if (!row) throw new Error('无法创建 Pictor 工作区')
  const wid = widOf(row)
  await ensureTitle(wid, row)
  return wid
}

async function driveProjectSession(ctx, prompt) {
  const ws = ctx.workspaces || (ctx.get && ctx.get('workspaces'))
  const sessionsSvc = ctx.sessions || (ctx.get && ctx.get('sessions'))
  const wid = await pictorWorkspace(ctx)
  let sessionId
  try { sessionId = await ws.connectWorkspace(wid) }
  catch (e) { throw new Error('创建会话失败：' + String((e && e.message) || e)) }
  const bound = sessionsSvc && typeof sessionsSvc.binding === 'function' ? sessionsSvc.binding(sessionId) : null
  const sess = bound && bound.session
  if (!sess || typeof sess.prompt !== 'function') throw new Error('会话无 prompt 通道')
  await sess.prompt([{ type: 'text', text: String(prompt || '') }], 'queue')
  return sessionId
}

/** 驱动：优先续用已记录的会话（同一项目保持连贯上下文，后面阶段可读前面
 *  全文/结构），续用失败（dsh 重启等）再经 workspace 流程新建并回填。 */
async function drivePrompt(ctx, id, message) {
  const p = await rpc(ctx, 'project.prompt', { id, message })
  if (p && p.sessionId) {
    const sessionsSvc = ctx.sessions || (ctx.get && ctx.get('sessions'))
    if (sessionsSvc && typeof sessionsSvc.binding === 'function') {
      try {
        const bound = sessionsSvc.binding(p.sessionId)
        const sess = bound && bound.session
        if (sess && typeof sess.prompt === 'function') {
          await sess.prompt([{ type: 'text', text: String(message || '') }], 'queue')
          await rpc(ctx, 'project.attach', { id, sessionId: p.sessionId })
          return p.sessionId
        }
      } catch { /* 会话对象失效则回落到新建 */ }
    }
  }
  const sessionId = await driveProjectSession(ctx, p && p.prompt)
  await rpc(ctx, 'project.attach', { id, sessionId })
  return sessionId
}

// ---------- 组件 ----------

function EmptyState(props) {
  return h('div', { className: 'pt-empty' },
    h('div', { className: 'pt-empty-fig' },
      h('img', { className: 'pt-empty-img', src: '/pictor/asset/empty-state.png', alt: '' })),
    h('p', { className: 'pt-empty-title' }, props.title),
    h('p', { className: 'pt-empty-hint' }, props.hint || ''))
}

function StageStrip({ steps, active, onPick }) {
  return h('div', { className: 'pt-stages' },
    steps.map((step, i) => {
      const key = STEP_KEYS[i]
      const cls = 'pt-stage ' + step.state + (active === key ? ' active' : '')
      return h('button', { key, className: cls, onClick: () => onPick(key) },
        h('span', { className: 'dot' }),
        t(STEP_T[key]), step.count ? h('span', { className: 'cnt' }, step.count) : null)
    }))
}

/** 单行文本转 HTML 的最小渲染器（React 元素输出，杜绝 innerHTML）。 */
function MiniMarkdown({ text }) {
  const lines = String(text || '').split('\n')
  return h('div', null,
    lines.map((line, i) => {
      if (/^#{1,3}\s/.test(line)) {
        const level = line.match(/^#+/)[0].length
        return h('div', { key: i, style: { fontWeight: 650, marginTop: 8 } }, line.replace(/^#+\s*/, ''))
      }
      if (!line.trim()) return null
      return h('p', { key: i, style: { margin: '4px 0' } }, line)
    }))
}

// 结构类型/复杂度/可视化价值标签（枚举自 agents/11.extractor.md）
const STRUCT_TYPE_LABELS = {
  zh: { network: '关系网络', hierarchy: '层次结构', 'concept-decomposition': '概念拆解', stakeholder: '利益相关方',
    argument: '论证结构', debate: '正反对立', 'semantic-opposition': '语义对立', cycle: '循环过程', flow: '流量分配',
    timeline: '时间序列', 'parallel-evolution': '并行演变', 'multi-dimensional': '多维评估', 'two-dimensional': '二维定位',
    landscape: '领域全景', geographic: '地理分布' },
  en: { network: 'Network', hierarchy: 'Hierarchy', 'concept-decomposition': 'Concept Decomposition', stakeholder: 'Stakeholder',
    argument: 'Argument', debate: 'Debate', 'semantic-opposition': 'Semantic Opposition', cycle: 'Cycle', flow: 'Flow',
    timeline: 'Timeline', 'parallel-evolution': 'Parallel Evolution', 'multi-dimensional': 'Multi-dimensional',
    'two-dimensional': 'Two-dimensional', landscape: 'Landscape', geographic: 'Geographic' },
}
const STRUCT_LEVEL_LABELS = { zh: { low: '低', medium: '中', high: '高' }, en: { low: 'Low', medium: 'Medium', high: 'High' } }
function structTypeLabel(v) { return (STRUCT_TYPE_LABELS[langStore.val] || {})[v] || v }
function structLevelLabel(v) { return (STRUCT_LEVEL_LABELS[langStore.val] || {})[v] || v }

function StructuresPanel({ stage, structures, onToggle, selected, onToggleAll, disabled, onConfirm, document, seedKey, onSaveStructures, steps, running }) {
  const gated = stage === 'gated:structure'
  const [showSource, setShowSource] = React.useState(false)
  const [detailId, setDetailId] = React.useState(null)
  const [items, setItems] = React.useState(null)
  const [editId, setEditId] = React.useState(null)
  const [draft, setDraft] = React.useState({ title: '', description: '', keyElements: [], sourceExcerpt: '' })
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => { setItems(structures) }, [seedKey])
  const list = items !== null ? items : structures
  const allSelected = list.length > 0 && selected.length === list.length
  const titleOf = (s, i) => s.title || s.description || t('structFallback') + ' ' + String(i + 1)

  function startEdit(s) {
    setEditId(s.id)
    setDraft({
      title: s.title || '',
      description: s.description || '',
      keyElements: Array.isArray(s.key_elements) ? s.key_elements.slice() : [],
      sourceExcerpt: s.source_excerpt || '',
    })
  }
  function setEl(i, v) { setDraft(function (d) { return { ...d, keyElements: d.keyElements.map((x, j) => (j === i ? v : x)) } }) }
  function addEl() { setDraft(function (d) { return { ...d, keyElements: d.keyElements.concat('') } }) }
  function rmEl(i) { setDraft(function (d) { return { ...d, keyElements: d.keyElements.filter(function (_, j) { return j !== i }) } }) }
  async function saveEdit() {
    setSaving(true)
    try {
      const updated = list.map(function (s) {
        if (s.id === editId) {
          return { ...s, title: draft.title, description: draft.description, key_elements: draft.keyElements, source_excerpt: draft.sourceExcerpt }
        }
        return s
      })
      await onSaveStructures(updated)
      setEditId(null)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  if (!list.length) {
    const metaState = steps ? steps[0].state : 'done'
    const extractState = steps ? steps[1].state : 'pending'
    if (metaState !== 'done') {
      const runningMeta = metaState === 'running'
      return h(EmptyState, { title: runningMeta ? t('metaRunning') : t('waitMeta'), hint: runningMeta ? t('metaRunningHint') : t('waitMetaHint') })
    }
    if (extractState === 'running') {
      return h(EmptyState, { title: t('emptyExtract'), hint: running === false ? t('deadHint') : t('emptyExtractHint') })
    }
    return h(EmptyState, { title: t('emptyExtractWait'), hint: t('emptyExtractWaitHint') })
  }

  // 详情内容片段（弹窗内复用，也是原本地展开的内容）
  function detailFrag(s) {
    return [
      Array.isArray(s.key_elements) && s.key_elements.length ? h('div', { key: 'k', style: { marginBottom: 12 } }, h('h4', { className: 'pt-detail-h' }, t('keyElementsLabel')), h('ol', { className: 'pt-list' }, s.key_elements.map((el, j) => h('li', { key: j }, el)))) : null,
      Array.isArray(s.relationships) && s.relationships.length ? h('div', { key: 'r', style: { marginBottom: 12 } }, h('h4', { className: 'pt-detail-h' }, t('relationshipsLabel')), h('ul', { className: 'pt-list' }, s.relationships.map((rl, j) => h('li', { key: j }, rl)))) : null,
      s.source_excerpt ? h('div', { key: 'e', style: { marginBottom: 12 } }, h('h4', { className: 'pt-detail-h' }, t('excerptLabel')), h('blockquote', { className: 'pt-quote' }, s.source_excerpt)) : null,
      s.source_location ? h('p', { key: 'l' }, t('locationLabel') + ': ' + s.source_location) : null,
      s.notes ? h('p', { key: 'n', className: 'pt-detail', style: { marginTop: 8 } }, s.notes) : null,
    ]
  }

  const cards = list.map((s, i) => {
    const idx = i
    if (editId === s.id) {
      return h('div', { key: s.id, className: 'pt-card' },
        h('h3', { className: 'pt-option-title', style: { margin: 0 } }, t('editStruct')),
        h('div', { className: 'pt-field', style: { marginTop: 10 } }, h('label', { className: 'pt-field-label' }, t('fieldTitle')), h('input', { className: 'pt-input', value: draft.title, onChange: (e) => setDraft(function (d) { return { ...d, title: e.target.value } }) })),
        h('div', { className: 'pt-field', style: { marginTop: 10 } }, h('label', { className: 'pt-field-label' }, t('descriptionLabel')), h('textarea', { className: 'pt-input', style: { minHeight: 56 }, value: draft.description, onChange: (e) => setDraft(function (d) { return { ...d, description: e.target.value } }) })),
        h('div', { className: 'pt-field', style: { marginTop: 10 } },
          h('label', { className: 'pt-field-label' }, t('keyElementsLabel')),
          draft.keyElements.map((el, j) => h('div', { key: j, style: { display: 'flex', gap: 6, marginBottom: 6 } }, h('input', { className: 'pt-input', value: el, onChange: (e) => setEl(j, e.target.value) }), h('button', { className: 'pt-btn pt-btn-ghost', onClick: () => rmEl(j) }, '×'))),
          h('button', { className: 'pt-btn pt-btn-ghost', style: { padding: '4px 8px', fontSize: 13 }, onClick: addEl }, t('addElement'))),
        h('div', { className: 'pt-field', style: { marginTop: 10 } }, h('label', { className: 'pt-field-label' }, t('excerptLabel')), h('textarea', { className: 'pt-input', style: { minHeight: 72 }, value: draft.sourceExcerpt, onChange: (e) => setDraft(function (d) { return { ...d, sourceExcerpt: e.target.value } }) })),
        h('div', { className: 'pt-actions', style: { marginTop: 12, justifyContent: 'flex-start' } },
          h('button', { className: 'pt-btn pt-btn-primary', disabled: saving, onClick: saveEdit }, saving ? t('saving') : t('save')),
          h('button', { className: 'pt-btn', onClick: () => setEditId(null) }, t('cancel'))))
    }
    const badges = h('div', { style: { marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' } },
      h('span', { className: 'pt-tag' }, structTypeLabel(s.type)),
      s.complexity ? h('span', { className: 'pt-tag' }, t('complexityLabel') + ' ' + structLevelLabel(s.complexity)) : null,
      s.visualization_potential ? h('span', { className: 'pt-tag' }, t('potentialLabel') + ' ' + structLevelLabel(s.visualization_potential)) : null)
    const footer = h('div', { className: 'pt-card-row', style: { marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--dsw-alias-border-l2, #ececec)' } },
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        h('input', { className: 'pt-check', type: 'checkbox', checked: selected.includes(s.id), onChange: () => onToggle(s.id), disabled: !gated }),
        h('span', { className: 'pt-meta' }, t('select'))),
      h('div', { style: { display: 'flex', gap: 6 } },
        h('button', { className: 'pt-btn pt-btn-ghost', style: { padding: '4px 8px', fontSize: 12.5 }, onClick: () => startEdit(s) }, t('edit')),
        h('button', { className: 'pt-btn pt-btn-ghost', style: { padding: '4px 8px', fontSize: 12.5 }, onClick: () => setDetailId(s.id) }, t('details'))))
    return h('div', { key: s.id, className: 'pt-card' },
      h('div', { className: 'pt-card-row' },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('h3', { className: 'pt-option-title', style: { margin: 0 } }, titleOf(s, idx)),
          badges)),
      s.description ? h('p', { className: 'pt-option-desc', style: { marginTop: 8 } }, s.description) : null,
      footer)
  })

  const gatedRow = gated ? h('div', { className: 'pt-card-row', style: { marginTop: 18 } },
    h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
      h('button', { className: 'pt-btn', onClick: onToggleAll }, allSelected ? t('deselectAll') : t('selectAll')),
      h('span', { className: 'pt-meta' }, t('selectCount', { s: selected.length, t: list.length }))),
    h('button', { className: 'pt-btn pt-btn-primary', disabled: selected.length === 0, onClick: onConfirm }, t('confirmStructures'))) : null

  const sourceFold = h('div', { className: 'pt-fold', style: { marginTop: 22 } },
    h('button', { className: 'pt-fold-head', onClick: () => setShowSource(!showSource) },
      h('span', null, showSource ? t('hideSource') : t('viewSource')),
      h('span', { className: 'chev' }, showSource ? '▾' : '▸')),
    showSource && document ? h('pre', { className: 'pt-log', style: { marginTop: 10 } }, document) : null)

  const active = detailId ? list.find((x) => x.id === detailId) || null : null
  const detailModal = active ? h('div', { className: 'pt-modal-backdrop', onClick: () => setDetailId(null) },
    h('div', { className: 'pt-modal', onClick: (e) => e.stopPropagation() },
      h('div', { className: 'pt-modal-head' },
        h('div', null,
          h('h3', { className: 'pt-option-title', style: { margin: 0 } }, titleOf(active, list.indexOf(active))),
          h('div', { style: { marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' } },
            h('span', { className: 'pt-tag' }, structTypeLabel(active.type)),
            active.complexity ? h('span', { className: 'pt-tag' }, t('complexityLabel') + ' ' + structLevelLabel(active.complexity)) : null,
            active.visualization_potential ? h('span', { className: 'pt-tag' }, t('potentialLabel') + ' ' + structLevelLabel(active.visualization_potential)) : null)),
        h('button', { className: 'pt-modal-close', onClick: () => setDetailId(null), title: t('close'),
          'aria-label': t('close') }, '×')),
      h('div', { className: 'pt-modal-body' },
        active.description ? h('p', { className: 'pt-option-desc' }, active.description) : null,
        detailFrag(active))))
    : null

  return h('div', null,
    h('div', { className: 'pt-grid' }, cards),
    gatedRow,
    sourceFold,
    detailModal)
}

function layoutLabel(k) {
  return String(k || '').split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1) }).join(' ') || k
}

function MetaPanel({ meta, documentTitle, onDocumentTitle, documentSummary, onDocumentSummary, projectTitle, onConfirm, busy }) {
  if (!meta) {
    return h(EmptyState, { title: t('metaRunning'), hint: t('metaRunningHint') })
  }
  return h('div', null,
    h('p', { className: 'pt-subtitle' }, t('newSubtitle')),
    h('div', { className: 'pt-card' },
      h('div', { className: 'pt-field' },
        h('label', { className: 'pt-field-label' }, t('projectTitle')),
        h('input', { className: 'pt-input', value: projectTitle, placeholder: meta.document_title || '', readOnly: true })),
      h('div', { className: 'pt-field', style: { marginTop: 12 } },
        h('label', { className: 'pt-field-label' }, t('metaTitle')),
        h('input', { className: 'pt-input', value: documentTitle, onChange: (e) => onDocumentTitle(e.target.value), placeholder: meta.document_title || '' })),
      h('div', { className: 'pt-field', style: { marginTop: 12 } },
        h('label', { className: 'pt-field-label' }, t('metaSummary')),
        h('textarea', { className: 'pt-input pt-textarea', value: documentSummary, onChange: (e) => onDocumentSummary(e.target.value), placeholder: meta.document_summary || '' })),
      h('p', { className: 'pt-detail', style: { marginTop: 4 } },
        t('metaConfirmedHint')),
      h('div', { className: 'pt-actions' },
        h('button', { className: 'pt-btn pt-btn-primary', disabled: busy || !String(documentTitle || '').trim(), onClick: onConfirm },
          busy ? t('saving') : t('confirmMeta')))))
}

function ProposalsPanel({ stage, proposals, suggestedStyle, steps, selected, onToggle, allSelected, onToggleAll,
                          layouts, styles, lay, sty, setLay, setSty, promptId, setPromptId,
                          ratios, setRatio, onRender, renderBusy, renderState, renderRunning, hasImageKey, running }) {
  const [pick, setPick] = React.useState(null) // { id, kind: 'layout' | 'style' }
  if (!proposals.length) {
    const metaState = steps ? steps[0].state : 'done'
    const extractState = steps ? steps[1].state : 'done'
    if (metaState !== 'done') {
      const runningMeta = metaState === 'running'
      return h(EmptyState, { title: runningMeta ? t('metaRunning') : t('waitMeta'), hint: runningMeta ? t('metaRunningHint') : t('waitMetaHint') })
    }
    if (extractState === 'gated') return h(EmptyState, { title: t('waitConfirmStructures'), hint: t('waitConfirmStructuresHint') })
    if (extractState !== 'done') return h(EmptyState, { title: t('pendingExtract'), hint: t('pendingExtractHint') })
    return h(EmptyState, { title: t('emptyAdviceRunning'), hint: t('emptyAdviceHint') })
  }
  const ratioFor = (id) => ratios[id] || '16:9'
  const activePrompt = promptId ? proposals.find((x) => x.id === promptId) || null : null

  function batchTargetIds() {
    return selected.length ? selected : proposals.map((p) => p.id)
  }
  function pickOption(name) {
    const cur = pick
    if (!cur) return
    if (cur.batch) {
      batchTargetIds().forEach((id) => setSty(id, name))
      setPick(null)
      return
    }
    if (cur.kind === 'layout') setLay(cur.id, name)
    else setSty(cur.id, name)
    setPick(null)
  }
  function resetCurrent() {
    const cur = pick
    if (!cur) return
    if (cur.batch) {
      batchTargetIds().forEach((id) => setSty(id, undefined))
      setPick(null)
      return
    }
    if (cur.kind === 'layout') setLay(cur.id, undefined)
    else setSty(cur.id, undefined)
    setPick(null)
  }

  const cards = proposals.map((p) => {
    const layV = lay[p.id] || p.suggested_layout || ''
    const styV = sty[p.id] || p.suggested_style || suggestedStyle || ''
    const titleV = p.title || layoutLabel(p.suggested_layout) || t('structFallback') + ' ' + p.id
    const layoutChanged = Boolean(lay[p.id] && lay[p.id] !== p.suggested_layout)
    const st = renderState && renderState.proposals ? renderState.proposals[p.id] : null
    const stErr = st === 'error' && renderState && renderState.errors ? renderState.errors[p.id] : null
    const statusTag = st === 'running' ? h('span', { className: 'pt-tag', style: { color: '#b45309' } }, t('rendering'))
      : st === 'done' ? h('span', { className: 'pt-tag', style: { color: '#15803d' } }, '✓')
      : st === 'error' ? h('span', { className: 'pt-tag', style: { color: '#b91c1c' } }, t('renderFailed'))
      : null
    const badges = h('div', { style: { marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' } },
      h('span', { className: 'pt-tag' }, layoutLabel(layV)),
      h('span', { className: 'pt-tag' }, styV),
      p.estimated_complexity ? h('span', { className: 'pt-tag' }, t('complexityLabel') + ' ' + structLevelLabel(p.estimated_complexity)) : null,
      statusTag)
    const controls = h('div', { className: 'pt-card-row', style: { marginTop: 10 } },
      h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' } },
        h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
          h('span', { className: 'pt-meta' }, t('fieldAspect')),
          h('select', { className: 'pt-input', style: { width: 92, padding: '4px 8px', fontSize: 13 }, value: ratioFor(p.id), onChange: (e) => setRatio(p.id, e.target.value) },
            ['16:9', '4:3', '3:4', '9:16', '1:1'].map((r) => h('option', { key: r, value: r }, r)))),
        h('button', { className: 'pt-btn', style: { padding: '4px 10px', fontSize: 13 }, onClick: () => setPick({ id: p.id, kind: 'layout' }) },
          t('layoutLabel') + ': ' + layoutLabel(layV) + (layoutChanged ? ' ' + t('layoutChanged') : '')),
        h('button', { className: 'pt-btn', style: { padding: '4px 10px', fontSize: 13 }, onClick: () => setPick({ id: p.id, kind: 'style' }) },
          t('styleLabel') + ': ' + styV)),
      h('button', { className: 'pt-btn pt-btn-ghost', style: { padding: '4px 8px', fontSize: 13 }, onClick: () => setPromptId(p.id) }, t('viewPrompt')))
    return h('div', { key: p.id, className: 'pt-card' },
      h('div', { className: 'pt-card-row' },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('h3', { className: 'pt-option-title', style: { margin: 0 } }, titleV),
          badges),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', { className: 'pt-check', type: 'checkbox', checked: selected.includes(p.id), onChange: () => onToggle(p.id) }),
          h('span', { className: 'pt-meta' }, t('select')))),
      p.communicative_intent ? h('p', { className: 'pt-option-desc', style: { marginTop: 8 } }, p.communicative_intent) : null,
      stErr ? h('p', { className: 'pt-error', style: { marginTop: 8 } }, t('renderFailed') + ': ' + stErr) : null,
      controls)
  })

  const promptModal = activePrompt ? h('div', { className: 'pt-modal-backdrop', onClick: () => setPromptId(null) },
    h('div', { className: 'pt-modal', onClick: (e) => e.stopPropagation() },
      h('div', { className: 'pt-modal-head' },
        h('div', null, h('h3', { className: 'pt-option-title', style: { margin: 0 } }, t('viewPrompt'))),
        h('button', { className: 'pt-modal-close', onClick: () => setPromptId(null), title: t('close'), 'aria-label': t('close') }, '×')),
      h('div', { className: 'pt-modal-body' },
        h('p', { className: 'pt-detail' }, activePrompt.layout_rationale || ''),
        h('pre', { className: 'pt-code' }, activePrompt.source_text || ''))))
    : null

  const chooserModal = pick ? (function chooser() {
    const kind = pick.kind
    const batch = Boolean(pick.batch)
    const p = batch ? null : proposals.find((x) => x.id === pick.id)
    if (!batch && !p) return null
    const list = kind === 'layout'
      ? (layouts && layouts.length ? layouts : (p ? [p.suggested_layout] : []))
      : (styles && styles.length ? styles : (p ? [p.suggested_style || suggestedStyle] : (suggestedStyle ? [suggestedStyle] : [])))
    const base = batch ? '' : (kind === 'layout' ? p.suggested_layout : (p.suggested_style || suggestedStyle))
    // batch：高亮所有目标方案共享的同一风格（若有），否则不高亮
    let current
    if (batch) {
      const ids = batchTargetIds()
      const eff = ids.map((id) => {
        const pp = proposals.find((x) => x.id === id)
        return (pp ? (sty[id] || pp.suggested_style || suggestedStyle || '') : (sty[id] || ''))
      })
      current = eff.length && eff.every((s) => s === eff[0]) ? eff[0] : ''
    } else {
      current = kind === 'layout' ? (lay[pick.id] || p.suggested_layout) : (sty[pick.id] || p.suggested_style || suggestedStyle)
    }
    const changed = batch
      ? ids_haveAnyOverrideStyle()
      : (kind === 'layout' ? Boolean(lay[pick.id] && lay[pick.id] !== base) : Boolean(sty[pick.id] && sty[pick.id] !== base))
    function ids_haveAnyOverrideStyle() {
      return batchTargetIds().some((id) => Boolean(sty[id]))
    }
    const items = list.map((n) => h('div', { key: n, className: 'pt-preview-item' + (n === current ? ' sel' : ''), onClick: () => pickOption(n) },
      (!batch && n === base) ? h('span', { className: 'ai-chip' }, t('aiSuggestion')) : null,
      h('img', { src: '/pictor/preview/' + (kind === 'layout' ? 'layouts' : 'styles') + '/' + encodeURIComponent(n) + '.webp', alt: kind === 'layout' ? layoutLabel(n) : n }),
      h('div', { className: 'nm' }, kind === 'layout' ? layoutLabel(n) : n)))
    const title = batch ? t('batchStyleLabel') : (kind === 'layout' ? t('chooseLayout') : t('chooseStyle'))
    const batchSub = batch ? h('p', { className: 'pt-meta', style: { margin: '0 0 10px' }, key: 'sub' },
      t('batchStyleHint') + ' · ' + t('selectCount', { s: selected.length, t: proposals.length })) : null
    return h('div', { className: 'pt-modal-backdrop', onClick: () => setPick(null) },
      h('div', { className: 'pt-modal pt-modal-wide', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'pt-modal-head' },
          h('h3', { className: 'pt-option-title', style: { margin: 0 } }, title),
          h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            changed ? h('button', { className: 'pt-btn', style: { padding: '6px 12px', fontSize: 13 }, onClick: resetCurrent }, t('resetToAi')) : null,
            h('button', { className: 'pt-modal-close', onClick: () => setPick(null), title: t('close'), 'aria-label': t('close') }, '×'))),
        h('div', { className: 'pt-modal-body' }, batchSub, h('div', { className: 'pt-preview-grid' }, items))))
  })() : null

  const styleList = (styles && styles.length ? styles : (suggestedStyle ? [suggestedStyle] : []))
  const batchStyleBtn = styleList.length ? h('button', {
    className: 'pt-btn', style: { padding: '4px 10px', fontSize: 13 }, disabled: proposals.length === 0,
    onClick: () => setPick({ id: null, kind: 'style', batch: true }),
    title: t('batchStyleHint'),
  }, t('batchStyleLabel')) : null

  const actionRow = h('div', { className: 'pt-card-row', style: { marginTop: 18 } },
    h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
      h('button', { className: 'pt-btn', onClick: onToggleAll }, allSelected ? t('deselectAll') : t('selectAll')),
      batchStyleBtn,
      h('span', { className: 'pt-meta' }, t('selectCount', { s: selected.length, t: proposals.length }))),
    hasImageKey === false
      ? h('p', { className: 'pt-warn', style: { margin: 0 } }, t('imgKeyHint'))
      : h('button', { className: 'pt-btn pt-btn-primary', disabled: selected.length === 0 || renderBusy || renderRunning === true, onClick: onRender },
          renderBusy || renderRunning ? t('rendering') : t('renderSelected')))

  return h('div', null,
    h('div', { className: 'pt-grid' }, cards),
    actionRow,
    promptModal,
    chooserModal)
}

function fileSlug(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'infographic'
}

function ResultsPanel({ outputs, images, renderErrors, proposals, lay, renderBatches }) {
  const [big, setBig] = React.useState(null)
  const [collapsed, setCollapsed] = React.useState({})
  if (!outputs.length && !renderErrors.length) {
    return h(EmptyState, { title: t('emptyRender'), hint: t('emptyRenderHint') })
  }
  const pidOf = (n) => n.replace(/\.png$/, '').replace(/-\d+$/, '')
  const propOf = (pid) => (Array.isArray(proposals) ? proposals.find((p) => String(p.id) === pid) : null)
  const titleAndLayout = (name) => {
    const pid = pidOf(name)
    const prop = propOf(pid)
    const actualLayout = lay && lay[pid] ? lay[pid] : (prop ? (prop.suggested_layout || '') : '')
    const title = prop && prop.title ? prop.title : (layoutLabel(actualLayout || prop?.suggested_layout) || name)
    return { pid, prop, actualLayout, title }
  }
  const bigInfo = big ? titleAndLayout(big) : null
  const bigModal = big && images[big] && bigInfo ? h('div', { className: 'pt-modal-backdrop', onClick: () => setBig(null) },
    h('div', { className: 'pt-modal', style: { width: 'min(92vw, 1200px)' }, onClick: (e) => e.stopPropagation() },
      h('div', { className: 'pt-modal-head' },
        h('div', null, h('h3', { className: 'pt-option-title', style: { margin: 0 } }, bigInfo.title)),
        h('button', { className: 'pt-modal-close', onClick: () => setBig(null), title: t('close'), 'aria-label': t('close') }, '×')),
      h('div', { className: 'pt-modal-body', style: { textAlign: 'center' } },
        h('img', { src: images[big], alt: bigInfo.title, style: { maxWidth: '100%', maxHeight: '70vh', borderRadius: 10 } }),
        bigInfo.actualLayout ? h('p', { className: 'pt-meta', style: { marginTop: 10 } }, t('layoutLabel') + ': ' + layoutLabel(bigInfo.actualLayout)) : null)))
    : null

  // 按渲染批次分组（新批次在前），历史批次与旧图全部保留
  const batches = Array.isArray(renderBatches) ? renderBatches : []
  const knownFiles = new Set()
  batches.forEach((b) => (Array.isArray(b.outputs) ? b.outputs : []).forEach((f) => knownFiles.add(String(f))))
  const groups = []
  for (const b of batches) {
    // 每个批次精确持有自己的产出文件（同一方案重复渲染也不覆盖、不串组）
    const files = (Array.isArray(b.outputs) ? b.outputs : []).filter((f) => outputs.includes(f))
    if (!files.length) continue
    const time = b.startedAt ? new Date(b.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    groups.push({ key: String(b.batchId || time || 'batch'), title: t('batchTitle', { t: time }) + ' · ' + t('batchN', { n: files.length }), files })
  }
  const leftover = outputs.filter((n) => !knownFiles.has(n))
  if (leftover.length) groups.push({ key: 'legacy', title: t('batchLegacy') + ' · ' + t('batchN', { n: leftover.length }), files: leftover })

  const figs = (files) => files.map((name) => {
    const info = titleAndLayout(name)
    const dlName = info.prop ? (fileSlug(info.prop.title || layoutLabel(info.actualLayout || info.prop.suggested_layout)) + '-' + info.pid + '.png') : name
    return h('figure', { key: name, className: 'pt-img-card' },
      images[name]
        ? h('img', { className: 'pt-img', src: images[name], alt: info.title, style: { cursor: 'zoom-in' }, onClick: () => setBig(name) })
        : h('div', { className: 'thumb', style: { width: '100%', height: 140 } }),
      h('figcaption', null,
        h('div', { className: 'pt-fig-title' }, info.title),
        h('div', { className: 'pt-fig-row' },
          h('a', { className: 'pt-dl', href: images[name] || '#', download: dlName }, t('download')))))
  })

  return h('div', null,
    renderErrors && renderErrors.length
      ? renderErrors.map((e, i) => h('p', { key: i, className: 'pt-error' }, `${e.id}: ${e.error}`))
      : null,
    groups.map((g) => {
      const open = !collapsed[g.key]
      return h('div', { key: g.key, className: 'pt-batch' },
        h('div', { className: 'pt-batch-head', onClick: () => setCollapsed((p) => ({ ...p, [g.key]: !p[g.key] })) },
          h('span', { className: 'pt-batch-title' }, g.title),
          h('span', { className: 'chev' }, open ? '▾' : '▸')),
        open ? h('div', { className: 'pt-img-grid' }, figs(g.files)) : null)
    }),
    bigModal)
}

function expandPrompt(proposal) {
  const parts = [
    proposal.source_text ? '来源内容：' + proposal.source_text : '',
    proposal.communicative_intent ? '传达意图：' + proposal.communicative_intent : '',
    proposal.suggested_layout ? '布局：' + proposal.suggested_layout : '',
    proposal.layout_rationale ? '布局理由：' + proposal.layout_rationale : '',
    proposal.style_rationale ? '风格理由：' + proposal.style_rationale : '',
  ]
  return parts.filter(Boolean).join('\n')
}

// ---------- 新建项目 ----------

function NewProjectPane(props) {
  const [mode, setMode] = React.useState('file')
  const [fileName, setFileName] = React.useState(null)
  const [fileData, setFileData] = React.useState(null)
  const [fileSize, setFileSize] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const fileRef = React.useRef(null)
  const richRef = React.useRef(null)

  function pickFile() {
    if (fileRef.current) fileRef.current.click()
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const kb = Math.round(f.size / 1024)
    setFileName(f.name)
    setFileSize(kb < 1024 ? kb + ' KB' : (kb / 1024).toFixed(1) + ' MB')
    const reader = new FileReader()
    reader.onload = () => setFileData(String(reader.result || ''))
    reader.readAsDataURL(f)
  }

  function onPaste(e) {
    if (mode !== 'paste') return
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    e.preventDefault()
    if (html) {
      const clean = sanitizePaste(html)
      if (document.execCommand) {
        try { document.execCommand('insertHTML', false, clean); return } catch { /* 回落 */ }
      }
      document.execCommand('insertText', false, text)
    } else {
      document.execCommand('insertText', false, text)
    }
  }

  function submitRich() {
    const el = richRef.current
    if (!el) return ''
    return sanitizePaste(el.innerHTML)
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'file') {
        if (!fileData) throw new Error('请先选择文件')
        const res = await rpc(props.ctx, 'project.create', { file: { name: fileName, dataUrl: fileData } })
        if (res && res.id) {
          const sessionId = await driveProjectSession(props.ctx, res.prompt)
          await rpc(props.ctx, 'project.attach', { id: res.id, sessionId })
          props.onCreated(res.id)
        }
      } else {
        const html = submitRich()
        if (!html || !html.replace(/<[^>]*>/g, '').trim()) throw new Error('请先粘贴内容')
        const res = await rpc(props.ctx, 'project.create', { html })
        if (res && res.id) {
          const sessionId = await driveProjectSession(props.ctx, res.prompt)
          await rpc(props.ctx, 'project.attach', { id: res.id, sessionId })
          props.onCreated(res.id)
        }
      }
    } catch (e) {
      setError(String(e && e.message ? e.message : e))
    } finally {
      setBusy(false)
    }
  }

  return h('div', null,
    h('h1', { className: 'pt-title' }, t('newProject')),
    h('p', { className: 'pt-subtitle' }, '一份文档转成一组信息图。项目名取文档首行，随时可改。'),

    h('div', { className: 'pt-tabbar' },
      h('button', { className: 'pt-tab' + (mode === 'file' ? ' active' : ''), onClick: () => setMode('file') }, t('tabUpload')),
      h('button', { className: 'pt-tab' + (mode === 'paste' ? ' active' : ''), onClick: () => setMode('paste') }, t('tabPaste'))),

    mode === 'file'
      ? h('div', null,
          h('div', { className: 'pt-file', onClick: pickFile },
            h('div', null,
              (fileName
                ? h('p', { className: 'pt-file-name' }, fileName + '（' + fileSize + '）')
                : h('p', { style: { margin: 0 } }, t('pickFile'))),
              h('p', { className: 'pt-detail', style: { margin: '4px 0 0' } },
                t('fileHint')))),
          h('input', { ref: fileRef, type: 'file',
            accept: '.md,.markdown,.txt,.text,.docx,.pdf,.png,.jpg,.jpeg,.webp', style: { display: 'none' },
            onChange: onFile }))
      : h('div', null,
          h('div', { ref: richRef, className: 'pt-input pt-rich', contentEditable: true, onPaste,
          'data-placeholder': t('richPlaceholder') }),
          h('p', { className: 'pt-detail', style: { marginTop: 8 } },
            t('richHint'))),

    error ? h('p', { className: 'pt-error' }, error) : null,
    h('div', { className: 'pt-actions' },
      h('button', { className: 'pt-btn pt-btn-primary', onClick: submit, disabled: busy }, busy ? t('creating') : t('createProject'))))
}

// ---------- 项目详情 ----------

function DetailPane(props) {
  const { ctx, projectId, onDeleted } = props
  const [data, setData] = React.useState(null)
  const [structuresSel, setStructuresSel] = React.useState([])
  const [proposalSel, setProposalSel] = React.useState([])
  const [ratios, setRatios] = React.useState({}) // proposalId -> 宽高比，每张图单独设，缺省 16:9
  const ovDraft = React.useRef({ lay: {}, sty: {}, ratios: {} })
  const overrideTimer = React.useRef(null)
  function scheduleOverridesSave() {
    if (overrideTimer.current) clearTimeout(overrideTimer.current)
    overrideTimer.current = setTimeout(() => {
      overrideTimer.current = null
      const { lay, sty, ratios: rat } = ovDraft.current
      const ov = {}
      for (const id of new Set([...Object.keys(lay), ...Object.keys(sty), ...Object.keys(rat)])) {
        const c = {}
        if (lay[id]) c.layout = lay[id]
        if (sty[id]) c.style = sty[id]
        if (rat[id]) c.aspectRatio = rat[id]
        if (Object.keys(c).length) ov[id] = c
      }
      rpc(ctx, 'project.saveOverrides', { id: projectId, overrides: ov }).catch((e) => console.error(e))
    }, 500)
  }
  function setRatio(id, v) {
    setRatios((prev) => { const n = { ...prev }; if (v === undefined) delete n[id]; else n[id] = v; ovDraft.current.ratios = n; return n })
    scheduleOverridesSave()
  }
  const [discuss, setDiscuss] = React.useState('')
  const [images, setImages] = React.useState({})
  const [metaTitle, setMetaTitle] = React.useState('')
  const [metaSummary, setMetaSummary] = React.useState('')
  const metaDirty = React.useRef(false)
  const [metaBusy, setMetaBusy] = React.useState(false)
  const saveMetaTimer = React.useRef(null)
  function saveMetaNext(nTitle, nSummary) {
    if (saveMetaTimer.current) clearTimeout(saveMetaTimer.current)
    saveMetaTimer.current = setTimeout(() => {
      rpc(ctx, 'project.saveMeta', { id: projectId, title: nTitle || (data && data.meta && data.meta.document_title) || '', summary: nSummary || '' })
        .then(() => setTick((x) => x + 1))
        .catch((e) => console.error(e))
    }, 600)
  }
  const [layOv, setLayOv] = React.useState({})
  const [styOv, setStyOv] = React.useState({})
  function setLayWrap(id, v) { setLayOv((prev) => { const n = { ...prev }; if (v === undefined) delete n[id]; else n[id] = v; ovDraft.current.lay = n; return n }); scheduleOverridesSave() }
  function setStyWrap(id, v) { setStyOv((prev) => { const n = { ...prev }; if (v === undefined) delete n[id]; else n[id] = v; ovDraft.current.sty = n; return n }); scheduleOverridesSave() }
  const [promptId, setPromptId] = React.useState(null)
  const [renderErrors, setRenderErrors] = React.useState([])
  const [renderBusy, setRenderBusy] = React.useState(false)
  const [step, setStep] = React.useState('extract')
  const [showDiscuss, setShowDiscuss] = React.useState(true)
  const [renaming, setRenaming] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState('')
  const initLanding = React.useRef(false)
  const [tick, setTick] = React.useState(0)
  const [imageCfg, setImageCfg] = React.useState(null)
  const [styleOptions, setStyleOptions] = React.useState([])
  const [layoutOptions, setLayoutOptions] = React.useState([])
  React.useEffect(() => {
    rpc(ctx, 'config.get').then((c) => {
      if (c && c.image) setImageCfg(c.image)
      if (c && Array.isArray(c.styles)) setStyleOptions(c.styles)
      if (c && Array.isArray(c.layouts)) setLayoutOptions(c.layouts)
    }).catch(() => {})
  }, [ctx])

  React.useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await rpc(ctx, 'project.get', { id: projectId })
        if (res && alive) setData(res)
      } catch (e) {
        console.error(e)
      }
    }
    load()
    const t = setInterval(load, 2000)
    return () => { alive = false; clearInterval(t) }
  }, [projectId, tick])

  React.useEffect(() => {
    if (!data) return
    const steps = deriveSteps(data.record.stage, Boolean(data.meta))
    const available = STEP_KEYS.filter((k) => steps[STEP_KEYS.indexOf(k)].state !== 'pending')
    const furthest = available.length ? available[available.length - 1] : 'extract'
    if (!initLanding.current) {
      initLanding.current = true
      setStep(furthest) // 初登落在最靠后的有产物步骤（pictorial getTargetPage 语义）
    } else if (!available.includes(step)) {
      setStep(furthest) // 之后只在当前步骤失效时纠正
    }
  }, [data && data.record && data.record.stage])

  React.useEffect(() => {
    // 后台渲染收尾：render.json 落 finishedAt 后恢复按钮、跳渲染页、汇总错误
    if (!renderBusy || !data || !data.renderState) return
    if (!data.renderState.finishedAt) return
    setRenderBusy(false)
    const errs = Object.entries(data.renderState.errors || {}).map(([id2, e]) => ({ id: id2, error: String(e) }))
    if (errs.length) setRenderErrors(errs)
    setStep('render')
    setTick((x) => x + 1)
  }, [renderBusy, data && data.renderState])

  React.useEffect(() => {
    if (!data) return
    const outs = data.outputs || []
    outs.forEach((name) => {
      if (images[name]) return
      rpc(ctx, 'project.image', { id: projectId, name }).then((img) => {
        if (img && img.dataUrl) setImages((p) => ({ ...p, [name]: img.dataUrl }))
      }).catch(() => {})
    })
  }, [data, projectId, images])

  React.useEffect(() => {
    if (!data || !data.meta) return
    if (metaDirty.current) return
    setMetaTitle(data.meta.document_title || '')
    setMetaSummary(data.meta.document_summary || '')
  }, [data && data.meta])

  const appliedMetaRef = React.useRef(null)
  React.useEffect(() => {
    // 方案覆盖（比例/layout/style）持久化到 12.advice/overrides.json，刷新回填；
    // 有未落盘的待保存改动（debounce 计时中）时跳过本轮，避免覆盖用户刚做的修改。
    if (!data || !data.overrides) return
    if (overrideTimer.current) return
    const lay = {}; const sty = {}; const rat = {}
    for (const [pid, v] of Object.entries(data.overrides)) {
      if (!v || typeof v !== 'object') continue
      if (v.layout) lay[pid] = v.layout
      if (v.style) sty[pid] = v.style
      if (v.aspectRatio) rat[pid] = v.aspectRatio
    }
    ovDraft.current = { lay, sty, ratios: rat }
    setLayOv(lay); setStyOv(sty); setRatios(rat)
  }, [data && data.overrides, projectId])

  React.useEffect(() => {
    // 阶段0 信息就位后自动把项目标题改写为 AI 提炼的合理标题，仅在
    // 「同份 meta 尚未应用过 且 用户未手动编辑」时执行一次；此后用户
    // 任何手动改名都保留，不再回改。
    if (!data || !data.meta) return
    if (metaDirty.current) return
    const k = projectId + ':' + String(data.meta.document_title || '') + ':' + String(data.meta.document_summary || '')
    const t = String(data.meta.document_title || '').trim()
    if (!t) return
    if (data.record.title === t) { appliedMetaRef.current = k; return }
    if (appliedMetaRef.current === k) return
    rpc(ctx, 'project.saveMeta', { id: projectId, title: t, summary: String(data.meta.document_summary || '') })
      .then(() => { appliedMetaRef.current = k; setTick((x) => x + 1) })
      .catch((e) => console.error(e))
  }, [data && data.meta, data && data.record && data.record.title, projectId])

  async function deleteProject() {
    if (!window.confirm(t('delConfirm', { t: (data && data.record && data.record.title) || projectId }))) return
    try {
      await rpc(ctx, 'project.delete', { id: projectId })
      if (onDeleted) onDeleted()
    } catch (e) { console.error(e) }
  }

  if (!data) {
    return h('p', { className: 'pt-meta' }, t('loading'))
  }

  const record = data.record
  const stage = record.stage
  const structures = parseStructures(data.structuresJson)
  const propData = parseProposals(data.proposalsJson)
  const proposals = propData ? (propData.proposals || []) : []
  const styleName = propData ? (propData.suggested_style || '') : ''
  const stepCounts = { meta: null, extract: structures.length, advise: proposals.length, render: data.outputs.length }
  const steps = deriveSteps(stage, Boolean(data.meta)).map((s, i) => {
    return { ...s, count: stepCounts[STEP_KEYS[i]] || null }
  })
  if (data.renderRunning && steps[3]) steps[3].state = 'running'

  async function confirmStructures() {
    const ids = selectedLabel(structuresSel)
    const message =
      '用户已确认候选结构：[' + ids + ']。请进入方案阶段：' +
      '用 subagent 工具实例化 advisor（指令原样发送：「请阅读 agents/12.advisor.md 并严格按该蓝图执行。' +
      '参数：EXTRACTION_DIR 指向 11.extraction/（含 structures.json）；OUTPUT_DIR 指向 12.advice/，' +
      '产出 proposals.json」）。完成后读取 12.advice/proposals.json，' +
      '向用户汇报方案摘要，然后停下等待用户选择方案。禁止自动进入 render 阶段。'
    await drivePrompt(ctx, projectId, message)
    setStructuresSel([])
  }

  async function renderSelected() {
    const runningNow = data && data.renderRunning
    if (!proposalSel.length || renderBusy || runningNow) return
    setRenderBusy(true)
    setRenderErrors([])
    try {
      await rpc(ctx, 'project.render', {
        id: projectId,
        proposalIds: proposalSel,
        aspectRatios: Object.fromEntries(proposalSel.map((id) => [id, ratios[id] || '16:9'])),
        overrides: Object.fromEntries(proposalSel.map((id) => [id, {
          layout: layOv[id] || undefined,
          style: styOv[id] || undefined,
        }])),
      })
      // busy 保持为 true；render.json 的 finishedAt 出现后 effect 收尾
    } catch (e) {
      setRenderErrors([{ id: projectId, error: String(e && e.message ? e.message : e) }])
      setRenderBusy(false)
    }
  }

  async function confirmMeta() {
    if (metaBusy) return
    setMetaBusy(true)
    try {
      // 标题/摘要的修改在编辑时已自动写盘；确认只做「进入提取」这一个决定。
      await rpc(ctx, 'project.confirmMeta', { id: projectId })
      await drivePrompt(ctx, projectId, '用户已确认文档信息，开始提取结构。')
      setStep('extract')
      setTick((x) => x + 1)
    } catch (e) { console.error(e) } finally { setMetaBusy(false) }
  }

  function sendDiscussion() {
    const msg = discuss.trim()
    if (!msg) return
    drivePrompt(ctx, projectId, msg).catch((e) => console.error(e))
    setDiscuss('')
  }

  function rename() {
    const title = renameValue.trim()
    if (!title) { setRenaming(false); return }
    rpc(ctx, 'project.rename', { id: projectId, title }).then(() => setRenaming(false)).catch(() => setRenaming(false))
  }

  const stepBody = {
    meta: h(MetaPanel, {
      meta: data.meta || null, documentTitle: metaTitle,
      onDocumentTitle: (v) => { metaDirty.current = true; setMetaTitle(v); saveMetaNext(v, metaSummary) },
      documentSummary: metaSummary,
      onDocumentSummary: (v) => { metaDirty.current = true; setMetaSummary(v); saveMetaNext(metaTitle, v) },
      projectTitle: data.record.title || '', onConfirm: confirmMeta, busy: metaBusy,
    }),
    extract: h(StructuresPanel, { stage, structures, selected: structuresSel,
      steps, running: Boolean(data.running),
      onToggle: (id) => setStructuresSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]),
      disabled: stage !== 'gated:structure', onConfirm: confirmStructures, document: data.document,
      onToggleAll: () => setStructuresSel(structuresSel.length === structures.length ? [] : structures.map((x) => x.id)),
      seedKey: data.structuresJson,
      onSaveStructures: async (items) => {
        await rpc(ctx, 'project.patchStructures', { id: projectId, structures: items })
        setTick((x) => x + 1)
      } }),
    advise: h(ProposalsPanel, { stage, proposals, suggestedStyle: styleName, steps, selected: proposalSel,
      onToggle: (id) => setProposalSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]),
      allSelected: proposalSel.length > 0 && proposalSel.length === proposals.length,
      onToggleAll: () => setProposalSel(proposalSel.length === proposals.length ? [] : proposals.map((x) => x.id)),
      layouts: layoutOptions, styles: styleOptions,
      lay: layOv, sty: styOv, setLay: setLayWrap, setSty: setStyWrap,
      promptId, setPromptId,
      ratios, setRatio, onRender: renderSelected, renderBusy,
      hasImageKey: Boolean(imageCfg && imageCfg.hasKey), running: Boolean(data.running),
      renderState: data.renderState, renderRunning: Boolean(data.renderRunning) }),
    render: h(ResultsPanel, { outputs: data.outputs, images, renderErrors, proposals, lay: layOv, renderBatches: data.renderBatches }),
  }[step]

  return h('div', null,
    h('div', { className: 'pt-infobar' },
      renaming
        ? h('input', { className: 'pt-input pt-rename-input', value: renameValue, autoFocus: true,
            onChange: (e) => setRenameValue(e.target.value), onBlur: rename,
            onKeyDown: (e) => { if (e.key === 'Enter') rename() } })
        : h('h1', null, record.title),
      h('button', { className: 'pt-btn pt-btn-ghost', style: { padding: '4px 10px', fontSize: 13 },
        onClick: () => { setRenaming(true); setRenameValue(record.title) } }, t('rename')),
      h('button', { className: 'pt-btn pt-btn-ghost', style: { padding: '4px 10px', fontSize: 13, color: '#b91c1c' },
        onClick: deleteProject }, t('del')),
      stageBadge(stage)),
    h('p', { className: 'pt-meta', style: { marginTop: 2 } },
      t('metaTime', { c: (record.createdAt || '').slice(0, 16).replace('T', ' '), u: (record.updatedAt || '').slice(0, 16).replace('T', ' ') }) +
      (data.sourceName ? ' · ' + t('sourceLabel') + ' ' + data.sourceName : '')),

    h(StageStrip, { steps, active: step, onPick: setStep }),

    h('section', { className: 'pt-section' }, stepBody),

    h('div', { className: 'pt-fold' },
      h('button', { className: 'pt-fold-head', onClick: () => setShowDiscuss(!showDiscuss) },
        h('span', null, t('discussion')),
        h('span', { className: 'chev' }, showDiscuss ? '▾' : '▸')),
      showDiscuss ? h('div', { className: 'pt-fold-body' },
        h('p', { className: 'pt-detail' }, t('discussHint')),
        h('textarea', { className: 'pt-input pt-textarea', style: { marginTop: 10 }, value: discuss,
          placeholder: t('discussPlaceholder'),
          onChange: (e) => setDiscuss(e.target.value) }),
        h('div', { className: 'pt-actions' },
          h('button', { className: 'pt-btn', disabled: !discuss.trim(), onClick: sendDiscussion }, t('send')))) : null))
}

// ---------- 设置 ----------

/** 各 provider 的内置默认端点（image-providers.ts 同源）；留空即用默认，可覆盖（如方舟其它区/网关）。 */
function defaultBaseUrl(provider) {
  if (provider === 'seedream') return 'https://ark.cn-beijing.volces.com/api/v3'
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com'
  if (provider === 'dashscope') return 'https://dashscope.aliyuncs.com/api/v1'
  return '必填：OpenAI 兼容端点，如 https://…/api/v3'
}

function SettingsPane(props) {
  const { ctx, onBack } = props
  const [cfg, setCfg] = React.useState(null)
  const [provider, setProvider] = React.useState('seedream')
  const [baseUrl, setBaseUrl] = React.useState('')
  const [model, setModel] = React.useState('')
  const [apiKey, setApiKey] = React.useState('')
  const [extraText, setExtraText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState(null)

  React.useEffect(() => {
    rpc(ctx, 'config.get').then((c) => {
      if (!c) return
      setCfg(c)
      const im = c.image || {}
      setProvider(im.provider || 'seedream')
      setBaseUrl(im.baseUrl || '')
      setModel(im.model || '')
      if (im.extra && Object.keys(im.extra).length) setExtraText(JSON.stringify(im.extra, null, 2))
    }).catch((e) => console.error(e))
  }, [ctx])

  async function save() {
    if (busy || !cfg) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await rpc(ctx, 'config.set', {
        image: { provider, baseUrl, model, apiKey: apiKey || undefined, extra: extraText },
      })
      setApiKey('')
      const test = await rpc(ctx, 'config.test')
      setMsg({ ok: true, text: t('savedTest') + (test && test.size ? test.size : t('testOk')) })
    } catch (e) {
      setMsg({ ok: false, text: String(e && e.message ? e.message : e) })
    } finally {
      setBusy(false)
    }
  }

  return h('div', null,
    h('h1', { className: 'pt-title' }, t('settingsTitle')),
    h('p', { className: 'pt-subtitle' }, t('settingsSubtitle')),

    cfg ? h('div', { className: 'pt-card' },
      h('div', { className: 'pt-field' },
        h('label', { className: 'pt-field-label' }, t('fieldProvider')),
        h('select', { className: 'pt-input', value: provider, onChange: (e) => setProvider(e.target.value) },
          ['seedream', 'gemini', 'dashscope', 'openai-compatible', 'mock'].map((p) => h('option', { key: p, value: p }, p)))),
      provider !== 'mock'
        ? h('div', { className: 'pt-field', style: { marginTop: 14 } },
            h('label', { className: 'pt-field-label' }, t('fieldBaseUrl')),
            h('input', { className: 'pt-input', value: baseUrl, onChange: (e) => setBaseUrl(e.target.value),
              placeholder: defaultBaseUrl(provider) }))
        : null,
      h('div', { className: 'pt-field', style: { marginTop: 14 } },
        h('label', { className: 'pt-field-label' }, t('fieldModel')),
        h('input', { className: 'pt-input', value: model, onChange: (e) => setModel(e.target.value),
          placeholder: provider === 'seedream' ? 'doubao-seedream-4-5-251128' : provider === 'gemini' ? 'gemini-3-pro-image-preview' : provider === 'dashscope' ? 'qwen-image-3.0-pro' : '' })),
      h('div', { className: 'pt-field', style: { marginTop: 14 } },
        h('label', { className: 'pt-field-label' }, t('fieldExtra')),
        h('textarea', { className: 'pt-input', style: { minHeight: 64, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }, value: extraText, onChange: (e) => setExtraText(e.target.value),
          placeholder: '{}' }),
        h('p', { className: 'pt-detail', style: { marginTop: 6 } }, t('extraHint'))),
      h('div', { className: 'pt-field', style: { marginTop: 14 } },
        h('label', { className: 'pt-field-label' },
          t('fieldKey') + (cfg.image && cfg.image.hasKey ? t('keySet') : '')),
        h('input', { className: 'pt-input', type: 'password', value: apiKey, onChange: (e) => setApiKey(e.target.value),
          placeholder: cfg.image && cfg.image.hasKey ? t('keyPlaceholderSet') : t('keyPlaceholder') })),
      cfg.image && cfg.image.keyStorage === 'file'
        ? h('p', { className: 'pt-warn', style: { marginTop: 10 } }, t('keyStorageFile'))
        : null,
      msg ? h('p', { className: msg.ok ? 'pt-detail' : 'pt-error', style: { marginTop: 12 } }, msg.text) : null,
      h('div', { className: 'pt-actions' },
        h('button', { className: 'pt-btn', onClick: onBack }, t('back')),
        h('button', { className: 'pt-btn pt-btn-primary', onClick: save, disabled: busy }, busy ? t('saving') : t('saveTest'))))
      : h('p', { className: 'pt-meta' }, t('loading')))
}

// ---------- 工作台 ----------

function Workbench(props) {
  useLang() // 语言切换时整工作台重渲染
  const ctx = props.ctx
  const [projects, setProjects] = React.useState([])
  const [selected, setSelected] = React.useState(null)
  const [view, setView] = React.useState('list') // list | new | settings
  const [thumb, setThumb] = React.useState({})

  async function reload() {
    try {
      const data = await rpc(ctx, 'project.list')
      if (data && data.projects) setProjects(data.projects)
    } catch (e) {
      console.error(e)
    }
  }

  React.useEffect(() => {
    reload()
    const t = setInterval(reload, 3000)
    return () => clearInterval(t)
  }, [])

  async function openProject(id) {
    setSelected(id)
    setView('list')
    try {
      const data = await rpc(ctx, 'project.get', { id })
      if (data && data.outputs && data.outputs.length) {
        const first = await rpc(ctx, 'project.image', { id, name: data.outputs[0] })
        if (first && first.dataUrl) setThumb((p) => ({ ...p, [id]: first.dataUrl }))
      }
    } catch (e) { console.error(e) }
  }

  async function removeProject(id) {
    if (!window.confirm(t('delConfirm', { t: projects.find((p) => p.id === id)?.title || id }))) return
    try {
      await rpc(ctx, 'project.delete', { id })
      if (selected === id) setSelected(null)
      await reload()
    } catch (e) { console.error(e) }
  }

  let body
  if (view === 'new') {
    body = h('div', { className: 'pt-wrap' }, h(NewProjectPane, { ctx,
      onCreated: (id) => openProject(id) }))
  } else if (view === 'settings') {
    body = h('div', { className: 'pt-wrap' }, h(SettingsPane, { ctx, onBack: () => setView('list') }))
  } else if (selected) {
    body = h('div', { className: 'pt-wrap' }, h(DetailPane, { ctx, projectId: selected,
      onDeleted: () => { setSelected(null); setView('list'); reload() } }))
  } else {
    body = h('div', { className: 'pt-wrap' },
      h('div', { style: { minHeight: '62vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
        h(EmptyState, {
          title: t('emptyProjects'),
          hint: t('emptyProjectsHint'),
        })),
      h('div', { className: 'pt-credits' },
        t('creditsPre'),
        h('a', { href: 'https://github.com/jimliu/baoyu-skills', target: '_blank', rel: 'noopener noreferrer' }, 'baoyu-skills'),
        t('creditsPost')))
  }

  // 左栏：项目列表
  const nav = h('div', { className: 'pt-nav' },
    h('div', { className: 'pt-nav-head' },
      h('div', { className: 'pt-nav-titles' },
        h('h2', { className: 'pt-nav-title' }, 'Pictor'),
        h('p', { className: 'pt-nav-sub' }, t('tagline'))),
      h('button', { className: 'pt-nav-new', onClick: () => setView('new') }, t('newShort'))),
    h('div', { className: 'pt-nav-list' },
      projects.length === 0
        ? h('p', { style: { color: 'var(--dsw-alias-label-caption,#999)', fontSize: 13, padding: '12px 10px', margin: 0 } },
            t('noProjects'))
        : projects.map((p) => h('button', {
            key: p.id,
            className: 'pt-nav-item' + (selected === p.id && view === 'list' ? ' active' : ''),
            onClick: () => openProject(p.id),
            onContextMenu: (e) => { e.preventDefault(); removeProject(p.id) },
          },
            thumb[p.id]
              ? h('img', { className: 'thumb', src: thumb[p.id], alt: '' })
              : h('span', { className: 'thumb thumb-empty' },
                  h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
                    h('path', { d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z' }))),
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { className: 'name' }, p.title),
              h('div', { className: 'meta' }, stageLabelShort(p.stage) + (p.renderRunning ? ' · ' + t('rendering') : '')))))),
    h('div', { className: 'pt-nav-foot' },
      h('button', { className: 'pt-nav-settings', onClick: () => setView('settings') },
        h('span', { className: 'glyph' }, '⚙'),
        t('navSettings')),
      h(LangSwitch, null)))

  return h('div', { className: 'pt-root pt-workbench' },
    nav,
    h('div', { className: 'pt-main' }, body))
}

function stageLabelShort(stage) {
  return {
    prepared: '准备中', running: t('sRunning'), 'gated:meta': t('sMeta'),
    'gated:structure': t('sStruct'),
    'gated:advice': t('sAdvice'), done: t('sDone'),
  }[stage] || stage
}

// ---------- 入口 ----------

function parseStructures(structuresJson) {
  try {
    const data = JSON.parse(structuresJson || 'null')
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.structures)) return data.structures
    return []
  } catch {
    return []
  }
}

function parseProposals(proposalsJson) {
  try {
    const data = JSON.parse(proposalsJson || 'null')
    if (data && Array.isArray(data.proposals)) return data
    return null
  } catch {
    return null
  }
}

function selectedLabel(ids) {
  return ids.join('、')
}

function apply(ctx) {
  console.info('[dsh-pictor] apply 被调用', { hasSlots: Boolean(ctx && ctx.slots) })
  if (typeof document !== 'undefined') {
    const styleId = 'dsh-pictor-style'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = STYLE
      document.head.appendChild(style)
    }
  }
  const slots = ctx.slots || (ctx.get && ctx.get('slots'))
  if (!slots) return

  const panel = { open: false, subs: new Set() }
  panel.emit = () => { for (const fn of panel.subs) fn() }
  panel.toggle = () => { panel.open = !panel.open; panel.emit() }
  panel.close = () => { if (panel.open) { panel.open = false; panel.emit() } }
  panel.subscribe = (fn) => { panel.subs.add(fn); return () => { panel.subs.delete(fn) } }
  // 点选 dsh 左侧会话（或面板外任意处）自动收起工作台：
  // 只排除面板本身与 Pictor 启动按钮；侧栏会话此刻在面板左侧始终可点。
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', (e) => {
      if (!panel.open) return
      const t = e.target
      if (t && typeof t.closest === 'function' && (t.closest('.pt-shell-panel') || t.closest('.pt-footer-action'))) return
      panel.close()
    })
  }

  function usePanelOpen() {
    if (typeof React.useSyncExternalStore === 'function') {
      return React.useSyncExternalStore(panel.subscribe.bind(panel), () => panel.open)
    }
    const [v, setV] = React.useState(panel.open)
    React.useEffect(() => panel.subscribe(() => setV(panel.open)), [])
    return v
  }

  function WorkbenchPanel() {
    const open = usePanelOpen()
    // 透明隔条宽度 = dsh 侧栏（sidebarCol）当前实际宽度，随折叠/展开实时跟随，
    // 避免猜错宽度在会话区左缘留缝。
    const [sb, setSb] = React.useState(280)
    React.useEffect(() => {
      if (!open) return
      const el = document.querySelector('[class*="sidebarCol"]')
      if (!el) return
      const measure = () => {
        const w = Math.round(el.getBoundingClientRect().width)
        if (w > 0) setSb(w)
      }
      measure()
      if (typeof ResizeObserver === 'function') {
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
      }
      return undefined
    }, [open])
    // 恒挂载 + display 切换：关闭不卸载，重开恢复关闭前的界面
    return h('div', { className: 'pt-shell-root', style: open ? undefined : { display: 'none' } },
      h('div', { className: 'pt-shell-nav', style: { width: sb + 'px' } }),
      h('div', { className: 'pt-shell-panel' },
        h(Workbench, { ctx, key: 'shell' })))
  }

  function FooterAction() {
    useLang() // footer 文案随语言刷新
    const open = usePanelOpen()
    return h('div', {
      className: 'pt-footer-action' + (open ? ' on' : ''),
      role: 'button',
      tabIndex: 0,
      onClick: () => panel.toggle(),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panel.toggle() } },
      title: open ? t('close') : t('open'),
      'aria-expanded': open ? 'true' : 'false',
    }, h('span', { className: 'glyph' }, '◈'), 'Pictor')
  }

  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'dsh-pictor', order: 20, label: 'Pictor' },
    () => h(FooterAction, null),
  ))
  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-pictor', order: 10, label: 'Pictor' },
    () => h(WorkbenchPanel, null),
  ))
}
    return { inject, apply }
  }
})
