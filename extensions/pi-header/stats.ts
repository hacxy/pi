import { existsSync } from "node:fs";
import { join } from "node:path";
import type { StatsResult } from "./types";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function computeStats(pi: ExtensionAPI, ctx: { cwd: string }): StatsResult {
	const home = process.env.HOME ?? "";
	const commands = pi.getCommands();

	const extensionPaths = new Set<string>();
	let prompts = 0;

	for (const cmd of commands) {
		switch (cmd.source) {
			case "extension": {
				const path = cmd.sourceInfo?.path;
				if (path && !path.startsWith("<inline:")) extensionPaths.add(path);
				break;
			}
			case "prompt":
				prompts++;
				break;
		}
	}

	const globalAgents = existsSync(join(home, ".pi", "agent", "AGENTS.md"));
	const projectAgents =
		existsSync(join(ctx.cwd, "AGENTS.md")) ||
		existsSync(join(ctx.cwd, ".pi", "AGENTS.md"));

	return {
		extensions: extensionPaths.size,
		skills: commands.filter((c) => c.source === "skill").length,
		prompts,
		agents:
			globalAgents && projectAgents
				? "Aa"
				: globalAgents
					? "A"
					: projectAgents
						? "a"
						: "",
	};
}

let cachedStats: StatsResult | null = null;

export function getCachedStats(
	pi: ExtensionAPI,
	ctx: { cwd: string },
): StatsResult {
	cachedStats ??= computeStats(pi, ctx);
	return cachedStats;
}

export function invalidateStats(): void {
	cachedStats = null;
}
