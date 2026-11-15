import { paletteFromImage } from "./colors";
import type { Palette } from "./swatches";

/** Runs on Tidal's native (Node) side, so the cover can be fetched without CORS limits. */
export const getPalette = async (coverUrl: string): Promise<Palette> => {
	const res = await fetch(coverUrl);
	if (!res.ok) throw new Error(`Couldn't download cover (${res.status})`);
	return paletteFromImage(Buffer.from(await res.arrayBuffer()));
};
