// Port of G-PlayUtils.p.

import {
	Alert,
	black,
	CloseResFile,
	CloseRgn,
	cloneRect,
	CopyBits,
	CopyMask,
	DisposDialog,
	DisposeRgn,
	DisposPixPat,
	DrawPicture,
	DrawString,
	EraseRect,
	type EventRecord,
	everyEvent,
	FillRect,
	FlushEvents,
	FrameRect,
	FrameRoundRect,
	FSClose,
	FSOpen,
	FSRead,
	FSWrite,
	fsFromStart,
	Get1Resource,
	GetDItem,
	GetIndPattern,
	GetIText,
	GetNewDialog,
	GetPicture,
	GetPixPat,
	GetPort,
	gray,
	type Handle,
	HGetState,
	HLock,
	HNoPurge,
	HPurge,
	HSetState,
	HUnlock,
	inFront,
	InitCursor,
	InsetRect,
	type Integer,
	InvertRect,
	type ItemHandle,
	keyDown,
	Line,
	LineTo,
	type LongInt,
	LoWord,
	ModalDialog,
	MoveTo,
	MoveWindow,
	NewRgn,
	noErr,
	NumToString,
	OffsetRect,
	OpenResFile,
	OpenRgn,
	PaintOval,
	PaintRect,
	PaintRgn,
	patCopy,
	patOr,
	patXor,
	PenMode,
	PenNormal,
	PenPat,
	PenPixPat,
	PenSize,
	type Rect,
	RectRgn,
	ref,
	ReleaseResource,
	RGBForeColor,
	type RGBColor,
	screenBits,
	SelectWindow,
	SelIText,
	SetEOF,
	SetFPos,
	SetIText,
	SetPort,
	SetRect,
	SetVol,
	ShowWindow,
	srcCopy,
	srcOr,
	systemFont,
	TextFont,
	TextMode,
	TextSize,
	TickCount,
	transparent,
	UnionRect,
	UnionRgn,
	UseResFile,
	white,
	type DialogRecord,
	type Ref,
	BitAnd,
	charCodeMask,
	Copy,
	int16,
	int32,
	div,
	pString,
	dkGray,
	ltGray,
} from '../mac/Toolbox.ts';
import { PRect, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import {
	airOnIt,
	ascendIt,
	awardIt,
	ball,
	bandIt,
	basket,
	battry,
	bnsRct,
	books,
	burning,
	burnIt,
	cabnet,
	candle,
	celDct,
	celVnt,
	clock,
	crashIt,
	descendIt,
	dnStar,
	drip,
	dropIt,
	energizeIt,
	extraIt,
	extRct,
	fadingIn,
	flrVnt,
	fshBwl,
	G,
	grease,
	guitar,
	houseRecLayout,
	ignoreIt,
	kArtType,
	kCeilingVert,
	kCRSound,
	kErrGraphicLoad,
	kErrGraphicsNotFound,
	kErrWrongHouseVers,
	kFloorVert,
	kMusicSound,
	kReturnKey,
	kTapSound,
	kWhistleSound,
	lftFan,
	liftIt,
	lightIt,
	litSwt,
	macTsh,
	mirror,
	moveIt,
	obsRct,
	outlet,
	paintg,
	paper,
	playIt,
	pwrSwt,
	rbrBnd,
	ritFan,
	rQuitNoSaveAlertID,
	shelf,
	shredIt,
	shredr,
	slideIt,
	spillIt,
	table,
	teaKtl,
	thermo,
	toastr,
	toggleIt,
	trickIt,
	turnItLeft,
	turnItRight,
	upStar,
	window,
	zapIt,
} from './Globals.ts';
import { DoTheMusic, DoTheSound, GenericAlert, Randomize, SetPage, ShowMenuBar } from './GlobalUtils.ts';
import { DoOpen, GetHouse } from './FileInNOut.ts';

// =================================

export function ForceMainToVisible(): void {
	if (G.areFlipping && G.mainScreenHidden) {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, null);
		G.mainScreenHidden = false;
		SetPage(G.mainScreenHidden);
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, null);
	}
}

// =================================

export function ArrangeTiles(): void {
	let i: Integer;
	let panel: Integer;

	for (i = 0; i <= 7; i++) {
		panel = G.thisHouse.theRooms[G.roomAt]!.tileOrder[i]!;
		if (G.inColor) {
			CopyBits(G.loadCPtr!.portPixMap, G.virginCPtr!.portPixMap, G.tileRects[panel]!, G.tileRects[i]!, srcCopy, null);
		} else {
			CopyBits(G.offLoadMap, G.offVirginMap, G.tileRects[panel]!, G.tileRects[i]!, srcCopy, null);
		}
	}
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, null);
	} else {
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, null);
	}
}

// =================================

export async function LoadABackground(whichID: Integer): Promise<void> {
	let refNumber: Integer;
	let tempByte: Integer;
	let thePict;

	refNumber = OpenResFile(G.resourceName);
	if (refNumber === -1) {
		UseResFile(G.gliderResNum);
		await GenericAlert(kErrGraphicsNotFound);
		if (!(await DoOpen(kArtType))) {
			ShowMenuBar();
			return;
		}
		refNumber = OpenResFile(G.resourceName);
		if (refNumber === -1) {
			await GenericAlert(kErrGraphicsNotFound);
			ShowMenuBar();
			G.playing = false;
			return;
		}
	}

	if (G.areFlipping) {
		ForceMainToVisible();
	}

	const wasPort = GetPort();
	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}

	thePict = GetPicture(whichID);
	if (thePict !== null) {
		tempByte = HGetState(thePict);
		HLock(thePict);
		DrawPicture(thePict, G.wholeArea);
		HSetState(thePict, tempByte);
	} else {
		switch (whichID) {
			// try to substitute
			case 205:
				thePict = GetPicture(201);
				break;
			case 206:
				thePict = GetPicture(204);
				break;
			case 207:
				thePict = GetPicture(200);
				break;
			case 208:
				thePict = GetPicture(203);
				break;
			case 209:
				thePict = GetPicture(200);
				break;
			default:
				await GenericAlert(kErrGraphicLoad);
				ShowMenuBar();
				G.playing = false;
				return;
		}
		if (thePict !== null) {
			tempByte = HGetState(thePict);
			HLock(thePict);
			DrawPicture(thePict, G.wholeArea);
			HSetState(thePict, tempByte);
		} else {
			await GenericAlert(kErrGraphicLoad);
			ShowMenuBar();
			G.playing = false;
			return;
		}
	}
	ReleaseResource(thePict as Handle);

	SetPort(wasPort);
	CloseResFile(refNumber);
	UseResFile(G.gliderResNum);
}

// =================================

function FillNFrame(theColor: RGBColor, theRect: Rect): void {
	RGBForeColor(theColor);
	PaintRect(theRect);
	RGBForeColor(G.rgbBlack);
	FrameRect(theRect);
}

// =================================

function GrayNFrame(theRect: Rect): void {
	FillRect(theRect, gray);
	FrameRect(theRect);
}

// =================================

function HiLiteARect(theColor: RGBColor, theRect: Rect): void {
	RGBForeColor(theColor);
	MoveTo(theRect.left + 1, theRect.top + 1);
	LineTo(theRect.right - 2, theRect.top + 1);
	LineTo(theRect.right - 2, theRect.bottom - 2);
	RGBForeColor(G.rgbBlack);
}

// =================================

function GrayLiteARect(theRect: Rect): void {
	PenPat(white);
	MoveTo(theRect.left + 1, theRect.top + 1);
	LineTo(theRect.right - 2, theRect.top + 1);
	LineTo(theRect.right - 2, theRect.bottom - 2);
	PenNormal();
	MoveTo(theRect.left + 1, theRect.top + 1);
	LineTo(theRect.left + 1, theRect.bottom - 2);
	LineTo(theRect.right - 2, theRect.bottom - 2);
}

// =================================

function LoLiteARect(theRect: Rect): void {
	RGBForeColor(G.rgbLtBrown);
	MoveTo(theRect.left - 1, theRect.top);
	LineTo(theRect.left - 1, theRect.bottom);
	LineTo(theRect.right - 1, theRect.bottom);
	RGBForeColor(G.rgbDkGray);
	MoveTo(theRect.left, theRect.top - 1);
	LineTo(theRect.right, theRect.top - 1);
	LineTo(theRect.right, theRect.bottom);
	RGBForeColor(G.rgbBlack);
}

// =================================

function GrayLoARect(theRect: Rect): void {
	PenPat(white);
	MoveTo(theRect.left - 1, theRect.top);
	LineTo(theRect.left - 1, theRect.bottom);
	LineTo(theRect.right - 1, theRect.bottom);
	PenNormal();
	MoveTo(theRect.left, theRect.top - 1);
	LineTo(theRect.right, theRect.top - 1);
	LineTo(theRect.right, theRect.bottom);
}

// =================================

function DrawTable(whichItem: Integer): void {
	let kind: Integer;
	let theRect: Rect;
	let tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	const wasPort = GetPort();
	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	PenNormal();

	{
		const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[whichItem]!;
		kind = theObject.objectIs;
		theRect = cloneRect(theObject.boundRect);
	}
	if (G.inColor) {
		// ***** Draw table top
		RGBForeColor(G.rgbBrown);
		PaintRect(theRect);
		RGBForeColor(G.rgbBlack);
		FrameRect(theRect);
		MoveTo(theRect.left + 1, theRect.bottom - 2);
		LineTo(theRect.right - 1, theRect.bottom - 2);
		RGBForeColor(G.rgbLtBrown);
		MoveTo(theRect.left + 1, theRect.top + 1);
		LineTo(theRect.right - 2, theRect.top + 1);
		RGBForeColor(G.rgbBlack);
	} else {
		FillRect(theRect, gray);
		FrameRect(theRect);
		MoveTo(theRect.left + 1, theRect.bottom - 2);
		LineTo(theRect.right - 1, theRect.bottom - 2);
		PenPat(white);
		MoveTo(theRect.left + 1, theRect.top + 1);
		LineTo(theRect.right - 2, theRect.top + 1);
	}

	PenNormal(); // ***** Draw table shadow
	SetRect(tempRect, theRect.left, kFloorVert - 0, theRect.right, kFloorVert + 20);
	OffsetRect(tempRect, div(theRect.top - kFloorVert, 5), 0);
	if (G.inColor) {
		PenMode(patCopy + transparent);
		PenPat(gray);
		PaintOval(tempRect);
	} else {
		PenMode(patOr);
		PenPat(gray);
		PaintOval(tempRect);
	}
	PenNormal();

	if (G.inColor) {
		// ***** Draw table support
		RGBForeColor(G.rgbBlack);
		PenSize(5, 1);
		MoveTo(div(theRect.left + theRect.right, 2) - 2, theRect.bottom);
		LineTo(div(theRect.left + theRect.right, 2) - 2, kFloorVert - 7);
		RGBForeColor(G.rgbWhite);
		PenSize(1, 1);
		MoveTo(div(theRect.left + theRect.right, 2) + 1, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 1, kFloorVert - 7);
		RGBForeColor(G.rgbLtBrown);
		MoveTo(div(theRect.left + theRect.right, 2) + 0, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 0, kFloorVert - 7);
		RGBForeColor(G.rgbBlack);
	} else {
		PenSize(5, 1);
		MoveTo(div(theRect.left + theRect.right, 2) - 2, theRect.bottom);
		LineTo(div(theRect.left + theRect.right, 2) - 2, kFloorVert - 7);
		PenPat(white);
		PenSize(1, 1);
		MoveTo(div(theRect.left + theRect.right, 2) + 1, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 1, kFloorVert - 7);
		PenPat(gray);
		MoveTo(div(theRect.left + theRect.right, 2) + 0, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 0, kFloorVert - 7);
	}
	PenNormal();

	tempRect = cloneRect(G.srcRect[kind]!); // ***** Draw table base
	OffsetRect(tempRect, -tempRect.left, -tempRect.top);
	OffsetRect(tempRect, div(theRect.left + theRect.right, 2) - 31, kFloorVert - 7);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	}
	SetPort(wasPort);
}

// =================================

function DrawShelf(whichItem: Integer): void {
	let kind: Integer;
	let theRect: Rect;
	let tempRect: Rect;

	const wasPort = GetPort();
	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	PenNormal();
	{
		const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[whichItem]!;
		kind = theObject.objectIs;
		theRect = cloneRect(theObject.boundRect);
	}

	if (G.inColor) {
		// ***** Draw shelf top
		RGBForeColor(G.rgbLtBrown);
		PaintRect(theRect);
		FrameRect(theRect);
		MoveTo(theRect.left + 1, theRect.bottom - 2);
		LineTo(theRect.right - 1, theRect.bottom - 2);
		RGBForeColor(G.rgbWhite);
		MoveTo(theRect.left + 1, theRect.top + 1);
		LineTo(theRect.right - 2, theRect.top + 1);
	} else {
		FillRect(theRect, gray);
		FrameRect(theRect);
		MoveTo(theRect.left + 1, theRect.bottom - 2);
		LineTo(theRect.right - 1, theRect.bottom - 2);
		PenPat(white);
		MoveTo(theRect.left + 1, theRect.top + 1);
		LineTo(theRect.right - 2, theRect.top + 1);
	}
	PenNormal();

	const tempRgn = NewRgn(); // ***** Draw shelf shadow
	MoveTo(theRect.right, theRect.bottom - 1);
	OpenRgn();
	Line(-15, 15);
	LineTo(theRect.left - 15, theRect.bottom + 14);
	Line(0, -5);
	Line(15, -15);
	Line(0, 5);
	LineTo(theRect.right, theRect.bottom - 1);
	CloseRgn(tempRgn);
	PenPat(gray);
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
		PenMode(patCopy + transparent);
		PenPat(gray);
		PaintRgn(tempRgn);
	} else {
		PenMode(patOr);
		PaintRgn(tempRgn);
	}
	DisposeRgn(tempRgn);

	PenNormal();
	tempRect = cloneRect(G.srcRect[kind]!); // ***** Draw shelf bracket 1
	OffsetRect(tempRect, -tempRect.left, -tempRect.top); // 0 it out
	OffsetRect(tempRect, theRect.left + 15, theRect.bottom - 2);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	}
	tempRect = cloneRect(G.srcRect[kind]!); // ***** Draw shelf bracket 2
	OffsetRect(tempRect, -tempRect.left, -tempRect.top); // 0 it out
	OffsetRect(tempRect, theRect.right - 25, theRect.bottom - 2);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	}
	SetPort(wasPort);
}

// =================================

function DrawMirror(whichItem: Integer): void {
	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	PenNormal();
	const theRect = cloneRect(G.thisHouse.theRooms[G.roomAt]!.theObjects[whichItem]!.boundRect);
	if (G.inColor) {
		RGBForeColor(G.rgbBrown);
		PaintRect(theRect);
		RGBForeColor(G.rgbBlack);
	} else {
		FillRect(theRect, gray);
	}
	FrameRect(theRect);
	InsetRect(theRect, 3, 3);
	FillRect(theRect, white);
	FrameRect(theRect);
	PenNormal();
}

// =================================

function DrawCabinet(whichItem: Integer): void {
	let panels: Integer;
	let width: Integer;
	let index: Integer;
	let offIt: Integer;
	let tempR: Rect;
	let shadoRgn;

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	PenNormal();
	const theRect = cloneRect(G.thisHouse.theRooms[G.roomAt]!.theObjects[whichItem]!.boundRect);
	tempR = cloneRect(theRect);

	if (theRect.bottom > 280) {
		tempR.bottom = tempR.bottom - 5;
		if (G.inColor) {
			RGBForeColor(G.rgbBrown);
			PenMode(srcCopy + transparent);
			PaintRect(tempR);
			RGBForeColor(G.rgbBlack);
		} else {
			FillRect(tempR, gray);
		}
		FrameRect(tempR);
		tempR = cloneRect(theRect);
		InsetRect(tempR, 2, 0);
		tempR.top = tempR.bottom - 5;
		if (G.inColor) {
			PaintRect(tempR);
		} else {
			FillRect(tempR, dkGray);
		}
		FrameRect(tempR);

		SetRect(tempR, theRect.left - 2, theRect.top, theRect.right + 2, theRect.top + 7);
		if (G.inColor) {
			RGBForeColor(G.rgbLtBrown);
			PenMode(srcCopy + transparent);
			PaintRect(tempR);
			RGBForeColor(G.rgbBlack);
		} else {
			FillRect(tempR, ltGray);
		}
		FrameRect(tempR);
		MoveTo(tempR.left + 2, tempR.bottom);
		LineTo(tempR.right - 3, tempR.bottom);

		shadoRgn = NewRgn();
		MoveTo(theRect.left, theRect.top + 5);
		OpenRgn();
		Line(-15, 15);
		LineTo(theRect.left - 15, theRect.bottom - 10);
		LineTo(theRect.left, theRect.bottom);
		LineTo(theRect.left, theRect.top + 5);
		CloseRgn(shadoRgn);
		HLock(shadoRgn);
		if (G.inColor) {
			RGBForeColor(G.rgbBlack);
			PenMode(patCopy + transparent);
			PenPat(gray);
			PaintRgn(shadoRgn);
		} else {
			PenMode(patOr);
			PenPat(gray);
			PaintRgn(shadoRgn);
		}
		HUnlock(shadoRgn);
		DisposeRgn(shadoRgn);
		PenNormal();

		offIt = 5;
	} else {
		if (G.inColor) {
			RGBForeColor(G.rgbBrown);
			PenMode(srcCopy + transparent);
			PaintRect(theRect);
			RGBForeColor(G.rgbBlack);
		} else {
			FillRect(theRect, gray);
		}
		FrameRect(theRect);

		shadoRgn = NewRgn();
		MoveTo(theRect.left, theRect.top);
		OpenRgn();
		Line(-15, 15);
		LineTo(theRect.left - 15, theRect.bottom + 15);
		LineTo(theRect.right - 15, theRect.bottom + 15);
		Line(15, -15);
		LineTo(theRect.left, theRect.bottom);
		LineTo(theRect.left, theRect.top);
		CloseRgn(shadoRgn);
		HLock(shadoRgn);
		if (G.inColor) {
			PenMode(srcCopy + transparent);
			PenPat(gray);
			PaintRgn(shadoRgn);
		} else {
			PenMode(patOr);
			PenPat(gray);
			PaintRgn(shadoRgn);
		}
		HUnlock(shadoRgn);
		DisposeRgn(shadoRgn);
		PenNormal();
		offIt = 0;
	}

	panels = div(theRect.right - theRect.left, 48);
	if (panels === 0) {
		tempR = cloneRect(theRect);
		InsetRect(tempR, 5, 5 + offIt);
		FrameRect(tempR);
		if (G.inColor) {
			RGBForeColor(G.rgbLtBrown);
			MoveTo(tempR.left + 3, tempR.top + 3);
			LineTo(tempR.left + 3, tempR.bottom - 4);
			LineTo(tempR.right - 4, tempR.bottom - 4);
			RGBForeColor(G.rgbBlack);
			LineTo(tempR.right - 4, tempR.top + 3);
			LineTo(tempR.left + 3, tempR.top + 3);
		} else {
			PenPat(white);
			MoveTo(tempR.left + 3, tempR.top + 3);
			LineTo(tempR.left + 3, tempR.bottom - 4);
			LineTo(tempR.right - 4, tempR.bottom - 4);
			PenPat(black);
			LineTo(tempR.right - 4, tempR.top + 3);
			LineTo(tempR.left + 3, tempR.top + 3);
		}
	} else {
		width = div(theRect.right - theRect.left - (panels + 1) * 5, panels);
		SetRect(tempR, theRect.left + 5, theRect.top + 5 + offIt, theRect.left + 5 + width, theRect.bottom - 5 - offIt);
		for (index = 1; index <= panels; index++) {
			if (G.inColor) {
				RGBForeColor(G.rgbLtBrown);
				MoveTo(tempR.left + 3, tempR.top + 3);
				LineTo(tempR.left + 3, tempR.bottom - 4);
				LineTo(tempR.right - 4, tempR.bottom - 4);
				RGBForeColor(G.rgbBlack);
				LineTo(tempR.right - 4, tempR.top + 3);
				LineTo(tempR.left + 3, tempR.top + 3);
			} else {
				FrameRect(tempR);
				PenPat(white);
				MoveTo(tempR.left + 3, tempR.top + 3);
				LineTo(tempR.left + 3, tempR.bottom - 4);
				LineTo(tempR.right - 4, tempR.bottom - 4);
				PenPat(black);
				LineTo(tempR.right - 4, tempR.top + 3);
				LineTo(tempR.left + 3, tempR.top + 3);
			}
			OffsetRect(tempR, width + 5, 0);
		}
	}
	PenNormal();
}

// =================================

function DrawWindow(whichItem: Integer): void {
	let tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	PenNormal();

	const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[whichItem]!;
	const theRect = cloneRect(theObject.boundRect);
	const windowOpen = theObject.isOn;

	const tempRgn = NewRgn(); // ***** Draw window shadow
	MoveTo(theRect.left, theRect.top);
	OpenRgn();
	Line(-10, 10);
	Line(0, 5);
	Line(5, 5);
	LineTo(theRect.left - 5, theRect.bottom - 10);
	Line(-5, 5);
	Line(0, 5);
	Line(5, 5);
	LineTo(theRect.right - 5, theRect.bottom + 5);
	LineTo(theRect.right, theRect.bottom);
	LineTo(theRect.left, theRect.bottom);
	LineTo(theRect.left, theRect.top);
	CloseRgn(tempRgn);
	PenPat(gray);
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
		PenMode(patCopy + transparent);
		PenPat(gray);
		PaintRgn(tempRgn);
	} else {
		PenMode(patOr);
		PaintRgn(tempRgn);
	}
	DisposeRgn(tempRgn);
	PenNormal();

	if (G.inColor) {
		FillNFrame(G.rgbBrown, theRect); // ***** Draw window frame and sill
		HiLiteARect(G.rgbLtBrown, theRect);
		SetRect(tempRect, theRect.left - 4, theRect.top, theRect.right + 4, theRect.top + 6);
		FillNFrame(G.rgbBrown, tempRect);
		HiLiteARect(G.rgbLtBrown, tempRect);
		SetRect(tempRect, theRect.left - 2, theRect.top + 6, theRect.right + 2, theRect.top + 10);
		FillNFrame(G.rgbBrown, tempRect);
		SetRect(tempRect, theRect.left - 4, theRect.bottom - 6, theRect.right + 4, theRect.bottom);
		FillNFrame(G.rgbBrown, tempRect);
		HiLiteARect(G.rgbLtBrown, tempRect);
		SetRect(tempRect, theRect.left - 2, theRect.bottom - 10, theRect.right + 2, theRect.bottom - 5);
		FillNFrame(G.rgbBrown, tempRect);
		HiLiteARect(G.rgbLtBrown, tempRect);
		tempRect = cloneRect(theRect);
		InsetRect(tempRect, 8, 16);
		FillNFrame(G.rgbBrown, tempRect);
		LoLiteARect(tempRect);
		tempRect = cloneRect(theRect); // ***** Draw the top window pane
		InsetRect(tempRect, 8, 16);
		tempRect.bottom = div(theRect.bottom + theRect.top, 2) + 2;
		FillNFrame(G.rgbBrown, tempRect);
		InsetRect(tempRect, 6, 6);
		LoLiteARect(tempRect);
		InsetRect(tempRect, 2, 2);
		LoLiteARect(tempRect);
		InsetRect(tempRect, 2, 2);
		FillNFrame(G.rgbBlack, tempRect);
		LoLiteARect(tempRect);
		tempRect = cloneRect(theRect); // Fill bottom black
		InsetRect(tempRect, 8, 16);
		tempRect.top = div(theRect.bottom + theRect.top, 2) + 2;
		FillRect(tempRect, black);
		tempRect = cloneRect(theRect); // ***** Draw the bottom window pane
		InsetRect(tempRect, 8, 16);
		tempRect.top = div(theRect.bottom + theRect.top, 2) - 2;
		if (windowOpen) {
			OffsetRect(tempRect, 0, 26 - div(theRect.bottom - theRect.top, 2));
		}
		FillNFrame(G.rgbBrown, tempRect);
		InsetRect(tempRect, 6, 6);
		LoLiteARect(tempRect);
		InsetRect(tempRect, 2, 2);
		LoLiteARect(tempRect);
		InsetRect(tempRect, 2, 2);
		FillNFrame(G.rgbBlack, tempRect);
		LoLiteARect(tempRect);

		RGBForeColor(G.rgbBlack);
	} else {
		GrayNFrame(theRect); // ***** Draw window frame and sill
		GrayLiteARect(theRect);
		SetRect(tempRect, theRect.left - 4, theRect.top, theRect.right + 4, theRect.top + 6);
		GrayNFrame(tempRect);
		GrayLiteARect(tempRect);
		SetRect(tempRect, theRect.left - 2, theRect.top + 6, theRect.right + 2, theRect.top + 10);
		GrayNFrame(tempRect);
		SetRect(tempRect, theRect.left - 4, theRect.bottom - 6, theRect.right + 4, theRect.bottom);
		GrayNFrame(tempRect);
		GrayLiteARect(tempRect);
		SetRect(tempRect, theRect.left - 2, theRect.bottom - 10, theRect.right + 2, theRect.bottom - 5);
		GrayNFrame(tempRect);
		GrayLiteARect(tempRect);
		tempRect = cloneRect(theRect);
		InsetRect(tempRect, 8, 16);
		GrayNFrame(tempRect);
		GrayLoARect(tempRect);
		tempRect = cloneRect(theRect); // ***** Draw the top window pane
		InsetRect(tempRect, 8, 16);
		tempRect.bottom = div(theRect.bottom + theRect.top, 2) + 2;
		GrayNFrame(tempRect);
		InsetRect(tempRect, 6, 6);
		GrayLoARect(tempRect);
		InsetRect(tempRect, 2, 2);
		GrayLoARect(tempRect);
		InsetRect(tempRect, 2, 2);
		FillRect(tempRect, black);
		GrayLoARect(tempRect);
		tempRect = cloneRect(theRect); // Fill bottom black
		InsetRect(tempRect, 8, 16);
		tempRect.top = div(theRect.bottom + theRect.top, 2) + 2;
		FillRect(tempRect, black);
		tempRect = cloneRect(theRect); // ***** Draw the bottom window pane
		InsetRect(tempRect, 8, 16);
		tempRect.top = div(theRect.bottom + theRect.top, 2) - 2;
		if (windowOpen) {
			OffsetRect(tempRect, 0, 26 - div(theRect.bottom - theRect.top, 2));
		}
		GrayNFrame(tempRect);
		InsetRect(tempRect, 6, 6);
		GrayLoARect(tempRect);
		InsetRect(tempRect, 2, 2);
		GrayLoARect(tempRect);
		InsetRect(tempRect, 2, 2);
		FillRect(tempRect, black);
		GrayLoARect(tempRect);
	}
}

// =================================

async function DrawStair(whichItem: Integer): Promise<void> {
	let tempByte: Integer;
	let thePict;

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[whichItem]!;
	const kind = theObject.objectIs;
	const theRect = cloneRect(theObject.boundRect);

	const refNumber = OpenResFile(G.resourceName);
	if (refNumber === -1) {
		CloseResFile(refNumber);
		UseResFile(G.gliderResNum);
		await GenericAlert(kErrGraphicsNotFound);
		return;
	}

	if (kind === upStar) {
		thePict = GetPicture(198);
	} else {
		thePict = GetPicture(199);
	}

	if (thePict !== null) {
		tempByte = HGetState(thePict);
		HLock(thePict);
		DrawPicture(thePict, theRect);
		HSetState(thePict, tempByte);
	} else {
		await GenericAlert(kErrGraphicLoad);
	}
	ReleaseResource(thePict as Handle | null);

	CloseResFile(refNumber);
	UseResFile(G.gliderResNum);
}

// =================================

export async function DrawAllObjects(): Promise<void> {
	let index: Integer;
	let theSrc: Rect;
	let destRect: Rect;
	let destReserve: Rect;
	let airPat;
	let airCPat;

	if (G.nObjects < 0 || G.nObjects > 16) {
		await GenericAlert(kErrWrongHouseVers);
		ShowMenuBar();
		return;
	}

	if (G.nObjects === 0) {
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		}
		return;
	}

	if (G.lightsOut) {
		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
		PenNormal();
		PaintRect(G.wholeArea);
		for (index = 1; index <= G.thisHouse.theRooms[G.roomAt]!.numberOObjects; index++) {
			const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[index]!;
			if (theObject.objectIs === litSwt) {
				theSrc = cloneRect(G.srcRect[theObject.objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
			}
		}
		return;
	}

	for (index = 1; index <= G.thisHouse.theRooms[G.roomAt]!.numberOObjects; index++) {
		const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[index]!;
		const objectIs = theObject.objectIs;
		switch (objectIs) {
			case table:
				DrawTable(index);
				break;
			case shelf:
				DrawShelf(index);
				break;
			case cabnet:
				DrawCabinet(index);
				break;
			case books:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				break;
			case flrVnt:
			case celVnt:
			case celDct:
			case candle:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				if (G.airVisible) {
					if (G.inColor) {
						SetPort(G.virginCPtr!);
						PenNormal();
						RGBForeColor(G.rgbBlack);
						airCPat = GetPixPat(128);
						if (airCPat !== null) {
							PenPixPat(airCPat);
						}
						PenMode(srcCopy + transparent);
						PaintRect(G.eventRect[index]!);
						if (airCPat !== null) {
							DisposPixPat(airCPat);
						}
						PenNormal();
					} else {
						SetPort(G.offVirginPort!);
						PenNormal();
						airPat = GetIndPattern(128, 1);
						PenPat(airPat);
						PaintRect(G.eventRect[index]!);
						PenNormal();
					}
				}
				break;
			case lftFan:
			case ritFan:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				if (G.airVisible) {
					if (G.inColor) {
						SetPort(G.virginCPtr!);
						PenNormal();
						RGBForeColor(G.rgbBlack);
						airCPat = GetPixPat(129);
						if (airCPat !== null) {
							PenPixPat(airCPat);
						}
						PenMode(srcCopy + transparent);
						PaintRect(G.eventRect[index]!);
						if (airCPat !== null) {
							DisposPixPat(airCPat);
						}
						PenNormal();
					} else {
						SetPort(G.offVirginPort!);
						PenNormal();
						airPat = GetIndPattern(128, 2);
						PenPat(airPat);
						PaintRect(G.eventRect[index]!);
					}
				}
				break;
			case grease:
				destRect = cloneRect(theObject.boundRect);
				if (!theObject.isOn) {
					theSrc = cloneRect(G.srcRect[59]!); // spilled grease
					if (G.inColor) {
						SetPort(G.virginCPtr!);
						PenNormal();
						RGBForeColor(G.rgbBlack);
						PenSize(2, 2);
						MoveTo(destRect.right, destRect.bottom - 2);
						LineTo(theObject.amount, destRect.bottom - 2);
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
					} else {
						SetPort(G.offVirginPort!);
						PenNormal();
						PenSize(2, 2);
						MoveTo(destRect.right, destRect.bottom - 2);
						LineTo(theObject.amount, destRect.bottom - 2);
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
					}
				}
				break;
			case clock:
			case paper:
			case battry:
			case rbrBnd:
				if (theObject.amount > 0) {
					theSrc = cloneRect(G.srcRect[objectIs]!);
					destRect = cloneRect(theObject.boundRect);
					destReserve = cloneRect(destRect);
					OffsetRect(destReserve, -destReserve.left, -destReserve.top);
					OffsetRect(destReserve, G.reserveRects[index]!.left, G.reserveRects[index]!.top);
					if (G.inColor) {
						CopyBits(G.virginCPtr!.portPixMap, G.reserveCPtr!.portPixMap, destRect, destReserve, srcCopy, null);
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
					} else {
						CopyBits(G.offVirginMap, G.offReserveMap, destRect, destReserve, srcCopy, null);
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
					}
				}
				break;
			case litSwt:
			case outlet:
			case thermo:
			case shredr:
			case pwrSwt:
			case guitar:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				break;
			case drip:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				break;
			case toastr:
			case fshBwl:
			case teaKtl:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				break;
			case window:
				DrawWindow(index);
				break;
			case mirror:
				DrawMirror(index);
				break;
			case paintg:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyBits(G.objectCPtr!.portPixMap, G.virginCPtr!.portPixMap, theSrc, destRect, srcCopy, null);
				} else {
					CopyBits(G.offPlayerMap, G.offVirginMap, theSrc, destRect, srcCopy, null);
				}
				break;
			case basket:
			case macTsh:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, theSrc, theSrc, destRect);
				}
				break;
			case upStar:
			case dnStar:
				await DrawStair(index);
				break;
			default:
				continue;
		}
	}
}

// =================================

function PopTheScore(whatScore: LongInt): void {
	PenNormal();

	PaintRect(G.lgScoreRect);
	const tempStr = NumToString(whatScore);
	MoveTo(224, 17);
	TextFont(systemFont);
	TextSize(12);
	if (G.inColor) {
		RGBForeColor(G.rgbLtBlue);
		PenMode(srcOr);
		DrawString(tempStr);
		PenNormal();
		RGBForeColor(G.rgbBlack);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.smScoreRect, G.smScoreRect, srcCopy, G.wholeRgn);
	} else {
		TextMode(patXor);
		DrawString(tempStr);
		if (G.mainScreenHidden) {
			CopyBits(G.offVirginMap, G.offLoadMap, G.smScoreRect, G.smScoreRect, srcCopy, null);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.smScoreRect, G.smScoreRect, srcCopy, null);
		}
	}
}

// =================================

export function BumpTheScore(): void {
	G.rollScore = int32(G.rollScore + G.scoreIncrement);

	if (G.rollScore < G.roomScore + G.suppScore) {
		PopTheScore(G.rollScore);
		DoTheSound(21);
	} else {
		G.scoreIsRolling = false;
		G.rollScore = int32(G.roomScore + G.suppScore);
		PopTheScore(G.rollScore);

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.smScoreRect, G.smScoreRect, srcCopy, null);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.smScoreRect, G.smScoreRect, srcCopy, null);
			CopyBits(G.offVirginMap, G.offLoadMap, G.smScoreRect, G.smScoreRect, srcCopy, null);
		}
	}
}

// =================================

export function StartScoreRolling(): void {
	if (G.rollScore < G.roomScore + G.suppScore) {
		G.rollScore = int32(G.roomScore + G.suppScore);
		PopTheScore(G.rollScore);
	}
	G.scoreIsRolling = true;
}

// =================================

export function UpdateBandNumbers(): void {
	let tempStr: string;
	const dest: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	SetRect(dest, 346, 5, 359, 20);
	FillRect(dest, black);
	MoveTo(dest.left, dest.bottom - 2);
	TextFont(16);
	TextSize(12);
	if (G.theGlider.bands < 100) {
		tempStr = NumToString(G.theGlider.bands);
	} else {
		tempStr = '++';
	}
	if (G.inColor) {
		RGBForeColor(G.rgbLtGreen);
		PenMode(srcOr);
		DrawString(tempStr);
		PenNormal();
		RGBForeColor(G.rgbBlack);
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, dest, dest, srcCopy, null);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
	} else {
		TextMode(patXor);
		DrawString(tempStr);
		PenNormal();
		CopyBits(G.offVirginMap, G.offLoadMap, dest, dest, srcCopy, null);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
	}
}

// =================================

export function PopTokenBand(): void {
	const src: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const dest: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	SetRect(src, 36, 301, 45, 316);
	SetRect(dest, 359, 5, 368, 20);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, src, src, dest);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, src, src, dest);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, dest, dest, srcCopy, null);
		CopyBits(G.offVirginMap, G.offLoadMap, dest, dest, srcCopy, null);
	}
}

// =================================

export function UpdateBatteryEnergy(): void {
	let tempStr: string;
	const dest: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	SetRect(dest, 308, 5, 326, 20);
	FillRect(dest, black);
	MoveTo(dest.left, dest.bottom - 2);
	TextFont(16);
	TextSize(12);
	if (G.theGlider.energy < 1000) {
		tempStr = NumToString(G.theGlider.energy);
	} else {
		tempStr = '+++';
	}
	if (G.inColor) {
		RGBForeColor(G.rgbYellow);
		PenMode(srcOr);
		DrawString(tempStr);
		PenNormal();
		RGBForeColor(G.rgbBlack);
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, dest, dest, srcCopy, null);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
	} else {
		TextMode(patXor);
		DrawString(tempStr);
		PenNormal();
		CopyBits(G.offVirginMap, G.offLoadMap, dest, dest, srcCopy, null);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
	}
}

// =================================

export function PopTokenBattery(): void {
	const src: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const dest: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	SetRect(src, 46, 301, 55, 316);
	SetRect(dest, 326, 5, 335, 20);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, src, src, dest);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, src, src, dest);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, dest, dest, srcCopy, null);
		CopyBits(G.offVirginMap, G.offLoadMap, dest, dest, srcCopy, null);
	}
}

// =================================

export function DrawHeadline(): void {
	let index: Integer;
	let shown: Integer;
	const srcR: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	let tempStr: string;

	if (G.inColor) {
		// Draw the title of room
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	SetRect(tempRect, 3, 2, 162, 23);
	EraseRect(tempRect);
	PenNormal();
	TextFont(systemFont);
	TextSize(12);
	FrameRect(tempRect);
	MoveTo(tempRect.left - 1, tempRect.top + 2);
	LineTo(tempRect.left - 1, tempRect.bottom);
	LineTo(tempRect.right - 2, tempRect.bottom);
	tempStr = G.thisHouse.theRooms[G.roomAt]!.roomName;
	MoveTo(tempRect.left + 4, tempRect.top + 15);
	if (G.inColor) {
		InsetRect(tempRect, 2, 2);
		InvertRect(tempRect);
		RGBForeColor(G.rgbRed);
		PenMode(srcOr);
		DrawString(tempStr);
		PenNormal();
		RGBForeColor(G.rgbBlack);
	} else {
		DrawString(tempStr);
		InsetRect(tempRect, 2, 2);
		InvertRect(tempRect);
	}

	SetRect(srcR, 36, 318, 54, 341); // Pop up number of room
	SetRect(tempRect, 165, 1, 183, 24);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.virginCPtr!.portPixMap, srcR, tempRect, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offPlayerMap, G.offVirginMap, srcR, tempRect, srcCopy, G.wholeRgn);
	}
	if (G.roomsPassed > 99) {
		shown = div(G.roomsPassed, 100);
	} else {
		if (G.roomsPassed > 9) {
			shown = div(G.roomsPassed, 10);
		} else {
			shown = G.roomsPassed;
		}
	}
	MoveTo(tempRect.left + 5, tempRect.bottom - 6);
	tempStr = NumToString(shown);
	DrawString(tempStr);
	if (G.roomsPassed > 9) {
		OffsetRect(srcR, 18, 0);
		OffsetRect(tempRect, 20, 0);
		if (G.inColor) {
			CopyBits(G.objectCPtr!.portPixMap, G.virginCPtr!.portPixMap, srcR, tempRect, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offPlayerMap, G.offVirginMap, srcR, tempRect, srcCopy, G.wholeRgn);
		}
		if (G.roomsPassed > 99) {
			shown = div(G.roomsPassed, 10) - (G.roomsPassed % 10);
		} else {
			shown = G.roomsPassed % 10;
		}
		MoveTo(tempRect.left + 6, tempRect.bottom - 6);
		tempStr = NumToString(shown);
		DrawString(tempStr);
		if (G.roomsPassed > 99) {
			OffsetRect(srcR, -18, 0);
			OffsetRect(tempRect, 20, 0);
			if (G.inColor) {
				CopyBits(G.objectCPtr!.portPixMap, G.virginCPtr!.portPixMap, srcR, tempRect, srcCopy, G.wholeRgn);
			} else {
				CopyBits(G.offPlayerMap, G.offVirginMap, srcR, tempRect, srcCopy, G.wholeRgn);
			}
			shown = G.roomsPassed % 100;
			MoveTo(tempRect.left + 5, tempRect.bottom - 6);
			tempStr = NumToString(shown);
			DrawString(tempStr);
		}
	}

	PenNormal(); // Draw all 'token' gliders
	SetRect(tempRect, 302, 2, 510, 23);
	EraseRect(tempRect);
	FrameRect(tempRect);
	MoveTo(tempRect.left - 1, tempRect.top + 2);
	LineTo(tempRect.left - 1, tempRect.bottom);
	LineTo(tempRect.right - 2, tempRect.bottom);
	InsetRect(tempRect, 2, 2);
	InvertRect(tempRect);
	if (G.mortals > 1) {
		if (G.mortals > 3) {
			SetRect(tempRect, 384, 5, 396, 20);
			MoveTo(tempRect.left, tempRect.bottom - 2);
			TextFont(16);
			TextSize(12);
			tempStr = NumToString(G.mortals - 1);
			if (G.inColor) {
				RGBForeColor(G.rgbRed);
				PenMode(srcOr);
				DrawString(tempStr);
				PenNormal();
				RGBForeColor(G.rgbBlack);
			} else {
				TextMode(patXor);
				DrawString(tempStr);
				PenNormal();
			}

			shown = 3;
		} else {
			shown = G.mortals - 1;
		}
		SetRect(tempRect, 470, 5, 505, 20);
		SetRect(srcR, 0, 318, 35, 333);
		for (index = 1; index <= shown; index++) {
			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, srcR, srcR, tempRect);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, srcR, srcR, tempRect);
			}
			OffsetRect(tempRect, -37, 0);
		}
	}

	PenNormal(); // Draw score box
	SetRect(tempRect, 220, 2, 298, 23);
	EraseRect(tempRect);
	FrameRect(tempRect);
	MoveTo(tempRect.left - 1, tempRect.top + 2);
	LineTo(tempRect.left - 1, tempRect.bottom);
	LineTo(tempRect.right - 2, tempRect.bottom);
	InsetRect(tempRect, 2, 2);
	InvertRect(tempRect);
	PopTheScore(G.rollScore);

	if (G.theGlider.bands > 0) {
		PopTokenBand();
		UpdateBandNumbers();
	}

	if (G.theGlider.energy > 0) {
		PopTokenBattery();
		UpdateBatteryEnergy();
	}
}

// =================================

export function ResetGlider(): void {
	const theGlider = G.theGlider;
	if (theGlider.mode !== burning) {
		theGlider.timeStamp = 0;
		theGlider.mode = fadingIn;
		theGlider.phase = 0;
		theGlider.isForward = true;
		if (theGlider.isRight) {
			theGlider.srcNum = 0;
		} else {
			theGlider.srcNum = 2;
		}
	}
	if (G.enteredLeft) {
		SetRect(theGlider.destRect, 0, 40, 48, 60);
	} else {
		SetRect(theGlider.destRect, 464, 40, 512, 60);
	}
	theGlider.oldRect = cloneRect(theGlider.destRect);
	theGlider.wholeRect = cloneRect(theGlider.destRect);
	theGlider.shadoDest = cloneRect(theGlider.destRect);
	theGlider.shadoDest.top = kFloorVert;
	theGlider.shadoDest.bottom = kFloorVert + 11;
	theGlider.oldShado = cloneRect(theGlider.shadoDest);
	theGlider.wholeShado = cloneRect(theGlider.shadoDest);
	theGlider.touchRect = cloneRect(theGlider.destRect);
	InsetRect(theGlider.touchRect, 10, 5);
	G.lifeNormal = false;
}

// =================================

// Port: async as the stub says; the guide's analysis took the field `delay` for a call to Delay.
export async function ResetAnimate(typeIs: Integer, index: Integer): Promise<void> {
	const theAnimate = G.theAnimates[index]!;
	if (typeIs !== -1) {
		theAnimate.delay = G.thisHouse.theRooms[G.roomAt]!.animateDelay;
		theAnimate.kind = typeIs;
		theAnimate.unSeen = true;
	}
	const destRect = theAnimate.destRect;
	switch (theAnimate.kind) {
		case 0: // dart
			destRect.left = 512;
			destRect.right = destRect.left + 64;
			destRect.top = Randomize(150);
			destRect.bottom = destRect.top + 22;
			theAnimate.phase = 0;
			theAnimate.horiOff = -8;
			theAnimate.vertOff = 1;
			break;
		case 1: // copter
			destRect.left = Randomize(256) + 256;
			destRect.right = destRect.left + 32;
			destRect.top = -32;
			destRect.bottom = 0;
			theAnimate.phase = Randomize(8);
			theAnimate.horiOff = -4;
			theAnimate.vertOff = 2;
			break;
		case 2: // balloon
			destRect.left = Randomize(400) + 50;
			destRect.right = destRect.left + 32;
			destRect.top = 342;
			destRect.bottom = 374;
			theAnimate.phase = Randomize(8);
			theAnimate.horiOff = 0;
			theAnimate.vertOff = -3;
			break;
		default:
	}
	theAnimate.wholeRect = cloneRect(destRect);
	theAnimate.oldRect = cloneRect(destRect);
	theAnimate.tickStamp = int32(Randomize(int16(LoWord(theAnimate.delay) + 120)) + TickCount() + 60);
} // with theAnimates[index]

// =================================

export function ExtractEventRects(): void {
	let index: Integer = 0;
	let tempInt: Integer = 0;
	let tempNum: Integer = 0;
	let tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	const theObject = (): (typeof G.thisHouse.theRooms)[number]['theObjects'][number] => G.thisHouse.theRooms[G.roomAt]!.theObjects[index]!;

	// -------------------------

	function SetUpGrease(): void {
		G.nCycleObs = G.nCycleObs + 1;
		const obj = theObject();
		if (obj.isOn) {
			// hasn't been spilled
			G.eventRect[index] = cloneRect(obj.boundRect);
			const c = G.cycleObjects[G.nCycleObs]!;
			c.kindIs = grease;
			c.tiedTo = index;
			c.wholeRect = cloneRect(G.eventRect[index]!);
			c.oldRect = cloneRect(c.wholeRect);
			c.reset = 0; // phase=not spilled
			c.accel = grease; // graphic # to display
			c.velocity = c.wholeRect.right; // current length of spill
			c.position = obj.amount; // full length of spill
		} else {
			// has been spilled
			const c = G.cycleObjects[G.nCycleObs]!;
			c.kindIs = grease;
			c.tiedTo = index;
			c.wholeRect = cloneRect(obj.boundRect);
			c.oldRect = cloneRect(c.wholeRect);

			G.eventRect[index]!.left = obj.boundRect.right;
			G.eventRect[index]!.bottom = obj.boundRect.bottom;
			G.eventRect[index]!.right = obj.amount;
			G.eventRect[index]!.top = obj.boundRect.bottom - 5;

			c.reset = 999; // phase=spilled
			c.accel = 59; // graphic # to display
			c.velocity = obj.amount; // current length of spill
			c.position = obj.amount; // length of spill
		}
	}

	// -------------------------

	function FrameOutlet(): void {
		G.nCycleObs = G.nCycleObs + 1;
		G.eventRect[index] = cloneRect(theObject().boundRect);
		const c = G.cycleObjects[G.nCycleObs]!;
		c.kindIs = outlet;
		c.tiedTo = index;
		G.eventKind[c.tiedTo]![1] = 0;
		c.accel = 25;
		c.wholeRect = cloneRect(theObject().boundRect);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = theObject().amount;
		c.position = TickCount();
	}

	// -------------------------

	function FrameCandle(): void {
		G.nCycleObs = G.nCycleObs + 1;
		{
			const obj = theObject();
			tempInt = div(obj.boundRect.right + obj.boundRect.left, 2);
			SetRect(G.eventRect[index]!, tempInt - 12, obj.amount, tempInt + 4, obj.boundRect.top);
		}
		const c = G.cycleObjects[G.nCycleObs]!;
		c.wholeRect = cloneRect(theObject().boundRect);
		c.wholeRect.bottom = c.wholeRect.top;
		c.wholeRect.top = c.wholeRect.bottom - 12;
		c.wholeRect.left = c.wholeRect.left + 5;
		c.wholeRect.right = c.wholeRect.left + 16;
		c.oldRect = cloneRect(c.wholeRect);
		c.kindIs = candle;
		c.position = Randomize(3) + 48;
	}

	// -------------------------

	function FrameDrip(): void {
		G.nCycleObs = G.nCycleObs + 1;
		G.eventRect[index] = cloneRect(theObject().boundRect);
		const c = G.cycleObjects[G.nCycleObs]!;
		c.kindIs = drip;
		c.tiedTo = index;
		c.holdRect = cloneRect(theObject().boundRect);
		c.wholeRect = cloneRect(c.holdRect);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(theObject().amount * 32);
		c.accel = 12;
		c.position = int16(c.holdRect.bottom * 32);
		c.velocity = 0;
		c.phase = 53;
	}

	// -------------------------

	function ReadyToast(): void {
		G.nCycleObs = G.nCycleObs + 1;
		{
			const obj = theObject();
			tempInt = obj.boundRect.left + 3;
			tempNum = obj.boundRect.bottom - 3;
			SetRect(G.eventRect[index]!, 0, 0, 32, 31);
			OffsetRect(G.eventRect[index]!, tempInt, tempNum);

			SetRect(tempRect, tempInt, obj.amount, tempInt + 32, obj.boundRect.top);
		}
		G.toastRgn = NewRgn();
		RectRgn(G.toastRgn, tempRect);
		HLock(G.toastRgn);
		G.hasToast = true;

		const c = G.cycleObjects[G.nCycleObs]!;
		c.phase = 60;
		c.kindIs = toastr;
		c.tiedTo = index;
		c.wholeRect = cloneRect(G.eventRect[index]!);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(tempNum * 32);
		c.accel = 8;
		c.position = c.reset;
		tempInt = int16((theObject().amount + 32) * 32);
		c.velocity = 0;
		do {
			c.velocity = int16(c.velocity + c.accel);
			tempInt = int16(tempInt + c.velocity);
		} while (!(tempInt > c.reset));
		c.velocity = int16(-c.velocity);
	}

	// -------------------------

	function FrameBall(): void {
		G.nCycleObs = G.nCycleObs + 1;
		G.eventRect[index] = cloneRect(theObject().boundRect);
		const c = G.cycleObjects[G.nCycleObs]!;
		c.kindIs = ball;
		c.tiedTo = index;
		c.wholeRect = cloneRect(theObject().boundRect);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(theObject().boundRect.bottom * 32);
		c.accel = 8;
		c.position = c.reset;
		tempInt = int16((theObject().amount + 32) * 32);
		c.velocity = 0;
		do {
			c.velocity = int16(c.velocity + c.accel);
			tempInt = int16(tempInt + c.velocity);
		} while (!(tempInt > c.reset));
		c.velocity = int16(-c.velocity);
	}

	// -------------------------

	function ReadyFish(): void {
		G.nCycleObs = G.nCycleObs + 1;
		{
			const obj = theObject();
			tempInt = obj.boundRect.left + 8;
			tempNum = obj.boundRect.top + 24;
			SetRect(G.eventRect[index]!, 0, 0, 16, 16); // fish rectangle
			OffsetRect(G.eventRect[index]!, tempInt, tempNum);
		}

		const c = G.cycleObjects[G.nCycleObs]!;
		c.phase = 69; // # of fish rect
		c.kindIs = fshBwl;
		c.tiedTo = index;
		c.wholeRect = cloneRect(G.eventRect[index]!);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(tempNum * 32);
		c.accel = 8;
		c.position = c.reset;
		tempInt = int16((theObject().amount + 32) * 32);
		c.velocity = 0;
		do {
			c.velocity = int16(c.velocity + c.accel);
			tempInt = int16(tempInt + c.velocity);
		} while (!(tempInt > c.reset));
		c.velocity = int16(-c.velocity);
	}

	// -------------------------

	function ReadyTea(): void {
		G.nCycleObs = G.nCycleObs + 1;

		{
			const obj = theObject();
			tempInt = obj.boundRect.left;
			tempNum = obj.boundRect.top;
			SetRect(G.eventRect[index]!, tempInt - 128, tempNum - 128, tempInt, tempNum);
			if (G.eventRect[index]!.top < kCeilingVert) {
				G.eventRect[index]!.top = kCeilingVert;
			}
			if (G.eventRect[index]!.left < 0) {
				G.eventRect[index]!.left = 0;
			}
		}

		const c = G.cycleObjects[G.nCycleObs]!;
		c.phase = 0;
		c.kindIs = teaKtl;
		c.tiedTo = index;
		SetRect(c.wholeRect, 0, 0, 0, 0);
		c.oldRect = cloneRect(c.wholeRect);
		c.position = theObject().amount;
		c.reset = int32(c.position + Randomize(120));
	}

	// -------------------------

	function FrameWindow(): void {
		let i: Integer;
		let joint: Integer;
		let topRect: Rect;
		let bottomRect: Rect;

		G.nObjects = G.nObjects - 1;

		{
			const obj = theObject();
			const boundRect = obj.boundRect;
			if (obj.isOn) {
				topRect = cloneRect(boundRect); // create top opening
				InsetRect(topRect, 8, 16);
				topRect.top = div(boundRect.bottom + boundRect.top, 2) - 2;
				OffsetRect(topRect, 0, 26 - div(boundRect.bottom - boundRect.top, 2));
				InsetRect(topRect, 10, 10);
				bottomRect = cloneRect(boundRect); // create bottom opening
				InsetRect(bottomRect, 8, 16);
				bottomRect.top = div(boundRect.bottom + boundRect.top, 2) + 10;

				G.windowOpen = true;
			} else {
				topRect = cloneRect(boundRect); // create top opening
				InsetRect(topRect, 8, 16);
				topRect.bottom = div(boundRect.bottom + boundRect.top, 2) + 2;
				InsetRect(topRect, 10, 10);
				bottomRect = cloneRect(boundRect); // create bottom opening
				InsetRect(bottomRect, 8, 16);
				bottomRect.top = div(boundRect.bottom + boundRect.top, 2) - 2;
				InsetRect(bottomRect, 10, 10);
			}
		}
		G.windowRgn = NewRgn();
		RectRgn(G.windowRgn, topRect);
		const tempRgn = NewRgn();
		RectRgn(tempRgn, bottomRect);
		UnionRgn(G.windowRgn, tempRgn, G.windowRgn);
		HLock(G.windowRgn);
		DisposeRgn(tempRgn);

		UnionRect(topRect, bottomRect, tempRect);
		tempInt = div(tempRect.bottom - tempRect.top, 7);
		const theLightning = G.theLightning;
		const theBolts = theLightning.theBolts;
		for (i = 1; i <= 3; i++) {
			theBolts[i]![0]![0] = tempRect.left + Randomize(tempRect.right - tempRect.left);
			theBolts[i]![0]![1] = tempRect.top;
			for (joint = 1; joint <= 7; joint++) {
				do {
					theBolts[i]![joint]![0] = int16(theBolts[i]![joint - 1]![0]! + Randomize(int16(tempInt * 4)) - tempInt * 2);
					theBolts[i]![joint]![1] = int16(tempInt * joint + tempRect.top);
				} while (!(theBolts[i]![joint]![0]! > tempRect.left && theBolts[i]![joint]![0]! < tempRect.right));
			}
		}
		theLightning.whichBolt = Randomize(3) + 1;
		theLightning.whatTime = int32(TickCount() + 120 + Randomize(120));
		theLightning.whatPhase = 0;

		G.hasWindow = true;
	}

	// -------------------------

	function FrameMirror(): void {
		G.nObjects = G.nObjects - 1;

		tempRect = cloneRect(theObject().boundRect);
		InsetRect(tempRect, 5, 5);
		G.mirrorRgn = NewRgn();
		RectRgn(G.mirrorRgn, tempRect);
		HLock(G.mirrorRgn);
		G.hasMirror = true;
	}

	// -------------------------

	if (G.hasMirror) {
		G.hasMirror = false;
		HUnlock(G.mirrorRgn);
		DisposeRgn(G.mirrorRgn!);
	}
	if (G.hasWindow) {
		G.hasWindow = false;
		HUnlock(G.windowRgn);
		DisposeRgn(G.windowRgn!);
	}
	if (G.hasToast) {
		G.hasToast = false;
		HUnlock(G.toastRgn);
		DisposeRgn(G.toastRgn!);
	}

	G.windowOpen = false;

	if (G.thisHouse.theRooms[G.roomAt]!.conditionCode === 2) {
		G.lightsOut = true;
	} else {
		G.lightsOut = false;
	}
	if (G.thisHouse.theRooms[G.roomAt]!.conditionCode === 1) {
		G.airOut = true;
	} else {
		G.airOut = false;
	}

	G.nCycleObs = 0;
	G.nObjects = G.thisHouse.theRooms[G.roomAt]!.numberOObjects;
	tempNum = G.nObjects;
	for (index = 1; index <= tempNum; index++) {
		const obj = theObject();
		const boundRect = obj.boundRect;
		const amount = obj.amount;

		switch (obj.objectIs) {
			case table:
			case shelf:
			case books:
			case cabnet:
			case extRct:
			case obsRct:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case flrVnt:
				tempInt = div(boundRect.right + boundRect.left, 2);
				SetRect(G.eventRect[index]!, tempInt - 8, amount, tempInt + 8, kFloorVert);
				break;
			case celVnt:
				tempInt = div(boundRect.right + boundRect.left, 2);
				SetRect(G.eventRect[index]!, tempInt - 8, kCeilingVert, tempInt + 8, amount);
				break;
			case celDct:
				if (obj.isOn) {
					tempInt = div(boundRect.right + boundRect.left, 2);
					SetRect(G.eventRect[index]!, tempInt - 8, kCeilingVert, tempInt + 8, amount);
				} else {
					G.eventRect[index] = cloneRect(boundRect);
					G.eventRect[index]!.bottom = G.eventRect[index]!.top + 8;
				}
				break;
			case candle:
				FrameCandle();
				break;
			case lftFan:
				SetRect(G.eventRect[index]!, amount, boundRect.top + 10, boundRect.left, boundRect.top + 30);
				break;
			case ritFan:
				SetRect(G.eventRect[index]!, boundRect.right, boundRect.top + 10, amount, boundRect.top + 30);
				break;
			case clock:
			case paper:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case grease:
				SetUpGrease();
				break;
			case bnsRct:
			case battry:
			case rbrBnd:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case litSwt:
			case thermo:
			case pwrSwt:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case shredr:
				G.eventRect[index] = cloneRect(boundRect);
				G.eventRect[index]!.top = G.eventRect[index]!.top - 4;
				G.eventRect[index]!.bottom = G.eventRect[index]!.bottom - 12;
				break;
			case outlet:
				FrameOutlet();
				break;
			case guitar:
				SetRect(G.eventRect[index]!, boundRect.left + 36, boundRect.top + 24, boundRect.left + 38, boundRect.bottom - 56);
				break;
			case ball:
				FrameBall();
				break;
			case drip:
				FrameDrip();
				break;
			case toastr:
				ReadyToast();
				break;
			case fshBwl:
				ReadyFish();
				break;
			case teaKtl:
				ReadyTea();
				break;
			case window:
				FrameWindow();
				break;
			case paintg:
				G.nObjects = G.nObjects - 1;
				break;
			case mirror:
				FrameMirror();
				break;
			case basket:
			case macTsh:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case upStar:
				SetRect(G.eventRect[index]!, boundRect.left + 32, boundRect.top, boundRect.right - 32, boundRect.top + 8);
				break;
			case dnStar:
				SetRect(G.eventRect[index]!, boundRect.left + 32, boundRect.bottom - 8, boundRect.right - 32, boundRect.bottom);
				break;
			default:
				G.eventRect[index] = cloneRect(G.nullRect);
		} // case

		const eventKind = G.eventKind[index]!;
		eventKind[1] = 0;
		switch (obj.objectIs) {
			case table:
			case shelf:
			case books:
			case cabnet:
			case obsRct:
			case drip:
			case toastr:
			case ball:
			case fshBwl:
			case basket:
			case macTsh:
				eventKind[0] = crashIt;
				break;
			case extRct:
				eventKind[0] = moveIt;
				eventKind[1] = amount;
				break;
			case flrVnt:
				eventKind[0] = liftIt;
				break;
			case celVnt:
				eventKind[0] = dropIt;
				break;
			case celDct:
				if (obj.isOn) {
					eventKind[0] = dropIt;
				} else {
					eventKind[0] = moveIt;
					eventKind[1] = obj.extra;
				}
				break;
			case candle:
				eventKind[0] = burnIt;
				eventKind[1] = boundRect.bottom - 48;
				break;
			case lftFan:
				if (obj.isOn) {
					eventKind[0] = turnItLeft;
				} else {
					eventKind[0] = ignoreIt;
				}
				break;
			case ritFan:
				if (obj.isOn) {
					eventKind[0] = turnItRight;
				} else {
					eventKind[0] = ignoreIt;
				}
				break;
			case clock:
				eventKind[0] = awardIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case paper:
				eventKind[0] = extraIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case grease:
				if (obj.isOn) {
					eventKind[0] = spillIt;
				} else {
					eventKind[0] = slideIt;
				}
				break;
			case bnsRct:
				eventKind[0] = trickIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case battry:
				eventKind[0] = energizeIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case rbrBnd:
				eventKind[0] = bandIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case litSwt:
				eventKind[0] = lightIt;
				break;
			case outlet:
				eventKind[0] = zapIt;
				break;
			case thermo:
				eventKind[0] = airOnIt;
				break;
			case shredr:
				if (obj.isOn) {
					eventKind[0] = shredIt;
				} else {
					eventKind[0] = ignoreIt;
				}
				break;
			case pwrSwt:
				eventKind[0] = toggleIt;
				eventKind[1] = amount; // object# linked to
				eventKind[2] = TickCount(); // delay from when hit
				break;
			case guitar:
				eventKind[0] = playIt;
				eventKind[1] = 0;
				break;
			case upStar:
				eventKind[0] = ascendIt;
				eventKind[1] = amount; // room # linked to
				break;
			case dnStar:
				eventKind[0] = descendIt;
				eventKind[1] = amount; // room # linked to
				break;
			default:
				eventKind[0] = ignoreIt;
		} // case
	}
}

// =================================

export async function ReadyRoom(): Promise<void> {
	let index: Integer;

	{
		const room = G.thisHouse.theRooms[G.roomAt]!;
		G.rightIsOpen = room.rightOpen;
		G.leftIsOpen = room.leftOpen;

		if (room.animateNumber > 0) {
			G.nAnimates = room.animateNumber;
			for (index = 1; index <= G.nAnimates; index++) {
				await ResetAnimate(room.animateKind, index);
			}
		} else {
			G.nAnimates = 0;
		}
	}
	G.bandBorne = false;

	G.floatPoints.out = false;

	ExtractEventRects();
	await LoadABackground(G.thisHouse.theRooms[G.roomAt]!.backPictID);
	DoTheMusic(kMusicSound);
	ArrangeTiles();
	await DrawAllObjects();
	DrawHeadline();
}

// =================================

async function WriteScores(): Promise<void> {
	// scoreHold = record score: array[0..19] of LongInt; level: array[0..19] of Integer;
	//   name, room: array[0..19] of string[24] end;
	let i: Integer;
	const tempScore = { score: [] as LongInt[], level: [] as Integer[], name: [] as string[], room: [] as string[] };

	{
		// **** Hold copy of scores****
		const thisHouse = G.thisHouse;
		for (i = 0; i <= 19; i++) {
			tempScore.score[i] = thisHouse.hiScores[i]!;
			tempScore.level[i] = thisHouse.hiLevel[i]!;
			tempScore.name[i] = thisHouse.hiName[i]!;
			tempScore.room[i] = thisHouse.hiRoom[i]!;
		}
	}

	G.theErr = SetVol(null, G.houseVolNum);
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}

	const houseNumber = ref(G.houseNumber);
	G.theErr = FSOpen(G.housesName, G.houseVolNum, houseNumber);
	G.houseNumber = houseNumber.v;
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}

	G.theErr = SetFPos(G.houseNumber, fsFromStart, 0);
	if (G.theErr !== noErr) {
		// **** Read in virgin house ****
		await GenericAlert(G.theErr);
		return;
	}
	const textLength = ref<LongInt>(sizeOf(houseRecLayout));
	// Port: FSRead into the record's bytes, which are kept to be written back, so that bytes the
	// record's fields do not cover (past each string's length) go back to the file as they came.
	const houseBytes = new Uint8Array(sizeOf(houseRecLayout));
	writeLayout(houseRecLayout, G.thisHouse, houseBytes, 0);
	G.theErr = FSRead(G.houseNumber, textLength, houseBytes);
	Object.assign(G.thisHouse, readLayout(houseRecLayout, houseBytes, 0)); // Port: in place, as Pascal reads into the record
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}

	{
		// **** modify hi scores ****
		const thisHouse = G.thisHouse;
		for (i = 0; i <= 19; i++) {
			thisHouse.hiScores[i] = tempScore.score[i]!;
			thisHouse.hiLevel[i] = tempScore.level[i]!;
			thisHouse.hiName[i] = tempScore.name[i]!;
			thisHouse.hiRoom[i] = tempScore.room[i]!;
		}
	} // with

	G.theErr = SetFPos(G.houseNumber, fsFromStart, 0);
	if (G.theErr !== noErr) {
		// **** write out new file ****
		await GenericAlert(G.theErr);
		return;
	}
	writeLayout(houseRecLayout, G.thisHouse, houseBytes, 0);
	G.theErr = FSWrite(G.houseNumber, textLength, houseBytes);
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}
	G.theErr = SetEOF(G.houseNumber, textLength.v);
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}

	G.theErr = FSClose(G.houseNumber); // **** close file ****
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}
}

// =================================

function TypewriterFilter(_theDialog: DialogRecord, theEvent: EventRecord, itemHit: Ref<Integer>): boolean {
	let result = false;
	if (theEvent.what === keyDown) {
		if (BitAnd(theEvent.message, charCodeMask) === kReturnKey) {
			itemHit.v = 1;
			result = true;
		} else {
			// play typewriter keystroke
			DoTheSound(kTapSound);
		}
	}
	return result;
}

// =================================

async function GetName(theRank: Integer, theScore: LongInt): Promise<void> {
	const okayItem = 1;
	const nameItem = 2;
	const rankItem = 3;
	const scoreItem = 4;

	let leaveDlg: boolean;
	const itemT = ref<Integer>(0);
	let itemHit: Integer;
	let tempStr: string;
	const itemH = ref<ItemHandle>(null);
	let tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	// ----------------------------------

	function RefreshIt(): void {
		SetPort(theDlgPtr);
		GetDItem(theDlgPtr, okayItem, itemT, itemH, tempRect);
		PenSize(3, 3);
		InsetRect(tempRect, -4, -4);
		FrameRoundRect(tempRect, 16, 16);
		PenSize(1, 1);
	}

	// ----------------------------------

	DoTheSound(kWhistleSound);

	FlushEvents(everyEvent, 0);
	const wasPort = GetPort();

	const theDlgPtr = GetNewDialog(128, null, inFront)!; // Bring in the dialog resource
	tempRect = cloneRect(theDlgPtr.portRect); // Get window size, we will now center it
	tempRect.top = div(screenBits.bounds.bottom - screenBits.bounds.top - (tempRect.bottom - tempRect.top), 2);
	tempRect.left = div(screenBits.bounds.right - screenBits.bounds.left - (tempRect.right - tempRect.left), 2);
	MoveWindow(theDlgPtr, tempRect.left, tempRect.top, true); // Now move the window to the proper position
	ShowWindow(theDlgPtr); // Open a dialog box
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	GetDItem(theDlgPtr, rankItem, itemT, itemH, tempRect);
	tempStr = NumToString(theRank + 1);
	SetIText(itemH.v as Handle, tempStr);

	GetDItem(theDlgPtr, scoreItem, itemT, itemH, tempRect);
	tempStr = NumToString(theScore);
	SetIText(itemH.v as Handle, tempStr);

	GetDItem(theDlgPtr, nameItem, itemT, itemH, tempRect);
	SetIText(itemH.v as Handle, G.playerName);
	SelIText(theDlgPtr, nameItem, 0, 24);

	RefreshIt();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(TypewriterFilter);
		GetDItem(theDlgPtr, itemHit, itemT, itemH, tempRect);

		if (itemHit === okayItem) {
			// play typewriter carriage return
			DoTheSound(kCRSound);
			leaveDlg = true;
		}
	} while (!leaveDlg);

	GetDItem(theDlgPtr, nameItem, itemT, itemH, tempRect);
	tempStr = GetIText(itemH.v as Handle);
	G.playerName = Copy(tempStr, 1, 24);

	DisposDialog(theDlgPtr);
	SetPort(wasPort);
}

// =================================

export async function SortHiScores(): Promise<void> {
	let i: Integer;
	let lastName: string;

	if (G.roomAt < 1) {
		G.roomsPassed = 0;
		lastName = 'Completed the House';
	} else {
		lastName = G.thisHouse.theRooms[G.roomAt]!.roomName;
	}

	const tempLong = int32(G.suppScore + G.roomScore);
	if (G.housesName !== G.firstFileName) {
		G.housesName = G.firstFileName;
		if (!(await GetHouse())) {
			return;
		}
	}

	if (G.refuseHigh) {
		return;
	}

	const scoreList = G.scoreList;
	const thisHouse = G.thisHouse;
	if (tempLong <= thisHouse.hiScores[19]!) {
		scoreList.rank = 20;
	} else {
		scoreList.changed = true;
		thisHouse.hiScores[19] = tempLong;
		thisHouse.hiLevel[19] = G.roomsPassed;
		thisHouse.hiName[19] = '';
		thisHouse.hiRoom[19] = pString(lastName, 24);
		scoreList.rank = 19;
		for (i = 18; i >= 0; i--) {
			if (tempLong > thisHouse.hiScores[i]!) {
				thisHouse.hiName[i + 1] = thisHouse.hiName[i]!;
				thisHouse.hiScores[i + 1] = thisHouse.hiScores[i]!;
				thisHouse.hiLevel[i + 1] = thisHouse.hiLevel[i]!;
				thisHouse.hiRoom[i + 1] = thisHouse.hiRoom[i]!;
				thisHouse.hiName[i] = '';
				thisHouse.hiScores[i] = tempLong;
				thisHouse.hiLevel[i] = G.roomsPassed;
				thisHouse.hiRoom[i] = pString(lastName, 24);
				scoreList.rank = i;
			}
		}
		await GetName(scoreList.rank, tempLong);
		// Port: G.thisHouse is the same record as `thisHouse` here; GetName does not replace it.
		thisHouse.hiName[scoreList.rank] = Copy(G.playerName, 1, 24);

		await WriteScores();
	} // else
} // proc

// =================================

export async function DoQuit(): Promise<boolean> {
	let dummyInt: Integer;
	let alertRect: Rect;
	let result = true;

	if (G.playing) {
		UseResFile(G.gliderResNum);
		InitCursor();
		const alertHandle = Get1Resource('ALRT', rQuitNoSaveAlertID);
		if (alertHandle !== null) {
			HNoPurge(alertHandle);
			alertRect = readLayout(PRect, alertHandle.data, 0);
			OffsetRect(alertRect, -alertRect.left, -alertRect.top);
			dummyInt = div(screenBits.bounds.right - alertRect.right, 2);
			OffsetRect(alertRect, dummyInt, 0);
			dummyInt = div(screenBits.bounds.bottom - alertRect.bottom, 3);
			OffsetRect(alertRect, 0, dummyInt);
			writeLayout(PRect, alertRect, alertHandle.data, 0);
			HPurge(alertHandle);
		}
		dummyInt = await Alert(rQuitNoSaveAlertID, null);
		if (dummyInt === 1) {
			result = false;
		}
	}

	return result;
}
