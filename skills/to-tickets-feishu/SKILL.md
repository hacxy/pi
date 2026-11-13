---
name: to-tickets-feishu
description: 把计划、规格或当前对话拆成一组曳光弹（tracer bullet）工单，每个工单标明阻塞它的工单，然后发布到飞书多维表格看板 ——理清楚阻塞关系并建立阻塞链接。
disable-model-invocation: true
---

# 转工单到飞书看板

把计划、规格或对话拆成一组**工单**——曳光弹（tracer bullet）式的垂直切片，每个工单标明**阻塞**它的其他工单。

## 流程

### 0. 确定来源

先读 `.pi/feishu.json`——本项目在飞书上的唯一入口登记表。`docs[]` 列出所有 PRD，`latest` 指向最近一份。

选来源的顺序，**命中即停**：

1. 本次会话里刚由 `write-a-prd` 生成并登记进 `docs[]` 的那一份
2. `latest` 指向的那一份
3. `docs[]` 里 `status === "active"` 且 `created_at` 最新的那一份

如果 `active` 的还有多份、且本次会话没生成新的，就把它们用编号列出来（标题 + 日期）让用户挑——**不要猜，也不要让用户贴 URL**。

`superseded` 的 PRD 一律不当来源，它已被标记作废。

`.pi/feishu.json` 不存在、或 `docs` 为空 → 退回第 1 步的「基于对话上下文」，不报错、不阻塞。

### 1. 收集上下文

基于对话里已有的内容干活。如果用户传了引用（规格路径、issue 编号或 URL），以用户的为准，抓取并读完整正文和评论；没传就用第 0 步选出来的 `docs[].url`。

如果是飞书文档URL，则使用: `lark-cli docs +fetch --doc "$URL" --doc-format markdown` 获取文档内容

### 2. 探索代码库（可选）

如果还没探索过代码库，先看看当前代码状态。工单标题和描述要用项目的领域术语，并尊重所在区域的 ADR。

留意有没有可以先重构（prefactor）、让实现更省力的地方。"先让改动变容易，再做容易的改动（Make the change easy, then make the easy change）。"

### 3. 起草垂直切片

把工作拆成**曳光弹（tracer bullet）**工单。

<vertical-slice-rules>
- 每个切片贯穿每一层（schema、API、UI、测试）的一条狭窄但完整的路径——要垂直，不要只切某一层的水平片
- 完成的切片能独立演示或验证
- 每个切片的大小要控制在单个全新上下文窗口能完成
- 任何预重构（prefactoring）都要先做
</vertical-slice-rules>

给每个工单标出**阻塞边（blocking edges）**——开工前必须先完成的其他工单。没有阻塞者的工单可以直接开工。

**大规模重构（wide refactor）是垂直切片的例外。** 大规模重构指一次机械性改动（改列名、改共享符号类型），爆炸半径（blast radius）波及整个代码库，一次编辑会同时弄坏上千个调用点，任何垂直切片都保不住绿色。别硬塞进曳光弹，改用 **expand–contract（先扩展后收缩）**：先扩展——新旧形式并存，什么都不破坏；再按爆炸半径分批迁移调用点（按包、按目录），每批一个工单、被扩展工单阻塞，因为旧形式还在，CI 每批都能保持绿色；最后收缩——没有调用者了再删旧形式，该工单被所有迁移批次阻塞。如果单批也保不住绿色，就保持顺序，但让它们共享一个集成分支，共同阻塞一个最终的集成验证（integrate-and-verify）工单——绿色只在那里兑现。

### 4. 询问用户

用编号列表呈现拆分方案。每个工单展示：

- **标题（Title）**：简短的名字
- **阻塞于（Blocked by）**：必须先完成的其他工单（如果有）
- **交付什么（What it delivers）**：这个工单做完后，哪段端到端流程能跑通

问用户：

- 粒度合适吗？（太粗 / 太细）
- 阻塞边对吗——每个工单依赖的，是不是真正卡着它的工单？
- 有没有工单该合并或再拆开？

反复迭代，直到用户批准。

### 5. 发布到飞书看板

按依赖顺序逐个创建（被依赖的先建），这样阻塞边能引用真实 record id。飞书的原生阻塞关系是同表自关联的 link 字段，「阻塞于」直接连过去。

工单住在项目的**看板**里：一个项目一个 Base，一张「工单」表，一个按状态分组的看板视图。多个需求文档共用一个看板，靠「来源」字段区分，不靠建多个板——跨文档的阻塞关系只有落在同一张表里才连得上。

<field-schema>
| 字段 | 类型 | 内容 |
|-|-|-|
| 标题 | text | 工单标题 |
| 编号 | auto_number | `NO.001` 起，创建顺序即编号顺序 |
| 状态 | select（单选） | 待办 / 进行中 / 待验收 / 已完成 / 已废弃 |
| 阻塞于 | link（自关联本表，多条） | 卡着这张工单的工单 |
| 就绪 | formula | 派生标签：状态本身，加上「待办且阻塞项全部解除」才算就绪。`已完成` 与 `已废弃` 都算解除阻塞 |
| 要构建什么 | text | 做完后能用的端到端行为，从用户视角写，不是逐层实现清单 |
| 验收标准 | text | `- [ ]` 列表 |
| 来源 | select（单选） | PRD 标题，原样取 `.pi/feishu.json` 的 `docs[].title` |
| 来源章节 | text | 如 `实现决策 › 云函数 API 契约` |
| 切片键 | text | 幂等键：`<来源文档 token>#<切片序号>`，token 取 `docs[].token`，不用解析 URL |
</field-schema>

不要写具体文件路径或代码片段——它们过时得很快。例外：如果原型产出的片段比文字更能精确表达某个决策（状态机、reducer、schema、类型形状），就内联进来，注明来自原型。只留承载决策的部分——不是可运行演示，只要关键要点。

#### 5.1 确认身份可用

所有命令用 `--as user`：Base 要归你、要能放进项目目录。

遇到 `need_user_authorization`：跑 `lark-cli auth login --domain base,drive,docs --no-wait --json`，把返回的 `verification_url` 原样发给用户并结束这一轮；用户确认后跑 `lark-cli auth login --device-code <device_code> --json` 收尾。

#### 5.2 定位或创建看板

先读仓库里的 `.pi/feishu.json`——它是本项目在飞书上的**唯一**登记表，被 `write-a-prd` 和这个 skill 共用。里面有 `board.base_token` 就直接用，跳到 5.3。

没有就按目录约定解析，缺哪层建哪层：

1. 云空间根目录就是 `项目需求池`，token 恒定：`KoVnf8XE9lHHFed7OL0cV8rGnBd`
2. 项目文件夹 token 取 `.pi/feishu.json` 的 `folder.token`；文件里也没有就按名字找（或 `lark-cli drive +create-folder` 建）`<项目名>` 文件夹
3. 在里面找名为 `<项目名> 工单看板` 的 bitable

建看板：

```bash
lark-cli base +base-create --as user \
  --name "<项目名> 工单看板" --table-name "工单" \
  --fields '[{"name":"标题","type":"text"},{"name":"状态","type":"select","multiple":false,"options":[{"name":"待办"},{"name":"进行中"},{"name":"待验收"},{"name":"已完成"},{"name":"已废弃"}]}]'

lark-cli drive +move --as user --file-token <base_token> --type bitable --folder-token <项目目录 token>
```

再把 `board` 段合并进 `.pi/feishu.json`。**用 `jq` 只替换 `.board`**，别整份重写——`.project` / `.folder` / `.docs` / `.latest` 不是你的，手搓全量 JSON 会把它们冲掉：

```bash
jq --arg n "<项目名> 工单看板" --arg bt "<base_token>" --arg tid "<table_id>" \
   --arg vid "<view_id>" --arg u "https://my.feishu.cn/base/<base_token>" \
  '.board = {name:$n, base_token:$bt, table_id:$tid, view_id:$vid, url:$u}' \
  .pi/feishu.json > .pi/feishu.json.tmp && mv .pi/feishu.json.tmp .pi/feishu.json
```

提交进 git——不提交会在换机器时建出重复看板。

#### 5.3 对齐表结构

`lark-cli base +field-list --as user --base-token <bt> --table-id <tid> --format json` 对照上表，缺哪个补哪个。补齐剩余字段：

```bash
lark-cli base +field-create --as user --base-token <bt> --table-id <tid> --json '[
  {"name":"编号","type":"auto_number"},
  {"name":"阻塞于","type":"link","link_table":"<本表 table_id>"},
  {"name":"要构建什么","type":"text"},
  {"name":"验收标准","type":"text"},
  {"name":"来源","type":"select","multiple":false,"options":[{"name":"<文档名>"}]},
  {"name":"来源章节","type":"text"},
  {"name":"切片键","type":"text"}
]'

lark-cli base +field-create --as user --base-token <bt> --table-id <tid> \
  --json '{"name":"就绪","type":"formula","expression":"IFS([状态]=\"已完成\",\"✅完成\",[状态]=\"已废弃\",\"—废弃\",[状态]=\"进行中\",\"▶进行中\",[状态]=\"待验收\",\"🔍待验收\",AND([状态]=\"待办\",COUNTIF([阻塞于].[状态],AND(CurrentValue!=\"已完成\",CurrentValue!=\"已废弃\"))=0),\"✅就绪\",TRUE(),\"⛔阻塞\")"}' \
  --i-have-read-guide
```

看板视图只在缺失时建：

```bash
lark-cli base +view-create --as user --base-token <bt> --table-id <tid> --json '{"name":"看板","type":"kanban"}'
lark-cli base +view-set-group --as user --base-token <bt> --table-id <tid> --view-id <view_id> --json '{"group_config":[{"field":"状态","desc":false}]}'
lark-cli base +view-set-visible-fields --as user --base-token <bt> --table-id <tid> --view-id <view_id> --json '{"visible_fields":["标题","编号","就绪","阻塞于","状态"]}'
```

#### 5.4 建或更新工单

幂等键是 `切片键`。每张工单先查后写：

```bash
lark-cli base +record-search --as user --base-token <bt> --table-id <tid> \
  --keyword "<来源 token>#<序号>" --search-field "切片键" --field-id "标题" --format json
```

- **命中** → `+record-batch-update` 只更新内容字段（标题 / 要构建什么 / 验收标准 / 来源 / 来源章节）。**不动状态，也不动阻塞于**——人已经推进过的状态不能被打回。
- **未命中** → `+record-batch-create`，`状态` 填 `待办`。

按依赖顺序创建（被阻塞的先建），这样建阻塞边时 record_id 都已存在。batch-create 的返回 `data.record_id_list` 顺序与提交顺序一致，据此建立「切片 N → record_id」映射。

状态约定：agent 新建时置 `待办`，开工置 `进行中`，做完置 `待验收`；`已完成` 与 `已废弃` 由人决定。skill 只在新建时写一次状态，之后不再碰它。

#### 5.5 连阻塞边

全部工单建完后统一写一遍阻塞边（分两趟，避免边建边连时对端还不存在）：

```bash
lark-cli base +record-batch-update --as user --base-token <bt> --table-id <tid> \
  --json '{"update_records":[{"record_id":"<被阻塞的>","fields":{"阻塞于":[{"id":"<阻塞它的>"}]}}]}'
```

一个工单有多个阻塞者时，把它们放进同一个数组。重跑时阻塞边**会被覆盖**，这是有意的——阻塞边属于拆分方案，人不会在表里手改它。

#### 将bot加入为这个看板的协作者

使用 lark-cli 的 drive +member-add命令，以 user 身份（你）执行：

```bash
  lark-cli drive +member-add \
    --token {token} --type bitable \
    --member-type openid \
    --member-id {id} \
    --perm view --as user --yes
```

#### 5.6 汇报

给用户：Base URL、每张工单的 `编号 → 标题 → 阻塞于`，并明确点出**就绪**的那几张。

**推进就绪工单**：凡是阻塞项全部完成的工单，就是现在该做的。纯线性依赖链的话，自然就是从前往后逐个做。

不要改动来源文档。

## lark-cli 事实与坑

全部是实测结论：

- 「看板」在 API 层只等于**多维表格的 kanban 视图**。lark-cli 没有独立的 board 域，别去找。
- 自关联字段只接受 `{"name":"阻塞于","type":"link","link_table":"<本表 table_id>"}`。多带 `multiple` / `multiple_value` 会返回 `800010701 Unrecognized key(s)`。
- link 单元格值只能是 `[{"id":"rec..."}]`。`{"link_record_ids":[...]}` 会被拒（`Cell value does not match any supported shape`）。
- 公式字段必须带 `--i-have-read-guide`，且 `expression` 在 JSON 顶层、不在 `formula` 对象里。改公式用 `+field-update`，还要再加 `--yes`。
- 派生标签必须按状态逐分支给值（用 `IFS` + 末尾 `TRUE()` 兜底）。写成 `IF(条件, "就绪", "阻塞")` 会把「非待办」和「被阻塞」压成同一个标签——已完成的工单会显示「阻塞」。
- 判断「阻塞已解除」必须把 `已完成` 和 `已废弃` 都算作解除。只算 `已完成` 时，一张工单被废弃会让下游永远卡在阻塞。
- **表名与字段名不能重名**：表叫「工单」时，正文字段就必须叫「标题」而不是「工单」，否则公式里的名字失义。改字段名会让引用它的公式失效。
- `+record-batch-create` 的 body 是 `{"create_records":[...]}`；`+record-batch-update` 的 body 是 `{"update_records":[{"record_id":...,"fields":{...}}]}`。
- `+record-list` 自 1.0.98 起默认输出 **ndjson**（落一个 `.ndjson` 文件 + manifest，`--limit` 默认 2000），不再是 markdown；要内联 JSON 用 `--format json`（其 `--limit` 上限只有 200）。`--jq` 与 `--format markdown` 互斥。以上按 lark-cli 1.0.100 实测。
- 有些命令的 `--json` 是布尔（`--format json` 的简写），给它传值会报 `flag needs an argument: --json`。建视图/字段/记录时用 `--json '<body>'`。
- `drive +delete` 是 high-risk-write，要用户确认后才加 `--yes`。**这个 skill 不删工单、不删 Base。**
