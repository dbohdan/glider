// Port: the Standard File Package (Inside Macintosh I, chapter 20). Choosing a file to open or a
// name to save under is the browser page's job (the port's settled decision: the operating
// system's file browsing is replaced by the browser's equivalent). The program's filter and dialog
// hook still run: the filter chooses the files offered, and the hook's first call, which may set
// the dialog's texts, gives the page its title.

import { DialogRecord, DisposDialog, GetIText, newDialog, statText } from './Dialogs.ts';
import { type FInfo, getVolume, portVRefNum } from './Files.ts';
import type { MacFile } from './MacBinary.ts';
import { GetResource, type Handle } from './Resources.ts';
import { s16 } from './Binary.ts';
import { activateAfterModalDialog, dBoxProc } from './Windows.ts';
import type { Integer, OSType, Point } from './Types.ts';

/** Pascal `SFReply`. */
export interface SFReply {
	good: boolean;
	copy: boolean;
	fType: OSType;
	vRefNum: Integer;
	version: Integer;
	fName: string;
}

export function newSFReply(): SFReply {
	return { good: false, copy: false, fType: '\0\0\0\0', vRefNum: 0, version: 0, fName: '' };
}

/** Pascal `SFTypeList`: up to four file types. */
export type SFTypeList = OSType[];

/** What a file filter is given (Pascal `ParmBlkPtr` to a file's parameter block). */
export interface FileParam {
	ioNamePtr: string;
	ioVRefNum: Integer;
	ioFlFndrInfo: FInfo;
	ioFlLgLen: number;
	ioFlRLgLen: number;
	ioFlCrDat: number;
	ioFlMdDat: number;
}

/** A file filter: true to hide the file. */
export type FileFilterProc = (p: FileParam) => boolean;
/** A dialog hook: called with -1 (first time) and with items hit; returns the item to act on. */
export type DlgHookProc = (item: Integer, theDialog: DialogRecord) => Integer | Promise<Integer>;

/** The first call to a dialog hook. */
export const sfHookFirstCall = -1;

/** What the page shows to choose a file: its title and the files, by name. */
export interface GetFileRequest {
	title: string;
	files: MacFile[];
	where: Point;
}

export interface PutFileRequest {
	prompt: string;
	defaultName: string;
	where: Point;
}

/** Port: the browser page's file choosers; each resolves to a file name, or null for Cancel. */
export interface StandardFileHost {
	getFile(request: GetFileRequest): Promise<string | null>;
	putFile(request: PutFileRequest): Promise<string | null>;
}

let host: StandardFileHost = {
	getFile: () => Promise.resolve(null),
	putFile: () => Promise.resolve(null),
};

export function setStandardFileHost(h: StandardFileHost): void {
	host = h;
}

function fileParam(f: MacFile): FileParam {
	return {
		ioNamePtr: f.name,
		ioVRefNum: portVRefNum,
		ioFlFndrInfo: { fdType: f.type, fdCreator: f.creator, fdFlags: f.finderFlags, fdLocation: { v: 0, h: 0 }, fdFldr: 0 },
		ioFlLgLen: f.data.length,
		ioFlRLgLen: f.rsrc.length,
		ioFlCrDat: f.created,
		ioFlMdDat: f.modified,
	};
}

/**
 * Runs a dialog hook's first call on a dialog made (but never shown) from the custom item list,
 * and returns the texts of its static text items, joined: the title the program gave it.
 */
async function hookTitle(dlgHook: DlgHookProc | null, dlgID: Integer): Promise<string> {
	const dlog = GetResource('DLOG', dlgID);
	const ditl = dlog === null ? null : GetResource('DITL', s16(dlog.data, 18));
	if (dlog === null || ditl === null) {
		return '';
	}
	const d = newDialog(false, { top: 0, left: 0, bottom: 1, right: 1 }, '', false, dBoxProc, null, false, 0, ditl.data);
	const before = d.items.map((it) => ((it.type & 0x7f) === statText ? GetIText(it.handle as Handle) : ''));
	await dlgHook?.(sfHookFirstCall, d);
	const texts = d.items.map((it) => ((it.type & 0x7f) === statText ? GetIText(it.handle as Handle) : '')).filter((t, i) => t !== '' && t !== before[i]);
	DisposDialog(d);
	return texts.join(' ');
}

/** Pascal `SFPGetFile`: asks for a file of one of the types (all if numTypes is -1) that the filter keeps. */
export async function SFPGetFile(
	where: Point,
	_prompt: string,
	fileFilter: FileFilterProc | null,
	numTypes: Integer,
	typeList: SFTypeList,
	dlgHook: DlgHookProc | null,
	reply: SFReply,
	dlgID: Integer,
	_filterProc: unknown,
): Promise<void> {
	const files = (getVolume()?.list() ?? [])
		.filter((f) => numTypes < 0 || typeList.slice(0, numTypes).includes(f.type))
		.filter((f) => fileFilter === null || !fileFilter(fileParam(f)))
		.sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1));
	const name = await host.getFile({ title: await hookTitle(dlgHook, dlgID), files, where });
	activateAfterModalDialog();
	const file = name === null ? undefined : getVolume()?.get(name);
	Object.assign(reply, newSFReply());
	if (file !== undefined) {
		reply.good = true;
		reply.fType = file.type;
		reply.vRefNum = portVRefNum;
		reply.fName = file.name;
	}
}

/** Pascal `SFGetFile`, with the standard dialog (-4000). */
export function SFGetFile(where: Point, prompt: string, fileFilter: FileFilterProc | null, numTypes: Integer, typeList: SFTypeList, dlgHook: DlgHookProc | null, reply: SFReply): Promise<void> {
	return SFPGetFile(where, prompt, fileFilter, numTypes, typeList, dlgHook, reply, -4000, null);
}

/** Pascal `SFPutFile`: asks for a name to save under. */
export async function SFPutFile(where: Point, prompt: string, origName: string, _dlgHook: DlgHookProc | null, reply: SFReply): Promise<void> {
	const name = await host.putFile({ prompt, defaultName: origName, where });
	activateAfterModalDialog();
	Object.assign(reply, newSFReply());
	if (name !== null && name.length > 0) {
		reply.good = true;
		reply.vRefNum = portVRefNum;
		reply.fName = name.slice(0, 31);
	}
}

export function SFPPutFile(where: Point, prompt: string, origName: string, dlgHook: DlgHookProc | null, reply: SFReply, _dlgID: Integer, _filterProc: unknown): Promise<void> {
	return SFPutFile(where, prompt, origName, dlgHook, reply);
}
