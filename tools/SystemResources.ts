// The port's own copies of the System resources that Standard File uses: its dialogs (DLOG and DITL
// -3999, to save, and -4000, to open) and alerts (ALRT and DITL -3997 to -3993). Their layouts and
// texts are System 6.0.8's, measured from its System file; the bytes are written here.

import type { ResourceFork } from '../src/mac/ResourceFork.ts';
import { encodeMacRoman } from '../src/mac/MacRoman.ts';

const button = 4;
const statText = 8;
const editText = 16;
const userItem = 0;
const disabled = 128;

/** A dialog item: its type, rectangle (top, left, bottom, right), and text. */
type Item = [type: number, rect: [number, number, number, number], text: string];

/** A 'DITL' resource. */
function ditl(items: Item[]): Uint8Array {
	const parts: number[] = [(items.length - 1) >> 8, (items.length - 1) & 0xff];
	for (const [type, rect, text] of items) {
		const data = encodeMacRoman(text);
		parts.push(0, 0, 0, 0);
		for (const v of rect) {
			parts.push((v >> 8) & 0xff, v & 0xff);
		}
		parts.push(type, data.length, ...data);
		if (data.length & 1) {
			parts.push(0);
		}
	}
	return new Uint8Array(parts);
}

function word(v: number): number[] {
	return [(v >> 8) & 0xff, v & 0xff];
}

/** A 'DLOG' resource: invisible, dBoxProc, no close box, an empty title. */
function dlog(height: number, width: number, itemsID: number): Uint8Array {
	return new Uint8Array([...word(0), ...word(0), ...word(height), ...word(width), ...word(1), 0, 0, 0, 0, 0, 0, 0, 0, ...word(itemsID), 0]);
}

/** An 'ALRT' resource: every stage draws the alert with item 1 default and one beep ($5555). */
function alrt(height: number, width: number, itemsID: number): Uint8Array {
	return new Uint8Array([...word(0), ...word(0), ...word(height), ...word(width), ...word(itemsID), 0x55, 0x55]);
}

export function putStandardFileResources(rf: ResourceFork): void {
	const put = (type: string, id: number, data: Uint8Array) => rf.put({ type, id, name: null, attrs: 0, data });
	put('DLOG', -3999, dlog(184, 304, -3999));
	put('DITL', -3999, ditl([
		[button, [132, 218, 150, 288], 'Save'],
		[button, [158, 218, 176, 288], 'Cancel'],
		[statText | disabled, [136, 14, 152, 197], 'Save as:'],
		[userItem | disabled, [29, 198, 49, 302], ''],
		[button, [56, 218, 74, 288], 'Eject'],
		[button, [82, 218, 100, 288], 'Drive'],
		[editText, [157, 17, 173, 194], ''],
		[userItem | disabled, [29, 14, 127, 197], ''],
	]));
	put('DLOG', -4000, dlog(200, 348, -4000));
	put('DITL', -4000, ditl([
		[button, [138, 256, 156, 336], 'Open'],
		[button, [1152, 59, 1232, 77], ''],
		[button, [163, 256, 181, 336], 'Cancel'],
		[userItem | disabled, [39, 232, 59, 347], ''],
		[button, [68, 256, 86, 336], 'Eject'],
		[button, [93, 256, 111, 336], 'Drive'],
		[userItem, [39, 12, 185, 230], ''],
		[userItem, [39, 229, 185, 246], ''],
		[userItem | disabled, [124, 252, 125, 340], ''],
		[statText | disabled, [1044, 20, 1145, 116], ''],
	]));
	const alerts: [number, number, Item[]][] = [
		[-3993, 96, [[button, [66, 112, 82, 186], 'OK'], [statText | disabled, [14, 16, 62, 186], 'You do not have the access privileges to open that folder.']]],
		[-3994, 80, [[button, [50, 112, 68, 186], 'OK'], [statText | disabled, [14, 16, 46, 186], 'Bad character in name, or can’t find that disk.']]],
		[-3995, 80, [[button, [52, 112, 70, 186], 'OK'], [statText | disabled, [14, 12, 46, 188], 'A system error occurred; please try again.']]],
		[-3996, 80, [[button, [50, 112, 68, 186], 'No'], [button, [50, 16, 68, 90], 'Yes'], [statText | disabled, [14, 16, 46, 186], 'Replace existing “^0” ?']]],
		[-3997, 80, [[button, [50, 112, 68, 186], 'OK'], [statText | disabled, [14, 16, 46, 186], 'Disk is locked.']]],
	];
	for (const [id, height, items] of alerts) {
		put('ALRT', id, alrt(height, 200, id));
		put('DITL', id, ditl(items));
	}
}
