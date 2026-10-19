# Pictures, the oracle, and the first games, 17 and 18 October 2026

[All galleries](../)

Screenshots from the start of the port up to the first minute of random play: reading Glider's art, building the emulator oracle, measuring QuickDraw with test pictures, the System 6 interface, and the first games against the original (see the journal in [`PORT.md`](../../../PORT.md), from the first entry to "rooms").
They were recovered from the session's transcript, where each image is kept as it was looked at, so they show the oracle and the port as they were then, bugs included.
[`2026-10-18-rooms-and-dialogs/`](../2026-10-18-rooms-and-dialogs/) continues from here.

Most images come in one of three layouts, stated with each:

- **Comparisons** from the tests have three panels: on the left the original (the oracle's Mini vMac), in the middle the port, and on the right a gray copy with the pixels that differ in red.
- **Side-by-side images** from scratch scripts have two panels: on the left the port, on the right the original.
- **Strips** are consecutive screenshots of one run, left to right.

Each caption comes before its picture, numbered as the files are. Click a picture to see it at full size: GitHub shrinks wide ones to fit the page, which blends their dithered pixels, and the details are in single pixels.

In the oracle and in the tests the menu bar shows Apple's logo, as the original does; the port itself shows a diamond (76–78).
Images of Glider for Windows from that time are not here: they are another Glider release; [`windows/`](../windows/) has the ones kept for the Windows look.

## Glider's art and the system font

**01.** The first rendering of a color PICT, Glider's 4-bit sheet of objects (PICT 128 in the color art file). It came out black and white: the PICT parser read the color table wrong.

![Color objects decoded black and white](01-color-objects-decoded-black-and-white.png)

**02.** The same bug in a color room backdrop (PICT 201), almost all black.

![Color backdrop decoded black](02-color-backdrop-decoded-black.png)

**03 and 04.** The two pictures after fixing the color table indexing.

![Color objects](03-color-objects.png)

![Color backdrop](04-color-backdrop.png)

**05.** The color title picture (PICT 210).

![Color title](05-color-title.png)

**06.** Apple's Chicago 12 bitmap font and ChicagoFLF rasterized at 12 pixels, compared on Glider's strings and every glyph. Black is both, red Apple's only, blue ChicagoFLF's only.
Most glyphs differ by a pixel here and there, and one-pixel differences in advance widths (the em dash, `#`, `%`, `\`) shift everything after them in a string. The port uses Ozma, a bitmap font drawn to Chicago's metrics, instead of either.

![Chicago vs chicagoflf](06-chicago-vs-chicagoflf.png)

## The oracle

Mini vMac built headless, with System 6.0.8 and Glider 4.06 on its disk, Glider as the startup application.

**07.** The first boot of the headless Mac Plus, to the Finder (0.12 seconds for 20 emulated seconds).

![System 6 finder headless plus](07-system-6-finder-headless-plus.png)

**08.** Glider's first start in the oracle, ticks 300, 600 and 900. Glider looks for its "MacsBug" file, really an INIT that reserves the Mac Plus's alternate screen for page flipping, and without it asks for it. The oracle's disk now has a stand-in.

![Macsbug alert plus](08-macsbug-alert-plus.png)

**09.** With the stand-in: ticks 300, 600 and 900. Glider's saved preferences name another keyboard than the emulated Mac's, so Glider switches to its default keys and says so.

![New keyboard alert plus](09-new-keyboard-alert-plus.png)

**10.** The alert dismissed by a script: the alert, then the area it covered blank until Glider redraws, then the menu bar.

![Alert dismissed plus](10-alert-dismissed-plus.png)

**11.** A new game started by the script: the hint box, the title dissolving into the first room in blocks, then the room.

![New game dissolve plus](11-new-game-dissolve-plus.png)

**12.** The same alert on the Mac II in color at 640 by 480, with the side panels and Glider's gray alert.

![New keyboard alert mac ii](12-new-keyboard-alert-mac-ii.png)

## Measuring QuickDraw with test pictures

Glider draws its title with `DrawPicture`, so a copy of Glider whose title picture is replaced shows how the ROM draws any picture (the picture oracle).
Glider's own hint box and demo glider are drawn over it.

**13.** An empty test picture in place of the title: what remains is Glider's hint box, a demo glider at the left, and the menu bar.

![Blank test picture plus](13-blank-test-picture-plus.png)

**14.** On the left the real title picture through the picture oracle; on the right a picture with nothing but a black rectangle, which the ROM did not draw.

![Title picture and unclipped rectangle plus](14-title-picture-and-unclipped-rectangle-plus.png)

**15.** Variants of that picture; the ones that set a clip region first draw the rectangle (top left). `DrawPicture` draws nothing until the picture sets a clip region; every real picture does.

![Clipped rectangle variants plus](15-clipped-rectangle-variants-plus.png)

**16 and 17.** When the title settles, with a test picture of one black rectangle: the picture is up by tick 580, before the menu bar, and the hint box and demo gliders come and go over it later. Runs now go 32 times faster and are shot at tick 100.

![Title timing ticks 580 700 plus](16-title-timing-ticks-580-700-plus.png)

![Title timing ticks 780 1000 plus](17-title-timing-ticks-780-1000-plus.png)

**18.** The mask of pixels Glider draws over the picture (black), found by drawing an all-black and an all-white picture; tests ignore those pixels.

![Picture mask plus](18-picture-mask-plus.png)

**19.** The all-black and all-white pictures on the Mac II (halved).

![Black and white references mac ii](19-black-and-white-references-mac-ii.png)

**20.** The first QuickDraw test comparison (three panels). The ROM drew nothing for the rectangle painted in pen mode `srcOr`, where the port treated modes 0 to 7 as pattern modes.

![Pattern modes diff plus](20-pattern-modes-diff-plus.png)

**21.** The ROM drawing shapes and lines in pen modes 0 to 7 over half black: shapes act as pattern modes with a black pattern, and lines draw nothing. Glider uses `srcOr` and `srcXor` as pen modes.

![Pen modes 0 to 7 plus](21-pen-modes-0-to-7-plus.png)

**22 and 23.** Small ovals by the ROM and by the port's first rule, enlarged; some rows differ by a pixel. A grid of every size from 1 by 1 to 24 by 14 then measured the rule.

![Small ovals rom plus](22-small-ovals-rom-plus.png)

![Small ovals port plus](23-small-ovals-port-plus.png)

**24.** A Mac II picture run whose render was solid black: the screenshot was taken before the picture was drawn, with only the side panels up. Faster runs fixed it.

![Picture run full screen mac ii](24-picture-run-full-screen-mac-ii.png)

**25 and 26.** Rounded rectangles (three panels, shrunk, then one row at full size). Rounded rectangles stretch their corner oval's edges, not its region.

![Round rects diff plus](25-round-rects-diff-plus.png)

![Round rect row 144 diff plus](26-round-rect-row-144-diff-plus.png)

**27.** Text in several fonts and in every text mode (three panels). The differences in the digit font's row repeat every 24 pixels, which led to the long-string case.

![Text diff plus](27-text-diff-plus.png)

**28.** The color shapes test on the Mac II (three panels): a shadow polygon drawn over color bars in a transparent mode has its dither in the other phase. The pattern turned out to be inverted for regions that are not rectangles (refined in [`2026-10-18-rooms-and-dialogs/`](../2026-10-18-rooms-and-dialogs/)).

![Color shapes shadow diff mac ii](28-color-shapes-shadow-diff-mac-ii.png)

## The System 6 interface

Screenshots of the original, measured before writing the Window, Menu and Dialog managers, then the first comparisons.

**29.** The alert at full size, measured for its frame and button.

![New keyboard alert full plus](29-new-keyboard-alert-full-plus.png)

**30.** The Mac II at tick 600, while Glider draws its side panels.

![Loading side panels mac ii](30-loading-side-panels-mac-ii.png)

**31 and 32.** The menu bar's rounded corner and the alert's double frame, enlarged.

![Menu bar corner zoom plus](31-menu-bar-corner-zoom-plus.png)

![Alert corner zoom plus](32-alert-corner-zoom-plus.png)

**33.** The original between hints: the hint box is blank white while Glider redraws it.

![Hint box redraw plus](33-hint-box-redraw-plus.png)

**34.** The first room in the oracle's early runs. The zigzag columns above the floor vents are the vents' air, which Glider draws when "Air is Visible" is on; the oracle's disk then had other preferences than 4.05's.

![First room visible air plus](34-first-room-visible-air-plus.png)

**35–38.** Glider's menus in the original: the Game menu, the hierarchical Controls menu, and on the Mac II their colors from `mctb`.

![Game menu plus](35-game-menu-plus.png)

![Controls submenu plus](36-controls-submenu-plus.png)

![Controls submenu mac ii](37-controls-submenu-mac-ii.png)

![Game menu mac ii](38-game-menu-mac-ii.png)

**39, 40, 41 and 42.** Glider's dialogs in the original.

![Sound settings plus](39-sound-settings-plus.png)

![Configure plus](40-configure-plus.png)

![About box plus](41-about-box-plus.png)

![Sound settings mac ii](42-sound-settings-mac-ii.png)

**43.** The first menu comparison (three panels, enlarged): the port's disabled items were dimmed differently, and its background was the desktop pattern, not the title.

![Game menu diff plus](43-game-menu-diff-plus.png)

**44.** The same in color: the port dimmed "Depth Restore is On", which the original leaves enabled on the Mac II.

![Options menu diff mac ii](44-options-menu-diff-mac-ii.png)

**45.** The port's alert text came out in Geneva: the dialog's font was set on the wrong port.

![Alert text in geneva diff plus](45-alert-text-in-geneva-diff-plus.png)

**46.** The port's color alert icon drew white where the original's has its colors.

![Alert icon diff mac ii](46-alert-icon-diff-mac-ii.png)

**47.** The Sound Settings dialog: the port's Cancel button and small arrow buttons were rounded and placed differently.

![Sound settings diff plus](47-sound-settings-diff-plus.png)

## The first games

**48 and 49.** The port's own startup screens, the first time a run reached tick 600; both then matched the oracle pixel for pixel.

![Port startup plus](48-port-startup-plus.png)

![Port startup mac ii](49-port-startup-mac-ii.png)

**50, 51 and 52.** Side by side (port left): the original, at a real Mac Plus's speed, is still on its title when the port's game has begun, and its first room shows visible air.

![Title port and original plus](50-title-port-and-original-plus.png)

![Game start port and original plus](51-game-start-port-and-original-plus.png)

![First room port and original plus](52-first-room-port-and-original-plus.png)

**53 and 56.** With the oracle's CPU sped up, the frames match closely; four of twenty identical. The title differs only in which hint is up.

![Title fast cpu port and original plus](53-title-fast-cpu-port-and-original-plus.png)

![First room fast cpu port and original plus](56-first-room-fast-cpu-port-and-original-plus.png)

**54 and 55.** The glider enlarged, port left: the original's is 3 pixels higher and in another pose, a frame or so behind.

![Glider zoom shot 0 plus](54-glider-zoom-shot-0-plus.png)

![Glider zoom shot 6 plus](55-glider-zoom-shot-6-plus.png)

**57 and 58.** The first steering run: holding the arrow keys did nothing, because after the alert Glider uses its default keys, comma and period.

![Steering keys ignored plus](57-steering-keys-ignored-plus.png)

![Steering keys ignored mac ii](58-steering-keys-ignored-mac-ii.png)

**59, 60, 61 and 67.** Steering with the right keys (three panels): the gliders drift apart, the original's about 17 pixels further left by `left40`. The port pressed keys at a fixed latency; the original's real key timing was needed.

![Steering right20 diff mac ii](59-steering-right20-diff-mac-ii.png)

![Steering left10 diff plus](60-steering-left10-diff-plus.png)

![Steering left40 diff plus](61-steering-left40-diff-plus.png)

![Steering left10 diff mac ii](67-steering-left10-diff-mac-ii.png)

**62–64.** The alert's dismissal tick by tick (three panels). At 901 the original's button flashes, inverting its whole rounded rectangle, frame included; at 904 the port has already redrawn the title while the original still shows the alert.

![Alert dismissal tick 901 diff plus](62-alert-dismissal-tick-901-diff-plus.png)

![Alert dismissal tick 904 diff plus](63-alert-dismissal-tick-904-diff-plus.png)

![Alert dismissal tick 914 diff plus](64-alert-dismissal-tick-914-diff-plus.png)

**65 and 66.** The original alone, one tick per panel: the alert's area is blank for two ticks, then the menu bar and the title come back. The trap trace was written to explain these ticks.

![Original ticks 909 911 plus](65-original-ticks-909-911-plus.png)

![Original ticks 912 914 plus](66-original-ticks-912-914-plus.png)

**68.** A whole game, to the high-score dialog (three panels). The original says "number 4" and shows another name: the oracle played 4.06's house, whose score table differs from the port's. Since then the oracle's scores match the port's (69, 70).

![Tour high score rank diff plus](68-tour-high-score-rank-diff-plus.png)

**69 and 70.** The original's game over and high-score dialog, at shots 40, 50, 60 and 70, 90, 119.

![Tour game over ticks plus](69-tour-game-over-ticks-plus.png)

![Tour high score ticks plus](70-tour-high-score-ticks-plus.png)

**71.** The tour on the Mac II, shot 8: the shelf's shadow. The original draws it as a dither of black and wall gray, the port drew it in tan and black: transparent-mode patterns are aligned differently for shapes that are not rectangles (the rule was refined later).

![Tour shelf shadow diff mac ii](71-tour-shelf-shadow-diff-mac-ii.png)

**72.** The selected name in the high-score dialog: the port inverted the pixel values, which turns gray (index 12) into red (index 3); the original's TextEdit highlights in hilite mode, which swaps the background color with the highlight color.

![Tour name highlight diff mac ii](72-tour-name-highlight-diff-mac-ii.png)

## In the browser

**73.** The port in headless Chromium at the page's scale, after a commit in which the arrow keys did not steer for the user: the browser's Mac II reported another keyboard than the preferences', so Glider switched to comma and period. The browser's Mac II now has an Extended Keyboard.

![Browser alert mac ii](73-browser-alert-mac-ii.png)

**74 and 75.** The first room in the browser, then shrunk. The wall looks tan and the carpet blue, and a "wrong colors" bug was chased; the wall is a gray and tan dither, the floor a dither too, and scaling blended them.

![Browser first room scaled mac ii](74-browser-first-room-scaled-mac-ii.png)

![Browser downscaled wrong colors mac ii](75-browser-downscaled-wrong-colors-mac-ii.png)

**80.** The wall at full size, enlarged by whole pixels: the gray and tan checkerboard.

![Wall dither unscaled mac ii](80-wall-dither-unscaled-mac-ii.png)

**76.** The port's diamond in place of Apple's logo, in color and in black and white.

![Diamond logos](76-diamond-logos.png)

**77 and 78.** The diamond menu pressed.

<img src="77-diamond-menu-mac-ii.png" alt="Diamond menu mac ii"> <img src="78-diamond-menu-plus.png" alt="Diamond menu plus">

**79.** Starting a game from the Game menu rather than ⌘N, the user's path, while the arrow keys still failed for them.

![Browser game menu path mac ii](79-browser-game-menu-path-mac-ii.png)

**81.** After a right arrow sent as xrdp sends it (the keypad's 6 with NumLock off): the glider flew right. The port now takes any event whose `key` is an arrow as that arrow.

![Browser keypad arrow mac ii](81-browser-keypad-arrow-mac-ii.png)

**82.** The original's Controls menu, to find where a script must move the mouse to choose Mouse and Joystick.

![Controls submenu geometry plus](82-controls-submenu-geometry-plus.png)

**83.** A minute of random play: one shot of 180 differed, 14 pixels in a column. It went away when the Plus cases were re-run, so the oracle's shot was stale.

![Wander shot 131 diff plus](83-wander-shot-131-diff-plus.png)
