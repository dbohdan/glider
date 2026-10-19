// Port: Patrick Buckland's Sound Manager Substitute (SMS), Glider's sound library. Its interface
// is Glider_405/Sources/SMS.p; its code is 68000 object code (Glider_405/Sources/SMSCore.a.o), read
// with a disassembler for what follows, and checked against the sound the oracle records.
//
// SMS plays 'SMSD' resources: a word of priority, a word of repetitions, a word SMS uses as a lock
// count, a spare word, then 8-bit samples at the Mac Plus's 22254.5 per second, 370 to a tick.
// Glider has no 'SMSB' resource, which would send SMS through the Sound Manager on the machines
// it lists, so on every machine a VBL task writes each tick's 370 samples into the Mac Plus sound
// buffer, mixing one, two or four channels. A Mac II plays that buffer too.
//
// Here the VBL task runs once a tick, catching up to TickCount whenever the program calls SMS or
// the platform asks for sound, and gives each tick's samples (in the order they are to be heard)
// to the platform's sound output.

import type { EventRecord } from './Events.ts';
import type { Ptr } from './Memory.ts';
import { TickCount } from './OS.ts';
import { GetResAttrs, GetResource, type Handle } from './Resources.ts';
import { resPreload } from './ResourceFork.ts';
import type { Integer } from './Types.ts';

export const AnyChannel = -1;
export const SMSTime1 = 26;
export const SMSTime2 = 30;
export const SMSTime4 = 42;

/** Samples a tick: SMS writes this many each time its VBL task runs. */
export const samplesPerTick = 370;

/** Priorities of SMSStartLo, SMSStartMid and SMSStartHi; SMSStart takes the sound's own. */
const loPriority = 0;
const midPriority = 0x4000;
const hiPriority = 0x7fff;

/** SMS's error codes, as its routines return them in D0. */
const badChannel = 7;
const noSound = 8;

const center = 0x80;
/** What an idle channel plays: silence, 370 samples. */
const silence = new Uint8Array(samplesPerTick).fill(center);

interface Channel {
	/** The samples, a whole number of ticks long, and where the channel is in them. */
	samples: Uint8Array;
	position: number;
	/** Ticks the sound lasts, and ticks left. */
	ticks: number;
	left: number;
	priority: Integer;
	/** Times to play it: 0 or 1 once, negative forever. */
	repetitions: Integer;
	completion: Ptr | null;
	soundID: Integer;
}

let installed = false;
/** 0 (no sound), 1, 2 or 4 channels. */
let mode: Integer = 0;
/** Whether the VBL task writes samples (SMSSoundOn), or only moves the channels along. */
let soundOn = true;
const channels: (Channel | null)[] = [null, null, null, null];
/** The sound buffer, in the order its samples are heard. */
let buffer = new Uint8Array(silence);
/** The last tick whose VBL task has run. */
let lastTick = 0;
/** The channel being stopped, so that a completion routine starting a sound cannot stop it again. */
let stopping = -1;

/**
 * Where each tick's samples go: the platform's sound output, with how far into the Mac Plus
 * sound buffer SMS wrote them (see writeOffset).
 */
export type SoundOutput = (tick: number, samples: Uint8Array, offset: number) => void;
let output: SoundOutput | null = null;

export function setSoundOutput(o: SoundOutput | null): void {
	output = o;
}

/** Port: SMS as a machine starts, not installed and with no sound output. */
export function resetSMS(): void {
	installed = false;
	mode = 0;
	soundOn = true;
	channels.fill(null);
	buffer = new Uint8Array(silence);
	lastTick = 0;
	stopping = -1;
	output = null;
}

/**
 * How far into the Mac Plus sound buffer SMS starts writing a tick's samples, for the mode: the
 * samples the hardware plays before the VBL task runs (SMSTime1, SMSTime2, SMSTime4). Those first
 * samples of the buffer get the end of the tick's samples, heard at the start of the next tick.
 */
export function writeOffset(m: Integer = mode): number {
	return m === 4 ? SMSTime4 : m === 2 ? SMSTime2 : SMSTime1;
}

/** Runs the VBL task for each tick up to the current one. */
export function SMSUpdate(tick: number = TickCount()): void {
	if (!installed) {
		lastTick = tick;
		return;
	}
	while (lastTick < tick) {
		lastTick++;
		vblTask();
		output?.(lastTick, buffer, writeOffset());
	}
}

/** The VBL task: mixes the channels of the mode into the buffer and moves each along a tick. */
function vblTask(): void {
	if (mode === 0) {
		return;
	}
	if (soundOn) {
		const next = new Uint8Array(samplesPerTick);
		const shift = mode === 4 ? 2 : mode === 2 ? 1 : 0;
		for (let c = 0; c < mode; c++) {
			const ch = channels[c];
			const from = ch === null ? silence : ch.samples.subarray(ch.position, ch.position + samplesPerTick);
			for (let i = 0; i < samplesPerTick; i++) {
				next[i]! += from[i]! >> shift;
			}
		}
		buffer = next;
	}
	for (let c = 0; c < mode; c++) {
		const ch = channels[c];
		if (ch === null) {
			continue;
		}
		ch.position += samplesPerTick;
		if (--ch.left !== 0) {
			continue;
		}
		if (ch.repetitions < 0 || (ch.repetitions > 0 && --ch.repetitions !== 0)) {
			ch.left = ch.ticks;
			ch.position = 0;
		} else {
			stopChannel(c);
		}
	}
}

/** Fills the sound buffer with silence, as SMS does when sound goes off. */
function silenceBuffer(): void {
	buffer = new Uint8Array(silence);
}

/** Ends a channel's sound; SMS would call its completion routine, which Glider never gives. */
function stopChannel(c: number): void {
	if (c === stopping) {
		return;
	}
	const was = stopping;
	stopping = c;
	channels[c] = null;
	stopping = was;
}

/**
 * Loads a sound. SMSLoad pads a sound it loads itself with silence to a whole number of ticks; a
 * sound already in memory, as Glider's (preloaded) are, keeps its length, and its last part tick
 * is never heard (the oracle: a sound of 49.8 ticks plays 49). Returns its samples (after the
 * 8-byte header) and header.
 */
function load(soundID: Integer): { samples: Uint8Array; priority: Integer; repetitions: Integer } | null {
	const h: Handle | null = GetResource('SMSD', soundID);
	if (h === null) {
		return null;
	}
	const extra = (h.data.length - 8) % samplesPerTick;
	if (extra !== 0 && (GetResAttrs(h) & resPreload) === 0) {
		const padded = new Uint8Array(h.data.length + samplesPerTick - extra).fill(center);
		padded.set(h.data);
		h.data = padded;
	}
	const word = (i: number) => ((h.data[i]! << 24) >> 16) | h.data[i + 1]!;
	return { samples: h.data.subarray(8), priority: word(0), repetitions: word(2) };
}

/**
 * The channel for a new sound of a priority: the last free channel, or else the one playing the
 * sound of lowest priority no higher than the new one's; among equals, not one repeating forever,
 * then the fewest repetitions, then (repeating) the shortest sound or (not) the least left, and
 * the first channel of those. -1 if none.
 */
function chooseChannel(priority: Integer): number {
	let chosen = -1;
	let lowest = priority;
	for (let c = mode - 1; c >= 0; c--) {
		const ch = channels[c];
		if (ch === null) {
			return c;
		}
		if (ch.priority > lowest) {
			continue;
		}
		if (ch.priority === lowest && chosen >= 0) {
			const was = channels[chosen]!;
			if (ch.repetitions < 0 || ch.repetitions > was.repetitions) {
				continue;
			}
			if (ch.repetitions === was.repetitions && (ch.repetitions !== 0 ? ch.ticks > was.ticks : ch.left > was.left)) {
				continue;
			}
		}
		chosen = c;
		lowest = ch.priority;
	}
	return chosen;
}

/** SMS's start: the sound, on a channel or any (-1), at a priority (the sound's own if null). */
function start(soundID: Integer, channel: Integer, priority: Integer | null, repetitions: Integer | null, completion: Ptr | null): Integer {
	SMSUpdate();
	const sound = load(soundID);
	if (sound === null) {
		return noSound;
	}
	const p = priority ?? sound.priority;
	const c = channel < 0 ? chooseChannel(p) : channel;
	if (c < 0) {
		return 0;
	}
	if (c >= mode) {
		return badChannel;
	}
	stopChannel(c);
	const ticks = Math.floor(sound.samples.length / samplesPerTick);
	channels[c] = { samples: sound.samples, position: 0, ticks, left: ticks, priority: p, repetitions: repetitions ?? sound.repetitions, completion, soundID };
	return 0;
}

export function SMSInit(): void {
	SMSUpdate();
	silenceBuffer();
	channels.fill(null);
	mode = 0;
	soundOn = true;
	stopping = -1;
	installed = true;
	lastTick = TickCount();
}

export function SMSExit(): void {
	SMSUpdate();
	silenceBuffer();
	installed = false;
}

/** 0, 1, 2 or 4 channels; the channels from the new number on stop. Other numbers do nothing. */
export function SMSSetMode(theMode: Integer): void {
	if (theMode !== 0 && theMode !== 1 && theMode !== 2 && theMode !== 4) {
		return;
	}
	SMSUpdate();
	if (theMode === 0) {
		silenceBuffer();
	}
	for (let c = theMode; c < 4; c++) {
		stopChannel(c);
	}
	mode = theMode;
}

export function SMSGetMode(): Integer {
	return mode;
}

/** Pascal `SMSSwitcher`: for MultiFinder's suspend and resume events; the port has none. */
export function SMSSwitcher(_theEvent: EventRecord): void {}

export function SMSStart(soundID: Integer): void {
	start(soundID, AnyChannel, null, null, null);
}

export function SMSStartLo(soundID: Integer): void {
	start(soundID, AnyChannel, loPriority, null, null);
}

export function SMSStartMid(soundID: Integer): void {
	start(soundID, AnyChannel, midPriority, null, null);
}

export function SMSStartHi(soundID: Integer): void {
	start(soundID, AnyChannel, hiPriority, null, null);
}

export function SMSStartChan(soundID: Integer, channel: Integer): void {
	start(soundID, channel, null, null, null);
}

export function SMSStartBind(soundID: Integer, completionProc: Ptr | null): void {
	start(soundID, AnyChannel, null, null, completionProc);
}

export function SMSStartGen(soundID: Integer, channel: Integer, priority: Integer, repetitions: Integer, completionProc: Ptr | null): void {
	start(soundID, channel, priority, repetitions, completionProc);
}

export function SMSStop(): void {
	SMSUpdate();
	for (let c = 3; c >= 0; c--) {
		stopChannel(c);
	}
}

/** Stops the channels playing sounds of a priority or lower. */
export function SMSStopP(priority: Integer): void {
	for (let c = 3; c >= 0; c--) {
		SMSStopGen(c, priority);
	}
}

export function SMSStopChan(channel: Integer): void {
	SMSUpdate();
	stopChannel(channel);
}

/** Stops a channel if its sound's priority is no higher than the one given. */
export function SMSStopGen(channel: Integer, priority: Integer): void {
	SMSUpdate();
	const ch = channels[channel];
	if (ch !== null && ch !== undefined && priority >= ch.priority) {
		stopChannel(channel);
	}
}

/** Loading, unloading and locking sounds: the port's resources stay in memory. */
export function SMSLoad(soundID: Integer): void {
	load(soundID);
}
export function SMSUnload(_soundID: Integer): void {}
export function SMSLock(soundID: Integer): void {
	load(soundID);
}
export function SMSUnlock(_soundID: Integer): void {}

export function SMSSoundOn(): void {
	SMSUpdate();
	soundOn = true;
}

export function SMSSoundOff(): void {
	SMSUpdate();
	soundOn = false;
	silenceBuffer();
}

export function SMSSetState(state: boolean): void {
	if (state) {
		SMSSoundOn();
	} else {
		SMSSoundOff();
	}
}

export function SMSGetState(): boolean {
	return soundOn;
}

/**
 * Whether any channel of the mode is free (AnyChannel), or a channel, counted from 1 here (SMS
 * subtracts one, where its other routines count from 0).
 */
export function SMSChannelFree(channel: Integer): boolean {
	SMSUpdate();
	if (channel !== AnyChannel) {
		return channels[channel - 1] === null;
	}
	for (let c = mode - 1; c >= 0; c--) {
		if (channels[c] === null) {
			return true;
		}
	}
	return false;
}

/** Pascal `SMSDecompress`: Glider's sounds are not compressed; reports that this one was not. */
export function SMSDecompress(_theSound: Handle): Integer {
	return 0;
}

/** Pascal `SMSSetTiming`: where in the buffer each mode starts writing; the port's output is in order. */
export function SMSSetTiming(_oneChan: Integer, _twoChan: Integer, _threeChan: Integer): void {}

/** Pascal `SMSSoundManager`: whether SMS plays through the Sound Manager; without 'SMSB' it does not. */
export function SMSSoundManager(): boolean {
	return false;
}
