// Port of G-IdleUtils.p (stub: the unit's interface, until it is ported).
import { pArray } from '../mac/Toolbox.ts';

export function CloseHiScores(): void {
	throw new Error('IdleUtils.CloseHiScores is not ported yet');
}

export function NewMode(_randomIt: boolean): void {
	throw new Error('IdleUtils.NewMode is not ported yet');
}

export async function DisplayAHelpScreen(): Promise<void> {
	throw new Error('IdleUtils.DisplayAHelpScreen is not ported yet');
}

export function CloseHelpScreens(): void {
	throw new Error('IdleUtils.CloseHelpScreens is not ported yet');
}

export async function NextPageHelpScreens(): Promise<void> {
	throw new Error('IdleUtils.NextPageHelpScreens is not ported yet');
}

export async function OpenHelpScreens(): Promise<void> {
	throw new Error('IdleUtils.OpenHelpScreens is not ported yet');
}

export function InitIdle(): void {
	throw new Error('IdleUtils.InitIdle is not ported yet');
}

export async function DoIdle(): Promise<void> {
	throw new Error('IdleUtils.DoIdle is not ported yet');
}

export function DropIdle(): void {
	throw new Error('IdleUtils.DropIdle is not ported yet');
}

export async function DoAbout(): Promise<void> {
	throw new Error('IdleUtils.DoAbout is not ported yet');
}

export async function DoSoundSettings(): Promise<void> {
	throw new Error('IdleUtils.DoSoundSettings is not ported yet');
}

export async function DoCustomizeKeys(): Promise<void> {
	throw new Error('IdleUtils.DoCustomizeKeys is not ported yet');
}

/** The unit's interface variables. */
export const IdleUtils = {
	/** array[0..3] of Boolean */
	ozmaFlags: pArray(0, 3, () => false),
};
