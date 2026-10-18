// Port: the keyboard and mouse. Browser keys become Mac key codes and characters (a US layout);
// the Command key is ⌘ on a Mac and Control elsewhere.

import { hostKeyDown, hostKeyUp, keysDown, macRomanCode, mouse, mouseMoved, postOSEvent } from '../../mac/Toolbox.ts';

/** Mac virtual key codes by browser key code (the Apple Extended Keyboard's, as on the Mac II). */
const keyCodes: Record<string, number> = {
	KeyA: 0x00, KeyS: 0x01, KeyD: 0x02, KeyF: 0x03, KeyH: 0x04, KeyG: 0x05, KeyZ: 0x06, KeyX: 0x07, KeyC: 0x08, KeyV: 0x09,
	KeyB: 0x0b, KeyQ: 0x0c, KeyW: 0x0d, KeyE: 0x0e, KeyR: 0x0f, KeyY: 0x10, KeyT: 0x11,
	Digit1: 0x12, Digit2: 0x13, Digit3: 0x14, Digit4: 0x15, Digit6: 0x16, Digit5: 0x17, Equal: 0x18, Digit9: 0x19, Digit7: 0x1a,
	Minus: 0x1b, Digit8: 0x1c, Digit0: 0x1d, BracketRight: 0x1e, KeyO: 0x1f, KeyU: 0x20, BracketLeft: 0x21, KeyI: 0x22, KeyP: 0x23,
	Enter: 0x24, KeyL: 0x25, KeyJ: 0x26, Quote: 0x27, KeyK: 0x28, Semicolon: 0x29, Backslash: 0x2a, Comma: 0x2b, Slash: 0x2c,
	KeyN: 0x2d, KeyM: 0x2e, Period: 0x2f, Tab: 0x30, Space: 0x31, Backquote: 0x32, Backspace: 0x33, NumpadEnter: 0x4c, Escape: 0x35,
	ShiftLeft: 0x38, ShiftRight: 0x38, CapsLock: 0x39, AltLeft: 0x3a, AltRight: 0x3a,
	ArrowLeft: 0x7b, ArrowRight: 0x7c, ArrowDown: 0x7d, ArrowUp: 0x7e,
	Numpad0: 0x52, Numpad1: 0x53, Numpad2: 0x54, Numpad3: 0x55, Numpad4: 0x56, Numpad5: 0x57, Numpad6: 0x58, Numpad7: 0x59,
	Numpad8: 0x5b, Numpad9: 0x5c, NumpadDecimal: 0x41, NumpadMultiply: 0x43, NumpadAdd: 0x45, NumpadSubtract: 0x4e, NumpadDivide: 0x4b,
};

/** The Mac Plus keyboard's arrow keys have other codes. */
const plusArrows: Record<string, number> = { ArrowLeft: 0x46, ArrowRight: 0x42, ArrowDown: 0x48, ArrowUp: 0x4d };

const commandCode = 0x37;
const controlCode = 0x3b;

/** The character a key types, as a MacRoman code; 0 for keys that type none. */
function charCodeOf(e: KeyboardEvent): number {
	switch (e.key) {
		case 'Enter':
			return e.code === 'NumpadEnter' ? 3 : 13;
		case 'Backspace':
			return 8;
		case 'Tab':
			return 9;
		case 'Escape':
			return 27;
		case 'ArrowLeft':
			return 28;
		case 'ArrowRight':
			return 29;
		case 'ArrowUp':
			return 30;
		case 'ArrowDown':
			return 31;
	}
	if (e.key.length === 1) {
		return macRomanCode(e.key);
	}
	return 0;
}

export interface InputOptions {
	/** The element that shows the screen. */
	screen: HTMLElement;
	/** Screen pixels per Mac pixel. */
	scale: () => number;
	plusKeyboard: boolean;
	/** The Mac's screen size, in which the mouse stays. */
	width: number;
	height: number;
	/** Whether the program wants the pointer captured (it moves the mouse itself, as in a game played with the mouse). */
	capture: () => boolean;
	/** Called on any input, to let waiting code run. */
	wake: () => void;
}

export function attachInput(o: InputOptions): void {
	const isMac = /Mac/.test(navigator.platform);
	const codeOf = (e: KeyboardEvent): number | undefined => {
		if (e.code === (isMac ? 'MetaLeft' : 'ControlLeft') || e.code === (isMac ? 'MetaRight' : 'ControlRight')) {
			return commandCode;
		}
		if (isMac && (e.code === 'ControlLeft' || e.code === 'ControlRight')) {
			return controlCode;
		}
		// An arrow key is the arrow key whatever key sent it: remote desktops (xrdp) send the arrows
		// as the numeric keypad's with NumLock off ("Numpad4" for "ArrowLeft"), as do PC keypads.
		const key = e.key.startsWith('Arrow') ? e.key : e.code;
		return (o.plusKeyboard ? plusArrows[key] : undefined) ?? keyCodes[key];
	};
	window.addEventListener('keydown', (e) => {
		const code = codeOf(e);
		if (code === undefined) {
			return;
		}
		e.preventDefault();
		if (e.repeat) {
			return; // the Event Manager repeats keys itself
		}
		const isModifier = code >= 0x37 && code <= 0x3b;
		if (isModifier) {
			keysDown[code] = true;
		} else {
			hostKeyDown(code, charCodeOf(e));
		}
		o.wake();
	});
	window.addEventListener('keyup', (e) => {
		const code = codeOf(e);
		if (code === undefined) {
			return;
		}
		e.preventDefault();
		if (code >= 0x37 && code <= 0x3b) {
			keysDown[code] = false;
		} else {
			hostKeyUp(code, charCodeOf(e));
		}
		o.wake();
	});
	window.addEventListener('blur', () => {
		keysDown.fill(false);
	});
	const place = (e: MouseEvent): void => {
		const r = o.screen.getBoundingClientRect();
		const s = o.scale();
		mouse.where = { h: Math.floor((e.clientX - r.left) / s), v: Math.floor((e.clientY - r.top) / s) };
		mouseMoved();
	};
	// While the program wants it, the pointer is captured (Pointer Lock) on the next click or key
	// press, and the mouse moves by the pointer's movements from wherever the program put it;
	// otherwise the mouse is where the pointer is. Escape, or the program's no longer wanting it,
	// releases the pointer.
	const captured = (): boolean => document.pointerLockElement === o.screen;
	const capture = (): void => {
		if (o.capture() && !captured()) {
			Promise.resolve(o.screen.requestPointerLock()).catch(() => {});
		}
	};
	setInterval(() => {
		if (captured() && !o.capture()) {
			document.exitPointerLock();
		}
	}, 100);
	/** Movement not yet a whole Mac pixel. */
	const rest = { h: 0, v: 0 };
	const move = (e: MouseEvent): void => {
		const s = o.scale();
		rest.h += e.movementX / s;
		rest.v += e.movementY / s;
		const dh = Math.trunc(rest.h);
		const dv = Math.trunc(rest.v);
		rest.h -= dh;
		rest.v -= dv;
		// The Mac keeps the mouse on the screen.
		mouse.where = { h: Math.max(0, Math.min(o.width - 1, mouse.where.h + dh)), v: Math.max(0, Math.min(o.height - 1, mouse.where.v + dv)) };
		mouseMoved();
	};
	window.addEventListener('keydown', capture);
	window.addEventListener('mousemove', (e) => {
		if (captured()) {
			move(e);
		} else {
			place(e);
		}
		o.wake();
	});
	o.screen.addEventListener('mousedown', (e) => {
		e.preventDefault();
		if (!captured()) {
			place(e);
			capture();
		}
		mouse.button = true;
		postOSEvent(1, 0);
		o.wake();
	});
	window.addEventListener('mouseup', (e) => {
		if (!mouse.button) {
			return;
		}
		if (!captured()) {
			place(e);
		}
		mouse.button = false;
		postOSEvent(2, 0);
		o.wake();
	});
	o.screen.addEventListener('contextmenu', (e) => e.preventDefault());
}
