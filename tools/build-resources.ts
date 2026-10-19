// Builds the bundled Mac volume: the files Glider finds next to itself, packed as MacBinary,
// plus a manifest. Usage: node tools/build-resources.ts <output directory>

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMacBinary, writeMacBinary, type MacFile } from '../src/mac/MacBinary.ts';
import { ResourceFork, writeResourceFork } from '../src/mac/ResourceFork.ts';
import { bdfToFontResource, readBdf } from './Bdf.ts';
import type { VolumeManifest } from '../src/mac/Volume.ts';
import { parseDeRez } from './DeRez.ts';
import { applicationIcon } from './Favicon.ts';

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
	return files;
}

/**
 * The port's System file: what Glider uses of the System's resources, made by the port. The system
 * font is Ozma (Chicago 12's glyphs); the desktop pattern is 50% gray.
 */
export function systemFork(): ResourceFork {
	const rf = new ResourceFork();
	const ozma = bdfToFontResource(readBdf(readFileSync(join(root, 'assets/fonts/Ozma-12.bdf'), 'latin1')));
	rf.put({ type: 'FONT', id: 0, name: 'Chicago', attrs: 0, data: new Uint8Array(0) });
	rf.put({ type: 'FONT', id: 12, name: null, attrs: 0, data: ozma });
	const gray = [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55];
	rf.put({ type: 'PAT ', id: 16, name: null, attrs: 0, data: new Uint8Array(gray) });
	// The scroll bars' track (CDEF 1): System 6.0.8's PAT 17.
	rf.put({ type: 'PAT ', id: 17, name: null, attrs: 0, data: new Uint8Array([0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22]) });
	// A pixel pattern of type 0 is drawn as its one-bit pattern.
	const ppat = new Uint8Array(28);
	ppat.set(gray, 20);
	rf.put({ type: 'ppat', id: 16, name: null, attrs: 0, data: ppat });
	return rf;
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
	writeFileSync(join(outDir, 'icon.png'), applicationIcon(bundledFiles().find((f) => f.type === 'APPL')!));
	console.log(`Wrote ${manifest.files.length} files to ${volumeDir}`);
}

if (import.meta.main) {
	main(process.argv[2] ?? 'dist/data');
}
