// Writes assets/fonts/Ozma-12.bdf from Executor's System file (MIT license), whose Chicago 12 is
// identical to the System 6.0.8 Chicago 12 bitmap font. Run once; the BDF file is the source.
//
// Usage: node tools/make-ozma.ts EXECUTOR/packages/skel/volume/System\ Folder/%System

import { readFileSync, writeFileSync } from 'node:fs';
import { parseFontStrike } from '../src/mac/Fonts.ts';
import { parseAppleDouble } from '../src/mac/MacBinary.ts';
import { parseResourceFork } from '../src/mac/ResourceFork.ts';
import { strikeToBdf, writeBdf } from './Bdf.ts';

function main(systemPath: string): void {
	const system = parseResourceFork(parseAppleDouble(readFileSync(systemPath), 'System').rsrc);
	const strike = parseFontStrike(system.get('FONT', 12)!.data);
	const bdf = strikeToBdf(strike, 'Ozma-12', 'Ozma', 12);
	const comments = [
		'Ozma 12: the system font of the Glider 4 port.',
		'The glyphs of the Chicago 12 bitmap font, from the System file of Executor',
		'(https://github.com/autc04/executor, MIT license), re-encoded.',
		'The MAC_ properties keep QuickDraw font metrics; the missing-character glyph is ENCODING -1.',
	];
	writeFileSync(new URL('../assets/fonts/Ozma-12.bdf', import.meta.url), writeBdf(bdf, comments));
}

if (import.meta.main) {
	main(process.argv[2]!);
}
