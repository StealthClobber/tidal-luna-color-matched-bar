# Color Matched Bar for Tidal Luna

A [Tidal Luna](https://github.com/Inrixia/TidaLuna) plugin that colors the playback progress bar to match the album cover of the song that's playing.

## How it works

On every track change the plugin reads the cover's colors and applies the chosen one, or a gradient of two or three, to Tidal's progress bar. The most common and average colors come from counting the cover's pixels; the vibrant and muted colors come from [node-vibrant](https://github.com/Vibrant-Colors/node-vibrant). Colors are kept for the session, and the next track's are read ahead of time so the bar switches as the song does.

The **Blur** style is the bar's take on TIDAL's Blur player background, which shows the cover itself blurred, color-boosted and slowly rotating. The bar is too thin to show a blurred image, so the plugin squashes the cover into a strip: it takes points along a line through the cover's center (top-left to bottom-right to start with), averages the area around each one, blends neighbors smoothly and applies TIDAL's saturation boost (`saturate(1.3)`). Near-black areas are skipped. The strip is drawn as a smooth gradient.

With **Rotate** on, the strip turns the way TIDAL's background does: the sampling line turns one full circle every 30 seconds while a song plays (twice the speed of TIDAL's own background), eases a further 30° over 1.5 seconds when paused, and turns 180° across the bar's length while you drag the progress bar. It stays still if your system asks for reduced motion. Strips for 72 angles are worked out once per album, and the bar blends between them.

Gradients (including Blur) can fill the bar two ways:

- **Grow with progress** (default): the whole gradient always fits the played part and widens as the song plays. Tidal slides the played part in from the left with an animation; the plugin changes that animation to stretch from the left edge instead, so it stays in step with play, pause and seeking.
- **Fixed across the bar**: the gradient spans the whole bar and is revealed as the song plays; the unplayed part is covered with dark gray.

- If the [Tidal Tags](https://github.com/Inrixia/luna-plugins) plugin is installed, it colors the bar by stream quality. This plugin overrides that color while enabled, and Tidal Tags' quality badges keep working.
- Disabling the plugin removes its color immediately. (Tidal Tags' quality color only comes back after the next track change or a restart, since that plugin sets it per track.)

## Settings

Open **Luna Settings → Plugins** and expand **@luna/color-matched-bar**:

| Setting | Default | What it does |
| --- | --- | --- |
| Bar height | 12 px | Thickness of the progress bar, 2–12 px (TIDAL's own is 4). The ends stay rounded and the hover knob stays centered. |
| Edge | Glow | A light edge around the whole bar: None, Outline (1 px), Glow (soft, 8 px) or Outline and glow. |
| Edge color | Lighter bar color | The bar's colors averaged and moved halfway to white, or plain white. |
| Style | Blur | Single color, Gradient, or Blur (the cover blurred across the bar). |
| Album color / Start color / Fallback color | Most common | The color used, the gradient's first color, or (Blur) the color used when a cover is almost entirely black. |
| Rotate | On | Blur only. Turn the blur while a song plays, like TIDAL's blurred background. |
| Gradient fill | Grow with progress | Gradient and Blur. Whether the gradient fits the played part or spans the whole bar. |
| Second color | 2nd most common | Gradient only. Middle color with three colors, end color with two. |
| Third color | None | Gradient only. Optional end color. |

Colors to choose from: Most common, 2nd most common, 3rd most common, Average, Vibrant, Light vibrant, Dark vibrant, Muted, Light muted, Dark muted and TIDAL's color.

**TIDAL's color** is the color TIDAL's own **Color** player background uses for the album. TIDAL picks it on its servers; the plugin asks TIDAL's API for it (`visualMetadata.selectedPaletteColor` on the album's cover art). Some covers don't have one yet, and then the next usable color is used.

The most common colors favor real color over grays and whites: if a cover has any noticeable color (at least 0.5% of it), colorful pixels rank first. A black-and-white cover with a yellow logo gives yellow as the most common color, then white. The 2nd and 3rd most common skip shades of a color already picked (a different hue is needed), so the soft edges of a logo don't come back as darker copies of it.

Near-black colors are never used, since they look like a missing bar on Tidal's dark player. Near-black pixels aren't counted for the most common and average colors, and if the chosen color is near-black or the cover doesn't have it (a one-color cover has no 2nd most common, for example), the next usable one in the list is used. In a gradient, a second or third color that's near-black or missing is left out. If a cover has no usable color at all, the bar keeps its normal color.

## Installing

Install from this repo's latest release by adding the store link in **Luna Settings → Plugin Store**:

```
https://github.com/StealthClobber/tidal-luna-color-matched-bar/releases/download/latest/store.json
```

or the plugin directly:

```
https://github.com/StealthClobber/tidal-luna-color-matched-bar/releases/download/latest/luna.color-matched-bar
```

## Development

Requires Node.js and pnpm (`npm install -g pnpm`).

```sh
pnpm install
pnpm run watch
```

`watch` rebuilds on every change and serves the plugin at `http://localhost:3000`. Install it from the **DEV** store under **Luna Settings → Plugin Store**, and turn on live reload on its card to pick up changes automatically.

Source is in `plugins/ColorMatchedBar/src`:

| File | Purpose |
| --- | --- |
| `index.ts` | Follows track changes and applies the bar color. |
| `palette.native.ts` | Downloads the cover on Tidal's native side. |
| `colors.ts` | Works out a cover's colors (most common, average, vibrant and muted). |
| `tidalColor.ts` | Gets TIDAL's own color for the album from TIDAL's API. |
| `strip.ts` | Blends the Blur strip for any angle. |
| `rotation.ts` | Turns the Blur strip with play, pause and progress-bar drags. |
| `stretch.ts` | Switches Tidal's bar animation between sliding and stretching. |
| `swatches.ts` | Color names, labels and types. |
| `Settings.tsx` | Settings page. |

Pushing to the default branch builds the plugin with GitHub Actions and publishes it to the `latest` release. That needs **Settings → Actions → General → Workflow permissions** set to **Read and write permissions**.

## License

[AGPL-3.0](LICENSE), from the [luna-template](https://github.com/Inrixia/luna-template).
