// The ported Glider plays as the original does: the oracle's game cases replayed on the port, with
// Glider 4.05's preferences, give identical screens on each machine. The cases cover games steered
// with the keyboard and the mouse, minutes of random keys from several rooms, a long flight through
// the house and a high score, test rooms of chosen objects, Glider's menus and dialogs, and every
// tick of a game starting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { everyTickScript, firstRoomScript, houseEnds, houseEndScript, houseFrom, houseOfOneRoom, houseWith, maskRooms, interfaceScript, mouseScript, playScript, repeatScript, roomStarts, savedGameScript, steerScript, tourScript, wanderScript } from '../../oracle/cases.ts';
import type { Script } from '../../oracle/Script.ts';
import type { MachineKind } from '../../src/platform/Machine.ts';
import { writePNG } from '../../oracle/Image.ts';
import { parseMacBinary } from '../../src/mac/MacBinary.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { differences, oracleOutput, oracleRunAvailable, oracleShot, writeComparison } from '../toolbox/machine.ts';
import { bootGlider, oracleTrace, replay, runGlider, soundDifferences } from './harness.ts';

interface Case {
	caseName: string;
	makeScript: () => Script;
	what: string;
	/** The House as the case plays it, when not the real one. */
	house?: () => Uint8Array;
	/** How many pixels of each screenshot are known to differ. */
	known?: number;
}

/** A case on both machines: `name` on the Mac Plus, `nameColor` on the Mac II. */
function both(name: string, makeScript: () => Script, what: string, house?: () => Uint8Array): [MachineKind, Case][] {
	return [
		['plus', { caseName: name, makeScript, what, house, known: knownDifferences[name] }],
		['ii', { caseName: `${name}Color`, makeScript, what, house, known: knownDifferences[`${name}Color`] }],
	];
}

/**
 * Pixels known to differ in every screenshot of a case. Color QuickDraw stretches the stretched test
 * room's sprites as the port does, but for 55 pixels: where a horizontal shrink of 4-bit pixels
 * splits a pixel in half, and at the first row of one enlarged mask (27 rows to 40). Glider itself
 * only shrinks a drip's last frame from 14 rows to 13, which matches.
 */
const knownDifferences: Record<string, number> = { stretchedColor: 55 };

/** Cases that still differ, being worked on: they run, but do not fail the tests. */
const unfinished: Record<string, string> = {
};

const cases: [MachineKind, Case][] = [
	...both('play', playScript, 'a game plays'),
	...both('steer', steerScript, 'a game steered with the keys plays'),
	...both('mouse', () => mouseScript(false), 'a game steered with the mouse plays'),
	...both('joystick', () => mouseScript(true), 'a game steered with mouse movements plays'),
	...both('wander', () => wanderScript(1), 'a minute of random keys plays'),
	...roomStarts.flatMap((first) => both(`room${first}`, () => wanderScript(first), `a minute of random keys from room ${first} plays`, () => houseFrom(first))),
	...Object.entries(maskRooms).flatMap(([name, objects]) => both(name, firstRoomScript, `a test room (${name}) looks`, () => houseWith(objects))),
	...Object.entries(houseEnds).flatMap(([name, nextFile]) => both(name, houseEndScript, nextFile === '' ? 'the end of the last house plays' : 'going on to the next house file plays', () => houseOfOneRoom(nextFile))),
	...both('savedGame', () => savedGameScript(), 'a game saved and opened again plays'),
	...both('tour', tourScript, 'a long flight through the house plays'),
	...both('repeats', repeatScript, 'keys held in the high-score dialog repeat'),
	...both('ui', interfaceScript, "Glider's menus, dialogs, help and a paused game look"),
	...both('everyTick', everyTickScript, 'every tick of the alert going away and a game starting looks'),
];

for (const [kind, { caseName, makeScript, what, house, known = 0 }] of cases) {
	const skip = oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"`;
	test(`${what} as the original's does on a ${kind === 'plus' ? 'Mac Plus' : 'Mac II'}`, { skip, todo: unfinished[caseName] ?? false }, async () => {
		const run = bootGlider(kind, 0, house?.());
		const script = makeScript();
		const { shots, end } = replay(run, script, oracleTrace(oracleOutput(caseName), script, kind));
		await runGlider(run, end + 1);
		assert.equal(shots.size, script.shots.length);
		const failures: string[] = [];
		for (const [name, ours] of shots) {
			const rom = oracleShot(caseName, name);
			const d = differences(ours, rom, [[0, 0, ours.width, ours.height]]);
			if (d.length !== known) {
				const dir = join(cacheDir, 'game');
				mkdirSync(dir, { recursive: true });
				writeFileSync(join(dir, `${caseName}-${name}.png`), writePNG(ours));
				writeComparison(`game-${caseName}-${name}`, rom, ours, [0, 0, ours.width, ours.height], 1);
				failures.push(`${name}: ${d.length} pixels differ (${known} known), first at ${d.slice(0, 4).join(' ')}`);
			}
		}
		assert.deepEqual(failures, []);
		// The sound, where the oracle recorded it (Script.sound).
		const recording = join(cacheDir, 'runs', caseName, 'sound.raw');
		if (existsSync(recording)) {
			const first = Number(/^sound (\d+)$/m.exec(oracleOutput(caseName))![1]);
			assert.ok(run.sound.size > 0);
			assert.deepEqual(soundDifferences(run, readFileSync(recording), first).slice(0, 10), [], 'ticks whose sound differs');
		}
		// The files the program saved, where the oracle kept them (Oracle.run's `keep`).
		const runDir = join(cacheDir, 'runs', caseName);
		for (const bin of readdirSync(runDir).filter((f) => f.endsWith('.bin'))) {
			const rom = parseMacBinary(readFileSync(join(runDir, bin)));
			const ours = run.volume.get(rom.name);
			assert.ok(ours !== undefined, `the port saved no "${rom.name}"`);
			assert.deepEqual([ours.type, ours.creator], [rom.type, rom.creator]);
			assert.deepEqual(ours.data, rom.data, `"${rom.name}"'s data`);
		}
	});
}
