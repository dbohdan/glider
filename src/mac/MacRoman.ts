// The Mac OS Roman character set.
//
// Strings are JavaScript strings inside the port and MacRoman bytes in files and resources.
// Characters 0x00–0x7F are ASCII. Code 0x14 is the Apple logo in Chicago; it has no
// Unicode equivalent and is kept as U+0014, as are the other control codes.

const HIGH =
	'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü' +
	'†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
	'¿¡¬√ƒ≈∆«»…\u00A0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ' +
	'‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';

const toCode = new Map<string, number>();
for (let i = 0; i < 128; i++) {
	toCode.set(HIGH[i]!, 0x80 + i);
}

export function macRomanChar(code: number): string {
	return code < 0x80 ? String.fromCharCode(code) : HIGH[code - 0x80]!;
}

/** Returns the MacRoman code of a character, or 0x3F ("?") for characters it lacks. */
export function macRomanCode(ch: string): number {
	const c = ch.charCodeAt(0);
	if (c < 0x80) {
		return c;
	}
	return toCode.get(ch) ?? 0x3f;
}

export function decodeMacRoman(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) {
		s += macRomanChar(b);
	}
	return s;
}

export function encodeMacRoman(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) {
		out[i] = macRomanCode(s[i]!);
	}
	return out;
}

/** Reads a Pascal string (length byte followed by characters). */
export function pascalString(b: Uint8Array, o: number): string {
	return decodeMacRoman(b.subarray(o + 1, o + 1 + b[o]!));
}

/** Encodes a Pascal string into a buffer of `size` bytes, truncating to `size - 1` characters. */
export function encodePascalString(s: string, size: number): Uint8Array {
	const out = new Uint8Array(size);
	const enc = encodeMacRoman(s).subarray(0, size - 1);
	out[0] = enc.length;
	out.set(enc, 1);
	return out;
}
