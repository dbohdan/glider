// Port: SysBeep. The System's beep sound is Apple's; the port plays a short square wave instead.

let audio: AudioContext | null = null;

export function beep(): void {
	try {
		audio ??= new AudioContext();
		const osc = audio.createOscillator();
		const gain = audio.createGain();
		osc.type = 'square';
		osc.frequency.value = 880;
		gain.gain.value = 0.1;
		osc.connect(gain).connect(audio.destination);
		osc.start();
		osc.stop(audio.currentTime + 0.12);
	} catch {
		// no audio
	}
}
