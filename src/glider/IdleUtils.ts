// Port of G-IdleUtils.p: the title screen's demonstrations, the help screens, and the About,
// Sound Settings, and Configure dialogs.

import {
	BackColor,
	black,
	Button,
	Chr,
	cloneRect,
	CloseRgn,
	Concat,
	Copy,
	CopyBits,
	CopyMask,
	cyanColor,
	type ControlHandle,
	Delay,
	type DialogPtr,
	DisposCIcon,
	DisposDialog,
	DisposeRgn,
	DrawPicture,
	DrawString,
	type EventRecord,
	everyEvent,
	ExitToShell,
	FillRect,
	FlushEvents,
	FrameRect,
	FrameRoundRect,
	GetCIcon,
	GetDItem,
	GetIcon,
	GetIndString,
	GetNewDialog,
	GetNextEvent,
	GetPicture,
	GetPort,
	GetSoundVol,
	type GrafPtr,
	type Handle,
	HGetState,
	HideDItem,
	HLock,
	HSetState,
	inFront,
	InitCursor,
	InsetRect,
	type Integer,
	InvertRect,
	type ItemHandle,
	keyCodeMask,
	keyDownMask,
	LineTo,
	LoWord,
	type LongInt,
	ModalDialog,
	MoveHHi,
	MoveTo,
	MoveWindow,
	NewRgn,
	NumToString,
	OffsetRect,
	OpenRgn,
	pArray,
	PenNormal,
	PenSize,
	PlotCIcon,
	PlotIcon,
	type Rect,
	type Ref,
	ref,
	type Region,
	ReleaseResource,
	RGBForeColor,
	screenBits,
	SectRgn,
	SelectWindow,
	SetCtlValue,
	SetIText,
	SetPort,
	SetRect,
	SetSoundVol,
	ShowWindow,
	SysBeep,
	srcCopy,
	srcXor,
	TextFont,
	TextMode,
	TextSize,
	TickCount,
	UnionRect,
	UseResFile,
	whiteColor,
	Yield,
	BitAnd,
	charCodeMask,
	div,
	keyDown,
	pString,
} from '../mac/Toolbox.ts';
import {
	balloonMode,
	battry,
	candle,
	clock,
	colorMusicMode,
	controlMode,
	copterMode,
	dartMode,
	editorMode,
	flrVnt,
	G,
	adMode,
	bandBatteryMode,
	helpScreensMode,
	highScoreMode,
	kErrNotEnoughMem,
	kLastHelpScreen,
	kReturnKey,
	lastDemo,
	newAnimateRec,
	paper,
	paperClockMode,
	rbrBnd,
	rCustomKeysID,
	rDemoStrIDs,
	rHelpBasePictID,
	rSoundDlgID,
	tabMode,
	ventCandleMode,
} from './Globals.ts';
import { GenericAlert, HideMenuBar, Randomize, ShowMenuBar, SpinBall } from './GlobalUtils.ts';

/** The unit's interface variables. */
export const IdleUtils = {
	/** array[0..3] of Boolean */
	ozmaFlags: pArray(0, 3, () => false),
};

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });

let idleR1 = rect();
let idleR2 = rect();
let frameR = rect();
// Port: loadR is declared but never used.
let maskRgn: Region | null = null;
let colorPoint: Integer = 0;
let loopDelay: Integer = 0;
let screenNum: Integer = 0;
let helpScreenNum: Integer = 0;
let timeWas: LongInt = 0;
let tickStamp: LongInt = 0;
const demoAnimate = newAnimateRec();

// =================================

export function CloseHiScores(): void {
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	}
	NewMode(true);
}

// =================================

export function NewMode(randomIt: boolean): void {
	const tempR = rect();
	let smallR: Rect;

	// ----------------

	function GetTheStrings(starting: Integer): void {
		let tempStr: string;

		if (G.inColor) {
			RGBForeColor(G.rgbBlue);
		} else {
			TextMode(srcXor);
		}
		MoveTo(300, 57);
		tempStr = GetIndString(rDemoStrIDs, starting);
		DrawString(tempStr);
		MoveTo(300, 70);
		tempStr = GetIndString(rDemoStrIDs, starting + 1);
		DrawString(tempStr);
		MoveTo(300, 83);
		tempStr = GetIndString(rDemoStrIDs, starting + 2);
		DrawString(tempStr);
		MoveTo(300, 96);
		tempStr = GetIndString(rDemoStrIDs, starting + 3);
		DrawString(tempStr);
		if (G.inColor) {
			RGBForeColor(G.rgbBlack);
		} else {
			PenNormal();
		}
	}

	// ----------------

	if (randomIt) {
		G.demoMode = Randomize(lastDemo) + 1;
	}

	UseResFile(G.gliderResNum);

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	PenNormal();

	SetRect(tempR, 298, 20, 508, 100);
	FillRect(tempR, black);

	TextFont(16);
	TextSize(12);

	switch (G.demoMode) {
		case balloonMode: {
			demoAnimate.phase = 0;
			demoAnimate.kind = 2;
			demoAnimate.vertOff = 4;
			demoAnimate.destRect = cloneRect(G.animateRct[demoAnimate.kind]![demoAnimate.phase]!);
			OffsetRect(demoAnimate.destRect, -demoAnimate.destRect.left, -demoAnimate.destRect.top);
			OffsetRect(demoAnimate.destRect, 460, 45);
			demoAnimate.oldRect = cloneRect(demoAnimate.destRect);
			demoAnimate.wholeRect = cloneRect(demoAnimate.destRect);
			GetTheStrings(1);
			break;
		}

		case copterMode: {
			demoAnimate.phase = 0;
			demoAnimate.kind = 1;
			demoAnimate.vertOff = 3;
			demoAnimate.destRect = cloneRect(G.animateRct[demoAnimate.kind]![demoAnimate.phase]!);
			OffsetRect(demoAnimate.destRect, -demoAnimate.destRect.left, -demoAnimate.destRect.top);
			OffsetRect(demoAnimate.destRect, 460, 45);
			demoAnimate.oldRect = cloneRect(demoAnimate.destRect);
			demoAnimate.wholeRect = cloneRect(demoAnimate.destRect);
			GetTheStrings(5);
			break;
		}

		case dartMode: {
			demoAnimate.phase = 0;
			demoAnimate.kind = 0;
			demoAnimate.vertOff = 4;
			demoAnimate.destRect = cloneRect(G.animateRct[demoAnimate.kind]![demoAnimate.phase]!);
			OffsetRect(demoAnimate.destRect, -demoAnimate.destRect.left, -demoAnimate.destRect.top);
			OffsetRect(demoAnimate.destRect, 435, 45);
			demoAnimate.oldRect = cloneRect(demoAnimate.destRect);
			demoAnimate.wholeRect = cloneRect(demoAnimate.destRect);
			GetTheStrings(9);
			break;
		}

		case controlMode:
			GetTheStrings(13);
			break;

		case tabMode:
			GetTheStrings(17);
			break;

		case adMode:
			GetTheStrings(21);
			break;

		case editorMode:
			GetTheStrings(25);
			break;

		case colorMusicMode:
			GetTheStrings(29);
			break;

		case ventCandleMode: {
			GetTheStrings(33);
			smallR = cloneRect(G.srcRect[flrVnt]!);
			OffsetRect(smallR, -smallR.left, -smallR.top);
			OffsetRect(smallR, 456, 51);
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[flrVnt]!, G.srcRect[flrVnt]!, smallR);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[flrVnt]!, G.srcRect[flrVnt]!, smallR);
			}
			smallR = cloneRect(G.srcRect[candle]!);
			OffsetRect(smallR, -smallR.left, -smallR.top);
			OffsetRect(smallR, 466, 75);
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[candle]!, G.srcRect[candle]!, smallR);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[candle]!, G.srcRect[candle]!, smallR);
			}
			break;
		}

		case bandBatteryMode: {
			GetTheStrings(37);
			smallR = cloneRect(G.srcRect[rbrBnd]!);
			OffsetRect(smallR, -smallR.left, -smallR.top);
			OffsetRect(smallR, 470, 45);
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[rbrBnd]!, G.srcRect[rbrBnd]!, smallR);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[rbrBnd]!, G.srcRect[rbrBnd]!, smallR);
			}
			smallR = cloneRect(G.srcRect[battry]!);
			OffsetRect(smallR, -smallR.left, -smallR.top);
			OffsetRect(smallR, 476, 75);
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[battry]!, G.srcRect[battry]!, smallR);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[battry]!, G.srcRect[battry]!, smallR);
			}
			break;
		}

		case paperClockMode: {
			GetTheStrings(41);
			smallR = cloneRect(G.srcRect[paper]!);
			OffsetRect(smallR, -smallR.left, -smallR.top);
			OffsetRect(smallR, 460, 45);
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[paper]!, G.srcRect[paper]!, smallR);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[paper]!, G.srcRect[paper]!, smallR);
			}
			smallR = cloneRect(G.srcRect[clock]!);
			OffsetRect(smallR, -smallR.left, -smallR.top);
			OffsetRect(smallR, 468, 69);
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[clock]!, G.srcRect[clock]!, smallR);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[clock]!, G.srcRect[clock]!, smallR);
			}
			break;
		}

		default:
	}

	SetPort(G.mainWndo!);

	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, tempR, tempR, srcCopy, G.mainWndo!.visRgn);
	} else {
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempR, tempR, srcCopy, G.mainWndo!.visRgn);
	}
}

// =================================

export async function DisplayAHelpScreen(): Promise<void> {
	const destRect = rect();
	let tempByte: Integer;

	SetRect(destRect, 4, 4, 507, 130);

	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}

	const thePict = GetPicture(helpScreenNum + rHelpBasePictID);
	if (thePict !== null) {
		tempByte = HGetState(thePict);
		MoveHHi(thePict);
		HLock(thePict);
		DrawPicture(thePict, destRect);
		HSetState(thePict, tempByte);
	} else {
		await GenericAlert(kErrNotEnoughMem);
		ExitToShell(); // CHANGE ME
	}
	ReleaseResource(thePict as Handle | null);

	if (G.inColor) {
		BackColor(cyanColor);
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, destRect, destRect, srcCopy, G.mainWndo!.visRgn);
		BackColor(whiteColor);
	} else {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, destRect, destRect, srcCopy, G.mainWndo!.visRgn);
	}
}

// =================================

export function CloseHelpScreens(): void {
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	} else {
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	}

	if (screenBits.bounds.bottom <= 342) {
		ShowMenuBar();
	}

	if (G.playing) {
		G.demoMode = Randomize(lastDemo) + 1;
	} else {
		NewMode(true);
	}
}

// =================================

export async function NextPageHelpScreens(): Promise<void> {
	if (helpScreenNum < kLastHelpScreen) {
		helpScreenNum = helpScreenNum + 1;
		await DisplayAHelpScreen();
		FlushEvents(everyEvent, 0);
	} else {
		CloseHelpScreens();
	}
}

// =================================

export async function OpenHelpScreens(): Promise<void> {
	helpScreenNum = 1;
	G.demoMode = helpScreensMode;

	if (screenBits.bounds.bottom <= 342) {
		HideMenuBar();
	}

	await DisplayAHelpScreen();

	// repeat until (not Button)
	while (Button()) {
		await Yield();
	}
}

// =================================

export function InitIdle(): void {
	let i: Integer;

	for (i = 0; i <= 3; i++) {
		IdleUtils.ozmaFlags[i] = false;
	}

	SetRect(idleR1, 0, 0, 48, 20);
	OffsetRect(idleR1, -512 + Randomize(450), 130 + Randomize(70));
	SetRect(idleR2, 0, 0, 35, 15);
	OffsetRect(idleR2, -512 + Randomize(450), 130 + Randomize(70));
	tickStamp = TickCount();
	MoveTo(3, 222);
	maskRgn = NewRgn();
	OpenRgn();
	LineTo(29, 222);
	LineTo(16, 183);
	LineTo(82, 183);
	LineTo(93, 161);
	LineTo(204, 161);
	LineTo(214, 200);
	LineTo(329, 200);
	LineTo(335, 206);
	LineTo(352, 206);
	LineTo(368, 221);
	LineTo(396, 221);
	LineTo(509, 278);
	LineTo(509, 130);
	LineTo(3, 130);
	LineTo(3, 222);
	CloseRgn(maskRgn);

	loopDelay = 0;
	colorPoint = 0;
	G.demoCount = 0;

	NewMode(true);
}

// =================================

function DoAnimate(): void {
	const d = demoAnimate;
	d.phase = d.phase + 1;
	if (d.phase > 7) {
		d.phase = 0;
		d.vertOff = -d.vertOff;
	}
	OffsetRect(d.destRect, 0, d.vertOff);

	if (G.inColor) {
		SetPort(G.loadCPtr!);
		UnionRect(d.destRect, d.oldRect, d.wholeRect);
		FillRect(d.wholeRect, black);
		SetPort(G.mainWndo!);
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.animateRct[d.kind]![d.phase]!, G.animateRct[d.kind]![d.phase]!, d.destRect);
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, d.wholeRect, d.wholeRect, srcCopy, G.mainWndo!.visRgn);
	} else {
		SetPort(G.offLoadPort!);
		UnionRect(d.destRect, d.oldRect, d.wholeRect);
		FillRect(d.wholeRect, black);
		SetPort(G.mainWndo!);
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.animateRct[d.kind]![d.phase]!, G.animateRct[d.kind]![d.phase]!, d.destRect);
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, d.wholeRect, d.wholeRect, srcCopy, G.mainWndo!.visRgn);
	}
	d.oldRect = cloneRect(d.destRect);
}

// =================================

export async function DoIdle(): Promise<void> {
	let tempR1: Rect;
	let tempR2: Rect;
	const srcR = rect();

	if (G.demoMode === highScoreMode) {
		return;
	}

	if (G.demoMode !== helpScreensMode) {
		G.demoCount = G.demoCount + 1;
		if (G.demoCount >= 159) {
			G.demoCount = 0;
			NewMode(true);
		}

		if (G.demoMode >= balloonMode && G.demoMode <= dartMode) {
			DoAnimate();
		}
	}

	OffsetRect(idleR1, 4, 0);
	OffsetRect(idleR2, 3, 0);
	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	tempR1 = cloneRect(idleR1);
	tempR1.left = tempR1.left - 4;
	FillRect(tempR1, black);
	tempR2 = cloneRect(idleR2);
	tempR2.left = tempR2.left - 3;
	FillRect(tempR2, black);
	SetRect(srcR, 0, 318, 35, 333);

	SetPort(G.mainWndo!);
	const combinedRgn = NewRgn();
	if (G.inColor) {
		SectRgn(maskRgn!, G.mainWndo!.visRgn, combinedRgn);
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, srcR, srcR, idleR2);
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.glideRct[0]!, G.glideRct[0]!, idleR1);
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, tempR1, tempR1, srcCopy, combinedRgn);
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, tempR2, tempR2, srcCopy, combinedRgn);
	} else {
		SectRgn(maskRgn!, G.mainWndo!.visRgn, combinedRgn);
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, srcR, srcR, idleR2);
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[0]!, G.glideRct[0]!, idleR1);
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, tempR1, tempR1, srcCopy, combinedRgn);
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, tempR2, tempR2, srcCopy, combinedRgn);
	}
	DisposeRgn(combinedRgn);

	if (idleR1.left > 512) {
		SetRect(idleR1, 0, 0, 48, 20);
		OffsetRect(idleR1, -512 + Randomize(450), 130 + Randomize(70));
	}
	if (idleR2.left > 512) {
		SetRect(idleR2, 0, 0, 35, 15);
		OffsetRect(idleR2, -512 + Randomize(450), 130 + Randomize(70));
	}

	PenNormal();
	if (G.inColor) {
		switch (colorPoint) {
			case 0: {
				frameR = cloneRect(G.wholeArea);
				RGBForeColor(G.rgbBlue);
				FrameRect(frameR);
				InsetRect(frameR, 1, 1);
				RGBForeColor(G.rgbViolet);
				FrameRect(frameR);
				InsetRect(frameR, 1, 1);
				RGBForeColor(G.rgbLtBlue);
				FrameRect(frameR);
				RGBForeColor(G.rgbBlack);
				break;
			}
			case 1: {
				frameR = cloneRect(G.wholeArea);
				RGBForeColor(G.rgbLtBlue);
				FrameRect(frameR);
				InsetRect(frameR, 1, 1);
				RGBForeColor(G.rgbBlue);
				FrameRect(frameR);
				InsetRect(frameR, 1, 1);
				RGBForeColor(G.rgbViolet);
				FrameRect(frameR);
				RGBForeColor(G.rgbBlack);
				break;
			}
			case 2: {
				frameR = cloneRect(G.wholeArea);
				RGBForeColor(G.rgbViolet);
				FrameRect(frameR);
				InsetRect(frameR, 1, 1);
				RGBForeColor(G.rgbLtBlue);
				FrameRect(frameR);
				InsetRect(frameR, 1, 1);
				RGBForeColor(G.rgbBlue);
				FrameRect(frameR);
				RGBForeColor(G.rgbBlack);
				break;
			}
		}
	}

	loopDelay = loopDelay + 1;
	if (loopDelay > 5) {
		loopDelay = 0;
		colorPoint = colorPoint + 1;
		if (colorPoint > 2) {
			colorPoint = 0;
		}
	}

	// repeat until (TickCount >= tickStamp + 2)
	while (!(TickCount() >= tickStamp + 2)) {
		await Yield();
	}
	tickStamp = TickCount();
}

// =================================

export function DropIdle(): void {
	DisposeRgn(maskRgn!);
}

// =================================

async function idleFilter(theDialog: DialogPtr, theEvent: EventRecord, itemHit: Ref<Integer>): Promise<boolean> {
	let iconNum: Integer;
	const iType = ref<Integer>(0);
	let timeIs: LongInt;
	const tempRect = rect();
	const iHand = ref<ItemHandle>(null);

	let result = false;
	if (theEvent.what === keyDown && BitAnd(theEvent.message, charCodeMask) === kReturnKey) {
		itemHit.v = 1;
		result = true;
	}
	timeIs = TickCount();
	if (timeIs > timeWas + 90) {
		timeWas = TickCount();
		screenNum = screenNum + 1;
		if (screenNum > 3) {
			screenNum = 0;
		}
		for (iconNum = 2; iconNum <= 10; iconNum++) {
			SpinBall();
			timeIs = await Delay(1);
			SpinBall();
			timeIs = await Delay(1);
			GetDItem(theDialog, iconNum, iType, iHand, tempRect);

			if (G.inColor) {
				const cicnHand = GetCIcon(1226 + iconNum + screenNum * 9);
				if (cicnHand !== null) {
					PlotCIcon(tempRect, cicnHand);
					DisposCIcon(cicnHand);
				}
			} else {
				const icnHand = GetIcon(1226 + iconNum + screenNum * 9);
				if (icnHand !== null) {
					PlotIcon(tempRect, icnHand);
				}
			}
			InitCursor();
		} // end - for iconnum
	} // end - if (timeIs
	return result;
}

// =================================

export async function DoAbout(): Promise<void> {
	const okayButton = 1;

	const DType = ref<Integer>(0);
	let itemHit: Integer;
	const DItem = ref<ItemHandle>(null);
	let tempRect: Rect;

	// ----------------------------------

	function RefreshIt(): void {
		// Refresh the dialogs non-controls
		SetPort(GetSelection); // Point to our dialog window
		GetDItem(GetSelection, okayButton, DType, DItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenSize(1, 1);
	}

	// ----------------------------------

	const savePort: GrafPtr = GetPort();

	const GetSelection = GetNewDialog(228, null, inFront)!; // Bring in the dialog resource
	tempRect = cloneRect(GetSelection.portRect); // Get window size, we will now center it
	tempRect.top = div(screenBits.bounds.bottom - screenBits.bounds.top - (tempRect.bottom - tempRect.top), 2);
	tempRect.left = div(screenBits.bounds.right - screenBits.bounds.left - (tempRect.right - tempRect.left), 2);
	MoveWindow(GetSelection, tempRect.left, tempRect.top, true); // Now move the window to the proper position
	ShowWindow(GetSelection); // Open a dialog box
	SelectWindow(GetSelection); // Lets see it
	SetPort(GetSelection); // Prepare to add conditional text

	RefreshIt(); // Draw any Lists, lines, or rectangles
	timeWas = TickCount(); // Initialize the tick counter
	screenNum = 0; // Initialize the set of icons displaying

	do {
		// Start of dialog handle loop
		itemHit = await ModalDialog(idleFilter); // Wait until an item is hit
		// End for this item selected
	} while (!(itemHit === okayButton)); // Handle dialog items until exit selected
	SetPort(savePort); // Restore the previous grafport
	DisposDialog(GetSelection); // Flush the dialog out of memory
} // End of procedure

// =================================

export async function DoSoundSettings(): Promise<void> {
	const okayItem = 1;
	const cancelItem = 2;
	const soundOnItem = 3;
	const musicOnItem = 4;
	const incVolItem = 5;
	const decVolItem = 6;
	const iconItem = 7;
	const volEqualsItem = 12;
	const lineItem = 13;
	const channel4Radio = 14;
	const channel2Radio = 15;

	const itemT = ref<Integer>(0);
	let itemHit: Integer;
	let tempVolume: Integer;
	let tempStr: string;
	const itemH = ref<ItemHandle>(null);
	let tempRect: Rect;
	let leaveDlg: boolean;

	// ----------------------------------

	function FixedVolume(theVolume: Integer): Integer {
		switch (theVolume) {
			case 0: {
				SetSoundVol(0);
				theVolume = 800;
				break;
			}
			case 1:
			case 2: {
				SetSoundVol(1);
				theVolume = 801;
				break;
			}
			case 3:
			case 4: {
				SetSoundVol(3);
				theVolume = 802;
				break;
			}
			case 5:
			case 6: {
				SetSoundVol(5);
				theVolume = 803;
				break;
			}
			default: {
				SetSoundVol(7);
				theVolume = 804;
			}
		}
		return theVolume;
	}

	// ----------------------------------

	function RefreshIt(): void {
		let offset: Integer;
		let isVolume: Integer;
		// Port: iconH is never set before the color branch releases it (a garbage handle in the
		// original, which the Resource Manager ignores); here it is nil.
		let iconH: Handle | null = null;

		SetPort(theDlgPtr);

		GetDItem(theDlgPtr, lineItem, itemT, itemH, tempRect);
		FillRect(tempRect, black);

		GetDItem(theDlgPtr, okayItem, itemT, itemH, tempRect);
		PenSize(3, 3);
		InsetRect(tempRect, -4, -4);
		FrameRoundRect(tempRect, 16, 16);
		PenSize(1, 1);

		isVolume = GetSoundVol();
		GetDItem(theDlgPtr, volEqualsItem, itemT, itemH, tempRect);
		tempStr = NumToString(isVolume);
		SetIText(itemH.v as Handle, tempStr);
		offset = FixedVolume(isVolume);
		GetDItem(theDlgPtr, iconItem, itemT, itemH, tempRect);

		if (G.inColor) {
			const cicnH = GetCIcon(offset);
			if (cicnH !== null) {
				PlotCIcon(tempRect, cicnH);
				ReleaseResource(iconH);
				DisposCIcon(cicnH);
			}
		} else {
			iconH = GetIcon(offset);
			if (iconH !== null) {
				PlotIcon(tempRect, iconH);
				ReleaseResource(iconH);
			}
		}
	}

	// ----------------------------------

	FlushEvents(everyEvent, 0);

	const wasPort = GetPort();
	UseResFile(G.gliderResNum);
	const holdVolume = GetSoundVol();
	const holdSound = G.soundOn;
	const holdMusic = G.musicOn;
	let thisSound = G.soundOn;
	let thisMusic = G.musicOn;
	const holdChannel = G.is4Channel;

	const theDlgPtr = GetNewDialog(rSoundDlgID, null, inFront)!;
	tempRect = cloneRect(theDlgPtr.portRect);
	tempRect.top = div(screenBits.bounds.bottom - screenBits.bounds.top - (tempRect.bottom - tempRect.top), 2);
	tempRect.left = div(screenBits.bounds.right - screenBits.bounds.left - (tempRect.right - tempRect.left), 2);
	MoveWindow(theDlgPtr, tempRect.left, tempRect.top, true); // Now move the window to the proper position
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	GetDItem(theDlgPtr, soundOnItem, itemT, itemH, tempRect);
	if (G.soundOn) {
		SetCtlValue(itemH.v as ControlHandle, 1);
	} else {
		SetCtlValue(itemH.v as ControlHandle, 0);
	}
	GetDItem(theDlgPtr, musicOnItem, itemT, itemH, tempRect);

	if (G.musicOn) {
		// set or hide Music On checkbox
		SetCtlValue(itemH.v as ControlHandle, 1);
	} else {
		SetCtlValue(itemH.v as ControlHandle, 0);
	}
	if (G.cantMusic) {
		HideDItem(theDlgPtr, musicOnItem);
	}

	if (G.is4Channel) {
		// set radio buttons for 4/2 channel sound
		GetDItem(theDlgPtr, channel4Radio, itemT, itemH, tempRect);
	} else {
		GetDItem(theDlgPtr, channel2Radio, itemT, itemH, tempRect);
	}
	SetCtlValue(itemH.v as ControlHandle, 1);

	RefreshIt();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, itemT, itemH, tempRect);

		if (itemHit === okayItem) {
			// clicked on Okay button
			leaveDlg = true;
			tempVolume = GetSoundVol();
			G.soundOn = thisSound && tempVolume !== 0;
		}

		if (itemHit === cancelItem) {
			// clicked on Cancle button
			leaveDlg = true;
			SetSoundVol(holdVolume);
			G.soundOn = holdSound;
			G.musicOn = holdMusic;
			G.is4Channel = holdChannel;
		}

		if (itemHit === soundOnItem) {
			G.soundOn = !G.soundOn;
			thisSound = !thisSound;

			GetDItem(theDlgPtr, soundOnItem, itemT, itemH, tempRect);
			if (G.soundOn) {
				SetCtlValue(itemH.v as ControlHandle, 1);
			} else {
				SetCtlValue(itemH.v as ControlHandle, 0);
			}
		}

		if (itemHit === musicOnItem) {
			thisMusic = !thisMusic;
			G.musicOn = !G.musicOn;

			GetDItem(theDlgPtr, musicOnItem, itemT, itemH, tempRect);
			if (G.musicOn) {
				SetCtlValue(itemH.v as ControlHandle, 1);
			} else {
				SetCtlValue(itemH.v as ControlHandle, 0);
			}
		}

		if (itemHit === incVolItem) {
			tempVolume = GetSoundVol();
			switch (tempVolume) {
				case 0:
					tempVolume = 1;
					break;
				case 1:
				case 2:
					tempVolume = 3;
					break;
				case 3:
				case 4:
					tempVolume = 5;
					break;
				default:
					tempVolume = 7;
			}
			SetSoundVol(tempVolume);

			G.soundOn = thisSound && tempVolume !== 0;
			GetDItem(theDlgPtr, soundOnItem, itemT, itemH, tempRect);
			if (G.soundOn) {
				SetCtlValue(itemH.v as ControlHandle, 1);
			} else {
				SetCtlValue(itemH.v as ControlHandle, 0);
			}

			G.musicOn = thisMusic && tempVolume !== 0;
			GetDItem(theDlgPtr, musicOnItem, itemT, itemH, tempRect);
			if (G.musicOn) {
				SetCtlValue(itemH.v as ControlHandle, 1);
			} else {
				SetCtlValue(itemH.v as ControlHandle, 0);
			}

			RefreshIt();
		}

		if (itemHit === decVolItem) {
			tempVolume = GetSoundVol();
			switch (tempVolume) {
				case 1:
				case 2:
					tempVolume = 0;
					break;
				case 3:
				case 4:
					tempVolume = 1;
					break;
				case 5:
				case 6:
					tempVolume = 3;
					break;
				case 7:
					tempVolume = 5;
					break;
				default:
					tempVolume = 0;
			}
			SetSoundVol(tempVolume);

			G.soundOn = thisSound && tempVolume !== 0;
			GetDItem(theDlgPtr, soundOnItem, itemT, itemH, tempRect);
			if (G.soundOn) {
				SetCtlValue(itemH.v as ControlHandle, 1);
			} else {
				SetCtlValue(itemH.v as ControlHandle, 0);
			}

			G.musicOn = thisMusic && tempVolume !== 0;
			GetDItem(theDlgPtr, musicOnItem, itemT, itemH, tempRect);
			if (G.musicOn) {
				SetCtlValue(itemH.v as ControlHandle, 1);
			} else {
				SetCtlValue(itemH.v as ControlHandle, 0);
			}

			RefreshIt();
		}

		if (itemHit === channel4Radio) {
			GetDItem(theDlgPtr, channel4Radio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 1);
			GetDItem(theDlgPtr, channel2Radio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 0);
			G.is4Channel = true;
		}

		if (itemHit === channel2Radio) {
			GetDItem(theDlgPtr, channel2Radio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 1);
			GetDItem(theDlgPtr, channel4Radio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 0);
			G.is4Channel = false;
		}
	} while (!leaveDlg);

	SetPort(wasPort);
	DisposDialog(theDlgPtr);
}

// =================================

export async function DoCustomizeKeys(): Promise<void> {
	const okayItem = 1;
	const cancelItem = 2;

	const leftIcon = 3;
	const rightIcon = 4;
	const energyIcon = 5;
	const bandIcon = 6;
	const leftStat = 7;
	const rightStat = 8;
	const energyStat = 9;
	const bandStat = 10;
	const modeStat = 11;
	const energyRadio = 12;
	const bandRadio = 13;

	const itemT = ref<Integer>(0);
	let itemHit: Integer;
	let rawKey: Integer;
	let rawChar: Integer;
	let newLeftKey: Integer;
	let newRightKey: Integer;
	let newEnergyKey: Integer;
	let newBandKey: Integer;
	// Port: the final tick counts that Delay returns are not used, as in the original.
	// oxlint-disable-next-line no-unused-vars
	let tempLong: LongInt;
	let tempStr = '';
	const itemH = ref<ItemHandle>(null);
	let tempRect: Rect;
	/** string[12] */
	let newLeftName: string;
	let newRightName: string;
	let newEnergyName: string;
	let newBandName: string;
	let leaveDlg: boolean;
	let newButtonFires: boolean;

	// ------------------

	function RefreshIt(): void {
		SetPort(theDlgPtr);
		GetDItem(theDlgPtr, okayItem, itemT, itemH, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenNormal();
	}

	// ------------------

	/** Returns a string12. */
	function ShowKeyName(rawKeyCode: Integer, rawCharCode: Integer): string {
		if (rawCharCode >= 0x21 && rawCharCode <= 0x7a) {
			if (rawKeyCode >= 0x41 && rawKeyCode <= 0x5c) {
				tempStr = Concat(Chr(rawCharCode), ' keypad');
			} else {
				tempStr = Concat(Chr(rawCharCode), ' key');
			}
		} else {
			switch (rawCharCode) {
				case 0x01:
					tempStr = 'home';
					break;
				case 0x03:
					tempStr = 'enter';
					break;
				case 0x04:
					tempStr = 'end';
					break;
				case 0x05:
					tempStr = 'help';
					break;
				case 0x08:
					tempStr = 'delete';
					break;
				case 0x09:
					tempStr = 'tab';
					break;
				case 0x0b:
					tempStr = 'page up';
					break;
				case 0x0c:
					tempStr = 'page down';
					break;
				case 0x0d:
					tempStr = 'return';
					break;
				case 0x10:
					switch (rawKeyCode) {
						case 0x60:
							tempStr = 'F5 key';
							break;
						case 0x61:
							tempStr = 'F6 key';
							break;
						case 0x62:
							tempStr = 'F7 key';
							break;
						case 0x63:
							tempStr = 'F3 key';
							break;
						case 0x64:
							tempStr = 'F8 key';
							break;
						case 0x65:
							tempStr = 'F9 key';
							break;
						case 0x67:
							tempStr = 'F11 key';
							break;
						case 0x69:
							tempStr = 'F13 key';
							break;
						case 0x6b:
							tempStr = 'F14 key';
							break;
						case 0x6d:
							tempStr = 'F10 key';
							break;
						case 0x6f:
							tempStr = 'F12 key';
							break;
						case 0x71:
							tempStr = 'F15 key';
							break;
						case 0x76:
							tempStr = 'F4 key';
							break;
						case 0x78:
							tempStr = 'F2 key';
							break;
						case 0x7a:
							tempStr = 'F1 key';
							break;
						default:
							tempStr = NumToString(rawKeyCode);
					}
					break;
				case 0x1a:
					tempStr = 'clear';
					break;
				case 0x1b:
					if (rawKeyCode === 0x47) {
						tempStr = 'clear';
					} else {
						tempStr = 'escape';
					}
					break;
				case 0x1c:
					tempStr = 'left arrow';
					break;
				case 0x1d:
					tempStr = 'right arrow';
					break;
				case 0x1e:
					tempStr = 'up arrow';
					break;
				case 0x1f:
					tempStr = 'down arrow';
					break;
				case 0x20:
					tempStr = 'space';
					break;
				case 0x7f:
					tempStr = 'del key';
					break;
				default:
					tempStr = 'unknown';
			}
		}

		return pString(tempStr, 12);
	}

	// ------------------

	FlushEvents(everyEvent, 0);

	const wasPort = GetPort();
	UseResFile(G.gliderResNum);

	const theDlgPtr = GetNewDialog(rCustomKeysID, null, inFront)!;
	tempRect = cloneRect(theDlgPtr.portRect);
	tempRect.top = div(screenBits.bounds.bottom - screenBits.bounds.top - (tempRect.bottom - tempRect.top), 2);
	tempRect.left = div(screenBits.bounds.right - screenBits.bounds.left - (tempRect.right - tempRect.left), 2);
	MoveWindow(theDlgPtr, tempRect.left, tempRect.top, true); // Now move the window to the proper position
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	newLeftKey = G.leftKey;
	newRightKey = G.rightKey;
	newEnergyKey = G.energyKey;
	newBandKey = G.bandKey;
	newButtonFires = G.buttonFires;

	newLeftName = G.leftName;
	newRightName = G.rightName;
	newEnergyName = G.energyName;
	newBandName = G.bandName;

	GetDItem(theDlgPtr, leftStat, itemT, itemH, tempRect);
	SetIText(itemH.v as Handle, newLeftName);
	GetDItem(theDlgPtr, rightStat, itemT, itemH, tempRect);
	SetIText(itemH.v as Handle, newRightName);
	GetDItem(theDlgPtr, energyStat, itemT, itemH, tempRect);
	SetIText(itemH.v as Handle, newEnergyName);
	GetDItem(theDlgPtr, bandStat, itemT, itemH, tempRect);
	SetIText(itemH.v as Handle, newBandName);

	if (newButtonFires) {
		GetDItem(theDlgPtr, bandRadio, itemT, itemH, tempRect);
	} else {
		GetDItem(theDlgPtr, energyRadio, itemT, itemH, tempRect);
	}
	SetCtlValue(itemH.v as ControlHandle, 1);

	RefreshIt();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, itemT, itemH, tempRect);

		if (itemHit >= leftIcon && itemHit <= bandIcon) {
			GetDItem(theDlgPtr, itemHit, itemT, itemH, tempRect);
			InvertRect(tempRect);

			GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
			SetIText(itemH.v as Handle, 'The next key you strike will control this function.');
			InvertRect(tempRect);
			// repeat until not Button
			while (Button()) {
				await Yield();
			}
			FlushEvents(everyEvent, 0);
			// repeat until GetNextEvent(keyDownMask, theEvent) (GetNextEvent lets a tick pass when there is no event)
			while (!(await GetNextEvent(keyDownMask, G.theEvent))) {
				// wait
			}
			rawKey = LoWord(div(BitAnd(keyCodeMask, G.theEvent.message), 0xff));
			rawChar = LoWord(BitAnd(charCodeMask, G.theEvent.message));
			FlushEvents(everyEvent, 0);

			InvertRect(tempRect);
			GetDItem(theDlgPtr, itemHit, itemT, itemH, tempRect);
			InvertRect(tempRect);

			tempStr = ShowKeyName(rawKey, rawChar);
			GetDItem(theDlgPtr, itemHit + 4, itemT, itemH, tempRect);
			SetIText(itemH.v as Handle, tempStr);

			if (tempStr === 'tab') {
				SysBeep(3);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'The TAB key is reserved for pausing Glider.');
				tempLong = await Delay(180);
				switch (itemHit) {
					case leftIcon:
						tempStr = newLeftName;
						break;
					case rightIcon:
						tempStr = newRightName;
						break;
					case energyIcon:
						tempStr = newEnergyName;
						break;
					default:
						tempStr = newBandName;
				}
				GetDItem(theDlgPtr, itemHit + 4, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, tempStr);
			} else {
				switch (itemHit) {
					case leftIcon: {
						newLeftKey = rawKey;
						newLeftName = Copy(tempStr, 1, 12);
						break;
					}
					case rightIcon: {
						newRightKey = rawKey;
						newRightName = Copy(tempStr, 1, 12);
						break;
					}
					case energyIcon: {
						newEnergyKey = rawKey;
						newEnergyName = Copy(tempStr, 1, 12);
						break;
					}
					default: {
						newBandKey = rawKey;
						newBandName = Copy(tempStr, 1, 12);
					}
				}
			}

			GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
			SetIText(itemH.v as Handle, 'Click on an icon to change its controlling key.');
		}

		if (itemHit === energyRadio) {
			newButtonFires = false;
			GetDItem(theDlgPtr, energyRadio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 1);
			GetDItem(theDlgPtr, bandRadio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 0);
		}

		if (itemHit === bandRadio) {
			newButtonFires = true;
			GetDItem(theDlgPtr, bandRadio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 1);
			GetDItem(theDlgPtr, energyRadio, itemT, itemH, tempRect);
			SetCtlValue(itemH.v as ControlHandle, 0);
		}

		if (itemHit === okayItem) {
			leaveDlg = true;

			if (newLeftKey === newRightKey || newLeftKey === newEnergyKey || newLeftKey === newBandKey) {
				SysBeep(3);
				newLeftKey = G.leftKey;
				newLeftName = G.leftName;
				GetDItem(theDlgPtr, leftStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, newLeftName);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'Your Left Key has been assigned to another function.');
				tempLong = await Delay(180);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'Click on an icon to change its controlling key.');
				leaveDlg = false;
			}

			if (newRightKey === newEnergyKey || newRightKey === newBandKey) {
				SysBeep(3);
				newRightKey = G.rightKey;
				newRightName = G.rightName;
				GetDItem(theDlgPtr, rightStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, newRightName);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'Your Right Key has been assigned to another function.');
				tempLong = await Delay(180);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'Click on an icon to change its controlling key.');
				leaveDlg = false;
			}

			if (newEnergyKey === newBandKey) {
				SysBeep(3);
				newEnergyKey = G.energyKey;
				newEnergyName = G.energyName;
				GetDItem(theDlgPtr, energyStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, newEnergyName);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'Your Energize Key has been assigned to another function.');
				tempLong = await Delay(180);
				GetDItem(theDlgPtr, modeStat, itemT, itemH, tempRect);
				SetIText(itemH.v as Handle, 'Click on an icon to change its controlling key.');
				leaveDlg = false;
			}

			if (leaveDlg) {
				G.leftKey = newLeftKey;
				G.rightKey = newRightKey;
				G.energyKey = newEnergyKey;
				G.bandKey = newBandKey;
				G.buttonFires = newButtonFires;

				G.leftName = newLeftName;
				G.rightName = newRightName;
				G.energyName = newEnergyName;
				G.bandName = newBandName;
			}
		}

		if (itemHit === cancelItem) {
			leaveDlg = true;
		}
	} while (!leaveDlg);

	SetPort(wasPort);
	DisposDialog(theDlgPtr);
}
