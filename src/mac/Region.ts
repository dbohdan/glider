// Port: QuickDraw regions.
//
// A Mac region is a list of inversion points: each point (h, v) inverts the quadrant to its lower right,
// and the region is what the points leave inverted. Here a region is a list of bands: runs of scan lines
// with the same x-intervals. The Mac form is used where regions are stored (pictures) and while a region
// is being recorded (OpenRgn), where lines contribute inversion points directly.
//
// A RgnHandle is a Region object: `rgn^^.rgnBBox` in Pascal is `rgn.rgnBBox`.

import { ByteWriter, s16 } from './Binary.ts';
import type { Integer, Point, Rect } from './Types.ts';

export interface Band {
	top: number;
	bottom: number;
	/** Interval boundaries: the band covers [xs[0], xs[1]), [xs[2], xs[3]), and so on. */
	xs: number[];
}

/** The end of a scan line or of the region data. */
export const rgnStop = 0x7fff;

export class Region {
	bands: Band[] = [];
	rgnBBox: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	/** The size of the region in its Mac form. */
	get rgnSize(): Integer {
		return toBytes(this).length;
	}

	/** Replaces the bands and recomputes the bounding box; an empty region has an all-zero box. */
	set(bands: Band[]): this {
		this.bands = coalesce(bands);
		if (this.bands.length === 0) {
			this.rgnBBox = { top: 0, left: 0, bottom: 0, right: 0 };
		} else {
			let left = Infinity;
			let right = -Infinity;
			for (const b of this.bands) {
				left = Math.min(left, b.xs[0]!);
				right = Math.max(right, b.xs.at(-1)!);
			}
			this.rgnBBox = { top: this.bands[0]!.top, left, bottom: this.bands.at(-1)!.bottom, right };
		}
		return this;
	}

	isRect(): boolean {
		return this.bands.length === 1 && this.bands[0]!.xs.length === 2;
	}
}

/** Merges vertically adjacent bands with the same intervals and drops empty ones. */
function coalesce(bands: Band[]): Band[] {
	const out: Band[] = [];
	for (const b of bands) {
		if (b.xs.length === 0 || b.bottom <= b.top) {
			continue;
		}
		const last = out.at(-1);
		if (last !== undefined && last.bottom === b.top && sameXs(last.xs, b.xs)) {
			last.bottom = b.bottom;
		} else {
			out.push({ top: b.top, bottom: b.bottom, xs: [...b.xs] });
		}
	}
	return out;
}

function sameXs(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function rectRegion(r: Rect): Region {
	const rgn = new Region();
	if (r.bottom > r.top && r.right > r.left) {
		rgn.set([{ top: r.top, bottom: r.bottom, xs: [r.left, r.right] }]);
	}
	return rgn;
}

export function copyRegion(src: Region, dst: Region): void {
	if (src !== dst) {
		dst.bands = src.bands.map((b) => ({ top: b.top, bottom: b.bottom, xs: [...b.xs] }));
		dst.rgnBBox = { ...src.rgnBBox };
	}
}

/** Builds a region from inversion points: for each scan line, the x coordinates that invert there. */
export function fromInversionPoints(rows: Map<number, number[]>): Region {
	const ys = [...rows.keys()].sort((a, b) => a - b);
	const bands: Band[] = [];
	let cur = new Set<number>();
	for (let i = 0; i < ys.length; i++) {
		const y = ys[i]!;
		for (const x of rows.get(y)!) {
			if (cur.has(x)) {
				cur.delete(x);
			} else {
				cur.add(x);
			}
		}
		cur = new Set(cur);
		const next = ys[i + 1];
		if (next !== undefined && cur.size > 0) {
			bands.push({ top: y, bottom: next, xs: [...cur].sort((a, b) => a - b) });
		}
	}
	return new Region().set(bands);
}

/** Adds inversion points to an accumulator, cancelling pairs: inverting twice is no inversion. */
export function addInversionPoint(rows: Map<number, number[]>, h: number, v: number): void {
	const row = rows.get(v);
	if (row === undefined) {
		rows.set(v, [h]);
		return;
	}
	const i = row.indexOf(h);
	if (i >= 0) {
		row.splice(i, 1);
		if (row.length === 0) {
			rows.delete(v);
		}
	} else {
		row.push(h);
	}
}

/** The inversion points of a region. */
export function inversionPoints(rgn: Region): Map<number, number[]> {
	const rows = new Map<number, number[]>();
	let prev: number[] = [];
	let prevBottom: number | undefined;
	const emit = (y: number, xs: number[]) => {
		// Boundaries in one list but not the other change at this line.
		const changed = xorSorted(prev, xs);
		if (changed.length > 0) {
			rows.set(y, changed);
		}
		prev = xs;
	};
	for (const b of rgn.bands) {
		if (prevBottom !== undefined && prevBottom !== b.top) {
			emit(prevBottom, []);
		}
		emit(b.top, b.xs);
		prevBottom = b.bottom;
	}
	if (prevBottom !== undefined) {
		emit(prevBottom, []);
	}
	return rows;
}

function xorSorted(a: number[], b: number[]): number[] {
	const out: number[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (j >= b.length || (i < a.length && a[i]! < b[j]!)) {
			out.push(a[i++]!);
		} else if (i >= a.length || b[j]! < a[i]!) {
			out.push(b[j++]!);
		} else {
			i++;
			j++;
		}
	}
	return out;
}

/** The region in its Mac form: rgnSize, rgnBBox, then scan lines of inversion points. */
export function toBytes(rgn: Region): Uint8Array {
	const w = new ByteWriter();
	if (rgn.bands.length === 0 || rgn.isRect()) {
		return w.u16(10).rect(rgn.rgnBBox).toBytes();
	}
	w.u16(0).rect(rgn.rgnBBox);
	const rows = inversionPoints(rgn);
	for (const y of [...rows.keys()].sort((a, b) => a - b)) {
		w.u16(y);
		for (const x of rows.get(y)!) {
			w.u16(x);
		}
		w.u16(rgnStop);
	}
	w.u16(rgnStop);
	const b = w.toBytes();
	b[0] = b.length >> 8;
	b[1] = b.length & 0xff;
	return b;
}

/** Reads a region in its Mac form; returns the region and the number of bytes it took. */
export function fromBytes(b: Uint8Array, o = 0): { rgn: Region; size: number } {
	const size = (b[o]! << 8) | b[o + 1]!;
	const bbox = { top: s16(b, o + 2), left: s16(b, o + 4), bottom: s16(b, o + 6), right: s16(b, o + 8) };
	if (size <= 10) {
		return { rgn: rectRegion(bbox), size };
	}
	const rows = new Map<number, number[]>();
	let p = o + 10;
	while (s16(b, p) !== rgnStop) {
		const y = s16(b, p);
		p += 2;
		const xs: number[] = [];
		while (s16(b, p) !== rgnStop) {
			xs.push(s16(b, p));
			p += 2;
		}
		p += 2;
		rows.set(y, xs);
	}
	const rgn = fromInversionPoints(rows);
	return { rgn, size };
}

/** Combines two sets of intervals with a boolean operation. */
function combineXs(a: number[], b: number[], op: (inA: boolean, inB: boolean) => boolean): number[] {
	const out: number[] = [];
	let i = 0;
	let j = 0;
	let inA = false;
	let inB = false;
	let inOut = false;
	while (i < a.length || j < b.length) {
		const x = Math.min(i < a.length ? a[i]! : Infinity, j < b.length ? b[j]! : Infinity);
		while (i < a.length && a[i] === x) {
			inA = !inA;
			i++;
		}
		while (j < b.length && b[j] === x) {
			inB = !inB;
			j++;
		}
		const now = op(inA, inB);
		if (now !== inOut) {
			out.push(x);
			inOut = now;
		}
	}
	return out;
}

/** Applies a boolean operation to two regions, band by band. */
export function combine(a: Region, b: Region, op: (inA: boolean, inB: boolean) => boolean): Region {
	const ys = new Set<number>();
	for (const band of [...a.bands, ...b.bands]) {
		ys.add(band.top);
		ys.add(band.bottom);
	}
	const sorted = [...ys].sort((x, y) => x - y);
	const bands: Band[] = [];
	let ia = 0;
	let ib = 0;
	for (let k = 0; k + 1 < sorted.length; k++) {
		const top = sorted[k]!;
		const bottom = sorted[k + 1]!;
		while (ia < a.bands.length && a.bands[ia]!.bottom <= top) {
			ia++;
		}
		while (ib < b.bands.length && b.bands[ib]!.bottom <= top) {
			ib++;
		}
		const xa = ia < a.bands.length && a.bands[ia]!.top <= top ? a.bands[ia]!.xs : [];
		const xb = ib < b.bands.length && b.bands[ib]!.top <= top ? b.bands[ib]!.xs : [];
		bands.push({ top, bottom, xs: combineXs(xa, xb, op) });
	}
	return new Region().set(bands);
}

export const sect = (a: Region, b: Region): Region => combine(a, b, (x, y) => x && y);
export const union = (a: Region, b: Region): Region => combine(a, b, (x, y) => x || y);
export const diff = (a: Region, b: Region): Region => combine(a, b, (x, y) => x && !y);
export const xor = (a: Region, b: Region): Region => combine(a, b, (x, y) => x !== y);

export function offsetRegion(rgn: Region, dh: number, dv: number): void {
	for (const b of rgn.bands) {
		b.top += dv;
		b.bottom += dv;
		b.xs = b.xs.map((x) => x + dh);
	}
	if (rgn.bands.length > 0) {
		const r = rgn.rgnBBox;
		rgn.rgnBBox = { top: r.top + dv, left: r.left + dh, bottom: r.bottom + dv, right: r.right + dh };
	}
}

/** Moves the boundary inward by dh and dv (outward for negative values). */
export function insetRegion(rgn: Region, dh: number, dv: number): Region {
	const bands: Band[] = rgn.bands.map((b) => {
		const xs: number[] = [];
		for (let i = 0; i < b.xs.length; i += 2) {
			const l = b.xs[i]! + dh;
			const r = b.xs[i + 1]! - dh;
			if (l < r) {
				if (xs.length > 0 && xs.at(-1)! >= l) {
					xs[xs.length - 1] = Math.max(xs.at(-1)!, r);
				} else {
					xs.push(l, r);
				}
			}
		}
		return { top: b.top, bottom: b.bottom, xs };
	});
	let out = new Region().set(bands);
	if (dv !== 0) {
		const base = out;
		for (let k = 1; k <= Math.abs(dv); k++) {
			const up = new Region();
			copyRegion(base, up);
			offsetRegion(up, 0, -k);
			const down = new Region();
			copyRegion(base, down);
			offsetRegion(down, 0, k);
			out = dv > 0 ? sect(sect(out, up), down) : union(union(out, up), down);
		}
	}
	return out;
}

export function ptInRegion(pt: Point, rgn: Region): boolean {
	for (const b of rgn.bands) {
		if (pt.v >= b.top && pt.v < b.bottom) {
			let inside = false;
			for (const x of b.xs) {
				if (pt.h < x) {
					break;
				}
				inside = !inside;
			}
			return inside;
		}
	}
	return false;
}

export function equalRegions(a: Region, b: Region): boolean {
	return a.bands.length === b.bands.length && a.bands.every((x, i) => x.top === b.bands[i]!.top && x.bottom === b.bands[i]!.bottom && sameXs(x.xs, b.bands[i]!.xs));
}
