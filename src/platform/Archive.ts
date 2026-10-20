// Port: what the readers of old Mac archives share (StuffIt.ts, CompactPro.ts, DiskImage.ts): bytes
// read big-endian, bit streams, prefix codes, and the files they find.

import type { MacFile } from '../mac/MacBinary.ts';

/** An archive or disk image that cannot be read. */
export class ArchiveError extends Error {}

export function fail(message: string): never {
	throw new ArchiveError(message);
}

export const u16 = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
export const u32 = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
export const fourCC = (b: Uint8Array, o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);

export interface Bits {
	bit(): number;
}

/** Bits read least significant first. */
export class BitReaderLE implements Bits {
	private pos = 0;
	private bitPos = 0;
	private readonly b: Uint8Array;
	constructor(b: Uint8Array) {
		this.b = b;
	}

	bit(): number {
		if (this.pos >= this.b.length) {
			fail('compressed data ends early');
		}
		const v = (this.b[this.pos]! >> this.bitPos) & 1;
		if (++this.bitPos === 8) {
			this.bitPos = 0;
			this.pos++;
		}
		return v;
	}

	bits(n: number): number {
		let v = 0;
		for (let i = 0; i < n; i++) {
			v |= this.bit() << i;
		}
		return v;
	}
}

/** Bits read most significant first. */
export class BitReaderBE implements Bits {
	private pos = 0;
	private bitPos = 0;
	private readonly b: Uint8Array;
	private readonly padded: boolean;
	/** `padded`: past the end the stream reads as zeros (Arsenic's arithmetic coder looks ahead). */
	constructor(b: Uint8Array, padded = false) {
		this.b = b;
		this.padded = padded;
	}

	bit(): number {
		if (this.pos >= this.b.length && !this.padded) {
			fail('compressed data ends early');
		}
		const v = this.pos < this.b.length ? (this.b[this.pos]! >> (7 - this.bitPos)) & 1 : 0;
		if (++this.bitPos === 8) {
			this.bitPos = 0;
			this.pos++;
		}
		return v;
	}

	bits(n: number): number {
		let v = 0;
		for (let i = 0; i < n; i++) {
			v = (v << 1) | this.bit();
		}
		return v;
	}

	/** Skips to the next whole byte. */
	align(): void {
		if (this.bitPos !== 0) {
			this.bitPos = 0;
			this.pos++;
		}
	}

	/** The offset of the next whole byte. */
	get offset(): number {
		return this.bitPos === 0 ? this.pos : this.pos + 1;
	}

	skip(bytes: number): void {
		this.align();
		this.pos += bytes;
	}
}

/** A prefix code as a binary tree: node k has children tree[2k] (bit 0) and tree[2k + 1]; leaves are -1 - symbol. */
export class PrefixCode {
	private tree: number[] = [0, 0];

	/** Adds a code of `length` bits, given most significant bit first. */
	add(code: number, length: number, symbol: number): void {
		let node = 0;
		for (let i = length - 1; i >= 0; i--) {
			const b = (code >> i) & 1;
			if (i === 0) {
				this.tree[node * 2 + b] = -1 - symbol;
			} else {
				let next = this.tree[node * 2 + b]!;
				if (next <= 0) {
					next = this.tree.length / 2;
					this.tree[node * 2 + b] = next;
					this.tree.push(0, 0);
				}
				node = next;
			}
		}
	}

	/** The canonical code for these lengths: shorter codes first, then by symbol (as Deflate's). */
	static canonical(lengths: number[]): PrefixCode {
		const code = new PrefixCode();
		let next = 0;
		const max = Math.max(0, ...lengths);
		for (let len = 1; len <= max; len++) {
			for (let s = 0; s < lengths.length; s++) {
				if (lengths[s] === len) {
					code.add(next, len, s);
					next++;
				}
			}
			next <<= 1;
		}
		return code;
	}

	read(r: Bits): number {
		let node = 0;
		for (;;) {
			const next = this.tree[node * 2 + r.bit()]!;
			if (next < 0) {
				return -1 - next;
			}
			if (next === 0) {
				fail('invalid prefix code');
			}
			node = next;
		}
	}
}

export interface ArchiveContents {
	files: MacFile[];
	/** Files that could not be expanded: their names, Finder types, and why. */
	failed: { name: string; type: string; creator: string; why: string }[];
}

/** Adds a file to the contents, or to those that failed if its forks cannot be expanded. */
export function member(name: string, type: string, creator: string, finderFlags: number, created: number, modified: number, data: () => Uint8Array, rsrc: () => Uint8Array, out: ArchiveContents): void {
	try {
		out.files.push({ name, type, creator, finderFlags, created, modified, data: data(), rsrc: rsrc() });
	} catch (e) {
		if (!(e instanceof ArchiveError)) {
			throw e;
		}
		out.failed.push({ name, type, creator, why: e.message });
	}
}
