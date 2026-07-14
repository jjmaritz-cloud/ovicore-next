"use client";

type OviCorePageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export default function OviCorePageHeader({
  title,
  subtitle,
  children,
}: OviCorePageHeaderProps) {
  return (
    <header className="ovicore-page-header">
      <div className="ovicore-page-header-main">
        <h1 className="ovicore-page-title">{title}</h1>
        {subtitle ? <p className="ovicore-page-subtitle">{subtitle}</p> : null}
      </div>

      {children ? (
        <div className="ovicore-page-header-actions">{children}</div>
      ) : null}
    </header>
  );
}