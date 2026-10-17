// Port: the Mac's memory, as far as the port needs it.
//
// Pointers are addresses in a flat 32-bit address space, as on the Mac, so that code like
// `baseAddr := Pointer(kSecondaryAddr)` and `initsPointer^` works unchanged. The address space holds
// RAM (with the screen buffers of compact Macs at its top) and, on a Mac II, video memory.
// Only raw byte data lives here: pixel buffers, screens, and blocks from NewPtr. Toolbox records
// (ports, regions, handles) are JavaScript objects.

import { type OSErr, noErr } from './Types.ts';

export type Ptr = number;

export const memFullErr: OSErr = -108;
export const memWZErr: OSErr = -111;

interface Area {
	base: number;
	bytes: Uint8Array;
}

/** Mapped areas, sorted by base address. */
let areas: Area[] = [];

/** Makes `bytes` addressable at `base`. */
export function mapMemory(base: number, bytes: Uint8Array): void {
	areas = [...areas.filter((a) => a.base !== base), { base, bytes }].sort((a, b) => a.base - b.base);
}

/** Resets the address space, for tests and for starting a new machine. */
export function resetMemory(): void {
	areas = [];
	heap = undefined;
	memErr = noErr;
}

/** Finds the bytes behind an address range; throws for unmapped memory (a crash on a Mac). */
export function resolve(addr: Ptr, length = 1): { bytes: Uint8Array; offset: number } {
	const a = addr >>> 0;
	for (const area of areas) {
		const offset = a - area.base;
		if (offset >= 0 && offset + length <= area.bytes.length) {
			return { bytes: area.bytes, offset };
		}
	}
	throw new Error(`bus error: address $${a.toString(16).toUpperCase()} (length ${length}) is not mapped`);
}

export function peek8(addr: Ptr): number {
	const { bytes, offset } = resolve(addr);
	return bytes[offset]!;
}

export function poke8(addr: Ptr, v: number): void {
	const { bytes, offset } = resolve(addr);
	bytes[offset] = v;
}

/** A view of `length` bytes at `addr`. */
export function bytesAt(addr: Ptr, length: number): Uint8Array {
	const { bytes, offset } = resolve(addr, length);
	return bytes.subarray(offset, offset + length);
}

// The Memory Manager's nonrelocatable blocks: a first-fit allocator over one area of RAM.

interface Heap {
	start: number;
	end: number;
	/** Free extents, sorted by address. */
	free: { addr: number; size: number }[];
	/** Allocated blocks and their logical sizes. */
	used: Map<number, number>;
}

let heap: Heap | undefined;
let memErr: OSErr = noErr;

/** Sets up the application heap in the mapped range [start, end). */
export function initHeap(start: number, end: number): void {
	resolve(start, end - start);
	heap = { start, end, free: [{ addr: start, size: end - start }], used: new Map() };
}

export function MemError(): OSErr {
	return memErr;
}

export function NewPtr(byteCount: number): Ptr {
	if (heap === undefined) {
		throw new Error('NewPtr before initHeap');
	}
	const size = physicalSize(byteCount);
	const i = heap.free.findIndex((f) => f.size >= size);
	if (i < 0) {
		memErr = memFullErr;
		return 0;
	}
	const f = heap.free[i]!;
	const addr = f.addr;
	if (f.size === size) {
		heap.free.splice(i, 1);
	} else {
		heap.free[i] = { addr: f.addr + size, size: f.size - size };
	}
	heap.used.set(addr, byteCount);
	memErr = noErr;
	return addr;
}

/** Blocks take a multiple of 4 bytes. */
function physicalSize(byteCount: number): number {
	return Math.max(4, (byteCount + 3) & ~3);
}

export function NewPtrClear(byteCount: number): Ptr {
	const p = NewPtr(byteCount);
	if (p !== 0) {
		bytesAt(p, byteCount).fill(0);
	}
	return p;
}

export function DisposPtr(p: Ptr): void {
	const byteCount = heap?.used.get(p);
	if (heap === undefined || byteCount === undefined) {
		memErr = memWZErr;
		return;
	}
	const size = physicalSize(byteCount);
	heap.used.delete(p);
	heap.free.push({ addr: p, size });
	heap.free.sort((a, b) => a.addr - b.addr);
	// Coalesce neighbors.
	const merged: { addr: number; size: number }[] = [];
	for (const f of heap.free) {
		const last = merged.at(-1);
		if (last !== undefined && last.addr + last.size === f.addr) {
			last.size += f.size;
		} else {
			merged.push({ ...f });
		}
	}
	heap.free = merged;
	memErr = noErr;
}

export function GetPtrSize(p: Ptr): number {
	return heap?.used.get(p) ?? 0;
}
