/**
 * 文字动画效果模块
 *
 * 实现各种文字动画效果：打字机、呼吸灯、闪烁、扫描线、波浪、跑马灯
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TextAnimationType } from "./types";
import { randomChoice } from "./utils";

// 文字动画类型列表（排除 neon 和 gradient，因为它们未实现）
const TEXT_ANIMATIONS: TextAnimationType[] = [
  "typewriter",
  "breathe",
  "blink",
  "scanline",
  "wave",
  "marquee",
];

// 文字动画定时器
let textAnimationTimer: ReturnType<typeof setInterval> | null = null;

// 读秒起始时间（全局累计，不随组切换重置）
let startTime: number = 0;
let isTimerInitialized: boolean = false;

// ==================== 工具函数 ====================

/**
 * 格式化时间显示
 * @param seconds 秒数
 * @returns 格式化的时间字符串
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m${secs}s`;
}

/**
 * 获取当前读秒时间字符串
 */
function getTimeStr(): string {
  const elapsed = Math.floor(Date.now() / 1000) - startTime;
  return formatTime(elapsed);
}

/**
 * 清除文字动画定时器（不重置读秒）
 */
export function clearTextAnimation(): void {
  if (textAnimationTimer) {
    clearInterval(textAnimationTimer);
    textAnimationTimer = null;
  }
}

/**
 * 重置读秒（仅在首次启动或手动重置时调用）
 */
export function resetTimer(): void {
  startTime = Math.floor(Date.now() / 1000);
  isTimerInitialized = true;
}

// ==================== 动画效果实现 ====================

/**
 * 打字机效果：逐字显示，打完后逐字删除，再重新打
 */
function applyTypewriterAnimation(ctx: ExtensionContext, message: string): void {
  const CHAR_INTERVAL = 80; // 每个字的间隔
  const PAUSE_AFTER_TYPE = 1000; // 打完后停顿
  const PAUSE_AFTER_DELETE = 500; // 删除完后停顿

  let phase: "typing" | "pausing-after-type" | "deleting" | "pausing-after-delete" = "typing";
  let charIndex = 0;
  let displayText = "";

  // 先显示完整文案
  ctx.ui.setWorkingMessage(`${message} ${getTimeStr()}`);
  charIndex = message.length;
  displayText = message;
  phase = "pausing-after-type";

  let pauseTimer = 0;

  textAnimationTimer = setInterval(() => {
    const timeStr = getTimeStr();

    switch (phase) {
      case "typing":
        // 逐字显示
        if (charIndex < message.length) {
          displayText += message[charIndex];
          ctx.ui.setWorkingMessage(`${displayText}▌ ${timeStr}`);
          charIndex++;
        } else {
          // 打完，进入停顿
          ctx.ui.setWorkingMessage(`${message} ${timeStr}`);
          phase = "pausing-after-type";
          pauseTimer = 0;
        }
        break;

      case "pausing-after-type":
        // 打完后停顿
        pauseTimer += CHAR_INTERVAL;
        if (pauseTimer >= PAUSE_AFTER_TYPE) {
          phase = "deleting";
        }
        break;

      case "deleting":
        // 逐字删除
        if (charIndex > 0) {
          charIndex--;
          displayText = message.slice(0, charIndex);
          ctx.ui.setWorkingMessage(`${displayText}▌ ${timeStr}`);
        } else {
          // 删除完，进入停顿
          ctx.ui.setWorkingMessage(`▌ ${timeStr}`);
          phase = "pausing-after-delete";
          pauseTimer = 0;
        }
        break;

      case "pausing-after-delete":
        // 删除完后停顿
        pauseTimer += CHAR_INTERVAL;
        if (pauseTimer >= PAUSE_AFTER_DELETE) {
          // 重新开始打字
          phase = "typing";
          charIndex = 0;
          displayText = "";
        }
        break;
    }
  }, CHAR_INTERVAL);
}

/**
 * 呼吸效果：明暗交替
 */
function applyBreatheAnimation(ctx: ExtensionContext, message: string): void {
  let phase = 0;

  textAnimationTimer = setInterval(() => {
    const brightness = Math.sin(phase) * 0.5 + 0.5;
    const r = Math.floor(200 * brightness + 55);
    const g = Math.floor(200 * brightness + 55);
    const b = Math.floor(200 * brightness + 55);

    ctx.ui.setWorkingMessage(`\x1b[38;2;${r};${g};${b}m${message}\x1b[0m ${getTimeStr()}`);
    phase += 0.15;
  }, 50);
}

/**
 * 闪烁效果：亮暗切换
 */
function applyBlinkAnimation(ctx: ExtensionContext, message: string): void {
  let visible = true;

  textAnimationTimer = setInterval(() => {
    if (visible) {
      ctx.ui.setWorkingMessage(`\x1b[1m${message}\x1b[0m ${getTimeStr()}`);
    } else {
      ctx.ui.setWorkingMessage(`\x1b[2m${message}\x1b[0m ${getTimeStr()}`);
    }
    visible = !visible;
  }, 500);
}

/**
 * 扫描线效果：高亮字符从左到右移动
 */
function applyScanlineAnimation(ctx: ExtensionContext, message: string): void {
  let pos = 0;

  textAnimationTimer = setInterval(() => {
    let display = "";
    for (let i = 0; i < message.length; i++) {
      if (i === pos) {
        display += `\x1b[96m${message[i]}\x1b[0m`;
      } else {
        display += message[i];
      }
    }
    ctx.ui.setWorkingMessage(`${display} ${getTimeStr()}`);
    pos = (pos + 1) % message.length;
  }, 100);
}

/**
 * 波浪效果：字符亮度起伏
 */
function applyWaveAnimation(ctx: ExtensionContext, message: string): void {
  let phase = 0;

  textAnimationTimer = setInterval(() => {
    let display = "";
    for (let i = 0; i < message.length; i++) {
      const brightness = Math.sin(phase + i * 0.3) * 0.5 + 0.5;
      const v = Math.floor(128 + 127 * brightness);
      display += `\x1b[38;2;${v};${v};${v}m${message[i]}\x1b[0m`;
    }
    ctx.ui.setWorkingMessage(`${display} ${getTimeStr()}`);
    phase += 0.2;
  }, 80);
}

/**
 * 跑马灯效果：文案循环滚动
 */
function applyMarqueeAnimation(ctx: ExtensionContext, message: string): void {
  const spaces = "    ";
  const fullText = spaces + message + spaces;
  let offset = 0;

  textAnimationTimer = setInterval(() => {
    const display = fullText.slice(offset, offset + message.length);
    ctx.ui.setWorkingMessage(`\x1b[36m${display}\x1b[0m ${getTimeStr()}`);
    offset = (offset + 1) % (message.length + spaces.length);
  }, 200);
}

// ==================== 主入口 ====================

/**
 * 应用文字动画
 * @param ctx 扩展上下文
 * @param message 要显示的文案
 */
export function applyTextAnimation(ctx: ExtensionContext, message: string): void {
  clearTextAnimation();

  // 随机选择文字动画类型
  const animationType = randomChoice(TEXT_ANIMATIONS);

  // 首次启动时初始化读秒
  if (!isTimerInitialized) {
    startTime = Math.floor(Date.now() / 1000);
    isTimerInitialized = true;
  }

  // 设置初始文案
  ctx.ui.setWorkingMessage(`${message} ${getTimeStr()}`);

  // 根据动画类型应用效果
  switch (animationType) {
    case "typewriter":
      applyTypewriterAnimation(ctx, message);
      break;
    case "breathe":
      applyBreatheAnimation(ctx, message);
      break;
    case "blink":
      applyBlinkAnimation(ctx, message);
      break;
    case "scanline":
      applyScanlineAnimation(ctx, message);
      break;
    case "wave":
      applyWaveAnimation(ctx, message);
      break;
    case "marquee":
      applyMarqueeAnimation(ctx, message);
      break;
  }
}
