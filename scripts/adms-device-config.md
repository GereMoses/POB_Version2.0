# ZKTeco ADMS Device Configuration Guide

## Overview

Remote locations (offshore platforms, onshore branches) only need ZKTeco/biometric
readers installed. No local server is required. Readers push all attendance data to
the central HQ server via the ADMS (Attendance Data Management System) protocol.

## Network Flow

```
Offshore Platform / Branch Office
  ┌──────────────────────────────┐
  │  ZKTeco Reader               │
  │  (fingerprint / face / card) │
  │                              │
  │  ADMS push → HTTP port 80    │
  └────────────────┬─────────────┘
                   │
                   │  Internet / VPN / MPLS
                   │  (TCP port 80 — HTTP)
                   │
              HQ Server
  ┌────────────────▼─────────────────┐
  │  nginx:80 → /iclock/ → backend   │
  │  All attendance records saved    │
  │  to central PostgreSQL database  │
  └──────────────────────────────────┘
```

## Configuring Each Reader

### Option A: Via the Device Web Interface
1. Connect a laptop to the same network as the reader
2. Open a browser to the reader's IP address (default: `192.168.1.201`)
3. Log in (default: admin / admin or admin / 12345)
4. Go to: **Communication** → **Cloud Server Settings** (or **ADMS Settings**)
5. Set the following:

   | Field | Value |
   |---|---|
   | Server Address | `your-hq-domain.com` or `HQ server IP` |
   | Server Port | `80` |
   | HTTPS | **Off** (most readers don't support HTTPS for ADMS) |
   | Heartbeat Interval | `30` (seconds) |

6. Save and the reader will start pushing data within 30 seconds

### Option B: Via ZKTeco Software (for bulk configuration)
Use ZKTeco's **ZKBioSecurity** or **ADMS** management tool to push configuration
to multiple readers simultaneously.

### Option C: Via the Device Keypad
On the reader:
1. Press **Menu** → **Comm** (or Communication)
2. Select **Cloud Server**
3. Set Server IP / Domain and Port `80`
4. Save

---

## Verifying the Connection

On the HQ server, check that the reader is pushing data:

```bash
# Watch incoming ADMS connections in real-time
docker compose -f docker-compose.prod.yml logs -f backend | grep -i "adms\|iclock\|cdata"
```

You should see lines like:
```
INFO - ADMS heartbeat from device: 3399162301847 (192.168.100.187)
INFO - ADMS punch received: emp_code=00123 punch_state=0 verify_type=1
```

---

## Network Requirements per Location

| Requirement | Details |
|---|---|
| Outbound port | TCP 80 to HQ server IP |
| Protocol | HTTP (not HTTPS) |
| Bandwidth | Very low — ~1KB per punch event |
| Connectivity | Can tolerate short outages — reader buffers events and sends in bulk when reconnected |
| VPN | Recommended for security but not required if HQ server is publicly reachable |

---

## Device Registration in the POB System

Once a reader is sending ADMS heartbeats, register it in the system:
1. Log in to the POB System
2. Go to **Device Management**
3. The device will appear in the **Unregistered Devices** list
4. Click **Register**, assign a location and zone
5. The device is now active and all punches are associated with that location

---

## Troubleshooting

| Problem | Check |
|---|---|
| Reader not connecting | Firewall allows outbound TCP 80 from reader's network |
| Reader connecting but no punches | Verify emp_code on reader matches personnel records in system |
| Punches arriving but wrong time | Sync reader time — Device Management → Sync Time |
| Offline for long period | Reader buffers up to 100,000 records and uploads on reconnection |
