import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import {
	CMAP,
	COLOR_NAMES,
	SPEEDS,
	DEFAULT_STATE,
	MAX_SLOGAN_LENGTH,
} from "./constants";
import {
	getState,
	setState,
	stateToConfig,
	updateState,
	readSettings,
	saveSettings,
	setFramesDirty,
} from "./state";
import { invalidateStats } from "./stats";
import { recomputeFrames } from "./logo";
import { apply, setActiveHeader } from "./ui";

export function registerCommands(pi: ExtensionAPI) {
	const settingsPath = join(
		process.env.HOME ?? "",
		".pi",
		"agent",
		"settings.json",
	);

	const reapply = (pi: ExtensionAPI, ctx: ExtensionContext, msg: string) => {
		const s = readSettings(settingsPath);
		if (!s) {
			ctx.ui.notify(
				"pi-cc-header: settings.json is corrupted or unreadable. A backup has been created.",
				"error",
			);
			return;
		}
		s.ccHeader = stateToConfig();
		saveSettings(settingsPath, s);
		setActiveHeader(undefined);
		apply(pi, ctx, "none");
		ctx.ui.notify(msg, "info");
	};

	const clearScreenOnce = () => {
		if (getState().disabled) return;
		process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
	};

	pi.registerCommand("htg", {
		description: "Toggle pi-cc-header ENABLED/DISABLED",
		handler: async (_args, ctx) => {
			const s = readSettings(settingsPath);
			if (!s) {
				ctx.ui.notify(
					"pi-cc-header: settings.json is corrupted or unreadable. A backup has been created.",
					"error",
				);
				return;
			}
			const state = getState();
			const h = (s.ccHeader ?? {}) as Record<string, unknown>;
			if (state.disabled) {
				setState({ ...state, disabled: false });
				h.disabled = false;
				s.ccHeader = h;
				invalidateStats();
				clearScreenOnce();
				reapply(pi, ctx, "pi-cc-header: ENABLED");
			} else {
				setState({ ...state, disabled: true });
				h.disabled = true;
				s.ccHeader = h;
				saveSettings(settingsPath, s);
				setActiveHeader(undefined);
				ctx.ui.setHeader(undefined);
				ctx.ui.notify(
					"pi-cc-header: DISABLED. Takes effect next session. Config saved, /htg to re-enable.",
					"info",
				);
			}
		},
	});

	pi.registerCommand("hc", {
		description:
			"Header color: <code> = set (c a r o y g w b p); no args = show color key",
		handler: async (args, ctx) => {
			if (!args) {
				const state = getState();
				ctx.ui.notify(
					`Header color: ${state.logoColorKey} (${COLOR_NAMES[state.logoColorKey]}). Available: ${Object.entries(
						COLOR_NAMES,
					)
						.map(([k, n]) => `${k}=${n}`)
						.join(" ")}`,
					"info",
				);
				return;
			}
			updateState(
				ctx,
				(msg) => reapply(pi, ctx, msg),
				(s) => {
					if (!CMAP[args]) {
						ctx.ui.notify(
							`Invalid color: "${args}". Available: ${Object.keys(CMAP).join(" ")}`,
							"error",
						);
						return null;
					}
					s.logoColorKey = args;
					return `Color: ${args}`;
				},
			);
		},
	});

	pi.registerCommand("hv", {
		description: "Version label color: no args = cycle; <all|pi|off> = set",
		handler: async (args, ctx) => {
			if (args) {
				const v = args.trim();
				if (!["all", "pi", "off"].includes(v)) {
					ctx.ui.notify(
						`Invalid value: "${v}". Available: all, pi, off.`,
						"error",
					);
					return;
				}
				updateState(
					ctx,
					(msg) => reapply(pi, ctx, msg),
					(s) => {
						s.versionColored = v === "all" ? 2 : v === "pi" ? 1 : 0;
						return `Version label color: ${["OFF", "Pi only", "Pi+ver"][s.versionColored]}`;
					},
					true,
				);
				return;
			}
			updateState(
				ctx,
				(msg) => reapply(pi, ctx, msg),
				(s) => {
					s.versionColored = (s.versionColored + 1) % 3;
					return `Version label color: ${["OFF", "Pi only", "Pi+ver"][s.versionColored]}`;
				},
				true,
			);
			return;
		},
	});

	pi.registerCommand("hm", {
		description: "Toggle Minecraft-style ON/OFF",
		handler: async (_args, ctx) => {
			updateState(
				ctx,
				(msg) => reapply(pi, ctx, msg),
				(s) => {
					s.gradientOn = !s.gradientOn;
					return `Minecraft-style: ${s.gradientOn ? "ON" : "OFF"}`;
				},
			);
		},
	});

	pi.registerCommand("hdf", {
		description: "Reset pi-cc-header to developer defaults (overwrites config)",
		handler: async (_args, ctx) => {
			setState({ ...DEFAULT_STATE });
			setFramesDirty(true);
			recomputeFrames();
			invalidateStats();
			reapply(pi, ctx, "Reset to developer defaults");
		},
	});

	pi.registerCommand("hsp", {
		description:
			"Animation speed: no args = show; <number> = set (25 50 75 100)",
		handler: async (args, ctx) => {
			if (!args) {
				const state = getState();
				ctx.ui.notify(
					`Animation speed: ${state.logoInterval}ms. Available: ${SPEEDS.join(" ")}`,
					"info",
				);
				return;
			}
			const n = Number(args);
			if (!(SPEEDS as readonly number[]).includes(n)) {
				ctx.ui.notify(
					`Invalid speed: "${n}". Available: ${SPEEDS.join(" ")}`,
					"error",
				);
				return;
			}
			updateState(
				ctx,
				(msg) => reapply(pi, ctx, msg),
				(s) => {
					s.logoInterval = n as (typeof SPEEDS)[number];
					return `Animation speed: ${s.logoInterval}ms`;
				},
			);
		},
	});

	pi.registerCommand("hs", {
		description:
			"Slogan: no args = on/off; <text> = set; -c = toggle color; -d = delete",
		handler: async (args, ctx) => {
			updateState(
				ctx,
				(msg) => reapply(pi, ctx, msg),
				(s) => {
					if (!args) {
						if (!s.slogan) {
							ctx.ui.notify(
								"Command unavailable: no slogan set. Use /hs <text> to set one.",
								"error",
							);
							return null;
						}
						s.sloganOn = !s.sloganOn;
						return s.sloganOn ? "Slogan: ON" : "Slogan: OFF";
					}
					if (args === "-c") {
						s.sloganColor = !s.sloganColor;
						return `Slogan color: ${s.sloganColor ? "ON" : "OFF"}`;
					}
					if (args === "-d") {
						s.slogan = "";
						s.sloganOn = false;
						return "Slogan: deleted";
					}
					const text = args.trim();
					if (!text) {
						ctx.ui.notify(
							`Invalid slogan: "". Slogan must be between 1 and ${MAX_SLOGAN_LENGTH} characters.`,
							"error",
						);
						return null;
					}
					if (text.length > MAX_SLOGAN_LENGTH) {
						ctx.ui.notify(
							`Invalid slogan: "${text}". Slogan must be between 1 and ${MAX_SLOGAN_LENGTH} characters.`,
							"error",
						);
						return null;
					}
					s.slogan = text;
					s.sloganOn = true;
					return `Slogan: ${text}`;
				},
			);
		},
	});

	pi.registerCommand("hcl", {
		description: "Clear all pi-cc-header config for clean uninstall",
		handler: async (_args, ctx) => {
			const s = readSettings(settingsPath);
			if (!s) {
				ctx.ui.notify(
					"pi-cc-header: settings.json is corrupted or unreadable. A backup has been created.",
					"error",
				);
				return;
			}
			delete s.ccHeader;
			delete s.quietStartup;
			delete s.clearOnStart;
			saveSettings(settingsPath, s);
			setState({ ...DEFAULT_STATE, disabled: true });
			setActiveHeader(undefined);
			ctx.ui.setHeader(undefined);
			ctx.ui.notify(
				"pi-cc-header Config: cleared. You can now uninstall the package.",
				"info",
			);
		},
	});
}
