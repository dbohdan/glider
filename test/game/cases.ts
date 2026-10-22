// The game cases: the oracle's scripts (oracle/cases.ts) that the port replays, on each machine, with
// the houses they play.

import { blackAndWhiteScript, editorNewHouseScript, editorEditScript, editorHelpScript, editorTourScript, editorWindowsScript, editorTryGliderScript, handsOffHouse, handsOffScript, everyTickScript, firstRoomScript, houseEnds, houseEndScript, houseFrom, houseOfOneRoom, houseWith, longNameScript, maskRooms, interfaceScript, loadHouseScript, mouseScript, playScript, repeatScript, roomStarts, savedGameScript, settingsScript, steerScript, tourScript, wanderScript } from '../../oracle/cases.ts';
import type { Script } from '../../oracle/Script.ts';
import type { MachineKind } from '../../src/platform/Machine.ts';
import type { Program } from './harness.ts';

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
	/** The program the case runs; Glider by default. */
	program?: Program;
	/** Bundled files on the disk beside those every case of the program has. */
	extraFiles?: string[];
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
export const unfinished: Record<string, string> = {};

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
	...both('loadHouse', loadHouseScript, 'another house opened plays'),
	['plus', { caseName: 'settings', makeScript: () => settingsScript('plus'), what: 'a game with changed settings plays' }],
	['ii', { caseName: 'settingsColor', makeScript: () => settingsScript('ii'), what: 'a game with changed settings plays' }],
	// Command held from the first tick, before Glider starts.
	['ii', { caseName: 'blackAndWhiteColor', makeScript: blackAndWhiteScript, what: 'a Mac II switched to black and white plays', launchTick: 30 }],
	...both('tour', tourScript, 'a long flight through the house plays'),
	...both('repeats', repeatScript, 'keys held in the high-score dialog repeat'),
	...both('longName', longNameScript, 'a name longer than the high-score field scrolls', () => houseOfOneRoom('')),
	...both('ui', interfaceScript, "Glider's menus, dialogs, help and a paused game look"),
	...both('everyTick', everyTickScript, 'every tick of the alert going away and a game starting looks'),
	// Fifteen minutes with no input: the glider flies twelve rooms and dies at Shockproof!, as the original does on a fast Mac.
	...both('handsOff', () => handsOffScript(), 'Hands-off House, which plays itself, plays', handsOffHouse),
	// The Room Editor (roadmap 12).
	['plus', { caseName: 'editorNewHouse', makeScript: () => editorNewHouseScript('plus'), what: "the Room Editor's first room of a new house looks", program: 'editor' }],
	['ii', { caseName: 'editorNewHouseColor', makeScript: () => editorNewHouseScript('ii'), what: "the Room Editor's first room of a new house looks", program: 'editor' }],
	// Try Glider leaves the glider's every frame on the screen, as the original does: it never puts the background back.
	['plus', { caseName: 'editorTryGlider', makeScript: () => editorTryGliderScript('plus'), what: "the Room Editor's Try Glider flies", program: 'editor' }],
	['ii', { caseName: 'editorTryGliderColor', makeScript: () => editorTryGliderScript('ii'), what: "the Room Editor's Try Glider flies", program: 'editor' }],
	['plus', { caseName: 'editorTour', makeScript: () => editorTourScript('plus'), what: "the Room Editor's rooms, dialogs and menus look", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['ii', { caseName: 'editorTourColor', makeScript: () => editorTourScript('ii'), what: "the Room Editor's rooms, dialogs and menus look", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['plus', { caseName: 'editorEdit', makeScript: () => editorEditScript('plus'), what: "the Room Editor's objects drag, copy and clear", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['ii', { caseName: 'editorEditColor', makeScript: () => editorEditScript('ii'), what: "the Room Editor's objects drag, copy and clear", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['plus', { caseName: 'editorWindows', makeScript: () => editorWindowsScript('plus'), what: "the Room Editor's windows drag and close", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['ii', { caseName: 'editorWindowsColor', makeScript: () => editorWindowsScript('ii'), what: "the Room Editor's windows drag and close", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['plus', { caseName: 'editorHelp', makeScript: () => editorHelpScript('plus'), what: "the Room Editor's help window looks and scrolls", program: 'editor', extraFiles: ['The House (July 1991)'] }],
	['ii', { caseName: 'editorHelpColor', makeScript: () => editorHelpScript('ii'), what: "the Room Editor's help window looks and scrolls", program: 'editor', extraFiles: ['The House (July 1991)'] }],
];
