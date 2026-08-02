import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import type { CCHeaderState, SettingsFile } from "./types";
import { CMAP, SPEEDS, DEFAULT_STATE, MAX_SLOGAN_LENGTH } from "./constants";
import { updateLogoParams, recomputeFrames } from "./logo";

let state: CCHeaderState = { ...DEFAULT_STATE };
let framesDirty = true;
let screenCleared = false;

export function getState(): CCHeaderState {
	return state;
}

export function setState(newState: CCHeaderState): void {
	state = newState;
	syncLogoParams();
}

export function isScreenCleared(): boolean {
	return screenCleared;
}

export function setScreenCleared(value: boolean): void {
	screenCleared = value;
}

export function isFramesDirty(): boolean {
	return framesDirty;
}

export function setFramesDirty(value: boolean): void {
	framesDirty = value;
}

function syncLogoParams(): void {
	updateLogoParams(state.logoColorKey, state.gradientOn);
}

export const pick = <T>(
	val: unknown,
	guard: (v: unknown) => boolean,
	fallback: T,
): T => (guard(val) ? (val as T) : fallback);

export function stateFromConfig(h: Record<string, any>): CCHeaderState {
	return {
		logoColorKey: pick(
			h.color,
			(v) => !!CMAP[v as string],
			DEFAULT_STATE.logoColorKey,
		),
		versionColored: pick(
			h.ver,
			(v) => typeof v === "number",
			DEFAULT_STATE.versionColored,
		),
		gradientOn: pick(
			h.grad,
			(v) => typeof v === "boolean",
			DEFAULT_STATE.gradientOn,
		),
		logoInterval: pick(
			h.speed,
			(v) => typeof v === "number" && (SPEEDS as readonly number[]).includes(v),
			DEFAULT_STATE.logoInterval,
		),
		slogan: pick(
			h.slogan,
			(v) => typeof v === "string" && v.length <= MAX_SLOGAN_LENGTH,
			DEFAULT_STATE.slogan,
		),
		sloganOn: pick(
			h.sloganOn,
			(v) => typeof v === "boolean",
			DEFAULT_STATE.sloganOn,
		),
		sloganColor: pick(
			h.sloganColor,
			(v) => typeof v === "boolean",
			DEFAULT_STATE.sloganColor,
		),
		disabled: pick(
			h.disabled,
			(v) => typeof v === "boolean",
			DEFAULT_STATE.disabled,
		),
	};
}

export function stateToConfig(): Record<string, any> {
	return {
		color: state.logoColorKey,
		ver: state.versionColored,
		grad: state.gradientOn,
		speed: state.logoInterval,
		slogan: state.slogan,
		sloganOn: state.sloganOn,
		sloganColor: state.sloganColor,
		disabled: state.disabled,
	};
}

export function updateState(
	ctx: {
		ui: { notify: (msg: string, type?: "info" | "warning" | "error") => void };
	},
	applyAndPersist: (msg: string) => void,
	updater: (s: CCHeaderState) => string | null,
	skipFrames: boolean = false,
): void {
	if (state.disabled) {
		ctx.ui.notify(
			"Command unavailable: pi-cc-header disabled. Use /htg to enable.",
			"info",
		);
		return;
	}

	const prevColor = state.logoColorKey;
	const prevGrad = state.gradientOn;

	const msg = updater(state);
	if (msg === null) return;

	if (
		(!skipFrames && state.logoColorKey !== prevColor) ||
		state.gradientOn !== prevGrad
	) {
		framesDirty = true;
	}
	if (framesDirty) {
		syncLogoParams();
		recomputeFrames();
		framesDirty = false;
	}

	applyAndPersist(msg);
}

export function readSettings(settingsPath: string): SettingsFile | null {
	try {
		const content = readFileSync(settingsPath, "utf-8");
		const parsed = JSON.parse(content);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return null;
		return parsed;
	} catch {
		try {
			if (existsSync(settingsPath)) {
				const ts = new Date().toISOString().replace(/[:.]/g, "-");
				const bak = settingsPath.replace(/\.json$/, `.bak.${ts}.json`);
				copyFileSync(settingsPath, bak);
				console.error(
					"pi-cc-header: corrupted settings.json backed up to",
					bak,
				);
			}
		} catch {
			console.error("pi-cc-header: failed to read or back up settings.json");
		}
		try {
			writeFileSync(settingsPath, "{\n}\n", "utf-8");
		} catch {
			console.error("pi-cc-header: failed to restore default settings.json");
		}
		return null;
	}
}

export function saveSettings(settingsPath: string, s: SettingsFile): void {
	writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n", "utf-8");
}
