"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OviCoreActionBar from "@/components/ovicore/OviCoreActionBar";
import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";

type CompanyRow = { id:number; company_name:string; active:boolean };
type FarmRow = {
  id:number; company_id:number; farm_name:string; farm_code:string|null; common_name:string|null;
  farm_type:string; region:string|null; farm_manager:string|null; address_line_1:string|null;
  address_line_2:string|null; suburb:string|null; state:string|null; postcode:string|null;
  country:string|null; latitude:number|null; longitude:number|null; time_zone:string|null;
  total_bird_capacity:number|null; licensed_bird_capacity:number|null; water_source:string|null;
  water_storage_litres:number|null; power_supply:string|null; backup_generator:boolean|null;
  generator_capacity_kva:number|null; feed_delivery_access:string|null; truck_restrictions:string|null;
  biosecurity_classification:string|null; shower_in_shower_out:boolean|null;
  visitor_approval_required:boolean|null; mortality_disposal_method:string|null;
  manure_disposal_method:string|null; environmental_licence_number:string|null;
  free_range_area_ha:number|null; emergency_contact:string|null; emergency_phone:string|null;
  active:boolean; notes:string|null;
};

const API_BASE = "";
const COMPANIES_ENDPOINT = `${API_BASE}/api/access/companies`;
const FARMS_ENDPOINT = `${API_BASE}/api/broilers/farms`;

const FARM_TYPES: [string, string][] = [
  ["broiler","Broiler"],["breeder_rearing","Breeder Rearing"],["breeder_layers","Breeder Production"],
  ["layer_rearing","Commercial Rearing"],["commercial_layers","Commercial Layers"],
  ["hatchery","Hatchery"],["feed_mill","Feed Mill"],["grading","Grading"],["processing","Processing"],
];

const EMPTY_FARM: Omit<FarmRow,"id"|"company_id"> = {
  farm_name:"", farm_code:"", common_name:"", farm_type:"broiler", region:"", farm_manager:"",
  address_line_1:"", address_line_2:"", suburb:"", state:"NSW", postcode:"", country:"Australia",
  latitude:null, longitude:null, time_zone:"Australia/Sydney", total_bird_capacity:null,
  licensed_bird_capacity:null, water_source:"", water_storage_litres:null, power_supply:"",
  backup_generator:null, generator_capacity_kva:null, feed_delivery_access:"", truck_restrictions:"",
  biosecurity_classification:"", shower_in_shower_out:null, visitor_approval_required:null,
  mortality_disposal_method:"", manure_disposal_method:"", environmental_licence_number:"",
  free_range_area_ha:null, emergency_contact:"", emergency_phone:"", active:true, notes:"",
};

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input,{...init,credentials:"include"});
  if(response.status===401){
    const nextPath=`${window.location.pathname}${window.location.search}`;
    window.location.href=`/login?next=${encodeURIComponent(nextPath)}`;
    throw new Error("Your login session has expired.");
  }
  return response;
}
async function apiError(response:Response, fallback:string){
  try{const data=await response.json(); return data?.detail || fallback;}catch{return fallback;}
}
function boolText(value:boolean|null){return value===true?"Yes":value===false?"No":"Not set";}
function farmTypeLabel(value:string){return FARM_TYPES.find(([key])=>key===value)?.[1] ?? value;}

type FieldDef = {key:keyof FarmRow; label:string; type?:"text"|"number"|"select"|"textarea"|"boolean"; options?:[string,string][]; section:string};
const FIELDS:FieldDef[]=[
  {key:"farm_code",label:"Farm Code *",section:"Identity"},{key:"farm_name",label:"Farm Name *",section:"Identity"},
  {key:"common_name",label:"Common Name",section:"Identity"},{key:"farm_type",label:"Production Type *",type:"select",options:FARM_TYPES,section:"Identity"},
  {key:"region",label:"Region",section:"Identity"},{key:"farm_manager",label:"Farm Manager",section:"Identity"},
  {key:"address_line_1",label:"Address Line 1",section:"Location"},{key:"address_line_2",label:"Address Line 2",section:"Location"},
  {key:"suburb",label:"Suburb",section:"Location"},{key:"state",label:"State",section:"Location"},
  {key:"postcode",label:"Postcode",section:"Location"},{key:"country",label:"Country",section:"Location"},
  {key:"latitude",label:"Latitude",type:"number",section:"Location"},{key:"longitude",label:"Longitude",type:"number",section:"Location"},
  {key:"time_zone",label:"Time Zone",section:"Location"},
  {key:"total_bird_capacity",label:"Total Bird Capacity",type:"number",section:"Capacity & utilities"},
  {key:"licensed_bird_capacity",label:"Licensed Bird Capacity",type:"number",section:"Capacity & utilities"},
  {key:"water_source",label:"Water Source",section:"Capacity & utilities"},{key:"water_storage_litres",label:"Water Storage Litres",type:"number",section:"Capacity & utilities"},
  {key:"power_supply",label:"Power Supply",section:"Capacity & utilities"},{key:"backup_generator",label:"Backup Generator",type:"boolean",section:"Capacity & utilities"},
  {key:"generator_capacity_kva",label:"Generator Capacity kVA",type:"number",section:"Capacity & utilities"},
  {key:"feed_delivery_access",label:"Feed Delivery Access",section:"Access & biosecurity"},
  {key:"truck_restrictions",label:"Truck Restrictions",type:"textarea",section:"Access & biosecurity"},
  {key:"biosecurity_classification",label:"Biosecurity Classification",section:"Access & biosecurity"},
  {key:"shower_in_shower_out",label:"Shower In / Shower Out",type:"boolean",section:"Access & biosecurity"},
  {key:"visitor_approval_required",label:"Visitor Approval Required",type:"boolean",section:"Access & biosecurity"},
  {key:"mortality_disposal_method",label:"Mortality Disposal Method",section:"Environment"},
  {key:"manure_disposal_method",label:"Manure Disposal Method",section:"Environment"},
  {key:"environmental_licence_number",label:"Environmental Licence Number",section:"Environment"},
  {key:"free_range_area_ha",label:"Free Range Area ha",type:"number",section:"Environment"},
  {key:"emergency_contact",label:"Emergency Contact",section:"Emergency & notes"},
  {key:"emergency_phone",label:"Emergency Phone",section:"Emergency & notes"},
  {key:"active",label:"Active *",type:"boolean",section:"Emergency & notes"},
  {key:"notes",label:"Notes",type:"textarea",section:"Emergency & notes"},
];

export default function AdminFarmRegisterPage(){
  const [companies,setCompanies]=useState<CompanyRow[]>([]);
  const [selectedCompanyId,setSelectedCompanyId]=useState<number|null>(null);
  const [rows,setRows]=useState<FarmRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [form,setForm]=useState<any>({...EMPTY_FARM});

  const selectedCompany=useMemo(()=>companies.find(c=>c.id===selectedCompanyId)??null,[companies,selectedCompanyId]);

  const loadCompanies=useCallback(async()=>{
    const r=await authenticatedFetch(COMPANIES_ENDPOINT,{cache:"no-store"});
    if(!r.ok) throw new Error(await apiError(r,"Could not load companies."));
    const data:CompanyRow[]=await r.json(); setCompanies(data);
    setSelectedCompanyId(current=>current && data.some(c=>c.id===current)?current:(data.find(c=>c.active)??data[0])?.id??null);
  },[]);
  const loadFarms=useCallback(async(companyId:number|null)=>{
    if(!companyId){setRows([]);setLoading(false);return;}
    setLoading(true);
    try{
      const r=await authenticatedFetch(`${FARMS_ENDPOINT}?company_id=${companyId}`,{cache:"no-store"});
      if(!r.ok) throw new Error(await apiError(r,"Could not load farms."));
      setRows(await r.json());
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{loadCompanies().catch(e=>alert(e.message));},[loadCompanies]);
  useEffect(()=>{void loadFarms(selectedCompanyId);},[selectedCompanyId,loadFarms]);

  function openNew(){setEditingId(null);setForm({...EMPTY_FARM});setEditorOpen(true);}
  function openEdit(row:FarmRow){setEditingId(row.id);setForm({...row});setEditorOpen(true);}
  function update(key:keyof FarmRow,value:any){setForm((current:any)=>({...current,[key]:value}));}

  async function saveFarm(){
    if(!selectedCompanyId) return alert("Select a company first.");
    if(!String(form.farm_code??"").trim()) return alert("Farm Code is required.");
    if(!String(form.farm_name??"").trim()) return alert("Farm Name is required.");
    setSaving(true);
    try{
      const payload={...form,company_id:selectedCompanyId};
      if(editingId){
        const r=await authenticatedFetch(`${FARMS_ENDPOINT}/${editingId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!r.ok) throw new Error(await apiError(r,"Could not save farm."));
      }else{
        const create=await authenticatedFetch(FARMS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          company_id:selectedCompanyId,farm_name:payload.farm_name,farm_code:payload.farm_code,farm_type:payload.farm_type,active:payload.active
        })});
        if(!create.ok) throw new Error(await apiError(create,"Could not create farm."));
        const created=await create.json();
        const patch=await authenticatedFetch(`${FARMS_ENDPOINT}/${created.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!patch.ok) throw new Error(await apiError(patch,"Farm created, but additional details could not be saved."));
      }
      setEditorOpen(false); await loadFarms(selectedCompanyId);
    }catch(e){alert(e instanceof Error?e.message:"Could not save farm.");}finally{setSaving(false);}
  }

  const activeCount=rows.filter(r=>r.active).length;
  const totalCapacity=rows.reduce((s,r)=>s+Number(r.total_bird_capacity??0),0);

  return <OviCoreShell module="admin">
    <OviCorePageHeader title="Farm Register" subtitle="Farm setup aligned to the approved OviCore master import template.">
      <span className="ovicore-pill ovicore-pill-green">Global Admin</span>
    </OviCorePageHeader>
    <OviCoreKpiStrip items={[
      {label:"Selected Company",value:selectedCompany?.company_name??"None"},
      {label:"Total Farms",value:rows.length},{label:"Active",value:activeCount},
      {label:"Total Capacity",value:totalCapacity.toLocaleString("en-AU")}
    ]}/>
    <OviCoreActionBar left={<>
      <label style={{display:"flex",alignItems:"center",gap:8,fontWeight:800,fontSize:12}}>Company
        <select className="ovicore-select" value={selectedCompanyId??""} onChange={e=>setSelectedCompanyId(Number(e.target.value))}>
          {companies.map(c=><option key={c.id} value={c.id}>{c.company_name}{c.active?"":" (Inactive)"}</option>)}
        </select>
      </label>
      <button className="ovicore-btn ovicore-btn-primary" onClick={openNew}>New farm</button>
    </>} right={<button className="ovicore-btn" onClick={()=>loadFarms(selectedCompanyId)}>Reload</button>}/>
    <OviCoreTableCard title="Farms" subtitle="Select Edit to maintain the full farm record.">
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Farm Code","Farm Name","Production Type","Region","Manager","Capacity","Status",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={td}>Loading farms...</td></tr>:rows.map(row=><tr key={row.id}>
              <td style={td}>{row.farm_code}</td><td style={tdStrong}>{row.farm_name}</td><td style={td}>{farmTypeLabel(row.farm_type)}</td>
              <td style={td}>{row.region||"—"}</td><td style={td}>{row.farm_manager||"—"}</td>
              <td style={td}>{Number(row.total_bird_capacity??0).toLocaleString("en-AU")}</td>
              <td style={td}>{row.active?"Active":"Inactive"}</td>
              <td style={td}><button className="ovicore-btn" onClick={()=>openEdit(row)}>Edit</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </OviCoreTableCard>
    {editorOpen&&<div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}><div><strong style={{fontSize:20}}>{editingId?"Edit Farm":"New Farm"}</strong><div style={{fontSize:12,color:"#55716b"}}>Fields match the Farms import sheet.</div></div><button className="ovicore-btn" onClick={()=>setEditorOpen(false)}>Close</button></div>
        <div style={{overflowY:"auto",padding:18}}>
          {Array.from(new Set(FIELDS.map(f=>f.section))).map(section=><section key={section} style={{marginBottom:18}}>
            <h3 style={sectionTitle}>{section}</h3><div style={formGrid}>
              {FIELDS.filter(f=>f.section===section).map(field=><label key={String(field.key)} style={labelStyle}>
                <span>{field.label}</span>
                {field.type==="textarea"?<textarea style={inputStyle} rows={3} value={form[field.key]??""} onChange={e=>update(field.key,e.target.value)}/>:
                field.type==="select"?<select style={inputStyle} value={form[field.key]??""} onChange={e=>update(field.key,e.target.value)}>{field.options?.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:
                field.type==="boolean"?<select style={inputStyle} value={form[field.key]===true?"true":form[field.key]===false?"false":""} onChange={e=>update(field.key,e.target.value===""?null:e.target.value==="true")}><option value="">Not set</option><option value="true">Yes</option><option value="false">No</option></select>:
                <input style={inputStyle} type={field.type==="number"?"number":"text"} step="any" value={form[field.key]??""} onChange={e=>update(field.key,field.type==="number"?(e.target.value===""?null:Number(e.target.value)):e.target.value)}/>}
              </label>)}
            </div>
          </section>)}
        </div>
        <div style={modalFooter}><button className="ovicore-btn" onClick={()=>setEditorOpen(false)}>Cancel</button><button className="ovicore-btn ovicore-btn-primary" disabled={saving} onClick={saveFarm}>{saving?"Saving...":"Save farm"}</button></div>
      </div>
    </div>}
  </OviCoreShell>;
}
const th:React.CSSProperties={textAlign:"left",padding:"10px 12px",background:"#eaf4ef",borderBottom:"1px solid #cadfd6",whiteSpace:"nowrap"};
const td:React.CSSProperties={padding:"10px 12px",borderBottom:"1px solid #e3ece8",verticalAlign:"middle"};
const tdStrong:React.CSSProperties={...td,fontWeight:800,color:"#083c34"};
const overlay:React.CSSProperties={position:"fixed",inset:0,background:"rgba(3,32,27,.5)",zIndex:1000,display:"flex",justifyContent:"flex-end"};
const modal:React.CSSProperties={width:"min(980px,96vw)",height:"100vh",background:"#f8fbf9",display:"grid",gridTemplateRows:"auto 1fr auto",boxShadow:"-18px 0 50px rgba(0,0,0,.2)"};
const modalHeader:React.CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",borderBottom:"1px solid #d8e6e0",background:"#fff"};
const modalFooter:React.CSSProperties={display:"flex",justifyContent:"flex-end",gap:8,padding:"14px 18px",borderTop:"1px solid #d8e6e0",background:"#fff"};
const formGrid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12};
const labelStyle:React.CSSProperties={display:"grid",gap:5,fontSize:11,fontWeight:800,color:"#173f38"};
const inputStyle:React.CSSProperties={width:"100%",minHeight:38,border:"1px solid #bfd4cc",borderRadius:8,padding:"8px 10px",background:"#fff",color:"#082f2a"};
const sectionTitle:React.CSSProperties={margin:"0 0 10px",paddingBottom:6,borderBottom:"1px solid #d5e6df",fontSize:13,color:"#07624f",textTransform:"uppercase",letterSpacing:".08em"};
