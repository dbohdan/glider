# Glider 4.0 Unofficial Web Edition

This repository houses a browser port of John Calhoun's 1991 Macintosh game, [_Glider 4.0_](https://en.wikipedia.org/wiki/Glider_(video_game)),
including the Room Editor.

**[Play it](https://dbohdan.github.io/glider/)**

![The first room on the Mac II, in the browser,](docs/images/2026-10-17-pictures-oracle-and-first-games/74-browser-first-room-scaled-mac-ii.png)

## What it is

The Unofficial Web Edition creates a pixel- and clock-accurate simulation of Glider 4.0 running on a [Macintosh II](https://en.wikipedia.org/wiki/Macintosh_II) or a [Macintosh Plus](https://en.wikipedia.org/wiki/Macintosh_Plus) with [System 6](https://en.wikipedia.org/wiki/System_6).
It was made by porting the [original source code](https://github.com/softdorothy/Glider4) from THINK Pascal to TypeScript unit by unit and reimplementing enough of the [Macintosh Toolbox](https://en.wikipedia.org/wiki/Macintosh_Toolbox) to run it.
It is a source port rather than an emulator.
No Mac ROM is required to run it.

The port was directed by a human, implemented by Claude Opus 5.5, and designed by both.
It includes the houses, art, and sounds from the open-source release of Glider 4.05.
Moreover, it includes the Room Editor.

## Playing

You can play with a keyboard, a mouse, a gamepad, or a touch screen.
On a phone or a tablet, Glider starts with on-screen buttons, and a finger works as the mouse: press a menu's title and drag to the item, as with a mouse held down.
The game first starts in a mode pretending to be a Mac II with 16 colors.
You can change this in the Options menu (see [Additions](#additions)).

The default key settings for Glider are (⌘ is Command on a Mac and Control elsewhere):

| Key | Action |
|---|---|
| ← and → | fly left and right |
| ↓ | battery boost, when you have a battery |
| ↑ | fire a rubber band, when you have bands |
| Tab | pause; Tab again resumes |
| ⌘S, ⌘E, ⌘Q | save the game, end it, quit |

Configure… in the Options menu changes the keys.
When mouse controls are enabled, a click on the game screen in your browser captures the pointer and Escape releases it.

The Joystick control option is for old-school Macintosh joysticks that acts as a mouse, like the [Gravis MouseStick](https://www.computinghistory.org.uk/det/6748/Gravis-MouseStick/).
It is not for modern gamepads.

Options > Controls adds two new control methods:

- Gamepad: play with a gamepad that your browser supports through the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API).
  You may need to press a button for the gamepad to be recognized.
  The gamepad has a fixed control configuration.
  The D-pad or the left stick directs flight, the bottom and left face buttons boost, the right and top face buttons fire bands, and Start pauses.
- Virtual Gamepad: displays virtual buttons beside the game screen for touch screens.
  The buttons can be clicked, too.
  Configure… lets you change whether the arrows are on the left, on the right, or apart.
  Apart puts ← and band on the left and boost and → on the right; a thumb on the gap between two buttons presses both.

The keyboards keys also work with both of these options.
For more about the controls, see Glider's own Help screens (also in the Options menu).

Quitting Glider goes to a Finder-esque desktop with three icons: Glider, the Room Editor, and a link to the source code repository.
(Finder isn't reimplemented.)

Browser-specific operations are accessed through the desktop menus:

- File > Import Files… puts houses, art, and saved games on the "disk".
  Import is possible in the following formats: MacBinary, AppleSingle, StuffIt, Compact Pro, disk images (DiskCopy 4.2 or bare HFS), and ZIP archives of them.
- File > Export Files… saves your saved games, houses, high scores, and preferences as a ZIP file, which Import reads back.
- Special > Reset Preferences and Scores… restores Glider's preferences and the high scores of the houses that came with it.

What you change is kept in the browser's storage ([IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)).
Export Files… can act as your backup.

![The desktop on the Mac Plus](docs/images/2026-10-19-desktop/09-port-desktop-plus.png)

## Additions and changes

The port adds several features to Glider 4.05.

- Options > Display & Keyboard: choose how the game looks and controls.
  The options are: a black-and-white Mac Plus (512&times;342) with its own keyboard, a Mac II in 16 colors or in black and white (640&times;480), or the visuals of _Glider for Windows_ (1994) in 16- or 256-color mode with the rest from the Mac II.
  Switching between color and B&W quits and restarts the game.
  You will be prompted to save like when you choose Quit in the menu.
- Options > Scale: the largest size that fits the window by default, or the largest whole number of pixels per Mac pixel, or a size you choose.
  A size between whole numbers is drawn sharp: each Mac pixel enlarged to the next whole number, then shrunk smoothly to fit.
  Sizes that do not fit are dimmed.
- Options > Art: choose the art files on the disk, the original's and any you import.
  The other kind (color or black and white) is dimmed.
  Glider and the Room Editor each has their own separate setting.
- Bass Beat: a feature backported from _Glider for Windows_.
  Disabling it silences the bass during play.
  The jingle on entering a room is unaffected.
  Unlike on Windows, this setting is on by default because the Mac game plays the bass.
- Preferences for each Mac: the Mac Plus and the Mac II each keep their own copy of Glider's preferences.
  (Just the preferences.
  Houses and saved games are shared.)

## Startup

This Unofficial Web Edition starts the game by default.
It includes a simple desktop for switching between Glider and the Room Editor and going to the source repository.
You can also change what happens on startup by appending a query to the URL:

- `?startup=desktop` starts on the desktop.
- `?machine=plus` (or `ii`, `ii-bw`, `win-16`, `win-256`) chooses the machine.
- `?scale=2` sets the scale in device pixels per Mac pixel; `0` is the largest that fits and `-1` the largest whole number that fits.

The browser remembers the machine and the scale you choose in the menus.

## Known bugs and quirks

The port keeps most of the original's bugs in order to play as the original did.
These are the ones you are likely to encounter:

- Try Glider leaves a trail.
  In the Room Editor, the glider sprite, and just that sprite, isn't erased before it's redrawn.
  It leaves a trail of copies until the flight ends.
  On a black-and-white screen its shadow smears along the floor.
  The editor's flight omits the erase code that is present in the game, so it may be on purpose to show the flight path.
- The "New keyboard" message on the Mac Plus.
  The first time Glider starts on the Mac Plus it says "New keyboard. Switching to default keyboard controls." and steers with comma and period, Return, and space.
  Its preferences were saved with another keyboard.
- Art from other releases looks wrong.
  Glider 4.05 moved its sprites to new places in the art file, so art files from 4.02 and 4.04 ("Art 16" and "Art 2") show the wrong pieces of the sprites.
- Locked houses stay locked.
  The Room Editor will not open a locked house, and locking one in House Info… cannot be undone.
  The game's default The House and most of the other houses that come with the port are locked;
  The House (July 1991), John Calhoun's working copy, is unlocked.
  You can open it to see how a house is made.
- Hands-off House dies at Shockproof!.
  Ward Hartenstein's house plays itself but relies on the timing of the level designer's machine to get it right.
  The port flies it as the original game does on a fast Mac.
  The glider gets through twelve rooms and is unceremoniously fried by the outlets of room 13 until the game ends.
  The reason behind this is that the outlets keep time by the clock, while the glider moves once per frame.
  On a slow Mac, a frame can last longer than its normal 2 clock ticks because drawing it takes longer.
  The original at a Mac Plus's own speed takes 2 to 5 ticks a frame and completes the whole house.
- The bass. With Music on, Glider plays a bass "duh-dum" through play, faster the longer you stay in a room. Bass Beat (above) turns it off.
- Time stops when you tab out.
  The Mac's clock follows the browser's while the page is in view and stops when it is hidden.
  Switching tabs pauses the game.

## The porting process

The port achieved its level of fidelity by using an [oracle](https://en.wikipedia.org/wiki/Oracle_machine), a black box to test against that gives you the right answer for whatever input you feed it.
(Programmers may know this idea as _differential_ or [_golden-master testing_](https://en.wikipedia.org/wiki/Characterization_test).)
Here, the oracle is the original Glider running on an emulated Mac.
The idea was singled out by Claude Opus 5.5 as the most important idea in the notes on [porting Starlark to Python](https://dbohdan.com/starlark-python), where a corpus of conformance tests played this role.
Glider came without tests of its own and the Mac's system software had no pixel-level specification, but the original program still ran, so the program became its own specification.

The oracle is Glider 4.06 (the release nearest the ported 4.05 source, with 4.05's code used where the two differ) on a modified headless deterministic [Mini vMac](https://www.gryphel.com/c/minivmac/), an emulator of the Mac Plus and the Mac II.
The emulator runs only in development.
No Mac ROMs or System software are present in this repository or on the page.

Every test case is a script of key presses and mouse events (moves and clicks) at given ticks.
(A tick is a sixtieth of a second, the Mac's clock.)
The oracle plays the script on the original and records the screen and the sound; the port plays the same script.
The two must match exactly: every pixel of every screenshot and the sound tick by tick.
When they differ, the original is measured before the port is changed.
This means gathering traces of when the Mac registered each key, which Toolbox routines the program called, and what was in memory.
Each behavior the port has beyond John Calhoun's source says in a comment how it was measured in the oracle.
This is also how a preserved bug is told apart from a new one: if the original does it, the port must too.

## Building

The port needs Node.js 24.

```sh
make            # type-check, lint, and test
make build      # the page, in dist/
make serve      # serve dist/ at http://localhost:8000/
```

Most of the game and Toolbox tests compare the port with oracle runs, and skip themselves until the oracle has run.
`make oracle` fetches its inputs (ROMs, System 6.0.8, Glider 4.06) and builds the emulator; [`oracle/README.md`](oracle/README.md) documents the rest.
[`AGENTS.md`](AGENTS.md) is how to work on the port.
[`PORT.md`](PORT.md) records the decisions made and holds a roadmap and a journal of how the port was made.
The [galleries](docs/images/README.md) recall the port's history in screenshots.

Every push to `master` is checked, without the oracle, and deployed to GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

## The repository

John Calhoun's original sources, as released:

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

The game is complete and matches the original on the Mac II and the Mac Plus.
The roadmap is in [`PORT.md`](PORT.md).

## Credits and licenses

- _Glider 4.0_ by John Calhoun, published by Casady & Greene.
  The game source was released under the MIT License ([`LICENSE`](LICENSE)) in 2016.
  The same license covers this repository except where noted below.
- The More Glider houses: Mad House by John Calhoun; the others by Jeff Carter, Brian Eaton, Tony Korlath and Steve Sullivan.
- Fonts: Ozma and Glinda are Apple's bitmap fonts Chicago 12 and Geneva 9 and 12, copied pixel for pixel and renamed.
  We copied them from the System file of [Executor 2000](https://github.com/autc04/executor), whose MIT License covers Executor's code.
  We use the glyphs because we believe they are in the public domain, for different reasons in different places:
  - United States: typeface designs are not copyrightable (37 CFR 202.1(e); *Eltra Corp. v. Ringer*, 1978).
    Since 1988 the Copyright Office has held that "data that merely represents an electronic depiction of a particular typeface or individual letterform" is not registrable (53 FR 38110), and its 1992 rule restates that "digitized typeface as typeface is unregistrable" while registering the programs that generate typefaces ([57 FR 6201](https://archives.federalregister.gov/issue_slice/1992/2/21/6201-6203.pdf)).
    Outline fonts were protected in *Adobe Systems v. Southern Software* (1998) as programs whose choice of points was creative.
    A bitmap font has no program and no points: it is a picture of each letter and its width.
  - United Kingdom: copying a typeface is free 25 years after it was first marketed (Copyright, Designs and Patents Act 1988, s. 55).
    Chicago and Geneva date from 1984.
  - European Union: design rights, and Germany's protection of typefaces, end after 25 years at most.
  - This is the project's reading of the law, not legal advice.
- The Source Code icon holds the branch mark of [Jason Long's Git logo](https://git-scm.com/downloads/logos) ([CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)).
- Earlier work: [kodogo/Glider](https://github.com/kodogo/Glider) ported Glider 4.0's source to JavaScript before this port, which was made independently of it.
- The oracle runs [Mini vMac](https://www.gryphel.com/c/minivmac/), from [Infinite Mac](https://github.com/mihaip/infinite-mac)'s fork, on the ROMs and System software Infinite Mac hosts.
- The archive readers were written from the formats as [The Unarchiver](https://github.com/MacPaw/XADMaster) reads them and checked against it and [hfsutils](https://www.mars.org/home/rob/proj/hfs/).
