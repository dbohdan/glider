// Port: the port's additions to Glider (PORT.md, decision 14), in Glider's own style and from its
// own parts. Three submenus of the Options menu after Controls, built like it: Machine (the Mac
// Plus, the Mac II in color or black and white, and the Mac II's screen in the colors of Glider for
// Windows), Scale, and Art (the art files on the disk, the other kind dimmed). And Bass Beat, a
// checkbox in Sound Settings under Music On, as Glider for Windows has, which turns the bass during
// play off without the jingle on entering a room.
//
// The additions are on only when the page gives a host (setAdditionsHost). The tests boot Glider
// without one, so that it stays as the oracle measures it.

import {
	AddResource,
	ChangedResource,
	CheckItem,
	ControlRecord,
	type ControlHandle,
	CountMItems,
	DelMCEntries,
	DelMenuItem,
	DialogRecord,
	DisableItem,
	Get1Resource,
	GetCtlValue,
	GetDItem,
	GetMCEntry,
	Handle,
	HideDItem,
	hMenuCmd,
	InsertMenu,
	InsMenuItem,
	type Integer,
	type ItemHandle,
	type MenuHandle,
	MoveControl,
	NewControl,
	NewMenu,
	ref,
	type Rect,
	SetCtlValue,
	SetDItem,
	SetItemCmd,
	SetItemMark,
	SetMCEntries,
	SizeWindow,
	AppendMenu,
	UseResFile,
	CurResFile,
	WriteResource,
	checkBoxProc,
	chkCtrl,
	ctrlItem,
} from '../mac/Toolbox.ts';
import { getVolume } from '../mac/Files.ts';
import { PBoolean, PInteger, PRecord, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import { parseResourceFork } from '../mac/ResourceFork.ts';
import { G, iControls, iHoldKeyboard, mControls, mOption, moveOptionItems } from './Globals.ts';

/** The machine and screen the page runs: the Mac II's screen may show Glider for Windows' colors. */
export type Display = 'plus' | 'ii' | 'ii-bw' | 'win-16' | 'win-256';

/** What the page does for the additions. */
export interface AdditionsHost {
	readonly display: Display;
	/** Whether the page can change to a display at once (a palette on the same Mac) rather than start the program again. */
	changesAtOnce(display: Display): boolean;
	/** Changes to a display at once. */
	setDisplay(display: Display): void;
	/** Once the program quits, starts it again on a display; null to go to the desktop, as Quit does. */
	restartOn(display: Display | null): void;
	/** The scales the page offers, whole device pixels to a Mac pixel: their names, and whether they fit the window now. */
	scales(): { factor: number; name: string; fits: boolean }[];
	/** The chosen scale's factor; 0 for the largest that fits. */
	readonly scale: number;
	setScale(factor: number): void;
}

let host: AdditionsHost | null = null;

/** Turns the additions on, for a page; before Glider starts. */
export function setAdditionsHost(h: AdditionsHost | null): void {
	host = h;
}

export const mMachine = 132; // Menu resource IDs, after Glider's
export const mScale = 133;
export const mArt = 134;
const submenus: [id: Integer, title: string][] = [
	[mMachine, 'Machine'],
	[mScale, 'Scale'],
	[mArt, 'Art'],
];

const displays: [Display | null, string][] = [
	['plus', 'Mac Plus'],
	['ii', 'Mac II, 16 Colors'],
	['ii-bw', 'Mac II, Black & White'],
	[null, '(-'],
	['win-16', 'Windows, 16 Colors'],
	['win-256', 'Windows, 256 Colors'],
];

/** The art files in the Art submenu, in its order. */
let artFiles: string[] = [];
/** The art Glider had before a choice that waits for it to start again. */
let artBefore = '';

/** The additions' submenus, which are no resources, by ID. */
const made = new Map<Integer, MenuHandle>();

/** A new submenu, among the hierarchical menus. */
function newSubmenu(id: Integer, title: string): MenuHandle {
	const m = NewMenu(id, title);
	InsertMenu(m, -1);
	made.set(id, m);
	return m;
}

/** Gives a submenu's items the colors of the Controls submenu's. */
function colorItems(m: MenuHandle): void {
	DelMCEntries(m.menuID, -98);
	const head = GetMCEntry(mControls, 0);
	if (head !== null) {
		SetMCEntries([{ ...head, mctID: m.menuID }]);
	}
	const item = GetMCEntry(mControls, iHoldKeyboard);
	for (let i = 1; item !== null && i <= CountMItems(m); i++) {
		SetMCEntries([{ ...item, mctID: m.menuID, mctItem: i }]);
	}
}

/** Puts the additions' submenus in the Options menu after Controls; after SetUpMenus has put in Glider's. */
export function SetUpAdditions(options: MenuHandle): void {
	if (host === null) {
		return;
	}
	moveOptionItems(submenus.length);
	// An item's colors stay with its number ('mctb' 130), so those after Controls move with them; the
	// new items take Controls' own.
	for (let i = CountMItems(options); i > iControls; i--) {
		const e = GetMCEntry(mOption, i);
		if (e !== null) {
			DelMCEntries(mOption, i);
			SetMCEntries([{ ...e, mctItem: i + submenus.length }]);
		}
	}
	InsMenuItem(options, submenus.map(([, title]) => title).join(';'), iControls);
	const controls = GetMCEntry(mOption, iControls);
	submenus.forEach(([id], k) => {
		const item = iControls + 1 + k;
		SetItemMark(options, item, id);
		SetItemCmd(options, item, hMenuCmd);
		if (controls !== null) {
			SetMCEntries([{ ...controls, mctItem: item }]);
		}
	});

	const machine = newSubmenu(mMachine, 'Machine');
	AppendMenu(machine, displays.map(([, name]) => name).join(';'));
	colorItems(machine);
	newSubmenu(mScale, 'Scale');
	RefreshScales();
	const art = newSubmenu(mArt, 'Art');
	const files = (getVolume()?.list() ?? [])
		.filter((f) => f.type === 'GLbk')
		.map((f) => ({ name: f.name, depth: artDepth(f.rsrc) }))
		.toSorted((a, b) => a.name.localeCompare(b.name));
	artFiles = files.map((f) => f.name);
	if (files.length > 0) {
		// AppendMenu's metacharacters would be read in a name; they are rare in a file's.
		AppendMenu(art, files.map((f) => f.name.replace(/[;^!</(]/g, ' ')).join(';'));
	}
	// Glider takes color art in color and black-and-white art in black and white ('deep' 128).
	const wanted = G.inColor ? 4 : 1;
	files.forEach((f, k) => {
		if (f.depth !== wanted) {
			DisableItem(art, k + 1);
		}
	});
	colorItems(art);
	ReadWebPrefs();
	checkChoices();
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

/** Puts the Scale submenu's items in again, for the page's size now: the page calls it when its window changes. */
export function RefreshScales(): void {
	const menu = submenuByID(mScale);
	if (host === null || menu === null) {
		return;
	}
	while (CountMItems(menu) > 0) {
		DelMenuItem(menu, 1);
	}
	AppendMenu(menu, 'Largest That Fits;(-');
	const scales = host.scales();
	if (scales.length > 0) {
		AppendMenu(menu, scales.map((s) => s.name).join(';'));
	}
	// Those that do not fit the window are dimmed, as art of the other kind is.
	scales.forEach((s, k) => {
		if (!s.fits) {
			DisableItem(menu, k + 3);
		}
	});
	colorItems(menu);
	checkChoices();
}

function submenuByID(id: Integer): MenuHandle | null {
	return made.get(id) ?? null;
}

/** Checks the current machine, scale, and art. */
function checkChoices(): void {
	if (host === null) {
		return;
	}
	const machine = submenuByID(mMachine);
	if (machine !== null) {
		displays.forEach(([d], k) => CheckItem(machine, k + 1, d === host!.display));
	}
	const scale = submenuByID(mScale);
	if (scale !== null) {
		const factors = host.scales().map((s) => s.factor);
		CheckItem(scale, 1, host.scale === 0);
		factors.forEach((f, k) => CheckItem(scale, k + 3, host!.scale === f));
	}
	const art = submenuByID(mArt);
	if (art !== null) {
		artFiles.forEach((name, k) => CheckItem(art, k + 1, name.toUpperCase() === G.resourceName.toUpperCase()));
	}
}

/**
 * Answers a choice from the additions' submenus. True if Glider must quit to start again (another
 * Mac, or other art, which Glider opens as it starts): HandleMenu then quits as Quit does, and
 * AfterRestartQuit says whether it did.
 */
export function DoAdditionMenu(theMenu: Integer, theItem: Integer): boolean {
	if (host === null) {
		return false;
	}
	switch (theMenu) {
		case mMachine: {
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
		case mScale: {
			const factor = theItem === 1 ? 0 : (host.scales()[theItem - 3]?.factor ?? null);
			if (factor !== null) {
				host.setScale(factor);
				checkChoices();
			}
			return false;
		}
		case mArt: {
			const name = artFiles[theItem - 1];
			if (name === undefined || name.toUpperCase() === G.resourceName.toUpperCase()) {
				return false;
			}
			artBefore = G.resourceName;
			G.resourceName = name; // Glider saves it in its preferences as it quits, and opens it as it starts
			host.restartOn(host.display);
			return true;
		}
		default:
			return false;
	}
}

/** After a choice that quits: if Glider stays (the player cancelled), it stays as it was. */
export function AfterRestartQuit(quit: boolean): void {
	if (host === null || quit) {
		return;
	}
	host.restartOn(null);
	if (artBefore !== '') {
		G.resourceName = artBefore;
	}
	artBefore = '';
}

// ---------------------------------------------------------------------------------------------
// Bass Beat

/**
 * The additions' preferences, a resource of Glider's beside its own 'Gprf' ('Wprf' 128, "Web
 * Edition preferences"), which the browser keeps and exports with them.
 */
const webPrefsLayout = PRecord({ version: PInteger, bassBeatIs: PBoolean });
const webPrefsType = 'Wprf';

let bassBeat = true;
let bassBeatBefore = true;

/** Whether the bass plays during a game (with Music on); always, without the additions. */
export function BassBeatOn(): boolean {
	return bassBeat;
}

function ReadWebPrefs(): void {
	const save = CurResFile();
	UseResFile(G.gliderResNum);
	const h = Get1Resource(webPrefsType, 128);
	if (h !== null && h.data.length >= sizeOf(webPrefsLayout)) {
		bassBeat = readLayout(webPrefsLayout, h.data, 0).bassBeatIs;
	}
	UseResFile(save);
}

/** Writes the additions' preferences into Glider, as SavePrefs writes Glider's; only once one differs from its default. */
export function SaveWebPrefs(): void {
	if (host === null) {
		return;
	}
	const save = CurResFile();
	UseResFile(G.gliderResNum);
	let h = Get1Resource(webPrefsType, 128);
	if (h === null && bassBeat) {
		UseResFile(save);
		return;
	}
	const data = new Uint8Array(sizeOf(webPrefsLayout));
	writeLayout(webPrefsLayout, { version: 1, bassBeatIs: bassBeat }, data, 0);
	if (h === null) {
		h = new Handle(data);
		AddResource(h, webPrefsType, 128, '');
	} else {
		h.data = data;
		ChangedResource(h);
	}
	WriteResource(h);
	UseResFile(save);
}

/** Bass Beat's item in Sound Settings, after Glider's 15. */
export const bassBeatItem = 16;
/** How far the items under Music On move down for it. */
const bassBeatRow = 18;

/**
 * Puts Bass Beat in Sound Settings ('DLOG' and 'DITL' 131) under Music On (item 4), moving the
 * channel buttons and the Okay and Cancel buttons down a row and the dialog with them. The dialog
 * is changed as it is made, not its resources, which Glider's file would keep.
 */
export function AddBassBeat(d: DialogRecord, musicItem: Integer, musicHidden: boolean): void {
	if (host === null) {
		return;
	}
	const kind = ref<Integer>(0);
	const h = ref<ItemHandle>(null);
	const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	for (const item of [1, 2, 14, 15]) {
		GetDItem(d, item, kind, h, box);
		const moved = { ...box, top: box.top + bassBeatRow, bottom: box.bottom + bassBeatRow };
		if (h.v instanceof ControlRecord) {
			MoveControl(h.v, moved.left, moved.top);
		}
		SetDItem(d, item, kind.v, h.v, moved);
	}
	GetDItem(d, musicItem, kind, h, box);
	const rect = { ...box, top: box.bottom, bottom: box.bottom + (box.bottom - box.top) };
	const box2 = d.portRect;
	SizeWindow(d, box2.right - box2.left, box2.bottom - box2.top + bassBeatRow, false);
	const control = NewControl(d, rect, 'Bass Beat', true, bassBeat ? 1 : 0, 0, 1, checkBoxProc, 0);
	d.items.push({ handle: control, rect, type: ctrlItem + chkCtrl });
	bassBeatBefore = bassBeat;
	if (musicHidden) {
		HideDItem(d, bassBeatItem);
	}
}

/** Answers a click in Sound Settings: Bass Beat's checkbox turns over. */
export function HitBassBeat(d: DialogRecord, itemHit: Integer): void {
	if (host === null || itemHit !== bassBeatItem) {
		return;
	}
	const kind = ref<Integer>(0);
	const h = ref<ItemHandle>(null);
	const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	GetDItem(d, bassBeatItem, kind, h, box);
	bassBeat = GetCtlValue(h.v as ControlHandle) === 0;
	SetCtlValue(h.v as ControlHandle, bassBeat ? 1 : 0);
}

/** Sound Settings' Cancel puts Bass Beat back. */
export function CancelBassBeat(): void {
	bassBeat = bassBeatBefore;
}
