// Port: Patrick Buckland's Sound Manager Substitute (SMS), Glider's sound library, from its
// interface (Glider_405/Sources/SMS.p). The routines keep their names and parameters; what they
// do is the sound backend's, which the platform layer provides (an AudioWorklet in the browser).
// Without one, the program runs silently.

import type { EventRecord } from './Events.ts';
import type { Handle } from './Resources.ts';
import type { Ptr } from './Memory.ts';
import type { Integer } from './Types.ts';

export const AnyChannel = -1;
export const SMSTime1 = 26;
export const SMSTime2 = 30;
export const SMSTime4 = 42;

/** What a sound backend does; each routine of the interface becomes a call to it. */
export interface SMSBackend {
	init(): void;
	exit(): void;
	setMode(mode: Integer): void;
	getMode(): Integer;
	start(soundID: Integer, channel: Integer, priority: Integer, repetitions: Integer, completion: Ptr | null): void;
	stop(channel: Integer, priority: Integer): void;
	setState(on: boolean): void;
	getState(): boolean;
	channelFree(channel: Integer): boolean;
	setTiming(oneChan: Integer, twoChan: Integer, threeChan: Integer): void;
}

/** The silent backend: modes and state are kept, no sound plays. */
function silent(): SMSBackend {
	let mode: Integer = 1;
	let on = true;
	return {
		init: () => {},
		exit: () => {},
		setMode: (m) => {
			mode = m;
		},
		getMode: () => mode,
		start: () => {},
		stop: () => {},
		setState: (s) => {
			on = s;
		},
		getState: () => on,
		channelFree: () => true,
		setTiming: () => {},
	};
}

let backend: SMSBackend = silent();

export function setSMSBackend(b: SMSBackend | null): void {
	backend = b ?? silent();
}

/** Priorities of the Start variants, low to high. */
const loPriority = 0;
const midPriority = 1;
const hiPriority = 2;

export function SMSInit(): void {
	backend.init();
}

export function SMSExit(): void {
	backend.exit();
}

export function SMSSetMode(theMode: Integer): void {
	backend.setMode(theMode);
}

export function SMSGetMode(): Integer {
	return backend.getMode();
}

/** Pascal `SMSSwitcher`: for MultiFinder's suspend and resume events; the port has none. */
export function SMSSwitcher(_theEvent: EventRecord): void {}

export function SMSStart(soundID: Integer): void {
	backend.start(soundID, AnyChannel, midPriority, 1, null);
}

export function SMSStartLo(soundID: Integer): void {
	backend.start(soundID, AnyChannel, loPriority, 1, null);
}

export function SMSStartMid(soundID: Integer): void {
	backend.start(soundID, AnyChannel, midPriority, 1, null);
}

export function SMSStartHi(soundID: Integer): void {
	backend.start(soundID, AnyChannel, hiPriority, 1, null);
}

export function SMSStartChan(soundID: Integer, channel: Integer): void {
	backend.start(soundID, channel, midPriority, 1, null);
}

export function SMSStartBind(soundID: Integer, completionProc: Ptr | null): void {
	backend.start(soundID, AnyChannel, midPriority, 1, completionProc);
}

export function SMSStartGen(soundID: Integer, channel: Integer, priority: Integer, repetitions: Integer, completionProc: Ptr | null): void {
	backend.start(soundID, channel, priority, repetitions, completionProc);
}

export function SMSStop(): void {
	backend.stop(AnyChannel, hiPriority);
}

export function SMSStopP(priority: Integer): void {
	backend.stop(AnyChannel, priority);
}

export function SMSStopChan(channel: Integer): void {
	backend.stop(channel, hiPriority);
}

export function SMSStopGen(channel: Integer, priority: Integer): void {
	backend.stop(channel, priority);
}

/** Loading and locking sounds: the backend has them all in memory. */
export function SMSLoad(_soundID: Integer): void {}
export function SMSUnload(_soundID: Integer): void {}
export function SMSLock(_soundID: Integer): void {}
export function SMSUnlock(_soundID: Integer): void {}

export function SMSSoundOn(): void {
	backend.setState(true);
}

export function SMSSoundOff(): void {
	backend.setState(false);
}

export function SMSSetState(state: boolean): void {
	backend.setState(state);
}

export function SMSGetState(): boolean {
	return backend.getState();
}

export function SMSChannelFree(channel: Integer): boolean {
	return backend.channelFree(channel);
}

/** Pascal `SMSDecompress`: sounds are decompressed by the backend; reports success. */
export function SMSDecompress(_theSound: Handle): Integer {
	return 0;
}

export function SMSSetTiming(oneChan: Integer, twoChan: Integer, threeChan: Integer): void {
	backend.setTiming(oneChan, twoChan, threeChan);
}

/** Pascal `SMSSoundManager`: whether SMS plays through the Sound Manager; the port's backend is its own. */
export function SMSSoundManager(): boolean {
	return false;
}
