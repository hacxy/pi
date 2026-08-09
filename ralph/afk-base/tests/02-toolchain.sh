#!/usr/bin/env bash
# 阶段 2: 工具链完整化（gh / playwright+chromium / fnm / corepack / CJK 字体）
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib.sh

IMAGE=afk-base:latest
CONTAINER=afk-test-02

echo "== 阶段 2: 工具链 =="

cleanup "$CONTAINER"
assert_ok "镜像构建成功" docker build -q -t "$IMAGE" .
assert_ok "容器启动" docker run -d --name "$CONTAINER" "$IMAGE"
sleep 1

# 1. fnm 本体可用，node 默认 24.x
assert_ok "fnm 已安装" docker exec "$CONTAINER" bash -lc 'fnm --version'
node_v=$(docker exec "$CONTAINER" bash -lc 'node --version' 2>/dev/null | tr -d 'v')
case "$node_v" in 24.*) got=ok ;; *) got="fail($node_v)" ;; esac
assert_eq "node 默认版本 = fnm 24.x (got: $node_v)" "$got" "ok"

# 2. gh CLI
assert_ok "gh --version 可用" docker exec "$CONTAINER" bash -lc 'gh --version'

# 3. playwright + chromium 浏览器已安装
pw=$(docker exec "$CONTAINER" bash -lc 'playwright --version' 2>/dev/null)
assert_eq "playwright 可用 (got: $pw)" "$( [ -n "$pw" ] && echo ok || echo fail )" "ok"
chromium_present=$(docker exec "$CONTAINER" bash -lc 'ls ~/.cache/ms-playwright/ 2>/dev/null | grep -ci chromium')
assert_eq "chromium 浏览器已安装" "$( [ "${chromium_present:-0}" -gt 0 ] && echo ok || echo fail )" "ok"

# 4. corepack（pnpm 按项目启用）
assert_ok "corepack pnpm 可用" docker exec "$CONTAINER" bash -lc 'corepack pnpm --version'

# 5. CJK 字体（截图中文渲染）
cjk=$(docker exec "$CONTAINER" bash -lc 'fc-list :lang=zh 2>/dev/null | head -1')
assert_eq "CJK 字体已安装 (fonts-noto-cjk)" "$( [ -n "$cjk" ] && echo ok || echo fail )" "ok"

cleanup "$CONTAINER"
report
