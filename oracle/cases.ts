// Oracle cases: scripted sessions with the original game.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MacFile } from '../src/mac/MacBinary.ts';
import { type ResourceFork, writeResourceFork } from '../src/mac/ResourceFork.ts';
import { houseRecLayout } from '../src/glider/Globals.ts';
import { readLayout, writeLayout } from '../src/mac/PascalLayout.ts';
import { bundledFiles } from '../tools/build-resources.ts';
import { parseDeRez } from '../tools/DeRez.ts';
import { alternateScreenFile, editResources, glider406, macII, macPlus, makeDisk, oracleDir, roomEditor104, type RunResult, run } from './Oracle.ts';
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

	/** Start the Room Editor 1.04 on a Mac Plus, beside Glider's files. */
	editorBoot(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), roomEditor104()], 'Room Editor', 8, 'root');
		return run(macPlus, editorBootScript(), disk, dir);
	},

	/** Start the Room Editor 1.04 on a Mac II. */
	editorBootColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), roomEditor104()], 'Room Editor', 8, 'root');
		return run(macII, editorBootScript(), disk, dir);
	},

	/** The Room Editor on a Mac Plus: a new house's first room, from the Open House dialog. */
	editorNewHouse(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), roomEditor104()], 'Room Editor', 8, 'root');
		return run(macPlus, editorNewHouseScript('plus'), disk, dir);
	},

	/** The Room Editor on a Mac Plus: Try Glider in a new house's first room. */
	editorTryGlider(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), roomEditor104()], 'Room Editor', 8, 'root');
		return run(macPlus, editorTryGliderScript('plus'), disk, dir);
	},

	/** The Room Editor on a Mac II: Try Glider. */
	editorTryGliderColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), roomEditor104()], 'Room Editor', 8, 'root');
		return run(macII, editorTryGliderScript('ii'), disk, dir);
	},

	/** The Room Editor on a Mac II: a new house's first room. */
	editorNewHouseColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...glider406().values(), roomEditor104()], 'Room Editor', 8, 'root');
		return run(macII, editorNewHouseScript('ii'), disk, dir);
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

	/** Keys held in the high-score dialog until a repeat falls due, on a Mac Plus. */
	repeats(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, repeatScript(), disk, dir);
	},

	/** Keys held in the high-score dialog until a repeat falls due, on a Mac II. */
	repeatsColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(), 'Glider 4.06');
		return run(macII, repeatScript(), disk, dir);
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

/**
 * The House cut to its first room, which opens on the right, with `nextFile` as the file that
 * follows it: flying out of the room loads the next file, or with none ends the game with the
 * closing animation (AdvanceARoom).
 */
export function houseOfOneRoom(nextFile: string): Uint8Array {
	const bytes = new Uint8Array(readFileSync(join(oracleDir, '..', 'assets', 'houses', 'The House')));
	const house = readLayout(houseRecLayout, bytes, 0);
	house.numberORooms = 1;
	house.nextFile = nextFile;
	writeLayout(houseRecLayout, house, bytes, 0);
	return bytes;
}

/** Houses that end after their first room, by the file that follows them (see houseOfOneRoom). */
export const houseEnds: Record<string, string> = { nextHouse: 'The House 2', ending: '' };

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

/**
 * Starts a game and flies forward (the period key) for 10 seconds, out of the first room, then lets
 * go for 40 seconds more: the next file's rooms, or the closing animation and the game's end; types
 * a name in case of a high score. A screenshot every half second.
 */
export function houseEndScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20);
	s.key('.', true);
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`t${t}`);
	}
	s.key('.', false);
	for (let t = 20; t < 100; t++) {
		s.wait(30).shot(`t${t}`);
	}
	s.type('Port').wait(30).shot('typed').press('return');
	for (let t = 100; t < 110; t++) {
		s.wait(30).shot(`t${t}`);
	}
	return s;
}

/**
 * Starts a game, flies a little, and saves it (Command-S), typing "Game" in Standard File's dialog;
 * plays on, ends the game (Command-E), and opens the saved game from the Game menu (Load Game…),
 * whose dialog lists only it; the run keeps the saved game. The dialog takes the keys still in the
 * event queue before those typed into it, the period that flew the glider and the S of Command-S
 * (Glider reads the keys with GetKeys and leaves their events), so the game is saved as ".sGame",
 * in the disk's root, Standard File's directory. A screenshot every half second, and of each dialog
 * of Standard File. With `probe`, the emulator also reports the traps the program calls from just
 * before each dialog to after it.
 */
export function savedGameScript(probe = false): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20);
	s.key('.', true);
	for (let t = 0; t < 6; t++) {
		s.wait(30).shot(`g${t}`);
	}
	s.key('.', false);
	if (probe) {
		s.traceTraps(true);
	}
	s.press('s', 'command').wait(60).shot('saveDialog').type('Game').wait(10).shot('saveTyped').press('return');
	for (let t = 0; t < 10; t++) {
		s.wait(30).shot(`s${t}`);
		if (probe && t === 1) {
			s.traceTraps(false);
		}
	}
	s.press('e', 'command');
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`e${t}`);
	}
	if (probe) {
		s.traceTraps(true);
	}
	s.mouse(60, 10).wait(5).button(true).wait(15).mouse(60, 92).wait(15).button(false).wait(60); // Game > Load Game…
	s.shot('openDialog').press('return');
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`l${t}`);
		if (probe && t === 1) {
			s.traceTraps(false);
		}
	}
	return s;
}

/**
 * Ends the house as houseEndScript does, then types a name longer than the high-score dialog's
 * field, 104 letters, a screenshot after each, and backspaces four of them: the field scrolls
 * sideways, and once the text wraps at twice the field's width, starts over on the second line.
 */
export function longNameScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20);
	s.key('.', true).wait(600).key('.', false).wait(2400).shot('dialog');
	const letters = 'abcdefghijklmnopqrstuvwxyz'.repeat(4);
	for (let i = 0; i < letters.length; i++) {
		s.press(letters[i]!).wait(4).shot(`letter${String(i + 1).padStart(3, '0')}`);
	}
	for (let i = 1; i <= 4; i++) {
		s.press('delete').wait(4).shot(`back${i}`);
	}
	return s;
}

/** A long name typed into the high-score dialog, on a Mac Plus and on a Mac II. */
cases.longName = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, [...gameFiles(houseOfOneRoom('')), alternateScreenFile()], 'Glider 4.06');
	return run(macPlus, longNameScript(), disk, dir);
};
cases.longNameColor = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, gameFiles(houseOfOneRoom('')), 'Glider 4.06');
	return run(macII, longNameScript(), disk, dir);
};

for (const [name, nextFile] of Object.entries(houseEnds)) {
	/** A house that ends after its first room, on a Mac Plus and on a Mac II. */
	cases[name] = (dir) => {
		const disk = dir + '.dsk';
		makeDisk(disk, [...gameFiles(houseOfOneRoom(nextFile)), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, houseEndScript(), disk, dir);
	};
	cases[`${name}Color`] = (dir) => {
		const disk = dir + '.dsk';
		makeDisk(disk, gameFiles(houseOfOneRoom(nextFile)), 'Glider 4.06');
		return run(macII, houseEndScript(), disk, dir);
	};
}

/**
 * Changes Glider's settings and plays with them: in Sound Settings, the volume up four steps (from
 * 1, the oracle's), Music off, and 4-Channel; in Configure, Z and X for left and right, and the button to fire bands;
 * then a game steered with Z and X, its sound recorded; then Command-Q, after which Glider has
 * written its preferences into its own file, which the run keeps. The dialogs are centered on the
 * screen, so their items are at other places on each machine.
 */
export function settingsScript(kind: 'plus' | 'ii'): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	if (kind === 'ii') {
		s.traceMouse();
	}
	/** A point of a dialog item, from the dialog's place (Sound Settings, DLOG 131; Configure, 137). */
	const at = (dialog: 131 | 137, h: number, v: number): [number, number] => {
		const [left, top] = dialog === 131 ? (kind === 'plus' ? [120, 88] : [184, 157]) : kind === 'plus' ? [120, 72] : [184, 141];
		return [left + h, top + v];
	};
	const click = ([h, v]: [number, number]): void => {
		s.mouse(h, v).wait(5).button(true).wait(5).button(false).wait(20);
	};
	s.until(900).press('return').wait(60);
	s.mouse(120, 10).wait(5).button(true).wait(15).mouse(120, 44).wait(15).button(false).wait(60); // Options > Sound…
	s.shot('sound');
	for (let i = 0; i < 4; i++) {
		click(at(131, 158, 94)); // the volume's ">", from 1 to 5
	}
	s.shot('volume');
	click(at(131, 60, 77)); // Music On
	click(at(131, 60, 99)); // 4-Channel
	s.shot('changed');
	click(at(131, 211, 143)); // Okay
	s.wait(40).shot('soundClosed');
	s.press('k', 'command').wait(60).shot('configure');
	click(at(137, 32, 26)); // the left key's icon
	s.shot('waiting').press('z').wait(30);
	click(at(137, 32, 59)); // the right key's icon
	s.press('x').wait(30);
	click(at(137, 127, 177)); // Fires Bands
	s.shot('configured');
	click(at(137, 221, 165)); // Okay
	s.wait(40).shot('configureClosed');
	s.sound('sound.raw');
	s.press('n', 'command').wait(20);
	for (const [key, ticks] of [['x', 90], ['z', 120], ['x', 60]] as const) {
		s.key(key, true);
		for (let t = 0; t < ticks; t += 30) {
			s.wait(30).shot(`${key}${s.shots.length}`);
		}
		s.key(key, false);
	}
	for (let t = 0; t < 6; t++) {
		s.wait(30).shot(`drift${t}`);
	}
	s.press('q', 'command').wait(120);
	return s;
}

/**
 * Holds Command as Glider starts, which on a Mac II has it switch the screen to black and white
 * (ForceBlackAndWhite); then the alert, a game for 10 seconds, and Sound Settings, in black and
 * white. The key goes down in the first tick, as a player would hold it while launching Glider.
 */
export function blackAndWhiteScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.key('command', true).wait(800).key('command', false);
	s.until(900).shot('alert').press('return').wait(60).shot('title');
	s.press('n', 'command');
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`game${t}`);
	}
	s.press('e', 'command').wait(700).shot('over');
	s.mouse(120, 10).wait(5).button(true).wait(15).mouse(120, 44).wait(15).button(false).wait(60); // Options > Sound…
	s.shot('sound').press('return').wait(60).shot('soundClosed');
	return s;
}

/**
 * Opens another house from the Game menu (Load House…): Standard File's dialog lists the houses at
 * the disk's root, the down arrow selects "The House 2", and Return opens it. It is not the first house of its chain, so Glider says so and starts The House instead.
 */
export function loadHouseScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.mouse(60, 10).wait(5).button(true).wait(15).mouse(60, 44).wait(15).button(false).wait(60); // Game > Load House…
	s.shot('houses').press('down').wait(30).shot('selected').press('return').wait(60).shot('notFirst');
	s.press('return');
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`game${t}`);
	}
	return s;
}

/** Another house opened, on a Mac Plus and on a Mac II. */
cases.loadHouse = (dir) => {
	const disk = dir + '.dsk';
	rootDisk(disk, true);
	return run(macPlus, loadHouseScript(), disk, dir);
};
cases.loadHouseColor = (dir) => {
	const disk = dir + '.dsk';
	rootDisk(disk, false);
	return run(macII, loadHouseScript(), disk, dir);
};

/** A Mac II in black and white, chosen with Command at launch. */
cases.blackAndWhiteColor = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, gameFiles(), 'Glider 4.06');
	return run(macII, blackAndWhiteScript(), disk, dir);
};

/** Settings changed and played with, on a Mac Plus and on a Mac II. */
cases.settings = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, [...gameFiles(), alternateScreenFile()], 'Glider 4.06');
	return run(macPlus, settingsScript('plus'), disk, dir, [':System Folder:Glider 4.06']);
};
cases.settingsColor = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, gameFiles(), 'Glider 4.06');
	return run(macII, settingsScript('ii'), disk, dir, [':System Folder:Glider 4.06']);
};

/**
 * Glider's files at the disk's root, as the port's volume has them, for the cases that show
 * Standard File's dialogs (which start at the root); Glider is named as the port's copy is, since
 * the save dialog lists it.
 */
function rootDisk(disk: string, plus: boolean): void {
	const files = gameFiles().map((f) => (f.name === 'Glider 4.06' ? { ...f, name: 'Glider 4.05' } : f));
	makeDisk(disk, plus ? [...files, alternateScreenFile()] : files, 'Glider 4.05', 8, 'root');
}

/** A game saved and opened again, on a Mac Plus and on a Mac II. */
cases.savedGame = (dir) => {
	const disk = dir + '.dsk';
	rootDisk(disk, true);
	return run(macPlus, savedGameScript(), disk, dir, [':.sGame']);
};
cases.savedGameColor = (dir) => {
	const disk = dir + '.dsk';
	rootDisk(disk, false);
	return run(macII, savedGameScript(), disk, dir, [':.sGame']);
};
cases.savedGameProbe = (dir) => {
	const disk = dir + '.dsk';
	rootDisk(disk, true);
	return run(macPlus, savedGameScript(true), disk, dir, [':.sGame']);
};

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
	s.speed(8).traceKeys().sound('sound.raw');
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
 * The tour's game to its high-score dialog, then a period held in the name field for 24, 30 and
 * 36 ticks, so that it comes up as a repeat falls due (KeyThresh 24, KeyRepThresh 6), and for a
 * tick less, each followed by a screenshot: does the key's release or the repeat come first?
 */
export function repeatScript(): Script {
	const s = new Script();
	s.speed(8).traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command').wait(20);
	s.key('.', true).wait(1200).key('.', false).wait(600).shot('dialog');
	for (const ticks of [24, 30, 36, 23, 29, 35]) {
		s.key('.', true).wait(ticks).key('.', false).wait(20).shot(`held${ticks}`);
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
	s.speed(8).traceKeys().sound('sound.raw');
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

/**
 * The files for the desktop's cases: Glider (4.05's resources) and the Room Editor (1.03's), named as
 * the port's desktop names them, with their bundles' icons, and a Source Code folder.
 */
function desktopFiles(): MacFile[] {
	const glider = bundledFiles().find((f) => f.name === 'Glider 4.05')!;
	const editor = parseDeRez(readFileSync(join(oracleDir, '..', 'RoomEditor_103', 'Editor.r')));
	return [
		{ ...glider, name: 'Glider 4.0', finderFlags: 0x2000 },
		{ name: 'Room Editor', type: 'APPL', creator: 'GLed', finderFlags: 0x2000, created: 0, modified: 0, data: new Uint8Array(0), rsrc: writeResourceFork(editor) },
	];
}

/**
 * System 6.0.8's Finder with Glider 4.0, the Room Editor and the Source Code folder dragged from the
 * disk's window to the desktop and cleaned up, for the port's desktop (PORT.md, decision 16): the
 * desktop, Glider selected, and every tick of the zoom as Glider opens. The places in the disk's
 * window are the Finder's own for these files, seen in a screenshot.
 */
export function desktopScript(width: number): Script {
	const s = new Script();
	s.speed(8);
	const disk = width - 40;
	const doubleClick = (h: number, v: number): void => {
		s.mouse(h, v).wait(5).button(true).wait(3).button(false).wait(3).button(true).wait(3).button(false);
	};
	const drag = (h: number, v: number, toV: number): void => {
		s.mouse(h, v).wait(5).button(true).wait(10).mouse(300, (v + toV) >> 1).wait(10).mouse(disk, toV).wait(10).button(false).wait(60);
	};
	s.until(1800);
	doubleClick(disk, 45);
	s.wait(120);
	drag(172, 100, 100);
	drag(236, 100, 150);
	drag(38, 110, 200);
	s.mouse(27, 51).wait(5).button(true).wait(5).button(false).wait(60); // the window's close box
	s.mouse(250, 300).wait(5).button(true).wait(5).button(false).wait(60); // nothing selected
	s.mouse(175, 10).wait(5).button(true).wait(20).mouse(200, 27).wait(20).button(false).wait(120); // Special > Clean Up Desktop
	s.mouse(250, 300).wait(5).button(true).wait(5).button(false).wait(60).shot('desktop');
	// Glider selected by a click in a hole of its icon's mask, between its glider and its base.
	s.mouse(width - 40, 109).wait(5).button(true).wait(5).button(false).wait(60).mouse(250, 300).wait(10).shot('selected');
	doubleClick(width - 40, 100);
	for (let i = 1; i <= 20; i++) {
		s.wait(1).shot(`z${i}`);
	}
	return s;
}

cases.desktop = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, desktopFiles(), 'Finder', 8, 'root', ['Source Code']);
	return run(macPlus, desktopScript(512), disk, dir);
};

/** System 6.0.8's Finder shutting down a Mac Plus, for the port's desktop's Shut Down. */
cases.shutDown = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, [], 'Finder', 8, 'root');
	const s = new Script();
	s.speed(8).until(1800);
	s.mouse(175, 10).wait(5).button(true).wait(20).mouse(190, 123).wait(20).button(false).wait(600); // Special > Shut Down
	s.mouse(250, 300).wait(10).shot('shutDown');
	return run(macPlus, s, disk, dir);
};

/** The Room Editor as it starts: a screenshot every second. */
function editorBootScript(): Script {
	const s = new Script();
	for (let t = 1; t <= 20; t++) {
		s.until(t * 60).shot(`t${t * 60}`);
	}
	return s;
}

/** The Room Editor's Open House dialog, its New House button, Room Background Info's Okay, and the first room. */
export function editorNewHouseScript(kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8);
	const [newHouse, okay] = kind === 'plus' ? [[380, 221], [333, 221]] : [[445, 290], [398, 291]];
	s.until(900).shot('open');
	s.click(newHouse[0]!, newHouse[1]!).wait(120).shot('background');
	s.click(okay[0]!, okay[1]!).wait(120).shot('room');
	return s;
}

/** Try Glider (Special's first item) in a new house's first room, with a screenshot every half second as the glider falls. */
export function editorTryGliderScript(kind: 'plus' | 'ii'): Script {
	const s = editorNewHouseScript(kind);
	s.mouse(138, 10).wait(5).button(true).wait(20).mouse(150, 28).wait(20).button(false);
	// The glider's frame follows the mouse until a click drops the glider there. No screenshot of
	// it: the original erases and draws it again (patXor) as fast as it can, so a screenshot shows
	// it whole, in part, or not at all (seen in the oracle), while the port draws it once a tick.
	s.wait(30).mouse(200, 140).wait(30);
	s.click(200, 140);
	for (let t = 1; t <= 8; t++) {
		s.wait(30).shot(`fly${t}`);
	}
	return s;
}

/**
 * Hands-off House (Ward Hartenstein), a house that plays itself: its bytes, played as The House. Its
 * record names "Hands-off House" as the first file of its sequence, which Glider checks against the
 * file's name; here it names "The House", which changes nothing in play.
 */
export function handsOffHouse(): Uint8Array {
	const data = new Uint8Array(readFileSync(join(oracleDir, '..', 'Houses', 'Hands-off House')));
	const house = readLayout(houseRecLayout, data, 0);
	writeLayout(houseRecLayout, { ...house, firstFile: 'The House' }, data, 0);
	return data;
}

/**
 * A game of Hands-off House with no input after ⌘N, with a screenshot every `every` ticks for `ticks`;
 * on a Mac as fast as the port (speed 8), or at the emulated Mac's own speed.
 */
export function handsOffScript(every = 300, ticks = 60 * 60 * 15, fast = true): Script {
	const s = new Script();
	if (fast) {
		s.speed(8);
	}
	s.traceKeys();
	s.until(900).press('return').wait(60);
	s.press('n', 'command');
	for (let t = every; t <= ticks; t += every) {
		s.wait(every).shot(`t${String(t).padStart(6, '0')}`);
	}
	return s;
}

/** Hands-off House on a Mac Plus. */
cases.handsOff = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, [...gameFiles(handsOffHouse()), alternateScreenFile()], 'Glider 4.06');
	return run(macPlus, handsOffScript(), disk, dir);
};
/** Hands-off House on a Mac II. */
cases.handsOffColor = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, gameFiles(handsOffHouse()), 'Glider 4.06');
	return run(macII, handsOffScript(), disk, dir);
};
/** Hands-off House at the Mac Plus's own speed, where drawing takes time. */
cases.handsOffSlow = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, [...gameFiles(handsOffHouse()), alternateScreenFile()], 'Glider 4.06');
	return run(macPlus, handsOffScript(300, 60 * 60 * 15, false), disk, dir);
};
/** Hands-off House at the Mac II's own speed. */
cases.handsOffSlowColor = (dir) => {
	const disk = dir + '.dsk';
	makeDisk(disk, gameFiles(handsOffHouse()), 'Glider 4.06');
	return run(macII, handsOffScript(300, 60 * 60 * 15, false), disk, dir);
};

/**
 * The Room Editor's disk: Glider's files as the game cases have them (the port's art and houses), the
 * source release's unlocked working copy of The House, which the editor will open, and the editor.
 */
function editorDisk(disk: string): void {
	const july = bundledFiles().find((f) => f.name === 'The House (July 1991)')!;
	makeDisk(disk, [...gameFiles(), july, roomEditor104()], 'Room Editor', 8, 'root');
}

/** Pulls down a menu by its title's place and chooses an item (16 pixels each, from the bar's 20). */
function menuItem(s: Script, title: number, item: number): Script {
	return s.mouse(title, 10).wait(5).button(true).wait(20).mouse(title + 10, 12 + 16 * item).wait(20).button(false).wait(10);
}

/**
 * A tour of the Room Editor with The House (July 1991): opening it, rooms, each dialog (each closed
 * with Return), an object selected, the Edit menu, the About box, and Quit.
 */
export function editorTourScript(kind: 'plus' | 'ii'): Script {
	// The Mac II's ADB mouse gives the button when the bus polls it, which decides how many of the
	// editor's 6-tick main-loop passes (and so marquee steps) fall between the menus.
	const s = new Script().speed(8).traceKeys().traceMouse();
	const [dh, dv] = kind === 'plus' ? [0, 0] : [64, 69]; // the room's place on the screen
	s.until(900);
	// Standard File selects the file whose name begins with what is typed: "the house (".
	for (const c of 'the house ') {
		s.press(c === ' ' ? 'space' : c).wait(3);
	}
	s.press('9', 'shift');
	s.wait(30).shot('selected').press('return').wait(180).shot('room1');
	s.press('2', 'command').wait(120).shot('room2');
	s.press('2', 'command').wait(120).shot('room3');
	s.press('1', 'command').wait(120).shot('room2again');
	s.press('1', 'command').wait(120);
	s.click(338 + dh, 208 + dv).wait(60).shot('objectSelected');
	s.press('i', 'command').wait(60).shot('objectInfo').press('return').wait(60).shot('afterObjectInfo');
	s.press('r', 'command').wait(60).shot('background').press('return').wait(60);
	menuItem(s, 204, 4).wait(60).shot('houseInfo').press('return').wait(60);
	menuItem(s, 204, 6).wait(60).shot('roomCondition').press('return').wait(60);
	menuItem(s, 138, 5).wait(60).shot('goToRoom').press('return').wait(90).shot('afterGoTo');
	s.mouse(90, 10).wait(5).button(true).wait(30).shot('editMenu').mouse(90, 300).wait(10).button(false).wait(30);
	menuItem(s, 20, 1).wait(60).shot('about').press('return').wait(60);
	s.press('q', 'command').wait(120).shot('quit');
	return s;
}

/** Opens The House (July 1991) from the Room Editor's Standard File, by typing "the house (". */
function openTheHouse(s: Script): Script {
	s.until(900);
	for (const c of 'the house ') {
		s.press(c === ' ' ? 'space' : c).wait(3);
	}
	return s.press('9', 'shift').wait(30).press('return').wait(180);
}

/** Drags with the button down from one point to another, in steps of 3 ticks. */
function drag(s: Script, from: [number, number], to: [number, number], steps = 8): Script {
	s.mouse(...from).wait(5).button(true).wait(10);
	for (let i = 1; i <= steps; i++) {
		s.mouse(Math.round(from[0] + ((to[0] - from[0]) * i) / steps), Math.round(from[1] + ((to[1] - from[1]) * i) / steps)).wait(3);
	}
	return s.wait(10).button(false);
}

/**
 * Editing a room of The House (July 1991): a table dragged off the tool window into room 1, dragged
 * along, copied and pasted, deleted; another set of tools; a new room, which a full house refuses; Quit.
 */
export function editorEditScript(kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8).traceKeys().traceMouse();
	const [dh, dv] = kind === 'plus' ? [0, 0] : [64, 69]; // the room's place on the screen
	const [th, tv] = [(kind === 'plus' ? 512 : 640) - 99, 40]; // the tool window's content
	openTheHouse(s).shot('room1');
	drag(s, [th + 21, tv + 71], [120 + dh, 110 + dv]).wait(60).shot('placed');
	drag(s, [120 + dh, 110 + dv], [160 + dh, 90 + dv]).wait(60).shot('moved');
	s.press('c', 'command').wait(30).press('v', 'command').wait(60).shot('pasted');
	s.press('delete').wait(60).shot('cleared');
	s.click(th + 39, tv + 14).wait(60).shot('toolSet');
	// The house has its 40 rooms already: an alert says so.
	s.press('k', 'command').wait(120).shot('newRoom').press('return').wait(60);
	s.press('q', 'command').wait(120).shot('quit');
	return s;
}

/**
 * The Room Editor's windows: the tool window dragged by its bar (a screenshot with the button held,
 * for DragGrayRgn's outline), its close box held and let go, the tool window shown again (⌘T), and on
 * the Mac II the room's window dragged by its title bar.
 */
export function editorWindowsScript(kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8).traceKeys().traceMouse();
	const [th, tv] = [(kind === 'plus' ? 512 : 640) - 99, 40]; // the tool window's content
	openTheHouse(s).shot('room1');
	// The bar is the 10 pixels above the content; its close box is 8 to 15 pixels along it.
	const bar: [number, number] = [th + 40, tv - 5];
	const to: [number, number] = [bar[0] - 120, bar[1] + 60];
	s.mouse(...bar).wait(5).button(true).wait(10);
	for (let i = 1; i <= 8; i++) {
		s.mouse(Math.round(bar[0] + ((to[0] - bar[0]) * i) / 8), Math.round(bar[1] + ((to[1] - bar[1]) * i) / 8)).wait(3);
	}
	s.wait(20).shot('dragging').button(false).wait(60).shot('toolMoved');
	const close: [number, number] = [th + 10 - 120, tv - 6 + 60];
	s.mouse(...close).wait(5).button(true).wait(20).shot('closeHeld').button(false).wait(60).shot('toolClosed');
	s.press('t', 'command').wait(60).shot('toolShown');
	if (kind === 'ii') {
		s.mouse(320, 59).wait(5).button(true).wait(10);
		for (let i = 1; i <= 8; i++) {
			s.mouse(320 - 4 * i, 59 - 3 * i).wait(3);
		}
		s.wait(20).shot('mainDragging').button(false).wait(90).shot('mainMoved');
	}
	return s;
}

/** The Room Editor's windows on a Mac Plus. */
cases.editorWindows = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorWindowsScript('plus'), disk, dir);
};
/** The Room Editor's windows on a Mac II. */
cases.editorWindowsColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorWindowsScript('ii'), disk, dir);
};

/** The Room Editor's help window (About™ 2.1): its text, scrolled, its icons, and OK. */
export function editorHelpScript(kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8).traceKeys().traceMouse();
	// The window's content is at (12, 30) on the Mac Plus, centered and a third of the way down.
	const [dh, dv] = kind === 'plus' ? [0, 0] : [64, 29];
	openTheHouse(s);
	menuItem(s, 204, 9).wait(90).shot('help');
	// Keys scroll a line or, with Command, a page (clicks on the arrows repeat as fast as the Mac goes).
	for (let i = 0; i < 3; i++) {
		s.press('down').wait(20);
	}
	s.shot('lines').press('down', 'command').wait(30).shot('page');
	// Held in the scroll bar's page area, it pages until the thumb comes under the mouse.
	s.mouse(487 + dh, 200 + dv).wait(5).button(true).wait(60).button(false).wait(30).shot('paged');
	// The icon, held, shows the other icon and the click message.
	s.mouse(36 + dh, 310 + dv).wait(5).button(true).wait(30).shot('iconHeld').button(false).wait(30).shot('iconLet');
	// Option-click shows the library's version while the button is down.
	s.mouse(250 + dh, 300 + dv).wait(5).key('option', true).wait(5).button(true).wait(30).shot('version').button(false).wait(5).key('option', false).wait(30).shot('afterVersion');
	s.press('c', 'command').wait(30).shot('copied');
	s.press('return').wait(60).shot('afterHelp');
	return s;
}

/** The Room Editor's help on a Mac Plus. */
cases.editorHelp = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorHelpScript('plus'), disk, dir);
};
/** The Room Editor's help on a Mac II. */
cases.editorHelpColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorHelpScript('ii'), disk, dir);
};

/**
 * Saving and opening again in the Room Editor: a table dragged into room 1, ⌘S, and the house opened
 * again (⌘O); Special's Controls submenu, its Customize Keys dialog; Auto-Hide, which hides the tool
 * window while a table is dragged off it; Quit.
 */
export function editorSaveScript(kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8).traceKeys().traceMouse();
	const [dh, dv] = kind === 'plus' ? [0, 0] : [64, 69]; // the room's place on the screen
	const [th, tv] = [(kind === 'plus' ? 512 : 640) - 99, 40]; // the tool window's content
	openTheHouse(s);
	drag(s, [th + 21, tv + 71], [120 + dh, 110 + dv]).wait(60);
	s.press('s', 'command').wait(120).shot('saved');
	// Open House is for when no house is open: ⌘W closes this one first.
	s.press('w', 'command').wait(90).shot('closed');
	s.press('o', 'command').wait(90).shot('openDialog');
	for (const c of 'the house ') {
		s.press(c === ' ' ? 'space' : c).wait(3);
	}
	s.press('9', 'shift').wait(30).press('return').wait(180).shot('reopened');
	// Special, then Controls (its second item), across into the submenu, and down to Configure.
	s.mouse(138, 10).wait(5).button(true).wait(20).mouse(150, 44).wait(20).mouse(260, 44).wait(20).mouse(300, 44).wait(20);
	s.mouse(300, 124).wait(30).shot('controlsMenu').button(false).wait(60).shot('customizeKeys');
	s.press('return').wait(60).shot('afterKeys');
	menuItem(s, 204, 2).wait(30);
	drag(s, [th + 21, tv + 71], [300 + dh, 100 + dv]).wait(60).shot('autoHidden');
	s.press('q', 'command').wait(120).shot('quit');
	return s;
}

/**
 * Objects and rooms in the Room Editor: room 1's table selected and stretched by its handle, Tab to
 * the next object and its Object Info with a value typed, the arrow keys to the next room and back,
 * Go To Room with a number typed, and Quit.
 */
export function editorObjectsScript(kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8).traceKeys().traceMouse();
	const [dh, dv] = kind === 'plus' ? [0, 0] : [64, 69]; // the room's place on the screen
	openTheHouse(s);
	// The table is (223, 186)-(232, 356); its handle is 4 pixels past its right end.
	s.click(270 + dh, 227 + dv).wait(60).shot('tableSelected');
	drag(s, [360 + dh, 227 + dv], [410 + dh, 227 + dv]).wait(60).shot('stretched');
	s.press('tab').wait(60).shot('tabbed');
	s.press('i', 'command').wait(60).shot('objectInfo');
	s.type('150').wait(30).shot('typed').press('return').wait(60).shot('afterInfo');
	s.press('right').wait(120).shot('nextRoom').press('left').wait(120).shot('backAgain');
	menuItem(s, 138, 5).wait(60);
	s.type('12').wait(30).shot('goTo').press('return').wait(120).shot('room12');
	s.press('q', 'command').wait(120).shot('quit');
	return s;
}

/**
 * Rooms in the Room Editor, in The House (July 1991): room 2 cut (⌘X) and pasted (⌘V), the house saved
 * under another name (File's Save As…, Standard File's Save dialog), a key changed in Customize Keys
 * (the left arrow's icon clicked, then A). (Quit, the house saved, goes straight to the Finder.)
 */
export function editorRoomsScript(_kind: 'plus' | 'ii'): Script {
	const s = new Script().speed(8).traceKeys().traceMouse();
	openTheHouse(s);
	s.press('2', 'command').wait(120).shot('room2');
	s.press('x', 'command').wait(120).shot('cut');
	s.press('v', 'command').wait(120).shot('pasted');
	menuItem(s, 52, 6).wait(90).shot('saveAs');
	s.type('Test House').wait(30).shot('named').press('return').wait(180).shot('saved');
	s.mouse(138, 10).wait(5).button(true).wait(20).mouse(150, 44).wait(20).mouse(260, 44).wait(20).mouse(300, 44).wait(20);
	s.mouse(300, 124).wait(30).button(false).wait(60).shot('customizeKeys');
	s.click(147, 94).wait(30).shot('iconClicked').press('a').wait(30).shot('keyChanged');
	s.press('return').wait(60).shot('afterKeys');
	return s;
}

/** The Room Editor's rooms on a Mac Plus. */
cases.editorRooms = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorRoomsScript('plus'), disk, dir, [':Test House']);
};
/** The Room Editor's rooms on a Mac II. */
cases.editorRoomsColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorRoomsScript('ii'), disk, dir, [':Test House']);
};

/** The Room Editor's objects on a Mac Plus. */
cases.editorObjects = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorObjectsScript('plus'), disk, dir);
};
/** The Room Editor's objects on a Mac II. */
cases.editorObjectsColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorObjectsScript('ii'), disk, dir);
};

/** The Room Editor's saving on a Mac Plus. */
cases.editorSave = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorSaveScript('plus'), disk, dir, [':The House (July 1991)']);
};
/** The Room Editor's saving on a Mac II. */
cases.editorSaveColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorSaveScript('ii'), disk, dir, [':The House (July 1991)']);
};

/** The Room Editor's editing on a Mac Plus. */
cases.editorEdit = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorEditScript('plus'), disk, dir);
};
/** The Room Editor's editing on a Mac II. */
cases.editorEditColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorEditScript('ii'), disk, dir);
};

/** The Room Editor's tour on a Mac Plus. */
cases.editorTour = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macPlus, editorTourScript('plus'), disk, dir);
};
/** The Room Editor's tour on a Mac II. */
cases.editorTourColor = (dir) => {
	const disk = dir + '.dsk';
	editorDisk(disk);
	return run(macII, editorTourScript('ii'), disk, dir);
};
