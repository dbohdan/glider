//===========================================================
//
//	       R  O  O  M     E  D  I  T  O  R     1.02
//					For Glider 4.0
//
//			   All code 1991 john calhoun
//
//		Published and © 1991 Casady & Greene, Inc.
//
//===========================================================

// Port of E-GameBody.p, the Room Editor's main program (program RoomEditor; {$I-}): the event loop,
// the mouse in the room and the windows, keys, update and operating system events, and quitting.

import { windoidDef, windoidID } from './Windoid.ts';
import {
	app4Evt,
	type AppFile,
	appPrint,
	autoKey,
	BeginUpdate,
	BitAnd,
	BSR,
	charCodeMask,
	Chr,
	ClosePort,
	CloseCPort,
	ClrAppFiles,
	CountAppFiles,
	DIBadMount,
	diskEvt,
	DisposePalette,
	DisposeWindow,
	DisposPtr,
	div,
	DragWindow,
	EnableItem,
	EndUpdate,
	type EventRecord,
	eventWindow,
	everyEvent,
	ExitToShell,
	FindWindow,
	FrontWindow,
	type GDevice,
	GetAppFiles,
	GetDblTime,
	GetMainDevice,
	GetMenu,
	GetNextEvent,
	GetWRefCon,
	GlobalToLocal,
	HiWord,
	HLock,
	HUnlock,
	inContent,
	inDrag,
	inGoAway,
	InitCursor,
	inMenuBar,
	inSysWindow,
	type Integer,
	keyDown,
	LoWord,
	type LongInt,
	MenuKey,
	MenuSelect,
	mouseDown,
	mouseUp,
	noErr,
	nullEvent,
	Odd,
	type OSErr,
	type Point,
	PtInRect,
	type Rect,
	ref,
	screenBits,
	SelectWindow,
	SetDepth,
	SetPort,
	setWindowDef,
	SetPt,
	ShowWindow,
	StillDown,
	SystemTask,
	TickCount,
	TrackGoAway,
	UnloadSeg,
	updateEvt,
	WaitNextEvent,
	cmdKey,
	type WindowPtr,
} from '../mac/Toolbox.ts';
import {
	editToObject,
	editToRoom,
	fileExists,
	G,
	iSave,
	iSaveAs,
	kDeleteKey,
	kErrNothingToPrint,
	kLeftArrow,
	kRightArrow,
	kTabKey,
	mFile,
	objectDataLayout,
	roomDataLayout,
	sleep,
} from './Globals.ts';
import { PRect, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import { Deselect, DoMarquee, GenericAlert, SameScreenDepth, UpdateMenuItems } from './Utilities.ts';
import { DrawAllObjects, DrawRoomNum, LoadABackground } from './Drawing.ts';
import { DoRoomCondInfo } from './RoomStuff.ts';
import { CloseTools, DoObjectInfo, DoTools, DragHandle, DragObject, OpenTools, UpdateTools } from './ObjectStuff.ts';
import { OpenFile, SavePrefs } from './FileInNOut.ts';
import { InitVariables } from './Initialize.ts';
import { DoClear, DoNewHouse, DoNextRoom, DoOpenHouse, DoPrevRoom, HandleMenu } from './TheMenus.ts';

/** Port: THINK Pascal's `HiWrd`, the high word of a long integer. */
const HiWrd = HiWord;

/** Port: Pascal `SystemClick` passes a click to a desk accessory; the port has none. */
function SystemClick(_theEvent: EventRecord, _theWindow: WindowPtr | null): void {}

let downIsDubl: LongInt = 0;
let eventHappened = false;

//=================================

function UpDateMain(): void {
	DrawRoomNum();
}

/**
 * Port: `thisRoom.theObjects[which].boundRect`, also for which = 0 (no object active), which the
 * double click reads: outside the array, Pascal reads the room's bytes before it, so the record's
 * boundRect is made of tileOrder[7], leftOpen and rightOpen, animateKind, and animateNumber.
 */
function ObjectBoundRect(which: Integer): Rect {
	if (which >= 1) {
		return G.thisRoom.theObjects[which].boundRect;
	}
	const bytes = new Uint8Array(sizeOf(roomDataLayout));
	writeLayout(roomDataLayout, G.thisRoom, bytes, 0);
	const theObjectsAt = sizeOf(roomDataLayout) - 16 * sizeOf(objectDataLayout);
	return readLayout(PRect, bytes, theObjectsAt + (which - 1) * sizeOf(objectDataLayout) + 2);
}

//=================================

async function DoMainWindow(): Promise<void> {
	const thePt: Point = { v: 0, h: 0 };

	//--------------------

	async function DoASimpleClik(): Promise<void> {
		let which: Integer;
		let hitARect: boolean;

		if (StillDown()) {
			if (PtInRect(thePt, G.handleRect)) {
				await DragHandle();
				return;
			}
			hitARect = false;
			for (which = 1; which <= G.thisRoom.numberOObjects; which++) {
				if (PtInRect(thePt, G.thisRoom.theObjects[which].boundRect)) {
					await Deselect();
					G.oneActive = which;
					hitARect = true;
					break;
				}
			}
			if (hitARect) {
				await DragObject(G.oneActive);
				await DrawAllObjects();
				UpdateMenuItems(editToObject);
			} else {
				await Deselect();
				UpdateMenuItems(editToRoom);
			}
		} else {
			hitARect = false;
			for (which = 1; which <= G.thisRoom.numberOObjects; which++) {
				if (PtInRect(thePt, G.thisRoom.theObjects[which].boundRect)) {
					await Deselect();
					G.oneActive = which;
					hitARect = true;
					break;
				}
			}
			if (hitARect) {
				await DrawAllObjects();
				UpdateMenuItems(editToObject);
			} else {
				await Deselect();
				UpdateMenuItems(editToRoom);
			}
		}
	}

	//--------------------

	async function DoADublClik(): Promise<void> {
		let which: Integer;
		let hitARect: boolean;

		if (PtInRect(thePt, ObjectBoundRect(G.oneActive))) {
			await DoObjectInfo();
			UpdateMenuItems(editToObject);
		} else {
			hitARect = false;
			for (which = 1; which <= G.thisRoom.numberOObjects; which++) {
				if (PtInRect(thePt, G.thisRoom.theObjects[which].boundRect)) {
					await Deselect();
					G.oneActive = which;
					hitARect = true;
					break;
				}
			}
			if (hitARect) {
				await DrawAllObjects();
			} else {
				if (G.editRoom) {
					UpdateMenuItems(editToRoom);
					const cancelIt = ref(true);
					await DoRoomCondInfo(cancelIt);
				} else {
					await Deselect();
					UpdateMenuItems(editToRoom);
				}
			}
		}
	}

	//--------------------

	SetPort(G.mainWndo!);
	thePt.v = G.theEvent.where.v;
	thePt.h = G.theEvent.where.h;
	GlobalToLocal(thePt);

	if (G.theEvent.what === mouseDown) {
		if (G.theEvent.when <= downIsDubl) {
			await DoADublClik();
		} else {
			await DoASimpleClik();
		}
	} else if (G.theEvent.what === mouseUp) {
		downIsDubl = G.theEvent.when + GetDblTime();
	}

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}
}

//=================================

async function DoDrag(whichWindow: WindowPtr): Promise<void> {
	let tempRect: Rect;

	await Deselect();
	// (wasRect := whichWindow^.portRect, never read)
	tempRect = { ...screenBits.bounds };
	tempRect.top = tempRect.top + 20;
	await DragWindow(whichWindow, G.theEvent.where, tempRect);
	if (whichWindow === G.toolWndo) {
		ShowWindow(whichWindow);
	}
	if (G.toolWndo !== null) {
		SelectWindow(G.toolWndo);
	}
}

//=================================

async function DoGoAway(whichWindow: WindowPtr): Promise<void> {
	if (G.theEvent.what !== mouseUp) {
		return;
	}
	if (await TrackGoAway(whichWindow, G.theEvent.where)) {
		await Deselect();
		switch (GetWRefCon(whichWindow)) {
			case 1:
				CloseTools();
				break;
			default:
		}
	}
}

//=================================

async function DoInContent(whichWindow: WindowPtr): Promise<void> {
	if (whichWindow !== FrontWindow() && whichWindow !== G.mainWndo) {
		SelectWindow(G.toolWndo!);
	} else {
		switch (GetWRefCon(whichWindow)) {
			case 0:
				await DoMainWindow();
				break;
			case 1:
				await DoTools();
				break;
			default:
		} // case
	}
}

//=================================

async function DoUpdate(): Promise<void> {
	const whichWindow = eventWindow(G.theEvent.message)!;
	SetPort(whichWindow);
	BeginUpdate(whichWindow);
	switch (GetWRefCon(whichWindow)) {
		case 0:
			UpDateMain();
			break;
		case 1:
			await UpdateTools();
			break;
		default:
	}
	EndUpdate(whichWindow);
	await DrawAllObjects();
	DrawRoomNum();
	await UpdateTools();
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}
}

//=================================

async function DoStartUp(): Promise<void> {
	const theMessage = ref<Integer>(0);
	const numDocs = ref<Integer>(0);
	const docInfo: AppFile = { vRefNum: 0, fType: '', versNum: 0, fName: '' };

	CountAppFiles(theMessage, numDocs);
	if (theMessage.v === appPrint) {
		await GenericAlert(kErrNothingToPrint);
		ExitToShell();
	}

	if (numDocs.v === 0) {
		await DoOpenHouse();
		return;
	}

	GetAppFiles(1, docInfo);
	if (docInfo.fType === 'GLhs') {
		if (!(await OpenFile(docInfo.fName, docInfo.vRefNum))) {
			InitCursor();
			await DoNewHouse();
			return;
		}
		InitCursor();

		G.housesName = docInfo.fName;
		G.changed = false;
		G.roomScrapDirty = false;
		G.objectScrapDirty = false;

		G.roomAt = 1;
		G.thisRoom = structuredClone(G.thisHouse.theRooms[G.roomAt]);
		EnableItem(GetMenu(mFile)!, iSave);
		EnableItem(GetMenu(mFile)!, iSaveAs);

		G.oneActive = 0;
		G.handleRect = { ...G.nullRect };

		await LoadABackground(G.thisRoom.backPictID);
		UpdateMenuItems(fileExists);
		UpdateMenuItems(editToRoom);
		await DrawAllObjects();
		DrawRoomNum();

		await OpenTools();
	} else {
		await DoNewHouse();
	}
	ClrAppFiles(1);
}

//=================================

async function DoMouseDown(): Promise<void> {
	const whichWindow = ref<WindowPtr | null>(null);
	let mResult: LongInt;
	let theMenu: Integer;
	let theItem: Integer;

	const code = FindWindow(G.theEvent.where, whichWindow);
	switch (code) {
		case inMenuBar: {
			mResult = await MenuSelect(G.theEvent.where);
			theMenu = HiWord(mResult);
			theItem = LoWord(mResult);
			await HandleMenu(theMenu, theItem);
			break;
		}
		case inGoAway:
			await DoGoAway(whichWindow.v!);
			break;
		case inContent:
			await DoInContent(whichWindow.v!);
			break;
		case inDrag:
			await DoDrag(whichWindow.v!);
			break;
		case inSysWindow:
			SystemClick(G.theEvent, whichWindow.v);
			break;
		default:
	}
}

//=================================

async function DoKeyDown(): Promise<void> {
	let mResult: LongInt;
	let chCode: Integer;
	let theMenu: Integer;
	let theItem: Integer;
	let wasActive: Integer;

	const theEvent = G.theEvent;
	chCode = BitAnd(theEvent.message, charCodeMask);
	if (Odd(div(theEvent.modifiers, cmdKey))) {
		mResult = MenuKey(Chr(chCode));
		theMenu = HiWord(mResult);
		theItem = LoWord(mResult);
		if (theMenu !== 0) {
			await HandleMenu(theMenu, theItem);
		}
	} else {
		switch (chCode) {
			case kTabKey:
				if (G.thisRoom.numberOObjects > 0) {
					wasActive = G.oneActive;
					await Deselect();
					G.oneActive = wasActive + 1;
					if (G.oneActive > G.thisRoom.numberOObjects) {
						G.oneActive = 1;
					}
					UpdateMenuItems(editToObject);
					await DrawAllObjects();
				}
				break;
			case kLeftArrow:
				await DoPrevRoom();
				break;
			case kRightArrow:
				await DoNextRoom();
				break;
			case kDeleteKey:
				await DoClear();
				break;
			default:
		}
	}
}

//=================================

function DoDiskEvent(): void {
	const cornerPt: Point = { v: 0, h: 0 };
	// oxlint-disable-next-line no-unused-vars
	let theErr: OSErr;

	if (HiWrd(G.theEvent.message) !== noErr) {
		SetPt(cornerPt, 85 + G.rightOffset, 50 + G.downOffset);
		theErr = DIBadMount(cornerPt, G.theEvent.message);
	}
}

//=================================

async function DoOSEvent(): Promise<void> {
	switch (BSR(G.theEvent.message, 24)) {
		// high byte of message
		case 1: {
			if (BitAnd(G.theEvent.message, 1) !== 0) {
				G.inBackground = false; // it was a resume event
				if (!SameScreenDepth()) {
					await GenericAlert(23);
				}
			} else {
				G.inBackground = true; // it was a suspend event
			}
			break;
		} // suspendResumeMessage
		default:
	} // CASE
} // osEvt

//=================================

async function CloseUpShop(): Promise<void> {
	const Color = 1;
	const GDTypeFlag = 1;

	let theDevice: GDevice | null;
	// oxlint-disable-next-line no-unused-vars
	let theErr: OSErr;

	//-----------

	// SetDepth: the editor declares the trap inline here; it is the Toolbox's (Devices.ts).

	//-----------

	CloseTools();

	if (G.inColor) {
		DisposePalette(G.mainPalette);
		if (G.mainWndo !== null) {
			DisposeWindow(G.mainWndo);
		}
		CloseCPort(G.objectCPtr!);
		DisposPtr(G.objectCBits);
		CloseCPort(G.virginCPtr!);
		DisposPtr(G.virginCBits);
		CloseCPort(G.loadCPtr!);
		DisposPtr(G.loadCBits);
	} else {
		if (G.mainWndo !== null) {
			DisposeWindow(G.mainWndo);
		}
		// Port: the ports are JavaScript objects; DisposPtr(Ptr(port)) has nothing to free.
		ClosePort(G.offVirginPort!);
		ClosePort(G.offPlayerPort!);
		ClosePort(G.offLoadPort!);
		ClosePort(G.offMaskPort!);
	}

	await SavePrefs();

	if (!G.cantColor && G.restoreColor && !G.cantSwitch) {
		theDevice = GetMainDevice();
		if (theDevice !== null) {
			HLock(theDevice);
			if (theDevice.gdPMap.pixelSize !== G.wasDepth) {
				theErr = SetDepth(theDevice, G.wasDepth, GDTypeFlag, Color);
			}
			HUnlock(theDevice);
		}
	}
}

//=================================

/** The main program. ExitToShell ends it by throwing ExitToShellSignal, which the platform catches. */
export async function main(): Promise<void> {
	// Port: the tool window's definition, WDEF 10 in the editor's resources, is code the port
	// translated (Windoid.ts).
	setWindowDef(windoidID, windoidDef);
	await InitVariables();
	UnloadSeg(InitVariables);
	await DoStartUp();
	downIsDubl = TickCount();

	do {
		if (G.hasWNE) {
			eventHappened = await WaitNextEvent(everyEvent, G.theEvent, sleep, null);
		} else {
			SystemTask();
			eventHappened = await GetNextEvent(everyEvent, G.theEvent);
		}

		if (eventHappened) {
			switch (G.theEvent.what) {
				case nullEvent:
					break;
				case mouseDown:
				case mouseUp:
					await DoMouseDown();
					break;
				case keyDown:
				case autoKey:
					await DoKeyDown();
					break;
				case updateEvt:
					await DoUpdate();
					break;
				case diskEvt: // call DIBadMount in response to a diskEvt
					DoDiskEvent();
					break;
				case app4Evt:
					await DoOSEvent();
					break;
				default:
			} // case
		}

		if (G.marqueeTime && !G.inBackground) {
			await DoMarquee();
		}
	} while (!G.doneFlag); // End of the event loop

	await CloseUpShop();
} // End of the program
