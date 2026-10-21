// Port: the port's additions to Glider (PORT.md, decision 14), in Glider's own style and from its
// own parts. The submenus every program has (src/additions/Additions.ts: Display & Keyboard, Scale,
// and Art, the art files on the disk, the other kind dimmed) in the Options menu after Controls,
// colored as Controls is. And Bass Beat, a
// checkbox in Sound Settings under Music On, as Glider for Windows has, which turns the bass during
// play off without the jingle on entering a room. And Sound Settings' 4-Channel is remembered.
//
// The additions are on only when the page gives a host (setAdditionsHost). The tests boot Glider
// without one, so that it stays as the oracle measures it.

import {
	AddResource,
	ChangedResource,
	ControlRecord,
	type ControlHandle,
	CountMItems,
	DelMCEntries,
	DialogRecord,
	Get1Resource,
	GetCtlValue,
	GetDItem,
	GetMCEntry,
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
	SetMCEntries,
	SizeWindow,
	UseResFile,
	CurResFile,
	WriteResource,
	checkBoxProc,
	chkCtrl,
	ctrlItem,
} from '../mac/Toolbox.ts';
import { PBoolean, PInteger, PRecord, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import { G, iControls, iHoldKeyboard, mControls, mOption, moveOptionItems } from './Globals.ts';
import { additionsHost, setSubmenu, SetUpSubmenus } from '../additions/Additions.ts';

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
	ReadWebPrefs();
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
	if (h !== null && h.data.length >= sizeOf(webPrefsLayout)) {
		bassBeat = readLayout(webPrefsLayout, h.data, 0).bassBeatIs;
	}
	UseResFile(save);
}

/** Writes the additions' preferences into Glider, as SavePrefs writes Glider's; only once one differs from its default. */
export function SaveWebPrefs(): void {
	if (additionsHost() === null) {
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
