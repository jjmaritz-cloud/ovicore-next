OviCore User Activity Update
============================

Files and destinations
----------------------
Backend:
  models.py  -> C:\Projects\OviCore_Next.js\backend\app\models.py
  schemas.py -> C:\Projects\OviCore_Next.js\backend\app\schemas.py
  main.py    -> C:\Projects\OviCore_Next.js\backend\app\main.py
  auth.py    -> C:\Projects\OviCore_Next.js\backend\app\routers\auth.py
  access.py  -> C:\Projects\OviCore_Next.js\backend\app\routers\access.py

Frontend:
  page.tsx     -> your current Global Admin Users & Access page file
  AuthGate.tsx -> replace the AuthGate.tsx file you uploaded

What this version adds
----------------------
- Last Login (already existed in OviCore and is now displayed)
- Last Active
- Last Module
- Last Page
- 30-day session count (successful logins)
- Usage status: Active / Low Usage / Dormant / Never Logged In
- Global Admin activity summary endpoint
- Per-user activity timeline endpoint
- Lightweight 5-minute heartbeat while OviCore is visible
- Page-view events only when the pathname changes (no click-by-click tracking)
- Global Admin usage KPIs on Users & Access

Database behaviour
------------------
On backend startup, main.py automatically adds the new app_users columns to an
existing database. SQLAlchemy create_all creates the new user_activity table.
No manual SQL should be required with the current OviCore startup pattern.

Important
---------
The 30-day session count begins accumulating after this update is deployed,
because historical login timestamps were stored only as the single most recent
last_login_at value and not as individual login events.

After replacing files
---------------------
1. Restart the FastAPI backend.
2. Restart/rebuild the Next.js frontend.
3. Log out and back in once.
4. Open Global Admin > Users & Access.
5. Navigate through a few pages, wait/reload, and confirm Last Active / Last Page update.
