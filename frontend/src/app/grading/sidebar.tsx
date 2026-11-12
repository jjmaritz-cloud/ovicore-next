"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Warehouse, ScanBarcode, Truck, PackageCheck, Boxes, Settings2, GitBranch, Menu, ArrowLeft } from "lucide-react";
import "./grading.css";
const menu = [
 ["/grading", "Overview", LayoutDashboard],
 ["/grading/storage", "Egg Storage", Warehouse],
 ["/grading/pallets", "Pallets & SSCC", ScanBarcode],
 ["/grading/dispatch", "Dispatch", Truck],
 ["/grading/receiving", "Receivals", PackageCheck],
 ["/grading/inventory", "Inventory", Boxes],
 ["/grading/runs", "Grading Runs", Settings2],
 ["/grading/traceability", "Traceability", GitBranch],
] as const;
export default function GradingSidebar() {
 const pathname = usePathname(); const [open,setOpen] = useState(false);
 return <><button className="grading-mobile-toggle" onClick={()=>setOpen(!open)} aria-label="Toggle grading menu"><Menu size={19}/> Grading Menu</button>
 <aside className={`grading-sidebar ${open ? "grading-open" : ""}`}>
  <div className="grading-brand">OVICORE <small>GRADING</small></div>
  <Link href="/home" className="grading-back"><ArrowLeft size={16}/> Ecosystem</Link>
  <nav aria-label="Grading navigation">{menu.map(([href,title,Icon])=><Link key={href} href={href} onClick={()=>setOpen(false)} className={`grading-nav-link ${pathname===href ? "grading-current" : ""}`}><Icon size={17}/>{title}</Link>)}</nav>
  <div className="grading-sidebar-note">Stage 1 · Administrator pilot</div>
 </aside></>;
}
