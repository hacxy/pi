#!/usr/bin/env bash
# afk 循环驱动逻辑测试 —— 用 fake once 驱动真实的 afk（afk/once 零改动）
#
# 原理：afk 用 $SCRIPT_DIR/once 作为单轮执行器，把 afk 副本与 fake once
# 放进同一临时目录，$SCRIPT_DIR 即解析到 fake once，真实循环逻辑原样跑。
#
# 覆盖：fake once 单发/计数模式、complete (0)、abort (1)、迭代上限 (2)、用法错误 (3)
# 用法: ./test-loop.sh        （RALPH_HOME 可覆盖 ralph 目录位置）
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd -P)"
RALPH_HOME="${RALPH_HOME:-$HOME/.pi/agent/ralph}"
REAL_AFK="$RALPH_HOME/afk"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
check() { # check <描述> <实际> <期望>
  if [ "$2" = "$3" ]; then pass=$((pass + 1)); echo "  PASS  $1"
  else fail=$((fail + 1)); echo "  FAIL  $1  实际=[$2] 期望=[$3]"; fi
}
run_afk() { # run_afk [ENV-args...] -- <afk 参数...>  结果在 $OUT/$RC
  # ENV-args 原样传给 env（如 FAKE_RC=1 / -u FAKE_RC）；用 env 而非
  # 赋值前缀，避免引号展开把 VAR=val 变成字面命令名（127）
  local envs=()
  while [ "$1" != "--" ]; do envs+=("$1"); shift; done
  shift
  if [ "${#envs[@]}" -gt 0 ]; then
    OUT="$(cd "$TMP" && env "${envs[@]}" "$TMP/afk" "$@" 2>&1)"
  else
    OUT="$(cd "$TMP" && "$TMP/afk" "$@" 2>&1)"
  fi
  RC=$?
}

[ -f "$REAL_AFK" ] || { echo "错误: 找不到 $REAL_AFK（可用 RALPH_HOME 覆盖）"; exit 3; }
cp "$REAL_AFK" "$TMP/afk"
cp "$HERE/once" "$TMP/once"
chmod +x "$TMP/afk" "$TMP/once"
echo "RALPH_HOME=$RALPH_HOME  测试目录=$TMP"

echo "== 1. fake once 单发模式 (FAKE_RC) =="
for rc in 0 1 2 3; do
  ( cd "$TMP" && FAKE_RC=$rc "$TMP/once" /dev/null /dev/null >/dev/null 2>&1 )
  check "FAKE_RC=$rc → 退出码 $rc" "$?" "$rc"
done

echo "== 2. fake once 计数模式（1 次 → 2，2 次 → 0）=="
rm -f "$TMP/.fake-once.count"
( cd "$TMP" && env -u FAKE_RC "$TMP/once" /dev/null /dev/null >/dev/null 2>&1 ); check "第 1 次调用" "$?" "2"
( cd "$TMP" && env -u FAKE_RC "$TMP/once" /dev/null /dev/null >/dev/null 2>&1 ); check "第 2 次调用" "$?" "0"

echo "== 3. complete 路径：2 轮后完成，退出码 0 =="
rm -f "$TMP/.fake-once.count"
run_afk -u FAKE_RC -- /dev/null /dev/null 2
check "整体退出码" "$RC" "0"
check "执行轮数" "$(echo "$OUT" | grep -c 'ITERATION')" "2"
check "完成消息" "$(echo "$OUT" | grep -o 'Ralph complete after 2 iterations' | head -1)" "Ralph complete after 2 iterations"

echo "== 4. abort 路径：FAKE_RC=1，退出码 1 =="
run_afk FAKE_RC=1 -- /dev/null /dev/null 2
check "整体退出码" "$RC" "1"
check "中止消息" "$(echo "$OUT" | grep -o 'Ralph aborted after 1 iterations' | head -1)" "Ralph aborted after 1 iterations"

echo "== 5. 迭代上限路径：FAKE_RC=2 恒为 2，退出码 2 =="
run_afk FAKE_RC=2 -- /dev/null /dev/null 2
check "整体退出码" "$RC" "2"
check "执行轮数" "$(echo "$OUT" | grep -c 'ITERATION')" "2"
check "上限消息" "$(echo "$OUT" | grep -o '达到迭代上限 (2)，仍有任务未完成。' | head -1)" "达到迭代上限 (2)，仍有任务未完成。"

echo "== 6. 用法错误路径：缺参数，退出码 3 =="
run_afk -- /dev/null
check "整体退出码" "$RC" "3"

echo
echo "结果: $pass 通过, $fail 失败"
[ "$fail" -eq 0 ]
