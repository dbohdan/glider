// The player's part of the game's files, as the browser keeps it (src/platform/browser/Storage.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseRecLayout } from '../../src/glider/Globals.ts';
import { readLayout, writeLayout } from '../../src/mac/PascalLayout.ts';
import { parseResourceFork, writeResourceFork } from '../../src/mac/ResourceFork.ts';
import { FileStore, importedFile, playerPart, prefsOf, scoresOf, webPrefsOf, withPrefs, withScores } from '../../src/platform/browser/Storage.ts';
import type { MacFile } from '../../src/mac/MacBinary.ts';
import { Volume } from '../../src/mac/Volume.ts';
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

test("the additions' preferences go with Glider's, and only once there are some", () => {
	const bundled = new Map(files.map((f) => [f.name, f]));
	const web = new Uint8Array([0, 1, 0, 0]);
	const withWeb = withPrefs(app, prefsOf(app)!, web);
	assert.deepEqual(webPrefsOf(withWeb), web);
	assert.equal(webPrefsOf(app), null);
	// The bundled application has none, so it is not the player's until it has.
	assert.equal(playerPart(bundled, app), null);
	assert.notEqual(playerPart(bundled, withWeb), null);
	// Importing an application without them keeps the ones on the volume.
	assert.deepEqual(webPrefsOf(importedFile(bundled, withWeb, app)!), web);
	assert.deepEqual(webPrefsOf(importedFile(bundled, undefined, withWeb)!), web);
});

test('each Mac keeps its own copy of Glider\'s preferences, and an export carries both', async () => {
	const fresh = () => {
		const v = new Volume('Glider');
		for (const f of files) {
			v.put(f);
		}
		return v;
	};
	const played = (byte: number) => {
		const fork = parseResourceFork(app.rsrc);
		const res = fork.resources.find((r) => r.type === 'Gprf' && r.id === 128)!;
		res.data = res.data.map((v, i) => (i === 0 ? byte : v));
		return { ...app, rsrc: writeResourceFork(fork) };
	};
	// No IndexedDB here: the store keeps what it is given for the session, as in private browsing.
	const store = await FileStore.open();
	await store.restore(fresh(), 'ii');
	store.save(played(0x11), false);
	await store.restore(fresh(), 'plus');
	store.save(played(0x22), false);
	const exported = store.playerFiles(fresh()).find((f) => f.name === app.name)!;
	assert.equal(prefsOf(exported)![0], 0x11);
	assert.equal(prefsOf(exported, 129)![0], 0x22);
	// Imported on a Mac Plus, Glider on the disk gets the Mac Plus's copy, where it reads it.
	const other = await FileStore.open();
	const volume = fresh();
	await other.restore(volume, 'plus');
	assert.equal(other.import(volume, exported), true);
	assert.equal(prefsOf(volume.get(app.name)!)![0], 0x22);
});

test("Glider's and the Room Editor's preferences are kept apart", async () => {
	const editor = files.find((f) => f.name === 'Room Editor 1.03')!;
	assert.notEqual(prefsOf(editor), null);
	const fresh = () => {
		const v = new Volume('Glider');
		for (const f of files) {
			v.put(f);
		}
		return v;
	};
	const played = (f: MacFile, byte: number) => {
		const fork = parseResourceFork(f.rsrc);
		const res = fork.resources.find((r) => r.type === 'Gprf' && r.id === 128)!;
		res.data = res.data.map((v, i) => (i === 0 ? byte : v));
		return { ...f, rsrc: writeResourceFork(fork) };
	};
	const store = await FileStore.open();
	await store.restore(fresh(), 'ii');
	store.save(played(app, 0x11), false);
	store.save(played(editor, 0x33), false);
	const exported = store.playerFiles(fresh());
	assert.equal(prefsOf(exported.find((f) => f.name === app.name)!)![0], 0x11);
	assert.equal(prefsOf(exported.find((f) => f.name === editor.name)!)![0], 0x33);
});
