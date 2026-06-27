"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const hatcheryNavItems = [
  {
    label: "Hatchery Home",
    href: "/hatchery",
  },
  {
    label: "Chick Availability",
    href: "/hatchery/chick-availability",
  },
  {
    label: "Egg Receiving",
    href: "/hatchery/egg-receiving",
  },
  {
    label: "Setter Planner",
    href: "/hatchery/setter-planner",
  },
  {
    label: "Hatch Results",
    href: "/hatchery/hatch-results",
  },
];

export default function HatcheryNav() {
  const pathname = usePathname();

  return (
    <nav className="hatchery-module-nav" aria-label="Hatchery module navigation">
      <div className="nav-label">Hatchery</div>

      <div className="nav-links">
        {hatcheryNavItems.map((item) => {
          const isActive =
            item.href === "/hatchery"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "active" : ""}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .hatchery-module-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 0 0 10px;
          padding: 7px 9px;
          border: 1px solid rgba(6, 70, 56, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 12px 28px rgba(2, 37, 29, 0.06);
          backdrop-filter: blur(10px);
        }

        .nav-label {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 6px 10px;
          background: #063f34;
          color: white;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .nav-links {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          flex-wrap: wrap;
        }

        .nav-links a {
          border-radius: 999px;
          padding: 7px 10px;
          color: #073b31;
          font-size: 11px;
          font-weight: 950;
          text-decoration: none;
          transition:
            background 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .nav-links a:hover {
          background: rgba(6, 63, 52, 0.08);
        }

        .nav-links a.active {
          background: linear-gradient(135deg, #063f34, #0f7b64);
          color: white;
          box-shadow: 0 8px 18px rgba(6, 63, 52, 0.18);
        }

        @media (max-width: 900px) {
          .hatchery-module-nav {
            align-items: flex-start;
            border-radius: 18px;
            flex-direction: column;
          }

          .nav-links {
            justify-content: flex-start;
          }
        }
      `}</style>
    </nav>
  );
}