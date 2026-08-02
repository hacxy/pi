import type { CCHeaderState, LogoFrame } from "./types";

export const SPEEDS = [25, 50, 75, 100] as const;
export const LOGO_COLS = 8;
export const LOGO_ROWS = 7;
export const LOGO_PIXEL_WIDTH = 14;
export const MAX_SLOGAN_LENGTH = 85;

export const COLOR_NAMES: Record<string, string> = {
	a: "anthropic",
	c: "clawd",
	r: "red",
	o: "orange",
	y: "yellow",
	g: "green",
	w: "white",
	b: "blue",
	p: "purple",
};

export const DEFAULT_STATE: CCHeaderState = {
	logoColorKey: "c",
	versionColored: 1,
	gradientOn: true,
	logoInterval: SPEEDS[1],
	slogan: "Code something that makes you proud",
	sloganOn: true,
	sloganColor: true,
	disabled: false,
};

export const CMAP: Record<string, string> = {
	a: "38;2;217;119;87",
	r: "31",
	o: "38;5;208",
	y: "38;5;226",
	g: "38;2;20;180;20",
	w: "38;5;15",
	b: "38;2;40;130;220",
	p: "38;5;129",
	c: "38;2;251;73;52",
};

export const GMAP: Record<string, string[]> = {
	a: ["38;2;217;119;87", "38;2;200;100;70", "38;2;170;80;55", "38;2;130;60;40"],
	r: ["38;2;255;80;80", "38;2;220;40;40", "38;2;180;20;20", "38;2;140;10;10"],
	o: [
		"38;2;255;170;50",
		"38;2;230;140;30",
		"38;2;200;110;20",
		"38;2;160;80;10",
	],
	y: [
		"38;2;255;255;80",
		"38;2;230;230;40",
		"38;2;200;200;20",
		"38;2;160;160;10",
	],
	g: ["38;2;80;255;80", "38;2;40;220;40", "38;2;20;180;20", "38;2;10;140;10"],
	w: [
		"38;2;230;230;210",
		"38;2;190;190;170",
		"38;2;140;140;120",
		"38;2;100;100;85",
	],
	b: [
		"38;2;100;180;255",
		"38;2;70;160;245",
		"38;2;40;130;220",
		"38;2;20;100;195",
	],
	p: [
		"38;2;200;100;255",
		"38;2;170;70;230",
		"38;2;140;40;200",
		"38;2;110;20;160",
	],
	c: ["38;2;251;73;52", "38;2;220;60;40", "38;2;190;45;30", "38;2;155;30;20"],
};

export const GRADIENT_LEVEL: Record<string, number> = {
	l1: 0,
	l2: 1,
	l3: 2,
	l4: 3,
	s1: 0,
	s2: 1,
	s3: 2,
	s4: 3,
};

export const LOGO_FRAMES: LogoFrame[] = [
	...Array.from({ length: 4 }, (_, ay) => ({
		phase: 0,
		active: "left" as const,
		ax: 2,
		ay,
		flash: false,
		white: false,
	})),
	...Array.from({ length: 3 }, (_, ay) => ({
		phase: 1,
		active: "top" as const,
		ax: 2,
		ay,
		flash: false,
		white: false,
	})),
	...Array.from({ length: 5 }, (_, ay) => ({
		phase: 2,
		active: "right" as const,
		ax: 5,
		ay,
		flash: false,
		white: false,
	})),
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: true, white: false },
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: true, white: false },
	{ phase: 4, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: true },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: true },
	{ phase: 6, active: "none", ax: 0, ay: 0, flash: false, white: false },
];

export const LAST_FRAME_INDEX = LOGO_FRAMES.length - 1;

export const WHITE_CELLS = new Set([
	"3,2",
	"3,3",
	"3,4",
	"4,2",
	"4,4",
	"5,2",
	"5,3",
	"5,5",
	"6,2",
	"6,5",
]);
export const P4_CYAN = new Set(["2,2", "2,3", "2,4", "3,4"]);
export const P4_RED = new Set(["3,2", "4,2", "4,3", "5,2"]);
export const P4_GREEN = new Set(["4,5", "5,5"]);
export const P5_CYAN = new Set(["3,2", "3,3", "3,4", "4,4"]);
export const P5_RED = new Set(["4,2", "5,2", "5,3", "6,2"]);
export const P5_GREEN = new Set(["5,5", "6,5"]);
export const EARLY_ORANGE = new Set(["6,1", "6,2", "6,3", "6,4"]);
export const LATE_GREEN = new Set(["4,5", "5,5", "6,5", "6,6"]);
export const PIECE_LEFT: [number, number][] = [
	[0, 0],
	[1, 0],
	[1, 1],
	[2, 0],
];
export const PIECE_TOP: [number, number][] = [
	[0, 0],
	[0, 1],
	[0, 2],
	[1, 2],
];
export const PIECE_RIGHT: [number, number][] = [
	[0, 0],
	[1, 0],
	[2, 0],
	[2, 1],
];
