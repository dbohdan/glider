// The browser page, built (`make build`, which `make test` runs first) and loaded in Chromium: the
// screen's canvas holds the whole Mac screen with every filter, at whole and fractional scales, on a
// laptop, a high-density laptop and a phone. A canvas left at its default 300 by 150 once showed
// only the screen's top left corner, enlarged, with the default filters and scale.
//
// Playwright's own Chromium is used if installed (`npx playwright install chromium`), else the one
// at $CHROMIUM or $PLAYWRIGHT_BROWSERS_PATH/chromium; without any, the test is skipped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { type Browser, chromium } from '@playwright/test';
import { serve } from '../../tools/serve.ts';

const dist = join(import.meta.dirname, '..', '..', 'dist');

async function launch(): Promise<Browser | null> {
	try {
		return await chromium.launch();
	} catch {
		const fallback = process.env['CHROMIUM'] ?? (process.env['PLAYWRIGHT_BROWSERS_PATH'] === undefined ? undefined : join(process.env['PLAYWRIGHT_BROWSERS_PATH'], 'chromium'));
		if (fallback === undefined || !existsSync(fallback)) {
			return null;
		}
		return await chromium.launch({ executablePath: fallback });
	}
}

interface Case {
	name: string;
	viewport: { width: number; height: number };
	dpr: number;
	touch: boolean;
	query: string;
	filters?: object;
	/** The Mac's screen size. */
	mac: [number, number];
}

const laptop = { width: 1440, height: 780 };
const tablet = { width: 1194, height: 770 };
const cases: Case[] = [
	{ name: 'the default on a laptop', viewport: laptop, dpr: 1, touch: false, query: '', mac: [640, 480] },
	{ name: 'the default on a high-density laptop', viewport: laptop, dpr: 2, touch: false, query: '', mac: [640, 480] },
	{ name: 'the default on a phone', viewport: { width: 844, height: 390 }, dpr: 3, touch: true, query: '', mac: [640, 480] },
	{ name: 'a Mac Plus at a fractional scale', viewport: tablet, dpr: 2, touch: false, query: '?machine=plus&scale=0', mac: [512, 342] },
];
for (const enlarge of ['sharp', 'smooth', 'soft']) {
	for (const scale of [-1, 0]) {
		cases.push({ name: `${enlarge} with every touch, scale ${scale}`, viewport: tablet, dpr: 2, touch: false, query: `?scale=${scale}`, filters: { enlarge, scanlines: true, glow: true, corners: true, tint: true, gamma: true }, mac: [640, 480] });
	}
}

test('the page shows the whole screen with every filter and scale', async (t) => {
	if (!existsSync(join(dist, 'index.html'))) {
		t.skip('the page is not built (make build)');
		return;
	}
	const browser = await launch();
	if (browser === null) {
		t.skip('no Chromium (npx playwright install chromium, or set CHROMIUM)');
		return;
	}
	const server = serve(dist, 0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
	try {
		for (const c of cases) {
			await t.test(c.name, async () => {
				const context = await browser.newContext({ viewport: c.viewport, deviceScaleFactor: c.dpr, isMobile: c.touch, hasTouch: c.touch });
				try {
					if (c.filters !== undefined) {
						await context.addInitScript((filters) => localStorage.setItem('glider4.look', JSON.stringify(filters)), c.filters);
					}
					const page = await context.newPage();
					const errors: string[] = [];
					page.on('pageerror', (e) => errors.push(e.message));
					await page.goto(base + c.query);
					await page.waitForSelector('canvas.screen', { timeout: 30_000 });
					const [width, height, shownWidth, shownHeight] = await page.evaluate(() => {
						const canvas = document.querySelector<HTMLCanvasElement>('canvas.screen')!;
						const shown = canvas.getBoundingClientRect();
						return [canvas.width, canvas.height, shown.width, shown.height];
					});
					const [w, h] = c.mac;
					assert.ok(width >= w && width % w === 0 && height >= h && height % h === 0, `the canvas is ${width} by ${height}, not a whole multiple of the ${w} by ${h} screen`);
					assert.ok(Math.abs(shownWidth / shownHeight - w / h) < 0.01, `the screen is shown ${shownWidth} by ${shownHeight}`);
					assert.ok(shownWidth <= c.viewport.width && shownHeight <= c.viewport.height, `the screen, ${shownWidth} by ${shownHeight}, does not fit the window`);
					assert.deepEqual(errors, []);
				} finally {
					await context.close();
				}
			});
		}
	} finally {
		await browser.close();
		server.close();
	}
});
