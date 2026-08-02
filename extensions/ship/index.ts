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
				`Analyze the staged git diff and generate a Conventional Commits message. Then call the git_commit tool with the summary and message. Use shouldPush=${JSON.stringify(shouldPush)} and ignore any push decision when noPush=${JSON.stringify(noPush)} is true.`,
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
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { summary, message, shouldPush } = params as {
				summary: string;
				message: string;
				shouldPush: boolean;
			};

			const editedMessage = await ctx.ui.editor("Edit Commit Message", message);

			if (editedMessage === undefined || editedMessage === null) {
				return {
					content: [{ type: "text", text: "Commit cancelled by user" }],
					details: {},
				};
			}

			const finalMessage = editedMessage.trim() || message;

			try {
				await execAsync(`git commit -m ${JSON.stringify(finalMessage)}`);
			} catch (e: unknown) {
				const err = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Commit failed: ${err}` }],
					details: {},
					isError: true,
				};
			}

			let doPush = shouldPush;
			if (!doPush) {
				doPush = await ctx.ui.confirm("Push", "Push to remote?");
			}

			if (doPush) {
				try {
					await execAsync("git push");
				} catch (e: unknown) {
					const err = e instanceof Error ? e.message : String(e);
					return {
						content: [
							{
								type: "text",
								text: `Committed but push failed: ${err}`,
							},
						],
						details: {},
						isError: true,
					};
				}

				return {
					content: [
						{ type: "text", text: `Committed and pushed:\n${finalMessage}` },
					],
					details: {},
				};
			}

			return {
				content: [{ type: "text", text: `Committed:\n${finalMessage}` }],
				details: {},
			};
		},
	});
}
