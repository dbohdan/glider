// The desktop draws its icons, their names, a selection, and the zoom of opening as System 6.0.8's
// Finder draws them (the oracle's "desktop" case: the Finder's desktop with Glider 4.0, the Room
// Editor and a Source Code folder, cleaned up). The Finder's column starts with the startup disk,
// which the port's desktop does not have: its icons are each one place higher.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Image } from '../../oracle/Image.ts';
import { main, zoomRects } from '../../src/desktop/Desktop.ts';
import { tickTime } from '../../src/mac/OS.ts';
import { Volume } from '../../src/mac/Volume.ts';
import { bootMachine } from '../../src/platform/Machine.ts';
import { renderScreen } from '../../src/platform/Screen.ts';
import { bundledFiles, systemFork } from '../../tools/build-resources.ts';
import { EndOfRun, GameHost, startDateTime } from '../game/harness.ts';
import { oracleRunAvailable, oracleShot } from '../toolbox/machine.ts';

const skip = oracleRunAvailable('desktop') ? false : 'the oracle has not run the desktop case (node oracle/main.ts shoot desktop)';

/** The pixels of a region of a screen, one character per pixel. */
function crop(img: Image, left: number, top: number, right: number, bottom: number): string[] {
	const rows: string[] = [];
	for (let y = top; y < bottom; y++) {
		let r = '';
		for (let x = left; x < right; x++) {
			r += img.rgb[(y * img.width + x) * 3] === 0 ? '#' : '.';
		}
		rows.push(r);
	}
	return rows;
}

/** The bounding box of the pixels that differ between two screens, as top, left, bottom, right. */
function changed(a: Image, b: Image): number[] | null {
	let box: number[] | null = null;
	for (let y = 0; y < a.height; y++) {
		for (let x = 0; x < a.width; x++) {
			const i = (y * a.width + x) * 3;
			if (a.rgb[i] !== b.rgb[i]) {
				box = box === null ? [y, x, y + 1, x + 1] : [Math.min(box[0]!, y), Math.min(box[1]!, x), Math.max(box[2]!, y + 1), Math.max(box[3]!, x + 1)];
			}
		}
	}
	return box;
}

test('the desktop draws its icons as the Finder draws them on a Mac Plus', { skip }, async () => {
	const volume = new Volume('Glider');
	for (const f of bundledFiles()) {
		volume.put(f);
	}
	const host = new GameHost();
	host.wakeOnInput = true;
	const machine = bootMachine({ kind: 'plus', system: systemFork(), volume, application: 'Desktop', host, startDateTime });
	const rgba = new Uint8ClampedArray(machine.width * machine.height * 4);
	const shot = (): Image => {
		renderScreen(machine, rgba, false);
		const rgb = new Uint8Array(machine.width * machine.height * 3);
		for (let i = 0; i < machine.width * machine.height; i++) {
			rgb.set([rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!], i * 3);
		}
		return { width: machine.width, height: machine.height, rgb };
	};
	const shots = new Map<string, Image>();
	host.at(30, () => shots.set('desktop', shot()));
	// Glider selected by a click in a hole of its icon's mask, as in the oracle.
	host.mouseAt(40, 472, 45).buttonAt(41, true).buttonAt(43, false).mouseAt(44, 250, 300);
	host.at(60, () => shots.set('selected', shot()));
	host.endTime = tickTime(61);
	try {
		await main();
	} catch (e) {
		if (!(e instanceof EndOfRun)) {
			throw e;
		}
	}
	// Each icon's rows (from its top) compared; Source Code's folder holds the port's branch mark in
	// rows 13 to 29, which are left out.
	for (const [name, k, rows] of [['Glider 4.0', 0, [[0, 44]]], ['Room Editor', 1, [[0, 44]]], ['Source Code', 2, [[0, 13], [30, 44]]]] as const) {
		for (const [from, to] of rows) {
			const top = 28 + 64 * k;
			assert.deepEqual(crop(shots.get('desktop')!, 430, top + from, 512, top + to), crop(oracleShot('desktop', 'desktop'), 430, top + 64 + from, 512, top + 64 + to), `${name}, rows ${from} to ${to}`);
		}
	}
	assert.deepEqual(crop(shots.get('selected')!, 430, 28, 512, 72), crop(oracleShot('desktop', 'selected'), 430, 92, 512, 136), 'Glider 4.0 selected');

	// The zoom from Glider's place in the Finder's column, a tick at a time.
	const frames: Image[] = [];
	const start = 70;
	for (let t = 0; t <= 16; t++) {
		host.at(start + t, () => frames.push(shot()));
	}
	host.endTime = Infinity;
	await host.sleep(tickTime(start));
	await zoomRects({ top: 92, left: 456, bottom: 124, right: 488 }, { top: 0, left: 0, bottom: 342, right: 512 });
	await host.sleep(tickTime(start + 17));
	const ours = frames.slice(1).map((f, i) => changed(frames[i]!, f)).filter((b) => b !== null);
	const rom: (number[] | null)[] = [];
	for (let i = 2; i <= 20; i++) {
		rom.push(changed(oracleShot('desktop', `z${i - 1}`), oracleShot('desktop', `z${i}`)));
	}
	assert.deepEqual(ours.slice(0, 11), rom.filter((b) => b !== null).slice(0, 11));
});

test('the desktop shuts down as System 6.0.8 does on a Mac Plus, with its own words and icon', { skip: oracleRunAvailable('shutDown') ? false : 'the oracle has not run the shutDown case' }, async () => {
	const volume = new Volume('Glider');
	for (const f of bundledFiles()) {
		volume.put(f);
	}
	const host = new GameHost();
	host.wakeOnInput = true;
	const machine = bootMachine({ kind: 'plus', system: systemFork(), volume, application: 'Desktop', host, startDateTime });
	const rgba = new Uint8ClampedArray(machine.width * machine.height * 4);
	let shot: Image | null = null;
	// Special > Shut Down.
	host.mouseAt(20, 100, 10).buttonAt(21, true).mouseAt(30, 100, 76).buttonAt(40, false).mouseAt(41, 250, 300);
	host.at(80, () => {
		renderScreen(machine, rgba, false);
		const rgb = new Uint8Array(machine.width * machine.height * 3);
		for (let i = 0; i < machine.width * machine.height; i++) {
			rgb.set([rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!], i * 3);
		}
		shot = { width: machine.width, height: machine.height, rgb };
	});
	host.endTime = tickTime(81);
	try {
		await main();
	} catch (e) {
		if (!(e instanceof EndOfRun)) {
			throw e;
		}
	}
	const rom = oracleShot('shutDown', 'shutDown');
	// The icon, the words, and the original's cursor are left out.
	const skip = (x: number, y: number): boolean => (x >= 55 && x < 100 && y >= 75 && y < 120) || (y >= 80 && y < 100 && x >= 110 && x < 470) || (x >= 248 && x < 266 && y >= 298 && y < 318);
	const differ: string[] = [];
	for (let y = 0; y < rom.height; y++) {
		for (let x = 0; x < rom.width; x++) {
			const i = (y * rom.width + x) * 3;
			if (!skip(x, y) && shot!.rgb[i] !== rom.rgb[i]) {
				differ.push(`${x},${y}`);
			}
		}
	}
	assert.equal(differ.length, 0, `${differ.length} pixels differ, first at ${differ.slice(0, 8).join(' ')}`);
});
