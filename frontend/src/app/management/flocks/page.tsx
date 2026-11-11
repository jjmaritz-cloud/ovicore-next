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
  const TabIcon = tab.icon;
  return <main className="bmp-page min-h-screen bg-[#eff8f4] px-4 py-6 text-slate-800 md:px-8">
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><TabIcon size={21} className="text-emerald-700"/><div><h3 className="text-base font-extrabold">{tab.label}</h3><p className="text-xs text-slate-500">Planned tasks only · age in completed weeks</p></div></div><button onClick={()=>{const t=emptyTask(kind);mutateProgram(p=>({...p,tasks:[...p.tasks,t]}));setEditingTask(t.id);}} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Plus size={15}/> Add activity</button></div>
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
      <style jsx global>{`
      /* BMP page-only utility styling: app has no Tailwind utility stylesheet. */
      .bmp-page{display:block;width:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.45;}
      .bmp-page *, .bmp-page *::before,.bmp-page *::after{box-sizing:border-box;}
      .bmp-page h1,.bmp-page h2,.bmp-page h3,.bmp-page h4,.bmp-page p{margin-top:0;}
      .bmp-page label{display:block;}
      .bmp-page input,.bmp-page select,.bmp-page textarea{font:inherit;}
      .bmp-page button{cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease;}
      .bmp-page button:disabled{cursor:not-allowed;}
      .bmp-page table{border-collapse:collapse;}
      .bmp-page th,.bmp-page td{vertical-align:top;}
      .bmp-page a{text-decoration:none;}
      .bmp-page [class~="bg-gradient-to-r"]{background:linear-gradient(110deg,#064e3b,#00856b);}
.bmp-page [class~="bg-[#eff8f4]"]{background-color:#eff8f4;}
.bmp-page [class~="bg-amber-100"]{background-color:#fef3c7;}
.bmp-page [class~="bg-amber-50"]{background-color:#fffbeb;}
.bmp-page [class~="bg-emerald-50"]{background-color:#ecfdf5;}
.bmp-page [class~="bg-emerald-50/60"]{background-color:rgba(236,253,245,.6);}
.bmp-page [class~="bg-emerald-700"]{background-color:#047857;}
.bmp-page [class~="bg-gradient-to-r"]{background-image:linear-gradient(to right,#064e3b,#00856b);}
.bmp-page [class~="bg-rose-50"]{background-color:#fff1f2;}
.bmp-page [class~="bg-white"]{background-color:#fff;}
.bmp-page [class~="bg-white/10"]{background-color:rgba(255,255,255,.1);}
.bmp-page [class~="border"]{border-width:1px;border-style:solid;border-color:#dbe5df;}
.bmp-page [class~="border-amber-200"]{border-color:#fde68a;}
.bmp-page [class~="border-b"]{border-bottom-width:1px;border-bottom-style:solid;}
.bmp-page [class~="border-emerald-100"]{border-color:#d1fae5;}
.bmp-page [class~="border-emerald-200"]{border-color:#a7f3d0;}
.bmp-page [class~="border-emerald-300"]{border-color:#6ee7b7;}
.bmp-page [class~="border-emerald-400"]{border-color:#34d399;}
.bmp-page [class~="border-emerald-600"]{border-color:#059669;}
.bmp-page [class~="border-rose-200"]{border-color:#fecdd3;}
.bmp-page [class~="border-slate-100"]{border-color:#f1f5f9;}
.bmp-page [class~="border-slate-200"]{border-color:#e2e8f0;}
.bmp-page [class~="border-slate-300"]{border-color:#cbd5e1;}
.bmp-page [class~="border-t"]{border-top-width:1px;border-top-style:solid;}
.bmp-page [class~="border-white/40"]{border-color:rgba(255,255,255,.4);}
.bmp-page [class~="flex"]{display:flex;}
.bmp-page [class~="flex-wrap"]{flex-wrap:wrap;}
.bmp-page [class~="font-black"]{font-weight:900;}
.bmp-page [class~="font-bold"]{font-weight:700;}
.bmp-page [class~="font-extrabold"]{font-weight:800;}
.bmp-page [class~="font-medium"]{font-weight:500;}
.bmp-page [class~="font-semibold"]{font-weight:600;}
.bmp-page [class~="gap-1"]{gap:4px;}
.bmp-page [class~="gap-2"]{gap:8px;}
.bmp-page [class~="gap-3"]{gap:12px;}
.bmp-page [class~="gap-4"]{gap:16px;}
.bmp-page [class~="grid"]{display:grid;}
.bmp-page [class~="grid-cols-2"]{grid-template-columns:repeat(2,minmax(0,1fr));}
.bmp-page [class~="inline-flex"]{display:inline-flex;}
.bmp-page [class~="items-center"]{align-items:center;}
.bmp-page [class~="items-start"]{align-items:flex-start;}
.bmp-page [class~="justify-between"]{justify-content:space-between;}
.bmp-page [class~="justify-center"]{justify-content:center;}
.bmp-page [class~="leading-relaxed"]{line-height:1.625;}
.bmp-page [class~="max-w-[1450px]"]{max-width:1450px;}
.bmp-page [class~="max-w-lg"]{max-width:512px;}
.bmp-page [class~="mb-3"]{margin-bottom:12px;}
.bmp-page [class~="mb-4"]{margin-bottom:16px;}
.bmp-page [class~="min-h-screen"]{min-height:100vh;}
.bmp-page [class~="min-w-0"]{min-width:0;}
.bmp-page [class~="min-w-[700px]"]{min-width:700px;}
.bmp-page [class~="ml-auto"]{margin-left:auto;}
.bmp-page [class~="mr-3"]{margin-right:12px;}
.bmp-page [class~="mt-0.5"]{margin-top:2px;}
.bmp-page [class~="mt-1"]{margin-top:4px;}
.bmp-page [class~="mt-3"]{margin-top:12px;}
.bmp-page [class~="mt-4"]{margin-top:16px;}
.bmp-page [class~="mt-5"]{margin-top:20px;}
.bmp-page [class~="mx-auto"]{margin-left:auto;margin-right:auto;}
.bmp-page [class~="opacity-60"]{opacity:.6;}
.bmp-page [class~="overflow-x-auto"]{overflow-x:auto;}
.bmp-page [class~="p-3"]{padding:12px;}
.bmp-page [class~="p-4"]{padding:16px;}
.bmp-page [class~="p-5"]{padding:20px;}
.bmp-page [class~="pb-2"]{padding-bottom:8px;}
.bmp-page [class~="pb-4"]{padding-bottom:16px;}
.bmp-page [class~="pt-4"]{padding-top:16px;}
.bmp-page [class~="px-2"]{padding-left:8px;padding-right:8px;}
.bmp-page [class~="px-3"]{padding-left:12px;padding-right:12px;}
.bmp-page [class~="px-4"]{padding-left:16px;padding-right:16px;}
.bmp-page [class~="py-1"]{padding-top:4px;padding-bottom:4px;}
.bmp-page [class~="py-1.5"]{padding-top:6px;padding-bottom:6px;}
.bmp-page [class~="py-2"]{padding-top:8px;padding-bottom:8px;}
.bmp-page [class~="py-2.5"]{padding-top:10px;padding-bottom:10px;}
.bmp-page [class~="py-6"]{padding-top:24px;padding-bottom:24px;}
.bmp-page [class~="rounded-2xl"]{border-radius:16px;}
.bmp-page [class~="rounded-full"]{border-radius:9999px;}
.bmp-page [class~="rounded-lg"]{border-radius:8px;}
.bmp-page [class~="rounded-xl"]{border-radius:12px;}
.bmp-page [class~="self-end"]{align-self:end;}
.bmp-page [class~="shadow-sm"]{box-shadow:0 3px 12px rgba(10,58,42,.08);}
.bmp-page [class~="shrink-0"]{flex-shrink:0;}
.bmp-page [class~="space-y-2"] > :not([hidden]) ~ :not([hidden]){margin-top:8px;}
.bmp-page [class~="space-y-4"] > :not([hidden]) ~ :not([hidden]){margin-top:16px;}
.bmp-page [class~="text-2xl"]{font-size:24px;}
.bmp-page [class~="text-[11px]"]{font-size:11px;}
.bmp-page [class~="text-amber-800"]{color:#92400e;}
.bmp-page [class~="text-amber-900"]{color:#78350f;}
.bmp-page [class~="text-base"]{font-size:16px;}
.bmp-page [class~="text-center"]{text-align:center;}
.bmp-page [class~="text-emerald-100"]{color:#d1fae5;}
.bmp-page [class~="text-emerald-200"]{color:#a7f3d0;}
.bmp-page [class~="text-emerald-700"]{color:#047857;}
.bmp-page [class~="text-emerald-800"]{color:#065f46;}
.bmp-page [class~="text-emerald-900"]{color:#064e3b;}
.bmp-page [class~="text-emerald-950"]{color:#022c22;}
.bmp-page [class~="text-left"]{text-align:left;}
.bmp-page [class~="text-lg"]{font-size:18px;}
.bmp-page [class~="text-right"]{text-align:right;}
.bmp-page [class~="text-rose-600"]{color:#e11d48;}
.bmp-page [class~="text-rose-700"]{color:#be123c;}
.bmp-page [class~="text-rose-800"]{color:#9f1239;}
.bmp-page [class~="text-slate-500"]{color:#64748b;}
.bmp-page [class~="text-slate-600"]{color:#475569;}
.bmp-page [class~="text-slate-800"]{color:#1e293b;}
.bmp-page [class~="text-sm"]{font-size:14px;}
.bmp-page [class~="text-white"]{color:#fff;}
.bmp-page [class~="text-xs"]{font-size:12px;}
.bmp-page [class~="tracking-[.16em]"]{letter-spacing:.16em;}
.bmp-page [class~="tracking-wider"]{letter-spacing:.05em;}
.bmp-page [class~="transition"]{transition:all .18s ease;}
.bmp-page [class~="uppercase"]{text-transform:uppercase;}
.bmp-page [class~="w-full"]{width:100%;}
.bmp-page [class~="disabled:opacity-40"]:disabled{opacity:.4;}
.bmp-page [class~="hover:bg-emerald-800"]:hover{background-color:#065f46;}
.bmp-page [class~="hover:border-emerald-300"]:hover{border-color:#6ee7b7;}
.bmp-page [class~="hover:text-white"]:hover{color:#fff;}
@media(min-width:640px){.bmp-page [class~="sm:col-span-2"]{grid-column:span 2 / span 2;}.bmp-page [class~="sm:grid-cols-2"]{grid-template-columns:repeat(2,minmax(0,1fr));}.bmp-page [class~="sm:grid-cols-4"]{grid-template-columns:repeat(4,minmax(0,1fr));}}
@media(min-width:768px){.bmp-page [class~="md:grid-cols-2"]{grid-template-columns:repeat(2,minmax(0,1fr));}.bmp-page [class~="md:p-5"]{padding:20px;}.bmp-page [class~="md:p-7"]{padding:28px;}.bmp-page [class~="md:px-8"]{padding-left:32px;padding-right:32px;}.bmp-page [class~="md:text-3xl"]{font-size:30px;}}
@media(min-width:1024px){.bmp-page [class~="lg:grid-cols-[300px_minmax(0,1fr)]"]{grid-template-columns:300px minmax(0,1fr);}}

      @media(max-width:639px){.bmp-page [class~="min-w-[700px]"]{min-width:650px;}}
      `}</style>
  </main>;
}
