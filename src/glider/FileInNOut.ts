// Port of G-FileInNOut.p: opening, reading, and writing houses and saved games.

import {
	Alert,
	Create,
	type DialogPtr,
	type FileParam,
	FlushVol,
	fnfErr,
	FSClose,
	FSOpen,
	FSRead,
	FSWrite,
	fsFromStart,
	GetDItem,
	GetFInfo,
	GetIndString,
	Get1Resource,
	type Handle,
	HNoPurge,
	HPurge,
	InitCursor,
	type Integer,
	type ItemHandle,
	type LongInt,
	newFInfo,
	newSFReply,
	noErr,
	NumToString,
	OffsetRect,
	type OSErr,
	ParamText,
	type Point,
	type Rect,
	type Ref,
	ref,
	screenBits,
	SetEOF,
	SetFPos,
	SetIText,
	SetPt,
	SetVol,
	SFPGetFile,
	SFPutFile,
	type SFTypeList,
	UseResFile,
	div,
	pString,
	Concat,
	dskFulErr,
	wPrErr,
	fLckdErr,
	vLckdErr,
	fBsyErr,
	opWrErr,
	eofErr,
} from '../mac/Toolbox.ts';
import { PArray, PBoolean, PInteger, PLongInt, PRecord, PRect, PString, readLayout, sizeOf, writeLayout, zeroOf } from '../mac/PascalLayout.ts';
import {
	airOnIt,
	awardIt,
	bandIt,
	DemoVersion,
	energizeIt,
	extraIt,
	G,
	houseRecLayout,
	kArtType,
	kErrExitSansHouse,
	kErrFileExists,
	kErrGameOldVers,
	kErrHouseModified,
	kErrLoadingRes,
	kErrNotDemoHouse,
	kErrWrongHouseVers,
	kGameType,
	kGlideVersion,
	kHouseType,
	lightIt,
	rCustGetID,
	rFileAlertID,
	rFileStrIDs,
	rMiscStrID,
} from './Globals.ts';
import { CalcRoomScore, GenericAlert, SpinBall } from './GlobalUtils.ts';

const dlgTop = 50;
const dlgLeft = 85;

let typeIs: Integer = 0;

/** Port: a var parameter that is one of G's variables. */
function varOf<K extends keyof typeof G>(key: K): Ref<(typeof G)[K]> {
	return {
		get v() {
			return G[key];
		},
		set v(x) {
			G[key] = x;
		},
	};
}

// =================================

export function ErrorCheckFile(): boolean {
	let nRooms: Integer;
	let index: Integer;

	const thisHouse = G.thisHouse;
	nRooms = thisHouse.numberORooms;
	if (nRooms < 1 || nRooms > 40) {
		// check for valid # of rooms
		return false;
	}

	for (index = 1; index <= nRooms; index++) {
		// check PICT ID numbers
		if (thisHouse.theRooms[index]!.backPictID < 200 || thisHouse.theRooms[index]!.backPictID > 215) {
			return false;
		}
	}

	return true;
}

// =================================

async function IOCheck(theErr: OSErr): Promise<OSErr> {
	let dummyInt: Integer;
	let line1 = '';
	let line2: string;
	let alertRect: Rect;

	InitCursor();
	UseResFile(G.gliderResNum);
	if (theErr !== noErr) {
		switch (theErr) {
			case dskFulErr:
				line1 = GetIndString(rFileStrIDs, 1);
				break;
			case fnfErr: {
				G.fileWasLost = true;
				line1 = GetIndString(rFileStrIDs, 2);
				break;
			}
			case wPrErr:
				line1 = GetIndString(rFileStrIDs, 3);
				break;
			case fLckdErr:
				line1 = GetIndString(rFileStrIDs, 4);
				break;
			case vLckdErr:
				line1 = GetIndString(rFileStrIDs, 5);
				break;
			case fBsyErr:
			case opWrErr:
				line1 = GetIndString(rFileStrIDs, 6);
				break;
			case eofErr:
				line1 = GetIndString(rFileStrIDs, 7);
				break;
			default:
				line1 = GetIndString(rFileStrIDs, 10);
		}

		line2 = NumToString(theErr);
		line2 = Concat('Error code = ', line2);
		ParamText(line1, line2, '', '');
		const alertHandle = Get1Resource('ALRT', rFileAlertID);
		if (alertHandle !== null) {
			HNoPurge(alertHandle);
			// Port: the ALRT's boundsRect is the first field of its bytes.
			alertRect = readLayout(PRect, alertHandle.data, 0);
			OffsetRect(alertRect, -alertRect.left, -alertRect.top);
			dummyInt = div(screenBits.bounds.right - alertRect.right, 2);
			OffsetRect(alertRect, dummyInt, 0);
			dummyInt = div(screenBits.bounds.bottom - alertRect.bottom, 3);
			OffsetRect(alertRect, 0, dummyInt);
			writeLayout(PRect, alertRect, alertHandle.data, 0);
			HPurge(alertHandle);
		}
		dummyInt = await Alert(rFileAlertID, null);
	}

	return theErr;
}

// =================================

/** Port: FSRead into G.thisHouse: the record's bytes are read into and read back. */
function readHouse(refNum: Integer, count: Ref<LongInt>): OSErr {
	const buffer = new Uint8Array(sizeOf(houseRecLayout));
	writeLayout(houseRecLayout, G.thisHouse, buffer, 0);
	const err = FSRead(refNum, count, buffer);
	Object.assign(G.thisHouse, readLayout(houseRecLayout, buffer, 0)); // Port: in place, as Pascal reads into the record
	return err;
}

export async function OpenHouse(): Promise<boolean> {
	const textLength = ref<LongInt>(0);

	G.theErr = SetVol(null, G.houseVolNum);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	G.theErr = FSOpen(G.housesName, G.houseVolNum, varOf('houseNumber'));
	if ((await IOCheck(G.theErr)) !== 0) {
		if (!(await DoOpen(kHouseType))) {
			G.playing = false;
			G.theErr = FSClose(G.houseNumber);
			return false;
		}
		G.theErr = FSOpen(G.housesName, G.houseVolNum, varOf('houseNumber'));
		if ((await IOCheck(G.theErr)) !== 0) {
			G.playing = false;
			G.theErr = FSClose(G.houseNumber);
			return false;
		}
	}

	G.theErr = SetFPos(G.houseNumber, fsFromStart, 0);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.playing = false;
		G.theErr = FSClose(G.houseNumber);
		return false;
	}

	textLength.v = sizeOf(houseRecLayout);

	G.theErr = readHouse(G.houseNumber, textLength);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.playing = false;
		G.theErr = FSClose(G.houseNumber);
		return false;
	}

	return true;
}

// =================================

async function OpenSFGetHook(theSFitem: Integer, theDialog: DialogPtr): Promise<Integer> {
	const statText = 11; // DITL item number of textAppButton
	const firstTime = -1;
	const itemToChange = ref<ItemHandle>(null); // needed for GetDItem and SetCtlValue
	const itemBox: Rect = { top: 0, left: 0, bottom: 0, right: 0 }; // needed for GetDItem
	const itemType = ref<Integer>(0); // needed for GetDItem
	let statTitle: string; // needed for GetIndString

	switch (theSFitem) {
		case firstTime: {
			statTitle = GetIndString(rMiscStrID, typeIs);
			if (statTitle !== '') {
				// if we really got the resource
				GetDItem(theDialog, statText, itemType, itemToChange, itemBox);
				SetIText(itemToChange.v as Handle, statTitle);
			} else {
				await GenericAlert(kErrLoadingRes);
			}
			break;
		} // firstTime
		default:
	}
	return theSFitem;
}

// =================================

function SimpleFileFilter(p: FileParam): boolean {
	const houseType = 1;
	const artType = 2;
	const gameType = 3;

	let result = true; // Don't show it -- default
	const fdType = p.ioFlFndrInfo.fdType;
	switch (typeIs) {
		case houseType:
			if (fdType === 'GLhs') {
				result = false; // Show it
			}
			break;
		case artType:
			if (fdType === 'GLbk') {
				result = false; // Show it
			}
			break;
		case gameType:
			if (fdType === 'GLgm') {
				result = false; // Show it
			}
			break;
		default:
	}
	return result;
}

// =================================

export async function DoOpen(whichType: Integer): Promise<boolean> {
	const dlgOrigin: Point = { v: 0, h: 0 };
	// Port: uninitialized in the original; SFPGetFile ignores it, as numTypes is -1.
	const theTypeList: SFTypeList = [];
	const theReply = newSFReply();

	UseResFile(G.gliderResNum);
	SetPt(dlgOrigin, dlgLeft + G.rightOffset, dlgTop + G.downOffset);
	typeIs = whichType + 1;

	await SFPGetFile(dlgOrigin, '', SimpleFileFilter, -1, theTypeList, OpenSFGetHook, theReply, rCustGetID, null);
	if (theReply.good) {
		switch (whichType) {
			case kHouseType: {
				G.housesName = pString(theReply.fName, 32);
				G.houseVolNum = theReply.vRefNum;
				break;
			}
			case kArtType: {
				G.resourceName = pString(theReply.fName, 32);
				G.resVolNum = theReply.vRefNum;
				break;
			}
			case kGameType: {
				G.gameName = pString(theReply.fName, 32);
				G.gameVolNum = theReply.vRefNum;
				break;
			}
			default:
				// Port: the original exits with its result not yet set; never reached, as Glider passes only these types.
				return false;
		}
	}
	return theReply.good;
}

// =================================

export async function DoClose(volNum: Integer): Promise<void> {
	G.theErr = FSClose(G.houseNumber);
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}

	G.theErr = FlushVol(null, volNum);
	if (G.theErr !== noErr) {
		await GenericAlert(G.theErr);
		return;
	}
}

// =================================

export async function GetHouse(): Promise<boolean> {
	if (!(await OpenHouse())) {
		await GenericAlert(kErrExitSansHouse);
		return false;
	}

	await DoClose(G.houseVolNum);

	if (DemoVersion) {
		if (G.thisHouse.timeStamp !== 16) {
			await GenericAlert(kErrNotDemoHouse);
			return false;
		}
	}

	if (!ErrorCheckFile()) {
		await GenericAlert(kErrWrongHouseVers);
		return false;
	}

	return true;
}

// =================================

// The saved game record of ReadGame and WriteGame.
const miniObject = PRecord({
	theAmount: PInteger,
	theExtra: PInteger,
	theIsOn: PBoolean,
});

const roomState = PRecord({
	stateCode: PInteger,
	objectStates: PArray(1, 16, miniObject),
});

export const gameRec = PRecord({
	version: PInteger,
	houseStamp: PLongInt,
	roomIs: PInteger,
	roomsHas: PInteger,
	nMortals: PInteger,
	nBands: PInteger,
	nEnergy: PInteger,
	isRightFace: PBoolean,
	hasEnteredLeft: PBoolean,
	theRoomScore: PLongInt,
	theSuppScore: PLongInt,
	workingGameNumberIs: PLongInt,
	whichHouse: PString(32),
	firstHouse: PString(32),
	prefs: PInteger, // temporary
	roomWasFlags: PArray(1, 40, PBoolean),
	stateOfRooms: PArray(1, 40, roomState),
});

export async function ReadGame(): Promise<boolean> {
	// Port: the record starts zeroed; the original's was whatever was on the stack.
	let theGame = zeroOf(gameRec);
	let i: Integer;
	let i2: Integer;
	const bytesIn = ref<LongInt>(0);

	bytesIn.v = sizeOf(gameRec);

	G.theErr = SetVol(null, G.gameVolNum);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	G.theErr = FSOpen(G.gameName, G.gameVolNum, varOf('gameNumber')); // open the game
	if ((await IOCheck(G.theErr)) !== 0) {
		if (G.theErr === fnfErr && (await DoOpen(kGameType))) {
			G.theErr = FSOpen(G.gameName, G.gameVolNum, varOf('gameNumber'));
			if ((await IOCheck(G.theErr)) !== 0) {
				return false;
			}
		} else {
			return false;
		}
	}

	G.theErr = SetFPos(G.gameNumber, fsFromStart, 0);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.playing = false;
		G.theErr = FSClose(G.gameNumber);
		return false;
	}

	// Port: FSRead into theGame's bytes.
	const buffer = new Uint8Array(sizeOf(gameRec));
	writeLayout(gameRec, theGame, buffer, 0);
	G.theErr = FSRead(G.gameNumber, bytesIn, buffer); // read in the game
	theGame = readLayout(gameRec, buffer, 0);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.playing = false;
		G.theErr = FSClose(G.gameNumber);
		return false;
	}

	G.theErr = FSClose(G.gameNumber); // close game file
	if ((await IOCheck(G.theErr)) !== 0) {
		G.playing = false;
		G.theErr = FSClose(G.gameNumber);
		return false;
	}

	// extract beginning game info
	if (theGame.version >= 0x0200) {
		await GenericAlert(kErrGameOldVers);
		return false;
	}

	G.roomAt = theGame.roomIs;
	G.roomsPassed = theGame.roomsHas;
	G.mortals = theGame.nMortals;
	G.theGlider.bands = theGame.nBands;
	G.theGlider.energy = theGame.nEnergy;
	G.theGlider.forVel = 4;
	G.theGlider.isRight = theGame.isRightFace;
	G.enteredLeft = theGame.hasEnteredLeft;
	G.roomScore = theGame.theRoomScore;
	G.suppScore = theGame.theSuppScore;
	G.workingGameNumber = theGame.workingGameNumberIs;
	G.housesName = theGame.whichHouse;
	G.firstFileName = theGame.firstHouse;

	CalcRoomScore();
	G.rollScore = (G.roomScore + G.suppScore) | 0;

	if (!(await GetHouse())) {
		// open said house
		await GenericAlert(kErrExitSansHouse);
		return false;
	}

	if (theGame.houseStamp !== G.thisHouse.timeStamp) {
		await GenericAlert(kErrHouseModified);
	}

	// set remaining game info
	for (i = 1; i <= 40; i++) {
		G.roomVisits[i] = theGame.roomWasFlags[i]!;
		const state = theGame.stateOfRooms[i]!;
		const room = G.thisHouse.theRooms[i]!;
		room.conditionCode = state.stateCode;
		for (i2 = 1; i2 <= 16; i2++) {
			room.theObjects[i2]!.amount = state.objectStates[i2]!.theAmount;
			room.theObjects[i2]!.extra = state.objectStates[i2]!.theExtra;
			room.theObjects[i2]!.isOn = state.objectStates[i2]!.theIsOn;
		} // for i2
	} // for i

	return true;
}

// =================================

async function WriteGame(fileNum: Integer, volNum: Integer): Promise<boolean> {
	// Port: the record starts zeroed; the original's was whatever was on the stack.
	const theGame = zeroOf(gameRec);
	let i: Integer;
	let i2: Integer;
	const bytesOut = ref<LongInt>(0);

	for (i = 1; i <= G.nObjects; i++) {
		// set current conditions of present room
		switch (G.eventKind[i]![0]) {
			case awardIt:
			case extraIt:
			case energizeIt:
			case bandIt: {
				G.thisHouse.theRooms[G.roomAt]!.theObjects[i]!.amount = G.eventKind[i]![1]!;
				break;
			}
			case lightIt:
			case airOnIt: {
				if (!G.lightsOut && !G.airOut) {
					G.thisHouse.theRooms[G.roomAt]!.conditionCode = 0;
				}
				break;
			}
			default:
		}
	}

	CalcRoomScore();

	theGame.version = kGlideVersion;
	theGame.houseStamp = G.thisHouse.timeStamp;
	theGame.roomIs = G.roomAt;
	theGame.roomsHas = G.roomsPassed;
	theGame.nMortals = G.mortals;
	theGame.nBands = G.theGlider.bands;
	theGame.nEnergy = G.theGlider.energy;
	theGame.isRightFace = G.theGlider.isRight;
	theGame.hasEnteredLeft = G.enteredLeft;
	theGame.theRoomScore = G.roomScore;
	theGame.theSuppScore = G.suppScore;
	theGame.workingGameNumberIs = G.workingGameNumber;
	theGame.whichHouse = G.housesName;
	theGame.firstHouse = G.firstFileName;
	theGame.prefs = 0;
	for (i = 1; i <= 40; i++) {
		theGame.roomWasFlags[i] = G.roomVisits[i]!;
		const state = theGame.stateOfRooms[i]!;
		const room = G.thisHouse.theRooms[i]!;
		state.stateCode = room.conditionCode;
		for (i2 = 1; i2 <= 16; i2++) {
			state.objectStates[i2]!.theAmount = room.theObjects[i2]!.amount;
			state.objectStates[i2]!.theExtra = room.theObjects[i2]!.extra;
			state.objectStates[i2]!.theIsOn = room.theObjects[i2]!.isOn;
		} // for i2
	} // for i
	bytesOut.v = sizeOf(gameRec);

	G.theErr = SetFPos(fileNum, fsFromStart, 0);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.theErr = FSClose(G.gameNumber); // close game file
		return false;
	}

	// Port: FSWrite from theGame's bytes.
	const buffer = new Uint8Array(sizeOf(gameRec));
	writeLayout(gameRec, theGame, buffer, 0);
	G.theErr = FSWrite(fileNum, bytesOut, buffer);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.theErr = FSClose(G.gameNumber); // close game file
		return false;
	}

	G.theErr = SetEOF(fileNum, bytesOut.v);
	if ((await IOCheck(G.theErr)) !== 0) {
		G.theErr = FSClose(G.gameNumber); // close game file
		return false;
	}
	G.theErr = FSClose(fileNum); // close game file
	if ((await IOCheck(G.theErr)) !== 0) {
		G.theErr = FSClose(G.gameNumber); // close game file
		return false;
	}
	G.theErr = FlushVol(null, volNum);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	return true;
}

// =================================

export async function SaveGameAs(): Promise<boolean> {
	const dlgOrigin: Point = { v: 0, h: 0 };
	const theReply = newSFReply();
	const theInfo = newFInfo();

	SetPt(dlgOrigin, dlgLeft + G.rightOffset + 25, dlgTop + G.downOffset);
	await SFPutFile(dlgOrigin, 'Name for game:', '', null, theReply);
	if (!theReply.good) {
		return false;
	}
	G.gameVolNum = theReply.vRefNum;
	G.theErr = GetFInfo(theReply.fName, G.gameVolNum, theInfo);
	switch (G.theErr) {
		case noErr: {
			if (theInfo.fdType !== 'GLgm') {
				await GenericAlert(kErrFileExists);
				return false;
			}
			break;
		}
		case fnfErr: {
			G.theErr = Create(theReply.fName, G.gameVolNum, 'GLID', 'GLgm');
			if ((await IOCheck(G.theErr)) !== 0) {
				return false;
			}
			break;
		}
		default: {
			await GenericAlert(G.theErr);
			return false;
		}
	} // end - case

	// SetCursor- watch
	G.gameName = pString(theReply.fName, 32);

	G.theErr = FSOpen(theReply.fName, G.gameVolNum, varOf('gameNumber'));
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}
	if (!(await WriteGame(G.gameNumber, G.gameVolNum))) {
		G.theErr = FSClose(G.gameNumber); // close game file
		return false;
	}

	G.refuseHigh = true;
	return true;
} // end - function

// =================================

export async function SaveGame(): Promise<boolean> {
	if (G.gameName === '') {
		if (!(await SaveGameAs())) {
			return false;
		}
	} else {
		G.theErr = FSOpen(G.gameName, G.gameVolNum, varOf('gameNumber'));
		if ((await IOCheck(G.theErr)) !== 0) {
			return false;
		}

		if (!(await WriteGame(G.gameNumber, G.gameVolNum))) {
			return false;
		}
	}
	G.refuseHigh = true;

	return true;
}

// =================================

export async function WriteHouse(): Promise<boolean> {
	const fileLength = ref<LongInt>(0);

	SpinBall();
	fileLength.v = sizeOf(houseRecLayout);

	SpinBall();
	G.theErr = SetVol(null, G.houseVolNum);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	G.theErr = FSOpen(G.housesName, G.houseVolNum, varOf('houseNumber'));
	if ((await IOCheck(G.theErr)) !== 0) {
		if (!(await DoOpen(kHouseType))) {
			G.playing = false;
			G.theErr = FSClose(G.houseNumber);
			return false;
		}
		G.theErr = FSOpen(G.housesName, G.houseVolNum, varOf('houseNumber'));
		if ((await IOCheck(G.theErr)) !== 0) {
			G.playing = false;
			G.theErr = FSClose(G.houseNumber);
			return false;
		}
	}

	SpinBall();
	G.theErr = SetFPos(G.houseNumber, fsFromStart, 0);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	SpinBall();
	// Port: FSWrite from thisHouse's bytes.
	const buffer = new Uint8Array(sizeOf(houseRecLayout));
	writeLayout(houseRecLayout, G.thisHouse, buffer, 0);
	G.theErr = FSWrite(G.houseNumber, fileLength, buffer);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	SpinBall();
	G.theErr = SetEOF(G.houseNumber, fileLength.v);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	SpinBall();
	G.theErr = FSClose(G.houseNumber);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	SpinBall();
	G.theErr = FlushVol(null, G.houseVolNum);
	if ((await IOCheck(G.theErr)) !== 0) {
		return false;
	}

	SpinBall();
	return true;
}
