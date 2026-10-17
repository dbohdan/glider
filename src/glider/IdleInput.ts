// Port of G-IdleInput.p (stub: the unit's interface, until it is ported).

import type { Integer } from '../mac/Toolbox.ts';

export async function StartNewGame(): Promise<void> {
	throw new Error('IdleInput.StartNewGame is not ported yet');
}

export async function GetGame(): Promise<boolean> {
	throw new Error('IdleInput.GetGame is not ported yet');
}

export async function HandleMenu(_theMenu: Integer, _theItem: Integer): Promise<void> {
	throw new Error('IdleInput.HandleMenu is not ported yet');
}

export async function DoMouseDown(): Promise<void> {
	throw new Error('IdleInput.DoMouseDown is not ported yet');
}

export async function DoKeyDown(): Promise<void> {
	throw new Error('IdleInput.DoKeyDown is not ported yet');
}

export function DoDiskEvent(): void {
	throw new Error('IdleInput.DoDiskEvent is not ported yet');
}

export function DoOSEvent(): void {
	throw new Error('IdleInput.DoOSEvent is not ported yet');
}
