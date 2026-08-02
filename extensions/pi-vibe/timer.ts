/**
 * 定时器管理模块
 *
 * 管理文字动画定时器、组切换定时器和读秒定时器
 */

import type {
	ExtensionContext,
	WorkingIndicatorOptions,
} from "@earendil-works/pi-coding-agent";
import type { WorkingTheme } from "./types";
import {
	applyTextAnimation,
	clearTextAnimation,
	resetTimer,
} from "./text-animation";
import { randomChoice, randomInt } from "./utils";

// 组切换间隔（30秒）
const GROUP_SWITCH_INTERVAL = 30000;

// ==================== 定时器状态 ====================

// 组切换定时器
let groupSwitchTimer: ReturnType<typeof setInterval> | null = null;

// 使用 globalThis 存储定时器 ID，防止 /reload 后旧定时器失控
const GLOBAL_GROUP_TIMER_KEY = "__pi_vibe_group_switch_timer__";

// 模块加载时清理残留的旧定时器（/reload 场景）
{
	const staleId = (globalThis as any)[GLOBAL_GROUP_TIMER_KEY];
	if (staleId != null) {
		clearInterval(staleId);
		delete (globalThis as any)[GLOBAL_GROUP_TIMER_KEY];
	}
}

// 当前主题和组索引
let currentTheme: WorkingTheme | null = null;
let currentGroupIndex: number = -1;

// ==================== 主题状态管理 ====================

/**
 * 获取当前主题
 */
export function getCurrentTheme(): WorkingTheme | null {
	return currentTheme;
}

/**
 * 设置当前主题
 */
export function setCurrentTheme(theme: WorkingTheme | null): void {
	currentTheme = theme;
}

/**
 * 获取当前组索引
 */
export function getCurrentGroupIndex(): number {
	return currentGroupIndex;
}

// ==================== 定时器控制 ====================

/**
 * 切换到下一个随机组
 */
export function switchToNextGroup(ctx: ExtensionContext): void {
	if (!currentTheme || currentTheme.groups.length === 0) return;

	// 随机选择一组
	const newIndex = randomInt(0, currentTheme.groups.length - 1);
	currentGroupIndex = newIndex;

	const group = currentTheme.groups[currentGroupIndex]!;

	// 随机选择文案
	const message = randomChoice(group.messages);

	// 设置 emoji 动画
	const indicator: WorkingIndicatorOptions = {
		frames: group.emoji,
		intervalMs: 200,
	};
	ctx.ui.setWorkingIndicator(indicator);

	// 应用文字动画
	applyTextAnimation(ctx, message);
}

/**
 * 开始组切换定时器
 */
export function startGroupSwitchTimer(ctx: ExtensionContext): void {
	stopGroupSwitchTimer();

	const tid = setInterval(() => {
		switchToNextGroup(ctx);
	}, GROUP_SWITCH_INTERVAL);
	groupSwitchTimer = tid;
	(globalThis as any)[GLOBAL_GROUP_TIMER_KEY] = tid;
}

/**
 * 停止组切换定时器
 */
export function stopGroupSwitchTimer(): void {
	if (groupSwitchTimer) {
		clearInterval(groupSwitchTimer);
		groupSwitchTimer = null;
		delete (globalThis as any)[GLOBAL_GROUP_TIMER_KEY];
	}
}

/**
 * 停止所有定时器
 */
export function stopAllTimers(): void {
	stopGroupSwitchTimer();
	clearTextAnimation();
}

/**
 * 重置读秒
 */
export { resetTimer } from "./text-animation";

/**
 * 应用主题
 */
export function applyTheme(
	ctx: ExtensionContext,
	theme: WorkingTheme | null,
): void {
	// 停止所有定时器
	stopAllTimers();

	// 重置读秒
	resetTimer();

	if (theme) {
		currentTheme = theme;
		// 随机选择第一组
		switchToNextGroup(ctx);
		// 启动组切换定时器
		startGroupSwitchTimer(ctx);
	} else {
		// 恢复默认
		currentTheme = null;
		ctx.ui.setWorkingMessage();
		ctx.ui.setWorkingIndicator();
	}
}
