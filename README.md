# OviCore Broiler Module Starter Pack

This pack starts the **Broiler Demand Planner** only. It uses the agreed stack:

- **Frontend:** Next.js + React + AG Grid
- **Backend:** FastAPI
- **Database:** PostgreSQL

The first goal is simple: open the Broiler Planner, edit rows in the Excel-style table, save changes, refresh, and confirm the values persisted.

## What is included

```text
backend/   FastAPI API, SQLAlchemy models, broiler calculations and seed data
frontend/  Next.js page with premium OviCore shell and AG Grid planner
scripts/   Windows helper scripts
```

## Requirements

Install these first:

1. Python 3.12
2. Node.js 20+
3. Docker Desktop

## Start the database

From the root folder:

```bash
docker compose up -d
```

## Start the backend

Windows:

```bat
scripts\run_backend.bat
```

Manual:

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend health check:

```text
http://localhost:8000/api/health
```

## Start the frontend

Windows:

```bat
scripts\run_frontend.bat
```

Manual:

```bash
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

Open:

```text
http://localhost:3000/broilers/demand-planner
```

## Current Broiler Planner behaviour

The planner has seeded database rows for a few broiler farms and sheds. You can edit:

- Placement Date
- Target kg/m²
- Target LW kg
- Planned Birds
- Growout Days
- Chick Allowance %
- Notes

The backend calculates:

- Processing Date
- Calculated Capacity Birds
- Planned kg/m²
- Capacity Variance Birds
- Capacity Variance %
- Required Chicks
- Review Flag

## Design rules already applied

- Full-page Excel-style table
- Centred headers and cells
- Frozen Farm / Shed / Cycle columns
- Grouped column headers
- Pale yellow editable cells
- Protected calculated columns
- Status pills
- Autosize button
- Save dirty rows to backend
- PostgreSQL persistence

## Next code additions

Suggested next steps:

1. Add **New Placement Row**.
2. Add farm/shed dropdowns.
3. Add downtime clash detection.
4. Add broiler flock creation from plan.
5. Add broiler performance entry.

