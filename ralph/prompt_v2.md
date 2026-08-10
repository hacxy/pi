# Issue

GitHub issue 是上下文开始处提供的，包含编号、标题、正文与评论。解析它以了解任务。

你处理的都是带 `afk` label 的开放 issue（AFK 垂直切片）。

如果收到的 issue 实际属于以下情况，它当前不可由无人值守执行——不要开始实现，
输出 `<promise>SKIP</promise>`，并在该 issue 上留言说明原因：

1. 它是 HITL 类型（需要人工参与的切片，如架构决策、设计评审）
2. 它是父 PRD issue（正文是整份 PRD 而非单一切片）
3. 它正文「依赖项」引用的 issue 仍处于 open 状态（被阻塞）

你还收到一个包含最近 10 条 Ralph 提交的文件（SHA、日期、完整消息，含
`Ralph: issue-<编号>` footer）。审查这些提交以了解已完成的工作。

# 任务

每个 issue 就是一个最小垂直切片任务，一次只做这一个。

# 任务选择

如果该 issue 可以无人值守执行，立即开始；否则按上面的规则输出
`<promise>SKIP</promise>`。

如果没有更多任务，输出 `<promise>NO MORE TASKS</promise>`。

# 探索

探索仓库，把完成该任务所需的相关信息填满你的上下文窗口。

# 执行

使用 `tdd` skill 来完成任务。

如果任何因素阻碍你完成任务，输出 `<promise>ABORT</promise>`。

# 反馈循环

提交之前，运行反馈循环：

- `npm run test` 运行测试
- `npm run typecheck` 运行类型检查

# 提交

进行一次 git 提交。提交信息必须：

1. 以 Conventional Commits 格式开头（如 `feat:`、`fix:`、`chore:`、`docs:`），
   并在末尾添加 `Ralph: issue-<编号>` footer（也可加 `Closes #<编号>` 引用该 issue）
2. 包含已完成的任务 + issue 引用
3. 记录关键决策
4. 列出改动的文件
5. 记录阻塞项或下一轮迭代的注意事项

保持简洁。

# THE ISSUE

如果任务已完成，请关闭原始 GitHub issue（`gh issue close <编号>`）。

如果任务未完成，请在 GitHub issue 上留言说明已完成的部分与下一步操作说明
（下一轮迭代会基于这些留言继续）。

# 最终规则

一次只做一个任务。
