"use client";

import Link from "next/link";
import BroilerSidebar from "@/components/BroilerSidebar";
import styles from "./DailyHouseCard.module.css";
import type {
  DailyHouseCardAction,
  DailyHouseCardProps,
} from "./DailyHouseCard.types";

function HeaderAction({ action }: { action?: DailyHouseCardAction }) {
  if (!action) return null;

  const className =
    action.variant === "secondary"
      ? styles.secondaryHeaderAction
      : styles.primaryHeaderAction;

  if (action.href) {
    return (
      <Link className={className} href={action.href}>
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}

export default function DailyHouseCard({
  moduleLabel,
  description,
  selectorLabel,
  selector,
  kpis,
  tableDescription,
  tableSummary,
  message,
  homeAction,
  secondaryAction,
  onSave,
  onDiscard,
  saveDisabled = false,
  discardDisabled = false,
  saving = false,
  unsavedCount = 0,
  footerItems = [],
  children,
}: DailyHouseCardProps) {
  return (
    <div className={styles.shell}>
      <BroilerSidebar />

      <div className={styles.content}>
        <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{moduleLabel}</p>
          <h1>Daily House Card</h1>
          <p className={styles.description}>{description}</p>
        </div>

        <div className={styles.headerActions}>
          <HeaderAction action={homeAction} />
          <HeaderAction action={secondaryAction} />
        </div>
      </section>

      <section className={styles.controls}>
        <label className={styles.selector}>
          <span>{selectorLabel}</span>
          {selector}
        </label>

        <div className={styles.saveActions}>
          <button
            type="button"
            className={styles.discardButton}
            disabled={discardDisabled}
            onClick={onDiscard}
          >
            Discard changes
          </button>

          <button
            type="button"
            className={styles.saveButton}
            disabled={saveDisabled}
            onClick={onSave}
          >
            {saving
              ? "Saving…"
              : unsavedCount > 0
                ? `Save changes (${unsavedCount})`
                : "Save changes"}
          </button>
        </div>
      </section>

      <section className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className={`${styles.kpiCard} ${
              styles[`kpi_${kpi.tone ?? "neutral"}`]
            }`}
          >
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            {kpi.helper ? <p>{kpi.helper}</p> : null}
          </article>
        ))}
      </section>

      <section className={styles.tableCard}>
        <header className={styles.tableHeader}>
          <div>
            <h2>Daily House Card Entry</h2>
            <p>{tableDescription}</p>
          </div>

          {tableSummary ? (
            <strong className={styles.tableSummary}>{tableSummary}</strong>
          ) : null}
        </header>

        {message ? <div className={styles.message}>{message}</div> : null}

        <div className={styles.tableScroll}>{children}</div>

        {footerItems.length > 0 ? (
          <footer className={styles.footer}>
            {footerItems.map((item) => (
              <span key={item.label}>
                <b>{item.label}:</b> {item.value}
              </span>
            ))}
          </footer>
        ) : null}
      </section>
        </main>
      </div>
    </div>
  );
}
