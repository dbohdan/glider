// Port: the gamepads of the port's additions (PORT.md, decision 14): the browser's (the Gamepad API)
// and the virtual one the page draws beside the Mac's screen. Glider's Controls submenu chooses
// them as control methods of their own (src/glider/Additions.ts); the page reads them
// (src/platform/browser/Pads.ts). What is here is the reading, apart from the browser, so that it
// can be tested.

/** What a gamepad says at a moment: how far it steers (−1 left to 1 right), and its buttons. */
export interface PadState {
	steer: number;
	energy: boolean;
	band: boolean;
	pause: boolean;
}

export const noPad: PadState = { steer: 0, energy: false, band: false, pause: false };

/** The parts of the Gamepad API's `Gamepad` read here. */
export interface GamepadLike {
	readonly mapping: string;
	readonly axes: readonly number[];
	readonly buttons: readonly { readonly pressed: boolean }[];
}

/** How far the stick may lean and still steer nothing: sticks rest a little off their middle. */
export const deadZone = 0.2;

// The buttons of the Gamepad API's standard mapping
// (https://w3c.github.io/gamepad/#remapping): the four face buttons, Start, and the D-pad.
const bottom = 0;
const right = 1;
const left = 2;
const top = 3;
const start = 9;
const dpadLeft = 14;
const dpadRight = 15;

/**
 * Reads the gamepads, all of them together. On the standard mapping, the D-pad steers at full
 * thrust and the left stick in proportion; the bottom and left face buttons energize, the right
 * and top ones fire bands, so that either hand position works; Start pauses. A gamepad the browser
 * does not map is read as if it were: its first axis, its first two buttons, its tenth.
 */
export function readGamepads(pads: readonly (GamepadLike | null)[]): PadState {
	const state = { ...noPad };
	for (const pad of pads) {
		if (pad === null) {
			continue;
		}
		const pressed = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
		const x = pad.axes[0] ?? 0;
		let steer = Math.abs(x) > deadZone ? (Math.sign(x) * (Math.abs(x) - deadZone)) / (1 - deadZone) : 0;
		if (pad.mapping === 'standard') {
			if (pressed(dpadLeft) !== pressed(dpadRight)) {
				steer = pressed(dpadLeft) ? -1 : 1;
			}
			state.energy ||= pressed(bottom) || pressed(left);
			state.band ||= pressed(right) || pressed(top);
		} else {
			state.energy ||= pressed(bottom);
			state.band ||= pressed(right);
		}
		state.pause ||= pressed(start);
		if (Math.abs(steer) > Math.abs(state.steer)) {
			state.steer = Math.max(-1, Math.min(1, steer));
		}
	}
	return state;
}

/**
 * The glider's thrust for a steer, in whole pixels a frame up to `most` either way, as Glider's
 * Mouse control gives it: any lean past the dead zone moves the glider at least a pixel.
 */
export function thrustOf(steer: number, most: number): number {
	if (steer === 0) {
		return 0;
	}
	return Math.sign(steer) * Math.max(1, Math.round(Math.abs(steer) * most));
}
