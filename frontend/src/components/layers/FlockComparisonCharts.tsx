"use client";

import { useId, useMemo, useState } from "react";

export type ComparisonValueRow = { ageDays: number; value: number | null; standard: number | null };
export type ComparisonSeries = { id: number; label: string; rows: ComparisonValueRow[] };
export type ComparisonMetricChart = {
  key: string; label: string; unit: string; decimals: number;
  series: ComparisonSeries[];
  reference: { ageDays: number; value: number }[];
};

const COLORS = ["#1677d2", "#009b91", "#ab65c7", "#d28b19", "#d65d70"];
const DASHES = ["", "9 5", "3 5", "12 4 3 4", "2 3", "15 5", "6 3 2 3"];
const METRIC_COLORS: Record<string,string> = { production:"#1677d2", mortality:"#ef4444", eggWeight:"#16a34a",feed:"#f97316",water:"#0891b2",eggsPerBird:"#7c3aed",bodyweight:"#9a5b42" };
type Point = { age: number; value: number | null };

// One shared biological-age X axis, one independent Y scale for each visible metric.
// Flock identity is encoded by colour; metric identity by stroke pattern.
export default function FlockComparisonCharts({ charts, daily, standards, range }: {
  charts: ComparisonMetricChart[]; daily: boolean; standards: boolean; range: "laying" | "full";
}) {
  const clipId = useId().replace(/:/g, "");
  const [hiddenFlocks, setHiddenFlocks] = useState<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [hiddenReference, setHiddenReference] = useState(false);
  const flockList = useMemo(() => charts[0]?.series.map((s, index) => ({id:s.id,label:s.label,color:COLORS[index % COLORS.length]})) ?? [], [charts]);
  const plotted = useMemo(() => charts.map(metric => {
    const bucket = (day:number) => daily ? Math.round(day) : Math.floor(day / 7);
    const cumulative = metric.key === "mortality" || metric.key === "eggsPerBird";
    const series = metric.series.map(s => {
      const bins = new Map<number, ComparisonValueRow[]>();
      for (const row of s.rows) {
        if (!Number.isFinite(row.ageDays)) continue;
        const k = bucket(row.ageDays);
        bins.set(k, [...(bins.get(k) ?? []), row]);
      }
      const data: Point[] = [...bins.entries()].sort(([a],[b])=>a-b).map(([age, entries]) => {
        const sorted = entries.filter(e=>e.value!==null && Number.isFinite(e.value)).sort((a,b)=>a.ageDays-b.ageDays);
        return {age, value:sorted.length ? (cumulative ? sorted[sorted.length-1].value : sorted.reduce((sum,r)=>sum+(r.value ?? 0),0)/sorted.length) : null};
      });
      return {...s,data};
    });
    const reference:Point[] = metric.reference.map(r=>({age:bucket(r.ageDays),value:r.value}));
    // If a breed reference is not present, use the main flock's API standard.
    if (!reference.length && metric.series[0]) {
      const bins = new Map<number,ComparisonValueRow[]>();
      for (const r of metric.series[0].rows) {
        const k=bucket(r.ageDays);bins.set(k,[...(bins.get(k)??[]),r]);
      }
      for (const [age, rows] of [...bins.entries()].sort(([a],[b])=>a-b)) {
        const v=rows.filter(r=>r.standard!==null && Number.isFinite(r.standard)).sort((a,b)=>a.ageDays-b.ageDays);
        reference.push({age,value:!v.length?null:cumulative?v[v.length-1].standard:v.reduce((sum,r)=>sum+(r.standard??0),0)/v.length});
      }
    }
    return {...metric,series,reference};
  }),[charts,daily]);
  const visible = plotted.map(m=>({...m,series:m.series.filter(s=>!hiddenFlocks.includes(s.id))}));
  const allAges = visible.flatMap(m=>m.series.flatMap(s=>s.data.map(p=>p.age)));
  const minAge=range==="laying"?(daily?119:17):0;
  const maxAge=Math.max(minAge+1,daily?700:100,...allAges);
  const ranges=visible.map(m=>{
    const values=[...m.series.flatMap(s=>s.data.map(p=>p.value)),...(standards&&!hiddenReference?m.reference.map(p=>p.value):[])].filter((v):v is number=>v!==null&&Number.isFinite(v));
    const bottom=Math.min(0,...values); const high=Math.max(1,...values);
    const pad=Math.max((high-bottom)*.07,.5);
    return {min:Math.max(0,bottom-pad),max:high+pad};
  });
  const W=1600,H=620,L=72,T=18,B=62,R=Math.max(140,visible.length*49+58);
  const PW=W-L-R,PH=H-T-B;
  const x=(age:number)=>L+(age-minAge)/(maxAge-minAge)*PW;
  const y=(value:number,i:number)=>T+PH-(value-ranges[i].min)/(ranges[i].max-ranges[i].min)*PH;
  const segments=(items:Point[],i:number)=>{
    const result:string[]=[];let current:string[]=[];let prev:number|null=null;
    const flush=()=>{if(current.length>1)result.push(current.join(" "));current=[];};
    for(const p of items){
      if(p.value===null||!Number.isFinite(p.value)||p.age<minAge||p.age>maxAge){flush();prev=null;continue;}
      if(prev!==null&&p.age-prev>(daily?3:2))flush();
      current.push(`${x(p.age).toFixed(2)},${y(p.value,i).toFixed(2)}`);prev=p.age;
    }
    flush();return result;
  };
  const tickAges=Array.from({length:10},(_,i)=>minAge+(maxAge-minAge)*i/9);
  const hoveredAge=hover===null?null:Math.round(hover);
  const tooltipMetrics = hoveredAge===null ? [] : visible.map(m=>({
    key:m.key,label:m.label,unit:m.unit,decimals:m.decimals,
    values:m.series.map(s=>({
      id:s.id,label:s.label,
      value:s.data.find(p=>p.age===hoveredAge)?.value ?? null,
      color:flockList.find(f=>f.id===s.id)?.color ?? "#456",
    })),
    standard: standards&&!hiddenReference ? m.reference.find(p=>p.age===hoveredAge)?.value ?? null : null,
  }));
  const tooltipWidth = Math.min(460, Math.max(300, 236 + flockList.length * 28));
  const tooltipHeight = Math.min(440, 51 + tooltipMetrics.reduce((total,m)=>total+39+(m.values.length+(m.standard!==null?1:0))*20,0));
  const tooltipX = hoveredAge!==null && x(hoveredAge) < L+PW*.53 ? L+PW-tooltipWidth-12 : L+12;
  const tooltipY = T+12;
  const toggleFlock=(id:number)=>setHiddenFlocks(ids=>ids.includes(id)?ids.filter(v=>v!==id):[...ids,id]);
  if(!charts.length)return <div style={{padding:20,color:"#617369"}}>Choose a metric above to display it on the graph.</div>;
  return <div style={{border:"1px solid #dce8e2",borderRadius:12,background:"white",padding:"7px 8px 5px",minWidth:0}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
      <strong style={{fontSize:12,color:"#164b37"}}>Flock performance comparison</strong>
      <span style={{fontSize:10,color:"#668074"}}>One graph · Aligned by biological age · Select flocks and metrics above</span>
    </div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:3}} aria-label="Toggle individual flock lines">
      {flockList.map(f=><button key={f.id} type="button" onClick={()=>toggleFlock(f.id)} aria-pressed={!hiddenFlocks.includes(f.id)} title={`Show or hide ${f.label}`} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 9px",border:"1px solid #dce8e2",borderRadius:20,background:hiddenFlocks.includes(f.id)?"#f3f5f4":"#f9fcfb",opacity:hiddenFlocks.includes(f.id)?.4:1,cursor:"pointer",fontSize:11,fontWeight:750,color:"#214a3d"}}><span style={{width:15,height:3,background:f.color,borderRadius:2}}/>{f.label} {hiddenFlocks.includes(f.id)?"(hidden)":"✓"}</button>)}
      {standards&&<button type="button" aria-pressed={!hiddenReference} onClick={()=>setHiddenReference(v=>!v)} style={{border:"1px solid #dce8e2",borderRadius:20,padding:"5px 9px",fontSize:11,background:"white",color:"#5b6972",opacity:hiddenReference?.45:1,cursor:"pointer"}}>┄┄ Standard {hiddenReference?"(hidden)":"✓"}</button>}
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Combined flock and metric comparison aligned by flock age" style={{width:"100%",height:"clamp(475px, calc(100dvh - 320px), 720px)",display:"block"}} onMouseLeave={()=>setHover(null)}>
      <defs><clipPath id={clipId}><rect x={L} y={T} width={PW} height={PH}/></clipPath></defs>
      <rect x={L} y={T} width={PW} height={PH} fill="#fbfdfc" rx="12"/>
      {Array.from({length:5},(_,i)=>T+PH*i/4).map((yy,i)=><line key={i} x1={L} x2={L+PW} y1={yy} y2={yy} stroke="#dfe8e3" strokeDasharray="3 7" opacity=".60"/>)}
      {tickAges.map((age,i)=><g key={i}><line x1={x(age)} x2={x(age)} y1={T} y2={T+PH} stroke="#edf2ef"/><text x={x(age)} y={H-28} fill="#62786b" textAnchor="middle" fontSize="11">{Math.round(age)}</text></g>)}
      {visible.map((m,i)=>{
        const axisX=L+PW+17+i*49; const range=ranges[i]; const axisColor=METRIC_COLORS[m.key] ?? "#506c5c";
        return <g key={`axis-${m.key}`}>
          <line x1={axisX} x2={axisX} y1={T} y2={T+PH} stroke={axisColor} strokeWidth="1" opacity=".78"/>
          {[0,1,2,3,4].map(t=>{const v=range.max-(range.max-range.min)*t/4;return <text key={t} x={axisX+4} y={T+PH*t/4+4} fontSize="9" fill={axisColor}>{v.toFixed(m.decimals)}</text>;})}
          <text x={axisX+3} y="13" fill={axisColor} fontSize="9" fontWeight="800">{m.label.slice(0,11)}</text>
        </g>;
      })}
      <g clipPath={`url(#${clipId})`}>
        {visible.map((m,i)=><g key={m.key}>
          {standards&&!hiddenReference&&segments(m.reference,i).map((path,k)=><polyline key={`standard-${k}`} points={path} fill="none" stroke="#98a7b2" strokeDasharray="4 6" strokeWidth="1.4" opacity=".66"/>)}
          {m.series.map(s=>{
            const fi=flockList.findIndex(f=>f.id===s.id);
            return <g key={s.id}>{segments(s.data,i).map((path,k)=><polyline key={k} points={path} stroke={COLORS[Math.max(0,fi)%COLORS.length]} strokeWidth={i===0?2.6:2.35} strokeDasharray={DASHES[i%DASHES.length]||undefined} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={i===0?1:.9}/>)}</g>;
          })}
        </g>)}
      </g>
      {hoveredAge!==null && visible.map((m,i)=>m.series.map(s=>{
        const v=s.data.find(p=>p.age===hoveredAge)?.value;
        if(v===null||v===undefined)return null;
        const color=flockList.find(f=>f.id===s.id)?.color??"#1677d2";
        return <circle key={`hover-${m.key}-${s.id}`} cx={x(hoveredAge)} cy={y(v,i)} r="5" fill="white" stroke={color} strokeWidth="2.5" pointerEvents="none"/>;
      }))}
      {hoveredAge!==null&&<line x1={x(hoveredAge)} x2={x(hoveredAge)} y1={T} y2={T+PH} stroke="#506c5c" strokeDasharray="4 4" pointerEvents="none"/>}
      <rect x={L} y={T} width={PW} height={PH} fill="transparent" style={{cursor:"crosshair"}} onMouseMove={e=>{const svg=e.currentTarget.ownerSVGElement;if(!svg)return;const ctm=svg.getScreenCTM();if(!ctm)return;const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const sx=pt.matrixTransform(ctm.inverse()).x;setHover(minAge+Math.max(0,Math.min(1,(sx-L)/PW))*(maxAge-minAge));}}/>
      {hoveredAge!==null && tooltipMetrics.length>0 && <foreignObject
        x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight}
        pointerEvents="none" style={{overflow:"visible"}}>
        <div style={{height:"100%",boxSizing:"border-box",border:"1px solid #dbe7e1",borderRadius:8,
          background:"rgba(255,255,255,.95)",boxShadow:"0 3px 12px rgba(15,50,36,.10)",
          padding:"8px 10px",fontFamily:"system-ui,sans-serif",color:"#173f2d",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,
            paddingBottom:5,borderBottom:"1px solid #e8f0eb"}}>
            <strong style={{fontSize:13}}>{daily?"Day":"Week"} {hoveredAge}</strong>
            <span style={{fontSize:9,color:"#74877c"}}>Flock comparison · {tooltipMetrics.length} metric{tooltipMetrics.length===1?"":"s"}</span>
          </div>
          <div style={{maxHeight:tooltipHeight-47,overflow:"hidden"}}>
            {tooltipMetrics.map(m=><div key={m.key} style={{marginBottom:5}}>
              <div style={{fontSize:10,fontWeight:800,background:"#f7faf8",padding:"3px 5px",borderRadius:4,
                display:"flex",justifyContent:"space-between"}}>
                <span>{m.label}</span><span style={{fontWeight:600,color:"#62776b"}}>{m.unit}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 60px 48px",gap:5,padding:"2px 4px",fontSize:9,color:"#7b8982"}}><span>Flock</span><span style={{textAlign:"right"}}>Actual</span><span style={{textAlign:"right"}}>Δ Std</span></div>
              {m.values.map(v=><div key={v.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 60px 48px",alignItems:"center",
                padding:"3px 4px",gap:5,fontSize:10,borderBottom:"1px solid #f1f4f2"}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:5,minWidth:0}}>
                  <i style={{height:7,width:7,flexShrink:0,borderRadius:"50%",background:v.color}}/>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.label}</span>
                </span>
                <strong style={{color:v.color,whiteSpace:"nowrap",textAlign:"right"}}>{v.value===null?"—":v.value.toFixed(m.decimals)}</strong>
                <strong style={{color:v.value===null||m.standard===null?"#84928b":v.value-m.standard>=0?"#16834f":"#d94841",textAlign:"right"}}>{v.value===null||m.standard===null?"—":`${v.value-m.standard>0?"+":""}${(v.value-m.standard).toFixed(m.decimals)}`}</strong>
              </div>)}
              {m.standard!==null && <div style={{display:"flex",justifyContent:"space-between",padding:"2px 4px",fontSize:10,color:"#73858b"}}>
                <span>Standard</span><b>{m.standard.toFixed(m.decimals)}</b>
              </div>}
            </div>)}
          </div>
        </div>
      </foreignObject>}
      <text x={L+PW/2} y={H-5} textAnchor="middle" fontSize="12" fontWeight="750" fill="#4b6758">Age in {daily?"days":"weeks"}</text>
    </svg>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"5px 0 3px"}} aria-label="Metric line styles">
      {visible.map((m,i)=><span key={m.key} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 8px",border:"1px solid #e0e9e4",borderRadius:20,fontSize:10,fontWeight:700,color:"#50685a"}}><svg width="19" height="9" aria-hidden="true"><line x1="0" x2="19" y1="4" y2="4" stroke="#465e54" strokeWidth="2.2" strokeDasharray={DASHES[i%DASHES.length]||undefined}/></svg>{m.label}{standards&&!hiddenReference?" · standard":""}</span>)}
    </div>
    <div style={{fontSize:9,color:"#6d8075",marginTop:1}}>Hover for flock values · Click flock labels to show/hide · Select metrics above · Dashed lines indicate standards.</div>
  </div>;
}
