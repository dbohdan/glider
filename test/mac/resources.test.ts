import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc16, parseMacBinary, writeMacBinary } from '../../src/mac/MacBinary.ts';
import { decodeMacRoman, encodeMacRoman, macRomanChar, pascalString } from '../../src/mac/MacRoman.ts';
import { parseResourceFork, resLocked, resPreload, resPurgeable, writeResourceFork } from '../../src/mac/ResourceFork.ts';
import { parseDeRez } from '../../tools/DeRez.ts';

const root = new URL('../../', import.meta.url).pathname;
const gliderR = parseDeRez(readFileSync(root + 'Glider_405/Glider.r'));

test('MacRoman maps 128 distinct high characters and round-trips', () => {
	const chars = new Set<string>();
	for (let c = 0x80; c < 0x100; c++) {
		chars.add(macRomanChar(c));
	}
	assert.equal(chars.size, 128);
	const all = new Uint8Array(256).map((_, i) => i);
	assert.deepEqual(encodeMacRoman(decodeMacRoman(all)), all);
	assert.equal(macRomanChar(0xc9), '…');
	assert.equal(macRomanChar(0xaa), '™');
});

test('Glider.r parses into the 4.05 application resources', () => {
	assert.equal(gliderR.resources.length, 271);
	const count = (t: string) => gliderR.ofType(t).length;
	assert.equal(count('PICT'), 15);
	assert.equal(count('SMSD'), 30);
	assert.equal(count('cicn'), 51);
	assert.equal(count('FONT'), 7);
	const vers = gliderR.get('vers', 1)!;
	assert.equal(pascalString(vers.data, 6), 'Glider 4.05™');
	const smsd = gliderR.get('SMSD', 1)!;
	assert.equal(smsd.attrs, resPurgeable | resLocked | resPreload);
	assert.equal(smsd.data.length, 17408);
	assert.equal(gliderR.get('CURS', 128)!.name, 'oz');
	assert.equal(gliderR.get('mctb', 128)!.name, '\x14 menu');
});

test('resource forks round-trip through the writer', () => {
	const fork = writeResourceFork(gliderR);
	const back = parseResourceFork(fork);
	assert.equal(back.resources.length, gliderR.resources.length);
	for (const r of gliderR.resources) {
		const b = back.get(r.type, r.id)!;
		assert.ok(b, `${r.type} ${r.id}`);
		assert.equal(b.name, r.name);
		assert.equal(b.attrs, r.attrs);
		assert.deepEqual(b.data, r.data);
	}
});

test('MacBinary art files hold 15 PICTs and a depth resource', () => {
	for (const [file, depth] of [['Color Art.bin', 4], ['B&W Art.bin', 1]] as const) {
		const f = parseMacBinary(readFileSync(root + 'Glider_405/' + file));
		assert.equal(f.type, 'GLbk');
		assert.equal(f.creator, 'GLID');
		const rf = parseResourceFork(f.rsrc);
		assert.equal(rf.ofType('PICT').length, 15);
		const deep = rf.get('deep', 128)!.data;
		assert.equal((deep[0]! << 8) | deep[1]!, depth);
	}
});

test('MacBinary round-trips with a valid header CRC', () => {
	assert.equal(crc16(new TextEncoder().encode('123456789')), 0x31c3);
	const f = parseMacBinary(readFileSync(root + 'Glider_405/Color Art.bin'));
	const bytes = writeMacBinary(f);
	assert.equal(crc16(bytes.subarray(0, 124)), (bytes[124]! << 8) | bytes[125]!);
	const back = parseMacBinary(bytes);
	assert.equal(back.name, f.name);
	assert.equal(back.type, f.type);
	assert.deepEqual(back.rsrc, f.rsrc);
	assert.equal(bytes.length % 128, 0);
});
