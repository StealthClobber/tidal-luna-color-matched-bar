import type { LunaUnload } from "@luna/core";
import { observe } from "@luna/lib";

/**
 * Tidal draws the played part of the bar as a full-width strip (the
 * "indicator") that a Web Animation slides in from translateX(-100%) to
 * translateX(0) over the length of the track. A gradient on a sliding strip
 * only ever shows its right-hand end, so in stretch mode the animation's
 * keyframes are swapped for scaleX(0) -> scaleX(1) from the left edge. The
 * whole gradient is then squeezed into the played part and widens with it.
 *
 * Changing the keyframes of Tidal's own animation (rather than running a
 * second one) keeps play, pause and seeking exactly in step, since Tidal keeps
 * controlling the same animation's timing.
 */
export const INDICATOR = `#progressBar [data-test="progress-indicator"]`;

const SLIDE: Keyframe[] = [{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }];
const STRETCH: Keyframe[] = [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];

const isSlide = (keyframes: Keyframe[] | PropertyIndexedKeyframes | null) =>
	Array.isArray(keyframes) && String(keyframes[0]?.transform).startsWith("translateX");

let stretching = false;
const patched = new Set<HTMLElement>();

/** Point the indicator's running animation at the keyframes for the current mode. */
const retarget = (indicator: HTMLElement) => {
	for (const animation of indicator.getAnimations()) {
		if (!(animation.effect instanceof KeyframeEffect)) continue;
		const transform = String(animation.effect.getKeyframes()[0]?.transform);
		if (stretching && transform.startsWith("translateX")) animation.effect.setKeyframes(STRETCH);
		else if (!stretching && transform.startsWith("scaleX")) animation.effect.setKeyframes(SLIDE);
	}
};

/**
 * Tidal recreates the animation when a track starts or the window resizes, so
 * the indicator's animate() is wrapped to swap the keyframes as they're made.
 */
const patch = (indicator: HTMLElement) => {
	if (patched.has(indicator)) return;
	patched.add(indicator);
	const animate = HTMLElement.prototype.animate;
	indicator.animate = function (keyframes, options) {
		return animate.call(this, stretching && isSlide(keyframes) ? STRETCH : keyframes, options);
	};
	retarget(indicator);
};

export const setStretching = (on: boolean) => {
	stretching = on;
	for (const indicator of patched) {
		if (indicator.isConnected) retarget(indicator);
		else patched.delete(indicator);
	}
};

export const watchIndicator = (unloads: Set<LunaUnload>) => {
	for (const indicator of document.querySelectorAll<HTMLElement>(INDICATOR)) patch(indicator);
	observe<HTMLElement>(unloads, INDICATOR, patch);
	unloads.add(() => {
		setStretching(false);
		// Removing the wrapper falls back to the normal animate() on the prototype.
		for (const indicator of patched) delete (indicator as Partial<HTMLElement>).animate;
		patched.clear();
	});
};
