#!/usr/bin/env bash
# 阶段 5: README 覆盖度（三块核心流程 + 安全边界）
set -uo pipefail
cd "$(dirname "$0")/.."
source tests/lib.sh

echo "== 阶段 5: README 覆盖度 =="
[ -f README.md ] || { echo "  ✗ README.md 缺失"; exit 1; }

for section in "git-native" "afk-run" "换 node 版本"; do
  if grep -q "$section" README.md; then
    assert_eq "README 覆盖: $section" "ok" "ok"
  else
    assert_eq "README 覆盖: $section" "fail" "ok"
  fi
done

for kw in "DEEPSEEK_API_KEY" "GH_TOKEN" "fnm" "安全边界"; do
  if grep -q "$kw" README.md; then
    assert_eq "README 包含: $kw" "ok" "ok"
  else
    assert_eq "README 包含: $kw" "fail" "ok"
  fi
done

report
