# 计划：afk-base 公共 AFK 隔离执行环境

> 来源 PRD：`prd/afk-base.md`
> 注：本文档在搬移 afk-base 目录时丢失，已从会话记录恢复（v2，含阶段 6/7）。

## 架构决策

- **镜像基座**：`node:24-bookworm-slim`（arm64）；镜像命名 `afk-base:latest`
- **容器规范**：每项目一容器 `<project>-afk`；`CMD sleep infinity` 保留形态，任务经 `docker exec`
- **凭据注入**：容器创建时 `-e DEEPSEEK_API_KEY -e GH_TOKEN`（env 持久化，start 不重新注入）
- **挂载面**：`~/Projects/afk-shared/skills:/root/.pi/agent/skills:ro`；afk-run 额外 `~/.pi/agent/ralph:/opt/ralph:ro` + bind `$PWD:/workspace`
- **ralph**：afk/once/prompt.md 逻辑零改动；容器内 jq+python3 运行时依赖
- **网络**：全通；**测试方式**：bash 断言，接缝 docker CLI

---

## 阶段 1：曳光弹——最小镜像 + pi 存活

**用户故事**：#1、#8

**验收标准**：镜像可构建；容器存活；`pi --version` 可用；env 注入后无头任务跑通（API opt-in）

## 阶段 2：工具链完整化

**用户故事**：#9、#11、#15

**验收标准**：node（fnm 24.x）/gh/playwright+chromium/corepack/CJK 字体全可用

## 阶段 3：容器运行时规范——start.sh

**用户故事**：#2、#3、#7、#13

**验收标准**：命名/挂载/env/stop-start 留存/缺参报错

## 阶段 4：技能挂载 + git 通道验证

**用户故事**：#10、#4、#5

**验收标准**：技能内容可见且只读；容器内 clone/worktree 可用

## 阶段 5：README 与收尾

**用户故事**：#14

**验收标准**：README 覆盖核心流程；全部测试通过

## 阶段 6：ralph 运行时依赖（jq/python3）

**用户故事**：#12

**验收标准**：镜像内 `jq --version`、`python3 --version` 可用

## 阶段 7：afk-run wrapper（容器化 ralph）

**用户故事**：#12、#13、#14

**验收标准**：身份解析（git remote 仓库名/fallback 目录名）；bind 源=当前目录；技能+ralph 只读挂载；假凭据 env 注入；重启复用容器；bind 源不匹配重建；真实 GH_TOKEN 容器内 `gh auth status` 认证成功；auth.json 提取非空
