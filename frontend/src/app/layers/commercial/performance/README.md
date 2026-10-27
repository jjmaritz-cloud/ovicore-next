# OviCore web Performance — Amber daily comments

## Files
- `CommentMarkers.tsx`
- `CommentMarkers.module.css`

Place both inside the folder containing your *web* Commercial Layers performance graph (not the mobile `src/app/mobile/layers/commercial/performance` page).

## Wiring into the existing web graph

1. Find the graph currently showing the "Comments in daily" speech bubble. Remove only that button/toggle once the comment markers are working. Do not alter the metric series, standard curves, age bands, scales, or existing chart hover.
2. Supply comments from the EXISTING daily-entry source. Shape each into `{id, entryDate: '2026-10-27', text, author?, ageWeeks?}`. No backend comment route has been assumed or added.
3. Inside the existing SVG plot (after drawing metric paths), render the component:

```tsx
<CommentMarkers
  comments={dailyComments}
  mode={grouping === 'weekly' ? 'weekly' : 'daily'}
  ageFromDate={ageFromDate}
  xForAge={xScale}
  productionYAtAge={productionYAtAge}
  plot={{left: plotLeft, top: plotTop, right: plotRight, bottom: plotBottom}}
/>
```

`ageFromDate` MUST be the same biological-age calculation used by the web graph; do not infer age from chart start dates. `xScale` must map real flock age in weeks to SVG pixels. `productionYAtAge` must interpolate from the actual production series using the existing chart's y-scale; return `null` if production is missing. Markers skip missing production points.

## Behavior
- Amber `!` point at the production line: one daily-entry comment
- Amber numbered point: multiple comments in the same week/day
- Tap/click marker for comment popover; tap/click again or × to close
- Weekly aggregation uses Monday–Sunday, with marker centered on that week in real flock age
- Daily view uses exact entry date and age

## Verify
- Comments are scoped to selected company / flock and come from the existing authorized API.
- Older / newer weekly boundary dates group correctly.
- Production line shows the markers and remains unchanged.
- No invented ages or comments; SVG chart scale functions use the same coordinate system.
- When adding to web page, run `npm run build` before `git add`, `git commit` and `git push`.

**This is a reusable component, not a completed in-repository integration**. The desktop graph page, comment response structure and SVG scaling code have not been supplied, so they cannot safely be wired automatically.
