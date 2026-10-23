// Port of G-PlayActive.p: the game loop while a game is being played.

import {
	BeginUpdate,
	BitXor,
	black,
	BSR,
	Button,
	ClipRect,
	cloneRect,
	CopyBits,
	CopyMask,
	div,
	DrawMenuBar,
	DrawString,
	EndUpdate,
	everyEvent,
	FillRect,
	FillRgn,
	FlushEvents,
	GetKeys,
	GetMenu,
	GetMouse,
	InitCursor,
	InsetRect,
	int16,
	int32,
	keyDown,
	Line,
	LineTo,
	LoWord,
	mouse,
	Move,
	MoveTo,
	NumToString,
	OffsetRect,
	PaintRect,
	patBic,
	patOr,
	patXor,
	PenMode,
	PenNormal,
	PenSize,
	PostEvent,
	pString,
	RGBForeColor,
	SectRect,
	SetClip,
	SetCursor,
	SetItem,
	SetPort,
	SetPt,
	SetRect,
	SMSExit,
	srcCopy,
	srcOr,
	srcXor,
	TextFont,
	TextMode,
	TextSize,
	TickCount,
	UnionRect,
	Yield,
	type Integer,
	type LongInt,
	type Point,
	type Rect,
} from '../mac/Toolbox.ts';
import {
	airOnIt,
	ascendIt,
	ascending,
	awardIt,
	ball,
	bandIt,
	burnIt,
	burning,
	candle,
	crashIt,
	DemoVersion,
	descendIt,
	descending,
	drip,
	dropIt,
	energizeIt,
	extraIt,
	fadingIn,
	fadingOut,
	fshBwl,
	G,
	grease,
	iBegin,
	ignoreIt,
	kBassFract,
	kBonusTimeToBeat,
	kCommandKeyMap,
	kDuhDumSound,
	kEKeyMap,
	kFloorLimit,
	iGamepad,
	iVirtualPad,
	kMaxThrust,
	kMinBassLoop,
	kQKeyMap,
	kSKeyMap,
	kTabKeyMap,
	kWhistleSound,
	lastDemo,
	lftFan,
	liftIt,
	lightIt,
	mGame,
	moveIt,
	normal,
	outlet,
	playIt,
	ritFan,
	shredding,
	shredIt,
	shredr,
	slideIt,
	spillIt,
	steamIt,
	teaKtl,
	toastr,
	toggleIt,
	trickIt,
	turnItLeft,
	turnItRight,
	turnLf2Rt,
	turnRt2Lf,
	zapIt,
} from './Globals.ts';
import { DoTheBass, DoTheSound, DrawHiScores, Randomize, SetPage, ShowMenuBar, SpinBall } from './GlobalUtils.ts';
import { SaveGame } from './FileInNOut.ts';
import { PadInput } from './Additions.ts';
import { thrustOf } from '../additions/Pads.ts';
import {
	ArrangeTiles,
	BumpTheScore,
	DoQuit,
	DrawAllObjects,
	DrawHeadline,
	ForceMainToVisible,
	LoadABackground,
	PopTokenBand,
	PopTokenBattery,
	ResetAnimate,
	StartScoreRolling,
	UpdateBandNumbers,
	UpdateBatteryEnergy,
} from './PlayUtils.ts';
import { AdvanceARoom, DownAFlight, HorizonMouse, OffAMortal, RetreatARoom, Transport, UpAFlight, WrapItUp } from './PlaySetUp.ts';

/** The unit's interface variables. */
export const PlayActive = {
	timeIs: 0 as LongInt,
	hotRect: { top: 0, left: 0, bottom: 0, right: 0 } as Rect,
	sliding: false,
};

/** Port: a local Rect variable, which Pascal leaves uninitialized. */
function newRect(): Rect {
	return { top: 0, left: 0, bottom: 0, right: 0 };
}

//=================================

function CenterMouse(): void {
	// const MBState = $172; MTemp = $828; RawMouse = $82C; Mouse = $830; CrsrNew = $8CE; CrsrCouple = $8CF; Couple = $FF; Uncouple = $00;
	const center: Point = { v: 0, h: 0 };

	SetPt(center, 256, 171);
	// Port: Glider writes the point to the low-memory globals RawMouse and MTemp, and $FF to CrsrNew
	// so that the cursor is redrawn there. The port's machine keeps the mouse location in `mouse`.
	mouse.where = { h: center.h, v: center.v };
}

//=================================

// Port: Glider's inline IncInt (ADDQ.W #1) and IncLong (ADDQ.L #1) are written at each use as
// `x = int16(x + 1)` and `x = int32(x + 1)`.

//=================================

function FloatTheScore(whatPoints: Integer): void {
	let tempStr: string;
	const floatPoints = G.floatPoints;
	if (floatPoints.out) {
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
		}
		if (G.areFlipping) {
			CopyBits(G.offVirginMap, G.offLoadMap, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
		}
	}
	floatPoints.out = true;
	floatPoints.whereR = cloneRect(G.theGlider.destRect);
	if (G.inColor) {
		floatPoints.whereR.top = floatPoints.whereR.bottom;
	} else {
		floatPoints.whereR.top = floatPoints.whereR.top - 30;
	}
	floatPoints.whereR.bottom = floatPoints.whereR.top + 12;
	tempStr = NumToString(whatPoints);
	floatPoints.saysWhat = pString(tempStr, 16);
	SetPort(G.mainWndo!);
	if (G.inColor) {
		PenNormal();
		TextFont(16);
		TextSize(12);
		MoveTo(floatPoints.whereR.left, floatPoints.whereR.bottom - 2);
		RGBForeColor(G.rgbYellow);
		PenMode(srcOr);
		DrawString(floatPoints.saysWhat);
		PenNormal();
		RGBForeColor(G.rgbBlack);
		floatPoints.tickStamp = TickCount() + 120;
		SetPort(G.virginCPtr!);
	} else {
		TextFont(201);
		TextMode(patBic);
		MoveTo(floatPoints.whereR.left, floatPoints.whereR.bottom - 2);
		DrawString(tempStr);
		TextFont(200);
		TextMode(patOr);
		MoveTo(floatPoints.whereR.left, floatPoints.whereR.bottom - 2);
		DrawString(tempStr);
		floatPoints.tickStamp = TickCount() + 120;
		PenNormal();
		SetPort(G.offVirginPort!);
	}
	if (G.areFlipping) {
		SetPort(G.offLoadPort!);
		TextFont(201);
		TextMode(patBic);
		MoveTo(floatPoints.whereR.left, floatPoints.whereR.bottom - 2);
		DrawString(tempStr);
		TextFont(200);
		TextMode(patOr);
		MoveTo(floatPoints.whereR.left, floatPoints.whereR.bottom - 2);
		DrawString(tempStr);
		floatPoints.tickStamp = TickCount() + 120;
		PenNormal();
		SetPort(G.offVirginPort!);
	}
}

//=================================

async function Collision(whatKind: Integer, who: Integer): Promise<void> {
	let tempStr: string;
	const tempRect = newRect();
	const srcR = newRect();
	let destReserve: Rect;
	let tempInt: Integer;
	const theGlider = G.theGlider;

	switch (whatKind) {
		case ignoreIt:
			break;

		case crashIt:
			G.lifeNormal = false;
			DoTheSound(1);
			theGlider.mode = fadingOut;
			theGlider.destRect.top = theGlider.destRect.bottom - 20;
			if (theGlider.isForward) {
				theGlider.srcNum = 0;
			} else {
				theGlider.srcNum = 2;
			}
			break;

		case liftIt:
			if (!G.airOut) {
				G.liftAmount = -7;
			}
			break;

		case dropIt:
			if (!G.airOut) {
				G.liftAmount = 7;
			}
			break;

		case moveIt:
			DoTheSound(16);
			await Transport(G.eventKind[who][1]);
			PlayActive.hotRect = cloneRect(G.nullRect); // don't die in rest of SearchRects
			break;

		case turnItLeft:
			G.shiftAmount = -7;
			if (G.lifeNormal) {
				if (theGlider.isRight) {
					G.lifeNormal = false;
					theGlider.mode = turnRt2Lf;
				}
			}
			break;

		case turnItRight:
			G.shiftAmount = 7;
			if (G.lifeNormal) {
				if (!theGlider.isRight) {
					G.lifeNormal = false;
					theGlider.mode = turnLf2Rt;
				}
			}
			break;

		case burnIt:
			G.liftAmount = -7;
			if (G.lifeNormal && theGlider.destRect.bottom > G.eventKind[who][1]) {
				DoTheSound(8);
				G.lifeNormal = false;
				if (theGlider.isRight) {
					theGlider.phase = 1;
				}
				theGlider.mode = burning;
				theGlider.timeStamp = TickCount() + 300;
				theGlider.destRect.top = theGlider.destRect.bottom - 36;
			}
			break;

		case awardIt: // clock
			if (G.eventKind[who][1] !== 0) {
				DoTheSound(5);
				StartScoreRolling();
				G.suppScore = G.suppScore + G.eventKind[who][1];
				FloatTheScore(G.eventKind[who][1]);
				G.eventKind[who][1] = 0;
				G.thisHouse.theRooms[G.roomAt].theObjects[who].amount = 0;

				destReserve = cloneRect(G.eventRect[who]);
				OffsetRect(destReserve, -destReserve.left, -destReserve.top);
				OffsetRect(destReserve, G.reserveRects[who].left, G.reserveRects[who].top);
				if (!G.lightsOut) {
					if (G.inColor) {
						CopyBits(G.reserveCPtr!.portPixMap, G.virginCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.loadCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					} else {
						CopyBits(G.offReserveMap, G.offVirginMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.offLoadMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					}
				}
			}
			break;

		case extraIt: // folded piece of paper
			if (G.eventKind[who][1] !== 0) {
				DoTheSound(10);
				StartScoreRolling();
				G.suppScore = G.suppScore + G.eventKind[who][1];
				FloatTheScore(G.eventKind[who][1]);
				G.eventKind[who][1] = 0;
				G.thisHouse.theRooms[G.roomAt].theObjects[who].amount = 0;
				G.mortals = int16(G.mortals + 1); // IncInt(mortals)
				if (G.mortals <= 4) {
					SetRect(tempRect, 507, 5, 542, 20);
					OffsetRect(tempRect, -37 * (G.mortals - 1), 0);

					SetRect(srcR, 0, 318, 35, 333);
					if (G.inColor) {
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, srcR, srcR, tempRect);
						CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, tempRect, tempRect, srcCopy, G.wholeRgn);
						CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
					} else {
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, srcR, srcR, tempRect);
						CopyBits(G.offVirginMap, G.offLoadMap, tempRect, tempRect, srcCopy, G.wholeRgn);
						CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.wholeRgn);
					}
					if (G.mortals === 4) {
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
				} else {
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

				destReserve = cloneRect(G.eventRect[who]);
				OffsetRect(destReserve, -destReserve.left, -destReserve.top);
				OffsetRect(destReserve, G.reserveRects[who].left, G.reserveRects[who].top);
				if (!G.lightsOut) {
					if (G.inColor) {
						CopyBits(G.reserveCPtr!.portPixMap, G.virginCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.loadCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					} else {
						CopyBits(G.offReserveMap, G.offVirginMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.offLoadMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					}
				}
			}
			break;

		case spillIt: // grease upright
			G.eventRect[who].left = G.eventRect[who].right;
			// Pascal: eventRect[who].right := eventRect[who].right; (assigns the field to itself)
			G.eventRect[who].top = G.eventRect[who].bottom - 5;
			G.eventKind[who][0] = ignoreIt; // signal to the cycleOb loop that a spill has occurred
			G.thisHouse.theRooms[G.roomAt].theObjects[who].isOn = false;
			break;

		case slideIt: // grease spilt
			tempInt = G.eventRect[who].top - theGlider.touchRect.bottom + 1;
			theGlider.destRect.top = theGlider.destRect.top + tempInt;
			theGlider.destRect.bottom = theGlider.destRect.bottom + tempInt;
			theGlider.touchRect.top = theGlider.touchRect.top + tempInt;
			theGlider.touchRect.bottom = theGlider.touchRect.bottom + tempInt;
			PlayActive.sliding = true;
			break;

		case bandIt: // rubber bands
			if (G.eventKind[who][1] !== 0) {
				DoTheSound(12);
				theGlider.bands = theGlider.bands + G.eventKind[who][1];
				FloatTheScore(G.eventKind[who][1]);
				G.eventKind[who][1] = 0;
				G.thisHouse.theRooms[G.roomAt].theObjects[who].amount = 0;
				PopTokenBand();
				UpdateBandNumbers();

				destReserve = cloneRect(G.eventRect[who]);
				OffsetRect(destReserve, -destReserve.left, -destReserve.top);
				OffsetRect(destReserve, G.reserveRects[who].left, G.reserveRects[who].top);
				if (!G.lightsOut) {
					if (G.inColor) {
						CopyBits(G.reserveCPtr!.portPixMap, G.virginCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.loadCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					} else {
						CopyBits(G.offReserveMap, G.offVirginMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.offLoadMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					}
				}
			}
			break;

		case energizeIt: // battery
			if (G.eventKind[who][1] !== 0) {
				DoTheSound(9);
				theGlider.energy = theGlider.energy + G.eventKind[who][1];
				FloatTheScore(G.eventKind[who][1]);
				G.eventKind[who][1] = 0;
				G.thisHouse.theRooms[G.roomAt].theObjects[who].amount = 0;

				PopTokenBattery();
				UpdateBatteryEnergy();

				destReserve = cloneRect(G.eventRect[who]);
				OffsetRect(destReserve, -destReserve.left, -destReserve.top);
				OffsetRect(destReserve, G.reserveRects[who].left, G.reserveRects[who].top);
				if (!G.lightsOut) {
					if (G.inColor) {
						CopyBits(G.reserveCPtr!.portPixMap, G.virginCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.loadCPtr!.portPixMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.reserveCPtr!.portPixMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					} else {
						CopyBits(G.offReserveMap, G.offVirginMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.offLoadMap, destReserve, G.eventRect[who], srcCopy, null);
						CopyBits(G.offReserveMap, G.mainWndo!.portBits, destReserve, G.eventRect[who], srcCopy, G.wholeRgn);
					}
				}
			}
			break;

		case trickIt: // good move!
			if (G.eventKind[who][1] !== 0) {
				DoTheSound(kWhistleSound);
				StartScoreRolling();
				G.suppScore = G.suppScore + G.eventKind[who][1];
				FloatTheScore(G.eventKind[who][1]);
				G.eventKind[who][1] = 0;
			}
			break;

		case lightIt:
			if (G.lightsOut) {
				DoTheSound(18);
				G.lightsOut = false;
				G.thisHouse.theRooms[G.roomAt].conditionCode = 0;
				await LoadABackground(G.thisHouse.theRooms[G.roomAt].backPictID);
				ArrangeTiles();
				await DrawAllObjects();
				DrawHeadline();
				if (G.inColor) {
					CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
					CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
				} else {
					CopyBits(G.offVirginMap, G.offLoadMap, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
					CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.wholeRgn);
				}
			}
			break;

		case airOnIt:
			if (G.airOut) {
				DoTheSound(3);
				G.airOut = false;
			}
			break;

		case zapIt:
			if (G.eventKind[who][1] !== 0) {
				G.lifeNormal = false;
				DoTheSound(24);
				theGlider.mode = fadingOut;
				theGlider.destRect.top = theGlider.destRect.bottom - 20;
				if (theGlider.isForward) {
					theGlider.srcNum = 0;
				} else {
					theGlider.srcNum = 2;
				}
			}
			break;

		case toggleIt:
			if (G.eventKind[who][2] < TickCount()) {
				DoTheSound(18);
				tempInt = G.eventKind[who][1];
				{
					const obj = G.thisHouse.theRooms[G.roomAt].theObjects[tempInt];
					obj.isOn = !obj.isOn;
					switch (obj.objectIs) {
						case lftFan:
							if (G.eventKind[tempInt][0] === ignoreIt) {
								DoTheSound(3);
								G.eventKind[tempInt][0] = turnItLeft;
							} else {
								G.eventKind[tempInt][0] = ignoreIt;
							}
							break;
						case ritFan:
							if (G.eventKind[tempInt][0] === ignoreIt) {
								DoTheSound(3);
								G.eventKind[tempInt][0] = turnItRight;
							} else {
								G.eventKind[tempInt][0] = ignoreIt;
							}
							break;
						case shredr:
							if (G.eventKind[tempInt][0] === ignoreIt) {
								G.eventKind[tempInt][0] = shredIt;
							} else {
								G.eventKind[tempInt][0] = ignoreIt;
							}
							break;
						default:
					} // case
				} // with
				G.eventKind[who][2] = TickCount() + 90;
			}
			break;

		case playIt:
			if (G.eventKind[who][1] < TickCount()) {
				DoTheSound(15);
				G.eventKind[who][1] = TickCount() + 120;
			}
			break;

		case ascendIt:
			G.lifeNormal = false;
			theGlider.mode = ascending;
			await UpAFlight(G.eventKind[who][1]);
			PlayActive.hotRect = cloneRect(G.nullRect); // don't die in rest of SearchRects
			break;

		case descendIt:
			G.lifeNormal = false;
			theGlider.mode = descending;
			await DownAFlight(G.eventKind[who][1]);
			PlayActive.hotRect = cloneRect(G.nullRect); // don't die in rest of SearchRects
			break;

		case shredIt:
			G.lifeNormal = false;
			theGlider.mode = shredding;
			theGlider.destRect.top = G.eventRect[who].bottom;
			theGlider.destRect.bottom = theGlider.destRect.top;
			theGlider.destRect.left = G.eventRect[who].left + 12;
			theGlider.destRect.right = theGlider.destRect.left + 48;
			theGlider.shadoDest.left = theGlider.destRect.left;
			theGlider.shadoDest.right = theGlider.destRect.right;
			theGlider.phase = 0;
			break;

		case steamIt:
			G.liftAmount = -7;
			G.shiftAmount = -7;
			break;

		default:
	} // case
}

//=================================

async function SearchRects(): Promise<void> {
	let outside: Integer = 0;

	//----------------

	function RectLap(rect1: Rect, rect2: Rect): boolean {
		const dumRect = newRect();
		if (rect1.right < rect2.left) {
			return false;
		}
		if (rect2.right < rect2.left) {
			return false;
		}
		if (rect1.bottom < rect2.top) {
			return false;
		}
		if (rect2.bottom < rect2.top) {
			return false;
		}
		return SectRect(rect1, rect2, dumRect);
	}

	//----------------

	function BiteIt(): void {
		const theGlider = G.theGlider;
		DoTheSound(1);
		G.lifeNormal = false;
		theGlider.mode = fadingOut;
		theGlider.destRect.top = theGlider.destRect.bottom - 20;
		if (theGlider.isForward) {
			theGlider.srcNum = 0;
		} else {
			theGlider.srcNum = 2;
		}
	}

	//----------------

	function GetItLegal(): void {
		// do a bump sound here
		const theGlider = G.theGlider;
		theGlider.destRect.left = theGlider.destRect.left + outside;
		theGlider.destRect.right = theGlider.destRect.right + outside;
		theGlider.shadoDest.left = theGlider.shadoDest.left + outside;
		theGlider.shadoDest.right = theGlider.shadoDest.right + outside;
		theGlider.touchRect.left = theGlider.touchRect.left + outside;
		theGlider.touchRect.right = theGlider.touchRect.right + outside;
	}

	//----------------

	{
		const theGlider = G.theGlider;
		PlayActive.hotRect = cloneRect(theGlider.touchRect); // get 'hot rect'
		if (G.rightIsOpen) {
			// check right edge
			if (theGlider.destRect.left > 500) {
				await AdvanceARoom();
				return;
			}
		} else if (theGlider.destRect.right > 512) {
			outside = 512 - theGlider.destRect.right;
			GetItLegal();
		}
		if (G.leftIsOpen) {
			// check left edge
			if (theGlider.destRect.right < 12) {
				await RetreatARoom();
				return;
			}
		} else if (theGlider.destRect.left < 0) {
			outside = -theGlider.destRect.left;
			GetItLegal();
		}
		if (theGlider.destRect.bottom > kFloorLimit) {
			// check floor
			BiteIt();
		}
	} // ---with theGlider do---

	G.shiftAmount = 0;

	// Port: a Pascal for loop's bounds are evaluated once.
	for (let index = 1, last = G.nObjects; index <= last; index++) {
		if (RectLap(G.eventRect[index], PlayActive.hotRect)) {
			await Collision(G.eventKind[index][0], index);
		}
	}

	if (G.nAnimates !== 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			if (RectLap(G.theAnimates[index].destRect, PlayActive.hotRect)) {
				BiteIt();
				break;
			}
		}
	}
}

//=================================

function HandleBand(): void {
	//----------------

	function RectLap(rect1: Rect, rect2: Rect): boolean {
		const dumRect = newRect();
		if (rect1.right < rect2.left) {
			return false;
		}
		if (rect2.right < rect2.left) {
			return false;
		}
		if (rect1.bottom < rect2.top) {
			return false;
		}
		if (rect2.bottom < rect2.top) {
			return false;
		}
		return SectRect(rect1, rect2, dumRect);
	}

	//----------------

	const theBand = G.theBand;
	if (theBand.whole.left > 512 || theBand.whole.left < -16) {
		G.bandBorne = false;
	}

	theBand.phase = int16(theBand.phase + 1); // IncInt(phase)
	if (theBand.phase > 2) {
		theBand.phase = 0;
	}
	theBand.whole = cloneRect(theBand.dest);
	theBand.dest.left = theBand.dest.left + theBand.velocity;
	theBand.dest.right = theBand.dest.right + theBand.velocity;
	if (theBand.velocity > 0) {
		theBand.whole.right = theBand.whole.right + theBand.velocity;
	} else {
		theBand.whole.left = theBand.whole.left + theBand.velocity;
	}

	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			if (anim.vertOff !== 12) {
				if (RectLap(anim.destRect, theBand.dest)) {
					switch (anim.kind) {
						case 0:
							DoTheSound(6);
							break;
						case 1:
							DoTheSound(6);
							break;
						case 2:
							DoTheSound(19);
							break;
						default:
					}
					anim.phase = -1;
					StartScoreRolling();
					G.suppScore = G.suppScore + 100 * (3 - anim.kind);
					anim.horiOff = 0;
					anim.vertOff = 12;
				}
			}
		}
	} // with
}

//=================================

function GetInput(): void {
	const holdKey = 1;
	const dropKey = 2;
	const absMouse = 3;
	const relMouse = 4;
	let pull: Integer;
	const thePt: Point = { v: 0, h: 0 };
	const dest = newRect();

	//--------------------

	function PushIt(howFast: Integer): void {
		const theGlider = G.theGlider;
		if (theGlider.energy > 0) {
			theGlider.energy = theGlider.energy - 1;
			DoTheSound(26);
			UpdateBatteryEnergy();

			if (theGlider.energy === 0) {
				SetRect(dest, 308, 5, 335, 20);
				FillRect(dest, black);
				if (G.inColor) {
					CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
					CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, dest, dest, srcCopy, G.wholeRgn);
				} else {
					CopyBits(G.offVirginMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
					CopyBits(G.offVirginMap, G.offLoadMap, dest, dest, srcCopy, G.wholeRgn);
				}
			}
			theGlider.forVel = howFast;
		}
	}

	//--------------------

	function FireBand(): void {
		const theGlider = G.theGlider;
		if (theGlider.bands > 0) {
			DoTheSound(11);
			theGlider.bands = theGlider.bands - 1;

			UpdateBandNumbers();

			if (theGlider.bands === 0) {
				SetRect(dest, 346, 5, 368, 20);
				FillRect(dest, black);
				if (G.inColor) {
					CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
					CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, dest, dest, srcCopy, G.wholeRgn);
				} else {
					CopyBits(G.offVirginMap, G.mainWndo!.portBits, dest, dest, srcCopy, G.wholeRgn);
					CopyBits(G.offVirginMap, G.offLoadMap, dest, dest, srcCopy, G.wholeRgn);
				}
			}
			G.bandBorne = true;
			// with theBand do: `dest` here is the band's, not GetInput's.
			const theBand = G.theBand;
			theBand.dest.top = theGlider.destRect.top + 6;
			theBand.dest.bottom = theBand.dest.top + 7;
			if (theGlider.isRight) {
				theBand.dest.left = theGlider.destRect.right;
				theBand.velocity = 16;
			} else {
				theBand.dest.left = theGlider.destRect.left - 16;
				theBand.velocity = -16;
			}
			theBand.dest.right = theBand.dest.left + 16;
			theBand.whole = cloneRect(theBand.dest);
			theBand.old = cloneRect(theBand.dest);
		}
	}

	//--------------------

	const theGlider = G.theGlider;
	const theKeys = G.theKeys;
	switch (G.controlMethod) {
		case holdKey:
			if (theKeys[G.leftKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
					theGlider.forVel = -kMaxThrust;
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					theGlider.forVel = -kMaxThrust;
				}
			} else if (theKeys[G.rightKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					theGlider.forVel = kMaxThrust;
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
					theGlider.forVel = kMaxThrust;
				}
			} else {
				// no key of import down
				if (theGlider.isRight) {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					theGlider.forVel = 0;
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					theGlider.forVel = 0;
				}
			}

			if (theKeys[G.bandKey] && !G.bandBorne) {
				// fire rubber bands
				FireBand();
			}
			if (theKeys[G.energyKey]) {
				if ((theGlider.isRight && theGlider.isForward) || (!theGlider.isRight && !theGlider.isForward)) {
					PushIt(16);
				} else {
					PushIt(-16);
				}
			}
			break;

		case dropKey:
			if ((theGlider.isRight && theGlider.isForward) || (!theGlider.isRight && !theGlider.isForward)) {
				theGlider.forVel = kMaxThrust;
			} else {
				theGlider.forVel = -kMaxThrust;
			}
			if (theKeys[G.leftKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
					theGlider.forVel = -kMaxThrust;
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					theGlider.forVel = -kMaxThrust;
				}
			} else if (theKeys[G.rightKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					theGlider.forVel = kMaxThrust;
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
					theGlider.forVel = kMaxThrust;
				}
			}
			if (theKeys[G.bandKey] && !G.bandBorne) {
				// fire rubber bands
				FireBand();
			}
			if (theKeys[G.energyKey]) {
				if ((theGlider.isRight && theGlider.isForward) || (!theGlider.isRight && !theGlider.isForward)) {
					PushIt(16);
				} else {
					PushIt(-16);
				}
			}
			break; // end - dropKey

		case absMouse:
			if (theKeys[G.bandKey] && !G.bandBorne) {
				FireBand();
			}

			GetMouse(thePt);
			HorizonMouse();
			pull = div(thePt.h - 256, 32);
			if (pull > kMaxThrust) {
				pull = kMaxThrust;
			} else if (pull < -kMaxThrust) {
				pull = -kMaxThrust;
			}
			theGlider.forVel = pull;

			if (theGlider.isRight) {
				if (theGlider.forVel < 0) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
					if (theKeys[G.energyKey]) {
						PushIt(-16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(-16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					if (theKeys[G.energyKey]) {
						PushIt(16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				}
			} else {
				if (theGlider.forVel < 0) {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					if (theKeys[G.energyKey]) {
						PushIt(-16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(-16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
					if (theKeys[G.energyKey]) {
						PushIt(16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				}
			}
			break; // end - absMouse

		case relMouse:
			if (theKeys[G.bandKey] && !G.bandBorne) {
				// fire rubber bands
				FireBand();
			}

			GetMouse(thePt);
			theGlider.forVel = thePt.h - 256;
			if (theGlider.forVel > kMaxThrust) {
				theGlider.forVel = kMaxThrust;
			} else if (theGlider.forVel < -kMaxThrust) {
				theGlider.forVel = -kMaxThrust;
			}
			CenterMouse();

			if (theGlider.isRight) {
				if (theGlider.forVel < 0) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
					if (theKeys[G.energyKey]) {
						PushIt(-16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(-16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					if (theKeys[G.energyKey]) {
						PushIt(16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				}
			} else {
				if (theGlider.forVel < 0) {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					if (theKeys[G.energyKey]) {
						PushIt(-16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(-16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
					if (theKeys[G.energyKey]) {
						PushIt(16);
					}
					if (Button()) {
						if (!G.buttonFires) {
							PushIt(16);
						} else if (!G.bandBorne && G.buttonFires) {
							FireBand();
						}
					}
				}
			}
			break; // end - relMouse

		// Port: the additions' Gamepad and Virtual Gamepad (Additions.ts): Hold Keyboard's steering at
		// the gamepad's thrust (a stick's in proportion, as Mouse's), and the keys as Hold Keyboard
		// reads them, the gamepad's buttons with them.
		case iGamepad:
		case iVirtualPad: {
			const pad = PadInput();
			let thrust = thrustOf(pad.steer, kMaxThrust);
			if (thrust === 0 && theKeys[G.leftKey]) {
				thrust = -kMaxThrust;
			} else if (thrust === 0 && theKeys[G.rightKey]) {
				thrust = kMaxThrust;
			}
			if (thrust < 0) {
				if (theGlider.isRight) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
				}
				theGlider.forVel = thrust;
			} else if (thrust > 0) {
				if (theGlider.isRight) {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
				}
				theGlider.forVel = thrust;
			} else {
				theGlider.isForward = true;
				theGlider.srcNum = theGlider.isRight ? 0 : 2;
				theGlider.forVel = 0;
			}

			if ((theKeys[G.bandKey] || pad.band) && !G.bandBorne) {
				FireBand();
			}
			if (theKeys[G.energyKey] || pad.energy) {
				if ((theGlider.isRight && theGlider.isForward) || (!theGlider.isRight && !theGlider.isForward)) {
					PushIt(16);
				} else {
					PushIt(-16);
				}
			}
			break;
		}

		default:
	} // case
} // with theGlider

//=================================

function MoveGlider(): void {
	if (G.windowOpen) {
		// randomly move glider
		G.liftAmount = G.liftAmount + Randomize(11) - 5;
		G.shiftAmount = G.shiftAmount + Randomize(11) - 5;
	}
	const theGlider = G.theGlider;
	G.liftAmount = G.liftAmount + 1; // add gravity
	if (PlayActive.sliding) {
		G.liftAmount = 0; // zero out lift
		PlayActive.sliding = false;
	} else {
		// vertical offset of glider
		theGlider.destRect.top = theGlider.destRect.top + G.liftAmount;
		theGlider.destRect.bottom = theGlider.destRect.bottom + G.liftAmount;
		theGlider.touchRect.top = theGlider.touchRect.top + G.liftAmount;
		theGlider.touchRect.bottom = theGlider.touchRect.bottom + G.liftAmount;
	}

	theGlider.forVel = theGlider.forVel + G.shiftAmount; // horizontal offset of glider
	theGlider.destRect.left = theGlider.destRect.left + theGlider.forVel;
	theGlider.destRect.right = theGlider.destRect.right + theGlider.forVel;
	theGlider.touchRect.left = theGlider.destRect.left + 10; // touch rect is inset from dest
	theGlider.touchRect.right = theGlider.destRect.right - 10;
	theGlider.shadoDest.left = theGlider.destRect.left; // shadow has same l. & r. as dest
	theGlider.shadoDest.right = theGlider.destRect.right;
}

//=================================

async function MoveAnimates(): Promise<void> {
	//----------------

	function RectLap(rect1: Rect, rect2: Rect): boolean {
		const dumRect = newRect();
		if (rect1.right < rect2.left) {
			return false;
		}
		if (rect2.right < rect2.left) {
			return false;
		}
		if (rect1.bottom < rect2.top) {
			return false;
		}
		if (rect2.bottom < rect2.top) {
			return false;
		}
		return SectRect(rect1, rect2, dumRect);
	}

	//----------------

	for (let index = 1, last = G.nAnimates; index <= last; index++) {
		const anim = G.theAnimates[index];
		if (anim.unSeen) {
			if (TickCount() > anim.tickStamp) {
				await ResetAnimate(-1, index);
				anim.unSeen = false;
			}
		} else {
			if (anim.phase > -1) {
				anim.phase = int16(anim.phase + 1); // IncInt(phase)
				if (anim.phase > 7) {
					anim.phase = 0;
				}
			}

			anim.wholeRect = cloneRect(anim.destRect);

			{
				const destRect = anim.destRect;
				switch (anim.kind) {
					case 0:
						destRect.left = destRect.left + anim.horiOff;
						destRect.right = destRect.right + anim.horiOff;
						destRect.top = destRect.top + anim.vertOff;
						destRect.bottom = destRect.bottom + anim.vertOff;
						anim.wholeRect.left = anim.wholeRect.left + anim.horiOff;
						anim.wholeRect.bottom = anim.wholeRect.bottom + anim.vertOff;
						break;

					case 1:
						destRect.left = destRect.left + anim.horiOff;
						destRect.right = destRect.right + anim.horiOff;
						destRect.top = destRect.top + anim.vertOff;
						destRect.bottom = destRect.bottom + anim.vertOff;
						anim.wholeRect.left = anim.wholeRect.left + anim.horiOff;
						anim.wholeRect.bottom = anim.wholeRect.bottom + anim.vertOff;
						break;

					case 2:
						destRect.top = destRect.top + anim.vertOff;
						destRect.bottom = destRect.bottom + anim.vertOff;
						if (anim.vertOff > 0) {
							anim.wholeRect.bottom = anim.wholeRect.bottom + anim.vertOff;
						} else {
							anim.wholeRect.top = anim.wholeRect.top + anim.vertOff;
						}
						break;

					default:
				} // case kind of
			} // with destRect

			if (!anim.unSeen) {
				if (!RectLap(anim.wholeRect, G.wholeArea)) {
					anim.tickStamp = TickCount() + anim.delay;
					anim.destRect = cloneRect(G.nullRect);
					anim.wholeRect = cloneRect(G.nullRect);
					anim.unSeen = true;
				}
			}
		} // if NOT (unSeen)
	} // with / for
}

//=================================

function MoveCycleObs(): void {
	let diff: Integer = 0;

	for (let index = 1, last = G.nCycleObs; index <= last; index++) {
		const c = G.cycleObjects[index];
		switch (c.kindIs) {
			case candle:
				c.position = int32(c.position + 1); // IncLong(position)
				if (c.position > 50) {
					c.position = 48;
				}
				break;

			case grease:
				if (G.eventKind[c.tiedTo][0] === ignoreIt) {
					DoTheSound(14);
					G.eventKind[c.tiedTo][0] = slideIt;
					c.reset = 1;
				} else if (c.reset !== 0 && c.reset !== 999) {
					c.reset = c.reset + 1;
					if (c.reset > 4) {
						c.velocity = c.velocity + 1;
						G.eventRect[c.tiedTo].right = G.eventRect[c.tiedTo].right + 1;
						if (c.velocity > c.position) {
							c.reset = 999;
						}
					} else {
						if (c.reset < 3) {
							c.accel = 58;
						} else {
							c.accel = 59;
						}
					}
				}
				break;

			case outlet:
				if (c.accel === 25) {
					if (TickCount() > c.position) {
						c.accel = G.binaryFlip + 51; // go into zap mode
						c.position = TickCount();
						G.eventKind[c.tiedTo][1] = 1;
					}
				} else {
					if (TickCount() > c.position + 60) {
						c.accel = 25; // stop zapping
						c.position = TickCount() + c.reset;
						G.eventKind[c.tiedTo][1] = 0;
					} else {
						DoTheSound(24); // zapping
						c.accel = G.binaryFlip + 51;
					}
				}
				break;

			case drip:
				if (c.phase < 57) {
					if (G.binaryFlip !== 0) {
						c.phase = int16(c.phase + 1); // IncInt(phase)
						if (c.phase === 57) {
							c.position = c.position + 160;
						}
					}
				} else {
					c.velocity = c.velocity + c.accel;
					c.position = c.position + c.velocity;
					if (c.position > c.reset) {
						DoTheSound(7);
						c.velocity = 0;
						c.position = c.holdRect.bottom * 32;
						if (G.inColor) {
							CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, G.eventRect[c.tiedTo], G.eventRect[c.tiedTo], srcCopy, G.wholeRgn);
							CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.eventRect[c.tiedTo], G.eventRect[c.tiedTo], srcCopy, G.wholeRgn);
						} else {
							CopyBits(G.offVirginMap, G.offLoadMap, G.eventRect[c.tiedTo], G.eventRect[c.tiedTo], srcCopy, G.wholeRgn);
							CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.eventRect[c.tiedTo], G.eventRect[c.tiedTo], srcCopy, G.wholeRgn);
						}
						G.eventRect[c.tiedTo] = cloneRect(c.holdRect);
						c.phase = 53;
					}
					c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
					{
						const r = G.eventRect[c.tiedTo];
						diff = LoWord(BSR(c.position, 5)) - r.bottom;
						r.bottom = r.bottom + diff;
						r.top = r.top + diff;
					}
					c.wholeRect.bottom = c.wholeRect.bottom + diff;
				} // else
				break; // drip

			case toastr:
				if (c.phase !== 0) {
					if (G.binaryFlip === 0) {
						c.phase = c.phase + 1;
						if (c.phase > 65) {
							c.phase = 60;
						}
					}
					c.velocity = c.velocity + c.accel;
					c.position = c.position + c.velocity;
					if (c.position > c.reset) {
						DoTheSound(22);
						c.velocity = -c.velocity;
						c.position = c.reset;
						c.reset = TickCount() + G.thisHouse.theRooms[G.roomAt].theObjects[c.tiedTo].extra;
						c.phase = 0;
					}
					c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
					{
						const r = G.eventRect[c.tiedTo];
						diff = LoWord(BSR(c.position, 5)) - r.bottom;
						r.bottom = r.bottom + diff;
						r.top = r.top + diff;
					}
					if (diff > 0) {
						c.wholeRect.bottom = c.wholeRect.bottom + diff;
					} else {
						c.wholeRect.top = c.wholeRect.top + diff;
					}
				} else {
					if (TickCount() > c.reset) {
						DoTheSound(23);
						c.reset = c.position;
						c.phase = 60;
					}
				} // toastr
				break;

			case ball:
				c.velocity = c.velocity + c.accel;
				c.position = c.position + c.velocity;
				if (c.position > c.reset) {
					DoTheSound(4);
					c.velocity = -c.velocity;
					c.position = c.reset;
				}
				c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
				{
					const r = G.eventRect[c.tiedTo];
					diff = LoWord(BSR(c.position, 5)) - r.bottom;
					r.bottom = r.bottom + diff;
					r.top = r.top + diff;
				}
				if (diff > 0) {
					c.wholeRect.bottom = c.wholeRect.bottom + diff;
				} else {
					c.wholeRect.top = c.wholeRect.top + diff;
				}
				break; // ball

			case fshBwl:
				if (c.phase !== 0) {
					if (c.velocity > -16 && c.velocity < 16) {
						c.phase = 69;
					} else {
						if (c.velocity < 0) {
							c.phase = 66;
						} else {
							c.phase = 68;
						}
					}
					c.velocity = c.velocity + c.accel;
					c.position = c.position + c.velocity;
					if (c.position > c.reset) {
						DoTheSound(7);
						c.velocity = -c.velocity;
						c.position = c.reset;
						c.reset = TickCount() + G.thisHouse.theRooms[G.roomAt].theObjects[c.tiedTo].extra;
						c.phase = 0;
					}
					c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
					{
						const r = G.eventRect[c.tiedTo];
						diff = LoWord(BSR(c.position, 5)) - r.bottom;
						r.bottom = r.bottom + diff;
						r.top = r.top + diff;
					}
					if (diff > 0) {
						c.wholeRect.bottom = c.wholeRect.bottom + diff;
					} else {
						c.wholeRect.top = c.wholeRect.top + diff;
					}
				} else {
					if (TickCount() > c.reset) {
						DoTheSound(7);
						c.reset = c.position;
						c.phase = 66;
					}
				} // fish bowl
				break;

			case teaKtl:
				if (TickCount() > c.reset) {
					G.eventKind[c.tiedTo][0] = steamIt;
					if (c.phase === 0) {
						DoTheSound(25);
					}
					c.phase = c.phase + 1;
					if (c.phase > 10) {
						c.phase = 0;
						G.eventKind[c.tiedTo][0] = ignoreIt;
						c.reset = TickCount() + c.position;
					}
				}
				break;
			default:
		} // case / with / index
	}
}

//=================================

function MonitorStorm(): void {
	const theLightning = G.theLightning;
	if (theLightning.whatPhase === 0) {
		if (TickCount() > theLightning.whatTime) {
			theLightning.whatPhase = 1;
		}
	} else if (theLightning.whatPhase > 3) {
		theLightning.whatPhase = 0;
		theLightning.whichBolt = Randomize(3) + 1;
		theLightning.whatTime = TickCount() + Randomize(300);
		DoTheSound(17);
	} else {
		theLightning.whatPhase = theLightning.whatPhase + 1;
	}
}

//=================================

function DrawFlipScene(): void {
	let tempInt: Integer;
	const tempRect = newRect();
	let tempSmRect: Rect;
	const theGlider = G.theGlider;

	if (G.mainScreenHidden) {
		if (G.hasWindow) {
			if (G.theLightning.whatPhase !== 0) {
				const theLightning = G.theLightning;
				if (theLightning.whatPhase === 4) {
					SetPort(G.mainWndo!);
					SetClip(G.windowRgn!);
					PenNormal();
					FillRgn(G.windowRgn!, black);
					ClipRect(G.wholeArea);
					SetPort(G.offLoadPort!);
					SetClip(G.windowRgn!);
					FillRgn(G.windowRgn!, black);
					ClipRect(G.wholeArea);
					SetPort(G.offVirginPort!);
				} else {
					const bolt = theLightning.theBolts[theLightning.whichBolt];
					SetPort(G.mainWndo!);
					SetClip(G.windowRgn!);
					PenNormal();
					PenSize(2, 2);
					PenMode(patXor);
					MoveTo(bolt[0][0], bolt[0][1]);
					for (let index = 1; index <= 7; index++) {
						LineTo(bolt[index][0], bolt[index][1]);
						Move(0, 2);
					}
					ClipRect(G.wholeArea);
					SetPort(G.offVirginPort!);
				}
			}
		}

		//-----pop masks on-----
		if (G.hasMirror) {
			tempSmRect = cloneRect(theGlider.destRect);
			tempSmRect.left = tempSmRect.left - 16;
			tempSmRect.right = tempSmRect.right - 16;
			tempSmRect.top = tempSmRect.top - 32;
			tempSmRect.bottom = tempSmRect.bottom - 32;
			SetPort(G.mainWndo!);
			SetClip(G.mirrorRgn!);
			CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], tempSmRect);
			ClipRect(G.wholeArea);
			SetPort(G.offVirginPort!);
		}

		if (G.nCycleObs > 0) {
			for (let index = 1, last = G.nCycleObs; index <= last; index++) {
				const c = G.cycleObjects[index];
				switch (c.kindIs) {
					case candle:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.position], G.srcRect[c.position], c.wholeRect);
						break;
					case outlet:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.accel], G.srcRect[c.accel], c.wholeRect);
						break;
					case grease:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.accel], G.srcRect[c.accel], c.wholeRect);
						SetPort(G.offLoadPort!);
						PenNormal();
						PenSize(2, 2);
						MoveTo(c.velocity - 2, c.wholeRect.bottom - 2);
						if (c.velocity > c.wholeRect.right + 1) {
							Line(2, 0);
						}
						PenNormal();
						SetPort(G.offVirginPort!);
						PenNormal();
						PenSize(2, 2);
						MoveTo(c.velocity - 2, c.wholeRect.bottom - 2);
						if (c.velocity > c.wholeRect.right + 1) {
							Line(2, 0);
						}
						PenNormal();
						break;
					case ball:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.kindIs], G.srcRect[c.kindIs], G.eventRect[c.tiedTo]);
						break;
					case drip:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						break;
					case toastr:
						if (c.phase !== 0) {
							SetPort(G.mainWndo!);
							SetClip(G.toastRgn!);
							CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
							ClipRect(G.wholeArea);
							SetPort(G.offVirginPort!);
						}
						break;
					case fshBwl:
						if (c.phase !== 0) {
							CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						} else {
							CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.srcRect[69], G.srcRect[69], G.eventRect[c.tiedTo]);
						}
						break;
					default:
				} // case
			}
		}

		if (theGlider.isRight) {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.shadoRct[0], G.shadoRct[0], theGlider.shadoDest);
		} else {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.shadoRct[1], G.shadoRct[1], theGlider.shadoDest);
		}
		if (G.lifeNormal) {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
		} else {
			switch (theGlider.mode) {
				case fadingIn:
				case fadingOut:
					tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
					if (!theGlider.isRight) {
						tempInt = tempInt + 7;
					}
					CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[tempInt], theGlider.destRect);
					break;
				case turnLf2Rt:
				case turnRt2Lf:
					tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
					CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[tempInt], G.glideRct[tempInt], theGlider.destRect);
					break;
				case burning:
				case ascending:
				case descending:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
					break;
				case shredding:
					SetRect(tempRect, 256, 208 - (theGlider.destRect.bottom - theGlider.destRect.top), 304, 208);
					CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, tempRect, tempRect, theGlider.destRect);
					break;
				default:
			} // case
		}

		if (G.nAnimates > 0) {
			for (let index = 1, last = G.nAnimates; index <= last; index++) {
				const anim = G.theAnimates[index];
				CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.animateRct[anim.kind][anim.phase], G.animateRct[anim.kind][anim.phase], anim.destRect);
			}
		}

		if (G.bandBorne) {
			const theBand = G.theBand;
			CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.bandRct[theBand.phase], G.bandRct[theBand.phase], theBand.dest);
		}

		{
			const floatPoints = G.floatPoints;
			if (floatPoints.out && TickCount() > floatPoints.tickStamp) {
				floatPoints.out = false;
				CopyBits(G.offVirginMap, G.offLoadMap, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
				CopyBits(G.offVirginMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
			}
		}

		//-----flip to 'other' page-----

		G.mainScreenHidden = !G.mainScreenHidden;
		SetPage(G.mainScreenHidden);

		//-----restore 'other' page-----

		if (G.hasMirror) {
			tempSmRect = cloneRect(theGlider.oldRect);
			tempSmRect.left = tempSmRect.left - 16;
			tempSmRect.right = tempSmRect.right - 16;
			tempSmRect.top = tempSmRect.top - 32;
			tempSmRect.bottom = tempSmRect.bottom - 32;
			CopyBits(G.offVirginMap, G.offLoadMap, tempSmRect, tempSmRect, srcCopy, G.wholeRgn);
		}

		CopyBits(G.offVirginMap, G.offLoadMap, theGlider.oldRect, theGlider.oldRect, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.offLoadMap, theGlider.oldShado, theGlider.oldShado, srcCopy, G.wholeRgn);
		theGlider.oldRect = cloneRect(theGlider.destRect);
		theGlider.oldShado = cloneRect(theGlider.shadoDest);

		if (G.nAnimates > 0) {
			for (let index = 1, last = G.nAnimates; index <= last; index++) {
				const anim = G.theAnimates[index];
				CopyBits(G.offVirginMap, G.offLoadMap, anim.oldRect, anim.oldRect, srcCopy, null);
				anim.oldRect = cloneRect(anim.destRect);
			}
		}

		if (G.nCycleObs > 0) {
			for (let index = 1, last = G.nCycleObs; index <= last; index++) {
				const c = G.cycleObjects[index];
				CopyBits(G.offVirginMap, G.offLoadMap, c.oldRect, c.oldRect, srcCopy, null);
				c.oldRect = cloneRect(c.wholeRect);
			}
		}

		if (G.bandBorne) {
			const theBand = G.theBand;
			CopyBits(G.offVirginMap, G.offLoadMap, theBand.old, theBand.old, srcCopy, null);
			theBand.old = cloneRect(theBand.dest);
		}
	} else {
		// main screen is NOT hidden (is visible)
		if (G.hasWindow) {
			if (G.theLightning.whatPhase !== 0) {
				const theLightning = G.theLightning;
				if (theLightning.whatPhase === 4) {
					SetPort(G.mainWndo!);
					SetClip(G.windowRgn!);
					PenNormal();
					FillRgn(G.windowRgn!, black);
					ClipRect(G.wholeArea);
					SetPort(G.offLoadPort!);
					SetClip(G.windowRgn!);
					FillRgn(G.windowRgn!, black);
					ClipRect(G.wholeArea);
					SetPort(G.offVirginPort!);
				} else {
					const bolt = theLightning.theBolts[theLightning.whichBolt];
					SetPort(G.offLoadPort!);
					SetClip(G.windowRgn!);
					PenNormal();
					PenSize(2, 2);
					PenMode(patXor);
					MoveTo(bolt[0][0], bolt[0][1]);
					for (let index = 1; index <= 7; index++) {
						LineTo(bolt[index][0], bolt[index][1]);
						Move(0, 2);
					}
					ClipRect(G.wholeArea);
					SetPort(G.offVirginPort!);
				}
			}
		}

		//-----pop masks on-----
		if (G.hasMirror) {
			tempSmRect = cloneRect(theGlider.destRect);
			tempSmRect.left = tempSmRect.left - 16;
			tempSmRect.right = tempSmRect.right - 16;
			tempSmRect.top = tempSmRect.top - 32;
			tempSmRect.bottom = tempSmRect.bottom - 32;
			SetPort(G.offLoadPort!);
			SetClip(G.mirrorRgn!);
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], tempSmRect);
			ClipRect(G.wholeArea);
			SetPort(G.offVirginPort!);
		}

		if (G.nCycleObs > 0) {
			for (let index = 1, last = G.nCycleObs; index <= last; index++) {
				const c = G.cycleObjects[index];
				switch (c.kindIs) {
					case candle:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.position], G.srcRect[c.position], c.wholeRect);
						break;
					case outlet:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.accel], G.srcRect[c.accel], c.wholeRect);
						break;
					case grease:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.accel], G.srcRect[c.accel], c.wholeRect);
						SetPort(G.mainWndo!);
						PenNormal();
						PenSize(2, 2);
						MoveTo(c.velocity - 2, c.wholeRect.bottom - 2);
						if (c.velocity > c.wholeRect.right + 1) {
							Line(2, 0);
						}
						PenNormal();
						SetPort(G.offVirginPort!);
						PenNormal();
						PenSize(2, 2);
						MoveTo(c.velocity - 2, c.wholeRect.bottom - 2);
						if (c.velocity > c.wholeRect.right + 1) {
							Line(2, 0);
						}
						PenNormal();
						break;
					case ball:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.kindIs], G.srcRect[c.kindIs], G.eventRect[c.tiedTo]);
						break;
					case drip:
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						break;
					case toastr:
						if (c.phase !== 0) {
							SetPort(G.offLoadPort!);
							SetClip(G.toastRgn!);
							CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
							ClipRect(G.wholeArea);
							SetPort(G.offVirginPort!);
						}
						break;
					case fshBwl:
						if (c.phase !== 0) {
							CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						} else {
							CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[69], G.srcRect[69], G.eventRect[c.tiedTo]);
						}
						break;
					default:
				} // case
			}
		}

		if (theGlider.isRight) {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.shadoRct[0], G.shadoRct[0], theGlider.shadoDest);
		} else {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.shadoRct[1], G.shadoRct[1], theGlider.shadoDest);
		}
		if (G.lifeNormal) {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
		} else {
			switch (theGlider.mode) {
				case fadingIn:
				case fadingOut:
					tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
					if (!theGlider.isRight) {
						tempInt = tempInt + 7;
					}
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[tempInt], theGlider.destRect);
					break;
				case turnLf2Rt:
				case turnRt2Lf:
					tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[tempInt], G.glideRct[tempInt], theGlider.destRect);
					break;
				case burning:
				case ascending:
				case descending:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
					break;
				case shredding:
					SetRect(tempRect, 256, 208 - (theGlider.destRect.bottom - theGlider.destRect.top), 304, 208);
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, tempRect, tempRect, theGlider.destRect);
					break;
				default:
			} // case
		}

		if (G.nAnimates > 0) {
			for (let index = 1, last = G.nAnimates; index <= last; index++) {
				const anim = G.theAnimates[index];
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.animateRct[anim.kind][anim.phase], G.animateRct[anim.kind][anim.phase], anim.destRect);
			}
		}

		if (G.bandBorne) {
			const theBand = G.theBand;
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.bandRct[theBand.phase], G.bandRct[theBand.phase], theBand.dest);
		}

		{
			const floatPoints = G.floatPoints;
			if (floatPoints.out && TickCount() > floatPoints.tickStamp) {
				floatPoints.out = false;
				CopyBits(G.offVirginMap, G.offLoadMap, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
				CopyBits(G.offVirginMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
			}
		}

		//-----flip to 'other' page-----

		G.mainScreenHidden = !G.mainScreenHidden;
		SetPage(G.mainScreenHidden);

		//-----restore 'other' page-----

		if (G.hasMirror) {
			tempSmRect = cloneRect(theGlider.oldRect);
			tempSmRect.left = tempSmRect.left - 16;
			tempSmRect.right = tempSmRect.right - 16;
			tempSmRect.top = tempSmRect.top - 32;
			tempSmRect.bottom = tempSmRect.bottom - 32;
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempSmRect, tempSmRect, srcCopy, G.wholeRgn);
		}

		CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.oldRect, theGlider.oldRect, srcCopy, G.wholeRgn);
		CopyBits(G.offVirginMap, G.mainWndo!.portBits, theGlider.oldShado, theGlider.oldShado, srcCopy, G.wholeRgn);
		theGlider.oldRect = cloneRect(theGlider.destRect);
		theGlider.oldShado = cloneRect(theGlider.shadoDest);

		if (G.nAnimates > 0) {
			for (let index = 1, last = G.nAnimates; index <= last; index++) {
				const anim = G.theAnimates[index];
				CopyBits(G.offVirginMap, G.mainWndo!.portBits, anim.oldRect, anim.oldRect, srcCopy, null);
				anim.oldRect = cloneRect(anim.destRect);
			}
		}

		if (G.nCycleObs > 0) {
			for (let index = 1, last = G.nCycleObs; index <= last; index++) {
				const c = G.cycleObjects[index];
				CopyBits(G.offVirginMap, G.mainWndo!.portBits, c.oldRect, c.oldRect, srcCopy, null);
				c.oldRect = cloneRect(c.wholeRect);
			}
		}

		if (G.bandBorne) {
			const theBand = G.theBand;
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, theBand.old, theBand.old, srcCopy, null);
			theBand.old = cloneRect(theBand.dest);
		}
	}
}

//=================================

function DrawScene(): void {
	let tempInt: Integer;
	let tempRect = newRect();
	let tempSmRect: Rect;
	const theGlider = G.theGlider;

	if (G.hasWindow) {
		if (G.theLightning.whatPhase !== 0) {
			const theLightning = G.theLightning;
			SetPort(G.mainWndo!);
			SetClip(G.windowRgn!);
			PenNormal();
			if (theLightning.whatPhase === 4) {
				FillRgn(G.windowRgn!, black);
			} else {
				const bolt = theLightning.theBolts[theLightning.whichBolt];
				PenSize(2, 2);
				PenMode(patXor);
				MoveTo(bolt[0][0], bolt[0][1]);
				for (let index = 1; index <= 7; index++) {
					LineTo(bolt[index][0], bolt[index][1]);
					Move(0, 2);
				}
			}
			ClipRect(G.wholeArea);
			SetPort(G.offVirginPort!);
		}
	}

	if (G.hasMirror) {
		tempRect = cloneRect(theGlider.oldRect);
		tempRect.left = tempRect.left - 16;
		tempRect.right = tempRect.right - 16;
		tempRect.top = tempRect.top - 32;
		tempRect.bottom = tempRect.bottom - 32;
		CopyBits(G.offVirginMap, G.offLoadMap, tempRect, tempRect, srcCopy, G.mirrorRgn);
	}

	UnionRect(theGlider.destRect, theGlider.oldRect, theGlider.wholeRect);
	UnionRect(theGlider.shadoDest, theGlider.oldShado, theGlider.wholeShado);
	CopyBits(G.offVirginMap, G.offLoadMap, theGlider.oldRect, theGlider.oldRect, srcCopy, G.wholeRgn);
	CopyBits(G.offVirginMap, G.offLoadMap, theGlider.oldShado, theGlider.oldShado, srcCopy, G.wholeRgn);
	theGlider.oldRect = cloneRect(theGlider.destRect);
	theGlider.oldShado = cloneRect(theGlider.shadoDest);

	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			CopyBits(G.offVirginMap, G.offLoadMap, anim.oldRect, anim.oldRect, srcCopy, null);
		}
	}

	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			CopyBits(G.offVirginMap, G.offLoadMap, c.oldRect, c.oldRect, srcCopy, null);
		}
	}

	if (G.bandBorne) {
		const theBand = G.theBand;
		CopyBits(G.offVirginMap, G.offLoadMap, theBand.old, theBand.old, srcCopy, null);
	}

	//-----pop masks on-----
	if (G.hasMirror) {
		tempSmRect = cloneRect(theGlider.destRect);
		tempSmRect.left = tempSmRect.left - 16;
		tempSmRect.right = tempSmRect.right - 16;
		tempSmRect.top = tempSmRect.top - 32;
		tempSmRect.bottom = tempSmRect.bottom - 32;
		SetPort(G.offLoadPort!);
		SetClip(G.mirrorRgn!);
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], tempSmRect);
		ClipRect(G.wholeArea);
		SetPort(G.offVirginPort!);
		UnionRect(tempRect, tempSmRect, tempRect);
	}

	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			switch (c.kindIs) {
				case candle:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.position], G.srcRect[c.position], c.wholeRect);
					break;
				case outlet:
				case grease:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.accel], G.srcRect[c.accel], c.wholeRect);
					break;
				case ball:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.kindIs], G.srcRect[c.kindIs], G.eventRect[c.tiedTo]);
					break;
				case drip:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
					break;
				case toastr:
					if (c.phase !== 0) {
						SetPort(G.offLoadPort!);
						SetClip(G.toastRgn!);
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						ClipRect(G.wholeArea);
						SetPort(G.offVirginPort!);
					}
					break;
				case fshBwl:
					if (c.phase !== 0) {
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
					} else {
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[69], G.srcRect[69], G.eventRect[c.tiedTo]);
					}
					break;
				default:
			} // case
			c.oldRect = cloneRect(c.wholeRect);
		}
	}

	if (theGlider.isRight) {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.shadoRct[0], G.shadoRct[0], theGlider.shadoDest);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.shadoRct[1], G.shadoRct[1], theGlider.shadoDest);
	}
	if (G.lifeNormal) {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
	} else {
		switch (theGlider.mode) {
			case fadingIn:
			case fadingOut:
				tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
				if (!theGlider.isRight) {
					tempInt = tempInt + 7;
				}
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[tempInt], theGlider.destRect);
				break;
			case turnLf2Rt:
			case turnRt2Lf:
				tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[tempInt], G.glideRct[tempInt], theGlider.destRect);
				break;
			case burning:
			case ascending:
			case descending:
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
				break;
			case shredding:
				SetRect(tempRect, 256, 208 - (theGlider.destRect.bottom - theGlider.destRect.top), 304, 208);
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, tempRect, tempRect, theGlider.destRect);
				break;
			default:
		} // case
	}

	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.animateRct[anim.kind][anim.phase], G.animateRct[anim.kind][anim.phase], anim.destRect);
			anim.oldRect = cloneRect(anim.wholeRect);
		}
	}

	if (G.bandBorne) {
		const theBand = G.theBand;
		CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.bandRct[theBand.phase], G.bandRct[theBand.phase], theBand.dest);
		theBand.old = cloneRect(theBand.dest);
	}

	//-----pop to visible screen-----
	{
		const floatPoints = G.floatPoints;
		if (floatPoints.out && TickCount() > floatPoints.tickStamp) {
			floatPoints.out = false;
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
		}
	}

	if (G.hasMirror) {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.mirrorRgn);
	}

	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			if (c.kindIs !== grease) {
				CopyBits(G.offLoadMap, G.mainWndo!.portBits, c.wholeRect, c.wholeRect, srcCopy, G.wholeRgn);
			} else {
				CopyBits(G.offLoadMap, G.mainWndo!.portBits, c.wholeRect, c.wholeRect, srcCopy, G.wholeRgn);
				SetPort(G.mainWndo!);
				PenNormal();
				PenSize(2, 2);
				MoveTo(c.wholeRect.right, c.wholeRect.bottom - 2);
				if (c.velocity > c.wholeRect.right + 1) {
					LineTo(c.velocity, c.wholeRect.bottom - 2);
				}
				PenNormal();
				SetPort(G.offVirginPort!);
				PenNormal();
				PenSize(2, 2);
				MoveTo(c.wholeRect.right, c.wholeRect.bottom - 2);
				if (c.velocity > c.wholeRect.right + 1) {
					LineTo(c.velocity, c.wholeRect.bottom - 2);
				}
				PenNormal();
			}
		}
	}

	CopyBits(G.offLoadMap, G.mainWndo!.portBits, theGlider.wholeRect, theGlider.wholeRect, srcCopy, G.wholeRgn);
	CopyBits(G.offLoadMap, G.mainWndo!.portBits, theGlider.wholeShado, theGlider.wholeShado, srcCopy, G.wholeRgn);

	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			CopyBits(G.offLoadMap, G.mainWndo!.portBits, anim.wholeRect, anim.wholeRect, srcCopy, G.wholeRgn);
		}
	}

	if (G.bandBorne) {
		const theBand = G.theBand;
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, theBand.whole, theBand.whole, srcCopy, G.wholeRgn);
	}
}

//=================================

function DrawCScene(): void {
	let tempInt: Integer;
	const tempRect = newRect();
	let tempSmRect: Rect;
	const theGlider = G.theGlider;

	if (G.hasWindow && G.theLightning.whatPhase !== 0) {
		const theLightning = G.theLightning;
		SetPort(G.mainWndo!);
		SetClip(G.windowRgn!);
		PenNormal();
		if (theLightning.whatPhase === 4) {
			FillRgn(G.windowRgn!, black);
		} else {
			const bolt = theLightning.theBolts[theLightning.whichBolt];
			PenMode(srcXor);
			PenSize(2, 2);
			MoveTo(bolt[0][0], bolt[0][1]);
			for (let index = 1; index <= 7; index++) {
				LineTo(bolt[index][0], bolt[index][1]);
				Move(0, 2);
			}
		}
		ClipRect(G.wholeArea);
		SetPort(G.virginCPtr!);
	}
	if (G.hasMirror) {
		UnionRect(theGlider.destRect, theGlider.oldRect, tempRect);
		tempRect.left = tempRect.left - 32;
		tempRect.right = tempRect.right - 32;
		tempRect.top = tempRect.top - 32;
		tempRect.bottom = tempRect.bottom - 32;
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, tempRect, tempRect, srcCopy, G.mirrorRgn);
	}
	UnionRect(theGlider.destRect, theGlider.oldRect, theGlider.wholeRect);
	UnionRect(theGlider.shadoDest, theGlider.oldShado, theGlider.wholeShado);
	CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.oldRect, theGlider.oldRect, srcCopy, G.wholeRgn);
	CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theGlider.oldShado, theGlider.oldShado, srcCopy, G.wholeRgn);
	theGlider.oldRect = cloneRect(theGlider.destRect);
	theGlider.oldShado = cloneRect(theGlider.shadoDest);
	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, anim.oldRect, anim.oldRect, srcCopy, G.wholeRgn);
		}
	}
	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, c.oldRect, c.oldRect, srcCopy, G.wholeRgn);
		}
	}
	if (G.bandBorne) {
		const theBand = G.theBand;
		CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, theBand.old, theBand.old, srcCopy, G.wholeRgn);
	}

	//-----pop masks on-----
	if (G.hasMirror) {
		tempSmRect = cloneRect(theGlider.destRect);
		tempSmRect.left = tempSmRect.left - 32;
		tempSmRect.right = tempSmRect.right - 32;
		tempSmRect.top = tempSmRect.top - 32;
		tempSmRect.bottom = tempSmRect.bottom - 32;
		SetPort(G.loadCPtr!);
		SetClip(G.mirrorRgn!);
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], tempSmRect);
		ClipRect(G.wholeArea);
		SetPort(G.virginCPtr!);
	}
	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			switch (c.kindIs) {
				case candle:
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.position], G.srcRect[c.position], c.wholeRect);
					break;
				case outlet:
				case grease:
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.accel], G.srcRect[c.accel], c.wholeRect);
					break;
				case ball:
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.kindIs], G.srcRect[c.kindIs], G.eventRect[c.tiedTo]);
					break;
				case drip:
					CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
					break;
				case toastr:
					if (c.phase !== 0) {
						SetPort(G.loadCPtr!);
						SetClip(G.toastRgn!);
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						ClipRect(G.wholeArea);
						SetPort(G.virginCPtr!);
					}
					break;
				case fshBwl:
					if (c.phase !== 0) {
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
					} else {
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[69], G.srcRect[69], G.eventRect[c.tiedTo]);
					}
					break;
				default:
			} // case
			c.oldRect = cloneRect(c.wholeRect);
		}
	}
	if (theGlider.isRight) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.shadoRct[0], G.shadoRct[0], theGlider.shadoDest);
	} else {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.shadoRct[1], G.shadoRct[1], theGlider.shadoDest);
	}
	if (G.lifeNormal) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
	} else {
		switch (theGlider.mode) {
			case fadingIn:
			case fadingOut:
				tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
				if (!theGlider.isRight) {
					tempInt = tempInt + 7;
				}
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.glideRct[theGlider.srcNum], G.glideRct[tempInt], theGlider.destRect);
				break;
			case turnLf2Rt:
			case turnRt2Lf:
				tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.glideRct[tempInt], G.glideRct[tempInt], theGlider.destRect);
				break;
			case burning:
			case ascending:
			case descending:
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
				break;
			case shredding:
				SetRect(tempRect, 256, 208 - (theGlider.destRect.bottom - theGlider.destRect.top), 304, 208);
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, tempRect, tempRect, theGlider.destRect);
				break;
			default:
		} // case
	}
	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.animateRct[anim.kind][anim.phase], G.animateRct[anim.kind][anim.phase], anim.destRect);
			anim.oldRect = cloneRect(anim.wholeRect);
		}
	}
	if (G.bandBorne) {
		const theBand = G.theBand;
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.bandRct[theBand.phase], G.bandRct[theBand.phase], theBand.dest);
		theBand.old = cloneRect(theBand.dest);
	}
	//-----pop to visible screen-----
	{
		const floatPoints = G.floatPoints;
		if (floatPoints.out) {
			if (TickCount() > floatPoints.tickStamp) {
				floatPoints.out = false;
				CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
			} else {
				CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, floatPoints.whereR, floatPoints.whereR, srcCopy, G.wholeRgn);
				SetPort(G.mainWndo!);
				PenNormal();
				floatPoints.whereR.right = floatPoints.whereR.right + 2;
				floatPoints.whereR.left = floatPoints.whereR.left + 2;
				floatPoints.whereR.top = floatPoints.whereR.top - 1;
				floatPoints.whereR.bottom = floatPoints.whereR.bottom - 1;
				TextFont(16);
				TextSize(12);
				MoveTo(floatPoints.whereR.left, floatPoints.whereR.bottom - 2);
				if (G.binaryFlip === 0) {
					RGBForeColor(G.rgbBlue);
				} else {
					RGBForeColor(G.rgbRed);
				}
				PenMode(srcOr);
				DrawString(floatPoints.saysWhat);
				PenNormal();
				RGBForeColor(G.rgbBlack);
				SetPort(G.virginCPtr!);
			}
		}
	}

	if (G.hasMirror) {
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, G.mirrorRgn);
	}
	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			if (c.kindIs !== grease) {
				CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, c.wholeRect, c.wholeRect, srcCopy, G.wholeRgn);
			} else {
				CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, c.wholeRect, c.wholeRect, srcCopy, G.wholeRgn);
				SetPort(G.mainWndo!);
				PenNormal();
				PenSize(2, 2);
				MoveTo(c.wholeRect.right, c.wholeRect.bottom - 2);
				if (c.velocity > c.wholeRect.right + 1) {
					LineTo(c.velocity, c.wholeRect.bottom - 2);
				}
				PenNormal();
				SetPort(G.virginCPtr!);
				PenNormal();
				PenSize(2, 2);
				MoveTo(c.wholeRect.right, c.wholeRect.bottom - 2);
				if (c.velocity > c.wholeRect.right + 1) {
					LineTo(c.velocity, c.wholeRect.bottom - 2);
				}
				PenNormal();
			}
		}
	}

	CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.wholeRect, theGlider.wholeRect, srcCopy, G.wholeRgn);
	CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, theGlider.wholeShado, theGlider.wholeShado, srcCopy, G.wholeRgn);

	if (G.nAnimates > 0) {
		for (let index = 1, last = G.nAnimates; index <= last; index++) {
			const anim = G.theAnimates[index];
			CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, anim.wholeRect, anim.wholeRect, srcCopy, G.wholeRgn);
		}
	}

	if (G.bandBorne) {
		const theBand = G.theBand;
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, theBand.whole, theBand.whole, srcCopy, G.wholeRgn);
	}
}

//=================================

async function DoSpecial(): Promise<void> {
	GetKeys(G.theKeys);
	const theGlider = G.theGlider;
	switch (theGlider.mode) {
		case fadingIn:
			if (theGlider.phase === 1) {
				DoTheSound(2);
			}
			theGlider.phase = int16(theGlider.phase + 1); // IncInt(phase)
			if (theGlider.phase > 16) {
				if (theGlider.isRight) {
					theGlider.srcNum = 0;
				} else {
					theGlider.srcNum = 2;
				}
				G.lifeNormal = true;
				theGlider.phase = 0;
				theGlider.mode = normal;
			}
			break;
		case fadingOut:
			theGlider.phase = int16(theGlider.phase + 1); // IncInt(phase)
			if (theGlider.isRight) {
				theGlider.srcNum = 0;
			} else {
				theGlider.srcNum = 2;
			}
			if (theGlider.phase > 16) {
				await OffAMortal();
			}
			break;
		case turnRt2Lf:
			theGlider.phase = int16(theGlider.phase + 1); // IncInt(phase)
			if (theGlider.phase > 11) {
				G.lifeNormal = true;
				theGlider.phase = 0;
				theGlider.mode = normal;
				G.shiftAmount = 0;
				theGlider.isRight = false;
			}
			await SearchRects();
			theGlider.destRect.left = theGlider.destRect.left + G.shiftAmount;
			theGlider.destRect.right = theGlider.destRect.right + G.shiftAmount;
			theGlider.touchRect.left = theGlider.touchRect.left + G.shiftAmount;
			theGlider.touchRect.right = theGlider.touchRect.right + G.shiftAmount;
			theGlider.shadoDest.left = theGlider.shadoDest.left + G.shiftAmount;
			theGlider.shadoDest.right = theGlider.shadoDest.right + G.shiftAmount;
			break;
		case turnLf2Rt:
			theGlider.phase = int16(theGlider.phase + 1); // IncInt(phase)
			if (theGlider.phase > 11) {
				G.lifeNormal = true;
				theGlider.phase = 0;
				theGlider.mode = normal;
				G.shiftAmount = 0;
				theGlider.isRight = true;
			}
			await SearchRects();
			theGlider.destRect.left = theGlider.destRect.left + G.shiftAmount;
			theGlider.destRect.right = theGlider.destRect.right + G.shiftAmount;
			theGlider.touchRect.left = theGlider.touchRect.left + G.shiftAmount;
			theGlider.touchRect.right = theGlider.touchRect.right + G.shiftAmount;
			theGlider.shadoDest.left = theGlider.shadoDest.left + G.shiftAmount;
			theGlider.shadoDest.right = theGlider.shadoDest.right + G.shiftAmount;
			break;
		case burning:
			theGlider.phase = 1 - theGlider.phase;
			if (theGlider.isRight) {
				theGlider.srcNum = 24 + theGlider.phase;
				theGlider.forVel = 1;
			} else {
				theGlider.srcNum = 26 + theGlider.phase;
				theGlider.forVel = -1;
			}
			await SearchRects();
			MoveGlider();
			if (TickCount() > theGlider.timeStamp) {
				DoTheSound(1);
				theGlider.mode = fadingOut;
				theGlider.phase = 0;
				theGlider.destRect.top = theGlider.destRect.bottom - 20;
				if (theGlider.isForward) {
					theGlider.srcNum = 0;
				} else {
					theGlider.srcNum = 2;
				}
			}
			break;
		case ascending:
			theGlider.destRect.left = theGlider.destRect.left - 2;
			theGlider.destRect.right = theGlider.destRect.left + 48;
			theGlider.destRect.top = theGlider.destRect.top - 6;
			theGlider.destRect.bottom = theGlider.destRect.top + 20;
			theGlider.shadoDest.left = theGlider.destRect.left;
			theGlider.shadoDest.right = theGlider.destRect.right;
			theGlider.touchRect = cloneRect(theGlider.destRect);
			InsetRect(theGlider.touchRect, 10, 5);
			if (theGlider.destRect.top < 220) {
				G.lifeNormal = true;
				theGlider.phase = 0;
				theGlider.mode = normal;
			}
			break;
		case descending:
			theGlider.destRect.left = theGlider.destRect.left + 2;
			theGlider.destRect.right = theGlider.destRect.left + 48;
			theGlider.destRect.top = theGlider.destRect.top + 6;
			theGlider.destRect.bottom = theGlider.destRect.top + 20;
			theGlider.shadoDest.left = theGlider.destRect.left;
			theGlider.shadoDest.right = theGlider.destRect.right;
			theGlider.touchRect = cloneRect(theGlider.destRect);
			InsetRect(theGlider.touchRect, 10, 5);
			if (theGlider.destRect.top > 120) {
				G.lifeNormal = true;
				theGlider.phase = 0;
				theGlider.mode = normal;
			}
			break;
		case shredding:
			if (theGlider.phase === 0) {
				DoTheSound(20);
				theGlider.destRect.bottom = theGlider.destRect.bottom + 1;
				if (theGlider.destRect.bottom >= theGlider.destRect.top + 36) {
					theGlider.phase = 1;
				}
			} else {
				theGlider.destRect.top = theGlider.destRect.top + 8;
				theGlider.destRect.bottom = theGlider.destRect.bottom + 8;
				if (theGlider.destRect.top > 342) {
					theGlider.phase = 0;
					await OffAMortal();
				}
			}
			break; // end - shred
		default:
	}
}

//=================================

function LetsPause(): void {
	if (G.smsIsActive) {
		SMSExit();
	}
	G.smsIsActive = false;

	G.demoMode = Randomize(lastDemo) + 1;
	G.pausing = true;

	ForceMainToVisible();

	InitCursor();
	ShowMenuBar();
	SetItem(GetMenu(mGame)!, iBegin, 'Continue Game…');
	DrawMenuBar();
	FlushEvents(everyEvent, 0);
	G.theErr = PostEvent(keyDown, 65);
}

//=================================

async function LetsQuit(): Promise<void> {
	ForceMainToVisible();
	ShowMenuBar();

	if (DemoVersion) {
		G.playing = false;
		G.pausing = false;
		G.doneFlag = true;
	} else {
		if (await DoQuit()) {
			G.playing = false;
			G.pausing = false;
			G.doneFlag = true;
		} else {
			if (await SaveGame()) {
				G.playing = false;
				G.pausing = false;
				G.doneFlag = true;
			} else {
				SetCursor(G.noCursor!);
				SetPort(G.mainWndo!);
				BeginUpdate(G.mainWndo!);
				if (G.inColor) {
					CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, null);
				} else {
					CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, null);
				}
				EndUpdate(G.mainWndo!);
				if (G.inColor) {
					SetPort(G.virginCPtr!);
				} else {
					SetPort(G.offVirginPort!);
				}
			}
		}
	}
}

//=================================

async function LetsSave(): Promise<void> {
	if (!DemoVersion) {
		InitCursor();
		SpinBall();
		ForceMainToVisible();
		// Pascal: if (not SaveGame) then ;
		await SaveGame();
		SpinBall();
		SetCursor(G.noCursor!);
		SetPort(G.mainWndo!);
		BeginUpdate(G.mainWndo!);
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, null);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, null);
		}
		EndUpdate(G.mainWndo!);
		if (G.inColor) {
			SetPort(G.virginCPtr!);
		} else {
			SetPort(G.offVirginPort!);
		}
	}
}

//=================================

async function LetsEnd(): Promise<void> {
	SetItem(GetMenu(mGame)!, iBegin, 'Begin Game…');
	await WrapItUp();
	DrawMenuBar();
}

//=================================

export async function Coordinate(): Promise<void> {
	GetKeys(G.theKeys);

	while (G.playing && !G.pausing) {
		PlayActive.timeIs = TickCount();
		G.liftAmount = 2;
		G.binaryFlip = BitXor(G.binaryFlip, 1);
		if (G.bandBorne) {
			HandleBand();
		}
		if (G.lifeNormal) {
			await SearchRects();
			GetKeys(G.theKeys);
			GetInput();
			MoveGlider();
		} else {
			await DoSpecial();
		}

		if (G.playing) {
			if (G.nAnimates > 0) {
				await MoveAnimates();
			}
			if (G.nCycleObs > 0) {
				MoveCycleObs();
			}
			if (G.hasWindow) {
				MonitorStorm();
			}

			if (G.areFlipping) {
				DrawFlipScene();
			} else {
				if (G.inColor) {
					DrawCScene();
				} else {
					DrawScene();
				}
			}

			if (G.scoreIsRolling) {
				BumpTheScore();
			}
		}

		if (G.theKeys[kCommandKeyMap] && G.theKeys[kQKeyMap]) {
			await LetsQuit();
		}

		if (G.theKeys[kCommandKeyMap] && G.theKeys[kSKeyMap]) {
			await LetsSave();
		}

		if (G.theKeys[kCommandKeyMap] && G.theKeys[kEKeyMap]) {
			await LetsEnd();
		}

		if (G.theKeys[kTabKeyMap]) {
			LetsPause();
		}

		SetCursor(G.noCursor!);
		// Port: `repeat until (TickCount >= (timeIs + 2))` with an empty body: test first, then let a tick pass.
		while (!(TickCount() >= PlayActive.timeIs + 2)) {
			await Yield();
		}

		G.loopsThruRoom = G.loopsThruRoom + 1;
		G.bassLoop = G.bassLoop + 1;
		if (G.bassLoop >= G.playBassTime) {
			G.bassLoop = 0;
			DoTheBass(kDuhDumSound);
			G.playBassTime = int16(div(kBonusTimeToBeat - G.loopsThruRoom, kBassFract) + kMinBassLoop);
			if (G.playBassTime < kMinBassLoop) {
				G.playBassTime = kMinBassLoop;
			}
		}
	}

	FlushEvents(everyEvent, 0);
	InitCursor();
	DrawMenuBar();
	if (G.scoreList.rank !== 20) {
		DrawHiScores();
	}
}

//=================================
