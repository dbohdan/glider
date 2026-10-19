// The player's part of the game's files, as the browser keeps it (src/platform/browser/Storage.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseRecLayout } from '../../src/glider/Globals.ts';
import { readLayout, writeLayout } from '../../src/mac/PascalLayout.ts';
import { parseResourceFork, writeResourceFork } from '../../src/mac/ResourceFork.ts';
import { prefsOf, scoresOf, withPrefs, withScores } from '../../src/platform/browser/Storage.ts';
import { bundledFiles } from '../../tools/build-resources.ts';

const files = bundledFiles();
const app = files.find((f) => f.name === 'Glider 4.05')!;
const house = files.find((f) => f.name === 'The House')!;

test('the preferences go into a fresh copy of the application, and nothing else does', () => {
	const fork = parseResourceFork(app.rsrc);
	const prefs = fork.resources.find((r) => r.type === 'Gprf' && r.id === 128)!;
	const changed = new Uint8Array(prefs.data);
	changed[0] = changed[0]! ^ 0xff;
	prefs.data = changed;
	const played = { ...app, rsrc: writeResourceFork(fork) };
	const restored = withPrefs(app, prefsOf(played)!);
	assert.deepEqual(prefsOf(restored), changed);
	const others = (f: typeof app) => parseResourceFork(f.rsrc).resources.filter((r) => r.type !== 'Gprf').map((r) => [r.type, r.id, r.data]);
	assert.deepEqual(others(restored), others(app));
});

test("a bundled house's high scores go into a fresh copy of it, and nothing else does", () => {
	const rec = readLayout(houseRecLayout, house.data, 0);
	rec.hiScores[0] = 123456;
	rec.hiName[0] = 'Player';
	rec.hiLevel[0] = 7;
	rec.hiRoom[0] = 'Somewhere';
	const data = new Uint8Array(house.data);
	writeLayout(houseRecLayout, rec, data, 0);
	const restored = withScores(house, scoresOf({ ...house, data }));
	assert.deepEqual(restored.data, data);
	const original = readLayout(houseRecLayout, house.data, 0);
	assert.deepEqual(readLayout(houseRecLayout, restored.data, 0).theRooms, original.theRooms);
});
