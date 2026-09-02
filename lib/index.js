import { homedir } from "node:os";
import { join, dirname } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  cpSync,
  renameSync,
  existsSync,
  statSync,
  rmSync,
  appendFileSync
} from "node:fs";
import { fileURLToPath } from "node:url";
import { createImageProvider } from "./image-providers.js";
import { renderPrompt } from "./render.js";
const name = "dsh-pictor";
const inject = ["connection", "webServer"];
const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..");
const TITLE_MAX = 30;
const DEFAULT_KEY_REF = "PICTOR_IMAGE_API_KEY";
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function firstLine(text) {
  const line = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split("\n")[0] || "";
  const out = line.slice(0, TITLE_MAX);
  return line.length > TITLE_MAX ? out + "\u2026" : out;
}
function sanitizeFilename(name2) {
  const base = String(name2 || "").split(/[\\/]/).pop() || "";
  return base.replace(/[^\w.\-一-鿿 ()（）]/g, "_").slice(0, 200) || "document";
}
function scrubHtml(html) {
  let out = String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").replace(/<object[\s\S]*?<\/object>/gi, "").replace(/<embed[\s\S]*?>/gi, "").replace(/\son\w+\s*=\s*/gi, " data-disabled=").replace(/(\shref\s*=\s*["']?)\s*javascript:[^"' >]*/gi, "$1#");
  return out;
}
function stageOf(projectDir) {
  if (!existsSync(join(projectDir, "10.input", "document.md"))) {
    if (hasSource(projectDir)) return "running";
    return "prepared";
  }
  if (readdirSafe(join(projectDir, "output")).some((f) => f.endsWith(".png"))) return "done";
  if (existsSync(join(projectDir, "12.advice", "proposals.json"))) return "gated:advice";
  if (existsSync(join(projectDir, "11.extraction", "structures.json"))) return "gated:structure";
  if (existsSync(join(projectDir, "10.input", "meta.json"))) {
    if (existsSync(join(projectDir, "10.input", "meta.confirmed"))) return "running";
    return "gated:meta";
  }
  if (existsSync(join(projectDir, "10.input", "document.md"))) return "running";
  return "gated:meta";
}
function hasSource(dir) {
  try {
    return readdirSync(join(dir, "10.input")).some((f) => f !== "document.md");
  } catch {
    return false;
  }
}
function readdirSafe(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}
function initialPrompt(dir) {
  const doc = "10.input/document.md";
  const ext = "11.extraction";
  const adv = "12.advice";
  const hasDoc = existsSync(join(dir, doc));
  const hasStructures = existsSync(join(dir, ext, "structures.json"));
  const hasProposals = existsSync(join(dir, adv, "proposals.json"));
  const hasMeta = existsSync(join(dir, "10.input", "meta.json"));
  const prompts = [
    "\u4F60\u662F Pictor \u7F16\u6392\u5668\uFF0C\u8FD0\u884C\u5728 DeepSeek Harness \u667A\u80FD\u8FD0\u884C\u65F6\u4E2D\u3002",
    "\u5DE5\u4F5C\u76EE\u5F55\uFF08\u4F60\u6240\u6709\u76F8\u5BF9\u8DEF\u5F84\u7684\u951A\u70B9\uFF09\u4E3A\u9879\u76EE\u76EE\u5F55\uFF1A" + dir + "\u3002\u8BE5\u76EE\u5F55\u4F4D\u4E8E\u4F1A\u8BDD\u6C99\u7BB1\u5185\uFF0C\u53EF\u81EA\u7531\u8BFB\u5199\u3002",
    "\u84DD\u56FE\u4E0E\u53C2\u8003\u8D44\u4EA7\u5DF2\u6302\u8F7D\u4E8E " + dir + "/agents/ \u4E0E " + dir + "/references/\u3002",
    "\u9879\u76EE\u72B6\u6001\u4EE5\u6587\u4EF6\u4E8B\u5B9E\u4E3A\u51C6\uFF0C\u8BF7\u5148\u8BFB\u53D6\u518D\u884C\u52A8\uFF1A"
  ];
  if (!hasDoc) {
    prompts.push(
      "- \u8F93\u5165\u6587\u6863\u5C31\u4F4D\u65B9\u5F0F\uFF1A\u8BFB\u53D6 10.input/ \u4E0B\u7684\u539F\u59CB\u6765\u6E90\uFF08\u4E0A\u4F20\u6587\u4EF6\u6216 source.html\uFF09\uFF0C\u5FC5\u8981\u65F6\u7528\u4F60\u7684\u6587\u6863\u5DE5\u5177\u8F6C\u6362\uFF0C",
      "  \u89C4\u8303\u5316\u4E3A " + doc + "\u3002\u5B8C\u6210\u540E\u518D\u8FDB\u5165\u63D0\u53D6\u9636\u6BB5\u3002"
    );
  }
  if (hasDoc && !hasMeta) {
    prompts.push("- \u6587\u6863\u5DF2\u5C31\u4F4D\u4F46\u5C1A\u672A\u6709 10.input/meta.json\uFF1A\u5148\u63D0\u70BC\u6587\u6863\u7684\u82F1\u6587\u6807\u9898\u4E0E\u4E00\u53E5\u8BDD\u82F1\u6587\u6458\u8981\uFF0C\u5199\u5165 10.input/meta.json\uFF0C\u7136\u540E\u505C\u4E0B\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u6587\u6863\u4FE1\u606F\uFF08\u95E8\u63A7 0\uFF09\uFF0C\u4E0D\u8981\u5F00\u59CB\u63D0\u53D6\u3002");
  }
  if (hasMeta && !hasStructures) {
    prompts.push("- \u6587\u6863\u4FE1\u606F\u5DF2\u786E\u8BA4\uFF0C\u5C1A\u672A\u6709\u7ED3\u6784\u4EA7\u7269\uFF1A\u5F00\u59CB\u63D0\u53D6\u9636\u6BB5\uFF08\u9605\u8BFB agents/10.orchestrator.md \u6309\u89C4\u5B9A\u6267\u884C\uFF09\u3002");
  }
  if (hasStructures && !hasProposals) {
    prompts.push("- \u5DF2\u5B58\u5728 " + ext + "/structures.json\uFF1A\u8FD9\u662F\u7528\u6237\u786E\u8BA4\u8FC7\u7684\u7ED3\u6784\u4EA7\u7269\uFF0C\u7EDD\u4E0D\u91CD\u65B0\u63D0\u53D6\uFF0C\u5411\u7528\u6237\u6C47\u62A5\u5019\u9009\u6E05\u5355\u5E76\u7B49\u5F85\u6307\u793A\u3002");
  }
  if (hasProposals) {
    prompts.push("- \u5DF2\u5B58\u5728 " + adv + "/proposals.json\uFF1A\u8FD9\u662F\u5DF2\u751F\u6210\u7684\u65B9\u6848\u4EA7\u7269\uFF0C\u7EDD\u4E0D\u91CD\u65B0\u751F\u6210\uFF0C\u7B49\u5F85\u7528\u6237\u9009\u62E9\u65B9\u6848\u3002");
  }
  prompts.push(
    "",
    "\u9605\u8BFB agents/10.orchestrator.md \u5E76\u4E25\u683C\u6309\u84DD\u56FE\u6267\u884C\uFF08\u5C24\u5176\u300C\u63A8\u8FDB\u4E0E\u95E8\u63A7\u7EAA\u5F8B\u300D\uFF09\u3002\u9075\u5B88\u53CC\u901A\u9053\u8F93\u5165\u7EAA\u5F8B\u4E0E subagent \u8C03\u7528\u89C4\u8303\u3002",
    "\u505C\u70B9\u7EAA\u5F8B\uFF1A\u4E09\u4E2A\u95E8\u63A7\uFF08\u4FE1\u606F\u786E\u8BA4\u3001\u7ED3\u6784\u786E\u8BA4\u3001\u65B9\u6848\u786E\u8BA4\uFF09\u9700\u8981\u505C\u4E0B\u7B49\u5F85\u7528\u6237\uFF1B\u5176\u4F59\u73AF\u8282\uFF08\u83B7\u53D6\u6587\u6863\u3001\u63D0\u53D6\u7ED3\u6784\u3001\u751F\u6210\u65B9\u6848\uFF09\u81EA\u52A8\u63A8\u8FDB\uFF0C\u4E2D\u9014\u4E0D\u8BBE\u505C\u70B9\u3002"
  );
  return prompts.join("\n");
}
function apply(ctx, config = {}) {
  const connection = ctx.connection;
  const base = config.dataDir || process.env.PICTOR_HOME || join(homedir(), ".pictor");
  const INDEX_JSON = join(base, "index.json");
  const CONFIG_JSON = join(base, "pictor-config.json");
  mkdirSync(base, { recursive: true });
  ensureIndex();
  function ensureIndex() {
    if (!existsSync(INDEX_JSON)) {
      writeFileSync(INDEX_JSON, JSON.stringify({ projects: [] }, null, 2));
    }
  }
  function readProjects() {
    try {
      const parsed = JSON.parse(readFileSync(INDEX_JSON, "utf8"));
      const list = Array.isArray(parsed.projects) ? parsed.projects : [];
      return list;
    } catch {
      return [];
    }
  }
  function saveProjects(list) {
    const tmp = INDEX_JSON + ".tmp";
    writeFileSync(tmp, JSON.stringify({ projects: list }, null, 2));
    renameSync(tmp, INDEX_JSON);
  }
  function findProject(id) {
    return readProjects().find((p) => p.id === id);
  }
  function projectDir(id) {
    return join(base, id);
  }
  function nextProjectId() {
    const ymd = now().slice(0, 10).replace(/-/g, "");
    const seq = readProjects().filter((p) => p.id.startsWith(ymd)).length + 1;
    return `${ymd}-${String(seq).padStart(3, "0")}`;
  }
  function logError(tag, e) {
    try {
      appendFileSync(join(base, "host-error.log"), `${now()} [${tag}] ${String(e?.message || e)}
`);
    } catch {
    }
  }
  async function isAgentAlive(sid) {
    if (!sid) return null;
    try {
      const agents = ctx.get?.("agents");
      const registryKnown = agents && typeof agents.get === "function";
      const a = registryKnown ? agents.get(sid) : null;
      if (a && a.status === "running") return true;
      const subs = ctx.get?.("subagents");
      if (subs && typeof subs.listChildren === "function") {
        try {
          const rows = await subs.listChildren(sid);
          if (Array.isArray(rows) && rows.some((r) => r && r.activity === "running")) return true;
        } catch {
        }
      }
      return registryKnown ? Boolean(a && a.status === "running") : null;
    } catch {
      return null;
    }
  }
  function credentialsService() {
    try {
      return ctx.credentials || ctx.get?.("credentials");
    } catch {
      return null;
    }
  }
  function readImageConfig() {
    try {
      const parsed = JSON.parse(readFileSync(CONFIG_JSON, "utf8"));
      const image = parsed.image || {};
      return {
        provider: String(image.provider || "seedream"),
        baseUrl: String(image.baseUrl || ""),
        model: String(image.model || ""),
        aspectRatio: String(image.aspectRatio || "16:9"),
        apiKeyRef: String(image.apiKeyRef || ""),
        apiKey: image.apiKey !== void 0 ? String(image.apiKey) : void 0,
        extra: image.extra && typeof image.extra === "object" ? image.extra : {}
      };
    } catch {
      return { provider: "seedream", aspectRatio: "16:9", extra: {} };
    }
  }
  function writeImageConfig(cfg) {
    const current = readImageConfig();
    const merged = { ...current, ...cfg };
    if (!cfg.apiKeyRef) merged.apiKeyRef = current.apiKeyRef || "";
    writeFileSync(CONFIG_JSON, JSON.stringify({ image: merged }, null, 2));
  }
  function keyStorage() {
    const creds = credentialsService();
    return creds && typeof creds.set === "function" ? "seam" : "file";
  }
  async function hasApiKey() {
    const cfg = readImageConfig();
    if (cfg.apiKey) return true;
    if (!cfg.apiKeyRef) return false;
    const creds = credentialsService();
    if (!creds || typeof creds.describe !== "function") return false;
    try {
      const info = await creds.describe(cfg.apiKeyRef);
      return Boolean(info && info.configured);
    } catch {
      return false;
    }
  }
  async function resolveApiKey() {
    const cfg = readImageConfig();
    if (cfg.apiKey) return cfg.apiKey;
    if (!cfg.apiKeyRef) return "";
    const creds = credentialsService();
    if (!creds || typeof creds.resolve !== "function") return "";
    try {
      const r = await creds.resolve(cfg.apiKeyRef);
      return r && r.value ? String(r.value) : "";
    } catch {
      return "";
    }
  }
  async function storeApiKey(value, ref) {
    const cfg = readImageConfig();
    const keyRef = ref && ref.trim() || cfg.apiKeyRef || DEFAULT_KEY_REF;
    const creds = credentialsService();
    if (creds && typeof creds.set === "function") {
      await creds.set(keyRef, value);
      writeImageConfig({ ...cfg, apiKeyRef: keyRef, apiKey: "" });
      return;
    }
    writeImageConfig({ ...cfg, apiKeyRef: keyRef, apiKey: value });
  }
  async function createProject(title, file, html) {
    const id = nextProjectId();
    const dir = projectDir(id);
    for (const sub of ["10.input", "11.extraction", "12.advice", "output"]) {
      mkdirSync(join(dir, sub), { recursive: true });
    }
    const agentsSrc = join(PLUGIN_ROOT, "agents");
    if (existsSync(agentsSrc)) cpSync(agentsSrc, join(dir, "agents"), { recursive: true });
    const refSrc = join(PLUGIN_ROOT, "references", "domain");
    if (existsSync(refSrc)) cpSync(refSrc, join(dir, "references", "domain"), { recursive: true });
    let derivedTitle = "";
    if (file && file.dataUrl) {
      const name2 = sanitizeFilename(file.name || "document");
      const buf = Buffer.from(String(file.dataUrl).replace(/^data:[^;]*;base64,/, ""), "base64");
      writeFileSync(join(dir, "10.input", name2), buf);
      derivedTitle = name2.replace(/\.[^.]+$/, "");
    } else if (html) {
      const scrubbed = scrubHtml(html);
      writeFileSync(join(dir, "10.input", "source.html"), scrubbed);
      derivedTitle = firstLine(scrubbed);
    } else {
      throw new Error("project.create: \u9700\u8981\u6587\u4EF6\u6216\u7C98\u8D34\u5185\u5BB9");
    }
    const record = {
      id,
      title: title && title.trim() || derivedTitle || "\u672A\u547D\u540D\u9879\u76EE",
      createdAt: now(),
      updatedAt: now()
    };
    const list = readProjects();
    list.unshift(record);
    saveProjects(list);
    return record;
  }
  function touch(id) {
    const list = readProjects();
    const p = list.find((x) => x.id === id);
    if (p) {
      p.updatedAt = now();
      saveProjects(list);
    }
  }
  async function composePrompt(record, message) {
    const live = record.sessionId ? await isAgentAlive(record.sessionId) : null;
    if (live === true) return message;
    return initialPrompt(projectDir(record.id)) + "\n\n" + message;
  }
  function listFiles(dir) {
    const out = [];
    const walk = (p, prefix) => {
      for (const e of readdirSafe(p)) {
        const full = join(p, e);
        const rel = prefix ? `${prefix}/${e}` : e;
        try {
          const st = statSync(full);
          if (st.isDirectory()) walk(full, rel);
          else out.push(rel);
        } catch {
          out.push(rel);
        }
      }
    };
    walk(dir, "");
    return out.sort();
  }
  function readJsonSafe(file) {
    try {
      return readFileSync(file, "utf8");
    } catch {
      return "";
    }
  }
  const renderJobs = /* @__PURE__ */ new Map();
  function readRenderHistory(id) {
    try {
      const raw = readJsonSafe(join(projectDir(id), "12.advice", "render-history.json"));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function writeRenderHistory(id, hist) {
    const f = join(projectDir(id), "12.advice", "render-history.json");
    const tmp = f + ".tmp";
    writeFileSync(tmp, JSON.stringify(hist, null, 2));
    renameSync(tmp, f);
  }
  function readRenderState(id) {
    try {
      const raw = readJsonSafe(join(projectDir(id), "12.advice", "render.json"));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeRenderState(id, state) {
    const f = join(projectDir(id), "12.advice", "render.json");
    const tmp = f + ".tmp";
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, f);
  }
  function updateRenderState(id, fn) {
    const st = readRenderState(id) || { renderId: "", startedAt: "", proposals: {}, errors: {} };
    fn(st);
    writeRenderState(id, st);
  }
  async function runRenderBatch(id, picks, seq, opts) {
    const dir = projectDir(id);
    const { ratios, ov, proposals, cfg, apiKey } = opts;
    const provider = createImageProvider(cfg.provider || "mock", {
      baseUrl: cfg.baseUrl,
      apiKey,
      model: cfg.model,
      extra: cfg.extra
    });
    mkdirSync(join(dir, "output"), { recursive: true });
    for (const prop of picks) {
      const pid = String(prop.id);
      const base2 = `${pid}-${seq}`;
      const ratio = String(ratios[pid] || "16:9");
      const ovP = ov[pid] && typeof ov[pid] === "object" ? ov[pid] : {};
      const usedLayout = String(ovP.layout || prop.suggested_layout || "dashboard");
      const usedStyle = String(ovP.style || prop.suggested_style || proposals.suggested_style || "corporate-memphis");
      updateRenderState(id, (st) => {
        st.proposals[pid] = "running";
      });
      try {
        const { prompt } = renderPrompt({
          sourceText: String(prop.source_text || ""),
          communicativeIntent: String(prop.communicative_intent || ""),
          suggestedLayout: usedLayout,
          suggestedStyle: usedStyle,
          estimatedComplexity: prop.estimated_complexity ? String(prop.estimated_complexity) : void 0,
          aspectRatio: ratio,
          language: "English"
        }, dir);
        writeFileSync(join(dir, `${base2}-prompt.md`), prompt + "\n");
        const img = await provider.generateImage(prompt, ratio);
        if (!img) throw new Error("provider \u672A\u8FD4\u56DE\u56FE\u50CF");
        writeFileSync(join(dir, "output", `${base2}.png`), Buffer.from(img.data, "base64"));
        updateRenderState(id, (st) => {
          st.proposals[pid] = "done";
        });
      } catch (e) {
        const msg = String(e?.message || e);
        updateRenderState(id, (st) => {
          st.proposals[pid] = "error";
          st.errors[pid] = msg;
        });
      }
    }
    updateRenderState(id, (st) => {
      st.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    });
    const hist = readRenderHistory(id);
    if (hist.length) hist[0].finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeRenderHistory(id, hist);
    renderJobs.delete(id);
  }
  async function handle(endpoint, payload) {
    switch (endpoint) {
      case "config.get": {
        const cfg = readImageConfig();
        return {
          dataRoot: base,
          image: {
            provider: cfg.provider,
            baseUrl: cfg.baseUrl || "",
            model: cfg.model || "",
            aspectRatio: cfg.aspectRatio || "16:9",
            apiKeyRef: cfg.apiKeyRef || "",
            hasKey: await hasApiKey(),
            keyStorage: keyStorage(),
            extra: cfg.extra || {}
          },
          styles: listRefs("styles"),
          layouts: listRefs("layouts")
        };
      }
      case "config.set": {
        const patch = payload?.image || {};
        let extra = void 0;
        if (patch.extra !== void 0) {
          const raw = typeof patch.extra === "string" ? patch.extra.trim() : "";
          if (raw === "") extra = {};
          else {
            try {
              extra = JSON.parse(raw);
            } catch {
              throw new Error("\u989D\u5916\u8BF7\u6C42\u53C2\u6570\u5FC5\u987B\u662F\u5408\u6CD5 JSON \u5BF9\u8C61");
            }
          }
        }
        writeImageConfig({
          provider: String(patch.provider || readImageConfig().provider),
          baseUrl: String(patch.baseUrl ?? readImageConfig().baseUrl ?? ""),
          model: String(patch.model ?? readImageConfig().model ?? ""),
          aspectRatio: String(patch.aspectRatio ?? readImageConfig().aspectRatio ?? "16:9"),
          apiKeyRef: String(patch.apiKeyRef ?? readImageConfig().apiKeyRef ?? ""),
          ...extra !== void 0 ? { extra } : {}
        });
        if (patch.apiKey) {
          await storeApiKey(String(patch.apiKey), patch.apiKeyRef);
        }
        const cfg = readImageConfig();
        return {
          image: {
            provider: cfg.provider,
            baseUrl: cfg.baseUrl || "",
            model: cfg.model || "",
            aspectRatio: cfg.aspectRatio || "16:9",
            apiKeyRef: cfg.apiKeyRef || "",
            hasKey: await hasApiKey(),
            keyStorage: keyStorage(),
            extra: cfg.extra || {}
          }
        };
      }
      case "config.test": {
        const cfg = readImageConfig();
        const provider = createImageProvider(cfg.provider || "mock", {
          baseUrl: cfg.baseUrl,
          apiKey: await resolveApiKey(),
          model: cfg.model,
          extra: cfg.extra
        });
        const img = await provider.generateImage("A simple solid-color test card with two words.", cfg.aspectRatio || "16:9");
        if (!img) throw new Error("config.test: provider \u672A\u8FD4\u56DE\u56FE\u50CF");
        return { ok: true, bytes: img.data.length, size: `${Math.round(img.data.length / 1024)}KB` };
      }
      case "project.create": {
        const title = payload?.title ? String(payload.title) : void 0;
        const file = payload?.file;
        const html = payload?.html !== void 0 ? String(payload.html) : void 0;
        const record = await createProject(title, file, html);
        return { id: record.id, title: record.title, stage: stageOf(projectDir(record.id)), prompt: initialPrompt(projectDir(record.id)) };
      }
      case "project.list": {
        const items = readProjects().map((p) => {
          const dir = projectDir(p.id);
          return {
            ...p,
            stage: stageOf(dir),
            running: false,
            renderRunning: renderJobs.has(p.id),
            outputs: readdirSafe(join(dir, "output")).filter((f) => f.endsWith(".png")),
            structuresCount: existsSync(join(dir, "11.extraction", "structures.json")) ? countOf(readJsonSafe(join(dir, "11.extraction", "structures.json")), "structures") : 0,
            proposalsCount: existsSync(join(dir, "12.advice", "proposals.json")) ? countOf(readJsonSafe(join(dir, "12.advice", "proposals.json")), "proposals") : 0
          };
        });
        return { projects: items };
      }
      case "project.get": {
        const id = String(payload?.id || "");
        const record = findProject(id);
        if (!record) throw new Error(`project.get: \u672A\u77E5\u9879\u76EE ${id}`);
        const dir = projectDir(id);
        const running = record.sessionId ? await isAgentAlive(record.sessionId) : null;
        const inputFiles = readdirSafe(join(dir, "10.input"));
        return {
          record: { ...record, stage: stageOf(dir) },
          files: listFiles(dir),
          structuresJson: readJsonSafe(join(dir, "11.extraction", "structures.json")),
          proposalsJson: readJsonSafe(join(dir, "12.advice", "proposals.json")),
          outputs: readdirSafe(join(dir, "output")).filter((f) => f.endsWith(".png")),
          running: running === true,
          prompts: readdirSafe(dir).filter((f) => f.endsWith("-prompt.md")),
          document: readJsonSafe(join(dir, "10.input", "document.md")),
          sourceName: inputFiles.find((f) => f !== "document.md") || null,
          meta: parseJsonSafe(join(dir, "10.input", "meta.json")),
          metaConfirmed: existsSync(join(dir, "10.input", "meta.confirmed")),
          overrides: parseJsonSafe(join(dir, "12.advice", "overrides.json")) || {},
          renderState: readRenderState(id),
          renderRunning: renderJobs.has(id),
          renderBatches: readRenderHistory(id)
        };
      }
      case "project.saveOverrides": {
        const id = String(payload?.id || "");
        const dir = projectDir(id);
        if (!findProject(id)) throw new Error(`project.saveOverrides: \u672A\u77E5\u9879\u76EE ${id}`);
        const ov = payload?.overrides && typeof payload.overrides === "object" ? payload.overrides : {};
        const clean = {};
        for (const [pid, v] of Object.entries(ov)) {
          if (!v || typeof v !== "object") continue;
          const c = {};
          if (v.layout) c.layout = String(v.layout);
          if (v.style) c.style = String(v.style);
          if (v.aspectRatio) c.aspectRatio = String(v.aspectRatio);
          if (Object.keys(c).length) clean[String(pid)] = c;
        }
        writeFileSync(join(dir, "12.advice", "overrides.json"), JSON.stringify(clean, null, 2));
        touch(id);
        return { ok: true, count: Object.keys(clean).length };
      }
      case "project.patchStructures": {
        const id = String(payload?.id || "");
        const dir = projectDir(id);
        if (!findProject(id)) throw new Error(`project.patchStructures: \u672A\u77E5\u9879\u76EE ${id}`);
        const list = Array.isArray(payload?.structures) ? payload.structures : [];
        if (!list.length) throw new Error("project.patchStructures: structures \u4E3A\u7A7A");
        const cleaned = list.map((s, i) => ({
          ...s,
          id: String(s && (s.id || i + 1)),
          title: String(s?.title || s?.description || `\u7ED3\u6784 ${i + 1}`),
          type: s?.type ? String(s.type) : "",
          description: s?.description ? String(s.description) : ""
        }));
        writeFileSync(join(dir, "11.extraction", "structures.json"), JSON.stringify({ structures: cleaned }, null, 2));
        touch(id);
        return { ok: true, count: cleaned.length };
      }
      case "project.saveMeta": {
        const id = String(payload?.id || "");
        const dir = projectDir(id);
        if (!findProject(id)) throw new Error(`project.saveMeta: \u672A\u77E5\u9879\u76EE ${id}`);
        const title = String(payload?.title || "");
        const summary = String(payload?.summary || "");
        writeFileSync(join(dir, "10.input", "meta.json"), JSON.stringify({ document_title: title, document_summary: summary }, null, 2));
        const t = title.trim();
        if (t) {
          const list = readProjects();
          const p = list.find((x) => x.id === id);
          if (p && p.title !== t) {
            p.title = t;
            saveProjects(list);
          }
        }
        touch(id);
        return { ok: true };
      }
      case "project.confirmMeta": {
        const id = String(payload?.id || "");
        const dir = projectDir(id);
        if (!findProject(id)) throw new Error(`project.confirmMeta: \u672A\u77E5\u9879\u76EE ${id}`);
        writeFileSync(join(dir, "10.input", "meta.confirmed"), now());
        touch(id);
        return { ok: true };
      }
      case "project.rename": {
        const id = String(payload?.id || "");
        const title = String(payload?.title || "").trim();
        if (!title) throw new Error("project.rename: \u6807\u9898\u4E3A\u7A7A");
        const list = readProjects();
        const p = list.find((x) => x.id === id);
        if (!p) throw new Error(`project.rename: \u672A\u77E5\u9879\u76EE ${id}`);
        p.title = title;
        saveProjects(list);
        return { ok: true };
      }
      case "project.attach": {
        const id = String(payload?.id || "");
        const sessionId = String(payload?.sessionId || "");
        const list = readProjects();
        const p = list.find((x) => x.id === id);
        if (!p) throw new Error(`project.attach: \u672A\u77E5\u9879\u76EE ${id}`);
        p.sessionId = sessionId || void 0;
        saveProjects(list);
        return { ok: true };
      }
      case "project.prompt": {
        const id = String(payload?.id || "");
        const message = String(payload?.message || "");
        if (!message.trim()) throw new Error("project.prompt: \u6D88\u606F\u4E3A\u7A7A");
        const record = findProject(id);
        if (!record) throw new Error(`project.prompt: \u672A\u77E5\u9879\u76EE ${id}`);
        const live = record.sessionId ? await isAgentAlive(record.sessionId) : null;
        return { ok: true, prompt: await composePrompt(record, message), sessionId: record.sessionId || null, live: live === true };
      }
      case "project.render": {
        const id = String(payload?.id || "");
        const dir = projectDir(id);
        if (!findProject(id)) throw new Error(`project.render: \u672A\u77E5\u9879\u76EE ${id}`);
        if (renderJobs.has(id)) throw new Error("project.render: \u5DF2\u6709\u6E32\u67D3\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u7A0D\u5019");
        if (!existsSync(join(dir, "12.advice", "proposals.json"))) {
          throw new Error("project.render: \u5C1A\u672A\u751F\u6210 proposals.json");
        }
        const proposals = JSON.parse(readFileSync(join(dir, "12.advice", "proposals.json"), "utf8"));
        const all = Array.isArray(proposals.proposals) ? proposals.proposals : [];
        const want = Array.isArray(payload?.proposalIds) && payload.proposalIds.length ? new Set(payload.proposalIds.map(String)) : null;
        const picks = want ? all.filter((p) => want.has(String(p.id))) : all;
        if (!picks.length) throw new Error("project.render: \u6CA1\u6709\u8981\u6E32\u67D3\u7684\u65B9\u6848");
        const ratios = payload?.aspectRatios && typeof payload.aspectRatios === "object" ? payload.aspectRatios : {};
        const ov = payload?.overrides && typeof payload.overrides === "object" ? payload.overrides : {};
        const cfg = readImageConfig();
        const apiKey = await resolveApiKey();
        const renderId = `${id}-${Date.now()}`;
        writeRenderState(id, {
          renderId,
          startedAt: (/* @__PURE__ */ new Date()).toISOString(),
          proposals: Object.fromEntries(picks.map((p) => [String(p.id), "pending"])),
          errors: {}
        });
        renderJobs.set(id, { renderId, startedAt: Date.now() });
        const hist = readRenderHistory(id);
        const seq = hist.reduce((m, b) => Math.max(m, Number(b.seq) || 0), 0) + 1;
        const files = picks.map((p) => `${String(p.id)}-${seq}.png`);
        hist.unshift({
          batchId: renderId,
          seq,
          startedAt: (/* @__PURE__ */ new Date()).toISOString(),
          proposals: picks.map((p) => String(p.id)),
          outputs: files
        });
        writeRenderHistory(id, hist);
        void runRenderBatch(id, picks, seq, { ratios, ov, proposals, cfg, apiKey });
        touch(id);
        return { ok: true, started: true, renderId };
      }
      case "project.image": {
        const id = String(payload?.id || "");
        let name2 = String(payload?.name || "");
        if (!name2 || name2.includes("/") || name2.includes("..")) {
          throw new Error("project.image: \u975E\u6CD5\u6587\u4EF6\u540D");
        }
        const buf = readFileSync(join(projectDir(id), "output", name2));
        return { dataUrl: `data:image/png;base64,${buf.toString("base64")}` };
      }
      case "project.pulse": {
        const id = String(payload?.id || "");
        const record = findProject(id);
        if (!record) throw new Error(`project.pulse: \u672A\u77E5\u9879\u76EE ${id}`);
        const running = record.sessionId ? await isAgentAlive(record.sessionId) : null;
        return { running: running === true, stage: stageOf(projectDir(id)) };
      }
      case "project.delete": {
        const id = String(payload?.id || "");
        if (!findProject(id)) throw new Error(`project.delete: \u672A\u77E5\u9879\u76EE ${id}`);
        rmSync(projectDir(id), { recursive: true, force: true });
        saveProjects(readProjects().filter((p) => p.id !== id));
        return { ok: true, id };
      }
      default:
        throw new Error(`dsh-pictor: \u672A\u77E5\u7AEF\u70B9 ${endpoint}`);
    }
  }
  if (connection && connection.rpc && connection.rpc.handle) {
    connection.rpc.handle("/pictor", async (endpoint, payload) => {
      try {
        return { ok: true, value: await handle(endpoint, payload || {}) };
      } catch (e) {
        logError(`rpc:${endpoint}`, e);
        return { ok: false, error: { code: "internal", message: String(e?.message || e), details: {} } };
      }
    }, { authority: "loopback" });
  }
  const wsA = ctx.webServer || ctx.get?.("webServer");
  if (wsA && typeof wsA.register === "function") {
    const IMG_CACHE = { "content-type": "image/png", "cache-control": "public, max-age=3600" };
    const WEBP_CACHE = { "content-type": "image/webp", "cache-control": "public, max-age=3600" };
    wsA.register({ kind: "exact", path: "/pictor/asset/empty-state.png", handler: (_req, res) => {
      res.writeHead(200, IMG_CACHE);
      res.end(readFileSync(join(PLUGIN_ROOT, "assets", "empty-state.png")));
    } });
    for (const kind of ["styles", "layouts"]) {
      for (const name2 of readdirSafe(join(PLUGIN_ROOT, "assets", "previews", kind)).filter((f) => f.endsWith(".webp"))) {
        wsA.register({ kind: "exact", path: `/pictor/preview/${kind}/${name2}`, handler: (_req, res) => {
          res.writeHead(200, WEBP_CACHE);
          res.end(readFileSync(join(PLUGIN_ROOT, "assets", "previews", kind, name2)));
        } });
      }
    }
  }
  return { dataRoot: base };
}
function countOf(json, key) {
  try {
    const data = JSON.parse(json);
    if (key === "structures") {
      if (Array.isArray(data)) return data.length;
      if (data && Array.isArray(data.structures)) return data.structures.length;
    } else {
      if (data && Array.isArray(data.proposals)) return data.proposals.length;
    }
    return 0;
  } catch {
    return 0;
  }
}
function listRefs(kind) {
  const dir = join(PLUGIN_ROOT, "references", "domain", kind);
  return readdirSafe(dir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")).sort();
}
function parseJsonSafe(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
const _test = { firstLine, sanitizeFilename, scrubHtml, countOf, listRefs };
export {
  _test,
  apply,
  inject,
  name
};
