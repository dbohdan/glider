// A simulated Mac for Toolbox tests: a Mac Plus or Mac II screen, the System and Glider 4.06
// resources from the oracle, and a virtual clock that runs scripted input.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Image, readPNM, writePNG } from '../../oracle/Image.ts';
import { cacheDir, emulatorPath, glider406, type Machine, macII, macPlus, systemFiles } from '../../oracle/Oracle.ts';
import { makeColorTable, setMainDevice, standardClut4 } from '../../src/mac/Color.ts';
import { flushFonts } from '../../src/mac/Fonts.ts';
import { bytesAt, initHeap, mapMemory, NewPtrClear, resetMemory } from '../../src/mac/Memory.ts';
import { type Host, mouse, postOSEvent, resetInput, setHost, tickTime } from '../../src/mac/OS.ts';
import * as QD from '../../src/mac/QuickDraw.ts';
import { initResources, openResourceFork } from '../../src/mac/Resources.ts';
import { parseResourceFork, type ResourceFork } from '../../src/mac/ResourceFork.ts';
import { InitWindows } from '../../src/mac/Windows.ts';
import { InitMenus } from '../../src/mac/Menus.ts';
import { useAppleLogo } from './appleLogo.ts';

// The oracle's screens show the Apple logo where the port draws a diamond.
useAppleLogo();

/** Whether the oracle has been set up and has run a case to its end (the output comes last, so a run still going is not). */
export function oracleRunAvailable(caseName: string): boolean {
	return existsSync(emulatorPath(macPlus)) && existsSync(join(cacheDir, 'runs', caseName, 'output.txt'));
}

/** A screenshot the oracle took, as RGB. */
export function oracleShot(caseName: string, shot: string): Image {
	return readPNM(readFileSync(join(cacheDir, 'runs', caseName, shot)));
}

/** What the emulator printed during an oracle run. */
export function oracleOutput(caseName: string): string {
	return readFileSync(join(cacheDir, 'runs', caseName, 'output.txt'), 'utf8');
}

/** A virtual clock: waiting moves time forward at once, running input scheduled on the way. */
export class ScriptHost implements Host {
	time = 0;
	/** Whether input ends a wait at once, as on a Mac, whose program sees it when it next looks. */
	wakeOnInput = false;
	private events: { at: number; seq: number; run: () => void; input: boolean }[] = [];
	private seq = 0;

	now(): number {
		return this.time;
	}

	async sleep(ms: number): Promise<void> {
		for (;;) {
			const next = this.events[0];
			if (next === undefined || next.at > ms) {
				break;
			}
			this.events.shift();
			this.time = Math.max(this.time, next.at);
			next.run();
			if (next.input && this.wakeOnInput && this.events[0]?.at !== next.at) {
				await Promise.resolve();
				return;
			}
		}
		this.time = Math.max(this.time, ms);
		await Promise.resolve();
	}

	/** Runs what was scheduled up to the clock's present: input that came before a program started. */
	catchUp(): void {
		while (this.events[0] !== undefined && this.events[0].at <= this.time) {
			this.events.shift()!.run();
		}
	}

	/** Runs `f` when the clock reaches a tick, which may be fractional; input may end a wait. */
	at(tick: number, f: () => void, input = false): this {
		this.events.push({ at: tickTime(tick), seq: this.seq++, run: f, input });
		this.events.sort((a, b) => a.at - b.at || a.seq - b.seq);
		return this;
	}

	/** Moves the mouse at a tick (global coordinates). */
	mouseAt(tick: number, h: number, v: number): this {
		return this.at(tick, () => {
			mouse.where = { h, v };
		});
	}

	buttonAt(tick: number, down: boolean): this {
		return this.at(tick, () => {
			mouse.button = down;
			postOSEvent(down ? 1 : 2, 0);
		});
	}
}

export interface TestMachine {
	machine: Machine;
	host: ScriptHost;
	width: number;
	height: number;
	/** The screen as RGB, as the oracle's screenshots show it. */
	shot(): Image;
}

let systemFork: ResourceFork | undefined;
let gliderFork: ResourceFork | undefined;

/** Starts a Mac Plus (512×342, 1 bit) or Mac II (640×480, 4 bits) with the Window and Menu Managers. */
export function bootMachine(m: Machine): TestMachine {
	if (systemFork === undefined) {
		systemFork = parseResourceFork(systemFiles().find((f) => f.name === 'System')!.rsrc);
		gliderFork = parseResourceFork(glider406().get('Glider 4.06')!.rsrc);
	}
	resetMemory();
	mapMemory(0, new Uint8Array(4 << 20));
	initHeap(0x1000, 4 << 20);
	resetInput();
	const host = new ScriptHost();
	setHost(host);
	initResources(systemFork);
	openResourceFork(gliderFork!, 'Glider 4.06');
	flushFonts();
	const color = m === macII;
	const width = color ? 640 : 512;
	const height = color ? 480 : 342;
	const rowBytes = color ? 320 : 64;
	const base = NewPtrClear(rowBytes * height);
	let shot: () => Image;
	if (color) {
		const clut = makeColorTable(standardClut4, 0x8000, 8);
		const screen: QD.PixMap = { ...QD.newPixMap(), baseAddr: base, rowBytes: rowBytes | 0x8000, bounds: { top: 0, left: 0, bottom: height, right: width }, pixelSize: 4, cmpSize: 4, pmTable: clut };
		setMainDevice({ gdType: 0, gdPMap: screen, gdRect: { ...screen.bounds }, gdFlags: 0 });
		QD.InitGraf(screen, true);
		shot = () => {
			const raw = bytesAt(base, rowBytes * height);
			const rgb = new Uint8Array(width * height * 3);
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const c = standardClut4[(raw[y * rowBytes + (x >> 1)]! >> (x & 1 ? 0 : 4)) & 15]!;
					rgb.set([c.red >> 8, c.green >> 8, c.blue >> 8], (y * width + x) * 3);
				}
			}
			return { width, height, rgb };
		};
	} else {
		setMainDevice(null);
		QD.InitGraf({ baseAddr: base, rowBytes, bounds: { top: 0, left: 0, bottom: height, right: width } });
		shot = () => {
			const raw = bytesAt(base, rowBytes * height);
			const rgb = new Uint8Array(width * height * 3);
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const black = (raw[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
					rgb.fill(black ? 0 : 255, (y * width + x) * 3, (y * width + x) * 3 + 3);
				}
			}
			return { width, height, rgb };
		};
	}
	InitWindows();
	InitMenus();
	return { machine: m, host, width, height, shot };
}

/** A rectangle given as left, top, right, bottom. */
export type Box = [number, number, number, number];

/**
 * The pixels that differ between two screens inside some boxes and outside others, as "h,v".
 */
export function differences(a: Image, b: Image, include: Box[], exclude: Box[] = []): string[] {
	const out: string[] = [];
	const inside = (x: number, y: number, boxes: Box[]): boolean => boxes.some(([l, t, r, bt]) => x >= l && x < r && y >= t && y < bt);
	for (let y = 0; y < a.height; y++) {
		for (let x = 0; x < a.width; x++) {
			if (!inside(x, y, include) || inside(x, y, exclude)) {
				continue;
			}
			const i = (y * a.width + x) * 3;
			if (a.rgb[i] !== b.rgb[i] || a.rgb[i + 1] !== b.rgb[i + 1] || a.rgb[i + 2] !== b.rgb[i + 2]) {
				out.push(`${x},${y}`);
			}
		}
	}
	return out;
}

/** The area the arrow cursor covers when the mouse is at a point. */
export function cursorBox(h: number, v: number): Box {
	return [h - 2, v - 2, h + 16, v + 18];
}

/**
 * Writes the oracle's screen, ours, and their differences (in red) side by side, cropped to a box
 * and enlarged, to oracle/cache/diffs/<name>.png.
 */
export function writeComparison(name: string, rom: Image, ours: Image, box: Box, scale = 3): string {
	const [l, t, r, b] = box;
	const w = r - l;
	const h = b - t;
	const out = new Uint8Array(w * 3 * scale * h * scale * 3);
	const rowLen = w * 3 * scale;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = ((t + y) * rom.width + l + x) * 3;
			const a = rom.rgb.subarray(i, i + 3);
			const o = ours.rgb.subarray(i, i + 3);
			const same = a[0] === o[0] && a[1] === o[1] && a[2] === o[2];
			const lum = (a[0]! + a[1]! + a[2]!) / 3;
			const d = same ? [lum > 127 ? 230 : 60, lum > 127 ? 230 : 60, lum > 127 ? 230 : 60] : [255, 0, 0];
			for (const [k, c] of [a, o, d].entries()) {
				for (let dy = 0; dy < scale; dy++) {
					for (let dx = 0; dx < scale; dx++) {
						const p = ((y * scale + dy) * rowLen + (k * w + x) * scale + dx) * 3;
						out[p] = c[0]!;
						out[p + 1] = c[1]!;
						out[p + 2] = c[2]!;
					}
				}
			}
		}
	}
	const dir = join(cacheDir, 'diffs');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, name + '.png');
	writeFileSync(path, writePNG({ width: rowLen, height: h * scale, rgb: out }));
	return path;
}

/** An RGB image as a binary PPM file, for looking at the port's screen. */
export function writePNM(img: Image): Uint8Array {
	const header = new TextEncoder().encode(`P6\n${img.width} ${img.height}\n255\n`);
	const out = new Uint8Array(header.length + img.rgb.length);
	out.set(header);
	out.set(img.rgb, header.length);
	return out;
}
