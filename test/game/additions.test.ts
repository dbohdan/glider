// The port's additions to Glider (src/glider/Additions.ts), which the oracle cases leave off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorPadFlight, padGame, startsInFourChannels } from './harness.ts';
import { iVirtualPad } from '../../src/glider/Globals.ts';
import { houseLocked } from '../../src/editor/Additions.ts';
import { bundledFiles } from '../../tools/build-resources.ts';
import { type GamepadLike, noPad, readGamepads, thrustOf } from '../../src/additions/Pads.ts';

test("with the additions, Glider starts in Sound Settings' saved 4-Channel; without, in 2-Channel as the original", async () => {
	assert.equal(await startsInFourChannels(true), true);
	assert.equal(await startsInFourChannels(false), false);
});

test('on a touch screen, Glider starts with the Virtual Gamepad, which steers, and pauses with Tab', async () => {
	const game = await padGame();
	assert.equal(game.control, iVirtualPad);
	assert.deepEqual(game.items, ['Hold Keyboard', 'Drop Keyboard', 'Mouse', 'Joystick (Mouse)', 'Gamepad', 'Virtual Gamepad', '-', 'Configure…']);
	assert.deepEqual(game.use, [false, 'left']);
	const [before, right, left] = game.lefts;
	assert.ok(right > before, `steered right from ${before} to ${right}`);
	assert.ok(left < right, `steered left from ${right} to ${left}`);
	assert.equal(game.paused, true);
});

test("the gamepads' standard mapping: the D-pad steers at full thrust, the stick in proportion past its dead zone", () => {
	const pad = (axes: number[], pressed: number[] = [], mapping = 'standard'): GamepadLike => ({
		mapping,
		axes,
		buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
	});
	assert.deepEqual(readGamepads([]), noPad);
	assert.deepEqual(readGamepads([null, pad([0.1, 0])]), noPad);
	assert.equal(readGamepads([pad([0, 0], [14])]).steer, -1);
	assert.equal(readGamepads([pad([0, 0], [15])]).steer, 1);
	assert.ok(Math.abs(readGamepads([pad([0.6, 0])]).steer - 0.5) < 1e-9);
	assert.deepEqual(readGamepads([pad([0, 0], [0, 3, 9])]), { steer: 0, energy: true, band: true, pause: true });
	assert.deepEqual(readGamepads([pad([0, 0], [1], 'other')]), { steer: 0, energy: false, band: true, pause: false });
	// Two gamepads: the one leaning further steers.
	assert.equal(readGamepads([pad([0.6, 0]), pad([-1, 0])]).steer, -1);
	assert.equal(thrustOf(0, 5), 0);
	assert.equal(thrustOf(0.01, 5), 1);
	assert.equal(thrustOf(-0.5, 5), -3);
	assert.equal(thrustOf(1, 5), 5);
});

test("the Room Editor's Controls has Gamepad, which flies its test flights", async () => {
	const flight = await editorPadFlight();
	assert.deepEqual(flight.items, ['Hold Keyboard', 'Drop Keyboard', 'Absolute Mouse', 'Joystick (Mouse)', 'Gamepad', '-', 'Configure']);
	assert.equal(flight.gamepadOn, true);
	const [before, right, left] = flight.lefts;
	assert.ok(right > before, `steered right from ${before} to ${right}`);
	assert.ok(left < right, `steered left from ${right} to ${left}`);
});

test("the Room Editor's Open marks the houses Lock House locked: the bundled ones, as their time stamps say", () => {
	const locked = bundledFiles()
		.filter((f) => f.type === 'GLhs' && houseLocked(f))
		.map((f) => f.name);
	assert.ok(locked.includes('The House') && locked.includes('Mad House'));
	for (const open of ['The House (July 1991)', 'Glass House', 'Hands-off House', 'House Full of Stuff 2']) {
		assert.ok(!locked.includes(open), `${open} is not locked`);
	}
	assert.equal(houseLocked({ ...bundledFiles().find((f) => f.name === 'The House')!, type: 'TEXT' }), false);
});

