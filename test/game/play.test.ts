// The ported Glider plays as the original does: the oracle's game cases replayed on the port, with
// Glider 4.05's preferences, give identical screens on each machine. The cases cover games steered
// with the keyboard and the mouse, minutes of random keys from several rooms, a long flight through
// the house and a high score, test rooms of chosen objects, Glider's menus and dialogs, and every
// tick of a game starting.
//
// Each case plays in a worker thread of its own (playCase), with fresh modules: a case starts from a
// freshly booted machine and program, as the oracle's runs do, and not from the globals the case
// before left.

import { availableParallelism } from 'node:os';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writePNG } from '../../oracle/Image.ts';
import { gameRec } from '../../src/glider/FileInNOut.ts';
import { houseRecLayout } from '../../src/glider/Globals.ts';
import { type MacFile, parseMacBinary } from '../../src/mac/MacBinary.ts';
import { parseResourceFork } from '../../src/mac/ResourceFork.ts';
import { type Layout, readLayout } from '../../src/mac/PascalLayout.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { differences, oracleOutput, oracleRunAvailable, oracleShot, writeComparison } from '../toolbox/machine.ts';
import { gameCases, unfinished } from './cases.ts';
import { playCase, soundDifferences } from './harness.ts';

/** The records of files Glider saves, by file type. */
const savedLayouts: Record<string, Layout> = { GLgm: gameRec, GLhs: houseRecLayout };

// The workers are independent, so the cases run side by side.
describe('the game cases', { concurrency: availableParallelism() }, () => {
	for (const [index, [kind, { caseName, what, known = 0 }]] of gameCases.entries()) {
		const skip = oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"`;
		test(`${what} as the original's does on a ${kind === 'plus' ? 'Mac Plus' : 'Mac II'}`, { skip, todo: unfinished[caseName] ?? false }, async () => {
			const { shots, expected, sound, files } = await playCase(index);
			assert.equal(shots.length, expected);
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
				assert.ok(sound.size > 0);
				assert.deepEqual(soundDifferences(kind, sound, readFileSync(recording), first).slice(0, 10), [], 'ticks whose sound differs');
			}
			// The files the program saved, where the oracle kept them (Oracle.run's `keep`): their
			// records field by field, since the original leaves whatever was on its stack in the bytes
			// past a string's end and between fields, where the port writes zeros.
			const runDir = join(cacheDir, 'runs', caseName);
			for (const bin of readdirSync(runDir).filter((f) => f.endsWith('.bin'))) {
				const rom = parseMacBinary(readFileSync(join(runDir, bin)));
				if (rom.type === 'APPL') {
					// Glider itself (4.06 in the oracle, 4.05 here), for the preferences it writes into its 'Gprf' resource.
					const ours = files.find((f) => f.type === 'APPL' && f.creator === rom.creator)!;
					const gprf = (f: MacFile) => parseResourceFork(f.rsrc).resources.find((r) => r.type === 'Gprf' && r.id === 128)!.data;
					assert.deepEqual(gprf(ours), gprf(rom), "Glider's preferences");
					continue;
				}
				const ours = files.find((f) => f.name === rom.name);
				assert.ok(ours !== undefined, `the port saved no "${rom.name}"`);
				assert.deepEqual([ours.type, ours.creator, ours.data.length], [rom.type, rom.creator, rom.data.length]);
				const layout = savedLayouts[rom.type];
				if (layout === undefined) {
					assert.deepEqual(ours.data, rom.data, `"${rom.name}"'s data`);
				} else {
					assert.deepEqual(readLayout(layout, ours.data, 0), readLayout(layout, rom.data, 0), `"${rom.name}"'s record`);
				}
			}
		});
	}
});
