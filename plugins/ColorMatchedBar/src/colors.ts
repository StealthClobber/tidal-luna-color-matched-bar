import { NodeImage } from "@vibrant/image-node";
import { Vibrant } from "node-vibrant/node";

import { BLUR_ANGLES, lightness, MIN_LIGHTNESS, VIBRANT_SWATCHES, type Palette, type RGB } from "./swatches";

/** Covers are shrunk to this many pixels a side before counting colors (big enough to keep small logos and text). */
const SAMPLE_SIZE = 128;
/** Bits kept per channel when grouping similar pixels (4 bits = 16 levels). */
const BUCKET_BITS = 4;
/** How far apart (RGB distance) the 2nd and 3rd most common colors must be from earlier picks. */
const MIN_DISTANCE = 60;
/** Colors whose brightest and dimmest channels are closer than this count as gray or white, not colorful. */
const MIN_CHROMA = 48;
/** Colorful pixels are ranked ahead of grays when they cover at least this share of the (non-black) cover. */
const MIN_COLOR_SHARE = 0.005;
/** Groups smaller than this share of the cover are treated as noise (JPEG artifacts, antialiased edges). */
const MIN_GROUP_SHARE = 0.001;

type Sum = { count: number; r: number; g: number; b: number };

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (sum: Sum): RGB => [sum.r, sum.g, sum.b].map((v) => Math.round(v / sum.count)) as RGB;
const chroma = ([r, g, b]: RGB) => Math.max(r, g, b) - Math.min(r, g, b);
/** Hue angle in degrees (0-360). */
const hue = ([r, g, b]: RGB) => {
	const max = Math.max(r, g, b);
	const c = max - Math.min(r, g, b);
	if (c === 0) return 0;
	const h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
	return (h * 60 + 360) % 360;
};
const hueDistance = (a: RGB, b: RGB) => {
	const d = Math.abs(hue(a) - hue(b));
	return Math.min(d, 360 - d);
};
/** Colorful picks closer in hue than this to an earlier colorful pick are just a shade of it (often antialiased edges). */
const MIN_HUE_DISTANCE = 30;

/**
 * Most common colors (each averaged over its group of similar pixels) and the
 * overall average. Near-black pixels are ignored. If the cover has any real
 * color, colorful groups rank ahead of grays and whites, so a black-and-white
 * cover with a yellow logo gives yellow as the most common color.
 */
const countColors = (data: ArrayLike<number>) => {
	const shift = 8 - BUCKET_BITS;
	const buckets = new Map<number, Sum>();
	const total: Sum = { count: 0, r: 0, g: 0, b: 0 };
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 128) continue; // Skip see-through pixels.
		const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
		if (lightness(r, g, b) < MIN_LIGHTNESS) continue;
		const key = ((r >> shift) << (BUCKET_BITS * 2)) | ((g >> shift) << BUCKET_BITS) | (b >> shift);
		const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
		bucket.count++, (bucket.r += r), (bucket.g += g), (bucket.b += b);
		buckets.set(key, bucket);
		total.count++, (total.r += r), (total.g += g), (total.b += b);
	}
	if (total.count === 0) return { common: [], average: undefined };

	const groups = [...buckets.values()]
		.filter((bucket) => bucket.count >= total.count * MIN_GROUP_SHARE)
		.map((bucket) => ({ count: bucket.count, color: mean(bucket) }))
		.map((group) => ({ ...group, colorful: chroma(group.color) >= MIN_CHROMA }));

	const colorfulCount = groups.reduce((sum, group) => sum + (group.colorful ? group.count : 0), 0);
	const preferColor = colorfulCount >= total.count * MIN_COLOR_SHARE;
	groups.sort((a, b) => (preferColor && a.colorful !== b.colorful ? (a.colorful ? -1 : 1) : b.count - a.count));

	const picked: { color: RGB; colorful: boolean }[] = [];
	for (const group of groups) {
		const distinct = picked.every(
			(earlier) =>
				distance(earlier.color, group.color) >= MIN_DISTANCE &&
				!(earlier.colorful && group.colorful && hueDistance(earlier.color, group.color) < MIN_HUE_DISTANCE),
		);
		if (distinct) picked.push(group);
		if (picked.length === 3) break;
	}
	const common = picked.map(({ color }) => color);
	return { common, average: mean(total) };
};

/** Color stops in the blur strip. */
const STRIP_STOPS = 24;
/** Smoothing between neighboring stops (binomial kernel, applied this many times). */
const STRIP_SMOOTHING = 2;
/** Same color boost as TIDAL's blurred background (CSS saturate(1.3)). */
const STRIP_SATURATE = 1.3;

/** CSS saturate() filter, using the same matrix the browser does. */
const saturate = ([r, g, b]: RGB, s: number): RGB =>
	[
		(0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
		(0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
		(0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
	].map((v) => Math.round(Math.min(255, Math.max(0, v)))) as RGB;

/** Half the length of the sampling line through the cover's center, as a share of the cover's width. */
const STRIP_HALF_LENGTH = 0.45;
/** Half-width of the blurred area sampled around each point, as a share of the cover. */
const STRIP_RADIUS = 0.14;

/**
 * Running totals of the non-black pixels in every rectangle from the top-left
 * corner, so the average of any square area takes four lookups.
 */
const areaSums = (data: ArrayLike<number>, size: number) => {
	const stride = size + 1;
	const sums = [new Float64Array(stride * stride), new Float64Array(stride * stride), new Float64Array(stride * stride), new Float64Array(stride * stride)];
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const i = (y * size + x) * 4;
			const usable = data[i + 3] >= 128 && lightness(data[i], data[i + 1], data[i + 2]) >= MIN_LIGHTNESS;
			const values = usable ? [1, data[i], data[i + 1], data[i + 2]] : [0, 0, 0, 0];
			const at = (y + 1) * stride + (x + 1);
			for (let c = 0; c < 4; c++) sums[c][at] = values[c] + sums[c][at - 1] + sums[c][at - stride] - sums[c][at - stride - 1];
		}
	}
	/** Average non-black color in the square [x0, x1) x [y0, y1), or undefined if it's all near-black. */
	return (x0: number, y0: number, x1: number, y1: number): RGB | undefined => {
		const total = (c: number) => sums[c][y1 * stride + x1] - sums[c][y0 * stride + x1] - sums[c][y1 * stride + x0] + sums[c][y0 * stride + x0];
		const count = total(0);
		return count ? ([total(1), total(2), total(3)].map((v) => Math.round(v / count)) as RGB) : undefined;
	};
};

/**
 * TIDAL's "Blur" player background squashed into a left-to-right strip. Points
 * are taken along a line through the cover's center at the given angle (0 =
 * left to right, 45 = top-left to bottom-right), each becomes the average
 * color of the area around it (ignoring near-black), neighboring points are
 * blended, and the colors get TIDAL's saturation boost. Points whose area is
 * all near-black borrow from their neighbors. Undefined if the line only
 * crosses near-black.
 */
const blurStrip = (average: ReturnType<typeof areaSums>, size: number, degrees: number): RGB[] | undefined => {
	const radius = Math.round(size * STRIP_RADIUS);
	const half = size * STRIP_HALF_LENGTH;
	const angle = (degrees * Math.PI) / 180;
	const center = (size - 1) / 2;
	const clamp = (v: number) => Math.min(size, Math.max(0, v));
	const slices: (RGB | undefined)[] = [];
	for (let stop = 0; stop < STRIP_STOPS; stop++) {
		const t = (stop / (STRIP_STOPS - 1)) * 2 - 1;
		const x = Math.round(center + t * half * Math.cos(angle));
		const y = Math.round(center + t * half * Math.sin(angle));
		slices.push(average(clamp(x - radius), clamp(y - radius), clamp(x + radius + 1), clamp(y + radius + 1)));
	}

	// Fill all-dark slices by blending the nearest usable slices on each side.
	if (slices.every((slice) => slice === undefined)) return;
	let strip = slices.map((slice, i) => {
		if (slice) return slice;
		let left = i - 1;
		while (left >= 0 && !slices[left]) left--;
		let right = i + 1;
		while (right < slices.length && !slices[right]) right++;
		const l = slices[left];
		const r = slices[right];
		if (!l || !r) return (l ?? r)!;
		const t = (i - left) / (right - left);
		return l.map((v, c) => Math.round(v + (r[c] - v) * t)) as RGB;
	});

	const kernel = [1, 4, 6, 4, 1];
	for (let pass = 0; pass < STRIP_SMOOTHING; pass++) {
		strip = strip.map((_, i) => {
			const sum = [0, 0, 0];
			let weight = 0;
			kernel.forEach((k, offset) => {
				const color = strip[Math.min(strip.length - 1, Math.max(0, i + offset - 2))];
				for (let c = 0; c < 3; c++) sum[c] += color[c] * k;
				weight += k;
			});
			return sum.map((v) => Math.round(v / weight)) as RGB;
		});
	}
	return strip.map((color) => saturate(color, STRIP_SATURATE));
};

/**
 * Blur strips for BLUR_ANGLES evenly spaced angles, starting at 0 degrees.
 * Angles whose line only crosses near-black copy the nearest angle that has
 * color. Undefined if the whole cover is near-black.
 */
const blurStrips = (data: ArrayLike<number>, size: number): RGB[][] | undefined => {
	const average = areaSums(data, size);
	const strips = Array.from({ length: BLUR_ANGLES }, (_, k) => blurStrip(average, size, (k * 360) / BLUR_ANGLES));
	if (strips.every((strip) => strip === undefined)) return;
	return strips.map((strip, k) => {
		for (let step = 0; !strip; step++) strip = strips[(k + step) % BLUR_ANGLES] ?? strips[(k - step + BLUR_ANGLES) % BLUR_ANGLES];
		return strip;
	});
};

/** All the colors the plugin offers for one cover image. */
export const paletteFromImage = async (cover: Buffer): Promise<Palette> => {
	const image = await new NodeImage().load(cover);
	image.resize(SAMPLE_SIZE, SAMPLE_SIZE, 1);
	const { data } = image.getImageData();

	const swatches = await new Vibrant(cover, { quality: 1, useWorker: false }).getPalette();
	const { common, average } = countColors(data);

	const palette: Palette = {
		Dominant: common[0],
		Dominant2: common[1],
		Dominant3: common[2],
		Average: average,
		blur: blurStrips(data, SAMPLE_SIZE),
	};
	for (const name of VIBRANT_SWATCHES) {
		const swatch = swatches[name];
		if (swatch) palette[name] = swatch.rgb.map(Math.round) as RGB;
	}
	return palette;
};
