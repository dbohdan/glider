// Port: the Palette Manager (Inside Macintosh V, chapter 7), as far as Glider uses it: a window's
// palette from a 'pltt' resource.
//
// Port: the palettes are kept but do not change the screen's colors yet. Glider's 'pltt' 128 asks
// for the 16 standard colors with tolerance 0, some with components that differ from the ROM's
// table in their low bytes (orange's green is $6464, not $648A); whether the Palette Manager then
// changes the device's table is an open question (see PORT.md), which the screenshots cannot
// answer as they show only the high bytes.

import { s16, u16 } from './Binary.ts';
import type { RGBColor } from './QuickDraw.ts';
import { GetResource } from './Resources.ts';
import type { WindowRecord } from './Windows.ts';
import type { Integer } from './Types.ts';

/** Color usage. */
export const pmCourteous = 0;
export const pmTolerant = 2;
export const pmAnimated = 4;
export const pmExplicit = 8;

export interface ColorInfo {
	ciRGB: RGBColor;
	ciUsage: Integer;
	ciTolerance: Integer;
}

/** Pascal `Palette` (a PaletteHandle is a Palette). */
export class Palette {
	pmEntries: Integer = 0;
	pmInfo: ColorInfo[] = [];
}

export type PaletteHandle = Palette;

const windowPalettes = new WeakMap<WindowRecord, Palette>();

export function parsePalette(d: Uint8Array): Palette {
	const p = new Palette();
	p.pmEntries = s16(d, 0);
	for (let i = 0; i < p.pmEntries; i++) {
		const o = 16 + i * 16;
		p.pmInfo.push({ ciRGB: { red: u16(d, o), green: u16(d, o + 2), blue: u16(d, o + 4) }, ciUsage: s16(d, o + 6), ciTolerance: u16(d, o + 8) });
	}
	return p;
}

/** Pascal `GetNewPalette`: a palette from a 'pltt' resource, or nil. */
export function GetNewPalette(paletteID: Integer): Palette | null {
	const h = GetResource('pltt', paletteID);
	return h === null ? null : parsePalette(h.data);
}

export function NewPalette(entries: Integer, srcColors: RGBColor[] | null, srcUsage: Integer, srcTolerance: Integer): Palette {
	const p = new Palette();
	p.pmEntries = entries;
	for (let i = 0; i < entries; i++) {
		p.pmInfo.push({ ciRGB: { ...(srcColors?.[i] ?? { red: 0, green: 0, blue: 0 }) }, ciUsage: srcUsage, ciTolerance: srcTolerance });
	}
	return p;
}

export function DisposePalette(_p: Palette | null): void {}

export function SetPalette(w: WindowRecord, p: Palette | null, _cUpdates: boolean): void {
	if (p === null) {
		windowPalettes.delete(w);
	} else {
		windowPalettes.set(w, p);
	}
}

export function GetPalette(w: WindowRecord): Palette | null {
	return windowPalettes.get(w) ?? null;
}

export function ActivatePalette(_w: WindowRecord): void {}

export function GetEntryColor(p: Palette, entry: Integer, dst: RGBColor): void {
	Object.assign(dst, p.pmInfo[entry]?.ciRGB ?? { red: 0, green: 0, blue: 0 });
}

export function SetEntryColor(p: Palette, entry: Integer, src: RGBColor): void {
	const info = p.pmInfo[entry];
	if (info !== undefined) {
		info.ciRGB = { ...src };
	}
}
