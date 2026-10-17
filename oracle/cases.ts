// Oracle cases: scripted sessions with the original game.

import { alternateScreenFile, glider406, macII, macPlus, makeDisk, type RunResult, run } from './Oracle.ts';
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
