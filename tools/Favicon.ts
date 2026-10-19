// The page's icon: Glider's own application icon, its 32-by-32 color icon ('icl8') with the black
// and white icon's mask ('ICN#') for transparency, as a PNG.

import { crc32, deflateSync } from 'node:zlib';
import { ByteWriter } from '../src/mac/Binary.ts';
import type { MacFile } from '../src/mac/MacBinary.ts';
import { parseResourceFork } from '../src/mac/ResourceFork.ts';

/**
 * The Mac's standard 8-bit color table (Inside Macintosh V): a 6-by-6-by-6 cube from white to
 * black (0 to 214), then ten shades each of red, green, blue and gray (215 to 254), and black.
 */
export function standardColors8(): [number, number, number][] {
	const colors: [number, number, number][] = [];
	for (let i = 0; i < 215; i++) {
		const level = (n: number) => (5 - n) * 0x33;
		colors.push([level(Math.floor(i / 36)), level(Math.floor(i / 6) % 6), level(i % 6)]);
	}
	const shades = [0xee, 0xdd, 0xbb, 0xaa, 0x88, 0x77, 0x55, 0x44, 0x22, 0x11];
	for (const ramp of [(v: number) => [v, 0, 0], (v: number) => [0, v, 0], (v: number) => [0, 0, v], (v: number) => [v, v, v]]) {
		for (const v of shades) {
			colors.push(ramp(v) as [number, number, number]);
		}
	}
	colors.push([0, 0, 0]);
	return colors;
}

/** A PNG of 8-bit RGBA pixels. */
function writeRGBAPNG(width: number, height: number, rgba: Uint8Array): Uint8Array {
	const raw = new Uint8Array((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
	}
	const out = new ByteWriter();
	out.bytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	const chunk = (type: string, data: Uint8Array) => {
		const body = new ByteWriter().fourCC(type).bytes(data).toBytes();
		out.u32(data.length).bytes(body).u32(crc32(body));
	};
	chunk('IHDR', new ByteWriter().u32(width).u32(height).u8(8).u8(6).u8(0).u8(0).u8(0).toBytes());
	chunk('IDAT', new Uint8Array(deflateSync(raw)));
	chunk('IEND', new Uint8Array(0));
	return out.toBytes();
}

/** The application's icon (id 128) as a PNG. */
export function applicationIcon(app: MacFile): Uint8Array {
	const fork = parseResourceFork(app.rsrc);
	const get = (type: string) => fork.resources.find((r) => r.type === type && r.id === 128)!.data;
	const pixels = get('icl8');
	const mask = get('ICN#').subarray(128);
	const colors = standardColors8();
	const rgba = new Uint8Array(32 * 32 * 4);
	for (let i = 0; i < 32 * 32; i++) {
		const [r, g, b] = colors[pixels[i]!]!;
		const opaque = (mask[i >> 3]! >> (7 - (i & 7))) & 1;
		rgba.set([r, g, b, opaque ? 255 : 0], i * 4);
	}
	return writeRGBAPNG(32, 32, rgba);
}
