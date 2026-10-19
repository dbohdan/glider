// Port: the Dialog Manager (Inside Macintosh I, chapter 13, and V, chapter 15), as in System 6:
// modal dialogs and alerts, their items, and Color QuickDraw's dialog and alert colors.

import { GetMainDevice, parseColorTable } from './Color.ts';
import { ControlRecord, checkBoxProc, Draw1Control, DrawControls, HiliteControl, inButton, NewControl, GetNewControl, pushButProc, radioButProc, TrackControl } from './Controls.ts';
import { autoKey, autoKeyMask, cmdKey, EventAvail, type EventRecord, GetNextEvent, keyDown, mouseDown, newEventRecord, activateEvt, TickCount, updateEvt, everyEvent } from './Events.ts';
import { decodeMacRoman, encodeMacRoman, pascalString } from './MacRoman.ts';
import { forgetAddress } from './Memory.ts';
import { getHost } from './OS.ts';
import { DrawPicture, type Picture } from './Picture.ts';
import {
	type CIcon,
	FrameRect,
	FrameRoundRect,
	GlobalToLocal,
	hasColorQD,
	InsetRect,
	PenNormal,
	PenSize,
	PlotCIcon,
	PlotIcon,
	PtInRect,
	SetPort,
	TextFont,
	thePort,
} from './QuickDraw.ts';
import { GetResource, Handle } from './Resources.ts';
import { s16 } from './Binary.ts';
import { ObscureCursor } from './Cursors.ts';
import { Delay, SysBeep } from './OSUtils.ts';
import { GetCIcon, GetIcon, GetPicture } from './ToolUtils.ts';
import { TEActivate, TEAutoView, TEClick, TEDeactivate, TEIdle, TEKey, TENew, TERec, TESetSelect, TETextBox, teFlushDefault, TECalText, TEUpdate } from './TextEdit.ts';
import { BeginUpdate, CloseWindow, dBoxProc, dialogKind, EndUpdate, eventWindow, FindWindow, FrontWindow, GetWindowList, inContent, inFront, newWindow, SetWinColor, ShowWindow, WindowRecord } from './Windows.ts';
import { type Integer, type LongInt, type Rect, type Ref, ref } from './Types.ts';

/** Item types. */
export const userItem = 0;
export const ctrlItem = 4;
export const btnCtrl = 0;
export const chkCtrl = 1;
export const radCtrl = 2;
export const resCtrl = 3;
export const statText = 8;
export const editText = 16;
export const iconItem = 32;
export const picItem = 64;
export const itemDisable = 128;

/** Standard item numbers. */
export const ok = 1;
export const cancel = 2;

/** A user item's drawing procedure. */
export type UserItemProc = (theWindow: DialogRecord, itemNo: Integer) => void;

/**
 * What GetDItem returns as an item's handle: a control, a text handle (static and edit text), an
 * icon ('ICON' handle or color icon), a picture, or a user item's procedure.
 */
export type ItemHandle = ControlRecord | Handle | CIcon | Picture | UserItemProc | null;

export interface DialogItem {
	handle: ItemHandle;
	rect: Rect;
	type: Integer;
}

/** Pascal `DialogRecord` (a DialogPtr or DialogPeek is a DialogRecord). */
export class DialogRecord extends WindowRecord {
	items: DialogItem[] = [];
	textH: TERec | null = null;
	/** The current edit text item's index (item number - 1), or -1. */
	editField: Integer = -1;
	editOpen: Integer = 0;
	aDefItem: Integer = ok;
}

export type DialogPtr = DialogRecord;
export type DialogPeek = DialogRecord;

/** A filter for ModalDialog and Alert: true if it handled the event and set itemHit. */
export type ModalFilterProc = (theDialog: DialogRecord, theEvent: EventRecord, itemHit: Ref<Integer>) => boolean | Promise<boolean>;

/** The texts that replace ^0 to ^3 in static text items. */
const paramTexts = ['', '', '', ''];
let errorSoundProc: ((soundNo: Integer) => void | Promise<void>) | null = null;

/** Pascal `InitDialogs`: the resume procedure is for system errors, which the port does not have. */
export function InitDialogs(_resumeProc: unknown): void {
	paramTexts.fill('');
	errorSoundProc = null;
	lastAlert = -1;
	alertCount = 0;
}

export function ParamText(param0: string, param1: string, param2: string, param3: string): void {
	paramTexts[0] = param0;
	paramTexts[1] = param1;
	paramTexts[2] = param2;
	paramTexts[3] = param3;
}

/** Pascal `ErrorSound`: what alerts play instead of beeping. */
export function ErrorSound(soundProc: ((soundNo: Integer) => void | Promise<void>) | null): void {
	errorSoundProc = soundProc;
}

// ---------------------------------------------------------------------------------------------
// Creating dialogs

/** Reads a 'DITL' resource into items (controls are made when the dialog is). */
function parseItems(d: Uint8Array): { rect: Rect; type: Integer; data: Uint8Array }[] {
	const items = [];
	let o = 2;
	for (let i = 0; i <= s16(d, 0); i++) {
		const rect = { top: s16(d, o + 4), left: s16(d, o + 6), bottom: s16(d, o + 8), right: s16(d, o + 10) };
		const type = d[o + 12]!;
		const len = d[o + 13]!;
		items.push({ rect, type, data: d.slice(o + 14, o + 14 + len) });
		o += 14 + len + (len & 1);
	}
	return items;
}

/** Whether the dialog draws in color: a color port on a screen deeper than 2 bits. */
function colorScreen(): boolean {
	const device = GetMainDevice();
	return hasColorQD && device !== null && device.gdPMap.pixelSize > 2;
}

/**
 * Pascal `NewDialog` (and `NewCDialog` with `color`). The items come from a 'DITL' resource's
 * bytes; the port's font is the system font.
 */
export function newDialog(
	color: boolean,
	boundsRect: Rect,
	title: string,
	visible: boolean,
	procID: Integer,
	behind: WindowRecord | null | typeof inFront,
	goAwayFlag: boolean,
	refCon: LongInt,
	itemList: Uint8Array,
): DialogRecord {
	const d = new DialogRecord();
	// The items are made invisible until the window is drawn: create it hidden, then show it.
	newWindow(color, boundsRect, title, false, procID, behind, goAwayFlag, refCon, d);
	d.windowKind = dialogKind;
	const save = thePort;
	SetPort(d);
	TextFont(0);
	for (const [i, it] of parseItems(itemList).entries()) {
		const kind = it.type & 0x7f;
		let handle: ItemHandle = null;
		if (kind & ctrlItem) {
			const sub = kind & 3;
			if (sub === resCtrl) {
				handle = GetNewControl(s16(it.data, 0), d);
				if (handle !== null) {
					handle.contrlRect = { ...it.rect };
				}
			} else {
				const procs = [pushButProc, checkBoxProc, radioButProc];
				handle = NewControl(d, it.rect, decodeMacRoman(it.data), false, 0, 0, 1, procs[sub]!, 0);
				handle.contrlVis = 255;
			}
		} else if (kind & (statText | editText)) {
			handle = new Handle(it.data.slice());
			if (kind & editText && d.editField < 0) {
				d.editField = i;
				d.textH = TENew(it.rect, it.rect);
				TEAutoView(true, d.textH);
				d.textH.hText = handle;
				TECalText(d.textH);
				TESetSelect(0, 32767, d.textH);
			}
		} else if (kind & iconItem) {
			const id = s16(it.data, 0);
			// A 'cicn' of the same ID, on a color screen, even in a dialog that is not a color window
			// (seen in the oracle: Glider's Configure dialog, which has no 'dctb').
			handle = (colorScreen() ? GetCIcon(id) : null) ?? GetIcon(id);
		} else if (kind & picItem) {
			handle = GetPicture(s16(it.data, 0));
		}
		d.items.push({ handle, rect: { ...it.rect }, type: it.type });
	}
	SetPort(save);
	if (visible) {
		showDialog(d);
	}
	return d;
}

function showDialog(d: DialogRecord): void {
	ShowWindow(d);
}

export function NewDialog(
	_dStorage: null,
	boundsRect: Rect,
	title: string,
	visible: boolean,
	procID: Integer,
	behind: WindowRecord | null | typeof inFront,
	goAwayFlag: boolean,
	refCon: LongInt,
	items: Handle,
): DialogRecord {
	return newDialog(false, boundsRect, title, visible, procID, behind, goAwayFlag, refCon, items.data);
}

/**
 * Pascal `GetNewDialog`: from a 'DLOG' and its 'DITL'. With Color QuickDraw and a 'dctb' of the
 * same ID, the dialog is a color window in the dctb's colors.
 */
export function GetNewDialog(dialogID: Integer, _dStorage: null, behind: WindowRecord | null | typeof inFront): DialogRecord | null {
	const h = GetResource('DLOG', dialogID);
	if (h === null) {
		return null;
	}
	const t = h.data;
	const ditl = GetResource('DITL', s16(t, 18));
	if (ditl === null) {
		return null;
	}
	const dctb = hasColorQD ? GetResource('dctb', dialogID) : null;
	const rect = { top: s16(t, 0), left: s16(t, 2), bottom: s16(t, 4), right: s16(t, 6) };
	const d = newDialog(dctb !== null, rect, pascalString(t, 20), false, s16(t, 8), behind, t[12] !== 0, (s16(t, 14) << 16) | (s16(t, 16) & 0xffff), ditl.data);
	if (dctb !== null) {
		SetWinColor(d, parseColorTable(dctb.data));
	}
	if (t[10] !== 0) {
		showDialog(d);
	}
	return d;
}

/** Pascal `CloseDialog`: closes the window; the items' handles are the program's to keep. */
export function CloseDialog(theDialog: DialogRecord): void {
	CloseWindow(theDialog);
}

/** Pascal `DisposDialog`. */
export function DisposDialog(theDialog: DialogRecord): void {
	CloseWindow(theDialog);
	forgetAddress(theDialog);
}

export function CouldDialog(_dialogID: Integer): void {}
export function FreeDialog(_dialogID: Integer): void {}
export function CouldAlert(_alertID: Integer): void {}
export function FreeAlert(_alertID: Integer): void {}

// ---------------------------------------------------------------------------------------------
// Items

/** Pascal `GetDItem(theDialog, itemNo, var itemType, var item, var box)`. */
export function GetDItem(theDialog: DialogRecord, itemNo: Integer, itemType: Ref<Integer>, item: Ref<ItemHandle>, box: Rect): void {
	const it = theDialog.items[itemNo - 1];
	if (it === undefined) {
		return;
	}
	itemType.v = it.type;
	item.v = it.handle;
	Object.assign(box, it.rect);
}

export function SetDItem(theDialog: DialogRecord, itemNo: Integer, itemType: Integer, item: ItemHandle, box: Rect): void {
	const it = theDialog.items[itemNo - 1];
	if (it !== undefined) {
		it.type = itemType;
		it.handle = item;
		it.rect = { ...box };
	}
}

/** The dialog and item a text handle belongs to: the current port's, as the ROM assumes, or any open dialog's. */
function itemOfHandle(h: Handle): { d: DialogRecord; index: number } | null {
	const dialogs: DialogRecord[] = thePort instanceof DialogRecord ? [thePort] : [];
	for (let w = GetWindowList(); w !== null; w = w.nextWindow) {
		if (w instanceof DialogRecord) {
			dialogs.push(w);
		}
	}
	for (const d of dialogs) {
		const index = d.items.findIndex((it) => it.handle === h);
		if (index >= 0) {
			return { d, index };
		}
	}
	return null;
}

/** Pascal `GetIText(item, var text)`. */
export function GetIText(item: Handle): string {
	return decodeMacRoman(item.data);
}

/** Pascal `SetIText`: changes a static or edit text item's text and redraws it. */
export function SetIText(item: Handle, text: string): void {
	item.data = encodeMacRoman(text);
	const found = itemOfHandle(item);
	if (found === null) {
		return;
	}
	const { d, index } = found;
	if (index === d.editField && d.textH !== null) {
		TECalText(d.textH);
		TESetSelect(32767, 32767, d.textH);
	}
	if (d.visible) {
		const save = thePort;
		SetPort(d);
		drawItem(d, index);
		SetPort(save);
	}
}

/** Pascal `SelIText`: makes an edit text item current and selects part of its text. */
export function SelIText(theDialog: DialogRecord, itemNo: Integer, strtSel: Integer, endSel: Integer): void {
	const index = itemNo - 1;
	const it = theDialog.items[index];
	if (it === undefined || (it.type & 0x7f) !== editText) {
		return;
	}
	const save = thePort;
	SetPort(theDialog);
	setEditField(theDialog, index);
	TESetSelect(strtSel, endSel, theDialog.textH!);
	SetPort(save);
}

/** Makes an edit text item the current one, moving the text record to it. */
function setEditField(d: DialogRecord, index: number): void {
	if (d.editField === index && d.textH !== null) {
		return;
	}
	const it = d.items[index]!;
	if (d.textH !== null) {
		TEDeactivate(d.textH);
	}
	const te = d.textH ?? TENew(it.rect, it.rect);
	TEAutoView(true, te);
	te.destRect = { ...it.rect };
	te.viewRect = { ...it.rect };
	te.hText = it.handle as Handle;
	te.selStart = te.selEnd = 0;
	TECalText(te);
	d.textH = te;
	d.editField = index;
	if (d.visible && d === FrontWindow()) {
		TEUpdate(it.rect, te);
		TEActivate(te);
	}
}

/** Pascal `HideDItem`: moves the item far to the right, where it cannot be seen. */
export function HideDItem(theDialog: DialogRecord, itemNo: Integer): void {
	const it = theDialog.items[itemNo - 1];
	if (it === undefined || it.rect.left > 8192) {
		return;
	}
	it.rect.left += 16384;
	it.rect.right += 16384;
	if (it.handle instanceof ControlRecord) {
		it.handle.contrlRect.left += 16384;
		it.handle.contrlRect.right += 16384;
	}
}

export function ShowDItem(theDialog: DialogRecord, itemNo: Integer): void {
	const it = theDialog.items[itemNo - 1];
	if (it === undefined || it.rect.left <= 8192) {
		return;
	}
	it.rect.left -= 16384;
	it.rect.right -= 16384;
	if (it.handle instanceof ControlRecord) {
		it.handle.contrlRect.left -= 16384;
		it.handle.contrlRect.right -= 16384;
		Draw1Control(it.handle);
	} else {
		const save = thePort;
		SetPort(theDialog);
		drawItem(theDialog, itemNo - 1);
		SetPort(save);
	}
}

/** A static text's text with ^0 to ^3 replaced. */
function substituted(data: Uint8Array): Uint8Array {
	const s = decodeMacRoman(data).replace(/\^([0-3])/g, (_, n: string) => paramTexts[Number(n)]!);
	return encodeMacRoman(s);
}

/** Draws an item other than a control, in the dialog's port. */
function drawItem(d: DialogRecord, index: number): void {
	const it = d.items[index]!;
	const kind = it.type & 0x7f;
	if (kind & ctrlItem) {
		if (it.handle instanceof ControlRecord) {
			Draw1Control(it.handle);
		}
	} else if (kind & statText) {
		const text = substituted((it.handle as Handle).data);
		TETextBox(text, text.length, it.rect, teFlushDefault);
	} else if (kind & editText) {
		if (index === d.editField && d.textH !== null) {
			TEUpdate(it.rect, d.textH);
		} else {
			const text = (it.handle as Handle).data;
			TETextBox(text, text.length, it.rect, teFlushDefault);
		}
		PenNormal();
		const frame = { ...it.rect };
		InsetRect(frame, -3, -3);
		FrameRect(frame);
	} else if (kind & iconItem) {
		const icon = it.handle;
		if (icon instanceof Handle) {
			PlotIcon(it.rect, icon);
		} else if (icon !== null && typeof icon === 'object' && 'iconPMap' in icon) {
			PlotCIcon(it.rect, icon);
		}
	} else if (kind & picItem) {
		if (it.handle !== null && typeof it.handle === 'object' && 'data' in it.handle) {
			DrawPicture(it.handle, it.rect);
		}
	} else if (typeof it.handle === 'function') {
		it.handle(d, index + 1);
	}
}

/** Pascal `DrawDialog`: the controls, then the other items in order. */
export function DrawDialog(theDialog: DialogRecord): void {
	const save = thePort;
	SetPort(theDialog);
	DrawControls(theDialog);
	for (let i = 0; i < theDialog.items.length; i++) {
		if (!(theDialog.items[i]!.type & ctrlItem)) {
			drawItem(theDialog, i);
		}
	}
	if (theDialog.textH !== null && theDialog === FrontWindow()) {
		TEActivate(theDialog.textH);
	}
	SetPort(save);
}

/** Pascal `UpdtDialog`: redraws the items in an update region. */
export function UpdtDialog(theDialog: DialogRecord, _updateRgn: unknown): void {
	DrawDialog(theDialog);
}

// ---------------------------------------------------------------------------------------------
// Running dialogs

/** The item under a point in the dialog's coordinates, or 0. */
function findItem(d: DialogRecord, pt: { h: number; v: number }): number {
	for (let i = 0; i < d.items.length; i++) {
		if (PtInRect(pt, d.items[i]!.rect)) {
			return i + 1;
		}
	}
	return 0;
}

function enabled(d: DialogRecord, item: number): boolean {
	return (d.items[item - 1]!.type & itemDisable) === 0;
}

/**
 * Handles one event in a dialog: returns the enabled item it hit, or 0. Mouse-downs elsewhere beep,
 * as they do in a modal dialog.
 */
async function handleEvent(d: DialogRecord, ev: EventRecord, modal: boolean): Promise<number> {
	switch (ev.what) {
		case mouseDown: {
			const which = ref<WindowRecord | null>(null);
			const part = FindWindow(ev.where, which);
			if (which.v !== d || part !== inContent) {
				if (modal) {
					SysBeep(1);
				}
				return 0;
			}
			const save = thePort;
			SetPort(d);
			const pt = { ...ev.where };
			GlobalToLocal(pt);
			const item = findItem(d, pt);
			let hit = 0;
			if (item !== 0) {
				const it = d.items[item - 1]!;
				const kind = it.type & 0x7f;
				if (kind & ctrlItem && it.handle instanceof ControlRecord) {
					if (it.handle.contrlHilite !== 255 && (await TrackControl(it.handle, pt, null)) !== 0) {
						hit = item;
					}
				} else if (kind & editText) {
					setEditField(d, item - 1);
					await TEClick(pt, (ev.modifiers & 0x200) !== 0, d.textH!);
					hit = item;
				} else {
					hit = item;
				}
			}
			SetPort(save);
			return hit !== 0 && enabled(d, hit) ? hit : 0;
		}
		case keyDown:
		case autoKey: {
			// ModalDialog gives Command keys to the edit text too: in the oracle, the "s" of Command-S
			// was typed into Standard File's name (its filter passes the key on).
			if (!modal && ev.modifiers & cmdKey) {
				return 0;
			}
			if (d.editField >= 0 && d.textH !== null) {
				// Typing hides the cursor until the mouse moves (seen in the oracle).
				ObscureCursor();
				const save = thePort;
				SetPort(d);
				TEKey(ev.message & 0xff, d.textH);
				SetPort(save);
				const item = d.editField + 1;
				return enabled(d, item) ? item : 0;
			}
			return 0;
		}
		case updateEvt: {
			const w = eventWindow(ev.message);
			if (w === d) {
				const save = thePort;
				SetPort(d);
				BeginUpdate(d);
				DrawDialog(d);
				EndUpdate(d);
				SetPort(save);
			}
			return 0;
		}
		case activateEvt: {
			if (eventWindow(ev.message) === d && d.textH !== null) {
				if (ev.modifiers & 1) {
					TEActivate(d.textH);
				} else {
					TEDeactivate(d.textH);
				}
			}
			return 0;
		}
		default:
			return 0;
	}
}

/**
 * Pascal `ModalDialog(filterProc, var itemHit)`: handles events in the front window, a dialog,
 * until an enabled item is hit, and returns it. Without a filter, Return and Enter hit the default
 * item.
 */
export async function ModalDialog(filterProc: ModalFilterProc | null): Promise<Integer> {
	const d = FrontWindow();
	if (!(d instanceof DialogRecord)) {
		throw new Error('ModalDialog with no dialog in front');
	}
	const idle = (): void => {
		if (d.textH !== null) {
			const save = thePort;
			SetPort(d);
			TEIdle(d.textH);
			SetPort(save);
		}
	};
	for (;;) {
		const ev = newEventRecord();
		await GetNextEvent(everyEvent, ev);
		// TEIdle blinks the caret when the clock says, and a repeat typed at the caret hides it: in a
		// tick where both fall due, which comes first is a race on a Mac, decided by where the loop is
		// as the tick begins (traced in the oracle: the high-score name, `room9`). The clock comes
		// first unless the host says otherwise; then TEIdle waits for the repeat.
		const repeatFirst = getHost().repeatBeforeClock?.(TickCount()) ?? false;
		const waiting = repeatFirst && ev.what !== autoKey && EventAvail(autoKeyMask, newEventRecord());
		if (!waiting && !(repeatFirst && ev.what === autoKey)) {
			idle();
		}
		const hit = await respond(d, ev, filterProc);
		if (repeatFirst && ev.what === autoKey) {
			idle();
		}
		if (hit !== null) {
			return hit;
		}
	}
}

/** ModalDialog's answer to one event: the item to return, or null to go on. */
async function respond(d: DialogRecord, ev: EventRecord, filterProc: ModalFilterProc | null): Promise<Integer | null> {
	if (filterProc !== null) {
		const itemHit = ref<Integer>(0);
		if (await filterProc(d, ev, itemHit)) {
			return itemHit.v;
		}
	} else if ((ev.what === keyDown || ev.what === autoKey) && ((ev.message & 0xff) === 13 || (ev.message & 0xff) === 3)) {
		await flashButton(d, d.aDefItem);
		return d.aDefItem;
	}
	const hit = await handleEvent(d, ev, true);
	return hit !== 0 ? hit : null;
}

/**
 * The standard filter's answer to Return and Enter: the default button looks pressed for 8 ticks
 * (measured in the oracle: highlighted in the tick the key arrives, unhighlighted 8 ticks later).
 */
async function flashButton(d: DialogRecord, itemNo: Integer): Promise<void> {
	const it = d.items[itemNo - 1];
	if (it === undefined || !(it.handle instanceof ControlRecord)) {
		return;
	}
	const save = thePort;
	SetPort(d);
	HiliteControl(it.handle, inButton);
	await Delay(8);
	HiliteControl(it.handle, 0);
	SetPort(save);
}

/** Pascal `IsDialogEvent`: whether an event is for a dialog in front. */
export function IsDialogEvent(theEvent: EventRecord): boolean {
	if (theEvent.what === updateEvt || theEvent.what === activateEvt) {
		return eventWindow(theEvent.message) instanceof DialogRecord;
	}
	return FrontWindow() instanceof DialogRecord;
}

/** Pascal `DialogSelect(theEvent, var theDialog, var itemHit)`: handles an event in a modeless dialog. */
export async function DialogSelect(theEvent: EventRecord, theDialog: Ref<DialogRecord | null>, itemHit: Ref<Integer>): Promise<boolean> {
	const target = theEvent.what === updateEvt || theEvent.what === activateEvt ? eventWindow(theEvent.message) : FrontWindow();
	if (!(target instanceof DialogRecord)) {
		return false;
	}
	theDialog.v = target;
	const hit = await handleEvent(target, theEvent, false);
	itemHit.v = hit;
	return hit !== 0;
}

// ---------------------------------------------------------------------------------------------
// Alerts

let lastAlert: Integer = -1;
let alertCount: Integer = 0;

/** Pascal `GetAlrtStage`: how many times in a row the last alert has been shown, less one (0 to 3). */
export function GetAlrtStage(): Integer {
	return alertCount;
}

export function ResetAlrtStage(): void {
	lastAlert = -1;
	alertCount = 0;
}

/**
 * Pascal `Alert`: shows an alert from an 'ALRT' and its 'DITL' as its stage says (beeps, whether
 * to draw it, which button is the default), and returns the item hit, or -1 if it is not drawn.
 * With Color QuickDraw and an 'actb' of the same ID, the alert is in the actb's colors.
 */
export async function Alert(alertID: Integer, filterProc: ModalFilterProc | null): Promise<Integer> {
	const h = GetResource('ALRT', alertID);
	if (h === null) {
		return -1;
	}
	const t = h.data;
	const rect = { top: s16(t, 0), left: s16(t, 2), bottom: s16(t, 4), right: s16(t, 6) };
	const ditl = GetResource('DITL', s16(t, 8));
	if (ditl === null) {
		return -1;
	}
	if (alertID === lastAlert) {
		alertCount = Math.min(alertCount + 1, 3);
	} else {
		lastAlert = alertID;
		alertCount = 0;
	}
	const stages = (t[10]! << 8) | t[11]!;
	const stage = (stages >> (alertCount * 4)) & 15;
	const sound = stage & 3;
	const drawn = (stage & 4) !== 0;
	const defaultItem = stage & 8 ? cancel : ok;
	if (errorSoundProc !== null) {
		await errorSoundProc(sound);
	} else {
		for (let i = 0; i < sound; i++) {
			SysBeep(3);
		}
	}
	if (!drawn) {
		return -1;
	}
	const actb = hasColorQD ? GetResource('actb', alertID) : null;
	const d = newDialog(actb !== null, rect, '', false, dBoxProc, inFront, false, 0, ditl.data);
	d.aDefItem = defaultItem;
	if (actb !== null) {
		SetWinColor(d, parseColorTable(actb.data));
	}
	ShowWindow(d);
	const save = thePort;
	SetPort(d);
	DrawDialog(d);
	// The default button's bold outline.
	const def = d.items[defaultItem - 1];
	if (def !== undefined && def.handle instanceof ControlRecord) {
		const r = { ...def.rect };
		InsetRect(r, -4, -4);
		PenSize(3, 3);
		FrameRoundRect(r, 16, 16);
		PenNormal();
	}
	// The update event the window brought is taken care of: what it would draw is drawn.
	BeginUpdate(d);
	EndUpdate(d);
	let item: Integer;
	try {
		item = await ModalDialog(filterProc);
	} finally {
		SetPort(save);
	}
	DisposDialog(d);
	return item;
}

export function StopAlert(alertID: Integer, filterProc: ModalFilterProc | null): Promise<Integer> {
	return Alert(alertID, filterProc);
}

export function NoteAlert(alertID: Integer, filterProc: ModalFilterProc | null): Promise<Integer> {
	return Alert(alertID, filterProc);
}

export function CautionAlert(alertID: Integer, filterProc: ModalFilterProc | null): Promise<Integer> {
	return Alert(alertID, filterProc);
}

