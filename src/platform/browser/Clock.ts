// Port: the machine's clock in the browser. Time runs with the page's clock while the page is
// visible and stops while it is hidden, so that the program finds itself where it left off.

import type { Host } from '../../mac/Toolbox.ts';

export class BrowserHost implements Host {
	private elapsed = 0;
	private since: number | null = performance.now();
	private wakers: (() => void)[] = [];

	constructor() {
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.pause();
			} else {
				this.resume();
			}
		});
		if (document.hidden) {
			this.pause();
		}
	}

	private pause(): void {
		if (this.since !== null) {
			this.elapsed += performance.now() - this.since;
			this.since = null;
		}
	}

	private resume(): void {
		if (this.since === null) {
			this.since = performance.now();
			this.wake();
		}
	}

	now(): number {
		return this.since === null ? this.elapsed : this.elapsed + performance.now() - this.since;
	}

	/** Resolves when the machine's time reaches `ms`, or earlier when input arrives. */
	sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const done = (): void => {
				clearTimeout(timer);
				this.wakers = this.wakers.filter((w) => w !== done);
				resolve();
			};
			this.wakers.push(done);
			const arm = (): void => {
				if (this.since === null) {
					return; // hidden: wait for resume, which wakes everyone
				}
				const wait = ms - this.now();
				if (wait <= 0) {
					done();
				} else {
					timer = setTimeout(arm, wait);
				}
			};
			arm();
		});
	}

	/** Lets waiting code look at new input. */
	wake(): void {
		// Each waker replaces the list without itself, so this one stays whole.
		const wakers = this.wakers;
		for (const w of wakers) {
			w();
		}
	}
}
