import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("update", {
		description: "更新 pi 本体",
		handler: async (_args, ctx) => {
			ctx.ui.notify("正在更新 pi...", "info");
			try {
				const { stdout } = await execAsync("pi update --self", {
					timeout: 180000,
				});
				ctx.ui.notify(stdout.trim(), "info");
				const reload = await ctx.ui.confirm("重新加载", "是否重新加载 pi?");
				if (reload) await ctx.reload();
			} catch (e: any) {
				ctx.ui.notify(`失败: ${e.stderr || e.message}`, "error");
			}
		},
	});

	pi.registerCommand("update-ext", {
		description: "更新扩展",
		handler: async (_args, ctx) => {
			ctx.ui.notify("正在更新扩展...", "info");
			try {
				const { stdout } = await execAsync("pi update --extensions", {
					timeout: 180000,
				});
				ctx.ui.notify(stdout.trim(), "info");
				const reload = await ctx.ui.confirm("重新加载", "是否重新加载 pi?");
				if (reload) await ctx.reload();
			} catch (e: any) {
				ctx.ui.notify(`失败: ${e.stderr || e.message}`, "error");
			}
		},
	});
}
