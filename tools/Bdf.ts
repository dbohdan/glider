// BDF (Glyph Bitmap Distribution Format 2.1) for the port's own bitmap fonts, and conversion
// to and from Mac 'FONT' resources.
//
// Each glyph's bitmap covers the font's full height (ascent + descent) and its image width; its
// x offset is QuickDraw's image offset (kernMax plus the glyph's offset) and DWIDTH its advance.
// Mac font metrics without a BDF equivalent are kept as properties (MAC_LEADING and so on).

import { ByteWriter } from '../src/mac/Binary.ts';
import { type FontStrike, glyphOf } from '../src/mac/Fonts.ts';

export interface BdfGlyph {
	/** Character code, or -1 for the Mac font's missing-character glyph. */
	code: number;
	advance: number;
	xOffset: number;
	width: number;
	/** Rows from the top of the font (ascent) to the bottom (descent), as 0s and 1s. */
	rows: number[][];
}

export interface BdfFont {
	name: string;
	family: string;
	pointSize: number;
	ascent: number;
	descent: number;
	leading: number;
	widMax: number;
	kernMax: number;
	nDescent: number;
	fRectWidth: number;
	glyphs: BdfGlyph[];
}

/** The glyphs of a Mac font strike. */
export function strikeToBdf(f: FontStrike, name: string, family: string, pointSize: number): BdfFont {
	const height = f.ascent + f.descent;
	const rowBytes = f.rowWords * 2;
	const glyphs: BdfGlyph[] = [];
	const codes = [...Array.from({ length: f.lastChar - f.firstChar + 1 }, (_, i) => f.firstChar + i), -1];
	for (const code of codes) {
		const i = code < 0 ? f.lastChar - f.firstChar + 1 : code - f.firstChar;
		if (f.owTable[i] === -1) {
			continue;
		}
		const g = glyphOf(f, code < 0 ? f.lastChar + 1 : code);
		const rows: number[][] = [];
		for (let y = 0; y < height; y++) {
			const row: number[] = [];
			for (let x = 0; x < g.imageWidth; x++) {
				const col = g.locStart + x;
				row.push(y < f.fRectHeight ? (f.bitImage[y * rowBytes + (col >> 3)]! >> (7 - (col & 7))) & 1 : 0);
			}
			rows.push(row);
		}
		glyphs.push({ code, advance: g.width, xOffset: g.imageOffset, width: g.imageWidth, rows });
	}
	return { name, family, pointSize, ascent: f.ascent, descent: f.descent, leading: f.leading, widMax: f.widMax, kernMax: f.kernMax, nDescent: f.nDescent, fRectWidth: f.fRectWidth, glyphs };
}

function hexRow(row: number[]): string {
	const bytes = Math.max(1, Math.ceil(row.length / 8));
	let s = '';
	for (let b = 0; b < bytes; b++) {
		let v = 0;
		for (let k = 0; k < 8; k++) {
			v = (v << 1) | (row[b * 8 + k] ?? 0);
		}
		s += v.toString(16).toUpperCase().padStart(2, '0');
	}
	return s;
}

export function writeBdf(font: BdfFont, comments: string[]): string {
	const height = font.ascent + font.descent;
	const lines = ['STARTFONT 2.1', ...comments.map((c) => `COMMENT ${c}`), `FONT ${font.name}`, `SIZE ${font.pointSize} 72 72`];
	const minX = Math.min(...font.glyphs.map((g) => g.xOffset));
	const maxX = Math.max(...font.glyphs.map((g) => g.xOffset + g.width));
	lines.push(`FONTBOUNDINGBOX ${maxX - minX} ${height} ${minX} ${-font.descent}`);
	const props: [string, string | number][] = [
		['FAMILY_NAME', `"${font.family}"`],
		['PIXEL_SIZE', font.pointSize],
		['POINT_SIZE', font.pointSize * 10],
		['FONT_ASCENT', font.ascent],
		['FONT_DESCENT', font.descent],
		['DEFAULT_CHAR', -1],
		['MAC_LEADING', font.leading],
		['MAC_WIDMAX', font.widMax],
		['MAC_KERNMAX', font.kernMax],
		['MAC_NDESCENT', font.nDescent],
		['MAC_FRECTWIDTH', font.fRectWidth],
	];
	lines.push(`STARTPROPERTIES ${props.length}`, ...props.map(([k, v]) => `${k} ${v}`), 'ENDPROPERTIES');
	lines.push(`CHARS ${font.glyphs.length}`);
	for (const g of font.glyphs) {
		const name = g.code < 0 ? 'missing' : `char${g.code}`;
		lines.push(`STARTCHAR ${name}`, `ENCODING ${g.code}`, `SWIDTH ${Math.round((g.advance * 1000) / font.pointSize)} 0`, `DWIDTH ${g.advance} 0`, `BBX ${g.width} ${height} ${g.xOffset} ${-font.descent}`, 'BITMAP');
		for (const row of g.rows) {
			lines.push(hexRow(row));
		}
		lines.push('ENDCHAR');
	}
	lines.push('ENDFONT');
	return lines.join('\n') + '\n';
}

export function readBdf(text: string): BdfFont {
	const lines = text.split('\n');
	const props = new Map<string, string>();
	const glyphs: BdfGlyph[] = [];
	let name = '';
	let pointSize = 0;
	for (let i = 0; i < lines.length; i++) {
		const [key, ...rest] = lines[i]!.trim().split(/\s+/);
		if (key === 'FONT') {
			name = rest.join(' ');
		} else if (key === 'SIZE') {
			pointSize = Number(rest[0]);
		} else if (key === 'STARTPROPERTIES') {
			for (let k = 1; k <= Number(rest[0]); k++) {
				const m = /^(\S+)\s+(.*)$/.exec(lines[i + k]!.trim())!;
				props.set(m[1]!, m[2]!.replace(/^"|"$/g, ''));
			}
		} else if (key === 'STARTCHAR') {
			const g: BdfGlyph = { code: 0, advance: 0, xOffset: 0, width: 0, rows: [] };
			let height = 0;
			for (i++; !lines[i]!.startsWith('BITMAP'); i++) {
				const [k, ...v] = lines[i]!.trim().split(/\s+/);
				if (k === 'ENCODING') {
					g.code = Number(v[0]);
				} else if (k === 'DWIDTH') {
					g.advance = Number(v[0]);
				} else if (k === 'BBX') {
					g.width = Number(v[0]);
					height = Number(v[1]);
					g.xOffset = Number(v[2]);
				}
			}
			for (let y = 0; y < height; y++) {
				const hex = lines[++i]!.trim();
				g.rows.push(Array.from({ length: g.width }, (_, x) => (parseInt(hex.slice((x >> 3) * 2, (x >> 3) * 2 + 2), 16) >> (7 - (x & 7))) & 1));
			}
			glyphs.push(g);
		}
	}
	const num = (k: string) => Number(props.get(k));
	return {
		name,
		family: props.get('FAMILY_NAME') ?? name,
		pointSize,
		ascent: num('FONT_ASCENT'),
		descent: num('FONT_DESCENT'),
		leading: num('MAC_LEADING'),
		widMax: num('MAC_WIDMAX'),
		kernMax: num('MAC_KERNMAX'),
		nDescent: num('MAC_NDESCENT'),
		fRectWidth: num('MAC_FRECTWIDTH'),
		glyphs,
	};
}

/** A Mac 'FONT' resource holding a BDF font's glyphs, packed into one strike. */
export function bdfToFontResource(font: BdfFont): Uint8Array {
	const height = font.ascent + font.descent;
	const coded = font.glyphs.filter((g) => g.code >= 0);
	const firstChar = Math.min(...coded.map((g) => g.code));
	const lastChar = Math.max(...coded.map((g) => g.code));
	const byCode = new Map(font.glyphs.map((g) => [g.code, g]));
	const order = [...Array.from({ length: lastChar - firstChar + 1 }, (_, i) => firstChar + i), -1];
	const locTable: number[] = [];
	const owTable: number[] = [];
	let x = 0;
	for (const code of order) {
		locTable.push(x);
		const g = byCode.get(code);
		if (g === undefined) {
			owTable.push(-1);
		} else {
			owTable.push(((g.xOffset - font.kernMax) << 8) | g.advance);
			x += g.width;
		}
	}
	locTable.push(x);
	owTable.push(-1);
	const rowWords = Math.ceil(x / 16);
	const image = new Uint8Array(rowWords * 2 * height);
	x = 0;
	for (const code of order) {
		const g = byCode.get(code);
		if (g === undefined) {
			continue;
		}
		g.rows.forEach((row, y) =>
			row.forEach((bit, i) => {
				if (bit) {
					image[y * rowWords * 2 + ((x + i) >> 3)]! |= 0x80 >> ((x + i) & 7);
				}
			}),
		);
		x += g.width;
	}
	const w = new ByteWriter();
	const owTLoc = (26 + image.length + locTable.length * 2 - 16) / 2;
	w.u16(0x9000).u16(firstChar).u16(lastChar).u16(font.widMax).u16(font.kernMax).u16(font.nDescent);
	w.u16(font.fRectWidth).u16(height).u16(owTLoc).u16(font.ascent).u16(font.descent).u16(font.leading).u16(rowWords);
	w.bytes(image);
	for (const l of locTable) {
		w.u16(l);
	}
	for (const ow of owTable) {
		w.u16(ow & 0xffff);
	}
	return w.toBytes();
}
