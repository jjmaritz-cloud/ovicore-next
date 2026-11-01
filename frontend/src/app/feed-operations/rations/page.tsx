"use client";
import Link from "next/link";
import {useState} from "react";
import {Ration,newId,useCatalog,totalInclusion,knownCost} from "../../../components/feed-operations/catalog";
import s from "../../../components/feed-operations/catalog.module.css";
type Line={ingredientId:string;percent:number};
const BLANK={code:"",name:"",phase:"Layer 1",type:"Base" as "Base"|"Medicated",baseId:"",status:"Draft" as "Draft"|"Approved"|"Inactive",notes:"",lines:[] as Line[]};
export default function RationsPage(){
  const {catalog,save,ready}=useCatalog();const [form,setForm]=useState({...BLANK});const [edit,setEdit]=useState("");const [search,setSearch]=useState("");const [message,setMessage]=useState("");
  const set=<K extends keyof typeof BLANK>(key:K,value:(typeof BLANK)[K])=>setForm(p=>({...p,[key]:value}));
  const reset=()=>{setForm({...BLANK,lines:[]});setEdit("");setMessage("");};
  const addLine=()=>{const next=catalog.ingredients.find(i=>i.status==="Active"&&!form.lines.some(l=>l.ingredientId===i.id));if(next)set("lines",[...form.lines,{ingredientId:next.id,percent:0}]);};
  const changeLine=(index:number,patch:Partial<Line>)=>set("lines",form.lines.map((l,j)=>index===j?{...l,...patch}:l));
  const baseChoices=catalog.rations.filter(r=>r.type==="Base"&&r.id!==edit&&r.status==="Approved");
  const submit=(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");const code=form.code.trim().toUpperCase();const name=form.name.trim();const sum=form.lines.reduce((a,l)=>a+l.percent,0);
    if(!code||!name){setMessage("Ration code and name are required.");return;}
    if(catalog.rations.some(r=>r.code.toUpperCase()===code&&r.id!==edit)){setMessage("Ration code must be unique.");return;}
    if(form.type==="Medicated"&&!baseChoices.some(r=>r.id===form.baseId)){setMessage("Select an existing base ration before saving a medicated variant.");return;}
    if(form.lines.some(l=>!l.ingredientId||!Number.isFinite(l.percent)||l.percent<=0)||new Set(form.lines.map(l=>l.ingredientId)).size!==form.lines.length){setMessage("Each inclusion needs a unique ingredient and percentage greater than zero.");return;}
    if(form.status==="Approved"&&(form.lines.length===0||Math.abs(sum-100)>0.001)){setMessage("Approved ration inclusions must total exactly 100%.");return;}
    if(sum>100.001){setMessage("Ingredient inclusions cannot exceed 100%.");return;}
    const item:Ration={...form,id:edit||newId(),code,name,baseId:form.type==="Base"?"":form.baseId};
    if(save({...catalog,rations:edit?catalog.rations.map(r=>r.id===edit?item:r):[...catalog.rations,item]})){reset();setMessage("Ration saved in this browser only.");}else setMessage("Could not save in browser storage.");
  };
  const choose=(r:Ration)=>{setEdit(r.id);setForm({code:r.code,name:r.name,phase:r.phase,type:r.type,baseId:r.baseId,status:r.status,notes:r.notes,lines:r.lines.map(l=>({...l}))});setMessage("");window.scrollTo({top:0,behavior:"smooth"});};
  const visible=catalog.rations.filter(r=>`${r.code} ${r.name} ${r.phase} ${r.type}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.code.localeCompare(b.code));
  const cost=knownCost({...form,id:""},catalog.ingredients);
  return <main className={s.root}><div className={s.wrap}><header className={s.header}><div><div className={s.eyebrow}>OVICORE ECOSYSTEM / FEED OPERATIONS</div><h1 className={s.title}>Ration Library</h1><div className={s.sub}>Base diets, medicated variants, production phases and ingredient composition</div></div><nav className={s.nav}><Link href="/feed-operations">Feed Operations</Link><Link href="/feed-operations/ingredients">Diet Ingredients →</Link></nav></header>
    <div className={s.notice}><strong>Prototype:</strong> Saves in this browser only. An “Approved” label here is a draft workflow status, not clinical, veterinary or nutritional approval. Do not use prototype diets for feed manufacturing or medication instructions.</div>
    <section className={s.section}><div className={s.heading}><h2>Ration Management</h2><span className={s.muted}>{ready?`${catalog.rations.length} rations` : "Loading"}</span></div><div className={s.cols}>
      <div className={s.card}><h3>{edit?"Edit Ration":"Create Ration"}</h3><form className={s.form} onSubmit={submit}>
        <label className={s.field}>OviCore Ration Code *<input value={form.code} onChange={e=>set("code",e.target.value)} maxLength={32} required placeholder="e.g. LAY-01"/></label>
        <label className={s.field}>Ration Description *<input value={form.name} onChange={e=>set("name",e.target.value)} required placeholder="Layer 1"/></label>
        <label className={s.field}>Production Phase<select value={form.phase} onChange={e=>set("phase",e.target.value)}>{["Starter","Grower","Developer","Pre-peaking","Layer 1","Layer 2","Layer 3","Layer 4","Broiler Starter","Broiler Grower","Broiler Finisher","Breeder","Other"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className={s.field}>Ration Type<select value={form.type} onChange={e=>set("type",e.target.value as "Base"|"Medicated")}><option>Base</option><option>Medicated</option></select></label>
        {form.type==="Medicated"&&<label className={`${s.field} ${s.wide}`}>Linked Base Ration *<select required value={form.baseId} onChange={e=>set("baseId",e.target.value)}><option value="">Select approved base diet</option>{baseChoices.map(r=><option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</select></label>}
        <label className={s.field}>Workflow Status<select value={form.status} onChange={e=>set("status",e.target.value as typeof form.status)}><option>Draft</option><option>Approved</option><option>Inactive</option></select></label>
        <label className={`${s.field} ${s.wide}`}>Notes / Specifications<textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Nutritional targets, version notes, external approvals (record references only)"/></label>
        <div className={s.wide}><div className={s.heading}><h3>Ingredient Inclusions</h3><button className={`${s.button} ${s.secondary}`} type="button" disabled={!catalog.ingredients.some(i=>i.status==="Active"&&!form.lines.some(l=>l.ingredientId===i.id))} onClick={addLine}>+ Ingredient</button></div>
        {form.lines.map((l,j)=><div className={s.lineGrid} key={j}><label className={s.field}>Ingredient<select value={l.ingredientId} onChange={e=>changeLine(j,{ingredientId:e.target.value})}>{catalog.ingredients.filter(i=>i.status==="Active"||i.id===l.ingredientId).map(i=><option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</select></label><label className={s.field}>Inclusion %<input type="number" min="0.0001" max="100" step="0.0001" value={l.percent} onChange={e=>changeLine(j,{percent:Number(e.target.value)})}/></label><button className={`${s.button} ${s.danger}`} type="button" onClick={()=>set("lines",form.lines.filter((_,k)=>k!==j))}>×</button></div>)}
        <div className={s.muted}>Total: <strong>{form.lines.reduce((a,l)=>a+l.percent,0).toFixed(3)}%</strong> / 100% · Indicative ingredient cost: <strong>{form.lines.length&&cost.complete?`$${cost.cost.toFixed(2)}/t`:"Not available"}</strong> (excludes milling, freight and medication costs)</div></div>
        <div className={`${s.controls} ${s.wide}`}><button className={s.button} type="submit">{edit?"Save Changes":"Create Ration"}</button><button type="button" className={`${s.button} ${s.secondary}`} onClick={reset}>Clear</button></div>
      </form>{message&&<div className={message.startsWith("Ration saved")?s.good:s.error}>{message}</div>}</div>
      <div className={s.card}><div className={s.heading}><h3>Ration Register</h3><input className={s.search} style={{maxWidth:240}} aria-label="Search rations" placeholder="Search rations…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Code</th><th>Ration</th><th>Phase</th><th>Type</th><th>Inclusion</th><th>Ingredient Cost</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(r=>{const c=knownCost(r,catalog.ingredients);return <tr key={r.id}><td><strong>{r.code}</strong></td><td>{r.name}</td><td>{r.phase}</td><td><span className={`${s.pill} ${r.type==="Medicated"?s.warn:""}`}>{r.type}</span></td><td>{totalInclusion(r).toFixed(2)}%</td><td>{r.lines.length&&c.complete?`$${c.cost.toFixed(2)}/t`:"—"}</td><td>{r.status}</td><td><button className={s.action} type="button" onClick={()=>choose(r)}>Edit</button></td></tr>})}{visible.length===0&&<tr><td colSpan={8} className={s.muted}>No rations found. Add ingredients first, then create a ration.</td></tr>}</tbody></table></div></div></div></section><div className={s.foot}>OviCore Ecosystem · Intelligence That Drives Performance.</div></div></main>;
}
