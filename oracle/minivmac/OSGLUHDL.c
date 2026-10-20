/*
	OSGLUHDL.c

	Copyright (C) 2009 Paul C. Pratt (OSGLUESC.c, from which this
	file descends), and the Glider 4 port contributors

	You can redistribute this file and/or modify it under the terms
	of version 2 of the GNU General Public License as published by
	the Free Software Foundation.  You should have received a copy
	of the license along with this file; see the file COPYING.

	This file is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	license for more details.
*/

/*
	Operating System GLUe, HeaDLess

	A Mini vMac front end with no window, no sound, and no real-time
	clock. Emulated time advances one tick per main loop iteration, as
	fast as the host allows, so a run is a pure function of the ROM,
	the disk images, and the script.

	Usage: minivmac-hdl ROM SCRIPT DISK...

	The script is read line by line. Blank lines and lines starting
	with '#' are ignored. Commands:

		w N          run N ticks
		k CODE 0|1   release or press the key with Mac key code CODE
		b 0|1        release or press the mouse button
		m H V        move the mouse to (H, V) in global coordinates
		d DH DV      move the mouse by (DH, DV)
		s PATH       write the screen as the last tick left it to PATH
		             (PBM for 1 bit per pixel, PPM otherwise)
		r ADDR N PATH
		             write N bytes of RAM starting at ADDR to PATH
		t            print the tick count and the Mac's Ticks global
		keys 0|1     stop or start printing "keymap TICK HEX": the Mac's
		             KeyMap ($174, 16 bytes) now, and then at the end of
		             each tick in which it changed, where TICK counts
		             ticks as w does; and "adbkey TICK EVT AT" for each
		             key event the ADB keyboard (a Mac II's) gives the
		             Mac: its key code, plus $80 for a release, and how
		             many CPU cycles into the tick it came; and
		             "getkeys TICK HEX" when the program's GetKeys first
		             returns a new KeyMap; and "mbstate TICK HEX", low
		             memory MBState ($172, the button as the ROM has
		             taken it: 0 down, $80 up), now and then at the end of
		             each tick in which it changed
		mouse 0|1    stop or start printing "adbmouse TICK DH DV DOWN AT"
		             for each report the ADB mouse (a Mac II's) gives the
		             Mac in tick TICK: its movement, its button, and how
		             many CPU cycles into the tick it came
		traps 0|1    stop or start printing "trap TICK PC OPCODE [xN]"
		             for each A-line trap called from RAM (the program
		             and the System's patches) in tick TICK (the one
		             being run; ticks are counted from 1), N times in a
		             row
		c            print the color table (index, then red, green, blue
		             as 16-bit values), if the screen has colors
		speed N      run 2^N times the instructions per tick (default 0)
		date SECS    set the clock (seconds since 1904, default 1992-02-01)
		q            quit

	Numbers may be decimal or hexadecimal with a 0x prefix.
	The program quits at the end of the script.
*/

#include "OSGCOMUI.h"
#include "OSGCOMUD.h"

#ifdef WantOSGLUXWN

/* --- some simple utilities --- */

GLOBALOSGLUPROC MyMoveBytes(anyp srcPtr, anyp destPtr, si5b byteCount)
{
	(void) memmove((char *)destPtr, (char *)srcPtr, byteCount);
}

/* --- control mode, parameter buffers and internationalization --- */

#include "INTLCHAR.h"

#define WantColorTransValid 1

#include "COMOSGLU.h"

#include "PBUFSTDC.h"

#include "CONTROLM.h"

/* --- text translation (names are ASCII here) --- */

#if IncludePbufs
LOCALFUNC tMacErr NativeTextToMacRomanPbuf(char *x, tPbuf *r)
{
	if (NULL == x) {
		return mnvm_miscErr;
	} else {
		ui5b L = strlen(x);
		ui3p p = (ui3p)malloc(L + 1);
		ui5b i;

		if (NULL == p) {
			return mnvm_miscErr;
		}
		for (i = 0; i < L; ++i) {
			p[i] = (10 == x[i]) ? 13 : x[i];
		}
		return PbufNewFromPtr(p, L, r);
	}
}
#endif

/* --- drives --- */

LOCALVAR FILE *Drives[NumDrives];
#if IncludeSonyGetName || IncludeSonyNew
LOCALVAR char *DriveNames[NumDrives];
#endif

LOCALPROC InitDrives(void)
{
	tDrive i;

	for (i = 0; i < NumDrives; ++i) {
		Drives[i] = NULL;
#if IncludeSonyGetName || IncludeSonyNew
		DriveNames[i] = NULL;
#endif
	}
}

GLOBALOSGLUFUNC tMacErr vSonyTransfer(blnr IsWrite, ui3p Buffer,
	tDrive Drive_No, ui5r Sony_Start, ui5r Sony_Count,
	ui5r *Sony_ActCount)
{
	tMacErr err = mnvm_miscErr;
	FILE *f = Drives[Drive_No];
	ui5r n = 0;

	if (0 == fseek(f, Sony_Start, SEEK_SET)) {
		if (IsWrite) {
			n = fwrite(Buffer, 1, Sony_Count, f);
		} else {
			n = fread(Buffer, 1, Sony_Count, f);
		}
		if (n == Sony_Count) {
			err = mnvm_noErr;
		}
	}
	if (nullpr != Sony_ActCount) {
		*Sony_ActCount = n;
	}
	return err;
}

GLOBALOSGLUFUNC tMacErr vSonyGetSize(tDrive Drive_No, ui5r *Sony_Count)
{
	FILE *f = Drives[Drive_No];

	if (0 != fseek(f, 0, SEEK_END)) {
		return mnvm_miscErr;
	}
	*Sony_Count = ftell(f);
	return mnvm_noErr;
}

LOCALFUNC tMacErr vSonyEject0(tDrive Drive_No, blnr deleteit)
{
	DiskEjectedNotify(Drive_No);

	fclose(Drives[Drive_No]);
	Drives[Drive_No] = NULL;

#if IncludeSonyGetName || IncludeSonyNew
	{
		char *s = DriveNames[Drive_No];
		if (NULL != s) {
			if (deleteit) {
				remove(s);
			}
			free(s);
			DriveNames[Drive_No] = NULL;
		}
	}
#endif

	return mnvm_noErr;
}

GLOBALOSGLUFUNC tMacErr vSonyEject(tDrive Drive_No)
{
	return vSonyEject0(Drive_No, falseblnr);
}

#if IncludeSonyNew
GLOBALOSGLUFUNC tMacErr vSonyEjectDelete(tDrive Drive_No)
{
	return vSonyEject0(Drive_No, trueblnr);
}
#endif

LOCALPROC UnInitDrives(void)
{
	tDrive i;

	for (i = 0; i < NumDrives; ++i) {
		if (vSonyIsInserted(i)) {
			(void) vSonyEject(i);
		}
	}
}

#if IncludeSonyGetName
GLOBALOSGLUFUNC tMacErr vSonyGetName(tDrive Drive_No, tPbuf *r)
{
	char *drivepath = DriveNames[Drive_No];
	char *s;

	if (NULL == drivepath) {
		return mnvm_miscErr;
	}
	s = strrchr(drivepath, '/');
	return NativeTextToMacRomanPbuf((NULL == s) ? drivepath : s + 1, r);
}
#endif

LOCALFUNC blnr Sony_Insert1(char *drivepath)
{
	tDrive Drive_No;
	FILE *f = fopen(drivepath, "r+b");

	if (NULL == f) {
		fprintf(stderr, "cannot open disk image %s\n", drivepath);
		return falseblnr;
	}
	if (! FirstFreeDisk(&Drive_No)) {
		fprintf(stderr, "too many disk images\n");
		fclose(f);
		return falseblnr;
	}
	Drives[Drive_No] = f;
	DiskInsertNotify(Drive_No, falseblnr);
#if IncludeSonyGetName || IncludeSonyNew
	DriveNames[Drive_No] = strdup(drivepath);
#endif
	return trueblnr;
}

/* --- ROM --- */

LOCALFUNC blnr LoadMacRom(char *path)
{
	blnr v = falseblnr;
	FILE *f = fopen(path, "rb");

	if (NULL == f) {
		fprintf(stderr, "cannot open ROM %s\n", path);
	} else {
		if (kROM_Size != fread(ROM, 1, kROM_Size, f)) {
			fprintf(stderr, "short ROM %s\n", path);
		} else {
			v = (mnvm_noErr == ROM_IsValid());
		}
		fclose(f);
	}
	return v;
}

/* --- video out --- */

GLOBALOSGLUPROC DoneWithDrawingForTick(void)
{
	/* The frame is in screencomparebuff; nothing to show. */
	ScreenChangedTop = vMacScreenHeight;
	ScreenChangedBottom = 0;
	ScreenChangedLeft = vMacScreenWidth;
	ScreenChangedRight = 0;
}

/*
	The emulator copies the screen after the first part of each tick,
	before the extra instructions that a higher speed runs; this copies
	it again, so that a screenshot shows the whole tick's drawing.
*/
IMPORTPROC Screen_EndTickNotify(void);

LOCALFUNC blnr WriteScreenFile(char *path)
{
	FILE *f = fopen(path, "wb");
	int x;
	int y;

	if (NULL == f) {
		fprintf(stderr, "cannot write %s\n", path);
		return falseblnr;
	}
#if 0 != vMacScreenDepth
	if (UseColorMode) {
		int bpp = 1 << vMacScreenDepth;
		int ppb = 8 / bpp;

		fprintf(f, "P6\n%d %d\n255\n", vMacScreenWidth, vMacScreenHeight);
		for (y = 0; y < vMacScreenHeight; ++y) {
			ui3p row = screencomparebuff + y * vMacScreenByteWidth;
			for (x = 0; x < vMacScreenWidth; ++x) {
				int i;
				if (bpp >= 8) {
					i = row[x];
				} else {
					int shift = (ppb - 1 - (x % ppb)) * bpp;
					i = (row[x / ppb] >> shift) & ((1 << bpp) - 1);
				}
				fputc(CLUT_reds[i] >> 8, f);
				fputc(CLUT_greens[i] >> 8, f);
				fputc(CLUT_blues[i] >> 8, f);
			}
		}
	} else
#endif
	{
		/* Mac and PBM agree: 1 is black, rows are packed MSB first. */
		fprintf(f, "P4\n%d %d\n", vMacScreenWidth, vMacScreenHeight);
		fwrite(screencomparebuff, 1,
			vMacScreenMonoByteWidth * vMacScreenHeight, f);
	}
	(void) x;
	(void) y;
	fclose(f);
	return trueblnr;
}

/* --- sound --- */

#if MySoundEnabled

/*
	The emulated Mac's sound (8-bit samples, 22255 a second, 370 a tick)
	goes to a file while the script asks ("sound PATH"; "sound" stops),
	to compare the port's sound with the original's.
*/
LOCALVAR FILE *SoundFile = NULL;
#define kSoundBuffLen 1024
LOCALVAR trSoundSamp SoundBuff[kSoundBuffLen];

GLOBALOSGLUFUNC tpSoundSamp MySound_BeginWrite(ui4r n, ui4r *actL)
{
	*actL = (n < kSoundBuffLen) ? n : kSoundBuffLen;
	return SoundBuff;
}

GLOBALOSGLUPROC MySound_EndWrite(ui4r actL)
{
	if (NULL != SoundFile) {
		(void) fwrite(SoundBuff, sizeof(trSoundSamp), actL, SoundFile);
	}
}

LOCALPROC StopSoundFile(void)
{
	if (NULL != SoundFile) {
		fclose(SoundFile);
		SoundFile = NULL;
	}
}

#endif

/* --- time, date, location --- */

LOCALVAR ui5b TrueEmulatedTime = 0;

#define MyInvTimeStep 16626 /* microseconds per tick, 1000000 / 60.14742 */

LOCALVAR ui5b StartMacDate = 2779747200UL; /* 1992-02-01 00:00:00 */

LOCALPROC UpdateMacDate(void)
{
	CurMacDateInSeconds = StartMacDate
		+ (ui5b)(((unsigned long long)TrueEmulatedTime * MyInvTimeStep)
			/ 1000000);
}

LOCALFUNC blnr InitLocationDat(void)
{
	UpdateMacDate();
	return trueblnr;
}

/* --- clipboard --- */

#if IncludeHostTextClipExchange
GLOBALOSGLUFUNC tMacErr HTCEexport(tPbuf i)
{
	PbufDispose(i);
	return mnvm_noErr;
}

GLOBALOSGLUFUNC tMacErr HTCEimport(tPbuf *r)
{
	return NativeTextToMacRomanPbuf("", r);
}
#endif

/* --- saved tasks --- */

LOCALPROC CheckForSavedTasks(void)
{
	if (MyEvtQNeedRecover) {
		MyEvtQNeedRecover = falseblnr;
		MyEvtQTryRecoverFromFull();
	}

	if (RequestMacOff) {
		RequestMacOff = falseblnr;
		ForceMacOff = trueblnr;
	}

	if (nullpr != SavedBriefMsg) {
		fprintf(stderr, "message: %s\n", SavedBriefMsg);
		SavedBriefMsg = nullpr;
	}

	if (NeedWholeScreenDraw) {
		NeedWholeScreenDraw = falseblnr;
		ScreenChangedAll();
	}
}

/* --- script --- */

LOCALVAR FILE *ScriptFile = NULL;
LOCALVAR ui5b ScriptLine = 0;
LOCALVAR ui5b WaitTicks = 0;

LOCALFUNC long ScriptNum(char *s)
{
	return (NULL == s) ? 0 : strtol(s, NULL, 0);
}

LOCALPROC ScriptError(char *what)
{
	fprintf(stderr, "script line %lu: %s\n", (unsigned long)ScriptLine,
		what);
	ForceMacOff = trueblnr;
}

/*
	The emulated RAM, which starts at address 0 on the machines
	emulated here. The configuration of the emulated machine is not
	normally visible to the front end.
*/
#include "CNFUDPIC.h"
#include "GLOBGLUE.h"

LOCALFUNC ui5r RamLong(ui5r addr)
{
	return ((ui5r)RAM[addr] << 24) | ((ui5r)RAM[addr + 1] << 16)
		| ((ui5r)RAM[addr + 2] << 8) | RAM[addr + 3];
}

LOCALPROC WriteRamFile(ui5r addr, ui5r n, char *path)
{
	FILE *f;

	if ((addr > kRAM_Size) || (n > kRAM_Size - addr)) {
		ScriptError("address out of range");
		return;
	}
	f = fopen(path, "wb");
	if (NULL == f) {
		ScriptError("cannot write RAM file");
		return;
	}
	fwrite(RAM + addr, 1, n, f);
	fclose(f);
}

/* Whether to print trap calls, and the run of identical calls not yet printed. */
/* 0: no trap trace; 1: the program's traps (code in RAM); 2: every trap, the ROM's too. */
LOCALVAR int TrapTrace = 0;
LOCALVAR unsigned long TrapTick = 0;
LOCALVAR unsigned long TrapPC = 0;
LOCALVAR unsigned long TrapOpcode = 0;
LOCALVAR unsigned long TrapCount = 0;

LOCALPROC FlushTraps(void)
{
	if (0 != TrapCount) {
		if (1 == TrapCount) {
			printf("trap %lu %06lX %04lX\n", TrapTick, TrapPC, TrapOpcode);
		} else {
			printf("trap %lu %06lX %04lX x%lu\n", TrapTick, TrapPC,
				TrapOpcode, TrapCount);
		}
		TrapCount = 0;
	}
}

LOCALPROC TraceGetKeys(void);

LOCALPROC TraceWatches(void);
LOCALPROC TraceAutoKey(void);
LOCALPROC TraceApp(unsigned long tick);

/* Whether to print the KeyMap when it changes, and other key events (see "keys"). */
LOCALVAR blnr KeyMapTrace = falseblnr;

/*
	The ticks in which the program asked the Event Manager for auto-key
	events (GetOSEvent or OSEventAvail with autoKeyMask), when a repeat
	could have come: whether one did tells what came first in the tick.
*/
LOCALVAR unsigned long KeyCheckTick = (unsigned long)-1;

/*
	How many times the program has called TickCount in the tick: a repeat
	made before any came before the program's loop saw the new tick (TEIdle
	reads the clock with TickCount, and whether a caret's blink or a repeat
	comes first in a tick depends on where the loop is as the tick begins).
*/
LOCALVAR unsigned long ClockTick = (unsigned long)-1;
LOCALVAR unsigned long ClockReads = 0;

/* Called by the CPU (see build-minivmac.sh) as it takes an A-line trap. */
void ALineTrap(unsigned long pc, unsigned long opcode, unsigned long d0)
{
	unsigned long tick = (unsigned long)TrueEmulatedTime;

	if (KeyMapTrace && ((0xA030 == (opcode & 0xF8FF)) || (0xA031 == (opcode & 0xF8FF)))
		&& (0 != (d0 & 0x20)) && (tick != KeyCheckTick))
	{
		KeyCheckTick = tick;
		printf("keycheck %lu\n", tick);
		fflush(stdout);
	}

	if (pc < kRAM_Size) {
		TraceApp(tick);
	}

	if (0xA976 == opcode) { /* GetKeys */
		TraceGetKeys();
	}
	TraceWatches();
	TraceAutoKey();
	if (0xA975 == opcode) { /* TickCount */
		if (tick != ClockTick) {
			ClockTick = tick;
			ClockReads = 0;
		}
		++ClockReads;
	}
	/*
		TEKey, which the Dialog Manager calls for each key typed into an
		edit field (repeats too), with the TickCount calls made before it
		in the tick: 0 means the key came before the caret's blink.
	*/
	if (KeyMapTrace && (0xA9DC == opcode)) {
		printf("tekey %lu %lu\n", tick,
			(ClockTick == tick) ? ClockReads : 0UL);
		fflush(stdout);
	}

	if ((2 == TrapTrace) || ((1 == TrapTrace) && (pc < kRAM_Size))) {
		if ((0 != TrapCount) && ((tick != TrapTick) || (pc != TrapPC)
			|| (opcode != TrapOpcode)))
		{
			FlushTraps();
		}
		TrapTick = tick;
		TrapPC = pc;
		TrapOpcode = opcode;
		++TrapCount;
	}
}

/* Whether to print the ADB mouse's reports, and the CPU cycle count when the tick began. */
LOCALVAR blnr MouseTrace = falseblnr;
LOCALVAR iCountt TickStartCount = 0;

/* Called by the ADB mouse (see build-minivmac.sh) as it reports to the Mac. */
void ADBMouseTalked(int dh, int dv, int down)
{
	if (MouseTrace) {
		printf("adbmouse %lu %d %d %d %lu\n",
			(unsigned long)TrueEmulatedTime, dh, dv, down ? 1 : 0,
			(unsigned long)(GetCuriCount() - TickStartCount));
		fflush(stdout);
	}
}

/*
	When the program first reads a new KeyMap with GetKeys: which tick's
	reading saw a key, whenever the key reached the KeyMap in that tick, and
	how many times the program had called GetKeys before in that tick (a key
	the tick's first call missed came in the middle of the tick).
*/
LOCALVAR ui3b LastGetKeysMap[16];
LOCALVAR unsigned long GetKeysTick = (unsigned long)-1;
LOCALVAR unsigned long GetKeysCalls = 0;

LOCALPROC TraceGetKeys(void)
{
	int i;

	if (TrueEmulatedTime != GetKeysTick) {
		GetKeysTick = TrueEmulatedTime;
		GetKeysCalls = 0;
	}
	if (KeyMapTrace && (0 != memcmp(LastGetKeysMap, RAM + 0x0174, 16))) {
		memcpy(LastGetKeysMap, RAM + 0x0174, 16);
		printf("getkeys %lu ", (unsigned long)TrueEmulatedTime);
		for (i = 0; i < 16; ++i) {
			printf("%02x", LastGetKeysMap[i]);
		}
		printf(" %lu\n", GetKeysCalls);
		fflush(stdout);
	}
	++GetKeysCalls;
}

/*
	Memory the script watches ("watch ADDR SIZE"): a value is printed when it
	has changed, as seen at each A-line trap and as each tick begins, with
	the cycles into the tick, to order events within a tick.
*/
#define kMaxWatches 8
LOCALVAR int NWatches = 0;
LOCALVAR ui5r WatchAddr[kMaxWatches];
LOCALVAR int WatchSize[kMaxWatches];
LOCALVAR ui5r WatchLast[kMaxWatches];

LOCALFUNC ui5r WatchValue(int i)
{
	ui5r v = 0;
	int j;

	for (j = 0; j < WatchSize[i]; ++j) {
		v = (v << 8) | RAM[WatchAddr[i] + j];
	}
	return v;
}

LOCALPROC TraceWatches(void)
{
	int i;

	for (i = 0; i < NWatches; ++i) {
		ui5r v = WatchValue(i);
		if (v != WatchLast[i]) {
			WatchLast[i] = v;
			printf("watch %lu %lu %lX %lX\n",
				(unsigned long)TrueEmulatedTime,
				(unsigned long)(GetCuriCount() - TickStartCount),
				(unsigned long)WatchAddr[i], (unsigned long)v);
			fflush(stdout);
		}
	}
}

/*
	Whether to print, for each tick, how many cycles into it the program
	(code in RAM) first called a trap: interrupt work at the start of a tick
	(the vertical blanking task, ADB transactions) runs before it.
*/
LOCALVAR blnr AppTrace = falseblnr;
LOCALVAR unsigned long AppTick = (unsigned long)-1;

LOCALPROC TraceApp(unsigned long tick)
{
	if (AppTrace && (tick != AppTick)) {
		AppTick = tick;
		printf("app %lu %lu\n", tick,
			(unsigned long)(GetCuriCount() - TickStartCount));
		fflush(stdout);
	}
}

/*
	Auto-key events: the Event Manager sets KeyRepTime ($18A) to Ticks when
	it makes one, and the keyboard driver sets it, with KeyLast ($184), when
	a key goes down. A change of KeyRepTime with KeyLast unchanged is a
	repeat; it tells whether a key that came in the same tick came first.
	The line ends with the TickCount calls made before it in the tick.
*/
LOCALVAR ui5r LastKeyRepTime = 0;
LOCALVAR ui4r LastKeyLast = 0;

LOCALPROC TraceAutoKey(void)
{
	ui5r keyRepTime = do_get_mem_long(RAM + 0x018A);
	ui4r keyLast = do_get_mem_word(RAM + 0x0184);

	if (KeyMapTrace && (keyRepTime != LastKeyRepTime)
		&& (keyLast == LastKeyLast) && (0 != keyLast))
	{
		printf("autokey %lu %04X %lu\n", (unsigned long)TrueEmulatedTime,
			(unsigned)keyLast,
			(ClockTick == TrueEmulatedTime) ? ClockReads : 0UL);
		fflush(stdout);
	}
	LastKeyRepTime = keyRepTime;
	LastKeyLast = keyLast;
}

/* Called by the ADB keyboard (patched in) for each key event it gives the Mac. */
void ADBKeyTalked(int evt)
{
	if (KeyMapTrace) {
		printf("adbkey %lu %d %lu\n",
			(unsigned long)TrueEmulatedTime, evt,
			(unsigned long)(GetCuriCount() - TickStartCount));
		fflush(stdout);
	}
}
LOCALVAR ui3b LastKeyMap[16];
LOCALVAR ui3b LastMBState = 0x80;

LOCALPROC TraceKeyMap(blnr always)
{
	int i;

	if (KeyMapTrace && (always || (LastMBState != RAM[0x0172]))) {
		LastMBState = RAM[0x0172];
		printf("mbstate %lu %02X\n", (unsigned long)TrueEmulatedTime, LastMBState);
		fflush(stdout);
	}

	if (KeyMapTrace
		&& (always || (0 != memcmp(LastKeyMap, RAM + 0x0174, 16))))
	{
		memcpy(LastKeyMap, RAM + 0x0174, 16);
		printf("keymap %lu ", (unsigned long)TrueEmulatedTime);
		for (i = 0; i < 16; ++i) {
			printf("%02X", LastKeyMap[i]);
		}
		printf("\n");
		fflush(stdout);
	}
}

/*
	Runs script commands until one asks to let time pass.
	Commands take effect before the next tick is emulated.
*/
LOCALPROC RunScript(void)
{
	char line[1024];

	while (0 == WaitTicks) {
		char *cmd;
		char *a1;
		char *a2;
		char *a3;
		char *nl;

		if (NULL == fgets(line, sizeof(line), ScriptFile)) {
			ForceMacOff = trueblnr;
			return;
		}
		++ScriptLine;
		nl = strchr(line, '\n');
		if (NULL != nl) {
			*nl = 0;
		}
		cmd = strtok(line, " \t");
		if ((NULL == cmd) || ('#' == cmd[0])) {
			continue;
		}
		a1 = strtok(NULL, " \t");
		a2 = strtok(NULL, " \t");
		a3 = strtok(NULL, "");

		if (0 == strcmp(cmd, "w")) {
			WaitTicks = ScriptNum(a1);
		} else if (0 == strcmp(cmd, "k")) {
			Keyboard_UpdateKeyMap(ScriptNum(a1), 0 != ScriptNum(a2));
		} else if (0 == strcmp(cmd, "b")) {
			MyMouseButtonSet(0 != ScriptNum(a1));
		} else if (0 == strcmp(cmd, "m")) {
			MyMousePositionSet(ScriptNum(a1), ScriptNum(a2));
		} else if (0 == strcmp(cmd, "d")) {
			MyMousePositionSetDelta(ScriptNum(a1), ScriptNum(a2));
		} else if (0 == strcmp(cmd, "s")) {
			if (NULL == a1) {
				ScriptError("s needs a path");
			} else if (NULL != a2) {
				ScriptError("paths may not contain spaces");
			} else if (Screen_EndTickNotify(), ! WriteScreenFile(a1)) {
				ScriptError("screen not written");
			}
		} else if (0 == strcmp(cmd, "r")) {
			if (NULL == a3) {
				ScriptError("r needs an address, a count, and a path");
			} else {
				WriteRamFile(ScriptNum(a1), ScriptNum(a2), a3);
			}
		} else if (0 == strcmp(cmd, "t")) {
			printf("tick %lu Ticks %lu\n",
				(unsigned long)TrueEmulatedTime,
				(unsigned long)RamLong(0x016A));
			fflush(stdout);
		} else if (0 == strcmp(cmd, "c")) {
#if 0 != vMacScreenDepth
			int i;
			for (i = 0; i < (1 << (1 << vMacScreenDepth)); ++i) {
				printf("clut %d %04X %04X %04X\n", i,
					CLUT_reds[i], CLUT_greens[i], CLUT_blues[i]);
			}
			fflush(stdout);
#endif
		} else if (0 == strcmp(cmd, "mouse")) {
			MouseTrace = (0 != ScriptNum(a1));
		} else if (0 == strcmp(cmd, "watch")) {
			if ((NULL == a2) || (kMaxWatches == NWatches)) {
				ScriptError("watch needs an address and a size, and takes 8 at most");
			} else {
				WatchAddr[NWatches] = ScriptNum(a1);
				WatchSize[NWatches] = ScriptNum(a2);
				WatchLast[NWatches] = WatchValue(NWatches);
				++NWatches;
			}
		} else if (0 == strcmp(cmd, "app")) {
			AppTrace = (0 != ScriptNum(a1));
		} else if (0 == strcmp(cmd, "traps")) {
			FlushTraps();
			TrapTrace = (int)ScriptNum(a1);
		} else if (0 == strcmp(cmd, "keys")) {
			KeyMapTrace = (0 != ScriptNum(a1));
			TraceKeyMap(trueblnr);
		} else if (0 == strcmp(cmd, "speed")) {
			SpeedValue = ScriptNum(a1);
		} else if (0 == strcmp(cmd, "date")) {
			StartMacDate = (ui5b)strtoul(a1, NULL, 0)
				- (CurMacDateInSeconds - StartMacDate);
			UpdateMacDate();
		} else if (0 == strcmp(cmd, "sound")) {
#if MySoundEnabled
			StopSoundFile();
			if (NULL != a1) {
				SoundFile = fopen(a1, "wb");
				if (NULL == SoundFile) {
					ScriptError("sound file not opened");
				} else {
					/* The next tick's samples come first. */
					printf("sound %lu\n", (unsigned long)TrueEmulatedTime + 1);
					fflush(stdout);
				}
			}
#else
			ScriptError("built without sound");
#endif
		} else if (0 == strcmp(cmd, "q")) {
			FlushTraps();
			ForceMacOff = trueblnr;
		} else {
			ScriptError("unknown command");
		}
		if (ForceMacOff) {
			return;
		}
	}
}

/* --- main program flow --- */

GLOBALOSGLUFUNC blnr ExtraTimeNotOver(void)
{
	/*
		Emulated time never runs out on its own: the amount of
		extra time per tick depends only on SpeedValue.
	*/
	return trueblnr;
}

GLOBALOSGLUPROC WaitForNextTick(void)
{
	CheckForSavedTasks();
	if (ForceMacOff) {
		return;
	}
	TraceKeyMap(falseblnr);
	TraceWatches();
	TraceAutoKey();
	TickStartCount = GetCuriCount();
	RunScript();
	if (ForceMacOff) {
		return;
	}
	--WaitTicks;
	++TrueEmulatedTime;
	UpdateMacDate();
	OnTrueTime = TrueEmulatedTime;
}

/* --- platform independent code can be thought of as going here --- */

#include "PROGMAIN.h"

LOCALPROC ReserveAllocAll(void)
{
	ReserveAllocOneBlock(&ROM, kROM_Size, 5, falseblnr);
	ReserveAllocOneBlock(&screencomparebuff,
		vMacScreenNumBytes, 5, trueblnr);
#if UseControlKeys
	ReserveAllocOneBlock(&CntrlDisplayBuff,
		vMacScreenNumBytes, 5, falseblnr);
#endif
	EmulationReserveAlloc();
}

LOCALFUNC blnr AllocMyMemory(void)
{
	uimr n;

	ReserveAllocOffset = 0;
	ReserveAllocBigBlock = nullpr;
	ReserveAllocAll();
	n = ReserveAllocOffset;
	ReserveAllocBigBlock = (ui3p)calloc(1, n);
	if (NULL == ReserveAllocBigBlock) {
		return falseblnr;
	}
	ReserveAllocOffset = 0;
	ReserveAllocAll();
	return n == ReserveAllocOffset;
}

int main(int argc, char **argv)
{
	int i;

	if (argc < 4) {
		fprintf(stderr, "usage: %s ROM SCRIPT DISK...\n", argv[0]);
		return 2;
	}
	InitDrives();
	if (! AllocMyMemory()) {
		fprintf(stderr, "out of memory\n");
		return 1;
	}
	if (! LoadMacRom(argv[1])) {
		return 1;
	}
	ScriptFile = (0 == strcmp(argv[2], "-")) ? stdin : fopen(argv[2], "r");
	if (NULL == ScriptFile) {
		fprintf(stderr, "cannot open script %s\n", argv[2]);
		return 1;
	}
	for (i = 3; i < argc; ++i) {
		if (! Sony_Insert1(argv[i])) {
			return 1;
		}
	}
	InitLocationDat();
#if 0 != vMacScreenDepth
	ColorModeWorks = trueblnr;
#endif
	InitKeyCodes();
	ScreenClearChanges();
	SpeedValue = 0;
	WantNotAutoSlow = trueblnr;

	ProgramMain();

#if MySoundEnabled
	StopSoundFile();
#endif
	UnInitDrives();
	return 0;
}

#endif /* WantOSGLUXWN */
