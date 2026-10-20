// Port: Compact Pro archives (the desktop's Import Files…), StuffIt's rival in the early 1990s:
// Casady & Greene's More Glider disk carries its Improved Art in one, a self-extracting archive
// whose data fork is the archive. Every fork is run-length coded, and may be compressed before
// that with LZH (LZSS with three prefix codes). Written from the format as The Unarchiver reads it
// (XADCompactProParser, XADCompactProLZHHandle, XADCompactProRLEHandle), and checked byte for byte
// against its extraction (test/platform/compactpro.test.ts).

import { crc32 } from './Zip.ts';
import { decodeMacRoman } from '../mac/MacRoman.ts';
import { type ArchiveContents, BitReaderBE, fail, fourCC, member, PrefixCode, u16, u32 } from './Archive.ts';

/** The directory's CRC, its entry count, and where its entries start; null if it is no directory. */
function directory(b: Uint8Array): { count: number; start: number } | null {
	if (b.length < 8 || b[0] !== 1) {
		return null;
	}
	const at = u32(b, 4);
	if (at + 7 > b.length) {
		return null;
	}
	// The directory's CRC covers its count, its comment, and its entries; it tells an archive from
	// any other file that starts with 1.
	const count = u16(b, at + 4);
	let p = at + 7 + b[at + 6]!;
	for (let i = 0; i < count; i++) {
		if (p >= b.length) {
			return null;
		}
		p += 1 + (b[p]! & 0x7f) + (b[p]! & 0x80 ? 2 : 45);
	}
	// The CRC is stored without its final inversion.
	if (p > b.length || (~crc32(b.subarray(at + 4, p)) >>> 0) !== u32(b, at)) {
		return null;
	}
	return { count, start: at + 7 + b[at + 6]! };
}

/** Whether bytes are a Compact Pro archive (a .cpt file, or a self-extracting archive's data fork). */
export function isCompactPro(b: Uint8Array): boolean {
	return directory(b) !== null;
}

/** The size of the blocks LZH codes with one set of codes, counted as 2 per literal and 3 per match. */
const blockSize = 0x1fff0;

/** A code of `count` symbols, its lengths given in 4 bits each, two to a byte. */
function readCode(r: BitReaderBE, count: number): PrefixCode {
	const bytes = r.bits(8);
	if (bytes * 2 > count) {
		fail('bad LZH code');
	}
	const lengths = Array.from({ length: count }, () => 0);
	for (let i = 0; i < bytes; i++) {
		const v = r.bits(8);
		lengths[i * 2] = v >> 4;
		lengths[i * 2 + 1] = v & 15;
	}
	return PrefixCode.canonical(lengths);
}

/** LZH's bytes, one at a time: a literal, or a match of a length and an offset into the last 8 KB. */
function lzh(src: Uint8Array): () => number {
	const r = new BitReaderBE(src);
	const window = new Uint8Array(8192);
	let pos = 0;
	let count = blockSize;
	let start = -1;
	let literals = new PrefixCode();
	let lengths = new PrefixCode();
	let offsets = new PrefixCode();
	let length = 0;
	let from = 0;
	return () => {
		if (length === 0) {
			if (count >= blockSize) {
				if (start >= 0) {
					// Each block ends on a byte, and then 2 bytes more, or 3 after an odd number.
					r.align();
					r.skip((r.offset - start) & 1 ? 3 : 2);
				}
				literals = readCode(r, 256);
				lengths = readCode(r, 64);
				offsets = readCode(r, 128);
				count = 0;
				start = r.offset;
			}
			if (r.bit()) {
				count += 2;
				const v = literals.read(r);
				window[pos++ & 8191] = v;
				return v;
			}
			count += 3;
			length = lengths.read(r);
			from = pos - ((offsets.read(r) << 6) | r.bits(6));
		}
		length--;
		const v = window[from++ & 8191]!;
		window[pos++ & 8191] = v;
		return v;
	};
}

/**
 * Undoes the run-length coding, to `size` bytes: 0x81 0x82 n repeats the byte before it to n in
 * all, 0x81 0x82 0 is those two bytes, and 0x81 with anything else is itself.
 */
function unRLE(next: () => number, size: number): Uint8Array {
	const out = new Uint8Array(size);
	let saved = 0;
	let repeat = 0;
	let halfEscaped = false;
	let n = 0;
	const put = (v: number) => {
		if (n < size) {
			out[n++] = v;
		}
	};
	while (n < size) {
		if (repeat > 0) {
			repeat--;
			put(saved);
			continue;
		}
		let v = halfEscaped ? 0x81 : next();
		halfEscaped = false;
		if (v !== 0x81) {
			put((saved = v));
			continue;
		}
		v = next();
		if (v === 0x82) {
			v = next();
			if (v !== 0) {
				repeat = v - 2;
				put(saved);
			} else {
				put(0x81);
				saved = 0x82;
				repeat = 1;
			}
		} else if (v === 0x81) {
			halfEscaped = true;
			put((saved = 0x81));
		} else {
			put(0x81);
			saved = v;
			repeat = 1;
		}
	}
	return out;
}

function expand(src: Uint8Array, size: number, compressed: boolean): Uint8Array {
	if (size === 0) {
		return new Uint8Array(0);
	}
	let p = 0;
	const next = compressed
		? lzh(src)
		: () => {
				if (p >= src.length) {
					fail('compressed data ends early');
				}
				return src[p++]!;
			};
	return unRLE(next, size);
}

/** The files in a Compact Pro archive, without its folders. */
export function readCompactPro(b: Uint8Array): ArchiveContents {
	const out: ArchiveContents = { files: [], failed: [] };
	const dir = directory(b);
	if (dir === null) {
		fail('not a Compact Pro archive');
	}
	// Entries follow one another, a folder's (with its count of everything inside it) before its members.
	let p = dir.start;
	for (let i = 0; i < dir.count; i++) {
		const nameLength = b[p]! & 0x7f;
		const isFolder = (b[p]! & 0x80) !== 0;
		const name = decodeMacRoman(b.subarray(p + 1, p + 1 + nameLength));
		p += 1 + nameLength;
		if (isFolder) {
			p += 2;
			continue;
		}
		const at = u32(b, p + 1);
		const type = fourCC(b, p + 5);
		const creator = fourCC(b, p + 9);
		const flags = u16(b, p + 27);
		const rLen = u32(b, p + 29);
		const dLen = u32(b, p + 33);
		const rComp = u32(b, p + 37);
		const dComp = u32(b, p + 41);
		if (flags & 1) {
			out.failed.push({ name, type, creator, why: 'it is encrypted' });
		} else {
			member(
				name,
				type,
				creator,
				u16(b, p + 21),
				u32(b, p + 13),
				u32(b, p + 17),
				() => expand(b.subarray(at + rComp, at + rComp + dComp), dLen, (flags & 4) !== 0),
				() => expand(b.subarray(at, at + rComp), rLen, (flags & 2) !== 0),
				out,
			);
		}
		p += 45;
	}
	return out;
}
