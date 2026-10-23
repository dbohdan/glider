// Port of E-FlyGlider.p: "Try Glider", a test flight of the glider through the room being edited.
//
// Much of this unit is a copy of Glider's play code (G-PlayActive.p, G-PlayUtils.p), cut down: no
// sounds but SysBeep, no score, no animates, no bands, and no leaving the room. Where the Pascal is
// the same as Glider's, the TypeScript has the shape of src/glider/PlayActive.ts and PlayUtils.ts.

import {
	BitXor,
	black,
	Button,
	ClipRect,
	cloneRect,
	CopyBits,
	CopyMask,
	Delay,
	DisposeRgn,
	div,
	everyEvent,
	FillRect,
	FlushEvents,
	FrameRect,
	GetKeys,
	GetMouse,
	HideCursor,
	HLock,
	HUnlock,
	InitCursor,
	InsetRect,
	int16,
	int32,
	LineTo,
	mouse,
	MoveTo,
	NewRgn,
	OffsetRect,
	patOr,
	patXor,
	PenMode,
	PenNormal,
	PenSize,
	RectRgn,
	SectRect,
	SetClip,
	SetPort,
	SetPt,
	SetRect,
	srcCopy,
	SysBeep,
	TextFont,
	TextMode,
	TextSize,
	TickCount,
	Yield,
	type Integer,
	type LongInt,
	type Point,
	type Rect,
} from '../mac/Toolbox.ts';
import { readLayout, sizeOf, writeLayout, zeroOf } from '../mac/PascalLayout.ts';
import {
	absMouse,
	airOnIt,
	ascendIt,
	ascending,
	awardIt,
	ball,
	bandIt,
	basket,
	battry,
	bnsRct,
	books,
	burnIt,
	burning,
	cabnet,
	candle,
	celDct,
	celVnt,
	ceilingVert,
	clock,
	crashIt,
	descendIt,
	descending,
	drip,
	dropIt,
	dropKey,
	dnStar,
	energizeIt,
	extraIt,
	extRct,
	fadingIn,
	fadingOut,
	floorLimit,
	floorVert,
	flrVnt,
	fshBwl,
	G,
	grease,
	guitar,
	holdKey,
	ignoreIt,
	kCommandKeyMap,
	kTabKeyMap,
	lftFan,
	liftIt,
	lightIt,
	litSwt,
	macTsh,
	iGamepad,
	maxThrust,
	mirror,
	mouseSlop,
	moveIt,
	normal,
	obsRct,
	outlet,
	paintg,
	paper,
	playIt,
	pwrSwt,
	rbrBnd,
	relMouse,
	ritFan,
	type roomData,
	roomDataLayout,
	shelf,
	shredding,
	shredIt,
	shredr,
	slideIt,
	spillIt,
	steamIt,
	table,
	teaKtl,
	thermo,
	toastr,
	toggleIt,
	trickIt,
	turnItLeft,
	turnItRight,
	turnLf2Rt,
	turnRt2Lf,
	upStar,
	window,
	zapIt,
} from './Globals.ts';
import { DoRandom, SpinBall } from './Utilities.ts';
import { PadInput } from './Additions.ts';
import { thrustOf } from '../additions/Pads.ts';
import { DrawAllObjects, LoadABackground } from './Drawing.ts';
import { AutoHideShow } from './ObjectStuff.ts';

// Port: the interface also declares `procedure ResetGlider;`, which the unit never implements and
// no unit calls; THINK Pascal let that pass, and the port leaves it out.

/** The unit's interface variables (no other unit assigns them). */
export let nObjects: Integer = 0;
export let timeIs: LongInt = 0;
export let testRoom: roomData = zeroOf(roomDataLayout);

/** Port: a local Rect variable, which Pascal leaves uninitialized. */
function newRect(): Rect {
	return { top: 0, left: 0, bottom: 0, right: 0 };
}

/** Port: Pascal's record assignment of a roomData copies it; a round trip through its bytes does. */
function copyRoom(room: roomData): roomData {
	const bytes = new Uint8Array(sizeOf(roomDataLayout));
	writeLayout(roomDataLayout, room, bytes, 0);
	return readLayout(roomDataLayout, bytes, 0);
}

//=================================

function CenterMouse(): void {
	// const MBState = $172; MTemp = $828; RawMouse = $82C; Mouse = $830; CrsrNew = $8CE; CrsrCouple = $8CF; Couple = $FF; Uncouple = $00;
	// var lowGlob: Integer; lowMem: Ptr; pointPtr: ^Point; (lowGlob unused)
	const center: Point = { v: 0, h: 0 };

	SetPt(center, 256, 171);
	// Port: the editor writes the point to the low-memory globals RawMouse and MTemp, and $FFFF to
	// CrsrNew so that the cursor is redrawn there. The port's machine keeps the mouse location in
	// `mouse`, as in Glider's CenterMouse.
	mouse.where = { h: center.h, v: center.v };
}

//=================================

async function ReadyGlider(): Promise<void> {
	const mousePt: Point = { v: 0, h: 0 };
	let _dummyLong: LongInt;
	let timeToStop: LongInt;
	let tempRect: Rect;
	const theGlider = G.theGlider;

	theGlider.bands = 0;
	theGlider.forVel = 4;
	theGlider.energy = 0;
	theGlider.mode = fadingIn;
	theGlider.phase = 0;
	theGlider.isForward = true;
	theGlider.isRight = true;
	if (theGlider.isRight) {
		SetRect(theGlider.destRect, 0, 40, 48, 60);
	} else {
		SetRect(theGlider.destRect, 464, 40, 512, 60);
	}
	theGlider.oldRect = cloneRect(theGlider.destRect);
	theGlider.wholeRect = cloneRect(theGlider.destRect);
	theGlider.srcNum = 0;
	theGlider.mass = G.currMass;

	G.lifeNormal = false;
	PenNormal();
	PenMode(patXor);
	FrameRect(theGlider.destRect);

	// repeat until not Button
	while (Button()) {
		await Yield();
	}

	do {
		FrameRect(theGlider.oldRect);
		GetMouse(mousePt);
		SetRect(theGlider.destRect, -24, -10, 24, 10);
		OffsetRect(theGlider.destRect, mousePt.h, mousePt.v);
		FrameRect(theGlider.destRect);
		theGlider.oldRect = cloneRect(theGlider.destRect);
		await Yield();
	} while (!Button());

	FrameRect(theGlider.oldRect);
	tempRect = cloneRect(theGlider.oldRect);
	InsetRect(tempRect, -1, -1);
	FrameRect(tempRect);

	theGlider.oldRect = cloneRect(theGlider.destRect);
	theGlider.wholeRect = cloneRect(theGlider.destRect);
	theGlider.shadoDest = cloneRect(theGlider.destRect);
	theGlider.shadoDest.top = floorVert;
	theGlider.shadoDest.bottom = floorVert + 11;
	theGlider.oldShado = cloneRect(theGlider.shadoDest);
	theGlider.wholeShado = cloneRect(theGlider.shadoDest);
	theGlider.touchRect = cloneRect(theGlider.destRect);
	InsetRect(theGlider.touchRect, 10, 5);
	if (G.inColor) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
	} else {
		CopyMask(G.offPlayerMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
	}

	timeToStop = TickCount() + 120;
	do {
		SpinBall();
		_dummyLong = await Delay(2);
	} while (!(TickCount() > timeToStop));

	FrameRect(tempRect);
}

//=================================

export function ExtractEventRects(): void {
	let index: Integer = 0;
	let tempInt: Integer = 0;
	let tempNum: Integer = 0;
	let tempRect = newRect();

	const theObject = (): roomData['theObjects'][number] => testRoom.theObjects[index];

	//-------------------------

	function SetUpGrease(): void {
		G.nCycleObs = G.nCycleObs + 1;
		const obj = theObject();
		if (obj.isOn) {
			G.eventRect[index] = cloneRect(obj.boundRect);
			const c = G.cycleObjects[G.nCycleObs];
			c.kindIs = grease;
			c.tiedTo = index;
			c.wholeRect = cloneRect(G.eventRect[index]);
			c.oldRect = cloneRect(c.wholeRect);
			c.reset = 0; // phase=not spilled
			c.accel = grease; // graphic # to display
			c.velocity = c.wholeRect.right; // current length of spill
			c.position = obj.amount; // full length of spill
		} else {
			G.eventRect[index].left = obj.boundRect.right;
			G.eventRect[index].bottom = obj.boundRect.bottom;
			G.eventRect[index].right = obj.amount;
			G.eventRect[index].top = obj.boundRect.bottom - 4;
			const c = G.cycleObjects[G.nCycleObs];
			c.kindIs = grease;
			c.tiedTo = index;
			c.wholeRect = cloneRect(obj.boundRect);
			c.oldRect = cloneRect(c.wholeRect);
			c.reset = 999; // phase=spilled
			c.accel = 59; // graphic # to display
			c.velocity = obj.amount; // current length of spill
			c.position = obj.amount; // length of spill
		}
	}

	//-------------------------

	function FrameOutlet(): void {
		G.nCycleObs = G.nCycleObs + 1;
		G.eventRect[index] = cloneRect(theObject().boundRect);
		const c = G.cycleObjects[G.nCycleObs];
		c.kindIs = outlet;
		c.tiedTo = index;
		G.eventKind[c.tiedTo][1] = 0;
		c.accel = 25;
		c.wholeRect = cloneRect(theObject().boundRect);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = theObject().amount;
		c.position = TickCount();
	}

	//-------------------------

	function FrameCandle(): void {
		G.nCycleObs = G.nCycleObs + 1;
		{
			const obj = theObject();
			tempInt = div(obj.boundRect.right + obj.boundRect.left, 2);
			SetRect(G.eventRect[index], tempInt - 12, obj.amount, tempInt + 4, obj.boundRect.top);
		}
		const c = G.cycleObjects[G.nCycleObs];
		c.wholeRect = cloneRect(theObject().boundRect);
		c.wholeRect.bottom = c.wholeRect.top;
		c.wholeRect.top = c.wholeRect.bottom - 12;
		c.wholeRect.left = c.wholeRect.left + 5;
		c.wholeRect.right = c.wholeRect.left + 16;
		c.oldRect = cloneRect(c.wholeRect);
		c.kindIs = candle;
		c.position = DoRandom(3) + 48;
	}

	//-------------------------

	function FrameDrip(): void {
		// var objectType: Integer; (unused)
		G.nCycleObs = G.nCycleObs + 1;
		G.eventRect[index] = cloneRect(theObject().boundRect);
		const c = G.cycleObjects[G.nCycleObs];
		c.kindIs = drip;
		c.tiedTo = index;
		c.holdRect = cloneRect(theObject().boundRect);
		c.wholeRect = cloneRect(c.holdRect);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(theObject().amount * 32);
		c.accel = 12;
		c.position = int16(c.holdRect.bottom * 32);
		c.velocity = 0;
		c.phase = 53;

		const obj = theObject();
		if (G.inColor) {
			CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[obj.objectIs], G.srcRect[obj.objectIs], obj.boundRect);
		} else {
			CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[obj.objectIs], G.srcRect[obj.objectIs], obj.boundRect);
		}
	}

	//-------------------------

	function ReadyToast(): void {
		G.nCycleObs = G.nCycleObs + 1;
		{
			const obj = theObject();
			tempInt = obj.boundRect.left + 3;
			tempNum = obj.boundRect.bottom - 3;
			SetRect(G.eventRect[index], 0, 0, 32, 31);
			OffsetRect(G.eventRect[index], tempInt, tempNum);
			SetRect(tempRect, tempInt, obj.amount, tempInt + 32, obj.boundRect.top);

			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[obj.objectIs], G.srcRect[obj.objectIs], obj.boundRect);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[obj.objectIs], G.srcRect[obj.objectIs], obj.boundRect);
			}
		}
		G.toastRgn = NewRgn();
		RectRgn(G.toastRgn, tempRect);
		G.hasToast = true;

		const c = G.cycleObjects[G.nCycleObs];
		c.phase = 60;
		c.kindIs = toastr;
		c.tiedTo = index;
		c.wholeRect = cloneRect(G.eventRect[index]);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(tempNum * 32);
		c.accel = 8;
		c.position = c.reset;
		tempInt = int16((theObject().amount + 32) * 32);
		c.velocity = 0;
		do {
			c.velocity = int16(c.velocity + c.accel);
			tempInt = int16(tempInt + c.velocity);
		} while (!(tempInt > c.reset));
		c.velocity = int16(-c.velocity);
	}

	//-------------------------

	function FrameBall(): void {
		G.nCycleObs = G.nCycleObs + 1;
		G.eventRect[index] = cloneRect(theObject().boundRect);
		const c = G.cycleObjects[G.nCycleObs];
		c.kindIs = ball;
		c.tiedTo = index;
		c.wholeRect = cloneRect(theObject().boundRect);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(theObject().boundRect.bottom * 32);
		c.accel = 8;
		c.position = c.reset;
		tempInt = int16((theObject().amount + 32) * 32);
		c.velocity = 0;
		do {
			c.velocity = int16(c.velocity + c.accel);
			tempInt = int16(tempInt + c.velocity);
		} while (!(tempInt > c.reset));
		c.velocity = int16(-c.velocity);
	}

	//-------------------------

	function ReadyFish(): void {
		G.nCycleObs = G.nCycleObs + 1;
		{
			const obj = theObject();
			tempInt = obj.boundRect.left + 8;
			tempNum = obj.boundRect.top + 24;
			SetRect(G.eventRect[index], 0, 0, 16, 16); // fish rectangle
			OffsetRect(G.eventRect[index], tempInt, tempNum);

			if (G.inColor) {
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.virginCPtr!.portPixMap, G.srcRect[obj.objectIs], G.srcRect[obj.objectIs], obj.boundRect);
			} else {
				CopyMask(G.offPlayerMap, G.offMaskMap, G.offVirginMap, G.srcRect[obj.objectIs], G.srcRect[obj.objectIs], obj.boundRect);
			}
		}

		const c = G.cycleObjects[G.nCycleObs];
		c.phase = 69; // # of fish rect
		c.kindIs = fshBwl;
		c.tiedTo = index;
		c.wholeRect = cloneRect(G.eventRect[index]);
		c.oldRect = cloneRect(c.wholeRect);
		c.reset = int16(tempNum * 32);
		c.accel = 8;
		c.position = c.reset;
		tempInt = int16((theObject().amount + 32) * 32);
		c.velocity = 0;
		do {
			c.velocity = int16(c.velocity + c.accel);
			tempInt = int16(tempInt + c.velocity);
		} while (!(tempInt > c.reset));
		c.velocity = int16(-c.velocity);
	}

	//-------------------------

	function ReadyTea(): void {
		G.nCycleObs = G.nCycleObs + 1;

		{
			const obj = theObject();
			tempInt = obj.boundRect.left;
			tempNum = obj.boundRect.top;
			SetRect(G.eventRect[index], tempInt - 128, tempNum - 128, tempInt, tempNum);
			if (G.eventRect[index].top < ceilingVert) {
				G.eventRect[index].top = ceilingVert;
			}
			if (G.eventRect[index].left < 0) {
				G.eventRect[index].left = 0;
			}
		}

		const c = G.cycleObjects[G.nCycleObs];
		c.phase = 0;
		c.kindIs = teaKtl;
		c.tiedTo = index;
		SetRect(c.wholeRect, 0, 0, 0, 0);
		c.oldRect = cloneRect(c.wholeRect);
		c.position = theObject().amount;
		c.reset = int32(c.position + DoRandom(120));
	}

	//-------------------------

	function FrameWindow(): void {
		nObjects = nObjects - 1;
	}

	//-------------------------

	function FrameMirror(): void {
		nObjects = nObjects - 1;

		tempRect = cloneRect(theObject().boundRect);
		InsetRect(tempRect, 5, 5);
	}

	//-------------------------

	G.windowOpen = false;

	if (testRoom.conditionCode === 2) {
		G.lightsOut = true;
	} else {
		G.lightsOut = false;
	}
	if (testRoom.conditionCode === 1) {
		G.airOut = true;
	} else {
		G.airOut = false;
	}

	G.nCycleObs = 0;
	nObjects = testRoom.numberOObjects;
	tempNum = nObjects;
	// A Pascal for loop takes its bound once: the SetUp procedures change tempNum.
	for (let last = tempNum, i = 1; i <= last; i++) {
		index = i;
		const obj = theObject();
		const boundRect = obj.boundRect;
		const amount = obj.amount;

		switch (obj.objectIs) {
			case table:
			case shelf:
			case books:
			case cabnet:
			case extRct:
			case obsRct:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case flrVnt:
				tempInt = div(boundRect.right + boundRect.left, 2);
				SetRect(G.eventRect[index], tempInt - 8, amount, tempInt + 8, floorVert);
				break;
			case celVnt:
				tempInt = div(boundRect.right + boundRect.left, 2);
				SetRect(G.eventRect[index], tempInt - 8, ceilingVert, tempInt + 8, amount);
				break;
			case celDct:
				if (obj.isOn) {
					tempInt = div(boundRect.right + boundRect.left, 2);
					SetRect(G.eventRect[index], tempInt - 8, ceilingVert, tempInt + 8, amount);
				} else {
					G.eventRect[index] = cloneRect(boundRect);
					G.eventRect[index].bottom = G.eventRect[index].top + 8;
				}
				break;
			case candle:
				FrameCandle();
				break;
			case lftFan:
				SetRect(G.eventRect[index], amount, boundRect.top + 10, boundRect.left, boundRect.top + 30);
				break;
			case ritFan:
				SetRect(G.eventRect[index], boundRect.right, boundRect.top + 10, amount, boundRect.top + 30);
				break;
			case clock:
			case paper:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case grease:
				SetUpGrease();
				break;
			case bnsRct:
			case battry:
			case rbrBnd:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case litSwt:
			case thermo:
			case pwrSwt:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case shredr:
				G.eventRect[index] = cloneRect(boundRect);
				G.eventRect[index].top = G.eventRect[index].top - 4;
				G.eventRect[index].bottom = G.eventRect[index].bottom - 12;
				break;
			case outlet:
				FrameOutlet();
				break;
			case guitar:
				SetRect(G.eventRect[index], boundRect.left + 36, boundRect.top + 24, boundRect.left + 38, boundRect.bottom - 56);
				break;
			case ball:
				FrameBall();
				break;
			case drip:
				FrameDrip();
				break;
			case toastr:
				ReadyToast();
				break;
			case fshBwl:
				ReadyFish();
				break;
			case teaKtl:
				ReadyTea();
				break;
			case window:
				FrameWindow();
				break;
			case paintg:
				nObjects = nObjects - 1;
				break;
			case mirror:
				FrameMirror();
				break;
			case basket:
			case macTsh:
				G.eventRect[index] = cloneRect(boundRect);
				break;
			case upStar:
				SetRect(G.eventRect[index], boundRect.left + 32, boundRect.top, boundRect.right - 32, boundRect.top + 8);
				break;
			case dnStar:
				SetRect(G.eventRect[index], boundRect.left + 32, boundRect.bottom - 8, boundRect.right - 32, boundRect.bottom);
				break;
			default:
				G.eventRect[index] = cloneRect(G.nullRect);
		} // case

		const eventKind = G.eventKind[index];
		eventKind[1] = 0;
		switch (obj.objectIs) {
			case table:
			case shelf:
			case books:
			case cabnet:
			case obsRct:
			case drip:
			case toastr:
			case ball:
			case fshBwl:
			case basket:
			case macTsh:
				eventKind[0] = crashIt;
				break;
			case extRct:
				eventKind[0] = moveIt;
				break;
			case flrVnt:
				eventKind[0] = liftIt;
				break;
			case celVnt:
				eventKind[0] = dropIt;
				break;
			case celDct:
				if (obj.isOn) {
					eventKind[0] = dropIt;
				} else {
					eventKind[0] = moveIt;
					eventKind[1] = obj.extra;
				}
				break;
			case candle:
				eventKind[0] = burnIt;
				eventKind[1] = boundRect.bottom - 48;
				break;
			case lftFan:
				if (obj.isOn) {
					eventKind[0] = turnItLeft;
				} else {
					eventKind[0] = ignoreIt;
				}
				break;
			case ritFan:
				if (obj.isOn) {
					eventKind[0] = turnItRight;
				} else {
					eventKind[0] = ignoreIt;
				}
				break;
			case clock:
				eventKind[0] = awardIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case paper:
				eventKind[0] = extraIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case grease:
				if (obj.isOn) {
					eventKind[0] = spillIt;
				} else {
					eventKind[0] = slideIt;
				}
				break;
			case bnsRct:
				eventKind[0] = trickIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case battry:
				eventKind[0] = energizeIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case rbrBnd:
				eventKind[0] = bandIt;
				eventKind[1] = amount;
				if (amount < 1) {
					G.eventRect[index] = cloneRect(G.nullRect);
				}
				break;
			case litSwt:
				eventKind[0] = lightIt;
				break;
			case outlet:
				eventKind[0] = zapIt;
				break;
			case thermo:
				eventKind[0] = airOnIt;
				break;
			case shredr:
				if (obj.isOn) {
					eventKind[0] = shredIt;
				} else {
					eventKind[0] = ignoreIt;
				}
				break;
			case pwrSwt:
				eventKind[0] = toggleIt;
				eventKind[1] = amount; // object# linked to
				break;
			case guitar:
				eventKind[0] = playIt;
				eventKind[1] = 0;
				break;
			case upStar:
				eventKind[0] = ascendIt;
				eventKind[1] = amount; // room # linked to
				break;
			case dnStar:
				eventKind[0] = descendIt;
				eventKind[1] = amount; // room # linked to
				break;
			default:
				eventKind[0] = ignoreIt;
		} // case
	}
}

//=================================

export function ReadyRoom(): void {
	// var index: Integer; (unused)
	G.rightIsOpen = testRoom.rightOpen;
	G.leftIsOpen = testRoom.leftOpen;

	ExtractEventRects();
}

//=================================

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

//=================================

function Collision(whatKind: Integer, who: Integer): void {
	// var tempRect, srcR: Rect; (unused)
	let tempInt: Integer;
	const theGlider = G.theGlider;

	switch (whatKind) {
		case ignoreIt:
			break;

		case crashIt:
			SysBeep(1);
			G.lifeNormal = false;
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

		case moveIt:
			SysBeep(1);
			G.lifeNormal = false;
			theGlider.mode = fadingOut;
			theGlider.destRect.top = theGlider.destRect.bottom - 20;
			if (theGlider.isForward) {
				theGlider.srcNum = 0;
			} else {
				theGlider.srcNum = 2;
			}
			break;

		case dropIt:
			if (!G.airOut) {
				G.liftAmount = 7;
			}
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
				SysBeep(1);
				G.lifeNormal = false;
				if (theGlider.isRight) {
					theGlider.phase = 1;
				}
				theGlider.mode = burning;
				theGlider.destRect.top = theGlider.destRect.bottom - 36;
			}
			break;

		case awardIt:
			if (G.eventKind[who][1] !== 0) {
				SysBeep(1);
				G.eventKind[who][1] = 0;
			}
			break;

		case extraIt:
			if (G.eventKind[who][1] !== 0) {
				SysBeep(1);
				G.eventKind[who][1] = 0;
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
			G.sliding = true;
			break;

		case bandIt:
			if (G.eventKind[who][1] !== 0) {
				SysBeep(1);
				G.eventKind[who][1] = 0;
			}
			break;

		case energizeIt:
			if (G.eventKind[who][1] !== 0) {
				SysBeep(1);
				theGlider.energy = theGlider.energy + G.eventKind[who][1];
				G.eventKind[who][1] = 0;
			}
			break;

		case trickIt:
			if (G.eventKind[who][1] !== 0) {
				SysBeep(1);
				G.eventKind[who][1] = 0;
			}
			break;

		case lightIt:
			if (G.lightsOut) {
				SysBeep(1);
				testRoom.conditionCode = 0;
				G.lightsOut = false;
			}
			break;

		case airOnIt:
			if (G.airOut) {
				SysBeep(1);
				G.airOut = false;
			}
			break;

		case zapIt:
			if (G.eventKind[who][1] !== 0) {
				G.lifeNormal = false;
				theGlider.mode = fadingOut;
				theGlider.destRect.top = theGlider.destRect.bottom - 20;
				if (theGlider.isForward) {
					theGlider.srcNum = 0;
				} else {
					theGlider.srcNum = 2;
				}
			} // end - if (eventKind
			break; // end - zapIt

		case toggleIt:
			if (G.eventKind[who][2] < TickCount()) {
				SysBeep(1);
				tempInt = G.eventKind[who][1];
				{
					const obj = G.thisHouse.theRooms[G.roomAt].theObjects[tempInt];
					obj.isOn = !obj.isOn;
					switch (obj.objectIs) {
						case lftFan:
							if (G.eventKind[tempInt][0] === ignoreIt) {
								SysBeep(1);
								G.eventKind[tempInt][0] = turnItLeft;
							} else {
								G.eventKind[tempInt][0] = ignoreIt;
							}
							break;
						case ritFan:
							if (G.eventKind[tempInt][0] === ignoreIt) {
								SysBeep(1);
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
				SysBeep(1);
				G.eventKind[who][1] = TickCount() + 120;
			}
			break;

		case ascendIt:
			G.lifeNormal = false;
			theGlider.mode = ascending;
			G.playing = false;
			break;

		case descendIt:
			G.lifeNormal = false;
			theGlider.mode = descending;
			G.playing = false;
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

function SearchRects(): void {
	let outside: Integer = 0;
	let hotRect: Rect;
	// var tempRect: Rect; (unused)

	//----------------

	function BiteIt(): void {
		const theGlider = G.theGlider;
		SysBeep(1);
		G.lifeNormal = false;
		theGlider.mode = fadingOut;
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
		hotRect = cloneRect(theGlider.touchRect); // get 'hot rect'
		if (G.rightIsOpen) {
			// check right edge
			if (theGlider.destRect.left > 500) {
				G.playing = false;
				return;
			}
		} else if (theGlider.destRect.right > 512) {
			outside = 512 - theGlider.destRect.right;
			GetItLegal();
		}
		if (G.leftIsOpen) {
			// check left edge
			if (theGlider.destRect.right < 12) {
				G.playing = false;
				return;
			}
		} else if (theGlider.destRect.left < 0) {
			outside = -theGlider.destRect.left;
			GetItLegal();
		}
		if (theGlider.destRect.bottom > floorLimit) {
			// check floor
			BiteIt();
		}
	} // ---with theGlider do---

	G.shiftAmount = 0;

	// Port: a Pascal for loop's bounds are evaluated once.
	for (let index = 1, last = nObjects; index <= last; index++) {
		if (RectLap(G.eventRect[index], hotRect)) {
			Collision(G.eventKind[index][0], index);
		}
	}
}

//=================================

function GetInput(): void {
	let pull: Integer;
	const thePt: Point = { v: 0, h: 0 };
	// var dest: Rect; (unused)

	//--------------------

	function PushIt(howFast: Integer): void {
		G.theGlider.forVel = howFast;
	}

	//--------------------

	function FireBand(): void {
		// Port: empty in the editor; the test flight has no rubber bands.
	}

	//--------------------

	const theGlider = G.theGlider;
	const theKeys = G.theKeys;
	switch (G.controlMethod) {
		case holdKey:
			GetKeys(theKeys);
			if (theKeys[G.leftKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
					theGlider.forVel = -maxThrust;
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					theGlider.forVel = -maxThrust;
				}
			} else if (theKeys[G.rightKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					theGlider.forVel = maxThrust;
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
					theGlider.forVel = maxThrust;
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
				theGlider.forVel = maxThrust;
			} else {
				theGlider.forVel = -maxThrust;
			}
			GetKeys(theKeys);
			if (theKeys[G.leftKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = false;
					theGlider.srcNum = 1;
					theGlider.forVel = -maxThrust;
				} else {
					theGlider.isForward = true;
					theGlider.srcNum = 2;
					theGlider.forVel = -maxThrust;
				}
			} else if (theKeys[G.rightKey]) {
				if (theGlider.isRight) {
					theGlider.isForward = true;
					theGlider.srcNum = 0;
					theGlider.forVel = maxThrust;
				} else {
					theGlider.isForward = false;
					theGlider.srcNum = 3;
					theGlider.forVel = maxThrust;
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
			GetKeys(theKeys);
			if (theKeys[G.bandKey] && !G.bandBorne) {
				FireBand();
			}

			GetMouse(thePt);
			pull = div(thePt.h - 256 + G.rightOffset, 32);
			if (pull > maxThrust) {
				pull = maxThrust;
			} else if (pull < -maxThrust) {
				pull = -maxThrust;
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
			GetKeys(theKeys);
			if (theKeys[G.bandKey] && !G.bandBorne) {
				// fire rubber bands
				FireBand();
			}

			GetMouse(thePt);
			theGlider.forVel = div(thePt.h - 256 + G.rightOffset, mouseSlop);
			if (theGlider.forVel > maxThrust) {
				theGlider.forVel = maxThrust;
			} else if (theGlider.forVel < -maxThrust) {
				theGlider.forVel = -maxThrust;
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

		// Port: the additions' Gamepad (Additions.ts), as Glider has it: Hold Keyboard's steering at the
		// gamepad's thrust (a stick's in proportion), and the keys as Hold Keyboard reads them.
		case iGamepad: {
			GetKeys(theKeys);
			const pad = PadInput();
			let thrust = thrustOf(pad.steer, maxThrust);
			if (thrust === 0 && theKeys[G.leftKey]) {
				thrust = -maxThrust;
			} else if (thrust === 0 && theKeys[G.rightKey]) {
				thrust = maxThrust;
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
	const theGlider = G.theGlider;
	G.liftAmount = G.liftAmount + 1; // add gravity
	if (G.sliding) {
		G.liftAmount = 0; // zero out lift
		G.sliding = false;
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

// Port: the editor's inline IncInt (ADDQ.W #1) and IncLong (ADDQ.L #1) are written at each use as
// `x = int16(x + 1)` and `x = int32(x + 1)`, as in Glider's PlayActive.ts.

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
					SysBeep(1);
					G.eventKind[c.tiedTo][0] = slideIt;
					c.reset = 1;
				}
				if (c.reset !== 0 && c.reset !== 999) {
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
					if (TickCount() > c.position + c.reset) {
						c.accel = G.binaryFlip + 51;
						c.position = TickCount();
						G.eventKind[c.tiedTo][1] = 1;
					}
				} else {
					if (TickCount() > c.position + 60) {
						c.accel = 25;
						c.position = TickCount();
						G.eventKind[c.tiedTo][1] = 0;
					} else {
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
						c.velocity = 0;
						c.position = int16(c.holdRect.bottom * 32);
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
						diff = int16(div(c.position, 32) - r.bottom);
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
						c.velocity = -c.velocity;
						c.position = c.reset;
						c.reset = TickCount() + G.thisHouse.theRooms[G.roomAt].theObjects[c.tiedTo].extra;
						c.phase = 0;
					}
					c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
					{
						const r = G.eventRect[c.tiedTo];
						diff = int16(div(c.position, 32) - r.bottom);
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
						c.reset = c.position;
						c.phase = 60;
					}
				} // toastr
				break;

			case ball:
				c.velocity = c.velocity + c.accel;
				c.position = c.position + c.velocity;
				if (c.position > c.reset) {
					c.velocity = -c.velocity;
					c.position = c.reset;
				}
				c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
				{
					const r = G.eventRect[c.tiedTo];
					diff = int16(div(c.position, 32) - r.bottom);
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
						c.velocity = -c.velocity;
						c.position = c.reset;
						c.reset = TickCount() + G.thisHouse.theRooms[G.roomAt].theObjects[c.tiedTo].extra;
						c.phase = 0;
					}
					c.wholeRect = cloneRect(G.eventRect[c.tiedTo]);
					{
						const r = G.eventRect[c.tiedTo];
						diff = int16(div(c.position, 32) - r.bottom);
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
						c.reset = c.position;
						c.phase = 66;
					}
				} // fish bowl
				break;

			case teaKtl:
				if (TickCount() > c.reset) {
					G.eventKind[c.tiedTo][0] = steamIt;
					// Pascal: if (phase = 0) then ; (an empty statement where Glider plays a sound)
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

function DoSpecial(): void {
	const theGlider = G.theGlider;
	switch (theGlider.mode) {
		case fadingIn:
			theGlider.phase = int16(theGlider.phase + 1); // IncInt(phase)
			if (theGlider.phase > 16) {
				if (theGlider.isForward) {
					theGlider.srcNum = 0;
				} else {
					theGlider.srcNum = 3;
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
				G.playing = false;
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
			SearchRects();
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
			SearchRects();
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
			SearchRects();
			MoveGlider();
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
			if (theGlider.destRect.top < 150) {
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
			if (theGlider.destRect.top > 150) {
				G.lifeNormal = true;
				theGlider.phase = 0;
				theGlider.mode = normal;
			}
			break;
		case shredding:
			if (theGlider.phase === 0) {
				theGlider.destRect.bottom = theGlider.destRect.bottom + 1;
				if (theGlider.destRect.bottom >= theGlider.destRect.top + 36) {
					theGlider.phase = 1;
				}
			} else {
				theGlider.destRect.top = theGlider.destRect.top + 8;
				theGlider.destRect.bottom = theGlider.destRect.bottom + 8;
				if (theGlider.destRect.top > 342) {
					theGlider.phase = 0;
					G.playing = false;
				}
			}
			break; // end - shred
		default:
	}
}

//=================================

function DrawScene(): void {
	let tempInt: Integer;
	// var tempRect, tempSmRect: Rect; (unused)
	const theGlider = G.theGlider;

	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			CopyBits(G.offVirginMap, G.offLoadMap, c.wholeRect, c.wholeRect, srcCopy, G.wholeRgn);
		}
	}

	//-----pop masks on-----
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
				case ball:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.kindIs], G.srcRect[c.kindIs], G.eventRect[c.tiedTo]);
					break;
				case drip:
					CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
					break;
				case toastr:
					if (c.phase !== 0) {
						SetPort(G.offLoadPort!);
						HLock(G.toastRgn);
						SetClip(G.toastRgn!);
						CopyMask(G.offPlayerMap, G.offMaskMap, G.offLoadMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						ClipRect(G.wholeArea);
						HUnlock(G.toastRgn);
						SetPort(G.mainWndo!);
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
	//-----pop to visible screen-----
	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			CopyBits(G.offLoadMap, G.mainWndo!.portBits, c.wholeRect, c.wholeRect, srcCopy, G.wholeRgn);
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
			default:
		} // case
	}
}

//=================================

function DrawCScene(): void {
	let tempInt: Integer;
	const tempRect = newRect();
	// var tempSmRect: Rect; (unused)
	const theGlider = G.theGlider;

	if (G.nCycleObs > 0) {
		for (let index = 1, last = G.nCycleObs; index <= last; index++) {
			const c = G.cycleObjects[index];
			CopyBits(G.virginCPtr!.portPixMap, G.loadCPtr!.portPixMap, c.oldRect, c.oldRect, srcCopy, G.wholeRgn);
		}
	}
	//-----pop masks on-----
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
						HLock(G.toastRgn);
						SetClip(G.toastRgn!);
						CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.loadCPtr!.portPixMap, G.srcRect[c.phase], G.srcRect[c.phase], G.eventRect[c.tiedTo]);
						HUnlock(G.toastRgn);
						ClipRect(G.wholeArea);
						SetPort(G.mainWndo!);
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
	//-----pop to visible screen-----
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
				LineTo(c.velocity, c.wholeRect.bottom - 2);
			}
		}
	}
	if (G.lifeNormal) {
		CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
	} else {
		switch (theGlider.mode) {
			case fadingIn:
			case fadingOut:
				tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
				if (!theGlider.isRight) {
					tempInt = tempInt + 7;
				}
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[tempInt], theGlider.destRect);
				break;
			case turnLf2Rt:
			case turnRt2Lf:
				tempInt = G.nextPhase[theGlider.mode][theGlider.phase];
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[tempInt], G.glideRct[tempInt], theGlider.destRect);
				break;
			case burning:
			case ascending:
			case descending:
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.mainWndo!.portBits, G.glideRct[theGlider.srcNum], G.glideRct[theGlider.srcNum], theGlider.destRect);
				break;
			case shredding:
				SetRect(tempRect, 265, 208 - (theGlider.destRect.bottom - theGlider.destRect.top), 313, 208);
				CopyMask(G.objectCPtr!.portPixMap, G.offMaskMap, G.mainWndo!.portBits, tempRect, tempRect, theGlider.destRect);
				break;
			default:
		} // case
	}
}

//=================================

export async function FlyGlider(): Promise<void> {
	// var i: Integer; profileTime: LongInt; (unused)
	const tempRect = newRect();

	await AutoHideShow(true);
	G.thisHouse.theRooms[G.roomAt] = copyRoom(G.thisRoom);

	testRoom = copyRoom(G.thisRoom);
	if (G.inColor) {
		CopyBits(G.loadCPtr!.portPixMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	} else {
		CopyBits(G.offLoadMap, G.mainWndo!.portBits, G.wholeArea, G.wholeArea, srcCopy, G.mainWndo!.visRgn);
	}

	SetPort(G.mainWndo!);
	PenNormal();
	TextFont(0);
	TextSize(12);
	TextMode(patOr);
	ClipRect(G.fullArea);
	SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, 0);
	FillRect(tempRect, black);
	SetRect(tempRect, -G.rightOffset, 342, 512 + 2 * G.rightOffset, 342 + G.downOffset);
	FillRect(tempRect, black);
	SetRect(tempRect, -G.rightOffset, 0, 0, 342);
	FillRect(tempRect, black);
	SetRect(tempRect, 512, 0, 512 + G.rightOffset, 342);
	FillRect(tempRect, black);
	ClipRect(G.wholeArea);

	G.playing = true;
	G.pausing = false;
	G.hasToast = false;
	G.sliding = false;

	ReadyRoom();
	await ReadyGlider();

	HideCursor();

	while (G.playing && !G.pausing) {
		timeIs = TickCount();
		G.liftAmount = 2;
		G.binaryFlip = BitXor(G.binaryFlip, 1);
		if (G.lifeNormal) {
			SearchRects();
			GetInput();
			MoveGlider();
		} else {
			DoSpecial();
		}

		if (G.playing) {
			if (G.nCycleObs > 0) {
				MoveCycleObs();
			}
			SetPort(G.mainWndo!);
			if (G.inColor) {
				DrawCScene();
			} else {
				DrawScene();
			}
		}

		if (G.theKeys[kTabKeyMap]) {
			// pausing
			do {
				GetKeys(G.theKeys);
				await Yield();
			} while (G.theKeys[kTabKeyMap]);
			do {
				GetKeys(G.theKeys);
				await Yield();
			} while (!G.theKeys[kTabKeyMap]);
			do {
				GetKeys(G.theKeys);
				await Yield();
			} while (G.theKeys[kTabKeyMap]);
		}

		if (G.theKeys[kCommandKeyMap]) {
			// aborted
			G.playing = false;
		}

		// Port: `repeat until (TickCount >= (timeIs + 2))` with an empty body: test first, then let a tick pass.
		while (!(TickCount() >= timeIs + 2)) {
			await Yield();
		}
	}

	if (G.hasToast) {
		G.hasToast = false;
		DisposeRgn(G.toastRgn!);
	}
	G.lightsOut = false;
	G.airOut = false;

	await LoadABackground(G.thisRoom.backPictID);
	await DrawAllObjects();

	SetPort(G.mainWndo!);
	PenNormal();
	TextFont(0);
	TextSize(12);
	TextMode(patOr);
	ClipRect(G.fullArea);
	SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, 0);
	FillRect(tempRect, black);
	SetRect(tempRect, -G.rightOffset, 342, 512 + 2 * G.rightOffset, 342 + G.downOffset);
	FillRect(tempRect, black);
	SetRect(tempRect, -G.rightOffset, 0, 0, 342);
	FillRect(tempRect, black);
	SetRect(tempRect, 512, 0, 512 + G.rightOffset, 342);
	FillRect(tempRect, black);
	ClipRect(G.wholeArea);

	FlushEvents(everyEvent, 0);
	InitCursor();
	await AutoHideShow(false);
}

//=================================
