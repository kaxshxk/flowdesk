# FlowDesk — HR-Productivity Hub

> A full-stack, production-ready HR platform built with **FastAPI** (backend) and **Next.js 16 + Tailwind CSS 4** (frontend).

---

## Project Structure

```
FLOWDESK1/
├── hr_productivity_hub/   ← FastAPI backend
│   ├── api/               ← Route handlers (time, hr, tasks, files, chat, meet…)
│   ├── core/              ← Config & database engine
│   ├── models/            ← SQLModel ORM models
│   ├── schemas/           ← Pydantic I/O schemas
│   ├── services/          ← Business logic (Google APIs, integrity checks…)
│   ├── utils/             ← HMAC helpers, etc.
│   ├── main.py            ← FastAPI application factory
│   ├── startup.py         ← Uvicorn entry point
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/              ← Next.js 16 + Tailwind CSS 4 frontend
│   ├── src/
│   │   ├── app/           ← App Router pages (login, hr/*, employee/*)
│   │   ├── components/    ← TeamsShell, RouteGuard
│   │   ├── context/       ← AuthContext (JWT session management)
│   │   └── utils/         ← api.ts fetch client
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
│
├── docker-compose.yml     ← Full dev stack (db + backend + frontend)
├── Makefile               ← Shortcut commands
├── .env.example           ← Template — copy to .env and fill in secrets
└── .gitignore
```

---

## Quick Start — Local Development

### Prerequisites
| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| PostgreSQL | 15+ (or use Docker) |

### 1. Clone & configure
```bash
git clone <repo-url> FLOWDESK1
cd FLOWDESK1
cp .env.example .env
# Edit .env with your credentials
```

### 2. One-command setup
```bash
make setup
```
This creates the Python virtual environment, installs backend dependencies, and installs frontend Node modules.

### 3. Start both servers
```bash
make dev
```
- **Backend API**: http://127.0.0.1:8000  
- **Frontend UI**: http://localhost:3000  
- **API Docs (Swagger)**: http://127.0.0.1:8000/docs

> On Windows, `make dev` opens the FastAPI server in a new terminal window and runs Next.js in the current shell.

---

## Quick Start — Docker (Full Stack)

```bash
docker compose up --build
```

This starts:
1. **PostgreSQL 16** (port 5432)  
2. **FastAPI backend** (port 8000) — waits for DB health check  
3. **Next.js frontend** (port 3000) — waits for backend

Stop everything:
```bash
docker compose down
```

---

## Manual Start (without Make / Docker)

### Backend
```bash
cd hr_productivity_hub
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python startup.py --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Application Routes

### Employee Portal
| Route | Description |
|-------|-------------|
| `/login` | Google OIDC authentication |
| `/employee/dashboard` | Time Clock terminal — Clock In / Clock Out + weekly/monthly stats |
| `/employee/tasks` | Daily Task Logger — HMAC-signed entries sync to Google Sheets |
| `/employee/files` | Drive Vault — drag-and-drop upload to date-partitioned Drive folders |
| `/employee/requests` | Leave & WFH Allocation Request Center |
| `/employee/chat` | Shared Workspace Chat relay (Google Chat webhook) |
| `/employee/meet` | Google Meet provisioner — instant link creation & broadcasting |

### HR Administration Panel
| Route | Description |
|-------|-------------|
| `/hr/dashboard` | Global Summary Dashboard — KPI widgets + leave review queue |
| `/hr/roster` | Whitelist & Roster Board — onboard, activate/deactivate employees |
| `/hr/employees/[id]` | Employee Dossier — activity timeline, clock logs, task ledger, drive catalog |
| `/hr/operations` | Operations Center — request approvals + cryptographic integrity alerts |
| `/hr/reports` | Payroll & Compliance CSV export |

---

## Backend API Summary

All endpoints are prefixed `/api/v1/`.

| Tag | Prefix | Key Endpoints |
|-----|--------|---------------|
| Auth | `/auth` | `POST /auth/google` |
| Time | `/time` | `GET /status`, `POST /clock-in`, `POST /clock-out`, `GET /stats` |
| Tasks | `/tasks` | `GET /tasks`, `POST /tasks` |
| Files | `/files` | `GET /files`, `POST /files/upload` |
| Requests | `/requests` | `GET /requests`, `POST /requests` |
| Chat | `/chat` | `GET /chat/history/{space_id}`, `POST /chat/send` |
| Meet | `/meet` | `POST /meet/create`, `GET /meet/history` |
| HR | `/hr` | Whitelist CRUD, employee management, time stats, alerts, dashboard, reports |

Full interactive docs: http://127.0.0.1:8000/docs

---

## Tech Stack

### Backend
- **FastAPI** — async HTTP framework
- **SQLModel** — SQLAlchemy + Pydantic ORM
- **PostgreSQL** — primary data store
- **PyJWT** — token generation & validation
- **google-api-python-client** — Sheets, Drive, Calendar, Chat integrations
- **HMAC-SHA256** — cryptographic task-log integrity sealing

### Frontend
- **Next.js 16** — App Router, TypeScript, server components
- **Tailwind CSS 4** — utility-first styling via PostCSS plugin
- **React 19** — UI composition

---

## Environment Variables Reference

See [`.env.example`](.env.example) for the full annotated list.

Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `HMAC_SECRET_KEY` | Task-log cryptographic seal key |
| `GOOGLE_CLIENT_ID` | Google OAuth client |
| `GOOGLE_SHEETS_CREDENTIALS` | Service-account JSON for Sheets |
| `GOOGLE_DRIVE_CREDENTIALS` | Service-account JSON for Drive |
| `GOOGLE_CHAT_WEBHOOK_URL` | Incoming webhook for chat relay |
| `GOOGLE_CALENDAR_CREDENTIALS` | Service-account JSON for Meet/Calendar |
| `BACKEND_CORS_ORIGINS` | Allowed CORS origins (JSON array string) |

> **Tip:** Leave Google API credential fields blank during local development — all integrations have automatic mock/fallback modes that log warnings instead of crashing.

---

## Development Commands

```bash
make setup      # Install all deps (first time)
make dev        # Start both servers (recommended)
make backend    # FastAPI only
make frontend   # Next.js only
make lint       # Lint both stacks
make clean      # Remove build artefacts
```
