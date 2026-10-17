// Basic Toolbox types and helpers for THINK Pascal arithmetic.
//
// Pascal's Integer is 16 bits and LongInt is 32 bits; both are JavaScript numbers here.
// The compiled Glider 4.05 code has no overflow or range checks, so arithmetic that
// overflows wraps silently. Code that can overflow wraps explicitly with int16() or int32().

import { macRomanChar, macRomanCode } from './MacRoman.ts';

/** A 16-bit signed integer (Pascal `Integer`). */
export type Integer = number;
/** A 32-bit signed integer (Pascal `LongInt`). */
export type LongInt = number;
/** An 8-bit signed integer (Pascal `SignedByte`). */
export type SignedByte = number;
/** A Toolbox result code. */
export type OSErr = Integer;
/** A four-character code such as a resource type, stored as a four-character string. */
export type OSType = string;
/** A 16.16 fixed-point number, stored as its 32-bit integer representation. */
export type Fixed = LongInt;

export const noErr = 0;

export interface Point {
	v: Integer;
	h: Integer;
}

export interface Rect {
	top: Integer;
	left: Integer;
	bottom: Integer;
	right: Integer;
}

/** A box for a scalar `var` parameter. Records are passed by reference instead. */
export interface Ref<T> {
	v: T;
}

export function ref<T>(v: T): Ref<T> {
	return { v };
}

/** Pascal record assignment copies; `tempRect := destRect` is `tempRect = cloneRect(G.destRect)`. */
export function cloneRect(r: Rect): Rect {
	return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
}

export function clonePoint(p: Point): Point {
	return { v: p.v, h: p.h };
}

/** Wraps a number to a 16-bit signed integer. */
export function int16(x: number): Integer {
	return (x << 16) >> 16;
}

/** Wraps a number to a 32-bit signed integer. */
export function int32(x: number): LongInt {
	return x | 0;
}

/** Wraps a number to an 8-bit signed integer. */
export function int8(x: number): SignedByte {
	return (x << 24) >> 24;
}

/** Pascal `div`: integer division truncating toward zero. */
export function div(a: number, b: number): number {
	return Math.trunc(a / b);
}

/** Pascal `mod`: the remainder takes the sign of the dividend, like JavaScript's `%`. */
export function mod(a: number, b: number): number {
	return a % b;
}

export function HiWord(x: LongInt): Integer {
	return int16(x >> 16);
}

export function LoWord(x: LongInt): Integer {
	return int16(x);
}

export function BitAnd(a: LongInt, b: LongInt): LongInt {
	return a & b;
}

export function BitOr(a: LongInt, b: LongInt): LongInt {
	return a | b;
}

export function BitXor(a: LongInt, b: LongInt): LongInt {
	return a ^ b;
}

export function BitNot(a: LongInt): LongInt {
	return ~a;
}

/** THINK Pascal `BSR`: logical shift right of a 32-bit value. */
export function BSR(value: LongInt, count: Integer): LongInt {
	return int32(value >>> count);
}

/** THINK Pascal `BSL`: shift left of a 32-bit value. */
export function BSL(value: LongInt, count: Integer): LongInt {
	return int32(value << count);
}

/** THINK Pascal `BTST`: tests bit `bit` (0 is the least significant) of a 32-bit value. */
export function BTST(value: LongInt, bit: Integer): boolean {
	return ((value >>> bit) & 1) !== 0;
}

export function Odd(x: LongInt): boolean {
	return (x & 1) !== 0;
}

/** Converts a four-character code to its 32-bit integer value. */
export function fourCC(code: OSType): LongInt {
	let v = 0;
	for (let i = 0; i < 4; i++) {
		v = (v << 8) | (code.charCodeAt(i) & 0xff);
	}
	return int32(v);
}

/**
 * A Pascal `array[lo..hi] of T`: a JavaScript array indexed lo to hi, each element made by `make`.
 * Indexes below lo (index 0 of an array[1..n]) are unused; negative indexes are properties, so an
 * `array[-1..16]` works as written.
 */
export function pArray<T>(lo: number, hi: number, make: (i: number) => T): T[] {
	const a: T[] = [];
	for (let i = lo; i <= hi; i++) {
		a[i] = make(i);
	}
	return a;
}

/**
 * Pascal assignment to a `string[n]` variable or field: keeps the first n characters (as MacRoman
 * bytes; every character the program uses is one byte).
 */
export function pString(s: string, n: number): string {
	return s.length > n ? s.slice(0, n) : s;
}

/** Pascal `Length` of a string: its characters, each one MacRoman byte. */
export function Length(s: string): Integer {
	return s.length;
}

/** Pascal `Copy(s, index, count)`: count characters from the 1-based index. */
export function Copy(s: string, index: Integer, count: Integer): string {
	return s.substr(Math.max(0, index - 1), Math.max(0, count));
}

/** Pascal `Concat`. */
export function Concat(...parts: string[]): string {
	return parts.join('');
}

/** Pascal `Pos(substr, s)`: the 1-based position of substr in s, or 0. */
export function Pos(substr: string, s: string): Integer {
	return s.indexOf(substr) + 1;
}

/** Pascal `Chr` and `Ord`: characters are MacRoman codes, held in strings as Unicode. */
export function Chr(code: Integer): string {
	return macRomanChar(code & 0xff);
}

export function Ord(ch: string | boolean): Integer {
	return typeof ch === 'boolean' ? (ch ? 1 : 0) : macRomanCode(ch);
}
