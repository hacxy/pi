import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("ship", {
		description: "暂存更改、生成提交信息选项并提交",
		handler: async (args, ctx) => {
			args;

			try {
				await execAsync("git rev-parse --is-inside-work-tree");
			} catch {
				ctx.ui.notify("不是 git 仓库", "error");
				return;
			}

			await execAsync("git add .");

			const { stdout: diff } = await execAsync("git diff --cached");
			if (!diff.trim()) {
				ctx.ui.notify("没有需要提交的更改", "info");
				return;
			}

			ctx.ui.notify("正在生成提交信息...", "info");

			pi.sendMessage(
				{
					customType: "ship",
					content: `Analyze the staged git diff and call the git_commit tool with exactly 3 commit message options.\n\nEach option must have:\n- "english": Conventional Commits format (e.g. "feat(auth): add login")\n- "chinese": Complete Chinese translation (e.g. "feat(auth): 添加登录功能")\n\nIMPORTANT: type(scope) stays in English. Only translate the description after the colon.`,
					display: false,
				},
				{ deliverAs: "steer", triggerTurn: true },
			);
		},
	});

	pi.registerTool({
		name: "git_commit",
		label: "Git Commit",
		description: "从用户选择的提交信息创建 git 提交",
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
					content: [{ type: "text", text: "错误：未提供选项" }],
					details: {},
					isError: true,
				};
			}

			// Build select list
			const selectItems = options.map(
				(opt, i) => `${i + 1}. ${opt.english}\n   ${opt.chinese}`,
			);

			// Let user select
			const selected = await ctx.ui.select("选择提交信息：", selectItems);

			if (!selected) {
				return {
					content: [{ type: "text", text: "用户取消了提交" }],
					details: {},
				};
			}

			// Find selected index
			const selectedIndex = selectItems.indexOf(selected);
			const selectedOption = options[selectedIndex];

			if (!selectedOption) {
				return {
					content: [{ type: "text", text: "提交取消：选择无效" }],
					details: {},
					isError: true,
				};
			}

			// Commit with English message
			ctx.ui.notify("提交中...", "info");
			try {
				await execAsync(
					`git commit -m ${JSON.stringify(selectedOption.english)}`,
				);
			} catch (e: unknown) {
				const err = e instanceof Error ? e : new Error(String(e));
				const stderr = "stderr" in err ? (err as any).stderr : "";
				const stdout = "stdout" in err ? (err as any).stdout : "";
				const output = (stderr || stdout || err.message).toString();

				// 检查是否是 lint 错误（lint-staged 通常会返回非零退出码）
				const isLintError =
					output.includes("lint") ||
					output.includes("error") ||
					output.includes("warning") ||
					output.includes("prettier") ||
					output.includes("eslint") ||
					output.includes("biome");

				if (isLintError) {
					ctx.ui.notify("检测到 lint 错误，正在自动修复...", "warning");
					// 将 lint 错误发送给 LLM 修复
					pi.sendMessage(
						{
							customType: "ship-lint-fix",
							content: `Git commit 失败，lint-staged 报错。请修复以下 lint 错误，然后重新执行 git commit：\n\n\`\`\`\n${output}\n\`\`\`\n\n提交信息：${JSON.stringify(selectedOption.english)}\n\n请直接修复代码中的问题，修复后不要重新 commit，我会自动重试。`,
							display: true,
						},
						{ deliverAs: "steer", triggerTurn: true },
					);
					return { content: [], details: {} };
				}

				ctx.ui.notify(`提交失败：${output}`, "error");
				return { content: [], details: {}, isError: true };
			}

			// Notify commit success immediately
			ctx.ui.notify(
				`✨ 已提交：\n${selectedOption.english}\n${selectedOption.chinese}`,
				"info",
			);

			// Ask about push
			const doPush = await ctx.ui.confirm("推送", "推送到远程？");

			if (doPush) {
				ctx.ui.notify("推送中...", "info");
				try {
					await execAsync("git push");
				} catch (e: unknown) {
					const err = e instanceof Error ? e.message : String(e);
					ctx.ui.notify(`推送失败：${err}`, "error");
					return { content: [], details: {}, isError: true };
				}

				ctx.ui.notify("✨ 已推送", "info");
			}

			return { content: [], details: {}, terminate: true };
		},
	});
}
