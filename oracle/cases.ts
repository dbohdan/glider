// Oracle cases: scripted sessions with the original game.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MacFile } from '../src/mac/MacBinary.ts';
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

/**
 * Glider 4.06's application with Glider 4.05's preferences (from Glider_405/Glider.r), and the
 * port's art and The House (4.06's black-and-white art has other sprites, and its The House two more
 * high scores), so that the game starts as the port's does.
 */
function gameFiles(): MacFile[] {
	const prefs = parseDeRez(readFileSync(join(oracleDir, '..', 'Glider_405', 'Glider.r'))).get('Gprf', 128)!;
	const port = new Map(bundledFiles().map((f) => [f.name, f]));
	return [...glider406().values()].map((f) => {
		if (f.name === 'Glider 4.06') {
			return editResources(f, (rf) => rf.put({ ...prefs }));
		}
		return port.get(f.name) ?? f;
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
