// Port: Mac disk images (the desktop's Import Files…), as Casady & Greene's More Glider floppy
// survives: DiskCopy 4.2 images and bare HFS volumes (.dsk, .img). The volume's files are read from
// its catalog, a B-tree whose leaves hold every folder and file, with each fork's first three
// extents and the rest in the extents B-tree (Inside Macintosh: Files, "Data Organization on
// Volumes"). Checked against hfsutils (test/platform/diskimage.test.ts).

import { decodeMacRoman } from '../mac/MacRoman.ts';
import { type ArchiveContents, fail, fourCC, member, u16, u32 } from './Archive.ts';

/** HFS's signature, "BD", at the start of the master directory block. */
const hfsSignature = 0x4244;

/** Whether an HFS volume starts here: its signature, and allocation blocks that fit in the bytes. */
function isHFS(b: Uint8Array, at: number): boolean {
	const mdb = at + 1024;
	if (b.length < mdb + 162 || u16(b, mdb) !== hfsSignature) {
		return false;
	}
	const blockSize = u32(b, mdb + 20);
	return blockSize > 0 && blockSize % 512 === 0 && at + u16(b, mdb + 28) * 512 + u16(b, mdb + 18) * blockSize <= b.length;
}

/** Where the volume starts in the image: after a DiskCopy 4.2 header, or at once; -1 if it is no HFS volume. */
function volumeStart(b: Uint8Array): number {
	// DiskCopy 4.2: a name of up to 63 characters, sizes and checksums, and 0x0100 at 82; the disk follows.
	if (b.length >= 84 && b[0]! <= 63 && u16(b, 82) === 0x0100 && 84 + u32(b, 64) <= b.length && isHFS(b, 84)) {
		return 84;
	}
	return isHFS(b, 0) ? 0 : -1;
}

/** Whether bytes are an image of an HFS disk. */
export function isDiskImage(b: Uint8Array): boolean {
	return volumeStart(b) >= 0;
}

type Extent = [start: number, count: number];

function extents(b: Uint8Array, at: number): Extent[] {
	return [0, 1, 2].map((k) => [u16(b, at + k * 4), u16(b, at + k * 4 + 2)] as Extent).filter(([, n]) => n > 0);
}

/** The files on an HFS disk image, without its folders. */
export function readDiskImage(b: Uint8Array): ArchiveContents {
	const out: ArchiveContents = { files: [], failed: [] };
	const vol = volumeStart(b);
	if (vol < 0) {
		fail('not an HFS disk image');
	}
	const mdb = vol + 1024;
	const blockSize = u32(b, mdb + 20);
	const firstBlock = vol + u16(b, mdb + 28) * 512;

	/** A fork's bytes from its extents, `length` of them. */
	const fork = (ext: Extent[], length: number): Uint8Array => {
		const data = new Uint8Array(length);
		let n = 0;
		for (const [start, count] of ext) {
			if (n >= length) {
				break;
			}
			const from = firstBlock + start * blockSize;
			const take = Math.min(count * blockSize, length - n);
			if (from + take > b.length) {
				fail('a fork lies outside the disk');
			}
			data.set(b.subarray(from, from + take), n);
			n += take;
		}
		if (n < length) {
			fail('a fork is missing extents');
		}
		return data;
	};

	/** A B-tree's leaf records, in order: each node is 512 bytes, its records' offsets at its end. */
	const leaves = (tree: Uint8Array): Uint8Array[] => {
		const records: Uint8Array[] = [];
		const nodeSize = u16(tree, 14 + 18);
		let node = u32(tree, 14 + 10);
		const seen = new Set<number>();
		while (node !== 0) {
			if (seen.has(node) || (node + 1) * nodeSize > tree.length) {
				fail('bad B-tree');
			}
			seen.add(node);
			const n = tree.subarray(node * nodeSize, (node + 1) * nodeSize);
			for (let i = 0; i < u16(n, 10); i++) {
				const at = u16(n, nodeSize - 2 * (i + 1));
				const end = u16(n, nodeSize - 2 * (i + 2));
				records.push(n.subarray(at, end));
			}
			node = u32(n, 0);
		}
		return records;
	};

	// The extents B-tree, for forks of more than three extents, by file number and fork (0 data, 0xff resource).
	const overflow = new Map<string, Extent[]>();
	for (const r of leaves(fork(extents(b, mdb + 134), u32(b, mdb + 130)))) {
		const key = `${u32(r, 2)} ${r[1]}`;
		overflow.set(key, [...(overflow.get(key) ?? []), ...extents(r, 1 + r[0]!)]);
	}

	// The catalog (file number 4) may have more extents too, on a volume of many files.
	for (const r of leaves(fork([...extents(b, mdb + 150), ...(overflow.get('4 0') ?? [])], u32(b, mdb + 146)))) {
		// A key (its length, a reserved byte, the parent folder, the name), then the record on an even offset.
		const name = decodeMacRoman(r.subarray(7, 7 + r[6]!));
		const d = r.subarray((1 + r[0]! + 1) & ~1);
		if (d[0] !== 2) {
			continue; // folders and threads
		}
		const id = u32(d, 20);
		const forkOf = (first: number, length: number, kind: number) => fork([...extents(d, first), ...(overflow.get(`${id} ${kind}`) ?? [])], length);
		member(name, fourCC(d, 4), fourCC(d, 8), u16(d, 12), u32(d, 44), u32(d, 48), () => forkOf(74, u32(d, 26), 0), () => forkOf(86, u32(d, 36), 0xff), out);
	}
	return out;
}
