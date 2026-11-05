"use client";

import { useMemo, useState } from "react";

export type ComparisonValueRow = {
  ageDays: number;
  value: number | null;
  standard: number | null;
};
export type ComparisonSeries = {
  id: number;
  label: string;
  rows: ComparisonValueRow[];
};
export type ComparisonMetricChart = {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  series: ComparisonSeries[];
  reference: { ageDays: number; value: number }[];
};

const PALETTE = ["#1677d2", "#009b91", "#ab65c7", "#e7a23d", "#d66c72"];

function MetricChart({ metric, daily, standards, range }: {
  metric: ComparisonMetricChart;
  daily: boolean;
  standards: boolean;
  range: "laying" | "full";
}) {
  const [hoverAge, setHoverAge] = useState<number | null>(null);
  const chart = useMemo(() => {
    const bucketSize = daily ? 1 : 7;
    const getBucket = (day: number) => daily ? Math.round(day) : Math.floor(day / 7);
    const aggregated = metric.series.map(s => {
      const groups = new Map<number, ComparisonValueRow[]>();
      s.rows.forEach(row => {
        if (!Number.isFinite(row.ageDays)) return;
        const key = getBucket(row.ageDays);
        groups.set(key, [...(groups.get(key) ?? []), row]);
      });
      // Production, egg weight, feed, water and bodyweight are weekly means.
      // Cumulative measurements use the last valid value of each biological week.
      const cumulative = metric.key === "mortality" || metric.key === "eggsPerBird";
      const summarise = (group: ComparisonValueRow[], field: "value" | "standard") => {
        const valid = group.filter(row => row[field] !== null).sort((a,b) => a.ageDays - b.ageDays);
        if (!valid.length) return null;
        return cumulative ? valid[valid.length - 1][field] : valid.reduce((sum, row) => sum + (row[field] ?? 0), 0) / valid.length;
      };
      return { ...s, values: [...groups].sort(([a],[b]) => a-b).map(([age, group]) => ({ age, value: summarise(group, "value"), standard: summarise(group, "standard") })) };
    });
    const reference = metric.reference.map(p => ({age: getBucket(p.ageDays), value: p.value}));
    const allAges = [...aggregated.flatMap(s => s.values.map(v=>v.age)), ...(standards ? reference.map(p=>p.age) : [])];
    const min = range === "laying" ? (daily ? 119 : 17) : 0;
    const max = Math.max(min + 1, ...allAges, daily ? 700 : 100);
    const vals = [...aggregated.flatMap(s => s.values.flatMap(p => [p.value, ...(standards ? [p.standard] : [])])), ...(standards ? reference.map(p=>p.value) : [])].filter((v):v is number => v !== null && Number.isFinite(v));
    const low = Math.min(0, ...vals);
    const high = Math.max(1, ...vals);
    const padding = Math.max((high - low) * .10, 0.5);
    return { aggregated, reference, min, max, low: Math.max(0, low-padding), high: high+padding, bucketSize };
  }, [metric, daily, standards, range]);
  const W = 1080, H = 340, L = 65, R = 20, T = 18, B = 48;
  const plotW = W-L-R, plotH = H-T-B;
  const px = (age:number) => L + (age-chart.min) / (chart.max-chart.min) * plotW;
  const py = (value:number) => T + plotH - (value-chart.low) / (chart.high-chart.low) * plotH;
  const pathSegments = (values: {age:number;value:number|null}[]) => {
    const paths:string[]=[]; let segment:string[]=[]; let previous:number|null=null;
    const flush=()=>{if(segment.length>1) paths.push(segment.join(" "));segment=[];};
    for(const p of values) {
      if(p.value===null || !Number.isFinite(p.value) || p.age<chart.min || p.age>chart.max){flush();previous=null;continue;}
      if(previous!==null && p.age-previous> (daily ? 3 : 2)) flush();
      segment.push(`${px(p.age).toFixed(2)},${py(p.value).toFixed(2)}`);
      previous=p.age;
    }
    flush();return paths;
  };
  const tickAges = Array.from({length:9},(_,i)=>chart.min + (chart.max-chart.min)*i/8);
  const selectedAge = hoverAge === null ? null : (daily ? Math.round(hoverAge) : Math.floor(hoverAge));
  const showReference = standards && metric.reference.length > 0;
  return <div style={{border:"1px solid #dce8e2",borderRadius:12,background:"white",padding:"12px 14px",minWidth:0}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:6}}>
      <strong style={{color:"#174633",fontSize:14}}>{metric.label}</strong>
      <span style={{fontSize:11,color:"#60776b"}}>{metric.unit ? `Unit: ${metric.unit} · ` : ""}Aligned by biological age</span>
    </div>
    <div style={{display:"flex",gap:13,flexWrap:"wrap",fontSize:11,marginBottom:5}}>
      {chart.aggregated.map((s,i)=><span key={s.id} style={{color:PALETTE[i%PALETTE.length],fontWeight:750}}>━━ {s.label}</span>)}
      {standards && <span style={{color:"#7c8995"}}>┄┄ Standard</span>}
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{display:"block",width:"100%",height:"auto",touchAction:"pan-y"}} role="img" aria-label={`Age-aligned ${metric.label} comparison chart`} onMouseLeave={()=>setHoverAge(null)}>
      <rect x={L} y={T} width={plotW} height={plotH} fill="#fbfdfc" rx={8}/>
      {Array.from({length:5},(_,i)=>{
        const v=chart.low+(chart.high-chart.low)*i/4;
        return <g key={i}><line x1={L} x2={W-R} y1={py(v)} y2={py(v)} stroke="#ddeae3" strokeDasharray="4 6"/><text x={L-9} y={py(v)+4} textAnchor="end" fontSize={11} fill="#587064">{v.toFixed(metric.decimals)}</text></g>;
      })}
      {tickAges.map((age,i)=><g key={i}><line x1={px(age)} x2={px(age)} y1={T} y2={H-B} stroke="#e7efea"/><text x={px(age)} y={H-20} fontSize={11} textAnchor="middle" fill="#65796e">{Math.round(age)}</text></g>)}
      {showReference && pathSegments(chart.reference).map((p,i)=><polyline key={`ref-${i}`} points={p} fill="none" stroke="#7c8995" strokeWidth={2} strokeDasharray="7 6" opacity={.78}/>)}
      {standards && !showReference && chart.aggregated[0]?.values && pathSegments(chart.aggregated[0].values.map(p=>({age:p.age,value:p.standard}))).map((p,i)=><polyline key={`std-${i}`} points={p} fill="none" stroke="#7c8995" strokeWidth={2} strokeDasharray="7 6" opacity={.78}/>)}
      {chart.aggregated.map((s,i)=>pathSegments(s.values).map((path,k)=><polyline key={`${s.id}-${k}`} points={path} fill="none" stroke={PALETTE[i%PALETTE.length]} strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round"/>))}
      {selectedAge!==null && <line x1={px(selectedAge)} x2={px(selectedAge)} y1={T} y2={H-B} stroke="#64796d" strokeDasharray="5 5"/>}
      <rect x={L} y={T} width={plotW} height={plotH} fill="transparent" style={{cursor:"crosshair"}} onMouseMove={e=>{
        const svg=e.currentTarget.ownerSVGElement;
        if(!svg) return;
        const bounds=svg.getBoundingClientRect();
        const x=(e.clientX-bounds.left)*W/bounds.width;
        setHoverAge(chart.min+Math.max(0,Math.min(1,(x-L)/plotW))*(chart.max-chart.min));
      }}/>
      <text x={L+plotW/2} y={H-3} fontSize={11} fontWeight={750} textAnchor="middle" fill="#587064">Age in {daily?"days":"weeks"}</text>
    </svg>
    {selectedAge!==null && <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px",background:"#f5faf8",borderRadius:7,padding:"8px 10px",fontSize:11,alignItems:"center"}}>
      <strong>{daily?"Day":"Week"} {selectedAge}</strong>
      {chart.aggregated.map((s,i)=>{
        const point=s.values.find(v=>v.age===selectedAge);
        return <span key={s.id} style={{color:PALETTE[i%PALETTE.length]}}>{s.label}: <strong>{point?.value==null?"—":point.value.toFixed(metric.decimals)}</strong></span>;
      })}
      {standards && <span style={{color:"#65766f"}}>Standard: <strong>{(showReference ? chart.reference.find(p=>p.age===selectedAge)?.value : chart.aggregated[0]?.values.find(p=>p.age===selectedAge)?.standard)?.toFixed(metric.decimals) ?? "—"}</strong></span>}
    </div>}
  </div>;
}

export default function FlockComparisonCharts({charts,daily,standards,range}:{charts:ComparisonMetricChart[];daily:boolean;standards:boolean;range:"laying"|"full"}){
  if(!charts.length) return <div style={{padding:20,color:"#617369"}}>Choose a metric to compare.</div>;
  return <div style={{display:"grid",gap:12}}>{charts.map(c=><MetricChart key={c.key} metric={c} daily={daily} standards={standards} range={range}/>)}</div>;
}
