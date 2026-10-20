// Port of E-TheMenus.p: the editor's menu commands: houses (new, open, close, save, quit), rooms
// (go to, previous, next, new), the Edit menu's cut, copy, paste, and clear, and the help window.

import {
	blueColor,
	CheckItem,
	dBoxProc,
	EnableItem,
	EraseRect,
	GetItem,
	GetMenu,
	GetPort,
	HiliteMenu,
	type Integer,
	OffsetRect,
	OpenDeskAcc,
	type Rect,
	redColor,
	ref,
	SetItem,
	SetPort,
	SetRect,
} from '../mac/Toolbox.ts';
import { AboutMainCenter, AboutMsg, AboutTEXT, BuildAbout, newAboutRec } from './About.ts';
import {
	editToRoom,
	fileExists,
	fileIsNew,
	G,
	iAboutEdit,
	iAutoHideTools,
	iClear,
	iClose,
	iConfigure,
	iControls,
	iCopy,
	iCut,
	iGoToRoom,
	iHelp,
	iHoldKey,
	iHouse,
	iNew,
	iNewRoom,
	iNextRoom,
	iNothing,
	iObject,
	iOpen,
	iPaste,
	iPrevRoom,
	iQuit,
	iRelMouse,
	iRestoreDeep,
	iRoomBack,
	iRoomCond,
	iSave,
	iSaveAs,
	iTools,
	iTryGlider,
	mApple,
	mControls,
	mEdit,
	mFile,
	mSpecial,
	mWindows,
	noFileOpen,
} from './Globals.ts';
import { Deselect, DoAbout, DoCustomizeKeys, UpdateMenuItems } from './Utilities.ts';
import { DrawAllObjects, DrawRoomNum, LoadABackground } from './Drawing.ts';
import { DeleteRoom, DoHouseInfo, ErrorCheckHouse, InsertRoom } from './HouseStuff.ts';
import { DoGotoDial, DoRoomBackInfo, DoRoomCondInfo, FlushRoom, InsertNewRoom, SortObjects } from './RoomStuff.ts';
import { CloseTools, DoObjectInfo, InsertObject, OpenTools } from './ObjectStuff.ts';
import { DoClose, DoOpen, DoSave, DoSaveAs, SaveFirst, SaveNoClose } from './FileInNOut.ts';
import { FlyGlider } from './FlyGlider.ts';

/** Port: Balloons.p's kHMHelpMenuID, the System 7 Help menu's ID. */
const kHMHelpMenuID = -16490;

//=================================

// oxlint-disable-next-line no-unused-vars
function DoTest(): void {}

//=================================

export async function DoOpenHouse(): Promise<void> {
	if (!(await DoOpen())) {
		await DoNewHouse();
		return;
	}

	await ErrorCheckHouse();

	G.changed = false;

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
}

//=================================

export async function DoNewHouse(): Promise<void> {
	let index: Integer;

	G.roomAt = 1;
	FlushRoom(G.thisRoom);

	{
		const thisHouse = G.thisHouse;
		thisHouse.version = 0x0100;
		thisHouse.numberORooms = 0;
		for (index = 0; index <= 19; index++) {
			thisHouse.hiScores[index] = 0;
			thisHouse.hiLevel[index] = 0;
			thisHouse.hiName[index] = 'no one...';
			thisHouse.hiRoom[index] = 'no room...';
		}
		thisHouse.pictFile = G.resourceName;
		thisHouse.nextFile = '';
		thisHouse.firstFile = '';
		thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);
	}

	G.changed = false;

	G.oneActive = 0;
	G.handleRect = { ...G.nullRect };
	G.thisHouse.numberORooms = 1;

	const cancelIt = ref(false);
	await DoRoomBackInfo(cancelIt);
	await LoadABackground(G.thisRoom.backPictID);
	UpdateMenuItems(fileIsNew);
	UpdateMenuItems(editToRoom);

	await OpenTools();
}

//=================================

async function DoMenuClose(): Promise<void> {
	const saveBut = 1;
	const cancelBut = 6;

	let buttonClicked: Integer;
	// oxlint-disable-next-line no-unused-vars
	let dummyBool: boolean;

	await Deselect();
	if (G.changed) {
		buttonClicked = await SaveNoClose();
		if (buttonClicked === saveBut) {
			G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);
			if (G.fileIsOpen) {
				if (!(await DoSaveHouse())) {
					dummyBool = await DoClose();
					return;
				}
				dummyBool = await DoClose();
			} else {
				if (!(await DoSaveHouseAs())) {
					return;
				}
			}
		} else if (buttonClicked === cancelBut) {
			return;
		} else {
			dummyBool = await DoClose();
		}
	} else {
		dummyBool = await DoClose();
	}

	FlushRoom(G.thisRoom);
	G.roomAt = 0;
	G.changed = false;

	SetPort(G.mainWndo!);
	EraseRect(G.wholeArea);
	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	EraseRect(G.wholeArea);
	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	EraseRect(G.wholeArea);

	CloseTools();
	UpdateMenuItems(noFileOpen);
}

//=================================

async function DoGoToRoom(): Promise<void> {
	let wasRoom: Integer;

	G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);
	wasRoom = G.roomAt;
	await DoGotoDial();
	if (wasRoom !== G.roomAt) {
		G.thisRoom = structuredClone(G.thisHouse.theRooms[G.roomAt]);
		await Deselect();
		await LoadABackground(G.thisRoom.backPictID);
		await DrawAllObjects();
		DrawRoomNum();
		UpdateMenuItems(editToRoom);
	}
}

//=================================

export async function DoPrevRoom(): Promise<void> {
	G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);
	G.roomAt = G.roomAt - 1;
	if (G.roomAt < 1) {
		G.roomAt = G.thisHouse.numberORooms;
	}
	G.thisRoom = structuredClone(G.thisHouse.theRooms[G.roomAt]);
	await Deselect();
	await LoadABackground(G.thisRoom.backPictID);
	await DrawAllObjects();
	DrawRoomNum();
	UpdateMenuItems(editToRoom);
}

//=================================

export async function DoNextRoom(): Promise<void> {
	G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);
	G.roomAt = G.roomAt + 1;
	if (G.roomAt > G.thisHouse.numberORooms) {
		G.roomAt = 1;
	}
	G.thisRoom = structuredClone(G.thisHouse.theRooms[G.roomAt]);
	await Deselect();
	await LoadABackground(G.thisRoom.backPictID);
	await DrawAllObjects();
	DrawRoomNum();
	UpdateMenuItems(editToRoom);
}

//=================================

export async function DoNewRoom(): Promise<void> {
	G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);
	if (!(await InsertNewRoom())) {
		return;
	}

	const cancelIt = ref(true);
	G.changed = true;
	await DoRoomBackInfo(cancelIt);
	await LoadABackground(G.thisRoom.backPictID);
	DrawRoomNum();
	G.oneActive = 0;

	UpdateMenuItems(editToRoom);
}

//=================================

export async function DoSaveHouse(): Promise<boolean> {
	let dummyBool: boolean;

	G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);

	await ErrorCheckHouse();

	dummyBool = await DoSave();
	return dummyBool;
}

//=================================

export async function DoSaveHouseAs(): Promise<boolean> {
	let dummyBool: boolean;

	G.thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom);

	await ErrorCheckHouse();

	dummyBool = await DoSaveAs();

	return dummyBool;
}

//=================================

async function DoQuit(): Promise<void> {
	const saveBut = 1;
	const quitBut = 2;
	const cancelBut = 6;

	let buttonClicked: Integer;
	// oxlint-disable-next-line no-unused-vars
	let dummyBool: boolean;

	if (G.changed) {
		buttonClicked = await SaveFirst();

		if (buttonClicked === saveBut) {
			if (G.fileIsOpen) {
				if (await DoSaveHouse()) {
					G.doneFlag = true;
					dummyBool = await DoClose();
				} else {
					return;
				}
			} else {
				// else - file is NOT open
				if (await DoSaveHouseAs()) {
					G.doneFlag = true;
					dummyBool = await DoClose();
				} else {
					return;
				}
			}
		} else if (buttonClicked === quitBut) {
			if (G.fileIsOpen) {
				dummyBool = await DoClose();
			}
			G.doneFlag = true;
		} else if (buttonClicked === cancelBut) {
			return;
		}
	} else {
		// else - no changes
		if (G.fileIsOpen) {
			dummyBool = await DoClose();
		}
		G.doneFlag = true;
	}
}

//=================================

async function DoHelp(): Promise<void> {
	const aboutStuff = newAboutRec();
	const tempR: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	const wasPort = GetPort();
	SetPort(G.mainWndo!);
	aboutStuff.FontInfo[AboutMsg]!.Font = 0;
	aboutStuff.FontInfo[AboutMsg]!.Size = 0;
	aboutStuff.FontInfo[AboutMsg]!.Face = 0; // []
	aboutStuff.FontInfo[AboutMsg]!.Color = redColor;
	aboutStuff.FontInfo[AboutTEXT]!.Font = 1;
	aboutStuff.FontInfo[AboutTEXT]!.Size = 9;
	aboutStuff.FontInfo[AboutTEXT]!.Face = 0; // []
	aboutStuff.FontInfo[AboutTEXT]!.Color = blueColor;
	aboutStuff.TEXTCopy = true;
	aboutStuff.KeyEquivs = true;
	aboutStuff.CloseBox = false;
	aboutStuff.Styled = true;
	aboutStuff.CenterMode = AboutMainCenter;
	aboutStuff.MainIcon = 128;
	aboutStuff.ClickIcon = 129;
	aboutStuff.ClickMsg = 'by john calhoun  © 1991 Casady & Greene, Inc.';
	SetRect(tempR, 12, 30, 500, 332);
	OffsetRect(tempR, G.rightOffset, G.downOffset);
	await BuildAbout(tempR, dBoxProc, 128, 'Editor Help', 'Room Editor 1.0 - General Help', aboutStuff);
	SetPort(wasPort);
}

//=================================

async function DoCut(): Promise<void> {
	if (G.editRoom) {
		// no object selected
		// so, cut whole room
		if (!DeleteRoom()) {
			G.scrapRoom = structuredClone(G.thisRoom); // store room just cut
			FlushRoom(G.thisRoom); // flush it
			const cancelIt = ref(false); // force user to create a room
			await DoRoomBackInfo(cancelIt);
		} else {
			G.roomScrapDirty = true;
			G.objectScrapDirty = false;
			SetItem(GetMenu(mEdit)!, iPaste, 'Paste Room');
			EnableItem(GetMenu(mEdit)!, iPaste);
			G.scrapRoom = structuredClone(G.thisRoom);
			G.thisRoom = structuredClone(G.thisHouse.theRooms[G.roomAt]);
		}
		await LoadABackground(G.thisRoom.backPictID); // load the new room in
		G.oneActive = 0; // insure no active object
		G.handleRect = { ...G.nullRect };
		await DrawAllObjects();
		DrawRoomNum();
		G.changed = true;
	} else {
		G.objectScrapDirty = true;
		G.roomScrapDirty = false;
		SetItem(GetMenu(mEdit)!, iPaste, 'Paste Object');
		EnableItem(GetMenu(mEdit)!, iPaste);
		G.scrapObject = structuredClone(G.thisRoom.theObjects[G.oneActive]);
		G.thisRoom.theObjects[G.oneActive].objectIs = 0;
		await Deselect(); // Sort will set correct # of objects
		SortObjects(); // 0-ing out the type will kill it in the sort routine
		await DrawAllObjects();
		G.changed = true;
	}
}

//=================================

function DoCopy(): void {
	if (G.editRoom) {
		G.scrapRoom = structuredClone(G.thisRoom);
		G.roomScrapDirty = true;
		G.objectScrapDirty = false;
		SetItem(GetMenu(mEdit)!, iPaste, 'Paste Room');
		EnableItem(GetMenu(mEdit)!, iPaste);
	} else {
		G.scrapObject = structuredClone(G.thisRoom.theObjects[G.oneActive]);
		G.objectScrapDirty = true;
		G.roomScrapDirty = false;
		SetItem(GetMenu(mEdit)!, iPaste, 'Paste Object');
		EnableItem(GetMenu(mEdit)!, iPaste);
	}
}

//=================================

async function DoPaste(): Promise<void> {
	if (G.roomScrapDirty) {
		if (!(await InsertRoom())) {
			return;
		}
		await LoadABackground(G.thisRoom.backPictID); // draw the pasted room in
		G.oneActive = 0; // insure no active object
		G.handleRect = { ...G.nullRect };
		await DrawAllObjects();
		DrawRoomNum();
		G.changed = true;
	} else {
		if (await InsertObject()) {
			SortObjects();
			await DrawAllObjects();
			G.changed = true;
		} else {
			return;
		}
	}
}

//=================================

export async function DoClear(): Promise<void> {
	if (G.editRoom) {
		if (!DeleteRoom()) {
			FlushRoom(G.thisRoom); // flush it
			const cancelIt = ref(false); // force user to create a room
			await DoRoomBackInfo(cancelIt);
		} else {
			G.thisRoom = structuredClone(G.thisHouse.theRooms[G.roomAt]);
		}
		await LoadABackground(G.thisRoom.backPictID); // load the new room in
		G.oneActive = 0; // insure no active object
		G.handleRect = { ...G.nullRect };
		await DrawAllObjects();
		DrawRoomNum();
		G.changed = true;
	} else {
		G.thisRoom.theObjects[G.oneActive].objectIs = 0;
		await Deselect();
		SortObjects();
		await DrawAllObjects();
		G.changed = true;
	}
}

//=================================

export async function HandleMenu(theMenu: Integer, theItem: Integer): Promise<void> {
	// Handle menu selections realtime
	// oxlint-disable-next-line no-unused-vars
	let DNA: Integer; // the desk accessory's reference number, unused as in the original
	let i: Integer;
	let DAName: string;
	const cancelIt = ref(false);

	switch (theMenu) {
		case mApple:
			switch (theItem) {
				case iNothing:
					break;
				case iAboutEdit:
					await DoAbout();
					break;
				default: {
					const SavePort = GetPort();
					DAName = GetItem(GetMenu(mApple)!, theItem);
					DNA = OpenDeskAcc(DAName);
					SetPort(SavePort);
				}
			}
			break;

		case mFile:
			switch (theItem) {
				// Handle all commands in this menu list
				case iNew:
					await DoNewHouse();
					break;
				case iOpen:
					await DoOpenHouse();
					break;
				case iClose:
					await DoMenuClose();
					break;
				case iSave:
					cancelIt.v = await DoSaveHouse();
					break;
				case iSaveAs:
					cancelIt.v = await DoSaveHouseAs();
					break;
				case iQuit:
					await DoQuit();
					break;
				default:
			}
			break;

		case mEdit:
			switch (theItem) {
				// Handle all commands in this menu list
				case iCut:
					await DoCut();
					break;
				case iCopy:
					DoCopy();
					break;
				case iPaste:
					await DoPaste();
					break;
				case iClear:
					await DoClear();
					break;
				default:
			}
			break;

		case mSpecial:
			switch (theItem) {
				// Handle all commands in this menu list
				case iTryGlider:
					await FlyGlider();
					break;
				case iControls:
					break;
				case iRestoreDeep: {
					G.restoreColor = !G.restoreColor;
					if (G.restoreColor) {
						SetItem(GetMenu(mSpecial)!, iRestoreDeep, 'Depth Restore is On');
					} else {
						SetItem(GetMenu(mSpecial)!, iRestoreDeep, 'Depth Restore is Off');
					}
					break;
				}
				case iGoToRoom:
					await DoGoToRoom();
					break;
				case iNextRoom:
					await DoNextRoom();
					break;
				case iPrevRoom:
					await DoPrevRoom();
					break;
				case iNewRoom:
					await DoNewRoom();
					break;
				default:
			}
			break;

		case mWindows:
			switch (theItem) {
				// Handle all commands in this menu list
				case iTools:
					await OpenTools();
					break;
				case iAutoHideTools: {
					G.autoHide = !G.autoHide;
					if (G.autoHide) {
						SetItem(GetMenu(mWindows)!, iAutoHideTools, 'Auto-Hide Tools is On');
					} else {
						SetItem(GetMenu(mWindows)!, iAutoHideTools, 'Auto-Hide Tools is Off');
					}
					break;
				}
				case iHouse:
					await DoHouseInfo();
					break;
				case iRoomBack: {
					cancelIt.v = true;
					await DoRoomBackInfo(cancelIt);
					await LoadABackground(G.thisRoom.backPictID);
					await DrawAllObjects();
					break;
				}
				case iRoomCond: {
					cancelIt.v = true;
					await DoRoomCondInfo(cancelIt);
					await DrawAllObjects();
					break;
				}
				case iObject:
					await DoObjectInfo();
					break;
				case iHelp:
					await DoHelp();
					break;
				default:
			}
			break;

		case mControls:
			if (theItem >= iHoldKey && theItem <= iRelMouse) {
				for (i = iHoldKey; i <= iRelMouse; i++) {
					CheckItem(GetMenu(mControls)!, i, false);
				}
				CheckItem(GetMenu(mControls)!, theItem, true);
				G.controlMethod = theItem;
			} else if (theItem === iConfigure) {
				await DoCustomizeKeys();
			}
			break;

		case kHMHelpMenuID:
			if (theItem === G.iGlidersHelp) {
				await DoHelp();
			}
			break;

		default:
	}
	HiliteMenu(0);
}
