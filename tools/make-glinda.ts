// Writes assets/fonts/Glinda-9.bdf from Executor's System file (MIT license), whose Geneva 9 is
// identical to the System 6.0.8 Geneva 9 bitmap font (compared glyph by glyph). Run once; the BDF
// file is the source.
//
// Usage: node tools/make-glinda.ts EXECUTOR/packages/skel/volume/System\ Folder/%System

import { readFileSync, writeFileSync } from 'node:fs';
import { parseFontStrike } from '../src/mac/Fonts.ts';
import { parseAppleDouble } from '../src/mac/MacBinary.ts';
import { parseResourceFork } from '../src/mac/ResourceFork.ts';
import { strikeToBdf, writeBdf } from './Bdf.ts';

function main(systemPath: string): void {
	const system = parseResourceFork(parseAppleDouble(readFileSync(systemPath), 'System').rsrc);
	const strike = parseFontStrike(system.get('FONT', 3 * 128 + 9)!.data);
	const bdf = strikeToBdf(strike, 'Glinda-9', 'Glinda', 9);
	const comments = [
		'Glinda 9: the application font of the Glider 4 port, as on the desktop.',
		'The glyphs of the Geneva 9 bitmap font, from the System file of Executor',
		'(https://github.com/autc04/executor, MIT license), re-encoded.',
		'The MAC_ properties keep QuickDraw font metrics; the missing-character glyph is ENCODING -1.',
	];
	writeFileSync(new URL('../assets/fonts/Glinda-9.bdf', import.meta.url), writeBdf(bdf, comments));
}

if (import.meta.main) {
	main(process.argv[2]!);
}
