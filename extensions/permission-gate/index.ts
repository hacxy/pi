/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before running potentially dangerous bash commands.
 * Patterns checked: rm -rf, sudo, chmod/chown 777.
 *
 * `rm -rf` targeting paths under /tmp/ (including /tmp itself, globs like
 * /tmp/*) is auto-allowed without prompting — /tmp is scratch space, and
 * non-interactive runs (afk/headless) routinely clean it up.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const rmPattern = /\brm\s+(-rf?|--recursive)\b/i;
const otherDangerousPatterns = [/\bsudo\b/i, /\b(chmod|chown)\b.*777/i];

/** 简易 bash 分词：支持单/双引号；;&|<>() 独立成 token（即使紧贴路径如 /tmp/a;） */
export function tokenizeCommand(cmd: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|([^\s"';&|<>()]+)|([;&|<>()])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  }
  return tokens;
}

/** 归一化路径：解析 . / ..，防止 /tmp/../etc 这类绕过 */
export function normalizePath(p: string): string {
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "..") out.pop();
    else if (part === "." || part === "") continue;
    else out.push(part);
  }
  return "/" + out.join("/");
}

/** 目标是否位于 /tmp 之下（含 /tmp 本身），通配符如 /tmp/* 也命中 */
export function isUnderTmp(target: string): boolean {
  const n = normalizePath(target);
  return n === "/tmp" || n.startsWith("/tmp/");
}

const shellOps = new Set([";", "&", "|", "(", ")"]);

/**
 * 按 shell 运算符切分命令段，返回每个含 rm 的段的删除目标。
 * 只取 rm 自身参数：跳过选项、重定向（> /dev/null、2>&1）及其目标，
 * 避免把 && echo、2>/dev/null 等误当目标。
 */
export function rmTargetGroups(cmd: string): string[][] {
  const segments: string[][] = [[]];
  for (const t of tokenizeCommand(cmd)) {
    if (shellOps.has(t)) segments.push([]);
    else segments[segments.length - 1].push(t);
  }
  const groups: string[][] = [];
  for (const seg of segments) {
    const idx = seg.findIndex((t) => t === "rm" || t.endsWith("/rm"));
    if (idx === -1) continue;
    const targets: string[] = [];
    for (let i = idx + 1; i < seg.length; i++) {
      let t = seg[i];
      // fd 重定向前缀：2>/dev/null 里的 "2"
      if (/^\d+$/.test(t) && i + 1 < seg.length && /^[<>]$/.test(seg[i + 1])) {
        i++;
        t = seg[i];
      }
      if (/^[<>]$/.test(t)) {
        while (i < seg.length && /^[<>]$/.test(seg[i])) i++; // 连续 > 或 >>
        if (i < seg.length) i++; // 跳过重定向目标文件
        continue;
      }
      if (t.startsWith("-")) continue;
      targets.push(t);
    }
    groups.push(targets);
  }
  return groups;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;
    const isRm = rmPattern.test(command);
    const isSudo = /\bsudo\b/i.test(command);
    let dangerous = false;

    if (isRm) {
      // sudo 优先：sudo rm 一律询问，不受 /tmp 豁免影响
      if (!isSudo) {
        const groups = rmTargetGroups(command);
        const allUnderTmp =
          groups.length > 0 &&
          groups.every((g) => g.length > 0 && g.every(isUnderTmp));
        // /tmp 下的 rm -rf 直接放行，不做询问
        if (allUnderTmp) {
          return undefined;
        }
      }
      dangerous = true;
    } else if (otherDangerousPatterns.some((p) => p.test(command))) {
      dangerous = true;
    }

    if (dangerous) {
      if (!ctx.hasUI) {
        // 非交互模式默认拦截
        return {
          block: true,
          reason: "Dangerous command blocked (no UI for confirmation)",
        };
      }

      const choice = await ctx.ui.select(
        `⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`,
        ["Yes", "No"],
      );

      if (choice !== "Yes") {
        return { block: true, reason: "Blocked by user" };
      }
    }

    return undefined;
  });
}
