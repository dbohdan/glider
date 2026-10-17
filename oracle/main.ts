// Command line for the oracle.
//
//   node oracle/main.ts setup          fetch inputs and build the emulator
//   node oracle/main.ts shoot [CASE]   run cases and save PNG screenshots under oracle/cache/runs/

import { join } from 'node:path';
import { buildEmulator, cacheDir, fetchInputs, macII, macPlus, savePNGs } from './Oracle.ts';
import { cases } from './cases.ts';

async function main(args: string[]): Promise<void> {
	const [command, ...rest] = args;
	if (command === 'setup') {
		await fetchInputs();
		buildEmulator(macPlus);
		buildEmulator(macII);
	} else if (command === 'shoot') {
		const names = rest.length > 0 ? rest : Object.keys(cases);
		for (const name of names) {
			const c = cases[name];
			if (c === undefined) {
				throw new Error(`unknown case ${name}; known: ${Object.keys(cases).join(', ')}`);
			}
			const r = c(join(cacheDir, 'runs', name));
			for (const p of savePNGs(r)) {
				console.log(p);
			}
			if (r.output) {
				process.stdout.write(r.output);
			}
		}
	} else {
		throw new Error('usage: main.ts setup | shoot [CASE...]');
	}
}

if (import.meta.main) {
	await main(process.argv.slice(2));
}
