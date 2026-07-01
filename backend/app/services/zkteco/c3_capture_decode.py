#!/usr/bin/env python3
"""
C3 protocol capture decoder — reverse-engineering aid (no guessing).

GOAL
----
POB will talk to the C3-200/C3-400 directly with a pure-Python driver so the whole
system stays standalone in Docker. To implement the wire protocol *correctly* we
decode a real packet capture of ZKTeco's own SDK demo (plcdemo.exe, in the Pull SDK
zip) talking to a real panel on TCP 4370. This tool extracts and annotates those
frames so the exact framing (start/len/command/CRC/end) is read off real bytes,
not assumed.

INPUT
-----
Export the capture with tshark (comes with Wireshark) to a simple text table:

    tshark -r c3.pcapng -Y "tcp.port==4370 && tcp.len>0" \\
      -T fields -e frame.number -e frame.time_relative \\
      -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport -e tcp.payload \\
      > c3_frames.txt

Then:  python c3_capture_decode.py c3_frames.txt  [--device-ip 192.168.1.201]

It prints each payload with direction (PC→panel = command, panel→PC = response),
an offset hex dump, and a best-effort C3 frame breakdown (clearly labelled inferred
so real bytes stay the source of truth).
"""

import sys
import argparse
from typing import List, Optional


def _hexdump(b: bytes, indent="    ") -> str:
    out = []
    for i in range(0, len(b), 16):
        chunk = b[i:i + 16]
        hexs = " ".join(f"{x:02x}" for x in chunk)
        text = "".join(chr(x) if 32 <= x < 127 else "." for x in chunk)
        out.append(f"{indent}{i:04x}  {hexs:<47}  {text}")
    return "\n".join(out)


def _u16le(b: bytes, off: int) -> Optional[int]:
    return (b[off] | (b[off + 1] << 8)) if off + 1 < len(b) else None


def _infer_c3_frame(b: bytes) -> str:
    """Best-effort structural read of a C3 frame. INFERRED — verify against the
    hex. Documented framing is roughly: start(0xAA) ver cmd len(2LE) ... crc(2) end(0x55)."""
    notes = []
    if not b:
        return "    (empty)"
    if b[0] == 0xAA:
        notes.append("starts 0xAA (candidate start marker)")
    if b[-1] == 0x55:
        notes.append("ends 0x55 (candidate end marker)")
    # A common layout: AA 01 <cmd> <len:2LE> <payload...> <crc:2> 55
    if len(b) >= 7 and b[0] == 0xAA:
        ver = b[1]
        cmd = b[2]
        ln = _u16le(b, 3)
        notes.append(f"inferred: ver=0x{ver:02x} cmd=0x{cmd:02x} len={ln} "
                     f"(payload+crc+end should be ~{(ln or 0)}+3 bytes)")
    return "    " + " | ".join(notes) if notes else "    (no obvious C3 framing markers)"


def decode(lines: List[str], device_ip: Optional[str]):
    n_cmd = n_resp = 0
    for raw in lines:
        raw = raw.strip()
        if not raw:
            continue
        parts = raw.split("\t")
        if len(parts) < 7:
            continue
        frame_no, t, src, dst, sport, dport, payload_hex = parts[:7]
        payload_hex = payload_hex.replace(":", "").strip()
        if not payload_hex:
            continue
        try:
            data = bytes.fromhex(payload_hex)
        except ValueError:
            continue

        # Direction: traffic TO port 4370 is a command; FROM 4370 is a response.
        to_panel = (dport == "4370") or (device_ip and dst == device_ip)
        if to_panel:
            direction = "PC → PANEL  (command)"
            n_cmd += 1
        else:
            direction = "PANEL → PC  (response)"
            n_resp += 1

        print(f"\n#{frame_no}  t={t}s  {src}:{sport} → {dst}:{dport}  [{direction}]  {len(data)} bytes")
        print(_infer_c3_frame(data))
        print(_hexdump(data))

    print(f"\n=== {n_cmd} command frame(s), {n_resp} response frame(s) decoded ===")
    print("Send this output (or the raw .pcapng) back and the pure-Python C3 driver "
          "will be finalized from these real frames.")


def main():
    ap = argparse.ArgumentParser(description="Decode a C3 (port 4370) tshark capture export.")
    ap.add_argument("file", help="tshark field export (see module docstring), or '-' for stdin")
    ap.add_argument("--device-ip", help="the panel's IP, to classify direction reliably")
    args = ap.parse_args()
    src = sys.stdin if args.file == "-" else open(args.file, encoding="utf-8", errors="replace")
    decode(src.readlines(), args.device_ip)


if __name__ == "__main__":
    main()
