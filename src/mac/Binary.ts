// Big-endian binary reading and writing, as the 68000 stored data.

import { int16, int32, type Integer, type LongInt } from './Types.ts';

/** Copies bytes `start` to `end` into a plain Uint8Array (even when `b` is a Node.js Buffer). */
export function copyBytes(b: Uint8Array, start: number, end: number): Uint8Array {
	return new Uint8Array(b.subarray(start, end));
}

export function u8(b: Uint8Array, o: number): number {
	return b[o]!;
}

export function u16(b: Uint8Array, o: number): number {
	return (b[o]! << 8) | b[o + 1]!;
}

export function s16(b: Uint8Array, o: number): Integer {
	return int16(u16(b, o));
}

export function u32(b: Uint8Array, o: number): number {
	return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

export function s32(b: Uint8Array, o: number): LongInt {
	return int32(u32(b, o));
}

export function put8(b: Uint8Array, o: number, v: number): void {
	b[o] = v & 0xff;
}

export function put16(b: Uint8Array, o: number, v: number): void {
	b[o] = (v >>> 8) & 0xff;
	b[o + 1] = v & 0xff;
}

export function put32(b: Uint8Array, o: number, v: number): void {
	b[o] = (v >>> 24) & 0xff;
	b[o + 1] = (v >>> 16) & 0xff;
	b[o + 2] = (v >>> 8) & 0xff;
	b[o + 3] = v & 0xff;
}

/** Reads a four-character code. */
export function fourCCAt(b: Uint8Array, o: number): string {
	return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
}

export function putFourCC(b: Uint8Array, o: number, code: string): void {
	for (let i = 0; i < 4; i++) {
		b[o + i] = code.charCodeAt(i) & 0xff;
	}
}

/** A growable big-endian byte buffer. */
export class ByteWriter {
	private buf = new Uint8Array(256);
	length = 0;

	private ensure(n: number): void {
		if (this.length + n <= this.buf.length) {
			return;
		}
		let size = this.buf.length * 2;
		while (size < this.length + n) {
			size *= 2;
		}
		const next = new Uint8Array(size);
		next.set(this.buf.subarray(0, this.length));
		this.buf = next;
	}

	u8(v: number): this {
		this.ensure(1);
		put8(this.buf, this.length, v);
		this.length += 1;
		return this;
	}

	u16(v: number): this {
		this.ensure(2);
		put16(this.buf, this.length, v);
		this.length += 2;
		return this;
	}

	u32(v: number): this {
		this.ensure(4);
		put32(this.buf, this.length, v);
		this.length += 4;
		return this;
	}

	/** A QuickDraw rectangle: top, left, bottom, right. */
	rect(r: { top: number; left: number; bottom: number; right: number }): this {
		return this.u16(r.top).u16(r.left).u16(r.bottom).u16(r.right);
	}

	fourCC(code: string): this {
		this.ensure(4);
		putFourCC(this.buf, this.length, code);
		this.length += 4;
		return this;
	}

	bytes(data: Uint8Array): this {
		this.ensure(data.length);
		this.buf.set(data, this.length);
		this.length += data.length;
		return this;
	}

	zeros(n: number): this {
		this.ensure(n);
		this.buf.fill(0, this.length, this.length + n);
		this.length += n;
		return this;
	}

	/** Pads with zeros to a multiple of `n` bytes. */
	align(n: number): this {
		const rem = this.length % n;
		return rem === 0 ? this : this.zeros(n - rem);
	}

	toBytes(): Uint8Array {
		return this.buf.slice(0, this.length);
	}
}
