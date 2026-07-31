# Pi Agent Configuration

My personal [Pi](https://pi.dev) coding agent configuration — includes custom extensions, skills, behavioral guidelines, and package setup.

## Getting Started

### Prerequisites

- [Pi](https://pi.dev) installed (`npm install -g @earendil-works/pi-coding-agent`)
- Node.js >= 18

### Installation

1. **Clone this repo to `~/.pi/agent`:**

   ```bash
   git clone https://github.com/hacxy/pi.git ~/.pi/agent
   ```

2. **Authenticate with your AI provider:**

   ```bash
   pi auth login
   ```

3. **Start Pi:**

   ```bash
   pi
   ```

> **Note:** If you already have a `~/.pi/agent` directory, back it up first:
>
> ```bash
> mv ~/.pi/agent ~/.pi/agent.bak
> ```

## What's Included

### Extensions

| Extension                                               | Description                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [pi-cc-header](extensions/pi-cc-header)                 | Animated startup header with pixel Pi logo, 9-color palette, gradient themes  |
| [pi-permission-system](extensions/pi-permission-system) | Configurable permission rules for bash, file access, and external directories |
| [release-npm](extensions/release-npm)                   | NPM package release automation                                                |
| [template-manager](extensions/template-manager)         | Project template management and scaffolding                                    |

### Packages

Configured in `settings.json`:

| Package                          | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `@hacxy/skills`                  | Custom skill collection                            |
| `pi-web-access`                  | Web fetching, PDF extraction, HTML-to-markdown     |
| `@tintinweb/pi-subagents`        | Multi-agent orchestration (parallel, chain, async) |
| `pi-lens`                        | AST-grep, tree-sitter, LSP diagnostics             |
| `@gotgenes/pi-permission-system` | Permission management extension                    |
| `pi-mcp-adapter`                 | MCP (Model Context Protocol) integration           |
| `pi-rewind`                      | Session rewind and replay                          |
| `pi-gen-license`                 | License file generation                            |

### Skills

Custom skills in `skills/`:

- **craft-skill** — Design principles and workflow for creating sharp, predictable AI agent skills

Additional skills are provided by installed packages (Lark suite, git-commit, brainstorm, frontend-design, etc.).

### Behavioral Guidelines

`AGENTS.md` defines global agent behavior:

- Ask before guessing — confirm ambiguous requirements
- Understand before acting — read code, analyze, plan, confirm, execute, verify
- Respect existing code — follow project conventions
- Communicate in Chinese by default

## Key Configuration

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
    "grad": true,     // Minecraft-style gradient
    "lines": false,   // IBM stripe decoration
    "ver": 1          // version color: 0=off, 1=Pi only, 2=Pi+version
  }
}
```

### `pi-permission-system/config.json`

Controls permission rules for bash commands, file paths, and external directory access. Sensitive patterns (`.env`, `rm -rf`, `sudo`, `~/.ssh/*`) require explicit approval.

### Header Commands

| Command       | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `/htg`        | Toggle header on/off                                         |
| `/hc <color>` | Set logo color (`a`, `r`, `o`, `y`, `g`, `w`, `b`, `p`, `c`) |
| `/hm`         | Toggle gradient theme                                        |
| `/hi`         | Toggle IBM stripes                                           |
| `/hv`         | Cycle version color mode                                     |
| `/hdf`        | Reset to developer defaults                                  |

## Directory Structure

```
~/.pi/agent/
├── AGENTS.md               # Global behavioral guidelines
├── settings.json            # Pi settings (model, theme, packages)
├── models.json              # Model provider config
├── keybindings.json         # Custom keybindings
├── auth.json                # Auth tokens (gitignored)
├── extensions/
│   ├── pi-cc-header/        # Animated startup header
│   ├── pi-permission-system/ # Permission management
│   ├── release-npm/         # NPM package release automation
│   └── template-manager/    # Project template management
├── skills/
│   └── craft-skill/         # Skill creation guide
└── npm/
    └── node_modules/        # Installed packages
```

## License

MIT
