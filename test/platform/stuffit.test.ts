// StuffIt archives (src/platform/StuffIt.ts): the oracle's copies of houses and older Glider releases
// from the Macintosh Garden, unpacked as The Unarchiver unpacks them (its forks' SHA-256 hashes, the
// first 16 digits, are below), and what Import Files… takes from them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import { writeMacBinary } from '../../src/mac/MacBinary.ts';
import { importedFile } from '../../src/platform/browser/Storage.ts';
import { readStuffIt } from '../../src/platform/StuffIt.ts';
import { type Inflate, readUploads } from '../../src/platform/Transfer.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { bundledFiles } from '../../tools/build-resources.ts';

const inflate: Inflate = (raw) => Promise.resolve(new Uint8Array(inflateRawSync(raw)));
const empty = 'e3b0c44298fc1c14';

/** Each archive's files: name, type, creator, and the hashes of the data and resource forks. */
const archives: Record<string, { files: [string, string, string, string, string][]; failed: string[] }> = {
	// Classic StuffIt, Arsenic (method 15).
	'lavillastrangiato.sit': {
		files: [
			['Description', 'TEXT', 'ttxt', '03b8011d01c5aa96', empty],
			['La Villa - Information', 'TEXT', 'ttxt', 'a91514ad875bf58a', 'e27ff53b29f21403'],
			['La Villa Strangiato', 'GLhs', 'GLed', '472c67b53265ecc7', 'b272b45c86ba2e1d'],
		],
		failed: [],
	},
	'imagineart_1.sit': {
		files: [
			['Description', 'TEXT', 'ttxt', 'ab61c535043f9bc7', empty],
			['ImagineArt', 'GLbk', 'GLID', empty, '58f5dca83202e073'],
			['ImagineArt Readme', 'TEXT', 'ttxt', 'e45b6da80e8f80e7', '584df2bdf14388a3'],
		],
		failed: [],
	},
	// StuffIt 5, method 13; two files use its built-in code tables, which are not read.
	'glider4.02.sit': {
		files: [
			['Art 16', 'GLbk', 'GLID', empty, 'bd53c20343f36dca'],
			['Art 2', 'GLbk', 'GLID', empty, '76fa7efb8546a3c2'],
			['Demo House', 'GLhs', 'GLed', '94de4fd562b6abf0', empty],
			['FS World Scenery', 'SCNY', 'MFS4', 'c913d0888f96de2e', 'b783bdb5427008c6'],
			['Glider 4.02', 'APPL', 'GLID', empty, '9562a02a63015913'],
			['The House', 'GLhs', 'GLed', 'a3cc7e132f45a945', empty],
			['The House 2', 'GLhs', 'GLed', 'f2db942300fa76f9', empty],
		],
		failed: ['Glider Gravis Settings', 'MacsBug'],
	},
	// Classic StuffIt, method 13 in folders.
	'glider_4.04.sit': {
		files: [
			['Art 16', 'GLbk', 'GLID', empty, '83e6780f2a901c40'],
			['Art 2', 'GLbk', 'GLID', empty, '858ae863bd710264'],
			['Editor 1.01', 'APPL', 'GLed', empty, 'dd3601299a3e9219'],
			['Glider™', 'APPL', 'GLID', empty, '64ead8ef1a51eaa7'],
			['The House', 'GLhs', 'GLed', '3afe7a0a7fa751d2', empty],
			['The House 2', 'GLhs', 'GLed', 'f2db942300fa76f9', empty],
		],
		failed: ['Glider Gravis Settings'],
	},
};

const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const path = (name: string) => join(cacheDir, 'stuffit', name);
const skip = (name: string) => (existsSync(path(name)) ? false : 'the oracle has not fetched its inputs (make oracle)');
const read = (name: string) => new Uint8Array(readFileSync(path(name)));

for (const [name, want] of Object.entries(archives)) {
	test(`${name} unpacks as The Unarchiver unpacks it`, { skip: skip(name) }, () => {
		const { files, failed } = readStuffIt(read(name));
		assert.deepEqual(files.map((f) => [f.name, f.type, f.creator, hash(f.data), hash(f.rsrc)]), want.files);
		assert.deepEqual(failed.map((f) => f.name), want.failed);
	});
}

test('Import Files… takes the house from La Villa Strangiato, bare or in MacBinary', { skip: skip('lavillastrangiato.sit') }, async () => {
	const sit = read('lavillastrangiato.sit');
	const bin = writeMacBinary({ name: 'LaVillaStrangiato.sit', type: 'SIT!', creator: 'SIT!', finderFlags: 0, created: 0, modified: 0, data: sit, rsrc: new Uint8Array(0) });
	for (const upload of [{ name: 'LaVillaStrangiato.sit', bytes: sit }, { name: 'LaVillaStrangiato.sit.bin', bytes: bin }]) {
		const { files, rejected } = await readUploads([upload], inflate);
		assert.deepEqual(rejected, []);
		assert.deepEqual(files.map((f) => [f.name, f.type, hash(f.data)]), [['La Villa Strangiato', 'GLhs', '472c67b53265ecc7']]);
	}
});

test("Import Files… takes Glider 4.04's houses and art, the scores of the houses Glider brings, and not its application", { skip: skip('glider_4.04.sit') }, async () => {
	const { files, rejected } = await readUploads([{ name: 'glider_4.04.sit', bytes: read('glider_4.04.sit') }], inflate);
	// The settings file it cannot read is not one Glider uses.
	assert.deepEqual(rejected, []);
	assert.deepEqual(files.map((f) => f.name), ['Art 16', 'Art 2', 'Glider™', 'The House', 'The House 2']);
	const bundled = new Map(bundledFiles().map((f) => [f.name, f]));
	const kept = files.map((f) => importedFile(bundled, undefined, f)?.name ?? null);
	assert.deepEqual(kept, ['Art 16', 'Art 2', null, 'The House', 'The House 2']);
});
