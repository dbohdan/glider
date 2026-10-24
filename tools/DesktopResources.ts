// The desktop's resource file (PORT.md, decision 16): its icons, Glider 4.0's and the Room Editor's
// own from their bundles and "Source Code", a System 6 folder with Git's branch mark, and its
// alerts. The file lies invisible on the port's volume, as the Finder lies in the System Folder.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MacFile } from '../src/mac/MacBinary.ts';
import { ResourceFork, writeResourceFork } from '../src/mac/ResourceFork.ts';
import { encodeMacRoman } from '../src/mac/MacRoman.ts';
import { parseDeRez } from './DeRez.ts';

/** The desktop's file on the volume. */
export const desktopFileName = 'Desktop';

/** Icon IDs: Glider 4.0, the Room Editor, and Source Code. */
export const gliderIconID = 128;
export const editorIconID = 129;
export const sourceIconID = 130;

/**
 * Source Code's icon and mask, as rows of 32 pixels ('#' black). The folder is System 6's (measured
 * from the Finder's window in the oracle, where it is drawn on white); the mark inside is the
 * branch graph of Jason Long's Git logo (CC BY 3.0): two commits on a line and a branch to a third.
 */
const sourceIcon = [
	'................................',
	'................................',
	'................................',
	'................................',
	'................................',
	'................................',
	'................................',
	'.....#######....................',
	'....#.......#...................',
	'...#.........#..................',
	'..#...........#.................',
	'.#############################..',
	'#.............................#.',
	'#........##.........##........#.',
	'#.......####.......####.......#.',
	'#.......####.......####.......#.',
	'#........##.........##........#.',
	'#........##........##.........#.',
	'#........##.......##..........#.',
	'#........##......##...........#.',
	'#........##.....##............#.',
	'#........##....##.............#.',
	'#........##...##..............#.',
	'#........##..##...............#.',
	'#........##.##................#.',
	'#........####.................#.',
	'#........##...................#.',
	'#.......####..................#.',
	'#.......####..................#.',
	'#........##...................#.',
	'#.............................#.',
	'###############################.',
];

/** The folder's shape: everything inside its outline. */
const sourceMask = [
	'................................',
	'................................',
	'................................',
	'................................',
	'................................',
	'................................',
	'................................',
	'.....#######....................',
	'....#########...................',
	'...###########..................',
	'..#############.................',
	'.#############################..',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
	'###############################.',
];

function bits(rows: string[]): number[] {
	const out: number[] = [];
	for (const row of rows) {
		for (let i = 0; i < 32; i += 8) {
			out.push(parseInt(row.slice(i, i + 8).replace(/#/g, '1').replace(/\./g, '0'), 2));
		}
	}
	return out;
}

function word(v: number): number[] {
	return [(v >> 8) & 0xff, v & 0xff];
}

/** A 'DITL' of buttons (4), static text (8, disabled 136) and icons (32, disabled 160). */
function ditl(items: [type: number, rect: [number, number, number, number], data: number[]][]): Uint8Array {
	const out: number[] = [...word(items.length - 1)];
	for (const [type, rect, data] of items) {
		out.push(0, 0, 0, 0, ...rect.flatMap(word), type, data.length, ...data);
		if (data.length & 1) {
			out.push(0);
		}
	}
	return new Uint8Array(out);
}

function text(s: string): number[] {
	return [...encodeMacRoman(s)];
}

/** The desktop's resource file, read from the original applications' resources. */
export function desktopFile(root: string): MacFile {
	const rf = new ResourceFork();
	const put = (type: string, id: number, data: Uint8Array | number[]) => rf.put({ type, id, name: null, attrs: 0, data: new Uint8Array(data) });
	const glider = parseDeRez(readFileSync(join(root, 'Glider_405/Glider.r')));
	const editor = parseDeRez(readFileSync(join(root, 'RoomEditor_103/Editor.r')));
	// Each application's own icon: its bundle's FREF for 'APPL' names ICN# 128 (local ID 0).
	put('ICN#', gliderIconID, glider.get('ICN#', 128)!.data);
	put('ICN#', editorIconID, editor.get('ICN#', 128)!.data);
	put('ICN#', sourceIconID, [...bits(sourceIcon), ...bits(sourceMask)]);
	// The alerts' icon: Glider's, the black and white half of its ICN#.
	put('ICON', gliderIconID, glider.get('ICN#', 128)!.data.slice(0, 128));
	// About the Desktop…: a note alert, OK, with the port's name and the notice the MIT License asks for (the license's
	// whole text is served beside the page, as LICENSE), and what the page was built from (^0, the day; ^1, the commit),
	// so that copies hosted elsewhere can be told apart; two lines' room, for a commit marked "-dirty".
	put('ALRT', 129, [...word(80), ...word(96), ...word(224), ...word(416), ...word(129), 0x55, 0x55]);
	put('DITL', 129, ditl([
		[4, [114, 238, 134, 308], text('OK')],
		[136, [10, 72, 74, 308], text('Glider 4.0 Unofficial Web Edition, a port of Glider 4.0 by John Calhoun, \u00a9 2016 softdorothy. Distributed under the MIT License.')],
		[160, [10, 20, 42, 52], word(gliderIconID)],
		[136, [78, 72, 110, 308], text('Built ^0 from commit ^1.')],
	]));
	// A message from the desktop (^0): a note alert, OK.
	put('ALRT', 130, [...word(80), ...word(96), ...word(176), ...word(416), ...word(130), 0x55, 0x55]);
	put('DITL', 130, ditl([
		[4, [66, 238, 86, 308], text('OK')],
		[136, [10, 72, 58, 308], text('^0')],
		[160, [10, 20, 42, 52], word(gliderIconID)],
	]));
	// Reset Preferences and Scores…: a caution alert, Cancel the default.
	put('ALRT', 131, [...word(80), ...word(96), ...word(192), ...word(416), ...word(131), 0x55, 0x55]);
	put('DITL', 131, ditl([
		[4, [82, 238, 102, 308], text('Cancel')],
		[4, [82, 150, 102, 220], text('Reset')],
		[136, [10, 72, 74, 308], text('Restore Glider\u2019s original preferences and high scores? Your saved games and your own houses aren\u2019t changed.')],
		[160, [10, 20, 42, 52], word(gliderIconID)],
	]));
	return { name: desktopFileName, type: 'FNDR', creator: 'GLD4', finderFlags: 0x4000, created: 0, modified: 0, data: new Uint8Array(0), rsrc: writeResourceFork(rf) };
}
