// The ported Glider plays as the original does: the oracle's play cases replayed on the port, with
// Glider 4.05's preferences, give identical screens on each machine: from the keyboard alert through
// 10 seconds of a game (the glider dropping from the ceiling and starting over, three times), a game
// steered with the keyboard, and every tick of the alert's button flashing and going away and of a
// game starting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { everyTickScript, playScript, steerScript, tourScript } from '../../oracle/cases.ts';
import { writePNG } from '../../oracle/Image.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { differences, oracleOutput, oracleRunAvailable, oracleShot, writeComparison } from '../toolbox/machine.ts';
import { bootGlider, oracleKeyTicks, replay, runGlider } from './harness.ts';

for (const [kind, caseName, makeScript, what] of [
	['plus', 'play', playScript, 'a game plays'],
	['ii', 'playColor', playScript, 'a game plays'],
	['plus', 'steer', steerScript, 'a game steered with the keys plays'],
	['ii', 'steerColor', steerScript, 'a game steered with the keys plays'],
	['plus', 'tour', tourScript, 'a long flight through the house plays'],
	['ii', 'tourColor', tourScript, 'a long flight through the house plays'],
	['plus', 'everyTick', everyTickScript, 'every tick of the alert going away and a game starting looks'],
	['ii', 'everyTickColor', everyTickScript, 'every tick of the alert going away and a game starting looks'],
] as const) {
	test(`${what} as the original's does on a ${kind === 'plus' ? 'Mac Plus' : 'Mac II'}`, { skip: oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"` }, async () => {
		const run = bootGlider(kind);
		const script = makeScript();
		const { shots, end } = replay(run, script, oracleKeyTicks(oracleOutput(caseName), script, kind));
		await runGlider(run, end + 1);
		assert.equal(shots.size, script.shots.length);
		const failures: string[] = [];
		for (const [name, ours] of shots) {
			const rom = oracleShot(caseName, name);
			const d = differences(ours, rom, [[0, 0, ours.width, ours.height]]);
			if (d.length > 0) {
				const dir = join(cacheDir, 'game');
				mkdirSync(dir, { recursive: true });
				writeFileSync(join(dir, `${caseName}-${name}.png`), writePNG(ours));
				writeComparison(`game-${caseName}-${name}`, rom, ours, [0, 0, ours.width, ours.height], 1);
				failures.push(`${name}: ${d.length} pixels differ, first at ${d.slice(0, 4).join(' ')}`);
			}
		}
		assert.deepEqual(failures, []);
	});
}
