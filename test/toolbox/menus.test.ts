// The Menu Manager draws Glider's menus as System 6 does (the oracle's "menus" cases).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { macII, macPlus, type Machine } from '../../oracle/Oracle.ts';
import { AppendMenu, CheckItem, ClearMenuBar, DelMenuItem, DisableItem, DrawMenuBar, GetMenu, InsertMenu, InsMenuItem, MenuSelect, NewMenu, SetItem, SetItemCmd, SetItemMark } from '../../src/mac/Menus.ts';
import { bootMachine, type Box, cursorBox, differences, oracleRunAvailable, oracleShot, writeComparison } from './machine.ts';
import type { Image } from '../../oracle/Image.ts';
import { mouse } from '../../src/mac/OS.ts';

/** Sets up Glider's menus as Glider 4.06's SetUpMenus leaves them on these machines. */
function setUpGliderMenus(m: Machine): void {
	ClearMenuBar();
	const apple = GetMenu(128)!;
	InsertMenu(apple, 0);
	const game = GetMenu(129)!;
	InsertMenu(game, 0);
	DisableItem(game, 3); // End Game
	DisableItem(game, 6); // Save Game
	DisableItem(game, 7); // Save Game As…
	const options = GetMenu(130)!;
	InsertMenu(options, 0);
	AppendMenu(options, '(-');
	AppendMenu(options, 'Help');
	InsertMenu(GetMenu(131)!, -1);
	SetItem(options, 3, 'Air is Visible');
	SetItem(options, 4, 'Depth Restore is On');
	if (m === macPlus) {
		DisableItem(options, 4); // a Mac Plus cannot switch its screen's depth
	}
	CheckItem(GetMenu(131)!, 3, true);
	DrawMenuBar();
}

interface Step {
	shot: string;
	h: number;
	v: number;
	/** What to compare: the menu bar and the menus that are down. */
	boxes: Box[];
}

function run(m: Machine, caseName: string): Map<string, { ours: Image; rom: Image; step: Step }> {
	const machine = bootMachine(m);
	setUpGliderMenus(m);
	const w = machine.width;
	const bar: Box = [0, 0, w, 20];
	// The menus' frames: what is outside them (the shadows) depends on Glider's title screen.
	const appleBox: Box = [9, 19, 160, 52];
	const gameBox: Box = [33, 19, 214, 165];
	const optionsBox: Box = [82, 19, 232, 149];
	const controlsBox: Box = [226, 26, 358, 124];
	const steps: Step[] = [
		{ shot: 'apple', h: 20, v: 10, boxes: [bar, appleBox] },
		{ shot: 'game', h: 60, v: 10, boxes: [bar, gameBox] },
		{ shot: 'gameItem', h: 60, v: 44, boxes: [bar, gameBox] },
		{ shot: 'options', h: 120, v: 10, boxes: [bar, optionsBox] },
		{ shot: 'controls', h: 120, v: 28, boxes: [bar, optionsBox, controlsBox] },
		{ shot: 'controlsItem', h: 240, v: 44, boxes: [bar, optionsBox, controlsBox] },
		{ shot: 'away', h: 300, v: 250, boxes: [bar, optionsBox] },
	];
	const waits: Record<string, number> = { controls: 40 };
	const host = machine.host;
	const shots = new Map<string, { ours: Image; rom: Image; step: Step }>();
	// The button goes down over the Apple menu's title, as the program sees in its mouse-down event.
	let tick = 5;
	mouse.where = { h: 20, v: 10 };
	mouse.button = true;
	for (const step of steps) {
		host.mouseAt(tick, step.h, step.v);
		tick += waits[step.shot] ?? 15;
		host.at(tick, () => shots.set(step.shot, { ours: machine.shot(), rom: oracleShot(caseName, step.shot), step }));
	}
	host.buttonAt(tick + 1, false);
	return shots;
}

for (const [m, caseName] of [
	[macPlus, 'menus'],
	[macII, 'menusColor'],
] as const) {
	test(`the Menu Manager pulls down Glider's menus as System 6 does on a ${m === macPlus ? 'Mac Plus' : 'Mac II'}`, { skip: oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"` }, async () => {
		const shots = run(m, caseName);
		const result = await MenuSelect({ h: 20, v: 10 });
		assert.equal(result, 0);
		assert.equal(shots.size, 7);
		const failures: string[] = [];
		for (const [name, { ours, rom, step }] of shots) {
			const d = differences(ours, rom, step.boxes, [cursorBox(step.h, step.v)]);
			if (d.length > 0) {
				const all = step.boxes.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] as Box);
				writeComparison(`${caseName}-${name}`, rom, ours, [all[0], all[1], Math.min(all[2], all[0] + 400), all[3]]);
				failures.push(`${name}: ${d.length} pixels differ, first at ${d.slice(0, 8).join(' ')}`);
			}
		}
		assert.deepEqual(failures, []);
	});
}

test('InsMenuItem and DelMenuItem move the items after them, enabled or not', () => {
	const m = NewMenu(200, 'Test');
	AppendMenu(m, 'One;(Two;Three');
	InsMenuItem(m, 'New;(Dim', 1);
	assert.deepEqual(m.items.map((i) => i.text), ['One', 'New', 'Dim', 'Two', 'Three']);
	const enabled = (n: number) => (m.enableFlags & (1 << n)) !== 0;
	assert.deepEqual([1, 2, 3, 4, 5].map(enabled), [true, true, false, false, true]);
	DelMenuItem(m, 2);
	assert.deepEqual(m.items.map((i) => i.text), ['One', 'Dim', 'Two', 'Three']);
	assert.deepEqual([1, 2, 3, 4].map(enabled), [true, false, false, true]);
	SetItemMark(m, 1, 201);
	SetItemCmd(m, 1, 0x1b);
	assert.deepEqual([m.items[0]!.keyEquiv, m.items[0]!.mark], [0x1b, 201]);
});
