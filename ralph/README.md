# Ralph (issue 模式)

mattpocock 的 [afk-claude.sh](https://github.com/mattpocock/ralph-workshop-repo-001/blob/main/plans/afk-claude.sh)
移植到 pi，改造为 **GitHub issue 驱动**：自动拉取当前仓库开放、带 `afk` label 的
issues，一轮一个 issue，逐轮自主执行、反馈、提交、关闭/留言，直到没有可做的工作
或达到迭代上限。

不再需要手动传入 PRD/Plan 文档——唯一参数是迭代次数。

每一轮都是**全新的 pi 会话**（`pi -p --mode json --no-session`），上下文携带：
该 issue 的正文+评论（由脚本预取），以及最近 10 条 Ralph 提交（进度锚点）。

## 依赖

- `pi`（在 PATH 中）
- `jq`、`git`（项目需为 git 仓库，已配置 `user.email` / `user.name`）
- `gh`（已登录；脚本用 `gh issue list --label afk` 拉取任务）
- 仓库需要有 `afk` label 的开放 issue（见 `prd-to-issues` skill 的 label 约定）

## 用法

### 容器化运行（推荐：afk-run-v2）

在任意项目目录内执行，自动以当前目录为项目容器：

```bash
cd ~/Projects/my-app
~/.pi/agent/ralph/afk-run-v2 10
# 或加入 PATH 后直接用: afk-run-v2 10
```

- 容器名 = git remote origin 仓库名（无 remote 时用目录名）+ `-afk`
- 首次自动创建容器（bind 当前目录 → /workspace，技能/ralph 只读挂载），之后 `docker start` 复用；
  workspace 或 pnpm store 挂载不匹配时自动重建
- **共享 pnpm store**：宿主 store 目录以相同绝对路径挂载进容器并强制 `store-dir`，
  `.modules.yaml` 两侧记录一致——容器装完依赖后宿主 `pnpm` 不再触发"删掉重装"提示，且容器复用宿主下载缓存
- **凭据零输入**：`GH_TOKEN` ← 宿主 `gh auth token`；`DEEPSEEK_API_KEY` ← `~/.pi/agent/auth.json`；git 身份（user.name/user.email）自动从宿主全局/仓库本地配置注入容器，首次 commit 不会因 `Author identity unknown` 失败
- 无参数运行 `afk-run-v2` 进入容器交互模式（`pi`）

### 容器内/宿主直跑

```bash
# 单轮执行一个 issue（上下文文件由 afk 生成后传入）
./once /tmp/afk.XXXXXX/issue-123.md

# 循环执行，最多 10 轮（离开键盘让它自己干活）
./afk 10
```

## 每轮流程

1. `gh issue list --state open --label afk --json number,title,body,comments` 拉取全部开放 AFK issue
2. 编号升序取第一条（本轮已 ABORT/SKIP 过的编号跳过）
3. issue 物化为 markdown 上下文（编号/标题/正文/评论）传入 pi
4. agent 按 `prompt_v2.md` 执行：SKIP（不可无人值守）→ ABORT（被阻塞）→ 或实现 + 提交 + 关闭/留言
5. 下轮重拉列表：完成的 issue 已关闭 → 自然推进；未完成的留在 open → 下轮续做

## Label 约定

- `afk`：可无人值守实现的垂直切片（`afk-run-v2` 只拉这个 label）
- `hitl`：需要人工参与的切片
- 父 PRD issue 不打 label（永远不会被自动取走）

由 `prd-to-issues` skill 创建切片时自动打 label。

## 环境变量

- `RALPH_MODEL` 指定子进程模型（如 `anthropic/claude-sonnet-4`），不设置则用 pi 默认模型
- `RALPH_LOG=<file>` 把每轮最终文本追加到日志（容器化时相对路径落在 /workspace，即宿主当前目录）
- `RALPH_WRAP` 流式输出的软换行列数（默认 100）
- 容器化时 `RALPH_SKILL` 默认 `/root/.pi/agent/skills/tdd`（挂载自 `~/Projects/afk-shared/skills/tdd`），
  更新技能 = 改宿主目录，无需重建镜像

## 提交规范

提交信息遵循 **Conventional Commits**，末尾带 `Ralph: issue-<编号>` footer
（进度锚点，`git log --grep="Ralph:"` 用于识别已完成的工作），可加 `Closes #<编号>`：

```
feat: 添加链接缩短接口

- 完成任务 issue #12：实现 POST /api/links
- 决策：使用 better-sqlite3 原生 SQL
- 改动：src/routes/links.ts, src/db/schema.ts

Ralph: issue-12
```

## 退出码

| 码 | once | afk / afk-run-v2 |
|---|---|---|
| 0 | NO MORE TASKS（全部完成） | 全部完成 |
| 1 | ABORT（该 issue 被阻塞） | — |
| 2 | 本轮正常结束（完成/未完成） | 达到迭代上限仍有任务；或剩余开放 issue 全部不可工作（ABORT/SKIP） |
| 3 | 用法/参数/环境错误 | 用法/参数/环境错误（含 gh 拉取连续失败、无 git remote） |
| 4 | SKIP（HITL/父PRD/依赖未满足） | — |

## 续跑

进度在 git + GitHub issue 状态里：中断后再次运行 `afk-run-v2 N` 即可从上次继续。
未完成的 issue 保持 open（agent 已留言说明进度），下轮会重新选中它续做；
ABORT/SKIP 的 issue 只影响当次 run，下次 run 会再次尝试。

## 注意事项

- 反馈循环（`npm run test` / `npm run typecheck`）按 npm 项目假设，你的项目不同时可编辑 `prompt_v2.md` 调整
- 子进程 `pi -p` 带 `-a`（信任项目文件），以你的完整权限运行，无沙箱

## 遗留

`afk-run`（文档模式入口）与 `prompt.md`（PRD/Plan 提示词）已废弃，仅保留文件作参考，
不再维护：`afk`/`once` 已改为纯 issue 模式，直接运行 `afk-run` 会报用法错误。
