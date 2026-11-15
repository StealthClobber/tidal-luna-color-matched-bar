import type { LunaUnload } from "@luna/core";
import { PlayState } from "@luna/lib";

import { REST_ANGLE, stripAt, stripGradient } from "./strip";
import type { RGB } from "./swatches";

/**
 * Turns the Blur style's strip the way TIDAL turns its blurred player
 * background (timings copied from TIDAL's web player):
 * - playing: one full turn every 30 seconds (twice TIDAL's speed)
 * - paused: eases a further 30 degrees over 1.5 seconds, then stops
 * - dragging the progress bar: 180 degrees across the bar's full length
 * - reduced motion turned on in the system: no turning
 *
 * TIDAL turns the cover clockwise; for the bar that means the line the strip
 * is sampled along turns the other way. The strip is written to the --cmb-blur
 * CSS variable on the progress bar, which the bar's stylesheet reads.
 */

export const BLUR_VAR = "--cmb-blur";

/** Twice as fast as TIDAL's own background (60 seconds a turn). */
const FULL_TURN_MS = 30_000;
const COAST_MS = 1_500;
const COAST_DEGREES = 30;
const SCRUB_DEGREES = 180;
/** Redraw only once the angle has moved this far (about 30 redraws a second while playing). */
const REDRAW_DEGREES = 0.2;
/** How often to check for play or drag starting while nothing is moving. */
const IDLE_CHECK_MS = 200;

type Motion =
	| { type: "stopped"; turn: number }
	| { type: "spinning"; startTurn: number; startTime: number }
	| { type: "coasting"; startTurn: number; startTime: number }
	| { type: "scrubbing"; baseTurn: number; startFraction: number; fraction: number };

const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const turnAt = (motion: Motion, now: number) => {
	switch (motion.type) {
		case "stopped":
			return motion.turn;
		case "spinning":
			return motion.startTurn + ((now - motion.startTime) / FULL_TURN_MS) * 360;
		case "coasting":
			return motion.startTurn + COAST_DEGREES * easeOutCubic((now - motion.startTime) / COAST_MS);
		case "scrubbing":
			return motion.baseTurn + (motion.fraction - motion.startFraction) * SCRUB_DEGREES;
	}
};

let strips: RGB[][] | undefined;
let motion: Motion = { type: "stopped", turn: 0 };
let drag = { active: false, fraction: 0 };
let lastDrawn: number | undefined;
let timer: { cancel: () => void } | undefined;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const bar = () => document.getElementById("progressBar");

let drawnOn: HTMLElement | null = null;
const draw = (degrees: number, force = false) => {
	if (!strips) return;
	const target = bar();
	// Tidal can replace the bar element (it then has no variable), so redraw on a new one even when the angle hasn't moved.
	const moved = lastDrawn === undefined || Math.abs(degrees - lastDrawn) >= REDRAW_DEGREES;
	if (!force && !moved && target === drawnOn) return;
	lastDrawn = degrees;
	drawnOn = target;
	target?.style.setProperty(BLUR_VAR, stripGradient(stripAt(strips, degrees)));
};

const tick = () => {
	timer = undefined;
	if (!strips) return;
	const now = performance.now();
	const turn = turnAt(motion, now);

	if (reduceMotion.matches) motion = { type: "stopped", turn };
	else if (drag.active) {
		if (motion.type !== "scrubbing") motion = { type: "scrubbing", baseTurn: turn, startFraction: drag.fraction, fraction: drag.fraction };
		else motion.fraction = drag.fraction;
	} else if (PlayState.playing) {
		if (motion.type !== "spinning") motion = { type: "spinning", startTurn: turn, startTime: now };
	} else if (motion.type === "spinning" || motion.type === "scrubbing") {
		motion = { type: "coasting", startTurn: turn, startTime: now };
	} else if (motion.type === "coasting" && now - motion.startTime >= COAST_MS) {
		motion = { type: "stopped", turn: turnAt(motion, now) };
	}

	draw(REST_ANGLE - turnAt(motion, now));

	if (motion.type === "stopped") {
		const id = setTimeout(tick, IDLE_CHECK_MS);
		timer = { cancel: () => clearTimeout(id) };
	} else {
		const id = requestAnimationFrame(tick);
		timer = { cancel: () => cancelAnimationFrame(id) };
	}
};

/** Start turning these strips (keeping the current angle), or stop and clear the bar's variable with undefined. */
export const setRotatingStrips = (next: RGB[][] | undefined) => {
	strips = next;
	timer?.cancel();
	timer = undefined;
	if (strips) {
		draw(REST_ANGLE - turnAt(motion, performance.now()), true);
		tick();
	} else {
		lastDrawn = undefined;
		drawnOn = null;
		bar()?.style.removeProperty(BLUR_VAR);
	}
};

/** TIDAL announces progress-bar drags with this event (the same one its own blur background listens to). */
type TimeSync = CustomEvent<{ fraction?: number; time?: number; isDragging?: boolean } | undefined>;

export const watchDrags = (unloads: Set<LunaUnload>) => {
	const onSync = (event: Event) => {
		const detail = (event as TimeSync).detail;
		if (!detail) return;
		const duration = PlayState.playbackContext?.actualDuration ?? 0;
		const fraction = detail.fraction ?? (duration > 0 && detail.time !== undefined ? Math.min(1, Math.max(0, detail.time / duration)) : 0);
		drag = { active: !!detail.isDragging, fraction };
	};
	const onRelease = () => (drag = { ...drag, active: false });
	window.addEventListener("timeSyncFromProgressBar", onSync);
	window.addEventListener("pointerup", onRelease);
	window.addEventListener("pointercancel", onRelease);
	unloads.add(() => {
		window.removeEventListener("timeSyncFromProgressBar", onSync);
		window.removeEventListener("pointerup", onRelease);
		window.removeEventListener("pointercancel", onRelease);
		setRotatingStrips(undefined);
	});
};
