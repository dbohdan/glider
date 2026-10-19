// The files the player imports and exports (src/platform/Transfer.ts) and what they become on the
// volume (playerPart and importedFile in src/platform/browser/Storage.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { houseRecLayout } from '../../src/glider/Globals.ts';
import type { MacFile } from '../../src/mac/MacBinary.ts';
import { readLayout, writeLayout } from '../../src/mac/PascalLayout.ts';
import { parseResourceFork, writeResourceFork } from '../../src/mac/ResourceFork.ts';
import { importedFile, playerPart, prefsOf, scoresOf } from '../../src/platform/browser/Storage.ts';
import { exportArchive, type Inflate, readUploads } from '../../src/platform/Transfer.ts';
import { writeZip } from '../../src/platform/Zip.ts';
import { bundledFiles } from '../../tools/build-resources.ts';

const inflate: Inflate = (raw) => Promise.resolve(new Uint8Array(inflateRawSync(raw)));
// The bundled files' bytes are Node Buffers; compared as plain Uint8Arrays.
const files = bundledFiles().map((f) => ({ ...f, data: new Uint8Array(f.data), rsrc: new Uint8Array(f.rsrc) }));
const bundled = new Map(files.map((f) => [f.name, f]));
const app = bundled.get('Glider 4.05')!;
const house = bundled.get('The House')!;

function playedApp(): MacFile {
	const fork = parseResourceFork(app.rsrc);
	const prefs = fork.resources.find((r) => r.type === 'Gprf' && r.id === 128)!;
	prefs.data = prefs.data.map((v, i) => (i === 0 ? v ^ 0xff : v));
	return { ...app, rsrc: writeResourceFork(fork) };
}

function playedHouse(): MacFile {
	const rec = readLayout(houseRecLayout, house.data, 0);
	rec.hiScores[0] = 99999;
	rec.hiName[0] = 'Player';
	const data = new Uint8Array(house.data);
	writeLayout(houseRecLayout, rec, data, 0);
	return { ...house, data };
}

const savedGame: MacFile = { name: 'My Game', type: 'GLgm', creator: 'GLID', finderFlags: 0, created: 1, modified: 2, data: new Uint8Array(4060).fill(7), rsrc: new Uint8Array(0) };
const ownHouse: MacFile = { ...house, name: 'My House', data: house.data.map((v, i) => (i === 100 ? v ^ 1 : v)) };

test("the player's part is what they made or changed", () => {
	assert.equal(playerPart(bundled, app), null);
	assert.equal(playerPart(bundled, house), null);
	assert.equal(playerPart(bundled, bundled.get('Color Art')!), null);
	assert.notEqual(playerPart(bundled, playedApp()), null);
	assert.notEqual(playerPart(bundled, playedHouse()), null);
	assert.equal(playerPart(bundled, savedGame), savedGame);
});

test('exported files come back as they went, through MacBinary in a ZIP archive', async () => {
	const out = [playedApp(), playedHouse(), savedGame, ownHouse];
	const zip = exportArchive(out, new Date(2026, 9, 19, 12, 0, 0));
	const { files: back, rejected } = await readUploads([{ name: 'Glider Files.zip', bytes: zip }], inflate);
	assert.deepEqual(rejected, []);
	assert.deepEqual(back.map((f) => f.name), out.map((f) => f.name));
	// The application brings its preferences, a bundled house its scores, the rest themselves.
	const appBack = importedFile(bundled, undefined, back[0]!)!;
	assert.deepEqual(prefsOf(appBack), prefsOf(out[0]!));
	const houseBack = importedFile(bundled, undefined, back[1]!)!;
	assert.deepEqual(scoresOf(houseBack), scoresOf(out[1]!));
	assert.deepEqual(importedFile(bundled, undefined, back[2]!), savedGame);
	assert.deepEqual(importedFile(bundled, undefined, back[3]!), ownHouse);
	// The game's other files are ours.
	assert.equal(importedFile(bundled, undefined, { ...bundled.get('Color Art')!, data: new Uint8Array(1) }), null);
});

/** An AppleDouble file with Finder information and a resource fork, as macOS puts in a ZIP archive. */
function appleDouble(type: string, creator: string, rsrc: Uint8Array): Uint8Array {
	const entries: [number, Uint8Array][] = [
		[9, new Uint8Array([...new TextEncoder().encode(type + creator), ...new Uint8Array(24)])],
		[2, rsrc],
	];
	const header = 26 + entries.length * 12;
	const out = new Uint8Array(header + entries.reduce((n, [, b]) => n + b.length, 0));
	const dv = new DataView(out.buffer);
	dv.setUint32(0, 0x00051607);
	dv.setUint32(4, 0x00020000);
	dv.setUint16(24, entries.length);
	let off = header;
	entries.forEach(([id, b], k) => {
		dv.setUint32(26 + k * 12, id);
		dv.setUint32(30 + k * 12, off);
		dv.setUint32(34 + k * 12, b.length);
		out.set(b, off);
		off += b.length;
	});
	return out;
}

test("a macOS ZIP archive keeps each file's type and resource fork under __MACOSX", async () => {
	const rsrc = writeResourceFork(parseResourceFork(app.rsrc));
	const zip = writeZip(
		[
			{ name: 'Houses/', data: new Uint8Array(0) },
			{ name: 'Houses/Art House', data: house.data },
			{ name: '__MACOSX/Houses/._Art House', data: appleDouble('GLhs', 'GLed', rsrc) },
		],
		new Date(2026, 9, 19),
	);
	const { files: back, rejected } = await readUploads([{ name: 'houses.zip', bytes: zip }], inflate);
	assert.deepEqual(rejected, []);
	assert.equal(back.length, 1);
	assert.deepEqual([back[0]!.name, back[0]!.type, back[0]!.creator], ['Art House', 'GLhs', 'GLed']);
	assert.deepEqual(back[0]!.data, house.data);
	assert.deepEqual(back[0]!.rsrc, rsrc);
});

test('a bare house or saved game is known by its size, and other files are not Mac files', async () => {
	const { files: back, rejected } = await readUploads(
		[
			{ name: 'A House', bytes: house.data },
			{ name: 'A Game', bytes: savedGame.data },
			{ name: 'notes.txt', bytes: new TextEncoder().encode('hello') },
		],
		inflate,
	);
	assert.deepEqual(back.map((f) => [f.name, f.type, f.creator]), [['A House', 'GLhs', 'GLed'], ['A Game', 'GLgm', 'GLID']]);
	assert.deepEqual(rejected, ['notes.txt']);
});
