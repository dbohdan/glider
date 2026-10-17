// A minimal ZIP reader for the archives the oracle fetches: stored and deflated members only.

import { inflateRawSync } from 'node:zlib';
import { u32 } from '../src/mac/Binary.ts';

export interface ZipEntry {
	name: string;
	data: Uint8Array;
}

export function readZip(b: Uint8Array): ZipEntry[] {
	let eocd = -1;
	for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
		if (u32(b, i) === 0x504b0506) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) {
		throw new Error('not a ZIP archive');
	}
	const count = u16le(b, eocd + 10);
	let p = u32le(b, eocd + 16);
	const out: ZipEntry[] = [];
	const utf8 = new TextDecoder();
	for (let k = 0; k < count; k++) {
		if (u32(b, p) !== 0x504b0102) {
			throw new Error('bad ZIP central directory');
		}
		const method = u16le(b, p + 10);
		const compSize = u32le(b, p + 20);
		const nameLen = u16le(b, p + 28);
		const extraLen = u16le(b, p + 30);
		const commentLen = u16le(b, p + 32);
		const local = u32le(b, p + 42);
		const name = utf8.decode(b.subarray(p + 46, p + 46 + nameLen));
		const start = local + 30 + u16le(b, local + 26) + u16le(b, local + 28);
		const raw = b.subarray(start, start + compSize);
		let data: Uint8Array;
		if (method === 0) {
			data = raw.slice();
		} else if (method === 8) {
			data = new Uint8Array(inflateRawSync(raw));
		} else {
			throw new Error(`unsupported ZIP compression method ${method} for ${name}`);
		}
		out.push({ name, data });
		p += 46 + nameLen + extraLen + commentLen;
	}
	return out;
}

function u16le(b: Uint8Array, o: number): number {
	return b[o]! | (b[o + 1]! << 8);
}

function u32le(b: Uint8Array, o: number): number {
	return (u16le(b, o) | (u16le(b, o + 2) << 16)) >>> 0;
}
