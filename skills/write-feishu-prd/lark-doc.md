# 飞书文档创建步骤

这一节只管**怎么调 lark-cli**：读登记表 → 建文档 → 给 bot 开只读 → 登记回文件。PRD 写什么内容不归这里管。

所有命令一律 `--as user`：文档归人。bot 不是创建者，只在事后补一个 `view` 协作者（第 3 步）。

## 0. 先读本地登记表

`.pi/feishu-work.json` 由 `setup-feishu-work` 生成，是本项目在飞书上的唯一入口，**有它就不要再回飞书里搜**：

```bash
jq '{project, folder, base, table, bot}' .pi/feishu-work.json
```

文件不存在 → 停下，让用户先跑初始化脚本。没有项目目录和工单表，PRD 建出来也是孤儿，这里**不代建目录、不代建看板**：

```bash
node .pi/skills/setup-feishu-work/scripts/setup.mjs --dry-run   # 先预览
node .pi/skills/setup-feishu-work/scripts/setup.mjs             # 真执行
```

setup 生成的形状：

```json
{
  "project": "houseworkhub",
  "root_folder": { "name": "我的项目", "token": "...", "url": "https://my.feishu.cn/drive/folder/..." },
  "folder": { "name": "houseworkhub", "token": "...", "url": "https://my.feishu.cn/drive/folder/..." },
  "base":  { "name": "houseworkhub 工单看板", "token": "...", "url": "https://my.feishu.cn/base/..." },
  "table": { "name": "工单", "id": "tbl..." },
  "bot":   { "open_id": "ou_..." }
}
```

`docs` 和 `latest` 是本 skill 追加的两个键，setup 生成时**没有**它们。所以读一律写成 `(.docs // [])`，写一律**只追加**，绝不整份重写——`project` / `root_folder` / `folder` / `base` / `table` / `bot` 都不是你的。

## 1. 定标题，查重

标题模板：

| `kind` | 场景 | 标题 |
|-|-|-|
| `feature` | 新功能 / 大需求 | `<需求名> PRD` |
| `change` | 局部改动 | `<需求名> 变更 PRD` |
| `bugfix` | 修 bug | `<缺陷名> 修复 PRD` |

标题必须是项目内唯一的——看板里的「来源」字段靠它认人。建文档前先看登记表：

```bash
jq -r '(.docs // [])[] | "\(.kind)\t\(.created_at)\t\(.title)"' .pi/feishu-work.json
```

有近似标题就**问一句**「`<旧标题>` 已存在，这次是新建一份还是它就是本次的产物？」——只提示，不要自己改名、也不要覆盖旧文档。新标题撞车时加日期后缀：`<名称>（YYYY-MM-DD）`。

## 2. 建文档

`--content` 的 `@path` **只接受当前工作目录下的相对路径**（如 `@./.prd.tmp.md`），绝对路径报错。所以正文先落在仓库内的临时文件，建完删掉：

```bash
printf '%s' "$PRD_MARKDOWN" > ./.prd.tmp.md

# 先 dry-run 看参数形状（不写入）
lark-cli docs +create --title "<标题>" --content "@./.prd.tmp.md" --doc-format markdown \
  --parent-token "<folder.token>" --as user --dry-run

# 确认无误再真建
lark-cli docs +create --title "<标题>" --content "@./.prd.tmp.md" --doc-format markdown \
  --parent-token "<folder.token>" --as user --format json

rm -f ./.prd.tmp.md
```

从返回里取 `data.document.document_id`（= token）和 `data.document.url`，**当场落盘**，不要事后再反查。

## 3. 给 bot 开只读

```bash
BOT_OPEN_ID=$(jq -r '.bot.open_id' .pi/feishu-work.json)

lark-cli drive +member-add --token "<document_id>" --type docx \
  --member-type openid --member-id "$BOT_OPEN_ID" --perm view \
  --as user --format json --yes
```

- `--type docx` 是云文档；看板表是 `bitable`（setup 加的就是后者），别混。
- `--token` 给裸 token 时必须带 `--type`；直接给 `document.url` 时类型能自动推断。
- open_id 从文件里的 `bot.open_id` 取，不要每次去 `GET /open-apis/bot/v3/info` 现问。
- `--perm` 默认就是 `view`，写出来只是让它显式；这是 high-risk-write，`--yes` 必带，拿不准先 `--dry-run` 看请求体。

## 4. 登记回 `.pi/feishu-work.json`

只追加 `docs`、只重算 `latest`，其他键一个都不碰：

```bash
jq --arg title "<标题>" --arg token "<document_id>" --arg url "<document.url>" \
   --arg kind "<feature|change|bugfix>" --arg created "$(date +%F)" '
   .docs = ((.docs // []) + [{title:$title, token:$token, url:$url, kind:$kind, status:"active", created_at:$created}]) |
   .latest = ([.docs[] | select(.status=="active")] | last | .token)
' .pi/feishu-work.json > .pi/feishu-work.json.tmp && mv .pi/feishu-work.json.tmp .pi/feishu-work.json
```

`docs` 数组顺序就是写入顺序，`latest` 取最后一个 `status == "active"` 的条目。要作废某份 PRD 就把它 `status` 改成 `superseded`（只改标记，不删文档、不动飞书里的任何东西）。

`.pi/feishu-work.json` **提交进 git**——它是全项目的飞书入口，不提交的话换机器或换会话就丢了。

## 5. 事实与坑

以下结论按 **lark-cli 1.0.100** 实测，版本跨越较大时先复核一遍。

- `docs +create --parent-token` 只认 `folder` 类型 token（拿 `folder.token`，不是 `root_folder.token`、更不是 `base.token`）。Base 里建表不是这个命令的事。
- 想知道飞书目录里实际有什么（绕开本地登记表）：`drive +search --query "<关键词>" --doc-types docx --only-title --folder-tokens "<folder.token>" --as user --format json`。结果在 `data.results[]`，身份字段在 `result_meta` 下（`token` / `url` / `doc_types`）；**没有 `name` 字段**，标题只在 `title_highlighted` 里且带 `<h>` 高亮标签，得先去标签再比对。
- `drive +inspect --url <url>` → `{title, token, type, url}`，一个命令认全文档/文件夹/Base。
- `--jq` 与 `--format markdown` 互斥；要结构化输出就用 `--format json`。
- 有些命令的 `--json` 是布尔（等价 `--format json`），给它传值会报 `flag needs an argument: --json`。
- 写操作记得带 `--yes`，否则会卡在交互确认上。
- 没把握的命令先 `lark-cli <domain> <cmd> --help`，或读随包安装的权威说明 `lark-cli skills read lark-shared`、`lark-cli skills read lark-doc`——签名会随版本漂移，别硬猜。
- 这个 skill **不删飞书文档、不改已有 PRD 正文、不碰 Base、不碰 setup 生成的其他字段**。删文档属于人决定的事。
