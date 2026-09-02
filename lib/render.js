import { readFileSync } from "node:fs";
import { join } from "node:path";
function renderPrompt(input, runDir) {
  const refs = (rel) => join(runDir, "references", "domain", rel);
  const base = readFileSync(refs("base-prompt.md"), "utf8");
  let layoutGuidelines = `\uFF08\u672A\u627E\u5230 ${input.suggestedLayout} \u7684 layout \u89C4\u8303\u6587\u4EF6\uFF0C\u4EC5\u6309\u540D\u79F0\u4F7F\u7528\uFF09`;
  try {
    layoutGuidelines = readFileSync(refs(`layouts/${input.suggestedLayout}.md`), "utf8");
  } catch {
  }
  let styleGuidelines = `\uFF08\u672A\u627E\u5230 ${input.suggestedStyle} \u7684 style \u89C4\u8303\u6587\u4EF6\uFF0C\u4EC5\u6309\u540D\u79F0\u4F7F\u7528\uFF09`;
  try {
    styleGuidelines = readFileSync(refs(`styles/${input.suggestedStyle}.md`), "utf8");
  } catch {
  }
  const aspect = input.aspectRatio || "16:9";
  const lang = input.language || "English";
  const textLabels = [
    `Communicative intent: ${input.communicativeIntent}`,
    `Suggested layout: ${input.suggestedLayout}`,
    input.estimatedComplexity ? `Estimated complexity: ${input.estimatedComplexity}` : void 0
  ].filter(Boolean).join("\n");
  const prompt = base.replaceAll("{{LAYOUT}}", input.suggestedLayout).replaceAll("{{STYLE}}", input.suggestedStyle).replaceAll("{{ASPECT_RATIO}}", aspect).replaceAll("{{LANGUAGE}}", lang).replaceAll("{{LAYOUT_GUIDELINES}}", layoutGuidelines).replaceAll("{{STYLE_GUIDELINES}}", styleGuidelines).replaceAll("{{CONTENT}}", input.sourceText).replaceAll("{{TEXT_LABELS}}", textLabels);
  return { prompt, textLabels };
}
export {
  renderPrompt
};
