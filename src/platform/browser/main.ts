// Port: the browser page's entry point: loads the volume and the System, boots the machine, shows
// its screen at an integer scale, and runs the program `?startup=` names: Glider (`glider4`, or no
// parameter) or the desktop (`desktop`). Each program runs in a page load of its own (PORT.md,
// decision 16): quitting Glider loads the desktop's page, and opening Glider on the desktop loads
// Glider's. Glider has the port's additions (src/glider/Additions.ts): the page runs the Mac and
// screen they choose, at their scale, and starts Glider again on another Mac.

import { main as desktop, setDesktopHost } from '../../desktop/Desktop.ts';
import { type AdditionsHost, type Display, RefreshScales, setAdditionsHost } from '../../glider/Additions.ts';
import { main as glider } from '../../glider/GameBody.ts';
import { wantsMouseCapture } from '../../glider/Globals.ts';
import { ExitToShellSignal, setBeeper, setBrushes } from '../../mac/Toolbox.ts';
import { parseResourceFork } from '../../mac/ResourceFork.ts';
import { loadVolume, type VolumeManifest } from '../../mac/Volume.ts';
import { bootMachine, type MachineKind } from '../Machine.ts';
import { renderScreen } from '../Screen.ts';
import { type RGB8, windowsBrushes, windowsColors } from '../WindowsColors.ts';
import { chosenDisplay, chosenScale, keepDisplay, keepScale } from './Settings.ts';
import { beep } from './Beep.ts';
import { BrowserHost } from './Clock.ts';
import { attachInput } from './Input.ts';
import { BrowserSound } from './Sound.ts';
import { FileStore } from './Storage.ts';
import { download, inflate, pickFiles } from './PageFiles.ts';
import { exportArchive, readUploads } from '../Transfer.ts';

async function fetchBytes(path: string): Promise<Uint8Array> {
	const r = await fetch(path);
	if (!r.ok) {
		throw new Error(`cannot load ${path}: ${r.status}`);
	}
	return new Uint8Array(await r.arrayBuffer());
}

/** The largest whole number of device pixels per Mac pixel that fits the window. */
function fitFactor(width: number, height: number): number {
	const ratio = window.devicePixelRatio || 1;
	return Math.max(1, Math.floor(Math.min((window.innerWidth * ratio) / width, (window.innerHeight * ratio) / height)));
}

/** The colors a display shows the Mac II's 16 as, if not its own. */
function substituteFor(display: Display): RGB8[] | null {
	return display === 'win-16' ? windowsColors(16) : display === 'win-256' ? windowsColors(256) : null;
}

/** Glider for Windows' brushes on its displays (src/platform/WindowsColors.ts), the Mac's on others. */
function brushesFor(display: Display): void {
	setBrushes(display === 'win-16' || display === 'win-256' ? windowsBrushes : null);
}

/**
 * The Mac a display runs Glider on, with its screen's depth. Displays on the same one change at once
 * (the Mac II's color screen and Glider for Windows' two); others start Glider again.
 */
const macOf = (display: Display): string => (display === 'win-16' || display === 'win-256' ? 'ii' : display);

function showMessage(text: string): void {
	const p = document.createElement('p');
	p.className = 'message';
	p.textContent = text;
	document.body.append(p);
}

/** The page's address with `startup` set to a program. */
function startupURL(program: string): string {
	const url = new URL(location.href);
	url.searchParams.set('startup', program);
	return url.href;
}

async function start(): Promise<void> {
	const params = new URLSearchParams(location.search);
	const onDesktop = params.get('startup') === 'desktop';
	let display = chosenDisplay(params);
	let scaleChoice = chosenScale(params);
	let substitute = substituteFor(display);
	const kind: MachineKind = display === 'plus' ? 'plus' : 'ii';
	brushesFor(display);
	const manifest = (await (await fetch('data/volume.json')).json()) as VolumeManifest;
	const volume = await loadVolume(manifest, (p) => fetchBytes(`data/${p}`));
	const store = await FileStore.open();
	await store.restore(volume, kind);
	const system = parseResourceFork(await fetchBytes('data/System.rsrc'));
	const host = new BrowserHost();
	const machine = bootMachine({ kind, system, volume, application: onDesktop ? 'Desktop' : 'Glider 4.05', host, fileChanged: (f, deleted) => store.save(f, deleted), extendedKeyboard: true, blackAndWhite: display === 'ii-bw' });
	setBeeper(beep);
	const sound = new BrowserSound();

	const canvas = document.createElement('canvas');
	canvas.width = machine.width;
	canvas.height = machine.height;
	canvas.className = 'screen';
	document.body.append(canvas);
	const ctx = canvas.getContext('2d')!;
	const image = ctx.createImageData(machine.width, machine.height);
	let scale = 1;
	const layout = (): void => {
		const fit = fitFactor(machine.width, machine.height);
		scale = (scaleChoice === 0 ? fit : Math.min(scaleChoice, fit)) / (window.devicePixelRatio || 1);
		canvas.style.width = `${machine.width * scale}px`;
		canvas.style.height = `${machine.height * scale}px`;
	};
	layout();
	window.addEventListener('resize', () => {
		layout();
		RefreshScales();
	});
	attachInput({ screen: canvas, scale: () => scale, plusKeyboard: kind === 'plus', width: machine.width, height: machine.height, capture: wantsMouseCapture, wake: () => host.wake() });
	const frame = (): void => {
		sound.update();
		renderScreen(machine, image.data, true, substitute);
		ctx.putImageData(image, 0, 0);
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);

	if (onDesktop) {
		setDesktopHost({
			launch: (program) => location.assign(startupURL(program)),
			openURL: (url) => window.open(url, '_blank', 'noopener'),
			restart: () => location.reload(),
			importFiles: async () => {
				const uploads = await pickFiles();
				if (uploads === null) {
					return null;
				}
				const { files, rejected } = await readUploads(uploads, inflate);
				const added: string[] = [];
				for (const f of files) {
					if (store.import(volume, f)) {
						added.push(f.name);
					} else {
						rejected.push(f.name);
					}
				}
				return { added, rejected };
			},
			exportFiles: () => {
				const files = store.playerFiles(volume);
				if (files.length > 0) {
					download('Glider Files.zip', exportArchive(files, new Date()), 'application/zip');
				}
				return files.length;
			},
			resetPlayerData: () => store.reset(volume),
		});
		await desktop();
		return;
	}
	let restartOn: Display | null = null;
	const additions: AdditionsHost = {
		get display() {
			return display;
		},
		changesAtOnce: (d) => macOf(d) === macOf(display),
		setDisplay: (d) => {
			display = d;
			substitute = substituteFor(d);
			// The room on the screen keeps the fills it was drawn with; the next room drawn has the new ones.
			brushesFor(d);
			keepDisplay(d);
			if (params.has('machine')) {
				const url = new URL(location.href);
				url.searchParams.set('machine', d);
				history.replaceState(null, '', url.href);
			}
		},
		restartOn: (d) => {
			restartOn = d;
		},
		scales: () => {
			// Up to 400% of the page's own size, or further if more fits; the larger ones may not fit.
			const ratio = window.devicePixelRatio || 1;
			const fit = fitFactor(machine.width, machine.height);
			const most = Math.max(fit, Math.round(4 * ratio));
			return Array.from({ length: most }, (_, k) => ({ factor: k + 1, name: `${Math.round(((k + 1) / ratio) * 100)}%`, fits: k + 1 <= fit }));
		},
		get scale() {
			return scaleChoice;
		},
		setScale: (factor) => {
			scaleChoice = factor;
			keepScale(factor);
			if (params.has('scale')) {
				const url = new URL(location.href);
				url.searchParams.set('scale', String(factor));
				history.replaceState(null, '', url.href);
			}
			layout();
		},
	};
	setAdditionsHost(additions);
	try {
		await glider();
	} catch (e) {
		if (!(e instanceof ExitToShellSignal)) {
			showMessage(`Glider stopped: ${e instanceof Error ? e.message : String(e)}`);
			throw e;
		}
	}
	if (restartOn !== null) {
		// Glider again, on the Mac the additions chose: kept by the browser, or in the address if it will not keep it.
		const url = new URL(startupURL('glider4'));
		if (!keepDisplay(restartOn) || params.has('machine')) {
			url.searchParams.set('machine', restartOn);
		}
		location.assign(url.href);
		return;
	}
	// Quitting goes to the desktop, as it went to the Finder.
	location.assign(startupURL('desktop'));
}

void start();
