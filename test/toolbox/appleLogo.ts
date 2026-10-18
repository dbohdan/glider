// The Apple menu's original title, the Apple logo, for comparing screens with the oracle's: the
// port draws a diamond instead (see AppleMenuTitle in src/mac/Menus.ts). Tests only.

import { type AppleMenuTitle, setAppleMenuTitle } from '../../src/mac/Menus.ts';

/** The color logo, as the oracle's Mac II draws it, and Chicago 12's character 0x14. */
export const appleLogo: AppleMenuTitle = {
	color: [
		'.......gg...',
		'......gg....',
		'......g.....',
		'..ggg..ggg..',
		'.gggggggggg.',
		'yyyyyyyyy...',
		'yyyyyyyyy...',
		'ooooooooo...',
		'oooooooooo..',
		'rrrrrrrrrrr.',
		'.mmmmmmmmmm.',
		'.mmmmmmmmmm.',
		'..bbbbbbbb..',
		'...bb..bb...',
	],
	colors: {
		g: { red: 0x1f21, green: 0xb793, blue: 0x1431 },
		y: { red: 0xfc00, green: 0xf37d, blue: 0x052f },
		o: { red: 0xffff, green: 0x648a, blue: 0x028c },
		r: { red: 0xdd6b, green: 0x08c2, blue: 0x06a2 },
		m: { red: 0xf2d7, green: 0x0856, blue: 0x84ec },
		b: { red: 0x0000, green: 0x0000, blue: 0xd400 },
	},
	mono: [
		'.........',
		'.....##..',
		'....##...',
		'....#....',
		'.###.###.',
		'#########',
		'#######..',
		'#######..',
		'#########',
		'#########',
		'.#######.',
		'..##.##..',
	],
};

/** Has the menu bar show the Apple logo, as the original does. */
export function useAppleLogo(): void {
	setAppleMenuTitle(appleLogo);
}
