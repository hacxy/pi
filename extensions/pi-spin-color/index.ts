import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { matchesKey, Key, truncateToWidth } from "@earendil-works/pi-tui";

// 可选颜色（直接用颜色名称）
const COLORS = [
	"red",
	"green",
	"yellow",
	"blue",
	"cyan",
	"magenta",
	"white",
	"gray",
	"rainbow",
	"default",
] as const;

type ColorName = (typeof COLORS)[number];

// ANSI 颜色代码
const ANSI_COLORS: Record<ColorName, string> = {
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
	white: "\x1b[37m",
	gray: "\x1b[90m",
	rainbow: "",
	default: "",
};

const RESET = "\x1b[0m";

// 彩虹颜色序列（更鲜艳）
const RAINBOW_COLORS = [
	"\x1b[91m", // 红
	"\x1b[92m", // 绿
	"\x1b[93m", // 黄
	"\x1b[94m", // 蓝
	"\x1b[95m", // 紫
	"\x1b[96m", // 青
];

// 默认 spinner 帧
const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// 多色帧（原生旋转 + 每个帧颜色不同）
const MULTICOLOR_FRAMES = DEFAULT_FRAMES.map(
	(f, i) => `${RAINBOW_COLORS[i % RAINBOW_COLORS.length]}${f}${RESET}`,
);

// 设置文件路径
const SETTINGS_FILE = join(
	process.env.HOME || "~",
	".pi",
	"agent",
	"settings.json",
);

// 自定义选择器组件
class SpinnerSelector {
	private items: readonly ColorName[];
	private selected = 0;
	private frameIndex = 0;
	private cachedWidth?: number;
	private cachedLines?: string[];
	private interval?: ReturnType<typeof setInterval>;

	public onSelect?: (item: ColorName) => void;
	public onCancel?: () => void;

	constructor(items: readonly ColorName[]) {
		this.items = items;
	}

	startAnimation(requestRender: () => void) {
		this.interval = setInterval(() => {
			this.frameIndex = (this.frameIndex + 1) % DEFAULT_FRAMES.length;
			this.invalidate();
			requestRender();
		}, 100);
	}

	stopAnimation() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
	}

	handleInput(data: string): void {
		if (
			(matchesKey(data, Key.up) || matchesKey(data, "k")) &&
			this.selected > 0
		) {
			this.selected--;
			this.invalidate();
		} else if (
			(matchesKey(data, Key.down) || matchesKey(data, "j")) &&
			this.selected < this.items.length - 1
		) {
			this.selected++;
			this.invalidate();
		} else if (matchesKey(data, Key.enter)) {
			this.onSelect?.(this.items[this.selected]);
		} else if (matchesKey(data, Key.escape)) {
			this.onCancel?.();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		this.cachedLines = this.items.map((item, i) => {
			const isSelected = i === this.selected;
			const prefix = isSelected ? "> " : "  ";
			let coloredFrame: string;
			let coloredName: string;
			if (item === "rainbow") {
				const baseIndex = this.frameIndex % RAINBOW_COLORS.length;
				// 原生旋转 + 每个帧颜色不同
				coloredFrame =
					MULTICOLOR_FRAMES[this.frameIndex % MULTICOLOR_FRAMES.length];
				coloredName = "rainbow"
					.split("")
					.map(
						(ch, i) =>
							`${RAINBOW_COLORS[(baseIndex + i) % RAINBOW_COLORS.length]}${ch}${RESET}`,
					)
					.join("");
			} else if (item === "default") {
				coloredFrame = DEFAULT_FRAMES[this.frameIndex];
				coloredName = "default";
			} else {
				const frame = DEFAULT_FRAMES[this.frameIndex];
				const color = ANSI_COLORS[item];
				coloredFrame = `${color}${frame}${RESET}`;
				coloredName = `${color}${item}${RESET}`;
			}

			const line = `${prefix}${coloredName} ${coloredFrame}`;
			return truncateToWidth(line, width);
		});
		this.cachedWidth = width;
		return this.cachedLines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}
}

export default function (pi: ExtensionAPI) {
	let currentColor: ColorName = "cyan";

	// 从 settings.json 读取颜色
	const loadColor = async (): Promise<ColorName> => {
		try {
			const data = await readFile(SETTINGS_FILE, "utf-8");
			const settings = JSON.parse(data);
			const saved = settings?.["pi-spin-color"]?.color;
			if (saved && COLORS.includes(saved as ColorName)) {
				return saved as ColorName;
			}
		} catch (e) {
			console.debug("Failed to load color:", e);
		}
		return "cyan";
	};

	// 保存颜色到 settings.json
	const saveColor = async (color: ColorName) => {
		try {
			let settings: Record<string, any> = {};
			try {
				const data = await readFile(SETTINGS_FILE, "utf-8");
				settings = JSON.parse(data);
			} catch (e) {
				console.debug("Failed to read settings:", e);
			}
			settings["pi-spin-color"] = { color };
			await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
		} catch (e) {
			console.error("Failed to save color:", e);
		}
	};

	// 应用带颜色的 spinner
	const applySpinner = (color: ColorName, ctx: ExtensionContext) => {
		if (color === "default") {
			ctx.ui.setWorkingIndicator();
		} else if (color === "rainbow") {
			// 原生旋转 + 每个帧颜色不同
			ctx.ui.setWorkingIndicator({
				frames: MULTICOLOR_FRAMES,
				intervalMs: 80,
			});
		} else {
			const ansi = ANSI_COLORS[color];
			ctx.ui.setWorkingIndicator({
				frames: DEFAULT_FRAMES.map((f) => `${ansi}${f}${RESET}`),
				intervalMs: 80,
			});
		}
	};

	// 注册颜色切换命令
	pi.registerCommand("sc", {
		description: "切换 spinner 颜色",
		handler: async (_args, ctx) => {
			const selector = new SpinnerSelector(COLORS);

			const selected = await ctx.ui.custom<ColorName | null>(
				(tui, _theme, _keybindings, done) => {
					selector.onSelect = done;
					selector.onCancel = () => done(null);
					selector.startAnimation(() => tui.requestRender());

					return {
						render: (width) => selector.render(width),
						handleInput: (data) => {
							selector.handleInput(data);
							tui.requestRender();
						},
						invalidate: () => selector.invalidate(),
					};
				},
			);

			selector.stopAnimation();

			if (selected) {
				currentColor = selected;
				applySpinner(currentColor, ctx);
				await saveColor(currentColor);
				ctx.ui.notify(`Spinner 颜色: ${currentColor}`, "info");
			}
		},
	});

	// session 启动时应用 spinner
	pi.on("session_start", async (_event, ctx) => {
		currentColor = await loadColor();
		applySpinner(currentColor, ctx);
	});
}
