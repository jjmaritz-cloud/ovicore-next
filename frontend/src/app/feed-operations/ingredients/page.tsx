"use client";
import Link from "next/link";
import {useState} from "react";
import {Ingredient,newId,useCatalog} from "../../../components/feed-operations/catalog";
import s from "../../../components/feed-operations/catalog.module.css";
const BLANK={code:"",name:"",category:"Grain",price:"",protein:"",energy:"",status:"Active" as const,notes:""};
export default function IngredientsPage(){
  const {catalog,save,ready}=useCatalog();
  const [form,setForm]=useState<Omit<Ingredient, "id" | "price"> & {price:string}>({...BLANK}); const [edit,setEdit]=useState("");const [search,setSearch]=useState("");const [message,setMessage]=useState("");
  const set=(key:keyof typeof BLANK,value:string)=>setForm(prev=>({...prev,[key]:value}));
  const reset=()=>{setForm({...BLANK});setEdit("");setMessage("");};
  const submit=(e:React.FormEvent)=>{
    e.preventDefault();setMessage("");const code=form.code.trim().toUpperCase();const name=form.name.trim();const price=Number(form.price);
    if(!code||!name||!form.price.trim()||!Number.isFinite(price)||price<0){setMessage("Enter code, name and a valid price per tonne (zero is allowed).");return;}
    if(catalog.ingredients.some(x=>x.code.toUpperCase()===code&&x.id!==edit)){setMessage("Ingredient code must be unique.");return;}
    const item:Ingredient={id:edit||newId(),code,name,category:form.category,price,protein:form.protein,energy:form.energy,status:form.status,notes:form.notes};
    const next={...catalog,ingredients:edit?catalog.ingredients.map(i=>i.id===edit?item:i):[...catalog.ingredients,item]};
    if(save(next)){reset();setMessage("Ingredient saved in this browser only.");}else setMessage("Could not save in browser storage.");
  };
  const choose=(i:Ingredient)=>{setEdit(i.id);setForm({code:i.code,name:i.name,category:i.category,price:String(i.price),protein:i.protein,energy:i.energy,status:i.status,notes:i.notes});setMessage("");window.scrollTo({top:0,behavior:"smooth"});};
  const visible=catalog.ingredients.filter(i=>`${i.code} ${i.name} ${i.category}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.code.localeCompare(b.code));
  return <main className={s.root}><div className={s.wrap}>
    <header className={s.header}><div><div className={s.eyebrow}>OVICORE ECOSYSTEM / FEED OPERATIONS</div><h1 className={s.title}>Diet Ingredients</h1><div className={s.sub}>Ingredient register, cost inputs and nutritional specifications</div></div><nav className={s.nav}><Link href="/feed-operations">Feed Operations</Link><Link href="/feed-operations/rations">Ration Library →</Link></nav></header>
    <div className={s.notice}><strong>Prototype:</strong> Changes are stored only in this browser, not in the OviCore database. No company sharing, server permissions or financial posting is active.</div>
    <section className={s.section}><div className={s.heading}><h2>Ingredient Management</h2><span className={s.muted}>{ready?`${catalog.ingredients.length} ingredients` : "Loading"}</span></div>
      <div className={s.cols}><div className={s.card}><h3>{edit?"Edit Ingredient":"Add Ingredient"}</h3><form onSubmit={submit} className={s.form}>
        <label className={s.field}>Ingredient Code *<input value={form.code} maxLength={32} onChange={e=>set("code",e.target.value)} placeholder="e.g. WHEAT" required/></label>
        <label className={s.field}>Name *<input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ingredient name" required/></label>
        <label className={s.field}>Category<select value={form.category} onChange={e=>set("category",e.target.value)}>{["Grain","Protein Meal","Oil / Fat","Mineral","Amino Acid","Premix","Additive","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className={s.field}>Indicative Cost (AUD/t) *<input type="number" min="0" step="0.01" value={form.price} onChange={e=>set("price",e.target.value)} required/></label>
        <label className={s.field}>Crude Protein (%)<input type="number" min="0" max="100" step="0.01" value={form.protein} onChange={e=>set("protein",e.target.value)}/></label>
        <label className={s.field}>Energy (MJ/kg)<input type="number" min="0" step="0.01" value={form.energy} onChange={e=>set("energy",e.target.value)}/></label>
        <label className={s.field}>Status<select value={form.status} onChange={e=>set("status",e.target.value)}><option>Active</option><option>Inactive</option></select></label>
        <label className={`${s.field} ${s.wide}`}>Notes / Specifications<textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Supplier, quality and nutrient notes"/></label>
        <div className={`${s.controls} ${s.wide}`}><button className={s.button} type="submit">{edit?"Save Changes":"Add Ingredient"}</button><button className={`${s.button} ${s.secondary}`} type="button" onClick={reset}>Clear</button></div>
      </form>{message&&<div className={message.startsWith("Ingredient saved")?s.good:s.error}>{message}</div>}</div>
      <div className={s.card}><div className={s.heading}><h3>Ingredient Register</h3><input className={s.search} style={{maxWidth:230}} aria-label="Search ingredients" placeholder="Search ingredients…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Code</th><th>Ingredient</th><th>Category</th><th>Cost AUD/t</th><th>Status</th><th></th></tr></thead><tbody>{visible.map(i=><tr key={i.id}><td><strong>{i.code}</strong></td><td>{i.name}</td><td>{i.category}</td><td>${i.price.toFixed(2)}</td><td><span className={`${s.pill} ${i.status==="Inactive"?s.warn:""}`}>{i.status}</span></td><td><button className={s.action} type="button" onClick={()=>choose(i)}>Edit</button></td></tr>)}{visible.length===0&&<tr><td colSpan={6} className={s.muted}>No ingredients found. Add your first ingredient on the left.</td></tr>}</tbody></table></div>
      </div></div></section><div className={s.foot}>OviCore Ecosystem · Intelligence That Drives Performance.</div></div></main>;
}
