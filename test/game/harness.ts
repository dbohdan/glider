// Runs the ported Glider headless: the platform's machine with the bundled volume and the port's
// System, on a virtual clock that plays scripted input, until a given tick.

import { type Image } from '../../oracle/Image.ts';
import { keyCodes, type Script } from '../../oracle/Script.ts';
import { main } from '../../src/glider/GameBody.ts';
import { autoKeyMask, GetNextEvent, hostKeyDown, hostKeyUp, keyDownMask, newEventRecord } from '../../src/mac/Events.ts';
import { samplesPerTick, setSoundOutput, SMSUpdate } from '../../src/mac/SMS.ts';
import { macRomanChar, macRomanCode } from '../../src/mac/MacRoman.ts';
import { mouseMoved } from '../../src/mac/Cursors.ts';
import { keysDown, mouse, postOSEvent, tickTime } from '../../src/mac/OS.ts';
import { Volume } from '../../src/mac/Volume.ts';
import { setStandardFileHost, type StandardFileHost } from '../../src/mac/StandardFile.ts';
import { bootMachine, type Machine, type MachineKind } from '../../src/platform/Machine.ts';
import { renderScreen } from '../../src/platform/Screen.ts';
import { bundledFiles, systemFork } from '../../tools/build-resources.ts';
import { ScriptHost } from '../toolbox/machine.ts';

/** Thrown out of the program's waits when the run's time is up. */
export class EndOfRun extends Error {
	constructor() {
		super('end of run');
	}
}

/** A ScriptHost that ends the run at a given tick. */
export class GameHost extends ScriptHost {
	endTime = Infinity;
	/** Reads of the clock since time last passed: a program that spins without waiting reads it endlessly. */
	private reads = 0;

	override now(): number {
		if (++this.reads > 1_000_000) {
			throw new Error('the program reads the clock without ever letting time pass');
		}
		return super.now();
	}

	override async sleep(ms: number): Promise<void> {
		this.reads = 0;
		if (ms >= this.endTime) {
			await super.sleep(this.endTime);
			throw new EndOfRun();
		}
		await super.sleep(ms);
	}
}

/** 1992-02-01, when the Glider 4.05 project was last changed, in Mac seconds: a fixed start time. */
export const startDateTime = 2779747200;

export interface GameRun {
	machine: Machine;
	/** The program's volume, with the files it saved. */
	volume: Volume;
	host: GameHost;
	/** The screen as the monitor shows it, with or without the cursor. */
	shot(withCursor?: boolean): Image;
	/** Each tick's sound from SMS, and where SMS wrote it in the Mac Plus sound buffer. */
	sound: Map<number, { samples: Uint8Array; offset: number }>;
}

/**
 * Standard File as the oracle's scripts use it, in place of the page's dialogs: a name typed and
 * Return to save, Return to open the first file listed. The keys come from the event queue, as the
 * original dialog takes them, with any left there before it opened, and the dialog answers in the tick Return arrives: in the oracle,
 * SFPutFile closes on Return without flashing the Save button, and Glider writes the game and goes
 * on playing in that tick (traced: `savedGameProbe`).
 */
export const scriptedStandardFile: StandardFileHost = {
	async getFile(request) {
		await typedUntilReturn();
		return request.files[0]?.name ?? null;
	},
	async putFile(request) {
		const typed = await typedUntilReturn();
		return typed === '' ? request.defaultName : typed;
	},
};

async function typedUntilReturn(): Promise<string> {
	const event = newEventRecord();
	let typed = '';
	for (;;) {
		if (await GetNextEvent(keyDownMask | autoKeyMask, event)) {
			const c = event.message & 0xff;
			if (c === 13 || c === 3) {
				return typed;
			}
			typed = c === 8 ? typed.slice(0, -1) : typed + macRomanChar(c);
		}
	}
}

/**
 * Boots a machine with Glider on its volume; schedule input and screenshots on the host before
 * running. `launchTick` is when Glider starts, as on a Mac that took that long to start up; `house`
 * replaces The House.
 */
export function bootGlider(kind: MachineKind, launchTick = 0, house?: Uint8Array): GameRun {
	const volume = new Volume('Glider');
	for (const f of bundledFiles()) {
		volume.put(f.name === 'The House' && house !== undefined ? { ...f, data: house } : f);
	}
	const host = new GameHost();
	host.wakeOnInput = true;
	host.time = tickTime(launchTick);
	const machine = bootMachine({ kind, system: systemFork(), volume, application: 'Glider 4.05', host, startDateTime });
	setStandardFileHost(scriptedStandardFile);
	const rgba = new Uint8ClampedArray(machine.width * machine.height * 4);
	const shot = (withCursor = false): Image => {
		renderScreen(machine, rgba, withCursor);
		const rgb = new Uint8Array(machine.width * machine.height * 3);
		for (let i = 0; i < machine.width * machine.height; i++) {
			rgb[i * 3] = rgba[i * 4]!;
			rgb[i * 3 + 1] = rgba[i * 4 + 1]!;
			rgb[i * 3 + 2] = rgba[i * 4 + 2]!;
		}
		return { width: machine.width, height: machine.height, rgb };
	};
	const sound = new Map<number, { samples: Uint8Array; offset: number }>();
	setSoundOutput((tick, samples, offset) => sound.set(tick, { samples: samples.slice(), offset }));
	return { machine, volume, host, shot, sound };
}

/** Runs Glider until a tick; returns normally at that tick, or if the program quits. */
export async function runGlider(run: GameRun, endTick: number): Promise<void> {
	run.host.endTime = tickTime(endTick);
	try {
		await main();
	} catch (e) {
		if (!(e instanceof EndOfRun)) {
			throw e;
		}
	}
	SMSUpdate();
}

/**
 * The ticks whose sound differs from the oracle's recording (`Script.sound`; `first` is its first
 * tick), among those SMS played. On a Mac II, the tick after SMS writes its samples plays them
 * all. On a Mac Plus the hardware plays the buffer through each tick as SMS writes it, from where
 * SMS starts writing and round to the start (writeOffset): in the oracle Mini vMac reads the buffer
 * 25 to 40 samples at a time, and SMS's task runs between the first reads or during them, so each
 * sample is the tick's or, up to sample 90, the tick before's.
 * Mini vMac's Mac II sound chip plays only once its FIFO holds 512 samples and stops when it runs
 * dry, so after SMSInit it is silent for up to a second; a Mac II tick of silence is not counted
 * (the Mac Plus's sound shows whether the port plays sound the original does not).
 */
export function soundDifferences(run: GameRun, recording: Uint8Array, first: number): number[] {
	const ii = run.machine.kind === 'ii';
	const n = samplesPerTick;
	const heard = (t: number) => recording.subarray((t - first) * n, (t - first + 1) * n);
	const bad: number[] = [];
	for (const [t, { samples, offset }] of run.sound) {
		const out = heard(ii ? t + 1 : t);
		const before = run.sound.get(t - 1);
		if (out.length < n || (!ii && (before === undefined || t <= first))) {
			continue;
		}
		/** What position p of the buffer holds after SMS writes a tick's samples. */
		const at = (written: { samples: Uint8Array; offset: number }, p: number) => written.samples[(p - written.offset + n) % n];
		const ok = ii
			? out.every((v, i) => v === samples[i]) || out.every((v) => v === 0x80)
			: out.every((v, p) => v === at({ samples, offset }, p) || (p < 90 && v === at(before!, p)));
		if (!ok) {
			bad.push(t);
		}
	}
	return bad;
}

/** The Mac Plus keyboard's arrow keys, by the Apple Extended Keyboard's codes the scripts use. */
const plusArrows: Record<number, number> = { 0x7b: 0x46, 0x7c: 0x42, 0x7d: 0x48, 0x7e: 0x4d };

/** Ticks before a held key repeats, and between repeats: low memory KeyThresh and KeyRepThresh on both oracle Macs. */
const keyThresh = 24;
const keyRepThresh = 6;

/**
 * When the oracle's Mac saw each key transition of a script, from the emulator's KeyMap trace
 * (`Script.traceKeys`): a key reaches the Mac's KeyMap and event queue in the tick after the script
 * presses it, or later, as the Mac's keyboard (or ADB) polling allows. Transitions are matched to the
 * script's in order, by key and direction. On a Mac Plus a key comes as its tick begins. On a Mac II
 * it comes over ADB early in its tick, before or after the program reads the keys: the trace's
 * GetKeys readings tell which, and a key the tick's first GetKeys did not see comes in the middle
 * of it (`arrival`), where a program polling in a loop sees it, as in ClosingAnimation. Likewise, when a held key's repeat falls due in the tick another transition
 * comes, the trace's auto-key events tell which came first; with no repeat in that tick, the
 * transition came as the tick began (the `repeats` case: either, from one tick to the next).
 */
export function oracleKeyTimes(output: string, script: Script, kind: MachineKind): number[] {
	const changes: { tick: number; code: number; down: boolean; used: boolean; read: boolean }[] = [];
	const reads = new Map<number, number[][]>();
	const parse = (hex: string) => Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
	const bit = (map: number[], code: number) => (map[code >> 3]! >> (code & 7)) & 1;
	for (const line of output.split('\n')) {
		// Only the tick's first GetKeys tells that a key was there as the tick began.
		const g = /^getkeys (\d+) ([0-9a-f]{32}) 0$/.exec(line);
		if (g !== null) {
			reads.set(Number(g[1]), [...(reads.get(Number(g[1])) ?? []), parse(g[2]!)]);
		}
	}
	const traced = /^(getkeys|keycheck) /m.test(output);
	// The ticks with auto-key events, and those in which the program asked for them.
	const repeats = new Set<number>();
	const checks = new Set<number>();
	for (const line of output.split('\n')) {
		const r = /^(autokey|keycheck) (\d+)/.exec(line);
		if (r !== null) {
			(r[1] === 'autokey' ? repeats : checks).add(Number(r[2]));
		}
	}
	let last: number[] | null = null;
	for (const line of output.split('\n')) {
		const m = /^keymap (\d+) ([0-9A-F]{32})$/.exec(line);
		if (m === null) {
			continue;
		}
		const map = parse(m[2]!);
		if (last !== null) {
			for (let code = 0; code < 128; code++) {
				const was = bit(last, code);
				const is = bit(map, code);
				if (was !== is) {
					const read = (reads.get(Number(m[1])) ?? []).some((r) => bit(r, code) === is);
					changes.push({ tick: Number(m[1]), code, down: is === 1, used: false, read });
				}
			}
		}
		last = map;
	}
	// Whether a repeat of the key last pressed fell due in a tick in which the program asked for
	// one, before that tick's transitions: KeyThresh ticks after the key went down, then every
	// KeyRepThresh.
	const due = new Set<number>();
	let held: { code: number; since: number; repeated: boolean } | null = null;
	let at = 0;
	for (const c of changes) {
		for (; held !== null && at <= c.tick; at++) {
			if (repeats.has(at)) {
				held.since = at;
				held.repeated = true;
			} else if (checks.has(at) && at - held.since >= (held.repeated ? keyRepThresh : keyThresh)) {
				due.add(at);
			}
		}
		at = c.tick + 1;
		if (c.down) {
			held = { code: c.code, since: c.tick, repeated: false };
		} else if (held?.code === c.code) {
			held = null;
		}
	}
	const ticks: number[] = [];
	let tick = 0;
	for (const line of script.lines) {
		const [op, a = '', b = ''] = line.split(' ');
		if (op === 'w') {
			tick += Number(a);
		} else if (op === 'k') {
			const code = kind === 'plus' ? (plusArrows[Number(a)] ?? Number(a)) : Number(a);
			const c = changes.find((c) => !c.used && c.code === code && c.down === (b === '1') && c.tick > tick);
			if (c === undefined) {
				throw new Error(`the oracle's trace does not show key ${code} going ${b === '1' ? 'down' : 'up'} after tick ${tick}`);
			}
			c.used = true;
			const first = c.read || (due.has(c.tick) && !repeats.has(c.tick));
			ticks.push(c.tick + (kind === 'plus' || (traced && first) ? 0 : arrival.key.ii));
		}
	}
	return ticks;
}

/**
 * A report of a Mac II's ADB mouse to the Mac: in which tick, its movement, its button, and how many
 * CPU cycles into the tick (0 when the emulator gives it as the tick begins, before the program
 * runs).
 */
export interface MouseReport {
	tick: number;
	dh: number;
	dv: number;
	down: boolean;
	cycles: number;
}

/**
 * The ticks at which a Mac Plus's ROM took each button transition of a script, from the trace's
 * low memory MBState (`Script.traceKeys`): it debounces the button at vertical blanking, which takes
 * one tick or two after the script gives it. Null when the run did not trace MBState.
 */
export function oracleButtonTicks(output: string, script: Script): number[] | null {
	const changes: { tick: number; down: boolean; used: boolean }[] = [];
	let last: number | null = null;
	for (const line of output.split('\n')) {
		const m = /^mbstate (\d+) ([0-9A-F]{2})$/.exec(line);
		if (m !== null) {
			const state = parseInt(m[2]!, 16) & 0x80;
			if (last !== null && state !== last) {
				changes.push({ tick: Number(m[1]), down: state === 0, used: false });
			}
			last = state;
		}
	}
	if (last === null) {
		return null;
	}
	const ticks: number[] = [];
	let tick = 0;
	for (const line of script.lines) {
		const [op, a = ''] = line.split(' ');
		if (op === 'w') {
			tick += Number(a);
		} else if (op === 'b') {
			const c = changes.find((c) => !c.used && c.down === (a === '1') && c.tick > tick);
			if (c === undefined) {
				throw new Error(`the oracle's trace does not show the button going ${a === '1' ? 'down' : 'up'} after tick ${tick}`);
			}
			c.used = true;
			ticks.push(c.tick);
		}
	}
	return ticks;
}

/** What the oracle reported of a run's input: when each key arrived, and the ADB mouse's reports. */
export interface OracleTrace {
	/** When each of the script's key transitions reached the Mac (see oracleKeyTimes). */
	keyTimes: number[];
	/** Null when the run did not trace the mouse (`Script.traceMouse`), or on a Mac Plus. */
	mouseReports: MouseReport[] | null;
	/** On a Mac Plus, when the ROM took each button transition; null when not traced. */
	buttonTicks: number[] | null;
}

export function oracleTrace(output: string, script: Script, kind: MachineKind): OracleTrace {
	const reports: MouseReport[] = [];
	for (const line of output.split('\n')) {
		const m = /^adbmouse (\d+) (-?\d+) (-?\d+) ([01]) (\d+)$/.exec(line);
		if (m !== null) {
			reports.push({ tick: Number(m[1]), dh: Number(m[2]), dv: Number(m[3]), down: m[4] === '1', cycles: Number(m[5]) });
		}
	}
	const traced = kind === 'ii' && script.lines.includes('mouse 1');
	return { keyTimes: oracleKeyTimes(output, script, kind), mouseReports: traced ? reports : null, buttonTicks: kind === 'plus' ? oracleButtonTicks(output, script) : null };
}

const keyNames = new Map(Object.entries(keyCodes).map(([name, code]) => [code, name]));

const specialChars: Record<string, number> = { return: 13, enter: 3, tab: 9, space: 32, delete: 8, escape: 27, left: 28, right: 29, up: 30, down: 31 };

const shiftedChars: Record<string, string> = {
	'1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
	'-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?', '`': '~',
};

/** The character a key types on a US keyboard, as a MacRoman code. */
function charCodeOf(name: string, shift: boolean): number {
	if (specialChars[name] !== undefined) {
		return specialChars[name];
	}
	if (name.length !== 1) {
		return 0;
	}
	return macRomanCode(shift ? (shiftedChars[name] ?? name.toUpperCase()) : name);
}

/**
 * When in its tick input reaches the Mac, in ticks after the tick begins.
 * - Keys: the Mac Plus keyboard delivers a key at once, before a game frame's work at the start of
 *   the tick reads the keys. The Mac II's ADB keyboard gives each key as the tick begins, but the
 *   bus's transactions take milliseconds, and the frame has usually read the keys by then; when
 *   the oracle traced the program's GetKeys, the trace says which keys it read in their tick
 *   (oracleKeyTimes), and those come as the tick begins.
 * - The button: on a Mac Plus, the ROM debounces the button at vertical blanking, which takes it
 *   one tick or two after it reaches the Mac (when the oracle traced low memory MBState, the
 *   harness goes by the trace: oracleButtonTicks); on a Mac II it comes over ADB, as keys do
 *   (measured: a menu item starts blinking when the button comes up).
 * - Mouse movements: on a Mac Plus the emulator adds them to low memory as the tick begins; on a
 *   Mac II they come over ADB.
 * A program waiting for an event sees it in the tick it arrives. The emulator places the mouse
 * (`Script.mouse`) by writing low memory as the tick begins, on both machines.
 */
const arrival: Record<'key' | 'button' | 'motion', Record<MachineKind, number>> = {
	key: { plus: 0, ii: 0.5 },
	button: { plus: 1, ii: 0.5 },
	motion: { plus: 0, ii: 0.5 },
};

/**
 * Schedules an oracle script's input on the run's host, and the script's screenshots. The oracle
 * numbers ticks from 1: input the script gives after tick k reaches the Mac in tick k + 1, and a
 * screenshot after tick k shows everything drawn in it. Here tick k is TickCount k, which begins at
 * tickTime(k): keys go down and up in the ticks the oracle's trace says (oracleTrace), or else in
 * the tick after the script presses them, and mouse movements and the button in the ticks of the
 * trace's ADB mouse reports, or else in the tick after the script gives them, as `arrival` says; the mouse is placed as the next tick begins; a
 * screenshot after tick k is taken as tick k + 1 begins. Returns the screenshots, filled in as the
 * run reaches them, and the tick the script ends at.
 */
export function replay(run: GameRun, script: Script, trace?: OracleTrace): { shots: Map<string, Image>; end: number } {
	const shots = new Map<string, Image>();
	const h = run.host;
	const plus = run.machine.kind === 'plus';
	const keyTimes = trace?.keyTimes;
	const buttonTicks = trace?.buttonTicks ?? null;
	let buttonIndex = 0;
	const mouseReports = trace?.mouseReports ?? null;
	// The ADB mouse's reports, when the oracle traced them, come in the ticks the bus's polling gave
	// them: as the tick begins, before the program runs, or later in it.
	for (const r of mouseReports ?? []) {
		h.at(r.tick + (r.cycles === 0 ? 0 : arrival.motion.ii), () => {
			mouse.where = { h: mouse.where.h + r.dh, v: mouse.where.v + r.dv };
			mouseMoved();
			if (r.down !== mouse.button) {
				mouse.button = r.down;
				postOSEvent(r.down ? 1 : 2, 0);
			}
		}, true);
	}
	let tick = 0;
	let keyIndex = 0;
	for (const line of script.lines) {
		const [op, a = '', b = ''] = line.split(' ');
		switch (op) {
			case 'w':
				tick += Number(a);
				break;
			case 'k': {
				const code = Number(a);
				const down = b === '1';
				const name = keyNames.get(code)!;
				const mac = plus ? (plusArrows[code] ?? code) : code;
				h.at(keyTimes?.[keyIndex++] ?? tick + 1 + arrival.key[run.machine.kind], () => {
					if (code >= 0x37 && code <= 0x3b) {
						keysDown[code] = down;
					} else if (down) {
						hostKeyDown(mac, charCodeOf(name, keysDown[0x38]!));
					} else {
						hostKeyUp(mac, charCodeOf(name, keysDown[0x38]!));
					}
				}, true);
				break;
			}
			case 'm': {
				const where = { h: Number(a), v: Number(b) };
				h.at(tick + 1, () => {
					mouse.where = { ...where };
					mouseMoved();
				}, true);
				break;
			}
			case 'd': {
				if (mouseReports !== null) {
					break;
				}
				const [dh, dv] = [Number(a), Number(b)];
				h.at(tick + 1 + arrival.motion[run.machine.kind], () => {
					mouse.where = { h: mouse.where.h + dh, v: mouse.where.v + dv };
					mouseMoved();
				}, true);
				break;
			}
			case 'b': {
				if (mouseReports !== null) {
					break;
				}
				const down = a === '1';
				h.at(buttonTicks?.[buttonIndex++] ?? tick + 1 + arrival.button[run.machine.kind], () => {
					mouse.button = down;
					postOSEvent(down ? 1 : 2, 0);
				}, true);
				break;
			}
			case 's': {
				const name = a;
				h.at(tick + 1, () => shots.set(name, run.shot(true)));
				break;
			}
			// speed and ram dumps have no counterpart.
		}
	}
	return { shots, end: tick + 1 };
}
