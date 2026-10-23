// Port: the port's additions to the Room Editor (PORT.md, decision 14) beyond the Options menu every
// program has (src/additions/Additions.ts): Gamepad in the Controls submenu ('MENU' 133) after
// Joystick, now "Joystick (Mouse)", for test flights, as Glider has it (src/glider/Additions.ts).
// The editor's preferences ('Gprf') keep a control the original knows; the additions' ('Wprf' 128,
// in the editor's file as Glider's are in Glider's) keep the gamepad.
//
// The additions are on only when the page gives a host (setAdditionsHost). The tests boot the
// editor without one, so that it stays as the oracle measures it.

import {
	AddResource,
	ChangedResource,
	CheckItem,
	CurResFile,
	Get1Resource,
	GetMenu,
	Handle,
	InsMenuItem,
	type Integer,
	SetItem,
	UseResFile,
	WriteResource,
} from '../mac/Toolbox.ts';
import { PInteger, PRecord, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import { additionsHost } from '../additions/Additions.ts';
import { noPad, type PadState } from '../additions/Pads.ts';
import { addControlItems, G, iGamepad, iHoldKey, iLastControl, iRelMouse, mControls } from './Globals.ts';

/** The additions' preferences: the control method, which may be the gamepad. */
const webPrefsLayout = PRecord({ version: PInteger, controlIs: PInteger });
const webPrefsType = 'Wprf';

/**
 * Puts Gamepad in the Controls submenu after Joystick, which is renamed for what it is, a mouse
 * used as a joystick; the line and Configure move down. Then takes the control method from the
 * additions' preferences, if they have one: after the editor has read its own.
 */
export function SetUpAdditions(): void {
	if (additionsHost() === null) {
		return;
	}
	const controls = GetMenu(mControls)!;
	SetItem(controls, iRelMouse, 'Joystick (Mouse)');
	InsMenuItem(controls, 'Gamepad', iRelMouse);
	addControlItems(1);
	const save = CurResFile();
	UseResFile(G.editorResNum);
	const h = Get1Resource(webPrefsType, 128);
	UseResFile(save);
	if (h !== null && h.data.length >= sizeOf(webPrefsLayout)) {
		const control = readLayout(webPrefsLayout, h.data, 0).controlIs;
		if (control >= iHoldKey && control <= iLastControl) {
			for (let i = iHoldKey; i <= iLastControl; i++) {
				CheckItem(controls, i, false);
			}
			G.controlMethod = control;
			CheckItem(controls, control, true);
		}
	}
	UsePads();
}

/** The control method the editor's own preferences keep: the gamepad as Hold Keyboard, whose keys work with it. */
export function OriginalControl(method: Integer): Integer {
	return method > iRelMouse ? iHoldKey : method;
}

/** Writes the additions' preferences into the editor, as SavePrefs writes its own; only once the gamepad has been chosen. */
export function SaveWebPrefs(): void {
	if (additionsHost() === null) {
		return;
	}
	const save = CurResFile();
	UseResFile(G.editorResNum);
	let h = Get1Resource(webPrefsType, 128);
	if (h === null && G.controlMethod !== iGamepad) {
		UseResFile(save);
		return;
	}
	const data = new Uint8Array(sizeOf(webPrefsLayout));
	writeLayout(webPrefsLayout, { version: 1, controlIs: G.controlMethod }, data, 0);
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

/** Tells the page whether the editor reads the gamepad now, as the control method changes. */
export function UsePads(): void {
	additionsHost()?.pads?.use(G.controlMethod === iGamepad, null);
}

/** What the gamepad says this frame; nothing for the editor's own control methods. */
export function PadInput(): PadState {
	const pads = additionsHost()?.pads;
	return pads !== undefined && G.controlMethod === iGamepad ? pads.gamepad() : noPad;
}
