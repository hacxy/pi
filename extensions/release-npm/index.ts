import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

function exec(cmd: string, cwd: string): string {
	return execSync(cmd, { cwd, encoding: "utf-8" }).trim();
}

function calcVersion(current: string, bump: string): string {
	const [major, minor, patch] = current.split(".").map(Number);
	switch (bump) {
		case "major": return `${major + 1}.0.0`;
		case "minor": return `${major}.${minor + 1}.0`;
		case "patch": return `${major}.${minor}.${patch + 1}`;
		default: throw new Error(`Invalid bump type: ${bump}`);
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("release-npm", {
		description: "Release npm package with version bump",
		argumentHint: "[patch|minor|major] [--yes]",
		getArgumentCompletions: (prefix) => {
			const items = [
				{ value: "patch", label: "patch", description: "bug fixes (0.1.0 → 0.1.1)" },
				{ value: "minor", label: "minor", description: "new features (0.1.0 → 0.2.0)" },
				{ value: "major", label: "major", description: "breaking changes (0.1.0 → 1.0.0)" },
				{ value: "--yes", label: "--yes", description: "skip all confirmations" },
			];
			if (!prefix) return items;
			return items.filter(i => i.value.startsWith(prefix));
		},
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;
			const yes = args?.includes("--yes") ?? false;
			const bump = args?.split(" ").find(a => ["major", "minor", "patch"].includes(a));

			try {
				// 1. Git 状态检查
				const gitStatus = exec("git status --porcelain", cwd);
				if (gitStatus) {
					ctx.ui.notify("Working directory is not clean. Commit or stash changes first.", "error");
					return;
				}

				// 2. 读取 package.json
				const pkgPath = join(cwd, "package.json");
				if (!existsSync(pkgPath)) {
					ctx.ui.notify("No package.json found in current directory.", "error");
					return;
				}
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
				const current = pkg.version as string;

				// 3. 确定版本类型
				const bumpType = bump ?? await ctx.ui.select(
					`Current version: v${current} — select bump type`,
					["patch", "minor", "major"],
				);
				if (!bumpType) return;

				const newVersion = calcVersion(current, bumpType);

				// 4. 确认
				if (!yes) {
					const ok = await ctx.ui.confirm(
						"Release",
						`v${current} → v${newVersion}`,
					);
					if (!ok) return;
				}

				// 5. 运行测试（如果存在）
				if (pkg.scripts?.test) {
					ctx.ui.notify("Running tests...", "info");
					try {
						exec("npm test", cwd);
					} catch {
						const continueAnyway = await ctx.ui.confirm(
							"Tests failed",
							"Continue anyway?",
						);
						if (!continueAnyway) return;
					}
				}

				// 6. 更新版本号
				pkg.version = newVersion;
				writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n", "utf-8");

				// 7. Git commit + tag
				exec(`git add package.json`, cwd);
				exec(`git commit -m "chore(release): v${newVersion}"`, cwd);
				exec(`git tag v${newVersion}`, cwd);

				// 8. npm publish
				if (!yes) {
					const doPublish = await ctx.ui.confirm(
						"Publish",
						`Publish v${newVersion} to npm?`,
					);
					if (doPublish) {
						exec("npm publish", cwd);
					}
				} else {
					exec("npm publish", cwd);
				}

				// 9. Push
				exec("git push && git push --tags", cwd);

				ctx.ui.notify(`v${newVersion} released!`, "info");

			} catch (err: any) {
				ctx.ui.notify(`Release failed: ${err.message}`, "error");
			}
		},
	});

	const WORKFLOW = `name: Release

permissions:
  contents: write

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - run: npx changelogithub
        env:
          GITHUB_TOKEN: \${{secrets.GITHUB_TOKEN}}
`;

	pi.registerCommand("release-init", {
		description: "Generate GitHub Actions release workflow",
		handler: async (_args, ctx) => {
			const workflowDir = join(ctx.cwd, ".github", "workflows");
			const workflowPath = join(workflowDir, "release.yml");

			if (existsSync(workflowPath)) {
				const overwrite = await ctx.ui.confirm(
					"File exists",
					"Overwrite .github/workflows/release.yml?",
				);
				if (!overwrite) return;
			}

			mkdirSync(workflowDir, { recursive: true });
			writeFileSync(workflowPath, WORKFLOW, "utf-8");
			ctx.ui.notify("Created .github/workflows/release.yml", "info");
		},
	});
}
