// Test pictures for QuickDraw: each exercises some primitives, drawn by the ROM and by the port.

import { glider406 } from '../../oracle/Oracle.ts';
import { PictWriter, type Pattern } from '../../oracle/PictWriter.ts';
import { parseResourceFork } from '../../src/mac/ResourceFork.ts';
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

/** A deterministic pseudo-random sequence for test shapes. */
function random(seed: number): (n: number) => number {
	let s = seed;
	return (n) => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s % n;
	};
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
	// The top rows of short, wide ovals; see ovalRegion.
	ovals: 2,
	bigOvals: 5,
	roundRects: 4,
};

/** Glider's own pictures, from the oracle's copy of Glider 4.06. */
function gliderPicture(file: string, id: number): () => Uint8Array {
	return () => parseResourceFork(glider406().get(file)!.rsrc).get('PICT', id)!.data;
}

export const testPictures: Record<string, () => Uint8Array> = {
	gliderTitle: gliderPicture('Glider 4.06', 200),
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
