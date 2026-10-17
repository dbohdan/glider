// Reading and writing resource forks in the format of Inside Macintosh: More Macintosh Toolbox, 1-121.

import { ByteWriter, copyBytes, fourCCAt, s16, u16, u32, u8 } from './Binary.ts';
import { decodeMacRoman, encodeMacRoman } from './MacRoman.ts';
import type { Integer, OSType } from './Types.ts';

/** Resource attribute bits. */
export const resSysHeap = 0x40;
export const resPurgeable = 0x20;
export const resLocked = 0x10;
export const resProtected = 0x08;
export const resPreload = 0x04;
export const resChanged = 0x02;

export interface Resource {
	type: OSType;
	id: Integer;
	name: string | null;
	attrs: number;
	data: Uint8Array;
}

/** The resources of one resource fork, in the order they appear in its map. */
export class ResourceFork {
	resources: Resource[] = [];
	/** Resource map attributes (mapReadOnly, mapCompact, mapChanged). */
	mapAttrs = 0;

	get(type: OSType, id: Integer): Resource | undefined {
		return this.resources.find((r) => r.type === type && r.id === id);
	}

	getNamed(type: OSType, name: string): Resource | undefined {
		return this.resources.find((r) => r.type === type && r.name === name);
	}

	ofType(type: OSType): Resource[] {
		return this.resources.filter((r) => r.type === type);
	}

	types(): OSType[] {
		return [...new Set(this.resources.map((r) => r.type))];
	}

	/** Adds a resource or replaces the one with the same type and ID. */
	put(res: Resource): void {
		const i = this.resources.findIndex((r) => r.type === res.type && r.id === res.id);
		if (i >= 0) {
			this.resources[i] = res;
		} else {
			this.resources.push(res);
		}
	}

	remove(type: OSType, id: Integer): void {
		this.resources = this.resources.filter((r) => !(r.type === type && r.id === id));
	}
}

export function parseResourceFork(fork: Uint8Array): ResourceFork {
	const out = new ResourceFork();
	if (fork.length === 0) {
		return out;
	}
	const dataOffset = u32(fork, 0);
	const mapOffset = u32(fork, 4);
	const map = fork.subarray(mapOffset);
	out.mapAttrs = u16(map, 22);
	const typeListOffset = u16(map, 24);
	const nameListOffset = u16(map, 26);
	const typeList = map.subarray(typeListOffset);
	const nTypes = s16(typeList, 0) + 1;
	for (let t = 0; t < nTypes; t++) {
		const entry = 2 + t * 8;
		const type = fourCCAt(typeList, entry);
		const count = s16(typeList, entry + 4) + 1;
		const refListOffset = u16(typeList, entry + 6);
		for (let k = 0; k < count; k++) {
			const ref = refListOffset + k * 12;
			const id = s16(typeList, ref);
			const nameOffset = u16(typeList, ref + 2);
			const attrs = u8(typeList, ref + 4);
			const offset = (u8(typeList, ref + 5) << 16) | u16(typeList, ref + 6);
			let name: string | null = null;
			if (nameOffset !== 0xffff) {
				const at = nameListOffset + nameOffset;
				name = decodeMacRoman(map.subarray(at + 1, at + 1 + u8(map, at)));
			}
			const start = dataOffset + offset;
			const length = u32(fork, start);
			out.resources.push({ type, id, name, attrs, data: copyBytes(fork, start + 4, start + 4 + length) });
		}
	}
	return out;
}

export function writeResourceFork(rf: ResourceFork): Uint8Array {
	const dataOffset = 256;
	const data = new ByteWriter();
	const offsets = new Map<Resource, number>();
	for (const r of rf.resources) {
		offsets.set(r, data.length);
		data.u32(r.data.length).bytes(r.data);
	}
	const types = rf.types();
	const names = new ByteWriter();
	const nameOffsets = new Map<Resource, number>();
	for (const r of rf.resources) {
		if (r.name !== null) {
			nameOffsets.set(r, names.length);
			const enc = encodeMacRoman(r.name).subarray(0, 255);
			names.u8(enc.length).bytes(enc);
		}
	}
	const typeListOffset = 28;
	const typeListSize = 2 + types.length * 8;
	const refs = new ByteWriter();
	const typeEntries = new ByteWriter();
	typeEntries.u16((types.length - 1) & 0xffff);
	for (const type of types) {
		const ofType = rf.ofType(type);
		typeEntries.fourCC(type).u16(ofType.length - 1).u16(typeListSize + refs.length);
		for (const r of ofType) {
			const off = offsets.get(r)!;
			refs.u16(r.id & 0xffff)
				.u16(nameOffsets.get(r) ?? 0xffff)
				.u8(r.attrs)
				.u8((off >>> 16) & 0xff)
				.u16(off & 0xffff)
				.u32(0);
		}
	}
	const nameListOffset = typeListOffset + typeListSize + refs.length;
	const mapLength = nameListOffset + names.length;
	const mapOffset = dataOffset + data.length;
	const out = new ByteWriter();
	out.u32(dataOffset).u32(mapOffset).u32(data.length).u32(mapLength);
	out.zeros(dataOffset - out.length);
	out.bytes(data.toBytes());
	out.u32(dataOffset).u32(mapOffset).u32(data.length).u32(mapLength);
	out.u32(0).u16(0).u16(rf.mapAttrs).u16(typeListOffset).u16(nameListOffset);
	out.bytes(typeEntries.toBytes()).bytes(refs.toBytes()).bytes(names.toBytes());
	return out.toBytes();
}
