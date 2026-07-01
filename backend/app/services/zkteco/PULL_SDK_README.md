# ZKTeco C3 access panels — official PULL SDK integration

The C3-200 / C3-400 panels are driven through **ZKTeco's own PULL SDK**
(`libplcommpro`) via `c3_pull_sdk.py` — not a reverse-engineered wire protocol.
This is the same library ZKAccess / ZKBioSecurity use, so the protocol is handled
correctly by ZKTeco's code.

## Installing the SDK library

1. Obtain the **PULL SDK** from ZKTeco (freely provided with the C3/inBio devices,
   or from ZKTeco support). It ships `plcommpro.dll` (Windows) and, in the Linux
   package, `libplcommpro.so` plus its dependencies (e.g. `libzkfpcap`, `libcommpro`).
2. Copy the Linux `.so` files into the backend container, e.g. `/usr/local/lib/zk/`.
3. Tell the backend where the library is:
   ```
   ZK_PULLSDK_PATH=/usr/local/lib/zk/libplcommpro.so
   ```
   (and, if the loader can't find its siblings, add the folder to
   `LD_LIBRARY_PATH=/usr/local/lib/zk`).
4. Mount it via docker-compose, e.g.:
   ```yaml
   backend:
     volumes:
       - ./vendor/zk-pullsdk:/usr/local/lib/zk:ro
     environment:
       ZK_PULLSDK_PATH: /usr/local/lib/zk/libplcommpro.so
       LD_LIBRARY_PATH: /usr/local/lib/zk
   ```
5. Verify: `GET /api/v1/access-controllers/sdk/status` → `{"pull_sdk_available": true}`.

If the library is absent, POB keeps running; C3 polling simply reports that the SDK
isn't installed (and falls back to the unverified scaffold client only if used).

## Bringing a panel online

1. Add the controller (pick C3-200 / C3-400 — sets doors + reader layout).
2. **Probe** it (`POST /{id}/probe`, or the Probe button in the UI). The report
   walks: TCP reachable → SDK loaded → session handshake → a RAW realtime-log sample.
3. Present a card at each reader and re-probe / use **Learn mode** to map the ports
   that fire to zones.
4. Enable polling.

## The one thing to confirm against the real device

`GetRTLog` returns event records as text. Modern firmware uses comma-separated
`key=value` (parsed reliably). If your panel emits **positional** records, the probe
flags `rtlog_provisional: true` and dumps the raw text — confirm the field order
from that real output before enabling live zone ingestion, so nothing is guessed.

## Windows-only SDK?

If only `plcommpro.dll` is available (no Linux `.so`), run a tiny Windows sidecar
that exposes `Connect/GetRTLog/ControlDevice` over HTTP on the LAN and point POB at
it. The `c3_pull_sdk` client interface is small and easy to mirror.
