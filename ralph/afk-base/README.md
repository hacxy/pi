# afk-base —— 公共 AFK 隔离执行环境

> 新家：`~/.pi/agent/ralph/afk-base/`（原 `~/Projects/afk-base` 已搬入 ralph 目录）
> 容器化 ralph 入口见 `~/.pi/agent/ralph/afk-run`（推荐日常使用）

前端项目无人值守（AFK）任务用的公共 Docker 执行环境：**一个公共镜像 + 每项目一个保留容器**。
项目间隔离是唯一安全承重墙：代码、凭据、会话互不可见，公共边界只到镜像层和只读技能目录。

## 环境总览

```
宿主 Mac (OrbStack/Docker)
├── afk-base 镜像（公共，零凭据）
│   ├── node 24 + fnm（容器级版本切换，无 .nvmrc）+ corepack
│   ├── playwright chromium（E2E / 截图）
│   ├── fonts-noto-cjk（截图中文渲染，视觉回归不假 diff）
│   ├── gh CLI（issue 创建/关闭、commit/push）
│   └── pi agent（默认 deepseek / deepseek-v4-flash）
├── 每项目容器 <project>-afk（保留，不删）
│   ├── env 注入：DEEPSEEK_API_KEY / GH_TOKEN（创建时一次）
│   ├── 项目卷 <project>-workspace → /workspace（git-native 仓库）
│   └── 只读挂载：~/Projects/afk-shared/skills → /root/.pi/agent/skills
└── git 通道：容器 ↔ GitHub（宿主零挂载）
```

## 快速开始

### 1. 构建公共镜像（一次）

```bash
cd ~/.pi/agent/ralph/afk-base
bash tests/run-all.sh            # 先跑测试（7 个文件，48 项断言）
docker build -t afk-base:latest .   # 首次约几分钟（含 chromium 下载）
```

### 2. 日常入口：afk-run（容器化 ralph）

```bash
cd ~/Projects/<my-app>
~/.pi/agent/ralph/afk-run ./prd/prd.md ./plan/plan.md 10
```

自动完成：身份解析（git remote 仓库名）→ 创建/启动容器 → 凭据注入（gh auth token + auth.json）→ 容器内跑 ralph 循环。详见 `../README.md`。

### 3. 通用入口：start.sh（git-native 任务容器，非 ralph 场景）

```bash
cd ~/.pi/agent/ralph/afk-base
DEEPSEEK_API_KEY=sk-... GH_TOKEN=ghp_... ./start.sh <project>
```

## 换 node 版本（容器级状态，不需要 .nvmrc）

```bash
docker exec <project>-afk bash
fnm install 22 && fnm default 22          # 只影响这个项目容器
node --version                            # 验证
```

## 公共技能目录

`~/Projects/afk-shared/skills/` 只读挂载进所有容器（`/root/.pi/agent/skills`）。
更新技能 = 改宿主目录，容器内下次 exec 即生效，无需重建镜像。

## 故障排查

| 症状 | 处理 |
|---|---|
| `docker: ...` 连不上 | 启动 OrbStack（`open -a OrbStack`），确认 `docker info` 正常 |
| 容器内 `pi` 报认证错误 | `DEEPSEEK_API_KEY` 未注入或已失效；重建容器重新注入 |
| 容器内 push 失败 401 | `GH_TOKEN` 失效或 scope 不足（需 `repo` + `issues`）；重建容器 |
| node 版本不对 | 见上方"换 node 版本"；`fnm ls` 查看已装版本 |
| 截图中文变方块 | 确认容器内 `fc-list :lang=zh` 有输出（fonts-noto-cjk 在镜像内） |
| 项目里 playwright 版本与镜像不一致 | 项目内 `npx playwright install chromium`（网络已全通） |

## 安全边界（勿破坏）

- 镜像零凭据；凭据只在创建时注入对应项目的容器
- 只挂载当前项目的卷 + 只读技能目录；**绝不**挂载宿主 `~/.ssh`、`~/.aws`、`~/.pi/agent`
- 会话/缓存绝不跨项目共享（容器保留但互不可见）
- 网络全通是 AFK 需求；项目间隔离因此是唯一承重墙
