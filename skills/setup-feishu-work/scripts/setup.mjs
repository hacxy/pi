#!/usr/bin/env node
/**
 * setup-feishu-work · 给新项目建一个飞书工作区
 *
 * 只做三件事：
 *   1. 在「我的项目」下建项目目录
 *   2. 建工单看板 Base 和工单表，字段来自 board.contract.json
 *   3. 把 bot 加为工单表的协作者
 *
 * 用法：node setup.mjs [--dry-run]
 *
 * 只有 create，没有 update：字段建错了就手动改或删掉 Base 重来。
 * 已初始化过（.pi/feishu-work.json 存在）会拒绝再跑，避免建出第二套环境。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- 写死的外部接口 ----------

const ROOT_FOLDER_NAME = "我的项目"; // 所有项目共用的父目录，已存在就复用
const TABLE_NAME = "工单";
const BASE_NAME = (project) => `${project} 工单看板`;
const STATE_FILE = join(".pi", "feishu-work.json"); // 与老系统的 .pi/feishu.json 互不相干
const BOT_PERM = "view"; // bot 只读 + 评论，不给 edit

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = resolve(HERE, "..", "board.contract.json");

// ---------- 基础 ----------

const DRY_RUN = process.argv.includes("--dry-run");
const out = (m = "") => process.stdout.write(`${m}\n`);
const warn = (m) => process.stderr.write(`⚠️  ${m}\n`);

class Fatal extends Error {}

function run(args) {
  const res = spawnSync(args[0], args.slice(1), {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw new Fatal(`无法执行 ${args[0]}：${res.error.message}`);
  return res;
}

function parseJson(text, res) {
  for (let i = text.indexOf("{"); i !== -1; i = text.indexOf("{", i + 1)) {
    try {
      return JSON.parse(text.slice(i));
    } catch {}
  }
  throw new Fatal(
    `lark-cli 的输出不是 JSON：\nstdout: ${text.slice(0, 800)}\nstderr: ${(res?.stderr ?? "").slice(0, 800)}`,
  );
}

/** create-folder 的返回是 data.folder_token；保留 token/file_token 兜底。 */
const folderToken = (d) => d.data?.folder_token ?? d.data?.token ?? d.data?.file_token;

/** 统一出口：user 身份 + JSON 输出，写操作自动带 --yes。 */
function lark(args, { yes = false } = {}) {
  const full = [...args, "--as", "user", "--format", "json"];
  if (yes) full.push("--yes");
  const res = run(["lark-cli", ...full]);
  const parsed = parseJson(res.stdout || "", res);
  if (res.status !== 0 || parsed.ok === false) {
    throw new Fatal(
      `lark-cli 失败：lark-cli ${args.slice(0, 3).join(" ")}\n${JSON.stringify(parsed.error ?? parsed).slice(0, 900)}`,
    );
  }
  return parsed;
}

const C = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const FIELDS = C.fields.filter((f) => !f.$comment);

/** 契约字段 → 飞书字段定义。link_table 写 "self" 表示本表，这里换成真实 table_id。 */
function fieldSpec(f, tableId) {
  const spec = { name: f.name, type: f.type };
  if (f.description) spec.description = f.description;
  if (f.style) spec.style = f.style;
  if (f.options) {
    spec.multiple = f.multiple ?? false;
    spec.options = f.options.map((name) => ({ name }));
    if (f.default) spec.default_value = [f.default];
  }
  if (f.type === "link") {
    if (f.link_table !== "self") throw new Fatal(`字段「${f.name}」的 link_table 只支持 "self"`);
    if (!tableId) throw new Fatal(`建 link 字段「${f.name}」需要 table_id`);
    spec.link_table = tableId;
  }
  if (f.type === "formula") spec.expression = f.expression;
  return spec;
}

function projectName() {
  const res = run(["git", "rev-parse", "--show-toplevel"]);
  const top = res.status === 0 ? res.stdout.trim() : "";
  return basename(top || process.cwd());
}

// ---------- 三步 ----------

/** 父目录是多项目共享的容器，所以必须复用；项目目录以下一律新建。 */
function resolveRootFolder() {
  const files = lark(["drive", "files", "list"]).data?.files ?? [];
  const hit = files.find((f) => f.type === "folder" && f.name === ROOT_FOLDER_NAME);
  if (hit) {
    out(`· 复用已有父目录「${ROOT_FOLDER_NAME}」`);
    return { token: hit.token, url: hit.url };
  }
  const d = lark(["drive", "+create-folder", "--name", ROOT_FOLDER_NAME]);
  out(`+ 建父目录「${ROOT_FOLDER_NAME}」`);
  return { token: folderToken(d), url: d.data?.url };
}

function createProjectFolder(rootToken, project) {
  const d = lark([
    "drive", "+create-folder",
    "--name", project,
    "--folder-token", rootToken,
  ]);
  out(`+ 建项目目录「${project}」`);
  return { token: folderToken(d), url: d.data?.url };
}

function createBase(folderToken, project) {
  const primary = FIELDS.find((f) => f.primary);
  if (!primary) throw new Fatal("契约里没有 primary: true 的字段，Base 建不出来");
  if (primary.type !== "text") throw new Fatal("主字段必须是 text");

  const d = lark([
    "base", "+base-create",
    "--name", BASE_NAME(project),
    "--folder-token", folderToken,
    "--table-name", TABLE_NAME,
    "--fields", JSON.stringify([fieldSpec(primary, null)]),
    "--time-zone", "Asia/Shanghai",
  ]);

  const data = d.data ?? {};
  const app = data.app ?? data.base ?? data;
  const baseToken = data.created_base_token ?? app.app_token ?? app.base_token ?? data.app_token;
  if (!baseToken) {
    throw new Fatal(`base-create 的返回里找不到 base_token：\n${JSON.stringify(d).slice(0, 1200)}`);
  }
  out(`+ 建看板「${BASE_NAME(project)}」和表「${TABLE_NAME}」`);
  return { base_token: baseToken, url: app.url ?? data.url };
}

/** CLI 建 Base 的流程是「建默认表 → 建自己的表 → 删默认表」，所以 table_id 必须回头查，不能用 default_table_id。 */
function findTableId(baseToken) {
  const d = lark(["base", "+table-list", "--base-token", baseToken]);
  const items = d.data?.tables ?? d.data?.items ?? [];
  const hit = items.find((t) => (t.name ?? t.table_name) === TABLE_NAME);
  if (!hit) throw new Fatal(`Base 建好了，但里面找不到表「${TABLE_NAME}」`);
  return hit.id ?? hit.table_id;
}

/** formula 引用其它字段，必须最后建。 */
function createRestFields(baseToken, tableId) {
  const rest = FIELDS.filter((f) => !f.primary);
  const ordered = [
    ...rest.filter((f) => f.type !== "formula"),
    ...rest.filter((f) => f.type === "formula"),
  ];
  for (const f of ordered) {
    // formula 字段 CLI 要求先读 lark-base-field-formula.md 再带上这个确认位。
    const guide = f.type === "formula" ? ["--i-have-read-guide"] : [];
    lark([
      "base", "+field-create",
      "--base-token", baseToken,
      "--table-id", tableId,
      "--json", JSON.stringify(fieldSpec(f, tableId)),
      ...guide,
    ]);
    out(`+ 建字段「${f.name}」(${f.type})`);
  }
  return ordered.length;
}

function botOpenId() {
  const res = run(["lark-cli", "api", "GET", "/open-apis/bot/v3/info", "--as", "bot", "--jq", ".data.open_id"]);
  const id = (res.stdout || "").trim();
  if (!/^ou_/.test(id)) {
    throw new Fatal(`取不到 bot open_id（bot 身份是否已授权？）：\n${(res.stdout + res.stderr).slice(0, 400)}`);
  }
  return id;
}

function addBotToTable(baseToken) {
  const openId = botOpenId();
  lark(
    [
      "drive", "+member-add",
      "--token", baseToken,
      "--type", "bitable",
      "--member-type", "openid",
      "--member-id", openId,
      "--perm", BOT_PERM,
    ],
    { yes: true },
  );
  out(`+ 把 bot（${openId}）加为工单表协作者（${BOT_PERM}）`);
  return openId;
}

// ---------- 主流程 ----------

function printPlan(project) {
  out(`  父目录：${ROOT_FOLDER_NAME}（已存在则复用）`);
  out(`  项目目录：${project}（新建）`);
  out(`  Base：${BASE_NAME(project)}（新建）`);
  out(`  表：${TABLE_NAME}，${FIELDS.length} 个字段`);
  for (const f of FIELDS) {
    out(`    - ${f.name} (${f.type})${f.primary ? "  [主字段]" : ""}${f.options ? `  ${f.options.join("/")}` : ""}`);
  }
  out(`  工单表协作者：bot（${BOT_PERM}）`);
  out(`  状态文件：${STATE_FILE}`);
}

function main() {
  const project = projectName();
  const statePath = join(process.cwd(), STATE_FILE);

  out(`契约：${CONTRACT_PATH} (v${C.version})`);
  out(`项目：${project}`);
  out("");

  if (DRY_RUN) {
    out("将执行（--dry-run，未写任何东西）：");
    if (existsSync(statePath)) out(`  ！${STATE_FILE} 已存在，真跑会被拒绝`);
    printPlan(project);
    return;
  }

  if (existsSync(statePath)) {
    throw new Fatal(
      `已经初始化过：${statePath} 存在。\n` +
        `本脚本只建不更新，重复跑会建出第二套目录和 Base。\n` +
        `要重建请先删掉这个文件，并手动删掉飞书里对应的项目目录和 Base。`,
    );
  }

  const root = resolveRootFolder();
  const folder = createProjectFolder(root.token, project);
  const base = createBase(folder.token, project);
  const tableId = findTableId(base.base_token);
  const fieldCount = createRestFields(base.base_token, tableId);
  const openId = addBotToTable(base.base_token);

  const state = {
    project,
    root_folder: { name: ROOT_FOLDER_NAME, token: root.token, url: root.url },
    folder: { name: project, token: folder.token, url: folder.url },
    base: { name: BASE_NAME(project), token: base.base_token, url: base.url },
    table: { name: TABLE_NAME, id: tableId },
    bot: { open_id: openId },
  };
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  out("");
  out(`完成：1 个目录 + 1 个 Base + 1 张表（共 ${fieldCount + 1} 个字段）。`);
  out(`状态文件：${statePath}`);
}

try {
  main();
} catch (e) {
  if (e instanceof Fatal) {
    process.stderr.write(`\n❌ ${e.message}\n`);
    process.exit(2);
  }
  throw e;
}
