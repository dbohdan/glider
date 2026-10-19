// Port: SMS's sound in the browser. Each tick's samples from SMS (src/mac/SMS.ts) go to an audio
// worklet (SoundWorklet.ts), which plays them in order. The page runs SMS's VBL task up to the
// machine's tick at each animation frame, so that the sound goes on while the program waits.
//
// Browsers start sound only after the person does something on the page, so the audio context
// starts at the first key or click; sound made before then is not played.

import { GetSoundVol, setSoundOutput, SMSUpdate } from '../../mac/Toolbox.ts';

const center = 0x80;

export class BrowserSound {
	private context: AudioContext | null = null;
	private node: AudioWorkletNode | null = null;

	constructor() {
		setSoundOutput((_tick, samples) => this.play(samples));
		const start = (): void => {
			void this.start();
		};
		for (const event of ['keydown', 'pointerdown']) {
			window.addEventListener(event, start, { once: true, capture: true });
		}
	}

	/** Runs SMS up to the machine's current tick; call it at each animation frame. */
	update(): void {
		SMSUpdate();
	}

	private async start(): Promise<void> {
		if (this.context !== null) {
			return;
		}
		try {
			const context = new AudioContext();
			this.context = context;
			await context.audioWorklet.addModule(new URL('./SoundWorklet.js', import.meta.url));
			const node = new AudioWorkletNode(context, 'sms-player', { numberOfInputs: 0, outputChannelCount: [1] });
			node.connect(context.destination);
			this.node = node;
			await context.resume();
		} catch {
			// No sound in this browser.
		}
	}

	/**
	 * Sends a tick's samples to the worklet, at the Mac's volume setting (0 to 7). The Mac's
	 * hardware changes the volume in steps the port does not know; this takes them as even.
	 */
	private play(samples: Uint8Array): void {
		if (this.node === null) {
			return;
		}
		const gain = GetSoundVol() / 7;
		const out = new Float32Array(samples.length);
		for (let i = 0; i < samples.length; i++) {
			out[i] = ((samples[i]! - center) / center) * gain;
		}
		this.node.port.postMessage(out, [out.buffer]);
	}
}
