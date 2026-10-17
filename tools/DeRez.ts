// Parses DeRez listings made of `data` statements, such as Glider_405/Glider.r.
//
//     data 'TYPE' (id, "name", purgeable, locked) {
//         $"0102 0304"            /* comment */
//     };

import { decodeMacRoman } from '../src/mac/MacRoman.ts';
import { resChanged, resLocked, resPreload, resProtected, resPurgeable, ResourceFork, resSysHeap } from '../src/mac/ResourceFork.ts';

const attrBits: Record<string, number> = {
	sysheap: resSysHeap,
	purgeable: resPurgeable,
	locked: resLocked,
	protected: resProtected,
	preload: resPreload,
	changed: resChanged,
};

/** Decodes a DeRez string literal body (without quotes) into MacRoman bytes. */
function unescape(body: number[]): number[] {
	const out: number[] = [];
	for (let i = 0; i < body.length; i++) {
		const c = body[i]!;
		if (c !== 0x5c) {
			out.push(c);
			continue;
		}
		const next = String.fromCharCode(body[i + 1]!);
		if (next === '0' && String.fromCharCode(body[i + 2]!) === 'x') {
			out.push(parseInt(String.fromCharCode(body[i + 3]!, body[i + 4]!), 16));
			i += 4;
		} else if (next === '$') {
			out.push(parseInt(String.fromCharCode(body[i + 2]!, body[i + 3]!), 16));
			i += 3;
		} else if (/[0-7]/.test(next)) {
			out.push(parseInt(String.fromCharCode(body[i + 1]!, body[i + 2]!, body[i + 3]!), 8));
			i += 3;
		} else {
			const simple: Record<string, number> = { t: 9, b: 8, r: 13, n: 10, f: 12, v: 11, '?': 0x7f, '\\': 0x5c, "'": 0x27, '"': 0x22 };
			out.push(simple[next] ?? body[i + 1]!);
			i += 1;
		}
	}
	return out;
}

function parseHeader(line: number[]): { type: string; id: number; name: string | null; attrs: number } {
	const s = String.fromCharCode(...line);
	const m = /^data '(.{4})' \((-?\d+)(.*)\) \{$/s.exec(s);
	if (!m) {
		throw new Error(`bad resource header: ${s}`);
	}
	const type = decodeMacRoman(new Uint8Array(line.slice(6, 10)));
	const id = Number(m[2]);
	let rest = m[3]!;
	let name: string | null = null;
	let attrs = 0;
	while (rest.length > 0) {
		rest = rest.replace(/^,\s*/, '');
		if (rest.startsWith('"')) {
			let j = 1;
			while (j < rest.length && rest[j] !== '"') {
				j += rest[j] === '\\' ? 2 : 1;
			}
			const body = Array.from({ length: j - 1 }, (_, k) => rest.charCodeAt(1 + k));
			name = decodeMacRoman(new Uint8Array(unescape(body)));
			rest = rest.slice(j + 1);
		} else {
			const word = /^[a-zA-Z]+/.exec(rest);
			if (!word) {
				throw new Error(`bad resource attributes: ${s}`);
			}
			const bit = attrBits[word[0].toLowerCase()];
			if (bit === undefined) {
				throw new Error(`unknown resource attribute ${word[0]}`);
			}
			attrs |= bit;
			rest = rest.slice(word[0].length);
		}
	}
	return { type, id, name, attrs };
}

/** Parses a DeRez listing given as raw bytes (the text is MacRoman with LF or CR line ends). */
export function parseDeRez(bytes: Uint8Array): ResourceFork {
	const rf = new ResourceFork();
	const lines: number[][] = [[]];
	for (const b of bytes) {
		if (b === 0x0a || b === 0x0d) {
			lines.push([]);
		} else {
			lines[lines.length - 1]!.push(b);
		}
	}
	let current: { type: string; id: number; name: string | null; attrs: number; hex: string[] } | null = null;
	for (const line of lines) {
		const text = String.fromCharCode(...line);
		if (current === null) {
			if (text.startsWith('data ')) {
				current = { ...parseHeader(line), hex: [] };
			} else if (text.trim() !== '') {
				throw new Error(`unexpected line outside a resource: ${text}`);
			}
			continue;
		}
		if (text.startsWith('};')) {
			const hex = current.hex.join('');
			const data = new Uint8Array(hex.length / 2);
			for (let i = 0; i < data.length; i++) {
				data[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
			}
			rf.resources.push({ type: current.type, id: current.id, name: current.name, attrs: current.attrs, data });
			current = null;
			continue;
		}
		const m = /^\s*\$"([0-9A-Fa-f ]*)"/.exec(text);
		if (!m) {
			throw new Error(`unexpected line in resource '${current.type}' ${current.id}: ${text}`);
		}
		current.hex.push(m[1]!.replace(/ /g, ''));
	}
	if (current !== null) {
		throw new Error('unterminated resource at end of listing');
	}
	return rf;
}
