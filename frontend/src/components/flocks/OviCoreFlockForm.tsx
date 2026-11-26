"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./OviCoreFlockForm.module.css";

type Shed = {id:number; farm_id:number; farm_name:string; shed_name:string; shed_code?:string; floor_area_m2:number; capacity_birds?:number; default_density_kg_m2:number; default_target_lw_kg:number; default_growout_days:number};
type Context = {company_id:number; company_name:string; sheds:Shed[]};
async function request(url:string, init?:RequestInit) {
  const res=await fetch(url,{...init,credentials:"include",cache:"no-store"});
  const data=await res.json().catch(()=>null);
  if(!res.ok) throw new Error(typeof data?.detail==="string"?data.detail:`Request failed (${res.status})`);
  return data;
}
export default function OviCoreFlockForm({companyId,onClose,onCreated}:{companyId:number;onClose:()=>void;onCreated:()=>void|Promise<void>}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [context,setContext]=useState<Context|null>(null), [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const [farm,setFarm]=useState(""), [shedId,setShedId]=useState(""), [code,setCode]=useState(""), [placement,setPlacement]=useState(""), [birds,setBirds]=useState(""), [density,setDensity]=useState(""), [weight,setWeight]=useState(""), [days,setDays]=useState(""), [allowance,setAllowance]=useState("1.5"), [notes,setNotes]=useState("");
  useEffect(()=>{dialog.current?.showModal(); let live=true; request(`/api/broilers/flock-creation-context?company_id=${companyId}`).then(c=>{if(live)setContext(c)}).catch(e=>{if(live)setError(e.message)}); return ()=>{live=false};},[companyId]);
  const sheds=context?.sheds??[], shed=sheds.find(s=>String(s.id)===shedId);
  const farms=Array.from(new Map(sheds.map(s=>[s.farm_id,s.farm_name])).entries());
  const capacity=shed&&Number(weight)>0&&Number(density)>0?Math.floor(shed.floor_area_m2*Number(density)/Number(weight)):null;
  const pickup=placement&&Number(days)>0?new Date(new Date(placement+"T00:00:00Z").getTime()+Number(days)*86400000).toISOString().slice(0,10):"—";
  function chooseShed(id:string){setShedId(id);const s=sheds.find(x=>String(x.id)===id);if(s){setDensity(String(s.default_density_kg_m2));setWeight(String(s.default_target_lw_kg));setDays(String(s.default_growout_days));setCode(`BR-${s.id}-${Date.now().toString(36).toUpperCase()}`);}}
  async function submit(e:FormEvent){e.preventDefault();if(busy||!shed||!context)return;setBusy(true);setError("");try{await request("/api/broilers/flock-creation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company_id:companyId,farm_id:shed.farm_id,shed_id:shed.id,cycle_code:code,placement_date:placement,planned_birds:Number(birds),target_density_kg_m2:Number(density),target_lw_kg:Number(weight),growout_days:Number(days),chick_allowance_pct:Number(allowance),notes,status:"Planned"})});onClose();await onCreated();}catch(e){setError(e instanceof Error?e.message:"Could not create flock");setBusy(false);}}
  return <dialog ref={dialog} className={styles.dialog} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="new-flock-title"><form onSubmit={submit}><header className={styles.header}><div><small>OVICORE · BROILER PRODUCTION</small><h2 id="new-flock-title">Create new flock</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close">×</button></header><div className={styles.body}>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {!context&&!error&&<p>Loading authorised farms and sheds…</p>}
  {context&&<><div className={styles.context}><strong>{context.company_name}</strong><span>Broilers · Planned placement</span></div><h3>Flock identity</h3><div className={styles.grid}>
  <label>Farm<select required value={farm} onChange={e=>{setFarm(e.target.value);setShedId("");setCode("");}}><option value="">Select farm</option>{farms.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  <label>Shed<select required value={shedId} onChange={e=>chooseShed(e.target.value)}><option value="">Select shed</option>{sheds.filter(s=>String(s.farm_id)===farm).map(s=><option key={s.id} value={s.id}>{s.shed_name}</option>)}</select></label>
  <label>Flock code<input required maxLength={100} value={code} onChange={e=>setCode(e.target.value)}/></label><label>Planned placement date<input required type="date" value={placement} onChange={e=>setPlacement(e.target.value)}/></label></div>
  <h3>Placement & planning targets</h3><div className={styles.grid}>
  <label>Planned birds<input required type="number" min="1" step="1" value={birds} onChange={e=>setBirds(e.target.value)}/></label><label>Grow-out days<input required type="number" min="1" max="365" value={days} onChange={e=>setDays(e.target.value)}/></label>
  <label>Target density (kg/m²)<input required type="number" min="0.01" max="99.99" step="0.01" value={density} onChange={e=>setDensity(e.target.value)}/></label><label>Target liveweight (kg)<input required type="number" min="0.01" max="19.99" step="0.01" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
  <label>Chick allowance (%)<input required type="number" min="0" max="100" step="0.01" value={allowance} onChange={e=>setAllowance(e.target.value)}/></label><label>Shed floor area (m²)<input readOnly value={shed?.floor_area_m2??""}/></label></div>
  <div className={styles.context}><span>Estimated final pickup: <strong>{pickup}</strong></span><span>Calculated capacity: <strong>{capacity?.toLocaleString()??"—"}</strong></span></div>
  {capacity!==null&&Number(birds)>capacity&&<p className={styles.error}>Planned birds exceed the simple target-density estimate. Review thinning and stocking targets before placement.</p>}
  <label>Planning notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><p className={styles.hint}>Creates a planned cycle only. Actual placement, breed and supplier/programme assignments are not part of this pilot.</p></>}
  </div><footer className={styles.footer}><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" disabled={busy||!context||!shed} className={styles.primary}>{busy?"Creating…":"Create planned flock"}</button></footer></form></dialog>;
}
