// Port: THINK Pascal record layout, for the records Glider reads and writes as raw bytes
// (houses, saved games, preferences).
//
// Layout rules of THINK Pascal on the 68000, confirmed by houseRec (13830 bytes) and the
// preferences record (170 bytes):
// - Boolean and byte fields align to 1 byte; all other fields, including strings, align to 2.
// - string[n] occupies n + 1 bytes (a length byte and n characters).
// - Records and array elements are padded to an even size.

import { s16, s32, u8 } from './Binary.ts';
import { decodeMacRoman, encodeMacRoman } from './MacRoman.ts';

interface IntLayout {
	kind: 'int';
	size: 1 | 2 | 4;
}
interface BoolLayout {
	kind: 'bool';
}
interface StrLayout {
	kind: 'string';
	max: number;
}
interface ArrLayout<E extends Layout> {
	kind: 'array';
	lo: number;
	hi: number;
	of: E;
}
interface RecLayout<F extends Record<string, Layout>> {
	kind: 'record';
	fields: F;
}
export type Layout = IntLayout | BoolLayout | StrLayout | ArrLayout<any> | RecLayout<any>;

/** The JavaScript value type of a layout. Arrays keep Pascal indexes: element `lo` is at index `lo`. */
export type ValueOf<L> = L extends IntLayout
	? number
	: L extends BoolLayout
		? boolean
		: L extends StrLayout
			? string
			: L extends ArrLayout<infer E>
				? ValueOf<E>[]
				: L extends RecLayout<infer F>
					? { [K in keyof F]: ValueOf<F[K]> }
					: never;

export const PInteger: IntLayout = { kind: 'int', size: 2 };
export const PLongInt: IntLayout = { kind: 'int', size: 4 };
export const PSignedByte: IntLayout = { kind: 'int', size: 1 };
export const PBoolean: BoolLayout = { kind: 'bool' };

export function PString(max: number): StrLayout {
	return { kind: 'string', max };
}

export function PArray<E extends Layout>(lo: number, hi: number, of: E): ArrLayout<E> {
	return { kind: 'array', lo, hi, of };
}

export function PRecord<F extends Record<string, Layout>>(fields: F): RecLayout<F> {
	return { kind: 'record', fields };
}

export const PRect = PRecord({ top: PInteger, left: PInteger, bottom: PInteger, right: PInteger });
export const PPoint = PRecord({ v: PInteger, h: PInteger });

export function alignOf(l: Layout): number {
	switch (l.kind) {
		case 'int':
			return l.size === 1 ? 1 : 2;
		case 'bool':
			return 1;
		case 'string':
			return 2;
		case 'array':
			return alignOf(l.of);
		case 'record':
			return 2;
	}
}

/** Pascal `SIZEOF`. */
export function sizeOf(l: Layout): number {
	switch (l.kind) {
		case 'int':
			return l.size;
		case 'bool':
			return 1;
		case 'string':
			return l.max + 1;
		case 'array': {
			const count = l.hi - l.lo + 1;
			const elem = sizeOf(l.of);
			const stride = alignOf(l.of) === 1 && elem === 1 ? 1 : elem + (elem & 1);
			return count * stride;
		}
		case 'record': {
			let off = 0;
			for (const f of Object.values(l.fields) as Layout[]) {
				off = align(off, alignOf(f)) + sizeOf(f);
			}
			return align(off, 2);
		}
	}
}

function align(n: number, a: number): number {
	return a === 1 ? n : n + (n & 1);
}

function elemStride(l: ArrLayout<Layout>): number {
	const elem = sizeOf(l.of);
	return alignOf(l.of) === 1 && elem === 1 ? 1 : elem + (elem & 1);
}

/** A zeroed value of a layout, as Pascal leaves memory after NewPtrClear. */
export function zeroOf<L extends Layout>(l: L): ValueOf<L> {
	return readLayout(l, new Uint8Array(sizeOf(l)), 0);
}

export function readLayout<L extends Layout>(l: L, b: Uint8Array, o: number): ValueOf<L> {
	const lay = l as Layout;
	switch (lay.kind) {
		case 'int':
			return (lay.size === 1 ? (u8(b, o) << 24) >> 24 : lay.size === 2 ? s16(b, o) : s32(b, o)) as ValueOf<L>;
		case 'bool':
			return (u8(b, o) !== 0) as ValueOf<L>;
		case 'string': {
			const n = Math.min(u8(b, o), lay.max);
			return decodeMacRoman(b.subarray(o + 1, o + 1 + n)) as ValueOf<L>;
		}
		case 'array': {
			const stride = elemStride(lay);
			const out: unknown[] = [];
			const zero = lay.lo > 0 ? zeroOf(lay.of) : undefined;
			for (let i = 0; i < lay.lo; i++) {
				out[i] = zero;
			}
			for (let i = lay.lo; i <= lay.hi; i++) {
				out[i] = readLayout(lay.of, b, o + (i - lay.lo) * stride);
			}
			return out as ValueOf<L>;
		}
		case 'record': {
			const out: Record<string, unknown> = {};
			let off = 0;
			for (const [name, f] of Object.entries(lay.fields) as [string, Layout][]) {
				off = align(off, alignOf(f));
				out[name] = readLayout(f, b, o + off);
				off += sizeOf(f);
			}
			return out as ValueOf<L>;
		}
	}
}

/**
 * Writes a value into `b` at `o`. Bytes the layout does not cover (padding, and string
 * characters past the length byte) are left as they are, as when Pascal writes a record
 * that was read from a file.
 */
export function writeLayout<L extends Layout>(l: L, v: ValueOf<L>, b: Uint8Array, o: number): void {
	const lay = l as Layout;
	const val = v as unknown;
	switch (lay.kind) {
		case 'int': {
			const n = val as number;
			for (let i = lay.size - 1, x = n; i >= 0; i--, x >>= 8) {
				b[o + i] = x & 0xff;
			}
			return;
		}
		case 'bool':
			b[o] = val ? 1 : 0;
			return;
		case 'string': {
			const enc = encodeMacRoman(val as string).subarray(0, lay.max);
			b[o] = enc.length;
			b.set(enc, o + 1);
			return;
		}
		case 'array': {
			const stride = elemStride(lay);
			const arr = val as unknown[];
			for (let i = lay.lo; i <= lay.hi; i++) {
				writeLayout(lay.of, arr[i] as never, b, o + (i - lay.lo) * stride);
			}
			return;
		}
		case 'record': {
			const rec = val as Record<string, unknown>;
			let off = 0;
			for (const [name, f] of Object.entries(lay.fields) as [string, Layout][]) {
				off = align(off, alignOf(f));
				writeLayout(f, rec[name] as never, b, o + off);
				off += sizeOf(f);
			}
			return;
		}
	}
}
