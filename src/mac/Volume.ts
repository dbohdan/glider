// A flat Mac volume held in memory: the files Glider finds next to itself.
//
// The bundled files come from the build (MacBinary files listed in volume.json). Files the
// program creates or changes are kept by the Volume as well; persisting them to browser
// storage is the platform layer's job.

import { parseMacBinary, type MacFile } from './MacBinary.ts';
import type { OSType } from './Types.ts';

export interface VolumeManifestEntry {
	name: string;
	type: OSType;
	creator: OSType;
	/** Path of the MacBinary file, relative to the manifest. */
	path: string;
	dataSize: number;
	rsrcSize: number;
}

export interface VolumeManifest {
	name: string;
	files: VolumeManifestEntry[];
}

/** HFS compares file names without regard to case. */
function key(name: string): string {
	return name.toUpperCase();
}

export class Volume {
	readonly name: string;
	private readonly files = new Map<string, MacFile>();

	constructor(name: string) {
		this.name = name;
	}

	get(name: string): MacFile | undefined {
		return this.files.get(key(name));
	}

	put(file: MacFile): void {
		this.files.set(key(file.name), file);
	}

	delete(name: string): boolean {
		return this.files.delete(key(name));
	}

	list(): MacFile[] {
		return [...this.files.values()];
	}
}

/** Loads a volume from a manifest and its MacBinary files. `fetchBytes` resolves paths relative to the manifest. */
export async function loadVolume(manifest: VolumeManifest, fetchBytes: (path: string) => Promise<Uint8Array>): Promise<Volume> {
	const vol = new Volume(manifest.name);
	const files = await Promise.all(manifest.files.map(async (e) => ({ e, f: parseMacBinary(await fetchBytes(e.path)) })));
	for (const { e, f } of files) {
		vol.put({ ...f, name: e.name });
	}
	return vol;
}
