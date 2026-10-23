// Port: the port's additions that every program on its Mac has (PORT.md, decision 14), made of the
// Menu Manager's own parts: the Display & Keyboard submenu (the Mac Plus, the Mac II in color or
// black and white, and the Mac II's screen as Glider for Windows draws it), Scale, Filters (how the
// page shows the screen: sharp, smooth, or soft as on a CRT, with scanlines and other touches),
// and, for the programs that open an art file, Art. Glider puts them in its Options menu (src/glider/Additions.ts);
// the desktop and the Room Editor, which have none, get an Options menu of them (AddOptionsMenu).
//
// The additions are on only when the page gives a host (setAdditionsHost). The tests boot the
// programs without one, so that they stay as the oracle measures them.

import {
	AppendMenu,
	CheckItem,
	CountMItems,
	DelMenuItem,
	DisableItem,
	hMenuCmd,
	InsertMenu,
	type Integer,
	type MenuHandle,
	NewMenu,
	SetItem,
	SetItemCmd,
	SetItemMark,
} from '../mac/Toolbox.ts';
import { getVolume } from '../mac/Files.ts';
import { parseResourceFork } from '../mac/ResourceFork.ts';
import type { PadState } from './Pads.ts';

/** The machine and screen the page runs: the Mac II's screen may show Glider for Windows' colors. */
export type Display = 'plus' | 'ii' | 'ii-bw' | 'win-16' | 'win-256';

/** What the page does for the additions. */
export interface AdditionsHost {
	readonly display: Display;
	/** Whether the page can change to a display at once (a palette on the same Mac) rather than start the program again. */
	changesAtOnce(display: Display): boolean;
	/** Changes to a display at once. */
	setDisplay(display: Display): void;
	/** Once the program quits, starts it again on a display; null to go on as its Quit does. */
	restartOn(display: Display | null): void;
	/** The scales the page offers, whole device pixels to a Mac pixel: their names, and whether they fit the window now. */
	scales(): { factor: number; name: string; fits: boolean }[];
	/** The chosen scale's factor; 0 for the largest that fits, −1 for the largest whole number of device pixels that fits. */
	readonly scale: number;
	setScale(factor: number): void;
	/** The page's gamepads, for Glider's Gamepad and Virtual Gamepad controls; none without them. */
	readonly pads?: PadsHost;
	/** How the page shows the screen, if it offers filters. */
	readonly filters?: Filters;
	setFilters?(filters: Filters): void;
}

/**
 * How the page shows the Mac's screen: enlarged sharp, smooth (bilinear), or soft across and sharp
 * down as on a CRT; with scanlines, a glow, rounded corners, a phosphor's tint, each or none.
 */
export interface Filters {
	enlarge: 'sharp' | 'smooth' | 'soft';
	scanlines: boolean;
	glow: boolean;
	corners: boolean;
	tint: boolean;
}

export const noFilters: Filters = { enlarge: 'sharp', scanlines: false, glow: false, corners: false, tint: false };

// The filters, in the Filters submenu: one way to enlarge, then touches to add.
const enlargements: [Filters['enlarge'], string][] = [
	['sharp', 'Sharp'],
	['smooth', 'Smooth'],
	['soft', 'Soft (CRT)'],
];
const touches: ['scanlines' | 'glow' | 'corners' | 'tint', string][] = [
	['scanlines', 'Scanlines'],
	['glow', 'Glow'],
	['corners', 'Rounded Corners'],
	['tint', 'Phosphor Tint'],
];

/**
 * Where the virtual gamepad's arrows are: on the screen's left or right, energy and band on the
 * other side; or apart, ← and band on the left, energy and → on the right.
 */
export type PadSide = 'left' | 'right' | 'apart';

/** What the page does for the gamepads (src/additions/Pads.ts). */
export interface PadsHost {
	/** Whether the page is on a touch screen, where Glider starts with the Virtual Gamepad. */
	readonly touchScreen: boolean;
	/** The browser's gamepads now. */
	gamepad(): PadState;
	/** The virtual gamepad now. */
	virtualPad(): PadState;
	/**
	 * The gamepads the program reads now: the virtual one shows, its arrows on a side, or not
	 * (null); each one's pause button is the Tab key while it is read.
	 */
	use(gamepad: boolean, virtual: PadSide | null): void;
}

let host: AdditionsHost | null = null;

/** Turns the additions on, for a page; before the program starts. */
export function setAdditionsHost(h: AdditionsHost | null): void {
	host = h;
}

/** The page's host, if the additions are on. */
export function additionsHost(): AdditionsHost | null {
	return host;
}

/** The program's art, for the Art submenu: the name it opens as it starts, and whether it draws in color. */
export interface ArtChoice {
	/** The art file's name as the program keeps it (its `resourceName`). */
	get(): string;
	/** Sets the name, which the program saves in its preferences as it quits and opens as it starts. */
	set(name: string): void;
	inColor: boolean;
}

export const mOptions = 199; // Menu IDs, apart from the programs' own
export const mDisplay = 200;
export const mScale = 201;
export const mArt = 202;
export const mFilters = 203;

// Grouped by what a choice costs: the black-and-white Macs each start the program again, while the
// Mac II's color screen and Glider for Windows' change among themselves at once.
const displays: [Display | null, string][] = [
	['plus', 'Mac Plus'],
	['ii-bw', 'Mac II, Black & White'],
	[null, '(-'],
	['ii', 'Mac II, 16 Colors'],
	['win-16', 'Windows, 16 Colors'],
	['win-256', 'Windows, 256 Colors'],
];

/** The program's art, if it has an Art submenu. */
let artChoice: ArtChoice | null = null;
/** The art files in the Art submenu, in its order. */
let artFiles: string[] = [];
/** The art the program had before a choice that waits for it to start again. */
let artBefore = '';
/** How a program colors a submenu's items, as its own submenus' ('mctb'); none by default. */
let colorItems: (m: MenuHandle) => void = () => {};

/** The additions' submenus, which are no resources, by ID. */
const made = new Map<Integer, MenuHandle>();

/** A new submenu, among the hierarchical menus. */
function newSubmenu(id: Integer, title: string): MenuHandle {
	const m = NewMenu(id, title);
	InsertMenu(m, -1);
	made.set(id, m);
	return m;
}

/**
 * Makes the submenus: Display & Keyboard and Scale, Filters if the page offers filters, and Art if the
 * program opens art. Returns their
 * IDs and titles, for the program to put in a menu of its own as hierarchical items.
 */
export function SetUpSubmenus(art: ArtChoice | null, color: (m: MenuHandle) => void = () => {}): [id: Integer, title: string][] {
	colorItems = color;
	artChoice = art;
	const display = newSubmenu(mDisplay, 'Display & Keyboard');
	AppendMenu(display, displays.map(([, name]) => name).join(';'));
	colorItems(display);
	newSubmenu(mScale, 'Scale');
	RefreshScales();
	const submenus: [Integer, string][] = [
		[mDisplay, 'Display & Keyboard'],
		[mScale, 'Scale'],
	];
	if (host?.filters !== undefined) {
		// Titles by SetItem, which reads no metacharacters: AppendMenu would take "(CRT)" for "dimmed".
		const filters = newSubmenu(mFilters, 'Filters');
		const titled = (title: string): void => {
			AppendMenu(filters, 'x');
			SetItem(filters, CountMItems(filters), title);
		};
		enlargements.forEach(([, title]) => titled(title));
		AppendMenu(filters, '(-');
		touches.forEach(([, title]) => titled(title));
		colorItems(filters);
		submenus.push([mFilters, 'Filters']);
	}
	if (art !== null) {
		const menu = newSubmenu(mArt, 'Art');
		const files = (getVolume()?.list() ?? [])
			.filter((f) => f.type === 'GLbk')
			.map((f) => ({ name: f.name, depth: artDepth(f.rsrc) }))
			.toSorted((a, b) => a.name.localeCompare(b.name));
		artFiles = files.map((f) => f.name);
		if (files.length > 0) {
			// AppendMenu's metacharacters would be read in a name; they are rare in a file's.
			AppendMenu(menu, files.map((f) => f.name.replace(/[;^!</(]/g, ' ')).join(';'));
		}
		// Glider and the editor take color art in color and black-and-white art in black and white ('deep' 128).
		const wanted = art.inColor ? 4 : 1;
		files.forEach((f, k) => {
			if (f.depth !== wanted) {
				DisableItem(menu, k + 1);
			}
		});
		colorItems(menu);
		submenus.push([mArt, 'Art']);
	}
	checkChoices();
	return submenus;
}

/** Makes an item of a menu show a submenu. */
export function setSubmenu(menu: MenuHandle, item: Integer, id: Integer): void {
	SetItemMark(menu, item, id);
	SetItemCmd(menu, item, hMenuCmd);
}

/**
 * For a program without an Options menu (the desktop, the Room Editor): an Options menu at the end
 * of its menu bar, of the additions' submenus. Before the program draws its menu bar.
 */
export function AddOptionsMenu(art: ArtChoice | null): void {
	if (host === null) {
		return;
	}
	const submenus = SetUpSubmenus(art);
	const options = NewMenu(mOptions, 'Options');
	AppendMenu(options, submenus.map(([, title]) => title).join(';'));
	submenus.forEach(([id], k) => setSubmenu(options, k + 1, id));
	InsertMenu(options, 0);
}

/** An art file's depth, as its 'deep' resource gives it (4 for color art, 1 for black and white). */
function artDepth(rsrc: Uint8Array): Integer {
	try {
		const deep = parseResourceFork(rsrc).get('deep', 128);
		return deep === undefined || deep.data.length < 2 ? 0 : (deep.data[0]! << 8) | deep.data[1]!;
	} catch {
		return 0;
	}
}

/** The Scale submenu's first numbered item, after the two Largest That Fits and a line. */
const firstScaleItem = 4;

/** Puts the Scale submenu's items in again, for the page's size now: the page calls it when its window changes. */
export function RefreshScales(): void {
	const menu = made.get(mScale) ?? null;
	if (host === null || menu === null) {
		return;
	}
	while (CountMItems(menu) > 0) {
		DelMenuItem(menu, 1);
	}
	// The second's title is set apart: AppendMenu reads "(" as a metacharacter, which dims the item.
	AppendMenu(menu, 'Largest That Fits;Largest That Fits;(-');
	SetItem(menu, 2, 'Largest That Fits (Integer)');
	const scales = host.scales();
	if (scales.length > 0) {
		AppendMenu(menu, scales.map((s) => s.name).join(';'));
	}
	// Those that do not fit the window are dimmed, as art of the other kind is.
	scales.forEach((s, k) => {
		if (!s.fits) {
			DisableItem(menu, k + firstScaleItem);
		}
	});

	colorItems(menu);
	checkChoices();
}

/** Checks the current display, scale, and art again: for a program that opens its art after making its menus. */
export function CheckAdditions(): void {
	checkChoices();
}

/** Checks the current display, scale, and art. */
function checkChoices(): void {
	if (host === null) {
		return;
	}
	const display = made.get(mDisplay);
	if (display !== undefined) {
		displays.forEach(([d], k) => CheckItem(display, k + 1, d === host!.display));
	}
	const scale = made.get(mScale);
	if (scale !== undefined) {
		const factors = host.scales().map((s) => s.factor);
		CheckItem(scale, 1, host.scale === 0);
		CheckItem(scale, 2, host.scale === -1);
		factors.forEach((f, k) => CheckItem(scale, k + firstScaleItem, host!.scale === f));
	}
	const filtersMenu = made.get(mFilters);
	const filters = host.filters;
	if (filtersMenu !== undefined && filters !== undefined) {
		enlargements.forEach(([e], k) => CheckItem(filtersMenu, k + 1, filters.enlarge === e));
		touches.forEach(([t], k) => CheckItem(filtersMenu, enlargements.length + 2 + k, filters[t]));
	}
	const art = made.get(mArt);
	if (art !== undefined && artChoice !== null) {
		const current = artChoice.get().toUpperCase();
		artFiles.forEach((name, k) => CheckItem(art, k + 1, name.toUpperCase() === current));
	}
}

/**
 * Answers a choice from the additions' submenus. True if the program must quit to start again
 * (another Mac, or other art, which the program opens as it starts): the program then quits as its
 * Quit does, and AfterRestartQuit says whether it did.
 */
export function DoAdditionMenu(theMenu: Integer, theItem: Integer): boolean {
	if (host === null) {
		return false;
	}
	switch (theMenu) {
		case mDisplay: {
			const d = displays[theItem - 1]?.[0] ?? null;
			if (d === null || d === host.display) {
				return false;
			}
			if (host.changesAtOnce(d)) {
				host.setDisplay(d);
				checkChoices();
				return false;
			}
			host.restartOn(d);
			return true;
		}
		case mFilters: {
			const filters = host.filters;
			if (filters !== undefined) {
				const k = theItem - 1;
				const enlarge = enlargements[k]?.[0];
				const touch = touches[k - enlargements.length - 1]?.[0];
				if (enlarge !== undefined) {
					host.setFilters?.({ ...filters, enlarge });
				} else if (touch !== undefined) {
					host.setFilters?.({ ...filters, [touch]: !filters[touch] });
				}
				checkChoices();
			}
			return false;
		}
		case mScale: {
			const factor = theItem === 1 ? 0 : theItem === 2 ? -1 : (host.scales()[theItem - firstScaleItem]?.factor ?? null);
			if (factor !== null) {
				host.setScale(factor);
				checkChoices();
			}
			return false;
		}
		case mArt: {
			const name = artFiles[theItem - 1];
			if (artChoice === null || name === undefined || name.toUpperCase() === artChoice.get().toUpperCase()) {
				return false;
			}
			artBefore = artChoice.get();
			artChoice.set(name);
			host.restartOn(host.display);
			return true;
		}
		default:
			return false;
	}
}

/** After a choice that quits: if the program stays (the player cancelled), it stays as it was. */
export function AfterRestartQuit(quit: boolean): void {
	if (host === null || quit) {
		return;
	}
	host.restartOn(null);
	if (artBefore !== '' && artChoice !== null) {
		artChoice.set(artBefore);
	}
	artBefore = '';
}
