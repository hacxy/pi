/**
 * 主题加载模块
 *
 * 负责从磁盘加载和验证主题文件
 */

import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { WorkingTheme } from "./types";

// 主题目录
export const THEMES_DIR = join(homedir(), ".pi", "agent", "vibes");

/**
 * 加载所有主题文件
 * @returns 主题缓存 Map，key 为文件名（不含扩展名），value 为主题对象
 */
export async function loadThemes(): Promise<Map<string, WorkingTheme>> {
  const themes = new Map<string, WorkingTheme>();

  try {
    const files = await readdir(THEMES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(THEMES_DIR, file), "utf-8");
        const theme = JSON.parse(content) as WorkingTheme;

        // 校验主题格式
        if (isValidTheme(theme)) {
          // 过滤并校验每个组
          const validGroups = theme.groups.filter(isValidGroup);

          if (validGroups.length > 0) {
            theme.groups = validGroups;
            const key = basename(file, ".json");
            themes.set(key, theme);
          }
        }
      } catch (e) {
        console.error(`Failed to load theme ${file}:`, e);
      }
    }
  } catch {
    // 目录不存在或无法读取
  }

  return themes;
}

/**
 * 校验主题格式是否有效
 */
function isValidTheme(theme: unknown): theme is WorkingTheme {
  if (!theme || typeof theme !== "object") return false;
  const t = theme as Record<string, unknown>;
  return (
    typeof t.name === "string" &&
    t.name.length > 0 &&
    typeof t.description === "string" &&
    Array.isArray(t.groups) &&
    t.groups.length > 0
  );
}

/**
 * 校验主题组格式是否有效
 */
function isValidGroup(group: unknown): group is { name: string; emoji: string[]; messages: string[] } {
  if (!group || typeof group !== "object") return false;
  const g = group as Record<string, unknown>;
  return (
    typeof g.name === "string" &&
    g.name.length > 0 &&
    Array.isArray(g.emoji) &&
    g.emoji.length > 0 &&
    Array.isArray(g.messages) &&
    g.messages.length > 0
  );
}
