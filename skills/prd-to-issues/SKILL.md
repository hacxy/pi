---
name: prd-to-issues
description: 使用曳光弹（tracer bullet）垂直切片，将 PRD 拆解为可独立认领的 GitHub issues。当用户想要把 PRD 转换为 issues、创建实现工单（ticket）、或将 PRD 拆解为工作项时使用。
---

# PRD 转 Issues

使用垂直切片（曳光弹 tracer bullet），将 PRD 拆解为可独立认领的 GitHub issues。

## 流程

### 1. 定位 PRD

PRD 的 GitHub issue 编号（或 URL）应该已经在对话中, 向用户询问 PRD 的 GitHub issue 编号（或 URL）。

如果 PRD 不在你的上下文中，使用 `gh issue view <编号>` 获取它（包含评论）。

### 2. 探索代码库（可选）

如果你还没有探索过代码库，请先了解代码的当前状态。

### 3. 起草垂直切片

将 PRD 拆解为 **曳光弹（tracer bullet）** issues。每个 issue 都是一个贯穿所有集成层的端到端薄垂直切片，而不是某一层的水平切片。

切片可以是「HITL」或「AFK」类型。HITL 切片需要人工参与，例如架构决策或设计评审。AFK 切片可以在无人参与的情况下实现并合并。在可能的情况下，优先选择 AFK 而非 HITL。

<vertical-slice-rules>
- 每个切片都提供一条狭窄但完整的路径，贯穿每一层（数据模型/架构、API、UI、测试）
- 一个完成的切片本身应当是可演示或可验证的
- 优先选择多个薄切片，而不是少数厚切片
</vertical-slice-rules>

### 4. 询问用户

将提议的拆分方案以编号列表的形式呈现。对每个切片，展示：

- **标题（Title）**：简短描述性名称
- **类型（Type）**：HITL / AFK
- **依赖项（Blocked by）**：必须先完成的（如果有的话）其他切片
- **覆盖的用户故事（User stories covered）**：该切片解决了父 PRD 中的哪些用户故事

向用户提问：

- 切分的粒度是否合适？（太粗 / 太细）
- 依赖关系是否正确？
- 是否有切片应该合并或进一步拆分？
- 标记为 HITL 和 AFK 的切片是否正确？

反复迭代，直到用户批准该拆分方案。

### 5. 创建 GitHub issues

对每个已批准的切片，使用 `gh issue create` 创建 GitHub issue。使用下面的 issue 正文模板。

**Label 约定**（与 pi-afk 集成）：
- **AFK 切片**：加 `--label afk`（pi-afk 会自动实现 → 开 PR → 可选自动合并）
- **HITL 切片**：加 `--label hitl`（需人工处理，pi-afk 不会碰）

按依赖顺序创建 issues（先创建被依赖的），这样你可以在「依赖项」字段中引用真实的 issue 编号。

<issue-template>
## Parent PRD

#<parent-prd-issue-编号>

## 要构建什么

对该垂直切片的简洁描述。描述端到端行为，而不是逐层实现。引用父 PRD 的具体章节，而不是重复其内容。

## 类型（Type）

AFK / HITL

## 验收标准

- [ ] 标准 1
- [ ] 标准 2
- [ ] 标准 3

## 依赖项

- 依赖 #<issue-编号>（如果有）

如果没有依赖，则写「无 - 可以立即开始（None - can start immediately）」。

## 覆盖的用户故事

按编号引用父 PRD 中的用户故事：

- 用户故事 3
- 用户故事 7

</issue-template>

不要关闭或修改父 PRD issue。
