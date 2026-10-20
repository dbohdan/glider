// Port: what the player keeps, in the browser (IndexedDB), by file name. The game's own files are
// ours to update, so of them only the player's part is kept: Glider's preferences (its 'Gprf'
// resource) and each bundled house's high scores, put back into the bundled files at start. Files
// the player makes, such as saved games and houses of their own, are kept whole, as MacBinary.
// A deleted file is kept as a tombstone so that a bundled file stays deleted.
//
// Earlier versions kept changed bundled files whole; such records are read for their player's part.

import { houseRecLayout } from '../../glider/Globals.ts';
import { type MacFile, parseMacBinary, writeMacBinary } from '../../mac/MacBinary.ts';
import { encodeMacRoman } from '../../mac/MacRoman.ts';
import { readLayout, writeLayout } from '../../mac/PascalLayout.ts';
import { parseResourceFork, writeResourceFork } from '../../mac/ResourceFork.ts';
import type { Volume } from '../../mac/Volume.ts';

const dbName = 'glider4';
const storeName = 'files';

/** The house record's high scores, the player's part of a bundled house. */
interface Scores {
	hiScores: number[];
	hiLevel: number[];
	hiName: string[];
	hiRoom: string[];
}

interface Stored {
	name: string;
	deleted: boolean;
	/** A whole file the player made (or, from earlier versions, a changed bundled file). */
	macBinary: Uint8Array | null;
	/** The application's preferences resource. */
	prefs?: Uint8Array;
	/** A bundled house's high scores. */
	scores?: Scores;
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

const isApplication = (f: MacFile) => f.type === 'APPL';
const isHouse = (f: MacFile) => f.type === 'GLhs';

/** The application's preferences resource ('Gprf' 128), if it has one. */
export function prefsOf(app: MacFile): Uint8Array | null {
	return parseResourceFork(app.rsrc).resources.find((r) => r.type === 'Gprf' && r.id === 128)?.data ?? null;
}

export function withPrefs(app: MacFile, prefs: Uint8Array): MacFile {
	const fork = parseResourceFork(app.rsrc);
	const res = fork.resources.find((r) => r.type === 'Gprf' && r.id === 128);
	if (res === undefined) {
		return app;
	}
	res.data = prefs;
	return { ...app, rsrc: writeResourceFork(fork) };
}

export function scoresOf(house: MacFile): Scores {
	const { hiScores, hiLevel, hiName, hiRoom } = readLayout(houseRecLayout, house.data, 0);
	return { hiScores, hiLevel, hiName, hiRoom };
}

export function withScores(house: MacFile, scores: Scores): MacFile {
	const rec = { ...readLayout(houseRecLayout, house.data, 0), ...scores };
	const data = new Uint8Array(house.data);
	writeLayout(houseRecLayout, rec, data, 0);
	return { ...house, data };
}

function samePrefs(a: Uint8Array | null, b: Uint8Array | null): boolean {
	return a !== null && b !== null && a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * The player's part of a file on the volume, given the game's files as they came: a file the
 * player made, whole; the application or a bundled house if its preferences or scores changed;
 * null for the rest.
 */
export function playerPart(bundled: Map<string, MacFile>, file: MacFile): MacFile | null {
	const game = bundled.get(file.name);
	if (game === undefined) {
		return file;
	}
	if (isApplication(game)) {
		return samePrefs(prefsOf(game), prefsOf(file)) ? null : file;
	}
	if (isHouse(game)) {
		return JSON.stringify(scoresOf(game)) === JSON.stringify(scoresOf(file)) ? null : file;
	}
	return null;
}

/**
 * What an imported file becomes on the volume: a file of the player's own, whole; for the
 * application, its preferences in the game's copy; for a bundled house, its scores in the game's
 * copy; null for the game's other files, which are ours, and for other applications, which the port
 * cannot run (an archive of Glider 4.04 holds its own Glider).
 */
export function importedFile(bundled: Map<string, MacFile>, current: MacFile | undefined, file: MacFile): MacFile | null {
	const game = bundled.get(file.name);
	if (game === undefined) {
		return isApplication(file) ? null : file;
	}
	if (isApplication(game)) {
		const prefs = prefsOf(file);
		return prefs === null ? null : withPrefs(current ?? game, prefs);
	}
	if (isHouse(game) && isHouse(file) && file.data.length === game.data.length) {
		return withScores(current ?? game, scoresOf(file));
	}
	return null;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Where imported art goes: beside the art already on the volume, never over it (the game's own art
 * stays, and other art waits for a way to choose it); under its own name if that is free, else
 * numbered ("Color Art 2"). Null if the same art is on the volume already, under any name.
 */
export function artName(volume: Volume, art: MacFile): string | null {
	const same = (f: MacFile) => f.type === art.type && sameBytes(f.data, art.data) && sameBytes(f.rsrc, art.rsrc);
	if (volume.list().some(same)) {
		return null;
	}
	let name = art.name;
	for (let n = 2; volume.get(name) !== undefined; n++) {
		let base = art.name;
		while (encodeMacRoman(`${base} ${n}`).length > 31) {
			base = base.slice(0, -1);
		}
		name = `${base} ${n}`;
	}
	return name;
}

export class FileStore {
	private db: IDBDatabase | null = null;
	/** The files that came with the game, by name, as they came. */
	private bundled = new Map<string, MacFile>();

	static async open(): Promise<FileStore> {
		const s = new FileStore();
		try {
			s.db = await openDB();
		} catch {
			s.db = null; // storage is unavailable (private browsing): changes last for the session
		}
		return s;
	}

	/** Applies what the player keeps to a volume holding the game's files. */
	async restore(volume: Volume): Promise<void> {
		this.bundled = new Map(volume.list().map((f) => [f.name, f]));
		if (this.db === null) {
			return;
		}
		const all = await new Promise<Stored[]>((resolve, reject) => {
			const req = this.db!.transaction(storeName).objectStore(storeName).getAll();
			req.onsuccess = () => resolve(req.result as Stored[]);
			req.onerror = () => reject(req.error ?? new Error('cannot read storage'));
		});
		for (const s of all) {
			const game = this.bundled.get(s.name);
			if (s.deleted) {
				volume.delete(s.name);
			} else if (game !== undefined && isApplication(game)) {
				const prefs = s.prefs ?? (s.macBinary !== null ? prefsOf(parseMacBinary(s.macBinary)) : null);
				if (prefs !== null) {
					volume.put(withPrefs(game, prefs));
				}
			} else if (game !== undefined && isHouse(game)) {
				const scores = s.scores ?? (s.macBinary !== null ? scoresOf(parseMacBinary(s.macBinary)) : null);
				if (scores !== null) {
					volume.put(withScores(game, scores));
				}
			} else if (game === undefined && s.macBinary !== null) {
				volume.put({ ...parseMacBinary(s.macBinary), name: s.name });
			}
		}
	}

	/** The player's part of the volume's files (playerPart), for Export Files…. */
	playerFiles(volume: Volume): MacFile[] {
		return volume
			.list()
			.map((f) => playerPart(this.bundled, f))
			.filter((f) => f !== null);
	}

	/** Puts an imported file on the volume and keeps it; false if it is one of the game's own files. */
	import(volume: Volume, file: MacFile): boolean {
		if (file.type === 'GLbk') {
			const name = artName(volume, file);
			if (name === null) {
				return true;
			}
			file = { ...file, name };
		}
		const f = importedFile(this.bundled, volume.get(file.name), file);
		if (f === null) {
			return false;
		}
		volume.put(f);
		this.save(f, false);
		return true;
	}

	/** Puts back the game's preferences and the bundled houses' high scores. */
	async reset(volume: Volume): Promise<void> {
		for (const game of this.bundled.values()) {
			if (isApplication(game) || isHouse(game)) {
				volume.put(game);
			}
		}
		if (this.db === null) {
			return;
		}
		const tx = this.db.transaction(storeName, 'readwrite');
		for (const game of this.bundled.values()) {
			if (isApplication(game) || isHouse(game)) {
				tx.objectStore(storeName).delete(game.name);
			}
		}
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error('cannot write storage'));
		});
	}

	/** Keeps the player's part of a changed file, or that it was deleted. */
	save(file: MacFile, deleted: boolean): void {
		if (this.db === null) {
			return;
		}
		const game = this.bundled.get(file.name);
		let record: Stored;
		if (deleted) {
			record = { name: file.name, deleted: true, macBinary: null };
		} else if (game !== undefined && isApplication(game)) {
			const prefs = prefsOf(file);
			if (prefs === null) {
				return;
			}
			record = { name: file.name, deleted: false, macBinary: null, prefs };
		} else if (game !== undefined && isHouse(game)) {
			record = { name: file.name, deleted: false, macBinary: null, scores: scoresOf(file) };
		} else if (game !== undefined) {
			return; // the game's other files (its art, the read-me files) are ours
		} else {
			record = { name: file.name, deleted: false, macBinary: writeMacBinary(file) };
		}
		this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
	}
}
