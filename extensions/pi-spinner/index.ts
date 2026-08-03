import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

// 预设的 spinner 样式
const SPINNERS = {
  // 经典点号
  dots: {
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    intervalMs: 80,
  },
  // 月亮
  moon: {
    frames: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"],
    intervalMs: 100,
  },
  // 贪吃蛇
  snake: {
    frames: ["⠈⠁", "⠘⠃", "⠰⡄", "⠸⢀", "⢰⡀", "⡄⠘", "⠃⠈", "⠁ "],
    intervalMs: 100,
  },
  // 流光
  flow: {
    frames: [
      "▏",
      "▎",
      "▍",
      "▌",
      "▋",
      "▊",
      "▉",
      "█",
      "▉",
      "▊",
      "▋",
      "▌",
      "▍",
      "▎",
    ],
    intervalMs: 80,
  },
  // 双螺旋
  helix: {
    frames: ["⠰⠆", "⠠⠤", "⠐⠂", "⠘⠄", "⠰⠆", "⠠⠤"],
    intervalMs: 100,
  },
  // 吃豆人
  pacman: {
    frames: ["ᗧ••• ", "ᗧ••  ", "ᗧ•   ", "ᗧ    ", " •••ᗣ", " ••  ", " •   "],
    intervalMs: 120,
  },
  // 翻转
  flip: {
    frames: ["_", "_", "_", "-", "`", "`", "'", "´", "-", "_", "_", "_"],
    intervalMs: 70,
  },
  // 弹跳球
  bouncingBall: {
    frames: [
      "( ●    )",
      "(  ●   )",
      "(   ●  )",
      "(    ● )",
      "(     ●)",
      "(    ● )",
      "(   ●  )",
      "(  ●   )",
      "( ●    )",
      "(●     )",
    ],
    intervalMs: 80,
  },
  // 小鱼游
  fish: {
    frames: [
      "~~~~~~~~~~~~~~~~~~~~ > ",
      "~~~~~~~~~~~~~~~~~ º>  ",
      "~~~~~~~~~~~~~~~~ (º>  ",
      "~~~~~~~~~~~~~~~ ((º>  ",
      "~~~~~~~~~~~~~~ <((º>  ",
      "~~~~~~~~~~~~~ ><((º>  ",
      "~~~~~~~~~~~~  ><((º>  ",
      "~~~~~~~~~~~ ~ ><((º>  ",
      "~~~~~~~~~~ ~~ <>((º>  ",
      "~~~~~~~~~ ~~~ ><((º>  ",
      "~~~~~~~~ ~~~~ <>((º>  ",
      "~~~~~~~ ~~~~~ ><((º>  ",
      "~~~~~~ ~~~~~~ <>((º>  ",
      "~~~~~ ~~~~~~~ ><((º>  ",
      "~~~~ ~~~~~~~~ <>((º>  ",
      "~~~ ~~~~~~~~~ ><((º>  ",
      "~~ ~~~~~~~~~~ <>((º>  ",
      "~ ~~~~~~~~~~~ ><((º>  ",
      " ~~~~~~~~~~~~ <>((º>  ",
      "  ~~~~~~~~~~~~~ ><((º>",
    ],
    intervalMs: 80,
  },
  // 思考脸
  think: {
    frames: [
      "(-_-) ",
      "(._. )",
      "( ._.)",
      "(°_°) ",
      "(◕_◕) ",
      "(⊙_⊙) ",
      "(°_°) ",
      "(._. )",
      "( ._.)",
      "(-_-) ",
    ],
    intervalMs: 150,
  },
} as const;

type SpinnerName = keyof typeof SPINNERS;

export default function (pi: ExtensionAPI) {
  let currentSpinner: SpinnerName = "dots";

  // 设置自定义 spinner
  const applySpinner = (name: SpinnerName, ctx?: ExtensionContext) => {
    const spinner = SPINNERS[name];
    ctx?.ui.setWorkingIndicator({
      frames: [...spinner.frames],
      intervalMs: spinner.intervalMs,
    });
  };

  // 注册命令让用户选择 spinner
  pi.registerCommand("spinner", {
    description: "选择 working 旋转器样式",
    getArgumentCompletions: (prefix: string) => {
      const items = Object.keys(SPINNERS).map((name) => ({
        value: name,
        label: name,
      }));
      return items.filter((i) => i.value.startsWith(prefix));
    },
    handler: async (args, ctx) => {
      if (args && args in SPINNERS) {
        currentSpinner = args as SpinnerName;
        applySpinner(currentSpinner, ctx);
        ctx.ui.notify(`已切换到 ${currentSpinner} 样式`, "info");
      } else {
        // 显示选择列表
        const choice = await ctx.ui.select(
          "选择旋转器样式:",
          Object.keys(SPINNERS) as SpinnerName[],
        );
        if (choice) {
          currentSpinner = choice as SpinnerName;
          applySpinner(currentSpinner, ctx);
          ctx.ui.notify(`已切换到 ${currentSpinner} 样式`, "info");
        }
      }
    },
  });

  // 注册快捷键快速切换
  pi.registerShortcut("ctrl+alt+s", {
    description: "切换 spinner 样式",
    handler: async (ctx) => {
      const names = Object.keys(SPINNERS) as SpinnerName[];
      const currentIndex = names.indexOf(currentSpinner);
      const nextIndex = (currentIndex + 1) % names.length;
      currentSpinner = names[nextIndex];
      applySpinner(currentSpinner, ctx);
      ctx.ui.notify(`Spinner: ${currentSpinner}`, "info");
    },
  });

  // session 启动时应用 spinner
  pi.on("session_start", async (_event, ctx) => {
    applySpinner(currentSpinner, ctx);
  });
}
