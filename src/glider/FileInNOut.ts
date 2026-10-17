// Port of G-FileInNOut.p (stub: the unit's interface, until it is ported).

import type { Integer } from '../mac/Toolbox.ts';

export function ErrorCheckFile(): boolean {
	throw new Error('FileInNOut.ErrorCheckFile is not ported yet');
}

export async function OpenHouse(): Promise<boolean> {
	throw new Error('FileInNOut.OpenHouse is not ported yet');
}

export async function DoOpen(_whichType: Integer): Promise<boolean> {
	throw new Error('FileInNOut.DoOpen is not ported yet');
}

export async function DoClose(_volNum: Integer): Promise<void> {
	throw new Error('FileInNOut.DoClose is not ported yet');
}

export async function GetHouse(): Promise<boolean> {
	throw new Error('FileInNOut.GetHouse is not ported yet');
}

export async function ReadGame(): Promise<boolean> {
	throw new Error('FileInNOut.ReadGame is not ported yet');
}

export async function SaveGameAs(): Promise<boolean> {
	throw new Error('FileInNOut.SaveGameAs is not ported yet');
}

export async function SaveGame(): Promise<boolean> {
	throw new Error('FileInNOut.SaveGame is not ported yet');
}

export async function WriteHouse(): Promise<boolean> {
	throw new Error('FileInNOut.WriteHouse is not ported yet');
}
