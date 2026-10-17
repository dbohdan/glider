// Port of G-GlobalUtils.p.

import {
	Alert,
	black,
	CalcVisBehind,
	ClipRect,
	CloseRgn,
	CopyBits,
	type Cursor,
	Delay,
	DiffRgn,
	DisposeRgn,
	DrawMenuBar,
	DrawPicture,
	DrawString,
	ExitToShell,
	FillOval,
	FillRect,
	FlashMenuBar,
	FrameRect,
	FrameRoundRect,
	Get1Resource,
	GetGrayRgn,
	GetIndString,
	GetMBarHeight,
	GetPicture,
	GetPort,
	GetSoundVol,
	GetWindowList,
	gray,
	HGetState,
	HLock,
	HNoPurge,
	HPurge,
	HSetState,
	InitCursor,
	type Integer,
	InvertRect,
	LineTo,
	type LongInt,
	MoveHHi,
	MoveTo,
	NewRgn,
	NumToString,
	OffsetRect,
	OpenRgn,
	PaintBehind,
	PaintRect,
	ParamText,
	PenNormal,
	PenPat,
	Random,
	type Rect,
	RectRgn,
	type Region,
	ReleaseResource,
	RGBForeColor,
	screenBits,
	SectRgn,
	SetCCursor,
	SetCursor,
	SetMBarHeight,
	SetPort,
	SetRect,
	setScreenPage,
	SMSStart,
	SMSStartChan,
	srcCopy,
	TextFont,
	TextSize,
	UnionRect,
	UnionRgn,
	UseResFile,
	white,
	BSR,
	BTST,
	BitXor,
	div,
	int16,
	Concat,
} from '../mac/Toolbox.ts';
import { PRect, readLayout, writeLayout } from '../mac/PascalLayout.ts';
import {
	G,
	highScoreMode,
	kCursCount,
	kErrNotEnoughMem,
	lastDemo,
	rAlertID,
	rAlertStrIDs,
	rSidePict1,
	rSidePict2,
} from './Globals.ts';

//=================================

/**
 * The SetPage library routine (EXTERNAL): it sets bit 6 of the VIA's port A ($EFFFFE) to show the
 * main screen when secondPage is false, and clears it to show the alternate screen when true.
 * Port: the Toolbox's setScreenPage does the same to the emulated video circuit.
 */
export function SetPage(secondPage: boolean): void {
	setScreenPage(secondPage);
}

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

export async function GenericAlert(whatGives: Integer): Promise<void> {
	let dummyInt: Integer;
	let line1: string, line2: string;
	let alertRect: Rect;

	if (G.areFlipping && G.mainScreenHidden) {
		G.mainScreenHidden = false;
		SetPage(G.mainScreenHidden);
	}

	UseResFile(G.gliderResNum);
	InitCursor();
	if (whatGives > 0) {
		line1 = GetIndString(rAlertStrIDs, whatGives);
		line2 = '';
	} else {
		line1 = GetIndString(rAlertStrIDs, 1);
		line2 = NumToString(whatGives);
		line2 = Concat('Error = ', line2);
	}

	ParamText(line1, line2, '', '');
	// Port: an AlertTHndl over the 'ALRT' bytes; its boundsRect is a Rect at offset 0.
	const alertHandle = Get1Resource('ALRT', rAlertID);
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
	dummyInt = await Alert(rAlertID, null);
}

//=================================

export function DoTheMusic(whichOne: Integer): void {
	if (G.musicOn && G.soundOn) {
		SMSStartChan(whichOne, 1);
	}
}

//=================================

export function DoTheBass(whichOne: Integer): void {
	if (G.musicOn) {
		SMSStart(whichOne);
	}
}

//=================================

export function DoTheSound(whichOne: Integer): void {
	if (G.soundOn) {
		SMSStart(whichOne);
	}
}

//=================================

export function Randomize(range: Integer): Integer {
	let rawResult: LongInt;
	rawResult = Math.abs(Random());
	return div(rawResult * range, 32768);
}

//=================================

export function CalcRoomScore(): void {
	let index: Integer;

	G.roomScore = 0;
	for (index = 1; index <= 40; index++) {
		if (G.roomVisits[index]) {
			// Port: (roomsPassed div 41) * 2000 is Integer arithmetic, which wraps at 16 bits.
			G.roomScore = G.roomScore + 500 * (div(index, 10) + 1) + int16(div(G.roomsPassed, 41) * 2000);
		}
	}
}

//=================================

export async function DoErrorSound(soundNumber: Integer): Promise<void> {
	let _dummyLong: LongInt;
	let tempVolume: Integer, i: Integer;
	tempVolume = GetSoundVol();
	if (tempVolume !== 0) {
		for (i = 0; i <= soundNumber; i++) {
			FlashMenuBar(0);
			_dummyLong = await Delay(8);
			FlashMenuBar(0);
		}
	}
}

//=================================

export function DissBlocks(): void {
	let h: Integer, v: Integer;
	let value: LongInt;
	const maskR: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	value = 1;
	do {
		if (BTST(value, 0)) {
			value = BSR(value, 1);
			value = BitXor(value, 0x240);
		} else {
			value = BSR(value, 1);
		}
		h = (value % 32) * 16;
		v = div(value, 32) * 16;
		SetRect(maskR, h, v, h + 16, v + 16);
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, maskR, maskR, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, maskR, maskR, srcCopy, G.wholeRgn);
		}
	} while (!(value === 1));
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	}
	if (G.inColor) {
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
	}
}

//=================================

export function DrawHiScores(): void {
	let i: Integer, ranking: Integer;
	const leftRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const rightRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const hole: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	let tempStr: string;

	if (G.playing) {
		G.demoMode = Randomize(lastDemo) + 1;
		return;
	}

	const wasPort = GetPort();
	if (G.inColor) {
		SetPort(G.loadCPtr!);
	} else {
		SetPort(G.offLoadPort!);
	}
	PenNormal();

	ranking = G.scoreList.rank;

	SetRect(leftRect, 10, 30, 251, 332);
	FillRect(leftRect, white);
	FrameRect(leftRect);
	PenPat(gray);
	if (G.inColor) {
		RGBForeColor(G.rgbLtBlue);
	}
	for (i = 0; i <= 20; i++) {
		MoveTo(leftRect.left + 1, leftRect.top + 35 + i * 13);
		LineTo(leftRect.right - 2, leftRect.top + 35 + i * 13);
	}
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}
	if (ranking < 20 && G.inColor) {
		RGBForeColor(G.rgbYellow);
		i = ranking * 13 + leftRect.top + 36;
		SetRect(tempRect, leftRect.left + 32, i, leftRect.right - 2, i + 12);
		PaintRect(tempRect);
		RGBForeColor(G.rgbBlack);
	}

	TextFont(16);
	TextSize(12);
	if (G.inColor) {
		RGBForeColor(G.rgbRed);
	}
	MoveTo(leftRect.left + 33, leftRect.top + 30);
	DrawString('Rank');
	MoveTo(leftRect.left + 108, leftRect.top + 30);
	DrawString('Name');
	MoveTo(leftRect.left + 186, leftRect.top + 30);
	DrawString('Room #');
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}
	for (i = 0; i <= 19; i++) {
		MoveTo(leftRect.left + 38, leftRect.top + 47 + i * 13);
		tempStr = NumToString(i + 1);
		DrawString(tempStr);
		MoveTo(leftRect.left + 58, leftRect.top + 47 + i * 13);
		DrawString(G.thisHouse.hiName[i]!);
		MoveTo(leftRect.left + 206, leftRect.top + 47 + i * 13);
		if (G.thisHouse.hiLevel[i] === 0) {
			tempStr = '+';
		} else {
			tempStr = NumToString(G.thisHouse.hiLevel[i]!);
		}
		DrawString(tempStr);
	}
	if (ranking < 20 && !G.inColor) {
		i = ranking * 13 + leftRect.top + 36;
		SetRect(tempRect, leftRect.left + 32, i, leftRect.right - 2, i + 12);
		InvertRect(tempRect);
	}
	if (G.inColor) {
		RGBForeColor(G.rgbViolet);
	}
	MoveTo(leftRect.left + 30, leftRect.top + 1);
	LineTo(leftRect.left + 30, leftRect.bottom);
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}
	SetRect(hole, 0, 0, 12, 12);
	OffsetRect(hole, leftRect.left + 10, leftRect.top + 30);
	FillOval(hole, black);
	OffsetRect(hole, 0, 30);
	FillOval(hole, black);
	OffsetRect(hole, 0, 85);
	FillOval(hole, black);
	OffsetRect(hole, 0, 85);
	FillOval(hole, black);
	OffsetRect(hole, 0, 30);
	FillOval(hole, black);

	PenNormal();
	SetRect(rightRect, 261, 30, 502, 332);
	FillRect(rightRect, white);
	FrameRect(rightRect);
	PenPat(gray);
	if (G.inColor) {
		RGBForeColor(G.rgbLtBlue);
	}
	for (i = 0; i <= 20; i++) {
		MoveTo(rightRect.left + 1, rightRect.top + 35 + i * 13);
		LineTo(rightRect.right - 2, rightRect.top + 35 + i * 13);
	}

	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}

	if (ranking < 20 && G.inColor) {
		RGBForeColor(G.rgbYellow);
		i = ranking * 13 + rightRect.top + 36;
		SetRect(tempRect, rightRect.left + 32, i, rightRect.right - 2, i + 12);
		PaintRect(tempRect);
		RGBForeColor(G.rgbBlack);
	}

	TextFont(16);
	TextSize(12);
	if (G.inColor) {
		RGBForeColor(G.rgbRed);
	}
	MoveTo(rightRect.left + 33, rightRect.top + 30);
	DrawString('Score');
	MoveTo(rightRect.left + 98, rightRect.top + 30);
	DrawString('Room Name');
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}
	for (i = 0; i <= 19; i++) {
		MoveTo(rightRect.left + 33, rightRect.top + 47 + i * 13);
		tempStr = NumToString(G.thisHouse.hiScores[i]!);
		DrawString(tempStr);
		MoveTo(rightRect.left + 81, rightRect.top + 47 + i * 13);
		DrawString(G.thisHouse.hiRoom[i]!);
	}
	if (ranking < 20 && !G.inColor) {
		i = ranking * 13 + rightRect.top + 36;
		SetRect(tempRect, rightRect.left + 32, i, rightRect.right - 2, i + 12);
		InvertRect(tempRect);
	}

	if (G.inColor) {
		RGBForeColor(G.rgbViolet);
	}
	MoveTo(rightRect.left + 30, rightRect.top + 1);
	LineTo(rightRect.left + 30, rightRect.bottom);
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}
	SetRect(hole, 0, 0, 12, 12);
	OffsetRect(hole, rightRect.left + 10, rightRect.top + 30);
	FillOval(hole, black);
	OffsetRect(hole, 0, 30);
	FillOval(hole, black);
	OffsetRect(hole, 0, 85);
	FillOval(hole, black);
	OffsetRect(hole, 0, 85);
	FillOval(hole, black);
	OffsetRect(hole, 0, 30);
	FillOval(hole, black);

	if (G.inColor) {
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, leftRect, leftRect, srcCopy, G.wholeRgn);
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, rightRect, rightRect, srcCopy, G.wholeRgn);
	} else {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, leftRect, leftRect, srcCopy, G.wholeRgn);
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, rightRect, rightRect, srcCopy, G.wholeRgn);
	}
	SetPort(wasPort);
	G.demoMode = highScoreMode;
}

//=================================

// GetGrayRgn, GetMBarHeight, SetMBarHeight, and GetWindowList are inline reads and writes of the
// low memory globals GrayRgn, MBarHeight, and WindowList.
// Port: they are the Toolbox's (Windows.ts).

//=================================

function GetMBarRgn(): Region {
	let theRect: Rect;
	let worldRgn: Region, mBarRgn: Region;
	theRect = { ...GetGrayRgn().rgnBBox };
	UnionRect(theRect, screenBits.bounds, theRect);
	worldRgn = NewRgn();
	OpenRgn();
	FrameRoundRect(theRect, 16, 16);
	CloseRgn(worldRgn);

	theRect = { ...screenBits.bounds };
	theRect.bottom = theRect.top + G.wasMBarHeight;
	mBarRgn = NewRgn();
	RectRgn(mBarRgn, theRect);
	SectRgn(worldRgn, mBarRgn, mBarRgn);

	DisposeRgn(worldRgn);
	return mBarRgn;
}

//=================================

export function HideMenuBar(): void {
	let mBarHeight: Integer;
	let grayRgn: Region, menuBarRgn: Region;

	mBarHeight = GetMBarHeight();
	if (mBarHeight !== 0) {
		grayRgn = GetGrayRgn();
		G.wasMBarHeight = mBarHeight;
		menuBarRgn = GetMBarRgn();
		SetMBarHeight(0);
		UnionRgn(grayRgn, menuBarRgn, grayRgn);

		const startWindow = GetWindowList();
		PaintBehind(startWindow, menuBarRgn);
		CalcVisBehind(startWindow, menuBarRgn);
		DisposeRgn(menuBarRgn);
	}
}

//=================================

export function ShowMenuBar(): void {
	let grayRgn: Region, menuBarRgn: Region;
	if (GetMBarHeight() === 0) {
		grayRgn = GetGrayRgn();
		menuBarRgn = GetMBarRgn();
		SetMBarHeight(G.wasMBarHeight);

		DiffRgn(grayRgn, menuBarRgn, grayRgn);
		CalcVisBehind(GetWindowList(), menuBarRgn);
		DisposeRgn(menuBarRgn);
		DrawMenuBar();
	}
}

//=================================

export function FatalError(): void {
	InitCursor();
	ShowMenuBar();
	ExitToShell();
}

//=================================

export async function RedrawWindowFrame(): Promise<void> {
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	let tempByte: Integer;

	SetPort(G.mainWndo!);
	PenNormal();
	if (G.inColor) {
		RGBForeColor(G.rgbBlack);
	}

	ClipRect(G.fullArea);
	SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, 0);
	FillRect(tempRect, black);
	SetRect(tempRect, -G.rightOffset, 342, 512 + 2 * G.rightOffset, 342 + G.downOffset);
	FillRect(tempRect, black);
	SetRect(tempRect, -G.rightOffset, 0, 0, 342);
	FillRect(tempRect, black);
	SetRect(tempRect, 512, 0, 512 + G.rightOffset, 342);
	FillRect(tempRect, black);
	UseResFile(G.gliderResNum);
	if (G.inColor) {
		SetRect(tempRect, -64, 0, 0, 342);
		const thePict = GetPicture(rSidePict1);
		if (thePict !== null) {
			tempByte = HGetState(thePict);
			MoveHHi(thePict);
			HLock(thePict);
			DrawPicture(thePict, tempRect);
			HSetState(thePict, tempByte);
		} else {
			await GenericAlert(kErrNotEnoughMem);
		}
		ReleaseResource(thePict);
	}
	if (G.inColor) {
		SetRect(tempRect, 512, 0, 512 + 64, 342);
		const thePict = GetPicture(rSidePict2);
		if (thePict !== null) {
			tempByte = HGetState(thePict);
			MoveHHi(thePict);
			HLock(thePict);
			DrawPicture(thePict, tempRect);
			HSetState(thePict, tempByte);
		} else {
			await GenericAlert(kErrNotEnoughMem);
		}
		ReleaseResource(thePict);
	}
	ClipRect(G.wholeArea);
}
