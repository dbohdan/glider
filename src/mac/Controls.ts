// Port: the Control Manager (Inside Macintosh I, chapter 10, and V, chapter 12), with System 6's
// standard buttons (CDEF 0): push buttons, check boxes, and radio buttons.
//
// The geometry is measured from the oracle (Glider's dialogs on a Mac Plus): push buttons are
// rounded rectangles with 10-pixel corners and their title centered; check boxes and radio buttons
// are 12-pixel squares and circles 2 pixels in from the left, centered vertically, with the title
// 18 pixels in from the left. Titles are centered vertically on the line height.

import { getHost, mouse, TickCount, tickTime } from './OS.ts';
import {
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
	notPatBic,
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
		drawControl(theControl, inCheckBox);
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

/** Pascal `DrawControls`: draws all of a window's visible controls, the last created first. */
export function DrawControls(theWindow: WindowRecord): void {
	const all: ControlRecord[] = [];
	for (let c = theWindow.controlList; c !== null; c = c.nextControl) {
		all.push(c);
	}
	for (const c of all.reverse()) {
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
		switch (c.procID & 7) {
			case pushButProc:
				drawPushButton(c, colors);
				break;
			case checkBoxProc:
				drawCheckBox(c, part, colors, false);
				break;
			case radioButProc:
				drawCheckBox(c, part, colors, true);
				break;
		}
		if (c.contrlHilite === 255) {
			// An inactive control is dimmed.
			PenPat(gray);
			PenMode(notPatBic);
			PaintRect(r);
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
	const clip = NewRgn();
	GetClip(clip);
	const shape = NewRgn();
	OpenRgn();
	FrameRoundRect(r, 10, 10);
	CloseRgn(shape);
	SectRgn(shape, clip, shape);
	SetClip(shape);
	if (isColorPort(thePort)) {
		RGBForeColor(colors.body);
		PaintRoundRect(r, 10, 10);
		RGBBackColor(colors.body);
	} else {
		EraseRect(r);
	}
	foreColor(colors.frame);
	FrameRoundRect(r, 10, 10);
	InsetRgn(shape, 1, 1);
	SetClip(shape);
	foreColor(colors.text);
	drawLabel(c.contrlTitle, r, true);
	if (c.contrlHilite === inButton) {
		InvertRoundRect(r, 10, 10);
	}
	SetClip(clip);
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
	if (c.contrlHilite === inCheckBox) {
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
	let v = Math.trunc((r.top + r.bottom) / 2) - Math.trunc((lines.length * lineHeight - info.leading + 1) / 2) + info.ascent;
	for (const [first, count] of lines) {
		const h = centered ? Math.trunc((r.left + r.right) / 2) - Math.trunc(TextWidth(bytes, first, count) / 2) : r.left;
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
		const now = PtInRect(pt, theControl.contrlRect);
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

