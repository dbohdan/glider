// Port: the Standard File Package (Inside Macintosh I, chapter 20, and IV, chapter 15), as System
// 6.0.8's PACK 3 has it, read from its code and checked against the oracle: its two dialogs, to
// open (DLOG -4000, or the program's) and to save (DLOG -3999), with PACK 3's own list of files
// (not the List Manager's), its folder pop-up, and its keys.
//
// The port's volume is one folder, its root, like the oracle's disks, whose system files are at
// the root and invisible: the dialogs show the volume's files and no folders, the pop-up holds only
// the disk, and the Drive and Eject buttons stay dimmed (one disk, which cannot be ejected).

import { Alert, DialogRecord, DisposDialog, editText, GetNewDialog, itemDisable, ModalDialog, ParamText, SelIText, SetIText, type ModalFilterProc } from './Dialogs.ts';
import { ControlRecord, DisposeControl, FindControl, HiliteControl, inDownButton, inPageDown, inPageUp, inThumb, inUpButton, NewControl, scrollBarProc, SetCtlMax, SetCtlMin, SetCtlValue, ShowControl, TrackControl } from './Controls.ts';
import { arrow, SetCursor } from './Cursors.ts';
import { autoKey, Button, cmdKey, diskMask, EventAvail, type EventRecord, GetDblTime, GetMouse, GetNextEvent, keyDown, keyThreshold, mouseDown, newEventRecord, nullEvent, StillDown, TickCount } from './Events.ts';
import { type FInfo, getVolume, portVRefNum } from './Files.ts';
import type { MacFile } from './MacBinary.ts';
import { decodeMacRoman, encodeMacRoman } from './MacRoman.ts';
import { bytesAt, DisposPtr, NewPtr } from './Memory.ts';
import { getHost, tickTime } from './OS.ts';
import {
	type BitMap,
	CharWidth,
	ClipRect,
	CopyBits,
	DisposeRgn,
	DrawString,
	EraseRect,
	FillRect,
	type FontInfo,
	FrameRect,
	GetBackColor,
	GetClip,
	GetFontInfo,
	GetForeColor,
	gray,
	hasColorQD,
	InsetRect,
	InvertRect,
	MoveTo,
	NewRgn,
	PaintRect,
	patBic,
	PenMode,
	PenNormal,
	PenPat,
	PtInRect,
	RGBBackColor,
	RGBForeColor,
	type RGBColor,
	screenBits,
	SetClip,
	SetPort,
	srcCopy,
	StringWidth,
	thePort,
} from './QuickDraw.ts';
import { GetResource, type Handle } from './Resources.ts';
import { put16, s16 } from './Binary.ts';
import { GetMBarHeight, HideWindow, InvalRect, MoveWindow, ShowWindow, ValidRect } from './Windows.ts';
import { type Integer, type OSType, type Point, type Rect, ref } from './Types.ts';

/** Pascal `SFReply`. */
export interface SFReply {
	good: boolean;
	copy: boolean;
	fType: OSType;
	vRefNum: Integer;
	version: Integer;
	fName: string;
}

export function newSFReply(): SFReply {
	return { good: false, copy: false, fType: '\0\0\0\0', vRefNum: 0, version: 0, fName: '' };
}

/** Pascal `SFTypeList`: up to four file types. */
export type SFTypeList = OSType[];

/** What a file filter is given (Pascal `ParmBlkPtr` to a file's parameter block). */
export interface FileParam {
	ioNamePtr: string;
	ioVRefNum: Integer;
	ioFlFndrInfo: FInfo;
	ioFlLgLen: number;
	ioFlRLgLen: number;
	ioFlCrDat: number;
	ioFlMdDat: number;
}

/** A file filter: true to hide the file. */
export type FileFilterProc = (p: FileParam) => boolean;
/** A dialog hook: called with -1 (first time) and with items hit; returns the item to act on. */
export type DlgHookProc = (item: Integer, theDialog: DialogRecord) => Integer | Promise<Integer>;

/** The first call to a dialog hook. */
export const sfHookFirstCall = -1;

/** Items a dialog hook may see or return besides the dialog's own (Inside Macintosh IV-72). */
const sfHookNullEvent = 100;
const sfHookRebuild = 101;
const sfHookFolderPopUp = 102;
/** Keys, as PACK 3's filter returns them: $1000 plus the character. */
const sfKey = 0x1000;

function fileParam(f: MacFile): FileParam {
	return {
		ioNamePtr: f.name,
		ioVRefNum: portVRefNum,
		ioFlFndrInfo: { fdType: f.type, fdCreator: f.creator, fdFlags: f.finderFlags, fdLocation: { v: 0, h: 0 }, fdFldr: 0 },
		ioFlLgLen: f.data.length,
		ioFlRLgLen: f.rsrc.length,
		ioFlCrDat: f.created,
		ioFlMdDat: f.modified,
	};
}

// ---------------------------------------------------------------------------------------------
// Icons

/**
 * PACK 3's seven small icons (offset $1DFE), 16 rows of 16 bits each: a document, a folder, a
 * floppy disk, an open folder, an application, a hard disk, and a folder its user may not open.
 */
const smallIcons = [
	[0x0000, 0x0000, 0x0000, 0x0fc0, 0x0860, 0x0870, 0x0810, 0x0810, 0x0810, 0x0810, 0x0810, 0x0810, 0x0ff0, 0x0000, 0x0000, 0x0000],
	[0x0000, 0x0000, 0x0000, 0x1e00, 0x21f8, 0x2004, 0x2004, 0x2004, 0x2004, 0x2004, 0x2004, 0x3ffc, 0x0000, 0x0000, 0x0000, 0x0000],
	[0x0000, 0x0000, 0x3ff0, 0x48a8, 0x48a4, 0x4824, 0x47c4, 0x4004, 0x4004, 0x47c4, 0x4824, 0x4824, 0x4824, 0x3ffc, 0x0000, 0x0000],
	[0x0000, 0x0000, 0x0000, 0x1e00, 0x21fc, 0x2002, 0xffe2, 0x8012, 0x4012, 0x400a, 0x200a, 0x2006, 0x1ffe, 0x0000, 0x0000, 0x0000],
	[0x0000, 0x0000, 0x0100, 0x0280, 0x0440, 0x0820, 0x10d0, 0x2128, 0x13d0, 0x0898, 0x0478, 0x0298, 0x0100, 0x0000, 0x0000, 0x0000],
	[0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x7ffe, 0x8001, 0x8001, 0xa001, 0x8001, 0x7ffe, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000],
	[0x0000, 0x0000, 0x0000, 0x1e00, 0x35f8, 0x2aac, 0x3554, 0x2aac, 0x3554, 0x2aac, 0x3554, 0x3ffc, 0x0000, 0x0000, 0x0000, 0x0000],
];
const documentIcon = 0;
const applicationIcon = 4;
/**
 * The volume's icon: PACK 3 shows a hard disk for a volume of 2 MB or more, a floppy disk for a
 * smaller one. The port's volume is a hard disk, as the oracle's 8 MB disks are.
 */
const volumeIcon = 5;

/** Copies a small icon into the current port with its top left at (h, v). */
function plotSmallIcon(icon: number, h: number, v: number): void {
	const p = NewPtr(32);
	const bytes = bytesAt(p, 32);
	smallIcons[icon]!.forEach((w, i) => {
		bytes[i * 2] = w >> 8;
		bytes[i * 2 + 1] = w & 0xff;
	});
	const bm: BitMap = { baseAddr: p, rowBytes: 2, bounds: { top: 0, left: 0, bottom: 16, right: 16 } };
	CopyBits(bm, thePort.portBits, bm.bounds, { top: v, left: h, bottom: v + 16, right: h + 16 }, srcCopy, null);
	DisposPtr(p);
}

/**
 * Draws a name at the pen, shortened with an ellipsis to end 2 pixels before `right` (PACK 3's
 * routine at $9D2, for the files, the pop-up, and the disk's name).
 */
function drawTruncated(s: string, textLeft: number, right: number): void {
	const avail = right - textLeft - 2;
	if (StringWidth(s) < avail) {
		DrawString(s);
		return;
	}
	const ellipsis = '…';
	const avail2 = avail - CharWidth(ellipsis);
	let len = s.length - 1;
	while (StringWidth(s.slice(0, len)) >= avail2) {
		len--;
		if (len === 0) {
			break;
		}
	}
	DrawString(s.slice(0, len) + ellipsis);
}

// ---------------------------------------------------------------------------------------------
// Names

/**
 * A name as PACK 3 compares it: upper-cased by _UprString, each byte signed. Port: _UprString also
 * strips diacritical marks from characters above $7F, which are left as they are here.
 */
function sortKey(name: string): number[] {
	return [...encodeMacRoman(name)].map((b) => {
		const c = b >= 0x61 && b <= 0x7a ? b - 0x20 : b;
		return c >= 0x80 ? c - 0x100 : c;
	});
}

/** Compares keys byte by byte; a key that begins another is the smaller (PACK 3's $E58). */
function compareKeys(a: number[], b: number[]): number {
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		if (a[i] !== b[i]) {
			return a[i]! - b[i]!;
		}
	}
	return a.length - b.length;
}

/**
 * Sorts the rows by name with PACK 3's quicksort ($DCA), which decides the order of names that
 * compare equal (differing only in case).
 */
function sortRows(rows: Row[]): Row[] {
	const idx = rows.map((_, i) => i);
	const keys = rows.map((r) => sortKey(r.name));
	const sort = (lo: number, hi: number): void => {
		while (hi - lo > 0) {
			const mid = lo + ((hi - lo) >> 1);
			const pivot = idx[mid]!;
			const key = keys[pivot]!;
			let hole = mid;
			let i = lo;
			let j = hi;
			let fromLeft = true;
			for (;;) {
				if (i >= j) {
					break;
				}
				if (fromLeft) {
					if (i === hole) {
						fromLeft = false;
						continue;
					}
					const e = idx[i++]!;
					if (compareKeys(key, keys[e]!) > 0) {
						continue;
					}
					idx[hole] = e;
					i--;
					hole = i;
					fromLeft = false;
				} else {
					if (hole === j) {
						fromLeft = true;
						continue;
					}
					const e = idx[j--]!;
					if (compareKeys(key, keys[e]!) <= 0) {
						continue;
					}
					idx[hole] = e;
					j++;
					hole = j;
					fromLeft = true;
				}
			}
			idx[hole] = pivot;
			sort(lo, i - 1);
			lo = i + 1;
		}
	};
	sort(0, rows.length - 1);
	return idx.map((i) => rows[i]!);
}

// ---------------------------------------------------------------------------------------------
// The list

/** A row: a file's name, its icon, whether it is dimmed (Put's files), and its type. */
interface Row {
	name: string;
	icon: number;
	dimmed: boolean;
	type: OSType;
}

/** PACK 3's list: rows of one line in `view`, from row `top`, with at most one selected. */
interface SFList {
	view: Rect;
	rows: Row[];
	top: number;
	/** The selected row, or -1. */
	selected: number;
	visibleRows: number;
	lineHeight: number;
	ascent: number;
	bar: ControlRecord | null;
	/** The last click: its row, time, and place (for double clicks). */
	clickCell: number;
	clickTime: number;
	clickLoc: Point;
}

function newList(view: Rect, font: FontInfo, bar: ControlRecord | null): SFList {
	const lineHeight = font.ascent + font.descent + font.leading;
	return {
		view,
		rows: [],
		top: 0,
		selected: -1,
		visibleRows: Math.ceil((view.bottom - view.top) / lineHeight),
		lineHeight,
		ascent: font.ascent,
		bar,
		clickCell: -1,
		clickTime: 0,
		clickLoc: { h: 0, v: 0 },
	};
}

function cellRect(l: SFList, row: number): Rect {
	const top = l.view.top + (row - l.top) * l.lineHeight;
	return { top, left: l.view.left, bottom: top + l.lineHeight, right: l.view.right };
}

const rgbBlack: RGBColor = { red: 0, green: 0, blue: 0 };
const rgbWhite: RGBColor = { red: 0xffff, green: 0xffff, blue: 0xffff };

/**
 * Draws a row (PACK 3's cell routine at $1CBE), clipped to the view: its icon 3 pixels in, its name
 * after it, dimmed rows grayed with patBic (the gray aligned to the port, as item 9's line is), and
 * the selected row white on black: in colors with Color QuickDraw, inverted without.
 */
function drawCell(l: SFList, row: number): void {
	const entry = l.rows[row];
	if (entry === undefined) {
		return;
	}
	const cell = cellRect(l, row);
	const selected = row === l.selected;
	const clip = NewRgn();
	GetClip(clip);
	ClipRect(l.view);
	const fore = { ...rgbBlack };
	const back = { ...rgbWhite };
	if (hasColorQD) {
		GetForeColor(fore);
		GetBackColor(back);
		RGBBackColor(selected ? rgbBlack : rgbWhite);
		RGBForeColor(selected ? rgbWhite : rgbBlack);
	}
	EraseRect(cell);
	PenNormal();
	plotSmallIcon(entry.icon, cell.left + 3, cell.top + Math.max(0, (l.lineHeight - 16) >> 1));
	MoveTo(cell.left + 22, cell.top + l.ascent);
	drawTruncated(entry.name, cell.left + 22, cell.right);
	if (entry.dimmed) {
		PenPat(gray);
		PenMode(patBic);
		PaintRect(cell);
		PenNormal();
	}
	if (hasColorQD) {
		RGBForeColor(fore);
		RGBBackColor(back);
	} else if (selected) {
		InvertRect(cell);
	}
	SetClip(clip);
	DisposeRgn(clip);
}

/** Shows a change of selection: inverts the row without Color QuickDraw, redraws it with. */
function hiliteCell(l: SFList, row: number): void {
	if (hasColorQD) {
		drawCell(l, row);
		return;
	}
	const clip = NewRgn();
	GetClip(clip);
	ClipRect(l.view);
	InvertRect(cellRect(l, row));
	SetClip(clip);
	DisposeRgn(clip);
}

/** Selects a row, or none if it is out of bounds or dimmed ($1BDA). */
function select(l: SFList, row: number): void {
	if (l.selected >= 0) {
		const old = l.selected;
		l.selected = -1;
		hiliteCell(l, old);
	}
	if (row >= 0 && row < l.rows.length && !l.rows[row]!.dimmed) {
		l.selected = row;
		hiliteCell(l, row);
	}
}

function drawRows(l: SFList): void {
	for (let r = l.top; r < Math.min(l.rows.length, l.top + l.visibleRows); r++) {
		drawCell(l, r);
	}
}

/** The scroll bar's state ($15D4): inactive when every row fits. */
function updateScrollBar(l: SFList): void {
	if (l.bar === null) {
		return;
	}
	const max = l.rows.length - l.visibleRows;
	ShowControl(l.bar);
	HiliteControl(l.bar, max <= 0 ? 255 : 0);
	SetCtlMin(l.bar, 0);
	SetCtlMax(l.bar, max);
	SetCtlValue(l.bar, l.top);
}

/**
 * Scrolls by n rows ($1B04), as far as the rows go. Port: PACK 3 scrolls the pixels with
 * ScrollRect and draws the rows uncovered; redrawing every row gives the same pixels.
 */
function scrollBy(l: SFList, n: number): void {
	const top = Math.max(0, Math.min(l.top + n, l.rows.length - l.visibleRows));
	if (top === l.top) {
		return;
	}
	l.top = top;
	EraseRect(l.view);
	drawRows(l);
	if (l.bar !== null) {
		SetCtlMin(l.bar, 0);
		SetCtlMax(l.bar, l.rows.length - l.visibleRows);
		SetCtlValue(l.bar, l.top);
	}
}

/** Scrolls the least that shows a row. */
function reveal(l: SFList, row: number): void {
	if (row < l.top) {
		scrollBy(l, row - l.top);
	} else if (row >= l.top + l.visibleRows) {
		scrollBy(l, row - (l.top + l.visibleRows) + 1);
	}
}

// ---------------------------------------------------------------------------------------------
// The dialog

/** One Standard File dialog's state (PACK 3 keeps it in its stack frame, found by the dialog's refCon). */
interface SFDialog {
	d: DialogRecord;
	isGet: boolean;
	list: SFList;
	/** The list's item: Get's 7, Put's 8. */
	listItem: Integer;
	/** The area the pop-up is drawn in, erased first, and the pop-up box's inside. */
	popUpArea: Rect;
	popUpBox: Rect;
	fileFilter: FileFilterProc | null;
	numTypes: Integer;
	typeList: SFTypeList;
	/** Type-select: the characters typed, and when the last came. */
	typed: number[];
	lastKeyTime: number;
	/** The last event's time and modifiers, for double clicks and Command-arrows. */
	when: number;
	modifiers: Integer;
}

function itemRect(s: SFDialog, item: Integer): Rect {
	return s.d.items[item - 1]!.rect;
}

function volumeName(): string {
	return getVolume()?.name ?? '';
}

/**
 * The files to list ($C3C), sorted. Open shows the files of the types asked for (all if numTypes
 * is negative) that the program's filter keeps, invisible ones included; Save shows every visible
 * file, dimmed.
 */
function gather(s: SFDialog): Row[] {
	const files = [...(getVolume()?.list() ?? [])].sort((a, b) => compareKeys(sortKey(a.name), sortKey(b.name)));
	const rows: Row[] = [];
	for (const f of files) {
		if (s.isGet) {
			if (s.numTypes >= 0 && !s.typeList.slice(0, s.numTypes).includes(f.type)) {
				continue;
			}
			if (s.fileFilter !== null && s.fileFilter(fileParam(f))) {
				continue;
			}
		} else if (f.finderFlags & 0x4000) {
			continue;
		}
		rows.push({ name: f.name, icon: f.type === 'APPL' ? applicationIcon : documentIcon, dimmed: !s.isGet, type: f.type });
	}
	return sortRows(rows);
}

/**
 * The pop-up's rectangles ($1142, $AE0): the area above the list, and the box centered over the
 * list, 25 pixels wider than the folder's name, as wide as the list at most.
 */
function placePopUp(s: SFDialog): void {
	const l = itemRect(s, s.listItem);
	const lh = s.list.lineHeight;
	s.popUpArea = { top: l.top - lh - 6, left: l.left, bottom: l.top - 3, right: l.right };
	const box = { top: l.top - lh - 5, left: l.left + 1, bottom: l.top - 5, right: l.right - 2 };
	const d = Math.max(0, Math.floor((box.right - box.left - 19 - 2 * 3 - StringWidth(volumeName())) / 2));
	InsetRect(box, d, 0);
	s.popUpBox = box;
}

/**
 * Reads the folder ($854): the disk's name and the pop-up are left to the next update, the list is
 * drawn at once, with Open's first row selected.
 */
function readFolder(s: SFDialog): void {
	InvalRect(itemRect(s, 4));
	InvalRect(s.popUpArea);
	const l = s.list;
	l.rows = gather(s);
	l.top = 0;
	l.selected = s.isGet && l.rows.length > 0 ? 0 : -1;
	placePopUp(s);
	EraseRect(l.view);
	drawRows(l);
	updateScrollBar(l);
	ValidRect(l.view);
}

/** A frame with a one-pixel shadow below and to the right ($1518), as the pop-up has. */
function frameWithShadow(f: Rect): void {
	FrameRect(f);
	PaintRect({ top: f.bottom, left: f.left + 1, bottom: f.bottom + 1, right: f.right + 1 });
	PaintRect({ top: f.top + 1, left: f.right, bottom: f.bottom + 1, right: f.right + 1 });
}

/** Item 4's procedure ($A2A): the disk's name, centered in the item, and the folder pop-up. */
function drawDiskAndPopUp(s: SFDialog): void {
	const item = itemRect(s, 4);
	EraseRect(item);
	EraseRect(s.popUpArea);
	const name = volumeName();
	if (name === '') {
		return;
	}
	const d = Math.max(0, Math.floor((item.right - item.left - 19 - StringWidth(name)) / 2));
	plotSmallIcon(volumeIcon, item.left + d, item.top);
	MoveTo(item.left + d + 19, item.top + s.list.ascent);
	drawTruncated(name, item.left + d + 19, item.right);
	const box = s.popUpBox;
	plotSmallIcon(volumeIcon, box.left + 3, box.top);
	MoveTo(box.left + 22, box.top + s.list.ascent);
	drawTruncated(name, box.left + 22, box.right);
	const frame = { ...box };
	InsetRect(frame, -1, -1);
	frameWithShadow(frame);
}

/** The list item's procedure: its frame, its rows, and the scroll bar. */
function drawList(s: SFDialog): void {
	const l = s.list;
	PenNormal();
	FrameRect(itemRect(s, s.listItem));
	drawRows(l);
	if (l.bar !== null) {
		l.bar.contrlVis = 0;
		ShowControl(l.bar);
	}
	updateScrollBar(l);
	ValidRect(l.view);
}

/** Open's item 9: a gray line between Drive and Open ($AC4). */
function drawGrayLine(s: SFDialog): void {
	FillRect(itemRect(s, 9), gray);
}

function button(s: SFDialog, item: Integer): ControlRecord | null {
	const h = s.d.items[item - 1]?.handle;
	return h instanceof ControlRecord ? h : null;
}

/**
 * Dims the buttons that cannot be used, before each ModalDialog ($F38), in PACK 3's order: Open
 * without a selection or Save without a name; Drive with one disk; Eject for a disk that cannot be
 * ejected.
 */
function hiliteButtons(s: SFDialog, reply: SFReply): void {
	const open = button(s, 1);
	if (open !== null) {
		HiliteControl(open, (s.isGet ? s.list.selected < 0 : reply.fName === '') ? 255 : 0);
	}
	for (const item of [6, 5]) {
		const b = button(s, item);
		if (b !== null) {
			HiliteControl(b, 255);
		}
	}
}

/** Fills Open's reply from the selection. */
function fillReply(s: SFDialog, reply: SFReply): void {
	if (s.isGet) {
		const row = s.list.rows[s.list.selected];
		reply.fName = row?.name ?? '';
		reply.fType = row?.type ?? '\0\0\0\0';
	} else {
		const h = s.d.items[6]!.handle as Handle;
		reply.fName = decodeMacRoman(h.data.slice(0, 31));
	}
}

/**
 * PACK 3's ModalDialog filter ($88A): null events come back as item 100, so that the loop runs
 * every tick; Return and Enter choose item 1 without flashing it; Tab is Drive; Command-period is
 * item 3; the up and down arrows, and in Open every other key, come back as $1000 plus the
 * character; a click in the pop-up box is item 102. Save's other keys go to the name.
 */
function sfFilter(s: SFDialog, filterProc: ModalFilterProc | null): ModalFilterProc {
	return async (d, ev, itemHit) => {
		s.when = ev.when;
		s.modifiers = ev.modifiers;
		let handled = sfFilterEvent(s, ev, itemHit);
		if (filterProc !== null) {
			handled = (await filterProc(d, ev, itemHit)) || handled;
		}
		return handled;
	};
}

function sfFilterEvent(s: SFDialog, ev: EventRecord, itemHit: { v: Integer }): boolean {
	switch (ev.what) {
		case nullEvent:
			itemHit.v = sfHookNullEvent;
			return true;
		case keyDown:
		case autoKey: {
			const c = ev.message & 0xff;
			if (c === 0x1e || c === 0x1f) {
				itemHit.v = sfKey + c;
				return true;
			}
			if (ev.what === autoKey) {
				return false;
			}
			if (c === 13 || c === 3) {
				itemHit.v = button(s, 1)?.contrlHilite === 255 ? sfHookNullEvent : 1;
				return true;
			}
			if (c === 9) {
				itemHit.v = button(s, 6)?.contrlHilite === 255 ? sfHookNullEvent : 6;
				return true;
			}
			if (c === 0x2e && ev.modifiers & cmdKey) {
				itemHit.v = 3;
				return true;
			}
			if (s.isGet) {
				itemHit.v = sfKey + c;
				return true;
			}
			return false;
		}
		case mouseDown: {
			const pt = { h: 0, v: 0 };
			GetMouse(pt);
			if (PtInRect(pt, s.popUpBox)) {
				itemHit.v = sfHookFolderPopUp;
				return true;
			}
			return false;
		}
		default:
			if (EventAvail(diskMask, newEventRecord())) {
				itemHit.v = sfHookNullEvent;
				return true;
			}
			return false;
	}
}

/** Waits for the next tick: the port's loops that follow the mouse take one look a tick. */
function nextTick(): Promise<void> {
	return getHost().sleep(tickTime(TickCount() + 1));
}

/**
 * A click in the list ($1622): the row under the mouse is selected while the button is down, none
 * outside the rows, and dragging above or below scrolls. True for a double click: the same row as
 * the last click, within the double-click time and 3 pixels.
 */
async function listClick(s: SFDialog): Promise<boolean> {
	const l = s.list;
	const pt = { h: 0, v: 0 };
	GetMouse(pt);
	const which = ref<ControlRecord | null>(null);
	const part = FindControl(pt, s.d, which);
	if (part !== 0 && which.v === l.bar) {
		await trackScrollBar(l, pt, part);
		return false;
	}
	let first = true;
	let last = -1;
	let result = false;
	for (;;) {
		let inColumn = true;
		if (!PtInRect(pt, l.view)) {
			select(l, -1);
			last = -1;
			inColumn = l.view.left < pt.h && pt.h < l.view.right;
			if (inColumn) {
				if (pt.v <= l.view.top && l.top > 0) {
					scrollBy(l, -1);
				} else if (pt.v >= l.view.bottom && l.top + l.visibleRows < l.rows.length) {
					scrollBy(l, 1);
				}
			}
		}
		if (inColumn) {
			// A 16-bit difference divided unsigned: above the view, a row far out of bounds.
			const cell = l.top + Math.floor(((pt.v - l.view.top) & 0xffff) / l.lineHeight);
			if (cell !== last) {
				last = cell;
				if (cell < l.rows.length && !l.rows[cell]!.dimmed && first) {
					first = false;
					result = cell === l.clickCell;
					l.clickCell = cell;
					result &&= s.when - l.clickTime <= GetDblTime();
					l.clickTime = s.when;
					result &&= Math.abs(pt.v - l.clickLoc.v) < 3 && Math.abs(pt.h - l.clickLoc.h) < 3;
					if (result) {
						l.clickTime = 0;
					}
					l.clickLoc = { ...pt };
				}
				select(l, cell);
				if (cell !== l.clickCell) {
					result = false;
				}
			}
		}
		if (!StillDown()) {
			return result;
		}
		await nextTick();
		GetMouse(pt);
	}
}

/** The scroll bar: the arrows scroll a row, the gray areas a page less a row, the thumb where it is dragged. */
async function trackScrollBar(l: SFList, pt: Point, part: Integer): Promise<void> {
	const bar = l.bar!;
	if (part === inThumb) {
		const before = bar.contrlValue;
		await TrackControl(bar, pt, null);
		scrollBy(l, bar.contrlValue - before);
		return;
	}
	await TrackControl(bar, pt, (_c, p) => {
		const page = l.visibleRows - 1;
		const n = p === inUpButton ? -1 : p === inDownButton ? 1 : p === inPageUp ? -page : p === inPageDown ? page : 0;
		scrollBy(l, n);
	});
}

/** The up and down arrows ($1A86): the next row that is not dimmed, stopping at the ends. */
function arrowKey(l: SFList, c: number): void {
	const step = c === 0x1f ? 1 : -1;
	const last = l.rows.length - 1;
	const cur = l.selected;
	let r = cur < 0 ? (step > 0 ? 0 : last) : cur;
	let tryFirst = cur < 0;
	for (;;) {
		if (!tryFirst) {
			r += step;
			if (r < 0 || r > last) {
				r = cur;
				if (r < 0) {
					return;
				}
			}
		}
		tryFirst = false;
		select(l, r);
		if (l.selected >= 0) {
			break;
		}
	}
	reveal(l, r);
}

/**
 * Type-select ($E84): the characters typed within two key thresholds of each other choose the first
 * row whose name is not before them, or the last row.
 */
function typeSelect(s: SFDialog, c: number): void {
	const l = s.list;
	const now = TickCount();
	if (now - 2 * keyThreshold() >= s.lastKeyTime) {
		s.typed = [];
	}
	if (s.typed.length < 31) {
		s.typed.push(c);
	} else {
		s.typed[30] = c;
	}
	s.lastKeyTime = now;
	const key = sortKey(decodeMacRoman(new Uint8Array(s.typed)));
	let row = l.rows.findIndex((r) => compareKeys(sortKey(r.name), key) >= 0);
	if (row < 0) {
		row = l.rows.length - 1;
	}
	select(l, row);
	if (row < l.top || row >= l.top + l.visibleRows) {
		scrollBy(l, row - l.top);
	}
}

/**
 * The folder pop-up ($132A): a menu of the folders from this one up to the disk, over the box,
 * while the button is down. The port's volume has no folders: the menu holds the disk alone.
 */
async function popUpMenu(s: SFDialog): Promise<void> {
	if (!Button()) {
		return;
	}
	const box = s.popUpBox;
	const portWidth = s.d.portRect.right - s.d.portRect.left;
	const name = volumeName();
	const width = Math.max(box.right - box.left, StringWidth(name) + 25);
	const r = { top: box.top, left: box.left, bottom: box.top + s.list.lineHeight, right: Math.min(box.left + width, portWidth - 16) };
	const font: FontInfo = { ascent: s.list.ascent, descent: s.list.lineHeight - s.list.ascent, widMax: 0, leading: 0 };
	const menu = newList(r, font, null);
	menu.rows = [{ name, icon: volumeIcon, dimmed: false, type: '\0\0\0\0' }];
	menu.selected = 0;
	EraseRect(s.popUpArea);
	const frame = { ...r };
	InsetRect(frame, -1, -1);
	frameWithShadow(frame);
	drawRows(menu);
	const pt = { h: 0, v: 0 };
	while (StillDown()) {
		await nextTick();
		GetMouse(pt);
		const row = PtInRect(pt, r) ? 0 : -1;
		if (row !== menu.selected) {
			select(menu, row);
		}
	}
	await GetNextEvent(0, newEventRecord());
	if (menu.selected >= 0) {
		const u = { top: frame.top, left: frame.left, bottom: frame.bottom + 1, right: frame.right + 1 };
		EraseRect(u);
		InvalRect(u);
		FrameRect(itemRect(s, s.listItem));
	}
}

/**
 * PACK 3's alerts ($BD4): each is moved to stand 12 pixels inside the dialog's lower left corner,
 * by changing its 'ALRT' in memory, as PACK 3 does.
 */
async function sfAlert(s: SFDialog, alertID: Integer): Promise<Integer> {
	const h = GetResource('ALRT', alertID);
	if (h !== null) {
		const t = h.data;
		const height = s16(t, 4) - s16(t, 0);
		const width = s16(t, 6) - s16(t, 2);
		const b = s.d.portBits.bounds;
		const left = s.d.portRect.left - b.left + 12;
		const top = s.d.portRect.bottom - b.top - 12 - height;
		put16(t, 0, top);
		put16(t, 2, left);
		put16(t, 4, top + height);
		put16(t, 6, left + width);
	}
	const item = await Alert(alertID, null);
	SetPort(s.d);
	return item;
}

/** Save's check of the name ($336): a colon is a bad name; a file of that name is replaced if the player says so. */
async function nameAccepted(s: SFDialog, name: string): Promise<boolean> {
	if (name.includes(':')) {
		await sfAlert(s, -3994);
		return false;
	}
	if (getVolume()?.get(name) !== undefined) {
		ParamText(name, '', '', '');
		return (await sfAlert(s, -3996)) === 2;
	}
	return true;
}

/** Runs a dialog (PACK 3's $0000 to $3B2); the reply says what the player chose. */
async function runDialog(
	isGet: boolean,
	where: Point,
	prompt: string,
	origName: string,
	fileFilter: FileFilterProc | null,
	numTypes: Integer,
	typeList: SFTypeList,
	dlgHook: DlgHookProc | null,
	reply: SFReply,
	dlgID: Integer,
	filterProc: ModalFilterProc | null,
): Promise<void> {
	Object.assign(reply, newSFReply());
	const savePort = thePort;
	const d = GetNewDialog(dlgID, null, -1);
	if (d === null) {
		return;
	}
	SetPort(d);
	const font: FontInfo = { ascent: 0, descent: 0, widMax: 0, leading: 0 };
	GetFontInfo(font);
	const listItem = isGet ? 7 : 8;
	const it = d.items[listItem - 1]!.rect;
	const view = { top: it.top, left: it.left, bottom: it.bottom, right: it.right - 15 };
	InsetRect(view, 1, 1);
	const bar = NewControl(d, { top: view.top - 1, left: view.right, bottom: view.bottom + 1, right: view.right + 16 }, '', true, 0, 0, 0, scrollBarProc, 0);
	const s: SFDialog = {
		d,
		isGet,
		list: newList(view, font, bar),
		listItem,
		popUpArea: { top: 0, left: 0, bottom: 0, right: 0 },
		popUpBox: { top: 0, left: 0, bottom: 0, right: 0 },
		fileFilter,
		numTypes,
		typeList,
		typed: [],
		lastKeyTime: 0,
		when: 0,
		modifiers: 0,
	};
	d.items[3]!.type &= ~itemDisable;
	d.items[3]!.handle = () => drawDiskAndPopUp(s);
	if (isGet) {
		SetIText(d.items[9]!.handle as Handle, prompt);
		d.items[6]!.handle = () => drawList(s);
		d.items[8]!.handle = () => drawGrayLine(s);
	} else {
		SetIText(d.items[2]!.handle as Handle, prompt);
		SetIText(d.items[6]!.handle as Handle, origName);
		d.items[7]!.type &= ~itemDisable;
		d.items[7]!.handle = () => drawList(s);
	}
	placePopUp(s);
	if (!isGet && (d.items[6]!.type & 0x7f) === editText) {
		SelIText(d, 7, 0, 300);
	}
	readFolder(s);
	if (dlgHook !== null) {
		await dlgHook(sfHookFirstCall, d);
	}
	// Placed below the menu bar and above the screen's bottom, 7 pixels from each.
	let v = where.v;
	const minTop = (GetMBarHeight() !== 0 ? GetMBarHeight() : 20) + 7;
	if (v < minTop) {
		v = minTop;
	}
	const over = screenBits.bounds.bottom - d.portRect.bottom - v - 7;
	if (over < 0) {
		v += over;
	}
	MoveWindow(d, where.h, v, true);
	ShowWindow(d);
	SetPort(d);
	SetCursor(arrow);
	s.lastKeyTime = TickCount();
	const filter = sfFilter(s, filterProc);
	try {
		for (;;) {
			fillReply(s, reply);
			hiliteButtons(s, reply);
			let item = await ModalDialog(filter);
			SetPort(d);
			if (item === listItem || (isGet && item === 8)) {
				item = (await listClick(s)) ? 1 : sfHookNullEvent;
			} else if (!isGet && item === 7) {
				item = sfHookNullEvent;
			} else if ((item === sfKey + 0x1e || item === sfKey + 0x1f) && s.modifiers & cmdKey) {
				item = item === sfKey + 0x1f ? 1 : 4;
			}
			reply.good = false;
			reply.copy = false;
			fillReply(s, reply);
			if (dlgHook !== null) {
				item = await dlgHook(item, d);
				SetPort(d);
			}
			if (item === 1) {
				if (isGet ? s.list.selected >= 0 : await nameAccepted(s, reply.fName)) {
					reply.good = true;
					reply.vRefNum = portVRefNum;
					return;
				}
			} else if (item === 2 || item === 3) {
				return;
			} else if (item === sfHookRebuild) {
				readFolder(s);
			} else if (item === sfHookFolderPopUp) {
				await popUpMenu(s);
			} else if (item >= sfKey) {
				const c = item - sfKey;
				if (c === 0x1e || c === 0x1f) {
					arrowKey(s.list, c);
				} else if (isGet) {
					typeSelect(s, c);
				}
			}
		}
	} finally {
		HideWindow(d);
		DisposeControl(bar);
		SetPort(savePort);
		DisposDialog(d);
	}
}

/** Pascal `SFPGetFile`: asks for a file of one of the types (all if numTypes is -1) that the filter keeps. */
export function SFPGetFile(
	where: Point,
	prompt: string,
	fileFilter: FileFilterProc | null,
	numTypes: Integer,
	typeList: SFTypeList,
	dlgHook: DlgHookProc | null,
	reply: SFReply,
	dlgID: Integer,
	filterProc: ModalFilterProc | null,
): Promise<void> {
	return runDialog(true, where, prompt, '', fileFilter, numTypes, typeList, dlgHook, reply, dlgID, filterProc);
}

/** Pascal `SFGetFile`, with the standard dialog (-4000). */
export function SFGetFile(where: Point, prompt: string, fileFilter: FileFilterProc | null, numTypes: Integer, typeList: SFTypeList, dlgHook: DlgHookProc | null, reply: SFReply): Promise<void> {
	return SFPGetFile(where, prompt, fileFilter, numTypes, typeList, dlgHook, reply, -4000, null);
}

/** Pascal `SFPutFile`: asks for a name to save under, with the standard dialog (-3999). */
export function SFPutFile(where: Point, prompt: string, origName: string, dlgHook: DlgHookProc | null, reply: SFReply): Promise<void> {
	return SFPPutFile(where, prompt, origName, dlgHook, reply, -3999, null);
}

export function SFPPutFile(where: Point, prompt: string, origName: string, dlgHook: DlgHookProc | null, reply: SFReply, dlgID: Integer, filterProc: ModalFilterProc | null): Promise<void> {
	return runDialog(false, where, prompt, origName, null, -1, [], dlgHook, reply, dlgID, filterProc);
}
