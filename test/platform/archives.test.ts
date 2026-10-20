// The Mac's archives and disk images (src/platform/StuffIt.ts, CompactPro.ts, DiskImage.ts): the
// oracle's copies of houses, older Glider releases and the More Glider floppy from the Macintosh
// Garden, unpacked as The Unarchiver and hfsutils unpack them (the forks' SHA-256 hashes, the first
// 16 digits, are below), and what Import Files… takes from them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { inflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import { type MacFile, parseMacBinary, writeMacBinary } from '../../src/mac/MacBinary.ts';
import { Volume } from '../../src/mac/Volume.ts';
import type { ArchiveContents } from '../../src/platform/Archive.ts';
import { artName, importedFile } from '../../src/platform/browser/Storage.ts';
import { readCompactPro } from '../../src/platform/CompactPro.ts';
import { readDiskImage } from '../../src/platform/DiskImage.ts';
import { readStuffIt } from '../../src/platform/StuffIt.ts';
import { type Inflate, readUploads } from '../../src/platform/Transfer.ts';
import { cacheDir } from '../../oracle/Oracle.ts';
import { bundledFiles } from '../../tools/build-resources.ts';

const inflate: Inflate = (raw) => Promise.resolve(new Uint8Array(inflateRawSync(raw)));
const empty = 'e3b0c44298fc1c14';

type Expected = { files: [string, string, string, string, string][]; failed: string[] };

/** Each StuffIt archive's files: name, type, creator, and the hashes of the data and resource forks. */
const archives: Record<string, Expected> = {
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
const path = (name: string) => join(cacheDir, 'imports', name);
const skip = (name: string) => (existsSync(path(name)) ? false : 'the oracle has not fetched its inputs (make oracle)');
const read = (name: string) => new Uint8Array(readFileSync(path(name)));

function unpacksAs(contents: ArchiveContents, want: Expected): void {
	assert.deepEqual(contents.files.map((f) => [f.name, f.type, f.creator, hash(f.data), hash(f.rsrc)]), want.files);
	assert.deepEqual(contents.failed.map((f) => f.name), want.failed);
}

for (const [name, want] of Object.entries(archives)) {
	test(`${name} unpacks as The Unarchiver unpacks it`, { skip: skip(name) }, () => {
		unpacksAs(readStuffIt(read(name)), want);
	});
}

/** The More Glider floppy (1992), a DiskCopy 4.2 image in MacBinary, as hfsutils reads it. */
const moreGlider: Expected = {
	files: [
		['Desktop', 'FNDR', 'ERIK', empty, 'bf2626cbfbeebac8'],
		['Icon\r', '\0\0\0\0', '\0\0\0\0', empty, 'ee2e8f6ef7423452'],
		['Mad House', 'GLhs', 'GLed', '52807c5d531d68de', empty],
		['Mad House 2', 'GLhs', 'GLed', '3a504846d533ee43', empty],
		['Mad House Read Me', 'ttro', 'ttxt', '9b3b36b9022447e9', empty],
		['Read Me First!', 'ttro', 'ttxt', '709e924f18b4d7c5', empty],
		['TeachText 1.2', 'APPL', 'ttxt', empty, '14d2ca48042f4a4d'],
		['Combo House', 'GLhs', 'GLed', '17b6dfb4f2e8c727', empty],
		['Combo House 2', 'GLhs', 'GLed', 'af5621d55a2ffe14', empty],
		['Combo House 3', 'GLhs', 'GLed', '18bb3c4679da2470', empty],
		['Combo House 4', 'GLhs', 'GLed', 'c623ba4b40825f9a', empty],
		['Combo House Read Me', 'ttro', 'ttxt', 'b05c2311afd494f1', empty],
		['House Full of Stuff', 'GLhs', 'GLed', '3175ee4eb0cfe21e', empty],
		['House Full of Stuff 2', 'GLhs', 'GLed', '5c8a5dcaf8763e9f', empty],
		['House Full of Stuff Next Door', 'GLhs', 'GLed', 'ecc3672be80bb3b8', empty],
		['House Full of Stuff Next Door 2', 'GLhs', 'GLed', 'e6841bc338958b84', empty],
		['House Full of Stuff Read Me', 'ttro', 'ttxt', '026ed0ebd1cf8a64', 'e61022ff9d1515ad'],
		['House Next Door Read Me', 'ttro', 'ttxt', 'b7e13114fb8f224b', '8c1e6e17bdc3c37c'],
		['House of Doom', 'GLhs', 'GLed', '69e3bfffa9c6906a', '5f51f0d3e9ea2346'],
		['House of Doom Read Me', 'ttro', 'ttxt', '704bcd266a57902f', 'ffd029e6585fc764'],
		['House of the Rising Sun', 'GLhs', 'GLed', '6091660d7bfef1c2', empty],
		['House of the Rising Sun 2', 'GLhs', 'GLed', '3298bc4f2de905f8', empty],
		['House of the Rising Sun 3', 'GLhs', 'GLed', '4d6e7d2d73d011ec', empty],
		['Icon\r', '\0\0\0\0', '\0\0\0\0', empty, '105b9ea2d24c00f4'],
		["Lumpy's Home", 'GLhs', 'GLed', '837124481416f324', empty],
		["Lumpy's Home Read Me", 'ttro', 'ttxt', '8c5fb93d153bd635', empty],
		['Rising Sun Read Me', 'ttro', 'ttxt', '59ec1b38d47bde54', empty],
		['Usher House', 'GLhs', 'GLed', '95a94d14a41943c1', empty],
		['Usher House Read Me', 'ttro', 'ttxt', '233b8f31eb81e81b', empty],
		['Goodies Read Me', 'ttro', 'ttxt', '82dbab3b994cf581', empty],
		['Icon\r', '\0\0\0\0', '\0\0\0\0', empty, 'c984900041fcf49c'],
		['Improved Art Files.sea', 'APPL', 'EXTR', 'bba3ad4168186f92', '37c981205161f424'],
		['Zero 2-20', 'APPL', 'GLis', empty, 'c7b5618a28513717'],
	],
	failed: [],
};

const floppy = 'more_glider.img_.bin';

function moreGliderFiles(): MacFile[] {
	return readDiskImage(parseMacBinary(read(floppy)).data).files;
}

test('the More Glider floppy reads as hfsutils reads it', { skip: skip(floppy) }, () => {
	unpacksAs(readDiskImage(parseMacBinary(read(floppy)).data), moreGlider);
});

test("the floppy's Improved Art, a Compact Pro archive that extracts itself, unpacks as The Unarchiver unpacks it", { skip: skip(floppy) }, () => {
	const sea = moreGliderFiles().find((f) => f.name === 'Improved Art Files.sea')!;
	unpacksAs(readCompactPro(sea.data), {
		files: [
			['Color Art', 'GLbk', 'GLID', empty, 'a564448f99782fbe'],
			['B&W Art', 'GLbk', 'GLID', empty, 'd6b1b0df021a61c1'],
		],
		failed: [],
	});
});

const hformat = (() => {
	try {
		execFileSync('hformat', ['--version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
})();

test('a full volume, whose catalog and files spill into the extents B-tree, reads as hfsutils wrote it', { skip: hformat ? false : 'hfsutils is not installed' }, () => {
	const dir = mkdtempSync(join(tmpdir(), 'hfs-'));
	try {
		const env = { ...process.env, HOME: dir };
		const hfs = (...args: string[]) => execFileSync(args[0]!, args.slice(1), { env, cwd: dir, stdio: 'pipe' });
		const vol = join(dir, 'v.hfs');
		writeFileSync(vol, new Uint8Array(800 * 1024));
		hfs('hformat', '-l', 'Full', vol);
		// Small files until the disk is full, every other one deleted, and a big file into the holes.
		const small = new Uint8Array(4000).map((_, i) => i * 7);
		writeFileSync(join(dir, 'small'), small);
		let n = 0;
		for (;;) {
			try {
				hfs('hcopy', '-r', 'small', `:s${n}`);
				n++;
			} catch {
				break;
			}
		}
		for (let i = 1; i < n; i += 2) {
			hfs('hdel', `:s${i}`);
		}
		const big = new Uint8Array(60000).map((_, i) => (i * 13) ^ (i >> 8));
		writeFileSync(join(dir, 'big'), big);
		hfs('hcopy', '-r', 'big', ':Big');
		// hfsutils' listing, one name and data fork size to a line.
		const listed = hfs('hls', '-1', '-l')
			.toString('latin1')
			.trim()
			.split('\n')
			.map((line) => line.trim().split(/\s+/))
			.map((w) => [w.at(-1)!, Number(w[3])] as [string, number]);
		hfs('humount');
		const { files, failed } = readDiskImage(new Uint8Array(readFileSync(vol)));
		assert.deepEqual(failed, []);
		const byName = (a: [string, number], b: [string, number]) => a[0].localeCompare(b[0]);
		assert.deepEqual(files.map((f) => [f.name, f.data.length] as [string, number]).sort(byName), listed.sort(byName));
		assert.deepEqual(files.find((f) => f.name === 'Big')!.data, big);
		assert.ok(files.filter((f) => f.name !== 'Big' && f.data.length === 4000).every((f) => f.data.every((v, i) => v === small[i])));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

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

test('Import Files… takes the floppy\'s houses and the art inside its self-extracting archive', { skip: skip(floppy) }, async () => {
	const { files, rejected } = await readUploads([{ name: floppy, bytes: read(floppy) }], inflate);
	assert.deepEqual(rejected, []);
	assert.deepEqual(
		files.map((f) => f.name),
		moreGlider.files.filter(([, type]) => type === 'GLhs').map(([name]) => name).concat(['Color Art', 'B&W Art']),
	);
});

test('imported art goes beside the game\'s, once', { skip: skip(floppy) }, async () => {
	const volume = new Volume('Glider');
	for (const f of bundledFiles()) {
		volume.put(f);
	}
	const { files } = await readUploads([{ name: floppy, bytes: read(floppy) }], inflate);
	const improved = files.find((f) => f.name === 'Color Art')!;
	// The game's own art, imported, is there already.
	assert.equal(artName(volume, volume.get('Color Art')!), null);
	assert.equal(artName(volume, { ...volume.get('Color Art')!, name: 'Other Name' }), null);
	assert.equal(artName(volume, improved), 'Color Art 2');
	volume.put({ ...improved, name: 'Color Art 2' });
	assert.equal(artName(volume, improved), null);
	assert.equal(artName(volume, { ...improved, rsrc: improved.rsrc.slice(1) }), 'Color Art 3');
});
