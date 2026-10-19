// Port: SMS's sound in the browser. Each tick's samples from SMS (src/mac/SMS.ts) are played as
// a short buffer at the Mac's 22254.5 samples a second, one after another; the browser converts
// them to its own rate. The page runs SMS's VBL task up to the machine's tick at each animation
// frame, so that the sound goes on while the program waits.
//
// Buffers rather than an audio worklet, because browsers offer worklets only to secure pages, and
// the page is often served over plain HTTP on a local network while it is being worked on.
//
// Browsers start sound only after the person does something on the page, so the audio context
// starts at the first key or click; sound made before then is not played.

import { GetSoundVol, setSoundOutput, SMSUpdate } from '../../mac/Toolbox.ts';

const center = 0x80;
/** The Mac's sample rate: 370 samples a tick, 60.15 ticks a second. */
const macRate = 22254.545;
/** How far ahead of the audio clock sound is scheduled, so that the page's timing leaves no gaps. */
const lead = 0.05;
/** How far ahead it may get before sound is dropped, so that it keeps up with the game. */
const most = 0.2;

export class BrowserSound {
	private context: AudioContext | null = null;
	/** The samples made in this animation frame, played together. */
	private pending: Uint8Array[] = [];
	/** When the next samples are to start, on the audio clock. */
	private next = 0;

	constructor() {
		setSoundOutput((_tick, samples) => {
			if (this.context !== null) {
				this.pending.push(samples.slice());
			}
		});
		const start = (): void => {
			this.start();
		};
		for (const event of ['keydown', 'pointerdown']) {
			window.addEventListener(event, start, { once: true, capture: true });
		}
	}

	/** Runs SMS up to the machine's current tick and plays what it made; call it at each animation frame. */
	update(): void {
		SMSUpdate();
		this.flush();
	}

	private start(): void {
		if (this.context !== null) {
			return;
		}
		try {
			this.context = new AudioContext();
			void this.context.resume();
		} catch {
			// No sound in this browser.
		}
	}

	/**
	 * Plays the frame's samples after those before, at the Mac's volume setting (0 to 7). The
	 * Mac's hardware changes the volume in steps the port does not know; this takes them as even.
	 */
	private flush(): void {
		const context = this.context;
		if (context === null || this.pending.length === 0) {
			return;
		}
		const length = this.pending.reduce((n, s) => n + s.length, 0);
		const buffer = context.createBuffer(1, length, macRate);
		const out = buffer.getChannelData(0);
		const gain = GetSoundVol() / 7;
		let i = 0;
		for (const samples of this.pending) {
			for (const v of samples) {
				out[i++] = ((v - center) / center) * gain;
			}
		}
		this.pending = [];
		const now = context.currentTime;
		if (this.next < now + lead / 2) {
			this.next = now + lead;
		}
		if (this.next > now + most) {
			return;
		}
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(context.destination);
		source.start(this.next);
		this.next += length / macRate;
	}
}
