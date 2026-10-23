// Port of E-Globals.p: the Room Editor's constants, types, and global variables.
//
// As in Glider's Globals.ts: the constants keep their names, the record types become TypeScript
// types with a function that makes a zeroed record, and the variables live in the object G, created
// zeroed as the Segment Loader leaves the application globals (Pascal `roomAt` is `G.roomAt`).
// The house records are Glider's, byte for byte, so their layouts are Glider's.

import {
	type BitMap,
	type CCrsr,
	type Cursor,
	type EventRecord,
	type GrafPort,
	type Integer,
	type KeyMap,
	type LongInt,
	newEventRecord,
	newKeyMap,
	type Palette,
	type Pattern,
	type Point,
	type Ptr,
	type Rect,
	type Region,
	type RGBColor,
	type WindowRecord,
	GrafPort as GrafPortClass,
	pArray,
} from '../mac/Toolbox.ts';
import { zeroOf } from '../mac/PascalLayout.ts';
import { houseRecLayout, objectDataLayout, roomDataLayout } from '../glider/Globals.ts';

export { houseRecLayout, objectDataLayout, roomDataLayout };
export type { houseRec, objectData, roomData } from '../glider/Globals.ts';

export const dlgTop = 50;
export const dlgLeft = 85;

export const kDeleteKey = 0x08;
export const kTabKey = 0x09;
export const kLeftArrow = 0x1c;
export const kRightArrow = 0x1d;

export const kTabKeyMap = 0x30;
export const kCommandKeyMap = 0x37;

export const mApple = 128; // Menu resource ID
export const iNothing = 0;
export const iAboutEdit = 1;
export const mFile = 129; // Menu resource ID
export const iNew = 1;
export const iOpen = 2;
export const iClose = 4;
export const iSave = 5;
export const iSaveAs = 6;
export const iQuit = 8;
export const mEdit = 130; // Menu resource ID
export const iCut = 1;
export const iCopy = 2;
export const iPaste = 3;
export const iClear = 4;
export const mSpecial = 131; // Menu resource ID
export const iTryGlider = 1;
export const iControls = 2;
export const iRestoreDeep = 3;
export const iGoToRoom = 5;
export const iPrevRoom = 6;
export const iNextRoom = 7;
export const iNewRoom = 9;
export const mWindows = 132; // Menu resource ID
export const iTools = 1;
export const iAutoHideTools = 2;
export const iHouse = 4;
export const iRoomBack = 5;
export const iRoomCond = 6;
export const iObject = 7;
export const iHelp = 9;
export const mControls = 133; // Menu resource ID
export const iHoldKey = 1;
export const iDropKey = 2;
export const iAbsMouse = 3;
export const iRelMouse = 4;
// Port: `let`, not `const`: the port's additions insert Gamepad after Joystick, which moves Configure
// down (addControlItems).
export let iConfigure = 6;
/** Port: the last control method's item: Joystick, or with the additions, Gamepad. */
export let iLastControl = iRelMouse;
/** Port: the additions' Gamepad (Additions.ts), the item after Joystick and its control method. */
export const iGamepad = 5;

/** Port: makes room in the Controls submenu for the additions' control methods. */
export function addControlItems(by: number): void {
	iLastControl += by;
	iConfigure += by;
}

export const editToObject = 1;
export const editToRoom = 2;
export const fileExists = 3;
export const fileIsNew = 4;
export const noFileOpen = 5;

export const alertStrIDs = 128;
export const fileStrIDs = 129;

export const mainWndoID = 129;
export const fileAlertID = 129;
export const alertID = 128;
export const saveNoQuitID = 132;
export const saveNoCloseID = 133;
export const houseInfoID = 134;
export const depthAlertID = 136;
export const rCustomKeysID = 137;
export const lockAlertID = 138;
export const custGetID = 256;
export const objectPictID = 128;
export const maskPictID = 129;

export const sleep = 4;
export const ceilingVert = 24;
export const stairVert = 54;
export const floorVert = 325;
export const stackSize = 40960;
export const floorLimit = floorVert + 5;
export const maxThrust = 5;

export const holdKey = 1;
export const dropKey = 2;
export const absMouse = 3;
export const relMouse = 4;
export const mouseSlop = 10;

export const defaultLeftKey = 0x2b;
export const defaultRightKey = 0x2f;
export const defaultEnergyKey = 0x24;
export const defaultBandKey = 0x31;

export const defaultLeftName = ', key';
export const defaultRightName = '. key';
export const defaultEnergyName = 'return';
export const defaultBandName = 'space';

export const kErrUnaccounted = 1; // error codes
export const kErrMacPlusNeeded = 2; // these correspond with STR#
export const kErr2Or16Colors = 4; // resources for the TEXT part
export const kErrNotEnoughMem = 5; // of the message
export const kErrUnknownAtInit = 6;
export const kErrMemLow = 7; // unused
export const kErrGraphicsNotFound = 8;
export const kErrGraphicLoad = 9;
export const kErrTooManyRooms = 10;
export const kErrTooManyObjects = 11;
export const kErrLoadingRes = 12;
export const kErrFileExists = 13;
export const kErrNothingToPrint = 14;
// 15 unused
export const kErrWrongHouseVers = 17;

export const kErrExitSansGraphics = 20;
export const kErrSavingPrefs = 25;

// furniture
export const nulObj = 0;
export const table = 1;
export const shelf = 2;
export const books = 3;
export const cabnet = 4;
export const extRct = 5;
export const obsRct = 6;
// blowers
export const flrVnt = 8;
export const celVnt = 9;
export const celDct = 10;
export const candle = 11;
export const lftFan = 12;
export const ritFan = 13;
// table objects
export const clock = 16;
export const paper = 17;
export const grease = 18;
export const bnsRct = 19;
export const battry = 20;
export const rbrBnd = 21;
// wall objects
export const litSwt = 24;
export const outlet = 25;
export const thermo = 26;
export const shredr = 27;
export const pwrSwt = 28;
export const guitar = 29;
// animate objects
export const drip = 32;
export const toastr = 33;
export const ball = 34;
export const fshBwl = 35;
export const teaKtl = 36;
export const window = 37;
// jewelry
export const paintg = 40;
export const mirror = 41;
export const basket = 42;
export const macTsh = 43;
export const upStar = 44;
export const dnStar = 45;
// ------------------------------------
export const normal = 0; // mode
export const fadingIn = 1;
export const fadingOut = 2;
export const turnRt2Lf = 3;
export const turnLf2Rt = 4;
export const burning = 5;
export const ascending = 6;
export const descending = 7;
export const shredding = 8;

export const ignoreIt = 0; // null or unknown objects
export const crashIt = 1; // tables, shelves, cabinets, etc...
export const liftIt = 2; // floor vents
export const dropIt = 3; // ceiling blower, some ducts
export const moveIt = 4; // exit rects/suction ceiling ducts
export const burnIt = 5; // candle if too close
export const turnItLeft = 6; // left fan
export const turnItRight = 7; // right fan
export const awardIt = 8; // clocks
export const extraIt = 9; // folded pieces of paper
export const slideIt = 10; // grease fallen
export const trickIt = 11; // bonus rect
export const energizeIt = 12; // battery
export const bandIt = 13; // rubber bands
export const playIt = 14; // guitar
export const lightIt = 15; // light switch
export const zapIt = 16; // wall outlet
export const airOnIt = 17; // thermostats
export const shredIt = 18; // shredder
export const toggleIt = 19; // power switch
export const weightIt = 20;
export const spillIt = 21; // grease standing up
export const ascendIt = 22; // up stair case
export const descendIt = 23; // down stair case
export const steamIt = 24;

export const acurID = 128;
export const kCursCount = 12;

// ---------------------------------------------------------------------------------------------
// Types

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });
const point = (): Point => ({ v: 0, h: 0 });

/** Pascal `SICN = array[0..15] of Integer`: a small icon's 16 rows; SICNHand is a handle to them. */
export type SICN = Integer[];
export type SICNHand = SICN;

export interface gliderRec {
	destRect: Rect;
	oldRect: Rect;
	wholeRect: Rect;
	shadoDest: Rect;
	oldShado: Rect;
	wholeShado: Rect;
	touchRect: Rect;
	mode: Integer;
	phase: Integer;
	isRight: boolean;
	isForward: boolean;
	srcNum: Integer;
	forVel: Integer;
	mass: Integer;
	bands: Integer;
	energy: Integer;
}

export function newGliderRec(): gliderRec {
	return {
		destRect: rect(),
		oldRect: rect(),
		wholeRect: rect(),
		shadoDest: rect(),
		oldShado: rect(),
		wholeShado: rect(),
		touchRect: rect(),
		mode: 0,
		phase: 0,
		isRight: false,
		isForward: false,
		srcNum: 0,
		forVel: 0,
		mass: 0,
		bands: 0,
		energy: 0,
	};
}

export interface cycleRec {
	holdRect: Rect;
	wholeRect: Rect;
	oldRect: Rect;
	tiedTo: Integer;
	kindIs: Integer;
	phase: Integer;
	reset: LongInt;
	position: LongInt;
	accel: Integer;
	velocity: Integer;
}

export function newCycleRec(): cycleRec {
	return { holdRect: rect(), wholeRect: rect(), oldRect: rect(), tiedTo: 0, kindIs: 0, phase: 0, reset: 0, position: 0, accel: 0, velocity: 0 };
}

/**
 * Pascal `acur`: an animated cursor resource. Its `ball` entries hold resource IDs in their high
 * words as the resource has them, until the editor replaces each with the cursor it loads.
 */
export interface acur {
	whichBall: LongInt;
	ball: (LongInt | Cursor | null)[];
}

export type acurHand = acur;

// ---------------------------------------------------------------------------------------------
// Variables

/** The Room Editor's global variables (the interface variables of E-Globals.p). */
export const G = {
	theEvent: newEventRecord() as EventRecord,
	mainWndo: null as WindowRecord | null,
	toolWndo: null as WindowRecord | null,
	mainPalette: null as Palette | null,
	screenArea: rect(),
	wholeArea: rect(),
	fullArea: rect(),
	nullRect: rect(),
	wholeRgn: null as Region | null,
	// ---b&w---
	offMaskMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offVirginMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offLoadMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offPlayerMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offMaskPort: null as GrafPort | null,
	offVirginPort: null as GrafPort | null,
	offLoadPort: null as GrafPort | null,
	offPlayerPort: null as GrafPort | null,
	offMaskBits: 0 as Ptr,
	offVirginBits: 0 as Ptr,
	offLoadBits: 0 as Ptr,
	offPlayerBits: 0 as Ptr,
	// ---color---
	/** CGrafPort records; the CGrafPtr variables point to them (`virginCPtr := @virginCPort`). */
	virginCPort: new GrafPortClass(),
	loadCPort: new GrafPortClass(),
	objectCPort: new GrafPortClass(),
	virginCPtr: null as GrafPort | null,
	loadCPtr: null as GrafPort | null,
	objectCPtr: null as GrafPort | null,
	virginCBits: 0 as Ptr,
	loadCBits: 0 as Ptr,
	objectCBits: 0 as Ptr,
	rgbBlack: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbWhite: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbLtBlue: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbRed: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbDkGray: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbYellow: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbViolet: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbBrown: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbLtBrown: { red: 0, green: 0, blue: 0 } as RGBColor,

	holdCorner: point(),
	/** array[0..4] of Pattern */
	marqueePat: pArray<Pattern>(0, 4, () => [0, 0, 0, 0, 0, 0, 0, 0]),
	theKeys: newKeyMap() as KeyMap,
	/** array[1..kCursCount] of CCrsrHandle */
	ballC: pArray<CCrsr | null>(1, kCursCount, () => null),

	marqueeIndex: 0 as Integer,
	roomAt: 0 as Integer,
	setOTools: 0 as Integer,
	oneActive: 0 as Integer,
	rightOffset: 0 as Integer,
	downOffset: 0 as Integer,
	wasDepth: 0 as Integer,
	herKeyboard: 0 as Integer,
	fileNumber: 0 as Integer,
	volumeNumber: 0 as Integer,
	editorResNum: 0 as Integer,
	leftArrow: 0 as Integer,
	rightArrow: 0 as Integer,
	deleteKey: 0 as Integer,
	controlMethod: 0 as Integer,
	leftKey: 0 as Integer,
	rightKey: 0 as Integer,
	energyKey: 0 as Integer,
	bandKey: 0 as Integer,
	iGlidersHelp: 0 as Integer,
	/** string[12] */
	leftName: '',
	rightName: '',
	energyName: '',
	bandName: '',
	/** string[32] */
	housesName: '',
	resourceName: '',
	startPt: point(),
	endPt: point(),
	handleRect: rect(),
	thisHouse: zeroOf(houseRecLayout),
	thisRoom: zeroOf(roomDataLayout),
	scrapRoom: zeroOf(roomDataLayout),
	scrapObject: zeroOf(objectDataLayout),
	selectObject: zeroOf(objectDataLayout),

	currentBall: 0 as Integer,
	ballList: null as acurHand | null,

	// flying the glider

	nCycleObs: 0 as Integer,
	/** array[1..16] of cycleRec */
	cycleObjects: pArray(1, 16, newCycleRec),

	theGlider: newGliderRec(),
	lifeNormal: false,
	currMass: 0 as Integer,
	liftAmount: 0 as Integer,
	nMortals: 0 as Integer,
	shiftAmount: 0 as Integer,
	/** array[0..27] of Rect */
	glideRct: pArray(0, 27, rect),
	/** array[0..1] of Rect */
	shadoRct: pArray(0, 1, rect),
	/** array[1..4, 0..16] of Integer */
	nextPhase: pArray(1, 4, () => pArray(0, 16, () => 0)),

	binaryFlip: 0 as Integer,
	toastRgn: null as Region | null,
	/** array[0..16] of Rect */
	eventRect: pArray(0, 16, rect),
	/** array[0..16, 0..2] of LongInt */
	eventKind: pArray(0, 16, () => pArray(0, 2, () => 0)),
	// end

	/** array[0..7] of Rect */
	tileRects: pArray(0, 7, rect),
	/** array[0..5] of Rect */
	iconRect: pArray(0, 5, rect),
	/** array[0..5] of Rect */
	selectRect: pArray(0, 5, rect),
	/** array[0..69] of Rect */
	srcRect: pArray(0, 69, rect),
	/** array[0..47] of Integer */
	toolIcnID: pArray(0, 47, () => 0),

	lightsOut: false,
	airOut: false,
	leftIsOpen: false,
	rightIsOpen: false,
	hasToast: false,
	windowOpen: false,

	editRoom: false,
	marqueeTime: false,
	soundPlaying: false,
	fileIsOpen: false,
	cantColor: false,
	sliding: false,
	soundOn: false,
	playing: false,
	pausing: false,
	inhibitSound: false,
	doneFlag: false,
	restoreColor: false,
	roomScrapDirty: false,
	objectScrapDirty: false,
	changed: false,
	inColor: false,
	cantSwitch: false,
	autoHide: false,
	inBackground: false,
	hasWNE: false,
	buttonFires: false,
	bandBorne: false,
	hasSys7: false,
	useColorCursor: false,
	lockIt: false,
};

export type GlobalsT = typeof G;
