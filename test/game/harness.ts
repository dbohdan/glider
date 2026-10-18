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

/**
 * Ticks between the oracle's script pressing or releasing a key and the program seeing it. Mini
 * vMac hands key transitions to the Mac through its event queue and the Mac's keyboard (or ADB)
 * polling, which takes time the port's instant input does not. Measured with the play cases: the
 * games match when Command-N comes 4 or 5 ticks late, and the title screens when Return to the
 * alert comes 4 or more ticks late on a Mac Plus and 5 or more on a Mac II; 5 fits all of them.
 */
export const oracleKeyLatency = 5;

/** The Mac Plus keyboard's arrow keys, by the Apple Extended Keyboard's codes the scripts use. */
const plusArrows: Record<number, number> = { 0x7b: 0x46, 0x7c: 0x42, 0x7d: 0x48, 0x7e: 0x4d };

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
 * Schedules an oracle script's input on the run's host, as the oracle plays it (keys late by
 * oracleKeyLatency), and the script's screenshots at their ticks. Returns the screenshots, filled
 * in as the run reaches them, and the tick the script ends at.
 */
export function replay(run: GameRun, script: Script): { shots: Map<string, Image>; end: number } {
	const shots = new Map<string, Image>();
	const h = run.host;
	const plus = run.machine.kind === 'plus';
	let tick = 0;
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
				h.at(tick + oracleKeyLatency, () => {
					if (code >= 0x37 && code <= 0x3b) {
						keysDown[code] = down;
					} else if (down) {
						hostKeyDown(mac, charCodeOf(name, keysDown[0x38]!));
					} else {
						hostKeyUp(mac, charCodeOf(name, keysDown[0x38]!));
					}
				});
				break;
			}
			case 'm': {
				const where = { h: Number(a), v: Number(b) };
				h.at(tick, () => {
					mouse.where = { ...where };
					mouseMoved();
				});
				break;
			}
			case 'd': {
				const [dh, dv] = [Number(a), Number(b)];
				h.at(tick, () => {
					mouse.where = { h: mouse.where.h + dh, v: mouse.where.v + dv };
					mouseMoved();
				});
				break;
			}
			case 'b': {
				const down = a === '1';
				h.at(tick, () => {
					mouse.button = down;
					postOSEvent(down ? 1 : 2, 0);
				});
				break;
			}
			case 's': {
				const name = a;
				h.at(tick, () => shots.set(name, run.shot(true)));
				break;
			}
			// speed and ram dumps have no counterpart.
		}
	}
	return { shots, end: tick };
}
