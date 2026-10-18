// Oracle cases: scripted sessions with the original game.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MacFile } from '../src/mac/MacBinary.ts';
import type { ResourceFork } from '../src/mac/ResourceFork.ts';
import { houseRecLayout } from '../src/glider/Globals.ts';
import { readLayout, writeLayout } from '../src/mac/PascalLayout.ts';
import { bundledFiles } from '../tools/build-resources.ts';
import { parseDeRez } from '../tools/DeRez.ts';
import { alternateScreenFile, editResources, glider406, macII, macPlus, makeDisk, oracleDir, type RunResult, run } from './Oracle.ts';
import { Script } from './Script.ts';

export const cases: Record<string, (dir: string) => RunResult> = {
	/** Boot into Glider 4.06 on a Mac Plus, dismiss the keyboard alert, and start a game. */
	boot(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), alternateScreenFile()], 'Glider 4.06');
		const s = new Script();
		s.until(900).shot('alert').press('return').wait(60).shot('title');
		s.press('n', 'command');
		for (let t = 0; t < 8; t++) {
			s.wait(30).shot(`game${t}`);
		}
		return run(macPlus, s, disk, dir);
	},

	/** Pull down Glider's menus on a Mac Plus, without choosing anything. */
	menus(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, menuScript(), disk, dir);
	},

	/** Where hierarchical menus appear and how long they take, on a Mac Plus. */
	menuDetails(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), alternateScreenFile()], 'Glider 4.06');
		const s = new Script();
		s.until(1800).press('return').wait(600);
		s.mouse(120, 10).wait(5).button(true).wait(15);
		s.mouse(120, 22).wait(40).shot('sub22');
		s.mouse(120, 44).wait(20).shot('sound');
		s.mouse(120, 34).wait(40).shot('sub34');
		s.mouse(120, 44).wait(20);
		s.mouse(120, 30);
		for (let t = 1; t <= 14; t++) {
			s.wait(1).shot(`delay${t}`);
		}
		s.mouse(300, 250).wait(15).button(false).wait(15).shot('released');
		return run(macPlus, s, disk, dir);
	},

	/** Glider's dialogs on a Mac Plus: Sound, Configure, About, each closed with Return. */
	dialogs(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, dialogScript(), disk, dir);
	},

	/** Glider's dialogs on a Mac II. */
	dialogsColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values()], 'Glider 4.06');
		return run(macII, dialogScript(), disk, dir);
	},

	/** A game on a Mac Plus, as the port plays it: a fast CPU, and Glider 4.05's preferences. */
	play(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, playScript(), disk, dir);
	},

	/** A game on a Mac II, as the port plays it. */
	playColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, playScript(), disk, dir);
	},

	/** Every tick of the alert going away and of a game starting, on a Mac Plus. */
	everyTick(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, everyTickScript(), disk, dir);
	},

	/** Every tick of the alert going away and of a game starting, on a Mac II. */
	everyTickColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, everyTickScript(), disk, dir);
	},

	/** A game on a Mac Plus, steered with the keyboard. */
	steer(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, steerScript(), disk, dir);
	},

	/** A game on a Mac II, steered with the keyboard. */
	steerColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, steerScript(), disk, dir);
	},

	/** A game on a Mac Plus steered with the mouse (the Controls menu's Mouse). */
	mouse(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, mouseScript(false), disk, dir);
	},

	/** A game on a Mac II steered with the mouse. */
	mouseColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, mouseScript(false), disk, dir);
	},

	/** A game on a Mac Plus steered with mouse movements (the Controls menu's Joystick). */
	joystick(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, mouseScript(true), disk, dir);
	},

	/** A game on a Mac II steered with mouse movements. */
	joystickColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, mouseScript(true), disk, dir);
	},

	/** A minute of a game played with random keys on a Mac Plus. */
	wander(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, wanderScript(1), disk, dir);
	},

	/** A minute of a game played with random keys on a Mac II. */
	wanderColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, wanderScript(1), disk, dir);
	},

	/** Glider's menus and dialogs, and a paused game, on a Mac Plus. */
	ui(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, interfaceScript(), disk, dir);
	},

	/** Glider's menus and dialogs, and a paused game, on a Mac II. */
	uiColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, interfaceScript(), disk, dir);
	},

	/** A long flight forward through the house on a Mac Plus. */
	tour(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, tourScript(), disk, dir);
	},

	/** A long flight forward through the house on a Mac II. */
	tourColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, tourScript(), disk, dir);
	},

	/** Pull down Glider's menus on a Mac II. */
	menusColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values()], 'Glider 4.06');
		return run(macII, menuScript(), disk, dir);
	},

	/** Boot into Glider 4.06 on a Mac II. */
	bootColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values()], 'Glider 4.06');
		const s = new Script();
		for (let t = 300; t <= 1800; t += 300) {
			s.until(t).shot(`t${t}`);
		}
		return run(macII, s, disk, dir);
	},
};

/** Dismisses the keyboard alert, then holds the button down over each menu and some items. */
function menuScript(): Script {
	const s = new Script();
	s.until(1800).shot('alert').press('return').wait(600).shot('title');
	s.mouse(20, 10).wait(5).button(true).wait(15).shot('apple');
	s.mouse(60, 10).wait(15).shot('game');
	s.mouse(60, 44).wait(15).shot('gameItem');
	s.mouse(120, 10).wait(15).shot('options');
	s.mouse(120, 28).wait(40).shot('controls');
	s.mouse(240, 44).wait(15).shot('controlsItem');
	s.mouse(300, 250).wait(15).shot('away');
	s.button(false).wait(30).shot('released');
	return s;
}

/** Opens Glider's dialogs from its menus and closes each with Return. */
function dialogScript(): Script {
	const s = new Script();
	s.until(1800).press('return').wait(600);
	// Options > Sound…
	s.mouse(120, 10).wait(5).button(true).wait(15).mouse(120, 44).wait(15).button(false).wait(90).shot('sound');
	s.press('return').wait(60).shot('soundClosed');
	// Options > Controls > Configure… (Command-K)
	s.press('k', 'command').wait(90).shot('configure');
	s.press('return').wait(60);
	// Apple > About Glider…
	s.mouse(20, 10).wait(5).button(true).wait(15).mouse(40, 28).wait(15).button(false).wait(120).shot('about');
	s.wait(100).shot('about2');
	s.press('return').wait(60).shot('aboutClosed');
	return s;
}

/** SetRect's arguments as THINK Pascal pushes them: MOVE.W #n,-(SP), or CLR.W -(SP) for 0. */
function setRectArgs(r: number[]): number[] {
	return r.flatMap((n) => (n === 0 ? [0x42, 0x67] : [0x3f, 0x3c, n >> 8, n & 0xff]));
}

/**
 * Where 4.06's code draws switches unlike 4.05's, which the port follows, as [CODE id, what, 4.06's
 * bytes, 4.05's]. 4.06 re-laid-out the switch sprites in its black-and-white art (docs/versions.md):
 * its source rectangles are 16 pixels wide where 4.05's light switch starts two pixels further left
 * and its thermostat and power switch are two wider, and DrawAllObjects narrows any switch in a house
 * to 16 pixels (`if right - left <> 16 then boundRect.right := boundRect.left + 16`, found by
 * disassembling it when the oracle's switches lost two columns). The oracle gets 4.05's art, so it
 * gets 4.05's code for it: the rectangles, and a branch that always skips the narrowing.
 */
const switches405: [number, string, number[], number[]][] = [
	[5, 'the light switch source', setRectArgs([144, 0, 160, 26]), setRectArgs([142, 0, 160, 26])],
	[5, 'the thermostat source', setRectArgs([144, 27, 160, 54]), setRectArgs([144, 27, 162, 54])],
	[5, 'the power switch source', setRectArgs([144, 82, 160, 108]), setRectArgs([144, 82, 162, 108])],
	// CMPI.W #16,D0; BEQ.B *+26 becomes BRA.B.
	[2, 'the switch narrowing', [0x0c, 0x40, 0x00, 0x10, 0x67, 0x18], [0x0c, 0x40, 0x00, 0x10, 0x60, 0x18]],
];

/** Glider 4.06's code with 4.05's switches (switches405). */
function withSwitches405(rf: ResourceFork): void {
	for (const [id, what, from, to] of switches405) {
		const code = rf.get('CODE', id)!;
		const bytes = Buffer.from(code.data);
		const at = bytes.indexOf(Buffer.from(from));
		if (at < 0 || bytes.indexOf(Buffer.from(from), at + 1) >= 0) {
			throw new Error(`4.06's code for ${what} is not in CODE ${id} exactly once`);
		}
		const data = new Uint8Array(code.data);
		data.set(to, at);
		rf.put({ ...code, data });
	}
}

/**
 * Glider 4.06's application with Glider 4.05's preferences (from Glider_405/Glider.r) and switches,
 * and the port's art and The House (4.06's black-and-white art has other sprites, and
 * its The House two more high scores), so that the game plays as the port's does.
 */
export function gameFiles(house?: Uint8Array): MacFile[] {
	const prefs = parseDeRez(readFileSync(join(oracleDir, '..', 'Glider_405', 'Glider.r'))).get('Gprf', 128)!;
	const port = new Map(bundledFiles().map((f) => [f.name, f]));
	return [...glider406().values()].map((f) => {
		if (f.name === 'Glider 4.06') {
			return editResources(f, (rf) => {
				rf.put({ ...prefs });
				withSwitches405(rf);
			});
		}
		if (f.name === 'The House' && house !== undefined) {
			return { ...port.get(f.name)!, data: house };
		}
		return port.get(f.name) ?? f;
	});
}

/** The rooms where test houses start games (see houseFrom), for the oracle's room cases. */
export const roomStarts = [9, 15, 22, 27, 35];

/**
 * The House with its rooms rotated so that a game starts in room `first`: rooms first to 40, then
 * 1 to first − 1. Objects that name rooms (stairs, transports) lead elsewhere than in the real
 * house, but the oracle and the port play the same file.
 */
export function houseFrom(first: number): Uint8Array {
	const bytes = new Uint8Array(readFileSync(join(oracleDir, '..', 'assets', 'houses', 'The House')));
	const house = readLayout(houseRecLayout, bytes, 0);
	const n = house.numberORooms;
	const rooms = Array.from({ length: n }, (_, i) => house.theRooms[((first - 1 + i) % n) + 1]!);
	rooms.forEach((r, i) => {
		house.theRooms[i + 1] = r;
	});
	writeLayout(houseRecLayout, house, bytes, 0);
	return bytes;
}

/** An object in a test room: its kind (Globals.ts) and where it goes, its size by default its sprite's. */
type TestObject = [kind: number, left: number, top: number, width: number, height: number];

/**
 * The House with its first room holding the given objects instead of its own, for the oracle to
 * show how the original draws them.
 */
export function houseWith(objects: TestObject[]): Uint8Array {
	const bytes = new Uint8Array(readFileSync(join(oracleDir, '..', 'assets', 'houses', 'The House')));
	const house = readLayout(houseRecLayout, bytes, 0);
	const room = house.theRooms[1]!;
	room.numberOObjects = objects.length;
	objects.forEach(([objectIs, left, top, width, height], i) => {
		room.theObjects[i + 1] = { objectIs, boundRect: { top, left, bottom: top + height, right: left + width }, amount: 0, extra: 0, isOn: false };
	});
	writeLayout(houseRecLayout, house, bytes, 0);
	return bytes;
}

/**
 * Test rooms: of sprites that Glider draws with CopyMask (the switches, whose 18-pixel cells do not
 * start on a word, at every alignment; sprites of other widths; and sprites stretched), and of
 * shelves, whose shadows are gray painted in a region.
 */
export const maskRooms: Record<string, TestObject[]> = {
	powerSwitches: Array.from({ length: 16 }, (_, i) => [28, (i < 8 ? 100 : 108) + 33 * (i % 8), i < 8 ? 60 : 140, 18, 26] as TestObject),
	lightSwitches: Array.from({ length: 16 }, (_, i) => [24, (i < 8 ? 100 : 108) + 33 * (i % 8), i < 8 ? 60 : 140, 18, 26] as TestObject),
	widths: [
		...[0, 1, 2, 3].map((j) => [36, 90 + 61 * j, 30, 41, 30] as TestObject),
		...[0, 1, 2, 3].map((j) => [33, 90 + 57 * j, 80, 38, 27] as TestObject),
		...[0, 1, 2, 3].map((j) => [43, 90 + 67 * j, 130, 45, 58] as TestObject),
		...[0, 1, 2, 3].map((j) => [42, 90 + 79 * j, 210, 63, 71] as TestObject),
	],
	// Every combination of odd and even left, top, width, and height.
	shelves: Array.from({ length: 16 }, (_, i) => [2, 40 + (i % 4) * 114 + (i & 1), 60 + Math.floor(i / 4) * 60 + ((i >> 1) & 1), 60 + ((i >> 2) & 1), 7 + ((i >> 3) & 1)] as TestObject),
	stretched: [
		[28, 100, 40, 18, 26],
		[28, 140, 40, 16, 26],
		[28, 180, 40, 21, 26],
		[28, 220, 40, 18, 20],
		[28, 260, 40, 18, 33],
		[28, 300, 40, 36, 52],
		[28, 360, 40, 9, 13],
		[36, 100, 120, 41, 30],
		[36, 160, 120, 30, 30],
		[36, 220, 120, 60, 30],
		[36, 300, 120, 41, 20],
		[36, 360, 120, 41, 45],
		[33, 100, 200, 38, 27],
		[33, 160, 200, 50, 40],
		[33, 230, 200, 20, 14],
		[33, 280, 200, 76, 54],
	],
};

/** A game started in a test room, seen as soon as the room is drawn and a second later. */
export function firstRoomScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(30).shot('room').wait(60).shot('later');
	return s;
}

for (const [name, objects] of Object.entries(maskRooms)) {
	/** A test room on a Mac Plus and on a Mac II. */
	cases[name] = (dir) => {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(houseWith(objects)), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, firstRoomScript(), disk, dir);
	};
	cases[`${name}Color`] = (dir) => {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(houseWith(objects)), 'Glider 4.06');
		return run(macII, firstRoomScript(), disk, dir);
	};
}

for (const first of roomStarts) {
	/** A minute of random keys from room `first`, on a Mac Plus and on a Mac II. */
	cases[`room${first}`] = (dir) => {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(houseFrom(first)), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, wanderScript(first), disk, dir);
	};
	cases[`room${first}Color`] = (dir) => {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(houseFrom(first)), 'Glider 4.06');
		return run(macII, wanderScript(first), disk, dir);
	};
}

/**
 * Starts a game the way the boot case does, with a CPU fast enough (256 times the instructions per
 * tick) that work takes no time, as in the port; then follows it for 10 seconds. The emulator
 * reports when the Mac saw each key, for the port to replay them then.
 */
export function playScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).shot('alert').press('return').wait(60).shot('title');
	s.press('n', 'command');
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`game${t}`);
	}
	return s;
}

/**
 * Dismisses the keyboard alert and starts a game as playScript does, with a screenshot after every
 * tick for 40 ticks from just before each key: the button's flash, the title screen coming back, and
 * the game's first frames.
 */
export function everyTickScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(898);
	for (let t = 0; t < 40; t++) {
		if (t === 2) {
			s.key('return', true);
		} else if (t === 5) {
			s.key('return', false);
		}
		s.shot(`a${s.tick}`).wait(1);
	}
	s.until(966).key('command', true).key('n', true);
	for (let t = 0; t < 40; t++) {
		if (t === 3) {
			s.key('n', false).key('command', false);
		}
		s.shot(`b${s.tick}`).wait(1);
	}
	return s;
}

/**
 * Starts a game as playScript does, then steers it with Glider's default keys (the "New keyboard"
 * alert resets the controls to them): period to fly forward, comma to go back, Return and space for
 * energy and a rubber band, then forward again into the next room.
 */
export function steerScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20).shot('start');
	const hold = (key: string, ticks: number, every: number, label: string): void => {
		s.key(key, true);
		for (let t = every; t <= ticks; t += every) {
			s.wait(every).shot(`${label}${t}`);
		}
		s.key(key, false).wait(6);
	};
	hold('.', 60, 10, 'right');
	hold(',', 40, 10, 'left');
	hold('return', 20, 10, 'energy');
	hold('space', 6, 6, 'band');
	s.wait(30).shot('band');
	hold('.', 240, 20, 'fly');
	return s;
}

/**
 * Starts a game as playScript does and flies forward (the period key) for 20 seconds, through rooms
 * and past their objects, then lets the glider drift until the game ends; types a name for the high
 * scores and presses Return, and follows the title screen with the high scores. A screenshot every
 * half second.
 */
export function tourScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20);
	s.key('.', true);
	for (let t = 0; t < 40; t++) {
		s.wait(30).shot(`t${t}`);
	}
	s.key('.', false);
	for (let t = 40; t < 60; t++) {
		s.wait(30).shot(`t${t}`);
	}
	s.type('Port').wait(30).shot('typed').press('return');
	for (let t = 60; t < 100; t++) {
		s.wait(30).shot(`t${t}`);
	}
	return s;
}

/**
 * Chooses a mouse control from the Options menu's Controls submenu (Mouse, or Joystick for
 * relative movements), starts a game, and steers it: with Mouse by placing the mouse right and left
 * of the screen's middle, with Joystick by moving it right and left; then the button for energy.
 * A screenshot every 10 ticks.
 */
export function mouseScript(joystick: boolean): Script {
	const s = new Script();
	s.speed(8).traceKeys().traceMouse();
	s.until(900).press('return').wait(60);
	s.mouse(120, 10).wait(5).button(true).wait(15).mouse(120, 28).wait(40).mouse(280, 28).wait(10);
	s.mouse(280, joystick ? 82 : 66).wait(15).button(false).wait(30);
	s.press('n', 'command').wait(20);
	let shot = 0;
	const shots = (ticks: number): void => {
		for (let t = 0; t < ticks; t += 10) {
			s.wait(10).shot(`m${shot++}`);
		}
	};
	shots(30);
	if (joystick) {
		// Movements in the ticks between frames: a Mac II's ADB mouse reports as a tick begins, and
		// whether the program sees the report in that tick (before the vertical blanking task copies
		// the mouse for it) or in the next one varies, but the next frame sees it either way.
		s.wait(1);
	}
	const steer = (dh: number, ticks: number): void => {
		if (joystick) {
			for (let t = 0; t < ticks; t += 2) {
				s.mouseBy(dh, 0).wait(2);
				if ((t + 2) % 10 === 0) {
					s.shot(`m${shot++}`);
				}
			}
		} else {
			s.mouse(256 + dh * 8, 160);
			shots(ticks);
		}
	};
	steer(10, 60);
	steer(-10, 60);
	steer(3, 40);
	s.button(true);
	shots(30);
	// Mini vMac holds back other input for 4 ticks after a button event (MasterMyEvtQLock).
	s.button(false);
	shots(10);
	steer(10, 120);
	return s;
}

/**
 * Starts a game as playScript does and plays it for a minute with keys chosen at random from a
 * seed: forward and back (period and comma) for a third to two thirds of a second, mostly forward;
 * drifting; energy (Return) and rubber bands (space) on the way. A screenshot every 20 ticks.
 */
export function wanderScript(seed: number): Script {
	// mulberry32
	let state = seed >>> 0;
	const random = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20);
	const start = s.tick;
	let shot = 0;
	let next = start + 20;
	/** Waits, taking the screenshots that fall due. */
	const wait = (ticks: number): void => {
		const end = s.tick + ticks;
		while (next <= end) {
			s.until(next).shot(`w${shot++}`);
			next += 20;
		}
		s.until(end);
	};
	while (s.tick < start + 3600) {
		const r = random();
		const ticks = 20 + Math.floor(random() * 21);
		const key = r < 0.55 ? '.' : r < 0.8 ? ',' : null;
		if (key !== null) {
			s.key(key, true);
		}
		if (random() < 0.15) {
			s.key('return', true);
			wait(6);
			s.key('return', false);
		}
		if (random() < 0.2) {
			s.key('space', true);
			wait(3);
			s.key('space', false);
		}
		wait(ticks);
		if (key !== null) {
			s.key(key, false);
		}
		wait(2);
	}
	return s;
}

/**
 * Goes through Glider's interface the way a player would: the title screen's messages (space), the
 * Sound and Configure dialogs, About, the high scores, the help screens, "Air is Invisible", and a
 * game paused with Tab and resumed.
 */
export function interfaceScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	/** Chooses the item at `v` from the menu whose title is at `h`. */
	const choose = (h: number, v: number): void => {
		s.mouse(h, 10).wait(5).button(true).wait(15).mouse(h, v).wait(15).button(false).wait(10);
	};
	for (let i = 0; i < 4; i++) {
		s.press('space').wait(30).shot(`message${i}`);
	}
	choose(120, 44); // Options > Sound…
	s.wait(60).shot('sound').press('return').wait(30).shot('soundClosed');
	s.press('k', 'command').wait(60).shot('configure').press('return').wait(30).shot('configureClosed');
	choose(20, 28); // Apple > About Glider…
	s.wait(60).shot('about').wait(120).shot('about2').press('return').wait(30).shot('aboutClosed');
	s.press('h', 'command').wait(60).shot('scores').press('return').wait(30).shot('scoresClosed');
	choose(120, 139); // Options > Help
	s.wait(60).shot('help0');
	for (let i = 1; i < 4; i++) {
		s.press('space').wait(60).shot(`help${i}`);
	}
	s.press('return').wait(30).shot('helpClosed');
	choose(120, 59); // Options > Air is Invisible
	s.wait(30).shot('air');
	s.press('n', 'command').wait(60).shot('game');
	s.press('tab').wait(60).shot('paused').wait(60).shot('paused2');
	s.press('tab').wait(60).shot('resumed').wait(60).shot('resumed2');
	return s;
}
