// Port: the Toolbox Event Manager (Inside Macintosh I, chapter 8, and V).
//
// Event calls are async: when no event is waiting they let time pass until the next tick or until
// input arrives, so that event loops do not spin.

import { GlobalToLocal } from './QuickDraw.ts';
import {
	autoKey,
	currentModifiers,
	flushOSEvents,
	keyDown,
	keysDown,
	mouse,
	type OSEvent,
	postOSEvent,
	takeOSEvent,
	TickCount,
	tickTime,
	getHost,
} from './OS.ts';
import type { Integer, LongInt, Point } from './Types.ts';

export { autoKey, keyDown, keyUp, mouseDown, mouseUp, diskEvt, app4Evt, TickCount } from './OS.ts';

export const nullEvent = 0;
export const updateEvt = 6;
export const activateEvt = 8;
export const networkEvt = 10;
export const driverEvt = 11;
export const app1Evt = 12;
export const app2Evt = 13;
export const app3Evt = 14;
export const osEvt = 15;

export const mDownMask = 1 << 1;
export const mUpMask = 1 << 2;
export const keyDownMask = 1 << 3;
export const keyUpMask = 1 << 4;
export const autoKeyMask = 1 << 5;
export const updateMask = 1 << 6;
export const diskMask = 1 << 7;
export const activMask = 1 << 8;
export const everyEvent = -1;

export const charCodeMask = 0x000000ff;
export const keyCodeMask = 0x0000ff00;

// Modifier flags.
export const activeFlag = 0x0001;
export const btnState = 0x0080;
export const cmdKey = 0x0100;
export const shiftKey = 0x0200;
export const alphaLock = 0x0400;
export const optionKey = 0x0800;
export const controlKey = 0x1000;

/** Pascal `EventRecord`. */
export interface EventRecord {
	what: Integer;
	message: LongInt;
	when: LongInt;
	where: Point;
	modifiers: Integer;
}

export function newEventRecord(): EventRecord {
	return { what: nullEvent, message: 0, when: 0, where: { v: 0, h: 0 }, modifiers: 0 };
}

/** Pascal `KeyMap`: which keys are down, by key code. */
export type KeyMap = boolean[];

export function newKeyMap(): KeyMap {
	return Array.from({ length: 128 }, () => false);
}

/**
 * Port: the Window Manager supplies activate and update events, which the Event Manager reports
 * when no input is waiting (activate events come first).
 */
export interface WindowEventSource {
	activateEvent(remove: boolean): EventRecord | null;
	updateEvent(): EventRecord | null;
}

let windowEvents: WindowEventSource | null = null;

export function setWindowEventSource(source: WindowEventSource): void {
	windowEvents = source;
}

/** Ticks before a held key repeats, and between repeats (Inside Macintosh I-246, low memory KeyThresh and KeyRepThresh). */
let keyThresh = 24;
let keyRepThresh = 6;

export function setKeyRepeat(thresh: Integer, repeat: Integer): void {
	keyThresh = thresh;
	keyRepThresh = repeat;
}

/** The last key pressed, for auto-key events. */
let lastKey: { message: LongInt; code: number; next: number } | null = null;

/** Port: called by the host when a key goes down, to post the event and track auto-repeat. */
export function hostKeyDown(code: number, charCode: number): void {
	keysDown[code] = true;
	const message = (code << 8) | charCode;
	postOSEvent(keyDown, message);
	lastKey = { message, code, next: TickCount() + keyThresh };
}

export function hostKeyUp(code: number, charCode: number): void {
	keysDown[code] = false;
	postOSEvent(4, (code << 8) | charCode);
	if (lastKey?.code === code) {
		lastKey = null;
	}
}

function fromOS(e: OSEvent): EventRecord {
	return { what: e.what, message: e.message, when: e.when, where: e.where, modifiers: e.modifiers };
}

/** The next event in the mask, without waiting; null if there is none. */
function nextEvent(mask: Integer, remove: boolean): EventRecord | null {
	if (mask & activMask && windowEvents !== null) {
		const e = windowEvents.activateEvent(remove);
		if (e !== null) {
			return e;
		}
	}
	// keyUp events are not posted by default (the system event mask), so they are not reported.
	const os = takeOSEvent(mask & ~(1 << 4), remove);
	if (os !== null) {
		return fromOS(os);
	}
	if (mask & autoKeyMask && lastKey !== null && keysDown[lastKey.code] && TickCount() >= lastKey.next) {
		const e: EventRecord = { what: autoKey, message: lastKey.message, when: TickCount(), where: { ...mouse.where }, modifiers: currentModifiers() };
		if (remove) {
			lastKey.next = TickCount() + keyRepThresh;
		}
		return e;
	}
	if (mask & updateMask && windowEvents !== null) {
		const e = windowEvents.updateEvent();
		if (e !== null) {
			return e;
		}
	}
	return null;
}

function nullEventRecord(): EventRecord {
	return { what: nullEvent, message: 0, when: TickCount(), where: { ...mouse.where }, modifiers: currentModifiers() };
}

function copyInto(dst: EventRecord, src: EventRecord): void {
	dst.what = src.what;
	dst.message = src.message;
	dst.when = src.when;
	dst.where = { ...src.where };
	dst.modifiers = src.modifiers;
}

/** Returns an event if one is waiting; otherwise lets time pass until the next tick and returns a null event. */
export async function GetNextEvent(mask: Integer, theEvent: EventRecord): Promise<boolean> {
	let e = nextEvent(mask, true);
	if (e === null) {
		await getHost().sleep(tickTime(TickCount() + 1));
		e = nextEvent(mask, true);
	}
	copyInto(theEvent, e ?? nullEventRecord());
	return e !== null;
}

/** Like GetNextEvent, but waits up to `sleep` ticks for an event. The mouse region is ignored. */
export async function WaitNextEvent(mask: Integer, theEvent: EventRecord, sleep: LongInt, _mouseRgn: unknown): Promise<boolean> {
	const until = TickCount() + Math.max(1, sleep);
	let e = nextEvent(mask, true);
	while (e === null && TickCount() < until) {
		await getHost().sleep(tickTime(Math.min(until, TickCount() + 1)));
		e = nextEvent(mask, true);
	}
	copyInto(theEvent, e ?? nullEventRecord());
	return e !== null;
}

/** Whether an event is waiting, without removing it (it fills in the event either way). */
export function EventAvail(mask: Integer, theEvent: EventRecord): boolean {
	const e = nextEvent(mask, false);
	copyInto(theEvent, e ?? nullEventRecord());
	return e !== null;
}

export function FlushEvents(whichMask: Integer, stopMask: Integer): void {
	flushOSEvents(whichMask, stopMask);
	if (whichMask & (keyDownMask | autoKeyMask)) {
		lastKey = null;
	}
}

export function PostEvent(eventCode: Integer, eventMsg: LongInt): Integer {
	postOSEvent(eventCode, eventMsg);
	return 0;
}

/** The mouse location in the current port's local coordinates. */
export function GetMouse(pt: Point): void {
	pt.h = mouse.where.h;
	pt.v = mouse.where.v;
	GlobalToLocal(pt);
}

export function Button(): boolean {
	return mouse.button;
}

/** Whether the button is still down from the press being handled: down, with no mouse-up waiting. */
export function StillDown(): boolean {
	return mouse.button && takeOSEvent(1 << 2, false) === null;
}

/** Like StillDown, but removes the mouse-up event when the button has come up. */
export function WaitMouseUp(): boolean {
	if (StillDown()) {
		return true;
	}
	takeOSEvent(1 << 2, true);
	return false;
}

export function GetKeys(theKeys: KeyMap): void {
	for (let i = 0; i < 128; i++) {
		theKeys[i] = keysDown[i]!;
	}
}

/** Pascal `SystemTask`: desk accessories get time; there are none. */
export function SystemTask(): void {}

/** Ticks between clicks that make a double click (low memory DoubleTime). */
export function GetDblTime(): LongInt {
	return 32;
}

/** Ticks between blinks of the insertion point (low memory CaretTime). */
export function GetCaretTime(): LongInt {
	return 32;
}
