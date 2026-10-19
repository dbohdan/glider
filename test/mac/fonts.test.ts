import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDir, systemFiles } from '../../oracle/Oracle.ts';
import { type FontStrike, glyphOf, parseFontStrike } from '../../src/mac/Fonts.ts';
import { parseResourceFork } from '../../src/mac/ResourceFork.ts';
import { bdfToFontResource, readBdf, strikeToBdf, writeBdf } from '../../tools/Bdf.ts';

const ozmaText = readFileSync(new URL('../../assets/fonts/Ozma-12.bdf', import.meta.url), 'utf8');
const ozma = parseFontStrike(bdfToFontResource(readBdf(ozmaText)));

/** A glyph as what QuickDraw draws: its offset, advance, and bits. */
function glyphKey(f: FontStrike, ch: number): string {
	const g = glyphOf(f, ch);
	const rows: string[] = [];
	for (let y = 0; y < f.ascent + f.descent; y++) {
		let r = '';
		for (let x = 0; x < g.imageWidth; x++) {
			const col = g.locStart + x;
			r += (f.bitImage[y * f.rowWords * 2 + (col >> 3)]! >> (7 - (col & 7))) & 1;
		}
		rows.push(r);
	}
	return `${g.imageOffset}/${g.width}:${rows.join('|')}`;
}

test('Ozma survives BDF to FONT and back', () => {
	const again = writeBdf(strikeToBdf(ozma, 'Ozma-12', 'Ozma', 12), []);
	const strip = (t: string) => t.split('\n').filter((l) => !l.startsWith('COMMENT')).join('\n');
	assert.equal(strip(again), strip(ozmaText));
	assert.equal(ozma.ascent, 12);
	assert.equal(ozma.descent, 3);
	assert.equal(glyphOf(ozma, 0x41).width, 8);
});

test('Ozma draws every character as System 6.0.8 Chicago 12 does', { skip: existsSync(join(cacheDir, 'System 6.0.8 HD.dsk')) ? false : 'the oracle is not set up (make oracle)' }, () => {
	const chicago = parseFontStrike(parseResourceFork(systemFiles().find((f) => f.name === 'System')!.rsrc).get('FONT', 12)!.data);
	for (const key of ['ascent', 'descent', 'leading', 'widMax', 'kernMax', 'fRectHeight'] as const) {
		assert.equal(ozma[key], chicago[key], key);
	}
	for (let ch = 0; ch < 256; ch++) {
		if (ch === 0x14) {
			// Chicago's Apple logo is a diamond in Ozma, in the same box.
			const [o, c] = [glyphOf(ozma, ch), glyphOf(chicago, ch)];
			assert.deepEqual([o.imageOffset, o.width, o.imageWidth], [c.imageOffset, c.width, c.imageWidth], 'character 20');
			assert.notEqual(glyphKey(ozma, ch), glyphKey(chicago, ch), 'character 20');
			continue;
		}
		assert.equal(glyphKey(ozma, ch), glyphKey(chicago, ch), `character ${ch}`);
	}
});

const glindaText = readFileSync(new URL('../../assets/fonts/Glinda-9.bdf', import.meta.url), 'utf8');
const glinda = parseFontStrike(bdfToFontResource(readBdf(glindaText)));

test('Glinda survives BDF to FONT and back', () => {
	const again = writeBdf(strikeToBdf(glinda, 'Glinda-9', 'Glinda', 9), []);
	const strip = (t: string) => t.split('\n').filter((l) => !l.startsWith('COMMENT')).join('\n');
	assert.equal(strip(again), strip(glindaText));
});

test('Glinda draws every character as System 6.0.8 Geneva 9 does', { skip: existsSync(join(cacheDir, 'System 6.0.8 HD.dsk')) ? false : 'the oracle is not set up (make oracle)' }, () => {
	const geneva = parseFontStrike(parseResourceFork(systemFiles().find((f) => f.name === 'System')!.rsrc).get('FONT', 3 * 128 + 9)!.data);
	for (const key of ['ascent', 'descent', 'leading', 'widMax', 'kernMax', 'fRectHeight'] as const) {
		assert.equal(glinda[key], geneva[key], key);
	}
	for (let ch = 0; ch < 256; ch++) {
		assert.equal(glyphKey(glinda, ch), glyphKey(geneva, ch), `character ${ch}`);
	}
});
