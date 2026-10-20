// Port: the Window Manager (Inside Macintosh I, chapter 9, and V, chapter 13), as in System 6
// without MultiFinder. Executor's Window Manager (MIT license) shows what the books leave out.
//
// Windows are GrafPorts with a frame. The desktop is the gray region: the screen with rounded
// corners, less the menu bar. Each window's visRgn is its content within the gray region, less
// the windows in front of it. Uncovering part of a window erases it in the window's content color
// and adds it to its update region, which brings an update event.

import { GetMainDevice } from './Color.ts';
import { clearDepthChangeHooks, onDepthChange } from './Devices.ts';
import { activateEvt, type EventRecord, setWindowEventSource, updateEvt } from './Events.ts';
import { addressOf, forgetAddress, objectAt } from './Memory.ts';
import { DrawPicture, type Picture } from './Picture.ts';
import {
	black,
	type ColorTable,
	CopyBits,
	DiffRgn,
	DrawString,
	EmptyRgn,
	FillCRgn,
	FillRgn,
	FrameRect,
	FrameRoundRect,
	GrafPort,
	gray,
	hasColorQD,
	isColorPort,
	Line,
	LineTo,
	MoveTo,
	OffsetRgn,
	OpenCPort,
	OpenPort,
	OpenRgn,
	CloseRgn,
	ClosePort,
	PaintRect,
	PaintRgn,
	type Pattern,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	type PixPat,
	PtInRect,
	PtInRgn,
	FrameRgn,
	patXor,
	patCopy,
	type RGBColor,
	RGBBackColor,
	RGBForeColor,
	screenBits,
	SectRgn,
	SetClip,
	SetPort,
	srcCopy,
	srcOr,
	StringWidth,
	TextFont,
	TextMode,
	thePort,
	UnionRgn,
	white,
	XorRgn,
	ClipRect,
	parsePixPat,
	CopyRgn,
	SetEmptyRgn,
	EraseRgn,
	RectRgn,
} from './QuickDraw.ts';
import { rectRegion, Region } from './Region.ts';
import { GetResource } from './Resources.ts';
import { parseColorTable } from './Color.ts';
import { s16, s32 } from './Binary.ts';
import { currentModifiers, getHost, mouse, TickCount, tickTime } from './OS.ts';
import { pascalString } from './MacRoman.ts';
import type { ControlRecord } from './Controls.ts';
import type { Integer, LongInt, Point, Rect, Ref } from './Types.ts';

/** windowKind values. Negative kinds are desk accessories. */
export const dialogKind = 2;
export const userKind = 8;

/** Window definition IDs (procID): the WDEF's resource ID times 16 plus a variation code. */
export const documentProc = 0;
export const dBoxProc = 1;
export const plainDBox = 2;
export const altDBoxProc = 3;
export const noGrowDocProc = 4;
export const movableDBoxProc = 5;
export const zoomDocProc = 8;
export const zoomNoGrow = 12;
export const rDocProc = 16;

/** FindWindow results. */
export const inDesk = 0;
export const inMenuBar = 1;
export const inSysWindow = 2;
export const inContent = 3;
export const inDrag = 4;
export const inGrow = 5;
export const inGoAway = 6;
export const inZoomIn = 7;
export const inZoomOut = 8;

/** Window definition messages, and the results of wHit. */
export const wDraw = 0;
export const wHit = 1;
export const wCalcRgns = 2;
export const wNew = 3;
export const wDispose = 4;
export const wGrow = 5;
export const wDrawGIcon = 6;
export const wNoHit = 0;
export const wInContent = 1;
export const wInDrag = 2;
export const wInGrow = 3;
export const wInGoAway = 4;
export const wInZoomIn = 5;
export const wInZoomOut = 6;

/** Parts of a window color table ('wctb'). */
export const wContentColor = 0;
export const wFrameColor = 1;
export const wTextColor = 2;
export const wHiliteColor = 3;
export const wTitleBarColor = 4;

/** Pascal `WindowPtr(-1)` or `Pointer(-1)` as NewWindow's `behind`: in front of all windows. */
export const inFront = -1;

/** A window definition function (WDEF). */
export type WindowDefProc = (varCode: Integer, w: WindowRecord, message: Integer, param: LongInt) => LongInt;

/**
 * Port: window definitions that programs bring in their own 'WDEF' resources, by resource ID. The
 * port runs no 68000 code, so a program registers its definition's translation before making a
 * window with it (the Room Editor's tool window, WDEF 10); others are the System's (WDEF 0).
 */
const windowDefs = new Map<Integer, WindowDefProc>();

/** Port: makes a translated 'WDEF' the one GetNewWindow and NewWindow find for its resource ID. */
export function setWindowDef(id: Integer, proc: WindowDefProc | null): void {
	if (proc === null) {
		windowDefs.delete(id);
	} else {
		windowDefs.set(id, proc);
	}
}

/**
 * Pascal `WindowRecord` (and `CWindowRecord`): a port with a frame. WindowPtr, WindowPeek, and
 * their color versions are all WindowRecords; whether the port is a color port is in portVersion.
 */
export class WindowRecord extends GrafPort {
	windowKind: Integer = userKind;
	visible = false;
	hilited = false;
	goAwayFlag = false;
	spareFlag = false;
	/** The structure (frame and content) and content regions, in global coordinates. */
	strucRgn = new Region();
	contRgn = new Region();
	/** The part of the content to redraw, in global coordinates. */
	updateRgn = new Region();
	windowDefProc: WindowDefProc = standardWindowDef;
	/** Port: the procID's variation code, which Color QuickDraw keeps in the AuxWinRec. */
	varCode: Integer = 0;
	dataHandle: unknown = null;
	titleHandle = '';
	titleWidth: Integer = 0;
	controlList: ControlRecord | null = null;
	nextWindow: WindowRecord | null = null;
	windowPic: Picture | null = null;
	refCon: LongInt = 0;
	/** Port: the window's colors (AuxWinRec's awCTable); null for the default colors. */
	awCTable: ColorTable | null = null;
}

export type WindowPtr = WindowRecord;
export type WindowPeek = WindowRecord;
export type CWindowRecord = WindowRecord;
export type CWindowPtr = WindowRecord;
export type CWindowPeek = WindowRecord;

// ---------------------------------------------------------------------------------------------
// The Window Manager's globals (low memory)

let windowList: WindowRecord | null = null;
/** The desktop: the screen with rounded corners, less the menu bar. Programs may change it. */
const grayRgn = new Region();
/** The height of the menu bar; 0 while a program hides it. */
let mBarHeight: Integer = 20;
let wMgrPort = new GrafPort();
/** On Color QuickDraw, the Window Manager draws in a color port (WMgrCPort). */
let wMgrCPort: GrafPort | null = null;
let deskPattern: Pattern = gray;
let deskCPat: PixPat | null = null;
/** The default window colors ('wctb' 0). */
let defaultColors: RGBColor[] = defaultWindowColors();
/** Windows that are waiting for an activate or deactivate event. */
let curActivate: WindowRecord | null = null;
let curDeactive: WindowRecord | null = null;
/** The visRgn that BeginUpdate saved. */
const saveVisRgn = new Region();

/** Pascal `GetGrayRgn`, an inline read of the low memory global GrayRgn. */
export function GetGrayRgn(): Region {
	return grayRgn;
}

/** The low memory global MBarHeight, read by Glider's inline `GetMBarHeight`. */
export function GetMBarHeight(): Integer {
	return mBarHeight;
}

/** Glider's inline `SetMBarHeight` writes the low memory global. */
export function SetMBarHeight(height: Integer): void {
	mBarHeight = height;
}

/** The low memory global WindowList, read by Glider's inline `GetWindowList`: the frontmost window. */
export function GetWindowList(): WindowRecord | null {
	return windowList;
}

export function GetWMgrPort(): GrafPort {
	return wMgrPort;
}

export function GetCWMgrPort(): GrafPort | null {
	return wMgrCPort;
}

/** The port the Window Manager draws frames and the desktop in. */
function drawingPort(): GrafPort {
	return wMgrCPort ?? wMgrPort;
}

/** Port: the port the Menu Manager draws in: the Window Manager's (the color one on Color QuickDraw). */
export function screenDrawingPort(): GrafPort {
	return drawingPort();
}

/** Pascal `WindowPtr(theEvent.message)`: the window an update or activate event is for. */
export function eventWindow(message: LongInt): WindowRecord | null {
	const w = objectAt<object>(message);
	return w instanceof WindowRecord ? w : null;
}

// ---------------------------------------------------------------------------------------------
// Colors

function defaultWindowColors(): RGBColor[] {
	const c = (v: number): RGBColor => ({ red: v, green: v, blue: v });
	return [c(0xffff), c(0), c(0), c(0), c(0xffff)];
}

/** The colors of a window's parts, by part code. */
function windowColors(w: WindowRecord): RGBColor[] {
	const colors = defaultColors.map((c) => ({ ...c }));
	for (const spec of w.awCTable?.ctTable ?? []) {
		if (spec.value >= 0 && spec.value < colors.length) {
			colors[spec.value] = { ...spec.rgb };
		}
	}
	return colors;
}

/** Sets the pen to draw in a color: the color itself in a color port, black or white otherwise. */
function penColor(c: RGBColor): void {
	if (isColorPort(thePort)) {
		RGBForeColor(c);
		PenPat(black);
	} else {
		PenPat(c.red + c.green + c.blue >= 3 * 0x8000 ? white : black);
	}
}

/** Pascal `SetWinColor`: gives a window its own colors and redraws its frame. */
export function SetWinColor(w: WindowRecord, newColors: ColorTable): void {
	w.awCTable = newColors;
	if (isColorPort(w)) {
		const save = thePort;
		SetPort(w);
		RGBBackColor(windowColors(w)[wContentColor]!);
		if (w.visible) {
			const content = copyOf(w.contRgn);
			OffsetRgn(content, w.portBits.bounds.left, w.portBits.bounds.top);
			EraseRgn(content);
		}
		SetPort(save);
	}
	if (w.visible) {
		withDrawingPort(() => {
			SetClip(w.strucRgn);
			clipAbove(w);
			callWindowDef(w, wDraw, 0);
		});
	}
}

// ---------------------------------------------------------------------------------------------
// Initialization

/** The ID of the desktop pattern ('PAT ' and 'ppat'). */
export const deskPatID = 16;

/**
 * Pascal `InitWindows`: paints the screen as the Finder leaves it for an application: black
 * corners, an empty menu bar, and the desktop pattern.
 */
export function InitWindows(): void {
	const save = thePort;
	wMgrPort = new GrafPort();
	OpenPort(wMgrPort);
	wMgrCPort = null;
	if (hasColorQD && GetMainDevice() !== null) {
		wMgrCPort = new GrafPort();
		OpenCPort(wMgrCPort);
	}
	const pat = GetResource('PAT ', deskPatID);
	deskPattern = pat === null ? gray : [...pat.data.subarray(0, 8)];
	const ppat = hasColorQD ? GetResource('ppat', deskPatID) : null;
	deskCPat = ppat === null ? null : parsePixPat(ppat.data);
	const wctb = GetResource('wctb', 0);
	defaultColors = defaultWindowColors();
	if (wctb !== null) {
		for (const spec of parseColorTable(wctb.data).ctTable) {
			if (spec.value >= 0 && spec.value < defaultColors.length) {
				defaultColors[spec.value] = { ...spec.rgb };
			}
		}
	}
	windowList = null;
	curActivate = null;
	curDeactive = null;
	mBarHeight = 20;

	SetPort(drawingPort());
	const screen = screenBits.bounds;
	OpenRgn();
	FrameRoundRect(screen, 16, 16);
	CloseRgn(grayRgn);
	const menuBar = new Region();
	SectRgn(grayRgn, rectRegion({ top: screen.top, left: screen.left, bottom: screen.top + mBarHeight, right: screen.right }), menuBar);
	const corners = rectRegion(screen);
	DiffRgn(corners, grayRgn, corners);
	PenNormal();
	penColor({ red: 0, green: 0, blue: 0 });
	PaintRgn(corners);
	DiffRgn(grayRgn, menuBar, grayRgn);
	penColor({ red: 0xffff, green: 0xffff, blue: 0xffff });
	PaintRgn(menuBar);
	penColor({ red: 0, green: 0, blue: 0 });
	MoveTo(screen.left, screen.top + mBarHeight - 1);
	LineTo(screen.right - 1, screen.top + mBarHeight - 1);
	paintDesktop(grayRgn);
	SetClip(grayRgn);
	if (wMgrCPort !== null) {
		SetPort(wMgrPort);
		SetClip(grayRgn);
	}
	SetPort(save);
	setWindowEventSource({ activateEvent, updateEvent });
	clearDepthChangeHooks();
	onDepthChange(repaintScreen);
}

/** After the screen's depth changes: the corners, the desktop, and every window are redrawn. */
function repaintScreen(): void {
	withDrawingPort(() => {
		const screen = screenBits.bounds;
		ClipRect(screen);
		const world = new Region();
		OpenRgn();
		FrameRoundRect(screen, 16, 16);
		CloseRgn(world);
		const corners = rectRegion(screen);
		DiffRgn(corners, world, corners);
		PenNormal();
		penColor({ red: 0, green: 0, blue: 0 });
		PaintRgn(corners);
		SetClip(grayRgn);
	});
	PaintBehind(windowList, grayRgn);
}

/**
 * Low memory DeskHook (Inside Macintosh I-288): a procedure that paints the desktop in place of
 * the desk pattern, called in the Window Manager's port with the region to paint. The Finder
 * draws its desktop icons this way.
 */
let deskHook: ((rgn: Region) => void) | null = null;

/** Port: sets low memory DeskHook. */
export function setDeskHook(hook: ((rgn: Region) => void) | null): void {
	deskHook = hook;
}

function paintDesktop(rgn: Region): void {
	if (deskHook !== null) {
		deskHook(rgn);
	} else {
		paintDeskPattern(rgn);
	}
}

/** Port: paints a region with the desk pattern (low memory DeskPattern), as the Window Manager does without a DeskHook. */
export function paintDeskPattern(rgn: Region): void {
	if (deskCPat !== null && isColorPort(thePort) && thePort.portPixMap.pixelSize > 2) {
		FillCRgn(rgn, deskCPat);
	} else {
		FillRgn(rgn, deskPattern);
	}
}

/** Runs drawing in the Window Manager's port, then restores the current port. */
function withDrawingPort(draw: () => void): void {
	const save = thePort;
	SetPort(drawingPort());
	draw();
	SetPort(save);
}

function copyOf(rgn: Region): Region {
	const r = new Region();
	CopyRgn(rgn, r);
	return r;
}

// ---------------------------------------------------------------------------------------------
// Creating and disposing of windows

/**
 * Pascal `NewWindow`. The storage argument is always nil in the port: the record is allocated.
 * `behind` is a window, nil (behind all windows), or inFront.
 */
export function NewWindow(
	_wStorage: null,
	boundsRect: Rect,
	title: string,
	visible: boolean,
	procID: Integer,
	behind: WindowRecord | null | typeof inFront,
	goAwayFlag: boolean,
	refCon: LongInt,
): WindowRecord {
	return newWindow(false, boundsRect, title, visible, procID, behind, goAwayFlag, refCon);
}

/** Pascal `NewCWindow`: a window with a color port. */
export function NewCWindow(
	_wStorage: null,
	boundsRect: Rect,
	title: string,
	visible: boolean,
	procID: Integer,
	behind: WindowRecord | null | typeof inFront,
	goAwayFlag: boolean,
	refCon: LongInt,
): WindowRecord {
	return newWindow(true, boundsRect, title, visible, procID, behind, goAwayFlag, refCon);
}

/** Port: makes a window, or the window part of a dialog (`w` is then the dialog's record). */
export function newWindow(
	color: boolean,
	boundsRect: Rect,
	title: string,
	visible: boolean,
	procID: Integer,
	behind: WindowRecord | null | typeof inFront,
	goAwayFlag: boolean,
	refCon: LongInt,
	w: WindowRecord = new WindowRecord(),
): WindowRecord {
	const save = thePort;
	if (behind === inFront) {
		w.nextWindow = windowList;
		windowList = w;
	} else if (behind === null) {
		w.nextWindow = null;
		if (windowList === null) {
			windowList = w;
		} else {
			let t = windowList;
			while (t.nextWindow !== null) {
				t = t.nextWindow;
			}
			t.nextWindow = w;
		}
	} else {
		w.nextWindow = behind.nextWindow;
		behind.nextWindow = w;
	}
	w.windowKind = userKind;
	w.visible = visible;
	const front = firstVisible(windowList);
	w.hilited = visible && front === w;
	let deactivate: WindowRecord | null = null;
	if (w.hilited) {
		curActivate = w;
		deactivate = firstHilited(w.nextWindow);
	}
	w.goAwayFlag = goAwayFlag;
	w.spareFlag = false;
	w.dataHandle = null;
	w.strucRgn = new Region();
	w.contRgn = new Region();
	w.updateRgn = new Region();
	w.windowDefProc = windowDefs.get(procID >> 4) ?? standardWindowDef;
	w.varCode = procID & 15;
	w.awCTable = null;
	w.titleHandle = title;

	if (color && hasColorQD && GetMainDevice() !== null) {
		OpenCPort(w);
	} else {
		OpenPort(w);
	}
	w.portBits.bounds = {
		top: w.portBits.bounds.top - boundsRect.top,
		left: w.portBits.bounds.left - boundsRect.left,
		bottom: w.portBits.bounds.bottom - boundsRect.top,
		right: w.portBits.bounds.right - boundsRect.left,
	};
	w.portRect = { top: 0, left: 0, bottom: boundsRect.bottom - boundsRect.top, right: boundsRect.right - boundsRect.left };
	w.titleWidth = StringWidth(title);
	TextFont(1); // applFont
	w.controlList = null;
	w.windowPic = null;
	w.refCon = refCon;
	callWindowDef(w, wNew, 0);
	if (w.visible) {
		withDrawingPort(() => {
			callWindowDef(w, wCalcRgns, 0);
			SetClip(w.strucRgn);
			clipAbove(w);
			PenPat(black);
			callWindowDef(w, wDraw, 0);
			calcVis(w);
			eraseContent(w, w.contRgn);
			CopyRgn(w.contRgn, w.updateRgn);
			if (w.nextWindow !== null) {
				CalcVisBehind(w.nextWindow, w.strucRgn);
			}
		});
	} else {
		SetEmptyRgn(w.visRgn);
	}
	if (deactivate !== null) {
		HiliteWindow(deactivate, false);
		curDeactive = deactivate;
	}
	SetPort(save);
	return w;
}

/** The fields of a 'WIND' resource. */
export interface WindowTemplate {
	boundsRect: Rect;
	procID: Integer;
	visible: boolean;
	goAwayFlag: boolean;
	refCon: LongInt;
	title: string;
}

export function parseWindowTemplate(d: Uint8Array): WindowTemplate {
	return {
		boundsRect: { top: s16(d, 0), left: s16(d, 2), bottom: s16(d, 4), right: s16(d, 6) },
		procID: s16(d, 8),
		visible: d[10] !== 0,
		goAwayFlag: d[12] !== 0,
		refCon: s32(d, 14),
		title: pascalString(d, 18),
	};
}

/** Pascal `GetNewWindow`; nil if there is no such 'WIND' resource. */
export function GetNewWindow(windowID: Integer, wStorage: null, behind: WindowRecord | null | typeof inFront): WindowRecord | null {
	const h = GetResource('WIND', windowID);
	if (h === null) {
		return null;
	}
	const t = parseWindowTemplate(h.data);
	return NewWindow(wStorage, t.boundsRect, t.title, t.visible, t.procID, behind, t.goAwayFlag, t.refCon);
}

/** Pascal `GetNewCWindow`: also takes the window's colors from a 'wctb' of the same ID. */
export function GetNewCWindow(windowID: Integer, wStorage: null, behind: WindowRecord | null | typeof inFront): WindowRecord | null {
	const h = GetResource('WIND', windowID);
	if (h === null) {
		return null;
	}
	const t = parseWindowTemplate(h.data);
	const w = NewCWindow(wStorage, t.boundsRect, t.title, t.visible, t.procID, behind, t.goAwayFlag, t.refCon);
	const wctb = GetResource('wctb', windowID);
	if (wctb !== null) {
		const save = thePort;
		SetWinColor(w, parseColorTable(wctb.data));
		SetPort(save);
	}
	return w;
}

/**
 * Pascal `CloseWindow`: removes a window from the screen and the window list. As on a Mac Plus,
 * closing the current port leaves the Window Manager's port current.
 */
export function CloseWindow(w: WindowRecord): void {
	if (FrontWindow() === w) {
		const next = firstVisible(w.nextWindow);
		if (next !== null) {
			HiliteWindow(next, true);
			curActivate = next;
		}
	}
	if (windowList === w) {
		windowList = w.nextWindow;
	} else {
		let t = windowList;
		while (t !== null && t.nextWindow !== w) {
			t = t.nextWindow;
		}
		if (t !== null) {
			t.nextWindow = w.nextWindow;
		}
	}
	const save = thePort === w ? wMgrPort : thePort;
	SetPort(drawingPort());
	SetClip(grayRgn);
	if (w.visible) {
		PaintBehind(w.nextWindow, w.strucRgn);
		if (w.nextWindow !== null) {
			CalcVisBehind(w.nextWindow, w.strucRgn);
		}
	}
	w.controlList = null;
	ClosePort(w);
	SetPort(save);
	if (curActivate === w) {
		curActivate = null;
	}
	if (curDeactive === w) {
		curDeactive = null;
	}
	callWindowDef(w, wDispose, 0);
	forgetAddress(w);
}

/** Pascal `DisposeWindow`: CloseWindow, and the record's memory goes back. */
export function DisposeWindow(w: WindowRecord): void {
	CloseWindow(w);
}

// ---------------------------------------------------------------------------------------------
// The window list

function firstVisible(w: WindowRecord | null): WindowRecord | null {
	while (w !== null && !w.visible) {
		w = w.nextWindow;
	}
	return w;
}

function firstHilited(w: WindowRecord | null): WindowRecord | null {
	while (w !== null && !w.hilited) {
		w = w.nextWindow;
	}
	return w;
}

/** Pascal `FrontWindow`: the frontmost visible window, or nil. */
export function FrontWindow(): WindowRecord | null {
	return firstVisible(windowList);
}

/** Pascal `HiliteWindow`: redraws the frame when the highlighting changes. */
export function HiliteWindow(w: WindowRecord | null, fHilite: boolean): void {
	if (w === null || w.hilited === fHilite) {
		return;
	}
	w.hilited = fHilite;
	withDrawingPort(() => {
		SetClip(w.strucRgn);
		clipAbove(w);
		callWindowDef(w, wDraw, 0);
	});
}

/** Pascal `BringToFront`: moves a window to the front without changing its highlighting. */
export function BringToFront(w: WindowRecord): void {
	if (windowList === w) {
		return;
	}
	let t = windowList;
	while (t !== null && t.nextWindow !== w) {
		t = t.nextWindow;
	}
	if (t === null) {
		return;
	}
	t.nextWindow = w.nextWindow;
	w.nextWindow = windowList;
	windowList = w;
	if (w.visible) {
		withDrawingPort(() => {
			SetClip(grayRgn);
			const hidden = copyOf(w.visRgn);
			OffsetRgn(hidden, -w.portBits.bounds.left, -w.portBits.bounds.top);
			// The parts of the structure that were covered: the frame, and content outside the visRgn.
			XorRgn(w.strucRgn, hidden, hidden);
			PaintOne(w, hidden);
			CalcVisBehind(w, hidden);
		});
	}
}

/** Pascal `SelectWindow`: brings a window to the front, highlights it, and activates it. */
export function SelectWindow(w: WindowRecord): void {
	const active = FrontWindow();
	if (active !== w) {
		HiliteWindow(active, false);
		curDeactive = active;
		curActivate = w;
	}
	BringToFront(w);
	HiliteWindow(w, true);
}

/** Pascal `SendBehind`; nil sends the window to the back. */
export function SendBehind(w: WindowRecord, behindWindow: WindowRecord | null): void {
	const oldFront = FrontWindow();
	if (oldFront === w) {
		const next = firstVisible(w.nextWindow);
		if (next !== null) {
			SelectWindow(next);
		}
	}
	// Unlink, then link after behindWindow (or at the end).
	if (windowList === w) {
		windowList = w.nextWindow;
	} else {
		let t = windowList;
		while (t !== null && t.nextWindow !== w) {
			t = t.nextWindow;
		}
		if (t !== null) {
			t.nextWindow = w.nextWindow;
		}
	}
	if (behindWindow === null) {
		w.nextWindow = null;
		if (windowList === null) {
			windowList = w;
		} else {
			let t = windowList;
			while (t.nextWindow !== null) {
				t = t.nextWindow;
			}
			t.nextWindow = w;
		}
	} else {
		w.nextWindow = behindWindow.nextWindow;
		behindWindow.nextWindow = w;
	}
	if (w.visible) {
		withDrawingPort(() => {
			SetClip(grayRgn);
			const exposed = copyOf(w.strucRgn);
			// Windows that were behind w get back what w covered.
			PaintBehind(windowList, exposed);
			CalcVisBehind(windowList!, exposed);
		});
	}
}

/** Pascal `ShowHide`: shows or hides a window without changing the window list or activation. */
export function ShowHide(w: WindowRecord, showFlag: boolean): void {
	if (showFlag && !w.visible) {
		w.visible = true;
		withDrawingPort(() => {
			callWindowDef(w, wCalcRgns, 0);
			SetClip(w.strucRgn);
			clipAbove(w);
			const exposed = copyOf(thePort.clipRgn);
			CalcVisBehind(w, exposed);
			callWindowDef(w, wDraw, 0);
			CopyRgn(w.contRgn, w.updateRgn);
			eraseContent(w, w.contRgn);
		});
	} else if (!showFlag && w.visible) {
		w.visible = false;
		withDrawingPort(() => {
			SetClip(grayRgn);
			SetEmptyRgn(w.visRgn);
			PaintBehind(w.nextWindow, w.strucRgn);
			if (w.nextWindow !== null) {
				CalcVisBehind(w.nextWindow, w.strucRgn);
			}
		});
	}
}

export function HideWindow(w: WindowRecord): void {
	if (!w.visible) {
		return;
	}
	if (w === FrontWindow()) {
		const next = firstVisible(w.nextWindow);
		if (next !== null) {
			SelectWindow(next);
		} else {
			curDeactive = w;
		}
		w.hilited = false;
	}
	ShowHide(w, false);
}

/** Pascal `ShowWindow`: if the window becomes the front window, it is highlighted and activated. */
export function ShowWindow(w: WindowRecord): void {
	if (w.visible) {
		return;
	}
	ShowHide(w, true);
	if (FrontWindow() === w && !w.hilited) {
		HiliteWindow(w, true);
		curActivate = w;
		const previous = firstHilited(w.nextWindow);
		HiliteWindow(previous, false);
		curDeactive = previous;
	}
}

// ---------------------------------------------------------------------------------------------
// Titles and reference values

export function SetWTitle(w: WindowRecord, title: string): void {
	w.titleHandle = title;
	const save = thePort;
	SetPort(w);
	w.titleWidth = StringWidth(title);
	SetPort(save);
	if (w.visible) {
		withDrawingPort(() => {
			SetClip(w.strucRgn);
			clipAbove(w);
			callWindowDef(w, wDraw, 0);
		});
	}
}

/** Pascal `GetWTitle(theWindow, var title)`. */
export function GetWTitle(w: WindowRecord): string {
	return w.titleHandle;
}

export function SetWRefCon(w: WindowRecord, data: LongInt): void {
	w.refCon = data;
}

export function GetWRefCon(w: WindowRecord): LongInt {
	return w.refCon;
}

export function SetWindowPic(w: WindowRecord, pic: Picture | null): void {
	w.windowPic = pic;
}

export function GetWindowPic(w: WindowRecord): Picture | null {
	return w.windowPic;
}

// ---------------------------------------------------------------------------------------------
// Moving and sizing

/** Pascal `MoveWindow`: moves a window's top left corner to (hGlobal, vGlobal), copying its pixels. */
export function MoveWindow(w: WindowRecord, hGlobal: Integer, vGlobal: Integer, front: boolean): void {
	const save = thePort;
	const dh = hGlobal + w.portBits.bounds.left - w.portRect.left;
	const dv = vGlobal + w.portBits.bounds.top - w.portRect.top;
	let movePart: Region | null = null;
	let behindPart: Region | null = null;
	if (w.visible) {
		SetPort(drawingPort());
		ClipRect(screenBits.bounds);
		clipAbove(w);
		movePart = new Region();
		SectRgn(thePort.clipRgn, w.strucRgn, movePart);
		behindPart = copyOf(movePart);
		const from = w.strucRgn.rgnBBox;
		const to = { top: from.top + dv, left: from.left + dh, bottom: from.bottom + dv, right: from.right + dh };
		OffsetRgn(movePart, dh, dv);
		SectRgn(movePart, thePort.clipRgn, movePart);
		ClipRect(screenBits.bounds);
		CopyBits(thePort.portBits, thePort.portBits, from, to, srcCopy, movePart);
	}
	OffsetRgn(w.strucRgn, dh, dv);
	OffsetRgn(w.contRgn, dh, dv);
	OffsetRgn(w.updateRgn, dh, dv);
	const b = w.portBits.bounds;
	w.portBits.bounds = { top: b.top - dv, left: b.left - dh, bottom: b.bottom - dv, right: b.right - dh };
	if (w.visible && movePart !== null && behindPart !== null) {
		ClipRect(screenBits.bounds);
		clipAbove(w);
		const updatePart = new Region();
		DiffRgn(w.strucRgn, movePart, updatePart);
		SectRgn(thePort.clipRgn, updatePart, updatePart);
		DiffRgn(behindPart, movePart, behindPart);
		DiffRgn(behindPart, updatePart, behindPart);
		PaintOne(w, updatePart);
		PaintBehind(w.nextWindow, behindPart);
		CalcVisBehind(w, updatePart);
		if (w.nextWindow !== null) {
			CalcVisBehind(w.nextWindow, behindPart);
			CalcVisBehind(w.nextWindow, movePart);
		}
	}
	if (front) {
		SelectWindow(w);
	}
	SetPort(save);
}

/** Pascal `SizeWindow`: with fUpdate, the whole new content is to be redrawn. */
export function SizeWindow(w: WindowRecord, width: Integer, height: Integer, fUpdate: boolean): void {
	if (width === 0 && height === 0) {
		return;
	}
	const oldStructure = copyOf(w.strucRgn);
	const oldContent = copyOf(w.contRgn);
	w.portRect.right = w.portRect.left + width;
	w.portRect.bottom = w.portRect.top + height;
	withDrawingPort(() => {
		callWindowDef(w, wCalcRgns, 0);
		if (w.visible) {
			drawNew(w, oldStructure, oldContent, fUpdate);
		}
	});
}

/** Pascal `DrawNew` after SaveOld: redraws what changed in a window's regions. */
function drawNew(w: WindowRecord, oldStructure: Region, oldContent: Region, update: boolean): void {
	const r1 = new Region();
	const r2 = new Region();
	XorRgn(w.strucRgn, oldStructure, r1);
	XorRgn(oldContent, w.contRgn, r2);
	UnionRgn(r1, r2, r2);
	SetClip(w.strucRgn);
	clipAbove(w);
	callWindowDef(w, wDraw, 0);
	PaintBehind(w, r2);
	CalcVisBehind(w, r2);
	if (update) {
		CopyRgn(w.contRgn, w.updateRgn);
	}
}

// ---------------------------------------------------------------------------------------------
// Painting and visible regions

/** Pascal `ClipAbove`: limits the drawing port's clipRgn to the gray region less the windows in front of w. */
function clipAbove(w: WindowRecord | null): void {
	const clip = thePort.clipRgn;
	SectRgn(clip, grayRgn, clip);
	for (let t = windowList; t !== null && t !== w; t = t.nextWindow) {
		if (t.visible) {
			DiffRgn(clip, t.strucRgn, clip);
		}
	}
}

/** Pascal `ClipAbove`, for programs: clips the Window Manager's port. */
export function ClipAbove(w: WindowRecord): void {
	withDrawingPort(() => clipAbove(w));
}

/** Erases part of a window's content in its content color, in the drawing port. */
function eraseContent(w: WindowRecord, rgn: Region): void {
	const port = thePort;
	const clip = copyOf(port.clipRgn);
	SectRgn(clip, rgn, port.clipRgn);
	PenNormal();
	penColor(windowColors(w)[wContentColor]!);
	PaintRect(screenBits.bounds);
	CopyRgn(clip, port.clipRgn);
	if (isColorPort(port)) {
		RGBForeColor({ red: 0, green: 0, blue: 0 });
	}
}

/**
 * Pascal `PaintOne`: redraws the part of a window's frame within clobberedRgn, and erases the part
 * of its content there, adding it to the update region. A nil window means the desktop.
 */
export function PaintOne(w: WindowRecord | null, clobberedRgn: Region): void {
	withDrawingPort(() => {
		if (w !== null) {
			SetClip(w.strucRgn);
		} else {
			ClipRect(screenBits.bounds);
		}
		clipAbove(w);
		SectRgn(thePort.clipRgn, clobberedRgn, thePort.clipRgn);
		if (w !== null) {
			const rh = new Region();
			SectRgn(thePort.clipRgn, w.strucRgn, rh);
			if (!EmptyRgn(rh)) {
				callWindowDef(w, wDraw, 0);
				SectRgn(thePort.clipRgn, w.contRgn, rh);
				if (!EmptyRgn(rh)) {
					UnionRgn(rh, w.updateRgn, w.updateRgn);
					eraseContent(w, rh);
				}
			}
		} else if (!EmptyRgn(thePort.clipRgn)) {
			PenNormal();
			paintDesktop(clobberedRgn);
		}
	});
}

/** Pascal `PaintBehind`: PaintOne for startWindow, the windows behind it, and the desktop. */
export function PaintBehind(startWindow: WindowRecord | null, clobberedRgn: Region): void {
	const rh = copyOf(clobberedRgn);
	const test = new Region();
	for (let w = startWindow; w !== null; w = w.nextWindow) {
		if (!w.visible) {
			continue;
		}
		SectRgn(rh, w.strucRgn, test);
		if (!EmptyRgn(test)) {
			PaintOne(w, rh);
			DiffRgn(rh, w.strucRgn, rh);
			if (EmptyRgn(rh)) {
				break;
			}
		}
	}
	if (!EmptyRgn(rh)) {
		PaintOne(null, rh);
	}
}

/** Pascal `CalcVis`: a window's visRgn is its content within the gray region, less the windows in front. */
export function CalcVis(w: WindowRecord): void {
	calcVis(w);
}

function calcVis(w: WindowRecord): void {
	if (!w.visible) {
		return;
	}
	SectRgn(grayRgn, w.contRgn, w.visRgn);
	for (let t = windowList; t !== null && t !== w; t = t.nextWindow) {
		if (t.visible) {
			DiffRgn(w.visRgn, t.strucRgn, w.visRgn);
		}
	}
	OffsetRgn(w.visRgn, w.portBits.bounds.left, w.portBits.bounds.top);
}

/** Pascal `CalcVisBehind`: recalculates the visRgns of startWindow and the windows behind it that clobberedRgn touches. */
export function CalcVisBehind(startWindow: WindowRecord | null, clobberedRgn: Region): void {
	if (startWindow === null) {
		return;
	}
	const rh = copyOf(clobberedRgn);
	const test = new Region();
	calcVis(startWindow);
	for (let w = startWindow.nextWindow; w !== null; w = w.nextWindow) {
		if (!w.visible) {
			continue;
		}
		SectRgn(rh, w.strucRgn, test);
		if (!EmptyRgn(test)) {
			calcVis(w);
			DiffRgn(rh, w.strucRgn, rh);
			if (EmptyRgn(rh)) {
				break;
			}
		}
	}
}

// ---------------------------------------------------------------------------------------------
// Updates

/** Pascal `InvalRect`: adds a rectangle in the current port's coordinates to its update region. */
export function InvalRect(badRect: Rect): void {
	const w = thePort;
	if (w instanceof WindowRecord) {
		const r = rectRegion(badRect);
		OffsetRgn(r, -w.portBits.bounds.left, -w.portBits.bounds.top);
		UnionRgn(r, w.updateRgn, w.updateRgn);
	}
}

export function InvalRgn(badRgn: Region): void {
	const w = thePort;
	if (w instanceof WindowRecord) {
		const r = copyOf(badRgn);
		OffsetRgn(r, -w.portBits.bounds.left, -w.portBits.bounds.top);
		UnionRgn(r, w.updateRgn, w.updateRgn);
	}
}

export function ValidRect(goodRect: Rect): void {
	const w = thePort;
	if (w instanceof WindowRecord) {
		const r = rectRegion(goodRect);
		OffsetRgn(r, -w.portBits.bounds.left, -w.portBits.bounds.top);
		DiffRgn(w.updateRgn, r, w.updateRgn);
	}
}

export function ValidRgn(goodRgn: Region): void {
	const w = thePort;
	if (w instanceof WindowRecord) {
		const r = copyOf(goodRgn);
		OffsetRgn(r, -w.portBits.bounds.left, -w.portBits.bounds.top);
		DiffRgn(w.updateRgn, r, w.updateRgn);
	}
}

/** Pascal `BeginUpdate`: limits the visRgn to the update region, which becomes empty. */
export function BeginUpdate(w: WindowRecord): void {
	CopyRgn(w.visRgn, saveVisRgn);
	const update = copyOf(w.updateRgn);
	OffsetRgn(update, w.portBits.bounds.left, w.portBits.bounds.top);
	SectRgn(update, saveVisRgn, w.visRgn);
	SetEmptyRgn(w.updateRgn);
}

/** Pascal `EndUpdate`: restores the visRgn. */
export function EndUpdate(w: WindowRecord): void {
	CopyRgn(saveVisRgn, w.visRgn);
}

/** The next update event, for the Event Manager: the frontmost visible window with something to update. */
function updateEvent(): EventRecord | null {
	for (let w = windowList; w !== null; w = w.nextWindow) {
		if (!w.visible || EmptyRgn(w.updateRgn)) {
			continue;
		}
		if (w.windowPic !== null) {
			const save = thePort;
			SetPort(w);
			BeginUpdate(w);
			DrawPicture(w.windowPic, w.portRect);
			EndUpdate(w);
			SetPort(save);
			continue;
		}
		return { what: updateEvt, message: addressOf(w), when: TickCount(), where: { ...mouse.where }, modifiers: currentModifiers() };
	}
	return null;
}

/** The next activate or deactivate event, for the Event Manager: deactivation comes first. */
function activateEvent(remove: boolean): EventRecord | null {
	const w = curDeactive ?? curActivate;
	if (w === null) {
		return null;
	}
	const activating = curDeactive === null;
	if (remove) {
		if (activating) {
			curActivate = null;
		} else {
			curDeactive = null;
		}
	}
	const modifiers = activating ? currentModifiers() | 1 : currentModifiers() & ~1;
	return { what: activateEvt, message: addressOf(w), when: TickCount(), where: { ...mouse.where }, modifiers };
}

// ---------------------------------------------------------------------------------------------
// The mouse

/** Pascal `FindWindow(thePt, var whichWindow)`: which part of which window a global point is in. */
export function FindWindow(thePt: Point, whichWindow: Ref<WindowRecord | null>): Integer {
	whichWindow.v = null;
	const screen = screenBits.bounds;
	if (mBarHeight > 0 && thePt.v >= screen.top && thePt.v < screen.top + mBarHeight && thePt.h >= screen.left && thePt.h < screen.right) {
		return inMenuBar;
	}
	for (let w = windowList; w !== null; w = w.nextWindow) {
		if (w.visible && PtInRgn(thePt, w.strucRgn)) {
			whichWindow.v = w;
			if (w.windowKind < 0) {
				return inSysWindow;
			}
			const hit = callWindowDef(w, wHit, ((thePt.v & 0xffff) << 16) | (thePt.h & 0xffff));
			return hit === wNoHit ? inDesk : hit + 2;
		}
	}
	return inDesk;
}

// ---------------------------------------------------------------------------------------------
// The standard window definition (WDEF 0)

function callWindowDef(w: WindowRecord, message: Integer, param: LongInt): LongInt {
	if (message === wDraw) {
		// Port: a definition draws with the pen as the Window Manager's port has it, normal: the
		// Room Editor's tool window (WDEF 10) frames its parts without setting the pen (seen in
		// the oracle). The port's own drawing in that port leaves the pen otherwise.
		PenNormal();
	}
	return w.windowDefProc(w.varCode, w, message, param);
}

/** The content rectangle of a window in global coordinates. */
function globalContent(w: WindowRecord): Rect {
	const dh = -w.portBits.bounds.left;
	const dv = -w.portBits.bounds.top;
	const r = w.portRect;
	return { top: r.top + dv, left: r.left + dh, bottom: r.bottom + dv, right: r.right + dh };
}

function outset(r: Rect, d: number): Rect {
	return { top: r.top - d, left: r.left - d, bottom: r.bottom + d, right: r.right + d };
}

/**
 * The System's standard window definition for document windows and dialog boxes.
 * Port: dialog boxes are drawn as the oracle shows them on both machines; document windows follow
 * Executor's geometry but for the shadow, checked against the oracle on the Room Editor's window
 * (noGrowDocProc) inactive and active; its title bar's stripes and close box are not yet.
 */
export function standardWindowDef(varCode: Integer, w: WindowRecord, message: Integer, param: LongInt): LongInt {
	const isDocument = varCode === documentProc || varCode === noGrowDocProc || (varCode & 8) !== 0;
	switch (message) {
		case wCalcRgns: {
			const c = globalContent(w);
			RectRgn(w.contRgn, c);
			if (isDocument) {
				RectRgn(w.strucRgn, { top: c.top - 19, left: c.left - 1, bottom: c.bottom + 2, right: c.right + 2 });
			} else if (varCode === dBoxProc || varCode === movableDBoxProc) {
				RectRgn(w.strucRgn, outset(c, 8));
			} else if (varCode === altDBoxProc) {
				const s = rectRegion(outset(c, 1));
				UnionRgn(s, rectRegion({ top: c.top + 1, left: c.left + 1, bottom: c.bottom + 3, right: c.right + 3 }), s);
				CopyRgn(s, w.strucRgn);
			} else {
				RectRgn(w.strucRgn, outset(c, 1));
			}
			return 0;
		}
		case wDraw:
			if (w.visible) {
				drawFrame(w, varCode, isDocument);
			}
			return 0;
		case wHit: {
			const pt = { v: param >> 16, h: (param << 16) >> 16 };
			if (PtInRgn(pt, w.contRgn)) {
				return wInContent;
			}
			if (isDocument && PtInRgn(pt, w.strucRgn)) {
				const c = globalContent(w);
				if (pt.v < c.top) {
					if (w.hilited && w.goAwayFlag && pt.h >= c.left + 8 && pt.h < c.left + 21 && pt.v >= c.top - 16 && pt.v < c.top - 3) {
						return wInGoAway;
					}
					return wInDrag;
				}
			}
			return wNoHit;
		}
		default:
			return 0;
	}
}

function drawFrame(w: WindowRecord, varCode: Integer, isDocument: boolean): void {
	const colors = windowColors(w);
	const frameColor = colors[wFrameColor]!;
	const contentColor = colors[wContentColor]!;
	const c = globalContent(w);
	PenNormal();
	PenSize(1, 1);
	PenMode(patCopy);
	if (isDocument) {
		drawDocumentFrame(w, c, colors);
	} else if (varCode === dBoxProc || varCode === movableDBoxProc) {
		// A line in the frame color, two pixels of the content color, two of the frame color, and three
		// of the content color.
		const rings = [frameColor, contentColor, contentColor, frameColor, frameColor, contentColor, contentColor, contentColor];
		rings.forEach((color, i) => {
			penColor(color);
			FrameRect(outset(c, 8 - i));
		});
	} else if (varCode === altDBoxProc) {
		penColor(frameColor);
		FrameRect(outset(c, 1));
		PenSize(2, 2);
		MoveTo(c.left + 1, c.bottom + 1);
		LineTo(c.right + 1, c.bottom + 1);
		MoveTo(c.right + 1, c.top + 1);
		LineTo(c.right + 1, c.bottom);
		PenSize(1, 1);
	} else {
		penColor(frameColor);
		FrameRect(outset(c, 1));
	}
	if (isColorPort(thePort)) {
		RGBForeColor({ red: 0, green: 0, blue: 0 });
		RGBBackColor({ red: 0xffff, green: 0xffff, blue: 0xffff });
	}
	PenNormal();
}

function drawDocumentFrame(w: WindowRecord, c: Rect, colors: RGBColor[]): void {
	const titleBar = { top: c.top - 19, left: c.left - 1, bottom: c.top, right: c.right + 1 };
	penColor(colors[wTitleBarColor]!);
	PaintRect(titleBar);
	penColor(colors[wFrameColor]!);
	FrameRect({ ...titleBar, bottom: c.bottom + 1 });
	MoveTo(c.left, c.top - 1);
	LineTo(c.right, c.top - 1);
	// The shadow: the frame one pixel wider and taller, from its top row and its left column (seen
	// in the oracle on the Room Editor's window).
	MoveTo(c.left - 1, c.bottom + 1);
	LineTo(c.right + 1, c.bottom + 1);
	MoveTo(c.right + 1, c.top - 19);
	LineTo(c.right + 1, c.bottom);
	if (w.hilited) {
		for (let v = c.top - 15; v <= c.top - 5; v += 2) {
			MoveTo(c.left + 1, v);
			LineTo(c.right - 2, v);
		}
	}
	if (w.titleWidth > 0) {
		const start = Math.max(c.left + (w.hilited && w.goAwayFlag ? 28 : 0), c.left + Math.trunc((c.right - c.left - w.titleWidth) / 2) - 6);
		penColor(colors[wTitleBarColor]!);
		PaintRect({ top: c.top - 16, left: start, bottom: c.top - 2, right: start + w.titleWidth + 12 });
		penColor(colors[wTextColor]!);
		TextFont(0);
		TextMode(srcOr);
		MoveTo(start + 6, c.top - 5);
		DrawString(w.titleHandle);
	}
	if (w.hilited && w.goAwayFlag) {
		penColor(colors[wTitleBarColor]!);
		PaintRect({ top: c.top - 16, left: c.left + 7, bottom: c.top - 3, right: c.left + 22 });
		penColor(colors[wFrameColor]!);
		FrameRect({ top: c.top - 15, left: c.left + 8, bottom: c.top - 4, right: c.left + 19 });
	}
}

/** Port: draws the menu bar's background, for the Menu Manager: white within the screen's rounded corners, with a line below. */
export function menuBarRegion(): Region {
	const screen = screenBits.bounds;
	const save = thePort;
	SetPort(drawingPort());
	const world = new Region();
	OpenRgn();
	FrameRoundRect(screen, 16, 16);
	CloseRgn(world);
	SetPort(save);
	const bar = rectRegion({ top: screen.top, left: screen.left, bottom: screen.top + mBarHeight, right: screen.right });
	SectRgn(world, bar, bar);
	return bar;
}

/** Port: for the Menu Manager, runs drawing in the Window Manager's port with the clip set to the whole screen. */
export function drawInScreenPort(draw: () => void): void {
	withDrawingPort(() => {
		const clip = copyOf(thePort.clipRgn);
		ClipRect(screenBits.bounds);
		draw();
		SetClip(clip);
	});
}

// ---------------------------------------------------------------------------------------------
// Dragging and the close box

/** Command-key bit in an event's or the keyboard's modifiers. */
const cmdKeyBit = 0x0100;

/** Whether the pointer is the same as another. */
const samePoint = (a: Point, b: Point): boolean => a.v === b.v && a.h === b.h;

/** Pins a point into a rectangle, as PinRect does (the bottom and right edges are outside it). */
function pinned(pt: Point, r: Rect): Point {
	return { v: Math.min(Math.max(pt.v, r.top), r.bottom - 1), h: Math.min(Math.max(pt.h, r.left), r.right - 1) };
}

/**
 * Pascal `DragGrayRgn`: drags a gray outline of a region (in global coordinates) in the Window
 * Manager's port while the button is down. The mouse is pinned into limitRect; outside slopRect the
 * outline goes away. Returns how far the mouse moved, the vertical distance in the high word, or
 * $80008000 if it ended outside slopRect.
 * Port: drawn as Inside Macintosh I describes it (the frame of the region in the gray DragPattern,
 * pattern mode XOR, clipped to the gray region); the outline's pixels are not yet measured.
 */
export async function DragGrayRgn(theRgn: Region, startPt: Point, limitRect: Rect, slopRect: Rect, axis: Integer, actionProc: (() => void) | null): Promise<LongInt> {
	const outline = copyOf(theRgn);
	let shown: Point | null = null;
	const toggle = (at: Point): void => {
		withDrawingPort(() => {
			const clip = copyOf(thePort.clipRgn);
			SetClip(GetGrayRgn());
			PenNormal();
			PenPat(gray);
			PenMode(patXor);
			OffsetRgn(outline, at.h - startPt.h, at.v - startPt.v);
			FrameRgn(outline);
			OffsetRgn(outline, startPt.h - at.h, startPt.v - at.v);
			PenNormal();
			SetClip(clip);
		});
	};
	const place = (where: Point): Point | null => {
		if (!PtInRect(where, slopRect)) {
			return null;
		}
		const p = pinned(where, limitRect);
		// axis 1 (hAxisOnly) and 2 (vAxisOnly) hold one coordinate still.
		return { v: axis === 1 ? startPt.v : p.v, h: axis === 2 ? startPt.h : p.h };
	};
	shown = place(startPt);
	if (shown !== null) {
		toggle(shown);
	}
	while (mouse.button) {
		await getHost().sleep(tickTime(TickCount() + 1));
		const now = place(mouse.where);
		if (now === null ? shown !== null : shown === null || !samePoint(now, shown)) {
			if (shown !== null) {
				toggle(shown);
			}
			shown = now;
			if (shown !== null) {
				toggle(shown);
			}
		}
		actionProc?.();
	}
	if (shown !== null) {
		toggle(shown);
	}
	if (shown === null) {
		return 0x80008000 | 0;
	}
	return (((shown.v - startPt.v) & 0xffff) << 16) | ((shown.h - startPt.h) & 0xffff);
}

/**
 * Pascal `DragWindow`: drags a window's outline (DragGrayRgn) and moves the window where the button
 * comes up, within boundsRect. A window that is not active becomes active, unless the Command key
 * was down.
 * Port: the order of the move and the activation is Inside Macintosh's, not measured.
 */
export async function DragWindow(w: WindowRecord, startPt: Point, boundsRect: Rect): Promise<void> {
	const commandDown = (currentModifiers() & cmdKeyBit) !== 0;
	const moved = await DragGrayRgn(w.strucRgn, startPt, boundsRect, boundsRect, 0, null);
	if (moved !== (0x80008000 | 0) && moved !== 0) {
		const dv = moved >> 16;
		const dh = (moved << 16) >> 16;
		const content = w.contRgn.rgnBBox;
		MoveWindow(w, content.left + dh, content.top + dv, false);
	}
	if (!commandDown && w !== FrontWindow()) {
		SelectWindow(w);
	}
}

/**
 * Pascal `TrackGoAway`: follows the mouse after a press in a window's close box until the button
 * comes up, highlighting the box while the mouse is in it; true if it came up there.
 * Port: the close box's highlighting is the window definition's (wDraw with wInGoAway).
 */
export async function TrackGoAway(w: WindowRecord, thePt: Point): Promise<boolean> {
	const inBox = (pt: Point): boolean => callWindowDef(w, wHit, ((pt.v & 0xffff) << 16) | (pt.h & 0xffff)) === wInGoAway;
	let inside = inBox(thePt);
	const hilite = (): void => {
		withDrawingPort(() => {
			const clip = copyOf(thePort.clipRgn);
			SetClip(w.strucRgn);
			clipAbove(w);
			callWindowDef(w, wDraw, wInGoAway);
			SetClip(clip);
		});
	};
	if (inside) {
		hilite();
	}
	while (mouse.button) {
		await getHost().sleep(tickTime(TickCount() + 1));
		const now = inBox(mouse.where);
		if (now !== inside) {
			hilite();
			inside = now;
		}
	}
	if (inside) {
		hilite();
	}
	return inside;
}

/** Port: the line under the menu bar. */
export function drawMenuBarLine(): void {
	const screen = screenBits.bounds;
	MoveTo(screen.left, screen.top + mBarHeight - 1);
	Line(screen.right - screen.left - 1, 0);
}
