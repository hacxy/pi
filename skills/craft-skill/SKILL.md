---
name: craft-skill
description: 创建和维护 sharp、可预测的 AI agent skill 的设计原则与流程。Use when authoring a new skill or editing an existing one.
---

# Craft Skill

一个 **sharp** 的 skill，每一行都必须在 context window 中挣得自己的位置 — 教模型还不知道的东西，或者改变模型默认的行为。可预测性（Predictability）是根本美德：agent 每次运行走相同的 _过程_，而非产出相同的 _结果_。

Skill 是一个目录：`SKILL.md`（YAML frontmatter 含 `name` + `description`，然后是正文）加上可选的 `scripts/`、`references/`、`assets/`。

## 语言

用中文写 skill 时遵循三条原则：

1. **Leading word 保留英文** — 利用模型预训练中的关联。英文词（_red_、_tight_、_deep_）比中文翻译有更强的锚定效果
2. **description 中英混合** — 中文说明功能，英文确保触发准确
3. **body 用中文，首次出现的术语标注英文** — 例：「完成标准（Completion Criterion）」，之后可只用中文

## 流程（Process）

两个入口。都从下方的参考内容中取材。

**修改现有 skill 时，必须走维护（Maintain）流程。** 不要直接改 — 评估、诊断、提议、执行，然后通过子 agent 验证。唯一例外是用户明确要求单一变更且确认不需要完整审查。

### 创建（Create）

1. **找到核心（Find the core）。** 这个 skill 解决什么问题？背后站着什么工程智慧？找到 **leading word** — 让这个 skill 区别于默认行为的单一约束。见 [Leading Word](#leading-word)。
2. **写出 sharp 的内容（Write sharp）。** 规则（3-5 条，祈使语气）、反模式（Anti-patterns，2-3 个，命名的）、完成标准（Completion Criterion，可检验 + 要求彻底）。见 [完成标准](#完成标准completion-criterion)、[反模式](#反模式anti-patterns)。
3. **修剪（Prune）。** 对每一行做 no-op 测试：它在教还是在引导？都不是就删。把参考内容推到指针后面。目标：在内容允许的范围内尽量精简。见 [保持 Sharp](#保持-sharp)。
4. **验证（Verify）。** 验证结构：frontmatter 有 `name` + `description`、内部链接可解析。然后 **spawn 一个只读子 agent** 对该 skill 运行[评估清单](#评估清单evaluation-checklist)。使用 delegate 或同等通用角色，不做代码审查，只做文档评估。自审有盲区 — 子 agent 不能参与过该 skill 的编写。

### 维护（Maintain）

1. **评估（Evaluate）。** 对照[评估清单](#评估清单evaluation-checklist)逐项检查。
2. **诊断（Diagnose）。** 将发现映射到[失败模式](references/design-principles.md#failure-modes--in-depth)。先命名失败，再提修复。
3. **提议（Propose）。** 对每个诊断出的问题，说明具体改动。编辑前与用户确认。
4. **执行（Apply）。** 做改动。优先删除而非重写 — 如果一行没通过 no-op 测试，整行砍掉。
5. **验证（Verify）。** **Spawn 一个只读子 agent** 对更新后的 skill 运行[评估清单](#评估清单evaluation-checklist)。使用 delegate 或同等通用角色，不做代码审查，只做文档评估。自审有盲区 — 子 agent 不能参与过编辑。确认每个标记项现在通过。

## Leading Word

**Leading word** 利用模型预训练中已有的概念，用最少的 token 锚定整个 skill 的行为：_red_（TDD）、_tight_（反馈循环）、_deep_（模块）、_fog_（wayfinder）、_throwaway_（原型）。先找到它再写 — 让这个 skill 不同于默认行为的单一约束。优先用已有词汇而非自造。见 [设计原则 — Leading Words](references/design-principles.md#leading-words--in-depth)。

## 保持 Sharp

每一行必须通过两个测试：

1. **它在教吗？** — 模型默认不知道这个吗？
2. **它在引导吗？** — 删掉它会改变 agent 的行为吗？

两个都没过，删掉。不要重写 — 删除。在内容允许的范围内尽量精简。

### 步骤（Steps）vs 参考（Reference）

**步骤**是有序动作 — 主层级。**参考**是按需查阅的材料 — 定义、规则、示例、条件指令。一个 skill 可以全是步骤、全是参考、或两者兼有。

当 skill 有步骤时，内联的参考会埋没它们。保持步骤可见；把参考推到指针后面。

### 何时委托（When to Delegate）

两个 skill 不应承载相同内容。如果另一个 skill 拥有某个概念，调用它而非重述。只内联每个分支都需要的内容；其余推到指针后面。

## 完成标准（Completion Criterion）

每个步骤以完成标准结束 — 告诉 agent 工作已完成的条件。两个属性让它成为杠杆：

- **可检验（Checkable）** — agent 能区分「完成」和「未完成」。「理解已达成」不可检验。「一个对这个 bug 能变红的可运行命令」可以。
- **要求彻底（Exhaustive）** — 它要求充分的工作量。「生成变更列表」不彻底。「每个修改的模型都已处理」可以。

模糊的完成标准导致过早完成（Premature Completion）。在写步骤之前先锐化它。

## 反模式（Anti-patterns）

命名它们 — 比描述正确做法画出更锐利的线。

- **全面膨胀（Comprehensive bloat）** — 记录每个场景、边缘情况和回退。砍到原则，不要流程。
- **流程蔓延（Procedural sprawl）** — 本该用原则的地方写了逐步指南。模型默认就会做的步骤是 no-op — 花 token 说了等于没说。
- **重复显而易见（Restating the obvious）** — 测试：这行和默认行为有区别吗？没有就砍。
- **重复（Duplication）** — 同一含义出现在多处。每个概念只在一个权威位置。
- **实现耦合（Implementation coupling）** — 嵌入会过时的文件路径、行号、代码片段。描述接口和行为契约，不要描述位置。

## 评估清单（Evaluation Checklist）

维护现有 skill 时使用。每项映射到一个失败模式。

- [ ] **Leading word 可识别** — 能用一个词命名吗？不能说明 skill 缺少锚点
- [ ] **每行通过 no-op 测试** — 删掉它会改变行为吗？不会就砍
- [ ] **精简** — 每行都必要吗？识别什么可以推到指针后面或委托
- [ ] **反模式已命名** — skill 是否明确列出了 _不应该_ 做什么？
- [ ] **完成标准可检验** — agent 能在每个步骤区分完成和未完成吗？
- [ ] **参考在指针后面** — 非必要材料是否在外部文件中，按需加载？
- [ ] **description 每个分支一个触发词** — 有没有重复的触发词应该合并？

## 参考（References）

- [设计原则（Design Principles）](references/design-principles.md) — 完整术语表、失败模式诊断、精简技巧
- [Pi Skill Spec](references/pi_skill_spec.md) — Pi 特有的 skill 规范
