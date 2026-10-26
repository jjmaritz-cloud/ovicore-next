"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import styles from "./mobileLayers.module.css";

type Flock = { id:number; farm_name:string; shed_name:string; flock_code:string; status:string; current_birds?:number|null; latest_production_pct?:number|null; cumulative_mortality_pct?:number|null; latest_feed_g_bird_day?:number|null };
type Perf = { flock_id:number; entry_date:string; total_eggs?:number|null; closing_birds?:number|null };

function companyIdFor(user:{company_id:number|null;is_global_admin:boolean}|null){
  if(!user) return null;
  if(!user.is_global_admin) return user.company_id;
  if(typeof window === "undefined") return null;
  const id=Number(window.localStorage.getItem("ovicore_selected_company_id"));
  return Number.isInteger(id)&&id>0?id:null;
}

export default function MobileCommercialLayersHome(){
  const { currentUser, loadingUser }=useCurrentUser();
  const companyId=useMemo(()=>companyIdFor(currentUser),[currentUser]);
  const [flocks,setFlocks]=useState<Flock[]>([]); const [perf,setPerf]=useState<Perf[]>([]); const [message,setMessage]=useState("");
  const load=useCallback(async()=>{
    if(loadingUser||!companyId)return;
    try{
      const [fr,pr]=await Promise.all([
        fetch(`/api/layers/commercial/flocks?company_id=${companyId}`,{credentials:"include",cache:"no-store"}),
        fetch(`/api/layers/commercial/daily-performance?company_id=${companyId}`,{credentials:"include",cache:"no-store"})
      ]);
      if(!fr.ok) throw new Error(`Could not load layer flocks (${fr.status}).`);
      const fs:Flock[]=await fr.json(); setFlocks(fs);
      if(pr.ok) setPerf(await pr.json());
      setMessage("");
      localStorage.setItem(`ovicore_mobile_layers_flocks_${companyId}`,JSON.stringify(fs));
    }catch(e){
      const raw=localStorage.getItem(`ovicore_mobile_layers_flocks_${companyId}`);
      if(raw){setFlocks(JSON.parse(raw));setMessage("Offline mode: showing last synced Commercial Layers flock data.");}
      else setMessage(e instanceof Error?e.message:"Could not load Commercial Layers.");
    }
  },[companyId,loadingUser]);
  useEffect(()=>{void load();},[load]);
  const active=flocks.filter(f=>["active","housed"].includes((f.status||"").toLowerCase()));
  const birds=active.reduce((s,f)=>s+Number(f.current_birds||0),0);
  const latestDate=perf.map(r=>r.entry_date).sort().at(-1);
  const eggs=perf.filter(r=>r.entry_date===latestDate).reduce((s,r)=>s+Number(r.total_eggs||0),0);
  const attention=active.filter(f=>Number(f.cumulative_mortality_pct||0)>5 || Number(f.latest_production_pct||100)<80).length;
  return <main className={styles.shell}>
    <header className={styles.header}><div className={styles.brand}><Image src="/assets/ovicore-icon.png" alt="OviCore" width={36} height={36}/><div><strong>OviCore</strong><span>Commercial Layers</span></div></div><Link className={styles.back} href="/mobile">Change module</Link></header>
    <div className={styles.content}>
      <p className={styles.eyebrow}>Commercial Layers</p><h1 className={styles.title}>Layer workspace</h1><p className={styles.detail}>Daily laying production, flock position, performance and farm intelligence in a phone-first view.</p>
      {message&&<div className={styles.notice}>{message}</div>}
      <div className={styles.kpis}>
        <div className={styles.card}><small>Active flocks</small><strong className={styles.cardValue}>{active.length}</strong></div>
        <div className={styles.card}><small>Current birds</small><strong className={styles.cardValue}>{birds.toLocaleString()}</strong></div>
        <div className={styles.card}><small>Eggs latest day</small><strong className={styles.cardValue}>{eggs.toLocaleString()}</strong></div>
        <div className={styles.card}><small>Attention</small><strong className={styles.cardValue}>{attention}</strong></div>
      </div>
      <section className={styles.section}><div className={styles.grid}>
        <Link className={styles.card} href="/mobile/layers/commercial/flocks"><strong>Layer Flocks</strong><small>Current flock position, age, birds, production and status.</small></Link>
        <Link className={styles.card} href="/mobile/layers/commercial/daily-entry"><strong>Daily House Card</strong><small>Enter mortality, feed, water, bodyweight, eggs and quality.</small></Link>
        <Link className={styles.card} href="/mobile/layers/commercial/performance"><strong>Performance</strong><small>Review production, mortality, feed, water and bodyweight trends.</small></Link>
        <Link className={styles.card} href="/mobile/layers/commercial/intelligence"><strong>Farm Intelligence</strong><small>Priority signals, sparklines and welfare early warning.</small></Link>
      </div></section>
    </div>
    <nav className={styles.tabs}><Link className={styles.active} href="/mobile/layers/commercial"><b>⌂</b>Home</Link><Link href="/mobile/layers/commercial/flocks"><b>▦</b>Flocks</Link><Link href="/mobile/layers/commercial/daily-entry"><b>＋</b>Entry</Link><Link href="/mobile/layers/commercial/performance"><b>↗</b>Performance</Link><Link href="/mobile/layers/commercial/intelligence"><b>◉</b>Insights</Link></nav>
  </main>;
}
