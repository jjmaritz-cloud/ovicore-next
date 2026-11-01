"use client";
import { useEffect, useState } from "react";

// PROTOTYPE ONLY: browser-local storage. Replace with company-scoped, authenticated API.
export type Ingredient = { id:string; code:string; name:string; category:string; price:number; protein:string; energy:string; status:"Active"|"Inactive"; notes:string };
export type Mill = {id:string;code:string;name:string;location:string;contact:string;email:string;phone:string;kind:"Company Mill"|"External Mill";status:"Active"|"Inactive";notes:string};
export type Ration = { millId:string; id:string; code:string; name:string; supplierCode:string; supplierName:string; phase:string; type:"Base"|"Medicated"; baseId:string; status:"Draft"|"Approved"|"Inactive"; notes:string; lines:{ingredientId:string; percent:number}[] };
export type Catalog = { ingredients:Ingredient[]; rations:Ration[]; mills:Mill[] };
const STORE="ovicore.feed-operations.catalog.prototype.v1";
const EMPTY:Catalog={ingredients:[],rations:[],mills:[]};
const CHANGE="ovicore-feed-catalog-change";
export function useCatalog(){
  const [catalog,setCatalog]=useState<Catalog>(EMPTY);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const load=()=>{try{const raw=localStorage.getItem(STORE);if(raw){const obj=JSON.parse(raw);if(Array.isArray(obj.ingredients)&&Array.isArray(obj.rations))setCatalog({...obj,rations:obj.rations.map((r:Ration)=>({...r,millId:r.millId||"",supplierCode:r.supplierCode??"",supplierName:r.supplierName??""})),mills:(Array.isArray(obj.mills)?obj.mills:[]).map((m:Mill)=>({...m,kind:m.kind||"External Mill"}))});}}catch{/* corrupt browser data: keep empty */}setReady(true);};
    load(); window.addEventListener(CHANGE,load);window.addEventListener("storage",load);
    return()=>{window.removeEventListener(CHANGE,load);window.removeEventListener("storage",load);};
  },[]);
  const save=(next:Catalog)=>{try{localStorage.setItem(STORE,JSON.stringify(next));setCatalog(next);window.dispatchEvent(new Event(CHANGE));return true;}catch{return false;}};
  return {catalog,save,ready};
}
export function newId(){return typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`;}
export function totalInclusion(r:Ration){return r.lines.reduce((sum,line)=>sum+Number(line.percent||0),0);}
export function knownCost(r:Ration, ingredients:Ingredient[]){
  const amounts=r.lines.map(l=>({l,i:ingredients.find(i=>i.id===l.ingredientId)}));
  const complete=amounts.every(({i})=>!!i&&Number.isFinite(i.price));
  return {complete,cost:amounts.reduce((sum,{l,i})=>sum+(i?.price??0)*l.percent/100,0)};
}

/** Company-facing farm order display. Only the internal company ration identity is shown. */
export function farmRationLabel(r:Ration){return `${r.code} · ${r.name}`;}
/** External mill dispatch projection. Never silently use company code as supplier SKU. */
export function supplierRationLabel(r:Ration){
  if(!r.supplierCode?.trim()||!r.supplierName?.trim())return null;
  return `${r.supplierCode} · ${r.supplierName}`;
}
/** Order payload projection for the future API; order must retain both identities. */
export function rationOrderSnapshot(r:Ration){
  return {rationId:r.id,millId:r.millId,companyRationCode:r.code,companyRationDescription:r.name,
    supplierSku:r.supplierCode,supplierRationDescription:r.supplierName};
}
