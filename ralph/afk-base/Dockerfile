# afk-base: 公共 AFK 隔离执行环境
FROM node:24-bookworm-slim

# 基础工具
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git curl ripgrep \
  && rm -rf /var/lib/apt/lists/*

# ── 工具链：gh CLI（官方 apt 源）/ unzip / 中文字体 ──
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
       gh unzip fontconfig fonts-noto-cjk jq python3 \
  && rm -rf /var/lib/apt/lists/*

# ── 工具链：fnm（node 版本切换，容器级状态，无需 .nvmrc）──
ARG FNM_VERSION=v1.39.0
RUN set -eux; \
  case "$(uname -m)" in \
    aarch*|armv8*) FNM_ASSET=fnm-arm64.zip ;; \
    *) FNM_ASSET=fnm-linux.zip ;; \
  esac; \
  curl -fsSL "https://github.com/Schniz/fnm/releases/download/${FNM_VERSION}/${FNM_ASSET}" -o /tmp/fnm.zip \
  && unzip -o /tmp/fnm.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/fnm \
  && rm /tmp/fnm.zip \
  && fnm install 24 && fnm default 24 \
  && printf 'eval "$(fnm env --shell bash)"\n' > /etc/profile.d/fnm.sh

# ── 工具链：playwright + chromium（E2E / 截图视觉回归）──
RUN npm install -g playwright \
  && playwright install --with-deps chromium

# pi agent（官方容器化文档同款安装）
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# 固化 pi 默认配置：deepseek / deepseek-v4-flash
RUN mkdir -p /root/.pi/agent \
  && printf '{\n  "defaultProvider": "deepseek",\n  "defaultModel": "deepseek-v4-flash"\n}\n' \
     > /root/.pi/agent/settings.json

# 项目数据目录（git-native 工作区）
WORKDIR /workspace

# 保留容器形态：任务经 docker exec 进入
CMD ["sleep", "infinity"]
