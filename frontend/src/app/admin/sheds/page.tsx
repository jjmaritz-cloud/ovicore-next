"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OviCoreActionBar from "@/components/ovicore/OviCoreActionBar";
import OviCoreKpiStrip from "@/components/ovicore/OviCoreKpiStrip";
import OviCorePageHeader from "@/components/ovicore/OviCorePageHeader";
import OviCoreShell from "@/components/ovicore/OviCoreShell";
import OviCoreTableCard from "@/components/ovicore/OviCoreTableCard";

type CompanyRow={id:number;company_name:string;active:boolean};
type FarmRow={id:number;company_id:number;farm_name:string;farm_code:string|null;farm_type:string;active:boolean};
type ShedRow={
  id:number;company_id:number;farm_id:number;farm_name:string|null;shed_name:string;shed_code:string|null;
  shed_type:string;housing_system:string|null;capacity_birds:number|null;length_m:number|null;width_m:number|null;
  floor_area_m2:number;number_of_levels:number|null;number_of_sections:number|null;ventilation_type:string|null;
  cooling_system:string|null;heating_system:string|null;lighting_system:string|null;water_system:string|null;
  feeder_system:string|null;nest_type:string|null;egg_collection_system:string|null;manure_system:string|null;
  year_commissioned:number|null;male_female_support:string|null;environmental_controller:string|null;
  controller_id:string|null;water_meter_id:string|null;power_meter_id:string|null;
  default_density_kg_m2:number;default_target_lw_kg:number;default_growout_days:number;
  active:boolean;notes:string|null;
};

const API_BASE="";
const COMPANIES_ENDPOINT=`${API_BASE}/api/access/companies`;
const FARMS_ENDPOINT=`${API_BASE}/api/broilers/farms`;
const SHEDS_ENDPOINT=`${API_BASE}/api/broilers/sheds`;

const SHED_TYPES:[string,string][]=[["Broiler","Broiler"],["Breeder Rearing","Breeder Rearing"],["Breeder Production","Breeder Production"],["Commercial Rearing","Commercial Rearing"],["Commercial Layers","Commercial Layers"],["Hatchery","Hatchery"],["Feed Mill","Feed Mill"],["Grading","Grading"],["Processing","Processing"]];
const HOUSING:[string,string][]=[["Floor","Floor"],["Cage","Cage"],["Barn","Barn"],["Free Range","Free Range"],["Aviary","Aviary"],["Other","Other"]];

const EMPTY_SHED:Omit<ShedRow,"id"|"company_id"|"farm_name">={
  farm_id:0,shed_name:"",shed_code:"",shed_type:"Broiler",housing_system:"Floor",capacity_birds:null,
  length_m:null,width_m:null,floor_area_m2:0,number_of_levels:1,number_of_sections:null,
  ventilation_type:"",cooling_system:"",heating_system:"",lighting_system:"",water_system:"",
  feeder_system:"",nest_type:"",egg_collection_system:"",manure_system:"",year_commissioned:null,
  male_female_support:"",environmental_controller:"",controller_id:"",water_meter_id:"",power_meter_id:"",
  default_density_kg_m2:38,default_target_lw_kg:2.4,default_growout_days:42,active:true,notes:""
};

async function authenticatedFetch(input:RequestInfo|URL,init:RequestInit={}){
  const r=await fetch(input,{...init,credentials:"include"});
  if(r.status===401){const next=`${window.location.pathname}${window.location.search}`;window.location.href=`/login?next=${encodeURIComponent(next)}`;throw new Error("Your login session has expired.");}
  return r;
}
async function apiError(r:Response,fallback:string){try{const d=await r.json();return d?.detail||fallback;}catch{return fallback;}}

type FieldDef={key:keyof ShedRow;label:string;type?:"text"|"number"|"select"|"textarea"|"boolean";options?:[string,string][];section:string};
const FIELDS:FieldDef[]=[
  {key:"shed_code",label:"Shed Code *",section:"Identity"},{key:"shed_name",label:"Shed Name *",section:"Identity"},
  {key:"shed_type",label:"Shed Type *",type:"select",options:SHED_TYPES,section:"Identity"},
  {key:"housing_system",label:"Housing System",type:"select",options:HOUSING,section:"Identity"},
  {key:"capacity_birds",label:"Capacity Birds *",type:"number",section:"Dimensions & capacity"},
  {key:"length_m",label:"Length m",type:"number",section:"Dimensions & capacity"},
  {key:"width_m",label:"Width m",type:"number",section:"Dimensions & capacity"},
  {key:"floor_area_m2",label:"Usable Floor Area m²",type:"number",section:"Dimensions & capacity"},
  {key:"number_of_levels",label:"Number of Levels",type:"number",section:"Dimensions & capacity"},
  {key:"number_of_sections",label:"Number of Sections",type:"number",section:"Dimensions & capacity"},
  {key:"ventilation_type",label:"Ventilation Type",section:"Systems"},{key:"cooling_system",label:"Cooling System",section:"Systems"},
  {key:"heating_system",label:"Heating System",section:"Systems"},{key:"lighting_system",label:"Lighting System",section:"Systems"},
  {key:"water_system",label:"Water System",section:"Systems"},{key:"feeder_system",label:"Feeder System",section:"Systems"},
  {key:"nest_type",label:"Nest Type",section:"Production equipment"},{key:"egg_collection_system",label:"Egg Collection System",section:"Production equipment"},
  {key:"manure_system",label:"Manure System",section:"Production equipment"},{key:"male_female_support",label:"Male Female Support",section:"Production equipment"},
  {key:"year_commissioned",label:"Year Commissioned",type:"number",section:"Controls & meters"},
  {key:"environmental_controller",label:"Environmental Controller",section:"Controls & meters"},
  {key:"controller_id",label:"Controller ID",section:"Controls & meters"},{key:"water_meter_id",label:"Water Meter ID",section:"Controls & meters"},
  {key:"power_meter_id",label:"Power Meter ID",section:"Controls & meters"},
  {key:"default_density_kg_m2",label:"Broiler Default kg/m²",type:"number",section:"Broiler planning defaults"},
  {key:"default_target_lw_kg",label:"Broiler Target LW kg",type:"number",section:"Broiler planning defaults"},
  {key:"default_growout_days",label:"Broiler Growout Days",type:"number",section:"Broiler planning defaults"},
  {key:"active",label:"Active *",type:"boolean",section:"Status & notes"},{key:"notes",label:"Notes",type:"textarea",section:"Status & notes"},
];

export default function AdminShedRegisterPage(){
  const [companies,setCompanies]=useState<CompanyRow[]>([]);
  const [farms,setFarms]=useState<FarmRow[]>([]);
  const [rows,setRows]=useState<ShedRow[]>([]);
  const [selectedCompanyId,setSelectedCompanyId]=useState<number|null>(null);
  const [selectedFarmId,setSelectedFarmId]=useState<number|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [editorOpen,setEditorOpen]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [form,setForm]=useState<any>({...EMPTY_SHED});

  const selectedCompany=useMemo(()=>companies.find(c=>c.id===selectedCompanyId)??null,[companies,selectedCompanyId]);
  const selectedFarm=useMemo(()=>farms.find(f=>f.id===selectedFarmId)??null,[farms,selectedFarmId]);

  const loadCompanies=useCallback(async()=>{
    const r=await authenticatedFetch(COMPANIES_ENDPOINT,{cache:"no-store"});if(!r.ok)throw new Error(await apiError(r,"Could not load companies."));
    const data:CompanyRow[]=await r.json();setCompanies(data);setSelectedCompanyId(current=>current&&data.some(c=>c.id===current)?current:(data.find(c=>c.active)??data[0])?.id??null);
  },[]);
  const loadFarms=useCallback(async(companyId:number|null)=>{
    if(!companyId){setFarms([]);setSelectedFarmId(null);return;}
    const r=await authenticatedFetch(`${FARMS_ENDPOINT}?company_id=${companyId}`,{cache:"no-store"});if(!r.ok)throw new Error(await apiError(r,"Could not load farms."));
    const data:FarmRow[]=await r.json();setFarms(data);setSelectedFarmId(current=>current&&data.some(f=>f.id===current)?current:(data.find(f=>f.active)??data[0])?.id??null);
  },[]);
  const loadSheds=useCallback(async(companyId:number|null,farmId:number|null)=>{
    if(!companyId||!farmId){setRows([]);setLoading(false);return;}
    setLoading(true);try{
      const r=await authenticatedFetch(`${SHEDS_ENDPOINT}?company_id=${companyId}&farm_id=${farmId}`,{cache:"no-store"});if(!r.ok)throw new Error(await apiError(r,"Could not load sheds."));
      setRows(await r.json());
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{loadCompanies().catch(e=>alert(e.message));},[loadCompanies]);
  useEffect(()=>{loadFarms(selectedCompanyId).catch(e=>alert(e.message));},[selectedCompanyId,loadFarms]);
  useEffect(()=>{void loadSheds(selectedCompanyId,selectedFarmId);},[selectedCompanyId,selectedFarmId,loadSheds]);

  function openNew(){
    if(!selectedFarmId)return alert("Select a farm first.");
    const farmType=selectedFarm?.farm_type;
    const shedType=farmType==="broiler"?"Broiler":farmType==="breeder_rearing"?"Breeder Rearing":farmType==="breeder_layers"?"Breeder Production":farmType==="layer_rearing"?"Commercial Rearing":farmType==="commercial_layers"?"Commercial Layers":"Broiler";
    setEditingId(null);setForm({...EMPTY_SHED,farm_id:selectedFarmId,shed_type:shedType});setEditorOpen(true);
  }
  function openEdit(row:ShedRow){setEditingId(row.id);setForm({...row});setEditorOpen(true);}
  function update(key:keyof ShedRow,value:any){
    setForm((current:any)=>{
      const next={...current,[key]:value};
      if((key==="length_m"||key==="width_m")&&Number(next.length_m)>0&&Number(next.width_m)>0){next.floor_area_m2=Number((Number(next.length_m)*Number(next.width_m)).toFixed(2));}
      return next;
    });
  }

  async function saveShed(){
    if(!selectedCompanyId||!selectedFarmId)return alert("Select a company and farm.");
    if(!String(form.shed_code??"").trim())return alert("Shed Code is required.");
    if(!String(form.shed_name??"").trim())return alert("Shed Name is required.");
    if(!Number(form.capacity_birds||0))return alert("Capacity Birds is required.");
    if(!Number(form.floor_area_m2||0))return alert("Usable Floor Area is required.");
    setSaving(true);
    try{
      const payload={...form,company_id:selectedCompanyId,farm_id:selectedFarmId};
      if(editingId){
        const r=await authenticatedFetch(`${SHEDS_ENDPOINT}/${editingId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!r.ok)throw new Error(await apiError(r,"Could not save shed."));
      }else{
        const create=await authenticatedFetch(SHEDS_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          company_id:selectedCompanyId,farm_id:selectedFarmId,shed_name:payload.shed_name,shed_code:payload.shed_code,
          floor_area_m2:payload.floor_area_m2,default_density_kg_m2:payload.default_density_kg_m2,
          default_target_lw_kg:payload.default_target_lw_kg,default_growout_days:payload.default_growout_days,active:payload.active
        })});
        if(!create.ok)throw new Error(await apiError(create,"Could not create shed."));
        const created=await create.json();
        const patch=await authenticatedFetch(`${SHEDS_ENDPOINT}/${created.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!patch.ok)throw new Error(await apiError(patch,"Shed created, but additional details could not be saved."));
      }
      setEditorOpen(false);await loadSheds(selectedCompanyId,selectedFarmId);
    }catch(e){alert(e instanceof Error?e.message:"Could not save shed.");}finally{setSaving(false);}
  }

  const activeCount=rows.filter(r=>r.active).length;
  const totalCapacity=rows.reduce((s,r)=>s+Number(r.capacity_birds??0),0);
  const totalArea=rows.reduce((s,r)=>s+Number(r.floor_area_m2??0),0);

  return <OviCoreShell module="admin">
    <OviCorePageHeader title="Shed Register" subtitle="Shed setup aligned to the approved OviCore master import template."><span className="ovicore-pill ovicore-pill-green">Global Admin</span></OviCorePageHeader>
    <OviCoreKpiStrip items={[
      {label:"Selected Company",value:selectedCompany?.company_name??"None"},{label:"Selected Farm",value:selectedFarm?.farm_name??"None"},
      {label:"Total Sheds",value:rows.length},{label:"Active",value:activeCount},
      {label:"Bird Capacity",value:totalCapacity.toLocaleString("en-AU")},{label:"Floor Area m²",value:totalArea.toLocaleString("en-AU")}
    ]}/>
    <OviCoreActionBar left={<>
      <label style={{display:"flex",alignItems:"center",gap:8,fontWeight:800,fontSize:12}}>Company
        <select className="ovicore-select" value={selectedCompanyId??""} onChange={e=>setSelectedCompanyId(Number(e.target.value))}>{companies.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
      </label>
      <label style={{display:"flex",alignItems:"center",gap:8,fontWeight:800,fontSize:12}}>Farm
        <select className="ovicore-select" value={selectedFarmId??""} onChange={e=>setSelectedFarmId(Number(e.target.value))}>{farms.map(f=><option key={f.id} value={f.id}>{f.farm_name}</option>)}</select>
      </label>
      <button className="ovicore-btn ovicore-btn-primary" onClick={openNew}>New shed</button>
    </>} right={<button className="ovicore-btn" onClick={()=>loadSheds(selectedCompanyId,selectedFarmId)}>Reload</button>}/>
    <OviCoreTableCard title="Sheds" subtitle="Select Edit to maintain all building, equipment and meter fields.">
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr>{["Shed Code","Shed Name","Shed Type","Housing","Capacity","Floor Area","Status",""].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{loading?<tr><td colSpan={8} style={td}>Loading sheds...</td></tr>:rows.map(row=><tr key={row.id}>
          <td style={td}>{row.shed_code}</td><td style={tdStrong}>{row.shed_name}</td><td style={td}>{row.shed_type}</td><td style={td}>{row.housing_system||"—"}</td>
          <td style={td}>{Number(row.capacity_birds??0).toLocaleString("en-AU")}</td><td style={td}>{Number(row.floor_area_m2??0).toLocaleString("en-AU")}</td>
          <td style={td}>{row.active?"Active":"Inactive"}</td><td style={td}><button className="ovicore-btn" onClick={()=>openEdit(row)}>Edit</button></td>
        </tr>)}</tbody>
      </table></div>
    </OviCoreTableCard>
    {editorOpen&&<div style={overlay}><div style={modal}>
      <div style={modalHeader}><div><strong style={{fontSize:20}}>{editingId?"Edit Shed":"New Shed"}</strong><div style={{fontSize:12,color:"#55716b"}}>Fields match the Sheds import sheet.</div></div><button className="ovicore-btn" onClick={()=>setEditorOpen(false)}>Close</button></div>
      <div style={{overflowY:"auto",padding:18}}>
        {Array.from(new Set(FIELDS.map(f=>f.section))).map(section=><section key={section} style={{marginBottom:18}}>
          <h3 style={sectionTitle}>{section}</h3><div style={formGrid}>
            {FIELDS.filter(f=>f.section===section).map(field=><label key={String(field.key)} style={labelStyle}><span>{field.label}</span>
              {field.type==="textarea"?<textarea style={inputStyle} rows={3} value={form[field.key]??""} onChange={e=>update(field.key,e.target.value)}/>:
              field.type==="select"?<select style={inputStyle} value={form[field.key]??""} onChange={e=>update(field.key,e.target.value)}>{field.options?.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:
              field.type==="boolean"?<select style={inputStyle} value={form[field.key]===true?"true":form[field.key]===false?"false":""} onChange={e=>update(field.key,e.target.value===""?null:e.target.value==="true")}><option value="">Not set</option><option value="true">Yes</option><option value="false">No</option></select>:
              <input style={inputStyle} type={field.type==="number"?"number":"text"} step="any" value={form[field.key]??""} onChange={e=>update(field.key,field.type==="number"?(e.target.value===""?null:Number(e.target.value)):e.target.value)}/>}
            </label>)}
          </div>
        </section>)}
      </div>
      <div style={modalFooter}><button className="ovicore-btn" onClick={()=>setEditorOpen(false)}>Cancel</button><button className="ovicore-btn ovicore-btn-primary" disabled={saving} onClick={saveShed}>{saving?"Saving...":"Save shed"}</button></div>
    </div></div>}
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
