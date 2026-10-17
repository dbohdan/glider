// Port of G-Initialize.p: starting up Glider.

import {
	AddResMenu,
	Alert,
	appPrint,
	type AppFile,
	ChangedResource,
	CheckItem,
	ClearMenuBar,
	ClipRect,
	CloseResFile,
	ClrAppFiles,
	CountAppFiles,
	CountMItems,
	CurResFile,
	DisableItem,
	DrawPicture,
	DrawString,
	EnableItem,
	envMacPlus,
	envSE,
	EraseRect,
	ErrorSound,
	EventAvail,
	everyEvent,
	ExitToShell,
	FillRect,
	FlushEvents,
	ForeColor,
	type GDevice,
	Get1Resource,
	GetAppFiles,
	GetApplLimit,
	GetCCursor,
	GetCursor,
	GetDateTime,
	GetKeys,
	GetMainDevice,
	GetMenu,
	GetNewCWindow,
	GetNewPalette,
	GetNewWindow,
	GetPicture,
	GetPort,
	GetResource,
	GetSoundVol,
	GetVol,
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
	InitCursor,
	InitDialogs,
	InitFonts,
	InitMenus,
	InitWindows,
	inFront,
	InsertMenu,
	int8,
	int16,
	type Integer,
	type LongInt,
	MaxApplZone,
	MemError,
	type MenuHandle,
	MoreMasters,
	MoveHHi,
	MoveTo,
	NewHandle,
	NewPtr,
	NewRgn,
	newSysEnvRec,
	NGetTrapAddress,
	noErr,
	OffsetRect,
	OpenCPort,
	OpenPort,
	OpenResFile,
	patOr,
	patXor,
	peek8,
	type Ptr,
	type Rect,
	RectRgn,
	redColor,
	blackColor,
	ref,
	ReleaseResource,
	resFNotFound,
	ResError,
	RGBBackColor,
	RGBForeColor,
	screenBits,
	SelectWindow,
	SetApplLimit,
	SetItem,
	SetOrigin,
	SetPalette,
	SetPort,
	SetPortBits,
	SetRect,
	setRandSeed,
	SetResInfo,
	SetSoundVol,
	ShowWindow,
	SizeWindow,
	SysEnvirons,
	TEInit,
	TextFont,
	TextMode,
	thePort,
	ToolTrap,
	UseResFile,
	vLckdErr,
	fLckdErr,
	wPrErr,
	WriteResource,
	AppendMenu,
	black,
	type BitMap,
	type SignedByte,
	SetDepth,
} from '../mac/Toolbox.ts';
import { PBoolean, PInteger, PRecord, PRect, PString, readLayout, writeLayout } from '../mac/PascalLayout.ts';
import { DoOpen, GetHouse } from './FileInNOut.ts';
import {
	type acur,
	ball,
	books,
	candle,
	celDct,
	celVnt,
	clock,
	DemoVersion,
	dnStar,
	drip,
	flrVnt,
	fshBwl,
	G,
	grease,
	guitar,
	iEndGame,
	iLoadGame,
	iLoadHouse,
	iRestoreDeep,
	iSaveGame,
	iSaveGameAs,
	iShowAir,
	iSound,
	kArtType,
	kCommandKeyMap,
	kCursCount,
	kDefaultBandKey,
	kDefaultBandName,
	kDefaultEnergyKey,
	kDefaultEnergyName,
	kDefaultLeftKey,
	kDefaultLeftName,
	kDefaultRightKey,
	kDefaultRightName,
	kDuhDumSound,
	kErr2Or16Colors,
	kErrBackgroundMusic,
	kErrDemoRefuseHouse,
	kErrExitSansGraphics,
	kErrGraphicLoad,
	kErrGraphicsAre16Bit,
	kErrGraphicsAre2Bit,
	kErrGraphicsNotFound,
	kErrLoadingDfltHouse,
	kErrLoadingPrefs,
	kErrLoadingRes,
	kErrMacPlusNeeded,
	kErrMissionINIT,
	kErrNewKeyboard,
	kErrNoSounds,
	kErrNotEnoughMem,
	kErrNothingToPrint,
	kErrStartUpWrongType,
	kErrUnaccounted,
	kErrUnknownAtInit,
	kErrVolLocked,
	kFastScoreIncrement,
	kMusicSound,
	kSecondaryAddr,
	kSlowScoreIncrement,
	kStackSize,
	lastDemo,
	lftFan,
	litSwt,
	macTsh,
	mApple,
	mControls,
	mGame,
	mOption,
	outlet,
	paintg,
	paper,
	pwrSwt,
	rAcurID,
	rbrBnd,
	rColorIdleID,
	rIdleID,
	ritFan,
	rMainWndoID,
	rMaskPictID,
	rObjectPictID,
	rDepthAlertID,
	rSidePict1,
	rSidePict2,
	shelf,
	shredr,
	table,
	teaKtl,
	thermo,
	toastr,
	upStar,
	basket,
	battry,
} from './Globals.ts';
import { DoErrorSound, GenericAlert, HideMenuBar, Randomize, ShowMenuBar, SpinBall } from './GlobalUtils.ts';
import { GetGame, StartNewGame } from './IdleInput.ts';

/** Port: an 'ALRT' resource's boundsRect is a Rect at the start of its data. */
function alertBounds(h: Handle): Rect {
	return readLayout(PRect, h.data, 0);
}

//=================================

export async function InitializeAll(): Promise<void> {
	let i: Integer;
	const ignoreStr = ref('');

	//------------------------

	function InitToolBox(): void {
		let ignore: boolean;

		G.gliderResNum = CurResFile();

		SetApplLimit(GetApplLimit() - kStackSize);
		MaxApplZone();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		MoreMasters();
		// InitGraf(@thePort);
		// Port: the platform has already called InitGraf with the machine's screen.
		InitFonts();
		FlushEvents(everyEvent, 0);
		InitWindows();
		InitMenus();
		TEInit();
		InitDialogs(null);

		ignore = EventAvail(everyEvent, G.theEvent);
		void ignore;

		G.inBackground = false;
	}

	//------------------------

	async function CheckOurEnvirons(): Promise<void> {
		const WNETrapNum = 0x60;
		const unimplTrapNum = 0x9f;
		const Color = 1;
		const GDTypeFlag = 1;
		const kPointerBase = 0x3f2700 - 0x20;

		const thisWorld = newSysEnvRec();
		let tempRes: Handle | null;
		let theDevice: GDevice | null = null;
		let initsPointer: Ptr;
		let initData: LongInt;
		let sheSaid: Integer;
		let hasINIT: boolean;

		//-----------

		async function DepthAlert(): Promise<Integer> {
			let dummyInt: Integer;
			let alertRect: Rect;

			UseResFile(G.gliderResNum);
			InitCursor();

			const alertHandle = Get1Resource('ALRT', rDepthAlertID);
			if (alertHandle !== null) {
				HNoPurge(alertHandle);
				alertRect = alertBounds(alertHandle);
				OffsetRect(alertRect, -alertRect.left, -alertRect.top);
				dummyInt = Math.trunc((screenBits.bounds.right - alertRect.right) / 2);
				OffsetRect(alertRect, dummyInt, 0);
				dummyInt = Math.trunc((screenBits.bounds.bottom - alertRect.bottom) / 3);
				OffsetRect(alertRect, 0, dummyInt);
				writeLayout(PRect, alertRect, alertHandle.data, 0);
				HPurge(alertHandle);
			}
			dummyInt = await Alert(rDepthAlertID, null);
			return dummyInt;
		}

		//-----------

		// SetDepth: Glider declares the trap inline here; it is the Toolbox's (Devices.ts).

		//-----------

		async function ForceBlackAndWhite(): Promise<void> {
			const pm = theDevice!.gdPMap;
			if (pm.pixelSize !== 1) {
				if (G.cantSwitch) {
					// if we can't switch via software
					await GenericAlert(kErr2Or16Colors); // say, "Hey, set the Control Panel"
					ExitToShell();
				} else {
					// we can switch via software
					G.theErr = SetDepth(theDevice!, 1, GDTypeFlag, Color);
					G.inColor = false;
				} // end - we can switch via software
			}
		}

		//-----------

		async function CheckAndSwitch(): Promise<void> {
			const pm = theDevice!.gdPMap;
			if (pm.pixelSize !== 4 && pm.pixelSize !== 1) {
				if (G.cantSwitch) {
					// if we can't switch via software
					await GenericAlert(kErr2Or16Colors); // say, "Hey, set the Control Panel"
					ExitToShell();
				} else {
					// we can switch via software
					sheSaid = await DepthAlert(); // bring up monitor switch alert
					switch (sheSaid) {
						// what button did they click?
						case 1: // switch to 16 color
							G.theErr = SetDepth(theDevice!, 4, GDTypeFlag, Color);
							break;
						case 2: // switch to B&W
							G.theErr = SetDepth(theDevice!, 1, GDTypeFlag, Color);
							G.inColor = false;
							break;
						default:
							InitCursor();
							ExitToShell();
					}
				} // end - we can switch via software
			}
		}

		//-----------

		tempRes = Get1Resource('CURS', 128);
		if (tempRes !== null) {
			HLock(tempRes);
			SetResInfo(tempRes, 128, 'oz');
			if (ResError() === wPrErr || ResError() === fLckdErr || ResError() === vLckdErr) {
				await GenericAlert(kErrVolLocked);
				ExitToShell();
			}
			ChangedResource(tempRes);
			if (ResError() === wPrErr || ResError() === fLckdErr || ResError() === vLckdErr) {
				await GenericAlert(kErrVolLocked);
				ExitToShell();
			}
			WriteResource(tempRes);
			if (ResError() === wPrErr || ResError() === fLckdErr || ResError() === vLckdErr) {
				await GenericAlert(kErrVolLocked);
				ExitToShell();
			}
			HUnlock(tempRes);
			ReleaseResource(tempRes);
		} else {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}

		G.rightOffset = Math.trunc((screenBits.bounds.right - 512) / 2);
		G.downOffset = Math.trunc((screenBits.bounds.bottom - 342) / 2);

		G.theErr = SysEnvirons(1, thisWorld); // Check on the set up of the Mac game is on
		{
			// with thisWorld do
			if (thisWorld.machineType < envMacPlus) {
				// If less than a Mac 512KE (=1) then quit now!
				await GenericAlert(kErrMacPlusNeeded);
				ExitToShell();
			}

			G.inhibitSound = false;

			G.cantSwitch = thisWorld.systemVersion < 0x0605;
			G.hasSys7 = thisWorld.systemVersion >= 0x0700;

			G.areFlipping = thisWorld.machineType === envMacPlus || thisWorld.machineType === envSE || thisWorld.machineType === 15;

			if (G.areFlipping) {
				hasINIT = true;
				initsPointer = kPointerBase + 1;
				initData = int8(peek8(initsPointer));
				if (initData !== 0x61 && initData !== 0x48) {
					hasINIT = false;
				}
				initsPointer = kPointerBase + 2;
				initData = int8(peek8(initsPointer));
				if (initData !== 0x6c && initData !== 0x6f) {
					hasINIT = false;
				}
				initsPointer = kPointerBase + 3;
				initData = int8(peek8(initsPointer));
				if (initData !== 0x74 && initData !== 0x6c) {
					hasINIT = false;
				}

				if (!hasINIT && G.areFlipping) {
					await GenericAlert(kErrMissionINIT);
					G.areFlipping = false;
				}

				G.scoreIncrement = kFastScoreIncrement;
			} else {
				G.scoreIncrement = kSlowScoreIncrement;
			}

			G.herKeyBoard = thisWorld.keyBoardType;

			G.cantColor = !thisWorld.hasColorQD;
			G.inColor = thisWorld.hasColorQD;
			if (G.inColor) {
				theDevice = GetMainDevice();
				if (theDevice === null) {
					await GenericAlert(kErrUnaccounted);
					ExitToShell();
				}
				HLock(theDevice);
				const pm = theDevice.gdPMap; // with theDevice^^.gdPMap^^ do
				G.wasDepth = pm.pixelSize;
				GetKeys(G.theKeys);
				if (G.theKeys[kCommandKeyMap]) {
					await ForceBlackAndWhite();
				} else {
					await CheckAndSwitch();
				}

				if (pm.pixelSize === 1) {
					G.inColor = false;
				}
				HUnlock(theDevice);
			}
		} // end - with thisWorld

		G.hasWNE = NGetTrapAddress(WNETrapNum, ToolTrap) !== NGetTrapAddress(unimplTrapNum, ToolTrap);
	}

	//------------------------

	async function LoadCursors(): Promise<void> {
		let count: Integer;
		let tempByte: SignedByte;

		G.useColorCursor = G.inColor;

		UseResFile(G.gliderResNum);

		G.noCursor = GetCursor(128);

		// Port: the 'acur' resource read as Glider's acur record: whichBall, then the cursors' IDs in
		// the high words of LongInts.
		const acurRes = GetResource('acur', rAcurID);
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

	//------------------------

	function InitGlobalRects(): void {
		SetRect(G.wholeArea, 0, 0, 512, 342);
		SetRect(G.fullArea, -G.rightOffset, -G.downOffset, 512 + G.rightOffset, 342 + G.downOffset);
		SetRect(G.nullRect, -500, -500, -500, -500);
		SetRect(G.smScoreRect, 224, 8, 296, 17);
		SetRect(G.lgScoreRect, 222, 4, 296, 21);
		G.wholeRgn = NewRgn();
		RectRgn(G.wholeRgn, G.wholeArea);
		MoveHHi(G.wholeRgn);
		HLock(G.wholeRgn);
	}

	//------------------------

	// Port: Pascal's RGBColor components are Integers; -1 and other negative values are their
	// unsigned 16-bit equivalents here ($FFFF for -1).
	function SetUpColors(): void {
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
		G.rgbBlue.red = 0;
		G.rgbBlue.green = 0;
		G.rgbBlue.blue = -1 & 0xffff;
		G.rgbLtGreen.red = 7967;
		G.rgbLtGreen.green = -18503 & 0xffff;
		G.rgbLtGreen.blue = 5140;
	}

	//------------------------

	async function SetUpMainWndo(): Promise<void> {
		let thePict;
		const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
		let tempByte: SignedByte;

		// Init main window
		G.mainWndo = null;
		if (G.inColor) {
			// load the window template from resource
			G.mainWndo = GetNewCWindow(rMainWndoID, null, inFront);
		} else {
			G.mainWndo = GetNewWindow(rMainWndoID, null, inFront);
		}
		if (G.mainWndo === null) {
			G.mainWndo = null;
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		// properly size and then show window
		SizeWindow(G.mainWndo, 512 + 2 * G.rightOffset, 342 + 2 * G.downOffset, false);
		ShowWindow(G.mainWndo);
		SelectWindow(G.mainWndo);
		SetPort(G.mainWndo);
		// set up windows coordinate system
		SetOrigin(-G.rightOffset, -G.downOffset);
		// fill black all around the border
		SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, 0);
		FillRect(tempRect, black);
		SetRect(tempRect, -G.rightOffset, 342, 512 + 2 * G.rightOffset, 342 + G.downOffset);
		FillRect(tempRect, black);
		SetRect(tempRect, -G.rightOffset, 0, 0, 342);
		FillRect(tempRect, black);
		SetRect(tempRect, 512, 0, 512 + G.rightOffset, 342);
		FillRect(tempRect, black);

		if (G.inColor) {
			RGBForeColor(G.rgbBlack);
			RGBBackColor(G.rgbWhite);
			// assign palette
			G.mainPalette = GetNewPalette(rMainWndoID);
			SetPalette(G.mainWndo, G.mainPalette, true);
			// load side-bar PICTs
			SetRect(tempRect, -64, 0, 0, 342);
			thePict = GetPicture(rSidePict1);
			if (thePict !== null) {
				tempByte = HGetState(thePict);
				MoveHHi(thePict);
				HLock(thePict);
				DrawPicture(thePict, tempRect);
				HSetState(thePict, tempByte);
			} else {
				await GenericAlert(kErrNotEnoughMem);
				ExitToShell();
			}
			ReleaseResource(thePict);
		} else {
			TextFont(201); // This is to preload the fonts
			DrawString('o'); // needed so that there is no
			TextFont(200); // disk-access delay when they
			DrawString('z'); // are needed in the game.
		}
		// load in other side-bar PICT
		if (G.inColor) {
			SetRect(tempRect, 512, 0, 512 + 64, 342);
			thePict = GetPicture(rSidePict2);
			if (thePict !== null) {
				tempByte = HGetState(thePict);
				MoveHHi(thePict);
				HLock(thePict);
				DrawPicture(thePict, tempRect);
				HSetState(thePict, tempByte);
			} else {
				await GenericAlert(kErrNotEnoughMem);
				ExitToShell();
			}
			ReleaseResource(thePict);
		}
		ClipRect(G.wholeArea);
		// load in splash PICT
		if (G.inColor) {
			thePict = GetPicture(rColorIdleID);
		} else {
			thePict = GetPicture(rIdleID);
		}
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

		if (DemoVersion) {
			MoveTo(13, 113);
			TextFont(0); // SystemFont
			if (G.inColor) {
				ForeColor(redColor);
				TextMode(patOr);
				DrawString('DEMO VERSION');
				ForeColor(blackColor);
			} else {
				TextMode(patXor);
				DrawString('DEMO VERSION');
			}
		}
	}

	//------------------------

	async function NewBitMap(theBitMap: BitMap, theRect: Rect): Promise<Ptr> {
		let result: Ptr = 0;
		SpinBall();
		// with theBitMap, theRect do
		theBitMap.rowBytes = Math.trunc((theRect.right - theRect.left + 15) / 16) * 2;
		theBitMap.baseAddr = NewPtr(theBitMap.rowBytes * (theRect.bottom - theRect.top));
		theBitMap.bounds = { ...theRect };
		if (MemError() !== noErr) {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		} else {
			result = theBitMap.baseAddr;
		}
		return result;
	}

	//------------------------

	async function SetUpBitMaps(): Promise<void> {
		let thePict;
		const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
		let tempByte: SignedByte;

		// Init b&w Bitmaps
		// Init offscreen virgin map
		G.offVirginPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offVirginPort);
		G.offVirginBits = await NewBitMap(G.offVirginMap, G.wholeArea);
		SetPortBits(G.offVirginMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offVirginMap.bounds);
		thePict = GetPicture(rIdleID);
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
		if (DemoVersion) {
			MoveTo(13, 113);
			TextFont(0); // SystemFont
			TextMode(patXor);
			DrawString('DEMO VERSION');
		}

		SpinBall();
		// Init offscreen load map
		if (G.areFlipping) {
			G.offLoadPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
			OpenPort(G.offLoadPort);
			{
				// with offLoadMap, ScreenBits.bounds do
				const offLoadMap = G.offLoadMap;
				const bounds = screenBits.bounds;
				offLoadMap.rowBytes = Math.trunc((bounds.right - bounds.left + 15) / 16) * 2;
				offLoadMap.baseAddr = kSecondaryAddr;
				offLoadMap.bounds = { ...screenBits.bounds };
				if (MemError() !== noErr) {
					await GenericAlert(kErrNotEnoughMem);
					ExitToShell();
				} else {
					G.offLoadBits = offLoadMap.baseAddr;
				}
			}
			SetPortBits(G.offLoadMap);
			ClipRect(screenBits.bounds);
			EraseRect(G.offLoadMap.bounds);
		} else {
			G.offLoadPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
			OpenPort(G.offLoadPort);
			G.offLoadBits = await NewBitMap(G.offLoadMap, G.wholeArea);
			SetPortBits(G.offLoadMap);
			ClipRect(G.wholeArea);
			EraseRect(G.offLoadMap.bounds);
		}

		// Init offscreen object map
		G.offPlayerPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offPlayerPort);
		G.offPlayerBits = await NewBitMap(G.offPlayerMap, G.wholeArea);
		SetPortBits(G.offPlayerMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offPlayerMap.bounds);

		// Init offscreen reserve map
		SetRect(tempRect, 0, 0, 192, 116);
		G.offReservePort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offReservePort);
		G.offReserveBits = await NewBitMap(G.offReserveMap, tempRect);
		SetPortBits(G.offReserveMap);
		ClipRect(G.offReserveMap.bounds);
		EraseRect(G.offReserveMap.bounds);
	} // black and white set-up

	//------------------------

	async function SetUpPixMaps(): Promise<void> {
		let thePict;
		let sizeOfOff: LongInt;
		let offRowBytes: LongInt;
		const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
		let theDepth: Integer;
		let tempByte: SignedByte;

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
		// load virgin ports PICT
		SpinBall();
		thePict = GetPicture(rColorIdleID);
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
		if (DemoVersion) {
			MoveTo(13, 113);
			TextFont(0); // SystemFont
			ForeColor(redColor);
			TextMode(patOr);
			DrawString('DEMO VERSION');
			ForeColor(blackColor);
		}

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

		// Init offscreen reserve map
		G.reserveCPtr = G.reserveCPort;
		OpenCPort(G.reserveCPtr);
		SetRect(tempRect, 0, 0, 192, 116);
		offRowBytes = Math.trunc((theDepth * (tempRect.right - tempRect.left) + 15) / 16) * 2;
		sizeOfOff = (tempRect.bottom - tempRect.top) * offRowBytes;
		G.reserveCBits = NewPtr(sizeOfOff);
		if (G.reserveCBits === 0) {
			await GenericAlert(kErrNotEnoughMem);
			ExitToShell();
		}
		{
			// with reserveCPtr^.portPixMap^^ do
			const pm = G.reserveCPtr.portPixMap;
			pm.baseAddr = G.reserveCBits;
			pm.rowBytes = int16(offRowBytes + 0x8000);
			pm.bounds = { ...tempRect };
		}
		RGBForeColor(G.rgbBlack);
		RGBBackColor(G.rgbWhite);
		EraseRect(thePort.portRect);
		ClipRect(thePort.portRect);
	}

	//------------------------

	async function SetUpOffMask(): Promise<void> {
		// Init offscreen mask map
		G.offMaskPort = new GrafPort(); // Port: GrafPtr(NewPtr(SizeOf(GrafPort)))
		OpenPort(G.offMaskPort);
		G.offMaskBits = await NewBitMap(G.offMaskMap, G.wholeArea);
		SetPortBits(G.offMaskMap);
		ClipRect(G.wholeArea);
		EraseRect(G.offMaskMap.bounds);
	}

	//------------------------

	async function GetPrefs(): Promise<void> {
		// type prefType = record … end; (the 'Gprf' resource, 170 bytes)
		const prefType = PRecord({
			theName: PString(24),
			houseName: PString(32),
			resName: PString(32),
			sndVolume: PInteger,
			controlIs: PInteger,
			leftIs: PInteger,
			rightIs: PInteger,
			energyIs: PInteger,
			bandIs: PInteger,
			musicIs: PBoolean,
			channel4Is: PBoolean,
			airVisIs: PBoolean,
			buttonIs: PBoolean,
			restoreIs: PBoolean,
			leftNameIs: PString(12),
			rightNameIs: PString(12),
			energyNameIs: PString(12),
			bandNameIs: PString(12),
			keyBoardIs: PInteger,
		});

		let theirPrefs: Handle | null;
		let pictDeep: Handle | null;
		let refNumber: Integer;
		let tempVol: Integer;
		let satisfactory: boolean;

		//-----------------

		function DefaultControls(): void {
			G.leftKey = kDefaultLeftKey;
			G.rightKey = kDefaultRightKey;
			G.energyKey = kDefaultEnergyKey;
			G.bandKey = kDefaultBandKey;
			G.buttonFires = false;
			G.leftName = kDefaultLeftName;
			G.rightName = kDefaultRightName;
			G.energyName = kDefaultEnergyName;
			G.bandName = kDefaultBandName;
		}

		//-----------------

		function Default(): void {
			if (DemoVersion) {
				G.housesName = 'Demo House';
			} else {
				G.housesName = 'The House';
			}
			G.playerName = 'Your name here...';
			if (G.inColor) {
				G.resourceName = 'Color Art';
			} else {
				G.resourceName = 'B&W Art';
			}

			G.controlMethod = 3;
			CheckItem(GetMenu(mControls)!, G.controlMethod, true);
			G.musicOn = true;
			G.airVisible = false;
			G.buttonFires = false;
			G.restoreColor = true;
			G.is4Channel = true;
			DefaultControls();
		}

		//-----------------

		UseResFile(G.gliderResNum);
		theirPrefs = NewHandle(prefTypeSize);
		if (theirPrefs === null) {
			await GenericAlert(kErrLoadingPrefs);
			Default();
		} else {
			theirPrefs = GetResource('Gprf', 128);
			if (ResError() === noErr && theirPrefs !== null) {
				HLock(theirPrefs);
				{
					// with theirPrefs^^ do
					const prefs = readLayout(prefType, theirPrefs.data, 0);
					G.housesName = prefs.houseName;
					G.playerName = prefs.theName;
					G.resourceName = prefs.resName;
					SetSoundVol(prefs.sndVolume);
					G.controlMethod = prefs.controlIs;
					G.leftKey = prefs.leftIs;
					G.rightKey = prefs.rightIs;
					G.energyKey = prefs.energyIs;
					G.bandKey = prefs.bandIs;
					G.musicOn = prefs.musicIs;
					// Port: Glider's bug, kept: the preference is written instead of read, so
					// is4Channel keeps its initial value. The original writes into the resource in
					// memory, which ReleaseResource then discards; here the copy is changed.
					prefs.channel4Is = G.is4Channel;
					G.airVisible = prefs.airVisIs;
					G.buttonFires = prefs.buttonIs;
					G.restoreColor = prefs.restoreIs;
					G.leftName = prefs.leftNameIs;
					G.rightName = prefs.rightNameIs;
					G.energyName = prefs.energyNameIs;
					G.bandName = prefs.bandNameIs;
					if (prefs.keyBoardIs !== G.herKeyBoard) {
						await GenericAlert(kErrNewKeyboard);
						DefaultControls();
					}
				}
				HUnlock(theirPrefs);
				ReleaseResource(theirPrefs);
			} else {
				await GenericAlert(kErrLoadingPrefs);
				Default();
			}
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
					UseResFile(G.gliderResNum); // back to Gilder res file
					await GenericAlert(kErrGraphicsNotFound); // bitch about all this
					if (!(await DoOpen(kArtType))) {
						await GenericAlert(kErrExitSansGraphics);
						ExitToShell();
					}
					refNumber = OpenResFile(G.resourceName);
				}
			} else {
				UseResFile(G.gliderResNum); // back to Gilder res file
				await GenericAlert(kErrGraphicsNotFound); // bitch about all this
				if (!(await DoOpen(kArtType))) {
					await GenericAlert(kErrExitSansGraphics);
					ExitToShell();
				}
				refNumber = OpenResFile(G.resourceName);
			}
		}

		satisfactory = false; // default to failure
		do {
			UseResFile(refNumber); // make sure we're current
			pictDeep = NewHandle(2);
			if (pictDeep === null) {
				// prepare for 'deep' resource
				await GenericAlert(kErrGraphicLoad);
				ExitToShell();
			}

			pictDeep = GetResource('deep', 128);
			if (ResError() === noErr && pictDeep !== null) {
				HLock(pictDeep);
				if (G.inColor) {
					if (readLayout(PInteger, pictDeep.data, 0) !== 0x0004) {
						// is it a 4-bit color file?
						if (pictDeep !== null) {
							HUnlock(pictDeep);
							ReleaseResource(pictDeep);
							pictDeep = null;
						}
						CloseResFile(refNumber);
						if (G.resourceName !== 'Color Art') {
							G.resourceName = 'Color Art';
							refNumber = OpenResFile(G.resourceName); // lets try this one
						} else {
							await GenericAlert(kErrGraphicsAre2Bit); // sorry, not 4-bit!
							if (!(await DoOpen(kArtType))) {
								// last chance
								await GenericAlert(kErrExitSansGraphics); // you blew it - bye!
								ExitToShell();
							}
							refNumber = OpenResFile(G.resourceName); // okay, we'll try this one
						}
					} else {
						satisfactory = true;
					}
				} else {
					// end - inColor
					// not inColor so...
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
							refNumber = OpenResFile(G.resourceName); // lets try this one
						} else {
							await GenericAlert(kErrGraphicsAre16Bit);
							if (!(await DoOpen(kArtType))) {
								await GenericAlert(kErrExitSansGraphics);
								ExitToShell();
							}
							refNumber = OpenResFile(G.resourceName);
						}
					} else {
						satisfactory = true;
					}
				}
			} else {
				// end - if ((ResError = noErr)...
				// there was an error
				await GenericAlert(kErrGraphicLoad);
				ExitToShell();
			}

			if (pictDeep !== null) {
				HUnlock(pictDeep);
				ReleaseResource(pictDeep);
				pictDeep = null;
			}
		} while (!satisfactory);

		CloseResFile(refNumber);
		UseResFile(G.gliderResNum);

		tempVol = GetSoundVol();
		switch (tempVol) {
			case 0:
				SetSoundVol(0);
				break;
			case 1:
			case 2:
				SetSoundVol(1);
				break;
			case 3:
			case 4:
				SetSoundVol(3);
				break;
			case 5:
			case 6:
				SetSoundVol(5);
				break;
			default:
				SetSoundVol(7);
		}

		if (tempVol === 0) {
			G.soundOn = false;
		} else {
			G.soundOn = !G.inhibitSound;
		}
	}

	//------------------------

	async function LoadPICTs(): Promise<void> {
		let wasPort: GrafPort;
		let thePict;
		let refNumber: Integer;
		let tempByte: SignedByte;

		refNumber = OpenResFile(G.resourceName);
		if (refNumber === -1) {
			UseResFile(G.gliderResNum);
			await GenericAlert(kErrGraphicsNotFound);
			if (!(await DoOpen(kArtType))) {
				await GenericAlert(kErrExitSansGraphics);
				ExitToShell();
			}
			refNumber = OpenResFile(G.resourceName);
			if (refNumber === -1) {
				await GenericAlert(kErrGraphicsNotFound);
				ExitToShell();
			}
		}

		SpinBall();

		wasPort = GetPort();
		if (G.inColor) {
			// load the objects up
			SetPort(G.objectCPtr!);
		} else {
			SetPort(G.offPlayerPort!);
		}

		UseResFile(refNumber);
		thePict = GetPicture(rObjectPictID);
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
		UseResFile(refNumber);
		thePict = GetPicture(rMaskPictID); // load the masks up
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

		SetPort(wasPort);
		CloseResFile(refNumber);
		UseResFile(G.gliderResNum);
	}

	//------------------------

	async function SetUpMenus(): Promise<void> {
		let tempMenu: MenuHandle | null;

		//-------------------

		// Init MENU bar
		ClearMenuBar();
		tempMenu = GetMenu(mApple);
		if (tempMenu !== null) {
			AddResMenu(tempMenu, 'DRVR');
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		tempMenu = GetMenu(mGame);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, 0);
			DisableItem(tempMenu, iEndGame);
			DisableItem(tempMenu, iSaveGame);
			DisableItem(tempMenu, iSaveGameAs);

			if (DemoVersion) {
				DisableItem(tempMenu, iLoadHouse);
				DisableItem(tempMenu, iLoadGame);
			}
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		tempMenu = GetMenu(mOption);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, 0);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		if (G.hasSys7) {
			// add a Help menu item
			const helpMenu = ref<MenuHandle | null>(tempMenu);
			G.theErr = HMGetHelpMenuHandle(helpMenu);
			tempMenu = helpMenu.v;
			if (G.theErr === noErr) {
				if (tempMenu !== null) {
					AppendMenu(tempMenu, 'Glider Help');
					G.iGlidersHelp = CountMItems(tempMenu);
				} else {
					tempMenu = GetMenu(mOption)!;
					AppendMenu(tempMenu, '(-');
					AppendMenu(tempMenu, 'Help');
				}
			} else {
				tempMenu = GetMenu(mOption)!;
				AppendMenu(tempMenu, '(-');
				AppendMenu(tempMenu, 'Help');
			}
		} else {
			AppendMenu(tempMenu, '(-');
			AppendMenu(tempMenu, 'Help');
		}

		tempMenu = GetMenu(mControls);
		if (tempMenu !== null) {
			InsertMenu(tempMenu, -1);
		} else {
			await GenericAlert(kErrUnknownAtInit);
			ExitToShell();
		}

		if (G.airVisible) {
			SetItem(GetMenu(mOption)!, iShowAir, 'Air is Visible');
		} else {
			SetItem(GetMenu(mOption)!, iShowAir, 'Air is Invisible');
		}
		if (G.restoreColor) {
			SetItem(GetMenu(mOption)!, iRestoreDeep, 'Depth Restore is On');
		} else {
			SetItem(GetMenu(mOption)!, iRestoreDeep, 'Depth Restore is Off');
		}
		if (G.cantColor || G.cantSwitch) {
			DisableItem(GetMenu(mOption)!, iRestoreDeep);
		}

		CheckItem(GetMenu(mControls)!, G.controlMethod, true);

		SetPort(G.mainWndo!);
		HideMenuBar();
		ShowMenuBar();
	}

	//------------------------

	async function PrepareSounds(): Promise<boolean> {
		const lastSound = 28;

		let theSnd: Handle | null;
		let itFailed: boolean;

		itFailed = false;
		G.cantMusic = false;

		G.smsIsActive = false;
		ErrorSound(DoErrorSound);

		UseResFile(G.gliderResNum);

		for (let i = 1; i <= lastSound; i++) {
			theSnd = GetResource('SMSD', i);
			if (theSnd !== null && MemError() === noErr) {
				MoveHHi(theSnd);
				HLock(theSnd);
			} else {
				itFailed = true;
				G.inhibitSound = true;
				G.soundOn = false;
				break;
			}
		}

		if (G.musicOn) {
			theSnd = GetResource('SMSD', kDuhDumSound);
			if (theSnd !== null && MemError() === noErr) {
				MoveHHi(theSnd);
				HLock(theSnd);
			} else {
				G.cantMusic = true;
				G.musicOn = false;
				await GenericAlert(kErrBackgroundMusic);
			}

			theSnd = GetResource('SMSD', kMusicSound);
			if (theSnd !== null && MemError() === noErr) {
				MoveHHi(theSnd);
				HLock(theSnd);
			} else {
				G.cantMusic = true;
				G.musicOn = false;
				await GenericAlert(kErrBackgroundMusic);
			}
		}

		return !itFailed;
	}

	//------------------------

	function InitAllOtherGlobalVars(): void {
		let i: Integer;
		let i2: Integer;
		const tileRects = G.tileRects;
		const glideRct = G.glideRct;
		const nextPhase = G.nextPhase;
		const srcRect = G.srcRect;
		const animateRct = G.animateRct;

		G.doneFlag = false;
		G.playing = false;
		G.pausing = false;
		G.refuseHigh = false;
		G.mainScreenHidden = false;

		G.binaryFlip = 0;
		setRandSeed(GetDateTime()); // GetDateTime(RandSeed)
		G.scoreList.rank = 20;

		for (i = 0; i <= 7; i++) {
			SpinBall();
			SetRect(tileRects[i] as Rect, i * 64, 0, (i + 1) * 64, 342);
		}

		SetRect(G.shadoRct[0] as Rect, 256, 0, 304, 11);
		SetRect(G.shadoRct[1] as Rect, 256, 12, 304, 23);

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
		SetRect(glideRct[24] as Rect, 256, 24, 304, 60); // burning
		SetRect(glideRct[25] as Rect, 256, 61, 304, 97);
		SetRect(glideRct[26] as Rect, 256, 98, 304, 134);
		SetRect(glideRct[27] as Rect, 256, 135, 304, 171);

		for (i2 = 0; i2 <= 3; i2++) {
			// column
			for (i = 0; i <= 3; i++) {
				// row
				SetRect(G.reserveRects[i2 * 4 + i + 1] as Rect, i * 48, i2 * 29, 1 * 48 + 48, i2 * 29 + 29);
			}
		}

		SpinBall();
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
		const src = (n: number): Rect => srcRect[n] as Rect;
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
		const anim = (k: number, n: number): Rect => (animateRct[k] as Rect[])[n] as Rect;
		SetRect(anim(0, -1), 304, 0, 368, 22); // crushed dart
		SetRect(anim(0, 0), 48, 0, 112, 22); // dart...
		SetRect(anim(0, 1), 48, 0, 112, 22);
		SetRect(anim(0, 2), 48, 0, 112, 22);
		SetRect(anim(0, 3), 48, 0, 112, 22);
		SetRect(anim(0, 4), 48, 0, 112, 22);
		SetRect(anim(0, 5), 48, 0, 112, 22);
		SetRect(anim(0, 6), 48, 0, 112, 22);
		SetRect(anim(0, 7), 48, 0, 112, 22);

		SetRect(anim(1, -1), 304, 276, 336, 308); // crushed 'copter
		SetRect(anim(1, 0), 160, 0, 192, 32); // 'copter...
		SetRect(anim(1, 1), 160, 33, 192, 65);
		SetRect(anim(1, 2), 160, 66, 192, 98);
		SetRect(anim(1, 3), 160, 99, 192, 131);
		SetRect(anim(1, 4), 160, 132, 192, 164);
		SetRect(anim(1, 5), 160, 165, 192, 197);
		SetRect(anim(1, 6), 160, 198, 192, 230);
		SetRect(anim(1, 7), 160, 231, 192, 263);

		SetRect(anim(2, -1), 304, 309, 336, 341); // popped balloon
		SetRect(anim(2, 0), 112, 229, 144, 261); // balloon...
		SetRect(anim(2, 1), 112, 229, 144, 261);
		SetRect(anim(2, 2), 112, 262, 144, 294);
		SetRect(anim(2, 3), 112, 262, 144, 294);
		SetRect(anim(2, 4), 112, 295, 144, 327);
		SetRect(anim(2, 5), 112, 295, 144, 327);
		SetRect(anim(2, 6), 112, 262, 144, 294);
		SetRect(anim(2, 7), 112, 262, 144, 294);

		SetRect(G.bandRct[0] as Rect, 192, 155, 208, 162);
		SetRect(G.bandRct[1] as Rect, 192, 163, 208, 170);
		SetRect(G.bandRct[2] as Rect, 192, 171, 208, 178);
	}

	//------------------------

	InitToolBox();

	await CheckOurEnvirons();

	await LoadCursors();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	InitGlobalRects();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	if (G.inColor) {
		SetUpColors();
	}

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	await SetUpMainWndo();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	if (G.inColor) {
		await SetUpPixMaps();
	} else {
		await SetUpBitMaps();
	}

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	await SetUpOffMask();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	G.wasSndVolume = GetSoundVol();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	{
		const vol = ref(G.houseVolNum);
		G.theErr = GetVol(ignoreStr, vol);
		G.houseVolNum = vol.v;
	}

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	await GetPrefs();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	if (!(await GetHouse())) {
		await GenericAlert(kErrLoadingDfltHouse);
		ExitToShell();
	}
	G.defaultHouse = G.housesName;

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	await LoadPICTs();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	await SetUpMenus();

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	if (!(await PrepareSounds())) {
		await GenericAlert(kErrNoSounds);
	}
	if (G.inhibitSound) {
		DisableItem(GetMenu(mOption)!, iSound);
	}

	for (i = 0; i <= 32; i++) {
		SpinBall();
	}
	InitAllOtherGlobalVars();

	InitCursor();
}

/** SIZEOF(prefType): the 'Gprf' record is 170 bytes. */
const prefTypeSize = 170;

/** Port: reads an 'acur' resource into Glider's acur record. */
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

export async function DoStartUp(): Promise<void> {
	const theMessage = ref<Integer>(0);
	const numDocs = ref<Integer>(0);
	const docInfo: AppFile = { vRefNum: 0, fType: '', versNum: 0, fName: '' };

	CountAppFiles(theMessage, numDocs);
	if (theMessage.v === appPrint) {
		await GenericAlert(kErrNothingToPrint);
		ExitToShell();
	}
	if (numDocs.v !== 0) {
		GetAppFiles(1, docInfo);
		{
			// with docInfo do
			if (docInfo.fType === 'GLgm') {
				if (DemoVersion) {
					await GenericAlert(kErrDemoRefuseHouse);
				} else {
					G.gameName = docInfo.fName;
					G.gameVolNum = docInfo.vRefNum;
					if (!(await GetGame())) {
						return;
					}
					EnableItem(GetMenu(mGame)!, iSaveGame);
				}
			} else if (docInfo.fType === 'GLhs') {
				// if fType = 'GLgm'
				// if fType <> 'GLgm'
				if (DemoVersion) {
					await GenericAlert(kErrDemoRefuseHouse);
				} else {
					G.houseVolNum = docInfo.vRefNum;
					G.housesName = docInfo.fName;

					G.demoMode = Randomize(lastDemo) + 1;
					HideMenuBar();
					await StartNewGame();
				}
			} else {
				await GenericAlert(kErrStartUpWrongType);
			}
			ClrAppFiles(1);
		} // with docInfo do
	} // if (numDocs <> 0) then
}
