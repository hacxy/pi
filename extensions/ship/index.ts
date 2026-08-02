import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("ship", {
		description:
			"Stage changes, generate a commit message, commit, and optionally push",
		handler: async (args, ctx) => {
			const trimmedArgs = args?.trim() ?? "";
			const shouldPush = trimmedArgs === "--push";
			const noPush = trimmedArgs === "--no-push";

			try {
				await execAsync("git rev-parse --is-inside-work-tree");
			} catch {
				ctx.ui.notify("Not a git repository", "error");
				return;
			}

			await execAsync("git add .");

			const { stdout: diff } = await execAsync("git diff --cached");
			if (!diff.trim()) {
				ctx.ui.notify("No changes to commit", "info");
				return;
			}

			ctx.ui.notify("Generating commit message...", "info");

			pi.sendUserMessage(
				`Analyze the staged git diff and generate a Conventional Commits message. Then call the git_commit tool with the generated summary and message. Use shouldPush=${JSON.stringify(shouldPush)} and ignore any push decision when noPush=${JSON.stringify(noPush)} is true.`,
				{ deliverAs: "steer" },
			);
		},
	});

	pi.registerTool({
		name: "git_commit",
		label: "Git Commit",
		description:
			"Create a git commit with the provided message and optionally push",
		parameters: Type.Object({
			summary: Type.String({ description: "Short summary of the changes" }),
			message: Type.String({
				description: "Conventional Commits style commit message",
			}),
			shouldPush: Type.Boolean({
				description: "Whether to push after committing",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, toolCtx) {
			const { summary, message, shouldPush } = params as {
				summary: string;
				message: string;
				shouldPush: boolean;
			};

			const confirmed = await toolCtx.ui.confirm(
				"Confirm Commit",
				`Changes:\n${summary}\n\nCommit message:\n${message}`,
			);

			if (!confirmed) {
				return {
					content: [{ type: "text", text: "Commit cancelled by user" }],
					details: {},
				};
			}

			try {
				await execAsync(`git commit -m ${JSON.stringify(message)}`);
			} catch (e: any) {
				return {
					content: [
						{ type: "text", text: `Commit failed: ${e.stderr || e.message}` },
					],
					details: {},
					isError: true,
				};
			}

			if (shouldPush) {
				try {
					await execAsync("git push");
				} catch (e: any) {
					return {
						content: [
							{
								type: "text",
								text: `Committed but push failed: ${e.stderr || e.message}`,
							},
						],
						details: {},
						isError: true,
					};
				}

				return {
					content: [
						{ type: "text", text: `Committed and pushed:\n${message}` },
					],
					details: {},
				};
			}

			return {
				content: [{ type: "text", text: `Committed:\n${message}` }],
				details: {},
			};
		},
	});
}
