"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, Copy, Download, FilePlus2, Lightbulb, Plus, Save, ShieldAlert, Trash2, Wheat, Syringe, Stethoscope } from "lucide-react";

type ProgramKind = "feed" | "lighting" | "vaccination" | "treatment";
type BMPTask = { id: string; kind: ProgramKind; startWeek: string; endWeek: string; title: string; instructions: string; responsible: string; requiresSignoff: boolean };
type BMP = { id: string; name: string; productionSystem: string; breed: string; mill: string; version: number; status: "Draft"; tasks: BMPTask[]; updated: string };
const KINDS: { id: ProgramKind; label: string; icon: typeof Wheat }[] = [
  { id:"feed", label:"Feed program", icon:Wheat },
  { id:"lighting", label:"Lighting program", icon:Lightbulb },
  { id:"vaccination", label:"Vaccination program", icon:Syringe },
  { id:"treatment", label:"Treatment program", icon:Stethoscope },
];
const KEY = "ovicore_bmp_designer_drafts_v1";
const baseTasks: BMPTask[] = [
  {id:"demo-feed-1",kind:"feed",startWeek:"16",endWeek:"21",title:"Pre-peaking",instructions:"Planned phase only; confirm actual ration, mill and switch date separately.",responsible:"Farm Manager",requiresSignoff:false},
  {id:"demo-feed-2",kind:"feed",startWeek:"22",endWeek:"44",title:"Layer 1",instructions:"Planned phase; do not automatically change actual ration.",responsible:"Farm Manager",requiresSignoff:false},
  {id:"demo-feed-3",kind:"feed",startWeek:"45",endWeek:"55",title:"Layer 2",instructions:"Review remaining silo feed before confirming transition.",responsible:"Farm Manager",requiresSignoff:false},
  {id:"demo-feed-4",kind:"feed",startWeek:"56",endWeek:"70",title:"Layer 3",instructions:"Review planned change with approved feeding instructions.",responsible:"Farm Manager",requiresSignoff:false},
  {id:"demo-feed-5",kind:"feed",startWeek:"71",endWeek:"",title:"Layer 4",instructions:"Planned phase; actual feed requires authorised confirmation.",responsible:"Farm Manager",requiresSignoff:false},
  {id:"demo-light",kind:"lighting",startWeek:"22",endWeek:"",title:"Lighting program review",instructions:"Enter the approved lighting schedule, on/off times and lux by flock age.",responsible:"Farm Manager",requiresSignoff:true},
  {id:"demo-vax",kind:"vaccination",startWeek:"",endWeek:"",title:"Vaccination schedule placeholder",instructions:"Enter only approved veterinary schedule, product, timing and administration instructions.",responsible:"Authorised operator",requiresSignoff:true},
  {id:"demo-treatment",kind:"treatment",startWeek:"",endWeek:"",title:"Treatment schedule placeholder",instructions:"Requires veterinary-approved protocol and applicable withholding instructions.",responsible:"Authorised operator",requiresSignoff:true},
];
const initialBMP: BMP = {id:"example",name:"Alternative Layers — example BMP",productionSystem:"Commercial Layers — Alternative",breed:"",mill:"",version:1,status:"Draft",tasks:baseTasks,updated:"Demo template"};
const id = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyTask = (kind: ProgramKind):BMPTask => ({id:id(),kind,startWeek:"",endWeek:"",title:"",instructions:"",responsible:"Farm Manager",requiresSignoff:kind==="vaccination"||kind==="treatment"});
const textInput = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600";

export default function FlockManagementPage() {
  const [programs,setPrograms] = useState<BMP[]>([initialBMP]);
  const [selectedId,setSelectedId] = useState("example");
  const [kind,setKind] = useState<ProgramKind>("feed");
  const [ready,setReady] = useState(false);
  const [message,setMessage] = useState("");
  const [editingTask,setEditingTask] = useState<string|null>(null);
  useEffect(()=>{try{const raw=window.localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length&&parsed.every((x)=>x&&typeof x.id==="string"&&Array.isArray(x.tasks))){setPrograms(parsed);setSelectedId(parsed[0].id);}}}catch{}setReady(true);},[]);
  const selected=programs.find(x=>x.id===selectedId)||programs[0];
  const rows=useMemo(()=>selected?.tasks.filter(t=>t.kind===kind)||[],[selected,kind]);
  const problems=useMemo(()=>{
    if(!selected)return [];
    const issues:string[]=[];
    const list=selected.tasks;
    for(const t of list){if(!t.title.trim())issues.push("One or more tasks have no name");if(t.startWeek!==""&&(!Number.isInteger(Number(t.startWeek))||Number(t.startWeek)<0))issues.push(`Invalid starting age: ${t.title}`);if(t.endWeek!==""&&(!Number.isInteger(Number(t.endWeek))||Number(t.endWeek)<0))issues.push(`Invalid ending age: ${t.title}`);if(t.startWeek!==""&&t.endWeek!==""&&+t.endWeek<+t.startWeek)issues.push(`Age range ends before it starts: ${t.title}`);}
    const feed=list.filter(t=>t.kind==="feed"&&t.startWeek!=="").sort((a,b)=>+a.startWeek-+b.startWeek);
    for(let i=1;i<feed.length;i++){if(feed[i-1].endWeek===""|| +feed[i].startWeek<=+feed[i-1].endWeek)issues.push(`Feed age ranges overlap: ${feed[i-1].title} / ${feed[i].title}`);}
    return [...new Set(issues)];
  },[selected]);
  function mutateProgram(fn:(p:BMP)=>BMP){setPrograms(prev=>prev.map(p=>p.id===selectedId?{...fn(p),updated:new Date().toLocaleDateString("en-AU")}:p));setMessage("Unsaved changes in the editor — select Save draft when ready.");}
  function save(){if(problems.length){setMessage("Resolve validation warnings before saving.");return;}try{localStorage.setItem(KEY,JSON.stringify(programs));setMessage("Drafts saved in this browser only. Not published to OviCore or assigned to flocks.");}catch{setMessage("Browser storage unavailable — export a JSON backup instead.");}}
  function create(){const p:BMP={id:id(),name:"New BMP template",productionSystem:"Commercial Layers",breed:"",mill:"",version:1,status:"Draft",tasks:[],updated:"New"};setPrograms(prev=>[...prev,p]);setSelectedId(p.id);setMessage("New draft created. Save draft to keep it in this browser.");}
  function duplicate(){if(!selected)return;const p={...selected,id:id(),name:`${selected.name} (copy)`,version:1,tasks:selected.tasks.map(t=>({...t,id:id()})),updated:"New"};setPrograms(prev=>[...prev,p]);setSelectedId(p.id);setMessage("Draft duplicated. This does not create an approved or live BMP.");}
  function remove(){if(!selected||programs.length<=1)return;if(!window.confirm(`Delete the local draft “${selected.name}”?`))return;const next=programs.filter(p=>p.id!==selected.id);setPrograms(next);setSelectedId(next[0].id);setMessage("Draft removed from editor. Save draft to persist the change.");}
  function exportJson(){const blob=new Blob([JSON.stringify({format:"ovicore-bmp-designer-v1",exportedAt:new Date().toISOString(),programs},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="OviCore_BMP_Drafts.json";a.click();URL.revokeObjectURL(url);}
  const tab=KINDS.find(x=>x.id===kind)!;
  return <main className="min-h-screen bg-[#eff8f4] px-4 py-6 text-slate-800 md:px-8">
    <div className="mx-auto max-w-[1450px] space-y-4">
      <header className="rounded-2xl bg-gradient-to-r from-[#064e3b] to-[#00856b] p-5 text-white shadow-sm md:p-7">
        <Link href="/home" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-100 hover:text-white"><ArrowLeft size={15}/> Module Selector</Link>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-200">Management & Setup</p><h1 className="mt-1 text-2xl font-black md:text-3xl">Flock Management</h1><p className="mt-1 text-sm text-emerald-100">Batch Management Programs · planning templates for feed, lighting, vaccination and treatment</p></div><span className="rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-xs font-bold">BMP Builder · Draft preview</span></div>
      </header>
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert size={18} className="mt-0.5 shrink-0"/><p><strong>Prototype / browser drafts only.</strong> Nothing here creates a live flock assignment, vaccination task, sign-off or notification. Drafts are stored only in this browser; export JSON for backup. Medical and feeding protocols require appropriate approval before operational use.</p></div>
      <section className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-extrabold text-emerald-950">BMP Templates</h2><span className="text-xs text-slate-500">{programs.length} draft(s)</span></div>
          <div className="space-y-2">{programs.map(p=><button type="button" key={p.id} onClick={()=>{setSelectedId(p.id);setEditingTask(null);setMessage("");}} className={`w-full rounded-lg border p-3 text-left transition ${selectedId===p.id?"border-emerald-600 bg-emerald-50":"border-slate-200 hover:border-emerald-300"}`}><div className="text-sm font-bold">{p.name}</div><div className="mt-1 text-xs text-slate-500">{p.productionSystem} · {p.tasks.length} activities</div></button>)}</div>
          <button type="button" onClick={create} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"><FilePlus2 size={16}/> New BMP template</button>
          <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={duplicate} className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold"><Copy size={14}/> Duplicate</button><button onClick={remove} disabled={programs.length===1} className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-2 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40"><Trash2 size={14}/> Delete</button></div>
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold">Coming next</h3><p className="text-xs leading-relaxed text-slate-600">Company-backed program versions, authorised approval, flock creation assignments, actual task completion, verification and live Notifications & Action Centre.</p></div>
        </aside>
        {selected&&<section className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-extrabold text-emerald-950">Program details</h2><p className="text-xs text-slate-500">Reusable planning schedule · not approved</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Draft v{selected.version}</span></div>
            <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-bold">Program name<input className={`mt-1 ${textInput}`} value={selected.name} onChange={e=>mutateProgram(p=>({...p,name:e.target.value}))}/></label><label className="text-xs font-bold">Production system<select className={`mt-1 ${textInput}`} value={selected.productionSystem} onChange={e=>mutateProgram(p=>({...p,productionSystem:e.target.value}))}>{["Commercial Layers — Alternative","Commercial Layers — Cage","Commercial Layers","Commercial Rearing","Breeder Rearing","Breeder Production","Broilers"].map(v=><option key={v}>{v}</option>)}</select></label><label className="text-xs font-bold">Breed / strain (optional)<input className={`mt-1 ${textInput}`} value={selected.breed} onChange={e=>mutateProgram(p=>({...p,breed:e.target.value}))} placeholder="e.g. Hy-Line Brown"/></label><label className="text-xs font-bold">Assigned feed mill (planning reference)<input className={`mt-1 ${textInput}`} value={selected.mill} onChange={e=>mutateProgram(p=>({...p,mill:e.target.value}))} placeholder="Select real mill when backend is connected"/></label></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{KINDS.map(k=>{const Icon=k.icon;return <button key={k.id} onClick={()=>{setKind(k.id);setEditingTask(null)}} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold ${kind===k.id?"border-emerald-600 bg-emerald-50 text-emerald-900":"border-slate-200 bg-white"}`}><Icon size={16}/><span>{k.label}</span><span className="ml-auto opacity-60">{selected.tasks.filter(x=>x.kind===k.id).length}</span></button>})}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><tab.icon size={21} className="text-emerald-700"/><div><h3 className="text-base font-extrabold">{tab.label}</h3><p className="text-xs text-slate-500">Planned tasks only · age in completed weeks</p></div></div><button onClick={()=>{const t=emptyTask(kind);mutateProgram(p=>({...p,tasks:[...p.tasks,t]}));setEditingTask(t.id);}} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Plus size={15}/> Add activity</button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="bg-emerald-50 text-[11px] uppercase tracking-wider text-emerald-900"><th className="p-3">Age (weeks)</th><th className="p-3">Planned activity</th><th className="p-3">Responsible</th><th className="p-3">Verification</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{rows.map(t=><tr className="border-b border-slate-100" key={t.id}><td className="p-3 font-semibold">{t.startWeek||"—"}{t.endWeek?`–${t.endWeek}`:t.startWeek?"+":""}</td><td className="p-3"><div className="font-bold">{t.title||"Untitled task"}</div><p className="mt-0.5 max-w-lg text-xs text-slate-500">{t.instructions||"No instructions entered"}</p></td><td className="p-3 text-xs">{t.responsible}</td><td className="p-3 text-xs">{t.requiresSignoff?"Sign-off planned":"Standard task"}</td><td className="p-3 text-right"><button onClick={()=>setEditingTask(editingTask===t.id?null:t.id)} className="mr-3 text-xs font-bold text-emerald-700">{editingTask===t.id?"Close":"Edit"}</button><button aria-label={`Remove ${t.title}`} onClick={()=>{mutateProgram(p=>({...p,tasks:p.tasks.filter(x=>x.id!==t.id)}));setEditingTask(null)}} className="text-rose-600"><Trash2 size={15}/></button></td></tr>)}</tbody></table>{rows.length===0&&<p className="p-5 text-center text-sm text-slate-500">No activities planned. Add an activity to begin.</p>}</div>
            {editingTask&&selected.tasks.some(t=>t.id===editingTask)&&(()=>{const t=selected.tasks.find(x=>x.id===editingTask)!;const change=(patch:Partial<BMPTask>)=>mutateProgram(p=>({...p,tasks:p.tasks.map(x=>x.id===t.id?{...x,...patch}:x)}));return <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><h4 className="mb-3 font-bold">Edit planned activity</h4><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Start age (weeks)<input className={`mt-1 ${textInput}`} type="number" min="0" value={t.startWeek} onChange={e=>change({startWeek:e.target.value})}/></label><label className="text-xs font-semibold">End age (optional)<input className={`mt-1 ${textInput}`} type="number" min="0" value={t.endWeek} onChange={e=>change({endWeek:e.target.value})}/></label><label className="text-xs font-semibold sm:col-span-2">Activity / ration name<input className={`mt-1 ${textInput}`} value={t.title} onChange={e=>change({title:e.target.value})}/></label><label className="text-xs font-semibold">Responsible role<input className={`mt-1 ${textInput}`} value={t.responsible} onChange={e=>change({responsible:e.target.value})}/></label><label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold"><input type="checkbox" checked={t.requiresSignoff} onChange={e=>change({requiresSignoff:e.target.checked})}/> Requires authorised sign-off</label><label className="text-xs font-semibold sm:col-span-2">Instructions / approved protocol reference<textarea rows={3} className={`mt-1 ${textInput}`} value={t.instructions} onChange={e=>change({instructions:e.target.value})}/></label></div><button onClick={()=>setEditingTask(null)} className="mt-3 rounded-lg border border-emerald-400 px-4 py-2 text-xs font-bold text-emerald-800">Close editor</button></div>})()}
          </div>
          {problems.length>0&&<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><strong>Validation:</strong> {problems.join("; ")}</div>}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"><button type="button" onClick={save} disabled={!ready||problems.length>0} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Save size={16}/> Save draft</button><button type="button" onClick={exportJson} className="flex items-center gap-2 rounded-lg border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-800"><Download size={16}/> Export JSON backup</button><div className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={15}/> {selected.updated} · {selected.tasks.length} activities</div></div>
          {message&&<div aria-live="polite" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">{message}</div>}
        </section>}
      </section>
      <footer className="flex items-center gap-2 pb-4 text-xs text-slate-500"><ClipboardCheck size={15}/> OviCore · Intelligence That Drives Performance · BMP design preview only</footer>
    </div>
  </main>;
}
