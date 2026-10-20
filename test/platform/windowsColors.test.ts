// Glider for Windows' colors for the Mac II's screen (src/platform/WindowsColors.ts), as
// docs/versions.md measured them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowsColors } from '../../src/platform/WindowsColors.ts';

test("Windows' colors are a VGA card's: 6 bits a component, so 0x80 shows as 130 and 0xC0 as 195", () => {
	const [white, yellow, orange, red, magenta, purple, , , green, darkGreen, brown, tan, lightGray, mediumGray, darkGray, black] = windowsColors(16);
	assert.deepEqual(white, [255, 255, 255]);
	assert.deepEqual(yellow, [255, 255, 0]);
	assert.deepEqual(black, [0, 0, 0]);
	assert.deepEqual(lightGray, [195, 195, 195]);
	// Four pairs of the Mac's colors merge.
	assert.deepEqual(orange, red);
	assert.deepEqual(magenta, purple);
	assert.deepEqual(green, darkGreen);
	assert.deepEqual(mediumGray, darkGray);
	assert.deepEqual(brown, [130, 0, 0]);
	assert.deepEqual(tan, [130, 130, 0]);
	assert.deepEqual(mediumGray, [130, 130, 130]);
});

test('in 256 colors the dark colors are brightened, as the screenshots of Glider/WIN show, but not gray', () => {
	const c = windowsColors(256);
	assert.deepEqual(c[10], [195, 0, 0]); // brown: dark red, measured
	assert.deepEqual(c[11], [195, 195, 0]); // tan: olive, measured
	assert.deepEqual(c[13], [130, 130, 130]); // gray, measured
	assert.deepEqual(c[12], [195, 195, 195]); // light gray, measured
	assert.equal(c.length, 16);
});
