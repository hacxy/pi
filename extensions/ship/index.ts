import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface CommitOption {
	english: string;
	chinese: string;
}

export default function (pi: ExtensionAPI) {
	// Parse multiple commit options from LLM response
	function parseCommitOptions(text: string): CommitOption[] {
		const options: CommitOption[] = [];

		// Split by numbered markers (1. 2. 3. or ---)
		const blocks = text.split(/(?:^|\n)\s*(?:\d+\.|---)\s*/).filter(Boolean);

		for (const block of blocks) {
			const lines = block.trim().split("\n");
			let english = "";
			let chinese = "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.match(/^[a-z]+(\([^)]+\))?:\s+.+/)) {
					english = trimmed;
				} else if (trimmed.startsWith("# 中文描述:")) {
					chinese = trimmed.replace(/^#\s*中文描述:\s*/, "");
				} else if (trimmed.startsWith("[")) {
					// Extract Chinese from [type(scope): 中文描述] format
					const match = trimmed.match(/\[(.+)\]/);
					if (match) {
						chinese = match[1];
					}
				}
			}

			if (english) {
				// Auto-generate Chinese if missing
				if (!chinese) {
					const typeMatch = english.match(
						/^(feat|fix|refactor|chore|docs|style|test|perf|ci|build)(?:\([^)]+\))?:\s*(.+)/,
					);
					if (typeMatch) {
						const typeMap: Record<string, string> = {
							feat: "功能",
							fix: "修复",
							refactor: "重构",
							chore: "杂项",
							docs: "文档",
							style: "样式",
							test: "测试",
							perf: "性能",
							ci: "CI",
							build: "构建",
						};
						chinese = `${typeMap[typeMatch[1]] || typeMatch[1]}: ${typeMatch[2]}`;
					}
				}
				options.push({ english, chinese });
			}
		}

		return options;
	}

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
				`Analyze the staged git diff and generate EXACTLY 3 different Conventional Commits message options. Then call the git_commit tool.

IMPORTANT: The Chinese part must COMPLETELY translate the description after the colon into Chinese. Keep type(scope) in English.

Format:
1. <type>(<scope>): <english description>
   [<type>(<scope>): <中文翻译>]

2. <type>(<scope>): <english description>
   [<type>(<scope>): <中文翻译>]

3. <type>(<scope>): <english description>
   [<type>(<scope>): <中文翻译>]

Example:
1. feat(auth): add user login validation
   [feat(auth): 添加用户登录验证]

2. chore(nvim): migrate config to LazyVim
   [chore(nvim): 将配置迁移到 LazyVim]

3. fix(api): handle null response from server
   [fix(api): 处理服务器返回的空响应]

Types: feat/fix/refactor/chore/docs/style/test/perf/ci/build

Call git_commit with all 3 options joined by "---" separator.`,
				{ deliverAs: "steer" },
			);
		},
	});

	pi.registerTool({
		name: "git_commit",
		label: "Git Commit",
		description: "Create a git commit from user-selected message option",
		parameters: Type.Object({
			messages: Type.String({
				description: "3 commit message options separated by ---",
			}),
			shouldPush: Type.Boolean({
				description: "Whether to push after committing",
			}),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { messages, shouldPush } = params as {
				messages: string;
				shouldPush: boolean;
			};

			// Parse options
			const options = parseCommitOptions(messages);

			if (options.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: "Error: No valid commit messages generated",
						},
					],
					details: {},
					isError: true,
				};
			}

			// Build select list: each option shows English + Chinese
			const selectItems = options.map(
				(opt, i) => `${i + 1}. 🇺🇸 ${opt.english}\n     🇨🇳 [${opt.chinese}]`,
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

			// Use English message directly
			const finalMessage = selectedOption.english;

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
						{
							type: "text",
							text: `✅ Committed and pushed:\n${finalMessage}`,
						},
					],
					details: {},
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `✅ Committed:\n${finalMessage}`,
					},
				],
				details: {},
			};
		},
	});
}
