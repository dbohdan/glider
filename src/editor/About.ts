// Port: Jon Wind's About™ 2.1 library, which the Room Editor links for its help window ("About… 2.1
// Intf.p"; the compiled library is `About.lib (2.1)`, an MPW object file of 6,944 bytes). A
// third-party binary library, written from its disassembly (PORT.md, decision 11), as SMS was: its
// object file's records give the names of the five routines the interface exports; its eleven
// private routines are named here for what they do.
//
// What the disassembly says, in short:
// - BuildAbout opens the window (OpenAbout) and passes every event to HandleAbout until it closes,
//   with WaitNextEvent (sleep 0) where the trap is there, GetNextEvent where it is not. A press in
//   another window beeps (SysBeep(3)). If the window cannot be made it beeps and returns.
// - OpenAbout shows the watch, centers the rectangle (CenterWindow), checks it, and makes the window
//   in color if the main screen is deeper than one bit. Within the window's portRect it lays out:
//   the text's frame, 5 pixels in on three sides and 44 from the bottom, 15 more from the right for
//   the scroll bar, which overlaps the frame's right edge; the icon, 8 pixels in and centered in the
//   44 below; the message between the icon and the OK button (50 and 85 pixels in); OK, 65 by 20,
//   10 from the right and centered below. The text is TextEdit's inside the frame, inset 4: styled
//   ('styl' of the TEXT's ID) on System 6 or later when Styled, plain otherwise. The scroll bar
//   counts pixels, from 0 to the text's height less the view's.
// - HandleAbout acts on any event as on its own window's: updates draw the icon, the message, the
//   frame, the text, the controls, and OK's outline; activates highlight the scroll bar; clicks in
//   the window track OK, the scroll bar, the icon (which shows ClickIcon and ClickMsg while the
//   button is down), the close box and the drag bar, and an Option-click shows the library's
//   version in a box while the button is down. With KeyEquivs, keys scroll: Home and End, the up and
//   down arrows, Page Up and Page Down, and , . < > (Command makes a line a page); Return and Enter,
//   and O with KeyEquivs, press OK. ⌘C with TEXTCopy copies the text, flashing it.
// - CloseAbout disposes of everything and redraws OK's outline in the other About windows.
// A message with returns has its lines counted from a width that the library measures in the wrong
// buffer (TextWidth of the bytes before its string); the port measures the message's own lines.

import {
	BeginUpdate,
	blackColor,
	blueColor,
	type CIcon,
	ControlRecord,
	controlFrameColor,
	cyanColor,
	cmdKey,
	Delay,
	DisposCIcon,
	DisposeWindow,
	DragWindow,
	DrawControls,
	EmptyRgn,
	EndUpdate,
	EraseRect,
	type EventRecord,
	FindControl,
	FindWindow,
	ForeColor,
	FrameRect,
	FrameRoundRect,
	FrontWindow,
	GetCIcon,
	GetCtlMax,
	GetCtlMin,
	GetCtlValue,
	GetCursor,
	GetFontInfo,
	GetGrayRgn,
	GetIcon,
	GetMainDevice,
	GetMBarHeight,
	GetNextEvent,
	GetPort,
	GetResource,
	GlobalToLocal,
	greenColor,
	type Handle,
	hasColorQD,
	HiliteControl,
	inButton,
	inContent,
	inDownButton,
	inDrag,
	inFront,
	InitCursor,
	inGoAway,
	inPageDown,
	inPageUp,
	InsetRect,
	inThumb,
	inUpButton,
	type Integer,
	InvalRect,
	InvertRect,
	magentaColor,
	mouseDown,
	NewControl,
	NewCWindow,
	NewWindow,
	NGetTrapAddress,
	OffsetRect,
	optionKey,
	PenNormal,
	PenPat,
	PenSize,
	PlotCIcon,
	PlotIcon,
	PtInRect,
	type Rect,
	redColor,
	ref,
	type Ref,
	RGBBackColor,
	RGBForeColor,
	screenBits,
	scrollBarProc,
	SelectWindow,
	SetCtlMax,
	SetCtlValue,
	SetCursor,
	SetPort,
	SetRect,
	ShowWindow,
	StillDown,
	StringWidth,
	SysBeep,
	TECopy,
	TEGetHeight,
	TEGetOffset,
	TEGetStyle,
	TENew,
	type TERec,
	TEScroll,
	TESetSelect,
	TEStylInsert,
	TEStylNew,
	TETextBox,
	TextFace,
	TextFont,
	TextSize,
	TEToScrap,
	TEUpdate,
	TextWidth,
	ToolTrap,
	TrackControl,
	TrackGoAway,
	updateEvt,
	activateEvt,
	osEvt,
	keyDown,
	autoKey,
	WaitNextEvent,
	watchCursor,
	whiteColor,
	type WindowPtr,
	type WindowRecord,
	windowContentColor,
	yellowColor,
	pushButProc,
	teJustCenter,
	TECalText,
	TEDispose,
} from '../mac/Toolbox.ts';
import { encodeMacRoman } from '../mac/MacRoman.ts';
import { newEventRecord } from '../mac/Events.ts';

export const AboutVersion = 'About™ 2.1';
export const AboutNoIcon = -1;
export const AboutNoCenter = -1;
export const AboutTopCenter = 0;
export const AboutMainCenter = 1;
export const AboutMsg = 0;
export const AboutTEXT = 1;

export const movableDBoxProc = 5;

export interface AboutFontRec {
	Font: Integer;
	Size: Integer;
	/** Style: a set of QuickDraw faces, as TextFace takes it. */
	Face: Integer;
	Color: Integer;
}

export interface AboutRec {
	/** array[AboutMsg..AboutTEXT] of AboutFontRec */
	FontInfo: AboutFontRec[];
	TEXTCopy: boolean;
	KeyEquivs: boolean;
	CloseBox: boolean;
	Styled: boolean;
	CenterMode: Integer;
	MainIcon: Integer;
	ClickIcon: Integer;
	/** Str255 */
	ClickMsg: string;
}

export function newAboutRec(): AboutRec {
	const font = (): AboutFontRec => ({ Font: 0, Size: 0, Face: 0, Color: 0 });
	return { FontInfo: [font(), font()], TEXTCopy: false, KeyEquivs: false, CloseBox: false, Styled: false, CenterMode: 0, MainIcon: 0, ClickIcon: 0, ClickMsg: '' };
}

const noGrowDocProc = 4;
const rDocProc = 16;
const plainDBox = 2;
/** The window kinds the library accepts. */
const windowProcs = new Set([0, 1, 2, 3, 4, 5, 16]);

/** The library's own record of a window (the handle in its refCon, 598 bytes). */
interface AboutData {
	misc: AboutRec;
	msg: string;
	te: TERec;
	ok: ControlRecord | null;
	scroll: ControlRecord;
	/** The main and the click icon, in color or black and white. */
	icons: { icon: Handle | null; cicon: CIcon | null }[];
	iconRect: Rect;
	msgRect: Rect;
	/** The scroll bar's value the text was last scrolled to. */
	scrolled: Integer;
	/** Whether the text is styled, and whether the window is in color. */
	styled: boolean;
	color: boolean;
}

const aboutWindows = new Map<WindowRecord, AboutData>();

/** Whether a window is an About window. */
export function IsAboutWindow(theWindow: WindowPtr | null): boolean {
	return theWindow !== null && aboutWindows.has(theWindow as WindowRecord);
}

/** Colors other than QuickDraw's eight become black. */
function checkColor(color: Integer): Integer {
	return [whiteColor, redColor, greenColor, blueColor, cyanColor, magentaColor, yellowColor].includes(color) ? color : blackColor;
}

/** Sets the port's text: a font record's font, size, face and color. */
function useFont(f: AboutFontRec): void {
	TextFont(f.Font);
	TextSize(f.Size);
	TextFace(f.Face);
	ForeColor(f.Color);
}

/** The main screen's rectangle. */
function mainScreen(): Rect {
	return { ...(GetMainDevice()?.gdRect ?? screenBits.bounds) };
}

/**
 * Centers a window's rectangle: on the front window with topCenter (if there is one), else on the
 * screen; across, and a third of the way down. Then it is kept 5 pixels inside the main screen's
 * right and bottom, and at least 10 pixels from the left and 30 from the top.
 */
function CenterWindow(r: Rect, topCenter: boolean): Rect {
	const out = { ...r };
	const front = FrontWindow();
	let origin = { h: 0, v: 0 };
	let width: Integer;
	let height: Integer;
	if (topCenter && front !== null) {
		const save = GetPort();
		SetPort(front);
		const p = { h: front.portRect.left, v: front.portRect.top };
		origin = { h: p.h - front.portBits.bounds.left, v: p.v - front.portBits.bounds.top };
		SetPort(save);
		width = front.portRect.right - front.portRect.left;
		height = front.portRect.bottom - front.portRect.top;
	} else {
		width = screenBits.bounds.right - screenBits.bounds.left;
		height = screenBits.bounds.bottom - screenBits.bounds.top;
	}
	const w = r.right - r.left;
	const h = r.bottom - r.top;
	let left = Math.trunc((width - w) / 2) + origin.h;
	let top = Math.trunc((height - h) / 3) + origin.v;
	const screen = mainScreen();
	const overRight = left + w - screen.right + 5;
	if (overRight > 0) {
		left -= overRight;
	}
	left = Math.max(left, 10);
	const overBottom = top + h - screen.bottom + 5;
	if (overBottom > 0) {
		top -= overBottom;
	}
	top = Math.max(top, 30);
	OffsetRect(out, left - r.left, top - r.top);
	return out;
}

/** Pascal `OpenAbout`: makes and shows an About window; null if it cannot. */
export function OpenAbout(WinRect: Rect, WinProc: Integer, TEXTid: Integer, WinTitle: string, WinMsg: string, WinMisc: AboutRec): WindowPtr | null {
	const misc: AboutRec = { ...WinMisc, FontInfo: WinMisc.FontInfo.map((f) => ({ ...f })) };
	const watch = GetCursor(watchCursor);
	if (watch !== null) {
		SetCursor(watch);
	}
	try {
		return makeAbout(WinRect, WinProc, TEXTid, WinTitle, WinMsg, misc);
	} finally {
		InitCursor();
	}
}

function makeAbout(WinRect: Rect, WinProc: Integer, TEXTid: Integer, WinTitle: string, WinMsg: string, misc: AboutRec): WindowRecord | null {
	let r = { ...WinRect };
	const screen = mainScreen();
	if (misc.CenterMode !== AboutNoCenter) {
		r = CenterWindow(r, misc.CenterMode === AboutTopCenter);
		if ((WinProc === noGrowDocProc || WinProc === rDocProc || WinProc === movableDBoxProc) && GetMBarHeight() + 12 >= r.top) {
			OffsetRect(r, 0, 10);
		}
	}
	const onScreen = r.right <= screen.right && r.bottom <= screen.bottom && r.top >= screen.top && r.left >= screen.left;
	if (!((misc.CenterMode === AboutNoCenter || onScreen) && r.right - r.left >= 150 && r.bottom - r.top >= 100 && windowProcs.has(WinProc))) {
		return null;
	}
	const text = GetResource('TEXT', TEXTid);
	if (text === null) {
		return null;
	}
	const closeBox = (WinProc === noGrowDocProc || WinProc === rDocProc || (WinProc === plainDBox && misc.MainIcon === AboutNoIcon && WinMsg.length === 0)) && misc.CloseBox;
	// System 6.0.8: styled text when asked for; color where the main screen is deeper than a bit.
	const styled = misc.Styled;
	const color = hasColorQD && (GetMainDevice()?.gdPMap.pixelSize ?? 1) > 1;
	misc.FontInfo[AboutMsg]!.Color = checkColor(misc.FontInfo[AboutMsg]!.Color);
	misc.FontInfo[AboutTEXT]!.Color = checkColor(misc.FontInfo[AboutTEXT]!.Color);
	const w = (color ? NewCWindow : NewWindow)(null, r, WinTitle, false, WinProc, inFront, closeBox, 0);
	SetPort(w);
	const icons = [0, 1].map((i) => {
		const id = i === 0 ? misc.MainIcon : misc.ClickIcon;
		// Port: the library tests MainIcon for both icons.
		if (misc.MainIcon === AboutNoIcon) {
			return { icon: null, cicon: null };
		}
		const cicon = color ? GetCIcon(id) : null;
		return { cicon, icon: cicon === null ? GetIcon(id) : null };
	});
	if (icons[0]!.icon === null && icons[0]!.cicon === null) {
		misc.MainIcon = AboutNoIcon;
	}
	if (color) {
		RGBBackColor(windowContentColor(w));
	}
	const pr = w.portRect;
	const textRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	SetRect(textRect, pr.left + 5, pr.top + 5, pr.right - 5 - 15, pr.bottom - 44);
	const iconTop = Math.trunc((pr.bottom - textRect.bottom - 32) / 2) + textRect.bottom;
	const iconRect: Rect = { top: iconTop, left: pr.left + 8, bottom: iconTop + 32, right: pr.left + 8 + 32 };
	const msgRect: Rect = { top: textRect.bottom, left: pr.left + 50, bottom: pr.bottom, right: pr.right - 85 };
	if (misc.MainIcon === AboutNoIcon) {
		msgRect.left = iconRect.left;
	}
	if (closeBox) {
		if (misc.MainIcon === AboutNoIcon && WinMsg.length === 0) {
			InsetRect(textRect, -6, -6);
			textRect.bottom = pr.bottom + 1;
		} else {
			msgRect.right = pr.right - 10;
		}
	}
	const okTop = Math.trunc((pr.bottom - textRect.bottom - 20) / 2) + textRect.bottom;
	const okRect: Rect = { top: okTop, left: pr.right - 10 - 65, bottom: okTop + 20, right: pr.right - 10 };
	if (misc.MainIcon === AboutNoIcon && WinMsg.length === 0) {
		OffsetRect(okRect, 5 - Math.trunc(okRect.left / 2), 0);
	}
	const scrollRect: Rect = { top: textRect.top, left: textRect.right - 1, bottom: textRect.bottom, right: textRect.right + 15 };
	const ok = closeBox ? null : NewControl(w, okRect, 'OK', true, 0, 0, 0, pushButProc, 1);
	const scroll = NewControl(w, scrollRect, '', true, 0, 0, 0, scrollBarProc, 2);
	useFont(misc.FontInfo[AboutTEXT]!);
	InsetRect(textRect, 4, 4);
	let te: TERec;
	let max: Integer;
	if (styled) {
		te = TEStylNew(textRect, textRect);
		const styl = GetResource('styl', TEXTid);
		if (styl !== null) {
			TEStylInsert(text.data, text.data.length, styl, te);
		}
		max = TEGetHeight(te.nLines, 0, te) - (te.viewRect.bottom - te.viewRect.top);
	} else {
		te = TENew(textRect, textRect);
		te.hText = text;
		TECalText(te);
		// The library counts a line more after a final return, which the ROM's nLines leaves out and
		// the port's counts already.
		max = te.nLines * te.lineHeight - (te.viewRect.bottom - te.viewRect.top);
	}
	SetCtlMax(scroll, Math.max(0, max));
	aboutWindows.set(w, { misc, msg: WinMsg, te, ok, scroll, icons, iconRect, msgRect, scrolled: 0, styled, color });
	ShowWindow(w);
	return w;
}

/** Scrolls the text to the scroll bar's value. */
function ScrollToValue(d: AboutData): void {
	const value = GetCtlValue(d.scroll);
	const dv = d.scrolled - value;
	d.scrolled = value;
	if (dv !== 0) {
		useFont(d.misc.FontInfo[AboutTEXT]!);
		TEScroll(0, dv, d.te);
	}
}

/**
 * The scroll bar's action (and the keys'): a line up or down for the arrows, the height of the
 * line at the view's top or just below its bottom when the text is styled, or the view's height for
 * the page areas. Port: it acts on the front window's record, as the library does.
 */
function ScrollAction(c: ControlRecord, part: Integer): void {
	const front = FrontWindow();
	const d = front === null ? undefined : aboutWindows.get(front);
	if (d === undefined) {
		return;
	}
	const up = part === inUpButton || part === inPageUp;
	const min = GetCtlMin(c);
	const max = GetCtlMax(c);
	const value = GetCtlValue(c);
	if (part === 0 || !((up && value > min) || (!up && value < max))) {
		return;
	}
	let delta = up ? -1 : 1;
	const view = d.te.viewRect;
	if (part === inPageUp || part === inPageDown) {
		delta *= view.bottom - view.top;
	} else if (d.te.lineHeight > 0) {
		delta *= d.te.lineHeight;
	} else {
		const pt = up ? { h: view.left, v: view.top } : { h: view.left, v: view.bottom + 2 };
		const offset = TEGetOffset(pt, d.te);
		const style = { tsFont: 0, tsFace: 0, tsSize: 0, tsColor: { red: 0, green: 0, blue: 0 } };
		const lineHeight = { v: 0 };
		TEGetStyle(offset, style, lineHeight, { v: 0 }, d.te);
		delta *= lineHeight.v;
	}
	SetCtlValue(c, value + delta);
	ScrollToValue(d);
}

/** Draws the frame color: the OK button's in color, else black. */
function UseFrameColor(d: AboutData): void {
	if (d.color && d.ok !== null) {
		RGBForeColor(controlFrameColor(d.ok));
	} else {
		ForeColor(blackColor);
	}
}

/** The outline of the default button: gray, and the button dimmed, when the window is not in front. */
function DrawOKOutline(w: WindowRecord): void {
	const d = aboutWindows.get(w);
	if (d === undefined || d.ok === null) {
		return;
	}
	SetPort(w);
	const r = { ...d.ok.contrlRect };
	InsetRect(r, -4, -4);
	PenSize(3, 3);
	UseFrameColor(d);
	if (FrontWindow() !== w) {
		PenPat([0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55]);
		HiliteControl(d.ok, 255);
	} else {
		HiliteControl(d.ok, 0);
	}
	FrameRoundRect(r, 16, 16);
	PenNormal();
}

/** DrawOKOutline for every About window. */
function DrawAllOutlines(): void {
	const save = GetPort();
	for (let w = FrontWindow(); w !== null; w = w.nextWindow) {
		if (IsAboutWindow(w)) {
			DrawOKOutline(w);
		}
	}
	SetPort(save);
}

/**
 * Draws an icon (0, the main one, or 1, the click icon) and a message beside it, centered: across by
 * TETextBox, down by its lines, counted at returns and where a line is wider than the message's room.
 */
function DrawIconAndMessage(d: AboutData, which: Integer, msg: string): void {
	EraseRect(d.iconRect);
	const icon = d.icons[which]!;
	if (icon.cicon !== null) {
		PlotCIcon(d.iconRect, icon.cicon);
	} else if (icon.icon !== null) {
		PlotIcon(d.iconRect, icon.icon);
	}
	const box = { ...d.msgRect };
	EraseRect(box);
	if (msg.length === 0) {
		return;
	}
	useFont(d.misc.FontInfo[AboutMsg]!);
	const info = { ascent: 0, descent: 0, widMax: 0, leading: 0 };
	GetFontInfo(info);
	const bytes = encodeMacRoman(msg);
	const width = StringWidth(msg);
	const room = box.right - box.left;
	let lines = 1;
	let start = 0;
	for (let i = 0; i < bytes.length; i++) {
		if (bytes[i] === 13) {
			lines++;
			if (TextWidth(bytes, start, i - start) > room) {
				lines++;
			}
			start = i + 1;
		}
	}
	if (lines === 1) {
		lines += Math.trunc(width / room);
	} else if (TextWidth(bytes, start, bytes.length - start) > room) {
		lines++;
	}
	InsetRect(box, 0, Math.trunc((box.bottom - box.top - (info.ascent + info.descent + info.leading) * lines) / 2));
	TETextBox(bytes, bytes.length, box, teJustCenter);
}

/** Pascal `HandleAbout`: acts on an event for an About window; closing it sets theWindow to null. */
export async function HandleAbout(theWindow: Ref<WindowPtr | null>, theEvent: EventRecord): Promise<void> {
	const w = theWindow.v as WindowRecord | null;
	const d = w === null ? undefined : aboutWindows.get(w);
	if (w === null || d === undefined) {
		return;
	}
	SetPort(w);
	switch (theEvent.what) {
		case updateEvt:
			if (EmptyRgn(w.updateRgn) || EmptyRgn(w.visRgn)) {
				break;
			}
			BeginUpdate(w);
			DrawIconAndMessage(d, 0, d.msg);
			PenNormal();
			UseFrameColor(d);
			{
				const frame = { ...d.te.viewRect };
				InsetRect(frame, -4, -4);
				FrameRect(frame);
				useFont(d.misc.FontInfo[AboutTEXT]!);
				TEUpdate(frame, d.te);
			}
			DrawControls(w);
			EndUpdate(w);
			DrawOKOutline(w);
			break;
		case activateEvt:
		case osEvt: {
			const flags = theEvent.what === activateEvt ? theEvent.modifiers : theEvent.message & 0xffff;
			HiliteControl(d.scroll, (flags & 1) !== 0 && GetCtlMax(d.scroll) > 0 && FrontWindow() === w ? 0 : 255);
			DrawControls(w);
			DrawOKOutline(w);
			break;
		}
		case mouseDown:
			await mouseDownIn(theWindow, w, d, theEvent);
			break;
		case keyDown:
		case autoKey:
			await keyIn(theWindow, w, d, theEvent);
			break;
		default:
	}
}

async function mouseDownIn(theWindow: Ref<WindowPtr | null>, w: WindowRecord, d: AboutData, theEvent: EventRecord): Promise<void> {
	const where = { ...theEvent.where };
	const hit = ref<WindowRecord | null>(null);
	const part = FindWindow(where, hit);
	if (hit.v === null || hit.v !== w) {
		return;
	}
	if (!(FrontWindow() === w || ((theEvent.modifiers & cmdKey) !== 0 && part === inDrag))) {
		SelectWindow(w);
		DrawAllOutlines();
		return;
	}
	switch (part) {
		case inDrag: {
			const bounds = { ...GetGrayRgn().rgnBBox };
			InsetRect(bounds, 10, 10);
			await DragWindow(w, where, bounds);
			theEvent.what = 0;
			break;
		}
		case inGoAway:
			if (await TrackGoAway(w, where)) {
				CloseAbout(theWindow);
			}
			break;
		case inContent:
			if ((theEvent.modifiers & optionKey) !== 0) {
				// The library's version, while the button is down.
				TextFont(3);
				TextSize(9);
				TextFace(0);
				UseFrameColor(d);
				const version = 'About… 2.1';
				const width = StringWidth(version) + 12;
				const left = Math.trunc(w.portRect.right / 2) - Math.trunc(width / 2);
				const bottom = Math.trunc(w.portRect.bottom / 2);
				const box: Rect = { top: bottom - 16, left, bottom, right: left + width };
				InvalRect(box);
				FrameRect(box);
				InsetRect(box, 1, 1);
				TETextBox(version, version.length, box, teJustCenter);
				await untilButtonUp();
				break;
			}
			{
				const pt = { ...where };
				GlobalToLocal(pt);
				const control = ref<ControlRecord | null>(null);
				const controlPart = FindControl(pt, w, control);
				const c = control.v;
				if (c !== null && controlPart === inButton) {
					if ((await TrackControl(c, pt, null)) === inButton) {
						CloseAbout(theWindow);
					}
				} else if (c !== null && (controlPart === inUpButton || controlPart === inDownButton || controlPart === inPageUp || controlPart === inPageDown)) {
					await TrackControl(c, pt, ScrollAction);
				} else if (c !== null && controlPart === inThumb) {
					await TrackControl(c, pt, null);
					ScrollToValue(d);
				} else if (d.misc.MainIcon !== AboutNoIcon && (d.icons[1]!.cicon !== null || d.icons[1]!.icon !== null) && PtInRect(pt, d.iconRect)) {
					DrawIconAndMessage(d, 1, d.misc.ClickMsg);
					await untilButtonUp();
					DrawIconAndMessage(d, 0, d.msg);
				}
			}
			break;
		default:
	}
}

/** Waits while the button stays down (StillDown, in a loop). */
async function untilButtonUp(): Promise<void> {
	while (StillDown()) {
		await Delay(1);
	}
}

async function keyIn(theWindow: Ref<WindowPtr | null>, w: WindowRecord, d: AboutData, theEvent: EventRecord): Promise<void> {
	let ch = theEvent.message & 0xff;
	const command = (theEvent.modifiers & cmdKey) !== 0;
	const keys = d.misc.KeyEquivs;
	if ((ch === 0x4f || ch === 0x6f) && keys) {
		ch = 3;
	}
	switch (ch) {
		case 1: // Home
		case 4: // End
			if (keys) {
				SetCtlValue(d.scroll, ch === 1 ? GetCtlMin(d.scroll) : GetCtlMax(d.scroll));
				ScrollToValue(d);
			}
			break;
		case 3: // Enter
		case 13: // Return
			if (FrontWindow() === w && d.ok !== null) {
				HiliteControl(d.ok, 1);
				await Delay(8);
				HiliteControl(d.ok, 0);
				CloseAbout(theWindow);
				theEvent.message = 0;
			}
			break;
		case 11: // Page Up
		case 30: // up arrow
		case 0x2c: // ,
		case 0x3c: // <
			if (keys) {
				ScrollAction(d.scroll, ch === 11 || command ? inPageUp : inUpButton);
			}
			break;
		case 12: // Page Down
		case 31: // down arrow
		case 0x2e: // .
		case 0x3e: // >
			if (keys) {
				ScrollAction(d.scroll, ch === 12 || command ? inPageDown : inDownButton);
			}
			break;
		case 0x43: // C
		case 0x63: // c
			if (d.misc.TEXTCopy && command) {
				InvertRect(d.te.viewRect);
				TESetSelect(0, 32767, d.te);
				TECopy(d.te);
				if (d.styled) {
					TEToScrap();
				}
				TESetSelect(0, 0, d.te);
				await Delay(4);
				InvertRect(d.te.viewRect);
			}
			break;
		default:
	}
}

/** Pascal `CloseAbout`: closes an About window and sets theWindow to null. */
export function CloseAbout(theWindow: Ref<WindowPtr | null>): void {
	const w = theWindow.v as WindowRecord | null;
	const d = w === null ? undefined : aboutWindows.get(w);
	if (w === null || d === undefined) {
		return;
	}
	for (const icon of d.icons) {
		if (icon.cicon !== null) {
			DisposCIcon(icon.cicon);
		}
	}
	TEDispose(d.te);
	aboutWindows.delete(w);
	DisposeWindow(w);
	theWindow.v = null;
	DrawAllOutlines();
}

/**
 * Pascal `BuildAbout`: shows an About window and returns once it is closed. Every event goes to
 * HandleAbout, but a press in another window, which beeps.
 */
export async function BuildAbout(WinRect: Rect, WinProc: Integer, TEXTid: Integer, WinTitle: string, WinMsg: string, WinMisc: AboutRec): Promise<void> {
	const save = GetPort();
	const theWindow = ref<WindowPtr | null>(OpenAbout(WinRect, WinProc, TEXTid, WinTitle, WinMsg, WinMisc));
	if (theWindow.v === null) {
		SysBeep(3);
		SetPort(save);
		return;
	}
	const hasWNE = NGetTrapAddress(0x60, ToolTrap) !== NGetTrapAddress(0x9f, ToolTrap);
	const ev = newEventRecord();
	while (theWindow.v !== null) {
		const got = hasWNE ? await WaitNextEvent(-1, ev, 0, null) : await GetNextEvent(-1, ev);
		if (got) {
			let elsewhere = false;
			if (ev.what === mouseDown) {
				const hit = ref<WindowRecord | null>(null);
				FindWindow(ev.where, hit);
				elsewhere = hit.v !== theWindow.v;
			}
			if (elsewhere) {
				SysBeep(3);
			} else {
				await HandleAbout(theWindow, ev);
			}
		}
	}
	SetPort(save);
}
