# Working on the Glider 4 port

How to work on this project: methods that have proven themselves, and traps that have cost time.
`PORT.md` has the goal, the settled decisions (do not relitigate them without discussing them first), the translation conventions, the roadmap, and the journal.
`oracle/README.md` explains the emulator oracle.

## Basics

- `make check lint test` before every commit; it needs Node 24.
  The game and Toolbox tests compare against oracle runs in `oracle/cache/`, and skip themselves when the oracle has not run (`make oracle`, then `node oracle/main.ts shoot CASE...`).
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
- Suspect the measurement too.
  Mini vMac copied the screen partway through each tick, which looked like tearing and like timing errors in the port; the fix was in the oracle's front end, not in the port.
  Run game cases fast enough (`speed(8)`) that the original's computation takes no time, as the port's does.
- A rule that fits one case may not fit the next: keep earlier cases in the tests, and when a new case breaks a rule, look for the rule that fits them all (the transparent-pattern origin went from "inverted for non-rectangles" to "shifted by the shape's bounding box").
- Data can differ where code does not: the oracle's disk had other high scores, other preferences, another keyboard, other parameter RAM. Check the inputs before the code.

## Looking at pixels

- Compare pixels, not pictures. Downscaling a screenshot blends dithers: a gray and tan checkerboard wall looked tan, and a "wrong colors" bug was chased that did not exist.
  Crop at full size, scale up with nearest neighbor, or print pixels as characters (one letter per color) side by side with the oracle's.
- Find the first frame that differs, then the first pixel; differences grow and hide their cause.
- Measure positions (bounding boxes of what differs) across frames: a constant offset is timing, a growing one is speed, a pattern phase is alignment.

## Debugging

- Trace the port's state at the ticks in question (`host.at(tick, ...)` in a scratch script) rather than reasoning about what it should be.
- A wait loop with `pgrep -f PATTERN` matches its own command line; use a background task instead.
- Scratch scripts and data go in the session's scratch directory, not in the repository.
