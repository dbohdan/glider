// Port: StuffIt archives, the way Glider's houses went around in the 1990s (the desktop's Import
// Files…). Both containers are read: classic archives ("SIT!", StuffIt 1.5 to 4) and StuffIt 5's
// ("StuffIt (c)1997-…"). Three of StuffIt's compression methods are decoded: 0 (stored), 13
// (LZSS with Huffman codes, StuffIt 3's default), and 15 ("Arsenic", StuffIt 5's: block sorting,
// move-to-front, and an adaptive arithmetic coder). Written from the formats as they are
// documented, and checked byte for byte against The Unarchiver's extraction of real Glider
// archives (test/platform/stuffit.test.ts).

import { decodeMacRoman } from '../mac/MacRoman.ts';
import { type ArchiveContents, BitReaderBE, BitReaderLE, fail, fourCC, member, PrefixCode, u16, u32 } from './Archive.ts';

/** Whether bytes are a StuffIt archive, classic or StuffIt 5's. */
export function isStuffIt(b: Uint8Array): boolean {
	return (b.length >= 22 && fourCC(b, 0) === 'SIT!' && fourCC(b, 10) === 'rLau') || (b.length >= 100 && decodeMacRoman(b.subarray(0, 16)) === 'StuffIt (c)1997-');
}

// ---------------------------------------------------------------------------------------------
// Method 13: LZSS with Huffman codes, read least significant bit first

/**
 * The code that codes method 13's code lengths: 37 symbols, given here as codes and lengths (the
 * codes' bits as the stream holds them, least significant first).
 */
const metaCodes = [
	0x5d8, 0x058, 0x040, 0x0c0, 0x000, 0x078, 0x02b, 0x014, 0x00c, 0x01c, 0x01b, 0x00b, 0x010, 0x020, 0x038, 0x018, 0x0d8, 0xbd8, 0x180, 0x680, 0x380, 0xf80, 0x780, 0x480, 0x080, 0x280, 0x3d8, 0xfd8, 0x7d8,
	0x9d8, 0x1d8, 0x004, 0x001, 0x002, 0x007, 0x003, 0x008,
];
const metaLengths = [11, 8, 8, 8, 8, 7, 6, 5, 5, 5, 5, 6, 5, 6, 7, 7, 9, 12, 10, 11, 11, 12, 12, 11, 11, 11, 12, 12, 12, 12, 12, 5, 2, 2, 3, 4, 5];

let metaCode: PrefixCode | null = null;

function reverse(code: number, length: number): number {
	let r = 0;
	for (let i = 0; i < length; i++) {
		r = (r << 1) | ((code >> i) & 1);
	}
	return r;
}

function readLengths(r: BitReaderLE, count: number): PrefixCode {
	if (metaCode === null) {
		metaCode = new PrefixCode();
		metaLengths.forEach((len, s) => metaCode!.add(reverse(metaCodes[s]!, len), len, s));
	}
	const lengths: number[] = [];
	let length = 0;
	while (lengths.length < count) {
		const v = metaCode.read(r);
		if (v === 31) {
			length = -1;
		} else if (v === 32) {
			length++;
		} else if (v === 33) {
			length--;
		} else if (v === 34) {
			if (r.bit()) {
				lengths.push(length);
			}
		} else if (v === 35) {
			for (let n = r.bits(3) + 2; n > 0; n--) {
				lengths.push(length);
			}
		} else if (v === 36) {
			for (let n = r.bits(6) + 10; n > 0; n--) {
				lengths.push(length);
			}
		} else {
			length = v + 1;
		}
		lengths.push(length);
	}
	return PrefixCode.canonical(lengths.slice(0, count).map((l) => Math.max(0, l)));
}

function method13(src: Uint8Array, size: number): Uint8Array {
	const r = new BitReaderLE(src);
	const mode = r.bits(8);
	if (mode >> 4 !== 0) {
		fail(`method 13 with built-in code tables (set ${mode >> 4}) is not supported`);
	}
	const first = readLengths(r, 321);
	const second = mode & 0x08 ? first : readLengths(r, 321);
	const offsets = readLengths(r, (mode & 0x07) + 10);
	const out = new Uint8Array(size);
	let n = 0;
	let code = first;
	while (n < size) {
		const v = code.read(r);
		if (v < 0x100) {
			out[n++] = v;
			code = first;
			continue;
		}
		code = second;
		let length: number;
		if (v < 0x13e) {
			length = v - 0x100 + 3;
		} else if (v === 0x13e) {
			length = r.bits(10) + 65;
		} else if (v === 0x13f) {
			length = r.bits(15) + 65;
		} else {
			break;
		}
		const bits = offsets.read(r);
		const offset = bits === 0 ? 1 : bits === 1 ? 2 : (1 << (bits - 1)) + r.bits(bits - 1) + 1;
		if (offset > n) {
			fail('match before the start of the data');
		}
		for (let k = 0; k < length && n < size; k++, n++) {
			out[n] = out[n - offset]!;
		}
	}
	if (n !== size) {
		fail('compressed data ends early');
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Method 15: Arsenic

/** An adaptive model of symbols first..last: each count grows by `increment`, halved past `limit`. */
class Model {
	readonly freq: number[];
	total = 0;
	readonly first: number;
	readonly increment: number;
	readonly limit: number;
	constructor(first: number, last: number, increment: number, limit: number) {
		this.first = first;
		this.increment = increment;
		this.limit = limit;
		this.freq = Array.from({ length: last - first + 1 }, () => 0);
		this.reset();
	}

	reset(): void {
		this.freq.fill(this.increment);
		this.total = this.increment * this.freq.length;
	}
}

const precision = 26;
const one = 1 << (precision - 1);
const half = 1 << (precision - 2);

class ArithmeticDecoder {
	private range = one;
	private code: number;
	private readonly r: BitReaderBE;
	constructor(r: BitReaderBE) {
		this.r = r;
		this.code = r.bits(precision);
	}

	symbol(m: Model): number {
		const unit = Math.floor(this.range / m.total);
		const target = Math.floor(this.code / unit);
		let low = 0;
		let n = 0;
		for (; n < m.freq.length - 1; n++) {
			if (low + m.freq[n]! > target) {
				break;
			}
			low += m.freq[n]!;
		}
		const size = m.freq[n]!;
		this.code -= unit * low;
		if (low + size === m.total) {
			this.range -= unit * low;
		} else {
			this.range = size * unit;
		}
		while (this.range <= half) {
			this.range *= 2;
			this.code = this.code * 2 + this.r.bit();
		}
		m.freq[n]! += m.increment;
		m.total += m.increment;
		if (m.total > m.limit) {
			m.total = 0;
			for (let i = 0; i < m.freq.length; i++) {
				m.freq[i] = (m.freq[i]! + 1) >> 1;
				m.total += m.freq[i]!;
			}
		}
		return m.first + n;
	}

	/** A number of `bits` bits, least significant first, each a symbol of a two-symbol model. */
	bits(m: Model, bits: number): number {
		let v = 0;
		for (let i = 0; i < bits; i++) {
			if (this.symbol(m)) {
				v |= 1 << i;
			}
		}
		return v >>> 0;
	}
}

function method15(src: Uint8Array, size: number): Uint8Array {
	const d = new ArithmeticDecoder(new BitReaderBE(src, true));
	const initial = new Model(0, 1, 1, 256);
	const selector = new Model(0, 10, 8, 1024);
	const mtfModels = [new Model(2, 3, 8, 1024), new Model(4, 7, 4, 1024), new Model(8, 15, 4, 1024), new Model(16, 31, 4, 1024), new Model(32, 63, 2, 1024), new Model(64, 127, 2, 1024), new Model(128, 255, 1, 1024)];
	if (d.bits(initial, 8) !== 0x41 || d.bits(initial, 8) !== 0x73) {
		fail('not Arsenic data');
	}
	const blockBits = d.bits(initial, 4) + 9;
	const blockSize = 1 << blockBits;
	let end = d.symbol(initial) !== 0;
	const out = new Uint8Array(size);
	let n = 0;
	// The final run-length stage: after four equal bytes, a count of more.
	let last = -1;
	let run = 0;
	const emit = (byte: number): void => {
		if (run === 4) {
			for (let k = 0; k < byte && n < size; k++) {
				out[n++] = last;
			}
			run = 0;
			return;
		}
		if (n < size) {
			out[n++] = byte;
		}
		if (byte === last) {
			run++;
		} else {
			last = byte;
			run = 1;
		}
	};
	const block = new Uint8Array(blockSize);
	const transform = new Uint32Array(blockSize);
	while (!end) {
		const mtf = Array.from({ length: 256 }, (_, i) => i);
		const fromFront = (i: number): number => {
			const v = mtf[i]!;
			mtf.splice(i, 1);
			mtf.unshift(v);
			return v;
		};
		if (d.symbol(initial)) {
			fail('randomized Arsenic blocks are not supported');
		}
		const index = d.bits(initial, blockBits);
		let count = 0;
		for (;;) {
			let sel = d.symbol(selector);
			if (sel === 0 || sel === 1) {
				let weight = 1;
				let zeros = 0;
				while (sel < 2) {
					zeros += sel === 0 ? weight : 2 * weight;
					weight *= 2;
					sel = d.symbol(selector);
				}
				if (count + zeros > blockSize) {
					fail('Arsenic block overflows');
				}
				block.fill(fromFront(0), count, count + zeros);
				count += zeros;
			}
			if (sel === 10) {
				break;
			}
			const symbol = sel === 2 ? 1 : d.symbol(mtfModels[sel - 3]!);
			if (count >= blockSize) {
				fail('Arsenic block overflows');
			}
			block[count++] = fromFront(symbol);
		}
		if (index >= count) {
			fail('bad Arsenic block');
		}
		selector.reset();
		for (const m of mtfModels) {
			m.reset();
		}
		if (d.symbol(initial)) {
			d.bits(initial, 32); // the CRC
			end = true;
		}
		// The inverse of the block sort.
		const counts = Array.from({ length: 256 }, () => 0);
		for (let i = 0; i < count; i++) {
			counts[block[i]!]!++;
		}
		const start = Array.from({ length: 256 }, () => 0);
		let total = 0;
		for (let c = 0; c < 256; c++) {
			start[c] = total;
			total += counts[c]!;
		}
		for (let i = 0; i < count; i++) {
			transform[start[block[i]!]!++] = i;
		}
		let pos = transform[index]!;
		for (let i = 0; i < count; i++) {
			emit(block[pos]!);
			pos = transform[pos]!;
		}
	}
	if (n !== size) {
		fail('compressed data ends early');
	}
	return out;
}

function expand(method: number, src: Uint8Array, size: number): Uint8Array {
	switch (method & 0x0f) {
		case 0:
			return src.slice(0, size);
		case 13:
			return method13(src, size);
		case 15:
			return method15(src, size);
		default:
			fail(`StuffIt's compression method ${method & 0x0f} is not supported`);
	}
}

// ---------------------------------------------------------------------------------------------
// The containers

/** A classic archive: a 22-byte header and entries of 112-byte headers, folders bracketed by methods 32 and 33. */
function readClassic(b: Uint8Array, out: ArchiveContents): void {
	let p = 22;
	while (p + 112 <= b.length) {
		const rMethod = b[p]!;
		const dMethod = b[p + 1]!;
		if (rMethod === 32 || dMethod === 32 || rMethod === 33 || dMethod === 33) {
			p += 112;
			continue;
		}
		const name = decodeMacRoman(b.subarray(p + 3, p + 3 + Math.min(63, b[p + 2]!)));
		const rLen = u32(b, p + 84);
		const dLen = u32(b, p + 88);
		const rComp = u32(b, p + 92);
		const dComp = u32(b, p + 96);
		const rStart = p + 112;
		const dStart = rStart + rComp;
		if ((rMethod | dMethod) & 0x10) {
			out.failed.push({ name, type: fourCC(b, p + 66), creator: fourCC(b, p + 70), why: 'it is encrypted' });
		} else {
			member(
				name,
				fourCC(b, p + 66),
				fourCC(b, p + 70),
				u16(b, p + 74),
				u32(b, p + 76),
				u32(b, p + 80),
				() => expand(dMethod, b.subarray(dStart, dStart + dComp), dLen),
				() => expand(rMethod, b.subarray(rStart, rStart + rComp), rLen),
				out,
			);
		}
		p = dStart + dComp;
	}
}

/** StuffIt 5's archive: entries of variable headers, a folder's members following it. */
function readStuffIt5(b: Uint8Array, out: ArchiveContents): void {
	const entry = (p: number): number => {
		if (u32(b, p) !== 0xa5a5a5a5) {
			fail('bad StuffIt 5 entry');
		}
		const version = b[p + 4]!;
		const headerSize = u16(b, p + 6);
		const flags = b[p + 9]!;
		const created = u32(b, p + 10);
		const modified = u32(b, p + 14);
		const next = u32(b, p + 22);
		const nameLength = u16(b, p + 30);
		const dLen = u32(b, p + 34);
		const dComp = u32(b, p + 38);
		let q = p + 46;
		let dMethod = 0;
		let members = 0;
		if (flags & 0x40) {
			members = u16(b, q);
			q += 2;
		} else {
			dMethod = b[q]!;
			q += 2 + b[q + 1]!;
		}
		const name = decodeMacRoman(b.subarray(q, q + nameLength));
		q = p + headerSize;
		const forks = u16(b, q);
		q += 4;
		const type = fourCC(b, q);
		const creator = fourCC(b, q + 4);
		const finderFlags = u16(b, q + 8);
		q += 10 + (version === 1 ? 22 : 18);
		let rLen = 0;
		let rComp = 0;
		let rMethod = 0;
		if (forks & 1) {
			rLen = u32(b, q);
			rComp = u32(b, q + 4);
			rMethod = b[q + 12]!;
			q += 14 + b[q + 13]!;
		}
		if (flags & 0x40) {
			let child = q;
			for (let k = 0; k < members; k++) {
				child = entry(child);
			}
			return next !== 0 ? next : child;
		}
		const rStart = q;
		const dStart = q + rComp;
		if (flags & 0x20) {
			out.failed.push({ name, type, creator, why: 'it is encrypted' });
		} else {
			member(
				name,
				type,
				creator,
				finderFlags,
				created,
				modified,
				() => expand(dMethod, b.subarray(dStart, dStart + dComp), dLen),
				() => expand(rMethod, b.subarray(rStart, rStart + rComp), rLen),
				out,
			);
		}
		return dStart + dComp;
	};
	let p = u32(b, 94);
	for (let k = u16(b, 92); k > 0; k--) {
		p = entry(p);
	}
}

/** The files in a StuffIt archive, without its folders. */
export function readStuffIt(b: Uint8Array): ArchiveContents {
	const out: ArchiveContents = { files: [], failed: [] };
	if (fourCC(b, 0) === 'SIT!') {
		readClassic(b, out);
	} else {
		readStuffIt5(b, out);
	}
	return out;
}
