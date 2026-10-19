// Plays one game case in a worker thread of its own, so that it starts from fresh modules (see
// playCase in harness.ts), and sends the test what it gave.

import { parentPort, workerData } from 'node:worker_threads';
import { oracleOutput } from '../toolbox/machine.ts';
import { gameCases } from './cases.ts';
import { bootGlider, type CaseRun, oracleTrace, replay, runGlider } from './harness.ts';

const [kind, c] = gameCases[(workerData as { index: number }).index]!;
const run = bootGlider(kind, 0, c.house?.());
const script = c.makeScript();
const { shots, end } = replay(run, script, oracleTrace(oracleOutput(c.caseName), script, kind));
await runGlider(run, end + 1);
const result: CaseRun = { shots: [...shots], expected: script.shots.length, sound: run.sound, files: run.volume.list() };
parentPort!.postMessage(result);
