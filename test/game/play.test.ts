// The ported Glider plays as the original does: the oracle's play cases replayed on the port, with
// Glider 4.05's preferences, give identical screens from the keyboard alert through 10 seconds of a
// game (the glider dropping from the ceiling and starting over, three times), on each machine.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { playScript } from '../../oracle/cases.ts';
import { writePNG } from '../../oracle/Image.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { differences, oracleRunAvailable, oracleShot, writeComparison } from '../toolbox/machine.ts';
import { bootGlider, replay, runGlider } from './harness.ts';

for (const [kind, caseName] of [
	['plus', 'play'],
	['ii', 'playColor'],
] as const) {
	test(`a game plays as the original's does on a ${kind === 'plus' ? 'Mac Plus' : 'Mac II'}`, { skip: oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"` }, async () => {
		const run = bootGlider(kind);
		const script = playScript();
		const { shots, end } = replay(run, script);
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
