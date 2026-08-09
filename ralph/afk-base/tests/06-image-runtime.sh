#!/usr/bin/env bash
# 阶段 6: ralph 运行时依赖（jq / python3 —— once 的硬依赖）
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib.sh

IMAGE=afk-base:latest
CONTAINER=afk-test-06

echo "== 阶段 6: ralph 运行时依赖 =="
cleanup "$CONTAINER"
assert_ok "镜像构建成功" docker build -q -t "$IMAGE" .
assert_ok "容器启动" docker run -d --name "$CONTAINER" "$IMAGE"
sleep 1
assert_ok "jq 可用" docker exec "$CONTAINER" bash -lc 'jq --version'
assert_ok "python3 可用" docker exec "$CONTAINER" bash -lc 'python3 --version'
cleanup "$CONTAINER"
report
