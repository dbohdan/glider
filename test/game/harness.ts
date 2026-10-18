// Runs the ported Glider headless: the platform's machine with the bundled volume and the port's
// System, on a virtual clock that plays scripted input, until a given tick.

import { type Image } from '../../oracle/Image.ts';
import { keyCodes, type Script } from '../../oracle/Script.ts';
import { main } from '../../src/glider/GameBody.ts';
import { hostKeyDown, hostKeyUp } from '../../src/mac/Events.ts';
import { macRomanCode } from '../../src/mac/MacRoman.ts';
import { mouseMoved } from '../../src/mac/Cursors.ts';
import { keysDown, mouse, postOSEvent, tickTime } from '../../src/mac/OS.ts';
import { Volume } from '../../src/mac/Volume.ts';
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
	host: GameHost;
	/** The screen as the monitor shows it, with or without the cursor. */
	shot(withCursor?: boolean): Image;
}

/**
 * Boots a machine with Glider on its volume; schedule input and screenshots on the host before
 * running. `launchTick` is when Glider starts, as on a Mac that took that long to start up.
 */
export function bootGlider(kind: MachineKind, launchTick = 0): GameRun {
	const volume = new Volume('Glider');
	for (const f of bundledFiles()) {
		volume.put(f);
	}
	const host = new GameHost();
	host.wakeOnInput = true;
	host.time = tickTime(launchTick);
	const machine = bootMachine({ kind, system: systemFork(), volume, application: 'Glider 4.05', host, startDateTime });
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
	return { machine, host, shot };
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
}

/** The Mac Plus keyboard's arrow keys, by the Apple Extended Keyboard's codes the scripts use. */
const plusArrows: Record<number, number> = { 0x7b: 0x46, 0x7c: 0x42, 0x7d: 0x48, 0x7e: 0x4d };

/**
 * The ticks at which the oracle's Mac saw each key transition of a script, from the emulator's
 * KeyMap trace (`Script.traceKeys`): a key reaches the Mac's KeyMap and event queue in the tick after
 * the script presses it, or later, as the Mac's keyboard (or ADB) polling allows. Transitions are
 * matched to the script's in order, by key and direction.
 */
export function oracleKeyTicks(output: string, script: Script, kind: MachineKind): number[] {
	const changes: { tick: number; code: number; down: boolean; used: boolean }[] = [];
	let last: number[] | null = null;
	for (const line of output.split('\n')) {
		const m = /^keymap (\d+) ([0-9A-F]{32})$/.exec(line);
		if (m === null) {
			continue;
		}
		const map = Array.from({ length: 16 }, (_, i) => parseInt(m[2]!.slice(i * 2, i * 2 + 2), 16));
		if (last !== null) {
			for (let code = 0; code < 128; code++) {
				const was = (last[code >> 3]! >> (code & 7)) & 1;
				const is = (map[code >> 3]! >> (code & 7)) & 1;
				if (was !== is) {
					changes.push({ tick: Number(m[1]), code, down: is === 1, used: false });
				}
			}
		}
		last = map;
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
			ticks.push(c.tick);
		}
	}
	return ticks;
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
 * When in its tick a key reaches the Mac's KeyMap and event queue, in ticks. The Mac Plus keyboard
 * delivers it at once, before a game frame's work at the start of the tick reads the keys; the Mac
 * II's ADB keyboard takes milliseconds of bus transactions, and the frame has read the keys by then
 * (measured: steering the glider on the Mac II, the frames see each key a frame later than on the
 * Mac Plus). A program waiting for an event sees it in the same tick either way.
 */
const keyArrival: Record<MachineKind, number> = { plus: 0, ii: 0.5 };

/**
 * Schedules an oracle script's input on the run's host, and the script's screenshots. The oracle
 * numbers ticks from 1: input the script gives after tick k reaches the Mac in tick k + 1, and a
 * screenshot after tick k shows everything drawn in it. Here tick k is TickCount k, which begins at
 * tickTime(k): keys go down and up in the ticks in `keyTicks` (from oracleKeyTicks), or else in the
 * tick after the script presses them, as keyArrival says; the mouse moves and its button goes down
 * and up as the next tick begins; a screenshot after tick k is taken as tick k + 1 begins. Returns the screenshots, filled in as the run reaches them, and the tick the
 * script ends at.
 */
export function replay(run: GameRun, script: Script, keyTicks?: number[]): { shots: Map<string, Image>; end: number } {
	const shots = new Map<string, Image>();
	const h = run.host;
	const plus = run.machine.kind === 'plus';
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
				h.at((keyTicks?.[keyIndex++] ?? tick + 1) + keyArrival[run.machine.kind], () => {
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
				const [dh, dv] = [Number(a), Number(b)];
				h.at(tick + 1, () => {
					mouse.where = { h: mouse.where.h + dh, v: mouse.where.v + dv };
					mouseMoved();
				}, true);
				break;
			}
			case 'b': {
				const down = a === '1';
				h.at(tick + 1, () => {
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
