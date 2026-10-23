// Port: the page's own settings, which the additions' Display & Keyboard and Scale submenus change (PORT.md,
// decision 14): which Mac and screen the page runs, and its scale. They are the page's, not Glider's,
// so the browser keeps them (localStorage), for this browser only; the address's `machine` and
// `scale` parameters win over them.

import type { Display } from '../../additions/Additions.ts';

const displays: Display[] = ['plus', 'ii', 'ii-bw', 'win-16', 'win-256'];
const displayKey = 'glider4.display';
const scaleKey = 'glider4.scale';

function stored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null; // storage is unavailable (private browsing, blocked site data)
	}
}

/** Keeps a setting; false if the browser will not. */
function keep(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

const isDisplay = (v: string | null): v is Display => v !== null && (displays as string[]).includes(v);

/** The display the page runs: the address's, else the one kept, else a Mac II in 16 colors. */
export function chosenDisplay(params: URLSearchParams): Display {
	const fromURL = params.get('machine');
	if (isDisplay(fromURL)) {
		return fromURL;
	}
	const kept = stored(displayKey);
	return isDisplay(kept) ? kept : 'ii';
}

export function keepDisplay(display: Display): boolean {
	return keep(displayKey, display);
}

/** The scale: whole device pixels per Mac pixel, 0 for the largest that fits, −1 for the largest whole number that fits. */
export function chosenScale(params: URLSearchParams): number {
	for (const v of [params.get('scale'), stored(scaleKey)]) {
		const n = Number(v);
		if (v !== null && Number.isInteger(n) && n >= -1) {
			return n;
		}
	}
	return 0;
}

export function keepScale(factor: number): boolean {
	return keep(scaleKey, String(factor));
}
