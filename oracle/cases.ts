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
 * Glider 4.06's files with Glider 4.05's preferences (from Glider_405/Glider.r), so that the game
 * starts in the same state as the port's.
 */
function withPrefs405(): MacFile[] {
	const prefs = parseDeRez(readFileSync(join(oracleDir, '..', 'Glider_405', 'Glider.r'))).get('Gprf', 128)!;
	return [...glider406().values()].map((f) => (f.name === 'Glider 4.06' ? editResources(f, (rf) => rf.put({ ...prefs })) : f));
}

/**
 * Starts a game the way the boot case does, with a CPU fast enough (32 times the instructions per
 * tick) that loading takes no time, as in the port; then follows it for 10 seconds.
 */
export function playScript(): Script {
	const s = new Script();
	s.speed(5);
	s.until(900).shot('alert').press('return').wait(60).shot('title');
	s.press('n', 'command');
	for (let t = 0; t < 20; t++) {
		s.wait(30).shot(`game${t}`);
	}
	return s;
}
