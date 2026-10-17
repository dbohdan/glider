// Port: the cursor (Inside Macintosh I, chapter 6, "Cursor Handling", and V, chapter 4, color
// cursors). The program sets the cursor's image and hides or shows it; the platform layer draws it
// over the screen at the mouse's location.

import { parsePixPat } from './QuickDraw.ts';
import { s16, u16 } from './Binary.ts';
import { GetResource } from './Resources.ts';
import type { Cursor } from './ToolUtils.ts';
import type { PixMap } from './QuickDraw.ts';
import type { Integer, Point, Rect } from './Types.ts';

export type { Cursor } from './ToolUtils.ts';

/** The standard arrow (QuickDraw's global `arrow`). */
export const arrow: Cursor = {
	data: [0x0000, 0x4000, 0x6000, 0x7000, 0x7800, 0x7c00, 0x7e00, 0x7f00, 0x7f80, 0x7c00, 0x6c00, 0x4600, 0x0600, 0x0300, 0x0300, 0x0000],
	mask: [0xc000, 0xe000, 0xf000, 0xf800, 0xfc00, 0xfe00, 0xff00, 0xff80, 0xffc0, 0xffe0, 0xfe00, 0xef00, 0xcf00, 0x8780, 0x0780, 0x0380],
	hotSpot: { v: 1, h: 1 },
};

/** Pascal `CCrsr` (a CCrsrHandle): a color cursor, with its black-and-white version. */
export interface CCrsr {
	crsrType: Integer;
	/** The color image: a pixel map and its pixels (16 by 16). */
	crsrMap: PixMap;
	crsrData: Uint8Array;
	crsr1: Cursor;
}

/** What the platform layer draws: the image (color or not), and whether it shows. */
export interface CursorState {
	cursor: Cursor;
	color: CCrsr | null;
	/** 0 shows the cursor; each HideCursor makes it one less. */
	level: Integer;
	/** Hidden by ObscureCursor until the mouse moves. */
	obscured: boolean;
}

export const cursorState: CursorState = { cursor: arrow, color: null, level: 0, obscured: false };

let changed: () => void = () => {};

/** Port: the platform's hook, called whenever the cursor's image or visibility changes. */
export function onCursorChange(f: () => void): void {
	changed = f;
}

/** Pascal `InitCursor`: the arrow, shown. */
export function InitCursor(): void {
	cursorState.cursor = arrow;
	cursorState.color = null;
	cursorState.level = 0;
	cursorState.obscured = false;
	changed();
}

export function SetCursor(crsr: Cursor): void {
	cursorState.cursor = { data: [...crsr.data], mask: [...crsr.mask], hotSpot: { ...crsr.hotSpot } };
	cursorState.color = null;
	changed();
}

export function HideCursor(): void {
	cursorState.level--;
	changed();
}

export function ShowCursor(): void {
	if (cursorState.level < 0) {
		cursorState.level++;
	}
	changed();
}

/** Pascal `ObscureCursor`: hides the cursor until the mouse moves. */
export function ObscureCursor(): void {
	cursorState.obscured = true;
	changed();
}

/** Port: the platform calls this when the mouse moves. */
export function mouseMoved(): void {
	if (cursorState.obscured) {
		cursorState.obscured = false;
		changed();
	}
}

/** Pascal `ShieldCursor`: the port's cursor is drawn over the screen, so nothing needs shielding; it hides it, as the ROM would. */
export function ShieldCursor(_shieldRect: Rect, _offsetPt: Point): void {
	HideCursor();
}

/**
 * Reads a 'crsr' resource (Inside Macintosh V-62): crsrType, then offsets of the pixel map and its
 * pixels (as in a 'ppat' resource), then the one-bit image, mask, and hot spot.
 */
export function parseCCrsr(d: Uint8Array): CCrsr {
	const data = Array.from({ length: 16 }, (_, i) => u16(d, 20 + i * 2));
	const mask = Array.from({ length: 16 }, (_, i) => u16(d, 52 + i * 2));
	const hotSpot = { v: s16(d, 84), h: s16(d, 86) };
	// With the type of a pixel map pattern, the pattern reader reads the pixel map and its pixels.
	const asPattern = d.slice();
	asPattern[0] = 0;
	asPattern[1] = 1;
	const pp = parsePixPat(asPattern);
	return { crsrType: u16(d, 0), crsrMap: pp.patMap, crsrData: pp.patData, crsr1: { data, mask, hotSpot } };
}

/** Pascal `GetCCursor`: a 'crsr' resource, or nil. */
export function GetCCursor(crsrID: Integer): CCrsr | null {
	const h = GetResource('crsr', crsrID);
	return h === null ? null : parseCCrsr(h.data);
}

export function SetCCursor(cCrsr: CCrsr): void {
	cursorState.cursor = cCrsr.crsr1;
	cursorState.color = cCrsr;
	changed();
}

export function DisposCCursor(_cCrsr: CCrsr | null): void {}
