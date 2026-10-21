// A small IndexedDB in memory, for testing the browser's storage (src/platform/browser/Storage.ts) in
// Node: the calls it makes (open, one object store keyed by a property, getAll, put, delete, and a
// transaction's oncomplete), each completing on a later task, as a browser's do. Records are copied
// in and out with structuredClone, as IndexedDB copies them. Install it as `indexedDB` while a test
// runs; the same `MemoryIndexedDB` kept between FileStore.open calls is the browser's storage kept
// between page loads.

type Callback = (() => void) | null;

class Request<T> {
	result!: T;
	error: Error | null = null;
	onsuccess: Callback = null;
	onerror: Callback = null;
	onupgradeneeded: Callback = null;
}

class ObjectStore {
	private readonly rows: Map<unknown, unknown>;
	private readonly keyPath: string;
	private readonly tx: Transaction;

	constructor(rows: Map<unknown, unknown>, keyPath: string, tx: Transaction) {
		this.rows = rows;
		this.keyPath = keyPath;
		this.tx = tx;
	}

	getAll(): Request<unknown[]> {
		const req = new Request<unknown[]>();
		this.tx.later(() => {
			req.result = [...this.rows.entries()].toSorted(([a], [b]) => (String(a) < String(b) ? -1 : 1)).map(([, v]) => structuredClone(v));
			req.onsuccess?.();
		});
		return req;
	}

	put(value: Record<string, unknown>): Request<unknown> {
		const copy = structuredClone(value);
		this.tx.later(() => this.rows.set(copy[this.keyPath], copy));
		return new Request();
	}

	delete(key: unknown): Request<unknown> {
		this.tx.later(() => this.rows.delete(key));
		return new Request();
	}
}

class Transaction {
	oncomplete: Callback = null;
	onerror: Callback = null;
	error: Error | null = null;
	private pending = 0;
	private readonly db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	objectStore(name: string): ObjectStore {
		const s = this.db.stores.get(name)!;
		return new ObjectStore(s.rows, s.keyPath, this);
	}

	/** Runs a step of the transaction on a later task, and completes it once the last has run. */
	later(step: () => void): void {
		this.pending++;
		setTimeout(() => {
			step();
			if (--this.pending === 0) {
				setTimeout(() => this.oncomplete?.());
			}
		});
	}
}

class Database {
	readonly stores = new Map<string, { keyPath: string; rows: Map<unknown, unknown> }>();

	createObjectStore(name: string, options: { keyPath: string }): void {
		this.stores.set(name, { keyPath: options.keyPath, rows: new Map() });
	}

	transaction(_name: string, _mode?: string): Transaction {
		return new Transaction(this);
	}
}

export class MemoryIndexedDB {
	private readonly dbs = new Map<string, Database>();

	open(name: string, _version: number): Request<Database> {
		const req = new Request<Database>();
		setTimeout(() => {
			let db = this.dbs.get(name);
			if (db === undefined) {
				db = new Database();
				this.dbs.set(name, db);
				req.result = db;
				req.onupgradeneeded?.();
			}
			req.result = db;
			req.onsuccess?.();
		});
		return req;
	}
}

/** Runs a test body with `indexedDB` as the given store (the browser's, kept between its page loads). */
export async function withIndexedDB<T>(idb: MemoryIndexedDB, body: () => Promise<T>): Promise<T> {
	const g = globalThis as { indexedDB?: unknown };
	const before = g.indexedDB;
	g.indexedDB = idb;
	try {
		return await body();
	} finally {
		g.indexedDB = before;
	}
}

/** Waits until the writes a store started have reached the database. */
export function settled(): Promise<void> {
	return new Promise((resolve) => setTimeout(() => setTimeout(() => setTimeout(resolve))));
}
