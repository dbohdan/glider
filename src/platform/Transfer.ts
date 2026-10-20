// Port: the files the player brings to the port and takes away (the desktop's Import Files… and
// Export Files…, PORT.md decision 16). What comes in may be MacBinary files, AppleSingle files,
// StuffIt and Compact Pro archives, disk images, ZIP archives (a macOS ZIP keeps each file's
// resource fork and Finder information in an AppleDouble file under __MACOSX), or a bare house or
// saved game, known by its size; from an archive, only what Glider uses is taken. What goes out is a ZIP
// archive of MacBinary files, which Import Files… reads back.

import { gameRec } from '../glider/FileInNOut.ts';
import { houseRecLayout } from '../glider/Globals.ts';
import { isMacBinary, type MacFile, parseAppleDouble, parseMacBinary, writeMacBinary } from '../mac/MacBinary.ts';
import { encodeMacRoman } from '../mac/MacRoman.ts';
import { sizeOf } from '../mac/PascalLayout.ts';
import { type ArchiveContents, ArchiveError } from './Archive.ts';
import { isCompactPro, readCompactPro } from './CompactPro.ts';
import { isDiskImage, readDiskImage } from './DiskImage.ts';
import { isStuffIt, readStuffIt } from './StuffIt.ts';
import { isZip, writeZip, zipMembers } from './Zip.ts';

/** Inflates a deflated ZIP member. */
export type Inflate = (raw: Uint8Array) => Promise<Uint8Array>;

/** A file the player chose: its name on their computer, and its bytes. */
export interface Upload {
	name: string;
	bytes: Uint8Array;
}

export interface Imported {
	files: MacFile[];
	/** The names of what could not be read as a Mac file. */
	rejected: string[];
}

/** A name the Mac can have: no colons, at most 31 characters. */
function macName(name: string): string {
	let n = name.replace(/:/g, '-');
	while (encodeMacRoman(n).length > 31) {
		n = n.slice(0, -1);
	}
	return n;
}

function baseName(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

const isAppleDouble = (b: Uint8Array) => b.length >= 4 && b[0] === 0 && b[1] === 0x05 && b[2] === 0x16 && (b[3] === 0x07 || b[3] === 0x00);

/**
 * A Mac file from a file's name and bytes, and the AppleDouble file that came with it, if any; null
 * if it is none. A bare file is a house or a saved game if it is the size of one, as Glider writes
 * them (data forks of a house record or a game record, and no resource fork).
 */
function macFile(name: string, bytes: Uint8Array, appleDouble: Uint8Array | null): MacFile | null {
	if (appleDouble !== null && isAppleDouble(appleDouble)) {
		return { ...parseAppleDouble(appleDouble, macName(name)), data: bytes.slice() };
	}
	if (isMacBinary(bytes)) {
		const f = parseMacBinary(bytes);
		return { ...f, name: macName(f.name) };
	}
	if (isAppleDouble(bytes) && bytes[3] === 0x00) {
		return parseAppleDouble(bytes, macName(name.replace(/\.as$/i, '')));
	}
	const blank = { name: macName(name), finderFlags: 0, created: 0, modified: 0, data: bytes.slice(), rsrc: new Uint8Array(0) };
	if (bytes.length === sizeOf(houseRecLayout)) {
		return { ...blank, type: 'GLhs', creator: 'GLed' };
	}
	if (bytes.length === sizeOf(gameRec)) {
		return { ...blank, type: 'GLgm', creator: 'GLID' };
	}
	return null;
}

/**
 * Whether Glider uses a file: houses, their art, saved games, and Glider itself (whose preferences
 * the store keeps). Archives often hold read-me files and the like, which are left out.
 */
function usedByGlider(f: MacFile): boolean {
	return f.type === 'GLhs' || f.type === 'GLbk' || f.type === 'GLgm' || (f.type === 'APPL' && f.creator === 'GLID');
}

/** The Mac's own archives and disk images, each read to the files in it. */
const macArchives: [is: (b: Uint8Array) => boolean, read: (b: Uint8Array) => ArchiveContents][] = [
	[isStuffIt, readStuffIt],
	[isCompactPro, readCompactPro],
	[isDiskImage, readDiskImage],
];

const macArchive = (b: Uint8Array) => macArchives.find(([is]) => is(b))?.[1] ?? null;

/** Reads what the player chose to import. */
export async function readUploads(uploads: Upload[], inflate: Inflate): Promise<Imported> {
	const out: Imported = { files: [], rejected: [] };
	/** A Mac file: an archive's contents if its data fork is an archive (.sit.bin, a .sea, a .img), else the file. */
	const takeMac = (f: MacFile, fromArchive: boolean): void => {
		const read = usedByGlider(f) ? null : macArchive(f.data);
		if (read === null) {
			if (!fromArchive || usedByGlider(f)) {
				out.files.push(f);
			}
			return;
		}
		let contents: ArchiveContents;
		try {
			contents = read(f.data);
		} catch (e) {
			if (!(e instanceof ArchiveError)) {
				throw e;
			}
			out.rejected.push(f.name);
			return;
		}
		const { files, failed } = contents;
		for (const m of files) {
			takeMac({ ...m, name: macName(m.name) }, true);
		}
		for (const m of failed) {
			if (usedByGlider({ name: m.name, type: m.type, creator: m.creator, finderFlags: 0, created: 0, modified: 0, data: new Uint8Array(0), rsrc: new Uint8Array(0) })) {
				out.rejected.push(m.name);
			}
		}
	};
	const take = async (name: string, bytes: Uint8Array, companion: Uint8Array | null, fromArchive: boolean): Promise<void> => {
		if (isZip(bytes)) {
			await takeZip(bytes);
			return;
		}
		const f = macArchive(bytes) !== null ? { name: macName(name), type: '????', creator: '????', finderFlags: 0, created: 0, modified: 0, data: bytes, rsrc: new Uint8Array(0) } : macFile(name, bytes, companion);
		if (f === null) {
			if (!fromArchive) {
				out.rejected.push(name);
			}
		} else {
			takeMac(f, fromArchive);
		}
	};
	const takeZip = async (zip: Uint8Array): Promise<void> => {
		const members = zipMembers(zip).filter((m) => !m.name.endsWith('/'));
		const contents = new Map<string, Uint8Array>();
		for (const m of members) {
			contents.set(m.name, m.method === 0 ? m.raw.slice() : await inflate(m.raw));
		}
		// AppleDouble companions, by the path of the file they belong to.
		const companions = new Map<string, Uint8Array>();
		for (const [path, bytes] of contents) {
			const dir = path.slice(0, path.lastIndexOf('/') + 1);
			const base = baseName(path);
			if (base.startsWith('._')) {
				companions.set(dir.replace(/^__MACOSX\//, '') + base.slice(2), bytes);
			}
		}
		for (const [path, bytes] of contents) {
			if (path.startsWith('__MACOSX/') || baseName(path).startsWith('._')) {
				continue;
			}
			await take(baseName(path), bytes, companions.get(path) ?? null, true);
		}
	};
	for (const u of uploads) {
		await take(u.name, u.bytes, null, false);
	}
	return out;
}

/** The player's files as a ZIP archive of MacBinary files. */
export function exportArchive(files: MacFile[], when: Date): Uint8Array {
	return writeZip(
		files.map((f) => ({ name: `${f.name.replace(/[/\\]/g, '-')}.bin`, data: writeMacBinary(f) })),
		when,
	);
}
