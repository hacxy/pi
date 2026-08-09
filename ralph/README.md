# Ralph

mattpocock 的 [afk-claude.sh](https://github.com/mattpocock/ralph-workshop-repo-001/blob/main/plans/afk-claude.sh)
移植到 pi：把 PRD 拆成最小任务，一轮一个任务，逐轮自主执行、反馈、提交，
直到全部完成（`NO MORE TASKS`）或中止（`ABORT`）或达到迭代上限。

每一轮都是**全新的 pi 会话**（`pi -p --mode json --no-session`），上下文只携带
最近 10 条 Ralph 提交，记忆不跨轮累积。

## 依赖

- `pi`（在 PATH 中）
- `jq`
- `git`（项目需为 git 仓库，且已配置 `user.email` / `user.name`）

## 用法

```bash
# 单轮执行一个任务（手动逐步推进）
./once ./prd/prd.md ./plan/plan.md

# 循环执行，最多 10 轮（离开键盘让它自己干活）
./afk ./prd/prd.md ./plan/plan.md 10
```

- 两个文档顺序可变，全部作为上下文传入（agent 从文件名识别 PRD / PLAN）
- 可选环境变量 `RALPH_MODEL` 指定子进程模型（如 `anthropic/claude-sonnet-4`），
  不设置则用 pi 默认模型
- 自动加载 **TDD skill**（`--skill`）让每轮迭代遵循 red-green-refactor：默认取
  全局 skills 目录（与 `ralph/` 同层级的 `skills/tdd`），可用 `RALPH_SKILL`
  环境变量覆盖指定其他 skill 目录
- `prompt.zh.md` 可自由编辑（任务拆解、反馈循环、提交规范等都在里面）

## 提交规范

提交信息遵循 **Conventional Commits**，并在末尾带 `Ralph: <任务编号>` footer
（作为进度锚点，`git log --grep="Ralph:"` 用于识别已完成的工作）：

```
feat: 添加链接缩短接口

- 完成任务 3：实现 POST /api/links
- PRD: link-shortener
- 决策：使用 better-sqlite3 原生 SQL
- 改动：src/routes/links.ts, src/db/schema.ts

Ralph: task-3
```

## 退出码

| 码 | once | afk |
|---|---|---|
| 0 | 无更多任务 (NO MORE TASKS) | 全部完成 |
| 1 | 中止 (ABORT) | 中止 |
| 2 | 本轮正常结束，还有任务 | 达到迭代上限仍有任务（可续跑） |
| 3 | 用法/参数/环境错误 | 用法/参数/环境错误 |

## 续跑

进度全部在 git 里，中断后再次运行 `./afk ... N` 即可从上次提交继续，无需额外状态。

## 注意事项

- 反馈循环（`npm run test` / `npm run typecheck`）在原版 prompt 中按 npm 项目假设，
  你的项目不同时可编辑 `prompt.zh.md` 调整
- 子进程 `pi -p` 带 `-a`（信任项目文件），以你的完整权限运行，无沙箱
