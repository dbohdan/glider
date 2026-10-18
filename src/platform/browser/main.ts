// Port: the browser page's entry point: loads the volume and the System, boots the machine, shows
// its screen at an integer scale, and runs Glider.

import { main as glider } from '../../glider/GameBody.ts';
import { wantsMouseCapture } from '../../glider/Globals.ts';
import { ExitToShellSignal, setBeeper, setStandardFileHost } from '../../mac/Toolbox.ts';
import { parseResourceFork } from '../../mac/ResourceFork.ts';
import { loadVolume, type VolumeManifest } from '../../mac/Volume.ts';
import { bootMachine, type MachineKind } from '../Machine.ts';
import { renderScreen } from '../Screen.ts';
import { beep } from './Beep.ts';
import { BrowserHost } from './Clock.ts';
import { browserFilePicker } from './FilePicker.ts';
import { attachInput } from './Input.ts';
import { FileStore } from './Storage.ts';

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

async function start(): Promise<void> {
	const params = new URLSearchParams(location.search);
	const kind: MachineKind = params.get('machine') === 'plus' ? 'plus' : 'ii';
	const manifest = (await (await fetch('data/volume.json')).json()) as VolumeManifest;
	const volume = await loadVolume(manifest, (p) => fetchBytes(`data/${p}`));
	const store = await FileStore.open();
	await store.restore(volume);
	const system = parseResourceFork(await fetchBytes('data/System.rsrc'));
	const host = new BrowserHost();
	const machine = bootMachine({ kind, system, volume, application: 'Glider 4.05', host, fileChanged: (f, deleted) => store.save(f, deleted), extendedKeyboard: true });
	setBeeper(beep);
	setStandardFileHost(browserFilePicker);

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
		renderScreen(machine, image.data);
		ctx.putImageData(image, 0, 0);
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);

	try {
		await glider();
		showMessage('Glider has quit.');
	} catch (e) {
		if (e instanceof ExitToShellSignal) {
			showMessage('Glider has quit.');
		} else {
			showMessage(`Glider stopped: ${e instanceof Error ? e.message : String(e)}`);
			throw e;
		}
	}
}

void start();
