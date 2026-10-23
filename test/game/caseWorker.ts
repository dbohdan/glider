// Plays one game case, or runs Glider to a tick, in a worker thread of its own, so that it starts
// from fresh modules (see playCase in harness.ts), and sends the test what it gave.

import { parentPort, workerData } from 'node:worker_threads';
import { type PadSide, setAdditionsHost } from '../../src/additions/Additions.ts';
import { noPad, type PadState } from '../../src/additions/Pads.ts';
import { G, mControls } from '../../src/glider/Globals.ts';
import { CountMItems, GetItem, GetMenu, GetResource, hostKeyDown, hostKeyUp, keysDown } from '../../src/mac/Toolbox.ts';
import type { MachineKind } from '../../src/platform/Machine.ts';
import { oracleOutput } from '../toolbox/machine.ts';
import { gameCases } from './cases.ts';
import { bootGlider, type CaseRun, oracleTrace, type PadGame, replay, runGlider } from './harness.ts';

const job = workerData as { index: number } | { kind: MachineKind; tick: number; withCursor: boolean } | { fourChannelsSaved: true; additions: boolean } | { padGame: true };
if ('padGame' in job) {
	// A game on a touch screen, with the virtual gamepad: the keyboard alert dismissed, a game
	// begun (⌘N), the glider steered right as it comes in, then left, then the pause button pressed.
	let pad: PadState = noPad;
	let use: [boolean, PadSide | null] = [false, null];
	setAdditionsHost({
		display: 'ii',
		changesAtOnce: () => true,
		setDisplay: () => {},
		restartOn: () => {},
		scales: () => [],
		scale: 0,
		setScale: () => {},
		pads: {
			touchScreen: true,
			gamepad: () => noPad,
			virtualPad: () => pad,
			use: (gamepad, virtual) => {
				use = [gamepad, virtual];
			},
		},
	});
	const run = bootGlider('ii');
	const key = (tick: number, code: number, char: number): void => {
		run.host.at(tick, () => hostKeyDown(code, char), true).at(tick + 5, () => hostKeyUp(code), true);
	};
	const lefts: number[] = [];
	key(900, 0x24, 13);
	run.host.at(960, () => (keysDown[0x37] = true));
	key(961, 0x2d, 'n'.charCodeAt(0));
	run.host.at(970, () => (keysDown[0x37] = false));
	run.host.at(1005, () => {
		lefts.push(G.theGlider.destRect.left);
		pad = { ...noPad, steer: 1 };
	});
	run.host.at(1035, () => {
		lefts.push(G.theGlider.destRect.left);
		pad = { ...noPad, steer: -1 };
	});
	run.host.at(1065, () => {
		lefts.push(G.theGlider.destRect.left);
		pad = noPad;
	});
	// The page presses Tab for the pause button (src/platform/browser/Pads.ts).
	key(1100, 0x30, 9);
	await runGlider(run, 1140);
	const controls = GetMenu(mControls)!;
	const items = Array.from({ length: CountMItems(controls) }, (_, k) => GetItem(controls, k + 1));
	const result: PadGame = { control: G.controlMethod, items, use, lefts: lefts as PadGame['lefts'], paused: G.pausing };
	parentPort!.postMessage(result);
} else if ('fourChannelsSaved' in job) {
	// Glider started with 4-Channel saved in its preferences, with the additions or without.
	if (job.additions) {
		setAdditionsHost({ display: 'ii', changesAtOnce: () => true, setDisplay: () => {}, restartOn: () => {}, scales: () => [], scale: 0, setScale: () => {} });
	}
	const run = bootGlider('ii');
	// channel4Is, after theName, houseName, resName, six Integers and musicIs.
	GetResource('Gprf', 128)!.data[107] = 1;
	await runGlider(run, 1200);
	parentPort!.postMessage(G.is4Channel);
} else if ('index' in job) {
	const [kind, c] = gameCases[job.index]!;
	const run = bootGlider(kind, c.launchTick ?? 0, c.house?.(), c.program, c.extraFiles);
	const script = c.makeScript();
	const { shots, end } = replay(run, script, oracleTrace(oracleOutput(c.caseName), script, kind));
	await runGlider(run, end + 1);
	const result: CaseRun = { shots: [...shots], expected: script.shots.length, sound: run.sound, files: run.volume.list() };
	parentPort!.postMessage(result);
} else {
	const run = bootGlider(job.kind);
	await runGlider(run, job.tick);
	parentPort!.postMessage(run.shot(job.withCursor));
}
