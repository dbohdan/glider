// Port of E-RoomStuff.p: room records (sorting a room's objects, inserting and clearing rooms) and
// the Go To Room, Room Background, and Room Conditions dialogs.

import {
	BitAnd,
	blackColor,
	blueColor,
	charCodeMask,
	clonePoint,
	cloneRect,
	type ControlHandle,
	Concat,
	Copy,
	type DialogPtr,
	DisposDialog,
	div,
	DrawPicture,
	EraseRect,
	type EventRecord,
	ForeColor,
	FrameRect,
	FrameRoundRect,
	GetDItem,
	GetIText,
	GetMouse,
	GetNewDialog,
	GetPicture,
	GetPort,
	type Handle,
	HGetState,
	HideDItem,
	HiliteControl,
	HLock,
	HSetState,
	inFront,
	InsetRect,
	type Integer,
	type ItemHandle,
	keyDown,
	Length,
	Line,
	LoWord,
	type LongInt,
	ModalDialog,
	mouseDown,
	MoveTo,
	MoveWindow,
	NumToString,
	OffsetRect,
	pArray,
	PaintRect,
	patXor,
	PenMode,
	PenNormal,
	PenPat,
	PenSize,
	type Point,
	PtInRect,
	type Rect,
	redColor,
	type Ref,
	ref,
	ReleaseResource,
	SelectWindow,
	SelIText,
	SetCtlValue,
	SetIText,
	SetPort,
	SetRect,
	ShowWindow,
	StringToNum,
	SysBeep,
	WaitMouseUp,
	black,
	gray,
	white,
	Yield,
} from '../mac/Toolbox.ts';
import { zeroOf } from '../mac/PascalLayout.ts';
import { G, kErrGraphicLoad, kErrLoadingRes, kErrTooManyRooms, mirror, paintg, type roomData, roomDataLayout, window } from './Globals.ts';
import { DrawRoomNum } from './Drawing.ts';
import { GenericAlert } from './Utilities.ts';

const roomCondID = 129;
const roomBackID = 130;

/** array[0..7] of Integer */
const tempTile: Integer[] = pArray(0, 7, () => 0);
let backNumber: Integer = 0;

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });
const point = (): Point => ({ v: 0, h: 0 });

// Port: Pascal record assignment copies the whole record (`tempRoom := thisRoom`).
function copyRecord<T>(r: T): T {
	return structuredClone(r);
}

// =================================

export function SortObjects(): void {
	let holdActive: Integer;
	let i: Integer;
	let count: Integer;
	let itemType: Integer;
	const holdRoom: roomData = zeroOf(roomDataLayout);

	FlushRoom(holdRoom);
	count = 0;
	holdActive = G.oneActive;

	for (i = 1; i <= 16; i++) {
		itemType = G.thisRoom.theObjects[i]!.objectIs;
		if (itemType !== paintg && itemType !== mirror && itemType !== window && itemType !== 0) {
			count = count + 1;
			if (G.oneActive === i) {
				holdActive = count;
			}
			holdRoom.theObjects[count] = copyRecord(G.thisRoom.theObjects[i]!);
			G.thisRoom.theObjects[i]!.objectIs = 0;
		}
	}

	for (i = 1; i <= 16; i++) {
		itemType = G.thisRoom.theObjects[i]!.objectIs;
		if (itemType !== 0) {
			count = count + 1;
			if (G.oneActive === i) {
				holdActive = count;
			}
			holdRoom.theObjects[count] = copyRecord(G.thisRoom.theObjects[i]!);
		}
	}

	for (i = 1; i <= G.thisRoom.numberOObjects; i++) {
		G.thisRoom.theObjects[i] = copyRecord(holdRoom.theObjects[i]!);
	}
	{
		const thisRoom = G.thisRoom;
		if (count !== thisRoom.numberOObjects) {
			// *** Check for agreement
			count = 0; // *** Run a second check
			for (i = 1; i <= 16; i++) {
				if (thisRoom.theObjects[i]!.objectIs !== 0) {
					count = count + 1;
				}
			}
			thisRoom.numberOObjects = count; // *** We'll go with this #
			if (thisRoom.numberOObjects < 16) {
				for (i = thisRoom.numberOObjects + 1; i <= 16; i++) {
					thisRoom.theObjects[i]!.objectIs = 0; // *** Zero-out excess fields
					thisRoom.theObjects[i]!.boundRect = cloneRect(G.nullRect);
					thisRoom.theObjects[i]!.amount = 0;
					thisRoom.theObjects[i]!.extra = 0;
					thisRoom.theObjects[i]!.isOn = false;
				}
			}
		}
	}

	G.oneActive = holdActive; // *** Restore active object
}

// =================================

export async function InsertNewRoom(): Promise<boolean> {
	let i: Integer;

	if (G.thisHouse.numberORooms >= 40) {
		// trying to add 41 rooms
		await GenericAlert(kErrTooManyRooms);
		return false;
	}
	G.thisHouse.theRooms[G.roomAt] = copyRecord(G.thisRoom); // insert room to date
	if (G.roomAt < G.thisHouse.numberORooms) {
		// shift only if in middle
		for (i = G.thisHouse.numberORooms; i >= G.roomAt + 1; i--) {
			G.thisHouse.theRooms[i + 1] = copyRecord(G.thisHouse.theRooms[i]!); // shift rooms right
		}
	}
	G.roomAt = G.roomAt + 1; // kick active over to right
	FlushRoom(G.thisRoom); // flush new room copy
	G.thisHouse.theRooms[G.roomAt] = copyRecord(G.thisRoom); // copy active into house
	G.thisHouse.numberORooms = G.thisHouse.numberORooms + 1; // one more room
	return true;
}

// =================================

export function FlushRoom(whichRoom: roomData): void {
	let index: Integer;
	let defaultName: string;

	defaultName = NumToString(G.roomAt);
	defaultName = Concat('Room # ', defaultName);

	whichRoom.roomName = defaultName;
	whichRoom.numberOObjects = 0;
	whichRoom.backPictID = 200;
	for (index = 0; index <= 7; index++) {
		whichRoom.tileOrder[index] = 0;
	}
	whichRoom.animateKind = 0;
	whichRoom.animateNumber = 0;
	whichRoom.animateDelay = 0;
	whichRoom.conditionCode = 0;
	for (index = 1; index <= 16; index++) {
		whichRoom.theObjects[index]!.objectIs = 0;
		whichRoom.theObjects[index]!.boundRect = cloneRect(G.nullRect);
		whichRoom.theObjects[index]!.amount = 0;
		whichRoom.theObjects[index]!.extra = 0;
		whichRoom.theObjects[index]!.isOn = false;
	}
}

// =================================

export async function DoGotoDial(): Promise<void> {
	const okayBut = 1;
	const cancelBut = 2;
	const gotoEdit = 3;
	const numOfStat = 4;
	const currStat = 5;

	let leaveDlg: boolean;
	let tempLong: LongInt;
	const tempRect = rect();
	const cntlType = ref<Integer>(0);
	let itemHit: Integer;
	const dlgItem = ref<ItemHandle>(null);
	let strTemp: string;

	// -------------------------

	function Redraw(): void {
		SetPort(theDlgPtr); // Point to our dialog window
		GetDItem(theDlgPtr, okayBut, cntlType, dlgItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenNormal();
	}

	// -------------------------

	const theDlgPtr = GetNewDialog(261, null, inFront)!;
	const rightOff = G.rightOffset - theDlgPtr.portBits.bounds.left;
	const downOff = G.downOffset - theDlgPtr.portBits.bounds.top;
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	strTemp = NumToString(G.thisHouse.numberORooms);
	GetDItem(theDlgPtr, numOfStat, cntlType, dlgItem, tempRect);
	SetIText(dlgItem.v as Handle, strTemp);

	strTemp = NumToString(G.roomAt);
	GetDItem(theDlgPtr, currStat, cntlType, dlgItem, tempRect);
	SetIText(dlgItem.v as Handle, strTemp);
	strTemp = NumToString(G.roomAt);
	GetDItem(theDlgPtr, gotoEdit, cntlType, dlgItem, tempRect);
	SetIText(dlgItem.v as Handle, strTemp);
	SelIText(theDlgPtr, gotoEdit, 0, 3);

	Redraw();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		if (itemHit === okayBut) {
			GetDItem(theDlgPtr, gotoEdit, cntlType, dlgItem, tempRect);
			strTemp = GetIText(dlgItem.v as Handle); // Get the text entered
			tempLong = StringToNum(strTemp);
			if (LoWord(tempLong) > 0 && LoWord(tempLong) < G.thisHouse.numberORooms + 1) {
				leaveDlg = true;
				G.roomAt = LoWord(tempLong);
			} else {
				SysBeep(1);
				strTemp = NumToString(G.roomAt);
				GetDItem(theDlgPtr, gotoEdit, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, strTemp);
				SelIText(theDlgPtr, gotoEdit, 0, 3);
			}
		}

		if (itemHit === cancelBut) {
			leaveDlg = true;
		}
	} while (!leaveDlg);

	DisposDialog(theDlgPtr);

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(G.mainWndo!);
	}
}

// =================================

export async function roomFltr(_theDlg: DialogPtr, theEvnt: EventRecord, itemHit: Ref<Integer>): Promise<boolean> {
	let whichTile: Integer = 0;
	let itemDropped: Integer;
	let wasPt: Point = point();
	let newPt: Point;
	let thePict;
	const tempRect: Rect = rect();
	const dest = rect();
	let tempRect2: Rect = rect();
	let tempByte: Integer;

	// ----------------

	async function ClickedInLeftBox(): Promise<void> {
		let index2: Integer;

		whichTile = div(wasPt.h - 17, 8);
		SetRect(tempRect, 0, 0, 8, 49); // a tile rect
		OffsetRect(tempRect, 17 + whichTile * 8, 83);

		GetMouse(wasPt);
		newPt = clonePoint(wasPt);
		PenPat(gray);
		PenMode(patXor);
		FrameRect(tempRect);
		while (WaitMouseUp()) {
			GetMouse(newPt);
			if (newPt.h !== wasPt.h) {
				FrameRect(tempRect);
				OffsetRect(tempRect, newPt.h - wasPt.h, 0);
				FrameRect(tempRect);
				wasPt = clonePoint(newPt);
			} // end - if (a)
			await Yield();
		} // end - while
		FrameRect(tempRect);
		PenNormal();
		SetRect(dest, 111, 83, 175, 132);
		if (PtInRect(newPt, dest)) {
			itemDropped = div(newPt.h - 111, 8);
			if (itemDropped > -1 && itemDropped < 8) {
				tempTile[itemDropped] = whichTile;
			} else {
				SysBeep(1);
			}
		}
		for (index2 = 0; index2 <= 7; index2++) {
			SetRect(tempRect, 0, 0, 8, 49);
			OffsetRect(tempRect, 111 + index2 * 8, 83);
			thePict = GetPicture(300 + tempTile[index2]! + backNumber * 8);
			if (thePict !== null) {
				tempByte = HGetState(thePict);
				HLock(thePict);
				DrawPicture(thePict, tempRect);
				HSetState(thePict, tempByte);
			} else {
				await GenericAlert(kErrGraphicLoad);
			}
			ReleaseResource(thePict as Handle | null);
		} // end - for
	} // end - if PtInRect

	// ----------------

	let result = false; // assume no events

	if (theEvnt.what === keyDown && BitAnd(theEvnt.message, charCodeMask) === 0x0d) {
		// 'carriage' return hit
		itemHit.v = 1;
		result = true;
	}

	if (theEvnt.what === mouseDown) {
		GetMouse(wasPt);
		SetRect(tempRect, 17, 83, 81, 132);
		if (PtInRect(wasPt, tempRect)) {
			// tempRect => left tile rect
			await ClickedInLeftBox();
		}
	} // end - if mouseDown

	SetRect(tempRect2, 17, 78, 81, 81); // erase any old markers
	EraseRect(tempRect2);
	SetRect(tempRect2, 17, 134, 81, 137);
	EraseRect(tempRect2);

	GetMouse(wasPt);
	SetRect(tempRect, 17, 83, 81, 132);
	if (PtInRect(wasPt, tempRect)) {
		// tempRect => left tile rect
		whichTile = div(wasPt.h - 17, 8);
		SetRect(tempRect, 0, 0, 8, 49); // a tile rect
		OffsetRect(tempRect, 17 + whichTile * 8, 83);

		tempRect2 = cloneRect(tempRect); // draw top marker over tile
		tempRect2.top = tempRect2.top - 5;
		tempRect2.bottom = tempRect2.top + 3;
		ForeColor(redColor);
		PaintRect(tempRect2);
		ForeColor(blackColor);

		tempRect2 = cloneRect(tempRect); // draw bottom marker under tile
		tempRect2.bottom = tempRect2.bottom + 5;
		tempRect2.top = tempRect2.bottom - 3;
		ForeColor(redColor);
		PaintRect(tempRect2);
		ForeColor(blackColor);
	}

	return result;
}

// =================================

export async function DoRoomBackInfo(shouldOpen: Ref<boolean>): Promise<void> {
	const okayBut = 1;
	const cancelBut = 2;
	const backIcon1 = 3;
	const backIcon10 = 12;
	const backStat = 13;
	// const tileStat = 14;

	let leaveDlg: boolean;
	const tempRect = rect();
	let wasRect: Rect = rect();
	const cntlType = ref<Integer>(0);
	let i: Integer;
	let i2: Integer;
	let itemHit: Integer;
	const dlgItem = ref<ItemHandle>(null);
	/** array[0..9] of string[18] */
	const backName: string[] = pArray(0, 9, () => '');

	// -------------------------

	async function Redraw(): Promise<void> {
		let i: Integer;
		let tempByte: Integer;
		let thePict;

		SetPort(theDlgPtr!); // Point to our dialog window
		GetDItem(theDlgPtr!, okayBut, cntlType, dlgItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline

		GetDItem(theDlgPtr!, backNumber + backIcon1, cntlType, dlgItem, tempRect);
		PenSize(2, 2);
		InsetRect(tempRect, -2, -2);
		ForeColor(redColor);
		FrameRect(tempRect);
		ForeColor(blackColor);
		wasRect = cloneRect(tempRect);
		PenNormal();

		const width = theDlgPtr!.portRect.right - theDlgPtr!.portRect.left;
		MoveTo(4, 38);
		Line(width - 8, 0);
		MoveTo(4, 40);
		Line(width - 8, 0);

		for (i = 0; i <= 7; i++) {
			SetRect(tempRect, 0, 0, 8, 49);
			OffsetRect(tempRect, 111 + i * 8, 83);
			thePict = GetPicture(300 + tempTile[i]! + backNumber * 8);
			if (thePict !== null) {
				tempByte = HGetState(thePict);
				HLock(thePict);
				DrawPicture(thePict, tempRect);
				HSetState(thePict, tempByte);
			} else {
				await GenericAlert(kErrGraphicLoad);
			}
			ReleaseResource(thePict as Handle | null);
		}
		for (i = 0; i <= 7; i++) {
			SetRect(tempRect, 0, 0, 8, 49);
			OffsetRect(tempRect, 17 + i * 8, 83);
			thePict = GetPicture(300 + i + backNumber * 8);
			if (thePict !== null) {
				tempByte = HGetState(thePict);
				HLock(thePict);
				DrawPicture(thePict, tempRect);
				HSetState(thePict, tempByte);
			} else {
				await GenericAlert(kErrGraphicLoad);
			}
			ReleaseResource(thePict as Handle | null);
		}

		ForeColor(redColor);
		SetRect(tempRect, 15, 81, 83, 134);
		FrameRect(tempRect);
		ForeColor(blueColor);
		SetRect(tempRect, 109, 81, 177, 134);
		FrameRect(tempRect);
		ForeColor(blackColor);
	}

	// -------------------------

	const wasPort = GetPort();

	const theDlgPtr = GetNewDialog(roomBackID, null, inFront);
	if (theDlgPtr === null) {
		await GenericAlert(kErrLoadingRes);
		return;
	}
	const rightOff = G.rightOffset - theDlgPtr.portBits.bounds.left;
	const downOff = G.downOffset - theDlgPtr.portBits.bounds.top;
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	backName[0] = 'Plain Room';
	backName[1] = 'Paneled Room';
	backName[2] = 'Basement';
	backName[3] = 'Japanese Room';
	backName[4] = 'Child’s Room';
	backName[5] = 'Unfinished Room';
	backName[6] = 'Hip Wallpaper';
	backName[7] = 'Entertainment';
	backName[8] = 'Bathroom';
	backName[9] = 'Kitchen';

	const tempRoom = copyRecord(G.thisRoom);
	backNumber = tempRoom.backPictID - 200;
	for (i = 0; i <= 7; i++) {
		tempTile[i] = tempRoom.tileOrder[i]!;
	}
	GetDItem(theDlgPtr, backStat, cntlType, dlgItem, tempRect);
	SetIText(dlgItem.v as Handle, backName[backNumber]!);

	if (!shouldOpen.v) {
		HideDItem(theDlgPtr, cancelBut);
	}

	await Redraw();
	leaveDlg = false;
	shouldOpen.v = false;

	do {
		itemHit = await ModalDialog(roomFltr);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		for (i = backIcon1; i <= backIcon10; i++) {
			if (itemHit === i) {
				PenSize(2, 2);
				PenPat(white);
				FrameRect(wasRect);
				GetDItem(theDlgPtr, i, cntlType, dlgItem, tempRect);
				InsetRect(tempRect, -2, -2);
				PenPat(black);
				ForeColor(redColor);
				FrameRect(tempRect);
				ForeColor(blackColor);
				wasRect = cloneRect(tempRect);
				PenNormal();
				backNumber = i - backIcon1;
				GetDItem(theDlgPtr, backStat, cntlType, dlgItem, tempRect);
				SetIText(dlgItem.v as Handle, backName[backNumber]!);
				tempRoom.backPictID = backNumber + 200;
				for (i2 = 0; i2 <= 7; i2++) {
					switch (backNumber) {
						case 0:
						case 1:
						case 2:
						case 3:
						case 5:
							tempTile[i2] = 0;
							break;
						default:
							tempTile[i2] = i2;
					}
				}
				await Redraw();
			}
		}

		if (itemHit === okayBut) {
			leaveDlg = true;
			G.changed = true;

			for (i = 0; i <= 7; i++) {
				tempRoom.tileOrder[i] = tempTile[i]!;
			}

			switch (tempRoom.backPictID) {
				case 200:
				case 201:
				case 202:
				case 203:
				case 205:
					if (tempRoom.tileOrder[0] === 6) {
						// don't allow backward walls
						tempRoom.tileOrder[0] = 0;
					}
					if (tempRoom.tileOrder[7] === 7) {
						tempRoom.tileOrder[7] = 0;
					}

					if (tempRoom.tileOrder[0] === 7) {
						// check left open
						tempRoom.leftOpen = false;
					} else {
						tempRoom.leftOpen = true;
					}
					if (tempRoom.tileOrder[7] === 6) {
						// check right open
						tempRoom.rightOpen = false;
					} else {
						tempRoom.rightOpen = true;
					}

					for (i = 1; i <= 6; i++) {
						// don't allow walls in the middle
						if (tempRoom.tileOrder[i] === 6 || tempRoom.tileOrder[i] === 7) {
							SysBeep(1);
							tempRoom.tileOrder[i] = 0;
						}
					}
					break;
				default:
					tempRoom.leftOpen = true;
					tempRoom.rightOpen = true;
			} // end - case
			if (G.roomAt === 1) {
				tempRoom.leftOpen = false;
			}
			// end - with

			if (leaveDlg) {
				Object.assign(G.thisRoom, copyRecord(tempRoom));
			}
		}

		if (itemHit === cancelBut) {
			if (G.thisHouse.numberORooms < 1) {
				shouldOpen.v = true;
			}
			leaveDlg = true;
		}
	} while (!leaveDlg);

	DisposDialog(theDlgPtr);
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(wasPort);
	}
}

// =================================

// =================================

export async function DoRoomCondInfo(shouldOpen: Ref<boolean>): Promise<void> {
	const inactive = 255;
	// const active = 0;

	const okayBut = 1;
	const cancelBut = 2;

	const normalRadio = 3;
	const lightsRadio = 5;

	const nothingRadio = 6;
	const dartsRadio = 9;

	const numOfEdit = 10;
	const delayEdit = 11;
	const nameEdit = 12;

	const objectsStat = 13;
	const roomNumStat = 14;

	let leaveDlg: boolean;
	const tempRect = rect();
	const cntlType = ref<Integer>(0);
	let itemHit: Integer;
	let tempInt: Integer;
	let i: Integer;
	let tempLong: LongInt;
	const dlgItem = ref<ItemHandle>(null);
	let strTemp: string;

	// -------------------------

	function Redraw(): void {
		SetPort(theDlgPtr!); // Point to our dialog window
		GetDItem(theDlgPtr!, okayBut, cntlType, dlgItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenNormal();
		const width = theDlgPtr!.portRect.right - theDlgPtr!.portRect.left;
		MoveTo(4, 38);
		Line(width - 8, 0);
		MoveTo(4, 40);
		Line(width - 8, 0);
	}

	// -------------------------

	const wasPort = GetPort();

	const theDlgPtr = GetNewDialog(roomCondID, null, inFront);
	if (theDlgPtr === null) {
		await GenericAlert(kErrLoadingRes);
		return;
	}
	const rightOff = G.rightOffset - theDlgPtr.portBits.bounds.left;
	const downOff = G.downOffset - theDlgPtr.portBits.bounds.top;
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	const tempRoom = copyRecord(G.thisRoom);
	{
		// pop name of room into edit text field
		GetDItem(theDlgPtr, nameEdit, cntlType, dlgItem, tempRect);
		strTemp = tempRoom.roomName;
		SetIText(dlgItem.v as Handle, strTemp);
		// pop the room number as static text
		GetDItem(theDlgPtr, roomNumStat, cntlType, dlgItem, tempRect);
		strTemp = NumToString(G.roomAt);
		SetIText(dlgItem.v as Handle, strTemp);
		// pop up number of animates into edit text field
		GetDItem(theDlgPtr, numOfEdit, cntlType, dlgItem, tempRect);
		strTemp = NumToString(tempRoom.animateNumber);
		SetIText(dlgItem.v as Handle, strTemp);
		// pop up delay - convert to seconds
		GetDItem(theDlgPtr, delayEdit, cntlType, dlgItem, tempRect);
		strTemp = NumToString(tempRoom.animateDelay);
		SetIText(dlgItem.v as Handle, strTemp);
		// pop up number of objects as static text
		GetDItem(theDlgPtr, objectsStat, cntlType, dlgItem, tempRect);
		strTemp = NumToString(tempRoom.numberOObjects);
		SetIText(dlgItem.v as Handle, strTemp);
		// select radio button representing animate kind
		if (tempRoom.animateNumber > 0) {
			tempInt = 9 - tempRoom.animateKind;
			GetDItem(theDlgPtr, tempInt, cntlType, dlgItem, tempRect);
			SetCtlValue(dlgItem.v as ControlHandle, 1);
		} else {
			GetDItem(theDlgPtr, nothingRadio, cntlType, dlgItem, tempRect);
			SetCtlValue(dlgItem.v as ControlHandle, 1);
		}
		// select radio button representing condition of room
		GetDItem(theDlgPtr, tempRoom.conditionCode + 3, cntlType, dlgItem, tempRect);
		SetCtlValue(dlgItem.v as ControlHandle, 1);
		// decide whether or not to gray out cancel button
		if (!shouldOpen.v) {
			GetDItem(theDlgPtr, cancelBut, cntlType, dlgItem, tempRect);
			HiliteControl(dlgItem.v as ControlHandle, inactive);
		}
	} // end - with tempRoom do
	// select the name of the room
	SelIText(theDlgPtr, nameEdit, 0, 24);
	Redraw();
	leaveDlg = false;
	shouldOpen.v = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		for (i = normalRadio; i <= lightsRadio; i++) {
			if (itemHit === i) {
				for (tempInt = normalRadio; tempInt <= lightsRadio; tempInt++) {
					GetDItem(theDlgPtr, tempInt, cntlType, dlgItem, tempRect);
					SetCtlValue(dlgItem.v as ControlHandle, 0);
				}
				GetDItem(theDlgPtr, i, cntlType, dlgItem, tempRect);
				SetCtlValue(dlgItem.v as ControlHandle, 1);
				tempRoom.conditionCode = i - normalRadio;
			}
		}

		for (i = nothingRadio; i <= dartsRadio; i++) {
			if (itemHit === i) {
				for (tempInt = nothingRadio; tempInt <= dartsRadio; tempInt++) {
					GetDItem(theDlgPtr, tempInt, cntlType, dlgItem, tempRect);
					SetCtlValue(dlgItem.v as ControlHandle, 0);
				}
				GetDItem(theDlgPtr, i, cntlType, dlgItem, tempRect);
				SetCtlValue(dlgItem.v as ControlHandle, 1);
				if (itemHit === nothingRadio) {
					tempRoom.animateNumber = 0;
					GetDItem(theDlgPtr, numOfEdit, cntlType, dlgItem, tempRect);
					strTemp = NumToString(tempRoom.animateNumber);
					SetIText(dlgItem.v as Handle, strTemp);
				} else {
					tempRoom.animateKind = 9 - i;
				}
			}
		}

		if (itemHit === okayBut) {
			leaveDlg = true;

			GetDItem(theDlgPtr, numOfEdit, cntlType, dlgItem, tempRect);
			strTemp = GetIText(dlgItem.v as Handle); // Get the text entered
			tempLong = StringToNum(strTemp);
			tempRoom.animateNumber = LoWord(tempLong);
			if (tempRoom.animateNumber < 0) {
				SysBeep(1);
				leaveDlg = false;
				tempInt = -tempRoom.animateNumber;
				if (tempInt > 16) {
					tempInt = 16;
				}
				strTemp = NumToString(tempInt);
				SetIText(dlgItem.v as Handle, strTemp);
			}
			if (tempRoom.animateNumber > 16) {
				SysBeep(1);
				leaveDlg = false;
				strTemp = NumToString(16);
				SetIText(dlgItem.v as Handle, strTemp);
			}

			GetDItem(theDlgPtr, delayEdit, cntlType, dlgItem, tempRect);
			strTemp = GetIText(dlgItem.v as Handle); // Get the text entered
			tempLong = StringToNum(strTemp);
			tempRoom.animateDelay = LoWord(tempLong);
			if (tempRoom.animateDelay < 0) {
				SysBeep(1);
				leaveDlg = false;
				tempInt = -tempRoom.animateDelay;
				if (tempInt > 16) {
					tempInt = 16;
				}
				strTemp = NumToString(tempInt);
				SetIText(dlgItem.v as Handle, strTemp);
			}

			GetDItem(theDlgPtr, nameEdit, cntlType, dlgItem, tempRect);
			strTemp = GetIText(dlgItem.v as Handle); // Get the text entered
			if (Length(strTemp) > 24) {
				strTemp = Copy(strTemp, 1, 24);
			}
			tempRoom.roomName = strTemp;
			// end - with tempRoom

			if (leaveDlg) {
				G.changed = true;
				Object.assign(G.thisRoom, copyRecord(tempRoom));
				DrawRoomNum();
			}
		}

		if (itemHit === cancelBut) {
			if (G.thisHouse.numberORooms < 1) {
				shouldOpen.v = true;
			}
			leaveDlg = true;
		}
	} while (!leaveDlg);

	DisposDialog(theDlgPtr);
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(wasPort);
	}
}

// =================================
