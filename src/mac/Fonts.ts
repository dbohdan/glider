// Port: the Font Manager (Inside Macintosh I, chapter 7, and IV), for bitmap fonts in 'FONT' and
// 'NFNT' resources found through 'FOND' families or the old FONT numbering (family * 128 + size).

import { s16, u16 } from './Binary.ts';
import { GetNamedResource, GetResInfo, GetResource } from './Resources.ts';
import type { Integer } from './Types.ts';

export const systemFont = 0;
export const applFont = 1;

/** A font strike: the bits of every glyph of one font in one size and style. */
export interface FontStrike {
	fontType: number;
	firstChar: number;
	lastChar: number;
	widMax: number;
	kernMax: number;
	nDescent: number;
	fRectWidth: number;
	fRectHeight: number;
	ascent: number;
	descent: number;
	leading: number;
	rowWords: number;
	/** The strike: fRectHeight rows of rowWords * 2 bytes. */
	bitImage: Uint8Array;
	/** Pixel offsets of each glyph in the strike, with one extra entry for the missing glyph and one after it. */
	locTable: number[];
	/** Offset (high byte) and width (low byte) of each glyph; -1 for a missing glyph. */
	owTable: number[];
}

export function parseFontStrike(d: Uint8Array): FontStrike {
	const firstChar = s16(d, 2);
	const lastChar = s16(d, 4);
	const fRectHeight = s16(d, 14);
	const rowWords = s16(d, 24);
	const n = lastChar - firstChar + 3;
	const imageStart = 26;
	const imageSize = rowWords * 2 * fRectHeight;
	const locStart = imageStart + imageSize;
	const owStart = 16 + 2 * u16(d, 16);
	return {
		fontType: u16(d, 0),
		firstChar,
		lastChar,
		widMax: s16(d, 6),
		kernMax: s16(d, 8),
		nDescent: s16(d, 10),
		fRectWidth: s16(d, 12),
		fRectHeight,
		ascent: s16(d, 18),
		descent: s16(d, 20),
		leading: s16(d, 22),
		rowWords,
		bitImage: d.subarray(imageStart, locStart),
		locTable: Array.from({ length: n }, (_, i) => u16(d, locStart + 2 * i)),
		owTable: Array.from({ length: n }, (_, i) => s16(d, owStart + 2 * i)),
	};
}

/** Where a character's glyph is and how far it advances the pen. */
export interface Glyph {
	/** Strike column of the glyph's left edge. */
	locStart: number;
	/** Width of the glyph image. */
	imageWidth: number;
	/** Horizontal distance from the pen to the glyph image. */
	imageOffset: number;
	/** Advance width. */
	width: number;
}

/** The glyph for a character; characters the font lacks get its missing-character glyph. */
export function glyphOf(f: FontStrike, ch: number): Glyph {
	let i = ch - f.firstChar;
	if (ch < f.firstChar || ch > f.lastChar || f.owTable[i] === -1) {
		i = f.lastChar - f.firstChar + 1;
	}
	const ow = f.owTable[i]!;
	const locStart = f.locTable[i]!;
	return { locStart, imageWidth: f.locTable[i + 1]! - locStart, imageOffset: f.kernMax + ((ow >> 8) & 0xff), width: ow & 0xff };
}

/** Port: the system font size in System 6 (low memory SysFontSize 0 means 12). */
const defaultSize = 12;
/** Port: the application font is Geneva (low memory ApFontID). */
const apFontID = 3;

const strikeCache = new Map<string, FontStrike | null>();

/** Forgets cached fonts, for when the resource chain changes. */
export function flushFonts(): void {
	strikeCache.clear();
}

/** The resource ID of a family's strike in a size, from its FOND, or the old FONT numbering. */
function strikeID(family: number, size: number): { type: 'NFNT' | 'FONT'; id: number } | null {
	const fond = GetResource('FOND', family);
	if (fond !== null) {
		const d = fond.data;
		const count = s16(d, 52) + 1;
		for (let i = 0; i < count; i++) {
			const at = 54 + i * 6;
			if (s16(d, at) === size && s16(d, at + 2) === 0) {
				const id = s16(d, at + 4);
				return GetResource('NFNT', id) !== null ? { type: 'NFNT', id } : { type: 'FONT', id };
			}
		}
	}
	const id = family * 128 + size;
	return GetResource('FONT', id) !== null ? { type: 'FONT', id } : null;
}

/** The strike QuickDraw draws a port's text with. */
export function fontStrike(txFont: Integer, txSize: Integer): FontStrike {
	const family = txFont === applFont ? apFontID : txFont;
	const size = txSize === 0 ? defaultSize : txSize;
	const key = `${family}/${size}`;
	let strike = strikeCache.get(key);
	if (strike === undefined) {
		const where = strikeID(family, size) ?? strikeID(systemFont, defaultSize);
		const h = where === null ? null : GetResource(where.type, where.id);
		strike = h === null ? null : parseFontStrike(h.data);
		strikeCache.set(key, strike);
	}
	if (strike === null) {
		throw new Error(`no font for family ${txFont} size ${txSize}, and no system font`);
	}
	return strike;
}

/** Pascal `RealFont`: whether a family is available in a size without scaling. */
export function RealFont(fontNum: Integer, size: Integer): boolean {
	return strikeID(fontNum === applFont ? apFontID : fontNum, size === 0 ? defaultSize : size) !== null;
}

/** Pascal `InitFonts`: fonts are read from the open resource files when first used. */
export function InitFonts(): void {
	flushFonts();
}

/** Pascal `GetFNum(fontName, var theNum)`: a font family's number from its 'FOND' name, or 0. */
export function GetFNum(fontName: string): Integer {
	const fond = GetNamedResource('FOND', fontName);
	return fond === null ? 0 : (GetResInfo(fond)?.id ?? 0);
}
