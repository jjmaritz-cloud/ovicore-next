"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  Search,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Users,
} from "lucide-react";
import styles from "./compliance.module.css";
import OviCoreTour from "@/components/OviCoreTour";

type AreaKey = "overview" | "safety" | "training" | "incidents" | "audit";

type ActionItem = {
  item: string;
  area: string;
  site: string;
  owner: string;
  due: string;
  status: "Overdue" | "Due soon" | "Open";
};

const actions: ActionItem[] = [
  { item: "Close corrective action CA-018", area: "Audit", site: "Farm 4", owner: "J. Smith", due: "14 Aug", status: "Overdue" },
  { item: "Renew forklift competency", area: "Training", site: "Feed Mill", owner: "M. Hall", due: "20 Aug", status: "Due soon" },
  { item: "Upload emergency drill evidence", area: "Safety", site: "Farm 2", owner: "K. Jones", due: "22 Aug", status: "Due soon" },
  { item: "Complete investigation INC-026", area: "Incident", site: "Farm 1", owner: "A. Brown", due: "25 Aug", status: "Open" },
  { item: "Review chemical register", area: "Audit", site: "Farm 3", owner: "S. Lee", due: "29 Aug", status: "Open" },
];

const readinessAreas = [
  { label: "Training & competency", score: 91, note: "3 records require attention" },
  { label: "Safety records", score: 94, note: "1 drill evidence item missing" },
  { label: "SOP acknowledgement", score: 86, note: "7 acknowledgements outstanding" },
  { label: "Corrective actions", score: 72, note: "2 overdue actions" },
  { label: "Operational records", score: 98, note: "Daily records complete" },
  { label: "Traceability & evidence", score: 89, note: "2 evidence files missing" },
];

const auditChecks = [
  { name: "Staff training records current", complete: 37, total: 40 },
  { name: "SOP acknowledgements complete", complete: 46, total: 53 },
  { name: "Corrective actions closed", complete: 13, total: 15 },
  { name: "Emergency drills in date", complete: 7, total: 8 },
  { name: "Daily operational records", complete: 31, total: 31 },
];

const navItems: { key: AreaKey; label: string; icon: typeof ShieldCheck }[] = [
  { key: "overview", label: "Overview", icon: ShieldCheck },
  { key: "safety", label: "Safety", icon: HeartPulse },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "incidents", label: "Incidents", icon: Siren },
  { key: "audit", label: "Audit Readiness", icon: ClipboardCheck },
];

export default function CompliancePage() {
  const [active, setActive] = useState<AreaKey>("overview");
  const [query, setQuery] = useState("");

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((action) =>
      [action.item, action.area, action.site, action.owner, action.status]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const readinessScore = 87;

  return (
    <main className={styles.shell}>
      <section className={styles.content}>
        <header className={styles.header} data-tour="compliance-command">
          <div>
            <span className={styles.eyebrow}>People, Safety & Compliance</span>
            <h1>Assurance command centre</h1>
            <p>
              Keep people safe, competencies current and every site ready for its next audit.
            </p>
          </div>
          <div className={styles.headerScore}>
            <span>Overall readiness</span>
            <strong>{readinessScore}%</strong>
            <small>12 items need attention</small>
          </div>
        </header>

        <nav className={styles.nav} aria-label="People, Safety and Compliance areas">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={active === key ? styles.navActive : ""}
              onClick={() => setActive(key)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        {(active === "overview" || active === "audit") && (
          <>
            <section className={styles.kpiGrid} aria-label="Compliance summary">
              <article className={styles.kpiCard}>
                <div className={styles.kpiIcon}><AlertTriangle size={19} /></div>
                <div><span>Open incidents</span><strong>4</strong><small>1 investigation overdue</small></div>
              </article>
              <article className={styles.kpiCard}>
                <div className={styles.kpiIcon}><GraduationCap size={19} /></div>
                <div><span>Training current</span><strong>94%</strong><small>3 expiring this month</small></div>
              </article>
              <article className={styles.kpiCard}>
                <div className={styles.kpiIcon}><ClipboardCheck size={19} /></div>
                <div><span>Audit actions</span><strong>7</strong><small>2 overdue</small></div>
              </article>
              <article className={styles.kpiCard}>
                <div className={styles.kpiIcon}><FileCheck2 size={19} /></div>
                <div><span>Evidence complete</span><strong>89%</strong><small>6 files still required</small></div>
              </article>
            </section>

            <section className={styles.auditHero} data-tour="audit-readiness">
              <div className={styles.readinessPanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <span className={styles.panelEyebrow}>Audit Readiness</span>
                    <h2>Live readiness by control area</h2>
                  </div>
                  <button type="button" className={styles.primaryButton}>
                    Build audit pack <ArrowRight size={16} />
                  </button>
                </div>

                <div className={styles.readinessGrid}>
                  <div className={styles.scoreRing} style={{ "--score": `${readinessScore * 3.6}deg` } as React.CSSProperties}>
                    <div><strong>{readinessScore}%</strong><span>Ready</span></div>
                  </div>
                  <div className={styles.areaList}>
                    {readinessAreas.map((area) => (
                      <div className={styles.areaRow} key={area.label}>
                        <div className={styles.areaTop}>
                          <span>{area.label}</span>
                          <strong>{area.score}%</strong>
                        </div>
                        <div className={styles.progress}><span style={{ width: `${area.score}%` }} /></div>
                        <small>{area.note}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className={styles.nextAudit}>
                <div className={styles.panelHeadingCompact}>
                  <div className={styles.calendarIcon}><CalendarClock size={19} /></div>
                  <div><span>Next scheduled audit</span><h2>Farm 4</h2></div>
                </div>
                <div className={styles.auditDate}>18 Sep 2026</div>
                <p>Customer welfare & food safety audit</p>
                <div className={styles.auditMeta}>
                  <span><strong>32</strong> days</span>
                  <span><strong>12</strong> open items</span>
                </div>
                <button type="button" className={styles.secondaryButton}>Open audit workspace</button>
              </aside>
            </section>

            <section className={styles.twoColumn}>
              <article className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div><span className={styles.panelEyebrow}>Evidence coverage</span><h2>Key audit checks</h2></div>
                  <span className={styles.smallStatus}>Live</span>
                </div>
                <div className={styles.checkList}>
                  {auditChecks.map((check) => {
                    const pct = Math.round((check.complete / check.total) * 100);
                    return (
                      <div className={styles.checkRow} key={check.name}>
                        <CheckCircle2 size={17} />
                        <div><span>{check.name}</span><small>{check.complete} of {check.total} complete</small></div>
                        <strong>{pct}%</strong>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.panelHeading}>
                  <div><span className={styles.panelEyebrow}>Priority</span><h2>What needs attention</h2></div>
                  <TriangleAlert size={20} />
                </div>
                <div className={styles.attentionList}>
                  <div><span className={styles.badgeOverdue}>Overdue</span><strong>Corrective action CA-018</strong><small>Farm 4 · due 14 Aug</small></div>
                  <div><span className={styles.badgeSoon}>Due soon</span><strong>3 competencies expire this month</strong><small>Feed Mill & Farm 2</small></div>
                  <div><span className={styles.badgeOpen}>Missing</span><strong>Emergency drill evidence</strong><small>Farm 2 · last drill completed</small></div>
                  <div><span className={styles.badgeOpen}>Outstanding</span><strong>7 SOP acknowledgements</strong><small>Across 3 sites</small></div>
                </div>
              </article>
            </section>
          </>
        )}

        {active !== "overview" && active !== "audit" && (
          <section className={styles.sectionPlaceholder}>
            {active === "safety" && <HeartPulse size={30} />}
            {active === "training" && <BookOpenCheck size={30} />}
            {active === "incidents" && <Siren size={30} />}
            <h2>{navItems.find((item) => item.key === active)?.label}</h2>
            <p>
              This workspace is now part of the module structure. The detailed workflow can plug into the same actions, evidence and audit-readiness model.
            </p>
          </section>
        )}

        <section className={styles.actionsPanel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.panelEyebrow}>Cross-module actions</span><h2>Open actions</h2></div>
            <label className={styles.searchBox}>
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions…" />
            </label>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Action</th><th>Area</th><th>Site</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {filteredActions.map((action) => (
                  <tr key={action.item}>
                    <td>{action.item}</td><td>{action.area}</td><td>{action.site}</td><td>{action.owner}</td><td>{action.due}</td>
                    <td><span className={action.status === "Overdue" ? styles.badgeOverdue : action.status === "Due soon" ? styles.badgeSoon : styles.badgeOpen}>{action.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      <OviCoreTour />
    </main>
  );
}
