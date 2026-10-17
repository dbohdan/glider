// Port of G-PlaySetUp.p.

import {
	black,
	blackColor,
	Button,
	CloseResFile,
	CopyBits,
	CopyMask,
	DisableItem,
	Delay,
	DisposeRgn,
	DrawPicture,
	DrawString,
	EnableItem,
	EraseRgn,
	FillRect,
	FillRgn,
	FlushEvents,
	ForeColor,
	FrameRect,
	GetKeys,
	GetMenu,
	GetMouse,
	GetPicture,
	HGetState,
	HLock,
	HSetState,
	HUnlock,
	InitCursor,
	InsetRect,
	type Integer,
	keyDown,
	Line,
	LineTo,
	type LongInt,
	mouse,
	MoveHHi,
	MoveTo,
	NumToString,
	OffsetRect,
	OpenResFile,
	PaintRect,
	patOr,
	patXor,
	PenMode,
	PenNormal,
	PenPat,
	type Point,
	PostEvent,
	type Rect,
	redColor,
	ReleaseResource,
	RGBForeColor,
	SetPort,
	SetRect,
	SMSExit,
	srcCopy,
	srcOr,
	systemFont,
	TextFont,
	TextMode,
	TextSize,
	TickCount,
	UnionRect,
	UseResFile,
	white,
	Yield,
	Concat,
	div,
	everyEvent,
	pArray,
} from '../mac/Toolbox.ts';
import {
	awardIt,
	airOnIt,
	bandIt,
	bottomOfRoom,
	celDct,
	DemoVersion,
	dnStar,
	energizeIt,
	extraIt,
	G,
	iEndGame,
	iHiScores,
	iLoadGame,
	iLoadHouse,
	iSaveGame,
	iSaveGameAs,
	kArtType,
	kBassFract,
	kBonusTimeToBeat,
	kCeilingVert,
	kErrGraphicLoad,
	kErrGraphicsNotFound,
	kFloorVert,
	kMinBassLoop,
	kReturnKeyMap,
	leftOfRoom,
	lightIt,
	mGame,
	mOption,
	rColorIdleID,
	rFarmPict,
	rIdleID,
	rightOfRoom,
	topOfRoom,
	trickIt,
	upStar,
	whoCares,
} from './Globals.ts';
import { CalcRoomScore, DissBlocks, DoTheSound, GenericAlert, Randomize, RedrawWindowFrame, ShowMenuBar } from './GlobalUtils.ts';
import { DoOpen, GetHouse, WriteHouse } from './FileInNOut.ts';
import { ForceMainToVisible, ReadyRoom, ResetGlider, SortHiScores, StartScoreRolling } from './PlayUtils.ts';

const newRect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });

//=================================

export function HorizonMouse(): void {
	// The low memory mouse globals: MBState = $172, MTemp = $828, RawMouse = $82C, Mouse = $830,
	// CrsrNew = $8CE, CrsrCouple = $8CF; Couple = $FF, Uncouple = $00.
	const horizon: Point = { v: 0, h: 0 };

	GetMouse(horizon);
	horizon.v = 160;
	// Port: Glider writes horizon to RawMouse and MTemp and $FF to CrsrNew, which moves the mouse
	// (and the cursor) to that point taken as global coordinates. The port's mouse is the
	// Toolbox's mouse state.
	mouse.where = { ...horizon };
}

//=================================

async function ClosingAnimation(): Promise<void> {
	const waitTicks = 4;
	let i: Integer, refNumber: Integer, whichTwist: Integer;
	const twisterDst = newRect();
	const tinyGliderDst = newRect();
	const tinyGliderSrc = newRect();
	let wasRect: Rect, wasGlider: Rect;
	const boltRect = newRect();
	const twisterSrc = pArray(0, 3, newRect);
	let timeWas: LongInt;
	let tempByte: Integer;
	let boltWasCast: boolean, hasLetUpOnButton: boolean;

	//--------------

	function CastBolt(): void {
		const cloudBottom = 140;
		const boltLength = 8;
		let i: Integer, start: Integer, finish: Integer;

		SetRect(boltRect, 512, cloudBottom, 0, (boltLength + 1) * 8 + cloudBottom + 2);

		if (G.inColor) {
			RGBForeColor(G.rgbWhite);
		} else {
			PenPat(white);
		}

		start = Randomize(100) + 200;

		for (i = 0; i <= boltLength; i++) {
			finish = Randomize(7) - 3 + start;
			MoveTo(start, i * 8 + cloudBottom + 1);
			LineTo(finish, (i + 1) * 8 + cloudBottom);

			if (start <= boltRect.left) {
				boltRect.left = start;
			}
			if (finish <= boltRect.left) {
				boltRect.left = finish;
			}
			if (start >= boltRect.right) {
				boltRect.right = start;
			}
			if (finish >= boltRect.right) {
				boltRect.right = finish;
			}

			start = finish;
		}

		if (G.inColor) {
			RGBForeColor(G.rgbBlack);
		} else {
			PenPat(black);
		}
		boltWasCast = true;
		InsetRect(boltRect, -2, 0);
	}

	//--------------

	await RedrawWindowFrame();

	SetRect(twisterSrc[0]!, 208, 126, 256, 188);
	SetRect(twisterSrc[1]!, 208, 189, 256, 251);
	SetRect(twisterSrc[2]!, 208, 252, 256, 314);
	SetRect(twisterSrc[3]!, 256, 268, 304, 330);
	SetRect(tinyGliderSrc, 235, 315, 256, 325);

	Object.assign(twisterDst, twisterSrc[0]);
	OffsetRect(twisterDst, -twisterDst.left, -twisterDst.top);
	OffsetRect(twisterDst, 230, 138);

	Object.assign(tinyGliderDst, tinyGliderSrc);
	OffsetRect(tinyGliderDst, -tinyGliderDst.left, -tinyGliderDst.top);
	OffsetRect(tinyGliderDst, 420, 90);
	wasGlider = { ...tinyGliderDst };

	boltWasCast = false;

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	refNumber = OpenResFile(G.resourceName);
	if (refNumber === -1) {
		UseResFile(G.gliderResNum);
		await GenericAlert(kErrGraphicsNotFound);
		ShowMenuBar();
		if (!(await DoOpen(kArtType))) {
			return;
		}
		refNumber = OpenResFile(G.resourceName);
		if (refNumber === -1) {
			await GenericAlert(kErrGraphicsNotFound);
			ShowMenuBar();
			return;
		}
	}

	const thePict = GetPicture(rFarmPict);
	if (thePict !== null) {
		tempByte = HGetState(thePict);
		MoveHHi(thePict);
		HLock(thePict);
		DrawPicture(thePict, G.wholeArea);
		HSetState(thePict, tempByte);
		ReleaseResource(thePict);
	} else {
		await GenericAlert(kErrGraphicLoad);
	}

	CloseResFile(refNumber);
	UseResFile(G.gliderResNum);

	DissBlocks();
	whichTwist = 0;

	PenNormal();
	if (G.inColor) {
		SetPort(G.mainWndo!);
	} else {
		SetPort(G.mainWndo!);
	}

	hasLetUpOnButton = false;

	for (i = 1; i <= 200; i++) {
		timeWas = TickCount() + waitTicks;
		wasRect = { ...twisterDst };

		whichTwist = i % 4;
		if (i % 4 === 0) {
			whichTwist = whichTwist + 1;
			if (whichTwist > 3) {
				whichTwist = 0;
			}
			OffsetRect(twisterDst, -1, 0);
			wasRect.right = wasRect.right + 1;
		}

		OffsetRect(tinyGliderDst, -2, -(i % 2));
		wasGlider = { ...tinyGliderDst };
		wasGlider.right = wasGlider.right + 2;
		wasGlider.bottom = wasGlider.bottom + 1;

		if (Randomize(20) === 0) {
			CastBolt();
		}

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, wasRect, wasRect, srcCopy, null);
			CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, twisterSrc[whichTwist]!, twisterSrc[whichTwist]!, twisterDst);
			CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, wasRect, wasRect, srcCopy, null);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, wasRect, wasRect, srcCopy, null);
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, twisterSrc[whichTwist]!, twisterSrc[whichTwist]!, twisterDst);
			CopyBits(G.offLoadMap, G.mainWndo!.portBits, wasRect, wasRect, srcCopy, null);
		}

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, wasGlider, wasGlider, srcCopy, null);
			CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, tinyGliderSrc, tinyGliderSrc, tinyGliderDst);
			CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, wasGlider, wasGlider, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, wasGlider, wasGlider, srcCopy, null);
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, tinyGliderSrc, tinyGliderSrc, tinyGliderDst);
			CopyBits(G.offLoadMap, G.mainWndo!.portBits, wasGlider, wasGlider, srcCopy, G.wholeRgn);
		}

		do {
			if (Button()) {
				if (hasLetUpOnButton) {
					break;
				}
			} else {
				hasLetUpOnButton = true;
			}
			GetKeys(G.theKeys);
			if (G.theKeys[kReturnKeyMap]) {
				break;
			}
			await Yield();
		} while (!(TickCount() > timeWas));

		timeWas = TickCount() + waitTicks;

		if (Button()) {
			if (hasLetUpOnButton) {
				break;
			}
		} else {
			hasLetUpOnButton = true;
		}
		GetKeys(G.theKeys);
		if (G.theKeys[kReturnKeyMap]) {
			break;
		}

		if (boltWasCast) {
			DoTheSound(17);
			if (G.inColor) {
				CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, boltRect, boltRect, srcCopy, G.wholeRgn);
			} else {
				CopyBits(G.offVirginMap, G.mainWndo!.portBits, boltRect, boltRect, srcCopy, G.wholeRgn);
			}
			boltWasCast = false;
		}
	}
}

//=================================

async function GameOver(): Promise<void> {
	const timeBetween = 6;
	let i: Integer, i2: Integer, whichLetter: Integer;
	let _dummyLong: LongInt;
	const letters = pArray(0, 6, newRect);
	const dest = newRect();
	let tempStr: string;
	let hasLetUpOnButton: boolean;

	SetRect(letters[0]!, 375, 33, 409, 78); // G
	SetRect(letters[1]!, 375, 77, 409, 122); // a
	SetRect(letters[2]!, 375, 121, 409, 166); // m
	SetRect(letters[3]!, 375, 165, 409, 210); // e
	SetRect(letters[4]!, 375, 209, 409, 254); // O
	SetRect(letters[5]!, 375, 253, 409, 298); // v
	SetRect(letters[6]!, 375, 297, 409, 342); // r

	hasLetUpOnButton = false;

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
	FillRect(G.wholeArea, black);
	tempStr = NumToString(G.roomScore + G.suppScore);
	if (G.inColor) {
		PenNormal();
		TextFont(204);
		TextSize(32);
		MoveTo(120, 80);
		RGBForeColor(G.rgbYellow);
		PenMode(srcOr);
		DrawString(tempStr);
		PenNormal();
		RGBForeColor(G.rgbBlack);
		TextFont(systemFont);
		TextSize(12);
	} else {
		TextFont(204);
		TextSize(32);
		TextMode(patXor);
		MoveTo(120, 80);
		DrawString(tempStr);
		TextFont(systemFont);
		TextSize(12);
	}

	DissBlocks();

	SetRect(dest, 0, 0, 34, 45);
	OffsetRect(dest, 113, 100);

	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[0]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[0]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[1]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[1]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[2]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[2]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[3]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[3]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[4]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[4]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[5]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[5]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[3]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[3]!, dest, srcCopy, null);
	}
	OffsetRect(dest, 36, 0);
	_dummyLong = await Delay(timeBetween);
	DoTheSound(21);
	if (G.inColor) {
		CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[6]!, dest, srcCopy, null);
	} else {
		CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[6]!, dest, srcCopy, null);
	}

	for (i = 1; i <= 20; i++) {
		if (Button()) {
			if (hasLetUpOnButton) {
				break;
			}
		} else {
			hasLetUpOnButton = true;
		}
		GetKeys(G.theKeys);
		if (G.theKeys[kReturnKeyMap]) {
			break;
		}

		SetRect(dest, 0, 0, 34, 45);
		OffsetRect(dest, 113, 100 + i * 8);
		for (i2 = 0; i2 <= 7; i2++) {
			SetRect(letters[0]!, 375, 33, 409, 78); // G
			SetRect(letters[1]!, 375, 77, 409, 122); // a
			SetRect(letters[2]!, 375, 121, 409, 166); // m
			SetRect(letters[3]!, 375, 165, 409, 210); // e
			SetRect(letters[4]!, 375, 209, 409, 254); // O
			SetRect(letters[5]!, 375, 253, 409, 298); // v
			SetRect(letters[6]!, 375, 297, 409, 342); // r
			if (i2 === 6) {
				whichLetter = 3;
			} else if (i2 === 7) {
				whichLetter = 6;
			} else {
				whichLetter = i2;
			}
			OffsetRect(dest, Randomize(i * 2 + 1) - i, 0);

			_dummyLong = await Delay(1);

			if (G.inColor) {
				CopyBits(G.objectCPtr!.portPixMap, G.mainWndo!.portBits, letters[whichLetter]!, dest, srcCopy, null);
			} else {
				CopyBits(G.offPlayerMap, G.mainWndo!.portBits, letters[whichLetter]!, dest, srcCopy, null);
			}
			OffsetRect(dest, 36, 0);
		}
	}

	for (i = 1; i <= 200; i++) {
		_dummyLong = await Delay(1);
		if (Button()) {
			if (hasLetUpOnButton) {
				break;
			}
		} else {
			hasLetUpOnButton = true;
		}
		GetKeys(G.theKeys);
		if (G.theKeys[kReturnKeyMap]) {
			break;
		}
	}
}

//=================================

export async function WrapItUp(): Promise<void> {
	let tempByte: Integer;

	G.playing = false;
	G.pausing = false;

	if (G.hasMirror) {
		G.hasMirror = false;
		HUnlock(G.mirrorRgn);
		DisposeRgn(G.mirrorRgn!);
	}
	if (G.hasWindow) {
		G.hasWindow = false;
		HUnlock(G.windowRgn);
		DisposeRgn(G.windowRgn!);
	}
	if (G.hasToast) {
		G.hasToast = false;
		HUnlock(G.toastRgn);
		DisposeRgn(G.toastRgn!);
	}

	ForceMainToVisible();

	FlushEvents(everyEvent, 0);
	G.theErr = PostEvent(keyDown, 65);
	await RedrawWindowFrame();
	await GameOver();
	ShowMenuBar();

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	let thePict;
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
		ReleaseResource(thePict);
	} else {
		await GenericAlert(kErrGraphicLoad);
	}

	if (DemoVersion) {
		MoveTo(13, 113);
		TextFont(systemFont);
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

	DissBlocks();

	if (!DemoVersion) {
		EnableItem(GetMenu(mGame)!, iLoadHouse);
	}
	DisableItem(GetMenu(mGame)!, iEndGame);
	if (!DemoVersion) {
		EnableItem(GetMenu(mGame)!, iLoadGame);
	}
	DisableItem(GetMenu(mGame)!, iSaveGame);
	DisableItem(GetMenu(mGame)!, iSaveGameAs);
	EnableItem(GetMenu(mOption)!, iHiScores);

	InitCursor();
	await SortHiScores();

	if (G.smsIsActive) {
		SMSExit();
	}
	G.smsIsActive = false;
}

//=================================

/** Port: thrown by AdvanceAFile's ExitGracefully to leave AdvanceAFile (Pascal `Exit(AdvanceAFile)`). */
class ExitAdvanceAFile extends Error {}

async function AdvanceAFile(): Promise<void> {
	let i: Integer;
	let wasHouse: string, newHouse: string;

	//----------

	async function ExitGracefully(): Promise<never> {
		G.roomAt = 0;
		G.roomsPassed = G.roomsPassed - 1;
		await ClosingAnimation();
		await WrapItUp();
		throw new ExitAdvanceAFile();
	}

	//----------

	try {
		wasHouse = G.housesName;
		G.housesName = G.thisHouse.nextFile;
		G.fileWasLost = false;

		if (!(await GetHouse())) {
			await ExitGracefully();
		}

		if (G.fileWasLost) {
			newHouse = G.housesName;
			G.housesName = wasHouse;

			if (!(await GetHouse())) {
				await ExitGracefully();
			}

			G.thisHouse.nextFile = newHouse;

			if (!(await WriteHouse())) {
				await ExitGracefully();
			}

			G.housesName = G.thisHouse.nextFile;

			if (!(await GetHouse())) {
				await ExitGracefully();
			}
		}

		CalcRoomScore();
		G.suppScore = G.suppScore + G.roomScore;
		for (i = 1; i <= 40; i++) {
			G.roomVisits[i] = false;
		}
		G.roomScore = 0;
	} catch (e) {
		if (!(e instanceof ExitAdvanceAFile)) {
			throw e;
		}
	}
}

//=================================

export async function OffAMortal(): Promise<void> {
	const tempRect = newRect();
	let tempStr: string;

	const theGlider = G.theGlider;
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.wholeRect, theGlider.wholeRect, srcCopy, G.wholeRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.wholeShado, theGlider.wholeShado, srcCopy, G.wholeRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.wholeRect, theGlider.wholeRect, srcCopy, G.wholeRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.wholeShado, theGlider.wholeShado, srcCopy, G.wholeRgn);
	} else {
		UnionRect(theGlider.destRect, theGlider.oldRect, theGlider.wholeRect);
		UnionRect(theGlider.shadoDest, theGlider.oldShado, theGlider.wholeShado);
		CopyBits(G.offVirginMap, G.offLoadMap, theGlider.wholeRect, theGlider.wholeRect, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.offLoadMap, theGlider.wholeShado, theGlider.wholeShado, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.wholeRect, theGlider.wholeRect, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.wholeShado, theGlider.wholeShado, srcCopy, G.wholeRgn);
	}
	if (G.hasMirror) {
		SetPort(G.mainWndo!);
		EraseRgn(G.mirrorRgn!);

		if (G.inColor) {
			SetPort(G.loadCPtr!);
		} else {
			SetPort(G.offLoadPort!);
		}
		EraseRgn(G.mirrorRgn!);

		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
	}
	if (G.hasWindow) {
		SetPort(G.mainWndo!);
		FillRgn(G.windowRgn!, black);

		if (G.inColor) {
			SetPort(G.loadCPtr!);
		} else {
			SetPort(G.offLoadPort!);
		}
		FillRgn(G.windowRgn!, black);

		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
	}

	G.mortals = G.mortals - 1;
	if (G.mortals < 1) {
		await WrapItUp();
		return;
	}

	if (G.mortals < 4) {
		// hide a token glider
		SetRect(tempRect, 470, 5, 505, 20);
		OffsetRect(tempRect, -37 * (G.mortals - 1), 0);
		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
		PenNormal();
		PaintRect(tempRect);
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, tempRect, tempRect, srcCopy, G.wholeRgn);
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, tempRect, tempRect, srcCopy, G.wholeRgn);
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
		}
		SetRect(tempRect, 384, 5, 397, 20);
		PaintRect(tempRect);
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, tempRect, tempRect, srcCopy, null);
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, tempRect, tempRect, srcCopy, null);
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
		}
	} else {
		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
		PenNormal();
		SetRect(tempRect, 384, 5, 396, 20);
		PaintRect(tempRect);
		MoveTo(tempRect.left, tempRect.bottom - 2);
		TextFont(16);
		TextSize(12);
		tempStr = NumToString(G.mortals - 1);
		if (G.inColor) {
			RGBForeColor(G.rgbRed);
			PenMode(srcOr);
			DrawString(tempStr);
			PenNormal();
			RGBForeColor(G.rgbBlack);
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, tempRect, tempRect, srcCopy, null);
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
		} else {
			TextMode(patXor);
			DrawString(tempStr);
			PenNormal();
			CopyBits(G.offVirginMap, G.offLoadMap, tempRect, tempRect, srcCopy, null);
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
		}
	}

	ResetGlider();
}

//=================================

async function CheckForTimeBonus(): Promise<void> {
	let tempStr: string;
	const tempRect = newRect();
	let timeBonus: LongInt, _dummyLong: LongInt;
	let i: Integer;

	timeBonus = 0;
	if (G.loopsThruRoom < kBonusTimeToBeat) {
		timeBonus = (kBonusTimeToBeat - G.loopsThruRoom) * (div(G.roomAt, 5) + 1);
	}
	G.suppScore = G.suppScore + timeBonus;

	G.loopsThruRoom = 0;

	tempStr = NumToString(timeBonus);
	tempStr = Concat('Time Bonus = ', tempStr);
	SetRect(tempRect, 190, 100, 312, 117);

	SetPort(G.mainWndo!);
	if (G.inColor) {
		PenNormal();
		PaintRect(tempRect);
		PenMode(patXor);
		InsetRect(tempRect, 1, 1);
		FrameRect(tempRect);
		PenNormal();
		InsetRect(tempRect, -1, -1);
		RGBForeColor(G.rgbYellow);
		TextFont(16);
		TextSize(12);
		PenMode(srcOr);
		MoveTo(tempRect.left + 3, tempRect.bottom - 4);
		DrawString(tempStr);
		RGBForeColor(G.rgbBlack);

		SetPort(G.virginCPtr!);
		PenNormal();
		PaintRect(tempRect);
		PenMode(patXor);
		InsetRect(tempRect, 1, 1);
		FrameRect(tempRect);
		PenNormal();
		InsetRect(tempRect, -1, -1);
		RGBForeColor(G.rgbYellow);
		PenNormal();
		TextFont(16);
		TextSize(12);
		PenMode(srcOr);
		MoveTo(tempRect.left + 3, tempRect.bottom - 4);
		DrawString(tempStr);
		RGBForeColor(G.rgbBlack);
	} else {
		PenNormal();
		PaintRect(tempRect);
		PenMode(patXor);
		InsetRect(tempRect, 1, 1);
		FrameRect(tempRect);
		PenNormal();
		InsetRect(tempRect, -1, -1);
		TextFont(16);
		TextSize(12);
		TextMode(patXor);
		MoveTo(tempRect.left + 3, tempRect.bottom - 4);
		DrawString(tempStr);
		PenNormal();

		SetPort(G.offVirginPort!);
		PenNormal();
		PaintRect(tempRect);
		PenMode(patXor);
		InsetRect(tempRect, 1, 1);
		FrameRect(tempRect);
		PenNormal();
		InsetRect(tempRect, -1, -1);
		TextFont(16);
		TextSize(12);
		TextMode(patXor);
		MoveTo(tempRect.left + 3, tempRect.bottom - 4);
		DrawString(tempStr);
		PenNormal();

		SetPort(G.offLoadPort!);
		PenNormal();
		PaintRect(tempRect);
		PenMode(patXor);
		InsetRect(tempRect, 1, 1);
		FrameRect(tempRect);
		PenNormal();
		InsetRect(tempRect, -1, -1);
		TextFont(16);
		TextSize(12);
		TextMode(patXor);
		MoveTo(tempRect.left + 3, tempRect.bottom - 4);
		DrawString(tempStr);
		PenNormal();
	}

	for (i = 1; i <= 30; i++) {
		HorizonMouse();
		_dummyLong = await Delay(1);
	}
}

//=================================

async function SetRoomState(): Promise<void> {
	let oldRoomScore: LongInt;
	let i: Integer;

	if (G.didntExitEntrance) {
		G.roomVisits[G.roomAt] = true;
	}
	G.bassLoop = 0;
	G.playBassTime = div(kBonusTimeToBeat, kBassFract) + kMinBassLoop;

	StartScoreRolling();

	oldRoomScore = G.roomScore;
	CalcRoomScore();
	if (oldRoomScore < G.roomScore && G.didntExitEntrance) {
		await CheckForTimeBonus();
	}
	G.loopsThruRoom = 0;

	for (i = 1; i <= G.nObjects; i++) {
		switch (G.eventKind[i]![0]) {
			case awardIt:
			case extraIt:
			case energizeIt:
			case bandIt:
			case trickIt:
				G.thisHouse.theRooms[G.roomAt]!.theObjects[i]!.amount = G.eventKind[i]![1]!;
				break;
			case lightIt:
			case airOnIt:
				if (!G.lightsOut && !G.airOut) {
					G.thisHouse.theRooms[G.roomAt]!.conditionCode = 0;
				}
				break;
			default:
		}
	}

	if (G.hasMirror) {
		SetPort(G.mainWndo!);
		EraseRgn(G.mirrorRgn!);

		if (G.inColor) {
			SetPort(G.loadCPtr!);
		} else {
			SetPort(G.offLoadPort!);
		}
		EraseRgn(G.mirrorRgn!);

		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
	}

	const theGlider = G.theGlider;
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offVirginMap, G.offLoadMap, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.offLoadMap, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
	}
}

//=================================

async function ScrollForward(): Promise<void> {
	const srcRect = newRect();
	let waitTicks: LongInt;
	let index: Integer;

	const theGlider = G.theGlider;
	theGlider.destRect.left = 0;
	theGlider.destRect.right = 48;
	theGlider.oldRect = { ...theGlider.destRect };
	theGlider.wholeRect = { ...theGlider.destRect };
	theGlider.shadoDest.left = 0;
	theGlider.shadoDest.right = 48;
	theGlider.oldShado = { ...theGlider.shadoDest };
	theGlider.wholeShado = { ...theGlider.shadoDest };
	theGlider.touchRect = { ...theGlider.destRect };
	InsetRect(theGlider.touchRect, 10, 5);

	SetRect(srcRect, 496, 0, 512, 342);

	for (index = 0; index <= 31; index++) {
		HorizonMouse();

		waitTicks = TickCount();
		do {
			await Yield();
		} while (!(TickCount() > waitTicks));

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.left - 1, srcRect.top);
			Line(0, 322);
			SetPort(G.virginCPtr!);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.left - 1, srcRect.top);
			Line(0, 322);
			SetPort(G.offVirginPort!);
		}

		srcRect.right = srcRect.right - 16;
		srcRect.left = srcRect.left - 16;
	}
}

//=================================

async function ScrollBackward(): Promise<void> {
	const srcRect = newRect();
	let waitTicks: LongInt;
	let index: Integer;

	const theGlider = G.theGlider;
	theGlider.destRect.left = 464;
	theGlider.destRect.right = 512;
	theGlider.oldRect = { ...theGlider.destRect };
	theGlider.wholeRect = { ...theGlider.destRect };
	theGlider.shadoDest.left = 464;
	theGlider.shadoDest.right = 512;
	theGlider.oldShado = { ...theGlider.shadoDest };
	theGlider.wholeShado = { ...theGlider.shadoDest };
	theGlider.touchRect = { ...theGlider.destRect };
	InsetRect(theGlider.touchRect, 10, 5);

	SetRect(srcRect, 0, 0, 16, 342);

	if (G.inColor) {
		CopyBits(G.mainWndo!.portBits, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, null);
	} else {
		CopyBits(G.mainWndo!.portBits, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, null);
	}

	for (index = 0; index <= 31; index++) {
		HorizonMouse();

		waitTicks = TickCount();
		do {
			await Yield();
		} while (!(TickCount() > waitTicks));

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.right, srcRect.top);
			Line(0, 322);
			SetPort(G.virginCPtr!);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.right, srcRect.top);
			Line(0, 322);
			SetPort(G.offVirginPort!);
		}

		srcRect.right = srcRect.right + 16;
		srcRect.left = srcRect.left + 16;
	}
}

//=================================

async function ScrollUp(): Promise<void> {
	const srcRect = newRect();
	let waitTicks: LongInt;
	let index: Integer, leftCorner: Integer;

	leftCorner = 232;
	for (index = 1; index <= 16; index++) {
		const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[index]!;
		if (theObject.objectIs === dnStar) {
			leftCorner = theObject.boundRect.left + 64;
		}
	}

	const theGlider = G.theGlider;
	theGlider.destRect.left = leftCorner;
	theGlider.destRect.right = leftCorner + 48;
	theGlider.destRect.top = kFloorVert - 20;
	theGlider.destRect.bottom = kFloorVert;
	theGlider.oldRect = { ...theGlider.destRect };
	theGlider.wholeRect = { ...theGlider.destRect };
	theGlider.shadoDest.left = theGlider.destRect.left;
	theGlider.shadoDest.right = theGlider.destRect.right;
	theGlider.oldShado = { ...theGlider.shadoDest };
	theGlider.wholeShado = { ...theGlider.shadoDest };
	theGlider.touchRect = { ...theGlider.destRect };
	InsetRect(theGlider.touchRect, 10, 5);

	SetRect(srcRect, 0, 0, 512, 18);

	for (index = 0; index <= 18; index++) {
		HorizonMouse();

		waitTicks = TickCount();
		do {
			await Yield();
		} while (!(TickCount() > waitTicks));

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.left, srcRect.bottom);
			Line(512, 0);
			SetPort(G.virginCPtr!);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.left, srcRect.bottom);
			Line(512, 0);
			SetPort(G.offVirginPort!);
		}

		srcRect.bottom = srcRect.bottom + 18;
		srcRect.top = srcRect.top + 18;
	}
}

//=================================

async function ScrollDown(): Promise<void> {
	const srcRect = newRect();
	let waitTicks: LongInt;
	let index: Integer, leftCorner: Integer;

	leftCorner = 232;
	for (index = 1; index <= 16; index++) {
		const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[index]!;
		if (theObject.objectIs === upStar) {
			leftCorner = theObject.boundRect.left + 64;
		}
	}

	const theGlider = G.theGlider;
	theGlider.destRect.left = leftCorner;
	theGlider.destRect.right = leftCorner + 48;
	theGlider.destRect.top = kCeilingVert + 20;
	theGlider.destRect.bottom = kCeilingVert + 40;
	theGlider.oldRect = { ...theGlider.destRect };
	theGlider.wholeRect = { ...theGlider.destRect };
	theGlider.shadoDest.left = theGlider.destRect.left;
	theGlider.shadoDest.right = theGlider.destRect.right;
	theGlider.oldShado = { ...theGlider.shadoDest };
	theGlider.wholeShado = { ...theGlider.shadoDest };
	theGlider.touchRect = { ...theGlider.destRect };
	InsetRect(theGlider.touchRect, 10, 5);

	SetRect(srcRect, 0, 324, 512, 342);

	for (index = 0; index <= 18; index++) {
		waitTicks = TickCount();
		do {
			await Yield();
		} while (!(TickCount() > waitTicks));

		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.left, srcRect.top - 1);
			Line(512, 0);
			SetPort(G.virginCPtr!);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, srcRect, srcRect, srcCopy, null);
			SetPort(G.mainWndo!);
			PenNormal();
			MoveTo(srcRect.left, srcRect.top - 1);
			Line(512, 0);
			SetPort(G.offVirginPort!);
		}

		srcRect.bottom = srcRect.bottom - 18;
		srcRect.top = srcRect.top - 18;
	}
}

//=================================

export async function AdvanceARoom(): Promise<void> {
	G.didntExitEntrance = G.sideYouCantExit !== rightOfRoom;

	await SetRoomState();
	G.enteredLeft = true;
	G.sideYouCantExit = leftOfRoom;

	G.roomAt = G.roomAt + 1;
	G.roomsPassed = G.roomsPassed + 1;

	if (DemoVersion) {
		if (G.roomAt > 5) {
			G.roomAt = 0;
			G.roomsPassed = G.roomsPassed - 1;
			await ClosingAnimation();
			await WrapItUp();
			return;
		}
	}

	if (G.roomAt > G.thisHouse.numberORooms) {
		if (G.thisHouse.nextFile === 'nil' || G.thisHouse.nextFile === '') {
			G.roomAt = 0;
			G.roomsPassed = G.roomsPassed - 1;
			await ClosingAnimation();
			await WrapItUp();
			return;
		} else {
			await AdvanceAFile();
			G.roomAt = 1;
		}
	}

	if (G.roomAt !== 0) {
		await ReadyRoom();
		await ScrollForward();
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		}
	}
}

//=================================

export async function RetreatARoom(): Promise<void> {
	G.didntExitEntrance = G.sideYouCantExit !== leftOfRoom;
	await SetRoomState();
	G.enteredLeft = false;
	G.sideYouCantExit = rightOfRoom;

	G.roomAt = G.roomAt - 1;
	G.roomsPassed = G.roomsPassed - 1;
	if (G.roomAt < 1) {
		G.roomAt = 0;
		G.roomsPassed = G.roomsPassed - 1;
		await ClosingAnimation();
		await WrapItUp();
		return;
	}

	await ReadyRoom();
	await ScrollBackward();
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	}
}

//=================================

export async function UpAFlight(whatRoom: Integer): Promise<void> {
	let addToIt: Integer;

	G.didntExitEntrance = G.sideYouCantExit !== topOfRoom;
	await SetRoomState();
	G.sideYouCantExit = bottomOfRoom;

	addToIt = whatRoom - G.roomAt;
	G.roomAt = whatRoom;
	G.roomsPassed = G.roomsPassed + addToIt;
	if (G.roomAt > G.thisHouse.numberORooms || G.roomAt < 0) {
		if (G.thisHouse.nextFile === 'nil' || G.thisHouse.nextFile === '' || G.roomAt < 0) {
			G.roomAt = 0;
			G.roomsPassed = G.roomsPassed - 1;
			await ClosingAnimation();
			await WrapItUp();
			return;
		} else {
			await AdvanceAFile();
			G.roomAt = G.roomAt - 40;
		}
	} else if (G.roomAt === 0) {
		G.roomAt = 0;
		G.roomsPassed = G.roomsPassed - 1;
		await ClosingAnimation();
		await WrapItUp();
		return;
	}

	if (G.roomAt !== 0) {
		await ReadyRoom();
		await ScrollUp();
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		}
	}
}

//=================================

export async function DownAFlight(whatRoom: Integer): Promise<void> {
	let addToIt: Integer;

	G.didntExitEntrance = G.sideYouCantExit !== bottomOfRoom;
	await SetRoomState();
	G.sideYouCantExit = topOfRoom;

	addToIt = whatRoom - G.roomAt;
	G.roomAt = whatRoom;
	G.roomsPassed = G.roomsPassed + addToIt;
	if (G.roomAt < 0 || G.roomAt > G.thisHouse.numberORooms) {
		if (G.thisHouse.nextFile === 'nil' || G.thisHouse.nextFile === '' || G.roomAt < 0) {
			G.roomAt = 0;
			G.roomsPassed = G.roomsPassed - 1;
			await ClosingAnimation();
			await WrapItUp();
			return;
		} else {
			await AdvanceAFile();
			G.roomAt = G.roomAt - 40;
		}
	} else if (G.roomAt === 0) {
		await ClosingAnimation();
		await WrapItUp();
		return;
	}

	if (G.roomAt !== 0) {
		await ReadyRoom();
		await ScrollDown();
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
		}
	}
}

//=================================

export async function Transport(whatRoom: Integer): Promise<void> {
	let addToIt: Integer, leftCorner: Integer, index: Integer, localRoomNumber: Integer;
	let newRoom: boolean;

	newRoom = whatRoom !== G.roomAt;
	if (newRoom) {
		G.didntExitEntrance = true;
		await SetRoomState();
		G.sideYouCantExit = whoCares;
		addToIt = whatRoom - G.roomAt;
		G.roomAt = whatRoom;
		G.roomsPassed = G.roomsPassed + addToIt;

		if (G.roomAt < 0 || G.roomAt > G.thisHouse.numberORooms) {
			if (G.thisHouse.nextFile === 'nil' || G.thisHouse.nextFile === '' || G.roomAt < 0) {
				await ClosingAnimation();
				G.roomAt = 0;
				await WrapItUp();
				return;
			} else {
				localRoomNumber = G.roomAt - G.thisHouse.numberORooms;
				await AdvanceAFile();
				G.roomAt = localRoomNumber;
				if (G.roomAt > G.thisHouse.numberORooms) {
					await ClosingAnimation();
					G.roomAt = 0;
					await WrapItUp();
					return;
				}
			}
		} else if (G.roomAt === 0) {
			await ClosingAnimation();
			await WrapItUp();
			return;
		}

		if (G.roomAt !== 0) {
			await ReadyRoom();
		}
	} else {
		// we're transporting to the room we're in
		const theGlider = G.theGlider;
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.offLoadMap, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
			CopyBits(G.offVirginMap, G.offLoadMap, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.destRect, theGlider.destRect, srcCopy, G.wholeRgn);
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.shadoDest, theGlider.shadoDest, srcCopy, G.wholeRgn);
		}
	}

	if (G.roomAt !== 0) {
		leftCorner = 232;
		for (index = 1; index <= 16; index++) {
			const theObject = G.thisHouse.theRooms[G.roomAt]!.theObjects[index]!;
			if (theObject.objectIs === celDct && theObject.isOn) {
				leftCorner = theObject.boundRect.left;
			}
		}

		const theGlider = G.theGlider;
		theGlider.destRect.left = leftCorner;
		theGlider.destRect.right = leftCorner + 48;
		theGlider.destRect.top = kCeilingVert;
		theGlider.destRect.bottom = kCeilingVert + 20;
		theGlider.oldRect = { ...theGlider.destRect };
		theGlider.wholeRect = { ...theGlider.destRect };
		theGlider.shadoDest.left = theGlider.destRect.left;
		theGlider.shadoDest.right = theGlider.destRect.right;
		theGlider.oldShado = { ...theGlider.shadoDest };
		theGlider.wholeShado = { ...theGlider.shadoDest };
		theGlider.touchRect = { ...theGlider.destRect };
		InsetRect(theGlider.touchRect, 10, 5);

		if (newRoom) {
			HorizonMouse();
			DissBlocks();
			if (G.inColor) {
				CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, null);
			} else {
				CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, null);
			}
		}
	}
}
