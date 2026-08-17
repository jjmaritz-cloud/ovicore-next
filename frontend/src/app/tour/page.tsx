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

          <div className="tour-hero-actions">
            <Link href="/home?tour=overview&step=0" className="tour-hero-start">
              <PlayCircle size={18} />
              <span>TAKE THE TOUR</span>
              <ArrowRight size={17} />
            </Link>

            <Link href="/home" className="tour-home-link">
              Back to modules
            </Link>
          </div>
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

        <section className="tour-showcase">
          {tours.filter((tour) => tour.available).map(
            ({ title, description, duration, icon: Icon, href }) => (
              <article className="tour-featured-card" key={title}>
                <div className="tour-featured-copy">
                  <div className="tour-featured-top">
                    <span className="tour-featured-icon">
                      <Icon size={26} />
                    </span>
                    <span className="tour-duration">{duration}</span>
                  </div>

                  <span className="tour-featured-eyebrow">Recommended first</span>
                  <h3>{title}</h3>
                  <p>{description}</p>

                  <div className="tour-featured-points">
                    <span>Module selector</span>
                    <span>Broiler operations</span>
                    <span>AI Intelligence</span>
                    <span>Planning</span>
                    <span>Audit readiness</span>
                  </div>

                  {href ? (
                    <Link href={href} className="tour-start tour-start-featured">
                      <PlayCircle size={17} />
                      {completed ? "Take overview tour again" : "Start OviCore overview"}
                      <ArrowRight size={16} />
                    </Link>
                  ) : null}
                </div>

                <div className="tour-featured-visual" aria-hidden="true">
                  <div className="tour-map-step">
                    <span>1</span>
                    <div><strong>Operations</strong><small>See the current position</small></div>
                  </div>
                  <div className="tour-map-line" />
                  <div className="tour-map-step">
                    <span>2</span>
                    <div><strong>Intelligence</strong><small>Understand what changed</small></div>
                  </div>
                  <div className="tour-map-line" />
                  <div className="tour-map-step">
                    <span>3</span>
                    <div><strong>Planning</strong><small>Act before the gap occurs</small></div>
                  </div>
                  <div className="tour-map-line" />
                  <div className="tour-map-step">
                    <span>4</span>
                    <div><strong>Assurance</strong><small>Stay audit ready</small></div>
                  </div>
                </div>
              </article>
            ),
          )}

          <div className="tour-secondary-grid">
            {tours.filter((tour) => !tour.available).map(
              ({ title, description, duration, icon: Icon }) => (
                <article className="tour-card tour-card-disabled" key={title}>
                  <div className="tour-card-top">
                    <span className="tour-card-icon">
                      <Icon size={20} />
                    </span>
                    <span className="tour-duration">{duration}</span>
                  </div>

                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="tour-soon">In development</span>
                </article>
              ),
            )}
          </div>
        </section>


        <section className="tour-chain">
          <div className="tour-chain-copy">
            <span>Integrated production chain</span>
            <h2>One change upstream can move the whole plan</h2>
            <p>
              OviCore is being built so breeder performance, hatchery chick
              supply and broiler demand are not isolated numbers. A fertility
              or hatchability change should flow through to expected chick
              availability, future broiler placements, shed demand and
              processing output.
            </p>
          </div>

          <div className="tour-chain-flow">
            <article>
              <strong>Breeders</strong>
              <span>Eggs · fertility · hatch eggs</span>
              <em>↓ hatchable supply</em>
            </article>
            <ArrowRight size={20} />
            <article>
              <strong>Hatchery</strong>
              <span>Eggs set · hatch % · chicks</span>
              <em>↓ chicks available</em>
            </article>
            <ArrowRight size={20} />
            <article>
              <strong>Broilers</strong>
              <span>Placements · shed capacity · demand</span>
              <em>↓ live bird output</em>
            </article>
            <ArrowRight size={20} />
            <article>
              <strong>Processing</strong>
              <span>Weekly load · liveweight · throughput</span>
              <em>future output</em>
            </article>
          </div>

          <div className="tour-chain-example">
            <strong>Example:</strong>
            <span>
              fertility drops → fewer chicks available → planned broiler
              placements become short → processing output falls unless timing
              or alternative supply is changed.
            </span>
          </div>
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
          width: min(1480px, 100%);
          margin: 0 auto;
        }

        .tour-hero {
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          padding: 24px 28px;
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
          font-size: clamp(30px, 3vw, 44px);
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

        .tour-hero-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          flex-wrap: wrap;
        }

        :global(.tour-hero-start) {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: 12px;
          background: #ffffff;
          color: #075e49;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: 0.035em;
          text-decoration: none;
          box-shadow:
            0 10px 26px rgba(0, 0, 0, 0.16),
            inset 0 0 0 1px rgba(255, 255, 255, 0.45);
          transition: transform 140ms ease, box-shadow 140ms ease;
        }

        :global(.tour-hero-start):hover {
          transform: translateY(-1px);
          box-shadow:
            0 14px 32px rgba(0, 0, 0, 0.2),
            inset 0 0 0 1px rgba(255, 255, 255, 0.55);
        }

        :global(.tour-home-link) {
          min-height: 38px;
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


        :global(a.tour-hero-start) {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: #ffffff;
          color: #075e49 !important;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: 0.045em;
          text-decoration: none !important;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
        }

        :global(a.tour-home-link) {
          color: rgba(255, 255, 255, 0.94) !important;
          text-decoration: none !important;
        }

        :global(a.tour-start) {
          text-decoration: none !important;
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
          grid-template-columns: 38px minmax(0, 1fr);
          grid-template-rows: auto auto;
          column-gap: 11px;
          row-gap: 4px;
          align-items: start;
          min-height: 104px;
          padding: 17px 18px;
          border: 1px solid #dbe8e3;
          border-radius: 14px;
          background: white;
        }

        .tour-intro-grid svg {
          grid-column: 1;
          grid-row: 1 / span 2;
          width: 22px;
          height: 22px;
          margin-top: 1px;
          color: #0b7b5f;
        }

        .tour-intro-grid strong {
          grid-column: 2;
          grid-row: 1;
          display: block;
          min-width: 0;
          color: #173c33;
          font-size: 13px;
          line-height: 1.25;
        }

        .tour-intro-grid p {
          grid-column: 2;
          grid-row: 2;
          width: 100%;
          min-width: 0;
          margin: 0;
          color: #637771;
          font-size: 11px;
          line-height: 1.45;
          white-space: normal;
          overflow-wrap: normal;
          word-break: normal;
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

        :global(.tour-start),
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

        :global(.tour-start) {
          background: #08735a;
          color: white;
        }

        .tour-soon {
          background: #eef3f1;
          color: #70827c;
        }

        .tour-showcase {
          display: grid;
          gap: 12px;
        }

        .tour-featured-card {
          min-height: 300px;
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
          gap: 20px;
          padding: 22px;
          border: 1px solid #cfe2da;
          border-radius: 20px;
          background:
            radial-gradient(circle at 88% 18%, rgba(16, 185, 129, 0.1), transparent 34%),
            linear-gradient(135deg, #ffffff, #f7fcfa);
          box-shadow: 0 14px 35px rgba(16, 42, 38, 0.07);
        }

        .tour-featured-copy {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .tour-featured-top {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .tour-featured-icon {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: linear-gradient(135deg, #075e49, #0d8a68);
          color: white;
          box-shadow: 0 10px 24px rgba(8, 115, 90, 0.2);
        }

        .tour-featured-eyebrow {
          margin-top: 18px;
          color: #0b7b5f;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .tour-featured-card h3 {
          margin: 5px 0 0;
          color: #0b3028;
          font-size: 26px;
          letter-spacing: -0.045em;
        }

        .tour-featured-card p {
          max-width: 720px;
          margin: 8px 0 13px;
          color: #5f756e;
          font-size: 13px;
          line-height: 1.55;
        }

        .tour-featured-points {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 18px;
        }

        .tour-featured-points span {
          border: 1px solid #d6e6e0;
          border-radius: 999px;
          padding: 6px 9px;
          background: #f5faf8;
          color: #3f6258;
          font-size: 10px;
          font-weight: 850;
        }

        :global(.tour-start)-featured {
          min-height: 42px;
          padding: 0 15px;
          gap: 8px;
          font-size: 11px;
          box-shadow: 0 10px 24px rgba(8, 115, 90, 0.18);
        }

        .tour-featured-visual {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 20px;
          border: 1px solid #d9e7e2;
          border-radius: 17px;
          background:
            linear-gradient(180deg, rgba(6, 78, 59, 0.035), rgba(15, 118, 110, 0.015)),
            white;
        }

        .tour-map-step {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .tour-map-step > span {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #e4f5ee;
          color: #08735a;
          font-size: 11px;
          font-weight: 950;
        }

        .tour-map-step strong {
          display: block;
          color: #163c33;
          font-size: 12px;
        }

        .tour-map-step small {
          display: block;
          margin-top: 2px;
          color: #70827c;
          font-size: 10px;
        }

        .tour-map-line {
          width: 2px;
          height: 22px;
          margin: 3px 0 3px 16px;
          background: linear-gradient(#9fd6c4, #d8ebe4);
        }

        .tour-secondary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }


        .tour-chain {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid #cfe2da;
          border-radius: 18px;
          background:
            radial-gradient(circle at 90% 10%, rgba(14, 116, 144, 0.07), transparent 30%),
            linear-gradient(135deg, #ffffff, #f5fbf8);
        }

        .tour-chain-copy > span {
          display: block;
          color: #0b7b5f;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .tour-chain-copy h2 {
          margin: 4px 0 0;
          color: #0d332b;
          font-size: 21px;
          letter-spacing: -0.035em;
        }

        .tour-chain-copy p {
          max-width: 980px;
          margin: 7px 0 0;
          color: #62766f;
          font-size: 12px;
          line-height: 1.5;
        }

        .tour-chain-flow {
          display: grid;
          grid-template-columns: 1fr 28px 1fr 28px 1fr 28px 1fr;
          gap: 7px;
          align-items: center;
          margin-top: 15px;
        }

        .tour-chain-flow > svg {
          justify-self: center;
          color: #7ba99b;
        }

        .tour-chain-flow article {
          min-height: 104px;
          padding: 13px;
          border: 1px solid #d8e6e1;
          border-radius: 14px;
          background: #ffffff;
        }

        .tour-chain-flow strong {
          display: block;
          color: #123c32;
          font-size: 13px;
        }

        .tour-chain-flow span {
          display: block;
          margin-top: 5px;
          color: #667a74;
          font-size: 10px;
          line-height: 1.35;
        }

        .tour-chain-flow em {
          display: inline-flex;
          margin-top: 10px;
          border-radius: 999px;
          padding: 5px 7px;
          background: #e9f6f1;
          color: #08715a;
          font-size: 9px;
          font-style: normal;
          font-weight: 900;
        }

        .tour-chain-example {
          display: flex;
          gap: 7px;
          margin-top: 11px;
          padding: 9px 11px;
          border-radius: 11px;
          background: #eef8f4;
          color: #49685f;
          font-size: 10px;
          line-height: 1.4;
        }

        .tour-chain-example strong {
          color: #075e49;
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
          .tour-featured-card {
            grid-template-columns: 1fr;
          }

          .tour-secondary-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .tour-intro-grid,
          .tour-feedback-grid {
            grid-template-columns: 1fr;
          }

          .tour-chain-flow {
            grid-template-columns: 1fr;
          }

          .tour-chain-flow > svg {
            transform: rotate(90deg);
          }
        }

        @media (max-width: 650px) {
          .tour-shell {
            padding: 10px;
          }

          .tour-hero {
            grid-template-columns: 44px minmax(0, 1fr);
          }

          .tour-hero-actions {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: stretch;
          }

          :global(.tour-hero-start),
          :global(.tour-home-link) {
            flex: 1;
            justify-content: center;
          }

          .tour-secondary-grid {
            grid-template-columns: 1fr;
          }

          .tour-featured-card {
            padding: 16px;
          }

          .tour-featured-visual {
            padding: 14px;
          }
        }
      `}</style>
    </main>
  );
}
