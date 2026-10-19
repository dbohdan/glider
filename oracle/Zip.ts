// The archives the oracle fetches, read with the port's ZIP reader and node:zlib.

import { inflateRawSync } from 'node:zlib';
import { type ZipEntry, zipMembers } from '../src/platform/Zip.ts';

export type { ZipEntry };

export function readZip(b: Uint8Array): ZipEntry[] {
	return zipMembers(b).map(({ name, method, raw }) => {
		if (method === 0) {
			return { name, data: raw.slice() };
		}
		if (method === 8) {
			return { name, data: new Uint8Array(inflateRawSync(raw)) };
		}
		throw new Error(`unsupported ZIP compression method ${method} for ${name}`);
	});
}
