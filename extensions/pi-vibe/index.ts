/**
 * pi-vibe 扩展入口
 *
 * 自定义 pi 的 working 主题，支持文字动画和 emoji 动画
 *
 * Commands:
 *   /vibe                    显示当前主题和组
 *   /vibe list               列出所有主题
 *   /vibe <theme-name>       切换到指定主题
 *   /vibe reset              恢复 pi 默认
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig } from "./config";
import { loadThemes, THEMES_DIR } from "./theme-loader";
import {
	applyTheme,
	getCurrentTheme,
	setCurrentTheme,
	getCurrentGroupIndex,
	switchToNextGroup,
	startGroupSwitchTimer,
	stopAllTimers,
	resetTimer,
} from "./timer";
import type { WorkingTheme } from "./types";

// ==================== 状态 ====================

// 主题缓存
let themeCache: Map<string, WorkingTheme> = new Map();

// 追踪 Agent 工具是否在运行（用于过滤子 agent 的事件）
let agentToolRunning = false;

// ==================== 扩展入口 ====================

export default function (pi: ExtensionAPI) {
	// 追踪 Agent 工具执行（子 agent 的事件发生在 tool_execution 期间）
	pi.on("tool_execution_start", async (event) => {
		if (event.toolName === "Agent") agentToolRunning = true;
	});
	pi.on("tool_execution_end", async (event) => {
		if (event.toolName === "Agent") agentToolRunning = false;
	});

	// 会话启动时只加载主题配置，不启动动画
	pi.on("session_start", async (_event, _ctx) => {
		themeCache = await loadThemes();
		const savedThemeName = await loadConfig();

		let initialTheme: WorkingTheme | null = null;
		if (savedThemeName && themeCache.has(savedThemeName)) {
			initialTheme = themeCache.get(savedThemeName) ?? null;
		} else if (themeCache.size > 0) {
			const firstKey = themeCache.keys().next().value;
			if (firstKey) {
				initialTheme = themeCache.get(firstKey) ?? null;
			}
		}

		setCurrentTheme(initialTheme);
	});

	// agent 开始时启动动画和读秒
	pi.on("agent_start", async (_event, ctx) => {
		if (agentToolRunning) return;
		const currentTheme = getCurrentTheme();
		if (currentTheme) {
			resetTimer();
			switchToNextGroup(ctx);
			startGroupSwitchTimer(ctx);
		}
	});

	// agent 结束时停止定时器
	pi.on("agent_end", async () => {
		if (agentToolRunning) return;
		stopAllTimers();
	});

	// 注册命令
	pi.registerCommand("vibe", {
		description: "自定义 working 主题: /vibe [list|reset|theme-name]",
		handler: async (args, ctx) => {
			const input = args.trim().toLowerCase();

			// 无参数：显示当前主题
			if (!input) {
				const currentTheme = getCurrentTheme();
				if (currentTheme) {
					const groupIndex = getCurrentGroupIndex();
					const group =
						groupIndex >= 0 ? currentTheme.groups[groupIndex] : null;
					ctx.ui.notify(
						`主题: ${currentTheme.name}\n当前组: ${group?.name ?? "无"}\n描述: ${currentTheme.description}\n\n使用 /vibe list 查看所有主题`,
						"info",
					);
				} else {
					ctx.ui.notify(`当前: pi 默认\n使用 /vibe list 查看可用主题`, "info");
				}
				return;
			}

			// 列出所有主题
			if (input === "list") {
				if (themeCache.size === 0) {
					ctx.ui.notify(`暂无主题\n主题目录: ${THEMES_DIR}`, "warning");
					return;
				}

				const list = Array.from(themeCache.entries())
					.map(([key, theme]) => {
						const groupCount = theme.groups.length;
						return `  ${key.padEnd(16)} ${theme.name} (${groupCount}组) - ${theme.description}`;
					})
					.join("\n");
				ctx.ui.notify(`可用主题:\n${list}`, "info");
				return;
			}

			// 重置为默认
			if (input === "reset") {
				setCurrentTheme(null);
				applyTheme(ctx, null);
				// 清除保存的配置
				await saveConfig("");
				ctx.ui.notify("已恢复 pi 默认", "info");
				return;
			}

			// 切换主题
			if (themeCache.has(input)) {
				const newTheme = themeCache.get(input) ?? null;
				setCurrentTheme(newTheme);
				applyTheme(ctx, newTheme);
				// 保存配置
				if (newTheme) {
					await saveConfig(input);
				}
				ctx.ui.notify(`已切换到: ${newTheme?.name}`, "info");
			} else {
				ctx.ui.notify(
					`未知主题: ${input}\n使用 /vibe list 查看可用主题`,
					"error",
				);
			}
		},
	});
}
