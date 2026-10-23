// Port: the gamepads for Glider's Gamepad and Virtual Gamepad controls (src/glider/Additions.ts):
// the browser's (the Gamepad API), and five buttons drawn beside the Mac's screen, in the page's
// margins, never over the screen: at its sides in landscape, below it in portrait. They take
// touches and clicks alike (pointer events), each finger on its own, since play holds a direction
// and energy at once; a finger slid from one button to another moves to it. Their faces are the
// icons of Glider's Configure dialog ('ICON' 980 to 983); a pressed one's rounded rectangle goes
// black around its icon, a small change at its edge rather than a flash of the whole button. The
// arrows are on the left, on the right, or apart: ← and band on the left, energy and → on the
// right, energy on the side most often flown to. Apart, a finger on the seam between an arrow and
// the button beside it presses both, so one thumb steers and boosts. Each one's pause button is
// the Tab key, which pauses Glider and continues it.

import type { PadSide, PadsHost } from '../../additions/Additions.ts';
import { noPad, type PadState, readGamepads } from '../../additions/Pads.ts';
import { hostKeyDown, hostKeyUp } from '../../mac/Toolbox.ts';

type Action = 'left' | 'right' | 'energy' | 'band' | 'pause';

/** A 32-by-32 one-bit icon, as an 'ICON' resource: 4 bytes a row, the high bit leftmost. */
export type IconBits = Uint8Array;

const tabCode = 0x30;
const tabChar = 9;

/** The buttons' size, and the room around them, in CSS pixels. */
const button = 56;
const gap = 10;
const margin = 12;
/** How far into each button the seam between two reaches, in CSS pixels. */
const seam = 10;

/** The buttons on the screen's left and right for each side the arrows may be on. */
const layouts: Record<PadSide, [west: Action[], east: Action[]]> = {
	left: [
		['left', 'right'],
		['energy', 'band'],
	],
	right: [
		['energy', 'band'],
		['left', 'right'],
	],
	apart: [
		['left', 'band'],
		['energy', 'right'],
	],
};
/** The pairs pressed together on their seam in the apart layout, each left to right. */
const seams: [Action, Action][] = [
	['left', 'band'],
	['energy', 'right'],
];

/** Two bars, for the pause button, which has no icon of Glider's. */
function pauseIcon(): IconBits {
	const bits = new Uint8Array(128);
	for (let row = 7; row < 25; row++) {
		bits[row * 4 + 1] = 0x3e; // columns 10 to 14
		bits[row * 4 + 2] = 0x7c; // columns 17 to 21
	}
	return bits;
}

/** An icon as an image to put on a button, white with the icon's black pixels. */
function iconURL(bits: IconBits): string {
	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 32;
	const ctx = canvas.getContext('2d')!;
	const image = ctx.createImageData(32, 32);
	for (let i = 0; i < 32 * 32; i++) {
		const on = (bits[i >> 3]! & (0x80 >> (i & 7))) !== 0;
		image.data.fill(on ? 0 : 255, i * 4, i * 4 + 3);
		image.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(image, 0, 0);
	return canvas.toDataURL();
}

export interface PadsOptions {
	/** Glider's icons for the left, right, energy, and band buttons. */
	icons: Partial<Record<Action, IconBits>>;
	/** Called when the virtual gamepad shows, hides, or changes sides, to lay the page out again. */
	layout: () => void;
	/** Called on any input, to let waiting code run. */
	wake: () => void;
}

export class BrowserPads implements PadsHost {
	readonly touchScreen = matchMedia('(pointer: coarse)').matches;
	private readonly element = document.createElement('div');
	/** The buttons each pointer presses, by pointer ID. */
	private readonly pointers = new Map<number, Action[]>();
	private readonly buttons = new Map<Action, HTMLElement>();
	private readonly west = document.createElement('div');
	private readonly east = document.createElement('div');
	private gamepadOn = false;
	private side: PadSide | null = null;
	/** Whether the Tab key is down for a pause button. */
	private tabDown = false;
	private readonly o: PadsOptions;

	constructor(o: PadsOptions) {
		this.o = o;
		this.element.className = 'pad';
		this.element.hidden = true;
		const size = Math.round(32 * Math.max(1, Math.floor((button * 0.8 * (window.devicePixelRatio || 1)) / 32))) / (window.devicePixelRatio || 1);
		for (const action of ['left', 'right', 'energy', 'band', 'pause'] as const) {
			const b = document.createElement('div');
			b.className = 'pad-button';
			const bits = action === 'pause' ? pauseIcon() : o.icons[action];
			if (bits !== undefined) {
				b.style.backgroundImage = `url(${iconURL(bits)})`;
				b.style.backgroundSize = `${size}px ${size}px`;
			}
			b.setAttribute('aria-label', action);
			this.buttons.set(action, b);
		}
		this.west.className = 'pad-group pad-west';
		this.east.className = 'pad-group pad-east';
		const pause = document.createElement('div');
		pause.className = 'pad-group pad-pause';
		pause.append(this.buttons.get('pause')!);
		this.element.append(this.west, this.east, pause);
		document.body.append(this.element);

		const at = (e: PointerEvent): Action[] => {
			const rect = (a: Action): DOMRect => this.buttons.get(a)!.getBoundingClientRect();
			if (this.side === 'apart') {
				// The seam: the gap between a pair's buttons and `seam` pixels into each.
				for (const [a, b] of seams) {
					const ra = rect(a);
					const rb = rect(b);
					if (e.clientX >= ra.right - seam && e.clientX < rb.left + seam && e.clientY >= ra.top && e.clientY < ra.bottom) {
						return [a, b];
					}
				}
			}
			for (const [a] of this.buttons) {
				const r = rect(a);
				if (e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom) {
					return [a];
				}
			}
			return [];
		};
		this.element.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			this.element.setPointerCapture(e.pointerId);
			this.press(e.pointerId, at(e));
		});
		this.element.addEventListener('pointermove', (e) => {
			if (this.pointers.has(e.pointerId)) {
				this.press(e.pointerId, at(e));
			}
		});
		for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
			this.element.addEventListener(type, (e) => this.press(e.pointerId, [], true));
		}
		this.element.addEventListener('contextmenu', (e) => e.preventDefault());
		window.addEventListener('resize', () => this.orient());
		this.orient();
	}

	/** Puts a pointer on buttons, or none; `done` when the pointer is gone. */
	private press(pointerId: number, actions: Action[], done = false): void {
		if (done) {
			this.pointers.delete(pointerId);
		} else {
			this.pointers.set(pointerId, actions);
		}
		for (const [action, b] of this.buttons) {
			b.classList.toggle('pressed', this.held(action));
		}
		this.poll();
		this.o.wake();
	}

	private held(action: Action): boolean {
		for (const actions of this.pointers.values()) {
			if (actions.includes(action)) {
				return true;
			}
		}
		return false;
	}

	gamepad(): PadState {
		return this.gamepadOn ? readGamepads(navigator.getGamepads?.() ?? []) : noPad;
	}

	virtualPad(): PadState {
		if (this.side === null) {
			return noPad;
		}
		const left = this.held('left');
		const right = this.held('right');
		return { steer: left === right ? 0 : left ? -1 : 1, energy: this.held('energy'), band: this.held('band'), pause: this.held('pause') };
	}

	use(gamepad: boolean, virtual: PadSide | null): void {
		this.gamepadOn = gamepad;
		if (virtual !== this.side) {
			this.side = virtual;
			this.element.hidden = virtual === null;
			this.pointers.clear();
			if (virtual !== null) {
				const [west, east] = layouts[virtual];
				this.west.replaceChildren(...west.map((a) => this.buttons.get(a)!));
				this.east.replaceChildren(...east.map((a) => this.buttons.get(a)!));
				// Pause goes over the energy button's side.
				this.element.classList.toggle('pad-pause-west', west.includes('energy'));
			}
			this.o.layout();
		}
		this.poll();
	}

	/**
	 * Presses or lets go of Tab for the pause buttons; the page calls it every frame, as a gamepad's
	 * buttons are read, not reported.
	 */
	poll(): void {
		const pause = this.gamepad().pause || this.virtualPad().pause;
		if (pause !== this.tabDown) {
			this.tabDown = pause;
			if (pause) {
				hostKeyDown(tabCode, tabChar);
			} else {
				hostKeyUp(tabCode);
			}
			this.o.wake();
		}
	}

	/** The room the virtual gamepad takes from the screen's, in CSS pixels: beside it in landscape, below it in portrait. */
	reserve(): { width: number; height: number } {
		if (this.side === null) {
			return { width: 0, height: 0 };
		}
		return this.landscape() ? { width: 2 * (2 * margin + 2 * button + gap), height: 0 } : { width: 0, height: 2 * margin + 2 * button + gap };
	}

	private landscape(): boolean {
		return window.innerWidth > window.innerHeight;
	}

	private orient(): void {
		this.element.classList.toggle('pad-landscape', this.landscape());
		this.element.classList.toggle('pad-portrait', !this.landscape());
	}
}
