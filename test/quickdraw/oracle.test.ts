import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareWithROM, oracleAvailable } from './harness.ts';
import { macII } from '../../oracle/Oracle.ts';
import { colorPictures, knownDifferences, testPictures } from './pictures.ts';

const skip = oracleAvailable() ? false : 'the oracle is not set up (make oracle)';

for (const [name, make] of Object.entries(testPictures)) {
	test(`QuickDraw draws "${name}" as the ROM does`, { skip }, () => {
		const differing = compareWithROM(name, make());
		assert.equal(differing.length, knownDifferences[name] ?? 0, `${differing.length} pixels differ, first at ${differing.slice(0, 12).join(' ')}; see oracle/cache/diffs/${name}.png`);
	});
}

for (const [name, make] of Object.entries(colorPictures)) {
	test(`Color QuickDraw draws "${name}" as the Mac II ROM does`, { skip }, () => {
		const differing = compareWithROM(name, make(), macII);
		assert.equal(differing.length, knownDifferences[`ii-${name}`] ?? 0, `${differing.length} pixels differ, first at ${differing.slice(0, 12).join(' ')}; see oracle/cache/diffs/ii-${name}.png`);
	});
}
