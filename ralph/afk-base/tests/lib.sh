#!/usr/bin/env bash
# 共享断言助手：测试接缝 = docker CLI（build/run/exec/inspect）
set -uo pipefail

PASS=0
FAIL=0
FAILED=()

# assert_ok <描述> <命令...>：命令成功退出即通过
assert_ok() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    PASS=$((PASS + 1))
    echo "  ✓ $desc"
  else
    FAIL=$((FAIL + 1))
    FAILED+=("$desc")
    echo "  ✗ $desc"
  fi
}

# assert_eq <描述> <实际> <期望>：字符串相等即通过
assert_eq() {
  local desc="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ $desc"
  else
    FAIL=$((FAIL + 1))
    FAILED+=("$desc (got: $actual, want: $expected)")
    echo "  ✗ $desc (got: $actual, want: $expected)"
  fi
}

report() {
  echo
  echo "结果: $PASS 通过, $FAIL 失败"
  if [ "$FAIL" -gt 0 ]; then
    printf '  失败项:\n'
    printf '    - %s\n' "${FAILED[@]}"
    exit 1
  fi
}

# cleanup <容器名> [卷名]：删除测试容器与可选卷
cleanup() {
  local c="$1" v="${2:-}"
  docker rm -f "$c" >/dev/null 2>&1 || true
  [ -n "$v" ] && docker volume rm "$v" >/dev/null 2>&1 || true
}
