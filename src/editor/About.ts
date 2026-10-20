// Port: Jon Wind's About™ 2.1 library, which the Room Editor links for its help window ("About… 2.1
// Intf.p"; the compiled library is `About.lib (2.1)`). A third-party binary library, reimplemented
// from its interface and its observed behavior, not translated (PORT.md, decision 11).
//
// The interface is here as the editor calls it; the window itself is still to be made (roadmap 12).

import type { EventRecord, Integer, Rect, WindowPtr } from '../mac/Toolbox.ts';

export const AboutVersion = 'About™ 2.1';
export const AboutNoIcon = -1;
export const AboutNoCenter = -1;
export const AboutTopCenter = 0;
export const AboutMainCenter = 1;
export const AboutMsg = 0;
export const AboutTEXT = 1;

export const movableDBoxProc = 5;

export interface AboutFontRec {
	Font: Integer;
	Size: Integer;
	/** Style: a set of QuickDraw faces, as TextFace takes it. */
	Face: Integer;
	Color: Integer;
}

export interface AboutRec {
	/** array[AboutMsg..AboutTEXT] of AboutFontRec */
	FontInfo: AboutFontRec[];
	TEXTCopy: boolean;
	KeyEquivs: boolean;
	CloseBox: boolean;
	Styled: boolean;
	CenterMode: Integer;
	MainIcon: Integer;
	ClickIcon: Integer;
	/** Str255 */
	ClickMsg: string;
}

export function newAboutRec(): AboutRec {
	const font = (): AboutFontRec => ({ Font: 0, Size: 0, Face: 0, Color: 0 });
	return { FontInfo: [font(), font()], TEXTCopy: false, KeyEquivs: false, CloseBox: false, Styled: false, CenterMode: 0, MainIcon: 0, ClickIcon: 0, ClickMsg: '' };
}

/** Modal: shows the window and returns once it is dismissed. */
export async function BuildAbout(_WinRect: Rect, _WinProc: Integer, _TEXTid: Integer, _WinTitle: string, _WinMsg: string, _WinMisc: AboutRec): Promise<void> {
	// Port: not yet made (roadmap 12).
}

/** Whether a window is an About window. */
export function IsAboutWindow(_theWindow: WindowPtr | null): boolean {
	return false;
}

/** Opens a modeless About window; null if it is not made. */
export function OpenAbout(_WinRect: Rect, _WinProc: Integer, _TEXTid: Integer, _WinTitle: string, _WinMsg: string, _WinMisc: AboutRec): WindowPtr | null {
	return null;
}

/** Handles an event for a modeless About window, closing it if dismissed (theWindow becomes null). */
export async function HandleAbout(_theWindow: { v: WindowPtr | null }, _theEvent: EventRecord): Promise<void> {}

/** Closes an About window. */
export function CloseAbout(theWindow: { v: WindowPtr | null }): void {
	theWindow.v = null;
}
