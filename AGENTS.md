# Working on the Glider 4 port

How to work on this project: methods that have proven themselves, and traps that have cost time.
`PORT.md` has the goal, the settled decisions (do not relitigate them without discussing them first), the translation conventions, the roadmap, and the journal.
`oracle/README.md` explains the emulator oracle.

## Basics

- `make check lint test` before every commit; it needs Node 24.
  The game and Toolbox tests compare against oracle runs in `oracle/cache/`, and skip themselves when the oracle has not run (`make oracle`, then `node oracle/main.ts shoot CASE...`).
  The browser test (`test/browser/`) loads the built page in Chromium (`make test` builds it first), Playwright's own or the one at `$CHROMIUM` or `$PLAYWRIGHT_BROWSERS_PATH/chromium`, and skips itself without one.
- Check the page's defaults, not only the settings being worked on: a fresh browser with nothing kept, on a laptop at 1 device pixel to a CSS pixel as well as on a phone. A change tried only at fractional scales left the default whole-number scale showing a 300-by-150 corner of the screen.
- Keep `PORT.md`'s journal: what was found, how, and what was wrong before. Methods go here.
- Never commit commercial files (other Glider releases, manuals, ROMs, System software); the oracle setup fetches them.
- Write code like the code around it: Inside Macintosh names for Toolbox routines, the original's names and structure in `src/glider/`, comments that say why.

## The oracle is the specification

- When the port and the original disagree, measure the original before changing the port.
  Every behavior the port adds should be "seen in the oracle", and its comment should say how it was measured.
- Do not fit constants to make a test pass.
  A 5-tick key latency once made every game screenshot match; it was two errors cancelling out (a button flash and the emulator's own timing), and it broke as soon as the scripts changed.
  If a number only works in a narrow range, or two cases want different values, the model is wrong.
- When a screenshot every 30 ticks cannot tell what happened, take one every tick around the event.
  The tools: `Script.traceKeys` (when the Mac saw each key), `Script.traceTraps` (the Toolbox traps the program called, by tick; decode them with a trap-name table), RAM dumps of low-memory globals (`Script.ram`).
  Within a tick, `Script.watch` and `Script.traceApp` give cycles: when a low-memory value changed, and when the program first ran.
- When the original's order within a tick varies from one tick to the next (a race between ADB and the program), no rule will fit: make a case that repeats the situation, confirm it varies, and have the emulator trace the outcome for the harness to follow (GetKeys readings, auto-key events).
- Suspect the measurement too.
  Mini vMac copied the screen partway through each tick, which looked like tearing and like timing errors in the port; the fix was in the oracle's front end, not in the port.
  Run game cases fast enough (`speed(8)`) that the original's computation takes no time, as the port's does.
- A rule that fits one case may not fit the next: keep earlier cases in the tests, and when a new case breaks a rule, look for the rule that fits them all (the transparent-pattern origin went from "inverted for non-rectangles" to "shifted by the shape's bounding box").
- Data can differ where code does not: the oracle's disk had other high scores, other preferences, another keyboard, other parameter RAM. Check the inputs before the code.
  A second run is a new input too: a per-tick run once booted from a disk earlier runs had saved scores to, and its "number 4" in the high-score dialog was chased as a rank bug for a while. `run` now boots a copy. Before explaining a difference, check that the oracle run showing it matches the case's own shots.
- The program can differ too: the oracle runs Glider 4.06, the port follows 4.05's source. 4.06 narrows switches and has other source rectangles, and that looked like a ROM bug. When a difference has no cause in the port, disassemble 4.06's code around the call (its CODE resources; capstone, `pip install capstone`, disassembles 68000 code) and compare it with the 4.05 source. Where they differ, give the oracle's copy 4.05's code (`switches405` in `oracle/cases.ts`).
- To learn exactly what a Toolbox routine in ROM does, read it: its address is in the trap table in low memory (a RAM dump from `$0C00` on the Mac Plus, `$0E00` on the Mac II), and the ROMs are in `oracle/cache/`. Mind the stdlib: a script named `dis.py` shadows Python's `dis` and breaks capstone's import.
- QuickDraw's algorithms are in Apple's 1984 source (Computer History Museum, `102658076_quickdraw_acc.zip`), under a non-commercial license: read it for the algorithm, never copy it into the repository. Check that the ROM still runs it by searching the ROM for the routine's first instructions (the Mac Plus's InitOval and BumpOval are byte for byte the source's), and read its callers too: ovals are painted by DrawArc, which clips each row to the rectangle, not by PutOval. The oval rule fitted to measurements had matched 98.8% of rows; the source's matched all.
- So can the System's own code: PACK 3 (Standard File), CDEF 0 and 1 (buttons, scroll bars) are resources in the oracle's System file (`oracle/cache/system/System.bin`, read with `parseResourceFork`). For a whole package, write a specification from the disassembly first (geometry, drawing order, keys, what is left unmeasured), then the code; Standard File matched on its first comparison but for errors elsewhere.
- The System patches the ROM: on System 6.0.8 the Mac Plus's MenuSelect runs from RAM. To find what a trap really runs, read its address in the trap table of a RAM dump and disassemble the dump there. The Menu Manager hands work to resources too: the menu bar definition (MBDF 0) places menus and submenus, the menu definition (MDEF 0) draws and measures them.
- Libraries the original links can be read too: SMS came as an MPW object file (`Glider_405/Sources/SMSCore.a.o`); parse its records (dictionary, module, contents, references) and disassemble the code with the names they give.
- The emulator is not the specification where it says it approximates: Mini vMac scaled samples for the volume control and starts its Mac II sound chip with a kludge. Read its source where the oracle looks odd, and leave its approximations out of the port and out of the comparison.
- Not every event is in the queue: activate and update events come from the Window Manager's state, survive FlushEvents, and wait for the next GetNextEvent however long that takes. When the original returns an event the port's queue lacks, look there.
- RAM dumps can compare a drawing call's inputs: find the program's offscreen bitmaps in a dump by searching for a row of the port's, then compare them whole.
- Recordings of real hardware are measurements too, even a microphone's: match each 'SMSD' sound against the audio (normalized cross-correlation) to time the program's sounds, and use those it times in frames (a drip, a ball) as clocks. SMS starts sounds on ticks, so true gaps are whole ticks.
- Test cases can be made of game data: a house whose first room holds the objects in question (`houseWith`) measures the original's drawing at every alignment and size.

## Looking at pixels

- Compare pixels, not pictures. Downscaling a screenshot blends dithers: a gray and tan checkerboard wall looked tan, and a "wrong colors" bug was chased that did not exist.
  Crop at full size, scale up with nearest neighbor, or print pixels as characters (one letter per color) side by side with the oracle's.
- Find the first frame that differs, then the first pixel; differences grow and hide their cause.
- Measure positions (bounding boxes of what differs) across frames: a constant offset is timing, a growing one is speed, a pattern phase is alignment.

## Debugging

- A test that boots the port must start from fresh modules, as each oracle run starts from a fresh Mac: Glider's globals live in modules, and a second boot in the same process inherits the first's. The game cases each run in a worker thread (`playCase`) for that reason.
- Trace the port's state at the ticks in question (`host.at(tick, ...)` in a scratch script) rather than reasoning about what it should be.
- A `pgrep -f` or `pkill -f` pattern typed on the command line matches your own shell: the agent's shell is `bash -c "<the whole command>"`, and the pattern is in that string.
  A wait loop on `pgrep -f` never ends, and `pkill -f` kills the shell itself (exit 144).
  Keep such patterns in script files run by path, or wait on a background task, or kill by PID.
- For several long-lived processes (a server, oracle batches) that must be stopped and restarted together, use a supervisor rather than a watcher script: [nitro](https://github.com/leahneukirchen/nitro) builds from source and runs unprivileged.
  Give each service a `run` script that `exec`s the program, so nitro's signal reaches it and not a shell waiting on it.
  Keep `NITRO_SOCK` short (through a symlink if need be): `nitroctl` binds a socket next to it, and Unix socket paths are limited to 108 bytes.
- A scripted edit (a Python `str.replace`, a `sed`) must check that it replaced something: one whose text missed the file's indentation left line breaks measured in one font, and the difference it caused was chased as a measurement.
- A fallback can hide a missing input: window titles were measured in the application font's default size, which the port lacked, so the system font stood in and the titles came out right; adding the font moved them. When a new resource changes old results, look for what was falling back.
- Scratch scripts and data go in the session's scratch directory, not in the repository.
- The session's transcript (`~/.claude/projects/<project>/<session>.jsonl`, one JSON event per line) keeps what earlier context lost: the exact commands, their output, and every image that was looked at, as base64 in the tool results. Pair images with their `Read` calls by `tool_use_id`, not by order, since reads run in parallel. The screenshots in `docs/images/2026-10-17-pictures-oracle-and-first-games/` were recovered this way.
- Keep each stretch of work's screenshots in a gallery, `docs/images/DATE-TOPIC/`: numbered files, and a README that gives each caption (what to look for, and what it turned out to be) before its picture, for a reader who plays the port and wants to know how it was made. Link it from `docs/images/README.md`.
