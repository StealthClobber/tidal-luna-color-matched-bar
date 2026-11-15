import { ReactiveStore, Tracer, type LunaUnload } from "@luna/core";
import { MediaItem, StyleTag } from "@luna/lib";

import { getPalette } from "./palette.native";
import { BLUR_VAR, setRotatingStrips, watchDrags } from "./rotation";
import { REST_ANGLE, stripAt } from "./strip";
import { INDICATOR, setStretching, watchIndicator } from "./stretch";
import { COLORS, isTooDark, type ColorName, type Palette, type RGB } from "./swatches";
import { tidalColor } from "./tidalColor";

export type Edge = "none" | "outline" | "glow" | "both";

export const { trace } = Tracer("[ColorMatchedBar]");
export const unloads = new Set<LunaUnload>();

export const storage = await ReactiveStore.getPluginStorage("ColorMatchedBar", {
	/** blur: the cover blurred into a strip, like TIDAL's Blur player background. */
	mode: "blur" as "single" | "gradient" | "blur",
	color1: "Dominant" as ColorName,
	color2: "Dominant2" as ColorName,
	color3: "None" as ColorName | "None",
	/** stretch: the whole gradient fits the played part. fixed: it spans the whole bar and is revealed. */
	gradientFill: "stretch" as "stretch" | "fixed",
	/** Blur only: turn the strip like TIDAL turns its blurred background. */
	rotate: true,
	/** Progress bar thickness in pixels (TIDAL's own is 4). */
	barHeight: 12,
	/** Light edge around the whole bar. */
	edge: "glow" as Edge,
	/** lighter: the bar's colors averaged and lightened. white: plain white. */
	edgeColor: "lighter" as "lighter" | "white",
});

export { Settings } from "./Settings";

/**
 * Stylesheet rules marked !important beat the inline color the Tidal Tags
 * plugin sets on the bar, whichever plugin runs first. Removing the tag on
 * unload hands the bar straight back.
 */
const style = new StyleTag("ColorMatchedBar", unloads);

/** TIDAL's bar height, and the range the setting allows (above 12 the bar would be bigger than TIDAL's hover knob). */
export const BAR_HEIGHT = { tidal: 4, min: 2, max: 12 };

/**
 * Bar thickness, kept in its own style tag so it applies whatever the colors
 * are doing. TIDAL sizes the bar (4px) and its container (also 4px) and
 * everything inside fills it; the ends stay fully rounded, and the hover knob (12px, which TIDAL
 * centers on a 4px bar) is moved down to stay centered.
 */
const sizeStyle = new StyleTag("ColorMatchedBar-size", unloads);
export const applyBarHeight = () => {
	const height = Math.min(BAR_HEIGHT.max, Math.max(BAR_HEIGHT.min, storage.barHeight));
	const knobOffset = (height - BAR_HEIGHT.tidal) / 2;
	// The bar's container is also fixed at 4px (with the time labels centered on it), so it grows too;
	// otherwise the taller bar spills out below it and sits low.
	sizeStyle.css = `
div:has(> #progressBar) { height: ${height}px !important; }
#progressBar { height: ${height}px !important; }
#progressBar div:has(> [data-test="progress-indicator"]) { border-radius: ${height / 2}px !important; }
#progressBar [class*="_knob_"] { top: ${knobOffset}px !important; }`;
};
applyBarHeight();

const palettes = new Map<string, Promise<Palette>>();
const paletteFor = async (mediaItem: MediaItem) => {
	const coverUrl = await mediaItem.coverUrl({ res: "640" });
	if (coverUrl === undefined) return;
	let palette = palettes.get(coverUrl);
	if (palette === undefined) {
		// TIDAL's own color is optional: if TIDAL can't give one, the cover's other colors still work.
		const tidal = tidalColor(mediaItem).catch((error) => void trace.warn.withContext("Getting TIDAL's color")(error));
		palette = Promise.all([getPalette(coverUrl), tidal]).then(([cover, Tidal]) => ({ ...cover, Tidal }));
		palettes.set(coverUrl, palette);
		// Don't cache failures, so the next play of this album can try again.
		palette.catch(() => palettes.delete(coverUrl));
	}
	return palette;
};

/** A cover color, unless it's missing or too close to black. */
const usable = (palette: Palette, name: ColorName) => {
	const color = palette[name];
	return color && !isTooDark(color) ? color : undefined;
};

/** The chosen color, or the next usable one in the list if the cover doesn't have it or it's near-black. */
const pickColor = (palette: Palette, wanted: ColorName): RGB | undefined => {
	const color = usable(palette, wanted) ?? (wanted.startsWith("Dominant") ? usable(palette, "Dominant") : undefined);
	if (color) return color;
	for (const name of COLORS) {
		const fallback = usable(palette, name);
		if (fallback) return fallback;
	}
};

const rgb = (color: RGB) => `rgb(${color.join(",")})`;

/** Played part of the bar. Tidal fills it with currentColor. */
const singleCss = (color: RGB) => `#progressBar { color: ${rgb(color)} !important; }`;

const gradient = (colors: RGB[]) => `linear-gradient(to right, ${colors.map(rgb).join(", ")})`;

/**
 * Stretch: the gradient is painted on Tidal's filled strip, whose animation
 * stretch.ts turns into a scale from the left edge, so it widens with the song.
 */
const stretchCss = (colors: RGB[], background = gradient(colors)) => `
#progressBar { color: ${rgb(colors[0])} !important; }
${INDICATOR} {
	background: ${background} !important;
	transform-origin: left center;
}`;

/**
 * Fixed: the gradient goes on the track behind the filled strip, the strip is
 * made see-through, and a block attached to the strip's right edge covers the
 * unplayed part, so the gradient stays put and is revealed as the strip slides.
 */
const fixedCss = (colors: RGB[], background = gradient(colors)) => `
#progressBar { color: ${rgb(colors[0])} !important; }
#progressBar div:has(> [data-test="progress-indicator"]) {
	background: ${background} !important;
}
${INDICATOR} { background: transparent !important; }
${INDICATOR}::after {
	content: "";
	position: absolute;
	top: 0;
	left: 100%;
	width: 100%;
	height: 100%;
	background: rgb(60 60 60 / 0.9);
}`;

/** Outline width and glow blur, in pixels, and how strongly each shows (0-1). */
const OUTLINE = { width: 1, alpha: 0.85 };
const GLOW = { blur: 8, alpha: 0.55 };
/** How far "lighter" moves the bar's color toward white (0 = unchanged, 1 = white). */
const LIGHTEN = 0.5;

/**
 * A light edge around the whole bar: an outline, a soft glow, or both. It's a
 * box-shadow on TIDAL's bar wrapper (#progressBar), since the track inside it
 * clips everything to its own edges.
 */
const edgeCss = (colors: RGB[]) => {
	if (storage.edge === "none") return "";
	let base: RGB = [255, 255, 255];
	if (storage.edgeColor === "lighter") {
		if (colors.length === 0) return "";
		const average = [0, 1, 2].map((c) => colors.reduce((sum, color) => sum + color[c], 0) / colors.length);
		base = average.map((v) => Math.round(v + (255 - v) * LIGHTEN)) as RGB;
	}
	const shade = (alpha: number) => `rgb(${base.join(" ")} / ${alpha})`;
	const shadows = [];
	if (storage.edge === "outline" || storage.edge === "both") shadows.push(`0 0 0 ${OUTLINE.width}px ${shade(OUTLINE.alpha)}`);
	if (storage.edge === "glow" || storage.edge === "both") shadows.push(`0 0 ${GLOW.blur}px ${shade(GLOW.alpha)}`);
	return `
#progressBar {
	border-radius: 999px;
	box-shadow: ${shadows.join(", ")} !important;
}`;
};

/** The bar's colors for this cover: one, two to three for a gradient, or the Blur strip at its resting angle. */
const colorsFor = (palette: Palette): RGB[] => {
	if (storage.mode === "blur" && palette.blur) return stripAt(palette.blur, REST_ANGLE);
	const first = pickColor(palette, storage.color1);
	if (first === undefined) return [];
	// Blur without a strip (an all-dark cover) falls back to the single color.
	if (storage.mode !== "gradient") return [first];

	const colors = [first];
	for (const wanted of [storage.color2, storage.color3]) {
		if (wanted === "None") continue;
		// Missing or near-black extra colors are left out rather than swapped for another.
		const color = usable(palette, wanted) ?? (wanted.startsWith("Dominant") ? usable(palette, "Dominant") : undefined);
		if (color && !colors.some((picked) => picked.join() === color.join())) colors.push(color);
	}
	return colors;
};

const apply = (colors: RGB[], palette?: Palette) => {
	const stretch = colors.length > 1 && storage.gradientFill === "stretch";
	setStretching(stretch);

	// A turning Blur strip comes from a CSS variable rotation.ts keeps updating; the resting strip is the fallback.
	const turning = storage.mode === "blur" && storage.rotate && palette?.blur !== undefined;
	const background = turning ? `var(${BLUR_VAR}, ${gradient(colors)})` : undefined;
	setRotatingStrips(turning ? palette.blur : undefined);

	let css = "";
	if (colors.length === 1) css = singleCss(colors[0]);
	else if (colors.length > 1) css = stretch ? stretchCss(colors, background) : fixedCss(colors, background);
	style.css = css + edgeCss(colors);
};

let current: MediaItem | undefined;
export const update = async (mediaItem: MediaItem | undefined = current) => {
	current = mediaItem;
	if (mediaItem === undefined) return;
	try {
		const palette = await paletteFor(mediaItem);
		if (mediaItem !== current) return; // A newer track started while this one loaded.
		apply(palette ? colorsFor(palette) : [], palette);
	} catch (error) {
		if (mediaItem === current) apply([]);
		trace.err.withContext("Reading album colors")(error);
	}
};

watchIndicator(unloads);
watchDrags(unloads);
MediaItem.onMediaTransition(unloads, update);
MediaItem.fromPlaybackContext().then(update);
// Have the next track's colors ready before it starts.
MediaItem.onPreload(unloads, (mediaItem) => void paletteFor(mediaItem).catch(() => {}));
