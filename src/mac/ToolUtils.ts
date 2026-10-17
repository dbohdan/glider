// Port: the Toolbox Utilities' resource getters (Inside Macintosh I, chapter 16), with their Color
// QuickDraw counterparts: icons, patterns, cursors, and pictures from resources.

import { decodeMacRoman } from './MacRoman.ts';
import type { Picture } from './Picture.ts';
import { type CIcon, type Pattern, type PixPat, parseCIcon, parsePixPat } from './QuickDraw.ts';
import { GetResource, type Handle } from './Resources.ts';
import { s16, u16 } from './Binary.ts';
import type { Integer, Point } from './Types.ts';

/** Pascal `GetIcon`: an 'ICON' resource (32 by 32 pixels, 128 bytes), or nil. */
export function GetIcon(iconID: Integer): Handle | null {
	return GetResource('ICON', iconID);
}

/** Pascal `GetCIcon`: a 'cicn' resource made ready to draw, or nil. */
export function GetCIcon(iconID: Integer): CIcon | null {
	const h = GetResource('cicn', iconID);
	return h === null ? null : parseCIcon(h.data);
}

/** Pascal `GetPattern`: a 'PAT ' resource, or nil. */
export function GetPattern(patID: Integer): Pattern | null {
	const h = GetResource('PAT ', patID);
	return h === null ? null : [...h.data.subarray(0, 8)];
}

/** Pascal `GetIndPattern(var thePattern, patListID, index)`: a pattern from a 'PAT#' list; black if there is none. */
export function GetIndPattern(patListID: Integer, index: Integer): Pattern {
	const h = GetResource('PAT#', patListID);
	if (h === null || index < 1 || index > s16(h.data, 0)) {
		return [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
	}
	const o = 2 + (index - 1) * 8;
	return [...h.data.subarray(o, o + 8)];
}

/** Pascal `GetPixPat`: a 'ppat' resource, or nil. */
export function GetPixPat(patID: Integer): PixPat | null {
	const h = GetResource('ppat', patID);
	return h === null ? null : parsePixPat(h.data);
}

export function DisposPixPat(_pp: PixPat | null): void {}

/** Pascal `GetPicture`: a 'PICT' resource, or nil. */
export function GetPicture(picID: Integer): Picture | null {
	const h = GetResource('PICT', picID);
	return h === null ? null : h;
}

export function KillPicture(_pic: Picture | null): void {}

/** Pascal `Cursor`: a 16-by-16 image, its mask, and the hot spot. */
export interface Cursor {
	data: number[];
	mask: number[];
	hotSpot: Point;
}

export function parseCursor(d: Uint8Array): Cursor {
	return {
		data: Array.from({ length: 16 }, (_, i) => u16(d, i * 2)),
		mask: Array.from({ length: 16 }, (_, i) => u16(d, 32 + i * 2)),
		hotSpot: { v: s16(d, 64), h: s16(d, 66) },
	};
}

/** Pascal `GetCursor`: a 'CURS' resource, or nil. */
export function GetCursor(cursorID: Integer): Cursor | null {
	const h = GetResource('CURS', cursorID);
	return h === null ? null : parseCursor(h.data);
}

/** Pascal `GetString`'s list form is in OSUtils; this decodes a 'STR ' handle's text. */
export function stringOf(h: Handle): string {
	return decodeMacRoman(h.data.subarray(1, 1 + h.data[0]!));
}
