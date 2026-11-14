---
name: setup-feishu-work
description: 给一个新项目初始化飞书工作区（项目目录 + 工单看板 Base + 工单表），字段来自 board.contract.json。当需要为新项目搭飞书工单表时使用。
disable-model-invocation: true
---

# 初始化飞书工作区

一个命令，做三件事：

```bash
node .pi/skills/setup-feishu-work/scripts/setup.mjs --dry-run   # 先预览
node .pi/skills/setup-feishu-work/scripts/setup.mjs             # 真执行
```

1. 在「我的项目」下建项目目录（项目名取 git 仓库目录名）
2. 建 `<项目名> 工单看板` Base，里面一张「工单」表，字段来自 `board.contract.json`
3. 把 bot 加为工单表协作者（`view`）

产物记录在 `.pi/feishu-work.json`：父目录 / 项目目录 / Base 的 token 和 url、表 id、bot open_id。

## 契约

`board.contract.json` **只描述工单表的字段**。别的东西不在里面：

| 东西                                    | 在哪     |
| --------------------------------------- | -------- |
| 字段名、类型、选项、公式                | 契约     |
| 父目录「我的项目」                      | 脚本常量 |
| 表名「工单」、Base 名 `<项目> 工单看板` | 脚本常量 |

字段写法：`{name, type}` + 该类型的必要配置（`select` 带 `options`，`formula` 带 `expression`，`link` 带 `link_table: "self"`）。`primary: true` 的那个必须是 `text`，它排在第一位。

只有三个字段带 `description`（验收标准、验收结果、来源），因为它们的值有格式约定，agent 读表时需要看到。其余字段不加。

## 纪律

1. **只有 create，没有 update**。字段建错了就手动改，或者删掉 Base 重来。改契约不会影响已建好的表。
2. **`.pi/feishu-work.json` 存在就拒绝执行**——防止手滑建出第二套目录和 Base，让 runner 静默指向空表。重建先删它。
3. **不碰 `.pi/feishu.json`**，那是老系统的状态文件，两套系统互不相干。
4. **父目录会复用**（多项目共享一个「我的项目」），项目目录以下一律新建。

## bot 协作者

脚本最后把 bot 加为工单表的 `view` 协作者。

加协作者时 `--member-type` 必须用 `openid`（open_id 由 `lark-cli api GET /open-apis/bot/v3/info --as bot --jq .data.open_id` 现取），飞书官方枚举里没有 `appid`。
