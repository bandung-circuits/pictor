#!/usr/bin/env bash
# Gemini 图像生成脚本
# 用法: ./scripts/gemini-image.sh <prompt_file> <output_file>
#
# 参数:
#   prompt_file  - 包含完整 prompt 文本的文件路径
#   output_file  - 输出 PNG 图片的文件路径
#
# 环境变量:
#   GEMINI_API_KEY  - 必需
#   GEMINI_MODEL    - 可选，默认 gemini-2.0-flash-preview-image-generation

set -euo pipefail

PROMPT_FILE="$1"
OUTPUT_FILE="$2"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "ERROR: GEMINI_API_KEY not set" >&2
  exit 1
fi

MODEL="${GEMINI_MODEL:-gemini-2.0-flash-preview-image-generation}"
URL="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent"

# 读取 prompt 并构建请求 JSON
PROMPT_TEXT=$(cat "$PROMPT_FILE")
REQUEST_JSON=$(python3 -c "
import json, sys
prompt = sys.stdin.read()
print(json.dumps({
    'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
    'generationConfig': {
        'responseModalities': ['IMAGE'],
        'imageConfig': {'imageSize': '1K'}
    }
}))
" <<< "$PROMPT_TEXT")

# 调用 API（失败重试一次）
call_api() {
  curl -s -w "\n%{http_code}" "$URL" \
    -H "x-goog-api-key: ${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_JSON"
}

RESPONSE=$(call_api)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "WARN: API returned $HTTP_CODE, retrying in 10s..." >&2
  sleep 10
  RESPONSE=$(call_api)
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
fi

if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "ERROR: API returned $HTTP_CODE" >&2
  echo "$BODY" >&2
  exit 1
fi

# 解析响应，提取 base64 图片并写入文件
echo "$BODY" | python3 -c "
import sys, json, base64
resp = json.load(sys.stdin)
for c in resp.get('candidates', []):
    for p in c.get('content', {}).get('parts', []):
        if 'inlineData' in p:
            sys.stdout.buffer.write(base64.b64decode(p['inlineData']['data']))
            sys.exit(0)
print('ERROR: No image in response', file=sys.stderr)
print(json.dumps(resp, indent=2), file=sys.stderr)
sys.exit(1)
" > "$OUTPUT_FILE"

# 验证输出
if [[ ! -s "$OUTPUT_FILE" ]]; then
  echo "ERROR: Output file is empty" >&2
  rm -f "$OUTPUT_FILE"
  exit 1
fi

echo "OK: $(wc -c < "$OUTPUT_FILE") bytes written to $OUTPUT_FILE"
