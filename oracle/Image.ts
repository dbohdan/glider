// Screen images: the emulator writes PBM (1 bit per pixel) and PPM (color); people look at PNG.

import { crc32, deflateSync } from 'node:zlib';
import { ByteWriter } from '../src/mac/Binary.ts';

/** An RGB image, 3 bytes per pixel. */
export interface Image {
	width: number;
	height: number;
	rgb: Uint8Array;
}

/** Reads a binary PBM (P4) or PPM (P6) file. */
export function readPNM(b: Uint8Array): Image {
	let p = 0;
	const token = (): string => {
		for (;;) {
			while (p < b.length && /\s/.test(String.fromCharCode(b[p]!))) {
				p++;
			}
			if (b[p] !== 0x23) {
				break;
			}
			while (p < b.length && b[p] !== 0x0a) {
				p++;
			}
		}
		const start = p;
		while (p < b.length && !/\s/.test(String.fromCharCode(b[p]!))) {
			p++;
		}
		return String.fromCharCode(...b.subarray(start, p));
	};
	const magic = token();
	const width = Number(token());
	const height = Number(token());
	const maxval = magic === 'P6' ? Number(token()) : 1;
	p++; // the single whitespace byte before the raster
	const rgb = new Uint8Array(width * height * 3);
	if (magic === 'P4') {
		const rowBytes = Math.ceil(width / 8);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const black = (b[p + y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
				rgb.fill(black ? 0 : 255, (y * width + x) * 3, (y * width + x) * 3 + 3);
			}
		}
	} else if (magic === 'P6' && maxval === 255) {
		rgb.set(b.subarray(p, p + rgb.length));
	} else {
		throw new Error(`unsupported image format ${magic}`);
	}
	return { width, height, rgb };
}

/** Encodes an image as PNG (RGB, 8 bits per channel, no filtering). */
export function writePNG(img: Image): Uint8Array {
	const raw = new Uint8Array((img.width * 3 + 1) * img.height);
	for (let y = 0; y < img.height; y++) {
		raw.set(img.rgb.subarray(y * img.width * 3, (y + 1) * img.width * 3), y * (img.width * 3 + 1) + 1);
	}
	const out = new ByteWriter();
	out.bytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	const chunk = (type: string, data: Uint8Array) => {
		const body = new ByteWriter().fourCC(type).bytes(data).toBytes();
		out.u32(data.length).bytes(body).u32(crc32(body));
	};
	chunk('IHDR', new ByteWriter().u32(img.width).u32(img.height).u8(8).u8(2).u8(0).u8(0).u8(0).toBytes());
	chunk('IDAT', new Uint8Array(deflateSync(raw)));
	chunk('IEND', new Uint8Array(0));
	return out.toBytes();
}

/** Counts the pixels that differ between two images of the same size. */
export function countDifferences(a: Image, b: Image): number {
	if (a.width !== b.width || a.height !== b.height) {
		throw new Error('images differ in size');
	}
	let n = 0;
	for (let i = 0; i < a.rgb.length; i += 3) {
		if (a.rgb[i] !== b.rgb[i] || a.rgb[i + 1] !== b.rgb[i + 1] || a.rgb[i + 2] !== b.rgb[i + 2]) {
			n++;
		}
	}
	return n;
}
