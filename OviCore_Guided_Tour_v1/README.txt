OviCore Guided Tour v1

Copy these files into your project:

1. frontend/src/components/OviCoreTour.tsx
2. frontend/src/app/tour/page.tsx
3. frontend/src/app/home/page.tsx
4. frontend/src/app/broilers/page.tsx
5. frontend/src/app/broilers/intelligence/page.tsx
6. frontend/src/app/planning/page.tsx
7. frontend/src/app/compliance/page.tsx

What this build does
- Adds a Guided Tour module card to the module selector.
- Adds /tour landing page.
- Adds a cross-page OviCore Overview guided tour.
- Tour sequence:
  Module Selector -> Broiler Home -> Broiler Intelligence -> Planning -> People/Safety/Compliance -> Audit Readiness.
- Back / Next / Skip / Finish controls.
- Tour completion is stored in browser localStorage.
- No database or backend changes are required.

Important
- Keep your existing compliance/compliance.module.css file.
- This package intentionally does not replace globals.css or OviCoreModuleHeader.tsx.

Test locally:
cd /d C:\Projects\OviCore_Next.js\frontend
npm run build

Deploy:
cd /d C:\Projects\OviCore_Next.js
git add .
git commit -m "Add OviCore guided tour"
git push origin main
