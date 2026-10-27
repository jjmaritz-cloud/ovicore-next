"use client";

import { useMemo, useState } from "react";
import styles from "./CommentMarkers.module.css";

/** A daily-entry note. Provide a stable id and ISO entryDate (YYYY-MM-DD). */
export type DailyChartComment = {
  id: string | number;
  entryDate: string;
  text: string;
  author?: string | null;
  /** Actual flock age in weeks if known, e.g. 42.57. */
  ageWeeks?: number | null;
};

export type ChartCommentMarker = {
  key: string;
  xValue: number;
  comments: DailyChartComment[];
};

const DAY_MS = 86_400_000;
function parseDay(date: string): number | null {
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}
function weekMonday(date: string): string | null {
  const ms = parseDay(date);
  if (ms === null) return null;
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Group daily comments without fabricating biological age.
 * `ageFromDate` should use the same flock-age calculation as the web graph.
 * For a weekly chart, the marker is positioned at its week's midpoint.
 */
export function groupChartComments(
  comments: DailyChartComment[],
  mode: "weekly" | "daily",
  ageFromDate: (isoDate: string) => number | null,
): ChartCommentMarker[] {
  const groups = new Map<string, DailyChartComment[]>();
  for (const comment of comments) {
    if (!comment.text?.trim()) continue;
    const date = comment.entryDate.slice(0, 10);
    const key = mode === "weekly" ? weekMonday(date) : date;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), comment]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([key, items]) => {
    const dates = items.map(i => i.entryDate.slice(0, 10));
    // Prefer each comment's provided biological age; otherwise use ageFromDate.
    const values = items.map((item, idx) =>
      Number.isFinite(item.ageWeeks) ? Number(item.ageWeeks) : ageFromDate(dates[idx]),
    ).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (!values.length) return [];
    let xValue = values[0];
    if (mode === "weekly") {
      const monday = parseDay(key);
      const middle = monday === null ? null : new Date(monday + 3 * DAY_MS).toISOString().slice(0, 10);
      const centered = middle ? ageFromDate(middle) : null;
      xValue = centered !== null && Number.isFinite(centered)
        ? centered
        : values.reduce((sum, n) => sum + n, 0) / values.length;
    }
    return [{ key, xValue, comments: items }];
  });
}

type Props = {
  comments: DailyChartComment[];
  mode: "weekly" | "daily";
  /** Map date to actual biological age in weeks, using your chart's existing age calculation. */
  ageFromDate: (isoDate: string) => number | null;
  /** Convert a flock age into the SVG's x-coordinate, using the EXISTING chart scale. */
  xForAge: (ageWeeks: number) => number;
  /** Convert a flock age into the SVG's production-line y-coordinate. Null if no production point exists. */
  productionYAtAge: (ageWeeks: number) => number | null;
  /** Visible SVG plot boundaries, to avoid painting outside the chart. */
  plot: { left: number; top: number; right: number; bottom: number };
};

/** Render INSIDE the existing chart's <svg> after the series paths. */
export function CommentMarkers({ comments, mode, ageFromDate, xForAge, productionYAtAge, plot }: Props) {
  const [opened, setOpened] = useState<string | null>(null);
  const markers = useMemo(() => groupChartComments(comments, mode, ageFromDate), [comments, mode, ageFromDate]);
  const active = markers.find(m => m.key === opened);
  const activeX = active ? xForAge(active.xValue) : 0;
  const activeY = active ? productionYAtAge(active.xValue) : null;
  const popupWidth = 234;
  const popupX = Math.min(Math.max(activeX - popupWidth / 2, plot.left), Math.max(plot.left, plot.right - popupWidth));
  const popupY = activeY === null ? 0 : Math.max(plot.top + 4, activeY - 112);
  return (
    <g className={styles.layer} aria-label="Daily comments on production graph">
      {markers.map(marker => {
        const x = xForAge(marker.xValue);
        const y = productionYAtAge(marker.xValue);
        if (y === null || !Number.isFinite(x) || !Number.isFinite(y) || x < plot.left || x > plot.right || y < plot.top || y > plot.bottom) return null;
        return (
          <g key={marker.key}>
            <circle cx={x} cy={y} r={13} fill="transparent" role="button" tabIndex={0}
              aria-label={`${marker.comments.length} comment${marker.comments.length === 1 ? "" : "s"} at ${marker.key}`}
              onClick={() => setOpened(o => o === marker.key ? null : marker.key)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpened(o => o === marker.key ? null : marker.key); } }} />
            <circle cx={x} cy={y} r={marker.comments.length > 1 ? 9.5 : 7} fill="#E5A22B" stroke="white" strokeWidth={2.5} pointerEvents="none" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#17392E" pointerEvents="none">{marker.comments.length > 1 ? marker.comments.length : "!"}</text>
          </g>
        );
      })}
      {active && activeY !== null && (
        <g>
          <line x1={activeX} y1={plot.top} x2={activeX} y2={plot.bottom} stroke="#DA9826" strokeDasharray="4 5" opacity="0.65" pointerEvents="none" />
          <foreignObject x={popupX} y={popupY} width={popupWidth} height={105}>
            <div className={styles.popup}>
              <div className={styles.heading}><b>{mode === "weekly" ? `Week of ${active.key}` : active.key}</b><button onClick={() => setOpened(null)} aria-label="Close comments">×</button></div>
              <div className={styles.notes}>{active.comments.map(c => <div key={c.id} className={styles.note}><b>{c.entryDate.slice(0, 10)}</b>{c.author ? ` · ${c.author}` : ""}<div>{c.text}</div></div>)}</div>
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
}
