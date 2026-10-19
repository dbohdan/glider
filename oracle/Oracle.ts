// The oracle: the original Glider running in a headless, deterministic Mac emulator.
//
// Inputs are fetched into oracle/cache/ (never committed) and verified by SHA-256:
// ROMs, a System 6.0.8 disk, and Glider 4.06 from the Infinite Mac project, and the Mini vMac source.

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { encodeMacRoman } from '../src/mac/MacRoman.ts';
import { fourCCAt, put16, u16 } from '../src/mac/Binary.ts';
import { parseResourceFork, type ResourceFork, writeResourceFork } from '../src/mac/ResourceFork.ts';
import { type MacFile, parseMacBinary, writeMacBinary } from '../src/mac/MacBinary.ts';
import { type Image, readPNM, writePNG } from './Image.ts';
import type { Script } from './Script.ts';
import { readZip } from './Zip.ts';

export const oracleDir = new URL('.', import.meta.url).pathname;
export const cacheDir = join(oracleDir, 'cache');

const infiniteMac = 'https://raw.githubusercontent.com/mihaip/infinite-mac/a56fff18e1b7e6e6c80d307a35ed30b7fd94d36a/';
const miniVMacRepo = 'https://github.com/mihaip/minivmac';
const miniVMacCommit = '0bcab1d51ce240489b98b21b744ddfcddf01659e';

interface Input {
	url: string;
	sha256: string;
}

const inputs: Record<string, Input> = {
	'Mac-Plus.rom': {
		url: infiniteMac + 'src/Data/Mac-Plus.rom',
		sha256: 'dd908e2b65772a6b1f0c859c24e9a0d3dcde17b1c6a24f4abd8955846d7895e7',
	},
	'Mac-II.rom': {
		url: infiniteMac + 'src/Data/Mac-II.rom',
		sha256: '97f2a22bdb8972bfcc1f16aff1ebbe157887c26787a1c81747a9842fa7b97a06',
	},
	'System 6.0.8 HD.dsk': {
		url: infiniteMac + 'Images/System%206.0.8%20HD.dsk',
		sha256: 'c8087de9c410360625ed1d3ca6f9f3b019af6ab469f422cf6a127fed84f0324e',
	},
	'Glider.zip': {
		url: infiniteMac + 'Library/Games/Glider.zip',
		sha256: '0433c953d985775b7ce0fe3c859305bdcfe55270de1490eec872dfc81cd33c8d',
	},
};

export interface Machine {
	name: string;
	rom: string;
	setupOptions: string[];
	/** What SysEnvirons reports as keyBoardType. */
	keyboardType: number;
}

/** A Mac Plus with 4 MB. */
export const macPlus: Machine = { name: 'plus', rom: 'Mac-Plus.rom', setupOptions: ['-m', 'Plus'], keyboardType: 3 };

/** A Mac II with 8 MB and a 640×480 display of up to 16 colors, and a standard ADB keyboard. */
export const macII: Machine = { name: 'ii', rom: 'Mac-II.rom', setupOptions: ['-m', 'II', '-hres', '640', '-vres', '480', '-depth', '2'], keyboardType: 5 };

function sha256(b: Uint8Array): string {
	return createHash('sha256').update(b).digest('hex');
}

export async function fetchInputs(): Promise<void> {
	mkdirSync(cacheDir, { recursive: true });
	for (const [name, input] of Object.entries(inputs)) {
		const path = join(cacheDir, name);
		if (existsSync(path) && sha256(readFileSync(path)) === input.sha256) {
			continue;
		}
		console.log(`fetching ${name}`);
		const res = await fetch(input.url);
		if (!res.ok) {
			throw new Error(`${input.url}: ${res.status} ${res.statusText}`);
		}
		const bytes = new Uint8Array(await res.arrayBuffer());
		const hash = sha256(bytes);
		if (hash !== input.sha256) {
			throw new Error(`${name}: SHA-256 is ${hash}, expected ${input.sha256}`);
		}
		writeFileSync(path, bytes);
	}
}

function fetchMiniVMac(): string {
	const dir = join(cacheDir, 'minivmac-src');
	const head = () => execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
	if (existsSync(join(dir, '.git')) && head() === miniVMacCommit) {
		return dir;
	}
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	const git = (...args: string[]) => execFileSync('git', ['-C', dir, ...args], { stdio: 'inherit' });
	git('init', '-q');
	git('fetch', '-q', '--depth', '1', miniVMacRepo, miniVMacCommit);
	git('checkout', '-q', 'FETCH_HEAD');
	return dir;
}

export function emulatorPath(m: Machine): string {
	return join(cacheDir, `minivmac-${m.name}`, 'minivmac');
}

export function buildEmulator(m: Machine): void {
	const src = fetchMiniVMac();
	const marker = join(cacheDir, `minivmac-${m.name}`, 'built-from');
	const stamp = sha256(new Uint8Array([...readFileSync(join(oracleDir, 'minivmac', 'OSGLUHDL.c')), ...readFileSync(join(oracleDir, 'build-minivmac.sh'))])) + ' ' + miniVMacCommit;
	if (existsSync(marker) && readFileSync(marker, 'utf8') === stamp) {
		return;
	}
	console.log(`building Mini vMac (${m.name})`);
	execFileSync(join(oracleDir, 'build-minivmac.sh'), [src, join(cacheDir, `minivmac-${m.name}`), ...m.setupOptions, '-n', `minivmac-${m.name}`], { stdio: 'inherit' });
	writeFileSync(marker, stamp);
}

/** Reads a file of Infinite Mac's library format: data fork, `.rsrc/` resource fork, `.finf/` Finder information. */
function libraryFile(files: Map<string, Uint8Array>, dir: string, name: string): MacFile {
	const data = files.get(`${dir}/${name}`);
	const rsrc = files.get(`${dir}/.rsrc/${name}`) ?? new Uint8Array(0);
	const finf = files.get(`${dir}/.finf/${name}`);
	if (data === undefined || finf === undefined) {
		throw new Error(`${dir}/${name} is missing`);
	}
	return { name, type: fourCCAt(finf, 0), creator: fourCCAt(finf, 4), finderFlags: u16(finf, 8), created: 0, modified: 0, data, rsrc };
}

/** The files of Glider 4.06 as distributed. */
export function glider406(): Map<string, MacFile> {
	const zip = readZip(readFileSync(join(cacheDir, 'Glider.zip')));
	const files = new Map(zip.map((e) => [e.name, e.data]));
	const dir = 'Glider 4.06 - for 68K Macs';
	const out = new Map<string, MacFile>();
	for (const name of ['Glider 4.06', 'Color Art', 'B&W Art', 'The House', 'The House 2']) {
		out.set(name, libraryFile(files, dir, name));
	}
	return out;
}

/**
 * A stand-in for the "MacsBug" file that Glider 4.05 and later ship for compact Macs:
 * C. Holmén's Mission Screen INIT disguised as a debugger, so that the system loads it at startup
 * before any application. It reserves the alternate screen buffer for page flipping and leaves a
 * signature there, a Pascal string starting with "alt", which Glider checks before flipping pages.
 * This is our own minimal code with the same effect, not a copy.
 */
export function alternateScreenFile(): MacFile {
	const code = [
		0x2078, 0x010c, //         movea.l BufPtr, a0
		0x91fc, 0x0000, 0x8020, // suba.l  #$8020, a0      ; the alternate screen and 32 bytes
		0x21c8, 0x010c, //         move.l  a0, BufPtr
		0x2078, 0x0824, //         movea.l ScrnBase, a0
		0x91fc, 0x0000, 0x8020, // suba.l  #$8020, a0      ; Glider's kPointerBase
		0x43fa, 0x000c, //         lea     signature, a1
		0x7003, //                 moveq   #3, d0
		0x10d9, //         loop:   move.b  (a1)+, (a0)+
		0x51c8, 0xfffc, //         dbra    d0, loop
		0x4e75, //                 rts
		0x0361, 0x6c74, // signature: dc.b 3, 'alt'
	];
	const data = new Uint8Array(512 + code.length * 2);
	code.forEach((w, i) => {
		data[512 + i * 2] = w >> 8;
		data[513 + i * 2] = w & 0xff;
	});
	return { name: 'MacsBug', type: 'dbgr', creator: 'GLor', finderFlags: 0, created: 0, modified: 0, data, rsrc: new Uint8Array(0) };
}

/** Returns a copy of a file with its resources edited. */
export function editResources(f: MacFile, edit: (rf: ResourceFork) => void): MacFile {
	const rf = parseResourceFork(f.rsrc);
	edit(rf);
	return { ...f, rsrc: writeResourceFork(rf) };
}

/**
 * Glider 4.06 set up for a machine: its preferences name the machine's keyboard,
 * so that the "New keyboard" alert does not appear.
 */
export function gliderFor(m: Machine, edit?: (rf: ResourceFork) => void): MacFile {
	return editResources(glider406().get('Glider 4.06')!, (rf) => {
		const prefs = rf.get('Gprf', 128)!;
		const data = new Uint8Array(prefs.data);
		put16(data, prefsKeyboardOffset, m.keyboardType);
		rf.put({ ...prefs, data });
		edit?.(rf);
	});
}

/** The offset of keyBoardIs in the prefType record of G-GameBody.p. */
const prefsKeyboardOffset = 168;

/** The title screen pictures, which the oracle replaces with test pictures. */
export const rIdleID = 200;
export const rColorIdleID = 210;

/**
 * Runs hfsutils commands with a directory of their own as home, where they keep the current
 * volume ($HOME/.hcwd); the directory also holds temporary files. Each caller gets a new one, so
 * that oracle runs in parallel processes do not copy files onto each other's disks.
 */
function withHFS<T>(body: (hfs: (...args: string[]) => string, tmp: string) => T): T {
	mkdirSync(cacheDir, { recursive: true });
	const tmp = mkdtempSync(join(cacheDir, 'hfs-'));
	try {
		return body((...args) => execFileSync(args[0]!, args.slice(1), { encoding: 'latin1', env: { ...process.env, HOME: tmp } }), tmp);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

/** Extracts the System and Finder from the Infinite Mac disk. */
export function systemFiles(): MacFile[] {
	const dir = join(cacheDir, 'system');
	const names = ['System', 'Finder'];
	if (!names.every((n) => existsSync(join(dir, n + '.bin')))) {
		mkdirSync(dir, { recursive: true });
		const copy = join(dir, 'source.dsk');
		writeFileSync(copy, readFileSync(join(cacheDir, 'System 6.0.8 HD.dsk')));
		withHFS((hfs) => {
			hfs('hmount', copy);
			for (const n of names) {
				hfs('hcopy', '-m', `:System Folder:${n}`, join(dir, n + '.bin'));
			}
			hfs('humount');
		});
		writeFileSync(join(dir, 'bootblocks'), readFileSync(copy).subarray(0, 1024));
		rmSync(copy);
	}
	return names.map((n) => parseMacBinary(readFileSync(join(dir, n + '.bin'))));
}

/** A file from a disk the oracle ran, such as one the program saved (`path` in HFS form, ":System Folder:Game"). */
export function readDiskFile(disk: string, path: string): MacFile {
	return withHFS((hfs, tmp) => {
		hfs('hmount', disk);
		try {
			hfs('hcopy', '-m', path, join(tmp, 'file.bin'));
		} finally {
			hfs('humount');
		}
		return parseMacBinary(readFileSync(join(tmp, 'file.bin')));
	});
}

/**
 * Builds a boot disk with a System Folder holding the System, the Finder, and the given files,
 * which launches `startup` at boot instead of the Finder (and without MultiFinder).
 */
export function makeDisk(path: string, files: MacFile[], startup: string, megabytes = 8): void {
	const system = systemFiles();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, new Uint8Array(megabytes * 1024 * 1024));
	withHFS((hfs, tmp) => {
		hfs('hformat', '-l', 'Oracle HD', path);
		hfs('hmkdir', ':System Folder');
		[...system, ...files].forEach((f, i) => {
			const bin = join(tmp, `${i}.bin`);
			writeFileSync(bin, writeMacBinary(f));
			hfs('hcopy', '-m', bin, `:System Folder:${f.name}`);
		});
		hfs('hattrib', '-b', ':System Folder');
		hfs('humount');
	});
	// The boot blocks name the startup application (bbHelloName at offset 0x5A, a Str15).
	const boot = new Uint8Array(readFileSync(join(cacheDir, 'system', 'bootblocks')));
	const name = encodeMacRoman(startup);
	if (name.length > 15) {
		throw new Error(`startup name ${startup} is too long`);
	}
	boot.fill(0, 0x5a, 0x6a);
	boot[0x5a] = name.length;
	boot.set(name, 0x5b);
	const disk = readFileSync(path);
	disk.set(boot, 0);
	writeFileSync(path, disk);
}

export interface RunResult {
	/** Screenshots by name. */
	shots: Map<string, Image>;
	/** Everything the emulator printed. */
	output: string;
	dir: string;
}

/**
 * Runs a script on a machine booting from a copy of a disk; screenshots and RAM dumps go to `dir`.
 * The disk itself stays as it was: Glider writes to its disk (high scores into the house,
 * preferences), and a second run from a used disk once started with the first run's scores.
 */
export function run(m: Machine, script: Script, disk: string, dir: string): RunResult {
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'script.txt'), script.text());
	const copy = join(dir, 'disk.dsk');
	writeFileSync(copy, readFileSync(disk));
	// Trap traces print hundreds of megabytes at high speeds; the default limit is 1 MB.
	const res = spawnSync(emulatorPath(m), [join(cacheDir, m.rom), 'script.txt', copy], { cwd: dir, encoding: 'utf8', maxBuffer: 2 ** 30 });
	rmSync(copy);
	if (res.status !== 0 || res.stderr) {
		throw new Error(`emulator failed (${res.status}): ${res.error?.message ?? res.stderr}`);
	}
	writeFileSync(join(dir, 'output.txt'), res.stdout);
	const shots = new Map<string, Image>();
	for (const { name } of script.shots) {
		shots.set(name, readPNM(readFileSync(join(dir, name))));
	}
	return { shots, output: res.stdout, dir };
}

/** Writes PNG copies of a run's screenshots for people to look at. */
export function savePNGs(r: RunResult): string[] {
	const out: string[] = [];
	for (const [name, img] of r.shots) {
		const path = join(r.dir, name + '.png');
		writeFileSync(path, writePNG(img));
		out.push(path);
	}
	return out;
}
