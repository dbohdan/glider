# Glider 4.0 Unofficial Web Edition

John Calhoun's 1991 Macintosh game, ported line by line from its Pascal source to TypeScript, to run in the browser.

**[Play it](https://dbohdan.github.io/glider/)**

![The first room on the Mac II, in the browser](docs/images/2026-10-17-pictures-oracle-and-first-games/74-browser-first-room-scaled-mac-ii.png)

## What it is

The port is Glider 4.05 translated unit by unit, keeping the original's procedures, variables and control flow.
Under it runs a reimplementation of the parts of System 6 that Glider uses: QuickDraw and Color QuickDraw, the Window, Menu, Control and Dialog Managers, TextEdit, Standard File, and the SMS sound engine Glider links.
It is checked against the original running on emulated Macs, a Mac Plus and a Mac II, with the same keys pressed at the same moments: the two agree pixel for pixel, tick for tick, and sample for sample.

What it is not:

- **An emulator.** No ROM or System software runs or ships with it. (The emulator is the test oracle, and its inputs are fetched, never committed.)
- **A remake.** Glider's timing and its bugs are kept on purpose.
- **Glider PRO.** That is Calhoun's later game.
- **Official.** It is not made or endorsed by John Calhoun, Casady & Greene, or softdorothy; the MIT License under which Calhoun released the source allows it.

## Playing

The page starts on a Mac II in 16 colors. Add `?machine=plus` for a black-and-white Mac Plus, and `?startup=desktop` to start on the desktop instead of in Glider.
Glider's own Help screens (the Options menu) explain the game, and Configure… sets the keys.
The mouse works too: while Glider steers by the mouse, a click on the screen captures the pointer, and Escape releases it.

Quitting Glider goes to the desktop, a System 6 Finder with three icons: Glider, the Room Editor (not ported yet), and the source code.
Its menus are where the browser's own operations live:

- **File > Import Files…** puts houses, art and saved games on the disk: MacBinary, AppleSingle, StuffIt, Compact Pro, disk images (DiskCopy 4.2 or bare HFS), and ZIP archives of them.
- **File > Export Files…** saves your saved games, houses, high scores and preferences as a ZIP archive, which Import reads back.
- **Special > Reset Preferences and Scores…** puts back Glider's preferences and the high scores of the houses that came with it.

What you change is kept in the browser's storage, so Export Files… is your backup.

![The desktop on the Mac Plus](docs/images/2026-10-19-desktop/09-port-desktop-plus.png)

## Building

The port needs Node.js 24.

```sh
make            # type check, lint, and test
make build      # the page, in dist/
make serve      # serve dist/ at http://localhost:8000/
```

Most of the game and Toolbox tests compare the port with oracle runs, and skip themselves until the oracle has run.
`make oracle` fetches its inputs (ROMs, System 6.0.8, Glider 4.06) and builds the emulator; [`oracle/README.md`](oracle/README.md) has the rest.
[`AGENTS.md`](AGENTS.md) is how to work on the port, and [`PORT.md`](PORT.md) holds its decisions, its roadmap, and a journal of how it was made.
The [galleries](docs/images/README.md) tell the same story in screenshots.

Every push to `master` is checked and deployed to GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

## The repository

Calhoun's original sources, as released:

- `Glider_405/`: Glider 4.05, its Pascal sources, resources and art.
- `RoomEditor_103/`: the Room Editor 1.03.
- `Houses/`: houses from the More Glider disk and others.
- `Glider_Sound_Files/`: the game's sounds.

The port:

- `src/glider/`: Glider's units, translated.
- `src/mac/`: the Toolbox.
- `src/platform/`: the machine, the browser page, and reading and writing files.
- `src/desktop/`: the desktop.
- `test/`, `oracle/`, `tools/`: tests, the emulator oracle, and the build of the game's resources.

## Status

The game is complete and matches the original on both machines.
Still to come: the Room Editor, then additions such as choosing the machine, the scale and the art from Glider's Options menu (see the roadmap in [`PORT.md`](PORT.md)).

## Credits and licenses

- **Glider 4.0** by John Calhoun, published by Casady & Greene. The source was released by softdorothy under the MIT License ([`LICENSE`](LICENSE)), which covers this repository.
- **The More Glider houses**: Mad House by John Calhoun; the others by Jeff Carter, Brian Eaton, Tony Korlath and Steve Sullivan.
- **Fonts:** Ozma and Glinda, the bitmaps of Chicago 12 and Geneva 9, come from the System file of [Executor](https://github.com/ctm/executor) (MIT License).
- **The Source Code icon** holds the branch mark of [Jason Long's Git logo](https://git-scm.com/downloads/logos) ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
- **Earlier work:** [kodogo/Glider](https://github.com/kodogo/Glider) ported Glider 4.0's source to JavaScript before this port, which was made independently of it.
- **The oracle** runs [Mini vMac](https://www.gryphel.com/c/minivmac/), from [Infinite Mac](https://github.com/mihaip/infinite-mac)'s fork, on the ROMs and System software Infinite Mac hosts.
- **The archive readers** were written from the formats as [The Unarchiver](https://github.com/MacPaw/XADMaster) reads them and checked against it and [hfsutils](https://www.mars.org/home/rob/proj/hfs/).
