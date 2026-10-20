// Port of E-Utilities.p: the editor's shared routines: the spinning ball, menu states, the selected
// object's marquee, alerts, checking an object's values, and the Configure and About dialogs.

import {
	Alert,
	BitAnd,
	Button,
	charCodeMask,
	Chr,
	ClipRect,
	cloneRect,
	Concat,
	type ControlHandle,
	Copy,
	type Cursor,
	Delay,
	type DialogPtr,
	DisableItem,
	DisposCIcon,
	DisposDialog,
	div,
	EnableItem,
	type EventRecord,
	everyEvent,
	FlushEvents,
	FrameRect,
	FrameRoundRect,
	type GDevice,
	Get1Resource,
	GetCIcon,
	GetDItem,
	GetIcon,
	GetIndString,
	GetMainDevice,
	GetMenu,
	GetNewDialog,
	GetNextEvent,
	GetPort,
	type GrafPtr,
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
	int16,
	type Integer,
	InvertRect,
	type ItemHandle,
	keyCodeMask,
	keyDown,
	keyDownMask,
	LineTo,
	LoWord,
	type LongInt,
	ModalDialog,
	MoveTo,
	MoveWindow,
	newSysEnvRec,
	NumToString,
	OffsetRect,
	type OSErr,
	PaintRect,
	ParamText,
	patXor,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	PlotCIcon,
	PlotIcon,
	pString,
	Random,
	type Rect,
	type Ref,
	ref,
	screenBits,
	SelectWindow,
	SetCCursor,
	SetCtlValue,
	SetCursor,
	SetIText,
	SetItem,
	SetPort,
	SetPt,
	SetRect,
	ShowWindow,
	SysBeep,
	SysEnvirons,
	TickCount,
	UseResFile,
	Yield,
} from '../mac/Toolbox.ts';
import { PRect, readLayout, writeLayout } from '../mac/PascalLayout.ts';
import {
	alertID,
	alertStrIDs,
	ball,
	battry,
	bnsRct,
	cabnet,
	candle,
	ceilingVert,
	celDct,
	celVnt,
	clock,
	dnStar,
	drip,
	editToObject,
	editToRoom,
	extRct,
	fileExists,
	fileIsNew,
	floorVert,
	flrVnt,
	fshBwl,
	G,
	grease,
	guitar,
	iClear,
	iClose,
	iCopy,
	iCut,
	iGoToRoom,
	iHouse,
	iNew,
	iNewRoom,
	iNextRoom,
	iObject,
	iOpen,
	iPaste,
	iPrevRoom,
	iRoomBack,
	iRoomCond,
	iSave,
	iSaveAs,
	iTools,
	iTryGlider,
	kCursCount,
	lftFan,
	litSwt,
	mEdit,
	mFile,
	mirror,
	mSpecial,
	mWindows,
	noFileOpen,
	nulObj,
	type objectData,
	obsRct,
	outlet,
	paintg,
	paper,
	pwrSwt,
	rbrBnd,
	rCustomKeysID,
	ritFan,
	shelf,
	table,
	teaKtl,
	toastr,
	upStar,
	window,
} from './Globals.ts';

let screenNum: Integer = 0;
let timeWas: LongInt = 0;

//=================================

export function SpinBall(): void {
	let tempByte: Integer;

	if (G.ballList === null) {
		return;
	}
	tempByte = HGetState(G.ballList);
	HLock(G.ballList);
	const ballList = G.ballList;
	if (ballList.whichBall === -1) {
		return;
	}
	if (ballList.whichBall >= kCursCount) {
		ballList.whichBall = 1;
	} else {
		ballList.whichBall = ballList.whichBall + 1;
	}
	if (G.useColorCursor) {
		SetCCursor(G.ballC[ballList.whichBall]!);
	} else {
		SetCursor(ballList.ball[ballList.whichBall] as Cursor);
	}
	HSetState(G.ballList, tempByte);
}

//=================================

export function SameScreenDepth(): boolean {
	// Port: the OSErr is not used, as in the original.
	// oxlint-disable-next-line no-unused-vars
	let err: OSErr;
	const thisWorld = newSysEnvRec();
	let theDevice: GDevice;

	let result = true;
	err = SysEnvirons(1, thisWorld);
	// with thisWorld do
	if (thisWorld.hasColorQD) {
		// Port: the original does not check for nil; Color QuickDraw always has a main device.
		theDevice = GetMainDevice()!;
		HLock(theDevice);
		if (G.inColor && theDevice.gdPMap.pixelSize !== 4) {
			result = false;
		} else if (!G.inColor && theDevice.gdPMap.pixelSize !== 1) {
			result = false;
		}
		HUnlock(theDevice);
	} // end - hasColorQD
	// with thisWorld
	return result;
}

//=================================

export function DoRandom(range: Integer): Integer {
	let rawResult: LongInt;
	rawResult = Math.abs(Random());
	return div(rawResult * range, 32768);
}

//=================================

export function UpdateMenuItems(whatMode: Integer): void {
	switch (whatMode) {
		case editToObject: {
			SetItem(GetMenu(mEdit)!, iCut, 'Cut Object');
			SetItem(GetMenu(mEdit)!, iCopy, 'Copy Object');
			SetItem(GetMenu(mEdit)!, iPaste, 'Paste Object');
			DisableItem(GetMenu(mEdit)!, iPaste);
			SetItem(GetMenu(mEdit)!, iClear, 'Clear Object');
			G.editRoom = false;

			if (G.objectScrapDirty) {
				EnableItem(GetMenu(mEdit)!, iPaste);
			} else if (G.roomScrapDirty) {
				SetItem(GetMenu(mEdit)!, iPaste, 'Paste Room');
				EnableItem(GetMenu(mEdit)!, iPaste);
			}
			break;
		}

		case editToRoom: {
			SetItem(GetMenu(mEdit)!, iCut, 'Cut Room');
			SetItem(GetMenu(mEdit)!, iCopy, 'Copy Room');
			SetItem(GetMenu(mEdit)!, iPaste, 'Paste Room');
			DisableItem(GetMenu(mEdit)!, iPaste);
			SetItem(GetMenu(mEdit)!, iClear, 'Clear Room');
			G.editRoom = true;

			if (G.roomScrapDirty) {
				EnableItem(GetMenu(mEdit)!, iPaste);
			} else if (G.objectScrapDirty) {
				SetItem(GetMenu(mEdit)!, iPaste, 'Paste Object');
				EnableItem(GetMenu(mEdit)!, iPaste);
			}
			break;
		}

		case fileExists: {
			DisableItem(GetMenu(mFile)!, iNew);
			DisableItem(GetMenu(mFile)!, iOpen);
			EnableItem(GetMenu(mFile)!, iClose);
			EnableItem(GetMenu(mFile)!, iSave);
			EnableItem(GetMenu(mFile)!, iSaveAs);

			EnableItem(GetMenu(mEdit)!, iCut);
			EnableItem(GetMenu(mEdit)!, iCopy);
			EnableItem(GetMenu(mEdit)!, iClear);
			if (G.roomScrapDirty) {
				EnableItem(GetMenu(mEdit)!, iPaste);
			} else if (G.objectScrapDirty) {
				SetItem(GetMenu(mEdit)!, iPaste, 'Paste Object');
				EnableItem(GetMenu(mEdit)!, iPaste);
			}

			EnableItem(GetMenu(mSpecial)!, iTryGlider);
			EnableItem(GetMenu(mSpecial)!, iGoToRoom);
			EnableItem(GetMenu(mSpecial)!, iPrevRoom);
			EnableItem(GetMenu(mSpecial)!, iNextRoom);
			EnableItem(GetMenu(mSpecial)!, iNewRoom);

			EnableItem(GetMenu(mWindows)!, iTools);
			EnableItem(GetMenu(mWindows)!, iHouse);
			EnableItem(GetMenu(mWindows)!, iRoomBack);
			EnableItem(GetMenu(mWindows)!, iRoomCond);
			DisableItem(GetMenu(mWindows)!, iObject);
			break;
		}

		case fileIsNew: {
			DisableItem(GetMenu(mFile)!, iNew);
			DisableItem(GetMenu(mFile)!, iOpen);
			EnableItem(GetMenu(mFile)!, iClose);
			DisableItem(GetMenu(mFile)!, iSave);
			EnableItem(GetMenu(mFile)!, iSaveAs);

			EnableItem(GetMenu(mEdit)!, iCut);
			EnableItem(GetMenu(mEdit)!, iCopy);
			EnableItem(GetMenu(mEdit)!, iClear);
			if (G.roomScrapDirty) {
				EnableItem(GetMenu(mEdit)!, iPaste);
			} else if (G.objectScrapDirty) {
				SetItem(GetMenu(mEdit)!, iPaste, 'Paste Object');
				EnableItem(GetMenu(mEdit)!, iPaste);
			}

			EnableItem(GetMenu(mSpecial)!, iTryGlider);
			EnableItem(GetMenu(mSpecial)!, iGoToRoom);
			EnableItem(GetMenu(mSpecial)!, iPrevRoom);
			EnableItem(GetMenu(mSpecial)!, iNextRoom);
			EnableItem(GetMenu(mSpecial)!, iNewRoom);

			EnableItem(GetMenu(mWindows)!, iTools);
			EnableItem(GetMenu(mWindows)!, iHouse);
			EnableItem(GetMenu(mWindows)!, iRoomBack);
			EnableItem(GetMenu(mWindows)!, iRoomCond);
			DisableItem(GetMenu(mWindows)!, iObject);
			break;
		}

		case noFileOpen: {
			EnableItem(GetMenu(mFile)!, iNew);
			EnableItem(GetMenu(mFile)!, iOpen);
			DisableItem(GetMenu(mFile)!, iClose);
			DisableItem(GetMenu(mFile)!, iSave);
			DisableItem(GetMenu(mFile)!, iSaveAs);

			DisableItem(GetMenu(mEdit)!, iCut);
			DisableItem(GetMenu(mEdit)!, iCopy);
			DisableItem(GetMenu(mEdit)!, iPaste);
			DisableItem(GetMenu(mEdit)!, iClear);

			DisableItem(GetMenu(mSpecial)!, iTryGlider);
			DisableItem(GetMenu(mSpecial)!, iGoToRoom);
			DisableItem(GetMenu(mSpecial)!, iPrevRoom);
			DisableItem(GetMenu(mSpecial)!, iNextRoom);
			DisableItem(GetMenu(mSpecial)!, iNewRoom);

			DisableItem(GetMenu(mWindows)!, iTools);
			DisableItem(GetMenu(mWindows)!, iHouse);
			DisableItem(GetMenu(mWindows)!, iRoomBack);
			DisableItem(GetMenu(mWindows)!, iRoomCond);
			DisableItem(GetMenu(mWindows)!, iObject);
			break;
		}

		default:
	}
}

//=================================

export function Select(): void {
	if (G.oneActive === 0) {
		DisableItem(GetMenu(mWindows)!, iObject);
		return;
	}
	EnableItem(GetMenu(mWindows)!, iObject);

	SetPort(G.mainWndo!);
	ClipRect(G.wholeArea);
	PenNormal();

	PenMode(patXor);
	PenPat(G.marqueePat[4]!); // Initial set-up pattern for marquee
	FrameRect(G.thisRoom.theObjects[G.oneActive]!.boundRect);
	G.marqueeIndex = 0; // Start marquee pats at pat 1
	G.marqueeTime = true;

	{
		// with thisRoom.theObjects[oneActive] do
		const theObject = G.thisRoom.theObjects[G.oneActive]!;
		const boundRect = theObject.boundRect;
		const amount = theObject.amount;
		switch (theObject.objectIs) {
			// Pop the handle out
			case table:
			case shelf: {
				SetPt(G.startPt, boundRect.right, div(boundRect.top + boundRect.bottom, 2));
				SetPt(G.endPt, boundRect.right + 4, div(boundRect.top + boundRect.bottom, 2));
				break;
			}
			case cabnet:
			case extRct:
			case obsRct:
			case bnsRct:
			case window:
			case mirror: {
				SetPt(G.startPt, boundRect.right, boundRect.bottom);
				SetPt(G.endPt, boundRect.right + 4, boundRect.bottom + 4);
				break;
			}
			case flrVnt:
			case candle:
			case ball:
			case fshBwl:
			case toastr: {
				SetPt(G.startPt, div(boundRect.left + boundRect.right, 2), boundRect.top - 1);
				SetPt(G.endPt, div(boundRect.left + boundRect.right, 2), amount);
				break;
			}
			case celVnt:
			case celDct:
			case drip: {
				SetPt(G.startPt, div(boundRect.left + boundRect.right, 2), boundRect.bottom + 1);
				SetPt(G.endPt, div(boundRect.left + boundRect.right, 2), amount);
				break;
			}
			case lftFan: {
				SetPt(G.startPt, boundRect.left - 1, div(boundRect.top + boundRect.bottom, 2));
				SetPt(G.endPt, amount, div(boundRect.top + boundRect.bottom, 2));
				break;
			}
			case ritFan:
			case grease: {
				SetPt(G.startPt, boundRect.right + 1, div(boundRect.top + boundRect.bottom, 2));
				SetPt(G.endPt, amount, div(boundRect.top + boundRect.bottom, 2));
				break;
			}
			default: {
				SetPt(G.startPt, -500, -500);
				SetPt(G.endPt, -499, -499);
			}
		} // End of case
	} // End of with
	SetRect(G.handleRect, G.endPt.h - 3, G.endPt.v - 3, G.endPt.h + 3, G.endPt.v + 3);
	MoveTo(G.startPt.h, G.startPt.v);
	LineTo(G.endPt.h, G.endPt.v);
	PaintRect(G.handleRect);

	PenNormal();
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}
}

//=================================

export async function Deselect(): Promise<void> {
	DisableItem(GetMenu(mWindows)!, iObject);
	if (G.oneActive === 0) {
		return;
	}

	do {
		await DoMarquee();
	} while (!(G.marqueeIndex === 0));

	SetPort(G.mainWndo!);

	PenMode(patXor);
	PenPat(G.marqueePat[4]!);
	FrameRect(G.thisRoom.theObjects[G.oneActive]!.boundRect);
	MoveTo(G.startPt.h, G.startPt.v);
	LineTo(G.endPt.h, G.endPt.v);
	PaintRect(G.handleRect);
	PenNormal();

	G.oneActive = 0;
	G.handleRect = cloneRect(G.nullRect);

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}

	G.marqueeTime = false;
}

//=================================

export async function DoMarquee(): Promise<void> {
	// Port: the final tick count that Delay returns is not used, as in the original.
	// oxlint-disable-next-line no-unused-vars
	let dummyLong: LongInt;
	dummyLong = await Delay(2);
	SetPort(G.mainWndo!);
	PenNormal();
	PenMode(patXor);
	PenPat(G.marqueePat[G.marqueeIndex]!);
	FrameRect(G.thisRoom.theObjects[G.oneActive]!.boundRect);
	MoveTo(G.startPt.h, G.startPt.v);
	LineTo(G.endPt.h, G.endPt.v);
	PaintRect(G.handleRect);

	G.marqueeIndex = G.marqueeIndex + 1;
	if (G.marqueeIndex > 3) {
		G.marqueeIndex = 0;
	}

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}
}

//=================================

export async function GenericAlert(whatGives: Integer): Promise<void> {
	let dummyInt: Integer;
	let line1: string, line2: string;
	let alertRect: Rect;

	UseResFile(G.editorResNum);
	InitCursor();
	if (whatGives > 0) {
		line1 = GetIndString(alertStrIDs, whatGives);
		line2 = '';
	} else {
		line1 = GetIndString(alertStrIDs, 1);
		line2 = NumToString(whatGives);
		line2 = Concat('Error = ', line2);
	}

	ParamText(line1, line2, '', '');
	// Port: an AlertTHndl over the 'ALRT' bytes; its boundsRect is a Rect at offset 0.
	const alertHandle = Get1Resource('ALRT', alertID);
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
	dummyInt = await Alert(alertID, null);
}

//=================================

/** Port: a var parameter that is a field of a record. */
function fieldRef<T, K extends keyof T>(record: T, key: K): Ref<T[K]> {
	return {
		get v() {
			return record[key];
		},
		set v(x) {
			record[key] = x;
		},
	};
}

export function ErrorCheckObject(wasObject: objectData, errorType: Ref<Integer>): boolean {
	const noError = 0;
	const kindError = 1;
	const boundError = 2;
	const amountError = 3;
	const extraError = 4;
	// Port: isOnError = 5 is declared but never used.

	let inError: boolean;

	// -----------------

	function ShiftOrSet(valueIs: Ref<Integer>, otherValue: Ref<Integer>, valueShould: Integer, objectType: Integer, upDown: boolean): void {
		// Port: Integer arithmetic, which wraps at 16 bits (a damaged house's objects can be anywhere).
		switch (objectType) {
			// these objects are just set
			case table:
			case shelf:
				if (upDown) {
					otherValue.v = int16(otherValue.v + (valueShould - valueIs.v));
				}
				break;
			case cabnet:
			case extRct:
			case obsRct:
			case bnsRct:
			case window:
			case mirror:
				break;
			default: // other objects are offset
				otherValue.v = int16(otherValue.v + (valueShould - valueIs.v));
		}
		valueIs.v = valueShould;
	}

	// -----------------

	inError = false;
	errorType.v = noError;

	{
		// with wasObject do
		const objectIs = wasObject.objectIs;
		// case objectIs of
		if (
			(objectIs >= nulObj && objectIs <= obsRct) ||
			(objectIs >= flrVnt && objectIs <= ritFan) ||
			(objectIs >= clock && objectIs <= rbrBnd) ||
			(objectIs >= litSwt && objectIs <= guitar) ||
			(objectIs >= drip && objectIs <= window) ||
			(objectIs >= paintg && objectIs <= dnStar)
		) {
			// valid kinds
		} else {
			wasObject.objectIs = 0;
			inError = true;
			errorType.v = kindError;
		} // case - objectIs

		{
			// with boundRect do
			const boundRect = wasObject.boundRect;
			const left = fieldRef(boundRect, 'left');
			const right = fieldRef(boundRect, 'right');
			const top = fieldRef(boundRect, 'top');
			const bottom = fieldRef(boundRect, 'bottom');
			if (boundRect.left < 0) {
				ShiftOrSet(left, right, 0, wasObject.objectIs, false);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.left > 512 - 16) {
				ShiftOrSet(left, right, 512 - 16, wasObject.objectIs, false);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.right > 512) {
				ShiftOrSet(right, left, 512, wasObject.objectIs, false);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.right < 16) {
				ShiftOrSet(right, left, 16, wasObject.objectIs, false);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.top < 0) {
				ShiftOrSet(top, bottom, 0, wasObject.objectIs, true);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.top > 342 - 16) {
				ShiftOrSet(top, bottom, 342 - 16, wasObject.objectIs, true);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.bottom > 342) {
				ShiftOrSet(bottom, top, 342, wasObject.objectIs, true);
				inError = true;
				errorType.v = boundError;
			}
			if (boundRect.bottom < 16) {
				ShiftOrSet(bottom, top, 16, wasObject.objectIs, true);
				inError = true;
				errorType.v = boundError;
			}
		} // end - with boundRect

		switch (wasObject.objectIs) {
			case extRct:
			case upStar:
			case dnStar:
				if (wasObject.amount < 1 || wasObject.amount > 80) {
					// room link must be 1..80
					wasObject.amount = G.roomAt;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case pwrSwt:
				if (wasObject.amount < 0 || wasObject.amount > 16) {
					// object link must be 0..16
					wasObject.amount = 0;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case flrVnt:
			case candle:
			case toastr:
			case ball:
			case fshBwl: // air etc. column not too high
				if (wasObject.amount < ceilingVert + 10 || wasObject.amount > wasObject.boundRect.top) {
					wasObject.amount = ceilingVert + 10;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case celVnt:
			case celDct:
			case drip: // air etc. column not too low
				if (wasObject.amount < wasObject.boundRect.bottom || wasObject.amount > floorVert) {
					wasObject.amount = floorVert;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case lftFan: // air column not too left
				if (wasObject.amount < 0 || wasObject.amount > wasObject.boundRect.left) {
					wasObject.amount = 0;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case ritFan:
			case grease: // air etc. column not too right
				if (wasObject.amount < wasObject.boundRect.right || wasObject.amount > 512) {
					wasObject.amount = 512;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case clock:
			case paper:
			case bnsRct: // points not too high or neg.
				if (wasObject.amount < 0 || wasObject.amount > 10000) {
					wasObject.amount = 1000;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case battry:
			case rbrBnd: // things not too high or neg.
				if (wasObject.amount < 0 || wasObject.amount > 100) {
					wasObject.amount = 20;
					inError = true;
					errorType.v = amountError;
				}
				break;
			case outlet:
			case teaKtl: // delay not too high or neg.
				if (wasObject.amount < 0 || wasObject.amount > 600) {
					wasObject.amount = 30;
					inError = true;
					errorType.v = amountError;
				}
				break;
			default:
		} // case - objectIs

		switch (wasObject.objectIs) {
			case celDct: // room must be 1..80
				if (wasObject.extra < 1 || wasObject.extra > 80) {
					wasObject.extra = G.roomAt;
					inError = true;
					errorType.v = extraError;
				}
				break;
			case drip:
			case fshBwl:
				if (wasObject.extra < 0 || wasObject.extra > 600) {
					wasObject.extra = 30;
					inError = true;
					errorType.v = extraError;
				}
				break;
			default:
		} // case - objectIs
	} // end - with wasObject

	return inError;
}

//=================================

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
	UseResFile(G.editorResNum);

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

//=================================

export async function idleFilter(theDialog: DialogPtr, theEvent: EventRecord, itemHit: Ref<Integer>): Promise<boolean> {
	let iconNum: Integer;
	const iType = ref<Integer>(0);
	let timeIs: LongInt;
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const iHand = ref<ItemHandle>(null);

	let result = false;
	if (theEvent.what === keyDown && BitAnd(theEvent.message, charCodeMask) === 13) {
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
			timeIs = await Delay(2);
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
		} // end - for iconnum
	} // end - if (timeIs
	return result;
}

//=================================

export async function DoAbout(): Promise<void> {
	const okayButton = 1;

	let ExitDialog: boolean;
	const DType = ref<Integer>(0);
	let itemHit: Integer;
	const DItem = ref<ItemHandle>(null);
	// Port: CItem is assigned and never read, as in the original.
	// oxlint-disable-next-line no-unused-vars
	let CItem: ControlHandle;
	let tempRect: Rect;
	// Port: excessSpace, Index, temp, iTemp, ThisEditText, CTempItem, and TheDialogPtr are declared but never used.

	// ----------------------------------

	function Refresh_Dialog(): void {
		// Refresh the dialogs non-controls
		// Port: rTempRect (Temp rectangle used for drawing) is declared but never used.
		SetPort(GetSelection); // Point to our dialog window
		GetDItem(GetSelection, okayButton, DType, DItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenSize(1, 1); // Restore the pen size to the default value
	}

	// ----------------------------------

	// Start of dialog handler
	const savePort: GrafPtr = GetPort(); // Get the previous grafport

	const GetSelection = GetNewDialog(228, null, inFront)!; // Bring in the dialog resource
	tempRect = cloneRect(GetSelection.portRect); // Get window size, we will now center it
	tempRect.top = div(screenBits.bounds.bottom - screenBits.bounds.top - (tempRect.bottom - tempRect.top), 2);
	tempRect.left = div(screenBits.bounds.right - screenBits.bounds.left - (tempRect.right - tempRect.left), 2);
	MoveWindow(GetSelection, tempRect.left, tempRect.top, true); // Now move the window to the proper position
	ShowWindow(GetSelection); // Open a dialog box
	SelectWindow(GetSelection); // Lets see it
	SetPort(GetSelection); // Prepare to add conditional text

	Refresh_Dialog(); // Draw any Lists, lines, or rectangles
	timeWas = TickCount(); // Initialize the tick counter
	screenNum = 0; // Initialize the set of icons displaying
	ExitDialog = false; // Do not exit dialog handle loop yet

	do {
		// Start of dialog handle loop
		itemHit = await ModalDialog(idleFilter); // Wait until an item is hit
		GetDItem(GetSelection, itemHit, DType, DItem, tempRect); // Get item information
		CItem = DItem.v as ControlHandle; // Get the control handle
		if (itemHit === okayButton) {
			// Handle the Button being pressed
			ExitDialog = true; // Exit the dialog when this selection is made
		} // End for this item selected
	} while (!ExitDialog); // Handle dialog items until exit selected
	SetPort(savePort); // Restore the previous grafport
	DisposDialog(GetSelection); // Flush the dialog out of memory
} // End of procedure
