# Apex POB — Architecture

> Developer-facing architecture & data-flow reference for the Apex POB platform
> (Personnel On Board / access control / mustering for oil & gas).
> Product: **Apex POB** · Operator deployment: **Marconi.ng EPC Limited**

---

## 1. Technology stack

| Layer | Technology |
|---|---|
| Frontend | **React** (CRA + CRACO), Ant Design, Recharts, Leaflet/react-leaflet, React Query |
| Backend | **FastAPI** (Python), SQLAlchemy, Pydantic |
| Database | **PostgreSQL 15** |
| Cache / sessions / Celery broker | **Redis 7** |
| Background jobs | **Celery** (worker + beat) |
| Reverse proxy / TLS | **nginx** |
| Containerisation | **Docker / docker-compose** |
| Devices | **ZKTeco** biometric readers via the **ADMS push protocol** |
| Monitoring | Prometheus + Grafana + Alertmanager |

> Note: the original build brief (`Build_guide/Development_Prompt.md`) mentioned Vue.js; the delivered frontend is **React**.

## 2. Component diagram

```
                         Internet / 4G
   ZKTeco readers ────────────────────────────┐         Browser (users)
   (remote sites,                              │              │
    ADMS push, HTTP:80)                        ▼              ▼ HTTPS:443
                                        ┌──────────────────────────────┐
                                        │            nginx             │
                                        │  :80  /iclock/* → backend    │  (ADMS stays HTTP)
                                        │  :80  everything else → 443  │
                                        │  :443 React app + /api + /ws │
                                        │       /monitoring → Grafana  │
                                        └───────────────┬──────────────┘
                                                        │ (internal docker network)
                 ┌──────────────────────────┬──────────┴───────────┬───────────────────┐
                 ▼                           ▼                      ▼                   ▼
          ┌────────────┐            ┌─────────────────┐     ┌────────────┐      ┌────────────┐
          │  frontend  │            │  backend (API)  │     │  Postgres  │      │   Redis    │
          │ nginx+React│            │   FastAPI :8000 │◄───►│   :5432    │      │   :6379    │
          └────────────┘            └───┬────────┬────┘     └────────────┘      └─────┬──────┘
                                        │        │                                    │
                                  WebSocket   background tasks                  Celery worker
                                  (live POB,  (heartbeat, live-capture,         + Celery beat
                                  mustering,  device-poller, nightly HR/BC      (scheduled jobs)
                                  emergency)  sync, compliance email)
                                        │
                                        ▼
                          External: Microsoft Business Central (OAuth),
                                    SeamlessHR (REST), SMTP/SMS/WhatsApp
```

## 3. Reader (ADMS) data flow

1. Remote readers are configured with the server's public address (e.g. `http://41.67.137.161`, port **80**, HTTP — readers don't do TLS) in their **Cloud/ADMS** settings. See `project_adms_remote_readers` / `Build_guide/ZKTECO_INTEGRATION_GUIDE.md`.
2. Reader pushes to **`/iclock/cdata`** (data + heartbeat), polls **`/iclock/getrequest`** (pending commands), acknowledges via **`/iclock/devicecmd`**. These are served at the **root path** (`backend/app/api/adms_protocol.py`), no `/api` prefix.
3. nginx keeps `/iclock/*` on **HTTP port 80** (everything else redirects to 443).
4. `handle_attlog()` routes each punch by the reader's `reader_purpose`:
   - **ATTENDANCE** → `iclock_transaction` (T&A) + updates zone occupancy + `personnel.is_onboard`.
   - **ACCESS_ENTRY/EXIT** → zone tracking + `access_logs` + `acc_event`, and also a T&A row.
   - **MUSTERING** (door in mustering mode) → mustering punch.
5. `connection_mode` on the `devices` row controls whether the POB also actively TCP-polls the reader on port 4370 (`direct`/`both`) or relies purely on ADMS push (`adms`). **Remote readers must be `adms`.**

## 4. Occupancy & presence model

- **Zone occupancy** and the **POB dashboard** derive "who is where / on board" from the **latest punch** per person (`punch_state IN (0,4)` = checked in; `1`/`5` = out; `255` = auto-detect/presence).
- `personnel.is_onboard` is maintained from punches (check-in → on board; check-out → off board) and is the field the POB dashboard, reports and analytics count.
- Three reads must stay consistent: dashboard (`iclock_transaction` latest punch), per-zone tracking (`zone_personnel_tracking`), and stored `zones.current_personnel_count` (maintained by the punch path). See `project_zone_module`.

## 5. Key backend modules (`backend/app/api/`)

`adms_protocol` (device protocol), `zones`, `pob_status`, `device_management` / `device_discovery`, `attendance`, `mustering`, `emergency`, `access_control`, `visitor`, `personnel`, `departments`, `payroll`, `reports`, `auth` (+ `mfa`, `sessions`), `bc_integration`, `hr_integration`, `notifications`, `settings`, `audit`.

Services of note: `services/zkteco/{device_heartbeat,device_poller,live_capture}`, `services/{business_central_service,seamlesshr_service,attendance_export,attendance_calculation_service,mustering_service,emergency_service}`, `core/{security,crypto,rate_limiter,websocket,rbac}`.

## 6. Real-time (WebSocket)

- Live zone occupancy: `/api/v1/zones/ws`; access-control events; mustering: `/ws/mustering/...`; emergency: `/api/emergency/ws/...`; notifications: `/ws/notifications`.
- All WS URLs are derived client-side from `window.location` (`wss:` on HTTPS) and proxied by nginx (`map $http_upgrade $connection_upgrade`). Never hardcode `:8000`.

## 7. Auth & security

- JWT (access/refresh) with **type allowlist** (only `type=access` authenticates) + optional MFA; users live in `auth_user`.
- RBAC middleware; admin/global-admin gating on sensitive endpoints.
- Secrets encrypted at rest (`core/crypto.py`); config validators **hard-fail** on default `SECRET_KEY`/`GLOBAL_ADMIN_PASSWORD`/`LICENSE_SECRET` in production.
- Integration base URLs validated (https-only, SSRF guard). Rate limiting at nginx + app layer. HSTS/CSP in prod nginx.

## 8. Deployment topology

- **Dev:** `docker-compose.yml` (nginx serves built `frontend-react/build`, HTTP only).
- **Prod:** `docker-compose.prod.yml` + `nginx/conf.d/pob.conf` (TLS on 443, `/iclock` on 80), `.env.prod`, certs in `nginx/certs/`. Services: postgres, redis, db-init, backend, celery-worker, celery-beat, frontend, nginx, db-backup, prometheus, grafana, alertmanager.
- See `DOCKER_DEPLOYMENT.md`, `docs/GOLIVE_HANDOVER.md`.

## 9. API reference

The authoritative, always-current API spec is **OpenAPI/Swagger** at `/<API_V1_STR>/docs` (non-production) and `openapi.json`. Supplementary: `Build_guide/API_DOCUMENTATION.md`.
