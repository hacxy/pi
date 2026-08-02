import {
	VERSION,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { CMAP, LAST_FRAME_INDEX, LOGO_PIXEL_WIDTH } from "./constants";
import { getState } from "./state";
import { getCachedStats } from "./stats";
import { getLogoFrames } from "./logo";
import type { CCHeaderState, StatsResult } from "./types";

export function formatCwd(cwd: string): string {
	const home = process.env.HOME;
	return home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}

function padRight(text: string, width: number): string {
	const clipped = truncateToWidth(text, width, "");
	return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

export class PiHeader implements Component {
	private frame = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly stats: StatsResult;
	private readonly state: CCHeaderState;
	private cachedInfoRows: Record<number, string> | null = null;
	private cachedInfoWidth = -1;

	constructor(
		private readonly pi: ExtensionAPI,
		private readonly ctx: ExtensionContext,
		private readonly tui: TUI,
		skipAnimation: boolean = false,
	) {
		this.stats = getCachedStats(pi, ctx);
		this.state = getState();

		if (skipAnimation) {
			this.frame = LAST_FRAME_INDEX;
		} else {
			const tick = () => {
				if (this.frame < LAST_FRAME_INDEX) {
					this.frame++;
					this.tui.requestRender();
					this.timer = setTimeout(tick, this.state.logoInterval);
				} else {
					this.timer = null;
					this.tui.requestRender();
				}
			};
			this.timer = setTimeout(tick, this.state.logoInterval);
			this.timer.unref?.();
		}
	}

	render(width: number): string[] {
		const theme = this.ctx.ui.theme;
		const muted = (s: string) => theme.fg("muted", s);

		const logoFrames = getLogoFrames();
		const logoLines = logoFrames[this.frame];
		const logoWidth = LOGO_PIXEL_WIDTH;
		const infoMaxWidth = Math.max(0, width - LOGO_PIXEL_WIDTH);
		let infoRows: Record<number, string>;
		if (this.cachedInfoRows && this.cachedInfoWidth === width) {
			infoRows = this.cachedInfoRows;
		} else {
			const model = this.ctx.model?.id ?? "Default";
			const effort = this.pi.getThinkingLevel();
			const cwd = formatCwd(this.ctx.cwd);
			const skillText = `${this.stats.skills} skills`;
			const extText = `${this.stats.extensions} extensions`;
			const statsLine = `${skillText} · ${this.stats.prompts} prompts · ${extText}`;

			const piText =
				this.state.versionColored >= 2
					? `\x1b[${CMAP[this.state.logoColorKey]}mPi v${VERSION}\x1b[39m`
					: this.state.versionColored >= 1
						? `\x1b[${CMAP[this.state.logoColorKey]}mPi\x1b[39m ${muted(`v${VERSION}`)}`
						: muted(`Pi v${VERSION}`);
			const modelLine = `${model} · ${effort}${this.stats.agents ? `  |  ${this.stats.agents}` : ""}`;

			const sloganW = visibleWidth(this.state.slogan);
			const sloganText =
				sloganW > infoMaxWidth
					? truncateToWidth(this.state.slogan, infoMaxWidth - 3, "") + "..."
					: this.state.slogan;

			infoRows = this.state.sloganOn
				? {
						2: piText,
						3: this.state.sloganColor
							? `\x1b[1m\x1b[${CMAP[this.state.logoColorKey]}m${sloganText}\x1b[39m\x1b[22m`
							: muted(`\x1b[1m${sloganText}\x1b[22m`),
						4: muted(modelLine),
						5: muted(statsLine),
					}
				: {
						2: piText,
						3: muted(`${model} · ${effort}`),
						4: muted(statsLine),
						5: muted(this.stats.agents ? `${this.stats.agents} · ${cwd}` : cwd),
					};
			this.cachedInfoRows = infoRows;
			this.cachedInfoWidth = width;
		}

		const lines: string[] = [];
		for (let i = 1; i < logoLines.length; i++) {
			const right =
				infoRows[i] != null ? padRight(infoRows[i], infoMaxWidth) : "";
			lines.push(padRight(logoLines[i], logoWidth) + right);
		}
		return lines.map((l) => padRight(truncateToWidth(l, width, ""), width));
	}

	invalidate(): void {}
	reapply(): void {
		this.cachedInfoRows = null;
		this.tui.requestRender();
	}
	dispose(): void {
		if (this.timer != null) clearTimeout(this.timer);
	}
}

let active: PiHeader | undefined;

export function apply(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	clearMode: "full" | "viewport" | "none",
	skipAnimation: boolean = false,
) {
	if (ctx.mode !== "tui") return;
	if (clearMode === "full") {
		process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
	} else if (clearMode === "viewport") {
		process.stdout.write("\x1b[2J");
	}
	ctx.ui.setHeader((tui) => {
		active?.dispose();
		active = new PiHeader(pi, ctx, tui, skipAnimation);
		return active;
	});
}

export function getActiveHeader(): PiHeader | undefined {
	return active;
}

export function setActiveHeader(header: PiHeader | undefined): void {
	active?.dispose();
	active = header;
}
