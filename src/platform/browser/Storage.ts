// Port: files the program changes or creates, kept in the browser (IndexedDB) as MacBinary, by
// name. At start they replace the bundled files of the same name; a deleted file is kept as a
// tombstone so that a bundled file stays deleted.

import { type MacFile, parseMacBinary, writeMacBinary } from '../../mac/MacBinary.ts';
import type { Volume } from '../../mac/Volume.ts';

const dbName = 'glider4';
const storeName = 'files';

interface Stored {
	name: string;
	deleted: boolean;
	macBinary: Uint8Array | null;
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(dbName, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(storeName, { keyPath: 'name' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('cannot open storage'));
	});
}

export class FileStore {
	private db: IDBDatabase | null = null;

	static async open(): Promise<FileStore> {
		const s = new FileStore();
		try {
			s.db = await openDB();
		} catch {
			s.db = null; // storage is unavailable (private browsing): changes last for the session
		}
		return s;
	}

	/** Applies the kept files to a volume. */
	async restore(volume: Volume): Promise<void> {
		if (this.db === null) {
			return;
		}
		const all = await new Promise<Stored[]>((resolve, reject) => {
			const req = this.db!.transaction(storeName).objectStore(storeName).getAll();
			req.onsuccess = () => resolve(req.result as Stored[]);
			req.onerror = () => reject(req.error ?? new Error('cannot read storage'));
		});
		for (const s of all) {
			if (s.deleted) {
				volume.delete(s.name);
			} else if (s.macBinary !== null) {
				volume.put({ ...parseMacBinary(s.macBinary), name: s.name });
			}
		}
	}

	/** Keeps a changed file, or that it was deleted. */
	save(file: MacFile, deleted: boolean): void {
		if (this.db === null) {
			return;
		}
		const record: Stored = deleted ? { name: file.name, deleted: true, macBinary: null } : { name: file.name, deleted: false, macBinary: writeMacBinary(file) };
		this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
	}
}
