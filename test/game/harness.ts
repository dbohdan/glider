// Runs the ported Glider headless: the platform's machine with the bundled volume and the port's
// System, on a virtual clock that plays scripted input, until a given tick.

import { type Image } from '../../oracle/Image.ts';
import { main } from '../../src/glider/GameBody.ts';
import { tickTime } from '../../src/mac/OS.ts';
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

	override async sleep(ms: number): Promise<void> {
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
	/** The screen as the monitor shows it, without the cursor. */
	shot(): Image;
}

/** Boots a machine with Glider on its volume; schedule input and screenshots on the host before running. */
export function bootGlider(kind: MachineKind): GameRun {
	const volume = new Volume('Glider');
	for (const f of bundledFiles()) {
		volume.put(f);
	}
	const host = new GameHost();
	const machine = bootMachine({ kind, system: systemFork(), volume, application: 'Glider 4.05', host, startDateTime });
	const rgba = new Uint8ClampedArray(machine.width * machine.height * 4);
	const shot = (): Image => {
		renderScreen(machine, rgba, false);
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
