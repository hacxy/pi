import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("ship", {
		description: "Stage changes, generate commit message options, and commit",
		handler: async (args, ctx) => {
			args;

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

			ctx.ui.notify("Generating commit messages...", "info");

			pi.sendUserMessage(
				`Analyze the staged git diff and call the git_commit tool with exactly 3 commit message options.

Each option must have:
- "english": Conventional Commits format (e.g. "feat(auth): add login")
- "chinese": Complete Chinese translation (e.g. "feat(auth): 添加登录功能")

IMPORTANT: type(scope) stays in English. Only translate the description after the colon.`,
				{ deliverAs: "steer" },
			);
		},
	});

	pi.registerTool({
		name: "git_commit",
		label: "Git Commit",
		description: "Create a git commit from user-selected message option",
		parameters: Type.Object({
			options: Type.Array(
				Type.Object({
					english: Type.String({
						description: "Conventional Commits format message",
					}),
					chinese: Type.String({
						description: "Chinese translation of the message",
					}),
				}),
				{ minItems: 1, maxItems: 5 },
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { options } = params as {
				options: Array<{ english: string; chinese: string }>;
			};

			if (options.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No options provided" }],
					details: {},
					isError: true,
				};
			}

			// Build select list
			const selectItems = options.map(
				(opt, i) => `${i + 1}. ${opt.english}\n   [${opt.chinese}]`,
			);

			// Let user select
			const selected = await ctx.ui.select(
				"Select commit message:",
				selectItems,
			);

			if (!selected) {
				return {
					content: [{ type: "text", text: "Commit cancelled by user" }],
					details: {},
				};
			}

			// Find selected index
			const selectedIndex = selectItems.indexOf(selected);
			const selectedOption = options[selectedIndex];

			if (!selectedOption) {
				return {
					content: [
						{ type: "text", text: "Commit cancelled: invalid selection" },
					],
					details: {},
					isError: true,
				};
			}

			// Commit with English message
			try {
				await execAsync(
					`git commit -m ${JSON.stringify(selectedOption.english)}`,
				);
			} catch (e: unknown) {
				const err = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Commit failed: ${err}` }],
					details: {},
					isError: true,
				};
			}

			// Ask about push
			const doPush = await ctx.ui.confirm("Push", "Push to remote?");

			if (doPush) {
				try {
					await execAsync("git push");
				} catch (e: unknown) {
					const err = e instanceof Error ? e.message : String(e);
					return {
						content: [
							{ type: "text", text: `Committed but push failed: ${err}` },
						],
						details: {},
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: `✅ Committed and pushed:\n${selectedOption.english}`,
						},
					],
					details: {},
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `✅ Committed:\n${selectedOption.english}`,
					},
				],
				details: {},
			};
		},
	});
}
