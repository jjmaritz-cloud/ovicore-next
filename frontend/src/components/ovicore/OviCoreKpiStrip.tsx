"use client";

type KpiItem = {
  label: string;
  value: string | number;
};

export default function OviCoreKpiStrip({ items }: { items: KpiItem[] }) {
  if (!items.length) return null;

  return (
    <section className="ovicore-kpi-strip">
      {items.map((item) => (
        <div className="ovicore-kpi-mini" key={item.label}>
          <div className="ovicore-kpi-mini-label">{item.label}</div>
          <div className="ovicore-kpi-mini-value">{item.value}</div>
        </div>
      ))}
    </section>
  );
}