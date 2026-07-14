"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

type HeaderAction = {
  label: string;
  href?: string;
  type?: "home" | "refresh" | "warning" | "default";
  onClick?: () => void;
};

type OviCoreModuleHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: HeaderAction[];
};

function HeaderActionButton({ action }: { action: HeaderAction }) {
  const icon =
    action.type === "home" ? (
      <Home size={16} />
    ) : action.type === "refresh" ? (
      <RefreshCw size={15} />
    ) : action.type === "warning" ? (
      <AlertTriangle size={15} />
    ) : null;

  const className = `ovicore-module-header-action ${
    action.type === "warning" ? "warning" : ""
  }`;

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {icon}
        <span>{action.label}</span>
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={action.onClick}>
      {icon}
      <span>{action.label}</span>
    </button>
  );
}

export default function OviCoreModuleHeader({
  eyebrow,
  title,
  description,
  actions = [],
}: OviCoreModuleHeaderProps) {
  return (
    <section className="ovicore-module-header">
      <div className="ovicore-module-header-content">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>

      {actions.length > 0 && (
        <div className="ovicore-module-header-actions">
          {actions.map((action) => (
            <HeaderActionButton key={action.label} action={action} />
          ))}
        </div>
      )}

			<style jsx>{`
				.ovicore-module-header {
					position: relative;
					min-height: 92px;
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 22px;
					padding: 18px 26px;
					margin-bottom: 12px;
					overflow: hidden;
					border-radius: 18px;
					color: white;
					background:
						radial-gradient(circle at 84% 18%, rgba(20, 184, 166, 0.3), transparent 34%),
						linear-gradient(135deg, #052e26 0%, #064e3b 52%, #047857 100%);
					border: 1px solid rgba(255, 255, 255, 0.16);
					box-shadow: 0 16px 38px rgba(15, 23, 42, 0.16);
				}

				.ovicore-module-header::before {
					content: "";
					position: absolute;
					inset: -88px -160px auto auto;
					width: 620px;
					height: 250px;
					border-radius: 999px;
					background:
						repeating-linear-gradient(
							165deg,
							rgba(255, 255, 255, 0.1) 0px,
							rgba(255, 255, 255, 0.1) 1px,
							transparent 1px,
							transparent 13px
						);
					opacity: 0.14;
					pointer-events: none;
				}

				.ovicore-module-header-content {
					position: relative;
					z-index: 1;
					min-width: 0;
				}

				.ovicore-module-header-content p {
					margin: 0;
					font-size: 10px;
					font-weight: 950;
					letter-spacing: 0.22em;
					text-transform: uppercase;
					color: #a7f3d0;
				}

				.ovicore-module-header-content h1 {
					margin: 7px 0 0;
					font-size: clamp(28px, 2.4vw, 38px);
					line-height: 0.98;
					letter-spacing: -0.055em;
					font-weight: 950;
					color: white;
				}

				.ovicore-module-header-content span {
					display: block;
					margin-top: 8px;
					max-width: 850px;
					font-size: 13px;
					line-height: 1.35;
					font-weight: 700;
					color: rgba(255, 255, 255, 0.86);
				}

				.ovicore-module-header-actions {
					position: relative;
					z-index: 1;
					display: flex;
					align-items: center;
					justify-content: flex-end;
					gap: 9px;
					flex-wrap: wrap;
				}

				.ovicore-module-header-action {
					min-height: 34px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					gap: 7px;
					padding: 0 14px;
					border-radius: 999px;
					border: 1px solid rgba(255, 255, 255, 0.28);
					background: rgba(255, 255, 255, 0.08);
					color: white;
					font-size: 12px;
					font-weight: 900;
					text-decoration: none;
					cursor: pointer;
					backdrop-filter: blur(8px);
					box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
					transition: all 0.16s ease;
				}

				.ovicore-module-header-action:hover {
					transform: translateY(-1px);
					background: rgba(255, 255, 255, 0.14);
				}

				.ovicore-module-header-action.warning {
					border-color: rgba(253, 230, 138, 0.42);
					background: rgba(245, 158, 11, 0.18);
					color: #fef3c7;
				}

				@media (max-width: 900px) {
					.ovicore-module-header {
						align-items: flex-start;
						flex-direction: column;
						padding: 18px;
					}

					.ovicore-module-header-actions {
						justify-content: flex-start;
					}
				}
			`}</style>
    </section>
  );
}
