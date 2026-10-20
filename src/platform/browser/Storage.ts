// Port: what the player keeps, in the browser (IndexedDB), by file name. The game's own files are
// ours to update, so of them only the player's part is kept: Glider's preferences (its 'Gprf'
// resource, and the 'Wprf' of the port's additions) and each bundled house's high scores, put back into the bundled files at start. Files
// the player makes, such as saved games and houses of their own, are kept whole, as MacBinary.
// A deleted file is kept as a tombstone so that a bundled file stays deleted.
//
// Glider's preferences are kept for each Mac, as each Mac had its own copy of Glider (PORT.md,
// decision 13): the keys Glider saves belong to a keyboard, and the Mac Plus's is not the Mac II's.
// Houses and saved games are the same for both. An exported Glider carries both: the Mac II's in
// its 'Gprf' and 'Wprf' 128, which Glider reads, and the Mac Plus's in 129, which it does not.
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
	/** The port's additions' preferences resource in the application ('Wprf' 128), once it has one. */
	webPrefs?: Uint8Array;
	/** The Mac Plus's copy of both; the two above are the Mac II's. */
	plus?: MacPrefs;
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

/** The Macs the page runs, each with its own copy of Glider's preferences. */
export type Mac = 'plus' | 'ii';

/** One Mac's copy of Glider's preferences, and of the additions'. */
export interface MacPrefs {
	prefs: Uint8Array;
	webPrefs?: Uint8Array;
}

/** Where each Mac's preferences are in an exported Glider: the Mac II's where Glider reads them. */
export const prefsID: Record<Mac, number> = { ii: 128, plus: 129 };

const isApplication = (f: MacFile) => f.type === 'APPL';
const isHouse = (f: MacFile) => f.type === 'GLhs';

/** The application's preferences resource ('Gprf' 128, or another Mac's copy), if it has one. */
export function prefsOf(app: MacFile, id = 128): Uint8Array | null {
	return parseResourceFork(app.rsrc).resources.find((r) => r.type === 'Gprf' && r.id === id)?.data ?? null;
}

/** The port's additions' preferences resource ('Wprf' 128, src/glider/Additions.ts), if the application has one. */
export function webPrefsOf(app: MacFile, id = 128): Uint8Array | null {
	return parseResourceFork(app.rsrc).resources.find((r) => r.type === 'Wprf' && r.id === id)?.data ?? null;
}

/** A Mac's copy of the preferences in an application, if it has one. */
export function macPrefsOf(app: MacFile, mac: Mac): MacPrefs | null {
	const prefs = prefsOf(app, prefsID[mac]);
	const webPrefs = webPrefsOf(app, prefsID[mac]);
	return prefs === null ? null : { prefs, ...(webPrefs === null ? {} : { webPrefs }) };
}

/** The game's application with each Mac's copy of the preferences it has, for Export Files…. */
export function withAllPrefs(app: MacFile, copies: Partial<Record<Mac, MacPrefs>>): MacFile {
	const fork = parseResourceFork(app.rsrc);
	for (const mac of ['ii', 'plus'] as const) {
		const copy = copies[mac];
		if (copy !== undefined) {
			fork.put({ type: 'Gprf', id: prefsID[mac], name: null, attrs: 0, data: copy.prefs });
			if (copy.webPrefs !== undefined) {
				fork.put({ type: 'Wprf', id: prefsID[mac], name: null, attrs: 0, data: copy.webPrefs });
			}
		}
	}
	return { ...app, rsrc: writeResourceFork(fork) };
}

/** The application with these preferences, and the additions' if given. */
export function withPrefs(app: MacFile, prefs: Uint8Array, webPrefs: Uint8Array | null = null): MacFile {
	const fork = parseResourceFork(app.rsrc);
	const res = fork.resources.find((r) => r.type === 'Gprf' && r.id === 128);
	if (res === undefined) {
		return app;
	}
	res.data = prefs;
	if (webPrefs !== null) {
		fork.put({ type: 'Wprf', id: 128, name: null, attrs: 0, data: webPrefs });
	}
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
		return samePrefs(prefsOf(game), prefsOf(file)) && webPrefsOf(file) === null ? null : file;
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
		const kept = current === undefined ? null : webPrefsOf(current);
		return prefs === null ? null : withPrefs(current ?? game, prefs, webPrefsOf(file) ?? kept);
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
	/** The Mac the page runs, whose copy of Glider's preferences is on the volume. */
	private mac: Mac = 'ii';
	/** Each Mac's copy of Glider's preferences, once the player has changed it. */
	private copies: Partial<Record<Mac, MacPrefs>> = {};

	static async open(): Promise<FileStore> {
		const s = new FileStore();
		try {
			s.db = await openDB();
		} catch {
			s.db = null; // storage is unavailable (private browsing): changes last for the session
		}
		return s;
	}

	/** Applies what the player keeps to a volume holding the game's files, on a Mac. */
	async restore(volume: Volume, mac: Mac = 'ii'): Promise<void> {
		this.bundled = new Map(volume.list().map((f) => [f.name, f]));
		this.mac = mac;
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
					this.copies.ii = { prefs, ...(s.webPrefs === undefined ? {} : { webPrefs: s.webPrefs }) };
				}
				if (s.plus !== undefined) {
					this.copies.plus = s.plus;
				}
				const copy = this.copies[mac];
				if (copy !== undefined) {
					volume.put(withPrefs(game, copy.prefs, copy.webPrefs ?? null));
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

	/** The player's part of the volume's files (playerPart), for Export Files…; Glider with each Mac's preferences. */
	playerFiles(volume: Volume): MacFile[] {
		return volume
			.list()
			.map((f) => {
				const game = this.bundled.get(f.name);
				if (game !== undefined && isApplication(game)) {
					return Object.keys(this.copies).length === 0 ? null : withAllPrefs(game, this.copies);
				}
				return playerPart(this.bundled, f);
			})
			.filter((f) => f !== null);
	}

	/** Puts an imported file on the volume and keeps it; false if it is one of the game's own files. */
	import(volume: Volume, file: MacFile): boolean {
		const game = this.bundled.get(file.name);
		if (game !== undefined && isApplication(game) && isApplication(file)) {
			// Each Mac's copy it carries (an older export has only the one Glider reads, the Mac II's).
			let any = false;
			for (const mac of ['ii', 'plus'] as const) {
				const copy = macPrefsOf(file, mac);
				if (copy !== null) {
					this.copies[mac] = copy;
					any = true;
				}
			}
			const copy = this.copies[this.mac];
			if (copy !== undefined) {
				volume.put(withPrefs(volume.get(file.name) ?? game, copy.prefs, copy.webPrefs ?? null));
			}
			this.keepCopies(file.name);
			return any;
		}
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

	/** Puts back the game's preferences, each Mac's, and the bundled houses' high scores. */
	async reset(volume: Volume): Promise<void> {
		this.copies = {};
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
		const game = this.bundled.get(file.name);
		if (!deleted && game !== undefined && isApplication(game)) {
			// This Mac's copy, kept for the session even where the browser keeps nothing.
			const prefs = prefsOf(file);
			if (prefs !== null) {
				const webPrefs = webPrefsOf(file);
				this.copies[this.mac] = { prefs, ...(webPrefs === null ? {} : { webPrefs }) };
				this.keepCopies(file.name);
			}
			return;
		}
		if (this.db === null) {
			return;
		}
		let record: Stored;
		if (deleted) {
			record = { name: file.name, deleted: true, macBinary: null };
		} else if (game !== undefined && isHouse(game)) {
			record = { name: file.name, deleted: false, macBinary: null, scores: scoresOf(file) };
		} else if (game !== undefined) {
			return; // the game's other files (its art, the read-me files) are ours
		} else {
			record = { name: file.name, deleted: false, macBinary: writeMacBinary(file) };
		}
		this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
	}

	/** Keeps each Mac's copy of Glider's preferences, in Glider's record. */
	private keepCopies(name: string): void {
		if (this.db === null) {
			return;
		}
		const { ii, plus } = this.copies;
		const record: Stored = {
			name,
			deleted: false,
			macBinary: null,
			...(ii === undefined ? {} : { prefs: ii.prefs, ...(ii.webPrefs === undefined ? {} : { webPrefs: ii.webPrefs }) }),
			...(plus === undefined ? {} : { plus }),
		};
		this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
	}
}
