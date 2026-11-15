# Color Matched Bar for Tidal Luna

A [Tidal Luna](https://github.com/Inrixia/TidaLuna) plugin that colors the playback progress bar to match the album cover of the song that's playing.

## Installing

1. Open **Luna Settings → Plugin Store** and paste this link into the **Install from URL** box:

   ```
   https://github.com/StealthClobber/tidal-luna-color-matched-bar/releases/download/latest/store.json
   ```

2. The store appears in the list. Click **@luna/color-matched-bar** in it to install.


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

## License

[AGPL-3.0](LICENSE), from the [luna-template](https://github.com/Inrixia/luna-template).
