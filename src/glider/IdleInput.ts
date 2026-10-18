// Port of G-IdleInput.p: starting, loading, and resuming games, and the menus, mouse, keys, and
// operating system events between games.

import {
	BitAnd,
	BSR,
	charCodeMask,
	CheckItem,
	Chr,
	ClipRect,
	CopyBits,
	DIBadMount,
	DisableItem,
	div,
	DrawMenuBar,
	EnableItem,
	type EventRecord,
	everyEvent,
	FillRect,
	FindWindow,
	FlushEvents,
	GetDateTime,
	GetItem,
	GetKeys,
	GetMenu,
	GetPort,
	HiliteMenu,
	HiWord,
	inMenuBar,
	inSysWindow,
	type Integer,
	LoWord,
	type LongInt,
	MenuKey,
	MenuSelect,
	noErr,
	Odd,
	OpenDeskAcc,
	patOr,
	PenNormal,
	type Point,
	type Rect,
	ref,
	screenBits,
	SetCursor,
	SetItem,
	SetPort,
	SetPt,
	SetRect,
	SMSExit,
	SMSInit,
	SMSSetMode,
	srcCopy,
	TextFont,
	TextMode,
	TextSize,
	black,
	cmdKey,
	type WindowPtr,
	Yield,
} from '../mac/Toolbox.ts';
import {
	DemoVersion,
	G,
	helpScreensMode,
	highScoreMode,
	iAbout,
	iBegin,
	iConfigure,
	iControls,
	iEndGame,
	iHelp,
	iHiScores,
	iHoldKeyboard,
	iLoadGame,
	iLoadHouse,
	iNothing,
	iQuit,
	iRelMouse,
	iRestoreDeep,
	iSaveGame,
	iSaveGameAs,
	iShowAir,
	iSound,
	kBassFract,
	kBonusTimeToBeat,
	kErrAirChange,
	kErrExitSansHouse,
	kErrNotDemoHouse,
	kErrNotFirstHouse,
	kGameType,
	kHouseType,
	kMinBassLoop,
	kResuming,
	kReturnKey,
	kSpaceBar,
	kSuspendResumeBit,
	kTabKey,
	kTabKeyMap,
	lastDemo,
	mApple,
	mControls,
	mGame,
	mOption,
	whoCares,
} from './Globals.ts';
import { DissBlocks, DrawHiScores, GenericAlert, HideMenuBar, Randomize, ShowMenuBar } from './GlobalUtils.ts';
import { DoClose, DoOpen, GetHouse, OpenHouse, ReadGame, SaveGame, SaveGameAs, WriteHouse } from './FileInNOut.ts';
import { CloseHelpScreens, CloseHiScores, DoAbout, DoCustomizeKeys, DoSoundSettings, IdleUtils, NewMode, NextPageHelpScreens, OpenHelpScreens } from './IdleUtils.ts';
import { DoQuit, ReadyRoom, ResetGlider } from './PlayUtils.ts';
import { WrapItUp } from './PlaySetUp.ts';

/** Port: Balloons.p's kHMHelpMenuID, the System 7 Help menu's ID. */
const kHMHelpMenuID = -16490;

/** Port: THINK Pascal's `HiWrd`, the high word of a long integer. */
const HiWrd = HiWord;

/** Port: Pascal `SystemClick` passes a click to a desk accessory; the port has none. */
function SystemClick(_theEvent: EventRecord, _theWindow: WindowPtr | null): void {}

// =================================

export async function StartNewGame(): Promise<void> {
	let i: Integer;
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };
	/** string[32] */
	let firstIs: string;

	if (!G.smsIsActive) {
		SMSInit();
	}
	G.smsIsActive = true;
	if (G.is4Channel) {
		SMSSetMode(4);
	} else {
		SMSSetMode(2);
	}

	if (!(await GetHouse())) {
		return;
	}

	firstIs = G.thisHouse.firstFile;
	if (firstIs !== G.housesName && firstIs !== '' && firstIs !== 'nil') {
		await GenericAlert(kErrNotFirstHouse);
		G.housesName = firstIs;
		if (!(await OpenHouse())) {
			await GenericAlert(kErrExitSansHouse);
			return;
		}
		await DoClose(G.houseVolNum);

		if (DemoVersion) {
			if (G.thisHouse.timeStamp !== 16) {
				await GenericAlert(kErrNotDemoHouse);
				return;
			}
		}

		G.thisHouse.firstFile = '';
		if (!(await WriteHouse())) {
			// (nothing)
		}
	}

	G.firstFileName = G.housesName;

	HideMenuBar();

	if (screenBits.bounds.bottom > 382) {
		SetPort(G.mainWndo!);
		PenNormal();
		ClipRect(G.fullArea);
		SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, -G.downOffset + 20);
		FillRect(tempRect, black);
		ClipRect(G.wholeArea);
	}

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	G.scoreList.changed = false;
	G.scoreList.rank = 20;

	G.roomAt = 1;
	G.roomsPassed = 1;
	G.roomScore = 0;
	G.suppScore = 0;
	G.rollScore = 0;
	G.workingGameNumber = GetDateTime();
	G.sideYouCantExit = whoCares;
	G.loopsThruRoom = 0;
	G.bassLoop = 0;
	G.playBassTime = div(kBonusTimeToBeat, kBassFract) + kMinBassLoop;

	for (i = 1; i <= 40; i++) {
		G.roomVisits[i] = false;
	}

	if (IdleUtils.ozmaFlags[3]) {
		G.mortals = 50;
		G.refuseHigh = true;
	} else {
		G.mortals = 5;
		G.refuseHigh = false;
	}

	for (i = 0; i <= 3; i++) {
		IdleUtils.ozmaFlags[i] = false;
	}

	G.enteredLeft = true;
	G.theGlider.isRight = true;
	G.theGlider.bands = 0;
	G.theGlider.forVel = 4;
	G.theGlider.energy = 0;
	ResetGlider();

	G.playing = true;
	G.pausing = false;

	G.hasMirror = false;
	G.hasWindow = false;
	G.hasToast = false;
	G.scoreIsRolling = false;
	G.floatPoints.out = false;

	await ReadyRoom();
	G.gameName = '';

	DisableItem(GetMenu(mGame)!, iLoadHouse);
	EnableItem(GetMenu(mGame)!, iEndGame);
	DisableItem(GetMenu(mGame)!, iLoadGame);
	if (!DemoVersion) {
		EnableItem(GetMenu(mGame)!, iSaveGame);
		EnableItem(GetMenu(mGame)!, iSaveGameAs);
	}
	DisableItem(GetMenu(mOption)!, iHiScores);

	SetPort(G.mainWndo!);
	PenNormal();
	TextFont(0);
	TextSize(12);
	TextMode(patOr);

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	SetCursor(G.noCursor!);
	DissBlocks();

	FlushEvents(everyEvent, 0);
}

// =================================

async function DoLoadHouse(): Promise<void> {
	if (!DemoVersion) {
		if (await DoOpen(kHouseType)) {
			G.demoMode = Randomize(lastDemo) + 1;
			HideMenuBar();

			await StartNewGame();
		}
	}
}

// =================================

async function DoEndGame(): Promise<void> {
	SetItem(GetMenu(mGame)!, iBegin, 'Begin Game…');
	await WrapItUp();
	DrawMenuBar();
}

// =================================

export async function GetGame(): Promise<boolean> {
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	if (!(await ReadGame())) {
		return false;
	}

	if (!G.smsIsActive) {
		SMSInit();
	}
	G.smsIsActive = true;
	if (G.is4Channel) {
		SMSSetMode(4);
	} else {
		SMSSetMode(2);
	}

	G.demoMode = Randomize(lastDemo) + 1;
	HideMenuBar();

	if (screenBits.bounds.bottom > 382) {
		SetPort(G.mainWndo!);
		PenNormal();
		ClipRect(G.fullArea);
		SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, -G.downOffset + 20);
		FillRect(tempRect, black);
		ClipRect(G.wholeArea);
	}
	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	ResetGlider();
	G.playing = true;
	G.pausing = false;

	G.hasMirror = false;
	G.hasWindow = false;
	G.hasToast = false;
	G.scoreIsRolling = false;
	G.refuseHigh = true;
	G.floatPoints.out = false;
	G.sideYouCantExit = whoCares;

	G.loopsThruRoom = 0;
	G.bassLoop = 0;
	G.playBassTime = div(kBonusTimeToBeat, kBassFract) + kMinBassLoop;

	await ReadyRoom();

	DisableItem(GetMenu(mGame)!, iLoadHouse);
	EnableItem(GetMenu(mGame)!, iEndGame);
	DisableItem(GetMenu(mGame)!, iLoadGame);
	EnableItem(GetMenu(mGame)!, iSaveGame);
	EnableItem(GetMenu(mGame)!, iSaveGameAs);
	DisableItem(GetMenu(mOption)!, iHiScores);

	SetPort(G.mainWndo!);
	PenNormal();
	TextFont(0);
	TextSize(12);
	TextMode(patOr);

	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}

	SetCursor(G.noCursor!);
	DissBlocks();

	FlushEvents(everyEvent, 0);

	return true;
}

// =================================

function ResumeGame(): void {
	const tempRect: Rect = { top: 0, left: 0, bottom: 0, right: 0 };

	if (!G.smsIsActive) {
		SMSInit();
	}
	G.smsIsActive = true;
	if (G.is4Channel) {
		SMSSetMode(4);
	} else {
		SMSSetMode(2);
	}

	HideMenuBar();

	SetItem(GetMenu(mGame)!, iBegin, 'Begin Game…');
	SetCursor(G.noCursor!);
	G.pausing = false;
	if (screenBits.bounds.bottom < 382) {
		SetPort(G.mainWndo!);
		SetRect(tempRect, 0, 0, 512, 20);
		if (G.inColor) {
			CopyBits(G.virginCPtr!.portPixMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, null);
		} else {
			CopyBits(G.offVirginMap, G.mainWndo!.portBits, tempRect, tempRect, srcCopy, null);
		}
	} else {
		SetPort(G.mainWndo!);
		PenNormal();
		ClipRect(G.fullArea);
		SetRect(tempRect, -G.rightOffset, -G.downOffset, 512 + 2 * G.rightOffset, -G.downOffset + 20);
		FillRect(tempRect, black);
		ClipRect(G.wholeArea);
	}
	if (G.inColor) {
		SetPort(G.virginCPtr!);
	} else {
		SetPort(G.offVirginPort!);
	}
}

// =================================

export async function HandleMenu(theMenu: Integer, theItem: Integer): Promise<void> {
	// Handle menu selections realtime
	let DNA: Integer;
	let i: Integer;
	let DAName: string;

	switch (theMenu) {
		case mApple:
			switch (theItem) {
				case iNothing:
					break;
				case iAbout:
					await DoAbout();
					break;
				default: {
					const SavePort = GetPort();
					DAName = GetItem(GetMenu(mApple)!, theItem);
					DNA = OpenDeskAcc(DAName);
					SetPort(SavePort);
				}
			}
			break;

		case mGame:
			switch (theItem) {
				case iBegin: {
					G.demoMode = Randomize(lastDemo) + 1;
					if (G.pausing && G.playing) {
						ResumeGame();
					} else {
						await StartNewGame();
					}
					break;
				}
				case iLoadHouse:
					await DoLoadHouse();
					break;

				case iEndGame:
					await DoEndGame();
					break;

				case iLoadGame: {
					if (!DemoVersion) {
						if (await DoOpen(kGameType)) {
							if (!(await GetGame())) {
								// (nothing)
							}
						}
					}
					break;
				}

				case iSaveGame: {
					if (!DemoVersion) {
						if (!(await SaveGame())) {
							// (nothing)
						}
					}
					break;
				}

				case iSaveGameAs: {
					if (!DemoVersion) {
						if (!(await SaveGameAs())) {
							// (nothing)
						}
					}
					break;
				}

				case iQuit: {
					if (DemoVersion) {
						G.playing = false;
						G.pausing = false;
						G.doneFlag = true;
					} else {
						if (await DoQuit()) {
							G.playing = false;
							G.pausing = false;
							G.doneFlag = true;
						} else if (await SaveGame()) {
							G.playing = false;
							G.pausing = false;
							G.doneFlag = true;
						}
					}
					break;
				}

				default:
			}
			break;

		case mOption:
			switch (theItem) {
				case iControls:
					break;
				case iSound:
					await DoSoundSettings();
					break;
				case iShowAir: {
					G.airVisible = !G.airVisible;
					if (G.airVisible) {
						SetItem(GetMenu(mOption)!, iShowAir, 'Air is Visible');
					} else {
						SetItem(GetMenu(mOption)!, iShowAir, 'Air is Invisible');
					}
					if (G.playing) {
						await GenericAlert(kErrAirChange);
					}
					break;
				}
				case iRestoreDeep: {
					G.restoreColor = !G.restoreColor;
					if (G.restoreColor) {
						SetItem(GetMenu(mOption)!, iRestoreDeep, 'Depth Restore is On');
					} else {
						SetItem(GetMenu(mOption)!, iRestoreDeep, 'Depth Restore is Off');
					}
					break;
				}
				case iHiScores:
					DrawHiScores();
					break;
				case iHelp:
					await OpenHelpScreens();
					break;
				default:
			}
			break;

		case mControls:
			if (theItem >= iHoldKeyboard && theItem <= iRelMouse) {
				for (i = iHoldKeyboard; i <= iRelMouse; i++) {
					CheckItem(GetMenu(mControls)!, i, false);
				}
				CheckItem(GetMenu(mControls)!, theItem, true);
				G.controlMethod = theItem;
			} else if (theItem === iConfigure) {
				await DoCustomizeKeys();
			}
			break;

		case kHMHelpMenuID:
			if (theItem === G.iGlidersHelp) {
				await OpenHelpScreens();
			}
			break;

		default:
	}

	HiliteMenu(0);
	void DNA!;
}

// =================================

export async function DoMouseDown(): Promise<void> {
	const whichWindow = ref<WindowPtr | null>(null);
	let theMenu: Integer;
	let theItem: Integer;
	let mResult: LongInt;

	const code = FindWindow(G.theEvent.where, whichWindow);
	if (G.demoMode === highScoreMode) {
		CloseHiScores();
	} else if (G.demoMode === helpScreensMode) {
		await NextPageHelpScreens();
	} else {
		switch (code) {
			case inMenuBar: {
				mResult = await MenuSelect(G.theEvent.where);
				theMenu = HiWord(mResult);
				theItem = LoWord(mResult);
				await HandleMenu(theMenu, theItem);
				break;
			}
			case inSysWindow:
				SystemClick(G.theEvent, whichWindow.v);
				break;
			default:
		}
	}
}

// =================================

export async function DoKeyDown(): Promise<void> {
	let chCode: Integer;
	let theMenu: Integer;
	let theItem: Integer;
	let mResult: LongInt;

	const theEvent = G.theEvent;
	chCode = BitAnd(theEvent.message, charCodeMask);
	if (Odd(div(theEvent.modifiers, cmdKey))) {
		mResult = MenuKey(Chr(chCode));
		theMenu = HiWord(mResult);
		theItem = LoWord(mResult);
		if (theMenu !== 0) {
			await HandleMenu(theMenu, theItem);
		}
	} else {
		// knock through the demo messages
		if (chCode === kSpaceBar && G.demoMode !== highScoreMode) {
			if (G.demoMode === helpScreensMode) {
				await NextPageHelpScreens();
			} else {
				G.demoMode = G.demoMode + 1;
				if (G.demoMode > lastDemo) {
					G.demoMode = 1;
				}
				G.demoCount = 0;
				NewMode(false);
			}
		}

		if (chCode === kReturnKey) {
			if (G.demoMode === helpScreensMode) {
				CloseHelpScreens();
			} else if (G.demoMode === highScoreMode) {
				CloseHiScores();
			}
		}

		// return from a paused game
		if (chCode === kTabKey && G.playing && G.pausing) {
			G.demoMode = Randomize(lastDemo) + 1;
			HideMenuBar();
			ResumeGame();
			for (;;) {
				GetKeys(G.theKeys);
				if (!G.theKeys[kTabKeyMap]) {
					break; // until (not theKeys[kTabKeyMap])
				}
				await Yield();
			}
		}

		// check for secret code entered!
		if (chCode === 0x4f) {
			IdleUtils.ozmaFlags[0] = true;
		}
		if (chCode === 0x7a && IdleUtils.ozmaFlags[0]) {
			IdleUtils.ozmaFlags[1] = true;
		}
		if (chCode === 0x6d && IdleUtils.ozmaFlags[1]) {
			IdleUtils.ozmaFlags[2] = true;
		}
		if (chCode === 0x61 && IdleUtils.ozmaFlags[2]) {
			IdleUtils.ozmaFlags[3] = true;
			G.refuseHigh = true;
		}
	} // if (Odd(mod...
} // procedure

// =================================

export function DoDiskEvent(): void {
	const cornerPt: Point = { v: 0, h: 0 };

	if (HiWrd(G.theEvent.message) !== noErr) {
		SetPt(cornerPt, 85 + G.rightOffset, 50 + G.downOffset);
		G.theErr = DIBadMount(cornerPt, G.theEvent.message);
	}
}

// =================================

export function DoOSEvent(): void {
	switch (BSR(G.theEvent.message, 24)) {
		// high byte of message
		case 1: // suspendResumeMessage
			if (BitAnd(G.theEvent.message, kSuspendResumeBit) === kResuming) {
				G.inBackground = false; // it was a resume event
				if (!G.smsIsActive) {
					SMSInit();
				}
				G.smsIsActive = true;
				if (G.is4Channel) {
					SMSSetMode(4);
				} else {
					SMSSetMode(2);
				}

				// re-grow window's right edge
			} else {
				if (G.smsIsActive) {
					SMSExit();
				}
				G.smsIsActive = false;
				G.inBackground = true; // it was a suspend event
				// shrink window's right edge
				ShowMenuBar();
			}
			break;
		default:
	} // CASE
} // osEvt
