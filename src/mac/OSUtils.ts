// Port: Operating System and Toolbox utilities: the machine's environment, dates, delays, traps,
// the Memory Manager's handles, the Segment Loader, and strings.
//
// Calling convention: a Toolbox procedure whose only VAR parameter is a scalar (a number, string,
// or handle) returns it instead: Pascal `NumToString(n, s)` is `s = NumToString(n)`.
// Other scalar VAR parameters are Ref boxes; records are passed and filled in.

import { encodeMacRoman, pascalString } from './MacRoman.ts';
import { getHost, TickCount, tickTime } from './OS.ts';
import { GetResource, Handle } from './Resources.ts';
import { type Integer, type LongInt, type OSErr, type Ref, noErr } from './Types.ts';

export { Handle } from './Resources.ts';

// ---------------------------------------------------------------------------------------------
// The machine

/** SysEnvirons machine types. */
export const envMacPlus = 2;
export const envSE = 3;
export const envMacII = 4;
/** Keyboard types. */
export const envMacPlusKbd = 3;
export const envAExtendKbd = 4;
export const envStandADBKbd = 5;
/** Processors. */
export const env68000 = 1;
export const env68020 = 3;

/** Port: what kind of Mac the program runs on. */
export interface MachineConfig {
	machineType: Integer;
	processor: Integer;
	hasFPU: boolean;
	hasColorQD: boolean;
	keyBoardType: Integer;
	/** The System version, as SysEnvirons reports it ($0608 for System 6.0.8). */
	systemVersion: Integer;
	/**
	 * From parameter RAM, in ticks: the longest time between the clicks of a double click (low
	 * memory DoubleTime) and between blinks of the insertion point (CaretTime). The oracle's Macs
	 * have different settings.
	 */
	doubleTime: LongInt;
	caretTime: LongInt;
}

export const macPlusConfig: MachineConfig = {
	machineType: envMacPlus,
	processor: env68000,
	hasFPU: false,
	hasColorQD: false,
	keyBoardType: envMacPlusKbd,
	systemVersion: 0x0608,
	doubleTime: 20,
	caretTime: 12,
};
export const macIIConfig: MachineConfig = {
	machineType: envMacII,
	processor: env68020,
	hasFPU: true,
	hasColorQD: true,
	keyBoardType: envStandADBKbd,
	systemVersion: 0x0608,
	doubleTime: 32,
	caretTime: 32,
};

let machine: MachineConfig = macPlusConfig;

export function setMachine(m: MachineConfig): void {
	machine = m;
}

export function getMachine(): MachineConfig {
	return machine;
}

/** Pascal `SysEnvRec`. */
export interface SysEnvRec {
	environsVersion: Integer;
	machineType: Integer;
	systemVersion: Integer;
	processor: Integer;
	hasFPU: boolean;
	hasColorQD: boolean;
	keyBoardType: Integer;
	atDrvrVersNum: Integer;
	sysVRefNum: Integer;
}

export function newSysEnvRec(): SysEnvRec {
	return { environsVersion: 0, machineType: 0, systemVersion: 0, processor: 0, hasFPU: false, hasColorQD: false, keyBoardType: 0, atDrvrVersNum: 0, sysVRefNum: 0 };
}

/** The volume reference number of the startup volume. */
export const systemVRefNum = -1;

export function SysEnvirons(versionRequested: Integer, theWorld: SysEnvRec): OSErr {
	Object.assign(theWorld, {
		environsVersion: Math.min(versionRequested, 2),
		machineType: machine.machineType,
		systemVersion: machine.systemVersion,
		processor: machine.processor,
		hasFPU: machine.hasFPU,
		hasColorQD: machine.hasColorQD,
		keyBoardType: machine.keyBoardType,
		atDrvrVersNum: 0,
		sysVRefNum: systemVRefNum,
	});
	return noErr;
}

// ---------------------------------------------------------------------------------------------
// Dates and time

/** Seconds from 1904-01-01 to 1970-01-01. */
const macEpochOffset = 2082844800;

/** Port: the date and time the machine starts at, in seconds since 1904; the host's clock by default. */
let startSeconds: number | null = null;

export function setStartDateTime(secs: number | null): void {
	startSeconds = secs;
}

/** Pascal `GetDateTime(var secs)`: seconds since 1904-01-01 in local time. */
export function GetDateTime(): LongInt {
	const base = startSeconds ?? Math.floor(Date.now() / 1000 - new Date().getTimezoneOffset() * 60) + macEpochOffset - Math.floor(getHost().now() / 1000);
	return (base + Math.floor(getHost().now() / 1000)) | 0;
}

/** Pascal `Delay(numTicks, var finalTicks)`: waits and returns the tick count at the end. */
export async function Delay(numTicks: LongInt): Promise<LongInt> {
	const end = TickCount() + numTicks;
	while (TickCount() < end) {
		await getHost().sleep(tickTime(end));
	}
	return TickCount();
}

// ---------------------------------------------------------------------------------------------
// Traps

export const OSTrap = 0;
export const ToolTrap = 1;

/** Trap numbers Glider asks about. */
export const unimplTrapNum = 0x9f;
export const WNETrapNum = 0x60;

/** Port: the Toolbox traps the machine implements, among those programs ask about. */
const implementedToolTraps = new Set([WNETrapNum]);

/** Pascal `NGetTrapAddress`: a distinct address for each implemented trap, the unimplemented trap's otherwise. */
export function NGetTrapAddress(trapNum: Integer, tType: Integer): LongInt {
	const unimplemented = 0x40a0a0;
	if (tType === ToolTrap && (trapNum & 0x3ff) === unimplTrapNum) {
		return unimplemented;
	}
	return tType === ToolTrap && implementedToolTraps.has(trapNum & 0x3ff) ? 0x400000 + trapNum * 4 : unimplemented;
}

// ---------------------------------------------------------------------------------------------
// Sound settings and the end of the program

let soundVolume: Integer = 7;

/** Pascal `GetSoundVol(var level)`. */
export function GetSoundVol(): Integer {
	return soundVolume;
}

export function SetSoundVol(level: Integer): void {
	soundVolume = Math.max(0, Math.min(7, level));
}

/** Port: hooks the host provides for the system beep. */
let beeper: (duration: Integer) => void = () => {};

export function setBeeper(f: (duration: Integer) => void): void {
	beeper = f;
}

export function SysBeep(duration: Integer): void {
	beeper(duration);
}

/** Port: thrown by ExitToShell to end the program; the host catches it. */
export class ExitToShellSignal extends Error {
	constructor() {
		super('ExitToShell');
	}
}

export function ExitToShell(): never {
	throw new ExitToShellSignal();
}

// ---------------------------------------------------------------------------------------------
// The Memory Manager's handles, and memory calls that have nothing to do in the port

export function NewHandle(byteCount: LongInt): Handle {
	return new Handle(new Uint8Array(byteCount));
}

export function NewHandleClear(byteCount: LongInt): Handle {
	return NewHandle(byteCount);
}

export function DisposHandle(_h: Handle | null): void {}

export function GetHandleSize(h: Handle): LongInt {
	return h.data.length;
}

export function SetHandleSize(h: Handle, newSize: LongInt): void {
	const data = new Uint8Array(newSize);
	data.set(h.data.subarray(0, newSize));
	h.data = data;
}

export function HLock(_h: unknown): void {}
export function HUnlock(_h: unknown): void {}
export function HPurge(_h: unknown): void {}
export function HNoPurge(_h: unknown): void {}
export function MoveHHi(_h: unknown): void {}

/** Pascal `HGetState`: handle flags (locked, purgeable, resource); none matter here. */
export function HGetState(_h: unknown): Integer {
	return 0;
}

export function HSetState(_h: unknown, _flags: Integer): void {}

export function MaxApplZone(): void {}
export function MoreMasters(): void {}

/** The top of the application heap; only compared and passed back by programs. */
export function GetApplLimit(): LongInt {
	return 0x300000;
}

export function SetApplLimit(_zoneLimit: LongInt): void {}

export function UnloadSeg(_routineAddr: unknown): void {}

// ---------------------------------------------------------------------------------------------
// The Finder's documents to open at launch: none in the port, which opens files through its own pages.

export const appOpen = 0;
export const appPrint = 1;

/** Pascal `AppFile`. */
export interface AppFile {
	vRefNum: Integer;
	fType: string;
	versNum: Integer;
	fName: string;
}

export function CountAppFiles(message: Ref<Integer>, count: Ref<Integer>): void {
	message.v = appOpen;
	count.v = 0;
}

export function GetAppFiles(_index: Integer, theFile: AppFile): void {
	theFile.vRefNum = 0;
	theFile.fType = '\0\0\0\0';
	theFile.versNum = 0;
	theFile.fName = '';
}

export function ClrAppFiles(_index: Integer): void {}

/** Desk accessories, disk initialization: not part of the port. */
export function OpenDeskAcc(_name: string): Integer {
	return 0;
}

export function DIBadMount(_where: unknown, _evtMessage: LongInt): Integer {
	return 0;
}

// ---------------------------------------------------------------------------------------------
// Strings and numbers

/** Pascal `NumToString(theNum, var theString)`. */
export function NumToString(theNum: LongInt): string {
	return String(theNum | 0);
}

/** Pascal `StringToNum(theString, var theNum)`: as the Binary-Decimal package does, without checking the digits. */
export function StringToNum(theString: string): LongInt {
	let neg = false;
	let i = 0;
	if (theString[0] === '-') {
		neg = true;
		i = 1;
	} else if (theString[0] === '+') {
		i = 1;
	}
	let n = 0;
	for (; i < theString.length; i++) {
		n = (n * 10 + (theString.charCodeAt(i) - 48)) | 0;
	}
	return neg ? -n | 0 : n;
}

/** Pascal `GetString(stringID)`: a 'STR ' resource; null if it is missing. */
export function GetString(stringID: Integer): string | null {
	const h = GetResource('STR ', stringID);
	return h === null ? null : pascalString(h.data, 0);
}

/** Pascal `GetIndString(var theString, strListID, index)`: the empty string if there is no such string. */
export function GetIndString(strListID: Integer, index: Integer): string {
	const h = GetResource('STR#', strListID);
	if (h === null || index < 1) {
		return '';
	}
	const d = h.data;
	const count = (d[0]! << 8) | d[1]!;
	if (index > count) {
		return '';
	}
	let o = 2;
	for (let i = 1; i < index; i++) {
		o += 1 + d[o]!;
	}
	return pascalString(d, o);
}

/** Pascal `Length` of a string as the Mac counts it: its bytes in MacRoman. */
export function macLength(s: string): Integer {
	return encodeMacRoman(s).length;
}
