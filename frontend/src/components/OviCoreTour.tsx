"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";

type TourStep = {
  route: string;
  target: string;
  eyebrow: string;
  title: string;
  body: string;
};

const overviewSteps: TourStep[] = [
  {
    route: "/home",
    target: '[data-tour="module-selector"]',
    eyebrow: "OviCore overview",
    title: "Start from the module selector",
    body:
      "OviCore is organised around the way the poultry business actually operates. Choose a production, planning or assurance module from this page.",
  },
  {
    route: "/broilers",
    target: '[data-tour="broiler-command"]',
    eyebrow: "Operational command",
    title: "See the current broiler position",
    body:
      "Broiler Home combines placement demand, live production actuals, chick supply pressure, weather risk and upcoming processing pressure in one operational view.",
  },
  {
    route: "/broilers/intelligence",
    target: '[data-tour="broiler-intelligence"]',
    eyebrow: "OviCore Intelligence",
    title: "The AI turns flock data into a management story",
    body:
      "This is more than a dashboard. OviCore compares the flock with age-matched standards, watches the direction of change, identifies abnormal combinations across growth, mortality, feed, water and density, and then explains the likely pressure and the action worth checking first. The aim is to tell a manager what changed, why it matters and where to look — without making them interpret every graph manually.",
  },
  {
    route: "/planning",
    target: '[data-tour="planning-command"]',
    eyebrow: "Integrated planning",
    title: "Match future bird demand to real housing capacity",
    body:
      "Think of Planning as a supply-and-demand bridge. OviCore starts with the birds you expect to have available in rearing, checks when those birds are ready to move, compares that supply with layer sheds becoming available, and then allocates birds into future destination sheds. If a destination needs 48,000 birds but no suitable rearing flock is available — or a flock is too young, too small or clashes with shed timing — OviCore flags the gap early so placements, depletion dates or supply plans can be adjusted before the problem reaches the farm.",
  },
  {
    route: "/compliance",
    target: '[data-tour="compliance-command"]',
    eyebrow: "People, Safety & Compliance",
    title: "Keep sites ready, not just recorded",
    body:
      "Safety, training, incidents and audit readiness sit together so outstanding actions, expiring competencies and evidence gaps can be managed continuously.",
  },
  {
    route: "/compliance",
    target: '[data-tour="audit-readiness"]',
    eyebrow: "Audit readiness",
    title: "Know what would fail an audit today",
    body:
      "The readiness view brings together training, SOP acknowledgement, corrective actions, operational records and evidence coverage into one live assurance picture.",
  },
];

function getStepFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get("tour") !== "overview") return null;

  const parsed = Number(params.get("step") ?? "0");
  if (!Number.isInteger(parsed)) return 0;

  return Math.min(Math.max(parsed, 0), overviewSteps.length - 1);
}

function routeWithTour(stepIndex: number) {
  const step = overviewSteps[stepIndex];
  const companyId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("company_id")
      : null;

  const separator = step.route.includes("?") ? "&" : "?";
  const companyParam =
    companyId && (step.route === "/planning" || step.route === "/broilers")
      ? `&company_id=${encodeURIComponent(companyId)}`
      : "";

  return `${step.route}${separator}tour=overview&step=${stepIndex}${companyParam}`;
}

export default function OviCoreTour() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setStepIndex(getStepFromUrl());
  }, []);

  const step = useMemo(
    () => (stepIndex === null ? null : overviewSteps[stepIndex]),
    [stepIndex],
  );

  useEffect(() => {
    if (!step) return;

    let cancelled = false;
    let attempts = 0;

    const locate = () => {
      if (cancelled) return;

      const target = document.querySelector(step.target) as HTMLElement | null;

      if (!target) {
        attempts += 1;
        if (attempts < 20) {
          window.setTimeout(locate, 150);
        }
        return;
      }

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });

      const updateRect = () => {
        if (!cancelled) setTargetRect(target.getBoundingClientRect());
      };

      window.setTimeout(updateRect, 280);
    };

    locate();

    const update = () => {
      const target = document.querySelector(step.target) as HTMLElement | null;
      if (target) setTargetRect(target.getBoundingClientRect());
    };

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  if (stepIndex === null || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === overviewSteps.length - 1;

  const moveTo = (nextIndex: number) => {
    window.location.href = routeWithTour(nextIndex);
  };

  const finish = () => {
    window.localStorage.setItem("ovicore_guided_tour_overview_complete", "true");
    window.localStorage.setItem(
      "ovicore_guided_tour_overview_completed_at",
      new Date().toISOString(),
    );
    window.location.href = "/tour?complete=1";
  };

  const skip = () => {
    window.location.href = "/tour";
  };

  const pad = 8;
  const spotlight = targetRect
    ? {
        top: Math.max(8, targetRect.top - pad),
        left: Math.max(8, targetRect.left - pad),
        width: Math.max(40, targetRect.width + pad * 2),
        height: Math.max(40, targetRect.height + pad * 2),
      }
    : null;

  const panelTop =
    spotlight && spotlight.top + spotlight.height + 18 < window.innerHeight - 210
      ? spotlight.top + spotlight.height + 18
      : Math.max(18, (spotlight?.top ?? 200) - 210);

  return (
    <div className="ovicore-tour-layer" role="dialog" aria-modal="true">
      {!spotlight ? <div className="ovicore-tour-dim" /> : null}

      {spotlight ? (
        <div
          className="ovicore-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : null}

      <div
        className="ovicore-tour-panel"
        style={{
          top: panelTop,
          right: 24,
        }}
      >
        <div className="ovicore-tour-panel-top">
          <span className="ovicore-tour-icon">
            <Compass size={18} />
          </span>

          <div>
            <span className="ovicore-tour-eyebrow">{step.eyebrow}</span>
            <h2>{step.title}</h2>
          </div>

          <button type="button" className="ovicore-tour-close" onClick={skip} aria-label="Close guided tour">
            <X size={17} />
          </button>
        </div>

        <p>{step.body}</p>

        <div className="ovicore-tour-progress" aria-label={`Step ${stepIndex + 1} of ${overviewSteps.length}`}>
          {overviewSteps.map((_, index) => (
            <span key={index} className={index <= stepIndex ? "complete" : ""} />
          ))}
        </div>

        <div className="ovicore-tour-footer">
          <span>
            Step <strong>{stepIndex + 1}</strong> of {overviewSteps.length}
          </span>

          <div className="ovicore-tour-actions">
            {!isFirst ? (
              <button type="button" className="secondary" onClick={() => moveTo(stepIndex - 1)}>
                <ArrowLeft size={15} />
                Back
              </button>
            ) : (
              <button type="button" className="secondary" onClick={skip}>
                Skip tour
              </button>
            )}

            {isLast ? (
              <button type="button" className="primary" onClick={finish}>
                <Check size={15} />
                Finish
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => moveTo(stepIndex + 1)}>
                Next
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ovicore-tour-layer {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          pointer-events: none;
        }

        .ovicore-tour-dim {
          position: absolute;
          inset: 0;
          background: rgba(2, 20, 17, 0.58);
          backdrop-filter: blur(1.5px);
          pointer-events: auto;
        }

        .ovicore-tour-spotlight {
          position: fixed;
          z-index: 2;
          border: 3px solid rgba(110, 231, 183, 1);
          border-radius: 18px;
          background: transparent;
          box-shadow:
            0 0 0 9999px rgba(2, 20, 17, 0.54),
            0 0 0 7px rgba(16, 185, 129, 0.18),
            0 0 32px rgba(52, 211, 153, 0.42),
            0 18px 60px rgba(0, 0, 0, 0.28);
          pointer-events: none;
          transition:
            top 180ms ease,
            left 180ms ease,
            width 180ms ease,
            height 180ms ease;
        }

        .ovicore-tour-panel {
          position: fixed;
          z-index: 3;
          width: min(470px, calc(100vw - 32px));
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 20px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 24px 80px rgba(2, 20, 17, 0.34);
          color: #102a26;
          pointer-events: auto;
        }

        .ovicore-tour-panel-top {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 30px;
          gap: 10px;
          align-items: start;
        }

        .ovicore-tour-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(135deg, #064e3b, #0f8a69);
          color: white;
        }

        .ovicore-tour-eyebrow {
          display: block;
          margin-bottom: 3px;
          color: #0f765e;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .ovicore-tour-panel h2 {
          margin: 0;
          color: #0b2f28;
          font-size: 20px;
          line-height: 1.1;
          letter-spacing: -0.035em;
        }

        .ovicore-tour-panel > p {
          margin: 13px 0 15px;
          color: #526b65;
          font-size: 13.5px;
          font-weight: 650;
          line-height: 1.55;
        }

        .ovicore-tour-close {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #eef5f2;
          color: #46635c;
        }

        .ovicore-tour-progress {
          display: grid;
          grid-template-columns: repeat(${overviewSteps.length}, 1fr);
          gap: 5px;
          margin-bottom: 14px;
        }

        .ovicore-tour-progress span {
          height: 4px;
          border-radius: 999px;
          background: #dce8e4;
        }

        .ovicore-tour-progress span.complete {
          background: #0f8a69;
        }

        .ovicore-tour-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 12px;
          border-top: 1px solid #e5eeeb;
          color: #71837e;
          font-size: 11px;
        }

        .ovicore-tour-actions {
          display: flex;
          gap: 7px;
        }

        .ovicore-tour-actions button {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 11px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .ovicore-tour-actions .secondary {
          border: 1px solid #d5e2de;
          background: #fff;
          color: #3f5c54;
        }

        .ovicore-tour-actions .primary {
          background: linear-gradient(135deg, #075e49, #0d8a68);
          color: white;
          box-shadow: 0 7px 18px rgba(8, 115, 90, 0.22);
        }

        @media (max-width: 720px) {
          .ovicore-tour-panel {
            position: fixed;
            top: auto !important;
            right: 12px !important;
            bottom: 12px;
            left: 12px;
            width: auto;
          }

          .ovicore-tour-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .ovicore-tour-actions {
            width: 100%;
          }

          .ovicore-tour-actions button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
