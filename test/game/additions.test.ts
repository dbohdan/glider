// The port's additions to Glider (src/glider/Additions.ts), which the oracle cases leave off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startsInFourChannels } from './harness.ts';

test("with the additions, Glider starts in Sound Settings' saved 4-Channel; without, in 2-Channel as the original", async () => {
	assert.equal(await startsInFourChannels(true), true);
	assert.equal(await startsInFourChannels(false), false);
});
