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
./setup_t -t lx64 -api xwn -sound 0 -speed a "$@" > setup.sh
sh setup.sh > setup.log
sed -i '/X11/d' cfg/CNFUIOSG.h
cp "$here/minivmac/OSGLUHDL.c" src/OSGLUXWN.c
sed -i -e 's|-L/usr/X11R6/lib -lX11||' -e '/^\tstrip /d' Makefile
make -s > make.log 2>&1 || { cat make.log; exit 1; }
