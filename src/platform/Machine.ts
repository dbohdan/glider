// Port: the emulated computer the program runs on: its memory, screen, and System, ready for the
// program's own Toolbox initialization. Used by the browser page and by tests alike.
//
// A Mac Plus has 4 MB of RAM with its main screen buffer at $3FA700 and the alternate one 32K
// below at $3F2700 (kSecondaryAddr in Glider); C. Holmén's "Mission Screen" INIT, which Glider
// needs for page flipping, reserves the alternate buffer and leaves the Pascal string "alternate
// screen present" 32 bytes below it, where Glider looks for it. A Mac II has 8 MB of RAM and its
// video card's memory in slot space, with a 640×480 screen in 16 colors.

import {
	type BitMap,
	bytesAt,
	envAExtendKbd,
	getMachine,
	type Host,
	InitGraf,
	initHeap,
	initResources,
	macIIConfig,
	macPlusConfig,
	makeColorTable,
	mapMemory,
	mountVolume,
	mouse,
	newPixMap,
	OpenResFile,
	type PixMap,
	resetInput,
	resetMemory,
	resetSMS,
	setHost,
	setMachine,
	setMainDevice,
	SetDepth,
	setScreenPage,
	setStartDateTime,
	standardClut4,
} from '../mac/Toolbox.ts';
import type { MacFile } from '../mac/MacBinary.ts';
import { encodeMacRoman } from '../mac/MacRoman.ts';
import type { Volume } from '../mac/Volume.ts';
import type { ResourceFork } from '../mac/ResourceFork.ts';

export type MachineKind = 'plus' | 'ii';

/** Where the compact Macs' screens are. */
export const plusRAMSize = 0x400000;
export const plusMainScreen = 0x3fa700;
export const plusAlternateScreen = 0x3f2700;
/** Where the Mission Screen INIT leaves its signature. */
const missionScreenString = plusAlternateScreen - 0x20;

/** The Mac II's RAM and its video card's memory (slot $9, with room for 8 bits per pixel). */
export const iiRAMSize = 0x800000;
export const iiVideoBase = 0xf9000000;

export interface MachineOptions {
	kind: MachineKind;
	/** The port's System file. */
	system: ResourceFork;
	/** The volume with the program and its files. */
	volume: Volume;
	/** The program's file on the volume, opened as the current resource file. */
	application: string;
	host: Host;
	/** Called when the program changes a file, so that the platform can keep it. */
	fileChanged?: (file: MacFile, deleted: boolean) => void;
	/** Seconds since 1904 at start; the host's clock by default. */
	startDateTime?: number | null;
	/**
	 * Whether a Mac II has an Apple Extended Keyboard rather than the standard ADB keyboard (the
	 * oracle's). The browser's keys map to the Extended Keyboard's codes, and Glider 4.05's
	 * preferences were saved with one, so its arrow-key controls apply without the "New keyboard"
	 * alert.
	 */
	extendedKeyboard?: boolean;
	/** Whether a Mac II starts with its screen in black and white, as the Monitors control panel can set it. */
	blackAndWhite?: boolean;
}

export interface Machine {
	kind: MachineKind;
	width: number;
	height: number;
	/** The screen's pixel map on a Mac II; the main screen's bitmap on a Mac Plus. */
	screen: BitMap | PixMap;
	/** The application's resource file reference number. */
	appRefNum: number;
}

/** Sets up the computer, its screen, and its System, and opens the application's resource file. */
export function bootMachine(options: MachineOptions): Machine {
	resetMemory();
	resetInput();
	resetSMS();
	// The mouse starts where the oracle's Macs have it after starting up.
	mouse.where = { h: 15, v: 15 };
	setHost(options.host);
	setStartDateTime(options.startDateTime ?? null);
	let screen: BitMap | PixMap;
	let width: number;
	let height: number;
	if (options.kind === 'plus') {
		width = 512;
		height = 342;
		mapMemory(0, new Uint8Array(plusRAMSize));
		const signature = encodeMacRoman('alternate screen present');
		const at = bytesAt(missionScreenString, signature.length + 1);
		at[0] = signature.length;
		at.set(signature, 1);
		initHeap(0x10000, missionScreenString);
		screen = { baseAddr: plusMainScreen, rowBytes: 64, bounds: { top: 0, left: 0, bottom: height, right: width } };
		setMachine(macPlusConfig);
		setMainDevice(null);
		InitGraf(screen, false);
		setScreenPage(false);
	} else {
		width = 640;
		height = 480;
		mapMemory(0, new Uint8Array(iiRAMSize));
		mapMemory(iiVideoBase, new Uint8Array(width * height));
		initHeap(0x10000, iiRAMSize);
		const pm: PixMap = {
			...newPixMap(),
			baseAddr: iiVideoBase,
			rowBytes: (width / 2) | 0x8000,
			bounds: { top: 0, left: 0, bottom: height, right: width },
			pixelSize: 4,
			cmpSize: 4,
			pmTable: makeColorTable(standardClut4, 0x8000, 8),
		};
		screen = pm;
		setMachine(options.extendedKeyboard === true ? { ...macIIConfig, keyBoardType: envAExtendKbd } : macIIConfig);
		const device = { gdType: 2, gdPMap: pm, gdRect: { ...pm.bounds }, gdFlags: 0 };
		setMainDevice(device);
		InitGraf(pm, true);
		if (options.blackAndWhite === true) {
			SetDepth(device, 1, 0, 0);
		}
	}
	initResources(options.system);
	mountVolume(options.volume, options.fileChanged);
	const appRefNum = OpenResFile(options.application);
	if (appRefNum < 0) {
		throw new Error(`no application "${options.application}" on the volume`);
	}
	return { kind: options.kind, width, height, screen, appRefNum };
}

/** Whether the machine has Color QuickDraw. */
export function machineHasColor(): boolean {
	return getMachine().hasColorQD;
}
