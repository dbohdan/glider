// Port: what the monitor shows: the screen buffer the video circuit reads (on a Mac Plus, the page
// the VIA selects), through the device's color table, with the cursor over it.

import { cursorState, GetMainDevice, isAlternatePage, mouse, resolve, type RGBColor } from '../mac/Toolbox.ts';
import { type Machine, plusAlternateScreen, plusMainScreen } from './Machine.ts';

/**
 * Renders the screen into RGBA pixels (width × height × 4). Port: the cursor is drawn over the
 * image rather than into screen memory; see PORT.md's open questions.
 */
export function renderScreen(m: Machine, out: Uint8ClampedArray, withCursor = true): void {
	const device = GetMainDevice();
	if (m.kind === 'plus' || device === null) {
		const base = isAlternatePage() ? plusAlternateScreen : plusMainScreen;
		const rowBytes = 64;
		const { bytes, offset } = resolve(base, rowBytes * m.height);
		for (let y = 0; y < m.height; y++) {
			for (let x = 0; x < m.width; x++) {
				const bit = (bytes[offset + y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
				const v = bit ? 0 : 255;
				const i = (y * m.width + x) * 4;
				out[i] = v;
				out[i + 1] = v;
				out[i + 2] = v;
				out[i + 3] = 255;
			}
		}
	} else {
		const pm = device.gdPMap;
		const depth = pm.pixelSize;
		const rowBytes = pm.rowBytes & 0x3fff;
		const colors = pm.pmTable.ctTable.map((c) => c.rgb);
		const { bytes, offset } = resolve(pm.baseAddr, rowBytes * m.height);
		const mask = (1 << depth) - 1;
		for (let y = 0; y < m.height; y++) {
			for (let x = 0; x < m.width; x++) {
				const bitPos = x * depth;
				const value = (bytes[offset + y * rowBytes + (bitPos >> 3)]! >> (8 - depth - (bitPos & 7))) & mask;
				const c = colors[value] ?? { red: 0, green: 0, blue: 0 };
				const i = (y * m.width + x) * 4;
				// Port: the Mac II's video card has 8-bit color components: the high byte of each.
				out[i] = c.red >> 8;
				out[i + 1] = c.green >> 8;
				out[i + 2] = c.blue >> 8;
				out[i + 3] = 255;
			}
		}
	}
	if (withCursor) {
		drawCursor(m, out);
	}
}

/** Draws the cursor: black where image and mask are set, white where only the mask is, inverted where only the image is. */
function drawCursor(m: Machine, out: Uint8ClampedArray): void {
	if (cursorState.level < 0 || cursorState.obscured) {
		return;
	}
	const c = cursorState.cursor;
	const color = cursorState.color;
	const left = mouse.where.h - c.hotSpot.h;
	const top = mouse.where.v - c.hotSpot.v;
	const colorPixel = (x: number, y: number): RGBColor | null => {
		if (color === null) {
			return null;
		}
		const pm = color.crsrMap;
		const depth = pm.pixelSize;
		const rowBytes = pm.rowBytes & 0x3fff;
		const bitPos = x * depth;
		const value = (color.crsrData[y * rowBytes + (bitPos >> 3)]! >> (8 - depth - (bitPos & 7))) & ((1 << depth) - 1);
		return pm.pmTable.ctTable.find((e) => e.value === value)?.rgb ?? null;
	};
	for (let y = 0; y < 16; y++) {
		for (let x = 0; x < 16; x++) {
			const h = left + x;
			const v = top + y;
			if (h < 0 || v < 0 || h >= m.width || v >= m.height) {
				continue;
			}
			const data = (c.data[y]! >> (15 - x)) & 1;
			const mask = (c.mask[y]! >> (15 - x)) & 1;
			const i = (v * m.width + h) * 4;
			if (mask) {
				const rgb = colorPixel(x, y);
				if (rgb !== null) {
					out[i] = rgb.red >> 8;
					out[i + 1] = rgb.green >> 8;
					out[i + 2] = rgb.blue >> 8;
				} else {
					const value = data ? 0 : 255;
					out[i] = value;
					out[i + 1] = value;
					out[i + 2] = value;
				}
			} else if (data) {
				out[i] = 255 - out[i]!;
				out[i + 1] = 255 - out[i + 1]!;
				out[i + 2] = 255 - out[i + 2]!;
			}
		}
	}
}
