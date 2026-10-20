// Port of E-Initialize.p: starting up the Room Editor.

import {
	AddResMenu,
	Alert,
	AppendMenu,
	type BitMap,
	CheckItem,
	ClearMenuBar,
	ClipRect,
	CloseResFile,
	CountMItems,
	CurResFile,
	DisableItem,
	DrawMenuBar,
	DrawPicture,
	envAExtendKbd,
	envMacPlusKbd,
	envStandADBKbd,
	EraseRect,
	EventAvail,
	everyEvent,
	ExitToShell,
	type GDevice,
	Get1Resource,
	GetApplLimit,
	GetCCursor,
	GetCursor,
	GetDateTime,
	GetIndPattern,
	GetMainDevice,
	GetMenu,
	GetNewCWindow,
	GetNewPalette,
	GetNewWindow,
	GetPicture,
	GetPort,
	GetResource,
	GrafPort,
	type Handle,
	HGetState,
	HiWord,
	HLock,
	HMGetHelpMenuHandle,
	HNoPurge,
	HPurge,
	HSetState,
	HUnlock,
	inFront,
	InitCursor,
	InitDialogs,
	InitFonts,
	InitMenus,
	InitWindows,
	InsertMenu,
	int16,
	type Integer,
	type LongInt,
	MaxApplZone,
	MemError,
	type MenuHandle,
	MoreMasters,
	MoveHHi,
	MoveWindow,
	newSFReply,
	newSysEnvRec,
	NewHandle,
	NewPtr,
	NewRgn,
	NGetTrapAddress,
	noErr,
	OffsetRect,
	OpenCPort,
	OpenPort,
	OpenResFile,
	type Point,
	pString,
	type Ptr,
	type Rect,
	RectRgn,
	ref,
	ReleaseResource,
	resFNotFound,
	ResError,
	RGBBackColor,
	RGBForeColor,
	screenBits,
	SetApplLimit,
	SetCursor,
	SetDepth,
	SetItem,
	SetPalette,
	SetPort,
	SetPortBits,
	SetPt,
	SetRect,
	setRandSeed,
	SetWRefCon,
	type SFTypeList,
	SFGetFile,
	ShowWindow,
	type SignedByte,
	SysEnvirons,
	TEInit,
	thePort,
	ToolTrap,
	UseResFile,
	watchCursor,
} from '../mac/Toolbox.ts';
import { PBoolean, PInteger, PRecord, PRect, PString, readLayout, sizeOf, writeLayout } from '../mac/PascalLayout.ts';
import {
	absMouse,
	type acur,
	acurID,
	ball,
	basket,
	battry,
	books,
	candle,
	celDct,
	celVnt,
	clock,
	defaultBandKey,
	defaultBandName,
	defaultEnergyKey,
	defaultEnergyName,
	defaultLeftKey,
	defaultLeftName,
	defaultRightKey,
	defaultRightName,
	depthAlertID,
	dlgLeft,
	dlgTop,
	dnStar,
	drip,
	flrVnt,
	fshBwl,
	G,
	grease,
	guitar,
	holdKey,
	iRestoreDeep,
	kCursCount,
	kErr2Or16Colors,
	kErrExitSansGraphics,
	kErrGraphicsNotFound,
	kErrLoadingRes,
	kErrMacPlusNeeded,
	kErrNotEnoughMem,
	kErrUnknownAtInit,
	lftFan,
	litSwt,
	macTsh,
	mainWndoID,
	mApple,
	maskPictID,
	mControls,
	mEdit,
	mFile,
	mSpecial,
	mWindows,
	objectPictID,
	outlet,
	paintg,
	paper,
	pwrSwt,
	rbrBnd,
	relMouse,
	ritFan,
	shelf,
	shredr,
	stackSize,
	table,
	teaKtl,
	thermo,
	toastr,
	upStar,
} from './Globals.ts';
import { GenericAlert, SpinBall } from './Utilities.ts';
import { FlushRoom } from './RoomStuff.ts';

//=================================

export async function InitVariables(): Promise<void> {
	let index: Integer;
	let theDepth: Integer = 0;
	let sizeOfOff: LongInt = 0;
	let offRowBytes: LongInt = 0;
	let tempByte: SignedByte;
	// rawPointer: Ptr; tempRect: Rect;  (declared, never used)
	let thePict;
	let ignore = false; // Port: initialized for the type checker; the loop below always assigns it.

	//---------------------

	async function CheckOurEnvirons(): Promise<void> {
		const WNETrapNum = 0x60;
		const unimplTrapNum = 0x9f;

		const Color = 1;
		// const Monochrome = 0;  (unused)
		const GDTypeFlag = 1;

		let sheSaid: Integer;
		let err: Integer;
		const thisWorld = newSysEnvRec();
		let theDevice: GDevice | null;

		//-----------

		async function DepthAlert(): Promise<Integer> {
			let dummyInt: Integer;
			let alertRect: Rect;

			UseResFile(G.editorResNum);
			InitCursor();

			const alertHandle = Get1Resource('ALRT', depthAlertID);
			if (alertHandle !== null) {
				HNoPurge(alertHandle);
				// Port: an 'ALRT' resource's boundsRect is a Rect at the start of its data.
				alertRect = readLayout(PRect, alertHandle.data, 0);
				OffsetRect(alertRect, -alertRect.left, -alertRect.top);
				dummyInt = Math.trunc((screenBits.bounds.right - alertRect.right) / 2);
				OffsetRect(alertRect, dummyInt, 0);
				dummyInt = Math.trunc((screenBits.bounds.bottom - alertRect.bottom) / 3);
				OffsetRect(alertRect, 0, dummyInt);
				writeLayout(PRect, alertRect, alertHandle.data, 0);
				HPurge(alertHandle);
			}
			dummyInt = await Alert(depthAlertID, null);
			return dummyInt;
		}

		//-----------

		// SetDepth: the editor declares the trap inline here; it is the Toolbox's (Devices.ts).

		//-----------

		G.rightOffset = Math.trunc((screenBits.bounds.right - 512) / 2);
		G.downOffset = Math.trunc((screenBits.bounds.bottom - 342) / 2);

		err = SysEnvirons(1, thisWorld); // Check on the set up of the Mac game is on
		{
			// with thisWorld do
			if (thisWorld.machineType < 1) {
				// If less than a Mac 512KE (=1) then quit now!
				await GenericAlert(kErrMacPlusNeeded);
				ExitToShell();
			}
			if (thisWorld.systemVersion < 0x0602) {
				G.inhibitSound = true;
				await GenericAlert(3);
			} else {
				G.inhibitSound = false;
			}

			G.cantColor = !thisWorld.hasColorQD;
			G.inColor = thisWorld.hasColorQD;
			G.cantSwitch = thisWorld.systemVersion < 0x0605;
			G.hasSys7 = thisWorld.systemVersion >= 0x0700;

			if (G.inColor) {
				// Port: GetMainDevice is not nil on a machine with Color QuickDraw.
				theDevice = GetMainDevice()!;
				HLock(theDevice);
				const pm = theDevice.gdPMap; // with theDevice^^.gdPMap^^ do
				G.wasDepth = pm.pixelSize;
				if (pm.pixelSize !== 4 && pm.pixelSize !== 1) {
					if (G.cantSwitch) {
						await GenericAlert(kErr2Or16Colors);
						ExitToShell();
					} else {
						sheSaid = await DepthAlert();
						switch (sheSaid) {
							case 1:
								err = SetDepth(theDevice, 4, GDTypeFlag, Color);
								break;
							case 2: {
								err = SetDepth(theDevice, 1, GDTypeFlag, Color);
								G.inColor = false;
								break;
							}
							default:
								ExitToShell();
						}
					}
				}
				if (pm.pixelSize === 1) {
					G.inColor = false;
				}
				HUnlock(theDevice);
			}

			G.herKeyboard = thisWorld.keyBoardType;
			switch (thisWorld.keyBoardType) {
				// determine keycodes
				case envMacPlusKbd: {
					G.leftArrow = 0x46;
					G.rightArrow = 0x42;
					G.deleteKey = 0x33;
					break;
				}
				case envAExtendKbd:
				case envStandADBKbd: {
					G.leftArrow = 0x7b;
					G.rightArrow = 0x7c;
					G.deleteKey = 0x33;
					break;
				}
				default: {
					G.leftArrow = 0x2b;
					G.rightArrow = 0x2f;
					G.deleteKey = 0x0;
				}
			} // case
		} // end - with
		void err;

		G.hasWNE = NGetTrapAddress(WNETrapNum, ToolTrap) !== NGetTrapAddress(unimplTrapNum, ToolTrap);
	}

	//---------------------

	async function LoadCursors(): Promise<void> {
		let count: Integer;
		let tempByte: SignedByte;

		G.useColorCursor = G.inColor;

		UseResFile(G.editorResNum);
		// Port: the 'acur' resource read as the acur record: whichBall, then the cursors' IDs in
		// the high words of LongInts.
		const acurRes = GetResource('acur', acurID);
		G.ballList = acurRes === null ? null : parseAcur(acurRes);
		if (G.ballList === null) {
			await GenericAlert(kErrLoadingRes);
			return;
		}
		tempByte = HGetState(G.ballList);
		HLock(G.ballList);
		{
			const ballList = G.ballList; // with ballList^^ do
			for (count = 1; count <= kCursCount; count++) {
				if (G.useColorCursor) {
					G.ballC[count] = GetCCursor(HiWord(ballList.ball[count] as LongInt));
					if (G.ballC[count] === null) {
						G.useColorCursor = false;
					}
				}
				ballList.ball[count] = GetCursor(HiWord(ballList.ball[count] as LongInt));
				if (ballList.ball[count] === null) {
					await GenericAlert(kErrLoadingRes);
					ballList.whichBall = -1;
					return;
				}
			}
			ballList.whichBall = 0;
		}
		HSetState(G.ballList, tempByte);
	}

	//---------------------

	// Port: Pascal's RGBColor components are Integers; -1 and other negative values are their
	// unsigned 16-bit equivalents here ($FFFF for -1).
	function SetUpColors(): void {
		SpinBall();
		G.rgbBlack.red = 0;
		G.rgbBlack.green = 0;
		G.rgbBlack.blue = 0;
		G.rgbWhite.red = -1 & 0xffff;
		G.rgbWhite.green = -1 & 0xffff;
		G.rgbWhite.blue = -1 & 0xffff;
		G.rgbYellow.red = -1 & 0xffff;
		G.rgbYellow.green = -1 & 0xffff;
		G.rgbYellow.blue = 0;
		G.rgbViolet.red = -1 & 0xffff;
		G.rgbViolet.green = 0;
		G.rgbViolet.blue = -1 & 0xffff;
		G.rgbRed.red = -1 & 0xffff;
		G.rgbRed.green = 0;
		G.rgbRed.blue = 0;
		G.rgbLtBlue.red = 0;
		G.rgbLtBlue.green = -1 & 0xffff;
		G.rgbLtBlue.blue = -1 & 0xffff;
		G.rgbBrown.red = 22016;
		G.rgbBrown.green = 11421;
		G.rgbBrown.blue = 1316;
		G.rgbLtBrown.red = -28457 & 0xffff;
		G.rgbLtBrown.green = 29024;
		G.rgbLtBrown.blue = 14900;
		G.rgbDkGray.red = 16384;
		G.rgbDkGray.green = 16384;
		G.rgbDkGray.blue = 16384;
	}

	//---------------------

	async function SetUpMainWndo(): Promise<void> {
		SpinBall();
		SetRect(G.screenArea, 0, 0, 512, 322);
		SetRect(G.wholeArea, 0, 0, 512, 342);
		SetRect(G.nullRect, -500, -500, -499, -499);
		SetRect(G.fullArea, -G.rightOffset, -G.downOffset, 512 + G.rightOffset, 342 + G.downOffset);

		G.wholeRgn = NewRgn();
		RectRgn(G.wholeRgn, G.wholeArea);

		SpinBall();
		// Init main window
		G.mainWndo = null;
		if (G.inColor) {
			G.mainWndo = GetNewCWindow(mainWndoID, null, inFront);
		} else {
			G.mainWndo = GetNewWindow(mainWndoID, null, inFront);
		}
		if (G.mainWndo === null) {
			await GenericAlert(kErrLoadingRes);
		}
		// Port: the original carries on with a nil window after the alert.
		SetPort(G.mainWndo!);
		MoveWindow(G.mainWndo!, G.rightOffset, G.downOffset, false);
		ShowWindow(G.mainWndo!);
		SetWRefCon(G.mainWndo!, 0);
		ClipRect(G.wholeArea);

		if (G.inColor) {
			G.mainPalette = GetNewPalette(mainWndoID);
			SetPalette(G.mainWndo!, G.mainPalette, true);
		}
	}

	//---------------------

	async function SetUpMenus(): Promise<void> {
		let tempMenu: MenuHandle | null;
		let theErr: Integer;

		SpinBall();
		ClearMenuBar();
		tempMenu = GetMenu(mApple);
		if (tempMenu !== null) {
			AddResMenu(tempMenu, 'DRVR');
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		SpinBall();
		tempMenu = GetMenu(mFile);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		SpinBall();
		tempMenu = GetMenu(mEdit);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		SpinBall();
		tempMenu = GetMenu(mSpecial);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		SpinBall();
		tempMenu = GetMenu(mControls);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, -1);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		SpinBall();
		tempMenu = GetMenu(mWindows);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		if (G.hasSys7) {
			// add a Help menu item
			const helpMenu = ref<MenuHandle | null>(tempMenu);
			theErr = HMGetHelpMenuHandle(helpMenu);
			tempMenu = helpMenu.v;
			if (theErr === noErr) {
				if (tempMenu !== null) {
					AppendMenu(tempMenu, 'Room Editor Help');
					G.iGlidersHelp = CountMItems(tempMenu);
				} else {
					tempMenu = GetMenu(mWindows)!;
					AppendMenu(tempMenu, '(-');
					AppendMenu(tempMenu, 'Help');
				}
			} else {
				tempMenu = GetMenu(mWindows)!;
				AppendMenu(tempMenu, '(-');
				AppendMenu(tempMenu, 'Help');
			}
		} else {
			AppendMenu(tempMenu, '(-');
			AppendMenu(tempMenu, 'Help');
		}

		SpinBall();
		DrawMenuBar();
	}

	//---------------------

	async function NewBitMap(theBitMap: BitMap, theRect: Rect): Promise<Ptr> {
		let result: Ptr = 0;
		// with theBitMap, theRect do
		theBitMap.rowBytes = Math.trunc((theRect.right - theRect.left + 15) / 16) * 2;
		theBitMap.baseAddr = NewPtr(theBitMap.rowBytes * (theRect.bottom - theRect.top));
		theBitMap.bounds = { ...theRect };
		if (MemError() !== noErr) {
			await GenericAlert(kErrNotEnoughMem);
			result = 0; // nil
			ExitToShell();
		} else {
			result = theBitMap.baseAddr;
		}
		return result;
	}

	//---------------------

	async function SetUpBitMaps(): Promise<void> {
		SpinBall();
		// Init b&w Bitmaps
		// Init offscreen virgin map
		G.offVirginPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offVirginPort);
		G.offVirginBits = await NewBitMap(G.offVirginMap, G.wholeArea);
		SetPortBits(G.offVirginMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offVirginMap.bounds);

		SpinBall();
		// Init offscreen load map
		G.offLoadPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offLoadPort);
		G.offLoadBits = await NewBitMap(G.offLoadMap, G.wholeArea);
		SetPortBits(G.offLoadMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offLoadMap.bounds);

		SpinBall();
		// Init offscreen object map
		G.offPlayerPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offPlayerPort);
		G.offPlayerBits = await NewBitMap(G.offPlayerMap, G.wholeArea);
		SetPortBits(G.offPlayerMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offPlayerMap.bounds);
	}

	//---------------------

	async function SetUpPixMaps(): Promise<void> {
		SetPort(G.mainWndo!);
		RGBForeColor(G.rgbBlack);
		RGBBackColor(G.rgbWhite);

		SpinBall();
		G.virginCPtr = G.virginCPort;
		OpenCPort(G.virginCPtr);
		theDepth = 4;
		offRowBytes = Math.trunc((theDepth * (G.wholeArea.right - G.wholeArea.left) + 15) / 16) * 2;
		sizeOfOff = (G.wholeArea.bottom - G.wholeArea.top) * offRowBytes;
		G.virginCBits = NewPtr(sizeOfOff);
		if (G.virginCPtr === null) {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		{
			// with virginCPtr^.portPixMap^^ do
			const pm = G.virginCPtr.portPixMap;
			pm.baseAddr = G.virginCBits;
			pm.rowBytes = int16(offRowBytes + 0x8000);
			pm.bounds = { ...G.wholeArea };
		}
		RGBForeColor(G.rgbBlack);
		RGBBackColor(G.rgbWhite);
		EraseRect(thePort.portRect);
		ClipRect(G.wholeArea);

		SpinBall();
		G.loadCPtr = G.loadCPort;
		OpenCPort(G.loadCPtr);
		G.loadCBits = NewPtr(sizeOfOff);
		if (G.loadCBits === 0) {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		{
			// with loadCPtr^.portPixMap^^ do
			const pm = G.loadCPtr.portPixMap;
			pm.baseAddr = G.loadCBits;
			pm.rowBytes = int16(offRowBytes + 0x8000);
			pm.bounds = { ...G.wholeArea };
		}
		RGBForeColor(G.rgbBlack);
		RGBBackColor(G.rgbWhite);
		EraseRect(thePort.portRect);
		ClipRect(G.wholeArea);

		SpinBall();
		G.objectCPtr = G.objectCPort;
		OpenCPort(G.objectCPtr);
		G.objectCBits = NewPtr(sizeOfOff);
		if (G.objectCBits === 0) {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		{
			// with objectCPtr^.portPixMap^^ do
			const pm = G.objectCPtr.portPixMap;
			pm.baseAddr = G.objectCBits;
			pm.rowBytes = int16(offRowBytes + 0x8000);
			pm.bounds = { ...G.wholeArea };
		}
		RGBForeColor(G.rgbBlack);
		RGBBackColor(G.rgbWhite);
		EraseRect(thePort.portRect);
		ClipRect(G.wholeArea);
	}

	//---------------------

	async function SetUpOffMask(): Promise<void> {
		SpinBall();
		// Init offscreen mask map
		G.offMaskPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offMaskPort);
		G.offMaskBits = await NewBitMap(G.offMaskMap, G.wholeArea);
		SetPortBits(G.offMaskMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offMaskMap.bounds);
	}

	//---------------------

	async function DoOpenResFile(): Promise<boolean> {
		const dlgOrigin: Point = { v: 0, h: 0 };
		const theTypeList: SFTypeList = [];
		const theReply = newSFReply();
		let result: boolean;

		SpinBall();
		result = false;
		SetPt(dlgOrigin, dlgLeft + G.rightOffset, dlgTop + G.downOffset);
		theTypeList[0] = 'GLbk';

		await SFGetFile(dlgOrigin, '', null, 1, theTypeList, null, theReply);
		{
			// with theReply do
			if (theReply.good) {
				G.resourceName = pString(theReply.fName, 32);
				result = true;
			}
		}
		return result;
	}

	//-----------------

	async function GetPrefs(): Promise<void> {
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
		let pictDeep: Handle | null;
		let refNumber: Integer;
		// tempVol: Integer;  (declared, never used)
		let satisfactory: boolean;

		//-----------------

		function DefaultControls(): void {
			G.leftKey = defaultLeftKey;
			G.rightKey = defaultRightKey;
			G.energyKey = defaultEnergyKey;
			G.bandKey = defaultBandKey;
			G.buttonFires = false;
			G.leftName = defaultLeftName;
			G.rightName = defaultRightName;
			G.energyName = defaultEnergyName;
			G.bandName = defaultBandName;
		}

		//-----------------

		function Default(): void {
			if (G.inColor) {
				G.resourceName = 'Art 16';
			} else {
				G.resourceName = 'Art 2';
			}
			G.controlMethod = absMouse;
			G.restoreColor = true;
			DefaultControls();
		}

		//-----------------

		SpinBall();
		UseResFile(G.editorResNum);
		theirPrefs = NewHandle(sizeOf(prefType));
		if (theirPrefs === null) {
			Default();
			return;
		}
		theirPrefs = GetResource('Gprf', 128);
		if (ResError() === noErr && theirPrefs !== null) {
			HLock(theirPrefs);
			{
				// with theirPrefs^^ do
				const prefs = readLayout(prefType, theirPrefs.data, 0);
				G.resourceName = prefs.resName;
				G.controlMethod = prefs.controlIs;
				G.leftKey = prefs.leftIs;
				G.rightKey = prefs.rightIs;
				G.energyKey = prefs.energyIs;
				G.bandKey = prefs.bandIs;
				G.buttonFires = prefs.buttonIs;
				G.restoreColor = prefs.restoreIs;
				G.leftName = prefs.leftNameIs;
				G.rightName = prefs.rightNameIs;
				G.energyName = prefs.energyNameIs;
				G.bandName = prefs.bandNameIs;
				if (prefs.isKeyBoard !== G.herKeyboard) {
					DefaultControls();
				}
			}
			HUnlock(theirPrefs);
			ReleaseResource(theirPrefs);
		} else {
			Default();
		}

		SpinBall();
		if (G.controlMethod < holdKey || G.controlMethod > relMouse) {
			G.controlMethod = absMouse;
		}
		CheckItem(GetMenu(mControls)!, G.controlMethod, true);
		if (G.restoreColor) {
			SetItem(GetMenu(mSpecial)!, iRestoreDeep, 'Depth Restore is On');
		} else {
			SetItem(GetMenu(mSpecial)!, iRestoreDeep, 'Depth Restore is Off');
		}
		if (G.cantColor || G.cantSwitch) {
			DisableItem(GetMenu(mSpecial)!, iRestoreDeep);
		}

		refNumber = OpenResFile(G.resourceName); // test to see if res legit
		if (refNumber === -1) {
			if (ResError() === resFNotFound) {
				// Hmmm.  Maybe color depth has changed
				if (G.inColor) {
					G.resourceName = 'Color Art'; // Try the default color name
				} else {
					G.resourceName = 'B&W Art'; // Or default B&W file name
				}
				refNumber = OpenResFile(G.resourceName); // test to see if res legit yet
				if (refNumber === -1) {
					UseResFile(G.editorResNum); // back to Editor res file
					await GenericAlert(kErrGraphicsNotFound); // bitch about all this
					if (!(await DoOpenResFile())) {
						await GenericAlert(kErrExitSansGraphics);
						ExitToShell();
					}
					refNumber = OpenResFile(G.resourceName);
				}
			} else {
				UseResFile(G.editorResNum); // back to Editor res file
				await GenericAlert(kErrGraphicsNotFound); // bitch about all this
				if (!(await DoOpenResFile())) {
					await GenericAlert(kErrExitSansGraphics);
					ExitToShell();
				}
				refNumber = OpenResFile(G.resourceName);
			}
		}

		satisfactory = false;
		do {
			UseResFile(refNumber);
			pictDeep = NewHandle(2); // SIZEOF(Integer)
			if (pictDeep === null) {
				await GenericAlert(kErrNotEnoughMem);
				ExitToShell();
			}

			pictDeep = GetResource('deep', 128);
			if (ResError() === noErr && pictDeep !== null) {
				HLock(pictDeep);
				if (G.inColor) {
					if (readLayout(PInteger, pictDeep.data, 0) !== 0x0004) {
						if (pictDeep !== null) {
							HUnlock(pictDeep);
							ReleaseResource(pictDeep);
							pictDeep = null;
						}
						CloseResFile(refNumber);
						if (G.resourceName !== 'Color Art') {
							G.resourceName = 'Color Art';
							refNumber = OpenResFile(G.resourceName);
						} else {
							await GenericAlert(21);
							if (!(await DoOpenResFile())) {
								await GenericAlert(kErrExitSansGraphics);
								ExitToShell();
							}
							refNumber = OpenResFile(G.resourceName);
						}
					} else {
						satisfactory = true;
					}
				} else {
					// were in b&w mode
					if (readLayout(PInteger, pictDeep.data, 0) !== 0x0001) {
						if (pictDeep !== null) {
							HUnlock(pictDeep);
							ReleaseResource(pictDeep);
							pictDeep = null;
						}
						CloseResFile(refNumber);
						if (G.resourceName !== 'B&W Art') {
							G.resourceName = 'B&W Art';
							refNumber = OpenResFile(G.resourceName);
						} else {
							await GenericAlert(22);
							if (!(await DoOpenResFile())) {
								await GenericAlert(20);
								ExitToShell();
							}
							refNumber = OpenResFile(G.resourceName);
						}
					} else {
						satisfactory = true;
					}
				}
			} else {
				await GenericAlert(kErrNotEnoughMem);
				ExitToShell();
			}

			if (pictDeep !== null) {
				HUnlock(pictDeep);
				ReleaseResource(pictDeep);
				pictDeep = null;
			}
		} while (!satisfactory);

		CloseResFile(refNumber);

		UseResFile(G.editorResNum);
	}

	//---------------------

	async function LoadPICTs(): Promise<void> {
		let refNumber: Integer;
		let wasPort: GrafPort;

		SpinBall();
		refNumber = OpenResFile(G.resourceName);
		if (refNumber === -1) {
			UseResFile(G.editorResNum);
			await GenericAlert(kErrGraphicsNotFound);
			if (!(await DoOpenResFile())) {
				ExitToShell();
			}
			refNumber = OpenResFile(G.resourceName);
			if (refNumber === -1) {
				await GenericAlert(kErrGraphicsNotFound);
				ExitToShell();
			}
		}
		UseResFile(refNumber);

		SpinBall();
		wasPort = GetPort();
		if (G.inColor) {
			// load the objects up
			SetPort(G.objectCPtr!);
		} else {
			SetPort(G.offPlayerPort!);
		}
		thePict = GetPicture(objectPictID);
		// Port: the original tests thePict^ (the master pointer), dereferencing a nil handle when
		// there is no such picture; a handle here is its record, so it is tested for nil.
		if (thePict !== null) {
			tempByte = HGetState(thePict);
			MoveHHi(thePict);
			HLock(thePict);
			DrawPicture(thePict, G.wholeArea);
			HSetState(thePict, tempByte);
		} else {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		ReleaseResource(thePict);

		SpinBall();
		SetPort(G.offMaskPort!);
		thePict = GetPicture(maskPictID); // load the mask up
		if (thePict !== null) {
			tempByte = HGetState(thePict);
			MoveHHi(thePict);
			HLock(thePict);
			DrawPicture(thePict, G.wholeArea);
			HSetState(thePict, tempByte);
		} else {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		ReleaseResource(thePict);

		SpinBall();
		SetPort(wasPort);
		CloseResFile(refNumber);
		UseResFile(G.editorResNum);
	}

	//---------------------

	G.editorResNum = CurResFile();

	SetApplLimit(GetApplLimit() - stackSize);
	MaxApplZone();
	for (index = 1; index <= 10; index++) {
		MoreMasters();
	}
	// InitGraf(@thePort);
	// Port: the platform has already called InitGraf with the machine's screen.
	InitFonts();
	InitWindows();
	InitMenus();
	TEInit();
	InitDialogs(null);
	InitCursor();

	for (index = 1; index <= 3; index++) {
		ignore = EventAvail(everyEvent, G.theEvent);
	}
	void ignore;
	G.inBackground = false;

	SetCursor(GetCursor(watchCursor)!);

	await CheckOurEnvirons();
	await LoadCursors();
	SpinBall();
	if (G.inColor) {
		SetUpColors();
	}
	SpinBall();
	await SetUpMenus();
	SpinBall();
	await SetUpMainWndo();
	SpinBall();
	if (G.inColor) {
		await SetUpPixMaps();
	} else {
		await SetUpBitMaps();
	}
	SpinBall();
	await SetUpOffMask();
	SpinBall();
	await GetPrefs();
	SpinBall();
	await LoadPICTs();

	SpinBall();
	G.doneFlag = false;
	G.soundOn = !G.inhibitSound;
	G.playing = false;
	G.pausing = false;
	G.roomScrapDirty = false;
	G.objectScrapDirty = false;
	G.fileIsOpen = false;
	G.autoHide = false;
	G.lightsOut = false;
	G.bandBorne = true;
	G.lockIt = false;
	G.binaryFlip = 1;
	setRandSeed(GetDateTime()); // GetDateTime(RandSeed)
	FlushRoom(G.thisRoom);

	G.setOTools = 0;
	G.toolWndo = null;
	G.housesName = 'untitled';

	G.marqueeTime = false;
	G.marqueeIndex = 0;
	for (index = 0; index <= 4; index++) {
		SpinBall();
		G.marqueePat[index] = GetIndPattern(128, index + 1);
	}

	const tileRects = G.tileRects;
	for (index = 0; index <= 7; index++) {
		SetRect(tileRects[index] as Rect, index * 64, 0, (index + 1) * 64, 342);
	}

	const iconRect = G.iconRect;
	SetRect(iconRect[0] as Rect, 5, 55, 37, 87);
	SetRect(iconRect[1] as Rect, 41, 55, 73, 87);
	SetRect(iconRect[2] as Rect, 5, 90, 37, 122);
	SetRect(iconRect[3] as Rect, 41, 90, 73, 122);
	SetRect(iconRect[4] as Rect, 5, 125, 37, 157);
	SetRect(iconRect[5] as Rect, 41, 125, 73, 157);

	SpinBall();

	const selectRect = G.selectRect;
	SetRect(selectRect[0] as Rect, 8, 6, 24, 22);
	SetRect(selectRect[1] as Rect, 31, 6, 47, 22);
	SetRect(selectRect[2] as Rect, 54, 6, 70, 22);
	SetRect(selectRect[3] as Rect, 8, 28, 24, 44);
	SetRect(selectRect[4] as Rect, 31, 28, 47, 44);
	SetRect(selectRect[5] as Rect, 54, 28, 70, 44);

	SetRect(G.shadoRct[0] as Rect, 256, 0, 304, 11);
	SetRect(G.shadoRct[1] as Rect, 256, 12, 304, 23);

	SpinBall();

	const glideRct = G.glideRct;
	SetRect(glideRct[0] as Rect, 0, 0, 48, 20); // right forward
	SetRect(glideRct[1] as Rect, 0, 21, 48, 41); // right tipped
	SetRect(glideRct[2] as Rect, 0, 42, 48, 62); // left forward
	SetRect(glideRct[3] as Rect, 0, 63, 48, 83); // left tipped
	SetRect(glideRct[4] as Rect, 208, 0, 256, 20); // turn endpoint
	SetRect(glideRct[5] as Rect, 208, 21, 256, 41); //  "
	SetRect(glideRct[6] as Rect, 208, 42, 256, 62); //  "
	SetRect(glideRct[7] as Rect, 208, 63, 256, 83); //  "
	SetRect(glideRct[8] as Rect, 208, 84, 256, 104); //  "
	SetRect(glideRct[9] as Rect, 208, 105, 256, 125); // turn endpoint
	SetRect(glideRct[10] as Rect, 414, 53, 462, 73); // glider fading masks right
	SetRect(glideRct[11] as Rect, 414, 74, 462, 94);
	SetRect(glideRct[12] as Rect, 414, 95, 462, 115);
	SetRect(glideRct[13] as Rect, 414, 116, 462, 136);
	SetRect(glideRct[14] as Rect, 414, 137, 462, 157);
	SetRect(glideRct[15] as Rect, 414, 158, 462, 178);
	SetRect(glideRct[16] as Rect, 414, 179, 462, 199);
	SetRect(glideRct[17] as Rect, 463, 53, 511, 73); // glider fading masks left
	SetRect(glideRct[18] as Rect, 463, 74, 511, 94);
	SetRect(glideRct[19] as Rect, 463, 95, 511, 115);
	SetRect(glideRct[20] as Rect, 463, 116, 511, 136);
	SetRect(glideRct[21] as Rect, 463, 137, 511, 157);
	SetRect(glideRct[22] as Rect, 463, 158, 511, 178);
	SetRect(glideRct[23] as Rect, 463, 179, 511, 199);
	SetRect(glideRct[24] as Rect, 265, 24, 313, 60); // burning
	SetRect(glideRct[25] as Rect, 265, 61, 313, 97);
	SetRect(glideRct[26] as Rect, 265, 98, 313, 134);
	SetRect(glideRct[27] as Rect, 265, 135, 313, 171);

	SpinBall();

	const nextPhase = G.nextPhase;
	const np1 = nextPhase[1] as Integer[];
	np1[0] = 10;
	np1[1] = 11;
	np1[2] = 10;
	np1[3] = 11;
	np1[4] = 12;
	np1[5] = 11;
	np1[6] = 12;
	np1[7] = 13;
	np1[8] = 12;
	np1[9] = 13;
	np1[10] = 14;
	np1[11] = 13;
	np1[12] = 14;
	np1[13] = 15;
	np1[14] = 14;
	np1[15] = 15;
	np1[16] = 16;

	const np2 = nextPhase[2] as Integer[];
	np2[0] = 16;
	np2[1] = 15;
	np2[2] = 16;
	np2[3] = 15;
	np2[4] = 14;
	np2[5] = 15;
	np2[6] = 14;
	np2[7] = 13;
	np2[8] = 14;
	np2[9] = 13;
	np2[10] = 12;
	np2[11] = 13;
	np2[12] = 12;
	np2[13] = 11;
	np2[14] = 12;
	np2[15] = 11;
	np2[16] = 10;

	const np3 = nextPhase[3] as Integer[];
	np3[0] = 4;
	np3[1] = 4;
	np3[2] = 5;
	np3[3] = 5;
	np3[4] = 6;
	np3[5] = 6;
	np3[6] = 7;
	np3[7] = 7;
	np3[8] = 8;
	np3[9] = 8;
	np3[10] = 9;
	np3[11] = 9;

	const np4 = nextPhase[4] as Integer[];
	np4[0] = 9;
	np4[1] = 9;
	np4[2] = 8;
	np4[3] = 8;
	np4[4] = 7;
	np4[5] = 7;
	np4[6] = 6;
	np4[7] = 6;
	np4[8] = 5;
	np4[9] = 5;
	np4[10] = 4;
	np4[11] = 4;

	SpinBall();

	const src = (n: number): Rect => G.srcRect[n] as Rect;
	SetRect(src(celVnt), 0, 84, 48, 96);
	SetRect(src(celDct), 0, 97, 48, 110);
	SetRect(src(flrVnt), 0, 111, 48, 124);
	SetRect(src(paper), 0, 125, 48, 146);
	SetRect(src(toastr), 0, 147, 38, 174);
	SetRect(src(60), 304, 84, 336, 115); // toast 1
	SetRect(src(61), 304, 116, 336, 147); // toast 2
	SetRect(src(62), 304, 148, 336, 179); // toast 3
	SetRect(src(63), 304, 180, 336, 211); // toast 4
	SetRect(src(64), 304, 212, 336, 243); // toast 5
	SetRect(src(65), 304, 244, 336, 275); // toast 6
	SetRect(src(teaKtl), 0, 175, 41, 205);
	SetRect(src(lftFan), 0, 206, 35, 261);
	SetRect(src(ritFan), 0, 262, 35, 316);
	SetRect(src(table), 48, 23, 112, 45);
	SetRect(src(shredr), 48, 46, 112, 70);
	SetRect(src(books), 48, 71, 112, 126);
	SetRect(src(clock), 112, 0, 144, 29);
	SetRect(src(candle), 112, 30, 144, 51);
	SetRect(src(rbrBnd), 112, 52, 144, 75);
	SetRect(src(ball), 112, 76, 144, 108);
	SetRect(src(fshBwl), 112, 109, 144, 138);
	SetRect(src(66), 144, 109, 160, 125); // fish 1
	SetRect(src(67), 144, 126, 160, 142); // fish 2
	SetRect(src(68), 144, 143, 160, 159); // fish 3
	SetRect(src(69), 144, 160, 160, 176); // fish 4
	SetRect(src(grease), 112, 139, 144, 168);
	SetRect(src(58), 112, 169, 144, 198); // grease falling 1
	SetRect(src(59), 112, 199, 144, 228); // grease fallen
	SetRect(src(litSwt), 142, 0, 160, 26);
	SetRect(src(thermo), 144, 27, 162, 54);
	SetRect(src(outlet), 160, 264, 192, 289);
	SetRect(src(51), 160, 290, 192, 315); // outlet sparking 1
	SetRect(src(52), 160, 316, 192, 341); // outlet sparking 2
	SetRect(src(pwrSwt), 144, 82, 162, 108);
	SetRect(src(guitar), 48, 127, 112, 297);
	SetRect(src(drip), 192, 42, 208, 55);
	SetRect(src(shelf), 192, 71, 208, 100);
	SetRect(src(basket), 448, 270, 511, 341);
	SetRect(src(paintg), 408, 53, 510, 146);
	SetRect(src(battry), 144, 55, 160, 81);
	SetRect(src(macTsh), 256, 209, 301, 267);
	SetRect(src(upStar), 0, 0, 161, 254);
	SetRect(src(dnStar), 0, 0, 161, 254);
	SetRect(src(48), 144, 189, 160, 201); // candle flame
	SetRect(src(49), 144, 202, 160, 214); // candle flame
	SetRect(src(50), 144, 215, 160, 227); // candle flame
	SetRect(src(53), 192, 0, 208, 13); // drip
	SetRect(src(54), 192, 14, 208, 27); // drip
	SetRect(src(55), 192, 28, 208, 41); // drip
	SetRect(src(56), 192, 42, 208, 55); // drip
	SetRect(src(57), 192, 56, 208, 70); // drip

	SpinBall();

	const toolIcnID = G.toolIcnID;
	toolIcnID[0] = 400;
	toolIcnID[1] = 401;
	toolIcnID[2] = 402;
	toolIcnID[3] = 403;
	toolIcnID[4] = 404;
	toolIcnID[5] = 405;
	toolIcnID[6] = 406;

	toolIcnID[8] = 408;
	toolIcnID[9] = 409;
	toolIcnID[10] = 410;
	toolIcnID[11] = 411;
	toolIcnID[12] = 412;
	toolIcnID[13] = 413;

	toolIcnID[16] = 416;
	toolIcnID[17] = 417;
	toolIcnID[18] = 418;
	toolIcnID[19] = 419;
	toolIcnID[20] = 420;
	toolIcnID[21] = 421;

	toolIcnID[24] = 424;
	toolIcnID[25] = 425;
	toolIcnID[26] = 426;
	toolIcnID[27] = 427;
	toolIcnID[28] = 428;
	toolIcnID[29] = 429;

	toolIcnID[32] = 432;
	toolIcnID[33] = 433;
	toolIcnID[34] = 434;
	toolIcnID[35] = 435;
	toolIcnID[36] = 436;
	toolIcnID[37] = 437;

	toolIcnID[40] = 440;
	toolIcnID[41] = 441;
	toolIcnID[42] = 442;
	toolIcnID[43] = 443;
	toolIcnID[44] = 444;
	toolIcnID[45] = 445;

	InitCursor();
}

/** Port: reads an 'acur' resource into the acur record (as Glider's Initialize.ts does). */
function parseAcur(h: Handle): acur {
	const d = h.data;
	const long = (o: number): LongInt => ((d[o]! << 24) | (d[o + 1]! << 16) | (d[o + 2]! << 8) | d[o + 3]!) | 0;
	const ballEntries: acur['ball'] = [];
	for (let i = 1; i <= kCursCount; i++) {
		ballEntries[i] = long(4 + (i - 1) * 4);
	}
	return { whichBall: long(0), ball: ballEntries };
}

//=================================
