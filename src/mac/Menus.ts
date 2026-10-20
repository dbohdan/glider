// Port: the Menu Manager (Inside Macintosh I, chapter 11, and V, chapter 13), with System 6's
// standard menu bar and menu definitions, hierarchical menus, and Color QuickDraw's menu colors.
//
// The geometry is measured from the oracle (Glider's menus on a Mac Plus and a Mac II): titles
// start at 10 and are spaced by their width plus 13, with the text 8 pixels in; a highlighted
// title is inverted from 1 pixel left of its start to 17 pixels past its text width. Menus hang
// from the menu bar's bottom line at their title's left, in 16-pixel rows with the text 14 pixels
// in; they are as wide as their widest item plus 20, or plus 52 with a command key. A submenu
// appears 4 pixels inside its parent's right edge and 7 pixels below its parent item's top.

import { macRomanCode } from './MacRoman.ts';
import { GetMainDevice } from './Color.ts';
import { onDepthChange } from './Devices.ts';
import { getHost, mouse, TickCount, tickTime } from './OS.ts';
import { bytesAt, DisposPtr, NewPtr } from './Memory.ts';
import {
	black,
	type BitMap,
	ClipRect,
	CopyBits,
	DrawChar,
	DrawString,
	FrameRect,
	gray,
	hasColorQD,
	isColorPort,
	InvertRect,
	isPixMap,
	LineTo,
	MoveTo,
	PaintRect,
	PenMode,
	PenNormal,
	PenPat,
	type PixMap,
	patBic,
	type RGBColor,
	RGBBackColor,
	RGBForeColor,
	screenBits,
	srcCopy,
	srcOr,
	StringWidth,
	TextFace,
	TextFont,
	TextMode,
	thePort,
	white,
	EraseRect,
	SetClip,
	GetClip,
	NewRgn,
	SetPort,
	PtInRect,
	PlotIcon,
	DiffRgn,
	PaintRgn,
} from './QuickDraw.ts';
import { rectRegion } from './Region.ts';
import { GetResource, type Handle } from './Resources.ts';
import { pascalString } from './MacRoman.ts';
import { s16, u16 } from './Binary.ts';
import { drawInScreenPort, GetMBarHeight, menuBarRegion, screenDrawingPort } from './Windows.ts';
import type { Integer, LongInt, Point, Rect, Ref } from './Types.ts';

/** Mark and key equivalent characters. */
export const noMark = 0;
export const commandMark = 0x11;
export const checkMark = 0x12;
export const diamondMark = 0x13;
export const appleMark = 0x14;
/** A key equivalent of $1B marks an item with a submenu, whose ID is in the mark field. */
export const hMenuCmd = 0x1b;

/** MDEF messages. */
export const mDrawMsg = 0;
export const mChooseMsg = 1;
export const mSizeMsg = 2;
export const mPopUpMsg = 3;

/** One item of a menu. */
export interface MenuItem {
	text: string;
	icon: Integer;
	/** Key equivalent, as a MacRoman code (0 for none, hMenuCmd for a submenu). */
	keyEquiv: Integer;
	/** Mark character code, or the submenu ID for a hierarchical item. */
	mark: Integer;
	style: Integer;
}

/** Pascal `MenuInfo` (a MenuHandle is a MenuInfo). */
export class MenuInfo {
	menuID: Integer = 0;
	menuWidth: Integer = 0;
	menuHeight: Integer = 0;
	/** Port: always the standard menu definition. */
	menuProc: null = null;
	/** Bit 0 enables the whole menu; bit n enables item n (items past 31 are always enabled). */
	enableFlags: LongInt = -1;
	title = '';
	items: MenuItem[] = [];
}

export type MenuHandle = MenuInfo;

// ---------------------------------------------------------------------------------------------
// The menu list (low memory MenuList) and menu colors

/** Menus in the menu bar, left to right, with their titles' left edges. */
let menuBar: { menu: MenuInfo; left: Integer }[] = [];
/** Hierarchical (and pop-up) menus. */
let hierMenus: MenuInfo[] = [];
/** The highlighted title's menu ID (low memory TheMenu), or 0. */
let theMenu: Integer = 0;
/** Times a chosen item blinks (low memory MenuFlash; the Control Panel's default is 3). */
let menuFlash: Integer = 3;
/** Ticks the mouse must rest on a hierarchical item before its submenu appears. */
let menuDelay: Integer = 8;

const firstTitleLeft = 10;
const titleSpacing = 13;
const titleTextInset = 8;
const itemHeight = 16;
const itemTextInset = 14;
const markInset = 2;
const itemMargin = 6;
const commandMargin = 38;

/** Pascal `MCEntry`: colors for the menu bar, a menu title, or an item. */
export interface MCEntry {
	mctID: Integer;
	mctItem: Integer;
	mctRGB1: RGBColor;
	mctRGB2: RGBColor;
	mctRGB3: RGBColor;
	mctRGB4: RGBColor;
}

let menuColors: MCEntry[] = [];

const rgbBlack: RGBColor = { red: 0, green: 0, blue: 0 };
const rgbWhite: RGBColor = { red: 0xffff, green: 0xffff, blue: 0xffff };

export function GetMCEntry(menuID: Integer, menuItem: Integer): MCEntry | null {
	return menuColors.find((e) => e.mctID === menuID && e.mctItem === menuItem) ?? null;
}

export function SetMCEntries(entries: MCEntry[]): void {
	for (const e of entries) {
		const i = menuColors.findIndex((x) => x.mctID === e.mctID && x.mctItem === e.mctItem);
		const copy = { ...e, mctRGB1: { ...e.mctRGB1 }, mctRGB2: { ...e.mctRGB2 }, mctRGB3: { ...e.mctRGB3 }, mctRGB4: { ...e.mctRGB4 } };
		if (i < 0) {
			menuColors.push(copy);
		} else {
			menuColors[i] = copy;
		}
	}
}

/** Reads an 'mctb' resource. */
export function parseMenuColors(d: Uint8Array): MCEntry[] {
	const rgb = (o: number): RGBColor => ({ red: u16(d, o), green: u16(d, o + 2), blue: u16(d, o + 4) });
	return Array.from({ length: s16(d, 0) }, (_, i) => {
		const o = 2 + i * 30;
		return { mctID: s16(d, o), mctItem: s16(d, o + 2), mctRGB1: rgb(o + 4), mctRGB2: rgb(o + 10), mctRGB3: rgb(o + 16), mctRGB4: rgb(o + 22) };
	});
}

/** The menu bar's colors: its background and the default title color. */
function barColors(): { bar: RGBColor; title: RGBColor; item: RGBColor; menuBk: RGBColor } {
	const e = GetMCEntry(0, 0);
	return { title: e?.mctRGB1 ?? rgbBlack, menuBk: e?.mctRGB2 ?? rgbWhite, item: e?.mctRGB3 ?? rgbBlack, bar: e?.mctRGB4 ?? rgbWhite };
}

/** A menu's colors: its title, the bar behind its title, its default item color, and its background. */
function titleColors(menuID: Integer): { title: RGBColor; bar: RGBColor; item: RGBColor; menuBk: RGBColor } {
	const d = barColors();
	const e = GetMCEntry(menuID, 0);
	return { title: e?.mctRGB1 ?? d.title, bar: e?.mctRGB2 ?? d.bar, item: e?.mctRGB3 ?? d.item, menuBk: e?.mctRGB4 ?? d.menuBk };
}

/** An item's colors: its mark, its text, its key equivalent, and the menu's background. */
function itemColors(menuID: Integer, item: Integer): { mark: RGBColor; text: RGBColor; key: RGBColor; bk: RGBColor } {
	const t = titleColors(menuID);
	const e = GetMCEntry(menuID, item);
	return { mark: e?.mctRGB1 ?? t.item, text: e?.mctRGB2 ?? t.item, key: e?.mctRGB3 ?? t.item, bk: e?.mctRGB4 ?? t.menuBk };
}

/** Whether menus are drawn in color: Color QuickDraw on a screen deeper than 2 bits. */
function inColor(): boolean {
	const device = GetMainDevice();
	return hasColorQD && device !== null && device.gdPMap.pixelSize > 2;
}

function foreColor(c: RGBColor): void {
	if (isColorPort(thePort)) {
		RGBForeColor(c);
	}
}

function backColor(c: RGBColor): void {
	if (isColorPort(thePort)) {
		RGBBackColor(c);
	}
}

function resetColors(): void {
	foreColor(rgbBlack);
	backColor(rgbWhite);
}

// ---------------------------------------------------------------------------------------------
// Initialization and the menu bar

/** Pascal `InitMenus`: an empty menu bar. */
export function InitMenus(): void {
	menuBar = [];
	hierMenus = [];
	theMenu = 0;
	menuColors = [];
	const mctb = GetResource('mctb', 0);
	if (mctb !== null) {
		SetMCEntries(parseMenuColors(mctb.data));
	}
	DrawMenuBar();
	onDepthChange(DrawMenuBar);
}

/** Pascal `DelMCEntries`: removes a color entry, or (mctAllItems, -98) every entry of the menu. */
export function DelMCEntries(menuID: Integer, menuItem: Integer): void {
	menuColors = menuColors.filter((e) => !(e.mctID === menuID && (menuItem === -98 || e.mctItem === menuItem)));
}

export function NewMenu(menuID: Integer, menuTitle: string): MenuInfo {
	const m = new MenuInfo();
	m.menuID = menuID;
	m.title = menuTitle;
	CalcMenuSize(m);
	return m;
}

/** Reads a 'MENU' resource. */
export function parseMenu(d: Uint8Array): MenuInfo {
	const m = new MenuInfo();
	m.menuID = s16(d, 0);
	m.menuWidth = s16(d, 2);
	m.menuHeight = s16(d, 4);
	m.enableFlags = (u16(d, 10) << 16) | u16(d, 12);
	m.title = pascalString(d, 14);
	let o = 15 + d[14]!;
	while (o < d.length && d[o] !== 0) {
		const text = pascalString(d, o);
		o += 1 + d[o]!;
		m.items.push({ text, icon: d[o]!, keyEquiv: d[o + 1]!, mark: d[o + 2]!, style: d[o + 3]! });
		o += 4;
	}
	return m;
}

const loadedMenus = new WeakMap<Handle, MenuInfo>();

/**
 * Pascal `GetMenu`: a menu from a 'MENU' resource; the same menu each time for the same resource.
 * Its colors come from an 'mctb' with the same ID.
 */
export function GetMenu(resourceID: Integer): MenuInfo | null {
	const h = GetResource('MENU', resourceID);
	if (h === null) {
		return null;
	}
	let m = loadedMenus.get(h);
	if (m === undefined) {
		m = parseMenu(h.data);
		CalcMenuSize(m);
		loadedMenus.set(h, m);
		const mctb = GetResource('mctb', resourceID);
		if (mctb !== null) {
			SetMCEntries(parseMenuColors(mctb.data));
		}
	}
	return m;
}

export function DisposeMenu(_menu: MenuInfo | null): void {}

/**
 * Pascal `AppendMenu`: items separated by semicolons or returns, with metacharacters: ^n an icon,
 * !c a mark, <s a style, /c a key equivalent, and ( disabled.
 */
export function AppendMenu(menu: MenuInfo, data: string): void {
	InsMenuItem(menu, data, menu.items.length);
}

/** Pascal `DelMenuItem`: the items after it move up, enabled or not. */
export function DelMenuItem(menu: MenuInfo, item: Integer): void {
	if (item < 1 || item > menu.items.length) {
		return;
	}
	menu.items.splice(item - 1, 1);
	const below = (1 << item) - 1;
	const flags = menu.enableFlags;
	if (item <= 31) {
		menu.enableFlags = (flags & below) | ((flags >>> 1) & ~below) | (1 << 31);
	}
	CalcMenuSize(menu);
}

/**
 * Pascal `InsMenuItem`: items as AppendMenu takes them, after an item (0 for the menu's start).
 * The items after them move down, enabled or not; their colors (an 'mctb') stay with the numbers.
 */
export function InsMenuItem(menu: MenuInfo, data: string, afterItem: Integer): void {
	let at = Math.max(0, Math.min(afterItem, menu.items.length));
	for (const part of data.split(/[;\r]/)) {
		const item: MenuItem = { text: '', icon: 0, keyEquiv: 0, mark: 0, style: 0 };
		let enabled = true;
		let i = 0;
		while (i < part.length) {
			const c = part[i]!;
			const next = part[i + 1];
			if (c === '^' && next !== undefined) {
				item.icon = macRomanCode(next) - 48;
				i += 2;
			} else if (c === '!' && next !== undefined) {
				item.mark = macRomanCode(next);
				i += 2;
			} else if (c === '<' && next !== undefined) {
				item.style |= { B: 1, I: 2, U: 4, O: 8, S: 16 }[next] ?? 0;
				i += 2;
			} else if (c === '/' && next !== undefined) {
				item.keyEquiv = macRomanCode(next);
				i += 2;
			} else if (c === '(') {
				enabled = false;
				i++;
			} else {
				item.text += c;
				i++;
			}
		}
		menu.items.splice(at, 0, item);
		at++;
		// Bit n enables item n; bit 0, the whole menu, stays.
		const below = (1 << at) - 1;
		const flags = menu.enableFlags;
		menu.enableFlags = (flags & below) | ((flags & ~below) << 1) | (enabled ? 1 << at : 0);
		if (at > 31) {
			menu.enableFlags = flags;
		}
	}
	CalcMenuSize(menu);
}

/** Pascal `AddResMenu`: appends the names of all resources of a type. The port has no desk accessories. */
export function AddResMenu(_menu: MenuInfo, _theType: string): void {}

export function InsertResMenu(_menu: MenuInfo, _theType: string, _afterItem: Integer): void {}

/** Pascal `InsertMenu`: before the menu with beforeID, at the end for 0, or among the submenus for -1. */
export function InsertMenu(menu: MenuInfo, beforeID: Integer): void {
	if (beforeID === -1) {
		if (!hierMenus.includes(menu)) {
			hierMenus.push(menu);
		}
		return;
	}
	if (menuBar.some((e) => e.menu.menuID === menu.menuID)) {
		return;
	}
	const i = menuBar.findIndex((e) => e.menu.menuID === beforeID);
	menuBar.splice(i < 0 ? menuBar.length : i, 0, { menu, left: 0 });
	layOutTitles();
}

export function DeleteMenu(menuID: Integer): void {
	menuBar = menuBar.filter((e) => e.menu.menuID !== menuID);
	hierMenus = hierMenus.filter((m) => m.menuID !== menuID);
	layOutTitles();
}

export function ClearMenuBar(): void {
	menuBar = [];
	hierMenus = [];
	theMenu = 0;
}

/** Pascal `GetMHandle`: a menu in the menu list by ID, or nil. */
export function GetMHandle(menuID: Integer): MenuInfo | null {
	return menuBar.find((e) => e.menu.menuID === menuID)?.menu ?? hierMenus.find((m) => m.menuID === menuID) ?? null;
}

/** Titles are measured in the system font, as the menu bar draws them. */
function titleWidth(m: MenuInfo): Integer {
	return withSystemFont(() => StringWidth(m.title));
}

function withSystemFont<T>(f: () => T): T {
	const port = thePort;
	const saved = { font: port.txFont, face: port.txFace, size: port.txSize, mode: port.txMode };
	TextFont(0);
	TextFace(0);
	port.txSize = 0;
	try {
		return f();
	} finally {
		port.txFont = saved.font;
		port.txFace = saved.face;
		port.txSize = saved.size;
		port.txMode = saved.mode;
	}
}

function layOutTitles(): void {
	let left = firstTitleLeft;
	for (const e of menuBar) {
		e.left = left;
		left += titleWidth(e.menu) + titleSpacing;
	}
}

/** The inverted part of a title when it is highlighted. */
function titleHiliteRect(e: { menu: MenuInfo; left: Integer }): Rect {
	return { top: 1, left: e.left - 1, bottom: GetMBarHeight() - 1, right: e.left + titleWidth(e.menu) + 17 };
}

/** Pascal `DrawMenuBar`: redraws the menu bar, with the highlighted title, if any. */
export function DrawMenuBar(): void {
	const height = GetMBarHeight();
	if (height === 0) {
		return;
	}
	drawInScreenPort(() => {
		const colors = barColors();
		const bar = menuBarRegion();
		const clip = NewRgn();
		GetClip(clip);
		SetClip(bar);
		PenNormal();
		if (isColorPort(thePort)) {
			RGBForeColor(colors.bar);
			PenPat(black);
		} else {
			PenPat(white);
		}
		PaintRect(screenBits.bounds);
		SetClip(clip);
		PenPat(black);
		resetColors();
		const screen = screenBits.bounds;
		// The screen's rounded corners beside the bar are painted black too, over whatever a program
		// drew there (seen in the oracle: Glider's pause shows the menu bar over a game).
		const corners = rectRegion({ top: screen.top, left: screen.left, bottom: screen.top + height, right: screen.right });
		DiffRgn(corners, bar, corners);
		PaintRgn(corners);
		MoveTo(screen.left, screen.top + height - 1);
		LineTo(screen.right - 1, screen.top + height - 1);
		layOutTitles();
		for (const e of menuBar) {
			drawTitle(e, e.menu.menuID === theMenu);
		}
		resetColors();
		PenNormal();
	});
}

export function InvalMenuBar(): void {
	DrawMenuBar();
}

function drawTitle(e: { menu: MenuInfo; left: Integer }, hilited: boolean): void {
	const colors = titleColors(e.menu.menuID);
	const r = titleHiliteRect(e);
	withSystemFont(() => {
		TextMode(srcOr);
		if (isColorPort(thePort)) {
			RGBForeColor(hilited ? colors.bar : colors.title);
			RGBBackColor(hilited ? colors.title : colors.bar);
			EraseRect(r);
		} else {
			PenNormal();
			PenPat(white);
			PaintRect(r);
		}
		const baseline = 14;
		if (e.menu.title === '\x14' && inColor()) {
			drawRows(appleMenuTitle.color, appleMenuTitle.colors, e.left + titleTextInset, 2);
		} else if (e.menu.title === '\x14' && appleMenuTitle.mono !== null) {
			// Where the system font's glyph goes: its box starts a pixel right of the pen, at the ascent.
			drawRows(appleMenuTitle.mono, null, e.left + titleTextInset + 1, baseline - 12);
		} else {
			MoveTo(e.left + titleTextInset, baseline);
			DrawString(e.menu.title);
		}
		if ((e.menu.enableFlags & 1) === 0) {
			dim(r);
		}
		if (hilited && !isColorPort(thePort)) {
			InvertRect(r);
		}
		resetColors();
	});
}

/**
 * The Apple menu's title, character 0x14 of the system font: the Apple logo in Chicago. Port: a
 * diamond stands in for the logo. In black and white it is the system font's character 0x14 (a
 * black diamond in Ozma). On a color screen, where the System draws a color logo 2 pixels below
 * the top of the menu bar (as the oracle shows it), it is a diamond in the colors of the old
 * logo's stripes: g green, y yellow, o orange, r red, m magenta, b blue. Tests put the logo back
 * (setAppleMenuTitle) to compare screens with the original's.
 */
export interface AppleMenuTitle {
	/** Rows of color letters ('.' for none), drawn 2 pixels below the top of the menu bar. */
	color: string[];
	colors: Record<string, RGBColor>;
	/** Rows of '#' drawn in the foreground color where the font's glyph would go; null for the glyph. */
	mono: string[] | null;
}

let appleMenuTitle: AppleMenuTitle = {
	color: [
		'............',
		'.....g......',
		'....ggg.....',
		'...yyyyy....',
		'..yyyyyyy...',
		'.ooooooooo..',
		'ooooooooooo.',
		'.rrrrrrrrr..',
		'..mmmmmmm...',
		'...mmmmm....',
		'....bbb.....',
		'.....b......',
		'............',
		'............',
	],
	colors: {
		g: { red: 0x1f21, green: 0xb793, blue: 0x1431 },
		y: { red: 0xfc00, green: 0xf37d, blue: 0x052f },
		o: { red: 0xffff, green: 0x648a, blue: 0x028c },
		r: { red: 0xdd6b, green: 0x08c2, blue: 0x06a2 },
		m: { red: 0xf2d7, green: 0x0856, blue: 0x84ec },
		b: { red: 0x0000, green: 0x0000, blue: 0xd400 },
	},
	mono: null,
};

export function setAppleMenuTitle(title: AppleMenuTitle): void {
	appleMenuTitle = title;
}

/** Draws rows of letters as pixels, each letter in its color (or the foreground color without colors). */
function drawRows(rows: string[], colors: Record<string, RGBColor> | null, left: Integer, top: Integer): void {
	PenNormal();
	rows.forEach((row, y) => {
		for (let x = 0; x < row.length; ) {
			const c = row[x]!;
			let end = x + 1;
			while (end < row.length && row[end] === c) {
				end++;
			}
			if (c !== '.') {
				if (colors !== null) {
					RGBForeColor(colors[c]!);
				}
				PaintRect({ top: top + y, left: left + x, bottom: top + y + 1, right: left + end });
			}
			x = end;
		}
	});
}

/**
 * Grays out drawing by clearing every other pixel to the background: those where the gray pattern
 * is set, which keeps the pixels whose coordinates add up to an odd number (seen in the oracle).
 */
function dim(r: Rect): void {
	PenPat(gray);
	PenMode(patBic);
	PaintRect(r);
	PenNormal();
}

/** Pascal `HiliteMenu`: highlights a title, unhighlighting the one that was. */
export function HiliteMenu(menuID: Integer): void {
	if (menuID === theMenu) {
		return;
	}
	const height = GetMBarHeight();
	const old = menuBar.find((e) => e.menu.menuID === theMenu);
	const next = menuBar.find((e) => e.menu.menuID === menuID);
	theMenu = next === undefined ? 0 : menuID;
	if (height === 0) {
		return;
	}
	drawInScreenPort(() => {
		if (old !== undefined) {
			drawTitle(old, false);
		}
		if (next !== undefined) {
			drawTitle(next, true);
		}
	});
}

/** Pascal `FlashMenuBar`: inverts one title, or the whole menu bar for 0. */
export function FlashMenuBar(menuID: Integer): void {
	const height = GetMBarHeight();
	if (height === 0) {
		return;
	}
	drawInScreenPort(() => {
		const e = menuBar.find((x) => x.menu.menuID === menuID);
		if (menuID === 0 || e === undefined) {
			const screen = screenBits.bounds;
			const clip = NewRgn();
			GetClip(clip);
			SetClip(menuBarRegion());
			InvertRect({ top: screen.top, left: screen.left, bottom: screen.top + height, right: screen.right });
			SetClip(clip);
		} else {
			InvertRect(titleHiliteRect(e));
		}
	});
}

export function SetMenuFlash(count: Integer): void {
	menuFlash = count;
}

/** Port: sets the delay before a submenu appears (low memory MenuDelay, set by the Control Panel). */
export function setMenuDelay(ticks: Integer): void {
	menuDelay = ticks;
}

// ---------------------------------------------------------------------------------------------
// Items

function isEnabled(menu: MenuInfo, item: Integer): boolean {
	if ((menu.enableFlags & 1) === 0) {
		return false;
	}
	return item > 31 || (menu.enableFlags & (1 << item)) !== 0;
}

function isDivider(it: MenuItem): boolean {
	return it.text.startsWith('-');
}

/** Pascal `CalcMenuSize`. */
export function CalcMenuSize(menu: MenuInfo): void {
	menu.menuWidth = withSystemFont(() => {
		let width = 0;
		for (const it of menu.items) {
			TextFace(it.style);
			const extra = it.keyEquiv !== 0 ? commandMargin : itemMargin;
			width = Math.max(width, itemTextInset + StringWidth(it.text) + extra);
		}
		return width;
	});
	menu.menuHeight = menu.items.length * itemHeight;
}

export function CountMItems(menu: MenuInfo): Integer {
	return menu.items.length;
}

/** Pascal `GetItem(theMenu, item, var itemString)`. */
export function GetItem(menu: MenuInfo, item: Integer): string {
	return menu.items[item - 1]?.text ?? '';
}

export function SetItem(menu: MenuInfo, item: Integer, itemString: string): void {
	const it = menu.items[item - 1];
	if (it !== undefined) {
		it.text = itemString;
		CalcMenuSize(menu);
	}
}

export function EnableItem(menu: MenuInfo, item: Integer): void {
	if (item <= 31) {
		menu.enableFlags |= 1 << item;
	}
	if (item === 0) {
		redrawTitleOf(menu);
	}
}

export function DisableItem(menu: MenuInfo, item: Integer): void {
	if (item <= 31) {
		menu.enableFlags &= ~(1 << item);
	}
	if (item === 0) {
		redrawTitleOf(menu);
	}
}

/** The title of a menu that is enabled or disabled as a whole changes at the next DrawMenuBar. */
function redrawTitleOf(_menu: MenuInfo): void {}

export function CheckItem(menu: MenuInfo, item: Integer, checked: boolean): void {
	SetItemMark(menu, item, checked ? checkMark : noMark);
}

/** Pascal `SetItemCmd`: the item's key equivalent, or hMenuCmd to make it a submenu's (its mark the submenu's ID). */
export function SetItemCmd(menu: MenuInfo, item: Integer, cmdChar: Integer): void {
	const it = menu.items[item - 1];
	if (it !== undefined) {
		it.keyEquiv = cmdChar;
		CalcMenuSize(menu);
	}
}

/** Pascal `GetItemCmd`. */
export function GetItemCmd(menu: MenuInfo, item: Integer): Integer {
	return menu.items[item - 1]?.keyEquiv ?? 0;
}

/** Pascal `SetItemMark`; on a hierarchical item the mark is the submenu's ID, so it is left alone. */
export function SetItemMark(menu: MenuInfo, item: Integer, markChar: Integer | string): void {
	const it = menu.items[item - 1];
	if (it !== undefined && it.keyEquiv !== hMenuCmd) {
		it.mark = typeof markChar === 'string' ? macRomanCode(markChar) : markChar;
	}
}

/** Pascal `GetItemMark(theMenu, item, var markChar)`: the mark's character code. */
export function GetItemMark(menu: MenuInfo, item: Integer): Integer {
	return menu.items[item - 1]?.mark ?? 0;
}

export function SetItemIcon(menu: MenuInfo, item: Integer, icon: Integer): void {
	const it = menu.items[item - 1];
	if (it !== undefined) {
		it.icon = icon;
	}
}

export function GetItemIcon(menu: MenuInfo, item: Integer): Integer {
	return menu.items[item - 1]?.icon ?? 0;
}

export function SetItemStyle(menu: MenuInfo, item: Integer, style: Integer): void {
	const it = menu.items[item - 1];
	if (it !== undefined) {
		it.style = style;
		CalcMenuSize(menu);
	}
}

export function GetItemStyle(menu: MenuInfo, item: Integer): Integer {
	return menu.items[item - 1]?.style ?? 0;
}

/** Pascal `HMGetHelpMenuHandle(var mh)`: the Help Manager is System 7's; under System 6 the call fails. */
export function HMGetHelpMenuHandle(mh: Ref<MenuInfo | null>): Integer {
	mh.v = null;
	return -1;
}

// ---------------------------------------------------------------------------------------------
// The standard menu definition (MDEF 0)

function itemRect(menuRect: Rect, item: Integer): Rect {
	const top = menuRect.top + (item - 1) * itemHeight;
	return { top, left: menuRect.left, bottom: top + itemHeight, right: menuRect.right };
}

const hierArrow = [0x80, 0xc0, 0xe0, 0xf0, 0xf8, 0xfc, 0xf8, 0xf0, 0xe0, 0xc0, 0x80];

function drawItem(menu: MenuInfo, menuRect: Rect, item: Integer, hilited: boolean): void {
	const it = menu.items[item - 1];
	if (it === undefined) {
		return;
	}
	const r = itemRect(menuRect, item);
	const colors = itemColors(menu.menuID, item);
	const color = isColorPort(thePort);
	const divider = isDivider(it);
	const enabled = isEnabled(menu, item) && !divider;
	const baseline = r.top + 12;
	TextMode(srcOr);
	if (color) {
		RGBBackColor(hilited ? colors.text : colors.bk);
		EraseRect(r);
	} else {
		PenNormal();
		PenPat(white);
		PaintRect(r);
	}
	if (divider) {
		foreColor(colors.text);
		PenPat(gray);
		MoveTo(r.left, r.top + 8);
		LineTo(r.right - 1, r.top + 8);
		PenNormal();
		resetColors();
		return;
	}
	if (it.mark !== 0 && it.keyEquiv !== hMenuCmd) {
		foreColor(hilited ? colors.bk : colors.mark);
		MoveTo(r.left + markInset, baseline);
		DrawChar(it.mark);
	}
	let textLeft = r.left + itemTextInset;
	if (it.icon !== 0) {
		const icon = GetResource('ICON', 256 + it.icon);
		const iconRect = { top: r.top + 2, left: textLeft, bottom: r.top + 34, right: textLeft + 32 };
		PlotIcon(iconRect, icon);
		textLeft += 36;
	}
	foreColor(hilited ? colors.bk : colors.text);
	TextFace(it.style);
	MoveTo(textLeft, baseline);
	DrawString(it.text);
	TextFace(0);
	if (it.keyEquiv === hMenuCmd) {
		foreColor(hilited ? colors.bk : colors.key);
		drawBits(hierArrow, 6, { top: r.top + 2, left: r.right - 14, bottom: r.top + 13, right: r.right - 8 });
	} else if (it.keyEquiv !== 0) {
		foreColor(hilited ? colors.bk : colors.key);
		MoveTo(r.right - 24, baseline);
		DrawChar(commandMark);
		DrawChar(it.keyEquiv);
	}
	if (!enabled) {
		dim(r);
	}
	if (hilited && !color) {
		InvertRect(r);
	}
	resetColors();
}

/** Draws a small 1-bit image in the foreground color. */
function drawBits(rows: number[], width: number, dst: Rect): void {
	const p = NewPtr(rows.length * 2);
	const bytes = bytesAt(p, rows.length * 2);
	rows.forEach((b, i) => {
		bytes[i * 2] = b;
		bytes[i * 2 + 1] = 0;
	});
	const bm: BitMap = { baseAddr: p, rowBytes: 2, bounds: { top: 0, left: 0, bottom: rows.length, right: width } };
	CopyBits(bm, thePort.portBits, bm.bounds, dst, srcOr, null);
	DisposPtr(p);
}

function drawMenu(menu: MenuInfo, menuRect: Rect): void {
	withSystemFont(() => {
		const colors = titleColors(menu.menuID);
		if (isColorPort(thePort)) {
			RGBBackColor(colors.menuBk);
			EraseRect(menuRect);
		}
		for (let i = 1; i <= menu.items.length; i++) {
			drawItem(menu, menuRect, i, false);
		}
	});
}

/** The item under a point, or 0: dividers and disabled items cannot be chosen. */
function itemAt(menu: MenuInfo, menuRect: Rect, pt: Point): Integer {
	if (!PtInRect(pt, menuRect)) {
		return 0;
	}
	const item = Math.trunc((pt.v - menuRect.top) / itemHeight) + 1;
	const it = menu.items[item - 1];
	return it === undefined || isDivider(it) || !isEnabled(menu, item) ? 0 : item;
}

// ---------------------------------------------------------------------------------------------
// Pulling menus down

/** A menu on the screen, with the pixels it covers. */
interface ShownMenu {
	menu: MenuInfo;
	rect: Rect;
	saved: { bits: PixMap | BitMap; rect: Rect };
	item: Integer;
	/** The hierarchical item that opened this menu, in the menu before it. */
	parentItem: Integer;
}

function menuRectFor(menu: MenuInfo, left: Integer, top: Integer): Rect {
	const screen = screenBits.bounds;
	let l = left;
	if (l + menu.menuWidth > screen.right - 4) {
		l = Math.max(screen.left + 4, screen.right - 4 - menu.menuWidth);
	}
	let t = top;
	if (t + menu.menuHeight > screen.bottom - 4) {
		t = Math.max(GetMBarHeight(), screen.bottom - 4 - menu.menuHeight);
	}
	return { top: t, left: l, bottom: t + menu.menuHeight, right: l + menu.menuWidth };
}

/** Saves what a menu covers, then draws its frame, shadow, and items. */
function showMenu(menu: MenuInfo, rect: Rect, parentItem: Integer): ShownMenu {
	const covered = { top: rect.top - 1, left: rect.left - 1, bottom: rect.bottom + 2, right: rect.right + 2 };
	const saved = saveBits(covered);
	PenNormal();
	resetColors();
	if (!isColorPort(thePort)) {
		PenPat(white);
		PaintRect(rect);
		PenPat(black);
	}
	const frame = { top: rect.top - 1, left: rect.left - 1, bottom: rect.bottom + 1, right: rect.right + 1 };
	FrameRect(frame);
	MoveTo(frame.right, frame.top + 3);
	LineTo(frame.right, frame.bottom);
	MoveTo(frame.left + 3, frame.bottom);
	LineTo(frame.right, frame.bottom);
	drawMenu(menu, rect);
	return { menu, rect, saved: { bits: saved, rect: covered }, item: 0, parentItem };
}

function saveBits(r: Rect): PixMap | BitMap {
	const port = thePort;
	const src = port.portBits;
	const depth = isPixMap(src) ? src.pixelSize : 1;
	const width = r.right - r.left;
	const rowBytes = ((width * depth + 31) >> 5) << 2;
	const height = r.bottom - r.top;
	const base = NewPtr(rowBytes * height);
	const bits: PixMap | BitMap = isPixMap(src) ? { ...src, baseAddr: base, rowBytes: rowBytes | 0x8000, bounds: { ...r } } : { baseAddr: base, rowBytes, bounds: { ...r } };
	CopyBits(src, bits, r, r, srcCopy, null);
	return bits;
}

function restoreMenu(shown: ShownMenu): void {
	resetColors();
	CopyBits(shown.saved.bits, thePort.portBits, shown.saved.rect, shown.saved.rect, srcCopy, null);
	DisposPtr(shown.saved.bits.baseAddr);
}

function titleAt(pt: Point): { menu: MenuInfo; left: Integer } | null {
	const height = GetMBarHeight();
	if (pt.v < screenBits.bounds.top || pt.v >= screenBits.bounds.top + height) {
		return null;
	}
	for (let i = 0; i < menuBar.length; i++) {
		const e = menuBar[i]!;
		const right = i + 1 < menuBar.length ? menuBar[i + 1]!.left : e.left + titleWidth(e.menu) + titleSpacing;
		if (pt.h >= e.left && pt.h < right) {
			return e;
		}
	}
	return null;
}

function submenuOf(menu: MenuInfo, item: Integer): MenuInfo | null {
	const it = menu.items[item - 1];
	if (it === undefined || it.keyEquiv !== hMenuCmd) {
		return null;
	}
	return hierMenus.find((m) => m.menuID === it.mark) ?? null;
}

function setItemHilite(shown: ShownMenu, item: Integer): void {
	if (shown.item === item) {
		return;
	}
	if (shown.item !== 0) {
		withSystemFont(() => drawItem(shown.menu, shown.rect, shown.item, false));
	}
	shown.item = item;
	if (item !== 0) {
		withSystemFont(() => drawItem(shown.menu, shown.rect, item, true));
	}
}

/**
 * Pascal `MenuSelect`: follows the mouse while the button is down, pulling down menus and
 * highlighting items. Returns the chosen menu ID in the high word and item in the low word, or 0.
 * The chosen menu's title stays highlighted until the program calls HiliteMenu(0).
 */
export async function MenuSelect(_startPt: Point): Promise<LongInt> {
	const save = thePort;
	SetPort(screenDrawingPort());
	const clip = NewRgn();
	GetClip(clip);
	ClipRect(screenBits.bounds);
	try {
		return await trackMenus();
	} finally {
		SetClip(clip);
		SetPort(save);
	}
}

/** The tracking loop, in the Window Manager's port. */
async function trackMenus(): Promise<LongInt> {
	const shown: ShownMenu[] = [];
	let title: { menu: MenuInfo; left: Integer } | null = null;
	let hierSince = 0;
	let hierItem = 0;
	const closeFrom = (depth: number): void => {
		while (shown.length > depth) {
			restoreMenu(shown.pop()!);
		}
	};
	for (;;) {
		const pt = { ...mouse.where };
		const t = titleAt(pt);
		if (t !== null && t !== title) {
			closeFrom(0);
			title = t;
			HiliteMenu(t.menu.menuID);
			if (t.menu.items.length > 0) {
				shown.push(showMenu(t.menu, menuRectFor(t.menu, t.left, GetMBarHeight()), 0));
			}
			hierItem = 0;
		} else if (t === null) {
			// The deepest menu under the mouse follows it; the menus it opened close when its item changes.
			let depth = -1;
			for (let i = shown.length - 1; i >= 0; i--) {
				if (PtInRect(pt, shown[i]!.rect)) {
					depth = i;
					break;
				}
			}
			if (depth >= 0) {
				const s = shown[depth]!;
				const item = itemAt(s.menu, s.rect, pt);
				if (item !== s.item) {
					closeFrom(depth + 1);
					setItemHilite(s, item);
					hierItem = submenuOf(s.menu, item) !== null ? item : 0;
					hierSince = TickCount();
				}
				if (hierItem !== 0 && depth === shown.length - 1 && TickCount() - hierSince >= menuDelay) {
					const sub = submenuOf(s.menu, hierItem)!;
					const parent = itemRect(s.rect, hierItem);
					shown.push(showMenu(sub, menuRectFor(sub, s.rect.right - 4, parent.top + 7), hierItem));
					hierItem = 0;
				}
			} else if (shown.length > 0) {
				// Outside every menu, the last menu has no highlighted item, unless that item opened a submenu.
				const last = shown.at(-1)!;
				if (submenuOf(last.menu, last.item) === null) {
					setItemHilite(last, 0);
				}
				hierItem = 0;
			}
		}
		if (!mouse.button) {
			break;
		}
		await getHost().sleep(tickTime(TickCount() + 1));
	}
	// The chosen item is the highlighted one in the deepest menu, unless it opens a submenu.
	const last = shown.at(-1);
	let result: LongInt = 0;
	if (last !== undefined && last.item !== 0 && submenuOf(last.menu, last.item) === null) {
		const item = last.item;
		// The item blinks off and on as soon as the button comes up, 3 ticks each way (seen in the oracle, tick by tick).
		for (let i = 0; i < menuFlash; i++) {
			setItemHilite(last, 0);
			await delayTicks(3);
			setItemHilite(last, item);
			await delayTicks(3);
		}
		result = (last.menu.menuID << 16) | item;
	}
	closeFrom(0);
	if (result === 0) {
		HiliteMenu(0);
	}
	return result;
}

async function delayTicks(n: number): Promise<void> {
	const end = TickCount() + n;
	while (TickCount() < end) {
		await getHost().sleep(tickTime(end));
	}
}

/**
 * Pascal `MenuKey`: the menu and item whose key equivalent is a character, ignoring case, among
 * enabled items of enabled menus; highlights that menu's title.
 */
export function MenuKey(ch: string | Integer): LongInt {
	let code = typeof ch === 'string' ? macRomanCode(ch) : ch;
	if (code >= 0x61 && code <= 0x7a) {
		code -= 0x20;
	}
	if (code >= 0x1b && code <= 0x1f) {
		return 0;
	}
	const search = (menu: MenuInfo, inBar: MenuInfo): LongInt => {
		if ((menu.enableFlags & 1) === 0) {
			return 0;
		}
		for (let i = 1; i <= menu.items.length; i++) {
			const it = menu.items[i - 1]!;
			let key = it.keyEquiv;
			if (key >= 0x61 && key <= 0x7a) {
				key -= 0x20;
			}
			if (key === code && key !== 0 && isEnabled(menu, i)) {
				HiliteMenu(inBar.menuID);
				return (menu.menuID << 16) | i;
			}
			if (it.keyEquiv === hMenuCmd) {
				const sub = hierMenus.find((m) => m.menuID === it.mark);
				if (sub !== undefined) {
					const r = search(sub, inBar);
					if (r !== 0) {
						return r;
					}
				}
			}
		}
		return 0;
	};
	for (const e of menuBar) {
		const r = search(e.menu, e.menu);
		if (r !== 0) {
			return r;
		}
	}
	return 0;
}
