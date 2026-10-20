// Port: the Room Editor's tool window definition, its 'WDEF' 10 ("Windoid"): a frame with a
// shadow, a dotted bar of 10 pixels across the top (variation 0) or down the left side (2), and a
// close box. The editor's resources carry it as 68000 code, which the port does not run; this is a
// translation of that code's disassembly (1,372 bytes, its routines named by MacsBug symbols:
// GETDRAGBAR, GETCLOSE, DRAWFRAM(E), TOGGLECLOSE, FINDPART, BUILDREGIONS, MAIN), registered with
// the Window Manager in its place (setWindowDef).

import {
	EraseRect,
	FillRect,
	FrameRect,
	GetPenState,
	InsetRect,
	InvertRect,
	type Integer,
	LineTo,
	type LongInt,
	MoveTo,
	OffsetRect,
	type Pattern,
	type PenState,
	PenSize,
	type Point,
	PtInRect,
	PtInRgn,
	type Rect,
	RectRgn,
	Region,
	SetPenState,
	SetRect,
	UnionRgn,
	wCalcRgns,
	wDraw,
	type WindowRecord,
	wHit,
	wInContent,
	wInDrag,
	wInGoAway,
	wNoHit,
} from '../mac/Toolbox.ts';

export const windoidID = 10;

/** The drag bar: across the top of the frame for variation 0, down its left side for 2. */
function GetDragBar(r: Rect, w: WindowRecord, varCode: Integer): void {
	Object.assign(r, w.contRgn.rgnBBox);
	InsetRect(r, -1, -1);
	if (varCode === 0) {
		r.bottom = r.top + 1;
		r.top = r.top - 10;
	} else if (varCode === 2) {
		r.right = r.left + 1;
		r.left = r.left - 10;
	} else {
		SetRect(r, 0, 0, 0, 0);
	}
}

/** The close box, 7 pixels square, 8 pixels along the bar from its start. */
function GetClose(bar: Rect, box: Rect, varCode: Integer): void {
	if (varCode === 0) {
		SetRect(box, bar.left + 8, bar.top + 2, bar.left + 15, bar.bottom - 2);
	} else if (varCode === 2) {
		SetRect(box, bar.left + 2, bar.top + 8, bar.right - 2, bar.top + 15);
	} else {
		SetRect(box, 0, 0, 0, 0);
	}
}

/** "AA00AA00AA00AA00", by StuffHex: dots on every other pixel of every other row. */
const barPattern: Pattern = [0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00];

function DrawFrame(w: WindowRecord, varCode: Integer): void {
	const savePen: PenState = { pnLoc: { v: 0, h: 0 }, pnSize: { v: 0, h: 0 }, pnMode: 0, pnPat: [] };
	GetPenState(savePen);
	const r = { ...w.contRgn.rgnBBox };
	InsetRect(r, -1, -1);
	PenSize(1, 1);
	FrameRect(r);
	PenSize(1, 1);
	// The shadow, along the bottom and up the right side to the bar's second row.
	if (varCode === 0) {
		MoveTo(r.left + 1 + 2, r.bottom);
		LineTo(r.right, r.bottom);
		LineTo(r.right, r.top - 10 + 1);
	} else if (varCode === 2) {
		MoveTo(r.left - 10 + 1, r.bottom);
		LineTo(r.right, r.bottom);
		LineTo(r.right, r.top + 1);
	}
	// The pattern moves with the frame's parity, so that its dots keep their place in the bar.
	let pat = [...barPattern];
	if (((r.left & 1) === 0 && varCode === 0) || ((r.left & 1) !== 0 && varCode === 2)) {
		const word = ~((pat[0]! << 8) | pat[1]!) & 0xff00;
		pat = [word >> 8, word & 0xff, word >> 8, word & 0xff, word >> 8, word & 0xff, word >> 8, word & 0xff];
	}
	if (((r.top & 1) !== 0 && varCode === 0) || ((r.top & 1) === 0 && varCode === 2)) {
		// The first four bytes, as a long, shifted right by a byte, for both halves.
		const half = [0, pat[0]!, pat[1]!, pat[2]!];
		pat = [...half, ...half];
	}
	const bar: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	GetDragBar(bar, w, varCode);
	PenSize(1, 1);
	FillRect(bar, pat);
	FrameRect(bar);
	if (w.goAwayFlag) {
		const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
		GetClose(bar, box, varCode);
		InsetRect(box, -1, -1);
		EraseRect(box);
		InsetRect(box, 1, 1);
		FrameRect(box);
	}
	SetPenState(savePen);
}

function ToggleClose(w: WindowRecord, varCode: Integer): void {
	const bar: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	GetDragBar(bar, w, varCode);
	GetClose(bar, box, varCode);
	InvertRect(box);
}

function FindPart(varCode: Integer, w: WindowRecord, pt: Point): Integer {
	if (!PtInRgn(pt, w.strucRgn)) {
		return wNoHit;
	}
	if (PtInRgn(pt, w.contRgn)) {
		return wInContent;
	}
	const bar: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	GetDragBar(bar, w, varCode);
	if (PtInRect(pt, bar)) {
		const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
		GetClose(bar, box, varCode);
		if (PtInRect(pt, box) && w.goAwayFlag) {
			return wInGoAway;
		}
		return wInDrag;
	}
	return wNoHit;
}

function BuildRegions(w: WindowRecord, varCode: Integer): void {
	// Port: the content in global coordinates, from portRect and portBits.bounds. (The code reads
	// the bounds at the port's offset 8, which in a color port is grafVars; not yet measured how the
	// Mac II's tool window, a color window, comes out right.)
	const r = { ...w.portRect };
	OffsetRect(r, -w.portBits.bounds.left, -w.portBits.bounds.top);
	RectRgn(w.contRgn, r);
	InsetRect(r, -1, -1);
	if (varCode === 0) {
		r.top = r.top - 10;
	} else if (varCode === 2) {
		r.left = r.left - 10;
	}
	RectRgn(w.strucRgn, r);
	OffsetRect(r, 1, 1);
	const shadow = new Region();
	RectRgn(shadow, r);
	UnionRgn(w.strucRgn, shadow, w.strucRgn);
}

/** MAIN: the window definition function. */
export function windoidDef(varCode: Integer, w: WindowRecord, message: Integer, param: LongInt): LongInt {
	switch (message) {
		case wDraw:
			if (w.visible) {
				if (param === 0) {
					DrawFrame(w, varCode);
				} else if (param === wInGoAway) {
					ToggleClose(w, varCode);
				}
			}
			return 0;
		case wHit:
			return FindPart(varCode, w, { v: param >> 16, h: (param << 16) >> 16 });
		case wCalcRgns:
			BuildRegions(w, varCode);
			return 0;
		default:
			return 0;
	}
}
