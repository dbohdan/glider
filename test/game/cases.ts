// The game cases: the oracle's scripts (oracle/cases.ts) that the port replays, on each machine, with
// the houses they play.

import { blackAndWhiteScript, everyTickScript, firstRoomScript, houseEnds, houseEndScript, houseFrom, houseOfOneRoom, houseWith, maskRooms, interfaceScript, mouseScript, playScript, repeatScript, roomStarts, savedGameScript, settingsScript, steerScript, tourScript, wanderScript } from '../../oracle/cases.ts';
import type { Script } from '../../oracle/Script.ts';
import type { MachineKind } from '../../src/platform/Machine.ts';

export interface Case {
	caseName: string;
	makeScript: () => Script;
	what: string;
	/** The House as the case plays it, when not the real one. */
	house?: () => Uint8Array;
	/** How many pixels of each screenshot are known to differ. */
	known?: number;
	/** When Glider starts, for a case whose input must come before (bootGlider); 0 by default. */
	launchTick?: number;
}

/** A case on both machines: `name` on the Mac Plus, `nameColor` on the Mac II. */
function both(name: string, makeScript: () => Script, what: string, house?: () => Uint8Array): [MachineKind, Case][] {
	return [
		['plus', { caseName: name, makeScript, what, house, known: knownDifferences[name] }],
		['ii', { caseName: `${name}Color`, makeScript, what, house, known: knownDifferences[`${name}Color`] }],
	];
}

/**
 * Pixels known to differ in every screenshot of a case. Color QuickDraw stretches the stretched test
 * room's sprites as the port does, but for 55 pixels: where a horizontal shrink of 4-bit pixels
 * splits a pixel in half, and at the first row of one enlarged mask (27 rows to 40). Glider itself
 * only shrinks a drip's last frame from 14 rows to 13, which matches.
 */
export const knownDifferences: Record<string, number> = { stretchedColor: 55 };

/** Cases that still differ, being worked on: they run, but do not fail the tests. */
export const unfinished: Record<string, string> = {
};

export const gameCases: [MachineKind, Case][] = [
	...both('play', playScript, 'a game plays'),
	...both('steer', steerScript, 'a game steered with the keys plays'),
	...both('mouse', () => mouseScript(false), 'a game steered with the mouse plays'),
	...both('joystick', () => mouseScript(true), 'a game steered with mouse movements plays'),
	...both('wander', () => wanderScript(1), 'a minute of random keys plays'),
	...roomStarts.flatMap((first) => both(`room${first}`, () => wanderScript(first), `a minute of random keys from room ${first} plays`, () => houseFrom(first))),
	...Object.entries(maskRooms).flatMap(([name, objects]) => both(name, firstRoomScript, `a test room (${name}) looks`, () => houseWith(objects))),
	...Object.entries(houseEnds).flatMap(([name, nextFile]) => both(name, houseEndScript, nextFile === '' ? 'the end of the last house plays' : 'going on to the next house file plays', () => houseOfOneRoom(nextFile))),
	...both('savedGame', () => savedGameScript(), 'a game saved and opened again plays'),
	['plus', { caseName: 'settings', makeScript: () => settingsScript('plus'), what: 'a game with changed settings plays' }],
	['ii', { caseName: 'settingsColor', makeScript: () => settingsScript('ii'), what: 'a game with changed settings plays' }],
	// Command held from the first tick, before Glider starts.
	['ii', { caseName: 'blackAndWhiteColor', makeScript: blackAndWhiteScript, what: 'a Mac II switched to black and white plays', launchTick: 30 }],
	...both('tour', tourScript, 'a long flight through the house plays'),
	...both('repeats', repeatScript, 'keys held in the high-score dialog repeat'),
	...both('ui', interfaceScript, "Glider's menus, dialogs, help and a paused game look"),
	...both('everyTick', everyTickScript, 'every tick of the alert going away and a game starting looks'),
];
