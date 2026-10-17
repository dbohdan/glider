// Port: the Graphics Devices Manager's depth switching (Inside Macintosh V, chapter 5, and the
// Mac II's SetDepth, $AAA2 selector $0013), which Glider uses to switch a Mac II between 16 colors
// and black and white.

import { type GDevice, makeColorTable, standardClut4 } from './Color.ts';
import { colorPorts, screenBits } from './QuickDraw.ts';
import type { Integer, OSErr } from './Types.ts';

/** gdFlags bits for SetDepth's whichFlags and flags. */
export const gdDevType = 0;
export const cDepthErr: OSErr = -157;

const black = { red: 0, green: 0, blue: 0 };
const white = { red: 0xffff, green: 0xffff, blue: 0xffff };

/** The depths the port's Mac II screen offers, with their standard color tables. */
const depthTables: Record<number, typeof standardClut4> = {
	1: [white, black],
	4: standardClut4,
};

let afterDepthChange: Array<() => void> = [];

/** Port: called after the screen's depth changes, to redraw it (the Window Manager) and show it (the platform). */
export function onDepthChange(f: () => void): void {
	afterDepthChange.push(f);
}

export function clearDepthChangeHooks(): void {
	afterDepthChange = [];
}

/** Pascal `HasDepth`: nonzero if the device can show that depth. */
export function HasDepth(_gd: GDevice, depth: Integer, _whichFlags: Integer, _flags: Integer): Integer {
	return depth in depthTables ? depth : 0;
}

/**
 * Pascal `SetDepth`: switches a device to a depth. The screen's memory stays where it is; its rows
 * get narrower or wider, and every color port on it follows. The screen is then redrawn.
 */
export function SetDepth(gd: GDevice, depth: Integer, _whichFlags: Integer, _flags: Integer): OSErr {
	const colors = depthTables[depth];
	if (colors === undefined) {
		return cDepthErr;
	}
	const pm = gd.gdPMap;
	if (pm.pixelSize === depth) {
		return 0;
	}
	const width = pm.bounds.right - pm.bounds.left;
	const rowBytes = Math.ceil((width * depth) / 32) * 4;
	const base = pm.baseAddr;
	pm.pixelSize = depth;
	pm.cmpSize = depth;
	pm.rowBytes = rowBytes | 0x8000;
	pm.pmTable = makeColorTable(colors, 0x8000, pm.pmTable.ctSeed + 1);
	if (screenBits.baseAddr === base) {
		screenBits.rowBytes = rowBytes;
	}
	for (const port of colorPorts) {
		const ppm = port.portPixMap;
		if (ppm.baseAddr === base) {
			ppm.pixelSize = depth;
			ppm.cmpSize = depth;
			ppm.rowBytes = rowBytes | 0x8000;
			ppm.pmTable = pm.pmTable;
		}
	}
	for (const f of afterDepthChange) {
		f();
	}
	return 0;
}

// Port: the compact Macs' second screen page. The VIA's port A bit 6 (vPage2) chooses what the
// video circuit shows: set, the main screen; clear, the alternate screen 32K below it. Glider's
// SetPage library routine sets or clears the bit directly.

let alternatePage = false;
let onPageChange: (alternate: boolean) => void = () => {};

/** Port: shows the alternate screen page (vPage2 clear) or the main one (vPage2 set). */
export function setScreenPage(alternate: boolean): void {
	if (alternatePage !== alternate) {
		alternatePage = alternate;
		onPageChange(alternate);
	}
}

export function isAlternatePage(): boolean {
	return alternatePage;
}

/** Port: the platform's hook, called when the page shown changes. */
export function onScreenPageChange(f: (alternate: boolean) => void): void {
	onPageChange = f;
}
