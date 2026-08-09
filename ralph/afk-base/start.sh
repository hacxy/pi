#!/usr/bin/env bash
# 创建项目 AFK 容器（一项目一容器，保留形态）
# 用法: ./start.sh <project>
#   <project> 为 GitHub 仓库名（如 my-app -> 容器 my-app-afk）
# 凭据: 从调用环境读取 DEEPSEEK_API_KEY / GH_TOKEN，容器创建时注入（docker start 不会重新注入）
set -euo pipefail

PROJECT="${1:-}"
if [ -z "$PROJECT" ]; then
  echo "用法: ./start.sh <project>   # 例如 ./start.sh my-app" >&2
  exit 1
fi

NAME="${PROJECT}-afk"
VOLUME="${PROJECT}-workspace"
IMAGE="${AFK_IMAGE:-afk-base:latest}"
SKILLS_DIR="${SKILLS_DIR:-${HOME}/Projects/afk-shared/skills}"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "警告: 公共技能目录不存在 ($SKILLS_DIR)，已自动创建" >&2
  mkdir -p "$SKILLS_DIR"
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume create "$VOLUME" >/dev/null

docker run -d --name "$NAME" \
  -e DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}" \
  -e GH_TOKEN="${GH_TOKEN:-}" \
  -v "${VOLUME}:/workspace" \
  -v "${SKILLS_DIR}:/root/.pi/agent/skills:ro" \
  "${IMAGE}"

echo "容器 ${NAME} 已创建（项目卷 ${VOLUME}，技能目录只读挂载）"
echo "  进入: docker exec -it ${NAME} pi"
echo "  无头: docker exec ${NAME} pi -p \"<任务>\""
