/**
 * 类型定义
 *
 * pi-vibe 扩展使用的所有类型定义
 */

// 主题组
export interface ThemeGroup {
  name: string;
  emoji: string[];
  messages: string[];
}

// 主题
export interface WorkingTheme {
  name: string;
  description: string;
  groups: ThemeGroup[];
}

// 文字动画类型
export type TextAnimationType =
  | "typewriter"
  | "breathe"
  | "blink"
  | "scanline"
  | "wave"
  | "marquee";
