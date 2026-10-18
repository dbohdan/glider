// Oracle cases: scripted sessions with the original game.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MacFile } from '../src/mac/MacBinary.ts';
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
		makeDisk(disk, [...withPrefs405(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, playScript(), disk, dir);
	},

	/** A game on a Mac II, as the port plays it. */
	playColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, withPrefs405(), 'Glider 4.06');
		return run(macII, playScript(), disk, dir);
	},

	/** Every tick of the alert going away and of a game starting, on a Mac Plus. */
	everyTick(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...withPrefs405(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, everyTickScript(), disk, dir);
	},

	/** Every tick of the alert going away and of a game starting, on a Mac II. */
	everyTickColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, withPrefs405(), 'Glider 4.06');
		return run(macII, everyTickScript(), disk, dir);
	},

	/** A game on a Mac Plus, steered with the keyboard. */
	steer(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...withPrefs405(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, steerScript(), disk, dir);
	},

	/** A game on a Mac II, steered with the keyboard. */
	steerColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, withPrefs405(), 'Glider 4.06');
		return run(macII, steerScript(), disk, dir);
	},

	/** A long flight forward through the house on a Mac Plus. */
	tour(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, [...withPrefs405(), alternateScreenFile()], 'Glider 4.06');
		return run(macPlus, tourScript(), disk, dir);
	},

	/** A long flight forward through the house on a Mac II. */
	tourColor(dir) {
		const disk = dir + '.dsk';
		makeDisk(disk, withPrefs405(), 'Glider 4.06');
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

/**
 * Glider 4.06's files with Glider 4.05's preferences (from Glider_405/Glider.r) and the port's copy
 * of The House (the 4.06 disk's has two more high scores), so that the game starts in the same
 * state as the port's.
 */
function withPrefs405(): MacFile[] {
	const prefs = parseDeRez(readFileSync(join(oracleDir, '..', 'Glider_405', 'Glider.r'))).get('Gprf', 128)!;
	const house = new Uint8Array(readFileSync(join(oracleDir, '..', 'assets', 'houses', 'The House')));
	return [...glider406().values()].map((f) => {
		if (f.name === 'Glider 4.06') {
			return editResources(f, (rf) => rf.put({ ...prefs }));
		}
		return f.name === 'The House' ? { ...f, data: house } : f;
	});
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
