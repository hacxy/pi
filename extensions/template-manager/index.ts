import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

interface Template {
	name: string;
	repo: string;
}

interface Config {
	templates: Template[];
}

const CONFIG_PATH = join(
	process.env.HOME ?? "",
	".pi",
	"agent",
	"template-manager.json",
);

const LOCK_FILES = [
	"package-lock.json",
	"pnpm-lock.yaml",
	"bun.lockb",
	"yarn.lock",
];

function readConfig(): Config {
	if (!existsSync(CONFIG_PATH)) {
		const defaultConfig: Config = { templates: [] };
		writeFileSync(
			CONFIG_PATH,
			JSON.stringify(defaultConfig, null, 2) + "\n",
			"utf-8",
		);
		return defaultConfig;
	}
	return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function writeConfig(config: Config): void {
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function findTemplate(config: Config, name: string): Template | undefined {
	return config.templates.find((t) => t.name === name);
}

type ProgressCallback = (message: string, progress: number) => void;

function cloneTemplate(
	repo: string,
	dest: string,
	onProgress?: ProgressCallback,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const url = `https://github.com/${repo}.git`;
		const proc = spawn(
			"git",
			["clone", "--depth", "1", "--progress", url, "."],
			{
				cwd: dest,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);

		let stderr = "";

		proc.stderr?.on("data", (data: Buffer) => {
			const chunk = data.toString();
			stderr += chunk;

			// Split by \r to get individual progress updates
			const lines = chunk.split(/\r/);

			const patterns = [
				{
					regex: /remote:\s+Counting objects:\s+(\d+)%/,
					phase: "Counting objects",
				},
				{
					regex: /remote:\s+Compressing objects:\s+(\d+)%/,
					phase: "Compressing objects",
				},
				{ regex: /Receiving objects:\s+(\d+)%/, phase: "Receiving objects" },
				{ regex: /Resolving deltas:\s+(\d+)%/, phase: "Resolving deltas" },
			];

			let lastMatch: { phase: string; percent: number } | null = null;

			for (const line of lines) {
				for (const { regex, phase } of patterns) {
					const match = line.match(regex);
					if (match) {
						lastMatch = { phase, percent: parseInt(match[1], 10) };
					}
				}
			}

			if (lastMatch) {
				const mapped = 30 + Math.floor(lastMatch.percent * 0.4);
				onProgress?.(`${lastMatch.phase}: ${lastMatch.percent}%`, mapped);
			}
		});

		proc.on("error", (err) => {
			rmSync(dest, { recursive: true, force: true });
			reject(err);
		});

		proc.on("close", (code) => {
			if (code !== 0) {
				rmSync(dest, { recursive: true, force: true });
				reject(new Error(`git clone failed with exit code ${code}`));
				return;
			}

			onProgress?.("Removing .git directory...", 80);
			rmSync(join(dest, ".git"), { recursive: true, force: true });
			onProgress?.("Removing lock files...", 90);
			for (const lock of LOCK_FILES) {
				rmSync(join(dest, lock), { force: true });
			}
			onProgress?.("Done!", 100);
			resolve();
		});
	});
}

export default function (pi: ExtensionAPI) {
	// /tpl-list — 列出所有模板
	pi.registerCommand("tpl-list", {
		description: "List all project templates",
		handler: async (_args, ctx) => {
			const config = readConfig();
			if (config.templates.length === 0) {
				ctx.ui.notify(
					"No templates configured. Use /tpl-add to add one.",
					"info",
				);
				return;
			}
			const lines = config.templates.map(
				(t) => `  ${t.name.padEnd(20)} ${t.repo}`,
			);
			ctx.ui.notify(`Templates:\n${lines.join("\n")}`, "info");
		},
	});

	// /tpl-add — 添加模板
	pi.registerCommand("tpl-add", {
		description: "Add a project template",
		argumentHint: "<name> <user/repo>",
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
			const name = parts[0];
			const repo = parts[1];

			if (!name || !repo) {
				ctx.ui.notify("Usage: /tpl-add <name> <user/repo>", "error");
				return;
			}

			const config = readConfig();
			if (findTemplate(config, name)) {
				ctx.ui.notify(
					`Template "${name}" already exists. Remove it first with /tpl-remove.`,
					"error",
				);
				return;
			}

			config.templates.push({ name, repo });
			writeConfig(config);
			ctx.ui.notify(`Added: ${name} → ${repo}`, "info");
		},
	});

	// /tpl-remove — 移除模板
	pi.registerCommand("tpl-remove", {
		description: "Remove a project template",
		argumentHint: "<name>",
		getArgumentCompletions: (prefix) => {
			const config = readConfig();
			const items = config.templates.map((t) => ({
				value: t.name,
				label: t.name,
				description: t.repo,
			}));
			if (!prefix) return items;
			return items.filter((i) => i.value.startsWith(prefix));
		},
		handler: async (args, ctx) => {
			const name = (args ?? "").trim().split(/\s+/)[0];
			if (!name) {
				ctx.ui.notify("Usage: /tpl-remove <name>", "error");
				return;
			}

			const config = readConfig();
			const idx = config.templates.findIndex((t) => t.name === name);
			if (idx === -1) {
				ctx.ui.notify(`Template "${name}" not found.`, "error");
				return;
			}

			config.templates.splice(idx, 1);
			writeConfig(config);
			ctx.ui.notify(`Removed: ${name}`, "info");
		},
	});

	// /tpl-new — 从模板创建项目
	pi.registerCommand("tpl-new", {
		description: "Create a new project from a template",
		argumentHint: "<template> <project-name>",
		getArgumentCompletions: (prefix) => {
			const config = readConfig();
			const parts = (prefix ?? "").trim().split(/\s+/);
			const items = config.templates.map((t) => ({
				value: t.name,
				label: t.name,
				description: t.repo,
			}));

			if (parts.length <= 1) {
				if (!prefix) return items;
				return items.filter((i) => i.value.startsWith(parts[0]));
			}

			return [];
		},
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
			const templateName = parts[0];
			const projectName = parts[1];

			if (!templateName) {
				ctx.ui.notify("Usage: /tpl-new <template> <project-name>", "error");
				return;
			}

			const config = readConfig();
			const template = findTemplate(config, templateName);
			if (!template) {
				const available =
					config.templates.map((t) => t.name).join(", ") || "none";
				ctx.ui.notify(
					`Template "${templateName}" not found. Available: ${available}`,
					"error",
				);
				return;
			}

			const name = projectName ?? templateName;
			const dest = resolve(ctx.cwd, name);

			if (existsSync(dest)) {
				ctx.ui.notify(`Directory "${name}" already exists.`, "error");
				return;
			}

			try {
				mkdirSync(dest, { recursive: true });
				await cloneTemplate(template.repo, dest);
				ctx.ui.notify(
					`Project "${name}" created from template "${templateName}".`,
					"info",
				);
			} catch (err: any) {
				rmSync(dest, { recursive: true, force: true });
				ctx.ui.notify(`Failed: ${err.message}`, "error");
			}
		},
	});

	// AI 工具：管理模板配置
	pi.registerTool({
		name: "manage_templates",
		label: "Manage Templates",
		description:
			"Add, remove, or list project templates. Templates are stored in ~/.pi/agent/template-manager.json.",
		parameters: Type.Object({
			action: Type.Union(
				[Type.Literal("add"), Type.Literal("remove"), Type.Literal("list")],
				{ description: "Action to perform" },
			),
			name: Type.Optional(
				Type.String({ description: "Template name (required for add/remove)" }),
			),
			repo: Type.Optional(
				Type.String({
					description: "GitHub repo as user/repo (required for add)",
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const config = readConfig();

			if (params.action === "list") {
				if (config.templates.length === 0) {
					return {
						content: [{ type: "text", text: "No templates configured." }],
						details: {},
					};
				}
				const lines = config.templates.map((t) => `${t.name} → ${t.repo}`);
				return {
					content: [{ type: "text", text: lines.join("\n") }],
					details: {},
				};
			}

			if (params.action === "add") {
				if (!params.name || !params.repo) {
					return {
						content: [
							{
								type: "text",
								text: "Both name and repo are required for add.",
							},
						],
						details: {},
					};
				}
				if (findTemplate(config, params.name)) {
					return {
						content: [
							{
								type: "text",
								text: `Template "${params.name}" already exists.`,
							},
						],
						details: {},
					};
				}
				config.templates.push({ name: params.name, repo: params.repo });
				writeConfig(config);
				return {
					content: [
						{ type: "text", text: `Added: ${params.name} → ${params.repo}` },
					],
					details: {},
				};
			}

			if (params.action === "remove") {
				if (!params.name) {
					return {
						content: [{ type: "text", text: "Name is required for remove." }],
						details: {},
					};
				}
				const idx = config.templates.findIndex((t) => t.name === params.name);
				if (idx === -1) {
					return {
						content: [
							{ type: "text", text: `Template "${params.name}" not found.` },
						],
						details: {},
					};
				}
				config.templates.splice(idx, 1);
				writeConfig(config);
				return {
					content: [{ type: "text", text: `Removed: ${params.name}` }],
					details: {},
				};
			}

			return {
				content: [{ type: "text", text: `Unknown action: ${params.action}` }],
				details: {},
			};
		},
	});

	// AI 工具：从模板库创建项目
	pi.registerTool({
		name: "create_from_template",
		label: "Create from Template",
		description:
			"Create a new project from the project template library. " +
			"Call this FIRST when the user wants to create/scaffold/initialize a new project. " +
			"If no matching template exists, fall back to other methods.",
		parameters: Type.Object({
			template: Type.String({
				description: "Template name from the template library",
			}),
			projectName: Type.String({
				description: "Project directory name to create",
			}),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const config = readConfig();
			const template = findTemplate(config, params.template);

			if (!template) {
				const available =
					config.templates.length > 0
						? `Available: ${config.templates.map((t) => t.name).join(", ")}`
						: "No templates configured. Use manage_templates to add one.";
				return {
					content: [
						{
							type: "text",
							text: `Template "${params.template}" not found. ${available}`,
						},
					],
					details: {},
				};
			}

			const dest = resolve(ctx.cwd, params.projectName);

			if (existsSync(dest)) {
				return {
					content: [
						{
							type: "text",
							text: `Directory "${params.projectName}" already exists.`,
						},
					],
					details: {},
				};
			}

			try {
				onUpdate?.({
					content: [{ type: "text", text: "Creating directory..." }],
					details: { progress: 10 },
				});
				mkdirSync(dest, { recursive: true });

				onUpdate?.({
					content: [{ type: "text", text: `Cloning ${template.repo}...` }],
					details: { progress: 30 },
				});
				await cloneTemplate(template.repo, dest, (message, progress) => {
					onUpdate?.({
						content: [{ type: "text", text: message }],
						details: { progress },
					});
				});

				onUpdate?.({
					content: [{ type: "text", text: "Done!" }],
					details: { progress: 100 },
				});

				return {
					content: [
						{
							type: "text",
							text: `Project "${params.projectName}" created from template "${params.template}" (${template.repo}).`,
						},
					],
					details: { progress: 100 },
				};
			} catch (err: any) {
				rmSync(dest, { recursive: true, force: true });
				return {
					content: [
						{ type: "text", text: `Failed to create project: ${err.message}` },
					],
					details: { error: true },
				};
			}
		},
		renderResult(result, { isPartial }, theme, context) {
			const progress = result.details?.progress ?? 0;
			const message = result.content?.[0]?.text ?? "";

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

			if (result.details?.error) {
				return new Text(theme.fg("error", `✗ ${message}`), 0, 0);
			}

			return new Text(theme.fg("success", `✓ ${message}`), 0, 0);
		},
	});
}
