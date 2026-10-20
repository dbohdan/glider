// Glider for Windows' colors for the Mac II's screen (src/platform/WindowsColors.ts), as
// docs/versions.md measured them, and its brushes for the shapes Glider draws in code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeColorTable, setMainDevice, standardClut4 } from '../../src/mac/Color.ts';
import { bytesAt, initHeap, mapMemory, NewPtrClear, resetMemory } from '../../src/mac/Memory.ts';
import * as QD from '../../src/mac/QuickDraw.ts';
import { windowsBrushes, windowsColors } from '../../src/platform/WindowsColors.ts';

test("Windows' colors are a VGA card's: 6 bits a component, so 0x80 shows as 130 and 0xC0 as 195", () => {
	const [white, yellow, orange, red, magenta, purple, , , green, darkGreen, brown, tan, lightGray, mediumGray, darkGray, black] = windowsColors(16);
	assert.deepEqual(white, [255, 255, 255]);
	assert.deepEqual(yellow, [255, 255, 0]);
	assert.deepEqual(black, [0, 0, 0]);
	assert.deepEqual(lightGray, [195, 195, 195]);
	// Four pairs of the Mac's colors merge.
	assert.deepEqual(orange, red);
	assert.deepEqual(magenta, purple);
	assert.deepEqual(green, darkGreen);
	assert.deepEqual(mediumGray, darkGray);
	assert.deepEqual(brown, [130, 0, 0]);
	assert.deepEqual(tan, [130, 130, 0]);
	assert.deepEqual(mediumGray, [130, 130, 130]);
});

test('in 256 colors the dark colors are brightened, as the screenshots of Glider/WIN show, but not gray', () => {
	const c = windowsColors(256);
	assert.deepEqual(c[10], [195, 0, 0]); // brown: dark red, measured
	assert.deepEqual(c[11], [195, 195, 0]); // tan: olive, measured
	assert.deepEqual(c[13], [130, 130, 130]); // gray, measured
	assert.deepEqual(c[12], [195, 195, 195]); // light gray, measured
	assert.equal(c.length, 16);
});

/** A 16×8 color port in the Mac II's 16 colors, as Glider's offscreen room (whose origin is the play area's); its pixels by color index. */
function drawn(draw: () => void): number[][] {
	resetMemory();
	mapMemory(0, new Uint8Array(1 << 16));
	initHeap(0x1000, 1 << 16);
	const clut = makeColorTable(standardClut4, 0, 8);
	const bounds = { top: 0, left: 0, bottom: 8, right: 16 };
	const screen: QD.PixMap = { ...QD.newPixMap(), baseAddr: NewPtrClear(8 * 8), rowBytes: 8 | 0x8000, bounds, pixelSize: 4, cmpSize: 4, pmTable: clut };
	setMainDevice({ gdType: 0, gdPMap: screen, gdRect: { ...bounds }, gdFlags: 0 });
	QD.InitGraf(screen, true);
	const port = new QD.CGrafPort();
	QD.OpenCPort(port);
	port.portPixMap.baseAddr = screen.baseAddr;
	port.portPixMap.rowBytes = screen.rowBytes;
	port.portPixMap.bounds = { ...bounds };
	QD.RGBBackColor(standardClut4[0]!);
	QD.EraseRect(port.portRect);
	draw();
	const raw = bytesAt(screen.baseAddr, 8 * 8);
	setMainDevice(null);
	return Array.from({ length: 8 }, (_, y) => Array.from({ length: 16 }, (_, x) => (raw[y * 8 + (x >> 1)]! >> (x & 1 ? 0 : 4)) & 15));
}

const [white, yellow, , red, , purple, , , , , brown, tan, , gray] = standardClut4.map((_, k) => k);

test("Glider for Windows' brushes dither brown and light brown fills by the pixel's place, as its screenshots show", () => {
	QD.setBrushes(windowsBrushes);
	try {
		const fill = (color: number) =>
			drawn(() => {
				QD.RGBForeColor(standardClut4[color]!);
				QD.PaintRect({ top: 0, left: 0, bottom: 8, right: 16 });
			});
		for (const [y, row] of fill(brown).entries()) {
			row.forEach((c, x) => assert.equal(c, (x + y) % 2 === 0 ? brown : tan, `brown at ${x}, ${y}`));
		}
		for (const [y, row] of fill(tan).entries()) {
			row.forEach((c, x) => assert.equal(c, (x + y) % 2 === 0 ? red : y % 2 === 1 ? white : yellow, `light brown at ${x}, ${y}`));
		}
		// Other colors fill solid, violet among them.
		assert.ok(fill(purple).flat().every((c) => c === purple));
		// A light brown line is drawn in gray, its stand-in for Windows' static gray.
		const line = drawn(() => {
			QD.RGBForeColor(standardClut4[tan]!);
			QD.MoveTo(0, 3);
			QD.LineTo(15, 3);
		});
		assert.ok(line[3]!.every((c) => c === gray));
		assert.ok(line[2]!.every((c) => c === white));
	} finally {
		QD.setBrushes(null);
	}
	// Without the brushes, as on a Mac, the fill is solid.
	const solid = drawn(() => {
		QD.RGBForeColor(standardClut4[brown]!);
		QD.PaintRect({ top: 0, left: 0, bottom: 8, right: 16 });
	});
	assert.ok(solid.flat().every((c) => c === brown));
});
