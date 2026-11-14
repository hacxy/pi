# 飞书文档创建步骤

这一节只管**怎么调 lark-cli**：定位项目文件夹 → 建文档 → 把结果登记进仓库。PRD 写什么内容不归这里管。

所有命令一律 `--as user`。不要用 `--as bot`：bot 建的文档归属 bot，只在事后补授权，`项目需求池` 的成员里没有 bot。

## 0. 先读本地登记表

`.pi/feishu.json` 是本项目在飞书上的唯一入口，**有它就不要再回飞书里搜**：

```bash
jq '{project, folder, latest}' .pi/feishu.json
```

- 有 `folder.token` → 直接用，跳到第 2 步
- 文件或 `folder` 不存在 → 走第 1 步

字段形状（顶层只有这五个键：`project` / `folder` / `board` / `docs` / `latest`）：

```json
{
  "project": "houseworkhub",
  "folder": { "name": "houseworkhub", "token": "...", "url": "https://my.feishu.cn/drive/folder/..." },
  "board":  { "name": "houseworkhub 工单看板", "base_token": "...", "table_id": "...", "view_id": "...",
              "url": "https://my.feishu.cn/base/..." },
  "docs": [
    { "title": "家务协作小程序 PRD（v1）", "token": "...", "url": "https://my.feishu.cn/docx/...",
      "kind": "feature", "status": "active", "created_at": "2026-11-11" }
  ],
  "latest": "..."
}
```

`kind` 取值 `feature` / `change` / `bugfix`；`status` 取值 `active` / `superseded`。看板那一份 `board` 段不归这个 skill 管，只许读、不许写。

## 1. 定位或创建项目文件夹

项目名：用 `gh` 拿当前仓库名；不是 GitHub 仓库就取当前目录名。

根文件夹 `项目需求池` 的 token 是恒定的，直接写死：`KoVnf8XE9lHHFed7OL0cV8rGnBd`。

```bash
lark-cli drive +search --query "<项目名>" --doc-types folder \
  --folder-tokens "KoVnf8XE9lHHFed7OL0cV8rGnBd" --only-title --as user --format json
```

搜不到就建：

```bash
lark-cli drive +create-folder --name "<项目名>" \
  --folder-token "KoVnf8XE9lHHFed7OL0cV8rGnBd" --as user --format json
```

命中后把 `folder` 写进登记表（已有文件就只替换 `.folder` 这一个键）：

```bash
[ -f .pi/feishu.json ] || jq -n --arg p "<项目名>" '{project:$p, docs:[], latest:null}' > .pi/feishu.json

jq --arg n "<项目名>" --arg t "<folder_token>" --arg u "<folder_url>" \
  '.folder = {name:$n, token:$t, url:$u}' \
  .pi/feishu.json > .pi/feishu.json.tmp && mv .pi/feishu.json.tmp .pi/feishu.json
```

## 2. 定标题，查重

标题模板：

| `kind` | 场景 | 标题 |
|-|-|-|
| `feature` | 新功能 / 大需求 | `<需求名> PRD` |
| `change` | 局部改动 | `<需求名> 变更 PRD` |
| `bugfix` | 修 bug | `<缺陷名> 修复 PRD` |

标题必须是项目内唯一的——看板里的「来源」字段靠它认人。建文档前先看登记表：

```bash
jq -r '.docs[] | "\(.kind)\t\(.created_at)\t\(.title)"' .pi/feishu.json
```

有近似标题就**问一句**「`<旧标题>` 已存在，这次是新建一份还是它就是本次的产物？」——只提示，不要自己改名、也不要覆盖旧文档。新标题撞车时加日期后缀：`<名称>（YYYY-MM-DD）`。

## 3. 建文档

`--content` 的 `@path` **只接受当前工作目录下的相对路径**（如 `@./.prd.tmp.md`），绝对路径报错。所以正文先落在仓库内的临时文件，建完删掉：

```bash
printf '%s' "$PRD_MARKDOWN" > ./.prd.tmp.md

# 先 dry-run 看参数形状（不写入）
lark-cli docs +create --title "<标题>" --content "@./.prd.tmp.md" --doc-format markdown \
  --parent-token "<folder_token>" --as user --dry-run

# 确认无误再真建
lark-cli docs +create --title "<标题>" --content "@./.prd.tmp.md" --doc-format markdown \
  --parent-token "<folder_token>" --as user --format json

rm -f ./.prd.tmp.md
```

从返回里取 `data.document.document_id`（= token）和 `data.document.url`，**当场落盘**，不要事后再反查。

文档归属就是你自己（`--as user`），不需要额外授权步骤。

## 4. 登记回 `.pi/feishu.json`

只追加，不改已有条目；`latest` 每次重算，不单独手改：

```bash
jq --arg title "<标题>" --arg token "<document_id>" --arg url "<document.url>" \
   --arg kind "<feature|change|bugfix>" --arg created "$(date +%F)" '
   .docs += [{title:$title, token:$token, url:$url, kind:$kind, status:"active", created_at:$created}] |
   .latest = ([.docs[] | select(.status=="active")] | last | .token)
' .pi/feishu.json > .pi/feishu.json.tmp && mv .pi/feishu.json.tmp .pi/feishu.json
```

`docs` 数组顺序就是写入顺序，`latest` 取最后一个 `status == "active"` 的条目。要作废某份 PRD 就把它 `status` 改成 `superseded`（只改标记，不删文档、不动飞书里的任何东西）。

`.pi/feishu.json` **提交进 git**——不提交的话，换机器或换会话就得重新问你要地址。

## 5. 维护 AGENTS.md 的入口指针

`AGENTS.md` 是唯一「每个会话都会加载」的通道，所以那里要留一行指针，否则其他 skill 发现不了登记表。检查并只在缺失时补：

```bash
grep -qF '.pi/feishu.json' AGENTS.md 2>/dev/null || \
  printf '本项目的飞书入口（PRD 文档 / 工单看板）见 .pi/feishu.json\n' >> AGENTS.md
```

（`AGENTS.md` 不存在时这条会创建它。文件里若已有其他内容，追加而不是覆盖。）

## 6. 事实与坑

以下结论按 **lark-cli 1.0.100** 实测，版本跨越较大时先复核一遍。
- `drive +search` 的结果在 `data.results[]`，身份字段在 `result_meta` 下（`token` / `url` / `doc_types`）；**没有 `name` 字段**，标题只在 `title_highlighted` 里且带 `<h>` 高亮标签，也没有「名称精确匹配」参数，得自己去掉标签再比对：

  ```bash
  lark-cli drive +search --query "<项目名>" --doc-types folder \
    --folder-tokens "KoVnf8XE9lHHFed7OL0cV8rGnBd" --only-title --as user --format json \
    | jq -r '.data.results[]? | [.result_meta.token, (.title_highlighted|gsub("</?h>";""))] | @tsv'
  ```

  `--only-title` 能大幅减少噪音。
- `drive files list` 只按 `--folder-token` 列目录，**不支持按名称过滤**。按名字找东西用 `+search`。
- `drive +inspect --url <url>` → `{title, token, type, url}`，一个命令认全文档/文件夹/Base。批量核验用 `drive metas batch_query --data '{"request_docs":[{"doc_token":"...","doc_type":"docx"}],"with_url":true}'`。
- `docs +create --parent-token` 只认 `folder` 类型 token。Base（bitable）要在里面建表不是这个命令的事。
- `--jq` 与 `--format markdown` 互斥；要结构化输出就用 `--format json`。
- 有些命令的 `--json` 是布尔（等价 `--format json`），给它传值会报 `flag needs an argument: --json`。
- 没把握的命令先 `lark-cli <domain> <cmd> --help`，或读随包安装的权威说明 `lark-cli skills read lark-shared`、`lark-cli skills read lark-doc`——签名会随版本漂移，别硬猜。
- 这个 skill **不删飞书文档、不改已有 PRD 正文、不碰 Base**。删文档属于人决定的事。
