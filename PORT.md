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
   The Finder without MultiFinder, so the menu bar has no application menu.
   System 7 may be revisited after the Room Editor.
4. **Machines:** a Mac Plus (512×342, black and white, page flipping) and a Mac II (640×480, 16 colors or black and white).
   A "Windows" look uses the Glider for Windows palette (the 256-color variant by default, the 16-color VGA variant as an option) and, later, Windows art.
   Integer scaling for modern displays.
5. **Execution model:** async/await on the main thread.
   No Web Worker, `SharedArrayBuffer`, or service worker.
   Every routine that can block (directly or by calling one that does) is `async`; about half of all routines.
   Lint rules (`no-floating-promises` and related) guard against missing `await`s.
6. **Tooling:** GNU Make, TypeScript 7 (the Go compiler) for type checking and for emitting one ES module per source file (no bundler), `node:test` on Node 24 with built-in type stripping, oxlint with tsgolint for type-aware lint rules, Playwright for browser tests.
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
  `pArray(lo, hi, make)` makes one.
- `with` statements are expanded, usually with a local alias named after the record (`const theGlider = G.theGlider`).
- `Exit(ThisProc)` is `return`; the one non-local `Exit` (`ExitGracefully` leaving `AdvanceAFile`) throws a sentinel caught by the outer procedure.
- `Leave` is `break`; `Cycle` is `continue`; `repeat … until c` is `do { … } while (!(c))`.
- `var` parameters: records are passed by reference and mutated; scalar `var` parameters use a `Ref<T>` box (`{ v }`).
- Strings are JavaScript strings, converted from and to MacRoman at file and resource boundaries.
  `Length`, `Copy`, `Concat`, `Pos`, `Chr`, and `Ord` are in `Types.ts`; an assignment to a `string[n]` that can be longer than n keeps the first n characters with `pString(s, n)`.
- Busy-wait loops keep their shape but yield inside the body (`await Yield()`), so input and display keep working.
- Comments in the Pascal are carried over; comments added by the port are marked `// Port:`.

### Toolbox calls

The Toolbox is `src/mac/Toolbox.ts`, which gathers every manager; a Glider module imports what it uses from it by name.

- Routines, types, and constants keep their Inside Macintosh names (`GetNewDialog`, `WindowPtr`, `inMenuBar`).
- A Toolbox procedure whose only `var` parameter is a scalar returns it: `NumToString(n, s)` is `s = NumToString(n)`, `GetPort(savePort)` is `savePort = GetPort()`, `ModalDialog(nil, itemHit)` is `itemHit = await ModalDialog(null)`, `Delay(n, ticks)` is `ticks = await Delay(n)`, `GetIndString(s, id, i)` is `s = GetIndString(id, i)`, `GetItem(menu, i, s)` is `s = GetItem(menu, i)`, `GetSoundVol(v)` is `v = GetSoundVol()`.
- Other scalar `var` parameters, and those of functions, are `Ref` boxes: `FSOpen(name, vol, refNum)` is `G.theErr = FSOpen(name, vol, refNum)` with `refNum: Ref<Integer>`; `GetDItem(d, i, itemT, itemH, box)` takes `Ref`s for the type and handle and fills `box`.
- Record parameters, `var` or not, are passed as is and filled in or read.
- Handles and pointers to Toolbox records are the records: `WindowPtr`, `DialogPtr`, `MenuHandle`, `ControlHandle`, `RgnHandle` (a `Region`), `PicHandle` (a `Picture`), `CursHandle` (a `Cursor`), and so on. `h^^.field` is `h.field`; `nil` is `null`.
- Casts between them disappear: `GrafPtr(mainWndo)` is `mainWndo`; `BitMapPtr(virginCPtr^.portPixMap^)^` is `virginCPtr.portPixMap`.
  A cast from a generic handle names the type: `ControlHandle(itemH)` is `itemH.v as ControlHandle`.
- An event's message naming a window is `eventWindow(theEvent.message)`.
- `WindowPtr(-1)` and `Pointer(-1)` as a "behind" argument are `inFront`.
- Memory calls that only matter to the Memory Manager (`HLock`, `HUnlock`, `MoveHHi`, `HGetState`, `HSetState`, `MoreMasters`) stay in the code and do nothing.
- Glider's `inline` routines become Toolbox calls of the same name: `GetGrayRgn`, `GetMBarHeight`, `SetMBarHeight`, `GetWindowList` (Windows.ts), `SetDepth` (Devices.ts).
  `IncInt(i)` and `IncLong(l)` are `i.v = int16(i.v + 1)` and `l.v = int32(l.v + 1)`.
- Low-memory reads through pointers use the address space: `initsPointer^` is `peek8(initsPointer)`.

### Resources and files as bytes

- Typed handles over resource bytes read and write the bytes with a layout: Glider's `alertHandle^^.boundsRect := alertRect` writes a `PRect` at offset 0 of the 'ALRT' handle's data (`writeLayout(PRect, alertRect, h.data, 0)`).
- `FSRead(ref, count, @record)` reads into the record's bytes: the record is written to a buffer first, the buffer is read into, and the record is read back, so a short read leaves the rest of the record as it was.
  `FSWrite` writes the record's bytes. `SIZEOF(houseRec)` is `sizeOf(houseRecLayout)`.
- Records that only live in memory are TypeScript types with a `new…()` function that makes a zeroed one.

### Async

A routine is `async` if it waits: it calls an async Toolbox routine, a routine that is async, or loops until time passes or input arrives.
Async Toolbox routines: `GetNextEvent`, `WaitNextEvent`, `Delay`, `MenuSelect`, `ModalDialog`, `Alert` (and `StopAlert`, `NoteAlert`, `CautionAlert`), `TrackControl`, `TEClick`, `DialogSelect`, `SFGetFile`, `SFPGetFile`, `SFPutFile`, `SFPPutFile`.
A busy-wait loop (on `TickCount`, `Button`, `StillDown`, `GetKeys`, or `EventAvail`) awaits `Yield()` in its body.
Dialog filter procedures and the `ErrorSound` procedure may be async; the Dialog Manager awaits them.
Every call to an async routine is awaited; the type checker and the lint rules catch a missing `await`.

These 83 of Glider's 173 routines are async (`Unit.Routine.Nested`):
`GameBody` main program, `ErrorSound`'s `DoErrorSound`, `GenericAlert`, `IOCheck`, `SaveGame`, `SaveGameAs`, `WriteGame`, `ReadGame`, `GetGame`, `WriteHouse`, `OpenHouse`, `GetHouse`, `DoOpen`, `DoClose`, `OpenSFGetHook`, `SavePrefs`, `WriteScores`, `SortHiScores`, `GetName`, `DoAbout`, `idleFilter`, `DoSoundSettings`, `DoCustomizeKeys`, `DoQuit`, `LetsQuit`, `LetsSave`, `LetsEnd`, `DoEndGame`, `WrapItUp`, `GameOver`, `OffAMortal`, `StartNewGame`, `DoStartUp`, `DoUpdate`, `RedrawWindowFrame`, `LoadABackground`, `ReadyRoom`, `DoIdle`, `DoKeyDown`, `DoMouseDown`, `HandleMenu`, `DoLoadHouse`, `DoSpecial`, `SearchRects`, `SetRoomState`, `CheckForTimeBonus`, `Collision`, `Coordinate`, `MoveAnimates`, `ResetAnimate`, `ClosingAnimation`, `Transport`, `UpAFlight`, `DownAFlight`, `AdvanceARoom`, `RetreatARoom`, `AdvanceAFile` (and its `ExitGracefully`), `ScrollForward`, `ScrollBackward`, `ScrollUp`, `ScrollDown`, `DrawAllObjects`, `DrawStair`, `OpenHelpScreens`, `NextPageHelpScreens`, `DisplayAHelpScreen`, `CloseUpShop`, and `InitializeAll` with its nested `CheckOurEnvirons` (and its `CheckAndSwitch`, `DepthAlert`, `ForceBlackAndWhite`), `GetPrefs`, `LoadCursors`, `LoadPicts`, `NewBitMap`, `PrepareSounds`, `SetUpBitMaps`, `SetUpMainWndo`, `SetUpMenus`, `SetUpOffMask`, `SetUpPixMaps`.
(Measured by a call-graph closure over the sources; the compiler has the last word.)

### An example

```pascal
GetDItem(theDlgPtr, soundOnItem, itemT, itemH, tempRect);
if (soundOn) then
  SetCtlValue(ControlHandle(itemH), 1)
else
  SetCtlValue(ControlHandle(itemH), 0);
repeat
  ModalDialog(nil, itemHit);
  …
until leaveDlg;
```

```ts
GetDItem(theDlgPtr, soundOnItem, itemT, itemH, tempRect);
if (G.soundOn) {
	SetCtlValue(itemH.v as ControlHandle, 1);
} else {
	SetCtlValue(itemH.v as ControlHandle, 0);
}
do {
	itemHit = await ModalDialog(null);
	…
} while (!leaveDlg);
```

## Architecture

- **Memory:** pointers are addresses in a flat 32-bit address space (`src/mac/Memory.ts`) holding RAM, with the compact Macs' screen buffers at its top, and video memory on a Mac II.
  Only raw data lives there (pixel buffers, screens, `NewPtr` blocks), so Glider's `Pointer(kSecondaryAddr)` and its own offscreen buffers work as written.
  Toolbox records (ports, regions, handles) are JavaScript objects.
- **QuickDraw** draws into bitmaps and pixel maps with the Mac's layout (`rowBytes`, packed pixels, 1 = black).
  Shapes become regions, regions are clipped to the bitmap, visRgn, and clipRgn, and the result is filled with a pattern in a transfer mode, as in QuickDraw.
  The screen is copied to a canvas at display refresh, scaled by an integer factor.
- **Time:** `TickCount` advances at 60.15 Hz from a virtual clock.
  In the browser the clock follows `performance.now()` and freezes when the page is hidden; in tests it advances instantly when the program waits.
- **Events:** browser input fills the Event Manager's queue and the live state read by `GetKeys`, `Button`, and `GetMouse`.
  Mouse control modes use the Pointer Lock API, which also lets the program "warp" the cursor.
- **Resources:** the build converts `Glider.r` (a DeRez listing) and the MacBinary art files into binary resource files, which the Resource Manager reads at run time as a Mac would.
- **Files:** a virtual file system with Finder types and resource forks; bundled files are read-only, changes go to browser storage, and files can be imported and exported.
- **Sound:** Buckland's SMS reimplemented in an AudioWorklet, mixing 8-bit samples at 22254.5 Hz.
  `src/mac/SMS.ts` keeps SMS's interface over a pluggable backend; without one the program is silent.
- **User interface managers:** the Window, Menu, Control, Dialog, and TextEdit managers draw into the screen through QuickDraw as System 6 does, with geometry measured from the oracle.
  The desktop and window frames are drawn in the Window Manager's port; menus save and restore the pixels they cover.
  Toolbox tests (`test/toolbox/`) boot a simulated Mac with the System and Glider resources from the oracle, run scripted input on a virtual clock, and compare the screen with the oracle's screenshots.
- **Standard File:** the program's file filter and dialog hook run; choosing the file is the browser page's (`setStandardFileHost`).
- **Cursor:** the program sets the cursor's image and visibility (`src/mac/Cursors.ts`); the platform layer draws it.

## Roadmap

- [x] **0. Scaffolding:** Makefile, tool installation, TypeScript configuration, lint, test runner, smoke test.
- [x] **1. Resources and data formats:** DeRez listing, MacBinary, AppleDouble, and resource fork parsers; resource file writer; house, saved game, and preference records.
- [ ] **2. Oracle:** run the original in a deterministic headless emulator and capture reference screenshots.
  - [x] Headless Mini vMac (Mac Plus, Mac II), fetched inputs, boot disks, scripts, screenshots.
  - [x] Glider 4.06 boots to the title screen and plays on both machines.
  - [ ] Test houses, RAM inspection of game state, the cursor in screenshots.
  - [ ] A rebuilt 4.05 (THINK Pascal 4.0 is in Infinite Mac's library), if 4.06 differences get in the way.
- [ ] **3. QuickDraw, black and white:** rectangles, regions, patterns, pen, lines, shapes, `CopyBits`, `CopyMask`, text, PICT playback.
  - [x] Picture oracle: test pictures drawn by the ROM and by the port, compared pixel by pixel (`test/quickdraw/`).
  - [x] Rectangles, regions, patterns, pattern modes, lines, ovals (known gaps), rounded rectangles, polygons, region recording from lines, 1-bit `CopyBits` in `srcCopy`, `DrawPicture` for these.
  - [ ] Text, all `CopyBits` modes, `CopyMask`, arcs, picture scaling.
- [ ] **4. Color QuickDraw:** 4-bit pixel maps, color tables, inverse tables, fore and back colors, colorizing, arithmetic modes used by Glider.
  - [x] Color ports, 4-bit pixel maps, the standard color table, RGB fore and back colors, pattern and text modes in color, transparent mode, version 2 pictures with pixel maps, `CopyBits` between depths and color tables.
  - [ ] Pixel patterns (`ppat`), color icons (`cicn`), color cursors, the Palette Manager, the inverse table for arithmetic modes.
- [ ] **5. Platform:** display, scaling, input, time, cursors.
- [ ] **6. Toolbox user interface (System 6):** Window, Menu, Control, Dialog, TextEdit, and Alert managers.
  - [x] Every Toolbox routine Glider calls exists with its Inside Macintosh name (`src/mac/Toolbox.ts`).
  - [x] Glider's menus, its "New keyboard" alert, and its Sound Settings dialog match the oracle pixel for pixel on both machines.
  - [ ] The other dialogs (Configure, high scores, About), menu blinking, button flashing on Return, document windows (for the Room Editor).
- [ ] **7. Files:** File Manager over the virtual file system, Standard File backed by the house library, preferences.
  - [x] File Manager over the in-memory volume; `OpenResFile` writes resource changes back; Standard File's filter and hook.
- [ ] **8. Sound:** SMS reimplementation.
- [ ] **9. Glider:** port the 11 units.
  - [x] All units translated (`src/glider/`); Glider starts up on both machines exactly as the original does (`test/game/`).
  - [x] A game plays exactly as the original's: the oracle's `play` and `playColor` cases replayed on the port give identical screens through 10 seconds of play on both machines.
  - [ ] Play with input: compare steering, items, and the in-game dialogs with the oracle; mouse control (Pointer Lock and the program's mouse warping).
- [ ] **10. Launcher page:** house library, settings, credits, manual.
- [ ] **11. Windows look:** palettes, then art.
- [ ] **12. Room Editor.**

## Open questions

- The exact oval rule (see the journal): the original QuickDraw source (Computer History Museum, 2010) is under a non-commercial license, so it could only be read for the algorithm, not copied; not consulted so far.
- Exact Color QuickDraw behavior for: colorizing with a cyan background (help screens), inverse table matching, arithmetic modes other than transparent on regions that are not rectangles.
- Effective device color table after the Palette Manager applies `pltt` 128.
- Initial values of uninitialized Pascal globals (affects the `is4Channel` preference bug); `Globals.ts` starts them at zero.
- Whether the Palette Manager changes the Mac II's color table for `pltt` 128, whose colors differ from `clut` 4 in their low bytes (tolerance 0). The oracle's CLUT dump (`c`) can tell.
- How many times a chosen menu item blinks with the oracle's parameter RAM (the port assumes 3), and whether the Dialog Manager flashes the default button when Return is pressed.
- Where System 6 puts a submenu in general: the oracle shows it 4 pixels inside the parent's right edge and 7 pixels below the parent item's top, for Glider's one submenu.
- Which keyboard type the port reports (`SysEnvirons`' `keyBoardType`): the shipped preferences say 4, so any other value shows the "New keyboard" alert at first launch, as the oracle does on both machines.
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

### 2026-10-17 (continued)

Scaffolding and the resource pipeline are done (roadmap 0 and 1).

Built the oracle (roadmap 2); see [`oracle/README.md`](oracle/README.md).

- Mini vMac with a headless front end of our own: no window, no real-time clock, scripted input, PBM and PPM screenshots.
  Emulated time is decoupled from wall-clock time, so runs repeat bit for bit; booting to Glider's first room takes 0.4 seconds.
  Playwright is not needed for the oracle after all.
- Each run gets a fresh HFS disk (hfsutils) with only the System and Finder from Infinite Mac's System 6.0.8 disk, Glider 4.06, and test files.
  The boot blocks' `bbHelloName` launches Glider directly, without MultiFinder.
- Glider's "MacsBug" file is C. Holmén's "Mission Screen" INIT ("Alternate screen init", version 2.0) as a `dbgr` file, which the System loads at startup like a debugger.
  On a 68000 it lowers `BufPtr` by `$8020` and writes the Pascal string "alternate screen present" at `ScrnBase - $8020`, which is Glider's `kPointerBase` (`$3F2700 - $20`).
  Glider accepts "alt" or "Hol" there; otherwise it shows alert 30 ("Place the "MacsBug" extension…") and turns page flipping off.
  The Infinite Mac copy of Glider lacks the file, so the oracle uses a 20-instruction stand-in of our own.
- Behavior to reproduce, seen in the oracle:
  - At first launch on either machine, alert 33 ("New keyboard. Switching to default keyboard controls.") appears over the title screen.
  - After it is dismissed, the title screen keeps a white rectangle where the alert was until something redraws it.
  - On the Mac II, Glider draws its side panels and centers the 512×342 play area in 640×480.

Next: test houses for the oracle, then QuickDraw (roadmap 3).

Started QuickDraw with a picture oracle, which turned out to be the most useful part of the oracle so far.
Glider draws its title picture with `DrawPicture`, so a copy of Glider with the title picture replaced shows how the ROM draws any picture; test pictures come from `oracle/PictWriter.ts`.
Runs get 32 times the instructions per tick (`speed 5`) and are shot at tick 100, when the picture is up and Glider has drawn little over it; the pixels Glider does draw over are masked by comparing an all-black and an all-white picture.

Findings, all checked pixel by pixel against the Mac Plus ROM:

- **Pictures:** `DrawPicture` draws nothing until the picture sets a clip region; every real picture does.
- **Pen modes 0 to 7** (source modes): shapes ignore the pen pattern and act like pattern mode `14 - mode` with a black pattern; lines draw nothing.
  Glider's lightning bolts use `PenMode(srcXOr)` with `LineTo`, so they may be invisible in black and white; to be checked in color and in the game.
- **Lines:** taken from top to bottom; along the major axis the minor coordinate steps after `(k + 1/2) * major / minor` pixels, a 16.16 number truncated for shallow lines and rounded up for steep lines and diagonals, and a pixel exactly at a step counts before it except on shallow lines going left.
  Thick pens spread each pixel of the one-pixel line over the pen rectangle.
- **Region recording and polygons:** a non-horizontal edge splits each scan line at the leftmost pixel of the drawn line on the next scan line (going right) or the same scan line (going left); horizontal edges add nothing.
- **Ovals:** a pixel is inside when its center satisfies `x²h² <= w²(h² + 1 - y²)` in half-pixel units, with special cases for ovals one or two pixels tall.
  This matches 98.8% of rows and every size Glider draws; the top row of short, wide ovals and a row near the ends of some tall, narrow ones differ by a pixel.
  The Mac Plus and the Mac II draw ovals identically. Executor's oval code (2019 and 2020) does not match either.
  The exact rule probably needs the original algorithm (an incremental square-root scan, judging by the asymmetries); see open questions.
- **Rounded rectangles** stretch the corner oval's edges, not its region: rows where a narrow corner oval's edges cross are empty in the oval but not in the rounded rectangle.
- Glider's title picture and all 13 black-and-white backgrounds draw identically to the ROM.

Color QuickDraw, checked against the Mac II ROM the same way (Glider's color title is drawn into a 4-bit offscreen pixel map):

- The emulated Mac II's 16-color table is the standard `clut` 4 with 8-bit components; screenshots show the high byte of each.
- Glider's color title, all 13 color backgrounds, and the black-and-white title drawn in color match the ROM.
- Pattern, text, and bitmap bits draw in color as Inside Macintosh V says: copy and or use the foreground color, bic the background color, xor complements the pixel value.
- **Source modes as pen modes** act as the corresponding pattern modes on Color QuickDraw, for shapes and lines alike: Glider's lightning bolts (`srcXor` lines) show in color.
  The rule follows the machine's QuickDraw, not the port, so `InitGraf` takes a `hasColorQD` flag.
- **Text:** Color QuickDraw's text buffer begins `kernMax` pixels left of the pen, which shows in the not-modes; the original QuickDraw's begins at the pen.
- **Arithmetic modes** combine RGB colors (the default `OpColor` is black, so blend changes nothing and addPin gives black); modes 32 to 39 act like 40 to 47 for fills.
  `srcCopy + transparent` and `patCopy + transparent`, which Glider uses for shadows, both draw only the foreground-colored pattern pixels.
  For regions that are not rectangles the Mac II ROM inverts the pattern in transparent mode, so Glider's color shadows have the opposite dither phase from what the pattern suggests.
- Other arithmetic modes pick colors through the ROM's 4-bit inverse table, which the port approximates with the nearest color; Glider does not use them.

### 2026-10-17 (Toolbox)

The Toolbox surface Glider calls is complete (`src/mac/Toolbox.ts`): the Event Manager, OS utilities, Window, Menu, Control, Dialog, and TextEdit managers, the File Manager and Standard File, depth switching, palettes, cursors, and SMS's interface.
`src/glider/Globals.ts` and the translation guide above are ready for porting the units.

Oracle cases `menus`, `menusColor`, `menuDetails`, `dialogs`, and `dialogsColor` pull down Glider's menus and open its dialogs on both machines.
The Toolbox tests compare the port's menus, alert, and Sound Settings dialog with them; all match pixel for pixel.
Findings:

- **Desktop:** the gray region is the screen with 16-pixel rounded corners, less the 20-pixel menu bar; the corners are black, and the menu bar is white with the same top corners and a line at its bottom.
- **dBoxProc** frames are a line in the frame color, two pixels of the content color, two of the frame color, and three of the content color; on the Mac II the colors come from the 'actb', 'dctb', or 'wctb' with the window's ID (Glider's alerts are gray with a blue frame), and the content color becomes the port's background color.
- **Menu bar:** titles start at 10 and are spaced by their width plus 13, with the text 8 pixels in and its baseline at 14; a highlighted title is inverted from 1 pixel left of its start to 17 past its width, rows 1 to 18.
  On a color screen the Apple menu's title is a 12-by-14 color apple 2 pixels from the top, not the font's apple.
- **Menus** hang from the bar's bottom line at their title's left, in 16-pixel rows with text 14 pixels in and marks 2 in; they are as wide as their widest item plus 20, or plus 52 with a command key, whose ⌘ is drawn 24 pixels from the right.
  The frame is 1 pixel with a 1-pixel shadow starting 3 pixels from the corners. Dividers are gray lines through the middle of their row.
  Disabled items are dimmed by clearing the pixels where the gray pattern is set (`patBic`), on both machines; the Mac II does not use a gray color.
  Highlighted items are inverted on the Plus; on the Mac II their background takes the item's text color and the text the background color.
  The hierarchical arrow is 6 by 11 at 14 from the right, in the item's key color.
- **Submenus** open about 10 ticks after the mouse comes to rest on their item, 4 pixels inside the parent's right edge and 7 below the parent item's top.
- **mctb** entries are as Inside Macintosh V says: a title entry's four colors are the title, the bar behind it, the default item color, and the menu's background; an item's are its mark, text, key equivalent, and background.
- **Buttons:** corners rounded by half the button's height; titles start `(height - line height) div 2` below the top and `(width - title width) div 2` from the left.
  Check boxes and radio buttons are 12 pixels, 2 from the left and centered vertically, with the title 18 from the left.
  The default button's outline is a 3-pixel 16-by-16 rounded rectangle 4 pixels outside it.
- **Static text** is drawn 1 pixel right of the item's left edge, with its first baseline the font's ascent below the top.
- **Color icons:** pixel values index their own color table by each entry's value, not its position; the port had them by position, which turned the alert icon's black to white. Fixed for pixel patterns too.
- Glider centers its alerts horizontally and a third of the way down, by rewriting the 'ALRT' rectangle, and centers the Sound Settings dialog in the screen.

### 2026-10-18

Glider is ported: all ten units, translated in parallel by five forked workers against typed stubs, compile together, and the main program runs.
Run headless on the platform's machine (`test/game/`), it starts up exactly as the original: the "New keyboard" alert over the title screen is identical to the oracle's screenshot, pixel for pixel and cursor included, on the Mac Plus and the Mac II.

- The faint arrow on the Mac II's title screen is part of Glider's title art, not a cursor left in screen memory.
- The mouse starts at (15, 15) on the oracle's Macs; the platform starts it there.
- Glider seeds `Random` from the clock (`GetDateTime(RandSeed)`), so runs repeat only with a fixed start date; the harness uses 1992-02-01.
- ModalDialog leaves other windows' update events pending, as System 6 does, so during the startup alert `GetNextEvent` returns the main window's update again and again. On a Mac that loop takes time; in the port it took none and hung. Each event `GetNextEvent` returns now costs a millisecond of the machine's time.
- Left for later, from the workers' reports: `ResetAnimate` is async only because the analysis took the field `delay` for the `Delay` call; `HorizonMouse` and `CenterMouse` warp the mouse through low memory, which the platform must turn into pointer movement; small helpers the workers added locally (`varOf` for passing `G` fields as `var` parameters, `HiWrd`, `SystemClick`, `kHMHelpMenuID`) belong in the Toolbox.

### 2026-10-18 (play)

A game plays exactly as the original's.
The oracle's new `play` and `playColor` cases start a game with Glider 4.05's preferences (taken from `Glider_405/Glider.r`) on an emulated CPU 32 times as fast, so that loading takes no time, as in the port, and follow it for 10 seconds: the glider drops from the ceiling to the floor three times.
The port replays the same `Script` (`replay` in `test/game/harness.ts`), and all 22 screenshots are identical on both machines (`test/game/play.test.ts`, under two seconds).

- At first the oracle's glider was 6 pixels, two frames, higher in every screenshot, and its title screen showed another demo. The suspected cause, Mini vMac pulling the mouse back after Glider's `CenterMouse`, was wrong: the emulator only sets the mouse when the script moves it.
- The real cause is input latency. Mini vMac passes key transitions to the Mac through its event queue and the Mac's keyboard or ADB polling, so the program sees a scripted key a few ticks after the script presses it; the port's input is instant. Delaying the replayed keys gives identical games with 4 or 5 ticks and identical title screens with 4 or more (Mac Plus) or 5 or more (Mac II). The harness delays keys by 5 ticks (`oracleKeyLatency`).
- So the demo on the title screen was never a `Random` difference: it depends on when the alert is dismissed.
