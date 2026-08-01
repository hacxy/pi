# Pi Agent 配置

[English](README.md) | [中文](README_ZH.md)

我的个人 [Pi](https://pi.dev) 编程助手配置 — 包含自定义扩展、技能、行为准则和包管理设置。

[![Pi Version](https://img.shields.io/badge/Pi-%3E%3D0.83.0-blue.svg)](https://pi.dev)

## 快速开始

```bash
# 1. 克隆仓库到 ~/.pi/agent
git clone https://github.com/hacxy/pi.git ~/.pi/agent

# 2. 登录认证
pi auth login

# 3. 启动 Pi
pi
```

> **注意：** 如果已有 `~/.pi/agent` 目录，请先备份：
>
> ```bash
> mv ~/.pi/agent ~/.pi/agent.bak
> ```

### 前置要求

- 已安装 [Pi](https://pi.dev) (`npm install -g @earendil-works/pi-coding-agent`)
- Node.js >= 18

## 包含内容

### 扩展

| 扩展 | 说明 |
| ------ | ------ |
| [pi-permission-system](extensions/pi-permission-system) | 可配置的权限规则，控制 bash、文件访问和外部目录 |
| [release-npm](extensions/release-npm) | NPM 包发布自动化 |
| [template-manager](extensions/template-manager) | 项目模板管理和脚手架 |

### 包

在 `settings.json` 中配置：

| 包名 | 用途 |
| ------ | ------ |
| `@hacxy/skills` | 自定义技能集合 |
| `pi-web-access` | 网页抓取、PDF 提取、HTML 转 markdown |
| `@tintinweb/pi-subagents` | 多智能体编排（并行、链式、异步） |
| `pi-lens` | AST-grep、tree-sitter、LSP 诊断 |
| `@gotgenes/pi-permission-system` | 权限管理扩展 |
| `pi-mcp-adapter` | MCP（Model Context Protocol）集成 |
| `pi-rewind` | 会话回放和重播 |
| `pi-gen-license` | 许可证文件生成 |
| `pi-cc-header` | 动画启动头部 |
| `pi-lite-footer` | 轻量级底部状态栏 |

### 技能

`skills/` 目录下的自定义技能：

- **craft-skill** — 创建精准、可预测的 AI agent 技能的设计原则和工作流

其他技能由已安装的包提供（Lark 套件、git-commit、brainstorm、frontend-design 等）。

### 行为准则

`AGENTS.md` 定义全局 agent 行为：

- 先问再猜 — 确认模糊需求
- 先理解再行动 — 读代码、分析、计划、确认、执行、验证
- 尊重现有代码 — 遵循项目规范
- 默认使用中文沟通

## 核心配置

### `settings.json`

```jsonc
{
  "defaultProvider": "xiaomi-token-plan-cn",
  "defaultModel": "mimo-v2.5-pro",
  "defaultThinkingLevel": "high",
  "theme": "dark",
  "packages": ["npm:@hacxy/skills", "npm:pi-web-access", ...],
  "ccHeader": {
    "color": "a",    // a=anthropic, r=red, g=green, b=blue, ...
    "grad": true,     // Minecraft 风格渐变
    "lines": false,   // IBM 条纹装饰
    "ver": 1          // 版本颜色: 0=关, 1=仅 Pi, 2=Pi+版本
  }
}
```

### `pi-permission-system/config.json`

控制 bash 命令、文件路径和外部目录访问的权限规则。敏感模式（`.env`、`rm -rf`、`sudo`、`~/.ssh/*`）需要明确授权。

### 头部命令

| 命令 | 说明 |
| ------ | ------ |
| `/htg` | 切换头部开/关 |
| `/hc <颜色>` | 设置 logo 颜色（`a`、`r`、`o`、`y`、`g`、`w`、`b`、`p`、`c`） |
| `/hm` | 切换渐变主题 |
| `/hi` | 切换 IBM 条纹 |
| `/hv` | 循环版本颜色模式 |
| `/hdf` | 重置为开发者默认值 |

## 目录结构

```
~/.pi/agent/
├── AGENTS.md               # 全局行为准则
├── settings.json            # Pi 设置（模型、主题、包）
├── models.json              # 模型提供者配置
├── keybindings.json         # 自定义快捷键
├── auth.json                # 认证令牌（已 gitignore）
├── extensions/
│   ├── pi-permission-system/ # 权限管理
│   ├── release-npm/         # NPM 包发布自动化
│   └── template-manager/    # 项目模板管理
├── skills/
│   └── craft-skill/         # 技能创建指南
└── npm/
    └── node_modules/        # 已安装的包
```

## 许可证

MIT
