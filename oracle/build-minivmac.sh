#!/bin/sh
# Builds a headless Mini vMac (see minivmac/OSGLUHDL.c) for the oracle.
#
# Usage: build-minivmac.sh SOURCE_DIR BUILD_DIR SETUP_OPTION...
#
# The build uses Mini vMac's own setup tool, configured for the X11 front end,
# then swaps that front end for the headless one so that X11 is not needed.

set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=$1
out=$2
shift 2

rm -rf "$out"
mkdir -p "$out"
cp -R "$src/src" "$src/setup" "$out/"
cd "$out"
gcc -o setup_t setup/tool.c
# No AutoSlow, which drops the extra speed after 60 ticks without screen changes or input (the
# front end also turns it off at run time). Sound, for the front end to write to a file.
./setup_t -t lx64 -api xwn -sound 1 -speed a -as 0 "$@" > setup.sh
sh setup.sh > setup.log
grep -q 'define WantInitNotAutoSlow 1' cfg/CNFUDOSG.h
sed -i '/X11/d' cfg/CNFUIOSG.h
cp "$here/minivmac/OSGLUHDL.c" src/OSGLUXWN.c
# Let the front end see each A-line trap (Toolbox and OS call) the CPU takes, for trap traces.
# With D0, which holds an OS trap's argument (an event mask for GetOSEvent and OSEventAvail).
sed -i -e '1i extern void ALineTrap(unsigned long pc, unsigned long opcode, unsigned long d0);' \
	-e '/^LOCALIPROC DoCodeA(void)$/,/^}$/ s|^\tException(0xA);|\tALineTrap(m68k_getpc(), do_get_mem_word(V_pc_p), m68k_dreg(0));\n\tException(0xA);|' src/MINEM68K.c
grep -q 'ALineTrap(m68k_getpc(), do_get_mem_word(V_pc_p), m68k_dreg(0))' src/MINEM68K.c
# And each report the ADB mouse gives the Mac (a Mac II's), for mouse traces.
sed -i -e '1i extern void ADBMouseTalked(int dh, int dv, int down);' \
	-e '/(0 != partH) || (0 != partV) || MouseButtonChange) {/a\
					ADBMouseTalked((si4b)partH, (si4b)partV, SavedCurMouseButton);' src/ADBSHARE.h
grep -q 'ADBMouseTalked((si4b)partH' src/ADBSHARE.h
# Sound as the Mac's program wrote it, without Mini vMac's stand-in for the volume control.
sed -i 's|^\t\tif (SoundVolume < 7) {|\t\tif (0) { /* oracle: no volume scaling */|' src/SNDEMDEV.c src/ASCEMDEV.c
test "$(grep -c 'oracle: no volume scaling' src/SNDEMDEV.c src/ASCEMDEV.c | awk -F: '{s += $2} END {print s}')" = 2
# And each key event the ADB keyboard gives, for key traces.
sed -i -e '1i extern void ADBKeyTalked(int evt);' \
	-e 's|^\(\t*\)ADB_DatBuf\[\([01]\)\] = NextADBkeyevt;|&\n\1ADBKeyTalked(NextADBkeyevt);|' src/ADBSHARE.h
test "$(grep -c 'ADBKeyTalked(NextADBkeyevt)' src/ADBSHARE.h)" = 2
sed -i -e 's|-L/usr/X11R6/lib -lX11||' -e '/^\tstrip /d' Makefile
make -s > make.log 2>&1 || { cat make.log; exit 1; }
