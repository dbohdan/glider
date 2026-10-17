// Port: the File Manager (Inside Macintosh II, chapter 4), over the port's flat volume.
//
// The port has one volume with no folders; every volume or working directory reference number
// names it. Files are read and written in memory; the platform layer keeps changed files.

import { bytesAt, type Ptr } from './Memory.ts';
import type { MacFile } from './MacBinary.ts';
import { parseResourceFork, writeResourceFork } from './ResourceFork.ts';
import { openResourceFileNamed, openResourceFork } from './Resources.ts';
import { GetDateTime } from './OSUtils.ts';
import type { Volume } from './Volume.ts';
import { type Integer, type LongInt, type OSErr, type OSType, type Point, type Ref, noErr } from './Types.ts';

export const dirFulErr: OSErr = -33;
export const dskFulErr: OSErr = -34;
export const nsvErr: OSErr = -35;
export const ioErr: OSErr = -36;
export const bdNamErr: OSErr = -37;
export const fnOpnErr: OSErr = -38;
export const eofErr: OSErr = -39;
export const posErr: OSErr = -40;
export const tmfoErr: OSErr = -42;
export const fnfErr: OSErr = -43;
export const wPrErr: OSErr = -44;
export const fLckdErr: OSErr = -45;
export const vLckdErr: OSErr = -46;
export const fBsyErr: OSErr = -47;
export const dupFNErr: OSErr = -48;
export const opWrErr: OSErr = -49;
export const paramErr: OSErr = -50;
export const rfNumErr: OSErr = -51;
export const permErr: OSErr = -54;
export const wrPermErr: OSErr = -61;

/** Open permissions. */
export const fsCurPerm = 0;
export const fsRdPerm = 1;
export const fsWrPerm = 2;
export const fsRdWrPerm = 3;

/** Positioning modes. */
export const fsAtMark = 0;
export const fsFromStart = 1;
export const fsFromLEOF = 2;
export const fsFromMark = 3;

/** The reference number of the port's one volume. */
export const portVRefNum = -1;

/** Pascal `FInfo`: Finder information. */
export interface FInfo {
	fdType: OSType;
	fdCreator: OSType;
	fdFlags: Integer;
	fdLocation: Point;
	fdFldr: Integer;
}

export function newFInfo(): FInfo {
	return { fdType: '\0\0\0\0', fdCreator: '\0\0\0\0', fdFlags: 0, fdLocation: { v: 0, h: 0 }, fdFldr: 0 };
}

interface OpenFork {
	file: MacFile;
	rsrc: boolean;
	mark: number;
	perm: Integer;
}

let volume: Volume | null = null;
const open = new Map<Integer, OpenFork>();
let nextRefNum: Integer = 100;
let onChange: (file: MacFile, deleted: boolean) => void = () => {};

/** Port: mounts the volume, and the platform's hook that keeps files when they change or are deleted. */
export function mountVolume(v: Volume, changed: (file: MacFile, deleted: boolean) => void = () => {}): void {
	volume = v;
	onChange = changed;
	open.clear();
}

export function getVolume(): Volume | null {
	return volume;
}

function find(name: string): MacFile | undefined {
	return volume?.get(name);
}

function bytesOf(f: OpenFork): Uint8Array {
	return f.rsrc ? f.file.rsrc : f.file.data;
}

function setBytes(f: OpenFork, b: Uint8Array): void {
	if (f.rsrc) {
		f.file.rsrc = b;
	} else {
		f.file.data = b;
	}
	f.file.modified = GetDateTime() >>> 0;
	onChange(f.file, false);
}

function openFork(fileName: string, permission: Integer, refNum: Ref<Integer>, rsrc: boolean): OSErr {
	const file = find(fileName);
	if (file === undefined) {
		return fnfErr;
	}
	const writing = permission === fsCurPerm || (permission & fsWrPerm) !== 0;
	if (writing) {
		for (const f of open.values()) {
			if (f.file === file && f.rsrc === rsrc && (f.perm === fsCurPerm || (f.perm & fsWrPerm) !== 0)) {
				refNum.v = [...open.entries()].find(([, g]) => g === f)![0];
				return opWrErr;
			}
		}
	}
	const n = nextRefNum++;
	open.set(n, { file, rsrc, mark: 0, perm: permission });
	refNum.v = n;
	return noErr;
}

/** Pascal `FSOpen`: opens a file's data fork for reading and writing. */
export function FSOpen(fileName: string, _vRefNum: Integer, refNum: Ref<Integer>): OSErr {
	return openFork(fileName, fsCurPerm, refNum, false);
}

export function OpenRF(fileName: string, _vRefNum: Integer, refNum: Ref<Integer>): OSErr {
	return openFork(fileName, fsCurPerm, refNum, true);
}

export function FSClose(refNum: Integer): OSErr {
	return open.delete(refNum) ? noErr : rfNumErr;
}

/** The bytes a buffer argument names: a byte array, or memory at an address. */
function bufferOf(buffer: Uint8Array | Ptr, count: number): Uint8Array {
	return typeof buffer === 'number' ? bytesAt(buffer, count) : buffer;
}

/**
 * Pascal `FSRead(refNum, var count, buffPtr)`: reads up to `count` bytes at the mark into a byte
 * array (where Glider passes a record's address, the port passes the record's bytes) or memory.
 */
export function FSRead(refNum: Integer, count: Ref<LongInt>, buffer: Uint8Array | Ptr): OSErr {
	const f = open.get(refNum);
	if (f === undefined) {
		count.v = 0;
		return rfNumErr;
	}
	const bytes = bytesOf(f);
	const n = Math.max(0, Math.min(count.v, bytes.length - f.mark));
	bufferOf(buffer, n).set(bytes.subarray(f.mark, f.mark + n));
	f.mark += n;
	const err = n < count.v ? eofErr : noErr;
	count.v = n;
	return err;
}

export function FSWrite(refNum: Integer, count: Ref<LongInt>, buffer: Uint8Array | Ptr): OSErr {
	const f = open.get(refNum);
	if (f === undefined) {
		count.v = 0;
		return rfNumErr;
	}
	if (f.perm === fsRdPerm) {
		count.v = 0;
		return wrPermErr;
	}
	const src = bufferOf(buffer, count.v).subarray(0, count.v);
	const old = bytesOf(f);
	const end = f.mark + src.length;
	const bytes = end > old.length ? new Uint8Array(end) : old.slice();
	if (end > old.length) {
		bytes.set(old);
	}
	bytes.set(src, f.mark);
	setBytes(f, bytes);
	f.mark = end;
	return noErr;
}

export function GetFPos(refNum: Integer, filePos: Ref<LongInt>): OSErr {
	const f = open.get(refNum);
	if (f === undefined) {
		return rfNumErr;
	}
	filePos.v = f.mark;
	return noErr;
}

export function SetFPos(refNum: Integer, posMode: Integer, posOff: LongInt): OSErr {
	const f = open.get(refNum);
	if (f === undefined) {
		return rfNumErr;
	}
	const eof = bytesOf(f).length;
	const base = posMode === fsFromStart ? 0 : posMode === fsFromLEOF ? eof : f.mark;
	const pos = posMode === fsAtMark ? f.mark : base + posOff;
	if (pos < 0) {
		return posErr;
	}
	if (pos > eof) {
		f.mark = eof;
		return eofErr;
	}
	f.mark = pos;
	return noErr;
}

export function GetEOF(refNum: Integer, logEOF: Ref<LongInt>): OSErr {
	const f = open.get(refNum);
	if (f === undefined) {
		return rfNumErr;
	}
	logEOF.v = bytesOf(f).length;
	return noErr;
}

export function SetEOF(refNum: Integer, logEOF: LongInt): OSErr {
	const f = open.get(refNum);
	if (f === undefined) {
		return rfNumErr;
	}
	const old = bytesOf(f);
	const bytes = new Uint8Array(logEOF);
	bytes.set(old.subarray(0, logEOF));
	setBytes(f, bytes);
	f.mark = Math.min(f.mark, logEOF);
	return noErr;
}

export function Allocate(_refNum: Integer, _count: Ref<LongInt>): OSErr {
	return noErr;
}

/** Pascal `Create`: a new, empty file. */
export function Create(fileName: string, _vRefNum: Integer, creator: OSType, fileType: OSType): OSErr {
	if (volume === null) {
		return nsvErr;
	}
	if (fileName.length === 0 || fileName.length > 31 || fileName.includes(':')) {
		return bdNamErr;
	}
	if (find(fileName) !== undefined) {
		return dupFNErr;
	}
	const now = GetDateTime() >>> 0;
	const file: MacFile = { name: fileName, type: fileType, creator, finderFlags: 0, created: now, modified: now, data: new Uint8Array(0), rsrc: new Uint8Array(0) };
	volume.put(file);
	onChange(file, false);
	return noErr;
}

export function FSDelete(fileName: string, _vRefNum: Integer): OSErr {
	const file = find(fileName);
	if (file === undefined) {
		return fnfErr;
	}
	if ([...open.values()].some((f) => f.file === file)) {
		return fBsyErr;
	}
	volume!.delete(fileName);
	onChange(file, true);
	return noErr;
}

export function Rename(oldName: string, _vRefNum: Integer, newName: string): OSErr {
	const file = find(oldName);
	if (file === undefined) {
		return fnfErr;
	}
	if (find(newName) !== undefined && newName.toUpperCase() !== oldName.toUpperCase()) {
		return dupFNErr;
	}
	volume!.delete(oldName);
	onChange({ ...file }, true);
	file.name = newName;
	volume!.put(file);
	onChange(file, false);
	return noErr;
}

/** Pascal `GetFInfo(fileName, vRefNum, var fndrInfo)`. */
export function GetFInfo(fileName: string, _vRefNum: Integer, fndrInfo: FInfo): OSErr {
	const file = find(fileName);
	if (file === undefined) {
		return fnfErr;
	}
	fndrInfo.fdType = file.type;
	fndrInfo.fdCreator = file.creator;
	fndrInfo.fdFlags = file.finderFlags;
	fndrInfo.fdLocation = { v: 0, h: 0 };
	fndrInfo.fdFldr = 0;
	return noErr;
}

export function SetFInfo(fileName: string, _vRefNum: Integer, fndrInfo: FInfo): OSErr {
	const file = find(fileName);
	if (file === undefined) {
		return fnfErr;
	}
	file.type = fndrInfo.fdType;
	file.creator = fndrInfo.fdCreator;
	file.finderFlags = fndrInfo.fdFlags;
	onChange(file, false);
	return noErr;
}

/** Pascal `GetVol(volName, var vRefNum)`: the default volume (the only one). */
export function GetVol(volName: Ref<string> | null, vRefNum: Ref<Integer>): OSErr {
	if (volName !== null) {
		volName.v = volume?.name ?? '';
	}
	vRefNum.v = portVRefNum;
	return volume === null ? nsvErr : noErr;
}

export function SetVol(_volName: string | null, _vRefNum: Integer): OSErr {
	return volume === null ? nsvErr : noErr;
}

/** Pascal `FlushVol`: changed files are already handed to the platform as they change. */
export function FlushVol(_volName: string | null, _vRefNum: Integer): OSErr {
	return volume === null ? nsvErr : noErr;
}

/** Pascal `OpenResFile`: opens a file's resource fork; -1 if there is no such file or fork. */
export function OpenResFile(fileName: string): Integer {
	const already = openResourceFileNamed(fileName);
	if (already !== null) {
		return already;
	}
	const file = find(fileName);
	if (file === undefined || file.rsrc.length === 0) {
		return -1;
	}
	const fork = parseResourceFork(file.rsrc);
	return openResourceFork(fork, file.name, (f) => {
		file.rsrc = writeResourceFork(f);
		file.modified = GetDateTime() >>> 0;
		onChange(file, false);
	});
}
