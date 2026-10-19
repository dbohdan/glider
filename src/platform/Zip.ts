// Port: a minimal ZIP reader and writer, for the files the player imports and exports (and the
// archives the oracle fetches). Members are stored or deflated; the caller inflates, with
// node:zlib or the browser's DecompressionStream.

export interface ZipEntry {
	name: string;
	data: Uint8Array;
}

/** A member as the archive holds it: its name, compression method (0 stored, 8 deflated), and bytes. */
export interface ZipMember {
	name: string;
	method: number;
	raw: Uint8Array;
}

function u16le(b: Uint8Array, o: number): number {
	return b[o]! | (b[o + 1]! << 8);
}

function u32le(b: Uint8Array, o: number): number {
	return (u16le(b, o) | (u16le(b, o + 2) << 16)) >>> 0;
}

/** Whether bytes begin as a ZIP archive does. */
export function isZip(b: Uint8Array): boolean {
	return b.length >= 22 && u32le(b, 0) === 0x04034b50;
}

/** The members of a ZIP archive, by its central directory. */
export function zipMembers(b: Uint8Array): ZipMember[] {
	let eocd = -1;
	for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
		if (u32le(b, i) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) {
		throw new Error('not a ZIP archive');
	}
	const count = u16le(b, eocd + 10);
	let p = u32le(b, eocd + 16);
	const out: ZipMember[] = [];
	const utf8 = new TextDecoder();
	for (let k = 0; k < count; k++) {
		if (u32le(b, p) !== 0x02014b50) {
			throw new Error('bad ZIP central directory');
		}
		const method = u16le(b, p + 10);
		const compSize = u32le(b, p + 20);
		const nameLen = u16le(b, p + 28);
		const extraLen = u16le(b, p + 30);
		const commentLen = u16le(b, p + 32);
		const local = u32le(b, p + 42);
		const name = utf8.decode(b.subarray(p + 46, p + 46 + nameLen));
		const start = local + 30 + u16le(b, local + 26) + u16le(b, local + 28);
		out.push({ name, method, raw: b.subarray(start, start + compSize) });
		p += 46 + nameLen + extraLen + commentLen;
	}
	return out;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

export function crc32(b: Uint8Array): number {
	let c = 0xffffffff;
	for (const byte of b) {
		c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

/** A ZIP archive of stored members, with UTF-8 names and the given time (a JavaScript Date). */
export function writeZip(entries: ZipEntry[], when: Date): Uint8Array {
	const utf8 = new TextEncoder();
	const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
	const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
	const local: number[] = [];
	const central: number[] = [];
	const w16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff);
	const w32 = (a: number[], v: number) => {
		w16(a, v & 0xffff);
		w16(a, (v >>> 16) & 0xffff);
	};
	for (const e of entries) {
		const name = utf8.encode(e.name);
		const crc = crc32(e.data);
		const offset = local.length;
		w32(local, 0x04034b50);
		for (const v of [20, 0x0800, 0, time, date]) {
			w16(local, v);
		}
		w32(local, crc);
		w32(local, e.data.length);
		w32(local, e.data.length);
		w16(local, name.length);
		w16(local, 0);
		local.push(...name);
		for (const byte of e.data) {
			local.push(byte);
		}
		w32(central, 0x02014b50);
		for (const v of [20, 20, 0x0800, 0, time, date]) {
			w16(central, v);
		}
		w32(central, crc);
		w32(central, e.data.length);
		w32(central, e.data.length);
		for (const v of [name.length, 0, 0, 0, 0]) {
			w16(central, v);
		}
		w32(central, 0);
		w32(central, offset);
		central.push(...name);
	}
	const end: number[] = [];
	w32(end, 0x06054b50);
	for (const v of [0, 0, entries.length, entries.length]) {
		w16(end, v);
	}
	w32(end, central.length);
	w32(end, local.length);
	w16(end, 0);
	return new Uint8Array([...local, ...central, ...end]);
}
