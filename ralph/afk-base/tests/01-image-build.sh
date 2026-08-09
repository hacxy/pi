#!/usr/bin/env bash
# 阶段 1（曳光弹）：最小镜像可构建 + 容器存活 + pi 可用 + env 注入后无头跑通
# 用法: bash tests/01-image-build.sh [--no-api]   （--no-api 跳过真实 API 调用）
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib.sh

IMAGE=afk-base:latest
CONTAINER=afk-test-01

echo "== 阶段 1: 镜像构建与 pi 存活 =="

# 清理旧容器
cleanup "$CONTAINER"

# 1. 镜像可构建
assert_ok "镜像构建成功 (docker build -t afk-base:latest .)" docker build -q -t "$IMAGE" .

# 2. 容器可启动且保持存活（sleep infinity 生效）
cleanup "$CONTAINER"
assert_ok "容器可启动 (docker run -d)" docker run -d --name "$CONTAINER" "$IMAGE"
sleep 1
running=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo "gone")
assert_eq "容器保持存活 (State.Running=true)" "$running" "true"

# 3. pi 可执行
pi_version=$(docker exec "$CONTAINER" pi --version 2>/dev/null || echo "")
assert_eq "容器内 pi --version 可用" "$( [ -n "$pi_version" ] && echo ok || echo fail )" "ok"

# 4. env 注入 + pi 无头最小任务（需要真实 DEEPSEEK_API_KEY，可跳过）
if [ "${1:-}" = "--no-api" ] || [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  echo "  - 跳过无头 pi 任务（未提供 DEEPSEEK_API_KEY 或 --no-api）"
else
  out=$(docker exec -e DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" "$CONTAINER" \
    pi -p --no-session --no-tools "回复:ok" 2>&1 | tail -c 200)
  assert_eq "pi 无头任务跑通（含 env 注入）" "$( [ -n "$out" ] && echo ok || echo fail )" "ok"
fi

cleanup "$CONTAINER"

report
