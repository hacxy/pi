#!/usr/bin/env bash
# 阶段 4: 技能挂载可见性/只读 + git-native（clone / worktree）
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib.sh

NAME=testproj-afk
VOLUME=testproj-workspace
SKILLS_DIR="${HOME}/Projects/afk-shared/skills"

echo "== 阶段 4: 技能挂载 + git-native =="

# 准备技能目录 + 标记文件
mkdir -p "$SKILLS_DIR"
echo "demo" > "$SKILLS_DIR/.test-marker"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume rm "$VOLUME" >/dev/null 2>&1 || true
export DEEPSEEK_API_KEY=test GH_TOKEN=test
bash start.sh testproj >/dev/null 2>&1

# 1. 技能目录内容可见（宿主 -> 容器）
seen=$(docker exec "$NAME" bash -lc 'basename /root/.pi/agent/skills/.test-marker 2>/dev/null')
assert_eq "技能目录内容可见" "$( [ "$seen" = ".test-marker" ] && echo ok || echo fail )" "ok"

# 2. 只读生效（写入被拒）
if docker exec "$NAME" bash -lc 'touch /root/.pi/agent/skills/.write-test 2>/dev/null'; then
  assert_eq "技能目录写入被拒 (ro)" "fail" "ok"
else
  assert_eq "技能目录写入被拒 (ro)" "ok" "ok"
fi

# 3. 容器内 git clone 公开仓库（git-native 通道）
clone_out=$(docker exec "$NAME" bash -lc \
  'cd /workspace && git clone --depth 1 https://github.com/octocat/Hello-World.git hello-test 2>&1 | tail -1')
clone_ok=$(docker exec "$NAME" bash -lc '[ -d /workspace/hello-test/.git ] && echo ok || echo fail')
assert_eq "容器内 git clone 成功" "$clone_ok" "ok"

# 4. git worktree add（多分支并行形态）
wt_ok=$(docker exec "$NAME" bash -lc \
  'cd /workspace/hello-test && git worktree add ../hello-wt HEAD >/dev/null 2>&1 && [ -d /workspace/hello-wt ] && echo ok || echo fail')
assert_eq "容器内 git worktree add 成功" "$wt_ok" "ok"

# 清理
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker volume rm "$VOLUME" >/dev/null 2>&1 || true
rm -f "$SKILLS_DIR/.test-marker"
report
