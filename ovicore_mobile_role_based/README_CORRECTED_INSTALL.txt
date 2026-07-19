CORRECTED OVICORE MOBILE LOCATION

The existing OviCore Next.js source is under:
C:\Projects\OviCore_Next.js\frontend\src

Correct mobile locations:
frontend\src\app\mobile\page.tsx
frontend\src\app\mobile\layout.tsx
frontend\src\app\mobile\mobile.module.css
frontend\src\lib\mobileHouseSheetDb.ts

Public files stay here:
frontend\public\manifest.webmanifest
frontend\public\sw.js
frontend\public\assets\ovicore-icon.png

IMPORTANT
Do not create or retain a second root source tree at:
frontend\app
frontend\lib

The existing main OviCore routes, layouts, login and components are under frontend\src.

INSTALL
1. Extract this corrected package.
2. Copy src into frontend, merging with frontend\src.
3. Copy public into frontend, merging with frontend\public.
4. Do not replace the full existing src or public folders.
5. Delete the accidental frontend\app and frontend\lib folders after confirming the files exist under frontend\src.
6. Run:
   cd C:\Projects\OviCore_Next.js\frontend
   npm.cmd run build

The corrected mobile header uses:
public\assets\ovicore-icon.png
