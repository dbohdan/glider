// Draws pictures with the port's QuickDraw and compares them with the original ROM's drawing.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Image, writePNG } from '../../oracle/Image.ts';
import { cacheDir, emulatorPath, glider406, type Machine, macPlus, systemFiles } from '../../oracle/Oracle.ts';
import { makeColorTable, setMainDevice, standardClut4 } from '../../src/mac/Color.ts';
import { flushFonts } from '../../src/mac/Fonts.ts';
import { initResources, openResourceFork } from '../../src/mac/Resources.ts';
import { parseResourceFork, type ResourceFork } from '../../src/mac/ResourceFork.ts';
import { drawWithROM, pictureFrame, pictureMask } from '../../oracle/Pictures.ts';
import { initHeap, mapMemory, NewPtrClear, resetMemory, bytesAt } from '../../src/mac/Memory.ts';
import * as QD from '../../src/mac/QuickDraw.ts';
import { DrawPicture } from '../../src/mac/Picture.ts';

/** Whether the oracle has been set up (`make oracle`). */
export function oracleAvailable(): boolean {
	return existsSync(emulatorPath(macPlus)) && existsSync(join(cacheDir, 'Glider.zip'));
}

/** The fonts the ROM draws with: the System file's, and Glider's own. */
function setUpResources(): void {
	if (systemFork === undefined) {
		systemFork = parseResourceFork(systemFiles().find((f) => f.name === 'System')!.rsrc);
		gliderFork = parseResourceFork(glider406().get('Glider 4.06')!.rsrc);
	}
	initResources(systemFork);
	openResourceFork(gliderFork!, 'Glider 4.06');
	flushFonts();
}
let systemFork: ResourceFork | undefined;
let gliderFork: ResourceFork | undefined;

/**
 * Draws a picture as Glider draws its title in color: into an offscreen 4-bit pixel map through a
 * color port on a 16-color screen. Pixels become RGB as the oracle's screen shows them (the high
 * byte of each component).
 */
export function drawWithColorPort(pict: Uint8Array): Image {
	setUpResources();
	resetMemory();
	mapMemory(0, new Uint8Array(1 << 21));
	initHeap(0x1000, 1 << 21);
	const screenRowBytes = 320;
	const clut = makeColorTable(standardClut4, 0, 8);
	const screen: QD.PixMap = { ...QD.newPixMap(), baseAddr: NewPtrClear(screenRowBytes * 480), rowBytes: screenRowBytes | 0x8000, bounds: { top: 0, left: 0, bottom: 480, right: 640 }, pixelSize: 4, cmpSize: 4, pmTable: clut };
	setMainDevice({ gdType: 0, gdPMap: screen, gdRect: { ...screen.bounds }, gdFlags: 0 });
	QD.InitGraf(screen, true);
	const port = new QD.CGrafPort();
	QD.OpenCPort(port);
	const rowBytes = 256;
	port.portPixMap.baseAddr = NewPtrClear(rowBytes * 342);
	port.portPixMap.rowBytes = rowBytes | 0x8000;
	port.portPixMap.bounds = { ...pictureFrame };
	QD.RGBForeColor({ red: 0, green: 0, blue: 0 });
	QD.RGBBackColor({ red: 0xffff, green: 0xffff, blue: 0xffff });
	QD.EraseRect(port.portRect);
	QD.ClipRect(pictureFrame);
	DrawPicture({ data: pict }, pictureFrame);
	const raw = bytesAt(port.portPixMap.baseAddr, rowBytes * 342);
	const rgb = new Uint8Array(512 * 342 * 3);
	for (let y = 0; y < 342; y++) {
		for (let x = 0; x < 512; x++) {
			const c = standardClut4[(raw[y * rowBytes + (x >> 1)]! >> (x & 1 ? 0 : 4)) & 15]!;
			rgb.set([c.red >> 8, c.green >> 8, c.blue >> 8], (y * 512 + x) * 3);
		}
	}
	setMainDevice(null);
	return { width: 512, height: 342, rgb };
}

/** Draws a picture as Glider draws its title: into an offscreen 512×342 bitmap through an old-style port. */
export function drawWithPort(pict: Uint8Array): Image {
	setUpResources();
	resetMemory();
	mapMemory(0, new Uint8Array(1 << 20));
	initHeap(0x1000, 1 << 20);
	const rowBytes = 64;
	const bits: QD.BitMap = { baseAddr: NewPtrClear(rowBytes * 342), rowBytes, bounds: { ...pictureFrame } };
	QD.InitGraf(bits);
	const port = new QD.GrafPort();
	QD.OpenPort(port);
	QD.SetPortBits(bits);
	QD.ClipRect(pictureFrame);
	QD.EraseRect(bits.bounds);
	DrawPicture({ data: pict }, pictureFrame);
	const raw = bytesAt(bits.baseAddr, rowBytes * 342);
	const rgb = new Uint8Array(512 * 342 * 3);
	for (let y = 0; y < 342; y++) {
		for (let x = 0; x < 512; x++) {
			const black = (raw[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
			rgb.fill(black ? 0 : 255, (y * 512 + x) * 3, (y * 512 + x) * 3 + 3);
		}
	}
	return { width: 512, height: 342, rgb };
}

/**
 * Compares the port's drawing of a picture with the ROM's, on the pixels the oracle can see.
 * Returns the differing pixels as "h,v" (empty if none); on differences, writes an image showing
 * them: the ROM's drawing, the port's, and the differences in red.
 */
export function compareWithROM(name: string, pict: Uint8Array, m: Machine = macPlus): string[] {
	const rom = drawWithROM(m, pict);
	const mask = pictureMask(m);
	const ours = m === macPlus ? drawWithPort(pict) : drawWithColorPort(pict);
	const differing: string[] = [];
	const diff = new Uint8Array(rom.rgb.length);
	for (let i = 0; i < mask.length; i++) {
		const same = rom.rgb[i * 3] === ours.rgb[i * 3] && rom.rgb[i * 3 + 1] === ours.rgb[i * 3 + 1] && rom.rgb[i * 3 + 2] === ours.rgb[i * 3 + 2];
		if (mask[i] && !same) {
			differing.push(`${i % 512},${Math.trunc(i / 512)}`);
			diff.set([255, 0, 0], i * 3);
		} else {
			const lum = (rom.rgb[i * 3]! + rom.rgb[i * 3 + 1]! + rom.rgb[i * 3 + 2]!) / 3;
			diff.fill(mask[i] ? 160 + Math.round((lum / 255) * 95) : 220, i * 3, i * 3 + 3);
		}
	}
	const dir = join(cacheDir, 'diffs');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, (m === macPlus ? '' : m.name + '-') + name + '.png');
	if (differing.length > 0) {
		const w = 512;
		const rgb = new Uint8Array(w * 3 * 342 * 3);
		for (let y = 0; y < 342; y++) {
			for (const [k, img] of [rom.rgb, ours.rgb, diff].entries()) {
				rgb.set(img.subarray(y * w * 3, (y + 1) * w * 3), (y * w * 3 + k * w) * 3);
			}
		}
		writeFileSync(path, writePNG({ width: w * 3, height: 342, rgb }));
	}
	return differing;
}
