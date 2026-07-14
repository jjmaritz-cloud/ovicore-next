"use client";

type OviCoreTableCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export default function OviCoreTableCard({
  title,
  subtitle,
  children,
  actions,
}: OviCoreTableCardProps) {
  return (
    <section className="ovicore-card">
      <div className="ovicore-card-header">
        <div>
          <h2 className="ovicore-card-title">{title}</h2>
          {subtitle ? (
            <p className="ovicore-card-subtitle">{subtitle}</p>
          ) : null}
        </div>

        {actions ? <div>{actions}</div> : null}
      </div>

      <div className="ovicore-card-body">{children}</div>
    </section>
  );
}