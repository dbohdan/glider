// Port of G-PlayActive.p (stub: the unit's interface, until it is ported).

import type { LongInt, Rect } from '../mac/Toolbox.ts';

export async function Coordinate(): Promise<void> {
	throw new Error('PlayActive.Coordinate is not ported yet');
}

/** The unit's interface variables. */
export const PlayActive = {
	timeIs: 0 as LongInt,
	hotRect: { top: 0, left: 0, bottom: 0, right: 0 } as Rect,
	sliding: false,
};
