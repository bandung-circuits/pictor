# 调研：百炼（DashScope）可用文生图模型

状态：2026-09-01。起因：用户 IDE 选中 Claude Code 配置的 `ANTHROPIC_BASE_URL=https://dashscope.aliyuncs.com/apps/anthropic`，问该 baseUrl 能画图的模型。结论：Anthropic 兼容网关只做聊天，文生图在百炼另一套端点。全部事实来自官方文档全文抓取（alibabacloud.com/help/zh/model-studio/text-to-image），未用搜索摘要。

## 结论

1. `/apps/anthropic`（Anthropic 兼容网关）不提供图像生成；其上配置的 deepseek-v4-flash-0731 / glm-5.1 / glm-5.2 均为文本模型。
2. 百炼文生图模型的基址是 `https://dashscope.aliyuncs.com/api/v1`，认证为 DashScope API Key（Bearer），不是 Anthropic 网关。

## 可用文生图模型（官方「文本生成图像」页）

百炼文生图提供三系模型：

- 千问 Qwen-Image 系：qwen-image、qwen-image-plus、qwen-image-max、qwen-image-2.0、qwen-image-3.0、qwen-image-3.0-pro。3.0-pro 为旗舰，支持 prompt 智能改写，擅长文本渲染（图文物理材质的中英文）。qwen-image-max / -plus 仅支持 5 种固定分辨率，含 1664*928（16:9）。
- 万相 Wan 系：wan2.2、wan2.5-t2i-preview、wan2.6-t2i（纯文生图主力）、wan2.6-image、wan2.7-image、wan2.7-image-pro。2.7-image-pro 功能最全：组图生成、最高 4096x4096（仅纯文生图场景），增强五官控制、色彩控制、超长文字渲染。
- z-image 系：z-image、z-image-turbo。turbo 追求速度与性价比，擅高逼真人像与产品图。

## 端点形态（与 pictor 集成的关系）

- 请求端点：`/api/v1/services/aigc/image-generation/generation`（ImageGeneration 系）与 `/api/v1/services/aigc/multimodal-generation/generation`（Qwen-Image 走多模态系）。
- 结果：异步任务（`/api/v1/tasks/{id}` 轮询），图片经 OSS 签名 URL 返回；同步模式返回 b64_json。
- 与 pictor 现状：现有 provider 为 seedream（火山方舟）、gemini、openai-compatible（假设 `{base}/images/generations` 返回 b64_json）、mock。三系百炼模型均无法用 openai-compatible 直连，因为百炼图像端点形态不同（任务轮询/多模态）。如需接入，新增 `dashscope` provider：Auth=Bearer DashScope Key，POST 对应端点，同步或任务轮询取 b64。

## 核验来源

- https://www.alibabacloud.com/help/zh/model-studio/text-to-image（全文已抓，模型清单/选型/端点均出自此页）

## 2026-09-02 实测补充（连接与权限）

- openai-compatible 直连百炼**不可行**：`/api/v1/images/generations` 返回 404（百炼无此 OpenAI 兼容图像路径）。
- 正确原生端点：`POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`，`Authorization: Bearer <DSK>`，`X-DashScope-Async: disable`（同步出结果），体积 `parameters.size`（如 `1440*810` 等）；结果在 `output.results[0].url`（同步模式下亦可含 b64）。
- 实测（以某测试 key）：qwen-image-3.0-pro / qwen-image / wan2.6-t2i / wanx-v1 均 403 `Model.AccessDenied`（账号未开通模型访问）；wan2.1-t2i-turbo 400 `Model not exist`（端点/模型未对该 key 开放）。结论：**能否出图取决于账号在百炼控制台开通并购买对应模型**，与代码路径无关。
- 已实现 `dashscope` provider（原生端点、同步、url/b64 双取），设置页可选；未开通时报 403 错误会如实上抛（而非 404）。
- 实测响应结构（同步模式）：`output.choices[0].message.content[*]`，块内 `image` 为 OSS 签名 URL（或 `b64_image`），而非 `output.results`。解析器已按此修正；真实出图验证通过（qwen-image-3.0-pro，1024*1024，约 29s）。
