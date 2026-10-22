// Test pictures for QuickDraw: each exercises some primitives, drawn by the ROM and by the port.

import { glider406 } from '../../oracle/Oracle.ts';
import { PictWriter, type Pattern } from '../../oracle/PictWriter.ts';
import { parseResourceFork } from '../../src/mac/ResourceFork.ts';
import { combine, rectRegion, toBytes } from '../../src/mac/Region.ts';
import { bundledFiles } from '../../tools/build-resources.ts';
import { pictureFrame } from '../../oracle/Pictures.ts';
import type { Rect } from '../../src/mac/Types.ts';

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ top, left, bottom, right });

export const patterns: Record<string, Pattern> = {
	black: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
	gray: [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55],
	ltGray: [0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22],
	dkGray: [0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd],
	diagonal: [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01],
	bricks: [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08],
};

function picture(): PictWriter {
	return new PictWriter(pictureFrame).clipRect(pictureFrame);
}

/** Glider's pen mode for shadows in color. */
const patCopyTransparent = 8 + 36;

/** A deterministic pseudo-random sequence for test shapes. */
function random(seed: number): (n: number) => number {
	let s = seed;
	return (n) => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s % n;
	};
}

/** Mixes the bits of a number (MurmurHash3's finalizer). */
function hash(n: number): number {
	let h = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}

/** Short lines of every direction in a grid, avoiding Glider's hint box. */
function lines(seed: number, pen: [number, number]): Uint8Array {
	const p = picture().penSize(...pen);
	const rnd = random(seed);
	for (let row = 0; row < 15; row++) {
		for (let col = 0; col < 21; col++) {
			const cx = 4 + col * 24;
			const cy = 24 + row * 21;
			if (cy < 104 && cx > 280) {
				continue;
			}
			const dx = rnd(19) - 9;
			const dy = rnd(17) - 8;
			const x1 = cx + 10 - (dx > 0 ? 5 : 0);
			const y1 = cy + 9 - (dy > 0 ? 4 : 0);
			p.line({ h: x1, v: y1 }, { h: x1 + dx, v: y1 + dy });
		}
	}
	return p.toBytes();
}

/**
 * Pixels known to differ from the ROM, by picture: gaps in what the oracle has pinned down.
 * Tests fail when the count changes, so that a fix (or a regression) gets noticed.
 */
export const knownDifferences: Record<string, number> = {
	// Arithmetic modes other than transparent: colors matched through the ROM's inverse table.
	'ii-colorArithmeticModes': 2304,
};

/**
 * A 1-bit image in which every row and column differs, stretched and shrunk at uneven ratios
 * in srcCopy, srcOr and srcBic, so that the ROM's choice of rows and columns shows.
 */
function stretchPicture(p = picture()): Uint8Array {
	p.rect('paint', rect(256, 104, 512, 342));
	// A third of the pixels black, sparse enough that rows or columns combined still show which.
	const rows = new Uint8Array(6 * 24);
	for (let y = 0; y < 24; y++) {
		for (let x = 0; x < 48; x++) {
			if (hash(x * 31 + y * 1009) % 3 === 0) {
				rows[y * 6 + (x >> 3)]! |= 0x80 >> (x & 7);
			}
		}
	}
	const bounds = rect(0, 0, 48, 24);
	const sizes: [number, number][] = [[48, 23], [47, 24], [48, 13], [31, 24], [17, 9], [8, 5], [24, 12], [33, 17], [49, 25], [96, 48], [61, 37], [100, 30], [20, 40], [50, 47], [32, 24], [48, 3]];
	// Below Glider's hint box: srcCopy, then srcOr.
	[0, 1].forEach((mode, j) => {
		let x = 4;
		let y = 106 + j * 118;
		for (const [w, h] of sizes) {
			if (x + w > 508) {
				x = 4;
				y += 52;
			}
			p.bits(bounds, 6, rows, bounds, rect(x, y, x + w, y + h), mode);
			x += w + 4;
		}
	});
	// Part of the image, as Glider copies a frame out of its sprite sheet.
	p.bits(bounds, 6, rows, rect(16, 2, 32, 16), rect(10, 30, 26, 43), 0);
	p.bits(bounds, 6, rows, rect(16, 2, 32, 16), rect(40, 30, 56, 43), 1);
	return p.toBytes();
}

/** Glider's own pictures, from the oracle's copy of Glider 4.06. */
function gliderPicture(file: string, id: number): () => Uint8Array {
	return () => parseResourceFork(glider406().get(file)!.rsrc).get('PICT', id)!.data;
}

/** The port's art (the repository's, which is 4.05's), as the game draws it. */
function artPicture(file: string, id: number): () => Uint8Array {
	return () => parseResourceFork(bundledFiles().find((f) => f.name === file)!.rsrc).get('PICT', id)!.data;
}

export const testPictures: Record<string, () => Uint8Array> = {
	gliderTitle: gliderPicture('Glider 4.06', 200),
	bwObjects: artPicture('B&W Art', 128),
	bwMasks: artPicture('B&W Art', 129),
	...Object.fromEntries([128, 129, 130, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209].map((id) => [`bwArt${id}`, gliderPicture('B&W Art', id)])),

	/** Rectangles in every verb, pen sizes, and patterns at odd offsets. */
	rects() {
		const p = picture();
		let x = 4;
		for (const [name, pat] of Object.entries(patterns)) {
			p.fillPat(pat).rect('fill', rect(x, 24, x + 37, 24 + 29 + (x % 5)));
			p.penPat(pat).rect('paint', rect(x + 3, 60 + (x % 7), x + 40, 100));
			p.bkPat(pat).rect('erase', rect(x + 1, 104, x + 30, 133));
			x += 47;
			void name;
		}
		p.penPat(patterns.black!);
		for (const [i, [w, h]] of [[1, 1], [2, 1], [1, 3], [5, 4], [12, 12], [30, 2]].entries()) {
			p.penSize(w!, h!).rect('frame', rect(10 + i * 50, 150, 50 + i * 50, 190 + i));
		}
		p.penSize(1, 1).rect('invert', rect(20, 160, 200, 175));
		p.rect('frame', rect(300, 150, 300, 200)).rect('paint', rect(310, 150, 309, 200));
		return p.toBytes();
	},

	thinLines1: () => lines(1, [1, 1]),
	thinLines2: () => lines(9, [1, 1]),
	thinLines3: () => lines(17, [1, 1]),
	thickLines2x2: () => lines(2, [2, 2]),
	thickLines3x1: () => lines(3, [3, 1]),
	thickLines1x4: () => lines(4, [1, 4]),

	/** Long lines across the picture, and lines in pattern modes. */
	longLines() {
		const p = picture();
		for (let i = 0; i < 12; i++) {
			p.line({ h: 4 + i * 23, v: 110 }, { h: 500 - i * 37, v: 330 - i * 7 });
			p.line({ h: 10, v: 120 + i * 17 }, { h: 505, v: 125 + i * 13 });
		}
		p.penSize(3, 2).penPat(patterns.gray!).penMode(10).line({ h: 0, v: 340 }, { h: 511, v: 105 });
		return p.toBytes();
	},

	/** Ovals of every size up to 30 by 28, painted. */
	ovals() {
		const p = picture();
		for (let h = 1; h <= 28; h += 1) {
			for (let w = 1; w <= 30; w += 2) {
				const x = 4 + Math.trunc(w / 2) * 33;
				const y = 24 + (h - 1) * 11;
				if (y + h > 340 || (y < 104 && x > 280)) {
					continue;
				}
				p.oval('paint', rect(x, y, x + w + (h % 2), y + Math.min(h, 10)));
			}
		}
		return p.toBytes();
	},

	/** Larger ovals: framed with pen sizes, filled, erased, inverted. */
	bigOvals() {
		const p = picture();
		const rnd = random(5);
		for (let i = 0; i < 40; i++) {
			const w = 4 + rnd(60);
			const h = 4 + rnd(50);
			const x = rnd(280 - w);
			const y = 22 + rnd(318 - h);
			const verb = (['frame', 'paint', 'invert', 'fill', 'frame'] as const)[i % 5]!;
			p.penSize(1 + rnd(4), 1 + rnd(4)).fillPat(patterns.gray!).oval(verb, rect(x, y, x + w, y + h));
		}
		p.penSize(1, 1);
		for (let i = 0; i < 20; i++) {
			const w = 20 + rnd(200);
			const h = 4 + rnd(120);
			const x = 280 + rnd(230 - Math.min(w, 229));
			const y = 105 + rnd(235 - h);
			p.oval(i % 2 ? 'frame' : 'invert', rect(x, y, x + Math.min(w, 230), y + h));
		}
		return p.toBytes();
	},

	/** Rounded rectangles of various corners, framed with pen sizes and painted. */
	roundRects() {
		const p = picture();
		const rnd = random(11);
		for (let i = 0; i < 36; i++) {
			const w = 10 + rnd(90);
			const h = 8 + rnd(60);
			const x = (i % 6) * 84 + 2;
			const y = 106 + Math.trunc(i / 6) * 38;
			const ow = [16, 16, 8, 20, 30, 3, 5, 12][i % 8]!;
			const oh = [16, 10, 8, 20, 12, 3, 16, 40][i % 8]!;
			p.ovSize(ow, oh).penSize(1 + (i % 3), 1 + (i % 2));
			p.rRect(i % 3 === 0 ? 'paint' : 'frame', rect(x, y, x + Math.min(w, 80), y + Math.min(h, 36)));
		}
		p.penSize(1, 1).ovSize(16, 16).rRect('frame', rect(10, 30, 250, 95)).rRect('invert', rect(30, 40, 120, 80));
		return p.toBytes();
	},

	/** Polygons: the edges of a region recorded from lines, as Glider's shadows are. */
	polygons() {
		const p = picture();
		const rnd = random(21);
		for (let i = 0; i < 24; i++) {
			const cx = 40 + (i % 6) * 80;
			const cy = 130 + Math.trunc(i / 6) * 55;
			const n = 3 + rnd(5);
			const pts = Array.from({ length: n }, () => ({ h: cx - 35 + rnd(70), v: cy - 25 + rnd(50) }));
			pts.push(pts[0]!);
			p.poly(i % 4 === 3 ? 'frame' : i % 4 === 2 ? 'invert' : 'paint', pts);
		}
		// Glider's window shadow, shelf shadow, and the title screen's mask polygon.
		p.poly('paint', [{ h: 60, v: 30 }, { h: 50, v: 40 }, { h: 50, v: 45 }, { h: 55, v: 50 }, { h: 55, v: 80 }, { h: 50, v: 85 }, { h: 50, v: 90 }, { h: 55, v: 95 }, { h: 115, v: 95 }, { h: 120, v: 90 }, { h: 60, v: 90 }, { h: 60, v: 30 }]);
		p.poly('paint', [{ h: 250, v: 39 }, { h: 235, v: 54 }, { h: 135, v: 54 }, { h: 135, v: 49 }, { h: 150, v: 34 }, { h: 150, v: 39 }, { h: 250, v: 39 }]);
		return p.toBytes();
	},

	/**
	 * Bold text (the Room Editor's help is Geneva 9 and 12 bold) beside plain, in Geneva 9 and 12 and
	 * Chicago 12, in srcOr and srcCopy over half black; and runs of one letter, whose spacing shows
	 * each character's width.
	 */
	boldText() {
		const p = picture();
		p.rect('paint', rect(256, 104, 512, 342));
		const sample = 'Shortcuts: the left and right arrow keys, Tab, ALL 12 Wq.';
		let y = 30;
		for (const [font, size] of [[3, 9], [3, 12], [0, 12]] as const) {
			for (const face of [0, 1]) {
				for (const mode of [1, 0]) {
					p.txFont(font).txSize(size).txFace(face).txMode(mode).text({ v: y, h: 4 + (mode === 0 ? 3 : 0) }, sample);
					y += size + 6;
				}
			}
		}
		for (const [font, size] of [[3, 9], [3, 12], [0, 12]] as const) {
			p.txFont(font).txSize(size).txFace(1).txMode(1).text({ v: y, h: 4 }, 'lllllllll iiiii WWWW mmmm .....');
			y += size + 6;
		}
		return p.toBytes();
	},

	/** Text in the System font and Glider's fonts, in source text modes over half black. */
	text() {
		const p = picture();
		p.rect('paint', rect(256, 104, 512, 342));
		const sample = 'The quick brown fox jumps over 13 lazy dogs! @#$%&*()[]{}<>?\'s';
		let y = 120;
		for (const [font, size] of [[0, 12], [16, 12], [200, 12], [201, 12], [204, 32], [3, 9], [4, 9], [0, 0]] as const) {
			p.txFont(font).txSize(size).txMode(1).text({ v: y, h: 4 }, sample);
			y += size === 32 ? 34 : 15;
		}
		for (let mode = 0; mode < 8; mode++) {
			p.txFont(0).txSize(12).txMode(mode).text({ v: y + mode * 14, h: 200 + (mode % 2) * 3 }, `mode ${mode}: Hello, World`);
		}
		p.txMode(1).text({ v: 40, h: 10 }, 'MacRoman: \u00e9\u00fc\u00df\u00a9\u2122\u2026\u00b0\u03c0\u2202\u2211 \u0001');
		return p.toBytes();
	},

	/** Text in pattern modes, which Glider uses. */
	textPatternModes() {
		const p = picture();
		p.rect('paint', rect(256, 104, 512, 342));
		for (let mode = 8; mode < 16; mode++) {
			p.txFont(0).txSize(12).txMode(mode).penPat(patterns.gray!).text({ v: 120 + (mode - 8) * 16, h: 200 }, `pattern mode ${mode}: Hello`);
		}
		for (let mode = 8; mode < 16; mode++) {
			p.txFont(16).txSize(12).txMode(mode).penPat(patterns.black!).text({ v: 260 + (mode - 8) * 10, h: 200 + (mode % 2) * 7 }, `mode ${mode} pen black`);
		}
		return p.toBytes();
	},

	/** CopyBits in every source mode, with and without a mask region, over half black. */
	bits() {
		const p = picture();
		p.rect('paint', rect(256, 104, 512, 342));
		// A 6-byte-wide image (48 by 24) of diagonal stripes and a frame.
		const rows = new Uint8Array(6 * 24);
		for (let y = 0; y < 24; y++) {
			for (let x = 0; x < 48; x++) {
				if ((x + y) % 7 < 3 || y === 0 || x === 0 || y === 23 || x === 47) {
					rows[y * 6 + (x >> 3)]! |= 0x80 >> (x & 7);
				}
			}
		}
		const bounds = rect(0, 0, 48, 24);
		for (let mode = 0; mode < 8; mode++) {
			const x = 230 + (mode % 2) * 10;
			const y = 110 + mode * 28;
			p.bits(bounds, 6, rows, bounds, rect(x, y, x + 48, y + 24), mode);
			p.bits(bounds, 6, rows, rect(5, 3, 40, 20), rect(x + 60, y, x + 95, y + 17), mode);
		}
		return p.toBytes();
	},

	/** CopyBits stretching and shrinking at uneven ratios, over half black; Glider shrinks its last drip frame. */
	stretch: stretchPicture,

	/** Pattern transfer modes over a striped background. */
	patternModes() {
		const p = picture();
		for (let i = 0; i < 16; i++) {
			p.fillPat(patterns.black!).rect('fill', rect(4 + i * 31, 210, 4 + i * 31 + 10, 330));
		}
		for (let mode = 8; mode < 16; mode++) {
			p.penMode(mode).penPat(patterns.diagonal!).rect('paint', rect(0, 210 + (mode - 8) * 15, 512, 222 + (mode - 8) * 15));
		}
		// Source modes as pen modes, over half black.
		p.penMode(8).rect('paint', rect(256, 24, 512, 200));
		for (let mode = 0; mode < 8; mode++) {
			p.penMode(mode).penPat(patterns.gray!).rect('paint', rect(10, 28 + mode * 22, 500, 40 + mode * 22));
		}
		return p.toBytes();
	},
};

const rgbColors = {
	black: { red: 0, green: 0, blue: 0 },
	white: { red: 0xffff, green: 0xffff, blue: 0xffff },
	red: { red: 0xdd6b, green: 0x08c2, blue: 0x06a2 },
	blue: { red: 0, green: 0, blue: 0xd400 },
	yellow: { red: 0xfc00, green: 0xf37d, blue: 0x052f },
	violet: { red: 0x46e3, green: 0, blue: 0xa53e },
	tan: { red: 0x90d7, green: 0x7160, blue: 0x3a34 },
	cyan: { red: 0x0241, green: 0xab54, blue: 0xeaff },
};

/** A version 2 picture over stripes of every color. */
function colorPicture(): PictWriter {
	const p = new PictWriter(pictureFrame, 2).clipRect(pictureFrame);
	Object.values(rgbColors).forEach((c, i) => p.rgbFgColor(c).rect('paint', rect(i * 64, 20, i * 64 + 64, 342)));
	return p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white);
}

/** Pictures drawn in color, as on a Mac II. */
export const colorPictures: Record<string, () => Uint8Array> = {
	/** Bold and plain text in red and blue, as the Room Editor's help has it, in srcOr and srcCopy. */
	colorBoldText() {
		const p = colorPicture();
		p.rect('paint', rect(256, 104, 512, 342));
		const sample = 'Shortcuts: the left and right arrow keys, Tab, ALL 12 Wq.';
		let y = 30;
		for (const color of [rgbColors.red, rgbColors.blue]) {
			for (const [font, size] of [[3, 9], [3, 12]] as const) {
				for (const face of [0, 1]) {
					for (const mode of [1, 0]) {
						p.rgbFgColor(color).txFont(font).txSize(size).txFace(face).txMode(mode).text({ v: y, h: 4 + (mode === 0 ? 3 : 0) }, sample);
						y += size + 4;
					}
				}
			}
		}
		return p.toBytes();
	},

	/** Pattern modes with colors. */
	colorPatternModes() {
		const p = colorPicture();
		const pairs = [[rgbColors.black, rgbColors.white], [rgbColors.red, rgbColors.white], [rgbColors.blue, rgbColors.yellow], [rgbColors.white, rgbColors.black]] as const;
		pairs.forEach(([fg, bk], j) => {
			for (let mode = 8; mode < 16; mode++) {
				const y = 26 + j * 78 + (mode - 8) * 9;
				p.rgbFgColor(fg).rgbBkColor(bk).penMode(mode).penPat(patterns.gray!).rect('paint', rect(4, y, 508, y + 7));
			}
		});
		return p.toBytes();
	},

	/** The arithmetic modes, as Glider uses them: patCopy + transparent and srcCopy + transparent. */
	colorArithmeticModes() {
		const p = colorPicture();
		for (let i = 0; i < 16; i++) {
			const mode = 32 + i;
			const y = 26 + i * 19;
			p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white).penMode(mode).penPat(patterns.gray!).rect('paint', rect(4, y, 508, y + 8));
			p.rgbFgColor(rgbColors.red).penPat(patterns.dkGray!).rect('paint', rect(4, y + 9, 508, y + 17));
		}
		return p.toBytes();
	},

	/** Source modes as pen modes in color, for shapes and lines (Glider's lightning bolts). */
	colorSourcePenModes() {
		const p = colorPicture();
		for (let mode = 0; mode < 8; mode++) {
			const y = 26 + mode * 38;
			p.rgbFgColor(rgbColors.black).penMode(mode).penPat(patterns.gray!).rect('paint', rect(4, y, 508, y + 12));
			p.penSize(2, 2).line({ h: 4, v: y + 16 }, { h: 508, v: y + 30 }).penSize(1, 1);
			p.rgbFgColor(rgbColors.yellow).line({ h: 4, v: y + 34 }, { h: 508, v: y + 20 });
		}
		return p.toBytes();
	},

	/** Text in every source mode, in colors. */
	colorText() {
		const p = colorPicture();
		for (let mode = 0; mode < 16; mode++) {
			const fg = Object.values(rgbColors)[mode % 8]!;
			p.rgbFgColor(fg).rgbBkColor(rgbColors.cyan).txFont(mode % 2 ? 16 : 0).txSize(12).txMode(mode).text({ v: 40 + mode * 19, h: 10 + (mode % 3) * 40 }, `mode ${mode}: The quick brown fox jumps over the lazy dog`);
		}
		return p.toBytes();
	},

	/** Shapes in colors. */
	colorShapes() {
		const p = colorPicture();
		p.rgbFgColor(rgbColors.red).oval('paint', rect(10, 30, 110, 90)).rgbFgColor(rgbColors.blue).rRect('frame', rect(120, 30, 250, 90));
		p.rgbFgColor(rgbColors.violet).fillPat(patterns.bricks!).rect('fill', rect(260, 30, 500, 90));
		p.rgbBkColor(rgbColors.yellow).rect('erase', rect(10, 100, 200, 150)).rect('invert', rect(150, 120, 400, 180));
		p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white).penPat(patterns.gray!).penMode(patCopyTransparent).poly('paint', [{ h: 60, v: 200 }, { h: 45, v: 215 }, { h: 45, v: 300 }, { h: 300, v: 300 }, { h: 315, v: 285 }, { h: 60, v: 285 }, { h: 60, v: 200 }]);
		return p.toBytes();
	},

	/** Glider's air current pixel patterns, painted as Glider paints them (transparent) and copied. */
	colorAirPatterns() {
		const p = colorPicture();
		const glider = parseResourceFork(glider406().get('Glider 4.06')!.rsrc);
		[128, 129].forEach((id, i) => {
			const ppat = glider.get('ppat', id)!.data;
			p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white).pnPixPat(ppat);
			p.penMode(36).rect('paint', rect(4 + i * 3, 30 + i * 80, 508, 100 + i * 80));
			p.penMode(8).rect('paint', rect(10, 200 + i * 60, 500, 250 + i * 60 + i));
		});
		return p.toBytes();
	},

	colorStretch: () => stretchPicture(colorPicture()),
	/**
	 * Gray painted in patCopy + transparent into regions that are not rectangles, whose bounding
	 * boxes have every combination of odd and even edges, below the hint box: where the ROM puts the
	 * pattern's origin.
	 */
	colorRegionPatterns() {
		const p = colorPicture();
		for (let i = 0; i < 16; i++) {
			const left = 20 + (i % 4) * 120 + (i & 1);
			const top = 106 + Math.floor(i / 4) * 58 + ((i >> 1) & 1);
			const right = left + 60 + ((i >> 2) & 1);
			const bottom = top + 50 + ((i >> 3) & 1);
			// An L: the box less a notch at the top right, and a staircase down its left like a shadow's.
			let rgn = combine(rectRegion({ top, left, bottom, right }), rectRegion({ top, left: right - 20, bottom: top + 20, right }), (a, b) => a && !b);
			for (let k = 0; k < 10; k++) {
				rgn = combine(rgn, rectRegion({ top: top + k, left, bottom: top + k + 1, right: left + 10 - k }), (a, b) => a && !b);
			}
			p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white).penPat(patterns.gray!).penMode(patCopyTransparent).rgn('paint', toBytes(rgn));
		}
		return p.toBytes();
	},

	/** Gray painted in patCopy + transparent into ovals with every combination of odd and even edges. */
	colorOvalPatterns() {
		const p = colorPicture();
		for (let i = 0; i < 16; i++) {
			const left = 20 + (i % 4) * 120 + (i & 1);
			const top = 106 + Math.floor(i / 4) * 58 + ((i >> 1) & 1);
			const rect = { top, left, bottom: top + 40 + ((i >> 3) & 1), right: left + 90 + ((i >> 2) & 1) };
			p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white).penPat(patterns.gray!).penMode(patCopyTransparent).oval('paint', rect);
		}
		return p.toBytes();
	},

	/**
	 * The same regions, all with even edges, each after a dot drawn in srcCopy that leaves the pen at
	 * an odd or even point (h + v): whether the pen's place moves the pattern.
	 */
	colorRegionPen() {
		const p = colorPicture();
		for (let i = 0; i < 16; i++) {
			const left = 20 + (i % 4) * 120;
			const top = 106 + Math.floor(i / 4) * 58;
			const right = left + 60;
			const bottom = top + 50;
			let rgn = combine(rectRegion({ top, left, bottom, right }), rectRegion({ top, left: right - 20, bottom: top + 20, right }), (a, b) => a && !b);
			for (let k = 0; k < 10; k++) {
				rgn = combine(rgn, rectRegion({ top: top + k, left, bottom: top + k + 1, right: left + 10 - k }), (a, b) => a && !b);
			}
			// The pen ends inside the notch, at an odd point for odd i, moved by (i >> 1) & 3 down and right.
			const pen = { h: right - 10 + (i & 1) + ((i >> 1) & 3), v: top + 5 + ((i >> 1) & 3) };
			p.penMode(8).penPat(patterns.black!).line(pen, pen);
			p.rgbFgColor(rgbColors.black).rgbBkColor(rgbColors.white).penPat(patterns.gray!).penMode(patCopyTransparent).rgn('paint', toBytes(rgn));
		}
		return p.toBytes();
	},

	gliderTitle: gliderPicture('Glider 4.06', 210),
	...Object.fromEntries([128, 129, 130, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209].map((id) => [`colorArt${id}`, gliderPicture('Color Art', id)])),
	bwTitle: gliderPicture('Glider 4.06', 200),
};
