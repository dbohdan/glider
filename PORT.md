# Porting Glider 4 to TypeScript: work journal

This file is the memory of the port.
It records the goal, the settled decisions, the conventions for translating the Pascal source, the roadmap, and a dated journal.
Read it before resuming work.
Version differences between historical releases are documented separately in [`docs/versions.md`](docs/versions.md).
How to work on the port (methods, and traps that have cost time) is in [`AGENTS.md`](AGENTS.md).

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
   The dialogs the program asks the system for are the original's too, Standard File's included: drawn on the Mac's screen by the port's Toolbox, as on a Mac.
   What the Mac provided around the program is the page's: the Finder (decision 16), disks and file storage, launching and quitting.
   Toolbox calls stay in the ported code; only their system-level implementations change.
   The port is not an emulator, and the README says so: it runs only Glider and its editor, on a reimplementation of the parts of the Mac they use.
3. **System version:** System 6 user interface only (`hasSys7 = FALSE`, so "Help" is appended to the Options menu).
   The Finder without MultiFinder, so the menu bar has no application menu.
   System 7 may be revisited after the Room Editor.
4. **Machines:** a Mac Plus (512×342, black and white, page flipping) and a Mac II (640×480, 16 colors or black and white).
   In the browser the Mac II has an Apple Extended Keyboard, the keyboard Glider 4.05's preferences were saved with, so its arrow-key controls work without the "New keyboard" alert; the oracle's Mac II (and the tests') has the standard ADB keyboard.
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
   Deployed when the person launches the game and is ready for feedback, not before.
8. **Fonts:** the system font in the emulated screen is "Ozma", Apple's Chicago 12 bitmap glyphs re-encoded in our own format.
   Rasterized ChicagoFLF is the fallback if Ozma is ever challenged.
   The application font, which the desktop names its icons in, is "Glinda": Geneva 9's glyphs, taken the same way (both from Executor's MIT-licensed System file, compared glyph by glyph with System 6.0.8's).
   Ozma's character 0x14, Chicago's Apple logo, is a black diamond, and the color Apple logo of the Apple menu is a diamond in the logo's six stripes; tests put the original logo back to compare screens with the oracle's (`test/toolbox/appleLogo.ts`).
   Glider's own bitmap fonts come from its resources.
   HTML pages use vector ChicagoFLF.
9. **HTML user interface:** the page shows the screen and little else; what the player chooses is chosen on the Mac's screen (decisions 2 and 16), since page controls at the browser's size look out of place beside a scaled-up game.
   Where the page must show something of its own (no JavaScript, a phone without a keyboard), it is minimal black and white, after mi.css (public domain); never generic framework styling.
10. **Houses:** the default "The House" is the "Fan Fun!" revision shipped in every release from 4.02 to 4.10.
    The repo's unlocked working copy ships as "The House (July 1991)".
    Fan-made houses from the web are not bundled; an importer for archives (BinHex, MacBinary, StuffIt) comes later.
11. **Third-party binary libraries** (Buckland's SMS sound code, Jon Wind's About… library) are reimplemented from their interfaces and observed behavior, not translated.
    Their code may be read (SMS's was disassembled) to learn exactly what they do.
12. **Commercial files** (other Glider releases, manuals, ROMs, System software) are never committed.
    The oracle setup fetches them.
13. **What the browser keeps:** only the player's part of the game's files, Glider's preferences and each bundled house's high scores, so that the game's files stay ours to update; files the player makes (saved games, their own houses) are kept whole.
14. **Menus and settings are a baseline, not a limit:** they are first made to match the original pixel for pixel, then may change where it serves the player, tastefully and authentically: in the original's own style, built from its own parts, and where possible after a Glider that did it (Glider for Windows).
    The game itself (play, rooms, drawing, sound, timing) stays exact.
    An addition's setting is kept apart from the original's preference record, so that 'Gprf' keeps its format.
15. **Names:** the game is "Glider 4.0" in readable text, as on its About box and in Casady & Greene's materials (its releases are 4.0 to 4.10).
    The page's `startup` parameter names a program, after the Finder's Set Startup…: `?startup=glider4` and `?startup=room-editor` (Glider 4.0 is the only Glider with a separate Room Editor), and `?startup=desktop` for the desktop (decision 16); a bare URL starts Glider.
    The repository is `dbohdan/glider`, with room for earlier Glider versions should their sources appear.
16. **The desktop:** an application of our own on the port's Toolbox plays the Finder's part, as System 6.0.8's Finder desktop with only our three icons and a small Finder-style menu bar (no disks, no Trash, no windows of folders): Quit goes to it.
    MiniFinder was considered and dropped: it is System 4.1's (Finder 5.5's "Use MiniFinder…"; System 5 and 6 have none), it has no menu bar, and its two plain windows of buttons look less like a Mac than the desktop does (`docs/images/2026-10-19-desktop/`).
    Its icons are Glider 4.0's and the Room Editor's own, and "Source Code", a System 6 folder with Git's branch mark (from Jason Long's Git logo, CC BY 3.0, credited in the README), which opens the repository in a new tab.
    Its Shut Down says "You may now close this window safely.", with Restart.
    The browser's own operations (importing houses, exporting the player's files, resetting preferences and scores) are in its menus.
    Each program runs in a page load of its own, as each oracle run boots a fresh Mac: the programs' globals live in modules, and a second launch in one page would inherit the first's.

## Related work

- [kodogo/Glider](https://github.com/kodogo/Glider) is an earlier JavaScript port of Glider 4.0's source, more native to the browser and less exact. This port was made independently of it; the README should cite it as precedent.

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
- **Standard File:** System 6.0.8's PACK 3, read from its code: its dialogs, its own list of files (not the List Manager's), its pop-up and keys, drawn by the port's Toolbox from resources of our own (`tools/SystemResources.ts`).
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
  - [x] The browser page: the screen with its cursor at integer scales, keys (arrow keys by key, for remote desktops), the mouse with Pointer Lock, the clock, sound, storage of the player's files.
  - [ ] Choosing the machine other than by the URL (`?machine=plus`); deploying to GitHub Pages at launch (decision 7).
- [ ] **6. Toolbox user interface (System 6):** Window, Menu, Control, Dialog, TextEdit, and Alert managers.
  - [x] Every Toolbox routine Glider calls exists with its Inside Macintosh name (`src/mac/Toolbox.ts`).
  - [x] Glider's menus, its "New keyboard" alert, and its Sound Settings dialog match the oracle pixel for pixel on both machines.
  - [x] The default button's flash on Return, in black and white and in color, tick for tick.
  - [ ] The other dialogs (Configure, high scores, About), menu blinking, document windows (for the Room Editor).
- [ ] **7. Files:** File Manager over the virtual file system, Standard File backed by the house library, preferences.
  - [x] File Manager over the in-memory volume; `OpenResFile` writes resource changes back; Standard File's filter and hook.
- [ ] **8. Sound:** SMS reimplementation.
  - [x] SMS's engine, read from its object code; every tick of the sound matches the oracle's recordings on both machines (`test/game/`).
  - [x] Playing it in the browser.
- [ ] **9. Glider:** port the 11 units.
  - [x] All units translated (`src/glider/`); Glider starts up on both machines exactly as the original does (`test/game/`).
  - [x] A game plays exactly as the original's: the oracle's `play` and `playColor` cases replayed on the port give identical screens through 10 seconds of play on both machines.
  - [x] Steering with the keyboard matches the oracle on both machines, and so does every tick of the alert going away and of a game starting.
  - [x] Play with input: items, rooms, deaths, game over, high-score entry, the menus, dialogs, help and pause; mouse control (`test/game/`).
  - [x] Finishing a house: going on to the next file (`AdvanceAFile`), and the closing animation, game over and a high score at the end of the last (`houseEndScript`).
  - [x] Saving a game (Command-S) and opening it again (Load Game…), with the saved file compared field by field (`savedGameScript`).
  - [x] Changing the Sound and Configure settings, playing with them, and the preferences Glider writes at Quit (`settingsScript`).
  - [x] A Mac II switched to black and white with Command held at launch (`blackAndWhiteScript`).
  - [x] Opening another house (Load House…), here one that is not the first of its chain (`loadHouseScript`).
  - Not to be compared: a Mac II started at 256 colors, where Glider asks to switch (`CheckAndSwitch`). The port's Mac II starts at 16 colors, so no player meets that alert.
- [ ] **10. Standard File and the desktop** (decisions 2 and 16).
  - [x] Standard File's dialogs on the Mac's screen, after System 6.0.8's (DLOG and DITL -3999 and -4000, measured in the oracle, with resources of our own), checked against the oracle during the saved-game and house cases.
  - [ ] The desktop, after System 6.0.8's Finder (measured in the oracle), with `startup` and Quit.
  - [ ] The README: what the port is and is not, credits and licenses, and the precedent below.
- [ ] **11. Windows look:** palettes, then art.
- [ ] **12. Room Editor.**
  - Started from the desktop, or with `?startup=room-editor`.
- [ ] **13. Additions** (decision 14), once the port is complete:
  - Switching machines and palettes (Mac Plus, Mac II in color or black and white, the Windows palettes) from a submenu of the Options menu, built like Glider's own submenu.
    A machine change restarts the program, as changing the Mac would; a palette change may not need to.
  - Scaling (integer factors, and the largest that fits) from another Options submenu, in place of the page's own control.
  - A "Bass Beat" checkbox in the Sound Settings dialog, as in Glider for Windows, whose dialog has "Object", "Music" and "Bass Beat" under "Sounds To Play".
    On the Mac, Music covers both the jingle on entering a room and the bass during play; the checkbox would split off the bass.
    It is on by default, as the Mac plays it; Glider for Windows had it off by default (`docs/versions.md`).

## Open questions

- The exact oval rule (see the journal): the original QuickDraw source (Computer History Museum, 2010) is under a non-commercial license, so it could only be read for the algorithm, not copied; not consulted so far.
- Exact Color QuickDraw behavior for: inverse table matching, arithmetic modes other than transparent on regions that are not rectangles.
- Effective device color table after the Palette Manager applies `pltt` 128.
- Initial values of uninitialized Pascal globals; `Globals.ts` starts them at zero. The one that shows, `is4Channel` (the preference Glider writes instead of reading), is zero in the oracle on both machines: Sound Settings opens on 2-Channel at first.
- Whether the Palette Manager changes the Mac II's color table for `pltt` 128, whose colors differ from `clut` 4 in their low bytes (tolerance 0). The oracle's CLUT dump (`c`) can tell.
- What a dialog's edit field does with text longer than it: in the oracle, a period key held into Glider's high-score name scrolls the field sideways (the periods' 4-pixel pattern hides it) and, at about 80 characters, the field starts over with one character. The port wraps and scrolls a line up instead.
- Where System 6 puts a submenu in general: the oracle shows it 4 pixels inside the parent's right edge and 7 pixels below the parent item's top, for Glider's one submenu.
- Which keyboard type the port reports (`SysEnvirons`' `keyBoardType`): the shipped preferences say 4, so any other value shows the "New keyboard" alert at first launch, as the oracle does on both machines.
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

### 2026-10-18 (timing)

The 5-tick key latency of the previous entry was wrong: it made two errors cancel out. The port now matches the original tick for tick through the alert going away and a game starting, and a game steered with the keyboard, on both machines (85 tests at the time).

New oracle tools made the difference:

- `Script.traceKeys`: the emulator prints the tick in which the Mac's KeyMap changed. Keys reach the Mac in the tick after the script presses them, on both machines.
- `Script.traceTraps`: the emulator prints each trap the program calls, by tick (Mini vMac's A-line exception calls into the front end; `build-minivmac.sh` patches it in). Decoded with trap names, a trace shows what the original does in each tick: in Glider's idle loop, `WaitNextEvent` (without MultiFinder, `SystemTask` and `GetNextEvent` in a loop) sleeps through one tick, and the idle animation and a `TickCount` loop take the next.

What they showed:

- System 6's `ModalDialog` flashes the default button when Return is pressed: highlighted in the tick the key arrives, unhighlighted 8 ticks later (`Delay(8)`). In black and white the whole button is inverted, frame included; in color the body and text colors swap and the frame stays. The port did neither, and its alert went away 8 ticks early.
- Mini vMac copies the screen after the first part of each tick, before the extra instructions a higher speed runs. A screenshot showed one tick plus a sliver of the next, and at speed 5 a frame half drawn on the Mac II. The front end now copies the screen again for each screenshot, so that it shows exactly what the tick drew; the port takes its screenshot of tick k as tick k + 1 begins.
- At 32 times the instructions per tick, starting a game still took the original 4 ticks; at 256 times it takes none, as in the port. The game cases run at speed 8.
- On the Mac II, ADB delivers a key milliseconds into the tick, after a game frame has read the keys; on the Mac Plus the keyboard delivers it first. The harness puts Mac II keys in the middle of their tick and lets input end a wait, so that an event loop still sees a key in its tick.
- The title screen's demo depends on when the alert goes away, and Glider's keys after the "New keyboard" alert are its defaults (comma, period, Return, space), not the preferences' arrow keys.

### 2026-10-18 (high scores)

A new oracle case, `tour`, flies forward through the house for 20 seconds, lets the glider drift until the game ends, types a name into the high-score dialog, and follows the title screen with the high scores: 100 screenshots, all identical on the Mac Plus. What it took:

- Auto-repeat survives `FlushEvents`: auto-key events come from the last key pressed while it stays down, not from the queue. Glider flushes events before the high-score dialog, and a key still held went on typing in the original.
- The Dialog Manager turns on `TEAutoView` for edit fields. The system font's lines are 16 pixels and Glider's field 15, so once a key is typed the text scrolls up a pixel: `TESelView` brings the line's top into view, then its bottom.
- Typing in a dialog obscures the cursor. It hides the caret too, and the caret comes back when it next blinks: the blink keeps its own time (compared tick by tick).
- A selection from the start of a line is highlighted from the destination rectangle's left edge, and one to the end of the text to its right edge.
- The oracle's Macs have different parameter RAM: `CaretTime` and `DoubleTime` are 12 and 20 ticks on the Mac Plus and 32 and 32 on the Mac II (read from low memory). They are now part of the machine configuration.
- The 4.06 disk's "The House" has two more high scores than the shipped one; the game cases use the port's copy.
- On the Mac II, a shelf's shadow showed that the rule for gray patterns painted in patCopy + transparent was wrong: the ROM does not simply invert the pattern in shapes that are not rectangles, it shifts it by the shape's bounding box (a polygon's polyBBox, a region's before clipping). The gray comes out inverted exactly when the box's top and left add up to an odd number, which held for every case seen before.
- In color, TextEdit highlights a selection with highlight mode: the background color and the highlight color (black on the oracle's Mac II) swap, where plain inversion turned the dialog's gray into red. `setHiliteMode` stands for clearing the pHiliteBit of low memory HiliteMode.

### 2026-10-18 (browser)

- The game could not be steered with the arrow keys in the browser: on the Mac II, as on the oracle's, the standard ADB keyboard differs from the Apple Extended Keyboard in Glider 4.05's preferences, so Glider says "New keyboard. Switching to default keyboard controls." and uses comma, period, Return, and space. The browser's Mac II now has an Extended Keyboard (`extendedKeyboard` in `bootMachine`); a Mac Plus still gets the alert and the default keys, as a real one would.
- The Apple logo is replaced by a diamond (see the settled decisions).
- In an xrdp session the arrow keys still did nothing: remote desktops send them as the numeric keypad's with NumLock off (`code` "Numpad4", `key` "ArrowLeft"), and the port maps keys by `code`. An event whose `key` is an arrow is now the arrow key.

### 2026-10-18 (mouse)

Games steered with the mouse match the original on both machines: the Controls menu's Mouse (the glider pulls toward the mouse's side of the screen, and Glider puts the mouse back on a horizon each frame) and Joystick (mouse movements, with the mouse put back in the middle each frame).

- A chosen menu item blinks as soon as the button comes up: off and on, 3 ticks each, `MenuFlash` (3 on both oracle Macs) times. The port waited 3 ticks first, which put the game's frames a tick off on the Mac II after choosing from a menu.
- The button reaches the program a tick later on a Mac Plus (the ROM debounces it at vertical blanking), and in the middle of the tick on a Mac II (ADB), where `MenuSelect`, polling, sees it at once.
- `GetMouse` reads low memory `Mouse`, which the cursor task copies from `MTemp` at each vertical blanking; Glider's CenterMouse and HorizonMouse write `MTemp` and `RawMouse` (RAM dumps, tick by tick).
- A Mac II's ADB mouse reports when the bus is polled. A new trace (`Script.traceMouse`, Mini vMac's ADB mouse patched to call the front end) gives each report's tick and how many cycles into it; the harness replays them. Reports that come as a tick begins reach the program in that tick or the next, depending on whether the ROM finishes the ADB transaction before the vertical blanking task; the trace cannot say which, so the scripts give movements in the ticks between frames.
- On a Mac Plus, Mini vMac holds back other input for 4 ticks after a button event; scripts leave room.
- In the browser, a game played with the mouse captures the pointer (Pointer Lock) at the next click or key press and lets it go when the game stops or pauses; captured, the pointer's movements move the Mac's mouse, which Glider puts back where it wants.

### 2026-10-18 (random play)

A new oracle case plays a minute of a game with keys chosen at random from a seed (`wanderScript`): forward, back, drifting, energy, rubber bands, deaths, and the title screen's demos after the game ends. It matches on both machines.

- The only difference was a white line beside the copter in the title demo on the Mac Plus: 4.06's black-and-white art (PICTs 128 and 129) differs from 4.05's. The game cases now give the oracle the port's art, as they give it the port's The House (`gameFiles`).

### 2026-10-18 (rooms)

New oracle cases start games in other rooms: The House with its rooms rotated so that a game starts in room 9, 15, 22, 27, or 35 (`houseFrom`), each played with a minute of random keys. Test rooms put chosen objects in the first room (`houseWith`, `maskRooms`): switches at every alignment, sprites of several widths, and sprites stretched.

- Room 35 crashed in ExtractEventRects: a Pascal `for` loop takes its bound once, and the loop's own SetUp procedures change the variable it was read from. The audit of the other loops with variable bounds found no other case.
- A drip's last frame is a row taller than the others (14 rows to 13), so Glider stretches it, and CopyBits and CopyMask could not. A test picture of stretched and shrunk images (`stretch`) measured the ROMs' rule for CopyBits, the same on both: along each axis, where one side is larger its pixels are grouped at round(i × larger / smaller), halves rounding up, and the groups are ORed; only rows differ when shrinking, each source row going to the destination row nearest its top edge, halves down, and rows past the end dropped.
- On a Mac Plus, the room's switches lost their right two columns. The ROM was suspected first, and RAM dumps showed the sprites and masks in memory were the port's, bit for bit. Disassembling the ROM's CopyMask (`$40CAF0`, from the trap table; capstone disassembles 68000 code) showed that it neither stretches nor keeps to the source rectangle: it fills dstRect from the source and mask at the same offsets, in 32-pixel runs. The port now does the same on a Mac Plus. That was not the switches' cause, though: disassembling Glider 4.06's DrawAllObjects found code that 4.05 does not have, narrowing every switch to 16 pixels, and 4.06's source rectangles for the switches are 16 wide where 4.05's are 18 (its art was re-laid-out). The oracle's copy of 4.06 now gets 4.05's rectangles and a branch that skips the narrowing (`switches405`). In real 4.05 on a Mac Plus, the switches are drawn whole.
- On a Mac II, CopyMask is the general stretching routine with a mask. It matches the port's rule for the drip and for most stretched sprites. Of the test room's, 55 pixels still differ: where a horizontal shrink of 4-bit pixels splits a pixel in half, and in the first row of one enlarged mask. Offsets fitted to them broke other sprites, so the rule stays, and the test counts the 55 pixels as known.
- After a high score, the name field shows the last name selected. Typing over a selection shows the caret at once and starts its blinking over, as setting the selection does; typing at the caret hides it until it next blinks (tick by tick, `wanderScript` from room 15).
- On a Mac II, shelf, cabinet and table shadows had their gray inverted in some rooms. The rule from before (transparent patterns shifted by the shape's bounding box) only happened to fit. Test pictures of ovals, polygons and regions at every parity of edge, painted with gray and with a diagonal, showed the real one: in transparent mode the ROM inverts the pattern's bits for ovals, rounded rectangles and polygons, and leaves them for rectangles and regions, always in the port's alignment. A test room of shelves at every parity agreed. (Regions painted with a diagonal come out sparser on the ROM; Glider only uses gray.)
- On a Mac II, a game in a dark room turned the glider a frame earlier than the port. The harness had keys come over ADB in the middle of their tick, after the frame read them; that was right for most keys but not all. New traces from the emulator: each key event the ADB keyboard gives (all come as the tick begins) and each new KeyMap the program's GetKeys returns. A third of the keys were read in the tick they came, the rest a tick later, depending on how far into the tick the program called GetKeys. The harness now goes by the GetKeys trace.
- The interface case (`interfaceScript`: Glider's messages, settings, About box, high scores, help, a paused game) differs at once after the first dialog: the title screen's little gliders a step apart. Tick by tick, the port drew an idle frame the original did not, as the Apple menu went down: Glider looks for events every other tick, and the button reached the program a tick later in the port. The harness's rule (a Mac Plus takes the button a tick after it comes) held for one menu and not the next: the ROM's debouncing takes one tick or two. The emulator now traces low memory MBState, the button as the ROM has taken it, and the harness goes by it. With that, the case matches on the Mac Plus.
- When Glider shows the menu bar again (pausing), the original paints the screen's rounded corners beside it black, over the game; the port's DrawMenuBar now does too.
- The oracle's Apple menu lists the System's desk accessories, the port's none; the shots do not show the menu open.
- On the Mac II the interface case showed three things the port's Color QuickDraw lacked, each seen in the oracle. An old-style window's port (a dialog without a 'dctb', like Configure) draws to the screen at the screen's depth, through its pixel map; the port drew it as one bit per pixel into four-bit memory, squeezed into a strip. A dialog's icon item takes a 'cicn' of the same ID on a color screen even when the dialog is not a color window. A one-bit pixel map is drawn in its color table's colors, not the port's (the About box's icons). And CopyBits in srcCopy colorizes pixel values with the port's colors, (value AND fore) OR (NOT value AND back): the help screens are copied with a cyan background. With these the case matches on the Mac II too.


### 2026-10-18 (oracle disks)

- Room 35 on the Mac II seemed to rank a score differently from the Mac Plus: "number 4" in the original's high-score dialog, "number 2" in the port's, for the same 3308. RAM dumps during the dialog, of a run on a fresh disk, have the rank at 1 on both Macs, and 4.06's GetName shows its argument plus one; the case's own shot says "number 2". The "4" came from a per-tick run that booted from the case's used disk, where earlier runs had saved their 3308s into the house. Oracle runs now boot from a copy of their disk (`run`).
- AutoSlow, which drops Mini vMac's extra speed after 60 ticks without screen changes or input, was suspected before the disk was. The oracle's front end already turned it off at run time; the build now turns it off too.
- `makeDisk` ran hfsutils with one shared home, where hfsutils keeps the current volume, so two oracle processes at once could copy files onto each other's disks. Each disk now gets a home of its own.
- What room 35 still had was one period more in the name: a '.' held in the high-score dialog from tick 2600 is released at 2636, the tick its third repeat falls due, and the port repeated it before taking the release. (The keys that came with Return at 2570 are not it: GetName flushes events at 2571 in both.) The ROM makes repeats in OSEventAvail, when no event is queued, from KeyThresh, KeyRepThresh, KeyTime, KeyRepTime and KeyLast, which the ADB keyboard driver sets when a key goes down and clears when it comes up: the port's rule. What differs is the order within the tick. New traces from the emulator order things within a tick by cycles (`watch`, a low-memory value when it changes, checked at every trap; `app`, the program's first trap in each tick). On the Mac II at speed 8, Ticks changes about 1.1 million cycles into a tick and ADB keys reach the KeyMap about 2.7 million cycles in; in tick 2636 the dialog's loop did not check for events between the two, so the release came first. A new case holds a key in the dialog for 24, 30 and 36 ticks, each released as a repeat falls due (`repeats`): the Mac Plus takes the release first every time, the Mac II at 24 and 36 takes the repeat first and at 30 the release, a race within the tick. So the emulator's key trace now also reports auto-key events and the ticks in which the program asked for them (GetOSEvent or OSEventAvail with autoKeyMask, from D0, which the trap hook now gets), and the harness puts a key that comes as a repeat falls due before the repeat when the original made none in that tick. Room 35 matches on the Mac II.
- Room 9 on the Mac II differed from the game-over screen on: the letter cards fell a pixel apart. Comparing every call to Random (the original's `randSeed` watched, the port's logged) found the original one call ahead from tick 1667, the last step of ClosingAnimation, which runs until GetKeys sees Return. Return reached the KeyMap during tick 1667, and a GetKeys in that tick saw it, so the harness had it come as the tick began; but two GetKeys calls earlier in the tick had missed it, and the original drew one more step. The emulator's GetKeys trace now gives how many calls came before in the tick, and only the tick's first call counts as seeing a key as the tick began; others come in the middle, where the port's waiting loop wakes for input and sees them in the same tick, as the original's polling did. Room 9 matches on the Mac II, and every case now matches on both machines.

### 2026-10-19 (sound)

The oracle records sound now: Mini vMac is built with sound, and the front end writes the emulated Mac's samples to a file (`Script.sound`; 8-bit, 370 a tick, as the hardware plays them), without Mini vMac's stand-in for the volume control, which scaled the samples.

SMS, Glider's sound library, came as 68000 object code in MPW's object format (`SMSCore.a.o`); a parser of the format's records and capstone gave its code with its routines' names. What it does:

- 'SMSD' resources: a priority, a number of repetitions, a lock count, a spare word, then samples at 22254.5 a second. None of Glider's is compressed.
- Without an 'SMSB' resource (Glider has none) SMS does not use the Sound Manager on any machine: a VBL task writes 370 samples a tick into the Mac Plus sound buffer, starting 26, 30 or 42 samples in (`SMSTime1`, `SMSTime2`, `SMSTime4`, the samples played before the task runs) for one, two or four channels. Two channels mix as (a >> 1) + (b >> 1) per sample, four as the sum of each >> 2; an idle channel plays silence (0x80). Glider uses two channels, or four with its 4-Channel setting.
- A sound plays for its length in whole ticks: SMSLoad pads a sound it loads itself with silence to a whole tick, but Glider's sounds are preloaded, and SMS then keeps their length, so the last part tick is never heard (a sound of 49.8 ticks plays 49; seen in the oracle as the channel's pointer going to 0 a tick early).
- A new sound takes the last free channel, or else the one playing the sound of lowest priority no higher than its own; among equals not one repeating forever, then the fewest repetitions, then the shortest sound (repeating) or the least left.
- A Mac II plays the same buffer: in the oracle, the tick after SMS writes it, whole. A Mac Plus plays it as SMS writes it: in the oracle Mini vMac reads the buffer 25 to 40 samples at a time and SMS's task runs between the first reads or during them, so each sample of a tick is the tick's or, up to sample 90, still the tick before's.
- Mini vMac's Mac II sound chip waits until its FIFO holds 512 samples and stops when it runs dry (its comments call this a kludge); after SMSInit the oracle's Mac II is silent until a tick on a 61-tick grid. The port does not imitate the emulator there, and the test does not count a Mac II tick of silence.

The port's SMS (`src/mac/SMS.ts`) runs the VBL task once a tick, catching up to TickCount when the program calls SMS or the platform asks for sound, and gives each tick's samples to the platform in the order they are heard. The tour and the random games now record their sound, and every tick of it matches on both machines.
- In the browser, game sounds were silent when the page came over plain HTTP from another machine (the person's setup): browsers give audio worklets only to secure pages. The page now plays each animation frame's samples as a buffer at the Mac's rate, after those before, which works on any page.
- The browser keeps only the player's part of the game's files (settled decision 13): Glider's 'Gprf' resource and the high scores of bundled houses, put back into the bundled files at start. Before, it kept every changed file whole, so a stored copy of the application hid any later change to the port's resources. Old records are read for their player's part.
- The page's icon is Glider's own: the application's 'icl8' 128 in the Mac's standard 8-bit colors, with the mask of its 'ICN#' (`tools/Favicon.ts`, written by the resource build).
- The bass "duh-dum" during play is Glider's: with Music on it plays every (256 − frames in the room) ÷ 8 + 14 frames, from about a second and a half on entering a room to under half a second when the time bonus has run out (PlayActive). It checks Music, not Sound, so it plays with Sound off.
- Glider for Windows has a "Bass Beat" setting of its own, beside "Music" and "Object" in its sound dialog (seen in a screenshot of it the person sent), which explains why the bass in the Mac version seemed more frequent than remembered: the screenshot has it off, likely as the person played. Recorded as a planned addition (roadmap 13).
- Glider for Windows' Bass Beat is off by default, read from its `GLIDER.EXE` (a 16-bit NE executable built with Borland Pascal: length-prefixed strings, `inc bp; push bp` prologues). The `GLIDER.INI` key names led to the routine that reads them, its caller to the routine that sets the defaults before, and the relocation records named each far call's target; capstone in 16-bit mode disassembled it. The bass in Windows follows the Mac's rule but only plays with the sound system on. The port will default the addition to on, as the Mac plays.
- How fast Glider ran on real hardware, measured from the sound of a YouTube video of a Macintosh SE playing The House (["Glider 4 Mac playthrough (on a Macintosh SE)"](https://www.youtube.com/watch?v=SnmdY8owqQM), recorded with a microphone, with a voice over). Matching each 'SMSD' sound against the audio (normalized cross-correlation) finds sound 7 at 0.5–0.6 where noise gives under 0.25. Sound 7 is both the fish's splash and the drip's, and a drip is timed only in frames (MoveCycleObs): 46 frames a drop for the drips of Air Steps (room 25) and of What you can't see… (House 2, room 11), 26 for Double Jeapordy! (House 2, room 17). SMS starts sounds on ticks, so the gaps are whole ticks: 92.00 ticks, again and again, around 3:40 and 52.00 (or twice that, where a drop's sound lost its channel) around 12:50, so exactly 2 ticks a frame, Glider's ceiling of 30 frames a second. A ball (sound 4) in a room with a 90-frame ball repeats every 180.0 ticks around 9:40, 2 ticks a frame again. One gap of 278 ticks (3 × 92 + 2) shows a rare slow frame. The fish of LeadFish (room 24, seen at 3:27 in the video) agrees: it lands at 3:28.5 and jumps 121.00 ticks later (its wait is 120 ticks, checked once a frame), and a faint match lands it again 136.00 ticks after the jump, its 68 frames at 2 ticks each; a fish times its wait in ticks and its flight in frames. So the SE, as far as these rooms go, played at the port's speed, and its bass would have come as often as the port's; Mini vMac at 1× (26.7 frames a second in the first room) is slower than the SE. The player had Music off: there is no room jingle (sound 29) and no bass (30) in the recording. Busier rooms, and whether this SE had an accelerator, are not known.

### 2026-10-19 (the end of a house)

- Going on to the next house file and the end of the last house match on both machines, with every screenshot of 50 seconds: two test houses, The House cut to its first room (`houseOfOneRoom`), followed by The House 2 or by nothing, flown out of on the right. The first goes on into The House 2's rooms; the second plays the closing animation (the farm, the tornado, lightning at random, sound 17), then game over and the high-score dialog (number 2, 638 points). Both matched at once.
- The real houses get there through `Transport`, not the room's right side: a ceiling duct in Monty Hall (room 40) leads to room 41, which is The House 2's room 1, and the exit in The House 2's Goodbye… (room 22) leads to room 0, the end. The animation and the file loading are the same code; the cases do not steer into those ducts.
- The tests counted an oracle run as there once its directory existed, so a run still going failed them; now a run counts once it has written its output, which comes last.

### 2026-10-19 (saved games)

- A game saved and opened again matches on both machines (`savedGame`): play, Command-S and a name typed in Standard File's dialog, more play, Command-E, game over, Load Game… and Return, and the loaded game; the saved file is compared field by field. The port shows Standard File as page dialogs, so the harness answers Standard File as the script's keys would (`scriptedStandardFile`), and no screenshot is taken while the original's dialog is up.
- When the original's dialog returns: a trap trace from just before the dialog (`savedGameProbe`) shows SFPutFile closing in the tick Return arrives, without flashing the Save button, and Glider writing the file (GetFInfo, Create, FSOpen…) and playing on in that same tick. The harness's Standard File takes its keys from the event queue and answers when Return comes.
- The original saved the game as ".sGame", not "Game", in the disk's root: the dialog took the keys still in the event queue before those typed into it, the period that flew the glider and the S of Command-S. Glider reads keys with GetKeys during play and leaves their events; the port's queue held the same two. Standard File's directory is the disk's root, not Glider's folder. Oracle runs can now keep files the program saved (`run`'s `keep`).
- The title screen after the game's end was a tick off: its little gliders moved on odd ticks in the port and even ones in the original. Tracing the original's traps found its first WaitNextEvent after the game returning an event at once, though Coordinate had just flushed the queue; System 6's WaitNextEvent without MultiFinder (read from a RAM dump at `$AF42`) loops SystemTask and GetNextEvent until an event comes or a null event's time reaches the entry Ticks plus the sleep. The event was an activate event, which lives outside the queue: closing the save dialog had left Glider's window one, and the game reads no events, so it waited through the whole game. The port's Standard File now leaves the same activate event when its page dialog returns (`activateAfterModalDialog`).
- The saved file's bytes differ where the original wrote whatever was on its stack: past each house name's end and in the byte after each object's on-off flag. The port writes zeros there (`WriteGame` starts from a zeroed record), and the test compares the records' fields.
- Key-up events no longer go into the port's queue: the system event mask leaves them out on a Mac, so they never took a place there, and a full queue loses its oldest event.

### 2026-10-19 (settings)

- Changing the settings matches on both machines (`settings`): in Sound Settings the volume up four steps, Music off and 4-Channel, in Configure Z and X for left and right and the button to fire bands; a game steered with Z and X, with its sound (four channels, no music), and Command-Q, after which Glider's 'Gprf' resource, which the run keeps, is compared byte for byte. The first version of the script turned the volume down from the oracle's 1 to 0, which turns Sound off; the port did the same, but a silent game tests less.
- On the Mac II the port's Sound Settings opened on 4-Channel, the original's on 2-Channel. Glider never reads that preference (it writes it instead), so the setting is whatever its global starts as. The port's case had not started fresh: the Mac II case ran after the Mac Plus case in the same process, and Glider's globals (`G`, and module variables such as IdleUtils' idle-loop state) kept what the case before had left, here the Mac Plus case's 4-Channel. Every case had started from the one before's state since the game tests began. Each case now plays in a worker thread of its own, with fresh modules, as each oracle run boots a fresh Mac; all cases still match, so none had depended on what it inherited. Since the cases are independent, they also run side by side, and the tests take half the time.

### 2026-10-19 (black and white on the Mac II)

- A Mac II with Command held as Glider starts matches the original (`blackAndWhiteColor`): Glider switches the screen to one bit (ForceBlackAndWhite), and the alert, a game, game over and Sound Settings are drawn in black and white on the 640-by-480 screen.
- The key must be down before Glider starts, and the port starts Glider at tick 0; the case starts it later (`launchTick`). Even then the port stayed in color: the harness started its clock at the launch tick, so input scheduled before it was delivered at the program's first wait, after Glider had read the keys. The harness now delivers it before the program starts (`catchUp`), as a Mac's keyboard would have.

### 2026-10-19 (another house)

- Opening another house matches on both machines (`loadHouse`): Load House…, The House 2 chosen, Glider's alert that it is not the first house of its chain, and the game in The House that Glider opens instead.
- Standard File's dialogs start at the disk's root, where the oracle's disks have only the System Folder: the script presses Return to open it, the down arrow, and Return. The harness's Standard File follows the keys through a small model of that (`scriptedStandardFile`): folders and files by name, the folder it was last in, and files saved where the dialog is.
- Mini vMac's Mac Plus gives the arrow keys the Extended Keyboard's codes ($7D for down), where a real Mac Plus keyboard gives $48 (Inside Macintosh IV; Mini vMac's own source has "0x48" in a comment beside 0x7D). The port keeps the real codes; the harness now reads the oracle's key traces by the emulator's.
- Behind the original's alert was a blank rectangle where Standard File's dialog had been: closing a window erases what was under it and leaves it to be updated, and Glider handles the update only after the alert. The port's Standard File now does what closing the original's dialog would (`modalDialogClosed`), with the dialog's frame from its DLOG and a dBoxProc window's 8-pixel frame (System 6.0.8's own dialogs, -3999 and -4000, are 304 by 184 and 348 by 200), along with the activate event found with saved games.

### 2026-10-19 (Standard File)

- Standard File's dialogs are drawn on the Mac's screen and match the oracle pixel for pixel on both machines: saving a game (the name typed, the files dimmed), opening it, and choosing a house with the arrow keys (`savedGame`, `loadHouse`). The page's dialogs, the harness's model of the original's (`scriptedStandardFile`) and the stand-in for closing them (`modalDialogClosed`) are gone: the Window Manager now does what closing the real dialog does.
- How: PACK 3 disassembled (capstone, with a trap-name table) and written up as a specification before any code: placement, the order of drawing, the list's geometry and sort, the filter's keys, the button dimming, the alerts. It has its own list, not the List Manager's, with its seven small icons inside it, and calls the dialog hook after every ModalDialog, null events included. The DLOGs, DITLs and ALRTs are written by our build, checked byte for byte against System 6.0.8's; the icons are copied from PACK 3.
- The oracle's disks were changed to match the port's volume: Glider and its files at the root with the system's files invisible (`rootDisk`), and the boot disk fixed, so Eject is dimmed as no disk of the port's can be ejected (a patch to Mini vMac's disk driver, `DiskInPlace` 8). The harness's volume holds the oracle disk's files: the port bundles more houses.
- Two errors had cancelled out. The port aligned patterns with the screen and dimmed inactive buttons with gray in `notPatBic` over the whole button; on Glider's dialogs, at odd positions, the two together drew the same pixels as the ROM. Standard File's gray line (a FillRect in gray) was a pixel off, and its dimmed buttons lost their frames. System 6.0.8's CDEF 0 dims with gray in `patBic` inside the button less 3 and 1 pixels, leaving its frame whole, and the ROM aligns patterns with the port's own coordinates: the line matches with both, on both machines, and every earlier case still does.
- On the Mac II, Standard File draws the selected file with RGBBackColor black and RGBForeColor white in its dialog, an old port. The port ignored colors set in old ports; the ROM keeps the nearest old-style color, and draws it in the screen's nearest color. Both are in now.
- Not measured, from the code only: the pop-up menu open (the port's volume has no folders, so it holds the disk alone), an active scroll bar (more files than fit; the thumb's drag is the port's own, without the ROM's gray outline), truncated names, type-select, and the alerts PACK 3 positions (12 pixels inside the dialog's lower left).

### 2026-10-19 (a caret and a repeat in the same tick)

- After the oracle was recorded again, room 9's high-score dialog differed by a caret: the port's was on, the original's off. Every tick of the original (shots spliced into the case's script) showed its caret blinking every 12 ticks, through the period's repeats. A trap trace of those ticks showed why the earlier recording had matched by chance: in some ticks TEIdle's TickCount read the new tick before GetNextEvent made the repeat, and in others the repeat came first, depending on where Glider's ModalDialog loop was when the tick began.
- The emulator's `autokey` line now ends with how many times the program had called TickCount in that tick; 0 means the repeat came first. The harness passes those ticks to the port (`repeatBeforeClock`, a host method the browser does not have), and in them the port's ModalDialog lets TEIdle wait for the repeat. The port's own loop has the same race: an update event left pending comes back every millisecond, so a tick can begin between GetNextEvent and TEIdle.
