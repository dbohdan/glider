# The oracle

The oracle runs the original Glider in an emulated Mac so that the port can be compared with it frame by frame.

- **Emulator:** [Mini vMac](https://github.com/mihaip/minivmac) (Infinite Mac's fork, pinned to a commit) with a headless front end of our own, [`minivmac/OSGLUHDL.c`](minivmac/OSGLUHDL.c).
  The front end has no window, no sound, and no real-time clock: emulated time advances one tick per step as fast as the host allows.
  Input comes from a script and screenshots go to files, so a run depends only on its inputs and repeats exactly.
- **Machines:** a Mac Plus (512×342, black and white) and a Mac II (640×480, up to 16 colors).
- **Software:** the ROMs, System 6.0.8, and Glider 4.06 from [Infinite Mac](https://github.com/mihaip/infinite-mac), pinned to a commit and checked by SHA-256.
  Glider 4.06 is the closest available build to the 4.05 source; see [`docs/versions.md`](../docs/versions.md).
- **Boot disk:** a fresh HFS volume for each run, holding only the System, the Finder, Glider and its files, and any test houses.
  The boot blocks launch Glider at startup without MultiFinder.
  On the Mac Plus, the disk also carries our stand-in for the "MacsBug" file that Glider ships for page flipping (see `alternateScreenFile` in [`Oracle.ts`](Oracle.ts)).

Everything fetched or built goes into `oracle/cache/`, which is never committed.

## Use

The oracle needs Node.js 24, gcc, make, git, and hfsutils (`apt install hfsutils`).

```sh
make oracle          # fetch the inputs and build the emulators
make oracle-shots    # run every case in cases.ts; PNGs go to oracle/cache/runs/
node oracle/main.ts shoot boot
```

A case builds a disk, writes a script with the `Script` class, and runs it.
Scripts count time in ticks (1/60.15 s) from power-on.
A Mac Plus reaches Glider's title screen in about 600 ticks; a run of a few thousand ticks takes well under a second.

## License

`minivmac/OSGLUHDL.c` is derived from Mini vMac and, like it, is under the GNU General Public License, version 2.
It is a build input for a development tool and is not part of the port.
The rest of this directory is under the repository's license.
