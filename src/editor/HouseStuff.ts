// Port of E-HouseStuff.p: inserting and deleting rooms, the House Info dialog, and checking a house for errors.

import {
	Alert,
	Concat,
	Copy,
	CopyBits,
	div,
	DisposDialog,
	DrawString,
	EraseRect,
	FrameRect,
	FrameRoundRect,
	GetDItem,
	GetIText,
	GetKeys,
	GetNewDialog,
	GetPort,
	type GrafPtr,
	type Handle,
	inFront,
	InitCursor,
	InsetRect,
	type Integer,
	type ItemHandle,
	Line,
	ModalDialog,
	MoveTo,
	MoveWindow,
	NumToString,
	PenNormal,
	PenSize,
	type Rect,
	ref,
	SelectWindow,
	SelIText,
	SetIText,
	SetPort,
	SetRect,
	ShowWindow,
	srcCopy,
	TextFont,
	TextSize,
} from '../mac/Toolbox.ts';
import { zeroOf } from '../mac/PascalLayout.ts';
import { G, houseInfoID, kErrTooManyRooms, kErrWrongHouseVers, lockAlertID, roomDataLayout } from './Globals.ts';
import { GenericAlert, SpinBall } from './Utilities.ts';

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });

// =================================

export function DeleteRoom(): boolean {
	const thisHouse = G.thisHouse;

	// DeleteRoom := FALSE, assume error
	if (G.roomAt < thisHouse.numberORooms) {
		// if not on last room
		for (let last = thisHouse.numberORooms, i = G.roomAt; i <= last; i++) {
			// Port: the last pass reads the room after the last one; with 40 rooms that is past the
			// end of the array, in whatever the original's memory holds after thisHouse. Here it is
			// a zeroed room.
			const next = thisHouse.theRooms[i + 1];
			thisHouse.theRooms[i] = next === undefined ? zeroOf(roomDataLayout) : structuredClone(next); // shift rooms left
		}
	}
	thisHouse.numberORooms = thisHouse.numberORooms - 1; // subtract 1 from #
	if (G.roomAt > 1) {
		G.roomAt = G.roomAt - 1; // preceding room is activated
	} else {
		G.roomAt = 1;
		if (thisHouse.numberORooms <= 1) {
			// if only one room
			thisHouse.numberORooms = 1; // we'll call up the dlg
			return false; // for creating a room
		}
	}
	return true;
}

// =================================

export async function InsertRoom(): Promise<boolean> {
	const thisHouse = G.thisHouse;

	if (thisHouse.numberORooms >= 40) {
		// trying to add 41 rooms
		await GenericAlert(kErrTooManyRooms);
		return false;
	}
	thisHouse.theRooms[G.roomAt] = structuredClone(G.thisRoom); // insert room to date
	if (G.roomAt < thisHouse.numberORooms) {
		// shift only if in middle
		for (let last = G.roomAt + 1, i = thisHouse.numberORooms; i >= last; i--) {
			thisHouse.theRooms[i + 1] = structuredClone(thisHouse.theRooms[i]!); // shift rooms right
		}
	}
	G.roomAt = G.roomAt + 1; // kick roomAt over to right
	thisHouse.theRooms[G.roomAt] = structuredClone(G.scrapRoom); // copy scrap into house
	G.thisRoom = structuredClone(thisHouse.theRooms[G.roomAt]!); // get copy for active room
	thisHouse.numberORooms = thisHouse.numberORooms + 1; // one more room
	return true;
}

// =================================

function DoFlushScores(): void {
	for (let i = 0; i <= 19; i++) {
		G.thisHouse.hiScores[i] = 0;
		G.thisHouse.hiLevel[i] = 0;
		G.thisHouse.hiName[i] = 'no one...';
		G.thisHouse.hiRoom[i] = 'no room...';
	}
}

// =================================

export async function DoHouseInfo(): Promise<void> {
	const okayBut = 1;
	const nameStat = 2;
	const numOfStat = 3;
	const versStat = 4;
	const backStat = 5;
	const firstEdit = 6;
	const nextEdit = 7;
	const flushBut = 8;
	const lockBut = 17;
	const cancelBut = 18;

	let leaveDlg: boolean;
	let willLockIt: boolean;
	const tempRect: Rect = rect();
	const cntlType = ref<Integer>(0);
	// Port: index, cntlHand and tempCntlHand are declared but never used.
	let itemHit: Integer;
	let tempInt: Integer;
	const dlgItem = ref<ItemHandle>(null);
	let tempStr: string;
	let tempStr2: string;

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

		GetKeys(G.theKeys);
		if (G.theKeys[0x37]) {
			MoveTo(5, 37);
			tempStr = NumToString(G.thisHouse.timeStamp);
			DrawString(tempStr);
		}
	}

	// -------------------------

	const wasPort: GrafPtr = GetPort();
	const theDlgPtr = GetNewDialog(houseInfoID, null, inFront)!;
	const rightOff: Integer = G.rightOffset - theDlgPtr.portBits.bounds.left;
	const downOff: Integer = G.downOffset - theDlgPtr.portBits.bounds.top;
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	GetDItem(theDlgPtr, nameStat, cntlType, dlgItem, tempRect);
	SetIText(dlgItem.v as Handle, G.housesName);
	{
		const thisHouse = G.thisHouse;
		tempStr = NumToString(thisHouse.numberORooms); // pop in number of rooms
		GetDItem(theDlgPtr, numOfStat, cntlType, dlgItem, tempRect);
		SetIText(dlgItem.v as Handle, tempStr);
		tempInt = div(thisHouse.version, 256); // compute version number
		tempStr = NumToString(tempInt);
		tempInt = thisHouse.version % 256;
		tempStr2 = NumToString(tempInt);
		tempStr = Concat(tempStr, '.', tempStr2); // and pop it in
		GetDItem(theDlgPtr, versStat, cntlType, dlgItem, tempRect);
		SetIText(dlgItem.v as Handle, tempStr);
		GetDItem(theDlgPtr, backStat, cntlType, dlgItem, tempRect);
		SetIText(dlgItem.v as Handle, thisHouse.pictFile); // pop in background file
		GetDItem(theDlgPtr, firstEdit, cntlType, dlgItem, tempRect);
		SetIText(dlgItem.v as Handle, thisHouse.firstFile); // pop in first house file
		GetDItem(theDlgPtr, nextEdit, cntlType, dlgItem, tempRect);
		SetIText(dlgItem.v as Handle, thisHouse.nextFile); // pop in next house file
	}
	willLockIt = G.lockIt;

	Redraw();
	leaveDlg = false;
	SelIText(theDlgPtr, nextEdit, 0, 32);

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		if (itemHit === okayBut) {
			leaveDlg = true;

			GetDItem(theDlgPtr, firstEdit, cntlType, dlgItem, tempRect);
			tempStr = GetIText(dlgItem.v as Handle); // Get text entered for first file
			G.thisHouse.firstFile = Copy(tempStr, 1, 32);

			GetDItem(theDlgPtr, nextEdit, cntlType, dlgItem, tempRect);
			tempStr = GetIText(dlgItem.v as Handle); // Get text entered for next file
			G.thisHouse.nextFile = Copy(tempStr, 1, 32);

			G.lockIt = willLockIt;

			G.changed = true;
		}

		if (itemHit === cancelBut) {
			leaveDlg = true;
		}

		if (itemHit === lockBut) {
			if ((await Alert(lockAlertID, null)) === 1) {
				willLockIt = true;
			}
		}

		if (itemHit === flushBut) {
			DoFlushScores();
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

export async function ErrorCheckHouse(): Promise<void> {
	const roomUnnamed = 1;
	const tooManyObs = 2;
	const badPictID = 3;
	const badAnimKind = 4;
	const badAnimNum = 5;
	const badAnimDelay = 6;
	const badRoomCond = 7;

	interface problem {
		howMany: Integer;
		/** array[1..40] of Boolean */
		whichOnes: boolean[];
	}

	/** problemTally = array[roomUnnamed..badRoomCond] of problem */
	const theProblems: problem[] = [];
	for (let i = roomUnnamed; i <= badRoomCond; i++) {
		theProblems[i] = { howMany: 0, whichOnes: [] };
	}

	const progR: Rect = rect();

	SetPort(G.mainWndo!);
	PenNormal();
	TextFont(0);
	TextSize(12);
	PenSize(2, 2);
	SetRect(progR, 156, 100, 356, 130);

	// check house record
	EraseRect(progR);
	FrameRect(progR);
	MoveTo(progR.left + 20, progR.bottom - 10);
	DrawString('Checking House…');

	{
		const thisHouse = G.thisHouse;
		SpinBall();
		if (thisHouse.version > 0x01ff) {
			await GenericAlert(kErrWrongHouseVers);
			EraseRect(progR);
			FrameRect(progR);
			MoveTo(progR.left + 20, progR.bottom - 10);
			DrawString('Checking House…');
		}
		SpinBall();
		if (thisHouse.numberORooms < 1 || thisHouse.numberORooms > 40) {
			await GenericAlert(18);
			EraseRect(progR);
			FrameRect(progR);
			MoveTo(progR.left + 20, progR.bottom - 10);
			DrawString('Checking House…');
		}

		// check room records
		EraseRect(progR);
		FrameRect(progR);
		MoveTo(progR.left + 20, progR.bottom - 10);
		DrawString('Checking Rooms…');

		for (let i = roomUnnamed; i <= badRoomCond; i++) {
			const theProblem = theProblems[i]!;
			theProblem.howMany = 0;
			for (let i2 = 1; i2 <= 40; i2++) {
				theProblem.whichOnes[i2] = false;
			}
		}

		for (let last = thisHouse.numberORooms, i = 1; i <= last; i++) {
			// Port: a house that claims more than 40 rooms (the alert above lets the check go on) has
			// the original read past the array, into whatever memory follows thisHouse; here those
			// rooms read as zeroed rooms.
			const theRoom = thisHouse.theRooms[i] ?? zeroOf(roomDataLayout);
			SpinBall();
			if (theRoom.roomName === '') {
				const theProblem = theProblems[roomUnnamed]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
			SpinBall();
			if (theRoom.numberOObjects < 0 || theRoom.numberOObjects > 16) {
				const theProblem = theProblems[tooManyObs]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
			SpinBall();
			if (theRoom.backPictID < 200 || theRoom.backPictID > 209) {
				const theProblem = theProblems[badPictID]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
			SpinBall();
			if (theRoom.animateKind < 0 || theRoom.animateKind > 3) {
				const theProblem = theProblems[badAnimKind]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
			SpinBall();
			if (theRoom.animateNumber < 0 || theRoom.animateNumber > 16) {
				const theProblem = theProblems[badAnimNum]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
			SpinBall();
			if (theRoom.animateDelay < 0) {
				const theProblem = theProblems[badAnimDelay]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
			SpinBall();
			if (theRoom.conditionCode < 0 || theRoom.conditionCode > 2) {
				const theProblem = theProblems[badRoomCond]!;
				theProblem.howMany = theProblem.howMany + 1;
				theProblem.whichOnes[i] = true;
			}
		}

		InitCursor();

		for (let i = roomUnnamed; i <= badRoomCond; i++) {
			if (theProblems[i]!.howMany !== 0) {
				await GenericAlert(19);
				break;
			}
		}
	}

	if (G.inColor) {
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, progR, progR, srcCopy, G.mainWndo!.visRgn);
	} else {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, progR, progR, srcCopy, G.mainWndo!.visRgn);
	}

	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	}
}
