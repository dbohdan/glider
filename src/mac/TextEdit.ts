// Port: TextEdit (Inside Macintosh I, chapter 12), for dialog text items and TextBox, and styled
// TextEdit (Inside Macintosh V) as far as the Room Editor's help shows it: text in runs of fonts,
// sizes, faces and colors, read from a 'styl' resource, scrolled and copied.
//
// Word wrap at the destination rectangle's width, the caret, selection, typing, and the mouse. The
// oracle shows text drawn 1 pixel right of the destination rectangle's left edge, with the first
// baseline the font's ascent below its top; styled text gives each line the height and ascent of
// the tallest run on it.

import { getHost, mouse, TickCount, tickTime } from './OS.ts';
import { GetCaretTime, GetDblTime } from './Events.ts';
import { Handle } from './Resources.ts';
import {
	ClipRect,
	DrawText,
	EraseRect,
	GetClip,
	GetFontInfo,
	type GrafPort,
	GlobalToLocal,
	InvertRect,
	setHiliteMode,
	MoveTo,
	NewRgn,
	RGBForeColor,
	type RGBColor,
	SectRect,
	SectRgn,
	SetClip,
	SetPort,
	srcOr,
	TextFace,
	TextFont,
	TextMode,
	TextSize,
	TextWidth,
	thePort,
} from './QuickDraw.ts';
import { rectRegion } from './Region.ts';
import { decodeMacRoman, encodeMacRoman } from './MacRoman.ts';
import type { Integer, LongInt, Point, Rect } from './Types.ts';

/** Justification. */
export const teJustLeft = 0;
export const teJustCenter = 1;
export const teJustRight = -1;
export const teFlushDefault = 0;

/** The text starts this far right of the destination rectangle's left edge (seen in the oracle). */
const textInset = 1;

/** Pascal `TERec` (a TEHandle is a TERec). */
export class TERec {
	destRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	viewRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	lineHeight: Integer = 0;
	fontAscent: Integer = 0;
	selStart: Integer = 0;
	selEnd: Integer = 0;
	active = false;
	just: Integer = teJustLeft;
	/** The text, shared with whoever gave it (a dialog's edit text item). */
	hText: Handle = new Handle(new Uint8Array(0));
	/** Negative to break lines only at returns. */
	crOnly: Integer = 0;
	txFont: Integer = 0;
	txFace: Integer = 0;
	txMode: Integer = srcOr;
	txSize: Integer = 0;
	inPort!: GrafPort;
	/** Offsets where lines start, with the text's length at the end. */
	lineStarts: Integer[] = [0, 0];
	/** Styled text's runs, in order of their starts (TEStylNew); null for text in one style. */
	styleRuns: StyleRun[] | null = null;
	/** For styled text, each line's height and ascent: those of the tallest run on it. */
	lineHeights: Integer[] = [];
	lineAscents: Integer[] = [];
	/** Whether typing and clicking scroll the selection into view (TEAutoView). */
	autoView = false;
	caretState = false;
	caretTime: LongInt = 0;
	clickTime: LongInt = 0;
	clickLoc: Integer = -1;

	get teLength(): Integer {
		return this.hText.data.length;
	}

	get nLines(): Integer {
		return this.lineStarts.length - 1;
	}
}

export type TEHandle = TERec;

/** Pascal `TextStyle`, with the height and ascent its font gives (a styled record's style table). */
export interface TextStyle {
	tsFont: Integer;
	tsFace: Integer;
	tsSize: Integer;
	tsColor: RGBColor;
}

/** A run of styled text: where it starts, its style, and its font's line height and ascent. */
export interface StyleRun {
	start: Integer;
	style: TextStyle;
	height: Integer;
	ascent: Integer;
}

/** Pascal `TEInit`: the scrap is empty. */
export function TEInit(): void {
	scrap = new Uint8Array(0);
}

let scrap = new Uint8Array(0);

/** Pascal `TENew`: a record for the current port, with its font. */
export function TENew(destRect: Rect, viewRect: Rect): TERec {
	const te = new TERec();
	te.destRect = { ...destRect };
	te.viewRect = { ...viewRect };
	te.inPort = thePort;
	te.txFont = thePort.txFont;
	te.txFace = thePort.txFace;
	te.txMode = thePort.txMode;
	te.txSize = thePort.txSize;
	const info = { ascent: 0, descent: 0, widMax: 0, leading: 0 };
	GetFontInfo(info);
	te.lineHeight = info.ascent + info.descent + info.leading;
	te.fontAscent = info.ascent;
	TECalText(te);
	return te;
}

export function TEDispose(_te: TERec): void {}

/**
 * Pascal `TEStylNew` (TEStyleNew): a record for styled text in the current port, starting in the
 * port's font. Its lineHeight and fontAscent are -1, as the lines' own heights take their place.
 */
export function TEStylNew(destRect: Rect, viewRect: Rect): TERec {
	const te = TENew(destRect, viewRect);
	te.styleRuns = [runOf(te, { tsFont: te.txFont, tsFace: te.txFace, tsSize: te.txSize, tsColor: { red: 0, green: 0, blue: 0 } }, 0)];
	te.lineHeight = -1;
	te.fontAscent = -1;
	TECalText(te);
	return te;
}

/** A run in a style, with its font's line height and ascent, measured in the record's port. */
function runOf(te: TERec, style: TextStyle, start: Integer): StyleRun {
	return inPort(te, () => {
		TextFont(style.tsFont);
		TextSize(style.tsSize);
		TextFace(style.tsFace);
		const info = { ascent: 0, descent: 0, widMax: 0, leading: 0 };
		GetFontInfo(info);
		return { start, style, height: info.ascent + info.descent + info.leading, ascent: info.ascent };
	});
}

/**
 * Pascal `TEStylInsert` (TEDispatch selector 7): inserts text at the selection with the styles of a
 * 'styl' resource (StScrpRec: a count, then per run its start, height, ascent, font, face, size and
 * color). Port: as the help uses it, into an empty record.
 */
export function TEStylInsert(text: Uint8Array, length: LongInt, styl: Handle | null, te: TERec): void {
	TEInsert(text, length, te);
	const d = styl?.data;
	if (d === undefined || d.length < 2) {
		return;
	}
	const s16 = (o: number): number => (((d[o]! << 8) | d[o + 1]!) << 16) >> 16;
	const u16 = (o: number): number => (d[o]! << 8) | d[o + 1]!;
	const runs: StyleRun[] = [];
	for (let i = 0, n = s16(0); i < n; i++) {
		const o = 2 + i * 20;
		const start = ((d[o]! << 24) | (d[o + 1]! << 16) | (d[o + 2]! << 8) | d[o + 3]!) >>> 0;
		const style = { tsFont: s16(o + 8), tsFace: d[o + 10]!, tsSize: s16(o + 12), tsColor: { red: u16(o + 14), green: u16(o + 16), blue: u16(o + 18) } };
		runs.push({ start, style, height: s16(o + 4), ascent: s16(o + 6) });
	}
	te.styleRuns = runs;
	TECalText(te);
}

/** The run a character is in. */
function runAt(te: TERec, offset: Integer): StyleRun {
	const runs = te.styleRuns!;
	let k = 0;
	while (k + 1 < runs.length && runs[k + 1]!.start <= offset) {
		k++;
	}
	return runs[k]!;
}

/** Sets the port's text to a run's style. */
function useStyle(run: StyleRun): void {
	TextFont(run.style.tsFont);
	TextSize(run.style.tsSize);
	TextFace(run.style.tsFace);
}

/** The width of text from one offset to another, in the record's port (and its runs' styles). */
function rangeWidth(te: TERec, from: Integer, to: Integer): Integer {
	const text = te.hText.data;
	if (te.styleRuns === null) {
		return TextWidth(text, from, to - from);
	}
	let w = 0;
	for (let i = from; i < to; ) {
		const run = runAt(te, i);
		const next = te.styleRuns[te.styleRuns.indexOf(run) + 1];
		const end = Math.min(to, next === undefined ? to : next.start);
		useStyle(run);
		w += TextWidth(text, i, end - i);
		i = end;
	}
	return w;
}

/** A line's height and ascent. */
function lineHeightOf(te: TERec, line: number): Integer {
	return te.styleRuns === null ? te.lineHeight : (te.lineHeights[line] ?? 0);
}

function lineAscentOf(te: TERec, line: number): Integer {
	return te.styleRuns === null ? te.fontAscent : (te.lineAscents[line] ?? 0);
}

/** The top of a line. */
function lineTop(te: TERec, line: number): Integer {
	if (te.styleRuns === null) {
		return te.destRect.top + line * te.lineHeight;
	}
	let v = te.destRect.top;
	for (let i = 0; i < line; i++) {
		v += te.lineHeights[i]!;
	}
	return v;
}

/** The line at a vertical position, within the text's lines. */
function lineAt(te: TERec, v: Integer): number {
	if (te.styleRuns === null) {
		return Math.max(0, Math.min(te.nLines - 1, Math.floor((v - te.destRect.top) / te.lineHeight)));
	}
	let top = te.destRect.top;
	for (let line = 0; line < te.nLines; line++) {
		top += te.lineHeights[line]!;
		if (v < top) {
			return line;
		}
	}
	return Math.max(0, te.nLines - 1);
}

/**
 * Pascal `TEGetHeight` (TEDispatch selector 9): the height of the lines from startLine to endLine,
 * both included, counted from 1 and kept within the text's lines.
 */
export function TEGetHeight(endLine: LongInt, startLine: LongInt, te: TERec): LongInt {
	const first = Math.max(1, Math.min(startLine, endLine));
	const last = Math.min(te.nLines, Math.max(startLine, endLine));
	let h = 0;
	for (let line = first; line <= last; line++) {
		h += lineHeightOf(te, line - 1);
	}
	return h;
}

/**
 * Pascal `TEGetStyle` (TEDispatch selector 3): the style of the character at an offset, and the
 * height and ascent of its line.
 */
export function TEGetStyle(offset: Integer, theStyle: TextStyle, lineHeight: { v: Integer }, fontAscent: { v: Integer }, te: TERec): void {
	const line = lineOf(te, offset);
	lineHeight.v = lineHeightOf(te, line);
	fontAscent.v = lineAscentOf(te, line);
	const style = te.styleRuns === null ? { tsFont: te.txFont, tsFace: te.txFace, tsSize: te.txSize, tsColor: { red: 0, green: 0, blue: 0 } } : runAt(te, offset).style;
	Object.assign(theStyle, { ...style, tsColor: { ...style.tsColor } });
}

/** Pascal `TEGetOffset`: the offset of the character nearest a point. */
export function TEGetOffset(pt: Point, te: TERec): Integer {
	return inPort(te, () => offsetAt(te, pt));
}

/** Pascal `TEToScrap`: the Toolbox's scrap has nothing to show for it. */
export function TEToScrap(): Integer {
	return 0;
}

/** Runs drawing or measuring in the record's port with its font. */
function inPort<T>(te: TERec, f: () => T): T {
	const save = thePort;
	SetPort(te.inPort);
	const port = te.inPort;
	const saved = { font: port.txFont, face: port.txFace, mode: port.txMode, size: port.txSize };
	TextFont(te.txFont);
	TextFace(te.txFace);
	TextMode(te.txMode);
	TextSize(te.txSize);
	try {
		return f();
	} finally {
		port.txFont = saved.font;
		port.txFace = saved.face;
		port.txMode = saved.mode;
		port.txSize = saved.size;
		SetPort(save);
	}
}

// ---------------------------------------------------------------------------------------------
// Lines

/** Where lines start when text wraps within a width: after a return, or before a word that does not fit. */
function lineBreaks(text: Uint8Array, width: number, crOnly: boolean, charWidth: (i: number) => number): number[] {
	const starts = [0];
	let start = 0;
	while (start < text.length) {
		let end = start;
		let lastBreak = -1;
		let w = 0;
		for (;;) {
			if (end >= text.length) {
				break;
			}
			const ch = text[end]!;
			if (ch === 13) {
				end++;
				break;
			}
			// A line that reaches the rectangle's width goes back to its last word break; a word
			// with none before it breaks only past the width. Seen in the oracle, in Chicago 12 at
			// widths equal to their boxes: Glider's Configure puts "key." of "controlling key." (103
			// pixels in 103) on the next line; the Room Editor's Go To Room keeps "rooms." (45 in 45).
			const cw = charWidth(end);
			if (!crOnly && w + cw >= width && ch !== 0x20 && (lastBreak > start || w + cw > width)) {
				if (lastBreak > start) {
					end = lastBreak;
				} else if (end === start) {
					end++;
				}
				break;
			}
			w += cw;
			end++;
			if (ch === 0x20 && (end >= text.length || text[end] !== 0x20)) {
				lastBreak = end;
			}
		}
		starts.push(end);
		start = end;
	}
	if (starts.length === 1 || text[text.length - 1] === 13) {
		starts.push(text.length);
	}
	return starts;
}

/** Pascal `TECalText`: recalculates where lines start. */
export function TECalText(te: TERec): void {
	inPort(te, () => {
		const text = te.hText.data;
		const starts = lineBreaks(text, te.destRect.right - te.destRect.left, te.crOnly < 0, (i) => rangeWidth(te, i, i + 1));
		te.lineStarts = starts.length > 1 ? starts : [0, 0];
		if (te.styleRuns !== null) {
			// Each line is as tall as the tallest run of its characters, its return included; an empty
			// last line, after a final return, as the run there.
			te.lineHeights = [];
			te.lineAscents = [];
			for (let line = 0; line < te.nLines; line++) {
				const start = te.lineStarts[line]!;
				const end = Math.max(te.lineStarts[line + 1]!, start + 1);
				let height = 0;
				let ascent = 0;
				for (const run of te.styleRuns) {
					const runEnd = te.styleRuns[te.styleRuns.indexOf(run) + 1]?.start ?? Infinity;
					if (run.start < end && runEnd > Math.min(start, Math.max(0, text.length - 1))) {
						height = Math.max(height, run.height);
						ascent = Math.max(ascent, run.ascent);
					}
				}
				te.lineHeights.push(height);
				te.lineAscents.push(ascent);
			}
		}
	});
}

function lineOf(te: TERec, offset: number): number {
	for (let i = te.nLines - 1; i >= 0; i--) {
		if (offset >= te.lineStarts[i]!) {
			return i;
		}
	}
	return 0;
}

/** The pen position of a line's first character. */
function lineLeft(te: TERec, line: number): number {
	const text = te.hText.data;
	const start = te.lineStarts[line]!;
	let end = te.lineStarts[line + 1]!;
	if (te.just === teJustLeft) {
		return te.destRect.left + textInset;
	}
	while (end > start && (text[end - 1] === 13 || text[end - 1] === 0x20)) {
		end--;
	}
	const width = rangeWidth(te, start, end);
	const room = te.destRect.right - te.destRect.left - textInset;
	return te.destRect.left + textInset + (te.just === teJustCenter ? Math.trunc((room - width) / 2) : room - width);
}

/** Pascal `TEGetPoint`-style: where the character at an offset begins, its line's top. */
function pointOf(te: TERec, offset: number): Point {
	const line = lineOf(te, offset);
	const start = te.lineStarts[line]!;
	const h = lineLeft(te, line) + rangeWidth(te, start, offset);
	return { h, v: lineTop(te, line) };
}

/** The offset nearest a point. */
function offsetAt(te: TERec, pt: Point): number {
	const line = lineAt(te, pt.v);
	const text = te.hText.data;
	const start = te.lineStarts[line]!;
	let end = te.lineStarts[line + 1]!;
	if (end > start && text[end - 1] === 13) {
		end--;
	}
	let h = lineLeft(te, line);
	for (let i = start; i < end; i++) {
		const w = rangeWidth(te, i, i + 1);
		if (pt.h < h + w / 2) {
			return i;
		}
		h += w;
	}
	return end;
}

// ---------------------------------------------------------------------------------------------
// Drawing

/** Pascal `TEUpdate`: redraws the text within a rectangle. */
export function TEUpdate(rUpdate: Rect, te: TERec): void {
	inPort(te, () => {
		const clip = NewRgn();
		GetClip(clip);
		const area = { ...rUpdate };
		if (!SectRect(area, te.viewRect, area)) {
			return;
		}
		const rgn = NewRgn();
		SectRgn(clip, rectRegion(area), rgn);
		SetClip(rgn);
		drawLines(te, 0, te.nLines);
		if (te.active) {
			hilite(te);
		}
		SetClip(clip);
	});
}

function drawLines(te: TERec, first: number, last: number): void {
	const text = te.hText.data;
	let top = lineTop(te, first);
	for (let line = first; line < last; line++) {
		const height = lineHeightOf(te, line);
		EraseRect({ top, left: te.destRect.left, bottom: top + height, right: te.destRect.right });
		const start = te.lineStarts[line]!;
		let end = te.lineStarts[line + 1]!;
		if (end > start && text[end - 1] === 13) {
			end--;
		}
		MoveTo(lineLeft(te, line), top + lineAscentOf(te, line));
		if (te.styleRuns === null) {
			DrawText(text, start, end - start);
		} else {
			// Run by run, each in its font, face, size and color.
			for (let i = start; i < end; ) {
				const run = runAt(te, i);
				const next = te.styleRuns[te.styleRuns.indexOf(run) + 1];
				const runEnd = Math.min(end, next === undefined ? end : next.start);
				useStyle(run);
				RGBForeColor(run.style.tsColor);
				DrawText(text, i, runEnd - i);
				i = runEnd;
			}
			RGBForeColor({ red: 0, green: 0, blue: 0 });
		}
		top += height;
	}
}

/** Shows the selection: the caret (if it is on) or the selected text inverted. */
function hilite(te: TERec): void {
	if (te.selStart === te.selEnd) {
		if (te.caretState) {
			InvertRect(caretRect(te));
		}
		return;
	}
	for (const r of selectionRects(te)) {
		// A selection is highlighted: in color, its background and the highlight color swap.
		setHiliteMode();
		InvertRect(r);
	}
}

function caretRect(te: TERec): Rect {
	const p = pointOf(te, te.selStart);
	return { top: p.v, left: p.h - 1, bottom: p.v + lineHeightOf(te, lineOf(te, te.selStart)), right: p.h };
}

function selectionRects(te: TERec): Rect[] {
	const a = pointOf(te, te.selStart);
	const b = pointOf(te, te.selEnd);
	// A selection from the start of a line is highlighted from the destination rectangle's left
	// edge, and one to the end of the text up to its right edge (seen in the oracle).
	if (te.selStart === te.lineStarts[lineOf(te, te.selStart)]) {
		a.h = te.destRect.left;
	}
	if (te.selEnd >= te.teLength) {
		b.h = te.destRect.right;
	}
	const rects: Rect[] = [];
	if (a.v === b.v) {
		rects.push({ top: a.v, left: a.h, bottom: a.v + te.lineHeight, right: b.h });
	} else {
		rects.push({ top: a.v, left: a.h, bottom: a.v + te.lineHeight, right: te.destRect.right });
		if (b.v > a.v + te.lineHeight) {
			rects.push({ top: a.v + te.lineHeight, left: te.destRect.left, bottom: b.v, right: te.destRect.right });
		}
		rects.push({ top: b.v, left: te.destRect.left, bottom: b.v + te.lineHeight, right: b.h });
	}
	return rects;
}

/** Inverts the selection or caret where it shows, in the record's port. */
function toggleHilite(te: TERec): void {
	inPort(te, () => {
		const clip = NewRgn();
		GetClip(clip);
		const rgn = NewRgn();
		SectRgn(clip, rectRegion(te.viewRect), rgn);
		SetClip(rgn);
		hilite(te);
		SetClip(clip);
	});
}

/** Pascal `TETextBox`: draws text in a rectangle, erasing it first. */
export function TETextBox(text: Uint8Array | string, length: LongInt, box: Rect, just: Integer): void {
	const bytes = typeof text === 'string' ? encodeMacRoman(text) : text;
	const te = TENew(box, box);
	te.hText = new Handle(bytes.slice(0, length));
	te.just = just;
	TECalText(te);
	const clip = NewRgn();
	GetClip(clip);
	EraseRect(box);
	const rgn = NewRgn();
	SectRgn(clip, rectRegion(box), rgn);
	SetClip(rgn);
	inPort(te, () => drawLines(te, 0, te.nLines));
	SetClip(clip);
}

/** Pascal `TextBox`. */
export function TextBox(text: Uint8Array | string, length: LongInt, box: Rect, just: Integer): void {
	TETextBox(text, length, box, just);
}

// ---------------------------------------------------------------------------------------------
// Text and selection

export function TESetText(text: Uint8Array | string, length: LongInt, te: TERec): void {
	const bytes = typeof text === 'string' ? encodeMacRoman(text) : text;
	te.hText.data = bytes.slice(0, length);
	te.selStart = te.selEnd = te.teLength;
	TECalText(te);
}

/** Pascal `TEGetText`: the record's text handle. */
export function TEGetText(te: TERec): Handle {
	return te.hText;
}

/** Port: the text as a string. */
export function teString(te: TERec): string {
	return decodeMacRoman(te.hText.data);
}

export function TESetSelect(selStart: LongInt, selEnd: LongInt, te: TERec): void {
	const shown = te.active;
	if (shown) {
		toggleHilite(te);
	}
	te.selStart = Math.max(0, Math.min(selStart, te.teLength));
	te.selEnd = Math.max(te.selStart, Math.min(selEnd, te.teLength));
	te.caretState = true;
	te.caretTime = TickCount();
	if (shown) {
		toggleHilite(te);
	}
}

export function TEActivate(te: TERec): void {
	if (!te.active) {
		te.active = true;
		te.caretState = true;
		te.caretTime = TickCount();
		toggleHilite(te);
	}
}

export function TEDeactivate(te: TERec): void {
	if (te.active) {
		toggleHilite(te);
		te.active = false;
		te.caretState = false;
	}
}

/** Pascal `TEIdle`: blinks the caret. */
export function TEIdle(te: TERec): void {
	if (!te.active || te.selStart !== te.selEnd) {
		return;
	}
	if (TickCount() - te.caretTime >= GetCaretTime()) {
		toggleHilite(te);
		te.caretState = !te.caretState;
		toggleHilite(te);
		te.caretTime = TickCount();
	}
}

/** Replaces the selection with bytes and redraws; `replacedRange`, whether it was one the user selected. */
function replaceSelection(te: TERec, bytes: Uint8Array, replacedRange = te.selStart !== te.selEnd): void {
	const old = te.hText.data;
	const text = new Uint8Array(old.length - (te.selEnd - te.selStart) + bytes.length);
	text.set(old.subarray(0, te.selStart), 0);
	text.set(bytes, te.selStart);
	text.set(old.subarray(te.selEnd), te.selStart + bytes.length);
	te.hText.data = text;
	te.selStart = te.selEnd = te.selStart + bytes.length;
	// Typing at the caret hides it, and it comes back when it next blinks: the blinking keeps its own
	// time. Typing over a selection shows the caret at once and starts its blinking over, as setting
	// the selection does. (Both seen in the oracle, tick by tick: the high-score name typed over and
	// typed after.)
	if (replacedRange) {
		te.caretState = true;
		te.caretTime = TickCount();
	} else {
		te.caretState = false;
	}
	TECalText(te);
	TEUpdate(te.viewRect, te);
}

/** Pascal `TEAutoView`. */
export function TEAutoView(auto: boolean, te: TERec): void {
	te.autoView = auto;
}

/**
 * Pascal `TESelView`: with automatic scrolling on, scrolls the text so that the insertion point
 * (the start of the selection) is in view. As System 6's TextEdit does (its patch, read in a RAM
 * dump of the oracle): if the caret's top left is outside the view less a line at the bottom and a
 * pixel at the right, the text scrolls to put it at that corner, pinned (TEPinScroll). A line
 * taller than the view, as in a dialog's 15-pixel edit field in the 16-pixel system font, ends up
 * with its bottom in view, a pixel up; a one-line field, whose destination is twice its width
 * (Dialogs.ts), scrolls sideways as its text grows, and back when the text wraps.
 */
export function TESelView(te: TERec): void {
	if (!te.autoView) {
		return;
	}
	const caret = caretRect(te);
	const right = te.viewRect.right - 1;
	const bottom = te.viewRect.bottom - te.lineHeight;
	if (caret.left >= te.viewRect.left && caret.left < right && caret.top >= te.viewRect.top && caret.top < bottom) {
		return;
	}
	TEPinScroll(right - caret.left, bottom - caret.top, te);
}

/**
 * Pascal `TEPinScroll`: scrolls as TEScroll does, but no further than brings the text's last line
 * to the view's bottom or its first to the top, or the destination's right or left edge to the
 * view's (System 6's TextEdit).
 */
export function TEPinScroll(dh: Integer, dv: Integer, te: TERec): void {
	const text = te.hText.data;
	if (dv < 0) {
		const lines = te.nLines + (text.length > 0 && text[text.length - 1] === 13 ? 1 : 0);
		dv = Math.max(dv, Math.min(0, te.viewRect.bottom - te.destRect.top - lines * te.lineHeight));
	} else {
		dv = Math.min(dv, Math.max(0, te.viewRect.top - te.destRect.top));
	}
	if (dh < 0) {
		dh = Math.max(dh, Math.min(0, te.viewRect.right - te.destRect.right));
	} else {
		dh = Math.min(dh, Math.max(0, te.viewRect.left - te.destRect.left));
	}
	if (dh !== 0 || dv !== 0) {
		TEScroll(dh, dv, te);
	}
}

/** Pascal `TEKey`: types a character, deletes with backspace, moves with the arrow keys. */
export function TEKey(key: string | Integer, te: TERec): void {
	typeKey(key, te);
	TESelView(te);
}

function typeKey(key: string | Integer, te: TERec): void {
	const code = typeof key === 'string' ? encodeMacRoman(key)[0]! : key;
	switch (code) {
		case 8: // backspace
			// At the caret, the character before it goes as typing at the caret goes: the caret hides
			// until it next blinks (seen in the oracle, tick by tick: `longName`).
			if (te.selStart === te.selEnd) {
				if (te.selStart > 0) {
					te.selStart--;
					replaceSelection(te, new Uint8Array(0), false);
				}
				return;
			}
			replaceSelection(te, new Uint8Array(0));
			return;
		case 28: // left
		case 30: // up
			TESetSelect(Math.max(0, te.selStart - (te.selStart === te.selEnd ? 1 : 0)), Math.max(0, te.selStart - (te.selStart === te.selEnd ? 1 : 0)), te);
			return;
		case 29: // right
		case 31: // down
			TESetSelect(te.selEnd + (te.selStart === te.selEnd ? 1 : 0), te.selEnd + (te.selStart === te.selEnd ? 1 : 0), te);
			return;
		default:
			replaceSelection(te, new Uint8Array([code]));
	}
}

export function TEDelete(te: TERec): void {
	replaceSelection(te, new Uint8Array(0));
	TESelView(te);
}

export function TEInsert(text: Uint8Array | string, length: LongInt, te: TERec): void {
	const bytes = typeof text === 'string' ? encodeMacRoman(text) : text;
	const start = te.selStart;
	te.selEnd = te.selStart;
	replaceSelection(te, bytes.slice(0, length));
	te.selStart = te.selEnd = start;
	TESelView(te);
}

export function TECut(te: TERec): void {
	TECopy(te);
	TEDelete(te);
}

export function TECopy(te: TERec): void {
	scrap = te.hText.data.slice(te.selStart, te.selEnd);
}

export function TEPaste(te: TERec): void {
	replaceSelection(te, scrap);
	TESelView(te);
}

export function TESetJust(just: Integer, te: TERec): void {
	te.just = just;
}

/**
 * Pascal `TEClick`: selects by dragging from a point (in the record's port's coordinates);
 * a double click selects a word, and shift extends the selection.
 */
export async function TEClick(pt: Point, extend: boolean, te: TERec): Promise<void> {
	const anchor = extend ? te.selStart : offsetAt(te, pt);
	const now = TickCount();
	const doubleClick = !extend && te.clickLoc === anchor && now - te.clickTime <= GetDblTime();
	te.clickTime = now;
	te.clickLoc = anchor;
	const select = (offset: number): void => {
		let a = Math.min(anchor, offset);
		let b = Math.max(anchor, offset);
		if (doubleClick) {
			const text = te.hText.data;
			const isWord = (c: number): boolean => c > 0x20 && c !== 13;
			while (a > 0 && isWord(text[a - 1]!)) {
				a--;
			}
			while (b < text.length && isWord(text[b]!)) {
				b++;
			}
		}
		if (a !== te.selStart || b !== te.selEnd) {
			TESetSelect(a, b, te);
		}
	};
	select(offsetAt(te, pt));
	while (mouse.button) {
		await getHost().sleep(tickTime(TickCount() + 1));
		const save = thePort;
		SetPort(te.inPort);
		const p = { ...mouse.where };
		GlobalToLocal(p);
		SetPort(save);
		select(offsetAt(te, p));
	}
	TESelView(te);
}

/** Pascal `TEScroll`: moves the text by (dh, dv) and redraws it. */
export function TEScroll(dh: Integer, dv: Integer, te: TERec): void {
	te.destRect = { top: te.destRect.top + dv, left: te.destRect.left + dh, bottom: te.destRect.bottom + dv, right: te.destRect.right + dh };
	inPort(te, () => {
		const clip = NewRgn();
		GetClip(clip);
		ClipRect(te.viewRect);
		EraseRect(te.viewRect);
		SetClip(clip);
	});
	TEUpdate(te.viewRect, te);
}
