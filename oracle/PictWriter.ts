// Writes QuickDraw pictures (Inside Macintosh: Imaging With QuickDraw, Appendix A) for oracle tests:
// the original ROM draws them and the port draws the same bytes.

import { ByteWriter } from '../src/mac/Binary.ts';
import { encodeMacRoman } from '../src/mac/MacRoman.ts';
import type { Point, Rect } from '../src/mac/Types.ts';

/** The five drawing verbs, in opcode order. */
export type Verb = 'frame' | 'paint' | 'erase' | 'invert' | 'fill';
const verbs: Verb[] = ['frame', 'paint', 'erase', 'invert', 'fill'];

export type Pattern = readonly number[];

export interface RGB {
	red: number;
	green: number;
	blue: number;
}

export class PictWriter {
	private w = new ByteWriter();
	readonly frame: Rect;
	readonly version: 1 | 2;

	/**
	 * Version 1 pictures have byte opcodes and are drawn the same in black and white and in color.
	 * Version 2 pictures have word opcodes and can hold RGB colors and pixel maps.
	 */
	constructor(frame: Rect, version: 1 | 2 = 1) {
		this.frame = frame;
		this.version = version;
		this.w.u16(0).rect(frame);
		if (version === 1) {
			this.w.u8(0x11).u8(0x01);
		} else {
			this.w.u16(0x0011).u16(0x02ff);
			// HeaderOp: version -1 (original version 2), fixed-point bounds, reserved.
			this.w.u16(0x0c00).u32(0xffffffff).u32(frame.left << 16).u32(frame.top << 16).u32(frame.right << 16).u32(frame.bottom << 16).u32(0);
		}
	}

	private op(code: number): ByteWriter {
		if (this.version === 1) {
			if (code > 0xff) {
				throw new Error(`opcode ${code.toString(16)} needs a version 2 picture`);
			}
			this.w.u8(code);
		} else {
			this.w.align(2);
			this.w.u16(code);
		}
		return this.w;
	}

	clipRect(r: Rect): this {
		this.op(0x01).u16(10).rect(r);
		return this;
	}

	/** A region given as its Mac representation (rgnSize, rgnBBox, scan lines). */
	clipRgn(rgn: Uint8Array): this {
		this.op(0x01).bytes(rgn);
		return this;
	}

	bkPat(p: Pattern): this {
		this.op(0x02).bytes(new Uint8Array(p));
		return this;
	}

	txFont(n: number): this {
		this.op(0x03).u16(n);
		return this;
	}

	txFace(n: number): this {
		this.op(0x04).u8(n);
		return this;
	}

	txMode(n: number): this {
		this.op(0x05).u16(n);
		return this;
	}

	penSize(h: number, v: number): this {
		this.op(0x07).u16(v).u16(h);
		return this;
	}

	penMode(n: number): this {
		this.op(0x08).u16(n);
		return this;
	}

	penPat(p: Pattern): this {
		this.op(0x09).bytes(new Uint8Array(p));
		return this;
	}

	fillPat(p: Pattern): this {
		this.op(0x0a).bytes(new Uint8Array(p));
		return this;
	}

	ovSize(h: number, v: number): this {
		this.op(0x0b).u16(v).u16(h);
		return this;
	}

	origin(dh: number, dv: number): this {
		this.op(0x0c).u16(dh).u16(dv);
		return this;
	}

	txSize(n: number): this {
		this.op(0x0d).u16(n);
		return this;
	}

	/** Old-style colors: blackColor = 33, whiteColor = 30, redColor = 205, and so on. */
	fgColor(c: number): this {
		this.op(0x0e).u32(c);
		return this;
	}

	bkColor(c: number): this {
		this.op(0x0f).u32(c);
		return this;
	}

	rgbFgColor(c: RGB): this {
		this.op(0x1a).u16(c.red).u16(c.green).u16(c.blue);
		return this;
	}

	rgbBkColor(c: RGB): this {
		this.op(0x1b).u16(c.red).u16(c.green).u16(c.blue);
		return this;
	}

	line(from: Point, to: Point): this {
		this.op(0x20).u16(from.v).u16(from.h).u16(to.v).u16(to.h);
		return this;
	}

	lineFrom(to: Point): this {
		this.op(0x21).u16(to.v).u16(to.h);
		return this;
	}

	/** Draws text at a pen location. */
	text(at: Point, s: string): this {
		const t = encodeMacRoman(s);
		this.op(0x28).u16(at.v).u16(at.h).u8(t.length).bytes(t);
		return this;
	}

	rect(verb: Verb, r: Rect): this {
		this.op(0x30 + verbs.indexOf(verb)).rect(r);
		return this;
	}

	rRect(verb: Verb, r: Rect): this {
		this.op(0x40 + verbs.indexOf(verb)).rect(r);
		return this;
	}

	oval(verb: Verb, r: Rect): this {
		this.op(0x50 + verbs.indexOf(verb)).rect(r);
		return this;
	}

	arc(verb: Verb, r: Rect, startAngle: number, arcAngle: number): this {
		this.op(0x60 + verbs.indexOf(verb)).rect(r).u16(startAngle).u16(arcAngle);
		return this;
	}

	poly(verb: Verb, points: Point[]): this {
		const top = Math.min(...points.map((p) => p.v));
		const left = Math.min(...points.map((p) => p.h));
		const bottom = Math.max(...points.map((p) => p.v));
		const right = Math.max(...points.map((p) => p.h));
		const w = this.op(0x70 + verbs.indexOf(verb)).u16(10 + points.length * 4).rect({ top, left, bottom, right });
		for (const p of points) {
			w.u16(p.v).u16(p.h);
		}
		return this;
	}

	rgn(verb: Verb, rgn: Uint8Array): this {
		this.op(0x80 + verbs.indexOf(verb)).bytes(rgn);
		return this;
	}

	/**
	 * Copies a 1-bit image (rows of `rowBytes` bytes covering `bounds`) with CopyBits,
	 * from `src` to `dst` in transfer mode `mode`. Rows are stored unpacked, which needs rowBytes < 8.
	 */
	bits(bounds: Rect, rowBytes: number, rows: Uint8Array, src: Rect, dst: Rect, mode: number): this {
		if (rowBytes >= 8) {
			throw new Error('rows of 8 or more bytes must be packed');
		}
		this.op(0x90).u16(rowBytes).rect(bounds).rect(src).rect(dst).u16(mode).bytes(rows);
		return this;
	}

	/** A pen pixel pattern, from a 'ppat' resource (type 1, unpacked rows of fewer than 8 bytes). */
	pnPixPat(ppat: Uint8Array): this {
		const u16 = (o: number) => (ppat[o]! << 8) | ppat[o + 1]!;
		const u32 = (o: number) => ((u16(o) << 16) | u16(o + 2)) >>> 0;
		const m = u32(2);
		const rowBytes = u16(m + 4) & 0x3fff;
		const height = u16(m + 10) - u16(m + 6);
		const ct = u32(m + 42);
		const ctLength = 8 + (u16(ct + 6) + 1) * 8;
		const w = this.op(0x13).u16(u16(0)).bytes(ppat.subarray(20, 28));
		// The pixel map from rowBytes to pmReserved (without baseAddr), its color table, and its pixels.
		w.bytes(ppat.subarray(m + 4, m + 50)).bytes(ppat.subarray(ct, ct + ctLength));
		w.bytes(ppat.subarray(u32(6), u32(6) + rowBytes * height));
		return this;
	}

	shortComment(kind: number): this {
		this.op(0xa0).u16(kind);
		return this;
	}

	toBytes(): Uint8Array {
		this.op(0xff);
		const b = this.w.toBytes();
		b[0] = (b.length >> 8) & 0xff;
		b[1] = b.length & 0xff;
		return b;
	}
}
