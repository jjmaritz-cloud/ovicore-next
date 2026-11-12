"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import styles from "./page.module.css";

type Mill = { id:string; name:string; code:string };
type Ration = { id:string; name:string; code:string; mill_id:string; status:string };
type Flock = { id:number; flock_code:string; farm_name:string; shed_name:string };
type Stage = { start_week:number; end_week:number; ration_id:string; ration_code?:string; ration_name?:string };
type EnergyRation = { id:string; code:string; name:string; status:string; amen_kcal_kg:number|null; mill_id:string; error:string|null };
type EnergyHistory = {id:string; effective_from:string; ration_code:string; amen_kcal_kg:number; source:string};
type Program = { id:string; name:string; mill_id:string; version:number; stages:Stage[]; status:string };

const get = async (url:string, init:RequestInit={}) => {
  const r = await fetch(url,{...init,credentials:"include",cache:"no-store"});
  if(!r.ok){let message=`HTTP ${r.status}`; try{const data=await r.json();message=data.detail || message;}catch{} throw new Error(String(message));}
  return r.json();
};

function FeedingProgramsContent(){
  const params=useSearchParams();
  const {currentUser,loadingUser}=useCurrentUser();
  const companyId=useMemo(()=>currentUser?.is_global_admin ? Number(params.get("company_id")) || 0 : currentUser?.company_id || 0,[currentUser,params]);
  const editor=!!(currentUser?.is_global_admin || currentUser?.is_company_admin);
  const [mills,setMills]=useState<Mill[]>([]);
  const [rations,setRations]=useState<Ration[]>([]);
  const [flocks,setFlocks]=useState<Flock[]>([]);
  const [programs,setPrograms]=useState<Program[]>([]);
  const [mill,setMill]=useState("");
  const [name,setName]=useState("");
  const [stages,setStages]=useState<Stage[]>([{start_week:17,end_week:44,ration_id:""}]);
  const [flock,setFlock]=useState("");
  const [program,setProgram]=useState("");
  const [current,setCurrent]=useState<Program|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [energyRations,setEnergyRations]=useState<EnergyRation[]>([]);
  const [energyHistory,setEnergyHistory]=useState<EnergyHistory[]>([]);
  const [actualRation,setActualRation]=useState("");
  const [effectiveDate,setEffectiveDate]=useState("");
  const [actualConfirmed,setActualConfirmed]=useState(false);
  const prefix=`?company_id=${companyId}`;
  const refresh=useCallback(async()=>{
    if(!companyId)return;
    try{
      const [p,catalog,f]=await Promise.all([
        get(`/api/feed-operations/programs${prefix}`),
        get(`/api/feed-operations/catalog${prefix}`),
        get(`/api/layers/commercial/flocks${prefix}`),
      ]);
      setPrograms(p);setRations((catalog.rations || []).map((r:Ration & {millId?:string})=>({...r,mill_id:r.millId || r.mill_id})));setMills(catalog.mills || []);setFlocks(f);
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to load feeding programs");}
  },[companyId,prefix]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!flock || !companyId){setCurrent(null);setEnergyHistory([]);return;}
    let active=true;
    void Promise.all([
      get(`/api/feed-operations/programs/flock?company_id=${companyId}&flock_id=${flock}`),
      get(`/api/feed-operations/energy/assignments?company_id=${companyId}&flock_id=${flock}`),
      get(`/api/feed-operations/energy/rations?company_id=${companyId}`),
    ]).then(([v,h,r])=>{if(active){setCurrent(v.program);setProgram(v.program?.id || "");setEnergyHistory(h);setEnergyRations(r);}})
      .catch(e=>{if(active)setMessage(String(e));});
    return()=>{active=false;};
  },[flock,companyId]);
  const eligibleRations=rations.filter(r=>r.mill_id===mill&&r.status==="Approved");
  const selectedProgram=programs.find(p=>p.id===program);
  const save=async()=>{
    if(!companyId||!mill||!name.trim()||stages.some(s=>!s.ration_id))return;
    setBusy(true);setMessage("");
    try{const saved=await get(`/api/feed-operations/programs${prefix}`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:name.trim(),mill_id:mill,stages})});
      setMessage(`Approved ${saved.name} v${saved.version}. Existing versions remain unchanged.`);
      await refresh();
    }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  };
  const assign=async()=>{
    if(!companyId||!flock||!program)return;
    setBusy(true);setMessage("");
    try{const result=await get(`/api/feed-operations/programs/flock${prefix}`,{
      method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({flock_id:Number(flock),program_id:program})});
      setCurrent(result.program);setMessage("Program assigned. Actual ration history is unchanged until a confirmed feeding event is saved.");
    }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  };
  const confirmActual=async()=>{
    if(!flock||!actualRation||!effectiveDate||!actualConfirmed||!companyId)return;
    setBusy(true);setMessage("");
    try{
      await get(`/api/feed-operations/energy/assignments?company_id=${companyId}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({flock_id:Number(flock),ration_id:actualRation,effective_from:effectiveDate,confirmed_actual_change:true})});
      const updated=await get(`/api/feed-operations/energy/assignments?company_id=${companyId}&flock_id=${flock}`);
      setEnergyHistory(updated);setActualConfirmed(false);setActualRation("");setMessage("Actual ration change confirmed and stored as an immutable AMEn snapshot. The Performance graph will use this history.");
    }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  };
  if(loadingUser)return <main className={styles.page}>Loading…</main>;
  if(!companyId)return <main className={styles.page}>Select a working company in OviCore to manage feeding programs.</main>;
  return <main className={styles.page}><div className={styles.container}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>FEED OPERATIONS / FLOCK MANAGEMENT</span><h1>Feeding Program Management</h1><p>Approved mill-specific stages, flock assignments and planned ration transitions. No automatic ration switching.</p></div><Link href={`/feed-operations${prefix}`} className={styles.back}>Back to Feed Operations</Link></header>
    <div className={styles.grid}>
      <section className={styles.panel}><h2>Approved programs</h2><p>Versions are immutable. Saving the same name creates a new version.</p>
        {programs.length?programs.map(p=><div key={p.id} className={styles.program}><strong>{p.name} · v{p.version}</strong><small>{mills.find(m=>m.id===p.mill_id)?.name || p.mill_id} · {p.stages.length} stages</small><div>{p.stages.map((s,i)=><span key={i}>{s.start_week}–{s.end_week} wk: {s.ration_code} </span>)}</div></div>):<div className={styles.empty}>No approved programs yet.</div>}
      </section>
      <section className={styles.panel}><h2>Build a feeding program</h2><p>Only approved rations from the same mill are available.</p>
        <label>Program name<input disabled={!editor} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alternative Layers"/></label>
        <label>Feed mill<select disabled={!editor} value={mill} onChange={e=>{setMill(e.target.value);setStages([{start_week:17,end_week:44,ration_id:""}]);}}><option value="">Select mill</option>{mills.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        {stages.map((s,i)=><div className={styles.stage} key={i}>
          <label>From week<input type="number" min="0" max="120" disabled={!editor} value={s.start_week} onChange={e=>setStages(v=>v.map((x,j)=>j===i?{...x,start_week:Number(e.target.value)}:x))}/></label>
          <label>To week<input type="number" min="0" max="130" disabled={!editor} value={s.end_week} onChange={e=>setStages(v=>v.map((x,j)=>j===i?{...x,end_week:Number(e.target.value)}:x))}/></label>
          <label>Ration<select disabled={!editor||!mill} value={s.ration_id} onChange={e=>setStages(v=>v.map((x,j)=>j===i?{...x,ration_id:e.target.value}:x))}><option value="">Select approved ration</option>{eligibleRations.map(r=><option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</select></label>
          {editor&&<button type="button" className={styles.smallButton} onClick={()=>setStages(v=>v.filter((_,j)=>j!==i))} disabled={stages.length===1}>Remove</button>}
        </div>)}
        {editor&&<><button type="button" className={styles.secondary} onClick={()=>setStages(v=>[...v,{start_week:(v[v.length-1]?.end_week??16)+1,end_week:(v[v.length-1]?.end_week??16)+12,ration_id:""}])}>Add stage</button><button type="button" className={styles.button} disabled={busy||!mill||!name.trim()||stages.some(s=>!s.ration_id)} onClick={()=>void save()}>Save approved program version</button></>}
      </section>
    </div>
    <section className={styles.panel}><h2>Assign program to Commercial Layer flock</h2><p>The selected program will appear on the Performance graph. It does not set the actual ration being fed.</p>
      <div className={styles.assign}><label>Flock<select value={flock} onChange={e=>setFlock(e.target.value)}><option value="">Select flock</option>{flocks.map(f=><option key={f.id} value={f.id}>{f.farm_name} / {f.shed_name} / {f.flock_code}</option>)}</select></label><label>Approved feeding program<select disabled={!editor} value={program} onChange={e=>setProgram(e.target.value)}><option value="">Select program</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name} · v{p.version} · {mills.find(m=>m.id===p.mill_id)?.name || p.mill_id}</option>)}</select></label>{editor&&<button type="button" className={styles.button} disabled={busy||!program||!flock} onClick={()=>void assign()}>Assign program</button>}</div>
      {current&&<p className={styles.status}>Assigned: {current.name} v{current.version} ({current.stages.length} planned stages)</p>}
      {selectedProgram&&<p className={styles.info}>Selected: {selectedProgram.stages.map(s=>`${s.start_week}–${s.end_week}w ${s.ration_code}`).join(" · ")}</p>}
      {flock&&<Link href={`/layers/commercial/performance?company_id=${companyId}`} className={styles.back}>Open Performance graph</Link>}
    </section>
    <section className={styles.panel}><h2>Confirm actual ration change</h2>
      <p>Only confirmed actual changes affect energy reporting. Planned stage ages never automatically change the ration.</p>
      <div className={styles.assign}>
        <label>Approved actual ration<select value={actualRation} disabled={!editor||!flock} onChange={e=>{setActualRation(e.target.value);setActualConfirmed(false);}}>
          <option value="">Select the ration actually fed</option>
          {energyRations.filter(r=>r.status==="Approved").map(r=><option key={r.id} value={r.id} disabled={r.amen_kcal_kg===null}>
            {r.code} · {r.name} {r.amen_kcal_kg!==null?`(${r.amen_kcal_kg.toFixed(0)} kcal/kg)`:`(AMEn unavailable)`}
          </option>)}
        </select></label>
        <label>Actually fed from<input type="date" value={effectiveDate} onChange={e=>{setEffectiveDate(e.target.value);setActualConfirmed(false);}} disabled={!editor||!flock}/></label>
        <label className={styles.check}><input type="checkbox" checked={actualConfirmed} disabled={!editor||!flock} onChange={e=>setActualConfirmed(e.target.checked)}/> I confirm this ration was actually fed from this date.</label>
      </div>
      {editor&&<button className={styles.button} type="button" disabled={busy||!flock||!actualRation||!effectiveDate||!actualConfirmed} onClick={()=>void confirmActual()}>Confirm actual ration change</button>}
      {energyHistory.length>0&&<div className={styles.program}><strong>Confirmed actual history</strong>{energyHistory.map(h=><div key={h.id}>{h.effective_from} · {h.ration_code} · {h.amen_kcal_kg.toFixed(0)} kcal/kg · {h.source}</div>)}</div>}
    </section>
    {message&&<p role="status" className={styles.message}>{message}</p>}
    <p className={styles.foot}>Actual changes are recorded separately with confirmed effective dates and ration AMEn snapshots. Age thresholds remain advisory.</p>
  </div></main>;
}

export default function FeedingProgramsPage(){ return <Suspense fallback={<main>Loading feeding programs…</main>}><FeedingProgramsContent/></Suspense>; }
