import type { ReactNode } from "react";
import OviCoreSidebar from "@/components/sidebar/OviCoreSidebar";
import type { SidebarMenuConfig } from "@/components/sidebar/OviCoreSidebar.types";
import "./grading.css";

const gradingMenu: SidebarMenuConfig = {
  module: "grading",
  title: "OviCore",
  subtitle: "GRADING",
  sections: [
    {title: "GRADING", items: [
      {label: "OviCore Home", href: "/home"},
      {label: "Grading Overview", href: "/grading"},
    ]},
    {title: "EGG STORAGE & MOVEMENT", items: [
      {label: "Egg Storage", href: "/grading/storage"},
      {label: "Pallets & SSCC", href: "/grading/pallets"},
      {label: "Egg Dispatch", href: "/grading/dispatch"},
      {label: "Egg Receivals", href: "/grading/receiving"},
    ]},
    {title: "GRADING OPERATIONS", items: [
      {label: "Egg Inventory", href: "/grading/inventory"},
      {label: "Grading Runs", href: "/grading/runs"},
      {label: "Traceability", href: "/grading/traceability"},
    ]},
  ],
};
export default function GradingLayout({children}:{children:ReactNode}) {
  return <><OviCoreSidebar menu={gradingMenu}/>{children}</>;
}
