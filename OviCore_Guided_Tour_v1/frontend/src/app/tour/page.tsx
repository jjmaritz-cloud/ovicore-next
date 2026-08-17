"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Drumstick,
  Network,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const tours = [
  {
    title: "OviCore Overview",
    description:
      "A short guided walk through the module selector, Broilers, Intelligence, Planning and Audit Readiness.",
    duration: "5–10 min",
    icon: Compass,
    href: "/home?tour=overview&step=0",
    available: true,
  },
  {
    title: "Broiler Manager Tour",
    description:
      "Placements, Daily Data Entry, performance pressure, Intelligence and processing readiness.",
    duration: "Coming soon",
    icon: Drumstick,
    available: false,
  },
  {
    title: "Planning Tour",
    description:
      "See how OviCore fills future demand using supply, capacity, placements and risk.",
    duration: "Coming soon",
    icon: Network,
    available: false,
  },
  {
    title: "Safety & Compliance Tour",
    description:
      "Safety, training, incidents, evidence, corrective actions and continuous audit readiness.",
    duration: "Coming soon",
    icon: ShieldCheck,
    available: false,
  },
];

export default function GuidedTourPage() {
  const [completed, setCompleted] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setJustCompleted(params.get("complete") === "1");
    setCompleted(
      window.localStorage.getItem("ovicore_guided_tour_overview_complete") ===
        "true",
    );
  }, []);

  return (
    <main className="tour-shell">
      <section className="tour-wrap">
        <header className="tour-hero">
          <div className="tour-hero-icon">
            <Compass size={27} />
          </div>

          <div>
            <span>OviCore Guided Tour</span>
            <h1>See how the pieces connect</h1>
            <p>
              Take a short guided walk through the platform before exploring
              OviCore on your own.
            </p>
          </div>

          <Link href="/home" className="tour-home-link">
            Back to modules
          </Link>
        </header>

        {justCompleted ? (
          <section className="tour-complete">
            <CheckCircle2 size={24} />
            <div>
              <span>Tour complete</span>
              <h2>Thanks for exploring OviCore.</h2>
              <p>
                The most useful feedback is what felt valuable, what was
                confusing, and what you expected OviCore to do that you could
                not find.
              </p>
            </div>
          </section>
        ) : null}

        <section className="tour-intro-grid">
          <article>
            <Sparkles size={19} />
            <strong>Follow the story</strong>
            <p>Each step explains why the screen exists, not just where to click.</p>
          </article>
          <article>
            <ClipboardCheck size={19} />
            <strong>Look for exceptions</strong>
            <p>OviCore is designed to surface the things that need management attention.</p>
          </article>
          <article>
            <PlayCircle size={19} />
            <strong>Explore afterwards</strong>
            <p>The tour never changes data. Finish it, then click around normally.</p>
          </article>
        </section>

        <div className="tour-section-head">
          <div>
            <span>Available tours</span>
            <h2>Choose a walkthrough</h2>
          </div>
          {completed ? <em>Overview completed ✓</em> : null}
        </div>

        <section className="tour-grid">
          {tours.map(({ title, description, duration, icon: Icon, href, available }) => (
            <article
              className={`tour-card ${available ? "" : "tour-card-disabled"}`}
              key={title}
            >
              <div className="tour-card-top">
                <span className="tour-card-icon">
                  <Icon size={20} />
                </span>
                <span className="tour-duration">{duration}</span>
              </div>

              <h3>{title}</h3>
              <p>{description}</p>

              {available && href ? (
                <Link href={href} className="tour-start">
                  {completed ? "Take tour again" : "Start guided tour"}
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <span className="tour-soon">In development</span>
              )}
            </article>
          ))}
        </section>

        <section className="tour-feedback" data-tour="tour-feedback">
          <div>
            <span>Feedback guide</span>
            <h2>Three things we would love you to notice</h2>
          </div>

          <div className="tour-feedback-grid">
            <article>
              <strong>1. What feels useful?</strong>
              <p>Which screen or idea would genuinely help you manage the business?</p>
            </article>
            <article>
              <strong>2. What feels confusing?</strong>
              <p>Where did you have to stop and work out what OviCore was trying to show?</p>
            </article>
            <article>
              <strong>3. What is missing?</strong>
              <p>What would you expect a platform like this to do that you could not find?</p>
            </article>
          </div>
        </section>
      </section>

      <style jsx>{`
        .tour-shell {
          min-height: 100vh;
          padding: 22px;
          background:
            radial-gradient(circle at 10% 5%, rgba(16, 185, 129, 0.11), transparent 28%),
            radial-gradient(circle at 90% 0%, rgba(14, 116, 144, 0.09), transparent 26%),
            #f3f8f6;
          color: #102a26;
        }

        .tour-wrap {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .tour-hero {
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          padding: 20px 22px;
          border-radius: 20px;
          color: white;
          background:
            radial-gradient(circle at 86% 10%, rgba(45, 212, 191, 0.28), transparent 28%),
            linear-gradient(135deg, #052e26, #065f46 62%, #0f766e);
          box-shadow: 0 18px 45px rgba(6, 78, 59, 0.18);
        }

        .tour-hero-icon {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.13);
          border: 1px solid rgba(255, 255, 255, 0.19);
        }

        .tour-hero span,
        .tour-section-head span,
        .tour-feedback > div > span {
          display: block;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .tour-hero > div:nth-child(2) > span {
          color: #a7f3d0;
        }

        .tour-hero h1 {
          margin: 4px 0 0;
          font-size: clamp(27px, 3vw, 39px);
          line-height: 1;
          letter-spacing: -0.055em;
        }

        .tour-hero p {
          margin: 7px 0 0;
          max-width: 760px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 13px;
          line-height: 1.4;
        }

        .tour-home-link {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          padding: 0 13px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.09);
          color: white;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
        }

        .tour-complete {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          margin-top: 12px;
          padding: 14px 16px;
          border: 1px solid #b9dfcf;
          border-radius: 15px;
          background: #eaf8f1;
          color: #0c674f;
        }

        .tour-complete span {
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }

        .tour-complete h2 {
          margin: 2px 0 0;
          color: #0b493a;
          font-size: 17px;
        }

        .tour-complete p {
          margin: 4px 0 0;
          color: #517369;
          font-size: 12px;
          line-height: 1.45;
        }

        .tour-intro-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin-top: 12px;
        }

        .tour-intro-grid article {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr);
          column-gap: 8px;
          padding: 13px 14px;
          border: 1px solid #dbe8e3;
          border-radius: 14px;
          background: white;
        }

        .tour-intro-grid svg {
          grid-row: 1 / span 2;
          color: #0b7b5f;
        }

        .tour-intro-grid strong {
          font-size: 12px;
        }

        .tour-intro-grid p {
          margin: 3px 0 0;
          color: #697c76;
          font-size: 10px;
          line-height: 1.35;
        }

        .tour-section-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin: 22px 2px 10px;
        }

        .tour-section-head span,
        .tour-feedback > div > span {
          color: #0b7b5f;
        }

        .tour-section-head h2,
        .tour-feedback h2 {
          margin: 3px 0 0;
          color: #0c3029;
          font-size: 20px;
          letter-spacing: -0.035em;
        }

        .tour-section-head em {
          border-radius: 999px;
          padding: 6px 9px;
          background: #e3f6ed;
          color: #087052;
          font-size: 10px;
          font-style: normal;
          font-weight: 900;
        }

        .tour-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .tour-card {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          padding: 15px;
          border: 1px solid #d7e5e0;
          border-radius: 16px;
          background: white;
          box-shadow: 0 7px 20px rgba(16, 42, 38, 0.045);
        }

        .tour-card-disabled {
          opacity: 0.62;
        }

        .tour-card-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .tour-card-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #e6f6ef;
          color: #08735a;
        }

        .tour-duration {
          color: #71827d;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .tour-card h3 {
          margin: 14px 0 0;
          font-size: 16px;
          letter-spacing: -0.025em;
        }

        .tour-card p {
          margin: 6px 0 14px;
          color: #687b75;
          font-size: 11px;
          line-height: 1.45;
        }

        .tour-start,
        .tour-soon {
          margin-top: auto;
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 900;
          text-decoration: none;
        }

        .tour-start {
          background: #08735a;
          color: white;
        }

        .tour-soon {
          background: #eef3f1;
          color: #70827c;
        }

        .tour-feedback {
          margin-top: 20px;
          padding: 17px;
          border: 1px solid #d7e5e0;
          border-radius: 16px;
          background: white;
        }

        .tour-feedback-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
          margin-top: 12px;
        }

        .tour-feedback-grid article {
          padding: 12px;
          border-radius: 12px;
          background: #f5faf8;
          border: 1px solid #e0ebe7;
        }

        .tour-feedback-grid strong {
          font-size: 11px;
        }

        .tour-feedback-grid p {
          margin: 4px 0 0;
          color: #677a74;
          font-size: 10px;
          line-height: 1.4;
        }

        @media (max-width: 900px) {
          .tour-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .tour-intro-grid,
          .tour-feedback-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .tour-shell {
            padding: 10px;
          }

          .tour-hero {
            grid-template-columns: 44px minmax(0, 1fr);
          }

          .tour-home-link {
            grid-column: 1 / -1;
            justify-content: center;
          }

          .tour-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
