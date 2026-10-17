# Glider 4 versions and their differences

Notes on the versions of Glider 4.0 and its Room Editor that were available for comparison with the sources in this repository.
"Repo" means the files in this repository.
Statements marked _inference_ are not verified.

## Sources examined

| Source | Contents |
|---|---|
| This repository | Glider 4.05 source, resources (`Glider.r`), art files, project file with compiled code; Room Editor 1.03 source and resources; 22 house files; 22 kHz sound files |
| [Infinite Mac](https://github.com/mihaip/infinite-mac) `Library/Games/Glider.zip` ("Glider 4.0 Pack") | Glider 4.06 for 68K Macs, Glider 4.09 for PowerPC Macs, Room Editor 1.04, the "More Glider™" add-on disk, 18 houses from the web; resource forks and Finder info preserved |
| [archive.org `win3_Glider40`](https://archive.org/details/win3_Glider40) | Glider for Windows ("Glider/WIN 4.01"), CD build with files dated October 1995 |
| [Macintosh Garden](https://macintoshgarden.org/games/glider-40), examined | `Glider4.02.sit`: Glider 4.02 with "Art 16", "Art 2", a "Demo House", and the MacsBug extension. `Glider_4.04.sit`: Glider 4.04 with Room Editor 1.01. `glider_4_10.zip`: HFS disk images of Glider 4.10 (with Room Editor 1.06 and the third-party Glider Edit 1.1.1) and of the two 800K distribution floppies of Glider 4.07 (with Room Editor 1.04), plus scans of the April 1993 manual, a March 1993 catalog, and the package. `glider_4_manual.pdf`. `ImagineArt_1.sit`. `LaVillaStrangiato.sit` |
| Macintosh Garden, not examined | 4.06 (the Infinite Mac copy was used), the 4.06 demo, 4.09 (the Infinite Mac copy was used), `Glider_42.SIT`, `GliderMacsBug.Hqx`, the More Glider disk image |

## Macintosh Glider timeline

From `Glider Version History` (the copy in the Infinite Mac pack adds 4.06):

| Version | Changes |
|---|---|
| 4.00 | Original release (1991) |
| 4.01 | Renaming "The House" no longer causes repeated alerts; the name is saved in the preferences. Save falls back to Save As if the file is not found. Sound dialog tweaks |
| 4.02 | Hides the menu bar for help screens on the Plus, SE, Classic, and SE/30. Typewriter sound when entering a high-score name |
| 4.03 | 4- or 2-channel sound option. Color menus (`mctb`). Updated publisher address |
| 4.04 | Fixed a spurious "Can't find default house" alert. `SIZE` raised from 880 K to 920 K |
| 4.05 | "Glider™" everywhere. Art files renamed from "Art 16" and "Art 2" to "Color Art" and "B&W Art"; art graphics word-aligned, so older art files display incorrectly. Color animated cursor. The "!Mission Screen Init" is now called "MacsBug". No more screen-depth check at the start of each game. Smarter art file lookup. Screen updated after Quit/Save First/Cancel. **This is the version in the repo.** |
| 4.06 | Fixed trashed screens when opening a house on another volume. Realigned the bounds of the wall switch, thermostat, and power switch, with a check for houses made by Room Editor versions before 1.04 |
| 4.07 | Version string "4.07av", © 1991–93; the application is dated August 1993. Adds an `SMSB` 1 resource (`0004 003A 004D 0029 004C`), presumably sound timing for SMS. Has the high-score dialog, `PICT` 228, and `STR#` 131 changes listed under 4.09 below. _Inference:_ "av" refers to the AV Macs (Quadra 660AV and 840AV) released in July 1993 |
| 4.09 | "Power Macintosh compatible." Patrick Buckland's sound system (SMS) replaced by the Sound Manager because SMS was incompatible with newer hardware: it produced static on Power Macs |
| 4.10 | © 1991–94; the application is dated 9 December 1994. Uses SMS again, with `SMSD` sounds identical to 4.07's, rather than 4.09's Sound Manager. Shares 4.09's `DITL` 129, `PICT` 228, `ALRT` 136, and `GLID` 0, but its `STR#` 131 matches 4.05's. Adds a `SIZE` 1 resource |
| "4.2" | `Glider_42.SIT` on Macintosh Garden; not examined |

The version history file stops at 4.06, so the 4.07–4.10 entries come from comparing resources.

### Room Editor timeline

From `Editor History`:

| Version | Changes |
|---|---|
| 1.00 | Original release |
| 1.01 | "I have no idea what I added to this upgrade!" |
| 1.02 | Handle the `deep` resource mix-up in art files. Updated address. Removed a stray Glider 1.0 panel from the About box |
| 1.03 | Art file renaming, as in Glider 4.05. About… 2.1 library by Jon Wind. Color animated cursor. Smarter art file lookup. Fixed the "glide ratio" bug: the glider flew farther in the editor than in the game. House locking in House Info…. Grease became "operational". **This is the version in the repo.** |
| 1.04 | Realigned switch, thermostat, and power switch bounds (see Glider 4.06). Shipped on the Glider 4.07 floppies, dated July 1993 |
| 1.06 | On the Glider 4.10 disk, dated 9 December 1994; not examined further |

Room Editor 1.01 is bundled with Glider 4.04.
The Glider 4.10 disk also has "Glider Edit 1.1.1" (creator `GlEd`, 1999), a third-party house editor.

### 4.05 (repo) compared with 4.06 and 4.09

Resource comparison of the repo's `Glider.r` with the applications in the Infinite Mac pack:

- **4.06**: Every non-code resource is identical except `Gprf` 128 (preferences) and `vers` 1–2.
  The application also has `CODE` 0–5, `DATA`, `DREL`, `ZERO`, and `LSP ` 2000, which `Glider.r` leaves out, so `Glider.r` is the non-code part of the 4.05 application.
- **4.09**:
  - The 30 `SMSD` sounds are replaced by Sound Manager `snd ` resources 1001–1030. These are byte-identical to `Glider_Sound_Files/snd.r` in the repo, so that folder belongs to the 4.09-era Sound Manager conversion.
  - `ALRT` 136 (the screen-depth alert) changes its stages from `$5555` to `$4444`.
  - `DITL` 129 (high-score name entry) has an empty initial edit text instead of `ABCDE12345FGHIJ67890`.
  - `STR#` 131 item 44 is shortened to "what's a game w/o points?".
  - `PICT` 228 and `GLID` 0 also change.
  - Despite "for PPC Macs", 4.09 is 68K code (`CODE` resources, no `cfrg`) that runs on Power Macs.

### Other versions compared with 4.05

Comparison of the non-code resources of each application with the repo's `Glider.r`:

- **4.02**:
  - Lacks the color cursors (`crsr`) added in 4.05 and the color menus (`mctb`) added in 4.03.
  - The sound dialog (`DLOG` and `DITL` 131) lacks the 4/2-channel radio buttons added in 4.03.
  - `SMSD` 27–30 differ.
  - Strings, alert items, the Apple menu, the About picture (`PICT` 228), and `SIZE` differ.
- **4.04**: lacks the color cursors. Strings, alert items, the Apple menu, and `SIZE` differ.
- **4.07, 4.09, 4.10**: see the timeline above.

All versions from 4.02 on contain the side panels (`PICT` 140 and 141).

### Art files

- **Before 4.05:** `Art 16` (color) and `Art 2` (B&W), from both 4.02 and 4.04, differ from the repo's art only in `PICT` 128 (objects) and 129 (masks).
  This is the word-alignment re-layout the 4.05 history describes, which made old art files display incorrectly.
  The backgrounds are identical.
  `PICT` 130 and 205 in 4.04's `Art 2` could not be parsed by a quick PICT decoder (opcodes `$5F` and `$06`): either damage or opcodes a full PICT player must handle.
- **`Color Art`:** identical from 4.05 through 4.10. Its modification date stays 11 June 1991.
- **4.06 and 4.09 `B&W Art`:** `PICT` 128 and 129 differ from the repo's only at x = 144–161, y = 1–106.
  These are the light switch, thermostat, and power switch cells: the 4.06 realignment.
- **4.07 and 4.10 `B&W Art`:** identical to each other.
  Compared with 4.06, the objects differ in a column at x = 160, y = 227–340 (114 pixels) and the masks at x = 144–161, y = 189–340 (307 pixels).

### Improved Art Files

The More Glider disk (1992) includes `Improved Art Files.sea`, alternative color and B&W art files with "slightly altered" objects (for example a "flying-V" guitar).
They require Glider 4.05 or later.
Glider lets the player pick any art file (`DoOpen(kArtType)`), so art files are a user-replaceable asset.

### Third-party art

ImagineArt 1.2 (Paul Finn, ImagineWare Software, 1993, freeware) is a color art file (type `GLbk`, `deep` resource included) with recolored objects, "green alarm clocks and red rubber bands".
Its read-me calls it the first art file made outside Casady & Greene.

## Manuals

- `glider_4_manual.pdf` (12 pages) and `docs/Manual_1993_April.pdf` from `glider_4_10.zip` (16 two-page spreads; "Manual Revision: June 1991; April 1993") are scans without a text layer.
- The April 1993 manual covers installation, the game and its menus, the Room Editor (building houses, background tiles, the object palette, linking objects and rooms, room conditions, testing), "What's in an Object?", and troubleshooting.

## Houses

### House locking

The Room Editor encodes a house's lock state in the sign of `houseRec.timeStamp`.
On save, it calls `GetDateTime`, which returns seconds since 1904, negative as a signed `LongInt` after 1972.
For an unlocked house, it negates the value.
So a positive `timeStamp` means an unlocked house and a negative one a locked house.
The editor refuses to open houses with `timeStamp <= 0`.
The game only compares `timeStamp` to detect modified houses for saved games, and the demo version requires `timeStamp = 16`.
Decoded dates below use the absolute value.

### The House

There are two revisions:

| Copy | Saved | Lock | Room 26 | Top score |
|---|---|---|---|---|
| Repo | 1991-07-15 | Unlocked | "All the Trappings…" | Todd Prince, 370152 |
| Glider 4.02, 4.04, 4.06, 4.07, 4.09, 4.10 | 1991-06-23 | Locked | "Fan Fun!" | Varies: the 4.02 and 4.04 archives carry a previous owner's scores; the others have "Ozma of OZ!", 214050 |
| Windows `HOUSE.GHS` | 1994-08-12 | Locked | "Fan Fun!" | "Ozma of OZ!", 214050 |

Every shipped copy has the same rooms.
The shipped revision differs from the repo's in four rooms:

- Room 26: a different room.
  The repo's "All the Trappings…" has three floor vents, four cabinets, two shelves, and a clock on background 201.
  "Fan Fun!" has two shelves, two fans, two power switches, a floor vent, and two folded papers (extra gliders) on background 206.
- Rooms 27, 35, and 37: floor vent tops raised (amount 252 → 217, 231 → 201, 120 → 96), which makes the air columns taller.

All three copies have identical rooms otherwise; the 4.06, 4.09, and Windows copies have identical rooms throughout.
The repo's copy is unlocked and dated later.
No shipped version examined (4.02 through 4.10) contains it.
_Inference:_ it is Calhoun's working copy rather than the shipped house.
"The House 2" is identical across the repo, 4.06, and 4.09.

The 4.02 package also has a "Demo House": 10 rooms, unlocked, with `timeStamp = 16`, the value the demo version requires.
Its unused room slots past room 10 still hold data, including a room 26 named "All the Trappings…".

The repo's high-score table for The House also contains many "Ozma" entries, the name that doubles as the cheat code.

### Other houses

- More Glider disk (1992): Mad House 1–2 (by Calhoun); Combo House 1–4; House Full of Stuff 1–2; House Full of Stuff Next Door 1–2; House of Doom; House of the Rising Sun (three parts); Lumpy's Home; Usher House.
  Every one of these in the repo is byte-identical to the More Glider copy, except "House Full of Stuff 2", which has identical rooms but other differences.
  Credited authors: Jeff Carter, Brian Eaton, Tony Korlath, and Steve Sullivan.
- Only in the repo:
  - Glass House 1–2 (1993).
  - Hands-off House (1994).
  - "House of the Rising Sun 1", whose rooms are identical to "House of the Rising Sun": a duplicate first part that links to part 2.
- La Villa Strangiato (Jacob Weber with Joshua Meyer, summer 1993): 37 rooms named after Rush songs ("Time Stand Still", "Red Barchetta", "Freewill", "Xanadu", …).
- Houses from the web (Infinite Mac pack and the Glider 4.10 disk, 18 files): 30-Room House, Andrew's House, Blödelhaus 1–4, House of Ed, Jon's House, Jon's New House, Kent's House, Kent's House Part 2, Phexem as an Architect 1–4, Simplicity Manor, Wacky House of Tedium 1–2.

## Glider for Windows ("Glider/WIN 4.01")

### Identity

- A separate implementation for Windows 3.1 in 386 enhanced mode.
  The About strings say "Glider by john calhoun / Windows version by Gregg Bieser", "Glider 4.01", "© 1994 Casady and Greene, Inc."
- The archive.org files are a CD build dated October 1995.
  The CD also has an autorun launcher (`GLIDERCD.EXE`), a joystick calibration tool (`ENJOY.EXE`), the WaveMix sound mixer DLL, and a Write document, `GLIDER.WRI`.
- No source code is known.

### House files

- Same format as the Mac: the big-endian 13830-byte `houseRec`, read byte for byte, so Mac houses work unchanged.
- Files use DOS 8.3 names (`HOUSE.GHS`, `MAD2.GHS`, …).
  Because each house stores the name of the next file in its chain, Windows adds **Game → Relink House Files**, which walks the user through rewriting the links of houses copied from a Mac.
- The bundled houses are the Mac houses with relinked names.

### Graphics

- Windows 16-color (VGA) palette throughout.
- All art is in the executable as 41 device-independent bitmaps.
- These bitmaps are pure index substitutions of the Mac color art (every pixel maps consistently):
  - the side panels (Mac `PICT` 140/141)
  - the ending farm scene (130)
  - the room backgrounds 201–206, 208, and 209

  The mapping from the Mac's standard 16-color CLUT, every row confirmed by those exactly matching images:

  | Mac color | Windows color |
  |---|---|
  | white | white `#FFFFFF` |
  | yellow | yellow `#FFFF00` |
  | orange, red | red `#FF0000` |
  | magenta, purple | purple `#800080` |
  | blue | blue `#0000FF` |
  | cyan | cyan `#00FFFF` |
  | green, dark green | green `#008000` |
  | brown | dark red `#800000` |
  | tan | olive `#808000` |
  | light gray | light gray `#C0C0C0` |
  | medium gray, dark gray | gray `#808080` |
  | black | black `#000000` |

  Four pairs of Mac colors merge, so the Windows palette has only 12 of its 16 colors in use for converted art.
- Backgrounds 200 and 207 match at 98% and 93%: mostly the same, with edits.
- Reworked:
  - The splash screen: "© 1994".
  - The help screens: 8 bitmaps instead of the Mac's 7.
    Most pages keep the Mac content with reflowed or slightly reworded text; the pages about menus are redrawn to show Windows-style menus with underlined access keys.
  - The stairs: recolored or redrawn (77–87% consistent with the Mac art).
  - The About artwork.
  - The object sheet and its mask, which are re-laid out.
    New sprites include banner-towing paper planes reading "C&G Forever…", "Good Flying Ace!!", and "Gliding Away…"; a cassette with a glider (the flight recorder); and a crumpled glider in the wastebasket.
    The "Game Over" letters and the glider fade masks moved.
- The layout is the same as the Mac color version on a 640×480 screen: a menu bar, then the 512×342 play area centered between the two 64-pixel side panels.
- Shapes the Mac draws in code (tables, shelves, cabinets, window frames, shadows) are drawn with dithered brushes.
  For example, a table top is a 1:1 checkerboard of olive and dark red standing in for the Mac's brown.
  See the screenshots below.

### Screenshots

Captured in 2026 with `scrot` from the archive.org in-browser emulator (DOSBox running Windows 3.1 in Firefox), then cropped.
The PNGs are lossless and use 11–12 colors each.
The archive.org page's own screenshots are cropped 639×412 JPEGs and are not usable for pixel comparisons.

| File | Content |
|---|---|
| [`room-03-under-me.png`](images/windows/room-03-under-me.png) | The House, room 3, with visible air |
| [`room-04-looking-at-you.png`](images/windows/room-04-looking-at-you.png) | Room 4: mirror, shelf, cabinet, battery |
| [`room-05-youre-invited.png`](images/windows/room-05-youre-invited.png) | Room 5: window with lightning, balloon, floating score |
| [`high-scores.png`](images/windows/high-scores.png) | High score table |
| [`high-score-name-entry.png`](images/windows/high-score-name-entry.png) | Name entry for a new high score |

Findings:

- **The emulator runs Windows in 256-color mode.**
  The screenshots contain Windows' static gray (160, 160, 164), which does not exist in 16-color mode.
- **Colors pass through a 6-bit VGA DAC.**
  The screen values are 6-bit DAC levels expanded to 8 bits: 48 → 195, 32 → 130, 40 → 162, 41 → 166.
- **The displayed palette differs from the bitmaps' color tables.**
  Aligning room 3 with its background bitmap shows: dark red `#800000` → (195, 0, 0), olive `#808000` → (195, 195, 0), gray `#808080` → (130, 130, 130), light gray `#C0C0C0` → (195, 195, 195).
  The dark colors are brightened to about `0xC0`, but the grays are not.
  _Inference:_ in 256-color mode the game realizes its own logical palette with brighter dark colors and draws its bitmaps through it, so the bitmaps' own color tables are ignored.
  No such table was found as plain bytes in `GLIDER.EXE`.
  With a 16-color VGA driver a program cannot change the palette, so those players would have seen the standard `0x80` colors.
- **Code-drawn surfaces are dithered**, as noted above.
  Shadows are checkerboard patterns, some using the static gray.
- **The high score table** has the Mac's layout (ring-binder holes, light blue rules, violet margin line, yellow highlight for the new entry) in a different serif font.
- **The name entry dialog is Windows-specific.**
  It is a gray box with a red border, yellow text ("You've earned the 5th spot on the high score list with 2720 points!"), a thumbs-up icon, and the default name "Glider Pilot...".
  The Mac uses `DITL` 129 and the default "Your name here...".
- **The HUD** matches the Mac color HUD in layout: room name in red on black, room number, score in cyan, battery charge in yellow, and the remaining gliders.

### Border graphic origin

The side panels ("Hey!!! Fly a REAL Glider", with paper glider folding steps) already exist in Mac 4.05 as `PICT` 140/141, drawn when the game runs in color.
The 4.05 project file was last modified in February 1992, two years before the Windows version.
So the border originated on the Mac.
Whether it existed before 4.05 is unknown; the 4.02 and 4.04 downloads would show.

### Sound

- 31 WAV resources: 8-bit mono at 22257 Hz, the Mac's 22254.5 Hz rounded.
- Sounds 1–30 are the Mac `SMSD` sounds re-encoded.
  Each WAV is 76 bytes shorter than its Mac sample data, and the data differs from the first byte.
  _Inference:_ trimmed or converted, not edited.
- Sound 31 is new; it has the same length as sound 21 (the score tick).
- Mixing is done by Microsoft's WaveMix library.

### Features not in the Mac version

- **Flight recording and playback.** Strings: "Loitering will NOT be tolerated…The record of your flight up to this point will be saved before the flight recording session ends…", "Switching to 'Hold Key' control mode for recording your flight…", "Can't switch control method during a flight record/playback session…".
- **Real joystick support** through the Windows IBMJOY driver, with calibration checks, an "Invert Joystick Directions" option, and the `ENJOY.EXE` calibration tool.
- **Three-button mouse support**, with a configurable middle button.
- **Ctrl+S** saves during play.
- Preferences in `GLIDER.INI` instead of a resource in the application.
- A "Minimize Glider Window" command.

### Menus

- System menu: Show Help Screens; About Glider/WIN; Minimize Glider Window.
- Game: New Game; End Game; Load House; Relink House Files; Open Saved Game; Save Game (Ctrl+S); Save Game As; Exit.
- Options: Controls (Hold Keyboard, Drop Keyboard, Mouse, Joystick, Configure); Sound; Air Is Visible; Show High Scores.

The Mac's "Depth Restore" item is gone, and the Windows menus show no shortcut other than Ctrl+S.
The title-screen strings replace "In color on color machines. / Balloon Help for System 7. / Multichannel sounds on all machines." with "Keep your favorite Glider for Mac houses by transferring to PC disks. / Enhance your flight with sound on most WAV compatible sound cards."
