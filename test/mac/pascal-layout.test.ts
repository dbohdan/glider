import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PBoolean, PInteger, PRecord, PString, readLayout, sizeOf, writeLayout } from '../../src/mac/PascalLayout.ts';
import { parseDeRez } from '../../tools/DeRez.ts';
import { houseRecLayout, objectDataLayout, roomDataLayout } from '../../src/glider/Globals.ts';

const root = new URL('../../', import.meta.url).pathname;

// The declarations of G-Globals.p.
const objectData = objectDataLayout;
const roomData = roomDataLayout;
const houseRec = houseRecLayout;

// The prefType record of G-GameBody.p, stored as 'Gprf' 128.
const prefType = PRecord({
	theName: PString(24),
	houseName: PString(32),
	resName: PString(32),
	sndVolume: PInteger,
	controlIs: PInteger,
	leftIs: PInteger,
	rightIs: PInteger,
	energyIs: PInteger,
	bandIs: PInteger,
	musicIs: PBoolean,
	channel4Is: PBoolean,
	airVisIs: PBoolean,
	buttonIs: PBoolean,
	restoreIs: PBoolean,
	leftNameIs: PString(12),
	rightNameIs: PString(12),
	energyNameIs: PString(12),
	bandNameIs: PString(12),
	keyBoardIs: PInteger,
});

test('record sizes match THINK Pascal', () => {
	assert.equal(sizeOf(objectData), 16);
	assert.equal(sizeOf(roomData), 314);
	assert.equal(sizeOf(houseRec), 13830);
	assert.equal(sizeOf(prefType), 170);
});

test('The House reads as a houseRec and writes back unchanged', () => {
	const bytes = new Uint8Array(readFileSync(root + 'assets/houses/The House'));
	const h = readLayout(houseRec, bytes, 0);
	assert.equal(h.version, 0x0100);
	assert.equal(h.numberORooms, 40);
	assert.equal(h.nextFile, 'The House 2');
	assert.equal(h.hiName[0], 'Ozma of OZ!');
	assert.equal(h.hiScores[0], 214050);
	assert.equal(h.theRooms[1]!.roomName, 'Welcome...');
	assert.equal(h.theRooms[26]!.roomName, 'Fan Fun!');
	assert.deepEqual(h.theRooms[3]!.tileOrder, [5, 2, 0, 0, 1, 4, 0, 0]);
	assert.equal(h.theRooms[1]!.theObjects[1]!.objectIs, h.theRooms[1]!.theObjects[1]!.objectIs);
	const out = new Uint8Array(bytes);
	writeLayout(houseRec, h, out, 0);
	assert.deepEqual(out, bytes);
});

test('the shipped preferences resource reads as a prefType', () => {
	const gprf = parseDeRez(readFileSync(root + 'Glider_405/Glider.r')).get('Gprf', 128)!.data;
	const p = readLayout(prefType, gprf, 0);
	assert.equal(p.theName, 'Ozma');
	assert.equal(p.houseName, 'The House');
	assert.equal(p.resName, 'Color Art');
	assert.deepEqual([p.leftIs, p.rightIs, p.energyIs, p.bandIs], [0x7b, 0x7c, 0x7d, 0x7e]);
	assert.deepEqual([p.leftNameIs, p.rightNameIs, p.energyNameIs, p.bandNameIs], ['left arrow', 'right arrow', 'down arrow', 'up arrow']);
	assert.equal(p.keyBoardIs, 4);
});
