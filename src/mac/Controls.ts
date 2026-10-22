// Port: the Control Manager (Inside Macintosh I, chapter 10, and V, chapter 12), with System 6's
// standard buttons (CDEF 0): push buttons, check boxes, and radio buttons; and its scroll bars
// (CDEF 1), read from System 6.0.8's code (see drawScrollBar).
//
// The geometry is measured from the oracle (Glider's dialogs on a Mac Plus): push buttons are
// rounded rectangles whose corners' curvature is half their height, with the title centered; check
// boxes and radio buttons are 12-pixel squares and circles 2 pixels in from the left, centered
// vertically, with the title 18 pixels in from the left. Titles start (height - line height) div 2
// below the top, and (width - title width) div 2 right of the left.

import { getHost, mouse, TickCount, tickTime } from './OS.ts';
import {
	type BitMap,
	CopyBits,
	FillRect,
	srcCopy,
	white,
	DrawText,
	EraseRect,
	FrameOval,
	FrameRect,
	FrameRoundRect,
	GetFontInfo,
	type GrafPort,
	gray,
	InsetRect,
	InvertRoundRect,
	isColorPort,
	LineTo,
	MoveTo,
	NewRgn,
	PaintOval,
	PaintRect,
	PaintRoundRect,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	PtInRect,
	type RGBColor,
	RGBBackColor,
	RGBForeColor,
	SectRect,
	SectRgn,
	SetPort,
	srcOr,
	TextFace,
	TextFont,
	TextMode,
	TextSize,
	TextWidth,
	thePort,
	GlobalToLocal,
	patBic,
	OpenRgn,
	CloseRgn,
	SetClip,
	GetClip,
	InsetRgn,
} from './QuickDraw.ts';
import { encodeMacRoman, pascalString } from './MacRoman.ts';
import { rectRegion } from './Region.ts';
import { GetResource } from './Resources.ts';
import { s16 } from './Binary.ts';
import { bytesAt, DisposPtr, NewPtr } from './Memory.ts';
import { GetPattern } from './ToolUtils.ts';
import type { WindowRecord } from './Windows.ts';
import type { Integer, LongInt, Point, Rect, Ref } from './Types.ts';

/** Control definition IDs. */
export const pushButProc = 0;
export const checkBoxProc = 1;
export const radioButProc = 2;
export const useWFont = 8;
export const scrollBarProc = 16;

/** Part codes. */
export const inButton = 10;
export const inCheckBox = 11;
export const inUpButton = 20;
export const inDownButton = 21;
export const inPageUp = 22;
export const inPageDown = 23;
export const inThumb = 129;

/** CDEF messages. */
export const drawCntl = 0;
export const testCntl = 1;
export const calcCRgns = 2;
export const initCntl = 3;
export const dispCntl = 4;

/** Parts of a control color table ('cctb'). */
export const cFrameColor = 0;
export const cBodyColor = 1;
export const cTextColor = 2;
export const cThumbColor = 3;

/** Pascal `ControlRecord` (a ControlHandle is a ControlRecord). */
export class ControlRecord {
	nextControl: ControlRecord | null = null;
	contrlOwner!: WindowRecord;
	contrlRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	contrlVis = 255;
	/** 0 active, 1 to 253 a highlighted part, 255 inactive. */
	contrlHilite = 0;
	contrlValue: Integer = 0;
	contrlMin: Integer = 0;
	contrlMax: Integer = 0;
	/** Port: the definition's procID (the CDEF's ID times 16 plus the variation). */
	procID: Integer = 0;
	contrlData: unknown = null;
	contrlAction: ((theControl: ControlRecord, partCode: Integer) => void | Promise<void>) | null = null;
	contrlRfCon: LongInt = 0;
	contrlTitle = '';
}

export type ControlHandle = ControlRecord;

// ---------------------------------------------------------------------------------------------
// Creating and disposing of controls

/** Pascal `NewControl`. */
export function NewControl(
	theWindow: WindowRecord,
	boundsRect: Rect,
	title: string,
	visible: boolean,
	value: Integer,
	min: Integer,
	max: Integer,
	procID: Integer,
	refCon: LongInt,
): ControlRecord {
	const c = new ControlRecord();
	c.contrlOwner = theWindow;
	c.contrlRect = { ...boundsRect };
	c.contrlVis = visible ? 255 : 0;
	c.contrlValue = value;
	c.contrlMin = min;
	c.contrlMax = max;
	c.procID = procID;
	c.contrlRfCon = refCon;
	c.contrlTitle = title;
	c.nextControl = theWindow.controlList;
	theWindow.controlList = c;
	if (visible) {
		Draw1Control(c);
	}
	return c;
}

/** Pascal `GetNewControl`: from a 'CNTL' resource. */
export function GetNewControl(controlID: Integer, theWindow: WindowRecord): ControlRecord | null {
	const h = GetResource('CNTL', controlID);
	if (h === null) {
		return null;
	}
	const d = h.data;
	const rect = { top: s16(d, 0), left: s16(d, 2), bottom: s16(d, 4), right: s16(d, 6) };
	return NewControl(theWindow, rect, pascalString(d, 22), s16(d, 10) !== 0, s16(d, 8), s16(d, 14), s16(d, 12), s16(d, 16), (s16(d, 18) << 16) | (s16(d, 20) & 0xffff));
}

export function DisposeControl(theControl: ControlRecord): void {
	HideControl(theControl);
	const w = theControl.contrlOwner;
	if (w.controlList === theControl) {
		w.controlList = theControl.nextControl;
	} else {
		for (let c = w.controlList; c !== null; c = c.nextControl) {
			if (c.nextControl === theControl) {
				c.nextControl = theControl.nextControl;
				break;
			}
		}
	}
}

export function KillControls(theWindow: WindowRecord): void {
	theWindow.controlList = null;
}

// ---------------------------------------------------------------------------------------------
// Values, titles, and highlighting

export function SetCTitle(theControl: ControlRecord, title: string): void {
	theControl.contrlTitle = title;
	Draw1Control(theControl);
}

/** Pascal `GetCTitle(theControl, var title)`. */
export function GetCTitle(theControl: ControlRecord): string {
	return theControl.contrlTitle;
}

export function SetCtlValue(theControl: ControlRecord, theValue: Integer): void {
	const v = Math.min(Math.max(theValue, theControl.contrlMin), theControl.contrlMax);
	if (v !== theControl.contrlValue) {
		theControl.contrlValue = v;
		drawControl(theControl, theControl.procID >> 4 === scrollBarProc >> 4 ? inThumb : inCheckBox);
	}
}

export function GetCtlValue(theControl: ControlRecord): Integer {
	return theControl.contrlValue;
}

export function SetCtlMin(theControl: ControlRecord, minValue: Integer): void {
	theControl.contrlMin = minValue;
	SetCtlValue(theControl, theControl.contrlValue);
}

export function GetCtlMin(theControl: ControlRecord): Integer {
	return theControl.contrlMin;
}

export function SetCtlMax(theControl: ControlRecord, maxValue: Integer): void {
	theControl.contrlMax = maxValue;
	SetCtlValue(theControl, theControl.contrlValue);
}

export function GetCtlMax(theControl: ControlRecord): Integer {
	return theControl.contrlMax;
}

export function SetCRefCon(theControl: ControlRecord, data: LongInt): void {
	theControl.contrlRfCon = data;
}

export function GetCRefCon(theControl: ControlRecord): LongInt {
	return theControl.contrlRfCon;
}

/** Pascal `HiliteControl`: 0 active, a part code to highlight it, 255 inactive. */
export function HiliteControl(theControl: ControlRecord, hiliteState: Integer): void {
	if (theControl.contrlHilite !== hiliteState) {
		theControl.contrlHilite = hiliteState;
		Draw1Control(theControl);
	}
}

export function HideControl(theControl: ControlRecord): void {
	if (theControl.contrlVis === 0) {
		return;
	}
	theControl.contrlVis = 0;
	withOwnerPort(theControl, () => {
		EraseRect(theControl.contrlRect);
	});
}

export function ShowControl(theControl: ControlRecord): void {
	if (theControl.contrlVis !== 0) {
		return;
	}
	theControl.contrlVis = 255;
	Draw1Control(theControl);
}

export function MoveControl(theControl: ControlRecord, h: Integer, v: Integer): void {
	const visible = theControl.contrlVis !== 0;
	HideControl(theControl);
	const r = theControl.contrlRect;
	theControl.contrlRect = { top: v, left: h, bottom: v + r.bottom - r.top, right: h + r.right - r.left };
	if (visible) {
		ShowControl(theControl);
	}
}

export function SizeControl(theControl: ControlRecord, w: Integer, h: Integer): void {
	const visible = theControl.contrlVis !== 0;
	HideControl(theControl);
	theControl.contrlRect.right = theControl.contrlRect.left + w;
	theControl.contrlRect.bottom = theControl.contrlRect.top + h;
	if (visible) {
		ShowControl(theControl);
	}
}

// ---------------------------------------------------------------------------------------------
// Drawing

function withOwnerPort(c: ControlRecord, draw: () => void): void {
	const save = thePort;
	SetPort(c.contrlOwner);
	draw();
	SetPort(save);
}

/**
 * Pascal `DrawControls`: draws all of a window's visible controls, the last created first, down
 * the control list, so that where they overlap the earliest are in front (Inside Macintosh I-322).
 * Seen in the oracle: the Room Editor's Room Condition radio buttons overlap by 3 pixels, and the
 * "g" of "Nothing" (item 6) stays over "Balloons" (item 7), whose erase would take its descender.
 */
export function DrawControls(theWindow: WindowRecord): void {
	for (let c = theWindow.controlList; c !== null; c = c.nextControl) {
		Draw1Control(c);
	}
}

export function Draw1Control(theControl: ControlRecord): void {
	drawControl(theControl, 0);
}

/** Pascal `UpdtControl`: draws the controls that intersect an update region. */
export function UpdtControl(theWindow: WindowRecord, _updateRgn: unknown): void {
	DrawControls(theWindow);
}

/** Port: a control's frame color, as GetAuxCtl's color table gives it. */
export function controlFrameColor(c: ControlRecord): RGBColor {
	return { ...controlColors(c.contrlOwner).frame };
}

/** The control's colors: its frame, body, and text. */
function controlColors(port: GrafPort): { frame: RGBColor; body: RGBColor; text: RGBColor } {
	const black = { red: 0, green: 0, blue: 0 };
	const white = { red: 0xffff, green: 0xffff, blue: 0xffff };
	const cctb = isColorPort(port) ? GetResource('cctb', 0) : null;
	const colors = { frame: black, body: white, text: black };
	if (cctb !== null) {
		const d = cctb.data;
		for (let i = 0; i <= s16(d, 6); i++) {
			const o = 8 + i * 8;
			const rgb = { red: (d[o + 2]! << 8) | d[o + 3]!, green: (d[o + 4]! << 8) | d[o + 5]!, blue: (d[o + 6]! << 8) | d[o + 7]! };
			const part = s16(d, o);
			if (part === cFrameColor) {
				colors.frame = rgb;
			} else if (part === cBodyColor) {
				colors.body = rgb;
			} else if (part === cTextColor) {
				colors.text = rgb;
			}
		}
	}
	return colors;
}

/** Draws a control, or for `part` inCheckBox only its box or circle. */
function drawControl(c: ControlRecord, part: Integer): void {
	if (c.contrlVis === 0) {
		return;
	}
	withOwnerPort(c, () => {
		const port = thePort;
		const r = c.contrlRect;
		const visible = { ...r };
		if (!SectRect(port.visRgn.rgnBBox, r, visible)) {
			return;
		}
		const saved = { font: port.txFont, face: port.txFace, size: port.txSize, mode: port.txMode, pnSize: { ...port.pnSize }, pnMode: port.pnMode, pnPat: port.pnPat, fg: { ...port.rgbFgColor }, bk: { ...port.rgbBkColor } };
		const variation = c.procID & 15;
		PenNormal();
		if ((variation & useWFont) === 0) {
			TextFont(0);
			TextSize(0);
			TextFace(0);
		}
		TextMode(srcOr);
		const colors = controlColors(port);
		if (c.procID >> 4 === scrollBarProc >> 4) {
			drawScrollBar(c, part);
		} else {
			switch (c.procID & 7) {
				case pushButProc:
					drawPushButton(c, colors);
					if (c.contrlHilite >= 254) {
						dim(r);
					}
					break;
				case checkBoxProc:
					drawCheckBox(c, part, colors, false);
					break;
				case radioButProc:
					drawCheckBox(c, part, colors, true);
					break;
			}
		}
		port.txFont = saved.font;
		port.txFace = saved.face;
		port.txSize = saved.size;
		port.txMode = saved.mode;
		port.pnSize = saved.pnSize;
		port.pnMode = saved.pnMode;
		port.pnPat = saved.pnPat;
		if (isColorPort(port)) {
			RGBForeColor(saved.fg);
			RGBBackColor(saved.bk);
		}
	});
}

function foreColor(c: RGBColor): void {
	if (isColorPort(thePort)) {
		RGBForeColor(c);
	}
}

function drawPushButton(c: ControlRecord, colors: { frame: RGBColor; body: RGBColor; text: RGBColor }): void {
	const r = c.contrlRect;
	const color = isColorPort(thePort);
	if (color && c.contrlHilite === inButton) {
		// In color a pressed button swaps its body and text colors, and keeps its frame.
		colors = { frame: colors.frame, body: colors.text, text: colors.body };
	}
	// The corners' curvature is half the button's height (10 for Glider's 20-pixel buttons, 7 for its 15-pixel ones).
	const round = Math.trunc((r.bottom - r.top) / 2);
	const clip = NewRgn();
	GetClip(clip);
	const shape = NewRgn();
	OpenRgn();
	FrameRoundRect(r, round, round);
	CloseRgn(shape);
	SectRgn(shape, clip, shape);
	SetClip(shape);
	if (color) {
		RGBForeColor(colors.body);
		PaintRoundRect(r, round, round);
		RGBBackColor(colors.body);
	} else {
		EraseRect(r);
	}
	foreColor(colors.frame);
	FrameRoundRect(r, round, round);
	InsetRgn(shape, 1, 1);
	SetClip(shape);
	foreColor(colors.text);
	drawLabel(c.contrlTitle, r, true);
	SetClip(clip);
	if (!color && c.contrlHilite === inButton) {
		// In black and white the whole button is inverted, frame included.
		InvertRoundRect(r, round, round);
	}
}

function drawCheckBox(c: ControlRecord, part: Integer, colors: { frame: RGBColor; body: RGBColor; text: RGBColor }, radio: boolean): void {
	const r = c.contrlRect;
	if (part === 0) {
		// The title is clipped to the control's rectangle.
		const clip = NewRgn();
		GetClip(clip);
		const area = NewRgn();
		SectRgn(clip, rectRegion(r), area);
		SetClip(area);
		EraseRect({ ...r, right: r.right - 2 });
		foreColor(colors.text);
		drawLabel(c.contrlTitle, { ...r, left: r.left + 18 }, false);
		SetClip(clip);
	}
	const top = Math.trunc((r.top + r.bottom) / 2) - 6;
	const box = { top, left: r.left + 2, bottom: top + 12, right: r.left + 14 };
	EraseRect(box);
	foreColor(colors.frame);
	if (c.contrlHilite >= 254) {
		dim(r);
	} else if (c.contrlHilite === inCheckBox) {
		PenSize(2, 2);
	}
	if (radio) {
		FrameOval(box);
		PenSize(1, 1);
		if (c.contrlValue !== 0) {
			const dot = { ...box };
			InsetRect(dot, 3, 3);
			PaintOval(dot);
		}
	} else {
		FrameRect(box);
		PenSize(1, 1);
		if (c.contrlValue !== 0) {
			MoveTo(box.left + 1, box.top + 1);
			LineTo(box.right - 2, box.bottom - 2);
			MoveTo(box.right - 2, box.top + 1);
			LineTo(box.left + 1, box.bottom - 2);
		}
	}
}

/**
 * Grays an inactive control (CDEF 0's routine at $344): the gray pattern's pixels cleared (patBic)
 * inside its rectangle less 3 pixels at the sides and 1 at the top and bottom, so a button's frame
 * stays whole; a check box's box is framed after it, whole too.
 */
function dim(r: Rect): void {
	const inner = { ...r };
	InsetRect(inner, 3, 1);
	PenPat(gray);
	PenMode(patBic);
	PaintRect(inner);
	PenNormal();
}

/** Draws a title of one or more lines (separated by returns), centered vertically. */
function drawLabel(title: string, r: Rect, centered: boolean): void {
	const info = { ascent: 0, descent: 0, widMax: 0, leading: 0 };
	GetFontInfo(info);
	const bytes = encodeMacRoman(title);
	const lines: [number, number][] = [];
	let start = 0;
	for (let i = 0; i <= bytes.length; i++) {
		if (i === bytes.length || bytes[i] === 13) {
			lines.push([start, i - start]);
			start = i + 1;
		}
	}
	const lineHeight = info.ascent + info.descent + info.leading;
	let v = r.top + Math.trunc((r.bottom - r.top - lines.length * lineHeight) / 2) + info.ascent;
	for (const [first, count] of lines) {
		const h = centered ? r.left + Math.trunc((r.right - r.left - TextWidth(bytes, first, count)) / 2) : r.left;
		MoveTo(h, v);
		DrawText(bytes, first, count);
		v += lineHeight;
	}
}

// ---------------------------------------------------------------------------------------------
// The mouse

/** Pascal `FindControl(thePoint, theWindow, var whichControl)`: the part of a visible, active control under a point. */
export function FindControl(thePoint: Point, theWindow: WindowRecord, whichControl: Ref<ControlRecord | null>): Integer {
	whichControl.v = null;
	for (let c = theWindow.controlList; c !== null; c = c.nextControl) {
		if (c.contrlVis !== 0 && c.contrlHilite !== 255 && PtInRect(thePoint, c.contrlRect)) {
			whichControl.v = c;
			return TestControl(c, thePoint);
		}
	}
	return 0;
}

export function TestControl(theControl: ControlRecord, thePt: Point): Integer {
	if (theControl.procID >> 4 === scrollBarProc >> 4) {
		return testScrollBar(theControl, thePt);
	}
	if (theControl.contrlHilite === 255 || !PtInRect(thePt, theControl.contrlRect)) {
		return 0;
	}
	return (theControl.procID & 7) === pushButProc ? inButton : inCheckBox;
}

/**
 * Pascal `TrackControl`: highlights the part while the mouse is in it and the button is down.
 * Returns the part if the button comes up inside it, 0 otherwise.
 */
export async function TrackControl(theControl: ControlRecord, startPt: Point, actionProc: ((c: ControlRecord, part: Integer) => void | Promise<void>) | null): Promise<Integer> {
	const part = TestControl(theControl, startPt);
	if (part === 0) {
		return 0;
	}
	if (part === inThumb && theControl.procID >> 4 === scrollBarProc >> 4) {
		return trackThumb(theControl, startPt);
	}
	let inside = true;
	HiliteControl(theControl, part);
	for (;;) {
		if (!mouse.button) {
			break;
		}
		await getHost().sleep(tickTime(TickCount() + 1));
		const save = thePort;
		SetPort(theControl.contrlOwner);
		const pt = { ...mouse.where };
		GlobalToLocal(pt);
		SetPort(save);
		// The part pressed is highlighted, and the action called, only while the mouse is in that
		// part: a scroll bar's page area stops once the thumb comes under the mouse (seen in the
		// oracle: the Room Editor's help, held in its page area).
		const now = TestControl(theControl, pt) === part;
		if (now !== inside) {
			inside = now;
			HiliteControl(theControl, inside ? part : 0);
		}
		if (inside && actionProc !== null) {
			await actionProc(theControl, part);
		}
	}
	HiliteControl(theControl, 0);
	return inside ? part : 0;
}

/**
 * Port: a scroll bar's thumb, dragged. The ROM drags a gray outline of it along the track (not
 * measured, and not drawn here); the value changes when the button comes up, in proportion to how
 * far the mouse moved along the track.
 */
async function trackThumb(c: ControlRecord, startPt: Point): Promise<Integer> {
	const pt = { ...startPt };
	while (mouse.button) {
		await getHost().sleep(tickTime(TickCount() + 1));
	}
	const save = thePort;
	SetPort(c.contrlOwner);
	Object.assign(pt, mouse.where);
	GlobalToLocal(pt);
	SetPort(save);
	const { vertical, thickness } = barShape(c.contrlRect);
	const r = c.contrlRect;
	const travel = (vertical ? r.bottom - r.top : r.right - r.left) - 3 * thickness;
	const moved = vertical ? pt.v - startPt.v : pt.h - startPt.h;
	if (travel > 0) {
		SetCtlValue(c, c.contrlValue + Math.round((moved * (c.contrlMax - c.contrlMin)) / travel));
	}
	return inThumb;
}

// ---------------------------------------------------------------------------------------------
// Scroll bars (CDEF 1)
//
// System 6.0.8's scroll bar definition: its arrows are 16-by-16 bitmaps, framed, copied in srcCopy
// into the bar's ends (pressed ones while their part is highlighted); the track between them, the
// bar inset by 1 across and by its thickness along, is filled with PAT 17 (a light gray), or white
// when the bar is inactive (highlighted 255, or its minimum equal to its maximum), and an active
// bar's thumb is a white square framed, 16 along, at its value's place in the track's length less
// three thicknesses, to the nearest pixel (halves down). The bar's rectangle is framed last.

/** The arrows' bitmaps, from CDEF 1 (offsets $D8 to $1D7): each 16 rows of 16 bits. */
const scrollArrows = {
	right: [0xffff, 0x8081, 0x80c1, 0x80a1, 0x8f91, 0x8809, 0x8805, 0x8803, 0x8805, 0x8809, 0x8f91, 0x80a1, 0x80c1, 0x8081, 0x8001, 0xffff],
	rightPressed: [0xffff, 0x8081, 0x80c1, 0x80e1, 0x8ff1, 0x8ff9, 0x8ffd, 0x8fff, 0x8ffd, 0x8ff9, 0x8ff1, 0x80e1, 0x80c1, 0x8081, 0x8001, 0xffff],
	left: [0xffff, 0x8101, 0x8301, 0x8501, 0x89f1, 0x9011, 0xa011, 0xc011, 0xa011, 0x9011, 0x89f1, 0x8501, 0x8301, 0x8101, 0x8001, 0xffff],
	leftPressed: [0xffff, 0x8101, 0x8301, 0x8701, 0x8ff1, 0x9ff1, 0xbff1, 0xfff1, 0xbff1, 0x9ff1, 0x8ff1, 0x8701, 0x8301, 0x8101, 0x8001, 0xffff],
	down: [0xffff, 0x8001, 0x8001, 0x8fe1, 0x8821, 0x8821, 0x8821, 0xf83d, 0xa009, 0x9011, 0x8821, 0x8441, 0x8281, 0x8101, 0x8001, 0xffff],
	downPressed: [0xffff, 0x8001, 0x8001, 0x8fe1, 0x8fe1, 0x8fe1, 0x8fe1, 0xfffd, 0xbff9, 0x9ff1, 0x8fe1, 0x87c1, 0x8381, 0x8101, 0x8001, 0xffff],
	up: [0xffff, 0x8001, 0x8101, 0x8281, 0x8441, 0x8821, 0x9011, 0xa009, 0xf83d, 0x8821, 0x8821, 0x8821, 0x8fe1, 0x8001, 0x8001, 0xffff],
	upPressed: [0xffff, 0x8001, 0x8101, 0x8381, 0x87c1, 0x8fe1, 0x9ff1, 0xbff9, 0xfffd, 0x8fe1, 0x8fe1, 0x8fe1, 0x8fe1, 0x8001, 0x8001, 0xffff],
};

/** Whether a bar runs up and down (it is not wider than it is tall), and its thickness. */
function barShape(r: Rect): { vertical: boolean; thickness: number } {
	const height = r.bottom - r.top;
	const width = r.right - r.left;
	return width > height ? { vertical: false, thickness: height } : { vertical: true, thickness: width };
}

function scrollBarActive(c: ControlRecord): boolean {
	return c.contrlHilite !== 255 && c.contrlHilite !== 254 && c.contrlMin !== c.contrlMax;
}

/** The thumb's rectangle (CDEF 1's routine at $37A). */
function thumbRect(c: ControlRecord): Rect {
	const r = { ...c.contrlRect };
	const { vertical, thickness } = barShape(r);
	const [start, end] = vertical ? (['top', 'bottom'] as const) : (['left', 'right'] as const);
	const [across0, across1] = vertical ? (['left', 'right'] as const) : (['top', 'bottom'] as const);
	const travel = r[end] - r[start] - 3 * thickness;
	const range = c.contrlMax - c.contrlMin;
	let pos = thickness;
	if (range !== 0) {
		const product = travel * (c.contrlValue - c.contrlMin);
		pos = Math.trunc(product / range);
		if (product % range > range >> 1) {
			pos++;
		}
	}
	r[start] += pos + thickness;
	r[end] = r[start] + thickness;
	r[across0]++;
	r[across1]--;
	return r;
}

function copyArrow(rows: number[], dst: Rect): void {
	const p = NewPtr(32);
	const bytes = bytesAt(p, 32);
	rows.forEach((w, i) => {
		bytes[i * 2] = w >> 8;
		bytes[i * 2 + 1] = w & 0xff;
	});
	const bm: BitMap = { baseAddr: p, rowBytes: 2, bounds: { top: 0, left: 0, bottom: 16, right: 16 } };
	CopyBits(bm, thePort.portBits, bm.bounds, dst, srcCopy, null);
	DisposPtr(p);
}

/** Draws a scroll bar, or one part of it (CDEF 1's drawCntl at $200). */
function drawScrollBar(c: ControlRecord, part: Integer): void {
	const r = c.contrlRect;
	const { vertical, thickness } = barShape(r);
	if (part === 0 || part === inUpButton) {
		const box = vertical ? { ...r, bottom: r.top + thickness } : { ...r, right: r.left + thickness };
		copyArrow(vertical ? (c.contrlHilite === inUpButton ? scrollArrows.upPressed : scrollArrows.up) : c.contrlHilite === inUpButton ? scrollArrows.leftPressed : scrollArrows.left, box);
	}
	if (part === 0 || part === inDownButton) {
		const box = vertical ? { ...r, top: r.bottom - thickness } : { ...r, left: r.right - thickness };
		copyArrow(vertical ? (c.contrlHilite === inDownButton ? scrollArrows.downPressed : scrollArrows.down) : c.contrlHilite === inDownButton ? scrollArrows.rightPressed : scrollArrows.right, box);
	}
	if (part !== 0 && part !== inThumb) {
		return;
	}
	const track = { ...r };
	if (vertical) {
		InsetRect(track, 1, thickness);
	} else {
		InsetRect(track, thickness, 1);
	}
	const active = scrollBarActive(c);
	FillRect(track, active ? (GetPattern(17) ?? gray) : white);
	if (active) {
		const thumb = thumbRect(c);
		FillRect(thumb, white);
		FrameRect(thumb);
	}
	FrameRect(r);
}

/** Which part of a scroll bar a point is in (CDEF 1's testCntl at $3FC). */
function testScrollBar(c: ControlRecord, pt: Point): Integer {
	if (c.contrlHilite === 254) {
		return 254;
	}
	if (!scrollBarActive(c) || !PtInRect(pt, c.contrlRect)) {
		return 0;
	}
	const r = c.contrlRect;
	const { vertical, thickness } = barShape(r);
	const along = vertical ? pt.v : pt.h;
	const [start, end] = vertical ? [r.top, r.bottom] : [r.left, r.right];
	if (along - start <= thickness) {
		return inUpButton;
	}
	if (end - along <= thickness) {
		return inDownButton;
	}
	const thumb = thumbRect(c);
	if (PtInRect(pt, thumb)) {
		return inThumb;
	}
	const [t0, t1] = vertical ? [thumb.top, thumb.bottom] : [thumb.left, thumb.right];
	return along >= t0 + ((t1 - t0) >> 1) ? inPageDown : inPageUp;
}

