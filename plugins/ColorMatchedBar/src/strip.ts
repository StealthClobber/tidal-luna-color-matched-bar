import { BLUR_ANGLES, type RGB } from "./swatches";

/** The sampling angle the Blur strip starts at (top-left to bottom-right), and uses when not turning. */
export const REST_ANGLE = 45;

/** The Blur strip at any angle, blending the two nearest worked-out angles. */
export const stripAt = (strips: RGB[][], degrees: number): RGB[] => {
	const position = ((((degrees % 360) + 360) % 360) / 360) * BLUR_ANGLES;
	const below = Math.floor(position) % BLUR_ANGLES;
	const above = (below + 1) % BLUR_ANGLES;
	const t = position - Math.floor(position);
	return strips[below].map((color, i) => color.map((v, c) => Math.round(v + (strips[above][i][c] - v) * t)) as RGB);
};

export const stripGradient = (strip: RGB[]) => `linear-gradient(to right, ${strip.map((c) => `rgb(${c.join(",")})`).join(", ")})`;
