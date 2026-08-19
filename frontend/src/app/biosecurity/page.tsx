"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  Clock3,
  MapPin,
  Network,
  QrCode,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const movementRows = [
  { person: "J. Smith", type: "Contractor", site: "Breeder Farm A", previous: "Broiler Farm C", gap: "3h 35m", risk: "High" },
  { person: "M. Jones", type: "Feed Driver", site: "Layer Farm 2704", previous: "Beresfield Mill", gap: "6h 10m", risk: "Review" },
  { person: "R. Brown", type: "Visitor", site: "Rearing Farm 12", previous: "No recent site", gap: "—", risk: "Clear" },
];

const capabilities = [
  { icon: QrCode, title: "QR site entry", text: "Give every farm or facility its own QR code for fast, mobile-first sign-in." },
  { icon: Users, title: "People tracker", text: "See who is on site now, where they have been and when they moved between properties." },
  { icon: ShieldCheck, title: "Biosecurity screening", text: "Ask site-specific questions and automatically assess entry risk before access is approved." },
  { icon: Route, title: "Movement history", text: "Build a searchable movement trail across farms, sheds, mills and operational sites." },
  { icon: AlertTriangle, title: "Risk alerts", text: "Flag risky site sequences, short stand-down periods and policy breaches before entry." },
  { icon: Network, title: "Outbreak tracing", text: "Trace people and vehicle contacts quickly when a site or flock becomes a biosecurity concern." },
];

function riskClass(risk: string) {
  if (risk === "High") return "risk high";
  if (risk === "Review") return "risk review";
  return "risk clear";
}

export default function BiosecurityPreviewPage() {
  return (
    <main className="bio-shell">
      <div className="bio-glow bio-glow-one" />
      <div className="bio-glow bio-glow-two" />

      <section className="bio-wrap">
        <header className="topbar">
          <Link href="/home" className="back-button"><ArrowLeft size={16} /> Back to modules</Link>
          <div className="addon-pill"><Sparkles size={14} /> Paid add-on</div>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><ShieldCheck size={16} /> OviCore Biosecurity</div>
            <h1>Know <span>who is where</span> — before biosecurity becomes a problem.</h1>
            <p>
              Track people, vehicles and farm-to-farm movement across the OviCore Ecosystem. Screen entry risk, enforce site-order rules and keep a complete traceable movement history.
            </p>

            <div className="hero-actions">
              <a href="#preview" className="primary-action">Explore the module <ArrowRight size={17} /></a>
              <div className="preview-note"><CheckCircle2 size={16} /> Preview page — module can be enabled per company</div>
            </div>

            <div className="hero-stats">
              <div><strong>38</strong><span>People on sites now</span></div>
              <div><strong>3</strong><span>High-risk movements</span></div>
              <div><strong>97.4%</strong><span>Biosecurity compliance</span></div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Biosecurity people tracker preview">
            <div className="visual-topline">
              <div><span className="live-dot" /> Live movement intelligence</div>
              <span>Today · 14:32</span>
            </div>

            <div className="alert-card">
              <div className="alert-icon"><AlertTriangle size={20} /></div>
              <div>
                <span className="alert-label">HIGH BIOSECURITY RISK</span>
                <h3>Entry requires approval</h3>
                <p>Recent poultry-site visit detected 3h 35m ago.</p>
              </div>
              <span className="hold-pill">ON HOLD</span>
            </div>

            <div className="route-card">
              <div className="route-node">
                <div className="node-icon"><MapPin size={17} /></div>
                <div><strong>Broiler Farm C</strong><span>Departed 10:57</span></div>
              </div>
              <div className="route-line"><span>3h 35m</span></div>
              <div className="route-node active">
                <div className="node-icon"><ShieldCheck size={17} /></div>
                <div><strong>Breeder Farm A</strong><span>Entry requested</span></div>
              </div>
            </div>

            <div className="mini-grid">
              <div className="mini-card"><Users size={18} /><strong>12</strong><span>Current visitors</span></div>
              <div className="mini-card"><Car size={18} /><strong>7</strong><span>Vehicles logged</span></div>
              <div className="mini-card"><Clock3 size={18} /><strong>2</strong><span>Awaiting approval</span></div>
            </div>
          </div>
        </section>

        <section className="capabilities" id="preview">
          <div className="section-heading">
            <div>
              <span>Module capability</span>
              <h2>More than a digital visitor book.</h2>
            </div>
            <p>Designed to connect visitor management, movement intelligence and disease traceability in one place.</p>
          </div>

          <div className="capability-grid">
            {capabilities.map(({ icon: Icon, title, text }) => (
              <article className="cap-card" key={title}>
                <div className="cap-icon"><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-preview">
          <div className="dash-header">
            <div>
              <span>Live People Tracker</span>
              <h2>Movement risk across your network</h2>
            </div>
            <div className="search-chip"><Search size={15} /> Search people or sites</div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Person</th><th>Type</th><th>Current site</th><th>Previous site</th><th>Time gap</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {movementRows.map((row) => (
                  <tr key={row.person}>
                    <td><strong>{row.person}</strong></td>
                    <td>{row.type}</td>
                    <td>{row.site}</td>
                    <td>{row.previous}</td>
                    <td>{row.gap}</td>
                    <td><span className={riskClass(row.risk)}>{row.risk}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="trace-section">
          <div className="trace-copy">
            <span className="section-kicker">Outbreak response</span>
            <h2>Turn movement data into instant contact tracing.</h2>
            <p>
              If a farm becomes a biosecurity concern, OviCore can identify who entered, where they went next and which sites may require immediate review.
            </p>
            <div className="trace-points">
              <span><CheckCircle2 size={16} /> Searchable person history</span>
              <span><CheckCircle2 size={16} /> Vehicle movement records</span>
              <span><CheckCircle2 size={16} /> Site-to-site exposure paths</span>
              <span><CheckCircle2 size={16} /> Approval and override audit trail</span>
            </div>
          </div>

          <div className="trace-visual">
            <div className="trace-title"><Activity size={17} /> Exposure network</div>
            <div className="trace-network">
              <div className="trace-centre">Farm 2703<span>Risk site</span></div>
              <div className="trace-branch b1">Farm 2704<span>4 people</span></div>
              <div className="trace-branch b2">Feed Mill<span>2 drivers</span></div>
              <div className="trace-branch b3">Farm 2711<span>1 contractor</span></div>
              <div className="trace-branch b4">Processing<span>3 people</span></div>
            </div>
          </div>
        </section>

        <footer className="preview-footer">
          <div>
            <span>Paid add-on</span>
            <h2>Biosecurity & People Tracker</h2>
            <p>Available as an optional module within the OviCore Ecosystem.</p>
          </div>
          <div className="footer-badge"><ShieldCheck size={18} /> Preview</div>
        </footer>
      </section>

      <style jsx>{`
        :global(body) { background: #07111f; }
        * { box-sizing: border-box; }
        .bio-shell { min-height: 100vh; position: relative; overflow: hidden; background: radial-gradient(circle at 15% 0%, rgba(59,130,246,.16), transparent 26%), radial-gradient(circle at 90% 10%, rgba(99,102,241,.17), transparent 28%), linear-gradient(180deg,#07111f 0%,#0a1322 46%,#0d1725 100%); color:#eaf0f7; }
        .bio-glow { position:absolute; width:460px; height:460px; border-radius:999px; filter:blur(100px); opacity:.16; pointer-events:none; }
        .bio-glow-one { background:#4f46e5; right:-120px; top:210px; }
        .bio-glow-two { background:#0ea5e9; left:-180px; top:760px; }
        .bio-wrap { width:min(1540px, calc(100% - 40px)); margin:0 auto; padding:18px 0 30px; position:relative; z-index:1; }
        .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .back-button { display:inline-flex; align-items:center; gap:7px; color:#dbeafe; text-decoration:none; font-weight:900; font-size:13px; padding:8px 11px; border-radius:10px; border:1px solid rgba(148,163,184,.18); background:rgba(15,23,42,.72); box-shadow:inset 0 1px 0 rgba(255,255,255,.03); transition:.18s ease; }
        .back-button:hover { color:#fff; border-color:rgba(129,140,248,.42); background:rgba(30,41,59,.9); transform:translateY(-1px); }
        .addon-pill,.hero-kicker,.preview-note,.footer-badge { display:inline-flex; align-items:center; gap:7px; }
        .addon-pill { border:1px solid rgba(129,140,248,.28); background:rgba(79,70,229,.12); color:#c7d2fe; padding:7px 11px; border-radius:999px; font-size:11px; font-weight:950; letter-spacing:.04em; text-transform:uppercase; }
        .hero { display:grid; grid-template-columns:minmax(0,1.08fr) minmax(500px,.92fr); gap:42px; align-items:center; min-height:440px; padding:16px 0 28px; }
        .hero-kicker { color:#93c5fd; font-size:12px; font-weight:950; text-transform:uppercase; letter-spacing:.12em; margin-bottom:12px; }
        .hero h1 { margin:0; max-width:820px; font-size:clamp(44px,4.6vw,72px); line-height:.96; letter-spacing:-.055em; color:white; font-weight:1000; }
        .hero h1 span { background:linear-gradient(90deg,#a5b4fc,#7dd3fc); -webkit-background-clip:text; color:transparent; }
        .hero-copy > p { max-width:760px; color:#aebdce; font-size:16px; line-height:1.5; margin:16px 0 0; font-weight:650; }
        .hero-actions { display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-top:12px; }
        .primary-action { display:inline-flex; align-items:center; gap:9px; text-decoration:none; background:linear-gradient(135deg,#4f46e5,#2563eb 60%,#0ea5e9); color:white; padding:12px 16px; border-radius:10px; font-weight:950; box-shadow:0 14px 34px rgba(37,99,235,.28); }
        .preview-note { color:#9fb0c8; font-size:13px; font-weight:800; }
        .hero-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:20px; max-width:760px; }
        .hero-stats div { border:1px solid rgba(148,163,184,.14); background:rgba(15,23,42,.5); border-radius:14px; padding:12px 14px; }
        .hero-stats strong { display:block; font-size:24px; color:white; letter-spacing:-.04em; }
        .hero-stats span { display:block; margin-top:4px; color:#8294aa; font-size:12px; font-weight:800; }
        .hero-visual { border:1px solid rgba(148,163,184,.16); border-radius:20px; padding:15px; background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(9,18,32,.88)); box-shadow:0 30px 80px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.04); }
        .visual-topline { display:flex; justify-content:space-between; align-items:center; color:#7f91a8; font-size:11px; font-weight:850; margin-bottom:10px; }
        .visual-topline > div { display:flex; align-items:center; gap:7px; color:#cbd5e1; }
        .live-dot { width:7px; height:7px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 5px rgba(34,197,94,.08); }
        .alert-card { display:grid; grid-template-columns:auto 1fr auto; gap:13px; align-items:center; border:1px solid rgba(248,113,113,.24); background:linear-gradient(135deg,rgba(127,29,29,.20),rgba(30,41,59,.60)); border-radius:15px; padding:13px; }
        .alert-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; background:rgba(239,68,68,.14); color:#f87171; }
        .alert-label { color:#fca5a5; font-size:10px; font-weight:1000; letter-spacing:.12em; }
        .alert-card h3 { margin:3px 0 2px; color:white; font-size:16px; }
        .alert-card p { margin:0; color:#9eafc2; font-size:12px; }
        .hold-pill { align-self:start; border:1px solid rgba(248,113,113,.25); background:rgba(127,29,29,.24); color:#fecaca; padding:6px 8px; border-radius:999px; font-size:10px; font-weight:1000; }
        .route-card { margin-top:10px; border:1px solid rgba(148,163,184,.12); background:rgba(15,23,42,.48); border-radius:15px; padding:13px; }
        .route-node { display:flex; gap:11px; align-items:center; }
        .route-node strong,.route-node span { display:block; }
        .route-node strong { font-size:14px; color:#e2e8f0; }
        .route-node span { margin-top:2px; color:#788ba3; font-size:10px; }
        .route-node.active strong { color:#c7d2fe; }
        .node-icon { width:31px; height:31px; display:grid; place-items:center; border-radius:10px; background:#172033; color:#7dd3fc; }
        .route-node.active .node-icon { background:rgba(79,70,229,.18); color:#a5b4fc; }
        .route-line { height:34px; width:2px; background:linear-gradient(#334155,#4f46e5); margin-left:16px; position:relative; }
        .route-line span { position:absolute; left:14px; top:9px; white-space:nowrap; font-size:9px; font-weight:900; color:#71849c; }
        .mini-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:10px; }
        .mini-card { border:1px solid rgba(148,163,184,.11); background:rgba(255,255,255,.025); border-radius:12px; padding:10px 12px; color:#8ea1b8; }
        .mini-card svg { color:#818cf8; }
        .mini-card strong { display:block; color:white; font-size:20px; margin-top:5px; }
        .mini-card span { font-size:9px; font-weight:800; }
        .capabilities,.dashboard-preview,.trace-section,.preview-footer { margin-top:12px; border:1px solid rgba(148,163,184,.12); background:rgba(9,18,32,.72); border-radius:20px; }
        .capabilities { padding:20px 22px; }
        .section-heading,.dash-header { display:flex; justify-content:space-between; gap:28px; align-items:end; }
        .section-heading span,.dash-header span,.section-kicker { color:#818cf8; font-size:10px; font-weight:1000; letter-spacing:.11em; text-transform:uppercase; }
        .section-heading h2,.dash-header h2,.trace-copy h2,.preview-footer h2 { margin:5px 0 0; color:white; font-size:25px; letter-spacing:-.035em; }
        .section-heading p { max-width:520px; margin:0; color:#8799ae; line-height:1.55; font-size:13px; }
        .capability-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:11px; margin-top:15px; }
        .cap-card { border:1px solid rgba(148,163,184,.11); background:linear-gradient(180deg,rgba(19,30,49,.72),rgba(13,22,37,.62)); border-radius:14px; padding:14px 15px; transition:.2s ease; }
        .cap-card:hover { transform:translateY(-2px); border-color:rgba(99,102,241,.36); }
        .cap-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background:linear-gradient(135deg,rgba(79,70,229,.2),rgba(14,165,233,.12)); color:#a5b4fc; }
        .cap-card h3 { color:white; margin:10px 0 5px; font-size:15px; }
        .cap-card p { color:#8193a8; margin:0; line-height:1.5; font-size:12px; }
        .dashboard-preview { padding:18px 22px; }
        .search-chip { display:flex; gap:7px; align-items:center; border:1px solid rgba(148,163,184,.12); background:#0d1727; color:#70839b; border-radius:10px; padding:8px 10px; font-size:11px; font-weight:800; }
        .table-wrap { overflow:auto; margin-top:12px; }
        table { width:100%; border-collapse:collapse; min-width:760px; }
        th { color:#667b95; text-transform:uppercase; letter-spacing:.08em; font-size:10px; text-align:left; padding:9px 11px; border-bottom:1px solid rgba(148,163,184,.1); }
        td { color:#9fb0c3; font-size:12px; padding:11px 11px; border-bottom:1px solid rgba(148,163,184,.08); }
        td strong { color:#e2e8f0; }
        .risk { display:inline-flex; min-width:56px; justify-content:center; padding:5px 8px; border-radius:999px; font-size:10px; font-weight:1000; }
        .risk.high { color:#fecaca; background:rgba(127,29,29,.28); border:1px solid rgba(248,113,113,.18); }
        .risk.review { color:#fde68a; background:rgba(120,53,15,.26); border:1px solid rgba(251,191,36,.16); }
        .risk.clear { color:#bbf7d0; background:rgba(20,83,45,.28); border:1px solid rgba(74,222,128,.16); }
        .trace-section { display:grid; grid-template-columns:1fr 1fr; overflow:hidden; }
        .trace-copy { padding:24px 26px; }
        .trace-copy > p { color:#8799ae; max-width:590px; line-height:1.6; font-size:14px; }
        .trace-points { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; margin-top:16px; }
        .trace-points span { display:flex; align-items:center; gap:8px; color:#a7b5c7; font-size:12px; font-weight:800; }
        .trace-points svg { color:#60a5fa; }
        .trace-visual { border-left:1px solid rgba(148,163,184,.1); min-height:285px; padding:18px; background:radial-gradient(circle at center,rgba(79,70,229,.12),transparent 46%); }
        .trace-title { display:flex; gap:7px; align-items:center; color:#93a4b8; font-size:10px; font-weight:900; }
        .trace-network { height:220px; position:relative; margin-top:12px; }
        .trace-centre,.trace-branch { position:absolute; border-radius:14px; text-align:center; border:1px solid rgba(148,163,184,.16); background:#111d2f; color:#dce6f2; font-size:12px; font-weight:950; padding:10px 12px; box-shadow:0 10px 28px rgba(0,0,0,.2); }
        .trace-centre { left:50%; top:50%; transform:translate(-50%,-50%); background:linear-gradient(135deg,rgba(127,29,29,.48),rgba(49,19,27,.64)); border-color:rgba(248,113,113,.28); }
        .trace-centre span,.trace-branch span { display:block; font-size:9px; margin-top:3px; color:#7d90a7; }
        .trace-centre span { color:#fca5a5; }
        .trace-branch::after { content:""; position:absolute; height:1px; background:linear-gradient(90deg,rgba(99,102,241,.15),rgba(99,102,241,.6)); transform-origin:left center; }
        .b1 { left:4%; top:18%; }.b2 { right:5%; top:18%; }.b3 { left:7%; bottom:13%; }.b4 { right:4%; bottom:12%; }
        .preview-footer { padding:18px 22px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,rgba(49,46,129,.24),rgba(8,47,73,.14)); }
        .preview-footer span { color:#a5b4fc; font-size:9px; text-transform:uppercase; font-weight:1000; letter-spacing:.1em; }
        .preview-footer h2 { font-size:20px; }
        .preview-footer p { color:#7f91a7; margin:5px 0 0; font-size:12px; }
        .footer-badge { padding:10px 12px; border-radius:10px; background:rgba(79,70,229,.12); border:1px solid rgba(129,140,248,.2); color:#c7d2fe; font-size:11px; font-weight:950; }
        @media (min-width: 1280px) {
          .hero-copy { padding-right:12px; }
          .hero-visual { max-width:650px; justify-self:end; width:100%; }
          .cap-card { min-height:112px; }
          .dashboard-preview { margin-top:16px; }
          .trace-section { margin-top:16px; }
          .preview-footer { margin-top:16px; }
        }
        @media (max-width: 1080px) { .hero { grid-template-columns:1fr; }.hero-visual { max-width:760px; }.capability-grid { grid-template-columns:repeat(2,1fr); }.trace-section { grid-template-columns:1fr; }.trace-visual { border-left:0; border-top:1px solid rgba(148,163,184,.1); } }
        @media (max-width: 720px) { .bio-wrap { width:min(100% - 24px, 1440px); }.hero { padding-top:20px; gap:32px; min-height:auto; }.hero h1 { font-size:44px; }.hero-copy > p { font-size:15px; }.hero-stats,.mini-grid,.capability-grid,.trace-points { grid-template-columns:1fr; }.section-heading,.dash-header { align-items:flex-start; flex-direction:column; }.capabilities,.dashboard-preview { padding:18px; }.trace-copy { padding:22px; }.preview-footer { align-items:flex-start; gap:18px; flex-direction:column; }.alert-card { grid-template-columns:auto 1fr; }.hold-pill { grid-column:2; justify-self:start; } }
      `}</style>
    </main>
  );
}
