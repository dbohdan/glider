// Port of E-Drawing.p: draws the room being edited (its background tiles and its objects) and the
// tool palette's small icons.
//
// Most of it is a copy of Glider's drawing (G-PlayUtils.p, src/glider/PlayUtils.ts), drawn into the
// load port rather than the virgin one, and translated the same way.

import {
	type BitMap,
	black,
	bytesAt,
	cloneRect,
	CloseResFile,
	CloseRgn,
	Concat,
	CopyBits,
	CopyMask,
	DisposeRgn,
	DisposPtr,
	div,
	dkGray,
	DrawPicture,
	DrawString,
	FillRect,
	FrameRect,
	GetPicture,
	GetPort,
	gray,
	type Handle,
	HGetState,
	HLock,
	HSetState,
	HUnlock,
	InsetRect,
	type Integer,
	Line,
	LineTo,
	ltGray,
	MoveTo,
	NewPtr,
	NewRgn,
	NumToString,
	OffsetRect,
	OpenResFile,
	OpenRgn,
	PaintOval,
	PaintRect,
	PaintRgn,
	patCopy,
	patOr,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	type Rect,
	ReleaseResource,
	RGBForeColor,
	type RGBColor,
	SetPort,
	SetRect,
	SetWTitle,
	srcCopy,
	srcOr,
	transparent,
	UseResFile,
	white,
} from '../mac/Toolbox.ts';
import {
	ball,
	basket,
	battry,
	bnsRct,
	books,
	cabnet,
	candle,
	celDct,
	celVnt,
	clock,
	dnStar,
	drip,
	extRct,
	floorVert,
	flrVnt,
	fshBwl,
	G,
	grease,
	guitar,
	kErrGraphicLoad,
	kErrGraphicsNotFound,
	lftFan,
	litSwt,
	macTsh,
	mirror,
	obsRct,
	outlet,
	paintg,
	paper,
	pwrSwt,
	rbrBnd,
	ritFan,
	shelf,
	shredr,
	type SICNHand,
	table,
	teaKtl,
	thermo,
	toastr,
	upStar,
	window,
} from './Globals.ts';
import { Deselect, GenericAlert, Select } from './Utilities.ts';

// =================================

export function DrawRoomNum(): void {
	let tempStr: string;

	tempStr = NumToString(G.roomAt);
	tempStr = Concat(G.thisRoom.roomName, ' [', tempStr, ']');
	SetWTitle(G.mainWndo!, tempStr);
}

// =================================

export function PlotSICN(theRect: Rect, theSICN: SICNHand): void {
	let state: Integer;
	const srcBits: BitMap = { baseAddr: 0, rowBytes: 0, bounds: { top: 0, left: 0, bottom: 0, right: 0 } };

	state = HGetState(theSICN as unknown as Handle);
	HLock(theSICN as unknown as Handle);
	// Port: the SICN's rows are not in the address space, where CopyBits reads a bit map, so they
	// are copied to a pointer for the call and the pointer is disposed of after it.
	srcBits.baseAddr = NewPtr(32);
	const rows = bytesAt(srcBits.baseAddr, 32);
	for (let row = 0; row <= 15; row++) {
		rows[row * 2] = (theSICN[row]! >> 8) & 0xff;
		rows[row * 2 + 1] = theSICN[row]! & 0xff;
	}
	srcBits.rowBytes = 2;
	SetRect(srcBits.bounds, 0, 0, 16, 16);
	CopyBits(srcBits, G.toolWndo!.portBits, srcBits.bounds, theRect, srcCopy, null);
	DisposPtr(srcBits.baseAddr); // Port: see above
	HSetState(theSICN as unknown as Handle, state);
}

// =================================

function ArrangeTiles(): void {
	let i: Integer;
	let panel: Integer;

	for (i = 0; i <= 7; i++) {
		panel = G.thisRoom.tileOrder[i]!;
		if (G.inColor) {
			CopyBits(G.loadCPtr!.portPixMap, G.virginCPtr!.portPixMap, G.tileRects[panel]!, G.tileRects[i]!, srcCopy, null);
		} else {
			CopyBits(G.offLoadMap, G.offVirginMap, G.tileRects[panel]!, G.tileRects[i]!, srcCopy, null);
		}
	}
}

// =================================

export async function LoadABackground(whichID: Integer): Promise<void> {
	let refNumber: Integer;
	let tempByte: Integer;
	let thePict;

	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}

	refNumber = OpenResFile(G.resourceName);
	if (refNumber === -1) {
		CloseResFile(refNumber);
		UseResFile(G.editorResNum);
		await GenericAlert(kErrGraphicsNotFound);
		return;
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
				return;
		}
		if (thePict !== null) {
			tempByte = HGetState(thePict);
			HLock(thePict);
			DrawPicture(thePict, G.wholeArea);
			HSetState(thePict, tempByte);
		} else {
			await GenericAlert(kErrGraphicLoad);
			return;
		}
		await GenericAlert(kErrGraphicLoad);
	}
	ReleaseResource(thePict as Handle);

	CloseResFile(refNumber);
	UseResFile(G.editorResNum);

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}

	ArrangeTiles();
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, null);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	} else {
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, null);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	}
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

	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();

	{
		const theObject = G.thisRoom.theObjects[whichItem]!;
		kind = theObject.objectIs;
		theRect = cloneRect(theObject.boundRect);
	}
	if (G.inColor) {
		// ***** Draw table top
		FillNFrame(G.rgbBrown, theRect);
		MoveTo(theRect.left + 1, theRect.bottom - 2);
		LineTo(theRect.right - 1, theRect.bottom - 2);
		HiLiteARect(G.rgbLtBrown, theRect);
	} else {
		GrayNFrame(theRect);
		GrayLiteARect(theRect);
	}

	PenNormal(); // ***** Draw table shadow
	SetRect(tempRect, theRect.left, floorVert - 0, theRect.right, floorVert + 20);
	OffsetRect(tempRect, div(theRect.top - floorVert, 5), 0);
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
		LineTo(div(theRect.left + theRect.right, 2) - 2, floorVert - 7);
		RGBForeColor(G.rgbWhite);
		PenSize(1, 1);
		MoveTo(div(theRect.left + theRect.right, 2) + 1, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 1, floorVert - 7);
		RGBForeColor(G.rgbLtBrown);
		MoveTo(div(theRect.left + theRect.right, 2) + 0, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 0, floorVert - 7);
		RGBForeColor(G.rgbBlack);
	} else {
		PenSize(5, 1);
		MoveTo(div(theRect.left + theRect.right, 2) - 2, theRect.bottom);
		LineTo(div(theRect.left + theRect.right, 2) - 2, floorVert - 7);
		PenPat(white);
		PenSize(1, 1);
		MoveTo(div(theRect.left + theRect.right, 2) + 1, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 1, floorVert - 7);
		PenPat(gray);
		MoveTo(div(theRect.left + theRect.right, 2) + 0, theRect.bottom + div(theRect.right - theRect.left, 8));
		LineTo(div(theRect.left + theRect.right, 2) + 0, floorVert - 7);
	}
	PenNormal();

	tempRect = cloneRect(G.srcRect[kind]!); // ***** Draw table base
	OffsetRect(tempRect, -tempRect.left, -tempRect.top);
	OffsetRect(tempRect, div(theRect.left + theRect.right, 2) - 31, floorVert - 7);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	}
}

// =================================

function DrawShelf(whichItem: Integer): void {
	let kind: Integer;
	let theRect: Rect;
	let tempRect: Rect;

	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();
	{
		const theObject = G.thisRoom.theObjects[whichItem]!;
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
		GrayNFrame(theRect);
		GrayLiteARect(theRect);
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
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	}
	tempRect = cloneRect(G.srcRect[kind]!); // ***** Draw shelf bracket 2
	OffsetRect(tempRect, -tempRect.left, -tempRect.top); // 0 it out
	OffsetRect(tempRect, theRect.right - 25, theRect.bottom - 2);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[kind]!, G.srcRect[kind]!, tempRect);
	}
}

// =================================

function DrawMirror(whichItem: Integer): void {
	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();
	const theRect = cloneRect(G.thisRoom.theObjects[whichItem]!.boundRect);
	if (G.inColor) {
		FillNFrame(G.rgbBrown, theRect);
		HiLiteARect(G.rgbLtBrown, theRect);
	} else {
		GrayNFrame(theRect);
		GrayLiteARect(theRect);
	}
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
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();

	const theRect = cloneRect(G.thisRoom.theObjects[whichItem]!.boundRect);
	tempR = cloneRect(theRect);

	if (theRect.bottom > 280) {
		// *** If the cabnet is a counter
		tempR.bottom = tempR.bottom - 5; // *** Paint bulk of counter
		if (G.inColor) {
			FillNFrame(G.rgbBrown, tempR);
		} else {
			GrayNFrame(tempR);
		}
		tempR = cloneRect(theRect); // *** Paint foot-kick on bottom
		InsetRect(tempR, 2, 0);
		tempR.top = tempR.bottom - 5;
		if (G.inColor) {
			FillNFrame(G.rgbDkGray, tempR);
		} else {
			FillRect(tempR, dkGray);
			FrameRect(tempR);
		} // *** Paint counter-top
		SetRect(tempR, theRect.left - 2, theRect.top, theRect.right + 2, theRect.top + 7);
		if (G.inColor) {
			FillNFrame(G.rgbLtBrown, tempR);
		} else {
			FillRect(tempR, ltGray);
			FrameRect(tempR);
		}
		MoveTo(tempR.left + 2, tempR.bottom);
		LineTo(tempR.right - 3, tempR.bottom);

		shadoRgn = NewRgn(); // *** Paint counter shadow
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
		// *** It's a cabinet
		if (G.inColor) {
			// *** Paint bulk of cabinet
			FillNFrame(G.rgbBrown, theRect);
		} else {
			GrayNFrame(theRect);
		}

		shadoRgn = NewRgn(); // *** Paint the shadow
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

function DrawARect(whichItem: Integer, popAmount: boolean): void {
	let tempStr: string;

	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();
	const theObject = G.thisRoom.theObjects[whichItem]!;
	const number = theObject.amount;
	const theRect = cloneRect(theObject.boundRect);
	PenPat(gray);
	FrameRect(theRect);
	PenNormal();
	if (popAmount) {
		PenMode(srcOr);
		MoveTo(theRect.left + 2, theRect.bottom - 2);
		tempStr = NumToString(number);
		DrawString(tempStr);
		PenNormal();
	}
}

// =================================

function DrawWindow(whichItem: Integer): void {
	let tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();

	const theObject = G.thisRoom.theObjects[whichItem]!;
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
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}

	const theObject = G.thisRoom.theObjects[whichItem]!;
	const kind = theObject.objectIs;
	const theRect = cloneRect(theObject.boundRect);

	const refNumber = OpenResFile(G.resourceName);
	if (refNumber === -1) {
		CloseResFile(refNumber);
		UseResFile(G.editorResNum);
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
	UseResFile(G.editorResNum);
}

// =================================

export async function DrawAllObjects(): Promise<void> {
	let index: Integer;
	let theSrc: Rect;
	let destRect: Rect;

	const wasPort = GetPort();

	const nObjects = G.thisRoom.numberOObjects;

	if (nObjects === 0) {
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
		}
		return;
	}

	if (G.lightsOut) {
		if (G.inColor) {
			SetPort(G.loadCPtr!);
		} else {
			SetPort(G.offLoadPort!);
		}
		PenNormal();
		PaintRect(G.wholeArea);
		for (index = 1; index <= G.thisRoom.numberOObjects; index++) {
			const theObject = G.thisRoom.theObjects[index]!;
			if (theObject.objectIs === litSwt) {
				theSrc = cloneRect(G.srcRect[theObject.objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
			}
		}
		if (G.inColor) {
			CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
		} else {
			CopyBits(G.offLoadMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
		}
		return;
	}

	const holdSelect = G.oneActive;
	if (holdSelect !== 0) {
		await Deselect();
	}

	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	}

	for (index = 1; index <= G.thisRoom.numberOObjects; index++) {
		const theObject = G.thisRoom.theObjects[index]!;
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
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
				break;
			case extRct:
			case bnsRct:
				DrawARect(index, true);
				break;
			case obsRct:
				DrawARect(index, false);
				break;
			case flrVnt:
			case celVnt:
			case celDct:
			case candle:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
				break;
			case lftFan:
			case ritFan:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
				break;
			case grease:
				if (theObject.isOn) {
					theSrc = cloneRect(G.srcRect[objectIs]!); // grease is up
				} else {
					theSrc = cloneRect(G.srcRect[59]!); // grease has fallen
				}
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
				break;
			case clock:
			case paper:
			case battry:
			case rbrBnd:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
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
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
				break;
			case toastr:
			case ball:
			case fshBwl:
			case teaKtl:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
				}
				break;
			case drip:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
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
					CopyBits(G.objectCPtr!.portPixMap, G.loadCPtr!.portPixMap, theSrc, destRect, srcCopy, null);
				} else {
					CopyBits(G.offPlayerMap, G.offLoadMap, theSrc, destRect, srcCopy, null);
				}
				break;
			case basket:
			case macTsh:
				theSrc = cloneRect(G.srcRect[objectIs]!);
				destRect = cloneRect(theObject.boundRect);
				if (G.inColor) {
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, theSrc, theSrc, destRect);
				} else {
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, theSrc, theSrc, destRect);
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

	if (G.inColor) {
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	} else {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	}

	if (holdSelect !== 0) {
		G.oneActive = holdSelect;
		Select();
	}

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(wasPort);
	}
}

// =================================
