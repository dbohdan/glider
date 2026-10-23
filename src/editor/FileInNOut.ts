// Port of E-FileInNOut.p: opening, saving, and closing house files, the save-before-closing and
// save-before-quitting dialogs, and saving the editor's preferences.

import {
	Alert,
	ChangedResource,
	Concat,
	Create,
	DisableItem,
	DisposDialog,
	div,
	dskFulErr,
	EnableItem,
	eofErr,
	fBsyErr,
	type FileParam,
	fLckdErr,
	FlushVol,
	fnfErr,
	FrameRoundRect,
	FSClose,
	fsFromStart,
	FSOpen,
	FSRead,
	FSWrite,
	Get1Resource,
	GetDateTime,
	GetDItem,
	GetFInfo,
	GetIndString,
	GetMenu,
	GetNewDialog,
	GetPort,
	GetResource,
	type Handle,
	HLock,
	HNoPurge,
	HPurge,
	HUnlock,
	inFront,
	InitCursor,
	InsetRect,
	int32,
	type Integer,
	type ItemHandle,
	type LongInt,
	ModalDialog,
	MoveWindow,
	NewHandle,
	newFInfo,
	newSFReply,
	noErr,
	NumToString,
	OffsetRect,
	opWrErr,
	type OSErr,
	ParamText,
	PenNormal,
	PenSize,
	type Point,
	pString,
	type Rect,
	type Ref,
	ref,
	ReleaseResource,
	ResError,
	screenBits,
	SelectWindow,
	SetEOF,
	SetFPos,
	SetPort,
	SetPt,
	SFPGetFile,
	SFPutFile,
	type SFTypeList,
	ShowWindow,
	UseResFile,
	vLckdErr,
	WriteResource,
	wPrErr,
} from '../mac/Toolbox.ts';
import { PBoolean, PInteger, PRecord, PRect, PString, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import {
	custGetID,
	dlgLeft,
	dlgTop,
	fileAlertID,
	fileStrIDs,
	G,
	houseRecLayout,
	iSave,
	kErrFileExists,
	kErrSavingPrefs,
	mFile,
	saveNoCloseID,
	saveNoQuitID,
} from './Globals.ts';
import { GenericAlert, SpinBall } from './Utilities.ts';
import { OriginalControl, SaveWebPrefs } from './Additions.ts';

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

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });

//=================================

async function IOCheck(theErr: OSErr): Promise<Integer> {
	let dummyInt: Integer;
	let line1 = '';
	let line2: string;
	let alertRect: Rect;

	UseResFile(G.editorResNum);
	if (theErr !== noErr) {
		InitCursor();
		switch (theErr) {
			case dskFulErr:
				line1 = GetIndString(fileStrIDs, 1);
				break;
			case fnfErr:
				line1 = GetIndString(fileStrIDs, 2);
				break;
			case wPrErr:
				line1 = GetIndString(fileStrIDs, 3);
				break;
			case fLckdErr:
				line1 = GetIndString(fileStrIDs, 4);
				break;
			case vLckdErr:
				line1 = GetIndString(fileStrIDs, 5);
				break;
			case fBsyErr:
			case opWrErr:
				line1 = GetIndString(fileStrIDs, 6);
				break;
			case eofErr:
				line1 = GetIndString(fileStrIDs, 7);
				break;
			default:
				line1 = GetIndString(fileStrIDs, 10);
		}
		line2 = NumToString(theErr);
		line2 = Concat('Error code = ', line2);
		ParamText(line1, line2, '', '');
		// Port: an AlertTHndl over the 'ALRT' bytes; its boundsRect is a Rect at offset 0.
		const alertHandle = Get1Resource('ALRT', fileAlertID);
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
		dummyInt = await Alert(fileAlertID, null);
	}
	return theErr;
}

//=================================

/** Port: FSRead into G.thisHouse: the record's bytes are read into and read back. */
function readHouse(refNum: Integer, count: Ref<LongInt>): OSErr {
	const buffer = new Uint8Array(sizeOf(houseRecLayout));
	writeLayout(houseRecLayout, G.thisHouse, buffer, 0);
	const err = FSRead(refNum, count, buffer);
	Object.assign(G.thisHouse, readLayout(houseRecLayout, buffer, 0)); // Port: in place, as Pascal reads into the record
	return err;
}

export async function OpenFile(fileName: string, vNum: Integer): Promise<boolean> {
	const textLength = ref<LongInt>(0);
	let resultCode: OSErr;
	// Port: DoClose's result is not used, as in the original.
	// oxlint-disable-next-line no-unused-vars
	let dummy: boolean;

	SpinBall();
	resultCode = FSOpen(fileName, vNum, varOf('fileNumber'));
	if ((await IOCheck(resultCode)) !== 0) {
		return false;
	}

	SpinBall();
	resultCode = SetFPos(G.fileNumber, fsFromStart, 0);
	if ((await IOCheck(resultCode)) !== 0) {
		G.fileIsOpen = true;
		dummy = await DoClose();
		return false;
	}

	SpinBall();
	textLength.v = sizeOf(houseRecLayout);
	resultCode = readHouse(G.fileNumber, textLength);
	if ((await IOCheck(resultCode)) !== 0) {
		G.fileIsOpen = true;
		dummy = await DoClose();
		return false;
	}

	SpinBall();
	if (G.thisHouse.timeStamp <= 0) {
		await GenericAlert(24);
		G.fileIsOpen = true;
		G.volumeNumber = vNum;
		dummy = await DoClose();
		return false;
	}

	SpinBall();
	G.fileIsOpen = true;
	G.lockIt = false;
	G.volumeNumber = vNum;
	return true;
}

//=================================

function SimpleFileFilter(p: FileParam): boolean {
	let result = true; // Don't show it -- default
	// with p^.ioFlFndrInfo do
	if (p.ioFlFndrInfo.fdType === 'GLhs') {
		result = false; // Show it
	}
	return result;
}

//=====================================

export async function DoOpen(): Promise<boolean> {
	const dlgOrigin: Point = { v: 0, h: 0 };
	const theTypeList: SFTypeList = [];
	const theReply = newSFReply();

	SetPt(dlgOrigin, dlgLeft + G.rightOffset, dlgTop + G.downOffset);
	theTypeList[0] = 'GLhs';

	await SFPGetFile(dlgOrigin, '', SimpleFileFilter, -1, theTypeList, null, theReply, custGetID, null);
	// with theReply do
	if (theReply.good) {
		G.housesName = pString(theReply.fName, 32);
		const result = await OpenFile(theReply.fName, theReply.vRefNum);
		InitCursor();
		return result;
	} else {
		return false;
	}
}

//=====================================

export async function WriteFile(theFile: Integer, volNum: Integer): Promise<boolean> {
	const fileLength = ref<LongInt>(0);
	let resultCode: OSErr;

	SpinBall();
	fileLength.v = sizeOf(houseRecLayout);

	SpinBall();
	resultCode = SetFPos(theFile, fsFromStart, 0);
	if ((await IOCheck(resultCode)) !== 0) {
		return false;
	}

	SpinBall();
	// Port: FSWrite from thisHouse's bytes.
	const buffer = new Uint8Array(sizeOf(houseRecLayout));
	writeLayout(houseRecLayout, G.thisHouse, buffer, 0);
	resultCode = FSWrite(theFile, fileLength, buffer);
	if ((await IOCheck(resultCode)) !== 0) {
		return false;
	}

	SpinBall();
	resultCode = SetEOF(theFile, fileLength.v);
	if ((await IOCheck(resultCode)) !== 0) {
		return false;
	}

	SpinBall();
	resultCode = FlushVol(null, volNum);
	if ((await IOCheck(resultCode)) !== 0) {
		return false;
	}

	SpinBall();
	G.changed = false;
	return true;
}

//=====================================

export async function DoSaveAs(): Promise<boolean> {
	const dlgOrigin: Point = { v: 0, h: 0 };
	const theReply = newSFReply();
	let resultCode: OSErr;
	const theInfo = newFInfo();

	if (G.fileIsOpen) {
		if (!(await DoClose())) {
			return false;
		}
	}

	SetPt(dlgOrigin, dlgLeft + G.rightOffset + 20, dlgTop + G.downOffset);
	await SFPutFile(dlgOrigin, 'Name for house:', '', null, theReply);
	{
		// with theReply do
		if (!theReply.good) {
			return false;
		}

		G.volumeNumber = theReply.vRefNum;
		resultCode = GetFInfo(theReply.fName, theReply.vRefNum, theInfo);

		switch (resultCode) {
			case noErr: {
				if (theInfo.fdType !== 'GLhs') {
					await GenericAlert(kErrFileExists);
					return false;
				}
				break;
			}
			case fnfErr: {
				resultCode = Create(theReply.fName, theReply.vRefNum, 'GLed', 'GLhs');
				if ((await IOCheck(resultCode)) !== 0) {
					return false;
				}
				break;
			}
			default: {
				await GenericAlert(resultCode);
				return false;
			}
		} // end - case

		// SetCursor- watch
		G.housesName = pString(theReply.fName, 32);
		if (G.thisHouse.firstFile === '') {
			G.thisHouse.firstFile = G.housesName;
		}

		G.thisHouse.timeStamp = GetDateTime();
		if (!G.lockIt) {
			// Port: LongInt negation, which wraps at 32 bits.
			G.thisHouse.timeStamp = int32(-G.thisHouse.timeStamp);
		}

		SpinBall();

		resultCode = FSOpen(theReply.fName, theReply.vRefNum, varOf('fileNumber'));
		if ((await IOCheck(resultCode)) !== 0) {
			return false;
		}

		if (!(await WriteFile(G.fileNumber, theReply.vRefNum))) {
			InitCursor();
			return false;
		}
		InitCursor();
	} // end - with

	G.fileIsOpen = true;
	EnableItem(GetMenu(mFile)!, iSave);
	return true;
}

//=====================================

export async function DoSave(): Promise<boolean> {
	// Port: resultCode is declared but never used.
	if (G.housesName === 'untitled' && !G.fileIsOpen) {
		if (!(await DoSaveAs())) {
			return false;
		}
	} else {
		G.thisHouse.timeStamp = GetDateTime();
		if (!G.lockIt) {
			// Port: LongInt negation, which wraps at 32 bits.
			G.thisHouse.timeStamp = int32(-G.thisHouse.timeStamp);
		}
		if (!(await WriteFile(G.fileNumber, G.volumeNumber))) {
			InitCursor();
			return false;
		}
		InitCursor();
	}
	return true;
}

//=================================

export async function DoClose(): Promise<boolean> {
	let resultCode: OSErr;

	if (G.fileIsOpen) {
		resultCode = FSClose(G.fileNumber);
		if ((await IOCheck(resultCode)) !== 0) {
			return false;
		}

		resultCode = FlushVol(null, G.volumeNumber);
		if ((await IOCheck(resultCode)) !== 0) {
			return false;
		}

		EnableItem(GetMenu(mFile)!, 1);
		EnableItem(GetMenu(mFile)!, 2);
		DisableItem(GetMenu(mFile)!, 4);
		DisableItem(GetMenu(mFile)!, 5);
		DisableItem(GetMenu(mFile)!, 6);
		DisableItem(GetMenu(mFile)!, 7);
	}

	G.fileIsOpen = false;
	G.housesName = 'untitled';
	return true;
}

//=====================================

export async function SaveNoClose(): Promise<Integer> {
	const saveBut = 1;
	const closeBut = 2;
	const cancelBut = 6;

	let leaveDlg: boolean;
	const tempRect = rect();
	const cntlType = ref<Integer>(0);
	let itemHit: Integer;
	let rightOff: Integer, downOff: Integer;
	const dlgItem = ref<ItemHandle>(null);
	// Port: the loop sets the result before it ends; index and tempInt are declared but never used.
	let result: Integer = 0;

	// -------------------------

	function Redraw(): void {
		SetPort(theDlgPtr); // Point to our dialog window
		GetDItem(theDlgPtr, saveBut, cntlType, dlgItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenNormal();
	}

	// -------------------------

	const wasPort = GetPort();
	const theDlgPtr = GetNewDialog(saveNoCloseID, null, inFront)!;
	{
		// with theDlgPtr^.portBits do
		const bounds = theDlgPtr.portBits.bounds;
		rightOff = G.rightOffset - bounds.left;
		downOff = G.downOffset - bounds.top;
	}
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	Redraw();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		if (itemHit === saveBut || itemHit === closeBut || itemHit === cancelBut) {
			result = itemHit;
			leaveDlg = true;
		}
	} while (!leaveDlg);

	DisposDialog(theDlgPtr);
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(wasPort);
	}
	return result;
}

//=====================================

export async function SaveFirst(): Promise<Integer> {
	const saveBut = 1;
	const quitBut = 2;
	const cancelBut = 6;

	let leaveDlg: boolean;
	const tempRect = rect();
	const cntlType = ref<Integer>(0);
	let itemHit: Integer;
	let rightOff: Integer, downOff: Integer;
	const dlgItem = ref<ItemHandle>(null);
	// Port: the loop sets the result before it ends; index and tempInt are declared but never used.
	let result: Integer = 0;

	// -------------------------

	function Redraw(): void {
		SetPort(theDlgPtr); // Point to our dialog window
		GetDItem(theDlgPtr, saveBut, cntlType, dlgItem, tempRect); // Get the item handle
		PenSize(3, 3); // Change pen to draw thick default outline
		InsetRect(tempRect, -4, -4); // Draw outside the button by 1 pixel
		FrameRoundRect(tempRect, 16, 16); // Draw the outline
		PenNormal();
	}

	// -------------------------

	const wasPort = GetPort();
	const theDlgPtr = GetNewDialog(saveNoQuitID, null, inFront)!;
	{
		// with theDlgPtr^.portBits do
		const bounds = theDlgPtr.portBits.bounds;
		rightOff = G.rightOffset - bounds.left;
		downOff = G.downOffset - bounds.top;
	}
	MoveWindow(theDlgPtr, rightOff, downOff, false);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);

	Redraw();
	leaveDlg = false;

	do {
		itemHit = await ModalDialog(null);
		GetDItem(theDlgPtr, itemHit, cntlType, dlgItem, tempRect);

		if (itemHit === saveBut || itemHit === quitBut || itemHit === cancelBut) {
			result = itemHit;
			leaveDlg = true;
		}
	} while (!leaveDlg);

	DisposDialog(theDlgPtr);
	if (G.toolWndo !== null) {
		SetPort(G.toolWndo);
	} else {
		SetPort(wasPort);
	}
	return result;
}

//=================================

export async function SavePrefs(): Promise<void> {
	// type prefType = record … end; (the 'Gprf' resource)
	const prefType = PRecord({
		resName: PString(32),
		controlIs: PInteger,
		leftIs: PInteger,
		rightIs: PInteger,
		energyIs: PInteger,
		bandIs: PInteger,
		buttonIs: PBoolean,
		restoreIs: PBoolean,
		leftNameIs: PString(12),
		rightNameIs: PString(12),
		energyNameIs: PString(12),
		bandNameIs: PString(12),
		isKeyBoard: PInteger,
	});
	let theirPrefs: Handle | null;
	// Port: theErr and volName are declared but never used.

	UseResFile(G.editorResNum);

	theirPrefs = NewHandle(sizeOf(prefType));
	if (theirPrefs !== null) {
		HLock(theirPrefs);
	} else {
		await GenericAlert(kErrSavingPrefs);
		return;
	}
	theirPrefs = GetResource('Gprf', 128);
	if (ResError() === noErr && theirPrefs !== null) {
		// with theirPrefs^^ do: the record is read, changed, and written back to the resource's bytes.
		const prefs = readLayout(prefType, theirPrefs.data, 0);
		prefs.resName = G.resourceName;
		prefs.controlIs = OriginalControl(G.controlMethod); // Port: one the original knows (Additions.ts)
		prefs.leftIs = G.leftKey;
		prefs.rightIs = G.rightKey;
		prefs.energyIs = G.energyKey;
		prefs.bandIs = G.bandKey;
		prefs.buttonIs = G.buttonFires;
		prefs.restoreIs = G.restoreColor;
		prefs.leftNameIs = G.leftName;
		prefs.rightNameIs = G.rightName;
		prefs.energyNameIs = G.energyName;
		prefs.bandNameIs = G.bandName;
		prefs.isKeyBoard = G.herKeyboard;
		writeLayout(prefType, prefs, theirPrefs.data, 0);
	} else {
		await GenericAlert(kErrSavingPrefs);
		return;
	}
	ChangedResource(theirPrefs);
	WriteResource(theirPrefs);
	if (ResError() !== noErr) {
		if (ResError() === fLckdErr || ResError() === vLckdErr || ResError() === wPrErr) {
			await GenericAlert(kErrSavingPrefs);
		} else {
			await GenericAlert(ResError());
		}
	}
	HUnlock(theirPrefs);
	ReleaseResource(theirPrefs);
	// Port: and the port's additions' own preferences (Additions.ts).
	SaveWebPrefs();
}
