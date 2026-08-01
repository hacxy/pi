/**
 * 配置存储模块
 *
 * 负责读取和保存主题配置到 settings.json
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// settings.json 路径
const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

/**
 * 读取配置的当前主题名称
 * @returns 主题名称，如果未配置则返回 null
 */
export async function loadConfig(): Promise<string | null> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    const settings = JSON.parse(content);
    return settings.vibe || null;
  } catch {
    return null;
  }
}

/**
 * 保存主题配置
 * @param themeName 主题名称，传空字符串表示清除配置
 */
export async function saveConfig(themeName: string): Promise<void> {
  try {
    let settings: Record<string, unknown> = {};
    try {
      const content = await readFile(SETTINGS_PATH, "utf-8");
      settings = JSON.parse(content);
    } catch {
      // 文件不存在或解析失败
    }

    if (themeName) {
      settings.vibe = themeName;
    } else {
      delete settings.vibe;
    }

    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  } catch (e) {
    console.error("Failed to save vibe config:", e);
  }
}
