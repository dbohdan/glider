// Port: how the page shows the Mac's screen (PORT.md, decision 4): enlarged sharp, smooth, or soft
// as on a CRT, with scanlines, a glow, rounded corners, and a phosphor's tint if chosen (the
// Filters submenu, src/additions/Additions.ts). The Mac's pixels are the same whichever: only their
// showing changes. Without shaders: the 2D canvas enlarges the screen with sharp pixels by whole
// numbers, each axis its own, and the browser shrinks that smoothly to the size shown, so that how
// much each axis is enlarged first sets how soft its edges are; the rest is CSS.
//
// The numbers are to be tuned by playing: the address can set them (?soft=1&scanlines=0.35&glow=0.35
// &blur=0.75&corners=10&tint=e8eeff).

import type { Filters } from '../../additions/Additions.ts';

/** The filters' numbers, as the address may set them. */
interface Tuning {
	/**
	 * Soft: how many times the screen is enlarged sharp across before the browser smooths it; an
	 * edge is soft over 1/soft of a Mac pixel. At 1, a dither's checks blend toward gray along each
	 * row, as a CRT's limited bandwidth blended them; at 2, the result is hard to tell from sharp.
	 */
	soft: number;
	/** Scanlines: how dark the line between two of the Mac's rows is, 0 to 1. */
	scanlines: number;
	/** Glow: how strongly a blurred copy of the screen lightens it, 0 to 1, and its blur in Mac pixels. */
	glow: number;
	blur: number;
	/** Rounded corners' radius, in Mac pixels. */
	corners: number;
	/** The phosphor's white, as hex RGB. */
	tint: string;
}

function tuning(params: URLSearchParams): Tuning {
	const num = (name: string, fallback: number, min: number, max: number): number => {
		const n = Number(params.get(name));
		return params.has(name) && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
	};
	const tint = params.get('tint');
	return {
		soft: Math.round(num('soft', 1, 1, 8)),
		scanlines: num('scanlines', 0.35, 0, 1),
		glow: num('glow', 0.35, 0, 1),
		blur: num('blur', 0.75, 0, 8),
		corners: num('corners', 10, 0, 100),
		tint: tint !== null && /^[0-9a-f]{6}$/i.test(tint) ? tint : 'e8eeff',
	};
}

/** Scanlines show only where a Mac pixel is this many device pixels tall or more; below, they would only darken it. */
const scanlinesFrom = 2.5;

export class ScreenView {
	/** What the page lays out: the screen and what lies over it. */
	readonly element = document.createElement('div');
	/** The screen, which takes the mouse. */
	readonly canvas = document.createElement('canvas');
	private readonly ctx: CanvasRenderingContext2D;
	private readonly source = document.createElement('canvas');
	private readonly sourceCtx: CanvasRenderingContext2D;
	private readonly glow = document.createElement('canvas');
	private readonly glowCtx: CanvasRenderingContext2D;
	private readonly tint = document.createElement('div');
	private readonly tuning: Tuning;
	private filters: Filters = { enlarge: 'sharp', scanlines: false, glow: false, corners: false, tint: false };
	/** Device pixels per Mac pixel. */
	private factor = 1;
	/** How many times the canvas holds the screen enlarged, across and down; 0 when it holds it as it is, for the browser to enlarge pixel for pixel. */
	// -1 until the first update sizes the canvas: 0 is a size (as it is), and a canvas starts at 300 by 150.
	private across = -1;
	private down = -1;
	private lines: CanvasPattern | null = null;
	private readonly width: number;
	private readonly height: number;

	constructor(width: number, height: number, params: URLSearchParams) {
		this.width = width;
		this.height = height;
		this.tuning = tuning(params);
		this.element.className = 'screen-frame';
		this.canvas.className = 'screen';
		this.glow.className = 'screen-glow';
		this.tint.className = 'screen-tint';
		for (const c of [this.source, this.glow]) {
			c.width = width;
			c.height = height;
		}
		this.ctx = this.canvas.getContext('2d')!;
		this.sourceCtx = this.source.getContext('2d')!;
		this.glowCtx = this.glow.getContext('2d')!;
		this.element.append(this.canvas, this.glow, this.tint);
		this.tint.style.backgroundColor = `#${this.tuning.tint}`;
		this.update();
	}

	setFilters(filters: Filters): void {
		this.filters = { ...filters };
		this.update();
	}

	/** Shows the screen at a number of device pixels per Mac pixel. */
	place(factor: number): void {
		this.factor = factor;
		this.update();
	}

	private update(): void {
		const ratio = window.devicePixelRatio || 1;
		const css = this.factor / ratio;
		const whole = Number.isInteger(this.factor);
		const scanlines = this.filters.scanlines && this.factor >= scanlinesFrom;
		let across: number;
		let down: number;
		if (this.filters.enlarge === 'smooth') {
			[across, down] = [1, 1];
		} else if (this.filters.enlarge === 'soft') {
			[across, down] = [this.tuning.soft, Math.ceil(this.factor)];
		} else {
			// Sharp: at a whole number the browser enlarges the canvas pixel for pixel (0); between
			// whole numbers, the next whole one, shrunk smoothly ("sharp bilinear").
			[across, down] = whole && !scanlines ? [0, 0] : [Math.ceil(this.factor), Math.ceil(this.factor)];
		}
		if (scanlines) {
			// Rows enough for a line's edges to stay even when the browser shrinks them.
			down = Math.max(down, 4);
			if (across === 0) {
				across = Math.ceil(this.factor);
			}
		}
		if (across !== this.across || down !== this.down) {
			this.across = across;
			this.down = down;
			this.canvas.width = this.width * Math.max(1, across);
			this.canvas.height = this.height * Math.max(1, down);
		}
		this.lines = scanlines ? this.linePattern(down) : null;
		this.canvas.classList.toggle('smooth', across !== 0);
		for (const e of [this.canvas, this.glow]) {
			e.style.width = `${this.width * css}px`;
			e.style.height = `${this.height * css}px`;
		}
		this.glow.hidden = !this.filters.glow;
		this.glow.style.opacity = String(this.tuning.glow);
		this.glow.style.filter = `blur(${this.tuning.blur * css}px)`;
		this.tint.hidden = !this.filters.tint;
		this.element.style.borderRadius = this.filters.corners ? `${this.tuning.corners * css}px` : '';
	}

	/** A Mac row's worth of the canvas's rows, the last quarter darkened. */
	private linePattern(rows: number): CanvasPattern | null {
		const c = document.createElement('canvas');
		c.width = 1;
		c.height = rows;
		const g = c.getContext('2d')!;
		const dark = Math.max(1, Math.round(rows / 4));
		g.fillStyle = `rgba(0, 0, 0, ${this.tuning.scanlines})`;
		g.fillRect(0, rows - dark, 1, dark);
		return this.ctx.createPattern(c, 'repeat');
	}

	/** Shows a frame of the screen. */
	draw(image: ImageData): void {
		if (this.across === 0) {
			this.ctx.putImageData(image, 0, 0);
		} else {
			this.sourceCtx.putImageData(image, 0, 0);
			this.ctx.imageSmoothingEnabled = false;
			this.ctx.drawImage(this.source, 0, 0, this.canvas.width, this.canvas.height);
			if (this.lines !== null) {
				this.ctx.fillStyle = this.lines;
				this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
			}
		}
		if (this.filters.glow) {
			this.glowCtx.putImageData(image, 0, 0);
		}
	}
}
