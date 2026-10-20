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
