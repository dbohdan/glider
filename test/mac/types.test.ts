import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BSR, BTST, cloneRect, div, fourCC, HiWord, int16, int32, LoWord, mod } from '../../src/mac/Types.ts';

test('int16 wraps like a 68000 word', () => {
	assert.equal(int16(32767), 32767);
	assert.equal(int16(32768), -32768);
	assert.equal(int16(65535), -1);
	assert.equal(int16(-32769), 32767);
});

test('int32 wraps like a 68000 long word', () => {
	assert.equal(int32(2 ** 31), -(2 ** 31));
	assert.equal(int32(2 ** 32 + 5), 5);
});

test('div truncates toward zero and mod follows the dividend', () => {
	assert.equal(div(7, 2), 3);
	assert.equal(div(-7, 2), -3);
	assert.equal(mod(-7, 2), -1);
	assert.equal(div(-512 + 13, 32), -15);
});

test('HiWord and LoWord split a long word into signed words', () => {
	assert.equal(HiWord(0x0001ffff), 1);
	assert.equal(LoWord(0x0001ffff), -1);
	assert.equal(HiWord(-1), -1);
});

test('BSR is a logical shift and BTST counts from the least significant bit', () => {
	assert.equal(BSR(-1, 24), 0xff);
	assert.equal(BSR(0x240, 1), 0x120);
	assert.equal(BTST(1, 0), true);
	assert.equal(BTST(2, 0), false);
});

test('cloneRect copies like Pascal record assignment', () => {
	const a = { top: 1, left: 2, bottom: 3, right: 4 };
	const b = cloneRect(a);
	b.top = 10;
	assert.equal(a.top, 1);
});

test('fourCC packs big-endian', () => {
	assert.equal(fourCC('PICT'), 0x50494354);
});
