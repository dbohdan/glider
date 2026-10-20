// Port: the machine under the Toolbox: time, the keyboard and mouse, and the operating system's
// event queue. A host (the browser page, or a test) provides time and input.
//
// Time is the machine's own: the page's clock in the browser (stopped while the page is hidden),
// a virtual clock in tests, where waiting moves time forward at once. Ticks are 1/60.15 of a
// second, as on a Mac Plus or Mac II.

import type { Integer, LongInt, Point } from './Types.ts';

export interface Host {
	/** Milliseconds since the machine started. */
	now(): number;
	/** Resolves when the time reaches `ms`, or earlier when input arrives. */
	sleep(ms: number): Promise<void>;
	/**
	 * Whether a key typed or repeated in this tick comes before the program's loop reads the new
	 * tick's clock. On a Mac it depends on where the loop is as the tick begins, and varies from tick to
	 * tick; a test that follows the oracle says what its trace shows. Without it, the clock comes
	 * first.
	 */
	keyBeforeClock?(tick: number): boolean;
}

/** Ticks per second: the 60.15 Hz vertical blanking of the compact Macs' screens. */
export const ticksPerSecond = 60.14742;

let host: Host = {
	now: () => 0,
	sleep: () => Promise.resolve(),
};

export function setHost(h: Host): void {
	host = h;
}

export function getHost(): Host {
	return host;
}

/** Pascal `TickCount`. */
export function TickCount(): LongInt {
	return Math.floor((host.now() * ticksPerSecond) / 1000);
}

/** The time in milliseconds at which a tick begins. */
export function tickTime(tick: number): number {
	return Math.ceil((tick * 1000) / ticksPerSecond);
}

/**
 * Port: lets time pass and input arrive in a loop that would spin on a Mac. Waits until the next
 * tick, or until input arrives.
 */
export async function Yield(): Promise<void> {
	await host.sleep(tickTime(TickCount() + 1));
}

/** Waits until TickCount reaches a value. */
export async function waitUntilTick(tick: number): Promise<void> {
	while (TickCount() < tick) {
		await host.sleep(tickTime(tick));
	}
}

// The keyboard and the mouse, as the host reports them.

/** Which keys are down, by Mac key code (Pascal `KeyMap`). */
export const keysDown: boolean[] = Array.from({ length: 128 }, () => false);

/** The mouse in global coordinates, and its button. */
export const mouse: { where: Point; button: boolean } = { where: { h: 0, v: 0 }, button: false };

/** The modifier keys and button as an event record's modifiers field. */
export function currentModifiers(): Integer {
	let m = mouse.button ? 0 : 0x80; // btnState is set when the button is up
	if (keysDown[0x37]) {
		m |= 0x100; // cmdKey
	}
	if (keysDown[0x38]) {
		m |= 0x200; // shiftKey
	}
	if (keysDown[0x39]) {
		m |= 0x400; // alphaLock
	}
	if (keysDown[0x3a]) {
		m |= 0x800; // optionKey
	}
	if (keysDown[0x3b]) {
		m |= 0x1000; // controlKey
	}
	return m;
}

// The operating system's event queue (Inside Macintosh II, chapter 3).

export interface OSEvent {
	what: Integer;
	message: LongInt;
	when: LongInt;
	where: Point;
	modifiers: Integer;
}

/** The queue holds 20 events, as the System's default (SysEvtCnt). */
const queueLength = 20;
const queue: OSEvent[] = [];

/** Event codes of the events in the queue. */
export const mouseDown = 1;
export const mouseUp = 2;
export const keyDown = 3;
export const keyUp = 4;
export const autoKey = 5;
export const diskEvt = 7;
export const app4Evt = 15;

/** Adds an event, as the keyboard and mouse drivers do; when the queue is full, the oldest is lost. */
export function postOSEvent(what: Integer, message: LongInt): void {
	if (queue.length >= queueLength) {
		queue.shift();
	}
	queue.push({ what, message, when: TickCount(), where: { ...mouse.where }, modifiers: currentModifiers() });
}

/** Takes the first event whose code is in the mask (bit `what` set); null if none. */
export function takeOSEvent(mask: Integer, remove: boolean): OSEvent | null {
	const i = queue.findIndex((e) => (mask & (1 << e.what)) !== 0);
	if (i < 0) {
		return null;
	}
	const e = queue[i]!;
	if (remove) {
		queue.splice(i, 1);
	}
	return { ...e, where: { ...e.where } };
}

/** Removes events in the mask, up to the first event in the stop mask. */
export function flushOSEvents(mask: Integer, stopMask: Integer): void {
	for (let i = 0; i < queue.length; ) {
		const bit = 1 << queue[i]!.what;
		if (stopMask & bit) {
			return;
		}
		if (mask & bit) {
			queue.splice(i, 1);
		} else {
			i++;
		}
	}
}

/** Port: clears the queue and input state, for a new machine or a test. */
export function resetInput(): void {
	queue.length = 0;
	keysDown.fill(false);
	mouse.where = { h: 0, v: 0 };
	mouse.button = false;
}
