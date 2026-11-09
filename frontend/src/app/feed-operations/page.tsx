"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen, CheckCircle2, ClipboardList, Factory,
  PackageCheck, Search, Sprout, Warehouse, Wheat,
} from "lucide-react";
import styles from "./page.module.css";

/** Visual styling deliberately uses CSS modules, matching the OviCore homepage
 *  without depending on global Tailwind configuration. All links remain existing routes.
 *  No sample live figures, data calls or duplicated auth/navigation are introduced. */
const modules = [
  { title: "Mill Management", eyebrow: "MILL NETWORK & PRICING", description: "Mill register, approved mill rations, supplier SKUs, descriptions and pricing.", tags: ["MILLS", "SKU MAPPING", "PRICING"], href: "/feed-operations/mills", icon: Factory, category: "Core Operations" },
  { title: "Feed Ordering", eyebrow: "SHED & FLOCK ORDERS", description: "Raise feed orders by shed and flock using the mill assigned during flock setup.", tags: ["FLOCK", "RATIONS", "ORDERS"], href: "/feed-operations/orders", icon: ClipboardList, category: "Core Operations" },
  { title: "Feed Receiving", eyebrow: "DELIVERY CONTROL", description: "Record delivered tonnes, delivery dockets, batches and silo allocations.", tags: ["RECEIPTS", "DOCKETS", "SILOS"], href: "/feed-operations/receiving", icon: PackageCheck, category: "Core Operations" },
  { title: "Ration Library", eyebrow: "DIET MANAGEMENT", description: "Manage standard rations, production phases and approved medicated variants.", tags: ["BASE DIETS", "MEDICATED", "PHASES"], href: "/feed-operations/rations", icon: BookOpen, category: "Feed Data & Controls" },
  { title: "Nutrition Intelligence", eyebrow: "FEED & NUTRIENT SUPPLY", description: "Explore Mehdi’s Beresfield formulations, feeding stages and breed-referenced nutrient supply scenarios.", tags: ["NUTRIENT INTAKE", "BREED GUIDE", "SCENARIOS"], href: "/feed-operations/nutrition", icon: Sprout, category: "Feed Data & Controls" },
  { title: "Diet Ingredients", eyebrow: "NUTRITION & COSTING", description: "Manage feed ingredients, nutrient specifications and inclusion rates.", tags: ["INGREDIENTS", "NUTRITION", "COSTS"], href: "/feed-operations/ingredients", icon: Sprout, category: "Feed Data & Controls" },
  { title: "Feed Inventory", eyebrow: "STOCK & CONSUMPTION", description: "Track silo stock, feed usage and reconciliation between deliveries and consumption.", tags: ["SILO STOCK", "USAGE", "VARIANCES"], href: "/feed-operations/inventory", icon: Warehouse, category: "Feed Data & Controls" },
] as const;

const categories = ["All", "Core Operations", "Feed Data & Controls"] as const;

export default function FeedOperationsPage() {
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => modules.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const term = search.trim().toLowerCase();
    return matchesCategory && (!term || [item.title, item.eyebrow, item.description, ...item.tags].join(" ").toLowerCase().includes(term));
  }), [category, search]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>OVICORE ECOSYSTEM / PLANNING & OPERATIONS</p>
            <h1>Feed Operations</h1>
            <p>Manage your feed supply, from mills and rations to shed-based ordering, receiving and inventory.</p>
          </div>
          <div className={styles.heroTools}>
            <Link className={styles.backLink} href="/home">Back to modules <ArrowUpRight size={14} aria-hidden="true" /></Link>
            <label className={styles.search}>
              <Search size={17} aria-hidden="true" />
              <span className={styles.srOnly}>Search Feed Operations</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Feed Operations..." />
            </label>
          </div>
        </header>

        <nav className={styles.filters} aria-label="Filter Feed Operations modules">
          {categories.map((name) => (
            <button key={name} type="button" aria-pressed={category === name} className={category === name ? styles.filterActive : styles.filter} onClick={() => setCategory(name)}>{name}</button>
          ))}
        </nav>

        {categories.slice(1).map((section) => {
          const sectionItems = filtered.filter((item) => item.category === section);
          if (!sectionItems.length) return null;
          return (
            <section className={styles.section} key={section} aria-label={section}>
              <div className={styles.sectionHeading}>
                <div><div className={styles.overline}>BUSINESS AREA</div><h2>{section}</h2></div>
                <span>{sectionItems.length} {sectionItems.length === 1 ? "module" : "modules"}</span>
              </div>
              <div className={styles.cardGrid}>
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className={styles.card}>
                      <div className={styles.cardTop}>
                        <span className={styles.icon}><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
                        <div className={styles.cardHeading}>
                          <div className={styles.eyebrow}>{item.eyebrow}</div>
                          <h3>{item.title}</h3>
                        </div>
                        <span className={styles.status}>CORE</span>
                      </div>
                      <p className={styles.description}>{item.description}</p>
                      <div className={styles.tags}>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                      <div className={styles.cardFooter}><span>Open module</span><span className={styles.arrow}><ArrowUpRight size={14} aria-hidden="true" /></span></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!filtered.length && <div className={styles.empty}>No Feed Operations modules match your search.</div>}
        <aside className={styles.rule}><CheckCircle2 size={17} aria-hidden="true"/><p><strong>Ordering rule</strong> Feed orders are always shed/flock-based. The assigned mill comes from flock setup; different sheds on the same farm may have different mills.</p></aside>
        <footer className={styles.footer}><Wheat size={15} aria-hidden="true"/> OviCore Ecosystem · Intelligence That Drives Performance.</footer>
      </div>
    </main>
  );
}
