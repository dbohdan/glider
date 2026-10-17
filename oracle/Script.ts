// Scripts for the headless emulator (see minivmac/OSGLUHDL.c for the commands they compile to).

/** Mac virtual key codes (Apple Extended Keyboard layout; the emulator translates for the Plus keyboard). */
export const keyCodes: Record<string, number> = {
	a: 0x00, s: 0x01, d: 0x02, f: 0x03, h: 0x04, g: 0x05, z: 0x06, x: 0x07, c: 0x08, v: 0x09,
	b: 0x0b, q: 0x0c, w: 0x0d, e: 0x0e, r: 0x0f, y: 0x10, t: 0x11,
	'1': 0x12, '2': 0x13, '3': 0x14, '4': 0x15, '6': 0x16, '5': 0x17, '=': 0x18, '9': 0x19, '7': 0x1a,
	'-': 0x1b, '8': 0x1c, '0': 0x1d, ']': 0x1e, o: 0x1f, u: 0x20, '[': 0x21, i: 0x22, p: 0x23,
	return: 0x24, l: 0x25, j: 0x26, "'": 0x27, k: 0x28, ';': 0x29, '\\': 0x2a, ',': 0x2b, '/': 0x2c,
	n: 0x2d, m: 0x2e, '.': 0x2f, tab: 0x30, space: 0x31, '`': 0x32, delete: 0x33, enter: 0x4c, escape: 0x35,
	command: 0x37, shift: 0x38, capsLock: 0x39, option: 0x3a, control: 0x3b,
	left: 0x7b, right: 0x7c, down: 0x7d, up: 0x7e,
};

const shifted: Record<string, string> = {
	'!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
	_: '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`',
};

/** Ticks a key or button stays down, and the pause after it is released. */
const holdTicks = 3;

export type Modifier = 'command' | 'shift' | 'option' | 'control';

export class Script {
	lines: string[] = [];
	/** Ticks emulated so far. */
	tick = 0;
	/** Screenshots in order: their names and the ticks they were taken at. */
	shots: { name: string; tick: number }[] = [];

	wait(ticks: number): this {
		if (ticks > 0) {
			this.lines.push(`w ${ticks}`);
			this.tick += ticks;
		}
		return this;
	}

	/** Waits until the given tick (since power-on). */
	until(tick: number): this {
		if (tick < this.tick) {
			throw new Error(`tick ${tick} is in the past (now ${this.tick})`);
		}
		return this.wait(tick - this.tick);
	}

	key(name: string, down: boolean): this {
		const code = keyCodes[name];
		if (code === undefined) {
			throw new Error(`unknown key ${name}`);
		}
		this.lines.push(`k ${code} ${down ? 1 : 0}`);
		return this;
	}

	/** Presses and releases a key, holding modifiers. */
	press(name: string, ...modifiers: Modifier[]): this {
		for (const m of modifiers) {
			this.key(m, true);
		}
		this.key(name, true).wait(holdTicks).key(name, false);
		for (const m of modifiers) {
			this.key(m, false);
		}
		return this.wait(holdTicks);
	}

	/** Types text on a US keyboard. */
	type(text: string): this {
		for (const ch of text) {
			if (ch === ' ') {
				this.press('space');
			} else if (ch === '\r' || ch === '\n') {
				this.press('return');
			} else if (shifted[ch] !== undefined) {
				this.press(shifted[ch], 'shift');
			} else if (ch >= 'A' && ch <= 'Z') {
				this.press(ch.toLowerCase(), 'shift');
			} else {
				this.press(ch);
			}
		}
		return this;
	}

	mouse(h: number, v: number): this {
		this.lines.push(`m ${h} ${v}`);
		return this;
	}

	mouseBy(dh: number, dv: number): this {
		this.lines.push(`d ${dh} ${dv}`);
		return this;
	}

	button(down: boolean): this {
		this.lines.push(`b ${down ? 1 : 0}`);
		return this;
	}

	click(h: number, v: number): this {
		return this.mouse(h, v).wait(holdTicks).button(true).wait(holdTicks).button(false).wait(holdTicks);
	}

	/** Takes a screenshot of the screen as of the last tick. */
	shot(name: string): this {
		if (!/^[\w.-]+$/.test(name)) {
			throw new Error(`bad screenshot name ${name}`);
		}
		this.lines.push(`s ${name}`);
		this.shots.push({ name, tick: this.tick });
		return this;
	}

	/** Saves `count` bytes of RAM from `address` under `name`. */
	ram(address: number, count: number, name: string): this {
		this.lines.push(`r ${address} ${count} ${name}`);
		return this;
	}

	/** Runs 2^n times the instructions per tick: a faster CPU with the same clock. */
	speed(n: number): this {
		this.lines.push(`speed ${n}`);
		return this;
	}

	text(): string {
		return this.lines.join('\n') + '\nq\n';
	}
}
