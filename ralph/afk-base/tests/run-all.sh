#!/usr/bin/env bash
# 运行全部测试（按阶段顺序）
set -uo pipefail
cd "$(dirname "$0")"

TOTAL=0
FAILED_RUNS=()

for t in 0*.sh; do
  [ "$t" = "run-all.sh" ] && continue
  echo "──────── $t ────────"
  if bash "$t" "${@:-}"; then
    :
  else
    FAILED_RUNS+=("$t")
  fi
  TOTAL=$((TOTAL + 1))
  echo
done

if [ "${#FAILED_RUNS[@]}" -gt 0 ]; then
  echo "失败: ${FAILED_RUNS[*]}"
  exit 1
fi
echo "全部 $TOTAL 个测试文件通过"
