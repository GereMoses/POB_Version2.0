# ZKTeco C3 access panels — official PULL SDK integration

The C3-200 / C3-400 panels are driven through **ZKTeco's own PULL SDK**
(`libplcommpro`) via `c3_pull_sdk.py` — not a reverse-engineered wire protocol.
This is the same library ZKAccess / ZKBioSecurity use, so the protocol is handled
correctly by ZKTeco's code.

## The SDK package we have is WINDOWS-ONLY

The **Pull SDK 2.2.1.4** download (`docs/Pull SDK-2.2.1.4.zip`) ships:
- `dll/x64/plcommpro.dll` + `dll/x86/plcommpro.dll` (and deps: plcomms, pltcpcomm,
  plrscomm, plrscagent, plusbcomm, ZKCommuCryptoClient)
- `doc/Pull SDK ... v2.0.doc` — the protocol manual (the RTLog/ControlDevice formats
  in our parser come straight from this doc — not guessed)

**There is no Linux `libplcommpro.so`.** The POB backend runs on Linux, so it cannot
load the DLL directly. Two deployment options:

### Option A (recommended): Windows sidecar
Run the tiny, dependency-free sidecar on a Windows box on the same LAN as the panels:
```
# on the Windows machine (Python 3 + plcommpro.dll present):
set ZK_SDK_SIDECAR_TOKEN=some-shared-secret
set ZK_PULLSDK_PATH=C:\zk\plcommpro.dll        # optional; default "plcommpro.dll"
python app/services/zkteco/c3_sdk_sidecar.py --port 8770
```
Then point the backend at it (docker-compose `environment:`):
```yaml
backend:
  environment:
    ZK_SDK_SIDECAR_URL:   http://<windows-host-ip>:8770
    ZK_SDK_SIDECAR_TOKEN: some-shared-secret
```
The backend fetches raw RTLog over HTTP and parses it locally. Verify the sidecar:
`GET http://<windows-host>:8770/health` → `{"ok":true,"sdk_loaded":true}`.

### Option B: native Linux `.so` (only if you obtain one)
If ZKTeco provides a Linux `libplcommpro.so`, mount it and the backend loads it via
ctypes directly:
```yaml
backend:
  volumes:
    - ./vendor/zk-pullsdk:/usr/local/lib/zk:ro
  environment:
    ZK_PULLSDK_PATH: /usr/local/lib/zk/libplcommpro.so
    LD_LIBRARY_PATH: /usr/local/lib/zk
```
Verify: `GET /api/v1/access-controllers/sdk/status` → `{"pull_sdk_available": true}`.

If neither is configured, POB keeps running; C3 polling simply reports the SDK
isn't available.

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
