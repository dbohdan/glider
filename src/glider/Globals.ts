// Port of G-Globals.p: Glider's constants, types, and global variables.
//
// The constants keep their names. The record types become TypeScript types with a function that
// makes a zeroed record; the ones Glider reads and writes as bytes (houseRec) have a layout too.
// The variables live in the object G, created zeroed as the Segment Loader leaves the application
// globals (Pascal `roomAt` is `G.roomAt`).

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
	type OSErr,
	type Palette,
	type Ptr,
	type Rect,
	type Region,
	type RGBColor,
	type WindowRecord,
	GrafPort as GrafPortClass,
	pArray,
} from '../mac/Toolbox.ts';
import { PArray, PBoolean, PInteger, PLongInt, PRecord, PRect, PString, type ValueOf, zeroOf } from '../mac/PascalLayout.ts';

/** THINK Pascal's compile-time flag for the demo version (`{$IFC DemoVersion}`): this is the full game. */
export const DemoVersion = false;

export const kGlideVersion = 0x0100; // version of house format

export const kStackSize = 24576; // must be even - stack size
export const kSleep = 1; // sleep time in Ticks
export const kSuspendResumeBit = 0x0001; // for WNE
export const kResuming = 1; // for WNE
export const kSecondaryAddr = 0x3f2700; // address of alternate page buffer
export const kSlowScoreIncrement = 17; // fast machine extend score-odometer
export const kFastScoreIncrement = 37; // slow machine race score-odometer
export const kMouseSlop = 1; // who knows
export const kMinBassLoop = 14; // quickest pace of duh-dum
export const kBassFract = 8; // smaller = slower bass @ 1st / larger = quicker
export const kBonusTimeToBeat = 256; // number of passes for time bonus
export const kCeilingVert = 24; // absolute ceiling in pixels
export const kFloorVert = 325; // absolute floor in pixels
export const kFloorLimit = kFloorVert + 5;
export const kMaxThrust = 5; // maximum speed (in pixels) of glider
export const kLastHelpScreen = 7; // number of help screens
export const kCursCount = 12; // number of frames for animated cursor

export const rAcurID = 128; // resource ID numbers
export const rMainWndoID = 128;
export const rAlertID = 128;
export const rFileAlertID = 129;
export const rSoundDlgID = 131;
export const rQuitNoSaveAlertID = 132;
export const rDepthAlertID = 136;
export const rCustomKeysID = 137;
export const rCustGetID = 256;
export const rAlertStrIDs = 128;
export const rFileStrIDs = 129;
export const rMiscStrID = 130;
export const rDemoStrIDs = 131;
export const rObjectPictID = 128;
export const rMaskPictID = 129;
export const rFarmPict = 130;
export const rSidePict1 = 140;
export const rSidePict2 = 141;
export const rIdleID = 200;
export const rColorIdleID = 210;
export const rHelpBasePictID = 1000;

export const kDefaultLeftKey = 0x2b; // default control keys
export const kDefaultRightKey = 0x2f;
export const kDefaultEnergyKey = 0x24;
export const kDefaultBandKey = 0x31;
export const kDefaultLeftName = ', key'; // default names for control keys
export const kDefaultRightName = '. key';
export const kDefaultEnergyName = 'return';
export const kDefaultBandName = 'space';
export const kTabKey = 0x09; // misc. ascii codes
export const kReturnKey = 0x0d;
export const kSpaceBar = 0x20;
export const kSKeyMap = 0x01; // misc. keymap codes
export const kQKeyMap = 0x0c;
export const kEKeyMap = 0x0e;
export const kReturnKeyMap = 0x24;
export const kTabKeyMap = 0x30;
export const kControlKeyMap = 0x3b;
export const kCommandKeyMap = 0x37;
export const kShiftKey = 0x38;

export const kErrUnaccounted = 1; // error codes
export const kErrMacPlusNeeded = 2; // these correspond with STR#
export const kErr2Or16Colors = 4; // resources for the TEXT part
export const kErrNotEnoughMem = 5; // of the message
export const kErrUnknownAtInit = 6;
export const kErrMemLow = 7;
export const kErrGraphicsNotFound = 8;
export const kErrGraphicLoad = 9;
export const kErrSavingPrefs = 10;
export const kErrAirChange = 11;
export const kErrLoadingRes = 12;
export const kErrFileExists = 13;
export const kErrNothingToPrint = 14;
export const kErrWrongHouseVers = 15;
export const kErrLoadingDfltHouse = 16;
export const kErrLoadingPrefs = 17;
export const kErrNotDemoHouse = 18;
export const kErrExitSansGraphics = 19;
export const kErrGraphicsAre2Bit = 20;
export const kErrGraphicsAre16Bit = 21;
export const kErrGameOldVers = 22;
export const kErrExitSansHouse = 23;
export const kErrHouseModified = 24;
export const kErrBackgroundMusic = 25;
export const kErrDepthSwitched = 26;
export const kErrStartUpWrongType = 27;
export const kErrNoSounds = 28;
export const kErrVolLocked = 29;
export const kErrMissionINIT = 30;
export const kErrNotFirstHouse = 31;
export const kErrDemoRefuseHouse = 32;
export const kErrNewKeyboard = 33;

export const kHouseType = 0;
export const kArtType = 1;
export const kGameType = 2;

export const nulObj = 0; // room object codes
// furniture
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

export const normal = 0; // glider situational modes
export const fadingIn = 1;
export const fadingOut = 2;
export const turnRt2Lf = 3;
export const turnLf2Rt = 4;
export const burning = 5;
export const ascending = 6;
export const descending = 7;
export const shredding = 8;
// objects effects codes
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
export const weightIt = 20; // ?
export const spillIt = 21; // grease standing up
export const ascendIt = 22; // up stair case
export const descendIt = 23; // down stair case
export const steamIt = 24;

export const highScoreMode = 0; // demo mode numbers
export const balloonMode = 1;
export const copterMode = 2;
export const dartMode = 3;
export const controlMode = 4;
export const tabMode = 5;
export const adMode = 6;
export const editorMode = 7;
export const colorMusicMode = 8;
export const ventCandleMode = 9;
export const bandBatteryMode = 10;
export const paperClockMode = 11;
export const lastDemo = 11;
export const helpScreensMode = 99;

export const iNothing = 0;
export const mApple = 128; // Menu resource ID
export const iAbout = 1; // Menu items

export const mGame = 129; // Menu resource ID
export const iBegin = 1; // Menu items…
export const iLoadHouse = 2;
export const iEndGame = 3;
export const iLoadGame = 5;
export const iSaveGame = 6;
export const iSaveGameAs = 7;
export const iQuit = 9;

export const mOption = 130; // Menu resource ID
export const iControls = 1; // Menu items…
// Port: `let`, not `const`: the port's additions (Additions.ts, PORT.md decision 14) insert their
// submenus after Controls, which moves the items after it (moveOptionItems).
export let iSound = 2;
export let iShowAir = 3;
export let iRestoreDeep = 4;
export let iHiScores = 6;
export let iHelp = 8;

/** Port: moves the Options menu's items after Controls down by `by`, for the additions' submenus. */
export function moveOptionItems(by: number): void {
	iSound += by;
	iShowAir += by;
	iRestoreDeep += by;
	iHiScores += by;
	iHelp += by;
}

export const mControls = 131; // Menu resource ID
export const iHoldKeyboard = 1; // Menu items…
export const iDropKeyboard = 2;
export const iAbsMouse = 3;
export const iRelMouse = 4;
// Port: `let`, not `const`: the port's additions insert Gamepad and Virtual Gamepad after Joystick,
// which moves Configure down (addControlItems).
export let iConfigure = 6;
/** Port: the last control method's item: Joystick, or with the additions, Virtual Gamepad. */
export let iLastControl = iRelMouse;
/** Port: the additions' control methods (Additions.ts), items after Joystick. */
export const iGamepad = 5;
export const iVirtualPad = 6;

/** Port: makes room in the Controls submenu for the additions' control methods. */
export function addControlItems(by: number): void {
	iLastControl += by;
	iConfigure += by;
}

export const whoCares = 0; // place where entered room
export const topOfRoom = 1;
export const bottomOfRoom = 2;
export const leftOfRoom = 3;
export const rightOfRoom = 4;

export const kWhistleSound = 13;
export const kTapSound = 27;
export const kCRSound = 28;
export const kMusicSound = 29; // ID of music sound
export const kDuhDumSound = 30; // ID of bass beat

// ---------------------------------------------------------------------------------------------
// Types

const rect = (): Rect => ({ top: 0, left: 0, bottom: 0, right: 0 });

/** The records of a house file, as THINK Pascal lays them out (houseRec is 13830 bytes). */
export const objectDataLayout = PRecord({ objectIs: PInteger, boundRect: PRect, amount: PInteger, extra: PInteger, isOn: PBoolean });
export const roomDataLayout = PRecord({
	roomName: PString(24),
	numberOObjects: PInteger,
	backPictID: PInteger,
	tileOrder: PArray(0, 7, PInteger),
	leftOpen: PBoolean,
	rightOpen: PBoolean,
	animateKind: PInteger,
	animateNumber: PInteger,
	animateDelay: PLongInt,
	conditionCode: PInteger,
	theObjects: PArray(1, 16, objectDataLayout),
});
export const houseRecLayout = PRecord({
	version: PInteger,
	numberORooms: PInteger,
	timeStamp: PLongInt,
	hiScores: PArray(0, 19, PLongInt),
	hiLevel: PArray(0, 19, PInteger),
	hiName: PArray(0, 19, PString(24)),
	hiRoom: PArray(0, 19, PString(24)),
	pictFile: PString(32),
	nextFile: PString(32),
	firstFile: PString(32),
	theRooms: PArray(1, 40, roomDataLayout),
});

export type objectData = ValueOf<typeof objectDataLayout>;
export type roomData = ValueOf<typeof roomDataLayout>;
export type houseRec = ValueOf<typeof houseRecLayout>;

export interface gliderRec {
	destRect: Rect;
	oldRect: Rect;
	wholeRect: Rect;
	shadoDest: Rect;
	oldShado: Rect;
	wholeShado: Rect;
	touchRect: Rect;
	timeStamp: LongInt;
	mode: Integer;
	phase: Integer;
	srcNum: Integer;
	forVel: Integer;
	mass: Integer;
	bands: Integer;
	energy: Integer;
	isRight: boolean;
	isForward: boolean;
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
		timeStamp: 0,
		mode: 0,
		phase: 0,
		srcNum: 0,
		forVel: 0,
		mass: 0,
		bands: 0,
		energy: 0,
		isRight: false,
		isForward: false,
	};
}

export interface animateRec {
	destRect: Rect;
	wholeRect: Rect;
	oldRect: Rect;
	horiOff: Integer;
	vertOff: Integer;
	kind: Integer;
	phase: Integer;
	tickStamp: LongInt;
	delay: LongInt;
	unSeen: boolean;
}

export function newAnimateRec(): animateRec {
	return { destRect: rect(), wholeRect: rect(), oldRect: rect(), horiOff: 0, vertOff: 0, kind: 0, phase: 0, tickStamp: 0, delay: 0, unSeen: false };
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

export interface bandRec {
	dest: Rect;
	whole: Rect;
	old: Rect;
	phase: Integer;
	velocity: Integer;
}

export function newBandRec(): bandRec {
	return { dest: rect(), whole: rect(), old: rect(), phase: 0, velocity: 0 };
}

export interface scoreRec {
	rank: Integer;
	changed: boolean;
}

export interface pointRec {
	whereR: Rect;
	tickStamp: LongInt;
	/** string[16] */
	saysWhat: string;
	out: boolean;
}

export interface lightningRec {
	/** array[1..3, 0..7, 0..1] of Integer */
	theBolts: Integer[][][];
	whichBolt: Integer;
	whatPhase: Integer;
	whatTime: LongInt;
}

/**
 * Pascal `acur`: an animated cursor resource. Its `ball` entries hold resource IDs in their high
 * words as the resource has them, until Glider replaces each with the cursor it loads.
 */
export interface acur {
	whichBall: LongInt;
	ball: (LongInt | Cursor | null)[];
}

export type acurHand = acur;

// ---------------------------------------------------------------------------------------------
// Variables

/** Glider's global variables (the interface variables of G-Globals.p). */
export const G = {
	theEvent: newEventRecord() as EventRecord,

	mainWndo: null as WindowRecord | null,
	mainPalette: null as Palette | null,
	wholeArea: rect(),
	fullArea: rect(),
	nullRect: rect(),
	smScoreRect: rect(),
	lgScoreRect: rect(),
	wholeRgn: null as Region | null,
	offMaskMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offVirginMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offLoadMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offPlayerMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offReserveMap: { baseAddr: 0, rowBytes: 0, bounds: rect() } as BitMap,
	offMaskPort: null as GrafPort | null,
	offVirginPort: null as GrafPort | null,
	offLoadPort: null as GrafPort | null,
	offPlayerPort: null as GrafPort | null,
	offReservePort: null as GrafPort | null,
	offMaskBits: 0 as Ptr,
	offVirginBits: 0 as Ptr,
	offLoadBits: 0 as Ptr,
	offPlayerBits: 0 as Ptr,
	offReserveBits: 0 as Ptr,
	/** CGrafPort records; the CGrafPtr variables point to them (`virginCPtr := @virginCPort`). */
	virginCPort: new GrafPortClass(),
	loadCPort: new GrafPortClass(),
	objectCPort: new GrafPortClass(),
	reserveCPort: new GrafPortClass(),
	virginCPtr: null as GrafPort | null,
	loadCPtr: null as GrafPort | null,
	objectCPtr: null as GrafPort | null,
	reserveCPtr: null as GrafPort | null,
	virginCBits: 0 as Ptr,
	loadCBits: 0 as Ptr,
	objectCBits: 0 as Ptr,
	reserveCBits: 0 as Ptr,
	rgbBlack: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbWhite: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbLtBlue: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbRed: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbBlue: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbLtGreen: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbYellow: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbViolet: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbBrown: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbLtBrown: { red: 0, green: 0, blue: 0 } as RGBColor,
	rgbDkGray: { red: 0, green: 0, blue: 0 } as RGBColor,
	noCursor: null as Cursor | null,

	thisHouse: zeroOf(houseRecLayout),
	theKeys: newKeyMap() as KeyMap,
	theErr: 0 as OSErr,

	currentBall: 0 as Integer,
	ballList: null as acurHand | null,
	/** array[1..kCursCount] of CCrsrHandle */
	ballC: pArray<CCrsr | null>(1, kCursCount, () => null),

	/** array[1..16] of animateRec */
	theAnimates: pArray(1, 16, newAnimateRec),
	/** array[0..2, -1..16] of Rect */
	animateRct: pArray(0, 2, () => pArray(-1, 16, rect)),
	/** array[1..16] of cycleRec */
	cycleObjects: pArray(1, 16, newCycleRec),

	floatPoints: { whereR: rect(), tickStamp: 0, saysWhat: '', out: false } as pointRec,

	theGlider: newGliderRec(),
	/** array[1..40] of Boolean */
	roomVisits: pArray(1, 40, () => false),
	/** array[0..27] of Rect */
	glideRct: pArray(0, 27, rect),
	/** array[0..1] of Rect */
	shadoRct: pArray(0, 1, rect),
	/** array[1..4, 0..16] of Integer */
	nextPhase: pArray(1, 4, () => pArray(0, 16, () => 0)),

	theBand: newBandRec(),
	/** array[0..2] of Rect */
	bandRct: pArray(0, 2, rect),

	roomScore: 0 as LongInt,
	suppScore: 0 as LongInt,
	rollScore: 0 as LongInt,
	loopsThruRoom: 0 as LongInt,
	workingGameNumber: 0 as LongInt,
	scoreList: { rank: 0, changed: false } as scoreRec,

	rightOffset: 0 as Integer,
	downOffset: 0 as Integer,
	gliderResNum: 0 as Integer,
	wasSndVolume: 0 as Integer,
	controlMethod: 0 as Integer,
	demoMode: 0 as Integer,
	demoCount: 0 as Integer,
	wasDepth: 0 as Integer,
	liftAmount: 0 as Integer,
	mortals: 0 as Integer,
	shiftAmount: 0 as Integer,
	sideYouCantExit: 0 as Integer,
	leftKey: 0 as Integer,
	rightKey: 0 as Integer,
	energyKey: 0 as Integer,
	bandKey: 0 as Integer,
	scoreIncrement: 0 as Integer,
	roomAt: 0 as Integer,
	roomsPassed: 0 as Integer,
	nObjects: 0 as Integer,
	binaryFlip: 0 as Integer,
	gameNumber: 0 as Integer,
	houseNumber: 0 as Integer,
	wasMBarHeight: 0 as Integer,
	houseVolNum: 0 as Integer,
	gameVolNum: 0 as Integer,
	resVolNum: 0 as Integer,
	bassLoop: 0 as Integer,
	playBassTime: 0 as Integer,
	nAnimates: 0 as Integer,
	nCycleObs: 0 as Integer,
	herKeyBoard: 0 as Integer,
	iGlidersHelp: 0 as Integer,

	/** string[12] */
	leftName: '',
	rightName: '',
	energyName: '',
	bandName: '',
	/** string[24] */
	playerName: '',
	/** string[32] */
	musicName: '',
	gameName: '',
	resourceName: '',
	firstFileName: '',
	defaultHouse: '',
	housesName: '',
	mirrorRgn: null as Region | null,
	windowRgn: null as Region | null,
	toastRgn: null as Region | null,
	theLightning: { theBolts: pArray(1, 3, () => pArray(0, 7, () => pArray(0, 1, () => 0))), whichBolt: 0, whatPhase: 0, whatTime: 0 } as lightningRec,

	/** array[0..7] of Rect */
	tileRects: pArray(0, 7, rect),
	/** array[0..69] of Rect */
	srcRect: pArray(0, 69, rect),
	/** array[0..16] of Rect */
	eventRect: pArray(0, 16, rect),
	reserveRects: pArray(0, 16, rect),
	/** array[0..16, 0..2] of LongInt */
	eventKind: pArray(0, 16, () => pArray(0, 2, () => 0)),

	windowOpen: false,
	hasWindow: false,
	leftIsOpen: false,
	rightIsOpen: false,
	enteredLeft: false,
	cantSwitch: false,
	airVisible: false,
	hasMirror: false,
	hasToast: false,
	lightsOut: false,
	airOut: false,
	bandBorne: false,
	cantColor: false,
	soundOn: false,
	musicOn: false,
	inhibitSound: false,
	hasSys7: false,
	buttonFires: false,
	cantMusic: false,
	smsIsActive: false,
	doneFlag: false,
	inColor: false,
	inBackground: false,
	playing: false,
	pausing: false,
	hasWNE: false,
	restoreColor: false,
	refuseHigh: false,
	scoreIsRolling: false,
	lifeNormal: false,
	didntExitEntrance: false,
	areFlipping: false,
	mainScreenHidden: false,
	fileWasLost: false,
	is4Channel: false,
	useColorCursor: false,
};

export type GlobalsT = typeof G;

/**
 * Port: whether the platform should capture the pointer. A game played with a mouse control (Mouse
 * or Joystick) moves the mouse itself every frame (HorizonMouse, CenterMouse); a browser cannot
 * move its pointer, but a captured one reports its movements, which then move the Mac's mouse.
 */
export function wantsMouseCapture(): boolean {
	return G.playing && !G.pausing && (G.controlMethod === iAbsMouse || G.controlMethod === iRelMouse);
}
