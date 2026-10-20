// Port: the colors of Glider for Windows (docs/versions.md, "Glider for Windows"), for the Mac II's
// screen in the additions' Machine submenu (src/glider/Additions.ts). Glider/WIN's art is the Mac's
// color art with each of the Mac II's 16 standard colors replaced by a Windows color, four pairs
// merging; the port shows the Mac's screen through the same replacement.
//
// The values are what a VGA card puts on the screen: its DAC has 6 bits a component, so a program's
// 0x80 shows as 130 and 0xC0 as 195 ((d << 2) | (d >> 4), as measured in DOSBox). With a 16-color
// driver, Windows' standard colors; in 256 colors, Glider/WIN's own palette, whose dark colors are
// brightened to 0xC0 (measured for dark red and olive; purple and green, which the screenshots do
// not show, are taken to be brightened the same way).

import { type Brushes, type Pattern, type RGBColor, standardClut4 } from '../mac/Toolbox.ts';

/** A color as the browser draws it: 8-bit red, green, blue. */
export type RGB8 = [red: number, green: number, blue: number];

const dac = (v: number): number => {
	const d = v >> 2;
	return (d << 2) | (d >> 4);
};

const color = (r: number, g: number, b: number): RGB8 => [dac(r), dac(g), dac(b)];

/** Windows' colors for the Mac II's 16, in the order of its standard color table (white to black). */
export function windowsColors(variant: 16 | 256): RGB8[] {
	const dark = variant === 16 ? 0x80 : 0xc0;
	const white = color(0xff, 0xff, 0xff);
	const yellow = color(0xff, 0xff, 0x00);
	const red = color(0xff, 0x00, 0x00);
	const purple = color(dark, 0x00, dark);
	const blue = color(0x00, 0x00, 0xff);
	const cyan = color(0x00, 0xff, 0xff);
	const green = color(0x00, dark, 0x00);
	const darkRed = color(dark, 0x00, 0x00);
	const olive = color(dark, dark, 0x00);
	const lightGray = color(0xc0, 0xc0, 0xc0);
	const gray = color(0x80, 0x80, 0x80);
	const black = color(0x00, 0x00, 0x00);
	return [
		white, // white
		yellow, // yellow
		red, // orange
		red, // red
		purple, // magenta
		purple, // purple
		blue, // blue
		cyan, // cyan
		green, // green
		green, // dark green
		darkRed, // brown
		olive, // tan
		lightGray, // light gray
		gray, // medium gray
		gray, // dark gray
		black, // black
	];
}

// Glider for Windows draws the shapes the Mac draws in code (tables, shelves, cabinets) with GDI:
// a fill or frame with a brush, which Windows dithers from pure colors when it lacks the color, and
// a line with a pen, which it draws in the nearest color it has. Measured in the screenshots of
// rooms 3 to 5 (docs/images/windows/), whose play area is the screenshots' less 61 pixels across:
// the brushes are aligned to the play area, as the room's offscreen port is.
//   - Brown fills (tables, cabinets): dark red where x + y is even, olive where it is odd.
//   - Light brown fills (shelves, the tops of cabinets): red where x + y is even; where it is odd,
//     white on odd rows and yellow on even ones.
//   - Light brown lines (highlights): Windows' static gray (160, 160, 164), which only exists in 256
//     colors; the Mac II's 16 have no color that shows as it, so the nearest, gray, stands in.
// The shapes are drawn into the Mac II's 16 colors, in those the substitution shows as the Windows
// ones: brown as dark red, light brown (tan) as olive. Glider/WIN draws violet in pure magenta,
// which the 16 cannot show apart from purple either; it stays purple. With a 16-color driver the
// dithers are taken to be the same, in that driver's colors (no screenshots).

const same = (a: RGBColor, b: RGBColor) => a.red === b.red && a.green === b.green && a.blue === b.blue;
const [white, yellow, , red, , , , , , , brown, tan, , gray] = standardClut4 as [RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor, RGBColor];

/** Pattern rows (bit 7 the leftmost pixel) of pixels where x + y is even, and where it is odd. */
const even: Pattern = [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55];
const odd: Pattern = [0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa];
const oddOnOddRows: Pattern = [0, 0xaa, 0, 0xaa, 0, 0xaa, 0, 0xaa];
const oddOnEvenRows: Pattern = [0x55, 0, 0x55, 0, 0x55, 0, 0x55, 0];

/** Glider for Windows' brushes and pens, for QuickDraw to draw Glider's shapes with (setBrushes). */
export const windowsBrushes: Brushes = {
	brush: (color) => {
		if (same(color, brown)) {
			return [
				{ pat: even, color: brown },
				{ pat: odd, color: tan },
			];
		}
		if (same(color, tan)) {
			return [
				{ pat: even, color: red },
				{ pat: oddOnOddRows, color: white },
				{ pat: oddOnEvenRows, color: yellow },
			];
		}
		return null;
	},
	pen: (color) => (same(color, tan) ? gray : null),
};
