export interface SettingsFile {
	ccHeader?: Record<string, any>;
	quietStartup?: boolean;
	clearOnStart?: boolean;
	packages?: string[];
	[key: string]: any;
}

export interface CCHeaderState {
	logoColorKey: string;
	versionColored: number;
	gradientOn: boolean;
	logoInterval: number;
	slogan: string;
	sloganOn: boolean;
	sloganColor: boolean;
	disabled: boolean;
}

export type LogoColor =
	| "panel"
	| "cyan"
	| "red"
	| "green"
	| "orange"
	| "white"
	| "flash"
	| "logo"
	| "l1"
	| "l2"
	| "l3"
	| "l4"
	| "s1"
	| "s2"
	| "s3"
	| "s4";

export type LogoPhase = "left" | "top" | "right" | "none";

export interface LogoFrame {
	phase: number;
	active: LogoPhase;
	ax: number;
	ay: number;
	flash: boolean;
	white: boolean;
}

export interface StatsResult {
	extensions: number;
	skills: number;
	prompts: number;
	agents: string;
}
