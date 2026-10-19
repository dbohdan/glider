// The Dialog Manager draws Glider's alerts and dialogs as System 6 does (the oracle's "boot",
// "bootColor", "dialogs", and "dialogsColor" cases).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { macII, macPlus, type Machine } from '../../oracle/Oracle.ts';
import { put16 } from '../../src/mac/Binary.ts';
import { Alert, type DialogRecord, DisposDialog, GetDItem, GetNewDialog, InitDialogs, type ItemHandle, ModalDialog, ParamText, SetIText } from '../../src/mac/Dialogs.ts';
import { type ControlHandle, SetCtlValue } from '../../src/mac/Controls.ts';
import { inFront, MoveWindow, SelectWindow, ShowWindow } from '../../src/mac/Windows.ts';
import { black, FillRect, FrameRoundRect, InsetRect, PenSize, PlotCIcon, PlotIcon, SetPort } from '../../src/mac/QuickDraw.ts';
import { GetCIcon, GetIcon } from '../../src/mac/ToolUtils.ts';
import { ref } from '../../src/mac/Types.ts';
import type { Handle } from '../../src/mac/Resources.ts';
import { hostKeyDown, hostKeyUp } from '../../src/mac/Events.ts';
import { screenBits } from '../../src/mac/QuickDraw.ts';
import { Get1Resource } from '../../src/mac/Resources.ts';
import { TEInit } from '../../src/mac/TextEdit.ts';
import { GetIndString, GetSoundVol, NumToString, SetSoundVol } from '../../src/mac/OSUtils.ts';
import { bootMachine, type Box, differences, oracleRunAvailable, oracleShot, writeComparison } from './machine.ts';
import type { Image } from '../../oracle/Image.ts';
import { writeFileSync } from 'node:fs';
import { writePNM } from './machine.ts';

/** Glider's GenericAlert: centers ALRT 128 horizontally and a third of the way down, and shows a message. */
async function genericAlert(whatGives: number): Promise<number> {
	const h = Get1Resource('ALRT', 128)!;
	const width = 0x1a1 - 0x5f;
	const height = 0xbd - 0x4d;
	const left = Math.trunc((screenBits.bounds.right - width) / 2);
	const top = Math.trunc((screenBits.bounds.bottom - height) / 3);
	put16(h.data, 0, top);
	put16(h.data, 2, left);
	put16(h.data, 4, top + height);
	put16(h.data, 6, left + width);
	ParamText(GetIndString(128, whatGives), '', '', '');
	return Alert(128, null);
}

for (const [m, caseName, shot] of [
	[macPlus, 'boot', 'alert'],
	[macII, 'bootColor', 't1800'],
] as [Machine, string, string][]) {
	test(`the Dialog Manager shows Glider's "New keyboard" alert as System 6 does on a ${m === macPlus ? 'Mac Plus' : 'Mac II'}`, { skip: oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"` }, async () => {
		const machine = bootMachine(m);
		TEInit();
		InitDialogs(null);
		let ours: Image | undefined;
		machine.host.at(30, () => {
			ours = machine.shot();
		});
		machine.host.at(31, () => hostKeyDown(0x24, 13));
		machine.host.at(33, () => hostKeyUp(0x24));
		const item = await genericAlert(33);
		assert.equal(item, 1);
		assert.ok(ours !== undefined);
		const rom = oracleShot(caseName, shot);
		const left = Math.trunc((machine.width - 322) / 2) - 8;
		const top = Math.trunc((machine.height - 112) / 3) - 8;
		const box: Box = [left, top, left + 338, top + 128];
		const d = differences(ours, rom, [box]);
		if (d.length > 0) {
			writeComparison(`${caseName}-alert`, rom, ours, box);
		}
		assert.equal(d.length, 0, `${d.length} pixels differ, first at ${d.slice(0, 8).join(' ')}; see oracle/cache/diffs/${caseName}-alert.png`);
	});
}

/** Glider's DoSoundSettings up to its ModalDialog loop, with sound and music on, 2 channels, volume 5. */
function soundSettings(inColor: boolean): DialogRecord {
	SetSoundVol(5);
	const theDlgPtr = GetNewDialog(131, null, inFront)!;
	const r = theDlgPtr.portRect;
	const top = Math.trunc((screenBits.bounds.bottom - screenBits.bounds.top - (r.bottom - r.top)) / 2);
	const left = Math.trunc((screenBits.bounds.right - screenBits.bounds.left - (r.right - r.left)) / 2);
	MoveWindow(theDlgPtr, left, top, true);
	ShowWindow(theDlgPtr);
	SelectWindow(theDlgPtr);
	SetPort(theDlgPtr);
	const itemT = ref(0);
	const itemH = ref<ItemHandle>(null);
	const tempRect = { top: 0, left: 0, bottom: 0, right: 0 };
	GetDItem(theDlgPtr, 3, itemT, itemH, tempRect);
	SetCtlValue(itemH.v as ControlHandle, 1);
	GetDItem(theDlgPtr, 4, itemT, itemH, tempRect);
	SetCtlValue(itemH.v as ControlHandle, 1);
	GetDItem(theDlgPtr, 15, itemT, itemH, tempRect);
	SetCtlValue(itemH.v as ControlHandle, 1);
	// RefreshIt
	GetDItem(theDlgPtr, 13, itemT, itemH, tempRect);
	FillRect(tempRect, black);
	GetDItem(theDlgPtr, 1, itemT, itemH, tempRect);
	PenSize(3, 3);
	InsetRect(tempRect, -4, -4);
	FrameRoundRect(tempRect, 16, 16);
	PenSize(1, 1);
	GetDItem(theDlgPtr, 12, itemT, itemH, tempRect);
	SetIText(itemH.v as Handle, NumToString(GetSoundVol()));
	GetDItem(theDlgPtr, 7, itemT, itemH, tempRect);
	if (inColor) {
		PlotCIcon(tempRect, GetCIcon(803));
	} else {
		PlotIcon(tempRect, GetIcon(803));
	}
	return theDlgPtr;
}

for (const [m, caseName] of [
	[macPlus, 'dialogs'],
	[macII, 'dialogsColor'],
] as [Machine, string][]) {
	test(`the Dialog Manager shows Glider's Sound Settings dialog as System 6 does on a ${m === macPlus ? 'Mac Plus' : 'Mac II'}`, { skip: oracleRunAvailable(caseName) ? false : `the oracle has not run "${caseName}"` }, async () => {
		const machine = bootMachine(m);
		TEInit();
		InitDialogs(null);
		let ours: Image | undefined;
		machine.host.at(30, () => {
			ours = machine.shot();
		});
		machine.host.at(31, () => hostKeyDown(0x24, 13));
		machine.host.at(33, () => hostKeyUp(0x24));
		const d = soundSettings(m === macII);
		const item = await ModalDialog(null);
		DisposDialog(d);
		assert.equal(item, 1);
		assert.ok(ours !== undefined);
		const rom = oracleShot(caseName, 'sound');
		const left = Math.trunc((machine.width - 272) / 2) - 8;
		const top = Math.trunc((machine.height - 166) / 2) - 8;
		const box: Box = [left, top, left + 288, top + 182];
		const d2 = differences(ours, rom, [box]);
		if (d2.length > 0) {
			if (process.env.DUMP_SHOT) {
				writeFileSync(process.env.DUMP_SHOT, writePNM(ours));
			}
			writeComparison(`${caseName}-sound`, rom, ours, box);
		}
		assert.equal(d2.length, 0, `${d2.length} pixels differ, first at ${d2.slice(0, 8).join(' ')}; see oracle/cache/diffs/${caseName}-sound.png`);
	});
}
