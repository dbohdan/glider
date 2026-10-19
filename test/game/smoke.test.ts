// The ported Glider starts on both machines and gets to its title screen without failing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writePNG } from '../../oracle/Image.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { screenAt } from './harness.ts';

for (const kind of ['plus', 'ii'] as const) {
	test(`Glider runs for 30 seconds on a ${kind === 'plus' ? 'Mac Plus' : 'Mac II'}`, async () => {
		const img = await screenAt(kind, 1800, false);
		const dir = join(cacheDir, 'game');
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, `smoke-${kind}.png`), writePNG(img));
		let dark = 0;
		for (let i = 0; i < img.rgb.length; i += 3) {
			dark += img.rgb[i]! < 128 ? 1 : 0;
		}
		assert.ok(dark > 0 && dark < img.width * img.height, 'the screen shows something');
	});
}
