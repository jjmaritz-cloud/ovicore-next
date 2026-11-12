"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import {ArrowUpRight, Boxes, ClipboardCheck, GitBranch, Package, PackageCheck, Search, ScanBarcode, Truck, Warehouse, CheckCircle2} from "lucide-react";
import styles from "./page.module.css";
const modules = [
 {title:"Egg Storage",eyebrow:"FARM COLLECTION & HOLDING",description:"Record collected egg batches and review source flocks and collection dates.",tags:["BATCHES","LAY DATE","FLOCKS"],href:"/grading/storage",icon:Warehouse,category:"Storage & Movement",active:true},
 {title:"Pallets & SSCC",eyebrow:"PALLET IDENTIFICATION",description:"Allocate logistics identifiers and print validated pallet labels.",tags:["SSCC","LABELS","PALLETS"],href:"/grading/pallets",icon:ScanBarcode,category:"Storage & Movement",active:false},
 {title:"Egg Dispatch",eyebrow:"FARM-TO-GRADER",description:"Create load manifests and control dispatched egg batches.",tags:["LOADS","TRANSFER","MANIFEST"],href:"/grading/dispatch",icon:Truck,category:"Storage & Movement",active:false},
 {title:"Egg Receivals",eyebrow:"GRADING FLOOR INTAKE",description:"Scan and reconcile incoming logistics units and exceptions.",tags:["SCAN","RECEIVE","RECONCILE"],href:"/grading/receiving",icon:PackageCheck,category:"Storage & Movement",active:false},
 {title:"Egg Inventory",eyebrow:"STOCK & AGE CONTROL",description:"View available ungraded stock, storage locations and egg age.",tags:["STOCK","LOCATION","AGE"],href:"/grading/inventory",icon:Boxes,category:"Grading & Traceability",active:false},
 {title:"Grading Runs",eyebrow:"GRADING FLOOR",description:"Assign egg batches to grading runs and record outputs.",tags:["RUNS","GRADES","OUTPUT"],href:"/grading/runs",icon:ClipboardCheck,category:"Grading & Traceability",active:false},
 {title:"Traceability",eyebrow:"FARM-TO-PACK AUDIT",description:"Trace graded product back to shed, flock and original batch.",tags:["AUDIT","BATCH","RECALL"],href:"/grading/traceability",icon:GitBranch,category:"Grading & Traceability",active:false},
] as const;
const categories=["All","Storage & Movement","Grading & Traceability"] as const;
export default function GradingHome(){
 const [category,setCategory]=useState<string>("All"); const [search,setSearch]=useState("");
 const filtered=useMemo(()=>modules.filter(m=>(category==="All"||m.category===category)&&(!search.trim()||[m.title,m.eyebrow,m.description,...m.tags].join(" ").toLowerCase().includes(search.toLowerCase().trim()))),[category,search]);
 return <main className={styles.page}><div className={styles.container}>
 <header className={styles.hero}><div className={styles.heroText}><p className={styles.kicker}>OVICORE ECOSYSTEM / EGG PRODUCTION</p><h1>Grading</h1><p>Manage egg storage, movements, receiving and traceability from farm to grading floor.</p></div><div className={styles.heroTools}><Link className={styles.backLink} href="/home">Back to modules <ArrowUpRight size={14}/></Link><label className={styles.search}><Search size={16}/><span className={styles.srOnly}>Search Grading</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Grading..."/></label></div></header>
 <nav className={styles.filters} aria-label="Filter grading modules">{categories.map(c=><button key={c} className={category===c?styles.filterActive:styles.filter} onClick={()=>setCategory(c)}>{c}</button>)}</nav>
 {categories.slice(1).map(c=>{const items=filtered.filter(m=>m.category===c);return items.length?<section className={styles.section} key={c}><div className={styles.sectionHeading}><div><div className={styles.overline}>BUSINESS AREA</div><h2>{c}</h2></div><span>{items.length} modules</span></div><div className={styles.cardGrid}>{items.map(m=>{const I=m.icon;return <Link key={m.href} href={m.href} className={styles.card}><div className={styles.cardTop}><span className={styles.icon}><I size={22}/></span><div className={styles.cardHeading}><div className={styles.eyebrow}>{m.eyebrow}</div><h3>{m.title}</h3></div><span className={styles.status}>{m.active?"PILOT":"PLANNED"}</span></div><p className={styles.description}>{m.description}</p><div className={styles.tags}>{m.tags.map(t=><span key={t}>{t}</span>)}</div><div className={styles.cardFooter}><span>{m.active?"Open module":"View planned module"}</span><span className={styles.arrow}><ArrowUpRight size={14}/></span></div></Link>})}</div></section>:null})}
 {!filtered.length&&<div className={styles.empty}>No matching Grading modules.</div>}
 <aside className={styles.rule}><CheckCircle2 size={17}/><p><strong>Stage 1 administrator pilot</strong> Egg Storage records collection batches only. Pallets, movement and live inventory are not enabled for stock reconciliation.</p></aside><footer className={styles.footer}><Package size={15}/> OviCore Ecosystem · Intelligence That Drives Performance.</footer>
 </div></main>;
}
