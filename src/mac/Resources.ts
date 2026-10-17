// Port: the Resource Manager (Inside Macintosh I, chapter 5), over resource forks held in memory.
//
// Open resource files form a chain searched from the current file back to the System file.
// A resource Handle is a Handle object holding the resource's bytes.

import { type Resource, ResourceFork } from './ResourceFork.ts';
import { type Integer, type OSErr, type OSType, noErr } from './Types.ts';

/** A relocatable block: Pascal `h^^` is `h.data`. */
export class Handle {
	data: Uint8Array;
	constructor(data: Uint8Array) {
		this.data = data;
	}
}

export const resNotFound: OSErr = -192;
export const resFNotFound: OSErr = -193;

interface OpenFile {
	refNum: Integer;
	fork: ResourceFork;
	name: string;
	/** Handles given out for this file's resources, so the same resource gives the same handle. */
	handles: Map<Resource, Handle>;
}

/** Open files, most recently opened last. The System file is first. */
let chain: OpenFile[] = [];
let current: Integer = 0;
let resErr: OSErr = noErr;
let nextRefNum: Integer = 2;

/** Port: resets the Resource Manager with a System file, as at startup. */
export function initResources(system: ResourceFork, name = 'System'): void {
	chain = [{ refNum: 2, fork: system, name, handles: new Map() }];
	current = 2;
	nextRefNum = 3;
	resErr = noErr;
}

/** Port: opens a resource fork that is already in memory; returns its reference number. */
export function openResourceFork(fork: ResourceFork, name: string): Integer {
	const existing = chain.find((f) => f.fork === fork);
	if (existing !== undefined) {
		current = existing.refNum;
		return existing.refNum;
	}
	const refNum = nextRefNum++;
	chain.push({ refNum, fork, name, handles: new Map() });
	current = refNum;
	resErr = noErr;
	return refNum;
}

export function ResError(): OSErr {
	return resErr;
}

export function CurResFile(): Integer {
	return current;
}

export function UseResFile(refNum: Integer): void {
	if (chain.some((f) => f.refNum === refNum)) {
		current = refNum;
		resErr = noErr;
	} else {
		resErr = resFNotFound;
	}
}

export function CloseResFile(refNum: Integer): void {
	const i = chain.findIndex((f) => f.refNum === refNum);
	if (i <= 0) {
		return;
	}
	chain.splice(i, 1);
	if (!chain.some((f) => f.refNum === current)) {
		current = chain.at(-1)!.refNum;
	}
}

/** The files searched for a resource, from the current file back to the System file. */
function searchOrder(): OpenFile[] {
	const i = chain.findIndex((f) => f.refNum === current);
	return chain.slice(0, i + 1).reverse();
}

function handleFor(file: OpenFile, res: Resource): Handle {
	let h = file.handles.get(res);
	if (h === undefined) {
		h = new Handle(res.data);
		file.handles.set(res, h);
	}
	return h;
}

function find(files: OpenFile[], match: (r: Resource) => boolean): Handle | null {
	for (const file of files) {
		const res = file.fork.resources.find(match);
		if (res !== undefined) {
			resErr = noErr;
			return handleFor(file, res);
		}
	}
	resErr = resNotFound;
	return null;
}

export function GetResource(type: OSType, id: Integer): Handle | null {
	return find(searchOrder(), (r) => r.type === type && r.id === id);
}

export function Get1Resource(type: OSType, id: Integer): Handle | null {
	return find(searchOrder().slice(0, 1), (r) => r.type === type && r.id === id);
}

export function GetNamedResource(type: OSType, name: string): Handle | null {
	return find(searchOrder(), (r) => r.type === type && r.name !== null && r.name.toLowerCase() === name.toLowerCase());
}

/** Port: the resource behind a handle, for calls that read or change its information. */
function resourceOf(h: Handle): { file: OpenFile; res: Resource } | null {
	for (const file of chain) {
		for (const [res, handle] of file.handles) {
			if (handle === h) {
				return { file, res };
			}
		}
	}
	return null;
}

export function ReleaseResource(h: Handle | null): void {
	if (h === null) {
		return;
	}
	const found = resourceOf(h);
	found?.file.handles.delete(found.res);
}

/** Pascal `GetResInfo(theResource, theID, theType, name)`. */
export function GetResInfo(h: Handle): { id: Integer; type: OSType; name: string } | null {
	const found = resourceOf(h);
	resErr = found === null ? resNotFound : noErr;
	return found === null ? null : { id: found.res.id, type: found.res.type, name: found.res.name ?? '' };
}

export function SetResInfo(h: Handle, id: Integer, name: string): void {
	const found = resourceOf(h);
	if (found === null) {
		resErr = resNotFound;
		return;
	}
	found.res.id = id;
	found.res.name = name;
	resErr = noErr;
}

export function ChangedResource(h: Handle): void {
	const found = resourceOf(h);
	resErr = found === null ? resNotFound : noErr;
}

/** Writes a changed resource's data back to its file. */
export function WriteResource(h: Handle): void {
	const found = resourceOf(h);
	if (found === null) {
		resErr = resNotFound;
		return;
	}
	found.res.data = h.data;
	resErr = noErr;
}

export function CountResources(type: OSType): Integer {
	return searchOrder().reduce((n, f) => n + f.fork.ofType(type).length, 0);
}
