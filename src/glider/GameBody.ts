//------------------------------------------------------
//
//			G    L    I    D    E    R
//
//
// Glider 4.05, copyright 1991, Casady & Greene, Inc.
// All code contained herein is by john calhoun
//
// This is version 4.05 compiled with THINK Pascal 3.02
//
//------------------------------------------------------

// Port of G-GameBody.p, the main program (program Glider; {$I-}).

import {
	app4Evt,
	autoKey,
	BeginUpdate,
	ChangedResource,
	ClipRect,
	ClosePort,
	CloseCPort,
	CopyBits,
	diskEvt,
	DisposePalette,
	DisposeRgn,
	DisposeWindow,
	DisposPtr,
	EndUpdate,
	eventWindow,
	everyEvent,
	fLckdErr,
	FrontWindow,
	type GDevice,
	Get1Resource,
	GetMainDevice,
	GetNextEvent,
	GetSoundVol,
	type Handle,
	HLock,
	HUnlock,
	InitCursor,
	keyDown,
	mouseDown,
	NewHandle,
	noErr,
	ReleaseResource,
	ResError,
	SetDepth,
	SetSoundVol,
	SMSExit,
	srcCopy,
	SystemTask,
	UnloadSeg,
	updateEvt,
	UseResFile,
	vLckdErr,
	WaitNextEvent,
	wPrErr,
	WriteResource,
} from '../mac/Toolbox.ts';
import { PBoolean, PInteger, PRecord, PString, readLayout, writeLayout } from '../mac/PascalLayout.ts';
import { DemoVersion, G, helpScreensMode, highScoreMode, kErrLoadingRes, kErrMemLow, kErrSavingPrefs, kSleep } from './Globals.ts';
import { DrawHiScores, GenericAlert, RedrawWindowFrame, ShowMenuBar, SpinBall } from './GlobalUtils.ts';
import { DisplayAHelpScreen, DoIdle, DropIdle, InitIdle } from './IdleUtils.ts';
import { Coordinate } from './PlayActive.ts';
import { DoDiskEvent, DoKeyDown, DoMouseDown, DoOSEvent } from './IdleInput.ts';
import { DoStartUp, InitializeAll } from './Initialize.ts';

let eventHappened = false;

//=================================

async function SavePrefs(): Promise<void> {
	// type prefType = record … end; (the 'Gprf' resource)
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

	UseResFile(G.gliderResNum);

	theirPrefs = NewHandle(170); // SIZEOF(prefType)
	if (theirPrefs === null) {
		await GenericAlert(kErrMemLow);
		return;
	}

	theirPrefs = Get1Resource('Gprf', 128);
	if (ResError() === noErr && theirPrefs !== null) {
		HLock(theirPrefs);
		{
			// with theirPrefs^^ do: the record is read, changed, and written back to the resource's bytes.
			const prefs = readLayout(prefType, theirPrefs.data, 0);
			prefs.houseName = G.defaultHouse;
			prefs.theName = G.playerName;
			prefs.resName = G.resourceName;
			prefs.sndVolume = GetSoundVol();
			prefs.controlIs = G.controlMethod;
			prefs.leftIs = G.leftKey;
			prefs.rightIs = G.rightKey;
			prefs.energyIs = G.energyKey;
			prefs.bandIs = G.bandKey;
			prefs.musicIs = G.musicOn;
			prefs.channel4Is = G.is4Channel; // presently un-used
			prefs.airVisIs = G.airVisible;
			prefs.buttonIs = G.buttonFires;
			prefs.restoreIs = G.restoreColor;
			prefs.leftNameIs = G.leftName;
			prefs.rightNameIs = G.rightName;
			prefs.energyNameIs = G.energyName;
			prefs.bandNameIs = G.bandName;
			prefs.keyBoardIs = G.herKeyBoard;
			writeLayout(prefType, prefs, theirPrefs.data, 0);
		}
	} else {
		await GenericAlert(kErrLoadingRes);
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
}

//=================================

async function DoUpdate(): Promise<void> {
	const whichWindow = eventWindow(G.theEvent.message);
	if (whichWindow === G.mainWndo && G.mainWndo !== null) {
		const mainWndo = G.mainWndo;
		BeginUpdate(mainWndo);
		await RedrawWindowFrame();
		if (G.demoMode === highScoreMode && !G.playing) {
			DrawHiScores();
		} else if (G.demoMode === helpScreensMode) {
			await DisplayAHelpScreen();
		} else {
			if (G.inColor) {
				CopyBits(G.virginCPtr!.portPixMap, mainWndo.portBits, G.wholeArea, G.wholeArea, srcCopy, mainWndo.visRgn);
			} else {
				CopyBits(G.offVirginMap, mainWndo.portBits, G.wholeArea, G.wholeArea, srcCopy, mainWndo.visRgn);
			}
		}
		EndUpdate(mainWndo);
		ClipRect(G.wholeArea);
	}
}

//=================================

async function CloseUpShop(): Promise<void> {
	const Color = 1;
	const GDTypeFlag = 1;

	let theDevice: GDevice | null;

	//-----------

	// SetDepth: Glider declares the trap inline here; it is the Toolbox's (Devices.ts).

	//-----------

	DropIdle();
	ShowMenuBar();
	SpinBall();

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

	SpinBall();
	if (G.smsIsActive) {
		SMSExit();
	}
	G.smsIsActive = false;

	SpinBall();
	if (G.wholeRgn !== null) {
		HUnlock(G.wholeRgn);
		DisposeRgn(G.wholeRgn);
	}

	SpinBall();
	if (G.inColor) {
		if (G.mainPalette !== null) {
			DisposePalette(G.mainPalette);
		}
		if (G.mainWndo !== null) {
			DisposeWindow(G.mainWndo);
		}
		CloseCPort(G.objectCPtr!);
		DisposPtr(G.objectCBits);
		CloseCPort(G.virginCPtr!);
		DisposPtr(G.virginCBits);
		CloseCPort(G.loadCPtr!);
		DisposPtr(G.loadCBits);
		CloseCPort(G.reserveCPtr!);
		DisposPtr(G.reserveCBits);
	} else {
		if (G.mainWndo !== null) {
			DisposeWindow(G.mainWndo);
		}
		// Port: the ports are JavaScript objects; DisposPtr(Ptr(port)) has nothing to free.
		ClosePort(G.offVirginPort!);
		ClosePort(G.offPlayerPort!);
		ClosePort(G.offLoadPort!);
		ClosePort(G.offMaskPort!);
		ClosePort(G.offReservePort!);
	}
	SpinBall();

	await SavePrefs();
	SpinBall();

	SetSoundVol(G.wasSndVolume);

	if (!G.cantColor && G.restoreColor && !G.cantSwitch) {
		theDevice = GetMainDevice();
		if (theDevice !== null) {
			HLock(theDevice);
			if (theDevice.gdPMap.pixelSize !== G.wasDepth) {
				G.theErr = SetDepth(theDevice, G.wasDepth, GDTypeFlag, Color);
			}
			HUnlock(theDevice);
		}
	}
}

//=================================

/** The main program. ExitToShell ends it by throwing ExitToShellSignal, which the platform catches. */
export async function main(): Promise<void> {
	await InitializeAll();
	InitCursor();
	InitIdle();
	if (!DemoVersion) {
		await DoStartUp();
	}
	UnloadSeg(InitializeAll);
	UnloadSeg(DoStartUp);

	do {
		if (G.hasWNE) {
			eventHappened = await WaitNextEvent(everyEvent, G.theEvent, kSleep, null);
		} else {
			SystemTask();
			eventHappened = await GetNextEvent(everyEvent, G.theEvent);
		}
		if (eventHappened) {
			switch (G.theEvent.what) {
				case mouseDown:
					await DoMouseDown();
					break;
				case keyDown:
				case autoKey:
					await DoKeyDown();
					break;
				case updateEvt:
					await DoUpdate();
					break;
				case diskEvt: // call DIBadMount in response to a diskEvt
					DoDiskEvent();
					break;
				case app4Evt:
					DoOSEvent();
					break;
				default:
			} // case
		}

		if (!G.pausing) {
			if (G.playing) {
				await Coordinate();
			} else if (!G.inBackground && G.mainWndo === FrontWindow()) {
				await DoIdle();
			}
		}
	} while (!G.doneFlag); // End of the event loop

	await CloseUpShop(); // Dispose of all data structures, etc....
} // Finis
