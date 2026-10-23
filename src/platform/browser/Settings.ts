// Port: the page's own settings, which the additions' Display & Keyboard and Scale submenus change (PORT.md,
// decision 14): which Mac and screen the page runs, and its scale. They are the page's, not Glider's,
// so the browser keeps them (localStorage), for this browser only; the address's `machine` and
// `scale` parameters win over them.

import { type Display, type Filters, noFilters } from '../../additions/Additions.ts';

const displays: Display[] = ['plus', 'ii', 'ii-bw', 'win-16', 'win-256'];
const displayKey = 'glider4.display';
const scaleKey = 'glider4.scale';
// Named for the Look submenu, as the Filters submenu was first called; kept so that choices made then stay.
const lookKey = 'glider4.look';

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

/**
 * The scale: whole device pixels per Mac pixel, 0 for the largest that fits, −1 for the largest
 * whole number that fits. Unless chosen, the largest that fits on a touch screen, whose pixels are
 * small enough that a fractional scale looks sharp; elsewhere the largest whole number, as at 1
 * device pixel to a CSS pixel a fractional scale blurs text.
 */
export function chosenScale(params: URLSearchParams): number {
	for (const v of [params.get('scale'), stored(scaleKey)]) {
		const n = Number(v);
		if (v !== null && Number.isInteger(n) && n >= -1) {
			return n;
		}
	}
	return matchMedia('(pointer: coarse)').matches ? 0 : -1;
}

export function keepScale(factor: number): boolean {
	return keep(scaleKey, String(factor));
}

/** How the screen is shown: the one kept, else plain sharp pixels. */
export function chosenFilters(): Filters {
	try {
		const kept = JSON.parse(stored(lookKey) ?? 'null') as Partial<Filters> | null;
		if (kept !== null && typeof kept === 'object') {
			const filters = { ...noFilters };
			if (kept.enlarge === 'sharp' || kept.enlarge === 'smooth' || kept.enlarge === 'soft') {
				filters.enlarge = kept.enlarge;
			}
			for (const t of ['scanlines', 'glow', 'corners', 'tint', 'gamma'] as const) {
				filters[t] = kept[t] === true;
			}
			return filters;
		}
	} catch {
		// not JSON: no filters
	}
	return { ...noFilters };
}

export function keepFilters(filters: Filters): boolean {
	return keep(lookKey, JSON.stringify(filters));
}
