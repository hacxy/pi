import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import {
	getState,
	setState,
	stateFromConfig,
	readSettings,
	saveSettings,
	setScreenCleared,
	isScreenCleared,
	setFramesDirty,
} from "./state";
import { invalidateStats } from "./stats";
import { recomputeFrames, updateLogoParams } from "./logo";
import { apply } from "./ui";
import { registerCommands } from "./commands";

export default function (pi: ExtensionAPI) {
	const settingsPath = join(
		process.env.HOME ?? "",
		".pi",
		"agent",
		"settings.json",
	);

	let isResuming = false;

	pi.on("session_before_switch", (event, _ctx) => {
		if (event.reason === "resume") {
			isResuming = true;
		}
	});

	pi.on("session_start", (event, ctx) => {
		const s = readSettings(settingsPath);
		if (!s) {
			ctx.ui.notify(
				"pi-cc-header: settings.json is corrupted or unreadable. A backup has been created and a fresh default restored.",
				"error",
			);
			return;
		}
		const h = (s.ccHeader ?? {}) as Record<string, unknown>;
		const newState = stateFromConfig(h);
		setState(newState);

		if (getState().disabled) return;

		if (!isScreenCleared()) {
			setScreenCleared(true);
			process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
		}

		invalidateStats();
		setFramesDirty(true);
		const state = getState();
		updateLogoParams(state.logoColorKey, state.gradientOn);
		recomputeFrames();

		const skipAnimation =
			event.reason === "reload" ||
			isResuming ||
			(event.reason === "startup" &&
				(process.argv.includes("-r") ||
					process.argv.includes("--resume") ||
					process.argv.includes("--session")));
		if (isResuming) isResuming = false;

		setTimeout(() => apply(pi, ctx, "none", skipAnimation), 0);
	});

	registerCommands(pi);
}
