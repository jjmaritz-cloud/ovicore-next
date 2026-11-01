"use client";

import Link from "next/link";
import { useState } from "react";
import { Mill, newId, useCatalog } from "../../../components/feed-operations/catalog";
import s from "../../../components/feed-operations/catalog.module.css";

type MillForm = Omit<Mill, "id">;
const BLANK: MillForm = {code:"",name:"",location:"",contact:"",email:"",phone:"",status:"Active",notes:""};

export default function MillsPage() {
  const { catalog, save, ready } = useCatalog();
  const [form,setForm] = useState<MillForm>({...BLANK});
  const [edit,setEdit] = useState("");
  const [search,setSearch] = useState("");
  const [message,setMessage] = useState("");
  const change = <K extends keyof MillForm>(key:K,value:MillForm[K]) => setForm(p=>({...p,[key]:value}));
  const reset = () => {setForm({...BLANK});setEdit("");setMessage("");};
  const submit = (e:React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();setMessage("");
    const code=form.code.trim().toUpperCase();const name=form.name.trim();
    if(!code||!name){setMessage("Mill code and name are required.");return;}
    if(catalog.mills.some(m=>m.code.toUpperCase()===code&&m.id!==edit)){setMessage("Mill code already exists.");return;}
    if(form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())){setMessage("Enter a valid contact email.");return;}
    const item:Mill={...form,code,name,email:form.email.trim(),id:edit||newId()};
    const next={...catalog,mills:edit?catalog.mills.map(m=>m.id===edit?item:m):[...catalog.mills,item]};
    if(save(next)){reset();setMessage("Mill saved in this browser only.");}else setMessage("Unable to save browser data.");
  };
  const choose=(m:Mill)=>{setEdit(m.id);setForm({code:m.code,name:m.name,location:m.location,contact:m.contact,email:m.email,phone:m.phone,status:m.status,notes:m.notes});setMessage("");window.scrollTo({top:0,behavior:"smooth"});};
  const visible=catalog.mills.filter(m=>`${m.code} ${m.name} ${m.location} ${m.contact}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  return <main className={s.root}><div className={s.wrap}>
    <header className={s.header}><div><div className={s.eyebrow}>OVICORE ECOSYSTEM / FEED OPERATIONS</div><h1 className={s.title}>Mill Management</h1><div className={s.sub}>Mill register, contacts and mill-specific ration catalogue</div></div><nav className={s.nav}><Link href="/feed-operations">Feed Operations</Link><Link href="/feed-operations/rations">Ration Library →</Link></nav></header>
    <div className={s.notice}><strong>Prototype:</strong> Mill records are saved in this browser only. They are not shared with other users or connected to the OviCore database. Mill names and codes below are entered by you, not preloaded.</div>
    <section className={s.section}><div className={s.heading}><h2>Mill Register</h2><span className={s.muted}>{ready?`${catalog.mills.length} mills` : "Loading"}</span></div>
      <div className={s.cols}>
        <div className={s.card}><h3>{edit?"Edit Mill":"Add Feed Mill"}</h3><form className={s.form} onSubmit={submit}>
          <label className={s.field}>Mill Code *<input required maxLength={30} value={form.code} onChange={e=>change("code",e.target.value)} placeholder="e.g. LPC"/></label>
          <label className={s.field}>Mill Name *<input required value={form.name} onChange={e=>change("name",e.target.value)} placeholder="Feed mill name"/></label>
          <label className={s.field}>Location<input value={form.location} onChange={e=>change("location",e.target.value)} placeholder="Town / State"/></label>
          <label className={s.field}>Primary Contact<input value={form.contact} onChange={e=>change("contact",e.target.value)} placeholder="Contact person"/></label>
          <label className={s.field}>Email<input type="email" value={form.email} onChange={e=>change("email",e.target.value)} placeholder="contact@example.com"/></label>
          <label className={s.field}>Phone<input type="tel" value={form.phone} onChange={e=>change("phone",e.target.value)}/></label>
          <label className={s.field}>Status<select value={form.status} onChange={e=>change("status",e.target.value as MillForm["status"])}><option>Active</option><option>Inactive</option></select></label>
          <label className={`${s.field} ${s.wide}`}>Notes<textarea value={form.notes} onChange={e=>change("notes",e.target.value)} placeholder="Delivery constraints, trading name, mill notes"/></label>
          <div className={`${s.controls} ${s.wide}`}><button className={s.button} type="submit">{edit?"Save Changes":"Add Mill"}</button><button className={`${s.button} ${s.secondary}`} type="button" onClick={reset}>Clear</button></div>
        </form>{message&&<div role="status" className={message.startsWith("Mill saved")?s.good:s.error}>{message}</div>}</div>
        <div className={s.card}><div className={s.heading}><h3>Registered Mills</h3><input aria-label="Search mills" className={s.search} style={{maxWidth:220}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mills…"/></div>
          <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Code</th><th>Mill</th><th>Location</th><th>Contact</th><th>Rations</th><th>Status</th><th></th></tr></thead><tbody>
            {visible.map(m=><tr key={m.id}><td><strong>{m.code}</strong></td><td>{m.name}</td><td>{m.location||"—"}</td><td>{m.contact||"—"}</td><td>{catalog.rations.filter(r=>r.millId===m.id).length}</td><td><span className={`${s.pill} ${m.status==="Inactive"?s.warn:""}`}>{m.status}</span></td><td><button type="button" className={s.action} onClick={()=>choose(m)}>Edit</button></td></tr>)}
            {!visible.length&&<tr><td colSpan={7} className={s.muted}>No mills found. Add a mill to begin.</td></tr>}
          </tbody></table></div>
          <p className={s.muted}>Deactivate a mill instead of deleting it to retain existing ration links.</p>
        </div>
      </div>
    </section><div className={s.foot}>OviCore Ecosystem · Intelligence That Drives Performance.</div>
  </div></main>;
}
