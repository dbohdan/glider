// Port: QuickDraw (Inside Macintosh I and V), as Glider and the Room Editor use it.
//
// Bitmaps and pixel maps live in the flat address space of Memory.ts with the Mac's layout (rowBytes,
// packed pixels, 1 = black in bitmaps), so offscreen buffers and screens behave as on a Mac.
// Shapes become regions, regions are clipped, and the clipped region is filled with a pattern in a
// transfer mode: the same pipeline as QuickDraw's, which decides which pixels a shape covers.

import { type FontStrike, fontStrike, glyphOf } from './Fonts.ts';
import { encodeMacRoman } from './MacRoman.ts';
import { resolve, type Ptr } from './Memory.ts';
import {
	type Band,
	addInversionPoint,
	combine,
	copyRegion,
	diff,
	equalRegions,
	fromInversionPoints,
	insetRegion,
	offsetRegion,
	ptInRegion,
	rectRegion,
	Region,
	sect,
	union,
	xor,
} from './Region.ts';
import type { Integer, LongInt, Point, Rect } from './Types.ts';

// ---------------------------------------------------------------------------------------------
// Types

/** Pascal `Pattern`: eight rows of eight pixels, most significant bit leftmost. */
export type Pattern = readonly number[];

export interface BitMap {
	baseAddr: Ptr;
	rowBytes: Integer;
	bounds: Rect;
}

export interface RGBColor {
	red: number;
	green: number;
	blue: number;
}

export interface ColorSpec {
	value: Integer;
	rgb: RGBColor;
}

export interface ColorTable {
	ctSeed: LongInt;
	ctFlags: Integer;
	ctSize: Integer;
	ctTable: ColorSpec[];
}

export interface PixMap extends BitMap {
	pmVersion: Integer;
	packType: Integer;
	packSize: LongInt;
	hRes: LongInt;
	vRes: LongInt;
	pixelType: Integer;
	pixelSize: Integer;
	cmpCount: Integer;
	cmpSize: Integer;
	planeBytes: LongInt;
	pmTable: ColorTable;
	pmReserved: LongInt;
}

export function isPixMap(bm: BitMap): bm is PixMap {
	return 'pixelSize' in bm;
}

export type GrafVerb = 0 | 1 | 2 | 3 | 4;
export const frame: GrafVerb = 0;
export const paint: GrafVerb = 1;
export const erase: GrafVerb = 2;
export const invert: GrafVerb = 3;
export const fill: GrafVerb = 4;

// Transfer modes.
export const srcCopy = 0;
export const srcOr = 1;
export const srcXor = 2;
export const srcBic = 3;
export const notSrcCopy = 4;
export const notSrcOr = 5;
export const notSrcXor = 6;
export const notSrcBic = 7;
export const patCopy = 8;
export const patOr = 9;
export const patXor = 10;
export const patBic = 11;
export const notPatCopy = 12;
export const notPatOr = 13;
export const notPatXor = 14;
export const notPatBic = 15;
export const blend = 32;
export const addPin = 33;
export const addOver = 34;
export const subPin = 35;
export const transparent = 36;
export const adMax = 37;
export const subOver = 38;
export const adMin = 39;

// Old-style colors.
export const blackColor = 33;
export const whiteColor = 30;
export const redColor = 205;
export const greenColor = 341;
export const blueColor = 409;
export const cyanColor = 273;
export const magentaColor = 137;
export const yellowColor = 69;

export class GrafPort {
	device: Integer = 0;
	portBits: BitMap = { baseAddr: 0, rowBytes: 0, bounds: { top: 0, left: 0, bottom: 0, right: 0 } };
	portRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	visRgn = new Region();
	clipRgn = new Region();
	bkPat: Pattern = white;
	fillPat: Pattern = black;
	pnLoc: Point = { v: 0, h: 0 };
	pnSize: Point = { v: 1, h: 1 };
	pnMode: Integer = patCopy;
	pnPat: Pattern = black;
	pnVis: Integer = 0;
	txFont: Integer = 0;
	txFace: Integer = 0;
	txMode: Integer = srcOr;
	txSize: Integer = 0;
	spExtra: LongInt = 0;
	fgColor: LongInt = blackColor;
	bkColor: LongInt = whiteColor;
	colrBit: Integer = 0;
	patStretch: Integer = 0;
	/** Port: the region being recorded by OpenRgn, as inversion points by scan line. */
	rgnSave: Map<number, number[]> | null = null;
}

// ---------------------------------------------------------------------------------------------
// Globals

export const white: Pattern = [0, 0, 0, 0, 0, 0, 0, 0];
export const black: Pattern = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
export const gray: Pattern = [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55];
export const ltGray: Pattern = [0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22];
export const dkGray: Pattern = [0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd];

export const screenBits: BitMap = { baseAddr: 0, rowBytes: 0, bounds: { top: 0, left: 0, bottom: 0, right: 0 } };
export let thePort: GrafPort = new GrafPort();
export let randSeed: LongInt = 1;

/** Sets up QuickDraw for a screen: its memory, row width, and size. */
export function InitGraf(screen: BitMap): void {
	screenBits.baseAddr = screen.baseAddr;
	screenBits.rowBytes = screen.rowBytes;
	screenBits.bounds = { ...screen.bounds };
	randSeed = 1;
	thePort = new GrafPort();
}

// ---------------------------------------------------------------------------------------------
// Points and rectangles

export function SetPt(pt: Point, h: Integer, v: Integer): void {
	pt.h = h;
	pt.v = v;
}

export function EqualPt(a: Point, b: Point): boolean {
	return a.h === b.h && a.v === b.v;
}

export function AddPt(src: Point, dst: Point): void {
	dst.h += src.h;
	dst.v += src.v;
}

export function SubPt(src: Point, dst: Point): void {
	dst.h -= src.h;
	dst.v -= src.v;
}

export function SetRect(r: Rect, left: Integer, top: Integer, right: Integer, bottom: Integer): void {
	r.left = left;
	r.top = top;
	r.right = right;
	r.bottom = bottom;
}

export function OffsetRect(r: Rect, dh: Integer, dv: Integer): void {
	r.left += dh;
	r.right += dh;
	r.top += dv;
	r.bottom += dv;
}

export function EmptyRect(r: Rect): boolean {
	return r.bottom <= r.top || r.right <= r.left;
}

/** Insets a rectangle; a rectangle left with no area becomes (0, 0, 0, 0). */
export function InsetRect(r: Rect, dh: Integer, dv: Integer): void {
	r.left += dh;
	r.right -= dh;
	r.top += dv;
	r.bottom -= dv;
	if (EmptyRect(r)) {
		SetRect(r, 0, 0, 0, 0);
	}
}

export function SectRect(a: Rect, b: Rect, dst: Rect): boolean {
	const top = Math.max(a.top, b.top);
	const left = Math.max(a.left, b.left);
	const bottom = Math.min(a.bottom, b.bottom);
	const right = Math.min(a.right, b.right);
	if (bottom <= top || right <= left) {
		SetRect(dst, 0, 0, 0, 0);
		return false;
	}
	SetRect(dst, left, top, right, bottom);
	return true;
}

export function UnionRect(a: Rect, b: Rect, dst: Rect): void {
	SetRect(dst, Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right), Math.max(a.bottom, b.bottom));
}

export function PtInRect(pt: Point, r: Rect): boolean {
	return pt.h >= r.left && pt.h < r.right && pt.v >= r.top && pt.v < r.bottom;
}

export function EqualRect(a: Rect, b: Rect): boolean {
	return a.top === b.top && a.left === b.left && a.bottom === b.bottom && a.right === b.right;
}

export function Pt2Rect(a: Point, b: Point, dst: Rect): void {
	SetRect(dst, Math.min(a.h, b.h), Math.min(a.v, b.v), Math.max(a.h, b.h), Math.max(a.v, b.v));
}

// ---------------------------------------------------------------------------------------------
// Ports

export function InitPort(port: GrafPort): void {
	port.device = 0;
	port.portBits = { baseAddr: screenBits.baseAddr, rowBytes: screenBits.rowBytes, bounds: { ...screenBits.bounds } };
	port.portRect = { ...screenBits.bounds };
	port.visRgn = rectRegion(screenBits.bounds);
	port.clipRgn = rectRegion({ top: -32767, left: -32767, bottom: 32767, right: 32767 });
	port.bkPat = white;
	port.fillPat = black;
	port.pnLoc = { v: 0, h: 0 };
	port.pnSize = { v: 1, h: 1 };
	port.pnMode = patCopy;
	port.pnPat = black;
	port.pnVis = 0;
	port.txFont = 0;
	port.txFace = 0;
	port.txMode = srcOr;
	port.txSize = 0;
	port.spExtra = 0;
	port.fgColor = blackColor;
	port.bkColor = whiteColor;
	port.colrBit = 0;
	port.patStretch = 0;
	port.rgnSave = null;
	thePort = port;
}

export function OpenPort(port: GrafPort): void {
	InitPort(port);
}

export function ClosePort(port: GrafPort): void {
	port.visRgn = new Region();
	port.clipRgn = new Region();
}

export function SetPort(port: GrafPort): void {
	thePort = port;
}

/** Pascal `GetPort(var port)`: returns the current port. */
export function GetPort(): GrafPort {
	return thePort;
}

export function SetPortBits(bm: BitMap): void {
	thePort.portBits = bm;
}

export function PortSize(width: Integer, height: Integer): void {
	thePort.portRect.right = thePort.portRect.left + width;
	thePort.portRect.bottom = thePort.portRect.top + height;
}

export function SetOrigin(h: Integer, v: Integer): void {
	const dh = h - thePort.portRect.left;
	const dv = v - thePort.portRect.top;
	OffsetRect(thePort.portRect, dh, dv);
	OffsetRect(thePort.portBits.bounds, dh, dv);
	offsetRegion(thePort.visRgn, dh, dv);
}

export function SetClip(rgn: Region): void {
	copyRegion(rgn, thePort.clipRgn);
}

export function GetClip(rgn: Region): void {
	copyRegion(thePort.clipRgn, rgn);
}

export function ClipRect(r: Rect): void {
	thePort.clipRgn = rectRegion(r);
}

export function BackPat(pat: Pattern): void {
	thePort.bkPat = [...pat];
}

export function LocalToGlobal(pt: Point): void {
	pt.h -= thePort.portBits.bounds.left;
	pt.v -= thePort.portBits.bounds.top;
}

export function GlobalToLocal(pt: Point): void {
	pt.h += thePort.portBits.bounds.left;
	pt.v += thePort.portBits.bounds.top;
}

// ---------------------------------------------------------------------------------------------
// The pen

export function HidePen(): void {
	thePort.pnVis--;
}

export function ShowPen(): void {
	thePort.pnVis++;
}

/** Pascal `GetPen(var pt)`. */
export function GetPen(pt: Point): void {
	pt.h = thePort.pnLoc.h;
	pt.v = thePort.pnLoc.v;
}

export function PenSize(width: Integer, height: Integer): void {
	thePort.pnSize = { h: width, v: height };
}

export function PenMode(mode: Integer): void {
	thePort.pnMode = mode;
}

export function PenPat(pat: Pattern): void {
	thePort.pnPat = [...pat];
}

export function PenNormal(): void {
	thePort.pnSize = { h: 1, v: 1 };
	thePort.pnMode = patCopy;
	thePort.pnPat = black;
}

export function MoveTo(h: Integer, v: Integer): void {
	thePort.pnLoc = { h, v };
}

export function Move(dh: Integer, dv: Integer): void {
	thePort.pnLoc = { h: thePort.pnLoc.h + dh, v: thePort.pnLoc.v + dv };
}

// ---------------------------------------------------------------------------------------------
// Regions

/** Pascal `NewRgn`. A RgnHandle is a Region. */
export function NewRgn(): Region {
	return new Region();
}

export function DisposeRgn(_rgn: Region): void {}

export function CopyRgn(src: Region, dst: Region): void {
	copyRegion(src, dst);
}

export function SetEmptyRgn(rgn: Region): void {
	rgn.set([]);
}

export function SetRectRgn(rgn: Region, left: Integer, top: Integer, right: Integer, bottom: Integer): void {
	copyRegion(rectRegion({ top, left, bottom, right }), rgn);
}

export function RectRgn(rgn: Region, r: Rect): void {
	copyRegion(rectRegion(r), rgn);
}

export function OpenRgn(): void {
	thePort.rgnSave = new Map();
	HidePen();
}

export function CloseRgn(dst: Region): void {
	if (thePort.rgnSave !== null) {
		copyRegion(fromInversionPoints(thePort.rgnSave), dst);
		thePort.rgnSave = null;
		ShowPen();
	}
}

export function OffsetRgn(rgn: Region, dh: Integer, dv: Integer): void {
	offsetRegion(rgn, dh, dv);
}

export function InsetRgn(rgn: Region, dh: Integer, dv: Integer): void {
	copyRegion(insetRegion(rgn, dh, dv), rgn);
}

export function SectRgn(a: Region, b: Region, dst: Region): void {
	copyRegion(sect(a, b), dst);
}

export function UnionRgn(a: Region, b: Region, dst: Region): void {
	copyRegion(union(a, b), dst);
}

export function DiffRgn(a: Region, b: Region, dst: Region): void {
	copyRegion(diff(a, b), dst);
}

export function XorRgn(a: Region, b: Region, dst: Region): void {
	copyRegion(xor(a, b), dst);
}

export function PtInRgn(pt: Point, rgn: Region): boolean {
	return ptInRegion(pt, rgn);
}

export function EqualRgn(a: Region, b: Region): boolean {
	return equalRegions(a, b);
}

export function EmptyRgn(rgn: Region): boolean {
	return rgn.bands.length === 0;
}

/** Adds a region's outline to the region being recorded. */
function recordRegion(rgn: Region): void {
	if (thePort.rgnSave === null) {
		return;
	}
	for (const b of rgn.bands) {
		for (const x of b.xs) {
			addInversionPoint(thePort.rgnSave, x, b.top);
			addInversionPoint(thePort.rgnSave, x, b.bottom);
		}
	}
}

// ---------------------------------------------------------------------------------------------
// Pixels

/** Where a bitmap's pixels are and how they are laid out. */
interface Surface {
	bytes: Uint8Array;
	/** Offset of the first byte of the bitmap. */
	base: number;
	rowBytes: number;
	depth: number;
	bounds: Rect;
}

function surfaceOf(bm: BitMap): Surface {
	const depth = isPixMap(bm) ? bm.pixelSize : 1;
	const rowBytes = bm.rowBytes & 0x3fff;
	const height = bm.bounds.bottom - bm.bounds.top;
	const { bytes, offset } = resolve(bm.baseAddr, Math.max(1, rowBytes * height));
	return { bytes, base: offset, rowBytes, depth, bounds: bm.bounds };
}

/** Reads a pixel at bitmap coordinates (h, v). */
export function getPixel(s: Surface, h: number, v: number): number {
	const x = h - s.bounds.left;
	const i = s.base + (v - s.bounds.top) * s.rowBytes;
	switch (s.depth) {
		case 1:
			return (s.bytes[i + (x >> 3)]! >> (7 - (x & 7))) & 1;
		case 2:
			return (s.bytes[i + (x >> 2)]! >> (6 - 2 * (x & 3))) & 3;
		case 4:
			return (s.bytes[i + (x >> 1)]! >> (x & 1 ? 0 : 4)) & 15;
		default:
			return s.bytes[i + x]!;
	}
}

export function setPixel(s: Surface, h: number, v: number, value: number): void {
	const x = h - s.bounds.left;
	const i = s.base + (v - s.bounds.top) * s.rowBytes;
	switch (s.depth) {
		case 1: {
			const bit = 0x80 >> (x & 7);
			const j = i + (x >> 3);
			s.bytes[j] = value & 1 ? s.bytes[j]! | bit : s.bytes[j]! & ~bit;
			return;
		}
		case 2: {
			const shift = 6 - 2 * (x & 3);
			const j = i + (x >> 2);
			s.bytes[j] = (s.bytes[j]! & ~(3 << shift)) | ((value & 3) << shift);
			return;
		}
		case 4: {
			const shift = x & 1 ? 0 : 4;
			const j = i + (x >> 1);
			s.bytes[j] = (s.bytes[j]! & ~(15 << shift)) | ((value & 15) << shift);
			return;
		}
		default:
			s.bytes[i + x] = value;
	}
}

/** The part of a region the current port can draw: inside its bitmap, visRgn, and clipRgn. */
function clipToPort(rgn: Region): Region {
	const port = thePort;
	return sect(sect(sect(rgn, rectRegion(port.portBits.bounds)), port.visRgn), port.clipRgn);
}

/**
 * Fills a clipped region with a pattern in a pattern transfer mode. Patterns are aligned with the
 * bitmap: pattern row 0 is at bounds.top, and every eighth row after it.
 */
function fillRegion(rgn: Region, pat: Pattern, mode: number): void {
	const port = thePort;
	const s = surfaceOf(port.portBits);
	const op = mode & 3;
	const notPat = (mode & 4) !== 0;
	const ones = (1 << s.depth) - 1;
	// Black and white: pattern 1 bits are black (all ones), 0 bits white.
	const fg = ones;
	const bk = 0;
	for (const band of rgn.bands) {
		for (let v = band.top; v < band.bottom; v++) {
			const row = pat[(v - s.bounds.top) & 7]!;
			for (let k = 0; k < band.xs.length; k += 2) {
				for (let h = band.xs[k]!; h < band.xs[k + 1]!; h++) {
					let p = (row >> (7 - ((h - s.bounds.left) & 7))) & 1;
					if (notPat) {
						p ^= 1;
					}
					switch (op) {
						case 0:
							setPixel(s, h, v, p ? fg : bk);
							break;
						case 1:
							if (p) {
								setPixel(s, h, v, fg);
							}
							break;
						case 2:
							if (p) {
								setPixel(s, h, v, getPixel(s, h, v) ^ ones);
							}
							break;
						case 3:
							if (p) {
								setPixel(s, h, v, bk);
							}
							break;
					}
				}
			}
		}
	}
}

/** Draws a shape's region with a verb, as StdRgn does after the shape has become a region. */
function drawShape(verb: GrafVerb, shape: Region, frameRgn?: () => Region): void {
	const port = thePort;
	if (port.pnVis < 0) {
		return;
	}
	switch (verb) {
		case frame:
		case paint: {
			const pen = penTransfer(port);
			if (pen !== null) {
				fillRegion(clipToPort(verb === frame ? frameRgn!() : shape), pen.pat, pen.mode);
			}
			break;
		}
		case erase:
			fillRegion(clipToPort(shape), port.bkPat, patCopy);
			break;
		case invert:
			fillRegion(clipToPort(shape), black, patXor);
			break;
		case fill:
			fillRegion(clipToPort(shape), port.fillPat, patCopy);
			break;
	}
}

/**
 * The pattern and pattern mode that shapes are drawn with in the pen's mode, or null to draw nothing.
 * Port: source modes (0 to 7) as pen modes ignore the pen pattern and act like pattern mode 14 - mode
 * with a black pattern, so that srcCopy and srcOr leave the destination alone, srcXor and srcBic
 * erase, notSrcCopy inverts, and notSrcOr and notSrcXor paint black. This is what the Mac Plus ROM
 * does (seen in the oracle); Glider sets source pen modes only before drawing lines and text.
 */
function penTransfer(port: GrafPort): { pat: Pattern; mode: number } | null {
	const mode = port.pnMode;
	if (mode >= 8) {
		return { pat: port.pnPat, mode };
	}
	return mode === 7 ? null : { pat: black, mode: 14 - mode };
}

// ---------------------------------------------------------------------------------------------
// Lines

/**
 * The pixels of a one-pixel line, as runs along its major axis.
 * Port: QuickDraw's line rule, worked out from the ROM's drawing in the oracle. Lines are taken from
 * top to bottom. Along the major axis, the minor coordinate steps where the line crosses the middle
 * between pixels: after (k + 1/2) * major / minor pixels for the k-th step. That distance is a 16.16
 * fixed-point number, truncated for shallow lines and rounded up for steep ones and diagonals, and a
 * pixel exactly at a step is counted before it, except on shallow lines going left.
 */
function lineRuns(x1: number, y1: number, x2: number, y2: number): Rect[] {
	if (y1 > y2) {
		[x1, y1, x2, y2] = [x2, y2, x1, y1];
	}
	const dx = Math.abs(x2 - x1);
	const dy = y2 - y1;
	const sx = x2 < x1 ? -1 : 1;
	if (dx === 0 || dy === 0) {
		return [{ top: y1, left: Math.min(x1, x2), bottom: y2 + 1, right: Math.max(x1, x2) + 1 }];
	}
	const steep = dy >= dx;
	const major = steep ? dy : dx;
	const minor = steep ? dx : dy;
	const run = steep ? Math.ceil((major * 65536) / minor) : Math.floor((major * 65536) / minor);
	const strict = steep || sx > 0;
	/** How many steps come before the pixel u along the major axis. */
	const steps = (u: number): number => {
		// Steps k with (2k + 1) * run < (or <=) (2u + 1) * 65536.
		const x = ((2 * u + 1) * 65536 - run) / (2 * run);
		const n = strict ? Math.ceil(x) : Math.floor(x) + 1;
		return Math.max(0, Math.min(minor, n));
	};
	const runs: Rect[] = [];
	let start = 0;
	for (let u = 1; u <= major + 1; u++) {
		if (u === major + 1 || steps(u) !== steps(start)) {
			const k = steps(start);
			if (steep) {
				const h = x1 + sx * k;
				runs.push({ top: y1 + start, left: h, bottom: y1 + u, right: h + 1 });
			} else {
				const a = x1 + sx * start;
				const b = x1 + sx * (u - 1);
				runs.push({ top: y1 + k, left: Math.min(a, b), bottom: y1 + k + 1, right: Math.max(a, b) + 1 });
			}
			start = u;
		}
	}
	return runs;
}

/** The region a line covers with the current pen: each pixel of the one-pixel line spread over the pen's size. */
function lineRegion(from: Point, to: Point, pen: Point): Region {
	let rgn = new Region();
	for (const r of lineRuns(from.h, from.v, to.h, to.v)) {
		rgn = union(rgn, rectRegion({ top: r.top, left: r.left, bottom: r.bottom + pen.v - 1, right: r.right + pen.h - 1 }));
	}
	return rgn;
}

export function StdLine(newPt: Point): void {
	const port = thePort;
	const from = port.pnLoc;
	if (port.rgnSave !== null) {
		recordLine(port.rgnSave, from, newPt);
	}
	if (port.pnVis >= 0 && port.pnSize.h > 0 && port.pnSize.v > 0 && port.pnMode >= 8) {
		// Port: lines in source modes (0 to 7) draw nothing on the Mac Plus ROM (seen in the oracle).
		fillRegion(clipToPort(lineRegion(from, newPt, port.pnSize)), port.pnPat, port.pnMode);
	}
}

/**
 * Adds a line to the region being recorded, as an edge: on each scan line it crosses, the line
 * inverts everything to the right of a boundary, so that closed outlines enclose their inside.
 * Port: the boundary follows the pixels of the line as LineTo draws it, taken from top to bottom:
 * on a line going right it is the leftmost pixel of the next scan line, on a line going left the
 * leftmost pixel of the same scan line (seen in the oracle, filling polygons). Horizontal lines
 * add nothing.
 */
function recordLine(rows: Map<number, number[]>, from: Point, to: Point): void {
	if (from.v === to.v) {
		return;
	}
	const [a, b] = from.v < to.v ? [from, to] : [to, from];
	const leftmost = new Map<number, number>();
	for (const r of lineRuns(a.h, a.v, b.h, b.v)) {
		for (let v = r.top; v < r.bottom; v++) {
			leftmost.set(v, Math.min(leftmost.get(v) ?? Infinity, r.left));
		}
	}
	const rightward = b.h > a.h;
	let prev: number | undefined;
	for (let v = a.v; v < b.v; v++) {
		const x = leftmost.get(rightward ? v + 1 : v)!;
		if (prev !== undefined) {
			addInversionPoint(rows, prev, v);
		}
		addInversionPoint(rows, x, v);
		prev = x;
	}
	addInversionPoint(rows, prev!, b.v);
}

export function LineTo(h: Integer, v: Integer): void {
	StdLine({ h, v });
	thePort.pnLoc = { h, v };
}

export function Line(dh: Integer, dv: Integer): void {
	LineTo(thePort.pnLoc.h + dh, thePort.pnLoc.v + dv);
}

// ---------------------------------------------------------------------------------------------
// Rectangles

export function StdRect(verb: GrafVerb, r: Rect): void {
	if (EmptyRect(r)) {
		return;
	}
	const shape = rectRegion(r);
	if (verb === frame) {
		recordRegion(shape);
	}
	drawShape(verb, shape, () => {
		const inner = { ...r };
		InsetRect(inner, thePort.pnSize.h, thePort.pnSize.v);
		return diff(shape, rectRegion(inner));
	});
}

export function FrameRect(r: Rect): void {
	StdRect(frame, r);
}

export function PaintRect(r: Rect): void {
	StdRect(paint, r);
}

export function EraseRect(r: Rect): void {
	StdRect(erase, r);
}

export function InvertRect(r: Rect): void {
	StdRect(invert, r);
}

export function FillRect(r: Rect, pat: Pattern): void {
	thePort.fillPat = [...pat];
	StdRect(fill, r);
}

// ---------------------------------------------------------------------------------------------
// Ovals

/**
 * How far each row of an oval of width w and height h is inset from the left and right of its
 * rectangle. A row whose inset reaches the middle has edges that meet or cross: empty in an oval,
 * but not in a rounded rectangle, which pulls the edges apart.
 * Port: QuickDraw's oval rule as far as the oracle has pinned it down. In half-pixel units from the
 * center, the outermost pixel of a row is the one whose center (x, y) satisfies
 * x²h² <= w²(h² + 1 - y²), an ellipse slightly taller than the rectangle, with x of the parity that
 * puts it on a pixel center. Ovals one pixel wide or tall are rectangles; ovals two pixels tall lose
 * w div 15 pixels at each end. This matches the ROM for 98.8% of the rows of all ovals up to 70 by 57
 * and for every oval Glider draws. Known differences: the top row of short, wide ovals (3 to 5
 * pixels tall, 16 or more wide) and a row near each end of some tall, narrow ones (8 by 32) come out
 * a pixel wider than the ROM's.
 */
function ovalInsets(w: number, h: number): number[] {
	if (w <= 1 || h <= 1) {
		return Array.from({ length: Math.max(0, h) }, () => 0);
	}
	if (h === 2) {
		const d = Math.trunc(w / 15);
		return [d, d];
	}
	const insets: number[] = [];
	for (let i = 0; i < h; i++) {
		const y = 2 * i + 1 - h;
		const limit = w * w * (h * h + 1 - y * y);
		let x = Math.floor(Math.sqrt(limit) / h);
		while (x > 0 && x * x * h * h > limit) {
			x--;
		}
		while ((x + 1) * (x + 1) * h * h <= limit) {
			x++;
		}
		if ((x - (w - 1)) % 2 !== 0) {
			x--;
		}
		insets.push((w - 1 - x) / 2);
	}
	return insets;
}

/** The region of an oval inscribed in a rectangle. */
export function ovalRegion(r: Rect): Region {
	const bands: Band[] = [];
	ovalInsets(r.right - r.left, r.bottom - r.top).forEach((d, i) => {
		if (r.left + d < r.right - d) {
			bands.push({ top: r.top + i, bottom: r.top + i + 1, xs: [r.left + d, r.right - d] });
		}
	});
	return new Region().set(bands);
}

export function StdOval(verb: GrafVerb, r: Rect): void {
	if (EmptyRect(r)) {
		return;
	}
	const shape = ovalRegion(r);
	if (verb === frame) {
		recordRegion(shape);
	}
	drawShape(verb, shape, () => {
		const inner = { top: r.top + thePort.pnSize.v, left: r.left + thePort.pnSize.h, bottom: r.bottom - thePort.pnSize.v, right: r.right - thePort.pnSize.h };
		return inner.top < inner.bottom && inner.left < inner.right ? xor(shape, ovalRegion(inner)) : shape;
	});
}

export function FrameOval(r: Rect): void {
	StdOval(frame, r);
}

export function PaintOval(r: Rect): void {
	StdOval(paint, r);
}

export function EraseOval(r: Rect): void {
	StdOval(erase, r);
}

export function InvertOval(r: Rect): void {
	StdOval(invert, r);
}

export function FillOval(r: Rect, pat: Pattern): void {
	thePort.fillPat = [...pat];
	StdOval(fill, r);
}

// ---------------------------------------------------------------------------------------------
// Rounded rectangles

/**
 * A rounded rectangle: the corner oval's rows, with its edges pulled apart to the rectangle's width
 * and its middle row repeated to the rectangle's height.
 */
function roundRectRegion(r: Rect, ovalWidth: number, ovalHeight: number): Region {
	const width = Math.min(ovalWidth, r.right - r.left);
	const height = Math.min(ovalHeight, r.bottom - r.top);
	const insets = width <= 0 || height <= 0 ? [0] : ovalInsets(width, height);
	const mid = Math.trunc(insets.length / 2);
	const bands: Band[] = [];
	for (let v = r.top; v < r.bottom; v++) {
		const fromTop = v - r.top;
		const fromBottom = r.bottom - 1 - v;
		const k = fromTop < mid ? fromTop : fromBottom < insets.length - 1 - mid ? insets.length - 1 - fromBottom : mid;
		const d = insets[k]!;
		if (r.left + d < r.right - d) {
			bands.push({ top: v, bottom: v + 1, xs: [r.left + d, r.right - d] });
		}
	}
	return new Region().set(bands);
}

export function StdRRect(verb: GrafVerb, r: Rect, ovalWidth: Integer, ovalHeight: Integer): void {
	if (EmptyRect(r)) {
		return;
	}
	if (ovalWidth < 4 && ovalHeight < 4) {
		StdRect(verb, r);
		return;
	}
	const shape = roundRectRegion(r, ovalWidth, ovalHeight);
	if (verb === frame) {
		recordRegion(shape);
	}
	drawShape(verb, shape, () => {
		const inner = { ...r };
		InsetRect(inner, thePort.pnSize.h, thePort.pnSize.v);
		if (EmptyRect(inner)) {
			return shape;
		}
		const w = Math.min(ovalWidth, r.right - r.left) - 2 * thePort.pnSize.h;
		const h = Math.min(ovalHeight, r.bottom - r.top) - 2 * thePort.pnSize.v;
		return diff(shape, roundRectRegion(inner, w, h));
	});
}

export function FrameRoundRect(r: Rect, ovalWidth: Integer, ovalHeight: Integer): void {
	StdRRect(frame, r, ovalWidth, ovalHeight);
}

export function PaintRoundRect(r: Rect, ovalWidth: Integer, ovalHeight: Integer): void {
	StdRRect(paint, r, ovalWidth, ovalHeight);
}

export function EraseRoundRect(r: Rect, ovalWidth: Integer, ovalHeight: Integer): void {
	StdRRect(erase, r, ovalWidth, ovalHeight);
}

export function InvertRoundRect(r: Rect, ovalWidth: Integer, ovalHeight: Integer): void {
	StdRRect(invert, r, ovalWidth, ovalHeight);
}

export function FillRoundRect(r: Rect, ovalWidth: Integer, ovalHeight: Integer, pat: Pattern): void {
	thePort.fillPat = [...pat];
	StdRRect(fill, r, ovalWidth, ovalHeight);
}

// ---------------------------------------------------------------------------------------------
// Polygons

/** A PolyHandle: the polygon's bounding box and points. */
export interface Polygon {
	polyBBox: Rect;
	polyPoints: Point[];
}

/** The region inside a polygon's edges, by the even-odd rule, as OpenRgn records its lines. */
function polyRegion(poly: Polygon): Region {
	const rows = new Map<number, number[]>();
	const pts = poly.polyPoints;
	for (let i = 0; i + 1 < pts.length; i++) {
		recordLine(rows, pts[i]!, pts[i + 1]!);
	}
	// An open polygon is closed for filling.
	if (pts.length > 1 && !EqualPt(pts[0]!, pts.at(-1)!)) {
		recordLine(rows, pts.at(-1)!, pts[0]!);
	}
	return fromInversionPoints(rows);
}

export function StdPoly(verb: GrafVerb, poly: Polygon): void {
	if (poly.polyPoints.length < 2) {
		return;
	}
	if (verb === frame) {
		const port = thePort;
		const save = { ...port.pnLoc };
		MoveTo(poly.polyPoints[0]!.h, poly.polyPoints[0]!.v);
		for (const p of poly.polyPoints.slice(1)) {
			LineTo(p.h, p.v);
		}
		port.pnLoc = save;
		return;
	}
	drawShape(verb, polyRegion(poly));
}

export function FramePoly(poly: Polygon): void {
	StdPoly(frame, poly);
}

export function PaintPoly(poly: Polygon): void {
	StdPoly(paint, poly);
}

export function ErasePoly(poly: Polygon): void {
	StdPoly(erase, poly);
}

export function InvertPoly(poly: Polygon): void {
	StdPoly(invert, poly);
}

export function FillPoly(poly: Polygon, pat: Pattern): void {
	thePort.fillPat = [...pat];
	StdPoly(fill, poly);
}

// ---------------------------------------------------------------------------------------------
// Regions as shapes

export function StdRgn(verb: GrafVerb, rgn: Region): void {
	if (rgn.bands.length === 0) {
		return;
	}
	if (verb === frame) {
		recordRegion(rgn);
	}
	drawShape(verb, rgn, () => combine(rgn, insetRegion(rgn, thePort.pnSize.h, thePort.pnSize.v), (a, b) => a && !b));
}

export function FrameRgn(rgn: Region): void {
	StdRgn(frame, rgn);
}

export function PaintRgn(rgn: Region): void {
	StdRgn(paint, rgn);
}

export function EraseRgn(rgn: Region): void {
	StdRgn(erase, rgn);
}

export function InvertRgn(rgn: Region): void {
	StdRgn(invert, rgn);
}

export function FillRgn(rgn: Region, pat: Pattern): void {
	thePort.fillPat = [...pat];
	StdRgn(fill, rgn);
}

// ---------------------------------------------------------------------------------------------
// Bits

/**
 * Copies pixels between bitmaps, clipped to the current port's visRgn and clipRgn when the
 * destination is its bitmap, and to maskRgn (in destination coordinates) when given.
 */
export function CopyBits(srcBits: BitMap, dstBits: BitMap, srcRect: Rect, dstRect: Rect, mode: Integer, maskRgn: Region | null): void {
	if (srcRect.right - srcRect.left !== dstRect.right - dstRect.left || srcRect.bottom - srcRect.top !== dstRect.bottom - dstRect.top) {
		throw new Error('CopyBits: stretching is not implemented');
	}
	const src = surfaceOf(srcBits);
	const dst = surfaceOf(dstBits);
	let clip = sect(rectRegion(dstRect), rectRegion(dstBits.bounds));
	// The source rectangle is clipped to the source bitmap, too.
	const srcClip = rectRegion(srcBits.bounds);
	offsetRegion(srcClip, dstRect.left - srcRect.left, dstRect.top - srcRect.top);
	clip = sect(clip, srcClip);
	if (dstBits === thePort.portBits || (dstBits.baseAddr === thePort.portBits.baseAddr && EqualRect(dstBits.bounds, thePort.portBits.bounds))) {
		clip = sect(sect(clip, thePort.visRgn), thePort.clipRgn);
	}
	if (maskRgn !== null) {
		clip = sect(clip, maskRgn);
	}
	const dh = srcRect.left - dstRect.left;
	const dv = srcRect.top - dstRect.top;
	const op = mode & 3;
	const notSrc = (mode & 4) !== 0;
	const ones = (1 << dst.depth) - 1;
	if (src.depth !== 1 || dst.depth !== 1) {
		throw new Error('CopyBits: only 1-bit bitmaps are implemented');
	}
	// Rows are processed in an order that copies correctly when source and destination overlap.
	const bands = dv < 0 ? [...clip.bands].reverse() : clip.bands;
	for (const band of bands) {
		for (let n = 0; n < band.bottom - band.top; n++) {
			const v = dv < 0 ? band.bottom - 1 - n : band.top + n;
			for (let k = 0; k < band.xs.length; k += 2) {
				const from = band.xs[k]!;
				const to = band.xs[k + 1]!;
				const row: number[] = [];
				for (let h = from; h < to; h++) {
					row.push(getPixel(src, h + dh, v + dv));
				}
				for (let h = from; h < to; h++) {
					let p = row[h - from]!;
					if (notSrc) {
						p ^= 1;
					}
					switch (op) {
						case 0:
							setPixel(dst, h, v, p ? ones : 0);
							break;
						case 1:
							if (p) {
								setPixel(dst, h, v, ones);
							}
							break;
						case 2:
							if (p) {
								setPixel(dst, h, v, getPixel(dst, h, v) ^ ones);
							}
							break;
						case 3:
							if (p) {
								setPixel(dst, h, v, 0);
							}
							break;
					}
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------------------------
// Text

export interface FontInfo {
	ascent: Integer;
	descent: Integer;
	widMax: Integer;
	leading: Integer;
}

export function TextFont(font: Integer): void {
	thePort.txFont = font;
}

export function TextFace(face: Integer): void {
	thePort.txFace = face;
}

export function TextMode(mode: Integer): void {
	thePort.txMode = mode;
}

export function TextSize(size: Integer): void {
	thePort.txSize = size;
}

export function SpaceExtra(extra: LongInt): void {
	thePort.spExtra = extra;
}

function portStrike(): FontStrike {
	return fontStrike(thePort.txFont, thePort.txSize);
}

export function GetFontInfo(info: FontInfo): void {
	const f = portStrike();
	info.ascent = f.ascent;
	info.descent = f.descent;
	info.widMax = f.widMax;
	info.leading = f.leading;
}

function charCode(ch: string | number): number {
	return typeof ch === 'number' ? ch : encodeMacRoman(ch)[0]!;
}

export function CharWidth(ch: string | number): Integer {
	return glyphOf(portStrike(), charCode(ch)).width;
}

export function TextWidth(text: Uint8Array, firstByte: Integer, byteCount: Integer): Integer {
	const f = portStrike();
	let w = 0;
	for (let i = firstByte; i < firstByte + byteCount; i++) {
		w += glyphOf(f, text[i]!).width;
	}
	return w;
}

export function StringWidth(s: string): Integer {
	const b = encodeMacRoman(s);
	return TextWidth(b, 0, b.length);
}

/**
 * Draws characters at the pen location in the port's font and text mode and moves the pen past them.
 * Port: as in QuickDraw, the characters are first drawn into a buffer that covers their advance
 * widths, from the font's ascent to its descent, and the buffer is then transferred in the text mode,
 * so that copy modes fill that box. Spaces are never drawn, even when the font draws a missing
 * character in their place (seen in the oracle).
 */
export function StdText(text: Uint8Array): void {
	const port = thePort;
	const f = portStrike();
	const start = port.pnLoc.h;
	const v = port.pnLoc.v;
	let width = 0;
	for (const ch of text) {
		width += glyphOf(f, ch).width;
	}
	port.pnLoc = { h: start + width, v };
	if (port.pnVis < 0 || width <= 0) {
		return;
	}
	// The buffer: one byte per pixel, set where a glyph has a black pixel.
	const top = v - f.ascent;
	const height = f.ascent + f.descent;
	const buffer = new Uint8Array(width * height);
	const fontRowBytes = f.rowWords * 2;
	let pen = 0;
	for (const ch of text) {
		const g = glyphOf(f, ch);
		if (ch !== 0x20) {
			for (let y = 0; y < height && y < f.fRectHeight; y++) {
				for (let i = 0; i < g.imageWidth; i++) {
					const x = pen + g.imageOffset + i;
					const col = g.locStart + i;
					if (x >= 0 && x < width && (f.bitImage[y * fontRowBytes + (col >> 3)]! >> (7 - (col & 7))) & 1) {
						buffer[y * width + x] = 1;
					}
				}
			}
		}
		pen += g.width;
	}
	transferBuffer(buffer, { top, left: start, bottom: top + height, right: start + width }, port.txMode);
}

/** Transfers a one-byte-per-pixel buffer of 0s and 1s (1 = black) to the current port in a source mode. */
function transferBuffer(buffer: Uint8Array, r: Rect, mode: number): void {
	const s = surfaceOf(thePort.portBits);
	const ones = (1 << s.depth) - 1;
	const op = mode & 3;
	const not = (mode & 4) !== 0;
	const width = r.right - r.left;
	for (const band of clipToPort(rectRegion(r)).bands) {
		for (let v = band.top; v < band.bottom; v++) {
			for (let k = 0; k < band.xs.length; k += 2) {
				for (let h = band.xs[k]!; h < band.xs[k + 1]!; h++) {
					let p = buffer[(v - r.top) * width + h - r.left]!;
					if (not) {
						p ^= 1;
					}
					switch (op) {
						case 0:
							setPixel(s, h, v, p ? ones : 0);
							break;
						case 1:
							if (p) {
								setPixel(s, h, v, ones);
							}
							break;
						case 2:
							if (p) {
								setPixel(s, h, v, getPixel(s, h, v) ^ ones);
							}
							break;
						case 3:
							if (p) {
								setPixel(s, h, v, 0);
							}
							break;
					}
				}
			}
		}
	}
}

export function DrawChar(ch: string | number): void {
	StdText(new Uint8Array([charCode(ch)]));
}

export function DrawString(s: string): void {
	StdText(encodeMacRoman(s));
}

export function DrawText(text: Uint8Array, firstByte: Integer, byteCount: Integer): void {
	StdText(text.subarray(firstByte, firstByte + byteCount));
}

export { Region } from './Region.ts';
