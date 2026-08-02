import type { LogoColor, LogoFrame } from "./types";
import {
	CMAP,
	GMAP,
	GRADIENT_LEVEL,
	LOGO_COLS,
	LOGO_ROWS,
	LOGO_FRAMES,
	WHITE_CELLS,
	P4_CYAN,
	P4_RED,
	P4_GREEN,
	P5_CYAN,
	P5_RED,
	P5_GREEN,
	EARLY_ORANGE,
	LATE_GREEN,
	PIECE_LEFT,
	PIECE_TOP,
	PIECE_RIGHT,
} from "./constants";

let logoColorKey = "c";
let gradientOn = true;

export function updateLogoParams(colorKey: string, grad: boolean): void {
	logoColorKey = colorKey;
	gradientOn = grad;
}

export const colorCell = (color: LogoColor): string => {
	const cg = (n: number) => GMAP[logoColorKey]?.[n] ?? "34";
	switch (color) {
		case "cyan":
			return "\x1b[36m██\x1b[39m";
		case "red":
			return "\x1b[31m██\x1b[39m";
		case "green":
			return "\x1b[32m██\x1b[39m";
		case "orange":
		case "flash":
			return "\x1b[33m██\x1b[39m";
		case "white":
			return "\x1b[39m██";
		case "logo":
			return `\x1b[${CMAP[logoColorKey]}m██\x1b[39m`;
		case "l1":
		case "l2":
		case "l3":
		case "l4":
		case "s1":
		case "s2":
		case "s3":
		case "s4":
			return `\x1b[${cg(GRADIENT_LEVEL[color])}m██\x1b[39m`;
		default:
			return "  ";
	}
};

export function logoCellColor(
	frame: LogoFrame,
	y: number,
	x: number,
): LogoColor {
	const key = `${y},${x}`;

	if (frame.white) return WHITE_CELLS.has(key) ? "white" : "panel";
	if (frame.flash && y === 6 && x >= 1 && x <= 6) return "flash";

	if (
		frame.active === "left" &&
		PIECE_LEFT.some(([dy, dx]) => y === frame.ay + dy && x === frame.ax + dx)
	)
		return "red";
	if (
		frame.active === "top" &&
		PIECE_TOP.some(([dy, dx]) => y === frame.ay + dy && x === frame.ax + dx)
	)
		return "cyan";
	if (
		frame.active === "right" &&
		PIECE_RIGHT.some(([dy, dx]) => y === frame.ay + dy && x === frame.ax + dx)
	)
		return "green";

	if (frame.phase === 6) {
		const isPi = WHITE_CELLS.has(key);
		const lvl = gradientOn ? (y <= 3 ? 1 : y === 4 ? 2 : y === 5 ? 3 : 4) : 0;
		if (isPi) return lvl > 0 ? (("l" + lvl) as LogoColor) : "logo";
		return "panel";
	}
	if (frame.phase === 4) {
		if (P4_CYAN.has(key)) return "cyan";
		if (P4_RED.has(key)) return "red";
		if (P4_GREEN.has(key)) return "green";
		return "panel";
	}
	if (frame.phase >= 5) {
		if (P5_CYAN.has(key)) return "cyan";
		if (P5_RED.has(key)) return "red";
		if (P5_GREEN.has(key)) return "green";
		return "panel";
	}
	if (frame.phase <= 3 && EARLY_ORANGE.has(key)) return "orange";
	if (frame.phase >= 2 && P4_CYAN.has(key)) return "cyan";
	if (frame.phase >= 1 && P4_RED.has(key)) return "red";
	if (frame.phase >= 3 && LATE_GREEN.has(key)) return "green";
	return "panel";
}

function piLogoFrame(frameIndex: number): string[] {
	const frame = LOGO_FRAMES[frameIndex];
	const lines: string[] = [];
	for (let y = 1; y <= LOGO_ROWS; y++) {
		let line = "";
		for (let x = 1; x <= LOGO_COLS; x++)
			line += colorCell(logoCellColor(frame, y, x));
		lines.push(line);
	}
	return lines;
}

let PRECOMPUTED_LOGO_FRAMES: string[][] = LOGO_FRAMES.map((_, i) =>
	piLogoFrame(i),
);

export function recomputeFrames(): void {
	PRECOMPUTED_LOGO_FRAMES = LOGO_FRAMES.map((_, i) => piLogoFrame(i));
}

export function getLogoFrames(): string[][] {
	return PRECOMPUTED_LOGO_FRAMES;
}
