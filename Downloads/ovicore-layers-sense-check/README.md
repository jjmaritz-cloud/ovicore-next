# OviCore Ecosystem — Commercial Layers Daily House Card sense check

This package is **ready to integrate**, but it has **not been installed** into the real project. Current source/API routes are needed to wire it up safely.

## What is implemented

- Same-metric previous five valid observations, three required, recent **median** comparison.
- Configured example warning thresholds: feed ±35%, water ±40%, egg count ±40%, average egg weight ±15%, bodyweight ±20%.
- Mortality uses a simple large upward-jump condition instead of percentage-vs-zero.
- No automatic correction, no change to save logic, no blocking based on variance.
- All thresholds are initial heuristics, not breed-defined limits. Tune on actual flock data.

## Important integration rules

- Query historical records for **same farm, house, flock, metric and units**, strictly **before the entry date**; sort descending, and exclude entries invalidated or superseded by edits. Never include the current entry itself.
- Do not compare totals across major flock-size changes without first normalizing per bird. Use feed/water per bird in this first version. Egg totals should be converted to hen-day production % if flock population changes appreciably.
- Evaluate on field blur or after a short typing pause; reset any prior confirmation whenever the value changes.
- Show amber border + small inline alert with "Edit" and "Confirm value". Allow save regardless of historical warnings; retain the original entry and preferably log confirmation.
- Validate syntax and API payload normally on the backend; this helper should never replace hard input/schema validation.
- Do not compare across different flock ages if expected metric changes quickly; skip or adjust where appropriate.
- For Rearing, add its own metric threshold configuration while reusing the shared function.

## Usage

```ts
import { senseCheckLayerEntry } from './layersSenseCheck';
const result = senseCheckLayerEntry('feed_g_per_bird_day', 1150, [115,116,114,117,115]);
// result.status === 'warning'; result.message contains inline farmer-friendly message.
```

## Files needed to apply exact patch to your app

- Commercial Layers Daily House Card component and API fetch/save helpers.
- Relevant backend read/save routes, daily-entry model/schema, and any existing validation utility.
- Do not include `.env`, credentials, keys, tokens, database dumps or `node_modules`.

## Commands after code has actually been integrated and tested

```bat
cd C:\Projects\OviCore_Next.js\frontend
npm run build
cd ..
git status
git add frontend backend
git commit -m "Add Commercial Layers daily entry sense checks"
git push origin HEAD
```
