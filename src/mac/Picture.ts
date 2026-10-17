// Port: QuickDraw pictures: DrawPicture plays back version 1 and version 2 pictures
// (Inside Macintosh: Imaging With QuickDraw, Appendix A).

import { s16, u16, u32 } from './Binary.ts';
import { DisposPtr, NewPtrClear, bytesAt } from './Memory.ts';
import * as QD from './QuickDraw.ts';
import { fromBytes, sect, type Region } from './Region.ts';
import type { Point, Rect } from './Types.ts';

/** A PicHandle: the picture's bytes, beginning with picSize and picFrame. */
export interface Picture {
	data: Uint8Array;
}

export function picFrame(pic: Picture): Rect {
	const d = pic.data;
	return { top: s16(d, 2), left: s16(d, 4), bottom: s16(d, 6), right: s16(d, 8) };
}

class Reader {
	private d: Uint8Array;
	p: number;
	constructor(d: Uint8Array, p: number) {
		this.d = d;
		this.p = p;
	}
	u8(): number {
		return this.d[this.p++]!;
	}
	s8(): number {
		return (this.u8() << 24) >> 24;
	}
	u16(): number {
		const v = u16(this.d, this.p);
		this.p += 2;
		return v;
	}
	s16(): number {
		const v = s16(this.d, this.p);
		this.p += 2;
		return v;
	}
	u32(): number {
		const v = u32(this.d, this.p);
		this.p += 4;
		return v;
	}
	point(): Point {
		const v = this.s16();
		const h = this.s16();
		return { v, h };
	}
	rect(): Rect {
		const top = this.s16();
		const left = this.s16();
		const bottom = this.s16();
		const right = this.s16();
		return { top, left, bottom, right };
	}
	bytes(n: number): Uint8Array {
		const b = this.d.subarray(this.p, this.p + n);
		this.p += n;
		return b;
	}
	pattern(): number[] {
		return [...this.bytes(8)];
	}
	region(): Region {
		const { rgn, size } = fromBytes(this.d, this.p);
		this.p += size;
		return rgn;
	}
}

/** Expands PackBits data into `out`. */
export function unpackBits(src: Uint8Array, out: Uint8Array): void {
	let i = 0;
	let o = 0;
	while (o < out.length && i < src.length) {
		const n = (src[i++]! << 24) >> 24;
		if (n >= 0) {
			out.set(src.subarray(i, i + n + 1), o);
			i += n + 1;
			o += n + 1;
		} else if (n !== -128) {
			out.fill(src[i++]!, o, o + 1 - n);
			o += 1 - n;
		}
	}
}

/** Port state that DrawPicture saves and restores. */
function savePortState(port: QD.GrafPort) {
	return {
		...(QD.isColorPort(port) ? { rgbFgColor: { ...port.rgbFgColor }, rgbBkColor: { ...port.rgbBkColor } } : {}),
		pnLoc: { ...port.pnLoc },
		pnSize: { ...port.pnSize },
		pnMode: port.pnMode,
		pnPat: port.pnPat,
		fillPat: port.fillPat,
		bkPat: port.bkPat,
		txFont: port.txFont,
		txFace: port.txFace,
		txMode: port.txMode,
		txSize: port.txSize,
		spExtra: port.spExtra,
		fgColor: port.fgColor,
		bkColor: port.bkColor,
		clipRgn: port.clipRgn,
		pnVis: port.pnVis,
	};
}

export function DrawPicture(pic: Picture | null, dstRect: Rect): void {
	if (pic === null) {
		return;
	}
	const frame = picFrame(pic);
	if (QD.EmptyRect(dstRect) || QD.EmptyRect(frame)) {
		return;
	}
	if (frame.right - frame.left !== dstRect.right - dstRect.left || frame.bottom - frame.top !== dstRect.bottom - dstRect.top) {
		throw new Error('DrawPicture: scaling is not implemented');
	}
	const dh = dstRect.left - frame.left;
	const dv = dstRect.top - frame.top;
	const mapPt = (p: Point): Point => ({ h: p.h + dh, v: p.v + dv });
	const mapRect = (r: Rect): Rect => ({ top: r.top + dv, left: r.left + dh, bottom: r.bottom + dv, right: r.right + dh });
	const mapRgn = (r: Region): Region => {
		QD.OffsetRgn(r, dh, dv);
		return r;
	};

	const port = QD.thePort;
	const saved = savePortState(port);
	const portClip = port.clipRgn;
	// Port: the original draws nothing until the picture sets a clip region (seen in the oracle).
	port.clipRgn = new (QD.Region)();
	port.pnLoc = { h: dstRect.left, v: dstRect.top };
	QD.PenNormal();
	port.fillPat = QD.black;
	port.bkPat = QD.white;
	port.txFont = 0;
	port.txFace = 0;
	port.txMode = QD.srcOr;
	port.txSize = 0;
	port.spExtra = 0;
	QD.ForeColor(QD.blackColor);
	QD.BackColor(QD.whiteColor);

	const r = new Reader(pic.data, 10);
	let version = 1;
	let lastRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	let lastRgn: Region | null = null;
	let ovSize: Point = { h: 0, v: 0 };
	/** Where the last text was drawn, which DHText and the like are relative to. */
	let textLoc: Point = { h: 0, v: 0 };
	const drawText = (at: Point, text: Uint8Array) => {
		QD.MoveTo(at.h, at.v);
		QD.StdText(text);
	};
	const shape = (kind: number, verb: QD.GrafVerb) => {
		switch (kind) {
			case 0x30:
				lastRect = r.rect();
				QD.StdRect(verb, mapRect(lastRect));
				return;
			case 0x38:
				QD.StdRect(verb, mapRect(lastRect));
				return;
			case 0x40:
				lastRect = r.rect();
				QD.StdRRect(verb, mapRect(lastRect), ovSize.h, ovSize.v);
				return;
			case 0x48:
				QD.StdRRect(verb, mapRect(lastRect), ovSize.h, ovSize.v);
				return;
			case 0x70: {
				const size = r.u16();
				const bbox = r.rect();
				const pts: Point[] = [];
				for (let k = 0; k < (size - 10) / 4; k++) {
					pts.push(mapPt(r.point()));
				}
				QD.StdPoly(verb, { polyBBox: mapRect(bbox), polyPoints: pts });
				return;
			}
			case 0x50:
				lastRect = r.rect();
				QD.StdOval(verb, mapRect(lastRect));
				return;
			case 0x58:
				QD.StdOval(verb, mapRect(lastRect));
				return;
			case 0x80:
				lastRgn = r.region();
				QD.StdRgn(verb, mapRgn(lastRgn));
				return;
			default:
				throw new Error(`DrawPicture: shape opcode $${(kind + verb).toString(16)} is not implemented`);
		}
	};
	try {
		for (;;) {
			if (version === 2 && r.p & 1) {
				r.p++;
			}
			const op = version === 1 ? r.u8() : r.u16();
			if (op === 0xff) {
				break;
			}
			if (op >= 0x30 && op <= 0x8f && (op & 7) <= 4) {
				shape(op & 0xf8, (op & 7) as QD.GrafVerb);
				continue;
			}
			switch (op) {
				case 0x00:
					break;
				case 0x01: {
					const clip = mapRgn(r.region());
					port.clipRgn = sect(clip, portClip);
					break;
				}
				case 0x02:
					port.bkPat = r.pattern();
					break;
				case 0x03:
					port.txFont = r.s16();
					break;
				case 0x04:
					port.txFace = r.u8();
					break;
				case 0x05:
					port.txMode = r.s16();
					break;
				case 0x06:
					port.spExtra = r.u32() | 0;
					break;
				case 0x07: {
					const p = r.point();
					port.pnSize = { h: p.h, v: p.v };
					break;
				}
				case 0x08:
					port.pnMode = r.s16();
					break;
				case 0x09:
					port.pnPat = r.pattern();
					break;
				case 0x0a:
					port.fillPat = r.pattern();
					break;
				case 0x0b:
					ovSize = r.point();
					break;
				case 0x0d:
					port.txSize = r.s16();
					break;
				case 0x0e:
					port.fgColor = r.u32() | 0;
					break;
				case 0x0f:
					port.bkColor = r.u32() | 0;
					break;
				case 0x11:
					version = version === 1 && r.u8() === 2 ? 2 : version;
					if (version === 2) {
						r.u8();
					}
					break;
				case 0x0c00:
					r.bytes(24);
					break;
				case 0x12:
				case 0x13:
				case 0x14: {
					const pp = readPixPat(r);
					if (op === 0x13) {
						QD.PenPixPat(pp);
					} else if (op === 0x12) {
						port.bkPat = pp.pat1Data;
					} else {
						port.fillPat = pp.pat1Data;
					}
					break;
				}
				case 0x15:
				case 0x16:
					r.u16();
					break;
				case 0x1a: {
					const c = { red: r.u16(), green: r.u16(), blue: r.u16() };
					QD.RGBForeColor(c);
					break;
				}
				case 0x1b: {
					const c = { red: r.u16(), green: r.u16(), blue: r.u16() };
					QD.RGBBackColor(c);
					break;
				}
				case 0x1d:
				case 0x1f:
					r.bytes(6);
					break;
				case 0x1e:
					break;
				case 0x28: {
					textLoc = r.point();
					drawText(mapPt(textLoc), r.bytes(r.u8()));
					break;
				}
				case 0x29: {
					textLoc = { h: textLoc.h + r.u8(), v: textLoc.v };
					drawText(mapPt(textLoc), r.bytes(r.u8()));
					break;
				}
				case 0x2a: {
					textLoc = { h: textLoc.h, v: textLoc.v + r.u8() };
					drawText(mapPt(textLoc), r.bytes(r.u8()));
					break;
				}
				case 0x2b: {
					const dh = r.u8();
					const dv = r.u8();
					textLoc = { h: textLoc.h + dh, v: textLoc.v + dv };
					drawText(mapPt(textLoc), r.bytes(r.u8()));
					break;
				}
				case 0x20: {
					const a = mapPt(r.point());
					const b = mapPt(r.point());
					QD.MoveTo(a.h, a.v);
					QD.LineTo(b.h, b.v);
					break;
				}
				case 0x21: {
					const b = mapPt(r.point());
					QD.LineTo(b.h, b.v);
					break;
				}
				case 0x22: {
					const a = mapPt(r.point());
					const dh = r.s8();
					const dv = r.s8();
					QD.MoveTo(a.h, a.v);
					QD.Line(dh, dv);
					break;
				}
				case 0x23: {
					const dh = r.s8();
					const dv = r.s8();
					QD.Line(dh, dv);
					break;
				}
				case 0x90:
				case 0x91:
				case 0x98:
				case 0x99:
					bits(r, op, mapRect, mapRgn);
					break;
				case 0xa0:
					r.u16();
					break;
				case 0xa1: {
					r.u16();
					r.bytes(r.u16());
					break;
				}
				default:
					throw new Error(`DrawPicture: opcode $${op.toString(16)} is not implemented`);
			}
		}
	} finally {
		Object.assign(port, saved);
	}
}

/** A pixel map's fields after its bounds, and its color table, in a picture. */
function readPixMap(r: Reader, rowBytes: number, bounds: Rect, baseAddr: number): QD.PixMap {
	const pm = QD.newPixMap();
	pm.baseAddr = baseAddr;
	pm.rowBytes = rowBytes | 0x8000;
	pm.bounds = bounds;
	pm.pmVersion = r.s16();
	pm.packType = r.s16();
	pm.packSize = r.u32();
	pm.hRes = r.u32();
	pm.vRes = r.u32();
	pm.pixelType = r.s16();
	pm.pixelSize = r.s16();
	pm.cmpCount = r.s16();
	pm.cmpSize = r.s16();
	pm.planeBytes = r.u32();
	r.u32(); // pmTable
	pm.pmReserved = r.u32();
	const ctSeed = r.u32();
	const ctFlags = r.u16();
	const ctSize = r.s16();
	const ctTable = [];
	for (let i = 0; i <= ctSize; i++) {
		ctTable.push({ value: r.s16(), rgb: { red: r.u16(), green: r.u16(), blue: r.u16() } });
	}
	pm.pmTable = { ctSeed, ctFlags, ctSize, ctTable };
	return pm;
}

/** A pixel pattern in a picture: its type, old-style pattern, and for type 1 a pixel map and pixels. */
function readPixPat(r: Reader): QD.PixPat {
	const patType = r.u16();
	const pat1Data = r.pattern();
	if (patType !== 1) {
		return { patType, patMap: QD.newPixMap(), patData: new Uint8Array(0), pat1Data };
	}
	const rowBytesWord = r.u16();
	const rowBytes = rowBytesWord & 0x3fff;
	const bounds = r.rect();
	const pm = readPixMap(r, rowBytes, bounds, 0);
	const height = bounds.bottom - bounds.top;
	const patData = new Uint8Array(rowBytes * height);
	for (let y = 0; y < height; y++) {
		const row = patData.subarray(y * rowBytes, (y + 1) * rowBytes);
		if (rowBytes < 8) {
			row.set(r.bytes(rowBytes));
		} else {
			unpackBits(r.bytes(rowBytes > 250 ? r.u16() : r.u8()), row);
		}
	}
	return { patType, patMap: pm, patData, pat1Data };
}

/** BitsRect, BitsRgn, PackBitsRect, PackBitsRgn, with bitmaps or pixel maps. */
function bits(r: Reader, op: number, mapRect: (r: Rect) => Rect, mapRgn: (r: Region) => Region): void {
	const rowBytesWord = r.u16();
	const isPixMap = (rowBytesWord & 0x8000) !== 0;
	const rowBytes = rowBytesWord & 0x3fff;
	const bounds = r.rect();
	const pixMap = isPixMap ? readPixMap(r, rowBytes, bounds, 0) : null;
	const srcRect = r.rect();
	const dstRect = mapRect(r.rect());
	const mode = r.s16();
	const maskRgn = op === 0x91 || op === 0x99 ? mapRgn(r.region()) : null;
	const height = bounds.bottom - bounds.top;
	const ptr = NewPtrClear(rowBytes * height);
	try {
		const pixels = bytesAt(ptr, rowBytes * height);
		const packed = (op === 0x98 || op === 0x99) && rowBytes >= 8;
		for (let y = 0; y < height; y++) {
			const row = pixels.subarray(y * rowBytes, (y + 1) * rowBytes);
			if (packed) {
				const n = rowBytes > 250 ? r.u16() : r.u8();
				unpackBits(r.bytes(n), row);
			} else {
				row.set(r.bytes(rowBytes));
			}
		}
		const src: QD.BitMap = pixMap === null ? { baseAddr: ptr, rowBytes, bounds } : { ...pixMap, baseAddr: ptr };
		QD.CopyBits(src, QD.thePort.portBits, srcRect, dstRect, mode, maskRgn);
	} finally {
		DisposPtr(ptr);
	}
}
