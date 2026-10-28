"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";

type Card = { label:string; value:number|null; unit?:string };
type Column = {key:string; label:string};
type Response = {title:string;answer:string;scope:{start?:string;end?:string};cards:Card[];columns:Column[];rows:Record<string,string|number|null>[];chart:{title:string;metric:string;points:{date:string;value:number|null}[]}|null;observations:string[];capability:string};
function dateAU(value:string|undefined){if(!value)return "—";const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return parts?`${parts[3]}/${parts[2]}/${parts[1]}`:value;}
const examples = ["What data can you show me?", "Which sheds have the highest mortality over the last 10 days?", "Show production trends over the last 30 days", "Why has production dropped in Shed 1?", "Compare feed intake over the last 14 days"];
function show(value:string|number|null|undefined){return typeof value === "number"?value.toLocaleString("en-AU",{maximumFractionDigits:2}):value??"—";}
function Trend({data}:{data:NonNullable<Response["chart"]>}){
  // Missing dates/readings stay gaps; never connect two points across a missing value.
  const values=data.points.map(p=>p.value).filter((v):v is number=>v!==null);
  if(values.length<2)return <p style={{fontSize:12,color:"#718579"}}>Insufficient data for a trend graph.</p>;
  const min=Math.min(...values), max=Math.max(...values), padding=Math.max((max-min)*0.1,0.01),low=min-padding,high=max+padding;
  const x=(i:number)=>36+i*730/Math.max(data.points.length-1,1);
  const y=(v:number)=>155-(v-low)/(high-low)*130;
  const segments:string[]=[];let active:string[]=[];
  data.points.forEach((p,i)=>{if(p.value!==null)active.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);else{if(active.length>1)segments.push(active.join(" "));active=[];}});
  if(active.length>1)segments.push(active.join(" "));
  return <section style={{border:"1px solid #dce8e1",padding:12,background:"white",borderRadius:9}}><strong>{data.title}</strong><svg viewBox="0 0 800 190" role="img" aria-label={`${data.metric} time series`} style={{width:"100%",maxHeight:250,display:"block",marginTop:8}}><line x1="36" y1="155" x2="770" y2="155" stroke="#c9d9d1"/><text x="3" y="28" fontSize="11" fill="#576e62">{show(max)}</text><text x="3" y="154" fontSize="11" fill="#576e62">{show(min)}</text>{segments.map((points,i)=><polyline key={i} points={points} fill="none" stroke="#08735a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}<text x="36" y="178" fontSize="11" fill="#576e62">{dateAU(data.points[0]?.date)}</text><text x="770" y="178" textAnchor="end" fontSize="11" fill="#576e62">{dateAU(data.points[data.points.length-1]?.date)}</text></svg></section>;
}
function Content(){
  const params=useSearchParams();const [question,setQuestion]=useState("");const [period,setPeriod]=useState("question");const [fromDate,setFromDate]=useState("");const [toDate,setToDate]=useState("");const [result,setResult]=useState<Response|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function ask(nextQuestion=question){
    setBusy(true);setError("");setResult(null);
    try{const companyId=Number(params.get("company_id"));const response=await fetch("/api/intelligence/ask",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:nextQuestion,module:"layers",company_id:companyId>0?companyId:null,...(period==="custom"?{start_date:fromDate||null,end_date:toDate||null}:{}),...(period!=="question"&&period!=="custom"?{question:nextQuestion+` over the last ${period} days`}:{})})});
      if(response.status===401){window.location.href=`/login?next=${encodeURIComponent(window.location.pathname+window.location.search)}`;return;}
      const payload=await response.json();if(!response.ok)throw new Error(typeof payload.detail==="string"?payload.detail:"Unable to complete the analysis");setResult(payload as Response);
    }catch(err){setError(err instanceof Error?err.message:"Request failed");}finally{setBusy(false);}
  }
  return <OviCoreShell module="layers"><div style={{padding:"12px",display:"grid",gap:10}}>
    <OviCorePageHeader title="OviCore AI Intelligence" subtitle="Ask questions about authorised farm data · Commercial Layers connected first"/>
    <section style={{background:"white",padding:12,border:"1px solid #d8e6de",borderRadius:10}}><label htmlFor="question" style={{fontSize:13,fontWeight:800,display:"block",marginBottom:6}}>Ask OviCore</label><textarea id="question" rows={3} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about mortality, production, water, feed, FCR or a shed investigation…" style={{width:"100%",padding:10,border:"1px solid #c9dbd1",borderRadius:7,fontSize:13}}/><button type="button" onClick={()=>void ask()} disabled={busy||question.trim().length<3} style={{padding:"8px 17px",borderRadius:7,color:"white",background:"#08735a",marginTop:8,opacity:busy?0.6:1}}>{busy?"Analysing…":"Analyse"}</button><div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>{examples.map(example=><button key={example} type="button" disabled={busy} onClick={()=>{setQuestion(example);void ask(example);}} style={{border:"1px solid #d8e5df",background:"#f5faf7",borderRadius:7,padding:"5px 9px",fontSize:11,color:"#315d4c",cursor:"pointer"}}>{example}</button>)}</div></section>
    {error&&<div role="alert" style={{color:"#a53b30",fontSize:13}}>{error}</div>}
    {result&&<><section style={{background:"white",border:"1px solid #dce8e1",borderRadius:9,padding:12}}><h2 style={{fontWeight:800,fontSize:17,margin:"0 0 7px"}}>{result.title}</h2><p style={{fontSize:13,margin:0}}>{result.answer}</p>{result.scope.start&&<p style={{fontSize:11,color:"#687f72",margin:"6px 0 0"}}>Period: {dateAU(result.scope.start)} to {dateAU(result.scope.end)}</p>}</section>
      {result.cards.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:7}}>{result.cards.map(card=><section key={card.label} style={{background:"white",border:"1px solid #dce8e1",padding:10,borderRadius:8}}><div style={{fontSize:11,color:"#637a6d"}}>{card.label}</div><strong style={{fontSize:19}}>{show(card.value)}{card.value===null?"":card.unit??""}</strong></section>)}</div>}
      {result.chart&&<Trend data={result.chart}/>}
      {result.columns.length>0&&<section style={{overflowX:"auto",background:"white",border:"1px solid #dce8e1",borderRadius:8}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr>{result.columns.map(c=><th key={c.key} style={{padding:9,textAlign:"left",borderBottom:"1px solid #dce8e1",whiteSpace:"nowrap"}}>{c.label}</th>)}</tr></thead><tbody>{result.rows.map((row,i)=><tr key={`${row.id}-${i}`}>{result.columns.map(col=><td key={col.key} style={{padding:9,borderBottom:"1px solid #edf2ee",whiteSpace:"nowrap"}}>{show(row[col.key])}</td>)}</tr>)}</tbody></table>{!result.rows.length&&<p style={{padding:12,fontSize:12}}>No matching reporting records.</p>}</section>}
      {result.observations.length>0&&<section style={{background:"white",border:"1px solid #dce8e1",borderRadius:9,padding:12,fontSize:12}}><strong>{result.capability==="capabilities"?"Questions to try":"OviCore observations"}</strong><ul style={{margin:"7px 0 0",paddingLeft:20}}>{result.observations.map((item,i)=><li key={i} style={{marginBottom:5}}>{item}</li>)}</ul></section>}
      <p style={{fontSize:11,color:"#687f72"}}>Read-only analysis. OviCore does not infer causation from parallel changes or replace on-farm welfare inspections. Figures reflect available entered data.</p>
    </>}
  </div></OviCoreShell>;
}
export default function IntelligencePage(){return <Suspense fallback={null}><Content/></Suspense>;}
