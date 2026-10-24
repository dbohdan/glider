// Builds the bundled Mac volume: the files Glider finds next to itself, packed as MacBinary,
// plus a manifest. Usage: node tools/build-resources.ts <output directory>

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMacBinary, writeMacBinary, type MacFile } from '../src/mac/MacBinary.ts';
import { ResourceFork, writeResourceFork } from '../src/mac/ResourceFork.ts';
import { bdfToFontResource, readBdf } from './Bdf.ts';
import type { VolumeManifest } from '../src/mac/Volume.ts';
import { parseDeRez } from './DeRez.ts';
import { applicationIcon, socialCard } from './Favicon.ts';
import { desktopFile } from './DesktopResources.ts';
import { putStandardFileResources } from './SystemResources.ts';

const root = new URL('..', import.meta.url).pathname;

/** 1992-02-01 00:00:00, when the Glider 4.05 project was last modified, in Mac seconds. */
const defaultDate = 2779747200;

function macFile(name: string, type: string, creator: string, data: Uint8Array, rsrc: Uint8Array): MacFile {
	return { name, type, creator, finderFlags: 0, created: defaultDate, modified: defaultDate, data, rsrc };
}

/** Returns the files of the bundled volume, in the order they are listed. */
export function bundledFiles(): MacFile[] {
	const files: MacFile[] = [];
	const glider = parseDeRez(readFileSync(join(root, 'Glider_405/Glider.r')));
	files.push(macFile('Glider 4.05', 'APPL', 'GLID', new Uint8Array(0), writeResourceFork(glider)));
	const editor = parseDeRez(readFileSync(join(root, 'RoomEditor_103/Editor.r')));
	files.push(macFile('Room Editor 1.03', 'APPL', 'GLed', new Uint8Array(0), writeResourceFork(editor)));
	for (const art of ['Color Art', 'B&W Art']) {
		const f = parseMacBinary(readFileSync(join(root, 'Glider_405', `${art}.bin`)));
		files.push({ ...f, name: art });
	}
	// The House as shipped in every release from 4.02 to 4.10 (copied from the 4.07 floppies).
	for (const name of ['The House', 'The House 2']) {
		files.push(macFile(name, 'GLhs', 'GLed', readFileSync(join(root, 'assets/houses', name)), new Uint8Array(0)));
	}
	// The working copy of The House in the source release, which never shipped.
	files.push(macFile('The House (July 1991)', 'GLhs', 'GLed', readFileSync(join(root, 'Houses/The House')), new Uint8Array(0)));
	for (const name of readdirSync(join(root, 'Houses')).sort()) {
		if (name === 'The House' || name === 'The House 2') {
			continue;
		}
		const bytes = readFileSync(join(root, 'Houses', name));
		if (name.endsWith('.txt')) {
			// The read-me files are MacRoman text with CR line endings already.
			files.push(macFile(name.replace(/\.txt$/, ''), 'TEXT', 'ttxt', bytes, new Uint8Array(0)));
		} else {
			files.push(macFile(name, 'GLhs', 'GLed', bytes, new Uint8Array(0)));
		}
	}
	// The desktop, which plays the Finder's part (PORT.md, decision 16), invisible as the Finder is.
	files.push(desktopFile(root));
	return files;
}

/**
 * The port's System file: what Glider uses of the System's resources, made by the port. The system
 * font is Ozma (Chicago 12's glyphs), the application font Glinda (Geneva 9's and 12's); the desktop pattern
 * is 50% gray, and solid gray on a color screen.
 */
export function systemFork(): ResourceFork {
	const rf = new ResourceFork();
	const ozma = bdfToFontResource(readBdf(readFileSync(join(root, 'assets/fonts/Ozma-12.bdf'), 'latin1')));
	rf.put({ type: 'FONT', id: 0, name: 'Chicago', attrs: 0, data: new Uint8Array(0) });
	rf.put({ type: 'FONT', id: 12, name: null, attrs: 0, data: ozma });
	// The application font, Geneva (family 3), in the size the desktop names its icons in, and in the
	// size of the Room Editor's help text.
	rf.put({ type: 'FONT', id: 3 * 128, name: 'Geneva', attrs: 0, data: new Uint8Array(0) });
	for (const size of [9, 12]) {
		const glinda = bdfToFontResource(readBdf(readFileSync(join(root, `assets/fonts/Glinda-${size}.bdf`), 'latin1')));
		rf.put({ type: 'FONT', id: 3 * 128 + size, name: null, attrs: 0, data: glinda });
	}
	const gray = [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55];
	rf.put({ type: 'PAT ', id: 16, name: null, attrs: 0, data: new Uint8Array(gray) });
	// The scroll bars' track (CDEF 1): System 6.0.8's PAT 17.
	rf.put({ type: 'PAT ', id: 17, name: null, attrs: 0, data: new Uint8Array([0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22]) });
	rf.put({ type: 'ppat', id: 16, name: null, attrs: 0, data: deskPixPat(gray) });
	putStandardFileResources(rf);
	rf.put({ type: 'CURS', id: 4, name: null, attrs: 0, data: watchCursor() });
	return rf;
}

/**
 * The color desktop pattern (ppat 16): solid medium gray, as the oracle's Mac II shows its desktop at
 * 16 colors (128, 128, 128, before any program starts), with the 50% gray pattern for screens of one
 * or two bits. A pixel pattern of type 1: an 8-by-8 one-bit pixel map whose set pixels are gray.
 */
function deskPixPat(gray: number[]): Uint8Array {
	const d = new Uint8Array(28 + 50 + 16 + 8 + 2 * 8);
	const view = new DataView(d.buffer);
	view.setUint16(0, 1); // patType
	view.setUint32(2, 28); // patMap
	view.setUint32(6, 78); // patData
	view.setInt16(14, -1); // patXValid
	d.set(gray, 20); // pat1Data
	view.setUint16(28 + 4, 0x8002); // rowBytes
	view.setInt16(28 + 10, 8); // bounds.bottom
	view.setInt16(28 + 12, 8); // bounds.right
	view.setUint32(28 + 22, 0x00480000); // hRes
	view.setUint32(28 + 26, 0x00480000); // vRes
	view.setInt16(28 + 32, 1); // pixelSize
	view.setInt16(28 + 34, 1); // cmpCount
	view.setInt16(28 + 36, 1); // cmpSize
	view.setUint32(28 + 42, 94); // pmTable
	d.fill(0xff, 78, 94); // every pixel 1
	view.setInt16(94 + 6, 1); // ctSize: two colors
	const colors = [0xffff, 0x8000];
	colors.forEach((c, i) => {
		view.setInt16(94 + 8 + i * 8, i);
		view.setUint16(94 + 10 + i * 8, c);
		view.setUint16(94 + 12 + i * 8, c);
		view.setUint16(94 + 14 + i * 8, c);
	});
	return d;
}

/**
 * The watch cursor (CURS 4, watchCursor), which the Mac keeps in its ROM: a wristwatch of the port's
 * own drawing, not the ROM's ('#' black, 'o' white, '.' clear), with its hot spot at its center.
 * Tests that compare cursors with the oracle's use the ROM's.
 */
function watchCursor(): Uint8Array {
	const art = [
		'....######......',
		'....#oooo#......',
		'....#oooo#......',
		'...##oooo##.....',
		'..#oooooooo#....',
		'.#oooo#ooooo#...',
		'.#oooo#ooooo#...',
		'.#oooo#ooooo##..',
		'.#oooo####oo##..',
		'.#oooooooooo#...',
		'.#oooooooooo#...',
		'..#oooooooo#....',
		'...##oooo##.....',
		'....#oooo#......',
		'....#oooo#......',
		'....######......',
	];
	const data = new Uint8Array(68);
	art.forEach((row, y) => {
		let bits = 0;
		let mask = 0;
		for (let x = 0; x < 16; x++) {
			bits |= row[x] === '#' ? 0x8000 >> x : 0;
			mask |= row[x] !== '.' ? 0x8000 >> x : 0;
		}
		data.set([bits >> 8, bits & 0xff], 2 * y);
		data.set([mask >> 8, mask & 0xff], 32 + 2 * y);
	});
	data.set([0, 8, 0, 7], 64);
	return data;
}

/** File names on the Mac may contain characters that are awkward in URLs and on other file systems. */
function storageName(index: number, name: string): string {
	const safe = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-|-$/g, '');
	return `${String(index).padStart(2, '0')}-${safe}.bin`;
}

function main(outDir: string): void {
	const volumeDir = join(outDir, 'volume');
	mkdirSync(volumeDir, { recursive: true });
	const manifest: VolumeManifest = { name: 'Glider', files: [] };
	bundledFiles().forEach((f, i) => {
		const path = `volume/${storageName(i, f.name)}`;
		writeFileSync(join(outDir, path), writeMacBinary(f));
		manifest.files.push({ name: f.name, type: f.type, creator: f.creator, path, dataSize: f.data.length, rsrcSize: f.rsrc.length });
	});
	writeFileSync(join(outDir, 'volume.json'), JSON.stringify(manifest, null, '\t') + '\n');
	writeFileSync(join(outDir, 'System.rsrc'), writeResourceFork(systemFork()));
	const glider = bundledFiles().find((f) => f.type === 'APPL')!;
	writeFileSync(join(outDir, 'icon.png'), applicationIcon(glider));
	writeFileSync(join(outDir, 'card.png'), socialCard(glider));
	console.log(`Wrote ${manifest.files.length} files to ${volumeDir}`);
}

if (import.meta.main) {
	main(process.argv[2] ?? 'dist/data');
}
