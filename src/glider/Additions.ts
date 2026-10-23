// Port: the port's additions to Glider (PORT.md, decision 14), in Glider's own style and from its
// own parts. The submenus every program has (src/additions/Additions.ts: Display & Keyboard, Scale,
// and Art, the art files on the disk, the other kind dimmed) in the Options menu after Controls,
// colored as Controls is. And Bass Beat, a
// checkbox in Sound Settings under Music On, as Glider for Windows has, which turns the bass during
// play off without the jingle on entering a room. And Sound Settings' 4-Channel is remembered. And
// two control methods in the Controls submenu after Joystick, now "Joystick (Mouse)": Gamepad, the
// browser's, and Virtual Gamepad, buttons the page draws beside the screen; Configure chooses the
// side of the virtual one's arrows.
//
// The additions are on only when the page gives a host (setAdditionsHost). The tests boot Glider
// without one, so that it stays as the oracle measures it.

import {
	AddResource,
	ChangedResource,
	ControlRecord,
	type ControlHandle,
	CheckItem,
	CountMItems,
	DelMCEntries,
	DialogRecord,
	Get1Resource,
	GetCtlValue,
	GetDItem,
	GetMCEntry,
	GetMenu,
	GetPicture,
	Handle,
	HideDItem,
	InsMenuItem,
	type Integer,
	type ItemHandle,
	type MenuHandle,
	MoveControl,
	NewControl,
	ref,
	type Rect,
	SetCtlValue,
	SetDItem,
	SetItem,
	SetMCEntries,
	SizeWindow,
	UseResFile,
	CurResFile,
	WriteResource,
	checkBoxProc,
	chkCtrl,
	ClipRect,
	ctrlItem,
	DrawPicture,
	GetClip,
	itemDisable,
	NewRgn,
	type Picture,
	SetClip,
	userItem,
	radCtrl,
	radioButProc,
	statText,
} from '../mac/Toolbox.ts';
import { PBoolean, PInteger, PRecord, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import { addControlItems, G, iControls, iGamepad, iHoldKeyboard, iLastControl, iRelMouse, iVirtualPad, mControls, mOption, moveOptionItems } from './Globals.ts';
import { additionsHost, type PadSide, setSubmenu, SetUpSubmenus } from '../additions/Additions.ts';
import { noPad, type PadState } from '../additions/Pads.ts';

export { AfterRestartQuit, DoAdditionMenu } from '../additions/Additions.ts';

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
	if (additionsHost() === null) {
		return;
	}
	const submenus = SetUpSubmenus(
		{
			get: () => G.resourceName,
			set: (name) => {
				G.resourceName = name; // Glider saves it in its preferences as it quits, and opens it as it starts
			},
			inColor: G.inColor,
		},
		colorItems,
	);
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
		setSubmenu(options, item, id);
		if (controls !== null) {
			SetMCEntries([{ ...controls, mctItem: item }]);
		}
	});
	SetUpControls(GetMenu(mControls)!);
	ReadWebPrefs();
	UsePads();
}

// ---------------------------------------------------------------------------------------------
// Bass Beat

/**
 * The additions' preferences, a resource of Glider's beside its own 'Gprf' ('Wprf' 128, "Web
 * Edition preferences"), which the browser keeps and exports with them. Version 1 had Bass Beat;
 * version 2 adds the control method and the virtual gamepad's side.
 */
const webPrefsLayout1 = PRecord({ version: PInteger, bassBeatIs: PBoolean });
const webPrefsLayout = PRecord({ version: PInteger, bassBeatIs: PBoolean, controlIs: PInteger, padSideIs: PInteger });
const webPrefsType = 'Wprf';

let bassBeat = true;
let bassBeatBefore = true;

/**
 * Whether Glider takes Sound Settings' 4-Channel from its preferences as it starts. Glider 4.05
 * saves the choice but, as it starts, writes over the saved one instead of reading it (its own
 * comment calls the field "presently un-used"), so it always starts in 2-Channel; the additions
 * read it. Without them, Glider stays as the oracle measures it.
 */
export function RemembersChannels(): boolean {
	return additionsHost() !== null;
}

/** Whether the bass plays during a game (with Music on); always, without the additions. */
export function BassBeatOn(): boolean {
	return bassBeat;
}

function ReadWebPrefs(): void {
	const save = CurResFile();
	UseResFile(G.gliderResNum);
	const h = Get1Resource(webPrefsType, 128);
	let control = 0;
	if (h !== null && h.data.length >= sizeOf(webPrefsLayout1)) {
		bassBeat = readLayout(webPrefsLayout1, h.data, 0).bassBeatIs;
		if (h.data.length >= sizeOf(webPrefsLayout)) {
			const prefs = readLayout(webPrefsLayout, h.data, 0);
			control = prefs.controlIs;
			padSide = padSides[prefs.padSideIs]?.[0] ?? 'left';
		}
	}
	UseResFile(save);
	// The control method Glider read from its own preferences, unless the additions' say another; a
	// touch screen starts with the Virtual Gamepad.
	if (control < iHoldKeyboard || control > iLastControl) {
		control = startingControl(G.controlMethod);
	}
	for (let i = iHoldKeyboard; i <= iLastControl; i++) {
		CheckItem(GetMenu(mControls)!, i, false);
	}
	G.controlMethod = control;
}

/** The control method Glider starts with when the additions' preferences have none: its own's, or on a touch screen, the Virtual Gamepad. */
function startingControl(fromGprf: Integer): Integer {
	return additionsHost()?.pads?.touchScreen === true ? iVirtualPad : fromGprf;
}

/** Writes the additions' preferences into Glider, as SavePrefs writes Glider's; only once one differs from its default. */
export function SaveWebPrefs(): void {
	if (additionsHost() === null) {
		return;
	}
	const save = CurResFile();
	UseResFile(G.gliderResNum);
	let h = Get1Resource(webPrefsType, 128);
	if (h === null && bassBeat && padSide === 'left' && G.controlMethod === startingControl(OriginalControl(G.controlMethod))) {
		UseResFile(save);
		return;
	}
	const data = new Uint8Array(sizeOf(webPrefsLayout));
	writeLayout(webPrefsLayout, { version: 2, bassBeatIs: bassBeat, controlIs: G.controlMethod, padSideIs: padSides.findIndex(([side]) => side === padSide) }, data, 0);
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
	if (additionsHost() === null) {
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
	if (additionsHost() === null || itemHit !== bassBeatItem) {
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

// ---------------------------------------------------------------------------------------------
// Gamepad and Virtual Gamepad

/** The side of the virtual gamepad's arrows. */
let padSide: PadSide = 'left';
/** The side Configure shows, until its Okay. */
let newPadSide: PadSide = 'left';

/**
 * Puts the additions' control methods in the Controls submenu ('MENU' 131) after Joystick, which
 * is renamed for what it is, a mouse used as a joystick. The items after it (the line, Configure)
 * move down, their colors ('mctb' 131) with them; the new items take Joystick's.
 */
function SetUpControls(controls: MenuHandle): void {
	SetItem(controls, iRelMouse, 'Joystick (Mouse)');
	const added = 2;
	for (let i = CountMItems(controls); i > iRelMouse; i--) {
		const e = GetMCEntry(mControls, i);
		if (e !== null) {
			DelMCEntries(mControls, i);
			SetMCEntries([{ ...e, mctItem: i + added }]);
		}
	}
	InsMenuItem(controls, 'Gamepad;Virtual Gamepad', iRelMouse);
	const joystick = GetMCEntry(mControls, iRelMouse);
	if (joystick !== null) {
		SetMCEntries([iGamepad, iVirtualPad].map((item) => ({ ...joystick, mctItem: item })));
	}
	addControlItems(added);
}

/**
 * The control method Glider's own preferences keep: the additions' methods are kept as Hold
 * Keyboard, which their keys work as, so that the original reading the preferences has a control;
 * the additions' preferences keep the method itself.
 */
export function OriginalControl(method: Integer): Integer {
	return method > iRelMouse ? iHoldKeyboard : method;
}

/** Tells the page which gamepads Glider reads now, as the control method changes. */
export function UsePads(): void {
	additionsHost()?.pads?.use(G.controlMethod === iGamepad, G.controlMethod === iVirtualPad ? padSide : null);
}

/** What the chosen gamepad says this frame; nothing for Glider's own control methods. */
export function PadInput(): PadState {
	const pads = additionsHost()?.pads;
	if (pads === undefined) {
		return noPad;
	}
	return G.controlMethod === iGamepad ? pads.gamepad() : G.controlMethod === iVirtualPad ? pads.virtualPad() : noPad;
}

/** The virtual gamepad's sides, in Configure's radio buttons and the additions' preferences' order. */
const padSides: [PadSide, string][] = [
	['left', 'Arrows Left'],
	['right', 'Arrows Right'],
	['apart', 'Arrows Apart'],
];
/** Configure's first radio button for the side, after Glider's 15 items, its label (16) and brace (17). */
const padFirstItem = 18;
/** How far the group is below Mouse Button's, and how far Configure grows for it: a row more than Mouse Button's two. */
const padRow = 36;
const padGrowth = padRow + 16;

/**
 * Puts "Virtual Pad: { Arrows Left / Arrows Right / Arrows Apart }" in Configure ('DLOG' and
 * 'DITL' 137) under Mouse Button's group, made as that one is: a label, the brace (its 'PICT' 256,
 * drawn taller), radio buttons. The dialog grows; as it is made, before Glider
 * centers it.
 */
export function AddPadSide(d: DialogRecord): void {
	if (additionsHost() === null) {
		return;
	}
	const kind = ref<Integer>(0);
	const h = ref<ItemHandle>(null);
	const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const below = (item: Integer): Rect => {
		GetDItem(d, item, kind, h, box);
		return { ...box, top: box.top + padRow, bottom: box.bottom + padRow };
	};
	const rows = padSides.length - 2; // the rows past Mouse Button's two
	const label = below(14);
	label.top += 8 * rows; // centered on the group, as Mouse Button's label is on its
	label.bottom += 8 * rows;
	const brace = below(15);
	brace.bottom += 16 * rows;
	const bracePicture = GetPicture(256);
	// The radio buttons' titles are longer than Mouse Button's; under the Okay button there is room.
	const first = { ...below(12), right: 190 };
	const text = new Handle(Uint8Array.from('Virtual Pad:', (c) => c.charCodeAt(0)));
	d.items.push({ handle: text, rect: label, type: statText + itemDisable });
	d.items.push({ handle: () => drawBrace(bracePicture, brace), rect: brace, type: userItem + itemDisable });
	newPadSide = padSide;
	padSides.forEach(([side, title], k) => {
		const rect = { ...first, top: first.top + 16 * k, bottom: first.bottom + 16 * k };
		const control = NewControl(d, rect, title, true, newPadSide === side ? 1 : 0, 0, 1, radioButProc, 0);
		d.items.push({ handle: control, rect, type: ctrlItem + radCtrl });
	});
	const port = d.portRect;
	SizeWindow(d, port.right - port.left, port.bottom - port.top + padGrowth, false);
}

/** Rows of the brace ('PICT' 256, 31 pixels tall) in its straight parts, above its point and below. */
const braceAbove = 7;
const braceBelow = 23;
const braceHeight = 31;

/**
 * Draws the brace, made for two lines, as tall as a box: its straight parts are made longer, half
 * the extra rows above its point and half below, each a copy of a straight row. In pieces, each
 * piece the picture drawn at its own size and clipped to the piece's rows: stretching the picture
 * would thicken its curves.
 */
function drawBrace(picture: Picture | null, box: Rect): void {
	if (picture === null) {
		return;
	}
	const extra = box.bottom - box.top - braceHeight;
	const above = extra >> 1;
	const below = extra - above;
	const save = NewRgn();
	GetClip(save);
	const piece = (offset: Integer, fromRow: Integer, toRow: Integer): void => {
		const top = box.top + offset;
		ClipRect({ top: box.top + fromRow, left: box.left, bottom: box.top + toRow, right: box.right });
		DrawPicture(picture, { top, left: box.left, bottom: top + braceHeight, right: box.right });
	};
	piece(0, 0, braceAbove + 1);
	for (let i = 1; i <= above; i++) {
		piece(i, braceAbove + i, braceAbove + i + 1);
	}
	piece(above, braceAbove + 1 + above, braceBelow + 1 + above);
	for (let i = 1; i <= below; i++) {
		piece(above + i, braceBelow + above + i, braceBelow + above + i + 1);
	}
	piece(extra, braceBelow + 1 + extra, braceHeight + extra);
	SetClip(save);
}

/** Answers a click in Configure: an Arrows radio button is chosen. */
export function HitPadSide(d: DialogRecord, itemHit: Integer): void {
	const chosen = padSides[itemHit - padFirstItem];
	if (additionsHost() === null || chosen === undefined) {
		return;
	}
	newPadSide = chosen[0];
	const kind = ref<Integer>(0);
	const h = ref<ItemHandle>(null);
	const box: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	padSides.forEach((_, k) => {
		GetDItem(d, padFirstItem + k, kind, h, box);
		SetCtlValue(h.v as ControlHandle, padFirstItem + k === itemHit ? 1 : 0);
	});
}

/** Configure's Okay keeps the side chosen. */
export function KeepPadSide(): void {
	padSide = newPadSide;
	UsePads();
}
