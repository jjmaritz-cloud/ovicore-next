"use client";

import { useMemo, useState } from "react";

type ReportRow = {
  id: number;
  flock_id: number;
  entry_date: string;
  age_days?: number | null;
  age_weeks?: number | null;
  production_pct?: number | null;
  cumulative_mortality_pct?: number | null;
  egg_weight_g?: number | null;
  feed_g_bird_day?: number | null;
  eggs_per_bird_cumulative?: number | null;
  bodyweight_g?: number | null;
  water_ml_bird_day?: number | null;
  water_intake_ml_bird_day?: number | null;
  water_l_bird_day?: number | null;
  production_standard_pct?: number | null;
  mortality_standard_pct?: number | null;
  egg_weight_standard_g?: number | null;
  feed_standard_g_bird_day?: number | null;
  eggs_per_bird_standard?: number | null;
  bodyweight_standard_g?: number | null;
};

export type ReportFlock = {
  id: number;
  farm: string;
  shed: string;
  code: string;
  rows: ReportRow[];
};

type DisplayRow = { flock: ReportFlock; row: ReportRow; date: string };
const columns = [
  { label: "Production %", key: "production_pct", standard: "production_standard_pct", decimals: 1 },
  { label: "Mortality cum %", key: "cumulative_mortality_pct", standard: "mortality_standard_pct", decimals: 2 },
  { label: "Egg weight g", key: "egg_weight_g", standard: "egg_weight_standard_g", decimals: 1 },
  { label: "Feed g/b/d", key: "feed_g_bird_day", standard: "feed_standard_g_bird_day", decimals: 1 },
  { label: "Water mL/b/d", key: "water", standard: "", decimals: 0 },
  { label: "Eggs / HH cum", key: "eggs_per_bird_cumulative", standard: "eggs_per_bird_standard", decimals: 1 },
  { label: "Bodyweight g", key: "bodyweight_g", standard: "bodyweight_standard_g", decimals: 0 },
] as const;

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function cellValue(row: ReportRow, key: string): number | null {
  if (key === "water") {
    const direct = numeric(row.water_ml_bird_day) ?? numeric(row.water_intake_ml_bird_day);
    return direct ?? (numeric(row.water_l_bird_day) === null ? null : (row.water_l_bird_day as number) * 1000);
  }
  return numeric((row as unknown as Record<string, unknown>)[key]);
}
function dateOnly(value: string): string {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value ?? "");
  return match?.[0] ?? "";
}
function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Protect Excel users from formula injection when a name or field starts with an operator.
  if (/^[\s]*[=+@\-\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
function downloadCsv(name: string, data: (string | number | null)[][]) {
  const csv = "\uFEFF" + data.map(row => row.map(escapeCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FlockPerformanceReport({ flocks, mode, minimumAgeDays }: {
  flocks: ReportFlock[];
  mode: "performance" | "compare";
  minimumAgeDays: number;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [showStandards, setShowStandards] = useState(false);
  const [sortAscending, setSortAscending] = useState(false);
  const invalidRange = Boolean(from && to && from > to);
  const items = useMemo<DisplayRow[]>(() => flocks.flatMap(flock => flock.rows.flatMap(row => {
    const date = dateOnly(row.entry_date);
    const age = numeric(row.age_days) ?? (numeric(row.age_weeks) === null ? null : (row.age_weeks as number) * 7);
    if (!date || age === null || age < minimumAgeDays) return [];
    if (from && date < from) return [];
    if (to && date > to) return [];
    return [{flock,row,date}];
  })).sort((a,b) => {
    const delta = a.date.localeCompare(b.date);
    return (sortAscending ? delta : -delta) || a.flock.code.localeCompare(b.flock.code) || a.row.id - b.row.id;
  }), [flocks, from, to, minimumAgeDays, sortAscending]);

  const validItems = invalidRange ? [] : items;
  const pages = Math.max(1,Math.ceil(validItems.length / pageSize));
  const currentPage = Math.min(page,pages);
  const visible = validItems.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const headers = ["Date", "Farm", "Shed", "Flock", "Age (weeks)", "Age (days)", ...columns.flatMap(c => showStandards && c.standard ? [c.label, `${c.label} standard`] : [c.label])];
  const rowCells = (entry: DisplayRow): (string | number | null)[] => [
    entry.date,entry.flock.farm,entry.flock.shed,entry.flock.code,
    numeric(entry.row.age_weeks) ?? (numeric(entry.row.age_days) === null ? null : Number((entry.row.age_days! / 7).toFixed(1))),
    numeric(entry.row.age_days),
    ...columns.flatMap(c => showStandards && c.standard
      ? [cellValue(entry.row,c.key),cellValue(entry.row,c.standard)]
      : [cellValue(entry.row,c.key)]),
  ];
  const exportReport = () => {
    const label = from || to ? `${from || "start"}_to_${to || "latest"}` : "all_dates";
    downloadCsv(`OviCore_Layer_Performance_${mode}_${label}.csv`, [headers,...validItems.map(rowCells)]);
  };
  const printReport = () => {
    const popup = window.open("", "_blank");
    if (!popup) { window.alert("Allow pop-ups to print this report, or use Export Excel / CSV."); return; }
    const htmlSafe = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char] ?? char));
    const cells = (items: (string | number | null)[], element: "td" | "th") => items.map(v => `<${element}>${htmlSafe(v)}</${element}>`).join("");
    const title = `OviCore · Commercial Layers ${mode === "compare" ? "Comparison" : "Performance"} Report`;
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${htmlSafe(title)}</title>
      <style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#183e30;margin:15px}
      h1{font-size:18px;margin:0 0 6px}p{color:#627568;font-size:11px;margin:0 0 15px}
      table{border-collapse:collapse;width:100%;font-size:8px}th{background:#e8f3ed}td,th{border:1px solid #bfcfc4;padding:5px;text-align:left}
      thead{display:table-header-group}tr{break-inside:avoid}</style></head><body>
      <h1>${htmlSafe(title)}</h1><p>Report dates: ${htmlSafe(from || "First available")} – ${htmlSafe(to || "Last available")} · ${validItems.length} records · ${flocks.length} flocks</p>
      <table><thead><tr>${cells(headers,"th")}</tr></thead><tbody>${validItems.map(v => `<tr>${cells(rowCells(v),"td")}</tr>`).join("")}</tbody></table>
      </body></html>`);
    popup.document.close();
    popup.focus();
    // Users can print or save this dedicated report window as PDF.
    popup.print();
  };
  const fmt = (value: string | number | null, decimal = 1) => value === null || value === "" ? "—" : typeof value === "number" ? value.toLocaleString("en-AU",{maximumFractionDigits:decimal,minimumFractionDigits:decimal}) : value;
  const clearDates = () => {setFrom("");setTo("");setPage(1);};
  return <section className="fr-report">
    <div className="fr-top">
      <div>
        <span className="fr-eyebrow">FLOCK DATA REPORT</span>
        <h2>Performance data table</h2>
        <p>Complete recorded history for {mode === "compare" ? "selected comparison flocks" : "the selected flock"}. Filter dates or export all matching rows.</p>
      </div>
      <div className="fr-buttons">
        <button type="button" onClick={exportReport} disabled={!validItems.length || invalidRange} className="fr-primary">↓ Export Excel / CSV</button>
        <button type="button" onClick={printReport} disabled={!validItems.length || invalidRange}>Print / Save PDF</button>
      </div>
    </div>
    <div className="fr-filters">
      <label>From date <input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}} /></label>
      <label>To date <input type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}} /></label>
      <button type="button" onClick={clearDates} className="fr-all">{!from && !to ? "✓ All dates" : "Show all dates"}</button>
      <label className="fr-check"><input type="checkbox" checked={showStandards} onChange={e=>setShowStandards(e.target.checked)}/> Include standard columns</label>
      <label>Rows <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
      <button type="button" onClick={()=>{setSortAscending(v=>!v);setPage(1);}}>{sortAscending ? "Oldest first ↑" : "Newest first ↓"}</button>
      <span className="fr-count">{validItems.length.toLocaleString("en-AU")} records · {flocks.length} flock{flocks.length === 1 ? "" : "s"}</span>
    </div>
    {invalidRange && <div className="fr-error" role="alert">From date must be on or before To date.</div>}
    <div className="fr-table-scroll">
      <table><thead><tr>{headers.map((h,i)=><th key={`${h}-${i}`}>{h}</th>)}</tr></thead>
        <tbody>{visible.map((item,i)=><tr key={`${item.flock.id}-${item.row.id}-${item.date}-${i}`}>{rowCells(item).map((v,idx)=><td key={idx}>{fmt(v,idx<4?0:idx===4?1:idx===5?0:columns[Math.min(columns.length-1,Math.max(0,idx-6))].decimals)}</td>)}</tr>)}
          {visible.length===0 && <tr><td colSpan={headers.length} className="fr-empty">No recorded data for this selection.</td></tr>}
        </tbody></table>
    </div>
    <div className="fr-bottom"><span>Showing {validItems.length ? (currentPage-1)*pageSize+1 : 0}–{Math.min(currentPage*pageSize,validItems.length)} of {validItems.length.toLocaleString("en-AU")} records</span>
      <div><button type="button" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>← Previous</button><span>Page {currentPage} / {pages}</span><button type="button" disabled={currentPage>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next →</button></div>
    </div>
    <style jsx>{`
      .fr-report{min-width:0;background:#fff;border:1px solid #dce8e2;border-radius:15px;padding:14px;box-shadow:0 8px 24px rgba(19,70,51,.055);color:#163e2d}
      .fr-top{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
      .fr-eyebrow{font-size:9px;font-weight:900;letter-spacing:.12em;color:#188157}
      h2{font-size:19px;letter-spacing:-.025em;margin:3px 0}p{font-size:11px;color:#708176;margin:0}
      .fr-buttons,.fr-bottom>div{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      button{border:1px solid #d4e3db;border-radius:8px;padding:8px 11px;background:#fff;color:#19543b;font-size:11px;font-weight:800;cursor:pointer}
      button:hover:not(:disabled){border-color:#11936b;background:#f1f9f5}button:disabled{opacity:.4;cursor:default}
      button.fr-primary{background:#086c4d;border-color:#086c4d;color:#fff}button.fr-primary:hover:not(:disabled){background:#055a40}
      .fr-filters{display:flex;align-items:flex-end;gap:9px;flex-wrap:wrap;padding:10px;background:#f7fbf9;border:1px solid #e5efea;border-radius:10px;margin-bottom:10px}
      .fr-filters label{display:grid;gap:4px;font-size:10px;font-weight:800;color:#496b58}
      .fr-filters input[type=date],.fr-filters select{min-height:32px;border:1px solid #d3e2d9;background:#fff;color:#1c4836;border-radius:7px;padding:4px 8px;font-size:11px}
      .fr-filters .fr-check{display:flex;align-items:center;gap:6px;padding:9px 2px}.fr-check input{accent-color:#087957}
      .fr-count{font-size:11px;color:#547465;font-weight:800;margin-left:auto;padding-bottom:8px}
      .fr-all{color:#117851}.fr-error{padding:10px;color:#a33a31;background:#fff5f2;border-radius:7px;font-size:12px}
      .fr-table-scroll{overflow-x:auto;max-width:100%;border:1px solid #e2ece6;border-radius:9px}
      table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:11px;white-space:nowrap}
      th{background:#eaf4ee;color:#28543c;text-align:left;font-size:10px;font-weight:850;padding:11px 10px;position:sticky;top:0}
      td{padding:9px 10px;border-top:1px solid #edf2ef;color:#395748}tbody tr:nth-child(even){background:#fbfdfc}tbody tr:hover{background:#edf9f2}
      .fr-empty{text-align:center;padding:24px;color:#82938a}
      .fr-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:10px;color:#6b7f72}
      @media(max-width:700px){.fr-top{align-items:stretch}.fr-buttons{width:100%}.fr-count{margin-left:0}.fr-report{padding:10px}}
    `}</style>
  </section>;
}
