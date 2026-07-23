import Link from "next/link";
import React from "react";

export type DailyHouseCardKpi = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "normal" | "good" | "warning" | "bad";
};

export type DailyHouseCardFooterPill = {
  label: string;
  value: string | number;
};

type DailyHouseCardTemplateProps = {
  moduleLabel: string;
  description: string;

  homeHref: string;
  homeLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;

  selectorLabel: string;
  selector: React.ReactNode;

  onDiscard?: () => void;
  onSave?: () => void;
  discardDisabled?: boolean;
  saveDisabled?: boolean;
  saving?: boolean;
  unsavedCount?: number;

  kpis: DailyHouseCardKpi[];

  tableDescription: string;
  tableSummary?: string;

  children: React.ReactNode;
  footerPills?: DailyHouseCardFooterPill[];
  message?: string;
};

export default function DailyHouseCardTemplate({
  moduleLabel,
  description,
  homeHref,
  homeLabel,
  secondaryHref,
  secondaryLabel,
  selectorLabel,
  selector,
  onDiscard,
  onSave,
  discardDisabled = false,
  saveDisabled = false,
  saving = false,
  unsavedCount = 0,
  kpis,
  tableDescription,
  tableSummary,
  children,
  footerPills = [],
  message,
}: DailyHouseCardTemplateProps) {
  return (
    <main className="house-sheet-panel daily-house-card">
      <section className="house-sheet-header">
        <div>
          <p className="house-sheet-eyebrow">{moduleLabel}</p>
          <h1>Daily House Card</h1>
          <span>{description}</span>
        </div>

        <div className="house-sheet-header-actions">
          <Link href={homeHref}>{homeLabel}</Link>

          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          )}
        </div>
      </section>

      <section className="house-sheet-control-row">
        <label>
          {selectorLabel}
          {selector}
        </label>

        <div className="house-sheet-save-actions">
          <button
            type="button"
            className="house-sheet-discard"
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            Discard Changes
          </button>

          <button
            type="button"
            className="house-sheet-save"
            onClick={onSave}
            disabled={saveDisabled}
          >
            {saving
              ? "Saving..."
              : unsavedCount > 0
                ? `Save Changes (${unsavedCount})`
                : "Save Changes"}
          </button>
        </div>
      </section>

      <section className="house-sheet-kpi-strip">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`house-sheet-kpi house-sheet-kpi-${kpi.tone || "normal"}`}
          >
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            {kpi.helper && <p>{kpi.helper}</p>}
          </div>
        ))}
      </section>

      <section className="house-sheet-table-card">
        <div className="house-sheet-table-titlebar">
          <div>
            <h2>Daily House Card Entry</h2>
            <span>{tableDescription}</span>
          </div>

          {tableSummary && <strong>{tableSummary}</strong>}
        </div>

        {message && <div className="house-sheet-message">{message}</div>}

        <div className="house-sheet-table-scroll">{children}</div>

        {footerPills.length > 0 && (
          <div className="house-sheet-footer">
            {footerPills.map((pill) => (
              <span key={pill.label}>
                {pill.label}: {pill.value}
              </span>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
