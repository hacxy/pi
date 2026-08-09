# PRD：afk-base 公共 AFK 隔离执行环境

> 注：本文档在搬移 afk-base 目录时丢失，已从会话记录恢复（v1）。

## 问题陈述

前端项目的 AFK（无人值守）任务需要一个隔离执行环境。原先基于 Tart macOS VM 的方案已被放弃（Tart 将卸载，不再使用 macOS VM）。

- 宿主上直接跑 pi agent 拥有宿主全部权限，无人值守时宿主文件/配置/凭据暴露
- 每个前端项目各自搭建环境不可复用，工具链、pi 配置、技能无法统一维护
- 项目之间的代码、凭据、会话需要互不可见（防串味）
- 需要支持 GitHub 工作流（issue 创建/关闭、commit/push）和浏览器端到端测试

## 解决方案

在本地 OrbStack（Docker）上搭建**公共** AFK 执行环境：公共基础镜像 `afk-base`（零凭据）+ 每项目一个保留容器 `<project>-afk` + 只读公共技能挂载 + 运行时 env 注入凭据。ralph/afk 工作流使用独立的容器化入口 `afk-run`（bind mount 当前目录，ralph 逻辑零改动，仅运行环境层容器化）。

## 用户故事

1. 作为前端开发者，我想要一个公共基础镜像（node/fnm/corepack/playwright/gh/pi），以便所有前端项目共享同一套 AFK 环境
2. 作为前端开发者，我想要每个项目拥有独立的保留容器，以便项目间的代码、凭据、会话互不可见
3. 作为前端开发者，我想要容器在任务结束后保留，以便分支、依赖、会话状态跨任务留存
4. 作为前端开发者，我想要 git 工作流可用（gh issue、commit/push），以便 agent 完成完整 GitHub 工作流
5. 作为前端开发者，我想要容器支持 git worktree（后续按需启用），以便多分支并行开发
6. 作为前端开发者，我想要容器内网络全通，以便 npm/gh/模型 API 正常
7. 作为前端开发者，我想要镜像零凭据、凭据在容器创建时 env 注入，以便公共镜像可安全分发
8. 作为前端开发者，我想要容器内 pi 默认 deepseek / deepseek-v4-flash，以便开箱即用
9. 作为前端开发者，我想要 Playwright chromium + 中文字体预装，以便 E2E 和视觉回归截图正确渲染
10. 作为前端开发者，我想要公共技能目录只读挂载，以便技能更新无需重建镜像
11. 作为前端开发者，我想要容器内置 fnm + corepack 默认 node 24，以便按容器切换 node 版本（无需 .nvmrc）
12. 作为前端开发者，我想要 ralph/afk 脚本逻辑零改动、仅运行环境容器化，以便复用成熟工作流
13. 作为前端开发者，我想要 `afk-run` 从任意项目目录一键启动容器化 ralph（身份=git remote 仓库名），以便零配置进入 AFK
14. 作为前端开发者，我想要 afk-run 自动提取凭据（gh auth token + auth.json），以便日常使用零输入
15. 作为前端开发者，我想要构建、单测、Playwright E2E、视觉回归、代码生成的全套工具链，以便覆盖前端 AFK 的全部工作量类型

## 实现决策

- 镜像基座：`node:24-bookworm-slim`；工具：bash/git/ripgrep/curl/gh（官方 apt 源）/unzip/fontconfig/fonts-noto-cjk/**jq/python3**（ralph 运行时依赖）/playwright chromium（--with-deps）/fnm（arm64 资产 `fnm-arm64.zip`，默认 node 24）/pi 全局安装（settings 固化 deepseek-v4-flash）
- 容器默认命令 `sleep infinity`（保留形态，任务经 docker exec 进入）
- 容器命名 `<project>-afk`；项目数据 bind mount（afk-run）或 named volume（start.sh 通用模式）
- 凭据注入：容器创建时 `-e DEEPSEEK_API_KEY -e GH_TOKEN`（env 随容器配置持久化，docker start 不重新注入）
- 挂载面：`~/Projects/afk-shared/skills` → `/root/.pi/agent/skills:ro`；`~/.pi/agent/ralph` → `/opt/ralph:ro`（afk-run）
- 网络：全通
- 目录结构：`~/.pi/agent/ralph/`（afk/once/prompt.md/README.md 原样 + afk-run + afk-base/）

## 测试决策

- 测试接缝：docker CLI（build/run/exec/inspect），集成风格
- 测试目标：镜像构建、工具可用（含 jq/python3）、start.sh 规范、技能挂载/git-native、README 覆盖、afk-run（身份解析/bind/env/重启/重建/真实凭据认证）
- 凭据测试分层：编排层用假凭据（确定性、可 CI）；提取与认证层用真凭据（gh auth status 容器内验证，条件执行）；端到端模型调用 opt-in

## 范围之外

- git worktree 功能本身（容器形态已支持，零成本后加）
- 远程部署 / OpenShell / 推理代理
- 定时自动触发（launchd/cron）
- 视觉回归的具体用例与基线管理

## 补充说明

- `DEEPSEEK_API_KEY` 为 pi 官方 providers 文档定义的 DeepSeek 环境变量
- node 版本是容器级状态：`fnm install <v> && fnm default <v>`，不碰仓库文件
- 安全模型：容器保留 + 全网络出站 + 无权限扩展 → 项目间隔离是唯一承重墙
- ralph 的 `-a`（信任项目文件）语义在容器内成立：容器边界 = 当前项目目录 + 全网络
