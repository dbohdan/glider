// Port: the browser page's entry point: loads the volume and the System, boots the machine, shows
// its screen at an integer scale, and runs the program `?startup=` names: Glider (`glider4`, or no
// parameter) or the desktop (`desktop`). Each program runs in a page load of its own (PORT.md,
// decision 16): quitting Glider loads the desktop's page, and opening Glider on the desktop loads
// Glider's.

import { main as desktop, setDesktopHost } from '../../desktop/Desktop.ts';
import { main as glider } from '../../glider/GameBody.ts';
import { wantsMouseCapture } from '../../glider/Globals.ts';
import { ExitToShellSignal, setBeeper } from '../../mac/Toolbox.ts';
import { parseResourceFork } from '../../mac/ResourceFork.ts';
import { loadVolume, type VolumeManifest } from '../../mac/Volume.ts';
import { bootMachine, type MachineKind } from '../Machine.ts';
import { renderScreen } from '../Screen.ts';
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

/** The largest whole number of screen pixels per Mac pixel that fits the window. */
function fitScale(width: number, height: number): number {
	const ratio = window.devicePixelRatio || 1;
	return Math.max(1, Math.floor(Math.min((window.innerWidth * ratio) / width, (window.innerHeight * ratio) / height))) / ratio;
}

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
	const kind: MachineKind = params.get('machine') === 'plus' ? 'plus' : 'ii';
	const manifest = (await (await fetch('data/volume.json')).json()) as VolumeManifest;
	const volume = await loadVolume(manifest, (p) => fetchBytes(`data/${p}`));
	const store = await FileStore.open();
	await store.restore(volume);
	const system = parseResourceFork(await fetchBytes('data/System.rsrc'));
	const host = new BrowserHost();
	const machine = bootMachine({ kind, system, volume, application: onDesktop ? 'Desktop' : 'Glider 4.05', host, fileChanged: (f, deleted) => store.save(f, deleted), extendedKeyboard: true });
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
		scale = fitScale(machine.width, machine.height);
		canvas.style.width = `${machine.width * scale}px`;
		canvas.style.height = `${machine.height * scale}px`;
	};
	layout();
	window.addEventListener('resize', layout);
	attachInput({ screen: canvas, scale: () => scale, plusKeyboard: kind === 'plus', width: machine.width, height: machine.height, capture: wantsMouseCapture, wake: () => host.wake() });
	const frame = (): void => {
		sound.update();
		renderScreen(machine, image.data);
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
	try {
		await glider();
	} catch (e) {
		if (!(e instanceof ExitToShellSignal)) {
			showMessage(`Glider stopped: ${e instanceof Error ? e.message : String(e)}`);
			throw e;
		}
	}
	// Quitting goes to the desktop, as it went to the Finder.
	location.assign(startupURL('desktop'));
}

void start();
