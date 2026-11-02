"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";
import { reconcileStock, planReplenishment, type FeedMovement, type FeedMovementType } from "@/components/feed-operations/stockEngine";

type FeedRow = { code: string; name: string; actual: number; standard: number; medicated?: boolean };
const FEEDS: FeedRow[] = [
  { code: "Starter", name: "Starter", actual: 19, standard: 20 },
  { code: "Grower", name: "Grower", actual: 44, standard: 42 },
  { code: "Developer", name: "Developer", actual: 68, standard: 70 },
  { code: "Pre-Lay", name: "Pre-Lay", actual: 35, standard: 36 },
  { code: "Layer 1", name: "Layer 1", actual: 238, standard: 243 },
  { code: "L1 Amoxy", name: "Layer 1 Medicated – Amoxy", actual: 14, standard: 12, medicated: true },
  { code: "Layer 2", name: "Layer 2", actual: 182, standard: 190 },
  { code: "L2 CTC", name: "Layer 2 Medicated – CTC", actual: 11, standard: 10, medicated: true },
  { code: "Layer 3", name: "Layer 3", actual: 167, standard: 162 },
  { code: "L3 Flub", name: "Layer 3 Medicated – Flubenol", actual: 8, standard: 7, medicated: true },
  { code: "Layer 4", name: "Layer 4", actual: 140, standard: 145 },
];
const nf = (v: number, digits = 1) => v.toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const money = (v: number) => v.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function FeedChart({ rows }: { rows: FeedRow[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.actual, r.standard]), 1);
  const ceiling = Math.ceil(max / 50) * 50;
  const width = Math.max(920, rows.length * 97);
  const height = 285, plotTop = 16, plotBottom = 212, left = 47, right = 12;
  const plotW = width - left - right, plotH = plotBottom - plotTop;
  const groupW = plotW / rows.length, barW = Math.min(25, groupW * 0.27);
  const y = (n: number) => plotBottom - (n / ceiling) * plotH;
  return (
    <div className={styles.chartScroll} role="region" aria-label="Grouped bar chart of actual versus standard feed tonnes by ration" tabIndex={0}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Actual versus standard lifecycle feed consumption. Medicated rations are distinct categories.">
        {[0, 1, 2, 3, 4].map((i) => {
          const value = ceiling * i / 4, yy = y(value);
          return <g key={i}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#dbe9e3" strokeDasharray={i === 0 ? undefined : "3 4"} /><text x={left - 9} y={yy + 4} textAnchor="end" fill="#60877b" fontSize="11">{value}</text></g>;
        })}
        <text x="9" y="10" fontSize="10" fontWeight="700" fill="#60877b">t</text>
        {rows.map((r, i) => {
          const mid = left + (i + .5) * groupW;
          const ax = mid - barW - 2, sx = mid + 2;
          return <g key={r.code}>
            {r.medicated && <rect x={left + i * groupW + 2} y={plotTop} width={groupW - 4} height={plotH + 6} fill="#fff5e6" rx="5" />}
            <rect x={ax} y={y(r.actual)} width={barW} height={Math.max(0, plotBottom - y(r.actual))} fill="#067e68" rx="3"><title>{`${r.name}: actual ${nf(r.actual)} t`}</title></rect>
            <rect x={sx} y={y(r.standard)} width={barW} height={Math.max(0, plotBottom - y(r.standard))} fill="#95b8ad" rx="3"><title>{`${r.name}: standard ${nf(r.standard)} t`}</title></rect>
            <text x={mid} y={plotBottom + 18} textAnchor="middle" fontSize="10" fill="#255748" fontWeight={r.medicated ? 700 : 500}>{r.code}</text>
            {r.medicated && <text x={mid} y={plotBottom + 32} textAnchor="middle" fontSize="9" fill="#a86c1b">MEDICATED</text>}
          </g>;
        })}
      </svg>
    </div>
  );
}

export default function FeedOrderingPage() {
  const [farm, setFarm] = useState("Demo Farm A");
  const [shed, setShed] = useState("Shed 1 · Flock L-001");
  const [mill, setMill] = useState("Demo Mill · Beresfield");
  const [ration, setRation] = useState("Layer 1");
  const [quantity, setQuantity] = useState("24");
  const [deliveryDate, setDeliveryDate] = useState("2026-11-06");
  const [leadDays, setLeadDays] = useState(4);
  const [bufferDays, setBufferDays] = useState(2);
  const [dailyUse, setDailyUse] = useState(2.02);
  const [verifiedStock, setVerifiedStock] = useState(18.4);
  const [movementValues, setMovementValues] = useState({delivery:32, transfer_in:10, transfer_out:0, disposal:1.3, consumption:39.5, adjustment:0});
  const [targetDays, setTargetDays] = useState(14);
  const [confirmedInbound, setConfirmedInbound] = useState(0);
  const [price, setPrice] = useState(550);
  const [showMedicated, setShowMedicated] = useState(true);
  const [activeTab, setActiveTab] = useState<"tonnes" | "cost">("tonnes");

  // Demonstration inputs. In Stage 2, these will be replaced with authenticated,
  // company-scoped stock snapshots and movements from PostgreSQL.
  const snapshot = {closedThrough:"2026-11-01", tonnes:verifiedStock};
  const movementEntries: FeedMovement[] = (Object.entries(movementValues) as [FeedMovementType,number][])
    .map(([type,tonnes])=>({id:`DEMO-${type}`,movementDate:"2026-11-02",type,tonnes}));
  const stockResult = reconcileStock(snapshot,movementEntries,"2026-11-02");
  const opening = verifiedStock;
  const delivered = movementValues.delivery;
  const transferredIn = movementValues.transfer_in;
  const transferredOut = movementValues.transfer_out;
  const disposed = movementValues.disposal;
  const consumed = movementValues.consumption;
  const currentStock = stockResult.tonnes;
  const forecast = planReplenishment({
    stockTonnes:Math.max(0,currentStock),dailyConsumptionTonnes:dailyUse,
    millLeadDays:leadDays,safetyBufferDays:bufferDays,targetCoverDays:targetDays,
    asOf:"2026-11-02",
    confirmedDeliveries: confirmedInbound > 0 ? [{id:"DEMO-INBOUND",deliveryDate:"2026-11-04",tonnesOutstanding:confirmedInbound,confirmed:true}]:[],
  });
  const cover = forecast.coverDays;
  const orderIn = forecast.orderInDays;
  const totalActual = FEEDS.reduce((sum, item) => sum + item.actual, 0);
  const totalStandard = FEEDS.reduce((sum, item) => sum + item.standard, 0);
  const totalVariance = totalActual - totalStandard;
  const visibleRows = useMemo(() => FEEDS.filter((f) => showMedicated || !f.medicated), [showMedicated]);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const selected = FEEDS.find((r) => r.code === selectedRow);
  return (
    <main className={styles.root}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <div><p className={styles.eyebrow}>OVICORE ECOSYSTEM / FEED OPERATIONS</p><h1>Feed Ordering & Forecasting</h1><p>Stock intelligence, flock consumption and ERP-ready purchase requisitions</p></div>
          <div className={styles.heroSide}><span className={styles.demoBadge}>DEMONSTRATION MODE</span><a className={styles.heroLink} href="#requisition">+ Create Requisition</a></div>
        </header>
        <div className={styles.notice}><strong>Placeholder dashboard:</strong> All farms, flocks, feed quantities, order numbers and dates shown here are illustrative. No requisitions are submitted or saved.</div>

        <section className={styles.filterbar} aria-label="Demonstration filters">
          <label>Farm<select value={farm} onChange={(e) => setFarm(e.target.value)}><option>Demo Farm A</option><option>Demo Farm B</option></select></label>
          <label>Shed / Flock<select value={shed} onChange={(e) => setShed(e.target.value)}><option>Shed 1 · Flock L-001</option><option>Shed 2 · Flock L-002</option></select></label>
          <label>Supplying Mill<select value={mill} onChange={(e) => setMill(e.target.value)}><option>Demo Mill · Beresfield</option><option>Demo Mill · Hanwood</option></select></label>
          <label>As of <input type="date" defaultValue="2026-11-02" /></label>
        </section>

        <section className={styles.kpis} aria-label="Feed stock and performance indicators">
          {[
            ["Last week closing", `${nf(opening)} t`, "Verified stock example"],
            ["Current stock", `${nf(currentStock)} t`, "Movement-based"],
            ["Daily feed rate", `${nf(dailyUse, 2)} t`, "Editable forecast input"],
            ["Days of cover", cover === null ? "—" : nf(cover), "At current feed rate"],
            ["Order in", orderIn === null ? "—" : `${nf(orderIn)} days`, "Before lead time + buffer"],
            ["Lifecycle variance", `${totalVariance > 0 ? "+" : ""}${nf(totalVariance)} t`, "Actual minus standard"],
          ].map(([label, value, desc]) => <article className={styles.kpi} key={label}><span>{label}</span><strong>{value}</strong><small>{desc}</small></article>)}
        </section>

        <div className={styles.twoCols}>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}><div><span className={styles.overline}>STOCK RECONCILIATION</span><h2>Feed Stock & Movement</h2></div><span className={styles.tag}>Sample: week ending 01 Nov 2026</span></div>
            <p className={styles.help}><strong>Editable scenario:</strong> Enter the last verified closing stock and movements since that closing date. These inputs are not saved or submitted.</p>
            <div className={styles.stockEditGrid}>
              <label>Verified closing (t)<input type="number" min="0" step="0.1" value={verifiedStock} onChange={e=>setVerifiedStock(Math.max(0,Number(e.target.value)||0))}/></label>
              {(Object.keys(movementValues) as FeedMovementType[]).map(type=><label key={type}>{({delivery:"Delivered",transfer_in:"Transfers in",transfer_out:"Transfers out",disposal:"Disposed",consumption:"Bird consumption",adjustment:"Signed adjustment"} as Record<FeedMovementType,string>)[type]} (t)<input type="number" step="0.1" min={type==="adjustment"?undefined:"0"} value={movementValues[type]} onChange={e=>setMovementValues(prev=>({...prev,[type]:type==="adjustment"?(Number(e.target.value)||0):Math.max(0,Number(e.target.value)||0)}))}/></label>)}
            </div>
            <div className={styles.movementTable}>
              {[["Previous week closing stock",opening],["Feed delivered", delivered],["Transfers in",transferredIn],["Transfers out",-transferredOut],["Disposed / adjustments out",-disposed],["Feed consumed by birds",-consumed],["Signed stock adjustment",movementValues.adjustment]].map(([label,v]) => <div className={styles.movementRow} key={String(label)}><span>{label}</span><strong>{Number(v) > 0 && label !== "Previous week closing stock" ? "+" : ""}{nf(Number(v))} t</strong></div>)}
              <div className={styles.movementTotal}><span>Calculated current stock</span><strong>{nf(currentStock)} t</strong></div>
            </div>
            <p className={styles.help}>Verified stock + post-close deliveries + transfers in − transfers out − disposals − bird consumption ± adjustments. {stockResult.negativeStockWarning ? "WARNING: negative calculated stock—investigate missing receipts or overstated consumption." : ""}</p>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}><div><span className={styles.overline}>FORWARD PLANNING</span><h2>Feed Cover & Replenishment</h2></div><span className={styles.tagAmber}>Order planning</span></div>
            <div className={styles.forecastInputs}>
              <label>Daily usage (t/day)<input type="number" min="0.01" step="0.01" value={dailyUse} onChange={e => setDailyUse(Math.max(0,Number(e.target.value) || 0))}/></label>
              <label>Mill lead time (days)<input type="number" min="0" max="60" value={leadDays} onChange={e=>setLeadDays(Math.max(0,Number(e.target.value)||0))}/></label>
              <label>Safety buffer (days)<input type="number" min="0" max="30" value={bufferDays} onChange={e=>setBufferDays(Math.max(0,Number(e.target.value)||0))}/></label>
              <label>Target cover (days)<input type="number" min="0" max="90" value={targetDays} onChange={e=>setTargetDays(Math.max(0,Number(e.target.value)||0))}/></label>
              <label>Confirmed incoming (t)<input type="number" min="0" step="0.1" value={confirmedInbound} onChange={e=>setConfirmedInbound(Math.max(0,Number(e.target.value)||0))}/></label>
            </div>
            <div className={styles.forecastResult}><div><span>Stock cover remaining</span><strong>{cover === null ? "—" : `${nf(cover)} days`}</strong></div><div><span>Recommended order timing</span><strong>{orderIn === null ? "Set feed rate" : orderIn <= 0 ? "Order now" : `Within ${nf(orderIn)} days`}</strong></div></div>
            <div className={styles.forecastResult}><div><span>Suggested replenishment to target</span><strong>{forecast.targetOrderTonnes===null?"—":`${nf(forecast.targetOrderTonnes)} t`}</strong></div><div><span>Confirmed inbound (scenario)</span><strong>{nf(forecast.confirmedIncomingTonnes)} t</strong></div></div><p className={styles.help}>Scenario only. Current cover excludes deliveries not yet received; the target quantity deducts confirmed incoming tonnes. The order-by calculation is conservative and does not model delivery timing or changing flock consumption yet.</p>
          </section>
        </div>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}><div><span className={styles.overline}>LIFECYCLE INTELLIGENCE</span><h2>Feed Consumption vs Standard</h2><p className={styles.sectionSub}>Grouped bars by ration · All lifecycle feed types, including medicated</p></div><div className={styles.legend}><span><i className={styles.actualLegend}/>Actual</span><span><i className={styles.standardLegend}/>Standard</span></div></div>
          <div className={styles.chartTools}><label className={styles.toggle}><input type="checkbox" checked={showMedicated} onChange={e=>setShowMedicated(e.target.checked)}/> Include medicated rations</label><div className={styles.pillGroup}><button type="button" aria-pressed={activeTab === "tonnes"} onClick={()=>setActiveTab("tonnes")}>Tonnes</button><button type="button" aria-pressed={activeTab === "cost"} onClick={()=>setActiveTab("cost")}>Variance $</button></div><label>Feed price ($/t)<input className={styles.priceInput} type="number" min="0" value={price} onChange={e=>setPrice(Math.max(0,Number(e.target.value)||0))}/></label></div>
          {activeTab === "tonnes" ? <FeedChart rows={visibleRows}/> : <div className={styles.costChart} role="list" aria-label="Feed cost variances by ration">{visibleRows.map(r => <div key={r.code} className={styles.costRow} role="listitem"><span>{r.code}</span><div className={styles.costTrack}><div className={r.actual > r.standard ? styles.costAdverse : styles.costFavourable} style={{width:`${Math.min(100, Math.abs(r.actual-r.standard)*14)}%`}}/></div><strong>{money((r.actual-r.standard)*price)}</strong></div>)}</div>}
          <div className={styles.summaryStrip}><div><span>Actual feed</span><strong>{nf(totalActual)} t</strong></div><div><span>Standard feed</span><strong>{nf(totalStandard)} t</strong></div><div><span>Variance</span><strong className={totalVariance <= 0 ? styles.favourable : styles.adverse}>{totalVariance>0?"+":""}{nf(totalVariance)} t</strong></div><div><span>Variance at {money(price)}/t</span><strong className={totalVariance <= 0 ? styles.favourable : styles.adverse}>{money(totalVariance*price)}</strong></div></div>
          <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Feed type / ration</th><th>Category</th><th>Actual (t)</th><th>Standard (t)</th><th>Variance (t)</th><th>Variance (%)</th><th>Cost variance</th></tr></thead><tbody>{visibleRows.map(r => <tr key={r.code} className={selectedRow===r.code?styles.selectedRow:undefined} onClick={()=>setSelectedRow(selectedRow === r.code ? null : r.code)}><td><strong>{r.name}</strong></td><td>{r.medicated?<span className={styles.medTag}>Medicated</span>:"Standard"}</td><td>{nf(r.actual)}</td><td>{nf(r.standard)}</td><td className={r.actual>r.standard?styles.adverse:styles.favourable}>{r.actual>r.standard?"+":""}{nf(r.actual-r.standard)}</td><td>{nf((r.actual-r.standard)/r.standard*100)}%</td><td>{money((r.actual-r.standard)*price)}</td></tr>)}</tbody></table></div>
          {selected && <p className={styles.selectionNote}>Selected: <strong>{selected.name}</strong> · {nf(selected.actual)} t actual against {nf(selected.standard)} t illustrative standard.</p>}
          <p className={styles.help}><strong>Calculation rule for the real system:</strong> standards must be age-specific and bird-population-adjusted for the actual days each ration was fed. Medicated feed uses the applicable base-ration consumption benchmark for those days; missing standard mappings must show “unavailable”, not zero.</p>
        </section>

        <div className={styles.twoColsBottom}>
          <section className={styles.panel} id="requisition">
            <div className={styles.sectionHeader}><div><span className={styles.overline}>PURCHASE REQUISITION</span><h2>Create Feed Requisition</h2></div><span className={styles.tag}>ERP-independent</span></div>
            <form className={styles.reqForm} onSubmit={(e)=>e.preventDefault()}>
              <label>Farm<select value={farm} onChange={e=>setFarm(e.target.value)}><option>Demo Farm A</option><option>Demo Farm B</option></select></label>
              <label>Shed / flock<select value={shed} onChange={e=>setShed(e.target.value)}><option>Shed 1 · Flock L-001</option><option>Shed 2 · Flock L-002</option></select></label>
              <label>Supplying mill<select value={mill} onChange={e=>setMill(e.target.value)}><option>Demo Mill · Beresfield</option><option>Demo Mill · Hanwood</option></select></label>
              <label>Ration<select value={ration} onChange={e=>setRation(e.target.value)}>{FEEDS.map(r=><option key={r.code}>{r.name}</option>)}</select></label>
              <label>Quantity (t)<input type="number" min="0.1" step="0.1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
              <label>Required delivery<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></label>
              <label className={styles.full}>Special instructions<textarea rows={2} placeholder="Delivery access, preferred time, or mill notes"/></label>
              <div className={styles.formFooter}><span>OviCore requisition and ERP PO numbers will be assigned when the backend workflow is implemented.</span><button type="button" disabled title="Placeholder only — database submission is not available">Save Requisition (coming soon)</button></div>
            </form>
          </section>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}><div><span className={styles.overline}>PURCHASING PIPELINE</span><h2>Recent & Outstanding Requisitions</h2></div><span className={styles.tag}>Demo records</span></div>
            <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Requisition</th><th>Shed</th><th>Tonnes</th><th>Delivery</th><th>Status</th><th>ERP PO</th></tr></thead><tbody>
              <tr><td>FPR-DEMO-001</td><td>Shed 1</td><td>24.0</td><td>06 Nov</td><td><span className={styles.statusPending}>Awaiting ERP</span></td><td>—</td></tr>
              <tr><td>FPR-DEMO-002</td><td>Shed 2</td><td>12.0</td><td>07 Nov</td><td><span className={styles.statusOk}>PO Confirmed</span></td><td>DEMO-PO-01</td></tr>
              <tr><td>FPR-DEMO-003</td><td>Shed 1</td><td>18.0</td><td>03 Nov</td><td><span className={styles.statusOk}>Part Received</span></td><td>DEMO-PO-02</td></tr>
            </tbody></table></div>
            <div className={styles.erpNote}><strong>ERP-agnostic by design</strong><p>OviCore requisition → purchasing approval → ERP purchase order → receiving and reconciliation. Future adapters may support Business Central, SAP, Sage and other providers.</p></div>
          </section>
        </div>
        <footer className={styles.footer}>OVICORE · Intelligence That Drives Performance · Placeholder UI — no live purchasing actions</footer>
      </div>
    </main>
  );
}
