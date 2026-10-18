// The ported Glider starts up as the original does: at first launch, the "New keyboard" alert over
// the title screen, identical to the oracle's screenshot on each machine (cursor included).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writePNG } from '../../oracle/Image.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { differences, oracleRunAvailable, oracleShot, writeComparison } from '../toolbox/machine.ts';
import { bootGlider, runGlider } from './harness.ts';

for (const [kind, caseName, shot, tick] of [
	['plus', 'boot', 'alert', 900],
	['ii', 'bootColor', 't1800', 1800],
] as const) {
	test(`Glider starts up as the original does on a ${kind === 'plus' ? 'Mac Plus' : 'Mac II'}`, { skip: oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"` }, async () => {
		const run = bootGlider(kind);
		await runGlider(run, tick);
		const ours = run.shot(true);
		const rom = oracleShot(caseName, shot);
		const d = differences(ours, rom, [[0, 0, ours.width, ours.height]]);
		if (d.length > 0) {
			const dir = join(cacheDir, 'game');
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, `${caseName}-${shot}.png`), writePNG(ours));
			writeComparison(`game-${caseName}-${shot}`, rom, ours, [0, 0, ours.width, ours.height], 1);
		}
		assert.equal(d.length, 0, `${d.length} pixels differ, first at ${d.slice(0, 8).join(' ')}`);
	});
}
