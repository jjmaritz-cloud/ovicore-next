"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * OviCore Feed Operations starter landing page.
 * Replace local relative routes only if an existing OviCore page already owns that path.
 * This screen intentionally does NOT use sample live data, fabricate orders, or make API calls.
 * Reuse the existing OviCore auth/tenant sidebar layout instead of adding a second sidebar.
 */
const sections = [
  { title: "Mill Management", description: "Mill register, mill-specific ration SKU mapping and pricing", href: "/feed-operations/mills", icon: "🏭" },
  { title: "Feed Ordering", description: "Orders by shed and flock, using the flock's assigned mill", href: "/feed-operations/orders", icon: "📋" },
  { title: "Feed Receiving", description: "Delivery dockets, received tonnes, batch and silo allocation", href: "/feed-operations/receiving", icon: "🚚" },
  { title: "Ration Library", description: "Approved rations, diet phases, base and medicated variants", href: "/feed-operations/rations", icon: "📗" },
  { title: "Diet Ingredients", description: "Ingredients, nutritional specifications and inclusion rates", href: "/feed-operations/ingredients", icon: "🌾" },
  { title: "Feed Inventory", description: "Silo balances, reconciliations and consumption", href: "/feed-operations/inventory", icon: "⚖️" },
];

export default function FeedOperationsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">OviCore Ecosystem</p>
        <h1 className="mt-1 text-2xl font-bold">Feed Operations</h1>
        <p className="mt-1 text-sm text-slate-600">Mill management, shed-based feed ordering and feed receiving in one place.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link href={section.href} key={section.href} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-600">
              <div className="flex items-center gap-2"><span aria-hidden="true" className="text-lg">{section.icon}</span><h2 className="text-sm font-semibold group-hover:text-amber-800">{section.title}</h2></div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{section.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <strong>Core rule:</strong> Each order belongs to a specific shed and flock. The mill is assigned when the flock is created. Different sheds on the same farm may use different mills.
        </div>
      </div>
    </main>
  );
}
