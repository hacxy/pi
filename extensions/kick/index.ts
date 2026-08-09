import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * kick — 项目脚手架扩展
 *
 * 封装 @hacxy/kick CLI（本地全局 kick 优先，缺失时 npx 兜底）。
 * 模板库随 @hacxy/kick 包发布，本扩展无状态、无配置文件。
 *
 * 注意：保持本地全局 kick 为最新版本（npm i -g @hacxy/kick@latest），
 * 否则"本地优先"会命中过旧的模板列表。
 *
 * 关键约束：kick 缺参数或目标目录已存在非空时进入 inquirer 交互模式，
 * 在非 TTY 下会挂起。因此本扩展总是传全 <template> <projectName>，
 * 并在调用前自行检查目录冲突。
 */

const KICK_PACKAGE = "@hacxy/kick@latest";
const TIMEOUT_MS = 120_000;
const STRIP_ANSI = /\x1b\[[0-9;]*m/g;

interface KickTemplate {
	name: string;
	description: string;
}

interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
}

function execKick(
	cmd: string,
	args: string[],
	opts: { cwd: string; signal?: AbortSignal },
): Promise<ExecResult> {
	return new Promise((resolve, reject) => {
		const proc: ChildProcess = spawn(cmd, args, {
			cwd: opts.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
			signal: opts.signal,
		});

		let stdout = "";
		let stderr = "";
		let settled = false;

		const timer = setTimeout(() => {
			proc.kill();
			reject(new Error(`kick timed out after ${TIMEOUT_MS / 1000}s`));
		}, TIMEOUT_MS);

		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("error", (err: NodeJS.ErrnoException) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(err); // 含 ENOENT（命令不存在）
		});

		proc.on("close", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({ stdout, stderr, code: code ?? -1 });
		});
	});
}

// 本地全局 kick 优先；ENOENT 时用 npx 兜底
async function runKick(
	args: string[],
	opts: { cwd: string; signal?: AbortSignal },
): Promise<ExecResult> {
	try {
		return await execKick("kick", args, opts);
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") throw err;
	}
	return execKick("npx", ["--yes", KICK_PACKAGE, ...args], opts);
}

// 解析 `kick list` 输出（条目为 "  <name>  <description>"，两空格缩进）
function parseTemplates(stdout: string): KickTemplate[] {
	const templates: KickTemplate[] = [];
	for (const line of stdout.split("\n")) {
		const match = line.replace(STRIP_ANSI, "").match(/^\s{2}(\S+)\s+(.*)$/);
		if (match) {
			templates.push({ name: match[1], description: match[2].trim() });
		}
	}
	return templates;
}

// 从 kick 输出中提取可读的错误信息
function formatError(result: ExecResult): string {
	const text = `${result.stderr}\n${result.stdout}`
		.replace(STRIP_ANSI, "")
		.trim();
	if (!text) return `kick failed with exit code ${result.code}`;
	const lines = text.split("\n").filter(Boolean);
	return lines.slice(-6).join(" | ");
}

async function listTemplates(opts: {
	cwd: string;
	signal?: AbortSignal;
}): Promise<{ templates: KickTemplate[]; error?: string }> {
	const result = await runKick(["list"], opts);
	if (result.code !== 0) {
		return { templates: [], error: formatError(result) };
	}
	return { templates: parseTemplates(result.stdout) };
}

async function createProject(
	templateName: string,
	projectName: string,
	opts: { cwd: string; signal?: AbortSignal },
	onUpdate?: (message: string, progress: number) => void,
): Promise<{ ok: boolean; message: string }> {
	const dest = resolve(opts.cwd, projectName);

	// 目录冲突必须在调用 kick 前拦截：
	// kick 对已存在的非空目录会进入 inquirer 确认，非 TTY 下挂起
	if (existsSync(dest)) {
		return { ok: false, message: `Directory "${projectName}" already exists.` };
	}

	// 先校验模板存在，避免把未知模板名传给 kick
	onUpdate?.("Checking templates...", 10);
	const { templates, error } = await listTemplates(opts);
	if (error) {
		return { ok: false, message: `Failed to list templates: ${error}` };
	}
	const found = templates.find((t) => t.name === templateName);
	if (!found) {
		const available = templates.map((t) => t.name).join(", ") || "none";
		return {
			ok: false,
			message: `Template "${templateName}" not found. Available: ${available}`,
		};
	}

	onUpdate?.(`Creating "${projectName}" from ${templateName}...`, 50);
	const result = await runKick(["new", templateName, projectName], opts);
	if (result.code !== 0) {
		return { ok: false, message: formatError(result) };
	}

	onUpdate?.(`Created! cd ${projectName} && pnpm install`, 100);
	return {
		ok: true,
		message: `Project "${projectName}" created from template "${templateName}".`,
	};
}

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

export default function (pi: ExtensionAPI) {
	registerCommands(pi);
	registerTools(pi);
}

function registerCommands(pi: ExtensionAPI) {
	// /kick-list — 列出所有模板
	pi.registerCommand("kick-list", {
		description: "List available project templates from the kick library",
		handler: async (_args, ctx) => {
			try {
				const { templates, error } = await listTemplates({
					cwd: ctx.cwd,
					signal: ctx.signal,
				});
				if (error) {
					ctx.ui.notify(`Failed: ${error}`, "error");
					return;
				}
				if (templates.length === 0) {
					ctx.ui.notify("No templates found in the kick library.", "info");
					return;
				}
				const lines = templates.map(
					(t) => `  ${t.name.padEnd(12)} ${t.description}`,
				);
				ctx.ui.notify(
					`Templates (${templates.length}):\n${lines.join("\n")}`,
					"info",
				);
			} catch (err) {
				ctx.ui.notify(`Failed: ${errorMessage(err)}`, "error");
			}
		},
	});

	// /kick-new — 从模板创建项目
	pi.registerCommand("kick-new", {
		description:
			"Create a new project from a kick template. Usage: /kick-new <template> <project-name>",
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
			const templateName = parts[0];
			const projectName = parts[1];

			if (!templateName) {
				ctx.ui.notify("Usage: /kick-new <template> <project-name>", "error");
				return;
			}

			try {
				const result = await createProject(templateName, projectName, {
					cwd: ctx.cwd,
					signal: ctx.signal,
				});
				ctx.ui.notify(result.message, result.ok ? "info" : "error");
			} catch (err) {
				ctx.ui.notify(`Failed: ${errorMessage(err)}`, "error");
			}
		},
	});
}

function registerTools(pi: ExtensionAPI) {
	// AI 工具：列出模板
	pi.registerTool({
		name: "kick_list",
		label: "Kick List",
		description:
			"List all available project templates from the kick template library (@hacxy/kick). " +
			"Each template has a name and description (e.g. react, vue, next, express, library, pi-extension). " +
			"Use this to check what templates exist before creating a project.",
		parameters: Type.Object({}),
		// pi-lens-ignore: long-parameter-list — pi.registerTool 固定 API 签名
		async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
			const { templates, error } = await listTemplates({
				cwd: ctx.cwd,
				signal,
			});
			if (error) {
				return {
					content: [
						{ type: "text", text: `Failed to list templates: ${error}` },
					],
					details: {},
				};
			}
			if (templates.length === 0) {
				return {
					content: [
						{ type: "text", text: "No templates found in the kick library." },
					],
					details: {},
				};
			}
			const lines = templates.map((t) => `${t.name} → ${t.description}`);
			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: { templates },
			};
		},
	});

	// AI 工具：从模板创建项目
	pi.registerTool({
		name: "kick_new",
		label: "Kick New",
		description:
			"Create a new project from the kick template library (@hacxy/kick). " +
			"Call this FIRST when the user wants to create/scaffold/initialize a new project. " +
			"Templates: react, vue, next, express, library, pi-extension (use kick_list for the full list). " +
			"If no matching template exists, fall back to other methods.",
		parameters: Type.Object({
			template: Type.String({
				description: "Template name from the kick library",
			}),
			projectName: Type.String({
				description: "Project directory name to create",
			}),
		}),
		// pi-lens-ignore: long-parameter-list — pi.registerTool 固定 API 签名
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			try {
				const result = await createProject(
					params.template,
					params.projectName,
					{ cwd: ctx.cwd, signal },
					(message, progress) => {
						onUpdate?.({
							content: [{ type: "text", text: message }],
							details: { progress },
						});
					},
				);
				if (!result.ok) {
					return {
						content: [{ type: "text", text: result.message }],
						details: { error: true },
					};
				}
				return {
					content: [{ type: "text", text: result.message }],
					details: { progress: 100 },
				};
			} catch (err) {
				return {
					content: [
						{
							type: "text",
							text: `Failed to create project: ${errorMessage(err)}`,
						},
					],
					details: { error: true },
				};
			}
		},
		renderResult(result, { isPartial }, theme, _context) {
			const details = (result.details ?? {}) as {
				progress?: number;
				error?: boolean;
			};
			const progress = details.progress ?? 0;
			const first = result.content?.[0];
			const message = first?.type === "text" ? first.text : "";

			if (isPartial) {
				const bar =
					"█".repeat(Math.floor(progress / 5)) +
					"░".repeat(20 - Math.floor(progress / 5));
				return new Text(
					theme.fg("accent", `${bar} ${progress}%`) +
						" " +
						theme.fg("muted", message),
					0,
					0,
				);
			}

			if (details.error) {
				return new Text(theme.fg("error", `✗ ${message}`), 0, 0);
			}

			return new Text(theme.fg("success", `✓ ${message}`), 0, 0);
		},
	});
}
