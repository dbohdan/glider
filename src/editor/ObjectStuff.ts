// Port of E-ObjectStuff.p: the tool palette, dragging objects and their handles, and the Object Info dialog.

import {
	type CIcon,
	black,
	blackColor,
	clonePoint,
	cloneRect,
	type ControlHandle,
	cyanColor,
	DisposCIcon,
	DisposDialog,
	DisposeWindow,
	div,
	ExitToShell,
	FrameRect,
	FrameRoundRect,
	ForeColor,
	GetCIcon,
	GetDItem,
	GetIcon,
	GetIText,
	GetMouse,
	GetNewCWindow,
	GetNewDialog,
	GetNewWindow,
	GetPort,
	GetResource,
	GlobalToLocal,
	gray,
	type GrafPtr,
	type Handle,
	HideDItem,
	inFront,
	InitCursor,
	InsetRect,
	int16,
	type Integer,
	type ItemHandle,
	Line,
	LineTo,
	LocalToGlobal,
	type LongInt,
	LoWord,
	ModalDialog,
	mouseDown,
	MoveTo,
	MoveWindow,
	NumToString,
	OffsetRect,
	PaintRect,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	PlotCIcon,
	PlotIcon,
	type Point,
	PtInRect,
	patXor,
	type Rect,
	redColor,
	ref,
	RGBForeColor,
	screenBits,
	SelectWindow,
	SelIText,
	SetCTitle,
	SetCtlValue,
	SetIText,
	SetPort,
	SetPt,
	SetRect,
	SetWRefCon,
	ShowWindow,
	StringToNum,
	SysBeep,
	WaitMouseUp,
	Yield,
} from '../mac/Toolbox.ts';
import {
	bnsRct,
	ball,
	battry,
	cabnet,
	candle,
	celDct,
	celVnt,
	ceilingVert,
	clock,
	dnStar,
	drip,
	editToObject,
	extRct,
	floorVert,
	flrVnt,
	fshBwl,
	G,
	grease,
	kErrLoadingRes,
	kErrTooManyObjects,
	lftFan,
	macTsh,
	mirror,
	type objectData,
	obsRct,
	outlet,
	paper,
	pwrSwt,
	rbrBnd,
	ritFan,
	shelf,
	shredr,
	type SICNHand,
	stairVert,
	table,
	teaKtl,
	toastr,
	upStar,
	window,
} from './Globals.ts';
import { Deselect, ErrorCheckObject, GenericAlert, Select, SpinBall, UpdateMenuItems } from './Utilities.ts';
import { DrawAllObjects, PlotSICN } from './Drawing.ts';
import { SortObjects } from './RoomStuff.ts';

const objectInfoID = 131;

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });

/**
 * Port: `SICNHand(GetResource('SICN', id))` casts the resource's handle; here the resource's bytes
 * are read as the first icon's 16 big-endian rows.
 */
function SICNOf(h: Handle | null): SICNHand | null {
	if (h === null) {
		return null;
	}
	const rows: SICNHand = [];
	for (let i = 0; i <= 15; i++) {
		rows[i] = int16((h.data[2 * i]! << 8) | h.data[2 * i + 1]!);
	}
	return rows;
}

// =================================

export async function AutoHideShow(hiding: boolean): Promise<void> {
	if (hiding) {
		if (G.toolWndo !== null) {
			SetPort(G.toolWndo);
			SetPt(G.holdCorner, G.toolWndo.portRect.left, G.toolWndo.portRect.top);
			LocalToGlobal(G.holdCorner);
			DisposeWindow(G.toolWndo);
			G.toolWndo = null;
			SetPort(G.mainWndo!);
		} else {
			SetPt(G.holdCorner, -1000, 0);
		}
	} else {
		// not hiding - showing
		if (G.holdCorner.h !== -1000) {
			if (G.inColor) {
				G.toolWndo = GetNewCWindow(128, null, inFront);
			} else {
				G.toolWndo = GetNewWindow(128, null, inFront);
			}
			if (G.toolWndo === null) {
				await GenericAlert(kErrLoadingRes);
				ExitToShell();
			}
			SetPort(G.toolWndo);
			MoveWindow(G.toolWndo, G.holdCorner.h, G.holdCorner.v, false);
			ShowWindow(G.toolWndo);
			SetWRefCon(G.toolWndo, 1);
			await UpdateTools();
		}
	}
}

// =================================

export function SetUpFields(): void {
	let tempBool: boolean;
	let tempAmount: Integer;
	let tempExtra: Integer;

	const what: Integer = G.thisRoom.theObjects[G.oneActive]!.objectIs;
	switch (what) {
		case flrVnt:
		case ball:
		case toastr:
		case fshBwl:
			tempAmount = ceilingVert + 20;
			break;
		case extRct:
		case upStar:
		case dnStar:
			tempAmount = G.roomAt;
			break;
		case celVnt:
		case celDct:
		case drip:
			tempAmount = floorVert - 20;
			break;
		case candle:
			tempAmount = G.thisRoom.theObjects[G.oneActive]!.boundRect.top - 100;
			if (tempAmount < ceilingVert + 50) {
				tempAmount = ceilingVert + 50;
			}
			break;
		case lftFan:
			tempAmount = G.thisRoom.theObjects[G.oneActive]!.boundRect.left - 100;
			if (tempAmount < 0) {
				tempAmount = 0;
			}
			break;
		case ritFan:
		case grease:
			tempAmount = G.thisRoom.theObjects[G.oneActive]!.boundRect.right + 100;
			if (tempAmount > 512) {
				tempAmount = 512;
			}
			break;
		case clock:
		case paper:
		case bnsRct:
			tempAmount = 1000;
			break;
		case rbrBnd:
			tempAmount = 10;
			break;
		case battry:
			tempAmount = 40;
			break;
		case outlet:
		case teaKtl:
			tempAmount = 120;
			break;
		case pwrSwt:
			tempAmount = 0;
			break;
		default:
			tempAmount = 0;
	}

	switch (what) {
		case celDct:
		case lftFan:
		case ritFan:
		case grease:
		case shredr:
			tempBool = true;
			break;
		default:
			tempBool = false;
	}

	switch (what) {
		case celDct:
			tempExtra = G.roomAt;
			break;
		case drip:
		case toastr:
		case fshBwl:
			tempExtra = 120;
			break;
		default:
			tempExtra = 0;
	}

	const theObject = G.thisRoom.theObjects[G.oneActive]!;
	theObject.objectIs = what;
	theObject.amount = tempAmount;
	theObject.extra = tempExtra;
	theObject.isOn = tempBool;
}

// =================================

export async function DragObject(which: Integer): Promise<void> {
	let floorLockOn: boolean;
	let ceilingLockOn: boolean;
	let stairLockOn: boolean;
	let wasPt: Point;
	// Port: refPt is declared but never used; oldRect is assigned but never read, as in the original.
	// oxlint-disable-next-line no-unused-vars
	let oldRect: Rect;
	const errorIs = ref<Integer>(0);

	SetPort(G.mainWndo!);

	const what: Integer = G.thisRoom.theObjects[which]!.objectIs;
	const destRect = cloneRect(G.thisRoom.theObjects[which]!.boundRect);
	oldRect = cloneRect(destRect);
	// oxlint-disable-next-line no-unused-vars
	const theSrc = cloneRect(G.srcRect[what]!); // assigned but not used, as in the original

	floorLockOn = false;
	ceilingLockOn = false;
	stairLockOn = false;
	if (what === flrVnt) {
		floorLockOn = true;
	}
	if (what === celDct || what === celVnt) {
		ceilingLockOn = true;
	}
	if (what === upStar || what === dnStar) {
		stairLockOn = true;
	}

	const isPt = clonePoint(G.theEvent.where);
	wasPt = clonePoint(isPt);

	PenPat(gray);
	PenMode(patXor);

	FrameRect(destRect);
	while (WaitMouseUp()) {
		GetMouse(isPt);
		LocalToGlobal(isPt);
		if (isPt.h !== wasPt.h || isPt.v !== wasPt.v) {
			FrameRect(destRect);
			if (floorLockOn || ceilingLockOn || stairLockOn) {
				OffsetRect(destRect, isPt.h - wasPt.h, 0);
			} else {
				OffsetRect(destRect, isPt.h - wasPt.h, isPt.v - wasPt.v);
			}
			FrameRect(destRect);
			oldRect = cloneRect(destRect);
		}
		wasPt = clonePoint(isPt);
		await Yield();
	}
	FrameRect(destRect);
	PenNormal();
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}

	G.changed = true;
	G.thisRoom.theObjects[which]!.boundRect = cloneRect(destRect);

	if (ErrorCheckObject(G.thisRoom.theObjects[which]!, errorIs)) {
		SysBeep(1); // *** temp beep for error
	}
}

// =================================

export async function DragHandle(): Promise<void> {
	const horiLock = 0;
	const vertLock = 1;
	// Port: noLock = 2 is declared but never used.

	let min: Integer;
	let max: Integer;
	// Port: restrict is not set for the objects that stretch a frame (square), and the last case
	// reads it for some of them; the original reads whatever the stack held. Here it starts at 0.
	let restrict: Integer = 0;
	let savePos: Integer;
	let savePos2: Integer;
	// Port: min2, max2 and stretchFrame are set only for square objects, which alone read them.
	let min2: Integer = 0;
	let max2: Integer = 0;
	let stretchFrame: Rect = rect();
	let square: boolean;

	const saveActive: Integer = G.oneActive;
	await Deselect();
	G.changed = true;

	SetPort(G.mainWndo!);

	{
		const theObject = G.thisRoom.theObjects[saveActive]!;
		const boundRect = theObject.boundRect;
		switch (theObject.objectIs) {
			// Pop the handle out
			case table:
			case shelf:
				min = boundRect.left + 64;
				max = 512;
				restrict = horiLock;
				square = false;
				break;
			case flrVnt:
			case candle:
			case toastr:
			case ball:
			case fshBwl:
				min = ceilingVert + 20;
				max = boundRect.top - 20;
				restrict = vertLock;
				square = false;
				break;
			case celVnt:
			case celDct:
			case drip:
				min = boundRect.bottom + 20;
				max = floorVert;
				restrict = vertLock;
				square = false;
				break;
			case lftFan:
				min = 0;
				max = boundRect.left - 20;
				restrict = horiLock;
				square = false;
				break;
			case ritFan:
			case grease:
				min = boundRect.right + 20;
				max = 512;
				restrict = horiLock;
				square = false;
				break;
			default:
				min = boundRect.left + 32;
				max = 512;
				min2 = boundRect.top + 32;
				max2 = 342;
				stretchFrame = cloneRect(boundRect);
				square = true;
		} // End of case
	} // End of with

	PenPat(gray);
	PenMode(patXor);
	if (square) {
		FrameRect(stretchFrame);
	} else {
		MoveTo(G.startPt.h, G.startPt.v);
		LineTo(G.endPt.h, G.endPt.v);
	}
	PaintRect(G.handleRect);

	const wasPt: Point = { v: 0, h: 0 };
	GetMouse(wasPt);
	const isPt = clonePoint(wasPt);
	while (WaitMouseUp()) {
		GetMouse(isPt);
		if (square) {
			if (isPt.h !== wasPt.h || isPt.v !== wasPt.v) {
				FrameRect(stretchFrame);
				PaintRect(G.handleRect);

				savePos = G.endPt.h;
				savePos2 = G.endPt.v;
				G.endPt = clonePoint(isPt);
				if (G.endPt.h > max) {
					G.endPt.h = max;
				}
				if (G.endPt.h < min) {
					G.endPt.h = min;
				}
				if (G.endPt.v > max2) {
					G.endPt.v = max2;
				}
				if (G.endPt.v < min2) {
					G.endPt.v = min2;
				}
				OffsetRect(G.handleRect, G.endPt.h - savePos, G.endPt.v - savePos2);
				stretchFrame.right = G.endPt.h;
				stretchFrame.bottom = G.endPt.v;
				FrameRect(stretchFrame);
				PaintRect(G.handleRect);
			}
		} else {
			if (restrict === horiLock && isPt.h !== wasPt.h) {
				MoveTo(G.startPt.h, G.startPt.v);
				LineTo(G.endPt.h, G.endPt.v);
				PaintRect(G.handleRect);

				savePos = G.endPt.h;
				G.endPt.h = isPt.h;
				if (G.endPt.h > max) {
					G.endPt.h = max;
				}
				if (G.endPt.h < min) {
					G.endPt.h = min;
				}
				OffsetRect(G.handleRect, G.endPt.h - savePos, 0);

				MoveTo(G.startPt.h, G.startPt.v);
				LineTo(G.endPt.h, G.endPt.v);
				PaintRect(G.handleRect);
			}
			if (restrict === vertLock && isPt.v !== wasPt.v) {
				MoveTo(G.startPt.h, G.startPt.v);
				LineTo(G.endPt.h, G.endPt.v);
				PaintRect(G.handleRect);

				savePos = G.endPt.v;
				G.endPt.v = isPt.v;
				if (G.endPt.v > max) {
					G.endPt.v = max;
				}
				if (G.endPt.v < min) {
					G.endPt.v = min;
				}
				OffsetRect(G.handleRect, 0, G.endPt.v - savePos);

				MoveTo(G.startPt.h, G.startPt.v);
				LineTo(G.endPt.h, G.endPt.v);
				PaintRect(G.handleRect);
			}
		}
		wasPt.h = isPt.h;
		wasPt.v = isPt.v;
		await Yield();
	}

	if (square) {
		FrameRect(stretchFrame);
	} else {
		MoveTo(G.startPt.h, G.startPt.v);
		LineTo(G.endPt.h, G.endPt.v);
	}
	PaintRect(G.handleRect);

	PenNormal();
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}

	{
		const theObject = G.thisRoom.theObjects[saveActive]!;
		switch (theObject.objectIs) {
			case table:
			case shelf:
				theObject.boundRect.right = wasPt.h;
				break;
			case cabnet:
			case extRct:
			case obsRct:
			case bnsRct:
			case window:
			case mirror:
				theObject.boundRect = cloneRect(stretchFrame);
				break;
			default:
				if (restrict === horiLock) {
					theObject.amount = G.endPt.h;
				} else {
					theObject.amount = G.endPt.v;
				}
		}
	}

	const kind: Integer = G.thisRoom.theObjects[saveActive]!.objectIs;
	G.oneActive = saveActive;
	G.changed = true;

	switch (kind) {
		// some objects require a complete redrawing
		case table:
		case shelf:
		case cabnet:
		case extRct:
		case obsRct:
		case bnsRct:
		case window:
		case mirror:
			await DrawAllObjects();
			break;
		default:
			// others are unaffected by a handle-drag
			Select();
	}
}

// =================================

export async function DragOffPalette(whatKind: Integer): Promise<void> {
	let finalRect: Rect = rect();

	const wasPort: GrafPtr = GetPort();
	SetPort(G.mainWndo!);

	{
		const thisRoom = G.thisRoom;
		if (thisRoom.numberOObjects < 16) {
			thisRoom.numberOObjects = thisRoom.numberOObjects + 1;
		} else {
			SetPort(wasPort);
			await GenericAlert(kErrTooManyObjects);
			return;
		}
		if (whatKind === toastr || whatKind === window || whatKind === mirror) {
			for (let last = thisRoom.numberOObjects - 1, i = 1; i <= last; i++) {
				if (thisRoom.theObjects[i]!.objectIs === whatKind) {
					thisRoom.numberOObjects = thisRoom.numberOObjects - 1;
					SetPort(wasPort);
					await GenericAlert(16);
					return;
				}
			}
		}

		if (G.autoHide) {
			await AutoHideShow(true);
		}

		G.oneActive = G.thisRoom.numberOObjects;
		G.thisRoom.theObjects[G.oneActive]!.objectIs = whatKind;
	} // with thisRoom do

	const thePt = clonePoint(G.theEvent.where);
	GlobalToLocal(thePt);
	switch (whatKind) {
		case table:
			SetRect(finalRect, thePt.h - 50, thePt.v - 5, thePt.h + 50, thePt.v + 4);
			break;
		case shelf:
			SetRect(finalRect, thePt.h - 50, thePt.v - 4, thePt.h + 50, thePt.v + 3);
			break;
		case cabnet:
			SetRect(finalRect, thePt.h - 50, thePt.v - 30, thePt.h + 50, thePt.v + 30);
			break;
		case extRct:
		case obsRct:
		case bnsRct:
			SetRect(finalRect, thePt.h - 32, thePt.v - 16, thePt.h + 32, thePt.v + 16);
			break;
		case mirror:
			SetRect(finalRect, thePt.h - 32, thePt.v - 64, thePt.h + 32, thePt.v + 64);
			break;
		case flrVnt:
			finalRect = cloneRect(G.srcRect[whatKind]!);
			OffsetRect(finalRect, -finalRect.left, -finalRect.top);
			OffsetRect(finalRect, thePt.h, floorVert);
			OffsetRect(finalRect, -div(finalRect.right - finalRect.left, 2), 0);
			break;
		case celVnt:
		case celDct:
			finalRect = cloneRect(G.srcRect[whatKind]!);
			OffsetRect(finalRect, -finalRect.left, -finalRect.top);
			OffsetRect(finalRect, thePt.h, ceilingVert);
			OffsetRect(finalRect, -div(finalRect.right - finalRect.left, 2), 0);
			break;
		case window:
			SetRect(finalRect, thePt.h - 50, thePt.v - 60, thePt.h + 50, thePt.v + 60);
			break;
		case upStar:
		case dnStar:
			finalRect = cloneRect(G.srcRect[whatKind]!);
			OffsetRect(finalRect, -finalRect.left, -finalRect.top);
			OffsetRect(finalRect, thePt.h, stairVert);
			OffsetRect(finalRect, -div(finalRect.right - finalRect.left, 2), 0);
			break;
		default:
			finalRect = cloneRect(G.srcRect[whatKind]!);
			OffsetRect(finalRect, -finalRect.left, -finalRect.top); // Set to 0,0
			OffsetRect(finalRect, thePt.h, thePt.v); // Offset to cursor
			OffsetRect(finalRect, div(finalRect.left - finalRect.right, 2), div(finalRect.top - finalRect.bottom, 2));
	}
	G.thisRoom.theObjects[G.oneActive]!.boundRect = cloneRect(finalRect);

	SetUpFields();
	await DragObject(G.oneActive);
	SortObjects();
	await DrawAllObjects();

	if (G.autoHide) {
		await AutoHideShow(false);
	}

	UpdateMenuItems(editToObject);
	SetPort(wasPort);
}

// =================================

export function CloseTools(): void {
	if (G.toolWndo !== null) {
		DisposeWindow(G.toolWndo);
		G.toolWndo = null;
	}
}

// =================================

export async function UpdateTools(): Promise<void> {
	let tempInt: Integer;
	let cicnHand: CIcon | null;
	let icnHand: Handle | null;

	if (G.toolWndo === null) {
		return;
	}

	const wasPort: GrafPtr = GetPort();
	SetPort(G.toolWndo);

	PenNormal();
	ForeColor(cyanColor);
	MoveTo(5, 50);
	LineTo(70, 50);
	ForeColor(blackColor);

	if (G.inColor) {
		for (let index = 0; index <= 5; index++) {
			SpinBall();
			cicnHand = GetCIcon(133 + index);
			if (cicnHand !== null) {
				PlotCIcon(G.selectRect[index]!, cicnHand);
			} else {
				await GenericAlert(kErrLoadingRes);
			}
			DisposCIcon(cicnHand);
		}
	} else {
		for (let index = 0; index <= 5; index++) {
			SpinBall();
			const theSICN = SICNOf(GetResource('SICN', 256 + index));
			if (theSICN !== null) {
				PlotSICN(G.selectRect[index]!, theSICN);
			}
		}
	}
	const tempRect = cloneRect(G.selectRect[G.setOTools]!);
	InsetRect(tempRect, -3, -3);
	PenSize(2, 2);
	PenPat(black);
	ForeColor(redColor);
	FrameRect(tempRect);
	ForeColor(blackColor);
	PenNormal();

	for (let index = 0; index <= 5; index++) {
		SpinBall();
		if (G.setOTools === 0) {
			tempInt = index + 1;
		} else {
			tempInt = index;
		}
		if (G.inColor) {
			cicnHand = GetCIcon(G.toolIcnID[tempInt + 8 * G.setOTools]!);
			if (cicnHand !== null) {
				PlotCIcon(G.iconRect[index]!, cicnHand);
			} else {
				await GenericAlert(kErrLoadingRes);
			}
			DisposCIcon(cicnHand);
		} else {
			icnHand = GetIcon(G.toolIcnID[tempInt + 8 * G.setOTools]!);
			if (icnHand !== null) {
				PlotIcon(G.iconRect[index]!, icnHand);
			} else {
				await GenericAlert(kErrLoadingRes);
			}
		}
	}
	SetPort(wasPort);
	InitCursor();
}

// =================================

export async function OpenTools(): Promise<void> {
	if (G.toolWndo === null) {
		if (G.inColor) {
			G.toolWndo = GetNewCWindow(128, null, inFront);
		} else {
			G.toolWndo = GetNewWindow(128, null, inFront);
		}
		if (G.toolWndo === null) {
			await GenericAlert(kErrLoadingRes);
			ExitToShell();
		}
		SetPort(G.toolWndo);
		MoveWindow(G.toolWndo, screenBits.bounds.right - 99, 40, false);
		ShowWindow(G.toolWndo);
		SetWRefCon(G.toolWndo, 1);
		await UpdateTools();
	} else {
		SelectWindow(G.toolWndo);
	}
}

// =================================

export async function DoTools(): Promise<void> {
	let what: Integer;

	if (G.toolWndo === null) {
		return;
	}

	if (G.theEvent.what === mouseDown) {
		const thePt = clonePoint(G.theEvent.where);
		GlobalToLocal(thePt);
		for (let index = 0; index <= 5; index++) {
			if (PtInRect(thePt, G.iconRect[index]!)) {
				await Deselect();
				G.changed = true;
				what = index + G.setOTools * 8;
				if (G.setOTools === 0) {
					what = what + 1;
				}
				if (G.toolIcnID[what] !== 400) {
					await DragOffPalette(what);
				} else {
					what = 0;
				}
			}
		}

		for (let index = 0; index <= 5; index++) {
			if (PtInRect(thePt, G.selectRect[index]!)) {
				if (G.setOTools !== index) {
					const tempRect = cloneRect(G.selectRect[G.setOTools]!);
					InsetRect(tempRect, -3, -3);
					PenSize(2, 2);
					if (G.inColor) {
						RGBForeColor(G.rgbWhite);
						FrameRect(tempRect);
						RGBForeColor(G.rgbBlack);
					} else {
						FrameRect(tempRect);
						PenMode(patXor);
						FrameRect(tempRect);
						PenNormal();
					}

					G.setOTools = index;
					await UpdateTools();
				}
			}
		}
	}
}

// =================================

export async function BumpAPixel(hori: Integer, vert: Integer): Promise<void> {
	const holdObject: Integer = G.oneActive;
	await Deselect();
	G.oneActive = holdObject;

	const destRect = cloneRect(G.thisRoom.theObjects[G.oneActive]!.boundRect);
	const what: Integer = G.thisRoom.theObjects[G.oneActive]!.objectIs;

	if ((what === flrVnt || what === celVnt || what === celDct) && vert !== 0) {
		vert = 0;
	}

	OffsetRect(destRect, hori, vert);

	// error check that bounds have been respected HERE
	// oxlint-disable-next-line no-unused-vars
	const theSrc = cloneRect(G.srcRect[what]!); // assigned but not used, as in the original

	await DrawAllObjects();

	const theObject = G.thisRoom.theObjects[G.oneActive]!;
	theObject.boundRect = cloneRect(destRect);
	switch (theObject.objectIs) {
		case candle:
		case toastr:
		case ball:
		case fshBwl:
			theObject.amount = theObject.amount + vert;
			if (theObject.amount < ceilingVert + 20) {
				theObject.amount = ceilingVert + 20;
			}
			break;
		case lftFan:
			theObject.amount = theObject.amount + hori;
			if (theObject.amount < 0) {
				theObject.amount = 0;
			}
			break;
		case ritFan:
		case grease:
			theObject.amount = theObject.amount + hori;
			if (theObject.amount > 512) {
				theObject.amount = 512;
			}
			break;
		default:
	} // case
	Select();
}

// =================================

export async function DoObjectInfo(): Promise<void> {
	// Port: inactive = 255 and active = 0 are declared but never used.

	const okayBut = 1;
	const cancelBut = 2;

	const leftEdit = 3;
	const topEdit = 4;
	const widthEdit = 5;
	const heightEdit = 6;
	const delayEdit = 7;

	const onRadio = 8;
	const offRadio = 9;

	// Port: leftStat = 12 is declared but never used.
	const topStat = 13;
	const widthStat = 14;
	const heightStat = 15;
	const delayStat = 16;

	const numStat = 18;

	let leaveDlg: boolean;
	const tempRect: Rect = rect();
	// Port: wasRect and i are declared but never used.
	const cntlType = ref<Integer>(0);
	let itemHit: Integer;
	let tempInt: Integer;
	let tempLong: LongInt;
	let whichSelect: Integer;
	const dlgItem = ref<ItemHandle>(null);
	let strTemp: string;

	// -------------------------

	function ReadNumber(item: Integer): Integer {
		GetDItem(theDlgPtr, item, cntlType, dlgItem, tempRect);
		strTemp = GetIText(dlgItem.v as Handle);
		tempLong = StringToNum(strTemp);
		return LoWord(tempLong);
	}

	// -------------------------

	function WriteNumber(item: Integer, value: Integer, select: boolean): void {
		GetDItem(theDlgPtr, item, cntlType, dlgItem, tempRect);
		strTemp = NumToString(value);
		SetIText(dlgItem.v as Handle, strTemp);
		if (select) {
			SelIText(theDlgPtr, item, 0, 4);
		}
	}

	// -------------------------

	function Redraw(): void {
		SetPort(theDlgPtr); // Point to our dialog window
		GetDItem(theDlgPtr, okayBut, cntlType, dlgItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenNormal();
		const width: Integer = theDlgPtr.portRect.right - theDlgPtr.portRect.left;
		MoveTo(4, 38);
		Line(width - 8, 0);
		MoveTo(4, 40);
		Line(width - 8, 0);
	}

	// -------------------------

	const wasPort: GrafPtr = GetPort();
	const theDlgPtr = GetNewDialog(objectInfoID, null, inFront)!;
	const rightOff: Integer = G.rightOffset - theDlgPtr.portBits.bounds.left;
	const downOff: Integer = G.downOffset - theDlgPtr.portBits.bounds.top;
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	const tempObject: objectData = structuredClone(G.thisRoom.theObjects[G.oneActive]!);
	{
		const boundRect = tempObject.boundRect;
		// pop object number as static field
		WriteNumber(numStat, G.oneActive, false);
		// pop left coordinate into edit text field
		WriteNumber(leftEdit, boundRect.left, false);
		// pop top coordinate into edit text field
		WriteNumber(topEdit, boundRect.top, false);

		whichSelect = leftEdit;

		switch (tempObject.objectIs) {
			case table:
			case shelf:
				WriteNumber(widthEdit, boundRect.right - boundRect.left, false);
				HideDItem(theDlgPtr, heightEdit);
				HideDItem(theDlgPtr, heightStat);
				whichSelect = widthEdit;
				break;
			case cabnet:
			case extRct:
			case obsRct:
			case bnsRct:
			case window:
			case mirror:
				WriteNumber(widthEdit, boundRect.right - boundRect.left, false);
				WriteNumber(heightEdit, boundRect.bottom - boundRect.top, false);
				whichSelect = widthEdit;
				break;
			case flrVnt:
			case celVnt:
			case upStar:
			case dnStar:
				HideDItem(theDlgPtr, topEdit);
				HideDItem(theDlgPtr, topStat);
				HideDItem(theDlgPtr, widthEdit);
				HideDItem(theDlgPtr, widthStat);
				HideDItem(theDlgPtr, heightEdit);
				HideDItem(theDlgPtr, heightStat);
				break;
			case celDct:
				HideDItem(theDlgPtr, topEdit);
				HideDItem(theDlgPtr, topStat);
				WriteNumber(widthEdit, tempObject.extra, false);
				GetDItem(theDlgPtr, widthStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Rm # link');
				HideDItem(theDlgPtr, heightEdit);
				HideDItem(theDlgPtr, heightStat);
				whichSelect = widthEdit;
				break;
			case drip:
			case toastr:
			case fshBwl:
				WriteNumber(widthEdit, tempObject.extra, false);
				GetDItem(theDlgPtr, widthStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Delay (1/60th secs)');
				HideDItem(theDlgPtr, heightEdit);
				HideDItem(theDlgPtr, heightStat);
				whichSelect = widthEdit;
				break;
			default:
				HideDItem(theDlgPtr, widthEdit);
				HideDItem(theDlgPtr, widthStat);
				HideDItem(theDlgPtr, heightEdit);
				HideDItem(theDlgPtr, heightStat);
		} // case objectIs

		switch (tempObject.objectIs) {
			case extRct:
			case upStar:
			case dnStar:
				WriteNumber(delayEdit, tempObject.amount, false);
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Room # connected to:');
				whichSelect = delayEdit;
				break;
			case flrVnt: // flrVnt..ritFan
			case celVnt:
			case celDct:
			case candle:
			case lftFan:
			case ritFan:
				switch (tempObject.objectIs) {
					case flrVnt:
					case candle:
						WriteNumber(delayEdit, boundRect.top - tempObject.amount, false);
						break;
					case celVnt:
					case celDct:
						WriteNumber(delayEdit, tempObject.amount - boundRect.bottom, false);
						break;
					case lftFan:
						WriteNumber(delayEdit, boundRect.left - tempObject.amount, false);
						break;
					case ritFan:
						WriteNumber(delayEdit, tempObject.amount - boundRect.right, false);
						break;
				}
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Length of air column:');
				if (tempObject.objectIs !== celDct) {
					whichSelect = delayEdit;
				}
				break;
			case drip:
			case toastr:
			case ball:
			case fshBwl:
				switch (tempObject.objectIs) {
					case toastr:
					case ball:
					case fshBwl:
						WriteNumber(delayEdit, boundRect.top - tempObject.amount, false);
						break;
					case drip:
						WriteNumber(delayEdit, tempObject.amount - boundRect.bottom, false);
						break;
				}
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Length of travel:');
				whichSelect = delayEdit;
				break;
			case outlet:
			case teaKtl:
				WriteNumber(delayEdit, tempObject.amount, false);
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Delay (1/60):');
				whichSelect = delayEdit;
				break;
			case clock:
			case paper:
			case bnsRct:
				WriteNumber(delayEdit, tempObject.amount, false);
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Points awarded:');
				whichSelect = delayEdit;
				break;
			case rbrBnd:
			case battry:
				WriteNumber(delayEdit, tempObject.amount, false);
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Quantity:');
				whichSelect = delayEdit;
				break;
			case pwrSwt:
				WriteNumber(delayEdit, tempObject.amount, false);
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Object # linked to:');
				whichSelect = delayEdit;
				break;
			case grease:
				WriteNumber(delayEdit, tempObject.amount - boundRect.right, false);
				GetDItem(theDlgPtr, delayStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, 'Length of spill:');
				whichSelect = delayEdit;
				break;
			default:
				HideDItem(theDlgPtr, delayEdit);
				HideDItem(theDlgPtr, delayStat);
		} // case objectIs

		switch (tempObject.objectIs) {
			case lftFan:
			case ritFan:
			case shredr:
			case celDct:
			case grease:
			case window:
				if (tempObject.isOn) {
					GetDItem(theDlgPtr, onRadio, cntlType, dlgItem, tempRect);
				} else {
					GetDItem(theDlgPtr, offRadio, cntlType, dlgItem, tempRect);
				}
				SetCtlValue(dlgItem.v as ControlHandle, 1);
				if (tempObject.objectIs === celDct) {
					GetDItem(theDlgPtr, onRadio, cntlType, dlgItem, tempRect);
					SetCTitle(dlgItem.v as ControlHandle, 'Blower');
					GetDItem(theDlgPtr, offRadio, cntlType, dlgItem, tempRect);
					SetCTitle(dlgItem.v as ControlHandle, 'Suction');
				}
				if (tempObject.objectIs === grease) {
					GetDItem(theDlgPtr, onRadio, cntlType, dlgItem, tempRect);
					SetCTitle(dlgItem.v as ControlHandle, 'Up');
					GetDItem(theDlgPtr, offRadio, cntlType, dlgItem, tempRect);
					SetCTitle(dlgItem.v as ControlHandle, 'Spilled');
				}
				if (tempObject.objectIs === window) {
					GetDItem(theDlgPtr, onRadio, cntlType, dlgItem, tempRect);
					SetCTitle(dlgItem.v as ControlHandle, 'Window Open');
					GetDItem(theDlgPtr, offRadio, cntlType, dlgItem, tempRect);
					SetCTitle(dlgItem.v as ControlHandle, 'Window Closed');
				}
				break;
			default:
				HideDItem(theDlgPtr, onRadio);
				HideDItem(theDlgPtr, offRadio);
		} // case objectIs
	} // end - with tempRoom do
	// select the left coordinate text edit field
	SelIText(theDlgPtr, whichSelect, 0, 254);
	Redraw();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		if (itemHit === okayBut) {
			leaveDlg = true;

			{
				const boundRect = tempObject.boundRect;
				// Port: the sums and differences with a number typed in are Integer arithmetic, which
				// wraps at 16 bits (int16).
				tempInt = ReadNumber(leftEdit); // error check left coord
				if (tempInt < 0) {
					SysBeep(1);
					WriteNumber(leftEdit, 0, true);
					leaveDlg = false;
				} else if (int16(tempInt + (boundRect.right - boundRect.left)) > 512) {
					SysBeep(1);
					WriteNumber(leftEdit, 512 - (boundRect.right - boundRect.left), true);
					leaveDlg = false;
				} else {
					tempInt = int16(tempInt - boundRect.left);
					boundRect.left = int16(boundRect.left + tempInt);
					boundRect.right = int16(boundRect.right + tempInt);
				}

				// table..obsRct, candle..macTsh
				if ((tempObject.objectIs >= table && tempObject.objectIs <= obsRct) || (tempObject.objectIs >= candle && tempObject.objectIs <= macTsh)) {
					tempInt = ReadNumber(topEdit); // error check top coord
					if (tempInt < ceilingVert) {
						SysBeep(1);
						WriteNumber(topEdit, ceilingVert, true);
						leaveDlg = false;
					} else if (int16(tempInt + (boundRect.bottom - boundRect.top)) > floorVert) {
						SysBeep(1);
						WriteNumber(topEdit, floorVert - (boundRect.bottom - boundRect.top), true);
						leaveDlg = false;
					} else {
						tempInt = int16(tempInt - boundRect.top);
						boundRect.top = int16(boundRect.top + tempInt);
						boundRect.bottom = int16(boundRect.bottom + tempInt);
					}
				}

				switch (tempObject.objectIs) {
					case table:
					case shelf:
					case cabnet:
					case extRct:
					case obsRct:
					case bnsRct:
					case window:
					case mirror:
						tempInt = ReadNumber(widthEdit); // error check width
						if (int16(tempInt + boundRect.left) > 512 || tempInt < 0) {
							SysBeep(1);
							if (tempInt < 0) {
								WriteNumber(widthEdit, 16, true);
							} else {
								WriteNumber(widthEdit, 512 - boundRect.left, true);
							}
							leaveDlg = false;
						} else {
							boundRect.right = int16(boundRect.left + tempInt);
						}
						break;
					default:
				}

				switch (tempObject.objectIs) {
					case cabnet:
					case extRct:
					case obsRct:
					case bnsRct:
					case window:
					case mirror:
						tempInt = ReadNumber(heightEdit); // error check height
						if (int16(boundRect.top + tempInt) > floorVert || tempInt < 0) {
							SysBeep(1);
							if (tempInt < 0) {
								WriteNumber(heightEdit, 16, true);
							} else {
								WriteNumber(heightEdit, floorVert - boundRect.top, true);
							}
							leaveDlg = false;
						} else {
							boundRect.bottom = int16(boundRect.top + tempInt);
						}
						break;
					default:
				}

				switch (tempObject.objectIs) {
					case extRct:
					case upStar:
					case dnStar:
						tempInt = ReadNumber(delayEdit); // error check 'amount'
						if (tempInt < 1 || tempInt > 80) {
							SysBeep(1);
							WriteNumber(delayEdit, G.roomAt, true);
							leaveDlg = false;
						} else {
							tempObject.amount = tempInt;
						}
						break;
					case flrVnt:
					case candle:
					case toastr:
					case ball:
					case fshBwl:
						tempInt = ReadNumber(delayEdit);
						if (int16(boundRect.top - tempInt) < ceilingVert) {
							SysBeep(1);
							WriteNumber(delayEdit, boundRect.top - ceilingVert, true);
							leaveDlg = false;
						} else {
							tempObject.amount = int16(boundRect.top - tempInt);
						}
						break;
					case celVnt:
					case celDct:
					case drip:
						tempInt = ReadNumber(delayEdit);
						if (int16(boundRect.bottom + tempInt) > floorVert) {
							SysBeep(1);
							WriteNumber(delayEdit, floorVert - boundRect.bottom, true);
							leaveDlg = false;
						} else {
							tempObject.amount = int16(boundRect.bottom + tempInt);
						}
						break;
					case lftFan:
						tempInt = ReadNumber(delayEdit);
						if (int16(boundRect.left - tempInt) < 0) {
							SysBeep(1);
							WriteNumber(delayEdit, boundRect.left, true);
							leaveDlg = false;
						} else {
							tempObject.amount = int16(boundRect.left - tempInt);
						}
						break;
					case ritFan:
					case grease:
						tempInt = ReadNumber(delayEdit);
						if (int16(boundRect.right + tempInt) > 512) {
							SysBeep(1);
							WriteNumber(delayEdit, 512 - boundRect.right, true);
							leaveDlg = false;
						} else {
							tempObject.amount = int16(boundRect.right + tempInt);
						}
						break;
					case clock:
					case paper:
					case bnsRct:
					case battry:
					case rbrBnd:
					case outlet:
					case teaKtl:
						tempInt = ReadNumber(delayEdit);
						if (tempInt < 0) {
							SysBeep(1);
							WriteNumber(delayEdit, int16(-1 * tempInt), true);
							leaveDlg = false;
						} else {
							tempObject.amount = tempInt;
						}
						break;
					case pwrSwt:
						tempInt = ReadNumber(delayEdit);
						if (tempInt < 0 || tempInt > 16) {
							SysBeep(1);
							WriteNumber(delayEdit, 0, true);
							leaveDlg = false;
						} else {
							tempObject.amount = tempInt;
						}
						break;
					default:
				}

				switch (tempObject.objectIs) {
					case celDct:
						tempInt = ReadNumber(widthEdit); // error check other
						if (tempInt < 1 || tempInt > 80) {
							SysBeep(1);
							WriteNumber(widthEdit, G.roomAt, true);
							leaveDlg = false;
						} else {
							tempObject.extra = tempInt;
						}
						break;
					case drip:
					case toastr:
					case fshBwl:
						tempInt = ReadNumber(widthEdit); // error check other
						if (tempInt < 0) {
							SysBeep(1);
							WriteNumber(widthEdit, int16(-1 * tempInt), true);
							leaveDlg = false;
						} else {
							tempObject.extra = tempInt;
						}
						break;
					default:
				}
			} // end - with tempObject

			if (leaveDlg) {
				G.thisRoom.theObjects[G.oneActive] = structuredClone(tempObject);
				G.changed = true;
			}
		}

		if (itemHit === cancelBut) {
			leaveDlg = true;
		}

		if (itemHit === onRadio) {
			tempObject.isOn = true;
			GetDItem(theDlgPtr, onRadio, cntlType, dlgItem, tempRect);
			SetCtlValue(dlgItem.v as ControlHandle, 1);
			GetDItem(theDlgPtr, offRadio, cntlType, dlgItem, tempRect);
			SetCtlValue(dlgItem.v as ControlHandle, 0);
		}
		if (itemHit === offRadio) {
			tempObject.isOn = false;
			GetDItem(theDlgPtr, onRadio, cntlType, dlgItem, tempRect);
			SetCtlValue(dlgItem.v as ControlHandle, 0);
			GetDItem(theDlgPtr, offRadio, cntlType, dlgItem, tempRect);
			SetCtlValue(dlgItem.v as ControlHandle, 1);
		}
	} while (!leaveDlg);

	DisposDialog(theDlgPtr);
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(wasPort);
	}
	await DrawAllObjects();
}

// =================================

export async function InsertObject(): Promise<boolean> {
	if (G.thisRoom.numberOObjects >= 16) {
		await GenericAlert(kErrTooManyObjects);
		return false;
	}
	await Deselect();
	{
		const thisRoom = G.thisRoom;
		thisRoom.numberOObjects = thisRoom.numberOObjects + 1;
		thisRoom.theObjects[thisRoom.numberOObjects] = structuredClone(G.scrapObject);
	}
	G.oneActive = G.thisRoom.numberOObjects;
	Select();
	return true;
}
