"use client";
import Link from "next/link";
import {useState} from "react";
import {Ration,newId,useCatalog,totalInclusion,knownCost} from "../../../components/feed-operations/catalog";
import s from "../../../components/feed-operations/catalog.module.css";
type Line={ingredientId:string;percent:number};
const BLANK={millId:"",code:"",name:"",supplierCode:"",supplierName:"",phase:"Layer 1",type:"Base" as "Base"|"Medicated",baseId:"",status:"Draft" as "Draft"|"Approved"|"Inactive",notes:"",lines:[] as Line[]};
export default function RationsPage(){
  const {catalog,save,ready,error}=useCatalog();const [form,setForm]=useState({...BLANK});const [edit,setEdit]=useState("");const [search,setSearch]=useState("");const [message,setMessage]=useState("");
  const [importOpen,setImportOpen]=useState(false);const [importFile,setImportFile]=useState<File|null>(null);const [importMill,setImportMill]=useState("");const [importPreview,setImportPreview]=useState<any>(null);const [importConfirm,setImportConfirm]=useState(false);const [importBusy,setImportBusy]=useState(false);const [importError,setImportError]=useState("");const [importSuccess,setImportSuccess]=useState("");
  const sendImport=async(action:"import-preview"|"import-apply")=>{
    if(!importFile||!importMill)return;
    setImportBusy(true);setImportError("");setImportSuccess("");
    try{
      const data=new FormData();data.append("file",importFile);data.append("mill_id",importMill);
      if(action==="import-apply")data.append("confirm","true");
      const params=new URLSearchParams(window.location.search);
      const companyId=params.get("company_id");
      const q=companyId?`?company_id=${encodeURIComponent(companyId)}`:"";
      const response=await fetch(`/api/feed-operations/catalog/${action}${q}`,{method:"POST",body:data,credentials:"include"});
      const result=await response.json();
      if(!response.ok)throw new Error(typeof result.detail==="string"?result.detail:JSON.stringify(result.detail||result));
      if(action==="import-preview"){setImportPreview(result);setImportConfirm(false);}else{setImportSuccess(`Imported ${result.imported_rations} draft rations and ${result.imported_ingredients} new ingredients. Reloading catalogue…`);setImportPreview(null);setImportConfirm(false);window.location.reload();}
    }catch(error){setImportError(error instanceof Error?error.message:"Import failed");}
    finally{setImportBusy(false);}
  };
  const set=<K extends keyof typeof BLANK>(key:K,value:(typeof BLANK)[K])=>setForm(p=>({...p,[key]:value}));
  const reset=()=>{setForm({...BLANK,lines:[]});setEdit("");setMessage("");};
  const addLine=()=>{const next=catalog.ingredients.find(i=>i.status==="Active"&&!form.lines.some(l=>l.ingredientId===i.id));if(next)set("lines",[...form.lines,{ingredientId:next.id,percent:0}]);};
  const changeLine=(index:number,patch:Partial<Line>)=>set("lines",form.lines.map((l,j)=>index===j?{...l,...patch}:l));
  const baseChoices=catalog.rations.filter(r=>r.millId===form.millId&&r.type==="Base"&&r.id!==edit&&r.status==="Approved");
  const submit=async (e:React.FormEvent)=>{
    e.preventDefault();setMessage("");const code=form.code.trim().toUpperCase();const name=form.name.trim();const supplierCode=form.supplierCode.trim().toUpperCase();const supplierName=form.supplierName.trim();const sum=form.lines.reduce((a,l)=>a+l.percent,0);
    if(!catalog.mills.some(m=>m.id===form.millId&&m.status==="Active")){setMessage("Select an active feed mill before saving a ration.");return;}
    if(!code||!name||!supplierCode||!supplierName){setMessage("Company ration code/description and supplier SKU/description are all required.");return;}
    if(catalog.rations.some(r=>r.millId===form.millId&&r.code.toUpperCase()===code&&r.id!==edit)){setMessage("Company ration code must be unique within the selected mill.");return;}
    if(catalog.rations.some(r=>r.millId===form.millId&&r.supplierCode?.toUpperCase()===supplierCode&&r.id!==edit)){setMessage("Supplier SKU must be unique within the selected mill.");return;}
    if(form.type==="Medicated"&&!baseChoices.some(r=>r.id===form.baseId)){setMessage("Select an existing base ration before saving a medicated variant.");return;}
    if(form.lines.some(l=>!l.ingredientId||!Number.isFinite(l.percent)||l.percent<=0)||new Set(form.lines.map(l=>l.ingredientId)).size!==form.lines.length){setMessage("Each inclusion needs a unique ingredient and percentage greater than zero.");return;}
    if(form.status==="Approved"&&(form.lines.length===0||Math.abs(sum-100)>0.001)){setMessage("Approved ration inclusions must total exactly 100%.");return;}
    if(sum>100.001){setMessage("Ingredient inclusions cannot exceed 100%.");return;}
    const item:Ration={...form,id:edit||newId(),code,name,supplierCode,supplierName,baseId:form.type==="Base"?"":form.baseId};
    if(await save({...catalog,rations:edit?catalog.rations.map(r=>r.id===edit?item:r):[...catalog.rations,item]})){reset();setMessage("Ration saved in OviCore.");}else setMessage("Unable to save. Check API permissions or connection.");
  };
  const choose=(r:Ration)=>{setEdit(r.id);setForm({millId:r.millId||"",code:r.code,name:r.name,supplierCode:r.supplierCode||"",supplierName:r.supplierName||"",phase:r.phase,type:r.type,baseId:r.baseId,status:r.status,notes:r.notes,lines:r.lines.map(l=>({...l}))});setMessage("");window.scrollTo({top:0,behavior:"smooth"});};
  // Duplicate a saved ration as a NEW draft record. Never modify the source.
  // Company code and supplier SKU are cleared to force unique identities.
  // For medication variants, link back to the approved source base ration.
  const duplicate=(r:Ration)=>{
    const linkBase=r.type==="Base"&&r.status==="Approved" ? r.id : (r.baseId||"");
    setEdit("");
    setForm({
      millId:r.millId||"", code:"", name:`${r.name} — Copy`,
      supplierCode:"", supplierName:r.supplierName||"",
      phase:r.phase, type:"Base", baseId:"", status:"Draft",
      notes:`Duplicated from ${r.code} (${r.name}). Review all inclusions, pricing and approvals before use.\n${r.notes||""}`.trim(),
      lines:r.lines.map(l=>({...l})),
    });
    setMessage(`Draft copy of ${r.code} loaded. Choose Base or Medicated, enter NEW company code and supplier SKU, review composition, then save. Original unchanged.${linkBase?" For a medicated version, select Medicated and link the approved base ration.":""}`);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const [millFilter,setMillFilter]=useState("all");
  const visible=catalog.rations.filter(r=>(millFilter==="all"||r.millId===millFilter)&&`${r.code} ${r.name} ${r.supplierCode||""} ${r.supplierName||""} ${r.phase} ${r.type}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.code.localeCompare(b.code));
  const cost=knownCost({...form,id:""},catalog.ingredients);
  return <main className={s.root}><div className={s.wrap}><header className={s.header}><div><div className={s.eyebrow}>OVICORE ECOSYSTEM / FEED OPERATIONS</div><h1 className={s.title}>Ration Library</h1><div className={s.sub}>Company ration naming, mill supplier SKUs and ingredient composition</div></div><nav className={s.nav}><Link href="/feed-operations">Feed Operations</Link><Link href="/feed-operations/mills">Mill Management</Link><Link href="/feed-operations/ingredients">Diet Ingredients →</Link></nav></header>
    <div className={s.notice}><strong>Database mode:</strong> Requires an authenticated OviCore feed API. An “Approved” label here is a draft workflow status, not clinical, veterinary or nutritional approval. Review existing browser prototype records separately; they are not migrated automatically. Do not use prototype diets for feed manufacturing or medication instructions.</div>
    {error&&<div role="alert" className={s.error}>API: {error}. No changes have been saved.</div>}
    <section className={s.section} style={{padding:"10px 12px",marginBottom:10}}>
      <div className={s.heading}><div><strong>Bulk import rations</strong><p className={s.muted}>Upload a reviewed CFC formulation workbook. Preview before committing draft records.</p></div><button type="button" className={s.button} onClick={()=>setImportOpen(v=>!v)}>{importOpen?"Close importer":"Import Excel rations"}</button></div>
      {importOpen&&<div style={{display:"grid",gap:10,maxWidth:850,marginTop:12}}>
        <label className={s.field}>Destination mill (existing active mill)
          <select value={importMill} onChange={e=>{setImportMill(e.target.value);setImportPreview(null);setImportConfirm(false);}}><option value="">Select target mill</option>{catalog.mills.filter(m=>m.status==="Active").map(m=><option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}</select>
        </label>
        <label className={s.field}>Formulation workbook (.xlsx)
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>{setImportFile(e.target.files?.[0]||null);setImportPreview(null);setImportConfirm(false);}} />
        </label>
        <div><button type="button" className={s.button} disabled={!importMill||!importFile||importBusy} onClick={()=>void sendImport("import-preview")}>{importBusy?"Checking…":"Preview and validate"}</button></div>
        {importPreview&&<div style={{border:"1px solid #cadbd3",borderRadius:10,padding:12,display:"grid",gap:8}}>
          <strong>Import preview — {importPreview.rations} rations, {importPreview.ingredients} ingredients, {importPreview.inclusion_lines} formulation lines</strong>
          <p className={s.muted}>{importPreview.new_ingredients} new ingredients · {importPreview.existing_ingredients} existing ingredient codes reused · destination: {importPreview.target_mill}</p>
          <p className={s.muted}>Source mill: {importPreview.source_mills?.join(", ")}. Ration codes: {importPreview.ration_codes?.join(", ")}</p>
          {importPreview.warnings?.map((warning:string,i:number)=><p className={s.muted} key={i} style={{margin:0}}>• {warning}</p>)}
          {importPreview.errors?.map((error:string,i:number)=><div key={i} className={s.error}>{error}</div>)}
          {!importPreview.errors?.length&&<><label style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}><input type="checkbox" checked={importConfirm} onChange={e=>setImportConfirm(e.target.checked)}/>I confirm the company/mill selection and understand imported records will be Draft. Existing values will not be overwritten.</label>
            <div><button type="button" className={s.button} disabled={!importConfirm||importBusy} onClick={()=>void sendImport("import-apply")}>{importBusy?"Importing…":"Import reviewed drafts"}</button></div></>}
        </div>}
        {importError&&<div role="alert" className={s.error}>{importError}</div>}
        {importSuccess&&<div role="status" className={s.good}>{importSuccess}</div>}
      </div>}
    </section>

    <section className={s.section}><div className={s.heading}><h2>Ration Management</h2><span className={s.muted}>{ready?`${catalog.rations.length} rations` : "Loading"}</span></div><div className={s.cols}>
      <div className={s.card}><h3>{edit?"Edit Ration":"Create Ration"}</h3><form className={s.form} onSubmit={submit}>
        <label className={`${s.field} ${s.wide}`}>Supplying Mill *<select required value={form.millId} onChange={e=>setForm(p=>({...p,millId:e.target.value,baseId:""}))}><option value="">Select feed mill</option>{catalog.mills.filter(m=>m.status==="Active"||m.id===form.millId).map(m=><option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}</select></label>
        <div className={s.wide}><h3>Company Ration (shown to farms)</h3><p className={s.muted}>Farm users select and see these names when ordering feed.</p></div>
        <label className={s.field}>Company Ration Code *<input value={form.code} onChange={e=>set("code",e.target.value)} maxLength={32} required placeholder="e.g. LAY-01-LPC"/></label>
        <label className={s.field}>Company Ration Description *<input value={form.name} onChange={e=>set("name",e.target.value)} required placeholder="Layer 1 Standard"/></label>
        <div className={s.wide}><h3>Supplier / Mill Ration (sent externally)</h3><p className={s.muted}>The supplier receives these exact SKU and description values on the mill-facing order.</p></div>
        <label className={s.field}>Supplier Code / SKU *<input value={form.supplierCode} onChange={e=>set("supplierCode",e.target.value)} maxLength={64} required placeholder="e.g. LP-0102"/></label>
        <label className={s.field}>Supplier Ration Description *<input value={form.supplierName} onChange={e=>set("supplierName",e.target.value)} required placeholder="Supplier Layer 1 Mash"/></label>
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
      <div className={s.card}><div className={s.heading}><h3>Ration Register</h3><select className={s.search} style={{maxWidth:170}} aria-label="Filter mill" value={millFilter} onChange={e=>setMillFilter(e.target.value)}><option value="all">All mills</option>{catalog.mills.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select><input className={s.search} style={{maxWidth:190}} aria-label="Search rations" placeholder="Search rations…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Mill</th><th>Company Code</th><th>Company Ration</th><th>Supplier SKU</th><th>Supplier Description</th><th>Phase</th><th>Type</th><th>Inclusion</th><th>Ingredient Cost</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(r=>{const c=knownCost(r,catalog.ingredients);return <tr key={r.id}><td>{catalog.mills.find(m=>m.id===r.millId)?.name||"Unassigned — edit"}</td><td><strong>{r.code}</strong></td><td>{r.name}</td><td>{r.supplierCode||"Needs mapping"}</td><td>{r.supplierName||"Needs mapping"}</td><td>{r.phase}</td><td><span className={`${s.pill} ${r.type==="Medicated"?s.warn:""}`}>{r.type}</span></td><td>{totalInclusion(r).toFixed(2)}%</td><td>{r.lines.length&&c.complete?`$${c.cost.toFixed(2)}/t`:"—"}</td><td>{r.status}</td><td><button className={s.action} type="button" onClick={()=>choose(r)}>Edit</button>{" "}<button className={s.action} type="button" onClick={()=>duplicate(r)} aria-label={`Duplicate ${r.code}`}>Duplicate</button></td></tr>})}{visible.length===0&&<tr><td colSpan={11} className={s.muted}>No rations found. Add a mill and ingredients first, then create a ration.</td></tr>}</tbody></table></div></div></div></section><div className={s.foot}>OviCore Ecosystem · Intelligence That Drives Performance.</div></div></main>;
}
