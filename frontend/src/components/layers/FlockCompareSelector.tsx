"use client";

import { useEffect, useMemo, useState } from "react";

export type CompareFlockOption = {
  id: number;
  farm_name: string;
  shed_name: string;
  flock_code: string;
  breed?: string | null;
  hatch_date?: string | null;
  housed_date?: string | null;
  birds_housed?: number | null;
};
export type CompareMetricOption = { key: string; label: string };

type Props = {
  flocks: CompareFlockOption[];
  currentFlockId: number | null;
  selectedFlockIds: number[];
  onSelectedFlockIdsChange: (ids: number[]) => void;
  metrics: CompareMetricOption[];
  selectedMetricKeys: string[];
  onSelectedMetricKeysChange: (keys: string[]) => void;
  mode: "performance" | "compare";
  onModeChange: (mode: "performance" | "compare") => void;
  maxFlocks?: number;
};

const COLORS = ["#1677d2", "#009b91", "#ab65c7", "#e7a23d", "#d66c72", "#64748b"];

export default function FlockCompareSelector({
  flocks, currentFlockId, selectedFlockIds, onSelectedFlockIdsChange,
  metrics, selectedMetricKeys, onSelectedMetricKeysChange, mode, onModeChange,
  maxFlocks = 5,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [farm, setFarm] = useState("");
  const [shed, setShed] = useState("");
  const current = flocks.find(f => f.id === currentFlockId);
  const previous = useMemo(() => flocks
    .filter(f => f.id !== currentFlockId && f.farm_name === current?.farm_name && f.shed_name === current?.shed_name && !!(f.housed_date || f.hatch_date) && !!(current?.housed_date || current?.hatch_date) && (f.housed_date || f.hatch_date || "") < (current?.housed_date || current?.hatch_date || ""))
    .sort((a, b) => (b.housed_date || b.hatch_date || "").localeCompare(a.housed_date || a.hatch_date || ""))[0], [flocks, currentFlockId, current?.farm_name, current?.shed_name]);
  const farms = useMemo(() => [...new Set(flocks.map(f => f.farm_name))].sort(), [flocks]);
  const sheds = useMemo(() => [...new Set(flocks.filter(f => !farm || f.farm_name === farm).map(f => f.shed_name))].sort(), [flocks, farm]);
  const matches = useMemo(() => flocks.filter(f =>
    (!farm || f.farm_name === farm) && (!shed || f.shed_name === shed) &&
    `${f.farm_name} ${f.shed_name} ${f.flock_code} ${f.breed || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [flocks, farm, shed, search]);
  const selected = selectedFlockIds.map(id => flocks.find(f => f.id === id)).filter((f): f is CompareFlockOption => !!f);

  useEffect(() => { if (!open) { setFarm(""); setShed(""); setSearch(""); } }, [open]);
  const toggleFlock = (id: number) => {
    if (id === currentFlockId) return;
    onSelectedFlockIdsChange(selectedFlockIds.includes(id)
      ? selectedFlockIds.filter(v => v !== id)
      : selectedFlockIds.length < maxFlocks - 1 ? [...selectedFlockIds, id] : selectedFlockIds);
  };
  const toggleMetric = (key: string) => {
    onSelectedMetricKeysChange(selectedMetricKeys.includes(key)
      ? selectedMetricKeys.length > 1 ? selectedMetricKeys.filter(m => m !== key) : selectedMetricKeys
      : [...selectedMetricKeys, key]);
  };
  const button: React.CSSProperties = { border: "1px solid #ccdcd8", background: "white", borderRadius: 9, padding: "5px 9px", cursor: "pointer", color: "#143e37", fontWeight: 650, fontSize: 12 };
  const heading: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: "#1d5247", marginBottom: 4, letterSpacing: ".02em" };
  return <section aria-label="Flock comparison" style={{ background: "#fff", border: "1px solid #d5e5e1", borderRadius: 12, padding: "4px 8px", marginBottom: 3, color: "#173b35" }}>
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 5 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["performance", "compare"] as const).map(v => <button type="button" key={v} onClick={() => onModeChange(v)} aria-pressed={mode === v} style={{ ...button, background: mode === v ? "#145c50" : "#fff", color: mode === v ? "#fff" : "#145c50", borderColor: mode === v ? "#145c50" : "#cfe0da" }}>{v === "performance" ? "Performance" : "Compare flocks"}</button>)}
      </div>
      {mode === "compare" && <span style={{ fontSize: 11, color: "#61766e" }}>Aligned by flock age, not calendar date</span>}
    </div>
    {mode === "compare" && <>
      <div style={heading}>SELECTED FLOCKS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
        {current && <span style={{ border: "1px solid #cde3f5", background: "#eff7ff", borderRadius: 20, padding: "4px 8px", fontSize: 12 }}><strong style={{ color: COLORS[0] }}>●</strong> {current.flock_code} <small style={{ color: "#57726c" }}>Current</small></span>}
        {selected.map((f, index) => <span key={f.id} style={{ border: "1px solid #d6e4e1", background: "#f7faf9", borderRadius: 20, padding: "4px 8px", fontSize: 12 }}><strong style={{ color: COLORS[(index + 1) % COLORS.length] }}>●</strong> {f.flock_code} <button type="button" aria-label={`Remove ${f.flock_code}`} onClick={() => toggleFlock(f.id)} style={{ border: 0, background: "transparent", cursor: "pointer", marginLeft: 4, color: "#5a7069" }}>×</button></span>)}
        <button type="button" onClick={() => setOpen(true)} style={button}>＋ Add flocks</button>
        {previous && !selectedFlockIds.includes(previous.id) && <button type="button" onClick={() => toggleFlock(previous.id)} style={button}>Compare previous in same shed</button>}
      </div>
      <div style={{ ...heading, marginTop: 8 }}>CHOOSE METRICS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {metrics.map(m => <button type="button" key={m.key} onClick={() => toggleMetric(m.key)} aria-pressed={selectedMetricKeys.includes(m.key)} style={{ ...button, background: selectedMetricKeys.includes(m.key) ? "#e1f3ed" : "#fff", borderColor: selectedMetricKeys.includes(m.key) ? "#42a184" : "#cfded9" }}>{selectedMetricKeys.includes(m.key) ? "✓ " : "+ "}{m.label}</button>)}
      </div>
      <p style={{ fontSize: 11, color: "#64746f", margin: "4px 0 0" }}>All selected metrics appear on the same graph. Click a metric to hide/show it; click a flock label on the chart to hide/show that flock.</p>
    </>}
    {open && <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(17,34,31,.52)", display: "grid", placeItems: "center", padding: 15, zIndex: 9999 }}>
      <div role="dialog" aria-modal="true" aria-label="Add comparison flocks" style={{ background: "white", borderRadius: 12, padding: 18, width: "min(760px, 100%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px #0003" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><strong>Add comparison flocks</strong><button type="button" onClick={() => setOpen(false)} style={button}>Done ×</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginBottom: 12 }}>
          <select aria-label="Farm" value={farm} onChange={e => { setFarm(e.target.value); setShed(""); }} style={button}><option value="">All farms</option>{farms.map(f => <option key={f}>{f}</option>)}</select>
          <select aria-label="Shed" value={shed} onChange={e => setShed(e.target.value)} style={button}><option value="">All sheds</option>{sheds.map(s => <option key={s}>{s}</option>)}</select>
          <input aria-label="Search flocks" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flock…" style={button}/>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {matches.map(f => <label key={f.id} style={{ display: "flex", gap: 10, padding: 11, border: "1px solid #e0e9e5", borderRadius: 8, cursor: f.id === currentFlockId ? "default" : "pointer", alignItems: "center" }}>
            <input type="checkbox" checked={f.id === currentFlockId || selectedFlockIds.includes(f.id)} disabled={f.id === currentFlockId || (!selectedFlockIds.includes(f.id) && selectedFlockIds.length >= maxFlocks - 1)} onChange={() => toggleFlock(f.id)}/>
            <span style={{ fontSize: 12 }}><strong>{f.flock_code}</strong> · {f.farm_name} / {f.shed_name}<span style={{ display: "block", fontSize: 11, color: "#688077", marginTop: 2 }}>{f.breed || "Breed unspecified"}{f.housed_date ? ` · Housed ${f.housed_date}` : ""}{f.birds_housed != null ? ` · ${f.birds_housed.toLocaleString()} birds` : ""}{f.id === currentFlockId ? " · Current flock" : ""}</span></span>
          </label>)}
          {!matches.length && <p style={{ fontSize: 12 }}>No matching flocks.</p>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 14 }}><small>Up to {maxFlocks} flocks, including current</small><button type="button" onClick={() => setOpen(false)} style={{ ...button, background: "#145c50", color: "white" }}>Apply selection</button></div>
      </div>
    </div>}
  </section>;
}
