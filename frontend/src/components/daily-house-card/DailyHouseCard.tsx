"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./DailyHouseCard.module.css";
import type {
  DailyHouseCardAction,
  DailyHouseCardProps,
} from "./DailyHouseCard.types";

const TABLE_HEIGHT_STORAGE_KEY = "ovicore_daily_house_card_table_height";
const MIN_TABLE_HEIGHT = 300;
const MAX_TABLE_HEIGHT = 720;

function getDefaultTableHeight() {
  if (typeof window === "undefined") return 420;

  // Responsive default used only until the user drags the resize handle.
  return Math.max(
    MIN_TABLE_HEIGHT,
    Math.min(MAX_TABLE_HEIGHT, window.innerHeight - 430),
  );
}

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
  const [tableHeight, setTableHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  useEffect(() => {
    const storedHeight = window.localStorage.getItem(TABLE_HEIGHT_STORAGE_KEY);
    const parsedHeight = storedHeight ? Number(storedHeight) : NaN;

    if (Number.isFinite(parsedHeight)) {
      setTableHeight(
        Math.max(MIN_TABLE_HEIGHT, Math.min(MAX_TABLE_HEIGHT, parsedHeight)),
      );
      return;
    }

    setTableHeight(getDefaultTableHeight());
  }, []);

  useEffect(() => {
    function handleWindowResize() {
      // Once the user has chosen a height, preserve that preference.
      // If no preference exists yet, keep the default responsive.
      if (window.localStorage.getItem(TABLE_HEIGHT_STORAGE_KEY)) return;

      setTableHeight(getDefaultTableHeight());
    }

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (tableHeight === null) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    resizeStartY.current = event.clientY;
    resizeStartHeight.current = tableHeight;
    setIsResizing(true);
  }

  function resizeTable(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizing) return;

    const delta = event.clientY - resizeStartY.current;
    const nextHeight = Math.max(
      MIN_TABLE_HEIGHT,
      Math.min(MAX_TABLE_HEIGHT, resizeStartHeight.current + delta),
    );

    setTableHeight(nextHeight);
    window.localStorage.setItem(
      TABLE_HEIGHT_STORAGE_KEY,
      String(Math.round(nextHeight)),
    );
  }

  function stopResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizing) return;

    setIsResizing(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className={styles.shell}>
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

        <div
          className={styles.tableScroll}
          style={{
            height: tableHeight === null ? undefined : `${tableHeight}px`,
            maxHeight: "none",
            overflow: "auto",
          }}
        >
          {children}
        </div>

        <div
          className="ovicore-daily-table-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize Daily House Card table"
          title="Drag to show more or fewer rows"
          onPointerDown={startResize}
          onPointerMove={resizeTable}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          data-resizing={isResizing ? "true" : "false"}
        >
          <span />
        </div>

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

      <style jsx global>{`
        .ovicore-daily-table-resizer {
          height: 12px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: ns-resize;
          touch-action: none;
          user-select: none;
          background: transparent;
        }

        .ovicore-daily-table-resizer span {
          width: 52px;
          height: 4px;
          border-radius: 999px;
          background: rgba(15, 92, 78, 0.28);
          transition:
            width 120ms ease,
            background 120ms ease,
            transform 120ms ease;
        }

        .ovicore-daily-table-resizer:hover span,
        .ovicore-daily-table-resizer[data-resizing="true"] span {
          width: 66px;
          background: rgba(15, 92, 78, 0.62);
          transform: scaleY(1.15);
        }

        .ovicore-daily-table-resizer[data-resizing="true"] {
          cursor: ns-resize;
        }

        @media (max-width: 900px) {
          .ovicore-daily-table-resizer {
            height: 16px;
          }

          .ovicore-daily-table-resizer span {
            width: 60px;
            height: 5px;
          }
        }
      `}</style>
        </main>
      </div>
    </div>
  );
}
