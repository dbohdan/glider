// MacBinary I, II, and III: a Mac file's data fork, resource fork, and Finder information in one stream.

import { ByteWriter, copyBytes, fourCCAt, put16, s32, u16, u32, u8 } from './Binary.ts';
import { decodeMacRoman, encodeMacRoman } from './MacRoman.ts';
import type { OSType } from './Types.ts';

export interface MacFile {
	name: string;
	type: OSType;
	creator: OSType;
	/** Finder flags (high byte in MacBinary byte 73, low byte in byte 101). */
	finderFlags: number;
	/** Seconds since 1904-01-01, as the Mac clock counts them. */
	created: number;
	modified: number;
	data: Uint8Array;
	rsrc: Uint8Array;
}

/** CRC-16/XMODEM, which MacBinary II uses for its header. */
export function crc16(bytes: Uint8Array): number {
	let crc = 0;
	for (const b of bytes) {
		crc ^= b << 8;
		for (let i = 0; i < 8; i++) {
			crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
		}
	}
	return crc;
}

export function isMacBinary(b: Uint8Array): boolean {
	if (b.length < 128 || b[0] !== 0 || b[74] !== 0 || b[1]! < 1 || b[1]! > 63) {
		return false;
	}
	const dataLen = u32(b, 83);
	const rsrcLen = u32(b, 87);
	const padded = (n: number) => Math.ceil(n / 128) * 128;
	return 128 + padded(dataLen) + rsrcLen <= b.length + 127;
}

export function parseMacBinary(b: Uint8Array): MacFile {
	if (!isMacBinary(b)) {
		throw new Error('not a MacBinary file');
	}
	const nameLen = u8(b, 1);
	const dataLen = u32(b, 83);
	const rsrcLen = u32(b, 87);
	const secondaryHeader = u16(b, 120);
	const dataStart = 128 + Math.ceil(secondaryHeader / 128) * 128;
	const rsrcStart = dataStart + Math.ceil(dataLen / 128) * 128;
	return {
		name: decodeMacRoman(b.subarray(2, 2 + nameLen)),
		type: fourCCAt(b, 65),
		creator: fourCCAt(b, 69),
		finderFlags: (u8(b, 73) << 8) | u8(b, 101),
		created: u32(b, 91),
		modified: u32(b, 95),
		data: copyBytes(b, dataStart, dataStart + dataLen),
		rsrc: copyBytes(b, rsrcStart, rsrcStart + rsrcLen),
	};
}

/** Writes MacBinary II. */
export function writeMacBinary(f: MacFile): Uint8Array {
	const h = new Uint8Array(128);
	const name = encodeMacRoman(f.name).subarray(0, 63);
	h[1] = name.length;
	h.set(name, 2);
	h.set(encodeMacRoman(f.type.padEnd(4)).subarray(0, 4), 65);
	h.set(encodeMacRoman(f.creator.padEnd(4)).subarray(0, 4), 69);
	h[73] = (f.finderFlags >>> 8) & 0xff;
	const dv = new DataView(h.buffer);
	dv.setUint32(83, f.data.length);
	dv.setUint32(87, f.rsrc.length);
	dv.setUint32(91, f.created >>> 0);
	dv.setUint32(95, f.modified >>> 0);
	h[101] = f.finderFlags & 0xff;
	h[122] = 129; // written by MacBinary II
	h[123] = 129; // readable by MacBinary II
	put16(h, 124, crc16(h.subarray(0, 124)));
	const out = new ByteWriter();
	out.bytes(h).bytes(f.data).align(128).bytes(f.rsrc).align(128);
	return out.toBytes();
}

/** AppleDouble entry IDs. */
const adDataFork = 1;
const adResourceFork = 2;
const adFinderInfo = 9;
const adFileDates = 8;

/** Reads an AppleDouble or AppleSingle file. The data fork is empty unless the file is AppleSingle. */
export function parseAppleDouble(b: Uint8Array, name: string): MacFile {
	const magic = u32(b, 0);
	if (magic !== 0x00051607 && magic !== 0x00051600) {
		throw new Error('not an AppleDouble or AppleSingle file');
	}
	const f: MacFile = { name, type: '\0\0\0\0', creator: '\0\0\0\0', finderFlags: 0, created: 0, modified: 0, data: new Uint8Array(0), rsrc: new Uint8Array(0) };
	const n = u16(b, 24);
	for (let k = 0; k < n; k++) {
		const id = u32(b, 26 + k * 12);
		const off = u32(b, 30 + k * 12);
		const len = u32(b, 34 + k * 12);
		const entry = b.subarray(off, off + len);
		if (id === adDataFork) {
			f.data = copyBytes(entry, 0, entry.length);
		} else if (id === adResourceFork) {
			f.rsrc = copyBytes(entry, 0, entry.length);
		} else if (id === adFinderInfo && len >= 10) {
			f.type = fourCCAt(entry, 0);
			f.creator = fourCCAt(entry, 4);
			f.finderFlags = u16(entry, 8);
		} else if (id === adFileDates && len >= 8) {
			// AppleDouble dates count seconds from 2000-01-01; convert to the 1904 epoch.
			const from2000To1904 = 3029529600;
			f.created = (s32(entry, 0) + from2000To1904) >>> 0;
			f.modified = (s32(entry, 4) + from2000To1904) >>> 0;
		}
	}
	return f;
}
