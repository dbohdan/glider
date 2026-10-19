// The desktop: the program that plays the Finder's part in the port (PORT.md, decision 16). It is
// System 6.0.8's Finder desktop, measured in the oracle (docs/images/2026-10-19-desktop/), with only
// three icons, Glider 4.0, the Room Editor and Source Code, and a small menu bar. Opening Glider
// zooms as the Finder does and has the page start it; Source Code opens the repository in a new
// tab; Shut Down shows System 6's last screen, with the port's words.

import {
	AppendMenu,
	type BitMap,
	ClipRect,
	CopyBits,
	DisposPtr,
	DrawMenuBar,
	DrawString,
	EraseRect,
	everyEvent,
	type EventRecord,
	FillRect,
	FindWindow,
	FlushEvents,
	FrameRect,
	FrameRoundRect,
	GetClip,
	GetDblTime,
	GetGrayRgn,
	GetNextEvent,
	GetPort,
	GetResource,
	gray,
	inDesk,
	InitCursor,
	InitDialogs,
	InitFonts,
	InitMenus,
	InitWindows,
	InsertMenu,
	inMenuBar,
	InvertRect,
	InvertRoundRect,
	keyDown,
	MenuKey,
	MenuSelect,
	mouseDown,
	MoveTo,
	NewMenu,
	NewPtr,
	NewRgn,
	newEventRecord,
	NoteAlert,
	notPatXor,
	paintDeskPattern,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	PlotIcon,
	type Point,
	PtInRect,
	type Rect,
	type Region,
	RectRgn,
	screenBits,
	screenDrawingPort,
	SectRgn,
	SetClip,
	SetPort,
	setDeskHook,
	srcBic,
	srcOr,
	StillDown,
	StringWidth,
	TEInit,
	TextFont,
	TextSize,
	TickCount,
	black,
	bytesAt,
	cmdKey,
	HiliteMenu,
	ref,
	Button,
	GetMouse,
	ClearMenuBar,
	applFont,
	type WindowRecord,
	Yield,
} from '../mac/Toolbox.ts';

/** What the page does for the desktop: start a program in a page of its own, open a link, restart. */
export interface DesktopHost {
	launch(program: 'glider4'): void;
	openURL(url: string): void;
	restart(): void;
}

let host: DesktopHost = { launch: () => {}, openURL: () => {}, restart: () => {} };

export function setDesktopHost(h: DesktopHost): void {
	host = h;
}

export const repositoryURL = 'https://github.com/dbohdan/glider';

const gliderIconID = 128;
const editorIconID = 129;
const sourceIconID = 130;
const editorAlertID = 128;
const aboutAlertID = 129;

interface DesktopIcon {
	name: string;
	iconID: number;
	/** The icon's top left corner on the screen. */
	where: Point;
	selected: boolean;
	open: () => Promise<void>;
}

let icons: DesktopIcon[] = [];

// ---------------------------------------------------------------------------------------------
// Drawing

/** Copies 32 rows of 32 bits from an ICN# (offset 0, the icon; 128, the mask) onto the screen. */
function copyIconBits(data: Uint8Array, offset: number, where: Point, mode: number): void {
	const p = NewPtr(128);
	bytesAt(p, 128).set(data.subarray(offset, offset + 128));
	const bm: BitMap = { baseAddr: p, rowBytes: 4, bounds: { top: 0, left: 0, bottom: 32, right: 32 } };
	CopyBits(bm, GetPort().portBits, bm.bounds, { top: where.v, left: where.h, bottom: where.v + 32, right: where.h + 32 }, mode, null);
	DisposPtr(p);
}

function iconRect(icon: DesktopIcon): Rect {
	return { top: icon.where.v, left: icon.where.h, bottom: icon.where.v + 32, right: icon.where.h + 32 };
}

/**
 * The box behind an icon's name: Geneva 9's line height, 4 pixels wider than the name, centered
 * under the icon (measured: "Glider 4.05", 51 pixels wide, in a box from 445 to 499 under an icon
 * at 456).
 */
function nameRect(icon: DesktopIcon): Rect {
	const width = StringWidth(icon.name) + 4;
	const left = icon.where.h + 16 - (width >> 1);
	return { top: icon.where.v + 32, left, bottom: icon.where.v + 44, right: left + width };
}

/**
 * Draws an icon as the Finder draws it on the desktop (measured pixel by pixel): inside its mask
 * the icon's own bits, white where it has none, or inverted when it is selected; its name in
 * Geneva 9 in a white box below, or white on black when selected.
 */
function drawIcon(icon: DesktopIcon): void {
	const h = GetResource('ICN#', icon.iconID);
	if (h !== null) {
		copyIconBits(h.data, 128, icon.where, icon.selected ? srcOr : srcBic);
		copyIconBits(h.data, 0, icon.where, icon.selected ? srcBic : srcOr);
	}
	const box = nameRect(icon);
	EraseRect(box);
	MoveTo(box.left + 2, box.top + 10);
	DrawString(icon.name);
	if (icon.selected) {
		InvertRect(box);
	}
}

/** Runs drawing in the Window Manager's port, in Geneva 9, clipped to the desktop and to `rgn`. */
function onDesktop(draw: () => void, rgn: Region = GetGrayRgn()): void {
	const save = GetPort();
	SetPort(screenDrawingPort());
	const clip = NewRgn();
	GetClip(clip);
	const area = NewRgn();
	SectRgn(GetGrayRgn(), rgn, area);
	SetClip(area);
	TextFont(applFont);
	TextSize(9);
	draw();
	TextFont(0);
	TextSize(0);
	SetClip(clip);
	SetPort(save);
}

/** The DeskHook: the desk pattern, and the icons over it. */
function paintDesk(rgn: Region): void {
	onDesktop(() => {
		paintDeskPattern(rgn);
		for (const icon of icons) {
			drawIcon(icon);
		}
	}, rgn);
}

function redrawIcon(icon: DesktopIcon): void {
	onDesktop(() => {
		const area = NewRgn();
		RectRgn(area, iconRect(icon));
		paintDeskPattern(area);
		drawIcon(icon);
	});
}

// ---------------------------------------------------------------------------------------------
// The Finder's zoom

/**
 * Zooms from one rectangle toward another, as System 6.0.8's Finder does when it opens an icon
 * (its routine at $3EA81C, read from a RAM dump, and checked rectangle for rectangle against the
 * oracle): 12 rectangles, each the fraction f of the way from `from` to `to`, f starting at
 * 176/10000 and growing by 7/5; one is drawn each tick, in gray in notPatXor in the Window
 * Manager's port, and the one four before it is erased.
 */
export async function zoomRects(from: Rect, to: Rect): Promise<void> {
	const fixRatio = (n: number, d: number) => Math.trunc((n * 65536) / d);
	const fixMul = (a: number, b: number) => {
		const p = a * b;
		return p >= 0 ? Math.floor((p + 0x8000) / 65536) : -Math.floor((-p + 0x8000) / 65536);
	};
	const fixRound = (x: number) => Math.floor((x + 0x8000) / 65536);
	const save = GetPort();
	SetPort(screenDrawingPort());
	ClipRect(screenBits.bounds);
	PenPat(gray);
	PenMode(notPatXor);
	const shown: (Rect | null)[] = [null, null, null, null];
	let f = fixRatio(176, 10000);
	const accel = fixRatio(7, 5);
	let next = TickCount();
	const sides = ['top', 'left', 'bottom', 'right'] as const;
	for (let step = 0; step < 12; step++) {
		const r = { top: 0, left: 0, bottom: 0, right: 0 };
		for (const side of sides) {
			r[side] = fixRound(fixMul(f, to[side] * 65536) + fixMul(65536 - f, from[side] * 65536));
		}
		shown[3] = r;
		FrameRect(r);
		while (TickCount() < next) {
			await Yield();
		}
		next = TickCount() + 1;
		if (shown[0] !== null) {
			FrameRect(shown[0]);
		}
		shown.shift();
		shown.push(null);
		f = fixMul(f, accel);
	}
	for (const r of shown) {
		if (r !== null) {
			FrameRect(r);
		}
	}
	PenNormal();
	SetPort(save);
}

/**
 * What the screen shows while the Mac starts a program: the desktop with no icons, and the menu
 * bar with only the program's name, centered (seen in the oracle as Glider started).
 */
function showLaunching(name: string): void {
	setDeskHook(null);
	ClearMenuBar();
	DrawMenuBar();
	const save = GetPort();
	SetPort(screenDrawingPort());
	ClipRect(screenBits.bounds);
	paintDeskPattern(GetGrayRgn());
	MoveTo((screenBits.bounds.right - StringWidth(name)) >> 1, 14);
	DrawString(name);
	SetPort(save);
}

// ---------------------------------------------------------------------------------------------
// Opening

async function openGlider(icon: DesktopIcon): Promise<void> {
	await zoomRects(iconRect(icon), screenBits.bounds);
	showLaunching(icon.name);
	host.launch('glider4');
	// The page goes on to Glider's.
	for (;;) {
		await Yield();
	}
}

async function openEditor(): Promise<void> {
	await NoteAlert(editorAlertID, null);
}

async function openSource(icon: DesktopIcon): Promise<void> {
	host.openURL(repositoryURL);
	await zoomRects(iconRect(icon), screenBits.bounds);
}

// ---------------------------------------------------------------------------------------------
// Shutting down

/**
 * System 6.0.8's last screen after Shut Down, measured in the oracle on a Mac Plus: black, with a
 * white box framed twice, an icon, the words, and Restart. Port: the words are the port's (the
 * window can be closed, not the Mac switched off) and the icon is Glider's.
 */
async function shutDown(): Promise<never> {
	setDeskHook(null);
	const save = GetPort();
	SetPort(screenDrawingPort());
	ClipRect(screenBits.bounds);
	PenNormal();
	FillRect(screenBits.bounds, black);
	const box = { top: 65, left: 33, bottom: 189, right: 479 };
	EraseRect(box);
	PenSize(2, 2);
	FrameRect({ top: 67, left: 35, bottom: 187, right: 477 });
	PenNormal();
	PlotIcon({ top: 81, left: 60, bottom: 113, right: 92 }, GetResource('ICON', gliderIconID));
	TextFont(0);
	MoveTo(115, 94);
	DrawString('You may now close this window safely.');
	const button = { top: 154, left: 404, bottom: 174, right: 463 };
	FrameRoundRect(button, 16, 16);
	// The title's origin, measured: 4 pixels in from the button's left (Chicago's R starts a pixel into its glyph) and 14 down from its top.
	MoveTo(button.left + 4, button.top + 14);
	DrawString('Restart');
	for (;;) {
		const ev = newEventRecord();
		await GetNextEvent(everyEvent, ev);
		const pt = { ...ev.where };
		const hit = ev.what === mouseDown && PtInRect(pt, button);
		const key = ev.what === keyDown && ((ev.message & 0xff) === 13 || (ev.message & 0xff) === 3);
		if (hit) {
			let inside = true;
			InvertRoundRect(button, 16, 16);
			while (StillDown()) {
				await Yield();
				const at = { h: 0, v: 0 };
				GetMouse(at);
				if (PtInRect(at, button) !== inside) {
					inside = !inside;
					InvertRoundRect(button, 16, 16);
				}
			}
			if (inside) {
				break;
			}
		} else if (key) {
			break;
		}
	}
	SetPort(save);
	host.restart();
	for (;;) {
		await Yield();
	}
}

// ---------------------------------------------------------------------------------------------
// Menus

const appleID = 128;
const fileID = 129;
const specialID = 130;

function setUpMenus(): void {
	const apple = NewMenu(appleID, '\x14');
	AppendMenu(apple, 'About the Desktop…');
	InsertMenu(apple, 0);
	const file = NewMenu(fileID, 'File');
	AppendMenu(file, 'Open/O');
	InsertMenu(file, 0);
	const special = NewMenu(specialID, 'Special');
	AppendMenu(special, 'Restart;Shut Down');
	InsertMenu(special, 0);
	DrawMenuBar();
}

async function doMenu(result: number): Promise<void> {
	const menu = result >> 16;
	const item = result & 0xffff;
	if (menu === appleID && item === 1) {
		await NoteAlert(aboutAlertID, null);
	} else if (menu === fileID && item === 1) {
		const icon = icons.find((i) => i.selected);
		if (icon !== undefined) {
			await icon.open();
		}
	} else if (menu === specialID && item === 1) {
		host.restart();
	} else if (menu === specialID && item === 2) {
		await shutDown();
	}
	HiliteMenu(0);
}

// ---------------------------------------------------------------------------------------------
// The mouse

/**
 * The icon under a point: within its rectangle, holes in its mask included (measured: a click
 * between Glider's glider and its base selects it), or within its name's box.
 */
function iconAt(pt: Point): DesktopIcon | null {
	const save = GetPort();
	SetPort(screenDrawingPort());
	TextFont(applFont);
	TextSize(9);
	const found = icons.find((icon) => PtInRect(pt, iconRect(icon)) || PtInRect(pt, nameRect(icon))) ?? null;
	TextFont(0);
	TextSize(0);
	SetPort(save);
	return found;
}

function select(target: DesktopIcon | null): void {
	for (const icon of icons) {
		const selected = icon === target;
		if (icon.selected !== selected) {
			icon.selected = selected;
			redrawIcon(icon);
		}
	}
}

let lastClick: { icon: DesktopIcon | null; when: number } = { icon: null, when: 0 };

async function clickDesktop(ev: EventRecord): Promise<void> {
	const icon = iconAt(ev.where);
	const double = icon !== null && lastClick.icon === icon && ev.when - lastClick.when <= GetDblTime();
	lastClick = { icon, when: ev.when };
	select(icon);
	while (Button()) {
		await Yield();
	}
	if (double && icon !== null) {
		lastClick = { icon: null, when: 0 };
		await icon.open();
	}
}

// ---------------------------------------------------------------------------------------------

export async function main(): Promise<void> {
	InitFonts();
	FlushEvents(everyEvent, 0);
	InitWindows();
	InitMenus();
	TEInit();
	InitDialogs(null);
	InitCursor();
	setUpMenus();
	// The Finder's desktop column (measured, after Clean Up): 56 pixels from the screen's right edge,
	// a place every 64 pixels from 28 down, the first being the startup disk's.
	const h = screenBits.bounds.right - 56;
	icons = [
		{ name: 'Glider 4.0', iconID: gliderIconID, where: { h, v: 28 }, selected: false, open: () => openGlider(icons[0]!) },
		{ name: 'Room Editor', iconID: editorIconID, where: { h, v: 92 }, selected: false, open: openEditor },
		{ name: 'Source Code', iconID: sourceIconID, where: { h, v: 156 }, selected: false, open: () => openSource(icons[2]!) },
	];
	setDeskHook(paintDesk);
	paintDesk(GetGrayRgn());
	for (;;) {
		const ev = newEventRecord();
		if (!(await GetNextEvent(everyEvent, ev))) {
			continue;
		}
		if (ev.what === mouseDown) {
			const which = ref<WindowRecord | null>(null);
			const part = FindWindow(ev.where, which);
			if (part === inMenuBar) {
				await doMenu(await MenuSelect(ev.where));
			} else if (part === inDesk) {
				await clickDesktop(ev);
			}
		} else if (ev.what === keyDown && ev.modifiers & cmdKey) {
			await doMenu(MenuKey(ev.message & 0xff));
		}
	}
}
