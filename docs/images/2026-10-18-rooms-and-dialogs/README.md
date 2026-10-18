# Rooms and dialogs, 18 October 2026

Screenshots from verifying games in other rooms, test rooms, and Glider's dialogs against the oracle (see the journal in `PORT.md`, entries "rooms" onward).
They are the original's screens in the emulator, the port's, and comparisons of the two.

The comparison images have three panels: on the left the original (the oracle's Mini vMac), in the middle the port, and on the right a gray copy with the pixels that differ in red.
In the oracle and in the tests the menu bar shows Apple's logo, as the original does; the port itself shows a diamond.

## CopyBits and CopyMask

- `01-stretch-test-picture-plus.png`: the first test picture of stretched images, drawn by the Mac Plus ROM.
  One 48-by-24 image, copied at many sizes in srcCopy, srcOr and srcBic over a half-black background, measured which source rows and columns the ROM takes for each destination pixel.
  Glider draws its own hint box and demo glider over the picture, which hid some of the copies; the later layout keeps below the hint box, and its image has better-mixed pixels (this one's made 13-pixel runs that left the measurement ambiguous).
- `02-power-switch-test-room-plus.png`: a test room of 16 power switches, one at each alignment to a 16-pixel word, on the Mac Plus original.
  Every switch lost its right two columns. The ROM's CopyMask was suspected and disassembled, but the cause was Glider 4.06: it narrows switches to 16 pixels, which 4.05 does not. The oracle's copy now gets 4.05's code.

## Transparent patterns on the Mac II

- `03-cabinet-shadow-mac-ii.png`: room 9. The cabinets' shadows (red) have their gray in the other phase in the port.
  The port shifted transparent patterns by the shape's bounding box; regions turned out not to be shifted at all.
- `04-table-shadow-mac-ii.png`: room 15. The port's oval shadow under the table is solid black: its gray falls between the floor's dark pixels instead of on them.
  Ovals and polygons turned out to have their pattern's bits inverted.
- `05-one-dot-pattern-mac-ii.png`: the Mac II ROM painting regions with a pattern of one dot in each 8 by 8 cell.
  Dots appear in a single column (x = 408) and nowhere else, so non-gray patterns in regions are rendered sparsely by the ROM; Glider only uses gray. (The black shapes at the left and the box at the top right are Glider's demo glider and hint box.)

## Input timing

- `06-dark-room-key-timing-mac-ii.png`: room 27 with the lights off. The port's glider is 5 pixels from the original's: the port turned it a frame later.
  The key came over ADB and the original read it in the same tick, which led to the emulator's new traces of ADB key events and GetKeys readings.
- `07-high-score-dialog-plus.png`: the high-score dialog on the Mac Plus original, during random play from room 15.
  The name field shows the last name selected; typing over a selection shows the caret at once and restarts its blinking, which the port did not do.

## Dialogs on the Mac II

- `08-configure-squeezed-port-mac-ii.png`: the Configure dialog. The port's (middle) is blank, with its items squeezed into a strip at the left: the dialog has no 'dctb', so its port is an old-style GrafPort, and the port drew it at one bit per pixel into four-bit screen memory. Color QuickDraw draws such ports through the screen's pixel map.
  (Regenerated afterwards by turning the fix off for one run.)
- `09-configure-unpatched-4.06-mac-ii.png`: the same dialog in an unmodified Glider 4.06 on the oracle, taken while ruling out the oracle's changes to 4.06. The original was never wrong here: the comparison's panels had been read backwards.
- `10-configure-black-and-white-icons-mac-ii.png`: after that fix, the port's key icons are black and white where the original uses the 'cicn' resources of the same IDs, even though the dialog is not a color window.
- `11-about-box-icons-mac-ii.png`: the About box. The port drew two of the icons in its picture as white squares: they are one-bit color icons, which the original draws in their color tables' colors.
- `12-help-screen-colorizing-mac-ii.png`: the first help screen. Glider copies it with a cyan background color, and the original colorizes the pixels, (value AND fore) OR (NOT value AND back); the port copied them unchanged.

## A rank on the Mac II

Still unexplained when these were taken.

- `13-high-score-list-mac-ii.png`: the high scores after random play from room 35. Two pixels differ: the second entry's name has one more period in the port.
- `14-high-score-dialog-number-4-original-mac-ii.png` and `15-high-score-dialog-number-2-port-mac-ii.png`: the dialog before it, tick 2572. With the same score, 3308, the original on the Mac II says "number 4", the port "number 2".
- `16-high-score-dialog-number-2-original-plus.png`: the Mac Plus original, in the same game, says "number 2".
- `17-high-score-list-top-original-mac-ii.png`: the top of the original's list afterwards, enlarged: the score is second, as "number 2" would have it. Glider 4.06's SortHiScores is the same as 4.05's, so the rank variable held 3 for some other reason.
