// Port: the audio thread's side of SMS's sound (see Sound.ts): plays each tick's samples, sent by
// the page as they are made, at the Mac's 22254.5 samples a second, holding each sample until the
// next as the Mac's sound hardware does.

// The audio worklet's global scope, which the DOM's types do not describe.
declare const sampleRate: number;
declare abstract class AudioWorkletProcessor {
	readonly port: MessagePort;
	abstract process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

/** The Mac's sample rate: 370 samples a tick, 60.15 ticks a second. */
const macRate = 22254.545;
/** Ticks of sound to have waiting before playing, so that the page's timing does not leave gaps. */
const lead = 2;
/** Ticks of sound beyond which the oldest are dropped, so that the sound keeps up with the game. */
const most = 8;

class SMSPlayer extends AudioWorkletProcessor {
	private queue: Float32Array[] = [];
	private queued = 0;
	/** Where in the first queued tick the next sample comes from, in Mac samples. */
	private at = 0;
	private playing = false;
	private readonly step = macRate / sampleRate;

	constructor() {
		super();
		this.port.onmessage = (e: MessageEvent<Float32Array>) => {
			this.queue.push(e.data);
			this.queued += e.data.length;
			while (this.queued > most * e.data.length) {
				this.queued -= this.queue.shift()!.length;
				this.at = 0;
			}
		};
	}

	process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
		const out = outputs[0]![0]!;
		const tick = this.queue[0]?.length ?? 370;
		if (!this.playing && this.queued >= lead * tick) {
			this.playing = true;
		}
		for (let i = 0; i < out.length; i++) {
			const samples = this.queue[0];
			if (!this.playing || samples === undefined) {
				this.playing = false;
				out[i] = 0;
				continue;
			}
			out[i] = samples[Math.floor(this.at)]!;
			this.at += this.step;
			if (this.at >= samples.length) {
				this.at -= samples.length;
				this.queued -= samples.length;
				this.queue.shift();
			}
		}
		return true;
	}
}

registerProcessor('sms-player', SMSPlayer);
