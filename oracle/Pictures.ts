// The picture oracle: the original ROM draws a test picture, which Glider shows as its title screen.
//
// Glider draws its title picture (PICT 200 in black and white, 210 in color) into an offscreen buffer
// with DrawPicture and copies it to the screen, so a copy of Glider with that picture replaced
// shows how QuickDraw in ROM draws any picture. Glider draws a few things of its own over it
// (the menu bar, a hint box, the cursor); comparisons skip those pixels.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rect } from '../src/mac/Types.ts';
import { type Image, readPNM, writePNG } from './Image.ts';
import { alternateScreenFile, cacheDir, glider406, gliderFor, type Machine, macPlus, makeDisk, rColorIdleID, rIdleID, run } from './Oracle.ts';
import { PictWriter } from './PictWriter.ts';
import { Script } from './Script.ts';

/** Glider's title picture frame and the area it fills. */
export const pictureFrame: Rect = { top: 0, left: 0, bottom: 342, right: 512 };

/** When the picture is on screen and Glider has drawn nothing over it but the menu bar and a hint. */
const shotTick = 100;

/**
 * Runs get 32 times the instructions per tick, so that even slow pictures are drawn long before
 * shotTick, while Glider's own drawing, which waits for ticks, keeps its timing.
 */
const speed = 5;

/** Changes when the way pictures are run changes, to invalidate cached results. */
const runVersion = 3;

/** Where the picture's top left corner appears on each machine's screen. */
function pictureOrigin(m: Machine): { h: number; v: number } {
	return m === macPlus ? { h: 0, v: 0 } : { h: 64, v: 69 };
}

function crop(img: Image, r: Rect): Image {
	const width = r.right - r.left;
	const height = r.bottom - r.top;
	const rgb = new Uint8Array(width * height * 3);
	for (let y = 0; y < height; y++) {
		const from = ((r.top + y) * img.width + r.left) * 3;
		rgb.set(img.rgb.subarray(from, from + width * 3), y * width * 3);
	}
	return { width, height, rgb };
}

/** Draws a picture with the original ROM and returns the picture's area of the screen, cached by content. */
export function drawWithROM(m: Machine, pict: Uint8Array): Image {
	const key = `${m.name}-${runVersion}-${createHash('sha256').update(pict).digest('hex').slice(0, 16)}`;
	const dir = join(cacheDir, 'pictures');
	const cached = join(dir, key + '.pnm');
	if (existsSync(cached)) {
		return readPNM(readFileSync(cached));
	}
	const id = m === macPlus ? rIdleID : rColorIdleID;
	const glider = gliderFor(m, (rf) => rf.put({ ...rf.get('PICT', id)!, data: pict }));
	const files = [glider, ...[...glider406().values()].filter((f) => f.name !== glider.name)];
	if (m === macPlus) {
		files.push(alternateScreenFile());
	}
	const runDir = join(cacheDir, 'runs', 'picture-' + key);
	makeDisk(runDir + '.dsk', files, glider.name);
	// The cursor waits in the menu bar, away from the picture.
	const r = run(m, new Script().speed(speed).mouse(500, 2).until(shotTick).shot('screen'), runDir + '.dsk', runDir);
	const o = pictureOrigin(m);
	const img = crop(r.shots.get('screen')!, { top: o.v, left: o.h, bottom: o.v + 342, right: o.h + 512 });
	mkdirSync(dir, { recursive: true });
	writeFileSync(cached, new Uint8Array([...new TextEncoder().encode(`P6\n${img.width} ${img.height}\n255\n`), ...img.rgb]));
	writeFileSync(join(dir, key + '.png'), writePNG(img));
	return img;
}

/**
 * The pixels of the picture area that show the picture: those that differ between an all-black
 * and an all-white picture. Glider's own drawing covers the rest.
 */
export function pictureMask(m: Machine): Uint8Array {
	const solid = (verb: 'paint' | 'erase') => new PictWriter(pictureFrame).clipRect(pictureFrame).rect(verb, pictureFrame).toBytes();
	const black = drawWithROM(m, solid('paint'));
	const white = drawWithROM(m, solid('erase'));
	const mask = new Uint8Array(black.width * black.height);
	for (let i = 0; i < mask.length; i++) {
		mask[i] = black.rgb[i * 3] !== white.rgb[i * 3] ? 1 : 0;
	}
	return mask;
}
