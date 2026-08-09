#!/usr/bin/env bash
# 阶段 7: afk-run wrapper（容器化 ralph）
#   - 身份解析: git remote origin 仓库名（fallback 目录名）
#   - 真实凭据链路: 宿主 gh auth token + auth.json deepseek.key → 容器 env → gh auth status 验证
#   - 容器生命周期: 创建（bind cwd/技能/ralph 只读挂载）/ 停止重启 / bind 源不匹配重建
#   - 编排部分用假凭据隔离（AFK_GH_TOKEN/AFK_DEEPSEEK_KEY），凭据链路用真凭据（条件执行）
set -uo pipefail
SELF="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"   # 归一化 $0, 兼容 run-all/单独运行
cd "$(dirname "$SELF")/.."
source tests/lib.sh

AFK_RUN="$(cd "$(dirname "$SELF")/../.." && pwd -P)/afk-run"
IMAGE=afk-base:latest
TMP="$(mktemp -d)"
TMP="$(cd "$TMP" && pwd -P)"   # macOS: /var -> /private/var 归一化, 与 docker 报告的物理路径一致
trap 'cleanup all; rm -rf "$TMP"' EXIT

cleanup() {
  docker rm -f testproj-afk >/dev/null 2>&1 || true
  docker rm -f fallbackdir-afk >/dev/null 2>&1 || true
}

echo "== 阶段 7: afk-run wrapper =="

# ── 准备两个同 repo 名的临时目录 + 一个无 git 目录 ──
mkdir -p "$TMP/proj-a" "$TMP/proj-b" "$TMP/fallbackdir"
for d in proj-a proj-b; do
  ( cd "$TMP/$d" && git init -q && git remote add origin "https://github.com/org/testproj.git" )
done
# 假凭据（编排层隔离；真实凭据链路见下方条件块）
export AFK_GH_TOKEN=ghp_fake AFK_DEEPSEEK_KEY=sk-fake

# ── 1. 身份解析 + 容器创建（proj-a）──
( cd "$TMP/proj-a" && bash "$AFK_RUN" ./prd.md ./plan.md 3 ) >/dev/null 2>&1
# afk 会因文档不存在退出 3，但容器应已创建
name=$(docker inspect -f '{{.Name}}' testproj-afk 2>/dev/null || echo "")
assert_eq "身份解析为仓库名 (testproj-afk)" "$name" "/testproj-afk"

# ── 2. bind 源 = 启动目录 ──
src=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' testproj-afk)
assert_eq "bind 源 = 当前目录" "$src" "$TMP/proj-a"

# ── 3. 挂载面: 技能只读 + ralph 只读 ──
skills_mode=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/root/.pi/agent/skills"}}{{.Mode}}{{end}}{{end}}' testproj-afk)
assert_eq "技能目录只读挂载" "$skills_mode" "ro"
ralph_dest=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/opt/ralph"}}{{.Destination}}{{end}}{{end}}' testproj-afk)
assert_eq "ralph 挂载于 /opt/ralph" "$ralph_dest" "/opt/ralph"

# ── 4. 假凭据注入 env（编排层断言）──
env_dk=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' testproj-afk | grep -c 'DEEPSEEK_API_KEY=sk-fake')
assert_eq "DEEPSEEK_API_KEY 注入" "$env_dk" "1"
env_gh=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' testproj-afk | grep -c 'GH_TOKEN=ghp_fake')
assert_eq "GH_TOKEN 注入" "$env_gh" "1"

# ── 5. 停止重启: 同一容器, start 后 Running=true ──
cid1=$(docker inspect -f '{{.Id}}' testproj-afk)
docker stop testproj-afk >/dev/null
( cd "$TMP/proj-a" && bash "$AFK_RUN" ./prd.md ./plan.md 3 ) >/dev/null 2>&1
cid2=$(docker inspect -f '{{.Id}}' testproj-afk)
assert_eq "重启复用同一容器 (未重建)" "$cid2" "$cid1"
running=$(docker inspect -f '{{.State.Running}}' testproj-afk)
assert_eq "容器已重新启动" "$running" "true"

# ── 6. bind 源不匹配 → 重建（同 repo 名另一份 clone: proj-b）──
( cd "$TMP/proj-b" && bash "$AFK_RUN" ./prd.md ./plan.md 3 ) >/dev/null 2>&1
src2=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}' testproj-afk)
assert_eq "bind 源不匹配时重建为 proj-b" "$src2" "$TMP/proj-b"

# ── 7. 无 git remote → fallback 目录名 ──
( cd "$TMP/fallbackdir" && bash "$AFK_RUN" ./prd.md ./plan.md 3 ) >/dev/null 2>&1
fb=$(docker inspect -f '{{.Name}}' fallbackdir-afk 2>/dev/null || echo "")
assert_eq "无 remote 时 fallback 目录名" "$fb" "/fallbackdir-afk"

# ── 8. 真实凭据链路（宿主已登录 gh 时执行；编排层已用假凭据验证，这里验提取+认证）──
if host_token=$(gh auth token 2>/dev/null) && [ -n "$host_token" ]; then
  # 用真实 token 创建临时验证容器（不打印值）
  cid=$(docker run -d --name credcheck-afk -e GH_TOKEN="$host_token" "$IMAGE")
  auth_out=$(docker exec credcheck-afk bash -lc 'gh auth status 2>&1 | grep -c "Logged in"')
  assert_eq "真实 GH_TOKEN 在容器内认证成功 (gh auth status)" "$auth_out" "1"
  docker rm -f credcheck-afk >/dev/null 2>&1 || true
else
  echo "  - 跳过真实 token 认证验证（宿主 gh 未登录）"
fi
if [ -f "$HOME/.pi/agent/auth.json" ]; then
  key=$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser("~/.pi/agent/auth.json"))).get("deepseek",{}).get("key",""))' 2>/dev/null || echo "")
  assert_eq "auth.json 可提取 deepseek key (非空)" "$( [ -n "$key" ] && echo ok || echo fail )" "ok"
else
  echo "  - 跳过 auth.json 提取验证（文件不存在）"
fi

cleanup
report
