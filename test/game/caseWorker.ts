// Plays one game case, or runs Glider to a tick, in a worker thread of its own, so that it starts
// from fresh modules (see playCase in harness.ts), and sends the test what it gave.

import { parentPort, workerData } from 'node:worker_threads';
import type { MachineKind } from '../../src/platform/Machine.ts';
import { oracleOutput } from '../toolbox/machine.ts';
import { gameCases } from './cases.ts';
import { bootGlider, type CaseRun, oracleTrace, replay, runGlider } from './harness.ts';

const job = workerData as { index: number } | { kind: MachineKind; tick: number; withCursor: boolean };
if ('index' in job) {
	const [kind, c] = gameCases[job.index]!;
	const run = bootGlider(kind, c.launchTick ?? 0, c.house?.(), c.program);
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
