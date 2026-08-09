#!/usr/bin/env bash
# 阶段 3: start.sh 运行时规范（命名/挂载/env/保留性/参数校验）
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib.sh

PROJECT=testproj
NAME="${PROJECT}-afk"
VOLUME="${PROJECT}-workspace"

echo "== 阶段 3: start.sh 运行时规范 =="

# 准备宿主公共技能目录（挂载源）
mkdir -p "${HOME}/Projects/afk-shared/skills"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume rm "$VOLUME" >/dev/null 2>&1 || true

# 0. 缺参数应报错退出
if bash start.sh >/dev/null 2>&1; then
  assert_eq "缺参数时退出非零" "fail" "ok"
else
  assert_eq "缺参数时退出非零" "ok" "ok"
fi

# 1. 正常创建（env 从调用环境传入）
export DEEPSEEK_API_KEY=test-key GH_TOKEN=test-token
assert_ok "start.sh $PROJECT 成功" bash start.sh "$PROJECT"

name=$(docker inspect -f '{{.Name}}' "$NAME" 2>/dev/null || echo "")
assert_eq "容器命名为 <project>-afk" "$name" "/${NAME}"

# 2. 挂载面：项目卷 -> /workspace；技能目录只读
ws_mount=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Type}}|{{.Name}}{{end}}{{end}}' "$NAME")
assert_eq "项目卷挂载于 /workspace" "$ws_mount" "volume|${VOLUME}"
skills_mode=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/root/.pi/agent/skills"}}{{.Mode}}{{end}}{{end}}' "$NAME")
assert_eq "技能目录只读挂载 (Mode=ro)" "$skills_mode" "ro"

# 3. env 注入
env_dk=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$NAME" | grep -c 'DEEPSEEK_API_KEY=test-key')
assert_eq "DEEPSEEK_API_KEY 在容器 env 中" "$env_dk" "1"
env_gh=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$NAME" | grep -c 'GH_TOKEN=test-token')
assert_eq "GH_TOKEN 在容器 env 中" "$env_gh" "1"

# 4. stop/start 后 env 留存（docker start 不重新注入的坑）
docker stop "$NAME" >/dev/null && docker start "$NAME" >/dev/null
env_after=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$NAME" | grep -c 'DEEPSEEK_API_KEY=test-key')
assert_eq "stop/start 后 env 仍留存" "$env_after" "1"

# 清理
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume rm "$VOLUME" >/dev/null 2>&1 || true
report
