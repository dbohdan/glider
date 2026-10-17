// Port: Color QuickDraw's colors (Inside Macintosh V): color tables, the main graphics device,
// and matching RGB colors to the pixel values of a device.

import { s16, s32, u16 } from './Binary.ts';
import type { BitMap, ColorSpec, ColorTable, PixMap, RGBColor } from './QuickDraw.ts';
import type { Integer } from './Types.ts';

/** ctFlags bit 15: the table belongs to a device, and pixel values are its indices. */
export const ctDeviceFlag = 0x8000;

const rgb = (red: number, green: number, blue: number): RGBColor => ({ red, green, blue });

/** The standard 16-color table of the Mac II ROM ('clut' 4). */
export const standardClut4: RGBColor[] = [
	rgb(0xffff, 0xffff, 0xffff), // white
	rgb(0xfc00, 0xf37d, 0x052f), // yellow
	rgb(0xffff, 0x648a, 0x028c), // orange
	rgb(0xdd6b, 0x08c2, 0x06a2), // red
	rgb(0xf2d7, 0x0856, 0x84ec), // magenta
	rgb(0x46e3, 0x0000, 0xa53e), // purple
	rgb(0x0000, 0x0000, 0xd400), // blue
	rgb(0x0241, 0xab54, 0xeaff), // cyan
	rgb(0x1f21, 0xb793, 0x1431), // green
	rgb(0x0000, 0x64af, 0x11b0), // dark green
	rgb(0x5600, 0x2c9d, 0x0524), // brown
	rgb(0x90d7, 0x7160, 0x3a34), // tan
	rgb(0xc000, 0xc000, 0xc000), // light gray
	rgb(0x8000, 0x8000, 0x8000), // medium gray
	rgb(0x4000, 0x4000, 0x4000), // dark gray
	rgb(0x0000, 0x0000, 0x0000), // black
];

export function makeColorTable(colors: RGBColor[], flags = 0, seed = 0): ColorTable {
	return {
		ctSeed: seed,
		ctFlags: flags,
		ctSize: colors.length - 1,
		ctTable: colors.map((c, i): ColorSpec => ({ value: i, rgb: { ...c } })),
	};
}

/** Reads a color table resource ('clut', 'wctb', 'actb', 'dctb', 'cctb', 'mctb' entries aside). */
export function parseColorTable(d: Uint8Array): ColorTable {
	const ctSize = s16(d, 6);
	const ctTable: ColorSpec[] = [];
	for (let i = 0; i <= ctSize; i++) {
		const o = 8 + i * 8;
		ctTable.push({ value: s16(d, o), rgb: { red: u16(d, o + 2), green: u16(d, o + 4), blue: u16(d, o + 6) } });
	}
	return { ctSeed: s32(d, 0), ctFlags: u16(d, 4), ctSize, ctTable };
}

/** A graphics device (GDHandle): the screen's pixel map and its color table. */
export interface GDevice {
	gdType: Integer;
	gdPMap: PixMap;
	gdRect: { top: number; left: number; bottom: number; right: number };
	gdFlags: Integer;
}

let mainDevice: GDevice | null = null;

export function setMainDevice(d: GDevice | null): void {
	mainDevice = d;
}

/** Pascal `GetMainDevice`; nil on a machine without Color QuickDraw. */
export function GetMainDevice(): GDevice | null {
	return mainDevice;
}

/** The current graphics device (Pascal `GetGDevice`). */
export function GetGDevice(): GDevice | null {
	return mainDevice;
}

/**
 * The pixel value whose color is closest to an RGB color in a color table.
 * Port: QuickDraw matches colors through an inverse table of 4 bits per component; this compares
 * the colors directly, which picks the same entry for the colors Glider uses (exact matches).
 */
export function colorToIndex(ct: ColorTable, c: RGBColor): number {
	let best = 0;
	let bestDist = Infinity;
	for (const spec of ct.ctTable) {
		const dr = spec.rgb.red - c.red;
		const dg = spec.rgb.green - c.green;
		const db = spec.rgb.blue - c.blue;
		const dist = dr * dr + dg * dg + db * db;
		if (dist < bestDist) {
			bestDist = dist;
			best = ct.ctFlags & ctDeviceFlag ? ct.ctTable.indexOf(spec) : spec.value;
		}
	}
	return best;
}

/** Pascal `Color2Index`: the main device's pixel value for a color. */
export function Color2Index(c: RGBColor): number {
	return mainDevice === null ? (c.red + c.green + c.blue > 3 * 0x7fff ? 0 : 1) : colorToIndex(mainDevice.gdPMap.pmTable, c);
}

/** Pascal `Index2Color`. */
export function Index2Color(index: number, c: RGBColor): void {
	const spec = mainDevice?.gdPMap.pmTable.ctTable[index];
	c.red = spec?.rgb.red ?? 0;
	c.green = spec?.rgb.green ?? 0;
	c.blue = spec?.rgb.blue ?? 0;
}

/** The RGB colors of the old-style colors (blackColor, redColor, and so on). */
export function oldColorToRGB(c: number): RGBColor {
	switch (c) {
		case 30: // whiteColor
			return rgb(0xffff, 0xffff, 0xffff);
		case 69: // yellowColor
			return rgb(0xfc00, 0xf37d, 0x052f);
		case 137: // magentaColor
			return rgb(0xf2d7, 0x0856, 0x84ec);
		case 205: // redColor
			return rgb(0xdd6b, 0x08c2, 0x06a2);
		case 273: // cyanColor
			return rgb(0x0241, 0xab54, 0xeaff);
		case 341: // greenColor
			return rgb(0x0000, 0x8000, 0x11b0);
		case 409: // blueColor
			return rgb(0x0000, 0x0000, 0xd400);
		default: // blackColor
			return rgb(0, 0, 0);
	}
}

/** Whether a BitMap field holds a pixel map (rowBytes high bit set, as QuickDraw marks them). */
export function isPixMapRowBytes(bm: BitMap): boolean {
	return (bm.rowBytes & 0x8000) !== 0;
}
