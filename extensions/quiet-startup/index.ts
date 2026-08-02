import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
	const settingsPath = join(
		process.env.HOME ?? "",
		".pi",
		"agent",
		"settings.json",
	);

	function readSettings(): Record<string, any> | null {
		try {
			const content = readFileSync(settingsPath, "utf-8");
			const parsed = JSON.parse(content);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
				return null;
			return parsed;
		} catch {
			return null;
		}
	}

	function saveSettings(s: Record<string, any>): void {
		writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n", "utf-8");
	}

	pi.registerCommand("qs", {
		description: "Toggle quietStartup: suppress pi default startup banner",
		handler: async (_args, ctx) => {
			const s = readSettings();
			if (!s) {
				ctx.ui.notify("Failed to read settings.json", "error");
				return;
			}

			const current = s.quietStartup === true;
			s.quietStartup = !current;
			saveSettings(s);

			ctx.ui.notify(
				`quietStartup: ${current ? "OFF" : "ON"} (takes effect next session)`,
				"info",
			);
		},
	});
}
