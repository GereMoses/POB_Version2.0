# Capturing the C3 protocol (to finish the standalone pure-Python driver)

Decision: **POB replaces "ESS" and talks to the C3-200/C3-400 directly**, with a
pure-Python driver inside the Docker container — no DLL, no Windows service, no ESS.
To implement the wire protocol correctly (not guessed), we decode one real capture
of ZKTeco's own SDK demo talking to a panel.

You already have everything needed — the demo is in the Pull SDK zip.

## Step 1 — run the SDK demo against a real panel (Windows PC on the LAN)

1. Unzip the Pull SDK, open `demo/pull_C# Demo5.0/.../plcdemo.exe` (needs
   `plcommpro.dll` beside it — it's in the `dll/x64` or `dll/x86` folder).
2. Connect: `protocol=TCP,ipaddress=<panel-ip>,port=4370,timeout=4000,passwd=`
3. Do a few actions so we capture representative frames:
   - Connect
   - Get realtime log (GetRTLog) — and **badge a card at a reader** so a real
     access event is produced
   - Open a door (ControlDevice) once
   - Disconnect

## Step 2 — capture the traffic with Wireshark

1. Install Wireshark on that PC. Start a capture on the NIC facing the panels.
2. Filter: `tcp.port == 4370`
3. Run the demo actions from Step 1, then stop the capture.
4. Save as `c3.pcapng`.

## Step 3 — export just the C3 payloads (tshark, ships with Wireshark)

```
tshark -r c3.pcapng -Y "tcp.port==4370 && tcp.len>0" ^
  -T fields -e frame.number -e frame.time_relative ^
  -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport -e tcp.payload ^
  > c3_frames.txt
```
(Use `\` instead of `^` on Linux/macOS.)

## Step 4 — send it over

Send back **`c3_frames.txt`** (or the raw `c3.pcapng`). Optionally preview it:
```
python c3_capture_decode.py c3_frames.txt --device-ip <panel-ip>
```

From those real frames the pure-Python driver (`c3_controller.py`) will be finalized
— framing, command codes, CRC, and the Connect/GetRTLog/ControlDevice exchanges —
so POB polls the panels directly and stays fully standalone in Docker.

## If you'd rather not capture

Ask ZKTeco support for the **"Access Control Panel Communication Protocol"** document
(a.k.a. the C3 / RS485-TCP *protocol* manual — a different document from the Pull SDK
DLL manual). That spec lets us implement the driver without a capture.
