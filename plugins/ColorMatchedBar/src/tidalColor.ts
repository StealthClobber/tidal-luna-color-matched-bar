import { redux, TidalApi, type MediaItem } from "@luna/lib";

import type { RGB } from "./swatches";

/** The parts of TIDAL's album response this file reads (JSON:API, with the cover art included). */
type AlbumResponse = {
	included?: {
		type: string;
		attributes?: { visualMetadata?: { selectedPaletteColor?: string; status?: string } };
	}[];
};

/** "#rrggbb", "#rgb" or "rgb(r, g, b)" into an RGB triple. */
const parseColor = (value: string): RGB | undefined => {
	const hex = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
	if (hex) {
		const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
		return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
	}
	const channels = value.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number);
	if (channels?.length === 3) return channels.map(Math.round) as RGB;
};

/**
 * The color TIDAL itself picks for a cover: the one its "Color" player
 * background uses. TIDAL works it out on its servers and sends it with the
 * cover art as visualMetadata.selectedPaletteColor. Undefined when TIDAL has
 * no color for the cover yet.
 */
export const tidalColor = async (mediaItem: MediaItem): Promise<RGB | undefined> => {
	const albumId = mediaItem.tidalItem.album?.id;
	if (albumId === undefined) return;
	const { countryCode } = redux.store.getState().session;
	const album = await TidalApi.fetch<AlbumResponse>(
		`https://openapi.tidal.com/v2/albums/${albumId}?countryCode=${countryCode}&include=coverArt`,
	);
	for (const item of album?.included ?? []) {
		const color = item.type === "artworks" ? item.attributes?.visualMetadata?.selectedPaletteColor : undefined;
		if (color) return parseColor(color);
	}
};
