// Builds the bundled Mac volume: the files Glider finds next to itself, packed as MacBinary,
// plus a manifest. Usage: node tools/build-resources.ts <output directory>

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMacBinary, writeMacBinary, type MacFile } from '../src/mac/MacBinary.ts';
import { writeResourceFork } from '../src/mac/ResourceFork.ts';
import type { VolumeManifest } from '../src/mac/Volume.ts';
import { parseDeRez } from './DeRez.ts';

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
	console.log(`Wrote ${manifest.files.length} files to ${volumeDir}`);
}

if (import.meta.main) {
	main(process.argv[2] ?? 'dist/data');
}
