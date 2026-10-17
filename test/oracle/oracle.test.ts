import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readPNM, writePNG } from '../../oracle/Image.ts';
import { Script, keyCodes } from '../../oracle/Script.ts';
import { alternateScreenFile } from '../../oracle/Oracle.ts';

test('scripts compile to emulator commands and count ticks', () => {
	const s = new Script().wait(10).press('n', 'command').shot('a').type('A!');
	assert.equal(s.tick, 10 + 6 + 12);
	assert.deepEqual(s.shots, [{ name: 'a', tick: 16 }]);
	assert.equal(
		s.text(),
		['w 10', `k ${keyCodes.command} 1`, 'k 45 1', 'w 3', 'k 45 0', `k ${keyCodes.command} 0`, 'w 3', 's a',
			'k 56 1', 'k 0 1', 'w 3', 'k 0 0', 'k 56 0', 'w 3', 'k 56 1', 'k 18 1', 'w 3', 'k 18 0', 'k 56 0', 'w 3', 'q', ''].join('\n'),
	);
	assert.throws(() => s.until(5));
	assert.throws(() => s.shot('a b'));
});

test('PBM images read with 1 as black, and PNG output decodes to the same pixels', () => {
	const pbm = new Uint8Array([...new TextEncoder().encode('P4\n# c\n10 2\n'), 0b10000000, 0b01000000, 0xff, 0xc0]);
	const img = readPNM(pbm);
	assert.equal(img.width, 10);
	assert.deepEqual([...img.rgb.subarray(0, 6)], [0, 0, 0, 255, 255, 255]);
	assert.deepEqual([...img.rgb.subarray(9 * 3, 10 * 3)], [0, 0, 0]);
	assert.deepEqual([...img.rgb.subarray(10 * 3)], Array.from({ length: 30 }, () => 0));
	const png = writePNG(img);
	assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
	const idatLength = new DataView(png.buffer).getUint32(33);
	const raw = inflateSync(png.subarray(41, 41 + idatLength));
	assert.deepEqual([...raw.subarray(1, 31)], [...img.rgb.subarray(0, 30)]);
});

test('the alternate screen stand-in is a debugger file with code in its second block', () => {
	const f = alternateScreenFile();
	assert.equal(f.type, 'dbgr');
	assert.equal(f.name.toLowerCase(), 'macsbug');
	assert.deepEqual([...f.data.subarray(0, 512)], Array.from({ length: 512 }, () => 0));
	assert.deepEqual([...f.data.subarray(-4)], [3, 0x61, 0x6c, 0x74]);
});
