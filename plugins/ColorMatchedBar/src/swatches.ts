/**
 * Colors the plugin can pull from a cover. The first four come from counting
 * the cover's pixels, the next six are node-vibrant's palette picks, and
 * Tidal is the color TIDAL's own "Color" player background uses.
 */
export const COLORS = [
	"Dominant",
	"Dominant2",
	"Dominant3",
	"Average",
	"Vibrant",
	"LightVibrant",
	"DarkVibrant",
	"Muted",
	"LightMuted",
	"DarkMuted",
	"Tidal",
] as const;
export type ColorName = (typeof COLORS)[number];

export const LABELS: Record<ColorName, string> = {
	Dominant: "Most common",
	Dominant2: "2nd most common",
	Dominant3: "3rd most common",
	Average: "Average",
	Vibrant: "Vibrant",
	LightVibrant: "Light vibrant",
	DarkVibrant: "Dark vibrant",
	Muted: "Muted",
	LightMuted: "Light muted",
	DarkMuted: "Dark muted",
	Tidal: "TIDAL's color",
};

export const VIBRANT_SWATCHES = ["Vibrant", "LightVibrant", "DarkVibrant", "Muted", "LightMuted", "DarkMuted"] as const;

export type RGB = [r: number, g: number, b: number];
/**
 * Number of angles the Blur strip is worked out for, spread over a full turn.
 * The rotation blends between neighbors, so 72 (every 5 degrees) is plenty.
 */
export const BLUR_ANGLES = 72;

/**
 * A cover's colors, plus the Blur style's strips: one left-to-right strip per
 * sampling angle (BLUR_ANGLES of them, evenly spaced from 0 degrees).
 */
export type Palette = Partial<Record<ColorName, RGB>> & { blur?: RGB[][] };

/**
 * Colors darker than this perceived lightness (CIE L*, 0 = black, 100 = white)
 * are skipped: near-black looks like a missing bar on Tidal's dark player.
 * rgb(50,50,50) is about 21.
 */
export const MIN_LIGHTNESS = 20;

const linear = (channel: number) => {
	const c = channel / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export const lightness = (r: number, g: number, b: number) => {
	const y = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
	return y <= 216 / 24389 ? (y * 24389) / 27 : 116 * Math.cbrt(y) - 16;
};
export const isTooDark = ([r, g, b]: RGB) => lightness(r, g, b) < MIN_LIGHTNESS;
