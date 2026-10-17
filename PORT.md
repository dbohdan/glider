# Porting Glider 4 to TypeScript: work journal

This file is the memory of the port.
It records the goal, the settled decisions, the conventions for translating the Pascal source, the roadmap, and a dated journal.
Read it before resuming work.
Version differences between historical releases are documented separately in [`docs/versions.md`](docs/versions.md).

## Goal

A pixel-perfect port of Glider 4.05 by John Calhoun to TypeScript and the browser.

- The port preserves the structure of the original Pascal source as far as practical: the same units, procedures, variables, and control flow.
- It reproduces the original's behavior, including its bugs, timing (60.15 Hz ticks, 30 frames per second in play), and System 6 user interface.
- The Room Editor 1.03 follows after the game, with more freedom to depart from the original.

## Settled decisions

Do not relitigate these without discussing them first.

1. **Scope:** Glider 4.05 first, Room Editor 1.03 later.
2. **Design philosophy:** "the program is 1991, the computer is 2026."
   Whatever the application draws or decides is reproduced exactly: its window, menus, dialogs, alerts, cursors, sounds, and timing.
   Whatever the operating system provided is replaced by the browser's equivalent: the Finder, Standard File's file browsing, file storage, launching and quitting, desk accessories.
   Toolbox calls stay in the ported code; only their system-level implementations change.
3. **System version:** System 6 user interface only (`hasSys7 = FALSE`, so "Help" is appended to the Options menu).
   System 7 may be revisited after the Room Editor.
4. **Machines:** a Mac Plus (512×342, black and white, page flipping) and a Mac II (640×480, 16 colors or black and white).
   A "Windows" look uses the Glider for Windows palette (the 256-color variant by default, the 16-color VGA variant as an option) and, later, Windows art.
   Integer scaling for modern displays.
5. **Execution model:** async/await on the main thread.
   No Web Worker, `SharedArrayBuffer`, or service worker.
   Every routine that can block (directly or by calling one that does) is `async`; about half of all routines.
   Lint rules (`no-floating-promises` and related) guard against missing `await`s.
6. **Tooling:** GNU Make, TypeScript 7 (the Go compiler) for type checking and for emitting one ES module per source file (no bundler), `node:test` on Node 24 with built-in type stripping, oxlint with tsgolint for type-aware lint rules, Playwright for browser and emulator tests.
   Tools are installed with `npm ci` from a lockfile but are compiled binaries; there is no JavaScript build tooling.
   Rolldown with `inlineConst: false` is the fallback if load time ever requires a bundle.
7. **Hosting:** GitHub Pages; no custom headers.
8. **Fonts:** the system font in the emulated screen is "Ozma", Apple's Chicago 12 bitmap glyphs re-encoded in our own format.
   Rasterized ChicagoFLF is the fallback if Ozma is ever challenged.
   Glider's own bitmap fonts come from its resources.
   HTML pages use vector ChicagoFLF.
9. **HTML user interface:** minimal black and white, starting from mi.css (public domain); never generic framework styling.
10. **Houses:** the default "The House" is the "Fan Fun!" revision shipped in every release from 4.02 to 4.10.
    The repo's unlocked working copy ships as "The House (July 1991)".
    Fan-made houses from the web are not bundled; an importer for archives (BinHex, MacBinary, StuffIt) comes later.
11. **Third-party binary libraries** (Buckland's SMS sound code, Jon Wind's About… library) are reimplemented from their interfaces and observed behavior, not translated.
12. **Commercial files** (other Glider releases, manuals, ROMs, System software) are never committed.
    The oracle setup fetches them.

## Translation conventions

These keep the TypeScript recognizably the same program as the Pascal.

### Layout

- `src/glider/` holds the port: one module per Pascal unit with the unit's name (`G-PlayActive.p` → `PlayActive.ts`).
  The main program `G-GameBody.p` becomes `GameBody.ts`.
- `src/mac/` holds the Toolbox reimplementation, one module per manager (`QuickDraw`, `Menus`, `Dialogs`, …).
- `src/platform/` holds browser glue: the canvas, input, audio, storage.
- `tools/` holds build tools written in TypeScript and run by Node.
- Tests live in `test/`, named `*.test.ts`.

### Names and declarations

- Pascal is case-insensitive; TypeScript uses the spelling of the declaration everywhere.
- Procedures and functions keep their names (`AdvanceARoom`, `DoTheSound`); Toolbox routines keep Inside Macintosh names (`CopyBits`, `GetNewDialog`).
- Constants become exported `const`s with the same names.
- Variables declared in a unit's interface and assigned by other units live in one exported object per unit; for `Globals.p` that object is `G` (`G.roomAt`).
  Variables private to a unit's implementation are module-level `let`s with their original names.
- Nested procedures stay nested functions.

### Statements and types

- `Integer` and `LongInt` are `number`, with the aliases `Integer` and `LongInt` used in declarations for documentation.
  Arithmetic that can overflow 16 or 32 bits is wrapped explicitly (`int16()`, `int32()`); each wrap site is a deliberate audit.
  The compiled 4.05 code contains no overflow or range checks, so overflow wraps silently.
- `div` truncates toward zero (`div()` helper); `mod` is `%`.
- Records are objects. Pascal record assignment copies, so every record assignment is an explicit copy.
- Arrays keep their Pascal index ranges: an `array[1..16]` is a JavaScript array whose index 0 is unused; negative lower bounds (`animateRct[0..2, -1..16]`) use the `-1` property.
- `with` statements are expanded, usually with a local alias named after the record (`const theGlider = G.theGlider`).
- `Exit(ThisProc)` is `return`; the one non-local `Exit` (`ExitGracefully` leaving `AdvanceAFile`) throws a sentinel caught by the outer procedure.
- `Leave` is `break`; `Cycle` is `continue`; `repeat … until c` is `do { … } while (!(c))`.
- `var` parameters: records are passed by reference and mutated; scalar `var` parameters use a `Ref<T>` box (`{ v }`).
- Strings are JavaScript strings, converted from and to MacRoman at file and resource boundaries.
- Busy-wait loops keep their shape but yield inside the body (`await Yield()`), so input and display keep working.
- Comments in the Pascal are carried over; comments added by the port are marked `// Port:`.

## Architecture

- **QuickDraw** draws into offscreen bitmaps and pixel maps stored one byte per pixel (1-bit and 4-bit semantics) and into the screen, which is one such bitmap.
  The screen is copied to a canvas at display refresh, scaled by an integer factor.
- **Time:** `TickCount` advances at 60.15 Hz from a virtual clock.
  In the browser the clock follows `performance.now()` and freezes when the page is hidden; in tests it advances instantly when the program waits.
- **Events:** browser input fills the Event Manager's queue and the live state read by `GetKeys`, `Button`, and `GetMouse`.
  Mouse control modes use the Pointer Lock API, which also lets the program "warp" the cursor.
- **Resources:** the build converts `Glider.r` (a DeRez listing) and the MacBinary art files into binary resource files, which the Resource Manager reads at run time as a Mac would.
- **Files:** a virtual file system with Finder types and resource forks; bundled files are read-only, changes go to browser storage, and files can be imported and exported.
- **Sound:** Buckland's SMS reimplemented in an AudioWorklet, mixing 8-bit samples at 22254.5 Hz.

## Roadmap

- [x] **0. Scaffolding:** Makefile, tool installation, TypeScript configuration, lint, test runner, smoke test.
- [x] **1. Resources and data formats:** DeRez listing, MacBinary, AppleDouble, and resource fork parsers; resource file writer; house, saved game, and preference records.
- [ ] **2. Oracle:** run the original (Glider 4.06 under System 6.0.8, and a rebuilt 4.05 if feasible) in an emulator driven by Playwright; capture reference screenshots of test houses.
- [ ] **3. QuickDraw, black and white:** rectangles, regions, patterns, pen, lines, shapes, `CopyBits`, `CopyMask`, text, PICT playback.
- [ ] **4. Color QuickDraw:** 4-bit pixel maps, color tables, inverse tables, fore and back colors, colorizing, arithmetic modes used by Glider.
- [ ] **5. Platform:** display, scaling, input, time, cursors.
- [ ] **6. Toolbox user interface (System 6):** Window, Menu, Control, Dialog, TextEdit, and Alert managers.
- [ ] **7. Files:** File Manager over the virtual file system, Standard File backed by the house library, preferences.
- [ ] **8. Sound:** SMS reimplementation.
- [ ] **9. Glider:** port the 11 units.
- [ ] **10. Launcher page:** house library, settings, credits, manual.
- [ ] **11. Windows look:** palettes, then art.
- [ ] **12. Room Editor.**

## Open questions

- Exact Color QuickDraw behavior for: `patCopy + transparent` (mode 44), text in pattern modes, XOR and invert on 4-bit pixels, colorizing with a cyan background, inverse table matching.
- Effective device color table after the Palette Manager applies `pltt` 128.
- Initial values of uninitialized Pascal globals (affects the `is4Channel` preference bug).
- SMS semantics: priorities, channel allocation, 2- and 4-channel mixing.
- Which of the Windows palette variants needs what exact values (6-bit DAC levels such as 195 versus requested 192).

## Journal

### 2026-10-17

Explored the repository and related material; see `docs/versions.md` for version comparisons.

- The source is 12.2k lines (game) and 9.9k lines (editor) of THINK Pascal using about 200 Toolbox routines.
- All PICTs are bitmap and pixel map blits; asset decoding is straightforward.
- House files are raw big-endian dumps of the Pascal record (13830 bytes).
- Infinite Mac's repository contains ROMs, System 6.0.2–7.5.5 disk images, THINK Pascal 4.0, and Glider 4.06 and 4.09: everything an oracle needs.
- Executor (MIT) is a reference for Toolbox internals.
- Measured the async closure: 84 of 173 game routines and 83 of 155 editor routines must be `async`.

Settled the decisions above with the user.
Next: scaffolding.
